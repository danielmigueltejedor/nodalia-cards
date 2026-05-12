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

# 📄 Documentation parity (`main` / `beta` / `alpha`)

The following files should remain aligned whenever possible:

- `README.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `ROADMAP.md`
- `.github/*.md`

between:

- `main`
- `beta`

unless a branch intentionally documents prerelease-only behavior.

---

## Alpha branch behavior

`alpha` moves much faster and may temporarily drift from:

- README
- changelog
- roadmap
- release examples

during active development cycles.

This is expected.

When work is promoted:
- `alpha` → `beta`
- or `beta` → `main`

documentation should be synchronized again.

---

## Useful parity check

After syncing branches:

```bash
git diff main beta -- README.md CHANGELOG.md CONTRIBUTING.md ROADMAP.md .github
```

Ideally the result should be empty except during active prerelease work.

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

`nodalia-i18n.js`

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

# 📦 Bundle architecture

Main build command:

```bash
npm run bundle
```

This runs:

```bash
scripts/sync-standalone-embed.mjs
scripts/build-bundle.mjs
```

and generates:

```text
nodalia-cards.js
```

---

## Bundle order matters

The bundle currently loads in this order:

```text
nodalia-i18n.js
nodalia-editor-ui.js
nodalia-utils.js
nodalia-bubble-contrast.js
card files...
```

If changing dependencies or adding modules, preserve correct initialization order.

---

# 🧰 Standalone card scripts

Each standalone card file includes embedded utility helpers between:

```js
// <nodalia-standalone-utils>
// </nodalia-standalone-utils>
```

The main bundle strips those blocks automatically to avoid duplication.

After editing:

```text
nodalia-utils.js
```

run:

```bash
npm run bundle
```

or:

```bash
node scripts/sync-standalone-embed.mjs
```

to keep standalone files synchronized.

---

# 🏷️ Release channels

Nodalia Cards uses three release channels.

| Branch | Audience | Stability |
|---|---|---|
| `main` | Normal users | Stable |
| `beta` | Early adopters | Mostly stable |
| `alpha` | Developers / testers | Experimental |

---

# 🚀 Stable (`main`)

Production-ready releases.

Examples:

```text
1.0.0
1.0.1
1.1.0
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
1.1.0-beta.1
1.1.0-beta.2
```

Beta releases are expected to be usable but may still evolve before stable.

---

# ⚠️ Alpha (`alpha`)

Fast experimental development.

Examples:

```text
1.1.0-alpha.1
1.1.0-alpha.2
```

Alpha builds may:
- break dashboards
- change YAML behavior
- contain unfinished systems
- introduce regressions

This is expected.

---

# 🔄 Typical release flow

```text
alpha → beta → main
```

Typical progression:

1. Experimental work lands in `alpha`
2. Stable feature batches move into `beta`
3. Final polished releases merge into `main`

---

# 🏷️ Versioning

`package.json` version should always match the Git tag (without `v`).

Examples:

```text
package.json → 1.0.0-beta.3
git tag     → v1.0.0-beta.3
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
npm run bundle
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
- Testing alpha builds
- UI suggestions
- Performance feedback
- Documentation improvements

Nodalia Cards became what it is through constant iteration and real-world feedback.

Thanks again for supporting the project 🙌
