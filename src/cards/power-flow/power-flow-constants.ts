export const CARD_TAG = "nodalia-power-flow-card";
export const EDITOR_TAG = "nodalia-power-flow-card-editor";
export const CARD_VERSION = "2.3.0-alpha.45";
export const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};

export const NODE_DEFAULTS = {
  grid: {
    name: "Grid",
    icon: "mdi:transmission-tower",
    color: "#6da8ff",
    export_color: "#44d07b",
    export_entity: "",
    export_when_negative: true,
    entity: "",
    secondary_info: {},
  },
  home: {
    name: "Home",
    icon: "mdi:home",
    color: "#ffffff",
    entity: "",
    secondary_info: {},
  },
  solar: {
    name: "Solar",
    icon: "mdi:solar-power-variant",
    color: "#f6b73c",
    entity: "",
    secondary_info: {},
  },
  battery: {
    name: "Battery",
    icon: "mdi:battery",
    color: "#61c97a",
    entity: "",
    secondary_info: {},
  },
  water: {
    name: "Water",
    icon: "mdi:water",
    color: "#55b7ff",
    entity: "",
    secondary_info: {},
  },
  gas: {
    name: "Gas",
    icon: "mdi:fire",
    color: "#f28a5d",
    entity: "",
    secondary_info: {},
  },
};
