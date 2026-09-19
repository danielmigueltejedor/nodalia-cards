import type { LovelaceActionName } from "../../core/types/actions";
import type { HassEntity } from "../../core/types/home-assistant";

export type ClimateLayout = "circular" | "compact";
export type ClimateWeekStartsOn = "monday" | "sunday";
export type ClimateMainTemperature = "target" | "current";

export interface ClimateSecurityConfig {
  allow_webhooks_for_non_admin: boolean;
  strict_service_actions: boolean;
  allowed_services: string[];
  allowed_service_domains: string[];
}

export interface ClimateHapticsConfig {
  enabled: boolean;
  style: string;
  fallback_vibrate: boolean;
  scrolls: {
    temperature_dial: boolean;
  };
}

export interface ClimateAnimationsConfig {
  enabled: boolean;
  dial_duration: number;
  button_bounce_duration: number;
  content_duration: number;
}

export interface ClimateIconStyle {
  size: string;
  background: string;
  color: string;
  on_color: string;
  off_color: string;
}

export interface ClimateDialStyle {
  size: string;
  max_size: string;
  stroke: string;
  thumb_size: string;
  track_color: string;
  background: string;
  heat_color: string;
  cool_color: string;
  dry_color: string;
  auto_color: string;
  fan_color: string;
  off_color: string;
}

export interface ClimateControlStyle {
  size: string;
  accent_background: string;
  accent_color: string;
}

export interface ClimateStyleConfig {
  card: {
    background: string;
    border: string;
    border_radius: string;
    box_shadow: string;
    padding: string;
    gap: string;
  };
  icon: ClimateIconStyle;
  chip_height: string;
  chip_font_size: string;
  chip_padding: string;
  chip_border_radius: string;
  title_size: string;
  current_size: string;
  target_size: string;
  dial: ClimateDialStyle;
  control: ClimateControlStyle;
  step_control: {
    size: string;
  };
}

export interface ClimateConfig {
  entity: string;
  name: string;
  layout: ClimateLayout;
  icon: string;
  entity_picture: string;
  show_entity_picture: boolean;
  show_state_chip: boolean;
  show_current_temperature_chip: boolean;
  show_humidity_chip: boolean;
  show_mode_buttons: boolean;
  show_step_controls: boolean;
  show_schedule_button: boolean;
  show_unavailable_badge: boolean;
  setpoint_schedule_webhook: string;
  setpoint_schedule_helper: string;
  setpoint_schedule_week_starts_on: ClimateWeekStartsOn;
  security: ClimateSecurityConfig;
  tap_action: LovelaceActionName;
  hold_action: LovelaceActionName;
  double_tap_action: LovelaceActionName;
  display: {
    main_temperature: ClimateMainTemperature;
  };
  haptics: ClimateHapticsConfig;
  animations: ClimateAnimationsConfig;
  styles: ClimateStyleConfig;
  [key: string]: unknown;
}

export type ClimateDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface ClimateScheduleSlot {
  id: string;
  day: ClimateDay | string;
  start: string;
  end: string;
  temperature: number;
  enabled: boolean;
  hvac_mode?: string;
  fan_mode?: string;
  preset_mode?: string;
  target_temp_low?: number;
  target_temp_high?: number;
}

export interface ClimateSetpointSchedule {
  enabled: boolean;
  slots: ClimateScheduleSlot[];
}

export interface ClimateModeMeta {
  label: string;
  icon: string;
  accent: string;
}

export interface ClimatePublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: ClimateConfig;
  normalizeConfig: (rawConfig?: unknown) => ClimateConfig;
  parseScheduleClockMinutes: (value: unknown) => number | null;
  encodeSetpointScheduleStorageState: (schedule: ClimateSetpointSchedule | unknown) => string;
  decodeSetpointScheduleStorageState: (rawState: unknown) => ClimateSetpointSchedule;
  isSetpointScheduleStorageStateWithinLimit: (storageState: unknown) => boolean;
}

export type ClimateHassState = HassEntity | null;
