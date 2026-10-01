# Power Flow Card

Use `custom:nodalia-power-flow-card` for power sources, household demand and
optional individual devices. The visual editor supports the same YAML fields.

```yaml
type: custom:nodalia-power-flow-card
entities:
  home:
    entity: sensor.home_power
  grid:
    entity:
      consumption: sensor.grid_import_power
      production: sensor.grid_export_power
  solar:
    entity: sensor.solar_power
consumption_chips:
  day_entity: sensor.energy_today
  month_entity: sensor.energy_this_month
```

Source entities may be a sensor ID or an object containing `entity`, or separate
`consumption` and `production` IDs. Split grid values use consumption minus
production: positive means import. Split battery values use production minus
consumption: positive means discharge and negative means charge. The existing
split-source calculation treats a missing component as zero.

Single missing/blank readings display `--`; actual zero remains visible. Comma
numeric states are accepted. Values in W become kW at an absolute value of
1,000 W, retaining whole digits and removing only decimal trailing zeros.
Consumption chips use their own energy-unit formatting and do not turn a blank
reading into zero.

`entities.individual` accepts device rows with `entity`, `name`, `icon`, `color`
and `secondary_info`. The editor keeps empty entity rows while configuring a
new device. With `show_home_device_popup: true` (default), individual devices
appear in the Home popup; set it to false to put them in the diagram.

Layouts preserve the established branch positions and adapt to configured
sources. SVG motion paths support absolute/relative line, curve and arc
commands, including compressed arc flags. Malformed motion paths fall back to
`M 0 0`; invalid connector coordinates produce no SVG path. The parser always
advances or returns, including after a close-path command.

Card, icon, chip and flow styles remain under `styles`. The published minimum
width is six columns. Public tags, root standalone file
`nodalia-power-flow-card.js`, default actions and HACS bundle installation remain
unchanged.
