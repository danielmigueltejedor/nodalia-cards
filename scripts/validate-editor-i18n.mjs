/**
 * Ensures i18n/editor/<lang>.json files share the same key set as en.json (editor catalog).
 * Run: node scripts/validate-editor-i18n.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dir = path.join(root, "i18n", "editor");
const enPath = path.join(dir, "en.json");

if (!fs.existsSync(enPath)) {
  console.warn("validate-editor-i18n: no i18n/editor/en.json — skip.");
  process.exit(0);
}

const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const enKeys = new Set(Object.keys(en));
let failed = false;

for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith(".json") || name === "en.json") {
    continue;
  }
  const p = path.join(dir, name);
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  const keys = new Set(Object.keys(data));
  for (const k of enKeys) {
    if (!keys.has(k)) {
      console.error(`Missing key in ${name}: ${k}`);
      failed = true;
    }
  }
  for (const k of keys) {
    if (!enKeys.has(k)) {
      console.error(`Unknown key in ${name} (not in en.json): ${k}`);
      failed = true;
    }
  }
}

const editorUiPath = path.join(root, "nodalia-editor-ui.js");
if (fs.existsSync(editorUiPath)) {
  const editorUi = fs.readFileSync(editorUiPath, "utf8");
  for (const k of enKeys) {
    if (!editorUi.includes(k)) {
      console.error(`Missing key in nodalia-editor-ui.js (run npm run i18n:gen-editor): ${k}`);
      failed = true;
    }
  }
} else {
  console.warn("validate-editor-i18n: no nodalia-editor-ui.js — skip embedded catalog check.");
}

if (failed) {
  process.exit(1);
}
console.log(
  "validate-editor-i18n: OK —",
  enKeys.size,
  "keys checked across locale files and nodalia-editor-ui.js.",
);
