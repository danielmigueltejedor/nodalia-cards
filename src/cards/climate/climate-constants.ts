export const CARD_TAG = "nodalia-climate-card";
export const EDITOR_TAG = "nodalia-climate-card-editor";
export const CARD_VERSION = "2.3.0-alpha.24";
export const SETPOINT_SCHEDULE_DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const SETPOINT_SCHEDULE_DAY_TO_JS = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};
export const SETPOINT_SCHEDULE_MINUTES_PER_DAY = 24 * 60;
export const SCHEDULE_TIMELINE_SNAP_MINUTES = 5;
export const SCHEDULE_MIN_BLOCK_MINUTES = 15;
/** Pixels before a block press counts as drag (vs tap-to-select). */
export const SCHEDULE_BLOCK_DRAG_THRESHOLD_PX = 6;
export const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
export const DIAL_START_ANGLE = 135;
export const DIAL_END_ANGLE = 405;
export const DIAL_SWEEP = DIAL_END_ANGLE - DIAL_START_ANGLE;
export const DIAL_VIEWBOX_SIZE = 240;
export const DIAL_CIRCLE_RADIUS = 86;
export const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_CIRCLE_RADIUS;
export const DIAL_VISIBLE_LENGTH = DIAL_CIRCUMFERENCE * (DIAL_SWEEP / 360);
export const DIAL_HIDDEN_LENGTH = DIAL_CIRCUMFERENCE - DIAL_VISIBLE_LENGTH;
/** Pixels of pointer movement before a range-thumb interaction counts as a drag (vs tap-to-select). */
export const RANGE_THUMB_DRAG_THRESHOLD_PX = 8;
export const STEP_BUTTON_COMMIT_DEBOUNCE = 160;
export const DRAFT_CONFIRMATION_TIMEOUT = 4200;
export const DRAFT_CONFIRMATION_RETRY_LIMIT = 1;

export const ENGINE_OVERRIDE_HOLD_HOURS = 2;
export const ENGINE_OVERRIDE_REFRESH_MS = 30_000;

export const LEGACY_CLIMATE_ICON_OFF_COLORS = [
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
];
export const LEGACY_CLIMATE_DIAL_OFF_COLOR = "rgba(255, 255, 255, 0.28)";
/** Older default: arc matched flat card bg and disappeared on accent-tinted dial. */
export const LEGACY_CLIMATE_DIAL_TRACK_COLOR = "color-mix(in srgb, var(--primary-text-color) 24%, var(--ha-card-background))";
export const LEGACY_CLIMATE_DIAL_BACKGROUND = "color-mix(in srgb, var(--primary-text-color) 2%, transparent)";
