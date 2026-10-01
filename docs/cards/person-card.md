# Nodalia Person Card

`custom:nodalia-person-card` shows a person or device tracker with a name,
location, picture or fallback icon and a zone badge.

```yaml
type: custom:nodalia-person-card
entity: person.ana
show_name: true
show_state: true
show_zone_badge: true
tap_action: more-info
hold_action: none
double_tap_action: none
```

Custom zone names and icons follow HA zone entities, including renamed zones.
The card retains the current picture while a new picture loads, ignores stale
image completions and falls back to an icon when loading fails. Preloads have a
four-second limit; completed and failed URL caches each hold at most 64 entries.
Removing the card cancels its pending preloads and animation timers. Remounting
can retry cancelled loads.

Tap, hold and double-tap have separate actions and entity overrides. Actions
accept `more-info`, `toggle`, `service`, `navigate`, `url` or `none`. For each
prefix, service data and explicit targets use `<prefix>_service_data` and
`<prefix>_service_target`; object data preserves false and zero. Configured
services require an allowlist under `security` by default. HA errors are handled,
and changing configuration or disconnecting cancels pending taps.

The visual editor includes the shared style switches, translucent colour
controls, animation settings and three action groups. Missing selected entities,
custom names, YAML extensions, focus and separate action settings are retained.
Clearing an animation duration restores its default. Blank grid rows do not
activate single-row mode; explicit rows of one or less request compact sizing.
