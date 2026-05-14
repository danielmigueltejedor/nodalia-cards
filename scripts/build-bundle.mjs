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
  "nodalia-cover-card.js",
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
  body = (result.outputFiles?.[0]?.text || "").replace(/[ \t]+$/gm, "");
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
const versionedLoaderFile = `nodalia-cards-${pkg.version}.js`;
const bundlePath = path.join(root, bundleFile);
const manifestPath = path.join(root, manifestFile);
const loaderPath = path.join(root, loaderFile);
const versionedLoaderPath = path.join(root, versionedLoaderFile);
const manifest = {
  pkgVersion: pkg.version,
  contentSha256_12: contentHash,
  file: bundleFile,
  loaderFile,
  hacsFile: versionedLoaderFile,
};
const manifestSource = `export default ${JSON.stringify(manifest, null, 2)};\nexport const pkgVersion = ${JSON.stringify(pkg.version)};\nexport const contentSha256_12 = ${JSON.stringify(contentHash)};\nexport const file = ${JSON.stringify(bundleFile)};\n`;
const inlineLoaderFooter = `;if(typeof window!=="undefined"){window.__NODALIA_LOADER__=${JSON.stringify({
  mode: "inline",
  pkgVersion: pkg.version,
  contentSha256_12: contentHash,
  file: loaderFile,
})};}`;
const versionedInlineLoaderFooter = `;if(typeof window!=="undefined"){window.__NODALIA_LOADER__=${JSON.stringify({
  mode: "inline",
  pkgVersion: pkg.version,
  contentSha256_12: contentHash,
  file: versionedLoaderFile,
  fallbackFile: loaderFile,
})};}`;
fs.writeFileSync(bundlePath, `${body}\n${footer}\n`);
fs.writeFileSync(manifestPath, manifestSource);
fs.writeFileSync(loaderPath, `${body}\n${footer}\n${inlineLoaderFooter}\n`);
fs.writeFileSync(versionedLoaderPath, `${body}\n${footer}\n${versionedInlineLoaderFooter}\n`);
console.log(`Wrote ${path.relative(root, loaderPath)} + ${path.relative(root, versionedLoaderPath)} self-contained bundles and ${bundleFile} artifact (${parts.length} modules + i18n, ${contentHash}).`);
