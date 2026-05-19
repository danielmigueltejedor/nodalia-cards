/**
 * Fills de/fr/it/nl/pt/ru/el/ro on editor catalog shards for ed.entity, ed.fan, ed.fav,
 * ed.humidifier, ed.insignia, ed.light, ed.media_player, ed.nav, ed.power_flow.
 *
 * - Prefills from scripts/editor-extra-locale-by-en.json (exact English match).
 * - For each unique English string, requests all still-missing langs in parallel (gtx).
 * - Persists a local cache at scripts/.editor-catalog-translate-cache.json to resume.
 *
 * Usage: node scripts/fill-editor-catalog-prefix-locales.mjs
 * Then:  node scripts/merge-editor-catalog-additions.mjs && node scripts/validate-editor-i18n.mjs && node scripts/gen-editor-ui.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const PREFIXES = [
  "ed.entity",
  "ed.person",
  "ed.vacuum",
  "ed.fan",
  "ed.fav",
  "ed.humidifier",
  "ed.insignia",
  "ed.light",
  "ed.media_player",
  "ed.nav",
  "ed.power_flow",
];
const TARGET_LANGS = ["de", "fr", "it", "nl", "pt", "ru", "el", "ro"];

const CACHE_PATH = path.join(root, "scripts", ".editor-catalog-translate-cache.json");

function sortTopLevelKeys(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((acc, k) => {
      acc[k] = obj[k];
      return acc;
    }, {});
}

async function gtxTranslate(text, tl) {
  const u = new URL("https://translate.googleapis.com/translate_a/single");
  u.searchParams.set("client", "gtx");
  u.searchParams.set("sl", "en");
  u.searchParams.set("tl", tl);
  u.searchParams.set("dt", "t");
  u.searchParams.set("q", text);
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(u, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NodaliaEditorCatalogFill/1.0)",
        },
      });
      if (!res.ok) {
        lastErr = new Error(`${res.status} ${res.statusText}`);
        await new Promise(r => setTimeout(r, 350 * attempt));
        continue;
      }
      const data = await res.json();
      let out = "";
      for (const part of data[0] || []) {
        if (part && part[0]) {
          out += part[0];
        }
      }
      return out || text;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 350 * attempt));
    }
  }
  console.warn("translate fallback EN:", tl, String(text).slice(0, 60), lastErr?.message);
  return text;
}

function loadJsonSafe(p, fallback) {
  try {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  } catch (_e) {
    // ignore
  }
  return fallback;
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}

function cacheKey(en, lang) {
  return `${en}\u0000${lang}`;
}

function loadExtraByEn() {
  const p = path.join(root, "scripts", "editor-extra-locale-by-en.json");
  return loadJsonSafe(p, {});
}

function collectNeeds() {
  const extraByEn = loadExtraByEn();
  const dataDir = path.join(root, "scripts", "data");
  const files = fs
    .readdirSync(dataDir)
    .filter(n => n.startsWith("editor-catalog-") && n.endsWith(".json"))
    .sort();

  /** @type {Map<string, Set<string>>} en -> set of langs */
  const byEn = new Map();

  for (const name of files) {
    const catalog = JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
    for (const [key, triple] of Object.entries(catalog)) {
      if (typeof triple !== "object" || triple === null || typeof triple.en !== "string") {
        continue;
      }
      if (!PREFIXES.some(pre => key.startsWith(`${pre}.`))) {
        continue;
      }
      const en = triple.en;
      for (const lang of TARGET_LANGS) {
        if (triple[lang]) {
          continue;
        }
        if (!byEn.has(en)) {
          byEn.set(en, new Set());
        }
        byEn.get(en).add(lang);
      }
    }
  }

  return { extraByEn, dataDir, files, byEn };
}

const { extraByEn, dataDir, files, byEn } = collectNeeds();
const uniqueEn = [...byEn.keys()];
console.log("Unique English strings needing any fill:", uniqueEn.length);

const cache = loadJsonSafe(CACHE_PATH, {});

let filledFromExtra = 0;
let filledFromCache = 0;
let gtxCalls = 0;

for (const en of uniqueEn) {
  const langs = [...byEn.get(en)];
  for (const lang of langs) {
    const ck = cacheKey(en, lang);
    const row = extraByEn[en];
    if (row && typeof row === "object" && typeof row[lang] === "string" && row[lang].trim()) {
      cache[ck] = row[lang];
      filledFromExtra++;
      continue;
    }
    if (cache[ck]) {
      filledFromCache++;
    }
  }
}

const pendingByEn = new Map();
for (const en of uniqueEn) {
  const langs = [...byEn.get(en)].filter(lang => !cache[cacheKey(en, lang)]);
  if (langs.length) {
    pendingByEn.set(en, langs);
  }
}

const pendingPairs = [...pendingByEn.entries()].reduce((n, [, langs]) => n + langs.length, 0);
console.log("Prefill extra map:", filledFromExtra, "| resume cache hits:", filledFromCache, "| remaining pairs:", pendingPairs);

let wave = 0;
for (const [en, langs] of pendingByEn.entries()) {
  await Promise.all(
    langs.map(async lang => {
      const ck = cacheKey(en, lang);
      const t = await gtxTranslate(en, lang);
      cache[ck] = t;
      gtxCalls++;
    }),
  );
  wave++;
  if (wave % 25 === 0 || wave === pendingByEn.size) {
    console.log(`  gtx waves ${wave}/${pendingByEn.size} (requests ~${gtxCalls})`);
    saveCache(cache);
  }
  await new Promise(r => setTimeout(r, 55));
}

saveCache(cache);
console.log("Total gtx HTTP calls:", gtxCalls);

let patchedFiles = 0;
let patchedEntries = 0;

for (const name of files) {
  const filePath = path.join(dataDir, name);
  const catalog = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let touched = false;

  for (const [key, triple] of Object.entries(catalog)) {
    if (typeof triple !== "object" || triple === null || typeof triple.en !== "string") {
      continue;
    }
    if (!PREFIXES.some(pre => key.startsWith(`${pre}.`))) {
      continue;
    }
    const en = triple.en;
    for (const lang of TARGET_LANGS) {
      if (triple[lang]) {
        continue;
      }
      const text = cache[cacheKey(en, lang)] ?? en;
      triple[lang] = text;
      touched = true;
      patchedEntries++;
    }
  }

  if (touched) {
    fs.writeFileSync(filePath, `${JSON.stringify(sortTopLevelKeys(catalog), null, 2)}\n`);
    patchedFiles++;
  }
}

console.log("Wrote", patchedFiles, "catalog file(s);", patchedEntries, "field(s) set.");
