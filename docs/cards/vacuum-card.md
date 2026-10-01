# Nodalia Vacuum Card

`custom:nodalia-vacuum-card` controls a robot vacuum with capabilities reported by
Home Assistant and optional state, error, battery and mode helpers.

```yaml
type: custom:nodalia-vacuum-card
entity: vacuum.robot
error_entity: sensor.robot_error
suction_select_entity: select.robot_suction
mop_select_entity: select.robot_water
```

The visual editor offers separate suction and mop visibility switches. Turning a
mode back on removes its hidden override. Explicit helpers take priority; automatic
helper discovery uses the current robot/device and avoids borrowing modes from
other robots. Missing selected robots and helpers remain selectable. Malformed
registry and nested settings are guarded.

Presets, body/icon navigation actions, haptic/animation/style settings, custom YAML
and focus survive editing. Clearing an animation override restores its default
(panel 800 ms, button bounce 320 ms). Translucent colour values retain their alpha.
Language defaults to automatic detection.

Status values, including `charger_disconnected`, use runtime translations. Long
status chips end with an ellipsis and retain their full text as a tooltip while
leaving room for the battery chip.
