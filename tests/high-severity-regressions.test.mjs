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

function loadNotificationsCard() {
  let CardClass = null;
  const sandbox = {
    URL,
    Date,
    setTimeout,
    clearTimeout,
    window: {},
    customElements: {
      define(_tag, ctor) {
        if (!CardClass && typeof ctor === "function" && ctor.name === "NodaliaNotificationsCard") {
          CardClass = ctor;
        }
      },
      get() {
        return null;
      },
    },
    HTMLElement: class {
      constructor() {
        this.isConnected = true;
        this.shadowRoot = null;
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

      addEventListener() {}
      removeEventListener() {}
      dispatchEvent() { return true; }
    },
    MutationObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    document: {
      addEventListener() {},
      removeEventListener() {},
      visibilityState: "visible",
    },
    console,
    globalThis: {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-notifications-mobile-policy.js"), sandbox);
  vm.runInContext(read("nodalia-notifications-card.js"), sandbox);
  assert.ok(CardClass, "NodaliaNotificationsCard should register");
  return CardClass;
}

function loadClimateCard() {
  const registry = new Map();
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
      createElement() { return {}; },
      documentElement: { getAttribute() { return ""; } },
      querySelector() { return null; },
    },
    HTMLElement: class {
      attachShadow() {
        this.shadowRoot = {
          addEventListener() {},
          innerHTML: "",
          querySelector() { return null; },
          querySelectorAll() { return []; },
        };
        return this.shadowRoot;
      }

      dispatchEvent() { return true; }
    },
    navigator: {},
    setTimeout,
    window: null,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-climate-card.js"), sandbox);
  const CardClass = registry.get("nodalia-climate-card");
  assert.ok(CardClass, "NodaliaClimateCard should register");
  return { CardClass, sandbox };
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

test("native climate schedules bypass helper limits while legacy webhook remains guarded", () => {
  const source = read("nodalia-climate-card.js");
  assert.match(source, /function isSetpointScheduleStorageStateWithinLimit/);
  assert.match(
    source,
    /backend\.setClimateSchedule[\s\S]*?return;[\s\S]*?buildClimateSetpointScheduleWebhookBody/,
    "native persistence should complete before constructing the compact legacy helper payload",
  );
  assert.match(
    source,
    /if \(!isSetpointScheduleStorageStateWithinLimit\(body\.storage_state\)\) \{[\s\S]*?return;[\s\S]*?_postScheduleWebhookPayload/,
    "the helper size guard should still run before legacy webhook dispatch",
  );
  assert.match(source, /errors\.storageTooLarge/);
});

test("notifications re-check queued delivery and current background sync", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(
    source,
    /async _flushMobileNotifications\(items\)[\s\S]*?_shouldSendMobileNotification\(item\)/,
    "queue drains must re-evaluate current foreground policy",
  );
  assert.match(
    source,
    /_backgroundMobileSuppressesForeground\(\)[\s\S]*?(?:currentSignature === lastSignature|nativeSignature === currentNative\.signature)/,
    "foreground suppression must match the current successful background payload",
  );
  assert.match(
    source,
    /background mobile config exceeds[\s\S]*?_lastBackgroundMobileSyncSignature = ""/,
    "oversized background payloads must clear stale success",
  );
});

test("notifications preserve allow_webhooks_for_non_admin through config normalization", () => {
  const CardClass = loadNotificationsCard();
  const instance = new CardClass();
  instance.setConfig({
    security: {
      allow_webhooks_for_non_admin: true,
    },
    background_mobile: {
      enabled: true,
      webhook: "nodalia_notifications_background_sync",
    },
  });
  assert.equal(
    instance._config.security.allow_webhooks_for_non_admin,
    true,
    "non-admin webhook opt-in must not be stripped by normalizeSecurityConfig defaults",
  );
});

test("vacuum primary controls are never blocked by strict configured-action security", () => {
  const source = read("nodalia-vacuum-card.js");
  assert.doesNotMatch(source, /_callUserVacuumService|_isServiceAllowed/);
  for (const service of ["start", "pause", "stop", "return_to_base", "locate", "set_fan_speed", "clean_area"]) {
    assert.match(
      source,
      new RegExp(`_callService\\("${service}"`),
      `vacuum.${service} should use the card-owned service path`,
    );
  }
});

test("go2rtc display recovery cannot interrupt initial negotiation or reset its error budget", () => {
  const source = read("nodalia-go2rtc-player.js");
  assert.match(source, /this\._hasDecodedFrameOnce && !hasDecodedFrame/);
  assert.match(source, /_markLoaded\(\) \{[\s\S]*?this\._hasDecodedFrameOnce = true;/);
  const restartStart = source.indexOf("  _restartTransportForDisplayRecovery() {");
  const restartEnd = source.indexOf("\n  _handleVideoVolumeChange()", restartStart);
  const restart = source.slice(restartStart, restartEnd);
  assert.doesNotMatch(restart, /_startupStartedAt\s*=/);
});

test("advanced vacuum rooms mode cannot fall through to whole-house cleaning", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  assert.match(
    source,
    /if \(this\._activeMode === "rooms"\) \{[\s\S]*?if \(!roomIds\.length\) \{[\s\S]*?throw new Error/,
  );
});

test("climate popup viewport constraints remain valid CSS functions", () => {
  const source = read("nodalia-climate-card.js");
  assert.doesNotMatch(source, /min\(100vw\s*-\s*\d+px,/);
  assert.match(source, /min\(calc\(100vw - 24px\), 920px\)/);
  assert.match(source, /min\(calc\(100vw - 16px\), 920px\)/);
});

test("Engine climate hold preserves dual heat/cool range instead of midpoint temperature", async () => {
  const { CardClass, sandbox } = loadClimateCard();
  const card = new CardClass();
  card.setConfig({ entity: "climate.ecobee" });
  card._hass = {
    states: {
      "climate.ecobee": {
        entity_id: "climate.ecobee",
        state: "heat_cool",
        attributes: {
          hvac_mode: "heat_cool",
          hvac_modes: ["off", "heat", "cool", "heat_cool"],
          target_temp_low: 20,
          target_temp_high: 24,
          min_temp: 10,
          max_temp: 32,
          target_temp_step: 0.5,
        },
      },
    },
  };

  let captured = null;
  sandbox.window.NodaliaBackend = {
    async setClimateOverride(_hass, entityId, override) {
      captured = { entityId, override };
      return { ok: true };
    },
    async status() {
      return { available: true, capabilities: ["climate_overrides"] };
    },
    hasCapability(status, capability) {
      return status?.available === true && status.capabilities?.includes(capability);
    },
    async getClimateSchedule() {
      return { schedule: { enabled: true, slots: [], override: captured?.override || null } };
    },
  };

  const ok = await card._setEngineOverrideHold(2);
  assert.equal(ok, true);
  assert.equal(captured.entityId, "climate.ecobee");
  assert.equal(captured.override.target_temp_low, 20);
  assert.equal(captured.override.target_temp_high, 24);
  assert.equal(captured.override.temperature, undefined);
  assert.equal(typeof captured.override.until, "string");
});

test("Engine inbox dismissals map onto foreground smart alert ids", () => {
  const CardClass = loadNotificationsCard();
  const card = new CardClass();
  card.setConfig({});

  const asSet = ids => new Set(ids);
  assert.deepEqual(
    asSet(card._nativeDismissalIds("comfort:hot:sensor.living_room:fan.living_room:27")),
    asSet(["comfort:hot:sensor.living_room:fan.living_room:27", "hot:sensor.living_room"]),
  );
  assert.deepEqual(
    asSet(card._nativeDismissalIds("comfort:hot:climate:sensor.hall:climate.hall:28")),
    asSet(["comfort:hot:climate:sensor.hall:climate.hall:28", "hot:sensor.hall"]),
  );
  assert.deepEqual(
    asSet(card._nativeDismissalIds("humidity:sensor.bath:high:80")),
    asSet(["humidity:sensor.bath:high:80", "humidity_high:sensor.bath"]),
  );

  const engineKinds = [
    "door:binary_sensor.front",
    "window:binary_sensor.kitchen",
    "motion:binary_sensor.hall",
    "vacuum:vacuum.downstairs",
    "rain:weather.home",
    "media_absence:media_player.living_room",
    "outdoor_hot:sensor.patio",
    "outdoor_cold:sensor.garden",
  ];
  engineKinds.forEach(id => {
    assert.ok(card._nativeDismissalIds(id).includes(id), `${id} should remain a valid Engine identity`);
    assert.ok(card._nativeDismissalIds(`${id}:active`).includes(id), `${id}:state should collapse to the Engine identity`);
  });

  card._mergeNativeDismissed(["hot:sensor.living_room", "humidity_high:sensor.bath", "door:binary_sensor.front"]);
  assert.equal(card._isDismissed({ id: "comfort:hot:sensor.living_room:fan.living_room:27" }), true);
  assert.equal(card._isDismissed({ id: "humidity:sensor.bath:high:80" }), true);
  assert.equal(card._isDismissed({ id: "door:binary_sensor.front:on" }), true);
  assert.equal(card._isDismissed({ id: "comfort:cold:sensor.living_room:18" }), false);
});
