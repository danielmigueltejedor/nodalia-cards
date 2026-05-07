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
  assert.match(source, /Selecciona un calendario\./);
  assert.match(source, /Escribe un titulo\./);
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
  assert.match(source, /data-native-field="color"/);
  assert.match(source, /calendar-composer \.editor-color-picker/);
  assert.match(source, /_mountNativeColorControl\(\)/);
  assert.match(source, /value="none">No se repite/);
  assert.match(source, /value="yearly">Anualmente/);
  assert.doesNotMatch(source, /data-native-field="repeat"/);
  assert.doesNotMatch(source, /data-native-field="rrule"/);
  assert.match(source, /appendNodaliaEventMetadata/);
  assert.match(source, /extractNodaliaEventColor/);
  assert.match(source, /calendar\/event\/create/);
  assert.match(source, /calendar\/event\/delete/);
  assert.match(source, /data-action="delete-event"/);
  assert.match(source, /allow_delete/);
  assert.match(source, /\.calendar-event__delete[\s\S]*justify-content: center/);
  assert.match(source, /\.calendar-event__delete[\s\S]*width: 28px/);
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

test("calendar supports haptics and external popup open requests", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /haptics: \{/);
  assert.match(source, /const HAPTIC_PATTERNS/);
  assert.match(source, /_triggerHaptic\(styleOverride = null\)/);
  assert.match(source, /data-editor-toggle="haptics"/);
  assert.match(source, /window\.addEventListener\("nodalia-calendar-card-open"/);
  assert.match(source, /_onExternalOpenRequest\(event\)/);
  assert.match(source, /_openExpandedCalendar\(\{/);
});

test("climate card is registered and shipped in the HACS bundle", () => {
  const source = read("nodalia-climate-card.js");
  const build = read("scripts/build-bundle.mjs");
  const pkg = read("package.json");
  const readme = read("README.md");
  assert.match(source, /const CARD_TAG = "nodalia-climate-card"/);
  assert.match(source, /customElements\.define\(CARD_TAG, NodaliaClimateCard\)/);
  assert.match(build, /nodalia-climate-card\.js/);
  assert.match(pkg, /"nodalia-climate-card\.js"/);
  assert.match(readme, /custom:nodalia-climate-card/);
});

test("notifications card is bundled and supports smart dismissible notifications", () => {
  const source = read("nodalia-notifications-card.js");
  const i18n = read("nodalia-i18n.js");
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
  assert.match(source, /battery_entities/);
  assert.match(source, /humidifier_fill_entities/);
  assert.match(source, /ink_entities/);
  assert.match(source, /smart_notifications/);
  assert.match(source, /battery_low/);
  assert.match(source, /humidifier_fill_low/);
  assert.match(source, /ink_low/);
  assert.match(source, /dismissed_entity/);
  assert.match(source, /mobile_notifications/);
  assert.match(source, /mobile_notifications\.entities/);
  assert.match(source, /callService\("notify", "send_message"/);
  assert.match(source, /data:\s*data\.data/);
  assert.match(source, /data-editor-toggle="connections"/);
  assert.match(source, /type: "calendar-popup"/);
  assert.match(source, /nodalia-calendar-card-open/);
  assert.match(source, /weather\/get_forecasts/);
  assert.match(source, /rain_probability/);
  assert.match(source, /rain_lookahead_hours/);
  assert.match(source, /function entityAreaKey/);
  assert.match(source, /_getFanTargetForSource/);
  assert.match(source, /_buildWeatherNotifications/);
  assert.match(source, /_buildLevelNotifications/);
  assert.match(source, /shouldDarkenNotificationIconGlyph/);
  assert.match(source, /_smartMessage/);
  assert.match(source, /_smartAction/);
  assert.match(source, /window\.open\(url, "_blank", "noopener,noreferrer"\)/);
  assert.match(source, /orientationchange/);
  assert.match(source, /align-content: start/);
  assert.match(source, /_syncSharedDismissedFromHass/);
  assert.match(source, /_queueMobileNotifications/);
  assert.match(source, /this\._mobileSent\.has\(hash\) \|\| this\._isDismissed\(item\)/);
  assert.match(source, /notify\./);
  assert.match(source, /item\.severity !== "info"/);
  assert.match(source, /localStorage\.setItem\(this\._getStorageKey\(\)/);
  assert.match(source, /data-action="toggle-stack"/);
  assert.match(source, /notifications-card--empty/);
  assert.match(source, /notifications-card--list/);
  assert.match(source, /notifications-empty-inline/);
  assert.match(source, /notification-stack-card/);
  assert.match(source, /notification-item__chip/);
  assert.match(source, /notification-item__chips--top/);
  assert.match(source, /data-list-field/);
  assert.match(source, /tint_color/);
  assert.match(source, /animations\.enabled/);
  assert.match(source, /data-editor-toggle="animations"/);
  assert.match(source, /editor-section__toggle-button/);
  assert.match(source, /type="color"/);
  assert.match(source, /notifications-card--animated/);
  assert.match(source, /notifications-card--stack-\$\{stackTransition\}/);
  assert.match(source, /notifications-card-fade-up/);
  assert.match(source, /notifications-card-item-rise/);
  assert.match(source, /notifications-card-chip-pop/);
  assert.match(source, /notifications-card-bubble-bloom/);
  assert.match(source, /notifications-stack-reflow/);
  assert.match(source, /notifications-stack-collapse/);
  assert.match(source, /notificationSetChanged/);
  assert.match(source, /includeDomains/);
  assert.match(source, /id\.startsWith\("input_text\."\)/);
  assert.match(source, /id\.startsWith\("notify\."\)/);
  assert.match(source, /"dismissed_entity", config\.dismissed_entity/);
  assert.doesNotMatch(source, /_renderIconPickerField\("Icono", "icon"/);
  assert.match(source, /if \(this\._calendarRefreshTimer && delay === null\)/);
  assert.match(source, /if \(this\._weatherRefreshTimer && delay === null\)/);
  assert.match(source, /translateNotificationsUi/);
  assert.match(i18n, /rainSoon/);
  assert.match(i18n, /batteryLow/);
  assert.match(i18n, /inkLow/);
  assert.match(i18n, /viewWeather/);
  assert.match(source, /_callNamedService\(serviceValue, data = \{\}, target = null\)/);
  assert.match(source, /_callInternalService\(serviceValue, data = \{\}, target = null\)/);
  assert.match(source, /const domains = security\.allowed_service_domains \|\| \[\]/);
  assert.match(source, /const services = security\.allowed_services \|\| \[\]/);
  assert.match(source, /\.slice\(-30\)/);
  assert.doesNotMatch(source, /\.slice\(-40\)/);
  assert.match(source, /const hasContent = item\.title \|\| item\.message \|\| item\.entity/);
  assert.match(source, /return hasContent && !isPlaceholder/);
  assert.match(source, /id:\s*`custom:\$\{notificationHash/);
  assert.doesNotMatch(source, /id:\s*`custom:\$\{index\}:/);
  assert.match(source, /const coldest = \[\.\.\.tempSources\]\.sort/);
  assert.match(source, /fan\.turn_on/);
  assert.match(source, /calendars\/\$\{encodeURIComponent\(entityId\)\}/);
  assert.match(source, /editorFilteredStatesSignature/);
  assert.match(source, /sanitizeCssRuntimeValue/);
  assert.match(i18n, /notificationsCard/);
  assert.match(i18n, /function translateNotificationsUi/);
  assert.match(build, /nodalia-notifications-card\.js/);
  assert.match(pkg, /"nodalia-notifications-card\.js"/);
  assert.match(pkg, /"nodalia-cards\.bundle\.js"/);
  assert.match(pkg, /"nodalia-cards\.manifest\.js"/);
  assert.match(readme, /custom:nodalia-notifications-card/);
});

test("bundle build minifies production output", () => {
  const source = read("scripts/build-bundle.mjs");
  assert.match(source, /minify:\s*true/);
});

test("HACS bundle entrypoint is self-contained and still emits diagnostics", () => {
  const source = read("scripts/build-bundle.mjs");
  assert.match(source, /nodalia-cards\.bundle\.js/);
  assert.match(source, /nodalia-cards\.manifest\.js/);
  assert.match(source, /fs\.writeFileSync\(loaderPath, `\$\{body\}\\n\$\{footer\}\\n\$\{inlineLoaderFooter\}\\n`\)/);
  assert.match(source, /mode: "inline"/);
  assert.match(source, /window\.__NODALIA_LOADER__/);
  assert.match(source, /window\.__NODALIA_BUNDLE__/);
});
