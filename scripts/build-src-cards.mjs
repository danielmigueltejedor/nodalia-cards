import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export const SRC_CARD_ENTRIES = [
  {
    entry: "src/cards/climate/standalone.ts",
    outfile: "nodalia-climate-card.js",
  },
  {
    entry: "src/cards/media-player/standalone.ts",
    outfile: "nodalia-media-player.js",
  },
  {
    entry: "src/cards/light/standalone.ts",
    outfile: "nodalia-light-card.js",
  },
  {
    entry: "src/cards/fan/standalone.ts",
    outfile: "nodalia-fan-card.js",
  },
  {
    entry: "src/cards/humidifier/standalone.ts",
    outfile: "nodalia-humidifier-card.js",
  },
  {
    entry: "src/cards/cover/standalone.ts",
    outfile: "nodalia-cover-card.js",
  },
  {
    entry: "src/cards/alarm-panel/standalone.ts",
    outfile: "nodalia-alarm-panel-card.js",
  },
  {
    entry: "src/cards/vacuum/standalone.ts",
    outfile: "nodalia-vacuum-card.js",
  },
  {
    entry: "src/cards/entity/standalone.ts",
    outfile: "nodalia-entity-card.js",
  },
  {
    entry: "src/cards/fav/standalone.ts",
    outfile: "nodalia-fav-card.js",
  },
  {
    entry: "src/cards/person/standalone.ts",
    outfile: "nodalia-person-card.js",
  },
  {
    entry: "src/cards/camera/standalone.ts",
    outfile: "nodalia-camera-card.js",
  },
  {
    entry: "src/cards/circular-gauge/standalone.ts",
    outfile: "nodalia-circular-gauge-card.js",
  },
  {
    entry: "src/cards/insignia/standalone.ts",
    outfile: "nodalia-insignia-card.js",
  },
  {
    entry: "src/cards/scenes/standalone.ts",
    outfile: "nodalia-scenes-card.js",
  },
  {
    entry: "src/cards/news/standalone.ts",
    outfile: "nodalia-news-card.js",
  },
];

export async function buildSrcCards() {
  for (const card of SRC_CARD_ENTRIES) {
    await build({
      absWorkingDir: root,
      entryPoints: [card.entry],
      outfile: card.outfile,
      bundle: true,
      write: true,
      format: "iife",
      platform: "browser",
      target: ["es2020"],
      charset: "utf8",
      legalComments: "inline",
      minify: false,
      keepNames: false,
      sourcemap: false,
      banner: {
        js: `/* Generated from ${card.entry.replace(/\/standalone\.ts$/, "")}. Do not edit. */`,
      },
      supported: {
        "const-and-let": true,
      },
    });
  }
}

if (process.argv[1] && path.normalize(process.argv[1]).endsWith("build-src-cards.mjs")) {
  await buildSrcCards();
}
