import type { HassEntity } from "../core/types/home-assistant";
import { readDeviceStateMemory, readDeviceStateSnapshot } from "./device-state-memory";
import { parseFiniteNumericValue } from "./numeric-values";

export const LIGHT_MEMORY_STORAGE_KEY = "nodalia-light-card:last-visual-state:v1";
export const OPTIMISTIC_VISUAL_SETTLE_MS = 420;

export function hasLightColorAttributes(state: HassEntity | null): boolean {
  const attrs = state?.attributes || {};
  const validChannels = (value: unknown, count: number, maxima: number[]) => Array.isArray(value)
    && value.length === count && value.every((channel: unknown, index: number) => {
      const number = parseFiniteNumericValue(channel);
      return number !== null && number >= 0 && number <= maxima[index]!;
    });
  return validChannels(attrs.rgb_color, 3, [255, 255, 255])
    || validChannels(attrs.hs_color, 2, [360, 100])
    || (typeof attrs.color_temp_kelvin === "number" && Number.isFinite(attrs.color_temp_kelvin) && attrs.color_temp_kelvin > 0)
    || (typeof attrs.color_temp === "number" && Number.isFinite(attrs.color_temp) && attrs.color_temp > 0);
}

/** Copy arrays as HA may mutate an entity's attributes in place. */
export function snapshotLightVisualState(state: HassEntity): HassEntity {
  const attrs = state.attributes || {};
  return { ...state, attributes: { ...attrs,
    rgb_color: Array.isArray(attrs.rgb_color) ? [...attrs.rgb_color] : attrs.rgb_color,
    hs_color: Array.isArray(attrs.hs_color) ? [...attrs.hs_color] : attrs.hs_color,
  } };
}

export function readLightVisualState(entityId: string): HassEntity | null {
  return readDeviceStateSnapshot(LIGHT_MEMORY_STORAGE_KEY, entityId);
}

/** Light and Fav use the same remembered visual state, including after a dashboard reload. */
export function storeLightVisualState(entityId: string, snapshot: HassEntity | null): void {
  if (!entityId || !snapshot || typeof window === "undefined") return;
  const attrs = snapshot.attributes || {};
  if (!hasLightColorAttributes(snapshot) && typeof attrs.brightness !== "number") return;
  try {
    const memory = readDeviceStateMemory(LIGHT_MEMORY_STORAGE_KEY);
    // An initial on/brightness acknowledgement must not erase the stored color.
    const previous = readDeviceStateSnapshot(LIGHT_MEMORY_STORAGE_KEY, entityId, memory);
    const visual = withLightVisualFallback(snapshot, previous).attributes;
    memory[entityId] = {
      attributes: {
        brightness: visual.brightness, color_temp: visual.color_temp,
        color_temp_kelvin: visual.color_temp_kelvin, color_mode: visual.color_mode,
        hs_color: Array.isArray(visual.hs_color) ? [...visual.hs_color] : undefined,
        rgb_color: Array.isArray(visual.rgb_color) ? [...visual.rgb_color] : undefined,
      },
      last_changed: snapshot.last_changed || new Date().toISOString(),
    };
    window.localStorage.setItem(LIGHT_MEMORY_STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // The caller's in-memory snapshot continues to work when storage is unavailable.
  }
}

export function withLightVisualFallback(actual: HassEntity, snapshot: HassEntity | null): HassEntity {
  if (!snapshot || hasLightColorAttributes(actual)) return actual;
  const attrs = actual.attributes || {};
  const previous = snapshot.attributes || {};
  return { ...actual, attributes: { ...previous, ...attrs,
    rgb_color: attrs.rgb_color ?? previous.rgb_color,
    hs_color: attrs.hs_color ?? previous.hs_color,
    color_temp_kelvin: attrs.color_temp_kelvin ?? previous.color_temp_kelvin,
    color_temp: attrs.color_temp ?? previous.color_temp,
    brightness: attrs.brightness ?? previous.brightness,
  } };
}
