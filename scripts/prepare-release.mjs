import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const channels = ['alpha', 'beta', 'rc', 'stable'];
export function nextVersion(current, channel) {
  if (!channels.includes(channel)) throw new Error(`Unknown release channel: ${channel}`);
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/.exec(current);
  if (!match) throw new Error(`Unsupported current version: ${current}`);
  const [, major, minor, patch, previous, count] = match;
  if (previous && channels.indexOf(channel) < channels.indexOf(previous)) throw new Error('Cannot downgrade a prerelease channel');
  const base = `${major}.${minor}.${previous ? patch : Number(patch) + 1}`;
  return channel === 'stable' ? base : `${base}-${channel}.${previous === channel ? Number(count) + 1 : 1}`;
}
export function promoteChangelog(source, version, date) {
  const match = /^## (?:\[Unreleased\]|Unreleased)\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(source);
  if (!match || !/^[-*] .+/m.test(match[1])) throw new Error('Add curated user-facing notes under Unreleased before preparing a release');
  if (source.includes(`## [${version}]`)) throw new Error(`Changelog already contains ${version}`);
  return source.slice(0, match.index) + `## [${version}] - ${date}\n${match[1]}` + source.slice(match.index + match[0].length);
}
export function prepareRelease(directory, channel, { dryRun = false, date = new Date().toISOString().slice(0, 10) } = {}) {
  const packagePath = path.join(directory, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const version = nextVersion(pkg.version, channel);
  const changelog = channel === 'stable' ? 'CHANGELOG.md' : 'CHANGELOG-PRERELEASES.md';
  const files = new Map([[changelog, promoteChangelog(fs.readFileSync(path.join(directory, changelog), 'utf8'), version, date)]]);
  for (const name of ['ROADMAP.md', 'docs/ARCHITECTURE.md', 'docs/nodalia-integration.md', '.github/ISSUE_TEMPLATE/bug_report.yml', '.github/ISSUE_TEMPLATE/question.yml', '.github/ISSUE_TEMPLATE/translation.yml']) {
    const file = path.join(directory, name);
    if (fs.existsSync(file)) files.set(name, fs.readFileSync(file, 'utf8').replaceAll(pkg.version, version));
  }
  files.set('package.json', JSON.stringify({ ...pkg, version }, null, 2) + '\n');
  if (!dryRun) for (const [name, content] of files) fs.writeFileSync(path.join(directory, name), content);
  return { version, files: [...files.keys()] };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const channel = process.argv[2] || 'stable';
  const dryRun = process.argv.includes('--dry-run');
  const result = prepareRelease(root, channel, { dryRun });
  console.log(`${dryRun ? 'Would prepare' : 'Prepared'} ${result.version}: ${result.files.join(', ')}`);
  if (!dryRun) {
    for (const script of ['scripts/sync-card-version.mjs', 'scripts/build-bundle.mjs']) {
      const result = spawnSync(process.execPath, [script], { cwd: root, stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
    console.log(`Review the diff, run pnpm validate, commit and tag v${result.version}. No commit, tag, push or publication was performed.`);
  }
}
