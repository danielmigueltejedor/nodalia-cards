# Technical audit — 2026-09-29

Baseline: `355a307c` / 2.3.0-alpha.49. This is an implementation audit, not a
claim that the earlier filename migration completed TypeScript checking.
The findings below describe that baseline; dated implementation sections record
completed work and current remaining debt.

Release target: **3.0.0-alpha.1**, as requested on 2026-10-01. Publish only
after the entire migration is checked and validated; do not issue another
2.3.0 alpha or treat the remaining unchecked modules as complete.

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
- Latest local validation: strict types, lint, translations, build and 616 unit tests
  pass. Full Chromium/WebKit/iPhone run: 236 passed, one existing platform skip, including Scenes, Lock editor styles and
  Summary native Lock, editor color and Vacuum status regressions. Linux CI
  remains required for Firefox and the final committed artifacts.

The full TS migration remains open: **78 unchecked modules and no runtime import cycles** are explicitly tracked. No new suppressions or `any` shortcuts were
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

## Device pointer helpers — findings before implementation

Fan, Humidifier and Cover duplicate identical slider/dial geometry with untyped
DOM and range inputs. Their dial arc is 135–405 degrees in all three cards. Extract
this shared math with explicit rectangles/ranges and preserve quantization, dead
zone and gap behavior. Malformed dial values can currently produce NaN marker
coordinates; guard them without changing valid ranges or service behavior. Then
check the remaining family helpers, retaining their distinct unavailable policies.

Device pointer stage validated: 602 unit tests and the full local browser suite
(233 passed, one existing platform skip) pass. Real dial gestures in all three
cards send exactly one midpoint service call on release, including iPhone.
Helpers are checked with typed lint and no suppressions; remaining debt is 85.
Ten Node cases cover quantized/fractional steps, cached geometry, pointer/marker
round trips, center/gap retention, malformed values and distinct domain policies.

## Small configuration and packaging stage — findings before implementation

Alarm Panel and Person config/helpers are compact but still unchecked. Their
normalizers assume a typed default survives unknown overrides; check record
boundaries and use the checked CSS projection while preserving Person's explicit
action entity and Alarm's code-input/timer aliases. Six checked card families
repeat the same stub entity selection and size parsing; share only those exact
helpers. Standalone utils embedding still has a manual 24-card inventory missing
Lock, and README incorrectly calls HACS the only generated runtime. Bring them
into line with the 25-card registry without changing the public distribution.

Room Summary's small editor helpers also require checked unknown config/list
boundaries. Keep array-aware YAML paths and prototype guards while typing those
operations; malformed hub lists must not throw or be treated as character lists.

Small configuration stage validated: 610 unit tests and the full local browser
suite (233 passed, one existing platform skip). Alarm Panel and Person preserve
code-input aliases, timing bounds, HA action objects, explicit action entities,
service allowlists and unknown extensions. Their config/helpers and Room Summary
helpers pass strict checking and typed lint without suppression. Summary paths
retain array creation and reject prototype/non-index array paths; malformed hub
lists no longer throw. Shared stub helpers preserve six cards' domain selection.
Standalone utils embedding now consumes all 25 registry artifacts, with an
idempotent embed/strip round trip including Lock. Remaining unchecked debt: 80.

## Light normalization and color stage — findings before implementation

Light repeats the checked stub/slider helpers but still suppresses its config
and colors. Preserve quick-brightness bounds, four preset slots, legacy inactive
colors and keep-collapsed aliases. Read unknown animation/style branches through
record guards before checking the normalizer. RGB conversion currently lets NaN
channels produce an invalid hue/saturation pair; validate all three channels.
Keep Kelvin/mired direction and valid hexadecimal/temperature behavior.

Light unit stage: 616 tests pass. Eighteen complete normalized configurations
were compared with the merged baseline, including native action objects, legacy
aliases, brightness/presets, styles and extension fields; every valid result is
identical. Nonfinite RGB channels now return null instead of an invalid HS pair.
Real Color-mode selection and preset service calls pass Chromium/WebKit/iPhone.
Remaining tracked unchecked TS modules: 78; handwritten compatibility runtime
modules also remain part of the open migration. The alpha publication hold stays.

Light full browser stage: 236 passed, one existing platform skip across local
Chromium/WebKit/iPhone. Preset selection uses the real Color-mode UI and sends
finite hue/saturation without changing the four-slot normalization contract.


## Climate cleanup — verified

The standalone entry eagerly retained an unregistered 759-line legacy editor;
no public API, custom element registration or caller used it. Removed that class
and its keep-alive lookup, plus a duplicate import. Both distributions retain the
registered lazy visual editor and public schedule API. The standalone artifact
shrinks from 358,550 to 329,564 bytes. Behavioral tests cover Engine-managed
schedules and populated legacy webhook/helper fields without Engine. All 618
unit tests and the full local browser suite (236 passed, one existing platform
skip) pass. This cleanup does not change the remaining unchecked count of 78.


## Fav / Insignia checked boundaries — verified

Four config/helper modules now pass strict checking and typed lint. Keep Fav’s
HA action objects, security rules and neutral bubble migration; retain Insignia’s
legacy tint aliases, explicit tint precedence and own-property editor paths.
Their icon and numeric policies differ and remain independent. Shared stub and
style helpers remove exact duplication, with guarded unknown style/tint branches.
Twenty-eight complete valid configurations match the merged baseline. Six new
unit cases cover malformed YAML, aliases, actions, prototype rejection and domain
policies. Validation: 624 unit tests; full local browser suite 239 passed, one
existing platform skip. Insignia’s real tint/default icon geometry and updates
pass all three local browser projects. Remaining unchecked modules: 74.


## Notifications mobile policy — checked source and generated runtime

Replaced the handwritten public JS implementation with a pure checked TS model
and a generated idempotent window adapter. Exact public keys, frozen API, aliases,
quiet-hour boundaries, presence context, severity/cooldown rules and 40-chunk
limit remain intact. Window typings now derive from the actual API and correctly
allow a null next-boundary delay. The model needs no DOM or HA global; malformed
public identity/presence payloads are guarded instead of throwing.

Differential validation preserves 12,288 complete delivery decisions and 55
alias normalizations against merged main. All 628 unit tests and the full local
browser suite (239 passed, one existing platform skip) pass. Typed lint includes
the policy and both Insignia modules explicitly. Unchecked TS debt remains 74;
utils, backend, bubble contrast and i18n lookup still require source migration.
The publication hold remains in force.


## Engine client — checked protocol boundary and generated runtime

Replaced the handwritten backend with a checked TS client and idempotent global
adapter. Runtime declarations derive from the actual API, correcting the old
two-argument schedule signature and eliminating unused parallel override types.
HA transports explicitly return unknown promises; handshake records are narrowed
before reading capabilities, health and limits. Invalid capability entries and
non-record health/limit branches are excluded. Valid wire data is unchanged.

Sixteen versioned command envelopes and five complete handshake snapshots match
merged main. Added receiver/transport fallback, exact 30-second TTL, force/reset,
connection identity, malformed wire and adapter coverage. All 632 unit tests and
the local full browser suite (239 passed, one existing platform skip) pass. No
new unchecked module or runtime cycle. Strict source migration remains open,
with 74 unchecked TS modules plus generic utils, bubble contrast and i18n lookup.


## Bubble contrast — checked source, live theme colors and canonical build inputs

Migrated the contrast model and DOM probe into checked TS and generated the
existing public filename. Shared CSS Color 4 parsing now recognizes translucent
sRGB/space/percentage RGB and alpha hex in hue decisions. Old valid hue and
contrast behavior is retained for 648 colors across three entity cases.

The raw-string cache incorrectly retained theme-variable values after a theme
change. Theme-dependent values now resolve synchronously on each use; fixed
colors retain the bounded 256-entry cache. A finally block removes the temporary
DOM probe even when resolution fails. Unit coverage verifies cache eviction,
probe cleanup, neutral aliases, semantics and adapter identity. A real-browser
regression changes a CSS variable from orange to blue and sees the new hue
immediately, with no leaked probe.

HACS now imports canonical TS runtime entries from the same build inventory,
allowing shared color parsing to be bundled once while all standalone filenames
remain intact. Validation: 637 unit tests; targeted color/editor browser cases
18 passed; full local suite 242 passed, one existing platform skip. Unchecked
TS debt is still 74. Generic utils and root i18n lookup remain unported; the full
migration and alpha publication remain pending.


## Tooling refresh — compatibility reviewed

Updated typescript-eslint 8.70.1 to 8.71.0 after reviewing upstream release notes
and peer constraints (ESLint 10 supported; TypeScript >=4.8.4 and <6.1 supported).
Keep TypeScript 6.0.3: the available 7.0.2 major is outside those peer constraints.
Updated the official actions/cache SHA from v4.3.0 to v6.1.0 after checking its
Node 24 runtime, unchanged used inputs and minimum runner requirement. Quality
gates already use GitHub-hosted ubuntu-latest and other Node 24 actions.

All 637 unit tests, strict checking, lint, build and fast checks pass after the
update; generated artifacts are unchanged. A fresh dependency audit reports
zero vulnerabilities across 130 development dependencies. Outdated reports now
list only the deliberately deferred TypeScript major. The browser CI exercises
all four projects with the new cache action before integration.


## Display-card config boundaries — 2026-10-01

Weather, Circular Gauge and News config modules now pass strict checking and
typed lint without suppression. Runtime APIs derive the normalizer signatures
from source. Check unknown records before reading layout/filter/source/style
branches, and reconstruct styles through the common checked CSS projection.
Retain Weather’s restricted actions and forecast/unit values, Gauge’s string or
numeric bounds and optional foreground tint, and News’s source aliases, layout
visibility, filters and helper-history compatibility. Root extension fields
remain unknown and preserved rather than silently claimed to match defaults.

Twenty-four complete valid configurations match merged main. Five regression
cases cover malformed YAML, CSS injection, actions, bounds, source rows and
history aliases. All 642 unit tests and the full local browser suite (242 passed,
one existing platform skip) pass. Remaining unchecked modules: 71; the views
and helper modules of these cards remain in the open migration.


## Weather helper findings — 2026-10-01

Weather still suppresses forecast/date/unit helpers and duplicates checked stub,
size and editor compaction logic. Its numeric coercion treats null or blank data
as zero; absent precipitation probability can mask a real precipitation amount
with “0%”, and absent dates can render the Unix epoch. Guard missing values while
keeping actual zero, numeric strings and epoch timestamp 0. Check forecast record
boundaries and retain condition/Meteoalarm/unit mappings and valid date/locale
formatting. Share exact editor compaction with Insignia, preserving false/zero
and rejecting unsafe keys.

Weather helpers now pass strict checking and typed lint. The actual view's two
numeric converters also use the checked parser, so missing values stay absent
through rendering. Reuse shared stub/size helpers and checked editor compaction
with Insignia. Seven new unit cases and the rendered forecast regression cover
missing/zero distinctions, precipitation fallback, dates, mappings and units.
2,103 valid helper results match merged main. All 649 unit tests and the full
local browser suite (245 passed, one existing platform skip) pass. Remaining unchecked
modules: 70. Weather's view and editor still remain in the migration.

## Navigation helper findings — 2026-10-01

Navigation suppresses checks around route matching, artwork URLs, render
signatures and editor paths. Query parameters are appended after a fragment
when an artwork URL contains one, and parameter names are used as unescaped
regular expressions. Its path helpers duplicate Insignia's object-only editor
semantics; share that coherent responsibility while guarding inherited branches
and unsafe keys. Keep Room Summary's different array-aware paths separate.
Duration formatting can output NaN for Infinity and list moves accept fractional
indices. Guard malformed inputs while preserving valid paths, route boundaries,
media URL sanitization and signature fallback behavior.

Navigation helpers now pass strict checking and typed lint. Shared object-only
editor paths preserve numeric object keys, reject unsafe keys and avoid mutating
inherited branches. Reuse the checked render-signature fallback; retain existing
optional runtime identity. Query insertion preserves fragments and treats names
literally. Guard nonfinite durations, noninteger list indices and control
characters in runtime CSS. Seven new unit cases pass; 836 valid helper results
match merged main. All 656 unit tests and the full local browser suite (245
passed, one existing platform skip) pass. Remaining unchecked modules: 69.

## Circular Gauge helper findings — 2026-10-01

Gauge helpers suppress style, color, numeric, stub and geometry checking. The
view converts empty range defaults and null native values to zero, overriding
automatic ranges or displaying unavailable readings as zero. Missing decimals
also become zero instead of using state precision. Guard numeric inputs through
the real view. Keep explicit zero bounds, comma decimal state values, valid
dial geometry and tint interpolation. Share finite numeric parsing with Weather.
The old RGB parser misreads percentages and cannot read modern computed sRGB;
reuse the checked color parser. Its DOM color probe needs finally cleanup.

Regression coverage also revealed that a kW sensor named “power” gets the W
range before kW is considered. Give explicit physical units priority over
friendly-name/domain heuristics; retain those heuristics when units are unknown.

Gauge helpers now pass strict checking and typed lint. Share numeric parsing
with Weather, stub/size selection, checked style projection and CSS Color 4
channels. Keep exact geometry and interpolation for valid stops, guard malformed
scale entries and remove color probes in finally. The actual view preserves
absent readings and automatic bounds/precision, explicit zeros and comma decimal
states. Seven new unit cases pass; 4,374 valid color/geometry/format/style results
match merged main. All 663 unit tests and the full local browser suite (248
passed, one existing platform skip) pass. The added real kW/decimal sequence
also passes the three local projects before integration. Remaining unchecked
modules: 68; Gauge view/editor checking is still open.

## Documentation and demo cleanup — 2026-10-01

Repository-wide reference searches find only the optimized animation GIFs in
README and no consumers or generation scripts for the original animation GIFs.
Remove the two unused originals (14,954,034 bytes total); retain optimized demos
and their existing URLs. Preserve historical audit records, clearly identify
the 2.2.2 checkpoint as historical, and update the active build/validation
instructions to the 25-card registry, strict/lint/static checks and four-browser
gate. No distributed card asset or public API is removed.

Cleanup validation: no missing relative links in README or documentation. All
fast checks and 663 unit tests pass, with no generated distributed asset changes.

## Camera helper findings — 2026-10-01

Camera's config/helper boundary still suppresses typing around stream/action
rows, config merging, editor paths and signed URL caches. The local editor path
setter lacks unsafe-key checks; use a shared array-aware path helper with Room
Summary and protect inherited branches. Unknown action/stream lists must be
checked before compaction. Keep the distinct append-only Camera query semantics,
provider aliases, mixed-content proxy behavior and signing ownership/TTL/retry.
Guard unknown sign_path responses rather than trusting their path field; retain
valid stream behavior and all public API filenames.

Signing tests also expose the minimum 60-second cache interval outliving
explicit signed-path lifetimes shorter than 60 seconds. Bound cache retention
by the requested expiry; keep the existing default lifetime and early-refresh
margin. Guard absent preview-age timestamps without turning them into epoch
readings, while retaining actual timestamp 0.

Share fragment-preserving query construction with Navigation while retaining
Camera's append-only behavior and Navigation's replacement behavior. Camera
queries now remain before fragments too.

Camera config/helpers now pass strict checking and typed lint; public methods
derive from actual source and the public object uses satisfies rather than a
cast. Preserve mixed numeric/CSS style leaves and root YAML extensions. Share
protected array paths with Room Summary, and fragment-preserving query
construction with Navigation while keeping their distinct query behavior.
Seven unit regressions cover path ownership, malformed rows/config, scoped
actions, provider aliases, signing coalescing/TTL/ownership, retry and age/query
boundaries. 387 valid Camera configuration/action/stream/query outputs match
merged main. All 670 unit tests pass; full local browser suite: 248 passed, one
existing platform skip. After the final malformed camera-ID guards, all 39
Camera/Navigation/Summary browser cases pass. Remaining unchecked modules: 66;
Camera view and editor remain in the migration.

## Graph helper findings — 2026-10-01

Graph's suppressed chart/config helpers duplicate checked compaction, signature,
size and list-move behavior. Empty readings become numeric zero, including blank
history values; guard absent numeric data while preserving comma decimals and
real zero. Check SVG point and history-event boundaries before geometry/buckets,
keep smoothing and carry-forward averaging for valid data, and handle nonfinite
time/count inputs without generating invalid SVG or array indices. Protect
attribute paths and preserve editor placeholder rows. The actual view must
ignore malformed history rows before accessing their fields.

Normalize Graph history counts to whole values between 20 and 10,000 (default
100; explicit zero retains its old default behavior). Nonfinite counts no longer
throw or generate invalid bucket indices, and an extreme YAML count cannot
allocate an unbounded chart. The low-level sampler also bounds allocation.

Graph config/helpers now pass strict checking and typed lint; public method
declarations derive from source and the public object uses satisfies. Reuse
checked compaction, signature fallback, size parsing, list reordering with
Navigation and numeric formatting with Gauge. Ignore malformed history and
statistics records before the actual view reads them; missing readings remain
absent, while real zero and comma decimals remain valid. Six new unit cases and
a real rendered two-source regression cover numeric/geometry/bucket/config/path
boundaries. 1,915 valid smoothing/sampling/format/config/padding outputs match
merged main. All 676 unit tests and the full local browser suite (251 passed,
one existing platform skip) pass. Remaining unchecked modules: 64; Graph view
and editor remain in the migration. Document sampling and allocation bounds in
`docs/cards/graph-card.md`.

## Calendar helper findings — 2026-10-01

Calendar still suppresses config, event/date, forecast, metadata and formatter
helpers. Editor color fallbacks reference DEFAULT_CONFIG without importing it;
extract defaults to a cycle-free module and use that actual shared configuration.
Missing forecast numeric candidates become zero before valid alternative fields
are considered. Guard absent values while keeping real zeros. Date-only parsing
rolls invalid dates into another day; use strict local parsing while retaining
noon for all-day events and midnight for date input. Guard event records and
metadata tints, preserve recurrence keys and timezone-date prefixes, and type
the bounded 48-entry Intl formatter cache.

The rendered regression also exposed zero-based months in the current-weather
fallback and forecast freshness scoring, although normalized forecast keys use
one-based months. Use the same day-key/parser path throughout forecast lookup
and scoring. Keep the separate internal month-grid keys unchanged. The fallback
now ignores absent numeric attributes just like forecast alternatives.

Calendar config/helpers pass strict checking and typed lint. Shared style
projection accepts an explicit sanitizer so Calendar retains its existing URL
rejection policy and YAML style extensions. Defaults live in a cycle-free
module; duplicate clone/merge/compaction/weather icon code is retired. Real
Calendar editor color changes preserve alpha. Six new unit cases cover dates,
metadata, events, config, numeric alternatives and the 48-entry formatter cache;
run in Europe/Madrid and America/Los_Angeles. 2,000 valid helper/config outputs
match merged main. All 682 unit tests pass. Four duplicate untracked files from
the previous Graph stage were removed only after byte-for-byte comparison.
Remaining unchecked modules: 62; Calendar view/editor remain in the migration.
Full local browser suite: 257 passed, one existing platform skip. Publication
remains held until the full migration is checked.

## Media Player helper findings — 2026-10-01

Media helpers still suppress typechecking and duplicate slider math, stub
selection, list moves, duration formatting, signature fallback, query building
and color parsing. Query construction has the previously fixed Navigation
fragment/literal-key bugs. Legacy RGB parsing cannot read modern resolved theme
colors, and temporary probes are not removed if style resolution throws.
Editor paths can read inherited/prototype fields. Preserve empty entity rows
during compaction, and retain valid control geometry/palette behavior while
checking unknown boundaries. An unused helper normalizes power actions using an
undefined deepClone reference; verify there are no callers and remove this dead
implementation/imports, leaving the separate live config policy unchanged.

Media helpers now pass strict checking and typed lint. Reuse the checked slider,
stub, list, signature and query helpers; share duration/artwork URL handling
with Navigation and modern RGB/luminance parsing with Gauge. Empty entity rows
remain during recursive compaction through an explicit preserved-key option;
other consumers retain their existing empty-value behavior. JSON input is
narrowed as unknown and formatting always returns a string. Read own path
fields only, while retaining Media's empty-segment behavior. The unused power
helper and both unused imports are retired after a repository-wide caller
search; the live config normalization policy remains unchanged. Temporary theme
color probes are removed in finally even when style resolution fails.

Six new unit cases cover JSON, placeholders, colors, URLs, path/move boundaries,
sliders and probe cleanup. Replace the implementation-shape empty-row test with
a real editor clear/commit regression, and add real modern-theme switching in
the browser. 3,000 valid helper outputs match merged main. All 687 unit tests
pass; six targeted browser cases pass. Remaining unchecked modules: 61; Media
config/view/editor remain in the migration.
Full local browser suite: 263 passed, one existing platform skip. Publication
remains held until the complete migration is checked.

## Media/Navigation configuration findings — 2026-10-01

Both configuration modules still suppress checking. Media aliases and runtime
code write/read nested layout/styles without guarding malformed YAML branches.
Navigation spreads an unknown root and projects nested media blocks without
checking records. Style values reach stylesheet interpolation unsanitized.
Guard records, sanitize known CSS leaves while retaining YAML extensions, and
preserve routes/items, single-player/nested-player aliases, power-action and
strict-service policies. Media numeric artwork options currently turn absent
values into zero; keep explicit zero but apply defaults to absent/nonnumeric
values. Use actual checked public normalizer declarations.

Both configuration modules now pass strict checking and typed lint. Guard
root/layout/media/style records, sanitize known CSS leaves with the shared
projection, and keep style extensions. Navigation drops malformed route, popup
and player rows while retaining empty editor records and routes/items
precedence; route objects remain cloned independently of the input. Media
keeps single-player/string-layout/nested Navigation aliases, empty player rows
and the existing power-action/default service policies. Artwork numeric
options retain explicit zero while absent inputs use documented defaults.
Public normalizer contracts derive from source and registration uses satisfies.

Five new unit cases cover alias compatibility, numeric bounds, record guards,
CSS projection, independent route cloning and policies. 1,000 valid configs
match merged main. All 692 unit tests and three targeted browser cases pass.
Remaining unchecked modules: 59; both views/editors remain in the migration.
Full local browser suite: 266 passed, one existing platform skip. Publication
remains held until the complete migration is checked.

## Power Flow configuration/helper findings — 2026-10-01

Power Flow still suppresses config, SVG parsing/layout, node and formatting
helpers. A close-path command followed by numeric tokens never advances the
reader, so malformed input can loop forever. Guard progress and retain exact
valid SVG geometry, including compressed arc flags. Missing numeric values
become zero, large whole kilowatt values lose a trailing zero, invalid
coordinates generate NaN paths, and malformed entities can receive property
writes. Type token/point/record boundaries, share checked editor utilities and
protect config blocks without changing valid energy/layout rules.

Power Flow config/helpers pass strict checking and typed lint. Defaults are
extracted into a cycle-free module with actual clone bindings; the editor's
previous missing DEFAULT_CONFIG reference is removed. Guard entities/chips
records, retain independently cloned defaults, and keep empty individual editor
rows. Shared helpers provide stub selection, size parsing, recursive compaction,
list reordering (retaining Power Flow's void return) and finite formatting.

SVG close-path handling returns its existing safe fallback when stray numeric
tokens follow it; token reader indices are bounded. Guard point/radius inputs
and nonfinite individual positions without changing valid connector geometry.
Fix kilowatt trimming to remove decimal zeros only; single missing readings and
the actual consumption-chip formatter stay absent, while split-source fallback
math retains its existing zero semantics. Six new unit cases include a bounded
VM timeout for malformed paths, every supported command family, packed arc
flags, config/numeric/layout boundaries and editor defaults. 4,800 valid
SVG/config/layout/format outputs match merged main. All 698 unit tests and three
real rendered kilowatt/blank/zero browser cases pass. Remaining unchecked
modules: 57; Power Flow view/editor remain in the migration. Add a current Power
Flow guide and link it, Graph and Lock in the README.
Full local browser suite: 269 passed, one existing platform skip. Publication
remains held until the complete migration is checked.

## Room Summary configuration findings — 2026-10-01

Summary's projection/model and helpers are checked, but configuration still
suppresses checking and its public methods are declared as arbitrary unknown
argument lists. Narrow camera/media/embed records, return actual string/list
projection fields, and preserve the private normalization marker plus cached
object identity without asserting an unknown marker-bearing object has a typed
shape. Media player IDs are normalized by the model from unknown values; reflect
that actual boundary in its input contract. Preserve Home-only media and native
Lock embedding. The model numeric helper currently coerces blank metrics to
zero; keep blank metrics absent without changing actual zeros or comfort rules.

Summary config passes strict checking and typed lint. Camera/media/embed
records and actual string/list projection fields are checked; defaults/aliases,
independent nested clones, native Lock IDs and Home media behavior remain.
Retain the private non-enumerable marker and normalized object identity through
a typed weak cache; a forged or foreign marker does not bypass normalization.
The model's player-ID contract accepts unknown IDs because its existing add
function normalizes them, rather than asserting configuration rows are strings.
Public methods now derive directly from checked modules and registration uses
satisfies. Blank metrics remain absent with the shared finite parser; nonblank
nonnumeric state text, actual zeros and comfort/security calculations remain.

Five new unit cases cover aliases, cloned nested blocks, media IDs, embed
matching, normalization cache/forged markers and metric absence. 1,500 valid
config/projection outputs match merged main. All 703 unit tests and three real
rendered metric cases pass. Remaining unchecked modules: 56; Summary view and
editor remain in the migration.
Full local browser suite: 272 passed, one existing platform skip. Publication
remains held until the complete migration is checked.

## Entity configuration and model findings — 2026-10-01

Entity suppresses checking in configuration and helpers. Its graph algorithms
duplicate Graph, accept malformed points, and can generate nonfinite SVG or
unbounded sample arrays. Empty AQ readings coerce to a good level; empty graph
settings coerce to minimal ranges. Nested malformed styles can throw before
sanitization. Configuration redeclares imported overview constants. Merged default pm25 is
empty and masks the pm2_5/pm2.5 aliases; normalize the actual configured value
before selecting aliases. Preserve
valid geometry, thresholds, action fallbacks and style policy while narrowing
these boundaries and reusing equivalent shared algorithms.

Entity config/helpers now pass strict checking and typed lint. Guard nested
style groups before neutral-bubble normalization and use the equivalent checked
CSS projection; keep action fallbacks and security policy. Empty graph options
use defaults, PM2.5 aliases survive merged defaults, and missing AQ readings
remain unknown. Threshold tables and valid color/format behavior are unchanged.
Retire duplicated imported constants, stub/size helpers and SVG/history
algorithms; Graph and Entity use a shared finite geometry module. Filter invalid
series samples, reject nonfinite geometry and cap allocation at 10,000 points
(the Entity configuration limit remains 96). Derive public AQ methods from
source, including parseAirQualityNumeric's actual NaN absence convention.

Five new unit cases cover config/actions/aliases, missing data, graph safety,
bucket averaging, continuous hover and HA state formatting. 5,000 valid
Entity/Graph config, geometry, history, hover, threshold and format outputs match
merged main. All 708 unit tests pass; real malformed-style/zero browser cases
pass in all three local projects. Full suite: 275 passed, one existing platform
skip. Remaining unchecked modules: 54; Entity view/editor remain in migration.
Add an Entity guide and README link. Publication stays held until completion.

## Climate model findings — 2026-10-01

Climate's extracted model still disables checking despite unknown public
signatures. It duplicates size, RGB and luminance helpers, only parses comma
RGB, leaves temporary color probes behind on resolution failure, and accepts
boolean/object numeric coercion as temperature. Narrow the HA/DOM boundary,
reuse checked color/numeric helpers and preserve valid temperature, unit and
mode behavior. Reject malformed locales safely without changing valid ones.
The actual browser regression found Chromium gives an empty computed color
for an unslotted light-DOM probe; attach it inside the existing shadow root.

Climate model now passes strict checking and typed lint. Shared finite number,
size, RGB and luminance helpers preserve valid temperature/unit/dial behavior;
boolean/object coercions remain absent. Locale validation falls back to English
only for malformed locale tags. Color probes use the existing shadow root on a
card host and are removed in finally; this fixes the real Chromium empty-color
regression, with modern translucent CSS colors supported across browsers.
Five new unit cases cover numeric/range/unit data, locales, override timestamps,
color resolution cleanup and HVAC mode precedence. 2,500 valid format/dial/color
outputs match main. All 713 unit tests and three targeted real browser cases
pass; full local browser suite: 278 passed, one existing platform skip. Remaining
unchecked modules: 53. Schedule and view/editor still require migration; the
next alpha remains held.

## Climate schedule findings — 2026-10-01

Schedule normalization/storage, agenda geometry and webhook builders still
suppress checking. Unknown records are dereferenced by several helpers; empty
temperatures and target bounds coerce to zero. Direct base64 decoding throws on
malformed input and packed numeric corruption decodes into plausible schedule
slots. Check these boundaries while retaining valid v1/v2/v3 encoding, five-
minute quantization, quarter-degree temperatures, size limits and action shape.
Climate config already checks but asserts unknown security/styles and trusts the
merged YAML as a ClimateConfig; replace those assertions with actual projection.

Climate schedule now passes strict checking and typed lint. Actual schedule
slot/config types replace unguarded record access; packed numeric ranges, base64
errors and legacy row times are validated. Missing temperatures default to 21,
real zeros remain values, and absent dual bounds are not synthesized as zero.
Normalize agenda and webhook inputs, guard track geometry and keep valid storage
quantization, versions, payload/action shape and the helper length policy.
Climate config now projects unknown YAML into its declared fields, security
lists and CSS groups without asserting security/styles; legacy color migration
and equivalent shared stub/size helpers remain. Public methods derive from
checked source; week-start metadata is represented in the schedule contract.

Six new unit cases cover malformed/valid codecs, all weekdays and quarter-degree
values, agenda/hover geometry, nested config/security and webhook payloads.
4,500 valid schedule/codec/agenda/webhook/config outputs match main. All 719 unit
tests and three real malformed-config/zero browser cases pass; full local
browser suite: 281 passed, one existing platform skip. Remaining unchecked
modules: 52. Publish **3.0.0-alpha.1** only after migration completion; package
version stays at the latest published build during migration.

## News helper findings — 2026-10-01

News helpers suppress checking and publish arbitrary unknown argument lists.
Timestamp values can exceed the Date range and crash ISO generation; epoch
zero loses its date/identity. History rows with an id bypass shape validation.
Render/history stamps omit summaries/images/URLs and every item after the first
12, so updates can remain stale. Reuse equivalent compaction/editor-path helpers,
narrow feed/history/HA inputs, and retain sorting, source filters, helper size
limits and asynchronous service-write rejection handling.

News helpers now pass strict checking and typed lint. Feed/history/source inputs
are narrowed, date values are bounded and epoch zero remains a real timestamp.
Identified history rows are validated and complete content stamps detect summary,
image, URL and later-item updates. Equivalent shared compaction and object paths
replace duplicates without changing editor policy. Public methods derive from
checked source. Six new unit cases and a real card refresh case cover these fixes.
4,000 valid feed/filter/history/helper outputs match main; render stamps deliberately
change to include previously omitted content. All 725 unit tests pass; full local
browser suite: 284 passed, one existing platform skip. Remaining unchecked
modules: 51. The next release remains 3.0.0-alpha.1 after full migration.

## Notifications helper findings — 2026-10-01

Templates, forecast/calendar inputs, registry records and background profile
builders still suppress checking. Missing numeric state/forecast values coerce
to zero; impossible all-day dates roll into another day. Editor paths traverse
inherited objects. Preserve notification compaction's object-null/array-empty
policy, actual delivery profiles/hashes and Engine ownership while narrowing
these boundaries and deriving real public template/mobile helper contracts.

Notifications helpers now pass strict checking and typed lint. Registry and
forecast/calendar rows are narrowed; missing numeric measurements, forecasts
and configured thresholds stay absent/default rather than coercing to zero.
Real zeros retain value/unit. Impossible all-day dates are rejected while valid
dates keep local midnight. Editor array paths filter empty segments and block
inherited/prototype traversal, retaining Notifications' distinct compaction policy.
Background templates/profiles/chunks and Engine read/write responses have actual
checked contracts; public APIs derive from source and external-alert ingestion
has one checked implementation. Config output exposes its normalized fields
instead of leaving them unknown. Add a linked Notifications guide.

Six new unit cases cover numeric/template values, registry lookup, array paths,
calendar/forecast data, profiles/chunks/temporary Engine failure, external alert
ingestion and legacy fallback. 4,800 valid template/registry/forecast/profile/
chunk/hash outputs match main. All 731 unit tests and three targeted real
browser cases pass; full local browser suite: 287 passed, one existing platform
skip. Remaining unchecked modules: 50. Hold 3.0.0-alpha.1 until full migration.

## Advanced Vacuum helper/config findings — 2026-10-01

Map/session/calibration helpers and merged config still suppress checking.
Missing coordinates coerce to zero; malformed room/selection rows are dereferenced,
linear algebra accepts ragged/nonfinite matrices, and URL query updates can write
after fragments. Narrow actual map geometry and calibration data, preserve valid
affine/projective transforms and session codecs, share equivalent style/stub/
compaction/query helpers, and reconstruct the normalized config/public contract.

Advanced Vacuum config and helpers now pass strict checking and typed lint.
Checked map point/rectangle/room types narrow raw geometry, calibration and
selection records. Missing coordinates remain absent, valid zero coordinates
are retained, ragged/nonfinite/singular systems cannot calibrate, and geometry
overflow yields finite fallback values. A regression found nested rectangle
collections classified as point tuples; distinguish them so room outlines remain
visible. Nested label/icon fields normalize to strings. Session codecs keep
valid identifiers and zones; missing encoded coordinates are rejected. Equivalent
shared style/stub/compaction/query helpers replace duplicates, including the
unused legacy style-tree export/import. Public config derives from source.

Seven new unit cases cover geometry, affine/projective/inverse transforms,
invalid systems, session/URL codecs, map selections and config/editor styles.
9,200 valid geometry/calibration/session/selection/style/config outputs match
main; nested rectangle classification deliberately changes to restore missing
rooms. All 738 unit tests and three targeted real room-mode browser cases pass;
full local browser suite: 290 passed, one existing platform skip. Remaining
unchecked modules: 48 (views/editors). Shared handwritten utility/i18n runtime
also remains pending. Hold 3.0.0-alpha.1 until the full migration is complete.

## News view/editor findings — 2026-10-01

The News view/editor still suppress checking after helper migration. Type actual
HTMLElement lifecycle, HA picker/event/focus and swipe/history/render boundaries.
One swipe suppression timeout is unowned; cancelled pointers can navigate and
config/render changes leave old gesture state attached. Empty numeric editor
fields coerce to zero and clamp to one instead of restoring the default.

News card/editor now pass strict checking and typed lint with actual normalized
config/history/render/swipe types, guarded DOM/custom event payloads and typed
HA editor focus/picker/lifecycle contracts read from the shared implementation.
Cancelled pointers no longer advance the carousel; reconfiguration/rerender
cancels abandoned gesture state, and disconnection owns/releases the article
tap-suppression timeout. Clearing the numeric item limit restores its default
instead of coercing an empty string to zero.

1,200 valid view/editor HTML and sizing outputs match main. All 738 unit tests
pass; six targeted gesture/lifecycle/editor browser cases pass. The first full
run encountered one Chromium ERR_CONTENT_LENGTH_MISMATCH before bundle import,
not a card assertion; the isolated Climate case passed, then the full rerun
passed 296 cases with one existing platform skip. Remaining unchecked modules:
46. Hold 3.0.0-alpha.1 until full migration, including shared runtime sources.

## Summary editor findings — 2026-10-01

The hub editor still suppresses checking, accesses unvalidated nested custom
events/child editor methods and can map non-array player payloads. Its normalized
config cache widens known projected fields back to unknown. Check actual editor
contracts and list operations, preserve metadata alignment, derive the cached
config from its builder, and guard nested editor/media/camera input boundaries.

Summary editor now passes strict checking and typed lint. The normalization
builder preserves known fields, root YAML extensions and its cached identity.
Actual nested editor methods, custom event records and player arrays are guarded;
list buttons accept only known lists and valid indices, with customization rows
moving/removing alongside their entities. A shared checked element contract guards
the dynamically loaded Media/Camera editors without suppressing their types.

1,400 valid normalized configurations and editor markup outputs match main,
including custom extensions and artwork/style fields; normalized identities are
retained. All 738 unit tests and six targeted list/nested-editor browser cases
pass. Full local browser suite: 302 passed, one existing platform skip.
Remaining unchecked modules: 45. Hold 3.0.0-alpha.1 until full migration,
including the handwritten shared utility/i18n runtime sources.
