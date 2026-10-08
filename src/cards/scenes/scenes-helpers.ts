export { formatEditorHexChannel, resolveEditorColorValue, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import type { HassEntity, HomeAssistant } from "../../core/types/home-assistant";
import type { SceneRow, ScenesInput, SceneNormalizationOptions, DashboardScrollSnapshot } from "./scenes-types";
import { DEFAULT_SCENE_ACCENT } from "./scenes-constants";
import { deepClone, isObject, isUnsafeConfigPathKey, normalizeTextKey } from "./scenes-runtime";
import { DEFAULT_CONFIG } from "./scenes-defaults";

export function mergeConfig(base: unknown, override: unknown): unknown {
  if (window.NodaliaUtils?.mergeDeep) {
    return window.NodaliaUtils.mergeDeep(base, override || {});
  }
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override.map(item => deepClone(item)) : deepClone(base);
  }
  if (!isObject(base)) {
    return override === undefined ? base : override;
  }
  const result: Record<string, unknown> = {};
  const overrides = isObject(override) ? override : {};
  const keys = new Set([...Object.keys(base), ...Object.keys(overrides)]);
  keys.forEach(key => {
    if (isUnsafeConfigPathKey(key)) {
      return;
    }
    const baseValue = base[key];
    const overrideValue = overrides[key];
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

export function compactConfig(value: unknown): unknown {
  if (window.NodaliaUtils?.compactConfig) {
    return window.NodaliaUtils.compactConfig(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
  }
  if (isObject(value)) {
    const compacted: Record<string, unknown> = {};
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





export function moveItem<T>(list: T[], fromIndex: number, toIndex: number) {
  if (!Array.isArray(list) || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return;
  }
  const items = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, ...items);
}










export function getEditorColorFallbackValue(field: unknown) {
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

export function parseSizeToPixels(value: unknown, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}


export function isUnavailableState(state: HassEntity | null | undefined) {
  return normalizeTextKey(state?.state) === "unavailable";
}



export function collectDashboardScrollSnapshot(anchor: unknown): DashboardScrollSnapshot {
  const containers: DashboardScrollSnapshot["containers"] = [];
  const seen = new Set<HTMLElement>();
  const remember = (el: unknown) => {
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

export function restoreDashboardScrollSnapshot(snapshot: DashboardScrollSnapshot | null | undefined) {
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

export function scheduleDashboardScrollRestore(snapshot: DashboardScrollSnapshot | null | undefined) {
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

export function sanitizeCssValue(value: unknown, fallback: unknown) {
  // Multi-line YAML (> or |) yields line breaks; in CSS they are plain whitespace.
  const raw = String(value ?? "").replace(/[\t\n\f\r]+/g, " ").trim();
  const safeFallback = String(fallback ?? "").trim();
  if (!raw) {
    return safeFallback;
  }
  // Reject control characters intentionally at the CSS input boundary.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f<>;"'{}]/.test(raw) || raw.includes("/*") || raw.includes("*/")) {
    return safeFallback;
  }
  return raw;
}

export function getDefaultSceneAccent(styles: unknown = DEFAULT_CONFIG.styles) {
  const input = isObject(styles) ? styles : {};
  return sanitizeCssValue(input.accent, DEFAULT_SCENE_ACCENT) || DEFAULT_SCENE_ACCENT;
}

export function resolveSceneAccent(value: unknown, fallback = DEFAULT_SCENE_ACCENT) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }
  return sanitizeCssValue(raw, fallback) || fallback;
}


export function getSafeStyles(styles: unknown = DEFAULT_CONFIG.styles) {
  const input = isObject(styles) ? styles : {};
  const defaults = DEFAULT_CONFIG.styles;
  const card = isObject(input.card) ? input.card : {};
  const button = isObject(input.button) ? input.button : {};
  const icon = isObject(input.icon) ? input.icon : {};
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
    chip_border_radius: sanitizeCssValue(input.chip_border_radius, defaults.chip_border_radius),
    title_size: sanitizeCssValue(input.title_size, defaults.title_size),
  };
}

export function normalizeSceneRows(rawScenes: unknown, options: SceneNormalizationOptions = {}): SceneRow[] {
  const keepEmpty = options.keepEmpty === true;
  if (!Array.isArray(rawScenes)) {
    return [];
  }

  const rows = rawScenes
    .map((item: unknown) => {
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

export function getStubSceneEntities(hass: HomeAssistant | null | undefined, limit = 4, entities: unknown = [], entitiesFallback: unknown = []) {
  return window.NodaliaUtils
    .findStubEntityIds(hass, entities, entitiesFallback, ["scene"], limit)
    .map(entity => ({ entity }));
}

export function applyStubConfig(config: Record<string, unknown>, hass: HomeAssistant | null | undefined, entities: unknown = [], entitiesFallback: unknown = []) {
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

export function resolveSceneEntries(config: ScenesInput, hass: HomeAssistant | null | undefined) {
  const rows = Array.isArray(config?.scenes) ? config.scenes : [];
  const defaultAccent = getDefaultSceneAccent(config?.styles);
  return rows
    .map((raw: unknown, index: number) => {
      const item = isObject(raw) ? raw : {};
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
    .filter(item => item !== null);
}
