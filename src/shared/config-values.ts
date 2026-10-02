const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const unsafeKeys = new Set(["__proto__", "constructor", "prototype"]);

/** Remove empty editor values without discarding false, zero or empty arrays. */
export function compactConfig(value: Record<string, unknown>, preserveEmptyKeys?: readonly string[]): Record<string, unknown>;
export function compactConfig(value: readonly unknown[], preserveEmptyKeys?: readonly string[]): unknown[];
export function compactConfig(value: unknown, preserveEmptyKeys?: readonly string[]): unknown;
export function compactConfig(value: unknown, preserveEmptyKeys: readonly string[] = []): unknown {
  if (Array.isArray(value)) return value.map((item: unknown) => compactConfig(item, preserveEmptyKeys)).filter(item => item !== undefined);
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (unsafeKeys.has(key)) continue;
      if (item === "" && preserveEmptyKeys.includes(key)) { result[key] = ""; continue; }
      const cleaned = compactConfig(item, preserveEmptyKeys);
      if (cleaned !== undefined && !(isRecord(cleaned) && Object.keys(cleaned).length === 0)) result[key] = cleaned;
    }
    return result;
  }
  return value === "" || value === null || value === undefined ? undefined : value;
}

/** Configuration copies keep JSON semantics and guard reconstructed root shapes. */
export function cloneConfigValue(value:Record<string,unknown>):Record<string,unknown>;
export function cloneConfigValue(value:readonly unknown[]):unknown[];
export function cloneConfigValue(value:unknown):unknown;
export function cloneConfigValue(value:unknown):unknown {
  const cloned:unknown=window.NodaliaUtils.deepClone(value);
  if(Array.isArray(value)) return Array.isArray(cloned)?cloned:[];
  if(isRecord(value)) return isRecord(cloned)?cloned:{};
  return cloned;
}
