/**
 * Builds the `const PACK = { ... }` block in nodalia-i18n.js from i18n/runtime/*.json.
 * Run from repo root: pnpm run i18n:gen-runtime
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const RUNTIME_DIR = path.join(root, "i18n", "runtime");
const I18N_PATH = path.join(root, "nodalia-i18n.js");

const RUNTIME_LANGS = fs
  .readdirSync(RUNTIME_DIR)
  .filter(f => f.endsWith(".json"))
  .map(f => f.slice(0, -".json".length));
RUNTIME_LANGS.sort((a, b) => {
  if (a === "en") {
    return -1;
  }
  if (b === "en") {
    return 1;
  }
  return a.localeCompare(b);
});

const START = "// <nodalia-runtime-i18n-pack>";
const END = "// </nodalia-runtime-i18n-pack>";

/** JSON → JS object literal body (unquoted keys), re-indented under `const PACK = {`. */
function embedPackBody(obj, innerBaseSpaces) {
  let j = JSON.stringify(obj, null, 2);
  j = j.replace(/"([a-zA-Z_$][\w$]*)"\s*:/g, "$1:");
  const lines = j.split("\n");
  const innerLines = lines.slice(1, -1);
  return innerLines
    .map(line => {
      const trimmedLeft = line.replace(/^\s+/, "");
      const jsonIndent = line.length - trimmedLeft.length;
      const target = innerBaseSpaces + jsonIndent - 2;
      return `${" ".repeat(Math.max(0, target))}${trimmedLeft}`;
    })
    .join("\n");
}

function loadRuntime(lang) {
  const p = path.join(RUNTIME_DIR, `${lang}.json`);
  if (!fs.existsSync(p)) {
    throw new Error(`gen-runtime-i18n: missing ${path.relative(root, p)}`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const parts = [];
for (const lang of RUNTIME_LANGS) {
  const data = loadRuntime(lang);
  const body = embedPackBody(data, 6);
  parts.push(`    ${lang}: {\n${body}\n    }`);
}
const packLiteral = `  const PACK = {\n${parts.join(",\n")}\n  };`;

const block = `  ${START}
  // AUTO-GENERATED from i18n/runtime/*.json — edit those files, then run: pnpm run i18n:gen-runtime
${packLiteral}
  ${END}
`;

let src = fs.readFileSync(I18N_PATH, "utf8");
const idxStart = src.indexOf(START);
const idxEnd = src.indexOf(END);
if (idxStart === -1 || idxEnd === -1 || idxEnd < idxStart) {
  console.error("gen-runtime-i18n: markers not found in nodalia-i18n.js:", START, END);
  process.exit(1);
}
let i0 = idxStart;
while (i0 > 0 && src[i0 - 1] !== "\n") {
  i0 -= 1;
}
let i1End = idxEnd + END.length;
while (i1End < src.length && (src[i1End] === " " || src[i1End] === "\r")) {
  i1End += 1;
}
if (src[i1End] === "\n") {
  i1End += 1;
}
src = src.slice(0, i0) + block + src.slice(i1End);
fs.writeFileSync(I18N_PATH, src);
console.log("gen-runtime-i18n: updated PACK in nodalia-i18n.js");
