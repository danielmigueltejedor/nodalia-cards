/**
 * Merges scripts/data/editor-catalog-entity-person-vacuum.json into every i18n/editor/<lang>.json.
 * For langs other than en/es/zh, new keys use the English string (re-run MT pipeline if needed).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const addPath = path.join(root, "scripts", "data", "editor-catalog-entity-person-vacuum.json");
const add = JSON.parse(fs.readFileSync(addPath, "utf8"));
const dir = path.join(root, "i18n", "editor");

function sortKeys(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((acc, k) => {
      acc[k] = obj[k];
      return acc;
    }, {});
}

for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith(".json")) {
    continue;
  }
  const lang = name.replace(/\.json$/, "");
  const p = path.join(dir, name);
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const [key, triple] of Object.entries(add)) {
    const v = triple[lang] ?? triple.en;
    data[key] = v;
  }
  fs.writeFileSync(p, `${JSON.stringify(sortKeys(data), null, 2)}\n`, "utf8");
}
console.log("Merged", Object.keys(add).length, "keys into", fs.readdirSync(dir).filter(n => n.endsWith(".json")).length, "locale files.");
