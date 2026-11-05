import { build } from "esbuild";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const outfile = path.join(os.tmpdir(), "nodalia-i18n-lib.mjs");
await build({
  absWorkingDir: root,
  entryPoints: ["src/shared/runtime-i18n-runtime.ts"],
  outfile,
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: ["es2022"],
  write: true,
});
const { createRuntimeI18n } = await import(`${pathToFileURL(outfile).href}?nodalia=${Date.now()}`);

export function loadRuntimeI18n(overrides = {}) {
  const context = { ...overrides };
  context.window = context;
  const saved = new Map();
  for (const name of Object.keys(overrides)) {
    saved.set(name, Object.prototype.hasOwnProperty.call(globalThis, name) ? globalThis[name] : undefined);
    globalThis[name] = overrides[name];
  }
  try {
    const api = createRuntimeI18n();
    context.NodaliaI18n = api;
    if (typeof context.CustomEvent === "function" && typeof context.dispatchEvent === "function") {
      context.dispatchEvent(new context.CustomEvent("nodalia-i18n-ready", { bubbles: false }));
    }
    return api;
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
}
