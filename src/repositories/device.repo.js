const { pool } = require('../config/db');

function getExecutor(executor) {
  return executor || pool;
}

async function getActiveDeviceById(executor, deviceId, options = {}) {
  const runner = getExecutor(executor);
  const suffix = options.forUpdate ? ' FOR UPDATE' : '';
  const sql = `
    SELECT
      d.device_id,
      d.device_code,
      d.device_name,
      d.device_type,
      d.is_active
    FROM devices d
    WHERE d.device_id = ? AND d.is_active = 1
    LIMIT 1${suffix}
  `;

  const [rows] = await runner.execute(sql, [deviceId]);
  return rows[0] || null;
}

async function listActiveDevices(executor) {
  const runner = getExecutor(executor);
  const [rows] = await runner.execute(
    `
      SELECT
        d.device_id,
        d.device_code,
        d.device_name,
        d.device_type
      FROM devices d
      WHERE d.is_active = 1
      ORDER BY d.device_id ASC
    `
  );

  return rows;
}

async function updateDeviceStateFromAck(executor, payload) {
  const runner = getExecutor(executor);
  const { deviceId, state, updatedAt, lastActionId } = payload;

  const [result] = await runner.execute(
    `
      UPDATE device_state
      SET state = ?, updated_at = ?, last_action_id = ?
      WHERE device_id = ?
    `,
    [state, updatedAt, lastActionId, deviceId]
  );

  return result.affectedRows;
}

async function updateDeviceStateFromTelemetry(executor, payload) {
  const runner = getExecutor(executor);
  const { deviceId, state, updatedAt } = payload;

  const [result] = await runner.execute(
    `
      UPDATE device_state
      SET state = ?, updated_at = ?
      WHERE device_id = ?
    `,
    [state, updatedAt, deviceId]
  );

  return result.affectedRows;
}

module.exports = {
  getActiveDeviceById,
  listActiveDevices,
  updateDeviceStateFromAck,
  updateDeviceStateFromTelemetry,
};
