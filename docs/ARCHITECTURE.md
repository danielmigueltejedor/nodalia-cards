# Nodalia Cards architecture

This document describes the TypeScript migration that starts in `2.3.0-alpha.3b`.
The public Lovelace/HACS contract is unchanged: custom element tags, YAML keys,
defaults, editors, translations, and the single-file `nodalia-cards.js` install
path stay the same.

## Current architecture map (2.3.0-alpha.37)

The project is a Home Assistant Lovelace plugin. Handwritten cards historically
lived as root `nodalia-*.js` files that were both source and published artifacts.
Climate, Media Player, Light, Fan, Humidifier, Cover, Alarm Panel, Vacuum, Entity, Fav, Person, Camera, Circular Gauge, Insignia, Scenes, News, Weather, Graph, Calendar, Power Flow, Notifications, Navigation, Room Summary and Advance Vacuum canonical source now lives under
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
nodalia-backend.js            Optional Nodalia Engine client
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
artifacts. Support files such as `nodalia-utils.js` and the camera/notifications
models remain handwritten until their own migration.

## Largest source files

Approximate sizes on this preview (handwritten unless noted):

| File | Size | Responsibilities |
|---|---|---|
| `nodalia-advance-vacuum-card.js` | generated | Compiled Advance Vacuum artifact |
| `src/cards/advance-vacuum/advance-vacuum-card.ts` | ~7520 lines | Map, rooms, dock, sessions |
| `nodalia-climate-card.js` | generated ~338 KB | Compiled Climate artifact |
| `src/cards/climate/climate-card.ts` | ~6470 lines | Climate HTMLElement / render / interactions |
| `nodalia-entity-card.js` | generated | Compiled Entity artifact |
| `src/cards/entity/entity-card.ts` | ~4260 lines | Generic entity, domains, air quality, editor |
| `src/cards/fav/fav-card.ts` | ~1670 lines | Favorite mini control, alarm host, editor |
| `src/cards/person/person-card.ts` | ~1230 lines | Person photo, zone, actions |
| `nodalia-notifications-card.js` | ~258 KB | Inbox, mobile policy, Engine sync, editor |
| `nodalia-power-flow-card.js` | ~231 KB | Energy graph, nodes, chips, editor |
| `nodalia-media-player.js` | generated | Compiled Media Player artifact |
| `src/cards/media-player/media-player-card.ts` | ~4900 lines | Media Player HTMLElement / artwork / layouts |
| `nodalia-calendar-card.js` | ~207 KB | Events, weather, composers, webhooks |
| `src/cards/climate/climate-editor.ts` | ~2037 lines | Climate visual editor (incl. unused legacy class) |
| `nodalia-humidifier-card.js` | generated | Compiled Humidifier artifact |
| `src/cards/humidifier/humidifier-card.ts` | ~3870 lines | Humidifier HTMLElement / humidity / modes |
| `nodalia-fan-card.js` | generated | Compiled Fan artifact |
| `src/cards/fan/fan-card.ts` | ~3640 lines | Fan HTMLElement / speed / oscillation |
| `nodalia-cover-card.js` | generated | Compiled Cover artifact |
| `src/cards/cover/cover-card.ts` | ~1930 lines | Cover HTMLElement / position / tilt |
| `nodalia-vacuum-card.js` | generated | Compiled Vacuum artifact |
| `src/cards/vacuum/vacuum-card.ts` | ~3100 lines | Vacuum HTMLElement / presets / battery |
| `nodalia-alarm-panel-card.js` | generated | Compiled Alarm Panel artifact |
| `src/cards/alarm-panel/alarm-panel-card.ts` | ~1510 lines | Alarm HTMLElement / arm / code |
| `nodalia-light-card.js` | generated | Compiled Light artifact |
| `src/cards/light/light-card.ts` | ~3970 lines | Light HTMLElement / brightness / color |
| `nodalia-navigation-bar.js` | ~196 KB | Routes, media overlay, popups |

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
| `nodalia-climate-card.js` | Generated from `src/cards/climate/standalone.ts` (unminified IIFE) |
| `nodalia-media-player.js` | Generated from `src/cards/media-player/standalone.ts` (unminified IIFE) |
| `nodalia-light-card.js` | Generated from `src/cards/light/standalone.ts` (unminified IIFE) |
| `nodalia-fan-card.js` | Generated from `src/cards/fan/standalone.ts` (unminified IIFE) |
| `nodalia-humidifier-card.js` | Generated from `src/cards/humidifier/standalone.ts` (unminified IIFE) |
| `nodalia-cover-card.js` | Generated from `src/cards/cover/standalone.ts` (unminified IIFE) |
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

Do not edit generated Climate, Media Player, Light, Fan, Humidifier, Cover, Alarm Panel, Vacuum, Entity, Fav, Person, Camera, Circular Gauge, Insignia, Scenes, News, Weather, Graph, Calendar, Power Flow, Notifications, Navigation, Room Summary, or Advance Vacuum JS by hand. Change
`src/cards/climate`, `src/cards/media-player`, `src/cards/light`, `src/cards/fan`,
`src/cards/humidifier`, `src/cards/cover`, `src/cards/alarm-panel`, `src/cards/vacuum`, `src/cards/entity`, `src/cards/fav`, `src/cards/person`, `src/cards/camera`, `src/cards/circular-gauge`, `src/cards/insignia`, `src/cards/scenes`, `src/cards/news`, `src/cards/weather`, `src/cards/graph`, `src/cards/calendar`, `src/cards/power-flow`, `src/cards/notifications`, `src/cards/navigation`, `src/cards/room-summary`, or `src/cards/advance-vacuum` and run `pnpm run bundle`. The HACS bundle compiles those cards from `index.ts` so the
unused legacy editor class is tree-shaken there (same as `2.3.0-alpha.3`).
The standalone Climate artifact keeps that class because source-contract tests still
assert both editor implementations.

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
4. **Remaining large cards** — complete.
5. **Smaller cards** — complete.
6. **Cleanup** — drop obsolete internals, reduce globals, type remaining
   `@ts-nocheck` files, replace regex tests with behavioral tests where safe.

## Build pipeline

1. `pnpm run typecheck` — `tsc --noEmit` with strict TypeScript.
2. `pnpm run lint` — ESLint on `src/**/*.ts`.
3. `scripts/build-src-cards.mjs` — esbuild TypeScript cards to root JS.
4. `scripts/build-bundle.mjs` — esbuild HACS bundle from published JS parts,
   compiling migrated cards from `src/cards/*/index.ts`.

`pnpm run validate` runs typecheck, lint, i18n checks, the bundle, and unit tests.

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
standalone.ts          Standalone entry; keeps unused legacy editor class
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

Relaxed checking is currently limited to:

- `climate-card.ts` and `climate-editor.ts` (`// @ts-nocheck`) because they are
  still the large HTMLElement/view controllers.
- `climate-model.ts` and `climate-schedule.ts` (`// @ts-nocheck` with a
  description) until remaining `unknown` internals are narrowed. Public
  exports already have signatures.
- `light-card.ts` and `light-editor.ts` (`// @ts-nocheck`) for the same reason.
- `light-config.ts` and `light-helpers.ts` (`// @ts-nocheck` with a description)
  until remaining `unknown` internals are narrowed.
- Fan, Humidifier, Cover, Alarm Panel, Vacuum and Entity card/editor/helpers follow the same `@ts-nocheck`
  split while their HTMLElement controllers stay large.

Do not introduce `any` in new modules. Prefer `unknown` plus narrowing.
Home Assistant types in `src/core/types` only include fields Nodalia actually
reads.

## Adding a new card

1. Create `src/cards/<name>/` following the Climate split.
2. Register the custom element in that card's `index.ts`.
3. Add the generated `nodalia-<name>.js` outfile to `scripts/build-src-cards.mjs`
   and `scripts/build-bundle.mjs` `CARD_PARTS`.
4. Keep the tag, editor tag, YAML keys and defaults identical to any previous JS
   card you are replacing.

Until a card is migrated, add it as a root `nodalia-*.js` file as today.

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
