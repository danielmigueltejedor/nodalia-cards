export const CARD_TAG = "nodalia-entity-card";
export const EDITOR_TAG = "nodalia-entity-card-editor";
export const CARD_VERSION = "2.3.0-alpha.24";
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
export const COVER_SET_POSITION = 4;
export const LOCK_LOCK = 2;

export const LEGACY_ICON_OFF_COLOR_VALUES = [
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
];

export const AIR_QUALITY_METRIC_KEYS = [
  "pm1",
  "pm25",
  "pm4",
  "pm10",
  "tvoc",
  "co2",
  "temperature",
  "humidity",
];

export const AIR_QUALITY_GRAPH_SERIES_COLORS = Object.freeze({
  pm1: "#f29f05",
  pm25: "#42a5f5",
  pm4: "#7fd0c8",
  pm10: "#f56aa0",
  tvoc: "#b993ff",
  co2: "#7ad66f",
  temperature: "#d4783a",
  humidity: "#3f9d7a",
});

export const AIR_QUALITY_ATTR_ALIASES = {
  pm1: ["pm1", "pm_1", "pm1_0", "pm_1_0"],
  pm25: ["pm25", "pm2_5", "pm2.5", "pm_2_5", "particulate_matter_2_5"],
  pm4: ["pm4", "pm_4", "pm4_0", "pm_4_0"],
  pm10: ["pm10", "pm_10", "pm10_0", "particulate_matter_10"],
  tvoc: ["tvoc", "voc", "total_voc", "total_volatile_organic_compounds"],
  co2: ["co2", "carbon_dioxide", "co2_ppm"],
  temperature: ["temperature", "temp"],
  humidity: ["humidity", "relative_humidity"],
};

/** WHO AQG 2021 24h (+ interim targets) for PM; comfort/UBA-style bands for TVOC/CO2. */
export const AIR_QUALITY_WHO_BANDS = {
  pm1: [
    { max: 15, level: "good" },
    { max: 25, level: "moderate" },
    { max: 37.5, level: "unhealthy_sensitive" },
    { max: 50, level: "unhealthy" },
    { max: 75, level: "very_unhealthy" },
    { max: Infinity, level: "hazardous" },
  ],
  pm25: [
    { max: 15, level: "good" },
    { max: 25, level: "moderate" },
    { max: 37.5, level: "unhealthy_sensitive" },
    { max: 50, level: "unhealthy" },
    { max: 75, level: "very_unhealthy" },
    { max: Infinity, level: "hazardous" },
  ],
  pm4: [
    { max: 20, level: "good" },
    { max: 35, level: "moderate" },
    { max: 50, level: "unhealthy_sensitive" },
    { max: 70, level: "unhealthy" },
    { max: 100, level: "very_unhealthy" },
    { max: Infinity, level: "hazardous" },
  ],
  pm10: [
    { max: 45, level: "good" },
    { max: 50, level: "moderate" },
    { max: 75, level: "unhealthy_sensitive" },
    { max: 100, level: "unhealthy" },
    { max: 150, level: "very_unhealthy" },
    { max: Infinity, level: "hazardous" },
  ],
  tvoc_ugm3: [
    { max: 300, level: "good" },
    { max: 1000, level: "moderate" },
    { max: 3000, level: "unhealthy_sensitive" },
    { max: 10000, level: "unhealthy" },
    { max: 25000, level: "very_unhealthy" },
    { max: Infinity, level: "hazardous" },
  ],
  tvoc_ppb: [
    { max: 220, level: "good" },
    { max: 660, level: "moderate" },
    { max: 2200, level: "unhealthy_sensitive" },
    { max: 5500, level: "unhealthy" },
    { max: 11000, level: "very_unhealthy" },
    { max: Infinity, level: "hazardous" },
  ],
  co2: [
    { max: 800, level: "good" },
    { max: 1000, level: "moderate" },
    { max: 1500, level: "unhealthy_sensitive" },
    { max: 2000, level: "unhealthy" },
    { max: 5000, level: "very_unhealthy" },
    { max: Infinity, level: "hazardous" },
  ],
};

export const AIR_QUALITY_LEVEL_RANK = {
  good: 0,
  moderate: 1,
  unhealthy_sensitive: 2,
  unhealthy: 3,
  very_unhealthy: 4,
  hazardous: 5,
};

export const AIR_QUALITY_LEVEL_COLORS = {
  good: "#3f9d7a",
  moderate: "#c9a227",
  unhealthy_sensitive: "#d4783a",
  unhealthy: "#d4544c",
  very_unhealthy: "#a8324a",
  hazardous: "#6b2140",
  unknown: "var(--primary-text-color)",
};

export const AIR_QUALITY_POLLUTION_KEYS = new Set(["pm1", "pm25", "pm4", "pm10", "tvoc", "co2"]);

export const AIR_QUALITY_COMFORT_KEYS = new Set(["temperature", "humidity"]);
export const AIR_QUALITY_HISTORY_REFRESH_MS = 180000;
export const OVERVIEW_LAYOUTS = new Set(["battery", "network"]);
export const NETWORK_ROLES = new Set(["auto", "status", "download", "upload", "latency", "signal", "traffic"]);
