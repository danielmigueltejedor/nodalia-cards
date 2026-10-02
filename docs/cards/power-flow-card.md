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
split-source calculation uses zero only for a component that is not configured.
If a configured component is missing, blank, unknown or unavailable, the split
reading displays `--` with an unavailable badge; a real zero remains valid.

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

The visual editor preserves newly added individual rows while their entity is
still blank, including after Home Assistant returns the emitted configuration.
Names, icons, colors and secondary information stay attached to their row when
moving or removing devices. Existing energy branches, grid export settings,
daily/monthly consumption chips and custom YAML fields remain intact.

Native selectors include missing configured entities and restrict available
choices to sensors, numbers and input numbers. Home Assistant selectors commit
their event value. Clearing a numeric override restores its default; an explicit
zero remains a value. Custom translucent CSS colors and focused drafts survive
editor updates.


The view, editor, configuration and helpers now pass strict TypeScript checking.
The obsolete simple rail renderer has been removed: the existing selector chooses
only full or compact layouts. Current positions, styles, sizing and SVG motion
paths remain unchanged.

Consumption chips can be activated with Enter or Space. Native action focus
survives displayed reading/attribute updates. Escape closes the Home device dialog
and returns focus to its Home button. Configuration, HA connection/user changes
and disconnect close the dialog and release modal, press, entrance and frame work.
Detached cards accept current HA without rendering until they reconnect. Retired
viewport observer/frame callbacks cannot modify the reattached view. Displayed
units, battery level and secondary attributes refresh even when timestamps do not.
