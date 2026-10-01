# Nodalia Alarm Panel Card

`custom:nodalia-alarm-panel-card` controls an alarm panel and displays its state.
It supports a manual PIN, a configured code or an input-text code helper.

```yaml
type: custom:nodalia-alarm-panel-card
entity: alarm_control_panel.casa
code_entity: input_text.pin
show_code_input: auto
wrong_code_feedback_ms: 5000
styles:
  state_tints:
    disarmed: rgba(130, 209, 138, 0.3)
```

The visual editor provides code visibility (`auto`, `always`, `never`), arm-mode
visibility, PIN/helper fields, state tint colours and the standard bundle style,
haptic and animation sections. State tints retain custom translucent colours;
unsafe CSS falls back to the default. Missing alarm and code helper selections
remain available in native fallback pickers.

Clearing numeric settings restores defaults rather than treating empty input as
zero. The wrong-code feedback interval defaults to 5,000 ms and valid explicit
values are bounded to 2,000–30,000 ms. Malformed nested settings and picker values
fall back safely. Custom YAML fields and focus survive editing. Pending deferred
updates are cancelled when replacing configuration or removing the editor;
keyboard toggles work after an abandoned pointer interaction.

The card requests a minimum of four dashboard columns.

The view refreshes pending arm modes when HA attributes change. PIN verification
continues after a service request resolves and ends when HA confirms a state
change. Rejected or synchronous failures show native feedback only for the
current action and entity. Switching entities, losing the entity or removing the
card clears typed PINs and owned timers. Live updates preserve PIN focus and keep
a pressed action mounted until its native click; pointer cancellation releases
deferred rendering. Resize rendering runs outside the observer callback to avoid
Safari mobile resize loops.
