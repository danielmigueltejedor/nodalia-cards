export { resolveEditorColorValue, formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import { isObject } from "./media-player-runtime";
import type { HassEntity, HomeAssistant } from "../../core/types/home-assistant";
import { compactConfig as compactEditorValues } from "../../shared/config-values";
import { appendUrlQueryParam } from "../../shared/url-query";
import { renderSignature } from "../../shared/render-signature";
import { getStubEntityId } from "../../shared/editor-entity-helpers";
export { getStubEntityId } from "../../shared/editor-entity-helpers";
export { moveItem } from "../../shared/editor-lists";
export { getRangeValueFromClientX, getSliderDragGeometry, getRangeValueFromGeometry } from "../../shared/device-control-geometry";
export { parseRgbColor, getRelativeLuminance } from "../../shared/color-luminance";
export { formatDuration, sanitizeMediaArtworkUrl } from "../../shared/media-values";

export function getStubFriendlyName(hass: HomeAssistant | null | undefined, entityId: string) {
  return hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
}

export function compactConfig(value: unknown): unknown {
  return compactEditorValues(value, ["entity"]);
}

export function formatEditorJsonValue(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2) ?? "";
    } catch (_error) {
      return value;
    }
  }

  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch (_error) {
    return String(value);
  }
}

export function parseEditorJsonObject(value: unknown) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return { valid: true, value: undefined };
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isObject(parsed)
      ? { valid: true, value: parsed }
      : { valid: false, value: undefined };
  } catch (_error) {
    return { valid: false, value: undefined };
  }
}

export function getByPath(target: unknown, path: unknown): unknown {
  let cursor = target;
  for (const key of String(path || "").split(".").filter(Boolean)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype" || cursor === null || typeof cursor !== "object" || !Object.prototype.hasOwnProperty.call(cursor, key)) return undefined;
    cursor = Reflect.get(cursor, key);
  }
  return cursor;
}

export function arrayFromCsv(value: unknown) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

export function escapeSelectorValue(value: unknown) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value).replaceAll('"', '\\"');
}

export function resolveColorInContext(contextNode: Pick<HTMLElement, "shadowRoot"> | null | undefined, value: unknown) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue || typeof document === "undefined") {
    return "";
  }

  const probe = document.createElement("span");
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.color = "";
  probe.style.color = rawValue;
  if (!probe.style.color) {
    return rawValue;
  }

  const root = typeof ShadowRoot !== "undefined" && contextNode?.shadowRoot instanceof ShadowRoot
    ? contextNode.shadowRoot
    : document.body || document.documentElement;
  root.appendChild(probe);
  try {
    return getComputedStyle(probe).color || rawValue;
  } finally {
    probe.remove();
  }
}

export function getEditorColorFallbackValue(field: unknown) {
  const normalizedField = String(field ?? "");

  if (normalizedField.endsWith("off_color")) {
    return "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))";
  }

  if (normalizedField.endsWith("accent_background")) {
    return "rgba(113, 192, 255, 0.2)";
  }

  if (normalizedField.endsWith("active_tint_color")) {
    return "var(--info-color, #71c0ff)";
  }

  if (normalizedField.endsWith("progress_background")) {
    return "color-mix(in srgb, var(--primary-text-color) 12%, transparent)";
  }

  if (normalizedField.endsWith("overlay_color")) {
    return "rgba(0, 0, 0, 0.32)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
}

export function normalizeTextKey(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function getRenderSignatureRuntime() {
  return window.NodaliaRenderSignature || renderSignature;
}

export function appendQueryParam(url: unknown, key: unknown, value: unknown) {
  return appendUrlQueryParam(url, key, value, true);
}

export function isUnavailableState(state: HassEntity | null | undefined) {
  return normalizeTextKey(state?.state) === "unavailable";
}


export function getMediaPlayerStubConfig(hass: HomeAssistant | null | undefined = null, entities: unknown = [], entitiesFallback: unknown = []) {
  const entityId = getStubEntityId(hass, ["media_player"], entities, entitiesFallback);
  return { players: [{ entity: entityId || "media_player.spotify", label: entityId ? getStubFriendlyName(hass, entityId) : "Spotify" }], layout: { mode: "standard", fixed: false, reserve_space: false } };
}
