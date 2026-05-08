import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("published package files and bundle manifest stay coherent", () => {
  const pkg = JSON.parse(read("package.json"));
  const manifest = read("nodalia-cards.manifest.js");

  assert.ok(manifest.includes(`"pkgVersion": "${pkg.version}"`));
  assert.ok(manifest.includes(`export const pkgVersion = "${pkg.version}";`));
  assert.doesNotMatch(manifest, /contentSha256_12": ""/);
  assert.doesNotMatch(manifest, /export const contentSha256_12 = ""/);

  pkg.files.forEach(file => {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} should exist`);
  });
  assert.ok(!pkg.files.includes("nodalia-calendar-completion-codec.js"));
});

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
  assert.match(source, /Escribe un título\./);
  assert.match(source, /calendar-composer__error/);
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
  assert.doesNotMatch(source, /toggle-complete/);
  assert.doesNotMatch(source, /shared_completed_events_/);
  assert.doesNotMatch(source, /localStorage/);
  assert.match(example, /description: "\{\{ d\.description \| default\(omit, true\) \}\}"/);
  assert.match(example, /location: "\{\{ d\.location \| default\(omit, true\) \}\}"/);
  assert.doesNotMatch(example, /rrule:/);
});

test("calendar all-day labels use shared locale text", () => {
  const source = read("nodalia-calendar-card.js");
  const i18n = read("nodalia-i18n.js");
  assert.match(source, /_uiText\(path, fallback, values = \{\}\)/);
  assert.match(source, /translateNotificationsUi/);
  assert.match(source, /_uiText\("allDay", "Todo el día"\)/);
  assert.doesNotMatch(source, /Todo el dia/);
  assert.match(i18n, /allDay: "Ganztägig"/);
  assert.match(i18n, /allDay: "Toute la journée"/);
  assert.match(i18n, /allDay: "全天"/);
});

test("calendar editor signature only scans relevant entity domains", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /editorFilteredStatesSignature/);
  assert.match(source, /id\.startsWith\("calendar\."\)/);
  assert.doesNotMatch(source, /id\.startsWith\("input_text\."\)/);
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

test("weather forecast dates use the resolved Home Assistant locale", () => {
  const source = read("nodalia-weather-card.js");
  assert.match(source, /function formatForecastDateTime\(value, type, locale\)/);
  assert.match(source, /const localeArg = locale && locale !== "auto" \? locale : undefined/);
  assert.match(source, /toLocaleDateString\(localeArg/);
  assert.match(source, /const forecastLocale = window\.NodaliaI18n\?\.localeTag\?\.\(langFc\) \|\| langFc/);
  assert.match(source, /_renderForecastChart\(visibleItems, activeType, state, forecastLocale\)/);
  assert.match(source, /formatForecastDateTime\(item\?\.datetime, activeType, forecastLocale\)/);
});

test("shared visual editor exact overrides cover all supported editor languages", () => {
  const source = read("nodalia-editor-ui.js");
  assert.match(source, /const EDITOR_LANGS = \["en", "de", "fr", "it", "nl", "pt", "ru", "el", "zh", "ro"\]/);
  assert.doesNotMatch(source, /const EDITOR_EXACT_OVERRIDES = \{/);
  assert.match(source, /const EDITOR_EXACT_OVERRIDE_ROWS = \[/);
  assert.match(source, /row\.key \? \[row\.key\] : \[\]/);
  ["es", "en", "de", "fr", "it", "nl", "pt", "ru", "el", "zh", "ro"].forEach(lang => {
    assert.match(source, new RegExp(`${lang}:`), `${lang} translations should be present in exact override rows`);
  });
  assert.match(source, /keys: \["Mode buttons next to slider"\][\s\S]*fr: "Boutons de mode à côté du curseur"/);
  assert.match(source, /keys: \["Use album art as background"\][\s\S]*pt: "Usar capa do álbum como fundo"/);
  assert.match(source, /keys: \["Main entity"\][\s\S]*zh: "主实体"/);
  assert.match(source, /keys: \["Entidad de luz"\][\s\S]*de: "Licht-Entität"/);
  assert.match(source, /keys: \["Posicion del estado", "Posición del estado"\][\s\S]*de: "Position des Status"/);
  assert.match(source, /keys: \["Fondo avatar", "Fondo icono", "Icono burbuja fondo", "Fondo burbuja principal"\][\s\S]*de: "Blasenhintergrund"/);
  assert.match(source, /keys: \["Maximo visible plegado"\][\s\S]*en: "Max visible when collapsed"/);
  assert.match(source, /keys: \["Name"\][\s\S]*zh: "名称"/);
  assert.match(source, /keys: \["Button bounce \(ms\)", "Rebote botones \(ms\)"\][\s\S]*de: "Button-Bounce \(ms\)"/);
  assert.match(source, /keys: \["Color aspirando"\][\s\S]*fr: "Couleur aspiration"/);
  assert.match(source, /keys: \["Color icono apagada"\][\s\S]*ro: "Culoare pictogramă oprită"/);
  assert.match(source, /const exactOverrideByEnglish = \{\}/);
  assert.match(source, /exactOverrideByEnglish\[englishValue\] \|\| exactOverrideByEnglish\[sourceKey\]/);
  assert.match(source, /keys: \["Brightness presets"\][\s\S]*de: "Helligkeits-Voreinstellungen"/);
  assert.match(source, /keys: \["Action", "Acción", "Accion"\][\s\S]*de: "Aktion"/);
  assert.match(source, /keys: \["Warning", "Aviso"\][\s\S]*zh: "警告"/);
  assert.match(source, /keys: \["Suction select", "Select aspirado"\][\s\S]*fr: "Select aspiration"/);
  assert.match(source, /keys: \["Select an entity", "Selecciona una entidad"\][\s\S]*de: "Entität auswählen"/);
  assert.match(source, /keys: \["Tap action", "Acción al pulsar", "Acción al tocar"\][\s\S]*de: "Tap-Aktion"/);
  assert.match(source, /keys: \["Off color", "Color apagado"\][\s\S]*fr: "Couleur éteinte"/);
});

test("editor field helpers route visible labels through shared i18n", () => {
  const light = read("nodalia-light-card.js");
  const humidifier = read("nodalia-humidifier-card.js");
  const powerFlow = read("nodalia-power-flow-card.js");

  assert.match(light, /_renderLightEntityField\(label, field, value, options = \{\}\) \{\n\s+const tLabel = this\._editorLabel\(label\)/);
  assert.match(light, /<span>\$\{escapeHtml\(tLabel\)\}<\/span>[\s\S]*data-mounted-control="light-entity"/);
  assert.match(humidifier, /_renderHumidifierEntityField\(label, field, value, options = \{\}\) \{\n\s+const tLabel = this\._editorLabel\(label\)/);
  assert.match(humidifier, /_renderSelectEntityField\(label, field, value, options = \{\}\) \{\n\s+const tLabel = this\._editorLabel\(label\)/);
  assert.match(powerFlow, /_renderRgbArrayColorField\(label, field, value, options = \{\}\) \{\n\s+const tLabel = this\._editorLabel\(label\)/);
});

test("active icon animations are configurable across animated device cards", () => {
  const fan = read("nodalia-fan-card.js");
  const humidifier = read("nodalia-humidifier-card.js");
  const weather = read("nodalia-weather-card.js");
  const advanceVacuum = read("nodalia-advance-vacuum-card.js");
  const vacuum = read("nodalia-vacuum-card.js");
  const editor = read("nodalia-editor-ui.js");

  [
    [fan, /fan-card__icon--active-motion/, /fan-card-icon-spin/],
    [humidifier, /humidifier-card__icon--active-motion/, /humidifier-card-icon-mist/],
    [weather, /weather-card__icon--rain-motion/, /getConditionIconMotionClass/],
    [vacuum, /vacuum-card__icon-button--active-motion/, /vacuum-card-icon-sweep/],
  ].forEach(([source, classPattern, keyframePattern]) => {
    assert.match(source, /icon_animation: true/);
    assert.match(source, /iconAnimation: configuredAnimations\.icon_animation !== false/);
    assert.match(source, classPattern);
    assert.match(source, keyframePattern);
    assert.match(source, /prefers-reduced-motion: reduce/);
    assert.match(source, /"Animar icono/);
  });
  assert.match(humidifier, /deviceClass === "dehumidifier"[\s\S]*this\._isOn\(state\) \? "mdi:air-humidifier" : "mdi:air-humidifier-off"/);
  assert.doesNotMatch(advanceVacuum, /class="advance-vacuum-card__control is-primary \$\{animations\.enabled && animations\.iconAnimation && this\._isCleaning\(state\)/);
  assert.match(vacuum, /error_entity: ""/);
  assert.match(vacuum, /_guessRelatedErrorEntity/);
  assert.match(vacuum, /translateVacuumErrorState/);
  assert.match(editor, /keys: \["Animar icono activo"\][\s\S]*en: "Animate active icon"/);
  assert.match(editor, /keys: \["Animar icono según condición"\][\s\S]*en: "Animate icon by condition"/);
});

test("notifications translate vacuum cleaning state in smart messages", () => {
  const source = read("nodalia-notifications-card.js");
  const i18n = read("nodalia-i18n.js");
  assert.match(source, /translateAdvanceVacuumReportedState/);
  assert.match(source, /state: stateLabel/);
  assert.match(i18n, /translateVacuumErrorState/);
  assert.match(i18n, /main_brush_jammed: "Cepillo principal bloqueado"/);
  assert.match(source, /vacuum_error_entities/);
  assert.match(source, /_getVacuumErrorState\(entityId\)/);
  assert.match(source, /media_player_entities/);
  assert.match(source, /_buildMediaPlayerPresenceNotifications\(add\)/);
  assert.match(source, /climate\.set_hvac_mode/);
  assert.match(source, /humidifier\.turn_on/);
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
  assert.match(source, /normalizeCustomNotifications\(value, options = \{\}\)/);
  assert.match(source, /keepDrafts && item\._draft === true \? true : hasContent && !isPlaceholder/);
  assert.match(source, /normalizeConfig\(this\._config, \{ keepDrafts: true \}\)/);
  assert.match(source, /const emitted = normalizeConfig\(next\)/);
  assert.match(source, /_draft: true/);
  assert.match(source, /smart_entity_overrides/);
  assert.match(source, /normalizeSmartEntityOverrides/);
  assert.match(source, /_renderSmartEntityOverrides\(config\)/);
  assert.match(source, /smart_entity_overrides\.\$\{index\}\.url/);
  assert.match(source, /smart_entity_overrides\.\$\{index\}\.mobile/);
  assert.match(source, /findIndex\(item => item\?\.entity === entity\)/);
  assert.doesNotMatch(source, /this\._config\.smart_entity_overrides\[index\]\.entity = entity/);
  assert.match(source, /mobilePolicy/);
  assert.match(source, /policy === "off"/);
  assert.match(source, /policy !== "on"/);
  assert.match(source, /_entranceAnimationTimer/);
  assert.match(source, /window\.setTimeout\(\(\) => \{\s*this\._entranceAnimationTimer = 0;\s*this\._animateContentOnNextRender = false;/);
  assert.doesNotMatch(source, /this\._animateContentOnNextRender = false;\s*this\._stackTransition = "";/);
  assert.match(source, /_renderCollapsedStackCards\(notifications, startIndex\)/);
  assert.match(source, /z-index: 6;/);
  assert.match(source, /const zIndex = 4 - clampedIndex;/);
  assert.match(source, /pointer-events: none;/);
  assert.match(source, /\.slice\(startIndex, startIndex \+ 4\)/);
  assert.match(source, /const offset = 7 \+ \(clampedIndex - 1\) \* 7/);
  assert.match(source, /top: var\(--stack-offset, 7px\)/);
  assert.match(source, /height: calc\(100% - 2px\)/);
  assert.doesNotMatch(source, /notifications-card--animated\.notifications-card--enter \.notification-stack-card\s*\{\s*animation: notifications-card-fade-up/);
  assert.match(source, /padding-bottom: \$\{shouldStack && !this\._expanded \? "12px" : "0"\}/);
  assert.match(source, /calendar_entities/);
  assert.match(source, /vacuum_entities/);
  assert.match(source, /vacuum_error_entities/);
  assert.match(source, /fan_entities/);
  assert.match(source, /climate_entities/);
  assert.match(source, /humidifier_entities/);
  assert.match(source, /media_player_entities/);
  assert.match(source, /weather_entities/);
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
  assert.match(source, /mobile_notifications\.critical_alerts/);
  assert.match(source, /callService\("notify", "send_message"/);
  assert.match(source, /_buildLegacyMobilePayload\(item, hash\)/);
  assert.match(source, /group:\s*"nodalia_notifications"/);
  assert.match(source, /channel:\s*"alarm_stream"/);
  assert.match(source, /critical:\s*1/);
  assert.match(source, /priority:\s*"high"/);
  assert.match(source, /this\._callNamedService\(service, legacyPayload\)/);
  assert.doesNotMatch(source, /data:\s*data\.data/);
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
  assert.match(source, /_notificationChips\(item\)/);
  assert.doesNotMatch(source, /chips\.push\(\{ kind: "value", label: source \}\)/);
  assert.match(source, /window\.open\(url, "_blank", "noopener,noreferrer"\)/);
  assert.match(source, /orientationchange/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /_attachViewVisibilityObserver/);
  assert.match(source, /_replayEntranceAnimation/);
  assert.match(source, /align-content: start/);
  assert.match(source, /_syncSharedDismissedFromHass/);
  assert.match(source, /_calendarDismissalsHydrated/);
  assert.match(source, /_weatherDismissalsHydrated/);
  assert.match(source, /_canPruneDismissedToken/);
  assert.match(source, /!text\.includes\(":"\)/);
  assert.match(source, /!this\._canPruneDismissedToken\(id\)/);
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
  assert.match(source, /_stackCardStyle/);
  assert.match(source, /--stack-accent/);
  assert.match(source, /--stack-inset/);
  assert.match(source, /--stack-offset/);
  assert.match(source, /top: var\(--stack-offset, 7px\)/);
  assert.match(source, /notification-item__chip/);
  assert.match(source, /notification-item__chips--top/);
  assert.match(source, /data-list-field/);
  assert.match(source, /tint_color/);
  assert.match(source, /animations\.enabled/);
  assert.match(source, /data-editor-toggle="animations"/);
  assert.match(source, /editor-section__toggle-button/);
  assert.match(source, /_editorLabel\(s\)/);
  assert.match(source, /this\._editorLabel\(label\)/);
  assert.match(source, /Conexiones inteligentes/);
  assert.match(source, /Sincronización y móvil/);
  assert.match(source, /Añadir notificación/);
  assert.match(source, /type="color"/);
  assert.match(source, /notifications-card--animated/);
  assert.match(source, /notifications-card--stack-\$\{stackTransition\}/);
  assert.match(source, /notifications-card-fade-up/);
  assert.match(source, /notifications-card-item-rise/);
  assert.match(source, /notifications-card-chip-pop/);
  assert.match(source, /notifications-card-bubble-bloom/);
  assert.match(source, /notifications-stack-reflow/);
  assert.match(source, /notifications-stack-collapse/);
  assert.match(source, /notifications-stack-tail-out/);
  assert.match(source, /notification-item--collapsing-tail/);
  assert.match(source, /collapse-final/);
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
  assert.match(source, /keepDrafts && item\._draft === true \? true : hasContent && !isPlaceholder/);
  assert.match(source, /id:\s*`custom:\$\{notificationHash/);
  assert.doesNotMatch(source, /id:\s*`custom:\$\{index\}:/);
  assert.match(source, /const coldest = \[\.\.\.tempSources\]\.sort/);
  assert.match(source, /fan\.turn_on/);
  assert.match(source, /calendars\/\$\{encodeURIComponent\(entityId\)\}/);
  assert.match(source, /editorFilteredStatesSignature/);
  assert.match(source, /sanitizeCssRuntimeValue/);
  assert.match(i18n, /notificationsCard/);
  assert.match(i18n, /NOTIFICATIONS_CARD_TRANSLATIONS/);
  assert.match(i18n, /de: \{\s*fallbackEvent: "Termin"/);
  assert.match(i18n, /fr: \{\s*fallbackEvent: "Événement"/);
  assert.match(i18n, /zh: \{\s*fallbackEvent: "事件"/);
  assert.match(i18n, /Borrar notificación/);
  const editorUi = read("nodalia-editor-ui.js");
  assert.match(editorUi, /es: "Mensaje cuando no hay nada pendiente y comportamiento básico\."/);
  assert.match(editorUi, /de: "Nachricht, wenn nichts ansteht, und Grundverhalten\."/);
  assert.match(editorUi, /es: "Borde tarjeta"/);
  assert.match(editorUi, /de: "Kartenrand"/);
  assert.match(editorUi, /es: "Move up"/);
  assert.match(editorUi, /de: "Nach oben"/);
  assert.match(editorUi, /es: "Permitir borrar eventos nativos"/);
  assert.match(editorUi, /de: "Löschen nativer Ereignisse erlauben"/);
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
