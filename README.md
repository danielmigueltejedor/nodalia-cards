# 🎨 Nodalia Cards

![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2025.1%2B-41BDF5?logo=home-assistant)
![Latest stable](https://img.shields.io/badge/latest%20stable-0.2.1-2ea043)
![Stable](https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards?label=stable)
![Current beta](https://img.shields.io/badge/current%20beta-0.3.0--beta.13-orange)
![Pre-release](https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards?include_prereleases&label=pre-release)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![GitHub](https://img.shields.io/badge/hosted%20on-GitHub-black?logo=github)

**Nodalia Cards** is a custom card bundle for Home Assistant focused on creating a cleaner, more polished and more app-like dashboard experience.

The goal is not only to provide beautiful cards, but to build a consistent UI system for Home Assistant with smooth interactions, readable layouts and a mobile-first experience.

---

## ✨ Highlights

- Modern and consistent visual style
- Mobile-first dashboard experience
- Smooth animations and state transitions
- Tactile feedback support
- Friendly visual editors
- Clean gradients and readable layouts
- Designed for real daily use

---

## 📸 Preview
Animations and interactions in action:

<p align="center">
  <img src="https://raw.githubusercontent.com/danielmigueltejedor/nodalia-cards/main/docs/gifs/animations1.optimized.gif" width="280"/>
  <img src="https://raw.githubusercontent.com/danielmigueltejedor/nodalia-cards/main/docs/gifs/animations2.optimized.gif" width="280"/>
</p>

---

## 🧩 Cards included

- custom:nodalia-navigation-bar  
- custom:nodalia-media-player  
- custom:nodalia-light-card  
- custom:nodalia-fan-card  
- custom:nodalia-humidifier-card  
- custom:nodalia-circular-gauge-card  
- custom:nodalia-graph-card  
- custom:nodalia-power-flow-card  
- custom:nodalia-climate-card  
- custom:nodalia-alarm-panel-card  
- custom:nodalia-advance-vacuum-card  
- custom:nodalia-entity-card  
- custom:nodalia-fav-card  
- custom:nodalia-insignia-card  
- custom:nodalia-person-card  
- custom:nodalia-weather-card  
- custom:nodalia-vacuum-card  

---

## 🚀 Installation

### HACS

[![Open your Home Assistant instance and open this repository in the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=danielmigueltejedor&repository=nodalia-cards&category=plugin)

In HACS, open **Nodalia Cards** and use **Download** (pick the release or prerelease you want). HACS adds the Lovelace resource for you—no need to paste YAML for a normal install. Refresh the dashboard; you can then add the custom cards in the UI.

If something still looks off (e.g. old script cached), use **Redownload** in HACS, or in **Settings → Dashboards → ⋮ → Resources** make sure the entry matches the URL HACS created. HACS may append `?hacstag=…` to the path; that value is **per install and selected version**, not the app semver—replace it with whatever HACS shows after **Redownload** if needed. In the browser console, `__NODALIA_BUNDLE__` confirms which bundle loaded (`pkgVersion` and a short content id).

<details>
<summary>Manual install (no HACS)</summary>

Copy `nodalia-cards.js` into `config/www/` (or a subfolder) and add a resource under **Settings → Dashboards → Resources** with **type** `JavaScript module` and **URL** `/local/…` pointing at that file (for example `/local/nodalia-cards.js` if it lives at `config/www/nodalia-cards.js`).

</details>

---

## 🌍 Translations

**Stable (`main`) — 0.2.1** includes **es, en, de, fr, it, nl** for the bundled cards and Lovelace visual editors (coverage is still improving). Spot a wrong or awkward string? Open an issue with the **Translation correction** template — see **CONTRIBUTING**.

**Prereleases (`beta`) — 0.3.0-beta.XX** (see **CONTRIBUTING** for tags): **pt, ru, el, zh** (simplified), **ro** use the same runtime **`nodalia-i18n`** packs as other locales (merged from English where a locale is still partial). The visual editor adds **`editorUiMaps`** for those codes; long phrases fall back to **English** until translated in **`FULL_LOCALE_BY_EN`** / extras (`scripts/gen-editor-ui.mjs`). Locale polish continues before the next minor release.

---

## 🛣️ Roadmap

- Fix remaining bugs  
- Improve consistency  
- Redesign graph card  
- Improve energy flow card  
- Refine navigation bar  
- Polish translations and UX (0.3.x)

---

## 🤝 Feedback

Feedback and contributions are welcome!

---

## 🧑‍💻 Author

Daniel Miguel Tejedor

---

## 💰 Donations

https://paypal.me/DanielMiguelTejedor
