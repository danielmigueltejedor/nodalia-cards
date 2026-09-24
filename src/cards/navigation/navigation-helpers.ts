// @ts-nocheck -- path, artwork and editor path helpers stay loosely typed until remaining unknowns are narrowed.
import { isObject, isUnsafeConfigPathKey } from "./navigation-runtime";

export function setByPath(target, path, value) {
  const parts = path.split(".");
  if (parts.some(isUnsafeConfigPathKey)) {
    return;
  }
  let cursor = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return;
    }
    const current = Object.hasOwn(cursor, key) ? cursor[key] : undefined;
    if (!isObject(current)) {
      Object.defineProperty(cursor, key, {
        configurable: true,
        enumerable: true,
        value: {},
        writable: true,
      });
    }
    cursor = cursor[key];
  }
  const finalKey = parts[parts.length - 1];
  if (finalKey === "__proto__" || finalKey === "constructor" || finalKey === "prototype") {
    return;
  }
  Object.defineProperty(cursor, finalKey, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

export function deleteByPath(target, path) {
  const parts = path.split(".");
  if (parts.some(isUnsafeConfigPathKey)) {
    return;
  }
  let cursor = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(cursor[key])) {
      return;
    }
    cursor = cursor[key];
  }

  delete cursor[parts[parts.length - 1]];
}



export function appendQueryParam(url, key, value) {
  const rawUrl = String(url || "").trim();
  if (!rawUrl || value === null || value === undefined || value === "") {
    return rawUrl;
  }

  const encodedKey = encodeURIComponent(String(key));
  const encodedValue = encodeURIComponent(String(value));
  const existingPattern = new RegExp(`([?&])${encodedKey}=[^&]*`);
  if (existingPattern.test(rawUrl)) {
    return rawUrl.replace(existingPattern, `$1${encodedKey}=${encodedValue}`);
  }

  return `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}${encodedKey}=${encodedValue}`;
}

export function arrayFromCsv(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}


export function moveItem(array, fromIndex, toIndex) {
  if (!Array.isArray(array)) {
    return array;
  }

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= array.length ||
    toIndex >= array.length ||
    fromIndex === toIndex
  ) {
    return array;
  }

  const [item] = array.splice(fromIndex, 1);
  array.splice(toIndex, 0, item);
  return array;
}

export function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function normalizeTextKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function sanitizeCssRuntimeValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  if (
    /[<>{};"']/.test(raw)
    || raw.includes("/*")
    || raw.includes("*/")
    || /\burl\s*\(/i.test(raw)
    || /\b@import\b/i.test(raw)
  ) {
    return "";
  }
  return raw;
}

export function sanitizeMediaArtworkUrl(value, hass) {
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

export function getRenderSignatureRuntime() {
  return window.NodaliaRenderSignature || {
    toKey(value) {
      if (value === null || value === undefined) {
        return "";
      }
      if (typeof value === "number") {
        return Number.isFinite(value) ? String(value) : "";
      }
      return String(value);
    },
    joinParts(parts, sectionSeparator = "||", valueSeparator = "::") {
      return (Array.isArray(parts) ? parts : [])
        .map(part => {
          if (!part || !Array.isArray(part.values)) {
            return "";
          }
          const prefix = String(part.prefix || "");
          const body = part.values.map(value => this.toKey(value)).join(valueSeparator);
          return `${prefix}${body}`;
        })
        .filter(Boolean)
        .join(sectionSeparator);
    },
  };
}

export function parsePrimitiveValue(value) {
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

export function escapeSelectorValue(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value).replaceAll('"', '\\"');
}

export function normalizePath(value) {
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

export function matchPath(currentPath, candidatePath, mode) {
  if (!candidatePath) {
    return false;
  }

  if (mode === "prefix") {
    return currentPath === candidatePath || currentPath.startsWith(`${candidatePath}/`);
  }

  return currentPath === candidatePath;
}
