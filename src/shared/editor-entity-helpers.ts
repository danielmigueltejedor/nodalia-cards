import type { HomeAssistant } from "../core/types/home-assistant";

export function getStubEntityId(hass: HomeAssistant | null | undefined, domains: string[] = [], entities: unknown = [], entitiesFallback: unknown = []): string {
  return window.NodaliaUtils.findStubEntityIds(hass, entities, entitiesFallback, domains, 1)[0] || "";
}

export function applyStubEntity<T extends { entity: string; name: string }>(config: T, hass: HomeAssistant | null | undefined, domains: string[], entities: unknown = [], entitiesFallback: unknown = []): T {
  const entityId = getStubEntityId(hass, domains, entities, entitiesFallback);
  if (!entityId) return config;
  config.entity = entityId;
  config.name = hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
  return config;
}

export function parseSizeToPixels(value: unknown, fallback = 0): number {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}
