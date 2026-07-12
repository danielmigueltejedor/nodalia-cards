import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function loadNotificationsCardTestApi() {
  const source = read("nodalia-notifications-card.js");
  const registry = new Map();
  class TestHTMLElement {
    constructor() {
      this.isConnected = true;
      this.shadowRoot = null;
    }

    attachShadow() {
      this.shadowRoot = {
        addEventListener() {},
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
    CustomEvent: class {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    HTMLElement: TestHTMLElement,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    window: {
      NodaliaUtils: {
        registerCustomCard() {},
        normalizeSecurityConfig(config, defaults) {
          return { ...(defaults || {}), ...(config || {}) };
        },
        applyDefaultConfigNameFromEntity() {},
        clearDeferTimers() {},
      },
      addEventListener() {},
      removeEventListener() {},
      clearTimeout() {},
      setTimeout() { return 0; },
    },
    customElements: {
      get(name) {
        return registry.get(name);
      },
      define(name, element) {
        registry.set(name, element);
      },
    },
    document: {
      addEventListener() {},
      removeEventListener() {},
      createElement() { return {}; },
    },
  };
  sandbox.window.customElements = sandbox.customElements;
  vm.createContext(sandbox);
  vm.runInContext(
    `${source}\nwindow.__nodaliaNotificationsTest = { BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS, buildBackgroundMobileWebhookPayload, normalizeConfig, NodaliaNotificationsCard };`,
    sandbox,
  );
  return sandbox.window.__nodaliaNotificationsTest;
}

test("fav card routes cover and lock auto taps through domain services", () => {
  const source = read("nodalia-fav-card.js");
  assert.match(source, /applyCardTapActionField/);
  assert.match(source, /_toggleCoverEntity\(/);
  assert.match(source, /_toggleLockEntity\(/);
  assert.match(source, /case "auto":[\s\S]*_usesDomainToggleService\(state\)/);
  assert.match(source, /domain === "cover"[\s\S]*_toggleCoverEntity/);
  assert.match(source, /domain === "lock"[\s\S]*_toggleLockEntity/);
});

test("entity and fav cards unlock locked locks instead of opening them on toggle", () => {
  for (const file of ["nodalia-entity-card.js", "nodalia-fav-card.js"]) {
    const source = read(file);
    assert.match(
      source,
      /if \(stateKey === "locked"\) \{[\s\S]*?_invokeEntityService\("lock", "unlock", entityId\);[\s\S]*?return;/,
      `${file} should call lock.unlock for locked state`,
    );
    assert.doesNotMatch(
      source,
      /if \(stateKey === "locked"\) \{[\s\S]*?lock", "open"/,
      `${file} should not call lock.open for generic locked toggle`,
    );
  }
});

test("alarm panel keeps PIN watchdog armed after resolved service calls", () => {
  const source = read("nodalia-alarm-panel-card.js");
  assert.match(source, /this\._pinVerifyWatch = \{/);
  assert.match(source, /st\.state !== w\.snapState \|\| st\.last_changed !== w\.snapLc/);
  assert.match(
    source,
    /Promise\.resolve\(invoke\(this, this\._hass, "alarm_control_panel", service, payload\)\)[\s\S]*?\.catch\(/,
  );
  assert.doesNotMatch(
    source,
    /Promise\.resolve\(invoke\(this, this\._hass, "alarm_control_panel", service, payload\)\)[\s\S]*?\.then\([\s\S]*?_clearPinVerifyWatch/,
    "resolved alarm service calls must not clear the PIN watchdog early",
  );
});

test("climate schedule composer blocks oversized storage_state before webhook delivery", () => {
  const source = read("nodalia-climate-card.js");
  assert.match(source, /function isSetpointScheduleStorageStateWithinLimit/);
  assert.match(
    source,
    /if \(!isSetpointScheduleStorageStateWithinLimit\(body\.storage_state\)\) \{[\s\S]*?return;[\s\S]*?this\._scheduleComposerSaving = true;/,
    "storage guard should run before saving/webhook dispatch",
  );
  assert.match(source, /errors\.storageTooLarge/);
});

test("notifications background mobile sync rejects configs larger than package storage", () => {
  const api = loadNotificationsCardTestApi();
  const entities = Array.from({ length: 90 }, (_item, index) => `sensor.background_${index}`);
  assert.throws(
    () => api.buildBackgroundMobileWebhookPayload({
      background_mobile: { enabled: true, chunk_size: 240 },
      mobile_notifications: { enabled: true, entities: ["notify.mobile"] },
      temperature_entities: entities,
      smart_entity_overrides: entities.map(entity => ({
        entity,
        title: `Long alert title for ${entity}`,
        message: "This message deliberately makes the synced JSON exceed the forty helper chunks available in the package.",
      })),
    }),
    /stores at most 40/,
  );

  const smallPayload = api.buildBackgroundMobileWebhookPayload({
    background_mobile: { enabled: true, chunk_size: 240 },
    mobile_notifications: { enabled: true, entities: ["notify.mobile"] },
    temperature_entities: ["sensor.background_ok"],
  });
  assert.ok(smallPayload.chunk_count <= api.BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS);
});

test("notifications smart entity mobile policy inherits kind policy unless explicitly overridden", () => {
  const api = loadNotificationsCardTestApi();
  const card = new api.NodaliaNotificationsCard();
  card._config = api.normalizeConfig({
    smart_notifications: {
      hot: { mobile: "off" },
      cold: { mobile: "off" },
    },
    smart_entity_overrides: [
      { entity: "sensor.kitchen", title: "Kitchen", mobile: "inherit" },
      { entity: "sensor.attic", title: "Attic", mobile: "on" },
    ],
  });

  assert.equal(card._smartConfig("hot", "sensor.kitchen").mobile, "off");
  assert.equal(card._smartConfig("cold", "sensor.attic").mobile, "on");
});

test("notifications background package guards chunk capacity and effective mobile policy", () => {
  const source = read("examples/notifications-background-mobile-package.yaml");
  assert.match(source, /\(chunks \| count\) <= 40/);
  assert.match(source, /effective_mobile: "{{ override_mobile if override_mobile in \['on', 'off'\] else smart_mobile }}"/);
  assert.match(source, /effective_mobile != 'off' and \(notify_cfg\.get\('enabled', false\) or effective_mobile == 'on'\)/);
});
