const sensorRepo = require('../repositories/sensor.repo');
const { buildPaginationMeta } = require('../utils/validation');
const { toIsoString } = require('../utils/time');

function mapSensorReadingItem(row) {
  return {
    reading_id: row.reading_id,
    sensor_id: row.sensor_id,
    sensor_code: row.sensor_code,
    sensor_type: row.sensor_type,
    sensor_name: row.sensor_name,
    unit: row.unit,
    ts: toIsoString(row.ts),
    value_num: Number(row.value_num),
  };
}

async function listSensorReadings(filters) {
  const [items, totalItems] = await Promise.all([
    sensorRepo.listSensorReadings(filters),
    sensorRepo.countSensorReadings(filters),
  ]);

  return {
    data: {
      items: items.map(mapSensorReadingItem),
    },
    meta: buildPaginationMeta(filters, totalItems),
  };
}

module.exports = {
  listSensorReadings,
};
