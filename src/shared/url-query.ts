/** Preserve URL fragments; optionally replace the first literal query key. */
export function appendUrlQueryParam(url: unknown, key: unknown, value: unknown, replaceExisting = false) {
  const rawUrl = String(url || "").trim();
  if (!rawUrl || value === null || value === undefined || value === "") {
    return rawUrl;
  }

  const fragmentIndex = rawUrl.indexOf("#");
  const base = fragmentIndex < 0 ? rawUrl : rawUrl.slice(0, fragmentIndex);
  const fragment = fragmentIndex < 0 ? "" : rawUrl.slice(fragmentIndex);
  const encodedKey = encodeURIComponent(String(key));
  const encodedValue = encodeURIComponent(String(value));
  const escapedKey = encodedKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existingPattern = new RegExp(`([?&])${escapedKey}=[^&]*`);
  if (replaceExisting && existingPattern.test(base)) {
    return base.replace(existingPattern, `$1${encodedKey}=${encodedValue}`) + fragment;
  }
  return `${base}${base.includes("?") ? "&" : "?"}${encodedKey}=${encodedValue}${fragment}`;
}

