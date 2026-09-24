export const CARD_TAG = "nodalia-circular-gauge-card";
export const EDITOR_TAG = "nodalia-circular-gauge-card-editor";
export const CARD_VERSION = "2.3.0-alpha.23";
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
export const DEFAULT_GAUGE_MIN_TINT_COLOR = "color-mix(in srgb, var(--primary-text-color) 24%, transparent)";
export const DEFAULT_GAUGE_MAX_TINT_COLOR = "#ff7d57";
export const GAUGE_TINT_SEGMENT_COUNT = 16;
export const GAUGE_SVG_FALLBACK_TINT_SCALE = [
  { offset: 0, channels: [126, 136, 146] },
  { offset: 0.28, channels: [113, 207, 120] },
  { offset: 0.52, channels: [217, 196, 90] },
  { offset: 0.76, channels: [245, 160, 61] },
  { offset: 1, channels: [255, 125, 87] },
];
