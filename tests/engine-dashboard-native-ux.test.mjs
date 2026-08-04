import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");

const notifications = read("nodalia-notifications-card.js");
const climate = read("nodalia-climate-card.js");
const utils = read("nodalia-utils.js");
const editorEn = JSON.parse(read("i18n/editor/en.json"));
const runtimeEn = JSON.parse(read("i18n/runtime/en.json"));

test("shared utils expose the editor Engine banner helpers", () => {
  assert.match(utils, /renderEditorEngineBannerHtml/);
  assert.match(utils, /renderEditorEngineBannerStyles/);
  assert.match(utils, /engineStatusSignature/);
  assert.match(utils, /\.editor-engine-banner \{/);
});

test("notifications editor loads Engine status and renders the Engine banner", () => {
  assert.match(notifications, /this\._engineStatus = null/);
  assert.match(notifications, /getEditorEngineStatus/);
  assert.match(notifications, /_refreshEngineStatus/);
  assert.match(notifications, /engineBackgroundActive/);
  assert.match(notifications, /editor-engine-banner/);
});

test("notifications editor only renders the legacy background webhook without the Engine", () => {
  const section = notifications.slice(
    notifications.indexOf("ed.notifications.background_mobile_title"),
    notifications.indexOf("ed.notifications.context_section_title"),
  );
  assert.ok(section.includes("ed.notifications.background_mobile_webhook"), "legacy webhook field should still exist");
  const webhookBranch = section.slice(0, section.indexOf("ed.notifications.background_mobile_webhook"));
  assert.match(webhookBranch, /engineBackgroundActive\s*\n?\s*\?\s*""/);
  assert.match(section, /ed\.engine\.offline_hint/);
});

test("notifications card pulls the Engine inbox after a successful background sync", () => {
  assert.match(notifications, /_loadEngineInbox/);
  assert.match(notifications, /listNotificationInbox/);
  assert.match(notifications, /this\._engineInbox = inbox/);
});

test("climate editors switch the schedule section to Engine mode", () => {
  assert.match(climate, /refreshClimateEditorEngineStatus/);
  assert.match(climate, /climateEditorEngineSchedulesActive/);
  assert.match(climate, /renderClimateEditorScheduleSectionHtml/);
  assert.match(climate, /ed\.engine\.climate_managed_hint/);
  assert.match(climate, /editor-engine-banner|renderEditorEngineBannerHtml/);

  const scheduleSection = climate.slice(climate.indexOf("function renderClimateEditorScheduleSectionHtml"));
  const engineBranch = scheduleSection.slice(0, scheduleSection.indexOf("ed.climate.schedule_webhook"));
  assert.match(engineBranch, /if \(engineActive\) \{/);
  assert.match(engineBranch, /week_starts_on|setpoint_schedule_week_starts_on/);
  assert.doesNotMatch(engineBranch, /setpoint_schedule_helper/);

  // Both editor classes must render the shared schedule section instead of inline webhook fields.
  assert.equal(climate.split("renderClimateEditorScheduleSectionHtml(this, config)").length - 1, 2);
  assert.equal(climate.split('this._renderTextField("ed.climate.schedule_webhook"').length - 1, 0);
});

test("climate card exposes Engine override chips on the live card", () => {
  assert.match(climate, /data-climate-action="override-hold"/);
  assert.match(climate, /data-climate-action="override-clear"/);
  assert.match(climate, /setClimateOverride/);
  assert.match(climate, /clearClimateOverride/);
  assert.match(climate, /climate_overrides/);
  assert.match(climate, /climate-card__override-status/);
  assert.match(climate, /override\.activeUntil/);
  assert.match(climate, /\$\{engineOverrideMarkup\}/);
});

test("Engine editor and runtime strings exist in the base catalogs", () => {
  for (const key of [
    "ed.engine.active_title",
    "ed.engine.active_version",
    "ed.engine.managed_hint",
    "ed.engine.offline_hint",
    "ed.engine.climate_managed_hint",
    "ed.engine.health_summary",
    "ed.engine.inbox_synced",
    "ed.climate.override_2h",
    "ed.climate.override_clear",
    "ed.climate.override_active",
  ]) {
    assert.equal(typeof editorEn[key], "string", `missing editor catalog key ${key}`);
    assert.notEqual(editorEn[key], "", `empty editor catalog key ${key}`);
  }
  assert.match(editorEn["ed.engine.active_version"], /\{version\}/);
  assert.match(editorEn["ed.engine.health_summary"], /\{profiles\}.*\{schedules\}.*\{inbox\}/);
  assert.match(editorEn["ed.climate.override_active"], /\{time\}/);

  const override = runtimeEn.climateCard.schedule.override;
  assert.equal(typeof override.hold2h, "string");
  assert.equal(typeof override.clear, "string");
  assert.match(override.activeUntil, /\{time\}/);
});
