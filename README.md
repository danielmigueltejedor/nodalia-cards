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
- `custom:nodalia-insignia-card`
- `custom:nodalia-person-card`
- `custom:nodalia-weather-card`
- `custom:nodalia-vacuum-card`

## Instalacion

### Opcion 1: un solo recurso

Usa el bundle principal:

```yaml
url: /local/nodalia-cards.js
type: module
```

Si instalas la tarjeta desde HACS, Home Assistant servira este mismo bundle desde
`/hacsfiles/nodalia-cards/nodalia-cards.js`. Tras publicar un release nuevo y actualizar
desde HACS, conviene hacer una recarga fuerte del navegador para evitar quedarte con una
version antigua en cache.

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
- `nodalia-insignia-card.js`
- `nodalia-person-card.js`
- `nodalia-weather-card.js`
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
- url: /local/nodalia-insignia-card.js
  type: module
- url: /local/nodalia-person-card.js
  type: module
- url: /local/nodalia-weather-card.js
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

Configuracion minima:

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

Configuracion recomendada para Roborock con persistencia compartida entre dispositivos:

```yaml
type: custom:nodalia-advance-vacuum-card
entity: vacuum.roborock_qrevo_s
name: Roborock Qrevo S
vacuum_platform: Roborock
shared_cleaning_session_entity: input_text.roborock_qrevo_s_cleaning_session

map_source:
  camera: image.roborock_qrevo_s_calzada_de_los_molinos_custom

calibration_source:
  camera: true

map_locked: true
two_finger_pan: false
language: es

show_state_chip: true
show_battery_chip: true
show_room_labels: true
show_room_markers: true
show_header_icons: true
show_return_to_base: true
show_stop: true
show_locate: true

allow_segment_mode: true
allow_zone_mode: true
allow_goto_mode: true

max_zone_selections: 5
max_repeats: 3

suction_select_entity: select.roborock_qrevo_s_nivel_de_aspirado
mop_select_entity: select.roborock_qrevo_s_nivel_de_fregado
mop_mode_select_entity: select.roborock_qrevo_s_modo_de_limpieza

icons:
  - icon: mdi:arrow-left
    tooltip: Atras
    order: 1
    tap_action:
      action: navigate
      navigation_path: /lovelace/principal

haptics:
  enabled: true
  style: medium
  fallback_vibrate: false
```

Helper recomendado para compartir la seleccion activa de habitaciones y zonas entre PC, movil o tablet:

```yaml
input_text:
  roborock_qrevo_s_cleaning_session:
    name: Roborock Qrevo S Cleaning Session
    max: 255
```

Campos principales:

- `entity`: entidad principal del robot (`vacuum.*`).
- `name`: nombre mostrado en la tarjeta.
- `vacuum_platform`: usa `Roborock` en la mayoria de instalaciones Roborock. Si tu integracion depende de comandos manuales, puedes usar `send_command`.
- `map_source.camera`: entidad `image.*` o `camera.*` que devuelve el mapa del robot.
- `calibration_source.camera`: usa `true` si esa misma entidad del mapa ya expone `calibration_points`.
- `shared_cleaning_session_entity`: helper `input_text.*` opcional pero recomendado si quieres que la persistencia de habitaciones y zonas funcione entre varios dispositivos.
- `suction_select_entity`: selector explicito del nivel de aspirado. Ponlo si la autodeteccion no acierta.
- `mop_select_entity`: selector explicito del nivel o intensidad de fregado.
- `mop_mode_select_entity`: selector explicito del modo combinado de limpieza si tu robot distingue `aspirar`, `aspirar y fregar` o `fregar`.
- `allow_segment_mode`, `allow_zone_mode`, `allow_goto_mode`: activan o desactivan los modos `Habitaciones`, `Zona` e `Ir a punto`.
- `max_zone_selections`: numero maximo de zonas rectangulares activas a la vez.
- `max_repeats`: repeticiones maximas permitidas en la UI.
- `show_state_chip`, `show_battery_chip`, `show_room_labels`, `show_room_markers`, `show_header_icons`, `show_return_to_base`, `show_stop`, `show_locate`: controlan la visibilidad de cada parte de la tarjeta.
- `icons`: accesos rapidos en la cabecera superior.
- `styles`: personalizacion visual completa de tarjeta, mapa, chips y controles.

Si tu entidad de mapa ya expone habitaciones, puntos o zonas, no hace falta rellenar `room_segments`, `goto_points` ni `predefined_zones`.

Si tu mapa no expone habitaciones, puedes definirlas manualmente asi:

```yaml
room_segments:
  - id: "16"
    label: Salon
    icon: mdi:sofa
    outline:
      - [24770, 25548]
      - [27453, 25548]
      - [27453, 28731]
      - [24770, 28731]
    labelPoint: [26100, 27100]
  - id: "17"
    label: Cocina
    icon: mdi:silverware-fork-knife
    outline:
      - [27453, 25548]
      - [29810, 25548]
      - [29810, 28731]
      - [27453, 28731]
    labelPoint: [28600, 27100]
```

Tambien puedes definir puntos de destino:

```yaml
goto_points:
  - id: mesa
    label: Mesa
    icon: mdi:table-furniture
    position: [26500, 27000]
  - id: entrada
    label: Entrada
    icon: mdi:door
    position: [23000, 29200]
```

Y zonas predefinidas:

```yaml
predefined_zones:
  - id: alfombra_salon
    label: Alfombra salon
    icon: mdi:rug
    zones:
      - [25200, 26000, 27000, 27800]
  - id: bajo_mesa
    label: Bajo la mesa
    icon: mdi:table-chair
    zones:
      - [25900, 26600, 27200, 27900]
      - [27200, 26600, 28500, 27900]
```

Notas utiles:

- `room_segments` acepta `outline`, `outlines`, `zones`, `rectangles`, `segments`, `areas` o `polygons`, siempre que representen un poligono valido.
- `goto_points.position` acepta `[x, y]` o `{ x: ..., y: ... }`.
- `predefined_zones.zones` usa rectangulos en formato `[x1, y1, x2, y2]`.
- Si el modo visual de aspirado/fregado no se detecta bien en tu robot, configura explicitamente `suction_select_entity`, `mop_select_entity` y `mop_mode_select_entity`.
- Si usas HACS y acabas de actualizar, haz recarga fuerte del navegador para evitar que quede JS antiguo en cache.

### Nodalia Weather Card

```yaml
type: custom:nodalia-weather-card
entity: weather.casa
name: Tiempo
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

### Nodalia Insignia Card

```yaml
type: custom:nodalia-insignia-card
entity: sensor.temperatura_salon
name: Salon
use_entity_icon: true
show_name: true
show_value: true
tap_action: more-info
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
- `nodalia-insignia-card.js`: insignia compacta estilo chip burbuja
- `nodalia-person-card.js`: tarjeta compacta de personas con foto y zona
- `nodalia-weather-card.js`: tarjeta meteorologica elegante
- `nodalia-vacuum-card.js`: tarjeta de aspirador

## Siguiente paso recomendado

Cuando quieras, el siguiente refactor natural es extraer helpers compartidos a un modulo comun para evitar duplicidades entre ambas tarjetas sin cambiar su API publica.
