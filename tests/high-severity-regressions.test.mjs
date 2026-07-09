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

test("notifications background mobile sync rejects configs beyond package chunk capacity", () => {
  const source = read("nodalia-notifications-card.js");
  const backgroundPackage = read("examples/notifications-background-mobile-package.yaml");
  assert.match(source, /const BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS = 40;/);
  assert.match(
    source,
    /if \(chunks\.length > BACKGROUND_MOBILE_MAX_CONFIG_CHUNKS\) \{[\s\S]*?throw new Error\(/,
    "payload builder must reject configs the package cannot persist",
  );
  assert.match(
    source,
    /try \{[\s\S]*?payload = this\._buildBackgroundMobileWebhookPayload\(\);[\s\S]*?\} catch \(error\) \{[\s\S]*?this\._pendingBackgroundMobileSync = true;[\s\S]*?return false;[\s\S]*?\}[\s\S]*?const signature = `\$\{webhookId\}:\$\{payload\.config_hash\}:\$\{payload\.chunk_count\}`;/,
    "card sync should not post or mark signatures when the payload is oversized",
  );
  assert.match(
    source,
    /try \{[\s\S]*?payload = buildBackgroundMobileWebhookPayload\(normalized\);[\s\S]*?\} catch \(error\) \{[\s\S]*?return false;[\s\S]*?\}[\s\S]*?const signature = `\$\{webhookId\}:\$\{payload\.config_hash\}:\$\{payload\.chunk_count\}`;/,
    "editor sync should not post or mark signatures when the payload is oversized",
  );
  assert.match(
    backgroundPackage,
    /conditions:[\s\S]*?value_template: "\{\{ \(trigger\.json\.chunks \| default\(\[\], true\) \| count\) <= 40 \}\}"[\s\S]*?actions:/,
    "package webhook should reject direct posts that exceed the 40 stored helper chunks",
  );
});
