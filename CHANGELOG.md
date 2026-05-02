# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0-beta.9] - 2026-05-02

### Changed

- **Advance vacuum** (`nodalia-advance-vacuum-card.js`): vacuum mode humanization always goes through `translateAdvanceVacuumVacuumMode` when `nodalia-i18n` is loaded, using `resolveHass(null)` when the card has no `hass` yet so labels no longer fall back to Spanish on first paint.
- **`nodalia-i18n.js`**: `strings()` merges `advanceVacuum` from the fallback pack when a locale omits it.
- **Alarm actions** (all locales): `alarmPanel.actions` uses compact labels (e.g. Home, Away, Night) instead of long “Arm …” wording; **favourite card** alarm mode buttons use these via `_getAlarmActionLabel`.
- **Favourite card** (`nodalia-fav-card.js`): entity name stays visible when the alarm panel is expanded; tight-inline layout adjusted when the alarm panel is open.
- **Climate editor i18n** (`scripts/gen-editor-ui.mjs`): added `FULL_LOCALE_BY_EN` overrides and extra `NAV_EXACT` keys so visibility, chips, haptics, style/animation hints and background colour labels translate to **de / fr / it / nl** (not only English).
- Regenerated artifacts: `nodalia-editor-ui.js` and bundled `nodalia-cards.js`.

## [0.2.0-beta.8] - 2026-05-02

### Changed

- **Advance vacuum runtime** (`nodalia-advance-vacuum-card.js`) now resolves additional UI copy through `window.NodaliaI18n` namespaces (`modeLabels`, `panelModes`, `dockControls`, `dockSettings`, `dockSections`, `actions`, `handles`, `utility`) so control labels, tooltips and action titles no longer stay fixed in Spanish.
- **Advance vacuum editor** fallback entity picker placeholder now uses `_editorLabel("Selecciona una entidad")` for localized fallback selects.
- Performed a cross-editor i18n sweep in **alarm, light, fan, vacuum, humidifier, power-flow, person, climate and entity editors** to route remaining hardcoded show/hide section toggles and fallback entity-picker placeholders through `_editorLabel`.
- Regenerated artifact: bundled `nodalia-cards.js`.

## [0.2.0-beta.7] - 2026-05-02

### Changed

- **Weather editor** (`nodalia-weather-card.js`) now routes remaining hardcoded editor strings through `_editorLabel` for fallback entity picker and animation/style section toggles (`Mostrar/Ocultar ajustes...`), avoiding Spanish-only UI in non-ES locales.
- **Graph editor** (`nodalia-graph-card.js`) now translates the style section toggle label through `_editorLabel` to keep show/hide copy localized.
- **Circular gauge editor** (`nodalia-circular-gauge-card.js`) now localizes fallback entity-picker placeholder and animation/style show/hide toggle copy via `_editorLabel`.
- **Fav editor** (`nodalia-fav-card.js`) now localizes style section show/hide toggle copy via `_editorLabel`.
- Regenerated artifact: bundled `nodalia-cards.js`.

## [0.2.0-beta.6] - 2026-05-02

### Changed

- **Navigation bar editor** (`nodalia-navigation-bar.js`) now routes remaining hardcoded labels through `_L` (move/remove actions, popup placeholders, haptic/layout select labels, style labels, and helper hints), including popup/layout option captions.
- **Graph editor** (`nodalia-graph-card.js`) now translates remaining hardcoded series editor copy (series title, action buttons, data subgroup title, empty-series note, add-series CTA, selection/action labels, and animation toggle text).
- **Alarm / Fav / Fan / Light** runtimes now resolve additional fallback state labels and default names through `window.NodaliaI18n` namespaces instead of fixed Spanish copy.
- **Alarm panel runtime** now uses dedicated localized **action labels** (`disarm`, `arm_home`, `arm_away`, `arm_night`, `arm_vacation`, `arm_custom_bypass`) so mode buttons no longer mirror state adjectives in non-Spanish locales.
- Editor UI generator (`scripts/gen-editor-ui.mjs`) extends explicit mappings (`NAV_EXACT`) so newly added Spanish keys emit stable English seeds before de/fr/it/nl shims.
- Regenerated artifacts: `nodalia-editor-ui.js` and bundled `nodalia-cards.js`.

## [0.2.0-beta.5] - 2026-05-02

### Added

- Full **de / fr / it / nl** runtime packs for `weatherCard`, `humidifierCard`, and `graphCard` in `nodalia-i18n.js` (conditions, forecast UI copy, humidifier modes, graph empty-history text), reducing fallback-to-English cases.
- New editor-source keys for media-player visual editor strings (power-button actions by state, action labels, add-player controls, animation/style toggles, progress/browser style labels, and related copy), wired into `scripts/editor-source-strings.json`.

### Changed

- **Vacuum** runtime (`nodalia-vacuum-card.js`) now resolves mode/state labels through `window.NodaliaI18n` with `hass` + card `language` (`humanizeModeLabel`, mode panel options, mode visibility labels, and state-chip mapping).
- **Weather** condition translation helper now resolves `hass` with `resolveHass` fallback even when `hass` is not explicitly passed.
- **Media player editor** (`nodalia-media-player.js`) routes additional hardcoded UI text through `_editorLabel` (e.g. `Comportamiento`, add-player button, empty-state note, show/hide animation & style settings toggles).

## [0.2.0-beta.4] - 2026-05-02

### Added

- Extra **`weatherCard.forecast`** keys used by the weather card UI: insufficient chart data, forecast popup close control, and popup metric headers (high/low/temperature/rain/humidity/wind).

### Changed

- **Weather** runtime (`nodalia-weather-card.js`): forecast tabs (Cards/Chart, Hours/Week), tablist `aria-label`, empty forecast copy, chart `aria-label`, insufficient-data message, forecast popup close label, popup row headers, and conditions continue to resolve through `translateWeatherForecastUi` / `translateCondition` with `hass` and card `language`.
- **Humidifier** runtime and editor (`nodalia-humidifier-card.js`): humidifier and fan mode labels use **`translateHumidifierMode`** (via `translateModeLabel`) with resolved `hass` and `language` on chips, panels, and editor mode-visibility toggles.
- **Graph** runtime (`nodalia-graph-card.js`): empty chart strip uses **`translateGraphEmptyHistory`**.

## [0.2.0-beta.3] - 2026-05-01

### Added

- Shared internationalization module (`nodalia-i18n.js`): language packs for **es**, **en**, **de**, **fr**, **it**, and **nl**; `resolveLanguage` from card `language` (`auto` or fixed code), Home Assistant locale, `navigator.language`, with **es** as fallback; `resolveHass` fallback via `document.querySelector("home-assistant")?.hass` when the editor has no `hass` yet.
- Runtime string namespaces and helpers on `window.NodaliaI18n`, including **`weatherCard`** (conditions and base forecast strings), **`humidifierCard.modes`**, **`graphCard.emptyHistory`**, and advance-vacuum helpers (`translateAdvanceVacuumReportedState`, `translateAdvanceVacuumVacuumMode`, etc.). Locales without a full pack merge **weather / humidifier / graph** from **en** so lookups stay valid.
- Lovelace editor string maps (`nodalia-editor-ui.js`), generated from `scripts/editor-source-strings.json` and `scripts/gen-editor-ui.mjs`, exposed as `window.NodaliaI18n.editorStr(hass, configLang, spanishText)`.
- Single-file bundle (`nodalia-cards.js`) via `npm run bundle` (`scripts/build-bundle.mjs`).
- Supporting scripts under `scripts/` for editor i18n maintenance (patch/wrap helpers, etc.).

### Changed

- Card editors resolve labels, section titles, hints, and select options through `_editorLabel` → `editorStr` (e.g. advance vacuum, alarm panel; broader coverage across entity, climate, graph, navigation bar, fan, favourite, person, weather, and related cards on this branch).
- **Advance vacuum** runtime: reported state chip, suction/mop/mop-mode labels, mode panel utilities (cleaning mode/counter/zones/point/dock actions), dock setting `<select>` options, map dock status titles, routine default label, and mode humanization respect `language` and HA locale when `nodalia-i18n` is loaded.
- Other integrated cards (entity, alarm, person, favourite, fan, simple vacuum, navigation bar, etc.) use `window.NodaliaI18n` for runtime strings where wired on this branch.
- `package.json` includes the `bundle` script; README and CONTRIBUTING updated as on the branch.

### Fixed

- Editor UI generator (`gen-editor-ui.mjs`): safer regex ordering (longer phrases before shorter ones), word-boundary rules where needed (`Borde`, `Radio`, `Icono`), correct stripping length for `__H__:` / `__T__:` prefixes, hints no longer passed through Spanish `reps` twice, `ROWS` deduplicated by Spanish key for stable `buildMap`, and `Show` / `Enable` / `Open` locale shims only on compact English labels so long hint sentences are not mangled in de/fr/it/nl.

### Removed

- Large binary GIF assets from the repository where applicable (smaller clone).

### Notes

- Prefer loading `nodalia-cards.js` (or the HACS `filename`) so i18n and editor maps register before opening card editors.
- Optional card option: `language: auto` or `es` / `en` / … to override runtime and editor language.
- Some long editor hints may remain in **English** for **de / fr / it / nl** until explicit translations are added in the generator or a dedicated hint table.

## [0.2.0-beta.2]

Prior beta; see git tag and release notes for that version.
