# Navigation Bar

`custom:nodalia-navigation-bar` combines dashboard routes, optional popup items
and embedded media players.

```yaml
type: custom:nodalia-navigation-bar
routes:
  - icon: mdi:home
    label: Home
    path: /lovelace/home
    popup:
      - icon: mdi:cog
        label: Settings
        path: /config/dashboard
media_player:
  players:
    - entity: media_player.living_room
      label: Living room
```

The visual editor retains each route's icon, label, path, user filters, active
paths and popup items when it moves. Popup descriptions and filters move with
those items. Legacy `items` becomes `routes`; malformed route/player/popup rows
are ignored. Missing, blank, negative or fractional removal indices cannot
remove another row. Unsupported row fields and distant indexed root paths are
ignored before mutation.

HA player pickers commit their selected value on `value-changed`; search-field
blur cannot overwrite that selection. Route and popup icon pickers also use the
committed event value. Editing a player label or browse path replaces its legacy
alias. Typed drafts, focus and unrelated YAML extensions remain intact.

Clearing a numeric field restores its default instead of becoming zero. Actual
zero remains zero in the animation editor. Styles keep translucent colors. The
embedded player uses the shared artwork tint for buttons, transport capsules and
stacked-player selectors; previous/ play/next stay centered between other controls.
See [Media Player](./media-player-card.md) and [styling](../STYLING.md).

Route popups and the media browser support native keyboard navigation. Tab and
Shift+Tab stay inside the current dialog; Escape closes it and restores its
opening control. Focus survives HA updates and media browsing. The player metadata
can also open its configured action with Enter or Space.

A player can set `browse_path` to expose the media-browser control; Music Assistant
players also receive their existing automatic path. Thumbnail URLs use the same
validation as artwork. Config changes, HA connection/auth/user changes and removal
discard pending browse results and release modal, resize, ticker and palette work.
Paused playback-position changes update progress in place. Actual volume steps use
the current control value, while configured service actions keep their explicit
target and false/zero data and remain subject to security settings.
