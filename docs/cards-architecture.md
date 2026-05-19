# Nodalia cards — architecture index

Every card source file starts with a **module header** describing purpose, Lovelace tags, features, and shared patterns. Search for `Nodalia suite — file layout` in the repo to jump to that block.

## Bundle load order

See `scripts/build-bundle.mjs` — order matters:

1. `nodalia-i18n.js`, `nodalia-editor-ui.js`, `nodalia-utils.js`
2. `nodalia-visual-layout-editor.js` (before light card)
3. Shared: `render-signature`, `bubble-contrast`
4. Cards (light, fan, … vacuum)

Output: `nodalia-cards-<version>.js` (minified IIFE).

## Card catalog

| File | Lovelace type | Primary use |
|------|---------------|-------------|
| `nodalia-light-card.js` | `nodalia-light-card` | Lights + optional `visual_layout` |
| `nodalia-fan-card.js` | `nodalia-fan-card` | Fans |
| `nodalia-humidifier-card.js` | `nodalia-humidifier-card` | Humidifiers |
| `nodalia-cover-card.js` | `nodalia-cover-card` | Covers / blinds |
| `nodalia-climate-card.js` | `nodalia-climate-card` | Climate / HVAC dial |
| `nodalia-alarm-panel-card.js` | `nodalia-alarm-panel-card` | Alarm panels |
| `nodalia-entity-card.js` | `nodalia-entity-card` | Generic entity summary |
| `nodalia-fav-card.js` | `nodalia-fav-card` | Favorites grid |
| `nodalia-insignia-card.js` | `nodalia-insignia-card` | Compact badge |
| `nodalia-person-card.js` | `nodalia-person-card` | Person entities |
| `nodalia-weather-card.js` | `nodalia-weather-card` | Weather |
| `nodalia-calendar-card.js` | `nodalia-calendar-card` | Calendars |
| `nodalia-notifications-card.js` | `nodalia-notifications-card` | Alert hub |
| `nodalia-vacuum-card.js` | `nodalia-vacuum-card` | Vacuum (simple) |
| `nodalia-advance-vacuum-card.js` | `nodalia-advance-vacuum-card` | Vacuum + map |
| `nodalia-graph-card.js` | `nodalia-graph-card` | History chart |
| `nodalia-circular-gauge-card.js` | `nodalia-circular-gauge-card` | Sensor gauge |
| `nodalia-power-flow-card.js` | `nodalia-power-flow-card` | Energy flow |
| `nodalia-media-player.js` | `nodalia-media-player` | Media players |
| `nodalia-navigation-bar.js` | `nodalia-navigation-bar` | Bottom navigation |

## Shared modules

| Module | Global | Role |
|--------|--------|------|
| `nodalia-utils.js` | `NodaliaUtils` | deepEqual, stripEqualToDefaults, pickers, webhooks, registerCustomCard |
| `nodalia-i18n.js` | `NodaliaI18n` | Runtime translations |
| `nodalia-editor-ui.js` | (IIFE) | Generated editor form catalog |
| `nodalia-visual-layout-editor.js` | `NodaliaVisualLayout` | Drag-grid layout editor — [visual-layout-editor.md](./visual-layout-editor.md) |
| `nodalia-render-signature.js` | `NodaliaRenderSignature` | Cheap render cache keys |
| `nodalia-bubble-contrast.js` | `NodaliaBubbleContrast` | Icon contrast on tinted chips |

## Typical file structure

```
Module header (purpose + debugging hints)
CARD_TAG, DEFAULT_CONFIG, helpers
normalizeConfig()   ← validates YAML
class Nodalia*Card       ← dashboard runtime
class Nodalia*CardEditor ← config UI
registerCustomCard(...)
```

## Debugging workflow

1. Reproduce in HA with unminified sources or matching bundle version (`CARD_VERSION` in file).
2. Read the **module header** for that card.
3. Trace `setConfig` → `normalizeConfig` → `_render`.
4. Config not persisting: check `_emitConfig` and `stripEqualToDefaults` (light card also forces `visual_layout`).
5. Editor not updating: `config-changed` event and editor `setConfig` path.

## Re-applying headers on new cards

```bash
node scripts/apply-card-doc-headers.mjs
```

Add an entry to `CARD_HEADERS` in that script for new card files.
