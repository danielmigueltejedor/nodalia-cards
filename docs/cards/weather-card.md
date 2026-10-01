# Nodalia Weather Card

`custom:nodalia-weather-card` shows weather conditions, measurements and optional
forecast cards or a chart.

```yaml
type: custom:nodalia-weather-card
entity: weather.casa
show_forecast_details: true
forecast_type: hourly
forecast_view: cards
unit_system: auto
```

The visual editor provides forecast type/view, hourly/daily slot counts, chart
colours, unit system and temperature/wind unit preferences. Meteoalarm can use a
separate binary sensor. Missing selected entities remain selectable in native
fallback controls. Tap, hold and double-tap independently select more-info or
none. Shared style controls retain translucent colours; animation and haptic
sections use the standard bundle switches. Clearing a numeric override restores
its default, including five daily slots and 420 ms content animation.

Custom YAML fields and focus survive editor updates. Malformed nested animation,
haptic and picker values fall back safely. Absent measurements remain absent;
actual zero values remain visible.
