const { HttpError } = require("../utils/errors");

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof HttpError) {
    const response = { error: { code: error.code, message: error.message } };
    if (error.details) response.error.details = error.details;
    return res.status(error.status).json(response);
  }

  if (error.sqlState === "45000" || error.code === "ER_SIGNAL_EXCEPTION") {
    return res.status(409).json({
      error: {
        code: "BUSINESS_RULE_VIOLATION",
        message: error.sqlMessage || error.message,
      },
    });
  }

  if (
    error.code === "ER_TABLEACCESS_DENIED_ERROR" ||
    /command denied/i.test(error.message || "")
  ) {
    console.error("Database permission denied:", error.message);
    return res.status(403).json({
      error: {
        code: "DATABASE_PERMISSION_DENIED",
        message: "The database role cannot perform this action",
      },
    });
  }

  if (
    error.code === "ER_DUP_ENTRY" ||
    error.code === "ER_ROW_IS_REFERENCED_2"
  ) {
    return res.status(409).json({
      error: {
        code: "CONFLICT",
        message:
          error.code === "ER_DUP_ENTRY"
            ? "A record with the same unique value already exists"
            : "This record is still in use and cannot be deleted",
      },
    });
  }

  if (
    error.code === "ER_NO_REFERENCED_ROW_2" ||
    error.code === "ER_CHECK_CONSTRAINT_VIOLATED"
  ) {
    return res.status(422).json({
      error: {
        code: "CONSTRAINT_VIOLATION",
        message: "The request conflicts with a database constraint",
      },
    });
  }

  console.error("Unhandled request error:", error);
  const response = {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error.message,
    },
  };
  if (process.env.NODE_ENV !== "production" && error.stack) {
    response.error.details = error.stack;
  }
  return res.status(500).json(response);
}

module.exports = errorHandler;
