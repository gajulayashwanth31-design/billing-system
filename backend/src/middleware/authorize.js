const { HttpError } = require("../utils/errors");

function authorize(...allowedRoles) {
  return function authorizeRole(req, res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(
        new HttpError(
          403,
          "FORBIDDEN",
          "You do not have permission to perform this action",
        ),
      );
    }
    return next();
  };
}

module.exports = authorize;
