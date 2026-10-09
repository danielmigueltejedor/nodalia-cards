const CACHE_LIMIT = 48;
export const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Intl formatters are expensive to build and cards format the same dates on every render, so
 * they are kept per locale and option set. `date.toLocale*String(locale, options)` builds a
 * new formatter each call; this returns the equivalent shared one.
 */
export function getDateTimeFormatter(locale: string | undefined, options: Intl.DateTimeFormatOptions) {
  const key = `${String(locale || "default")}|${JSON.stringify(options)}`;
  let formatter = dateTimeFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateTimeFormatterCache.set(key, formatter);
    if (dateTimeFormatterCache.size > CACHE_LIMIT) {
      const oldest = dateTimeFormatterCache.keys().next().value;
      if (oldest !== undefined) dateTimeFormatterCache.delete(oldest);
    }
  }
  return formatter;
}
