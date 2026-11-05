import type { HassEntity, HomeAssistant } from "../core/types/home-assistant";

export function suggestionState(
  hass: HomeAssistant | null | undefined,
  entityId: string,
): HassEntity | null {
  const id = String(entityId || "").trim();
  const state = hass?.states?.[id];
  return state || null;
}

export function suggestionIsOn(state: HassEntity | null): boolean {
  return String(state?.state || "").trim().toLowerCase() === "on";
}

function colorModes(state: HassEntity | null): string[] {
  const modes = state?.attributes?.supported_color_modes;
  return Array.isArray(modes) ? modes.map(mode => String(mode || "")) : [];
}

export function lightSupportsBrightness(state: HassEntity | null): boolean {
  if (typeof state?.attributes?.brightness === "number") {
    return true;
  }
  return colorModes(state).some(mode =>
    ["brightness", "color_temp", "hs", "rgb", "rgbw", "rgbww", "xy", "white"].includes(mode),
  );
}

export function lightSupportsColor(state: HassEntity | null): boolean {
  return colorModes(state).some(mode => ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(mode));
}

export function lightSupportsColorTemperature(state: HassEntity | null): boolean {
  return colorModes(state).includes("color_temp")
    || typeof state?.attributes?.color_temp_kelvin === "number"
    || typeof state?.attributes?.color_temp === "number";
}

export function fanSupportsPercentage(state: HassEntity | null): boolean {
  const percentage = Number(state?.attributes?.percentage);
  const step = Number(state?.attributes?.percentage_step);
  return Number.isFinite(percentage) || Number.isFinite(step);
}

export function fanSupportsOscillation(state: HassEntity | null): boolean {
  return typeof state?.attributes?.oscillating === "boolean";
}

export function fanPresetModes(state: HassEntity | null): string[] {
  const modes = state?.attributes?.preset_modes;
  if (!Array.isArray(modes)) {
    return [];
  }
  return modes.map(mode => String(mode || "").trim()).filter(Boolean);
}

export function vacuumHasFanSpeeds(state: HassEntity | null): boolean {
  const speeds = state?.attributes?.fan_speed_list;
  return Array.isArray(speeds) && speeds.some(speed => String(speed || "").trim());
}

export function humidifierSupportsTarget(state: HassEntity | null): boolean {
  const attrs = state?.attributes || {};
  const numeric = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed);
  };
  return numeric(attrs.humidity)
    || numeric(attrs.target_humidity)
    || (numeric(attrs.min_humidity) && numeric(attrs.max_humidity));
}

function supportsFeature(state: HassEntity | null, bit: number): boolean {
  const features = Number(state?.attributes?.supported_features);
  return Number.isFinite(features) && Boolean(features & bit);
}

export function coverSupportsPosition(state: HassEntity | null): boolean {
  return supportsFeature(state, 4);
}

export function coverHasPositionSlider(state: HassEntity | null): boolean {
  const position = Number(state?.attributes?.current_position);
  return coverSupportsPosition(state) && Number.isFinite(position);
}

export function coverHasTiltSlider(state: HassEntity | null): boolean {
  const tilt = Number(state?.attributes?.current_tilt_position);
  return supportsFeature(state, 128) && Number.isFinite(tilt);
}
