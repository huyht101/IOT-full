const { pool } = require('../config/db');
const { ACTIONS } = require('../constants');

async function listDailyDeviceUsage(filters) {
  const [rows] = await pool.execute(
    `
      SELECT
        d.device_code,
        d.device_name,
        COALESCE(SUM(CASE WHEN a.action = ? THEN 1 ELSE 0 END), 0) AS on_count,
        COALESCE(SUM(CASE WHEN a.action = ? THEN 1 ELSE 0 END), 0) AS off_count
      FROM devices d
      LEFT JOIN actions a
        ON a.device_id = d.device_id
       AND a.status = ?
       AND a.requested_at >= ?
       AND a.requested_at < ?
      WHERE d.is_active = 1
      GROUP BY d.device_id, d.device_code, d.device_name
      ORDER BY d.device_id ASC
    `,
    [ACTIONS.ON, ACTIONS.OFF, filters.statusDb, filters.from, filters.to]
  );

  return rows;
}

module.exports = {
  listDailyDeviceUsage,
};
