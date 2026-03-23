# Nodalia Cards

Coleccion de tarjetas personalizadas de Home Assistant para el ecosistema Nodalia.

Ahora mismo incluye:

- `custom:nodalia-navigation-bar`
- `custom:nodalia-media-player`
- `custom:nodalia-light-card`
- `custom:nodalia-fan-card`
- `custom:nodalia-humidifier-card`
- `custom:nodalia-alarm-panel-card`
- `custom:nodalia-entity-card`
- `custom:nodalia-fav-card`
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
- `nodalia-alarm-panel-card.js`
- `nodalia-entity-card.js`
- `nodalia-fav-card.js`
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
- url: /local/nodalia-alarm-panel-card.js
  type: module
- url: /local/nodalia-entity-card.js
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

### Nodalia Alarm Panel Card

```yaml
type: custom:nodalia-alarm-panel-card
entity: alarm_control_panel.casa
name: Alarma
code_entity: input_text.codigo_alarma
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

## Estructura

- `nodalia-cards.js`: entrypoint comun
- `nodalia-navigation-bar.js`: barra de navegacion
- `nodalia-media-player.js`: reproductor multimedia
- `nodalia-light-card.js`: tarjeta de iluminacion
- `nodalia-fan-card.js`: tarjeta de ventilador
- `nodalia-humidifier-card.js`: tarjeta de humidificador o deshumidificador
- `nodalia-alarm-panel-card.js`: tarjeta elegante para paneles de alarma
- `nodalia-entity-card.js`: tarjeta todoterreno para cualquier entidad
- `nodalia-fav-card.js`: tarjeta mini para favoritos y controles rapidos
- `nodalia-vacuum-card.js`: tarjeta de aspirador

## Siguiente paso recomendado

Cuando quieras, el siguiente refactor natural es extraer helpers compartidos a un modulo comun para evitar duplicidades entre ambas tarjetas sin cambiar su API publica.
