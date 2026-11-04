import { createRuntimeI18n } from "../fixtures/nodalia-i18n-lib.mjs";

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
