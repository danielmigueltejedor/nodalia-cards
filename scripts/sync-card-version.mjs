import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const checkOnly = process.argv.includes("--check");
const versionPattern = /const CARD_VERSION = "[^"]+";/;
const expectedDeclaration = `const CARD_VERSION = ${JSON.stringify(pkg.version)};`;
const cardFiles = fs.readdirSync(root)
  .filter(name => /^nodalia-(?!cards(?:-|\.|$)).*\.js$/.test(name))
  .filter(name => versionPattern.test(fs.readFileSync(path.join(root, name), "utf8")))
  .sort();

const stale = [];
for (const name of cardFiles) {
  const filePath = path.join(root, name);
  const source = fs.readFileSync(filePath, "utf8");
  if (source.includes(expectedDeclaration)) {
    continue;
  }
  stale.push(name);
  if (!checkOnly) {
    fs.writeFileSync(filePath, source.replace(versionPattern, expectedDeclaration));
  }
}

if (checkOnly && stale.length) {
  throw new Error(`Card versions do not match package ${pkg.version}: ${stale.join(", ")}. Run npm run version:sync.`);
}

console.log(
  checkOnly
    ? `Validated ${cardFiles.length} card versions (${pkg.version}).`
    : `Synchronized ${stale.length} of ${cardFiles.length} card versions to ${pkg.version}.`,
);
