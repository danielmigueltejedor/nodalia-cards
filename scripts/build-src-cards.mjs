import { embeddedStylesPlugin } from "./embedded-styles.mjs";
import { CARD_REGISTRY } from "./card-registry.mjs";
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export const SRC_CARD_ENTRIES = CARD_REGISTRY.map(card => ({ entry: card.standalone, outfile: card.artifact }));

export const RUNTIME_ENTRIES = [
  { entry: "src/shared/utils-runtime.ts", outfile: "nodalia-utils.js" },
  { entry: "src/shared/go2rtc-player.ts", outfile: "nodalia-go2rtc-player.js", format: "esm" },
  { entry: "src/shared/bubble-contrast-runtime.ts", outfile: "nodalia-bubble-contrast.js" },
  { entry: "src/core/engine-client-runtime.ts", outfile: "nodalia-backend.js" },
  { entry: "src/cards/notifications/notifications-mobile-policy-runtime.ts", outfile: "nodalia-notifications-mobile-policy.js" },
  { entry: "src/cards/room-summary/room-summary-model-runtime.ts", outfile: "nodalia-room-summary-model.js" },
  { entry: "src/cards/camera/camera-stream-runtime.ts", outfile: "nodalia-camera-stream-model.js" },
  { entry: "src/shared/render-signature-runtime.ts", outfile: "nodalia-render-signature.js" },
];
export async function buildSrcCards() {
  await build({ absWorkingDir: root, entryPoints: ["tests/fixtures/hass.ts"], outfile: "tests/fixtures/hass.mjs", bundle: true, format: "esm", platform: "browser", target: ["es2020"], banner: { js: "// Generated from tests/fixtures/hass.ts. Do not edit." } });
  for (const card of [...RUNTIME_ENTRIES, ...SRC_CARD_ENTRIES]) {
    await build({
      absWorkingDir: root,
      entryPoints: [card.entry],
      outfile: card.outfile,
      bundle: true,
      plugins: [embeddedStylesPlugin()],
      write: true,
      format: card.format ?? "iife",
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
