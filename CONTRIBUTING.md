# 🤝 Contributing to Nodalia Cards

First of all, thanks for your interest in contributing 🙌

Nodalia Cards is still evolving and feedback, ideas and improvements are very welcome.

---

## 📄 Documentation parity (`main` / `beta` / `alpha`)

**`README.md`**, **`CHANGELOG.md`**, **`CONTRIBUTING.md`**, **`ROADMAP.md`**, and **`.github/*.md`** should stay aligned between **`main`** and **`beta`** whenever you publish or merge (same guidance as before: branch-specific content lives mainly in **`package.json`** and tags).

**`alpha`** moves faster and may carry temporary **`CHANGELOG`** bullets or **`package.json`** bumps ahead of **`beta`**—merge docs back when promoting work to **`beta`**, or accept a short drift until the next **`beta`** sync.

Tip after syncing **`main` ↔ `beta`**:  
`git diff main beta -- README.md CHANGELOG.md CONTRIBUTING.md ROADMAP.md .github` — ideally **empty** (except during active prerelease work).

---

## 🧠 Project philosophy

The goal of Nodalia Cards is to create a **clean, consistent and app-like UI system for Home Assistant**.

When contributing, keep in mind:

- Consistency is more important than adding new features
- Simplicity and clarity over complexity
- Mobile-first experience
- Smooth interactions and polished UI
- Real usability over visual overload

---

## 🐛 Reporting bugs

If you find a bug:

1. Make sure you're using the latest version
2. Check if the issue was already reported
3. Open a new issue using the bug template

Please include:

- A clear description of the problem
- Steps to reproduce
- Your card configuration (YAML)
- Screenshots or videos if possible
- Home Assistant version
- Device / browser

---

## ✨ Suggesting features

Feature ideas are welcome!

Before opening a request:

- Think about how it fits into the overall system
- Avoid adding features that break visual consistency
- Try to explain the real use case

Good feature requests usually include:

- What problem it solves
- How it would work
- Why it improves the experience

---

## 🛠️ Contributing code

If you want to contribute code:

1. Fork the repository
2. Create a new branch:
   git checkout -b feature/my-feature

3. Make your changes
4. Keep the style and structure consistent
5. Test your changes in Home Assistant
6. Open a Pull Request

---

## 🎨 Design guidelines

Nodalia Cards has a defined visual style:

- Soft shadows (not too strong)
- Rounded corners
- Clean spacing
- Minimal but meaningful color usage
- Smooth animations and transitions

Avoid:

- Overcomplicated layouts
- Inconsistent spacing or sizing
- Breaking the visual language

---

## 🌍 Translations

Currently the project is mainly optimized for Spanish and evolving towards English.

If you want to help with translations:

- Keep wording natural (not literal translations)
- Focus on clarity and usability
- **Wrong string on screen?** Open an issue using the **Translation correction** template (`.github/ISSUE_TEMPLATE/translation.yml`).
- Alternatively, open a PR that updates the relevant locale data if you are comfortable editing the repo.

Community help is especially useful for languages other than Spanish and English.

### Runtime vs editor (**pt** / **ru** / **el** / **zh** / **ro**)

- **`nodalia-i18n.js`**: each locale object is **deep-merged** over **`PACK.en`**, so partially translated packs still expose **every card namespace** (fan, alarm, weather, …). Override strings inside **`PACK.<code>`** as translations are completed.
- **Visual editors**: **`scripts/gen-editor-ui.mjs`** builds **`nodalia-editor-ui.js`**. Add **`pt` / `ru` / `el` / `zh` / `ro`** next to **`de`** / **`fr`** in **`FULL_LOCALE_BY_EN`** (and **`editor-extra-locale-by-en.json`** when used) for full phrases; compact UI strings use the **`enTo*`** helpers. Then run **`node scripts/gen-editor-ui.mjs`** and **`npm run bundle`**.

### Bundle vs standalone scripts

- **`npm run bundle`** runs **`scripts/sync-standalone-embed.mjs`** then **`scripts/build-bundle.mjs`** and writes **`nodalia-cards.js`**. Module order in **`parts`** matters: **`nodalia-i18n.js`** → **`nodalia-editor-ui.js`** → **`nodalia-utils.js`** → **`nodalia-bubble-contrast.js`** → card files. After changing **`parts`**, or any bundled source, run **`npm run bundle`** again.
- **`nodalia-utils.js`** attaches **`window.NodaliaUtils`** (shared config stripping, lightweight editor **`hass` signatures**, entity/icon picker mount helpers). It expects **`NodaliaI18n`** from **`nodalia-i18n.js`** for locale-aware signatures.
- **Normal setup:** one Lovelace resource pointing at **`nodalia-cards.js`** (documented in **`README.md`**).
- **Standalone single-card JS:** each shipped **`nodalia-*-card.js`** / **`nodalia-navigation-bar.js`** / **`nodalia-media-player.js`** begins with an **inlined copy** of **`nodalia-utils.js`** between **`// <nodalia-standalone-utils>`** and **`// </nodalia-standalone-utils>`**, so **`window.NodaliaUtils`** exists when only that script is loaded. **`build-bundle.mjs`** **strips** that block so **`nodalia-cards.js`** does not duplicate utilities (they come from the **`nodalia-utils.js`** module in **`parts`**). After editing **`nodalia-utils.js`**, run **`npm run bundle`** (or **`node scripts/sync-standalone-embed.mjs`**) so standalone files stay in sync.
- **Advanced / debugging:** you may still load **`nodalia-utils.js`** once before cards (after **`nodalia-i18n.js`** / **`nodalia-editor-ui.js`**); the utils **`init`** guard skips re-installing when the API is already complete.

---

## 🏷️ Releases: `main`, `beta`, and `alpha`

Three channels keep risk and expectations clear:

| Branch | Who it’s for | Version examples | Expectations |
|--------|----------------|------------------|--------------|
| **`main`** | Everyone | **`v0.4.0`**, **`v0.5.0`**, **`v0.6.0`**, **`v0.6.1`** (semver **only** stable minors/patches) | **Recommended** for normal dashboards. Only merged when the maintainer is happy to endorse the build widely. |
| **`beta`** | Testers, early adopters | **`1.0.0-beta.1`**, **`1.0.0-beta.2`**, … (tags **`v1.0.0-beta.1`**, …) | **Pretty usable**; features are exercised but not guaranteed frozen. Promoted from **`alpha`** when a slice of work is **polished enough** (merge or cherry-pick). |
| **`alpha`** | Developers / brave testers | **`1.0.0-alpha.1`**, **`1.0.0-alpha.2`**, … (tags **`v1.0.0-alpha.1`**, … optional) | **High churn**. Frequent commits; **dashboards may break**. Breaking YAML or behaviour is allowed here. |

**Promotion flow (typical):** experimental work lands on **`alpha`** → when a feature (or batch) is stable enough, it moves to **`beta`** → when the major is ready, **`beta`** merges to **`main`** as **`v1.0.0`**. Avoid merging **`alpha` → `main`** directly if you want **`beta`** to stay the gate for “probably OK for testers”.

**Semver notes:** use **`package.json`** `version` identical to the Git tag (without **`v`**) so **`__NODALIA_BUNDLE__.pkgVersion`** and HACS match. Prerelease identifiers **`alpha.N`** and **`beta.N`** sort correctly on GitHub if **`N`** increments monotonically (**`1`**, **`2`**, … or zero-padded **`01`**, **`02`** if you prefer—pick one style per line and stick to it).

### Creating the **`alpha`** branch

After **`v0.4.0`** is on **`main`** (and optionally after **`beta`** exists), create **`alpha`** from the branch where **`0.5.x`** work should start—for example:

```bash
git checkout main && git pull
git checkout -b alpha
# set package.json to e.g. 1.0.0-alpha.56, changelog section, npm run bundle
git push -u origin alpha
```

Or branch **`alpha`** from **`beta`** if **`beta`** already tracks **`0.5.0-beta.*`** and you want **`alpha`** as an extra-experimental line—document which convention you follow in the first **`alpha`** tag message.

### Stable **`main`**, then **`beta`**, then ongoing **`alpha` → beta`**

1. **`main` (stable)** — **`package.json`** e.g. **`0.5.0`**, **`CHANGELOG`** **`[0.5.0]`**, **`npm run bundle`**, tag **`v0.5.0`**, GitHub **Release**.

2. **`beta` (first prerelease of the next major)** — merge **`main`** into **`beta`**, bump to **`1.0.0-beta.1`**, **`CHANGELOG`** **`## [1.0.0-beta.1]`**, **`npm run bundle`**, tag **`v1.0.0-beta.1`**.

3. **`alpha` (experimental)** — after shipping **`0.6.1` stable, continue the next major line as `1.0.0-alpha.*` (currently **`1.0.0-alpha.56`**) and promote to **`1.0.0-beta.*`** when ready.

4. **Stable minor** — when **`beta`** is release-ready, merge **`beta` → `main`**, set the stable version (currently **`0.6.1`**), and tag accordingly.

---

## 💬 Communication

- Be respectful and constructive
- Explain ideas clearly
- Keep discussions focused on improving the project

---

## 🚀 Final note

Even small contributions help:

- Reporting bugs
- Suggesting improvements
- Sharing ideas
- Testing features

Everything helps move Nodalia Cards closer to a polished 1.0 version.

Thanks again for your support! 🙌
