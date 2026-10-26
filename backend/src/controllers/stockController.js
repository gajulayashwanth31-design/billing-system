const { query, withActorTransaction } = require("../config/db");
const { notFound } = require("../utils/errors");

async function list(req, res) {
  const { page, limit, search, sort, direction } = req.validated.query;
  const needle = search ? `%${search}%` : null;
  const rows = await query(
    "ADMIN",
    `SELECT p.product_id AS productId, p.sku, p.name, p.reorder_level AS reorderLevel,
            s.quantity, s.updated_at AS updatedAt
     FROM stock s JOIN products p ON p.product_id = s.product_id
     WHERE (? IS NULL OR p.name LIKE ? OR p.sku LIKE ?)
     ORDER BY ${sort === "quantity" ? "s.quantity" : sort === "sku" ? "p.sku" : "p.name"}
     ${direction === "desc" ? "DESC" : "ASC"} LIMIT ? OFFSET ?`,
    [needle, needle, needle, limit, (page - 1) * limit],
  );
  const countRows = await query(
    "ADMIN",
    `SELECT COUNT(*) AS total FROM stock s JOIN products p ON p.product_id = s.product_id
     WHERE (? IS NULL OR p.name LIKE ? OR p.sku LIKE ?)`,
    [needle, needle, needle],
  );
  return res.json({
    data: rows,
    pagination: { page, limit, total: countRows[0].total },
  });
}

async function adjust(req, res) {
  const { productId } = req.validated.params;
  const { quantity } = req.validated.body;
  await withActorTransaction("ADMIN", req.user.userId, async (connection) => {
    const [rows] = await connection.execute(
      "SELECT product_id FROM stock WHERE product_id = ? FOR UPDATE",
      [productId],
    );
    if (!rows[0]) throw notFound("Product stock record not found");
    await connection.execute(
      "UPDATE stock SET quantity = ? WHERE product_id = ?",
      [quantity, productId],
    );
  });
  return res.json({
    data: { productId, quantity },
    message: "Stock adjusted successfully",
  });
}

module.exports = { adjust, list };
