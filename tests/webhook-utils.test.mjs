import assert from "node:assert";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("NodaliaUtils.postHomeAssistantWebhook POSTs JSON to same-origin webhook URL", async () => {
  const code = fs.readFileSync(new URL("../nodalia-utils.js", import.meta.url), "utf8");
  /** @type {{ url: string, opts: RequestInit }} */
  let captured = { url: "", opts: {} };
  const sandbox = {
    window: { location: { origin: "https://homeassistant.local:8123" } },
    console,
    fetch: async (url, opts) => {
      captured = { url: String(url), opts };
      return { ok: true };
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  const post = sandbox.window.NodaliaUtils.postHomeAssistantWebhook;
  assert.strictEqual(typeof post, "function");

  const ok = await post("nodalia_test_hook", { value: "[\"a\"]" });
  assert.strictEqual(ok, true);
  assert.strictEqual(captured.url, "https://homeassistant.local:8123/api/webhook/nodalia_test_hook");
  assert.strictEqual(captured.opts.method, "POST");
  assert.strictEqual(captured.opts.headers["Content-Type"], "application/json");
  assert.strictEqual(captured.opts.credentials, "same-origin");
  assert.strictEqual(captured.opts.body, JSON.stringify({ value: "[\"a\"]" }));
});

test("postHomeAssistantWebhook returns false when fetch fails", async () => {
  const code = fs.readFileSync(new URL("../nodalia-utils.js", import.meta.url), "utf8");
  const sandbox = {
    window: { location: { origin: "https://ha.test" } },
    console,
    fetch: async () => ({ ok: false }),
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  const ok = await sandbox.window.NodaliaUtils.postHomeAssistantWebhook("x", { value: "1" });
  assert.strictEqual(ok, false);
});
