# Nodalia Cards 3 — final alpha release-readiness audit

Audit date: 2026-10-05. The starting point is main
`ed8c915411267514e08e86bb1436793802b5eddd`, published `3.0.0-alpha.9`.
This audit attempts to invalidate ownership, compatibility and layout guarantees;
passing the inherited test suite alone is not its acceptance criterion.

## A. Baseline recorded before changes

The machine-readable [baseline](audits/beta-readiness-baseline.json) preserves
all public tags, artifact paths, locale names and runtime entry points.

| Measure | Main baseline |
|---|---:|
| Checked non-declaration TS modules | 283 |
| Suppression debt / tracked runtime import cycles | 0 / 0 |
| Node tests | 792 pass, 0 skipped |
| Linux Chromium / desktop WebKit | 331 / 331 pass |
| Linux Firefox / iPhone WebKit | 330 / 330 pass, 1 skip each |
| Main local Chromium + WebKit + iPhone | 991 pass, 1 skip, 1 geometry-test failure |
| HACS resource raw / gzip | 4,138,351 / 944,549 bytes |
| Production npm dependencies | 0 |
| Registry cards / editors | 25 / 25 |
| Standalone cards / support runtime entries | 25 / 10 |
| Languages | de, el, en, es, fr, it, nl, no, pt, ro, ru, zh |
| Optional Engine protocol | API 2 and API 3 |

Gzip measurements use Node zlib's default compression, consistently before/after.
Main Linux CI run `37199566385`, HACS `37199566263`, CodeQL `37199566262`
and release `37199607418` passed for that exact SHA. Local Firefox's profile
creation failure is an environment limitation; Linux Firefox remains mandatory.
The two platform skips cover native Touch construction in Firefox and a duplicate
mobile-DPR case on iPhone, not application failures.

The baseline local Graph failure came from measuring a replaced chart node in
separate evaluations. Its regression now polls a single atomic geometry snapshot
containing card containment, overlap and chart-height constraints. No application
assertion was removed and no Graph layout workaround was added for this test race.

## B–C. Findings, causes, fixes, regressions and risk

No unresolved blocker is accepted for beta preparation. Findings below are
ranked by their behavior, not the number of changed lines. Browser regressions
run against the real generated runtime. New failures were reproduced before
source changes; pure helper cases were additionally rerun against the previous
compiled module/adapter so unrelated assertions cannot mask the red result.
The [red regression index](audits/beta-readiness-red-regressions.json) records
individual failing cases and hashes of the captured before logs. A coverage-only
large-history test is not misrepresented as a newly fixed runtime bug.

| Rank | Finding / previous behavior | Root cause and correction | Files / failing regression | Residual change risk |
|---|---|---|---|---|
| High | Older Engine status overwrote a newer handshake; clearing a pending cache did not retire its response | Cache lacked a request epoch. Only the latest epoch and captured HA identity may commit | `src/core/engine-client.ts`; `tests/nodalia-backend.test.mjs`: superseded status and cleared in-flight cache, separately red before | Conservative cache invalidation can cause another status request |
| High | Cached v3 commands and pending v3 mutations crossed user/auth changes | Connection alone was insufficient identity. Capture user/admin/auth scalars and refuse retired v3 operations with `stale_context` | Engine client; backend tests for user, auth and retired mutation, independently red | API 2 cold-command fallback preserved; callers may receive a deliberate stale-context error |
| Medium | Invalid explicit Engine ranges such as zero, false, fractional or inverted values negotiated v3 | Coercion/falsy fallback treated invalid values as absent. Require positive safe integral endpoints and ordered ranges | Engine client; malformed-range backend test red before | Malformed integrations lose optional capabilities safely |
| High | Calendar/Weather responses and subscriptions survived an in-place account or auth replacement; Graph missed auth replacement | Comparing mutable previous hass objects could read the new identity. Capture identity separately; advance existing generations and release subscriptions/history | Calendar, Weather, Graph card TS; lifecycle tests: 5 red before | Current same-context refresh/cache behavior retained |
| High | Camera reused another account's signed stream URL; auth replacement left its expanded stream active | Signing cache keyed only by connection and Camera failed to track auth separately. Replace per-owner cache when identity changes, retire portals and requests | Camera card/helpers; camera lifecycle auth test and 2 separate signing-context Node tests red before | New account must sign its own stream, adding a required request |
| Medium | A connection's signed-path cache grew with every different path | No cardinality bound. Keep at most 64 entries, without deleting a newer context's map on an old response | Camera helpers; 150-path bounded-cache test red before | An evicted path may need signing again |
| High | Lock pending feedback, Alarm PIN/actions, Fav PIN/panel and Vacuum optimistic modes survived a replaced HA account | These local states were tied to entity or disconnect but not all HA identities. Retire command tokens, gestures, PINs, mode timers and context-specific state | Lock, Alarm, Fav, Vacuum; lock 3-context tests, alarm late rejection/PIN, Fav PIN and Vacuum pending-mode tests red before | A context switch deliberately resets unfinished interaction; ordinary HA feedback does not |
| High | Light/Fan/Humidifier/Cover active drags sent a command through the replacement account | Global gesture completion read current hass after the original gesture context retired. Cancel dragging and queued action/optimistic work on captured context changes | Device card TS and `retired-device-context.spec.mjs`: 4 red before | No changes to mouse/touch/keyboard semantics in an unchanged account |
| High | Person/Insignia long presses fired after an in-place account change | Hold binding survived the identity transition. Detach/reconnect it and cancel Person's queued taps/avatar preload work | Person/Insignia TS; 2 long-press context tests red before | Holding across an account transition is intentionally cancelled |
| Medium | Climate/Notifications editors accepted retired Engine status and could retain sync work | Editor compared connection only instead of a captured identity. Invalidate status generation/background sync on identity change | Climate/Notifications editors; `editor-engine-context.spec.mjs`: 4 red before | Adds status refresh on actual identity change, preserves typing feedback |
| Medium | Shared artwork preload/decode could remain pending indefinitely; palette pending map was unbounded | Preload lacked a deadline; shared pending palette promises lacked eviction/identity checks. Own a 4-second deadline, remove failed preload entries for retry, bound pending palettes to 64 | Media artwork TS; stalled decode/cleanup/retry Node regression red before | Very slow covers may timeout and retry; existing view-generation guards remain |
| Medium | Fan's queued bounce frame affected the reconnected view | RAF had no handle or generation ownership. Track handles, cancel on view retirement and check captured generation | Fan TS; `fan-lifecycle.spec.mjs` reconnect bounce red before | Only an obsolete animation is suppressed |
| Low | Person's empty message stayed in the previous profile language | Empty render signature excluded resolved locale. Include locale and store the same signature after rendering | Person TS; missing-entity locale test red after strengthening its shadow-DOM/nonempty assertion | Only invalid/missing-entity copy is refreshed |
| Observation | A weak Person test passed on an empty host text; HACS editor count allowed a missing pair | Test quality issue. Read real shadow content and assert exact registry tag/editor pairs rather than a lower count | Person lifecycle and HACS browser tests | No runtime feature change |

### Previously open runtime audit PR

[PR #310](https://github.com/danielmigueltejedor/nodalia-cards/pull/310) was
reviewed against current main, not accepted solely because CI passed. Its four
valid changes were merged once in main `243abb3b` and are included without duplicate patches: automatic↔fixed native Sections wrapper
ownership, explicit Advance Vacuum helper discovery, News persistence ownership,
and bounded shared numeric formatters. The old wrapper correction did not observe
an existing cell's row-class change; explicit helpers still enumerated unrelated
states; a scheduled News helper write could target a retired config/account;
and formatters were created repeatedly in numeric hot paths. Associated native
layout, discovery-count, delayed helper-write and numeric parity/eviction
regressions remain. Compatibility adapters were retained rather than guessed dead.

| Rank | Previous bug / cause → correction | Files / regression / residual risk |
|---|---|---|
| High | Native Sections wrapper mode stayed stale on an existing cell's class change → observe only that class, update owned display, release observer on detach | `src/shared/card-layout-notifier.ts`; native row-mode browser regressions in `graph-grid-height.spec.mjs`; fixed rows keep native HA behavior |
| Medium | Explicit Advance Vacuum helpers scanned unrelated states → configured availability fingerprints with live values | `src/cards/advance-vacuum/advance-vacuum-card.ts`; explicit-tracking behavioral test in `advance-vacuum-lifecycle.spec.mjs`; automatic discovery remains broader |
| High | Scheduled News writes belonged to retired config/account → captured persistence owner and cancellation | `src/cards/news/news-card.ts`; queued helper writes test in `news-lifecycle-editor.spec.mjs`; local history compatibility retained |
| Medium | Hot numeric paths allocated a formatter every call → shared 64-entry cache | `src/shared/numeric-values.ts`; numeric parity/eviction unit tests; eviction may allocate again, formatting semantics preserved |


## D. Performance and resource evidence

* **Formatter microbenchmark** from the reviewed runtime audit: 20,000 identical
  `formatFiniteNumericValue(i / 7, 1, "es")` calls, median of five VM rounds on
  Node 24.14.0: **156.3 ms before / 15.7 ms after**. This is not dashboard FPS,
  mobile performance or a tenfold whole-application improvement.
* **Discovery work count:** 105 explicit room/activity lookups with 1,700 unrelated
  states enumerated the catalog 105 times before and zero afterward. Live helper
  values and added/removed helper IDs remain observable. Automatic discovery is
  still intentionally broader; caching only mutable object identity is unsafe.
* **History load boundary:** 100,000 finite/zero/negative input samples reduce
  to the configured 480 output samples without mutating input. Existing tests
  enforce a 10,000-point maximum, malformed input rejection and finite SVG paths.
* **Dashboard resource soak:** each of 12 complex cards undergoes 24 cycles of
  mount → 40 hass updates → interaction/cancellation → detach/reconnect → entity
  replacement → remount. This is 960 updates per card, 11,520 per browser project.
  Summary must exercise actual embedded Media/Light children. Camera uses a
  successful image fixture. Active owned timers, frames, observers, global
  listeners, live DOM and pending fixture subscriptions/requests are compared
  against the warmed detached baseline on every cycle and after settling.
* **Transport soak:** 60 go2rtc source replacement/reconnect cycles check socket
  closure, poster URL revocation, frame callback cancellation, media-node removal,
  empty queues and stale-message rejection. Separate tests exercise real native
  peer/ICE/autoplay boundaries with controlled transport responses.

These ledgers measure retained active resources, not noisy process RSS or a
browser heap/GPU allocation guarantee. Native codecs, actual camera networks and
physical Safari gestures still warrant device testing. No universal FPS or heap
reduction is claimed. Existing slider/map/history tests preserve DOM identity and
coalesce work; no whole-map reconstruction was introduced during gestures.

## E. Bundle and dependency budget

Caps remain **4,325,376 raw / 972,800 gzip**, unchanged.
Audit corrections currently measure **4,146,010 raw / 946,364 gzip**:
**+7,659 / +1,815** from main, with **179,366 / 26,436 bytes** headroom.
The earlier size audit's published alpha.5 baseline was 4,324,238 / 968,592;
its reductions remain substantially preserved. The prepared beta measures **4,146,005 raw / 946,364 gzip**: **+7,654 / +1,815**
from main, with **179,371 / 26,436 bytes** remaining. Two consecutive normal
builds produced identical SHA-256 values for all 37 distributed JavaScript files.
Release metadata validates all eight required repository files, matching package/
manifest versions, checksums and a CycloneDX SBOM with no runtime dependencies.

Production dependencies remain zero. The full dependency audit returned zero
known vulnerabilities across all severities. Runtime libraries/toolchain majors
were not added or upgraded. The pinned toolchain remains pnpm 11.17.0,
TypeScript 6.0.3, ESLint 10.11, Playwright 1.63 and esbuild 0.28.2; Linux CI uses
Node 22, local measurements Node 24.14.0.

## F. Test quality and coverage

Historical regex/source tests remain explicitly source contracts; they do not
prove runtime behavior. New adversarial tests exercise real card/editor DOM,
actual gesture handlers, asynchronous out-of-order responses and owned resources.
The existing Vacuum signature check preserves ordering while allowing the newly
required identity retirement before hass assignment. No coverage was removed.
The exact 25 editor/card registry pairs are now enforced.

New coverage includes 25 standalone cold loads, 12 resource soaks, one transport
soak, Engine races/ranges, Camera signing ownership/bounds, retired device/editor
contexts, Fan frame retirement, Person empty locale and large Graph histories.
The audited code at `4f3ef86b99235e143e8c332afda922e3a547bf34` passed **805 Node
checks (0 skipped)** and Linux CI [37247418978](https://github.com/danielmigueltejedor/nodalia-cards/actions/runs/37247418978):
**Chromium 397, Firefox 396 + 1 skip, WebKit 397, iPhone WebKit 396 + 1 skip**.
This adds 13 Node and 66 browser cases per project versus the recorded main
baseline, including prior PR #310. The two original platform skips are unchanged;
no failures or flaky/retried cases were reported. Full local macOS validation
passed 1,190 cases with one platform skip and zero failures/flaky results.
[Soak evidence](audits/beta-readiness-local-soak.json) records all 36 local
card/project combinations: detached snapshots return to baseline at every cycle,
with zero pending requests/subscriptions/frames/timers/observers and no page errors.
The exact beta version independently passed these gates; see acceptance below.

## G. Compatibility and audit matrix

| Area | Review / behavioral evidence |
|---|---|
| Architecture/distribution | Registry 25 pairs; all source reachable from 60 card/standalone/runtime roots; no new cycles/debt; all artifacts syntax checked; generated drift and build determinism gates |
| HACS/globals | One `nodalia-cards.js`, no editor sidecar request; compatibility globals and helper namespaces retained. `NodaliaEditorUI`/bundle version metadata are HACS footer contracts; standalone uses `NodaliaI18n.editorStr` and documented support resources |
| Standalone | All 25 artifact paths load their own card/editor after shared supports, without importing the HACS entrypoint; static factories exercised |
| YAML | Existing flat/nested aliases, actions/styles/extensions, zero/false/empty/null boundaries covered by pure config suites and 25 editor browser suites; no migration required |
| Engine | Missing/unknown command, API 2 fallback, v3 capability gates, partial/malformed/future handshake, error, reconnect/account/auth retirement; revision 0 and enabled false retained; Engine remains optional |
| Rain | Probability stays `{value}`; explicit temperature/probability fields and versioned templates; missing data and real 0 °C covered |
| Sections | Native auto/fixed/mixed row tests, live cell class transitions, narrow/wide cards, consecutive Graphs, sibling Fav/Alarm/Light/Fan/Humidifier expansions; local resize notifications only |
| Rounded/glass visuals | Light/dark, compact/wide, entrance/cached artwork and TV sources, name/status/collapse/time chips, Summary embedding, Graph/Weather scrollports; four-engine computed geometry/composition checks |
| Media/Navigation | Delayed/failed/cached artwork, crossfade generations, no warm tint flash, MA browse idle six-column tiles, stacked switch, TV sources, focus and layout ownership |
| Advance/Vacuum | Explicit/autodetected helpers, robot prefix boundaries, service aliases, Smart failures and out-of-order responses, revisions, map/marker identity, pointer/native touch/cancel/zone/room gestures |
| Graph | Fixed/auto/configured chart height, reconnect/history/resize, zero/negative/nonfinite input, toggled series and large samples |
| News | Delayed config/account/auth/connection writes, empty/current history, editor draft/persistence lifecycle |
| Camera/go2rtc | WebRTC/MSE/native/audio/autoplay/retry, expanded portals, signed URLs, late events, replacement and repeated teardown |
| Climate | Dial and schedule/override ownership, account/entity changes, Engine preview bridge, optimistic drafts/focus |
| Small cards | Cover/Lock/Fav/Entity/Insignia/Person/Scenes/Gauge/Power Flow configuration, keyboard/touch/actions, finite values, cancellation and lifecycle suites |
| Notifications/Calendar/Weather | Batches/subscriptions/forecasts, foreground/background queues, dismissals, sessions/accounts, actions, dialogs and focus |
| Editors | All 25 created; draft/focus/caret, native pickers, list operations, config feedback, language and reconnect suites; Engine editor race cases |
| i18n | All 12 runtime/editor catalogs, key/placeholder/code parity, fallback/aliases, zero/false/Unicode/prototype names, malformed public locale and lazy identity |
| Security | Own-property path guards, sanitised CSS/URLs, escaped markup, malformed HA/Engine/go2rtc payloads, bounded numeric and queue/cache inputs; full dependency audit and CodeQL |
| Accessibility | Enter/Space/Escape, slider keys, Lock confirmation/slide, accessible names, focus restoration, disabled controls, pointer/touch cancellation and axe browser checks |
| Cleanup | No reachable module removed; no suppression/TODO introduced; generator inputs, public adapters and historical release notes retained; unrelated local duplicate test file untouched |

## H. Remaining limitations

Fixtures cannot enumerate every Home Assistant version, integration, real robot
firmware, physical iPhone compositor, stream codec or large installed dashboard.
Cold artwork still depends on network and decoding. A shared cold preload owns a
bounded deadline; disconnecting a subscriber retires its callback, not another
card's shared download. Some source-contract tests are intentionally retained.
Optional capability methods do not imply new visible editor controls.
Cursor Bugbot exhausted its external usage quota and did not review PR #311;
its neutral status is not a completed code review. CodeQL and the separate
security check passed. No human reviewer approval is claimed.
Future profiling targets include Notifications registry serialization and
necessary automatic vacuum discovery; they are observations, not known broken
contracts. Account context changes now reset unfinished private interaction.

## I. Acceptance

**BETA READY.** No known structural/behavior blocker remains from this audit.
The decision follows adversarial red-before/green-after regressions and resource
soaks, not inherited suite counts alone. This is readiness for stabilization,
not a claim that physical devices/integrations can have no further bugs.

`3.0.0-beta.1` was prepared through normal tooling at
`9d24a3d51c724569e36aaa89efa9651388c56cad`. Its exact versioned artifacts passed:

| Gate | Exact beta result |
|---|---|
| Strict TypeScript / typed ESLint / architecture / debt | Passed; 284 checked modules, zero suppression/import-cycle debt |
| Translations / distribution / generated drift / budgets | Passed; all 12 languages, 25 card/editor pairs, single HACS resource |
| Node | 805 pass, 0 fail/skip |
| Linux Chromium / WebKit | 397 / 397 pass |
| Linux Firefox / iPhone WebKit | 396 / 396 pass, 1 platform skip each |
| Local Chromium / WebKit / iPhone | 1,190 pass, 1 platform skip, 0 fail/flaky |
| HACS | [37248328397](https://github.com/danielmigueltejedor/nodalia-cards/actions/runs/37248328397), passed |
| CodeQL | [37248328395](https://github.com/danielmigueltejedor/nodalia-cards/actions/runs/37248328395), passed |
| Exact beta Linux CI | [37248328544](https://github.com/danielmigueltejedor/nodalia-cards/actions/runs/37248328544), all five jobs passed |
| Dependencies | Full audit: 0 known vulnerabilities; 0 production npm dependencies |
| Reproducibility / metadata | Frozen lockfile; 37 identical JS SHA-256s across two builds; manifest/package parity, eight required repository assets, checksums and SBOM verified |
| Bundle | 4,146,005 raw / 946,364 gzip; unchanged caps, 179,371 / 26,436 bytes remaining |

The [exact beta build record](audits/beta-readiness-beta-build.json) and
[resource evidence](audits/beta-readiness-local-soak.json) preserve machine-readable
measurements. Subsequent report-only edits preserve these runtime hashes; the
latest exact PR commit's checks are available on
[PR #311](https://github.com/danielmigueltejedor/nodalia-cards/pull/311).

Feature/architecture/YAML/public API freeze is formalized in CONTRIBUTING,
ROADMAP, architecture, upgrade and release docs. Curated beta notes are promoted
in CHANGELOG-PRERELEASES and generated using the existing notes tool. Stable
2.2.10 remains the published stable recommendation. This task prepares the beta;
**no beta tag or GitHub release is published**.
