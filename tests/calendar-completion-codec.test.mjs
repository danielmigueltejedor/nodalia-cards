import assert from "node:assert";
import test from "node:test";
import {
  completionKey,
  expandCompletionPayloadToKeys,
  serializeCompactCompletionV2,
  serializeCompactCompletionV3,
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

test("pickShortest prefers compact under 255", () => {
  const ordered = [
    ev("calendar.a", "u1", "2026-05-06T10:00:00.000Z", "A"),
    ev("calendar.a", "u2", "2026-05-07T12:00:00.000Z", "B"),
  ];
  const keys = new Set(ordered.map(completionKey));
  const p = pickShortestCompletionPayload(keys, ordered, 255);
  assert.ok(p.startsWith("v2:"));
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

test("v3 beats JSON when v2 cannot encode (no ordered events)", () => {
  const longSummary = "x".repeat(120);
  const ordered = [ev("calendar.trabajo", "series-abc", "2026-06-01T08:00:00.000Z", longSummary)];
  const keys = new Set([completionKey(ordered[0])]);
  const jsonPayload = JSON.stringify([...keys].sort());
  const v3 = serializeCompactCompletionV3(keys);
  assert.ok(v3.length < jsonPayload.length, "v3 shorter than JSON for long titles");
  const picked = pickShortestCompletionPayload(keys, [], 255);
  assert.strictEqual(picked, v3);
  assert.ok(picked.startsWith("v3:"));
});

test("pickShortest still prefers v2 when it is shorter than v3", () => {
  const ordered = [
    ev("calendar.a", "u1", "2026-05-06T10:00:00.000Z", "A"),
    ev("calendar.a", "u2", "2026-05-07T12:00:00.000Z", "B"),
  ];
  const keys = new Set([completionKey(ordered[0])]);
  const picked = pickShortestCompletionPayload(keys, ordered, 255);
  assert.strictEqual(picked, "v2:n1");
});
