import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractChangelogSection } from './generate-stable-release-notes.mjs';

export function generatePrereleaseNotes(version, changelog) {
  if (!/^\d+\.\d+\.\d+-(alpha|beta|rc)\.\d+$/.test(version)) throw new Error(`Invalid prerelease version: ${version}`);
  const section = extractChangelogSection(changelog, version, 'CHANGELOG-PRERELEASES.md');
  const repository = 'https://github.com/danielmigueltejedor/nodalia-cards';
  const notes = section.replace(/^###(#{0,3}) /gm, '##$1 ').replace(/\]\(\.\/([^)]+)\)/g, `](${repository}/blob/v${version}/$1)`);
  return `# Nodalia Cards ${version}\n\nPreview build. Enable prereleases in HACS to select this version.\n\n${notes}\n`;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [version, output] = process.argv.slice(2);
  if (!version || !output) throw new Error('Usage: generate-prerelease-notes.mjs <version> <output-file>');
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const notes = generatePrereleaseNotes(version, fs.readFileSync(path.join(root, 'CHANGELOG-PRERELEASES.md'), 'utf8'));
  fs.mkdirSync(path.dirname(path.resolve(root, output)), { recursive: true });
  fs.writeFileSync(path.resolve(root, output), notes);
}
