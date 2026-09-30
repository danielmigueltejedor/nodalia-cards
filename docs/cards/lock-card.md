# Lock Card

```yaml
type: custom:nodalia-lock-card
entity: lock.front_door
name: Front Door
layout: standard
unlock_action: slider
show_name: true
show_state: true
```

Use `layout: compact` for a smaller surface. Both layouts require a deliberate slide to unlock. Drag the handle from its starting position to the end and release. Releasing early, moving away vertically, cancelling the pointer, changing entity or removing the card cancels the gesture. Tapping anywhere on the track does not unlock.

Keyboard users can focus the slider, press Right ten times and then Enter. Left moves back; Home, Escape and leaving the control reset it. Holding a key does not advance it automatically. Screen readers receive the slider's progress and instructions.

Locking an unlocked entity takes one tap. Controls stay disabled during commands until Home Assistant reports the target state. After 15 seconds without confirmation the card shows an error; verify the physical lock before retrying. Errors never cause an automatic retry. Locked, unlocked, locking, unlocking, jammed, unknown and unavailable states are displayed. Jammed and unavailable entities cannot be operated from this card.

Only `unlock_action: slider` is supported. PIN-required locks and open-latch commands are not supported in this version; use the integration's controls for those operations. The Home Assistant lock service remains responsible for permission checks and device-specific requirements.

The visual editor provides a lock entity picker, name, layout, and name/state visibility switches. Its collapsible Styles section shares color controls and corner-radius presets with the other Nodalia editors. Runtime labels follow the dashboard language.

Styles use the same nested YAML convention as the rest of the bundle. For example:

```yaml
styles:
  card:
    border_radius: 20px
    padding: 18px
  icon:
    size: 48px
    on_color: "#6acb9a"
  chip_border_radius: 12px
```

Card background, border, shadow, padding and gap; icon size, background and state colors; handle size/background; title and chip font sizes are configurable. Styling never replaces deliberate slide-to-unlock confirmation. Room Summary uses this same native Lock Card for its lock entities.
