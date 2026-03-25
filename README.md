# Nodalia Cards

Coleccion de tarjetas personalizadas de Home Assistant para el ecosistema Nodalia.

Ahora mismo incluye:

- `custom:nodalia-navigation-bar`
- `custom:nodalia-media-player`
- `custom:nodalia-light-card`
- `custom:nodalia-fan-card`
- `custom:nodalia-humidifier-card`
- `custom:nodalia-circular-gauge-card`
- `custom:nodalia-graph-card`
- `custom:nodalia-power-flow-card`
- `custom:nodalia-climate-card`
- `custom:nodalia-alarm-panel-card`
- `custom:nodalia-advance-vacuum-card`
- `custom:nodalia-entity-card`
- `custom:nodalia-fav-card`
- `custom:nodalia-person-card`
- `custom:nodalia-weather-card`
- `custom:nodalia-calendar-card`
- `custom:nodalia-vacuum-card`

## Instalacion

### Opcion 1: un solo recurso

Usa el bundle principal:

```yaml
url: /local/nodalia-cards.js
type: module
```

Ese recurso carga automaticamente:

- `nodalia-navigation-bar.js`
- `nodalia-media-player.js`
- `nodalia-light-card.js`
- `nodalia-fan-card.js`
- `nodalia-humidifier-card.js`
- `nodalia-circular-gauge-card.js`
- `nodalia-graph-card.js`
- `nodalia-power-flow-card.js`
- `nodalia-climate-card.js`
- `nodalia-alarm-panel-card.js`
- `nodalia-advance-vacuum-card.js`
- `nodalia-entity-card.js`
- `nodalia-fav-card.js`
- `nodalia-person-card.js`
- `nodalia-weather-card.js`
- `nodalia-calendar-card.js`
- `nodalia-vacuum-card.js`

### Opcion 2: recursos individuales

Si prefieres cargarlas por separado:

```yaml
- url: /local/nodalia-navigation-bar.js
  type: module
- url: /local/nodalia-media-player.js
  type: module
- url: /local/nodalia-light-card.js
  type: module
- url: /local/nodalia-fan-card.js
  type: module
- url: /local/nodalia-humidifier-card.js
  type: module
- url: /local/nodalia-circular-gauge-card.js
  type: module
- url: /local/nodalia-graph-card.js
  type: module
- url: /local/nodalia-power-flow-card.js
  type: module
- url: /local/nodalia-climate-card.js
  type: module
- url: /local/nodalia-alarm-panel-card.js
  type: module
- url: /local/nodalia-advance-vacuum-card.js
  type: module
- url: /local/nodalia-entity-card.js
  type: module
- url: /local/nodalia-fav-card.js
  type: module
- url: /local/nodalia-person-card.js
  type: module
- url: /local/nodalia-weather-card.js
  type: module
- url: /local/nodalia-calendar-card.js
  type: module
- url: /local/nodalia-vacuum-card.js
  type: module
```

## Tarjetas disponibles

### Nodalia Navigation Bar

```yaml
type: custom:nodalia-navigation-bar
show_labels: false
routes:
  - icon: mdi:home-assistant
    path: /lovelace/principal
  - icon: mdi:flash
    path: /lovelace/energia
  - icon: mdi:thermostat
    path: /lovelace/termostatos
  - icon: mdi:security
    path: /lovelace/seguridad
```

### Nodalia Media Player

```yaml
type: custom:nodalia-media-player
players:
  - entity: media_player.spotify
    label: Spotify
```

### Nodalia Light Card

```yaml
type: custom:nodalia-light-card
entity: light.salon
name: Salon
```

### Nodalia Vacuum Card

```yaml
type: custom:nodalia-vacuum-card
entity: vacuum.salon
name: Robot salon
```

### Nodalia Fan Card

```yaml
type: custom:nodalia-fan-card
entity: fan.salon
name: Salon
```

### Nodalia Humidifier Card

```yaml
type: custom:nodalia-humidifier-card
entity: humidifier.deshumidificador
name: Deshumidificador
```

### Nodalia Circular Gauge Card

```yaml
type: custom:nodalia-circular-gauge-card
entity: sensor.enchufe_inteligente_potencia
name: Potencia
min: 0
max: 2500
show_percentage_chip: true
```

### Nodalia Graph Card

```yaml
type: custom:nodalia-graph-card
name: Humedad
entities:
  - entity: sensor.termostato_dormitorios_humedad
    name: Dormitorio de Rocio
  - entity: sensor.termostato_habitaciones_comunes_humedad
    name: Pasillo
```

### Nodalia Power Flow Card

```yaml
type: custom:nodalia-power-flow-card
title: Energia
entities:
  grid:
    entity: sensor.shelly_pro_3em_puerto_c_potencia
  home:
    entity: sensor.shelly_pro_3em_puerto_c_potencia
dashboard_link: /energy/overview
```

### Nodalia Climate Card

```yaml
type: custom:nodalia-climate-card
entity: climate.salon
name: Salon
```

### Nodalia Alarm Panel Card

```yaml
type: custom:nodalia-alarm-panel-card
entity: alarm_control_panel.casa
name: Alarma
code_entity: input_text.codigo_alarma
```

### Nodalia Advance Vacuum Card

```yaml
type: custom:nodalia-advance-vacuum-card
entity: vacuum.roborock_qrevo_s
name: Roborock Qrevo S
map_source:
  camera: image.roborock_qrevo_s_calzada_de_los_molinos_custom
calibration_source:
  camera: true
vacuum_platform: Roborock
```

### Nodalia Weather Card

```yaml
type: custom:nodalia-weather-card
entity: weather.casa
name: Tiempo
```

### Nodalia Calendar Card

```yaml
type: custom:nodalia-calendar-card
entity: calendar.casa
name: Calendario
show_status_chip: true
show_date_chip: true
show_time_chip: true
show_location_chip: true
show_description: true
```

### Nodalia Entity Card

```yaml
type: custom:nodalia-entity-card
entity: switch.lampara
name: Lampara
tap_action: auto
show_state: true
quick_actions:
  - icon: mdi:power
    type: toggle
  - icon: mdi:cog
    type: more-info
```

### Nodalia Fav Card

```yaml
type: custom:nodalia-fav-card
entity: light.sofa
name: Sofa
tap_action: auto
show_state: false
grid_options:
  columns: 2
  rows: 1
```

### Nodalia Person Card

```yaml
type: custom:nodalia-person-card
entity: person.rocio
name: Rocio
show_state: true
show_zone_badge: true
```

## Estructura

- `nodalia-cards.js`: entrypoint comun
- `nodalia-navigation-bar.js`: barra de navegacion
- `nodalia-media-player.js`: reproductor multimedia
- `nodalia-light-card.js`: tarjeta de iluminacion
- `nodalia-fan-card.js`: tarjeta de ventilador
- `nodalia-humidifier-card.js`: tarjeta de humidificador o deshumidificador
- `nodalia-circular-gauge-card.js`: tarjeta circular para sensores y valores numericos
- `nodalia-graph-card.js`: tarjeta de grafica elegante para una o varias entidades
- `nodalia-power-flow-card.js`: tarjeta de flujo energetico para red, solar, bateria, agua, gas y consumos
- `nodalia-climate-card.js`: tarjeta de clima con dial circular
- `nodalia-alarm-panel-card.js`: tarjeta elegante para paneles de alarma
- `nodalia-advance-vacuum-card.js`: tarjeta avanzada de mapa para robots aspiradores
- `nodalia-entity-card.js`: tarjeta todoterreno para cualquier entidad
- `nodalia-fav-card.js`: tarjeta mini para favoritos y controles rapidos
- `nodalia-person-card.js`: tarjeta compacta de personas con foto y zona
- `nodalia-weather-card.js`: tarjeta meteorologica elegante
- `nodalia-calendar-card.js`: tarjeta elegante para proximos eventos de calendario
- `nodalia-vacuum-card.js`: tarjeta de aspirador

## Siguiente paso recomendado

Cuando quieras, el siguiente refactor natural es extraer helpers compartidos a un modulo comun para evitar duplicidades entre ambas tarjetas sin cambiar su API publica.
