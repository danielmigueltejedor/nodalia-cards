import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const manifestModule = await import(`../nodalia-cards.manifest.js?release=${Date.now()}`);
const manifest = manifestModule.default;
const releaseDir = path.join(root, "release");

if (manifest?.pkgVersion !== pkg.version) {
  throw new Error(`Manifest version ${manifest?.pkgVersion || "missing"} does not match package ${pkg.version}. Run the bundle first.`);
}

const distributedFiles = [
  manifest.loaderFile,
  `nodalia-cards-${pkg.version}.js`,
  manifest.splitCoreFile,
  manifest.splitSuiteFile,
  manifest.editorFile,
  ...(manifest.compatLoaderFiles || []),
  manifest.file,
  "nodalia-cards.manifest.js",
  "LICENSE",
  "README.md",
  "hacs.json",
  "CHANGELOG.md",
  "CHANGELOG-PRERELEASES.md",
  "THIRD_PARTY_NOTICES.md",
];

const distributedAssets = distributedFiles.map(name => {
  if (!name) {
    throw new Error("Required release asset is missing: <empty>");
  }
  const filePath = path.join(root, name);
  try {
    return { filePath, contents: fs.readFileSync(filePath) };
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Required release asset is missing: ${name}`, { cause: error });
    }
    throw error;
  }
});

fs.mkdirSync(releaseDir, { recursive: true });

const components = Object.keys(pkg.devDependencies || {}).sort().map(name => {
  const packagePath = path.join(root, "node_modules", ...name.split("/"), "package.json");
  let installed;
  try {
    installed = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    installed = { version: String(pkg.devDependencies[name]) };
  }
  return {
    type: "library",
    name,
    version: String(installed.version || pkg.devDependencies[name]),
    scope: "excluded",
    purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(String(installed.version || pkg.devDependencies[name]))}`,
  };
});

function deterministicUuid(value) {
  const bytes = crypto.createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const sbom = {
  bomFormat: "CycloneDX",
  serialNumber: `urn:uuid:${deterministicUuid(`${pkg.name}@${pkg.version}`)}`,
  specVersion: "1.5",
  version: 1,
  metadata: {
    component: {
      type: "application",
      name: pkg.name,
      version: pkg.version,
    },
  },
  components,
};
const sbomPath = path.join(releaseDir, "nodalia-cards.sbom.cdx.json");
const sbomSource = `${JSON.stringify(sbom, null, 2)}\n`;
fs.writeFileSync(sbomPath, sbomSource);

const checksumAssets = [
  ...distributedAssets,
  { filePath: sbomPath, contents: Buffer.from(sbomSource) },
];
const checksumLines = checksumAssets.map(({ filePath, contents }) => {
  const digest = crypto.createHash("sha256").update(contents).digest("hex");
  return `${digest}  ${path.basename(filePath)}`;
});
const checksumPath = path.join(releaseDir, "SHA256SUMS");
fs.writeFileSync(checksumPath, `${checksumLines.join("\n")}\n`);

const releaseAssets = [...checksumAssets.map(asset => asset.filePath), checksumPath];
const assetListPath = path.join(releaseDir, "release-assets.txt");
fs.writeFileSync(assetListPath, `${releaseAssets.map(filePath => path.relative(root, filePath)).join("\n")}\n`);

console.log(`Validated ${distributedFiles.length} required assets and wrote ${path.relative(root, checksumPath)}.`);
