/**
 * Codificación compacta v2/v3 de eventos completados para el input_text (límite 255).
 * - v2: índices en ventana + trozos por día (depende del orden de carga).
 * - v3: huella FNV-1a 64-bit por clave lógica (orden-independiente; mismos eventos → misma huella).
 * @see nodalia-calendar-card.js
 */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** 62^10 < 2^64 < 62^11 — ancho fijo para concatenar tokens sin separador. */
const V3_TOKEN_WIDTH = 11;

function fnv1a64Utf8(str) {
  const bytes =
    typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(String(str))
      : typeof Buffer !== "undefined"
        ? Buffer.from(String(str), "utf8")
        : new Uint8Array([...String(str)].map(c => c.charCodeAt(0) & 0xff));
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
  if (!keys.length && (head.startsWith("v2:") || head.startsWith("v3:")) && !(orderedEvents || []).length) {
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

export function pickShortestCompletionPayload(completedSet, orderedEvents, maxLen) {
  const keys = [...(completedSet instanceof Set ? completedSet : new Set(completedSet))];
  const jsonPayload = canonicalCompletionKeysJson(keys);
  const compactV2 = serializeCompactCompletionV2(completedSet, orderedEvents);
  const compactV3 = serializeCompactCompletionV3(completedSet);
  const candidates = [];
  if (compactV2) {
    candidates.push(compactV2);
  }
  candidates.push(compactV3);
  candidates.push(jsonPayload);
  const rank = p => {
    if (p.startsWith("v3:")) {
      return 0;
    }
    if (p.startsWith("v2:")) {
      return 1;
    }
    return 2;
  };
  candidates.sort((a, b) => {
    if (a.length !== b.length) {
      return a.length - b.length;
    }
    return rank(a) - rank(b);
  });
  for (const p of candidates) {
    if (p.length <= maxLen) {
      return p;
    }
  }
  return null;
}
