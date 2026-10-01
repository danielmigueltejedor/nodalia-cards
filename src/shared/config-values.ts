const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const unsafeKeys = new Set(["__proto__", "constructor", "prototype"]);

/** Remove empty editor values without discarding false, zero or empty arrays. */
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
