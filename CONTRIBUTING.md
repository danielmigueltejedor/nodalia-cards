# 🤝 Contributing to Nodalia Cards

First of all, thanks for your interest in contributing 🙌

Nodalia Cards is still evolving and feedback, ideas and improvements are very welcome.

---

## 📄 Documentation parity (`main` / `beta`)

These paths must stay **the same** on **`main`** and **`beta`** (copy or merge after each edit):

- **`README.md`**
- **`CHANGELOG.md`**
- **`CONTRIBUTING.md`**
- **`ROADMAP.md`** (if present)
- **`.github/ISSUE_TEMPLATE/**`** and other **`.github/*.md`** text (bug reports, PR templates, etc.)

Branch-specific content belongs in **`package.json`**, release tags, and code—not in diverging docs. After changing any of the files above on one branch, update the other branch **before** pushing (e.g. `git checkout main -- README.md CHANGELOG.md CONTRIBUTING.md` from the branch that has the edits, `git checkout main -- .github`, or merge **`main` ↔ `beta`** once code conflicts are resolved).

Tip: after syncing docs, confirm with  
`git diff main beta -- README.md CHANGELOG.md CONTRIBUTING.md ROADMAP.md .github` — it should be **empty**.

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

---

## 🏷️ Releases and beta versions

Stable releases (**`0.2.x`**, **`0.3.x`**, **`0.4.x`**, …) ship from **`main`**. Prereleases are cut from the **`beta`** branch for translation polish and card work ahead of the next minor.

**Beta tags and versions:** use **`v0.4.0-beta.XX`** on GitHub with **`XX` as two digits** (`01`, `02`, … `09`, `10`, …) so release lists stay ordered. Example: third beta → **`v0.4.0-beta.03`**. Keep **`package.json`** `version` identical to that prerelease string (without the leading `v`) so HACS and `__NODALIA_BUNDLE__` match the tag.

For maintainers: each shipped beta—add a section to **`CHANGELOG.md`**, bump the **Current beta** (or **Next prerelease**) badge in **`README.md`** as appropriate, tag **`v0.4.0-beta.XX`**, and run **`npm run bundle`** when artefacts change.

### Stable first, then the next beta line

Use this order so **`main`** and **`beta`** stay predictable for HACS and tags.

1. **`main` (stable)**  
   - Set **`package.json`** `version` to the stable release (e.g. **`0.3.0`**).  
   - Ensure **`CHANGELOG.md`** includes the **`[0.3.0]`** (or matching) section.  
   - Run **`npm run bundle`**, commit, push **`main`**.  
   - Tag **`v0.3.0`** (or matching) and publish the GitHub **Release**.

2. **`beta` (first prerelease of the next minor)**  
   - Merge **`main`** into **`beta`**.  
   - Bump **`package.json`** to **`0.4.0-beta.01`** (first **`0.4.x`** prerelease; use **`beta.01`**, **`beta.02`**, … with **two digits** in the tag: **`v0.4.0-beta.01`**, **`v0.4.0-beta.02`**, …).  
   - Add **`## [0.4.0-beta.01] - YYYY-MM-DD`** at the top of **`CHANGELOG.md`** (you can remove or empty **`[Unreleased]`** on **`beta`** if it was only a planning stub).  
   - Update **`README.md`** prerelease badge to the orange **current beta** style with **`0.4.0-beta.01`** when you want to advertise the live prerelease.  
   - Run **`npm run bundle`**, commit, push **`beta`**, tag **`v0.4.0-beta.01`**.

Afterwards, keep **`CHANGELOG.md` / `README.md` / `CONTRIBUTING.md`** in sync across branches when possible (see *Documentation parity* above); **`package.json`** `version` is the usual intentional difference between **`main`** and **`beta`** until the next stable merge.

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
