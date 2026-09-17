import type { HomeAssistant } from "../../core/types/home-assistant";

export type MediaPlayerPresentationMode =
  | "auto"
  | "standard"
  | "square"
  | "chip"
  | "compact"
  | "artwork";

export type MediaPlayerArtworkMode = "immersive" | "blur" | "off";
export type MediaPlayerIdleAnimation = "none" | "subtle";
export type MediaPlayerForeground = "light" | "dark";

export interface MediaPlayerArtworkConfig {
  mode: MediaPlayerArtworkMode;
  blur: number;
  dim: number;
  saturation: number;
  opacity: number;
  dynamic_colors: boolean;
  crossfade: boolean;
  crossfade_duration: number;
}

export interface MediaPlayerProgressConfig {
  show: boolean;
  draggable: boolean;
}

export interface MediaPlayerIdleArtworkConfig {
  enabled: boolean;
  slideshow: boolean;
  interval: number;
  animation: MediaPlayerIdleAnimation;
  max_items: number;
}

export interface MediaPlayerLayoutConfig {
  mode: MediaPlayerPresentationMode;
  fixed: boolean;
  reserve_space: boolean;
  reserve_height: string;
  position: "top" | "bottom";
  show_desktop: boolean;
  mobile_breakpoint: number;
  z_index: number;
  side_margin: string;
  offset: string;
  max_width: string;
}

export interface ArtworkPalette {
  primary: string;
  secondary?: string;
  foreground: MediaPlayerForeground;
}

export interface PlaybackProgress {
  duration: number;
  position: number;
  percent: number;
}

export interface MediaPlayerPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: (rawConfig?: unknown) => Record<string, unknown>;
  formatEditorJsonValue: (value: unknown) => string;
  parseEditorJsonObject: (value: unknown) => { valid: boolean; value?: unknown };
  resolvePresentationMode: (
    mode: unknown,
    size?: { width: number; height: number },
    current?: MediaPlayerPresentationMode | "",
  ) => Exclude<MediaPlayerPresentationMode, "auto">;
  interpolatePlaybackProgress: (state: unknown, now?: number) => PlaybackProgress | null;
  supportsMediaSeek: (state: unknown) => boolean;
  rememberRecentArtwork: (history: string[], url: string, maxItems?: number) => string[];
  extractArtworkPalette: (image: CanvasImageSource) => ArtworkPalette | null;
}

export type MediaPlayerHass = HomeAssistant | null;
