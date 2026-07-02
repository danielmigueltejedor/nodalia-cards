# 🎨 Nodalia Cards

![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2025.1%2B-41BDF5?logo=home-assistant)
![Package](https://img.shields.io/badge/package-1.3.5-alpha.7-2ea44f)
![Release channel](https://img.shields.io/badge/release%20channel-alpha-f59e0b)
![Stable](https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards?label=stable)
![Pre-release](https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards?include_prereleases&label=pre-release)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![GitHub](https://img.shields.io/badge/hosted%20on-GitHub-black?logo=github)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-ffdd00?logo=buymeacoffee&logoColor=000)](https://buymeacoffee.com/danielmigueltejedor)

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

# 🚀 What’s new in 1.3.5-alpha.7

**Current alpha `1.3.5-alpha.7`** — install/update through HACS using **`nodalia-cards.js`**. This prerelease keeps the Notifications mobile controls from alpha.4 and makes the visual editor scroll clamp cross Home Assistant shadow roots, so it reaches the real Lovelace dialog scroll containers instead of only the card editor element. Stable release notes: [`CHANGELOG.md`](./CHANGELOG.md); alpha history: [`CHANGELOG-PRERELEASES.md`](./CHANGELOG-PRERELEASES.md).

### Calendar and Weather fixes

- Calendar expanded popups keep the day/week/month view even when there are no events.
- Calendar weather badges map forecast days across month boundaries correctly, including end-of-month forecasts into the next month.
- Weather condition and metric icons keep readable contrast on tinted cards.

### Notifications background delivery

- Background mobile sync sends configured entities, thresholds, targets, and override text through the Home Assistant package.
- The example package filters watched entities before pushing, avoids duplicate foreground/background delivery, and only sends numeric threshold alerts when crossing into the alert range.
- The visual editor exposes the minimum mobile severity so info-level alerts can be enabled when desired.
- Per-entity overrides can now silence mobile pushes for noisy entities while keeping the alert visible in the card.
- The visual editor no longer leaves extra empty scroll space below the final settings section.

### Mobile visual polish

- Graph legend chips avoid clipped iOS shadows in horizontal scroll rails.
- Navigation media titles ellipsize cleanly before the “playing” chip on mobile.
- Light Card icons use a contrast-safe color mix based on the current light color.

---

# 📦 Stable 1.3.0 foundation

**Stable release `1.3.0`** — **`nodalia-cards-1.3.0.js`** introduced the News Card and the broader 1.3.x foundation. Full release notes: [`CHANGELOG.md`](./CHANGELOG.md).

## 🗞️ News Card

New **`custom:nodalia-news-card`** for Home Assistant entities that expose headline attributes:

- Simple, compact, and magazine layouts
- Source filtering, safe URL handling, and render-failure guards
- Shared helper history for consistent headlines across clients
- Real feedreader package example in [`examples/nodalia-news-real-package.yaml`](./examples/nodalia-news-real-package.yaml)

---

## 🧩 Entity Card select support

- Inline `select` / `input_select` picker inside the Entity Card
- Immediate press haptics for body, icon, quick actions, and picker controls
- Safer cover/lock domain services and Lovelace action preservation
- Entity pictures in the main icon bubble

---

## 🌡️ Climate schedule compatibility

- Path-B-compatible setpoint schedule storage prefers compact **v1/v2** payloads when they fit `input_text`
- Quarter-degree setpoints are preserved without forcing binary **v3** storage for smaller schedules
- Schedule docs and examples remain in [`docs/climate-setpoint-schedule.md`](./docs/climate-setpoint-schedule.md)

---

## ✨ Stability and polish

- Circular Gauge entrance animation uses one smooth progress arc
- Power Flow home popup bubble keeps the intended square aspect ratio
- Alarm PIN gating, media-player disconnect guards, deferred timer cleanup, and broad regression coverage

---

# 📦 Earlier milestones (1.0.x / 1.1.x)

The sections below summarize the **`1.0.0`** / **`1.1.x`** milestones.

## 🧠 Notifications Card

A completely new smart notification center for Home Assistant dashboards.

Features include:

- Expandable stacked notification UI
- Persistent dismiss system
- Smart contextual recommendations
- Dashboard-driven mobile notification delivery
- Calendar integrations
- Vacuum / weather / humidity intelligence
- Entity-specific overrides
- Critical mobile alerts
- Visual editor support
- Animated transitions and compact mode

Mobile delivery from the card runs in the Home Assistant frontend by default, so
it needs a browser/session with the card loaded. For push notifications that
must fire when no one is viewing Lovelace, enable the background webhook sync and
paste the Home Assistant package in
[`examples/notifications-background-mobile-package.yaml`](./examples/notifications-background-mobile-package.yaml).

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
- `custom:nodalia-climate-card` — weekly setpoint schedule via webhook: [`docs/climate-setpoint-schedule.md`](./docs/climate-setpoint-schedule.md)
- `custom:nodalia-alarm-panel-card`
- `custom:nodalia-advance-vacuum-card`
- `custom:nodalia-entity-card`
- `custom:nodalia-fav-card`
- `custom:nodalia-insignia-card`
- `custom:nodalia-person-card`
- `custom:nodalia-scenes-card`
- `custom:nodalia-weather-card`
- `custom:nodalia-calendar-card`
- `custom:nodalia-notifications-card`
- `custom:nodalia-vacuum-card`
- `custom:nodalia-news-card` — [`docs/cards/news-card.md`](./docs/cards/news-card.md)

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
temperature_entities:
  - sensor.living_room_temperature
outdoor_temperature_entities:
  - sensor.outdoor_temperature
mobile_notifications:
  enabled: true
  entities:
    - notify.iphone_de_daniel
    - notify.iphone_de_angelica
    - notify.samsung_s23_de_papa
background_mobile:
  enabled: true
  webhook: nodalia_notifications_background_sync
```

The card mirrors these alerts visually and can send mobile notifications while
the dashboard is loaded. With `background_mobile.enabled`, it also syncs its
configured alert entities, thresholds, and `mobile_notifications.entities` to
Home Assistant by webhook so the package can send push notifications in the
background without duplicating notify targets in the automation YAML. Start from
[`examples/notifications-background-mobile-package.yaml`](./examples/notifications-background-mobile-package.yaml).

For comfort alerts, use indoor temperature/humidity entities for house
recommendations. Outdoor temperature/humidity entities are kept separate so an
outside cold morning does not trigger an indoor low-temperature alert.

---

## Calendar Card

```yaml
type: custom:nodalia-calendar-card
calendars:
  - entity: calendar.home
```

---

## Climate Card (setpoint schedule)

Weekly consignas from the dashboard — copy the examples and replace the `YOUR_*` placeholders:

| Placeholder | Example |
|-------------|---------|
| `YOUR_CLIMATE_ENTITY` | `climate.living_room` |
| `YOUR_ROOM` | `living_room` |
| `WEBHOOK_ID` | `nodalia_climate_setpoint_schedule` |

```yaml
type: custom:nodalia-climate-card
entity: climate.YOUR_CLIMATE_ENTITY
show_schedule_button: true
setpoint_schedule_webhook: nodalia_climate_setpoint_schedule
setpoint_schedule_helper: input_text.nodalia_climate_schedule_YOUR_ROOM
security:
  allow_webhooks_for_non_admin: true
```

**Setup (5 steps):** **[`docs/climate-setpoint-schedule.md`](./docs/climate-setpoint-schedule.md)** — helpers, webhook (once), Path B apply (per room). Examples: [`examples/climate-setpoint-schedule-*.yaml`](./examples/).

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

HACS uses the stable `nodalia-cards.js` entrypoint and the bundle reports its loaded version in `window.__NODALIA_BUNDLE__`. Compatibility aliases are also shipped for older versioned resource URLs.

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

# 🙌 Community contributions

Special thanks to the community members helping improve Nodalia Cards through testing, ideas and feedback.

Special thanks to:

- [@Sppedtech](https://github.com/Sppedtech)
- [@flippedcracker](https://github.com/flippedcracker)
- [@loicloiseau](https://github.com/loicloiseau)
- [@pqpxo](https://github.com/pqpxo)
- [@jjanssen95](https://github.com/jjanssen95)
- [@alfonsoluna](https://github.com/alfonsoluna)
- [@Scraft08YT](https://github.com/Scraft08YT)
- [@ryatesKT](https://github.com/ryatesKT)

For contributing ideas and improvements to:
- Person Card
- Light Card
- UI consistency

---

# 🧑‍💻 Author

Daniel Miguel Tejedor

---
