# Device and Climate layouts

Fan, Humidifier, Cover and Climate support the same two layout names:

| Value | Description |
|---|---|
| `compact` | Horizontal device-card layout with direct sliders and controls. |
| `circular` | Larger Climate-style surface with a 270-degree value ring and centred controls. |

The visual editor exposes both values under **Layout**.

## Defaults and compatibility

Existing dashboards do not change appearance after updating:

| Card | Default layout |
|---|---|
| Fan | `compact` |
| Humidifier | `compact` |
| Cover | `compact` |
| Climate | `circular` |

An empty or unsupported `layout` value falls back to that card's original layout. `compact_layout_mode` remains the responsive density setting inside the compact Fan, Humidifier and Cover layouts; it does not select the new circular variant.

## Circular device cards

```yaml
type: custom:nodalia-fan-card
entity: fan.living_room
layout: circular
```

```yaml
type: custom:nodalia-humidifier-card
entity: humidifier.bedroom
layout: circular
```

```yaml
type: custom:nodalia-cover-card
entity: cover.terrace
layout: circular
```

The circular variants retain the entity-specific controls:

- Fan shows percentage, power, oscillation and presets when supported.
- Humidifier shows target humidity, power, modes and fan modes when supported.
- Cover shows position, open/stop/close, position steps and tilt when supported.

The 270° value ring is interactive: drag the arc or thumb to set the value, or use the − / + step buttons. Power stays on the centre control (Fan and Humidifier) so card taps outside the dial and steps still toggle when configured.

Unsupported controls are omitted using the same Home Assistant feature checks as the compact layouts.

## Compact Climate card

```yaml
type: custom:nodalia-climate-card
entity: climate.living_room
layout: compact
```

The compact Climate layout provides a horizontal target-temperature slider, HVAC mode controls and the existing step and schedule actions. In `heat_cool` mode it renders separate low and high sliders and continues to send `target_temp_low` and `target_temp_high` together. Engine schedule overrides remain available in both layouts.

### Climate schedule storage

Climate retains the weekly agenda and existing Engine/webhook integration.
Native schedule helpers can read the legacy row format (v1), packed JSON (v2)
and binary base64 (v3). Compact storage retains five-minute time quantization
and quarter-degree temperature precision. The `input_text` limit is 255
characters; the existing save flow checks that limit before sending a helper
update. Corrupt packed values/base64 do not create schedule slots.

A missing or blank slot temperature defaults to 21; an actual zero remains a
value. Optional low/high bounds are retained only when both are numeric and low
does not exceed high. Missing bounds do not become zero. Existing HVAC/fan/preset
fields remain in the normalized schedule and webhook body. Blank or malformed
style/security/display groups fall back through the same checked configuration
projection used by the card; service and webhook authorization policies remain.
