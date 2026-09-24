// @ts-nocheck -- map geometry, calibration and session helpers stay loosely typed until remaining unknowns are narrowed.
import { VACUUM_MODE_LABELS } from "./advance-vacuum-constants";
import { DEFAULT_CONFIG } from "./advance-vacuum-config";
import {
  deepClone,
  isObject,
  normalizeTextKey,
} from "./advance-vacuum-runtime";

export function listVacuumObjectIds(states = {}) {
  return Object.keys(states || {})
    .filter(id => id.startsWith("vacuum."))
    .map(id => normalizeTextKey(id.split(".").slice(1).join("_")))
    .filter(Boolean);
}

/**
 * Helpers whose ids contain `vacuum.roborock_s8` also match `vacuum.roborock_s8_pro`.
 * Same `device_id` always wins; otherwise the longest matching vacuum object id owns the helper.
 */
export function isHelperRelatedToConfiguredVacuum({
  candidateId,
  searchable = "",
  isSameDevice = false,
  objectId,
  vacuumObjectIds,
}) {
  if (isSameDevice) {
    return true;
  }
  if (!objectId) {
    return false;
  }
  const haystack = `${normalizeTextKey(candidateId)} ${normalizeTextKey(searchable)}`;
  if (!haystack.includes(objectId)) {
    return false;
  }
  const claimedByLongerSibling = (vacuumObjectIds || []).some(siblingId => (
    siblingId
    && siblingId !== objectId
    && siblingId.length > objectId.length
    && siblingId.includes(objectId)
    && haystack.includes(siblingId)
  ));
  return !claimedByLongerSibling;
}

export function getStubEntityId(hass, domains = [], entities = [], entitiesFallback = []) {
  return window.NodaliaUtils.findStubEntityIds(hass, entities, entitiesFallback, domains, 1)[0] || "";
}

export function applyStubEntity(config, hass, domains, entities = [], entitiesFallback = []) {
  const entityId = getStubEntityId(hass, domains, entities, entitiesFallback);
  if (!entityId) {
    return config;
  }

  config.entity = entityId;
  config.name = hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
  return config;
}


export function compactConfig(value) {
  if (Array.isArray(value)) {
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
  }

  if (isObject(value)) {
    const compacted = {};
    Object.entries(value).forEach(([key, item]) => {
      if (window.NodaliaUtils?.isUnsafeConfigPathKey?.(key)) {
        return;
      }
      const cleaned = compactConfig(item);
      const isEmptyObject = isObject(cleaned) && Object.keys(cleaned).length === 0;
      if (cleaned !== undefined && !isEmptyObject) {
        compacted[key] = cleaned;
      }
    });
    return compacted;
  }

  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  return value;
}





export function getByPath(target, path) {
  return path.split(".").reduce((cursor, key) => (
    cursor === undefined || cursor === null ? undefined : cursor[key]
  ), target);
}


export function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}




export function isUnavailableState(state) {
  const key = normalizeTextKey(state?.state);
  return ["unavailable", "unknown", "none"].includes(key);
}

export function parseNumber(value) {
  const numeric = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

export function sanitizeCssValue(value, fallback) {
  const raw = String(value ?? "").trim();
  const safeFallback = String(fallback ?? "").trim();
  if (!raw) {
    return safeFallback;
  }
  if (/[\u0000-\u001f\u007f<>;"'{}]/.test(raw) || raw.includes("/*") || raw.includes("*/")) {
    return safeFallback;
  }
  return raw;
}

export function sanitizeStyleTree(candidate, fallback) {
  if (Array.isArray(fallback)) {
    return deepClone(fallback);
  }
  if (isObject(fallback)) {
    const out = {};
    Object.keys(fallback).forEach(key => {
      const nextCandidate = isObject(candidate) ? candidate[key] : undefined;
      out[key] = sanitizeStyleTree(nextCandidate, fallback[key]);
    });
    return out;
  }
  if (typeof fallback === "string") {
    return sanitizeCssValue(candidate, fallback);
  }
  if (typeof fallback === "number") {
    return Number.isFinite(Number(candidate)) ? Number(candidate) : fallback;
  }
  if (typeof fallback === "boolean") {
    return typeof candidate === "boolean" ? candidate : fallback;
  }
  return candidate === undefined ? deepClone(fallback) : candidate;
}

export function getSafeStyles(styles = DEFAULT_CONFIG.styles) {
  return sanitizeStyleTree(styles, DEFAULT_CONFIG.styles);
}

export function parseInteger(value, fallback = null) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function parsePoint(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  if (isObject(value)) {
    const x = Number(value.x);
    const y = Number(value.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  return null;
}

export function parseZoneRect(value) {
  if (Array.isArray(value)) {
    if (value.length >= 4 && value.slice(0, 4).every(isFiniteScalar)) {
      const [rawX1, rawY1, rawX2, rawY2] = value.slice(0, 4).map(Number);
      if (rawX1 === rawX2 || rawY1 === rawY2) {
        return null;
      }
      return {
        x1: Math.min(rawX1, rawX2),
        y1: Math.min(rawY1, rawY2),
        x2: Math.max(rawX1, rawX2),
        y2: Math.max(rawY1, rawY2),
      };
    }

    if (value.length === 2 && value.every(isPointLike)) {
      const first = parsePoint(value[0]);
      const second = parsePoint(value[1]);
      if (first && second) {
        return {
          x1: Math.min(first.x, second.x),
          y1: Math.min(first.y, second.y),
          x2: Math.max(first.x, second.x),
          y2: Math.max(first.y, second.y),
        };
      }
    }

    return null;
  }

  if (!isObject(value)) {
    return null;
  }

  if (Array.isArray(value.zone)) {
    return parseZoneRect(value.zone);
  }

  if (Array.isArray(value.points)) {
    return parseZoneRect(value.points);
  }

  if (Array.isArray(value.coordinates)) {
    return parseZoneRect(value.coordinates);
  }

  const x1Candidate = value.x1 ?? value.left ?? value.min_x ?? value.start_x ?? value.x0 ?? value.x;
  const y1Candidate = value.y1 ?? value.top ?? value.min_y ?? value.start_y ?? value.y0 ?? value.y;
  let x2Candidate = value.x2 ?? value.right ?? value.max_x ?? value.end_x;
  let y2Candidate = value.y2 ?? value.bottom ?? value.max_y ?? value.end_y;
  const width = parseNumber(value.width ?? value.w);
  const height = parseNumber(value.height ?? value.h);

  if ((x2Candidate === undefined || y2Candidate === undefined) && Number.isFinite(width) && Number.isFinite(height)) {
    x2Candidate = Number(x1Candidate) + width;
    y2Candidate = Number(y1Candidate) + height;
  }

  const rawX1 = Number(x1Candidate);
  const rawY1 = Number(y1Candidate);
  const rawX2 = Number(x2Candidate);
  const rawY2 = Number(y2Candidate);
  if (![rawX1, rawY1, rawX2, rawY2].every(Number.isFinite)) {
    return null;
  }

  if (rawX1 === rawX2 || rawY1 === rawY2) {
    return null;
  }

  return {
    x1: Math.min(rawX1, rawX2),
    y1: Math.min(rawY1, rawY2),
    x2: Math.max(rawX1, rawX2),
    y2: Math.max(rawY1, rawY2),
  };
}

export function appendQueryParam(url, key, value) {
  const rawUrl = String(url || "").trim();
  if (!rawUrl || value === null || value === undefined || value === "") {
    return rawUrl;
  }

  const encodedKey = encodeURIComponent(String(key));
  const encodedValue = encodeURIComponent(String(value));
  const existingPattern = new RegExp(`([?&])${encodedKey}=[^&]*`);
  if (existingPattern.test(rawUrl)) {
    return rawUrl.replace(existingPattern, `$1${encodedKey}=${encodedValue}`);
  }

  return `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}${encodedKey}=${encodedValue}`;
}

/** Map image URL identity without cache-buster (for reuse / crossfade decisions). */
export function stripMapCacheBuster(raw) {
  const s = String(raw || "").trim();
  if (!s) {
    return "";
  }
  try {
    const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "http://localhost";
    const u = new URL(s, origin);
    u.searchParams.delete("nodalia_ts");
    const q = u.searchParams.toString();
    return `${u.pathname}${q ? `?${q}` : ""}${u.hash}`;
  } catch {
    return s;
  }
}

export function parseRectangleLike(value) {
  if (!isObject(value)) {
    return [];
  }

  const hasLegacyBounds = [value.x0, value.y0, value.x1, value.y1].every(item => Number.isFinite(Number(item)));
  const x1 = Number(hasLegacyBounds ? value.x0 : (value.x1 ?? value.left ?? value.min_x ?? value.start_x));
  const y1 = Number(hasLegacyBounds ? value.y0 : (value.y1 ?? value.top ?? value.min_y ?? value.start_y));
  const x2 = Number(hasLegacyBounds ? value.x1 : (value.x2 ?? value.right ?? value.max_x ?? value.end_x));
  const y2 = Number(hasLegacyBounds ? value.y1 : (value.y2 ?? value.bottom ?? value.max_y ?? value.end_y));
  if (![x1, y1, x2, y2].every(Number.isFinite)) {
    return [];
  }

  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

export function parseOutline(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(point => parsePoint(point))
    .filter(Boolean);
}

export function isFiniteScalar(value) {
  return Number.isFinite(Number(value));
}

export function isPointLike(value) {
  return Boolean(parsePoint(value));
}

export function isRectangleOutline(value) {
  return Array.isArray(value) && value.length === 4 && value.every(isFiniteScalar);
}

export function parsePolygon(value) {
  if (isObject(value)) {
    if (Array.isArray(value.points)) {
      return parsePolygon(value.points);
    }
    if (Array.isArray(value.outline)) {
      return parsePolygon(value.outline);
    }
    return parseRectangleLike(value);
  }

  if (!Array.isArray(value)) {
    return [];
  }

  if (isRectangleOutline(value)) {
    const [x1, y1, x2, y2] = value.map(Number);
    return [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ];
  }

  const scalarPolygon = value.every(isFiniteScalar);
  if (scalarPolygon && value.length >= 6 && value.length % 2 === 0) {
    const points = [];
    for (let index = 0; index < value.length; index += 2) {
      points.push({
        x: Number(value[index]),
        y: Number(value[index + 1]),
      });
    }
    return points;
  }

  return value
    .map(point => parsePoint(point))
    .filter(Boolean);
}

export function parseOutlines(value) {
  if (!Array.isArray(value) || !value.length) {
    return [];
  }

  const isSinglePolygon =
    value.every(isPointLike)
    || isRectangleOutline(value)
    || (value.every(isFiniteScalar) && value.length >= 6 && value.length % 2 === 0);

  if (isSinglePolygon) {
    const polygon = parsePolygon(value);
    return polygon.length >= 3 ? [polygon] : [];
  }

  const looksNestedCollection = value.every(item => Array.isArray(item) || isObject(item));

  if (looksNestedCollection) {
    return value
      .map(polygon => parsePolygon(polygon))
      .filter(polygon => polygon.length >= 3);
  }

  const polygon = parsePolygon(value);
  return polygon.length >= 3 ? [polygon] : [];
}

export function flattenPolygons(polygons) {
  return arrayFromMaybe(polygons).flatMap(polygon => arrayFromMaybe(polygon));
}

export function pickShapeSource(...sources) {
  return sources.find(source => {
    if (Array.isArray(source)) {
      return source.length > 0;
    }
    return isObject(source);
  });
}

export function centroid(points) {
  if (!Array.isArray(points) || !points.length) {
    return { x: 0, y: 0 };
  }

  const sum = points.reduce((acc, point) => ({
    x: acc.x + point.x,
    y: acc.y + point.y,
  }), { x: 0, y: 0 });

  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

export function polygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += (current.x * next.y) - (next.x * current.y);
  }

  return Math.abs(area) / 2;
}

export function polygonBounds(points) {
  if (!Array.isArray(points) || !points.length) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      width: 0,
      height: 0,
    };
  }

  const bounds = points.reduce((acc, point) => ({
    minX: Math.min(acc.minX, point.x),
    maxX: Math.max(acc.maxX, point.x),
    minY: Math.min(acc.minY, point.y),
    maxY: Math.max(acc.maxY, point.y),
  }), {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });

  return {
    ...bounds,
    width: Math.max(0, bounds.maxX - bounds.minX),
    height: Math.max(0, bounds.maxY - bounds.minY),
  };
}

export function pointInPolygon(point, polygon) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) {
    return false;
  }

  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const minX = Math.min(currentPoint.x, previousPoint.x);
    const maxX = Math.max(currentPoint.x, previousPoint.x);
    const minY = Math.min(currentPoint.y, previousPoint.y);
    const maxY = Math.max(currentPoint.y, previousPoint.y);
    const crossProduct = ((point.y - currentPoint.y) * (previousPoint.x - currentPoint.x))
      - ((point.x - currentPoint.x) * (previousPoint.y - currentPoint.y));

    if (Math.abs(crossProduct) < 0.001 && point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
      return true;
    }

    const intersects = ((currentPoint.y > point.y) !== (previousPoint.y > point.y))
      && (point.x < (((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / ((previousPoint.y - currentPoint.y) || 1e-9)) + currentPoint.x);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function rectIntersectionArea(firstRect, secondRect) {
  if (!firstRect || !secondRect) {
    return 0;
  }

  const width = Math.max(0, Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left));
  const height = Math.max(0, Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top));
  return width * height;
}

export function arrayFromMaybe(value) {
  return Array.isArray(value) ? value : [];
}

export function encodeSharedSessionList(values = []) {
  return arrayFromMaybe(values)
    .map(item => String(item || "").trim())
    .filter(Boolean)
    .map(item => encodeURIComponent(item))
    .join(",");
}

export function decodeSharedSessionList(value = "") {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      try {
        return decodeURIComponent(item);
      } catch (_error) {
        return item;
      }
    })
    .filter(Boolean);
}

export function encodeSharedSessionZones(zones = []) {
  return arrayFromMaybe(zones)
    .map(zone => parseZoneRect(zone))
    .filter(Boolean)
    .map(zone => `${Math.round(zone.x1)}:${Math.round(zone.y1)}:${Math.round(zone.x2)}:${Math.round(zone.y2)}`)
    .join(";");
}

export function decodeSharedSessionZones(value = "") {
  return String(value || "")
    .split(";")
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => parseZoneRect(item.split(":").map(part => Number(part))))
    .filter(Boolean);
}

export function sortByOrder(items) {
  return [...items].sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}

export function humanizeModeLabel(value, kind = "generic", hass = null, configLang = null) {
  if (window.NodaliaI18n?.translateAdvanceVacuumVacuumMode) {
    const h = hass ?? window.NodaliaI18n?.resolveHass?.(null);
    return window.NodaliaI18n.translateAdvanceVacuumVacuumMode(h, configLang ?? "auto", value, kind);
  }

  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const key = normalizeTextKey(raw);
  if (key === "off" && kind === "suction") {
    return "Off";
  }

  if (VACUUM_MODE_LABELS[key]) {
    return VACUUM_MODE_LABELS[key];
  }

  return raw
    .replaceAll("_", " ")
    .replace(/\bplus\b/gi, "+")
    .replace(/\b\w/g, match => match.toUpperCase());
}

export function humanizeSelectOptionLabel(value, kind = "generic", hass = null, configLang = null) {
  const baseLabel = humanizeModeLabel(value, kind, hass, configLang);
  if (!baseLabel) {
    return "";
  }

  const normalized = baseLabel
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

export function normalizeCustomMenuItems(items) {
  return arrayFromMaybe(items)
    .filter(isObject)
    .map(item => ({
      label: String(item.label || item.name || "").trim(),
      icon: String(item.icon || "mdi:flash").trim(),
      visible_when: String(item.visible_when || "always").trim(),
      tap_action: isObject(item.tap_action) ? deepClone(item.tap_action) : null,
      builtin_action: String(item.builtin_action || "").trim(),
    }))
    .filter(item => item.label && (item.tap_action || item.builtin_action));
}

export function normalizeRoutineItems(items) {
  return sortByOrder(
    arrayFromMaybe(items)
      .map(item => (typeof item === "string" ? { entity: item } : item))
      .filter(item => typeof item === "string" || isObject(item))
      .map(item => ({
        order: Number(item.order || 0),
        label: String(item.label || item.name || "").trim(),
        icon: String(item.icon || "").trim(),
        entity: String(item.entity || item.entity_id || "").trim(),
        service: String(item.service || item.perform_action || "").trim(),
        service_data: isObject(item.service_data) ? deepClone(item.service_data) : {},
        target: isObject(item.target) ? deepClone(item.target) : null,
        visible_when: String(item.visible_when || "always").trim(),
        tap_action: isObject(item.tap_action) ? deepClone(item.tap_action) : null,
      }))
      .filter(item => item.entity || item.service || item.tap_action)
  );
}

export function solveLinearSystem(matrix, vector) {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    let pivotValue = Math.abs(augmented[column][column]);

    for (let row = column + 1; row < size; row += 1) {
      const candidate = Math.abs(augmented[row][column]);
      if (candidate > pivotValue) {
        pivotValue = candidate;
        pivotRow = row;
      }
    }

    if (pivotValue < 1e-10) {
      return null;
    }

    if (pivotRow !== column) {
      const tmp = augmented[column];
      augmented[column] = augmented[pivotRow];
      augmented[pivotRow] = tmp;
    }

    const divisor = augmented[column][column];
    for (let k = column; k <= size; k += 1) {
      augmented[column][k] /= divisor;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }

      const factor = augmented[row][column];
      for (let k = column; k <= size; k += 1) {
        augmented[row][k] -= factor * augmented[column][k];
      }
    }
  }

  return augmented.map(row => row[size]);
}

export function invert3x3(matrix) {
  const [
    a, b, c,
    d, e, f,
    g, h, i,
  ] = matrix;

  const det = (
    a * (e * i - f * h) -
    b * (d * i - f * g) +
    c * (d * h - e * g)
  );

  if (Math.abs(det) < 1e-10) {
    return null;
  }

  const invDet = 1 / det;
  return [
    (e * i - f * h) * invDet,
    (c * h - b * i) * invDet,
    (b * f - c * e) * invDet,
    (f * g - d * i) * invDet,
    (a * i - c * g) * invDet,
    (c * d - a * f) * invDet,
    (d * h - e * g) * invDet,
    (b * g - a * h) * invDet,
    (a * e - b * d) * invDet,
  ];
}

export function applyHomography(matrix, x, y) {
  const denominator = (matrix[6] * x) + (matrix[7] * y) + matrix[8];
  if (Math.abs(denominator) < 1e-10) {
    return { x, y };
  }

  return {
    x: ((matrix[0] * x) + (matrix[1] * y) + matrix[2]) / denominator,
    y: ((matrix[3] * x) + (matrix[4] * y) + matrix[5]) / denominator,
  };
}

export function createAffineMatrix(fromPoints, toPoints) {
  const matrix = [];
  const vector = [];

  for (let index = 0; index < 3; index += 1) {
    const from = fromPoints[index];
    const to = toPoints[index];
    matrix.push([from.x, from.y, 1, 0, 0, 0]);
    matrix.push([0, 0, 0, from.x, from.y, 1]);
    vector.push(to.x);
    vector.push(to.y);
  }

  return solveLinearSystem(matrix, vector);
}

export function applyAffineMatrix(matrix, x, y) {
  return {
    x: (matrix[0] * x) + (matrix[1] * y) + matrix[2],
    y: (matrix[3] * x) + (matrix[4] * y) + matrix[5],
  };
}

export function createHomographyMatrix(fromPoints, toPoints) {
  const matrix = [];
  const vector = [];

  for (let index = 0; index < 4; index += 1) {
    const from = fromPoints[index];
    const to = toPoints[index];
    matrix.push([from.x, from.y, 1, 0, 0, 0, -(to.x * from.x), -(to.x * from.y)]);
    matrix.push([0, 0, 0, from.x, from.y, 1, -(to.y * from.x), -(to.y * from.y)]);
    vector.push(to.x);
    vector.push(to.y);
  }

  const solved = solveLinearSystem(matrix, vector);
  return solved ? [...solved, 1] : null;
}

export class CoordinatesConverter {
  constructor(calibrationPoints) {
    this.calibrated = false;
    this.mode = "";
    this.vacuumToMapMatrix = null;
    this.mapToVacuumMatrix = null;

    const points = arrayFromMaybe(calibrationPoints)
      .map(point => ({
        map: parsePoint(point?.map),
        vacuum: parsePoint(point?.vacuum),
      }))
      .filter(point => point.map && point.vacuum);

    if (points.length === 3) {
      const vacuumPoints = points.map(point => point.vacuum);
      const mapPoints = points.map(point => point.map);
      const forward = createAffineMatrix(vacuumPoints, mapPoints);
      const reverse = createAffineMatrix(mapPoints, vacuumPoints);

      if (forward && reverse) {
        this.calibrated = true;
        this.mode = "affine";
        this.vacuumToMapMatrix = forward;
        this.mapToVacuumMatrix = reverse;
      }
      return;
    }

    if (points.length >= 4) {
      const vacuumPoints = points.slice(0, 4).map(point => point.vacuum);
      const mapPoints = points.slice(0, 4).map(point => point.map);
      const forward = createHomographyMatrix(vacuumPoints, mapPoints);
      const reverse = createHomographyMatrix(mapPoints, vacuumPoints);

      if (forward && reverse) {
        this.calibrated = true;
        this.mode = "projective";
        this.vacuumToMapMatrix = forward;
        this.mapToVacuumMatrix = reverse;
      }
    }
  }

  vacuumToMap(x, y) {
    if (!this.calibrated) {
      return { x, y };
    }

    if (this.mode === "affine") {
      return applyAffineMatrix(this.vacuumToMapMatrix, x, y);
    }

    return applyHomography(this.vacuumToMapMatrix, x, y);
  }

  mapToVacuum(x, y) {
    if (!this.calibrated) {
      return { x, y };
    }

    if (this.mode === "affine") {
      return applyAffineMatrix(this.mapToVacuumMatrix, x, y);
    }

    return applyHomography(this.mapToVacuumMatrix, x, y);
  }
}

export function parseCalibrationPoints(config, hass) {
  const directPoints = arrayFromMaybe(config?.calibration_source?.calibration_points);
  if (directPoints.length) {
    return directPoints;
  }

  const calibrationEntityId = config?.calibration_source?.entity;
  if (calibrationEntityId && hass?.states?.[calibrationEntityId]?.attributes?.calibration_points) {
    return hass.states[calibrationEntityId].attributes.calibration_points;
  }

  if (config?.calibration_source?.camera === true) {
    const mapEntityId = config?.map_source?.camera || config?.map_camera || "";
    return hass?.states?.[mapEntityId]?.attributes?.calibration_points || [];
  }

  return [];
}

export function resolveLegacyMode(config, templateName) {
  return arrayFromMaybe(config?.map_modes).find(mode => normalizeTextKey(mode?.template) === normalizeTextKey(templateName));
}

export function resolveRoomsFromVacuumState(hass, entityId) {
  const vacuumState = entityId ? hass?.states?.[entityId] || null : null;
  const maps = arrayFromMaybe(vacuumState?.attributes?.maps);
  const mapWithRooms = maps.find(map => isObject(map?.rooms) && Object.keys(map.rooms).length > 0);
  if (!mapWithRooms) {
    return [];
  }

  return Object.entries(mapWithRooms.rooms).map(([id, label]) => ({
    id: String(id ?? ""),
    label: String(label || id || "").trim(),
    icon: "mdi:broom",
    outlines: [],
    outline: [],
    iconPoint: null,
    labelPoint: null,
    labelOffsetY: 0,
  })).filter(room => room.id);
}

export function resolveRoomsFromMapState(hass, entityId) {
  const mapState = entityId ? hass?.states?.[entityId] || null : null;
  const rooms = mapState?.attributes?.rooms;
  if (!isObject(rooms) || !Object.keys(rooms).length) {
    return [];
  }

  return Object.entries(rooms).map(([id, room]) => {
    const shapeSource = pickShapeSource(
      room?.outlines,
      room?.outline,
      room?.zones,
      room?.rectangles,
      room?.segments,
      room?.areas,
      room?.polygons,
      room,
    );
    const outlines = Array.isArray(shapeSource)
      ? parseOutlines(shapeSource)
      : (() => {
          const polygon = parsePolygon(shapeSource);
          return polygon.length >= 3 ? [polygon] : [];
        })();
    const outline = flattenPolygons(outlines);
    const centerX = parseNumber(room?.pos_x);
    const centerY = parseNumber(room?.pos_y);
    const fallbackCenter = outline.length ? centroid(outline) : null;

    return {
      id: String(room?.number ?? id ?? ""),
      label: String(room?.name || room?.label || id || "").trim(),
      icon: "mdi:broom",
      outlines,
      outline,
      iconPoint: Number.isFinite(centerX) && Number.isFinite(centerY)
        ? { x: centerX, y: centerY }
        : fallbackCenter,
      labelPoint: Number.isFinite(centerX) && Number.isFinite(centerY)
        ? { x: centerX, y: centerY }
        : fallbackCenter,
      labelOffsetY: 0,
    };
  }).filter(room => room.id);
}

export function resolveRoomSegments(config, hass = null, entityId = "", mapEntityId = "") {
  const directRooms = arrayFromMaybe(config?.room_segments);
  if (directRooms.length) {
    return directRooms.map(room => {
      const outlines = parseOutlines(pickShapeSource(
        room.outlines,
        room.outline,
        room.zones,
        room.rectangles,
        room.segments,
        room.areas,
        room.polygons,
      ));
      return {
        id: String(room.id ?? ""),
        label: room.label || room.name || room?.label?.text || "",
        icon: room.icon || room?.icon?.name || "mdi:broom",
        outlines,
        outline: flattenPolygons(outlines),
        iconPoint: parsePoint(room.iconPoint || room.icon || room.position),
        labelPoint: parsePoint(room.labelPoint || room.label || room.position),
        labelOffsetY: Number(room.labelOffsetY ?? room?.label?.offset_y ?? 0) || 0,
      };
    }).filter(room => room.id && room.outlines.length);
  }

  const segmentMode = resolveLegacyMode(config, "vacuum_clean_segment");
  const legacyRooms = arrayFromMaybe(segmentMode?.predefined_selections).map(selection => {
    const outlines = parseOutlines(pickShapeSource(
      selection?.outlines,
      selection?.outline,
      selection?.zones,
      selection?.rectangles,
      selection?.segments,
      selection?.areas,
      selection?.polygons,
    ));
    return {
      id: String(selection.id ?? ""),
      label: String(selection?.label?.text || selection?.label || selection?.text || selection.id || "").trim(),
      icon: String(selection?.icon?.name || selection?.icon || "mdi:broom").trim(),
      outlines,
      outline: flattenPolygons(outlines),
      iconPoint: parsePoint(selection?.icon),
      labelPoint: parsePoint(selection?.label),
      labelOffsetY: Number(selection?.label?.offset_y ?? 0) || 0,
    };
  }).filter(room => room.id && room.outlines.length);

  if (legacyRooms.length) {
    return legacyRooms;
  }

  const mapRooms = resolveRoomsFromMapState(hass, mapEntityId);
  if (mapRooms.length) {
    return mapRooms;
  }

  return resolveRoomsFromVacuumState(hass, entityId);
}

export function resolveGotoPoints(config) {
  const directPoints = arrayFromMaybe(config?.goto_points);
  if (directPoints.length) {
    return directPoints.map(point => ({
      id: String(point.id || point.label || point.name || ""),
      label: point.label || point.name || point?.label?.text || "",
      icon: point.icon || point?.icon?.name || "mdi:map-marker",
      position: parsePoint(point.position),
    })).filter(point => point.position);
  }

  const gotoMode = resolveLegacyMode(config, "vacuum_goto_predefined");
  return arrayFromMaybe(gotoMode?.predefined_selections).map(point => ({
    id: String(point.id || point?.label?.text || point?.icon?.name || "goto"),
    label: String(point?.label?.text || point?.label || "").trim(),
    icon: String(point?.icon?.name || point?.icon || "mdi:map-marker").trim(),
    position: parsePoint(point.position),
  })).filter(point => point.position);
}

export function resolvePredefinedZones(config) {
  const directZones = arrayFromMaybe(config?.predefined_zones);
  if (directZones.length) {
    return directZones.map(zone => ({
      id: String(zone.id || zone.label || zone.name || ""),
      label: zone.label || zone.name || zone?.label?.text || "",
      icon: zone.icon || zone?.icon?.name || "mdi:vector-rectangle",
      zones: arrayFromMaybe(zone.zones).map(item => arrayFromMaybe(item).map(Number)).filter(item => item.length >= 4),
      position: parsePoint(zone.position || zone.icon || zone.label),
    })).filter(zone => zone.zones.length);
  }

  const zoneMode = resolveLegacyMode(config, "vacuum_clean_zone_predefined");
  return arrayFromMaybe(zoneMode?.predefined_selections).map(zone => ({
    id: String(zone.id || zone?.label?.text || zone?.icon?.name || "zone"),
    label: String(zone?.label?.text || zone?.label || "").trim(),
    icon: String(zone?.icon?.name || zone?.icon || "mdi:vector-rectangle").trim(),
    zones: arrayFromMaybe(zone.zones).map(item => arrayFromMaybe(item).map(Number)).filter(item => item.length >= 4),
    position: parsePoint(zone?.icon || zone?.label),
  })).filter(zone => zone.zones.length);
}

export function resolveHeaderIcons(config) {
  return sortByOrder(arrayFromMaybe(config?.icons)).map((item, index) => ({
    id: String(item.id || item.icon_id || index),
    icon: String(item.icon || "mdi:gesture-tap-button").trim(),
    tooltip: String(item.tooltip || item.label || "").trim(),
    order: Number(item.order || index),
    tap_action: isObject(item.tap_action) ? item.tap_action : {},
  }));
}
