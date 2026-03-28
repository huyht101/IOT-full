import { CHART_WINDOW_HOURS } from '../constants/app';

function toTimestamp(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function mergeChartPoints(currentPoints = [], newPoints = []) {
  const pointMap = new Map();

  [...currentPoints, ...newPoints].forEach((point) => {
    if (!point?.ts) {
      return;
    }

    pointMap.set(point.ts, point);
  });

  return Array.from(pointMap.values()).sort((left, right) => {
    return (toTimestamp(left.ts) || 0) - (toTimestamp(right.ts) || 0);
  });
}

export function trimChartPoints(points = [], anchorTs) {
  if (!points.length) {
    return [];
  }

  const anchorTime = toTimestamp(anchorTs) ?? toTimestamp(points[points.length - 1]?.ts);
  if (!anchorTime) {
    return points;
  }

  const cutoffTime = anchorTime - CHART_WINDOW_HOURS * 60 * 60 * 1000;

  return points.filter((point) => {
    const pointTime = toTimestamp(point.ts);
    return pointTime !== null && pointTime >= cutoffTime;
  });
}

export function normalizeChartPoints(points = [], anchorTs) {
  return trimChartPoints(mergeChartPoints([], points), anchorTs);
}
