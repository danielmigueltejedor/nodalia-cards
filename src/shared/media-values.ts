export function formatDuration(totalSeconds: unknown) {
  const numeric = typeof totalSeconds === "number" || typeof totalSeconds === "string" ? Number(totalSeconds) : 0;
  const safeSeconds = Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function sanitizeMediaArtworkUrl(value: unknown, hass: { hassUrl?: (path: string) => string } | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const safe = window.NodaliaUtils?.sanitizeActionUrl?.(raw, { allowRelative: true }) || "";
  if (!safe) {
    return "";
  }
  if (/^(?:https?:)?\/\//i.test(safe)) {
    return safe;
  }
  if (typeof hass?.hassUrl === "function" && safe.startsWith("/")) {
    return hass.hassUrl(safe);
  }
  return safe;
}

