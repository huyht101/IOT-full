const AppError = require('../utils/appError');
const { sendError } = require('../utils/apiResponse');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    sendError(res, 400, 'INVALID_JSON', 'Malformed JSON request body');
    return;
  }

  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.data);
    return;
  }

  console.error(err);
  sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
}

module.exports = errorHandler;
