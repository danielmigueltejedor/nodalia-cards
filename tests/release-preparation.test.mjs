import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nextVersion, promoteChangelog, prepareRelease, updateRoadmap } from '../scripts/prepare-release.mjs';

test('release preparation follows channels without downgrades', () => {
  assert.equal(nextVersion('2.3.0-alpha.49', 'alpha'), '2.3.0-alpha.50');
  assert.equal(nextVersion('2.3.0-alpha.49', 'beta'), '2.3.0-beta.1');
  assert.equal(nextVersion('2.3.0-beta.3', 'rc'), '2.3.0-rc.1');
  assert.equal(nextVersion('2.3.0-rc.1', 'stable'), '2.3.0');
  assert.equal(nextVersion('2.3.0', 'alpha'), '2.3.1-alpha.1');
  assert.throws(() => nextVersion('2.3.0-rc.1', 'alpha'), /downgrade/);
  assert.throws(() => nextVersion('garbage', 'alpha'), /Unsupported/);
});
test('release notes promote only curated Unreleased notes', () => {
  const old = '\n## [2.2.0] - 2026-01-01\n\n### Fixed\n- Older change.\n';
  const text = '# Changelog\n\n## Unreleased\n\n### Fixed\n- New user-visible change.\n' + old;
  const output = promoteChangelog(text, '2.3.0-alpha.50', '2026-09-30');
  assert.ok(output.includes('## [2.3.0-alpha.50] - 2026-09-30'));
  assert.ok(output.endsWith(old));
  assert.ok(output.includes('2026-09-30\n\n### Fixed'));
  assert.throws(() => promoteChangelog('## Unreleased\n\n', '2.3.0', '2026-09-30'), /curated/);
});
test('dry-run is read-only and missing notes never partially bump a version', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nodalia-release-test-'));
  try {
    const pkg = '{"name":"example","version":"2.3.0-alpha.49"}\n';
    fs.writeFileSync(path.join(root, 'package.json'), pkg);
    fs.writeFileSync(path.join(root, 'CHANGELOG-PRERELEASES.md'), '## Unreleased\n\n### Fixed\n- A fix.\n');
    assert.equal(prepareRelease(root, 'alpha', { dryRun: true }).version, '2.3.0-alpha.50');
    assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), pkg);
    fs.writeFileSync(path.join(root, 'CHANGELOG-PRERELEASES.md'), '# No notes\n');
    assert.throws(() => prepareRelease(root, 'alpha'), /curated/);
    assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), pkg);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('release publishing cannot bypass the shared browser quality gate', () => {
  const release = fs.readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  const quality = fs.readFileSync(new URL('../.github/workflows/quality.yml', import.meta.url), 'utf8');
  assert.match(release, /quality:\s+uses: \.\/\.github\/workflows\/quality.yml/);
  assert.match(release, /build-release:\s+needs: quality/);
  assert.match(quality, /project: \[chromium, firefox, webkit, webkit-iphone\]/);
  assert.match(quality, /git diff --exit-code/);
  assert.doesNotMatch(release, /continue-on-error/);
});

test('stable promotion retires the preview and advances the stable roadmap', () => {
  const source = fs.readFileSync(new URL('../ROADMAP.md', import.meta.url), 'utf8');
  const stable = updateRoadmap(source, '2.3.0', 'stable');
  assert.match(stable, /No active preview/);
  assert.match(stable, /Current stable release:\s+```text\s+2\.3\.0\s+```/);
  assert.doesNotMatch(stable, /2\.3\.0-alpha\.49|2\.2\.10/);
  const next = updateRoadmap(stable, '2.3.1-alpha.1', 'alpha');
  assert.match(next, /Current preview release:\s+```text\s+2\.3\.1-alpha\.1\s+```/);
  assert.match(next, /Stable \*\*`2\.3\.0`\*\* remains/);
  assert.throws(() => updateRoadmap('# Missing sections', '2.3.0', 'stable'), /sections are missing/);
});


test('Explicit major release preparation preserves channel and version ordering',()=>{
  assert.equal(nextVersion('2.3.0-alpha.49','alpha','3.0.0-alpha.1'),'3.0.0-alpha.1');
  assert.equal(nextVersion('2.3.0-rc.2','alpha','3.0.0-alpha.1'),'3.0.0-alpha.1');
  assert.equal(nextVersion('3.0.0-alpha.1','alpha','3.0.0-alpha.2'),'3.0.0-alpha.2');
  for(const version of ['3.0.0','3.0.0-beta.1'])assert.throws(()=>nextVersion('2.3.0-alpha.49','alpha',version),/channel/);
  for(const version of ['2.3.0-alpha.49','2.3.0-alpha.1','2.2.9-alpha.1'])assert.throws(()=>nextVersion('2.3.0-alpha.49','alpha',version),/advance/);
  assert.throws(()=>nextVersion('3.0.0','alpha','3.0.0-alpha.1'),/advance/);
  for(const version of ['3.0.0-alpha.0','03.0.0-alpha.1','invalid','3.0.0-alpha.01'])assert.throws(()=>nextVersion('2.3.0-alpha.49','alpha',version),/Unsupported/);
});
test('An explicit major dry-run is read-only and invalid versions cannot partially update release files',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nodalia-major-release-test-'));
  try {
    const pkg='{"name":"example","version":"2.3.0-alpha.49"}\n';
    fs.writeFileSync(path.join(root,'package.json'),pkg);
    fs.writeFileSync(path.join(root,'CHANGELOG-PRERELEASES.md'),'## Unreleased\n\n### Changed\n- Complete migration.\n');
    assert.equal(prepareRelease(root,'alpha',{version:'3.0.0-alpha.1',dryRun:true}).version,'3.0.0-alpha.1');
    assert.equal(fs.readFileSync(path.join(root,'package.json'),'utf8'),pkg);
    assert.throws(()=>prepareRelease(root,'alpha',{version:'2.3.0-alpha.48'}),/advance/);
    assert.equal(fs.readFileSync(path.join(root,'package.json'),'utf8'),pkg);
    assert.equal(prepareRelease(root,'alpha',{version:'3.0.0-alpha.1',date:'2026-10-02'}).version,'3.0.0-alpha.1');
    assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,'3.0.0-alpha.1');
    assert.match(fs.readFileSync(path.join(root,'CHANGELOG-PRERELEASES.md'),'utf8'),/## \[3\.0\.0-alpha\.1\] - 2026-10-02/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
