const jwt = require("jsonwebtoken");
const { HttpError } = require("../utils/errors");

function authenticate(req, res, next) {
  const authorization = req.get("authorization");
  const token =
    authorization && authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

  if (!token) {
    return next(new HttpError(401, "UNAUTHORIZED", "Authentication required"));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (
      !payload.userId ||
      !["CUSTOMER", "CASHIER", "ADMIN"].includes(payload.role)
    ) {
      return next(
        new HttpError(401, "INVALID_TOKEN", "Invalid authentication token"),
      );
    }
    req.user = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      customerId: payload.customerId || null,
    };
    return next();
  } catch {
    return next(
      new HttpError(
        401,
        "INVALID_TOKEN",
        "Invalid or expired authentication token",
      ),
    );
  }
}

module.exports = authenticate;
