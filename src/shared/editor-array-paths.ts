const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const isUnsafeConfigPathKey = (key: string) => key === "__proto__" || key === "constructor" || key === "prototype";

/** Editor paths that construct arrays for numeric child segments. */
export type ConfigNode = Record<string, unknown> | unknown[];
const readNode = (node: ConfigNode, key: string): unknown => {
  if (!Object.prototype.hasOwnProperty.call(node, key)) return undefined;
  return Array.isArray(node) ? /^\d+$/.test(key) ? node[Number(key)] : undefined : node[key];
};
function writeNode(node: ConfigNode, key: string, value: unknown): boolean {
  if (!Array.isArray(node)) {
    Object.defineProperty(node, key, { configurable: true, enumerable: true, writable: true, value });
    return true;
  }
  // Array paths address actual indices; reject non-index/prototype properties.
  if (!/^\d+$/.test(key)) return false;
  const index = Number(key);
  if (!Number.isSafeInteger(index) || index >= 4294967295) return false;
  node[index] = value;
  return true;
}

export function setByPath(target: unknown, path: unknown, value: unknown): void {
  if ((!isObject(target) && !Array.isArray(target)) || typeof path !== "string") return;
  const parts = String(path || "").split(".");
  if (!parts.length || parts.some(isUnsafeConfigPathKey)) return;
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (key === undefined) return;
    const child = readNode(cursor, key);
    if (isObject(child) || Array.isArray(child)) {
      cursor = child;
    } else {
      const next: ConfigNode = /^\d+$/.test(parts[index + 1] ?? "") ? [] : {};
      if (!writeNode(cursor, key, next)) return;
      cursor = next;
    }
  }
  const leaf = parts[parts.length - 1];
  if (leaf !== undefined) writeNode(cursor, leaf, value);
}
