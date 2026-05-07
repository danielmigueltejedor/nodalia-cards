import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { build } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const STANDALONE_UTILS_START = "// <nodalia-standalone-utils>";
const STANDALONE_UTILS_END = "// </nodalia-standalone-utils>";

/** Strip inlined nodalia-utils copy used for standalone card scripts (see scripts/sync-standalone-embed.mjs). */
function stripStandaloneUtilsEmbed(source) {
  const i0 = source.indexOf(STANDALONE_UTILS_START);
  if (i0 === -1) {
    return source;
  }
  const i1 = source.indexOf(STANDALONE_UTILS_END, i0);
  if (i1 === -1) {
    throw new Error(`${STANDALONE_UTILS_START} without ${STANDALONE_UTILS_END} in bundled part`);
  }
  const tail = source.slice(i1 + STANDALONE_UTILS_END.length).replace(/^\s*\n/, "");
  return source.slice(0, i0) + tail;
}

const parts = [
  "nodalia-i18n.js",
  "nodalia-editor-ui.js",
  "nodalia-utils.js",
  "nodalia-render-signature.js",
  "nodalia-bubble-contrast.js",
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
  "nodalia-calendar-card.js",
  "nodalia-notifications-card.js",
  "nodalia-vacuum-card.js",
];

let body = "";
const entryPath = path.join(root, ".tmp-nodalia-bundle-entry.mjs");
const entrySource = parts.map(name => `import "./${name}";`).join("\n");
fs.writeFileSync(entryPath, `${entrySource}\n`);

try {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [entryPath],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    charset: "utf8",
    legalComments: "none",
    minify: true,
    plugins: [
      {
        name: "strip-standalone-utils-embed",
        setup(buildContext) {
          buildContext.onLoad({ filter: /nodalia-.*\.js$/ }, args => {
            const source = fs.readFileSync(args.path, "utf8");
            return {
              contents: stripStandaloneUtilsEmbed(source),
              loader: "js",
            };
          });
        },
      },
    ],
  });
  body = result.outputFiles?.[0]?.text || "";
} finally {
  if (fs.existsSync(entryPath)) {
    fs.unlinkSync(entryPath);
  }
}

const contentHash = crypto.createHash("sha256").update(body).digest("hex").slice(0, 12);
const footer = `;if(typeof window!=="undefined"){window.__NODALIA_BUNDLE__=${JSON.stringify({
  pkgVersion: pkg.version,
  contentSha256_12: contentHash,
})};if(typeof console!=="undefined"&&typeof console.info==="function"){console.info("%c nodalia-cards %c v${pkg.version} (${contentHash}) ","background:#22343f;color:#fff;padding:4px 8px;border-radius:999px 0 0 999px;font-weight:700;","background:#3f6a80;color:#fff;padding:4px 8px;border-radius:0 999px 999px 0;font-weight:700;");}}`;
const bundleFile = "nodalia-cards.bundle.js";
const manifestFile = "nodalia-cards.manifest.js";
const loaderFile = "nodalia-cards.js";
const bundlePath = path.join(root, bundleFile);
const manifestPath = path.join(root, manifestFile);
const loaderPath = path.join(root, loaderFile);
const manifest = {
  pkgVersion: pkg.version,
  contentSha256_12: contentHash,
  file: bundleFile,
};
const manifestSource = `export default ${JSON.stringify(manifest, null, 2)};\nexport const pkgVersion = ${JSON.stringify(pkg.version)};\nexport const contentSha256_12 = ${JSON.stringify(contentHash)};\nexport const file = ${JSON.stringify(bundleFile)};\n`;
const loaderSource = `const FALLBACK_MANIFEST = ${JSON.stringify(manifest, null, 2)};

async function loadNodaliaCardsBundle() {
  const manifestUrl = new URL("./${manifestFile}", import.meta.url);
  manifestUrl.searchParams.set("t", String(Date.now()));
  let manifest = FALLBACK_MANIFEST;
  try {
    const module = await import(manifestUrl.href);
    manifest = module.default || {
      pkgVersion: module.pkgVersion,
      contentSha256_12: module.contentSha256_12,
      file: module.file,
    };
  } catch (error) {
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("nodalia-cards: no se pudo cargar el manifest cache-busting; usando fallback embebido.", error);
    }
  }

  const bundleFile = typeof manifest.file === "string" && manifest.file ? manifest.file : FALLBACK_MANIFEST.file;
  const bundleUrl = new URL(bundleFile, import.meta.url);
  bundleUrl.searchParams.set("v", manifest.contentSha256_12 || manifest.pkgVersion || String(Date.now()));
  await import(bundleUrl.href);

  if (typeof window !== "undefined") {
    window.__NODALIA_LOADER__ = {
      pkgVersion: manifest.pkgVersion || FALLBACK_MANIFEST.pkgVersion,
      contentSha256_12: manifest.contentSha256_12 || FALLBACK_MANIFEST.contentSha256_12,
      bundleUrl: bundleUrl.href,
    };
  }
}

await loadNodaliaCardsBundle();
`;
fs.writeFileSync(bundlePath, `${body}\n${footer}\n`);
fs.writeFileSync(manifestPath, manifestSource);
fs.writeFileSync(loaderPath, loaderSource);
console.log(`Wrote ${path.relative(root, loaderPath)} loader -> ${bundleFile} (${parts.length} modules + i18n, ${contentHash}).`);
