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

function loadNotificationInternals() {
  const source = read("nodalia-notifications-card.js");
  const classIndex = source.indexOf("class NodaliaNotificationsCard");
  assert.ok(classIndex > 0, "notifications card class should be present");
  return vm.runInNewContext(
    `${source.slice(0, classIndex)}; ({
      buildBackgroundMobileWebhookPayload,
      BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS,
      BackgroundMobileConfigTooLargeError,
    });`,
    { console, window: { NodaliaUtils: {} } },
  );
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

test("notification background mobile payloads cannot exceed package chunk capacity", () => {
  const {
    buildBackgroundMobileWebhookPayload,
    BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS,
    BackgroundMobileConfigTooLargeError,
  } = loadNotificationInternals();
  assert.equal(BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS, 40);

  const withinLimit = buildBackgroundMobileWebhookPayload({
    background_mobile: { enabled: true, chunk_size: 240 },
    mobile_notifications: { enabled: true, entities: ["notify.mobile_app_phone"] },
    door_entities: Array.from({ length: 12 }, (_, index) => `binary_sensor.door_${index}`),
  });
  assert.ok(withinLimit.chunk_count <= BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS);
  assert.equal(withinLimit.chunks.length, withinLimit.chunk_count);

  assert.throws(
    () => buildBackgroundMobileWebhookPayload({
      background_mobile: { enabled: true, chunk_size: 240 },
      mobile_notifications: { enabled: true, entities: ["notify.mobile_app_phone"] },
      smart_entity_overrides: Array.from({ length: 80 }, (_, index) => ({
        entity: `sensor.background_mobile_override_${index}`,
        title: `Critical background alert ${index}`,
        message: "x".repeat(220),
        tint_color: "rgba(255, 0, 0, 0.85)",
      })),
    }),
    error => error instanceof BackgroundMobileConfigTooLargeError
      && error.chunkCount > BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS
      && error.maxChunks === BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS
      && typeof error.configHash === "string"
      && error.configHash.length > 0,
  );
});

test("notification background sync refuses oversized configs before posting or overwriting helpers", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(source, /const BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS = 40;/);
  assert.match(source, /if \(chunks\.length > BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS\) \{/);
  assert.match(
    source,
    /try \{\s*payload = this\._buildBackgroundMobileWebhookPayload\(\);[\s\S]*?warnBackgroundMobileConfigTooLarge\("Card", error\)[\s\S]*?this\._pendingBackgroundMobileSync = false;[\s\S]*?return false;/,
  );
  assert.match(
    source,
    /try \{\s*payload = buildBackgroundMobileWebhookPayload\(normalized\);[\s\S]*?warnBackgroundMobileConfigTooLarge\("Card editor", error\)[\s\S]*?return false;/,
  );

  const backgroundPackage = read("examples/notifications-background-mobile-package.yaml");
  assert.match(backgroundPackage, /nodalia_notifications_background_config_40: \{ max: 255 \}/);
  assert.match(backgroundPackage, /value_template: "\{\{ \(chunks \| count\) <= 40 \}\}"/);
  assert.match(backgroundPackage, /count: 40/);
});
