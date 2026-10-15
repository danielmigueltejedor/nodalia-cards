<div align="center">

<img src="https://raw.githubusercontent.com/danielmigueltejedor/nodalia-cards/main/docs/images/nodalia-cards-logo-trimmed.png" alt="Nodalia Cards" width="480">

<br>

### A unified card experience for Home Assistant.

A collection of **25 customizable cards** bringing consistency, intuitive interactions and a cohesive design to your smart home dashboards.

<br>

[![Release](https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards?style=flat-square&label=Release&labelColor=242938&color=22C55E&logo=git&logoColor=white)](https://github.com/danielmigueltejedor/nodalia-cards/releases/latest)
[![HACS](https://img.shields.io/badge/HACS-Default-18B4F9?style=flat-square&labelColor=242938&logo=homeassistant&logoColor=white)](https://my.home-assistant.io/redirect/hacs_repository/?owner=danielmigueltejedor&repository=nodalia-cards&category=plugin)
[![Downloads](https://img.shields.io/github/downloads/danielmigueltejedor/nodalia-cards/total?style=flat-square&label=Downloads&labelColor=242938&color=8B5CF6&logo=github&logoColor=white)](https://github.com/danielmigueltejedor/nodalia-cards/releases)
[![Stars](https://img.shields.io/github/stars/danielmigueltejedor/nodalia-cards?style=flat-square&label=Stars&labelColor=242938&color=F59E0B&logo=starship&logoColor=white)](https://github.com/danielmigueltejedor/nodalia-cards/stargazers)
[![License](https://img.shields.io/github/license/danielmigueltejedor/nodalia-cards?style=flat-square&label=License&labelColor=242938&color=14B8A6&logo=opensourceinitiative&logoColor=white)](LICENSE)
[![Translations](https://img.shields.io/badge/Translations-Weblate-EC4899?style=flat-square&labelColor=242938&logo=weblate&logoColor=white)](https://translate.getnodalia.com)

<br>

[**Overview**](#overview) ·
[**Cards**](#cards) ·
[**Installation**](#installation) ·
[**Documentation**](#documentation) ·
[**Engine**](#nodalia-cards-engine) ·
[**Contributing**](#contributing)

</div>

---

## Overview

**Nodalia Cards** is a custom frontend card suite for [Home Assistant](https://www.home-assistant.io/), designed as a single, cohesive interface rather than a collection of unrelated components.

Every card shares the same design language, interaction patterns and configuration experience, making it easier to build consistent dashboards across desktop, tablet and mobile.

The project combines modern interface design with native Home Assistant functionality, without compromising flexibility or compatibility.

### Highlights

- **Unified design system** — Consistent typography, spacing, surfaces, colors and interactions.
- **25 custom cards** — A complete collection for device control, monitoring and navigation.
- **Visual configuration** — Built-in editors with native Home Assistant selectors.
- **Responsive by design** — Optimized for desktop, tablet and mobile dashboards.
- **Theme-aware styling** — Adapts to Home Assistant themes and custom design tokens.
- **Smooth interactions** — Purposeful animations, responsive controls and tactile feedback.
- **Native integration** — Built around Home Assistant entities, services and state management.
- **Optional backend** — Extend functionality with Nodalia Cards Engine.

All cards work independently of the Engine.

## Preview

<div align="center">

<img src="https://raw.githubusercontent.com/danielmigueltejedor/nodalia-cards/main/docs/gifs/animations1.optimized.gif" alt="Nodalia Cards dashboard interactions" width="48%">
<img src="https://raw.githubusercontent.com/danielmigueltejedor/nodalia-cards/main/docs/gifs/animations2.optimized.gif" alt="Nodalia Cards animations and controls" width="48%">

</div>

## Cards

Nodalia includes **25 cards** covering everyday controls, monitoring, information and dashboard navigation.

| Device Controls | Monitoring & Information | Dashboard & Navigation |
| :--- | :--- | :--- |
| Light | Graph | Navigation Bar |
| Climate | Circular Gauge | Room Summary |
| Fan | Power Flow | Favourites |
| Humidifier | Weather | Scenes |
| Cover | Calendar | Person |
| Lock | News | Insignia |
| Alarm Panel | Camera | Entity |
| Media Player | Notifications | |
| Vacuum | | |
| Advanced Vacuum | | |

All cards include a visual configuration editor and use the `custom:nodalia-` prefix.

<details>
<summary><strong>Explore all 25 cards</strong></summary>

<br>

| Card | Custom Element | Documentation |
| :--- | :--- | :--- |
| Navigation Bar | `custom:nodalia-navigation-bar` | [Guide](docs/cards/navigation-card.md) |
| Media Player | `custom:nodalia-media-player` | [Guide](docs/cards/media-player-card.md) |
| Light | `custom:nodalia-light-card` | [Guide](docs/cards/light-card.md) |
| Fan | `custom:nodalia-fan-card` | [Guide](docs/cards/fan-card.md) |
| Humidifier | `custom:nodalia-humidifier-card` | [Guide](docs/cards/humidifier-card.md) |
| Circular Gauge | `custom:nodalia-circular-gauge-card` | [Guide](docs/cards/circular-gauge-card.md) |
| Graph | `custom:nodalia-graph-card` | [Guide](docs/cards/graph-card.md) |
| Power Flow | `custom:nodalia-power-flow-card` | [Guide](docs/cards/power-flow-card.md) |
| Cover | `custom:nodalia-cover-card` | [Guide](docs/cards/cover-card.md) |
| Climate | `custom:nodalia-climate-card` | — |
| Alarm Panel | `custom:nodalia-alarm-panel-card` | — |
| Lock | `custom:nodalia-lock-card` | [Guide](docs/cards/lock-card.md) |
| Advanced Vacuum | `custom:nodalia-advance-vacuum-card` | [Guide](docs/cards/advanced-vacuum-card.md) |
| Entity | `custom:nodalia-entity-card` | [Guide](docs/cards/entity-card.md) |
| Favourites | `custom:nodalia-fav-card` | [Guide](docs/cards/fav-card.md) |
| Insignia | `custom:nodalia-insignia-card` | [Guide](docs/cards/insignia-card.md) |
| Person | `custom:nodalia-person-card` | [Guide](docs/cards/person-card.md) |
| Scenes | `custom:nodalia-scenes-card` | [Guide](docs/cards/scenes-card.md) |
| Weather | `custom:nodalia-weather-card` | [Guide](docs/cards/weather-card.md) |
| Calendar | `custom:nodalia-calendar-card` | [Guide](docs/cards/calendar-card.md) |
| Notifications | `custom:nodalia-notifications-card` | [Guide](docs/cards/notifications-card.md) |
| Vacuum | `custom:nodalia-vacuum-card` | [Guide](docs/cards/vacuum-card.md) |
| News | `custom:nodalia-news-card` | [Guide](docs/cards/news-card.md) |
| Camera | `custom:nodalia-camera-card` | [Guide](docs/cards/camera-card.md) |
| Room Summary | `custom:nodalia-room-summary-card` | [Guide](docs/cards/room-summary-card.md) |

</details>

## Installation

Nodalia Cards is available directly from the official HACS catalog.

**No custom repository configuration is required.**

### HACS — Recommended

1. Open **HACS** in Home Assistant.
2. Search for **Nodalia Cards** under **Dashboard**.
3. Select **Download**.
4. Refresh your browser.

[![Open in HACS](https://img.shields.io/badge/Open_in-HACS-18B4F9?style=flat-square&labelColor=242938&logo=homeassistant&logoColor=white)](https://my.home-assistant.io/redirect/hacs_repository/?owner=danielmigueltejedor&repository=nodalia-cards&category=plugin)

HACS automatically installs the following resource:

```text
/hacsfiles/nodalia-cards/nodalia-cards.js
```

This single bundle contains all 25 cards and their visual editors.

Existing installations continue to work without modifying their YAML configuration.

### Manual Installation

1. Download `nodalia-cards.js` from the [latest release](https://github.com/danielmigueltejedor/nodalia-cards/releases/latest).
2. Copy the file to `/config/www/`.
3. Add the following Lovelace resource:

```text
URL: /local/nodalia-cards.js
Type: module
```

4. Refresh your browser.

### Requirements

- Home Assistant **2025.1 or newer**.
- A supported modern browser.
- Custom dashboard resources enabled.

### Updating

Update Nodalia Cards through HACS and perform a browser refresh to ensure the latest frontend bundle is loaded.

If the previous version remains cached, perform a hard refresh or clear the Home Assistant frontend cache.

Existing card YAML, custom element names and resource paths remain compatible with the 3.x series.

For major-version migration details, see the [upgrade guide](docs/upgrading-to-3.md).

## Quick Start

Cards can be added directly through the Home Assistant visual dashboard editor.

For manual configuration, use the following examples.

### Light

```yaml
type: custom:nodalia-light-card
entity: light.living_room
```

### Climate

```yaml
type: custom:nodalia-climate-card
entity: climate.living_room
```

### Lock

```yaml
type: custom:nodalia-lock-card
entity: lock.front_door
layout: standard
```

The Lock Card uses an intentional drag-to-unlock interaction rather than unlocking with a simple tap.

See the [Lock Card documentation](docs/cards/lock-card.md) for details.

### Calendar

```yaml
type: custom:nodalia-calendar-card
calendars:
  - entity: calendar.home
```

### Advanced Vacuum

```yaml
type: custom:nodalia-advance-vacuum-card
entity: vacuum.roborock
map_source:
  image: image.roborock_map
calibration_source:
  camera: true
```

### Circular Device Layout

Fan, Humidifier and Cover cards support an optional circular layout.

```yaml
type: custom:nodalia-fan-card
entity: fan.living_room
layout: circular
```

Climate supports a compact layout as an alternative to its default circular interface.

Read the [device layout guide](docs/cards/device-climate-layouts.md) for additional information.

## Visual Editors

Every Nodalia card includes a visual editor designed to integrate naturally with Home Assistant.

Features include:

- Native entity and device selectors.
- Integrated color pickers.
- Collapsible configuration sections.
- Responsive previews.
- Shared translation support.
- Consistent controls and editor behavior.
- Automatic removal of default configuration values.

Only settings that differ from their defaults are written to YAML, keeping configurations readable, portable and easy to maintain.

## Nodalia Cards Engine

[![Engine](https://img.shields.io/badge/Engine-Optional-6366F1?style=flat-square&labelColor=242938&logo=homeassistant&logoColor=white)](https://github.com/danielmigueltejedor/nodalia-cards-engine)
[![Engine Release](https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards-engine?style=flat-square&label=Release&labelColor=242938&color=22C55E&logo=git&logoColor=white)](https://github.com/danielmigueltejedor/nodalia-cards-engine/releases/latest)

**Nodalia Cards Engine** is an optional Home Assistant integration that extends Nodalia beyond the frontend.

Unlike dashboard cards, the Engine can execute features in the background, even when no dashboard is open.

### Features

- Background notifications.
- Persistent notification inbox.
- Shared notification dismissals.
- Native climate scheduling.
- Background event processing.

The Engine operates alongside Nodalia Cards without replacing its frontend resources.

### Installation

Install the Engine separately through HACS.

[![Install Engine](https://img.shields.io/badge/Install_Engine-HACS-18B4F9?style=flat-square&labelColor=242938&logo=homeassistant&logoColor=white)](https://my.home-assistant.io/redirect/hacs_repository/?owner=danielmigueltejedor&repository=nodalia-cards-engine&category=integration)

After installation:

1. Restart Home Assistant.
2. Open **Settings → Devices & services**.
3. Select **Add integration**.
4. Search for **Nodalia Cards Engine**.
5. Complete setup and refresh your browser.

Engine `3.0.0` is the recommended companion for the Nodalia Cards 3.0.x series.

Existing Cards API 1/2 commands and Engine `2.0.2` remain compatible.

For details, see the [Cards + Engine integration guide](docs/nodalia-integration.md).

## Architecture

Nodalia Cards follows a shared frontend architecture built around reusable components and a consistent design system.

### Frontend

The 3.x series completes the migration to strict TypeScript across all 25 cards, visual editors and shared runtimes.

The architecture emphasizes:

- Shared design tokens and styling.
- Reusable frontend components.
- Consistent interaction patterns.
- Centralized state and lifecycle handling.
- Native Home Assistant integration.
- Compatibility across supported browsers.
- Modular card development.

### Optional Backend

Nodalia Cards Engine provides additional functionality through a separate Home Assistant integration.

The frontend remains fully functional without the Engine, allowing users to choose the capabilities they need.

## Documentation

Detailed guides are available for individual cards, advanced configuration and integrations.

| Topic | Documentation |
| :--- | :--- |
| Cards | [Card documentation](docs/cards/) |
| Nodalia Cards Engine | [Integration guide](docs/nodalia-integration.md) |
| Climate scheduling | [Native weekly schedules](docs/climate-setpoint-schedule.md) |
| Advanced Vacuum | [Compatibility and configuration](docs/cards/advanced-vacuum-card.md) |
| Power Flow | [Sources and diagram behavior](docs/cards/power-flow-card.md) |
| Graph | [History sources and sampling](docs/cards/graph-card.md) |
| Lock | [Controls and configuration](docs/cards/lock-card.md) |
| Notifications | [Notification rules and delivery](docs/cards/notifications-card.md) |
| Device layouts | [Compact and circular layouts](docs/cards/device-climate-layouts.md) |
| Styling | [Theme variables and customization](docs/STYLING.md) |
| Translations | [Translation guide](docs/TRANSLATIONS.md) |
| Upgrading to 3.x | [Migration guide](docs/upgrading-to-3.md) |
| Changelog | [Release history](CHANGELOG.md) |
| Roadmap | [Planned development](ROADMAP.md) |

## Releases

Nodalia Cards follows semantic versioning with separate development and stable release channels.

| Channel | Version Format | Purpose |
| :--- | :--- | :--- |
| Stable | `vX.Y.Z` | Recommended for everyday use |
| Release Candidate | `vX.Y.Z-rc.N` | Final release validation |
| Beta | `vX.Y.Z-beta.N` | Feature-complete testing |
| Alpha | `vX.Y.Z-alpha.N` | Active development |

Stable releases are installed by default through HACS.

Prerelease versions can be selected manually through **Redownload → Need a different version?**.

### Version 3

The 3.x series introduces a fully TypeScript-based frontend architecture while maintaining compatibility with existing dashboard configurations.

Key improvements include:

- Strict TypeScript migration across all cards and editors.
- Shared runtime and lifecycle improvements.
- More consistent controls and interactions.
- Improved keyboard accessibility.
- Refined rendering and responsive layouts.
- Visual consistency across the entire card collection.

**Version 3.0.3** additionally introduces improvements to Favourites Card interactions, keyboard focus handling and dashboard rendering.

For the complete history, see:

- [Stable changelog](CHANGELOG.md)
- [Prerelease changelog](CHANGELOG-PRERELEASES.md)
- [Roadmap](ROADMAP.md)

[![Latest Release](https://img.shields.io/badge/View-Latest_Release-22C55E?style=flat-square&labelColor=242938&logo=github&logoColor=white)](https://github.com/danielmigueltejedor/nodalia-cards/releases/latest)

## Translations

Nodalia Cards is available in multiple languages thanks to community contributions.

Currently supported languages include:

English, Spanish, German, French, Italian, Dutch, Norwegian, Portuguese, Russian, Greek, Chinese and Romanian.

Translations are managed through a self-hosted Weblate instance.

[![Weblate](https://img.shields.io/badge/Translate_on-Weblate-EC4899?style=flat-square&labelColor=242938&logo=weblate&logoColor=white)](https://translate.getnodalia.com)

GitHub remains the source repository, and translated locale files are included in the frontend build.

Translation pull requests are also welcome.

See the [translation contribution guide](docs/TRANSLATIONS.md) for more information.

## Contributing

Nodalia Cards is an open-source project, and contributions are welcome.

Whether you're fixing bugs, improving existing cards, translating the interface or proposing new features, your contribution helps make Nodalia better.

Before submitting code, please read [CONTRIBUTING.md](CONTRIBUTING.md).

### Get Involved

- [Report a bug](https://github.com/danielmigueltejedor/nodalia-cards/issues)
- [Request a feature](https://github.com/danielmigueltejedor/nodalia-cards/issues)
- [Browse pull requests](https://github.com/danielmigueltejedor/nodalia-cards/pulls)
- [View the roadmap](ROADMAP.md)
- [Help translate](https://translate.getnodalia.com)

For Engine-specific problems, use the [Engine issue tracker](https://github.com/danielmigueltejedor/nodalia-cards-engine/issues).

When reporting visual issues, include your Home Assistant version, Nodalia Cards version, browser, relevant YAML configuration and screenshots.

Never include authentication tokens or sensitive entity data in public reports.

### Contributors

Special thanks to everyone who has contributed code, translations, testing and feedback.

Including:

[@Sppedtech](https://github.com/Sppedtech) ·
[@flippedcracker](https://github.com/flippedcracker) ·
[@loicloiseau](https://github.com/loicloiseau) ·
[@pqpxo](https://github.com/pqpxo) ·
[@jjanssen95](https://github.com/jjanssen95) ·
[@alfonsoluna](https://github.com/alfonsoluna) ·
[@Scraft08YT](https://github.com/Scraft08YT) ·
[@ryatesKT](https://github.com/ryatesKT)

## License

Nodalia Cards is distributed under the [MIT License](LICENSE).

---

<div align="center">

**Nodalia Cards**

Designed and maintained by [Daniel Miguel Tejedor](https://github.com/danielmigueltejedor).

Built with the support of the Home Assistant community.

<br>

[![GitHub](https://img.shields.io/badge/GitHub-Repository-64748B?style=flat-square&labelColor=242938&logo=github&logoColor=white)](https://github.com/danielmigueltejedor/nodalia-cards)
[![Support](https://img.shields.io/badge/Support-Buy_Me_a_Coffee-F59E0B?style=flat-square&labelColor=242938&logo=buymeacoffee&logoColor=white)](https://buymeacoffee.com/danielmigueltejedor)

</div>
