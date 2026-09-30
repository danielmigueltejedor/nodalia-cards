// Generated from tests/fixtures/hass.ts. Do not edit.

// tests/fixtures/hass.ts
function createHassFixture({ entities = {}, overrides = {} } = {}) {
  const states = Object.fromEntries(Object.entries(entities).map(([id, entity]) => [id, {
    ...entity,
    entity_id: entity.entity_id || id,
    state: entity.state ?? "unknown",
    attributes: { ...entity.attributes }
  }]));
  return {
    states,
    locale: { language: "en" },
    language: "en",
    config: { unit_system: { temperature: "\xB0C", length: "km", wind_speed: "km/h" } },
    callService: async (_domain, _service, _data) => {
    },
    callWS: async (_message) => ({ children: [] }),
    hassUrl: (path) => path,
    ...overrides
  };
}
export {
  createHassFixture
};
