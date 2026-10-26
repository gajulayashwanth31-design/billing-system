const {
  query,
  withActorTransaction,
} = require("../config/db");
const { notFound } = require("../utils/errors");

function list(resource, role) {
  return async (req, res) => {
    const { page, limit, search, sort, direction } = req.validated.query;
    const offset = (page - 1) * limit;
    const needle = search ? `%${search}%` : null;
    let select;
    let table;
    let orderBy;
    let searchExpression;
    let parameters;
    let activeFilter = "";
    if (resource === "categories") {
      select = "category_id AS id, name, created_at";
      table = "categories";
      orderBy = sort === "created_at" ? "created_at" : "name";
      searchExpression = "(? IS NULL OR name LIKE ?)";
      parameters = [needle, needle];
    } else if (resource === "tax-rates") {
      select = "tax_id AS id, name, rate_percent";
      table = "tax_rates";
      orderBy = sort === "rate_percent" ? "rate_percent" : "name";
      searchExpression = "(? IS NULL OR name LIKE ?)";
      parameters = [needle, needle];
    } else {
      select = `p.product_id AS id, p.sku, p.name, p.price, p.reorder_level, p.is_active,
                c.category_id, c.name AS category_name, tr.tax_id, tr.name AS tax_name,
                tr.rate_percent AS tax_rate, s.quantity AS stock_quantity`;
      table = `products p JOIN categories c ON c.category_id = p.category_id
               JOIN tax_rates tr ON tr.tax_id = p.tax_id
               JOIN stock s ON s.product_id = p.product_id`;
      orderBy =
        sort === "price" ? "p.price" : sort === "sku" ? "p.sku" : "p.name";
      searchExpression = `(? IS NULL OR p.name LIKE ? OR p.sku LIKE ?)
                          AND (? IS NULL OR p.category_id = ?)`;
      parameters = [
        needle,
        needle,
        needle,
        req.validated.query.categoryId ?? null,
        req.validated.query.categoryId ?? null,
      ];
      activeFilter = "AND (? <> 'CASHIER' OR p.is_active = TRUE)";
    }
    const rows = await query(
      role,
      `SELECT ${select} FROM ${table}
       WHERE ${searchExpression} ${activeFilter}
       ORDER BY ${orderBy} ${direction === "desc" ? "DESC" : "ASC"}
       LIMIT ? OFFSET ?`,
      [
        ...parameters,
        ...(resource === "products" ? [role] : []),
        limit,
        offset,
      ],
    );
    const countRows = await query(
      role,
      `SELECT COUNT(*) AS total FROM ${table} WHERE ${searchExpression}
       ${activeFilter}`,
      [...parameters, ...(resource === "products" ? [role] : [])],
    );
    return res.json({
      data: rows,
      pagination: { page, limit, total: countRows[0].total },
    });
  };
}

function getById(resource, role) {
  return async (req, res) => {
    const { id } = req.validated.params;
    let sql;
    let parameters = [id];
    if (resource === "categories")
      sql =
        "SELECT category_id AS id, name, created_at FROM categories WHERE category_id = ?";
    else if (resource === "tax-rates")
      sql =
        "SELECT tax_id AS id, name, rate_percent FROM tax_rates WHERE tax_id = ?";
    else {
      sql = `SELECT p.product_id AS id, p.sku, p.name, p.price, p.reorder_level, p.is_active,
                    p.category_id, c.name AS category_name, p.tax_id, tr.name AS tax_name,
                    tr.rate_percent AS tax_rate, s.quantity AS stock_quantity
             FROM products p JOIN categories c ON c.category_id = p.category_id
             JOIN tax_rates tr ON tr.tax_id = p.tax_id JOIN stock s ON s.product_id = p.product_id
             WHERE p.product_id = ? AND (? <> 'CASHIER' OR p.is_active = TRUE)`;
      parameters = [id, role];
    }
    const rows = await query(role, sql, parameters);
    if (!rows[0]) throw notFound(`${resource} record not found`);
    return res.json({ data: rows[0] });
  };
}

function create(resource) {
  return async (req, res) => {
    const body = req.validated.body;
    if (resource === "categories") {
      const result = await query(
        "ADMIN",
        "INSERT INTO categories (name) VALUES (?)",
        [body.name],
      );
      return res
        .status(201)
        .json({ data: { id: result.insertId, name: body.name } });
    }
    if (resource === "tax-rates") {
      const result = await query(
        "ADMIN",
        "INSERT INTO tax_rates (name, rate_percent) VALUES (?, ?)",
        [body.name, body.ratePercent],
      );
      return res.status(201).json({ data: { id: result.insertId, ...body } });
    }
    const id = await withActorTransaction(
      "ADMIN",
      req.user.userId,
      async (connection) => {
        const [result] = await connection.execute(
          `INSERT INTO products (sku, name, category_id, tax_id, price, reorder_level, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            body.sku,
            body.name,
            body.categoryId,
            body.taxId,
            body.price,
            body.reorderLevel,
            body.isActive,
          ],
        );
        await connection.execute(
          "INSERT INTO stock (product_id, quantity) VALUES (?, ?)",
          [result.insertId, body.initialStock],
        );
        return result.insertId;
      },
    );
    return res.status(201).json({ data: { id, ...body } });
  };
}

function update(resource) {
  return async (req, res) => {
    const { id } = req.validated.params;
    const body = req.validated.body;
    if (resource === "categories") {
      const current = await query(
        "ADMIN",
        "SELECT name FROM categories WHERE category_id = ?",
        [id],
      );
      if (!current[0]) throw notFound("Category not found");
      await query(
        "ADMIN",
        "UPDATE categories SET name = ? WHERE category_id = ?",
        [body.name ?? current[0].name, id],
      );
    } else if (resource === "tax-rates") {
      const current = await query(
        "ADMIN",
        "SELECT name, rate_percent FROM tax_rates WHERE tax_id = ?",
        [id],
      );
      if (!current[0]) throw notFound("Tax rate not found");
      await query(
        "ADMIN",
        "UPDATE tax_rates SET name = ?, rate_percent = ? WHERE tax_id = ?",
        [
          body.name ?? current[0].name,
          body.ratePercent ?? current[0].rate_percent,
          id,
        ],
      );
    } else {
      await withActorTransaction(
        "ADMIN",
        req.user.userId,
        async (connection) => {
          const [rows] = await connection.execute(
            `SELECT sku, name, category_id, tax_id, price, reorder_level, is_active
           FROM products WHERE product_id = ?`,
            [id],
          );
          if (!rows[0]) throw notFound("Product not found");
          const current = rows[0];
          await connection.execute(
            `UPDATE products SET sku = ?, name = ?, category_id = ?, tax_id = ?, price = ?,
             reorder_level = ?, is_active = ? WHERE product_id = ?`,
            [
              body.sku ?? current.sku,
              body.name ?? current.name,
              body.categoryId ?? current.category_id,
              body.taxId ?? current.tax_id,
              body.price ?? current.price,
              body.reorderLevel ?? current.reorder_level,
              body.isActive ?? current.is_active,
              id,
            ],
          );
        },
      );
    }
    return res.json({ message: `${resource} record updated successfully` });
  };
}

function remove(resource) {
  return async (req, res) => {
    const { id } = req.validated.params;
    if (resource === "products") {
      const existing = await query(
        "ADMIN",
        "SELECT product_id FROM products WHERE product_id = ?",
        [id],
      );
      if (!existing[0]) throw notFound("Product not found");
      await query(
        "ADMIN",
        "UPDATE products SET is_active = FALSE WHERE product_id = ?",
        [id],
      );
    } else {
      const primaryKey = resource === "categories" ? "category_id" : "tax_id";
      const result = await query(
        "ADMIN",
        `DELETE FROM ${resource === "categories" ? "categories" : "tax_rates"} WHERE ${primaryKey} = ?`,
        [id],
      );
      if (!result.affectedRows) throw notFound(`${resource} record not found`);
    }
    return res.json({ message: `${resource} record deleted successfully` });
  };
}

module.exports = { create, getById, list, remove, update };
