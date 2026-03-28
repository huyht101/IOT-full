const { pool } = require('../config/db');
const { ACTION_HISTORY_SORT_MAP, ACTION_STATUSES } = require('../constants');

const DISPLAY_TIME_OFFSET_HOURS = 7;

function getExecutor(executor) {
  return executor || pool;
}

function buildTimeSearchLikeValue(value) {
  return `${String(value).replace(/T/g, ' ')}%`;
}

function buildDisplayTimeSearchExpression(columnName) {
  // Match the fixed UTC+07 display convention used by the frontend.
  return `DATE_FORMAT(DATE_ADD(${columnName}, INTERVAL ${DISPLAY_TIME_OFFSET_HOURS} HOUR), '%Y-%m-%d %H:%i:%s')`;
}

function parseNumericSearchValue(value) {
  if (!/^\d+$/.test(String(value))) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function findPendingActionByDeviceId(executor, deviceId) {
  const runner = getExecutor(executor);
  const [rows] = await runner.execute(
    `
      SELECT
        a.action_id,
        a.device_id,
        a.action,
        a.status,
        a.requested_at,
        a.acked_at
      FROM actions a
      WHERE a.device_id = ? AND a.status = ?
      ORDER BY a.requested_at DESC, a.action_id DESC
      LIMIT 1
    `,
    [deviceId, ACTION_STATUSES.PENDING]
  );

  return rows[0] || null;
}

async function insertAction(executor, payload) {
  const runner = getExecutor(executor);
  const { deviceId, action, status, requestedAt } = payload;

  const [result] = await runner.execute(
    `
      INSERT INTO actions (device_id, action, status, requested_at, acked_at)
      VALUES (?, ?, ?, ?, NULL)
    `,
    [deviceId, action, status, requestedAt]
  );

  return result.insertId;
}

async function updateActionStatusIfPending(executor, payload) {
  const runner = getExecutor(executor);
  const { actionId, status, ackedAt } = payload;

  const [result] = await runner.execute(
    `
      UPDATE actions
      SET status = ?, acked_at = ?
      WHERE action_id = ? AND status = ?
    `,
    [status, ackedAt, actionId, ACTION_STATUSES.PENDING]
  );

  return result.affectedRows;
}

async function getActionDetailById(actionId) {
  const [rows] = await pool.execute(
    `
      SELECT
        a.action_id,
        a.device_id,
        d.device_code,
        d.device_name,
        d.device_type,
        a.action,
        a.status,
        a.requested_at,
        a.acked_at,
        ds.state AS device_state_state,
        ds.updated_at AS device_state_updated_at,
        ds.last_action_id AS device_state_last_action_id
      FROM actions a
      JOIN devices d
        ON d.device_id = a.device_id
      LEFT JOIN device_state ds
        ON ds.device_id = d.device_id
      WHERE a.action_id = ?
      LIMIT 1
    `,
    [actionId]
  );

  return rows[0] || null;
}

function buildActionHistoryWhere(filters) {
  const clauses = [];
  const params = [];

  if (filters.q) {
    const likeValue = `%${filters.q}%`;
    const timeLikeValue = buildTimeSearchLikeValue(filters.q);
    const searchClauses = [
      `${buildDisplayTimeSearchExpression('a.requested_at')} LIKE ?`,
      'd.device_code LIKE ?',
      'd.device_name LIKE ?',
    ];
    const searchParams = [timeLikeValue, likeValue, likeValue];
    const numericSearchValue = parseNumericSearchValue(filters.q);

    if (numericSearchValue !== null) {
      searchClauses.push('a.action_id = ?', 'a.device_id = ?');
      searchParams.push(numericSearchValue, numericSearchValue);
    }

    clauses.push(`(${searchClauses.join(' OR ')})`);
    params.push(...searchParams);
  }

  if (filters.deviceType) {
    clauses.push('d.device_type = ?');
    params.push(filters.deviceType);
  }

  if (filters.status) {
    clauses.push('a.status = ?');
    params.push(filters.status);
  }

  if (filters.deviceCode) {
    clauses.push('d.device_code = ?');
    params.push(filters.deviceCode);
  }

  if (filters.action) {
    clauses.push('a.action = ?');
    params.push(filters.action);
  }

  if (filters.from) {
    clauses.push('a.requested_at >= ?');
    params.push(filters.from);
  }

  if (filters.to) {
    clauses.push('a.requested_at <= ?');
    params.push(filters.to);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

async function countActions(filters) {
  const { whereSql, params } = buildActionHistoryWhere(filters);
  const [rows] = await pool.execute(
    `
      SELECT COUNT(*) AS total_items
      FROM actions a
      JOIN devices d
        ON d.device_id = a.device_id
      ${whereSql}
    `,
    params
  );

  return rows[0] ? rows[0].total_items : 0;
}

async function listActions(filters) {
  const { whereSql, params } = buildActionHistoryWhere(filters);
  const orderBy = ACTION_HISTORY_SORT_MAP[filters.sortBy];
  const direction = filters.sortDir === 'asc' ? 'ASC' : 'DESC';

  // Use text protocol here because the current MySQL setup rejects prepared
  // LIMIT/OFFSET placeholders on this paginated history query path.
  const [rows] = await pool.query(
    `
      SELECT
        a.action_id,
        a.device_id,
        d.device_code,
        d.device_name,
        d.device_type,
        a.action,
        a.status,
        a.requested_at,
        a.acked_at
      FROM actions a
      JOIN devices d
        ON d.device_id = a.device_id
      ${whereSql}
      ORDER BY ${orderBy} ${direction}, a.action_id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, filters.pageSize, filters.offset]
  );

  return rows;
}

module.exports = {
  findPendingActionByDeviceId,
  insertAction,
  updateActionStatusIfPending,
  getActionDetailById,
  countActions,
  listActions,
};
