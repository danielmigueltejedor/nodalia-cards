const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const isUnsafeConfigPathKey = (key: string) => key === "__proto__" || key === "constructor" || key === "prototype";

/** Object-only editor paths; numeric segments intentionally remain object keys. */
export function setByPath(target: unknown, path: unknown, value: unknown) {
  if (!isObject(target) || typeof path !== "string") return;
  const parts = path.split(".");
  if (parts.some(isUnsafeConfigPathKey)) {
    return;
  }
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (key === undefined) return;
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return;
    }
    const current = Object.prototype.hasOwnProperty.call(cursor, key) ? cursor[key] : undefined;
    if (!isObject(current)) {
      Object.defineProperty(cursor, key, {
        configurable: true,
        enumerable: true,
        value: {},
        writable: true,
      });
    }
    const child = cursor[key];
    if (!isObject(child)) return;
    cursor = child;
  }
  const finalKey = parts[parts.length - 1];
  if (finalKey === undefined) return;
  if (finalKey === "__proto__" || finalKey === "constructor" || finalKey === "prototype") {
    return;
  }
  Object.defineProperty(cursor, finalKey, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

export function deleteByPath(target: unknown, path: unknown) {
  if (!isObject(target) || typeof path !== "string") return;
  const parts = path.split(".");
  if (parts.some(isUnsafeConfigPathKey)) {
    return;
  }
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (key === undefined) return;
    if (!Object.prototype.hasOwnProperty.call(cursor, key) || !isObject(cursor[key])) {
      return;
    }
    const child = cursor[key];
    if (!isObject(child)) return;
    cursor = child;
  }
  const finalKey = parts[parts.length - 1];
  if (finalKey !== undefined) delete cursor[finalKey];
}

