# Media Player Card

`custom:nodalia-media-player` supports one or several players with standard,
square, compact, horizontal (`chip`) or artwork presentation.

```yaml
type: custom:nodalia-media-player
players:
  - entity: media_player.living_room
    label: Living room
layout:
  mode: standard
```

The previous single `entity` configuration is converted into a player row. The
visual editor keeps blank draft rows and missing selected players through Home
Assistant configuration feedback. Reordering or removing a row preserves its
label, icon, TV/source settings, power actions and YAML extensions. Invalid indices
and unsupported row paths are ignored before extending or modifying the list.

Each player has a card action and separate power actions for off, active and
unavailable states. Service-data fields accept JSON objects; invalid JSON, arrays
and primitives show a validation error without replacing the last valid object.
False and zero remain valid values. Clearing service data also clears the older
`data` alias so it cannot reappear; clearing URLs also clears `url_path`. Service
targets and unrelated extension fields survive visual edits. Focused drafts stay
in place through HA entity updates.

Artwork can use an immersive cover or a blurred gradient. Re-enabling covers from
legacy `off` mode restores immersive artwork. Shared style/animation controls retain
translucent colors; clearing animation durations restores their defaults. Transport
buttons use equal circular shapes and a centered capsule, with volume and auxiliary
controls at either side. Navigation uses the same translucent artwork tint for
buttons, transport capsules and stacked-player selectors.

See [styling](../STYLING.md) and the [testing guide](../testing.md).
