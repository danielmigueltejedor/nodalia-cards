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
