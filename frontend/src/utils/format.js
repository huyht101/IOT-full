import { SENSOR_CARD_LABELS, SENSOR_TYPE_LABELS } from '../constants/app';

const DISPLAY_TIME_OFFSET_MS = 7 * 60 * 60 * 1000;
const EMPTY_VALUE = '--';

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDisplayDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(parsed.getTime() + DISPLAY_TIME_OFFSET_MS);
}

export function formatDateTime(value) {
  const parsed = toDisplayDate(value);
  if (!parsed) {
    return EMPTY_VALUE;
  }

  return `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())} ${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}:${pad(parsed.getUTCSeconds())}`;
}

export function formatTimeShort(value) {
  const parsed = toDisplayDate(value);
  if (!parsed) {
    return '';
  }

  return `${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`;
}

export function formatNumber(value, options = {}) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return EMPTY_VALUE;
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
  }).format(Number(value));
}

export function formatMetricValue(value, sensorCode) {
  if (value === null || value === undefined) {
    return EMPTY_VALUE;
  }

  const digits = sensorCode === 'LIGHT' ? 0 : 1;
  return formatNumber(value, {
    minimumFractionDigits: Number(value) % 1 === 0 ? 0 : Math.min(1, digits),
    maximumFractionDigits: digits,
  });
}

export function formatSensorValue(value, unit) {
  if (value === null || value === undefined) {
    return EMPTY_VALUE;
  }

  const formattedValue = formatNumber(value, {
    maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  });

  return unit ? `${formattedValue} ${unit}` : formattedValue;
}

export function formatSensorHistoryValue(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return EMPTY_VALUE;
  }

  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

export function getSensorCardLabel(sensor) {
  if (!sensor) {
    return 'Sensor';
  }

  return SENSOR_CARD_LABELS[sensor.sensor_code] || sensor.sensor_name || sensor.sensor_code;
}

export function getSensorTypeLabel(sensorType) {
  return SENSOR_TYPE_LABELS[sensorType] || sensorType;
}

export function formatActionLabel(action) {
  return action === 'off' ? 'Turn Off' : 'Turn On';
}

export function formatStatusLabel(status) {
  if (status === 'PENDING') {
    return 'Waiting';
  }

  if (status === 'SUCCESS') {
    return 'Success';
  }

  if (status === 'FAIL') {
    return 'Fail';
  }

  return status;
}

export function formatDeviceName(device) {
  if (!device) {
    return 'Unknown Device';
  }

  return device.device_name || device.device_code || 'Unknown Device';
}
