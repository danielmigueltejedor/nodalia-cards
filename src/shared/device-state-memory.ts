import type { HassEntity } from "../core/types/home-assistant";

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export function snapshotDeviceState(state: HassEntity | null): HassEntity | null {
  return state ? { ...state, attributes: { ...state.attributes } } : null;
}

/** Storage getters themselves can throw in privacy-restricted contexts. */
export function readDeviceStateMemory(storageKey: string): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    return isRecord(parsed) ? parsed : {};
  } catch { return {}; }
}

export function readDeviceStateSnapshot(storageKey: string, entityId: string): HassEntity | null {
  if (!entityId) return null;
  const stored = readDeviceStateMemory(storageKey)[entityId];
  if (!isRecord(stored) || !isRecord(stored.attributes)) return null;
  const timestamp = typeof stored.last_changed === "string" ? stored.last_changed : new Date().toISOString();
  return { entity_id: entityId, state: "on", attributes: { ...stored.attributes }, last_changed: timestamp, last_updated: timestamp };
}
