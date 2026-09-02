# Nodalia Cards Engine

Nodalia Cards keeps the visual cards and the optional server-side engine as two independent HACS installations. This avoids forcing existing users to migrate away from the Dashboard plugin.

| Repository | HACS category | Purpose | Required |
|---|---|---|---|
| [`nodalia-cards`](https://github.com/danielmigueltejedor/nodalia-cards) | Dashboard | Cards, visual editors and `/hacsfiles/nodalia-cards/nodalia-cards.js` | Yes, for the cards |
| [`nodalia-cards-engine`](https://github.com/danielmigueltejedor/nodalia-cards-engine) | Integration | Background execution and persistent advanced features | No |

The Engine complements the plugin; it does not serve or replace the frontend bundle. Card YAML remains unchanged whether the Engine is installed or not.

[![Add Nodalia Cards Engine to HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=danielmigueltejedor&repository=nodalia-cards-engine&category=integration)

## Compatibility for Nodalia Cards 2.2.6-alpha.2

| Component | Supported baseline | Recommended for 2.2.6-alpha.2 |
|---|---|---|
| Home Assistant | `2025.1.0` or newer | Current supported stable release |
| Nodalia Cards | `2.0.2` or newer for Engine discovery | `2.2.6-alpha.2` |
| Nodalia Cards Engine | WebSocket API `2` | Stable `2.0.2` |

Cards `2.2.6-alpha.2` and Engine `2.0.2` use the same API generation. The Engine remains optional: ordinary controls, layouts and visual editors do not require it.

## What the optional Engine makes native

| Feature | With Nodalia Cards Engine | Plugin-only fallback |
|---|---|---|
| Background mobile notifications | Indexed Home Assistant state listeners and persistent profiles | Foreground delivery or the legacy package/webhook |
| Shared notification dismissals | Persistent server-side storage | Browser storage or an `input_text` helper |
| Notification inbox | Delivered-alert history per profile, newest first | No history; the card only shows live alerts |
| Climate weekly schedules | Persistent full schedule and native timers | Webhook, helper and Path A/B automations |
| Climate temporary overrides | A manual hold that wins over the weekly slots until it expires | Not available; change the setpoint manually |

Install the Engine when these native features are useful; ordinary card controls, editors and layouts do not require it.

## Engine mode in the card editors

The Notifications and Climate editors query the Engine when they open. What you see depends on what the Engine reports:

- **Engine active.** The editor shows an "Engine active" banner with the Engine version and privacy-safe health counters (stored profiles, schedules and inbox entries). Legacy webhook and `input_text` helper fields are hidden because the Engine owns that behaviour. Options that still matter — the notification profile id, the first day of the week — remain editable.
- **Engine missing or offline.** The editor shows a short hint and keeps every legacy webhook and helper field visible, so a plugin-only dashboard keeps working exactly as before.

Packages, webhooks and `input_text` helpers are therefore a fallback rather than the primary path. The card and Engine automatically turn off `input_boolean.nodalia_background_mobile_notifications` after a successful native sync, even when the old webhook is no longer present in the card configuration. If Engine becomes unavailable, the helper is re-enabled so the package resumes as the fallback. Keep the package configured until you have verified the Engine handles a real background event and survives a Home Assistant restart.

## Installation

### 1. Keep or install the Cards plugin

Open HACS, search for **Nodalia Cards** in the Dashboard category and download it from the official catalogue. A custom repository is no longer required, and existing users do not need to remove or reinstall the plugin.

[![Add Nodalia Cards to HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=danielmigueltejedor&repository=nodalia-cards&category=plugin)

The plugin resource remains:

```text
/hacsfiles/nodalia-cards/nodalia-cards.js
```

### 2. Add the optional Engine

1. Add `https://github.com/danielmigueltejedor/nodalia-cards-engine` to HACS as an **Integration** custom repository.
2. Download **Nodalia Cards Engine** and restart Home Assistant.
3. Open **Settings → Devices & services → Add integration**.
4. Search for **Nodalia Cards Engine** and confirm setup.
5. Reload the browser once so open cards discover its capabilities.

The official Cards plugin and the optional custom Engine repository can coexist in HACS because they use different repository URLs and categories.

## Migrating advanced features safely

There is no Cards plugin migration and no dashboard YAML rewrite.

If you currently use a notification package or Climate schedule automations:

1. Install and configure Nodalia Cards Engine while keeping the old package or automations temporarily.
2. Open the relevant card and save its background notification profile or Climate schedule.
3. Send a test with the `nodalia.test_notification` action and verify at least one real background event.
4. Verify the Climate schedule survives a Home Assistant restart and applies at its next boundary.
5. Only then remove the corresponding legacy package, webhook automation and dedicated helpers.

Keeping the fallback until verification avoids a notification or schedule gap.

## Background mobile notifications

In the Notifications Card editor:

1. Configure one or more `notify.*` entities or legacy `notify.service` targets.
2. Enable mobile notifications.
3. Enable background mobile delivery.

One Notifications Card can keep the default native profile id. If a dashboard uses several independently configured Notifications Cards, give each one a different profile id in the background delivery section.

An administrator synchronizes the profile to the Engine through Home Assistant's authenticated WebSocket connection. The backend listens only to the entities used by that profile, not to every Home Assistant state change.

Presence rules, quiet hours, severity, per-alert mobile policy, custom conditions, cooldowns and entity overrides are evaluated on the server. The card suppresses foreground delivery once the native profile is active, preventing duplicate pushes.

Use the `nodalia.test_notification` action from Developer Tools to test a stored profile.

### Notification inbox

When the Engine reports the inbox capability, the card reads the delivered-alert history for its profile after each successful sync and applies the dismissals recorded there. Dismissing an alert on one device therefore keeps it dismissed on the others without an `input_text` helper. Cards `2.2.2` normalize Engine identities against foreground comfort, humidity, door, window, motion, vacuum, rain, media and outdoor alerts, so the same alert stays dismissed across devices. The inbox stores alert identities and dismissal state, not notification text or targets.

## Climate schedules

Open the Climate Card agenda, create weekly blocks and save. The complete schedule is stored in `.storage/nodalia` and applied by the Engine at the next block boundary and after Home Assistant starts.

No `input_text`, webhook, package, shell command or generated automation is required. The legacy fields remain available for plugin-only installations.

### Temporary overrides

When the Engine reports the override capability and the entity has a stored schedule, the Climate Card shows two compact chips next to the schedule controls: one holds the current target for two hours, the other resumes the weekly schedule immediately. A `heat_cool` thermostat keeps its complete `target_temp_low` / `target_temp_high` comfort band during the hold; single-setpoint modes keep using `temperature`. While a hold is active the card shows the time it expires. The Engine stops applying schedule blocks until the override expires or is cleared.

## Security and limits

- Frontend communication uses the authenticated Home Assistant WebSocket connection.
- Profile and schedule writes require an administrator; reads require an authenticated Home Assistant user.
- Notification targets are validated as `notify.*` entities or services.
- Custom notification messages use a small placeholder replacement system, not executable templates.
- Profiles, watched entities and schedule slots have explicit limits to avoid accidental resource exhaustion.
- Diagnostics expose counts and versions, not entity ids, notification text or targets.

## Recovery

If the Engine is temporarily unavailable, ordinary card controls continue to work. Notifications and Climate retain their webhook paths as optional fallbacks when those fields are configured. The Notifications Card rechecks native delivery periodically; a failed check activates the synchronized package profile, while a recovered Engine returns that profile to standby. Reloading or removing the Engine does not alter dashboard YAML or the Cards plugin resource.

## Support boundaries

- Report card rendering, visual editor or frontend Engine-bridge issues in the [Nodalia Cards repository](https://github.com/danielmigueltejedor/nodalia-cards/issues).
- Report integration setup, background execution, stored-profile or Engine diagnostic issues in the [Nodalia Cards Engine repository](https://github.com/danielmigueltejedor/nodalia-cards-engine/issues).
