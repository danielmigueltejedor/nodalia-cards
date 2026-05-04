const CARD_TAG = "nodalia-navigation-bar";
const EDITOR_TAG = "nodalia-navigation-bar-editor";
const CARD_VERSION = "0.6.5";
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
  {
    patterns: [
      "artists",
      "artistas",
      "artistes",
      "артисты",
      "artiști",
      "艺术家",
      "καλλιτέχνες",
    ],
    icon: "mdi:account-music",
  },
  {
    patterns: [
      "albums",
      "albumes",
      "álbumes",
      "álbums",
      "albuns",
      "альбомы",
      "专辑",
      "άλμπουμ",
    ],
    icon: "mdi:album",
  },
  {
    patterns: [
      "tracks",
      "songs",
      "canciones",
      "temas",
      "pistas",
      "faixas",
      "músicas",
      "треки",
      "曲目",
      "κομμάτια",
      "piese",
    ],
    icon: "mdi:music-note",
  },
  {
    patterns: [
      "playlists",
      "listas",
      "listas de reproduccion",
      "listas de reproducción",
      "listas de reprodução",
      "плейлисты",
      "播放列表",
      "liste de redare",
      "λίστες αναπαραγωγής",
    ],
    icon: "mdi:playlist-music",
  },
  {
    patterns: [
      "radio stations",
      "radios",
      "emisoras",
      "stations",
      "estações",
      "радио",
      "радиостанции",
      "广播电台",
      "stații radio",
      "ραδιοφωνικοί",
    ],
    icon: "mdi:radio",
  },
  { patterns: ["podcasts", "подкасты", "播客", "podcasturi"], icon: "mdi:podcast" },
  {
    patterns: ["audiobooks", "audiolibros", "audiolivros", "аудиокниги", "有声书", "cărți audio", "ακουστικά βιβλία"],
    icon: "mdi:book-music",
  },
  {
    patterns: ["genres", "generos", "géneros", "жанры", "流派", "genuri", "είδη"],
    icon: "mdi:shape",
  },
  {
    patterns: [
      "favorites",
      "favourites",
      "favoritos",
      "избранное",
      "收藏",
      "favorite",
      "αγαπημένα",
    ],
    icon: "mdi:heart",
  },
  {
    patterns: [
      "recent",
      "recently",
      "recientes",
      "recentemente",
      "недавно",
      "最近",
      "πρόσφατα",
      "redări recente",
    ],
    icon: "mdi:history",
  },
  {
    patterns: [
      "search",
      "buscar",
      "busqueda",
      "búsqueda",
      "pesquisar",
      "поиск",
      "搜索",
      "căutare",
      "αναζήτηση",
    ],
    icon: "mdi:magnify",
  },
];

const DEFAULT_CONFIG = {
  title: "",
  show_labels: false,
  animations: {
    enabled: true,
    bar_duration: 160,
    popup_duration: 220,
    media_duration: 240,
    button_bounce_duration: 220,
    dock_entrance_duration: 420,
  },
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  layout: {
    fixed: true,
    reserve_space: true,
    reserve_height: "calc(90px + env(safe-area-inset-bottom, 0px))",
    position: "bottom",
    stack_gap: "12px",
    show_desktop: false,
    mobile_breakpoint: 1279,
    z_index: 2,
    side_margin: "0px",
    offset: "0px",
    full_width: false,
  },
  styles: {
    bar: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "28px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px)) 16px",
      min_height: "90px",
      gap: "20px",
      justify_content: "space-evenly",
      max_width: "100%",
      backdrop_filter: "none",
    },
    button: {
      size: "54px",
      border_radius: "999px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      active_color: "var(--primary-text-color)",
      active_background: "color-mix(in srgb, var(--primary-text-color) 8%, transparent)",
      icon_size: "28px",
      icon_offset_x: "0px",
      icon_offset_y: "-1px",
      label_color: "var(--secondary-text-color)",
      active_label_color: "var(--primary-text-color)",
      label_size: "12px",
      label_gap: "6px",
    },
    badge: {
      background: "var(--error-color)",
      color: "var(--text-primary-color, #fff)",
      min_size: "18px",
      font_size: "11px",
    },
    popup: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "24px",
      box_shadow: "0 18px 40px rgba(0, 0, 0, 0.22)",
      layout: "auto",
      label_size: "13px",
      padding: "12px",
      min_width: "220px",
      max_width: "380px",
      item_gap: "12px",
      item_size: "48px",
      backdrop: "rgba(0, 0, 0, 0.18)",
    },
    media_player: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "28px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "14px",
      min_height: "104px",
      artwork_size: "64px",
      control_size: "40px",
      title_size: "14px",
      subtitle_size: "12px",
      progress_color: "var(--primary-color)",
      progress_background: "rgba(var(--rgb-primary-color), 0.14)",
      overlay_color: "rgba(0, 0, 0, 0.32)",
      dot_size: "8px",
    },
  },
  media_player: {
    show: undefined,
    show_desktop: false,
    album_cover_background: true,
    gap: "0px",
    reserve_height: "116px",
    players: [],
  },
  routes: [],
};

const STUB_CONFIG = {
  show_labels: false,
  routes: [
    {
      icon: "mdi:home-assistant",
      label: "Inicio",
      path: "/lovelace/principal",
    },
    {
      icon: "mdi:flash",
      label: "Energia",
      path: "/lovelace/energia",
    },
    {
      icon: "mdi:thermostat",
      label: "Clima",
      path: "/lovelace/termostatos",
    },
    {
      icon: "mdi:security",
      label: "Seguridad",
      path: "/lovelace/seguridad",
    },
  ],
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

function deepEqual(a, b) {
  if (Object.is(a, b)) {
    return true;
  }
  if (a == null || b == null) {
    return a === b;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== "object") {
    return false;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  if (Array.isArray(b)) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  return keysA.every(key => deepEqual(a[key], b[key]));
}

function stripEqualToDefaults(config, defaults) {
  if (defaults === undefined || defaults === null) {
    return deepClone(config);
  }
  if (config === undefined || config === null) {
    return undefined;
  }
  if (Array.isArray(config)) {
    return deepEqual(config, defaults) ? undefined : deepClone(config);
  }
  if (isObject(config) && isObject(defaults)) {
    const out = {};
    for (const key of Object.keys(config)) {
      const cv = config[key];
      const dv = defaults[key];
      if (!(key in defaults)) {
        out[key] = deepClone(cv);
        continue;
      }
      if (deepEqual(cv, dv)) {
        continue;
      }
      if (isObject(cv) && !Array.isArray(cv) && isObject(dv) && !Array.isArray(dv)) {
        const stripped = stripEqualToDefaults(cv, dv);
        if (stripped !== undefined) {
          out[key] = stripped;
        }
      } else {
        out[key] = deepClone(cv);
      }
    }
    return Object.keys(out).length ? out : undefined;
  }
  return deepEqual(config, defaults) ? undefined : config;
}

function setByPath(target, path, value) {
  const parts = path.split(".");
  let cursor = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(cursor[key])) {
      cursor[key] = {};
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
    if (!isObject(cursor[key])) {
      return;
    }
    cursor = cursor[key];
  }

  delete cursor[parts[parts.length - 1]];
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

function appendQueryParam(url, key, value) {
  const rawUrl = String(url || "").trim();
  if (!rawUrl || value === null || value === undefined || value === "") {
    return rawUrl;
  }

  const encodedKey = encodeURIComponent(String(key));
  const encodedValue = encodeURIComponent(String(value));
  const existingPattern = new RegExp(`([?&])${encodedKey}=[^&]*`);
  if (existingPattern.test(rawUrl)) {
    return rawUrl.replace(existingPattern, `$1${encodedKey}=${encodedValue}`);
  }

  return `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}${encodedKey}=${encodedValue}`;
}

function arrayFromCsv(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
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

function parsePrimitiveValue(value) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

function escapeSelectorValue(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value).replaceAll('"', '\\"');
}

function normalizePath(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  if (/^[a-z]+:\/\//i.test(value)) {
    return null;
  }

  try {
    const url = new URL(value, window.location.origin);
    return (url.pathname || "/").replace(/\/+$/, "") || "/";
  } catch (_error) {
    return (value.split(/[?#]/)[0] || "/").replace(/\/+$/, "") || "/";
  }
}

function matchPath(currentPath, candidatePath, mode) {
  if (!candidatePath) {
    return false;
  }

  if (mode === "prefix") {
    return currentPath === candidatePath || currentPath.startsWith(`${candidatePath}/`);
  }

  return currentPath === candidatePath;
}

function normalizeConfig(config) {
  const baseConfig = { ...config };

  if (!Array.isArray(baseConfig.routes) && Array.isArray(baseConfig.items)) {
    baseConfig.routes = baseConfig.items;
    delete baseConfig.items;
  }

  if (!Array.isArray(baseConfig.routes)) {
    throw new Error('"routes" is required and must be an array');
  }

  return mergeConfig(DEFAULT_CONFIG, baseConfig);
}

class NodaliaNavigationBarCard extends HTMLElement {
  static getStubConfig() {
    return deepClone(STUB_CONFIG);
  }

  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._renderedRoutes = [];
    this._popupState = null;
    this._mediaBrowserState = null;
    this._mediaBrowserRequestToken = 0;
    this._popupPositionFrame = null;
    this._activeMediaPlayerIndex = 0;
    this._mediaPlayerExpanded = false;
    this._mediaTicker = null;
    this._lastRenderSignature = "";
    this._animateDockEntranceNext = true;
    this._lastShouldHide = false;
    this._playDockEntrance = false;
    this._onResize = () => {
      this._closePopup(false);
      this._closeMediaBrowser(false);
      this._render();
    };
    this._onLocationChange = () => {
      this._closePopup(false);
      this._closeMediaBrowser(false);
      this._render();
    };
    this._onWindowKeyDown = event => {
      if (event.key === "Escape" && this._mediaBrowserState) {
        event.preventDefault();
        this._closeMediaBrowser();
        return;
      }

      if (event.key === "Escape" && this._popupState) {
        event.preventDefault();
        this._closePopup();
      }
    };
    this._onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.hidden) {
        if (this._mediaTicker) {
          window.clearInterval(this._mediaTicker);
          this._mediaTicker = null;
        }
        return;
      }

      this._render();
    };
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
  }

  connectedCallback() {
    window.addEventListener("resize", this._onResize);
    window.addEventListener("popstate", this._onLocationChange);
    window.addEventListener("location-changed", this._onLocationChange);
    window.addEventListener("keydown", this._onWindowKeyDown);
    document.addEventListener("visibilitychange", this._onVisibilityChange);
    this._render();
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("popstate", this._onLocationChange);
    window.removeEventListener("location-changed", this._onLocationChange);
    window.removeEventListener("keydown", this._onWindowKeyDown);
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    if (this._popupPositionFrame) {
      cancelAnimationFrame(this._popupPositionFrame);
      this._popupPositionFrame = null;
    }
    if (this._mediaTicker) {
      window.clearInterval(this._mediaTicker);
      this._mediaTicker = null;
    }
  }

  setConfig(config) {
    this._config = normalizeConfig(config);
    this._lastRenderSignature = "";
    this._render();
  }

  set hass(hass) {
    const nextSignature = this._getRenderSignature(hass);
    this._hass = hass;
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 1,
      min_columns: 4,
    };
  }

  _getTrackedEntityIds() {
    const entityIds = new Set();

    (this._config?.routes || []).forEach(route => {
      if (route?.badge?.entity) {
        entityIds.add(route.badge.entity);
      }
      (route?.popup || []).forEach(item => {
        if (item?.badge?.entity) {
          entityIds.add(item.badge.entity);
        }
      });
    });

    (this._config?.media_player?.players || []).forEach(player => {
      if (player?.entity) {
        entityIds.add(player.entity);
      }
    });

    const tag = window.NodaliaI18n.localeTag(window.NodaliaI18n.resolveLanguage(this._hass, this._config?.language));
    return [...entityIds].sort((left, right) => left.localeCompare(right, tag));
  }

  _getRenderSignature(hass = this._hass) {
    const routeBadgeStates = (this._config?.routes || []).flatMap((route, routeIndex) => {
      const items = [{ badge: route?.badge, scope: `route:${routeIndex}` }];
      (route?.popup || []).forEach((item, popupIndex) => {
        items.push({ badge: item?.badge, scope: `popup:${routeIndex}:${popupIndex}` });
      });

      return items
        .filter(item => item?.badge?.entity)
        .map(item => {
          const state = hass?.states?.[item.badge.entity] || null;
          const attribute = String(item.badge.attribute || "");
          return {
            scope: item.scope,
            entityId: String(item.badge.entity || ""),
            state: String(state?.state || ""),
            badgeAttribute: attribute,
            badgeValue: attribute ? String(state?.attributes?.[attribute] ?? "") : String(state?.state || ""),
          };
        });
    });

    const mediaPlayerStates = (this._config?.media_player?.players || [])
      .filter(player => player?.entity)
      .map(player => {
        const state = hass?.states?.[player.entity] || null;
        const attrs = state?.attributes || {};
        return {
          entityId: String(player.entity || ""),
          state: String(state?.state || ""),
          friendlyName: String(attrs.friendly_name || ""),
          entityPicture: String(attrs.entity_picture || ""),
          mediaTitle: String(attrs.media_title || ""),
          mediaArtist: String(attrs.media_artist || ""),
          mediaSeriesTitle: String(attrs.media_series_title || ""),
          mediaAlbumName: String(attrs.media_album_name || ""),
          appName: String(attrs.app_name || ""),
          source: String(attrs.source || ""),
          mediaChannel: String(attrs.media_channel || ""),
          volumeLevel: Number(attrs.volume_level ?? -1),
          mediaDuration: Number(attrs.media_duration ?? -1),
          supportedFeatures: Number(attrs.supported_features ?? 0),
          sourceList: Array.isArray(attrs.source_list) ? attrs.source_list.join("|") : "",
        };
      });

    return JSON.stringify({
      locale: window.NodaliaI18n.resolveLanguage(hass, this._config?.language),
      user: String(hass?.user?.id || ""),
      routeBadgeStates,
      mediaPlayerStates,
      mediaExpanded: Boolean(this._mediaPlayerExpanded),
      activePlayerIndex: Number(this._activeMediaPlayerIndex || 0),
      popupOpen: Boolean(this._popupState),
      mediaBrowserOpen: Boolean(this._mediaBrowserState),
    });
  }

  _triggerHaptic(style = this._config?.haptics?.style) {
    if (!this._config?.haptics?.enabled) {
      return;
    }

    const hapticStyle = String(style || "medium");

    try {
      fireEvent(this, "haptic", hapticStyle);
    } catch (_error) {
      // Ignore event dispatch issues and try browser vibration fallback below.
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

  _onShadowClick(event) {
    const popupCloseTrigger = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.popupClose === "true");

    if (popupCloseTrigger) {
      event.preventDefault();
      event.stopPropagation();
      this._closePopup();
      return;
    }

    const mediaControlButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaControl);

    if (mediaControlButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._handleMediaControl(
        mediaControlButton.dataset.mediaControl,
        mediaControlButton.dataset.entity,
        {
          muted: mediaControlButton.dataset.mediaMuted === "true",
          path: mediaControlButton.dataset.mediaPath,
          volume: Number(mediaControlButton.dataset.mediaVolume),
        },
      );
      return;
    }

    const mediaToggleButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaToggle);

    if (mediaToggleButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._mediaPlayerExpanded = mediaToggleButton.dataset.mediaToggle === "expand";
      this._render();
      return;
    }

    const mediaDotButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaIndex !== undefined);

    if (mediaDotButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._activeMediaPlayerIndex = Number(mediaDotButton.dataset.mediaIndex);
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
        return;
      }
    }

    const mediaCard = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaCardIndex !== undefined);

    if (mediaCard) {
      const visiblePlayers = this._getVisibleMediaPlayers();
      const player = visiblePlayers[Number(mediaCard.dataset.mediaCardIndex)];

      if (player) {
        event.preventDefault();
        event.stopPropagation();
        this._triggerHaptic();
        this._runAction(player, {
          closePopup: false,
          defaultAction: {
            action: "more-info",
            entity: player.entity,
          },
        });
      }
      return;
    }

    const popupButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.popupItemIndex !== undefined);

    if (popupButton) {
      const routeIndex = Number(popupButton.dataset.popupRouteIndex);
      const popupItemIndex = Number(popupButton.dataset.popupItemIndex);
      const route = this._renderedRoutes[routeIndex];
      const popupItems = this._getPopupItems(route);
      const popupItem = popupItems[popupItemIndex];

      if (popupItem) {
        event.preventDefault();
        event.stopPropagation();
        this._triggerHaptic();
        this._runAction(popupItem, {
          closePopup: true,
        });
      }
      return;
    }

    const routeButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.routeIndex !== undefined);

    if (!routeButton) {
      return;
    }

    const index = Number(routeButton.dataset.routeIndex);
    const route = this._renderedRoutes[index];

    if (!route) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();
    this._runAction(route, {
      anchorElement: routeButton,
    });
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

  _shouldHideForScreen(config) {
    if (this._isInEditMode()) {
      return false;
    }

    if (config.layout.show_desktop) {
      return false;
    }

    return window.innerWidth > Number(config.layout.mobile_breakpoint || 1279);
  }

  _isItemVisible(item) {
    if (!item || item.hidden === true || item.show === false) {
      return false;
    }

    if (this._isInEditMode()) {
      return true;
    }

    const currentUserId = this._hass?.user?.id;
    if (Array.isArray(item.users) && item.users.length > 0) {
      return item.users.includes(currentUserId);
    }

    return true;
  }

  _getVisibleRoutes() {
    if (!this._config) {
      return [];
    }

    return this._config.routes.filter(route => this._isItemVisible(route));
  }

  _getPopupItems(route) {
    if (!route || !Array.isArray(route.popup)) {
      return [];
    }

    return route.popup.filter(item => this._isItemVisible(item));
  }

  _getRoutePath(route) {
    if (typeof route.path === "string" && route.path) {
      return route.path;
    }

    if (route.tap_action?.action === "navigate" && route.tap_action.navigation_path) {
      return route.tap_action.navigation_path;
    }

    return null;
  }

  _isNavItemActive(item, currentPath) {
    if (!item) {
      return false;
    }

    if (item.selected === true) {
      return true;
    }

    const candidates = [];
    const mainPath = normalizePath(this._getRoutePath(item));
    if (mainPath) {
      candidates.push(mainPath);
    }

    if (Array.isArray(item.active_paths)) {
      item.active_paths.forEach(path => {
        const normalized = normalizePath(path);
        if (normalized) {
          candidates.push(normalized);
        }
      });
    }

    return candidates.some(path => matchPath(currentPath, path, item.match || "exact"));
  }

  _isRouteActive(route, currentPath) {
    if (this._isNavItemActive(route, currentPath)) {
      return true;
    }

    return this._getPopupItems(route).some(item => this._isNavItemActive(item, currentPath));
  }

  _getBadge(route) {
    const badge = route.badge;

    if (badge === undefined || badge === null || badge === false) {
      return null;
    }

    if (typeof badge === "string" || typeof badge === "number") {
      return {
        content: String(badge),
        background: this._config.styles.badge.background,
        color: this._config.styles.badge.color,
      };
    }

    if (badge.show === false) {
      return null;
    }

    let content = badge.content;

    if (content === undefined && badge.entity && this._hass?.states?.[badge.entity]) {
      const stateObject = this._hass.states[badge.entity];
      content = badge.attribute ? stateObject.attributes?.[badge.attribute] : stateObject.state;
    }

    if (content === undefined || content === null || content === "") {
      return null;
    }

    if (!badge.show_unavailable && ["unknown", "unavailable", "none"].includes(String(content).toLowerCase())) {
      return null;
    }

    if (!badge.show_zero && Number(content) === 0) {
      return null;
    }

    if (!Number.isNaN(Number(content)) && Number(content) > Number(badge.max || 99)) {
      content = `${badge.max || 99}+`;
    }

    return {
      content: String(content),
      background: badge.background || this._config.styles.badge.background,
      color: badge.color || this._config.styles.badge.color,
    };
  }

  _getRouteLabel(route) {
    return route?.label || route?.name || route?.title || "";
  }

  _shouldShowRouteLabels(routes) {
    if (!this._config?.show_labels) {
      return false;
    }

    return routes.some(route => Boolean(this._getRouteLabel(route)));
  }

  _getPopupLayout(route) {
    const layout = route?.popup_layout || this._config?.styles?.popup?.layout || "auto";
    return ["auto", "vertical", "horizontal"].includes(layout) ? layout : "auto";
  }

  _getPopupMetrics(route, items) {
    const popupStyles = this._config?.styles?.popup || {};
    const popupMinWidth = Number.parseFloat(popupStyles.min_width || "220") || 220;
    const popupMaxWidth =
      Number.parseFloat(popupStyles.max_width || popupStyles.min_width || "380") ||
      Math.max(popupMinWidth, 380);
    const itemSize = Number.parseFloat(popupStyles.item_size || "48") || 48;
    const itemGap = Number.parseFloat(popupStyles.item_gap || "12") || 12;
    const panelPadding = Number.parseFloat(popupStyles.padding || "12") || 12;
    const viewportWidth = Math.max(240, (window.innerWidth || popupMaxWidth) - 24);
    const maxWidth = Math.max(Math.min(popupMaxWidth, viewportWidth), Math.min(popupMinWidth, viewportWidth));
    const minWidth = Math.min(popupMinWidth, maxWidth);
    const hasText = items.some(item => Boolean(this._getRouteLabel(item) || item.description));
    const itemMinWidth = itemSize + (hasText ? 42 : 20);
    const maxColumnsThatFit = Math.max(
      1,
      Math.min(
        items.length || 1,
        Math.floor((maxWidth - panelPadding * 2 + itemGap) / (itemMinWidth + itemGap)),
      ),
    );

    let columns = 1;
    const layout = this._getPopupLayout(route);
    if (layout === "horizontal") {
      columns = maxColumnsThatFit;
    } else if (layout === "auto") {
      columns = items.length <= 2 ? 1 : maxColumnsThatFit;
    }

    columns = Math.max(1, Math.min(columns, items.length || 1));

    const rows = Math.max(1, Math.ceil((items.length || 1) / columns));
    const widthFromColumns =
      columns * itemMinWidth + Math.max(0, columns - 1) * itemGap + panelPadding * 2;
    const minimumWidth = Math.min(
      maxWidth,
      !hasText && columns === 1 ? Math.max(itemSize + panelPadding * 2 + 20, 88) : minWidth,
    );
    const width = clamp(widthFromColumns, minimumWidth, maxWidth);
    const rowHeight = itemSize + (hasText ? 56 : 26);
    const viewportHeight = Math.max(160, (window.innerHeight || 320) - 48);
    const estimatedHeight = Math.min(
      Math.max(120, rows * rowHeight + panelPadding * 2),
      viewportHeight,
    );

    return {
      columns,
      estimatedHeight,
      hasText,
      itemMinWidth,
      layout,
      width,
    };
  }

  _renderIcon(route, isActive) {
    const image = isActive ? route.image_active || route.image : route.image || route.image_active;

    if (image) {
      return `<img class="nav-image" src="${escapeHtml(image)}" alt="${escapeHtml(this._getRouteLabel(route) || "navigation item")}" />`;
    }

    const icon = isActive ? route.icon_active || route.icon : route.icon || route.icon_active;
    if (!icon) {
      return `<span class="nav-icon nav-icon--placeholder"></span>`;
    }

    return `<ha-icon class="nav-icon" icon="${escapeHtml(icon)}"></ha-icon>`;
  }

  _getRouteAction(route, defaultAction = null) {
    if (!route) {
      return defaultAction;
    }

    if (route.tap_action) {
      return route.tap_action;
    }

    if (Array.isArray(route.popup) && route.popup.length > 0) {
      return {
        action: "open-popup",
      };
    }

    if (route.path) {
      return {
        action: "navigate",
        navigation_path: route.path,
      };
    }

    return defaultAction;
  }

  _navigate(path) {
    if (!path) {
      return;
    }

    window.history.pushState(null, "", path);
    window.dispatchEvent(new Event("location-changed"));
  }

  _callService(action) {
    if (!this._hass || !action?.service) {
      return;
    }

    const [domain, service] = String(action.service).split(".");
    if (!domain || !service) {
      return;
    }

    this._hass.callService(domain, service, action.service_data || {}, action.target);
  }

  _closePopup(shouldRender = true) {
    if (!this._popupState) {
      return;
    }

    if (this._popupPositionFrame) {
      cancelAnimationFrame(this._popupPositionFrame);
      this._popupPositionFrame = null;
    }

    this._popupState = null;
    if (shouldRender) {
      this._render();
    }
  }

  _schedulePopupPositionSync() {
    if (!this._popupState || !this.shadowRoot) {
      return;
    }

    if (this._popupPositionFrame) {
      cancelAnimationFrame(this._popupPositionFrame);
    }

    this._popupPositionFrame = requestAnimationFrame(() => {
      this._popupPositionFrame = null;
      this._syncPopupPosition();
    });
  }

  _syncPopupPosition() {
    if (!this._popupState || !this.shadowRoot) {
      return;
    }

    const panel = this.shadowRoot.querySelector(".popup-panel");
    const anchor = this.shadowRoot.querySelector(
      `[data-route-index="${escapeSelectorValue(this._popupState.routeIndex)}"]`,
    );

    if (!(panel instanceof HTMLElement) || !(anchor instanceof HTMLElement)) {
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const preferredGap = this._popupState.layout === "horizontal" ? 4 : 6;
    const previousDirection = this._popupState.direction;
    let direction = previousDirection;
    let left = anchorRect.left + anchorRect.width / 2 - panelRect.width / 2;

    left = clamp(left, 12, Math.max(12, window.innerWidth - panelRect.width - 12));

    let top = direction === "up"
      ? anchorRect.top - panelRect.height - preferredGap
      : anchorRect.bottom + preferredGap;

    if (direction === "up" && top < 12) {
      direction = "down";
      top = anchorRect.bottom + preferredGap;
    }

    if (direction === "down" && top + panelRect.height > window.innerHeight - 12) {
      direction = "up";
      top = anchorRect.top - panelRect.height - preferredGap;
    }

    top = clamp(top, 12, Math.max(12, window.innerHeight - panelRect.height - 12));

    const nextLeft = `${left}px`;
    const nextTop = `${top}px`;

    this._popupState = {
      ...this._popupState,
      direction,
      left: nextLeft,
      top: nextTop,
      width: `${panelRect.width}px`,
    };

    if (direction !== previousDirection) {
      this._render();
      return;
    }

    panel.style.left = nextLeft;
    panel.style.top = nextTop;
  }

  _openPopup(route, anchorElement) {
    const items = this._getPopupItems(route);
    if (!items.length || !anchorElement) {
      return;
    }

    const anchorRect = anchorElement.getBoundingClientRect();
    const popupMetrics = this._getPopupMetrics(route, items);
    const popupWidth = popupMetrics.width;
    const estimatedHeight = popupMetrics.estimatedHeight;
    const preferredGap = popupMetrics.layout === "horizontal" ? 4 : 6;
    let direction = this._config.layout.position === "top" ? "down" : "up";
    let left = anchorRect.left + anchorRect.width / 2 - popupWidth / 2;

    left = clamp(left, 12, window.innerWidth - popupWidth - 12);

    let top = direction === "up"
      ? anchorRect.top - estimatedHeight - preferredGap
      : anchorRect.bottom + preferredGap;

    if (direction === "up" && top < 12) {
      direction = "down";
      top = anchorRect.bottom + preferredGap;
    }

    if (direction === "down" && top + estimatedHeight > window.innerHeight - 12) {
      direction = "up";
      top = anchorRect.top - estimatedHeight - preferredGap;
    }

    top = clamp(top, 12, Math.max(12, window.innerHeight - estimatedHeight - 12));

    const routeIndex = this._renderedRoutes.indexOf(route);
    if (routeIndex < 0) {
      return;
    }

    this._popupState = {
      columns: popupMetrics.columns,
      direction,
      itemMinWidth: `${popupMetrics.itemMinWidth}px`,
      layout: popupMetrics.layout,
      left: `${left}px`,
      top: `${top}px`,
      route,
      routeIndex,
      width: `${popupWidth}px`,
    };
    this._render();
  }

  _getReservedHeight(showMediaPlayer, showMediaPlayerToggle = false) {
    const baseHeight = this._config.layout.reserve_height;
    const mediaGap = this._config.media_player.gap || "0px";

    if (!showMediaPlayer) {
      if (showMediaPlayerToggle) {
        return `calc(${baseHeight} + ${mediaGap} + 48px)`;
      }

      return baseHeight;
    }

    const mediaHeight =
      this._config.media_player.reserve_height ||
      this._config.styles.media_player.min_height;

    return `calc(${baseHeight} + ${mediaGap} + ${mediaHeight})`;
  }

  _shouldShowMediaPlayerOnCurrentScreen() {
    if (this._isInEditMode()) {
      return true;
    }

    const isDesktop = window.innerWidth > Number(this._config.layout.mobile_breakpoint || 1279);
    return !isDesktop || this._config.media_player.show_desktop;
  }

  _getVisibleMediaPlayers() {
    if (!this._config?.media_player || !Array.isArray(this._config.media_player.players)) {
      return [];
    }

    if (this._config.media_player.show === false) {
      return [];
    }

    if (!this._shouldShowMediaPlayerOnCurrentScreen()) {
      return [];
    }

    return this._config.media_player.players.filter(player => {
      if (!player || !player.entity) {
        return false;
      }

      if (player.show === false) {
        return false;
      }

      const state = this._hass?.states?.[player.entity];
      if (!state) {
        return false;
      }

      if (this._config.media_player.show === true || player.show === true || this._isInEditMode()) {
        return true;
      }

      const visibleStates = Array.isArray(player.show_states) && player.show_states.length > 0
        ? player.show_states
        : ["playing", "paused"];

      return visibleStates.includes(state.state);
    });
  }

  _getMediaPlayerTitle(player, state) {
    if (player.title) {
      return player.title;
    }

    return state.attributes.media_title || state.attributes.friendly_name || player.entity;
  }

  _getMediaPlayerPlayerLabel(player, state) {
    return (
      player.label ||
      player.name ||
      state.attributes.friendly_name ||
      player.entity
    );
  }

  _getMediaPlayerSubtitle(player, state) {
    if (player.subtitle) {
      return player.subtitle;
    }

    return (
      state.attributes.media_artist ||
      state.attributes.media_series_title ||
      state.attributes.media_album_name ||
      state.attributes.app_name ||
      this._getMediaPlayerStateLabel(state.state)
    );
  }

  _resolveMediaUrl(value, options = {}) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }

    const isAbsolute = /^(?:https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:");
    const baseUrl = isAbsolute
      ? raw
      : typeof this._hass?.hassUrl === "function"
        ? this._hass.hassUrl(raw.startsWith("/") ? raw : `/${raw.replace(/^\.?\//, "")}`)
        : raw;

    return appendQueryParam(baseUrl, "nodalia_ts", options.cacheToken);
  }

  _getArtworkCacheToken(state) {
    if (!state) {
      return "";
    }

    return [
      String(state.last_updated || state.last_changed || ""),
      String(state.attributes?.entity_picture || state.attributes?.entity_picture_local || ""),
      String(state.attributes?.media_title || ""),
      String(state.attributes?.media_artist || ""),
      String(state.attributes?.media_album_name || ""),
      String(state.attributes?.app_name || ""),
    ].filter(Boolean).join("|");
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

  _getMediaPlayerArtwork(player, state) {
    if (player.image) {
      return this._resolveMediaUrl(player.image);
    }

    if (!this._shouldShowTvArtwork(player, state)) {
      return null;
    }

    const artwork =
      state.attributes.entity_picture_local ||
      state.attributes.entity_picture ||
      "";

    return artwork
      ? this._resolveMediaUrl(artwork, {
          cacheToken: this._getArtworkCacheToken(state),
        })
      : null;
  }

  _getMediaPlayerStateLabel(stateValue) {
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

  _getMediaPlayerProgress(state) {
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

  _getMediaPlayerSourceLabel(state) {
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

  _getMediaPlayerBrowsePath(player, state) {
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

  _playPickedMedia(entityId, pickedMedia) {
    const mediaContentId = pickedMedia?.item?.media_content_id;
    const mediaContentType = pickedMedia?.item?.media_content_type;

    if (!this._hass || !entityId || !mediaContentId || !mediaContentType) {
      return;
    }

    this._hass.callService("media_player", "play_media", {
      entity_id: entityId,
      media_content_id: mediaContentId,
      media_content_type: mediaContentType,
    });
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

  _showEntityMediaBrowser(entityId, fallbackPath = "") {
    this._openMediaBrowser(entityId, fallbackPath);
    return true;
  }

  _closeMediaBrowser(shouldRender = true) {
    if (!this._mediaBrowserState) {
      return;
    }

    this._mediaBrowserState = null;
    this._mediaBrowserRequestToken += 1;

    if (shouldRender) {
      this._render();
    }
  }

  async _openMediaBrowser(entityId, fallbackPath = "") {
    if (!entityId) {
      return;
    }

    this._closePopup(false);
    const token = this._mediaBrowserRequestToken + 1;
    this._mediaBrowserRequestToken = token;
    this._mediaBrowserState = {
      entityId,
      fallbackPath,
      isMusicAssistant: this._isMusicAssistantPlayer(
        { entity: entityId },
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
        entityId,
        fallbackPath,
        isMusicAssistant: this._isMusicAssistantPlayer(
          { entity: entityId },
          this._hass?.states?.[entityId],
        ),
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
        this._navigate(fallbackPath);
        return;
      }

      this._mediaBrowserState = {
        entityId,
        fallbackPath,
        isMusicAssistant: this._isMusicAssistantPlayer(
          { entity: entityId },
          this._hass?.states?.[entityId],
        ),
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
    const lang = window.NodaliaI18n.resolveLanguage(this._hass, this._config?.language ?? "auto");
    const dict = window.NodaliaI18n.strings(lang).navigationMusicAssist || {};
    const enDict = window.NodaliaI18n.strings("en").navigationMusicAssist || {};

    if (!fallback) {
      return dict.browseFallback || enDict.browseFallback || "Item";
    }

    if (!this._mediaBrowserState?.isMusicAssistant) {
      return fallback;
    }

    const key = normalizeTextKey(fallback);
    return dict[key] || enDict[key] || fallback;
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

  _getMediaPlayerChips(player, state, progress, title, subtitle) {
    const chips = [];
    const seen = new Set();
    const subtitleKey = normalizeTextKey(subtitle);
    const titleKey = normalizeTextKey(title);

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

    addChip(this._getMediaPlayerSourceLabel(state), "source");

    if (progress) {
      addChip(`${formatDuration(progress.position)} / ${formatDuration(progress.duration)}`, "time");
    }

    return chips.slice(0, 4);
  }

  _syncMediaTicker(visiblePlayers) {
    if (typeof document !== "undefined" && document.hidden) {
      if (this._mediaTicker) {
        window.clearInterval(this._mediaTicker);
        this._mediaTicker = null;
      }
      return;
    }

    const shouldTick = visiblePlayers.some(player => {
      const state = this._hass?.states?.[player.entity];
      const progress = state ? this._getMediaPlayerProgress(state) : null;
      return state?.state === "playing" && progress;
    });

    if (shouldTick && !this._mediaTicker) {
      this._mediaTicker = window.setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) {
          return;
        }

        this._render();
      }, 1000);
      return;
    }

    if (!shouldTick && this._mediaTicker) {
      window.clearInterval(this._mediaTicker);
      this._mediaTicker = null;
    }
  }

  _handleMediaControl(control, entityId, options = {}) {
    if (!this._hass || !entityId) {
      return;
    }

    switch (control) {
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
        this._showEntityMediaBrowser(entityId, options.path || "/media-browser/browser");
        break;
      default:
        break;
    }
  }

  _runAction(route, options = {}) {
    const action = this._getRouteAction(route, options.defaultAction || null);

    if (!action || action.action === "none") {
      return;
    }

    switch (action.action) {
      case "navigate":
        this._navigate(action.navigation_path || route.path);
        break;
      case "open-popup":
        this._openPopup(route, options.anchorElement);
        return;
      case "url": {
        const url = action.url_path || action.url || route.url || route.path;
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
      case "toggle": {
        const entityId = action.entity || route.entity;
        if (!entityId || !this._hass) {
          return;
        }

        this._hass.callService("homeassistant", "toggle", { entity_id: entityId });
        break;
      }
      case "more-info": {
        const entityId = action.entity || route.entity;
        if (!entityId) {
          return;
        }

        fireEvent(this, "hass-more-info", { entityId });
        break;
      }
      default:
        // Unsupported actions are ignored so the card stays safe to use.
        break;
    }

    if (options.closePopup) {
      this._closePopup();
    }
  }

  _renderPopup(currentPath) {
    if (!this._popupState?.route) {
      return "";
    }

    if (this._popupState.routeIndex < 0 || !this._renderedRoutes[this._popupState.routeIndex]) {
      this._popupState = null;
      return "";
    }

    const popupItems = this._getPopupItems(this._popupState.route);
    if (!popupItems.length) {
      this._popupState = null;
      return "";
    }
    const popupHasText = popupItems.some(item => Boolean(this._getRouteLabel(item) || item.description));
    const isCompactPopup = !popupHasText && Number(this._popupState.columns || 1) === 1;

    const popupMarkup = popupItems
      .map((item, popupIndex) => {
        const isActive = this._isNavItemActive(item, currentPath);
        const badge = this._getBadge(item);
        const label = this._getRouteLabel(item);
        const hasLabel = Boolean(label);
        const hasDescription = Boolean(item.description);
        const isIconOnly = !hasLabel && !hasDescription;
        const ariaLabel = label || item.description || item.path || `Popup ${popupIndex + 1}`;
        const itemStyle = [
          item.background ? `--popup-route-background:${item.background};` : "",
          item.color ? `--popup-route-color:${item.color};` : "",
          item.active_color ? `--popup-route-active-color:${item.active_color};` : "",
          item.active_background ? `--popup-route-active-background:${item.active_background};` : "",
        ]
          .filter(Boolean)
          .join("");

        return `
          <button
            class="popup-item ${isActive ? "active" : ""} ${isIconOnly ? "icon-only" : ""}"
            type="button"
            data-popup-route-index="${this._popupState.routeIndex}"
            data-popup-item-index="${popupIndex}"
            style="${itemStyle}"
            aria-label="${escapeHtml(ariaLabel)}"
          >
            <span class="popup-item__icon-wrap">
              ${this._renderIcon(item, isActive)}
              ${
                badge
                  ? `<span
                      class="nav-badge"
                      style="--badge-background:${badge.background};--badge-color:${badge.color};"
                    >${escapeHtml(badge.content)}</span>`
                  : ""
              }
            </span>
            ${
              hasLabel || hasDescription
                ? `
                  <span class="popup-item__content">
                    ${
                      hasLabel
                        ? `<span class="popup-item__label">${escapeHtml(label)}</span>`
                        : ""
                    }
                    ${
                      hasDescription
                        ? `<span class="popup-item__description">${escapeHtml(item.description)}</span>`
                        : ""
                    }
                  </span>
                `
                : ""
            }
          </button>
        `;
      })
      .join("");

    return `
      <div class="popup-backdrop" data-popup-close="true"></div>
      <div
        class="popup-panel popup-panel--${this._popupState.direction} popup-panel--layout-${this._popupState.layout || "auto"} ${popupHasText ? "popup-panel--with-text" : "popup-panel--icon-only"} ${isCompactPopup ? "popup-panel--compact" : ""}"
        style="left:${this._popupState.left};top:${this._popupState.top};width:${isCompactPopup ? "fit-content" : this._popupState.width};--popup-columns:${this._popupState.columns || 1};--popup-item-min:${this._popupState.itemMinWidth || `calc(${this._config.styles.popup.item_size} + 24px)`};"
      >
        <div class="popup-items">
          ${popupMarkup}
        </div>
      </div>
    `;
  }

  _renderMediaBrowser() {
    if (!this._mediaBrowserState) {
      return "";
    }

    const currentNode =
      this._mediaBrowserState.stack[this._mediaBrowserState.stack.length - 1] || null;
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

  _renderMediaPlayer(visiblePlayers) {
    if (!visiblePlayers.length) {
      return "";
    }

    this._activeMediaPlayerIndex = clamp(
      this._activeMediaPlayerIndex,
      0,
      visiblePlayers.length - 1,
    );

    const player = visiblePlayers[this._activeMediaPlayerIndex];
    const state = this._hass?.states?.[player.entity];

    if (!state) {
      return "";
    }

    const artwork = this._getMediaPlayerArtwork(player, state);
    const title = this._getMediaPlayerTitle(player, state);
    const subtitle = this._getMediaPlayerSubtitle(player, state);
    const subtitleMarkup = subtitle && normalizeTextKey(subtitle) !== normalizeTextKey(title)
      ? `<div class="media-player__subtitle">${escapeHtml(subtitle)}</div>`
      : "";
    const progress = this._getMediaPlayerProgress(state);
    const albumCoverBackground = this._config.media_player.album_cover_background && artwork;
    const chips = this._getMediaPlayerChips(player, state, progress, title, subtitle);
    const playerName = this._getMediaPlayerPlayerLabel(player, state);
    const statusLabel = this._getMediaPlayerStateLabel(state.state);
    const browsePath = this._getMediaPlayerBrowsePath(player, state);
    const volumeLevel = Number(state.attributes.volume_level ?? 0);
    const volumeSupported = this._supportsVolumeControl(state);
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
    const browseMediaMarkup = browsePath
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
    const dotsMarkup =
      visiblePlayers.length > 1
        ? `
          <div class="media-player__dots" aria-label="Media players">
            ${visiblePlayers
              .map(
                (_item, index) => `
                  <button
                    type="button"
                    class="media-player__dot ${index === this._activeMediaPlayerIndex ? "active" : ""}"
                    data-media-index="${index}"
                    aria-label="Seleccionar reproductor ${index + 1}"
                  ></button>
                `,
              )
              .join("")}
          </div>
        `
        : "";
    const switcherMarkup = dotsMarkup
      ? `<div class="media-player__switcher">${dotsMarkup}</div>`
      : "";
    const topPlayerNameMarkup = playerName
      ? `
        <div class="media-player__topline">
          <span class="media-player__chip media-player__chip--device media-player__chip--top">
            ${escapeHtml(playerName)}
          </span>
        </div>
      `
      : "";
    const statusMarkup = statusLabel
      ? `
        <div class="media-player__status-wrap">
          <span class="media-player__chip media-player__chip--${escapeHtml(state.state || "default")} media-player__chip--status">
            ${escapeHtml(statusLabel)}
          </span>
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
    const collapseMarkup = `
      <button
        type="button"
        class="media-player__collapse"
        data-media-toggle="collapse"
        aria-label="Ocultar reproductor"
      >
        <ha-icon icon="mdi:chevron-down"></ha-icon>
      </button>
    `;

    return `
      <div
        class="media-player-card ${albumCoverBackground ? "has-album-background" : ""}"
        data-media-card-index="${this._activeMediaPlayerIndex}"
      >
        ${
          albumCoverBackground
            ? `<div class="media-player__album-bg" style="background-image:url('${escapeHtml(artwork)}');"></div>`
            : ""
        }
        ${
          progress !== null
            ? `
              <div class="media-player__progress">
                <span class="media-player__progress-fill" style="width:${progress.percent}%"></span>
              </div>
            `
            : ""
        }
        ${collapseMarkup}
        ${statusMarkup}
        <div class="media-player__content">
          ${topPlayerNameMarkup}
          <div class="media-player__hero">
            <div class="media-player__artwork">
              ${
                artwork
                  ? `<img src="${escapeHtml(artwork)}" alt="${escapeHtml(title)}" />`
                  : `<ha-icon icon="${escapeHtml(player.icon || "mdi:music")}"></ha-icon>`
              }
            </div>
            <div class="media-player__meta">
              <div class="media-player__title">${escapeHtml(title)}</div>
              ${subtitleMarkup}
            </div>
          </div>
          <div class="media-player__center-stack">
            ${switcherMarkup}
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
                ${browseMediaMarkup}
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

  _renderMediaPlayerToggle(visiblePlayers) {
    if (!visiblePlayers.length) {
      return "";
    }

    this._activeMediaPlayerIndex = clamp(
      this._activeMediaPlayerIndex,
      0,
      visiblePlayers.length - 1,
    );

    const player = visiblePlayers[this._activeMediaPlayerIndex];
    const state = this._hass?.states?.[player.entity];

    if (!state) {
      return "";
    }

    const artwork = this._getMediaPlayerArtwork(player, state);
    const title = this._getMediaPlayerTitle(player, state);
    const subtitle = this._getMediaPlayerStateLabel(state.state);

    return `
      <div class="media-player-toggle-wrap${this._playDockEntrance ? " media-player-toggle-wrap--entering" : ""}">
        <button
          type="button"
          class="media-player-toggle"
          data-media-toggle="expand"
          aria-label="Mostrar reproductor"
        >
          <span class="media-player-toggle__artwork">
            ${
              artwork
                ? `<img src="${escapeHtml(artwork)}" alt="${escapeHtml(title)}" />`
                : `<ha-icon icon="${escapeHtml(player.icon || "mdi:music")}"></ha-icon>`
            }
          </span>
          <span class="media-player-toggle__meta">
            <span class="media-player-toggle__eyebrow">${escapeHtml(subtitle)}</span>
            <span class="media-player-toggle__title">${escapeHtml(title)}</span>
          </span>
          <ha-icon class="media-player-toggle__icon" icon="mdi:chevron-up"></ha-icon>
        </button>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    if (!this._config) {
      this.shadowRoot.innerHTML = "";
      return;
    }

    const config = this._config;
    const animations = {
      enabled: config.animations?.enabled !== false,
      barDuration: clamp(Number(config.animations?.bar_duration) || DEFAULT_CONFIG.animations.bar_duration, 120, 1600),
      popupDuration: clamp(Number(config.animations?.popup_duration) || DEFAULT_CONFIG.animations.popup_duration, 120, 2400),
      mediaDuration: clamp(Number(config.animations?.media_duration) || DEFAULT_CONFIG.animations.media_duration, 120, 2400),
      buttonBounceDuration: clamp(Number(config.animations?.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration, 120, 1600),
      dockEntranceDuration: clamp(
        Number(config.animations?.dock_entrance_duration) || DEFAULT_CONFIG.animations.dock_entrance_duration,
        180,
        1400,
      ),
    };
    const inEditMode = this._isInEditMode();
    const shouldHide = this._shouldHideForScreen(config);

    if (shouldHide && !inEditMode) {
      this._renderedRoutes = [];
      this.shadowRoot.innerHTML = "";
      this._lastShouldHide = true;
      return;
    }

    if (this._lastShouldHide && !shouldHide) {
      this._animateDockEntranceNext = true;
    }
    this._lastShouldHide = false;

    const playDockEntrance = animations.enabled && this._animateDockEntranceNext;
    // Lovelace typically calls setConfig then set(hass) in the same turn; clearing the flag
    // synchronously made the second _render strip entrance classes before paint. Defer reset
    // one frame so follow-up renders still emit --entering until the browser composites.
    if (this._animateDockEntranceNext) {
      if (animations.enabled) {
        requestAnimationFrame(() => {
          this._animateDockEntranceNext = false;
        });
      } else {
        this._animateDockEntranceNext = false;
      }
    }
    this._playDockEntrance = playDockEntrance;

    const visibleRoutes = this._getVisibleRoutes();
    const showRouteLabels = this._shouldShowRouteLabels(visibleRoutes);
    const visiblePlayers = this._getVisibleMediaPlayers();
    const hasVisiblePlayers = visiblePlayers.length > 0;

    if (!hasVisiblePlayers) {
      this._mediaPlayerExpanded = false;
    }

    const showMediaPlayerCard = hasVisiblePlayers && (inEditMode || this._mediaPlayerExpanded === true);
    const showMediaPlayerToggle = hasVisiblePlayers && !showMediaPlayerCard;
    const mediaStackGap = hasVisiblePlayers ? config.media_player.gap || "0px" : "0px";
    const currentPath = normalizePath(window.location.pathname) || "/";
    const isFixed = config.layout.fixed && !inEditMode;
    const spacerHeight = isFixed && config.layout.reserve_space
      ? this._getReservedHeight(showMediaPlayerCard, showMediaPlayerToggle)
      : "0px";
    const titleMarkup = config.title
      ? `<div class="navbar-title${playDockEntrance ? " navbar-title--entering" : ""}">${escapeHtml(config.title)}</div>`
      : "";

    this._renderedRoutes = visibleRoutes;
    this._syncMediaTicker(showMediaPlayerCard ? visiblePlayers : []);

    const mediaPlayerMarkup = showMediaPlayerCard ? this._renderMediaPlayer(visiblePlayers) : "";
    const mediaPlayerToggleMarkup = showMediaPlayerToggle ? this._renderMediaPlayerToggle(visiblePlayers) : "";
    const fullWidthBar = config.layout.full_width === true;
    const barRadiusToken = String(config.styles.bar.border_radius || "28px")
      .trim()
      .split(/\s+/)[0] || "28px";
    const navbarCardBorderRadius = fullWidthBar
      ? "0"
      : config.layout.position === "bottom"
        ? `${barRadiusToken} ${barRadiusToken} 0 0`
        : config.layout.position === "top"
          ? `0 0 ${barRadiusToken} ${barRadiusToken}`
          : config.styles.bar.border_radius;
    const popupMarkup = this._renderPopup(currentPath);
    const mediaBrowserMarkup = this._renderMediaBrowser();

    const routesMarkup =
      visibleRoutes.length > 0
        ? visibleRoutes
            .map((route, index) => {
              const isActive = this._isRouteActive(route, currentPath);
              const badge = this._getBadge(route);
              const label = this._getRouteLabel(route);
              const routeStyle = [
                playDockEntrance ? `--nav-enter-delay:${Math.min(index * 38, 520)}ms;` : "",
                route.background ? `--route-background:${route.background};` : "",
                route.color ? `--route-color:${route.color};` : "",
                route.active_color ? `--route-active-color:${route.active_color};` : "",
                route.active_background ? `--route-active-background:${route.active_background};` : "",
              ]
                .filter(Boolean)
                .join("");
              const hasPopup = this._getPopupItems(route).length > 0;

              return `
                <button
                  class="nav-item ${isActive ? "active" : ""} ${hasPopup ? "has-popup" : ""}${playDockEntrance ? " nav-item--entering" : ""}"
                  data-route-index="${index}"
                  type="button"
                  style="${routeStyle}"
                  aria-label="${escapeHtml(label || route.path || `Route ${index + 1}`)}"
                >
                  <span class="nav-icon-wrap">
                    ${this._renderIcon(route, isActive)}
                    ${
                      badge
                        ? `<span
                            class="nav-badge"
                            style="--badge-background:${badge.background};--badge-color:${badge.color};"
                          >${escapeHtml(badge.content)}</span>`
                        : ""
                    }
                    ${
                      hasPopup
                        ? `<span class="nav-popup-indicator" aria-hidden="true"></span>`
                        : ""
                    }
                  </span>
                  ${
                    showRouteLabels
                      ? label
                        ? `<span class="nav-label">${escapeHtml(label)}</span>`
                        : '<span class="nav-label nav-label--placeholder" aria-hidden="true">&nbsp;</span>'
                      : ""
                  }
                </button>
              `;
            })
            .join("")
        : `
          <div class="empty-state">
            No hay rutas visibles. Revisa los IDs de usuario o anade elementos a "routes".
          </div>
        `;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --navbar-dock-entrance-ms: ${animations.dockEntranceDuration};
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
          position: ${isFixed ? "fixed" : "relative"};
          left: ${fullWidthBar ? "0" : config.layout.side_margin};
          right: ${fullWidthBar ? "0" : config.layout.side_margin};
          ${config.layout.position === "top" ? `top: ${config.layout.offset};` : `bottom: ${config.layout.offset};`}
          z-index: ${config.layout.z_index};
          pointer-events: none;
        }

        .dock-inner {
          width: 100%;
          max-width: ${fullWidthBar ? "none" : config.styles.bar.max_width};
          margin: 0 auto;
          pointer-events: none;
        }

        .dock-stack--full-width > .media-player-card {
          border-radius: 0;
        }

        .dock-stack {
          display: grid;
          gap: ${mediaStackGap};
          pointer-events: none;
        }

        .dock-stack > *,
        .dock-stack > * > *,
        .navbar,
        .navbar *,
        .media-player-toggle-wrap,
        .media-player-toggle,
        .media-player-toggle *,
        .media-player-card,
        .media-player-card *,
        .popup-backdrop,
        .popup-panel,
        .media-browser-backdrop,
        .media-browser-panel {
          pointer-events: auto;
        }

        .media-player-toggle-wrap {
          display: flex;
          justify-content: flex-end;
        }

        ha-card.navbar-card {
          background: ${config.styles.bar.background};
          border: ${config.styles.bar.border};
          border-radius: ${navbarCardBorderRadius};
          box-shadow: ${config.styles.bar.box_shadow};
          backdrop-filter: ${config.styles.bar.backdrop_filter};
          display: block;
          isolation: isolate;
          padding: ${config.styles.bar.padding};
          min-height: ${config.styles.bar.min_height};
          overflow: hidden;
          pointer-events: none;
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, border-radius 180ms ease;
        }

        ha-card.navbar-card::before {
          background: linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0));
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        ha-card.navbar-card > * {
          position: relative;
          z-index: 1;
        }

        @keyframes nodalia-navbar-dock-in-from-bottom {
          0% {
            opacity: 0;
            transform: translateY(22px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes nodalia-navbar-dock-in-from-top {
          0% {
            opacity: 0;
            transform: translateY(-18px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes nodalia-navbar-chip-in {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.94);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes nodalia-navbar-soft-in {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        ha-card.navbar-card.navbar-card--entering-bottom {
          animation: nodalia-navbar-dock-in-from-bottom ${animations.dockEntranceDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        ha-card.navbar-card.navbar-card--entering-top {
          animation: nodalia-navbar-dock-in-from-top ${animations.dockEntranceDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .nav-item.nav-item--entering {
          animation: nodalia-navbar-chip-in ${Math.round(animations.dockEntranceDuration * 0.92)}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: var(--nav-enter-delay, 0ms);
        }

        .navbar-title.navbar-title--entering {
          animation: nodalia-navbar-soft-in ${Math.round(animations.dockEntranceDuration * 0.78)}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: ${Math.round(animations.dockEntranceDuration * 0.1)}ms;
        }

        .media-player-toggle-wrap.media-player-toggle-wrap--entering {
          animation: nodalia-navbar-soft-in ${Math.round(animations.dockEntranceDuration * 0.72)}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: ${Math.round(animations.dockEntranceDuration * 0.06)}ms;
        }

        .navbar-title {
          margin-bottom: 10px;
          color: var(--primary-text-color);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        .navbar {
          display: ${showRouteLabels ? "flex" : "grid"};
          align-items: center;
          justify-content: ${showRouteLabels ? config.styles.bar.justify_content : "stretch"};
          gap: ${config.styles.bar.gap};
          flex-wrap: nowrap;
          grid-template-columns: ${showRouteLabels ? "none" : `repeat(${Math.max(visibleRoutes.length, 1)}, minmax(0, 1fr))`};
          justify-items: ${showRouteLabels ? "stretch" : "center"};
          transform: translateY(${showRouteLabels ? "0px" : "4px"});
          width: 100%;
        }

        .nav-item {
          --route-background: ${config.styles.button.background};
          --route-color: ${config.styles.button.color};
          --route-active-color: ${config.styles.button.active_color};
          --route-active-background: ${config.styles.button.active_background};
          appearance: none;
          background: transparent;
          border: 0;
          border-radius: ${config.styles.button.border_radius};
          color: var(--route-color);
          cursor: pointer;
          display: inline-flex;
          flex: ${showRouteLabels ? "1 1 0" : "0 0 auto"};
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: ${showRouteLabels ? config.styles.button.label_gap : "0px"};
          min-width: ${showRouteLabels ? "0" : config.styles.button.size};
          min-height: ${config.styles.button.size};
          padding: 0;
          position: relative;
          width: ${showRouteLabels ? "auto" : config.styles.button.size};
          transition:
            background ${animations.enabled ? animations.barDuration : 0}ms ease,
            color ${animations.enabled ? animations.barDuration : 0}ms ease,
            transform ${animations.enabled ? animations.buttonBounceDuration : 0}ms ease;
        }

        .nav-item:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }

        .nav-item.active {
          color: var(--route-active-color);
        }

        .nav-item.active .nav-icon-wrap {
          background: var(--route-active-background);
        }

        .nav-icon-wrap {
          background: var(--route-background);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          width: ${config.styles.button.size};
          height: ${config.styles.button.size};
          border-radius: ${config.styles.button.border_radius};
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 0;
          position: relative;
          transition:
            background ${animations.enabled ? animations.barDuration : 0}ms ease,
            box-shadow ${animations.enabled ? animations.barDuration : 0}ms ease,
            transform ${animations.enabled ? animations.buttonBounceDuration : 0}ms ease;
        }

        .nav-icon,
        .nav-image {
          display: block;
          flex: 0 0 auto;
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(
            calc(-50% + ${config.styles.button.icon_offset_x}),
            calc(-50% + ${config.styles.button.icon_offset_y})
          );
          width: ${config.styles.button.icon_size};
          height: ${config.styles.button.icon_size};
        }

        .nav-icon {
          --mdc-icon-size: ${config.styles.button.icon_size};
          align-items: center;
          display: inline-flex;
          font-size: ${config.styles.button.icon_size};
          justify-content: center;
          line-height: 1;
          margin: 0;
          padding: 0;
        }

        .nav-image {
          border-radius: 50%;
          object-fit: cover;
        }

        .nav-icon--placeholder {
          display: inline-block;
        }

        .nav-label {
          color: ${config.styles.button.label_color};
          display: block;
          font-size: ${config.styles.button.label_size};
          line-height: 1.2;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nav-label--placeholder {
          visibility: hidden;
        }

        .nav-item.active .nav-label {
          color: ${config.styles.button.active_label_color};
        }

        .nav-popup-indicator {
          background: currentColor;
          border-radius: 999px;
          bottom: 5px;
          height: 4px;
          left: 50%;
          opacity: 0.75;
          position: absolute;
          transform: translateX(-50%);
          width: 4px;
        }

        .nav-badge {
          align-items: center;
          background: var(--badge-background);
          border-radius: 999px;
          color: var(--badge-color);
          display: inline-flex;
          font-size: ${config.styles.badge.font_size};
          font-weight: 700;
          inset-inline-end: -4px;
          justify-content: center;
          min-height: ${config.styles.badge.min_size};
          min-width: ${config.styles.badge.min_size};
          padding: 0 6px;
          position: absolute;
          top: -2px;
        }

        .empty-state {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.4;
          padding: 4px 0;
          text-align: center;
          width: 100%;
        }

        .popup-backdrop {
          background: ${config.styles.popup.backdrop};
          inset: 0;
          position: fixed;
          z-index: ${Number(config.layout.z_index) + 1};
        }

        .popup-panel {
          background: ${config.styles.popup.background};
          background-color: var(--ha-card-background, var(--card-background-color, #fff));
          border: ${config.styles.popup.border};
          border-radius: ${config.styles.popup.border_radius};
          box-shadow: ${config.styles.bar.box_shadow}, ${config.styles.popup.box_shadow};
          --popup-columns: 1;
          --popup-item-min: calc(${config.styles.popup.item_size} + 24px);
          max-height: calc(100vh - 24px);
          min-width: min(${config.styles.popup.min_width}, calc(100vw - 24px));
          isolation: isolate;
          overflow: auto;
          padding: ${config.styles.popup.padding};
          position: fixed;
          transform-origin: center bottom;
          width: min(${config.styles.popup.max_width}, calc(100vw - 24px));
          z-index: ${Number(config.layout.z_index) + 2};
          ${animations.enabled ? `animation: nodalia-navbar-surface-in ${animations.popupDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;` : ""}
        }

        .popup-panel::before {
          background: color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 96%, transparent);
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .popup-panel > * {
          position: relative;
          z-index: 1;
        }

        .popup-panel--down {
          transform-origin: center top;
        }

        .popup-items {
          align-items: stretch;
          display: grid;
          gap: ${config.styles.popup.item_gap};
          grid-template-columns: repeat(var(--popup-columns), minmax(0, 1fr));
          justify-items: stretch;
        }

        .popup-panel--layout-vertical .popup-items {
          grid-template-columns: 1fr;
        }

        .popup-panel--layout-vertical.popup-panel--icon-only {
          min-width: 0;
        }

        .popup-panel--compact {
          min-width: 0;
          padding: 8px;
          width: auto;
        }

        .popup-panel--compact .popup-items {
          align-items: center;
          display: flex;
          flex-direction: column;
          gap: ${config.styles.popup.item_gap};
          justify-content: center;
        }

        .popup-panel--layout-horizontal .popup-items,
        .popup-panel--layout-auto .popup-items {
          grid-template-columns: repeat(var(--popup-columns), minmax(var(--popup-item-min), 1fr));
        }

        .media-browser-backdrop {
          background: ${config.styles.popup.backdrop};
          inset: 0;
          position: fixed;
          z-index: ${Number(config.layout.z_index) + 3};
        }

        .media-browser-panel {
          background: ${config.styles.media_player.background};
          background-color: var(--ha-card-background, var(--card-background-color, #fff));
          border: ${config.styles.media_player.border};
          border-radius: ${config.styles.media_player.border_radius};
          box-shadow: ${config.styles.bar.box_shadow}, ${config.styles.popup.box_shadow};
          display: flex;
          flex-direction: column;
          gap: 14px;
          inset: max(16px, calc(env(safe-area-inset-top, 0px) + 12px)) 12px max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px)) 12px;
          isolation: isolate;
          max-width: 560px;
          margin: 0 auto;
          overflow: hidden;
          padding: 14px;
          position: fixed;
          z-index: ${Number(config.layout.z_index) + 4};
          ${animations.enabled ? `animation: nodalia-navbar-surface-in ${animations.mediaDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;` : ""}
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
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
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
          background: color-mix(in srgb, var(--primary-text-color) 3%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 5%, transparent);
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
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
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
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-browser__item-title {
          color: var(--primary-text-color);
          font-size: 14px;
          font-weight: 700;
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

        .popup-item {
          --popup-route-background: ${config.styles.button.background};
          --popup-route-color: ${config.styles.button.color};
          --popup-route-active-color: ${config.styles.button.active_color};
          --popup-route-active-background: ${config.styles.button.active_background};
          appearance: none;
          align-items: center;
          background: rgba(255, 255, 255, 0.015);
          border: 0;
          border-radius: 20px;
          color: var(--popup-route-color);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 8px;
          justify-content: center;
          min-height: calc(${config.styles.popup.item_size} + 36px);
          padding: 10px 8px;
          text-align: center;
          transition:
            background ${animations.enabled ? animations.barDuration : 0}ms ease,
            transform ${animations.enabled ? animations.buttonBounceDuration : 0}ms ease;
          width: 100%;
        }

        .popup-item.icon-only {
          min-height: calc(${config.styles.popup.item_size} + 18px);
        }

        .popup-item:hover {
          background: rgba(var(--rgb-primary-color), 0.08);
          transform: translateY(-1px);
        }

        .popup-item.active {
          background: rgba(var(--rgb-primary-color), 0.12);
          color: var(--popup-route-active-color);
        }

        .popup-item__icon-wrap {
          align-items: center;
          background: var(--popup-route-background);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border-radius: ${config.styles.button.border_radius};
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 3%, transparent),
            0 8px 18px rgba(0, 0, 0, 0.12);
          display: flex;
          height: max(${config.styles.popup.item_size}, calc(${config.styles.button.icon_size} + 14px));
          justify-content: center;
          line-height: 0;
          position: relative;
          width: max(${config.styles.popup.item_size}, calc(${config.styles.button.icon_size} + 14px));
        }

        .popup-item.active .popup-item__icon-wrap {
          background: var(--popup-route-active-background);
        }

        .popup-panel--layout-horizontal .popup-item.icon-only,
        .popup-panel--layout-auto .popup-item.icon-only {
          background: transparent;
          min-height: auto;
          padding: 2px 0;
        }

        .popup-panel--layout-horizontal .popup-item.icon-only:hover,
        .popup-panel--layout-auto .popup-item.icon-only:hover,
        .popup-panel--layout-horizontal .popup-item.icon-only.active,
        .popup-panel--layout-auto .popup-item.icon-only.active {
          background: transparent;
        }

        .popup-panel--layout-vertical .popup-item {
          min-height: calc(${config.styles.popup.item_size} + 24px);
        }

        .popup-panel--layout-vertical.popup-panel--icon-only .popup-items {
          justify-items: center;
        }

        .popup-panel--layout-vertical.popup-panel--icon-only .popup-item {
          background: transparent;
          min-height: auto;
          padding: 0;
          width: auto;
        }

        .popup-panel--layout-vertical.popup-panel--icon-only .popup-item:hover,
        .popup-panel--layout-vertical.popup-panel--icon-only .popup-item.active {
          background: transparent;
        }

        .popup-item__content {
          display: grid;
          gap: 4px;
          justify-items: center;
          min-width: 0;
          width: 100%;
        }

        .popup-item__label {
          color: inherit;
          font-size: ${config.styles.popup.label_size};
          font-weight: 600;
          line-height: 1.2;
          text-align: center;
          white-space: normal;
        }

        .popup-item__description {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.2;
          max-width: 100%;
          text-align: center;
          white-space: normal;
        }

        .media-player-card {
          background: ${config.styles.media_player.background};
          border: ${config.styles.media_player.border};
          border-radius: ${config.styles.media_player.border_radius};
          box-shadow: ${config.styles.media_player.box_shadow};
          cursor: pointer;
          isolation: isolate;
          min-height: ${config.styles.media_player.min_height};
          overflow: hidden;
          padding: ${config.styles.media_player.padding};
          position: relative;
          ${animations.enabled ? `animation: nodalia-navbar-surface-in ${animations.mediaDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;` : ""}
        }

        .media-player-card::before {
          background: linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 6%, transparent), rgba(255, 255, 255, 0));
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .media-player-card.has-album-background::after {
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.08),
            ${config.styles.media_player.overlay_color},
            rgba(0, 0, 0, 0.16)
          );
          content: "";
          inset: 0;
          position: absolute;
          z-index: 0;
        }

        .media-player__album-bg {
          background-position: center;
          background-size: cover;
          filter: blur(30px) saturate(0.82);
          inset: -24px;
          opacity: 0.38;
          position: absolute;
          transform: scale(1.14);
          z-index: -1;
        }

        .media-player__progress {
          background: ${config.styles.media_player.progress_background};
          border-radius: 999px;
          bottom: 10px;
          height: 6px;
          inset-inline: 14px;
          overflow: hidden;
          position: absolute;
          z-index: 1;
        }

        .media-player__progress-fill {
          background: ${config.styles.media_player.progress_color};
          display: block;
          height: 100%;
        }

        .media-player__content,
        .media-player__dots {
          position: relative;
          z-index: 1;
        }

        .media-player__content {
          align-content: start;
          display: grid;
          gap: 14px;
          padding-bottom: 12px;
        }

        .media-player__topline {
          display: flex;
          justify-content: center;
          min-height: 28px;
          padding-inline: 42px;
          width: 100%;
        }

        .media-player__hero {
          align-items: start;
          display: grid;
          gap: 14px;
          grid-template-columns: ${config.styles.media_player.artwork_size} minmax(0, 1fr);
          padding-right: clamp(52px, 24vw, 168px);
        }

        .media-player__artwork {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 22px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.18);
          display: flex;
          height: ${config.styles.media_player.artwork_size};
          justify-content: center;
          overflow: hidden;
          width: ${config.styles.media_player.artwork_size};
        }

        .media-player__artwork img,
        .media-player__artwork ha-icon {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .media-player__artwork ha-icon {
          font-size: calc(${config.styles.media_player.artwork_size} * 0.52);
          padding: 14px;
        }

        .media-player__meta {
          display: grid;
          gap: 4px;
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
          font-size: ${config.styles.media_player.title_size};
          font-weight: 700;
        }

        .media-player__subtitle {
          color: var(--secondary-text-color);
          font-size: ${config.styles.media_player.subtitle_size};
        }

        .media-player__center-stack {
          display: grid;
          gap: 12px;
          justify-items: center;
        }

        .media-player__switcher {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .media-player__status-wrap {
          display: flex;
          justify-content: flex-end;
          max-width: calc(100% - 28px);
          pointer-events: none;
          position: absolute;
          right: 14px;
          top: 48px;
          z-index: 2;
        }

        .media-player__transport-row {
          align-items: center;
          display: flex;
          justify-content: center;
          width: 100%;
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
          gap: 10px;
          justify-content: center;
          width: auto;
        }

        .media-player__transport-addon {
          align-items: center;
          display: inline-flex;
          left: calc(100% + 10px);
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
        }

        .media-player__footer {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }

        .media-player__transport {
          align-items: center;
          display: inline-flex;
          gap: 8px;
          padding: 6px;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          margin: 0 auto;
        }

        .media-player__volume-button {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: calc(${config.styles.media_player.control_size} - 4px);
          justify-content: center;
          line-height: 0;
          padding: 0;
          flex: 0 0 auto;
          position: relative;
          width: calc(${config.styles.media_player.control_size} - 4px);
        }

        .media-player__chips {
          align-items: center;
          display: flex;
          flex: 0 1 auto;
          flex-wrap: wrap;
          gap: 8px;
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
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: ${config.styles.media_player.subtitle_size};
          font-weight: 600;
          line-height: 1;
          max-width: 100%;
          min-height: 28px;
          overflow: hidden;
          padding: 0 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player__chip--top {
          justify-content: center;
          max-width: min(100%, 320px);
          text-align: center;
        }

        .media-player__chip--status {
          max-width: min(100%, 160px);
        }

        .media-player__chip--playing {
          background: rgba(var(--rgb-primary-color), 0.16);
          border-color: rgba(var(--rgb-primary-color), 0.22);
          color: ${config.styles.button.active_color};
        }

        .media-player__chip--paused,
        .media-player__chip--buffering {
          color: var(--primary-text-color);
        }

        .media-player__chip--device,
        .media-player__chip--source {
          color: var(--primary-text-color);
        }

        .media-player__chip--time {
          font-variant-numeric: tabular-nums;
        }

        .media-player__control {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: ${config.styles.media_player.control_size};
          justify-content: center;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          line-height: 0;
          position: relative;
          width: ${config.styles.media_player.control_size};
        }

        .media-player__control--primary {
          background: rgba(var(--rgb-primary-color), 0.18);
          border-color: rgba(var(--rgb-primary-color), 0.24);
          color: ${config.styles.button.active_color};
          height: calc(${config.styles.media_player.control_size} + 6px);
          width: calc(${config.styles.media_player.control_size} + 6px);
        }

        .media-player__control ha-icon {
          align-items: center;
          display: inline-flex;
          font-size: 22px;
          height: 22px;
          justify-content: center;
          left: 50%;
          line-height: 1;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 22px;
        }

        .media-player__volume-button ha-icon {
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

        .media-player__dots {
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          display: inline-flex;
          gap: 4px;
          justify-content: center;
          padding: 4px;
        }

        .media-player__collapse {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: 28px;
          justify-content: center;
          padding: 0;
          position: absolute;
          right: 14px;
          top: 14px;
          z-index: 2;
          width: 28px;
        }

        .media-player__collapse ha-icon {
          font-size: 18px;
        }

        .media-player__dot {
          appearance: none;
          align-items: center;
          background: transparent;
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          height: 28px;
          justify-content: center;
          padding: 0;
          position: relative;
          width: 28px;
        }

        .media-player__dot::before {
          background: color-mix(in srgb, var(--primary-text-color) 18%, transparent);
          border-radius: 999px;
          content: "";
          height: ${config.styles.media_player.dot_size};
          transition:
            background ${animations.enabled ? animations.barDuration : 0}ms ease,
            width ${animations.enabled ? animations.barDuration : 0}ms ease;
          width: ${config.styles.media_player.dot_size};
        }

        .media-player__dot.active::before {
          background: ${config.styles.button.active_color};
          width: calc(${config.styles.media_player.dot_size} + 10px);
        }

        .media-player-toggle {
          align-items: center;
          appearance: none;
          background: ${config.styles.media_player.background};
          border: ${config.styles.media_player.border};
          border-radius: 999px;
          box-shadow: ${config.styles.media_player.box_shadow};
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          gap: 10px;
          max-width: min(100%, 280px);
          min-height: 44px;
          padding: 6px 10px 6px 6px;
          transition:
            background ${animations.enabled ? animations.barDuration : 0}ms ease,
            box-shadow ${animations.enabled ? animations.barDuration : 0}ms ease,
            transform ${animations.enabled ? animations.buttonBounceDuration : 0}ms ease;
          ${animations.enabled ? `animation: nodalia-navbar-surface-in ${animations.mediaDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;` : ""}
        }

        .media-player-toggle__artwork {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          display: inline-flex;
          flex: 0 0 auto;
          height: 32px;
          justify-content: center;
          overflow: hidden;
          width: 32px;
        }

        .media-player-toggle__artwork img,
        .media-player-toggle__artwork ha-icon {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .media-player-toggle__artwork ha-icon {
          font-size: 18px;
          padding: 7px;
        }

        .media-player-toggle__meta {
          display: grid;
          flex: 1 1 auto;
          gap: 2px;
          min-width: 0;
          text-align: left;
        }

        .media-player-toggle__eyebrow,
        .media-player-toggle__title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player-toggle__eyebrow {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 600;
        }

        .media-player-toggle__title {
          color: var(--primary-text-color);
          font-size: 13px;
          font-weight: 700;
        }

        .media-player-toggle__icon {
          color: var(--secondary-text-color);
          flex: 0 0 auto;
          font-size: 18px;
        }

        @keyframes nodalia-navbar-surface-in {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        ${animations.enabled ? "" : `
        .nav-item,
        .nav-icon-wrap,
        .navbar-title,
        .navbar-card,
        .media-player-toggle-wrap,
        .popup-panel,
        .popup-item,
        .media-player-card,
        .media-player-toggle,
        .media-browser-panel {
          animation: none !important;
          transition: none !important;
        }
        `}

        @media (max-width: 520px) {
          .media-player__footer {
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .media-player__hero {
            grid-template-columns: ${config.styles.media_player.artwork_size} minmax(0, 1fr);
          }
        }
      </style>
      <div class="spacer" aria-hidden="true"></div>
      <div class="dock">
        <div class="dock-inner">
          <div class="dock-stack${fullWidthBar ? " dock-stack--full-width" : ""}">
            ${mediaPlayerToggleMarkup}
            ${mediaPlayerMarkup}
            <ha-card class="navbar-card${playDockEntrance ? ` navbar-card--entering navbar-card--entering-${config.layout.position === "top" ? "top" : "bottom"}` : ""}">
              ${titleMarkup}
              <nav class="navbar" aria-label="Navigation bar">
                ${routesMarkup}
              </nav>
            </ha-card>
          </div>
        </div>
      </div>
      ${popupMarkup}
      ${mediaBrowserMarkup}
    `;

    if (this._popupState) {
      this._schedulePopupPositionSync();
    }
  }
}

class NodaliaNavigationBarEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = deepClone(STUB_CONFIG);
    this._hass = null;
    this._showStyleSection = false;
    this._showAnimationSection = false;
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
  }

  set hass(hass) {
    this._hass = hass;
  }

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    const hass = this._hass ?? this.hass;
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", s);
  }

  _L(s) {
    return escapeHtml(this._editorLabel(s));
  }

  _prepareEditorConfig(config) {
    if (!Array.isArray(config.routes)) {
      config.routes = [];
    }

    if (!isObject(config.layout)) {
      config.layout = {};
    }

    if (!isObject(config.haptics)) {
      config.haptics = {};
    }

    if (!isObject(config.animations)) {
      config.animations = {};
    }

    if (!isObject(config.media_player)) {
      config.media_player = {};
    }

    if (!Array.isArray(config.media_player.players)) {
      config.media_player.players = [];
    }

    return config;
  }

  setConfig(config) {
    const nextConfig = deepClone(config || STUB_CONFIG);
    if (!Array.isArray(nextConfig.routes) && Array.isArray(nextConfig.items)) {
      nextConfig.routes = nextConfig.items;
      delete nextConfig.items;
    }
    this._config = this._prepareEditorConfig(nextConfig);
    this._render();
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
    let selector = null;

    if (dataset.field) {
      selector = `[data-field="${escapeSelectorValue(dataset.field)}"]`;
    } else if (dataset.playerField && dataset.playerIndex !== undefined) {
      selector =
        `[data-player-index="${escapeSelectorValue(dataset.playerIndex)}"]` +
        `[data-player-field="${escapeSelectorValue(dataset.playerField)}"]`;
    } else if (
      dataset.popupField &&
      dataset.routeIndex !== undefined &&
      dataset.popupIndex !== undefined
    ) {
      selector =
        `[data-route-index="${escapeSelectorValue(dataset.routeIndex)}"]` +
        `[data-popup-index="${escapeSelectorValue(dataset.popupIndex)}"]` +
        `[data-popup-field="${escapeSelectorValue(dataset.popupField)}"]`;
    } else if (dataset.routeField && dataset.routeIndex !== undefined) {
      selector =
        `[data-route-index="${escapeSelectorValue(dataset.routeIndex)}"]` +
        `[data-route-field="${escapeSelectorValue(dataset.routeField)}"]`;
    }

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

  _emitConfig(nextConfig) {
    const focusState = this._captureFocusState();
    const prepared = this._prepareEditorConfig(deepClone(nextConfig));
    this._config = compactConfig(prepared);
    this._render();
    this._restoreFocusState(focusState);
    const merged = mergeConfig(DEFAULT_CONFIG, prepared);
    fireEvent(this, "config-changed", {
      config: compactConfig(stripEqualToDefaults(merged, DEFAULT_CONFIG) ?? {}),
    });
  }

  _setEditorConfig(nextConfig) {
    this._config = compactConfig(this._prepareEditorConfig(nextConfig));
  }

  _commitEditorConfig(nextConfig, shouldEmit) {
    if (shouldEmit) {
      this._emitConfig(nextConfig);
      return;
    }

    this._setEditorConfig(nextConfig);
  }

  _applyFieldValue(target, key, field) {
    if (!target || !key) {
      return;
    }

    if (field.type === "checkbox" && field.dataset.checkedValue !== undefined) {
      if (field.checked) {
        target[key] = parsePrimitiveValue(field.dataset.checkedValue);
      } else if (field.dataset.uncheckedDelete === "true") {
        delete target[key];
      } else if (field.dataset.uncheckedValue !== undefined) {
        target[key] = parsePrimitiveValue(field.dataset.uncheckedValue);
      } else {
        target[key] = false;
      }
      return;
    }

    if (field.dataset.csv === "true") {
      const values = arrayFromCsv(field.value);
      if (values.length > 0) {
        target[key] = values;
      } else {
        delete target[key];
      }
      return;
    }

    if (field.type === "checkbox") {
      target[key] = field.checked;
      return;
    }

    if (field.value === "" && field.dataset.optional === "true") {
      delete target[key];
      return;
    }

    if (field.type === "number") {
      target[key] = Number(field.value);
      return;
    }

    target[key] = field.value;
  }

  _onShadowInput(event) {
    const shouldEmit = event.type === "change";
    const field = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.field);

    if (field) {
      const nextConfig = deepClone(this._config);
      const value = field.type === "checkbox" ? field.checked : field.value;

      if (value === "" && field.dataset.optional === "true") {
        deleteByPath(nextConfig, field.dataset.field);
      } else if (field.type === "number") {
        setByPath(nextConfig, field.dataset.field, Number(value));
      } else {
        setByPath(nextConfig, field.dataset.field, value);
      }

      this._commitEditorConfig(nextConfig, shouldEmit);
      return;
    }

    const playerField = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.playerField);

    if (playerField) {
      const nextConfig = deepClone(this._config);
      this._prepareEditorConfig(nextConfig);
      const playerIndex = Number(playerField.dataset.playerIndex);
      const player = nextConfig.media_player.players[playerIndex];

      if (!player) {
        return;
      }

      if (playerField.dataset.playerField === "label") {
        delete player.name;
      }

      if (playerField.dataset.playerField === "browse_path") {
        delete player.media_browser_path;
      }

      this._applyFieldValue(player, playerField.dataset.playerField, playerField);
      this._commitEditorConfig(nextConfig, shouldEmit);
      return;
    }

    const routeField = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.routeField);

    if (routeField) {
      const routeIndex = Number(routeField.dataset.routeIndex);
      const nextConfig = deepClone(this._config);
      this._prepareEditorConfig(nextConfig);
      const route = nextConfig.routes[routeIndex];

      if (!route) {
        return;
      }

      this._applyFieldValue(route, routeField.dataset.routeField, routeField);
      this._commitEditorConfig(nextConfig, shouldEmit);
      return;
    }

    const popupField = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.popupField);

    if (!popupField) {
      return;
    }

    const nextConfig = deepClone(this._config);
    this._prepareEditorConfig(nextConfig);
    const routeIndex = Number(popupField.dataset.routeIndex);
    const popupIndex = Number(popupField.dataset.popupIndex);
    const route = nextConfig.routes[routeIndex];

    if (!route || !Array.isArray(route.popup)) {
      return;
    }

    const popupItem = route.popup[popupIndex];
    if (!popupItem) {
      return;
    }

    this._applyFieldValue(popupItem, popupField.dataset.popupField, popupField);
    this._commitEditorConfig(nextConfig, shouldEmit);
  }

  _onShadowClick(event) {
    const toggleButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorToggle);

    if (toggleButton) {
      if (toggleButton.dataset.editorToggle === "styles") {
        this._showStyleSection = !this._showStyleSection;
        this._render();
        return;
      }

      if (toggleButton.dataset.editorToggle === "animations") {
        this._showAnimationSection = !this._showAnimationSection;
        this._render();
      }

      return;
    }

    const actionButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorAction);

    if (!actionButton) {
      return;
    }

    const nextConfig = deepClone(this._config);
    this._prepareEditorConfig(nextConfig);

    if (actionButton.dataset.editorAction === "add-route") {
      nextConfig.routes.push({
        icon: "mdi:circle-outline",
        label: `Ruta ${nextConfig.routes.length + 1}`,
        path: "/lovelace/nueva-ruta",
      });
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "remove-route") {
      const index = Number(actionButton.dataset.routeIndex);
      nextConfig.routes.splice(index, 1);
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "move-route-up") {
      const index = Number(actionButton.dataset.routeIndex);

      if (index <= 0 || index >= nextConfig.routes.length) {
        return;
      }

      nextConfig.routes = moveItem(nextConfig.routes, index, index - 1);
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "move-route-down") {
      const index = Number(actionButton.dataset.routeIndex);

      if (index < 0 || index >= nextConfig.routes.length - 1) {
        return;
      }

      nextConfig.routes = moveItem(nextConfig.routes, index, index + 1);
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "add-popup-item") {
      const routeIndex = Number(actionButton.dataset.routeIndex);
      const route = nextConfig.routes[routeIndex];

      if (!route) {
        return;
      }

      if (!Array.isArray(route.popup)) {
        route.popup = [];
      }

      route.popup.push({
        icon: "mdi:dots-circle",
        path: "/lovelace/nueva-ruta",
      });
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "remove-popup-item") {
      const routeIndex = Number(actionButton.dataset.routeIndex);
      const popupIndex = Number(actionButton.dataset.popupIndex);
      const route = nextConfig.routes[routeIndex];

      if (!route || !Array.isArray(route.popup)) {
        return;
      }

      route.popup.splice(popupIndex, 1);
      if (route.popup.length === 0) {
        delete route.popup;
      }
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "move-popup-item-up") {
      const routeIndex = Number(actionButton.dataset.routeIndex);
      const popupIndex = Number(actionButton.dataset.popupIndex);
      const route = nextConfig.routes[routeIndex];

      if (!route || !Array.isArray(route.popup) || popupIndex <= 0 || popupIndex >= route.popup.length) {
        return;
      }

      route.popup = moveItem(route.popup, popupIndex, popupIndex - 1);
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "move-popup-item-down") {
      const routeIndex = Number(actionButton.dataset.routeIndex);
      const popupIndex = Number(actionButton.dataset.popupIndex);
      const route = nextConfig.routes[routeIndex];

      if (!route || !Array.isArray(route.popup) || popupIndex < 0 || popupIndex >= route.popup.length - 1) {
        return;
      }

      route.popup = moveItem(route.popup, popupIndex, popupIndex + 1);
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "add-player") {
      nextConfig.media_player.players.push({
        entity: "media_player.nuevo",
      });
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "remove-player") {
      const playerIndex = Number(actionButton.dataset.playerIndex);
      nextConfig.media_player.players.splice(playerIndex, 1);
      this._emitConfig(nextConfig);
    }
  }

  _renderPopupItem(routeIndex, popupItem, popupIndex, popupTotal) {
    return `
      <div class="sub-card">
        <div class="route-head route-head--sub">
          <strong>${this._L("Popup")} ${popupIndex + 1}</strong>
          <div class="head-actions">
            <button
              type="button"
              class="secondary"
              data-editor-action="move-popup-item-up"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              ${popupIndex === 0 ? "disabled" : ""}
            >
              ${this._L("Subir")}
            </button>
            <button
              type="button"
              class="secondary"
              data-editor-action="move-popup-item-down"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              ${popupIndex === popupTotal - 1 ? "disabled" : ""}
            >
              ${this._L("Bajar")}
            </button>
            <button
              type="button"
              class="danger"
              data-editor-action="remove-popup-item"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
            >
              ${this._L("Eliminar")}
            </button>
          </div>
        </div>
        <div class="grid">
          <label>
            <span>${this._L("Etiqueta opcional")}</span>
            <input
              type="text"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              data-popup-field="label"
              data-optional="true"
              value="${escapeHtml(popupItem.label || "")}"
              placeholder="${escapeHtml(this._L("Dejalo vacio para solo icono"))}"
            />
          </label>
          <label>
            <span>${this._L("Icono")}</span>
            <input
              type="text"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              data-popup-field="icon"
              value="${escapeHtml(popupItem.icon || "")}"
            />
          </label>
          <label>
            <span>${this._L("Path")}</span>
            <input
              type="text"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              data-popup-field="path"
              value="${escapeHtml(popupItem.path || "")}"
            />
          </label>
          <label>
            <span>${this._L("Descripcion")}</span>
            <input
              type="text"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              data-popup-field="description"
              data-optional="true"
              value="${escapeHtml(popupItem.description || "")}"
            />
          </label>
          <label>
            <span>${this._L("Usuarios")}</span>
            <input
              type="text"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              data-popup-field="users"
              data-csv="true"
              data-optional="true"
              value="${escapeHtml((popupItem.users || []).join(", "))}"
              placeholder="id1, id2"
            />
          </label>
          <label>
            <span>${this._L("Paths activos")}</span>
            <input
              type="text"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              data-popup-field="active_paths"
              data-csv="true"
              data-optional="true"
              value="${escapeHtml((popupItem.active_paths || []).join(", "))}"
              placeholder="/lovelace/seguridad/camaras"
            />
          </label>
          <label class="checkbox">
            <input
              type="checkbox"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              data-popup-field="match"
              data-checked-value="prefix"
              data-unchecked-delete="true"
              ${popupItem.match === "prefix" ? "checked" : ""}
            />
            <span class="toggle-switch" aria-hidden="true"></span>
            <span>${this._L("Activa por prefijo")}</span>
          </label>
        </div>
      </div>
    `;
  }

  _renderMediaPlayerPlayer(player, index) {
    return `
      <div class="route-card">
        <div class="route-head">
          <strong>${this._L("Player")} ${index + 1}</strong>
          <button type="button" class="danger" data-editor-action="remove-player" data-player-index="${index}">
            ${this._L("Eliminar")}
          </button>
        </div>
        <div class="grid">
          <label>
            <span>${this._L("Entidad")}</span>
            <input
              type="text"
              data-player-index="${index}"
              data-player-field="entity"
              value="${escapeHtml(player.entity || "")}"
              placeholder="media_player.spotify"
            />
          </label>
          <label>
            <span>${this._L("Nombre reproductor")}</span>
            <input
              type="text"
              data-player-index="${index}"
              data-player-field="label"
              data-optional="true"
              value="${escapeHtml(player.label || player.name || "")}"
              placeholder="HomePod mini Salon"
            />
          </label>
          <label>
            <span>${this._L("Ruta medios")}</span>
            <input
              type="text"
              data-player-index="${index}"
              data-player-field="browse_path"
              data-optional="true"
              value="${escapeHtml(player.browse_path || player.media_browser_path || "")}"
              placeholder="/media-browser/browser"
            />
          </label>
          <label>
            <span>${this._L("Titulo")}</span>
            <input
              type="text"
              data-player-index="${index}"
              data-player-field="title"
              data-optional="true"
              value="${escapeHtml(player.title || "")}"
            />
          </label>
          <label>
            <span>${this._L("Subtitulo")}</span>
            <input
              type="text"
              data-player-index="${index}"
              data-player-field="subtitle"
              data-optional="true"
              value="${escapeHtml(player.subtitle || "")}"
            />
          </label>
          <label>
            <span>${this._L("Icono fallback")}</span>
            <input
              type="text"
              data-player-index="${index}"
              data-player-field="icon"
              data-optional="true"
              value="${escapeHtml(player.icon || "")}"
              placeholder="mdi:speaker"
            />
          </label>
          <label>
            <span>${this._L("Imagen fija")}</span>
            <input
              type="text"
              data-player-index="${index}"
              data-player-field="image"
              data-optional="true"
              value="${escapeHtml(player.image || "")}"
            />
          </label>
          <label>
            <span>${this._L("Estados visibles")}</span>
            <input
              type="text"
              data-player-index="${index}"
              data-player-field="show_states"
              data-csv="true"
              data-optional="true"
              value="${escapeHtml((player.show_states || []).join(", "))}"
              placeholder="playing, paused"
            />
          </label>
          <label class="checkbox">
            <input
              type="checkbox"
              data-player-index="${index}"
              data-player-field="show"
              data-checked-value="true"
              data-unchecked-delete="true"
              ${player.show === true ? "checked" : ""}
            />
            <span class="toggle-switch" aria-hidden="true"></span>
            <span>${this._L("Mostrar siempre")}</span>
          </label>
        </div>
      </div>
    `;
  }

  _renderRoute(route, index, totalRoutes) {
    const popupMarkup = Array.isArray(route.popup) && route.popup.length > 0
      ? route.popup.map((popupItem, popupIndex) => this._renderPopupItem(index, popupItem, popupIndex, route.popup.length)).join("")
      : `<p class="hint">${this._L("Esta ruta no tiene popup todavia.")}</p>`;

    return `
      <div class="route-card">
        <div class="route-head">
          <strong>${this._L("Ruta")} ${index + 1}</strong>
          <div class="head-actions">
            <button
              type="button"
              class="secondary"
              data-editor-action="move-route-up"
              data-route-index="${index}"
              ${index === 0 ? "disabled" : ""}
            >
              ${this._L("Subir")}
            </button>
            <button
              type="button"
              class="secondary"
              data-editor-action="move-route-down"
              data-route-index="${index}"
              ${index === totalRoutes - 1 ? "disabled" : ""}
            >
              ${this._L("Bajar")}
            </button>
            <button type="button" class="danger" data-editor-action="remove-route" data-route-index="${index}">
              ${this._L("Eliminar")}
            </button>
          </div>
        </div>
        <div class="grid">
          <label>
            <span>${this._L("Etiqueta")}</span>
            <input type="text" data-route-index="${index}" data-route-field="label" value="${escapeHtml(route.label || "")}" />
          </label>
          <label>
            <span>${this._L("Icono")}</span>
            <input type="text" data-route-index="${index}" data-route-field="icon" value="${escapeHtml(route.icon || "")}" />
          </label>
          <label>
            <span>${this._L("Path")}</span>
            <input type="text" data-route-index="${index}" data-route-field="path" value="${escapeHtml(route.path || "")}" />
          </label>
          <label>
            <span>${this._L("Path activo extra")}</span>
            <input
              type="text"
              data-route-index="${index}"
              data-route-field="active_paths"
              data-csv="true"
              data-optional="true"
              value="${escapeHtml((route.active_paths || []).join(", "))}"
              placeholder="/lovelace/principal/subvista"
            />
          </label>
          <label>
            <span>${this._L("Usuarios")}</span>
            <input
              type="text"
              data-route-index="${index}"
              data-route-field="users"
              data-csv="true"
              data-optional="true"
              value="${escapeHtml((route.users || []).join(", "))}"
              placeholder="id1, id2"
            />
          </label>
          <label>
            <span>${this._L("Layout popup")}</span>
            <select data-route-index="${index}" data-route-field="popup_layout" data-optional="true">
              <option value="" ${!route.popup_layout ? "selected" : ""}>${this._L("Auto")}</option>
              <option value="vertical" ${route.popup_layout === "vertical" ? "selected" : ""}>${this._L("Vertical")}</option>
              <option value="horizontal" ${route.popup_layout === "horizontal" ? "selected" : ""}>${this._L("Horizontal")}</option>
            </select>
          </label>
          <label class="checkbox">
            <input
              type="checkbox"
              data-route-index="${index}"
              data-route-field="match"
              data-checked-value="prefix"
              data-unchecked-delete="true"
              ${route.match === "prefix" ? "checked" : ""}
            />
            <span class="toggle-switch" aria-hidden="true"></span>
            <span>${this._L("Marcar activa por prefijo")}</span>
          </label>
        </div>
        <div class="subsection">
          <div class="route-head route-head--subsection">
            <strong>${this._L("Popup")}</strong>
            <button type="button" data-editor-action="add-popup-item" data-route-index="${index}">
              ${this._L("Anadir popup")}
            </button>
          </div>
          ${popupMarkup}
        </div>
      </div>
    `;
  }

  _render() {
    const config = normalizeConfig(this._config || STUB_CONFIG);
    const routesMarkup = config.routes.map((route, index) => this._renderRoute(route, index, config.routes.length)).join("");
    const playersMarkup = (config.media_player?.players || [])
      .map((player, index) => this._renderMediaPlayerPlayer(player, index))
      .join("");
    const animationEnabled = config.animations?.enabled !== false;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        .editor {
          display: grid;
          gap: 16px;
          padding: 8px 0;
        }

        .editor-section,
        .route-card,
        .sub-card {
          background: color-mix(in srgb, var(--primary-text-color) 2%, var(--card-background-color, var(--ha-card-background, #fff)));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 18px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          padding: 16px;
        }

        .editor-section__header {
          display: grid;
          gap: 4px;
          margin-bottom: 12px;
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
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
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

        .route-head {
          align-items: center;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .route-head--subsection,
        .route-head--sub {
          margin-bottom: 10px;
        }

        .head-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .editor-grid,
        .grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .subsection {
          border-top: 1px solid var(--divider-color);
          margin-top: 16px;
          padding-top: 16px;
        }

        .sub-card {
          background: rgba(127, 127, 127, 0.08);
          margin-top: 10px;
        }

        label {
          color: var(--primary-text-color);
          display: grid;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          min-width: 0;
        }

        label span {
          color: var(--secondary-text-color);
          font-weight: 600;
        }

        input,
        select {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 40px;
          padding: 10px 12px;
          width: 100%;
        }

        .checkbox {
          align-items: center;
          column-gap: 10px;
          cursor: pointer;
          grid-template-columns: auto minmax(0, 1fr);
          min-height: 40px;
          position: relative;
        }

        .checkbox input {
          margin: 0;
          opacity: 0;
          pointer-events: none;
          position: absolute;
          width: 1px;
          min-height: 1px;
        }

        .checkbox .toggle-switch {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          display: inline-flex;
          font-size: 0;
          height: 22px;
          line-height: 0;
          position: relative;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
          width: 40px;
        }

        .checkbox .toggle-switch::before {
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

        .checkbox input:checked + .toggle-switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }

        .checkbox input:checked + .toggle-switch::before {
          transform: translateX(18px);
        }

        .checkbox input:focus-visible + .toggle-switch {
          box-shadow:
            0 0 0 3px color-mix(in srgb, var(--primary-text-color) 14%, transparent),
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }

        button {
          background: var(--primary-color);
          border: 0;
          border-radius: 999px;
          color: var(--text-primary-color, #fff);
          cursor: pointer;
          min-height: 34px;
          padding: 0 14px;
        }

        button.danger {
          background: var(--error-color);
        }

        button.secondary {
          background: var(--secondary-background-color);
          border: 1px solid var(--divider-color);
          color: var(--primary-text-color);
        }

        button[disabled] {
          cursor: default;
          opacity: 0.45;
        }

        .hint {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.4;
        }

        @media (max-width: 640px) {
          .editor-grid,
          .grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${this._L("General")}</div>
            <div class="editor-section__hint">${this._L("Opciones base de la barra, layout y visibilidad general.")}</div>
          </div>
          <div class="editor-grid">
            <label>
              <span>${this._L("Titulo")}</span>
              <input type="text" data-field="title" data-optional="true" value="${escapeHtml(config.title || "")}" />
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="haptics.enabled" ${config.haptics.enabled ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("Respuesta haptica")}</span>
            </label>
            <label>
              <span>${this._L("Estilo haptico")}</span>
              <select data-field="haptics.style">
                <option value="selection" ${config.haptics.style === "selection" ? "selected" : ""}>${this._L("Selección")}</option>
                <option value="light" ${config.haptics.style === "light" ? "selected" : ""}>${this._L("Ligero")}</option>
                <option value="medium" ${config.haptics.style === "medium" ? "selected" : ""}>${this._L("Medio")}</option>
                <option value="heavy" ${config.haptics.style === "heavy" ? "selected" : ""}>${this._L("Intenso")}</option>
                <option value="success" ${config.haptics.style === "success" ? "selected" : ""}>${this._L("Éxito")}</option>
                <option value="warning" ${config.haptics.style === "warning" ? "selected" : ""}>${this._L("Aviso")}</option>
                <option value="failure" ${config.haptics.style === "failure" ? "selected" : ""}>${this._L("Fallo")}</option>
              </select>
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="haptics.fallback_vibrate" ${config.haptics.fallback_vibrate ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("Fallback con vibracion")}</span>
            </label>
            <label>
              <span>${this._L("Breakpoint movil")}</span>
              <input type="number" data-field="layout.mobile_breakpoint" value="${escapeHtml(config.layout.mobile_breakpoint || 1279)}" />
            </label>
            <label>
              <span>${this._L("Posicion")}</span>
              <select data-field="layout.position">
                <option value="bottom" ${config.layout.position === "bottom" ? "selected" : ""}>${this._L("Inferior")}</option>
                <option value="top" ${config.layout.position === "top" ? "selected" : ""}>${this._L("Superior")}</option>
              </select>
            </label>
            <label>
              <span>${this._L("Offset")}</span>
              <input type="text" data-field="layout.offset" value="${escapeHtml(config.layout.offset || "")}" />
            </label>
            <label>
              <span>${this._L("Margen lateral")}</span>
              <input type="text" data-field="layout.side_margin" value="${escapeHtml(config.layout.side_margin || "")}" />
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="layout.full_width" ${config.layout.full_width ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("Barra a ancho completo")}</span>
            </label>
            <label>
              <span>${this._L("Separacion stack")}</span>
              <input type="text" data-field="layout.stack_gap" value="${escapeHtml(config.layout.stack_gap || "")}" />
            </label>
            <label>
              <span>${this._L("Altura reservada")}</span>
              <input type="text" data-field="layout.reserve_height" value="${escapeHtml(config.layout.reserve_height || "")}" />
            </label>
            <label>
              <span>${this._L("Z-index")}</span>
              <input type="number" data-field="layout.z_index" value="${escapeHtml(config.layout.z_index || 2)}" />
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="show_labels" ${config.show_labels ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("Mostrar etiquetas")}</span>
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="layout.fixed" ${config.layout.fixed ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("Fijar a pantalla")}</span>
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="layout.reserve_space" ${config.layout.reserve_space ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("Reservar espacio")}</span>
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="layout.show_desktop" ${config.layout.show_desktop ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("Mostrar tambien en escritorio")}</span>
            </label>
          </div>
          <p class="hint">
            ${this._L("Aqui ya puedes editar popup y media player. Para acciones muy avanzadas, sigue siendo mejor completar el YAML.")}
          </p>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${this._L("Animaciones")}</div>
            <div class="editor-section__hint">${this._L("Controla transiciones de barra, popup, media player y respuestas visuales.")}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${this._showAnimationSection ? this._L("Ocultar ajustes de animación") : this._L("Mostrar ajustes de animación")}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  <label class="checkbox">
                    <input type="checkbox" data-field="animations.enabled" ${animationEnabled ? "checked" : ""} />
                    <span class="toggle-switch" aria-hidden="true"></span>
                    <span>${this._L("Activar animaciones")}</span>
                  </label>
                  <label>
                    <span>${this._L("Barra y hover (ms)")}</span>
                    <input type="number" data-field="animations.bar_duration" value="${escapeHtml(config.animations.bar_duration || DEFAULT_CONFIG.animations.bar_duration)}" />
                  </label>
                  <label>
                    <span>${this._L("Entrada barra (ms)")}</span>
                    <input type="number" data-field="animations.dock_entrance_duration" value="${escapeHtml(config.animations.dock_entrance_duration ?? DEFAULT_CONFIG.animations.dock_entrance_duration)}" />
                  </label>
                  <label>
                    <span>${this._L("Popup (ms)")}</span>
                    <input type="number" data-field="animations.popup_duration" value="${escapeHtml(config.animations.popup_duration || DEFAULT_CONFIG.animations.popup_duration)}" />
                  </label>
                  <label>
                    <span>${this._L("Media player (ms)")}</span>
                    <input type="number" data-field="animations.media_duration" value="${escapeHtml(config.animations.media_duration || DEFAULT_CONFIG.animations.media_duration)}" />
                  </label>
                  <label>
                    <span>${this._L("Respuesta botones (ms)")}</span>
                    <input type="number" data-field="animations.button_bounce_duration" value="${escapeHtml(config.animations.button_bounce_duration || DEFAULT_CONFIG.animations.button_bounce_duration)}" />
                  </label>
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${this._L("Estilos")}</div>
            <div class="editor-section__hint">${this._L("Ajustes visuales de barra, botones, popup y media player.")}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${this._showStyleSection ? this._L("Ocultar ajustes de estilo") : this._L("Mostrar ajustes de estilo")}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  <label><span>${this._L("Fondo barra")}</span><input type="text" data-field="styles.bar.background" value="${escapeHtml(config.styles.bar.background || "")}" /></label>
                  <label><span>${this._L("Borde barra")}</span><input type="text" data-field="styles.bar.border" value="${escapeHtml(config.styles.bar.border || "")}" /></label>
                  <label><span>${this._L("Radio barra")}</span><input type="text" data-field="styles.bar.border_radius" value="${escapeHtml(config.styles.bar.border_radius || "")}" /></label>
                  <label><span>${this._L("Sombra barra")}</span><input type="text" data-field="styles.bar.box_shadow" value="${escapeHtml(config.styles.bar.box_shadow || "")}" /></label>
                  <label><span>${this._L("Padding barra")}</span><input type="text" data-field="styles.bar.padding" value="${escapeHtml(config.styles.bar.padding || "")}" /></label>
                  <label><span>${this._L("Altura minima")}</span><input type="text" data-field="styles.bar.min_height" value="${escapeHtml(config.styles.bar.min_height || "")}" /></label>
                  <label><span>${this._L("Separacion botones")}</span><input type="text" data-field="styles.bar.gap" value="${escapeHtml(config.styles.bar.gap || "")}" /></label>
                  <label><span>${this._L("Justificacion")}</span><input type="text" data-field="styles.bar.justify_content" value="${escapeHtml(config.styles.bar.justify_content || "")}" /></label>
                  <label><span>${this._L("Ancho maximo barra")}</span><input type="text" data-field="styles.bar.max_width" value="${escapeHtml(config.styles.bar.max_width || "")}" /></label>
                  <label><span>${this._L("Backdrop filter")}</span><input type="text" data-field="styles.bar.backdrop_filter" value="${escapeHtml(config.styles.bar.backdrop_filter || "")}" /></label>
                  <label><span>${this._L("Fondo botones")}</span><input type="text" data-field="styles.button.background" value="${escapeHtml(config.styles.button.background || "")}" /></label>
                  <label><span>${this._L("Color botones")}</span><input type="text" data-field="styles.button.color" value="${escapeHtml(config.styles.button.color || "")}" /></label>
                  <label><span>${this._L("Color activo")}</span><input type="text" data-field="styles.button.active_color" value="${escapeHtml(config.styles.button.active_color || "")}" /></label>
                  <label><span>${this._L("Fondo activo")}</span><input type="text" data-field="styles.button.active_background" value="${escapeHtml(config.styles.button.active_background || "")}" /></label>
                  <label><span>${this._L("Radio boton")}</span><input type="text" data-field="styles.button.border_radius" value="${escapeHtml(config.styles.button.border_radius || "")}" /></label>
                  <label><span>${this._L("Tamano boton")}</span><input type="text" data-field="styles.button.size" value="${escapeHtml(config.styles.button.size || "")}" /></label>
                  <label><span>${this._L("Tamano icono")}</span><input type="text" data-field="styles.button.icon_size" value="${escapeHtml(config.styles.button.icon_size || "")}" /></label>
                  <label><span>${this._L("Offset icono X")}</span><input type="text" data-field="styles.button.icon_offset_x" value="${escapeHtml(config.styles.button.icon_offset_x || "")}" /></label>
                  <label><span>${this._L("Offset icono Y")}</span><input type="text" data-field="styles.button.icon_offset_y" value="${escapeHtml(config.styles.button.icon_offset_y || "")}" /></label>
                  <label><span>${this._L("Color etiqueta")}</span><input type="text" data-field="styles.button.label_color" value="${escapeHtml(config.styles.button.label_color || "")}" /></label>
                  <label><span>${this._L("Color etiqueta activa")}</span><input type="text" data-field="styles.button.active_label_color" value="${escapeHtml(config.styles.button.active_label_color || "")}" /></label>
                  <label><span>${this._L("Tamano etiqueta")}</span><input type="text" data-field="styles.button.label_size" value="${escapeHtml(config.styles.button.label_size || "")}" /></label>
                  <label><span>${this._L("Separacion etiqueta")}</span><input type="text" data-field="styles.button.label_gap" value="${escapeHtml(config.styles.button.label_gap || "")}" /></label>
                  <label><span>${this._L("Fondo badge")}</span><input type="text" data-field="styles.badge.background" value="${escapeHtml(config.styles.badge.background || "")}" /></label>
                  <label><span>${this._L("Color badge")}</span><input type="text" data-field="styles.badge.color" value="${escapeHtml(config.styles.badge.color || "")}" /></label>
                  <label><span>${this._L("Tamano minimo badge")}</span><input type="text" data-field="styles.badge.min_size" value="${escapeHtml(config.styles.badge.min_size || "")}" /></label>
                  <label><span>${this._L("Tamano texto badge")}</span><input type="text" data-field="styles.badge.font_size" value="${escapeHtml(config.styles.badge.font_size || "")}" /></label>
                  <label><span>${this._L("Fondo popup")}</span><input type="text" data-field="styles.popup.background" value="${escapeHtml(config.styles.popup.background || "")}" /></label>
                  <label><span>${this._L("Borde popup")}</span><input type="text" data-field="styles.popup.border" value="${escapeHtml(config.styles.popup.border || "")}" /></label>
                  <label><span>${this._L("Radio popup")}</span><input type="text" data-field="styles.popup.border_radius" value="${escapeHtml(config.styles.popup.border_radius || "")}" /></label>
                  <label><span>${this._L("Sombra popup")}</span><input type="text" data-field="styles.popup.box_shadow" value="${escapeHtml(config.styles.popup.box_shadow || "")}" /></label>
                  <label>
                    <span>${this._L("Layout popup")}</span>
                    <select data-field="styles.popup.layout" data-optional="true">
                      <option value="" ${!config.styles.popup.layout || config.styles.popup.layout === "auto" ? "selected" : ""}>${this._L("Auto")}</option>
                      <option value="vertical" ${config.styles.popup.layout === "vertical" ? "selected" : ""}>${this._L("Vertical")}</option>
                      <option value="horizontal" ${config.styles.popup.layout === "horizontal" ? "selected" : ""}>${this._L("Horizontal")}</option>
                    </select>
                  </label>
                  <label><span>${this._L("Padding popup")}</span><input type="text" data-field="styles.popup.padding" value="${escapeHtml(config.styles.popup.padding || "")}" /></label>
                  <label><span>${this._L("Ancho minimo popup")}</span><input type="text" data-field="styles.popup.min_width" value="${escapeHtml(config.styles.popup.min_width || "")}" /></label>
                  <label><span>${this._L("Ancho maximo popup")}</span><input type="text" data-field="styles.popup.max_width" value="${escapeHtml(config.styles.popup.max_width || "")}" /></label>
                  <label><span>${this._L("Tamano item popup")}</span><input type="text" data-field="styles.popup.item_size" value="${escapeHtml(config.styles.popup.item_size || "")}" /></label>
                  <label><span>${this._L("Tamano etiqueta popup")}</span><input type="text" data-field="styles.popup.label_size" value="${escapeHtml(config.styles.popup.label_size || "")}" /></label>
                  <label><span>${this._L("Separacion popup")}</span><input type="text" data-field="styles.popup.item_gap" value="${escapeHtml(config.styles.popup.item_gap || "")}" /></label>
                  <label><span>${this._L("Veladura popup")}</span><input type="text" data-field="styles.popup.backdrop" value="${escapeHtml(config.styles.popup.backdrop || "")}" /></label>
                  <label><span>${this._L("Fondo media player")}</span><input type="text" data-field="styles.media_player.background" value="${escapeHtml(config.styles.media_player.background || "")}" /></label>
                  <label><span>${this._L("Borde media player")}</span><input type="text" data-field="styles.media_player.border" value="${escapeHtml(config.styles.media_player.border || "")}" /></label>
                  <label><span>${this._L("Radio media player")}</span><input type="text" data-field="styles.media_player.border_radius" value="${escapeHtml(config.styles.media_player.border_radius || "")}" /></label>
                  <label><span>${this._L("Sombra media player")}</span><input type="text" data-field="styles.media_player.box_shadow" value="${escapeHtml(config.styles.media_player.box_shadow || "")}" /></label>
                  <label><span>${this._L("Padding media player")}</span><input type="text" data-field="styles.media_player.padding" value="${escapeHtml(config.styles.media_player.padding || "")}" /></label>
                  <label><span>${this._L("Altura minima media player")}</span><input type="text" data-field="styles.media_player.min_height" value="${escapeHtml(config.styles.media_player.min_height || "")}" /></label>
                  <label><span>${this._L("Tamano portada")}</span><input type="text" data-field="styles.media_player.artwork_size" value="${escapeHtml(config.styles.media_player.artwork_size || "")}" /></label>
                  <label><span>${this._L("Tamano controles")}</span><input type="text" data-field="styles.media_player.control_size" value="${escapeHtml(config.styles.media_player.control_size || "")}" /></label>
                  <label><span>${this._L("Tamano titulo")}</span><input type="text" data-field="styles.media_player.title_size" value="${escapeHtml(config.styles.media_player.title_size || "")}" /></label>
                  <label><span>${this._L("Tamano subtitulo")}</span><input type="text" data-field="styles.media_player.subtitle_size" value="${escapeHtml(config.styles.media_player.subtitle_size || "")}" /></label>
                  <label><span>${this._L("Color progreso")}</span><input type="text" data-field="styles.media_player.progress_color" value="${escapeHtml(config.styles.media_player.progress_color || "")}" /></label>
                  <label><span>${this._L("Fondo progreso")}</span><input type="text" data-field="styles.media_player.progress_background" value="${escapeHtml(config.styles.media_player.progress_background || "")}" /></label>
                  <label><span>${this._L("Overlay portada")}</span><input type="text" data-field="styles.media_player.overlay_color" value="${escapeHtml(config.styles.media_player.overlay_color || "")}" /></label>
                  <label><span>${this._L("Tamano indicadores")}</span><input type="text" data-field="styles.media_player.dot_size" value="${escapeHtml(config.styles.media_player.dot_size || "")}" /></label>
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${this._L("Media Player")}</div>
            <div class="editor-section__hint">${this._L("Opciones generales del reproductor integrado y lista de players visibles.")}</div>
            <div class="editor-section__actions">
              <button type="button" data-editor-action="add-player">${this._L("Anadir player")}</button>
            </div>
          </div>
          <div class="editor-grid">
            <label class="checkbox">
              <input type="checkbox" data-field="media_player.show_desktop" ${config.media_player.show_desktop ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("Mostrar tambien en escritorio")}</span>
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="media_player.album_cover_background" ${config.media_player.album_cover_background ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("Usar caratula de fondo")}</span>
            </label>
            <label>
              <span>${this._L("Altura reservada")}</span>
              <input type="text" data-field="media_player.reserve_height" value="${escapeHtml(config.media_player.reserve_height || "")}" />
            </label>
            <label>
              <span>${this._L("Separacion con navbar")}</span>
              <input type="text" data-field="media_player.gap" value="${escapeHtml(config.media_player.gap || "")}" />
            </label>
            <label>
              <span>${this._L("Tamano portada")}</span>
              <input type="text" data-field="styles.media_player.artwork_size" value="${escapeHtml(config.styles.media_player.artwork_size || "")}" />
            </label>
            <label>
              <span>${this._L("Tamano controles")}</span>
              <input type="text" data-field="styles.media_player.control_size" value="${escapeHtml(config.styles.media_player.control_size || "")}" />
            </label>
            <label>
              <span>${this._L("Tamano titulo")}</span>
              <input type="text" data-field="styles.media_player.title_size" value="${escapeHtml(config.styles.media_player.title_size || "")}" />
            </label>
            <label>
              <span>${this._L("Tamano subtitulo")}</span>
              <input type="text" data-field="styles.media_player.subtitle_size" value="${escapeHtml(config.styles.media_player.subtitle_size || "")}" />
            </label>
          </div>
          <div class="subsection">
            ${playersMarkup || `<p class="hint">${this._L("No hay reproductores configurados.")}</p>`}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${this._L("Rutas")}</div>
            <div class="editor-section__hint">${this._L("Añade, reordena y personaliza los destinos de la barra y sus popups.")}</div>
            <div class="editor-section__actions">
              <button type="button" data-editor-action="add-route">${this._L("Anadir ruta")}</button>
            </div>
          </div>
          ${routesMarkup || `<p class="hint">${this._L("No hay rutas todavia.")}</p>`}
        </section>
      </div>
    `;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaNavigationBarCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaNavigationBarEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Navigation Bar",
  description: "Barra de navegacion fija y configurable para Home Assistant.",
  preview: true,
});

console.info(
  `%c ${CARD_TAG} %c v${CARD_VERSION} `,
  "background:#2f4858;color:#fff;padding:4px 8px;border-radius:999px 0 0 999px;font-weight:700;",
  "background:#4f7c82;color:#fff;padding:4px 8px;border-radius:0 999px 999px 0;font-weight:700;",
);
