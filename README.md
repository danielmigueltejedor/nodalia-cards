# Nodalia Cards

Coleccion de tarjetas personalizadas de Home Assistant para el ecosistema Nodalia.

Ahora mismo incluye:

- `custom:nodalia-navigation-bar`
- `custom:nodalia-media-player`
- `custom:nodalia-light-card`
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

## Estructura

- `nodalia-cards.js`: entrypoint comun
- `nodalia-navigation-bar.js`: barra de navegacion
- `nodalia-media-player.js`: reproductor multimedia
- `nodalia-light-card.js`: tarjeta de iluminacion
- `nodalia-vacuum-card.js`: tarjeta de aspirador

## Siguiente paso recomendado

Cuando quieras, el siguiente refactor natural es extraer helpers compartidos a un modulo comun para evitar duplicidades entre ambas tarjetas sin cambiar su API publica.
