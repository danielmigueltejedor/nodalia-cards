import type { HassEntity } from "../core/types/home-assistant";
import { parseEditorColorChannels } from "./editor-color";

function normalizeTextKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getEntityDomain(state: HassEntity | null | undefined) {
  const entityId = String(state?.entity_id || "");
  return entityId.includes(".") ? (entityId.split(".")[0] ?? "") : "";
}

const RESOLVE_COLOR_CACHE_MAX = 256;
const resolveEditorColorValueCache = new Map<string, string>();

function setResolveEditorColorCache(key: string, value: string) {
  if (resolveEditorColorValueCache.size >= RESOLVE_COLOR_CACHE_MAX) {
    const oldestKey = resolveEditorColorValueCache.keys().next().value;
    if (oldestKey !== undefined) {
      resolveEditorColorValueCache.delete(oldestKey);
    }
  }
  resolveEditorColorValueCache.set(key, value);
}

export function resolveEditorColorValue(value: unknown): string {
  const rawValue = String(value ?? "").trim();
  if (!rawValue || typeof document === "undefined") {
    return "";
  }
  // Theme-dependent values must be resolved against the current document.
  const cacheable = !/\bvar\(|\bcurrentcolor\b|\blight-dark\(/i.test(rawValue)
    && !["inherit", "unset", "revert", "revert-layer"].includes(rawValue.toLowerCase());
  const cached = cacheable ? resolveEditorColorValueCache.get(rawValue) : undefined;
  if (cached !== undefined) return cached;

  const probe = document.createElement("span");
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.color = "";
  probe.style.color = rawValue;
  if (!probe.style.color) {
    if (cacheable) setResolveEditorColorCache(rawValue, rawValue);
    return rawValue;
  }

  (document.body || document.documentElement).appendChild(probe);
  let resolved: string;
  try {
    resolved = getComputedStyle(probe).color;
  } finally {
    probe.remove();
  }
  const result = resolved || rawValue;
  if (cacheable) setResolveEditorColorCache(rawValue, result);
  return result;
}

function rgbToHueDegrees(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d < 1 / 255) {
    return null;
  }
  let h;
  if (max === rn) {
    h = ((gn - bn) / d) % 6;
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  h *= 60;
  if (h < 0) {
    h += 360;
  }
  return h;
}

export function parseCssColorHue(cssColor: unknown, resolveDepth = 0): number | null {
  const raw = String(cssColor || "").trim();
  if (!raw) {
    return null;
  }

  const varFallback = /\bvar\([^,]+,\s*([^)]+)\)/i.exec(raw);
  if (varFallback?.[1]) {
    const nested = parseCssColorHue(varFallback[1].trim(), resolveDepth);
    if (nested !== null && !Number.isNaN(nested)) {
      return nested;
    }
  }

  const channels = parseEditorColorChannels(raw);
  if (channels) return rgbToHueDegrees(channels.red, channels.green, channels.blue);

  if (resolveDepth === 0 && typeof document !== "undefined") {
    const resolved = resolveEditorColorValue(raw);
    const resolvedTrim = String(resolved || "").trim();
    if (resolvedTrim && resolvedTrim !== raw) {
      return parseCssColorHue(resolvedTrim, 1);
    }
  }

  return null;
}

function isHueCoolTintPoorContrast(hue: number | null) {
  if (hue === null || Number.isNaN(hue)) {
    return false;
  }
  if (hue >= 65 && hue <= 165) {
    return true;
  }
  if (hue >= 165 && hue <= 275) {
    return true;
  }
  if (hue >= 300 || hue <= 20) {
    return true;
  }
  return false;
}

function inferCoolTintFromEntity(state: HassEntity | null | undefined) {
  if (!state) {
    return false;
  }
  const domain = getEntityDomain(state);
  const dc = normalizeTextKey(state.attributes?.device_class || "");
  const unit = normalizeTextKey(
    String(state.attributes?.unit_of_measurement || state.attributes?.native_unit_of_measurement || ""),
  );

  if (domain === "sensor") {
    if (
      /(^|_)power($|_)|energy|current|voltage|battery|frequency|humidity|moisture|temperature|pressure/.test(dc)
    ) {
      return true;
    }
    if (/\b(kwh|mwh|wh|kw|mw|ma|mv|hz|a|v)\b|\bw\b/.test(unit)) {
      return true;
    }
  }

  if (domain === "binary_sensor" && /moisture|battery/.test(dc)) {
    return true;
  }

  return false;
}

export function shouldDarkenBubbleIconGlyph(state: HassEntity | null | undefined, accentColor: unknown) {
  if (!state) {
    return false;
  }
  const hue = parseCssColorHue(accentColor);
  if (hue !== null && !Number.isNaN(hue)) {
    return isHueCoolTintPoorContrast(hue);
  }
  return inferCoolTintFromEntity(state);
}

export function resolveBubbleIconGlyphColor(state: HassEntity | null | undefined, accentColor: unknown) {
  const accent = String(accentColor || "").trim() || "var(--primary-color)";
  const accentWeight = shouldDarkenBubbleIconGlyph(state, accent) ? 42 : 72;
  return `color-mix(in srgb, ${accent} ${accentWeight}%, var(--primary-text-color))`;
}

export function normalizeNeutralBubbleBackground(value: unknown, fallback = "color-mix(in srgb, var(--primary-text-color) 6%, transparent)") {
  const raw = String(value ?? "").trim();
  const compact = raw.toLowerCase().replace(/\s+/g, "");
  const legacyFlatBackgrounds = new Set([
    "var(--ha-card-background)",
    "var(--card-background-color)",
    "var(--paper-card-background-color)",
    "#fff",
    "#ffffff",
    "rgb(255,255,255)",
    "rgba(255,255,255,1)",
    "rgba(255,255,255,0.05)",
    "rgba(255,255,255,.05)",
    "rgba(255,255,255,0.06)",
    "rgba(255,255,255,.06)",
    "rgba(255,255,255,0.08)",
    "rgba(255,255,255,.08)",
    "color-mix(insrgb,var(--primary-text-color)5%,transparent)",
    "color-mix(insrgb,var(--primary-text-color)6%,transparent)",
    "color-mix(insrgb,var(--primary-text-color)8%,transparent)",
  ]);
  return !raw || legacyFlatBackgrounds.has(compact) ? fallback : raw;
}


export const bubbleContrast = {
  resolveEditorColorValue,
  parseCssColorHue,
  shouldDarkenBubbleIconGlyph,
  resolveBubbleIconGlyphColor,
  normalizeNeutralBubbleBackground,
};
