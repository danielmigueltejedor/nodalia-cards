// @ts-nocheck -- color, icon and domain helpers stay loosely typed until remaining unknowns are narrowed.
import { clamp, normalizeTextKey } from "./fav-runtime";

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

export function resolveEditorColorValue(value) {
  const resolver = window.NodaliaBubbleContrast?.resolveEditorColorValue;
  if (typeof resolver === "function") {
    return resolver(value);
  }
  return String(value ?? "").trim();
}

export function shouldDarkenFavBubbleIconGlyph(state, accentColor) {
  return Boolean(window.NodaliaBubbleContrast?.shouldDarkenBubbleIconGlyph(state, accentColor));
}

export function resolveFavBubbleIconGlyphColor(accentColor, state) {
  const accent = String(accentColor || "").trim() || "var(--primary-color)";
  let accentWeight = 72;
  try {
    const resolver = window.NodaliaBubbleContrast?.resolveBubbleIconGlyphColor;
    if (typeof resolver === "function") {
      return resolver(state, accent);
    }
    accentWeight = shouldDarkenFavBubbleIconGlyph(state, accent) ? 42 : 72;
  } catch (_error) {
    // Theme variables may need a live DOM probe; use the same safe mix as Light Card.
  }
  return `color-mix(in srgb, ${accent} ${accentWeight}%, var(--primary-text-color))`;
}

export function formatEditorHexChannel(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

export function formatEditorColorFromHex(hex, alpha = 1) {
  const normalizedHex = String(hex ?? "").trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(normalizedHex)) {
    return String(hex ?? "");
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  const safeAlpha = clamp(Number(alpha), 0, 1);
  if (safeAlpha >= 0.999) {
    return `#${normalizedHex}`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${Number(safeAlpha.toFixed(2))})`;
}

export function getEditorColorModel(value, fallbackValue = "#71c0ff") {
  const sourceValue = String(value ?? "").trim() || String(fallbackValue ?? "").trim() || "#71c0ff";
  const resolvedValue = resolveEditorColorValue(sourceValue) || resolveEditorColorValue(fallbackValue) || "rgb(113, 192, 255)";
  const channels = resolvedValue.match(/[\d.]+/g) || [];
  const red = clamp(Math.round(Number(channels[0] ?? 113)), 0, 255);
  const green = clamp(Math.round(Number(channels[1] ?? 192)), 0, 255);
  const blue = clamp(Math.round(Number(channels[2] ?? 255)), 0, 255);
  const alpha = channels.length > 3 ? clamp(Number(channels[3]), 0, 1) : 1;
  const hex = `#${formatEditorHexChannel(red)}${formatEditorHexChannel(green)}${formatEditorHexChannel(blue)}`;

  return {
    alpha,
    hex,
    resolved: resolvedValue,
    source: sourceValue,
    value: formatEditorColorFromHex(hex, alpha),
  };
}

export function getEditorColorFallbackValue(field) {
  const normalizedField = String(field ?? "");

  if (normalizedField.endsWith("off_color")) {
    return "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
}

export function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}


export function miredToKelvin(mired) {
  const numeric = Number(mired);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.round(1000000 / numeric);
}


export function parseNumericValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function entitySupportedFeatures(state) {
  return Number(state?.attributes?.supported_features) || 0;
}

export function entitySupportsFeature(state, flag) {
  return (entitySupportedFeatures(state) & flag) !== 0;
}

export function coverEntityIsOpen(state) {
  const stateKey = normalizeTextKey(state?.state);
  if (["open", "opening"].includes(stateKey)) {
    return true;
  }
  if (["closed", "closing"].includes(stateKey)) {
    return false;
  }
  const position = parseNumericValue(state?.attributes?.current_position);
  return position !== null && position > 0;
}

export function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function getEntityDomain(state) {
  const entityId = String(state?.entity_id || "");
  return entityId.includes(".") ? entityId.split(".")[0] : "";
}

export function getDynamicEntityIcon(state) {
  if (!state) {
    return "";
  }

  const domain = getEntityDomain(state);
  const stateKey = normalizeTextKey(state.state);
  const deviceClass = normalizeTextKey(state.attributes?.device_class);

  if (domain === "binary_sensor") {
    switch (deviceClass) {
      case "door":
      case "opening":
        return stateKey === "on" ? "mdi:door-open" : "mdi:door-closed";
      case "garage_door":
        return stateKey === "on" ? "mdi:garage-open" : "mdi:garage";
      case "window":
        return stateKey === "on" ? "mdi:window-open-variant" : "mdi:window-closed-variant";
      case "motion":
        return stateKey === "on" ? "mdi:motion-sensor" : "mdi:motion-sensor-off";
      case "occupancy":
      case "presence":
      case "person":
        return stateKey === "on" ? "mdi:account" : "mdi:account-off-outline";
      case "smoke":
        return stateKey === "on" ? "mdi:smoke-detector-alert" : "mdi:smoke-detector-variant";
      case "moisture":
        return stateKey === "on" ? "mdi:water-alert" : "mdi:water-check";
      case "gas":
        return stateKey === "on" ? "mdi:gas-cylinder" : "mdi:check-circle-outline";
      case "tamper":
      case "safety":
      case "problem":
        return stateKey === "on" ? "mdi:alert-circle" : "mdi:check-circle-outline";
      case "plug":
      case "power":
        return stateKey === "on" ? "mdi:power-plug" : "mdi:power-plug-off";
      case "sound":
        return stateKey === "on" ? "mdi:volume-high" : "mdi:volume-mute";
      case "vibration":
        return stateKey === "on" ? "mdi:vibrate" : "mdi:vibrate-off";
      case "heat":
        return stateKey === "on" ? "mdi:fire" : "mdi:fire-off";
      case "cold":
        return stateKey === "on" ? "mdi:snowflake-alert" : "mdi:snowflake";
      case "light":
        return stateKey === "on" ? "mdi:brightness-7" : "mdi:brightness-5";
      default:
        break;
    }
  }

  if (domain === "light") {
    return stateKey === "on" ? "mdi:lightbulb" : "mdi:lightbulb-off";
  }

  if (domain === "switch") {
    return stateKey === "on" ? "mdi:toggle-switch-variant" : "mdi:toggle-switch-variant-off";
  }

  if (domain === "fan") {
    return stateKey === "on" ? "mdi:fan" : "mdi:fan-off";
  }

  if (domain === "lock") {
    switch (stateKey) {
      case "unlocked":
      case "open":
        return "mdi:lock-open-variant";
      case "jammed":
        return "mdi:lock-alert";
      case "locking":
      case "unlocking":
        return "mdi:lock-clock";
      default:
        return "mdi:lock";
    }
  }

  if (domain === "cover") {
    if (deviceClass === "garage") {
      return stateKey === "open" ? "mdi:garage-open" : "mdi:garage";
    }

    if (deviceClass === "door") {
      return stateKey === "open" ? "mdi:door-open" : "mdi:door-closed";
    }

    if (deviceClass === "window") {
      return stateKey === "open" ? "mdi:window-open-variant" : "mdi:window-closed-variant";
    }
  }

  if (domain === "person") {
    switch (stateKey) {
      case "home":
      case "casa":
      case "en_casa":
        return "mdi:home-account";
      case "not_home":
      case "away":
      case "fuera":
        return "mdi:account-arrow-right";
      default:
        return "mdi:account";
    }
  }

  if (domain === "camera") {
    return "mdi:video";
  }

  if (domain === "climate") {
    if (stateKey === "off") {
      return "mdi:thermostat-off";
    }
    return "mdi:thermostat";
  }

  if (domain === "media_player") {
    if (["off", "idle", "standby"].includes(stateKey)) {
      return "mdi:speaker-off";
    }
    return "mdi:speaker";
  }

  if (domain === "humidifier") {
    return stateKey === "on" ? "mdi:air-humidifier" : "mdi:air-humidifier-off";
  }

  if (domain === "vacuum") {
    return "mdi:robot-vacuum";
  }

  if (domain === "alarm_control_panel") {
    switch (stateKey) {
      case "disarmed":
        return "mdi:shield-off-outline";
      case "armed_home":
        return "mdi:home-lock";
      case "armed_away":
        return "mdi:shield-lock";
      case "armed_night":
        return "mdi:weather-night";
      case "armed_vacation":
        return "mdi:palm-tree";
      case "armed_custom_bypass":
        return "mdi:tune-variant";
      case "triggered":
        return "mdi:alarm-light";
      default:
        return "mdi:shield-outline";
    }
  }

  if (domain === "automation") {
    return stateKey === "on" ? "mdi:robot" : "mdi:robot-off";
  }

  if (domain === "script") {
    return "mdi:script-text-outline";
  }

  if (domain === "scene") {
    return "mdi:palette-outline";
  }

  if (domain === "input_boolean") {
    return stateKey === "on" ? "mdi:check-circle" : "mdi:circle-off-outline";
  }

  if (domain === "sensor") {
    switch (deviceClass) {
      case "temperature":
        return "mdi:thermometer";
      case "humidity":
        return "mdi:water-percent";
      case "power":
        return "mdi:flash";
      case "current":
        return "mdi:current-ac";
      case "voltage":
        return "mdi:sine-wave";
      case "energy":
        return "mdi:lightning-bolt";
      case "battery":
        return "mdi:battery";
      case "signal_strength":
        return "mdi:wifi";
      case "pressure":
        return "mdi:gauge";
      case "illuminance":
        return "mdi:brightness-6";
      case "moisture":
        return "mdi:water";
      case "aqi":
        return "mdi:air-filter";
      case "speed":
        return "mdi:speedometer";
      case "distance":
        return "mdi:map-marker-distance";
      case "gas":
        return "mdi:meter-gas";
      case "water":
        return "mdi:water";
      default:
        return "";
    }
  }

  return "";
}
