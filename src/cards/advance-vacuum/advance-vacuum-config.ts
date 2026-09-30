// @ts-nocheck -- merged Lovelace YAML is projected into the runtime advance-vacuum config.
import { isObject, mergeConfig } from "./advance-vacuum-runtime";
import { normalizeCustomMenuItems, normalizeRoutineItems } from "./advance-vacuum-helpers";

import { DEFAULT_CONFIG } from "./advance-vacuum-defaults";
export { DEFAULT_CONFIG } from "./advance-vacuum-defaults";

export const STUB_CONFIG = {
  entity: "vacuum.roborock_qrevo_s",
  name: "Roborock Qrevo S",
  vacuum_platform: "auto",
};

export function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  config.custom_menu = mergeConfig(DEFAULT_CONFIG.custom_menu, config.custom_menu || {});
  config.room_tracking = mergeConfig(DEFAULT_CONFIG.room_tracking, config.room_tracking || {});
  config.room_tracking.entity = String(config.room_tracking.entity ?? "").trim();
  config.room_tracking.attribute = String(config.room_tracking.attribute ?? "").trim();
  config.room_tracking.activity_entity = String(config.room_tracking.activity_entity ?? "").trim();
  config.room_tracking.auto_detect = config.room_tracking.auto_detect !== false;
  config.vacuum_platform = String(config.vacuum_platform || "auto").trim() || "auto";
  config.vacuum_mqtt_topic = String(config.vacuum_mqtt_topic ?? "").trim().replace(/\/+$/, "");
  config.custom_menu.items = normalizeCustomMenuItems(config.custom_menu.items);
  config.routines = normalizeRoutineItems(config.routines);
  config.shared_cleaning_session_webhook = String(config.shared_cleaning_session_webhook ?? "").trim();
  config.security = {
    ...DEFAULT_CONFIG.security,
    ...(isObject(config.security) ? config.security : {}),
  };
  if (config.security.allow_webhooks_for_non_admin === undefined) {
    config.security.allow_webhooks_for_non_admin = DEFAULT_CONFIG.security.allow_webhooks_for_non_admin;
  }
  config.security.allow_webhooks_for_non_admin = config.security.allow_webhooks_for_non_admin === true;
  return config;
}
