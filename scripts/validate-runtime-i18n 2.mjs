/**
 * Ensures i18n/runtime/<lang>.json only uses keys that exist in en.json (no stray keys).
 * Partial locales may omit keys (they inherit via deepMergeLocale with English at runtime).
 * Run: node scripts/validate-runtime-i18n.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dir = path.join(root, "i18n", "runtime");
const enPath = path.join(dir, "en.json");

function assertSubset(enNode, otherNode, pathPrefix) {
  if (otherNode === undefined) {
    return true;
  }
  if (enNode === undefined || enNode === null) {
    console.error(`Unknown key branch at "${pathPrefix}" (not in en.json)`);
    return false;
  }
  if (typeof otherNode !== "object" || otherNode === null || Array.isArray(otherNode)) {
    if (typeof enNode !== typeof otherNode) {
      console.error(`Type mismatch at "${pathPrefix}": en has ${typeof enNode}, locale has ${typeof otherNode}`);
      return false;
    }
    return true;
  }
  if (typeof enNode !== "object" || enNode === null || Array.isArray(enNode)) {
    console.error(`Structure mismatch at "${pathPrefix}": en is leaf, locale has object`);
    return false;
  }
  let ok = true;
  for (const k of Object.keys(otherNode)) {
    const next = pathPrefix ? `${pathPrefix}.${k}` : k;
    if (!Object.prototype.hasOwnProperty.call(enNode, k)) {
      console.error(`Unknown key in locale file: "${next}"`);
      ok = false;
      continue;
    }
    if (!assertSubset(enNode[k], otherNode[k], next)) {
      ok = false;
    }
  }
  return ok;
}

if (!fs.existsSync(enPath)) {
  console.warn("validate-runtime-i18n: no i18n/runtime/en.json — skip.");
  process.exit(0);
}

const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
let failed = false;

for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith(".json") || name === "en.json") {
    continue;
  }
  const p = path.join(dir, name);
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!assertSubset(en, data, "")) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log("validate-runtime-i18n: OK — runtime locale trees are subsets of en.json.");
