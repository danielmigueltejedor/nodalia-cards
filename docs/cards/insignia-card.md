# Nodalia Insignia Card

`custom:nodalia-insignia-card` displays a compact badge for a Home Assistant
entity. It can show a name, state or attribute, icon or entity picture, with
automatic semantic tint or a configured tint colour.

```yaml
type: custom:nodalia-insignia-card
entity: sensor.living_room_temperature
show_name: true
show_value: true
tint_auto: true
tap_action: more-info
hold_action: none
```

`state_attribute` selects an attribute instead of the entity state. The card
keeps a real numeric zero visible and refreshes the picture, unit and semantic
tint when those attributes change. `icon_active` and `icon_inactive` can override
the two state icons; `use_entity_picture` enables the entity picture.

The visual editor provides the shared style and action sections, colour controls
and switches. Changing the selected entity updates an automatically assigned
name, while retaining a custom name and additional YAML configuration fields.

Flat tap/hold actions accept `auto`, `more-info`, `toggle`, `service`, `navigate`,
`url` or `none`. Service actions use `tap_service`/`hold_service` and JSON object
payloads in `tap_service_data`/`hold_service_data`. Strict service actions are
enabled by default; list permitted services or domains under `security`.
Malformed/non-object JSON falls back to an empty payload. URL/navigation inputs
are checked, and synchronous/rejected HA service errors are handled. Pointer
holds suppress their following tap, with that state reset on reconfiguration
or disconnection; Enter/Space support keyboard activation.
