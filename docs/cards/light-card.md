# Nodalia Light Card

`custom:nodalia-light-card` controls lights with the capabilities reported by Home
Assistant, including brightness, colour and colour temperature.

```yaml
type: custom:nodalia-light-card
entity: light.salon
quick_brightness: [10, 35, 65, 100]
color_presets:
  - label: Evening
    color: '#ffaa00'
```

The visual editor offers four named colour presets, brightness shortcuts, layouts,
animation, haptic and style sections. Brightness shortcuts are bounded to 1–100;
empty or invalid lists restore the default shortcuts. Clearing an animation
number restores its default duration; an explicit zero retains the minimum bound.
Missing selected lights remain selectable, and focus survives HA updates.

Body and icon tap/hold actions have separate settings. Service data textareas
retain false and zero values and explicit targets; configured services require
the security allowlist by default. Translucent colours and custom YAML fields
survive edits. Malformed nested settings and native/custom picker payloads are
guarded.
