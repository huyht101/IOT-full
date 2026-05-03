const {
  ACTIONS,
  ACTION_STATUSES,
  ACTION_HISTORY_SORT_MAP,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DEVICE_USAGE_STATUS_FILTERS,
  MAX_PAGE_SIZE,
  MAX_QUERY_LENGTH,
  SENSOR_HISTORY_SORT_MAP,
  VALID_DEVICE_TYPES,
  VALID_SENSOR_CODES,
  VALID_SENSOR_TYPES,
} = require('../constants');
const AppError = require('./appError');
const { toIsoString } = require('./time');

const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?(?:Z|[+-]\d{2}:\d{2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DISPLAY_TIME_OFFSET = '+07:00';

function parsePositiveInteger(value, fallback, fieldName) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be a positive integer`);
  }

  return parsed;
}

function clampPage(page) {
  return Math.max(DEFAULT_PAGE, page);
}

function clampPageSize(pageSize) {
  return Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
}

function sanitizeSearchQuery(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > MAX_QUERY_LENGTH) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `q must be ${MAX_QUERY_LENGTH} characters or fewer`
    );
  }

  return trimmed;
}

function normalizeDatetimeInput(value) {
  const normalized = value.replace(' ', 'T');
  const hasTime = normalized.includes('T');
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(normalized);

  if (!hasTime) {
    return `${normalized}T00:00:00.000Z`;
  }

  if (!hasTimezone) {
    return `${normalized}Z`;
  }

  return normalized;
}

function parseDatetime(value, fieldName, options = {}) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const rawValue = String(value).trim();
  if (!rawValue) {
    return null;
  }

  if (!DATETIME_PATTERN.test(rawValue)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${fieldName} must be a valid datetime string`
    );
  }

  const parsed = new Date(normalizeDatetimeInput(rawValue));
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be a valid datetime`);
  }

  if (options.rejectFuture && parsed.getTime() > Date.now()) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} cannot be in the future`);
  }

  return parsed;
}

function parseDisplayDate(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const rawValue = String(value).trim();
  if (!rawValue) {
    return null;
  }

  if (!DATE_PATTERN.test(rawValue)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${fieldName} must be a valid date string in YYYY-MM-DD format`
    );
  }

  const parsed = new Date(`${rawValue}T00:00:00${DISPLAY_TIME_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be a valid date`);
  }

  return rawValue;
}

function validateDateRange(fromDate, toDate) {
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'from must be earlier than or equal to to');
  }
}

function normalizeSortDir(value) {
  if (!value) {
    return 'desc';
  }

  const normalized = String(value).toLowerCase();
  if (normalized !== 'asc' && normalized !== 'desc') {
    throw new AppError(400, 'VALIDATION_ERROR', 'sort_dir must be asc or desc');
  }

  return normalized;
}

function validateAllowedValue(value, allowedValues, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = String(value).trim();
  if (!allowedValues.includes(normalized)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} is not allowed`);
  }

  return normalized;
}

function validateTogglePayload(body) {
  const action = body && body.action;

  if (action !== ACTIONS.ON && action !== ACTIONS.OFF) {
    throw new AppError(400, 'VALIDATION_ERROR', 'action must be exactly "on" or "off"');
  }

  return { action };
}

function validateRealtimeSince(query) {
  const since = parseDatetime(query.since, 'since', { rejectFuture: true });
  if (!since) {
    throw new AppError(400, 'VALIDATION_ERROR', 'since is required');
  }

  return since;
}

function parseActionHistoryQuery(query) {
  const page = clampPage(parsePositiveInteger(query.page, DEFAULT_PAGE, 'page'));
  const pageSize = clampPageSize(
    parsePositiveInteger(query.page_size, DEFAULT_PAGE_SIZE, 'page_size')
  );
  const q = sanitizeSearchQuery(query.q);
  const from = parseDatetime(query.from, 'from');
  const to = parseDatetime(query.to, 'to');

  validateDateRange(from, to);

  const sortBy = query.sort_by && String(query.sort_by).trim()
    ? String(query.sort_by).trim()
    : 'requested_at';

  if (!Object.prototype.hasOwnProperty.call(ACTION_HISTORY_SORT_MAP, sortBy)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'sort_by is not allowed');
  }

  const status = validateAllowedValue(
    query.status,
    Object.values(ACTION_STATUSES),
    'status'
  );
  const deviceType = validateAllowedValue(query.device_type, VALID_DEVICE_TYPES, 'device_type');
  const action = validateAllowedValue(query.action, Object.values(ACTIONS), 'action');
  const deviceCode = query.device_code ? String(query.device_code).trim().toUpperCase() : null;
  const sortDir = normalizeSortDir(query.sort_dir);

  if (deviceCode && deviceCode.length > 20) {
    throw new AppError(400, 'VALIDATION_ERROR', 'device_code must be 20 characters or fewer');
  }

  return {
    page,
    pageSize,
    q,
    deviceType,
    status,
    deviceCode,
    action,
    from,
    to,
    sortBy,
    sortDir,
    offset: (page - 1) * pageSize,
  };
}

function parseSensorHistoryQuery(query) {
  const page = clampPage(parsePositiveInteger(query.page, DEFAULT_PAGE, 'page'));
  const pageSize = clampPageSize(
    parsePositiveInteger(query.page_size, DEFAULT_PAGE_SIZE, 'page_size')
  );
  const q = sanitizeSearchQuery(query.q);
  const value = sanitizeSearchQuery(query.value);
  const from = parseDatetime(query.from, 'from');
  const to = parseDatetime(query.to, 'to');

  validateDateRange(from, to);

  const sortBy = query.sort_by && String(query.sort_by).trim()
    ? String(query.sort_by).trim()
    : 'reading_id';

  if (!Object.prototype.hasOwnProperty.call(SENSOR_HISTORY_SORT_MAP, sortBy)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'sort_by is not allowed');
  }

  const sensorType = validateAllowedValue(query.sensor_type, VALID_SENSOR_TYPES, 'sensor_type');
  const sensorCode = validateAllowedValue(
    query.sensor_code,
    VALID_SENSOR_CODES,
    'sensor_code'
  );
  const sortDir = normalizeSortDir(query.sort_dir);

  return {
    page,
    pageSize,
    q,
    value,
    sensorType,
    sensorCode,
    from,
    to,
    sortBy,
    sortDir,
    offset: (page - 1) * pageSize,
  };
}

function parseDeviceUsageQuery(query) {
  const date = parseDisplayDate(query.date, 'date');
  if (!date) {
    throw new AppError(400, 'VALIDATION_ERROR', 'date is required');
  }

  const status = validateAllowedValue(
    query.status,
    Object.values(DEVICE_USAGE_STATUS_FILTERS),
    'status'
  ) || DEVICE_USAGE_STATUS_FILTERS.SUCCESS;

  const from = new Date(`${date}T00:00:00${DISPLAY_TIME_OFFSET}`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);

  return {
    date,
    status,
    from,
    to,
    statusDb: status === DEVICE_USAGE_STATUS_FILTERS.SUCCESS
      ? ACTION_STATUSES.SUCCESS
      : ACTION_STATUSES.FAIL,
  };
}

function buildPaginationMeta(filters, totalItems) {
  return {
    page: filters.page,
    page_size: filters.pageSize,
    total_items: totalItems,
    total_pages: totalItems === 0 ? 0 : Math.ceil(totalItems / filters.pageSize),
    sort_by: filters.sortBy,
    sort_dir: filters.sortDir,
  };
}

function stringifyDateFilter(value) {
  return value ? toIsoString(value) : null;
}

module.exports = {
  validateTogglePayload,
  validateRealtimeSince,
  parseActionHistoryQuery,
  parseSensorHistoryQuery,
  parseDeviceUsageQuery,
  buildPaginationMeta,
  stringifyDateFilter,
};
