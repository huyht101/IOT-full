const deviceUsageService = require('../services/deviceUsage.service');
const { sendSuccess } = require('../utils/apiResponse');
const { parseDeviceUsageQuery } = require('../utils/validation');

async function getDeviceUsage(req, res, next) {
  try {
    const filters = parseDeviceUsageQuery(req.query);
    const data = await deviceUsageService.getDeviceUsage(filters);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDeviceUsage,
};
