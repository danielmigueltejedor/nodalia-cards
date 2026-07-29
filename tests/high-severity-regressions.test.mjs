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

test("notifications re-check queued delivery and current background sync", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(
    source,
    /async _flushMobileNotifications\(items\)[\s\S]*?_shouldSendMobileNotification\(item\)/,
    "queue drains must re-evaluate current foreground policy",
  );
  assert.match(
    source,
    /_backgroundMobileSuppressesForeground\(\)[\s\S]*?currentSignature === lastSignature/,
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

test("advance vacuum rooms mode never falls through to full-house start", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  const roomsBranch = source.match(
    /if \(this\._activeMode === "rooms" && this\._selectedRoomIds\.length\) \{[\s\S]*?(?=\n      if \(this\._activeMode === "zone")/,
  );
  assert.ok(roomsBranch, "rooms cleaning branch should exist in _runMapAction");
  assert.match(
    roomsBranch[0],
    /throw new Error\("Selected rooms need numeric segment IDs before room cleaning can start\."\)/,
    "non-numeric room selections must error instead of falling through",
  );
  assert.match(roomsBranch[0], /app_segment_clean/);
  assert.doesNotMatch(
    roomsBranch[0],
    /_callVacuumService\("start"\)/,
    "rooms branch must not start a whole-house clean",
  );
});

test("go2rtc display recovery waits for a decoded frame before transport restart", () => {
  const source = read("nodalia-go2rtc-player.js");
  assert.match(source, /this\._hasDecodedFrameOnce = false/);
  assert.match(
    source,
    /if \(this\._hasDecodedFrameOnce && \(this\._socket \|\| this\._peer \|\| this\._mediaSource\)\) \{[\s\S]*_restartTransportForDisplayRecovery/,
  );
  const restartFn = source.match(
    /_restartTransportForDisplayRecovery\(\) \{[\s\S]*?\n  \}/,
  );
  assert.ok(restartFn, "display recovery restart helper should exist");
  assert.doesNotMatch(
    restartFn[0],
    /_startupStartedAt\s*=\s*Date\.now\(\)/,
    "display recovery must not reset the startup error budget",
  );
  assert.match(restartFn[0], /this\._hasDecodedFrameOnce = false/);
});

test("climate popup viewport constraints remain valid CSS functions", () => {
  const source = read("nodalia-climate-card.js");
  assert.doesNotMatch(source, /min\(100vw\s*-\s*\d+px,/);
  assert.match(source, /min\(calc\(100vw - 24px\), 920px\)/);
  assert.match(source, /min\(calc\(100vw - 16px\), 920px\)/);
});
