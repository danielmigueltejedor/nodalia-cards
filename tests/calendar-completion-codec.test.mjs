import assert from "node:assert";
import test from "node:test";
import {
  completionKey,
  expandCompletionPayloadToKeys,
  fingerprint48FromKey,
  serializeCompactCompletionV2,
  serializeCompactCompletionV3,
  serializeCompactCompletionV4,
  serializeCompactCompletionV5,
  stableCompletionTokenFromKey,
  pickShortestCompletionPayload,
} from "../nodalia-calendar-completion-codec.js";

function ev(entity, uid, iso, summary) {
  return {
    _entity: entity,
    uid,
    summary,
    start: { dateTime: iso },
  };
}

test("prefix n{k} round-trip", () => {
  const ordered = [
    ev("calendar.a", "u1", "2026-05-06T10:00:00.000Z", "A"),
    ev("calendar.a", "u2", "2026-05-07T12:00:00.000Z", "B"),
    ev("calendar.a", "u3", "2026-05-08T14:00:00.000Z", "C"),
  ];
  const keys = ordered.slice(0, 2).map(completionKey);
  const s = serializeCompactCompletionV2(new Set(keys), ordered);
  assert.strictEqual(s, "v2:n2");
  const back = expandCompletionPayloadToKeys(s, ordered);
  assert.deepStrictEqual(new Set(back), new Set(keys));
});

test("all completed uses v2:t", () => {
  const ordered = [ev("calendar.a", "u1", "2026-05-06T10:00:00.000Z", "A")];
  const keys = ordered.map(completionKey);
  assert.strictEqual(serializeCompactCompletionV2(new Set(keys), ordered), "v2:t");
});

test("same-day non-contiguous remainder round-trip", () => {
  const ordered = [
    ev("calendar.a", "u1", "2026-05-23T09:00:00.000Z", "M"),
    ev("calendar.a", "u2", "2026-05-23T11:00:00.000Z", "N"),
    ev("calendar.a", "u3", "2026-05-23T15:00:00.000Z", "O"),
  ];
  const keys = new Set([completionKey(ordered[0]), completionKey(ordered[2])]);
  const s = serializeCompactCompletionV2(keys, ordered);
  assert.ok(s && s.startsWith("v2:"), s);
  const back = new Set(expandCompletionPayloadToKeys(s, ordered));
  assert.deepStrictEqual(back, keys);
});

test("pickShortest prefers shorter stable v5 over v4/v3 when all fit", () => {
  const ordered = [
    ev("calendar.a", "u1", "2026-05-06T10:00:00.000Z", "A"),
    ev("calendar.a", "u2", "2026-05-07T12:00:00.000Z", "B"),
  ];
  const keys = new Set(ordered.map(completionKey));
  const p = pickShortestCompletionPayload(keys, ordered, 255);
  assert.strictEqual(p, serializeCompactCompletionV5(keys));
  assert.ok(p.startsWith("v5:"));
  assert.ok(serializeCompactCompletionV5(keys).length < serializeCompactCompletionV4(keys).length);
  assert.ok(serializeCompactCompletionV4(keys).length < serializeCompactCompletionV3(keys).length);
});

test("v3 round-trip is independent of event order in list", () => {
  const a = ev("calendar.a", "u1", "2026-05-06T10:00:00.000Z", "A");
  const b = ev("calendar.a", "u2", "2026-05-07T12:00:00.000Z", "B");
  const c = ev("calendar.a", "u3", "2026-05-08T14:00:00.000Z", "C");
  const ordered = [a, b, c];
  const keys = new Set([completionKey(a), completionKey(c)]);
  const payload = serializeCompactCompletionV3(keys);
  assert.ok(payload.startsWith("v3:"), payload);
  const shuffled = [c, a, b];
  const back = expandCompletionPayloadToKeys(payload, shuffled);
  assert.deepStrictEqual(new Set(back), keys);
});

test("stableCompletionTokenFromKey matches serialized token", () => {
  const k = completionKey(ev("calendar.x", "uid", "2026-01-02T15:00:00.000Z", "Meet"));
  const t = stableCompletionTokenFromKey(k);
  assert.strictEqual(t.length, 11);
  const only = serializeCompactCompletionV3(new Set([k]));
  assert.strictEqual(only, `v3:${t}`);
});

test("v5 beats v4/JSON when v2 cannot encode (no ordered events)", () => {
  const longSummary = "x".repeat(120);
  const ordered = [ev("calendar.trabajo", "series-abc", "2026-06-01T08:00:00.000Z", longSummary)];
  const keys = new Set([completionKey(ordered[0])]);
  const jsonPayload = JSON.stringify([...keys].sort());
  const v5 = serializeCompactCompletionV5(keys);
  const v4 = serializeCompactCompletionV4(keys);
  assert.ok(v5.length < v4.length && v5.length < jsonPayload.length, "v5 shortest for long titles");
  const picked = pickShortestCompletionPayload(keys, [], 255);
  assert.strictEqual(picked, v5);
  assert.ok(picked.startsWith("v5:"));
});

test("pickShortest falls back to shortest of v2 vs JSON when stable formats exceed maxLen", () => {
  const ordered = [
    ev("calendar.a", "u1", "2026-05-06T10:00:00.000Z", "A"),
    ev("calendar.a", "u2", "2026-05-07T12:00:00.000Z", "B"),
  ];
  const keys = new Set([completionKey(ordered[0])]);
  const v3 = serializeCompactCompletionV3(keys);
  assert.ok(v3.length > 10, "sanity");
  const picked = pickShortestCompletionPayload(keys, ordered, 8);
  assert.notStrictEqual(picked, v3);
  assert.strictEqual(picked, "v2:n1");
});

test("v4 round-trip is order-independent", () => {
  const a = ev("calendar.a", "u1", "2026-05-06T10:00:00.000Z", "A");
  const b = ev("calendar.a", "u2", "2026-05-07T12:00:00.000Z", "B");
  const c = ev("calendar.a", "u3", "2026-05-08T14:00:00.000Z", "C");
  const keys = new Set([completionKey(a), completionKey(c)]);
  const payload = serializeCompactCompletionV4(keys);
  assert.ok(payload.startsWith("v4:"));
  const back = expandCompletionPayloadToKeys(payload, [c, a, b]);
  assert.deepStrictEqual(new Set(back), keys);
});

test("pickShortest picks v5 for one completion (24-bit shorter than v4/v3)", () => {
  const ordered = [
    ev("calendar.a", "u1", "2026-05-06T10:00:00.000Z", "A"),
    ev("calendar.a", "u2", "2026-05-07T12:00:00.000Z", "B"),
  ];
  const keys = new Set([completionKey(ordered[0])]);
  assert.ok(serializeCompactCompletionV5(keys).length < serializeCompactCompletionV4(keys).length);
  assert.ok(serializeCompactCompletionV4(keys).length < serializeCompactCompletionV3(keys).length);
  const picked = pickShortestCompletionPayload(keys, ordered, 255);
  assert.strictEqual(picked, serializeCompactCompletionV5(keys));
  assert.ok(picked.startsWith("v5:"));
});

test("v4 schema 1 (48-bit) legacy binary still expands", () => {
  const ordered = [
    ev("calendar.a", "u1", "2026-05-06T10:00:00.000Z", "A"),
    ev("calendar.a", "u2", "2026-05-07T12:00:00.000Z", "B"),
  ];
  const k = completionKey(ordered[0]);
  const fp = fingerprint48FromKey(k);
  const buf = Buffer.alloc(9);
  buf[0] = 1;
  buf.writeUInt16BE(1, 1);
  let v = BigInt(fp) & ((1n << 48n) - 1n);
  for (let i = 5; i >= 0; i--) {
    buf[3 + i] = Number(v & 0xffn);
    v >>= 8n;
  }
  const b64 = buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const raw = `v4:${b64}`;
  const back = expandCompletionPayloadToKeys(raw, ordered);
  assert.deepStrictEqual(new Set(back), new Set([k]));
});

test("v5 round-trip is order-independent", () => {
  const a = ev("calendar.a", "u1", "2026-05-06T10:00:00.000Z", "A");
  const b = ev("calendar.a", "u2", "2026-05-07T12:00:00.000Z", "B");
  const c = ev("calendar.a", "u3", "2026-05-08T14:00:00.000Z", "C");
  const keys = new Set([completionKey(a), completionKey(c)]);
  const payload = serializeCompactCompletionV5(keys);
  assert.ok(payload.startsWith("v5:"));
  const back = expandCompletionPayloadToKeys(payload, [c, a, b]);
  assert.deepStrictEqual(new Set(back), keys);
});

test("v5 fits 62 distinct completions within 255 chars; 63 exceeds", () => {
  const ordered = Array.from({ length: 62 }, (_, i) =>
    ev("calendar.fam", `uid-${i}`, "2026-06-01T09:" + String(i).padStart(2, "0") + ":00:00.000Z", `T${i}`),
  );
  const keys = new Set(ordered.map(completionKey));
  const p62 = serializeCompactCompletionV5(keys);
  assert.ok(p62.length <= 255, `length ${p62.length}`);
  const ordered63 = [...ordered, ev("calendar.fam", "uid-62", "2026-06-01T18:00:00.000Z", "T62")];
  const keys63 = new Set(ordered63.map(completionKey));
  const p63 = serializeCompactCompletionV5(keys63);
  assert.ok(p63.length > 255, `expected >255, got ${p63.length}`);
});

test("31 completions in v5 vs v4 string length (order of magnitude)", () => {
  const ordered = Array.from({ length: 31 }, (_, i) =>
    ev("calendar.fam", `uid-${i}`, "2026-06-01T09:" + String(i).padStart(2, "0") + ":00:00.000Z", `T${i}`),
  );
  const keys = new Set(ordered.map(completionKey));
  const v5 = serializeCompactCompletionV5(keys);
  const v4 = serializeCompactCompletionV4(keys);
  assert.ok(v5.length < v4.length);
  assert.ok(v5.length < 200);
});
