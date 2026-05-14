# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows semantic versioning.

> Detailed prerelease history for `1.0.0-alpha.*` and `1.0.0-beta.*` has been archived in [`CHANGELOG-PRERELEASES.md`](./CHANGELOG-PRERELEASES.md).

---

## [Unreleased]

Maintenance work continues toward the next stable **`1.1.x`** cut.

### Planned / In progress

- Bug fixes and compatibility patches.
- Performance and rendering improvements.
- Security and service-action hardening.
- Editor/i18n refinements.
- Home Assistant frontend compatibility updates.

---

## [1.1.0-alpha.11] - 2026-05-14

Eleventh **`1.1.0`** **`alpha`**: release channel **`1.1.0-alpha.11`** on **`package.json`**, **`hacs.json`**, **`nodalia-cards.manifest.js`**, **`__NODALIA_BUNDLE__.pkgVersion`**, and **`CARD_VERSION`** on bundled card modules.

### Fixed

- **`nodalia-cover-card.js`:** cover buttons and sliders now preserve the current dashboard scroll position during Safari/Home Assistant focus and re-render cycles, preventing the view from jumping when the card is near the bottom of the dashboard.

### Changed

- **Release metadata:** bump the **`1.1.0`** feature line to **`1.1.0-alpha.11`**.

---

## [1.1.0-alpha.10] - 2026-05-14

Tenth **`1.1.0`** **`alpha`**: release channel **`1.1.0-alpha.10`** on **`package.json`**, **`hacs.json`**, **`nodalia-cards.manifest.js`**, **`__NODALIA_BUNDLE__.pkgVersion`**, and **`CARD_VERSION`** on bundled card modules.

### Fixed

- **`nodalia-cover-card.js` editor i18n:** add the missing slider style labels so the visual editor no longer shows raw keys such as **`ed.fan.style_slider_color`**.
- **HACS resource loading:** publish a versioned, self-contained HACS entrypoint (**`nodalia-cards-1.1.0-alpha.10.js`**) so each alpha/stable update uses a fresh resource URL while **`nodalia-cards.js`** remains available as the direct fallback.

### Changed

- **Release metadata:** bump the **`1.1.0`** feature line to **`1.1.0-alpha.10`**.

---

## [1.1.0-alpha.9] - 2026-05-14

Ninth **`1.1.0`** **`alpha`**: release channel **`1.1.0-alpha.9`** on **`package.json`**, **`nodalia-cards.manifest.js`**, **`__NODALIA_BUNDLE__.pkgVersion`**, and **`CARD_VERSION`** on bundled card modules.

### Changed

- **`nodalia-entity-card.js`:** add `show_entity_picture` and optional `entity_picture` support so the main bubble can render an image/entity picture instead of an icon.
- **`nodalia-notifications-card.js`:** add full-tank smart notifications with a separate entity list and `thresholds.humidifier_fill_full`, allowing low clean-water tank alerts and full dirty-water/dehumidifier tank alerts to coexist.
- **`README.md`:** add the Buy Me a Coffee support link and update prerelease references to **`1.1.0-alpha.9`**.
- **Release metadata:** bump the **`1.1.0`** feature line to **`1.1.0-alpha.9`**.

---

## [1.1.0-alpha.8] - 2026-05-14

Eighth **`1.1.0`** **`alpha`**: release channel **`1.1.0-alpha.8`** on **`package.json`**, **`nodalia-cards.manifest.js`**, **`__NODALIA_BUNDLE__.pkgVersion`**, and **`CARD_VERSION`** on bundled card modules.

### Fixed

- **`nodalia-cover-card.js`:** pointer/touch interactions on cover controls no longer let buttons take browser focus, preventing dashboard scroll jumps when the card sits near the bottom of a view and re-renders after a service call.
- **`nodalia-cover-card.js`:** card-wide taps and position/tilt slider drags now suppress native focus/scroll behavior across pointer, mouse, and touch input so interacting with the card does not jump the dashboard scroll position.

### Changed

- **`nodalia-cover-card.js`:** position slider and open/stop/close controls swap rows, placing the position slider where the button row was and moving the buttons below it.
- **`nodalia-power-flow-card.js`:** grid import/export chips now use semantic transmission-tower import/export icons instead of position-dependent arrows, and the battery node switches between charging, discharging, and full-charge icons when those states can be inferred.
- **Release metadata:** bump the **`1.1.0`** feature line to **`1.1.0-alpha.8`**.

---

## [1.1.0-alpha.7] - 2026-05-14

Seventh **`1.1.0`** **`alpha`**: release channel **`1.1.0-alpha.7`** on **`package.json`**, **`nodalia-cards.manifest.js`**, **`__NODALIA_BUNDLE__.pkgVersion`**, and **`CARD_VERSION`** on bundled card modules.

### Fixed

- **`nodalia-cover-card.js`:** visual editor now follows the Fan Card editor structure more closely, including matching section actions, native **`ha-icon-picker`** mounting, Fan-style control hosts, haptic style selection, accent-color styling, card-radius helper hint, and consistent field/switch/color styling.
- **`nodalia-cover-card.js`:** cover entity picker now mounts with a real **`cover`** domain filter instead of going through the generic picker path, avoiding heavy all-entity picker setup when adding the card on large Home Assistant installs.

### Changed

- **Release metadata:** bump the **`1.1.0`** feature line to **`1.1.0-alpha.7`**.

---

## [1.1.0-alpha.6] - 2026-05-14

Sixth **`1.1.0`** **`alpha`**: release channel **`1.1.0-alpha.6`** on **`package.json`**, **`nodalia-cards.manifest.js`**, **`__NODALIA_BUNDLE__.pkgVersion`**, and **`CARD_VERSION`** on bundled card modules.

### Changed

- **`nodalia-power-flow-card.js`:** grid import/export no longer adds a separate secondary text such as **“A la red”** under the grid node. The grid value chip now shows a compact direction icon instead: left arrow for grid consumption and right arrow for feed-in/export.
- **Release metadata:** bump the **`1.1.0`** feature line to **`1.1.0-alpha.6`**.

---

## [1.1.0-alpha.5] - 2026-05-14

Fifth **`1.1.0`** **`alpha`**: release channel **`1.1.0-alpha.5`** on **`package.json`**, **`nodalia-cards.manifest.js`**, **`__NODALIA_BUNDLE__.pkgVersion`**, and **`CARD_VERSION`** on bundled card modules.

### Changed

- **`nodalia-cover-card.js`:** removed the redundant bottom **Position / Tilt** readout below cover sliders because the percentage is already exposed in the top chip, keeping the card shorter and closer to the Fan Card layout.
- **`nodalia-cover-card.js`:** aligned visual-editor color controls with the mature Nodalia editors, including the round swatch button, hidden native color input, CSS variable resolution, and alpha-preserving color writes.
- **Release metadata:** bump the **`1.1.0`** feature line to **`1.1.0-alpha.5`**.

---

## [1.1.0-alpha.4] - 2026-05-14

Fourth **`1.1.0`** **`alpha`**: release channel **`1.1.0-alpha.4`** on **`package.json`**, **`nodalia-cards.manifest.js`**, **`__NODALIA_BUNDLE__.pkgVersion`**, and **`CARD_VERSION`** on bundled card modules.

### Changed

- **`nodalia-cover-card.js`:** rebuilt the new Cover Card around the same visual structure and editor conventions as **`nodalia-fan-card.js`**, with Nodalia-style hero, chips, controls, sliders, haptics, animations, tap/hold action sections, collapsible style/animation sections, entity/icon picker mounts, and cover-native open/close/stop/position/tilt services.
- **Release metadata:** bump the **`1.1.0`** feature line to **`1.1.0-alpha.4`**.

---

## [1.1.0-alpha.3] - 2026-05-14

Third **`1.1.0`** **`alpha`**: release channel **`1.1.0-alpha.3`** on **`package.json`**, **`nodalia-cards.manifest.js`**, **`__NODALIA_BUNDLE__.pkgVersion`**, and **`CARD_VERSION`** on bundled card modules.

### Changed

- **`nodalia-power-flow-card.js`:** when a **home consumption** entity is configured, the card now derives the grid flow from home demand, solar production, and battery charge/discharge. The grid node appears automatically from the home entity, solar and battery can cover home demand before grid import is shown, solar surplus can charge the battery, grid charging of the battery is drawn as a dedicated grid → battery flow, and remaining surplus is shown as grid export.
- **Release metadata:** bump the **`1.1.0`** feature line to **`1.1.0-alpha.3`**.

---

## [1.1.0-alpha.2] - 2026-05-14

Second **`1.1.0`** **`alpha`**: release channel **`1.1.0-alpha.2`** on **`package.json`**, **`nodalia-cards.manifest.js`**, **`__NODALIA_BUNDLE__.pkgVersion`**, and **`CARD_VERSION`** on bundled card modules.

### Fixed

- **Card picker registration:** repeated Lovelace resource loads now deduplicate **`window.customCards`** entries by card type, preventing Nodalia cards from appearing duplicated or triplicated in Home Assistant's “Add card” picker while keeping the new **`custom:nodalia-cover-card`** discoverable.

### Changed

- **Release metadata:** bump the **`1.1.0`** feature line to **`1.1.0-alpha.2`**.

---

## [1.1.0-alpha.1] - 2026-05-14

First **`1.1.0`** **`alpha`**: release channel **`1.1.0-alpha.1`** on **`package.json`**, **`nodalia-cards.manifest.js`**, **`__NODALIA_BUNDLE__.pkgVersion`**, and **`CARD_VERSION`** on bundled card modules.

### Added

- **`nodalia-cover-card.js`:** new **`custom:nodalia-cover-card`** for Home Assistant **`cover`** entities, with open/stop/close controls, current state and position chips, optional position and tilt sliders, compact layout handling, icon animation for moving covers, visual editor support, and Nodalia-style tokens.
- **`nodalia-power-flow-card.js`:** grid feed-in visual state for solar/export setups. The grid node now supports a dedicated **`entities.grid.export_entity`** sensor, **`entities.grid.export_color`**, and **`entities.grid.export_when_negative`** for net-power sensors. When export is active, the grid line reverses direction, uses the feed-in color, and shows the exported value as a positive amount.

### Changed

- **Release metadata:** start the **`1.1.0`** feature line as **`1.1.0-alpha.1`**.

---

## [1.0.5] - 2026-05-13

Stable **`1.0.5`**. Installs match **`package.json`**, **`nodalia-cards.manifest.js`**, **`__NODALIA_BUNDLE__.pkgVersion`**, and **`CARD_VERSION`** on bundled card modules (**`1.0.5`**).

### Fixed

- **`nodalia-climate-card.js`:** temperature step controls now validate the current target through the climate number parser, keeping the explicit **`null`** guard against **`Number(null) === 0`** while still accepting numeric-string setpoints if an integration exposes them.

---

## [1.0.4] - 2026-05-13

Stable **`1.0.4`**. Installs match **`package.json`**, **`nodalia-cards.manifest.js`**, **`__NODALIA_BUNDLE__.pkgVersion`**, and **`CARD_VERSION`** on bundled card modules (**`1.0.4`**).

### Fixed

- **`nodalia-climate-card.js`:** restored single-setpoint climate support when integrations expose valid **`min_temp`** and **`max_temp`** but no current target value, so normal thermostat dial dragging and **`+` / `−`** controls remain enabled.
- **`nodalia-climate-card.js`:** step controls now reject a missing target with an explicit **`null`** check instead of letting **`Number(null)`** become **`0`**.
- **`nodalia-climate-card.js`:** queued setpoint commits that wake an HVAC mode now include **`hvac_mode`** in the follow-up **`climate.set_temperature`** call when available, matching the Ecobee/template climate setpoint creation path while still trying **`set_temperature`** directly if no wake mode exists.
- **`nodalia-climate-card.js`:** queued temperature commits no longer treat an empty follow-up queue as numeric **`0`**, avoiding unnecessary retry loops after a successful setpoint update.


## [1.0.3] - 2026-05-13

First stable **`1.0.3`** release focused on refining the overall dashboard experience: major improvements to the **Climate Card**, expanded **hold actions**, visual polish across multiple cards, translation updates, editor improvements, and several rendering/runtime fixes discovered during the early alpha cycle.

This version stabilizes the entire **`1.0.3-alpha.*`** line into a polished production-ready release for HACS and manual installs.

Installs match:
- **`package.json`**
- **`nodalia-cards.manifest.js`**
- **`__NODALIA_BUNDLE__.pkgVersion`**
- bundled **`CARD_VERSION`**
all aligned to **`1.0.3`**.

---

### Added

- **Hold (long-press) actions** support for:
  - **`nodalia-humidifier-card.js`**
  - **`nodalia-vacuum-card.js`**
  - **`nodalia-insignia-card.js`**

- Separate hold handling for:
  - card body
  - icon
  - badge areas (where applicable)

- Optional:
  - **`hold_navigation_path`**
  - **`icon_hold_navigation_path`**
  for direct Lovelace navigation from hold gestures.

- Shared host-level gesture handling using:
  - **`NodaliaUtils.bindHostPointerHoldGesture`**
  improving reliability during shadow DOM re-renders.

- New visual editor controls and translations for:
  - hold actions
  - vacuum navigation options
  - chip radius presets

- New configurable:
  - **`styles.chip_border_radius`**
  available across most Nodalia cards.

- Visual editor presets:
  - Capsule
  - Soft
  - Rounded
  - Square

---

### Improved

- Significant **Climate Card** improvements:
  - better Ecobee compatibility
  - improved handling of `hvac_mode: off`
  - improved support for entities exposing null setpoints
  - cleaner dial rendering logic
  - better off-state visuals
  - more consistent mode icon behavior
  - improved interaction handling for edge-case thermostats

- Improved:
  - translations
  - editor consistency
  - rendering stability
  - dashboard responsiveness
  - animation behavior
  - icon visibility
  - contrast handling

- Better visual consistency across:
  - light
  - fan
  - humidifier
  - entity
  - climate
  - calendar
  cards.

- Improved inactive/off-state icon readability in both:
  - dark themes
  - light themes

- Improved dial track readability and thumb visibility on:
  - tinted backgrounds
  - heat/cool accent surfaces

- Improved automatic migration of legacy YAML defaults through:
  - `normalizeConfig`

---

### Fixed

- Fixed multiple Climate Card edge cases:
  - duplicated temperature display
  - invalid center thumb rendering
  - incorrect off-state visuals
  - incorrect `auto` HVAC icon
  - inconsistent off-state accent handling

- Fixed:
  - `ReferenceError` on `nodalia-entity-card.js`
  that could blank entire dashboard sections.

- Fixed:
  - collapsed controls animation regression on `nodalia-light-card.js`

- Fixed:
  - calendar icon contrast on accent-tinted surfaces

- Fixed:
  - legacy inactive icon colors causing washed-out visuals

- Fixed:
  - inactive dial tracks becoming unreadable on tinted climate surfaces

---

### Changed

- Climate Card:
  - `auto` HVAC mode now uses:
    - **`mdi:thermostat-auto`**
    instead of refresh-style icons.

- Off-state Climate Card visuals now use:
  - proper power glyphs
  - dedicated off accent styling

- Dial inactive track blending adjusted for improved readability.

- Bundle diagnostics and release metadata updated for stable `1.0.3`.

---

### Notes

This release also includes many smaller:
- rendering optimizations
- internal cleanup changes
- editor refinements
- translation updates
- animation tuning
- compatibility fixes

that were iterated throughout the alpha cycle but are not individually listed here.

---

## [1.0.2] - 2026-05-13  — Stability, Climate & UX Refinement


Stable **`1.0.2`**. Installs match **`package.json`**, **`nodalia-cards.manifest.js`**, **`__NODALIA_BUNDLE__.pkgVersion`**, and bundled module **`CARD_VERSION`** values (**`1.0.2`**).

This release focuses heavily on:
- climate card robustness,
- dual-range thermostat support,
- layout stability,
- i18n consistency,
- default theme compatibility,
- and overall UX polish across the bundle.

A large portion of this release was directly driven by community feedback after the `1.0.0` stable launch.

---

# ✨ Highlights

- Major Ecobee / `heat_cool` climate compatibility improvements
- New dual-range climate dial system
- Better default Home Assistant theme compatibility
- Improved English fallback handling
- More robust calendar recurrence deletion UX
- Better large-layout climate responsiveness
- Reduced layout instability and dead space
- Improved accessibility and localization consistency

---

# 🌡️ Climate Card Overhaul

The Climate Card received the largest set of improvements in this release.

## Added

### Dual-range `heat_cool` climate support

The card now properly supports thermostat integrations that expose:
- `target_temp_low`
- `target_temp_high`

instead of a single `temperature` setpoint.

This dramatically improves compatibility with integrations such as:
- Ecobee
- advanced HVAC systems
- comfort-band thermostats

### New dual-range circular dial

When using `heat_cool`:
- separate warm/cool arcs are rendered
- independent heat/cool thumbs are displayed
- current temperature stays centered
- the comfort band is visually represented

### Thumb focus system

Dual-range dials now support:
- thumb selection
- per-thumb `+ / −` adjustment
- whole-range shifting when no thumb is selected
- non-crossing constraints
- minimum comfort-band gap enforcement

### Configurable dial size

Added:
```yaml
styles:
  dial:
    max_size: 480px
```

with full visual editor support.

---

# 🛠️ Climate Fixes & Improvements

## Fixed

- Ecobee-style entities no longer display `0` / `0.0 °C` when `temperature` is `null`
- Climate cards now correctly respect Home Assistant temperature units (`°F` / `°C`)
- Null/non-finite climate values are handled safely
- Dual-range climates no longer rely on invalid `low <= high` assumptions
- `heat_cool` mode now always uses:
  - `target_temp_low`
  - `target_temp_high`
  instead of incorrectly sending `temperature`
- Better handling for integrations exposing many HVAC modes
- Improved dial scaling in larger layouts
- Fixed large empty vertical areas below climate controls
- Improved multi-row mode button layouts
- Better compact handling for 4–6+ HVAC modes
- Improved superscript/unit positioning inside the dial
- Improved auto-height dashboard behavior
- Improved layout stability inside section views

## Accessibility & UX

- Better `aria-label` localization
- English fallback labels for climate states/actions
- Improved focus behavior for range controls
- More consistent translation fallback behavior

---

# 🗓️ Calendar Improvements

## Fixed recurring event deletion UX

Recurring event deletion flows were significantly improved.

### Improvements

- Recurrence dialogs now reliably appear from compact calendar mode
- Overlay/dialog synchronization fixed
- Canceling recurrence deletion cleanly restores the previous view
- Better inline error feedback when deletion fails
- Added translated recurrence deletion error messages

---

# 🌍 i18n & Translation Improvements

This release includes a major fallback consistency pass.

## Fixed

- English fallback behavior across nested translation maps
- Mixed-language labels in edge cases
- Runtime fallback inconsistencies
- Hardcoded Spanish climate labels
- Better cached locale merging performance

## Improved

- Translation consistency between cards
- Shared locale merging behavior
- Runtime translation performance

---

# 🎨 Layout & Theme Compatibility

## Improved

- Default Home Assistant theme compatibility
- Better transparency/surface fallbacks
- Improved contrast handling
- Better large-grid responsiveness
- Cleaner auto-height section behavior
- Reduced dead space in climate layouts
- More stable dashboard rendering in dense mobile layouts

---

# ⚡ Performance

## Improved

- Cached locale merge usage
- Reduced unnecessary runtime merges
- Cleaner climate render signatures
- Better handling of unknown temperature values
- Less layout churn in responsive climate layouts

---

# 🧩 Repository / Build

## Changed

- `.pnpm-store/` is now ignored in `.gitignore`
- Internal bundled versions are fully synchronized across:
  - `package.json`
  - `manifest`
  - `__NODALIA_BUNDLE__`
  - bundled `CARD_VERSION`s

---

# 🙌 Community-driven Release

A huge part of `1.0.2` came directly from:
- user bug reports,
- climate compatibility testing,
- translation feedback,
- layout edge cases,
- and real dashboard usage shared by the community after `1.0.0`.

Thanks to everyone testing, reporting issues, suggesting improvements, and helping shape Nodalia Cards so quickly after launch.

---

# 🏁 Summary

`1.0.2` turns the initial stable launch into a significantly more robust and production-ready experience.

This release especially strengthens:
- climate interoperability,
- thermostat UX,
- layout reliability,
- i18n consistency,
- and dashboard scalability.

Smarter climate interactions.  
Cleaner layouts.  
Better compatibility.  
More polished UX.  
Built for real Home Assistant dashboard
---
## [1.0.1] - 2026-05-12

### Changed

- **`CARD_VERSION`** on all bundled card modules is **`1.0.1`**, matching **`package.json`** and **`__NODALIA_BUNDLE__.pkgVersion`**.
- Person card and alarm panel use English fallbacks when **`NodaliaI18n`** is missing (`emptyBody`, default alarm title / editor placeholder).
- English **`person.emptyBody`** in **`nodalia-i18n.js`** uses the same “Configure `entity`…” wording as the card fallback.

### Fixed

- **`translateMediaPlayerState`** always returns a string for unknown media states (`en.unknown` with final **`"Unknown"`** fallback).

---

## [1.0.0] - 2026-05-12

First stable `1.0.0` release of **Nodalia Cards**.

This release promotes the full `1.0.0-alpha.*` / `1.0.0-beta.*` development cycle to the stable `main` line. It consolidates the new Calendar and Notifications cards, major Advance Vacuum improvements, broader multilingual support, visual-editor hardening, safer service actions, and a more reliable HACS/bundle loading experience.

Installs should match:

- `package.json`: `1.0.0`
- `window.__NODALIA_BUNDLE__.pkgVersion`: `1.0.0`
- Recommended Git tag: `v1.0.0`

### Highlights

| Area | Summary |
|------|---------|
| Calendar | Native Home Assistant events, large popup, recurring events, forecast integration and native delete support. |
| Notifications | New smart notification center with grouped alerts, persistent dismissals, mobile delivery and visual editor. |
| Advance Vacuum | More stable map rendering, shared session persistence, cleaner controls and better room/zone/goto/routine handling. |
| Visual editors | Better native HA selectors, color pickers, collapsible sections and multilingual labels. |
| i18n | Runtime and editor translations expanded across supported languages. |
| Bundle / HACS | More reliable single-file loading, version diagnostics and cache validation. |
| Security | Safer URL handling, strict service-action options and service allowlists. |
| Performance | Reduced unnecessary renders, lighter signatures and smoother animations. |

---

### Added

- New `custom:nodalia-calendar-card`.
- New `custom:nodalia-notifications-card`.
- Calendar event composer for native Home Assistant calendar events.
- Calendar support for:
  - title,
  - description,
  - location,
  - all-day events,
  - timed events,
  - recurring events,
  - custom recurrence intervals,
  - event color metadata.
- Calendar large popup with:
  - monthly view,
  - day detail view,
  - event detail view,
  - forecast chips,
  - native event creation,
  - native event deletion when supported by Home Assistant.
- Notifications card with:
  - smart alerts,
  - compact/expanded stack,
  - persistent dismissals,
  - custom notifications,
  - per-entity overrides,
  - optional shared persistence,
  - optional mobile notification delivery.
- Smart notification sources for:
  - calendar events,
  - vacuum state and errors,
  - heat/cold recommendations,
  - humidity and dehumidifier recommendations,
  - rain forecast,
  - low battery,
  - humidifier tank state,
  - printer ink level,
  - media players active in empty rooms.
- Mobile notification support for:
  - modern `notify.*` entities via `notify.send_message`,
  - legacy `notify.mobile_app_*` services,
  - optional critical alerts for supported mobile targets.
- Shared cleaning-session persistence support for Advance Vacuum through `shared_cleaning_session_entity` or webhook.
- Visual editor support for more native Home Assistant controls:
  - entity picker,
  - icon picker,
  - color picker,
  - domain-filtered selectors.
- Editor i18n catalogs for additional cards and shared controls.
- Full editor locale files for:
  - `de`,
  - `fr`,
  - `it`,
  - `nl`,
  - `pt`,
  - `ru`,
  - `el`,
  - `ro`.
- Runtime/editor language support and normalization improvements across:
  - Calendar,
  - Notifications,
  - Advance Vacuum,
  - Vacuum,
  - Climate,
  - Alarm Panel,
  - Entity,
  - Person,
  - Weather,
  - Light,
  - Fan,
  - Humidifier,
  - Power Flow,
  - Media Player,
  - Navigation,
  - Insignia.
- Icon animation toggles for active states in:
  - Weather,
  - Fan,
  - Humidifier,
  - Vacuum,
  - Advance Vacuum.
- Bundle diagnostics via `window.__NODALIA_BUNDLE__` with package version and hash.

---

### Changed

- `nodalia-cards.js` is again the recommended single-file entrypoint for HACS/manual installs.
- Calendar card now uses native Home Assistant calendar persistence instead of local/reminder-only storage.
- Calendar recurring events now use Home Assistant-compatible `dtstart` / `dtend` payloads.
- Calendar forecast loading is more resilient and uses modern Home Assistant forecast APIs where available.
- Notifications card visuals now align more closely with the Nodalia Entity Card design language.
- Notifications compact stack now uses decorative rear layers with controlled height, opacity and spacing.
- Advance Vacuum footer controls now use fixed grid slots for left/center/right buttons.
- Advance Vacuum side controls no longer grow to match the primary button when utility panels are open.
- Advance Vacuum surfaces now share `--av-*` design tokens across:
  - controls,
  - mode pills,
  - map frame,
  - map tools,
  - zone handles,
  - room markers,
  - goto markers,
  - room chips,
  - utility options,
  - routine tiles.
- Advance Vacuum map raster URL cache busting now depends on the map entity update time, not live robot position.
- Advance Vacuum map transitions reuse the same image element when the logical map URL is unchanged.
- Advance Vacuum zone mode no longer shows the extra zone-count chip in the modes panel.
- Fan and Humidifier active-icon animations use compositor-friendly `translate3d`.
- Weather icon animations avoid expensive filter animation paths where possible.
- Navigation/media player presentation was refined for smoother long-session use.
- Render signatures were made more selective to reduce unnecessary work.
- Locale string merging is cached to reduce allocation churn.
- Climate drag listeners are attached only during active drag operations.
- Security controls are exposed more consistently in visual editors.
- Custom service actions can be restricted with strict mode and allowlists.
- URL actions are sanitized before navigation/opening.
- New-tab URL actions use safer `noopener,noreferrer`.

---

### Fixed

- Calendar recurring event creation no longer fails with Home Assistant errors about `start` / `end` versus `dtstart` / `dtend`.
- Calendar custom recurrence now validates frequency and interval before sending.
- Calendar event detail no longer shows raw `RRULE` for common recurrence types.
- Calendar composer no longer clips in empty or small popup states.
- Calendar forecast data no longer disappears in several provider/timezone combinations.
- Calendar loading no longer causes repeated refresh loops in installations with many state changes.
- Calendar stale event state is cleared after load errors to avoid ghost entries.
- Notifications entrance animation no longer gets removed before first paint by immediate Home Assistant re-renders.
- Notifications entrance animation no longer replays simply from scrolling inside the same panel.
- Notifications stack no longer collides with cards below it in compact mode.
- Notifications no longer auto-add source chips when a custom message intentionally omits `{source}`.
- Notifications avoid sending mobile alerts that were dismissed while queued.
- Notifications mobile sent markers are persisted only when at least one channel succeeds.
- Vacuum errors such as `main_brush_jammed`, `lidar_blocked`, `filter_blocked`, `return_to_dock_fail` and similar states are shown as real translated errors instead of generic paused/unknown states.
- Advance Vacuum shared persistence no longer clears helpers accidentally when payloads exceed helper limits.
- Advance Vacuum shared session restore correctly preserves routines and utility panel state.
- Advance Vacuum webhook-only persistence deduplicates empty sessions.
- Advance Vacuum strict service mode no longer opens everything when allowlists are empty.
- Advance Vacuum helper persistence is not blocked by user-facing service allowlists.
- HACS cache/version confusion is easier to diagnose through bundle metadata.
- Visual editors no longer leak large amounts of Spanish/English mixed text in non-Spanish locales.
- German/Dutch/Italian/French editor labels no longer show broken generated fragments such as partial `Show`, `Enable` or `Open` translations.
- Insignia horizontal scroll strips no longer clip pill shadows at the bottom.
- Insignia icon-only pills keep safer default vertical spacing.
- Weather forecast date labels now respect the resolved HA/card locale instead of sticking to the browser/default language.
- Home Assistant modern `notify.send_message` payloads avoid unsupported legacy fields where needed.
- Several long-session animation paths were optimized to reduce stutter.

---

### Removed

- Calendar local quick reminders and completed-event persistence helpers were removed from the final stable design.
- Calendar no longer relies on localStorage/input_text completion state for native event workflows.
- Calendar editor options related to completed-event persistence were removed.
- Old experimental loader behavior that depended on auxiliary files being served beside the main HACS filename was replaced by the stable single-file bundle path.
- Several obsolete or duplicate editor i18n override blocks were consolidated.

---

### Card version alignment

For this milestone, the following card metadata is aligned with the stable `1.0.0` release line:

- `nodalia-notifications-card`
- `nodalia-calendar-card`
- `nodalia-advance-vacuum-card`

Other internal `CARD_VERSION` values may remain card-specific where they track independent component evolution.

---

### Upgrade notes

1. Redownload the repository from HACS or install the GitHub release/tag `v1.0.0`.

2. Make sure the Lovelace resource points to the bundled file:

   `/hacsfiles/nodalia-cards/nodalia-cards.js`

3. Hard-refresh the browser or clear frontend cache if Home Assistant still loads an older bundle.

4. Verify the loaded version in the browser console:

   `window.__NODALIA_BUNDLE__`

   Expected result:

   `pkgVersion: "1.0.0"`

5. If you used prerelease Calendar completion helpers, review your Calendar card YAML because the stable card now relies on native Home Assistant calendar events instead of completed/reminder helper persistence.

6. If you use strict service actions, review each card’s allowed services/domains after upgrading.

---

## [0.6.1] - 2026-05-05

Patch stable release on `main`.

### Fixed

- Editor i18n consistency for newly added service-security labels.
- Navigation media-player background sanitization.
- Navigation customization support for:
  - `styles.media_player.border`,
  - `styles.media_player.border_radius`,
  - `styles.media_player.box_shadow`.

---

## [0.6.0] - 2026-05-05

Second stable release on `main`.

This release focused on refinement, stability, security hardening, smoother interactions and internal architecture improvements across the bundle.

### Highlights

- Smoother Graph card hover and tooltip handling.
- Reduced Navigation bar and mini-player animation flicker.
- Better media-player visual alignment with the Nodalia design system.
- Strict service-action controls exposed in visual editors.
- Safer URL handling.
- Runtime style sanitization in critical paths.
- Shared render-signature helper.
- CI pipeline with install, test and bundle checks.
- Stability checklist for the `0.6.0` release line.

---

## [0.5.0] - 2026-05-06

First stable release on the `0.5.x` line.

This release consolidated interaction smoothing, security hardening, editor UX improvements and broader translation coverage.

### Highlights

- Shared `sanitizeActionUrl()` helper.
- Safer new-tab actions.
- Optional strict mode and allowlists for service actions.
- CSS/style sanitization in configurable render paths.
- Improved Graph hover fluidity.
- Reduced drag overhead in sliders and Climate dial.
- Improved Insignia icon-only sizing and scroll behavior.
- Expanded editor and runtime i18n coverage.

---

## [0.4.0] - 2026-05-06

Stable `0.4.x` release.

This release focused on sharper history visuals, a more dependable Navigation shell, shared tint/contrast logic, a full Insignia editor and broader editor/i18n polish.

### Highlights

- Reworked Graph card line and area visuals.
- Improved automatic graph ranges by metric.
- Navigation bar shelf geometry and full-width options.
- Better media artwork handling.
- Shared `NodaliaBubbleContrast` logic.
- Stronger Entity/Fan/Humidifier visual consistency.
- Full Insignia visual editor and tinting system.
- Wider Spanish editor normalization and locale coverage.

---

## [0.3.0] - 2026-05-04

Stable `0.3.x` release.

This release brought major multilingual UI improvements, Power Flow refinements and broader editor support.

### Highlights

- Runtime dictionaries for additional locales.
- Expanded Lovelace editor translations.
- Major Power Flow layout and SVG improvements.
- Improved Climate, Person and Advance Vacuum visuals.
- Better Music Assistant localized browse labels.

---

## [0.2.1] - 2026-05-03

### Fixed

- Rebuilt `nodalia-cards.js` with `window.__NODALIA_BUNDLE__` metadata to help confirm the actually loaded version and break stale caches.

---

## [0.2.0] - 2026-05-03

First stable multilingual release.

### Highlights

- Runtime i18n module.
- Visual editor i18n maps.
- Initial support for `es`, `en`, `de`, `fr`, `it` and `nl`.
- Bundle support via `nodalia-cards.js`.
- Initial broad editor translation coverage.

---

## [0.1.0]

Initial public development line.
