# Nodalia Cover Card

`custom:nodalia-cover-card` controls a cover with open, close, stop, position
and tilt controls, according to the capabilities reported by Home Assistant.

```yaml
type: custom:nodalia-cover-card
entity: cover.salon
layout: compact
show_position_chip: true
show_position_slider: true
show_tilt_chip: true
show_tilt_slider: true
tap_action: toggle
hold_action: more-info
```

Use `layout: circular` for the circular position dial. Unsupported controls
stay hidden. Blank responsive grid sizing remains absent; compact layout can
be selected with `compact_layout_mode: auto`, `always` or `never`.

Cancelling a pointer or touch drag sends no position command and restores the
latest HA value. Changing configuration or removing the card abandons active
drags, detaches window listeners and releases fallback animation timers.
Non-finite slider values are ignored; actual zero positions remain valid.

Body tap and hold actions accept `toggle`, `more-info`, `service`, `navigate`,
`url` or `none`. Icon actions inherit the corresponding body action and its
parameters when not configured; explicit icon actions override that inheritance.
Configured service actions require the `security` allowlist by default. Service
object data preserves false and zero and explicit targets remain intact.
Built-in cover controls use the entity's native services. HA failures are handled.

The visual editor retains missing selected entities, custom YAML fields and
focus, and provides the shared style, action, animation and haptic controls.
Malformed nested settings fall back safely. Clearing numeric animation settings
restores the defaults; colour controls preserve translucent values.
