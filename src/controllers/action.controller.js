const actionHistoryService = require('../services/actionHistory.service');
const { sendSuccess } = require('../utils/apiResponse');
const { parseActionHistoryQuery } = require('../utils/validation');

async function listActions(req, res, next) {
  try {
    const filters = parseActionHistoryQuery(req.query);
    const result = await actionHistoryService.listActions(filters);
    sendSuccess(res, result.data, result.meta);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listActions,
};
