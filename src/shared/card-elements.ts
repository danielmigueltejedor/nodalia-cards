import type { HomeAssistant } from "../core/types/home-assistant";

export interface LovelaceEditorElement extends HTMLElement {
  hass: HomeAssistant | null;
  setConfig(config: unknown): void;
}
/** Child editors are supplied by custom-element registration, so check their API. */
export function isLovelaceEditorElement(element: Element): element is LovelaceEditorElement {
  return element instanceof HTMLElement && "setConfig" in element && typeof element.setConfig === "function";
}
