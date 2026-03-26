const toggleService = require('../services/toggle.service');
const AppError = require('../utils/appError');
const { sendError, sendSuccess } = require('../utils/apiResponse');
const { validateTogglePayload } = require('../utils/validation');

function parseDeviceId(rawValue) {
  const deviceId = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(deviceId) || deviceId < 1) {
    throw new AppError(400, 'VALIDATION_ERROR', 'device_id must be a positive integer');
  }

  return deviceId;
}

function mapFailureStatus(reason) {
  switch (reason) {
    case 'PUBLISH_FAILED':
      return 503;
    case 'ACK_TIMEOUT':
      return 504;
    case 'ACK_REJECTED':
      return 502;
    default:
      return 500;
  }
}

async function toggleDevice(req, res, next) {
  try {
    const deviceId = parseDeviceId(req.params.device_id);
    const { action } = validateTogglePayload(req.body);
    const result = await toggleService.toggleDevice({ deviceId, action });

    if (result.success) {
      sendSuccess(res, result.data);
      return;
    }

    sendError(
      res,
      mapFailureStatus(result.reason),
      result.errorCode,
      result.message,
      result.data
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  toggleDevice,
};
