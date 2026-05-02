/**
 * Prepends advanceVacuum + vacuumSimple (scripts/data/locale-vacuum-packs.json)
 * before navigationMusicAssist for pt/ru/el/zh/ro. Idempotent per locale.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PACKS = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "locale-vacuum-packs.json"), "utf8"));
const I18N = path.join(ROOT, "nodalia-i18n.js");

function embedBlock(obj, baseSpaces = 6) {
  let j = JSON.stringify(obj, null, 2);
  j = j.replace(/"([a-zA-Z_$][\w$]*)"\s*:/g, "$1:");
  const lines = j.split("\n");
  const innerLines = lines.slice(1, -1);
  return innerLines
    .map((line) => {
      const trimmedLeft = line.replace(/^\s+/, "");
      const jsonIndent = line.length - trimmedLeft.length;
      const target = baseSpaces + jsonIndent - 2;
      return `${" ".repeat(Math.max(0, target))}${trimmedLeft}`;
    })
    .join("\n");
}

const anchors = [
  { lang: "pt", next: `      navigationMusicAssist:` },
  { lang: "ru", next: `      navigationMusicAssist:` },
  { lang: "el", next: `      navigationMusicAssist:` },
  { lang: "zh", next: `      navigationMusicAssist:` },
  { lang: "ro", next: `      navigationMusicAssist:` },
];

let src = fs.readFileSync(I18N, "utf8");

for (const { lang } of anchors) {
  const needle = `    ${lang}: {\n      navigationMusicAssist:`;
  if (!src.includes(needle)) {
    console.error("Missing anchor:", lang);
    process.exit(1);
  }
  if (src.includes(`    ${lang}: {\n      advanceVacuum:`)) {
    console.log(`skip ${lang} (advanceVacuum already present)`);
    continue;
  }
  const slice = PACKS[lang];
  if (!slice?.advanceVacuum || !slice?.vacuumSimple) {
    console.error("Bad PACK for", lang);
    process.exit(1);
  }
  const block = embedBlock({
    advanceVacuum: slice.advanceVacuum,
    vacuumSimple: slice.vacuumSimple,
  });
  src = src.replace(
    needle,
    `    ${lang}: {\n${block},\n      navigationMusicAssist:`,
  );
}

fs.writeFileSync(I18N, src);
console.log("Prepended advanceVacuum + vacuumSimple for pt/ru/el/zh/ro.");
