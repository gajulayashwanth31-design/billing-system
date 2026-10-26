const bcrypt = require("bcrypt");
const { query, withTransaction } = require("../config/db");
const { HttpError, notFound } = require("../utils/errors");

async function list(req, res) {
  const { page, limit, search, sort } = req.validated.query;
  const offset = (page - 1) * limit;
  const orderBy = sort === "created_at" ? "u.created_at" : "u.username";
  const direction = req.validated.query.direction === "desc" ? "DESC" : "ASC";
  const needle = search ? `%${search}%` : null;
  const rows = await query(
    "ADMIN",
    `SELECT u.user_id AS id, u.username, r.role_name AS role, u.is_active, u.failed_attempts,
            u.locked_until, u.created_at, c.customer_id AS customer_id
     FROM users u
     JOIN roles r ON r.role_id = u.role_id
     LEFT JOIN customers c ON c.user_id = u.user_id
     WHERE (? IS NULL OR u.username LIKE ? OR r.role_name LIKE ?)
     ORDER BY ${orderBy} ${direction}
     LIMIT ? OFFSET ?`,
    [needle, needle, needle, limit, offset],
  );
  const countRows = await query(
    "ADMIN",
    `SELECT COUNT(*) AS total FROM users u JOIN roles r ON r.role_id = u.role_id
     WHERE (? IS NULL OR u.username LIKE ? OR r.role_name LIKE ?)`,
    [needle, needle, needle],
  );
  return res.json({
    data: rows,
    pagination: { page, limit, total: countRows[0].total },
  });
}

async function create(req, res) {
  const { username, password, role, customerId } = req.validated.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const id = await withTransaction("ADMIN", async (connection) => {
    const [roleRows] = await connection.execute(
      "SELECT role_id FROM roles WHERE role_name = ?",
      [role],
    );
    if (!roleRows[0])
      throw new HttpError(400, "INVALID_ROLE", "Role does not exist");
    if (role === "CUSTOMER" && !customerId) {
      throw new HttpError(
        400,
        "CUSTOMER_LINK_REQUIRED",
        "A customer profile is required for a CUSTOMER account",
      );
    }
    if (role !== "CUSTOMER" && customerId) {
      throw new HttpError(
        400,
        "CUSTOMER_LINK_NOT_ALLOWED",
        "Only CUSTOMER accounts can be linked to a customer profile",
      );
    }
    const [result] = await connection.execute(
      "INSERT INTO users (username, password_hash, role_id) VALUES (?, ?, ?)",
      [username, passwordHash, roleRows[0].role_id],
    );
    if (customerId) {
      const [customerRows] = await connection.execute(
        "SELECT user_id FROM customers WHERE customer_id = ? FOR UPDATE",
        [customerId],
      );
      if (!customerRows[0]) throw notFound("Customer not found");
      if (customerRows[0].user_id) {
        throw new HttpError(
          409,
          "CUSTOMER_ALREADY_LINKED",
          "Customer already has a login account",
        );
      }
      await connection.execute(
        "UPDATE customers SET user_id = ? WHERE customer_id = ?",
        [result.insertId, customerId],
      );
    }
    return result.insertId;
  });
  return res.status(201).json({
    data: { id, username, role, ...(customerId ? { customerId } : {}) },
  });
}

async function getById(req, res) {
  const rows = await query(
    "ADMIN",
    `SELECT u.user_id AS id, u.username, r.role_name AS role, u.is_active,
            u.failed_attempts, u.locked_until, u.created_at, c.customer_id AS customerId
     FROM users u JOIN roles r ON r.role_id = u.role_id
     LEFT JOIN customers c ON c.user_id = u.user_id
     WHERE u.user_id = ?`,
    [req.validated.params.id],
  );
  if (!rows[0]) throw notFound("User not found");
  return res.json({ data: rows[0] });
}

async function update(req, res) {
  const { id } = req.validated.params;
  const { username, isActive } = req.validated.body;
  if (isActive === false && id === req.user.userId) {
    throw new HttpError(
      400,
      "CANNOT_DEACTIVATE_SELF",
      "You cannot deactivate your own account",
    );
  }
  const existing = await query(
    "ADMIN",
    "SELECT user_id FROM users WHERE user_id = ?",
    [id],
  );
  if (!existing[0]) throw notFound("User not found");
  await query(
    "ADMIN",
    `UPDATE users SET username = COALESCE(?, username), is_active = COALESCE(?, is_active)
     WHERE user_id = ?`,
    [username ?? null, isActive ?? null, id],
  );
  return res.json({ message: "User updated successfully" });
}

async function setActive(req, res, active) {
  const { id } = req.validated.params;
  if (!active && id === req.user.userId) {
    throw new HttpError(
      400,
      "CANNOT_DEACTIVATE_SELF",
      "You cannot deactivate your own account",
    );
  }
  const result = await query(
    "ADMIN",
    "UPDATE users SET is_active = ? WHERE user_id = ?",
    [active, id],
  );
  if (!result.affectedRows) throw notFound("User not found");
  return res.json({ message: active ? "User activated" : "User deactivated" });
}

async function remove(req, res) {
  return setActive(req, res, false);
}

async function resetPassword(req, res) {
  const { id } = req.validated.params;
  const { password } = req.validated.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    "ADMIN",
    "UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE user_id = ?",
    [passwordHash, id],
  );
  if (!result.affectedRows) throw notFound("User not found");
  return res.json({ message: "Password reset successfully" });
}

module.exports = {
  create,
  getById,
  list,
  remove,
  resetPassword,
  setActive,
  update,
};
