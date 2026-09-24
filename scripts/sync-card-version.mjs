import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const checkOnly = process.argv.includes("--check");
const versionPattern = /(?:export )?(?:const|let|var) CARD_VERSION = "[^"]+";/;
const expectedDeclaration = declaration => {
  const prefix = declaration.startsWith("export ") ? "export " : "";
  const keyword = declaration.includes("let CARD_VERSION") ? "let" : declaration.includes("var CARD_VERSION") ? "var" : "const";
  return `${prefix}${keyword} CARD_VERSION = ${JSON.stringify(pkg.version)};`;
};

function collectVersionFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "release" || entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectVersionFiles(fullPath, acc);
      continue;
    }
    if (!/\.(js|ts)$/.test(entry.name)) continue;
    if (entry.name.startsWith("nodalia-cards")) continue;
    const source = fs.readFileSync(fullPath, "utf8");
    if (versionPattern.test(source)) acc.push(path.relative(root, fullPath));
  }
  return acc;
}

const cardFiles = collectVersionFiles(root).sort();
const stale = [];
for (const name of cardFiles) {
  const filePath = path.join(root, name);
  const source = fs.readFileSync(filePath, "utf8");
  const current = source.match(versionPattern)?.[0];
  if (!current) continue;
  const expected = expectedDeclaration(current);
  if (source.includes(expected)) continue;
  stale.push(name);
  if (!checkOnly) {
    fs.writeFileSync(filePath, source.replace(versionPattern, expected));
  }
}

if (checkOnly && stale.length) {
  throw new Error(`Card versions do not match package ${pkg.version}: ${stale.join(", ")}. Run npm run version:sync.`);
}

console.log(
  checkOnly
    ? `Validated ${cardFiles.length} card versions (${pkg.version}).`
    : `Synchronized ${stale.length} version declarations across ${cardFiles.length} card files to ${pkg.version}.`,
);
