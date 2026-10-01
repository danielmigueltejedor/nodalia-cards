# Entity Card

Use `custom:nodalia-entity-card` for an entity state, optional attribute chips,
quick actions, or the `battery`, `network` and `air_quality` overview layouts.
The default layout requests at least four Home Assistant grid columns.

```yaml
type: custom:nodalia-entity-card
entity: sensor.living_room_temperature
show_state: true
state_position: below
number_decimals: 1
```

The visual editor includes the shared style, shape, color, action and security
controls. `styles.card`, `styles.icon` and `styles.control` accept the CSS fields
shown by the editor; malformed groups fall back to their defaults and unsafe
CSS is sanitized. Unknown style fields are discarded. Other YAML extensions
retain their existing normalization behavior.

`tap_action`, `hold_action`, `double_tap_action` and their `icon_` counterparts
accept legacy flat fields and Home Assistant action objects. Empty icon actions
retain their inherited behavior. Service actions remain subject to the card's
security configuration.

For battery or network overviews, configure `battery.entities` or
`network.entities` with entity IDs or objects containing `entity`, `name` and
`icon`. Network rows can set `role` to `auto`, `status`, `download`, `upload`,
`latency`, `signal` or `traffic`; each overview keeps up to 16 rows.

For air quality, configure sensor IDs under `air_quality` (`pm1`, `pm25`,
`pm4`, `pm10`, `tvoc`, `co2`, `temperature`, `humidity`). The legacy `pm2_5` and
`pm2.5` aliases also work. `show_graphs` enables history, `graph_series` controls
visible series and `graph_colors` sets their colors. `graph_hours` defaults to
24 (range 1–168), and `graph_points` to 96 (range 8–96). Blank settings use these
defaults. Missing readings remain unknown; real zero readings remain visible.
See the [air quality example](../../examples/entity-card-air-quality.yaml),
[battery example](../../examples/entity-card-battery.yaml) and
[network example](../../examples/entity-card-network.yaml).

For a dedicated lock interaction, use the [Lock Card](./lock-card.md). Summary
embeds that card in its security section.
