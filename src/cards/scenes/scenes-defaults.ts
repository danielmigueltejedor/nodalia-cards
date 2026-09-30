import { DEFAULT_SCENE_ACCENT, SCENE_LAUNCH_DURATION } from "./scenes-constants";
export const DEFAULT_CONFIG = {
  name: "",
  language: "auto",
  scenes: [],
  layout: "grid",
  columns: 3,
  show_title: true,
  use_entity_icon: true,
  use_entity_picture: false,
  tap_action: "activate",
  hold_action: "more-info",
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    content_duration: 420,
    button_bounce_duration: 320,
    launch_duration: SCENE_LAUNCH_DURATION,
  },
  styles: {
    accent: DEFAULT_SCENE_ACCENT,
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "var(--nodalia-card-border-radius, 28px)",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "14px",
      gap: "12px",
    },
    button: {
      min_height: "88px",
      border_radius: "22px",
      gap: "8px",
      icon_size: "24px",
      label_size: "12px",
      background: "",
      border: "",
    },
    icon: {
      size: "44px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      on_color: DEFAULT_SCENE_ACCENT,
    },
    chip_border_radius: "999px",
    title_size: "15px",
  },
};

