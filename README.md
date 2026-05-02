# 🎨 Nodalia Cards

![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2025.1%2B-41BDF5?logo=home-assistant)
![Latest stable](https://img.shields.io/badge/latest%20stable-0.2.0-2ea043)
![Stable](https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards?label=stable)
![Current beta](https://img.shields.io/badge/current%20beta-0.3.0--beta.1-orange)
![Pre-release](https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards?include_prereleases&label=pre-release)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-beta-orange.svg)
![GitHub](https://img.shields.io/badge/hosted%20on-GitHub-black?logo=github)

**Nodalia Cards** is a custom card bundle for Home Assistant focused on creating a cleaner, more polished and more app-like dashboard experience.

The goal is not only to provide beautiful cards, but to build a consistent UI system for Home Assistant with smooth interactions, readable layouts and a mobile-first experience.

> 🟡 Project not affiliated with Home Assistant.  
> Personal and educational project.

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

```yaml
url: /hacsfiles/nodalia-cards/nodalia-cards.js
type: module
```

HACS can append `?hacstag=…` to that path (cache busting). **Do not keep a very old or copy-pasted `hacstag`:** it can make the panel keep loading an **outdated** `nodalia-cards.js` (e.g. missing or broken translations). If the UI does not follow your Home Assistant language, open your Lovelace **Resource**, remove the `?hacstag=…` part or replace the full URL with the one HACS shows after **Redownload**, then hard-refresh the dashboard.

---

## 🌍 Translations

**0.2.0** on **`main`** includes **es, en, de, fr, it, nl** for the bundled cards and Lovelace visual editors (coverage is still improving). Spot a wrong or awkward string? Open an issue with the **Translation correction** template — see **CONTRIBUTING**.

This **`beta`** branch ships **0.3.0-beta.x** prereleases: locale polish, editor refinements, and card improvements before the next minor release.

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
