# Translating Nodalia Cards

Nodalia Cards is actively improving localization during the `1.1.0` line. Translation pull requests are welcome, including small wording fixes, missing editor labels, and complete new languages.

## Community translations (Crowdin)

**[Nodalia Cards on Crowdin](https://crowdin.com/project/nodalia-cards)** is the public community translation space for this repository. It complements GitHub PRs: you can suggest or vote on wording there without opening a PR. Project configuration for source and downloaded files lives in [`crowdin.yml`](../crowdin.yml) at the repo root (`i18n/editor/en.json`, `i18n/runtime/en.json`, and per-locale JSON paths).

This guide explains the current translation system without requiring deep source-code knowledge.

## 1. Where translations live

Nodalia currently has two translation surfaces:

- Runtime card text is authored in `i18n/runtime/<lang>.json` and compiled into `nodalia-i18n.js` (see below).
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

Runtime strings use nested JSON objects per language under `i18n/runtime/`. The canonical file is `i18n/runtime/en.json`. Other locales may omit keys: missing branches inherit from English when the card resolves text (`deepMergeLocale`).

After editing any `i18n/runtime/*.json` file, regenerate the embedded pack in `nodalia-i18n.js`:

```bash
pnpm run i18n:gen-runtime
pnpm run i18n:validate-runtime
```

The `nodalia-i18n.js` file contains a generated `const PACK = { ... }` block between `// <nodalia-runtime-i18n-pack>` and `// </nodalia-runtime-i18n-pack>` — do not hand-edit that block; change the JSON sources instead.

Robot vacuum **error-code labels** live under the `vacuumErrorLabels` object in each locale file (merged with English for codes only translated in some languages).

Keys are grouped by card or shared feature, for example:

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

## 5. Editing runtime (card UI) strings

1. Open `i18n/runtime/<lang>.json` (use `en.json` as the full reference tree).
2. Change only string values unless you are adding a new key that already exists in `en.json`.
3. Run:

```bash
pnpm run i18n:validate-runtime
pnpm run i18n:gen-runtime
pnpm run bundle
```

4. Commit both the JSON files and the updated `nodalia-i18n.js` generated block.

## 6. Editing an existing editor language

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

## 7. Adding a new editor language

Example: adding Japanese (`ja`).

1. Copy the English editor catalog:

```bash
cp i18n/editor/en.json i18n/editor/ja.json
```

2. Translate the values in `i18n/editor/ja.json`.
3. Add `ja` to `EDITOR_CATALOG_LANGS` in `scripts/gen-editor-ui.mjs`.
4. Add `ja` to `EDITOR_CATALOG_LANGS` in `scripts/gen-editor-ui.mjs`, add `ja` to `RUNTIME_LANGS` in `scripts/gen-runtime-i18n.mjs`, copy `i18n/runtime/en.json` to `i18n/runtime/ja.json`, then extend `nodalia-i18n.js` (outside the generated pack) only where needed: `localeTag()`, `baseLang()` / alias handling in `resolveLanguage`, and any card-specific language lists.

5. Run:

```bash
npm run i18n:validate-editor
npm run i18n:gen-editor
npm run i18n:validate-runtime
npm run i18n:gen-runtime
npm run bundle
npm test
```

## 8. Adding runtime translation keys

Add new keys to **`i18n/runtime/en.json`** first (same nested shape as sibling keys). Mirror the key path in other `i18n/runtime/<lang>.json` files when you have a translation.

Then run `pnpm run i18n:validate-runtime` and `pnpm run i18n:gen-runtime` so the `const PACK` block in `nodalia-i18n.js` is regenerated.

English should stay complete: locales with missing branches inherit from English via `deepMergeLocale`.

Use helper functions already exposed by `window.NodaliaI18n` from cards instead of hardcoding user-visible strings.

Good:

```js
window.NodaliaI18n.translateWeatherForecastUi(hass, configLang, "emptyHourly")
```

Avoid:

```js
const label = "Sin prevision por horas";
```

Hardcoded strings make localization harder and can cause mixed-language dashboards.

## 9. Testing in Home Assistant

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

## 10. Switching Home Assistant language

In Home Assistant:

1. Open your user profile.
2. Find the language setting.
3. Pick the language you are testing.
4. Save.
5. Refresh the browser tab.

Nodalia's `language: auto` follows the Home Assistant profile language. You can also force a card language in YAML when a card exposes `language`.

## 11. Common mistakes

- Changing keys instead of values.
- Removing placeholders like `{name}` or `{value}`.
- Translating technical entity IDs, service names, or YAML field names.
- Making editor labels too long for mobile.
- Adding a new editor language file but not adding it to `EDITOR_CATALOG_LANGS`.
- Editing the generated `const PACK` block or the `// <nodalia-runtime-i18n-pack>` region in `nodalia-i18n.js` by hand. Edit `i18n/runtime/*.json` and run `pnpm run i18n:gen-runtime`.
- Editing `nodalia-editor-ui.js` directly. It is generated.
- Hardcoding user-facing strings inside a card instead of using `window.NodaliaI18n` helpers or `ed.*` keys.

## 12. Pull request checklist

Before opening a translation PR:

```bash
npm run i18n:validate-editor
npm run i18n:gen-editor
npm run i18n:validate-runtime
npm run i18n:gen-runtime
npm run bundle
npm test
```

Then include in the PR description:

- Language updated or added.
- Whether runtime strings, editor strings, or both were changed.
- Any strings you intentionally left in English.
- A screenshot if you tested inside Home Assistant.

Small translation PRs are very welcome. A focused wording fix is easier to review than a huge mixed change.
