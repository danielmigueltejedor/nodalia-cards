/**
 * Optional: inlines nodalia-utils.js for single-file Lovelace resources (not committed in repo).
 * Source of truth: nodalia-utils.js — loaded once in nodalia-cards.js via build-bundle.mjs.
 *
 *   node scripts/sync-standalone-embed.mjs          # embed (release / standalone artifact)
 *   node scripts/sync-standalone-embed.mjs --strip  # remove embed blocks from card sources
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const START = "// <nodalia-standalone-utils>";
const END = "// </nodalia-standalone-utils>";

const FILES = [
  "nodalia-navigation-bar.js",
  "nodalia-media-player.js",
  "nodalia-light-card.js",
  "nodalia-fan-card.js",
  "nodalia-humidifier-card.js",
  "nodalia-circular-gauge-card.js",
  "nodalia-graph-card.js",
  "nodalia-power-flow-card.js",
  "nodalia-cover-card.js",
  "nodalia-climate-card.js",
  "nodalia-alarm-panel-card.js",
  "nodalia-advance-vacuum-card.js",
  "nodalia-entity-card.js",
  "nodalia-fav-card.js",
  "nodalia-insignia-card.js",
  "nodalia-person-card.js",
  "nodalia-scenes-card.js",
  "nodalia-weather-card.js",
  "nodalia-notifications-card.js",
  "nodalia-vacuum-card.js",
];

function stripEmbed(content) {
  const i0 = content.indexOf(START);
  if (i0 === -1) {
    return content;
  }
  const i1 = content.indexOf(END, i0);
  if (i1 === -1) {
    throw new Error(`${START} without ${END}`);
  }
  const after = content.slice(i1 + END.length);
  // Remove every leading newline after END so round-trip matches wrapEmbed's trailing newlines.
  const rest = after.replace(/^\n+/, "");
  return content.slice(0, i0) + rest;
}

function wrapEmbed(utilsSrc) {
  return `${START}
// Inlined for standalone Lovelace resources (single JS file). Stripped when building nodalia-cards.js.
// Source of truth: nodalia-utils.js — regenerate: node scripts/sync-standalone-embed.mjs
${utilsSrc}
${END}

`;
}

function normalizeNewlines(s) {
  return s.replace(/\r\n/g, "\n");
}

const stripOnly = process.argv.includes("--strip");

let updated = 0;
if (stripOnly) {
  for (const name of FILES) {
    const filePath = path.join(root, name);
    const beforeFull = fs.readFileSync(filePath, "utf8");
    const next = stripEmbed(beforeFull);
    if (normalizeNewlines(next) !== normalizeNewlines(beforeFull)) {
      fs.writeFileSync(filePath, next);
      updated += 1;
    }
  }
  console.log(`Standalone utils embed: stripped ${updated} file(s).`);
} else {
  const utilsSrc = fs.readFileSync(path.join(root, "nodalia-utils.js"), "utf8");
  const embed = wrapEmbed(utilsSrc);
  for (const name of FILES) {
    const filePath = path.join(root, name);
    const beforeFull = fs.readFileSync(filePath, "utf8");
    const stripped = stripEmbed(beforeFull);
    const next = embed + stripped;
    if (normalizeNewlines(next) !== normalizeNewlines(beforeFull)) {
      fs.writeFileSync(filePath, next);
      updated += 1;
    }
  }
  console.log(`Standalone utils embed: updated ${updated} file(s).`);
}
