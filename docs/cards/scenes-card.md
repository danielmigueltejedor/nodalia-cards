# Nodalia Scenes Card

`custom:nodalia-scenes-card` launches Home Assistant `scene` entities. Install
the bundle resource `nodalia-cards.js`; the visual editor lets you choose scenes,
reorder them, and set names, icons, colours, actions and styles.

```yaml
type: custom:nodalia-scenes-card
name: Moods
layout: grid
columns: 3
scenes:
  - entity: scene.relax
    name: Relax
    icon: mdi:sofa
    color: '#c9a86c'
  - entity: scene.cinema
    name: Cinema
tap_action: activate
hold_action: more-info
```

`layout` accepts `grid` (default), `list`, or `single`; single shows the first
configured scene. Grid columns range from one to six, with three as the default.
A scene row may also be a plain entity ID. Tap and hold each accept `activate`,
`more-info`, or `none`; their defaults are `activate` and `more-info` respectively.
Unavailable entities cannot be activated.

The editor keeps newly added empty rows while you fill them in and exports only
rows with an entity. Reordering moves each row's name, icon and colour together.
Clearing a numeric override restores its default. Style, haptic and launch
animation settings use the bundle's editor controls; malformed nested groups
fall back safely. The card releases pending hold, scroll restoration and
animation work when disconnected, and handles failed service calls without an
uncaught error.
