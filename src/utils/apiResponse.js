function success(data, meta) {
  const payload = { ok: true, data };

  if (meta) {
    payload.meta = meta;
  }

  return payload;
}

function error(code, message, data) {
  const payload = {
    ok: false,
    error: {
      code,
      message,
    },
  };

  if (data !== undefined) {
    payload.data = data;
  }

  return payload;
}

function sendSuccess(res, data, meta, statusCode = 200) {
  return res.status(statusCode).json(success(data, meta));
}

function sendError(res, statusCode, code, message, data) {
  return res.status(statusCode).json(error(code, message, data));
}

module.exports = {
  success,
  error,
  sendSuccess,
  sendError,
};
