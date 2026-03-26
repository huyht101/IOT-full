const { pool } = require('../config/db');
const { SENSOR_HISTORY_SORT_MAP } = require('../constants');

function getExecutor(executor) {
  return executor || pool;
}

async function listActiveSensors(executor) {
  const runner = getExecutor(executor);
  const [rows] = await runner.execute(
    `
      SELECT
        s.sensor_id,
        s.sensor_code,
        s.sensor_type,
        s.sensor_name,
        s.unit
      FROM sensors s
      WHERE s.is_active = 1
      ORDER BY s.sensor_id ASC
    `
  );

  return rows;
}

async function insertSensorReading(executor, payload) {
  const runner = getExecutor(executor);
  const { sensorId, ts, valueNum } = payload;

  await runner.execute(
    `
      INSERT INTO sensor_readings (sensor_id, ts, value_num)
      VALUES (?, ?, ?)
    `,
    [sensorId, ts, valueNum]
  );
}

async function upsertSensorState(executor, payload) {
  const runner = getExecutor(executor);
  const { sensorId, ts, valueNum, updatedAt } = payload;

  await runner.execute(
    `
      INSERT INTO sensor_state (sensor_id, ts, value_num, updated_at)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        ts = VALUES(ts),
        value_num = VALUES(value_num),
        updated_at = VALUES(updated_at)
    `,
    [sensorId, ts, valueNum, updatedAt]
  );
}

function buildSensorHistoryWhere(filters) {
  const clauses = [];
  const params = [];

  if (filters.q) {
    const likeValue = `%${filters.q}%`;
    clauses.push('(s.sensor_code LIKE ? OR s.sensor_name LIKE ?)');
    params.push(likeValue, likeValue);
  }

  if (filters.sensorType) {
    clauses.push('s.sensor_type = ?');
    params.push(filters.sensorType);
  }

  if (filters.sensorCode) {
    clauses.push('s.sensor_code = ?');
    params.push(filters.sensorCode);
  }

  if (filters.from) {
    clauses.push('sr.ts >= ?');
    params.push(filters.from);
  }

  if (filters.to) {
    clauses.push('sr.ts <= ?');
    params.push(filters.to);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

async function countSensorReadings(filters) {
  const { whereSql, params } = buildSensorHistoryWhere(filters);
  const [rows] = await pool.execute(
    `
      SELECT COUNT(*) AS total_items
      FROM sensor_readings sr
      JOIN sensors s
        ON s.sensor_id = sr.sensor_id
      ${whereSql}
    `,
    params
  );

  return rows[0] ? rows[0].total_items : 0;
}

async function listSensorReadings(filters) {
  const { whereSql, params } = buildSensorHistoryWhere(filters);
  const orderBy = SENSOR_HISTORY_SORT_MAP[filters.sortBy];
  const direction = filters.sortDir === 'asc' ? 'ASC' : 'DESC';

  const [rows] = await pool.execute(
    `
      SELECT
        sr.reading_id,
        sr.sensor_id,
        s.sensor_code,
        s.sensor_type,
        s.sensor_name,
        s.unit,
        sr.ts,
        sr.value_num
      FROM sensor_readings sr
      JOIN sensors s
        ON s.sensor_id = sr.sensor_id
      ${whereSql}
      ORDER BY ${orderBy} ${direction}, sr.reading_id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, filters.pageSize, filters.offset]
  );

  return rows;
}

module.exports = {
  listActiveSensors,
  insertSensorReading,
  upsertSensorState,
  countSensorReadings,
  listSensorReadings,
};
