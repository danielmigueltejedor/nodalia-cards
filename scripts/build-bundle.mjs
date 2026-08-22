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
  "nodalia-utils.js",
  "nodalia-backend.js",
  "nodalia-render-signature.js",
  "nodalia-bubble-contrast.js",
];

const EDITOR_PARTS = ["nodalia-editor-ui.js"];

const CARD_SUPPORT_PARTS = [
  "nodalia-notifications-mobile-policy.js",
  "nodalia-room-summary-model.js",
  "nodalia-camera-stream-model.js",
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
  "nodalia-news-card.js",
  "nodalia-camera-card.js",
  "nodalia-room-summary-card.js",
];

const ALL_PARTS = [...CORE_PARTS, ...CARD_SUPPORT_PARTS, ...CARD_PARTS];

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
  const entrySource = parts.map(name => `import "./${name}";`).join("\n");
  const result = await build({
    absWorkingDir: root,
    stdin: {
      contents: `${entrySource}\n`,
      loader: "js",
      resolveDir: root,
      sourcefile: `nodalia-bundle-${label}.mjs`,
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    charset: "utf8",
    legalComments: "inline",
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
}

const fullBody = await buildParts(ALL_PARTS, "full");
const editorBody = await buildParts(EDITOR_PARTS, "editor");
// HACS ships only nodalia-cards.js. Keep the visual editor in that same file so
// the installed runtime never depends on auxiliary generated bundles.
const hacsBody = `${fullBody}\n${editorBody}`;

function assertCardRegistrations(source, label) {
  const missing = CARD_PARTS
    .map(name => name.replace(/\.js$/, ""))
    .filter(tag => !source.includes(`"${tag}"`));
  if (missing.length) {
    throw new Error(`${label} bundle is missing card registrations: ${missing.join(", ")}`);
  }
}

assertCardRegistrations(fullBody, "Full");

const fullHash = crypto.createHash("sha256").update(hacsBody).digest("hex").slice(0, 12);
const editorHash = crypto.createHash("sha256").update(editorBody).digest("hex").slice(0, 12);

const manifestFile = "nodalia-cards.manifest.js";
const loaderFile = "nodalia-cards.js";
const VERSIONED_BUNDLE_PATTERN = /^nodalia-cards-(?:core-|suite-|editor-)?\d+(?:\.\d+){2,}(?:-(?:alpha|beta|rc)\.\d+)?\.js$/;
const REDUNDANT_BUNDLE_FILES = new Set(["nodalia-cards.bundle.js"]);

const fullFooter = `;if(typeof window!=="undefined"){window.__NODALIA_BUNDLE__=${JSON.stringify({
  pkgVersion: pkg.version,
  contentSha256_12: fullHash,
})};if(typeof console!=="undefined"&&typeof console.info==="function"){console.info("%c nodalia-cards %c v${pkg.version} (${fullHash}) ","background:#22343f;color:#fff;padding:4px 8px;border-radius:999px 0 0 999px;font-weight:700;","background:#3f6a80;color:#fff;padding:4px 8px;border-radius:0 999px 999px 0;font-weight:700;");}}`;

const editorFooter = `;if(typeof window!=="undefined"){window.__NODALIA_EDITOR__=${JSON.stringify({
  pkgVersion: pkg.version,
  contentSha256_12: editorHash,
})};window.NodaliaEditorUI=window.__NODALIA_EDITOR__;}`;

const inlineLoaderFooter = file => `;if(typeof window!=="undefined"){window.__NODALIA_LOADER__=${JSON.stringify({
  mode: "inline",
  pkgVersion: pkg.version,
  contentSha256_12: fullHash,
  file,
})};}`;

const manifest = {
  pkgVersion: pkg.version,
  contentSha256_12: fullHash,
  file: loaderFile,
  loaderFile,
  hacsFile: loaderFile,
  editorSha256_12: editorHash,
};

const manifestSource = `export default ${JSON.stringify(manifest, null, 2)};
export const pkgVersion = ${JSON.stringify(pkg.version)};
export const contentSha256_12 = ${JSON.stringify(fullHash)};
export const file = ${JSON.stringify(loaderFile)};
`;

function writeFileAtomic(filePath, contents) {
  const tempPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
  let completed = false;
  try {
    fs.writeFileSync(tempPath, contents, { encoding: "utf8", flag: "wx", mode: 0o644 });
    fs.renameSync(tempPath, filePath);
    completed = true;
  } finally {
    if (!completed) {
      try {
        fs.unlinkSync(tempPath);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  }
}

const hacsLoaderSource = `${hacsBody}\n${editorFooter}\n${fullFooter}\n${inlineLoaderFooter(loaderFile)}\n`;
writeFileAtomic(path.join(root, manifestFile), manifestSource);
writeFileAtomic(path.join(root, loaderFile), hacsLoaderSource);

// Prune every former duplicate only after the canonical HACS artifact was
// replaced atomically, so interrupted builds never remove the working bundle.
for (const name of fs.readdirSync(root)) {
  if (!VERSIONED_BUNDLE_PATTERN.test(name) && !REDUNDANT_BUNDLE_FILES.has(name)) {
    continue;
  }
  fs.unlinkSync(path.join(root, name));
  console.log(`Removed redundant bundle ${name}`);
}

const formatKb = bytes => `${(bytes / 1024).toFixed(0)} KB`;
console.log(
  `Wrote single HACS bundle ${loaderFile} (${formatKb(Buffer.byteLength(hacsLoaderSource))}, ${fullHash}).`,
);
