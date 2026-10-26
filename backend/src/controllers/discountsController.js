const { query } = require("../config/db");
const { HttpError, notFound } = require("../utils/errors");

function toMySqlDateTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

async function list(req, res) {
  const { page, limit, search, sort, direction } = req.validated.query;
  const needle = search ? `%${search}%` : null;
  const rows = await query(
    req.user.role,
    `SELECT discount_id AS id, code, type, value, valid_from, valid_to, min_bill_amount, is_active
     FROM discounts WHERE (? IS NULL OR code LIKE ?)
     ORDER BY ${sort === "value" ? "value" : sort === "valid_from" ? "valid_from" : "code"}
     ${direction === "desc" ? "DESC" : "ASC"} LIMIT ? OFFSET ?`,
    [needle, needle, limit, (page - 1) * limit],
  );
  const countRows = await query(
    req.user.role,
    "SELECT COUNT(*) AS total FROM discounts WHERE (? IS NULL OR code LIKE ?)",
    [needle, needle],
  );
  return res.json({
    data: rows,
    pagination: { page, limit, total: countRows[0].total },
  });
}

async function validateCode(req, res) {
  const { code, billAmount } = req.validated.body;
  const rows = await query(
    req.user.role,
    `SELECT discount_id, type, value, min_bill_amount
     FROM discounts
     WHERE code = ? AND is_active = TRUE AND NOW() BETWEEN valid_from AND valid_to`,
    [code],
  );
  if (!rows[0])
    throw new HttpError(
      422,
      "DISCOUNT_INVALID",
      "Discount code is invalid or expired",
    );
  const discount = rows[0];
  if (billAmount < discount.min_bill_amount) {
    throw new HttpError(
      422,
      "DISCOUNT_MINIMUM_NOT_MET",
      "Invoice does not meet the discount minimum amount",
    );
  }
  const discountAmount =
    Math.round(
      Math.min(
        billAmount,
        discount.type === "PERCENT"
          ? (billAmount * discount.value) / 100
          : discount.value,
      ) * 100,
    ) / 100;
  return res.json({
    valid: true,
    data: { code, type: discount.type, value: discount.value, discountAmount },
  });
}

async function create(req, res) {
  const body = req.validated.body;
  const result = await query(
    "ADMIN",
    `INSERT INTO discounts (code, type, value, valid_from, valid_to, min_bill_amount, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      body.code,
      body.type,
      body.value,
      toMySqlDateTime(body.validFrom),
      toMySqlDateTime(body.validTo),
      body.minBillAmount,
      body.isActive,
    ],
  );
  return res.status(201).json({ data: { id: result.insertId, ...body } });
}

async function getById(req, res) {
  const rows = await query(
    req.user.role,
    `SELECT discount_id AS id, code, type, value, valid_from, valid_to, min_bill_amount, is_active
     FROM discounts WHERE discount_id = ?`,
    [req.validated.params.id],
  );
  if (!rows[0]) throw notFound("Discount not found");
  return res.json({ data: rows[0] });
}

async function update(req, res) {
  const { id } = req.validated.params;
  const currentRows = await query(
    "ADMIN",
    `SELECT code, type, value, valid_from, valid_to, min_bill_amount, is_active
     FROM discounts WHERE discount_id = ?`,
    [id],
  );
  if (!currentRows[0]) throw notFound("Discount not found");
  const current = currentRows[0];
  const body = req.validated.body;
  const next = {
    code: body.code ?? current.code,
    type: body.type ?? current.type,
    value: body.value ?? current.value,
    validFrom: body.validFrom ?? current.valid_from,
    validTo: body.validTo ?? current.valid_to,
    minBillAmount: body.minBillAmount ?? current.min_bill_amount,
    isActive: body.isActive ?? current.is_active,
  };
  if (next.type === "PERCENT" && next.value > 100) {
    throw new HttpError(
      400,
      "INVALID_DISCOUNT_PERCENT",
      "Percent discounts cannot exceed 100",
    );
  }
  if (new Date(next.validTo) <= new Date(next.validFrom)) {
    throw new HttpError(
      400,
      "INVALID_DISCOUNT_DATES",
      "validTo must be after validFrom",
    );
  }
  await query(
    "ADMIN",
    `UPDATE discounts SET code = ?, type = ?, value = ?, valid_from = ?, valid_to = ?,
     min_bill_amount = ?, is_active = ? WHERE discount_id = ?`,
    [
      next.code,
      next.type,
      next.value,
      toMySqlDateTime(next.validFrom),
      toMySqlDateTime(next.validTo),
      next.minBillAmount,
      next.isActive,
      id,
    ],
  );
  return res.json({ data: { id, ...next } });
}

async function remove(req, res) {
  const result = await query(
    "ADMIN",
    "DELETE FROM discounts WHERE discount_id = ?",
    [req.validated.params.id],
  );
  if (!result.affectedRows) throw notFound("Discount not found");
  return res.json({ message: "Discount deleted successfully" });
}

module.exports = { create, getById, list, remove, update, validateCode };
