// @ts-nocheck -- merged Lovelace YAML is projected into the runtime news config.
import { APPEARANCE_PRESETS, DENSITY_MODES, LAYOUT_MODES } from "./news-constants";
import { deepClone, isObject, mergeConfig } from "./news-runtime";

export const DEFAULT_CONFIG = {
  title: "",
  entity: "",
  language: "auto",
  max_items: 5,
  remember_items: true,
  storage_key: "",
  history_helper: "",
  mirror_history_local: true,
  sources: [],
  layout: {
    mode: "magazine",
    density: "normal",
    show_images: true,
    show_summary: true,
    show_source: true,
    show_time: true,
    show_category: true,
  },
  filters: {
    hide_older_than: "",
    max_per_source: 0,
    include_keywords: [],
    exclude_keywords: [],
  },
  appearance: {
    preset: "glass",
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "var(--nodalia-card-border-radius, 28px)",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "16px",
      gap: "14px",
    },
    headline_size: "clamp(1.35rem, 2.4vw, 1.85rem)",
    body_size: "0.92rem",
    meta_size: "0.78rem",
    chip_border_radius: "999px",
  },
};

export const STUB_CONFIG = {
  title: "News",
  layout: { mode: "magazine" },
  sources: [],
};

export function normalizeConfig(rawConfig) {
  const merged = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const layout = isObject(merged.layout) ? merged.layout : {};
  merged.layout = {
    ...DEFAULT_CONFIG.layout,
    ...layout,
    mode: LAYOUT_MODES.has(String(layout.mode || "").trim())
      ? String(layout.mode).trim()
      : DEFAULT_CONFIG.layout.mode,
    density: DENSITY_MODES.has(String(layout.density || "").trim())
      ? String(layout.density).trim()
      : DEFAULT_CONFIG.layout.density,
    show_images: layout.show_images !== false,
    show_summary: layout.show_summary !== false,
    show_source: layout.show_source !== false,
    show_time: layout.show_time !== false,
    show_category: layout.show_category !== false,
  };
  const filters = isObject(merged.filters) ? merged.filters : {};
  merged.filters = {
    hide_older_than: String(filters.hide_older_than ?? "").trim(),
    max_per_source: Math.max(0, Number(filters.max_per_source) || 0),
    include_keywords: Array.isArray(filters.include_keywords) ? filters.include_keywords.map(String) : [],
    exclude_keywords: Array.isArray(filters.exclude_keywords) ? filters.exclude_keywords.map(String) : [],
  };
  const appearance = isObject(merged.appearance) ? merged.appearance : {};
  merged.appearance = {
    preset: APPEARANCE_PRESETS.has(String(appearance.preset || "").trim())
      ? String(appearance.preset).trim()
      : DEFAULT_CONFIG.appearance.preset,
  };
  merged.max_items = Math.max(1, Math.min(50, Number(merged.max_items) || DEFAULT_CONFIG.max_items));
  merged.remember_items = merged.remember_items !== false;
  merged.storage_key = String(merged.storage_key ?? "").trim();
  merged.history_helper = String(merged.history_helper ?? merged.history_entity ?? "").trim();
  merged.mirror_history_local = merged.mirror_history_local !== false;
  merged.title = String(merged.title ?? "").trim();
  merged.entity = String(merged.entity ?? "").trim();
  merged.language = String(merged.language ?? "auto").trim() || "auto";
  merged.sources = Array.isArray(merged.sources)
    ? merged.sources.map(entry => ({
      entity: String(entry?.entity ?? entry?.entity_id ?? "").trim(),
      name: String(entry?.name ?? "").trim(),
      icon: String(entry?.icon ?? "").trim(),
      category: String(entry?.category ?? "").trim(),
    })).filter(entry => entry.entity)
    : [];
  merged.styles = window.NodaliaUtils?.sanitizeStyleTree?.(merged.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);
  return merged;
}
