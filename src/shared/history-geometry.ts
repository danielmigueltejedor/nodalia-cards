/** Shared finite SVG geometry and bucketed history sampling for Graph and Entity. */
export interface GraphPoint { x: number; y: number }
export interface HistorySample { ts: number; value: number }
const MAX_SAMPLES = 10000;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export function parseHistoryTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value > 1e12 ? value : value * 1000;
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function validPoints(value: unknown): GraphPoint[] {
  if (!Array.isArray(value)) return [];
  const points: unknown[] = Array.from(value);
  return points.every((point: unknown): point is GraphPoint => isObject(point) && typeof point.x === "number" && Number.isFinite(point.x) && typeof point.y === "number" && Number.isFinite(point.y)) ? points : [];
}

export function buildSmoothPath(value: unknown) {
  const points = validPoints(value);
  const first = points[0];
  if (!first) return "";
  if (points.length === 1) {
    return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
  }

  let path = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] || points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] || p2;
    if (!p0 || !p1 || !p2 || !p3) return "";

    const cp1x = p1.x + ((p2.x - p0.x) / 6);
    const cp1y = p1.y + ((p2.y - p0.y) / 6);
    const cp2x = p2.x - ((p3.x - p1.x) / 6);
    const cp2y = p2.y - ((p3.y - p1.y) / 6);

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

export function buildAreaPath(value: unknown, bottomY: number) {
  const points = validPoints(value);
  if (!Array.isArray(points) || points.length === 0) {
    return "";
  }

  const linePath = buildSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || !Number.isFinite(bottomY)) return "";
  return `${linePath} L ${last.x.toFixed(2)} ${bottomY.toFixed(2)} L ${first.x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
}

export function buildInterpolatedSamples(value: unknown, startMs: number, endMs: number, pointsCount: number, fallbackValue: number | null = null): HistorySample[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs || !Number.isFinite(pointsCount) || pointsCount < 1) return [];
  pointsCount = Math.min(MAX_SAMPLES, Math.floor(pointsCount));
  const events = Array.isArray(value) ? value.filter((event: unknown): event is HistorySample => isObject(event) && typeof event.ts === "number" && Number.isFinite(event.ts) && typeof event.value === "number" && Number.isFinite(event.value)) : [];
  if (!events.length) {
    if (fallbackValue === null || !Number.isFinite(fallbackValue)) {
      return [];
    }

    return Array.from({ length: pointsCount }, (_item, index) => ({
      ts: startMs + (((endMs - startMs) * index) / Math.max(pointsCount - 1, 1)),
      value: fallbackValue,
    }));
  }
  const spanMs = Math.max(endMs - startMs, 1);
  const bucketSize = spanMs / Math.max(pointsCount - 1, 1);
  const buckets = Array.from({ length: pointsCount }, (): number[] => []);

  events.forEach(event => {
    const clampedTs = clamp(event.ts, startMs, endMs);
    const rawIndex = Math.floor((clampedTs - startMs) / Math.max(bucketSize, 1));
    const bucketIndex = clamp(rawIndex, 0, pointsCount - 1);
    buckets[bucketIndex]?.push(event.value);
  });

  let lastValue = fallbackValue !== null && Number.isFinite(fallbackValue)
    ? fallbackValue
    : buckets.flat().find(Number.isFinite);

  return buckets.map((bucket, index) => {
    const sampleTs = startMs + (((endMs - startMs) * index) / Math.max(pointsCount - 1, 1));
    if (bucket.length) {
      lastValue = bucket.reduce((sum, value) => sum + value, 0) / bucket.length;
    }

    return {
      ts: sampleTs,
      value: lastValue !== undefined && Number.isFinite(lastValue) ? lastValue : 0,
    };
  });
}
