const { withTransaction } = require('../config/db');
const { SENSOR_CODES } = require('../constants');
const deviceRepo = require('../repositories/device.repo');
const sensorRepo = require('../repositories/sensor.repo');

class TelemetryValidationError extends Error {}

function assertPlainObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TelemetryValidationError('payload must be an object');
  }
}

function normalizeNumber(value, fieldName) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new TelemetryValidationError(`${fieldName} must be a finite number`);
  }

  return numericValue;
}

function normalizeNullableNumber(value, fieldName) {
  if (value === null) {
    return null;
  }

  return normalizeNumber(value, fieldName);
}

function normalizeTelemetryDevices(devices) {
  if (!Array.isArray(devices)) {
    throw new TelemetryValidationError('devices must be an array');
  }

  const result = new Map();

  for (const item of devices) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new TelemetryValidationError('each device snapshot item must be an object');
    }

    const code = String(item.code || '').trim().toUpperCase();
    if (!code) {
      throw new TelemetryValidationError('device snapshot code is required');
    }

    const state = Number(item.state);
    if (state !== 0 && state !== 1) {
      throw new TelemetryValidationError(`device ${code} has invalid state`);
    }

    if (result.has(code)) {
      throw new TelemetryValidationError(`duplicate device snapshot for ${code}`);
    }

    result.set(code, state);
  }

  return result;
}

function parseTelemetryPayload(payload) {
  assertPlainObject(payload);

  const tsMs = Number(payload.ts_ms);
  if (!Number.isFinite(tsMs)) {
    throw new TelemetryValidationError('ts_ms must be a finite number');
  }

  return {
    tsMs,
    temp: normalizeNullableNumber(payload.temp, 'temp'),
    hum: normalizeNullableNumber(payload.hum, 'hum'),
    light: normalizeNumber(payload.light, 'light'),
    devices: normalizeTelemetryDevices(payload.devices),
  };
}

function createDeviceMap(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(String(row.device_code).toUpperCase(), row);
  }
  return map;
}

function createSensorMap(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(String(row.sensor_code).toUpperCase(), row);
  }
  return map;
}

function validateFullSnapshot(normalizedDevices, activeDevices) {
  if (!activeDevices.length) {
    return;
  }

  const activeCodes = activeDevices.map((device) => String(device.device_code).toUpperCase());

  if (normalizedDevices.size !== activeCodes.length) {
    throw new TelemetryValidationError('telemetry devices[] must contain the full active device snapshot');
  }

  for (const code of activeCodes) {
    if (!normalizedDevices.has(code)) {
      throw new TelemetryValidationError(`telemetry devices[] is missing ${code}`);
    }
  }
}

function buildSensorUpdates(parsedPayload, sensorMap) {
  const updates = [];
  const tempSensor = sensorMap.get(SENSOR_CODES.TEMP);
  const humSensor = sensorMap.get(SENSOR_CODES.HUM);
  const lightSensor = sensorMap.get(SENSOR_CODES.LIGHT);

  if (!lightSensor) {
    throw new Error('Active LIGHT sensor is missing from the database');
  }

  if (parsedPayload.temp !== null) {
    if (!tempSensor) {
      throw new Error('Active TEMP sensor is missing from the database');
    }

    updates.push({
      sensorId: tempSensor.sensor_id,
      valueNum: parsedPayload.temp,
    });
  }

  if (parsedPayload.hum !== null) {
    if (!humSensor) {
      throw new Error('Active HUM sensor is missing from the database');
    }

    updates.push({
      sensorId: humSensor.sensor_id,
      valueNum: parsedPayload.hum,
    });
  }

  updates.push({
    sensorId: lightSensor.sensor_id,
    valueNum: parsedPayload.light,
  });

  return updates;
}

function buildDeviceUpdates(parsedPayload, deviceMap) {
  const updates = [];

  for (const [deviceCode, state] of parsedPayload.devices.entries()) {
    const device = deviceMap.get(deviceCode);
    if (!device) {
      throw new TelemetryValidationError(`telemetry contains unknown active device code ${deviceCode}`);
    }

    updates.push({
      deviceId: device.device_id,
      state,
    });
  }

  return updates;
}

async function handleTelemetryPayload(payload) {
  try {
    const parsedPayload = parseTelemetryPayload(payload);
    const [activeDevices, activeSensors] = await Promise.all([
      deviceRepo.listActiveDevices(),
      sensorRepo.listActiveSensors(),
    ]);

    validateFullSnapshot(parsedPayload.devices, activeDevices);

    const deviceMap = createDeviceMap(activeDevices);
    const sensorMap = createSensorMap(activeSensors);
    const sensorUpdates = buildSensorUpdates(parsedPayload, sensorMap);
    const deviceUpdates = buildDeviceUpdates(parsedPayload, deviceMap);

    await withTransaction(async (connection) => {
      const serverNow = new Date();

      for (const sensorUpdate of sensorUpdates) {
        await sensorRepo.insertSensorReading(connection, {
          sensorId: sensorUpdate.sensorId,
          ts: serverNow,
          valueNum: sensorUpdate.valueNum,
        });

        await sensorRepo.upsertSensorState(connection, {
          sensorId: sensorUpdate.sensorId,
          ts: serverNow,
          valueNum: sensorUpdate.valueNum,
          updatedAt: serverNow,
        });
      }

      for (const deviceUpdate of deviceUpdates) {
        await deviceRepo.updateDeviceStateFromTelemetry(connection, {
          deviceId: deviceUpdate.deviceId,
          state: deviceUpdate.state,
          updatedAt: serverNow,
        });
      }
    });

    return true;
  } catch (error) {
    if (error instanceof TelemetryValidationError) {
      console.warn(`Ignoring telemetry payload: ${error.message}`);
      return false;
    }

    throw error;
  }
}

module.exports = {
  handleTelemetryPayload,
};
