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


The checked view coalesces pending requests within the same connection and
configuration. Successful empty responses are cached until the refresh interval;
connection/user changes and detach abort the old owner. A late failure cannot
start a REST fallback against another connection or replace a new request.
Statistics supplement insufficient history without discarding a usable current
reading. Missing range bounds stay distinct from explicit zero.

Series and primary actions support Enter/Space. The chart supports Left/Right,
Home/End and Escape, retaining focus while the tooltip changes. Tooltip markers
track each entity, including series with identical names, and update in place.
Native cancellation, configuration changes and detach release holds, document
watchers, frames and animation fallback timers. Hover styles remain embedded
in the standalone file and HACS bundle; no additional stylesheet is fetched.
