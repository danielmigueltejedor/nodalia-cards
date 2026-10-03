import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { encodeLabelReferences } from "../scripts/editor-translation-packing.mjs";
import { findGeneratedInitializer } from "./helpers/generated-literals.mjs";

const editor = fs.readFileSync(new URL("../nodalia-editor-ui.js", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../nodalia-i18n.js", import.meta.url), "utf8");
function load(source = editor) {
  const context = {};
  context.window = context;
  vm.createContext(context);
  vm.runInContext(runtime, context);
  vm.runInContext(source, context);
  return context.NodaliaI18n;
}
function replaceCatalog(values, keys = ["ed.first", "ed.second", "ed.third", "ed.fourth"]) {
  const node = findGeneratedInitializer(editor, "EDITOR_CATALOG_JSON");
  const data = { langs: ["en"], keys, values: [values] };
  return editor.slice(0, node.getStart()) + JSON.stringify(JSON.stringify(data)) + editor.slice(node.getEnd());
}

test("editor reconstruction preserves prototype-named catalog keys as own data properties", () => {
  const api = load(replaceCatalog(["label"], ["__proto__"]));
  api.editorStr(null, "en", "ed.first");
  assert.ok(Object.hasOwn(api.editorCatalog.en, "__proto__"));
  assert.equal(api.editorCatalog.en.__proto__, "label");
});

test("malformed locale columns cannot produce partial legacy maps", () => {
  const node = findGeneratedInitializer(editor, "ROWS_JSON");
  for (const columns of [[], [["label"]], Array.from({ length: 12 }, () => [0]),
    Array.from({ length: 12 }, (_, index) => index ? ["label"] : [])]) {
    const source = editor.slice(0, node.getStart()) + JSON.stringify(JSON.stringify({ columns })) + editor.slice(node.getEnd());
    const api = load(source);
    assert.throws(() => api.editorStr(null, "en", "Activar animaciones"), /Invalid editor translation data/);
    assert.equal(api.editorUiMaps, null);
  }
});

test("generated editor references round-trip quotes, Unicode, empty labels and the first index", () => {
  const labels = ["", "音楽 \"🪄\"", "", "音楽 \"🪄\""];
  const api = load(replaceCatalog(encodeLabelReferences(labels)));
  api.editorStr(null, "en", "ed.first");
  assert.deepEqual(Object.values(api.editorCatalog.en), labels);
  assert.throws(() => encodeLabelReferences([null]), /strings/);
});

test("editor references reject self, forward, fractional, negative and invalid labels", () => {
  for (const values of [[0], [1, "label"], ["label", -1], ["label", 0.5], ["label", {}], ["label", null]]) {
    const api = load(replaceCatalog(values));
    assert.throws(() => api.editorStr(null, "en", "ed.first"), /Invalid editor translation data/);
  }
});

test("every public editor catalog value equals its source locale including fallback and placeholders", () => {
  const api = load();
  assert.equal(api.editorCatalog, null);
  assert.equal(api.editorUiMaps, null);
  api.editorStr(null, "en", "ed.calendar.visible_range");
  assert.equal(api.editorUiMaps, null, "catalog lookup must not decode legacy rows");
  const base = JSON.parse(fs.readFileSync(new URL("../i18n/editor/en.json", import.meta.url), "utf8"));
  for (const [lang, labels] of Object.entries(api.editorCatalog)) {
    const overlay = JSON.parse(fs.readFileSync(new URL(`../i18n/editor/${lang}.json`, import.meta.url), "utf8"));
    assert.deepEqual(JSON.parse(JSON.stringify(labels)), { ...base, ...overlay }, lang);
  }
});
