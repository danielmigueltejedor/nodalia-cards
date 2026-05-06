import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("url openings keep noopener,noreferrer hardening", () => {
  const files = [
    "nodalia-insignia-card.js",
    "nodalia-entity-card.js",
    "nodalia-fav-card.js",
    "nodalia-navigation-bar.js",
    "nodalia-advance-vacuum-card.js",
  ];
  files.forEach(file => {
    const source = read(file);
    assert.match(source, /window\.open\([^)]*"noopener,noreferrer"\)/);
  });
});

test("action URL sinks use sanitizeActionUrl", () => {
  const files = [
    "nodalia-insignia-card.js",
    "nodalia-entity-card.js",
    "nodalia-fav-card.js",
    "nodalia-navigation-bar.js",
    "nodalia-media-player.js",
    "nodalia-advance-vacuum-card.js",
  ];
  files.forEach(file => {
    const source = read(file);
    assert.match(source, /sanitizeActionUrl\(/);
  });
});

test("high-frequency cards share render signature runtime", () => {
  const files = [
    "nodalia-navigation-bar.js",
    "nodalia-graph-card.js",
    "nodalia-media-player.js",
  ];
  files.forEach(file => {
    const source = read(file);
    assert.match(source, /getRenderSignatureRuntime\(/);
    assert.match(source, /window\.NodaliaRenderSignature/);
  });
});

test("drag listeners stay attach-on-drag only", () => {
  const files = [
    "nodalia-light-card.js",
    "nodalia-fan-card.js",
    "nodalia-humidifier-card.js",
  ];
  files.forEach(file => {
    const source = read(file);
    assert.match(source, /_dragWindowListenersAttached/);
    assert.match(source, /_attachWindowDragListeners\(/);
    assert.match(source, /_detachWindowDragListeners\(/);
  });
});

test("navigation runtime css sanitizer guard is present in source", () => {
  const source = read("nodalia-navigation-bar.js");
  assert.match(source, /function sanitizeCssRuntimeValue\(value\)/);
  assert.match(source, /if \(\/\[<>\{\};"'\]\/\.test\(raw\) \|\| raw\.includes\("\/\*"\) \|\| raw\.includes\("\*\/"\)\)/);
});

test("calendar runtime css sanitizer and webhook admin guard are present", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /function sanitizeCssRuntimeValue\(value\)/);
  assert.match(source, /security\.allow_webhooks_for_non_admin/);
  assert.match(source, /webhook bloqueado para usuario no administrador/);
});

test("calendar weather forecast normalization keeps date-keyed and tabular daily rows", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /function withForecastDateFromKey\(key, value\)/);
  assert.match(source, /weather\/subscribe_forecast/);
  assert.match(source, /_ensureWeatherForecastSubscription\(\)/);
  assert.match(source, /_weatherForecastEvents/);
  assert.match(source, /supportedWeatherForecastTypes\(stateObj\)/);
  assert.match(source, /_fetchForecastViaService\(entityId, forecastType\)/);
  assert.match(source, /_selectBestForecastRows\(forecastCandidates\)/);
  assert.match(source, /preserveRicherExisting: true/);
  assert.match(source, /_nodaliaForecastType === "hourly"/);
  assert.match(source, /_tagForecastRows\(event\?\.forecast \?\? event, forecastType\)/);
  assert.match(source, /raw\.time \?\? raw\.datetime \?\? raw\.date \?\? raw\.dates/);
  assert.match(source, /this\._normalizeForecastRows\(withForecastDateFromKey\(key, value\)\)/);
  assert.match(source, /item\.temperatureLow/);
  assert.match(source, /item\.temperature_2m_min/);
});

test("calendar expanded popup reuses daily weather badges", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /_renderWeatherBadge\(dayDate, weatherByDay/);
  assert.match(source, /this\._renderExpandedBody\(groups, config, locale, weatherByDay\)/);
  assert.match(source, /calendar-expanded__month-weather/);
  assert.match(source, /calendar-expanded__day-detail-heading/);
  assert.match(source, /calendar-expanded__col-head/);
});

test("calendar native event webhook sends sanitized service data", () => {
  const source = read("nodalia-calendar-card.js");
  const example = read("examples/calendar-native-event-webhook.yaml");
  assert.match(source, /_buildNativeCalendarCreateEventWebhookBody\(servicePayload, eventKind, calendarEvent = null\)/);
  assert.match(source, /service: "calendar\.create_event"/);
  assert.match(source, /service_data: serviceData/);
  assert.match(source, /calendar_event: eventData/);
  assert.match(source, /type: "calendar\/event\/create"/);
  assert.match(source, /ha_action: \{/);
  assert.match(source, /action: "calendar\.create_event"/);
  assert.match(source, /value !== "" && value !== null && value !== undefined/);
  assert.match(source, /_buildNativeCalendarCreateEventWebhookBody\(payload, "all_day", calendarEventPayload\)/);
  assert.match(source, /_buildNativeCalendarCreateEventWebhookBody\(payload, "timed", calendarEventPayload\)/);
  assert.match(example, /event_kind == 'all_day'/);
  assert.match(example, /event_kind == 'timed'/);
  assert.doesNotMatch(example, /start_date:\s*""/);
  assert.doesNotMatch(example, /start_date_time:\s*""/);
});

test("calendar composers reject past dates with inline popup errors", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /function dateInputIsBeforeToday\(value\)/);
  assert.match(source, /_setComposerError\(kind, message\)/);
  assert.match(source, /_renderComposerError\("native"\)/);
  assert.match(source, /dateInputIsBeforeToday\(dateRaw\)/);
  assert.match(source, /La fecha no puede ser anterior a hoy\./);
  assert.match(source, /calendar-composer__error/);
});

test("calendar compact completion waits for calendar events before sync", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /function completionPayloadNeedsEvents\(raw\)/);
  assert.match(source, /value\.startsWith\("v5:"\)/);
  assert.match(source, /completionPayloadNeedsEvents\(raw\)/);
  assert.match(source, /this\._syncCompletedAfterEventsLoaded\(\)/);
  assert.match(source, /expandCompletionPayloadToKeys\(raw, events\)/);
  assert.doesNotMatch(source, /_buildQuickReminderEvents/);
  assert.doesNotMatch(source, /_submitQuickReminderComposer/);
});

test("calendar native composer supports rich HA event fields and details", () => {
  const source = read("nodalia-calendar-card.js");
  const example = read("examples/calendar-native-event-webhook.yaml");
  assert.match(source, /data-native-field="description"/);
  assert.match(source, /data-native-field="location"/);
  assert.match(source, /data-native-field="repeatKind"/);
  assert.match(source, /value="none">No se repite/);
  assert.match(source, /value="yearly">Anualmente/);
  assert.doesNotMatch(source, /data-native-field="repeat"/);
  assert.doesNotMatch(source, /data-native-field="rrule"/);
  assert.match(source, /appendNodaliaEventMetadata/);
  assert.match(source, /extractNodaliaEventColor/);
  assert.match(source, /calendar\/event\/create/);
  assert.match(source, /data-action="open-event-detail"/);
  assert.match(source, /calendar-expanded__event-detail/);
  assert.match(example, /description: "\{\{ d\.description \| default\(omit, true\) \}\}"/);
  assert.match(example, /location: "\{\{ d\.location \| default\(omit, true\) \}\}"/);
  assert.doesNotMatch(example, /rrule:/);
});

test("calendar editor signature only scans relevant entity domains", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /editorFilteredStatesSignature/);
  assert.match(source, /id\.startsWith\("calendar\."\)/);
  assert.match(source, /id\.startsWith\("input_text\."\)/);
  assert.match(source, /id\.startsWith\("weather\."\)/);
});

test("notifications card is bundled and supports smart dismissible notifications", () => {
  const source = read("nodalia-notifications-card.js");
  const build = read("scripts/build-bundle.mjs");
  const pkg = read("package.json");
  const readme = read("README.md");
  assert.match(source, /customElements\.define\(CARD_TAG, NodaliaNotificationsCard\)/);
  assert.match(source, /custom_notifications/);
  assert.match(source, /calendar_entities/);
  assert.match(source, /vacuum_entities/);
  assert.match(source, /weather_entities/);
  assert.match(source, /fan_entities/);
  assert.match(source, /motion_entities/);
  assert.match(source, /door_entities/);
  assert.match(source, /window_entities/);
  assert.match(source, /temperature_entities/);
  assert.match(source, /humidity_entities/);
  assert.match(source, /localStorage\.setItem\(this\._getStorageKey\(\)/);
  assert.match(source, /data-action="toggle-stack"/);
  assert.match(source, /fan\.turn_on/);
  assert.match(source, /calendars\/\$\{encodeURIComponent\(entityId\)\}/);
  assert.match(source, /editorFilteredStatesSignature/);
  assert.match(source, /sanitizeCssRuntimeValue/);
  assert.match(build, /nodalia-notifications-card\.js/);
  assert.match(pkg, /"nodalia-notifications-card\.js"/);
  assert.match(readme, /custom:nodalia-notifications-card/);
});

test("bundle build minifies production output", () => {
  const source = read("scripts/build-bundle.mjs");
  assert.match(source, /minify:\s*true/);
});
