# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0-beta.1] - 2026-05-03

### Changed

- Opens the **0.3.x** prerelease line on branch **`beta`**: continued **translation** polish, Lovelace editor refinements, and **card UX** work (graph, energy flow, navigation bar, etc.). **`main`** remains the **0.2.x** stable line (**v0.2.0** ships multilingual UI at ~80% coverage).

## [0.2.0] - 2026-05-03

### Summary

First **stable** line with **multilingual UI** for the bundle and **Lovelace visual editors** at approximately **~80%** coverage across **es, en, de, fr, it, nl** (runtime + `nodalia-i18n.js`, editor maps in `nodalia-editor-ui.js`, `language: auto` on supported cards). Remaining glitches: use the **Translation correction** issue template; refinements ship in **0.3.0** prereleases.

The sections **`[0.2.0-beta.16]` … `[0.2.0-beta.2]`** below are the per-beta notes that built up to this release.

## [0.2.0-beta.16] - 2026-05-03

### Fixed

- **Lovelace editor i18n** (`scripts/gen-editor-ui.mjs`): `Entidad` → `Entity` is applied **after** compound phrases (e.g. **Tamaño burbuja entidad**), fixing broken English seeds like “Size burbuja Entity” and improving downstream **de / fr / it / nl** editor labels.
- **Advance vacuum** (`nodalia-advance-vacuum-card.js`): `window.NodaliaI18n?.resolveLanguage?.(…)` everywhere it is used in templates/signature; **`nodalia-i18n-ready`** event + short locale reconciliation so the card re-renders when i18n or profile language becomes available (avoids stuck fallbacks).
- **Visual editors (layout)**: `ha-entity-picker` / `ha-selector` hosts in **`.editor-field`** use **full grid width** (no two entity pickers on one row), so long entity names are readable.

### Changed

- **Editor strings**: `scripts/editor-source-strings.json` and `scripts/spanish-nav-exact.mjs` extended for icon/bubble/colour labels; **`FULL_LOCALE_BY_EN`** in `gen-editor-ui.mjs` adds fuller **de / fr / it / nl** for style/animation/hint phrasing; **`nodalia-i18n.js`** dispatches **`nodalia-i18n-ready`** when the pack is registered.
- **Community**: **Translation correction** issue template (`.github/ISSUE_TEMPLATE/translation.yml`); **CONTRIBUTING** links to it for wrong-locale copy.
- Regenerated **`nodalia-editor-ui.js`** and bundled **`nodalia-cards.js`**.

## [0.2.0-beta.14] - 2026-05-02

### Fixed

- **Lovelace editor i18n** (`scripts/gen-editor-ui.mjs`): hints (`__H__:…`) now resolve through the same **Spanish → English** exact map as other editor strings, so long hints (e.g. navigation bar transitions) are no longer left in Spanish in the `en` column and never reached French.
- **Editor UI**: `Mostrar tarjeta` and **`Layout estrecho`** are registered and mapped to English seeds; **double period** on one “Transiciones suaves…” hint line removed.
- **French (and de / it / nl) editor copy**: `scripts/editor-extra-locale-by-en.json` (maintained via `scripts/generate-extra-locale-by-en.mjs`) merges **full translations** for long hints (media player, weather, navigation bar, graphs, etc.), **“Show …”** compound labels, section word **Haptics**, **Show card** / **Narrow layout**, so profiles like **fr** no longer show English sentences or hybrids such as “Afficher textual state” or “General player options…”.

### Changed

- **`scripts/spanish-nav-exact.mjs`**: shared Spanish→English map for generator hints + main pipeline.
- Regenerated **`nodalia-editor-ui.js`** and bundled **`nodalia-cards.js`**.

## [0.2.0-beta.13] - 2026-05-02

### Added

- **Advance vacuum editor**: selector **Idioma de la tarjeta** (`auto`, `es`, `en`, `de`, `fr`, `it`, `nl`) so you can match Home Assistant or force a locale; existing dashboards that still stored the old default **`language: es`** can switch to **Automático** to follow the UI language (e.g. français).

### Changed

- **Advance vacuum runtime** (`nodalia-advance-vacuum-card.js`): buttons, chips, map tools, markers, zone handles, routine tiles and map chrome use **theme-aware** fills and borders (`color-mix` with `--primary-text-color`) and clearer inset shadows, aligned with cards like the humidifier — readable borders on **light** themes; active states keep accent tints.
- **Animations**: slightly softer entrance motion and bounce timing on utility panel / footer / primary bounce keyframes.
- **`scripts/editor-source-strings.json`** + regenerated **`nodalia-editor-ui.js`** for new editor strings.
- Regenerated artifact: bundled **`nodalia-cards.js`**.

## [0.2.0-beta.12] - 2026-05-02

### Fixed

- **`nodalia-i18n.js`**: `effectiveHaLanguageCode` now reads **`home-assistant` root `hass` first**, then the Lovelace card `hass`, so the profile language wins over incomplete card snapshots.
- **`resolveLanguage`**: when the Home Assistant shell is present (`<home-assistant>`), **`navigator.language` is no longer used** as a fallback — it often disagreed with the HA profile (e.g. French browser + Spanish UI), causing mixed Meteoalarm UI (French row labels / dates like “mai” vs Spanish alert copy) and wrong packs for advance vacuum.
- **Weather** (`nodalia-weather-card.js`): default config includes **`language: "auto"`** explicitly.
- Regenerated artifact: bundled `nodalia-cards.js`.

## [0.2.0-beta.11] - 2026-05-02

### Fixed

- **`nodalia-i18n.js`**: `resolveLanguage` now reads UI language via `effectiveHaLanguageCode`, which prefers `hass.language` / `selectedLanguage` / `locale.language` and falls back to `<home-assistant>.hass` when Lovelace passes a hass object that has entity state but not yet i18n fields — fixes Meteoalarm chip/popup and advance vacuum (and other cards using `language: auto`) staying on Spanish copy despite an English or other profile.
- Exposed `effectiveHaLanguageCode` on `window.NodaliaI18n`.
- Regenerated artifact: bundled `nodalia-cards.js`.

## [0.2.0-beta.10] - 2026-05-02

### Changed

- **Weather** (`nodalia-weather-card.js`): Meteoalarm chip and popup use `translateMeteoalarmTerm` with localized row labels and enum-style values (Spanish/French/English API strings mapped to the active locale); popup dates use `localeTag(resolveLanguage(...))`; description/instructions headings use `weatherCard.meteoalarm.descriptionTitle` / `instructionsTitle`.
- **`nodalia-i18n.js`**: `translateMeteoalarmTerm` with `meteoalarmApiKey` and cross-language aliases for Meteoalarm/CAP values.
- **Advance vacuum** (`nodalia-advance-vacuum-card.js`): default `language` is `auto` so the card follows Home Assistant unless overridden.
- Regenerated artifact: bundled `nodalia-cards.js`.

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
