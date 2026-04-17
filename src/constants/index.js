const ACTIONS = Object.freeze({
  ON: 'on',
  OFF: 'off',
});

const ACTION_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAIL: 'FAIL',
});

const DEVICE_TYPES = Object.freeze({
  LED: 'LED',
});

const SENSOR_TYPES = Object.freeze({
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  LIGHT: 'light',
});

const SENSOR_CODES = Object.freeze({
  TEMP: 'TEMP',
  HUM: 'HUM',
  LIGHT: 'LIGHT',
});

const DEMO_DEVICES = Object.freeze([
  { device_code: 'LED1', device_name: 'LED 1', device_type: DEVICE_TYPES.LED },
  { device_code: 'LED2', device_name: 'LED 2', device_type: DEVICE_TYPES.LED },
  { device_code: 'LED3', device_name: 'LED 3', device_type: DEVICE_TYPES.LED },
  { device_code: 'LED4', device_name: 'LED 4', device_type: DEVICE_TYPES.LED },
  { device_code: 'LED5', device_name: 'LED 5', device_type: DEVICE_TYPES.LED },
]);

const DEMO_SENSORS = Object.freeze([
  {
    sensor_code: SENSOR_CODES.TEMP,
    sensor_type: SENSOR_TYPES.TEMPERATURE,
    sensor_name: 'Temperature',
    unit: '°C',
  },
  {
    sensor_code: SENSOR_CODES.HUM,
    sensor_type: SENSOR_TYPES.HUMIDITY,
    sensor_name: 'Humidity',
    unit: '%',
  },
  {
    sensor_code: SENSOR_CODES.LIGHT,
    sensor_type: SENSOR_TYPES.LIGHT,
    sensor_name: 'Light',
    unit: 'raw',
  },
]);

const DASHBOARD_WINDOW_HOURS = 3;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_QUERY_LENGTH = 100;

const ACTION_HISTORY_SORT_MAP = Object.freeze({
  requested_at: 'a.requested_at',
  acked_at: 'a.acked_at',
  device_code: 'd.device_code',
  status: 'a.status',
  action: 'a.action',
});

const SENSOR_HISTORY_SORT_MAP = Object.freeze({
  reading_id: 'sr.reading_id',
  ts: 'sr.ts',
  sensor_code: 's.sensor_code',
  sensor_type: 's.sensor_type',
  value_num: 'sr.value_num',
});

const DEVICE_USAGE_BUCKET_HOURS = Object.freeze({
  '1h': 1,
  '2h': 2,
  '4h': 4,
});

const DEVICE_USAGE_ACTION_FILTERS = Object.freeze({
  ALL: 'all',
  ON: ACTIONS.ON,
  OFF: ACTIONS.OFF,
});

const DEVICE_USAGE_STATUS_FILTERS = Object.freeze({
  ALL: 'all',
  SUCCESS: 'success',
  FAIL: 'fail',
});

const VALID_DEVICE_TYPES = Object.freeze(
  Array.from(new Set(DEMO_DEVICES.map((item) => item.device_type)))
);

const VALID_SENSOR_TYPES = Object.freeze(
  Array.from(new Set(DEMO_SENSORS.map((item) => item.sensor_type)))
);

const VALID_SENSOR_CODES = Object.freeze(
  DEMO_SENSORS.map((item) => item.sensor_code)
);

const VALID_DEVICE_CODES = Object.freeze(
  DEMO_DEVICES.map((item) => item.device_code)
);

module.exports = {
  ACTIONS,
  ACTION_STATUSES,
  DEVICE_TYPES,
  SENSOR_TYPES,
  SENSOR_CODES,
  DEMO_DEVICES,
  DEMO_SENSORS,
  DASHBOARD_WINDOW_HOURS,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_QUERY_LENGTH,
  ACTION_HISTORY_SORT_MAP,
  SENSOR_HISTORY_SORT_MAP,
  DEVICE_USAGE_BUCKET_HOURS,
  DEVICE_USAGE_ACTION_FILTERS,
  DEVICE_USAGE_STATUS_FILTERS,
  VALID_DEVICE_TYPES,
  VALID_SENSOR_TYPES,
  VALID_SENSOR_CODES,
  VALID_DEVICE_CODES,
};
