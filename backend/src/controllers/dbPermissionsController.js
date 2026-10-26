const { withRolledBackTransaction } = require("../config/db");
const { HttpError } = require("../utils/errors");

const knownActions = new Set([
  "select_products",
  "update_product_price",
  "delete_product",
  "insert_invoice",
  "select_audit_log",
]);
const permissionErrors = new Set([
  "ER_TABLEACCESS_DENIED_ERROR",
  "ER_COLUMNACCESS_DENIED_ERROR",
  "ER_DBACCESS_DENIED_ERROR",
]);

async function run(req, res) {
  if (process.env.DEMO_MODE !== "true") {
    throw new HttpError(
      404,
      "NOT_FOUND",
      "Database permissions demo is disabled",
    );
  }
  const { role, action } = req.validated.body;
  if (!knownActions.has(action)) {
    throw new HttpError(
      400,
      "INVALID_DEMO_ACTION",
      "Demo action is not supported",
    );
  }
  try {
    const result = await withRolledBackTransaction(role, async (connection) => {
      if (action === "select_products") {
        const [rows] = await connection.execute(
          "SELECT product_id, sku, name FROM products ORDER BY product_id LIMIT 5",
        );
        return rows;
      }
      if (action === "update_product_price") {
        const [updateResult] = await connection.execute(
          "UPDATE products SET price = price + 1 WHERE product_id = 1",
        );
        return { affectedRows: updateResult.affectedRows };
      }
      if (action === "delete_product") {
        let sku;
        if (role === "ADMIN") {
          const [[category]] = await connection.execute(
            "SELECT category_id FROM categories ORDER BY category_id LIMIT 1",
          );
          const [[tax]] = await connection.execute(
            "SELECT tax_id FROM tax_rates ORDER BY tax_id LIMIT 1",
          );
          if (!category || !tax) {
            throw new Error("Seeded category and tax records are required");
          }
          const [insertResult] = await connection.execute(
            `INSERT INTO products (sku, name, category_id, tax_id, price, reorder_level)
             VALUES (CONCAT('PERM-DEMO-', REPLACE(UUID(), '-', '')),
                     'Temporary permissions demo product', ?, ?, 1.00, 0)`,
            [category.category_id, tax.tax_id],
          );
          const [[created]] = await connection.execute(
            "SELECT sku FROM products WHERE product_id = ?",
            [insertResult.insertId],
          );
          sku = created.sku;
          const [deleteResult] = await connection.execute(
            "DELETE FROM products WHERE sku = ?",
            [sku],
          );
          return { affectedRows: deleteResult.affectedRows, temporarySku: sku };
        }
        const [deleteResult] = await connection.execute(
          "DELETE FROM products WHERE product_id = 1",
        );
        return { affectedRows: deleteResult.affectedRows };
      }
      if (action === "insert_invoice") {
        const [[customer]] = await connection.execute(
          "SELECT customer_id FROM customers ORDER BY customer_id LIMIT 1",
        );
        const [[cashier]] = await connection.execute(
          `SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
           WHERE r.role_name = 'CASHIER' ORDER BY u.user_id LIMIT 1`,
        );
        if (!customer || !cashier) {
          throw new Error("Seeded customer and cashier records are required");
        }
        const [insertResult] = await connection.execute(
          `INSERT INTO invoices (invoice_no, customer_id, cashier_id, status)
           VALUES (CONCAT('PERM-DEMO-', REPLACE(UUID(), '-', '')), ?, ?, 'DRAFT')`,
          [customer.customer_id, cashier.user_id],
        );
        return { insertedId: insertResult.insertId };
      }
      const [rows] = await connection.execute(
        "SELECT log_id, table_name, action FROM audit_log ORDER BY log_id DESC LIMIT 5",
      );
      return rows;
    });
    return res.json({
      data: { role, action, allowed: true, result, rolledBack: true },
    });
  } catch (error) {
    if (
      !permissionErrors.has(error.code) &&
      !/command denied/i.test(error.message || "")
    ) {
      throw error;
    }
    return res.json({
      data: {
        role,
        action,
        allowed: false,
        error: error.message,
        rolledBack: true,
      },
    });
  }
}

module.exports = { run };
