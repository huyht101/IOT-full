const sensorHistoryService = require('../services/sensorHistory.service');
const { sendSuccess } = require('../utils/apiResponse');
const { parseSensorHistoryQuery } = require('../utils/validation');

async function listSensorReadings(req, res, next) {
  try {
    const filters = parseSensorHistoryQuery(req.query);
    const result = await sensorHistoryService.listSensorReadings(filters);
    sendSuccess(res, result.data, result.meta);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listSensorReadings,
};
