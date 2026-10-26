const { HttpError } = require("../utils/errors");

function validate(schema) {
  return function validateRequest(req, res, next) {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return next(
        new HttpError(
          400,
          "VALIDATION_ERROR",
          "Request validation failed",
          result.error.issues,
        ),
      );
    }

    req.validated = result.data;
    return next();
  };
}

module.exports = validate;
