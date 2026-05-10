import test from "node:test";
import assert from "node:assert/strict";

const registry = new Map();

class TestHTMLElement {
  attachShadow() {
    this.shadowRoot = {
      addEventListener() {},
      removeEventListener() {},
      querySelector() {
        return null;
      },
      innerHTML: "",
    };
    return this.shadowRoot;
  }
}

globalThis.HTMLElement = TestHTMLElement;
globalThis.customElements = {
  define(name, elementClass) {
    registry.set(name, elementClass);
  },
  get(name) {
    return registry.get(name);
  },
};
globalThis.window = {
  customCards: [],
  customElements: globalThis.customElements,
  location: {
    origin: "https://example.test",
  },
};

await import("../nodalia-advance-vacuum-card.js");

const AdvanceVacuumCard = customElements.get("nodalia-advance-vacuum-card");

test("shared cleaning session overflow preserves the existing helper value", () => {
  assert.equal(typeof AdvanceVacuumCard, "function");

  const card = new AdvanceVacuumCard();
  const serviceCalls = [];
  const helperEntityId = "input_text.shared_cleaning_session";

  card._config = {
    shared_cleaning_session_entity: helperEntityId,
  };
  card._hass = {
    states: {
      [helperEntityId]: {
        state: "v=1&m=rooms&sr=existing",
        attributes: {
          max: 20,
        },
      },
    },
  };
  card._callNamedService = (service, data) => {
    serviceCalls.push({ service, data });
  };

  card._persistSharedCleaningSession({
    mode: "rooms",
    activeMode: "rooms",
    activeRoomIds: [
      "room-with-a-name-that-cannot-fit",
      "another-room-with-a-name-that-cannot-fit",
    ],
    selectedRoomIds: [
      "room-with-a-name-that-cannot-fit",
      "another-room-with-a-name-that-cannot-fit",
    ],
    repeats: 2,
    selectionUpdatedAt: 123456789,
  });

  assert.deepEqual(serviceCalls, []);
  assert.notEqual(card._lastSubmittedSharedCleaningSessionValue, "");
});
