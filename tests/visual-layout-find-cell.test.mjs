import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadLayoutApi() {
  const source = readFileSync(join(root, "nodalia-visual-layout-editor.js"), "utf8");
  globalThis.window = globalThis;
  const fn = new Function(`${source}; return window.NodaliaVisualLayout;`);
  return fn();
}

test("findOpenCell keeps dragged position instead of snapping to grid origin", () => {
  const api = loadLayoutApi();
  const layout = {
    columns: 12,
    rows: 10,
    items: [
      { id: "icon", x: 0, y: 0, w: 2, h: 2, visible: true },
      { id: "title", x: 2, y: 0, w: 7, h: 1, visible: true },
    ],
  };
  const movedIcon = { id: "icon", x: 5, y: 3, w: 2, h: 2, visible: true };
  const open = api.findOpenCell(layout, movedIcon, "icon", { preferX: 5, preferY: 3 });
  assert.equal(open.x, 5);
  assert.equal(open.y, 3);
});
