import type { HassEntity, HomeAssistant } from "../../src/core/types/home-assistant";

export interface HassFixtureOptions {
  entities?: Record<string, Partial<HassEntity>>;
  overrides?: Partial<HomeAssistant>;
}
export function createHassFixture({ entities = {}, overrides = {} }: HassFixtureOptions = {}) {
  const states: HomeAssistant["states"] = Object.fromEntries(Object.entries(entities).map(([id, entity]) => [id, {
    ...entity,
    entity_id: entity.entity_id || id,
    state: entity.state ?? "unknown",
    attributes: { ...entity.attributes },
  }]));
  return {
    states,
    locale: { language: "en" },
    language: "en",
    config: { unit_system: { temperature: "°C", length: "km", wind_speed: "km/h" } },
    callService: async (_domain: string, _service: string, _data?: Record<string, unknown>) => {},
    callWS: async (_message?: Record<string, unknown>) => ({ children: [] }),
    hassUrl: (path: string) => path,
    ...overrides,
  };
}
