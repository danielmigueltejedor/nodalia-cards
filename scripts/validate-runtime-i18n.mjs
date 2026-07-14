/**
 * Ensures i18n/runtime/<lang>.json files have the same tree and leaf types as en.json.
 * Run: node scripts/validate-runtime-i18n.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dir = path.join(root, "i18n", "runtime");
const enPath = path.join(dir, "en.json");

function placeholders(value) {
  return [...String(value ?? "").matchAll(/\{([^{}]+)\}/g)].map(match => match[1]).sort();
}

function codeSpans(value) {
  return [...String(value ?? "").matchAll(/`([^`]+)`/g)].map(match => match[1]).sort();
}

function assertSameShape(enNode, otherNode, pathPrefix) {
  if (otherNode === undefined) {
    console.error(`Missing key in locale file: "${pathPrefix}"`);
    return false;
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
    const expected = placeholders(enNode);
    const actual = placeholders(otherNode);
    if (expected.join("\u0000") !== actual.join("\u0000")) {
      console.error(`Placeholder mismatch at "${pathPrefix}": expected {${expected.join("}, {")}}, got {${actual.join("}, {")}}`);
      return false;
    }
    const expectedCode = codeSpans(enNode);
    const actualCode = codeSpans(otherNode);
    if (expectedCode.join("\u0000") !== actualCode.join("\u0000")) {
      console.error(`Code span mismatch at "${pathPrefix}": expected ${expectedCode.join(", ")}, got ${actualCode.join(", ")}`);
      return false;
    }
    return true;
  }
  if (typeof enNode !== "object" || enNode === null || Array.isArray(enNode)) {
    console.error(`Structure mismatch at "${pathPrefix}": en is leaf, locale has object`);
    return false;
  }
  let ok = true;
  for (const k of Object.keys(enNode)) {
    const next = pathPrefix ? `${pathPrefix}.${k}` : k;
    if (!Object.prototype.hasOwnProperty.call(otherNode, k)) {
      console.error(`Missing key in locale file: "${next}"`);
      ok = false;
    }
  }
  for (const k of Object.keys(otherNode)) {
    const next = pathPrefix ? `${pathPrefix}.${k}` : k;
    if (!Object.prototype.hasOwnProperty.call(enNode, k)) {
      console.error(`Unknown key in locale file: "${next}"`);
      ok = false;
      continue;
    }
    if (!assertSameShape(enNode[k], otherNode[k], next)) {
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
  if (!assertSameShape(en, data, "")) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log("validate-runtime-i18n: OK — runtime locale trees match en.json.");
