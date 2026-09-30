import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePrereleaseNotes } from '../scripts/generate-prerelease-notes.mjs';

test('prerelease notes use only the matching curated section and versioned links', () => {
  const changelog = '## [2.3.0-alpha.50] - 2026-09-30\n\n### Fixed\n- Center controls. See [guide](./docs/testing.md).\n\n## [2.3.0-alpha.49]\n\n### Fixed\n- Previous fix.\n';
  const notes = generatePrereleaseNotes('2.3.0-alpha.50', changelog);
  assert.match(notes, /Center controls/);
  assert.doesNotMatch(notes, /Previous fix/);
  assert.match(notes, /blob\/v2\.3\.0-alpha\.50\/docs\/testing\.md/);
  assert.throws(() => generatePrereleaseNotes('2.3.0', changelog), /Invalid prerelease/);
  assert.throws(() => generatePrereleaseNotes('2.3.0-beta.1', changelog), /no release section/);
  assert.throws(() => generatePrereleaseNotes('2.3.0-alpha.50', '## [2.3.0-alpha.50]\n'), /needs a summary/);
});
