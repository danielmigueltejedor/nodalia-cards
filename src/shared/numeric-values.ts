const numberFormatters = new Map<string, Intl.NumberFormat>();

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
  const key = JSON.stringify([locale ?? null, digits]);
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    if (numberFormatters.size >= 64) {
      const oldest = numberFormatters.keys().next().value;
      if (oldest !== undefined) numberFormatters.delete(oldest);
    }
    numberFormatters.set(key, formatter);
  }
  return formatter.format(numeric);
}
