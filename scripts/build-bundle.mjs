import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const parts = [
  "nodalia-i18n.js",
  "nodalia-editor-ui.js",
  "nodalia-navigation-bar.js",
  "nodalia-media-player.js",
  "nodalia-light-card.js",
  "nodalia-fan-card.js",
  "nodalia-humidifier-card.js",
  "nodalia-circular-gauge-card.js",
  "nodalia-graph-card.js",
  "nodalia-power-flow-card.js",
  "nodalia-climate-card.js",
  "nodalia-alarm-panel-card.js",
  "nodalia-advance-vacuum-card.js",
  "nodalia-entity-card.js",
  "nodalia-fav-card.js",
  "nodalia-insignia-card.js",
  "nodalia-person-card.js",
  "nodalia-weather-card.js",
  "nodalia-vacuum-card.js",
];

let body = "";
for (const name of parts) {
  body += "{\n";
  body += fs.readFileSync(path.join(root, name), "utf8");
  body += "\n}\n";
}

const outPath = path.join(root, "nodalia-cards.js");
fs.writeFileSync(outPath, `${body}\n`);
console.log(`Wrote ${path.relative(root, outPath)} (${parts.length} modules + i18n).`);
