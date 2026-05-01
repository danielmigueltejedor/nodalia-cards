# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
