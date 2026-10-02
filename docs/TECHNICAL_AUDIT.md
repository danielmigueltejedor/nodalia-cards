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

## Scenes editor findings — 2026-10-01

The Scenes visual editor still suppresses checking across native/HA picker
events, list rows and raw nested style/haptic configuration. Check those
boundaries, preserve draft scene rows and focus, and treat blank numeric fields
as absent rather than coercing them to zero.

The Scenes view also keeps unchecked hold/DOM/translation/animation boundaries.
Its fallback timeouts lack ownership and failed scene service calls can throw or
reject unhandled. Two legacy timer maps are initialized but never read/written
and can be removed after adding ownership for the actual fallback timers.

Scenes view/editor now pass strict checking and typed lint. Checked normalized
rows and derived entries/styles guard raw nested config and translations; typed
DOM and shared native/HA picker boundaries preserve focus and draft rows.
Blank numeric overrides clear to defaults. Actual fallback animation timers are
owned and cancelled on disconnect, pending hold/suppression state resets on
config changes/disconnect, and synchronous/rejected service failures are handled.
Remove two verified unused timer maps. Bubble contrast's actual input contract
now describes entity ID and optional attributes, matching its existing reads.

1,400 valid editor HTML outputs (including open styles/actions) and 2,100 valid
card markup/sizing outputs match main. All 738 unit tests pass; nine targeted
real-browser editor/service-failure/lifecycle cases pass. One older static
source assertion was updated to accept the captured shadow root while still
requiring the same event names and capture/passive flags. Full local browser
suite: 311 passed, one existing platform skip. Remaining unchecked
modules: 43. Hold 3.0.0-alpha.1 until full migration, including shared handwritten
utility/i18n runtime sources.

## Insignia editor findings — 2026-10-01

The badge editor suppresses checking and trusts native/HA custom event payloads
and raw nested haptic/security/style groups. Check actual picker/focus/field
contracts, preserve configuration extensions, and guard these nested boundaries.

The badge view also trusts service JSON, action paths and visibility rules, and
leaves consumed tap state across disconnect/config changes. Its render signature
omits picture, unit and device class, so those changes can leave old imagery,
values or tint. Check actual entity/action/DOM contracts and these boundaries.

Insignia view/editor now pass strict checking and typed lint. Config keeps known
entity/action string fields plus YAML extensions. Actual HA picker, focus,
keyboard, drawer, state and translation boundaries are checked; malformed
nested groups fall back in the editor. Render signatures include picture, unit
and device class. Hold/tap state resets on reconnect/reconfiguration. Checked
shared service JSON accepts object data retaining false/zero and rejects
malformed/scalar/array data; service invocation handles synchronous/rejected
failures, and navigation paths use the existing URL validator. Verified unused
card/editor imports were removed.

1,400 valid editor HTML and 1,400 valid card HTML/grid sizing outputs match main.
All 740 unit tests pass, including two service boundary cases; twelve targeted
real-browser name/focus/state/keyboard/service/lifecycle cases pass. The first
editor test expected a service-only security control without selecting a service
action; after correcting the fixture, all six editor cases passed. Full local
browser suite: 323 passed, one existing platform skip. Remaining
unchecked modules: 41. Hold 3.0.0-alpha.1 until full migration, including shared
handwritten utility/i18n runtime sources.

## Fav editor findings — 2026-10-01

The Fav visual editor suppresses checking for native/HA pickers, fallback entity
options, alarm/actions and raw nested haptic/security groups. Check actual
config/DOM/picker contracts, retain custom YAML extensions and focus, and guard
malformed custom event and nested group payloads.

Fav editor now passes strict checking and typed lint. Config preserves known
normalized style/action fields and root YAML extensions. Checked native/custom
picker payloads, entity option filtering, focus and field contracts preserve
native/HA control fallbacks, alarm PIN/helper fields and information-only actions.
Malformed haptic/security groups fall back safely. Four verified unused imports
are removed, and shared sort/collapsible-header contracts match the runtime.

1,400 valid editor HTML outputs (open/closed styles/actions, all layouts and
entity modes) match main. All 740 unit tests and six targeted real-browser
PIN/helper/action/missing-entity/focus cases pass. Full local browser suite:
329 passed, one existing platform skip. Remaining unchecked modules:
40. Hold 3.0.0-alpha.1 until full migration, including the shared handwritten
utility/i18n runtime sources.

## Fav view findings — 2026-10-01

The Fav view still suppresses checking for responsive geometry, alarm modes/PIN,
HA state, translations and service targets. Render signatures omit selected
attribute values, light RGB/temperature and alarm feature/code fields. Fallback
layout timers/frames lack ownership and raw service promises can reject. Check
actual contracts, preserve targets/PIN semantics, clear abandoned work/PIN state,
and distinguish absent grid sizing from zero.

Fav view now passes strict checking and typed lint. Config projects known entity,
attribute and security fields while preserving YAML extensions. Render signatures
include selected attributes, light colour/temperature and alarm capabilities/PIN
requirements. Numeric RGB channels cannot insert CSS/HTML, real zero channels are
retained, and blank grid sizing remains absent. Service calls preserve explicit
targets and catch synchronous/rejected failures. Layout timers/frames are owned;
draft PINs survive style updates and clear on entity changes/disconnect. Switching
to a missing entity also releases the expanded parent span. Ten verified unused
imports and one never-written click suppression field were removed.

1,540 valid view HTML/grid outputs and 1,400 valid editor outputs match main.
All 740 unit tests pass; eighteen targeted browser cases passed before the final
parent-span regression was added. Full local browser suite, including that
regression: 341 passed, one existing platform skip. The service test initially
read a setter-only HA property; correcting the fixture resolved all three failures.
One older source assertion now checks the new service wrapper with the same
explicit-target condition. Remaining unchecked modules: 39. Hold 3.0.0-alpha.1
until the full migration, including shared utility/i18n runtime sources.

## Person view/editor findings — 2026-10-01

The Person view/editor suppress checking across photo preloads, location/action
logic, native/HA pickers and nested settings. Image loads have no deadline or
cancellation, ready/failed caches grow indefinitely, cached zones can survive
a rename that no longer matches the current location, and rejected service
calls are unhandled. Check the actual lifecycle/HA/DOM/action/config contracts,
preserve root YAML extensions and use guarded native/custom control payloads.

Person view/editor now pass strict checking and typed lint. Pending photo loads
are cancelled on disconnect/entity changes and have a four-second deadline;
completed/failed caches each retain at most 64 URLs. Stale callbacks do not
replace newer photos, cancelled loads can retry on remount, and renamed zones
are re-resolved. Fallback animation timers and consumed/pending taps are owned
and released. Explicit service targets and false/zero object data remain intact;
synchronous/rejected failures are handled. Malformed nested editor settings and
translation packs fall back safely; unavailable selections, focus, actions and
translucent styles are preserved. Ten verified unused imports were removed.

1,600 valid card markup/sizing outputs and 1,400 valid editor outputs match main.
All 740 unit tests and eighteen targeted browser cases pass. An initial browser
run exposed that lazy registration uses `_nodaliaConstruct` rather than class
field initializers; the new ownership maps now initialize in that real entry
point. A later photo fixture used a whitespace-only URL change that the card
correctly trims; using a genuinely new URL verifies cancellation and retry.
The existing source assertion now checks the nullable finite grid parser and
the same compact threshold. Full local browser suite: 359 passed, one existing
platform skip. Remaining unchecked modules: 37. Hold 3.0.0-alpha.1 until full migration, including shared
handwritten utility/i18n runtime sources.

## Cover view/editor findings — 2026-10-01

Cover suppressed checking across pointer/touch drag geometry, HA service/action
parameters, native/custom picker events and nested editor settings. Cancellation
could commit a position, configuration changes could leave an old gesture active,
and inherited icon actions lost body service/URL/navigation parameters.

Cover view/editor now pass strict checking and typed lint. Discriminated drag
geometry represents the actual linear/circular controls. Cancelling or changing
configuration abandons the gesture without a command, detaches window listeners
and restores current HA values. Missing/non-finite input is ignored while zero
remains valid. Fallback animation timers and consumed taps are released. Icon
actions inherit both action and parameters; explicit icon overrides remain intact.
Malformed picker/nested settings are guarded, custom YAML fields and focus remain.
Eight verified unused imports and four unused lifecycle fields were removed.

Fav, Person and Cover now share checked service invocation, retaining the utility's
compatibility event fallback, context, explicit targets and false/zero data while
handling both synchronous failures and rejected promises.

1,400 valid editor and 3,000 valid view/grid outputs match main. All 742 unit tests
and 33 targeted Cover/Person browser cases pass. Full local browser suite,
including Fav service coverage: 380 passed, one existing platform skip. The initial
Cover run exposed the inherited-parameter bug and an ambiguous circular-chip test
locator; both are corrected. Remaining unchecked modules: 35. Hold 3.0.0-alpha.1
until full migration, including handwritten utility/i18n runtime sources.

## Camera editor findings — 2026-10-01

Camera editor suppressed checking over native/custom HA controls, action/stream
lists and focus. Malformed action rows could break rendering, negative or blank
removal indices could remove valid rows, and adding a camera to a legacy entity-
only configuration lost the original camera.

The editor now checks its actual editable draft schema and native/custom control
payloads without discarding root YAML extensions. Invalid rows and removal indices
are ignored. Camera rename/removal preserves or removes its own tap, stream and
expanded-action references; false/zero service data and explicit targets survive.
Draft camera/action rows remain editable, legacy first cameras remain present,
missing selections and focus survive rendering. Two verified unused editor fields
and their unreachable toggle branch were removed.

1,400 valid editor HTML outputs match main. All 742 unit tests, nine targeted
browser cases and the full local browser suite (389 passed, one existing skip)
pass. An initial malformed-event fixture expected no emitted configuration;
the shared picker fallback correctly preserves and emits its current valid value.
The existing picker source assertion now checks identical Object.assign metadata.
Remaining unchecked modules: 34. Hold 3.0.0-alpha.1 until full migration, including
handwritten utility/i18n runtime sources.

## Weather and Circular Gauge editor findings — 2026-10-01

Both editors suppressed checking across native/custom controls, HA picker metadata,
nested settings and focus. Malformed haptic/animation blocks could break Weather
or Gauge rendering; Gauge grid sizing also relied on unchecked nested access.

Both now pass strict checking and typed lint using real HA/DOM/config/focus
contracts. Known entity/language/style fields are projected while root YAML
extensions remain. Guarded native/custom events and picker metadata preserve
unavailable selections and fallback controls. Malformed nested settings fall
back safely. Forecast/unit choices, explicit zero limits/decimals, automatic
bounds, numeric reset defaults and translucent styles survive editing. Three
verified unused Gauge editor imports were removed.

1,400 valid HTML outputs per editor match main. All 742 unit tests, twelve
specific browser cases and the full local browser suite (401 passed, one existing
skip) pass. No type suppressions, broad casts or weaker flags were added.
Remaining unchecked modules: 32. Hold 3.0.0-alpha.1 until full migration, including
handwritten utility/i18n runtime sources.

## Circular Gauge view findings — 2026-10-01

Gauge view suppressed checking across HA values, responsive sizing, SVG colour
cache/geometry and animation ownership. Blank sizing became zero and selected
compact mode. Frequent HA updates restarted the entrance deadline continuously;
fallback bounce timers were not owned and missing-entity renders left old work.

The view now passes strict checking and typed lint with actual HA/geometry/cache
contracts. Nullable finite sizing separates absence from real zero. Frequent
updates retain the initial entrance deadline and finalize the latest ratio.
Removing/reconfiguring the card or showing a missing entity cancels animation
frames and shared/fallback timers; stale disconnected frame callbacks are ignored.
Malformed nested haptic/animation/translation values are guarded and vibration
failure cannot block keyboard activation. Five verified unused imports were removed.

3,000 valid view/grid outputs match main. All 742 unit tests, eighteen specific
Gauge browser cases and the full local suite (410 passed, one existing skip)
pass. The lifecycle source assertion now follows the explicit cleanup helper.
Remaining unchecked modules: 31. Hold 3.0.0-alpha.1 until full migration, including
handwritten utility/i18n runtime sources.

## Alarm editor findings — 2026-10-01

Alarm editor suppressed checking over HA/native picker payloads, PIN/helper fields,
nested settings and deferred emissions. Cleared numeric fields became zero,
configuration replacement left deferred emissions queued, and abandoned pointer
state could suppress a later keyboard toggle. Strict checking also exposed that
custom state tints were dropped because their group was missing from style defaults.

The editor now passes strict checking and typed lint. Guarded HA/native controls
preserve missing entities, PIN/helper settings, focus and YAML extensions. Clearing
numeric overrides restores defaults; absent feedback delays remain absent until
the default is applied, with finite explicit values retaining their bounds. Deferred
emissions cancel on replacement/disconnect, consumed toggle state clears on removal,
and keyboard toggles work after an abandoned pointer sequence. State tint defaults
now project and sanitize every supported state while retaining custom translucent
colours. Four verified unused editor imports were removed.

1,400 valid editor HTML outputs match main (custom tints separately verify the
intentional restored behavior). All 743 unit tests, nine editor browser cases and
the full local suite (419 passed, one existing skip) pass. An initial browser
fixture omitted its configuration argument; fixing the fixture resolved all three
failures. Remaining unchecked modules: 30. Hold 3.0.0-alpha.1 until full migration,
including handwritten utility/i18n runtime sources.

## Fan and Humidifier editor findings — 2026-10-01

Both editors suppressed checking across HA/native controls, mode/helper lists and
nested settings. Their service action sections called a nonexistent textarea
renderer, so opening configured service-data fields could crash the editor.

Both now pass strict checking and typed lint using actual HA/DOM/config/focus
contracts. The missing service-data renderer now mounts real editable textareas.
Known entity/language/helper fields are projected while YAML extensions remain;
mode visibility, unavailable selections, auxiliary select helpers and focus
survive edits. Malformed haptic/scroll/animation groups and picker payloads are
guarded. Explicit service targets, false/zero data, reset defaults and translucent
styles remain intact. Six verified unused imports were removed.

1,400 valid HTML outputs per editor match main; newly working service textareas
are separately tested. All 743 unit tests, twelve specific browser cases and the
full local suite (431 passed, one existing skip) pass. An initial test clicked the
hidden checkbox directly; using its visible labelled switch verifies actual user
interaction and resolves the six fixture timeouts. Remaining unchecked modules:
28. Hold 3.0.0-alpha.1 until full migration, including handwritten utility/i18n
runtime sources.

## Light editor findings — 2026-10-01

The editor suppressed checking across HA/native controls, named presets, nested
settings and independent body/icon actions. Missing brightness values fabricated
1% presets; blank animation overrides became the minimum instead of defaults.

The editor now passes strict checking and typed lint with actual HA/DOM/config/
focus contracts. Missing numeric values restore defaults, while real zero keeps
existing bounds. Native/custom events and nested settings are guarded; missing
entities, named colour presets, service targets, false/zero data, YAML extensions,
focus and translucent styles remain intact. A verified dead datalist renderer and
its unused icon option were removed.

1,400 valid editor HTML outputs match main. All 744 unit tests, nine specific
browser cases and the full local suite (440 passed, one existing skip) pass.
Remaining unchecked modules: 27. Hold 3.0.0-alpha.1 until full migration,
including handwritten utility/i18n runtime sources.

## Alarm Panel view findings — 2026-10-01

The view suppressed checking over state/PIN/native controls and asynchronous
work. Pending arm attributes were absent from invalidation; stale failures could
show feedback after entity/state replacement. Safari mobile exposed resize
observer loops and button replacement between PIN blur and native click.

The view now passes strict checking and typed lint with actual HA/DOM/config/
focus/timer contracts. Resize renders run outside the observer; touched buttons
remain mounted until click or pointer cancellation. Mode attributes invalidate
the view, entrance deadlines remain stable and countdown/animation work is owned.
Typed PINs clear across entities, missing entities and removal. The checked
awaitable service boundary exposes sync/rejected failures and preserves direct
arity and compatibility fallback. Immutable snapshots and action generations
reject obsolete feedback and retain a newer PIN watch. Six unused imports were
removed and card documentation updated.

3,000 valid view/grid outputs match main. All 745 unit tests, 27 specific Alarm/
Person cases and the full local suite (455 passed, one existing skip) pass.
Initial mobile failures exposed the production resize and touch races above.
The first full suite also hit background timer throttling in the Person deadline
test; its controlled clock now proves the exact 3,999/4,000 ms boundary and cache
limits without depending on wall-clock scheduling. A source assertion now follows
the awaitable invocation while retaining the PIN-watch contract.
Remaining unchecked modules: 26. Hold 3.0.0-alpha.1 until complete migration,
including handwritten utility/i18n runtime sources.

## Calendar editor findings — 2026-10-01

The editor suppressed checking over native/HA controls, rows and nested settings.
Row edits could extend the array to an arbitrary index, reordering did not bound
the source index, adding to an empty list did not create a second visible row,
and text drafts were ignored until change so HA updates discarded current typing.

The editor now passes strict checking and typed lint with actual HA/DOM/config/
focus/row contracts. Indices are integer-bounded and supported row keys are
validated before mutation. Labels and translucent tints remain paired on move,
alpha survives colour edits and missing selections/draft rows remain editable.
Adding to an empty list retains its visible placeholder and creates a second row.
Input updates retain local drafts without premature config emissions. Cleared
numeric overrides restore defaults; animation absence differs from real zero and
malformed groups are guarded. YAML/security/animation/style extension fields retain
false and zero, and automatic language is an explicit removable default.

1,400 valid editor HTML outputs match main. All 746 unit tests, nine specific
browser cases and the full local suite (464 passed, one existing skip) pass.
The first target run exposed the production text-draft loss above; the corrected
input handling resolves all three cases. Remaining unchecked modules: 25.
Hold 3.0.0-alpha.1 until complete migration, including handwritten shared runtimes.

## Vacuum editor findings — 2026-10-01

The editor suppressed checking over native/HA controls, device registry matching,
mode lists and nested settings. Malformed registry entries and null haptic/animation
groups were read directly.

The editor now passes strict checking and typed lint with actual HA/DOM/config/
focus/picker contracts. Device matching guards registry rows and preserves current
robot suction/mop discovery and explicit helpers. Mode visibility updates only its
two supported lists. Missing selected robots/helpers, presets, separate navigation
actions, root YAML extensions, false/zero values, focus and translucent styles
survive edits. Malformed settings/events are guarded and clearing durations
restores existing defaults. Automatic language is an explicit removable default.
Three verified unused imports and a redundant setter-only property read were removed;
card documentation includes translated/truncated status chips.

1,400 valid editor HTML outputs match main. All 746 unit tests, nine specific
browser cases and the full local suite (473 passed, one existing skip) pass.
Remaining unchecked modules: 24. Hold 3.0.0-alpha.1 until complete migration,
including handwritten shared runtimes.

## Entity editor findings — 2026-10-01

The unchecked editor exposed a double-tap selector without navigation, URL or
service details. Quick-service YAML objects became `[object Object]` text. Row
mutations accepted negative removal and distant indices; reordering an absent
source could damage another row.

Restore separate card/icon double-tap details and encode service-data objects as
JSON, preserving false/zero values. Bound removal, swaps and path edits to existing
action/overview rows and supported fields before mutation. Preserve paired entity,
name, icon and network role, missing selections, typed drafts, focus, service
targets and YAML extensions. Native/HA events, normalized config and DOM contracts
now pass strict checking and typed lint; malformed settings and unavailable picker
capabilities use native fallbacks. Remove five verified unused imports.

All 747 unit tests and nine targeted browser cases pass. 1,400 valid editor HTML
outputs across all four layouts, collapsed actions and expanded style/animation
sections match main; restored double-tap details have browser coverage. The full
local suite passes 482 cases with one existing skip. Remaining unchecked modules:
23. Keep publication held until the entire migration and shared runtimes finish.

## Graph editor findings — 2026-10-01

The editor suppressed checking and the standalone entry deliberately retained
636 lines of a historical editor. Reference inspection confirms that editor was
never registered and the retention expression was its only consumer; remove the
class, loader and retention expression while keeping the registered editor/API.

The real editor now checks actual HA, normalized config, native events, DOM,
series and focus contracts. Guard malformed haptic/animation groups and missing
optional helpers. Bound series paths to existing rows and supported fields; blank
button indices cannot delete row zero. Preserve draft series through HA feedback,
legacy single-entity conversion, paired names/colors, missing selections, focused
drafts, translucent styles and root YAML false/zero extensions. Automatic language
is an explicit removable default. Update the older VM fixture to construct an
actual CustomEvent for its picker event.

All 747 unit tests and nine targeted browser cases pass. 1,400 valid editor HTML
outputs match main. Full local suite: 491 passed, one existing skip. The initial
new browser assertion used a color from the stub rather than the actual second
series default; correct the fixture to #42a5f5. Remaining unchecked modules: 22.
Publication stays held until the entire migration and shared runtimes finish.

## Media Player editor findings — 2026-10-01

The editor suppressed checking across nested player actions, native/HA controls,
JSON data and DOM focus. Empty removal indices affected row zero and distant field
paths could extend player arrays. Clearing service data or URLs left legacy `data`
or `url_path` aliases, causing an apparently deleted value to reappear.

Check those actual contracts and restrict row/action field edits before mutation.
Cleared fields remove their corresponding legacy alias. Invalid JSON objects,
arrays or primitives retain the last valid service object; valid false/zero data,
YAML targets, metadata and extensions survive edits and reordering. Preserve blank
players, legacy single entities, missing selections, focus, artwork modes, cleared
animation defaults and translucent styles. Guard malformed nested settings.
Move actual stub generation into the checked helper shared by view and editor,
removing the editor's dependency on the unchecked view factory; remove 19 verified
unused imported bindings and a redundant label calculation. Automatic language
is an explicit removable default. Add the card guide and README link.

All 748 unit tests, nine targeted browser cases and 1,400 equivalent editor HTML
outputs pass. Full local suite: 500 passed, one existing skip. Initial new browser
assertions expected default values in compact emitted YAML; assert the normalized
values instead, keeping the existing default-stripping contract. Remaining
unchecked modules: 21. Keep publication held until the entire migration finishes.

## Navigation editor findings — 2026-10-01

The unchecked draft editor accepted missing/negative removal indices, parsed
blank numeric values as zero and assumed CSV filters were arrays. Route/popup
icon handlers also depended on the control property instead of committed event
data.

Check real HA, draft rows, native controls, picker events, DOM and focus contracts.
Prepare actual draft groups while filtering malformed rows; bound removal and row
fields before mutation, and reject distant indexed root paths. Preserve routes,
paired popup descriptions/filters, legacy items, players, labels, aliases and YAML
false/zero extensions. HA picker search blur does not commit; route/popup icon
updates use string event values. Clear numeric overrides to defaults and retain
actual zero in animation fields. Guard malformed settings and CSV groups; retain
shared styles and translucent colors. Update older VM fixtures to use actual
CustomEvents and retain the static committed-player contract with native property
assignment. Add the Navigation guide and README link.

All 748 unit tests, nine specific browser cases and 1,400 equivalent editor HTML
outputs pass. Full local suite: 509 passed, one existing skip. Remaining unchecked
modules: 20. Publication stays held until the complete source/runtime migration.

The Firefox CI job exposed a test-fixture issue: desktop contexts do not
provide `TouchEvent` until touch support is enabled. Use Playwright
`hasTouch: true` for these lifecycle cases, exercising the native constructor
without a polyfill or skipped assertions. The same 21 focused Chromium/
WebKit/iPhone cases pass; Firefox remains a required remote gate. Local
Firefox cannot start its temporary profile on this host, including a direct
`/private/tmp` profile path.


## Power Flow editor findings — 2026-10-01

The unchecked visual editor referenced selector domains without importing their
existing shared constant. Saving an individual's name before selecting its entity
discarded the row from emitted configuration. Its standalone entry also retained
a 761-line historical editor whose only consumer was the retention expression;
remove that unregistered editor and keep the actual visual editor loader.

Import the shared domains, retain blank individual drafts through HA feedback and
bound edits/removals to existing rows and supported fields. Preserve paired
names/icons/colors/secondary information and the grid, home, export and consumption
branches. Check actual HA, native events, normalized config, DOM and focus
contracts; guard malformed nested settings and keep cleared numbers distinct from
real zero. Retain translucent CSS styles and YAML false/zero extensions.

All 748 unit tests, nine targeted browser cases and 1,400 equivalent editor HTML
outputs pass. A new browser assertion initially expected a color picker for the
existing free-text CSS style control; correct the fixture to its actual contract.
Full local suite: 518 passed, one existing skip. Remaining unchecked modules: 19.
Hold publication until the entire migration and
shared runtimes finish.

## Notifications editor findings — 2026-10-01

The unchecked editor accepted negative/blank removal and distant row edits.
Runtime YAML deliberately excludes unfinished custom/external rows, but HA
feedback then erased those local drafts. Entity-option signatures omitted
Climate, Humidifier and Media Player domains. Outstanding Engine replies and
background syncs could commit after a connection/config change or disconnection.

Check actual normalized config, native/HA events, picker metadata, focus and Engine
contracts. Bound row/list mutations before editing or swapping and keep smart
overrides attached to their entity. Preserve unfinished local rows on feedback
without emitting live placeholder notifications. Expand selector signatures and
retain missing entities, focused drafts, JSON service data, real zero/default
numbers and translucent CSS alpha. Share smart-override normalization instead of
inventing partial records and remove one verified unused import.

Own background timers and invalidate obsolete Engine replies and profile syncs.
The shared native boundary checks the editor's generation before profile writes;
transport failure stays transient. Normal HA feedback retains the latest queued
sync, including explicit disabled profiles that stop background delivery.

All 749 unit tests, 15 targeted browser cases and 1,400 equivalent editor HTML
outputs pass. Full local suite: 533 passed, one existing skip. New fixtures were
corrected to the actual native text-input picker
fallback rather than expecting a select. Remaining unchecked modules: 18.
Publication remains held until the entire migration and shared runtimes finish.

## Climate editor findings — 2026-10-01

The unchecked editor passed full-width options to an action selector that ignored
them. Engine status refreshes replaced controls even when the cached status was
unchanged and could apply replies from an earlier connection or detached editor.

Check actual HA, normalized Climate config, native events, DOM, focus and exported
Engine helper contracts. Honor the existing full-width request for the independent
tap/hold/double-tap selectors. Use status signatures and request generations to
keep unchanged controls and discard abandoned replies. Retain missing entities,
focused drafts, populated Engine/webhook schedule fallbacks, week selection,
explicit zero/cleared animation defaults, translucent styles and YAML extensions.
Automatic language is an explicit removable default. Remove 36 verified unused
imported bindings and the setter-only hass fallback.

All 749 unit tests, 12 targeted browser cases and 1,400 equivalent editor HTML
outputs outside the restored action widths pass. Full local suite: 545 passed,
one existing skip. The initial toggle fixture targeted the hidden native input;
use its visible label, exercising the real switch interaction. Remaining
unchecked modules: 17. Hold publication until the complete source/runtime migration.

## Advance Vacuum editor findings — 2026-10-01

The unchecked editor lost uncommitted text/JSON on HA updates and accepted JSON
objects or primitives where menu/routine lists were required. Chromium dispatches
a change from focused native controls during DOM replacement; that teardown
could commit an obsolete value and overwrite the current draft.

Check actual HA, native events, DOM, focus, config and picker contracts. Preserve
text/JSON drafts without emitting every keystroke, and guard events during
control replacement. Validate JSON arrays with translated feedback in all 12
locales, retaining the last valid config and invalid draft across updates. Keep
paired command metadata, false/zero data, missing entities, native/HA selectors,
explicit zero/cleared animation defaults, translucent styles and YAML extensions.
Clear drafts across robots/disconnection. Remove five unused historical datalists
and their dead population/attachment paths; the actual selectors remain intact.

All 749 unit tests, nine targeted browser cases and 1,400 equivalent editor HTML
outputs outside the removed unused datalists pass. Full local suite: 554 passed,
one existing skip. Remaining unchecked modules: 16. Publication remains held until the complete source/runtime migration.

## Weather view findings — 2026-10-01

Forecast subscriptions were keyed only by entity/type, allowing obsolete
callbacks and failed requests to affect a later subscription. Empty live lists
fell back to stale legacy forecasts. Render signatures omitted legacy forecast
contents, unit labels and alert descriptions. SVG chart points exposed button
roles without keyboard activation. Fallback animation timers were not owned.

Check actual HA, forecast, event, DOM, chart geometry, popup and config contracts.
Track connection/request generations, release pending subscriptions and ignore
obsolete events/failures. Guard malformed forecast rows and retain authoritative
empty live lists. Refresh signatures for displayed forecasts, units, supported
features, language and alert details. Activate SVG points via Enter/Space and
close detail with Escape. Own fallback timers and release modal focus when the
weather entity disappears. Retain conversions, real zeros, missing metrics,
existing chart colours, translucent CSS and sizing. Remove one unused import.

All 749 unit tests, 15 targeted browser cases and 3,000 equivalent Weather
presentation/sizing outputs pass. Full local suite: 566 passed, one existing skip.
Remaining unchecked modules: 15. Publication
remains held until the complete source/runtime migration.

## Vacuum view findings — 2026-10-01

The unchecked view retained optimistic modes/rooms across robots and pending
selections after disconnection. Animation end and timeout could complete the same
panel removal twice; older transitions could replace a newer panel. Fallback
timers and animation listeners were unowned. Battery null became a fabricated
zero, malformed registry values were accessed without guards, and HA service
failures escaped the UI boundary. The tappable main card lacked keyboard access.

Check actual HA, native events, normalized config, DOM, rooms, mode descriptors
and related-helper contracts. Reset robot-specific state on entity changes while
preserving the 2.5-second optimistic deadline during equivalent HA feedback. Own
fallback timers, panel callbacks and deferred resize work, complete transitions
once and discard stale listeners. Preserve numeric zero while omitting missing
battery data; guard registry/mapping shapes. Use the shared service boundary for
commands and activate the main card via Enter/Space. Remove five unused imported
bindings and one unused panel markup calculation. Keep related-robot ownership,
translations/ellipsis, existing sizing, controls and translucent styles.

All 749 unit tests, 21 targeted browser cases and 3,000 equivalent presentation/
sizing outputs outside restored keyboard attributes pass. Safari's initial
deferred measurement could replace a label while the old truncation test
resolved it; poll the live label with the same ellipsis/clipping assertions.
Full local suite: 575 passed, one existing skip. Remaining unchecked modules:
14. Hold publication until the complete migration.

## Fan view findings — 2026-10-01

Pointer/touch cancellation used the successful drag-release handler, sending the
tentative speed. Entity changes and outside touches could retain stale drafts.
The render signature consumed a power-toggle acknowledgement before the setter
captured its remembered display; cache updates could overwrite that snapshot.
Preset animation listeners/fallback timers were unowned. Stored JSON and nullable
numeric capability fields were trusted, and command failures escaped the UI.

Check actual HA, snapshots, optimistic deadlines, native events, DOM, linear/
circular drag unions, geometry, transitions and config contracts. Separate cancel
from commit and own panel/resize/fallback work. Make signatures pure and capture
the pending display before refreshing remembered state. Preserve the existing
3.2-second toggle and 420-ms visual-settle deadlines through HA feedback. Guard
stored memory, omit missing numeric capabilities while retaining actual zero,
catch service failures with targets/data preserved and add main-card keyboard
activation. Keep disabled individual slider haptics. Remove five unused imports
and two dead drag-queue fields that never held updates or scheduled frames.

All 749 unit tests, 12 targeted browser cases and 3,000 equivalent presentation/
sizing outputs outside restored keyboard attributes pass. The existing haptic
source assertion now checks the guarded scrolls object; browser coverage retains
the disabled-slider behavior. The dial geometry test waits for a visible,
measured dial after Safari replaces it during initial sizing, retaining its
single-command and midpoint assertions. Full local suite: 587 passed, one
existing skip. Remaining unchecked modules: 13. Hold publication until the
complete source/runtime migration.

## Humidifier view findings — 2026-10-01

Cancellation committed tentative humidity, entity/outside-touch changes retained
drafts and render signatures consumed optimistic confirmation before capturing
the remembered display. Mode/fan-mode transitions could complete twice or
append a stale panel; deferred resize and button frames were not owned.

Check actual HA, config, stored snapshots, native events, DOM, drag unions,
geometry, transitions and deadlines. Cancel drafts without commands, preserve
3.2-second toggle / 420-ms settle deadlines, make signatures pure and reset
entity-specific transitions. Own panel listeners, timers and frames; restart
enter cleanup when the same entering panel is selected again. Guard stored
JSON and nullable numeric humidity/range fields, retain real zero, guard
haptics/animations and catch built-in/configured/external-helper failures. Add
main-card keyboard activation and device-class render signatures. Remove six
unused imports and two unused drag queue fields.

The initial build exceeded the existing raw bundle budget. Share checked
animation ownership and panel construction across Humidifier/Fan/Vacuum,
removing duplicate implementations without changing either size gate. All
749 unit tests and 45 targeted Chromium/WebKit/iPhone cases pass; 3,000
equivalent presentation/sizing outputs per card (9,000 total) match main
outside keyboard attributes. Full local suite: 602 passed, one existing skip.
Native touch lifecycle fixtures enable a real touch context for Firefox too;
remote Firefox checks remain required. Remaining unchecked modules: 12.
Hold publication until the complete source/runtime migration.

## Light view findings — 2026-10-01

At the exact optimistic deadline, the pending predicate was already false;
timer callbacks returned without clearing on/off state or flushing queued
changes. Visual settle had no timer. Pointer/touch cancellation committed
drafts, changing lights retained drag/mode work, mode transitions scheduled
unowned nested frames, and temperature-limit changes were absent from render
signatures. Nullable color channels could manufacture a hue.

Check actual HA/native/DOM/config/snapshot/queue/drag/transition contracts. Own
resize, mode frames, fallback and 420-ms settle work. Finish the original
3.2-second on/off deadlines and deliver queued changes once when confirmed or
when the same light remains off at expiry. Cancel drafts without commands,
reset entity-specific work, preserve disabled individual haptics and add
main-card keyboard activation. Guard malformed stored records, nullable color
channels and service failures with targets and false/zero data intact.

Share checked device-memory readers/snapshots across Light/Fan/Humidifier.
Remove five unused Light imports, two dead queue fields and one unused range
calculation; four unused compact-threshold methods and three unused compact
title methods across Light/Fan/Humidifier/Vacuum. Remove redundant cleanup
branches already completed by the owning methods. All 749 unit tests and 48
focused browser cases pass. 3,000 equivalent presentation/sizing outputs per
card (12,000 total) match main outside restored keyboard attributes. Raw/gzip
bundle gates remain unchanged and pass.

Safari's native TouchEvent cannot construct a populated TouchList in this
fixture: native cancellation is covered in all three local engines, with
changed coordinates additionally checked in Chromium. The Vacuum keyboard
case waits for the first measured width before interacting, retaining both
keyboard/action assertions. Full local suite: 614 passed, one existing skip.
Remaining unchecked modules: 11. Hold publication until all source/runtime
migration and final audit validation complete.

## 2026-10-02 — Calendar view contracts and owned asynchronous work

- Remove Calendar's suppression with real normalized config, HA API/auth/native
  event, date, forecast, grouping, DOM/control and lifecycle contracts. Preserve
  optional services, unavailable/malformed values, real zero, public helpers, YAML,
  lazy initialization and standalone filenames. Debt falls from 11 to 10.
- Invalidate old refreshes on calendar/range/weather/security/HA context changes
  and detach. A stale finally cannot clear a new run or consume its queued refresh;
  stale API failures cannot trigger fallback calls against another HA connection.
- Retain the native weather connection receiver and own callback generation,
  pending unsubscribe and failure retry. Live empty forecasts are authoritative;
  late polling and obsolete subscriptions cannot resurrect old temperatures.
- Keep native composer drafts, toggles, repeat fields, colour and caret through
  rerenders. Restore modal focus to that field and bind traps only while open.
  Guard duplicate writes and isolate results/errors after close/reopen, entity,
  user/permission/connection change or disconnect; deletion follows the same
  context rule. Use local day arithmetic through the autumn clock change.
- Include real calendar names/delete capabilities and displayed event details in
  render signatures. Remove the unused name-signature method, redundant visible
  event cache, richer-forecast preservation branch and generic reminder-error
  path. Share identical signature hashing, detail buttons and create-event field
  projection within Calendar. Remove verified uncalled Scenes/News/Cover private
  forwarding methods and an unused Calendar button selector.
- Extract the native composer stylesheet and embed whitespace-compacted CSS in
  both builds, retaining declarations/selectors/prefixes and inherited title
  styling. This keeps the unchanged raw/gzip gates with no auxiliary CSS request.
- Strict types, lint and 750 unit tests pass. Compare 3,000 valid markup/style/size
  outputs against the prior view; 24 Calendar browser cases pass in Chromium,
  WebKit and iPhone, including computed styles. The full local browser suite
  passes 626 cases with one existing skip. CI remains required before integration;
  no prerelease has been published.


Calendar review follow-up: creation success owns the calendar/HA context
separately from the composer generation. Closing/reopening a composer still
refreshes its current event list after service, WebSocket or webhook success;
newer drafts stay open and unchanged. Obsolete contexts still cause no refresh
or UI mutation. The new native browser case checks all three routes. Strict/lint
and 750 unit tests pass; all 15 lifecycle browser cases pass, and the full local
suite passes 629 cases with one existing skip.


## 2026-10-02 — Graph view contracts and owned history/interaction work

- Remove Graph's suppression with real HA/config/history/chart/native-event/DOM
  contracts and explicit lazy initialization. Debt falls from 10 to 9.
- Coalesce active requests by key, capture HA/period for history/statistics calls,
  retain the HA receiver and stop aborted WS failures before REST fallback. Reset
  ownership/cache on connection/user/config changes. Cache successful empty loads
  and preserve usable history/current readings when statistics are insufficient.
- Keep absent values/ranges nullable, retain genuine zero and epoch-zero records,
  and track used icon/device/state-class/locale attributes in render signatures.
- Fix the SVG selector used by hover patching; update each entity's marker and
  tooltip in place, including equal series names, and remove closed overlays.
  Add keyboard actions/chart navigation with focus retention. Native cancellation
  and context/detach cleanup release holds, animation work, document watchers and
  hover/tooltip frames.
- Remove the uncalled empty-state renderer and never-assigned selected-series
  signature field; share identical legend templates. Colocate static hover CSS,
  retaining exact presentation through whitespace-only self-contained embedding.
- Strict/lint and all 750 unit tests pass. 3,000 equivalent valid presentation,
  style and sizing outputs match the prior view outside restored keyboard and
  marker attributes. All 12 focused Chromium/WebKit/iPhone cases pass. The full
  suite passes 638 cases with one existing skip; CI remains required before
  integration. Current labels/units also update through cached history, and hold
  movement cancels even when the media query reports no hover. No prerelease is
  published.


## 2026-10-02 — Camera view contracts and owned playback work

- Remove Camera's suppression with actual normalized config, HA/auth/helpers,
  native DOM/event, embedded-card and go2rtc-player contracts. Declare and
  initialize fields through the lazy constructor. Debt falls from 9 to 8.
- Capture each stream's HA and mount generation, own the one 350 ms signing
  retry and cancel it on close/config/context/detach. Obsolete source failures,
  native helper results and player events cannot affect a replacement stream.
  Ordinary HA updates keep the current player and refresh its native state.
- Own Frigate prefetch generations even when configurations have identical
  signatures across connections. Ignore obsolete preview/poster errors and
  loads; clear failed-token quarantine when the HA connection/user changes.
  Retain bounded failed-image storage and genuine access-token rotation.
- Bind configured hold actions to the actual preview entity; native movement,
  cancellation, context/config changes and detach cancel pending holds. Retain
  keyboard activation and modal focus. Include displayed names/last-changed in
  signatures. Service failures use the shared checked invocation boundary.
- Fix Summary detection through actual shadow hosts: Camera's expanded body
  portal now opens for a camera embedded in Summary, retains its stylesheet,
  handles current loaded/error events and removes its host on close/detach.
- Remove verified uncalled stream-provider and expanded-action methods. Embed
  readable static expanded CSS through the whitespace-only build plugin;
  preserve standalone filenames and the unchanged raw/gzip budgets.
- Strict/lint and all 750 unit tests pass; 3,000 valid markup/style/sizing outputs
  match the prior view. All 21 focused Chromium/WebKit/iPhone cases pass, including
  native holds/keys, obsolete/current signing, helper races, token errors and
  computed portal styles. The full local suite passes 662 cases with one existing
  skip; CI remains required before merging.
  No prerelease has been published.


Camera review follow-up: synchronize the current Summary portal before mounting
its player and related controls. A same-camera configuration change or a current
preview-image error no longer mounts into an outgoing dialog that is subsequently
removed. The new native browser case reproduces both paths, checks retained player
and related cards, verifies old-player disconnect and current loaded events, and
closes the current portal. Strict/lint and 750 unit tests pass; all 24 focused
browser cases pass. The full local suite passes 665 cases with one existing skip;
CI and review remain required before integration.


## 2026-10-02 — Room Summary view and embedded-card ownership

- Remove the complete view suppression with actual HA/config/projection/style,
  embedded-card and native event/DOM contracts plus lazy initialized fields.
  Debt falls from 8 to 7. Preserve native Lock, home media and public filenames.
- Pass current HA to visible embedded cards even when the parent signature is
  unchanged. Track actual attributes and locale; retain child identity through
  ordinary updates. Remove connected and parked cards on configuration, HA
  connection/user change and detach, clearing old fragment references. Reset
  removed active panels to Home and cancel old holds across these boundaries.
- Preserve native parent action focus through header, navigation and cover
  refreshes. When active navigation disappears, focus Home; if that panel is
  removed, focus the room action. Use shared checked service invocation to catch
  rejected/synchronous calls while retaining strict allowlists and explicit
  false/zero data/targets. Missing metrics and real zero remain distinct.
- Remove two uncalled brightness helpers, the unrendered legacy range input
  listener/handler, obsolete vacuum handler/service method and unused climate/
  media action dispatch branches plus an unused quick-action projection. Remove
  the never-published I18n format fallback; use existing own-key translation and
  interpolation. Colocate readable metric CSS with whitespace-only embedding
  inside the unchanged raw/gzip limits.
- Strict/lint and 750 unit tests pass; 3,000 valid presentation/style/sizing outputs
  match the prior view. All 12 focused Chromium/WebKit/iPhone cases pass. The full
  local suite passes 677 cases with one existing skip; CI remains required before
  integration. No prerelease has been published.


## 2026-10-02 — Power Flow view, missing sources and owned motion

- Remove the complete view suppression with actual normalized configuration,
  nullable source/node values, flow geometry, HA and native DOM/SVG contracts.
  Debt falls from 7 to 6; the manual support runtimes still require migration.
- A configured split component that is missing/blank/unknown/unavailable no
  longer contributes an invented zero. Unconfigured components and real zeros
  remain distinct. Export-only sensors likewise preserve unavailable readings.
  Keep established measured/derived flow semantics and battery status icons.
- Track displayed attributes and locale without relying on timestamps. Preserve
  native action focus during refreshes, activate consumption chips with Enter/
  Space and return modal focus to the actual Home button on Escape. Open dialogs
  close across configuration, HA connection/user changes and disconnect.
- Release owned press/entrance/frame work; retired observer/frame callbacks
  cannot modify a reattached card. Detached HA assignments do not render until
  reconnect. Native viewport changes pause/resume the existing SVG animations.
- Remove four private renderer helpers and 45 exclusive style rules for the
  unreachable simple design: the checked layout selector returns only compact
  or full. Remove unused radius/sizing branches, row calculations and imports.
  All 3,000 valid markup/style/sizing comparisons match the prior view after
  excluding only those verified dead rules and added chip keyboard attributes.
- Strict/lint and all 750 unit tests pass. All 15 focused Chromium/WebKit/iPhone
  cases pass; the complete local suite passes 689 cases with one existing skip.
  The HACS bundle is 4,311,570 raw / 956,888 gzip bytes, below the unchanged
  4,325,376 / 972,800 limits. CI and review remain required before integration.
  No prerelease has been published.

## 2026-10-02 — Entity view, selector and history ownership

- Remove the complete view suppression using actual normalized config, HA states,
  native DOM/SVG, finite metric values and checked history geometry. No `any`,
  assertion-based data conversion or weaker compiler flags are introduced.
  Remove eleven unused view imports while retaining public helper exports.
- Configuration, HA connection/auth/user changes and detach cancel owned panel,
  hold, deferred tap, entrance and history work. Retired resize observations
  cannot alter a reattached card. Binary optimistic toggles retain their original
  deadline across ordinary HA updates and temporary removal; new contexts clear
  them. Displayed attributes and locale refresh without timestamp changes.
- Selector opening survives HA refreshes; option focus is retained and Escape or
  selection returns it to the card. Shared animation completion owns both native
  listeners and fallback timers. Keyboard graph inspection uses Left/Right,
  Home/End and Escape and patches the existing line and value overlay in place.
- History requests coalesce, retain successful empty responses for three minutes,
  capture the requesting HA instance and ignore stale results/fallbacks/finalizers.
  Cache metadata follows current units and labels. Real zero readings and epoch
  timestamps survive; absent readings do not become zero. Explicit service targets
  and false/zero data survive; rejected or synchronous service failures are caught.
- All 3,000 valid markup/style/sizing comparisons match the prior view. Strict/lint
  and all 750 unit tests pass. The HACS bundle is 4,314,290 raw / 958,047 gzip bytes,
  within the unchanged 4,325,376 / 972,800 limits. Five source views and the manual
  support runtimes remain to migrate before publishing 3.0.0-alpha.1.
- All 15 focused browser cases pass. The complete Chromium/WebKit/iPhone suite
  passes 704 cases with one existing skip. The first run exposed a wrong private
  method name in the new fixture and one existing Safari keyboard timing failure;
  correcting the fixture and repeating the complete suite passes. Remote CI and
  review remain required before integration. No prerelease has been published.

## 2026-10-02 — Navigation view and native dialog focus

- Remove the view suppression using the actual normalized config, guarded route/
  action records, finite playback fields, validated media-browser nodes, HA and
  native DOM contracts. Add declarations only for three existing I18n functions
  and the actual shared surface composer; no invented runtime APIs or data casts.
- Configuration and HA connection/auth/user changes clear open panels and current
  player state, cancel pending media/palette commits and release frames, resize
  timers, tickers and modal listeners. Detach/hidden layouts also release work;
  retired callbacks cannot mutate a reattached instance. Old browse failures
  cannot navigate the next context to their fallback path.
- Restore native focus through ordinary HA updates and browse/play transitions.
  Route/media dialogs trap Tab/Shift+Tab and restore their opening control on
  Escape or action completion. Native browser cases expose Safari skipping
  interior buttons: shared modal handling now advances to the actual next
  focusable control and reads the active element in the dialog's shadow root.
- Paused progress/volume feedback patches existing controls; artwork/device
  metadata participates in signatures. Player metadata gains keyboard activation.
  Shared service calls catch rejection/synchronous failure and retain explicit
  targets and false/zero values. Media thumbnails share artwork URL validation.
- Remove two unused private methods (tracked-ID collection and the old media-picker
  forwarder) and an unassigned browser-label fallback. Preserve public tags/YAML/
  standalone APIs. All 3,000 valid markup/style/sizing comparisons match the prior
  view after excluding only new dialog/metadata keyboard attributes.
- Strict/lint and all 750 unit tests pass, including released-context palette
  ownership. All 15 focused browser cases pass. The initial fixture omitted the
  browse path required for a generic player; correct that fixture without enabling
  the control for unrelated users. The full browser suite passes 719 cases with one existing skip. Keep exact
  glass styles while allowing subpixel rectangle rounding in WebKit geometry
  comparisons. Raw/gzip bundle: 4,317,866 / 959,256 bytes within
  the unchanged 4,325,376 / 972,800 limits. Four source views plus manual support
  runtimes remain before publishing 3.0.0-alpha.1.

## 2026-10-02 — Notifications view and delivery ownership

- Replace the view suppression with real normalized config/notification/action/
  calendar/forecast contracts, guarded external records and native DOM/HA types.
  Only the actually published Notifications I18n function gains a declaration.
  Keep strict compiler flags and both bundle limits unchanged.
- Capture the originating HA/config/generation for calendar and forecast batches,
  Engine profile/inbox/dismissal work, legacy sync, helper writes and foreground
  drains. Reconfiguration, connection/auth/user changes and detach release view
  timers/observers and invalidate old callbacks, including reconnect. Single-flight
  foreground delivery reevaluates policy between alerts and records delivery only
  in its originating context. Engine errors retain background ownership.
- The official HA weather websocket source registers subscribe/convertible-units,
  not weather/get_forecasts. Replace that request with call_service weather.
  get_forecasts and unwrap its response. Try daily when hourly is unsupported;
  successful empty forecasts do not restore legacy rows. Calendar failures retry
  at the configured interval; refresh boundaries include local midnight/DST.
  Source: https://github.com/home-assistant/core/blob/dev/homeassistant/components/weather/websocket_api.py
- Scope browser-local dismissal/mobile history by configured prefix, server and
  user; do not import unscoped older entries into private state. Shared helper and
  Engine profile semantics remain explicit. Preserve native button focus through
  refresh/dismissal and catch configured service failures with real false/zero
  data and targets intact. Relevant state attributes/registry/locale changes and referenced smart-template
  entities participate in render signatures. A calendar batch crossing local
  midnight clears the previous day and queries the new day immediately.
- Remove three unused private methods and their unused view imports. Embed static
  motion CSS with whitespace-only compaction; all declarations/selectors are
  preserved. Valid view/model/style/sizing comparisons match the old view in all
  3,000 cases. Correct unit DOM fixtures to implement native replaceChildren;
  update structural checks for actual guarded operations and the real forecast
  API. Native fixtures target alert identity instead of assuming their sort order.
- All 750 unit tests and strict/lint gates pass. All 24 focused browser cases pass
  across Chromium/WebKit/iPhone, including a pending drain through repeated HA
  feedback and queued Engine updates. Raw/gzip bundle: 4,320,203 / 960,606 bytes within unchanged limits.
  All 743 browser cases pass (one existing skip). Three unchecked views and manual support
  runtimes still precede 3.0.0-alpha.1.

## 2026-10-02 — Media Player view, gesture and artwork ownership

- Replace the view suppression with real normalized config, validated player and
  media-browser records, HA contracts and native DOM/gesture types. Playback
  helpers now narrow unknown records instead of asserting fabricated entity
  shapes; non-finite duration/position/volume values cannot corrupt controls.
- Reconfiguration, connection/auth/user changes and detach retire browser,
  palette/preload, stepped TV-volume and resize work. Capture the original HA
  receiver during awaitable TV steps; rapid commits supersede previous loops.
  Release delay promises and pending image handlers; bound cover caches and
  folder-scroll memory to 64 entries. Clear private cover history on a new context.
- Cancel volume/seek gestures on pointer cancellation, blur, hidden pages and
  disconnect. Seek gestures retire if the song identity or seek capability changes.
  Add Left/Right/Home/End keyboard seek support. Preserve native action and dialog
  focus through HA updates and browse/play; paused progress patches the same DOM.
- Configured services retain explicit targets and false/zero JSON fields inside
  the allowlist. Catch rejected or synchronous service failures at the UI boundary.
  Static browser/presentation CSS is embedded with whitespace-only compaction,
  retaining declaration order without additional resources or relaxed size caps.
- All 751 unit tests, strict/lint and architecture gates pass. All 3,000 valid
  view/style/model/sizing comparisons match the previous checked-stage baseline.
  All 24 focused Media Player cases and the 39 Entity/Notifications cases pass.
  Remove 12 unused view imports and obsolete unassigned drag/volume-fallback state;
  public helper exports remain unchanged. The first full run exposes a fixture
  assuming notification delivery order; match the action by identity. Five repeated
  Safari selector checks pass, with explicit open-state assertions added. The new
  power-action fixture explicitly enables strict mode (the actual default is off).
  A second full run exposes wall-clock-dependent Camera retry and Entity closing
  checks. Await the actual mounted Camera operation, check its retry timer and
  advance the installed browser clock; likewise advance Entity closing deadlines.
  Both cases pass 18 repeated checks across the three browsers. The final full
  run passes 767 cases with one existing exclusion across Chromium, WebKit and
  iPhone WebKit, using three workers. Raw/gzip: 4,321,900 / 962,936 bytes,
  below unchanged 4,325,376 / 972,800 limits. Two unchecked
  views and manual support runtimes remain before 3.0.0-alpha.1.

## 2026-10-02 — Advance Vacuum view and map/session ownership

- Replace the view suppression with actual normalized config, HA, dock, room,
  geometry, session, translation and native DOM/gesture contracts. Guard unknown
  records and finite numeric values; preserve real zero and absent battery values.
  Keep strict flags, service profiles, helper exports and bundle caps unchanged.
- Capture HA/configuration generations for map commands, room resume and shared
  persistence. Reconfiguration, connection/auth/user changes and detach retire
  waits, locale frames, image handlers and entrance work. Old failures cannot
  alter replacement feedback or continue pause-to-zone commands. Private local
  history includes server/user/robot; explicit shared helpers retain their formats.
- Keep the map surface connected through active previews so native pointer capture
  survives updates. Pointer/touch cancellation, blur and hidden pages issue no
  selection or command; cancelled zone edits restore original geometry. Preserve
  keyboard room activation and native focus through HA updates. Registry changes
  participate in related-entity discovery even when HA mutates records in place.
- Remove eight verified unused private methods. Embed static utility, motion and
  map CSS with whitespace-only compaction, preserving declaration order. Update
  unit fixtures to implement actual native contracts rather than weakened view
  types. The first native fixture assumed one repetition despite the actual
  default of three and retained an earlier helper call; correct both fixtures.
- All 751 unit tests, strict/lint and architecture checks pass. All 3,000 valid
  markup/style/model/sizing/service-profile comparisons match the previous view.
  All 24 focused native cases pass across Chromium, WebKit and iPhone, including
  real pointer capture during zone dragging and rollback. The full local browser
  suite passes 791 cases with one existing exclusion. Raw/gzipSync bundle:
  4,320,661 / 964,692 bytes below unchanged 4,325,376 / 972,800 limits.
  One unchecked view (Climate) and manual support runtimes remain before
  3.0.0-alpha.1 publication.

## 2026-10-02 — Climate view and schedule/setpoint ownership

- Replace the last card-view suppression with actual normalized config, HA, Engine,
  schedule and native DOM/gesture contracts. Narrow unknown Engine/translation
  records and finite values without any shortcuts or changing strict flags. All
  card views/configs/helpers/editors now check; manual support JS migration remains.
- Capture the originating HA/configuration generation for schedule loads/saves,
  overrides and single-flight temperature/range queues. Guard between HVAC wake
  and temperature commands and between status/read/write steps. Old replies,
  catches and finally blocks cannot reset newer queues, close a replacement
  composer or continue shared helper writes. Preserve explicit helper/webhook
  formats and dual heat/cool override bounds. Retire controls on unavailable states.
- Pointer/touch cancellation, blur and hidden pages restore original dial drafts
  and schedule slots without commands. Capture and release native pointer ids.
  Activate the existing SVG hit track as well as HTML thumbs. Preserve action
  focus and unfinished schedule fields across refreshes, including Safari; pending
  numeric/time input changes retire older schedule loads. Own all timer/frame
  fallbacks and release them across detach/reconnect.
- Remove 22 unused view imports, an unused translation wrapper/type import and
  the obsolete global commit-aborted flag. Retain the theme helper used by native
  compatibility tests. Embed three static CSS sections with whitespace-only
  compaction, preserving selector/declaration order and both size caps.
- All 751 unit tests and strict/lint/architecture/distribution gates pass. Command
  unit fixtures now model mounted hosts and actual listener cleanup; native cases
  verify rendering. All 3,000 valid markup/style/model/sizing/service comparisons
  match the previous view; valid service comparisons use an available thermostat,
  while the new native case separately verifies retirement on unavailable states.
- All 33 focused cases pass on Chromium, WebKit and iPhone. Early native checks
  exposed duplicate hit-track markup, an always-mounted hidden composer and
  lost Safari input; target the actual SVG track, assert its closed state and
  preserve the unfinished field value. The full suite passes 824 cases with one
  existing exclusion. Raw/gzipSync: 4,322,123 / 966,830 bytes below unchanged
  4,325,376 / 972,800 limits. No unchecked card modules remain; hold publication
  for manual runtime migration and final audit.

Advance Vacuum integration also passes Firefox after replacing a test's hardcoded
mouse pointer id with the id of the actual native pointerdown event. The nine
repeated local drag/capture/rollback checks pass; remote static, HACS, security,
CodeQL and all four browser gates pass before normal integration.

Light PR #285 is integrated after resolving generated-file conflicts by rebuilding.
An expired optimistic turn-on deadline now flushes queued brightness/color before
a late HA update clears it, exactly once. All CI gates pass, including four browser
projects. The combined Climate/Light branch passes all 751 unit tests and 48
focused browser cases. Combined raw/gzipSync: 4,322,176 / 966,835 bytes, below
the unchanged limits.

## Go2rtc playback runtime — checked source and owned transport work

- Move the complete licensed player into `src/shared/go2rtc-player.ts`, with
  actual native video/audio/RTC/WebSocket/MSE contracts and unknown wire input
  guards. Camera imports the source directly; build its standalone ESM export
  from that source, preserving the tag, class export and upstream MIT notice.
- Retire pending autoplay retries on replacement videos, modes and newer play
  requests. Old WebRTC offers/candidates, frame callbacks, MSE updates and audio
  events cannot act on replacement transports or change current playback state.
  Close partially created audio contexts when browser construction fails.
- Blank sources stay disconnected rather than resolving to the dashboard URL.
  Normalize modes before comparing configuration. Preserve supported protocol
  order, codec negotiation, queue limits and startup/recovery deadlines.
- All 757 unit tests and strict/lint/architecture/distribution gates pass. Unit
  regressions cover blank sources, partial audio cleanup, retired MSE/audio events
  and malformed wire envelopes. Use the generated module's actual ESM export
  in VM fixtures rather than rewriting an export-class declaration.
- All 3,600 baseline configuration/mode/codec comparisons match valid sources.
  Blank sources and retired work are separately tested intentional fixes. All
  42 focused Camera/player cases pass on Chromium, WebKit and iPhone, using
  native HTMLVideoElement/RTCPeerConnection and controlled deferred results.
  Initial fixture failures came from setting audio options after connection,
  creating native volume events before the simulated play; configure before
  mounting, as Camera does. The full suite passes 845 cases with one existing
  exclusion. Raw/gzipSync: 4,324,156 / 967,271 bytes, within unchanged caps.
- Climate PR #287 passed static/HACS/CodeQL/security/review and every remote
  browser gate, including Firefox, before normal integration. Generic utility
  and runtime/editor translation lookup source migration remains before release.

## Shared utility runtime — checked source and owned native work

- Move the complete utility runtime into `src/shared/utils-runtime.ts` and
  generate the existing `window.NodaliaUtils` compatibility artifact. Keep all
  public helpers, lazy custom elements, picker callbacks and native DOM contracts.
  Embed readable Engine/reduced-motion CSS without adding published resources.
- Replace incorrect generic JSON-copy promises with unknown results. Configuration
  copies guard reconstructed object/array roots; merge and compaction overloads
  describe actual reconstructed roots. Preserve Date/toJSON JSON behavior on the
  public deepClone helper. Guard nested configuration fields in real consumers.
- Old modal cleanup cannot release a newer dialog. Release shadow event groups
  from the root that owned the binding. Cancel pointer holds on blur/hidden state,
  pending taps after host detachment, cleared defer callbacks and editor layout
  frames after dialog closure. Coalesce editor layout requests and restore styles.
- CSS default reconstruction uses own properties without mutating prototypes;
  configuration stripping and path mutation reject unsafe keys. Numeric and
  boolean style leaves retain their actual types, including Camera overlay strength.
- Strict typecheck, typed lint, architecture/distribution/translation checks and
  all 763 unit tests pass. Six new tests cover generated source, JSON root guards,
  prototype keys, retired deferred callbacks and original-root event cleanup.
  All 16,808 valid helper comparisons and 3,000 configurations across all 25
  public card APIs match the previous runtime. Five focused
  browser scenarios pass within the full three-browser run: 860 passing cases and
  one existing exclusion. Raw/gzipSync: 4,325,178 / 967,616 bytes; caps unchanged.
- Fixture corrections reflect native asynchronous animation frames and the actual
  document.hidden property. Source-text checks accept generated parenthesized
  callbacks and extracted CSS; behavioral assertions remain intact.
- Go2rtc PR #288 passed static/HACS/CodeQL/security and all four remote browsers
  before normal integration. Cursor Bugbot reported its account usage limit;
  do not describe the unavailable review as an approval. Runtime/editor translation
  lookup code still requires migration before 3.0.0-alpha.1 can be released.

## Editor translation lookup — checked lazy data boundaries

- Move all editor lookup, fallback, folding and Spanish normalization logic from
  the generator's JavaScript template into `src/shared/editor-i18n-runtime.ts`.
  Generate only typed data constants in `editor-i18n-data.ts` and build the
  compatibility artifact with the shared source builder. Keep row/catalog JSON
  parsing lazy; guard unknown decoded language/key/label arrays without casts.
- Preserve the twelve locales, legacy Spanish keys, ed.* keys, cache identity and
  current language resolver. All 27,264 translation comparisons and complete
  materialized catalogs match the pre-migration runtime. Four new unit tests
  cover canonical generation, separate lazy caches, malformed data and replacing
  the language resolver. Tests read generated string literals through the JS AST
  so compiler-selected quoting does not change behavioral assertions.
- Native tests expose a Lock editor profile-language bug: comparing old and new
  hass after localStorage changes resolves both to the new locale. Store the
  language actually rendered and refresh when it differs. Preserve picker updates.
- Extract complete static empty-state CSS rules and retain sanitized custom card
  values. Native computed-style tests cover display, spacing, colors, radius and
  typography; no external style resource is required. Keep existing bundle caps.
- All 767 unit tests and strict/lint/architecture/distribution/translation gates
  pass. The full Chromium/WebKit/iPhone suite passes 869 cases with one existing
  exclusion, including all nine focused translation/Lock/empty-style cases.
  Raw/gzipSync: 4,325,348 / 967,746 bytes; unchanged limits.
- Utils PR #289 passed all remote browser, static/HACS/CodeQL/security gates and
  review before normal integration. Runtime translation lookup remains handwritten
  and must migrate before release.

## Runtime translation lookup — final handwritten runtime migrated

- Move the complete runtime lookup into `src/shared/runtime-i18n-runtime.ts` and
  generate lazy locale factories in `runtime-i18n-data.ts`. Every shipped locale
  matches the English tree at compile time. Derive the public window API from
  its implementation, retaining optional boot-time registration and nullable
  state translations. All published runtime entries now have checked TS source.
- Preserve public PACK factories, cache identity, twelve complete locale trees,
  profile-language priority, aliases, unit formatting and zero/false substitutions.
  Merge partial public overrides with English at an unknown boundary and guard
  the reconstructed tree before treating it as typed strings. Define own JSON
  properties without changing prototypes. Deduplicate four identical path lookup
  implementations without relaxing the bundle limits.
- The checked catalog exposes an existing Fav bug: boolean attributes looked for
  `boolean` at the locale root instead of `entityCard.boolean`. Use the actual
  catalog, with a native Spanish true/false attribute regression.
- All 13,876 baseline translations, complete locale trees, public methods and
  profile-resolution comparisons match. All 773 unit tests and strict/lint/
  architecture/distribution/translation checks pass; six new tests cover readiness,
  partial and malformed data, prototype keys, storage failures and numeric zero.
- Source-format fixtures now assert actual lookup results and lazy factories
  instead of depending on handwritten object syntax or obsolete pack markers.
  Editor PR #290 passed all remote browser, static/HACS/CodeQL/security gates and
  review before normal integration. Final audit and release validation remain.
- The full Chromium/WebKit/iPhone suite passes 878 cases with one existing
  exclusion, including all nine new native runtime/Fav checks. Raw/gzipSync:
  4,324,600 / 967,639 bytes; existing limits unchanged.
