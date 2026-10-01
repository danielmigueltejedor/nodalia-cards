import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";
function load(source = "calendar-helpers") {
  const box = { Date, Intl }; box.window = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync("nodalia-utils.js", "utf8"), box);
  vm.runInContext(buildSync({ stdin: { contents: `export * from "./src/cards/calendar/${source}.ts"; export { dateTimeFormatterCache } from "./src/cards/calendar/calendar-constants.ts";`, resolveDir: process.cwd() }, bundle: true, write: false, format: "iife", globalName: "api" }).outputFiles[0].text, box);
  return box.api;
}
const api = load();
const plain = value => JSON.parse(JSON.stringify(value));

test("Calendar date-only values stay local at noon, including DST days, and reject impossible dates", () => {
  for (const day of ["2026-03-29", "2026-10-25", "2024-02-29", "0099-01-01"]) {
    const date = api.parseCalendarDateOnlyLocal(day);
    assert.equal(date.getHours(), 12);
    assert.equal(api.forecastDayKey(day), day === "0099-01-01" ? "99-01-01" : day);
    assert.equal(api.parseDateInputAsLocalDate(day).getHours(), 0);
    assert.equal(api.eventDate({ date: day }).getTime(), date.getTime());
  }
  for (const day of ["2026-02-29", "2026-04-31", "2026-00-01", "2026-13-01", "2026-01-00", "not a date"]) {
    assert.equal(api.parseCalendarDateOnlyLocal(day), null);
    assert.equal(api.parseDateInputAsLocalDate(day), null);
    assert.equal(api.eventDate(day), null);
    assert.equal(api.forecastDayKey(day), "");
  }
  assert.equal(api.forecastDayKey("2026-10-01T00:10:00+14:00"), "2026-10-01");
  assert.equal(api.eventDate({ dateTime: "2026-10-01T00:10:00+14:00" }).toISOString(), "2026-09-30T10:10:00.000Z");
});

test("Calendar forecast candidates preserve zero and continue past absent values", () => {
  assert.equal(api.pickFirstFiniteNumber(null, "", false, undefined, "12"), 12);
  assert.equal(api.pickFirstFiniteNumber(null, 0, 15), 0);
  assert.equal(api.pickFirstFiniteNumber(null, "", {}, Infinity), null);
  assert.equal(api.weatherConditionIcon("clear-night"), "mdi:weather-night");
  assert.equal(api.weatherConditionIcon("snowy-rainy"), "mdi:weather-snowy-rainy");
});

test("Calendar event metadata round-trips safe tints without retaining embedded CSS payloads", () => {
  const description = api.appendNodaliaEventMetadata("Meeting", { color: "rgba(10, 20, 30, .4)" });
  assert.equal(api.extractNodaliaEventColor(description), "rgba(10, 20, 30, .4)");
  assert.equal(api.stripNodaliaEventMetadata(description), "Meeting");
  for (const unsafe of ['rgb(0 0 0);background:url(x)', 'rgba(1,2,3,.4)"', 'var(--x)/*bad*/', 'rgb(0\n0 0)']) {
    assert.equal(api.sanitizeCalendarTint(unsafe), "");
    assert.equal(api.appendNodaliaEventMetadata("Meeting", { color: unsafe }), "Meeting");
  }
});

test("Calendar transport normalization ignores malformed rows and preserves recurring occurrence identity", () => {
  const event = { eventData: { uid: "series", recurrence_id: "2026-10-01" }, start: { date: "2026-10-01" }, _entity: "calendar.home", summary: "Meet" };
  assert.equal(api.calendarEventUid(event), "series");
  assert.equal(api.calendarEventRecurrenceId(event), "2026-10-01");
  assert.notEqual(api.calendarEventKey(event), api.calendarEventKey({ ...event, recurrence_id: "2026-10-02" }));
  assert.deepEqual(plain(api.normalizeCalendarFetchResult({ events: [null, false, "x", [], event] })), [event]);
  assert.equal(api.eventIsAllDay(event), true);
  assert.equal(api.eventIsAllDay({ start: { dateTime: "2026-10-01T12:00:00Z" } }), false);
  assert.equal(api.calendarEventKey(null), "||||");
});

test("Calendar config keeps YAML extensions, editor placeholders, legacy ranges and its CSS policy", () => {
  const configApi = load("calendar-config");
  const input = { calendars: ["calendar.home", { entity: "", label: "New", tint: "#123456" }, null], time_range: "old", days_to_show: 14, quick_reminder_webhook: "obsolete", extension: { marker: 1 }, styles: { extra: "value", card: { extra: 42, padding: "20px", background: "url(https://example.test)" } } };
  const config = configApi.normalizeConfig(input);
  assert.equal(config.calendars.length, 2);
  assert.equal(config.calendars[1].label, "New");
  assert.equal(config.time_range, "2w");
  assert.equal(config.days_to_show, 14);
  assert.equal(config.styles.card.background, configApi.DEFAULT_CONFIG.styles.card.background);
  assert.equal(config.styles.card.padding, "20px");
  assert.equal(config.styles.card.extra, 42);
  assert.equal(config.styles.extra, "value");
  assert.deepEqual(plain(config.extension), { marker: 1 });
  assert.equal(config.quick_reminder_webhook, undefined);
  assert.equal(input.quick_reminder_webhook, "obsolete");
  assert.equal(configApi.normalizeConfig({ time_range: "old", days_to_show: null }).time_range, "1w");
  assert.equal(configApi.normalizeConfig({ styles: false, security: false, haptics: false }).haptics.style, "medium");
});

test("Calendar color fallback is available without a config/helper cycle and formatter cache is bounded", () => {
  assert.equal(api.getEditorColorFallbackValue("styles.card.background"), "var(--ha-card-background)");
  assert.equal(api.getEditorColorFallbackValue("styles.tint.color"), "var(--primary-color)");
  const initial = api.getDateTimeFormatter("en", { year: "numeric" });
  assert.equal(api.getDateTimeFormatter("en", { year: "numeric" }), initial);
  for (let i = 0; i < 60; i++) {
    const offset = Math.floor(i / 3) - 10;
    api.getDateTimeFormatter("en", { year: "numeric", timeZone: offset === 0 ? 'Etc/GMT' : `Etc/GMT${offset > 0 ? '+' : ''}${offset}`, weekday: ['short', 'long', 'narrow'][i % 3] });
  }
  assert.equal(api.dateTimeFormatterCache.size, 48);
  assert.notEqual(api.getDateTimeFormatter("en", { year: "numeric" }), initial);
  assert.equal(api.formatDateLabel(new Date(2026, 9, 1), "en").includes("Oct"), true);
});

test("Calendar animation overrides separate absence from actual zero and retain extensions", () => {
  const configApi = load("calendar-config");
  for (const value of [undefined, null, "", "  ", "bad", Infinity]) {
    assert.equal(configApi.normalizeConfig({ animations: { content_duration: value } }).animations.content_duration, 260);
  }
  for (const value of [0, "0", -10]) assert.equal(configApi.normalizeConfig({ animations: { content_duration: value } }).animations.content_duration, 120);
  const config = configApi.normalizeConfig({ animations: { enabled: false, content_duration: "420", extension: 0 }, extension: { flag: false } });
  assert.deepEqual(plain(config.animations), { enabled: false, content_duration: 420, extension: 0 });
  assert.deepEqual(plain(config.extension), { flag: false });
});
