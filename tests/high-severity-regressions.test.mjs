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

test("fav card requires manual PIN when alarm code input is visible", () => {
  const source = read("nodalia-fav-card.js");
  assert.match(source, /const requiresManualPin = this\._shouldShowAlarmCodeInput\(state\);/);
  assert.match(source, /const manualCode = String\(this\._alarmCodeInput \|\| ""\)\.trim\(\);/);
  assert.match(source, /if \(requiresManualPin && !manualCode\) \{[\s\S]*?return;/);
  assert.match(source, /const code = requiresManualPin \? manualCode : this\._getAlarmCodeValue\(state\);/);
});

test("fav card preserves Lovelace service targets for tap actions", () => {
  const source = read("nodalia-fav-card.js");
  assert.match(source, /tap_service_target/);
  assert.match(source, /serviceTargetKey: "tap_service_target"/);
  assert.match(source, /_callConfiguredService\(serviceValue, entityId = this\._config\?\.entity, rawData = "", rawTarget = ""\)/);
  assert.match(source, /const hasExplicitTarget = Object\.keys\(target\)\.length > 0;/);
  assert.match(source, /invoke\(this, this\._hass, domain, service, payload, hasExplicitTarget \? target : null\)/);
});

test("entity card strict service actions gate built-in domain invocations", () => {
  const source = read("nodalia-entity-card.js");
  assert.match(source, /_invokeEntityService\(domain, service, entityId, serviceData = \{\}\) \{[\s\S]*?const serviceValue = `\$\{domain\}\.\$\{service\}`;/);
  assert.match(source, /if \(!this\._isServiceAllowed\(serviceValue\)\) \{[\s\S]*?warnStrictServiceDenied\?\.\("Nodalia Entity Card", serviceValue\);[\s\S]*?return Promise\.resolve\(false\);/);
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
