# 🤝 Contributing to Nodalia Cards

First of all, thanks for your interest in contributing 🙌

Nodalia Cards has grown from a small collection of custom cards into a much larger frontend ecosystem for Home Assistant, and community feedback continues shaping the project every day.

Ideas, bug reports, testing and improvements are always welcome.

---

# 🧠 Project philosophy

The goal of Nodalia Cards is not simply to create beautiful cards.

The goal is building a **cohesive, polished and app-like frontend system for Home Assistant**.

When contributing, keep these principles in mind:

- Consistency is more important than adding features
- UX quality is more important than feature quantity
- Mobile-first experience
- Smooth interactions
- Visual coherence
- Real usability over visual overload
- Long-term maintainability
- Shared systems over isolated solutions

---

# 📄 Documentation parity (`main` / `beta` / `alpha` / release tags)

The following files should remain aligned whenever possible:

- `README.md`
- `CHANGELOG.md`
- `CHANGELOG-PRERELEASES.md`
- `CONTRIBUTING.md`
- `ROADMAP.md`
- `docs/nodalia-integration.md`
- `docs/climate-setpoint-schedule.md`
- `.github/ISSUE_TEMPLATE/*.yml`
- `.github/workflows/*.yml`

between:

- `main`
- `beta`
- `alpha`

unless a branch intentionally documents prerelease-only behavior.

---

## Preview branch behavior

`alpha` moves much faster, while `beta` and release-candidate tags represent progressively stricter snapshots. Preview documentation may temporarily drift from:

- README
- changelog
- roadmap
- release examples

during active development cycles.

This is expected.

When work is promoted:
- `alpha` → `beta`
- `beta` → an `rc` tag
- an accepted `rc` → `main`

documentation should be synchronized again.

---

## Useful parity check

After syncing branches:

```bash
git diff main beta -- README.md CHANGELOG.md CONTRIBUTING.md ROADMAP.md docs/nodalia-integration.md docs/climate-setpoint-schedule.md .github
git diff beta alpha -- README.md CHANGELOG.md CONTRIBUTING.md ROADMAP.md docs/nodalia-integration.md docs/climate-setpoint-schedule.md .github
```

Ideally both results should be empty except for explicitly documented prerelease differences.

---

# 🐛 Reporting bugs

If you find a bug:

1. Make sure you're using the latest version
2. Check whether the issue already exists
3. Open a new GitHub issue using the provided template

Please include:

- Clear description
- Steps to reproduce
- Card YAML
- Screenshots or videos
- Home Assistant version
- Browser / device
- Console errors if relevant

The more reproducible the issue is, the easier it is to fix.

---

# ✨ Suggesting features

Feature ideas are welcome.

Before opening a feature request:

- Think about how it fits the overall system
- Avoid ideas that break visual consistency
- Explain the actual use case
- Prefer improvements that help real dashboards

Good feature requests usually explain:

- What problem exists
- Why the current solution is insufficient
- How the feature would improve usability
- How it fits the Nodalia design philosophy

---

# 🛠️ Contributing code

If you want to contribute code:

```bash
git fork
git checkout -b feature/my-feature
```

Then:

1. Make your changes
2. Keep style and structure consistent
3. Test inside Home Assistant
4. Ensure the bundle builds correctly
5. Open a Pull Request

---

# 🧩 Architecture overview

Nodalia Cards is now composed of multiple shared systems:

- Shared visual tokens
- Shared utility helpers
- Shared i18n systems
- Shared editor systems
- Shared popup patterns
- Shared animation logic
- Shared persistence helpers

Contributions should prefer extending shared systems instead of duplicating logic inside individual cards.

---

# 🎨 Design guidelines

Nodalia Cards follows a defined visual language.

## Core principles

- Soft shadows
- Rounded corners
- Consistent spacing
- Subtle gradients
- Minimal but meaningful color
- Smooth animations
- Readable layouts
- Compact mobile ergonomics

---

## Avoid

- Overcomplicated layouts
- Excessive color usage
- Inconsistent spacing
- Very strong shadows
- Large visual noise
- Breaking animation language
- Isolated design patterns

---

# ⚡ Performance guidelines

Performance matters a lot in large Home Assistant dashboards.

Please avoid:

- Unnecessary full rerenders
- Large repeated DOM rebuilds
- Heavy synchronous loops
- Repeated expensive calculations
- Layout thrashing
- Constant animation replays

Prefer:

- Render signatures
- Shared caches
- Compositor-friendly transforms
- Incremental updates
- Reusable helpers

---

# 🌍 Translations

Nodalia includes both:

- Runtime translations
- Visual editor translations

Current supported languages:

- Spanish
- English
- German
- French
- Italian
- Dutch
- Norwegian
- Portuguese
- Russian
- Greek
- Chinese
- Romanian

---

## Translation guidelines

If helping with translations:

- Prefer natural wording
- Avoid literal machine-style translations
- Keep UI text compact
- Preserve consistency between cards
- Match Home Assistant terminology when possible

You can also contribute via **[Nodalia Cards on Crowdin](https://crowdin.com/project/nodalia-cards)** (community strings for runtime + editor catalogs; see [`crowdin.yml`](./crowdin.yml)).

For the full step-by-step workflow, including adding a new language to the bundle, see [`docs/TRANSLATIONS.md`](./docs/TRANSLATIONS.md).

For matching Nodalia’s look on **other** Lovelace cards (themes, **card-mod**, YAML), see [`docs/STYLING.md`](./docs/STYLING.md).

---

## Translation corrections

Wrong or awkward string?

Open an issue using:

```text
Translation correction
```

template under:

```text
.github/ISSUE_TEMPLATE/translation.yml
```

---

# 🧱 Runtime vs editor translations

## Runtime

Runtime strings are edited in `i18n/runtime/<lang>.json` (see `docs/TRANSLATIONS.md`). Regenerate the embedded pack in `nodalia-i18n.js` with:

```bash
pnpm run i18n:validate-runtime
pnpm run i18n:gen-runtime
```

The `nodalia-i18n.js` file still holds all resolution helpers (`resolveLanguage`, `translate*`, …); only the `const PACK` block between `// <nodalia-runtime-i18n-pack>` and `// </nodalia-runtime-i18n-pack>` is generated from JSON.

- Locale packs are deep-merged over English
- Partial translations still work safely
- Runtime cards use shared namespaces

---

## Visual editors

Generated through:

```bash
node scripts/gen-editor-ui.mjs
```

and bundled into:

```text
nodalia-editor-ui.js
```

When adding new locales:

- Extend `FULL_LOCALE_BY_EN`
- Update `editor-extra-locale-by-en.json` if needed
- Rebuild the bundle afterwards

---

# 🧩 Local toolchain

Install [pnpm](https://pnpm.io/installation) (Node **22+** matches CI). The repo sets **`packageManager`** in `package.json`; with [Corepack](https://nodejs.org/api/corepack.html) enabled, that pnpm version is selected automatically:

```bash
corepack enable
pnpm install
```

Use **`pnpm test`** and **`pnpm run bundle`** before opening a PR (same as GitHub Actions). If you add a dependency that runs install scripts, approve it once with **`pnpm approve-builds`** (updates **`pnpm-workspace.yaml`** under **`allowBuilds`**, required by pnpm 11’s default security policy).

---

# 📦 Bundle architecture

Main build command:

```bash
pnpm run bundle
```

This runs:

```bash
scripts/build-bundle.mjs
```

and generates:

```text
nodalia-cards.js
```

---

## Bundle order matters

The runtime bundle currently loads in this order:

```text
nodalia-i18n.js
nodalia-utils.js
nodalia-render-signature.js
nodalia-bubble-contrast.js
nodalia-notifications-mobile-policy.js
nodalia-room-summary-model.js
nodalia-camera-stream-model.js
card files...
```

The self-contained HACS distribution appends `nodalia-editor-ui.js`; the optional core/suite build lazy-loads the editor only when Home Assistant opens a visual editor. If changing dependencies or adding modules, preserve this initialization order and keep support models ahead of their cards.

---

# 🧰 Shared utilities (`nodalia-utils.js`)

Lovelace helpers (`escapeLovelaceWarningText`, entity guards, editor collapsibles, zone tap scheduling, etc.) live only in **`nodalia-utils.js`** and are exposed as **`window.NodaliaUtils`**. Card sources call those APIs; they do not duplicate the implementations.

The bundle loads **`nodalia-utils.js` once** before card modules (see order above). After editing **`nodalia-utils.js`**, run **`pnpm run bundle`** and commit the updated **`nodalia-cards*.js`** artifact.

For a **single-file** Lovelace resource (one card JS without the full bundle), run **`node scripts/sync-standalone-embed.mjs`** locally to inline utils into that file; do not commit those embed blocks to the repo.

---

# 🏷️ Release channels

Nodalia Cards uses three working branches and four release maturities.

| Maturity | Branch / tag | Audience | Stability |
|---|---|---|---|
| Stable | `main`, `vX.Y.Z` | Normal users | Production |
| Release candidate | `vX.Y.Z-rc.N` | Final testers | Feature-frozen |
| Beta | `beta`, `vX.Y.Z-beta.N` | Early adopters | Preview |
| Alpha | `alpha`, `vX.Y.Z-alpha.N` | Developers / testers | Experimental |

---

# 🚀 Stable (`main`)

Production-ready releases.

Examples:

```text
1.3.4
1.3.5
2.0.0
```

These releases should be:
- polished
- documented
- safe for daily dashboards

---

# 🧪 Beta (`beta`)

Feature-preview releases.

Examples:

```text
2.0.0-beta.1
2.0.0-beta.2
```

Beta releases are expected to be usable but may still evolve before stable.

---

# ⚠️ Alpha (`alpha`)

Fast experimental development.

Examples:

```text
2.0.0-alpha.49
2.0.0-alpha.50
```

Alpha builds may:
- break dashboards
- change YAML behavior
- contain unfinished systems
- introduce regressions

This is expected.

---

# ✅ Release candidate (`rc` tag)

A release candidate is feature-frozen and used for final regression, browser, Home Assistant, package and release-automation validation.

Examples:

```text
2.0.0-rc.1
2.0.0-rc.2
```

RC maturity lives in the version and Git tag. It is not a permanent branch; cut the tag only from an exact commit that has passed the full validation and release metadata checks.

---

# 🔄 Typical release flow

```text
alpha → beta → rc → main
```

Typical progression:

1. Experimental work lands in `alpha`
2. Stable feature batches move into `beta`
3. A feature-frozen commit is tagged as one or more release candidates
4. The accepted candidate is promoted to `main` and tagged stable

Low-risk cycles may skip `beta`, but every published version must still pass the same version, bundle, browser and release-metadata gates.

For releases that change the optional backend bridge, also verify that the main README and `docs/nodalia-integration.md` contain working, category-specific HACS links for both repositories and document the tested Cards/Engine compatibility pair.

---

# 🏷️ Versioning

`package.json` version should always match the Git tag (without `v`).

Examples:

```text
package.json → 2.0.0-rc.1
git tag     → v2.0.0-rc.1
```

This keeps:

- HACS
- `__NODALIA_BUNDLE__`
- releases
- changelog

fully aligned.

---

# 🧪 Build & testing expectations

Before opening a PR:

## Build the bundle

```bash
pnpm run bundle
```

---

## Test inside Home Assistant

At minimum:
- load the dashboard
- verify the card renders
- verify editor behavior
- verify no console errors

---

## Check for regressions

Especially around:
- animations
- mobile layouts
- editor rendering
- translations
- persistence systems
- popup behavior

---

# 💬 Communication

Please keep discussions:

- respectful
- constructive
- focused
- collaborative

The project grows faster when feedback stays clear and solution-oriented.

---

# 🙌 Final note

Even small contributions help a lot.

That includes:

- Bug reports
- Translation fixes
- Testing preview builds
- UI suggestions
- Performance feedback
- Documentation improvements

Nodalia Cards became what it is through constant iteration and real-world feedback.

Thanks again for supporting the project 🙌
