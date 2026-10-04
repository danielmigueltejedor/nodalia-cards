# Nodalia Cards architecture

This document describes the complete checked architecture introduced in `3.0.0`.
The migration began in `2.3.0-alpha.3b`.
The public Lovelace/HACS contract is unchanged: custom element tags, YAML keys,
defaults, editors, translations, and the single-file `nodalia-cards.js` install
path stay the same.

## Current architecture map (3.0.0-alpha.8)

The project is a Home Assistant Lovelace plugin. Handwritten cards historically
lived as root `nodalia-*.js` files that were both source and published artifacts.
Climate, Media Player, Light, Fan, Humidifier, Cover, Alarm Panel, Vacuum, Entity, Fav, Person, Camera, Circular Gauge, Insignia, Scenes, News, Weather, Graph, Calendar, Power Flow, Notifications, Navigation, Room Summary, Advance Vacuum and Lock canonical source now lives under
`src/cards/` and is compiled to the existing HACS `nodalia-*-card.js` artifacts.
Dashboard boot registers a tiny host per tag and compiles the real card or editor
class only when that custom element is first created.

```text
src/
  core/engine-client*.ts      Checked optional Engine protocol and global adapter
  core/types/                 Shared HA / action / Engine / utils types
  shared/                     Checked color, geometry, config and editor helpers
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

nodalia-utils.js              Generated checked shared runtime helpers (window.NodaliaUtils)
nodalia-backend.js            Generated optional Nodalia Engine client
nodalia-render-signature.js   Render-signature helpers
nodalia-bubble-contrast.js    Icon contrast helpers
nodalia-i18n.js               Generated checked runtime lookup and lazy locale data
nodalia-editor-ui.js          Generated checked editor lookup with lazy JSON catalogs
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
Bubble contrast now has checked source and a generated adapter as well. Generic utils now have checked source in `src/shared/utils-runtime.ts` with a
generated compatibility adapter. Runtime and editor lookup have checked source
in `src/shared/runtime-i18n-runtime.ts` and `src/shared/editor-i18n-runtime.ts`.
Their locale/row/catalog data are generated from JSON into the corresponding
`*-i18n-data.ts` modules. Published root files are generated compatibility artifacts.

## Large controller responsibilities

Size snapshots from the initial source split are obsolete. All card views,
configs, helpers and visual editors now pass strict checking. Climate retains
a large view/controller, with config, model, dial and schedule modules separated.
Static CSS is embedded from readable files; dynamic styles remain in the view.

`scripts/type-debt.json` is empty. Go2rtc playback now has checked source in
`src/shared/go2rtc-player.ts`; Camera imports it directly and the standalone
ES-module player is generated from the same source. All shipped runtime lookup
logic now has checked TypeScript source; the empty suppression inventory and
canonical runtime entry list are both enforced. The release workflow validates
the exact tagged commit before publication.

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
| `nodalia-go2rtc-player.js` | Generated ES module from checked native playback runtime |
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
| `nodalia-i18n.js` / `nodalia-editor-ui.js` | Compiled checked lookup with generated `i18n/` JSON data |

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

## Source ownership in version 3

The migration is complete: all 25 card views, configuration modules, helpers,
visual editors and shared runtime entries are checked. Source organization follows
actual responsibilities rather than a prescribed extra directory hierarchy.

- `src/core/` owns shared HA/action types and the optional Engine protocol.
- `src/shared/` owns reusable runtime/editor/config/color/geometry helpers.
- `src/cards/<name>/` owns each card, editor, normalization and domain models.
- Static component CSS is colocated and embedded by the build's whitespace-only
  styles plugin, without an additional Home Assistant resource request.
- Generated root JS retains existing standalone/global APIs.

## Build pipeline

1. `pnpm run typecheck` — `tsc --noEmit` with strict TypeScript.
2. `pnpm run lint` — ESLint on `src/**/*.ts`.
3. `scripts/build-src-cards.mjs` — esbuild TypeScript cards to root JS.
4. `scripts/build-bundle.mjs` — esbuild HACS bundle from canonical card/runtime
   TypeScript entries. Generated root JS preserves standalone compatibility.

`pnpm validate:fast` checks versions, tracked architecture debt, strict types, lint,
distribution syntax, translations, build and unit tests. `pnpm validate` adds the
full Playwright suite. CI also rejects generated artifact drift and validates
Chromium, Firefox, WebKit and iPhone WebKit before release publication.

## Card architecture (Climate)

```text
climate-types.ts       Config, schedule and public API types
climate-constants.ts   Tags, versions, dial/schedule numeric constants
climate-runtime.ts     Explicit window.NodaliaUtils adapters
climate-config.ts      Config normalization and migrations
climate-defaults.ts    Checked defaults without config/helper import cycles
climate-model.ts       Temperature/HVAC/display helpers
climate-dial.ts        Dial geometry and pointer conversion
climate-schedule.ts    Schedule parse/storage/timeline/serialization
climate-card.ts        Web component lifecycle and render
climate-editor.ts      Visual editor
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

No legacy suppressions remain in card source. All card views, configs, helpers and editors are checked. The
exact current inventory is
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

Put shared protocol functionality in `src/core/` and reusable domain/DOM helpers
in `src/shared/`. Generated `nodalia-utils.js` is a compatibility artifact.
Do not centralize look-alike code with different semantics.

## Continuing maintenance

The strict migration is complete. Keep typed lint and the debt inventory enforced.
Split large controllers further only when a distinct responsibility benefits from
its own module. Prefer behavioral regressions to source-format assertions and
reuse direct shared imports while retaining public standalone/global APIs.

## Lifecycle and presentation contracts

Room Summary parking deliberately disconnects embedded cards; their disconnect
callbacks release streams, timers and listeners. Configuration, HA connection or
user changes retire connected and parked children. Ordinary updates preserve child
identity and propagate the current HA context. Lock entities use native Lock Card;
media players remain on the main Summary screen.

Camera body portals own listeners on their shadow roots and remove them from that
same root. Pending stream/image/prefetch work is generation-owned. Notifications
forecast/calendar/Engine work likewise rejects results from retired contexts;
empty native forecasts remain authoritative and failure retries are bounded.

Media Player and Navigation share artwork sampling, bounded caches and transport
styles. Equal side columns keep the transport capsule centered independently of
auxiliary controls. Cached colors apply synchronously. New covers and tint commit
together; first unseen covers still require network transfer and decoding. Media
entrance moves cover and controls together without fading a controls-only ancestor,
preserving backdrop reflection throughout the animation.

Climate and Advance Vacuum command queues, persistence, schedule/map gestures and
animation fallbacks belong to their originating configuration and HA context.
Pointer cancellation restores drafts without issuing commands. Keyboard focus and
unfinished native composer fields survive ordinary updates.

Shared editor color conversion retains alpha and distinguishes byte RGB from CSS
Color 4 sRGB channels; wider-gamut conversion uses the browser. Theme values are
resolved on use and fixed-color probes have a bounded cache. Vacuum status chips
use constrained text spans with ellipsis and full title text; reported states and
error sensors share localized `charger_disconnected` labels.

See [current audit](TECHNICAL_AUDIT.md), [testing](testing.md),
[performance](performance-audit.md) and [releasing](releasing.md).
