# Nodalia Circular Gauge Card

`custom:nodalia-circular-gauge-card` displays a numeric entity with a circular
value dial, optional range labels and percentage/name chips.

```yaml
type: custom:nodalia-circular-gauge-card
entity: sensor.potencia
min: 0
max: 2500
unit: W
```

Numeric sensors, numbers and input numbers can be selected in the visual editor.
Missing selected entities remain visible. Clearing minimum, maximum or decimals
removes the explicit override so the card can infer it from the entity; actual
zero remains an explicit valid override. Clearing grid rows/columns restores
absent sizing. Animation duration fields return to their defaults when cleared.

The editor includes the bundle's shared style, haptic and animation switches,
gauge tint colours, translucent backgrounds and tap action (more-info or none).
Custom YAML fields, focus, unavailable selections and native/HA control fallbacks
are retained. Malformed nested settings and picker payloads are guarded.
