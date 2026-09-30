import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";

const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("nodalia-utils.js", "utf8"), sandbox);
vm.runInContext(buildSync({ entryPoints: ["src/cards/climate/climate-editor.ts"], bundle: true, write: false, format: "iife", globalName: "api" }).outputFiles[0].text, sandbox);
const render = sandbox.api.renderClimateEditorScheduleSectionHtml;
function editor(engine) {
  return {
    _engineStatus: engine,
    _editorLabel: key => key,
    _renderTextField: (_label, field, value) => `<input name="${field}" value="${value}">`,
    _renderSelectField: (_label, field, value) => `<select name="${field}">${value}</select>`,
    _renderCheckboxField: (_label, field, checked) => `<input name="${field}" type="checkbox" checked="${checked}">`,
  };
}
const config = { setpoint_schedule_webhook: "my_webhook", setpoint_schedule_helper: "input_text.schedule", setpoint_schedule_week_starts_on: "sunday", security: { allow_webhooks_for_non_admin: true } };

test("Climate editor keeps populated legacy schedule fields without an available schedule Engine", () => {
  for (const engine of [null, { available: false, caps: { climateSchedules: true } }, { available: true, caps: { climateSchedules: false } }]) {
    const html = render(editor(engine), config);
    assert.match(html, /name="setpoint_schedule_webhook" value="my_webhook"/);
    assert.match(html, /name="setpoint_schedule_helper" value="input_text.schedule"/);
    assert.match(html, /name="setpoint_schedule_week_starts_on">sunday/);
    assert.match(html, /name="security.allow_webhooks_for_non_admin" type="checkbox" checked="true"/);
    assert.match(html, /ed.engine.offline_hint/);
  }
});

test("Climate editor delegates schedules to the available Engine and retains week selection", () => {
  const html = render(editor({ available: true, version: "2.0.2", caps: { climateSchedules: true } }), config);
  assert.match(html, /editor-engine-banner/);
  assert.match(html, /name="setpoint_schedule_week_starts_on">sunday/);
  assert.doesNotMatch(html, /name="setpoint_schedule_(webhook|helper)"/);
  assert.doesNotMatch(html, /name="security.allow_webhooks_for_non_admin"/);
  assert.doesNotMatch(html, /ed.engine.offline_hint/);
});
