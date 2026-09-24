export const CARD_TAG = "nodalia-advance-vacuum-card";
export const EDITOR_TAG = "nodalia-advance-vacuum-card-editor";
export const CARD_VERSION = "2.3.0-alpha.46";
/** Sentinel for `_lastSubmittedSharedCleaningSessionValue` when serialized session exceeds helper max length. */
export const SHARED_CLEANING_SESSION_OVERFLOW_SENTINEL = "__NODALIA_SHARED_SESSION_OVERFLOW__";
export const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
export const CLEANING_SESSION_PENDING_TIMEOUT_MS = 45000;
/** Home Assistant `VacuumEntityFeature.CLEAN_AREA`; keep in sync with vacuum/const.py. */
export const VACUUM_FEATURE_CLEAN_AREA = 16384;
/** English seeds when i18n is not loaded yet (avoid stuck Spanish on first paint). */
export const MODE_LABELS = {
  all: "All",
  rooms: "Rooms",
  zone: "Zone",
  routines: "Routines",
  goto: "Go to point",
};

export const PANEL_MODE_PRESETS = [
  { id: "smart", label: "Smart", icon: "mdi:brain" },
  { id: "vacuum_mop", label: "Vacuum & mop", icon: "mdi:robot-vacuum-variant" },
  { id: "vacuum", label: "Vacuum", icon: "mdi:weather-windy" },
  { id: "mop", label: "Mop", icon: "mdi:water" },
  { id: "custom", label: "Custom", icon: "mdi:tune-variant" },
];

export const DOCK_PANEL_SECTIONS = [
  { id: "control", label: "Dock controls", icon: "mdi:home-import-outline" },
  { id: "settings", label: "Dock settings", icon: "mdi:cog-outline" },
];

export const DOCK_SETTING_DEFINITIONS = [
  {
    id: "mop_wash_frequency",
    label: "Mop wash frequency",
    entity_ids: ["input_select.frecuencia_lavado_mopa"],
    patterns: ["mop_wash_frequency", "wash_frequency", "washing_frequency", "frecuencia_lavado", "mop_wash"],
  },
  {
    id: "mop_mode",
    label: "Mopping mode",
    entity_ids: ["input_select.modo_de_fregado"],
    patterns: ["modo_de_fregado", "mop_mode", "wash_mode", "dock_mop_mode", "washing_mode"],
  },
  {
    id: "auto_empty_frequency",
    label: "Auto-empty frequency",
    patterns: ["auto_empty_frequency", "empty_frequency", "dust_collection_frequency", "frecuencia_vaciado", "frecuencia_vaciado_automatico"],
  },
  {
    id: "empty_mode",
    label: "Emptying mode",
    entity_ids: ["input_select.modo_de_vaciado"],
    patterns: ["empty_mode", "dock_dust_collection_mode", "dust_collection_mode", "modo_vaciado"],
  },
  {
    id: "drying_duration",
    label: "Drying duration",
    entity_ids: ["input_select.duracion_del_secado_de_la_mopa"],
    patterns: ["drying_duration", "dry_duration", "mop_dry_duration", "duracion_secado", "drying_time", "duracion_del_secado_de_la_mopa"],
  },
];

export const DOCK_CONTROL_DEFINITIONS = [
  {
    id: "empty",
    label: "Empty bin",
    active_label: "Stop emptying",
    icon: "mdi:delete-empty-outline",
    active_icon: "mdi:stop-circle-outline",
    entity_ids: ["input_boolean.vaciar_deposito"],
    start_patterns: [
      "start_emptying",
      "start_empty",
      "start_dust_collection",
      "dust_collection",
      "collect_dust",
      "dock_empty",
      "auto_empty",
      "empty_dock",
    ],
    stop_patterns: [
      "stop_emptying",
      "stop_empty",
      "stop_dust_collection",
      "stop_collect_dust",
      "end_emptying",
    ],
  },
  {
    id: "wash",
    label: "Wash mop",
    active_label: "Stop mop wash",
    icon: "mdi:water",
    active_icon: "mdi:stop-circle-outline",
    entity_ids: ["input_boolean.lavar_mopa"],
    start_patterns: [
      "start_wash",
      "start_washing",
      "start_wash_mop",
      "wash_mop",
      "mop_wash",
      "clean_mop",
      "clean_mopping_pad",
      "self_clean",
    ],
    stop_patterns: [
      "stop_wash",
      "stop_washing",
      "stop_wash_mop",
      "stop_mop_wash",
      "stop_clean_mop",
      "stop_self_clean",
    ],
  },
  {
    id: "dry",
    label: "Dry mop",
    active_label: "Stop drying",
    icon: "mdi:white-balance-sunny",
    active_icon: "mdi:stop-circle-outline",
    entity_ids: ["input_boolean.secado_de_mopa"],
    start_patterns: [
      "start_dry",
      "start_drying",
      "start_dry_mop",
      "mop_dry",
      "dry_mop",
      "air_dry",
      "drying",
    ],
    stop_patterns: [
      "stop_dry",
      "stop_drying",
      "stop_dry_mop",
      "stop_mop_dry",
      "stop_air_dry",
    ],
  },
];

export const SUCTION_MODE_PATTERNS = [
  "quiet",
  "silent",
  "balanced",
  "standard",
  "normal",
  "turbo",
  "max",
  "strong",
  "gentle",
  "suction",
  "vacuum",
  "carpet",
];

export const MOP_MODE_PATTERNS = [
  "mop",
  "water",
  "scrub",
  "wet",
  "off",
  "deep",
  "soak",
  "rinse",
];

export const SHARED_SMART_MODE_PATTERNS = [
  "smart",
  "intelligent",
  "inteligente",
];
export const VACUUM_MOP_COMBO_PATTERNS = [
  "vacuum_mop",
  "vacuum_and_mop",
  "mop_and_vacuum",
  "vacuum_mopping",
  "sweep_and_mop",
  "aspirado_y_fregado",
  "aspirar_y_fregar",
  "aspirado_fregado",
  "aspirar_fregar",
];
export const VACUUM_ONLY_COMBO_PATTERNS = [
  "vacuum_only",
  "only_vacuum",
  "solo_aspirado",
  "solo_aspirar",
  "solo_aspiracion",
  "aspirado_solo",
  "vacuum",
  "sweep_only",
  "sweep",
];
export const MOP_ONLY_COMBO_PATTERNS = [
  "mop_only",
  "only_mop",
  "solo_fregado",
  "solo_fregar",
  "fregado_solo",
  "mop",
  "mopping",
  "fregado",
  "fregar",
  "scrub_only",
  "wash_only",
];

export const VACUUM_MODE_LABELS = {
  quiet: "Quiet",
  silent: "Quiet",
  balanced: "Balanced",
  standard: "Standard",
  normal: "Normal",
  turbo: "Turbo",
  max: "Max",
  maxplus: "Max+",
  max_plus: "Max+",
  gentle: "Gentle",
  strong: "Strong",
  smart: "Smart",
  smartmode: "Smart",
  smart_mode: "Smart",
  intelligent: "Smart",
  custom: "Custom",
  custommode: "Custom",
  custom_mode: "Custom",
  custom_water_flow: "Custom water flow",
  custom_watter_flow: "Custom water flow",
  off: "Mop off",
  low: "Low",
  medium: "Medium",
  high: "High",
  intense: "Intense",
  deep: "Deep",
  deep_plus: "Deep+",
  deepplus: "Deep+",
  fast: "Fast",
  rapido: "Fast",
};
