# Upgrading to Nodalia Cards 3.0.0

Version 3 completes strict TypeScript migration for all 25 cards, visual editors
and shared runtimes. The migration changes development and verification while
preserving existing dashboard configuration.

## Existing installations

- Keep the Dashboard plugin and `/hacsfiles/nodalia-cards/nodalia-cards.js` resource.
- Keep existing `custom:nodalia-*` names, card YAML, actions and legacy aliases.
- Existing manual standalone resource filenames remain available.
- Nodalia Cards Engine remains an optional separate Integration; no Dashboard to
  Integration migration is required.

The currently published version 3 builds are prereleases. Until stable `v3.0.0`
is published, choose a preview deliberately in HACS; the default stable channel
continues to use its published stable release. After an update, reload the
frontend cache if the installed bundle version still reports the previous build.

Check Media controls during dashboard entrance and track changes, Lock gestures
and editor styles, Summary embedded locks, Vacuum status text and weather
notification templates. Report any integration-specific problem with YAML,
Home Assistant version, browser and reproduction steps.

Version 3 includes native Lock embedding in Summary and keeps Summary media on
its main screen. Alarm Panel and Entity request at least four Sections columns;
Weather and Calendar request six. Explicit dashboard grid configuration remains
under the user's control.

## Contributors and maintainers

Edit TypeScript under `src/`; root JS is generated. Edit locale JSON under
`i18n/`; generated checked data and lookup artifacts must be rebuilt together.
All source is covered by strict types and typed lint. The old one-shot migration
extractors, duplicate editor catalog shards and translation caches are retired.

Run `pnpm validate:fast` and the four-browser validation before release. See
[contributing](../CONTRIBUTING.md), [architecture](ARCHITECTURE.md),
[translations](TRANSLATIONS.md) and [releasing](releasing.md).

Stable promotion uses the release script and exact validated tag; this guide does
not by itself mark an alpha build as stable. Stable changes are prepared in
[CHANGELOG.md](../CHANGELOG.md); preview history remains in
[CHANGELOG-PRERELEASES.md](../CHANGELOG-PRERELEASES.md).
