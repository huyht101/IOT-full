const dashboardService = require('../services/dashboard.service');
const { sendSuccess } = require('../utils/apiResponse');
const { validateRealtimeSince } = require('../utils/validation');

async function getDashboard(req, res, next) {
  try {
    const data = await dashboardService.getDashboard();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function getRealtimeDashboard(req, res, next) {
  try {
    const since = validateRealtimeSince(req.query);
    const data = await dashboardService.getRealtimeDashboard(since);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboard,
  getRealtimeDashboard,
};
