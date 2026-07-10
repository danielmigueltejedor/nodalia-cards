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

function loadNotificationsCardHarness() {
  const source = read("nodalia-notifications-card.js");
  const registry = new Map();
  const webhookPosts = [];
  const sandbox = {
    console: {
      warn() {},
      error() {},
      log() {},
    },
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    HTMLElement: class HTMLElement {
      constructor() {
        this.isConnected = true;
      }
      attachShadow() {
        this.shadowRoot = {
          innerHTML: "",
          addEventListener() {},
          removeEventListener() {},
          querySelector() {
            return null;
          },
          querySelectorAll() {
            return [];
          },
        };
        return this.shadowRoot;
      }
    },
    customElements: {
      get(name) {
        return registry.get(name);
      },
      define(name, klass) {
        registry.set(name, klass);
      },
      whenDefined() {
        return Promise.resolve();
      },
    },
    document: {
      visibilityState: "visible",
      addEventListener() {},
      removeEventListener() {},
    },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    window: {
      location: { pathname: "/", search: "", hash: "", origin: "https://ha.test" },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {},
      setTimeout,
      clearTimeout,
      NodaliaUtils: {
        registerCustomCard() {},
        postHomeAssistantWebhook: async (webhookId, payload) => {
          webhookPosts.push({ webhookId, payload });
          return true;
        },
      },
    },
    setTimeout,
    clearTimeout,
  };
  sandbox.window.customElements = sandbox.customElements;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return {
    Card: registry.get("nodalia-notifications-card"),
    Editor: registry.get("nodalia-notifications-card-editor"),
    webhookPosts,
  };
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

test("notifications background mobile sync refuses configs larger than package storage", async () => {
  const { Card, Editor, webhookPosts } = loadNotificationsCardHarness();
  assert.equal(typeof Card, "function");
  assert.equal(typeof Editor, "function");

  const smallConfig = {
    background_mobile: { enabled: true, webhook: "nodalia_notifications_background_sync", chunk_size: 120 },
    mobile_notifications: { enabled: true, services: ["notify.mobile_app_phone"] },
    temperature_entities: ["sensor.temperature_reference"],
  };
  const card = new Card();
  card._config = smallConfig;
  card._hass = { user: { is_admin: true } };
  assert.equal(await card._syncBackgroundMobileConfig(), true);
  assert.equal(webhookPosts.length, 1);

  const oversizedConfig = {
    ...smallConfig,
    temperature_entities: Array.from({ length: 360 }, (_, index) => `sensor.temperature_room_${String(index).padStart(3, "0")}`),
  };
  const oversizedCard = new Card();
  oversizedCard._config = oversizedConfig;
  oversizedCard._hass = { user: { is_admin: true } };
  assert.equal(await oversizedCard._syncBackgroundMobileConfig(), false);
  assert.equal(oversizedCard._pendingBackgroundMobileSync, true);
  assert.equal(oversizedCard._lastBackgroundMobileSyncSignature, "");
  assert.equal(webhookPosts.length, 1, "oversized card sync must not post a payload the package will truncate");

  const editor = new Editor();
  editor._hass = { user: { is_admin: true } };
  assert.equal(await editor._syncBackgroundMobileConfigFromEditor(oversizedConfig), false);
  assert.equal(editor._lastBackgroundMobileSyncSignature, "");
  assert.equal(webhookPosts.length, 1, "oversized editor sync must not post or cache success");

  const source = read("nodalia-notifications-card.js");
  assert.match(source, /const BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS = 40;/);
  assert.match(source, /chunks\.length > BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS/);

  const backgroundPackage = read("examples/notifications-background-mobile-package.yaml");
  assert.match(backgroundPackage, /\(chunks \| count\) <= 40/);
  assert.match(
    backgroundPackage,
    /value_template: "\{\{ \(chunks \| count\) <= 40 \}\}"[\s\S]*?- repeat:\n\s+count: 40/,
    "package should reject oversized payloads before writing fixed chunk helpers",
  );
});
