/** Create a panel from markup already produced by a card's escaped template. */
export function createMarkupElement(markup: string): HTMLElement | null {
  if (!markup || typeof document === "undefined") return null;
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  const node = template.content.firstElementChild;
  return node instanceof HTMLElement ? node : null;
}
