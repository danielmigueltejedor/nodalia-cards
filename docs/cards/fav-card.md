# Nodalia Fav Card

`custom:nodalia-fav-card` displays an entity as a compact favourite. Automatic,
mini and inline layouts retain the same icon and translucent Nodalia style.

```yaml
type: custom:nodalia-fav-card
entity: light.living_room
layout_mode: auto
show_name: true
show_state: true
tap_action: auto
```

`state_attribute` can display an attribute instead of the state. Attribute,
light colour and alarm capability changes refresh the card even when the entity
state stays the same. Actual zero readings remain visible. Grid rows/columns
influence compact sizing; missing or blank sizing does not become zero.

The visual editor includes style and action sections and retains custom YAML
fields and a selected entity that is currently unavailable. Tap actions accept
`auto`, `toggle`, `more-info`, `service`, `url` or `none`. Service actions use
`tap_service`, `tap_service_data` and `tap_service_target`; object data retains
false and zero, and explicit targets avoid inserting an entity target. Strict
service actions allow the built-in Home Assistant toggle/on/off services by
default; other services require an allowlist under `security`.

An alarm entity opens its supported arming controls. When HA reports a required
PIN input, a manual PIN is required; otherwise `alarm_code_entity` can supply a
helper PIN, followed by `alarm_code` as a fallback. Leading zeros are retained.
Style changes keep a draft PIN; changing the entity or removing the card clears
it. Disconnect also releases pending layout timers and frames.

Alarm favourites use intrinsic height when open and closed. Collapsing releases
the space below the favourite row in Sections dashboards, including rapid toggles
and HA feedback, without resizing the entire dashboard.
