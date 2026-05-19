import test from "node:test";
import assert from "node:assert/strict";

test("nodalia render signature runtime joins parts deterministically", async () => {
  globalThis.window = {};
  await import(`../nodalia-render-signature.js?case=deterministic`);

  const runtime = globalThis.window.NodaliaRenderSignature;
  assert.ok(runtime);

  const signature = runtime.joinParts([
    { prefix: "a:", values: ["alpha", 2, null] },
    { prefix: "b:", values: ["x", "y"] },
  ]);

  assert.equal(signature, "a:alpha::2::||b:x::y");
});

test("nodalia render signature runtime tolerates empty sections", async () => {
  globalThis.window = {};
  await import(`../nodalia-render-signature.js?case=empty-sections`);
  const runtime = globalThis.window.NodaliaRenderSignature;

  const signature = runtime.joinParts([
    null,
    { prefix: "r:", values: ["ok"] },
  ]);

  assert.equal(signature, "r:ok");
});
