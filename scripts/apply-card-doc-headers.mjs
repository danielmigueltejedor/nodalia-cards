/**
 * One-shot helper: prepends module headers and class doc comments to Nodalia card sources.
 * Safe to re-run (skips files that already contain "Nodalia suite — file layout").
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const SUITE_FOOTER = ` *
 * Nodalia suite — file layout
 * - DEFAULT_CONFIG + normalizeConfig(): defaults and validation on every setConfig.
 * - Nodalia*Card: Lovelace runtime (setConfig, hass, shadow DOM _render).
 * - Nodalia*CardEditor: card config UI (dispatches config-changed).
 * - window.NodaliaUtils.registerCustomCard at file end.
 *
 * Shared behaviour
 * - Actions: tap / hold / double_tap (+ icon_*); security.strict_service_actions filters services.
 * - Haptics: HAPTIC_PATTERNS + config.haptics.
 * - Styles: config.styles → CSS variables on :host.
 * - i18n: ed.* keys via window.NodaliaI18n / editor UI bundles.
 */`;

const CARD_HEADERS = {
  "nodalia-light-card.js": `/**
 * Nodalia Light card — rich control for \`light.*\` entities.
 *
 * Lovelace: \`nodalia-light-card\` / \`nodalia-light-card-editor\`
 *
 * Features: brightness & color/temp sliders, presets, compact layout, optional visual_layout grid
 * (see LIGHT_VISUAL_LAYOUT_CATALOG and docs/visual-layout-editor.md).
 *
 * Debugging
 * - Layout not saved → _commitVisualLayout / _emitConfig visual_layout re-attach.
 * - Card toggles while editing layout → data-vlayout-editing guards on pointer handlers.
${SUITE_FOOTER}`,

  "nodalia-fan-card.js": `/**
 * Nodalia Fan card — \`fan.*\` speed, presets, oscillation.
 *
 * Lovelace: \`nodalia-fan-card\` / \`nodalia-fan-card-editor\`
 *
 * Features: percentage slider, preset modes, optimistic UI (OPTIMISTIC_*), last-visual localStorage.
${SUITE_FOOTER}`,

  "nodalia-humidifier-card.js": `/**
 * Nodalia Humidifier card — \`humidifier.*\` target humidity and modes.
 *
 * Lovelace: \`nodalia-humidifier-card\` / \`nodalia-humidifier-card-editor\`
 *
 * Features: humidity slider, mode/preset chips, compact layout, service actions.
${SUITE_FOOTER}`,

  "nodalia-cover-card.js": `/**
 * Nodalia Cover card — \`cover.*\` position, tilt, open/close/stop.
 *
 * Lovelace: \`nodalia-cover-card\` / \`nodalia-cover-card-editor\`
 *
 * Features: COVER_FEATURES bitmask gates controls; position/tilt sliders; open_close_icons auto.
${SUITE_FOOTER}`,

  "nodalia-climate-card.js": `/**
 * Nodalia Climate card — \`climate.*\` with circular temperature dial.
 *
 * Lovelace: \`nodalia-climate-card\` / \`nodalia-climate-card-editor\`
 *
 * Features: arc dial (DIAL_* constants), target/current display swap, HVAC mode buttons,
 * draft confirmation for set_temperature (DRAFT_CONFIRMATION_*).
 *
 * Note: NodaliaClimateCardEditorLegacy remains for older editor embedding paths.
${SUITE_FOOTER}`,

  "nodalia-alarm-panel-card.js": `/**
 * Nodalia Alarm panel card — \`alarm_control_panel.*\` arm/disarm UI.
 *
 * Lovelace: \`nodalia-alarm-panel-card\` / \`nodalia-alarm-panel-card-editor\`
 *
 * Features: code entry, arm modes, state chips; respects alarm panel features from HA.
${SUITE_FOOTER}`,

  "nodalia-entity-card.js": `/**
 * Nodalia Entity card — generic summary for any entity domain.
 *
 * Lovelace: \`nodalia-entity-card\` / \`nodalia-entity-card-editor\`
 *
 * Features: primary/secondary attributes, quick_actions row, tap_action auto (toggle vs more-info),
 * compact layout, navigation_path support.
${SUITE_FOOTER}`,

  "nodalia-fav-card.js": `/**
 * Nodalia Favorites card — quick-launch grid of entities + optional alarm controls.
 *
 * Lovelace: \`nodalia-fav-card\` / \`nodalia-fav-card-editor\`
 *
 * Features: mini/inline layout thresholds; can embed alarm arm tiles (FEATURE_ARM_*).
${SUITE_FOOTER}`,

  "nodalia-insignia-card.js": `/**
 * Nodalia Insignia card — compact badge (icon + name + value) for dashboards.
 *
 * Lovelace: \`nodalia-insignia-card\` / \`nodalia-insignia-card-editor\`
 *
 * Features: minimal footprint, state_attribute override, active/inactive icons.
${SUITE_FOOTER}`,

  "nodalia-person-card.js": `/**
 * Nodalia Person card — \`person.*\` presence and tracking display.
 *
 * Lovelace: \`nodalia-person-card\` / \`nodalia-person-card-editor\`
 *
 * Features: entity picture, zone/state chips, tap actions.
${SUITE_FOOTER}`,

  "nodalia-weather-card.js": `/**
 * Nodalia Weather card — \`weather.*\` forecast and current conditions.
 *
 * Lovelace: \`nodalia-weather-card\` / \`nodalia-weather-card-editor\`
 *
 * Features: multi-day forecast rows, condition icons, optional secondary sensors.
${SUITE_FOOTER}`,

  "nodalia-calendar-card.js": `/**
 * Nodalia Calendar card — aggregated calendar entities and event list.
 *
 * Lovelace: \`nodalia-calendar-card\` / \`nodalia-calendar-card-editor\`
 *
 * Features: time_range / days_to_show, nodalia event color metadata in descriptions,
 * optional delete with recurrence (CALENDAR_DELETE_RECURRENCE_*), weather_entity hook.
${SUITE_FOOTER}`,

  "nodalia-notifications-card.js": `/**
 * Nodalia Notifications card — dashboard alert hub (not a single HA entity).
 *
 * Lovelace: \`nodalia-notifications-card\` / \`nodalia-notifications-card-editor\`
 *
 * Features: scans configured entity groups (vacuum, climate, doors, etc.); dismiss state in
 * localStorage (STORAGE_KEY) and optional dismissed_entity helper.
${SUITE_FOOTER}`,

  "nodalia-vacuum-card.js": `/**
 * Nodalia Vacuum card — standard \`vacuum.*\` controls and status.
 *
 * Lovelace: \`nodalia-vacuum-card\` / \`nodalia-vacuum-card-editor\`
 *
 * Features: start/pause/dock actions, map-agnostic layout; simpler than advance-vacuum.
${SUITE_FOOTER}`,

  "nodalia-advance-vacuum-card.js": `/**
 * Nodalia Advance vacuum card — map, rooms, zones, routines, dock panels.
 *
 * Lovelace: \`nodalia-advance-vacuum-card\` / \`nodalia-advance-vacuum-card-editor\`
 *
 * Features: CoordinatesConverter for map overlays; shared cleaning session via input_text helper;
 * PANEL_MODE_PRESETS / DOCK_PANEL_SECTIONS; large surface — search by method name when debugging.
${SUITE_FOOTER}`,

  "nodalia-graph-card.js": `/**
 * Nodalia Graph card — history chart for one or more entities.
 *
 * Lovelace: \`nodalia-graph-card\` / \`nodalia-graph-card-editor\`
 *
 * Features: SVG/Canvas history, SERIES_COLORS, touch hold vs tap (TOUCH_CHART_HOLD_MS).
 * NodaliaGraphCardEditorLegacy kept for compatibility.
${SUITE_FOOTER}`,

  "nodalia-circular-gauge-card.js": `/**
 * Nodalia Circular gauge card — sensor value on an arc dial (not climate HVAC).
 *
 * Lovelace: \`nodalia-circular-gauge-card\` / \`nodalia-circular-gauge-card-editor\`
 *
 * Features: min/max (entity or fixed), tint segments (GAUGE_TINT_SEGMENT_COUNT), percentage chip.
${SUITE_FOOTER}`,

  "nodalia-power-flow-card.js": `/**
 * Nodalia Power flow card — energy diagram (grid, solar, battery, home, optional water/gas).
 *
 * Lovelace: \`nodalia-power-flow-card\` / \`nodalia-power-flow-card-visual-editor\`
 *
 * Features: animated flows, NODE_DEFAULTS, home details overlay (home_tap_action),
 * visual editor for node positions. Editor class is NodaliaPowerFlowCardVisualEditor.
${SUITE_FOOTER}`,

  "nodalia-media-player.js": `/**
 * Nodalia Media player card — \`media_player.*\` transport and browse (incl. Music Assistant).
 *
 * Lovelace: \`nodalia-media-player\` / \`nodalia-media-player-editor\`
 *
 * Features: browse media tree, MUSIC_ASSISTANT_* filters, album/artist directory icons.
${SUITE_FOOTER}`,

  "nodalia-navigation-bar.js": `/**
 * Nodalia Navigation bar — bottom dashboard nav (views / actions / media shortcuts).
 *
 * Lovelace: \`nodalia-navigation-bar\` / \`nodalia-navigation-bar-editor\`
 *
 * Features: route items, optional embedded media browser patterns (shared with media-player).
${SUITE_FOOTER}`,
};

const MODULE_HEADERS = {
  "nodalia-bubble-contrast.js": `/**
 * Nodalia bubble contrast — picks readable icon glyph color on tinted chip backgrounds.
 * Exposed as window.NodaliaBubbleContrast (used by entity/light chips in the editor preview).
 */`,
  "nodalia-i18n.js": `/**
 * Nodalia runtime i18n — resolves ed.* / card strings from bundled locale packs.
 * window.NodaliaI18n.t(key, hass). Editors may call resolveHass() when hass is not yet on element.
 */`,
  "nodalia-editor-ui.js": `/**
 * Nodalia editor UI — generated/shared form controls for card config screens (ha-form helpers).
 * Do not hand-edit large generated sections; run scripts/gen-editor-ui.mjs when adding keys.
 */`,
};

const CLASS_COMMENTS = [
  [/^(class NodaliaMediaPlayer extends HTMLElement \{\n)/m, "/** Lovelace dashboard card (runtime). */\n$1"],
  [/^(class NodaliaMediaPlayerEditor extends HTMLElement \{\n)/m, "/** Lovelace card configuration UI (emits config-changed). */\n$1"],
  [/^(class NodaliaNavigationBarCard extends HTMLElement \{\n)/m, "/** Lovelace dashboard card (runtime). */\n$1"],
  [/^(class NodaliaNavigationBarEditor extends HTMLElement \{\n)/m, "/** Lovelace card configuration UI (emits config-changed). */\n$1"],
  [/^(class Nodalia\w+Card extends HTMLElement \{\n)/m, "/** Lovelace dashboard card (runtime). */\n$1"],
  [
    /^(class Nodalia\w+CardEditor(?:Legacy)? extends HTMLElement \{\n)/m,
    "/** Lovelace card configuration UI (emits config-changed). */\n$1",
  ],
  [
    /^(class NodaliaPowerFlowCardVisualEditor extends HTMLElement \{\n)/m,
    "/** Power-flow visual layout editor (node positions). */\n$1",
  ],
  [/^(class CoordinatesConverter \{\n)/m, "/** Map coordinate transforms for advance vacuum overlays. */\n$1"],
];

function applyFile(relPath, header) {
  const filePath = path.join(root, relPath);
  if (!fs.existsSync(filePath)) {
    console.warn("skip missing", relPath);
    return;
  }
  let src = fs.readFileSync(filePath, "utf8");
  if (src.includes("Nodalia suite — file layout") || src.includes("Nodalia bubble contrast")) {
    console.log("skip (already documented):", relPath);
    return;
  }
  if (!src.startsWith("const CARD_TAG") && !src.startsWith("(function") && !src.startsWith("(()")) {
    console.warn("unexpected start:", relPath);
  }
  src = `${header}\n${src}`;
  for (const [re, repl] of CLASS_COMMENTS) {
    src = src.replace(re, repl);
  }
  fs.writeFileSync(filePath, src);
  console.log("updated:", relPath);
}

for (const [file, header] of Object.entries(CARD_HEADERS)) {
  applyFile(file, header);
}
for (const [file, header] of Object.entries(MODULE_HEADERS)) {
  const filePath = path.join(root, file);
  let src = fs.readFileSync(filePath, "utf8");
  if (src.includes(header.slice(4, 40))) {
    console.log("skip module:", file);
    continue;
  }
  fs.writeFileSync(filePath, `${header}\n${src}`);
  console.log("updated module:", file);
}
