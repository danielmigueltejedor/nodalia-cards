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

### Old code after switching preview channels in HACS

The published `v3.0.0-beta.1` bundle contains the beta changes. If installing it
still shows alpha behavior, check the loaded resource before assuming that HACS
downloaded the wrong release.

HACS's [resource URL generator](https://github.com/hacs/integration/blob/adb7d83e33d24325535fb43b8226572405143757/custom_components/hacs/repositories/plugin.py#L137-L159)
removes non-digits from the version in its `hacstag` cache token. Therefore
`v3.0.0-alpha.1` and `v3.0.0-beta.1` both contribute `3001`, and the browser can
reuse the alpha resource. The same collision applies to alpha/beta/rc builds
with matching numbers. This describes the linked HACS implementation; confirm
the resource URL and loaded file when diagnosing an individual installation.

After installing the selected preview:

1. Open Home Assistant's dashboard Resources settings (enable Advanced Mode in
   your profile if needed).
2. Edit the **existing** Nodalia Cards JavaScript module resource. Keep its
   `hacstag` query and append `&v=3.0.0-beta.1`. If the URL has no query, append
   `?v=3.0.0-beta.1` instead. Use the full installed version for future builds.
3. Reload Home Assistant completely on each affected client. Do not add a second
   resource for the same bundle.

This gives the browser a distinct resource URL; it does not change the installed
file. HACS may replace this URL on later updates. If the loaded version is still
wrong, verify the installed `www/community/nodalia-cards/nodalia-cards.js` against
the corresponding tagged bundle/release asset before attributing the problem to
caching. See [release verification](releasing.md#hacs-preview-channel-verification).

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
not by itself mark a prerelease build as stable. Stable changes are prepared in
[CHANGELOG.md](../CHANGELOG.md); preview history remains in
[CHANGELOG-PRERELEASES.md](../CHANGELOG-PRERELEASES.md).

## Beta stabilization

The prepared `3.0.0-beta.1` freezes features, architecture, YAML and public APIs.
Only corrections, measured performance improvements, accessibility, compatibility,
lifecycle/memory fixes, documentation and tests are in scope until stable 3.0.0.
See [the release-readiness audit](BETA_READINESS_AUDIT.md) and [releasing](releasing.md).
Preparation does not publish a tag or change which preview HACS can download.
