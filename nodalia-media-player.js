const CARD_TAG = "nodalia-media-player";
const EDITOR_TAG = "nodalia-media-player-editor";
const CARD_VERSION = "0.6.0";
const MEDIA_PLAYER_FEATURE_BROWSE_MEDIA = 2048;
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
const MUSIC_ASSISTANT_BROWSER_EXCLUDE_PATTERNS = [
  "ai generated",
  "ai-generated",
  "image",
  "image upload",
  "generated images",
  "camera",
  "cameras",
  "dlna",
  "dlna server",
  "dlna servers",
  "frigate",
  "my media",
  "text to speech",
  "tts",
  "xbox game media",
  "xbox",
  "imagenes generadas",
  "images",
  "imagenes",
];
const MUSIC_ASSISTANT_DIRECTORY_ICON_RULES = [
  { patterns: ["artists", "artistas"], icon: "mdi:account-music" },
  { patterns: ["albums", "albumes", "álbumes"], icon: "mdi:album" },
  { patterns: ["tracks", "songs", "canciones", "temas", "pistas"], icon: "mdi:music-note" },
  { patterns: ["playlists", "listas", "listas de reproduccion", "listas de reproducción"], icon: "mdi:playlist-music" },
  { patterns: ["radio stations", "radios", "emisoras", "stations"], icon: "mdi:radio" },
  { patterns: ["podcasts"], icon: "mdi:podcast" },
  { patterns: ["audiobooks", "audiolibros"], icon: "mdi:book-music" },
  { patterns: ["genres", "generos", "géneros"], icon: "mdi:shape" },
  { patterns: ["favorites", "favourites", "favoritos"], icon: "mdi:heart" },
  { patterns: ["recent", "recently", "recientes"], icon: "mdi:history" },
  { patterns: ["search", "buscar", "busqueda", "búsqueda"], icon: "mdi:magnify" },
];
const MUSIC_ASSISTANT_LABEL_TRANSLATIONS = {
  artist: "Artistas",
  artists: "Artistas",
  album: "Álbumes",
  albums: "Álbumes",
  track: "Canciones",
  tracks: "Canciones",
  song: "Canciones",
  songs: "Canciones",
  playlist: "Listas de reproducción",
  playlists: "Listas de reproducción",
  "radio station": "Emisoras",
  "radio stations": "Emisoras",
  podcast: "Podcasts",
  podcasts: "Podcasts",
  audiobook: "Audiolibros",
  audiobooks: "Audiolibros",
  genre: "Géneros",
  genres: "Géneros",
  favorite: "Favoritos",
  favorites: "Favoritos",
  favourites: "Favoritos",
  search: "Buscar",
  "recently played": "Reproducido recientemente",
  "recently added": "Añadido recientemente",
  "recently played tracks": "Canciones reproducidas recientemente",
};

const DEFAULT_CONFIG = {
  title: "",
  entity: "",
  players: [],
  show: true,
  show_state: false,
  album_cover_background: true,
  show_unavailable_badge: true,
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  layout: {
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
  styles: {
    player: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "28px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "14px",
      min_height: "160px",
      artwork_size: "72px",
      tv_artwork_size: "64px",
      control_size: "34px",
      title_size: "15px",
      subtitle_size: "12px",
      slider_wrap_height: "48px",
      slider_height: "14px",
      slider_thumb_size: "24px",
      progress_color: "var(--primary-color)",
      progress_background: "rgba(var(--rgb-primary-color), 0.14)",
      overlay_color: "rgba(0, 0, 0, 0.32)",
      dot_size: "7px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(var(--rgb-primary-color), 0.18)",
    },
    browser: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "28px",
      box_shadow: "0 18px 40px rgba(0, 0, 0, 0.22)",
      backdrop: "rgba(0, 0, 0, 0.18)",
    },
  },
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}

function mergeConfig(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override.map(item => deepClone(item)) : deepClone(base);
  }

  if (!isObject(base)) {
    return override === undefined ? base : override;
  }

  const result = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(override || {})]);

  keys.forEach(key => {
    const baseValue = base[key];
    const overrideValue = override ? override[key] : undefined;

    if (overrideValue === undefined) {
      result[key] = deepClone(baseValue);
      return;
    }

    if (Array.isArray(overrideValue)) {
      result[key] = deepClone(overrideValue);
      return;
    }

    if (isObject(baseValue) && isObject(overrideValue)) {
      result[key] = mergeConfig(baseValue, overrideValue);
      return;
    }

    result[key] = overrideValue;
  });

  return result;
}

function compactConfig(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => compactConfig(item))
      .filter(item => item !== undefined);
  }

  if (isObject(value)) {
    const compacted = {};

    Object.entries(value).forEach(([key, item]) => {
      const cleaned = compactConfig(item);
      const isEmptyObject = isObject(cleaned) && Object.keys(cleaned).length === 0;

      if (cleaned !== undefined && !isEmptyObject) {
        compacted[key] = cleaned;
      }
    });

    return compacted;
  }

  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  return value;
}

function normalizePowerActionConfig(action) {
  if (!isObject(action)) {
    return undefined;
  }

  const normalized = compactConfig(deepClone(action));

  if (!isObject(normalized)) {
    return undefined;
  }

  const actionType = String(normalized.action || "").trim();

  if (!actionType || actionType === "default") {
    return undefined;
  }

  // Older editor builds seeded "none" by default, which made power no-op.
  // Treat that exact minimal shape as "use default power behavior".
  if (actionType === "none" && Object.keys(normalized).length === 1) {
    return undefined;
  }

  normalized.action = actionType;
  return normalized;
}

function setByPath(target, path, value) {
  const parts = path.split(".");
  let cursor = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(cursor[key]) && !Array.isArray(cursor[key])) {
      cursor[key] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    }
    cursor = cursor[key];
  }

  cursor[parts[parts.length - 1]] = value;
}

function getByPath(target, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((cursor, key) => (cursor == null ? undefined : cursor[key]), target);
}

function deleteByPath(target, path) {
  const parts = path.split(".");
  let cursor = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(cursor[key]) && !Array.isArray(cursor[key])) {
      return;
    }
    cursor = cursor[key];
  }

  delete cursor[parts[parts.length - 1]];
}

function arrayFromCsv(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function escapeSelectorValue(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value).replaceAll('"', '\\"');
}

function resolveEditorColorValue(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue || typeof document === "undefined") {
    return "";
  }

  const probe = document.createElement("span");
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.color = "";
  probe.style.color = rawValue;
  if (!probe.style.color) {
    return rawValue;
  }

  (document.body || document.documentElement).appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || rawValue;
}

function formatEditorHexChannel(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function formatEditorColorFromHex(hex, alpha = 1) {
  const normalizedHex = String(hex ?? "").trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(normalizedHex)) {
    return String(hex ?? "");
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  const safeAlpha = clamp(Number(alpha), 0, 1);
  if (safeAlpha >= 0.999) {
    return `#${normalizedHex}`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${Number(safeAlpha.toFixed(2))})`;
}

function getEditorColorModel(value, fallbackValue = "#71c0ff") {
  const sourceValue = String(value ?? "").trim() || String(fallbackValue ?? "").trim() || "#71c0ff";
  const resolvedValue = resolveEditorColorValue(sourceValue) || resolveEditorColorValue(fallbackValue) || "rgb(113, 192, 255)";
  const channels = resolvedValue.match(/[\d.]+/g) || [];
  const red = clamp(Math.round(Number(channels[0] ?? 113)), 0, 255);
  const green = clamp(Math.round(Number(channels[1] ?? 192)), 0, 255);
  const blue = clamp(Math.round(Number(channels[2] ?? 255)), 0, 255);
  const alpha = channels.length > 3 ? clamp(Number(channels[3]), 0, 1) : 1;
  const hex = `#${formatEditorHexChannel(red)}${formatEditorHexChannel(green)}${formatEditorHexChannel(blue)}`;

  return {
    alpha,
    hex,
    resolved: resolvedValue,
    source: sourceValue,
    value: formatEditorColorFromHex(hex, alpha),
  };
}

function getEditorColorFallbackValue(field) {
  const normalizedField = String(field ?? "");

  if (normalizedField.endsWith("off_color")) {
    return "var(--state-inactive-color, rgba(255, 255, 255, 0.5))";
  }

  if (normalizedField.endsWith("accent_background")) {
    return "rgba(113, 192, 255, 0.2)";
  }

  if (normalizedField.endsWith("progress_background")) {
    return "rgba(255, 255, 255, 0.12)";
  }

  if (normalizedField.endsWith("overlay_color")) {
    return "rgba(0, 0, 0, 0.32)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
}

function moveItem(array, fromIndex, toIndex) {
  if (!Array.isArray(array)) {
    return array;
  }

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= array.length ||
    toIndex >= array.length ||
    fromIndex === toIndex
  ) {
    return array;
  }

  const [item] = array.splice(fromIndex, 1);
  array.splice(toIndex, 0, item);
  return array;
}

function fireEvent(node, type, detail, options) {
  const event = new CustomEvent(type, {
    bubbles: options?.bubbles ?? true,
    cancelable: Boolean(options?.cancelable),
    composed: options?.composed ?? true,
    detail,
  });
  node.dispatchEvent(event);
  return event;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getRangeValueFromClientX(slider, clientX) {
  const rect = slider.getBoundingClientRect();
  if (!rect.width) {
    return Number(slider.value || 0);
  }

  const min = Number(slider.min || 0);
  const max = Number(slider.max || 100);
  const step = slider.step === "any" ? 0 : Number(slider.step || 1);
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  let nextValue = min + ((max - min) * ratio);

  if (Number.isFinite(step) && step > 0) {
    nextValue = min + (Math.round((nextValue - min) / step) * step);
  }

  return clamp(nextValue, min, max);
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function normalizeTextKey(value) {
  return String(value || "").trim().toLowerCase();
}

function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const mediaConfig = isObject(rawConfig?.media_player) ? rawConfig.media_player : null;

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
    if (Array.isArray(mediaConfig.players) && mediaConfig.players.length > 0 && (!Array.isArray(rawConfig?.players) || rawConfig.players.length === 0)) {
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

  config.players = Array.isArray(config.players) ? config.players.filter(player => player?.entity) : [];
  config.players = config.players.map(player => ({
    ...player,
    power_action_off: normalizePowerActionConfig(player.power_action_off),
    power_action_on: normalizePowerActionConfig(player.power_action_on),
    power_action_unavailable: normalizePowerActionConfig(player.power_action_unavailable),
  }));
  config.layout.position = config.layout.position === "top" ? "top" : "bottom";

  return config;
}

class NodaliaMediaPlayer extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig() {
    return {
      players: [
        {
          entity: "media_player.spotify",
          label: "Spotify",
        },
      ],
      layout: {
        fixed: false,
        reserve_space: false,
      },
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._mediaBrowserState = null;
    this._mediaBrowserScrollPositions = new Map();
    this._mediaBrowserRequestToken = 0;
    this._activePlayerIndex = 0;
    this._mediaTicker = null;
    this._lastRenderSignature = "";
    this._draftVolume = new Map();
    this._draftVolumeTimers = new Map();
    this._activeSliderDrag = null;
    this._pendingRenderAfterDrag = false;
    this._skipNextSliderChange = null;
    this._dragFrame = 0;
    this._pendingDragUpdate = null;
    this._volumeStepFallback = new Set();
    this._tvSourcePickerEntity = null;
    this._tvVolumePickerEntity = null;
    this._tvPanelScrollPositions = new Map();
    this._onResize = () => {
      if (this._activeSliderDrag) {
        this._pendingRenderAfterDrag = true;
        return;
      }
      this._render();
    };
    this._onWindowKeyDown = event => {
      if (event.key === "Escape" && this._mediaBrowserState) {
        event.preventDefault();
        this._closeMediaBrowser();
      }
    };
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowChange = this._onShadowChange.bind(this);
    this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
    this._onShadowMouseDown = this._onShadowMouseDown.bind(this);
    this._onShadowTouchStart = this._onShadowTouchStart.bind(this);
    this._onWindowPointerMove = this._onWindowPointerMove.bind(this);
    this._onWindowPointerUp = this._onWindowPointerUp.bind(this);
    this._onWindowMouseMove = this._onWindowMouseMove.bind(this);
    this._onWindowMouseUp = this._onWindowMouseUp.bind(this);
    this._onWindowTouchStartCapture = this._onWindowTouchStartCapture.bind(this);
    this._onWindowTouchMove = this._onWindowTouchMove.bind(this);
    this._onWindowTouchEnd = this._onWindowTouchEnd.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowChange);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown);
    this.shadowRoot.addEventListener("mousedown", this._onShadowMouseDown);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      this.shadowRoot.addEventListener("touchstart", this._onShadowTouchStart, { passive: false });
    }
  }

  connectedCallback() {
    window.addEventListener("resize", this._onResize);
    window.addEventListener("keydown", this._onWindowKeyDown);
    document.addEventListener("visibilitychange", this._onVisibilityChange);
    window.addEventListener("pointermove", this._onWindowPointerMove);
    window.addEventListener("pointerup", this._onWindowPointerUp);
    window.addEventListener("pointercancel", this._onWindowPointerUp);
    window.addEventListener("mousemove", this._onWindowMouseMove);
    window.addEventListener("mouseup", this._onWindowMouseUp);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      window.addEventListener("touchstart", this._onWindowTouchStartCapture, { passive: true, capture: true });
      window.addEventListener("touchmove", this._onWindowTouchMove, { passive: false });
      window.addEventListener("touchend", this._onWindowTouchEnd, { passive: false });
      window.addEventListener("touchcancel", this._onWindowTouchEnd, { passive: false });
    }
    this._render();
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("keydown", this._onWindowKeyDown);
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    window.removeEventListener("pointermove", this._onWindowPointerMove);
    window.removeEventListener("pointerup", this._onWindowPointerUp);
    window.removeEventListener("pointercancel", this._onWindowPointerUp);
    window.removeEventListener("mousemove", this._onWindowMouseMove);
    window.removeEventListener("mouseup", this._onWindowMouseUp);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      window.removeEventListener("touchstart", this._onWindowTouchStartCapture, true);
      window.removeEventListener("touchmove", this._onWindowTouchMove);
      window.removeEventListener("touchend", this._onWindowTouchEnd);
      window.removeEventListener("touchcancel", this._onWindowTouchEnd);
    }
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }
    this._pendingDragUpdate = null;
    if (this._mediaTicker) {
      window.clearInterval(this._mediaTicker);
      this._mediaTicker = null;
    }
    this._draftVolumeTimers.forEach(timerId => window.clearTimeout(timerId));
    this._draftVolumeTimers.clear();
  }

  setConfig(config) {
    this._config = normalizeConfig(config);
    this._lastRenderSignature = "";
    this._render();
  }

  set hass(hass) {
    const previousHass = this._hass;
    this._hass = hass;

    const nextSignature = this._getRenderSignature(hass);
    if (previousHass && nextSignature === this._lastRenderSignature) {
      return;
    }

    this._lastRenderSignature = nextSignature;

    if (this._activeSliderDrag) {
      this._pendingRenderAfterDrag = true;
      return;
    }

    this._render();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 2,
      min_columns: 3,
    };
  }

  _getTrackedEntities() {
    const configuredPlayers = Array.isArray(this._config?.players)
      ? this._config.players.map(player => player?.entity).filter(Boolean)
      : [];

    if (configuredPlayers.length) {
      return [...new Set(configuredPlayers)];
    }

    return this._config?.entity ? [this._config.entity] : [];
  }

  _getRenderSignature(hass = this._hass) {
    const states = hass?.states || {};
    const entities = this._getTrackedEntities();

    return entities
      .map(entityId => {
        const state = states[entityId];
        if (!state) {
          return `${entityId}::missing`;
        }

        const attrs = state.attributes || {};
        return [
          entityId,
          state.state || "",
          attrs.friendly_name || "",
          attrs.entity_picture || "",
          attrs.media_title || "",
          attrs.media_artist || "",
          attrs.media_series_title || "",
          attrs.media_album_name || "",
          attrs.app_name || "",
          attrs.source || "",
          attrs.media_channel || "",
          attrs.volume_level ?? "",
          attrs.media_duration ?? "",
          attrs.supported_features ?? "",
          Array.isArray(attrs.source_list) ? attrs.source_list.join("|") : "",
        ].join("::");
      })
      .join("||");
  }

  _isInEditMode() {
    const homeAssistantRoot = document.querySelector("body > home-assistant");

    const inEditDashboardMode = this.closest("hui-card-edit-mode") !== null;
    const inPreviewMode = this.closest("hui-card-preview") !== null || this.closest(".card > .preview") !== null;
    const inEditCardMode = Boolean(
      homeAssistantRoot?.shadowRoot
        ?.querySelector("hui-dialog-edit-card")
        ?.shadowRoot?.querySelector("ha-dialog"),
    );

    return inEditDashboardMode || inPreviewMode || inEditCardMode;
  }

  _shouldHideForScreen() {
    if (this._isInEditMode()) {
      return false;
    }

    if (this._config.layout.show_desktop) {
      return false;
    }

    return window.innerWidth > Number(this._config.layout.mobile_breakpoint || 1279);
  }

  _triggerHaptic(style = this._config?.haptics?.style) {
    if (!this._config?.haptics?.enabled) {
      return;
    }

    const hapticStyle = String(style || "medium");

    try {
      fireEvent(this, "haptic", hapticStyle);
    } catch (_error) {
      // Ignore event dispatch issues and try vibration fallback below.
    }

    if (
      !this._config.haptics.fallback_vibrate ||
      typeof navigator === "undefined" ||
      typeof navigator.vibrate !== "function"
    ) {
      return;
    }

    navigator.vibrate(HAPTIC_PATTERNS[hapticStyle] || HAPTIC_PATTERNS.selection);
  }

  _getConfiguredPlayers() {
    return Array.isArray(this._config?.players) ? this._config.players : [];
  }

  _findPlayerConfig(entityId) {
    return this._getConfiguredPlayers().find(player => player.entity === entityId) || null;
  }

  _shouldShowOnCurrentScreen() {
    if (this._isInEditMode()) {
      return true;
    }

    const isDesktop = window.innerWidth > Number(this._config.layout.mobile_breakpoint || 1279);
    return !isDesktop || this._config.layout.show_desktop;
  }

  _getVisiblePlayers() {
    if (this._config.show === false || !this._shouldShowOnCurrentScreen()) {
      return [];
    }

    return this._getConfiguredPlayers().filter(player => {
      if (!player?.entity || player.show === false) {
        return false;
      }

      const state = this._hass?.states?.[player.entity];
      if (!state) {
        return false;
      }

      if (this._config.show === true || player.show === true || this._isInEditMode()) {
        return true;
      }

      const visibleStates = Array.isArray(player.show_states) && player.show_states.length > 0
        ? player.show_states
        : ["playing", "paused"];

      return visibleStates.includes(state.state);
    });
  }

  _getReservedHeight(showPlayer) {
    if (!this._config.layout.reserve_space) {
      return "0px";
    }

    if (showPlayer) {
      return this._config.layout.reserve_height || this._config.styles.player.min_height;
    }

    return "0px";
  }

  _getPlayerLabel(player, state) {
    return player.label || player.name || state.attributes.friendly_name || player.entity;
  }

  _isAppleTvPlayer(player, state) {
    const candidates = [
      player?.entity,
      player?.label,
      player?.name,
      player?.title,
      state?.attributes?.friendly_name,
      state?.attributes?.app_name,
      state?.attributes?.source,
      state?.attributes?.device_class,
    ];

    return candidates.some(candidate => normalizeTextKey(candidate).includes("apple tv"));
  }

  _getPlayerDeviceType(player, state) {
    if (player?.tv_mode === true) {
      return "tv";
    }

    if (player?.tv_mode === false) {
      return "music";
    }

    if (player?.device_type === "music" || player?.device_type === "tv") {
      return player.device_type;
    }

    const deviceClass = normalizeTextKey(state?.attributes?.device_class);
    if (["tv", "receiver", "set_top_box"].includes(deviceClass)) {
      return "tv";
    }

    const haystack = normalizeTextKey([
      player?.entity,
      player?.label,
      player?.name,
      player?.title,
      player?.icon,
      state?.attributes?.friendly_name,
      state?.attributes?.app_name,
      state?.attributes?.source,
      state?.attributes?.media_content_type,
    ].filter(Boolean).join(" "));

    if (
      this._isAppleTvPlayer(player, state) ||
      haystack.includes("google tv") ||
      haystack.includes("android tv") ||
      haystack.includes("chromecast") ||
      haystack.includes("television") ||
      haystack.includes("televisor") ||
      /\btv\b/.test(haystack)
    ) {
      return "tv";
    }

    return "music";
  }

  _getPlayerFallbackIcon(player, state, deviceType) {
    if (player?.icon) {
      return player.icon;
    }

    if (deviceType === "tv") {
      return this._isAppleTvPlayer(player, state) ? "mdi:apple" : "mdi:television";
    }

    return "mdi:music";
  }

  _getPlayerTitle(player, state) {
    if (player.title) {
      return player.title;
    }

    return state.attributes.media_title || state.attributes.friendly_name || player.entity;
  }

  _getTvContentTitle(player, state) {
    if (player.title) {
      return player.title;
    }

    return (
      state?.attributes?.media_title ||
      state?.attributes?.media_series_title ||
      state?.attributes?.media_channel ||
      ""
    );
  }

  _getPlayerSubtitle(player, state) {
    if (player.subtitle) {
      return player.subtitle;
    }

    const fallbackState = this._config?.show_state === true
      ? this._getPlayerStateLabel(state.state)
      : "";

    return (
      state.attributes.media_artist ||
      state.attributes.media_series_title ||
      state.attributes.media_album_name ||
      state.attributes.app_name ||
      fallbackState
    );
  }

  _shouldShowTvArtwork(player, state) {
    const deviceType = this._getPlayerDeviceType(player, state);
    if (deviceType !== "tv") {
      return true;
    }

    const plexSignals = [
      state?.attributes?.source,
      state?.attributes?.app_name,
      state?.attributes?.media_channel,
      state?.attributes?.media_content_type,
    ]
      .filter(Boolean)
      .map(value => normalizeTextKey(value));

    return plexSignals.some(value => value.includes("plex"));
  }

  _getPlayerArtwork(player, state) {
    if (player.image) {
      return player.image;
    }

    if (!this._shouldShowTvArtwork(player, state)) {
      return null;
    }

    return state.attributes.entity_picture || null;
  }

  _getPlayerStateLabel(stateValue) {
    switch (stateValue) {
      case "on":
        return "Encendido";
      case "playing":
        return "Reproduciendo";
      case "paused":
        return "En pausa";
      case "buffering":
        return "Cargando";
      case "idle":
        return "En espera";
      case "off":
        return "Apagado";
      case "standby":
        return "Standby";
      case "unavailable":
        return "No disponible";
      default:
        return stateValue || "Desconocido";
    }
  }

  _isPlayerActive(state) {
    const stateKey = normalizeTextKey(state?.state);
    return !!stateKey && !["off", "standby", "unavailable", "unknown"].includes(stateKey);
  }

  _getPlayerProgress(state) {
    const duration = Number(state?.attributes?.media_duration || 0);

    if (!(duration > 0)) {
      return null;
    }

    let position = Number(state.attributes.media_position || 0);
    const updatedAt = state.attributes.media_position_updated_at;

    if (state.state === "playing" && updatedAt) {
      const updatedAtTime = new Date(updatedAt).getTime();

      if (!Number.isNaN(updatedAtTime)) {
        position += Math.max(0, (Date.now() - updatedAtTime) / 1000);
      }
    }

    position = clamp(position, 0, duration);

    return {
      duration,
      percent: clamp((position / duration) * 100, 0, 100),
      position,
    };
  }

  _getPlayerSourceLabel(state) {
    const sourceLabel =
      state.attributes.source ||
      state.attributes.app_name ||
      state.attributes.media_album_name ||
      state.attributes.media_channel;

    const sourceKey = normalizeTextKey(sourceLabel);

    if (!sourceKey || sourceKey.includes("music assistant")) {
      return null;
    }

    return sourceLabel;
  }

  _getPlayerSourceOptions(player, state) {
    if (player?.show_source_controls === false) {
      return [];
    }

    const sources = Array.isArray(state?.attributes?.source_list)
      ? state.attributes.source_list.filter(source => String(source || "").trim())
      : [];

    if (!sources.length) {
      return [];
    }

    const currentSource = String(state?.attributes?.source || "").trim();
    const orderedSources = [];

    if (currentSource && sources.includes(currentSource)) {
      orderedSources.push(currentSource);
    }

    sources.forEach(source => {
      if (!orderedSources.includes(source)) {
        orderedSources.push(source);
      }
    });

    const fallbackMaxSources = this._getPlayerDeviceType(player, state) === "tv" ? sources.length : 4;
    const maxSources = clamp(Number(player?.max_sources || fallbackMaxSources), 1, 32);
    return orderedSources.slice(0, maxSources);
  }

  _hasActiveMediaContent(state) {
    if (!state?.attributes) {
      return false;
    }

    return Boolean(
      state.attributes.media_title ||
      state.attributes.media_artist ||
      state.attributes.media_album_name ||
      state.attributes.media_series_title ||
      state.attributes.media_channel ||
      state.attributes.media_duration,
    );
  }

  _shouldUseIdleLayout(player, state) {
    if (!state) {
      return false;
    }

    if (player?.compact_when_idle === false) {
      return false;
    }

    if (this._hasActiveMediaContent(state)) {
      return false;
    }

    return ["idle", "off", "standby", "paused", "unknown", "unavailable"].includes(state.state);
  }

  _isMusicAssistantPlayer(player, state) {
    const candidates = [
      player?.entity,
      player?.label,
      player?.name,
      player?.title,
      state?.attributes?.friendly_name,
      state?.attributes?.source,
      state?.attributes?.app_name,
      state?.attributes?.media_channel,
      state?.attributes?.media_content_id,
    ];

    return candidates.some(candidate => normalizeTextKey(candidate).includes("music assistant"));
  }

  _getPlayerBrowsePath(player, state) {
    if (player?.browse_path) {
      return player.browse_path;
    }

    if (player?.media_browser_path) {
      return player.media_browser_path;
    }

    return this._isMusicAssistantPlayer(player, state) ? "/media-browser/browser" : "";
  }

  _supportsMediaBrowser(player, state) {
    if (player?.browse_path || player?.media_browser_path) {
      return true;
    }

    const supportedFeatures = Number(state?.attributes?.supported_features || 0);
    return Number.isFinite(supportedFeatures) && (supportedFeatures & MEDIA_PLAYER_FEATURE_BROWSE_MEDIA) !== 0;
  }

  _supportsVolumeControl(state) {
    return typeof state?.attributes?.volume_level === "number";
  }

  _getPlayerVolumePercent(entityId, state) {
    const draftValue = this._draftVolume.get(entityId);
    if (Number.isFinite(draftValue)) {
      return clamp(Number(draftValue), 0, 100);
    }

    return clamp(Math.round(Number(state?.attributes?.volume_level || 0) * 100), 0, 100);
  }

  _updatePlayerVolumePreview(entityId, value) {
    const slider = this.shadowRoot?.querySelector(
      `.media-player__volume-slider[data-entity="${escapeSelectorValue(entityId)}"]`,
    );
    const nextValue = clamp(Number(value), 0, 100);

    if (slider instanceof HTMLInputElement) {
      slider.style.setProperty("--media-volume", String(nextValue));
      slider.closest(".media-player__volume-slider-shell")?.style.setProperty("--media-volume", String(nextValue));
    }
  }

  _scheduleDraftVolumeClear(entityId, delay = 1400) {
    const existingTimer = this._draftVolumeTimers.get(entityId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    const timerId = window.setTimeout(() => {
      this._draftVolume.delete(entityId);
      this._draftVolumeTimers.delete(entityId);
      this._render();
    }, delay);

    this._draftVolumeTimers.set(entityId, timerId);
  }

  async _stepPlayerVolumeToTarget(entityId, targetPercent) {
    if (!this._hass || !entityId) {
      return;
    }

    const state = this._hass.states?.[entityId];
    const currentPercent = clamp(Math.round(Number(state?.attributes?.volume_level || 0) * 100), 0, 100);
    const delta = targetPercent - currentPercent;

    if (Math.abs(delta) < 3) {
      this._scheduleDraftVolumeClear(entityId, 800);
      return;
    }

    const service = delta > 0 ? "volume_up" : "volume_down";
    const stepCount = clamp(Math.round(Math.abs(delta) / 6), 1, 12);

    for (let index = 0; index < stepCount; index += 1) {
      try {
        await this._hass.callService("media_player", service, { entity_id: entityId });
      } catch (_error) {
        break;
      }

      await new Promise(resolve => window.setTimeout(resolve, 90));
    }

    this._scheduleDraftVolumeClear(entityId, 1800);
  }

  _commitPlayerVolume(entityId, value) {
    if (!this._hass || !entityId) {
      return;
    }

    const nextValue = clamp(Math.round(Number(value)), 0, 100);
    const state = this._hass.states?.[entityId];
    const player = this._findPlayerConfig(entityId) || { entity: entityId };
    const isTvPlayer = this._getPlayerDeviceType(player, state) === "tv";

    this._scheduleDraftVolumeClear(entityId);

    if (isTvPlayer) {
      this._volumeStepFallback.add(entityId);
      void this._stepPlayerVolumeToTarget(entityId, nextValue);
      return;
    }

    Promise.resolve(
      this._hass.callService("media_player", "volume_set", {
        entity_id: entityId,
        volume_level: clamp(nextValue / 100, 0, 1),
      }),
    ).catch(() => {
      if (!isTvPlayer) {
        return;
      }

      this._volumeStepFallback.add(entityId);
      void this._stepPlayerVolumeToTarget(entityId, nextValue);
    });
  }

  _getPlayerChips(player, state, progress, title, subtitle) {
    const chips = [];
    const seen = new Set();
    const titleKey = normalizeTextKey(title);
    const subtitleKey = normalizeTextKey(subtitle);

    const addChip = (label, tone = "default") => {
      const text = String(label || "").trim();
      if (!text) {
        return;
      }

      const key = normalizeTextKey(text);
      if (!key || key === titleKey || key === subtitleKey || seen.has(key)) {
        return;
      }

      seen.add(key);
      chips.push({ label: text, tone });
    };

    addChip(this._getPlayerSourceLabel(state), "source");

    if (progress) {
      addChip(`${formatDuration(progress.position)} / ${formatDuration(progress.duration)}`, "time");
    }

    return chips.slice(0, 4);
  }

  _getTvPlayerChips(player, state, progress, title, subtitle, sourceOptions = []) {
    const chips = [];
    const seen = new Set();
    const titleKey = normalizeTextKey(title);
    const subtitleKey = normalizeTextKey(subtitle);

    const addChip = (label, tone = "default") => {
      const text = String(label || "").trim();
      if (!text) {
        return;
      }

      const key = normalizeTextKey(text);
      if (!key || key === titleKey || key === subtitleKey || seen.has(key)) {
        return;
      }

      seen.add(key);
      chips.push({ label: text, tone });
    };

    if (progress) {
      addChip(`${formatDuration(progress.position)} / ${formatDuration(progress.duration)}`, "time");
    }

    return chips.slice(0, 3);
  }

  _syncTicker(players) {
    if (typeof document !== "undefined" && document.hidden) {
      if (this._mediaTicker) {
        window.clearInterval(this._mediaTicker);
        this._mediaTicker = null;
      }
      return;
    }

    if (this._mediaBrowserState) {
      if (this._mediaTicker) {
        window.clearInterval(this._mediaTicker);
        this._mediaTicker = null;
      }
      return;
    }

    const shouldTick = players.some(player => {
      const state = this._hass?.states?.[player.entity];
      const progress = state ? this._getPlayerProgress(state) : null;
      return state?.state === "playing" && progress;
    });

    if (shouldTick && !this._mediaTicker) {
      this._mediaTicker = window.setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) {
          return;
        }

        if (this._activeSliderDrag) {
          this._pendingRenderAfterDrag = true;
          return;
        }

        const updated = this._updateProgressTick(players);
        if (!updated) {
          this._render();
        }
      }, 1000);
      return;
    }

    if (!shouldTick && this._mediaTicker) {
      window.clearInterval(this._mediaTicker);
      this._mediaTicker = null;
    }
  }

  _onVisibilityChange() {
    if (typeof document !== "undefined" && document.hidden) {
      if (this._mediaTicker) {
        window.clearInterval(this._mediaTicker);
        this._mediaTicker = null;
      }
      return;
    }

    this._render();
  }

  _updateProgressTick(players) {
    if (!this.shadowRoot || !Array.isArray(players) || players.length === 0) {
      return false;
    }

    const activeIndex = clamp(this._activePlayerIndex ?? 0, 0, players.length - 1);
    const player = players[activeIndex];
    if (!player?.entity) {
      return false;
    }

    const state = this._hass?.states?.[player.entity];
    const progress = state ? this._getPlayerProgress(state) : null;
    if (!progress) {
      return false;
    }

    const card = this.shadowRoot.querySelector(
      `.media-player-card[data-media-card-index="${activeIndex}"]`,
    );
    if (!card) {
      return false;
    }

    let updated = false;
    const fill = card.querySelector(".media-player__progress-fill");
    if (fill) {
      fill.style.width = `${progress.percent}%`;
      updated = true;
    }

    const timeChip = card.querySelector(".media-player__chip--time");
    if (timeChip) {
      timeChip.textContent = `${formatDuration(progress.position)} / ${formatDuration(progress.duration)}`;
      updated = true;
    }

    return updated;
  }

  _callService(action) {
    if (!this._hass || !action?.service) {
      return;
    }

    const [domain, service] = String(action.service).split(".");
    if (!domain || !service) {
      return;
    }

    let payload = action.service_data ?? action.data ?? {};

    if (typeof payload === "string") {
      try {
        const parsed = JSON.parse(payload);
        payload = isObject(parsed) ? parsed : {};
      } catch (_error) {
        payload = {};
      }
    }

    if (!isObject(payload)) {
      payload = {};
    }

    this._hass.callService(domain, service, payload);
  }

  _runActionDefinition(action, fallbackEntityId = "") {
    if (!action || action.action === "none") {
      return;
    }

    switch (action.action) {
      case "more-info": {
        const entityId = action.entity || fallbackEntityId;
        if (entityId) {
          fireEvent(this, "hass-more-info", { entityId });
        }
        break;
      }
      case "navigate":
        if (action.navigation_path) {
          window.history.pushState(null, "", action.navigation_path);
          window.dispatchEvent(new Event("location-changed"));
        }
        break;
      case "url": {
        const url = action.url_path || action.url;
        if (!url) {
          return;
        }

        if (action.new_tab) {
          window.open(url, "_blank", "noopener");
        } else {
          window.location.assign(url);
        }
        break;
      }
      case "call-service":
        this._callService(action);
        break;
      default:
        break;
    }
  }

  _getPlayerPowerAction(player, currentState) {
    const stateKey = normalizeTextKey(currentState);

    if (["unavailable", "unknown"].includes(stateKey) && player?.power_action_unavailable?.action && player.power_action_unavailable.action !== "default") {
      return player.power_action_unavailable;
    }

    if (["off", "standby"].includes(stateKey) && player?.power_action_off?.action && player.power_action_off.action !== "default") {
      return player.power_action_off;
    }

    if (player?.power_action_on?.action && player.power_action_on.action !== "default") {
      return player.power_action_on;
    }

    return null;
  }

  _runPlayerAction(player, defaultAction = null) {
    this._runActionDefinition(player.tap_action || defaultAction, player.entity);
  }

  _handleMediaControl(control, entityId, options = {}) {
    if (!this._hass || !entityId) {
      return;
    }

    switch (control) {
      case "power-toggle": {
        const player = this._findPlayerConfig(entityId) || { entity: entityId };
        const currentState = String(options.state || this._hass?.states?.[entityId]?.state || "");
        this._tvSourcePickerEntity = null;
        this._tvVolumePickerEntity = null;
        const customAction = this._getPlayerPowerAction(player, currentState);

        if (customAction) {
          this._runActionDefinition(customAction, entityId);
          break;
        }

        const service = ["off", "standby", "unavailable", "unknown"].includes(normalizeTextKey(currentState))
          ? "turn_on"
          : "turn_off";
        this._hass.callService("media_player", service, { entity_id: entityId });
        break;
      }
      case "play":
        this._hass.callService("media_player", "media_play", { entity_id: entityId });
        break;
      case "stop":
        this._hass.callService("media_player", "media_stop", { entity_id: entityId });
        break;
      case "previous":
        this._hass.callService("media_player", "media_previous_track", { entity_id: entityId });
        break;
      case "next":
        this._hass.callService("media_player", "media_next_track", { entity_id: entityId });
        break;
      case "play-pause":
        this._hass.callService("media_player", "media_play_pause", { entity_id: entityId });
        break;
      case "volume-down": {
        const currentVolume = Number.isFinite(options.volume) ? options.volume : 0;
        this._hass.callService("media_player", "volume_set", {
          entity_id: entityId,
          volume_level: clamp(currentVolume - 0.08, 0, 1),
        });
        break;
      }
      case "volume-down-step":
        this._hass.callService("media_player", "volume_down", { entity_id: entityId });
        break;
      case "volume-up": {
        const currentVolume = Number.isFinite(options.volume) ? options.volume : 0;
        this._hass.callService("media_player", "volume_set", {
          entity_id: entityId,
          volume_level: clamp(currentVolume + 0.08, 0, 1),
        });
        break;
      }
      case "volume-up-step":
        this._hass.callService("media_player", "volume_up", { entity_id: entityId });
        break;
      case "select-source":
        if (options.source) {
          this._hass.callService("media_player", "select_source", {
            entity_id: entityId,
            source: options.source,
          });
          if (this._tvSourcePickerEntity === entityId) {
            this._tvSourcePickerEntity = null;
            this._tvVolumePickerEntity = null;
            this._render();
          }
        }
        break;
      case "toggle-source-panel":
        this._tvVolumePickerEntity = null;
        this._tvSourcePickerEntity = this._tvSourcePickerEntity === entityId ? null : entityId;
        this._render();
        break;
      case "toggle-volume-panel":
        this._tvSourcePickerEntity = null;
        this._tvVolumePickerEntity = this._tvVolumePickerEntity === entityId ? null : entityId;
        this._render();
        break;
      case "browse-media":
        this._openMediaBrowser(entityId, options.path || "");
        break;
      default:
        break;
    }
  }

  _onShadowInput(event) {
    const slider = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.mediaSlider);

    if (!slider) {
      return;
    }

    event.stopPropagation();

    if (this._activeSliderDrag?.slider === slider) {
      return;
    }

    if (slider.dataset.mediaSlider === "volume") {
      const nextValue = clamp(Number(slider.value), 0, 100);
      this._draftVolume.set(slider.dataset.entity, nextValue);
      this._updatePlayerVolumePreview(slider.dataset.entity, nextValue);
    }
  }

  _onShadowPointerDown(event) {
    const slider = event
      .composedPath()
      .find(node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.mediaSlider,
      );

    if (this._activeSliderDrag || !slider || (typeof event.button === "number" && event.button !== 0)) {
      return;
    }

    this._startSliderDrag(slider, event.clientX, event, event.pointerId);
  }

  _startSliderDrag(slider, clientX, event = null, pointerId = null) {
    if (!slider) {
      return;
    }

    this._activeSliderDrag = {
      pointerId,
      slider,
    };

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this._pendingDragUpdate = null;
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }

    const nextValue = getRangeValueFromClientX(slider, clientX);
    slider.value = String(nextValue);

    if (slider.dataset.mediaSlider === "volume") {
      this._draftVolume.set(slider.dataset.entity, nextValue);
      this._updatePlayerVolumePreview(slider.dataset.entity, nextValue);
    }
  }

  _queueSliderDragUpdate(slider, clientX) {
    const nextValue = getRangeValueFromClientX(slider, clientX);
    slider.value = String(nextValue);

    if (slider.dataset.mediaSlider === "volume") {
      this._draftVolume.set(slider.dataset.entity, nextValue);
      this._updatePlayerVolumePreview(slider.dataset.entity, nextValue);
    }
  }

  _commitSliderDrag(clientX, event = null, pointerId = null) {
    const drag = this._activeSliderDrag;
    if (!drag) {
      return;
    }

    if (event) {
      event.preventDefault();
    }

    this._pendingDragUpdate = null;
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }

    const nextValue = getRangeValueFromClientX(drag.slider, clientX);
    drag.slider.value = String(nextValue);
    this._skipNextSliderChange = drag.slider;

    if (drag.slider.dataset.mediaSlider === "volume") {
      this._triggerHaptic("selection");
      this._draftVolume.set(drag.slider.dataset.entity, nextValue);
      this._updatePlayerVolumePreview(drag.slider.dataset.entity, nextValue);
      this._commitPlayerVolume(drag.slider.dataset.entity, nextValue);
    }

    this._activeSliderDrag = null;

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onShadowMouseDown(event) {
    const slider = event
      .composedPath()
      .find(node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.mediaSlider,
      );

    if (this._activeSliderDrag || !slider || event.button !== 0) {
      return;
    }

    this._startSliderDrag(slider, event.clientX, event);
  }

  _onShadowTouchStart(event) {
    const slider = event
      .composedPath()
      .find(node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.mediaSlider,
      );

    if (this._activeSliderDrag || !slider || !event.touches?.length) {
      return;
    }

    this._startSliderDrag(slider, event.touches[0].clientX, event);
  }

  _onWindowPointerMove(event) {
    const drag = this._activeSliderDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(drag.slider, event.clientX);
  }

  _onWindowPointerUp(event) {
    const drag = this._activeSliderDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    this._commitSliderDrag(event.clientX, event, event.pointerId);
  }

  _onWindowMouseMove(event) {
    if (!this._activeSliderDrag || (typeof event.buttons === "number" && (event.buttons & 1) === 0)) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(this._activeSliderDrag.slider, event.clientX);
  }

  _onWindowMouseUp(event) {
    if (!this._activeSliderDrag) {
      return;
    }

    this._commitSliderDrag(event.clientX, event);
  }

  _onWindowTouchMove(event) {
    if (!this._activeSliderDrag || !event.touches?.length) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(this._activeSliderDrag.slider, event.touches[0].clientX);
  }

  _onWindowTouchStartCapture(event) {
    const drag = this._activeSliderDrag;
    if (!drag) {
      return;
    }

    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.includes(drag.slider)) {
      return;
    }

    this._activeSliderDrag = null;
    this._pendingDragUpdate = null;
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onWindowTouchEnd(event) {
    if (!this._activeSliderDrag) {
      return;
    }

    const clientX = event.changedTouches?.[0]?.clientX;
    if (!Number.isFinite(clientX)) {
      this._activeSliderDrag = null;
      if (this._pendingRenderAfterDrag) {
        this._pendingRenderAfterDrag = false;
        this._render();
      }
      return;
    }

    this._commitSliderDrag(clientX, event);
  }

  _onShadowChange(event) {
    const slider = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.mediaSlider);

    if (!slider) {
      return;
    }

    event.stopPropagation();

    if (this._skipNextSliderChange === slider) {
      this._skipNextSliderChange = null;
      return;
    }

    this._triggerHaptic("selection");

    if (slider.dataset.mediaSlider === "volume") {
      const nextValue = clamp(Number(slider.value), 0, 100);
      this._draftVolume.set(slider.dataset.entity, nextValue);
      this._commitPlayerVolume(slider.dataset.entity, nextValue);
    }
  }

  _getMediaBrowserClient() {
    if (typeof this._hass?.callWS === "function") {
      return this._hass.callWS.bind(this._hass);
    }

    if (typeof this._hass?.connection?.sendMessagePromise === "function") {
      return this._hass.connection.sendMessagePromise.bind(this._hass.connection);
    }

    return null;
  }

  _normalizeMediaBrowserItem(item) {
    if (!item || typeof item !== "object") {
      return null;
    }

    return {
      title: item.title || item.name || "Elemento",
      media_class: item.media_class || "",
      media_content_id: item.media_content_id || "",
      media_content_type: item.media_content_type || "",
      can_play: item.can_play === true,
      can_expand: item.can_expand === true,
      thumbnail: item.thumbnail || item.thumbnail_url || "",
      children: Array.isArray(item.children)
        ? item.children.map(child => this._normalizeMediaBrowserItem(child)).filter(Boolean)
        : [],
    };
  }

  _normalizeMediaBrowserNode(result, entityId) {
    let node = result;

    if (node?.result && typeof node.result === "object") {
      node = node.result;
    }

    if (node && entityId && typeof node[entityId] === "object") {
      node = node[entityId];
    }

    const normalized = this._normalizeMediaBrowserItem(node);
    if (!normalized) {
      return null;
    }

    return {
      ...normalized,
      title: normalized.title || "Medios",
    };
  }

  async _fetchMediaBrowserNode(entityId, mediaContentType = "", mediaContentId = "") {
    const client = this._getMediaBrowserClient();
    if (!client || !entityId) {
      return null;
    }

    const payload = {
      type: "media_player/browse_media",
      entity_id: entityId,
    };

    if (mediaContentType) {
      payload.media_content_type = mediaContentType;
    }

    if (mediaContentId) {
      payload.media_content_id = mediaContentId;
    }

    const result = await client(payload);
    return this._normalizeMediaBrowserNode(result, entityId);
  }

  _closeMediaBrowser(shouldRender = true) {
    if (!this._mediaBrowserState) {
      return;
    }

    this._mediaBrowserState = null;
    this._mediaBrowserScrollPositions.clear();
    this._mediaBrowserRequestToken += 1;

    if (shouldRender) {
      this._render();
    }
  }

  async _openMediaBrowser(entityId, fallbackPath = "") {
    if (!entityId) {
      return;
    }

    const playerConfig = this._findPlayerConfig(entityId) || { entity: entityId };
    const playerState = this._hass?.states?.[entityId];
    const isMusicAssistant = this._isMusicAssistantPlayer(playerConfig, playerState);
    const isTvPlayer = this._getPlayerDeviceType(playerConfig, playerState) === "tv";
    const token = this._mediaBrowserRequestToken + 1;
    this._mediaBrowserRequestToken = token;
    this._mediaBrowserState = {
      entityId,
      fallbackPath,
      browserLabel: isMusicAssistant ? "Music Assistant" : this._getPlayerLabel(playerConfig, playerState),
      isMusicAssistant,
      isTvPlayer,
      loading: true,
      error: "",
      stack: [],
    };
    this._render();

    try {
      const rootNode = await this._fetchMediaBrowserNode(entityId);
      if (this._mediaBrowserRequestToken !== token) {
        return;
      }

      if (!rootNode) {
        throw new Error("Empty media browser response");
      }

      this._mediaBrowserState = {
        ...this._mediaBrowserState,
        loading: false,
        error: "",
        stack: [rootNode],
      };
      this._render();
    } catch (_error) {
      if (this._mediaBrowserRequestToken !== token) {
        return;
      }

      if (fallbackPath) {
        this._mediaBrowserState = null;
        window.history.pushState(null, "", fallbackPath);
        window.dispatchEvent(new Event("location-changed"));
        return;
      }

      this._mediaBrowserState = {
        ...this._mediaBrowserState,
        loading: false,
        error: this._mediaBrowserState?.isTvPlayer
          ? "Este dispositivo no expone medios compatibles."
          : "No se pudieron cargar los medios.",
        stack: [],
      };
      this._render();
    }
  }

  async _browseMediaBrowserItem(mediaContentType, mediaContentId) {
    if (!this._mediaBrowserState?.entityId) {
      return;
    }

    const previousState = this._mediaBrowserState;
    const token = this._mediaBrowserRequestToken + 1;
    this._mediaBrowserRequestToken = token;
    this._mediaBrowserState = {
      ...previousState,
      loading: true,
      error: "",
    };
    this._render();

    try {
      const nextNode = await this._fetchMediaBrowserNode(
        previousState.entityId,
        mediaContentType,
        mediaContentId,
      );

      if (this._mediaBrowserRequestToken !== token) {
        return;
      }

      if (!nextNode) {
        throw new Error("Empty media browser response");
      }

      this._mediaBrowserState = {
        ...previousState,
        loading: false,
        error: "",
        stack: [...previousState.stack, nextNode],
      };
      this._render();
    } catch (_error) {
      if (this._mediaBrowserRequestToken !== token) {
        return;
      }

      this._mediaBrowserState = {
        ...previousState,
        loading: false,
        error: "No se pudo abrir este elemento.",
      };
      this._render();
    }
  }

  _goBackMediaBrowser() {
    if (!this._mediaBrowserState) {
      return;
    }

    if (this._mediaBrowserState.stack.length <= 1) {
      this._closeMediaBrowser();
      return;
    }

    this._mediaBrowserState = {
      ...this._mediaBrowserState,
      error: "",
      loading: false,
      stack: this._mediaBrowserState.stack.slice(0, -1),
    };
    this._render();
  }

  _playMediaBrowserItem(mediaContentType, mediaContentId) {
    const entityId = this._mediaBrowserState?.entityId;

    if (!this._hass || !entityId || !mediaContentType || !mediaContentId) {
      return;
    }

    this._hass.callService("media_player", "play_media", {
      entity_id: entityId,
      media_content_id: mediaContentId,
      media_content_type: mediaContentType,
    });
    this._closeMediaBrowser();
  }

  _getMusicAssistantDirectoryIcon(item) {
    const haystack = normalizeTextKey([
      item?.title,
      item?.media_content_type,
      item?.media_content_id,
    ].filter(Boolean).join(" "));

    const match = MUSIC_ASSISTANT_DIRECTORY_ICON_RULES.find(rule =>
      rule.patterns.some(pattern => haystack.includes(pattern)),
    );

    return match?.icon || "";
  }

  _getMediaBrowserDisplayTitle(value) {
    const label = typeof value === "string" ? value : value?.title;
    const fallback = String(label || "").trim();

    if (!fallback) {
      return "Elemento";
    }

    if (!this._mediaBrowserState?.isMusicAssistant) {
      return fallback;
    }

    const key = normalizeTextKey(fallback);
    return MUSIC_ASSISTANT_LABEL_TRANSLATIONS[key] || fallback;
  }

  _getMediaBrowserViewKey(state = this._mediaBrowserState) {
    const currentNode = state?.stack?.[state.stack.length - 1];
    if (!currentNode) {
      return "";
    }

    return [
      state?.entityId || "",
      currentNode.media_content_type || "",
      currentNode.media_content_id || "",
      currentNode.title || "",
    ].join("::");
  }

  _captureMediaBrowserScrollState() {
    if (!this.shadowRoot || !this._mediaBrowserState) {
      return;
    }

    const list = this.shadowRoot.querySelector(".media-browser__list");
    if (!(list instanceof HTMLElement)) {
      return;
    }

    const viewKey = this._getMediaBrowserViewKey();
    if (!viewKey) {
      return;
    }

    this._mediaBrowserScrollPositions.set(viewKey, list.scrollTop);
  }

  _restoreMediaBrowserScrollState() {
    if (!this.shadowRoot || !this._mediaBrowserState) {
      return;
    }

    const list = this.shadowRoot.querySelector(".media-browser__list");
    if (!(list instanceof HTMLElement)) {
      return;
    }

    const viewKey = this._getMediaBrowserViewKey();
    if (!viewKey) {
      return;
    }

    const savedScrollTop = this._mediaBrowserScrollPositions.get(viewKey);
    if (typeof savedScrollTop !== "number") {
      return;
    }

    list.scrollTop = savedScrollTop;
  }

  _captureTvPanelScrollState() {
    if (!this.shadowRoot || !this._tvSourcePickerEntity) {
      return;
    }

    const panel = this.shadowRoot.querySelector(".media-player__tv-source-panel");
    if (!(panel instanceof HTMLElement)) {
      return;
    }

    this._tvPanelScrollPositions.set(this._tvSourcePickerEntity, panel.scrollTop);
  }

  _restoreTvPanelScrollState() {
    if (!this.shadowRoot || !this._tvSourcePickerEntity) {
      return;
    }

    const panel = this.shadowRoot.querySelector(".media-player__tv-source-panel");
    if (!(panel instanceof HTMLElement)) {
      return;
    }

    const savedScrollTop = this._tvPanelScrollPositions.get(this._tvSourcePickerEntity);
    if (typeof savedScrollTop !== "number") {
      return;
    }

    panel.scrollTop = savedScrollTop;
  }

  _getMediaBrowserIcon(item) {
    const musicAssistantDirectoryIcon =
      item?.media_class === "directory" ? this._getMusicAssistantDirectoryIcon(item) : "";

    if (musicAssistantDirectoryIcon) {
      return musicAssistantDirectoryIcon;
    }

    switch (item?.media_class) {
      case "directory":
        return "mdi:folder";
      case "album":
        return "mdi:album";
      case "artist":
        return "mdi:account-music";
      case "playlist":
        return "mdi:playlist-music";
      case "track":
      case "music":
        return "mdi:music-note";
      case "podcast":
        return "mdi:podcast";
      case "radio":
        return "mdi:radio";
      case "tv_show":
        return "mdi:television";
      case "video":
      case "movie":
        return "mdi:movie";
      default:
        return item?.can_expand ? "mdi:folder-outline" : "mdi:music-box";
    }
  }

  _shouldFilterMusicAssistantBrowserItems() {
    return Boolean(
      this._mediaBrowserState?.isMusicAssistant &&
      Array.isArray(this._mediaBrowserState?.stack) &&
      this._mediaBrowserState.stack.length <= 1,
    );
  }

  _shouldFilterTvBrowserItems() {
    return Boolean(
      this._mediaBrowserState?.isTvPlayer &&
      Array.isArray(this._mediaBrowserState?.stack) &&
      this._mediaBrowserState.stack.length <= 1,
    );
  }

  _shouldHideMediaBrowserItem(item) {
    if ((!this._shouldFilterMusicAssistantBrowserItems() && !this._shouldFilterTvBrowserItems()) || !item) {
      return false;
    }

    const haystack = normalizeTextKey([
      item.title,
      item.media_class,
      item.media_content_type,
      item.media_content_id,
    ].filter(Boolean).join(" "));

    return MUSIC_ASSISTANT_BROWSER_EXCLUDE_PATTERNS.some(pattern => haystack.includes(pattern));
  }

  _onShadowClick(event) {
    const mediaSlider = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.mediaSlider);

    if (mediaSlider) {
      event.stopPropagation();
      return;
    }

    const mediaControlButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaControl);

    if (mediaControlButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._handleMediaControl(mediaControlButton.dataset.mediaControl, mediaControlButton.dataset.entity, {
        path: mediaControlButton.dataset.mediaPath,
        source: mediaControlButton.dataset.mediaSource,
        state: mediaControlButton.dataset.mediaState,
        volume: Number(mediaControlButton.dataset.mediaVolume),
      });
      return;
    }

    const mediaArtwork = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.classList?.contains("media-player__artwork"));

    if (mediaArtwork) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const mediaDotButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaIndex !== undefined);

    if (mediaDotButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._activePlayerIndex = Number(mediaDotButton.dataset.mediaIndex);
      this._render();
      return;
    }

    const mediaBrowserCloseButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaBrowserClose === "true");

    if (mediaBrowserCloseButton) {
      event.preventDefault();
      event.stopPropagation();
      this._closeMediaBrowser();
      return;
    }

    const mediaBrowserBackButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaBrowserBack === "true");

    if (mediaBrowserBackButton) {
      event.preventDefault();
      event.stopPropagation();
      this._goBackMediaBrowser();
      return;
    }

    const mediaBrowserActionButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaBrowserAction);

    if (mediaBrowserActionButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();

      const action = mediaBrowserActionButton.dataset.mediaBrowserAction;
      const mediaContentType = mediaBrowserActionButton.dataset.mediaContentType || "";
      const mediaContentId = mediaBrowserActionButton.dataset.mediaContentId || "";

      if (action === "browse") {
        this._browseMediaBrowserItem(mediaContentType, mediaContentId);
        return;
      }

      if (action === "play") {
        this._playMediaBrowserItem(mediaContentType, mediaContentId);
      }
      return;
    }

    const mediaCard = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaCardIndex !== undefined);

    if (mediaCard) {
      const visiblePlayers = this._getVisiblePlayers();
      const player = visiblePlayers[Number(mediaCard.dataset.mediaCardIndex)];

      if (player) {
        event.preventDefault();
        event.stopPropagation();
        this._triggerHaptic();
        this._runPlayerAction(player, {
          action: "more-info",
          entity: player.entity,
        });
      }
    }
  }

  _renderEmptyState() {
    return `
      <ha-card class="empty-card">
        <div class="empty-card__title">Nodalia Media Player</div>
        <div class="empty-card__text">Configura ` + "`entity`" + ` o ` + "`players`" + ` para mostrar un reproductor.</div>
      </ha-card>
    `;
  }

  _renderMediaBrowser() {
    if (!this._mediaBrowserState) {
      return "";
    }

    const currentNode = this._mediaBrowserState.stack[this._mediaBrowserState.stack.length - 1] || null;
    const items = (Array.isArray(currentNode?.children) ? currentNode.children : []).filter(
      item => !this._shouldHideMediaBrowserItem(item),
    );

    const bodyMarkup = this._mediaBrowserState.loading
      ? `<div class="media-browser__empty">Cargando medios...</div>`
      : this._mediaBrowserState.error
        ? `<div class="media-browser__empty">${escapeHtml(this._mediaBrowserState.error)}</div>`
        : items.length === 0
          ? `<div class="media-browser__empty">No hay elementos disponibles aqui.</div>`
          : `
            <div class="media-browser__list">
              ${items
                .map(item => {
                  const canExpand = item.can_expand === true;
                  const canPlay = item.can_play === true;
                  const defaultAction = canExpand ? "browse" : canPlay ? "play" : "";
                  const itemIcon = this._getMediaBrowserIcon(item);
                  const itemTitle = this._getMediaBrowserDisplayTitle(item);

                  return `
                    <div class="media-browser__item">
                      <button
                        type="button"
                        class="media-browser__item-main"
                        ${defaultAction ? `data-media-browser-action="${defaultAction}"` : "disabled"}
                        data-media-content-type="${escapeHtml(item.media_content_type || "")}"
                        data-media-content-id="${escapeHtml(item.media_content_id || "")}"
                      >
                        <span class="media-browser__item-artwork">
                          ${
                            item.thumbnail
                              ? `<img src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(itemTitle)}" />`
                              : `<ha-icon icon="${escapeHtml(itemIcon)}"></ha-icon>`
                          }
                        </span>
                        <span class="media-browser__item-copy">
                          <span class="media-browser__item-title">${escapeHtml(itemTitle)}</span>
                        </span>
                        ${
                          canExpand
                            ? `<ha-icon class="media-browser__item-chevron" icon="mdi:chevron-right"></ha-icon>`
                            : ""
                        }
                      </button>
                      ${
                        canPlay && canExpand
                          ? `
                            <button
                              type="button"
                              class="media-browser__item-play"
                              data-media-browser-action="play"
                              data-media-content-type="${escapeHtml(item.media_content_type || "")}"
                              data-media-content-id="${escapeHtml(item.media_content_id || "")}"
                              aria-label="Reproducir ${escapeHtml(itemTitle)}"
                            >
                              <ha-icon icon="mdi:play"></ha-icon>
                            </button>
                          `
                          : ""
                      }
                    </div>
                  `;
                })
                .join("")}
            </div>
          `;

    return `
      <div class="media-browser-backdrop" data-media-browser-close="true"></div>
      <div class="media-browser-panel" role="dialog" aria-modal="true" aria-label="Navegador de medios">
        <div class="media-browser__header">
          <button
            type="button"
            class="media-browser__header-button"
            data-media-browser-back="true"
            aria-label="Volver"
          >
            <ha-icon icon="mdi:chevron-left"></ha-icon>
          </button>
          <div class="media-browser__header-copy">
            <div class="media-browser__eyebrow">${escapeHtml(this._mediaBrowserState?.browserLabel || "Media Browser")}</div>
            <div class="media-browser__title">${escapeHtml(this._getMediaBrowserDisplayTitle(currentNode?.title || "Medios"))}</div>
          </div>
          <button
            type="button"
            class="media-browser__header-button"
            data-media-browser-close="true"
            aria-label="Cerrar"
          >
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </div>
        ${bodyMarkup}
      </div>
    `;
  }

  _renderPlayerCard(players) {
    if (!players.length) {
      return "";
    }

    this._activePlayerIndex = clamp(this._activePlayerIndex, 0, players.length - 1);

    const player = players[this._activePlayerIndex];
    const state = this._hass?.states?.[player.entity];
    if (!state) {
      return "";
    }

    const artwork = this._getPlayerArtwork(player, state);
    const deviceType = this._getPlayerDeviceType(player, state);
    const isTvPlayer = deviceType === "tv";
    const playerLabel = this._getPlayerLabel(player, state);
    const sourceLabel = this._getPlayerSourceLabel(state);
    const title = isTvPlayer
      ? this._getTvContentTitle(player, state)
      : this._getPlayerTitle(player, state);
    const subtitle = isTvPlayer
      ? ""
      : this._getPlayerSubtitle(player, state);
    const subtitleMarkup = subtitle && normalizeTextKey(subtitle) !== normalizeTextKey(title)
      ? `<div class="media-player__subtitle">${escapeHtml(subtitle)}</div>`
      : "";
    const progress = this._getPlayerProgress(state);
    const hasActiveMediaContent = this._hasActiveMediaContent(state);
    const sourceOptions = isTvPlayer ? this._getPlayerSourceOptions(player, state) : [];
    const chips = isTvPlayer
      ? this._getTvPlayerChips(player, state, progress, title, subtitle, sourceOptions)
      : this._getPlayerChips(player, state, progress, title, subtitle);
    const showPrimaryTitle = !isTvPlayer
      ? hasActiveMediaContent && (!playerLabel || normalizeTextKey(title) !== normalizeTextKey(playerLabel))
      : Boolean(title) && normalizeTextKey(title) !== normalizeTextKey(playerLabel);
    const showTopChip = !!playerLabel && (
      isTvPlayer ||
      !hasActiveMediaContent ||
      normalizeTextKey(playerLabel) !== normalizeTextKey(title)
    );
    const statusLabel = this._getPlayerStateLabel(state.state);
    const showStateLabel = this._config.show_state === true;
    const browsePath = this._getPlayerBrowsePath(player, state);
    const browseAvailable = isTvPlayer
      ? Boolean(player?.browse_path || player?.media_browser_path)
      : this._supportsMediaBrowser(player, state) || Boolean(browsePath);
    const isIdleLayout = this._shouldUseIdleLayout(player, state);
    const volumeLevel = Number(state.attributes.volume_level ?? 0);
    const currentVolumePercent = this._getPlayerVolumePercent(player.entity, state);
    const volumeSupported = this._supportsVolumeControl(state);
    const playerStyles = this._config.styles.player;
    const hasAlbumBackground = this._config.album_cover_background !== false && Boolean(artwork);
    const useActiveTint = isTvPlayer && this._isPlayerActive(state) && !hasAlbumBackground;
    const showUnavailableBadge = this._config.show_unavailable_badge !== false && isUnavailableState(state);
    const playerCardClasses = [
      "media-player-card",
      isIdleLayout ? "media-player-card--idle" : "",
      isTvPlayer ? "media-player-card--tv" : "",
      hasAlbumBackground ? "has-album-background" : "",
      useActiveTint ? "media-player-card--active" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const volumeDownMarkup = volumeSupported
      ? `
        <button
          type="button"
          class="media-player__volume-button"
          data-media-control="volume-down"
          data-entity="${escapeHtml(player.entity)}"
          data-media-volume="${volumeLevel}"
          aria-label="Bajar volumen"
        >
          <ha-icon icon="mdi:minus"></ha-icon>
        </button>
      `
      : "";
    const volumeUpMarkup = volumeSupported
      ? `
        <button
          type="button"
          class="media-player__volume-button"
          data-media-control="volume-up"
          data-entity="${escapeHtml(player.entity)}"
          data-media-volume="${volumeLevel}"
          aria-label="Subir volumen"
        >
          <ha-icon icon="mdi:plus"></ha-icon>
        </button>
      `
      : "";
    const browseMarkup = browseAvailable && !isTvPlayer
      ? `
        <div class="media-player__transport-addon">
          <button
            type="button"
            class="media-player__volume-button media-player__volume-button--browse"
            data-media-control="browse-media"
            data-entity="${escapeHtml(player.entity)}"
            data-media-path="${escapeHtml(browsePath)}"
            aria-label="Abrir medios"
          >
            <ha-icon icon="mdi:music-box-multiple-outline"></ha-icon>
          </button>
        </div>
      `
      : "";
    const browseIdleMarkup = browseAvailable && !isTvPlayer
      ? `
        <button
          type="button"
          class="media-player__volume-button media-player__volume-button--browse"
          data-media-control="browse-media"
          data-entity="${escapeHtml(player.entity)}"
          data-media-path="${escapeHtml(browsePath)}"
          aria-label="Abrir medios"
        >
          <ha-icon icon="mdi:music-box-multiple-outline"></ha-icon>
        </button>
      `
      : "";
    const isTvOff = ["off", "standby", "unavailable", "unknown"].includes(state.state);
    const tvPowerMarkup = `
      <button
        type="button"
        class="media-player__control ${state.state === "off" ? "media-player__control--primary" : ""}"
        data-media-control="power-toggle"
        data-entity="${escapeHtml(player.entity)}"
        data-media-state="${escapeHtml(state.state)}"
        aria-label="${escapeHtml(state.state === "off" ? "Encender" : "Apagar")}"
      >
        <ha-icon icon="mdi:power"></ha-icon>
      </button>
    `;
    const tvPlayPauseMarkup = !isTvOff
      ? `
      <button
        type="button"
        class="media-player__control media-player__control--primary"
        data-media-control="play-pause"
        data-entity="${escapeHtml(player.entity)}"
        aria-label="Play o pausa"
      >
        <ha-icon icon="${escapeHtml(state.state === "playing" ? "mdi:pause" : "mdi:play")}"></ha-icon>
      </button>
    `
      : "";
    const tvVolumeToggleMarkup = volumeSupported && !isTvOff
      ? `
        <button
          type="button"
          class="media-player__control ${this._tvVolumePickerEntity === player.entity ? "media-player__control--active" : ""}"
          data-media-control="toggle-volume-panel"
          data-entity="${escapeHtml(player.entity)}"
          aria-label="Mostrar volumen"
        >
          <ha-icon icon="mdi:volume-high"></ha-icon>
        </button>
      `
      : "";
    const artworkIsSourceToggle = isTvPlayer && sourceOptions.length && !isTvOff;
    const tvBrowseMarkup = browseAvailable && !isTvOff
      ? `
        <button
          type="button"
          class="media-player__control"
          data-media-control="browse-media"
          data-entity="${escapeHtml(player.entity)}"
          data-media-path="${escapeHtml(browsePath)}"
          aria-label="Abrir medios"
        >
          <ha-icon icon="mdi:apps"></ha-icon>
        </button>
      `
      : "";
    const sourceButtonsMarkup = sourceOptions.length
      ? `
        <div class="media-player__source-buttons" aria-label="Fuentes">
          ${sourceOptions
            .map(source => `
              <button
                type="button"
                class="media-player__source-button ${normalizeTextKey(source) === normalizeTextKey(state.attributes.source) ? "active" : ""}"
                data-media-control="select-source"
                data-entity="${escapeHtml(player.entity)}"
                data-media-source="${escapeHtml(source)}"
                aria-label="Cambiar a ${escapeHtml(source)}"
              >
                ${escapeHtml(source)}
              </button>
            `)
            .join("")}
        </div>
      `
      : "";
    const tvSourcePanelMarkup = sourceButtonsMarkup && !isTvOff && this._tvSourcePickerEntity === player.entity
      ? `<div class="media-player__tv-source-panel">${sourceButtonsMarkup}</div>`
      : "";
    const tvVolumeSliderMarkup = volumeSupported && !isTvOff && this._tvVolumePickerEntity === player.entity
      ? `
        <div class="media-player__tv-volume-wrap">
          <div class="media-player__volume-slider-shell" style="--media-volume:${currentVolumePercent};">
            <div class="media-player__volume-track"></div>
            <input
              type="range"
              class="media-player__volume-slider"
              data-media-slider="volume"
              data-entity="${escapeHtml(player.entity)}"
              min="0"
              max="100"
              step="any"
              value="${currentVolumePercent}"
              style="--media-volume:${currentVolumePercent};"
              aria-label="Volumen"
            />
          </div>
        </div>
      `
      : "";
    const tvControlsMarkup = `
      <div class="media-player__tv-actions ${isTvOff ? "media-player__tv-actions--off" : ""}">
        ${tvPowerMarkup}
        ${tvPlayPauseMarkup}
        ${tvVolumeToggleMarkup}
        ${tvBrowseMarkup}
      </div>
    `;
    const tvSourceMarkup = isTvPlayer && sourceLabel
      && normalizeTextKey(sourceLabel) !== normalizeTextKey(playerLabel)
      && normalizeTextKey(sourceLabel) !== normalizeTextKey(title)
      ? `<div class="media-player__subtitle media-player__subtitle--tv">${escapeHtml(sourceLabel)}</div>`
      : "";
    const dotsMarkup = players.length > 1
      ? `
        <div class="media-player__dots" aria-label="Media players">
          ${players
            .map(
              (_item, index) => `
                <button
                  type="button"
                  class="media-player__dot ${index === this._activePlayerIndex ? "active" : ""}"
                  data-media-index="${index}"
                  aria-label="Seleccionar reproductor ${index + 1}"
                ></button>
              `,
            )
            .join("")}
        </div>
      `
      : "";
    const chipsMarkup = chips.length
      ? `
        <div class="media-player__chips-wrap">
          <div class="media-player__chips">
            ${chips
              .map(
                chip => `
                  <span class="media-player__chip media-player__chip--${escapeHtml(chip.tone)}">
                    ${escapeHtml(chip.label)}
                  </span>
                `,
              )
              .join("")}
          </div>
        </div>
      `
      : "";
    const infoRailItems = [
      showTopChip
        ? `
          <span class="media-player__chip media-player__chip--device media-player__chip--top">
            ${escapeHtml(playerLabel)}
          </span>
        `
        : "",
      showStateLabel
        ? `
          <span class="media-player__chip media-player__chip--${escapeHtml(state.state || "default")} media-player__chip--status">
            ${escapeHtml(statusLabel)}
          </span>
        `
        : "",
    ]
      .filter(Boolean)
      .join("");
    const infoRailMarkup = infoRailItems
      ? `
        <div class="media-player__info-rail ${isIdleLayout ? "media-player__info-rail--idle" : ""}">
          ${infoRailItems}
        </div>
      `
      : "";
    const idleControlsMarkup = `
      <div class="media-player__idle-actions">
        ${volumeDownMarkup}
        <button
          type="button"
          class="media-player__control media-player__control--primary"
          data-media-control="play"
          data-entity="${escapeHtml(player.entity)}"
          aria-label="Reproducir"
        >
          <ha-icon icon="mdi:play"></ha-icon>
        </button>
        ${volumeUpMarkup}
        ${browseIdleMarkup}
      </div>
    `;
    const idleTvControlsMarkup = `
      <div class="media-player__idle-tv-stack">
        <div class="media-player__idle-actions media-player__idle-actions--tv">
          ${tvControlsMarkup}
        </div>
        ${tvVolumeSliderMarkup}
      </div>
    `;
    const idleTvOffMarkup = `
      <div class="media-player__idle-tv-off-bar">
        ${infoRailMarkup}
        <div class="media-player__idle-actions media-player__idle-actions--tv media-player__idle-actions--tv-off">
          ${tvPowerMarkup}
        </div>
      </div>
    `;

    if (isIdleLayout) {
      return `
        <div
          class="${playerCardClasses}"
          data-media-card-index="${this._activePlayerIndex}"
        >
          ${
            hasAlbumBackground
              ? `<div class="media-player__album-bg" style="background-image:url('${escapeHtml(artwork)}');"></div>`
              : ""
          }
          <div class="media-player__content media-player__content--idle">
            <div class="media-player__idle-hero">
              ${
                artworkIsSourceToggle
                  ? `
                    <button
                      type="button"
                      class="media-player__artwork media-player__artwork--idle media-player__artwork--interactive ${this._tvSourcePickerEntity === player.entity ? "media-player__artwork--active" : ""}"
                      data-media-control="toggle-source-panel"
                      data-entity="${escapeHtml(player.entity)}"
                      aria-label="Cambiar fuente"
                    >
                      ${
                        artwork
                          ? `<img src="${escapeHtml(artwork)}" alt="${escapeHtml(title || playerLabel)}" />`
                          : `<ha-icon icon="${escapeHtml(this._getPlayerFallbackIcon(player, state, deviceType))}"></ha-icon>`
                      }
                      ${showUnavailableBadge ? `<span class="media-player__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                    </button>
                  `
                  : `
                    <div class="media-player__artwork media-player__artwork--idle">
                      ${
                        artwork
                          ? `<img src="${escapeHtml(artwork)}" alt="${escapeHtml(title || playerLabel)}" />`
                          : `<ha-icon icon="${escapeHtml(this._getPlayerFallbackIcon(player, state, deviceType))}"></ha-icon>`
                      }
                      ${showUnavailableBadge ? `<span class="media-player__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                    </div>
                  `
              }
              ${
                isTvPlayer && isTvOff
                  ? idleTvOffMarkup
                  : `
                    <div class="media-player__idle-main ${isTvPlayer && isTvOff ? "media-player__idle-main--tv-off" : ""}">
                      ${infoRailMarkup}
                      ${isTvPlayer ? idleTvControlsMarkup : idleControlsMarkup}
                    </div>
                  `
              }
            </div>
            ${isTvPlayer ? tvSourcePanelMarkup : ""}
            ${dotsMarkup ? `<div class="media-player__switcher media-player__switcher--idle">${dotsMarkup}</div>` : ""}
          </div>
        </div>
      `;
    }

    return `
      <div
        class="${playerCardClasses}"
        data-media-card-index="${this._activePlayerIndex}"
      >
        ${
          hasAlbumBackground
            ? `<div class="media-player__album-bg" style="background-image:url('${escapeHtml(artwork)}');"></div>`
            : ""
        }
        ${
          progress
            ? `
              <div class="media-player__progress">
                <span class="media-player__progress-fill" style="width:${progress.percent}%"></span>
              </div>
            `
            : ""
        }
        <div class="media-player__content">
          <div class="media-player__hero">
            ${
              artworkIsSourceToggle
                ? `
                  <button
                    type="button"
                    class="media-player__artwork media-player__artwork--interactive ${this._tvSourcePickerEntity === player.entity ? "media-player__artwork--active" : ""}"
                    data-media-control="toggle-source-panel"
                    data-entity="${escapeHtml(player.entity)}"
                    aria-label="Cambiar fuente"
                  >
                    ${
                      artwork
                        ? `<img src="${escapeHtml(artwork)}" alt="${escapeHtml(title || playerLabel)}" />`
                        : `<ha-icon icon="${escapeHtml(this._getPlayerFallbackIcon(player, state, deviceType))}"></ha-icon>`
                    }
                    ${showUnavailableBadge ? `<span class="media-player__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                  </button>
                `
                : `
                  <div class="media-player__artwork">
                    ${
                      artwork
                        ? `<img src="${escapeHtml(artwork)}" alt="${escapeHtml(title || playerLabel)}" />`
                        : `<ha-icon icon="${escapeHtml(this._getPlayerFallbackIcon(player, state, deviceType))}"></ha-icon>`
                    }
                    ${showUnavailableBadge ? `<span class="media-player__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                  </div>
                `
            }
            <div class="media-player__hero-copy">
              <div class="media-player__hero-top">
                ${isTvPlayer ? infoRailMarkup : ""}
                <div class="media-player__meta ${isTvPlayer ? "media-player__meta--tv" : ""}">
                  ${showPrimaryTitle ? `<div class="media-player__title">${escapeHtml(title)}</div>` : ""}
                  ${isTvPlayer ? tvSourceMarkup : subtitleMarkup}
                </div>
                ${isTvPlayer ? "" : infoRailMarkup}
              </div>
            </div>
          </div>
          <div class="media-player__center-stack">
            ${dotsMarkup ? `<div class="media-player__switcher">${dotsMarkup}</div>` : ""}
            <div class="media-player__transport-row">
              ${
                isTvPlayer
                  ? `
                    <div class="media-player__tv-shell">
                      <div class="media-player__tv-stack">
                        ${tvControlsMarkup}
                        ${tvVolumeSliderMarkup}
                        ${tvSourcePanelMarkup}
                      </div>
                    </div>
                  `
                  : `
                    <div class="media-player__transport-shell">
                      <div class="media-player__transport-cluster">
                        ${volumeDownMarkup}
                        <div class="media-player__transport">
                          <button
                            type="button"
                            class="media-player__control"
                            data-media-control="previous"
                            data-entity="${escapeHtml(player.entity)}"
                            aria-label="Anterior"
                          >
                            <ha-icon icon="mdi:skip-previous"></ha-icon>
                          </button>
                          <button
                            type="button"
                            class="media-player__control media-player__control--primary"
                            data-media-control="play-pause"
                            data-entity="${escapeHtml(player.entity)}"
                            aria-label="Play o pausa"
                          >
                            <ha-icon icon="${escapeHtml(state.state === "playing" ? "mdi:pause" : "mdi:play")}"></ha-icon>
                          </button>
                          <button
                            type="button"
                            class="media-player__control"
                            data-media-control="next"
                            data-entity="${escapeHtml(player.entity)}"
                            aria-label="Siguiente"
                          >
                            <ha-icon icon="mdi:skip-next"></ha-icon>
                          </button>
                        </div>
                        ${volumeUpMarkup}
                      </div>
                      ${browseMarkup}
                    </div>
                  `
              }
            </div>
          </div>
          ${chipsMarkup ? `<div class="media-player__footer">${chipsMarkup}</div>` : ""}
        </div>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    this._captureMediaBrowserScrollState();
    this._captureTvPanelScrollState();

    if (!this._config) {
      this.shadowRoot.innerHTML = "";
      return;
    }

    if (this._shouldHideForScreen()) {
      this.shadowRoot.innerHTML = "";
      return;
    }

    const inEditMode = this._isInEditMode();
    const players = this._getVisiblePlayers();
    const hasPlayers = players.length > 0;
    const isFixed = this._config.layout.fixed && !inEditMode;
    const spacerHeight = isFixed ? this._getReservedHeight(hasPlayers) : "0px";
    const mediaBrowserMarkup = this._renderMediaBrowser();

    this._syncTicker(hasPlayers ? players : []);

    const contentMarkup = hasPlayers
      ? this._renderPlayerCard(players)
      : inEditMode
        ? this._renderEmptyState()
        : "";

    const config = this._config;
    const playerStyles = config.styles.player;
    const browserStyles = config.styles.browser;
    const tvArtworkSize = playerStyles.tv_artwork_size || playerStyles.artwork_size;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }

        * {
          box-sizing: border-box;
        }

        .spacer {
          display: ${isFixed && config.layout.reserve_space ? "block" : "none"};
          height: ${spacerHeight};
        }

        .dock {
          position: ${isFixed ? "fixed" : "static"};
          left: ${isFixed ? config.layout.side_margin : "auto"};
          right: ${isFixed ? config.layout.side_margin : "auto"};
          ${isFixed
            ? config.layout.position === "top"
              ? `top: ${config.layout.offset};`
              : `bottom: ${config.layout.offset};`
            : "top: auto; bottom: auto;"}
          z-index: ${isFixed ? config.layout.z_index : "auto"};
          pointer-events: ${isFixed ? "none" : "auto"};
        }

        .dock-inner {
          margin: ${isFixed ? "0 auto" : "0"};
          max-width: ${config.layout.max_width};
          pointer-events: none;
          width: 100%;
        }

        .player-stack {
          display: grid;
          gap: 0;
          pointer-events: none;
        }

        .player-stack > *,
        .player-stack > * > *,
        .media-browser-backdrop,
        .media-browser-panel {
          pointer-events: auto;
        }

        .empty-card,
        .media-player-card {
          pointer-events: none;
        }

        .empty-card > *,
        .media-player-card > * {
          pointer-events: auto;
        }

        .empty-card,
        .media-player-card {
          background: ${playerStyles.background};
          border: ${playerStyles.border};
          border-radius: ${playerStyles.border_radius};
          box-shadow: ${playerStyles.box_shadow};
          isolation: isolate;
          min-height: ${playerStyles.min_height};
          overflow: hidden;
          padding: ${playerStyles.padding};
          position: relative;
        }

        .media-player-card--active {
          background:
            linear-gradient(180deg, rgba(42, 88, 180, 0.22), rgba(18, 34, 74, 0.28)),
            ${playerStyles.background};
          border-color: rgba(109, 163, 255, 0.24);
          box-shadow:
            ${playerStyles.box_shadow},
            0 0 0 1px rgba(109, 163, 255, 0.08),
            0 18px 38px rgba(16, 34, 82, 0.18);
        }

        .empty-card {
          display: grid;
          gap: 6px;
          min-height: 100px;
        }

        .empty-card__title {
          color: var(--primary-text-color);
          font-size: 15px;
          font-weight: 700;
        }

        .empty-card__text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }

        .media-player-card::before {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0));
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 1;
        }

        .media-player-card.has-album-background::after {
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.08),
            ${playerStyles.overlay_color},
            rgba(0, 0, 0, 0.16)
          );
          content: "";
          inset: 0;
          position: absolute;
          z-index: 2;
        }

        .media-player__album-bg {
          background-position: center;
          background-size: cover;
          filter: blur(30px) saturate(0.82);
          inset: -24px;
          opacity: 0.42;
          position: absolute;
          transform: scale(1.14);
          z-index: 0;
        }

        .media-player__progress {
          background: ${playerStyles.progress_background};
          border-radius: 999px;
          bottom: 8px;
          height: 6px;
          inset-inline: 12px;
          overflow: hidden;
          position: absolute;
          z-index: 3;
        }

        .media-player__progress-fill {
          background: ${playerStyles.progress_color};
          display: block;
          height: 100%;
        }

        .media-player__content,
        .media-player__dots {
          position: relative;
          z-index: 3;
        }

        .media-player__content {
          align-content: start;
          display: grid;
          gap: 10px;
          padding-bottom: 10px;
        }

        .media-player__content--idle {
          gap: 6px;
          padding-bottom: 2px;
        }

        .media-player-card--idle {
          min-height: 96px;
        }

        .media-player__hero {
          align-items: start;
          display: grid;
          gap: 12px;
          grid-template-columns: ${playerStyles.artwork_size} minmax(0, 1fr);
        }

        .media-player__idle-hero {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: 56px minmax(0, 1fr);
          min-width: 0;
        }

        .media-player__idle-main {
          align-items: center;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .media-player__idle-tv-off-bar {
          align-items: center;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .media-player__hero-copy {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .media-player__hero-top {
          align-items: start;
          display: grid;
          gap: 8px;
          grid-template-columns: minmax(0, 1fr);
          min-width: 0;
        }

        .media-player__info-rail {
          align-items: end;
          display: grid;
          gap: 6px;
          justify-self: end;
          justify-items: end;
          max-width: min(100%, clamp(132px, 36vw, 220px));
          min-width: 0;
          pointer-events: none;
          width: fit-content;
        }

        .media-player__info-rail--idle {
          align-items: start;
          gap: 4px;
          justify-items: start;
          max-width: none;
        }

        .media-player__artwork {
          align-items: center;
          appearance: none;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 22px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 10px 24px rgba(0, 0, 0, 0.18);
          color: inherit;
          cursor: default;
          display: flex;
          height: ${playerStyles.artwork_size};
          justify-content: center;
          overflow: visible;
          padding: 0;
          position: relative;
          text-decoration: none;
          width: ${playerStyles.artwork_size};
        }

        .media-player__artwork--idle {
          border-radius: 18px;
          height: 56px;
          width: 56px;
        }

        .media-player__artwork img {
          border-radius: inherit;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .media-player__artwork ha-icon {
          --mdc-icon-size: calc(${playerStyles.artwork_size} * 0.5);
          align-items: center;
          color: var(--primary-text-color);
          display: inline-flex;
          height: auto;
          justify-content: center;
          left: 50%;
          line-height: 1;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: auto;
        }

        .media-player__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid var(--ha-card-background, rgba(28, 28, 32, 1));
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          color: #ffffff;
          display: inline-flex;
          height: 18px;
          justify-content: center;
          position: absolute;
          right: 0;
          top: 0;
          transform: translate(28%, -28%);
          width: 18px;
          z-index: 3;
        }

        .media-player__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          color: inherit;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .media-player__artwork--interactive {
          cursor: pointer;
        }

        .media-player__artwork--active {
          background: rgba(var(--rgb-primary-color), 0.14);
          border-color: rgba(var(--rgb-primary-color), 0.2);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 10px 24px rgba(0, 0, 0, 0.18),
            0 0 0 1px rgba(var(--rgb-primary-color), 0.1);
        }

        .media-player__meta {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .media-player__title,
        .media-player__subtitle {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player__title {
          color: var(--primary-text-color);
          font-size: ${playerStyles.title_size};
          font-weight: 700;
        }

        .media-player__subtitle {
          color: var(--secondary-text-color);
          font-size: ${playerStyles.subtitle_size};
        }

        .media-player__subtitle--tv {
          max-width: min(100%, 420px);
          text-align: center;
          width: 100%;
        }

        .media-player__center-stack {
          display: grid;
          gap: 10px;
          justify-items: center;
        }

        .media-player__switcher {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .media-player__switcher--idle {
          margin-top: -4px;
        }

        .media-player__transport-row {
          align-items: center;
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .media-player__transport-row--idle {
          justify-content: flex-start;
        }

        .media-player__idle-actions {
          align-items: center;
          display: inline-flex;
          gap: 6px;
          justify-content: flex-end;
          min-width: 0;
        }

        .media-player__idle-actions--tv {
          justify-content: flex-start;
          width: 100%;
        }

        .media-player__idle-actions--tv-off {
          justify-content: flex-end;
          width: auto;
        }

        .media-player__idle-tv-stack {
          display: grid;
          gap: 8px;
          justify-items: stretch;
          min-width: min(100%, 230px);
        }

        .media-player__transport-shell {
          align-items: center;
          display: inline-flex;
          justify-content: center;
          position: relative;
          width: auto;
        }

        .media-player__transport-cluster {
          align-items: center;
          display: inline-flex;
          gap: 8px;
          justify-content: center;
          width: auto;
        }

        .media-player__transport-cluster--idle {
          gap: 8px;
        }

        .media-player__transport-addon {
          align-items: center;
          display: inline-flex;
          left: calc(100% + 8px);
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
        }

        .media-player__transport {
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          display: inline-flex;
          gap: 6px;
          margin: 0 auto;
          padding: 5px;
        }

        .media-player__tv-shell {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .media-player__tv-stack {
          display: grid;
          gap: 8px;
          justify-items: center;
          width: min(100%, 340px);
        }

        .media-player__tv-actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          width: 100%;
        }

        .media-player__tv-actions--off {
          justify-content: flex-end;
          width: auto;
        }

        .media-player-card--tv .media-player__content {
          gap: 6px;
          padding-bottom: 4px;
        }

        .media-player-card--tv:not(.media-player-card--idle) {
          min-height: 0;
          padding: 12px 14px 8px;
        }

        .media-player-card--tv:not(.media-player-card--idle) .media-player__content {
          gap: 8px;
          padding-bottom: 6px;
        }

        .media-player-card--tv .media-player__hero {
          gap: 14px;
          grid-template-columns: ${tvArtworkSize} minmax(0, 1fr);
        }

        .media-player-card--tv .media-player__hero-copy {
          align-content: start;
          gap: 6px;
          min-width: 0;
          overflow: hidden;
        }

        .media-player-card--tv .media-player__artwork {
          border-radius: 20px;
          height: ${tvArtworkSize};
          width: ${tvArtworkSize};
        }

        .media-player-card--tv .media-player__artwork ha-icon {
          --mdc-icon-size: calc(${tvArtworkSize} * 0.5);
        }

        .media-player-card--tv.media-player-card--idle .media-player__artwork--idle {
          height: ${tvArtworkSize};
          width: ${tvArtworkSize};
        }

        .media-player-card--tv .media-player__hero-top {
          gap: 4px;
          grid-template-columns: minmax(0, 1fr);
          justify-items: end;
        }

        .media-player-card--tv .media-player__info-rail {
          align-items: end;
          gap: 4px;
          justify-items: end;
          justify-self: end;
          max-width: min(100%, 100%);
          width: fit-content;
        }

        .media-player-card--tv .media-player__meta {
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding-left: 10px;
          justify-items: end;
          text-align: right;
          width: 100%;
        }

        .media-player-card--tv .media-player__meta--tv {
          justify-self: end;
        }

        .media-player-card--tv .media-player__chip--top,
        .media-player-card--tv .media-player__chip--status {
          justify-content: flex-end;
          text-align: right;
        }

        .media-player-card--tv .media-player__title {
          display: block;
          font-size: calc(${playerStyles.title_size} - 1px);
          max-width: 100%;
          overflow: hidden;
          text-align: right;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player-card--tv .media-player__subtitle--tv,
        .media-player-card--tv .media-player__chips-wrap {
          justify-self: end;
          max-width: 100%;
          text-align: right;
        }

        .media-player-card--tv:not(.media-player-card--idle) .media-player__chips-wrap {
          margin-bottom: 4px;
        }

        .media-player-card--tv .media-player__subtitle--tv {
          display: block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
        }

        .media-player-card--tv:not(.media-player-card--idle) .media-player__center-stack {
          gap: 6px;
        }

        .media-player-card--tv:not(.media-player-card--idle) .media-player__tv-stack {
          gap: 5px;
        }

        .media-player-card--tv .media-player__chips,
        .media-player-card--tv .media-player__footer {
          justify-content: flex-end;
        }

        .media-player-card--tv.media-player-card--idle .media-player__idle-main {
          align-items: start;
          gap: 20px;
          grid-template-columns: minmax(0, 1fr);
          padding-top: 6px;
        }

        .media-player-card--tv.media-player-card--idle .media-player__idle-tv-stack {
          gap: 10px;
          padding-top: 6px;
        }

        .media-player-card--tv.media-player-card--idle .media-player__idle-main--tv-off {
          align-items: center;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .media-player-card--tv.media-player-card--idle .media-player__idle-tv-off-bar .media-player__info-rail {
          justify-self: end;
          width: fit-content;
        }

        .media-player-card--tv.media-player-card--idle .media-player__idle-tv-off-bar {
          align-items: end;
          gap: 8px;
          grid-template-columns: minmax(0, 1fr);
          justify-items: end;
        }

        .media-player-card--tv.media-player-card--idle .media-player__idle-actions--tv-off {
          justify-content: flex-end;
          width: fit-content;
        }

        .media-player-card--tv.media-player-card--idle .media-player__idle-hero {
          align-items: start;
        }

        .media-player-card--tv .media-player__control {
          height: calc(${playerStyles.control_size} + 6px);
          width: calc(${playerStyles.control_size} + 6px);
        }

        .media-player-card--tv .media-player__control--primary {
          height: calc(${playerStyles.control_size} + 6px);
          width: calc(${playerStyles.control_size} + 6px);
        }

        .media-player-card--tv .media-player__tv-source-panel {
          justify-content: center;
          max-height: 190px;
          overflow: auto;
          padding-right: 2px;
        }

        .media-player-card--tv .media-player__source-buttons {
          gap: 6px;
          justify-content: center;
        }

        .media-player-card--tv .media-player__source-button {
          max-width: 100%;
          min-height: 32px;
          padding: 0 10px;
        }

        .media-player-card--tv .media-player__tv-volume-wrap {
          min-height: ${playerStyles.slider_wrap_height};
          padding: 0 14px;
          width: 100%;
        }

        @media (max-width: 520px) {
          .media-player-card--tv .media-player__hero {
            gap: 12px;
            grid-template-columns: min(${tvArtworkSize}, 64px) minmax(0, 1fr);
          }

          .media-player-card--tv .media-player__artwork {
            height: min(${tvArtworkSize}, 64px);
            width: min(${tvArtworkSize}, 64px);
          }

          .media-player-card--tv .media-player__tv-stack {
            width: 100%;
          }

          .media-player-card--tv .media-player__tv-actions {
            justify-content: center;
          }

          .media-player-card--tv .media-player__subtitle--tv {
            text-align: right;
          }
        }

        .media-player__tv-source-panel {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .media-player__footer {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
        }

        .media-player__tv-footer {
          display: flex;
          justify-content: flex-start;
          width: 100%;
        }

        .media-player__chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: center;
          min-width: 0;
        }

        .media-player__chips-wrap {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .media-player__tv-volume-wrap {
          --media-player-slider-input-height: max(44px, var(--media-player-slider-thumb-size));
          --media-player-slider-thumb-size: calc(${playerStyles.slider_thumb_size} + 12px);
          align-items: center;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          display: grid;
          min-height: ${playerStyles.slider_wrap_height};
          padding: 0 16px;
          width: min(100%, 320px);
        }

        .media-player__volume-slider-shell {
          min-width: 0;
          position: relative;
          width: 100%;
        }

        .media-player__volume-track {
          background:
            linear-gradient(
              90deg,
              ${playerStyles.progress_color} 0%,
              ${playerStyles.progress_color} calc(var(--media-volume, 0) * 1%),
              rgba(255, 255, 255, 0.08) calc(var(--media-volume, 0) * 1%),
              rgba(255, 255, 255, 0.08) 100%
            );
          border-radius: 999px;
          height: ${playerStyles.slider_height};
          left: 0;
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
        }

        .media-player__volume-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          box-sizing: border-box;
          cursor: pointer;
          display: block;
          height: var(--media-player-slider-input-height);
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
          width: 100%;
          z-index: 1;
        }

        .media-player__volume-slider::-webkit-slider-runnable-track {
          background: transparent;
          border-radius: 999px;
          height: ${playerStyles.slider_height};
        }

        .media-player__volume-slider::-moz-range-progress {
          background: transparent;
          border: 0;
          height: ${playerStyles.slider_height};
        }

        .media-player__volume-slider::-moz-range-track {
          background: transparent;
          border: 0;
          border-radius: 999px;
          height: ${playerStyles.slider_height};
        }

        .media-player__volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
          cursor: pointer;
          height: ${playerStyles.slider_thumb_size};
          margin-top: calc((${playerStyles.slider_height} - ${playerStyles.slider_thumb_size}) / 2);
          width: ${playerStyles.slider_thumb_size};
        }

        .media-player__volume-slider::-moz-range-thumb {
          background: transparent;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
          cursor: pointer;
          height: ${playerStyles.slider_thumb_size};
          width: ${playerStyles.slider_thumb_size};
        }

        .media-player__chip {
          align-items: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: ${playerStyles.subtitle_size};
          font-weight: 600;
          line-height: 1;
          max-width: 100%;
          min-height: 26px;
          overflow: hidden;
          padding: 0 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player__chip--top {
          justify-content: flex-end;
          margin-left: auto;
          max-width: min(100%, 220px);
          text-align: right;
        }

        .media-player__info-rail--idle .media-player__chip--top,
        .media-player__info-rail--idle .media-player__chip--status {
          justify-content: flex-start;
          text-align: left;
        }

        .media-player__chip--status {
          max-width: min(100%, 160px);
        }

        .media-player__chip--playing {
          background: rgba(var(--rgb-primary-color), 0.16);
          border-color: rgba(var(--rgb-primary-color), 0.22);
          color: ${playerStyles.accent_color};
        }

        .media-player__chip--paused,
        .media-player__chip--buffering,
        .media-player__chip--device,
        .media-player__chip--source {
          color: var(--primary-text-color);
        }

        .media-player__chip--time {
          font-variant-numeric: tabular-nums;
        }

        .media-player__source-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          width: 100%;
        }

        .media-player__source-button {
          align-items: center;
          appearance: none;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: ${playerStyles.subtitle_size};
          font-weight: 600;
          justify-content: center;
          line-height: 1;
          max-width: 100%;
          min-height: 30px;
          overflow: hidden;
          padding: 0 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player__source-button.active {
          background: ${playerStyles.accent_background};
          border-color: rgba(var(--rgb-primary-color), 0.22);
          color: ${playerStyles.accent_color};
        }

        .media-player__control,
        .media-player__volume-button {
          align-items: center;
          appearance: none;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          justify-content: center;
          line-height: 0;
          position: relative;
        }

        .media-player__control {
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          height: ${playerStyles.control_size};
          width: ${playerStyles.control_size};
        }

        .media-player__control--primary {
          background: ${playerStyles.accent_background};
          border-color: rgba(var(--rgb-primary-color), 0.24);
          color: ${playerStyles.accent_color};
          height: calc(${playerStyles.control_size} + 4px);
          width: calc(${playerStyles.control_size} + 4px);
        }

        .media-player__control--active {
          background: rgba(var(--rgb-primary-color), 0.14);
          border-color: rgba(var(--rgb-primary-color), 0.2);
          color: ${playerStyles.accent_color};
        }

        .media-player__volume-button {
          flex: 0 0 auto;
          height: calc(${playerStyles.control_size} - 2px);
          padding: 0;
          width: calc(${playerStyles.control_size} - 2px);
        }

        .media-player__control ha-icon {
          align-items: center;
          display: inline-flex;
          font-size: calc(${playerStyles.control_size} * 0.56);
          height: calc(${playerStyles.control_size} * 0.56);
          justify-content: center;
          left: 50%;
          line-height: 1;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${playerStyles.control_size} * 0.56);
        }

        .media-player__volume-button ha-icon {
          align-items: center;
          display: inline-flex;
          font-size: calc(${playerStyles.control_size} * 0.48);
          height: calc(${playerStyles.control_size} * 0.48);
          justify-content: center;
          left: 50%;
          line-height: 1;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${playerStyles.control_size} * 0.48);
        }

        .media-player__dots {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          display: inline-flex;
          gap: 4px;
          justify-content: center;
          padding: 3px;
        }

        .media-player__dot {
          align-items: center;
          appearance: none;
          background: transparent;
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          height: 24px;
          justify-content: center;
          padding: 0;
          position: relative;
          width: 24px;
        }

        .media-player__dot::before {
          background: rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          content: "";
          height: ${playerStyles.dot_size};
          transition: background 160ms ease, width 160ms ease;
          width: ${playerStyles.dot_size};
        }

        .media-player__dot.active::before {
          background: ${playerStyles.accent_color};
          width: calc(${playerStyles.dot_size} + 10px);
        }

        .media-browser-backdrop {
          background: ${browserStyles.backdrop};
          inset: 0;
          position: fixed;
          z-index: ${Number(config.layout.z_index) + 10};
        }

        .media-browser-panel {
          background: ${browserStyles.background};
          border: ${browserStyles.border};
          border-radius: ${browserStyles.border_radius};
          box-shadow: ${playerStyles.box_shadow}, ${browserStyles.box_shadow};
          display: flex;
          flex-direction: column;
          gap: 14px;
          inset: max(16px, calc(env(safe-area-inset-top, 0px) + 12px)) 12px max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px)) 12px;
          margin: 0 auto;
          max-width: 560px;
          overflow: hidden;
          padding: 14px;
          position: fixed;
          z-index: ${Number(config.layout.z_index) + 11};
        }

        .media-browser__header {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: 40px minmax(0, 1fr) 40px;
        }

        .media-browser__header-copy {
          min-width: 0;
          text-align: center;
        }

        .media-browser__eyebrow {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .media-browser__title {
          color: var(--primary-text-color);
          font-size: 16px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-browser__header-button,
        .media-browser__item-play {
          align-items: center;
          appearance: none;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: 40px;
          justify-content: center;
          padding: 0;
          width: 40px;
        }

        .media-browser__header-button ha-icon,
        .media-browser__item-play ha-icon {
          font-size: 20px;
        }

        .media-browser__list {
          display: grid;
          gap: 10px;
          min-height: 0;
          overflow: auto;
          padding-right: 2px;
        }

        .media-browser__item {
          align-items: center;
          display: grid;
          gap: 8px;
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .media-browser__item-main {
          align-items: center;
          appearance: none;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: grid;
          gap: 12px;
          grid-template-columns: 46px minmax(0, 1fr) auto;
          min-height: 58px;
          padding: 8px 10px;
          text-align: left;
          width: 100%;
        }

        .media-browser__item-main:disabled {
          cursor: default;
          opacity: 0.72;
        }

        .media-browser__item-artwork {
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 14px;
          display: inline-flex;
          height: 46px;
          justify-content: center;
          overflow: hidden;
          width: 46px;
        }

        .media-browser__item-artwork img,
        .media-browser__item-artwork ha-icon {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .media-browser__item-artwork ha-icon {
          font-size: 22px;
          padding: 11px;
        }

        .media-browser__item-copy {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .media-browser__item-title {
          color: var(--primary-text-color);
          font-size: 14px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-browser__item-chevron {
          color: var(--secondary-text-color);
          font-size: 20px;
        }

        .media-browser__empty {
          align-items: center;
          color: var(--secondary-text-color);
          display: flex;
          flex: 1 1 auto;
          font-size: 13px;
          justify-content: center;
          line-height: 1.5;
          min-height: 120px;
          padding: 12px;
          text-align: center;
        }

        @media (max-width: 520px) {
          .media-player__footer {
            justify-content: center;
          }

          .media-player__idle-actions--tv,
          .media-player__tv-footer {
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .media-player__hero {
            grid-template-columns: ${playerStyles.artwork_size} minmax(0, 1fr);
          }
        }
      </style>
      <div class="spacer" aria-hidden="true"></div>
      <div class="dock">
        <div class="dock-inner">
          <div class="player-stack">
            ${contentMarkup}
          </div>
        </div>
      </div>
      ${mediaBrowserMarkup}
    `;

    this._restoreMediaBrowserScrollState();
    this._restoreTvPanelScrollState();
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaMediaPlayer);
}

class NodaliaMediaPlayerEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(NodaliaMediaPlayer.getStubConfig());
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showStyleSection = false;
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
  }

  set hass(hass) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender =
      !this._hass ||
      nextSignature !== this._entityOptionsSignature ||
      !this.shadowRoot?.innerHTML;

    this._hass = hass;
    this._entityOptionsSignature = nextSignature;

    if (!shouldRender) {
      return;
    }

    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    this._render();
    this._restoreFocusState(focusState);
  }

  _watchEditorControlTag(tagName) {
    if (!tagName || this._pendingEditorControlTags.has(tagName)) {
      return;
    }

    if (typeof customElements?.whenDefined !== "function" || customElements.get(tagName)) {
      return;
    }

    this._pendingEditorControlTags.add(tagName);
    customElements.whenDefined(tagName)
      .then(() => {
        this._pendingEditorControlTags.delete(tagName);

        if (!this._hass || !this.shadowRoot) {
          return;
        }

        const focusState = this._captureFocusState();
        this._render();
        this._restoreFocusState(focusState);
      })
      .catch(() => {
        this._pendingEditorControlTags.delete(tagName);
      });
  }

  _ensureEditorControlsReady() {
    this._watchEditorControlTag("ha-entity-picker");
    this._watchEditorControlTag("ha-selector");
    this._watchEditorControlTag("ha-icon-picker");
  }

  _captureFocusState() {
    const activeElement = this.shadowRoot?.activeElement;

    if (
      !(
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement
      )
    ) {
      return null;
    }

    const dataset = activeElement.dataset || {};
    const selector = dataset.field
      ? `[data-field="${escapeSelectorValue(dataset.field)}"]`
      : null;

    if (!selector) {
      return null;
    }

    const supportsSelection =
      typeof activeElement.selectionStart === "number" &&
      typeof activeElement.selectionEnd === "number";

    return {
      selector,
      selectionEnd: supportsSelection ? activeElement.selectionEnd : null,
      selectionStart: supportsSelection ? activeElement.selectionStart : null,
      type: activeElement.type,
    };
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return Object.entries(hass?.states || {})
      .filter(([entityId]) => entityId.startsWith("media_player."))
      .map(([entityId, state]) => `${entityId}:${String(state?.attributes?.friendly_name || "")}:${String(state?.attributes?.icon || "")}`)
      .sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }))
      .join("|");
  }

  _getEntityOptions(field = "players.0.entity", domains = []) {
    const normalizedDomains = Array.isArray(domains)
      ? domains.map(domain => String(domain || "").trim()).filter(Boolean)
      : [];
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => (
        !normalizedDomains.length
        || normalizedDomains.some(domain => entityId.startsWith(`${domain}.`))
      ))
      .map(([entityId, state]) => {
        const friendlyName = String(state?.attributes?.friendly_name || "").trim();
        return {
          value: entityId,
          label: friendlyName || entityId,
          displayLabel: friendlyName && friendlyName !== entityId
            ? `${friendlyName} (${entityId})`
            : entityId,
        };
      })
      .sort((left, right) => (
        left.label.localeCompare(right.label, "es", { sensitivity: "base" })
        || left.value.localeCompare(right.value, "es", { sensitivity: "base" })
      ));

    const currentValue = String(getByPath(this._config, field) || "").trim();
    if (currentValue && !options.some(option => option.value === currentValue)) {
      options.unshift({
        value: currentValue,
        label: currentValue,
        displayLabel: currentValue,
      });
    }

    return options;
  }

  _restoreFocusState(focusState) {
    if (!focusState?.selector || !this.shadowRoot) {
      return;
    }

    const target = this.shadowRoot.querySelector(focusState.selector);
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
    ) {
      return;
    }

    try {
      target.focus({ preventScroll: true });
    } catch (_error) {
      target.focus();
    }

    const canRestoreSelection =
      focusState.type !== "checkbox" &&
      typeof focusState.selectionStart === "number" &&
      typeof focusState.selectionEnd === "number" &&
      typeof target.setSelectionRange === "function";

    if (!canRestoreSelection) {
      return;
    }

    try {
      target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    } catch (_error) {
      // Ignore inputs that do not support selection ranges.
    }
  }

  _emitConfig() {
    const focusState = this._captureFocusState();
    const nextConfig = deepClone(this._config);

    if (!Array.isArray(nextConfig.players)) {
      nextConfig.players = [];
    }

    delete nextConfig.entity;
    this._config = normalizeConfig(compactConfig(nextConfig));
    this._render();
    this._restoreFocusState(focusState);
    fireEvent(this, "config-changed", {
      config: compactConfig(nextConfig),
    });
  }

  _setEditorConfig() {
    this._config = normalizeConfig(compactConfig(this._config));
  }

  _setFieldValue(path, value) {
    if (value === undefined || value === null || value === "") {
      deleteByPath(this._config, path);
      return;
    }

    setByPath(this._config, path, value);
  }

  _readFieldValue(input) {
    const valueType = input.dataset.valueType || "string";

    switch (valueType) {
      case "boolean":
        return Boolean(input.checked);
      case "number": {
        const trimmed = String(input.value || "").trim();
        if (!trimmed) {
          return undefined;
        }

        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : trimmed;
      }
      case "csv": {
        const values = arrayFromCsv(input.value);
        return values.length ? values : undefined;
      }
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      case "tristate":
        if (input.value === "true") {
          return true;
        }

        if (input.value === "false") {
          return false;
        }

        return undefined;
      default:
        return input.value;
    }
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement);

    if (!input?.dataset?.field) {
      return;
    }

    event.stopPropagation();

    const nextValue = this._readFieldValue(input);
    this._setFieldValue(input.dataset.field, nextValue);
    this._setEditorConfig();

    if (event.type === "change") {
      this._emitConfig();
    }
  }

  _onShadowValueChanged(event) {
    const control = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.field);

    if (!control?.dataset?.field) {
      return;
    }

    event.stopPropagation();

    const nextValue = typeof event.detail?.value === "string"
      ? event.detail.value
      : control.value;
    if (typeof control.dataset?.value === "string") {
      control.dataset.value = String(nextValue || "");
    }

    this._setFieldValue(control.dataset.field, nextValue);
    this._setEditorConfig();
    this._emitConfig();
  }

  _onShadowClick(event) {
    const toggleButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorToggle);

    if (toggleButton) {
      event.preventDefault();
      event.stopPropagation();

      if (toggleButton.dataset.editorToggle === "styles") {
        this._showStyleSection = !this._showStyleSection;
        this._render();
      }

      return;
    }

    const button = event
      .composedPath()
      .find(node => node instanceof HTMLButtonElement && node.dataset?.action);

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const action = button.dataset.action;
    const index = Number(button.dataset.index);

    if (action === "add-player") {
      this._config.players = Array.isArray(this._config.players) ? this._config.players : [];
      this._config.players.push({
        entity: "",
        label: "",
        tap_action: {
          action: "more-info",
        },
        power_action_off: {
          action: "default",
        },
        power_action_on: {
          action: "default",
        },
        power_action_unavailable: {
          action: "default",
        },
      });
      this._emitConfig();
      return;
    }

    if (!Number.isInteger(index) || index < 0 || index >= this._config.players.length) {
      return;
    }

    if (action === "remove-player") {
      this._config.players.splice(index, 1);
      this._emitConfig();
      return;
    }

    if (action === "move-player-up") {
      moveItem(this._config.players, index, index - 1);
      this._emitConfig();
      return;
    }

    if (action === "move-player-down") {
      moveItem(this._config.players, index, index + 1);
      this._emitConfig();
    }
  }

  _renderTextField(label, field, value, options = {}) {
    const tag = options.multiline ? "textarea" : "input";
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";
    const inputValue = value === undefined || value === null ? "" : String(value);

    if (tag === "textarea") {
      return `
        <label class="editor-field editor-field--full">
          <span>${escapeHtml(label)}</span>
          <textarea data-field="${escapeHtml(field)}" data-value-type="${escapeHtml(valueType)}" rows="${options.rows || 2}" ${placeholder}>${escapeHtml(inputValue)}</textarea>
        </label>
      `;
    }

    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <input
          type="${escapeHtml(inputType)}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(valueType)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        />
      </label>
    `;
  }

  _renderColorField(label, field, value, options = {}) {
    const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
    const currentValue = value === undefined || value === null || value === ""
      ? fallbackValue
      : String(value);
    const colorModel = getEditorColorModel(currentValue, fallbackValue);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="Color personalizado">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="color"
              data-alpha="${escapeHtml(String(colorModel.alpha))}"
              value="${escapeHtml(colorModel.hex)}"
              aria-label="${escapeHtml(label)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>
    `;
  }

  _renderTextareaField(label, field, value, options = {}) {
    return this._renderTextField(label, field, value, {
      ...options,
      multiline: true,
      fullWidth: options.fullWidth !== false,
    });
  }

  _renderCheckboxField(label, field, checked) {
    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-field="${escapeHtml(field)}"
          data-value-type="boolean"
          ${checked ? "checked" : ""}
        />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(label)}</span>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options, valueType = "string") {
    return `
      <label class="editor-field">
        <span>${escapeHtml(label)}</span>
        <select data-field="${escapeHtml(field)}" data-value-type="${escapeHtml(valueType)}">
          ${options
            .map(option => {
              const optionValue = option.value === undefined ? "auto" : String(option.value);
              const isSelected =
                value === option.value ||
                (option.value === undefined && value === undefined);

              return `
                <option value="${escapeHtml(optionValue)}" ${isSelected ? "selected" : ""}>
                  ${escapeHtml(option.label)}
                </option>
              `;
            })
            .join("")}
        </select>
      </label>
    `;
  }

  _renderActionConfigFields(title, path, action = {}) {
    return `
      <div class="player-editor-subgroup">
        <div class="player-editor-subgroup__title">${escapeHtml(title)}</div>
        <div class="editor-grid">
          ${this._renderSelectField(
            "Acción",
            `${path}.action`,
            action?.action || "default",
            [
              { value: "default", label: "Por defecto" },
              { value: "none", label: "Sin acción" },
              { value: "more-info", label: "Más información" },
              { value: "navigate", label: "Navegar" },
              { value: "url", label: "Abrir URL" },
              { value: "call-service", label: "Llamar servicio" },
            ],
          )}
          ${this._renderEntityField("Entidad de más información", `${path}.entity`, action?.entity, {
            placeholder: "media_player.salon",
          })}
          ${this._renderTextField("Ruta de navegación", `${path}.navigation_path`, action?.navigation_path, {
            placeholder: "/lovelace/salon",
          })}
          ${this._renderTextField("URL", `${path}.url`, action?.url || action?.url_path, {
            placeholder: "https://example.com",
          })}
          ${this._renderCheckboxField("Abrir URL en pestaña nueva", `${path}.new_tab`, action?.new_tab === true)}
          ${this._renderTextField("Servicio", `${path}.service`, action?.service, {
            placeholder: "input_boolean.turn_off",
          })}
          ${this._renderTextareaField("Datos del servicio (JSON)", `${path}.service_data`, action?.service_data, {
            placeholder: '{"entity_id":"input_boolean.media_power"}',
          })}
        </div>
      </div>
    `;
  }

  _renderEntityField(label, field, value, options = {}) {
    const inputValue = value === undefined || value === null ? "" : String(value);
    const domains = Array.isArray(options.domains)
      ? options.domains.map(domain => String(domain || "").trim()).filter(Boolean).join(",")
      : "";
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
          data-domains="${escapeHtml(domains)}"
        ></div>
      </div>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="icon-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
        ></div>
      </div>
    `;
  }

  _renderPlayerCard(player, index) {
    return `
      <div class="player-editor-card">
        <div class="player-editor-card__header">
          <div class="player-editor-card__title">Reproductor ${index + 1}</div>
          <div class="player-editor-card__actions">
            <button type="button" data-action="move-player-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>Subir</button>
            <button type="button" data-action="move-player-down" data-index="${index}" ${index === this._config.players.length - 1 ? "disabled" : ""}>Bajar</button>
            <button type="button" data-action="remove-player" data-index="${index}" class="danger">Eliminar</button>
          </div>
        </div>
        <div class="player-editor-subgroup">
          <div class="player-editor-subgroup__title">Principal</div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityField("Entidad", `players.${index}.entity`, player.entity, {
              domains: ["media_player"],
              fullWidth: true,
            })}
            ${this._renderIconPickerField("Icono", `players.${index}.icon`, player.icon, {
              placeholder: "mdi:speaker",
              fullWidth: true,
            })}
            ${this._renderTextField("Nombre corto", `players.${index}.label`, player.label, {
              placeholder: "Salón",
              fullWidth: true,
            })}
            ${this._renderTextField("Título fijo", `players.${index}.title`, player.title, {
              fullWidth: true,
            })}
            ${this._renderTextField("Subtítulo fijo", `players.${index}.subtitle`, player.subtitle, {
              fullWidth: true,
            })}
          </div>
        </div>
        <div class="player-editor-subgroup">
          <div class="player-editor-subgroup__title">Comportamiento</div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Modo TV / Apple TV", `players.${index}.tv_mode`, player.tv_mode === true)}
            ${this._renderCheckboxField("Mostrar fuentes y apps", `players.${index}.show_source_controls`, player.show_source_controls !== false)}
            ${this._renderSelectField(
              "Visibilidad",
              `players.${index}.show`,
              player.show,
              [
                { value: undefined, label: "Automática" },
                { value: true, label: "Siempre" },
                { value: false, label: "Nunca" },
              ],
              "tristate",
            )}
            ${this._renderTextField("Máximo de fuentes", `players.${index}.max_sources`, player.max_sources, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("Ruta de medios", `players.${index}.browse_path`, player.browse_path, {
              placeholder: "/media-browser/browser",
            })}
            ${this._renderTextField("Imagen personalizada", `players.${index}.image`, player.image, {
              placeholder: "/local/cover.png",
            })}
            ${this._renderTextField("Estados visibles", `players.${index}.show_states`, Array.isArray(player.show_states) ? player.show_states.join(", ") : "", {
              placeholder: "playing, paused",
              valueType: "csv",
              fullWidth: true,
            })}
          </div>
        </div>
        ${this._renderActionConfigFields("Acción al tocar", `players.${index}.tap_action`, player.tap_action)}
        ${this._renderActionConfigFields("Botón de encendido cuando está apagado o en espera", `players.${index}.power_action_off`, player.power_action_off)}
        ${this._renderActionConfigFields("Botón de encendido cuando está activo", `players.${index}.power_action_on`, player.power_action_on)}
        ${this._renderActionConfigFields("Botón de encendido cuando no está disponible", `players.${index}.power_action_unavailable`, player.power_action_unavailable)}
      </div>
    `;
  }

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "players.0.entity";
    const nextValue = host.dataset.value || "";
    const allowedDomains = String(host.dataset.domains || "")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      if (allowedDomains.length) {
        control.includeDomains = allowedDomains;
        control.entityFilter = stateObj => allowedDomains.some(domain => String(stateObj?.entity_id || "").startsWith(`${domain}.`));
      }
      control.allowCustomEntity = true;
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: allowedDomains.length === 1
          ? { domain: allowedDomains[0] }
          : {},
      };
    } else {
      control = document.createElement("select");
      this._getEntityOptions(field, allowedDomains).forEach(option => {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.displayLabel;
        control.appendChild(optionElement);
      });
      control.addEventListener("change", this._onShadowInput);
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      control.hass = this._hass;
    }

    if ("value" in control) {
      control.value = nextValue;
    }

    if (control.tagName !== "SELECT") {
      control.addEventListener("value-changed", this._onShadowValueChanged);
    }

    host.replaceChildren(control);
  }

  _mountIconPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "players.0.icon";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    let control = null;

    if (customElements.get("ha-icon-picker")) {
      control = document.createElement("ha-icon-picker");
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        icon: {},
      };
    } else {
      control = document.createElement("input");
      control.type = "text";
      control.placeholder = placeholder;
      control.addEventListener("input", this._onShadowInput);
      control.addEventListener("change", this._onShadowInput);
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      control.hass = this._hass;
    }

    if ("value" in control) {
      control.value = nextValue;
    }

    if (control.tagName !== "INPUT") {
      control.addEventListener("value-changed", this._onShadowValueChanged);
    }

    host.replaceChildren(control);
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        .editor {
          color: var(--primary-text-color);
          display: grid;
          gap: 16px;
        }

        .editor-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 18px;
          display: grid;
          gap: 14px;
          padding: 16px;
        }

        .editor-section__header {
          display: grid;
          gap: 4px;
        }

        .editor-section__title {
          font-size: 15px;
          font-weight: 700;
        }

        .editor-section__hint {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }

        .editor-section__actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 2px;
        }

        .editor-section__toggle-button {
          align-items: center;
          appearance: none;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          gap: 8px;
          min-height: 34px;
          padding: 0 12px;
        }

        .editor-section__toggle-button ha-icon {
          --mdc-icon-size: 16px;
        }

        .editor-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .editor-grid--stacked {
          grid-template-columns: 1fr;
        }

        .editor-field,
        .editor-toggle {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .editor-field--full {
          grid-column: 1 / -1;
        }

        .editor-field > span,
        .editor-toggle > span {
          font-size: 12px;
          font-weight: 600;
        }

        .editor-field input,
        .editor-field select,
        .editor-field textarea {
          appearance: none;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 40px;
          padding: 10px 12px;
          width: 100%;
        }

        .editor-control-host input,
        .editor-control-host select,
        .editor-control-host textarea {
          appearance: none;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 40px;
          padding: 10px 12px;
          width: 100%;
        }

        .editor-color-field {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          min-height: 40px;
        }

        .editor-color-picker {
          align-items: center;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: 40px;
          justify-content: center;
          position: relative;
          width: 40px;
        }

        .editor-color-picker input {
          cursor: pointer;
          inset: 0;
          opacity: 0;
          position: absolute;
        }

        .editor-color-picker:hover,
        .editor-color-picker:focus-within {
          border-color: rgba(255, 255, 255, 0.22);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .editor-color-swatch {
          --editor-swatch: #71c0ff;
          background:
            linear-gradient(var(--editor-swatch), var(--editor-swatch)),
            conic-gradient(from 90deg, rgba(255, 255, 255, 0.06) 25%, rgba(0, 0, 0, 0.12) 0 50%, rgba(255, 255, 255, 0.06) 0 75%, rgba(0, 0, 0, 0.12) 0);
          background-position: center;
          background-size: cover, 10px 10px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          display: block;
          height: 18px;
          width: 18px;
        }

        .editor-color-picker .editor-color-swatch {
          height: 22px;
          width: 22px;
        }

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }

        .editor-field textarea {
          min-height: 72px;
          resize: vertical;
        }

        .editor-toggle {
          align-items: center;
          grid-template-columns: auto 1fr;
          padding-top: 20px;
        }

        .editor-toggle input {
          accent-color: var(--primary-color);
          height: 18px;
          margin: 0;
          width: 18px;
        }

        .editor-actions {
          display: flex;
          justify-content: flex-start;
        }

        button {
          appearance: none;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          min-height: 34px;
          padding: 0 12px;
        }

        button.danger {
          color: var(--error-color);
        }

        button:disabled {
          cursor: default;
          opacity: 0.45;
        }

        .player-editor-list {
          display: grid;
          gap: 12px;
        }

        .player-editor-card {
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          display: grid;
          gap: 12px;
          padding: 14px;
        }

        .player-editor-subgroup {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }

        .player-editor-subgroup__title {
          font-size: 12px;
          font-weight: 700;
        }

        .player-editor-card__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .player-editor-card__title {
          font-size: 13px;
          font-weight: 700;
        }

        .player-editor-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .empty-note {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }

          .editor-toggle {
            padding-top: 0;
          }

          .player-editor-card__header {
            align-items: start;
            flex-direction: column;
          }

          .player-editor-card__actions {
            justify-content: flex-start;
          }
        }
      
        :is(.editor-toggle, .editor-checkbox) {
          align-items: center;
          column-gap: 10px;
          cursor: pointer;
          grid-auto-flow: row;
          grid-template-columns: auto minmax(0, 1fr);
          justify-content: stretch;
          min-height: 40px;
          padding-top: 0;
          position: relative;
        }

        :is(.editor-toggle, .editor-checkbox) input {
          block-size: 1px;
          inline-size: 1px;
          margin: 0;
          opacity: 0;
          pointer-events: none;
          position: absolute;
        }

        .editor-toggle__switch {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
          display: inline-flex;
          font-size: 0;
          height: 22px;
          line-height: 0;
          position: relative;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
          width: 40px;
        }

        .editor-toggle__switch::before {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
          content: "";
          height: 18px;
          left: 1px;
          position: absolute;
          top: 1px;
          transition: transform 160ms ease;
          width: 18px;
        }

        .editor-toggle__label {
          min-width: 0;
        }

        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }

        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch::before {
          transform: translateX(18px);
        }

        :is(.editor-toggle, .editor-checkbox) input:focus-visible + .editor-toggle__switch {
          box-shadow:
            0 0 0 3px rgba(255, 255, 255, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
</style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">General</div>
            <div class="editor-section__hint">Opciones generales del reproductor y cuándo debe mostrarse la tarjeta.</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "Mostrar tarjeta",
              "show",
              config.show,
              [
                { value: undefined, label: "Automático" },
                { value: true, label: "Siempre" },
                { value: false, label: "Nunca" },
              ],
              "tristate",
            )}
            ${this._renderCheckboxField("Mostrar estado textual", "show_state", config.show_state === true)}
            ${this._renderCheckboxField("Usar carátula como fondo", "album_cover_background", config.album_cover_background !== false)}
            ${this._renderCheckboxField("Mostrar badge de no disponible", "show_unavailable_badge", config.show_unavailable_badge !== false)}
            ${this._renderCheckboxField("Mostrar en escritorio", "layout.show_desktop", config.layout.show_desktop === true)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Layout</div>
            <div class="editor-section__hint">Ideal si quieres usarlo fijo arriba o abajo del dashboard.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Tarjeta fija", "layout.fixed", config.layout.fixed === true)}
            ${this._renderCheckboxField("Reservar espacio", "layout.reserve_space", config.layout.reserve_space === true)}
            ${this._renderSelectField(
              "Posición",
              "layout.position",
              config.layout.position,
              [
                { value: "bottom", label: "Abajo" },
                { value: "top", label: "Arriba" },
              ],
            )}
            ${this._renderTextField("Altura reservada", "layout.reserve_height", config.layout.reserve_height)}
            ${this._renderTextField("Offset", "layout.offset", config.layout.offset)}
            ${this._renderTextField("Margen lateral", "layout.side_margin", config.layout.side_margin)}
            ${this._renderTextField("Ancho máximo", "layout.max_width", config.layout.max_width)}
            ${this._renderTextField("Breakpoint móvil", "layout.mobile_breakpoint", config.layout.mobile_breakpoint, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("Z-index", "layout.z_index", config.layout.z_index, {
              type: "number",
              valueType: "number",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Reproductores</div>
            <div class="editor-section__hint">Añade, reordena y personaliza cada reproductor visible en la tarjeta.</div>
          </div>
          <div class="player-editor-list">
            ${
              Array.isArray(config.players) && config.players.length
                ? config.players.map((player, index) => this._renderPlayerCard(player, index)).join("")
                : '<div class="empty-note">Todavía no has añadido ningún reproductor.</div>'
            }
          </div>
          <div class="editor-actions">
            <button type="button" data-action="add-player">Añadir reproductor</button>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Respuesta háptica</div>
            <div class="editor-section__hint">Respuesta táctil opcional para los controles del reproductor.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Activar respuesta háptica", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("Usar vibración si no hay háptica", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "Estilo",
              "haptics.style",
              hapticStyle,
              [
                { value: "selection", label: "Selección" },
                { value: "light", label: "Ligero" },
                { value: "medium", label: "Medio" },
                { value: "heavy", label: "Intenso" },
                { value: "success", label: "Éxito" },
                { value: "warning", label: "Aviso" },
                { value: "failure", label: "Fallo" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Estilos</div>
            <div class="editor-section__hint">Ajustes visuales del reproductor principal y del navegador de medios.</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${this._showStyleSection ? "Ocultar ajustes de estilo" : "Mostrar ajustes de estilo"}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("Fondo del reproductor", "styles.player.background", config.styles.player.background)}
                  ${this._renderTextField("Borde del reproductor", "styles.player.border", config.styles.player.border)}
                  ${this._renderTextField("Radio del borde", "styles.player.border_radius", config.styles.player.border_radius)}
                  ${this._renderTextField("Sombra", "styles.player.box_shadow", config.styles.player.box_shadow)}
                  ${this._renderTextField("Padding", "styles.player.padding", config.styles.player.padding)}
                  ${this._renderTextField("Altura mínima", "styles.player.min_height", config.styles.player.min_height)}
                  ${this._renderTextField("Tamaño de portada", "styles.player.artwork_size", config.styles.player.artwork_size)}
                  ${this._renderTextField("Tamaño de portada TV", "styles.player.tv_artwork_size", config.styles.player.tv_artwork_size)}
                  ${this._renderTextField("Tamaño de botones", "styles.player.control_size", config.styles.player.control_size)}
                  ${this._renderTextField("Tamaño del título", "styles.player.title_size", config.styles.player.title_size)}
                  ${this._renderTextField("Tamaño del subtítulo", "styles.player.subtitle_size", config.styles.player.subtitle_size)}
                  ${this._renderTextField("Alto del contenedor del slider", "styles.player.slider_wrap_height", config.styles.player.slider_wrap_height)}
                  ${this._renderTextField("Grosor del slider", "styles.player.slider_height", config.styles.player.slider_height)}
                  ${this._renderTextField("Tamaño del thumb del slider", "styles.player.slider_thumb_size", config.styles.player.slider_thumb_size)}
                  ${this._renderColorField("Color del progreso", "styles.player.progress_color", config.styles.player.progress_color)}
                  ${this._renderColorField("Fondo del progreso", "styles.player.progress_background", config.styles.player.progress_background)}
                  ${this._renderColorField("Overlay de portada", "styles.player.overlay_color", config.styles.player.overlay_color)}
                  ${this._renderTextField("Tamaño de indicadores", "styles.player.dot_size", config.styles.player.dot_size)}
                  ${this._renderColorField("Color de acento", "styles.player.accent_color", config.styles.player.accent_color)}
                  ${this._renderColorField("Fondo de acento", "styles.player.accent_background", config.styles.player.accent_background)}
                  ${this._renderColorField("Fondo del navegador", "styles.browser.background", config.styles.browser.background)}
                  ${this._renderTextField("Borde del navegador", "styles.browser.border", config.styles.browser.border)}
                  ${this._renderTextField("Radio del navegador", "styles.browser.border_radius", config.styles.browser.border_radius)}
                  ${this._renderTextField("Sombra del navegador", "styles.browser.box_shadow", config.styles.browser.box_shadow)}
                  ${this._renderColorField("Veladura del navegador", "styles.browser.backdrop", config.styles.browser.backdrop)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="entity-picker"]')
      .forEach(host => this._mountEntityPicker(host));

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="icon-picker"]')
      .forEach(host => this._mountIconPicker(host));

    this._ensureEditorControlsReady();
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaMediaPlayerEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Media Player",
  description: "Media player fijo con estetica Nodalia y editor visual.",
  preview: true,
});
