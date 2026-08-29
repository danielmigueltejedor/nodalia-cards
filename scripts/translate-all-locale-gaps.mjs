/**
 * Audits or fills editor + runtime locale files where values still match English.
 * Fill mode uses Google Translate (gtx) with a local cache. Audit mode is offline.
 * Preserves `code` and {placeholders}.
 *
 * Usage: node scripts/translate-all-locale-gaps.mjs
 * Then:  npm run i18n:gen-runtime && npm run i18n:gen-editor && npm run i18n:validate-*
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { restoreProtectedTranslationValues } from "./translation-token-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const EDITOR_LANGS = ["es", "de", "fr", "it", "nl", "no", "pt", "ru", "el", "zh", "ro"];
const RUNTIME_LANGS = ["es", "de", "fr", "it", "nl", "no", "pt", "ru", "el", "zh", "ro"];

const GTX_TL = {
  es: "es",
  de: "de",
  fr: "fr",
  it: "it",
  nl: "nl",
  no: "no",
  pt: "pt",
  ru: "ru",
  el: "el",
  zh: "zh-CN",
  ro: "ro",
};

const CACHE_PATH = path.join(__dirname, ".translate-all-locale-gaps-cache.json");
const OFFLINE = process.argv.includes("--offline");
const REPORT_GAPS = process.argv.includes("--report-gaps");
const CHECK_GAPS = process.argv.includes("--check");
let offlineMissingPairs = 0;

/** Strings that are intentionally identical in every locale (brand / universal tokens). */
const GLOBAL_IDENTICAL = new Set([
  "Nodalia Alarm Panel Card",
  "Nodalia Cover Card",
  "Nodalia Person Card",
  "Nodalia Scenes Card",
  "Nodalia Fan Card",
  "Nodalia Light Card",
  "Nodalia Entity Card",
  "Nodalia Weather Card",
  "Nodalia Humidifier Card",
  "Nodalia Climate Card",
  "Nodalia Graph Card",
  "Nodalia Circular Gauge Card",
  "Nodalia Vacuum Card",
  "Nodalia Insignia Card",
  "Nodalia Fav Card",
  "Nodalia Media Player",
  "Nodalia Camera Card",
  "Nodalia Room Summary Card",
  "OK",
  "Info",
  "JSON",
  "YAML",
  "HA",
  "LiDAR",
  "VibraRise",
  "Meteoalarm",
  "Max",
  "Max+",
  "Turbo",
  "Smart",
  "Podcasts",
  "Podcast",
  "Genres",
  "Genre",
  "URL",
  "Z-index",
  "km/h",
  "mph",
  "10, 35, 65, 100",
  "Preset 1",
  "Preset 2",
  "Preset 3",
  "Preset 4",
  "Color",
  "Layout",
  "Inline",
  "Mini",
  "General",
  "Offset",
  "Path",
  "Player",
  "Popup",
  "Gap",
  "Padding",
  "Manual",
  "Solar",
  "Gas",
  "Haptics",
  "Insignia",
  "Standard",
  "Normal",
  "Routine",
  "Dock",
  "Zone",
  "Auto",
  "Eco",
  "Standby",
  "Orange",
  "Wind",
  "Alarm",
  "Code",
  "Position",
  "Person",
  "Start",
  "Optional",
  "HLS",
  "MJPEG",
  "MSE",
  "WebRTC",
  "Home Assistant",
  "AQI",
  "WHO 24h AQG",
  "PM1",
  "PM2.5",
  "PM4",
  "PM10",
  "TVOC",
  "CO₂",
  "Temp",
  "{name}: {state}.",
]);

/** Correct translations/cognates that intentionally match English in one locale. */
const LOCALE_IDENTICAL = {
  es: new Set(["Circular", "Error", "No", "Horizontal", "Vertical"]),
  de: new Set(["Live", "Offline", "Pause", "Status", "Download", "Upload", "Signal", "Version {version}", "Warm", "Neutral", "Name", "Minimum", "Horizontal", "Horizontal (← →)", "Service", "Sofa", "Popup (ms)", "Route", "Radius"]),
  fr: new Set(["Vacant", "Pause", "Batteries", "Signal", "Sources", "Volume", "Compact", "Version {version}", "Routines", "Intense", "zones", "Albums", "Excellent", "Description", "Possible", "Notification", "Date", "Animations", "Routines (JSON)", "Style", "Modes", "Action", "Maximum", "Minimum", "Styles", "Capsule", "Service", "Justification", "Message", "Horizontal"]),
  it: new Set(["Volume", "Popup (ms)", "Media"]),
  nl: new Set(["Live", "Offline", "Camera", "Camera offline", "Status", "Download", "Upload", "Volume", "Compact", "Context", "zones", "Stop", "Albums", "Item", "Warm", "School", "Open", "Week", "Type", "Boost", "1 week", "Platform", "Routines (JSON)", "Icon", "Label", "Minimum", "Capsule", "Route", "Routes", "Media", "Tank", "Medium", "Water", "Radius"]),
  no: new Set(["Pause", "Status", "Signal", "Glass", "Type", "Minimum", "Sofa", "Popup (ms)", "Tank", "Radius"]),
  pt: new Set(["Volume", "Circular", "Item", "Horizontal", "Vertical"]),
  ro: new Set(["Compact", "Context", "Circular", "Mop", "Stop", "Minor", "Boost", "Popup (ms)", "Vertical", "Media", "Metric"]),
};

function loadJson(p, fallback = {}) {
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

function cacheKey(text, lang) {
  return `${text}\u0000${lang}`;
}

async function gtxTranslate(text, lang) {
  const protectedValues = [];
  const protectedText = String(text).replace(/`[^`]*`|\{[^{}]+\}/g, value => {
    const token = `__NODALIA_TOKEN_${protectedValues.length}__`;
    protectedValues.push({ token, value });
    return token;
  });
  const tl = GTX_TL[lang] || lang;
  const u = new URL("https://translate.googleapis.com/translate_a/single");
  u.searchParams.set("client", "gtx");
  u.searchParams.set("sl", "en");
  u.searchParams.set("tl", tl);
  u.searchParams.set("dt", "t");
  u.searchParams.set("q", protectedText);
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(u, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NodaliaI18nFill/1.0)" },
      });
      if (!res.ok) {
        lastErr = new Error(`${res.status} ${res.statusText}`);
        await new Promise(r => setTimeout(r, 400 * attempt));
        continue;
      }
      const data = await res.json();
      let out = "";
      for (const part of data[0] || []) {
        if (part?.[0]) {
          out += part[0];
        }
      }
      if (!out) return text;
      return restoreProtectedTranslationValues(out, protectedValues) ?? text;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 400 * attempt));
    }
  }
  console.warn("gtx fallback EN:", lang, String(text).slice(0, 50), lastErr?.message);
  return text;
}

function shouldTranslate(enValue, lang) {
  if (typeof enValue !== "string") {
    return false;
  }
  const t = enValue.trim();
  if (!t || t.length < 2) {
    return false;
  }
  if (GLOBAL_IDENTICAL.has(t)) {
    return false;
  }
  if (LOCALE_IDENTICAL[lang]?.has(t)) {
    return false;
  }
  if (/^[\d\s,.\-–—%()+]+$/.test(t)) {
    return false;
  }
  return true;
}

function flattenLeaves(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flattenLeaves(v, p, out);
    } else {
      out[p] = v;
    }
  }
  return out;
}

function setDeep(obj, dotted, value) {
  const parts = dotted.split(".");
  if (parts.some(part => part === "__proto__" || part === "constructor" || part === "prototype")) {
    throw new Error(`Unsafe translation key: ${dotted}`);
  }
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (k === "__proto__" || k === "constructor" || k === "prototype") {
      throw new Error(`Unsafe translation key: ${dotted}`);
    }
    const current = Object.hasOwn(cur, k) ? cur[k] : undefined;
    if (!current || typeof current !== "object") {
      Object.defineProperty(cur, k, {
        configurable: true,
        enumerable: true,
        value: {},
        writable: true,
      });
    }
    cur = cur[k];
  }
  const finalKey = parts[parts.length - 1];
  if (finalKey === "__proto__" || finalKey === "constructor" || finalKey === "prototype") {
    throw new Error(`Unsafe translation key: ${dotted}`);
  }
  Object.defineProperty(cur, finalKey, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function collectGaps(enFlat, locFlat, lang) {
  const gaps = [];
  for (const [key, enVal] of Object.entries(enFlat)) {
    const missing = !(key in locFlat);
    const locVal = locFlat[key];
    if (!missing && locVal !== enVal) {
      continue;
    }
    if (!shouldTranslate(enVal, lang)) {
      continue;
    }
    gaps.push({ key, en: enVal, lang, missing });
  }
  return gaps;
}

async function translateGaps(gaps, cache) {
  if (CHECK_GAPS) {
    offlineMissingPairs += gaps.length;
    if (REPORT_GAPS) {
      gaps.forEach(gap => console.log(`    GAP\t${gap.lang}\t${gap.key}\t${JSON.stringify(gap.en)}`));
    }
    return;
  }
  const unique = new Map();
  for (const g of gaps) {
    const ck = cacheKey(g.en, g.lang);
    if (cache[ck]) {
      continue;
    }
    if (!unique.has(ck)) {
      unique.set(ck, { en: g.en, lang: g.lang });
    }
  }
  const entries = [...unique.values()];
  console.log(`  pending gtx pairs: ${entries.length}`);
  if (OFFLINE) {
    offlineMissingPairs += entries.length;
    if (REPORT_GAPS) {
      gaps
        .filter(gap => !cache[cacheKey(gap.en, gap.lang)])
        .forEach(gap => console.log(`    GAP\t${gap.lang}\t${gap.key}\t${JSON.stringify(gap.en)}`));
    }
    return;
  }
  let i = 0;
  for (const { en, lang } of entries) {
    const ck = cacheKey(en, lang);
    cache[ck] = await gtxTranslate(en, lang);
    i++;
    if (i % 20 === 0 || i === entries.length) {
      console.log(`    gtx ${i}/${entries.length}`);
      saveCache(cache);
    }
    await new Promise(r => setTimeout(r, 60));
  }
}

function applyGapsToFile(filePath, enFlat, gaps, cache, flatKeys = false) {
  if (CHECK_GAPS) {
    return 0;
  }
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let n = 0;
  for (const g of gaps) {
    const translated = cache[cacheKey(g.en, g.lang)];
    if (translated && translated !== g.en) {
      if (flatKeys) {
        data[g.key] = translated;
      } else {
        setDeep(data, g.key, translated);
      }
      n++;
    }
  }
  if (n > 0) {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
  }
  return n;
}

async function processEditor() {
  const enPath = path.join(root, "i18n", "editor", "en.json");
  const enFlat = flattenLeaves(JSON.parse(fs.readFileSync(enPath, "utf8")));
  const cache = loadJson(CACHE_PATH, {});
  let total = 0;

  for (const lang of EDITOR_LANGS) {
    const filePath = path.join(root, "i18n", "editor", `${lang}.json`);
    const locFlat = flattenLeaves(JSON.parse(fs.readFileSync(filePath, "utf8")));
    const gaps = collectGaps(enFlat, locFlat, lang);
    console.log(`editor/${lang}: ${gaps.length} gaps`);
    if (!gaps.length) {
      continue;
    }
    await translateGaps(gaps, cache);
    total += applyGapsToFile(filePath, enFlat, gaps, cache, true);
  }
  if (!CHECK_GAPS) {
    saveCache(cache);
  }
  console.log(`editor: applied ${total} translations`);
}

async function processRuntime() {
  const enPath = path.join(root, "i18n", "runtime", "en.json");
  const enFlat = flattenLeaves(JSON.parse(fs.readFileSync(enPath, "utf8")));
  const cache = loadJson(CACHE_PATH, {});
  let total = 0;

  for (const lang of RUNTIME_LANGS) {
    const filePath = path.join(root, "i18n", "runtime", `${lang}.json`);
    const locFlat = flattenLeaves(JSON.parse(fs.readFileSync(filePath, "utf8")));
    const gaps = collectGaps(enFlat, locFlat, lang);
    console.log(`runtime/${lang}: ${gaps.length} gaps`);
    if (!gaps.length) {
      continue;
    }
    await translateGaps(gaps, cache);
    total += applyGapsToFile(filePath, enFlat, gaps, cache);
  }
  if (!CHECK_GAPS) {
    saveCache(cache);
  }
  console.log(`runtime: applied ${total} translations`);
}

await processRuntime();
await processEditor();
if (OFFLINE) {
  console.log(`offline cache misses: ${offlineMissingPairs}`);
}
if (CHECK_GAPS && offlineMissingPairs > 0) {
  process.exitCode = 1;
}
console.log("translate-all-locale-gaps: done");
