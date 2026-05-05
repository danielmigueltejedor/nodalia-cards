const CARD_TAG = "nodalia-calendar-card";
const EDITOR_TAG = "nodalia-calendar-card-editor";
const CARD_VERSION = "1.0.0-alpha.11";
const COMPLETION_STORAGE_KEY = "nodalia_calendar_completed_v1";

const VALID_TIME_RANGES = ["3d", "1w", "2w", "1m"];

const DEFAULT_CONFIG = {
  title: "Calendario",
  icon: "mdi:calendar-month",
  calendars: [],
  time_range: "1w",
  days_to_show: 7,
  max_visible_events: 2,
  refresh_interval: 300,
  show_completed: false,
  allow_complete: true,
  shared_completed_events_entity: "",
  tint_auto: true,
  animations: {
    enabled: true,
    content_duration: 260,
  },
  styles: {
    card: {
      background: "var(--ha-card-background, var(--card-background-color))",
      border: "1px solid var(--divider-color)",
      border_radius: "28px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "14px",
      gap: "12px",
    },
    icon: {
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      on_color:
        "color-mix(in srgb, var(--primary-color) 52%, var(--primary-text-color))",
      off_color:
        "color-mix(in srgb, var(--primary-text-color) 62%, var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 48%, transparent)))",
      size: "38px",
    },
    tint: {
      color: "var(--primary-color)",
    },
    title_size: "17px",
    event_size: "13px",
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_size: "11px",
  },
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeConfig(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? deepClone(override) : deepClone(base);
  }
  if (!isObject(base)) {
    return override === undefined ? base : override;
  }
  const out = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(override || {})]);
  keys.forEach(key => {
    const baseValue = base[key];
    const overrideValue = override ? override[key] : undefined;
    if (overrideValue === undefined) {
      out[key] = deepClone(baseValue);
      return;
    }
    if (isObject(baseValue) && isObject(overrideValue)) {
      out[key] = mergeConfig(baseValue, overrideValue);
      return;
    }
    out[key] = deepClone(overrideValue);
  });
  return out;
}

function compactCalendarConfig(value) {
  if (Array.isArray(value)) {
    return value.map(item => compactCalendarConfig(item)).filter(item => item !== undefined);
  }
  if (isObject(value)) {
    const compacted = {};
    Object.entries(value).forEach(([key, item]) => {
      const cleaned = compactCalendarConfig(item);
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

function sanitizeCalendarTint(value) {
  const s = String(value ?? "").trim();
  if (!s) {
    return "";
  }
  if (/^#[0-9a-f]{3,8}$/i.test(s)) {
    return s;
  }
  if (/^rgba?\(/i.test(s) && s.length < 140) {
    return s;
  }
  if (/^color-mix\(/i.test(s) && s.length < 240) {
    return s;
  }
  if (/^var\(--[a-zA-Z0-9_-]+\)$/i.test(s)) {
    return s;
  }
  return "";
}

function daysFromTimeRange(tr) {
  const map = { "3d": 3, "1w": 7, "2w": 14, "1m": 31 };
  return map[tr] || 7;
}

function normalizeCalendarEntries(calendars) {
  if (!Array.isArray(calendars)) {
    return [];
  }
  const out = [];
  calendars.forEach(raw => {
    if (typeof raw === "string") {
      out.push({
        entity: String(raw ?? "").trim(),
        label: "",
        tint: "",
      });
      return;
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      out.push({
        entity: String(raw.entity ?? "").trim(),
        label: String(raw.label ?? "").trim(),
        tint: sanitizeCalendarTint(raw.tint),
      });
    }
  });
  return out;
}

function normalizeConfig(config) {
  const normalized = mergeConfig(DEFAULT_CONFIG, config || {});
  normalized.calendars = normalizeCalendarEntries(normalized.calendars);
  let timeRange = String(normalized.time_range || "").trim();
  if (!VALID_TIME_RANGES.includes(timeRange)) {
    const legacyDays = Number(normalized.days_to_show);
    if (Number.isFinite(legacyDays)) {
      if (legacyDays <= 3) {
        timeRange = "3d";
      } else if (legacyDays <= 7) {
        timeRange = "1w";
      } else if (legacyDays <= 14) {
        timeRange = "2w";
      } else {
        timeRange = "1m";
      }
    } else {
      timeRange = DEFAULT_CONFIG.time_range;
    }
  }
  normalized.time_range = timeRange;
  normalized.days_to_show = Math.min(62, Math.max(1, daysFromTimeRange(timeRange)));
  normalized.shared_completed_events_entity = String(normalized.shared_completed_events_entity ?? "").trim();
  normalized.max_visible_events = Math.min(
    12,
    Math.max(1, Number(normalized.max_visible_events) || DEFAULT_CONFIG.max_visible_events),
  );
  normalized.refresh_interval = Math.min(3600, Math.max(30, Number(normalized.refresh_interval) || DEFAULT_CONFIG.refresh_interval));
  if (!normalized.styles.chip_font_size && normalized.styles.chip_size) {
    normalized.styles.chip_font_size = normalized.styles.chip_size;
  }
  const iconStyle = normalized.styles?.icon;
  if (iconStyle && iconStyle.color && !iconStyle.on_color) {
    iconStyle.on_color = iconStyle.color;
  }
  return normalized;
}

function calendarExitDurationMs(contentDuration) {
  const base = Math.min(1600, Math.max(120, Number(contentDuration) || DEFAULT_CONFIG.animations.content_duration));
  return Math.min(640, Math.max(320, Math.round(base * 0.62)));
}

function timeRangeChipLabel(tr) {
  const labels = {
    "3d": "3 dias",
    "1w": "1 semana",
    "2w": "2 semanas",
    "1m": "1 mes",
  };
  return labels[tr] || labels["1w"];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeSelectorValue(value) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
  if (normalizedField.endsWith("styles.card.background")) {
    return DEFAULT_CONFIG.styles.card.background;
  }
  if (normalizedField.endsWith("styles.icon.background")) {
    return DEFAULT_CONFIG.styles.icon.background;
  }
  if (normalizedField.endsWith("styles.icon.on_color")) {
    return DEFAULT_CONFIG.styles.icon.on_color;
  }
  if (normalizedField.endsWith("styles.icon.off_color")) {
    return DEFAULT_CONFIG.styles.icon.off_color;
  }
  if (normalizedField.endsWith("styles.tint.color")) {
    return DEFAULT_CONFIG.styles.tint.color;
  }
  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }
  return "var(--info-color, #71c0ff)";
}

function formatDateLabel(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatTimeLabel(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** All-day strings (YYYY-MM-DD): parse as local calendar date so WebKit/iOS match grouping with Chrome. */
function parseCalendarDateOnlyLocal(raw) {
  const s = String(raw ?? "").trim();
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!dm) {
    return null;
  }
  const y = Number(dm[1]);
  const mo = Number(dm[2]) - 1;
  const d = Number(dm[3]);
  const local = new Date(y, mo, d, 12, 0, 0);
  return Number.isFinite(local.getTime()) ? local : null;
}

function normalizeCalendarFetchResult(raw) {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw && typeof raw === "object" && Array.isArray(raw.events)) {
    return raw.events;
  }
  return [];
}

function eventDate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const dayLocal = parseCalendarDateOnlyLocal(value);
    if (dayLocal) {
      return dayLocal;
    }
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  if (typeof value === "object") {
    if (value.dateTime) {
      const parsed = new Date(value.dateTime);
      return Number.isFinite(parsed.getTime()) ? parsed : null;
    }
    if (value.date) {
      const dayLocal = parseCalendarDateOnlyLocal(value.date);
      if (dayLocal) {
        return dayLocal;
      }
      const parsed = new Date(value.date);
      return Number.isFinite(parsed.getTime()) ? parsed : null;
    }
    return null;
  }
  return null;
}

function eventIsAllDay(event) {
  return Boolean(event?.start?.date && !event?.start?.dateTime);
}

function completionKey(event) {
  const source = String(event?._entity || "");
  const uid = String(event?.uid || event?.id || "");
  const start = eventDate(event?.start)?.toISOString() || "";
  const summary = String(event?.summary || "");
  return `${source}|${uid}|${start}|${summary}`;
}

class NodaliaCalendarCard extends HTMLElement {
  static getStubConfig() {
    return deepClone(DEFAULT_CONFIG);
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(DEFAULT_CONFIG);
    this._hass = null;
    this._events = [];
    this._loading = false;
    this._error = "";
    this._refreshTimer = 0;
    this._completed = new Set();
    this._hadHass = false;
    this._lastRenderSignature = "";
    this._calendarEntrancePlayed = false;
    this._expandedOpen = false;
    this._completeExitKeys = new Set();
    this._completeExitTimers = new Map();
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowKeydown = this._onShadowKeydown.bind(this);
    this._onDocVisibility = this._onDocVisibility.bind(this);
    this._lastSubmittedSharedCompletedValue = "";
    this._lastSyncedSharedCompletedRaw = undefined;
    this._completedMergedOnce = false;
  }

  _onDocVisibility() {
    if (typeof document === "undefined" || document.visibilityState !== "visible") {
      return;
    }
    if (!this._hass || !(this._config.calendars || []).some(c => c && c.entity)) {
      return;
    }
    this._refreshEvents();
  }

  async _fetchCalendarEventsViaRest(entityId, start, end) {
    const hass = this._hass;
    if (!hass?.auth?.fetchWithAuth || typeof hass.auth.fetchWithAuth !== "function") {
      return [];
    }
    const qs = `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
    try {
      const response = await hass.auth.fetchWithAuth(
        `/api/calendars/${encodeURIComponent(entityId)}?${qs}`,
      );
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return normalizeCalendarFetchResult(data);
    } catch (_error) {
      return [];
    }
  }

  _shouldShowEventInList(event) {
    const config = this._config;
    const key = completionKey(event);
    const done = this._completed.has(key);
    return config.show_completed || !done || this._completeExitKeys.has(key);
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this.shadowRoot?.addEventListener("keydown", this._onShadowKeydown);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this._onDocVisibility);
    }
    this._loadCompleted();
    if (!this._hadHass) {
      this._refreshEvents();
    }
  }

  disconnectedCallback() {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this._onDocVisibility);
    }
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    this.shadowRoot?.removeEventListener("keydown", this._onShadowKeydown);
    if (this._refreshTimer) {
      window.clearTimeout(this._refreshTimer);
      this._refreshTimer = 0;
    }
    this._completeExitTimers.forEach(tid => window.clearTimeout(tid));
    this._completeExitTimers.clear();
    this._completeExitKeys.clear();
  }

  setConfig(config) {
    const prevHelper = String(this._config?.shared_completed_events_entity || "").trim();
    this._config = normalizeConfig(config);
    const nextHelper = String(this._config.shared_completed_events_entity || "").trim();
    if (prevHelper !== nextHelper) {
      this._completedMergedOnce = false;
      this._lastSyncedSharedCompletedRaw = undefined;
      this._lastSubmittedSharedCompletedValue = "";
    }
    this._loadCompleted();
    if (this._hass && this._getSharedCompletedEntityId()) {
      this._syncCompletedPersistenceFromHass();
    }
    this._refreshEvents();
  }

  _getSharedCompletedEntityId() {
    const id = String(this._config?.shared_completed_events_entity || "").trim();
    return id.startsWith("input_text.") ? id : "";
  }

  _getSharedCompletedPersistenceSignature() {
    const id = this._getSharedCompletedEntityId();
    if (!id || !this._hass?.states?.[id]) {
      return "";
    }
    const st = this._hass.states[id];
    const maxLen = Number(st.attributes?.max);
    return `${id}\u001f${String(st.state ?? "")}\u001f${Number.isFinite(maxLen) ? maxLen : 0}`;
  }

  _getSharedCompletedMaxLength() {
    const id = this._getSharedCompletedEntityId();
    if (!id || !this._hass?.states?.[id]) {
      return 255;
    }
    const max = Number(this._hass.states[id].attributes?.max);
    return Number.isFinite(max) && max > 0 ? max : 255;
  }

  _readLocalCompletedKeysOnly() {
    if (typeof window === "undefined" || !window.localStorage) {
      return [];
    }
    try {
      const raw = window.localStorage.getItem(COMPLETION_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(k => String(k)) : [];
    } catch (_error) {
      return [];
    }
  }

  _syncCompletedPersistenceFromHass() {
    const id = this._getSharedCompletedEntityId();
    if (!id || !this._hass?.states?.[id]) {
      return;
    }

    const st = this._hass.states[id];
    const raw = String(st?.state ?? "");
    if (["unknown", "unavailable"].includes(raw)) {
      return;
    }

    if (raw === this._lastSyncedSharedCompletedRaw) {
      return;
    }

    let parsed = [];
    try {
      const v = JSON.parse(raw || "[]");
      if (!Array.isArray(v)) {
        return;
      }
      parsed = v.map(k => String(k));
    } catch (_error) {
      return;
    }

    this._lastSyncedSharedCompletedRaw = raw;

    if (!this._completedMergedOnce) {
      const local = this._readLocalCompletedKeysOnly();
      this._completed = new Set([...local, ...parsed]);
      this._completedMergedOnce = true;
      this._saveCompleted();
      return;
    }

    this._completed = new Set(parsed);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch (_error) {
      // Ignore storage errors.
    }
  }

  set hass(hass) {
    const hadHass = this._hadHass;
    const prevLocale = this._hass?.locale?.language;
    const prevLabelSig = hadHass ? this._getCalendarEntityLabelsSignature() : "";
    const prevSharedSig = hadHass ? this._getSharedCompletedPersistenceSignature() : "";
    this._hass = hass;
    if (!hass) {
      return;
    }
    if (!hadHass) {
      this._hadHass = true;
      this._syncCompletedPersistenceFromHass();
      if (this._config.calendars.some(c => c && c.entity)) {
        this._refreshEvents();
      } else {
        this._renderIfChanged();
      }
      return;
    }
    const nextSharedSig = this._getSharedCompletedPersistenceSignature();
    if (prevSharedSig !== nextSharedSig) {
      this._syncCompletedPersistenceFromHass();
      this._renderIfChanged(true);
    }
    const nextLabelSig = this._getCalendarEntityLabelsSignature();
    if (prevLocale !== hass.locale?.language || prevLabelSig !== nextLabelSig) {
      this._renderIfChanged(true);
    }
  }

  _getLocale() {
    return this._hass?.locale?.language || "es-ES";
  }

  _getCalendarEntityLabel(entityId) {
    const id = String(entityId ?? "").trim();
    if (!id) {
      return "";
    }
    const friendly = String(this._hass?.states?.[id]?.attributes?.friendly_name ?? "").trim();
    if (friendly) {
      return friendly;
    }
    const short = id.includes(".") ? id.slice(id.indexOf(".") + 1) : id;
    const humanized = short.replace(/_/g, " ").trim();
    return humanized || id;
  }

  _getCalendarEntityLabelsSignature() {
    const hass = this._hass;
    if (!hass?.states) {
      return "";
    }
    const ids = new Set([
      ...(this._config?.calendars || []).map(c => c?.entity).filter(Boolean),
      ...this._events.map(event => event._entity).filter(Boolean),
    ]);
    const meta = (this._config?.calendars || [])
      .map(c => `${c?.entity || ""}\u001f${c?.label || ""}\u001f${c?.tint || ""}`)
      .join("\u001e");
    return [
      [...ids]
        .sort()
        .map(id => {
          const friendly = String(hass.states[id]?.attributes?.friendly_name ?? "").trim();
          return `${id}\u001f${friendly}`;
        })
        .join("\u001e"),
      meta,
    ].join("\u001f\u001f");
  }

  _getCalendarEntry(entityId) {
    const id = String(entityId ?? "").trim();
    const list = Array.isArray(this._config?.calendars) ? this._config.calendars : [];
    return list.find(c => c.entity === id) || { entity: id, label: "", tint: "" };
  }

  _getEventSubtitleForDisplay(entityId) {
    const entry = this._getCalendarEntry(entityId);
    if (entry.label) {
      return entry.label;
    }
    return this._getCalendarEntityLabel(entityId);
  }

  _expandedLayoutKind(timeRange) {
    const tr = timeRange || DEFAULT_CONFIG.time_range;
    if (tr === "3d") {
      return "column";
    }
    if (tr === "1m") {
      return "month";
    }
    return "horizontal";
  }

  _groupsByDayKey(groups) {
    const map = new Map();
    groups.forEach(group => {
      const ev = group.events[0];
      const d = ev ? eventDate(ev.start) : null;
      if (d) {
        map.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, group);
      }
    });
    return map;
  }

  _weekdayHeadersMondayFirst(locale) {
    const refMonday = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(refMonday.getTime() + i * 86400000);
      return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
    });
  }

  _renderSingleEventHtml(event, config, locale, options = {}) {
    const compact = options.compact === true;
    const doneKey = completionKey(event);
    const done = this._completed.has(doneKey);
    const start = eventDate(event.start);
    const timeLabel = eventIsAllDay(event)
      ? "Todo el dia"
      : start
        ? formatTimeLabel(start, locale)
        : "--:--";
    const summary = String(event.summary || event.message || "Evento sin titulo");
    const subtitle = this._getEventSubtitleForDisplay(event._entity);
    const tintRaw = sanitizeCalendarTint(this._getCalendarEntry(event._entity).tint);
    const tintClass = tintRaw ? " calendar-event--tinted" : "";
    const tintStyle = tintRaw ? ` style="--cal-tint:${escapeHtml(tintRaw)}"` : "";
    const compactClass = compact ? " calendar-event--compact" : "";
    const exiting = this._completeExitKeys.has(doneKey);
    const exitClass = exiting ? " calendar-event--exit" : "";
    return `
      <div class="calendar-event ${done ? "is-completed" : ""}${tintClass}${compactClass}${exitClass}"${tintStyle}>
        <div class="calendar-event__time">${escapeHtml(timeLabel)}</div>
        <div class="calendar-event__summary">
          ${escapeHtml(summary)}
          ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}
        </div>
        ${
          config.allow_complete
            ? `<button type="button" class="calendar-event__done" data-action="toggle-complete" data-key="${escapeHtml(doneKey)}">${done ? "Hecho" : "Marcar"}</button>`
            : ""
        }
      </div>
    `;
  }

  _renderExpandedBody(groups, config, locale) {
    const tr = config.time_range || DEFAULT_CONFIG.time_range;
    const mode = this._expandedLayoutKind(tr);
    if (mode === "month") {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      const daysInMonth = last.getDate();
      const leading = (first.getDay() + 6) % 7;
      const map = this._groupsByDayKey(groups);
      const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(first);
      const headers = this._weekdayHeadersMondayFirst(locale);
      const cells = [];
      for (let i = 0; i < leading; i += 1) {
        cells.push({ kind: "pad" });
      }
      for (let d = 1; d <= daysInMonth; d += 1) {
        cells.push({ kind: "day", day: d, date: new Date(y, m, d) });
      }
      while (cells.length % 7 !== 0) {
        cells.push({ kind: "pad" });
      }
      return `
        <div class="calendar-expanded__month">
          <div class="calendar-expanded__month-banner">${escapeHtml(title)}</div>
          <div class="calendar-expanded__month-matrix-wrap">
            <div class="calendar-expanded__month-matrix">
              <div class="calendar-expanded__month-weekdays">
                ${headers.map(h => `<div class="calendar-expanded__month-weekday">${escapeHtml(h)}</div>`).join("")}
              </div>
              <div class="calendar-expanded__month-grid">
                ${cells
                  .map(cell => {
                    if (cell.kind === "pad") {
                      return `<div class="calendar-expanded__month-cell calendar-expanded__month-cell--pad"></div>`;
                    }
                    const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
                    const group = map.get(key);
                    return `
                      <div class="calendar-expanded__month-cell">
                        <div class="calendar-expanded__month-daynum">${cell.day}</div>
                        <div class="calendar-expanded__month-events">
                          ${
                            group
                              ? group.events.map(ev => this._renderSingleEventHtml(ev, config, locale, { compact: true })).join("")
                              : ""
                          }
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          </div>
        </div>
      `;
    }
    const rowClass = mode === "column" ? "calendar-expanded__column" : "calendar-expanded__horizontal";
    return `
      <div class="${rowClass}">
        ${groups
          .map(
            group => `
          <div class="calendar-expanded__col">
            <div class="calendar-expanded__col-label">${escapeHtml(group.label)}</div>
            <div class="calendar-expanded__col-events">
              ${group.events.map(ev => this._renderSingleEventHtml(ev, config, locale)).join("")}
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  _loadCompleted() {
    this._completed = new Set(this._readLocalCompletedKeysOnly());
  }

  _saveCompleted() {
    const sortedKeys = [...this._completed].sort();
    const payload = JSON.stringify(sortedKeys);

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(COMPLETION_STORAGE_KEY, payload);
      } catch (_error) {
        // Ignore storage errors.
      }
    }

    const entityId = this._getSharedCompletedEntityId();
    if (!entityId || !this._hass?.callService) {
      return;
    }

    const maxLen = this._getSharedCompletedMaxLength();
    if (payload.length > maxLen) {
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn(
          "Nodalia Calendar Card: la lista de eventos completados no cabe en el input_text (aumenta max en el helper o marca menos eventos).",
        );
      }
      return;
    }

    const currentState = String(this._hass.states?.[entityId]?.state ?? "");
    if (payload === currentState || payload === this._lastSubmittedSharedCompletedValue) {
      return;
    }

    this._lastSubmittedSharedCompletedValue = payload;
    this._hass.callService("input_text", "set_value", {
      entity_id: entityId,
      value: payload,
    });
  }

  _scheduleRefresh() {
    if (this._refreshTimer) {
      window.clearTimeout(this._refreshTimer);
      this._refreshTimer = 0;
    }
    this._refreshTimer = window.setTimeout(() => {
      this._refreshTimer = 0;
      this._refreshEvents();
    }, this._config.refresh_interval * 1000);
  }

  _getRenderSignature() {
    const config = this._config;
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const visibleEvents = this._events.filter(event => this._shouldShowEventInList(event));
    const eventKeys = visibleEvents
      .map(event => {
        const start = eventDate(event?.start)?.getTime() || 0;
        return `${completionKey(event)}@${start}`;
      })
      .join("|");
    const completedSig = [...this._completed].sort().join("|");
    const calendarSig = (config.calendars || [])
      .map(c => `${c.entity}\u001f${c.label}\u001f${c.tint}`)
      .join("|");
    return [
      calendarSig,
      config.title,
      config.icon,
      config.time_range || DEFAULT_CONFIG.time_range,
      config.days_to_show,
      config.max_visible_events,
      config.show_completed,
      config.allow_complete,
      config.shared_completed_events_entity || "",
      config.tint_auto,
      config.animations?.enabled,
      config.animations?.content_duration,
      styles.card?.background,
      styles.card?.border,
      styles.card?.border_radius,
      styles.card?.box_shadow,
      styles.card?.padding,
      styles.card?.gap,
      styles.title_size,
      styles.event_size,
      styles.chip_height,
      styles.chip_font_size,
      styles.chip_padding,
      styles.chip_size,
      styles.icon?.background,
      styles.icon?.on_color,
      styles.icon?.off_color,
      styles.icon?.size,
      styles.tint?.color,
      this._getLocale(),
      this._loading ? "1" : "0",
      this._error,
      eventKeys,
      completedSig,
      this._expandedOpen ? "1" : "0",
      [...this._completeExitKeys].sort().join("|"),
    ].join("\u001e");
  }

  _renderIfChanged(force = false) {
    const next = this._getRenderSignature();
    if (!force && next === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = next;
    this._render();
  }

  async _refreshEvents() {
    const calendarIds = (this._config.calendars || []).map(c => c.entity).filter(Boolean);
    if (!this._hass || !calendarIds.length) {
      this._events = [];
      this._loading = false;
      this._error = "";
      this._renderIfChanged(true);
      return;
    }
    this._loading = true;
    this._error = "";
    this._renderIfChanged(true);
    const hass = this._hass;
    try {
      const start = new Date();
      const end = new Date(start.getTime() + this._config.days_to_show * 24 * 60 * 60 * 1000);
      const all = [];
      for (const entityId of calendarIds) {
        const path = `calendars/${encodeURIComponent(entityId)}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
        let rows = [];
        try {
          const raw = await hass.callApi("GET", path);
          rows = normalizeCalendarFetchResult(raw);
          if (!Array.isArray(raw)) {
            const fallback = await this._fetchCalendarEventsViaRest(entityId, start, end);
            if (fallback.length) {
              rows = fallback;
            }
          }
        } catch (_apiError) {
          rows = await this._fetchCalendarEventsViaRest(entityId, start, end);
        }
        rows.forEach(item => all.push({ ...item, _entity: entityId }));
      }
      all.sort((left, right) => {
        const a = eventDate(left?.start)?.getTime() || 0;
        const b = eventDate(right?.start)?.getTime() || 0;
        return a - b;
      });
      this._events = all;
    } catch (_error) {
      this._error = "No se pudieron cargar eventos del calendario.";
    } finally {
      this._loading = false;
      this._renderIfChanged(true);
      this._scheduleRefresh();
    }
  }

  _toggleCompleted(key) {
    if (!key) {
      return;
    }
    const config = this._config;
    const exitMs = calendarExitDurationMs(config.animations?.content_duration);
    if (this._completed.has(key)) {
      const pending = this._completeExitTimers.get(key);
      if (pending) {
        window.clearTimeout(pending);
        this._completeExitTimers.delete(key);
      }
      this._completeExitKeys.delete(key);
      this._completed.delete(key);
      this._saveCompleted();
      this._renderIfChanged(true);
      return;
    }
    this._completed.add(key);
    this._saveCompleted();
    const shouldExitAnimate =
      config.animations?.enabled !== false && !config.show_completed && !this._completeExitKeys.has(key);
    if (!shouldExitAnimate) {
      this._renderIfChanged(true);
      return;
    }
    this._completeExitKeys.add(key);
    this._renderIfChanged(true);
    const tid = window.setTimeout(() => {
      this._completeExitTimers.delete(key);
      this._completeExitKeys.delete(key);
      this._renderIfChanged(true);
    }, exitMs);
    this._completeExitTimers.set(key, tid);
  }

  _groupEvents(events) {
    const locale = this._getLocale();
    const groups = new Map();
    events.forEach(event => {
      const date = eventDate(event.start);
      if (!date) {
        return;
      }
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          label: formatDateLabel(date, locale),
          events: [],
        });
      }
      groups.get(key).events.push(event);
    });
    return [...groups.values()];
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    const config = this._config;
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const locale = this._getLocale();
    const useAutoPrimaryTint = config.tint_auto !== false;
    const accentColor = useAutoPrimaryTint
      ? "var(--primary-color)"
      : String(styles.tint?.color || DEFAULT_CONFIG.styles.tint.color).trim() || "var(--primary-color)";
    const baseCardBg = styles.card.background;
    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${baseCardBg}) 0%, color-mix(in srgb, ${accentColor} 10%, ${baseCardBg}) 52%, ${baseCardBg} 100%)`;
    const onCardBorder = `color-mix(in srgb, ${accentColor} 32%, var(--divider-color))`;
    const onCardShadow = `0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`;
    const cardBackground = onCardBackground;
    const cardBorder = `1px solid ${onCardBorder}`;
    const cardShadow = `${styles.card.box_shadow}, ${onCardShadow}`;
    const iconBubbleBg = `color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))`;
    const iconBubbleGlyph = String(styles.icon?.on_color || DEFAULT_CONFIG.styles.icon.on_color);
    const iconSize = styles.icon?.size || DEFAULT_CONFIG.styles.icon.size;
    const chipHeight = styles.chip_height || DEFAULT_CONFIG.styles.chip_height;
    const chipFontSize = styles.chip_font_size || styles.chip_size || DEFAULT_CONFIG.styles.chip_font_size;
    const chipPadding = styles.chip_padding || DEFAULT_CONFIG.styles.chip_padding;
    const animationDuration = Math.min(
      1600,
      Math.max(120, Number(config.animations?.content_duration) || DEFAULT_CONFIG.animations.content_duration),
    );
    const exitDurationMs = calendarExitDurationMs(config.animations?.content_duration);
    const maxVisibleEvents = Math.max(1, Number(config.max_visible_events) || DEFAULT_CONFIG.max_visible_events);
    const visibleEvents = this._events.filter(event => this._shouldShowEventInList(event));
    const groups = this._groupEvents(visibleEvents);
    const hasEvents = visibleEvents.length > 0;
    const playEntrance =
      config.animations?.enabled !== false && !this._calendarEntrancePlayed && !this._loading;
    if (playEntrance) {
      this._calendarEntrancePlayed = true;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display:block;
          --calendar-exit-duration: ${exitDurationMs}ms;
        }
        * { box-sizing:border-box; }
        ha-card {
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          display: block;
          isolation: isolate;
          overflow: hidden;
          overscroll-behavior-y: contain;
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        ha-card::before {
          background: linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0));
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }
        ha-card::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%);
          content: "";
          inset: 0;
          opacity: 1;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }
        .calendar-card {
          cursor: pointer;
          display:grid;
          gap:${styles.card.gap};
          padding:${styles.card.padding};
          position: relative;
          z-index: 1;
          ${playEntrance ? `animation: calendar-card-in ${animationDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;` : ""}
        }
        .calendar-header {
          align-items:center;
          display:flex;
          justify-content:flex-start;
          gap:10px;
        }
        .calendar-icon-bubble {
          -webkit-tap-highlight-color: transparent;
          align-items:center;
          background:${iconBubbleBg};
          border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius:999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color:${iconBubbleGlyph};
          display:inline-flex;
          flex:0 0 auto;
          height:${iconSize};
          justify-content:center;
          line-height:0;
          position:relative;
          width:${iconSize};
        }
        .calendar-icon-bubble ha-icon {
          --mdc-icon-size: calc(0.44 * ${iconSize});
          color:${iconBubbleGlyph};
          display:inline-flex;
          height:calc(0.44 * ${iconSize});
          left:50%;
          position:absolute;
          top:50%;
          transform:translate(-50%, -50%);
          width:calc(0.44 * ${iconSize});
        }
        .calendar-title {
          font-size:${styles.title_size};
          font-weight:700;
          letter-spacing:-0.02em;
          line-height:1.15;
          min-width:0;
        }
        .calendar-chip {
          align-items:center;
          background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius:999px;
          color:var(--secondary-text-color);
          display:inline-flex;
          flex:0 0 auto;
          font-size:${chipFontSize};
          font-weight:600;
          line-height:1;
          max-width:100%;
          min-height:${chipHeight};
          min-width:0;
          overflow:hidden;
          padding:${chipPadding};
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .calendar-header__spacer {
          flex:1 1 auto;
        }
        .calendar-empty,
        .calendar-loading,
        .calendar-error {
          color:var(--secondary-text-color);
          font-size:${styles.event_size};
          line-height:1.45;
          padding:8px 2px;
        }
        .calendar-error { color: var(--error-color); }
        .calendar-day {
          display:grid;
          gap:8px;
        }
        .calendar-events-scroll {
          display:grid;
          gap:10px;
          max-height: calc(${maxVisibleEvents} * 64px + 28px);
          overflow-y:auto;
          overscroll-behavior-y: contain;
          padding-right: 2px;
          touch-action: pan-y;
          -webkit-overflow-scrolling: touch;
        }
        .calendar-day__label {
          color:var(--secondary-text-color);
          font-size:11px;
          font-weight:700;
          letter-spacing:0.08em;
          text-transform:uppercase;
        }
        .calendar-event {
          align-items:center;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 14px;
          display:grid;
          gap:8px;
          grid-template-columns:auto 1fr auto;
          min-height:46px;
          padding:8px 10px;
        }
        .calendar-event--tinted {
          background: color-mix(in srgb, var(--cal-tint) 10%, color-mix(in srgb, var(--primary-text-color) 6%, transparent));
          border-color: color-mix(in srgb, var(--cal-tint) 32%, var(--divider-color));
        }
        .calendar-event--compact {
          gap:4px;
          grid-template-columns: 1fr;
          min-height: 0;
          padding:6px 8px;
        }
        .calendar-event--compact .calendar-event__time {
          font-size:10px;
          min-width: 0;
        }
        .calendar-event--compact .calendar-event__summary {
          white-space: normal;
          font-size:11px;
        }
        .calendar-event--compact .calendar-event__done {
          display:none;
        }
        .calendar-event.is-completed {
          opacity:0.62;
        }
        .calendar-event.is-completed.calendar-event--exit {
          opacity: 1;
        }
        .calendar-event--exit {
          animation: calendar-event-complete-out var(--calendar-exit-duration, 420ms) cubic-bezier(0.22, 0.82, 0.28, 1) forwards;
          pointer-events: none;
          transform-origin: center center;
          will-change: transform, opacity;
        }
        .calendar-event--exit .calendar-event__done {
          opacity: 0.25;
          transition: opacity 180ms ease;
        }
        @keyframes calendar-event-complete-out {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          18% {
            opacity: 1;
            transform: translateY(-2px) scale(1.008);
          }
          100% {
            opacity: 0;
            transform: translateY(-14px) scale(0.94);
          }
        }
        .calendar-event__time {
          color:var(--secondary-text-color);
          font-size:11px;
          font-weight:700;
          min-width:52px;
        }
        .calendar-event__summary {
          font-size:${styles.event_size};
          line-height:1.35;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .calendar-event__summary small {
          color:var(--secondary-text-color);
          display:block;
          font-size:11px;
          margin-top:2px;
        }
        .calendar-event__done {
          align-items:center;
          appearance:none;
          background:transparent;
          border:1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
          border-radius:999px;
          color:var(--secondary-text-color);
          cursor:pointer;
          display:inline-flex;
          font-size:11px;
          font-weight:700;
          min-height:28px;
          padding:0 9px;
        }
        @keyframes calendar-card-in {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.988);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .calendar-expanded {
          --calendar-expanded-accent: var(--primary-color);
          inset: 0;
          opacity: 0;
          pointer-events: none;
          position: fixed;
          transition: opacity 220ms cubic-bezier(0.16, 0.84, 0.22, 1);
          z-index: 120;
        }
        .calendar-expanded.is-open {
          opacity: 1;
          pointer-events: auto;
        }
        .calendar-expanded__backdrop {
          -webkit-backdrop-filter: blur(12px);
          backdrop-filter: blur(12px);
          background: rgba(0, 0, 0, 0.32);
          inset: 0;
          position: absolute;
        }
        .calendar-expanded__panel {
          animation: calendar-expanded-panel-in calc(${animationDuration}ms * 0.55) cubic-bezier(0.16, 0.84, 0.22, 1) both;
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--calendar-expanded-accent) 18%, rgba(255, 255, 255, 0.08)), rgba(255, 255, 255, 0.02)),
            color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 94%, rgba(255, 255, 255, 0.02));
          border: 1px solid color-mix(in srgb, var(--calendar-expanded-accent) 34%, color-mix(in srgb, var(--primary-text-color) 9%, transparent));
          border-radius: 16px;
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28);
          color: var(--primary-text-color);
          display: grid;
          gap: 10px;
          isolation: isolate;
          left: 50%;
          max-height: min(88vh, 920px);
          max-width: min(96vw, 1100px);
          overflow: hidden;
          padding: 11px 12px 13px;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: min(96vw, 1100px);
        }
        .calendar-expanded__toolbar {
          align-items: flex-start;
          display: flex;
          gap: 10px;
          justify-content: space-between;
          min-height: 28px;
          padding-right: 2px;
          position: relative;
        }
        .calendar-expanded__toolbar-title {
          flex: 1 1 auto;
          font-size: ${styles.title_size};
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.2;
          min-width: 0;
          padding-right: 28px;
        }
        .calendar-expanded__close {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: 24px;
          justify-content: center;
          line-height: 0;
          margin: 0;
          padding: 0;
          position: absolute;
          right: 0;
          top: 0;
          width: 24px;
        }
        .calendar-expanded__close ha-icon {
          --mdc-icon-size: 14px;
        }
        .calendar-expanded__body {
          max-height: min(76vh, 820px);
          overflow: auto;
          overscroll-behavior: contain;
          padding-right: 2px;
          touch-action: pan-y;
        }
        @keyframes calendar-expanded-panel-in {
          0% {
            clip-path: inset(0 42% 58% 42% round 16px);
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.97);
          }
          68% {
            clip-path: inset(0 4% 2% 4% round 16px);
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            clip-path: inset(0 0 0 0 round 16px);
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        .calendar-expanded__horizontal {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 8px;
          scroll-snap-type: x proximity;
        }
        .calendar-expanded__horizontal .calendar-expanded__col {
          flex: 0 0 min(240px, 78vw);
          max-width: min(260px, 85vw);
          scroll-snap-align: start;
        }
        .calendar-expanded__column {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .calendar-expanded__column .calendar-expanded__col {
          width: 100%;
        }
        .calendar-expanded__col-label {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .calendar-expanded__col-events {
          display: grid;
          gap: 10px;
        }
        .calendar-expanded__month-banner {
          font-size: ${styles.title_size};
          font-weight: 700;
          margin-bottom: 8px;
          text-transform: capitalize;
        }
        .calendar-expanded__month {
          --cal-month-cell-min: 88px;
          --cal-month-gap: 6px;
        }
        .calendar-expanded__month-matrix-wrap {
          margin-left: -2px;
          margin-right: -2px;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          padding-bottom: 6px;
          touch-action: pan-x pan-y;
          -webkit-overflow-scrolling: touch;
        }
        .calendar-expanded__month-matrix {
          display: flex;
          flex-direction: column;
          gap: var(--cal-month-gap);
          min-width: max(100%, calc(7 * var(--cal-month-cell-min) + 6 * var(--cal-month-gap)));
          width: 100%;
        }
        .calendar-expanded__month-weekdays {
          color: var(--secondary-text-color);
          display: grid;
          font-size: 10px;
          font-weight: 700;
          gap: var(--cal-month-gap);
          grid-template-columns: repeat(7, minmax(var(--cal-month-cell-min), 1fr));
          letter-spacing: 0.06em;
          margin-bottom: 0;
          text-align: center;
          text-transform: uppercase;
        }
        .calendar-expanded__month-grid {
          display: grid;
          gap: var(--cal-month-gap);
          grid-template-columns: repeat(7, minmax(var(--cal-month-cell-min), 1fr));
        }
        .calendar-expanded__month-cell {
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 14px;
          display: flex;
          flex: 1 1 auto;
          flex-direction: column;
          gap: 4px;
          max-height: 122px;
          min-height: 96px;
          min-width: 0;
          overflow: hidden;
          padding: 6px;
        }
        .calendar-expanded__month-cell--pad {
          background: transparent;
          border-color: transparent;
          max-height: none;
          min-height: 0;
          padding: 0;
        }
        .calendar-expanded__month-daynum {
          color: var(--secondary-text-color);
          flex: 0 0 auto;
          font-size: 11px;
          font-weight: 800;
          line-height: 1.2;
        }
        .calendar-expanded__month-events {
          display: flex;
          flex: 1 1 auto;
          flex-direction: column;
          gap: 6px;
          max-height: 4.75rem;
          min-height: 0;
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          touch-action: pan-y;
          -webkit-overflow-scrolling: touch;
        }
        .calendar-expanded__month-events .calendar-event--compact .calendar-event__summary {
          line-height: 1.25;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .calendar-expanded__month-events .calendar-event--compact .calendar-event__summary small {
          display: block;
          line-height: 1.2;
          margin-top: 2px;
          opacity: 0.85;
        }
        @media (max-width: 520px) {
          .calendar-expanded__month {
            --cal-month-cell-min: 92px;
          }
        }
      </style>
      <ha-card>
        <div class="calendar-card">
          <div class="calendar-header">
            <span class="calendar-icon-bubble"><ha-icon icon="${escapeHtml(config.icon || DEFAULT_CONFIG.icon)}"></ha-icon></span>
            <div class="calendar-title">${escapeHtml(config.title)}</div>
            <span class="calendar-header__spacer"></span>
            <div class="calendar-chip">${escapeHtml(timeRangeChipLabel(config.time_range || DEFAULT_CONFIG.time_range))}</div>
          </div>
          ${
            this._loading
              ? `<div class="calendar-loading">Cargando eventos...</div>`
              : this._error
                ? `<div class="calendar-error">${escapeHtml(this._error)}</div>`
                : !hasEvents
                  ? `<div class="calendar-empty">No hay eventos en este rango.</div>`
                  : `<div class="calendar-events-scroll">
                      ${groups.map(group => `
                        <div class="calendar-day">
                          <div class="calendar-day__label">${escapeHtml(group.label)}</div>
                          ${group.events.map(event => this._renderSingleEventHtml(event, config, locale)).join("")}
                        </div>
                      `).join("")}
                    </div>`
          }
        </div>
      </ha-card>
      <div class="calendar-expanded ${this._expandedOpen ? "is-open" : ""}" style="--calendar-expanded-accent:${accentColor};" aria-hidden="${this._expandedOpen ? "false" : "true"}">
        <div class="calendar-expanded__backdrop" data-action="expanded-backdrop"></div>
        <div class="calendar-expanded__panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(config.title)}">
          <div class="calendar-expanded__toolbar">
            <div class="calendar-expanded__toolbar-title">${escapeHtml(config.title)}</div>
            <button type="button" class="calendar-expanded__close" data-action="close-expanded" aria-label="Cerrar">
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          <div class="calendar-expanded__body">
            ${
              this._loading
                ? `<div class="calendar-loading">Cargando eventos...</div>`
                : this._error
                  ? `<div class="calendar-error">${escapeHtml(this._error)}</div>`
                  : !hasEvents
                    ? `<div class="calendar-empty">No hay eventos en este rango.</div>`
                    : this._renderExpandedBody(groups, config, locale)
            }
          </div>
        </div>
      </div>
    `;
  }

  _onShadowKeydown(event) {
    if (event.key !== "Escape" || !this._expandedOpen) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._expandedOpen = false;
    this._renderIfChanged(true);
  }

  _onShadowClick(event) {
    const path = event.composedPath();
    const toggleBtn = path.find(
      node => node instanceof HTMLElement && node.dataset?.action === "toggle-complete",
    );
    if (toggleBtn instanceof HTMLElement) {
      event.preventDefault();
      event.stopPropagation();
      this._toggleCompleted(toggleBtn.dataset.key || "");
      return;
    }
    const closeAction = path.find(
      node =>
        node instanceof HTMLElement &&
        (node.dataset?.action === "close-expanded" || node.dataset?.action === "expanded-backdrop"),
    );
    if (closeAction) {
      event.preventDefault();
      event.stopPropagation();
      this._expandedOpen = false;
      this._renderIfChanged(true);
      return;
    }
    if (this._expandedOpen) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest?.("button")) {
      return;
    }
    if (!target?.closest?.(".calendar-card")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._expandedOpen = true;
    this._renderIfChanged(true);
  }
}

class NodaliaCalendarCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(DEFAULT_CONFIG);
    this._hass = null;
    this._showAnimationSection = false;
    this._showStyleSection = false;
    this._entityOptionsSignature = "";
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

    if (shouldRender) {
      const focusState = this._captureFocusState();
      this._render();
      this._restoreFocusState(focusState);
      return;
    }

    this.shadowRoot?.querySelectorAll("ha-entity-picker, ha-selector, ha-icon-picker").forEach(el => {
      if ("hass" in el) {
        el.hass = hass;
      }
    });
  }

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    this._render();
    this._restoreFocusState(focusState);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    if (window.NodaliaUtils?.editorStatesSignature) {
      return window.NodaliaUtils.editorStatesSignature(hass, this._config?.language);
    }
    return String(Object.keys(hass?.states || {}).length);
  }

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    return window.NodaliaI18n.editorStr(this._hass, this._config?.language ?? "auto", s);
  }

  _emitConfig() {
    const raw = deepClone(this._config || DEFAULT_CONFIG);
    const stripped =
      typeof window !== "undefined" && window.NodaliaUtils?.stripEqualToDefaults
        ? window.NodaliaUtils.stripEqualToDefaults(raw, DEFAULT_CONFIG)
        : raw;
    const payload = compactCalendarConfig(
      stripped !== undefined && stripped !== null ? stripped : {},
    );
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        bubbles: true,
        composed: true,
        detail: { config: payload },
      }),
    );
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
    const selector = dataset.field ? `[data-field="${escapeSelectorValue(dataset.field)}"]` : null;
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
      /* ignore */
    }
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

  _setFieldValue(targetConfig, field, value) {
    if (!field) {
      return;
    }
    if (field.startsWith("calendars.")) {
      const parts = field.split(".");
      const index = Number(parts[1]);
      if (!Number.isFinite(index) || index < 0) {
        return;
      }
      if (!Array.isArray(targetConfig.calendars)) {
        targetConfig.calendars = [];
      }
      while (targetConfig.calendars.length <= index) {
        targetConfig.calendars.push({ entity: "", label: "", tint: "" });
      }
      if (parts.length >= 3) {
        const key = parts[2];
        let entry = targetConfig.calendars[index];
        if (typeof entry === "string") {
          entry = { entity: String(entry).trim(), label: "", tint: "" };
        } else if (!entry || typeof entry !== "object") {
          entry = { entity: "", label: "", tint: "" };
        }
        if (key === "entity") {
          entry.entity = String(value ?? "").trim();
        } else if (key === "label") {
          entry.label = String(value ?? "").trim();
        } else if (key === "tint") {
          entry.tint = sanitizeCalendarTint(value);
        }
        targetConfig.calendars[index] = entry;
        return;
      }
      targetConfig.calendars[index] = {
        entity: String(value ?? "").trim(),
        label: "",
        tint: "",
      };
      return;
    }
    if (field.startsWith("styles.")) {
      const parts = field.split(".");
      let cursor = targetConfig;
      for (let index = 0; index < parts.length - 1; index += 1) {
        const key = parts[index];
        if (!isObject(cursor[key])) {
          cursor[key] = {};
        }
        cursor = cursor[key];
      }
      cursor[parts[parts.length - 1]] = value;
      return;
    }
    if (field.startsWith("animations.")) {
      const key = field.split(".")[1];
      if (!isObject(targetConfig.animations)) {
        targetConfig.animations = {};
      }
      targetConfig.animations[key] = value;
      return;
    }
    targetConfig[field] = value;
  }

  _readFieldValue(input) {
    const valueType = input.dataset.valueType || "string";
    if (valueType === "boolean") {
      return Boolean(input.checked);
    }
    if (valueType === "number") {
      return Number(input.value || 0);
    }
    if (valueType === "color") {
      return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
    }
    return input.value;
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(
        node =>
          node instanceof HTMLInputElement ||
          node instanceof HTMLSelectElement ||
          node instanceof HTMLTextAreaElement,
      );
    if (!input?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    if (event.type === "input" && input.type !== "checkbox") {
      return;
    }
    if (input.type === "checkbox" && event.type === "input") {
      return;
    }
    const next = deepClone(this._config || DEFAULT_CONFIG);
    const field = input.dataset.field || "";
    const value = this._readFieldValue(input);
    this._setFieldValue(next, field, value);
    this._config = normalizeConfig(next);
    if (event.type === "change") {
      this._emitConfig();
      const focusState = this._captureFocusState();
      this._render();
      this._restoreFocusState(focusState);
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
    const field = control.dataset.field;
    const next = deepClone(this._config || DEFAULT_CONFIG);
    const raw = event.detail?.value;
    const value = typeof raw === "string" ? raw : control.value;
    this._setFieldValue(next, field, value);
    this._config = normalizeConfig(next);
    this._emitConfig();
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _moveCalendar(index, delta) {
    const next = deepClone(this._config || DEFAULT_CONFIG);
    const list = Array.isArray(next.calendars) ? [...next.calendars] : [];
    const j = index + delta;
    if (!Number.isFinite(index) || index < 0 || !Number.isFinite(j) || j < 0 || j >= list.length) {
      return;
    }
    [list[index], list[j]] = [list[j], list[index]];
    next.calendars = list;
    this._config = normalizeConfig(next);
    this._emitConfig();
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _onShadowClick(event) {
    const rootTarget = event.target instanceof Element ? event.target : null;
    const toggleButton = rootTarget?.closest?.("[data-editor-toggle]");
    if (toggleButton) {
      event.preventDefault();
      event.stopPropagation();
      if (toggleButton.dataset.editorToggle === "styles") {
        this._showStyleSection = !this._showStyleSection;
      } else if (toggleButton.dataset.editorToggle === "animations") {
        this._showAnimationSection = !this._showAnimationSection;
      }
      const focusState = this._captureFocusState();
      this._render();
      this._restoreFocusState(focusState);
      return;
    }

    const button = rootTarget?.closest?.("[data-editor-action]");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.editorAction;
    if (action === "move-calendar-up") {
      this._moveCalendar(Number(button.dataset.index || -1), -1);
      return;
    }
    if (action === "move-calendar-down") {
      this._moveCalendar(Number(button.dataset.index || -1), 1);
      return;
    }
    const next = deepClone(this._config || DEFAULT_CONFIG);
    if (!Array.isArray(next.calendars)) {
      next.calendars = [];
    }
    if (action === "add-calendar") {
      next.calendars.push({ entity: "", label: "", tint: "" });
    } else if (action === "remove-calendar") {
      const index = Number(button.dataset.index || -1);
      if (Number.isFinite(index) && index >= 0 && index < next.calendars.length) {
        next.calendars.splice(index, 1);
      }
    } else {
      return;
    }
    this._config = normalizeConfig(next);
    this._emitConfig();
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _mountCalendarEntityHost(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }
    const field = host.dataset.field || "calendars.0";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    const allowedDomains = String(host.dataset.domains || "")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      if (allowedDomains.length) {
        control.includeDomains = allowedDomains;
        control.entityFilter = stateObj =>
          allowedDomains.some(domain => String(stateObj?.entity_id || "").startsWith(`${domain}.`));
      }
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
      control.allowCustomEntity = true;
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: allowedDomains.length === 1 ? { domain: allowedDomains[0] } : {},
      };
    } else {
      control = document.createElement("input");
      control.type = "text";
      control.placeholder = placeholder || "calendar.ejemplo";
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

  _renderCheckboxField(label, field, checked) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-field="${escapeHtml(field)}"
          data-value-type="boolean"
          ${checked ? "checked" : ""}
        />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(tLabel)}</span>
      </label>
    `;
  }

  _renderTintAutoToggle(checked) {
    const tTitle = this._editorLabel("Tintado automatico");
    const tHint = this._editorLabel(
      "Usa el color primario del tema en la tarjeta. Desactiva para definir un color de acento en Estilos.",
    );
    const aria = escapeHtml(`${tTitle}. ${tHint}`);
    return `
      <div class="editor-tint-block">
        <div class="editor-tint-block__text">
          <div class="editor-tint-block__title">${escapeHtml(tTitle)}</div>
          <div class="editor-tint-block__hint">${escapeHtml(tHint)}</div>
        </div>
        <label class="editor-toggle">
          <input
            type="checkbox"
            data-field="tint_auto"
            data-value-type="boolean"
            aria-label="${aria}"
            ${checked ? "checked" : ""}
          />
          <span class="editor-toggle__switch" aria-hidden="true"></span>
          <span class="editor-toggle__label"></span>
        </label>
      </div>
    `;
  }

  _renderSelectField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const opts = options.options || [];
    const current = String(value ?? "");
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${opts
            .map(
              o =>
                `<option value="${escapeHtml(String(o.value))}" ${String(o.value) === current ? "selected" : ""}>${escapeHtml(
                  String(o.label),
                )}</option>`,
            )
            .join("")}
        </select>
      </label>
    `;
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || (inputType === "number" ? "number" : "string");
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
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

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <ha-icon-picker
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        ></ha-icon-picker>
      </div>
    `;
  }

  _renderColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("Color personalizado");
    const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
    const currentValue = value === undefined || value === null || value === ""
      ? fallbackValue
      : String(value);
    const colorModel = getEditorColorModel(currentValue, fallbackValue);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="${escapeHtml(tColorCustom)}">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="color"
              data-alpha="${escapeHtml(String(colorModel.alpha))}"
              value="${escapeHtml(colorModel.hex)}"
              aria-label="${escapeHtml(tLabel)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>
    `;
  }

  _renderCalendarCard(entry, index, total) {
    const ent =
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? entry
        : { entity: String(entry ?? "").trim(), label: "", tint: "" };
    const entityId = String(ent.entity ?? "").trim();
    const label = String(ent.label ?? "").trim();
    const tint = String(ent.tint ?? "").trim();
    return `
      <div class="series-editor-card">
        <div class="series-editor-card__header">
          <div class="series-editor-card__title">${escapeHtml(this._editorLabel("Calendario"))} ${index + 1}</div>
          <div class="series-editor-card__actions">
            <button type="button" data-editor-action="move-calendar-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>${escapeHtml(this._editorLabel("Subir"))}</button>
            <button type="button" data-editor-action="move-calendar-down" data-index="${index}" ${index === total - 1 ? "disabled" : ""}>${escapeHtml(this._editorLabel("Bajar"))}</button>
            <button type="button" data-editor-action="remove-calendar" data-index="${index}" class="danger">${escapeHtml(this._editorLabel("Eliminar"))}</button>
          </div>
        </div>
        <div class="series-editor-subgroup">
          <div class="series-editor-subgroup__title">${escapeHtml(this._editorLabel("Entidad"))}</div>
          <div class="editor-grid editor-grid--stacked">
            <div class="editor-field editor-field--full">
              <span>${escapeHtml(this._editorLabel("Calendario de Home Assistant"))}</span>
              <div
                class="editor-control-host"
                data-mounted-control="calendar-entity"
                data-field="calendars.${index}.entity"
                data-value="${escapeHtml(entityId)}"
                data-domains="calendar"
                data-placeholder="calendar.cumpleanos"
              ></div>
            </div>
            ${this._renderTextField("Etiqueta visible", `calendars.${index}.label`, label, {
              fullWidth: true,
              placeholder: this._editorLabel("Ej. Familia"),
            })}
            ${this._renderColorField("Tintado en la tarjeta", `calendars.${index}.tint`, tint, {
              fullWidth: true,
              fallbackValue: "#71c0ff",
            })}
          </div>
        </div>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    this._ensureEditorControlsReady();
    const config = normalizeConfig(this._config || DEFAULT_CONFIG);
    const calendars =
      Array.isArray(config.calendars) && config.calendars.length
        ? config.calendars
        : [{ entity: "", label: "", tint: "" }];
    const animations = config.animations || DEFAULT_CONFIG.animations;

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
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
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

        .editor-tint-block {
          align-items: center;
          background: color-mix(in srgb, var(--primary-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
          border-radius: 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px 18px;
          grid-column: 1 / -1;
          justify-content: space-between;
          padding: 14px 16px;
        }

        .editor-tint-block__text {
          display: grid;
          flex: 1 1 220px;
          gap: 5px;
          min-width: 0;
        }

        .editor-tint-block__title {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .editor-tint-block__hint {
          color: var(--secondary-text-color);
          font-size: 11px;
          line-height: 1.45;
          max-width: 44em;
        }

        .editor-tint-block .editor-toggle {
          align-self: center;
          flex: 0 0 auto;
          margin: 0;
          min-height: 0;
          padding-top: 0;
        }

        .editor-tint-block .editor-toggle__label:empty {
          display: none;
        }

        .editor-field:has(> .editor-control-host[data-mounted-control="entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="calendar-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="input-text-entity"]),
        .editor-field:has(> ha-icon-picker) {
          grid-column: 1 / -1;
        }

        .editor-field > span,
        .editor-toggle > span {
          font-size: 12px;
          font-weight: 600;
        }

        .editor-field__hint {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 500;
          line-height: 1.45;
        }

        .editor-field input,
        .editor-field select,
        .editor-field textarea,
        .editor-control-host input,
        .editor-control-host select,
        .editor-control-host textarea {
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

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
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
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
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
          border-color: color-mix(in srgb, var(--primary-text-color) 22%, transparent);
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }

        .editor-color-swatch {
          --editor-swatch: #71c0ff;
          background:
            linear-gradient(var(--editor-swatch), var(--editor-swatch)),
            conic-gradient(from 90deg, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 25%, rgba(0, 0, 0, 0.12) 0 50%, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 0 75%, rgba(0, 0, 0, 0.12) 0);
          background-position: center;
          background-size: cover, 10px 10px;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
          border-radius: 999px;
          display: block;
          height: 22px;
          width: 22px;
        }

        .editor-color-picker .editor-color-swatch {
          height: 22px;
          width: 22px;
        }

        .editor-actions {
          display: flex;
          justify-content: flex-start;
        }

        button {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
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

        .series-editor-list {
          display: grid;
          gap: 12px;
        }

        .series-editor-card {
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 16px;
          display: grid;
          gap: 12px;
          padding: 14px;
        }

        .series-editor-subgroup {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }

        .series-editor-subgroup__title {
          font-size: 12px;
          font-weight: 700;
        }

        .series-editor-card__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .series-editor-card__title {
          font-size: 13px;
          font-weight: 700;
        }

        .series-editor-card__actions {
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

          .series-editor-card__header {
            align-items: start;
            flex-direction: column;
          }

          .series-editor-card__actions {
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
            0 0 0 3px color-mix(in srgb, var(--primary-text-color) 14%, transparent),
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("General"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Titulo visible, icono, rango temporal, refresco de datos y opciones de eventos completados."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Titulo", "title", config.title, { fullWidth: true, placeholder: "Calendario" })}
            ${this._renderIconPickerField("Icono", "icon", config.icon || DEFAULT_CONFIG.icon, {
              fullWidth: true,
              placeholder: "mdi:calendar-month",
            })}
            ${this._renderSelectField("Rango visible", "time_range", config.time_range || DEFAULT_CONFIG.time_range, {
              fullWidth: true,
              options: [
                { value: "3d", label: this._editorLabel("3 dias") },
                { value: "1w", label: this._editorLabel("1 semana") },
                { value: "2w", label: this._editorLabel("2 semanas") },
                { value: "1m", label: this._editorLabel("1 mes") },
              ],
            })}
            ${this._renderTextField("Eventos visibles antes de scroll", "max_visible_events", config.max_visible_events, { type: "number" })}
            ${this._renderTextField("Refresco (segundos)", "refresh_interval", config.refresh_interval, { type: "number" })}
            ${this._renderTintAutoToggle(config.tint_auto !== false)}
            ${this._renderCheckboxField("Permitir marcar eventos como completados", "allow_complete", config.allow_complete === true)}
            ${this._renderCheckboxField("Mostrar eventos completados", "show_completed", config.show_completed === true)}
            <div class="editor-field editor-field--full">
              <span>${escapeHtml(this._editorLabel("Helper input_text (completados compartidos)"))}</span>
              <div
                class="editor-control-host"
                data-mounted-control="input-text-entity"
                data-field="shared_completed_events_entity"
                data-value="${escapeHtml(String(config.shared_completed_events_entity ?? ""))}"
                data-domains="input_text"
                data-placeholder="input_text.nodalia_calendar_hechos"
              ></div>
              <span class="editor-field__hint">${escapeHtml(
                this._editorLabel(
                  "Opcional: misma lista en movil y PC. Crea un input_text y elije aqui; la tarjeta guarda un JSON con las claves de eventos hechos.",
                ),
              )}</span>
            </div>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Calendarios"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Anade una o varias entidades calendar y reordena el orden en que se combinan los eventos."))}</div>
          </div>
          <div class="series-editor-list">
            ${
              calendars.length
                ? calendars.map((entityId, index) => this._renderCalendarCard(entityId, index, calendars.length)).join("")
                : `<div class="empty-note">${escapeHtml(this._editorLabel("Todavia no hay calendarios configurados."))}</div>`
            }
          </div>
          <div class="editor-actions">
            <button type="button" class="editor-section__toggle-button" data-editor-action="add-calendar">
              <ha-icon icon="mdi:plus"></ha-icon>
              <span>${escapeHtml(this._editorLabel("Anadir calendario"))}</span>
            </button>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Animaciones"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Entrada suave del contenido de la tarjeta al cargar."))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("Ocultar ajustes de animacion") : this._editorLabel("Mostrar ajustes de animacion"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("Activar animaciones", "animations.enabled", animations.enabled !== false)}
                  ${this._renderTextField("Entrada contenido (ms)", "animations.content_duration", animations.content_duration, {
                    type: "number",
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Estilos"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Ajustes visuales de la tarjeta, tipografia y burbuja de icono."))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showStyleSection ? this._editorLabel("Ocultar ajustes de estilo") : this._editorLabel("Mostrar ajustes de estilo"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("Fondo tarjeta", "styles.card.background", config.styles?.card?.background, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.card.background,
                  })}
                  ${this._renderTextField("Borde tarjeta", "styles.card.border", config.styles?.card?.border)}
                  ${this._renderTextField("Radio tarjeta", "styles.card.border_radius", config.styles?.card?.border_radius)}
                  ${this._renderTextField("Sombra tarjeta", "styles.card.box_shadow", config.styles?.card?.box_shadow, { fullWidth: true })}
                  ${this._renderTextField("Padding", "styles.card.padding", config.styles?.card?.padding)}
                  ${this._renderTextField("Separacion", "styles.card.gap", config.styles?.card?.gap)}
                  ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles?.title_size)}
                  ${this._renderTextField("Tamano evento", "styles.event_size", config.styles?.event_size)}
                  ${this._renderTextField("Alto chips", "styles.chip_height", config.styles?.chip_height)}
                  ${this._renderTextField("Texto chips", "styles.chip_font_size", config.styles?.chip_font_size)}
                  ${this._renderTextField("Relleno chips", "styles.chip_padding", config.styles?.chip_padding)}
                  ${this._renderColorField("Icono burbuja fondo", "styles.icon.background", config.styles?.icon?.background, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.icon.background,
                  })}
                  ${this._renderColorField("Color icono activo", "styles.icon.on_color", config.styles?.icon?.on_color, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.icon.on_color,
                  })}
                  ${this._renderColorField("Color icono inactivo", "styles.icon.off_color", config.styles?.icon?.off_color, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.icon.off_color,
                  })}
                  ${this._renderTextField("Icono burbuja tamano", "styles.icon.size", config.styles?.icon?.size)}
                  ${this._renderColorField("Color de acento (si el tintado automático está desactivado)", "styles.tint.color", config.styles?.tint?.color, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.tint.color,
                  })}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="calendar-entity"], [data-mounted-control="input-text-entity"]')
      .forEach(host => {
        this._mountCalendarEntityHost(host);
      });
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCalendarCard);
}
if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCalendarCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Calendar Card",
  description: "Tarjeta de calendario elegante estilo Nodalia con eventos y marcado de completados.",
  preview: true,
});
