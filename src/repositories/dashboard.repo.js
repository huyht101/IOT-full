const { pool } = require('../config/db');
const { SENSOR_CODES } = require('../constants');

async function getCurrentDevices() {
  const [rows] = await pool.execute(
    `
      SELECT
        d.device_id,
        d.device_code,
        d.device_name,
        d.device_type,
        ds.state,
        ds.updated_at,
        ds.last_action_id
      FROM devices d
      LEFT JOIN device_state ds
        ON ds.device_id = d.device_id
      WHERE d.is_active = 1
      ORDER BY d.device_id ASC
    `
  );

  return rows;
}

async function getCurrentSensors() {
  const [rows] = await pool.execute(
    `
      SELECT
        s.sensor_id,
        s.sensor_code,
        s.sensor_name,
        s.sensor_type,
        s.unit,
        ss.value_num,
        ss.ts,
        ss.updated_at
      FROM sensors s
      LEFT JOIN sensor_state ss
        ON ss.sensor_id = s.sensor_id
      WHERE s.is_active = 1
      ORDER BY s.sensor_id ASC
    `
  );

  return rows;
}

async function getChartPoints(options = {}) {
  const params = [options.windowStart];
  const whereParts = ['s.is_active = 1', 'sr.ts >= ?'];

  if (options.since) {
    whereParts.push('sr.ts > ?');
    params.push(options.since);
  }

  const [rows] = await pool.execute(
    `
      SELECT
        sr.ts,
        MAX(CASE WHEN s.sensor_code = '${SENSOR_CODES.TEMP}' THEN sr.value_num END) AS temp,
        MAX(CASE WHEN s.sensor_code = '${SENSOR_CODES.HUM}' THEN sr.value_num END) AS hum,
        MAX(CASE WHEN s.sensor_code = '${SENSOR_CODES.LIGHT}' THEN sr.value_num END) AS light
      FROM sensor_readings sr
      JOIN sensors s
        ON s.sensor_id = sr.sensor_id
      WHERE ${whereParts.join(' AND ')}
      GROUP BY sr.ts
      ORDER BY sr.ts ASC
    `,
    params
  );

  return rows;
}

async function getLastRelevantTimestamp() {
  const [rows] = await pool.execute(
    `
      SELECT MAX(x.last_ts) AS last_ts
      FROM (
        SELECT MAX(ds.updated_at) AS last_ts
        FROM device_state ds
        JOIN devices d
          ON d.device_id = ds.device_id
        WHERE d.is_active = 1

        UNION ALL

        SELECT MAX(ss.updated_at) AS last_ts
        FROM sensor_state ss
        JOIN sensors s
          ON s.sensor_id = ss.sensor_id
        WHERE s.is_active = 1

        UNION ALL

        SELECT MAX(sr.ts) AS last_ts
        FROM sensor_readings sr
        JOIN sensors s
          ON s.sensor_id = sr.sensor_id
        WHERE s.is_active = 1
      ) AS x
    `
  );

  return rows[0] ? rows[0].last_ts : null;
}

module.exports = {
  getCurrentDevices,
  getCurrentSensors,
  getChartPoints,
  getLastRelevantTimestamp,
};
