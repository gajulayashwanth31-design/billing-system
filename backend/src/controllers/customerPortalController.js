const { query } = require("../config/db");
const { invoiceDetail } = require("./invoicesController");
const { notFound } = require("../utils/errors");

async function profile(req, res) {
  const rows = await query(
    "CUSTOMER",
    `SELECT customer_id AS id, name, phone, email, address, whatsapp_opt_in AS whatsappOptIn, created_at AS createdAt
     FROM customers WHERE customer_id = ?`,
    [req.user.customerId],
  );
  if (!rows[0]) throw notFound("Customer profile not found");
  return res.json({ data: rows[0] });
}

async function updateProfile(req, res) {
  const { phone, address } = req.validated.body;
  const current = await query(
    "CUSTOMER",
    "SELECT phone, address FROM customers WHERE customer_id = ?",
    [req.user.customerId],
  );
  if (!current[0]) throw notFound("Customer profile not found");
  const nextPhone = phone ?? current[0].phone;
  const nextAddress = address === undefined ? current[0].address : address;
  await query(
    "CUSTOMER",
    "UPDATE customers SET phone = ?, address = ? WHERE customer_id = ?",
    [nextPhone, nextAddress, req.user.customerId],
  );
  return res.json({ data: { phone: nextPhone, address: nextAddress } });
}

async function invoices(req, res) {
  const { page, limit, status } = req.validated.query;
  const statusFilter = status ? "AND i.status = ?" : "";
  const params = status
    ? [req.user.customerId, status, limit, (page - 1) * limit]
    : [req.user.customerId, limit, (page - 1) * limit];
  const rows = await query(
    "CUSTOMER",
    `SELECT i.invoice_id AS id, i.invoice_no AS invoiceNo, i.status, i.created_at AS createdAt,
            t.grand_total AS grandTotal, t.paid_amount AS paidAmount, t.balance
     FROM invoices i JOIN v_invoice_totals t ON t.invoice_id = i.invoice_id
     WHERE i.customer_id = ? ${statusFilter}
     ORDER BY i.created_at DESC, i.invoice_id DESC LIMIT ? OFFSET ?`,
    params,
  );
  const countParams = status
    ? [req.user.customerId, status]
    : [req.user.customerId];
  const countRows = await query(
    "CUSTOMER",
    `SELECT COUNT(*) AS total FROM invoices i
     WHERE i.customer_id = ? ${statusFilter}`,
    countParams,
  );
  return res.json({
    data: rows,
    pagination: { page, limit, total: countRows[0].total },
  });
}

async function invoiceById(req, res) {
  const invoice = await invoiceDetail(
    "CUSTOMER",
    req.validated.params.id,
    req.user,
  );
  return res.json({ data: invoice });
}

async function loyalty(req, res) {
  const [points, tiers] = await Promise.all([
    query(
      "CUSTOMER",
      "SELECT COALESCE(SUM(points), 0) AS points FROM loyalty_transactions WHERE customer_id = ?",
      [req.user.customerId],
    ),
    query(
      "CUSTOMER",
      "SELECT lifetime_spend, tier FROM v_customer_tier WHERE customer_id = ?",
      [req.user.customerId],
    ),
  ]);
  if (!tiers[0]) throw notFound("Customer profile not found");
  return res.json({
    data: {
      points: points[0].points,
      lifetimeSpend: tiers[0].lifetime_spend,
      tier: tiers[0].tier,
    },
  });
}

module.exports = { invoiceById, invoices, loyalty, profile, updateProfile };
