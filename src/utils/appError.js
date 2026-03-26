class AppError extends Error {
  constructor(statusCode, code, message, data) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.data = data;
  }
}

module.exports = AppError;
