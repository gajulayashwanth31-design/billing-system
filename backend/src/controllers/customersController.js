const { query } = require("../config/db");
const { notFound } = require("../utils/errors");

async function list(req, res) {
  const { page, limit, search, sort, direction } = req.validated.query;
  const needle = search ? `%${search}%` : null;
  const orderBy = sort === "created_at" ? "created_at" : "name";
  const rows = await query(
    req.user.role,
    `SELECT customer_id AS id, name, phone, email, address, whatsapp_opt_in, created_at
     FROM customers
     WHERE (? IS NULL OR name LIKE ? OR phone LIKE ? OR email LIKE ?)
     ORDER BY ${orderBy} ${direction === "desc" ? "DESC" : "ASC"}
     LIMIT ? OFFSET ?`,
    [needle, needle, needle, needle, limit, (page - 1) * limit],
  );
  const countRows = await query(
    req.user.role,
    `SELECT COUNT(*) AS total FROM customers
     WHERE (? IS NULL OR name LIKE ? OR phone LIKE ? OR email LIKE ?)`,
    [needle, needle, needle, needle],
  );
  return res.json({
    data: rows,
    pagination: { page, limit, total: countRows[0].total },
  });
}

async function getByPhone(req, res) {
  const rows = await query(
    req.user.role,
    `SELECT c.customer_id AS id, c.name, c.phone, c.email, c.address, c.whatsapp_opt_in,
            tier.tier, tier.lifetime_spend
     FROM customers c LEFT JOIN v_customer_tier tier ON tier.customer_id = c.customer_id
     WHERE c.phone = ?`,
    [req.validated.params.phone],
  );
  if (!rows[0]) throw notFound("Customer not found");
  return res.json({ data: rows[0] });
}

async function create(req, res) {
  const { name, phone, email, address, whatsappOptIn } = req.validated.body;
  const result = await query(
    req.user.role,
    `INSERT INTO customers (name, phone, email, address, whatsapp_opt_in)
     VALUES (?, ?, ?, ?, ?)`,
    [name, phone, email || null, address || null, whatsappOptIn],
  );
  return res.status(201).json({
    data: {
      id: result.insertId,
      name,
      phone,
      email: email || null,
      address: address || null,
      whatsappOptIn,
      tier: "Silver",
      lifetimeSpend: 0,
    },
  });
}

async function update(req, res) {
  const { id } = req.validated.params;
  const existing = await query(
    req.user.role,
    "SELECT customer_id, name, phone, email, address, whatsapp_opt_in FROM customers WHERE customer_id = ?",
    [id],
  );
  if (!existing[0]) throw notFound("Customer not found");
  const current = existing[0];
  const body = req.validated.body;
  const next = {
    name: body.name ?? current.name,
    phone: body.phone ?? current.phone,
    email: body.email === undefined ? current.email : body.email,
    address: body.address === undefined ? current.address : body.address,
    whatsappOptIn: body.whatsappOptIn ?? current.whatsapp_opt_in,
  };
  await query(
    req.user.role,
    `UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, whatsapp_opt_in = ?
     WHERE customer_id = ?`,
    [next.name, next.phone, next.email, next.address, next.whatsappOptIn, id],
  );
  return res.json({ data: { id, ...next } });
}

module.exports = { create, getByPhone, list, update };
