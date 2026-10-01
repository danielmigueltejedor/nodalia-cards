import type { HomeAssistant } from "../core/types/home-assistant";

function isServiceDataObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function parseServiceData(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return isServiceDataObject(parsed) ? parsed : {};
  } catch { return {}; }
}

/** Catch both synchronous HA failures and rejected service promises at the UI boundary. */
export function callHassService(hass: HomeAssistant | null | undefined, domain: string, service: string, data: Record<string, unknown> = {}): void {
  if (!hass?.callService) return;
  const failure = (error: unknown) => console.warn("Nodalia Cards: service call failed", `${domain}.${service}`, error);
  try { void Promise.resolve(hass.callService(domain, service, data)).catch(failure); }
  catch (error) { failure(error); }
}
