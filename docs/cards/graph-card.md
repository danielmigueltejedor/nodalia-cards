# Graph Card

Use `custom:nodalia-graph-card` for one or several numeric entities. The visual
editor supports series names/colors, layout styles and entity pickers.

```yaml
type: custom:nodalia-graph-card
entities:
  - entity: sensor.living_room_temperature
    name: Living room
    color: "#42a5f5"
hours_to_show: 24
points: 100
```

`points` is the history sample count, normalized to a whole number between 20
and 10,000. The default is 100; zero and nonfinite input use that default.
A finite value above the maximum is capped to avoid an unbounded chart allocation.
The sampler averages readings in each time bucket and carries the latest value
through empty buckets. Home Assistant history is preferred, with recorder
statistics as fallback when meaningful history is unavailable.

Missing or blank readings are excluded rather than displayed as zero. Real
zero and comma decimal state values remain valid. Invalid history/statistics
rows are ignored. The editor retains an empty series row while an entity is
being selected; runtime configuration omits empty rows.

See [styling](../STYLING.md) for the shared card appearance and
[testing](../testing.md) for the four-browser release gate.

The visual editor keeps an empty series through Home Assistant configuration
feedback. It converts the legacy single `entity` into the editable `entities`
list and preserves each name and color when reordering or removing rows. Missing
selected entities remain available. Invalid indices and unsupported row paths
are ignored before extending or modifying the list. Draft names and focus survive
HA updates, and unrelated YAML extensions retain false/zero values.

Clearing numeric fields restores their defaults; an explicit zero range remains
zero. Shared style and action sections retain translucent colors. Malformed
haptic or animation settings use guarded editor controls. The unused historical
editor, which was never registered, has been removed from source and standalone
output; the registered editor and public card API keep their existing names.
