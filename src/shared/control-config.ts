import type { CardActionFieldKeys } from "../core/types/nodalia-utils";

/** These cards' style defaults contain only CSS strings and nested CSS groups. */
interface CssDefaults { [key: string]: string | CssDefaults }
type CssValues<T extends CssDefaults> = {
  [Key in keyof T]: T[Key] extends CssDefaults ? CssValues<T[Key]> : string;
};

export function normalizeControlStyles<T extends CssDefaults>(candidate: unknown, defaults: T, sanitize: (value: unknown, fallback: string) => string = window.NodaliaUtils.sanitizeCssValue): CssValues<T> {
  const utils = window.NodaliaUtils;
  const source = utils.isObject(candidate) ? candidate : {};
  const result: Record<string, unknown> = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    if (utils.isUnsafeConfigPathKey(key)) continue;
    result[key] = typeof fallback === "string"
      ? sanitize(source[key], fallback)
      : normalizeControlStyles(source[key], fallback, sanitize);
  }
  // Every default key has been reconstructed above; leaves are sanitized strings.
  return result as CssValues<T>;
}

export function normalizeControlList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return values.map(item => String(item || "").trim()).filter(Boolean);
}

export function migrateControlIconOffColor(iconStyles: unknown, canonicalOffColor: string): void {
  if (!window.NodaliaUtils.isObject(iconStyles)) return;
  const raw = String(iconStyles.off_color ?? "").trim();
  if (/^var\(\s*--state-inactive-color/i.test(raw)) iconStyles.off_color = canonicalOffColor;
}

type ActionFields = CardActionFieldKeys & { fallback: string };
const actionFields = (prefix: string, fallback: string, navigationKey = `${prefix}_navigation_path`): ActionFields => ({
  actionKey: `${prefix}_action`, serviceKey: `${prefix}_service`, serviceDataKey: `${prefix}_service_data`,
  serviceTargetKey: `${prefix}_service_target`, urlKey: `${prefix}_url`, navigationKey,
  newTabKey: `${prefix}_new_tab`, fallback,
});
const FIELDS = [
  actionFields("tap", "toggle", "navigation_path"), actionFields("icon_tap", "", "icon_navigation_path"),
  actionFields("hold", "more-info", "hold_navigation_path"), actionFields("icon_hold", ""),
  actionFields("double_tap", "none"), actionFields("icon_double_tap", ""),
];
const ALLOWED_ACTIONS = new Set(["auto", "toggle", "more-info", "service", "navigate", "url", "none"]);

/** Normalize the legacy flat fields and HA action objects without discarding YAML extensions. */
export function normalizeControlActions(config: Record<string, unknown>, rawConfig: unknown, doubleTap = false): void {
  const utils = window.NodaliaUtils;
  const source = utils.isObject(rawConfig) ? rawConfig : {};
  const serialize = (value: unknown): string => utils.isObject(value) ? JSON.stringify(value) : String(value ?? "").trim();
  for (const fields of doubleTap ? FIELDS : FIELDS.slice(0, 4)) {
    utils.applyCardTapActionField?.(config, fields, source[fields.actionKey] ?? config[fields.actionKey], fields.fallback);
    const action = String(config[fields.actionKey] ?? "").trim().toLowerCase();
    config[fields.actionKey] = ALLOWED_ACTIONS.has(action) ? action : fields.fallback;
    config[fields.serviceKey] = String(config[fields.serviceKey] ?? "").trim();
    config[fields.serviceDataKey] = serialize(config[fields.serviceDataKey]);
    config[fields.serviceTargetKey] = serialize(config[fields.serviceTargetKey]);
    config[fields.urlKey] = String(config[fields.urlKey] ?? "").trim();
    config[fields.navigationKey] = String(config[fields.navigationKey] ?? "").trim();
    config[fields.newTabKey] = config[fields.newTabKey] === true;
    if (config[fields.actionKey] === "navigate" && !config[fields.navigationKey] && config[fields.urlKey]) {
      config[fields.navigationKey] = config[fields.urlKey];
    }
  }
}
