import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadAirQualityHelpers() {
  const registry = new Map();
  class FakeHTMLElement {
    constructor() {
      this.isConnected = true;
      this.classList = { add() {}, remove() {}, contains() { return false; } };
    }

    addEventListener() {}
    removeEventListener() {}

    attachShadow() {
      this.shadowRoot = {
        addEventListener() {},
        removeEventListener() {},
        innerHTML: "",
        querySelector() { return null; },
        querySelectorAll() { return []; },
      };
      return this.shadowRoot;
    }

    dispatchEvent() {
      return true;
    }
  }

  const sandbox = {
    console,
    clearTimeout,
    setTimeout,
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    customElements: {
      define(name, klass) { registry.set(name, klass); },
      get(name) { return registry.get(name); },
      whenDefined() { return Promise.resolve(); },
    },
    document: {
      createElement() { return {}; },
      documentElement: { getAttribute() { return ""; } },
      querySelector() { return null; },
    },
    HTMLElement: FakeHTMLElement,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    navigator: {},
    window: null,
    NodaliaI18n: {
      resolveLanguage() { return "en"; },
      resolveHass(hass) { return hass; },
      strings() {
        return {
          entityCard: {
            emptyTitle: "Nodalia Entity Card",
            emptyBody: "Set entity",
            airQuality: {
              title: "Air quality",
              aqi: "AQI",
              headline: "Air quality",
              whoGuidelines: "WHO 24h AQG",
              levels: {
                good: "Good",
                moderate: "Moderate",
                unhealthy_sensitive: "Unhealthy for sensitive groups",
                unhealthy: "Unhealthy",
                very_unhealthy: "Very unhealthy",
                hazardous: "Hazardous",
                unknown: "Unknown",
              },
              metrics: {
                pm1: "PM1",
                pm25: "PM2.5",
                pm4: "PM4",
                pm10: "PM10",
                tvoc: "TVOC",
                co2: "CO₂",
                temperature: "Temp",
                humidity: "Humidity",
              },
            },
          },
        };
      },
      translateEntityState(_lang, state) {
        return String(state?.state ?? "");
      },
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-entity-card.js"), sandbox);
  return {
    helpers: sandbox.__NODALIA_ENTITY_AIR_QUALITY__,
    Card: registry.get("nodalia-entity-card"),
  };
}

const { helpers, Card } = loadAirQualityHelpers();

test("entity card air quality helpers classify WHO PM and AQI bands", () => {
  assert.equal(helpers.resolveAirQualityLevelFromBands(12, helpers.AIR_QUALITY_WHO_BANDS.pm25), "good");
  assert.equal(helpers.resolveAirQualityLevelFromBands(20, helpers.AIR_QUALITY_WHO_BANDS.pm25), "moderate");
  assert.equal(helpers.resolveAirQualityLevelFromBands(80, helpers.AIR_QUALITY_WHO_BANDS.pm25), "hazardous");
  assert.equal(helpers.resolveAirQualityLevelFromAqi(42), "good");
  assert.equal(helpers.resolveAirQualityLevelFromAqi(175), "unhealthy");
  assert.equal(helpers.worseAirQualityLevel("good", "moderate"), "moderate");
  assert.equal(helpers.parseAirQualityNumeric("12,5 µg/m³"), 12.5);
});

test("entity card air quality layout renders metric grid and WHO tint", () => {
  const card = new Card();
  card.setConfig({
    entity: "sensor.nodalia_demo_aqi",
    name: "Living room air",
    layout: "air_quality",
    air_quality: {
      guidelines: "who",
      show_graphs: true,
      graph_hours: 24,
      pm1: "sensor.nodalia_demo_pm1",
      pm25: "sensor.nodalia_demo_pm25",
      pm4: "sensor.nodalia_demo_pm4",
      pm10: "sensor.nodalia_demo_pm10",
      tvoc: "sensor.nodalia_demo_tvoc",
      temperature: "sensor.nodalia_demo_temperature",
      humidity: "sensor.nodalia_demo_humidity",
      co2: "sensor.nodalia_demo_co2",
    },
  });

  card.hass = {
    states: {
      "sensor.nodalia_demo_aqi": {
        entity_id: "sensor.nodalia_demo_aqi",
        state: "42",
        attributes: { device_class: "aqi", unit_of_measurement: "AQI", friendly_name: "Nodalia Demo AQI" },
      },
      "sensor.nodalia_demo_pm1": {
        entity_id: "sensor.nodalia_demo_pm1",
        state: "8",
        attributes: { unit_of_measurement: "µg/m³" },
      },
      "sensor.nodalia_demo_pm25": {
        entity_id: "sensor.nodalia_demo_pm25",
        state: "12",
        attributes: { unit_of_measurement: "µg/m³", device_class: "pm25" },
      },
      "sensor.nodalia_demo_pm4": {
        entity_id: "sensor.nodalia_demo_pm4",
        state: "16",
        attributes: { unit_of_measurement: "µg/m³" },
      },
      "sensor.nodalia_demo_pm10": {
        entity_id: "sensor.nodalia_demo_pm10",
        state: "22",
        attributes: { unit_of_measurement: "µg/m³", device_class: "pm10" },
      },
      "sensor.nodalia_demo_tvoc": {
        entity_id: "sensor.nodalia_demo_tvoc",
        state: "180",
        attributes: { unit_of_measurement: "µg/m³" },
      },
      "sensor.nodalia_demo_temperature": {
        entity_id: "sensor.nodalia_demo_temperature",
        state: "22.4",
        attributes: { unit_of_measurement: "°C", device_class: "temperature" },
      },
      "sensor.nodalia_demo_humidity": {
        entity_id: "sensor.nodalia_demo_humidity",
        state: "48",
        attributes: { unit_of_measurement: "%", device_class: "humidity" },
      },
      "sensor.nodalia_demo_co2": {
        entity_id: "sensor.nodalia_demo_co2",
        state: "780",
        attributes: { unit_of_measurement: "ppm", device_class: "carbon_dioxide" },
      },
    },
  };

  const html = String(card.shadowRoot.innerHTML);
  assert.match(html, /entity-card--air-quality/);
  assert.match(html, /entity-card__headline/);
  assert.match(html, /entity-card__chip--state/);
  assert.match(html, /entity-card__aq-metrics/);
  assert.match(html, /entity-card__aq-bubble/);
  assert.match(html, /entity-card__headline[\s\S]*22\.4/);
  assert.match(html, /entity-card__headline[\s\S]*48/);
  assert.match(html, /WHO 24h AQG/);
  assert.match(html, /PM2\.5/);
  assert.match(html, /data-entity="sensor\.nodalia_demo_co2"/);
  assert.match(html, /data-entity="sensor\.nodalia_demo_temperature"/);
  assert.match(html, /entity-card__aq-chart-panel/);
  const metricsHtml = html.split('class="entity-card__aq-metrics"')[1] || "";
  assert.doesNotMatch(metricsHtml, /22\.4/);
  assert.doesNotMatch(metricsHtml, /48 %/);
  card.isConnected = false;
  if (card._entranceAnimationResetTimer) {
    clearTimeout(card._entranceAnimationResetTimer);
    card._entranceAnimationResetTimer = 0;
  }
  card._clearAirQualityHistory?.();
});

test("entity card air quality sparkline helpers build smooth paths", () => {
  const points = [
    { x: 0, y: 10 },
    { x: 10, y: 4 },
    { x: 20, y: 8 },
  ];
  assert.match(helpers.buildAirQualitySmoothPath(points), /^M /);
  assert.match(helpers.buildAirQualityAreaPath(points, 20), / Z$/);
  assert.equal(helpers.buildAirQualityInterpolatedSamples([], 0, 1000, 4, 12).length, 4);
});

test("entity card air quality normalizes custom graph colors safely", () => {
  const normalized = helpers.normalizeAirQualityBlock({
    graph_colors: {
      pm25: "#123456",
      pm10: "red;display:none",
    },
  });

  assert.equal(normalized.graph_colors.pm25, "#123456");
  assert.equal(normalized.graph_colors.pm10, helpers.AIR_QUALITY_GRAPH_SERIES_COLORS.pm10);
  assert.equal(normalized.graph_colors.humidity, helpers.AIR_QUALITY_GRAPH_SERIES_COLORS.humidity);
});

test("entity card air quality chart geometry resolves the hovered sample", () => {
  const geometry = helpers.buildAirQualityChartGeometry([
    {
      kind: "pm25",
      label: "PM2.5",
      unit: "µg/m³",
      color: "#123456",
      samples: [
        { ts: 1000, value: 10 },
        { ts: 2000, value: 14 },
        { ts: 3000, value: 12 },
      ],
    },
  ]);
  const hover = helpers.getAirQualityHoverPayload(geometry, { kind: "pm25", index: 1 });

  assert.equal(geometry.paths.length, 1);
  assert.match(geometry.paths[0].linePath, /^M /);
  assert.equal(hover.value, 14);
  assert.equal(hover.ts, 2000);
  assert.equal(hover.color, "#123456");
  assert.equal(hover.xPercent, 50);
  assert.equal(geometry.paths[0].points[0].x, 0);
  assert.equal(geometry.paths[0].points.at(-1).x, 100);
});

test("entity card air quality metric chips open their own entity more-info dialog", () => {
  const card = new Card();
  let moreInfoDetail = null;
  card.dispatchEvent = event => {
    moreInfoDetail = event.detail;
    return true;
  };
  card.dataset = {
    entityAction: "metric-info",
    entity: "sensor.living_room_co2",
  };

  card._onShadowClick({
    composedPath: () => [card],
    preventDefault() {},
    stopPropagation() {},
  });

  assert.equal(moreInfoDetail.entityId, "sensor.living_room_co2");
});

test("entity card air quality renders custom series colors and hover chip", () => {
  const card = new Card();
  card.setConfig({
    entity: "sensor.air_quality",
    layout: "air_quality",
    air_quality: {
      show_graphs: true,
      pm25: "sensor.pm25",
      graph_colors: { pm25: "#123456" },
    },
  });
  card.hass = {
    states: {
      "sensor.air_quality": {
        entity_id: "sensor.air_quality",
        state: "42",
        attributes: { device_class: "aqi", friendly_name: "Air quality" },
      },
      "sensor.pm25": {
        entity_id: "sensor.pm25",
        state: "14",
        attributes: { device_class: "pm25", unit_of_measurement: "µg/m³" },
      },
    },
  };
  card._aqHistoryCache = {
    entries: [{
      kind: "pm25",
      entityId: "sensor.pm25",
      label: "PM2.5",
      unit: "µg/m³",
      color: "#42a5f5",
      samples: [
        { ts: 1000, value: 10 },
        { ts: 2000, value: 14 },
      ],
    }],
  };
  card._aqHoverPreview = { key: "pm25:1", kind: "pm25", index: 1 };
  card._render();

  const html = String(card.shadowRoot.innerHTML);
  assert.match(html, /data-air-quality-chart="true"/);
  assert.match(html, /entity-card__aq-hover-chip/);
  assert.match(html, /#123456/);
  assert.match(html, /PM2\.5/);
  assert.match(html, /14 µg\/m³/);
  card.isConnected = false;
  card._clearAirQualityHistory?.();
});

test("entity card air quality lets Home Assistant measure its dynamic height", () => {
  const card = new Card();
  card.setConfig({
    entity: "sensor.nodalia_demo_aqi",
    layout: "air_quality",
    air_quality: { show_graphs: false },
  });

  assert.equal(card.getCardSize(), 3);
  assert.equal(card.getGridOptions().rows, "auto");
  assert.equal(card.getGridOptions().columns, 12);

  card.setConfig({
    entity: "sensor.nodalia_demo_aqi",
    layout: "air_quality",
    air_quality: { show_graphs: true },
  });

  assert.equal(card.getCardSize(), 5);
  assert.equal(card.getGridOptions().rows, "auto");
});

test("entity card air quality demo package and example exist", () => {
  const demoPackage = read("examples/entity-card-air-quality-demo-package.yaml");
  assert.match(demoPackage, /default_entity_id:\s*sensor\.nodalia_demo_pm25/);
  assert.match(demoPackage, /state:\s*"\{\{\s*12\s*\}\}"/);
  assert.match(read("examples/entity-card-air-quality.yaml"), /layout:\s*air_quality/);
  assert.match(read("nodalia-entity-card.js"), /layout === "air_quality"/);
  assert.match(read("nodalia-entity-card.js"), /_renderAirQualityLayout/);
  assert.match(read("nodalia-entity-card.js"), /AIR_QUALITY_WHO_BANDS/);
  assert.match(read("nodalia-entity-card.js"), /air_quality\.graph_colors\.\$\{kind\}/);
  assert.match(read("examples/entity-card-air-quality.yaml"), /graph_colors:/);
});
