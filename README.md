# 🎨 Nodalia Cards

![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2025.1%2B-41BDF5?logo=home-assistant)
![Latest stable](https://img.shields.io/badge/latest%20stable-0.6.1-2ea043)
![Stable](https://img.shields.io/github/v/release/danielmigueltejedor/nodalia-cards?label=stable)
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
- custom:nodalia-notifications-card  
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
| **Calendar** | `custom:nodalia-calendar-card` | Multi-calendar agenda + native events |
| Notifications | `custom:nodalia-notifications-card` | Smart notification center + actions |
| Vacuum | `custom:nodalia-vacuum-card` | Vacuum controls without advance map |

Use each card’s **visual editor** to discover fields; the YAML will stay minimal when options stay at defaults.

**Advance Vacuum** shared session persistence supports **`shared_cleaning_session_webhook`** (`POST` to `/api/webhook/<id>` with `{"value":"..."}`); pair it with a webhook automation that writes your **`shared_cleaning_session_entity`** helper.

### Notifications card (`custom:nodalia-notifications-card`)

Smart notification center for Home Assistant dashboards. It shows an empty-state greeting when there are no pending notifications, the newest notification first when there is one, and a stacked list with a chevron expander when several are active. Notifications can be dismissed; dismissed ids are stored in browser `localStorage` until the underlying state changes.

It can watch the same domains used by other Nodalia cards: `calendar.*` for pending events today, `vacuum.*` for paused/running/error states, `weather.*` + `fan.*` for heat recommendations with an action to turn on a fan, plus motion, door/window, temperature and humidity sensors. The visual editor also supports custom notifications with conditions and optional actions (`more-info`, toggle, or service call).

Mobile delivery can use modern `notify.*` entities through Home Assistant `notify.send_message` for title/message-only compatibility. For critical mobile-app alerts that need extra `data` (sound/priority/alarm stream), use `mobile_notifications.services` with the legacy `notify.mobile_app_*` service and enable `mobile_notifications.critical_alerts`.

```yaml
type: custom:nodalia-notifications-card
calendar_entities:
  - calendar.casa
weather_entities:
  - weather.casa
fan_entities:
  - fan.salon
vacuum_entities:
  - vacuum.robot
```

### Calendar card (`custom:nodalia-calendar-card`)

Shows merged events from one or more `calendar.*` entities, optional per-calendar **label** and **tint**, **time range** presets, native Home Assistant event creation, and native event deletion when the calendar exposes `calendar/event/delete`. Tap the card to open the **expanded** view (layout depends on the selected range). With **1 month** range, tap a **day** to focus that date, then tap an event to see its full description/location detail.

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
| `allow_delete` | bool | `true` | Show delete actions for native calendar events when Home Assistant supports deletion |
| `native_event_webhook` | string | *(empty)* | Optional Home Assistant **`webhook_id`** for creating native non-recurring events through an admin automation. Payload includes sanitized `service_data` for `calendar.create_event` and `calendar_event` metadata for advanced handlers. |
| `tint_auto` | bool | `true` | Tint the card with the theme primary; set `false` and use `styles.tint.color` for a **manual** accent |
| `animations` | object | see below | Entrance / motion tuning |
| `animations.enabled` | bool | `true` | Card animations |
| `animations.content_duration` | number | `260` | Base duration (ms) for entrance animation timing |
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

**Native event creation:** the expanded popup creates real Home Assistant calendar entries. The composer supports title, all-day/timed dates, optional description/location, native-style recurrence (`none`, `yearly`, `monthly`, `weekly`, or `daily`), and an optional Nodalia color override. Recurring events use Home Assistant’s native `calendar/event/create` websocket API because the public `calendar.create_event` service accepts description/location but not `rrule`. The color override is stored as hidden Nodalia metadata in the event description so the card can keep showing that event with the chosen color after reloads.

---

## 🚀 Installation

### HACS

[![Open your Home Assistant instance and open this repository in the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=danielmigueltejedor&repository=nodalia-cards&category=plugin)

In HACS, open **Nodalia Cards** and use **Download** (pick the release or prerelease you want). HACS adds the Lovelace resource for you—no need to paste YAML for a normal install. Refresh the dashboard; you can then add the custom cards in the UI. The resource remains `/hacsfiles/nodalia-cards/nodalia-cards.js`; that file is the full self-contained bundle so HACS installs work even when only the configured `filename` is served.

If something still looks off (e.g. old script cached), use **Redownload** in HACS, or in **Settings → Dashboards → ⋮ → Resources** make sure the entry matches the URL HACS created. HACS may append `?hacstag=…` to the path; that value is **per install and selected version**, not the app semver—replace it with whatever HACS shows after **Redownload** if needed. In the browser console, `__NODALIA_BUNDLE__` confirms which bundle loaded (`pkgVersion` and a short content id), and `__NODALIA_LOADER__` confirms the entrypoint mode.

If Home Assistant reports **“Custom element doesn't exist: nodalia-climate-card”**, the Nodalia bundle has not loaded in that browser session. `custom:nodalia-climate-card` is included in **0.6.1** and later; check that the resource URL points to `/hacsfiles/nodalia-cards/nodalia-cards.js`, then use **Redownload** and a hard browser refresh.

<details>
<summary>Manual install (no HACS)</summary>

Copy `nodalia-cards.js` into `config/www/` (or a subfolder) and add a resource under **Settings → Dashboards → Resources** with **type** `JavaScript module` and **URL** `/local/…` pointing at that file (for example `/local/nodalia-cards.js` if it lives at `config/www/`). `nodalia-cards.bundle.js` and `nodalia-cards.manifest.js` are build artifacts for diagnostics/releases, but the HACS/manual entrypoint is `nodalia-cards.js`.

</details>

---

## 🌍 Translations

**Stable (`main`) — 0.6.1** includes **es, en, de, fr, it, nl** plus **pt, ru, el, zh** (simplified), and **ro** for the bundled cards and Lovelace visual editors (partial trees merge from English; coverage is still improving). Spot a wrong or awkward string? Open an issue with the **Translation correction** template — see **CONTRIBUTING**.

**Prereleases:** active **`1.0.0-alpha.*`** line is now **`1.0.0-alpha.83`** on **`alpha`**. **`1.0.0-beta.7`** remains the latest beta validation build. **`0.6.1`** stays as the recommended stable line on **`main`** while final polish continues toward **`1.0.0`** stable.

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

## 🙌 Community contributions

Nodalia Cards is improving thanks to community feedback, ideas and testing.

Special thanks to:

- [@Sppedtech](https://github.com/Sppedtech) — suggested improvements for:
  - Light Card: option to place the entity state below the entity name
  - Person Card: option to hide the name and center the avatar

These suggestions were implemented in the `1.0.0-alpha` builds.

---

## 🧑‍💻 Author

Daniel Miguel Tejedor

---

## 💰 Donations

https://paypal.me/DanielMiguelTejedor
