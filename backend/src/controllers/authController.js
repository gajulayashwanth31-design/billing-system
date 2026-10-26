const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { query } = require("../config/db");
const { HttpError } = require("../utils/errors");

const dummyPasswordHash = bcrypt.hashSync(
  crypto.randomBytes(32).toString("hex"),
  10,
);

async function login(req, res) {
  const { username, password } = req.validated.body;
  const rows = await query(
    "ADMIN",
    `SELECT u.user_id, u.username, u.password_hash, u.is_active, u.failed_attempts,
            u.locked_until, r.role_name, c.customer_id
     FROM users u
     JOIN roles r ON r.role_id = u.role_id
     LEFT JOIN customers c ON c.user_id = u.user_id
     WHERE u.username = ? LIMIT 1`,
    [username],
  );
  const user = rows[0];
  const passwordMatches = await bcrypt.compare(
    password,
    user?.password_hash || dummyPasswordHash,
  );
  const lockActive =
    user?.locked_until && new Date(user.locked_until).getTime() > Date.now();

  if (user?.locked_until && !lockActive) {
    await query(
      "ADMIN",
      "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?",
      [user.user_id],
    );
    user.failed_attempts = 0;
    user.locked_until = null;
  }

  if (!user || !user.is_active || lockActive || !passwordMatches) {
    if (user && user.is_active && !lockActive) {
      await query(
        "ADMIN",
        `UPDATE users
         SET locked_until = CASE
               WHEN failed_attempts >= 4 THEN DATE_ADD(NOW(), INTERVAL 5 MINUTE)
               ELSE locked_until
             END,
             failed_attempts = failed_attempts + 1
         WHERE user_id = ?`,
        [user.user_id],
      );
    }
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials");
  }

  if (user.role_name === "CUSTOMER" && !user.customer_id) {
    throw new HttpError(
      403,
      "CUSTOMER_ACCOUNT_UNLINKED",
      "Customer account is not linked to a customer profile",
    );
  }

  await query(
    "ADMIN",
    "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?",
    [user.user_id],
  );
  const jwtSecret = process.env.JWT_SECRET;
  const token = jwt.sign(
    {
      userId: user.user_id,
      username: user.username,
      role: user.role_name,
      customerId: user.customer_id,
    },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" },
  );
  return res.json({
    token,
    user: {
      id: user.user_id,
      username: user.username,
      role: user.role_name,
      ...(user.customer_id ? { customerId: user.customer_id } : {}),
    },
  });
}

async function me(req, res) {
  return res.json({
    user: {
      id: req.user.userId,
      username: req.user.username,
      role: req.user.role,
      ...(req.user.customerId ? { customerId: req.user.customerId } : {}),
    },
  });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.validated.body;
  const rows = await query(
    "ADMIN",
    "SELECT password_hash FROM users WHERE user_id = ? AND is_active = TRUE",
    [req.user.userId],
  );
  if (
    !rows[0] ||
    !(await bcrypt.compare(currentPassword, rows[0].password_hash))
  ) {
    throw new HttpError(
      400,
      "CURRENT_PASSWORD_INVALID",
      "Current password is incorrect",
    );
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await query(
    "ADMIN",
    "UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE user_id = ?",
    [passwordHash, req.user.userId],
  );
  return res.json({ message: "Password changed successfully" });
}

module.exports = { changePassword, login, me };
