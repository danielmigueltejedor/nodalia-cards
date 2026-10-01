# Nodalia Fan Card

`custom:nodalia-fan-card` controls a fan with the capabilities reported by HA,
including speed, oscillation, direction and preset modes.

```yaml
type: custom:nodalia-fan-card
entity: fan.salon
layout: compact
hidden_preset_modes:
  - Boost
```

The visual editor offers compact/circular layouts and individual preset-mode
visibility switches. Re-enabling a mode removes its hidden override. Missing
selected fans remain selectable in native fallback controls. Body and icon tap/
hold actions have separate settings; service actions include editable JSON data
and explicit targets. False and zero values remain intact. Configured services
require the security allowlist by default.

Style, animation and haptic sections use the bundle controls. Translucent colours,
custom YAML fields and focus survive updates; cleared animation numbers restore
defaults. Malformed nested groups and native/custom picker payloads are guarded.
