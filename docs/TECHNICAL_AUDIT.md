# Technical audit — version 3

Updated 2026-10-03. This document describes the current implementation and release
readiness. Historical migration checkpoints are retained in Git history and
release notes, rather than presented as current unresolved findings.

## Migration outcome

All 282 source modules, including 25 cards, visual editors and shared runtimes,
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
| Lock | Centered icons, shared Styles controls and deliberate unlock gestures; native Lock embedding in Summary |
| Media | Equal side columns center transport; artwork palettes are cached and committed with covers; entrance preserves backdrop reflection |
| Vacuum | `charger_disconnected` is localized; constrained text truncates with ellipsis and retains the full title |
| Summary | Media remains on Home; parked embeds release owned resources; ordinary HA updates preserve child identity |
| Async work | Requests, timers, observers and persistence callbacks reject retired configuration/HA contexts |
| Native interaction | Focus and unfinished drafts survive updates; cancelled gestures restore previews without sending commands |
| Notifications | Rain templates receive weather temperature, including valid zero and configured units; empty forecasts remain authoritative |
| Distribution | Both HACS and standalone builds use canonical sources; every distributed JS receives a syntax check |
| Publication | PRs and tag releases share static and four-browser gates; curated notes and exact version/artifact metadata are required |

These behaviors have Node and browser regressions in `tests/` and `tests/browser/`.
See [architecture](ARCHITECTURE.md) for ownership boundaries and
[testing](testing.md) for reproducible commands.

## Repository cleanup for stable preparation

A source dependency scan reaches all 282 modules from card/standalone/runtime
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

The TypeScript migration is complete. The current package stays on its published
alpha version while stable preparation is reviewed. Stable notes are drafted in
`CHANGELOG.md`; promotion must update package declarations, roadmap, integration
references and generated artifacts through the release script, validate the exact
commit, then publish and verify its tag. See [releasing](releasing.md).
