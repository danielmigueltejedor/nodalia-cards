interface CachedNumberFormat { formatter: Intl.NumberFormat; results: Map<number, string> }
const numberFormatters = new Map<string, CachedNumberFormat>();
/** Cards re-render with the same few readings; Intl formatting is the expensive step, so remember its output. */
const FORMATTED_RESULT_LIMIT = 256;

/** Finite numeric data; absent, blank and nonnumeric payloads stay absent. */
export function parseFiniteNumericValue(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string" || typeof value === "string" && !value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function formatFiniteNumericValue(value: unknown, decimals = 0, locale: string | undefined = undefined) {
  const numeric = parseFiniteNumericValue(value);
  if (numeric === null) {
    return "--";
  }

  const digits = Number.isFinite(decimals) ? Math.min(20, Math.max(0, Math.floor(decimals))) : 0;
  const key = `${locale ?? ""}|${digits}`;
  let cached = numberFormatters.get(key);
  if (!cached) {
    cached = {
      formatter: new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
      results: new Map(),
    };
    if (numberFormatters.size >= 64) {
      const oldest = numberFormatters.keys().next().value;
      if (oldest !== undefined) numberFormatters.delete(oldest);
    }
    numberFormatters.set(key, cached);
  }
  // Map treats -0 and 0 as one key but Intl prints "-0" and "0", so negative zero is never remembered.
  const negativeZero = Object.is(numeric, -0);
  const remembered = negativeZero ? undefined : cached.results.get(numeric);
  if (remembered !== undefined) return remembered;
  const text = cached.formatter.format(numeric);
  if (!negativeZero) {
    if (cached.results.size >= FORMATTED_RESULT_LIMIT) cached.results.clear();
    cached.results.set(numeric, text);
  }
  return text;
}
