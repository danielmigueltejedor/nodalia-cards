// @ts-nocheck -- merged Lovelace YAML is projected into the runtime player config.
import { normalizePresentationMode } from "./media-player-layout";
import { deepClone, isObject, mergeConfig } from "./media-player-runtime";
import type {
  MediaPlayerArtworkConfig,
  MediaPlayerIdleArtworkConfig,
  MediaPlayerProgressConfig,
} from "./media-player-types";

export const DEFAULT_CONFIG = {
  title: "",
  entity: "",
  players: [],
  show: true,
  show_state: false,
  show_device_chip: true,
  album_cover_background: true,
  show_unavailable_badge: true,
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    panel_duration: 700,
    browser_duration: 760,
    button_bounce_duration: 320,
  },
  security: {
    // Custom actions configured in the visual editor must work out of the box.
    // Users can still opt into an allowlist by enabling strict mode explicitly.
    strict_service_actions: false,
    allowed_services: [],
    allowed_service_domains: [],
  },
  layout: {
    mode: "auto",
    fixed: false,
    reserve_space: false,
    reserve_height: "220px",
    position: "bottom",
    show_desktop: true,
    mobile_breakpoint: 1279,
    z_index: 3,
    side_margin: "12px",
    offset: "12px",
    max_width: "min(100%, 560px)",
  },
  artwork: {
    mode: "immersive",
    blur: 6,
    dim: 0.22,
    saturation: 1.05,
    opacity: 1,
    dynamic_colors: true,
    crossfade: true,
    crossfade_duration: 500,
  },
  progress: {
    show: true,
    draggable: true,
  },
  idle_artwork: {
    enabled: true,
    slideshow: true,
    interval: 15,
    animation: "subtle",
    max_items: 8,
  },
  styles: {
    player: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "var(--nodalia-card-border-radius, 28px)",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "14px",
      min_height: "160px",
      artwork_size: "62px",
      tv_artwork_size: "68px",
      control_size: "36px",
      title_size: "15px",
      subtitle_size: "12px",
      slider_wrap_height: "48px",
      slider_height: "14px",
      slider_thumb_size: "24px",
      progress_color: "var(--primary-color)",
      progress_background: "rgba(var(--rgb-primary-color), 0.14)",
      overlay_color: "rgba(0, 0, 0, 0.32)",
      dot_size: "8px",
      active_tint_color: "var(--info-color, #71c0ff)",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(var(--rgb-primary-color), 0.18)",
    },
    browser: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "var(--nodalia-card-border-radius, 28px)",
      box_shadow: "0 18px 40px rgba(0, 0, 0, 0.22)",
      backdrop: "rgba(0, 0, 0, 0.18)",
    },
  },
};

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function normalizeArtworkConfig(raw: unknown): MediaPlayerArtworkConfig {
  const source = isObject(raw) ? raw : {};
  const modeValue = String(source.mode || "").trim().toLowerCase();
  const mode = modeValue === "blur" || modeValue === "off" || modeValue === "immersive"
    ? modeValue
    : DEFAULT_CONFIG.artwork.mode;
  return {
    mode,
    blur: clampNumber(source.blur, DEFAULT_CONFIG.artwork.blur, 0, 48),
    dim: clampNumber(source.dim, DEFAULT_CONFIG.artwork.dim, 0, 0.85),
    saturation: clampNumber(source.saturation, DEFAULT_CONFIG.artwork.saturation, 0.4, 1.6),
    opacity: clampNumber(source.opacity, DEFAULT_CONFIG.artwork.opacity, 0.15, 1),
    dynamic_colors: source.dynamic_colors !== false,
    crossfade: source.crossfade !== false,
    crossfade_duration: clampNumber(source.crossfade_duration, DEFAULT_CONFIG.artwork.crossfade_duration, 0, 2000),
  };
}

function normalizeProgressConfig(raw: unknown): MediaPlayerProgressConfig {
  const source = isObject(raw) ? raw : {};
  return {
    show: source.show !== false,
    draggable: source.draggable !== false,
  };
}

function normalizeIdleArtworkConfig(raw: unknown): MediaPlayerIdleArtworkConfig {
  const source = isObject(raw) ? raw : {};
  const animation = String(source.animation || "").trim().toLowerCase() === "none" ? "none" : "subtle";
  return {
    enabled: source.enabled !== false,
    slideshow: source.slideshow !== false,
    interval: clampNumber(source.interval, DEFAULT_CONFIG.idle_artwork.interval, 4, 120),
    animation,
    max_items: Math.round(clampNumber(source.max_items, DEFAULT_CONFIG.idle_artwork.max_items, 2, 16)),
  };
}

function normalizePowerActionConfig(action: unknown) {
  if (!isObject(action)) {
    return { action: "default" };
  }
  const next = { ...action };
  if (!next.action) {
    next.action = "default";
  }
  return next;
}

export function normalizeConfig(rawConfig?: unknown) {
  const raw = isObject(rawConfig) ? rawConfig : {};
  const layoutOverride = typeof raw.layout === "string"
    ? { mode: normalizePresentationMode(raw.layout) }
    : raw.layout;
  const config = mergeConfig(DEFAULT_CONFIG, {
    ...raw,
    layout: layoutOverride,
  });
  const mediaConfig = isObject(raw.media_player) ? raw.media_player : null;

  if (mediaConfig) {
    if (mediaConfig.show !== undefined) {
      config.show = mediaConfig.show;
    }
    if (mediaConfig.show_state !== undefined) {
      config.show_state = mediaConfig.show_state;
    }
    if (mediaConfig.album_cover_background !== undefined) {
      config.album_cover_background = mediaConfig.album_cover_background;
    }
    if (mediaConfig.show_unavailable_badge !== undefined) {
      config.show_unavailable_badge = mediaConfig.show_unavailable_badge;
    }
    if (mediaConfig.show_desktop !== undefined) {
      config.layout.show_desktop = mediaConfig.show_desktop;
    }
    if (Array.isArray(mediaConfig.players) && mediaConfig.players.length > 0 && (!Array.isArray(raw.players) || raw.players.length === 0)) {
      config.players = deepClone(mediaConfig.players);
    }
  }

  if (
    (!Array.isArray(config.players) || config.players.length === 0) &&
    typeof config.entity === "string" &&
    config.entity
  ) {
    config.players = [
      {
        entity: config.entity,
        label: config.label,
        name: config.name,
        title: config.player_title,
        subtitle: config.subtitle,
        icon: config.icon,
        image: config.image,
        tv_mode: config.tv_mode,
        browse_path: config.browse_path,
        tap_action: config.tap_action,
        power_action_off: config.power_action_off,
        power_action_on: config.power_action_on,
        power_action_unavailable: config.power_action_unavailable,
      },
    ];
  }

  config.players = Array.isArray(config.players) ? config.players.filter(player => isObject(player)) : [];
  config.players = config.players.map(player => ({
    ...player,
    power_action_off: normalizePowerActionConfig(player.power_action_off),
    power_action_on: normalizePowerActionConfig(player.power_action_on),
    power_action_unavailable: normalizePowerActionConfig(player.power_action_unavailable),
  }));
  config.layout.position = config.layout.position === "top" ? "top" : "bottom";
  config.layout.mode = normalizePresentationMode(config.layout.mode);
  config.artwork = normalizeArtworkConfig(config.artwork);
  config.progress = normalizeProgressConfig(config.progress);
  config.idle_artwork = normalizeIdleArtworkConfig(config.idle_artwork);
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? { ...DEFAULT_CONFIG.security, ...(isObject(config.security) ? config.security : {}) };

  return config;
}
