import type { HassEntity, HomeAssistant } from "../../core/types/home-assistant";
import { parseFiniteNumericValue } from "../../shared/numeric-values";
import { normalizeControlStyles } from "../../shared/control-config";
import { appendUrlQueryParam } from "../../shared/url-query";
export { compactConfig } from "../../shared/config-values";
export { applyStubEntity, getStubEntityId, parseSizeToPixels } from "../../shared/editor-entity-helpers";

export interface MapPoint { x: number; y: number; }
export interface ZoneRect { x1: number; y1: number; x2: number; y2: number; }
export interface RoomSegment {
  id: string; label: string; icon: string; outlines: MapPoint[][]; outline: MapPoint[];
  iconPoint: MapPoint | null; labelPoint: MapPoint | null; labelOffsetY: number;
}
const record = (value: unknown): Record<string, unknown> => isObject(value) ? value : {};
const finitePoint = (value: MapPoint | null): value is MapPoint => value !== null;
import { VACUUM_MODE_LABELS } from "./advance-vacuum-constants";
import { DEFAULT_CONFIG } from "./advance-vacuum-defaults";
import {
  deepClone,
  isObject,
  normalizeTextKey,
} from "./advance-vacuum-runtime";

export function listVacuumObjectIds(states: unknown = {}) {
  return Object.keys(isObject(states) ? states : {})
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
}: { candidateId: unknown; searchable?: unknown; isSameDevice?: boolean; objectId: string; vacuumObjectIds?: readonly string[] }) {
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

export function getByPath(target: unknown, path: string): unknown {
  if (path.split(".").some(key => window.NodaliaUtils.isUnsafeConfigPathKey(key))) return undefined;
  return path.split(".").reduce<unknown>((cursor, key) => {
    if (Array.isArray(cursor)) return /^\d+$/.test(key) && Object.prototype.hasOwnProperty.call(cursor, key) ? cursor[Number(key)] : undefined;
    return isObject(cursor) && Object.prototype.hasOwnProperty.call(cursor, key) ? cursor[key] : undefined;
  }, target);
}

export function isUnavailableState(state: HassEntity | null | undefined) {
  const key = normalizeTextKey(state?.state);
  return ["unavailable", "unknown", "none"].includes(key);
}

export function parseNumber(value: unknown): number | null {
  return parseFiniteNumericValue(typeof value === "string" ? value.replace(",", ".") : value);
}

export function sanitizeCssValue(value: unknown, fallback: unknown) {
  // Multi-line YAML (> or |) yields line breaks; in CSS they are plain whitespace.
  const raw = String(value ?? "").replace(/[\t\n\f\r]+/g, " ").trim();
  const safeFallback = String(fallback ?? "").trim();
  if (!raw) {
    return safeFallback;
  }
  if ((/[<>;"'{}]/.test(raw) || [...raw].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) || raw.includes("/*") || raw.includes("*/")) {
    return safeFallback;
  }
  // Unclosed functions can consume the rest of an interpolated stylesheet.
  const delimiters:string[]=[];
  for(const character of raw) {
    if(character==="(" || character==="[") delimiters.push(character);
    else if(character===")" || character==="]") {
      if(delimiters.pop()!==(character===")"?"(":"[")) return safeFallback;
    }
  }
  if(delimiters.length) return safeFallback;
  return raw;
}

export function getSafeStyles(styles: unknown = DEFAULT_CONFIG.styles) {
  return normalizeControlStyles(styles, DEFAULT_CONFIG.styles, sanitizeCssValue);
}

export function parseInteger(value: unknown, fallback: number | null = null): number | null {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function parsePoint(value: unknown): MapPoint | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = parseFiniteNumericValue(value[0]);
    const y = parseFiniteNumericValue(value[1]);
    return x !== null && y !== null ? { x, y } : null;
  }

  if (isObject(value)) {
    const x = parseFiniteNumericValue(value.x);
    const y = parseFiniteNumericValue(value.y);
    return x !== null && y !== null ? { x, y } : null;
  }

  return null;
}

export function parseZoneRect(value: unknown): ZoneRect | null {
  if (Array.isArray(value)) {
    if (value.length >= 4 && value.slice(0, 4).every(isFiniteScalar)) {
      const [rawX1, rawY1, rawX2, rawY2] = value.slice(0, 4).map(Number);
      if (rawX1 === undefined || rawY1 === undefined || rawX2 === undefined || rawY2 === undefined) return null;
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

  if ((x2Candidate === undefined || y2Candidate === undefined) && width !== null && height !== null) {
    const startX = parseFiniteNumericValue(x1Candidate), startY = parseFiniteNumericValue(y1Candidate);
    if (startX === null || startY === null) return null;
    x2Candidate = startX + width;
    y2Candidate = startY + height;
  }

  const rawX1 = parseFiniteNumericValue(x1Candidate);
  const rawY1 = parseFiniteNumericValue(y1Candidate);
  const rawX2 = parseFiniteNumericValue(x2Candidate);
  const rawY2 = parseFiniteNumericValue(y2Candidate);
  if (rawX1 === null || rawY1 === null || rawX2 === null || rawY2 === null) {
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

export function appendQueryParam(url: unknown, key: unknown, value: unknown) {
  return appendUrlQueryParam(url, key, value, true);
}

/** Map image URL identity without cache-buster (for reuse / crossfade decisions). */
export function stripMapCacheBuster(raw: unknown) {
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

export function parseRectangleLike(value: unknown): MapPoint[] {
  if (!isObject(value)) {
    return [];
  }

  const hasLegacyBounds = [value.x0, value.y0, value.x1, value.y1].every(isFiniteScalar);
  const x1 = parseFiniteNumericValue(hasLegacyBounds ? value.x0 : (value.x1 ?? value.left ?? value.min_x ?? value.start_x));
  const y1 = parseFiniteNumericValue(hasLegacyBounds ? value.y0 : (value.y1 ?? value.top ?? value.min_y ?? value.start_y));
  const x2 = parseFiniteNumericValue(hasLegacyBounds ? value.x1 : (value.x2 ?? value.right ?? value.max_x ?? value.end_x));
  const y2 = parseFiniteNumericValue(hasLegacyBounds ? value.y1 : (value.y2 ?? value.bottom ?? value.max_y ?? value.end_y));
  if (x1 === null || y1 === null || x2 === null || y2 === null) {
    return [];
  }

  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

export function parseOutline(value: unknown): MapPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(point => parsePoint(point))
    .filter(finitePoint);
}

export function isFiniteScalar(value: unknown) {
  return parseFiniteNumericValue(value) !== null;
}

export function isPointLike(value: unknown) {
  return (!Array.isArray(value) || value.length === 2) && Boolean(parsePoint(value));
}

export function isRectangleOutline(value: unknown) {
  return Array.isArray(value) && value.length === 4 && value.every(isFiniteScalar);
}

export function parsePolygon(value: unknown): MapPoint[] {
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
    if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) return [];
    return [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ];
  }

  const scalarPolygon = Array.from(value).every(isFiniteScalar);
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
    .filter(finitePoint);
}

export function parseOutlines(value: unknown): MapPoint[][] {
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

export function flattenPolygons(polygons: unknown): MapPoint[] {
  return arrayFromMaybe(polygons).flatMap(polygon => parseOutline(polygon));
}

export function pickShapeSource(...sources: unknown[]) {
  return sources.find(source => {
    if (Array.isArray(source)) {
      return source.length > 0;
    }
    return isObject(source);
  });
}

export function centroid(raw: unknown): MapPoint {
  const points = parseOutline(raw);
  if (!Array.isArray(points) || !points.length) {
    return { x: 0, y: 0 };
  }

  const sum = points.reduce((acc, point) => ({
    x: acc.x + point.x,
    y: acc.y + point.y,
  }), { x: 0, y: 0 });

  return Number.isFinite(sum.x) && Number.isFinite(sum.y) ? { x: sum.x / points.length, y: sum.y / points.length } : { x: 0, y: 0 };
}

export function polygonArea(raw: unknown): number {
  const points = parseOutline(raw);
  if (!Array.isArray(points) || points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) return 0;
    area += (current.x * next.y) - (next.x * current.y);
  }

  return Number.isFinite(area) ? Math.abs(area) / 2 : 0;
}

export function polygonBounds(raw: unknown) {
  const points = parseOutline(raw);
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
    width: Number.isFinite(bounds.maxX - bounds.minX) ? Math.max(0, bounds.maxX - bounds.minX) : 0,
    height: Number.isFinite(bounds.maxY - bounds.minY) ? Math.max(0, bounds.maxY - bounds.minY) : 0,
  };
}

export function pointInPolygon(rawPoint: unknown, rawPolygon: unknown): boolean {
  const point = parsePoint(rawPoint);
  const polygon = parseOutline(rawPolygon);
  if (!point || !Array.isArray(polygon) || polygon.length < 3) {
    return false;
  }

  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (!currentPoint || !previousPoint) return false;
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

export function rectIntersectionArea(rawFirst: unknown, rawSecond: unknown): number {
  const firstRect = record(rawFirst), secondRect = record(rawSecond);
  const first = [firstRect.left, firstRect.right, firstRect.top, firstRect.bottom].map(parseFiniteNumericValue);
  const second = [secondRect.left, secondRect.right, secondRect.top, secondRect.bottom].map(parseFiniteNumericValue);
  const [fl, fr, ft, fb] = first, [sl, sr, st, sb] = second;
  if (fl == null || fr == null || ft == null || fb == null || sl == null || sr == null || st == null || sb == null) return 0;
  if (!firstRect || !secondRect) {
    return 0;
  }

  const width = Math.max(0, Math.min(fr, sr) - Math.max(fl, sl));
  const height = Math.max(0, Math.min(fb, sb) - Math.max(ft, st));
  return Number.isFinite(width * height) ? width * height : 0;
}

export function arrayFromMaybe<T>(value:T[]):T[];
export function arrayFromMaybe(value:unknown):unknown[];
export function arrayFromMaybe(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function encodeSharedSessionList(values: unknown = []) {
  return arrayFromMaybe(values)
    .map(item => String(item || "").trim())
    .filter(Boolean)
    .map(item => encodeURIComponent(item))
    .join(",");
}

export function decodeSharedSessionList(value: unknown = "") {
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

export function encodeSharedSessionZones(zones: unknown = []) {
  return arrayFromMaybe(zones)
    .map(zone => parseZoneRect(zone))
    .filter((zone): zone is ZoneRect => zone !== null)
    .map(zone => `${Math.round(zone.x1)}:${Math.round(zone.y1)}:${Math.round(zone.x2)}:${Math.round(zone.y2)}`)
    .join(";");
}

export function decodeSharedSessionZones(value: unknown = "") {
  return String(value || "")
    .split(";")
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => parseZoneRect(item.split(":")))
    .filter(Boolean);
}

export function sortByOrder<T extends { order?: unknown }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => (parseFiniteNumericValue(left.order) ?? 0) - (parseFiniteNumericValue(right.order) ?? 0));
}

export function humanizeModeLabel(value: unknown, kind = "generic", hass: HomeAssistant | null = null, configLang: string | null = null) {
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

  const label = Object.entries(VACUUM_MODE_LABELS).find(([name]) => name === key)?.[1];
  if (label) return label;

  return raw
    .replaceAll("_", " ")
    .replace(/\bplus\b/gi, "+")
    .replace(/\b\w/g, match => match.toUpperCase());
}

export function humanizeSelectOptionLabel(value: unknown, kind = "generic", hass: HomeAssistant | null = null, configLang: string | null = null) {
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

export function normalizeCustomMenuItems(items: unknown) {
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

export function normalizeRoutineItems(items: unknown) {
  return sortByOrder(
    arrayFromMaybe(items)
      .map(item => (typeof item === "string" ? { entity: item } : item))
      .filter(isObject)
      .map(item => ({
        order: parseFiniteNumericValue(item.order) ?? 0,
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

const finiteNumberArray = (value: unknown): value is number[] => Array.isArray(value) && Array.from(value).every((item: unknown) => typeof item === "number" && Number.isFinite(item));

/** Small calibration systems; reject ragged, oversized or nonfinite input. */
export function solveLinearSystem(rawMatrix: unknown, rawVector: unknown): number[] | null {
  if (!Array.isArray(rawMatrix) || !rawMatrix.every(finiteNumberArray) || !finiteNumberArray(rawVector)) return null;
  const size = rawMatrix.length;
  if (!size || size > 64 || rawVector.length !== size || rawMatrix.some(row => row.length !== size)) return null;
  const augmented = rawMatrix.map((row, index) => [...row, rawVector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    const initial = augmented[column]?.[column];
    if (initial === undefined) return null;
    let pivotValue = Math.abs(initial);
    for (let row = column + 1; row < size; row += 1) {
      const value = augmented[row]?.[column];
      if (value === undefined) return null;
      const candidate = Math.abs(value);
      if (candidate > pivotValue) { pivotValue = candidate; pivotRow = row; }
    }
    if (!Number.isFinite(pivotValue) || pivotValue < 1e-10) return null;
    const pivot = augmented[pivotRow], displaced = augmented[column];
    if (!pivot || !displaced) return null;
    if (pivotRow !== column) { augmented[column] = pivot; augmented[pivotRow] = displaced; }
    const divisor = pivot[column];
    if (divisor === undefined) return null;
    for (let k = column; k <= size; k += 1) {
      const value = pivot[k];
      if (value === undefined) return null;
      pivot[k] = value / divisor;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const target = augmented[row];
      const factor = target?.[column];
      if (!target || factor === undefined) return null;
      for (let k = column; k <= size; k += 1) {
        const value = target[k], pivotEntry = pivot[k];
        if (value === undefined || pivotEntry === undefined) return null;
        target[k] = value - factor * pivotEntry;
      }
    }
  }
  const result = augmented.map(row => row[size]);
  return finiteNumberArray(result) ? result : null;
}

export function invert3x3(matrix: unknown): number[] | null {
  if (!finiteNumberArray(matrix) || matrix.length !== 9) return null;
  const [a,b,c,d,e,f,g,h,i] = matrix;
  if (a === undefined || b === undefined || c === undefined || d === undefined || e === undefined || f === undefined || g === undefined || h === undefined || i === undefined) return null;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-10) return null;
  const invDet = 1 / det;
  const result = [
    (e*i-f*h)*invDet, (c*h-b*i)*invDet, (b*f-c*e)*invDet,
    (f*g-d*i)*invDet, (a*i-c*g)*invDet, (c*d-a*f)*invDet,
    (d*h-e*g)*invDet, (b*g-a*h)*invDet, (a*e-b*d)*invDet,
  ];
  return finiteNumberArray(result) ? result : null;
}

export function applyHomography(matrix: unknown, x: number, y: number): MapPoint {
  if (!finiteNumberArray(matrix) || matrix.length !== 9) return {x,y};
  const [a,b,c,d,e,f,g,h,i] = matrix;
  if (a === undefined || b === undefined || c === undefined || d === undefined || e === undefined || f === undefined || g === undefined || h === undefined || i === undefined) return {x,y};
  const denominator = g*x + h*y + i;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-10) return {x,y};
  const result = { x: (a*x+b*y+c)/denominator, y: (d*x+e*y+f)/denominator };
  return Number.isFinite(result.x) && Number.isFinite(result.y) ? result : {x,y};
}

export function createAffineMatrix(rawFrom: unknown, rawTo: unknown): number[] | null {
  const fromPoints = parseOutline(rawFrom), toPoints = parseOutline(rawTo);
  if (!Array.isArray(rawFrom) || !Array.isArray(rawTo) || fromPoints.length !== rawFrom.length || toPoints.length !== rawTo.length) return null;
  const matrix: number[][] = [], vector: number[] = [];
  for (let index = 0; index < 3; index += 1) {
    const from = fromPoints[index], to = toPoints[index];
    if (!from || !to) return null;
    matrix.push([from.x,from.y,1,0,0,0], [0,0,0,from.x,from.y,1]);
    vector.push(to.x,to.y);
  }
  return solveLinearSystem(matrix, vector);
}

export function applyAffineMatrix(matrix: unknown, x: number, y: number): MapPoint {
  if (!finiteNumberArray(matrix) || matrix.length !== 6) return {x,y};
  const [a,b,c,d,e,f] = matrix;
  if (a === undefined || b === undefined || c === undefined || d === undefined || e === undefined || f === undefined) return {x,y};
  const result = {x:a*x+b*y+c,y:d*x+e*y+f};
  return Number.isFinite(result.x) && Number.isFinite(result.y) ? result : {x,y};
}

export function createHomographyMatrix(rawFrom: unknown, rawTo: unknown): number[] | null {
  const fromPoints = parseOutline(rawFrom), toPoints = parseOutline(rawTo);
  if (!Array.isArray(rawFrom) || !Array.isArray(rawTo) || fromPoints.length !== rawFrom.length || toPoints.length !== rawTo.length) return null;
  const matrix: number[][] = [], vector: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const from = fromPoints[index], to = toPoints[index];
    if (!from || !to) return null;
    matrix.push([from.x,from.y,1,0,0,0,-to.x*from.x,-to.x*from.y]);
    matrix.push([0,0,0,from.x,from.y,1,-to.y*from.x,-to.y*from.y]);
    vector.push(to.x,to.y);
  }
  const solved = solveLinearSystem(matrix, vector);
  return solved ? [...solved,1] : null;
}

export class CoordinatesConverter {
  calibrated = false;
  mode: "" | "affine" | "projective" = "";
  vacuumToMapMatrix: number[] | null = null;
  mapToVacuumMatrix: number[] | null = null;
  constructor(calibrationPoints: unknown) {
    this.calibrated = false;
    this.mode = "";
    this.vacuumToMapMatrix = null;
    this.mapToVacuumMatrix = null;

    const points = arrayFromMaybe(calibrationPoints)
      .filter(isObject)
      .map(point => ({
        map: parsePoint(point?.map),
        vacuum: parsePoint(point?.vacuum),
      }))
      .filter((point): point is { map: MapPoint; vacuum: MapPoint } => point.map !== null && point.vacuum !== null);

    if (points.length !== arrayFromMaybe(calibrationPoints).length) return;

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

  vacuumToMap(x: number, y: number) {
    if (!this.calibrated) {
      return { x, y };
    }

    if (this.mode === "affine") {
      return applyAffineMatrix(this.vacuumToMapMatrix, x, y);
    }

    return applyHomography(this.vacuumToMapMatrix, x, y);
  }

  mapToVacuum(x: number, y: number) {
    if (!this.calibrated) {
      return { x, y };
    }

    if (this.mode === "affine") {
      return applyAffineMatrix(this.mapToVacuumMatrix, x, y);
    }

    return applyHomography(this.mapToVacuumMatrix, x, y);
  }
}

export function parseCalibrationPoints(raw: unknown, hass: HomeAssistant | null | undefined): unknown[] {
  const config = record(raw);
  const calibration = record(config.calibration_source);
  const directPoints = arrayFromMaybe(calibration.calibration_points);
  if (directPoints.length) {
    return directPoints;
  }

  const calibrationEntityId = String(calibration.entity || "");
  if (calibrationEntityId && hass?.states?.[calibrationEntityId]?.attributes?.calibration_points) {
    return arrayFromMaybe(hass.states[calibrationEntityId]?.attributes.calibration_points);
  }

  if (calibration.camera === true) {
    const mapEntityId = String(record(config.map_source).camera || config.map_camera || "");
    return arrayFromMaybe(hass?.states?.[mapEntityId]?.attributes?.calibration_points);
  }

  return [];
}

export function resolveLegacyMode(raw: unknown, templateName: unknown) {
  const config = record(raw);
  return arrayFromMaybe(config?.map_modes).filter(isObject).find(mode => normalizeTextKey(mode.template) === normalizeTextKey(templateName));
}

export function resolveRoomsFromVacuumState(hass: HomeAssistant | null | undefined, entityId: string): RoomSegment[] {
  const vacuumState = entityId ? hass?.states?.[entityId] || null : null;
  const maps = arrayFromMaybe(vacuumState?.attributes?.maps).filter(isObject);
  const mapWithRooms = maps.find(map => isObject(map?.rooms) && Object.keys(map.rooms).length > 0);
  if (!mapWithRooms) {
    return [];
  }

  return Object.entries(record(mapWithRooms.rooms)).map(([id, label]) => ({
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

export function resolveRoomsFromMapState(hass: HomeAssistant | null | undefined, entityId: string): RoomSegment[] {
  const mapState = entityId ? hass?.states?.[entityId] || null : null;
  const rooms = mapState?.attributes?.rooms;
  if (!isObject(rooms) || !Object.keys(rooms).length) {
    return [];
  }

  return Object.entries(rooms).filter(([, room]) => isObject(room) || Array.isArray(room)).map(([id, rawRoom]) => {
    const room = record(rawRoom);
    const shapeSource = pickShapeSource(
      room?.outlines,
      room?.outline,
      room?.zones,
      room?.rectangles,
      room?.segments,
      room?.areas,
      room?.polygons,
      rawRoom,
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
      iconPoint: centerX !== null && centerY !== null
        ? { x: centerX, y: centerY }
        : fallbackCenter,
      labelPoint: centerX !== null && centerY !== null
        ? { x: centerX, y: centerY }
        : fallbackCenter,
      labelOffsetY: 0,
    };
  }).filter(room => room.id);
}

export function resolveRoomSegments(raw: unknown, hass: HomeAssistant | null = null, entityId = "", mapEntityId = ""): RoomSegment[] {
  const config = record(raw);
  const directRooms = arrayFromMaybe(config?.room_segments).filter(isObject);
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
        label: String(typeof room.label === "string" ? room.label : room.name || record(room.label).text || ""),
        icon: String(typeof room.icon === "string" ? room.icon : record(room.icon).name || "mdi:broom"),
        outlines,
        outline: flattenPolygons(outlines),
        iconPoint: parsePoint(room.iconPoint || room.icon || room.position),
        labelPoint: parsePoint(room.labelPoint || room.label || room.position),
        labelOffsetY: parseFiniteNumericValue(room.labelOffsetY ?? record(room.label).offset_y) ?? 0,
      };
    }).filter(room => room.id && room.outlines.length);
  }

  const segmentMode = resolveLegacyMode(config, "vacuum_clean_segment");
  const legacyRooms = arrayFromMaybe(segmentMode?.predefined_selections).filter(isObject).map(selection => {
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
      label: String(record(selection.label).text || selection?.label || selection?.text || selection.id || "").trim(),
      icon: String(record(selection.icon).name || selection?.icon || "mdi:broom").trim(),
      outlines,
      outline: flattenPolygons(outlines),
      iconPoint: parsePoint(selection?.icon),
      labelPoint: parsePoint(selection?.label),
      labelOffsetY: parseFiniteNumericValue(record(selection.label).offset_y) ?? 0,
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

export function resolveGotoPoints(raw: unknown) {
  const config = record(raw);
  const directPoints = arrayFromMaybe(config?.goto_points).filter(isObject);
  if (directPoints.length) {
    return directPoints.map(point => ({
      id: String(point.id || point.label || point.name || ""),
      label: String(typeof point.label === "string" ? point.label : point.name || record(point.label).text || ""),
      icon: String(typeof point.icon === "string" ? point.icon : record(point.icon).name || "mdi:map-marker"),
      position: parsePoint(point.position),
    })).filter(point => point.position);
  }

  const gotoMode = resolveLegacyMode(config, "vacuum_goto_predefined");
  return arrayFromMaybe(gotoMode?.predefined_selections).filter(isObject).map(point => ({
    id: String(point.id || record(point.label).text || record(point.icon).name || "goto"),
    label: String(record(point.label).text || point?.label || "").trim(),
    icon: String(record(point.icon).name || point?.icon || "mdi:map-marker").trim(),
    position: parsePoint(point.position),
  })).filter(point => point.position);
}

export function resolvePredefinedZones(raw: unknown) {
  const config = record(raw);
  const directZones = arrayFromMaybe(config?.predefined_zones).filter(isObject);
  if (directZones.length) {
    return directZones.map(zone => ({
      id: String(zone.id || zone.label || zone.name || ""),
      label: String(typeof zone.label === "string" ? zone.label : zone.name || record(zone.label).text || ""),
      icon: String(typeof zone.icon === "string" ? zone.icon : record(zone.icon).name || "mdi:vector-rectangle"),
      zones: arrayFromMaybe(zone.zones).map(item => arrayFromMaybe(item).every(isFiniteScalar) ? arrayFromMaybe(item).map(Number) : []).filter(item => item.length >= 4),
      position: parsePoint(zone.position || zone.icon || zone.label),
    })).filter(zone => zone.zones.length);
  }

  const zoneMode = resolveLegacyMode(config, "vacuum_clean_zone_predefined");
  return arrayFromMaybe(zoneMode?.predefined_selections).filter(isObject).map(zone => ({
    id: String(zone.id || record(zone.label).text || record(zone.icon).name || "zone"),
    label: String(record(zone.label).text || zone?.label || "").trim(),
    icon: String(record(zone.icon).name || zone?.icon || "mdi:vector-rectangle").trim(),
    zones: arrayFromMaybe(zone.zones).map(item => arrayFromMaybe(item).every(isFiniteScalar) ? arrayFromMaybe(item).map(Number) : []).filter(item => item.length >= 4),
    position: parsePoint(zone?.icon || zone?.label),
  })).filter(zone => zone.zones.length);
}

export function resolveHeaderIcons(raw: unknown) {
  const config = record(raw);
  return sortByOrder(arrayFromMaybe(config?.icons).filter(isObject)).map((item, index) => ({
    id: String(item.id || item.icon_id || index),
    icon: String(item.icon || "mdi:gesture-tap-button").trim(),
    tooltip: String(item.tooltip || item.label || "").trim(),
    order: parseFiniteNumericValue(item.order) || index,
    tap_action: isObject(item.tap_action) ? item.tap_action : {},
  }));
}
