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

const UNSAFE_JS_CHAR_MAP = {
  "<": "\\u003C",
  ">": "\\u003E",
  "/": "\\u002F",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

function escapeUnsafeJsString(str) {
  return str.replace(/[<>\/\u2028\u2029]/g, ch => UNSAFE_JS_CHAR_MAP[ch]);
}

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
const coreBody = await buildParts(CORE_PARTS, "core");
const suiteBody = await buildParts([...CARD_SUPPORT_PARTS, ...CARD_PARTS], "suite");
const editorBody = await buildParts(EDITOR_PARTS, "editor");
// HACS installs only the file declared in hacs.json. Keep that entrypoint (and
// the equivalent full/versioned artifacts) self-contained so opening a visual
// editor never depends on an auxiliary module that HACS did not download.
// The editor remains a lazy sidecar only for the explicit core + suite build.
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
assertCardRegistrations(suiteBody, "Suite");

const fullHash = crypto.createHash("sha256").update(hacsBody).digest("hex").slice(0, 12);
const coreHash = crypto.createHash("sha256").update(coreBody).digest("hex").slice(0, 12);
const suiteHash = crypto.createHash("sha256").update(suiteBody).digest("hex").slice(0, 12);
const editorHash = crypto.createHash("sha256").update(editorBody).digest("hex").slice(0, 12);

const bundleFile = "nodalia-cards.bundle.js";
const manifestFile = "nodalia-cards.manifest.js";
const loaderFile = "nodalia-cards.js";
const versionedLoaderFile = `nodalia-cards-${pkg.version}.js`;
const coreFile = `nodalia-cards-core-${pkg.version}.js`;
const suiteFile = `nodalia-cards-suite-${pkg.version}.js`;
const editorFile = `nodalia-cards-editor-${pkg.version}.js`;
function deriveCompatLoaderFiles(version) {
  const configured = Array.isArray(pkg.nodalia?.compatVersions)
    ? pkg.nodalia.compatVersions.map(value => String(value || "").trim()).filter(Boolean)
    : [];
  if (configured.length) {
    return configured.map(value => `nodalia-cards-${value}.js`);
  }
  const match = String(version || "").match(/^(\d+\.\d+\.\d+)-(alpha|beta|rc)\.(\d+)$/);
  if (!match) {
    return [];
  }
  const [, base, channel, rawNumber] = match;
  const number = Number(rawNumber);
  return [number - 2, number - 1]
    .filter(candidate => candidate > 0)
    .map(candidate => `nodalia-cards-${base}-${channel}.${candidate}.js`);
}

const compatLoaderFiles = deriveCompatLoaderFiles(pkg.version);

const VERSIONED_BUNDLE_PATTERN = /^nodalia-cards-(?:core-|suite-|editor-)?\d+(?:\.\d+){2,}(?:-(?:alpha|beta|rc)\.\d+)?\.js$/;
const keepVersionedBundles = new Set([versionedLoaderFile, coreFile, suiteFile, editorFile, ...compatLoaderFiles]);

const fullFooter = `;if(typeof window!=="undefined"){window.__NODALIA_BUNDLE__=${JSON.stringify({
  pkgVersion: pkg.version,
  contentSha256_12: fullHash,
  editorFile,
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

const editorFooter = `;if(typeof window!=="undefined"){window.__NODALIA_EDITOR__=${JSON.stringify({
  pkgVersion: pkg.version,
  contentSha256_12: editorHash,
})};window.NodaliaEditorUI=window.__NODALIA_EDITOR__;}`;

const editorLoaderFooter = `;if(typeof window!=="undefined"&&window.NodaliaUtils){let editorPromise=null;const ensureEditorRuntime=()=>{if(window.NodaliaEditorUI){return Promise.resolve(window.NodaliaEditorUI);}if(!editorPromise){editorPromise=import("./${editorFile}").then(()=>window.NodaliaEditorUI).catch(error=>{editorPromise=null;throw error;});}return editorPromise;};window.NodaliaUtils.ensureEditorRuntime=ensureEditorRuntime;${escapeUnsafeJsString(JSON.stringify(CARD_PARTS.map(name => name.replace(/\.js$/, ""))))}.forEach(tag=>{const ctor=customElements.get(tag);if(!ctor||ctor.__nodaliaLazyEditorWrapped||typeof ctor.getConfigElement!=="function"){return;}const original=ctor.getConfigElement;ctor.getConfigElement=async function(...args){await ensureEditorRuntime();return original.apply(this,args);};Object.defineProperty(ctor,"__nodaliaLazyEditorWrapped",{value:true});});}`;

const inlineLoaderFooter = file => `;if(typeof window!=="undefined"){window.__NODALIA_LOADER__=${JSON.stringify({
  mode: "inline",
  pkgVersion: pkg.version,
  contentSha256_12: fullHash,
  file,
  fallbackFile: loaderFile,
  splitCoreFile: coreFile,
  splitSuiteFile: suiteFile,
  editorFile,
})};}`;

const compatibilityLoaderSource = file => `import "./${versionedLoaderFile}";
if(typeof window!=="undefined"){window.__NODALIA_LOADER__=${JSON.stringify({
  mode: "compat",
  pkgVersion: pkg.version,
  contentSha256_12: fullHash,
  file,
  targetFile: versionedLoaderFile,
  fallbackFile: loaderFile,
})};}
`;

const manifest = {
  pkgVersion: pkg.version,
  contentSha256_12: fullHash,
  file: bundleFile,
  loaderFile,
  hacsFile: loaderFile,
  compatLoaderFiles,
  splitCoreFile: coreFile,
  splitCoreSha256_12: coreHash,
  splitSuiteFile: suiteFile,
  splitSuiteSha256_12: suiteHash,
  editorFile,
  editorSha256_12: editorHash,
};

const manifestSource = `export default ${JSON.stringify(manifest, null, 2)};
export const pkgVersion = ${JSON.stringify(pkg.version)};
export const contentSha256_12 = ${JSON.stringify(fullHash)};
export const file = ${JSON.stringify(bundleFile)};
export const splitCoreFile = ${JSON.stringify(coreFile)};
export const splitSuiteFile = ${JSON.stringify(suiteFile)};
export const editorFile = ${JSON.stringify(editorFile)};
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
writeFileAtomic(path.join(root, bundleFile), `${hacsBody}\n${editorFooter}\n${fullFooter}\n`);
writeFileAtomic(path.join(root, manifestFile), manifestSource);
writeFileAtomic(path.join(root, loaderFile), hacsLoaderSource);
writeFileAtomic(path.join(root, versionedLoaderFile), `${hacsBody}\n${editorFooter}\n${fullFooter}\n${inlineLoaderFooter(versionedLoaderFile)}\n`);
compatLoaderFiles.forEach(file => {
  writeFileAtomic(path.join(root, file), compatibilityLoaderSource(file));
});
writeFileAtomic(path.join(root, coreFile), `${coreBody}\n${coreFooter}\n`);
writeFileAtomic(path.join(root, suiteFile), `${suiteBody}\n${suiteFooter}\n${editorLoaderFooter}\n`);
writeFileAtomic(path.join(root, editorFile), `${editorBody}\n${editorFooter}\n`);

// Only prune old versioned artifacts after every current artifact was written.
for (const name of fs.readdirSync(root)) {
  if (!VERSIONED_BUNDLE_PATTERN.test(name) || keepVersionedBundles.has(name)) {
    continue;
  }
  fs.unlinkSync(path.join(root, name));
  console.log(`Removed stale bundle ${name}`);
}

const formatKb = bytes => `${(bytes / 1024).toFixed(0)} KB`;
console.log(
  `Wrote ${loaderFile} + ${versionedLoaderFile} (${formatKb(Buffer.byteLength(hacsBody))}, ${fullHash}), `
  + `split ${coreFile} (${formatKb(Buffer.byteLength(coreBody))}, ${coreHash}) + `
  + `${suiteFile} (${formatKb(Buffer.byteLength(suiteBody))}, ${suiteHash}). `
  + `Lazy editor ${editorFile} (${formatKb(Buffer.byteLength(editorBody))}, ${editorHash}).`,
);
