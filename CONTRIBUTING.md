# Contributing to Nodalia Cards 3

Nodalia Cards is a Home Assistant Dashboard plugin with 25 cards, shared visual
controls and visual editors. Contributions should preserve existing YAML,
custom element names, standalone resource paths and the single HACS resource.

## Version 3 beta freeze

`3.0.0-beta.1` means **feature and architecture freeze for Nodalia Cards 3**.
The strict migration is complete. The 25 cards, public custom elements, YAML,
standalone resource paths, HACS single resource and Engine API 2/3 contracts are
frozen for stabilization.

Until stable 3.0.0, accept bug fixes, measured performance fixes, accessibility,
browser compatibility, lifecycle/memory corrections, documentation and tests.
Defer new cards, substantial features, broad architectural refactors, YAML/public
API changes, major visual changes and new runtime dependencies to a later cycle.
An architectural change requires a reproducible bug and a failing regression.
The unchanged bundle caps and zero type/import-cycle debt remain enforced.

See [the final alpha audit](docs/BETA_READINESS_AUDIT.md) for acceptance evidence
and device/integration limits. A prepared beta is not a published release; the
validated tag and release determine installation availability.

## Getting started

Use Node 22 or newer and the pnpm version declared in `package.json`.

```bash
corepack enable
pnpm install --frozen-lockfile
git switch -c feature/my-change
```

Make focused changes on a branch based on `main` and open a pull request.
Describe the concrete problem, resulting behavior and relevant validation.
For bug reports, include card YAML, reproduction steps, Home Assistant version,
browser/device and a screenshot or console error when useful. Check existing
issues first. Feature requests should describe the dashboard use case.

## Canonical source and generated files

All cards and visual editors live in `src/cards/`. The checked shared runtimes
live in `src/shared/` and `src/core/`. Change those TypeScript sources and rebuild;
root `nodalia-*.js` files are generated compatibility artifacts.

`src/cards/registry.json` defines the 25 card entries. `RUNTIME_ENTRIES` in
`scripts/build-src-cards.mjs` maps shared runtime sources to their public artifacts.
`package.json.version` feeds generated `src/version.ts` and per-card declarations.
See [architecture](docs/ARCHITECTURE.md) and [adding a card](docs/adding-a-card.md).

The HACS build initializes i18n, utils, backend, render signatures and bubble
contrast before support models and cards, then appends editor UI. Preserve this
order. HACS downloads `nodalia-cards.js`; split artifacts remain available to
existing manual installations. Do not add duplicate versioned/core/suite bundles.

For local single-file standalone resources, `pnpm sync-standalone-embed` embeds
utils; do not commit those optional embed blocks.

## Implementation and design

Keep strict types and typed lint on all source modules. Use `unknown` with
narrowing for external input. The empty type/cycle debt inventories are active
regression guards; do not remove them or introduce suppressions or `any` shortcuts.

Prefer shared helpers when behavior actually matches between consumers. Keep
card-specific semantics local. Preserve service-action restrictions and deliberate
Lock unlock confirmation. Follow the existing rounded surfaces, circular controls,
translucent chips, spacing, collapsible Styles sections and native HA selectors.
See [styling](docs/STYLING.md) for theme and card-mod examples.

Avoid unnecessary full renders, repeated catalog scans and animation replays.
Track consumed state in render signatures. Timers, requests, observers and
listeners belong to their originating card/configuration/HA context and must be
retired on disconnect or context change. Preserve native focus and unfinished
editor drafts through HA updates. See [performance](docs/performance-audit.md).

## Translations

Edit `i18n/runtime/<lang>.json` or `i18n/editor/<lang>.json`, preferably through
[Nodalia Weblate](https://translate.getnodalia.com). All 12 supported locales must
retain English key structure, placeholders and code spans. Lookup falls back to
English defensively; incomplete catalogs still fail validation.

```bash
pnpm i18n:validate-editor
pnpm i18n:validate-runtime
pnpm i18n:audit
pnpm i18n:gen-editor
pnpm i18n:gen-runtime
pnpm bundle
```

Commit locale JSON, generated `src/shared/*-i18n-data.ts`, matching root lookup
artifacts, the rebuilt HACS bundle and manifest. Checked lookup implementations
are `src/shared/editor-i18n-runtime.ts` and `runtime-i18n-runtime.ts`.
Remaining non-`ed.*` labels use the supported legacy row inputs consumed by the
editor generator. Retired catalog shards and translation caches are not sources.

For languages, key conventions and operator setup, see
[translations](docs/TRANSLATIONS.md) and [Weblate](docs/weblate/README.md).

## Verification

```bash
pnpm validate:fast
pnpm validate
```

The fast gate checks versions, architecture, strict types, lint, distribution
syntax, all translations, build and Node regressions. Full validation adds
Chromium, Firefox, WebKit and iPhone WebKit. CI regenerates artifacts and rejects
uncommitted drift. Commit generated outputs after changing canonical sources.
See [testing](docs/testing.md) for browser installation and targeted runs.

For UI changes, reproduce behavior in Home Assistant, including light/dark
appearance, compact layouts, keyboard focus and relevant editor settings. Add
behavioral regression coverage when fixing runtime bugs; avoid tests that merely
mirror implementation text. Manual dashboard profiling complements automated
fixtures and should record device, browser and workload.

If a new build dependency needs install scripts, approve the required package
with `pnpm approve-builds` and review `pnpm-workspace.yaml` changes.

## Version 3 release preparation

Reviewed work lands on `main`. Maturity is represented by the package version
and exact Git tag; separate `alpha` or `beta` branches are not required.

| Channel | Example tag | Purpose |
|---|---|---|
| Alpha | `v3.0.0-alpha.4` | Active regression testing |
| Beta | `v3.0.0-beta.1` | Architecture/API/feature freeze; stabilization |
| Release candidate | `v3.0.0-rc.1` | Final compatibility validation |
| Stable | `v3.0.0` | Validated daily dashboard release |

Keep current installation status truthful until the stable tag is published.
Stable notes belong in `CHANGELOG.md`; previews use `CHANGELOG-PRERELEASES.md`.
Preserve historical version entries. `README.md`, `ROADMAP.md`, integration docs
and issue templates must describe the actual published channel.

Follow [releasing](docs/releasing.md). Preparation can be inspected with
`pnpm release --dry-run`; it does not commit, tag or publish. The tagged commit
must pass the same static and four-browser gate as PRs. Verify uploaded bundle
integrity and the correct prerelease flag after publication.

## Published-release performance evidence

Use [the permanent benchmark harness](bench/README.md) for measured performance changes. Preserve raw samples, release asset hashes and per-engine results. Shared CI smoke checks correctness/output, never a small timing percentage. Official release notes accept only validated published-asset evidence. The [RC audit](docs/audits/rc-readiness-report.md) records the current verdict; beta availability alone does not authorize RC.
