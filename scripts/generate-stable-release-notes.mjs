import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractStableChangelog(changelog, version) {
  if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version)) {
    throw new Error(`Stable release notes require a stable version, received: ${version}`);
  }

  const heading = new RegExp(`^## \\[${escapeRegExp(version)}\\](?:\\s+-\\s+[^\\n]+)?\\s*$`, "m");
  const match = heading.exec(changelog);
  if (!match) {
    throw new Error(`CHANGELOG.md has no stable section for ${version}`);
  }

  const sectionStart = match.index + match[0].length;
  const remainder = changelog.slice(sectionStart);
  const nextHeading = remainder.search(/^## \[/m);
  const section = (nextHeading === -1 ? remainder : remainder.slice(0, nextHeading)).trim();

  if (!section || !/^###\s+/m.test(section)) {
    throw new Error(`CHANGELOG.md section ${version} needs a summary and at least one detailed subsection`);
  }

  return section;
}

export function buildStableReleaseNotes({ version, changelogSection }) {
  const repositoryUrl = "https://github.com/danielmigueltejedor/nodalia-cards";
  const releaseSection = changelogSection
    .replace(/^###(#{0,3}) /gm, "##$1 ")
    .replace(/\]\(\.\/([^)]+)\)/g, `](${repositoryUrl}/blob/v${version}/$1)`);

  return `# Nodalia Cards ${version}

This is a **stable release** for regular HACS installations. The summary below focuses on what changes on your dashboard and anything worth reviewing before you update.

${releaseSection}

---

## Updating from HACS

1. Open **HACS → Frontend → Nodalia Cards** and select **Update**.
2. When the download finishes, reload Home Assistant in every open browser or Companion App view.
3. If an older card version is still shown, clear that client's frontend cache and reload once more. You do not need to add a new Lovelace resource: HACS continues using \`/hacsfiles/nodalia-cards/nodalia-cards.js\`.

Before updating a production dashboard, review any **Breaking changes** or **Migration** subsection above and keep a backup of custom YAML that you cannot easily recreate.

## Integrity and support

- The countable GitHub release asset is \`nodalia-cards.js\`. Build provenance, \`SHA256SUMS\` and an SBOM are recorded as GitHub attestations.
- For a reproducible problem, [open a bug report](${repositoryUrl}/issues/new?template=bug_report.yml) with your Home Assistant version, browser, card YAML and console errors.
- Preview-by-preview development details remain in [CHANGELOG-PRERELEASES.md](${repositoryUrl}/blob/v${version}/CHANGELOG-PRERELEASES.md).
`;
}

export function generateStableReleaseNotes(version, changelogPath = path.join(root, "CHANGELOG.md")) {
  const changelog = fs.readFileSync(changelogPath, "utf8");
  const changelogSection = extractStableChangelog(changelog, version);
  return buildStableReleaseNotes({ version, changelogSection });
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const [version, outputArg] = args;
  if (!version || !outputArg) {
    throw new Error("Usage: node scripts/generate-stable-release-notes.mjs <version> <output-file>");
  }

  const outputPath = path.resolve(root, outputArg);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, generateStableReleaseNotes(version));
  console.log(`Wrote polished stable release notes to ${path.relative(root, outputPath)}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
