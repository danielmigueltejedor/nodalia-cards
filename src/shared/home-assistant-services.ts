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
export function callHassService(hass: HomeAssistant | null | undefined, domain: string, service: string, data: Record<string, unknown> = {}, target: Record<string, unknown> | null = null): void {
  if (!hass?.callService) return;
  const failure = (error: unknown) => console.warn("Nodalia Cards: service call failed", `${domain}.${service}`, error);
  try { void Promise.resolve(target !== null ? hass.callService(domain, service, data, target) : hass.callService(domain, service, data)).catch(failure); }
  catch (error) { failure(error); }
}

/** Awaitable boundary for controls that need to show their own service feedback. */
export async function requestHassService(host: HTMLElement, hass: HomeAssistant | null | undefined, domain: string, service: string, data: Record<string, unknown> = {}, target: Record<string, unknown> | null = null): Promise<unknown> {
  if (hass?.callService) return target !== null ? hass.callService(domain, service, data, target) : hass.callService(domain, service, data);
  const utils = window.NodaliaUtils;
  return utils?.invokeHomeAssistantService?.call(utils, host, hass, domain, service, data, target);
}

/** Preserve the compatibility event fallback and explicit targets at a card UI boundary. */
export function invokeHassService(host: HTMLElement, hass: HomeAssistant | null | undefined, domain: string, service: string, data: Record<string, unknown> = {}, target: Record<string, unknown> | null = null): void {
  const utils = window.NodaliaUtils;
  const invoke = utils?.invokeHomeAssistantService;
  if (!invoke) {
    callHassService(hass, domain, service, data, target);
    return;
  }
  const failure = (error: unknown) => console.warn("Nodalia Cards: service call failed", `${domain}.${service}`, error);
  try { void Promise.resolve(invoke.call(utils, host, hass, domain, service, data, target)).catch(failure); }
  catch (error) { failure(error); }
}
