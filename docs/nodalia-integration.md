# Nodalia integration

Nodalia 2.0 combines the dashboard cards and their optional server-side features in one Home Assistant custom integration. The integration serves the frontend bundle, registers it as a dashboard resource and provides authenticated native storage and execution.

## What becomes native

| Feature | Nodalia integration | Previous fallback |
|---|---|---|
| Card bundle and visual editors | Served and registered automatically | HACS Dashboard resource |
| Background mobile notifications | Indexed HA state listeners and persistent profiles | Package, webhook and 40 `input_text` chunks |
| Shared notification dismissals | Persistent integration storage | Browser storage or an `input_text` helper |
| Climate weekly schedules | Persistent full schedule and native timers | Webhook, helper and Path A/B automations |

The old webhook fields remain supported as a compatibility fallback. New installations do not need to configure them.

## Installation

1. Add `https://github.com/danielmigueltejedor/nodalia-cards` to HACS as an **Integration** custom repository.
2. Download **Nodalia** and restart Home Assistant.
3. Go to **Settings → Devices & services → Add integration**.
4. Search for **Nodalia** and confirm setup.
5. Reload the browser once.

The resource URL is `/nodalia/nodalia-cards.js`. Do not add it manually: the integration keeps its cache-busting version current.

If Lovelace resources are managed in YAML mode, Home Assistant does not allow integrations to edit that list. Add `/nodalia/nodalia-cards.js` as a module in the YAML `resources:` section once; the integration still serves the file.

## Migrating from the dashboard-only installation

Dashboard card YAML does not need to change.

1. Back up Home Assistant.
2. Remove the old Nodalia Cards **Dashboard** download from HACS and remove its stale `/hacsfiles/nodalia-cards/nodalia-cards.js` resource if HACS leaves it behind.
3. Add the same repository to HACS as an **Integration** and download it.
4. Restart Home Assistant and add the Nodalia integration from **Devices & services**.
5. Reload the browser and confirm `/nodalia/nodalia-cards.js` appears under dashboard resources.
6. After verifying native delivery, remove the old Nodalia notification package, climate webhook automations and their dedicated helpers.

Keep the legacy package until native notifications have delivered a test successfully. This avoids a gap during migration.

## Background mobile notifications

In the Notifications Card editor:

1. Configure one or more `notify.*` entities or legacy `notify.service` targets.
2. Enable mobile notifications.
3. Enable background mobile delivery.

One Notifications Card can keep the default native profile id. If a dashboard uses several independently configured Notifications Cards, give each one a different profile id in the background delivery section.

An administrator synchronizes the card profile to the integration through Home Assistant's authenticated WebSocket connection. The backend then listens only to the entities used by that profile; it does not subscribe to every Home Assistant state change.

Presence rules, quiet hours, severity, per-alert mobile policy, custom conditions, cooldowns and entity overrides are evaluated on the server. The card suppresses foreground delivery once the native profile is active, preventing duplicate pushes.

Use the `nodalia.test_notification` action from Developer Tools to test a stored profile.

## Climate schedules

Open the Climate Card agenda, create the weekly blocks and save. The complete schedule is stored in `.storage/nodalia` and applied by the integration at the next block boundary and after Home Assistant starts.

No `input_text`, webhook, package, shell command or generated automation is required. The legacy fields remain available only for users who deliberately run the frontend without the integration.

## Security and limits

- Frontend communication uses the authenticated Home Assistant WebSocket connection.
- Profile and schedule writes require an administrator; reads require an authenticated Home Assistant user.
- Notification targets are validated as `notify.*` entities or services.
- Custom notification messages use a small placeholder replacement system, not executable templates.
- Profiles, watched entities and schedule slots have explicit limits to avoid accidental resource exhaustion.
- Diagnostics expose counts and versions, not entity ids, notification text or targets.

## Recovery

If the integration is temporarily unavailable, ordinary card controls continue to work. Notifications and Climate retain their old webhook paths as optional fallbacks when those fields are configured. Reinstalling or reloading the integration does not alter dashboard YAML.
