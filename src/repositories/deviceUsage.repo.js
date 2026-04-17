const { pool } = require('../config/db');
const {
  ACTION_STATUSES,
  DEVICE_USAGE_ACTION_FILTERS,
  DEVICE_USAGE_STATUS_FILTERS,
} = require('../constants');

async function listDeviceUsageActions(filters) {
  const clauses = [
    'd.device_code = ?',
    'a.requested_at >= ?',
    'a.requested_at <= ?',
  ];
  const params = [filters.deviceCode, filters.from, filters.to];

  if (filters.action !== DEVICE_USAGE_ACTION_FILTERS.ALL) {
    clauses.push('a.action = ?');
    params.push(filters.action);
  }

  if (filters.status === DEVICE_USAGE_STATUS_FILTERS.ALL) {
    clauses.push('a.status IN (?, ?)');
    params.push(ACTION_STATUSES.SUCCESS, ACTION_STATUSES.FAIL);
  } else if (filters.status === DEVICE_USAGE_STATUS_FILTERS.SUCCESS) {
    clauses.push('a.status = ?');
    params.push(ACTION_STATUSES.SUCCESS);
  } else if (filters.status === DEVICE_USAGE_STATUS_FILTERS.FAIL) {
    clauses.push('a.status = ?');
    params.push(ACTION_STATUSES.FAIL);
  }

  const [rows] = await pool.execute(
    `
      SELECT
        a.action_id,
        a.requested_at
      FROM actions a
      JOIN devices d
        ON d.device_id = a.device_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY a.requested_at ASC, a.action_id ASC
    `,
    params
  );

  return rows;
}

module.exports = {
  listDeviceUsageActions,
};
