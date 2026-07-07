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

function loadNotificationsCardSandbox() {
  const registry = new Map();
  class TestElement {
    constructor() {
      this.isConnected = true;
      this.shadowRoot = null;
    }

    attachShadow() {
      this.shadowRoot = {
        addEventListener() {},
        querySelectorAll() {
          return [];
        },
      };
      return this.shadowRoot;
    }
  }
  const sandbox = {
    console: {
      warn() {},
    },
    customElements: {
      get(tag) {
        return registry.get(tag);
      },
      define(tag, ctor) {
        registry.set(tag, ctor);
      },
    },
    HTMLElement: TestElement,
    window: {
      NodaliaUtils: {
        registerCustomCard() {},
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-notifications-card.js"), sandbox);
  return { sandbox, registry };
}

function backgroundMobileConfigWithMessage(message) {
  return {
    background_mobile: {
      enabled: true,
      webhook: "nodalia_notifications_background_sync",
      chunk_size: 240,
    },
    mobile_notifications: {
      enabled: true,
      entities: ["notify.test_phone"],
    },
    smart_notifications: {
      hot: {
        message,
      },
    },
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

test("notifications background mobile sync rejects configs beyond package chunk capacity", async () => {
  const { sandbox, registry } = loadNotificationsCardSandbox();
  const buildPayload = sandbox.buildBackgroundMobileWebhookPayload;
  assert.equal(typeof buildPayload, "function");

  const basePayload = buildPayload(backgroundMobileConfigWithMessage(""));
  const baseLength = basePayload.chunks.join("").length;
  const maxChunks = 40;
  const chunkSize = 240;
  const fortyChunkMessage = "x".repeat((maxChunks - 1) * chunkSize + 1 - baseLength);
  const acceptedPayload = buildPayload(backgroundMobileConfigWithMessage(fortyChunkMessage));
  assert.equal(acceptedPayload.chunk_count, maxChunks);
  assert.equal(acceptedPayload.chunks.length, maxChunks);

  const tooLargeMessage = "x".repeat(maxChunks * chunkSize + 1 - baseLength);
  assert.throws(
    () => buildPayload(backgroundMobileConfigWithMessage(tooLargeMessage)),
    /exceeds the 40-chunk Home Assistant package capacity/,
  );

  let posted = false;
  sandbox.window.NodaliaUtils.postHomeAssistantWebhook = async () => {
    posted = true;
    return true;
  };
  const Card = registry.get("nodalia-notifications-card");
  const card = new Card();
  card._hass = { user: { is_admin: true } };
  card._config = backgroundMobileConfigWithMessage(tooLargeMessage);

  const ok = await card._syncBackgroundMobileConfig();
  assert.equal(ok, false);
  assert.equal(posted, false);
  assert.equal(card._pendingBackgroundMobileSync, true);
  assert.equal(card._lastBackgroundMobileSyncSignature, "");
});
