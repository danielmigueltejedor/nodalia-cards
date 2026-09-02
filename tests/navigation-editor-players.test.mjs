import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadNavigationEditor() {
  const registry = new Map();

  class FakeHTMLElement {
    constructor() {
      this.dataset = {};
      this.isConnected = true;
      this.shadowRoot = null;
      this.tagName = "NODALIA-NAVIGATION-BAR-EDITOR";
      this.value = "";
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

  class FakeHTMLInputElement extends FakeHTMLElement {
    constructor() {
      super();
      this.tagName = "INPUT";
      this.type = "text";
    }
  }

  const sandbox = {
    clearTimeout,
    console,
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
        this.bubbles = init.bubbles;
        this.composed = init.composed;
      }
    },
    customElements: {
      define(name, klass) { registry.set(name, klass); },
      get(name) { return registry.get(name); },
      whenDefined() { return Promise.resolve(); },
    },
    document: {
      addEventListener() {},
      removeEventListener() {},
      createElement() { return new FakeHTMLElement(); },
      documentElement: { getAttribute() { return ""; } },
      querySelector() { return null; },
      visibilityState: "visible",
    },
    HTMLElement: FakeHTMLElement,
    HTMLButtonElement: class extends FakeHTMLElement {},
    HTMLInputElement: FakeHTMLInputElement,
    HTMLSelectElement: class extends FakeHTMLElement {},
    HTMLTextAreaElement: class extends FakeHTMLElement {},
    MutationObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    navigator: {},
    requestAnimationFrame(callback) { callback(); },
    setTimeout,
    window: null,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-i18n.js"), sandbox);
  vm.runInContext(read("nodalia-render-signature.js"), sandbox);
  vm.runInContext(read("nodalia-navigation-bar.js"), sandbox);

  const EditorClass = registry.get("nodalia-navigation-bar-editor");
  assert.ok(EditorClass, "NodaliaNavigationBarEditor should register");
  return { EditorClass, FakeHTMLElement, FakeHTMLInputElement };
}

function createEditor(EditorClass) {
  const editor = new EditorClass();
  editor.setConfig({
    type: "custom:nodalia-navigation-bar",
    routes: [{ icon: "mdi:home", path: "/lovelace/home" }],
    media_player: {
      players: [{ entity: "media_player.dormitorio" }],
    },
  });
  return editor;
}

function pickerEvent(picker, type, detail) {
  return {
    type,
    detail,
    composedPath: () => [picker],
    stopPropagation() {},
  };
}

test("Navigation editor keeps an existing player when HA picker blurs before selecting another entity", () => {
  const { EditorClass, FakeHTMLElement } = loadNavigationEditor();
  const editor = createEditor(EditorClass);
  const picker = new FakeHTMLElement();
  picker.tagName = "HA-ENTITY-PICKER";
  picker.dataset.playerIndex = "0";
  picker.dataset.playerField = "entity";
  picker.value = "media_player.dormitorio";

  editor._onShadowInput(pickerEvent(picker, "change"));
  assert.equal(editor._config.media_player.players[0].entity, "media_player.dormitorio");
  assert.equal(editor.lastDispatchedEvent, undefined, "search-field blur must not emit or re-render");

  picker.value = "media_player.salon";
  editor._onShadowInput(pickerEvent(picker, "value-changed", { value: "media_player.salon" }));
  assert.equal(editor._config.media_player.players[0].entity, "media_player.salon");
  assert.equal(editor.lastDispatchedEvent?.detail?.config?.media_player?.players?.[0]?.entity, "media_player.salon");

  picker.value = "media_player.dormitorio";
  editor._onShadowInput(pickerEvent(picker, "change"));
  assert.equal(editor._config.media_player.players[0].entity, "media_player.salon");
  assert.equal(editor.lastDispatchedEvent?.detail?.config?.media_player?.players?.[0]?.entity, "media_player.salon");
});

test("Navigation editor accepts another media player, a light, or an input_select from the HA picker", () => {
  const { EditorClass, FakeHTMLElement } = loadNavigationEditor();
  const editor = createEditor(EditorClass);
  const picker = new FakeHTMLElement();
  picker.tagName = "HA-ENTITY-PICKER";
  picker.dataset.playerIndex = "0";
  picker.dataset.playerField = "entity";
  picker.value = "media_player.dormitorio";

  for (const entityId of ["media_player.salon", "light.dormitorio", "input_select.source"]) {
    editor._onShadowInput(pickerEvent(picker, "change"));
    editor._onShadowInput(pickerEvent(picker, "value-changed", { value: entityId }));
    assert.equal(editor._config.media_player.players[0].entity, entityId, entityId);
    assert.equal(editor.lastDispatchedEvent.detail.config.media_player.players[0].entity, entityId, entityId);
    editor.setConfig(editor.lastDispatchedEvent.detail.config);
    assert.equal(editor._config.media_player.players[0].entity, entityId, `${entityId} must survive Lovelace config feedback`);
  }
});

test("Navigation editor still commits native text-input player changes", () => {
  const { EditorClass, FakeHTMLInputElement } = loadNavigationEditor();
  const editor = createEditor(EditorClass);
  const input = new FakeHTMLInputElement();
  input.dataset.playerIndex = "0";
  input.dataset.playerField = "entity";
  input.value = "media_player.salon";

  editor._onShadowInput(pickerEvent(input, "change"));
  assert.equal(editor._config.media_player.players[0].entity, "media_player.salon");
  assert.equal(editor.lastDispatchedEvent.detail.config.media_player.players[0].entity, "media_player.salon");
});
