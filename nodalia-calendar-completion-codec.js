/**
 * Codificación compacta v2–v6 de eventos completados para el input_text.
 * - v2: índices en ventana + trozos por día (depende del orden de carga).
 * - v3: huella FNV-1a 64-bit por clave lógica (orden-independiente; tokens base62 de 11 chars).
 * - v4: mismas claves; binario + Base64URL. **`0x02`:** huellas **40-bit**, `uint8` count (≤255 marcados). **`0x01`:** huellas **48-bit**, `uint16` count (solo si >255 huellas únicas).
 * - v5: huellas **24-bit** (FNV-1a truncada) + `uint8` count (≤255); **máx. ~62** marcados en 255 chars (riesgo de colisión mayor que v4).
 * - v6: huellas **24-bit** + `uint16` count (hasta 65535); pensado para persistencia multi-helper (255xN).
 * @see nodalia-calendar-card.js
 */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** 62^10 < 2^64 < 62^11 — ancho fijo para concatenar tokens sin separador. */
const V3_TOKEN_WIDTH = 11;

const UINT24_MASK = (1n << 24n) - 1n;
const UINT40_MASK = (1n << 40n) - 1n;
const UINT48_MASK = (1n << 48n) - 1n;
/** `uint16_be(count)` + `count × uint48_be` (huellas ordenadas). Solo si hay >255 huellas únicas. */
const V4_SCHEMA_V1 = 1;
/** `uint8(count)` + `count × uint40_be` — formato preferido (más corto). */
const V4_SCHEMA_V2 = 2;
/** `uint8(count)` + `count × uint24_be` (v5). */
const V5_SCHEMA_V1 = 1;
/** `uint16_be(count)` + `count × uint24_be` (v6). */
const V6_SCHEMA_V1 = 1;

function fnv1a64Utf8(str) {
  const utf8Fallback = input => {
    const out = [];
    for (const ch of String(input)) {
      const cp = ch.codePointAt(0);
      if (cp <= 0x7f) {
        out.push(cp);
      } else if (cp <= 0x7ff) {
        out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
      } else if (cp <= 0xffff) {
        out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      } else {
        out.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f),
        );
      }
    }
    return new Uint8Array(out);
  };
  const bytes =
    typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(String(str))
      : typeof Buffer !== "undefined"
        ? Buffer.from(String(str), "utf8")
        : utf8Fallback(str);
  let h = 14695981039346656037n;
  const p = 1099511628211n;
  const mask = (1n << 64n) - 1n;
  for (let i = 0; i < bytes.length; i += 1) {
    h ^= BigInt(bytes[i]);
    h = (h * p) & mask;
  }
  return h;
}

function uint64ToBase62Fixed(n, width) {
  const mask = (1n << 64n) - 1n;
  let v = BigInt(n) & mask;
  let s = "";
  for (let i = 0; i < width; i += 1) {
    s = BASE62[Number(v % 62n)] + s;
    v /= 62n;
  }
  return s;
}

/** Huella estable (11 chars base62) derivada solo de la clave lógica del evento. */
export function stableCompletionTokenFromKey(completionKeyStr) {
  return uint64ToBase62Fixed(fnv1a64Utf8(String(completionKeyStr ?? "")), V3_TOKEN_WIDTH);
}

/** Huella 48-bit (mismos bytes UTF-8 y FNV-1a que v3); uso en v4 esquema 1. */
export function fingerprint48FromKey(completionKeyStr) {
  return fnv1a64Utf8(String(completionKeyStr ?? "")) & UINT48_MASK;
}

/** Huella 40-bit; v4 esquema 2 (máxima densidad habitual). */
export function fingerprint40FromKey(completionKeyStr) {
  return fnv1a64Utf8(String(completionKeyStr ?? "")) & UINT40_MASK;
}

/** Huella 24-bit; v5 (máxima densidad; colisiones más probables que v4). */
export function fingerprint24FromKey(completionKeyStr) {
  return fnv1a64Utf8(String(completionKeyStr ?? "")) & UINT24_MASK;
}

function writeUint40BE(arr, offset, valueBig) {
  let v = BigInt(valueBig) & UINT40_MASK;
  for (let i = 4; i >= 0; i -= 1) {
    arr[offset + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}

function readUint40BE(arr, offset) {
  let v = 0n;
  for (let i = 0; i < 5; i += 1) {
    v = (v << 8n) | BigInt(arr[offset + i]);
  }
  return v & UINT40_MASK;
}

function writeUint24BE(arr, offset, valueBig) {
  let v = BigInt(valueBig) & UINT24_MASK;
  arr[offset + 2] = Number(v & 0xffn);
  v >>= 8n;
  arr[offset + 1] = Number(v & 0xffn);
  v >>= 8n;
  arr[offset] = Number(v & 0xffn);
}

function readUint24BE(arr, offset) {
  let v = 0n;
  for (let i = 0; i < 3; i += 1) {
    v = (v << 8n) | BigInt(arr[offset + i]);
  }
  return v & UINT24_MASK;
}

function writeUint48BE(arr, offset, valueBig) {
  let v = BigInt(valueBig) & UINT48_MASK;
  for (let i = 5; i >= 0; i -= 1) {
    arr[offset + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}

function readUint48BE(arr, offset) {
  let v = 0n;
  for (let i = 0; i < 6; i += 1) {
    v = (v << 8n) | BigInt(arr[offset + i]);
  }
  return v & UINT48_MASK;
}

function bytesToBase64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  const b64 =
    typeof btoa !== "undefined"
      ? btoa(bin)
      : typeof Buffer !== "undefined"
        ? Buffer.from(bytes).toString("base64")
        : "";
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s) {
  let b64 = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) {
    b64 += "=";
  }
  const bin =
    typeof atob !== "undefined"
      ? atob(b64)
      : typeof Buffer !== "undefined"
        ? Buffer.from(b64, "base64").toString("binary")
        : "";
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i) & 0xff;
  }
  return out;
}

/** All-day strings (YYYY-MM-DD): parse as local calendar date. */
function parseCalendarDateOnlyLocal(raw) {
  const s = String(raw ?? "").trim();
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!dm) {
    return null;
  }
  const y = Number(dm[1]);
  const mo = Number(dm[2]) - 1;
  const d = Number(dm[3]);
  const local = new Date(y, mo, d, 12, 0, 0);
  return Number.isFinite(local.getTime()) ? local : null;
}

export function eventDate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const dayLocal = parseCalendarDateOnlyLocal(value);
    if (dayLocal) {
      return dayLocal;
    }
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  if (typeof value === "object") {
    if (value.dateTime) {
      const parsed = new Date(value.dateTime);
      return Number.isFinite(parsed.getTime()) ? parsed : null;
    }
    if (value.date) {
      const dayLocal = parseCalendarDateOnlyLocal(value.date);
      if (dayLocal) {
        return dayLocal;
      }
      const parsed = new Date(value.date);
      return Number.isFinite(parsed.getTime()) ? parsed : null;
    }
    return null;
  }
  return null;
}

export function completionKey(event) {
  const source = String(event?._entity || "");
  const uid = String(event?.uid || event?.id || "");
  const start = eventDate(event?.start)?.toISOString() || "";
  const summary = String(event?.summary || "");
  return `${source}|${uid}|${start}|${summary}`;
}

export function canonicalCompletionKeysJson(keys) {
  return JSON.stringify(
    [...new Set(keys.map(k => String(k)))].filter(Boolean).sort((a, b) => a.localeCompare(b, "en")),
  );
}

/** Fecha local del evento como YYYYMMDD (alineado con agrupación por día en la tarjeta). */
export function eventDayKeyCompact(ev) {
  const d = eventDate(ev?.start);
  if (!d) {
    return "";
  }
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}${mo}${da}`;
}

function expandCompactDaySegment(seg, orderedEvents, keys) {
  const s = String(seg ?? "").trim();
  if (!s.startsWith("d") || s.length < 10) {
    return;
  }
  const dayKey = s.slice(1, 9);
  if (!/^\d{8}$/.test(dayKey)) {
    return;
  }
  const rest = s.slice(9);
  const fullDay = orderedEvents.filter(ev => eventDayKeyCompact(ev) === dayKey);
  if (rest === "t") {
    fullDay.forEach(ev => keys.add(completionKey(ev)));
    return;
  }
  if (rest.startsWith("n")) {
    const j = Number(rest.slice(1));
    if (!Number.isFinite(j) || j <= 0) {
      return;
    }
    for (let i = 0; i < Math.min(j, fullDay.length); i += 1) {
      keys.add(completionKey(fullDay[i]));
    }
    return;
  }
  if (rest.startsWith("i")) {
    const spec = rest.slice(1).trim();
    if (!spec) {
      return;
    }
    for (const part of spec.split("-")) {
      const pos = Number(part.trim());
      if (Number.isFinite(pos) && pos >= 1 && pos <= fullDay.length) {
        keys.add(completionKey(fullDay[pos - 1]));
      }
    }
  }
}

function decodeCompactCalendarCompletionV4(raw, orderedEvents) {
  const head = String(raw ?? "").trim();
  if (head === "v4:z") {
    return [];
  }
  if (!head.startsWith("v4:")) {
    return [];
  }
  const body = head.slice(3);
  if (body === "z") {
    return [];
  }
  let bytes;
  try {
    bytes = base64UrlToBytes(body);
  } catch (_err) {
    return [];
  }
  if (bytes.length < 2) {
    return [];
  }
  const schema = bytes[0];
  if (schema === V4_SCHEMA_V2) {
    const n = bytes[1];
    if (n === 0 || bytes.length !== 2 + 5 * n) {
      return [];
    }
    const fpWanted = new Set();
    for (let i = 0; i < n; i += 1) {
      fpWanted.add(readUint40BE(bytes, 2 + i * 5));
    }
    const list = Array.isArray(orderedEvents) ? orderedEvents : [];
    const keys = [];
    for (const ev of list) {
      const k = completionKey(ev);
      if (fpWanted.has(fingerprint40FromKey(k))) {
        keys.push(k);
      }
    }
    return keys;
  }
  if (schema === V4_SCHEMA_V1) {
    if (bytes.length < 3) {
      return [];
    }
    const n = (bytes[1] << 8) | bytes[2];
    if (n === 0 || bytes.length !== 3 + 6 * n) {
      return [];
    }
    const fpWanted = new Set();
    for (let i = 0; i < n; i += 1) {
      fpWanted.add(readUint48BE(bytes, 3 + i * 6));
    }
    const list = Array.isArray(orderedEvents) ? orderedEvents : [];
    const keys = [];
    for (const ev of list) {
      const k = completionKey(ev);
      if (fpWanted.has(fingerprint48FromKey(k))) {
        keys.push(k);
      }
    }
    return keys;
  }
  return [];
}

function decodeCompactCalendarCompletionV5(raw, orderedEvents) {
  const head = String(raw ?? "").trim();
  if (head === "v5:z") {
    return [];
  }
  if (!head.startsWith("v5:")) {
    return [];
  }
  const body = head.slice(3);
  if (body === "z") {
    return [];
  }
  let bytes;
  try {
    bytes = base64UrlToBytes(body);
  } catch (_err) {
    return [];
  }
  if (bytes.length < 2) {
    return [];
  }
  const schema = bytes[0];
  if (schema !== V5_SCHEMA_V1) {
    return [];
  }
  const n = bytes[1];
  if (n === 0 || bytes.length !== 2 + 3 * n) {
    return [];
  }
  const fpWanted = new Set();
  for (let i = 0; i < n; i += 1) {
    fpWanted.add(readUint24BE(bytes, 2 + i * 3));
  }
  const list = Array.isArray(orderedEvents) ? orderedEvents : [];
  const keys = [];
  for (const ev of list) {
    const k = completionKey(ev);
    if (fpWanted.has(fingerprint24FromKey(k))) {
      keys.push(k);
    }
  }
  return keys;
}

function decodeCompactCalendarCompletionV6(raw, orderedEvents) {
  const head = String(raw ?? "").trim();
  if (head === "v6:z") {
    return [];
  }
  if (!head.startsWith("v6:")) {
    return [];
  }
  const body = head.slice(3);
  if (body === "z") {
    return [];
  }
  let bytes;
  try {
    bytes = base64UrlToBytes(body);
  } catch (_err) {
    return [];
  }
  if (bytes.length < 3) {
    return [];
  }
  const schema = bytes[0];
  if (schema !== V6_SCHEMA_V1) {
    return [];
  }
  const n = (bytes[1] << 8) | bytes[2];
  if (n === 0 || bytes.length !== 3 + 3 * n) {
    return [];
  }
  const fpWanted = new Set();
  for (let i = 0; i < n; i += 1) {
    fpWanted.add(readUint24BE(bytes, 3 + i * 3));
  }
  const list = Array.isArray(orderedEvents) ? orderedEvents : [];
  const keys = [];
  for (const ev of list) {
    const k = completionKey(ev);
    if (fpWanted.has(fingerprint24FromKey(k))) {
      keys.push(k);
    }
  }
  return keys;
}

function decodeCompactCalendarCompletionV3(raw, orderedEvents) {
  const body = String(raw ?? "").trim().startsWith("v3:") ? String(raw).trim().slice(3) : String(raw ?? "").trim();
  if (body === "z") {
    return [];
  }
  const W = V3_TOKEN_WIDTH;
  if (body.length === 0 || body.length % W !== 0) {
    return [];
  }
  const tokenSet = new Set();
  for (let i = 0; i < body.length; i += W) {
    tokenSet.add(body.slice(i, i + W));
  }
  const list = Array.isArray(orderedEvents) ? orderedEvents : [];
  const keys = [];
  for (const ev of list) {
    const k = completionKey(ev);
    if (tokenSet.has(stableCompletionTokenFromKey(k))) {
      keys.push(k);
    }
  }
  return keys;
}

function decodeCompactCalendarCompletionV2(raw, orderedEvents) {
  const list = Array.isArray(orderedEvents) ? orderedEvents : [];
  const E = list.map(ev => completionKey(ev));
  const body = String(raw ?? "").trim().startsWith("v2:") ? String(raw).trim().slice(3) : String(raw ?? "").trim();
  if (body === "z") {
    return [];
  }
  if (body === "t") {
    return [...E];
  }
  const keys = new Set();
  const parts = body.split("+").map(p => p.trim()).filter(Boolean);
  let idx = 0;
  const first = parts[0] || "";
  const nm = /^n(\d+)$/.exec(first);
  if (nm) {
    const k = Number(nm[1]);
    if (Number.isFinite(k) && k > 0) {
      for (let i = 0; i < Math.min(k, E.length); i += 1) {
        keys.add(E[i]);
      }
    }
    idx = 1;
  }
  for (; idx < parts.length; idx += 1) {
    expandCompactDaySegment(parts[idx], list, keys);
  }
  return [...keys];
}

/**
 * Expande JSON legacy o compacto v2 a claves completas.
 * Sin eventos, `v2:` devuelve [].
 */
export function expandCompletionPayloadToKeys(raw, orderedEvents) {
  const s = String(raw ?? "").trim();
  if (!s) {
    return [];
  }
  if (s.startsWith("v5:")) {
    return decodeCompactCalendarCompletionV5(s, orderedEvents);
  }
  if (s.startsWith("v6:")) {
    return decodeCompactCalendarCompletionV6(s, orderedEvents);
  }
  if (s.startsWith("v4:")) {
    return decodeCompactCalendarCompletionV4(s, orderedEvents);
  }
  if (s.startsWith("v3:")) {
    return decodeCompactCalendarCompletionV3(s, orderedEvents);
  }
  if (s.startsWith("v2:")) {
    return decodeCompactCalendarCompletionV2(s, orderedEvents);
  }
  try {
    const v = JSON.parse(s);
    if (!Array.isArray(v)) {
      return [];
    }
    return v.map(item => String(item)).filter(Boolean);
  } catch (_error) {
    return [];
  }
}

export function normalizeCompletionPayloadForCompare(raw, orderedEvents) {
  const keys = expandCompletionPayloadToKeys(raw, orderedEvents);
  const head = String(raw ?? "").trim();
  if (
    !keys.length &&
    (head.startsWith("v2:") ||
      head.startsWith("v3:") ||
      head.startsWith("v4:") ||
      head.startsWith("v5:") ||
      head.startsWith("v6:")) &&
    !(orderedEvents || []).length
  ) {
    return null;
  }
  return canonicalCompletionKeysJson(keys);
}

/**
 * Codificación compacta v2: prefijo cronológico `n{k}` + trozos `dYYYYMMDD` + `t` | `n{j}` | `i1-2-3`.
 */
export function serializeCompactCompletionV2(completedSet, orderedEvents) {
  const list = Array.isArray(orderedEvents) ? orderedEvents : [];
  const E = list.map(ev => completionKey(ev));
  const n = E.length;
  if (n === 0) {
    return null;
  }
  const C = completedSet instanceof Set ? completedSet : new Set(completedSet);
  const has = id => C.has(id);

  if (C.size === 0) {
    return "v2:z";
  }
  let allIn = true;
  for (let i = 0; i < n; i += 1) {
    if (!has(E[i])) {
      allIn = false;
      break;
    }
  }
  if (allIn && C.size === n) {
    return "v2:t";
  }

  let k = 0;
  while (k < n && has(E[k])) {
    k += 1;
  }
  const prefixKeys = new Set(E.slice(0, k));
  const remainder = [...C].filter(key => !prefixKeys.has(key));
  if (remainder.length === 0) {
    return `v2:n${k}`;
  }

  const byDay = new Map();
  for (const key of remainder) {
    const ev = list.find(e => completionKey(e) === key);
    if (!ev) {
      return null;
    }
    const dk = eventDayKeyCompact(ev);
    if (!dk) {
      return null;
    }
    if (!byDay.has(dk)) {
      byDay.set(dk, []);
    }
    byDay.get(dk).push(key);
  }

  const sortedDays = [...byDay.keys()].sort((a, b) => a.localeCompare(b, "en"));
  const daySegs = [];
  for (const dk of sortedDays) {
    const fullDay = list.filter(ev => eventDayKeyCompact(ev) === dk);
    const want = new Set(byDay.get(dk));
    const positions = [];
    for (let i = 0; i < fullDay.length; i += 1) {
      if (want.has(completionKey(fullDay[i]))) {
        positions.push(i + 1);
      }
    }
    if (positions.length === 0) {
      return null;
    }
    let seg;
    if (positions.length === fullDay.length) {
      seg = `d${dk}t`;
    } else {
      let j = 0;
      while (j < positions.length && positions[j] === j + 1) {
        j += 1;
      }
      if (j === positions.length) {
        seg = `d${dk}n${j}`;
      } else {
        seg = `d${dk}i${positions.join("-")}`;
      }
    }
    daySegs.push(seg);
  }

  const tail = daySegs.join("+");
  if (k > 0) {
    return `v2:n${k}+${tail}`;
  }
  return `v2:${tail}`;
}

/**
 * Codificación v3: solo huellas por clave canónica (no usa orden de lista).
 * Vacío `v3:z`; cada completado añade 11 caracteres base62.
 */
export function serializeCompactCompletionV3(completedSet) {
  const keys = [...(completedSet instanceof Set ? completedSet : new Set(completedSet))]
    .map(k => String(k))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "en"));
  if (keys.length === 0) {
    return "v3:z";
  }
  const tokens = keys.map(k => stableCompletionTokenFromKey(k)).sort((a, b) => a.localeCompare(b, "en"));
  return `v3:${tokens.join("")}`;
}

/**
 * Codificación v4: binario + Base64URL. Por defecto esquema **`0x02`** (40-bit, cabecera 2 bytes).
 * Si hubiera >255 huellas únicas, esquema **`0x01`** (48-bit + `uint16` count).
 * Vacío `v4:z`.
 */
export function serializeCompactCompletionV4(completedSet) {
  const keys = [...(completedSet instanceof Set ? completedSet : new Set(completedSet))]
    .map(k => String(k))
    .filter(Boolean);
  if (keys.length === 0) {
    return "v4:z";
  }
  const uniqFp40 = [...new Set(keys.map(k => fingerprint40FromKey(k)))].sort((a, b) => {
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }
    return 0;
  });
  const n = uniqFp40.length;
  if (n <= 255) {
    const buf = new Uint8Array(2 + 5 * n);
    buf[0] = V4_SCHEMA_V2;
    buf[1] = n & 0xff;
    for (let i = 0; i < n; i += 1) {
      writeUint40BE(buf, 2 + i * 5, uniqFp40[i]);
    }
    return `v4:${bytesToBase64Url(buf)}`;
  }
  const uniqFp48 = [...new Set(keys.map(k => fingerprint48FromKey(k)))].sort((a, b) => {
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }
    return 0;
  });
  const n48 = uniqFp48.length;
  if (n48 > 0xffff) {
    return null;
  }
  const buf = new Uint8Array(3 + 6 * n48);
  buf[0] = V4_SCHEMA_V1;
  buf[1] = (n48 >> 8) & 0xff;
  buf[2] = n48 & 0xff;
  for (let i = 0; i < n48; i += 1) {
    writeUint48BE(buf, 3 + i * 6, uniqFp48[i]);
  }
  return `v4:${bytesToBase64Url(buf)}`;
}

/**
 * Codificación v5: binario + Base64URL; huellas **24-bit** + `uint8` count (≤255 huellas únicas).
 * Vacío `v5:z`. **~62** huellas como techo práctico en 255 caracteres (ver tests).
 */
export function serializeCompactCompletionV5(completedSet) {
  const keys = [...(completedSet instanceof Set ? completedSet : new Set(completedSet))]
    .map(k => String(k))
    .filter(Boolean);
  if (keys.length === 0) {
    return "v5:z";
  }
  const uniqFp24 = [...new Set(keys.map(k => fingerprint24FromKey(k)))].sort((a, b) => {
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }
    return 0;
  });
  const n = uniqFp24.length;
  if (n > 255) {
    return null;
  }
  const buf = new Uint8Array(2 + 3 * n);
  buf[0] = V5_SCHEMA_V1;
  buf[1] = n & 0xff;
  for (let i = 0; i < n; i += 1) {
    writeUint24BE(buf, 2 + i * 3, uniqFp24[i]);
  }
  return `v5:${bytesToBase64Url(buf)}`;
}

/**
 * Codificación v6: binario + Base64URL; huellas 24-bit + `uint16` count (hasta 65535).
 * Diseñada para persistencia en múltiples helpers `input_text` (255xN).
 */
export function serializeCompactCompletionV6(completedSet) {
  const C = completedSet instanceof Set ? completedSet : new Set(completedSet || []);
  if (C.size === 0) {
    return "v6:z";
  }
  const fps = [...new Set([...C].map(key => fingerprint24FromKey(String(key))))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  if (!fps.length) {
    return "v6:z";
  }
  if (fps.length > 65535) {
    return null;
  }
  const n = fps.length;
  const buf = new Uint8Array(3 + 3 * n);
  buf[0] = V6_SCHEMA_V1;
  buf[1] = (n >>> 8) & 0xff;
  buf[2] = n & 0xff;
  let off = 3;
  for (const fp of fps) {
    writeUint24BE(buf, off, fp);
    off += 3;
  }
  return `v6:${bytesToBase64Url(buf)}`;
}

/**
 * Elige el payload a guardar respetando `maxLen`.
 * Entre formatos **estables** (`v6:` / `v5:` / `v4:` / `v3:`) elige el **más corto** que quepa (orden-independientes).
 * Si ninguno cabe, **`v2:`** y JSON por longitud creciente.
 */
export function pickShortestCompletionPayload(completedSet, orderedEvents, maxLen) {
  const keys = [...(completedSet instanceof Set ? completedSet : new Set(completedSet))];
  const jsonPayload = canonicalCompletionKeysJson(keys);
  const compactV2 = serializeCompactCompletionV2(completedSet, orderedEvents);
  const compactV3 = serializeCompactCompletionV3(completedSet);
  const compactV4 = serializeCompactCompletionV4(completedSet);
  const compactV5 = serializeCompactCompletionV5(completedSet);
  const compactV6 = serializeCompactCompletionV6(completedSet);

  const stable = [compactV6, compactV5, compactV4, compactV3].filter(p => p && p.length <= maxLen);
  stable.sort((a, b) => {
    if (a.length !== b.length) {
      return a.length - b.length;
    }
    const rank = p =>
      String(p).startsWith("v6:")
        ? 0
        : String(p).startsWith("v5:")
          ? 1
          : String(p).startsWith("v4:")
            ? 2
            : 3;
    return rank(a) - rank(b);
  });
  if (stable.length) {
    return stable[0];
  }

  const fallbacks = [];
  if (compactV2) {
    fallbacks.push(compactV2);
  }
  fallbacks.push(jsonPayload);
  fallbacks.sort((a, b) => a.length - b.length);
  for (const p of fallbacks) {
    if (p.length <= maxLen) {
      return p;
    }
  }
  return null;
}
