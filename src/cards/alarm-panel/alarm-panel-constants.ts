export const CARD_TAG = "nodalia-alarm-panel-card";
export const EDITOR_TAG = "nodalia-alarm-panel-card-editor";
export const CARD_VERSION = "2.3.0-alpha.46";
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
/** If entity state is still unchanged after arming/disarming with a code, show "wrong code" (slow cloud/RF integrations need more than ~1.5s). */
export const FEATURE_ARM_HOME = 1;
export const FEATURE_ARM_AWAY = 2;
export const FEATURE_ARM_NIGHT = 4;
export const FEATURE_TRIGGER = 8;
export const FEATURE_ARM_CUSTOM_BYPASS = 16;
export const FEATURE_ARM_VACATION = 32;
export const ALARM_STATE_TINT_FALLBACKS = Object.freeze({
  disarmed: "#82d18a",
  armed_home: "#74c0ff",
  armed_away: "#8aa7ff",
  armed_night: "#9488ff",
  armed_vacation: "#5fd7cf",
  armed_custom_bypass: "#64d4a6",
  armed: "#8aa7ff",
  arming: "#71c0ff",
  disarming: "#8de4ff",
  pending: "#f2c46d",
  triggered: "#ff7474",
});
