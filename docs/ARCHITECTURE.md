# Nodalia Cards architecture

This document describes the TypeScript migration that starts in `2.3.0-alpha.3b`.
The public Lovelace/HACS contract is unchanged: custom element tags, YAML keys,
defaults, editors, translations, and the single-file `nodalia-cards.js` install
path stay the same.

## Current architecture map (main after 2.3.0-alpha.49)

The project is a Home Assistant Lovelace plugin. Handwritten cards historically
lived as root `nodalia-*.js` files that were both source and published artifacts.
Climate, Media Player, Light, Fan, Humidifier, Cover, Alarm Panel, Vacuum, Entity, Fav, Person, Camera, Circular Gauge, Insignia, Scenes, News, Weather, Graph, Calendar, Power Flow, Notifications, Navigation, Room Summary, Advance Vacuum and Lock canonical source now lives under
`src/cards/` and is compiled to the existing HACS `nodalia-*-card.js` artifacts.
Dashboard boot registers a tiny host per tag and compiles the real card or editor
class only when that custom element is first created.

```text
src/
  core/types/                 Shared HA / action / Engine / utils types
  cards/climate/              Climate TypeScript split (pilot)
  cards/media-player/         Media Player TypeScript split
  cards/light/                Light TypeScript split
  cards/fan/                  Fan TypeScript split
  cards/humidifier/           Humidifier TypeScript split
  cards/cover/                Cover TypeScript split
  cards/alarm-panel/          Alarm Panel TypeScript split
  cards/lock/                 Lock Card with deliberate unlock confirmation
  cards/vacuum/               Vacuum TypeScript split
  cards/entity/               Entity TypeScript split
  cards/fav/                  Fav TypeScript split
  cards/person/               Person TypeScript split
  cards/camera/               Camera TypeScript split
  cards/circular-gauge/       Circular Gauge TypeScript split
  cards/insignia/             Insignia TypeScript split (custom badge)
  cards/scenes/               Scenes TypeScript split
  cards/news/                 News TypeScript split
  cards/weather/              Weather TypeScript split
  cards/graph/                Graph TypeScript split
  cards/calendar/             Calendar TypeScript split
  cards/power-flow/           Power Flow TypeScript split
  cards/notifications/        Notifications TypeScript split
  cards/navigation/           Navigation TypeScript split
  cards/room-summary/         Room Summary TypeScript split
  cards/advance-vacuum/       Advance Vacuum TypeScript split

nodalia-utils.js              Shared runtime helpers (window.NodaliaUtils), including compact density
nodalia-backend.js            Generated optional Nodalia Engine client
nodalia-render-signature.js   Render-signature helpers
nodalia-bubble-contrast.js    Icon contrast helpers
nodalia-i18n.js               Generated runtime i18n
nodalia-editor-ui.js          Generated editor i18n catalog
nodalia-*-card.js             Card artifacts (migrated cards generated)
nodalia-cards.js              Minified HACS single-file bundle
scripts/build-src-cards.mjs   TypeScript → standalone JS
scripts/build-bundle.mjs      HACS bundle (imports migrated cards from src/)
```

All Lovelace cards now live under `src/cards/` and emit root `nodalia-*.js`
artifacts. Camera stream, Room Summary and render signatures also have checked
TS sources and generated compatibility adapters. Notifications mobile policy is
also generated from checked, side-effect-free TS with an idempotent global adapter.
Engine client also has checked TS source and a generated compatibility adapter.
Bubble contrast now has checked source and a generated adapter as well. Generic
utils remain handwritten compatibility code;
the i18n pack is generated from JSON while its lookup logic remains root JS.

## Large controller responsibilities

Size snapshots from the initial source split are obsolete. The main remaining
responsibilities live in these controllers; their strict migration is still open:

| Source | Responsibilities |
|---|---|
| `src/cards/advance-vacuum/advance-vacuum-card.ts` | Map, rooms, dock and sessions |
| `src/cards/climate/climate-card.ts` | Climate rendering and interactions |
| `src/cards/entity/entity-card.ts` | Entity domains and air quality |
| `src/cards/media-player/media-player-card.ts` | Artwork, playback and layouts |
| `src/cards/notifications/notifications-card.ts` | Inbox, mobile policy and Engine sync |
| `src/cards/power-flow/power-flow-card.ts` | Energy graph, nodes and popups |
| `src/cards/room-summary/room-summary-card.ts` | Room navigation and embedded card lifecycle |

The exact suppression inventory is `scripts/type-debt.json`; use the source
files, not generated JS size, to plan coherent typed extractions.

Climate still has a large view/controller. Config, model, dial, schedule and
types are already separate. Styles, actions and controller logic remain inside
`climate-card.ts` until a later extraction.

## Dependency relationships

```text
HACS: nodalia-cards.js
  CORE: i18n → utils → backend → render-signature → bubble-contrast
  SUPPORT: notifications-mobile-policy, room-summary-model, camera-stream-model
  CARDS: each nodalia-*.js (migrated cards compiled from src/cards/*/index.ts)
  EDITOR UI: nodalia-editor-ui.js concatenated after the runtime

Standalone Climate: nodalia-utils.js (required first) → nodalia-climate-card.js
  src/cards/climate/standalone.ts
    → index.ts (custom elements + window.__NODALIA_CLIMATE__)
    → climate-card / climate-editor / config / model / dial / schedule
    → climate-runtime.ts → window.NodaliaUtils

Standalone Light: nodalia-utils.js (required first) → nodalia-light-card.js
  src/cards/light/standalone.ts
    → index.ts (custom elements + window.__NODALIA_LIGHT__)
    → light-card / light-editor / config / helpers
    → light-runtime.ts → window.NodaliaUtils
```

Cards call Home Assistant through `hass.states`, `hass.callService`,
`hass.callWS`, and `NodaliaUtils.invokeHomeAssistantService`. The optional
Engine is `window.NodaliaBackend` (`nodalia/status`, climate schedule, inbox).

## Compatibility globals

These globals remain part of the public/standalone contract:

| Global | Role |
|---|---|
| `window.NodaliaUtils` | Shared helpers; required before standalone cards |
| `window.NodaliaI18n` | Runtime / editor strings |
| `window.NodaliaBackend` | Optional Engine client |
| `window.NodaliaRenderSignature` | Shared render-signature API |
| `window.NodaliaBubbleContrast` | Bubble icon contrast |
| `window.NodaliaEditorUI` | Editor catalog (`__NODALIA_EDITOR__`) |
| `window.__NODALIA_BUNDLE__` | Installed bundle version/hash |
| `window.__NODALIA_CLIMATE__` | Climate public helpers for tests/tools |
| `window.__NODALIA_MEDIA_PLAYER__` | Media Player public helpers for tests/tools |
| `window.__NODALIA_LIGHT__` | Light public helpers for tests/tools |
| `window.__NODALIA_FAN__` | Fan public helpers for tests/tools |
| `window.__NODALIA_HUMIDIFIER__` | Humidifier public helpers for tests/tools |
| `window.__NODALIA_COVER__` | Cover public helpers for tests/tools |
| `window.__NODALIA_ALARM_PANEL__` | Alarm Panel public helpers for tests/tools |
| `window.__NODALIA_VACUUM__` | Vacuum public helpers for tests/tools |
| `window.__NODALIA_ENTITY__` | Entity public helpers for tests/tools |
| `window.__NODALIA_ENTITY_AIR_QUALITY__` | Entity air-quality helpers for tests/tools |
| `window.__NODALIA_FAV__` | Fav public helpers for tests/tools |
| `window.__NODALIA_PERSON__` | Person public helpers for tests/tools |
| `window.__NODALIA_CAMERA__` | Camera public helpers for tests/tools |
| `window.__NODALIA_CIRCULAR_GAUGE__` | Circular Gauge public helpers for tests/tools |
| `window.__NODALIA_INSIGNIA__` | Insignia public helpers for tests/tools |
| `window.__NODALIA_SCENES__` | Scenes public helpers for tests/tools |
| `window.__NODALIA_NEWS__` | News public helpers for tests/tools |
| `window.__NODALIA_WEATHER__` | Weather public helpers for tests/tools |
| `window.__NODALIA_GRAPH__` | Graph public helpers for tests/tools |
| `window.__NODALIA_CALENDAR__` | Calendar public helpers for tests/tools |
| `window.__NODALIA_POWER_FLOW__` | Power Flow public helpers for tests/tools |
| `window.__NODALIA_NOTIFICATIONS__` | Notifications public helpers for tests/tools |
| `window.__NODALIA_NAVIGATION__` | Navigation public helpers for tests/tools |
| `window.__NODALIA_ROOM_SUMMARY__` | Room Summary public helpers for tests/tools |
| `window.__NODALIA_ADVANCE_VACUUM__` | Advance Vacuum public helpers for tests/tools |
| `customElements` tags | `nodalia-climate-card`, `nodalia-climate-card-editor`, etc. |

Internally, migrated modules import ES modules. Globals stay at distribution
boundaries so standalone `<script>` loading still works.

## Generated artifacts

| Artifact | Role |
|---|---|
| `nodalia-cards.js` | HACS/manual install: minified runtime + editor catalog |
| `nodalia-notifications-mobile-policy.js` | Generated from checked Notifications policy + global adapter |
| `nodalia-backend.js` | Generated from checked Engine client + global adapter |
| `nodalia-bubble-contrast.js` | Generated from checked contrast model + global adapter |
| `nodalia-climate-card.js` | Generated from `src/cards/climate/standalone.ts` (unminified IIFE) |
| `nodalia-media-player.js` | Generated from `src/cards/media-player/standalone.ts` (unminified IIFE) |
| `nodalia-light-card.js` | Generated from `src/cards/light/standalone.ts` (unminified IIFE) |
| `nodalia-fan-card.js` | Generated from `src/cards/fan/standalone.ts` (unminified IIFE) |
| `nodalia-humidifier-card.js` | Generated from `src/cards/humidifier/standalone.ts` (unminified IIFE) |
| `nodalia-cover-card.js` | Generated from `src/cards/cover/standalone.ts` (unminified IIFE) |
| `nodalia-lock-card.js` | Generated from `src/cards/lock/standalone.ts` |
| `nodalia-alarm-panel-card.js` | Generated from `src/cards/alarm-panel/standalone.ts` (unminified IIFE) |
| `nodalia-vacuum-card.js` | Generated from `src/cards/vacuum/standalone.ts` (unminified IIFE) |
| `nodalia-entity-card.js` | Generated from `src/cards/entity/standalone.ts` (unminified IIFE) |
| `nodalia-fav-card.js` | Generated from `src/cards/fav/standalone.ts` (unminified IIFE) |
| `nodalia-person-card.js` | Generated from `src/cards/person/standalone.ts` (unminified IIFE) |
| `nodalia-camera-card.js` | Generated from `src/cards/camera/standalone.ts` (unminified IIFE) |
| `nodalia-circular-gauge-card.js` | Generated from `src/cards/circular-gauge/standalone.ts` (unminified IIFE) |
| `nodalia-insignia-card.js` | Generated from `src/cards/insignia/standalone.ts` (unminified IIFE) |
| `nodalia-scenes-card.js` | Generated from `src/cards/scenes/standalone.ts` (unminified IIFE) |
| `nodalia-news-card.js` | Generated from `src/cards/news/standalone.ts` (unminified IIFE) |
| `nodalia-weather-card.js` | Generated from `src/cards/weather/standalone.ts` (unminified IIFE) |
| `nodalia-graph-card.js` | Generated from `src/cards/graph/standalone.ts` (unminified IIFE) |
| `nodalia-calendar-card.js` | Generated from `src/cards/calendar/standalone.ts` (unminified IIFE) |
| `nodalia-power-flow-card.js` | Generated from `src/cards/power-flow/standalone.ts` (unminified IIFE) |
| `nodalia-notifications-card.js` | Generated from `src/cards/notifications/standalone.ts` (unminified IIFE) |
| `nodalia-navigation-bar.js` | Generated from `src/cards/navigation/standalone.ts` (unminified IIFE) |
| `nodalia-room-summary-card.js` | Generated from `src/cards/room-summary/standalone.ts` (unminified IIFE) |
| `nodalia-advance-vacuum-card.js` | Generated from `src/cards/advance-vacuum/standalone.ts` (unminified IIFE) |
| `nodalia-cards.manifest.js` | Version/hash metadata |
| `nodalia-i18n.js` / `nodalia-editor-ui.js` | Generated from `i18n/` JSON |

Community translations are curated on self-hosted Weblate
([translate.getnodalia.com](https://translate.getnodalia.com)); see
[`docs/TRANSLATIONS.md`](./TRANSLATIONS.md) and [`docs/weblate/README.md`](./weblate/README.md).
Locale JSON under `i18n/runtime/` and `i18n/editor/` remains authoritative for builds.

Do not edit generated Climate, Media Player, Light, Fan, Humidifier, Cover, Alarm Panel, Vacuum, Entity, Fav, Person, Camera, Circular Gauge, Insignia, Scenes, News, Weather, Graph, Calendar, Power Flow, Notifications, Navigation, Room Summary, Advance Vacuum or Lock JS by hand. Change
`src/cards/climate`, `src/cards/media-player`, `src/cards/light`, `src/cards/fan`,
`src/cards/humidifier`, `src/cards/cover`, `src/cards/alarm-panel`, `src/cards/vacuum`, `src/cards/entity`, `src/cards/fav`, `src/cards/person`, `src/cards/camera`, `src/cards/circular-gauge`, `src/cards/insignia`, `src/cards/scenes`, `src/cards/news`, `src/cards/weather`, `src/cards/graph`, `src/cards/calendar`, `src/cards/power-flow`, `src/cards/notifications`, `src/cards/navigation`, `src/cards/room-summary`, `src/cards/advance-vacuum` or `src/cards/lock` and run `pnpm run bundle`. The HACS bundle and standalone artifacts both register the same lazy card and visual editor. Climate’s unused, unregistered legacy editor has been removed; the registered editor retains legacy YAML schedule fields when the Engine is unavailable.

## Tests protecting each subsystem

| Area | Tests |
|---|---|
| Tags, versions, HACS filename, bundle size | `tests/architecture-contracts.test.mjs`, `tests/release-candidate-smoke.test.mjs` |
| Climate public API / schedule storage | `tests/climate-setpoint-schedule-storage.test.mjs` (`window.__NODALIA_CLIMATE__`) |
| Light public API / optimistic toggle | `tests/light-optimistic-toggle.test.mjs`, `tests/interaction-regressions.test.mjs` (`window.__NODALIA_LIGHT__`) |
| Climate interactions, compact/circular, editors | `tests/interaction-regressions.test.mjs`, `tests/high-severity-regressions.test.mjs` |
| Engine schedule / override chips | `tests/engine-dashboard-native-ux.test.mjs` |
| Browser / a11y / layouts | `tests/browser/*.spec.mjs` (Chromium, Firefox, WebKit) |
| i18n | `pnpm run i18n:validate-editor`, `i18n:validate-runtime`, `i18n:audit`, `tests/editor-catalog-i18n.test.mjs` |

Treat existing tests as the behavior specification. Prefer adding a behavioral
test before removing a source-regex check.

## Target architecture

```text
src/
  core/
    types/           HA, actions, Engine, utils (started)
    config/          merge, compact, safe paths (still nodalia-utils.js)
    actions/         shared Lovelace action executor (not yet)
    home-assistant/  service / webhook wrappers (not yet)
    i18n/            still nodalia-i18n.js
    styles/          tokens / contrast (still bubble-contrast.js)
  cards/<name>/
    index.ts         registration
    <name>-card.ts   HTMLElement orchestration
    <name>-config.ts defaults, normalize, migrations
    <name>-model.ts  pure state projection
    <name>-actions.ts service calls
    <name>-editor.ts visual editor
  entrypoints/       future HACS/standalone entries
```

Do not invent extra layers just to fill this tree. Split by responsibility
when a file is large *and* mixed.

## Phased migration plan

1. **Infrastructure (this preview)** — `tsconfig.json`, ESLint, esbuild TS,
   `src/`, `pnpm run typecheck` / `lint` in `validate`.
2. **Shared core** — move utils/backend/render-signature/bubble-contrast into
   `src/core/` with window adapters at the bundle edge.
3. **Climate pilot (this preview)** — split Climate; keep Lovelace behavior.
4. **Remaining large cards** — source split complete; strict migration remains open.
5. **Smaller cards** — source split complete; strict migration remains open.
6. **Cleanup** — drop obsolete internals, reduce globals, type remaining
   `@ts-nocheck` files, replace regex tests with behavioral tests where safe.

## Build pipeline

1. `pnpm run typecheck` — `tsc --noEmit` with strict TypeScript.
2. `pnpm run lint` — ESLint on `src/**/*.ts`.
3. `scripts/build-src-cards.mjs` — esbuild TypeScript cards to root JS.
4. `scripts/build-bundle.mjs` — esbuild HACS bundle from published JS parts,
   compiling migrated cards from `src/cards/*/index.ts`.

`pnpm validate:fast` checks versions, tracked architecture debt, strict types, lint,
distribution syntax, translations, build and unit tests. `pnpm validate` adds the
full Playwright suite. CI also rejects generated artifact drift and validates
Chromium, Firefox, WebKit and iPhone WebKit before release publication.

## Card architecture (Climate pilot)

```text
climate-types.ts       Config, schedule and public API types
climate-constants.ts   Tags, versions, dial/schedule numeric constants
climate-runtime.ts     Explicit window.NodaliaUtils adapters
climate-config.ts      DEFAULT_CONFIG, migrations, normalizeConfig
climate-model.ts       Temperature/HVAC/display helpers
climate-dial.ts        Dial geometry and pointer conversion
climate-schedule.ts    Schedule parse/storage/timeline/serialization
climate-card.ts        Web component lifecycle and render (still large)
climate-editor.ts      Visual editor (still large)
index.ts               Custom element registration + window.__NODALIA_CLIMATE__
standalone.ts          Standalone entry; uses the same registered editor as HACS
```

## Card architecture (Light)

```text
light-types.ts         Public API types
light-constants.ts     Tags, versions, timeouts, color presets
light-runtime.ts       Explicit window.NodaliaUtils adapters
light-config.ts        DEFAULT_CONFIG, migrations, normalizeConfig
light-helpers.ts       Color, temperature slider and editor color helpers
light-card.ts          Web component lifecycle and render (still large)
light-editor.ts        Visual editor (still large)
index.ts               Custom element registration + window.__NODALIA_LIGHT__
standalone.ts          Standalone entry for nodalia-light-card.js
```

## TypeScript conventions

`tsconfig.json` enables `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`, `noImplicitOverride`
and `useUnknownInCatchVariables`.

Legacy suppressions remain in large views/editors and some helpers/configs,
plus Climate's model and schedule. The exact current inventory is
`scripts/type-debt.json`; `pnpm architecture:check` reports it and rejects new debt.
A `.ts` filename or passing `tsc` does not imply suppressed modules were checked.

Do not introduce `any` in new modules. Prefer `unknown` plus narrowing.
Home Assistant types in `src/core/types` only include fields Nodalia actually
reads.

## Adding a new card

Follow [adding-a-card.md](adding-a-card.md). Define checked TS modules and add
one entry to `src/cards/registry.json`; the registry supplies both bundle and
standalone build inventories. Include the artifact in `package.json.files`.
Root `nodalia-*.js` card files are generated outputs, not a place to implement
new cards or edit existing behavior. Retired one-shot extractors are recoverable
from Git history, but their fixed line offsets do not fit the current build.

## Adding a new editor

Editors stay next to their card (`climate-editor.ts`). They must keep the
existing `-editor` custom element tag and `config-changed` event shape.

## Adding shared functionality

Put identical helpers in `src/core/` (or `nodalia-utils.js` during the
transition). Do not centralize look-alike code with different semantics.

## Remaining migration

1. Shared core → `src/core/`
2. Type remaining `@ts-nocheck` files and replace regex tests with behavioral tests where safe
3. Remove obsolete globals once every consumer imports modules

See `docs/REFACTOR_ALPHA47.md` for the earlier JS-layer helper centralization.

## 2026-09-30 audit implementation

The build-time source inventory is `src/cards/registry.json` (25 cards, including
Lock). Build and architecture tests consume it; registration still belongs to each
card's `index.ts` so lazy custom-element behavior and public tags remain stable.
`package.json.version` feeds generated `src/version.ts`; per-card constants
re-export it rather than storing independent versions.

Camera stream rules, Room Summary projection and render signatures now have
checked TypeScript source with small compatibility entrypoints that retain the
published `window.Nodalia*` APIs and root JS filenames. Pure modules do not mutate
browser globals; their runtime adapters own that boundary. Existing consumers
can migrate to imports without breaking users' standalone resources.

Six config/helper cycles were removed through checked defaults and normalization modules.
Do not place defaults in modules that import their own normalizers.
Notifications normalization now lives below the config and presentation helpers;
no runtime import cycles remain.
74 legacy modules still suppress typechecking; see `scripts/type-debt.json`.
**The full TypeScript migration is not complete.** Checked modules and extracted
contracts must grow without adding suppressions or casts to hide errors. The
architecture guard prevents new unchecked files and new runtime cycles.

Room Summary parking deliberately disconnects embedded cards; their disconnect
callbacks release streams/timers/listeners. Camera's body portal owns listeners
on its shadow root and removes them from that same root. Preserve these ownership
boundaries and the existing reconnect/portal browser regressions.

Media Player shares palette sampling and transport styling with Navigation.
Transport uses equal side columns so auxiliary controls cannot shift the center
capsule. Cached palettes apply synchronously; sampling requests are coalesced,
cache sizes bounded, and color transitions do not animate on reconstruction.
An unseen artwork still needs network/image decoding; do not promise zero network
latency or hide a failed cover request with an opaque fallback.

See [audit](TECHNICAL_AUDIT.md), [adding cards](adding-a-card.md),
[testing](testing.md) and [releasing](releasing.md).

Scenes configuration and helpers are now checked without suppression, including
normalized row contracts, CSS input boundaries and dashboard scroll snapshots.

Editor color conversion now lives in checked `src/shared/editor-color.ts`. Twenty
legacy helper modules re-export its functions for existing callers; Lock uses it
directly. The model distinguishes RGB channels from CSS Color 4 sRGB channels,
retains alpha and delegates wider-gamut conversion to the browser. Card-specific
color fallback policies remain colocated with their helpers. Fan/Humidifier share
checked control action/style normalization; Cover reuses the style projection.

Vacuum configuration and helper ownership/mode-label functions now pass strict
checking. Reported states and error sensors share localized
`charger_disconnected` labels. Status chips constrain both their flex row and a
dedicated ellipsis span; full text is retained in the title.

Fan, Humidifier and Cover helpers are checked. Their identical slider/dial pointer
math lives in `src/shared/device-control-geometry.ts` with explicit DOM, rectangle
and range contracts. Distinct unavailable policies and device icon rules remain
local. The shared model prevents NaN markers from malformed values and retains
quantized steps, cached drag geometry, center dead zones and bottom arc gaps.

Alarm Panel and Person config/helpers are checked, as are Room Summary's editor
list/path helpers. Stub entity selection and size parsing have six real card
consumers in `src/shared/editor-entity-helpers.ts`. Optional standalone utils
embedding consumes the registry too, including Lock; its embed/strip round trip
is tested for every artifact.

Light configuration and helpers are checked. Its quick brightness, preset colors,
animation bounds, legacy inactive tint and collapsed aliases retain existing YAML
behavior. RGB inputs require three finite channels; editor stubs and slider math
reuse the checked shared modules. Kelvin/mired conversion and gradient direction
remain domain-specific.


Fav and Insignia configuration/helpers are checked without suppression, sharing
only identical stub selection, size parsing and CSS projection. Their distinct
domain icon policies and legacy tint/action semantics remain separate. Unknown
YAML branches are narrowed before reading; invalid nested styles no longer crash
configuration. Insignia still sanitizes CSS at rendering, preserving stored YAML.


The HACS build maps every generated support runtime back to its canonical TS
entry using `RUNTIME_ENTRIES`, as it does for card entries through the registry.
This lets support and card code share modules such as CSS color parsing instead
of compiling independent copies. Standalone support filenames remain public.
Theme-dependent CSS values are resolved on every use; fixed-color probe results
have a bounded 256-entry cache. Temporary probes are removed in a finally block.
