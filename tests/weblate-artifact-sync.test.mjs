import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const workflow = fs.readFileSync(new URL("../.github/workflows/weblate-i18n-sync.yml", import.meta.url), "utf8");
const commitStep = workflow.split("      - name: Commit regenerated artifacts if needed\n")[1];
const script = commitStep.split("        run: |\n")[1].split("\n").map(line => line.replace(/^          /, "")).join("\n");
const artifacts = [
  "src/shared/editor-i18n-data.ts", "src/shared/runtime-i18n-data.ts",
  "nodalia-editor-ui.js", "nodalia-i18n.js", "nodalia-cards.js", "nodalia-cards.manifest.js",
];
const binary = spawnSync("bash", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nodalia-weblate-sync-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync(binary, args, { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "-q");
  git("config", "user.name", "Sync fixture");
  git("config", "user.email", "fixture@example.test");
  for (const file of [...artifacts, "unrelated.txt"]) {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    fs.writeFileSync(path.join(directory, file), "before\n");
  }
  git("add", "."); git("commit", "-qm", "initial fixture");
  const bin = path.join(directory, "bin"); fs.mkdirSync(bin);
  // Run the actual workflow commit step; intercept only its remote push.
  fs.writeFileSync(path.join(bin, "git"), `#!/bin/bash\nif [ "$1" = push ]; then printf pushed > push-observed; exit 0; fi\nexec '${binary.replaceAll("'", "'\\''")}' "$@"\n`, { mode: 0o755 });
  return { directory, git, run() {
    const result = spawnSync("bash", ["-e", "-c", script], { cwd: directory,
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }};
}

for (const artifact of artifacts) {
  test(`Weblate commits and pushes a change isolated to ${artifact}`, t => {
    const f = fixture(t);
    fs.writeFileSync(path.join(f.directory, artifact), "regenerated\n");
    fs.writeFileSync(path.join(f.directory, "unrelated.txt"), "keep unstaged\n");
    f.run();
    assert.equal(f.git("show", "--format=", "--name-only", "HEAD"), artifact);
    assert.equal(f.git("show", `HEAD:${artifact}`), "regenerated");
    assert.equal(fs.readFileSync(path.join(f.directory, "push-observed"), "utf8"), "pushed");
    assert.equal(f.git("diff", "--name-only"), "unrelated.txt");
  });
}

test("Weblate does not commit or push when generated artifacts are current", t => {
  const f = fixture(t), head = f.git("rev-parse", "HEAD");
  fs.writeFileSync(path.join(f.directory, "unrelated.txt"), "keep unstaged\n");
  f.run();
  assert.equal(f.git("rev-parse", "HEAD"), head);
  assert.equal(fs.existsSync(path.join(f.directory, "push-observed")), false);
  assert.equal(f.git("diff", "--name-only"), "unrelated.txt");
});
