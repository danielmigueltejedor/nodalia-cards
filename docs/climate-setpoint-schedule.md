# Climate Card — native weekly setpoint schedule

Nodalia 2.0 stores and executes Climate Card schedules inside the Nodalia Home Assistant integration. A normal installation needs no YAML helper, webhook, package, generated automation or shell command.

## Quick start

1. Install and configure the [Nodalia integration](./nodalia-integration.md).
2. Add a Climate Card with a `climate.*` entity.
3. Tap the calendar-clock button.
4. Add weekly blocks and press **Save**.

```yaml
type: custom:nodalia-climate-card
entity: climate.living_room
show_schedule_button: true
setpoint_schedule_week_starts_on: monday
```

The agenda stores the full schedule in Home Assistant and is not limited by an `input_text` entity's 255 characters.

## Behaviour

- Each enabled block has a weekday, start, end and target temperature.
- If blocks overlap, the block with the latest start wins.
- The active target is applied after Home Assistant starts, after a schedule is saved and at each upcoming block boundary (start or end), so overlapping blocks resume correctly when an override ends.
- If the thermostat already has the desired target, Nodalia avoids the redundant service call.
- Disabled schedules and disabled blocks are ignored.

Schedules use Home Assistant's configured local timezone.

## Options

| Option | Description |
|---|---|
| `show_schedule_button` | Show the weekly agenda button. Default `true`. |
| `setpoint_schedule_week_starts_on` | `monday` (default) or `sunday` for agenda row order. |
| `setpoint_schedule_webhook` | Optional legacy fallback webhook. Not needed with the integration. |
| `setpoint_schedule_helper` | Optional legacy fallback `input_text`. Not needed with the integration. |

## Legacy fallback

The existing webhook/helper implementation remains compatible so a card can still save through old automations when the Nodalia integration is unavailable. The former examples in `examples/climate-setpoint-schedule-*` are retained only for migration and unsupported frontend-only deployments.

Do not configure both systems intentionally. When the native integration is available, the card saves natively first and does not call the webhook.

## Troubleshooting

| Symptom | Check |
|---|---|
| Save asks for an integration or webhook | Nodalia is downloaded, Home Assistant was restarted and the integration was added under Devices & services. |
| Agenda opens empty after reload | Confirm the card entity id has not changed and reload the Nodalia integration. |
| Temperature does not change | Confirm the schedule and block are enabled, the block is active and the climate entity is available. |
| Non-admin cannot save | Schedule writes are intentionally admin-only in the initial native implementation. |
| Wrong day or time | Check Home Assistant's configured timezone. |

Privacy-safe counts and the next schedule boundary are available from the integration diagnostics.
