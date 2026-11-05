/* Generated from src/shared/bubble-contrast-runtime.ts. Do not edit. */
"use strict";
(() => {
  // src/shared/editor-color.ts
  var clamp = (value, max) => Math.max(0, Math.min(max, value));
  function cssFunctionBody(raw, name) {
    const head = `${name}(`;
    if (!raw.toLowerCase().startsWith(head) || !raw.endsWith(")")) return null;
    return raw.slice(head.length, -1);
  }
  function srgbFunctionBody(raw) {
    const body = cssFunctionBody(raw, "color");
    if (body === null) return null;
    const inner = body.trim();
    if (!inner.toLowerCase().startsWith("srgb")) return null;
    const rest = inner.slice(4);
    if (rest.length === 0 || !/\s/.test(rest.charAt(0))) return null;
    return rest.trim();
  }
  function splitCssAlpha(body) {
    const slash = body.indexOf("/");
    if (slash < 0) return [body.trim()];
    if (body.indexOf("/", slash + 1) >= 0) return [body, "", ""];
    return [body.slice(0, slash).trim(), body.slice(slash + 1).trim()];
  }
  var component = (value, scale) => {
    if (!value || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/i.test(value)) return null;
    const numeric = Number(value.replace(/%$/, ""));
    return Number.isFinite(numeric) ? clamp(value.endsWith("%") ? numeric * scale / 100 : numeric, scale) : null;
  };
  function parseEditorColorChannels(value) {
    const raw = String(value ?? "").trim();
    const hexMatch = raw.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hexMatch?.[1]) {
      const hex = hexMatch[1].length < 5 ? hexMatch[1].split("").map((channel) => channel + channel).join("") : hexMatch[1];
      return { red: Number.parseInt(hex.slice(0, 2), 16), green: Number.parseInt(hex.slice(2, 4), 16), blue: Number.parseInt(hex.slice(4, 6), 16), alpha: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1 };
    }
    const rgb = cssFunctionBody(raw, "rgb") ?? cssFunctionBody(raw, "rgba");
    const srgb = srgbFunctionBody(raw);
    const body = rgb ?? srgb;
    if (!body) return null;
    const sections = splitCssAlpha(body);
    if (sections.length > 2) return null;
    const parts = sections[0]?.split(/[\s,]+/) ?? [];
    if (sections.length === 2 && parts.length !== 3 || parts.length < 3 || parts.length > 4) return null;
    const scale = srgb ? 1 : 255;
    const red = component(parts[0], scale), green = component(parts[1], scale), blue = component(parts[2], scale);
    const alphaPart = sections[1] ?? parts[3];
    const alpha = alphaPart === void 0 ? 1 : component(alphaPart, 1);
    if (red === null || green === null || blue === null || alpha === null) return null;
    return { red: red * 255 / scale, green: green * 255 / scale, blue: blue * 255 / scale, alpha };
  }

  // src/shared/bubble-contrast.ts
  function trimEdgeUnderscores(value) {
    let start = 0;
    let end = value.length;
    while (start < end && value.charCodeAt(start) === 95) start += 1;
    while (end > start && value.charCodeAt(end - 1) === 95) end -= 1;
    return value.slice(start, end);
  }
  function normalizeTextKey(value) {
    return trimEdgeUnderscores(String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  }
  function cssVarFallback(raw) {
    const lower = raw.toLowerCase();
    let search = 0;
    while (search < lower.length) {
      const start = lower.indexOf("var(", search);
      if (start < 0) return null;
      const previous = start === 0 ? "" : lower.charAt(start - 1);
      if (previous && /[a-z0-9_]/.test(previous)) {
        search = start + 4;
        continue;
      }
      const comma = raw.indexOf(",", start + 4);
      const end = comma < 0 ? -1 : raw.indexOf(")", comma + 1);
      if (comma < 0 || end < 0) return null;
      return raw.slice(comma + 1, end).trim();
    }
    return null;
  }
  function getEntityDomain(state) {
    const entityId = String(state?.entity_id || "");
    return entityId.includes(".") ? entityId.split(".")[0] ?? "" : "";
  }
  var RESOLVE_COLOR_CACHE_MAX = 256;
  var resolveEditorColorValueCache = /* @__PURE__ */ new Map();
  function setResolveEditorColorCache(key, value) {
    if (resolveEditorColorValueCache.size >= RESOLVE_COLOR_CACHE_MAX) {
      const oldestKey = resolveEditorColorValueCache.keys().next().value;
      if (oldestKey !== void 0) {
        resolveEditorColorValueCache.delete(oldestKey);
      }
    }
    resolveEditorColorValueCache.set(key, value);
  }
  function resolveEditorColorValue(value) {
    const rawValue = String(value ?? "").trim();
    if (!rawValue || typeof document === "undefined") {
      return "";
    }
    const cacheable = !/\bvar\(|\bcurrentcolor\b|\blight-dark\(/i.test(rawValue) && !["inherit", "unset", "revert", "revert-layer"].includes(rawValue.toLowerCase());
    const cached = cacheable ? resolveEditorColorValueCache.get(rawValue) : void 0;
    if (cached !== void 0) return cached;
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
    let resolved;
    try {
      resolved = getComputedStyle(probe).color;
    } finally {
      probe.remove();
    }
    const result = resolved || rawValue;
    if (cacheable) setResolveEditorColorCache(rawValue, result);
    return result;
  }
  function rgbToHueDegrees(r, g, b) {
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
      h = (gn - bn) / d % 6;
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
  function parseCssColorHue(cssColor, resolveDepth = 0) {
    const raw = String(cssColor || "").trim();
    if (!raw) {
      return null;
    }
    const varFallback = cssVarFallback(raw);
    if (varFallback) {
      const nested = parseCssColorHue(varFallback, resolveDepth);
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
  function isHueCoolTintPoorContrast(hue) {
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
  function inferCoolTintFromEntity(state) {
    if (!state) {
      return false;
    }
    const domain = getEntityDomain(state);
    const dc = normalizeTextKey(state.attributes?.device_class || "");
    const unit = normalizeTextKey(
      String(state.attributes?.unit_of_measurement || state.attributes?.native_unit_of_measurement || "")
    );
    if (domain === "sensor") {
      if (/(^|_)power($|_)|energy|current|voltage|battery|frequency|humidity|moisture|temperature|pressure/.test(dc)) {
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
  function shouldDarkenBubbleIconGlyph(state, accentColor) {
    if (!state) {
      return false;
    }
    const hue = parseCssColorHue(accentColor);
    if (hue !== null && !Number.isNaN(hue)) {
      return isHueCoolTintPoorContrast(hue);
    }
    return inferCoolTintFromEntity(state);
  }
  function resolveBubbleIconGlyphColor(state, accentColor) {
    const accent = String(accentColor || "").trim() || "var(--primary-color)";
    const accentWeight = shouldDarkenBubbleIconGlyph(state, accent) ? 42 : 72;
    return `color-mix(in srgb, ${accent} ${accentWeight}%, var(--primary-text-color))`;
  }
  function normalizeNeutralBubbleBackground(value, fallback = "color-mix(in srgb, var(--primary-text-color) 6%, transparent)") {
    const raw = String(value ?? "").trim();
    const compact = raw.toLowerCase().replace(/\s+/g, "");
    const legacyFlatBackgrounds = /* @__PURE__ */ new Set([
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
      "color-mix(insrgb,var(--primary-text-color)8%,transparent)"
    ]);
    return !raw || legacyFlatBackgrounds.has(compact) ? fallback : raw;
  }
  var bubbleContrast = {
    resolveEditorColorValue,
    parseCssColorHue,
    shouldDarkenBubbleIconGlyph,
    resolveBubbleIconGlyphColor,
    normalizeNeutralBubbleBackground
  };

  // src/shared/bubble-contrast-runtime.ts
  var existing = typeof window !== "undefined" ? window.NodaliaBubbleContrast : void 0;
  if (typeof window !== "undefined" && !(existing && typeof existing.shouldDarkenBubbleIconGlyph === "function" && typeof existing.resolveBubbleIconGlyphColor === "function" && typeof existing.normalizeNeutralBubbleBackground === "function")) {
    window.NodaliaBubbleContrast = bubbleContrast;
  }
})();
