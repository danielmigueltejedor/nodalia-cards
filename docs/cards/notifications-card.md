# Nodalia Notifications Card

`custom:nodalia-notifications-card` displays smart alerts, custom rules and external alerts. It ships with the single HACS resource `nodalia-cards.js` and a visual editor.

## Basic configuration

```yaml
type: custom:nodalia-notifications-card
language: auto
max_visible: 3
temperature_entities:
  - sensor.living_room_temperature
humidity_entities:
  - sensor.living_room_humidity
battery_entities:
  - sensor.door_battery
```

Smart recommendations are enabled by default. Configure the domain lists and thresholds in the visual editor. Missing or blank measurements and forecasts remain absent; actual zero values retain their value and unit. All-day calendar dates retain local midnight, and impossible dates are ignored.

## Custom rules and templates

```yaml
custom_notifications:
  - entity: sensor.living_room_temperature
    condition: above
    value: "27"
    title: "{source} is warm"
    message: "Temperature: {value}; threshold: {threshold}"
    severity: warning
    mobile: auto
```

Standard variables include `{source}`, `{entity}`, `{state}`, `{value}`, `{threshold}`, `{fan}` and `{time}`, together with the entity's attributes. Templates can reference another entity, such as `{sensor.energy_price}`, or a specific attribute, such as `{media_player.living_room.media_title}`. A numeric entity value includes its unit; `.state` returns the raw state. Missing references produce an empty string.

## Mobile delivery and Engine

Mobile delivery is disabled by default. Configure notify entities/services, severity, quiet hours and presence in the editor. Policies are `auto`, `push`, `card_only` and `off`; card visibility and mobile delivery are separate decisions. Per-entity smart overrides can inherit the base policy.

Background delivery uses the optional Nodalia Cards Engine. See [Cards + Engine](../nodalia-integration.md) for setup and compatibility. Administrators can synchronize the configured profile; other users read the existing profile. A temporary profile read/write failure preserves Engine ownership to avoid activating duplicate delivery. Legacy webhook synchronization keeps its bounded chunk format for existing installations.

## Appearance

The editor exposes the bundle's collapsible style sections and native selectors. Legacy card/item radius defaults are normalized to `var(--nodalia-card-border-radius, 28px)`. Service actions and webhook permissions continue to obey the configured security policy.

Incomplete custom notifications and external alerts remain editable when Home
Assistant returns the saved runtime configuration; those unfinished rows do not
become live notifications. Reordering keeps each notification's entity, icon,
action and JSON service data together. Smart overrides follow the entity even
when its position in the connection lists changes.

The editor retains missing configured entities and focused drafts. Home Assistant
pickers commit their event values and use domain filters for connection lists.
Clearing a numeric override restores its default; an explicit zero remains a
value. Translucent CSS colors retain their alpha.

Closing the editor or changing its HA connection/user invalidates outstanding
Engine replies and queued background work. Configuration changes also invalidate
obsolete profile syncs before they write. Normal HA feedback keeps the latest
queued sync, including a disabled profile that stops background delivery.

## View lifecycle and remembered alerts

Calendar and forecast requests, Engine sync/inbox operations and pending mobile
batches belong to the current configuration, HA connection and user. Closing the
card or changing that context invalidates their callbacks. One foreground batch
runs at a time and delivery policy is rechecked before each alert. Native action
focus survives ordinary HA updates; failed actions are caught by the card.

Weather queries use `weather.get_forecasts` with a response. An empty native
forecast is a real result and does not restore an older attribute forecast.
Calendar refreshes stop at the next local midnight, including daylight saving
time boundaries; a failed request waits the normal interval before retrying.

`storage_key` remains the browser-storage prefix, with server and user identity
added for local dismissals and mobile history. Earlier unscoped browser entries
are retained in storage but are not imported into another user's private state.
`dismissed_entity` and the Engine profile remain explicit ways to share dismissals.
