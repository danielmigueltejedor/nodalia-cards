import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
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
