export type NativeEditorInput = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export function isNativeEditorInput(node: EventTarget): node is NativeEditorInput {
  return node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement;
}

/** HA picker events can originate in a composed shadow tree or a native fallback. */
export function editorControlValue(event: Event, control: HTMLElement): unknown {
  const detail: unknown = event instanceof CustomEvent ? event.detail : undefined;
  if (detail && typeof detail === "object" && "value" in detail && typeof detail.value === "string") return detail.value;
  return "value" in control ? control.value : undefined;
}
