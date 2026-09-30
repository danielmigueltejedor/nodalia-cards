import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CARD_REGISTRY } from "../scripts/card-registry.mjs";

test("Standalone utils embedding includes every registry card, including Lock, and strips losslessly", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nodalia-embed-"));
  try {
    for (const file of ["scripts/sync-standalone-embed.mjs", "scripts/card-registry.mjs", "src/cards/registry.json", "nodalia-utils.js", "nodalia-notifications-mobile-policy.js", "nodalia-room-summary-model.js", "nodalia-camera-stream-model.js"]) {
      const target = path.join(root, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(file, target);
    }
    for (const card of CARD_REGISTRY) fs.writeFileSync(path.join(root, card.artifact), `/* ${card.tag} */\n`);
    const run = (...args) => {
      const result = spawnSync(process.execPath, [path.join(root, "scripts/sync-standalone-embed.mjs"), ...args], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    };
    run();
    for (const card of CARD_REGISTRY) assert.match(fs.readFileSync(path.join(root, card.artifact), "utf8"), /<nodalia-standalone-utils>/, card.tag);
    run();
    assert.equal(fs.readFileSync(path.join(root, "nodalia-lock-card.js"), "utf8").split("// <nodalia-standalone-utils>").length, 2);
    run("--strip");
    for (const card of CARD_REGISTRY) assert.equal(fs.readFileSync(path.join(root, card.artifact), "utf8"), `/* ${card.tag} */\n`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
