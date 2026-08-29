import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("editor catalog locale files stay in sync (run scripts/validate-editor-i18n.mjs)", () => {
  const script = path.join(root, "scripts", "validate-editor-i18n.mjs");
  const res = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr || res.stdout);
});

test("runtime locale JSON trees stay valid (run scripts/validate-runtime-i18n.mjs)", () => {
  const script = path.join(root, "scripts", "validate-runtime-i18n.mjs");
  const res = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr || res.stdout);
});

test("runtime and editor catalogs contain no untranslated English gaps", () => {
  const script = path.join(root, "scripts", "translate-all-locale-gaps.mjs");
  const res = spawnSync(process.execPath, [script, "--offline", "--check"], { encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr || res.stdout);
});

test("runtime cards route audited accessibility labels through i18n", () => {
  const cases = [
    ["nodalia-cover-card.js", /_coverCardUi\("decreasePosition"/, /aria-label="Decrease position"/],
    ["nodalia-humidifier-card.js", /_humidifierAria\("decreaseHumidity"/, /aria-label="Decrease humidity"/],
    ["nodalia-climate-card.js", /_climateCardAria\("decreaseTemperature"/, /aria-label="Decrease temperature"/],
    ["nodalia-power-flow-card.js", /_powerFlowUi\("consumptionTotals"/, /aria-label="Consumption totals"/],
    ["nodalia-advance-vacuum-card.js", /utility\?\.mapUnavailable/, />Mapa no disponible</],
  ];

  for (const [file, translatedPattern, hardcodedPattern] of cases) {
    const src = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(src, translatedPattern, `${file} must resolve its audited label through i18n`);
    assert.doesNotMatch(src, hardcodedPattern, `${file} must not keep the audited visible literal`);
  }
});

test("Cover and Calendar visual editors do not bypass catalog keys with English labels", () => {
  const cover = fs.readFileSync(path.join(root, "nodalia-cover-card.js"), "utf8");
  const calendar = fs.readFileSync(path.join(root, "nodalia-calendar-card.js"), "utf8");
  const forbiddenCoverLabels = [
    "Cover entity",
    "Show position chip",
    "Show tilt chip",
    "Show position slider",
    "Show tilt slider",
    "Show stop button",
  ];

  for (const label of forbiddenCoverLabels) {
    assert.doesNotMatch(cover, new RegExp(`_render[A-Za-z]+Field\\(${JSON.stringify(label)}`));
  }
  assert.doesNotMatch(calendar, /_renderTextField\("Title",\s*"title"/);
  assert.match(cover, /_renderCheckboxField\("ed\.cover\.show_position_chip"/);
  assert.match(calendar, /_renderTextField\("ed\.nav\.title",\s*"title"/);
});

test("nodalia-editor-ui embeds editorCatalog for ed.* keys", () => {
  const src = fs.readFileSync(path.join(root, "nodalia-editor-ui.js"), "utf8");
  assert.match(src, /window\.NodaliaI18n\.editorCatalog\s*=/);
  assert.match(src, /EDITOR_CATALOG_JSON/);
  assert.match(src, /rawInput\.startsWith\("ed\."\)/);
  assert.match(src, /\\"ed\.calendar\.visible_range\\"/);
  assert.match(src, /\\"ed\.light\.color_presets_section_title\\"/);
  assert.match(src, /\\"ed\.light\.show_quick_color_presets\\"/);
  assert.match(src, /\\"ed\.light\.show_quick_temperature_presets\\"/);
});
