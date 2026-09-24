export const CARD_TAG = "nodalia-light-card";
export const EDITOR_TAG = "nodalia-light-card-editor";
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
export const OPTIMISTIC_TURN_ON_TIMEOUT = 3200;
export const OPTIMISTIC_TURN_OFF_TIMEOUT = 3200;
export const OPTIMISTIC_VISUAL_SETTLE_MS = 420;
export const LIGHT_MEMORY_STORAGE_KEY = "nodalia-light-card:last-visual-state:v1";
export const COLOR_PRESETS = [
  { color: "#ffd166", hs: [42, 60], label: "Warm" },
  { color: "#fff1c1", hs: [48, 18], label: "Soft" },
  { color: "#ff7f50", hs: [16, 72], label: "Sunset" },
  { color: "#ff4d6d", hs: [348, 70], label: "Pink" },
  { color: "#4dabf7", hs: [210, 70], label: "Blue" },
  { color: "#38d9a9", hs: [160, 68], label: "Mint" },
];

export const LEGACY_ICON_OFF_COLOR_VALUES = [
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
];
