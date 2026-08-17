<div align="center">
  <img src="https://raw.githubusercontent.com/danielmigueltejedor/nodalia-cards/main/docs/images/nodalia-cards-header.png" alt="Nodalia Cards" width="900">
  <p><strong>A cohesive, app-like card system for modern Home Assistant dashboards.</strong></p>

  <p>
    <a href="https://github.com/danielmigueltejedor/nodalia-cards/releases/latest"><img src="https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards?label=stable&sort=semver" alt="Latest stable release"></a>
    <a href="https://github.com/danielmigueltejedor/nodalia-cards/releases"><img src="https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards?include_prereleases&label=preview" alt="Latest preview release"></a>
    <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-41BDF5?logo=home-assistant&logoColor=white" alt="Home Assistant 2025.1 or newer">
    <img src="https://img.shields.io/badge/HACS-listing%20in%20progress-F59E0B" alt="Default HACS listing in progress">
    <a href="./LICENSE"><img src="https://img.shields.io/github/license/danielmigueltejedor/nodalia-cards" alt="MIT license"></a>
  </p>

  <p>
    <a href="#installation">Installation</a> ·
    <a href="#included-cards">Cards</a> ·
    <a href="#optional-companion-nodalia-cards-engine">Engine</a> ·
    <a href="#quick-start">Quick start</a> ·
    <a href="https://github.com/danielmigueltejedor/nodalia-cards/issues">Support</a> ·
    <a href="https://crowdin.com/project/nodalia-cards">Translate</a>
  </p>
</div>

---

Nodalia Cards is a custom Home Assistant frontend card suite built as one visual system rather than a collection of unrelated components. Shared design tokens, motion, interactions and editors give Home Assistant a polished, consistent experience across mobile, tablet and desktop.

> [!IMPORTANT]
> Inclusion in the default HACS catalogue is currently in progress. Until it is approved, install Nodalia Cards through HACS as a custom **Dashboard** repository using the steps below.

> [!TIP]
> **Nodalia Cards Engine is optional.** Install it when you want background notifications, shared dismissals, a notification inbox or native Climate schedules. The cards and visual editors continue to work without it.

## Preview

<p align="center">
  <img src="https://raw.githubusercontent.com/danielmigueltejedor/nodalia-cards/main/docs/gifs/animations1.optimized.gif" alt="Nodalia Cards dashboard interactions" width="45%">
  <img src="https://raw.githubusercontent.com/danielmigueltejedor/nodalia-cards/main/docs/gifs/animations2.optimized.gif" alt="Nodalia Cards animations and controls" width="45%">
</p>

## Why Nodalia

| Design | Experience | Integration |
|---|---|---|
| Shared visual language | Mobile-first layouts | Native Home Assistant selectors |
| Consistent spacing and surfaces | Smooth, purposeful motion | Integrated visual editors |
| Theme-aware colours | Tactile controls and haptics | Minimal generated YAML |
| Cohesive popup system | Responsive cards and dialogs | Context-aware entities and services |

The suite is designed for real daily dashboards: one interaction model, predictable configuration and a consistent finish across every card.

## Included cards

| Everyday controls | Insight and context | Spaces and navigation |
|---|---|---|
| Light | Circular Gauge | Navigation Bar |
| Fan | Graph | Room Summary |
| Humidifier | Power Flow | Person |
| Cover | Weather | Scenes |
| Climate | Calendar | Favourites |
| Alarm Panel | Notifications | Insignia |
| Media Player | News | Entity |
| Vacuum | Camera | Advanced Vacuum |

Every card is registered with the `custom:nodalia-…` prefix. The complete set currently includes:

<details>
<summary><strong>Show all custom element names</strong></summary>

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
- `custom:nodalia-scenes-card`
- `custom:nodalia-weather-card`
- `custom:nodalia-calendar-card`
- `custom:nodalia-notifications-card`
- `custom:nodalia-vacuum-card`
- `custom:nodalia-news-card`
- `custom:nodalia-camera-card`
- `custom:nodalia-room-summary-card`

</details>

## Visual editors

All Nodalia cards include a visual editor designed to fit naturally into Home Assistant:

- native entity selectors and colour pickers
- compact, collapsible configuration sections
- shared translations and editor behaviour
- responsive previews
- automatic removal of default values

Only settings that differ from the defaults are written to YAML, keeping dashboard configuration readable and portable.

## Installation

### HACS custom Dashboard — recommended

Until the default HACS listing is approved:

1. Open **HACS**.
2. Open the three-dot menu and choose **Custom repositories**.
3. Add `https://github.com/danielmigueltejedor/nodalia-cards`.
4. Select category **Dashboard**.
5. Open **Nodalia Cards** and choose **Download**.
6. Reload your browser (or perform a hard refresh).

[![Open Nodalia in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=danielmigueltejedor&repository=nodalia-cards&category=plugin)

If a card does not appear immediately after installation or an update, perform a hard refresh or clear the Home Assistant frontend cache.

```text
/hacsfiles/nodalia-cards/nodalia-cards.js
```

That single file includes both the cards and their visual editors. Existing Dashboard installations continue to work without changing card YAML or migrating to an integration.

### Optional companion: Nodalia Cards Engine

Nodalia Cards Engine is a separate HACS **Integration** that runs advanced features inside Home Assistant even when no dashboard is open. Stable Engine `2.0.1` is the recommended companion for Nodalia Cards `2.2.0-alpha.2`.

[![Add Nodalia Cards Engine to HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=danielmigueltejedor&repository=nodalia-cards-engine&category=integration)

After opening the repository:

1. Download **Nodalia Cards Engine** in HACS.
2. Restart Home Assistant.
3. Open **Settings → Devices & services → Add integration**.
4. Search for **Nodalia Cards Engine**, complete setup and reload the browser once.

The Engine does not replace `/hacsfiles/nodalia-cards/nodalia-cards.js` and does not require dashboard YAML changes. See the [Cards + Engine guide](./docs/nodalia-integration.md) for compatibility, migration and recovery details.

### Manual installation

1. Download `nodalia-cards.js` from the [latest GitHub release](https://github.com/danielmigueltejedor/nodalia-cards/releases/latest) and copy it to `/config/www/`.
2. Add it as a Lovelace resource:

```text
URL: /local/nodalia-cards.js
Type: module
```

3. Reload your browser.

### Updating to 2.1.2

- Update Nodalia Cards from HACS and perform a hard browser refresh so the self-contained `nodalia-cards.js` resource is replaced in the frontend cache.
- Existing card YAML and Lovelace resources remain compatible; no Dashboard-to-Integration migration is required.
- If you use the optional Engine, keep it on stable `2.0.1`, restart Home Assistant after installing or updating it, and confirm the editor shows **Engine active**.
- Climate `heat_cool` holds preserve both low and high setpoints, and Engine inbox dismissals now match the corresponding foreground comfort, humidity, door, window, motion, vacuum, rain, media and outdoor alerts.

## Quick start

Add a card through the dashboard visual editor, or start with one of these minimal examples.

### Light

```yaml
type: custom:nodalia-light-card
entity: light.living_room
```

### Calendar

```yaml
type: custom:nodalia-calendar-card
calendars:
  - entity: calendar.home
```

### Advanced vacuum

```yaml
type: custom:nodalia-advance-vacuum-card
entity: vacuum.roborock
map_source:
  image: image.roborock_map
calibration_source:
  camera: true
```

## Advanced guides

| Feature | Documentation |
|---|---|
| Nodalia Cards Engine | [Installation, compatibility and migration](./docs/nodalia-integration.md) |
| Climate setpoint scheduling | [Native weekly schedules](./docs/climate-setpoint-schedule.md) |
| Advanced Vacuum compatibility | [Platforms, live room tracking and fallbacks](./docs/cards/advanced-vacuum-card.md) |
| News Card | [Layouts, sources and configuration](./docs/cards/news-card.md) |
| Shared styling | [Theme variables and card-mod reference](./docs/STYLING.md) |
| Background mobile notifications | [Native delivery and legacy fallback](./docs/nodalia-integration.md#background-mobile-notifications) |
| Translations | [Contributor guide](./docs/TRANSLATIONS.md) |

## Release channels

| Maturity | Branch / tag | Intended use |
|---|---|---|
| Stable | `main`, `vX.Y.Z` | Recommended for daily dashboards |
| Release candidate | `vX.Y.Z-rc.N` | Final compatibility and release validation |
| Beta | `beta`, `vX.Y.Z-beta.N` | Feature-complete preview for broader testing |
| Alpha | `alpha`, `vX.Y.Z-alpha.N` | Active development; breaking changes are possible |

HACS installs the latest stable release by default. To test a prerelease, open Nodalia Cards in HACS, choose **Redownload → Need a different version?**, and select the desired alpha, beta or RC tag.

Stable changes are documented in the [changelog](./CHANGELOG.md). Detailed prerelease notes live in [CHANGELOG-PRERELEASES.md](./CHANGELOG-PRERELEASES.md), and longer-term work is tracked in the [roadmap](./ROADMAP.md).

## Translations

Nodalia Cards currently includes Spanish, English, German, French, Italian, Dutch, Norwegian, Portuguese, Russian, Greek, Chinese and Romanian.

Help review or extend the project on [Crowdin](https://crowdin.com/project/nodalia-cards). Translation pull requests are also welcome; follow the [translation guide](./docs/TRANSLATIONS.md) to keep runtime and editor strings synchronized.

## Support and contributions

- Use [GitHub Issues](https://github.com/danielmigueltejedor/nodalia-cards/issues) for reproducible bugs and focused feature requests.
- Use the [Engine issue tracker](https://github.com/danielmigueltejedor/nodalia-cards-engine/issues) for integration setup, background execution or Engine diagnostics problems.
- Include the Home Assistant version, Nodalia Cards version, browser, relevant YAML and screenshots when reporting a visual problem.
- Read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting code or translations.
- Never publish tokens, webhook secrets or private entity data.

Thanks to every tester, translator and contributor helping make the suite more useful, especially [@Sppedtech](https://github.com/Sppedtech), [@flippedcracker](https://github.com/flippedcracker), [@loicloiseau](https://github.com/loicloiseau), [@pqpxo](https://github.com/pqpxo), [@jjanssen95](https://github.com/jjanssen95), [@alfonsoluna](https://github.com/alfonsoluna), [@Scraft08YT](https://github.com/Scraft08YT) and [@ryatesKT](https://github.com/ryatesKT).

## License

Nodalia Cards is released under the [MIT License](./LICENSE).

<div align="center">
  <sub>Designed and maintained by <a href="https://github.com/danielmigueltejedor">Daniel Miguel Tejedor</a>.</sub>
  <br><br>
  <a href="https://buymeacoffee.com/danielmigueltejedor"><img src="https://img.shields.io/badge/Support%20the%20project-Buy%20Me%20a%20Coffee-FFDD00?logo=buymeacoffee&logoColor=000" alt="Support Nodalia Cards on Buy Me a Coffee"></a>
</div>
