import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function loadNotificationsCardClass({ postHomeAssistantWebhook } = {}) {
  const registry = new Map();
  class FakeHTMLElement {
    constructor() {
      this.isConnected = true;
    }

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
    clearTimeout,
    console,
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
      addEventListener() {},
      removeEventListener() {},
      documentElement: { getAttribute() { return ""; } },
      querySelector() { return null; },
    },
    HTMLElement: FakeHTMLElement,
    localStorage: {
      getItem() { return null; },
      setItem() {},
    },
    setTimeout,
    window: null,
  };
  sandbox.window = sandbox;
  sandbox.window.NodaliaUtils = {
    postHomeAssistantWebhook,
    registerCustomCard() {},
  };
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-notifications-card.js"), sandbox);
  return registry.get("nodalia-notifications-card");
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

test("notifications background mobile rejects configs beyond package chunk capacity", async () => {
  const source = read("nodalia-notifications-card.js");
  const example = read("examples/notifications-background-mobile-package.yaml");
  assert.match(source, /BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS = 40/);
  assert.match(source, /chunks\.length > BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS/);
  assert.match(example, /\(chunks \| count\) <= 40/);

  let postCount = 0;
  const NotificationsCard = loadNotificationsCardClass({
    postHomeAssistantWebhook: async () => {
      postCount += 1;
      return true;
    },
  });

  const card = new NotificationsCard();
  card._hass = { user: { is_admin: true } };
  card.setConfig({
    background_mobile: {
      enabled: true,
      webhook: "nodalia_notifications_background_sync",
      chunk_size: 120,
    },
    mobile_notifications: {
      enabled: true,
      entities: ["notify.phone"],
    },
    smart_entity_overrides: Array.from({ length: 100 }, (_, index) => ({
      entity: `sensor.oversized_${index}`,
      title: `Oversized ${index}`,
      message: "x".repeat(220),
      mobile: "on",
    })),
  });

  const ok = await card._syncBackgroundMobileConfig();
  assert.equal(ok, false);
  assert.equal(postCount, 0);
  assert.equal(card._pendingBackgroundMobileSync, true);
  assert.equal(card._lastBackgroundMobileSyncSignature, "");
});
