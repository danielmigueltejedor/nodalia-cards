# 🎨 Nodalia Cards

![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2025.1%2B-41BDF5?logo=home-assistant)

![Package](https://img.shields.io/badge/package-1.1.1--alpha.6-fbca04)
![Prerelease channel](https://img.shields.io/badge/prerelease%20channel-1.1.1--alpha.6-fbca04)
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

# 🚀 What’s new in 1.1.x

**This branch tracks prerelease `1.1.1-alpha.9`** — match **`package.json`**, **`hacs.json`**, **`nodalia-cards.manifest.js`**, **`nodalia-cards-1.1.1-alpha.9.js`**, and **`window.__NODALIA_BUNDLE__.pkgVersion`**. The sections below summarize the **`1.0.0`** milestone and newer cards; release notes are in [`CHANGELOG.md`](./CHANGELOG.md).

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

**Community translations (Crowdin):** help translate or review strings in the public project **[Nodalia Cards on Crowdin](https://crowdin.com/project/nodalia-cards)** (syncs with `i18n/runtime` and `i18n/editor` via [`crowdin.yml`](./crowdin.yml)).

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
- `custom:nodalia-cover-card`
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
/hacsfiles/nodalia-cards/nodalia-cards-1.1.1-alpha.9.js
```

HACS uses the versioned entrypoint so each update gets a fresh Lovelace resource URL. The unversioned `nodalia-cards.js` file remains a self-contained fallback for direct/manual use.

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

**1.1.x** continues improving the multi-language runtime and visual editor support introduced in **1.0.x**.

**[Translate on Crowdin →](https://crowdin.com/project/nodalia-cards)** — community workspace for runtime and visual-editor strings (see also [`docs/TRANSLATIONS.md`](./docs/TRANSLATIONS.md) and [`crowdin.yml`](./crowdin.yml)).

Supported languages:

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

Translation improvements are ongoing.

Translation PRs are welcome. See the step-by-step contributor guide in [`docs/TRANSLATIONS.md`](./docs/TRANSLATIONS.md).

---

# 🎨 Styling and theme

To reuse Nodalia’s look (radii, HA theme variables, chips, sliders) on **other** cards via **card-mod** or YAML, see the consolidated reference in [`docs/STYLING.md`](./docs/STYLING.md).

---

# 🛣️ Roadmap

Future work planned on top of **1.1.x**:

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

# ☕ Support

If Nodalia Cards makes your dashboard nicer, you can support the project here:

[Buy Me a Coffee](https://buymeacoffee.com/danielmigueltejedor)

---

# 🙌 Community contributions

Special thanks to the community members helping improve Nodalia Cards through testing, ideas and feedback.

Special thanks to:

- [@Sppedtech](https://github.com/Sppedtech)
- [@flippedcracker](https://github.com/flippedcracker)
- [@loicloiseau](https://github.com/loicloiseau)

For contributing ideas and improvements to:
- Person Card
- Light Card
- UI consistency

---

# 🧑‍💻 Author

Daniel Miguel Tejedor

---

## 💰 Donations

https://buymeacoffee.com/danielmigueltejedor

https://paypal.me/DanielMiguelTejedor
