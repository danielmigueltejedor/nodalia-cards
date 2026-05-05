const CARD_TAG = "nodalia-calendar-card";
const EDITOR_TAG = "nodalia-calendar-card-editor";
const CARD_VERSION = "1.0.0-alpha.5";
const COMPLETION_STORAGE_KEY = "nodalia_calendar_completed_v1";

const DEFAULT_CONFIG = {
  title: "Calendario",
  icon: "mdi:calendar-month",
  calendars: [],
  days_to_show: 7,
  max_visible_events: 3,
  refresh_interval: 300,
  show_completed: false,
  allow_complete: true,
  tint_auto: true,
  animations: {
    enabled: true,
    content_duration: 260,
  },
  styles: {
    card: {
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.028) 0%, rgba(0,0,0,0.03) 100%), var(--ha-card-background, var(--card-background-color))",
      border: "1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent)",
      border_radius: "22px",
      box_shadow:
        "0 18px 34px rgba(0,0,0,0.16), inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent)",
      padding: "16px",
      gap: "12px",
    },
    icon: {
      background: "color-mix(in srgb, var(--primary-color) 16%, transparent)",
      color: "var(--primary-text-color)",
      size: "19px",
    },
    tint: {
      color: "var(--primary-color)",
    },
    title_size: "17px",
    event_size: "13px",
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

function normalizeConfig(config) {
  const normalized = mergeConfig(DEFAULT_CONFIG, config || {});
  normalized.calendars = Array.isArray(normalized.calendars)
    ? normalized.calendars.map(item => String(item || "").trim()).filter(Boolean)
    : [];
  normalized.days_to_show = Math.min(30, Math.max(1, Number(normalized.days_to_show) || DEFAULT_CONFIG.days_to_show));
  normalized.max_visible_events = Math.min(
    12,
    Math.max(1, Number(normalized.max_visible_events) || DEFAULT_CONFIG.max_visible_events),
  );
  normalized.refresh_interval = Math.min(3600, Math.max(30, Number(normalized.refresh_interval) || DEFAULT_CONFIG.refresh_interval));
  return normalized;
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

function eventDate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  if (typeof value === "object") {
    const raw = value.dateTime || value.date || "";
    const parsed = new Date(raw);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
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
    this._onShadowClick = this._onShadowClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this._loadCompleted();
    if (!this._hadHass) {
      this._refreshEvents();
    }
  }

  disconnectedCallback() {
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    if (this._refreshTimer) {
      window.clearTimeout(this._refreshTimer);
      this._refreshTimer = 0;
    }
  }

  setConfig(config) {
    this._config = normalizeConfig(config);
    this._loadCompleted();
    this._refreshEvents();
  }

  set hass(hass) {
    const hadHass = this._hadHass;
    const prevLocale = this._hass?.locale?.language;
    this._hass = hass;
    if (!hass) {
      return;
    }
    if (!hadHass) {
      this._hadHass = true;
      if (this._config.calendars.length) {
        this._refreshEvents();
      } else {
        this._renderIfChanged();
      }
      return;
    }
    if (prevLocale !== hass.locale?.language) {
      this._renderIfChanged(true);
    }
  }

  _getLocale() {
    return this._hass?.locale?.language || "es-ES";
  }

  _loadCompleted() {
    if (typeof window === "undefined" || !window.localStorage) {
      this._completed = new Set();
      return;
    }
    try {
      const raw = window.localStorage.getItem(COMPLETION_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      this._completed = new Set(Array.isArray(parsed) ? parsed : []);
    } catch (_error) {
      this._completed = new Set();
    }
  }

  _saveCompleted() {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify([...this._completed]));
    } catch (_error) {
      // Ignore storage errors.
    }
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
    const visibleEvents = this._events.filter(event => {
      const done = this._completed.has(completionKey(event));
      return config.show_completed || !done;
    });
    const eventKeys = visibleEvents
      .map(event => {
        const start = eventDate(event?.start)?.getTime() || 0;
        return `${completionKey(event)}@${start}`;
      })
      .join("|");
    const completedSig = [...this._completed].sort().join("|");
    return [
      config.calendars.join("\u001f"),
      config.title,
      config.icon,
      config.days_to_show,
      config.max_visible_events,
      config.show_completed,
      config.allow_complete,
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
      styles.chip_size,
      styles.icon?.background,
      styles.icon?.color,
      styles.icon?.size,
      styles.tint?.color,
      this._getLocale(),
      this._loading ? "1" : "0",
      this._error,
      eventKeys,
      completedSig,
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
    if (!this._hass || !this._config.calendars.length) {
      this._events = [];
      this._loading = false;
      this._error = "";
      this._renderIfChanged(true);
      return;
    }
    this._loading = true;
    this._error = "";
    this._renderIfChanged(true);
    try {
      const start = new Date();
      const end = new Date(start.getTime() + this._config.days_to_show * 24 * 60 * 60 * 1000);
      const all = [];
      for (const entityId of this._config.calendars) {
        const path = `calendars/${encodeURIComponent(entityId)}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
        const rows = await this._hass.callApi("GET", path);
        if (Array.isArray(rows)) {
          rows.forEach(item => all.push({ ...item, _entity: entityId }));
        }
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
    if (this._completed.has(key)) {
      this._completed.delete(key);
    } else {
      this._completed.add(key);
    }
    this._saveCompleted();
    this._renderIfChanged(true);
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
    const tintColor =
      config.tint_auto !== false
        ? "var(--primary-color)"
        : String(config.styles?.tint?.color || DEFAULT_CONFIG.styles.tint.color);
    const animationDuration = Math.min(
      1600,
      Math.max(120, Number(config.animations?.content_duration) || DEFAULT_CONFIG.animations.content_duration),
    );
    const maxVisibleEvents = Math.max(1, Number(config.max_visible_events) || DEFAULT_CONFIG.max_visible_events);
    const visibleEvents = this._events.filter(event => {
      const done = this._completed.has(completionKey(event));
      return config.show_completed || !done;
    });
    const groups = this._groupEvents(visibleEvents);
    const hasEvents = visibleEvents.length > 0;
    const playEntrance =
      config.animations?.enabled !== false && !this._calendarEntrancePlayed;
    if (playEntrance) {
      this._calendarEntrancePlayed = true;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        * { box-sizing:border-box; }
        ha-card {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${tintColor} 14%, transparent) 0%, transparent 40%),
            ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          overflow: hidden;
          overscroll-behavior-y: contain;
        }
        .calendar-card {
          display:grid;
          gap:${styles.card.gap};
          padding:${styles.card.padding};
          ${playEntrance ? `animation: calendar-card-in ${animationDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;` : ""}
        }
        .calendar-header {
          align-items:center;
          display:flex;
          justify-content:flex-start;
          gap:10px;
        }
        .calendar-icon-bubble {
          align-items:center;
          background:${styles.icon?.background || DEFAULT_CONFIG.styles.icon.background};
          border:1px solid color-mix(in srgb, ${tintColor} 24%, transparent);
          border-radius:999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          color:${styles.icon?.color || DEFAULT_CONFIG.styles.icon.color};
          display:inline-flex;
          flex:0 0 auto;
          height:38px;
          justify-content:center;
          width:38px;
        }
        .calendar-icon-bubble ha-icon {
          font-size:${styles.icon?.size || DEFAULT_CONFIG.styles.icon.size};
        }
        .calendar-title {
          font-size:${styles.title_size};
          font-weight:700;
          letter-spacing:0.01em;
          min-width:0;
        }
        .calendar-chip {
          border:1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
          border-radius:999px;
          color:var(--secondary-text-color);
          font-size:${styles.chip_size};
          padding:4px 9px;
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
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          border-radius: 14px;
          display:grid;
          gap:8px;
          grid-template-columns:auto 1fr auto;
          min-height:46px;
          padding:8px 10px;
        }
        .calendar-event.is-completed {
          opacity:0.62;
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
      </style>
      <ha-card>
        <div class="calendar-card">
          <div class="calendar-header">
            <span class="calendar-icon-bubble"><ha-icon icon="${escapeHtml(config.icon || DEFAULT_CONFIG.icon)}"></ha-icon></span>
            <div class="calendar-title">${escapeHtml(config.title)}</div>
            <span class="calendar-header__spacer"></span>
            <div class="calendar-chip">${escapeHtml(`${config.days_to_show} dias`)}</div>
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
                          ${group.events.map(event => {
                            const doneKey = completionKey(event);
                            const done = this._completed.has(doneKey);
                            const start = eventDate(event.start);
                            const timeLabel = eventIsAllDay(event)
                              ? "Todo el dia"
                              : start
                                ? formatTimeLabel(start, locale)
                                : "--:--";
                            const summary = String(event.summary || event.message || "Evento sin titulo");
                            const source = String(event._entity || "");
                            return `
                              <div class="calendar-event ${done ? "is-completed" : ""}">
                                <div class="calendar-event__time">${escapeHtml(timeLabel)}</div>
                                <div class="calendar-event__summary">
                                  ${escapeHtml(summary)}
                                  <small>${escapeHtml(source)}</small>
                                </div>
                                ${
                                  config.allow_complete
                                    ? `<button type="button" class="calendar-event__done" data-action="toggle-complete" data-key="${escapeHtml(doneKey)}">${done ? "Hecho" : "Marcar"}</button>`
                                    : ""
                                }
                              </div>
                            `;
                          }).join("")}
                        </div>
                      `).join("")}
                    </div>`
          }
        </div>
      </ha-card>
    `;
  }

  _onShadowClick(event) {
    const button = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.action === "toggle-complete");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._toggleCompleted(button.dataset.key || "");
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

  _emitConfig(next) {
    this.dispatchEvent(new CustomEvent("config-changed", {
      bubbles: true,
      composed: true,
      detail: { config: next },
    }));
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
      const index = Number(field.split(".")[1]);
      if (!Number.isFinite(index) || index < 0) {
        return;
      }
      if (!Array.isArray(targetConfig.calendars)) {
        targetConfig.calendars = [];
      }
      targetConfig.calendars[index] = String(value || "").trim();
      targetConfig.calendars = targetConfig.calendars.filter(Boolean);
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
      this._emitConfig(this._config);
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
    this._emitConfig(this._config);
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
    this._emitConfig(this._config);
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
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
      } else if (toggleButton.dataset.editorToggle === "animations") {
        this._showAnimationSection = !this._showAnimationSection;
      }
      const focusState = this._captureFocusState();
      this._render();
      this._restoreFocusState(focusState);
      return;
    }

    const button = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorAction);
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
      next.calendars.push("");
    } else if (action === "remove-calendar") {
      const index = Number(button.dataset.index || -1);
      if (Number.isFinite(index) && index >= 0 && index < next.calendars.length) {
        next.calendars.splice(index, 1);
      }
    } else {
      return;
    }
    this._config = normalizeConfig(next);
    this._emitConfig(this._config);
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

  _renderCalendarCard(entityId, index, total) {
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
                data-field="calendars.${index}"
                data-value="${escapeHtml(entityId)}"
                data-domains="calendar"
                data-placeholder="calendar.cumpleanos"
              ></div>
            </div>
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
    const calendars = Array.isArray(config.calendars) && config.calendars.length ? config.calendars : [""];
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

        .editor-field:has(> .editor-control-host[data-mounted-control="entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="calendar-entity"]),
        .editor-field:has(> ha-icon-picker) {
          grid-column: 1 / -1;
        }

        .editor-field > span,
        .editor-toggle > span {
          font-size: 12px;
          font-weight: 600;
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
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Titulo visible, icono, rango de dias, refresco de datos y opciones de eventos completados."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Titulo", "title", config.title, { fullWidth: true, placeholder: "Calendario" })}
            ${this._renderIconPickerField("Icono", "icon", config.icon || DEFAULT_CONFIG.icon, {
              fullWidth: true,
              placeholder: "mdi:calendar-month",
            })}
            ${this._renderTextField("Dias a mostrar", "days_to_show", config.days_to_show, { type: "number" })}
            ${this._renderTextField("Eventos visibles antes de scroll", "max_visible_events", config.max_visible_events, { type: "number" })}
            ${this._renderTextField("Refresco (segundos)", "refresh_interval", config.refresh_interval, { type: "number" })}
            ${this._renderCheckboxField("Permitir marcar eventos como completados", "allow_complete", config.allow_complete === true)}
            ${this._renderCheckboxField("Mostrar eventos completados", "show_completed", config.show_completed === true)}
            ${this._renderCheckboxField("Tintado automatico con color primario", "tint_auto", config.tint_auto !== false)}
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
                  ${this._renderTextField("Fondo tarjeta", "styles.card.background", config.styles?.card?.background, { fullWidth: true })}
                  ${this._renderTextField("Borde tarjeta", "styles.card.border", config.styles?.card?.border)}
                  ${this._renderTextField("Radio tarjeta", "styles.card.border_radius", config.styles?.card?.border_radius)}
                  ${this._renderTextField("Sombra tarjeta", "styles.card.box_shadow", config.styles?.card?.box_shadow, { fullWidth: true })}
                  ${this._renderTextField("Padding", "styles.card.padding", config.styles?.card?.padding)}
                  ${this._renderTextField("Separacion", "styles.card.gap", config.styles?.card?.gap)}
                  ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles?.title_size)}
                  ${this._renderTextField("Tamano evento", "styles.event_size", config.styles?.event_size)}
                  ${this._renderTextField("Tamano chip", "styles.chip_size", config.styles?.chip_size)}
                  ${this._renderTextField("Icono burbuja fondo", "styles.icon.background", config.styles?.icon?.background, { fullWidth: true })}
                  ${this._renderTextField("Icono burbuja color", "styles.icon.color", config.styles?.icon?.color, { fullWidth: true })}
                  ${this._renderTextField("Icono burbuja tamano", "styles.icon.size", config.styles?.icon?.size)}
                  ${this._renderTextField("Tintado manual", "styles.tint.color", config.styles?.tint?.color, { fullWidth: true })}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot.querySelectorAll('[data-mounted-control="calendar-entity"]').forEach(host => {
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
