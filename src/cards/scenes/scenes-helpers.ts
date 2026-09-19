// @ts-nocheck -- scene, scroll and color helpers stay loosely typed until remaining unknowns are narrowed.
import { DEFAULT_SCENE_ACCENT } from "./scenes-constants";
import { clamp, deepClone, isObject, isUnsafeConfigPathKey, normalizeTextKey } from "./scenes-runtime";
import { DEFAULT_CONFIG } from "./scenes-config";

export function mergeConfig(base, override) {
  if (window.NodaliaUtils?.mergeDeep) {
    return window.NodaliaUtils.mergeDeep(base, override || {});
  }
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override.map(item => deepClone(item)) : deepClone(base);
  }
  if (!isObject(base)) {
    return override === undefined ? base : override;
  }
  const result = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(override || {})]);
  keys.forEach(key => {
    if (isUnsafeConfigPathKey(key)) {
      return;
    }
    const baseValue = base[key];
    const overrideValue = override ? override[key] : undefined;
    if (overrideValue === undefined) {
      result[key] = deepClone(baseValue);
      return;
    }
    if (Array.isArray(overrideValue)) {
      result[key] = deepClone(overrideValue);
      return;
    }
    if (isObject(baseValue) && isObject(overrideValue)) {
      result[key] = mergeConfig(baseValue, overrideValue);
      return;
    }
    result[key] = overrideValue;
  });
  return result;
}

export function compactConfig(value) {
  if (window.NodaliaUtils?.compactConfig) {
    return window.NodaliaUtils.compactConfig(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
  }
  if (isObject(value)) {
    const compacted = {};
    Object.entries(value).forEach(([key, item]) => {
      if (isUnsafeConfigPathKey(key)) {
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





export function moveItem(list, fromIndex, toIndex) {
  if (!Array.isArray(list) || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return;
  }
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
}


export function formatEditorHexChannel(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

export function resolveEditorColorValue(value) {
  const resolver = window.NodaliaBubbleContrast?.resolveEditorColorValue;
  if (typeof resolver === "function") {
    return resolver(value);
  }
  return String(value ?? "").trim();
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
  const normalized = String(field || "");
  if (normalized.endsWith("icon.on_color") || normalized.endsWith("styles.accent") || normalized.endsWith(".color")) {
    return DEFAULT_SCENE_ACCENT;
  }
  if (normalized.endsWith("icon.color")) {
    return DEFAULT_CONFIG.styles.icon.color;
  }
  if (normalized.endsWith("icon.background")) {
    return DEFAULT_CONFIG.styles.icon.background;
  }
  if (normalized.endsWith("button.background")) {
    return "color-mix(in srgb, var(--primary-text-color) 5%, transparent)";
  }
  if (normalized.endsWith("card.background")) {
    return DEFAULT_CONFIG.styles.card.background;
  }
  return DEFAULT_CONFIG.styles.icon.on_color;
}

export function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}


export function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}



export function collectDashboardScrollSnapshot(anchor) {
  const containers = [];
  const seen = new Set();
  const remember = el => {
    if (!(el instanceof HTMLElement) || seen.has(el)) {
      return;
    }
    seen.add(el);
    containers.push({
      el,
      left: el.scrollLeft,
      top: el.scrollTop,
    });
  };

  let node = anchor instanceof HTMLElement ? anchor : null;
  while (node) {
    const style = getComputedStyle(node);
    if (
      (/(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) ||
      (/(auto|scroll|overlay)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1)
    ) {
      remember(node);
    }
    node = node.parentElement;
  }

  if (typeof document !== "undefined") {
    remember(document.scrollingElement || document.documentElement);
    try {
      const homeAssistant = document.querySelector("home-assistant");
      const huiRoot = homeAssistant?.shadowRoot?.querySelector("hui-root");
      remember(huiRoot?.shadowRoot?.querySelector("#view"));
      remember(
        homeAssistant
          ?.shadowRoot
          ?.querySelector("partial-panel-resolver")
          ?.shadowRoot
          ?.querySelector("ha-panel-lovelace")
          ?.shadowRoot
          ?.querySelector("hui-view"),
      );
    } catch (_error) {
      // Ignore closed shadow roots.
    }
  }

  return {
    containers,
    winX: typeof window !== "undefined" ? window.scrollX : 0,
    winY: typeof window !== "undefined" ? window.scrollY : 0,
  };
}

export function restoreDashboardScrollSnapshot(snapshot) {
  if (!snapshot?.containers?.length) {
    return;
  }
  snapshot.containers.forEach(({ el, left, top }) => {
    if (!(el instanceof HTMLElement) || !el.isConnected) {
      return;
    }
    if (el.scrollTop !== top) {
      el.scrollTop = top;
    }
    if (el.scrollLeft !== left) {
      el.scrollLeft = left;
    }
  });
  if (typeof window !== "undefined") {
    window.scrollTo(snapshot.winX, snapshot.winY);
  }
}

let dashboardScrollRestoreGeneration = 0;

export function scheduleDashboardScrollRestore(snapshot) {
  if (!snapshot?.containers?.length || typeof window === "undefined") {
    return () => {};
  }

  const generation = dashboardScrollRestoreGeneration + 1;
  dashboardScrollRestoreGeneration = generation;
  const restore = () => {
    if (generation !== dashboardScrollRestoreGeneration) {
      return;
    }
    restoreDashboardScrollSnapshot(snapshot);
  };

  restore();
  window.requestAnimationFrame(() => {
    restore();
    window.requestAnimationFrame(restore);
  });
  const timeoutA = window.setTimeout(restore, 0);
  const timeoutB = window.setTimeout(restore, 48);

  return () => {
    if (generation === dashboardScrollRestoreGeneration) {
      dashboardScrollRestoreGeneration += 1;
    }
    window.clearTimeout(timeoutA);
    window.clearTimeout(timeoutB);
  };
}

export function cancelDashboardScrollRestore() {
  dashboardScrollRestoreGeneration += 1;
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

export function getDefaultSceneAccent(styles = DEFAULT_CONFIG.styles) {
  return sanitizeCssValue(styles?.accent, DEFAULT_SCENE_ACCENT) || DEFAULT_SCENE_ACCENT;
}

export function resolveSceneAccent(value, fallback = DEFAULT_SCENE_ACCENT) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }
  return sanitizeCssValue(raw, fallback) || fallback;
}


export function getSafeStyles(styles = DEFAULT_CONFIG.styles) {
  const defaults = DEFAULT_CONFIG.styles;
  const card = styles?.card || {};
  const button = styles?.button || {};
  const icon = styles?.icon || {};
  return {
    accent: getDefaultSceneAccent(styles),
    card: {
      background: sanitizeCssValue(card.background, defaults.card.background),
      border: sanitizeCssValue(card.border, defaults.card.border),
      border_radius: sanitizeCssValue(card.border_radius, defaults.card.border_radius),
      box_shadow: sanitizeCssValue(card.box_shadow, defaults.card.box_shadow),
      gap: sanitizeCssValue(card.gap, defaults.card.gap),
      padding: sanitizeCssValue(card.padding, defaults.card.padding),
    },
    button: {
      background: sanitizeCssValue(button.background, defaults.button.background),
      border: sanitizeCssValue(button.border, defaults.button.border),
      border_radius: sanitizeCssValue(button.border_radius, defaults.button.border_radius),
      gap: sanitizeCssValue(button.gap, defaults.button.gap),
      icon_size: sanitizeCssValue(button.icon_size, defaults.button.icon_size),
      label_size: sanitizeCssValue(button.label_size, defaults.button.label_size),
      min_height: sanitizeCssValue(button.min_height, defaults.button.min_height),
    },
    icon: {
      background: sanitizeCssValue(icon.background, defaults.icon.background),
      color: sanitizeCssValue(icon.color, defaults.icon.color),
      on_color: sanitizeCssValue(icon.on_color, defaults.icon.on_color),
      size: sanitizeCssValue(icon.size, defaults.icon.size),
    },
    chip_border_radius: sanitizeCssValue(styles?.chip_border_radius, defaults.chip_border_radius),
    title_size: sanitizeCssValue(styles?.title_size, defaults.title_size),
  };
}

export function normalizeSceneRows(rawScenes, options = {}) {
  const keepEmpty = options.keepEmpty === true;
  if (!Array.isArray(rawScenes)) {
    return [];
  }

  const rows = rawScenes
    .map(item => {
      if (typeof item === "string") {
        return { entity: String(item).trim(), name: "", icon: "", color: "" };
      }
      if (!isObject(item)) {
        return null;
      }
      return {
        entity: String(item.entity || "").trim(),
        name: String(item.name || "").trim(),
        icon: String(item.icon || "").trim(),
        color: String(item.color || "").trim(),
      };
    })
    .filter(item => item !== null);

  return keepEmpty ? rows : rows.filter(item => item.entity);
}

export function getStubSceneEntities(hass, limit = 4, entities = [], entitiesFallback = []) {
  return window.NodaliaUtils
    .findStubEntityIds(hass, entities, entitiesFallback, ["scene"], limit)
    .map(entity => ({ entity }));
}

export function applyStubConfig(config, hass, entities = [], entitiesFallback = []) {
  const next = deepClone(config);
  const scenes = getStubSceneEntities(hass, 4, entities, entitiesFallback);
  if (scenes.length) {
    next.scenes = scenes;
  }
  if (!String(next.name || "").trim()) {
    next.name = "Scenes";
  }
  return next;
}

export function resolveSceneEntries(config, hass) {
  const rows = Array.isArray(config?.scenes) ? config.scenes : [];
  const defaultAccent = getDefaultSceneAccent(config?.styles);
  return rows
    .map((item, index) => {
      const entity = String(item?.entity || "").trim();
      if (!entity.startsWith("scene.")) {
        return null;
      }
      const state = hass?.states?.[entity];
      const friendly =
        window.NodaliaUtils?.getEntityFriendlyName?.(hass, entity)
        || state?.attributes?.friendly_name
        || entity.split(".")[1]?.replace(/_/g, " ")
        || entity;
      const label = String(item?.name || "").trim() || friendly;
      let icon = String(item?.icon || "").trim();
      if (!icon && config.use_entity_icon !== false) {
        icon = String(state?.attributes?.icon || "").trim() || "mdi:palette-outline";
      }
      if (!icon) {
        icon = "mdi:palette-outline";
      }
      const picture =
        config.use_entity_picture === true
          ? String(state?.attributes?.entity_picture || "").trim()
          : "";
      const accent = resolveSceneAccent(item?.color, defaultAccent);
      return {
        entity,
        label,
        icon,
        picture,
        accent,
        index,
        unavailable: !state || isUnavailableState(state),
      };
    })
    .filter(Boolean);
}
