export const CARD_TAG = "nodalia-cover-card";
export const EDITOR_TAG = "nodalia-cover-card-editor";
export const CARD_VERSION = "2.3.0-alpha.29";
export const COVER_CONTROLS_TOGGLE_LANE_MAX_COLUMNS = 6;
export const COVER_CONTROLS_TOGGLE_LANE_MAX_WIDTH = 620;
export const COMPACT_LAYOUT_THRESHOLD = 150;

export const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};

export const COVER_FEATURES = {
  OPEN: 1,
  CLOSE: 2,
  SET_POSITION: 4,
  STOP: 8,
  OPEN_TILT: 16,
  CLOSE_TILT: 32,
  STOP_TILT: 64,
  SET_TILT_POSITION: 128,
};

export const CIRCULAR_LAYOUT_DIAL_START_ANGLE = 135;
export const CIRCULAR_LAYOUT_DIAL_END_ANGLE = 405;
export const CIRCULAR_LAYOUT_DIAL_SWEEP = CIRCULAR_LAYOUT_DIAL_END_ANGLE - CIRCULAR_LAYOUT_DIAL_START_ANGLE;
