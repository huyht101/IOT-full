function toIsoString(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(normalized);

  return hasTimezone ? normalized : `${normalized}Z`;
}

function toTimestamp(value) {
  const iso = toIsoString(value);
  return iso ? Date.parse(iso) : null;
}

function maxIsoTimestamp(values) {
  let currentMax = null;

  for (const value of values) {
    const ts = toTimestamp(value);
    if (ts === null) {
      continue;
    }

    if (currentMax === null || ts > currentMax) {
      currentMax = ts;
    }
  }

  return currentMax === null ? null : new Date(currentMax).toISOString();
}

module.exports = {
  toIsoString,
  toTimestamp,
  maxIsoTimestamp,
};
