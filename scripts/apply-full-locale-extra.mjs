/**
 * Adds pt/ru/el/zh/ro to FULL_LOCALE_BY_EN rows in scripts/gen-editor-ui.mjs
 * using scripts/data/full-locale-extra.json. Idempotent if pt already present.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EDITOR = path.join(__dirname, "gen-editor-ui.mjs");
const EXTRA = path.join(__dirname, "data", "full-locale-extra.json");

function skipString(s, i) {
  if (s[i] !== '"') return i;
  i++;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === '"') return i + 1;
    i++;
  }
  return i;
}

function findMatchingBrace(s, openIdx) {
  let i = openIdx;
  let depth = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"') {
      i = skipString(s, i);
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function extractEntrySpan(s, en) {
  const keyLine = `  ${JSON.stringify(en)}: {`;
  const start = s.indexOf(keyLine);
  if (start === -1) return null;
  const braceOpen = start + keyLine.length - 1;
  const braceClose = findMatchingBrace(s, braceOpen);
  if (braceClose === -1) return null;
  let end = braceClose + 1;
  if (s[end] === ",") end++;
  return { start, end, segment: s.slice(start, end) };
}

let s = fs.readFileSync(EDITOR, "utf8");
const extra = JSON.parse(fs.readFileSync(EXTRA, "utf8"));

for (const [en, langs] of Object.entries(extra)) {
  const span = extractEntrySpan(s, en);
  if (!span) {
    console.error("Missing FULL_LOCALE key:", en);
    process.exit(1);
  }
  let { segment } = span;
  if (segment.includes("\n    pt:")) {
    continue;
  }

  const isMultiline = segment.includes("\n    de:");
  let newSeg;
  if (!isMultiline) {
    newSeg = segment.replace(
      / nl: ("(?:[^"\\]|\\.)*") (\},)\s*$/m,
      (_, nlq, closing) =>
        ` nl: ${nlq}, pt: ${JSON.stringify(langs.pt)}, ru: ${JSON.stringify(langs.ru)}, el: ${JSON.stringify(langs.el)}, zh: ${JSON.stringify(langs.zh)}, ro: ${JSON.stringify(langs.ro)}${closing}`,
    );
  } else {
    newSeg = segment.replace(
      /(\n    nl: "(?:[^"\\]|\\.)*",)(\s*\n  \},)$/,
      (_, nlLine, closing) =>
        `${nlLine}\n    pt: ${JSON.stringify(langs.pt)},\n    ru: ${JSON.stringify(langs.ru)},\n    el: ${JSON.stringify(langs.el)},\n    zh: ${JSON.stringify(langs.zh)},\n    ro: ${JSON.stringify(langs.ro)},${closing}`,
    );
  }

  if (newSeg === segment) {
    console.error("Patch failed for:", en);
    console.error("Segment sample:", segment.slice(0, 200));
    process.exit(1);
  }

  s = s.slice(0, span.start) + newSeg + s.slice(span.end);
}

fs.writeFileSync(EDITOR, s);
console.log("Patched FULL_LOCALE_BY_EN with pt/ru/el/zh/ro.");
