import { normalizeControlStyles } from "../../shared/control-config";
import { isObject, mergeConfig } from "./advance-vacuum-runtime";
import { normalizeCustomMenuItems, normalizeRoutineItems } from "./advance-vacuum-helpers";

import { DEFAULT_CONFIG } from "./advance-vacuum-defaults";
export { DEFAULT_CONFIG } from "./advance-vacuum-defaults";

export const STUB_CONFIG = {
  entity: "vacuum.roborock_qrevo_s",
  name: "Roborock Qrevo S",
  vacuum_platform: "auto",
};

export function normalizeConfig(rawConfig: unknown = {}) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const menu = mergeConfig(DEFAULT_CONFIG.custom_menu, config.custom_menu || {});
  const tracking = mergeConfig(DEFAULT_CONFIG.room_tracking, config.room_tracking || {});
  const room_tracking = {
    ...tracking,
    entity: String(tracking.entity ?? "").trim(),
    attribute: String(tracking.attribute ?? "").trim(),
    activity_entity: String(tracking.activity_entity ?? "").trim(),
    auto_detect: tracking.auto_detect !== false,
  };
  const custom_menu:Record<string,unknown>&{items:ReturnType<typeof normalizeCustomMenuItems>} = { ...menu, items: normalizeCustomMenuItems(menu.items) };
  const security = {
    ...DEFAULT_CONFIG.security,
    ...(isObject(config.security) ? config.security : {}),
    allow_webhooks_for_non_admin: config.security && isObject(config.security) ? config.security.allow_webhooks_for_non_admin === true : DEFAULT_CONFIG.security.allow_webhooks_for_non_admin,
  };
  const fields = {
    ...config,
    language: typeof config.language === "string" ? config.language : "auto",
    styles: normalizeControlStyles(config.styles, DEFAULT_CONFIG.styles),
    entity: String(config.entity ?? "").trim(),
    name: String(config.name ?? "").trim(),
    custom_menu, room_tracking, security,
    vacuum_platform: String(config.vacuum_platform || "auto").trim() || "auto",
    vacuum_mqtt_topic: String(config.vacuum_mqtt_topic ?? "").trim().replace(/\/+$/, ""),
    routines: normalizeRoutineItems(config.routines),
    shared_cleaning_session_webhook: String(config.shared_cleaning_session_webhook ?? "").trim(),
  };
  const normalized: typeof fields & Record<string, unknown> = fields;
  return normalized;
}
