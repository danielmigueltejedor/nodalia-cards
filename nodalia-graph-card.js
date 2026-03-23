const CARD_TAG = "nodalia-graph-card";
const EDITOR_TAG = "nodalia-graph-card-editor";
const CARD_VERSION = "0.12.0";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
const SERIES_COLORS = [
  "#f29f05",
  "#42a5f5",
  "#7fd0c8",
  "#f56aa0",
  "#b993ff",
  "#7ad66f",
];

const DEFAULT_CONFIG = {
  entity: "",
  entities: [],
  name: "",
  icon: "",
  min: "",
  max: "",
  hours_to_show: 24,
  points: 48,
  show_header: true,
  show_icon: true,
  show_value: true,
  show_legend: true,
  show_fill: true,
  show_unavailable_badge: true,
  tap_action: "more-info",
  haptics: {
    enabled: false,
    style: "selection",
    fallback_vibrate: false,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "30px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "16px",
      gap: "12px",
    },
    icon: {
      color: "var(--primary-text-color)",
      size: "24px",
    },
    title_size: "14px",
    value_size: "46px",
    unit_size: "18px",
    legend_size: "12px",
    chart_height: "150px",
    line_width: "3px",
  },
};

const STUB_CONFIG = {
  name: "Humedad",
  entities: [
    {
      entity: "sensor.termostato_dormitorios_humedad",
      name: "Dormitorio de Rocio",
      color: "#f29f05",
    },
    {
      entity: "sensor.termostato_habitaciones_comunes_humedad",
      name: "Pasillo",
      color: "#42a5f5",
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
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function normalizeTextKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

function parseNumber(value) {
  const numeric = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseHistoryTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }

  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumberValue(value, decimals = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "--";
  }

  return numeric.toLocaleString("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function inferDecimals(rawValue) {
  const text = String(rawValue ?? "").trim().replace(",", ".");
  if (!text.includes(".")) {
    return 0;
  }
  return Math.min(3, text.split(".")[1].length);
}

function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatHoverTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveEntityEntries(config) {
  const source = Array.isArray(config?.entities) && config.entities.length
    ? config.entities
    : config?.entity
      ? [{ entity: config.entity, name: config.name || "" }]
      : [];

  return source
    .map((entry, index) => {
      if (typeof entry === "string") {
        return {
          entity: entry.trim(),
          name: "",
          color: SERIES_COLORS[index % SERIES_COLORS.length],
        };
      }

      if (!isObject(entry) || !entry.entity) {
        return null;
      }

      return {
        entity: String(entry.entity).trim(),
        name: String(entry.name || "").trim(),
        color: String(entry.color || SERIES_COLORS[index % SERIES_COLORS.length]).trim(),
      };
    })
    .filter(entry => entry?.entity);
}

function normalizeConfig(rawConfig) {
  const merged = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  merged.entities = resolveEntityEntries(merged);
  return merged;
}

function buildSmoothPath(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] || points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] || p2;

    const cp1x = p1.x + ((p2.x - p0.x) / 6);
    const cp1y = p1.y + ((p2.y - p0.y) / 6);
    const cp2x = p2.x - ((p3.x - p1.x) / 6);
    const cp2y = p2.y - ((p3.y - p1.y) / 6);

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

function buildAreaPath(points, bottomY) {
  if (!Array.isArray(points) || points.length === 0) {
    return "";
  }

  const linePath = buildSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x.toFixed(2)} ${bottomY.toFixed(2)} L ${first.x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
}

function buildInterpolatedSamples(events, startMs, endMs, pointsCount, fallbackValue = null) {
  if (!Array.isArray(events) || !events.length) {
    if (!Number.isFinite(fallbackValue)) {
      return [];
    }

    return Array.from({ length: pointsCount }, (_item, index) => ({
      ts: startMs + (((endMs - startMs) * index) / Math.max(pointsCount - 1, 1)),
      value: fallbackValue,
    }));
  }
  const spanMs = Math.max(endMs - startMs, 1);
  const bucketSize = spanMs / Math.max(pointsCount - 1, 1);
  const buckets = Array.from({ length: pointsCount }, () => []);

  events.forEach(event => {
    const clampedTs = clamp(event.ts, startMs, endMs);
    const rawIndex = Math.floor((clampedTs - startMs) / Math.max(bucketSize, 1));
    const bucketIndex = clamp(rawIndex, 0, pointsCount - 1);
    buckets[bucketIndex].push(event.value);
  });

  let lastValue = Number.isFinite(fallbackValue)
    ? fallbackValue
    : buckets.flat().find(Number.isFinite);

  return buckets.map((bucket, index) => {
    const sampleTs = startMs + (((endMs - startMs) * index) / Math.max(pointsCount - 1, 1));
    if (bucket.length) {
      lastValue = bucket.reduce((sum, value) => sum + value, 0) / bucket.length;
    }

    return {
      ts: sampleTs,
      value: Number.isFinite(lastValue) ? lastValue : 0,
    };
  });
}

class NodaliaGraphCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig() {
    return deepClone(STUB_CONFIG);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._historySeries = [];
    this._historyKey = "";
    this._historyLoadedAt = 0;
    this._historyAbortController = null;
    this._hoverIndex = null;
    this._hoverChart = null;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowPointerMove = this._onShadowPointerMove.bind(this);
    this._onShadowPointerLeave = this._onShadowPointerLeave.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("pointermove", this._onShadowPointerMove);
    this.shadowRoot.addEventListener("pointerleave", this._onShadowPointerLeave);
  }

  disconnectedCallback() {
    this._historyAbortController?.abort();
    this._historyAbortController = null;
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._historySeries = [];
    this._historyKey = "";
    this._historyLoadedAt = 0;
    this._hoverIndex = null;
    this._requestHistory();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._requestHistory();
    this._render();
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return {
      rows: 4,
      columns: 12,
      min_rows: 3,
      min_columns: 6,
    };
  }

  _getEntityEntries() {
    return resolveEntityEntries(this._config);
  }

  _getPrimaryEntityId() {
    return this._getEntityEntries()[0]?.entity || "";
  }

  _getPrimaryState() {
    const primaryEntityId = this._getPrimaryEntityId();
    return primaryEntityId ? this._hass?.states?.[primaryEntityId] || null : null;
  }

  _getSelectedEntityId() {
    const entityIds = this._getEntityEntries().map(entry => entry.entity);
    return entityIds.includes(this._activeSeriesEntityId) ? this._activeSeriesEntityId : "";
  }

  _getTitle() {
    return this._config?.name || "Grafica";
  }

  _getIcon() {
    return this._config?.icon || this._getPrimaryState()?.attributes?.icon || "mdi:chart-line";
  }

  _getUnit() {
    const entries = this._getEntityEntries();
    const units = entries
      .map(entry => {
        const state = this._hass?.states?.[entry.entity];
        return String(
          state?.attributes?.unit_of_measurement
          || state?.attributes?.native_unit_of_measurement
          || "",
        ).trim();
      })
      .filter(Boolean);

    return units.length && units.every(unit => unit === units[0]) ? units[0] : "";
  }

  _getDecimals() {
    const entry = this._getEntityEntries()[0];
    if (!entry) {
      return 0;
    }

    const state = this._hass?.states?.[entry.entity];
    return inferDecimals(state?.state);
  }

  _getCurrentValuesText() {
    const selectedEntityId = this._getSelectedEntityId();
    const primaryEntry = this._getEntityEntries().find(entry => entry.entity === selectedEntityId) || this._getEntityEntries()[0];
    const primaryState = primaryEntry ? this._hass?.states?.[primaryEntry.entity] : null;
    const primaryValue = parseNumber(primaryState?.state);

    if (!Number.isFinite(primaryValue)) {
      return { value: "--", unit: this._getUnit() };
    }

    const decimals = this._getDecimals();
    return {
      value: formatNumberValue(primaryValue, decimals),
      unit: String(
        primaryState?.attributes?.unit_of_measurement
        || primaryState?.attributes?.native_unit_of_measurement
        || this._getUnit(),
      ).trim(),
    };
  }

  _getLegendEntries() {
    const selectedEntityId = this._getSelectedEntityId();
    return this._getEntityEntries().map((entry, index) => {
      const state = this._hass?.states?.[entry.entity];
      return {
        entity: entry.entity,
        name: entry.name || state?.attributes?.friendly_name || entry.entity,
        color: entry.color || SERIES_COLORS[index % SERIES_COLORS.length],
        active: !selectedEntityId || selectedEntityId === entry.entity,
        muted: Boolean(selectedEntityId) && selectedEntityId !== entry.entity,
      };
    });
  }

  _canRunTapAction() {
    return (this._config?.tap_action || "more-info") !== "none" && Boolean(this._getPrimaryEntityId());
  }

  _triggerHaptic(styleOverride = null) {
    const haptics = this._config?.haptics || {};
    if (haptics.enabled !== true) {
      return;
    }

    const style = styleOverride || haptics.style || "selection";
    fireEvent(this, "haptic", style, {
      bubbles: true,
      cancelable: false,
      composed: true,
    });

    if (haptics.fallback_vibrate === true && typeof navigator?.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection);
    }
  }

  _openMoreInfo() {
    const entityId = this._getPrimaryEntityId();
    if (!entityId) {
      return;
    }

    fireEvent(this, "hass-more-info", {
      entityId,
    });
  }

  _onShadowClick(event) {
    const seriesChip = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.graphSeries);

    if (seriesChip) {
      event.preventDefault();
      event.stopPropagation();
      const entityId = seriesChip.dataset.graphSeries;
      this._activeSeriesEntityId = this._activeSeriesEntityId === entityId ? null : entityId;
      this._hoverIndex = null;
      this._triggerHaptic("selection");
      this._render();
      return;
    }

    const target = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.graphAction === "primary");

    if (!target || !this._canRunTapAction()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();
    this._openMoreInfo();
  }

  _getVisibleSeries(series) {
    const selectedEntityId = this._getSelectedEntityId();
    if (!selectedEntityId) {
      return series;
    }

    return series.filter(entry => entry.entity === selectedEntityId);
  }

  _onShadowPointerMove(event) {
    const surface = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.graphSurface === "chart");

    if (!surface || !this._hoverChart?.entries?.length) {
      if (this._hoverIndex !== null) {
        this._hoverIndex = null;
        this._render();
      }
      return;
    }

    const sampleCount = this._hoverChart.entries[0]?.samples?.length || 0;
    if (sampleCount <= 1) {
      return;
    }

    const rect = surface.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const relativeX = clamp(event.clientX - rect.left, 0, rect.width);
    const nextIndex = Math.round((relativeX / rect.width) * (sampleCount - 1));

    if (nextIndex !== this._hoverIndex) {
      this._hoverIndex = nextIndex;
      this._render();
    }
  }

  _onShadowPointerLeave() {
    if (this._hoverIndex !== null) {
      this._hoverIndex = null;
      this._render();
    }
  }

  _getHistoryRequestKey() {
    const entries = this._getEntityEntries();
    return JSON.stringify({
      entities: entries.map(entry => entry.entity),
      hours: Number(this._config?.hours_to_show) || DEFAULT_CONFIG.hours_to_show,
      points: Number(this._config?.points) || DEFAULT_CONFIG.points,
    });
  }

  _getStatisticsPeriod() {
    const hoursToShow = Math.max(1, Number(this._config?.hours_to_show) || DEFAULT_CONFIG.hours_to_show);

    if (hoursToShow <= 48) {
      return "5minute";
    }

    if (hoursToShow <= 24 * 14) {
      return "hour";
    }

    return "day";
  }

  async _fetchStatistics(start, end, entityIds) {
    if (typeof this._hass?.callWS !== "function") {
      return null;
    }

    try {
      const groups = await Promise.all(entityIds.map(async entityId => {
        const result = await this._hass.callWS({
          type: "recorder/statistics_during_period",
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          statistic_ids: [entityId],
          period: this._getStatisticsPeriod(),
          types: ["mean", "min", "max", "state", "sum"],
        });

        return [entityId, Array.isArray(result?.[entityId]) ? result[entityId] : []];
      }));

      return Object.fromEntries(groups);
    } catch (_error) {
      return null;
    }
  }

  async _fetchHistory(start, end, entityIds, signal) {
    const groups = await Promise.all(entityIds.map(async entityId => {
      if (typeof this._hass?.callWS === "function") {
        try {
          const result = await this._hass.callWS({
            type: "history/history_during_period",
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            entity_ids: [entityId],
            significant_changes_only: false,
          });

          const rows = Array.isArray(result?.[0]) ? result[0] : Array.isArray(result?.[entityId]) ? result[entityId] : [];
          return [entityId, rows];
        } catch (_error) {
          // Fall through to REST.
        }
      }

      if (typeof this._hass?.auth?.fetchWithAuth === "function") {
        const query = [
          `filter_entity_id=${encodeURIComponent(entityId)}`,
          `end_time=${encodeURIComponent(end.toISOString())}`,
        ].join("&");

        const response = await this._hass.auth.fetchWithAuth(
          `/api/history/period/${encodeURIComponent(start.toISOString())}?${query}`,
          { signal },
        );

        if (!response.ok) {
          throw new Error(`History request failed with ${response.status}`);
        }

        const result = await response.json();
        return [entityId, Array.isArray(result?.[0]) ? result[0] : []];
      }

      return [entityId, []];
    }));

    return Object.fromEntries(groups);
  }

  _normalizeStatisticsSeries(raw) {
    const entries = this._getLegendEntries();

    return entries.map(entry => {
      const state = this._hass?.states?.[entry.entity];
      const rows = Array.isArray(raw?.[entry.entity]) ? raw[entry.entity] : [];
      const samples = rows
        .map(item => {
          const ts = parseHistoryTimestamp(item.start ?? item.end);
          const value = parseNumber(item.mean ?? item.state ?? item.max ?? item.min ?? item.sum);
          return { ts, value };
        })
        .filter(item => Number.isFinite(item.ts) && Number.isFinite(item.value))
        .sort((left, right) => left.ts - right.ts);

      const currentValue = parseNumber(state?.state);

      return {
        ...entry,
        unit: String(
          state?.attributes?.unit_of_measurement
          || state?.attributes?.native_unit_of_measurement
          || "",
        ).trim(),
        currentValue: Number.isFinite(currentValue) ? currentValue : samples[samples.length - 1]?.value ?? 0,
        rawEventCount: samples.length,
        samples,
      };
    });
  }

  _normalizeHistorySeries(raw, start, end) {
    const entries = this._getLegendEntries();
    const historyByEntity = new Map();
    const pointsCount = Math.max(20, Number(this._config?.points) || DEFAULT_CONFIG.points);
    const startMs = start.getTime();
    const endMs = end.getTime();

    if (Array.isArray(raw)) {
      raw.forEach((group, index) => {
        if (!Array.isArray(group)) {
          return;
        }

        const resolvedEntityId = group[0]?.entity_id || entries[index]?.entity;
        if (resolvedEntityId) {
          historyByEntity.set(resolvedEntityId, group);
        }
      });
    } else if (isObject(raw)) {
      Object.entries(raw).forEach(([entityId, group]) => {
        if (Array.isArray(group)) {
          historyByEntity.set(entityId, group);
        }
      });
    }

    return entries.map(entry => {
      const state = this._hass?.states?.[entry.entity];
      const rawGroup = historyByEntity.get(entry.entity) || [];
      const events = rawGroup
        .map(item => ({
          ts: parseHistoryTimestamp(
            item.last_changed
            || item.last_updated
            || item.lc
            || item.lu
            || item.last_changed_ts
            || item.last_updated_ts,
          ),
          value: parseNumber(item.state ?? item.s ?? item.value ?? item.v),
        }))
        .filter(item => Number.isFinite(item.ts) && Number.isFinite(item.value))
        .sort((left, right) => left.ts - right.ts);

      const currentValue = parseNumber(state?.state);
      if (Number.isFinite(currentValue)) {
        const nowTs = end.getTime();
        if (!events.length || Math.abs(events[events.length - 1].ts - nowTs) > 1000) {
          events.push({ ts: nowTs, value: currentValue });
        }
      }
      const samples = buildInterpolatedSamples(events, startMs, endMs, pointsCount, currentValue);

      return {
        ...entry,
        unit: String(
          state?.attributes?.unit_of_measurement
          || state?.attributes?.native_unit_of_measurement
          || "",
        ).trim(),
        currentValue: Number.isFinite(currentValue) ? currentValue : samples[samples.length - 1]?.value ?? 0,
        rawEventCount: events.length,
        samples,
      };
    });
  }

  async _requestHistory() {
    if (!this._hass || !this._getEntityEntries().length) {
      return;
    }

    const requestKey = this._getHistoryRequestKey();
    if (
      requestKey === this._historyKey &&
      this._historySeries.length &&
      Date.now() - this._historyLoadedAt < 180000
    ) {
      return;
    }

    this._historyAbortController?.abort();
    const controller = new AbortController();
    this._historyAbortController = controller;

    const end = new Date();
    const hoursToShow = Math.max(1, Number(this._config?.hours_to_show) || DEFAULT_CONFIG.hours_to_show);
    const start = new Date(end.getTime() - (hoursToShow * 60 * 60 * 1000));

    try {
      const entityIds = this._getEntityEntries().map(entry => entry.entity);
      const raw = await this._fetchHistory(start, end, entityIds, controller.signal);
      if (controller.signal.aborted) {
        return;
      }

      const normalized = this._normalizeHistorySeries(raw || {}, start, end);
      const hasMeaningfulHistory = normalized.some(entry => entry.rawEventCount > 1 && entry.samples.length > 1);

      if (hasMeaningfulHistory) {
        this._historySeries = normalized;
        this._historyKey = requestKey;
        this._historyLoadedAt = Date.now();
        this._render();
        return;
      }

      const statisticsRaw = await this._fetchStatistics(start, end, entityIds);
      if (controller.signal.aborted) {
        return;
      }

      const statisticsSeries = this._normalizeStatisticsSeries(statisticsRaw || {});
      const hasMeaningfulStatistics = statisticsSeries.some(entry => entry.rawEventCount > 1 && entry.samples.length > 1);
      this._historySeries = statisticsSeries;
      this._historyKey = hasMeaningfulStatistics ? requestKey : "";
      this._historyLoadedAt = hasMeaningfulStatistics ? Date.now() : 0;
      this._render();
    } catch (_error) {
      if (controller.signal.aborted) {
        return;
      }

      this._historySeries = [];
      this._historyKey = "";
      this._historyLoadedAt = 0;
      this._render();
    } finally {
      if (this._historyAbortController === controller) {
        this._historyAbortController = null;
      }
    }
  }

  _getGraphBounds(series) {
    const configuredMin = Number(this._config?.min);
    const configuredMax = Number(this._config?.max);
    const values = series.flatMap(entry => entry.samples.map(sample => sample.value)).filter(Number.isFinite);

    let min = Number.isFinite(configuredMin) ? configuredMin : Math.min(...values);
    let max = Number.isFinite(configuredMax) ? configuredMax : Math.max(...values);

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 0;
      max = 100;
    }

    if (!Number.isFinite(configuredMin)) {
      const spread = Math.max(max - min, 1);
      min -= spread * 0.14;
    }

    if (!Number.isFinite(configuredMax)) {
      const spread = Math.max(max - min, 1);
      max += spread * 0.08;
    }

    if (max <= min) {
      max = min + 1;
    }

    return { min, max };
  }

  _buildChartSeries(series) {
    const width = 100;
    const height = 56;
    const paddingX = -5.5;
    const paddingTop = 3;
    const paddingBottom = 2;
    const bounds = this._getGraphBounds(series);
    const range = Math.max(bounds.max - bounds.min, 1);

    return {
      width,
      height,
      entries: series.map(entry => {
        if (!entry.samples.length) {
          return {
            ...entry,
            points: [],
            linePath: "",
            fillPath: "",
          };
        }

        const points = entry.samples.map((sample, index) => {
          const x = paddingX + ((width - (paddingX * 2)) * index) / Math.max(entry.samples.length - 1, 1);
          const normalized = clamp((sample.value - bounds.min) / range, 0, 1);
          const y = paddingTop + ((height - paddingTop - paddingBottom) * (1 - normalized));
          return { x, y };
        });

        return {
          ...entry,
          points,
          linePath: buildSmoothPath(points),
          fillPath: buildAreaPath(points, height - paddingBottom),
        };
      }),
    };
  }

  _getHoverPayload(chart) {
    if (!this._hoverChart || !chart?.entries?.length || this._hoverIndex === null) {
      return null;
    }

    const boundedIndex = clamp(this._hoverIndex, 0, Math.max((chart.entries[0]?.samples?.length || 1) - 1, 0));
    const primaryEntry = chart.entries[0];
    const primarySample = primaryEntry?.samples?.[boundedIndex];
    const anchorPoint = primaryEntry?.points?.[boundedIndex];

    if (!primarySample || !anchorPoint) {
      return null;
    }

    const decimals = this._getDecimals();
    return {
      index: boundedIndex,
      label: formatHoverTimestamp(primarySample.ts),
      x: anchorPoint.x,
      values: chart.entries
        .map(entry => {
          const sample = entry.samples?.[boundedIndex];
          if (!sample) {
            return null;
          }

          return {
            color: entry.color,
            name: entry.name,
            value: formatNumberValue(sample.value, decimals),
            unit: entry.unit || this._getUnit(),
            point: entry.points?.[boundedIndex] || null,
          };
        })
        .filter(Boolean),
    };
  }

  _getSeriesData() {
    if (this._historySeries.some(entry => entry.samples?.length > 1)) {
      return this._historySeries;
    }
    return [];
  }

  _renderEmptyState() {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    return `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        .graph-card--empty {
          background: ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          display: grid;
          gap: 6px;
          padding: ${styles.card.padding};
        }

        .graph-card__empty-title {
          color: var(--primary-text-color);
          font-size: 15px;
          font-weight: 700;
        }

        .graph-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }
      </style>
      <ha-card class="graph-card graph-card--empty">
        <div class="graph-card__empty-title">Nodalia Graph Card</div>
        <div class="graph-card__empty-text">Configura \`entities\` con una o varias entidades numericas para mostrar la grafica.</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const entries = this._getEntityEntries();
    if (!entries.length) {
      this.shadowRoot.innerHTML = this._renderEmptyState();
      return;
    }

    const config = this._config || normalizeConfig({});
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const legendEntries = this._getLegendEntries();
    const showUnavailableBadge = config.show_unavailable_badge !== false && entries.some(entry => isUnavailableState(this._hass?.states?.[entry.entity]));
    const compactLayout = Number(config?.grid_options?.rows) > 0 && Number(config?.grid_options?.rows) <= 3;
    const currentValue = this._getCurrentValuesText();
    const allSeries = this._getSeriesData();
    const chart = this._buildChartSeries(this._getVisibleSeries(allSeries));
    this._hoverChart = chart;
    const hasGraphData = chart.entries.some(entry => entry.linePath);
    const hover = hasGraphData ? this._getHoverPayload(chart) : null;
    const icon = this._getIcon();
    const title = this._getTitle();
    const accentColor = chart.entries[0]?.color || legendEntries[0]?.color || "var(--primary-color)";
    const chartHeight = `${Math.max(120, Math.min(parseSizeToPixels(styles.chart_height, 150), compactLayout ? 132 : 150))}px`;
    const valueSize = `${Math.max(38, Math.min(parseSizeToPixels(styles.value_size, 46), compactLayout ? 42 : 46))}px`;
    const unitSize = `${Math.max(15, Math.min(parseSizeToPixels(styles.unit_size, 18), compactLayout ? 16 : 18))}px`;
    const titleSize = `${Math.max(13, Math.min(parseSizeToPixels(styles.title_size, 14), compactLayout ? 13 : 14))}px`;
    const legendSize = `${Math.max(11, Math.min(parseSizeToPixels(styles.legend_size, 12), compactLayout ? 11 : 12))}px`;
    const lineWidth = `${Math.max(2, Math.min(parseSizeToPixels(styles.line_width, 3), compactLayout ? 2.4 : 3))}`;
    const cardPaddingPx = Math.max(12, parseSizeToPixels(styles.card.padding, 16));
    const chartBleed = Math.round(cardPaddingPx * 0.95);
    const cardBackground = `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 8%, rgba(255, 255, 255, 0.02)) 0%, ${styles.card.background} 100%)`;
    const cardBorder = `1px solid color-mix(in srgb, ${accentColor} 20%, var(--divider-color))`;
    const cardShadow = `${styles.card.box_shadow}, 0 18px 36px color-mix(in srgb, ${accentColor} 8%, rgba(0, 0, 0, 0.16))`;
    const tooltipTint = hover?.values?.[0]?.color || accentColor;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          min-height: 0;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        .graph-card {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${accentColor} 12%, transparent) 0%, transparent 44%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.018) 0%, rgba(0, 0, 0, 0.02) 100%),
            ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          position: relative;
        }

        .graph-card__content {
          cursor: ${this._canRunTapAction() ? "pointer" : "default"};
          display: flex;
          flex-direction: column;
          gap: ${styles.card.gap};
          height: 100%;
          min-height: 0;
          padding: ${styles.card.padding};
          position: relative;
          z-index: 1;
        }

        .graph-card__header {
          align-items: start;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .graph-card__title {
          color: var(--primary-text-color);
          font-size: ${titleSize};
          font-weight: 500;
          line-height: 1.15;
          min-width: 0;
          opacity: 0.95;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .graph-card__icon {
          align-items: center;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.03) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          color: ${styles.icon.color};
          display: inline-flex;
          height: 42px;
          justify-content: center;
          opacity: 0.9;
          padding: 0 12px;
          position: relative;
        }

        .graph-card__icon ha-icon {
          --mdc-icon-size: ${Math.max(22, parseSizeToPixels(styles.icon.size, 28))}px;
          height: ${Math.max(22, parseSizeToPixels(styles.icon.size, 28))}px;
          width: ${Math.max(22, parseSizeToPixels(styles.icon.size, 28))}px;
        }

        .graph-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          color: #ffffff;
          display: inline-flex;
          height: 18px;
          justify-content: center;
          position: absolute;
          right: -4px;
          top: -3px;
          width: 18px;
          z-index: 2;
        }

        .graph-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          width: 11px;
        }

        .graph-card__value {
          align-items: baseline;
          display: flex;
          flex-wrap: nowrap;
          gap: 6px;
          line-height: 0.94;
          min-width: 0;
        }

        .graph-card__value-number {
          font-size: ${valueSize};
          font-weight: 400;
          letter-spacing: -0.06em;
          line-height: 0.9;
          min-width: 0;
        }

        .graph-card__value-unit {
          font-size: ${unitSize};
          font-weight: 500;
          line-height: 1;
          opacity: 0.84;
          padding-top: 0;
        }

        .graph-card__legend {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px 10px;
          justify-content: flex-start;
          min-height: 0;
          padding-top: 2px;
        }

        .graph-card__legend-item {
          align-items: center;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.045) 0%, rgba(255, 255, 255, 0.03) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font-size: ${legendSize};
          gap: 10px;
          max-width: min(100%, 220px);
          min-width: 0;
          opacity: 0.9;
          padding: 7px 12px;
          transition: opacity 160ms ease, transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
        }

        .graph-card__legend-item:hover {
          opacity: 1;
          transform: translateY(-1px);
        }

        .graph-card__legend-item--active {
          background: linear-gradient(180deg, color-mix(in srgb, var(--legend-color) 14%, rgba(255,255,255,0.05)) 0%, rgba(255,255,255,0.035) 100%);
          border-color: color-mix(in srgb, var(--legend-color) 34%, rgba(255,255,255,0.08));
          box-shadow: 0 12px 24px color-mix(in srgb, var(--legend-color) 10%, rgba(0, 0, 0, 0.14));
        }

        .graph-card__legend-item--muted {
          opacity: 0.48;
        }

        .graph-card__legend-dot {
          border-radius: 999px;
          display: inline-flex;
          flex: 0 0 auto;
          height: 10px;
          width: 10px;
        }

        .graph-card__legend-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .graph-card__chart-wrap {
          flex: 1 1 auto;
          min-height: ${chartHeight};
          margin-inline: -${chartBleed}px;
          margin-top: 8px;
          overflow: visible;
          padding: 2px 0 0;
          position: relative;
          width: calc(100% + ${chartBleed * 2}px);
        }

        .graph-card__chart {
          display: block;
          height: 100%;
          width: 100%;
        }

        .graph-card__hover-line {
          stroke: rgba(255, 255, 255, 0.16);
          stroke-dasharray: 2 4;
          stroke-width: 0.7;
        }

        .graph-card__hover-point {
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.18));
        }

        .graph-card__hover-point-halo {
          fill: color-mix(in srgb, var(--hover-color) 14%, rgba(255, 255, 255, 0.08));
        }

        .graph-card__hover-point-outer {
          fill: color-mix(in srgb, var(--hover-color) 10%, rgba(255, 255, 255, 0.52));
        }

        .graph-card__hover-point-ring {
          fill: rgba(255, 255, 255, 0.92);
        }

        .graph-card__tooltip {
          backdrop-filter: blur(18px);
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--tooltip-tint) 18%, transparent) 0%, transparent 48%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.055) 0%, rgba(255, 255, 255, 0.02) 100%),
            linear-gradient(180deg, rgba(42, 43, 53, 0.96) 0%, rgba(31, 32, 41, 0.97) 100%);
          border: 1px solid color-mix(in srgb, var(--tooltip-tint) 26%, rgba(255, 255, 255, 0.12));
          border-radius: 22px;
          box-shadow:
            0 22px 38px rgba(0, 0, 0, 0.28),
            0 10px 26px color-mix(in srgb, var(--tooltip-tint) 12%, rgba(0, 0, 0, 0.18));
          color: var(--primary-text-color);
          max-width: min(320px, calc(100% - 20px));
          min-width: 210px;
          padding: 13px 15px;
          pointer-events: none;
          position: absolute;
          top: -110px;
          transform: translateX(-50%);
          z-index: 3;
        }

        .graph-card__tooltip-time {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .graph-card__tooltip-values {
          display: grid;
          gap: 6px;
        }

        .graph-card__tooltip-row {
          align-items: center;
          display: grid;
          gap: 8px;
          grid-template-columns: auto minmax(0, 1fr) auto;
        }

        .graph-card__tooltip-dot {
          border-radius: 999px;
          display: inline-flex;
          height: 9px;
          width: 9px;
        }

        .graph-card__tooltip-name {
          font-size: 12px;
          font-weight: 500;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .graph-card__tooltip-value {
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .graph-card__chart-empty {
          align-items: center;
          color: var(--secondary-text-color);
          display: flex;
          font-size: 13px;
          inset: 0;
          justify-content: center;
          opacity: 0.8;
          position: absolute;
        }

        .graph-card__chart-series-fill {
          opacity: 0.028;
        }

        .graph-card__chart-series-glow {
          fill: none;
          filter: url(#graph-glow);
          opacity: 0.18;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: calc(${lineWidth} * 2.1);
        }

        .graph-card__chart-series-line {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-opacity: 0.9;
          stroke-width: ${lineWidth};
        }

        @media (max-width: 640px) {
          .graph-card__header {
            gap: 8px;
          }

          .graph-card__legend {
            justify-content: flex-start;
          }
        }
      </style>
      <ha-card class="graph-card">
        <div class="graph-card__content" ${this._canRunTapAction() ? 'data-graph-action="primary"' : ""}>
          ${
            config.show_header !== false
              ? `
                <div class="graph-card__header">
                  <div class="graph-card__title">${escapeHtml(title)}</div>
                  ${
                    config.show_icon !== false
                      ? `
                        <div class="graph-card__icon">
                          <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
                          ${showUnavailableBadge ? `<span class="graph-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                        </div>
                      `
                      : ""
                  }
                </div>
              `
              : ""
          }

          ${
            config.show_value !== false
              ? `
                <div class="graph-card__value">
                  <div class="graph-card__value-number">${escapeHtml(currentValue.value)}</div>
                  ${currentValue.unit ? `<div class="graph-card__value-unit">${escapeHtml(currentValue.unit)}</div>` : ""}
                </div>
              `
              : ""
          }

          ${
            config.show_legend !== false
              ? `
                <div class="graph-card__legend">
                  ${legendEntries.map(entry => `
                    <div
                      class="graph-card__legend-item ${entry.active ? "graph-card__legend-item--active" : ""} ${entry.muted ? "graph-card__legend-item--muted" : ""}"
                      data-graph-series="${escapeHtml(entry.entity)}"
                      style="--legend-color:${escapeHtml(entry.color)};"
                    >
                      <span class="graph-card__legend-dot" style="background:${escapeHtml(entry.color)};"></span>
                      <span class="graph-card__legend-text">${escapeHtml(entry.name)}</span>
                    </div>
                  `).join("")}
                </div>
              `
              : ""
          }

          <div class="graph-card__chart-wrap" data-graph-surface="chart">
            ${
              hover
                ? `
                  <div class="graph-card__tooltip" style="left: ${clamp(hover.x, 10, chart.width - 10)}%; --tooltip-tint:${escapeHtml(tooltipTint)};">
                    <div class="graph-card__tooltip-time">${escapeHtml(hover.label)}</div>
                    <div class="graph-card__tooltip-values">
                      ${hover.values.map(item => `
                        <div class="graph-card__tooltip-row">
                          <span class="graph-card__tooltip-dot" style="background:${escapeHtml(item.color)};"></span>
                          <span class="graph-card__tooltip-name">${escapeHtml(item.name)}</span>
                          <span class="graph-card__tooltip-value">${escapeHtml(item.value)}${item.unit ? ` ${escapeHtml(item.unit)}` : ""}</span>
                        </div>
                      `).join("")}
                    </div>
                  </div>
                `
                : ""
            }
            <svg class="graph-card__chart" viewBox="0 0 ${chart.width} ${chart.height}" preserveAspectRatio="none">
              <defs>
                <filter id="graph-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="1.5" />
                </filter>
              </defs>
              ${
                hover
                  ? `<line class="graph-card__hover-line" x1="${hover.x.toFixed(2)}" y1="0" x2="${hover.x.toFixed(2)}" y2="${chart.height}"></line>`
                  : ""
              }
              ${chart.entries.map(entry => `
                ${
                  config.show_fill !== false
                    ? `<path class="graph-card__chart-series-fill" d="${entry.fillPath}" fill="${escapeHtml(entry.color)}"></path>`
                    : ""
                }
                <path class="graph-card__chart-series-glow" d="${entry.linePath}" stroke="${escapeHtml(entry.color)}"></path>
                <path class="graph-card__chart-series-line" d="${entry.linePath}" stroke="${escapeHtml(entry.color)}"></path>
                ${
                  hover
                    ? (() => {
                        const point = hover.values.find(item => item.name === entry.name)?.point;
                        return point
                          ? `
                              <circle class="graph-card__hover-point-halo" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="5.4" style="--hover-color:${escapeHtml(entry.color)};"></circle>
                              <circle class="graph-card__hover-point-outer" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4.1"></circle>
                              <circle class="graph-card__hover-point-ring" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="2.95"></circle>
                              <circle class="graph-card__hover-point" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="1.8" fill="${escapeHtml(entry.color)}"></circle>
                            `
                          : "";
                      })()
                    : ""
                }
              `).join("")}
            </svg>
            ${hasGraphData ? "" : `<div class="graph-card__chart-empty">Sin historial disponible</div>`}
          </div>
        </div>
      </ha-card>
    `;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaGraphCard);
}

class NodaliaGraphCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._onShadowInput = this._onShadowInput.bind(this);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
  }

  set hass(hass) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender = !this._hass || nextSignature !== this._entityOptionsSignature || !this.shadowRoot?.innerHTML;
    this._hass = hass;
    this._entityOptionsSignature = nextSignature;

    if (shouldRender) {
      this._render();
    }
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._render();
  }

  _getEntityOptionsSignature(hass) {
    if (!hass?.states) {
      return "";
    }

    return Object.keys(hass.states)
      .filter(entityId => entityId.startsWith("sensor.") || entityId.startsWith("number.") || entityId.startsWith("input_number."))
      .sort((left, right) => left.localeCompare(right, "es"))
      .join("|");
  }

  _captureFocusState() {
    const activeElement = this.shadowRoot?.activeElement;
    if (
      !(
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement
      ) ||
      !activeElement.dataset?.field
    ) {
      return null;
    }

    const selector = `[data-field="${CSS.escape(activeElement.dataset.field)}"]`;
    const supportsSelection =
      (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) &&
      activeElement.type !== "checkbox" &&
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
      // Ignore unsupported inputs.
    }
  }

  _emitConfig() {
    const focusState = this._captureFocusState();
    const nextConfig = deepClone(this._config);
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
      case "entities":
        return String(input.value || "")
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean)
          .map((line, index) => {
            const [entity, name = "", color = ""] = line.split("|").map(part => part.trim());
            return {
              entity,
              name,
              color: color || SERIES_COLORS[index % SERIES_COLORS.length],
            };
          })
          .filter(entry => entry.entity);
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

  _renderTextField(label, field, value, options = {}) {
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";
    const inputValue = value === undefined || value === null ? "" : String(value);

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

  _renderTextareaField(label, field, value, options = {}) {
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";

    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(label)}</span>
        <textarea
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          rows="${escapeHtml(String(options.rows || 4))}"
          ${placeholder}
        >${escapeHtml(inputValue)}</textarea>
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

  _renderSelectField(label, field, value, options) {
    return `
      <label class="editor-field">
        <span>${escapeHtml(label)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options
            .map(option => `
              <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
                ${escapeHtml(option.label)}
              </option>
            `)
            .join("")}
        </select>
      </label>
    `;
  }

  _serializeEntities() {
    return this._config.entities
      .map(entry => [entry.entity || "", entry.name || "", entry.color || ""].join("|"))
      .join("\n");
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
          min-height: 110px;
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

        @media (max-width: 640px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }

          .editor-toggle {
            padding-top: 0;
          }
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">General</div>
            <div class="editor-section__hint">Configura titulo, entidades y rango visible de la grafica.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Humedad",
            })}
            ${this._renderTextField("Icono", "icon", config.icon, {
              placeholder: "mdi:water-percent",
            })}
            ${this._renderTextField("Minimo", "min", config.min, {
              type: "number",
              placeholder: "0",
            })}
            ${this._renderTextField("Maximo", "max", config.max, {
              type: "number",
              placeholder: "100",
            })}
            ${this._renderTextField("Horas a mostrar", "hours_to_show", config.hours_to_show, {
              type: "number",
              placeholder: "24",
            })}
            ${this._renderTextField("Puntos", "points", config.points, {
              type: "number",
              placeholder: "48",
            })}
            ${this._renderTextareaField("Entidades", "entities", this._serializeEntities(), {
              valueType: "entities",
              rows: 5,
              placeholder: "sensor.humedad_dormitorio|Dormitorio de Rocio|#f29f05\nsensor.humedad_pasillo|Pasillo|#42a5f5",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Visibilidad</div>
            <div class="editor-section__hint">Activa o desactiva cabecera, valor, leyenda y relleno.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Mostrar cabecera", "show_header", config.show_header !== false)}
            ${this._renderCheckboxField("Mostrar icono", "show_icon", config.show_icon !== false)}
            ${this._renderCheckboxField("Mostrar valor grande", "show_value", config.show_value !== false)}
            ${this._renderCheckboxField("Mostrar leyenda", "show_legend", config.show_legend !== false)}
            ${this._renderCheckboxField("Mostrar relleno", "show_fill", config.show_fill !== false)}
            ${this._renderCheckboxField("Mostrar badge de no disponible", "show_unavailable_badge", config.show_unavailable_badge !== false)}
            ${this._renderSelectField(
              "Tap action",
              "tap_action",
              config.tap_action || "more-info",
              [
                { value: "more-info", label: "More info" },
                { value: "none", label: "Sin accion" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Haptics</div>
            <div class="editor-section__hint">Respuesta haptica opcional al tocar la tarjeta.</div>
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
            <div class="editor-section__hint">Ajustes visuales del grafico y el look Nodalia.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Background", "styles.card.background", config.styles.card.background)}
            ${this._renderTextField("Border", "styles.card.border", config.styles.card.border)}
            ${this._renderTextField("Radius", "styles.card.border_radius", config.styles.card.border_radius)}
            ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
            ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
            ${this._renderTextField("Separacion", "styles.card.gap", config.styles.card.gap)}
            ${this._renderTextField("Tamano icono", "styles.icon.size", config.styles.icon.size)}
            ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
            ${this._renderTextField("Tamano valor", "styles.value_size", config.styles.value_size)}
            ${this._renderTextField("Tamano unidad", "styles.unit_size", config.styles.unit_size)}
            ${this._renderTextField("Tamano leyenda", "styles.legend_size", config.styles.legend_size)}
            ${this._renderTextField("Alto grafico", "styles.chart_height", config.styles.chart_height)}
            ${this._renderTextField("Grosor linea", "styles.line_width", config.styles.line_width)}
          </div>
        </section>
      </div>
    `;
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaGraphCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Graph Card",
  description: "Tarjeta de grafica elegante para una o varias entidades numericas con estilo Nodalia.",
  preview: true,
});
