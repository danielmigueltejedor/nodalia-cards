# Bundle size audit — 3.0.0-alpha.5

Audit date: 2026-10-03. Baseline: `acea0d2ad0c1ce4b4af9be431cc1f2c26182b7e7`.
This pass reduces representation and duplicated styles without removing features,
translations, public interfaces or supported distribution paths. The package
version and both bundle budgets remain unchanged. No release is created by this
size audit.

## Baseline and final inventory

| Measurement | Before | After |
|---|---:|---:|
| HACS resource, raw bytes | 4,324,238 | 4,132,872 |
| HACS resource, gzip bytes (Node `gzipSync`, default settings) | 968,592 | 942,929 |
| Raw budget, strict upper limit | 4,325,376 | 4,325,376 |
| Gzip budget, strict upper limit | 972,800 | 972,800 |
| Raw headroom below budget | 1,138 | 192,504 |
| Gzip headroom below budget | 4,208 | 29,871 |
| TypeScript files under `src/`, including declarations | 284 | 284 |
| Checked TypeScript implementation modules | 282 | 282 |
| Component CSS files | 23 | 27 |
| Card registry entries | 25 | 25 |
| Node regression tests | 786 | 791 |
| Browser cases / files | 1,240 / 77 | 1,240 / 77 |
| Browser cases per project | 310 | 310 |
| Distributed root JavaScript resources | 37 | 37 |
| Explicit package file entries, excluding directory entry | 68 | 68 |
| npm package files, including expanded examples | 103 | 103 |
| HACS runtime downloads | 1 | 1 |
| Production npm dependencies | 0 | 0 |
| Suppression / runtime import-cycle debt | `[]` / `[]` | `[]` / `[]` |

Maintained `src/**/*.ts` plus `src/**/*.css`, excluding the two generated i18n
payloads, decreases from **4,837,901 to 4,775,009 bytes**: **62,892 bytes less**.
This is a source-file byte metric, not a count of executable instructions; tests,
build tools and documentation are outside that metric. Four shared CSS files
replace copied rules; they do not add browser requests.

## Measured optimizations

The following table measures the complete HACS resource in a cumulative sequence.
The translation row includes the final decoder performance correction. Gzip is
measured on each complete resource; independently compressed module sizes cannot
be added to obtain bundle gzip savings.

| Área | Antes raw | Después raw | Ahorro raw | Antes gzip | Después gzip | Ahorro gzip |
|---|---:|---:|---:|---:|---:|---:|
| Editor translation representation and reconstruction | 4,324,238 | 4,200,617 | 123,621 | 968,592 | 951,147 | 17,445 |
| Shared, equivalent editor CSS | 4,200,617 | 4,132,872 | 67,745 | 951,147 | 942,929 | 8,218 |
| **TOTAL** | **4,324,238** | **4,132,872** | **191,366** | **968,592** | **942,929** | **25,663** |

Total reduction: **4.43% raw**, **2.65% gzip**. No cap was raised.

The actual small implementation checkpoints were:

| Checkpoint | Raw | Gzip | Validation |
|---|---:|---:|---|
| Original baseline | 4,324,238 | 968,592 | 786 Node tests; complete browser validation attempted |
| Locale columns and backward references | 4,200,569 | 951,102 | All fast gates; 789 Node tests |
| Exact CSS sharing | 4,132,824 | 942,884 | All fast gates; 789 Node tests |
| Final decoder and boundary regressions | 4,132,872 | 942,929 | All fast gates; 791 Node tests |

The final decoder costs 48 raw / 45 gzip bytes compared with the intermediate
checkpoint. It removes a measured first-query slowdown from the translation
optimization; the completed translation optimization still reduces both sizes
relative to the original. Temporary variants with smaller byte counts but worse
initialization were not retained.

### Editor translations: 123,621 raw / 17,445 gzip bytes saved

Sources:

- `scripts/gen-editor-ui.mjs`
- `scripts/editor-translation-packing.mjs`
- `src/shared/editor-i18n-runtime.ts`
- Generated `src/shared/editor-i18n-data.ts`, `nodalia-editor-ui.js`, HACS bundle
  and manifest, rebuilt through the normal generators.

The legacy editor rows now group strings by locale instead of interleaving twelve
languages. Repeated labels within a locale retain their first string and encode
later occurrences as backward indices. The keyed catalog uses the same local
reference format. No translation is deleted or shortened, and the maintained
locale JSON files and English fallback remain unchanged.

The decoder accepts only strings or integer references to an already validated
string. Index zero, empty strings, Unicode, quotes and placeholders survive.
Invalid, negative, fractional, forward and self references fail at the unknown
JSON boundary. Unequal or missing legacy columns cannot publish partial maps.
Catalog properties such as `__proto__` remain ordinary own data properties with
the same descriptors and ordinary object prototype.

The legacy map and keyed catalog remain **separate lazy caches**. A keyed lookup
does not parse the legacy rows. Public map keys, labels, cache identity and
`editorStr` behavior are unchanged. Reconstruction now builds objects directly
rather than allocating one temporary key/value pair array for every label.

Evidence and protection:

- All **8,628 legacy locale labels** and **17,364 keyed catalog values** match the
  captured original bundle: **25,992 exact comparisons** across twelve languages.
- `tests/editor-translation-packing.test.mjs`: round-trip and index-zero behavior,
  malformed references, all canonical locale overlays/fallbacks/placeholders,
  cache laziness, prototype-named properties and malformed locale columns.
- `tests/release-candidate-smoke.test.mjs`: existing translation expectations now
  read the public decoded maps rather than assuming a private generated JSON
  layout; previous language/sample assertions are retained.
- Existing editor and locale browser regressions continue to exercise the public
  translation API.

Cold-query timing is an isolated Node 24.14.0 VM microbenchmark, not a promised
Home Assistant startup measurement. It uses compiled scripts, fresh contexts,
200 alternating baseline/optimized rounds and discards 30 warmup rounds:

| First query | Baseline median / p95 | Final median / p95 |
|---|---:|---:|
| Legacy map | 1.391 / 2.515 ms | 1.233 / 1.964 ms |
| Keyed catalog | 3.789 / 7.190 ms | 1.775 / 4.243 ms |

A temporary global string pool was **rejected**: its data-only raw count decreased
by 119,678 bytes, but gzip increased by 5,112 bytes. The retained per-locale format
improves both complete-resource measurements and the measured first queries.

### Shared editor CSS: 67,745 raw / 8,218 gzip bytes saved

Sources:

- Existing `src/shared/editor-toggle-styles.ts` exports, now backed by readable
  `editor-toggle.css`, `editor-radius.css`, `editor-color.css` and
  `editor-section-action.css` in the same directory.
- Nineteen card editors: Advance Vacuum, Alarm Panel, Calendar, Circular Gauge,
  Climate, Cover, Fan, Fav, Graph, Humidifier, Insignia, Light, Media Player,
  Navigation, Notifications, Person, Power Flow, Vacuum and Weather.

Fifty-one copied blocks are replaced by imports of the existing four style
constants at the **same positions in their original templates**. Counts are 15
matching toggle blocks, 15 radius blocks, 4 color blocks and 17 section-action
blocks. Selectors, declaration order, focus styling, prefixes, custom properties
and layout overrides remain intact. Similar but different rules, including a
2-pixel focus variant, are retained locally.

Every extracted block was compared to its shared constant using esbuild's CSS
parser with **whitespace-only minification**. Syntax and identifier optimization
remain disabled. Constants already existed in the HACS graph through Lock; sharing
prevents nineteen editors from contributing their own copies. Standalone builds
embed the styles, just as they previously embedded the literal rules.

Evidence and protection:

- All 25 editors are mounted against the original and optimized HACS bundles in
  Chromium and WebKit. CSS rules, normalized by the same whitespace-only parser,
  retain their order and values. Sampled computed layout/color/focus-control
  properties also match. Native CSSOM can retain whitespace inside custom-property
  expressions, so raw CSSOM text is not treated as a visual difference.
- Public global property names, types and function arities match; editor lazy
  registration states match before mounting the editors.
- `tests/climate-editor-schedule.test.mjs` now uses the production embedded-CSS
  plugin when compiling the editor. Both existing schedule behavior assertions
  remain; no test was removed.
- Existing browser editor/draft/focus, accessibility, theme and layout regressions
  pass, including the complex card suites listed below.

## Build and systematic redundancy audit

Equivalent minified esbuild builds were measured with `metafile: true` and the
same target (`es2020`), charset, legal comments and CSS plugin as production.
The metadata itself was not added to the runtime or published package.

| Build body | Baseline raw | Final raw | Inputs before / after |
|---|---:|---:|---:|
| Core/support/cards IIFE | 3,450,103 | 3,382,358 | 251 / 255 |
| Editor-i18n IIFE | 873,405 | 749,784 | 3 / 3 |

Both bodies, registration metadata and version guards stay inside the same HACS
resource. The extra four graph inputs are the shared CSS files. There are no
imports from `scripts/` and no `standalone.ts` inputs in the HACS graph. The
standalone utility embedding adapter is excluded from that source-driven graph;
it remains necessary for the separate standalone entry paths.

The largest original contributions inside the cards body were runtime locale data
(342,998 bytes), Advance Vacuum (155,662), Climate (146,243), Entity (116,835),
Media Player (112,424), Humidifier (100,167), Calendar (96,887), Navigation
(94,492), Light (94,193) and Fan (91,474). The separate editor data contribution
was 869,110 bytes, plus 4,283 for its runtime. These figures are esbuild attribution,
not independently additive gzip sizes.

| Audit category | Evidence / disposition |
|---|---|
| Dead code, imports and private fields | Temporary `noUnusedLocals` / `noUnusedParameters` analysis produced 19 candidates. Timer/animation aliases are read by lifecycle tests; unused parameters retain existing signatures. No proven removable public-safe implementation was deleted. |
| Shared helpers and formatters | Numeric/config/media values, duration, URL/query, color/luminance, object paths, service invocation, history geometry and owned view-animation work already have shared implementations. Esbuild deduplicates module imports; replacing their card adapters can change fallback/binding semantics. |
| Repeated methods | AST body comparison found exact repeats in control watchers, event parsing, row renderers, config emission and permission guards. The largest remaining groups are listed below; lifecycle/event infrastructure was not refactored automatically. |
| Static constants/data | Locale arrays and long repeated strings were measured and compacted. Runtime locales are a distinct public catalog, not an extra copy of the editor catalog. Both remain supported. |
| CSS | Only parser-equivalent duplicates were shared. Dynamic state selectors, YAML style overrides and rules that merely look unused were retained without reachability proof. |
| Editors | Existing styles were shared without changing row generation, action parsing, config cloning, focus, drafts or when editor factories initialize. |
| Packaging/tree shaking | Checked TS entries and one registry supply the HACS build. Broad module imports and both public runtime/editor APIs explain retained inputs. No historical build script or embedded standalone utility duplicate was found in HACS. |
| Side effects/lazy hosts | Card registrations and compatibility globals are intentional side effects. Removing them or exporting only internally used methods would break YAML or tools. Card/editor factories remain lazy. |
| Distribution | The 37 root JS paths, package file list, examples and HACS filename are unchanged. New CSS is embedded at build time; it is not a new runtime dependency. |

## Compatibility inventory retained

- All 25 custom element tags and editor tags from `src/cards/registry.json`, their
  factories, stub/default configurations and all standalone resource names.
- `window.NodaliaUtils`, `NodaliaI18n`, `NodaliaBackend`, `NodaliaRenderSignature`,
  `NodaliaBubbleContrast` and the supported `__NODALIA_*` surfaces.
- Flat/HA action configuration handled by `control-config.ts`; language aliases
  `nb`/`nn` to `no`; legacy literal editor-label normalization; old flat background
  compatibility in Bubble Contrast; Insignia tint/color presets.
- Calendar `days_to_show`; Weather attribute-based forecast fallback; News single
  `entity`; Camera flat stream options and `expanded_actions` fallback.
- Climate setpoint/helper/webhook schedule paths, compact persistence format and
  Engine fallback; Notifications legacy background/mobile policies and templates;
  API 3 negotiation with API 2 compatibility.
- Advance Vacuum platform aliases, predefined room selections and outline
  fallback; existing vacuum integration schemas and safe numeric handling.
- Camera and go2rtc stream modes, retry/cleanup behavior, exposed stream helpers
  and startup ordering.

No uncertain compatibility path is classified as dead code simply because the
current fixtures use its replacement.

## Opportunities deliberately not implemented

Estimates below are **gross minified duplicate-body upper bounds**, measured by
minifying representative equal bodies with esbuild and multiplying by the number
of redundant copies. They exclude the shared helper and adapters needed to keep
contracts. They are not promised net bundle savings. Gzip savings require an
actual prototype build; this audit does not invent gzip estimates from raw bytes.

| Opportunity | Gross raw estimate | Risk / affected contract | Possible safe follow-up |
|---|---:|---|---|
| `_watchEditorControlTag`, largest group of 18 | Up to 7,684 bytes | Async generation ownership, stale custom-element definition callbacks, detach/reconnect | Shared watcher with retained instance adapters; test every editor's cancellation and reconnect behavior before measuring both resource sizes |
| `_onShadowValueChanged`, group of 14 | Up to 6,695 | Native HA control events, draft/commit timing, focused inputs | Preserve event routing and signatures; migrate one editor at a time against draft/focus tests |
| `_renderColorField`, group of 8 | Up to 6,167 | Escaping, theme values, alpha colors, template-specific selectors | Explicit editor-label/escape callbacks and local wrappers; compare markup/styles and native color interactions |
| `_renderCheckboxField`, group of 18 | Up to 7,072 | Toggle accessibility, labels, attributes and focus | Keep instance methods and literal DOM contracts; prove adapter size is lower before extending |
| `_renderIconPickerField`, group of 9 | Up to 3,752 | HA component readiness, value events, editor lifecycle | Small renderer adapter with unchanged factory/watch ownership |
| `_isServiceAllowed`, group of 4 | Up to 1,530 | HA user permissions and service/domain checks | Explicit boundary inputs, stale-context tests and identical allowed/denied cases |
| Private `idleActive` assignments in exposed artwork controller | Tens of bytes only | Constructor is reachable through `__NODALIA_MEDIA_PLAYER__`; external tools can inspect it | Audit external field contract before removing it; benefit is too small to justify uncertainty here |
| Remove legacy paths / reduce runtime locales / trim globals | Not estimated without a compatibility-breaking prototype | Existing YAML, public APIs and twelve maintained languages | Outside this pass; require explicit contract/versioning decisions |
| Split the HACS/editor resource or alter factory architecture | Not estimated | Single-download installation and lazy factory behavior | Outside this pass; keep the one-resource installation contract |

The global-string-pool experiment and slower decoder variants were rejected,
not future savings already counted in the results.

## Validation and practical limits

Before editing, `pnpm validate` passed every fast gate and 786 Node regressions.
Local Chromium/WebKit/iPhone ran 929 passing cases and one existing iPhone skip.
All 310 local Firefox cases failed **before running test code** because the
installed Firefox Nightly could not find its temporary profile folder. A retry
with a different temporary directory reproduced the environment failure.
The unchanged baseline has a green Linux four-browser/static release run:
[37113889075](https://github.com/danielmigueltejedor/nodalia-cards/actions/runs/37113889075).

For the final optimized source:

- `pnpm validate:fast`: version checks, architecture/debt/import guards, strict
  TypeScript, typed ESLint, 37 distribution syntax checks, both translation
  validations, offline locale audit, build and **791 passing Node tests**.
- Both translation generators rerun without generated drift; root artifacts are
  built from sources, never hand-edited.
- Local Chromium, WebKit and iPhone WebKit: **929 passed, one existing platform
  skip**, with the same 930 selected cases.
- Original/optimized Chromium and WebKit comparison: all 25 editor styles,
  sampled computed styles, lazy registrations and public API shapes match.
- Linux CI runs all four browser projects, generated-drift/static gates and HACS
  on the final PR revision; exact results are recorded in the PR checks.

The existing complex-card suites cover Climate, Media Player, Camera, Advance
Vacuum, Notifications, Room Summary, Light, Fan, Humidifier, Calendar, Power Flow
and Lock. Their regressions include optimistic UI and deadlines; pointer/touch
cancellation; keyboard/focus; owned async generations; detach/reconnect; entity
and HA-context replacement; unfinished editor drafts; translations; empty/missing
versus genuine zero data. No tests or platform projects were removed or disabled.

These fixture checks do not claim a new live Home Assistant/device benchmark.
Use [performance profiling](performance-audit.md) for a real large-dashboard trace.

## Reproducing size and graph measurements

```bash
pnpm install --frozen-lockfile
pnpm i18n:gen-editor
pnpm i18n:gen-runtime
pnpm validate:fast
pnpm exec playwright test
npm pack --dry-run --json --ignore-scripts
node --input-type=module -e 'import fs from "node:fs"; import {gzipSync} from "node:zlib"; const b=fs.readFileSync("nodalia-cards.js"); console.log({raw:b.length,gzip:gzipSync(b).length});'
```

For graph attribution, use `scripts/build-bundle.mjs`'s `buildParts` entry lists
and aliases with identical esbuild options, `write: false` and `metafile: true`.
Measure the editor and core/support/cards bodies separately. Do not ship the
metafile or change production entrypoints just to obtain attribution.
