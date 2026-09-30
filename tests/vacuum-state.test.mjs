import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";

function loadVacuum() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ["nodalia-utils.js", "nodalia-i18n.js"]) {
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox);
  }
  const source = buildSync({ entryPoints: ["src/cards/vacuum/vacuum-config.ts", "src/cards/vacuum/vacuum-helpers.ts"], bundle: true, write: false, outdir: "out", format: "iife", globalName: "api" });
  for (const file of source.outputFiles) {
    vm.runInContext(file.text, sandbox);
    if (file.path.includes("config")) sandbox.config = sandbox.api;
    else sandbox.helpers = sandbox.api;
  }
  return sandbox;
}
const plain = value => JSON.parse(JSON.stringify(value));

test("Charger Disconnected is localized as both a reported state and an error in every shipped language", () => {
  const { NodaliaI18n: i18n } = loadVacuum();
  for (const lang of ["en", "es", "de", "fr", "it", "nl", "no", "pt", "ro", "ru", "el", "zh"]) {
    const labels = JSON.parse(fs.readFileSync(`i18n/runtime/${lang}.json`, "utf8"));
    const expected = labels.advanceVacuum.reportedStates.charger_disconnected;
    assert.ok(expected);
    for (const raw of ["charger_disconnected", "Charger Disconnected", "charger-disconnected"]) {
      assert.equal(i18n.translateAdvanceVacuumReportedState(null, lang, raw, raw), expected);
      assert.equal(i18n.translateVacuumErrorState(null, lang, raw, raw), expected);
    }
  }
  assert.equal(i18n.translateAdvanceVacuumReportedState(null, "es", "custom_status", "Custom Status"), "Custom Status");
  assert.equal(i18n.translateVacuumErrorState(null, "es", "charging_error"), "Error de carga");
});

test("Vacuum checked configuration retains YAML extensions and rejects invalid CSS branches", () => {
  const { config: api } = loadVacuum();
  for (const raw of [null, true, 7, "bad", [], { styles: null }, { styles: { icon: true, card: 3 } }]) {
    const result = api.normalizeConfig(raw);
    assert.deepEqual(plain(result.styles), plain(api.DEFAULT_CONFIG.styles));
    assert.equal(result.security.strict_service_actions, true);
    assert.deepEqual(plain(result.fan_presets), []);
  }
  const raw = {
    fan_presets: [" silent ", null, "turbo"], hidden_suction_modes: " gentle, ,balanced ",
    hidden_mop_modes: ["low", " off "], entity_picture: " /local/robot.png ", show_entity_picture: true,
    hold_action: "MORE-INFO", icon_hold_action: "navigate", icon_hold_navigation_path: " /lovelace/robot ",
    security: { allowed_services: [" VACUUM.START "], strict_service_actions: true },
    styles: { card: { padding: "18px", background: "red;display:none" }, icon: { active_color: "rgba(20, 40, 60, 0.2)" } },
    extension: { preserved: true },
  };
  const before = plain(raw);
  const result = api.normalizeConfig(raw);
  assert.deepEqual(plain(result.fan_presets), ["silent", "turbo"]);
  assert.deepEqual(plain(result.hidden_suction_modes), ["gentle", "balanced"]);
  assert.deepEqual(plain(result.hidden_mop_modes), ["low", "off"]);
  assert.equal(result.hold_action, "more_info");
  assert.equal(result.icon_hold_navigation_path, "/lovelace/robot");
  assert.equal(result.entity_picture, "/local/robot.png");
  assert.equal(result.styles.card.padding, "18px");
  assert.equal(result.styles.card.background, api.DEFAULT_CONFIG.styles.card.background);
  assert.equal(result.styles.icon.active_color, "rgba(20, 40, 60, 0.2)");
  assert.deepEqual(plain(result.security.allowed_services), ["vacuum.start"]);
  result.extension.preserved = false;
  assert.deepEqual(plain(raw), before);
  assert.equal(api.normalizeConfig({ hold_action: "unknown", icon_hold_action: "unknown" }).hold_action, "none");
  assert.deepEqual(plain(api.normalizeConfig({ fan_presets: "quiet,turbo" }).fan_presets), []);
});

test("Vacuum helper ownership favors the same device and the longest matching robot id", () => {
  const { helpers } = loadVacuum();
  const vacuumObjectIds = ["roborock_s8", "roborock_s8_pro"];
  assert.equal(helpers.isHelperRelatedToConfiguredVacuum({ candidateId: "sensor.roborock_s8_pro_status", objectId: "roborock_s8", vacuumObjectIds }), false);
  assert.equal(helpers.isHelperRelatedToConfiguredVacuum({ candidateId: "sensor.roborock_s8_pro_status", objectId: "roborock_s8_pro", vacuumObjectIds }), true);
  assert.equal(helpers.isHelperRelatedToConfiguredVacuum({ candidateId: "sensor.other_status", objectId: "roborock_s8", isSameDevice: true, vacuumObjectIds }), true);
  assert.deepEqual(plain(helpers.listVacuumObjectIds({ "vacuum.robot": {}, "sensor.robot": {} })), ["robot"]);
  const config = { entity: "", name: "" };
  helpers.applyStubEntity(config, { states: { "vacuum.robot": { entity_id: "vacuum.robot", state: "docked", attributes: { friendly_name: "Robot" } } } }, ["vacuum"]);
  assert.equal(config.entity, "vacuum.robot");
  assert.equal(config.name, "Robot");
});
