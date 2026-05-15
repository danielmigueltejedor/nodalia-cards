/**
 * Merges scripts/data/locale-extra.json into i18n/runtime partial locales (pt/ru/el/zh/ro).
 * Run from repo root: node scripts/apply-locale-extra.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const EXTRA_PATH = path.join(__dirname, "data", "locale-extra.json");
const RUNTIME_DIR = path.join(ROOT, "i18n", "runtime");

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base, override) {
  if (!isObject(base)) {
    return override !== undefined ? override : base;
  }
  if (!isObject(override)) {
    return override !== undefined ? override : base;
  }
  const out = { ...base };
  for (const k of Object.keys(override)) {
    if (isObject(out[k]) && isObject(override[k])) {
      out[k] = deepMerge(out[k], override[k]);
    } else {
      out[k] = override[k];
    }
  }
  return out;
}

const extra = JSON.parse(fs.readFileSync(EXTRA_PATH, "utf8"));
const langs = ["pt", "ru", "el", "zh", "ro"];

for (const lang of langs) {
  const inject = extra[lang];
  if (!inject || typeof inject !== "object") {
    console.error("apply-locale-extra: missing block for", lang);
    process.exit(1);
  }
  const p = path.join(RUNTIME_DIR, `${lang}.json`);
  if (!fs.existsSync(p)) {
    console.error("apply-locale-extra: missing", path.relative(ROOT, p));
    process.exit(1);
  }
  const current = JSON.parse(fs.readFileSync(p, "utf8"));
  const merged = deepMerge(current, inject);
  fs.writeFileSync(p, `${JSON.stringify(merged, null, 2)}\n`);
  console.log("merged locale-extra into", path.relative(ROOT, p));
}

console.log("apply-locale-extra: done. Run: pnpm run i18n:gen-runtime");
