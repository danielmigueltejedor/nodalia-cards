const CARD_TAG = "nodalia-media-player";
const EDITOR_TAG = "nodalia-media-player-editor";
const CARD_VERSION = "0.1.0";
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
  album_cover_background: true,
  haptics: {
    enabled: false,
    style: "selection",
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
      control_size: "38px",
      title_size: "15px",
      subtitle_size: "12px",
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

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const mediaConfig = isObject(rawConfig?.media_player) ? rawConfig.media_player : null;

  if (mediaConfig) {
    if (mediaConfig.show !== undefined) {
      config.show = mediaConfig.show;
    }
    if (mediaConfig.album_cover_background !== undefined) {
      config.album_cover_background = mediaConfig.album_cover_background;
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
        browse_path: config.browse_path,
      },
    ];
  }

  config.players = Array.isArray(config.players) ? config.players.filter(player => player?.entity) : [];
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
    this._onResize = () => {
      this._render();
    };
    this._onWindowKeyDown = event => {
      if (event.key === "Escape" && this._mediaBrowserState) {
        event.preventDefault();
        this._closeMediaBrowser();
      }
    };
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
  }

  connectedCallback() {
    window.addEventListener("resize", this._onResize);
    window.addEventListener("keydown", this._onWindowKeyDown);
    this._render();
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("keydown", this._onWindowKeyDown);
    if (this._mediaTicker) {
      window.clearInterval(this._mediaTicker);
      this._mediaTicker = null;
    }
  }

  setConfig(config) {
    this._config = normalizeConfig(config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 3;
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

    const hapticStyle = String(style || "selection");

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

  _getPlayerTitle(player, state) {
    if (player.title) {
      return player.title;
    }

    return state.attributes.media_title || state.attributes.friendly_name || player.entity;
  }

  _getPlayerSubtitle(player, state) {
    if (player.subtitle) {
      return player.subtitle;
    }

    return (
      state.attributes.media_artist ||
      state.attributes.media_series_title ||
      state.attributes.media_album_name ||
      state.attributes.app_name ||
      this._getPlayerStateLabel(state.state)
    );
  }

  _getPlayerArtwork(player, state) {
    return player.image || state.attributes.entity_picture || null;
  }

  _getPlayerStateLabel(stateValue) {
    switch (stateValue) {
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

  _supportsVolumeControl(state) {
    return typeof state?.attributes?.volume_level === "number";
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

  _syncTicker(players) {
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
      this._mediaTicker = window.setInterval(() => this._render(), 1000);
      return;
    }

    if (!shouldTick && this._mediaTicker) {
      window.clearInterval(this._mediaTicker);
      this._mediaTicker = null;
    }
  }

  _callService(action) {
    if (!this._hass || !action?.service) {
      return;
    }

    const [domain, service] = String(action.service).split(".");
    if (!domain || !service) {
      return;
    }

    this._hass.callService(domain, service, action.service_data || action.data || {});
  }

  _runPlayerAction(player, defaultAction = null) {
    const action = player.tap_action || defaultAction;

    if (!action || action.action === "none") {
      return;
    }

    switch (action.action) {
      case "more-info": {
        const entityId = action.entity || player.entity;
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

  _handleMediaControl(control, entityId, options = {}) {
    if (!this._hass || !entityId) {
      return;
    }

    switch (control) {
      case "play":
        this._hass.callService("media_player", "media_play", { entity_id: entityId });
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
      case "volume-up": {
        const currentVolume = Number.isFinite(options.volume) ? options.volume : 0;
        this._hass.callService("media_player", "volume_set", {
          entity_id: entityId,
          volume_level: clamp(currentVolume + 0.08, 0, 1),
        });
        break;
      }
      case "browse-media":
        this._openMediaBrowser(entityId, options.path || "");
        break;
      default:
        break;
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

    const token = this._mediaBrowserRequestToken + 1;
    this._mediaBrowserRequestToken = token;
    this._mediaBrowserState = {
      entityId,
      fallbackPath,
      isMusicAssistant: this._isMusicAssistantPlayer(
        this._findPlayerConfig(entityId) || { entity: entityId },
        this._hass?.states?.[entityId],
      ),
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
        error: "No se pudieron cargar los medios.",
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

  _shouldHideMediaBrowserItem(item) {
    if (!this._shouldFilterMusicAssistantBrowserItems() || !item) {
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
    const mediaControlButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaControl);

    if (mediaControlButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._handleMediaControl(mediaControlButton.dataset.mediaControl, mediaControlButton.dataset.entity, {
        path: mediaControlButton.dataset.mediaPath,
        volume: Number(mediaControlButton.dataset.mediaVolume),
      });
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
            <div class="media-browser__eyebrow">Music Assistant</div>
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
    const title = this._getPlayerTitle(player, state);
    const subtitle = this._getPlayerSubtitle(player, state);
    const subtitleMarkup = subtitle && normalizeTextKey(subtitle) !== normalizeTextKey(title)
      ? `<div class="media-player__subtitle">${escapeHtml(subtitle)}</div>`
      : "";
    const progress = this._getPlayerProgress(state);
    const chips = this._getPlayerChips(player, state, progress, title, subtitle);
    const playerLabel = this._getPlayerLabel(player, state);
    const statusLabel = this._getPlayerStateLabel(state.state);
    const browsePath = this._getPlayerBrowsePath(player, state);
    const isIdleLayout = this._shouldUseIdleLayout(player, state);
    const volumeLevel = Number(state.attributes.volume_level ?? 0);
    const volumeSupported = this._supportsVolumeControl(state);
    const playerStyles = this._config.styles.player;

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
    const browseMarkup = browsePath
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
    const browseIdleMarkup = browsePath
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
    const infoRailMarkup = `
      <div class="media-player__info-rail ${isIdleLayout ? "media-player__info-rail--idle" : ""}">
        ${
          playerLabel
            ? `
              <span class="media-player__chip media-player__chip--device media-player__chip--top">
                ${escapeHtml(playerLabel)}
              </span>
            `
            : ""
        }
        <span class="media-player__chip media-player__chip--${escapeHtml(state.state || "default")} media-player__chip--status">
          ${escapeHtml(statusLabel)}
        </span>
      </div>
    `;
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

    if (isIdleLayout) {
      return `
        <div
          class="media-player-card media-player-card--idle ${this._config.album_cover_background && artwork ? "has-album-background" : ""}"
          data-media-card-index="${this._activePlayerIndex}"
        >
          ${
            this._config.album_cover_background && artwork
              ? `<div class="media-player__album-bg" style="background-image:url('${escapeHtml(artwork)}');"></div>`
              : ""
          }
          <div class="media-player__content media-player__content--idle">
            <div class="media-player__idle-hero">
              <div class="media-player__artwork media-player__artwork--idle">
                ${
                  artwork
                    ? `<img src="${escapeHtml(artwork)}" alt="${escapeHtml(playerLabel)}" />`
                    : `<ha-icon icon="${escapeHtml(player.icon || "mdi:music")}"></ha-icon>`
                }
              </div>
              <div class="media-player__idle-main">
                ${infoRailMarkup}
                ${idleControlsMarkup}
              </div>
            </div>
            ${dotsMarkup ? `<div class="media-player__switcher media-player__switcher--idle">${dotsMarkup}</div>` : ""}
          </div>
        </div>
      `;
    }

    return `
      <div
        class="media-player-card ${this._config.album_cover_background && artwork ? "has-album-background" : ""}"
        data-media-card-index="${this._activePlayerIndex}"
      >
        ${
          this._config.album_cover_background && artwork
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
            <div class="media-player__artwork">
              ${
                artwork
                  ? `<img src="${escapeHtml(artwork)}" alt="${escapeHtml(title)}" />`
                  : `<ha-icon icon="${escapeHtml(player.icon || "mdi:music")}"></ha-icon>`
              }
            </div>
            <div class="media-player__hero-copy">
              <div class="media-player__hero-top">
                <div class="media-player__meta">
                  <div class="media-player__title">${escapeHtml(title)}</div>
                  ${subtitleMarkup}
                </div>
                ${infoRailMarkup}
              </div>
            </div>
          </div>
          <div class="media-player__center-stack">
            ${dotsMarkup ? `<div class="media-player__switcher">${dotsMarkup}</div>` : ""}
            <div class="media-player__transport-row">
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
            </div>
          </div>
          <div class="media-player__footer">
            ${chipsMarkup}
          </div>
        </div>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    this._captureMediaBrowserScrollState();

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
          pointer-events: auto;
          width: 100%;
        }

        .player-stack {
          display: grid;
          gap: 0;
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

        .media-player__hero-copy {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .media-player__hero-top {
          align-items: start;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .media-player__info-rail {
          align-items: end;
          display: grid;
          gap: 6px;
          justify-items: end;
          max-width: clamp(118px, 34vw, 210px);
          min-width: 0;
          pointer-events: none;
        }

        .media-player__info-rail--idle {
          align-items: start;
          gap: 4px;
          justify-items: start;
          max-width: none;
        }

        .media-player__artwork {
          align-items: center;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 22px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 10px 24px rgba(0, 0, 0, 0.18);
          display: flex;
          height: ${playerStyles.artwork_size};
          justify-content: center;
          overflow: hidden;
          width: ${playerStyles.artwork_size};
        }

        .media-player__artwork--idle {
          border-radius: 18px;
          height: 56px;
          width: 56px;
        }

        .media-player__artwork img,
        .media-player__artwork ha-icon {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .media-player__artwork ha-icon {
          font-size: calc(${playerStyles.artwork_size} * 0.52);
          padding: 14px;
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

        .media-player__footer {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
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
          max-width: 100%;
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

        .media-player__volume-button {
          flex: 0 0 auto;
          height: calc(${playerStyles.control_size} - 2px);
          padding: 0;
          width: calc(${playerStyles.control_size} - 2px);
        }

        .media-player__control ha-icon {
          align-items: center;
          display: inline-flex;
          font-size: 20px;
          height: 20px;
          justify-content: center;
          left: 50%;
          line-height: 1;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 20px;
        }

        .media-player__volume-button ha-icon {
          align-items: center;
          display: inline-flex;
          font-size: 18px;
          height: 18px;
          justify-content: center;
          left: 50%;
          line-height: 1;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 18px;
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
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
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
    return Object.keys(hass?.states || {})
      .filter(entityId => entityId.startsWith("media_player."))
      .sort((left, right) => left.localeCompare(right, "es"))
      .join("|");
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

  _onShadowClick(event) {
    const button = event
      .composedPath()
      .find(node => node instanceof HTMLButtonElement && node.dataset?.action);

    if (!button) {
      return;
    }

    event.preventDefault();

    const action = button.dataset.action;
    const index = Number(button.dataset.index);

    if (action === "add-player") {
      this._config.players = Array.isArray(this._config.players) ? this._config.players : [];
      this._config.players.push({
        entity: "",
        label: "",
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

  _renderCheckboxField(label, field, checked) {
    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-field="${escapeHtml(field)}"
          data-value-type="boolean"
          ${checked ? "checked" : ""}
        />
        <span>${escapeHtml(label)}</span>
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
        <div class="editor-grid">
          ${this._renderTextField("Entidad", `players.${index}.entity`, player.entity, {
            placeholder: "media_player.salon",
          })}
          ${this._renderTextField("Nombre corto", `players.${index}.label`, player.label, {
            placeholder: "Salon",
          })}
          ${this._renderTextField("Titulo fijo", `players.${index}.title`, player.title)}
          ${this._renderTextField("Subtitulo fijo", `players.${index}.subtitle`, player.subtitle)}
          ${this._renderTextField("Icono", `players.${index}.icon`, player.icon, {
            placeholder: "mdi:speaker",
          })}
          ${this._renderTextField("Imagen", `players.${index}.image`, player.image, {
            placeholder: "/local/cover.png",
          })}
          ${this._renderTextField("Ruta medios", `players.${index}.browse_path`, player.browse_path, {
            placeholder: "/media-browser/browser",
          })}
          ${this._renderSelectField(
            "Visibilidad",
            `players.${index}.show`,
            player.show,
            [
              { value: undefined, label: "Automatica" },
              { value: true, label: "Siempre" },
              { value: false, label: "Nunca" },
            ],
            "tristate",
          )}
          ${this._renderTextField("Estados visibles", `players.${index}.show_states`, Array.isArray(player.show_states) ? player.show_states.join(", ") : "", {
            placeholder: "playing, paused",
            valueType: "csv",
            fullWidth: true,
          })}
        </div>
      </div>
    `;
  }

  _getEntityOptionsMarkup() {
    const entityIds = Object.keys(this._hass?.states || {})
      .filter(entityId => entityId.startsWith("media_player."))
      .sort((left, right) => left.localeCompare(right, "es"));

    if (!entityIds.length) {
      return "";
    }

    return `
      <datalist id="media-player-entities">
        ${entityIds.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "selection";

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

        .editor-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
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
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">General</div>
            <div class="editor-section__hint">Configuracion basica de la tarjeta y comportamiento general del reproductor.</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "Mostrar tarjeta",
              "show",
              config.show,
              [
                { value: undefined, label: "Automatico" },
                { value: true, label: "Siempre" },
                { value: false, label: "Nunca" },
              ],
              "tristate",
            )}
            ${this._renderCheckboxField("Fondo con caratula", "album_cover_background", config.album_cover_background !== false)}
            ${this._renderCheckboxField("Mostrar en escritorio", "layout.show_desktop", config.layout.show_desktop === true)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Layout</div>
            <div class="editor-section__hint">Ideal para usarlo como tarjeta fija abajo o arriba del dashboard.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Fija", "layout.fixed", config.layout.fixed === true)}
            ${this._renderCheckboxField("Reservar espacio", "layout.reserve_space", config.layout.reserve_space === true)}
            ${this._renderSelectField(
              "Posicion",
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
            ${this._renderTextField("Ancho maximo", "layout.max_width", config.layout.max_width)}
            ${this._renderTextField("Breakpoint movil", "layout.mobile_breakpoint", config.layout.mobile_breakpoint, {
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
            <div class="editor-section__title">Players</div>
            <div class="editor-section__hint">Anade, reordena y personaliza los reproductores visibles en la tarjeta.</div>
          </div>
          <div class="player-editor-list">
            ${
              Array.isArray(config.players) && config.players.length
                ? config.players.map((player, index) => this._renderPlayerCard(player, index)).join("")
                : '<div class="empty-note">No hay reproductores anadidos todavia.</div>'
            }
          </div>
          <div class="editor-actions">
            <button type="button" data-action="add-player">Anadir reproductor</button>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Haptics</div>
            <div class="editor-section__hint">Respuesta haptica opcional para los botones del player.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Activar haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("Fallback con vibracion", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "Estilo",
              "haptics.style",
              hapticStyle,
              [
                { value: "selection", label: "Selection" },
                { value: "light", label: "Light" },
                { value: "medium", label: "Medium" },
                { value: "heavy", label: "Heavy" },
                { value: "success", label: "Success" },
                { value: "warning", label: "Warning" },
                { value: "failure", label: "Failure" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Estilos</div>
            <div class="editor-section__hint">Ajustes visuales del reproductor grande y del navegador de medios.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Background", "styles.player.background", config.styles.player.background)}
            ${this._renderTextField("Border", "styles.player.border", config.styles.player.border)}
            ${this._renderTextField("Radius", "styles.player.border_radius", config.styles.player.border_radius)}
            ${this._renderTextField("Shadow", "styles.player.box_shadow", config.styles.player.box_shadow)}
            ${this._renderTextField("Padding", "styles.player.padding", config.styles.player.padding)}
            ${this._renderTextField("Altura minima", "styles.player.min_height", config.styles.player.min_height)}
            ${this._renderTextField("Tamano portada", "styles.player.artwork_size", config.styles.player.artwork_size)}
            ${this._renderTextField("Tamano controles", "styles.player.control_size", config.styles.player.control_size)}
            ${this._renderTextField("Tamano titulo", "styles.player.title_size", config.styles.player.title_size)}
            ${this._renderTextField("Tamano subtitulo", "styles.player.subtitle_size", config.styles.player.subtitle_size)}
            ${this._renderTextField("Color progreso", "styles.player.progress_color", config.styles.player.progress_color)}
            ${this._renderTextField("Fondo progreso", "styles.player.progress_background", config.styles.player.progress_background)}
            ${this._renderTextField("Overlay portada", "styles.player.overlay_color", config.styles.player.overlay_color)}
            ${this._renderTextField("Tamano dots", "styles.player.dot_size", config.styles.player.dot_size)}
            ${this._renderTextField("Color acento", "styles.player.accent_color", config.styles.player.accent_color)}
            ${this._renderTextField("Fondo acento", "styles.player.accent_background", config.styles.player.accent_background)}
            ${this._renderTextField("Radius browser", "styles.browser.border_radius", config.styles.browser.border_radius)}
            ${this._renderTextField("Background browser", "styles.browser.background", config.styles.browser.background)}
          </div>
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('input[data-field^="players."][data-field$=".entity"]')
      .forEach(input => {
        input.setAttribute("list", "media-player-entities");
      });
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
