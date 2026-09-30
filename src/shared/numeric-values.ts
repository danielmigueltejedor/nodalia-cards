/** Finite numeric data; absent, blank and nonnumeric payloads stay absent. */
export function parseFiniteNumericValue(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string" || typeof value === "string" && !value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
