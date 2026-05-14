# Translating Nodalia Cards

Nodalia Cards is actively improving localization during the `1.1.0` line. Translation pull requests are welcome, including small wording fixes, missing editor labels, and complete new languages.

This guide explains the current translation system without requiring deep source-code knowledge.

## 1. Where translations live

Nodalia currently has two translation surfaces:

- Runtime card text lives in `nodalia-i18n.js`.
- Visual editor text lives in `i18n/editor/<lang>.json`.

Runtime text is the text shown by cards while they are running: states, actions, weather labels, notification text, vacuum modes, and similar UI labels.

Editor text is the text shown inside Home Assistant's visual card editors: field labels, hints, option names, and section titles.

## 2. Language codes

Use short language codes:

```text
en, es, de, fr, it, nl, no, pt, ru, el, zh, ro
```

Norwegian is stored as `no` in Nodalia and resolved to `nb-NO` for browser/date formatting.

New languages should use the usual Home Assistant/browser language prefix, for example:

```text
ja
pl
sv
```

## 3. Runtime translation keys

Runtime keys are grouped by card or shared feature inside `nodalia-i18n.js`.

Good examples:

```js
weatherCard.forecast.emptyHourly
alarmPanel.actions.arm_home
advanceVacuum.modeLabels.rooms
notificationsCard.aria.dismiss
```

Keep keys stable and descriptive. Prefer adding a clear key to an existing namespace instead of hardcoding a string in a card.

## 4. Visual editor translation keys

Editor keys are flat and begin with `ed.`:

```text
ed.entity.name
ed.weather.forecast_daily
ed.power_flow.node_grid_title
ed.climate.mode_buttons
```

The canonical file is:

```text
i18n/editor/en.json
```

Every other `i18n/editor/<lang>.json` file must contain the same keys as `en.json`.

## 5. Editing an existing language

1. Find the language file in `i18n/editor/`.
2. Edit only the values, not the keys.
3. Keep UI labels short.
4. Preserve placeholders such as `{name}`, `{value}`, `{source}`, `{state}`.
5. Run the validation step:

```bash
npm run i18n:validate-editor
```

6. Regenerate the embedded editor catalog:

```bash
npm run i18n:gen-editor
```

7. Build the bundle before testing a packaged install:

```bash
npm run bundle
```

## 6. Adding a new editor language

Example: adding Japanese (`ja`).

1. Copy the English editor catalog:

```bash
cp i18n/editor/en.json i18n/editor/ja.json
```

2. Translate the values in `i18n/editor/ja.json`.
3. Add `ja` to `EDITOR_CATALOG_LANGS` in `scripts/gen-editor-ui.mjs`.
4. Add `ja` support to `nodalia-i18n.js`:

- `localeTag()`
- the runtime `PACK` object
- any language alias handling if needed

5. Run:

```bash
npm run i18n:validate-editor
npm run i18n:gen-editor
npm run bundle
npm test
```

## 7. Adding runtime translations

Runtime translations live in `nodalia-i18n.js`. English should always be complete because other languages fall back to English when a string is missing.

When adding a runtime string:

1. Add the English value first.
2. Add translations in the relevant language packs when possible.
3. Keep the same object shape across languages.
4. Use helper functions already exposed by `window.NodaliaI18n` where available.

Good:

```js
window.NodaliaI18n.translateWeatherForecastUi(hass, configLang, "emptyHourly")
```

Avoid:

```js
const label = "Sin prevision por horas";
```

Hardcoded strings make localization harder and can cause mixed-language dashboards.

## 8. Testing in Home Assistant

1. Build the bundle:

```bash
npm run bundle
```

2. Install or copy the generated card file used by your resource.
3. Clear browser cache or update the resource URL if needed.
4. Reload Home Assistant.
5. Open a dashboard that uses the card.
6. Open the card visual editor and check field labels.
7. Trigger runtime states where possible, such as unavailable, active, empty, warning, or error states.

## 9. Switching Home Assistant language

In Home Assistant:

1. Open your user profile.
2. Find the language setting.
3. Pick the language you are testing.
4. Save.
5. Refresh the browser tab.

Nodalia's `language: auto` follows the Home Assistant profile language. You can also force a card language in YAML when a card exposes `language`.

## 10. Common mistakes

- Changing keys instead of values.
- Removing placeholders like `{name}` or `{value}`.
- Translating technical entity IDs, service names, or YAML field names.
- Making editor labels too long for mobile.
- Adding a new editor language file but not adding it to `EDITOR_CATALOG_LANGS`.
- Editing `nodalia-editor-ui.js` directly. It is generated.
- Hardcoding user-facing strings inside a card instead of using `nodalia-i18n.js` or `ed.*` keys.

## 11. Pull request checklist

Before opening a translation PR:

```bash
npm run i18n:validate-editor
npm run i18n:gen-editor
npm run bundle
npm test
```

Then include in the PR description:

- Language updated or added.
- Whether runtime strings, editor strings, or both were changed.
- Any strings you intentionally left in English.
- A screenshot if you tested inside Home Assistant.

Small translation PRs are very welcome. A focused wording fix is easier to review than a huge mixed change.
