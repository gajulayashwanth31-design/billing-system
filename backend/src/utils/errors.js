class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function notFound(message = "Resource not found") {
  return new HttpError(404, "NOT_FOUND", message);
}

module.exports = { HttpError, notFound };
