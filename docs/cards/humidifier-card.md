# Nodalia Humidifier Card

`custom:nodalia-humidifier-card` controls a humidifier with a target-humidity
slider, mode chips and the controls supported by the entity.

```yaml
type: custom:nodalia-humidifier-card
entity: humidifier.salon
layout: compact
mode_entity: select.humidifier_mode
fan_mode_entity: select.humidifier_speed
```

Optional `mode_entity` and `fan_mode_entity` use select/input-select helpers.
The editor provides separate mode and fan-mode visibility switches, with hidden
values stored under `hidden_modes` and `hidden_fan_modes`. Re-enabling a mode
removes its override. Missing selected entities and helper selections remain
available in native fallback controls.

Body and icon tap/hold actions have separate settings. Service actions expose
editable JSON data and explicit targets, preserving false and zero; configured
services require the security allowlist by default. The standard style, animation
and haptic sections preserve translucent colours and custom YAML fields. Cleared
animation numbers restore defaults. Focus survives updates and malformed nested
settings or native/custom picker payloads fall back safely.
