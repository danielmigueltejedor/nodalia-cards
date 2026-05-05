# 🎨 Nodalia Cards

![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2025.1%2B-41BDF5?logo=home-assistant)
![Latest stable](https://img.shields.io/badge/latest%20stable-0.6.1-2ea043)
![Stable](https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards?label=stable)
![Alpha branch](https://img.shields.io/badge/alpha-1.0.0--alpha.18-orange)
![Pre-release](https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards?include_prereleases&label=pre-release)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![GitHub](https://img.shields.io/badge/hosted%20on-GitHub-black?logo=github)

**Nodalia Cards** is a custom card bundle for Home Assistant focused on creating a cleaner, more polished and more app-like dashboard experience.

The goal is not only to provide beautiful cards, but to build a consistent UI system for Home Assistant with smooth interactions, readable layouts and a mobile-first experience.

**Release channels:** **`main`** (stable, recommended) · **`beta`** (test builds for early adopters) · **`alpha`** (experimental; may break). See **`CONTRIBUTING.md`** → **Releases: main, beta, and alpha**.

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
- custom:nodalia-calendar-card  
- custom:nodalia-vacuum-card  

---

## 📋 YAML configuration

The **visual editors** in this bundle emit **lean YAML**: any option that still matches the card’s **built-in defaults** is omitted (using the same `stripEqualToDefaults` helper as other Nodalia cards, e.g. **Entity**). You only see keys you actually changed—handy for manual YAML and reviews.

**Always set** `type` to the correct `custom:nodalia-…` value. Most cards also need an **`entity`** (or equivalent) to be useful.

### All cards (overview)

| Card | `type` | What it’s for |
|------|--------|----------------|
| Navigation bar | `custom:nodalia-navigation-bar` | Pill navigation between dashboard views |
| Media player | `custom:nodalia-media-player` | Rich player UI with popup transport |
| Light | `custom:nodalia-light-card` | Lights with sliders / presets |
| Fan | `custom:nodalia-fan-card` | Fans with speed/preset controls |
| Humidifier | `custom:nodalia-humidifier-card` | Humidifiers with mode/humidity |
| Circular gauge | `custom:nodalia-circular-gauge-card` | Compact radial gauges |
| Graph | `custom:nodalia-graph-card` | Multi-series history charts |
| Power flow | `custom:nodalia-power-flow-card` | Energy / solar flow diagram |
| Climate | `custom:nodalia-climate-card` | Thermostat-style climate UI |
| Alarm panel | `custom:nodalia-alarm-panel-card` | Alarm / keypad style controls |
| Advance vacuum | `custom:nodalia-advance-vacuum-card` | Vacuum + map focused layout |
| Entity | `custom:nodalia-entity-card` | General-purpose entity row / chips |
| Fav | `custom:nodalia-fav-card` | Favourite entity shortcuts |
| Insignia | `custom:nodalia-insignia-card` | Compact insignia / toolbar pills |
| Person | `custom:nodalia-person-card` | Presence / person-centric card |
| Weather | `custom:nodalia-weather-card` | Weather + forecast / charts |
| **Calendar** | `custom:nodalia-calendar-card` | Multi-calendar agenda + completed tasks |
| Vacuum | `custom:nodalia-vacuum-card` | Vacuum controls without advance map |

Use each card’s **visual editor** to discover fields; the YAML will stay minimal when options stay at defaults.

### Calendar card (`custom:nodalia-calendar-card`)

Shows merged events from one or more `calendar.*` entities, optional per-calendar **label** and **tint**, **time range** presets, and a **mark done** flow (browser `localStorage`, or shared via an **`input_text`** helper like Advance Vacuum’s cleaning session). Tap the card to open the **expanded** view (layout depends on the selected range). With **1 month** range, tap a **day** to focus that date (first event + colored dots / scroll for the rest).

**Minimal YAML example**

```yaml
type: custom:nodalia-calendar-card
calendars:
  - entity: calendar.casa
```

**Main options**

| Key | Type | Default (bundle) | What it does |
|-----|------|------------------|--------------|
| `title` | string | `Calendario` | Card title |
| `icon` | string | `mdi:calendar-month` | Header icon |
| `calendars` | list | `[]` | Each item: `entity` (required for that row), optional `label` (subtitle under the event), optional `tint` (row accent color, safe CSS) |
| `time_range` | string | `1w` | `3d`, `1w`, `2w`, or `1m` — how far ahead to load |
| `days_to_show` | number | derived | Usually **omit**; set by `time_range` (legacy YAML may still set a number) |
| `max_visible_events` | number | `2` | Events before the list scrolls |
| `refresh_interval` | number | `300` | Seconds between API refreshes |
| `allow_complete` | bool | `true` | Show “Mark done” on events |
| `show_completed` | bool | `false` | Keep completed events visible in the list |
| `shared_completed_events_entity` | string | *(empty)* | Optional `input_text.*` entity: stores completed-event keys as JSON so **phones, tablets and browsers** stay in sync (raise **`max`** on the helper if you hit the character limit) |
| `tint_auto` | bool | `true` | Tint the card with the theme primary; set `false` and use `styles.tint.color` for a **manual** accent |
| `animations` | object | see below | Entrance / motion tuning |
| `animations.enabled` | bool | `true` | Card animations |
| `animations.content_duration` | number | `260` | Base duration (ms) for entrance and complete animation timing |
| `styles` | object | — | Visual overrides (card, icon, chips, text); matches other Nodalia cards |

**`styles` (common keys)**

| Key | Purpose |
|-----|---------|
| `styles.card.*` | `background`, `border`, `border_radius`, `box_shadow`, `padding`, `gap` |
| `styles.icon.*` | `background`, `on_color`, `off_color`, `size` (bubble / glyph) |
| `styles.tint.color` | Manual accent when `tint_auto` is `false` |
| `styles.title_size` | Title font size |
| `styles.event_size` | Event text size |
| `styles.chip_height` / `chip_font_size` / `chip_padding` | Header range chip |
| `styles.chip_size` | Legacy alias mapped to `chip_font_size` if present |

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

**Stable (`main`) — 0.6.1** includes **es, en, de, fr, it, nl** plus **pt, ru, el, zh** (simplified), and **ro** for the bundled cards and Lovelace visual editors (partial trees merge from English; coverage is still improving). Spot a wrong or awkward string? Open an issue with the **Translation correction** template — see **CONTRIBUTING**.

**Prereleases:** active work-in-progress line is now **`1.0.0-alpha.18`** on **`alpha`** / **`beta`** (experimental and pre-stable builds). **`0.6.1`** stays as the recommended stable line on **`main`** while new cards and final polish (security, translations, fluency, animations, technical debt) continue toward `1.0.0`.

---

## 🛣️ Roadmap

- Fix remaining bugs  
- Improve consistency  
- Redesign graph card  
- Improve energy flow card  
- Refine navigation bar  
- Prepare and polish the **1.0.0** line (new cards + quality hardening)

---

## 🤝 Feedback

Feedback and contributions are welcome!

---

## 🧑‍💻 Author

Daniel Miguel Tejedor

---

## 💰 Donations

https://paypal.me/DanielMiguelTejedor
