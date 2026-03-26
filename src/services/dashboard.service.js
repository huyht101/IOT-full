const dashboardRepo = require('../repositories/dashboard.repo');
const { DASHBOARD_WINDOW_HOURS } = require('../constants');
const { maxIsoTimestamp, toIsoString } = require('../utils/time');

function buildWindowStart() {
  return new Date(Date.now() - DASHBOARD_WINDOW_HOURS * 60 * 60 * 1000);
}

function mapDevice(row) {
  return {
    device_id: row.device_id,
    device_code: row.device_code,
    device_name: row.device_name,
    device_type: row.device_type,
    state: row.state === null || row.state === undefined ? null : Number(row.state),
    updated_at: toIsoString(row.updated_at),
    last_action_id: row.last_action_id,
  };
}

function mapSensor(row) {
  return {
    sensor_id: row.sensor_id,
    sensor_code: row.sensor_code,
    sensor_name: row.sensor_name,
    sensor_type: row.sensor_type,
    unit: row.unit,
    value_num: row.value_num === null || row.value_num === undefined ? null : Number(row.value_num),
    ts: toIsoString(row.ts),
    updated_at: toIsoString(row.updated_at),
  };
}

function mapChartPoint(row) {
  return {
    ts: toIsoString(row.ts),
    temp: row.temp === null || row.temp === undefined ? null : Number(row.temp),
    hum: row.hum === null || row.hum === undefined ? null : Number(row.hum),
    light: row.light === null || row.light === undefined ? null : Number(row.light),
  };
}

async function getDashboard() {
  const windowStart = buildWindowStart();
  const [deviceRows, sensorRows, chartRows, lastRelevantTs] = await Promise.all([
    dashboardRepo.getCurrentDevices(),
    dashboardRepo.getCurrentSensors(),
    dashboardRepo.getChartPoints({ windowStart }),
    dashboardRepo.getLastRelevantTimestamp(),
  ]);

  return {
    devices: deviceRows.map(mapDevice),
    sensors: sensorRows.map(mapSensor),
    chart_pts: chartRows.map(mapChartPoint),
    last_ts: toIsoString(lastRelevantTs),
  };
}

async function getRealtimeDashboard(since) {
  const windowStart = buildWindowStart();
  const [deviceRows, sensorRows, chartRows, lastRelevantTs] = await Promise.all([
    dashboardRepo.getCurrentDevices(),
    dashboardRepo.getCurrentSensors(),
    dashboardRepo.getChartPoints({ windowStart, since }),
    dashboardRepo.getLastRelevantTimestamp(),
  ]);

  return {
    devices: deviceRows.map(mapDevice),
    sensors: sensorRows.map(mapSensor),
    new_pts: chartRows.map(mapChartPoint),
    new_last_ts: maxIsoTimestamp([since, lastRelevantTs]),
  };
}

module.exports = {
  getDashboard,
  getRealtimeDashboard,
};
