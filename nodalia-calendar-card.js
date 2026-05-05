const CARD_TAG = "nodalia-calendar-card";
const EDITOR_TAG = "nodalia-calendar-card-editor";
const CARD_VERSION = "1.0.0-alpha.1";
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
    this._onShadowClick = this._onShadowClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this._loadCompleted();
    this._refreshEvents();
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
    this._hass = hass;
    this._render();
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

  async _refreshEvents() {
    if (!this._hass || !this._config.calendars.length) {
      this._events = [];
      this._loading = false;
      this._error = "";
      this._render();
      return;
    }
    this._loading = true;
    this._error = "";
    this._render();
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
      this._render();
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
    this._render();
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
          ${config.animations?.enabled === false ? "" : `animation: calendar-card-in ${animationDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;`}
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
    this._config = normalizeConfig(DEFAULT_CONFIG);
    this._hass = null;
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this._render();
  }

  disconnectedCallback() {
    this.shadowRoot?.removeEventListener("input", this._onShadowInput);
    this.shadowRoot?.removeEventListener("change", this._onShadowInput);
    this.shadowRoot?.removeEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
  }

  setConfig(config) {
    this._config = normalizeConfig(config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _emitConfig(next) {
    this.dispatchEvent(new CustomEvent("config-changed", {
      bubbles: true,
      composed: true,
      detail: { config: next },
    }));
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

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement);
    if (!input?.dataset?.field) {
      return;
    }
    const next = deepClone(this._config || DEFAULT_CONFIG);
    const field = input.dataset.field || "";
    let value = input.value;
    if (event.type === "input" && input.type !== "checkbox") {
      // Keep native entity/text controls stable; commit on change.
      return;
    }
    if (input.type === "checkbox") {
      value = input.checked;
    } else if (field === "days_to_show" || field === "refresh_interval" || field === "max_visible_events") {
      value = Number(input.value || 0);
    }
    this._setFieldValue(next, field, value);
    this._config = normalizeConfig(next);
    this._emitConfig(this._config);
    this._render();
  }

  _onShadowValueChanged(event) {
    const control = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.field);
    if (!control?.dataset?.field) {
      return;
    }
    const field = control.dataset.field;
    const next = deepClone(this._config || DEFAULT_CONFIG);
    const value = typeof event.detail?.value === "string" ? event.detail.value : control.value;
    this._setFieldValue(next, field, value);
    this._config = normalizeConfig(next);
    this._emitConfig(this._config);
    this._render();
  }

  _onShadowClick(event) {
    const button = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorAction);
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const next = deepClone(this._config || DEFAULT_CONFIG);
    if (!Array.isArray(next.calendars)) {
      next.calendars = [];
    }
    if (button.dataset.editorAction === "add-calendar") {
      next.calendars.push("");
    } else if (button.dataset.editorAction === "remove-calendar") {
      const index = Number(button.dataset.index || -1);
      if (Number.isFinite(index) && index >= 0 && index < next.calendars.length) {
        next.calendars.splice(index, 1);
      }
    } else {
      return;
    }
    this._config = normalizeConfig(next);
    this._emitConfig(this._config);
    this._render();
  }

  _mountEntityPickers() {
    if (!this.shadowRoot) {
      return;
    }
    this.shadowRoot.querySelectorAll('[data-mounted-control="entity"]').forEach(host => {
      const field = host.dataset.field || "entity";
      const value = host.dataset.value || "";
      host.replaceChildren();
      if (typeof customElements !== "undefined" && customElements.get("ha-selector")) {
        const control = document.createElement("ha-selector");
        control.selector = { entity: { domain: "calendar" } };
        control.dataset.field = field;
        control.value = value;
        control.hass = this._hass;
        host.appendChild(control);
        return;
      }
      if (typeof customElements !== "undefined" && customElements.get("ha-entity-picker")) {
        const control = document.createElement("ha-entity-picker");
        control.dataset.field = field;
        control.value = value;
        control.hass = this._hass;
        control.includeDomains = ["calendar"];
        host.appendChild(control);
        return;
      }
      const fallback = document.createElement("input");
      fallback.type = "text";
      fallback.placeholder = "calendar.mi_calendario";
      fallback.dataset.field = field;
      fallback.value = value;
      host.appendChild(fallback);
    });
  }

  _renderToggle(label, field, checked) {
    return `
      <label class="editor-toggle">
        <input type="checkbox" data-field="${escapeHtml(field)}" ${checked ? "checked" : ""}/>
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(label)}</span>
      </label>
    `;
  }

  _renderTextField(label, field, value, options = {}) {
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <input
          data-field="${escapeHtml(field)}"
          type="${escapeHtml(options.type || "text")}"
          value="${escapeHtml(value ?? "")}"
          placeholder="${escapeHtml(options.placeholder || "")}"
        />
      </label>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    const config = normalizeConfig(this._config || DEFAULT_CONFIG);
    const calendars = Array.isArray(config.calendars) && config.calendars.length ? config.calendars : [""];
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        .editor-wrap {
          display:grid;
          gap:14px;
        }
        .editor-section {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 14px;
          display:grid;
          gap:10px;
          padding:12px;
        }
        .editor-section__title {
          font-size:12px;
          font-weight:700;
          letter-spacing:0.06em;
          text-transform:uppercase;
        }
        .editor-grid {
          display:grid;
          gap:10px;
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
        .editor-field {
          display:grid;
          gap:5px;
          min-width:0;
        }
        .editor-field--full {
          grid-column: 1 / -1;
        }
        .editor-field > span {
          font-size:12px;
          font-weight:600;
        }
        .editor-field input {
          min-height:38px;
          padding:8px 10px;
          border-radius:10px;
          border:1px solid color-mix(in srgb,var(--primary-text-color) 10%, transparent);
          background:color-mix(in srgb,var(--primary-text-color) 4%, transparent);
          color:var(--primary-text-color);
          width:100%;
        }
        .editor-control-host {
          display:block;
          width:100%;
        }
        .calendar-row {
          display:grid;
          gap:8px;
          grid-template-columns:1fr auto;
          align-items:end;
        }
        .calendar-row button,.calendar-add {
          min-height:38px;
          padding:0 10px;
          border-radius:10px;
          border:1px solid color-mix(in srgb,var(--primary-text-color) 12%, transparent);
          background:color-mix(in srgb,var(--primary-text-color) 6%, transparent);
          color:var(--primary-text-color);
          cursor:pointer;
        }
        .editor-toggle {
          align-items:center;
          column-gap:10px;
          display:grid;
          grid-template-columns:auto 1fr;
          min-height:36px;
          position:relative;
        }
        .editor-toggle input {
          block-size:1px;
          inline-size:1px;
          margin:0;
          opacity:0;
          pointer-events:none;
          position:absolute;
        }
        .editor-toggle__switch {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius:999px;
          display:inline-flex;
          height:22px;
          position:relative;
          width:40px;
        }
        .editor-toggle__switch::before {
          background: rgba(255,255,255,0.92);
          border-radius:999px;
          content:"";
          height:18px;
          left:1px;
          position:absolute;
          top:1px;
          transition: transform 150ms ease;
          width:18px;
        }
        .editor-toggle input:checked + .editor-toggle__switch {
          background: color-mix(in srgb, var(--primary-color) 35%, transparent);
          border-color: color-mix(in srgb, var(--primary-color) 54%, transparent);
        }
        .editor-toggle input:checked + .editor-toggle__switch::before {
          transform: translateX(18px);
        }
        @media (max-width: 640px) {
          .editor-grid { grid-template-columns:1fr; }
        }
      </style>
      <div class="editor-wrap">
        <section class="editor-section">
          <div class="editor-section__title">General</div>
          <div class="editor-grid">
            ${this._renderTextField("Titulo", "title", config.title, { fullWidth: true })}
            ${this._renderTextField("Icono", "icon", config.icon || DEFAULT_CONFIG.icon, {
              fullWidth: true,
              placeholder: "mdi:calendar-month",
            })}
            ${this._renderTextField("Dias a mostrar", "days_to_show", config.days_to_show, { type: "number" })}
            ${this._renderTextField("Eventos visibles antes de scroll", "max_visible_events", config.max_visible_events, { type: "number" })}
            ${this._renderTextField("Refresco (segundos)", "refresh_interval", config.refresh_interval, { type: "number" })}
            ${this._renderToggle("Permitir marcar eventos como completados", "allow_complete", config.allow_complete === true)}
            ${this._renderToggle("Mostrar eventos completados", "show_completed", config.show_completed === true)}
            ${this._renderToggle("Tintado automatico", "tint_auto", config.tint_auto !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__title">Calendarios</div>
          <div class="editor-grid">
            <div class="editor-field editor-field--full">
              <span>Entidades calendar</span>
              <div class="editor-wrap">
            ${calendars.map((entityId, index) => `
              <div class="calendar-row">
                <div
                  class="editor-control-host"
                  data-mounted-control="entity"
                  data-field="calendars.${index}"
                  data-value="${escapeHtml(entityId)}"
                  data-entity-filter-domain="calendar"
                ></div>
                <button type="button" data-editor-action="remove-calendar" data-index="${index}">Eliminar</button>
              </div>
            `).join("")}
              </div>
            </div>
            <button type="button" class="calendar-add editor-field--full" data-editor-action="add-calendar">Agregar calendario</button>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__title">Animaciones</div>
          <div class="editor-grid">
            ${this._renderToggle("Activar animaciones", "animations.enabled", config.animations?.enabled !== false)}
            ${this._renderTextField("Entrada contenido (ms)", "animations.content_duration", config.animations?.content_duration || DEFAULT_CONFIG.animations.content_duration, { type: "number" })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__title">Estilos</div>
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
        </section>
      </div>
    `;
    this._mountEntityPickers();
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
