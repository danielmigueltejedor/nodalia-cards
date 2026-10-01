import { appendUrlQueryParam } from "../../shared/url-query";
import { renderSignature } from "../../shared/render-signature";
export { setByPath, deleteByPath } from "../../shared/editor-object-paths";

export function appendQueryParam(url: unknown, key: unknown, value: unknown) {
  return appendUrlQueryParam(url, key, value, true);
}

export function arrayFromCsv(value: unknown) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}


export { moveItem } from "../../shared/editor-lists";

export { formatDuration, sanitizeMediaArtworkUrl } from "../../shared/media-values";

export function normalizeTextKey(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function sanitizeCssRuntimeValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  if (
    [...raw].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    || /[<>{};"']/.test(raw)
    || raw.includes("/*")
    || raw.includes("*/")
    || /\burl\s*\(/i.test(raw)
    || /\b@import\b/i.test(raw)
  ) {
    return "";
  }
  return raw;
}

export function getRenderSignatureRuntime() {
  return window.NodaliaRenderSignature || renderSignature;
}

export function parsePrimitiveValue(value: unknown) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

export function escapeSelectorValue(value: unknown) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value).replaceAll('"', '\\"');
}

export function normalizePath(value: unknown) {
  if (!value || typeof value !== "string") {
    return null;
  }

  if (/^[a-z]+:\/\//i.test(value)) {
    return null;
  }

  try {
    const url = new URL(value, window.location.origin);
    return (url.pathname || "/").replace(/\/+$/, "") || "/";
  } catch (_error) {
    return (value.split(/[?#]/)[0] || "/").replace(/\/+$/, "") || "/";
  }
}

export function matchPath(currentPath: string | null, candidatePath: string | null, mode: unknown) {
  if (!currentPath || !candidatePath) {
    return false;
  }

  if (mode === "prefix") {
    return currentPath === candidatePath || currentPath.startsWith(`${candidatePath}/`);
  }

  return currentPath === candidatePath;
}
