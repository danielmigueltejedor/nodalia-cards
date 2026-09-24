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
    ["nodalia-cover-card.js", /_coverCardUi\("open"/, /aria-label="Open"/],
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

test("Weblate docs exist and locale inventories stay aligned", () => {
  assert.equal(fs.existsSync(path.join(root, "crowdin.yml")), false);
  assert.equal(fs.existsSync(path.join(root, ".crowdin.yml")), false);
  assert.equal(fs.existsSync(path.join(root, "docs", "weblate", "README.md")), true);
  assert.equal(fs.existsSync(path.join(root, "docs", "weblate", "docker-compose.yml")), true);
  assert.equal(fs.existsSync(path.join(root, "docs", "weblate", ".env.example")), true);

  const listJson = dir =>
    fs.readdirSync(path.join(root, "i18n", dir))
      .filter(name => name.endsWith(".json"))
      .sort();

  const runtimeLocales = listJson("runtime");
  const editorLocales = listJson("editor");
  assert.deepEqual(runtimeLocales, editorLocales, "runtime and editor must expose the same locale files");
  assert.ok(runtimeLocales.includes("en.json"), "English source locale must exist");

  for (const name of runtimeLocales) {
    const runtime = JSON.parse(fs.readFileSync(path.join(root, "i18n", "runtime", name), "utf8"));
    const editor = JSON.parse(fs.readFileSync(path.join(root, "i18n", "editor", name), "utf8"));
    assert.equal(typeof runtime, "object");
    assert.equal(typeof editor, "object");
    assert.ok(runtime && !Array.isArray(runtime));
    assert.ok(editor && !Array.isArray(editor));
  }

  const enRuntime = JSON.parse(fs.readFileSync(path.join(root, "i18n", "runtime", "en.json"), "utf8"));
  const enEditor = JSON.parse(fs.readFileSync(path.join(root, "i18n", "editor", "en.json"), "utf8"));
  assert.ok(Object.keys(enRuntime).length > 0, "English runtime catalog must not be empty");
  assert.ok(Object.keys(enEditor).length > 0, "English editor catalog must not be empty");
  assert.ok(
    Object.keys(enEditor).every(key => key.startsWith("ed.")),
    "English editor keys must use the ed.* schema",
  );
});
