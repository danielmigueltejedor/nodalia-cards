import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildStableReleaseNotes,
  extractStableChangelog,
} from "../scripts/generate-stable-release-notes.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("stable notes extract only the requested curated changelog section", () => {
  const changelog = `# Changelog

## [Unreleased]

## [3.1.0] - 2026-09-01

A user-facing summary.

### Highlights

- A useful change.

## [3.0.0] - 2026-08-01

An older release.

### Fixed

- An old fix.
`;

  const section = extractStableChangelog(changelog, "3.1.0");
  assert.match(section, /A user-facing summary/);
  assert.match(section, /### Highlights/);
  assert.doesNotMatch(section, /An older release/);
});

test("stable notes reject preview versions and incomplete changelog entries", () => {
  assert.throws(
    () => extractStableChangelog("## [3.1.0-alpha.1]\n\n### Changed\n", "3.1.0-alpha.1"),
    /stable version/,
  );
  assert.throws(
    () => extractStableChangelog("## [3.1.0] - 2026-09-01\n\nOnly a sentence.\n", "3.1.0"),
    /at least one detailed subsection/,
  );
});

test("stable notes combine curated changes with practical HACS update and support guidance", () => {
  const notes = buildStableReleaseNotes({
    version: "3.1.0",
    changelogSection: "A polished summary.\n\n### Fixed\n\n- See [details](./docs/details.md).",
  });

  assert.match(notes, /^# Nodalia Cards 3\.1\.0/m);
  assert.match(notes, /A polished summary/);
  assert.match(notes, /^## Fixed$/m);
  assert.doesNotMatch(notes, /^### Fixed$/m);
  assert.match(notes, /blob\/v3\.1\.0\/docs\/details\.md/);
  assert.match(notes, /## Updating from HACS/);
  assert.match(notes, /hacsfiles\/nodalia-cards\/nodalia-cards\.js/);
  assert.match(notes, /Breaking changes/);
  assert.match(notes, /SHA256SUMS/);
  assert.match(notes, /countable GitHub release asset is `nodalia-cards\.js`/);
  assert.match(notes, /issues\/new\?template=bug_report\.yml/);
});

test("release workflow keeps generated preview notes separate from curated stable notes", () => {
  const workflow = read(".github/workflows/release.yml");
  const previewBranch = workflow.match(/if \[\[ "\$GITHUB_REF_NAME" == \*-\* \]\]; then([\s\S]*?)else/)?.[1] || "";
  const stableBranch = workflow.match(/else([\s\S]*?)\n\s*fi/)?.[1] || "";

  assert.match(previewBranch, /--generate-notes/);
  assert.match(previewBranch, /--prerelease/);
  assert.doesNotMatch(previewBranch, /generate-stable-release-notes/);
  assert.match(stableBranch, /generate-stable-release-notes\.mjs/);
  assert.match(stableBranch, /--notes-file release\/release-notes\.md/);
  assert.doesNotMatch(stableBranch, /--generate-notes|--prerelease/);
});
