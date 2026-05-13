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

test("postHomeAssistantWebhook uses hass.auth.fetchWithAuth when provided", async () => {
  const code = fs.readFileSync(new URL("../nodalia-utils.js", import.meta.url), "utf8");
  /** @type {{ url: string, opts: RequestInit }} */
  let captured = { url: "", opts: {} };
  const sandbox = {
    window: { location: { origin: "https://homeassistant.local:8123" } },
    console,
    fetch: async () => {
      throw new Error("fetch should not run when fetchWithAuth is used");
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  const hass = {
    auth: {
      fetchWithAuth: async (url, opts) => {
        captured = { url: String(url), opts: opts || {} };
        return { ok: true };
      },
    },
  };

  const ok = await sandbox.window.NodaliaUtils.postHomeAssistantWebhook(
    "nodalia_hook",
    { value: "[]" },
    hass,
  );
  assert.strictEqual(ok, true);
  assert.strictEqual(captured.url, "/api/webhook/nodalia_hook");
  assert.strictEqual(captured.opts.method, "POST");
  assert.strictEqual(captured.opts.body, JSON.stringify({ value: "[]" }));
});

test("postHomeAssistantWebhook strips pasted webhook URL to id", async () => {
  const code = fs.readFileSync(new URL("../nodalia-utils.js", import.meta.url), "utf8");
  let url = "";
  const sandbox = {
    window: { location: { origin: "https://ha.test" } },
    console,
    URL: globalThis.URL,
    fetch: async u => {
      url = String(u);
      return { ok: true };
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  await sandbox.window.NodaliaUtils.postHomeAssistantWebhook(
    "https://ha.test:8123/api/webhook/my_calendar_hook",
    { value: "x" },
  );
  assert.strictEqual(url, "https://ha.test/api/webhook/my_calendar_hook");
});

test("NodaliaUtils deduplicates repeated customCards registrations", () => {
  const code = fs.readFileSync(new URL("../nodalia-utils.js", import.meta.url), "utf8");
  const sandbox = {
    window: {
      customCards: [
        { type: "nodalia-light-card", name: "Old light" },
        { type: "nodalia-light-card", name: "Older light" },
      ],
      location: { origin: "https://ha.test" },
    },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  sandbox.window.customCards.push({ type: "nodalia-cover-card", name: "Cover 1" });
  sandbox.window.customCards.push({ type: "nodalia-cover-card", name: "Cover 2" });
  sandbox.window.NodaliaUtils.registerCustomCard({ type: "nodalia-light-card", name: "Fresh light" });

  assert.deepStrictEqual(
    sandbox.window.customCards.map(card => `${card.type}:${card.name}`),
    ["nodalia-cover-card:Cover 2", "nodalia-light-card:Fresh light"],
  );
});
