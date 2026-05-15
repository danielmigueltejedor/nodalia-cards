/**
 * Merges advanceVacuum + vacuumSimple from scripts/data/locale-vacuum-packs.json
 * into i18n/runtime for pt/ru/el/zh/ro. Idempotent per locale (deep merge).
 * Run from repo root: node scripts/prepend-locale-vacuum.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PACKS = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "locale-vacuum-packs.json"), "utf8"));
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

const langs = ["pt", "ru", "el", "zh", "ro"];

for (const lang of langs) {
  const slice = PACKS[lang];
  if (!slice?.advanceVacuum || !slice?.vacuumSimple) {
    console.error("prepend-locale-vacuum: bad PACK for", lang);
    process.exit(1);
  }
  const p = path.join(RUNTIME_DIR, `${lang}.json`);
  const current = JSON.parse(fs.readFileSync(p, "utf8"));
  const merged = deepMerge(current, {
    advanceVacuum: slice.advanceVacuum,
    vacuumSimple: slice.vacuumSimple,
  });
  fs.writeFileSync(p, `${JSON.stringify(merged, null, 2)}\n`);
  console.log("merged vacuum pack into", path.relative(ROOT, p));
}

console.log("prepend-locale-vacuum: done. Run: pnpm run i18n:gen-runtime");
