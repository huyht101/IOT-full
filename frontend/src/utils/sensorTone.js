const SENSOR_KIND_BY_CODE = {
  TEMP: 'temperature',
  HUM: 'humidity',
  LIGHT: 'light',
};

function getSensorKind(sensor = {}) {
  if (sensor.sensor_type) {
    return sensor.sensor_type;
  }

  return SENSOR_KIND_BY_CODE[sensor.sensor_code] || null;
}

function getBucket(sensorKind, value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'neutral';
  }

  const numericValue = Number(value);

  if (sensorKind === 'temperature') {
    if (numericValue < 25) {
      return 'low';
    }

    if (numericValue <= 30) {
      return 'medium';
    }

    return 'high';
  }

  if (sensorKind === 'humidity') {
    if (numericValue < 50) {
      return 'low';
    }

    if (numericValue <= 80) {
      return 'medium';
    }

    return 'high';
  }

  if (sensorKind === 'light') {
    if (numericValue < 1000) {
      return 'low';
    }

    if (numericValue <= 2500) {
      return 'medium';
    }

    return 'high';
  }

  return 'neutral';
}

const THEME_MAP = {
  temperature: {
    low: 'temperatureLow',
    medium: 'temperatureMedium',
    high: 'temperatureHigh',
  },
  humidity: {
    low: 'humidityLow',
    medium: 'humidityMedium',
    high: 'humidityHigh',
  },
  light: {
    low: 'lightLow',
    medium: 'lightMedium',
    high: 'lightHigh',
  },
};

const STATUS_LABELS = {
  temperature: {
    low: 'Cool',
    medium: 'Normal',
    high: 'Hot',
  },
  humidity: {
    low: 'Dry',
    medium: 'Normal',
    high: 'Humid',
  },
  light: {
    low: 'Dim',
    medium: 'Normal',
    high: 'Bright',
  },
};

export function getSensorTone(sensor) {
  const sensorKind = getSensorKind(sensor);
  const bucket = getBucket(sensorKind, sensor?.value_num);

  if (!sensorKind || bucket === 'neutral') {
    return {
      theme: 'neutral',
      statusLabel: null,
    };
  }

  return {
    theme: THEME_MAP[sensorKind][bucket],
    statusLabel: STATUS_LABELS[sensorKind][bucket],
  };
}
