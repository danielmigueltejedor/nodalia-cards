# 🎨 Nodalia Cards

![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2025.1%2B-41BDF5?logo=home-assistant)
![Package](https://img.shields.io/badge/package-1.0.2--alpha.12-df7138)
![Latest stable on main](https://img.shields.io/badge/latest%20stable%20%28main%29-1.0.1-2ea043)
![Stable](https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards?label=stable)
![Pre-release](https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards?include_prereleases&label=pre-release)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![GitHub](https://img.shields.io/badge/hosted%20on-GitHub-black?logo=github)

**Nodalia Cards** is a premium-style custom card bundle for Home Assistant focused on delivering a more polished, fluid and app-like dashboard experience.

The goal is not only to create beautiful cards, but to build a **cohesive frontend system** for Home Assistant:
consistent interactions, modern animations, mobile-first layouts, shared visual language, integrated editors and smart contextual UI.

**Release channels:**  
- **`main`** → stable, recommended  
- **`beta`** → preview builds for advanced users  
- **`alpha`** → experimental / may break  

See **`CONTRIBUTING.md`** → **Releases: main, beta, and alpha**.

---

# ✨ What makes Nodalia different?

- Unified visual system across all cards
- Mobile-first layouts and interactions
- Smooth transitions and tactile feeling UI
- Shared design tokens and animations
- Smart contextual cards
- Native-feeling visual editors
- Advanced Home Assistant integrations
- Designed for real daily dashboards
- Consistent UX instead of isolated cards

---

# 📸 Preview

Animations and interactions in action:

<p align="center">
  <img src="https://raw.githubusercontent.com/danielmigueltejedor/nodalia-cards/main/docs/gifs/animations1.optimized.gif" width="280"/>
  <img src="https://raw.githubusercontent.com/danielmigueltejedor/nodalia-cards/main/docs/gifs/animations2.optimized.gif" width="280"/>
</p>

---

# 🚀 What’s new in 1.0.x

**This branch installs `1.0.2-alpha.12`** — match **`package.json`** and **`window.__NODALIA_BUNDLE__.pkgVersion`**. Latest **stable** on **`main`** is **`1.0.1`**. The sections below summarize the **`1.0.0`** milestone; release notes for **`1.0.2-alpha.12`**, **`1.0.2-alpha.11`**, **`1.0.2-alpha.10`**, **`1.0.2-alpha.9`**, **`1.0.2-alpha.8`**, **`1.0.2-alpha.7`**, **`1.0.2-alpha.6`**, **`1.0.2-alpha.5`**, **`1.0.2-alpha.4`**, **`1.0.2-alpha.3`**, **`1.0.2-alpha.2`**, **`1.0.2-alpha.1`**, **`1.0.1`**, and earlier are in [`CHANGELOG.md`](./CHANGELOG.md).

## 🧠 Notifications Card

A completely new smart notification center for Home Assistant dashboards.

Features include:

- Expandable stacked notification UI
- Persistent dismiss system
- Smart contextual recommendations
- Mobile notification delivery
- Calendar integrations
- Vacuum / weather / humidity intelligence
- Entity-specific overrides
- Critical mobile alerts
- Visual editor support
- Animated transitions and compact mode

---

## 🗓️ Calendar Card

The new calendar experience for Home Assistant.

Features include:

- Native Home Assistant event creation
- Native event deletion
- Multiple calendar support
- Expanded popup views
- Daily / weekly / monthly layouts
- Weather forecast integration
- Recurring event support
- Shared persistence
- Compact mobile-friendly agenda UI
- Visual composer popup
- Calendar tinting and labels

---

## 🤖 Advanced Vacuum Experience

The vacuum ecosystem became significantly more powerful.

Highlights:

- Advanced map interaction
- Rooms / zones / goto / routines
- Shared session persistence
- Better Roborock integrations
- Real error detection
- Optimized map rendering
- Reduced map reloads
- Smoother transitions
- Cleaner control layout
- Improved mobile UX

---

## 🌍 Massive i18n Expansion

The **1.0.x** line ships with extensive localization support:

- 🇪🇸 Spanish
- 🇬🇧 English
- 🇩🇪 German
- 🇫🇷 French
- 🇮🇹 Italian
- 🇳🇱 Dutch
- 🇵🇹 Portuguese
- 🇷🇺 Russian
- 🇬🇷 Greek
- 🇨🇳 Chinese
- 🇷🇴 Romanian

Including:
- Runtime card translations
- Shared i18n systems
- Visual editor localization
- Exact override normalization
- Cross-card translation consistency

---

## 🎨 Unified Visual System

The **1.0.0** milestone introduced a much stronger design system:

- Shared visual tokens
- Unified shadows and surfaces
- Consistent chip styling
- Shared hover/selected states
- Shared animations
- Better tinting
- Improved gradients
- Consistent card spacing
- Better icon motion performance
- Shared popup language

---

## ⚡ Performance & Stability

Major internal improvements:

- Reduced unnecessary renders
- Better render signatures
- Shared i18n caching
- Safer persistence logic
- Smarter deduplication
- Optimized animation transforms
- Better mobile resize handling
- More resilient HA websocket handling
- Reduced visual flicker
- Improved cache-busting system

---

# 🧩 Included cards

- `custom:nodalia-navigation-bar`
- `custom:nodalia-media-player`
- `custom:nodalia-light-card`
- `custom:nodalia-fan-card`
- `custom:nodalia-humidifier-card`
- `custom:nodalia-circular-gauge-card`
- `custom:nodalia-graph-card`
- `custom:nodalia-power-flow-card`
- `custom:nodalia-climate-card`
- `custom:nodalia-alarm-panel-card`
- `custom:nodalia-advance-vacuum-card`
- `custom:nodalia-entity-card`
- `custom:nodalia-fav-card`
- `custom:nodalia-insignia-card`
- `custom:nodalia-person-card`
- `custom:nodalia-weather-card`
- `custom:nodalia-calendar-card`
- `custom:nodalia-notifications-card`
- `custom:nodalia-vacuum-card`

---

# 🛠️ Visual editors

All Nodalia cards include integrated visual editors designed to feel native inside Home Assistant.

Features include:

- Native Home Assistant selectors
- Minimal YAML generation
- Shared editor architecture
- Compact collapsible sections
- Integrated color pickers
- Entity pickers
- Shared translations
- Mobile-friendly editing
- Automatic default cleanup

Generated YAML stays intentionally minimal:
only values different from defaults are emitted.

---

# 📋 Example YAML

## Notifications Card

```yaml
type: custom:nodalia-notifications-card
calendar_entities:
  - calendar.home
weather_entities:
  - weather.home
fan_entities:
  - fan.living_room
vacuum_entities:
  - vacuum.robot
```

---

## Calendar Card

```yaml
type: custom:nodalia-calendar-card
calendars:
  - entity: calendar.home
```

---

## Advance Vacuum Card

```yaml
type: custom:nodalia-advance-vacuum-card
entity: vacuum.roborock
map_entity: camera.xiaomi_cloud_map_extractor
```

---

# 🚀 Installation

## HACS (recommended)

[![Open your Home Assistant instance and open this repository in the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=danielmigueltejedor&repository=nodalia-cards&category=plugin)

Open HACS → Frontend → search for **Nodalia Cards** → Download.

HACS automatically adds the Lovelace resource.

The main entrypoint is:

```text
/hacsfiles/nodalia-cards/nodalia-cards.js
```

No manual resource setup is normally required.

---

## Manual install

Copy:

```text
nodalia-cards.js
```

into:

```text
/config/www/
```

Then add a Lovelace resource:

```text
/local/nodalia-cards.js
```

Type:

```text
JavaScript module
```

---

# 🌍 Translations

**1.0.x** includes multi-language runtime and visual editor support.

Supported languages:

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

Translation improvements are ongoing.

---

# 🛣️ Roadmap

Future work planned on top of **1.0.x** (after the **1.0.0** milestone):

- Graph Card redesign
- Power Flow improvements
- More smart contextual systems
- Better tablet layouts
- More advanced popup systems
- Further animation polish
- Additional smart recommendations
- More editor consistency
- Long-term stability and optimization

---

# 🤝 Feedback & Contributions

Feedback, ideas, bug reports and contributions are always welcome.

If you find bugs or translation issues, please open an issue using the provided templates.

---

# 🙌 Community contributions

Special thanks to the community members helping improve Nodalia Cards through testing, ideas and feedback.

Special thanks to:

- [@Sppedtech](https://github.com/Sppedtech)

For contributing ideas and improvements to:
- Person Card
- Light Card
- UI consistency

---

# 🧑‍💻 Author

Daniel Miguel Tejedor

---

## 💰 Donations

https://paypal.me/DanielMiguelTejedor