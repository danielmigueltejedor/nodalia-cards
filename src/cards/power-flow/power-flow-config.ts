import { normalizeControlStyles } from "../../shared/control-config";
import { deepClone, isObject, mergeConfig } from "./power-flow-runtime";
import { sanitizeIndividualEntries } from "./power-flow-helpers";

import { DEFAULT_CONFIG } from "./power-flow-defaults";
export { DEFAULT_CONFIG } from "./power-flow-defaults";

export const STUB_CONFIG = {
  title: "Energy",
  entities: {
    grid: {
      entity: "sensor.shelly_pro_3em_puerto_c_potencia",
    },
    home: {
      entity: "sensor.shelly_pro_3em_puerto_c_potencia",
    },
    solar: {
      entity: "",
    },
    battery: {
      entity: "",
    },
    individual: [],
  },
  dashboard_link: "/energy/overview",
};

export function normalizeConfig(rawConfig: unknown = {}) {
  const merged = mergeConfig<Record<string, unknown>>(DEFAULT_CONFIG, isObject(rawConfig) ? rawConfig : {});
  const entities: Record<string, unknown> = { ...deepClone(DEFAULT_CONFIG.entities), ...(isObject(merged.entities) ? merged.entities : {}) };
  const entityFields = { individual: sanitizeIndividualEntries({ entities }) };
  const normalizedEntities: typeof entityFields & Record<string, unknown> = { ...entities, ...entityFields };
  const chips = { ...DEFAULT_CONFIG.consumption_chips, ...(isObject(merged.consumption_chips) ? merged.consumption_chips : {}) };
  const consumptionChips = { ...chips, day_entity: String(chips.day_entity ?? "").trim(), month_entity: String(chips.month_entity ?? "").trim(), day_label: String(chips.day_label ?? "").trim(), month_label: String(chips.month_label ?? "").trim() };
  merged.show_home_device_popup = merged.show_home_device_popup !== false;
  merged.styles = window.NodaliaUtils?.sanitizeStyleTree?.(merged.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);
  const fields = { entities: normalizedEntities, consumption_chips: consumptionChips,
    entity: typeof merged.entity === "string" ? merged.entity : "",
    language: typeof merged.language === "string" ? merged.language : "auto",
    styles: normalizeControlStyles(merged.styles, DEFAULT_CONFIG.styles) };
  const normalized: typeof fields & Record<string, unknown> = { ...merged, ...fields };
  return normalized;
}
