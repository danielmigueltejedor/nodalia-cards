import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("entity suggestions describe a real card instead of a duplicate compact row", () => {
  const entity = read("src/cards/entity/entity-card.ts");
  assert.match(entity, /label: "Entity"/);
  assert.doesNotMatch(entity, /Entity — Compact/);
  assert.doesNotMatch(entity, /Entity — Standard/);
});

test("device suggestions follow features that change the rendered card", () => {
  const light = read("src/cards/light/light-card.ts");
  assert.match(light, /label: "Light — Compact"/);
  assert.match(light, /label: "Light — Brightness"/);
  assert.match(light, /show_brightness: false/);
  assert.match(light, /show_color_controls: color/);
  assert.doesNotMatch(light, /Light — Standard/);

  const fan = read("src/cards/fan/fan-card.ts");
  assert.match(fan, /label: "Fan — Compact"/);
  assert.match(fan, /label: "Fan — Speed"/);
  assert.match(fan, /label: "Fan — Circular"/);
  assert.match(fan, /layout: "circular"/);

  const vacuum = read("src/cards/vacuum/vacuum-card.ts");
  assert.match(vacuum, /label: "Vacuum — Controls"/);
  assert.match(vacuum, /label: "Vacuum — Modes"/);
  assert.match(vacuum, /vacuumHasFanSpeeds\(state\)/);

  const cover = read("src/cards/cover/cover-card.ts");
  assert.match(cover, /label: "Cover — Buttons"/);
  assert.match(cover, /label: "Cover — Circular"/);
  assert.match(cover, /coverHasPositionSlider\(state\)/);

  const humidifier = read("src/cards/humidifier/humidifier-card.ts");
  assert.match(humidifier, /label: "Humidifier — Compact"/);
  assert.match(humidifier, /label: "Humidifier — Circular"/);
  assert.match(humidifier, /humidifierSupportsTarget\(state\)/);
});

test("horizontal media player stays beside the artwork and needs seven columns", () => {
  const css = read("src/cards/media-player/media-player-presentations.css");
  assert.match(css, /\.media-player-card--chip \.media-player__content \{[\s\S]*display: flex;[\s\S]*flex-flow: row nowrap;/);
  assert.match(css, /\.media-player-card--chip \.media-player__center-stack,[\s\S]*min-width: max-content;/);
  const layout = read("src/cards/media-player/media-player-layout.ts");
  assert.match(layout, /CHIP_MIN_COLUMNS = 7/);
  assert.match(layout, /requested === "chip" && !isChipSpanAllowed/);
  const editor = read("src/cards/media-player/media-player-editor.ts");
  assert.match(editor, /disabled: !this\._horizontalLayoutAllowed\(\)/);
});
