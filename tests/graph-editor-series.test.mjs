import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadGraphEditor() {
  const registry = new Map();

  class FakeHTMLElement {
    constructor() {
      this.dataset = {};
      this.isConnected = false;
      this.shadowRoot = null;
    }

    attachShadow() {
      this.shadowRoot = {
        activeElement: null,
        addEventListener() {},
        removeEventListener() {},
        innerHTML: "",
        querySelector() { return null; },
        querySelectorAll() { return []; },
      };
      return this.shadowRoot;
    }

    addEventListener() {}
    removeEventListener() {}

    dispatchEvent(event) {
      this.lastDispatchedEvent = event;
      return true;
    }
  }

  class FakeHTMLButtonElement extends FakeHTMLElement {}
  class FakeHTMLInputElement extends FakeHTMLElement {}
  class FakeHTMLSelectElement extends FakeHTMLElement {}
  class FakeHTMLTextAreaElement extends FakeHTMLElement {}

  const sandbox = {
    clearTimeout,
    console,
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    customElements: {
      define(name, klass) { registry.set(name, klass); },
      get(name) { return registry.get(name); },
      whenDefined() { return Promise.resolve(); },
    },
    document: {
      createElement() { return new FakeHTMLElement(); },
      documentElement: { getAttribute() { return ""; } },
      querySelector() { return null; },
      addEventListener() {},
      removeEventListener() {},
    },
    HTMLElement: FakeHTMLElement,
    HTMLButtonElement: FakeHTMLButtonElement,
    HTMLInputElement: FakeHTMLInputElement,
    HTMLSelectElement: FakeHTMLSelectElement,
    HTMLTextAreaElement: FakeHTMLTextAreaElement,
    navigator: {},
    requestAnimationFrame(callback) { callback(); },
    setTimeout,
    window: null,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-graph-card.js"), sandbox);
  vm.runInContext("globalThis.__normalizeGraphConfig = normalizeConfig;", sandbox);

  const EditorClass = registry.get("nodalia-graph-card-editor");
  assert.ok(EditorClass, "NodaliaGraphCardEditor should register");
  return { EditorClass, sandbox };
}

test("Graph editor keeps a newly added series until its entity is selected", () => {
  const { EditorClass, sandbox } = loadGraphEditor();
  const editor = new EditorClass();
  editor.setConfig({
    entities: [{ entity: "sensor.temperature", name: "Temperature", color: "#f29f05" }],
  });

  const addButton = new sandbox.HTMLButtonElement();
  addButton.dataset.action = "add-series";
  editor._onShadowClick({
    composedPath: () => [addButton],
    preventDefault() {},
    stopPropagation() {},
  });

  assert.equal(editor._config.entities.length, 2);
  assert.equal(editor._config.entities[1].entity, "");
  assert.match(editor.shadowRoot.innerHTML, /Serie 2/);
  assert.equal(editor.lastDispatchedEvent.type, "config-changed");

  editor.setConfig(editor.lastDispatchedEvent.detail.config);
  assert.equal(editor._config.entities.length, 2, "Home Assistant config feedback must retain the draft row");

  const picker = new sandbox.HTMLElement();
  picker.dataset.field = "entities.1.entity";
  picker.dataset.value = "";
  editor._onShadowValueChanged({
    composedPath: () => [picker],
    detail: { value: "sensor.humidity" },
    stopPropagation() {},
  });

  assert.equal(editor._config.entities[1].entity, "sensor.humidity");
  assert.equal(editor.lastDispatchedEvent.detail.config.entities[1].entity, "sensor.humidity");

  const runtimeConfig = sandbox.__normalizeGraphConfig({
    entities: [
      { entity: "sensor.temperature" },
      { entity: "", color: "#42a5f5" },
    ],
  });
  assert.equal(runtimeConfig.entities.length, 1, "runtime config should still discard incomplete series");
});
