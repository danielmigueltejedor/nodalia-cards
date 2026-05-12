# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows semantic versioning.

> Detailed prerelease history for `1.0.0-alpha.*` and `1.0.0-beta.*` has been archived in [`CHANGELOG-PRERELEASES.md`](./CHANGELOG-PRERELEASES.md).

---

## [Unreleased]

Maintenance work continues on the stable `1.0.x` line while the next feature cycle is prepared.

### Planned / In progress

- Bug fixes and compatibility patches.
- Performance and rendering improvements.
- Security and service-action hardening.
- Editor/i18n refinements.
- Home Assistant frontend compatibility updates.

---
## [1.0.2-alpha.12] - 2026-05-12

Prerelease **`alpha.12`** on **`1.0.2`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.2-alpha.12`** (optional tag **`v1.0.2-alpha.12`**).

### Changed

- **`CARD_VERSION`** on all bundled card modules is **`1.0.2-alpha.12`**, matching **`package.json`** and **`__NODALIA_BUNDLE__.pkgVersion`**.

### Added

- **`nodalia-climate-card.js`:** **`heat_cool`** dual-range dial: **thumb focus** (`low` / `high` / none) for **`+` / `−`** (single bound vs whole-band shift), **tap** thumb to select or deselect, **drag** selects that thumb, **clear** focus when tapping the dial outside the thumbs or when changing HVAC mode / power; selection styling on the active thumb; range changes still call **`climate.set_temperature`** with both **`target_temp_low`** and **`target_temp_high`**.

---
## [1.0.2-alpha.11] - 2026-05-12

Prerelease **`alpha.11`** on **`1.0.2`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.2-alpha.11`** (optional tag **`v1.0.2-alpha.11`**).

### Changed

- **`CARD_VERSION`** on all bundled card modules is **`1.0.2-alpha.11`**, matching **`package.json`** and **`__NODALIA_BUNDLE__.pkgVersion`**.

### Fixed

- **`nodalia-climate-card.js`:** In **`heat_cool`** when **`temperature`** is unset but **`target_temp_low`** / **`target_temp_high`** are set (Ecobee-style), the dial is now a **dual-handle** comfort band: **`current_temperature`** in the center readout, range summary under the divider, warm arc + **heat** thumb for **`target_temp_low`**, cool arc + **cool** thumb for **`target_temp_high`**, **`climate.set_temperature`** always sends **`target_temp_low`** and **`target_temp_high`** (never **`temperature`**), with a minimum gap of **`max(1, target_temp_step)`** between the two bounds and non-crossing clamps.

---
## [1.0.2-alpha.10] - 2026-05-12

Prerelease **`alpha.10`** on **`1.0.2`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.2-alpha.10`** (optional tag **`v1.0.2-alpha.10`**).

### Changed

- **`CARD_VERSION`** on all bundled card modules is **`1.0.2-alpha.10`**, matching **`package.json`** and **`__NODALIA_BUNDLE__.pkgVersion`**.

### Fixed

- **`nodalia-calendar-card.js`:** When **`calendar/event/delete`** fails, the recurrence choice dialog stays open, an inline **`role="alert"`** message is shown, and **`_renderIfChanged(true)`** runs so the failure is visible (previously **`_deleteRecurringChoiceKey`** was cleared before the WebSocket call, so the UI could refresh with no dialog and no feedback).
- **`nodalia-i18n.js`:** **`calendarCard.deleteRecurrence.deleteFailed`** and **`deleteFailedWithMessage`** for **`en`** / **`es`** (optional server message from the caught error).

---
## [1.0.2-alpha.9] - 2026-05-12

Prerelease **`alpha.9`** on **`1.0.2`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.2-alpha.9`** (optional tag **`v1.0.2-alpha.9`**).

### Changed

- **`CARD_VERSION`** on all bundled card modules is **`1.0.2-alpha.9`**, matching **`package.json`** and **`__NODALIA_BUNDLE__.pkgVersion`**.

### Fixed

- **`nodalia-climate-card.js`:** Removed unused **`countClimateDialModeRowsAfterFirstTwo`** (layout uses **`buildClimateDialModeButtonRows`** only).

### Performance / i18n

- **`nodalia-i18n.js`:** **`strings("es")`** now uses the same **`deepMergeLocale(PACK.en, PACK.es)`** path as other locales (cached), so **`translateEntityState`** can read **`strings(code).entityCard`** without re-merging on every call.

---
## [1.0.2-alpha.8] - 2026-05-12

Prerelease **`alpha.8`** on **`1.0.2`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.2-alpha.8`** (optional tag **`v1.0.2-alpha.8`**).

### Changed

- **`CARD_VERSION`** on all bundled card modules is **`1.0.2-alpha.8`**, matching **`package.json`** and **`__NODALIA_BUNDLE__.pkgVersion`**.

### Fixed

- **`nodalia-climate-card.js`:** Render-signature temperatures use **`parseFiniteClimateNumber`** only (no **`-1`** sentinel), so a real **−1 °C** setpoint is not confused with “unknown”, and **`formatTemperature`** uses the same helper so **`null`** / empty values do not render as **`0.0 °C`**.
- **`nodalia-climate-card.js`:** Dial **power** control **`title`** / **`aria-label`** follow **`translateClimateMode('off')`** instead of hardcoded Spanish.
- **`nodalia-i18n.js`:** **`translateEntityState`** builds **`entityCard`** with **`deepMergeLocale(PACK.en.entityCard, …)`** for every supported language so nested keys (for example **`binarySensor`**) keep **English** fallbacks when a locale omits them.

---
## [1.0.2-alpha.7] - 2026-05-12

Prerelease **`alpha.7`** on **`1.0.2`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.2-alpha.7`** (optional tag **`v1.0.2-alpha.7`**).

### Changed

- **`CARD_VERSION`** on all bundled card modules is **`1.0.2-alpha.7`**, matching **`package.json`** and **`__NODALIA_BUNDLE__.pkgVersion`**.

### Fixed

- **`nodalia-climate-card.js`:** **`min-height`** no longer adds the **mode-button block** (modes sit **inside** the dial); it only reflects **padding + header + dial + optional step row + gaps**, with a **lower floor**, so auto-height layouts do not keep a large **empty band** under **+ / −**.
- **`nodalia-climate-card.js`:** with **four** modes, dial **`inset`** top is increased; from **four** modes up the **`°C` / scale** superscript uses a **lower `top`** plus light **`padding-top`** on the target readout so the unit stays **clear of the slider arc**.

---
## [1.0.2-alpha.6] - 2026-05-12

Prerelease **`alpha.6`** on **`1.0.2`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.2-alpha.6`** (optional tag **`v1.0.2-alpha.6`**).

### Changed

- **`CARD_VERSION`** on all bundled card modules is **`1.0.2-alpha.6`**, matching **`package.json`** and **`__NODALIA_BUNDLE__.pkgVersion`**.
- **`nodalia-climate-card.js`:** exactly **six** mode controls use a **3 + 3** two-row layout instead of **2 + 2 + 2**; other counts keep the previous **2 + …** chunking.
- **`nodalia-climate-card.js`:** **`host`**, **`ha-card`**, and **`.climate-card__content`** use **`height: auto`** with **`align-self: start`** on **`host`** so tall dashboard cells no longer stretch the card and leave a large empty band under the **+ / −** buttons.

---
## [1.0.2-alpha.5] - 2026-05-12

Prerelease **`alpha.5`** on **`1.0.2`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.2-alpha.5`** (optional tag **`v1.0.2-alpha.5`**).

### Changed

- **`CARD_VERSION`** on all bundled card modules is **`1.0.2-alpha.5`**, matching **`package.json`** and **`__NODALIA_BUNDLE__.pkgVersion`**.
- **`nodalia-climate-card.js`:** mode buttons after the first pair split into **extra centered rows** (for example six controls → **2 + 2 + 2** instead of **2 + 4**); **≥5 / ≥6** modes use **slightly smaller** mode buttons, **tighter** stacked gaps, and **dial-center** inset / grid gap tuned so many modes fit inside the dial.
- **`nodalia-climate-card.js`:** with **+/-** step controls visible, the dial column no longer **stretches** vertically (`flex` on the dial wrap), **tighter** vertical gaps, and **`min-height`** slack adjusted so **auto-height** sections look **less tall** with less dead space between dial and step buttons.

---
## [1.0.2-alpha.4] - 2026-05-12

Prerelease **`alpha.4`** on **`1.0.2`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.2-alpha.4`** (optional tag **`v1.0.2-alpha.4`**).

### Changed

- **`CARD_VERSION`** on all bundled card modules is **`1.0.2-alpha.4`**, matching **`package.json`** and **`__NODALIA_BUNDLE__.pkgVersion`**.
- **`nodalia-climate-card.js`:** with **three or more** mode controls (power + modes, or modes only when off), the first **two** stay on the **top row** and the rest sit on a **second row** centered (e.g. 3 → inverted triangle, 4 → 2×2, 5 → two + three).

### Fixed

- **`nodalia-climate-card.js`:** **section auto height** no longer collapses the card to a thin line; **`min-height`** on **`host` / `ha-card`** and dropping height-based **`cqh`** from the dial width avoid a **container-size / percentage-height** cycle with **`container-type: size`**.

---
## [1.0.2-alpha.3] - 2026-05-12

Prerelease **`alpha.3`** on **`1.0.2`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.2-alpha.3`** (optional tag **`v1.0.2-alpha.3`**).

### Changed

- **`CARD_VERSION`** on all bundled card modules is **`1.0.2-alpha.3`**, matching **`package.json`** and **`__NODALIA_BUNDLE__.pkgVersion`**.

### Fixed

- **`nodalia-climate-card.js`:** integrations such as **Ecobee** that omit **`temperature`** when idle no longer surface **`0`** as the target (dial arc and main readout stay coherent); temperature parsing and render signatures treat non-finite values as unknown instead of zero.
- **`nodalia-climate-card.js`:** temperature labels use Home Assistant’s **unit system** and **locale** (for example **°F** with the correct decimal separator) instead of hardcoded Celsius / a fixed locale.
- **`nodalia-climate-card.js`:** dial layout uses **`container-type: size`**, slightly larger dial caps in roomy layouts, and optional **`cqw` / `cqh`** scaling when supported so the inner dial does not stay cramped in large grid cells.

---
## [1.0.2-alpha.2] - 2026-05-12

Prerelease **`alpha.2`** on **`1.0.2`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.2-alpha.2`** (optional tag **`v1.0.2-alpha.2`**).

### Changed

- **`CARD_VERSION`** on all bundled card modules is **`1.0.2-alpha.2`**, matching **`package.json`** and **`__NODALIA_BUNDLE__.pkgVersion`**.

### Fixed

- **`nodalia-calendar-card.js`:** deleting a **recurring** event from the **compact** list opened the recurrence choice in **`calendar-expanded`** while that layer still had **`pointer-events: none`** (no **`is-open`**), so nothing appeared to happen; the card now opens the overlay (with event detail) before showing the dialog.
- **`nodalia-calendar-card.js`:** dismissing the recurrence delete dialog (**Cancel**, backdrop, or **Escape**) after that compact-list path closes the overlay again so you return to the compact card; a successful delete does the same.

---
## [1.0.2-alpha.1] - 2026-05-12

First **`alpha`** on **`1.0.2`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.2-alpha.1`** (tag **`v1.0.2-alpha.1`** optional).

### Added

- **`nodalia-calendar-card.js`:** deleting a **recurring** instance opens a choice dialog (same **`calendar-composer`** styling as the rest of the expanded calendar): **only this occurrence** or **this and all following**, mapped to Home Assistant **`calendar/event/delete`** with **`recurrence_range`** **`""`** vs **`THISANDFUTURE`** when **`recurrence_id`** is present.
- **`nodalia-i18n.js`:** **`calendarCard.deleteRecurrence`** strings and **`aria.deleteRecurringDialog`** for **`en`** and **`es`**.

### Changed

- **`CARD_VERSION`** on all bundled card modules is **`1.0.2-alpha.1`**, matching **`package.json`** and **`__NODALIA_BUNDLE__.pkgVersion`**.
- **`nodalia-i18n.js`:** `translateEntityState` builds the Spanish **`entityCard`** dictionary with **`deepMergeLocale(PACK.en.entityCard, PACK.es.entityCard)`** so nested maps (for example **`boolean`**, **`states`**, **`binarySensor`**) inherit English fallbacks; other locales reuse **`strings(lang).entityCard`** from the cached merged pack (no redundant second merge).

### Fixed

- **`nodalia-humidifier-card.js`:** runtime fallbacks when **`NodaliaI18n`** is unavailable use **English** strings (state labels and **`translateModeLabel`** shim), consistent with other cards’ missing-i18n behaviour.

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

