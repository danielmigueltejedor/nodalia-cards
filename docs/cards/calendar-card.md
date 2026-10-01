# Nodalia Calendar Card

`custom:nodalia-calendar-card` combines calendars with optional weather context.

```yaml
type: custom:nodalia-calendar-card
calendars:
  - entity: calendar.home
    label: Home
    tint: 'rgba(10, 20, 30, 0.3)'
  - entity: calendar.work
    label: Work
time_range: 1w
weather_entity: weather.home
```

The visual editor keeps each entity, visible label and tint together when rows
move. Blank draft rows can be named before choosing an entity; adding to an empty
list creates a second editable row alongside its visible placeholder. Missing
selected entities remain editable. Invalid, fractional or distant row indices and
unsupported row fields are ignored before modifying or extending the list.

Typed drafts and focus survive HA updates. Style, haptic and animation sections
use the bundle controls; editing a translucent tint retains its alpha. Clearing
numeric fields restores defaults: two visible events, a 300-second refresh and a
260-ms content animation. An explicit zero animation duration uses the existing
120-ms minimum. Unknown YAML and nested extension fields retain false and zero.
Language defaults to automatic detection.

Native-event webhook settings and their non-admin permission remain independent
of row editing; non-admin webhook access is disabled by default. The card requests
a minimum of six dashboard columns.

The checked view binds each refresh, forecast subscription and event write to
its configured calendars and HA connection. Old replies cannot replace current
events, release a newer refresh or show errors in a newly opened composer.
Subscriptions retain their connection receiver, release late unsubscribe handles
and retry after failure. Empty live forecasts clear the previous forecast rather
than restoring cached temperatures; actual zero remains visible.

Event drafts, toggle values, selected recurrence, custom colour and text caret
survive polling and HA updates. Creating twice while a write is pending sends one
request. Closing/reopening the composer or changing context isolates its result.
All-day and overnight events advance by a local calendar day across daylight
saving changes. Calendar entity names and delete capabilities update with HA.

Composer styles are maintained in a colocated CSS file, compacted and embedded
during both standalone and HACS builds. The resource remains self-contained and
uses the same translucent controls and dynamic title style.
