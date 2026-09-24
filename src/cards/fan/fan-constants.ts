export const CARD_TAG = "nodalia-fan-card";
export const EDITOR_TAG = "nodalia-fan-card-editor";
export const CARD_VERSION = "2.3.0-alpha.36";
export const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
export const COMPACT_LAYOUT_THRESHOLD = 150;
export const OPTIMISTIC_TOGGLE_TIMEOUT = 3200;
export const OPTIMISTIC_VISUAL_SETTLE_MS = 420;
export const FAN_MEMORY_STORAGE_KEY = "nodalia-fan-card:last-visual-state:v1";
export const ALLOWED_DOUBLE_TAP_ACTIONS = new Set(["auto", "toggle", "more-info", "service", "navigate", "url", "none"]);

export const CIRCULAR_LAYOUT_DIAL_START_ANGLE = 135;
export const CIRCULAR_LAYOUT_DIAL_END_ANGLE = 405;
export const CIRCULAR_LAYOUT_DIAL_SWEEP = CIRCULAR_LAYOUT_DIAL_END_ANGLE - CIRCULAR_LAYOUT_DIAL_START_ANGLE;

export const LEGACY_ICON_OFF_COLOR_VALUES = [
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
];
