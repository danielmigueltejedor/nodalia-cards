import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("editor catalog locale files stay in sync (run scripts/validate-editor-i18n.mjs)", () => {
  const script = path.join(root, "scripts", "validate-editor-i18n.mjs");
  const res = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr || res.stdout);
});

test("nodalia-editor-ui embeds editorCatalog for ed.* keys", () => {
  const src = fs.readFileSync(path.join(root, "nodalia-editor-ui.js"), "utf8");
  assert.match(src, /window\.NodaliaI18n\.editorCatalog\s*=/);
  assert.match(src, /rawInput\.startsWith\("ed\."\)/);
  assert.match(src, /"ed\.calendar\.visible_range"/);
});
