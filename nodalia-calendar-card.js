const CARD_TAG = "nodalia-calendar-card";
const EDITOR_TAG = "nodalia-calendar-card-editor";
const CARD_VERSION = "1.0.0-alpha.1";
const COMPLETION_STORAGE_KEY = "nodalia_calendar_completed_v1";

const DEFAULT_CONFIG = {
  title: "Calendario",
  calendars: [],
  days_to_show: 7,
  refresh_interval: 300,
  show_completed: false,
  allow_complete: true,
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
          background: ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          overflow: hidden;
        }
        .calendar-card {
          display:grid;
          gap:${styles.card.gap};
          padding:${styles.card.padding};
        }
        .calendar-header {
          align-items:center;
          display:flex;
          justify-content:space-between;
          gap:10px;
        }
        .calendar-title {
          font-size:${styles.title_size};
          font-weight:700;
          letter-spacing:0.01em;
        }
        .calendar-chip {
          border:1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
          border-radius:999px;
          color:var(--secondary-text-color);
          font-size:${styles.chip_size};
          padding:4px 9px;
          white-space:nowrap;
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
      </style>
      <ha-card>
        <div class="calendar-card">
          <div class="calendar-header">
            <div class="calendar-title">${escapeHtml(config.title)}</div>
            <div class="calendar-chip">${escapeHtml(`${config.days_to_show} dias`)}</div>
          </div>
          ${
            this._loading
              ? `<div class="calendar-loading">Cargando eventos...</div>`
              : this._error
                ? `<div class="calendar-error">${escapeHtml(this._error)}</div>`
                : !hasEvents
                  ? `<div class="calendar-empty">No hay eventos en este rango.</div>`
                  : groups.map(group => `
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
                    `).join("")
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

  _onInputChange(event) {
    const input = event.currentTarget;
    const field = input.dataset.field || "";
    const next = deepClone(this._config || DEFAULT_CONFIG);
    if (field === "calendars") {
      next.calendars = String(input.value || "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
    } else if (input.type === "checkbox") {
      next[field] = input.checked;
    } else if (field === "days_to_show" || field === "refresh_interval") {
      next[field] = Number(input.value || 0);
    } else {
      next[field] = input.value;
    }
    this._config = normalizeConfig(next);
    this._emitConfig(this._config);
    this._render();
  }

  _render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    const config = normalizeConfig(this._config || DEFAULT_CONFIG);
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}
        .wrap{display:grid;gap:10px}
        label{display:grid;gap:4px;font-size:12px;font-weight:600}
        input{min-height:38px;padding:8px 10px;border-radius:10px;border:1px solid color-mix(in srgb,var(--primary-text-color) 10%, transparent);background:color-mix(in srgb,var(--primary-text-color) 4%, transparent);color:var(--primary-text-color)}
        .row{display:grid;gap:8px;grid-template-columns:1fr 1fr}
      </style>
      <div class="wrap">
        <label>
          <span>Titulo</span>
          <input data-field="title" value="${escapeHtml(config.title)}" />
        </label>
        <label>
          <span>Calendarios (separados por comas)</span>
          <input data-field="calendars" value="${escapeHtml(config.calendars.join(", "))}" placeholder="calendar.personal, calendar.work"/>
        </label>
        <div class="row">
          <label>
            <span>Dias a mostrar</span>
            <input type="number" data-field="days_to_show" value="${escapeHtml(config.days_to_show)}" />
          </label>
          <label>
            <span>Refresco (segundos)</span>
            <input type="number" data-field="refresh_interval" value="${escapeHtml(config.refresh_interval)}" />
          </label>
        </div>
        <label>
          <span><input type="checkbox" data-field="allow_complete" ${config.allow_complete ? "checked" : ""}/> Permitir marcar eventos como completados</span>
        </label>
        <label>
          <span><input type="checkbox" data-field="show_completed" ${config.show_completed ? "checked" : ""}/> Mostrar eventos completados</span>
        </label>
      </div>
    `;
    this.shadowRoot.querySelectorAll("input").forEach(input => {
      input.addEventListener("change", this._onInputChange.bind(this));
      if (input.type !== "checkbox") {
        input.addEventListener("input", this._onInputChange.bind(this));
      }
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
