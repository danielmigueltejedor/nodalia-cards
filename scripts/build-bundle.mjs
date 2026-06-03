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

const CORE_PARTS = [
  "nodalia-i18n.js",
  "nodalia-editor-ui.js",
  "nodalia-utils.js",
  "nodalia-render-signature.js",
  "nodalia-bubble-contrast.js",
];

const CARD_PARTS = [
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
  "nodalia-calendar-card.js",
  "nodalia-notifications-card.js",
  "nodalia-vacuum-card.js",
];

const ALL_PARTS = [...CORE_PARTS, ...CARD_PARTS];

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

async function buildParts(parts, label) {
  const entryPath = path.join(root, `.tmp-nodalia-bundle-${label}.mjs`);
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
    return (result.outputFiles?.[0]?.text || "").replace(/[ \t]+$/gm, "");
  } finally {
    if (fs.existsSync(entryPath)) {
      fs.unlinkSync(entryPath);
    }
  }
}

const [fullBody, coreBody, suiteBody] = await Promise.all([
  buildParts(ALL_PARTS, "full"),
  buildParts(CORE_PARTS, "core"),
  buildParts(CARD_PARTS, "suite"),
]);

const fullHash = crypto.createHash("sha256").update(fullBody).digest("hex").slice(0, 12);
const coreHash = crypto.createHash("sha256").update(coreBody).digest("hex").slice(0, 12);
const suiteHash = crypto.createHash("sha256").update(suiteBody).digest("hex").slice(0, 12);

const bundleFile = "nodalia-cards.bundle.js";
const manifestFile = "nodalia-cards.manifest.js";
const loaderFile = "nodalia-cards.js";
const versionedLoaderFile = `nodalia-cards-${pkg.version}.js`;
const coreFile = `nodalia-cards-core-${pkg.version}.js`;
const suiteFile = `nodalia-cards-suite-${pkg.version}.js`;

const VERSIONED_BUNDLE_PATTERN = /^nodalia-cards-(?:core-|suite-)?\d+\.\d+\.\d+(?:-alpha\.\d+)?\.js$/;
const keepVersionedBundles = new Set([versionedLoaderFile, coreFile, suiteFile]);
for (const name of fs.readdirSync(root)) {
  if (!VERSIONED_BUNDLE_PATTERN.test(name) || keepVersionedBundles.has(name)) {
    continue;
  }
  fs.unlinkSync(path.join(root, name));
  console.log(`Removed stale bundle ${name}`);
}

const fullFooter = `;if(typeof window!=="undefined"){window.__NODALIA_BUNDLE__=${JSON.stringify({
  pkgVersion: pkg.version,
  contentSha256_12: fullHash,
})};if(typeof console!=="undefined"&&typeof console.info==="function"){console.info("%c nodalia-cards %c v${pkg.version} (${fullHash}) ","background:#22343f;color:#fff;padding:4px 8px;border-radius:999px 0 0 999px;font-weight:700;","background:#3f6a80;color:#fff;padding:4px 8px;border-radius:0 999px 999px 0;font-weight:700;");}}`;

const coreFooter = `;if(typeof window!=="undefined"){window.__NODALIA_CORE__=${JSON.stringify({
  pkgVersion: pkg.version,
  contentSha256_12: coreHash,
  suiteFile,
})};if(typeof console!=="undefined"&&typeof console.info==="function"){console.info("%c nodalia-cards core %c v${pkg.version} (${coreHash}) ","background:#22343f;color:#fff;padding:4px 8px;border-radius:999px 0 0 999px;font-weight:700;","background:#3f6a80;color:#fff;padding:4px 8px;border-radius:0 999px 999px 0;font-weight:700;");}}`;

const suiteFooter = `;if(typeof window!=="undefined"){window.__NODALIA_SUITE__=${JSON.stringify({
  pkgVersion: pkg.version,
  contentSha256_12: suiteHash,
  requiresCore: coreFile,
})};if(!window.NodaliaUtils&&typeof console!=="undefined"&&typeof console.warn==="function"){console.warn("[nodalia-cards] Load ${coreFile} before ${suiteFile}.");}if(typeof console!=="undefined"&&typeof console.info==="function"){console.info("%c nodalia-cards suite %c v${pkg.version} (${suiteHash}) ","background:#22343f;color:#fff;padding:4px 8px;border-radius:999px 0 0 999px;font-weight:700;","background:#3f6a80;color:#fff;padding:4px 8px;border-radius:0 999px 999px 0;font-weight:700;");}}`;

const inlineLoaderFooter = `;if(typeof window!=="undefined"){window.__NODALIA_LOADER__=${JSON.stringify({
  mode: "inline",
  pkgVersion: pkg.version,
  contentSha256_12: fullHash,
  file: loaderFile,
})};}`;

const versionedInlineLoaderFooter = `;if(typeof window!=="undefined"){window.__NODALIA_LOADER__=${JSON.stringify({
  mode: "inline",
  pkgVersion: pkg.version,
  contentSha256_12: fullHash,
  file: versionedLoaderFile,
  fallbackFile: loaderFile,
  splitCoreFile: coreFile,
  splitSuiteFile: suiteFile,
})};}`;

const manifest = {
  pkgVersion: pkg.version,
  contentSha256_12: fullHash,
  file: bundleFile,
  loaderFile,
  hacsFile: versionedLoaderFile,
  splitCoreFile: coreFile,
  splitCoreSha256_12: coreHash,
  splitSuiteFile: suiteFile,
  splitSuiteSha256_12: suiteHash,
};

const manifestSource = `export default ${JSON.stringify(manifest, null, 2)};
export const pkgVersion = ${JSON.stringify(pkg.version)};
export const contentSha256_12 = ${JSON.stringify(fullHash)};
export const file = ${JSON.stringify(bundleFile)};
export const splitCoreFile = ${JSON.stringify(coreFile)};
export const splitSuiteFile = ${JSON.stringify(suiteFile)};
`;

fs.writeFileSync(path.join(root, bundleFile), `${fullBody}\n${fullFooter}\n`);
fs.writeFileSync(path.join(root, manifestFile), manifestSource);
fs.writeFileSync(path.join(root, loaderFile), `${fullBody}\n${fullFooter}\n${inlineLoaderFooter}\n`);
fs.writeFileSync(path.join(root, versionedLoaderFile), `${fullBody}\n${fullFooter}\n${versionedInlineLoaderFooter}\n`);
fs.writeFileSync(path.join(root, coreFile), `${coreBody}\n${coreFooter}\n`);
fs.writeFileSync(path.join(root, suiteFile), `${suiteBody}\n${suiteFooter}\n`);

const formatKb = bytes => `${(bytes / 1024).toFixed(0)} KB`;
console.log(
  `Wrote ${loaderFile} + ${versionedLoaderFile} (${formatKb(Buffer.byteLength(fullBody))}, ${fullHash}), `
  + `split ${coreFile} (${formatKb(Buffer.byteLength(coreBody))}, ${coreHash}) + `
  + `${suiteFile} (${formatKb(Buffer.byteLength(suiteBody))}, ${suiteHash}).`,
);
