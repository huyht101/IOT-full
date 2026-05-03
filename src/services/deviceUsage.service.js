const deviceUsageRepo = require('../repositories/deviceUsage.repo');

function toCount(value) {
  return Number.parseInt(value, 10) || 0;
}

async function getDeviceUsage(filters) {
  const rows = await deviceUsageRepo.listDailyDeviceUsage(filters);

  return {
    date: filters.date,
    status: filters.status,
    timezone: 'UTC+07',
    items: rows.map((row) => ({
      device_code: row.device_code,
      device_name: row.device_name,
      on_count: toCount(row.on_count),
      off_count: toCount(row.off_count),
    })),
  };
}

module.exports = {
  getDeviceUsage,
};
