# Technical audit — 2026-09-29

Baseline: `355a307c` / 2.3.0-alpha.49. This is an implementation audit, not a
claim that the earlier filename migration completed TypeScript checking.

## Critical / release safety

- The tag release workflow runs unit validation but publishes without browser
  validation or waiting for CI at the same commit. A failing interaction or
  Safari regression can therefore be published. Gate publication on the same
  reusable validation workflow used by PRs, including browsers and artifact drift.
- `node --check nodalia-*.js` checks only the first expanded file: the remainder
  are script arguments. Validate each distributed JavaScript artifact explicitly.

## Important

- 96 of 233 TS files disable checking with `@ts-nocheck` (119,631 lines).
  Strict/noImplicitAny/noUncheckedIndexedAccess/exactOptionalPropertyTypes are
  already enabled; turning on more flags does not check suppressed files.
  24 views, 24 editors, 23 helpers, 23 configs, a model and a schedule module
  remain unchecked. Do not replace suppressions with `any` or pretend they are
  migrated. Move independently testable contracts/models first and track the debt.
- The build has two parallel card lists and an alias map; package assets and
  architecture tests maintain further copies. Lock is built and registered but
  is missing from the architecture-contract test's 24-card inventory. Consolidate
  build metadata and test inclusion of every card, including Lock.
- Runtime support models and generic services remain handwritten root JS. Keep
  public window APIs and standalone artifact paths, but migrate pure source into
  typed modules rather than introducing another runtime framework.
- Version preparation still requires updating documentation, issue templates,
  declarations and changelog by hand. Automate preparation separately from
  publication; reject invalid channel transitions and missing release notes.
- `validate` excludes browser tests. CI repeats builds, has no browser cache and
  couples all work into one job. Make fast validation and full validation explicit.

## Technical debt

- View/controller modules reach 7,647 lines (Advanced Vacuum), 6,494 (Climate),
  5,679 (Media Player). Most complexity is template/editor markup. Extract only
  coherent, characterized responsibilities; do not rename/reformat whole files.
- Basic lint ignores 71 legacy view/editor/helper modules. Introduce executable
  checks for new debt/cycles and typed lint on genuinely checked modules before
  attempting noisy wholesale enforcement on unchecked code.
- HA fixtures and fake icon elements are repeated. Existing icon tests initially
  used empty custom elements that cannot reveal internal SVG alignment defects.
- Lock normalizes values but returns an input type with optional defaults.
  Distinguish user input from normalized runtime config and validate malformed YAML.
- Room Summary deliberately parks embeds in a DocumentFragment, invoking their
  disconnect cleanup. Camera removes streams, timers, portals and global listeners.
  Preserve this behavior. Portal cleanup currently removes listeners from the
  host although they were registered on its shadow root; correct that ownership.
- Historical architecture documentation describes earlier 24-card checkpoints.
  Add current developer guides and keep historical notes clearly identified.

## Optional / deliberately deferred until evidence

- Do not introduce `components/`, `hosts/`, `runtime/`, `shared/` layers merely
  to mirror a template. Keep colocated card/editor/config/types; use focused shared
  modules when at least two real consumers need the same behavior.
- Do not consolidate state predicates with subtly different domain meanings.
- Do not remove old config aliases, standalone files, or the self-contained HACS
  resource. Single-file HACS and explicit split distributions are public contracts.
- Dependency audit: 0 reported vulnerabilities across 130 dev dependencies,
  no production npm dependencies. Available updates: typescript-eslint 8.71.0
  and TypeScript 7.0.2. Keep TypeScript 6 during refactoring; no blind major update.

## Verification approach

Each implementation stage must pass lint, strict typecheck, unit tests and build;
UI/lifecycle changes also get browser regressions. Keep YAML/defaults/tag/asset
contracts. Use Chromium/WebKit/iPhone locally; Firefox also runs in Linux CI
because the local macOS Firefox profile cannot launch reliably. Compare generated
assets and include release-gate tests. Record remaining unchecked modules honestly.

## Implemented and verified — 2026-09-30

- Central card registry includes all 25 cards; generated version declarations share
  `src/version.ts`. Root filenames, custom element tags and HACS packaging stay stable.
- CI and tag releases use a shared static + four-browser gate; every distributed
  JavaScript file receives a syntax check. Release preparation requires curated notes.
- Camera stream, render signatures and Room Summary projections have checked TS
  sources and compatibility adapters. Camera portal listener ownership is corrected.
- Six config/helper cycles were removed through defaults and checked Notifications normalization modules. Scenes config
  and helpers now pass strict checking and lint without suppression; malformed YAML,
  scene rows, styles and editor placeholders have behavioral coverage.
- Media transport uses equal side columns. Cached palettes apply synchronously;
  new covers and tint commit together, stale requests are ignored and sampling has
  a bounded timeout. Artwork keys exclude state timestamps so volume/progress changes
  do not invalidate the cover. First loads retain a translucent theme fallback until
  image data exists; fetching an unseen image still depends on the network.
- HA fixture construction is shared by browser and Node tests. Developer guides
  cover adding cards, testing and release preparation.
- Latest local validation: strict types, lint, translations, build and 592 unit tests
  pass. Full Chromium/WebKit/iPhone run: 224 passed, one existing platform skip, including Scenes, Lock editor styles and
  Summary native Lock, editor color and Vacuum status regressions. Linux CI
  remains required for Firefox and the final committed artifacts.

The full TS migration remains open: **88 unchecked modules and no runtime import cycles** are explicitly tracked. No new suppressions or `any` shortcuts were
introduced. This stage is foundational work, not a declaration that the entire
migration is finished.

Lock now shares editor controls with Entity, exposes sanitized style settings and
keeps deliberate unlock semantics. Summary embeds native Lock cards and keeps
media on Home only. Requested Sections minimum widths are 4/4/6/6 for
Alarm Panel, Entity, Weather and Calendar respectively.

Control configuration stage: Fan, Humidifier and Cover now check unknown YAML
without suppression, and their public APIs expose the actual normalized fields.
Unvalidated extension fields remain unknown. Fan/Humidifier share checked action
and style normalization; primitive style branches no longer crash the inactive
icon migration. Ten regressions cover malformed inputs, HA action objects, double
tap, service restrictions, CSS rejection, and mutation isolation.

Editor color stage: a real Chromium probe confirmed a translucent orange resolved
as `color(srgb 1 0.533333 0 / 0.24)` became `#010100` in Lock, and changing it
saved an opaque hex value. The checked shared color model now handles RGB, sRGB,
percentages and alpha hex; browser conversion handles wider color spaces. Twenty
helper modules retain their exports while removing duplicate conversion logic.
Lock also keeps alpha on input changes. Unit regressions exercise each helper
consumer; browser regressions cover Lock, Entity, Fan and Notifications and wider
gamut conversion. Current bundle: 4,304,273 bytes / 949,882 gzip bytes, down
20,202 / 7,366 bytes from the previous merged stage, with budgets unchanged.

Animation verification stage: Linux CI passed all four projects for the control/
color changes, but two iPhone animation tests needed retries. Their CSS animations
were paused while the card's JS cleanup timers continued on wall time, allowing
slow workers to detach the measured elements. Tests now install the Playwright
clock before loading the bundle, pause lifecycle time, and advance rendering and
cleanup explicitly. A deliberate 750ms wall-time stall exceeds the original
600ms timer; every measured element must remain connected. Existing trajectory,
class, grid-track and final cleanup assertions remain. Ten runs per device/project
passed locally (90 cases, Chromium/WebKit/iPhone), with retries disabled. All 589
unit tests still pass. Production animation code and durations are unchanged.

## Vacuum and repository cleanup stage — findings before implementation

- `charger_disconnected` is missing from both reported-state and error dictionaries.
  Vacuum's unrecognized reported states bypass the dictionary, so adding the locale
  entry alone would not fix every integration. Keep genuine errors ahead of activity.
- Status chips set ellipsis on an inline-flex container; its anonymous text item
  cannot truncate. Constrain a dedicated text span while retaining the full title.
- Nine untracked macOS “ 2” files are byte-identical copies of canonical files.
  Remove only verified duplicates.
- The 23 source extractors slice historical JS by fixed line numbers. All target
  TS modules exist and the build now generates JS from them; these unused one-shot
  scripts cannot regenerate the current sources. Retire them and obsolete editor/
  lazy-wrapper mutation scripts after checking their callers. Retain translation
  generators, shared data, runtime adapters and public distribution artifacts.

Vacuum stage validated: 592 unit tests and 12 narrow-layout browser cases across
Chromium, WebKit and iPhone pass. Both auxiliary status and error sensors display
“Cargador desconectado”; ellipsis now constrains the grid item's intrinsic width
as well as the inner text, and the battery remains visible. Vacuum config/helpers
are checked without suppression; unknown extension fields remain unknown.
23 fixed-line extractors and five completed mutation scripts were retired after
checking tracked callers. Nine identical untracked “ 2” copies were removed.
Historical audit snapshots remain explicitly historical; current architecture and
contribution instructions now match the registry, generated assets and release gate.
The next alpha is deferred until the full strict migration is complete.
