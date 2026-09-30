export interface SignaturePart { prefix?: unknown; values: readonly unknown[]; }
export function toKey(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return String(value);
}
export function joinParts(parts: unknown, sectionSeparator = "||", valueSeparator = "::"): string {
  return (Array.isArray(parts) ? parts : []).map((part: unknown) => {
    if (!part || typeof part !== "object" || !("values" in part) || !Array.isArray(part.values)) return "";
    const prefix = "prefix" in part ? String(part.prefix || "") : "";
    return `${prefix}${part.values.map((value: unknown) => toKey(value)).join(valueSeparator)}`;
  }).filter(Boolean).join(sectionSeparator);
}
export const renderSignature = { joinParts, toKey };
