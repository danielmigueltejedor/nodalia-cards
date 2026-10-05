# Technical audit — version 3

Updated 2026-10-05. This document describes the current implementation and release
readiness. Historical migration checkpoints are retained in Git history and
release notes, rather than presented as current unresolved findings.

## Migration outcome

All 284 source modules, including 25 cards, visual editors and shared runtimes,
have canonical TypeScript source. Strict compiler checks and typed ESLint apply
across `src/`. Suppression and runtime import-cycle inventories are empty and
remain enforced by `pnpm architecture:check`.

`src/cards/registry.json` supplies both distribution builders. Shared runtime
artifacts map back to checked entries in `RUNTIME_ENTRIES`. Root generated JS,
custom elements, editor events, compatibility globals and old YAML aliases remain
public contracts. No runtime npm dependencies are introduced.

## Verified corrections

| Area | Current behavior / verification |
|---|---|
| Sections | Native wrapper ownership follows live automatic/fixed row changes and releases its local observer on detach; sibling collapse and fixed Graph heights remain covered |
| Lock | Centered icons, shared Styles controls and deliberate unlock gestures; native Lock embedding in Summary |
| Media | Equal side columns center transport; artwork palettes are cached and committed with covers; entrance preserves backdrop reflection |
| Vacuum | `charger_disconnected` is localized; constrained text truncates with ellipsis and retains the full title |
| Summary | Media remains on Home; parked embeds release owned resources; ordinary HA updates preserve child identity |
| Async work | Requests, timers, observers and persistence callbacks reject retired configuration/HA contexts |
| Native interaction | Focus and unfinished drafts survive updates; cancelled gestures restore previews without sending commands |
| Notifications | API v3 rain `{value}` remains a probability alias; explicit temperature fields retain valid zero and configured units; empty forecasts remain authoritative |
| Distribution | Both HACS and standalone builds use canonical sources; every distributed JS receives a syntax check |
| Publication | PRs and tag releases share static and four-browser gates; curated notes and exact version/artifact metadata are required |

These behaviors have Node and browser regressions in `tests/` and `tests/browser/`.
See [architecture](ARCHITECTURE.md) for ownership boundaries and
[testing](testing.md) for reproducible commands.

## General runtime audit — 2026-10-05

The review covered render invalidation, auxiliary-state discovery, async ownership,
bounded caches, native Sections geometry, generated distribution and the existing
interaction/lifecycle regressions across the 25 cards and shared runtimes.
It adds focused corrections rather than replacing working render gates or
introducing a new framework.

| Finding | Correction and evidence |
|---|---|
| Switching an existing Sections cell between automatic and fixed rows leaves the wrapper in its old mode | Observe only that cell's class; release owned block display for fixed rows and restore it for automatic rows. Browser regressions exercise both directions, multiple row sizes and detachment without remounting the card. |
| Explicit Advance Vacuum room/activity tracking fingerprints every HA entity even with auto-detection off | Cache only configured helper availability in this mode and read values live. A 1700-unrelated-entity fixture drops 105 catalog enumerations to zero across the same 105 discovery calls. Helper arrival/removal and mutable values remain covered; automatic discovery still detects in-place registry changes. The cache no longer retains unused HA snapshots. |
| A News helper write can survive a configuration or HA-owner change | Cancel queued writes on configuration, connection, authentication, user and admin changes; reload helper history in the new context. Browser tests reproduce the old configuration write and exercise context changes, while ordinary same-owner updates still produce their intended write. Existing explicit local history storage remains compatible. |
| Repeated numeric formatting creates locale formatters for every value | Graph, Gauge and Power Flow reuse a cache capped at 64 locale/precision pairs. Tests compare native formatting for grouping, zero/negative zero, six locales, precision bounds, absent data and eviction. A synthetic helper benchmark records an approximately 10× improvement; this is not a dashboard frame-rate claim. |

Before source changes, the new targeted regressions reproduced both row-mode
failures, all 105 unnecessary catalog scans and the retired News write against
the published alpha.9 bundle. Current strict types, lint, architecture,
distribution, translations, size budgets and **794 Node tests** pass.
See [performance verification](performance-audit.md) for measurement conditions.

Reviewed safeguards that remain in place include Summary's cached normalization
and child reuse; Media's separate volume/progress synchronization; Camera/go2rtc
stream disposal; Graph/history retirement; Calendar/Weather forecast ownership;
and cancelled device/map gestures. These rely on the existing browser suite in
addition to source inspection; they are not a guarantee for every real HA setup.

Follow-up profiling targets are Notifications' full entity/device registry
serialization and automatic vacuum discovery. Their mutable metadata affects
source attribution and robot matching, so caching only by object identity would
introduce stale-state bugs. Measure these paths on a representative dashboard
before changing their invalidation contracts.

## Repository cleanup for stable preparation

At the earlier cleanup checkpoint a source dependency scan reached all 282 modules from card/standalone/runtime
entries. None can be removed merely because it is not a root resource.
Seven retired editor-catalog shards contain 767 entries already present in every
canonical editor locale. Their one-shot merge/fill scripts, an outdated row-patch generator
that omits three maintained rows, and two local machine translation caches are
removed. Current generator inputs, all 12 locales,
standalone artifacts and zero-debt guard files are retained.

Current guides replace obsolete JS-refactor and visual-layout design documents.
The separate experimental layout branch remains recorded in the roadmap.
Weblate sync now rebuilds and stages checked locale data, root lookup artifacts,
the HACS bundle and manifest together; a TypeScript-only generated change must
also trigger synchronization.

## Validation evidence and limits

The subsequent [bundle-size audit](BUNDLE_SIZE_AUDIT.md) uses published alpha.5
as its baseline and reduces the resource from 4,324,238 to 4,132,872 raw bytes
and from 968,592 to 942,929 gzip bytes. It preserves all public and distribution
contracts, validates 791 Node regressions, compares all 25 editors against the
original bundle and retains the existing size budgets. Historical counts below
describe the earlier migration/cleanup checkpoints.

The published `3.0.0-alpha.4` runtime passed 776 Node regressions, local
Chromium/WebKit/iPhone checks (905 passed, one platform skip), and all four Linux
CI browser projects. Its minified bundle is 4,325,270 bytes; gzip is 967,877 bytes.
Existing limits remain 4,325,376 raw and 972,800 gzip bytes.

Cleanup validation regenerates artifacts without the removed caches/shards and
passes strict types, lint, translations, distribution checks and all 783 Node
regressions, including seven Weblate commit/push regressions. The generated
TypeScript, standalone JS, bundle and manifest remain byte-identical. A scan finds
no broken local documentation paths. The cleanup PR also runs normal CI gates.
See the cleanup pull request checks for the exact final revision; counts above
refer to the published alpha runtime, not a claim about a future stable tag.

Automated HA fixtures do not prove every integration/device combination or
large-dashboard frame rate. Headless WebKit may omit backdrop rasterization;
media checks combine computed styles, ancestor composition and pixel comparisons
with each engine's own settled result. Native Safari/desktop dashboard checks
remain useful. New artwork still requires network/image decoding on a cold load.
See [performance profiling](performance-audit.md) for a manual procedure.

## Stable release readiness

The TypeScript migration is complete. The final alpha audit prepares `3.0.0-beta.1`, freezing features, architecture
and public contracts for stabilization. See [the release-readiness report](BETA_READINESS_AUDIT.md)
for current measurements and exact-version gates. Publication remains a separate
tag/release step. Stable notes are drafted in
`CHANGELOG.md`; promotion must update package declarations, roadmap, integration
references and generated artifacts through the release script, validate the exact
commit, then publish and verify its tag. See [releasing](releasing.md).
