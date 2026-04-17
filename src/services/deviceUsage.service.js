const deviceUsageRepo = require('../repositories/deviceUsage.repo');
const { toIsoString } = require('../utils/time');

const DISPLAY_TIME_OFFSET_MS = 7 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function toDisplayDate(value) {
  const iso = toIsoString(value);
  if (!iso) {
    return null;
  }

  return new Date(new Date(iso).getTime() + DISPLAY_TIME_OFFSET_MS);
}

function floorToBucket(displayDate, bucketHours) {
  return new Date(Date.UTC(
    displayDate.getUTCFullYear(),
    displayDate.getUTCMonth(),
    displayDate.getUTCDate(),
    displayDate.getUTCHours() - (displayDate.getUTCHours() % bucketHours),
    0,
    0,
    0
  ));
}

function addBucket(displayDate, bucketHours) {
  return new Date(displayDate.getTime() + bucketHours * HOUR_MS);
}

function formatPart(value) {
  return String(value).padStart(2, '0');
}

function formatDisplayDate(displayDate) {
  return `${displayDate.getUTCFullYear()}-${formatPart(displayDate.getUTCMonth() + 1)}-${formatPart(displayDate.getUTCDate())}`;
}

function formatDisplayTime(displayDate) {
  return `${formatPart(displayDate.getUTCHours())}:${formatPart(displayDate.getUTCMinutes())}`;
}

function buildBucketKey(displayDate) {
  return `${formatDisplayDate(displayDate)} ${formatDisplayTime(displayDate)}`;
}

function buildBucketLabel(bucketStart, bucketHours) {
  const bucketEnd = new Date(bucketStart.getTime() + bucketHours * HOUR_MS - MINUTE_MS);
  const startDate = formatDisplayDate(bucketStart);
  const endDate = formatDisplayDate(bucketEnd);
  const startTime = formatDisplayTime(bucketStart);
  const endTime = formatDisplayTime(bucketEnd);

  if (startDate === endDate) {
    return `${startDate} ${startTime}-${endTime}`;
  }

  return `${startDate} ${startTime} - ${endDate} ${endTime}`;
}

function buildBucketCounts(rows, bucketHours) {
  const counts = new Map();

  rows.forEach((row) => {
    const displayDate = toDisplayDate(row.requested_at);
    if (!displayDate) {
      return;
    }

    const bucketStart = floorToBucket(displayDate, bucketHours);
    const bucketKey = buildBucketKey(bucketStart);

    counts.set(bucketKey, (counts.get(bucketKey) || 0) + 1);
  });

  return counts;
}

function buildBucketItems(filters, counts) {
  const firstBucket = floorToBucket(toDisplayDate(filters.from), filters.bucketHours);
  const lastBucket = floorToBucket(toDisplayDate(filters.to), filters.bucketHours);
  const items = [];

  for (let cursor = firstBucket; cursor.getTime() <= lastBucket.getTime(); cursor = addBucket(cursor, filters.bucketHours)) {
    const bucketKey = buildBucketKey(cursor);

    items.push({
      label: buildBucketLabel(cursor, filters.bucketHours),
      count: counts.get(bucketKey) || 0,
    });
  }

  return items;
}

async function getDeviceUsage(filters) {
  const rows = await deviceUsageRepo.listDeviceUsageActions(filters);
  const counts = buildBucketCounts(rows, filters.bucketHours);

  return {
    device_code: filters.deviceCode,
    action: filters.action,
    status: filters.status,
    from: toIsoString(filters.from),
    to: toIsoString(filters.to),
    bucket: filters.bucket,
    items: buildBucketItems(filters, counts),
  };
}

module.exports = {
  getDeviceUsage,
};
