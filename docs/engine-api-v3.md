# Cards bridge for Engine API v3

Cards prefers API 3 and falls back to API 2 after `nodalia/status` discovery.
The status snapshot exposes `negotiated_api_version`; an incompatible server
range is unavailable. Existing cold bridge calls retain API 2 until discovery,
so older integrations keep their current command paths. New optional methods
always negotiate status and require both API 3 and an advertised capability.

| Bridge method | Engine capability | Command |
|---|---|---|
| `previewNotificationProfile(hass, profile, profileId)` | `notifications_preview` | `nodalia/notifications/preview` |
| `snoozeNotification(hass, alertId, until, profileId)` | `notifications_snooze` | `nodalia/notifications/snooze` |
| `previewClimateSchedule(hass, entityId, schedule, at)` | `climate_schedule_preview` | `nodalia/climate/schedule/preview` |
| `getVacuumSession(hass, entityId)` | `vacuum_sessions` | `nodalia/vacuum/session/get` |
| `setVacuumSession(hass, entityId, session, expectedRevision)` | `vacuum_sessions` | `nodalia/vacuum/session/set` |

Unsupported features reject with `code: "unsupported_capability"` before sending
a mutation. Defaults are explicit profile `default`; a real revision `0` remains
zero. Sessions belong to the authenticated HA user and vacuum, and stale writes
return `conflict` rather than silently overwriting another dashboard.

The [Engine API v3 contract](https://github.com/danielmigueltejedor/nodalia-cards-engine/blob/main/docs/api-v3.md)
is the canonical description of payloads, permissions, bounds, response fields,
background forecast behaviour and `template_version: 3` migration. These bridge
methods prepare frontend integration; they do not add new editor buttons by
themselves. Existing cards continue to use their local/helper fallbacks.

For rain, prefer `{precipitation_probability}` in probability messages and
`{temperature}{temperature_unit}` in current-temperature messages. In migrated
v3 rain profiles, `{value}` is a probability alias. Stable Engine 3.0.0 supports API 1–3; Engine 2.0.2 uses API 2 and already reports rain probability.
The earlier unpublished Engine 3.0.0 preparation used a temporary temperature
alias; the v3 implementation restores probability. Prefer explicit temperature
fields when migrating custom messages. Ordinary
background delivery and Climate operations remain compatible with API 2.
