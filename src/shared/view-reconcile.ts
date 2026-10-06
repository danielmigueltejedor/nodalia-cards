/** Patch owned light DOM without detaching unchanged layers or custom elements.
 * Keys are local to siblings; no DOM, markup or entity survives in a cache.
 */
export type ViewAttributeFilter = (element: Element, name: string) => boolean;
const keyAttributes = ["data-view-key", "data-room-id", "data-zone-id", "data-manual-zone-index", "data-zone-handle-index", "data-control-action", "data-mode-id", "data-room-highlight-id", "data-zone-highlight-id"];
function key(node: Node): string {
  if (!(node instanceof Element)) return "";
  return keyAttributes.filter(name => node.hasAttribute(name)).map(name => `${name}:${node.getAttribute(name)}`).join("|");
}
function compatible(left: Node, right: Node): boolean {
  return left.nodeType === right.nodeType && (!(left instanceof Element) ||
    right instanceof Element && left.localName === right.localName && left.namespaceURI === right.namespaceURI) && key(left) === key(right);
}
export function reconcileViewElement(live: Element, next: Element, allow: ViewAttributeFilter = () => true): void {
  for (const attribute of Array.from(live.attributes)) {
    if (!next.hasAttribute(attribute.name) && allow(live, attribute.name)) live.removeAttribute(attribute.name);
  }
  for (const attribute of Array.from(next.attributes)) {
    if (allow(live, attribute.name) && live.getAttribute(attribute.name) !== attribute.value) live.setAttribute(attribute.name, attribute.value);
  }
  reconcileViewChildren(live, next, allow);
  // Native select.selectedness can be dirty after user interaction even when
  // the selected attributes match. This view is controlled by the HA model.
  if (live instanceof HTMLSelectElement && next instanceof HTMLSelectElement && live.value !== next.value) live.value = next.value;
}
export function reconcileViewChildren(live: Element | DocumentFragment, next: Element | DocumentFragment, allow: ViewAttributeFilter = () => true): void {
  const keyed = new Map<string, Node[]>();
  for (const node of Array.from(live.childNodes)) {
    const id = key(node);
    if (id) { const group = keyed.get(id) || []; group.push(node); keyed.set(id, group); }
  }
  let cursor = live.firstChild;
  for (const desired of Array.from(next.childNodes)) {
    const id = key(desired);
    let node = id ? keyed.get(id)?.find(candidate => candidate.parentNode === live && compatible(candidate, desired)) : cursor;
    if (!node || !compatible(node, desired)) node = desired.cloneNode(true);
    if (node !== cursor) live.insertBefore(node, cursor);
    if (id) keyed.set(id, (keyed.get(id) || []).filter(candidate => candidate !== node));
    if (node instanceof Element && desired instanceof Element) reconcileViewElement(node, desired, allow);
    else if (node.nodeValue !== desired.nodeValue) node.nodeValue = desired.nodeValue;
    cursor = node.nextSibling;
  }
  while (cursor) { const obsolete = cursor; cursor = cursor.nextSibling; live.removeChild(obsolete); }
}
