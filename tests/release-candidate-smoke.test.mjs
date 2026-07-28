import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function cardPartsFromBuildScript() {
  const source = read("scripts/build-bundle.mjs");
  const match = source.match(/const CARD_PARTS = \[([\s\S]*?)\];/);
  assert.ok(match, "build-bundle.mjs should declare CARD_PARTS");
  return [...match[1].matchAll(/"([^"]+\.js)"/g)].map(entry => entry[1]);
}

function compatibilityLoadersFromBuildScript() {
  const source = read("nodalia-cards.manifest.js");
  const match = source.match(/^export default ([\s\S]*?);\nexport const/m);
  assert.ok(match, "generated manifest should export its metadata object");
  return JSON.parse(match[1]).compatLoaderFiles;
}

function packagePatternIncludes(patterns, file) {
  return patterns.some(pattern => {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
    return new RegExp(`^${escaped}$`).test(file);
  });
}

function editorRowsFromGeneratedSource(source = read("nodalia-editor-ui.js")) {
  const languagesMatch = source.match(/const ROW_LANGS = (\[[^;]+\]);/);
  const rowsMatch = source.match(/const ROWS_JSON = ("(?:\\.|[^"\\])*");/);
  assert.ok(languagesMatch, "generated editor UI should declare ROW_LANGS");
  assert.ok(rowsMatch, "generated editor UI should declare ROWS_JSON");
  const languages = JSON.parse(languagesMatch[1]);
  const rows = JSON.parse(JSON.parse(rowsMatch[1]));
  return { languages, rows };
}

function editorRowBySpanish(rows, spanish) {
  const row = rows.find(values => values[0] === spanish);
  assert.ok(row, `generated editor UI should contain the Spanish row: ${spanish}`);
  return row;
}

test("bundle registers every card listed in build-bundle CARD_PARTS", () => {
  const bundle = read("nodalia-cards.js");
  const suite = read(`nodalia-cards-suite-${JSON.parse(read("package.json")).version}.js`);
  cardPartsFromBuildScript().forEach(file => {
    const cardTag = file.replace(/\.js$/, "");
    const escaped = cardTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(bundle, new RegExp(`"${escaped}"`), `${cardTag} should ship in nodalia-cards.js`);
    assert.match(suite, new RegExp(`"${escaped}"`), `${cardTag} should ship in split suite bundle`);
  });
});

test("bundle build validates card registrations before writing artifacts", () => {
  const build = read("scripts/build-bundle.mjs");
  assert.match(build, /assertCardRegistrations\(fullBody, "Full"\)/);
  assert.match(build, /assertCardRegistrations\(suiteBody, "Suite"\)/);
  assert.doesNotMatch(build, /Promise\.all\(\[\s*buildParts\(ALL_PARTS/);
});

test("compatibility aliases are unique lightweight loaders for the current version", () => {
  const pkg = JSON.parse(read("package.json"));
  const loaders = compatibilityLoadersFromBuildScript();
  const target = `nodalia-cards-${pkg.version}.js`;
  assert.equal(new Set(loaders).size, loaders.length);
  assert.ok(loaders.length <= 2, "only the two immediately previous compatibility loaders should remain");
  loaders.forEach(file => {
    const source = read(file);
    assert.ok(Buffer.byteLength(source) < 2048, `${file} should remain a lightweight loader`);
    assert.match(source, new RegExp(`import "\\./${target.replaceAll(".", "\\.")}"`));
  });
});

test("repository retains only current versioned artifacts and compatibility loaders", () => {
  const pkg = JSON.parse(read("package.json"));
  const compatibilityLoaders = compatibilityLoadersFromBuildScript();
  const versionedBundlePattern = /^nodalia-cards-(?:core-|suite-|editor-)?\d+(?:\.\d+){2,}(?:-(?:alpha|beta|rc)\.\d+)?\.js$/;
  const expected = [
    `nodalia-cards-${pkg.version}.js`,
    `nodalia-cards-core-${pkg.version}.js`,
    `nodalia-cards-suite-${pkg.version}.js`,
    `nodalia-cards-editor-${pkg.version}.js`,
    ...compatibilityLoaders,
  ].sort();
  const actual = fs.readdirSync(root).filter(file => versionedBundlePattern.test(file)).sort();

  assert.deepEqual(actual, expected);
});

test("menu card is not shipped in the bundle", () => {
  const build = read("scripts/build-bundle.mjs");
  const bundle = read("nodalia-cards.js");
  const suite = read(`nodalia-cards-suite-${JSON.parse(read("package.json")).version}.js`);
  assert.doesNotMatch(build, /nodalia-menu-card\.js/);
  assert.doesNotMatch(bundle, /nodalia-menu-card/);
  assert.doesNotMatch(suite, /nodalia-menu-card/);
});

test("published package files and bundle manifest stay coherent", () => {
  const pkg = JSON.parse(read("package.json"));
  const hacs = JSON.parse(read("hacs.json"));
  const manifest = read("nodalia-cards.manifest.js");
  const expectedHacsFile = "nodalia-cards.js";
  const expectedVersionedFile = `nodalia-cards-${pkg.version}.js`;
  const expectedCompatFiles = compatibilityLoadersFromBuildScript();

  assert.ok(manifest.includes(`"pkgVersion": "${pkg.version}"`));
  assert.ok(manifest.includes(`export const pkgVersion = "${pkg.version}";`));
  assert.ok(manifest.includes(`"hacsFile": "${expectedHacsFile}"`));
  assert.doesNotMatch(manifest, /contentSha256_12": ""/);
  assert.doesNotMatch(manifest, /export const contentSha256_12 = ""/);
  assert.equal(hacs.filename, expectedHacsFile);
  assert.ok(pkg.files.includes(expectedHacsFile), `${expectedHacsFile} should be published`);
  assert.ok(packagePatternIncludes(pkg.files, expectedVersionedFile), `${expectedVersionedFile} should be published`);
  expectedCompatFiles.forEach(file => {
    assert.ok(manifest.includes(`"${file}"`), `${file} should be listed as a compatibility loader`);
    assert.ok(packagePatternIncludes(pkg.files, file), `${file} should be published`);
    assert.ok(fs.existsSync(path.join(root, file)), `${file} should exist after bundle`);
  });

  const expectedCoreFile = `nodalia-cards-core-${pkg.version}.js`;
  const expectedSuiteFile = `nodalia-cards-suite-${pkg.version}.js`;
  const expectedEditorFile = `nodalia-cards-editor-${pkg.version}.js`;
  assert.ok(manifest.includes(`"splitCoreFile": "${expectedCoreFile}"`));
  assert.ok(manifest.includes(`"splitSuiteFile": "${expectedSuiteFile}"`));
  assert.ok(manifest.includes(`"editorFile": "${expectedEditorFile}"`));
  assert.ok(fs.existsSync(path.join(root, expectedCoreFile)), `${expectedCoreFile} should exist after bundle`);
  assert.ok(fs.existsSync(path.join(root, expectedSuiteFile)), `${expectedSuiteFile} should exist after bundle`);
  assert.ok(fs.existsSync(path.join(root, expectedEditorFile)), `${expectedEditorFile} should exist after bundle`);

  pkg.files.forEach(pattern => {
    const matches = fs.readdirSync(root).filter(file => packagePatternIncludes([pattern], file));
    assert.ok(matches.length || fs.existsSync(path.join(root, pattern)), `${pattern} should match a published file or directory`);
  });
  assert.ok(!pkg.files.includes("nodalia-calendar-completion-codec.js"));
});

test("HACS runtime is self-contained while the explicit split build keeps the editor lazy", () => {
  const pkg = JSON.parse(read("package.json"));
  const runtimeFile = path.join(root, "nodalia-cards.js");
  const suiteFile = path.join(root, `nodalia-cards-suite-${pkg.version}.js`);
  const editorName = `nodalia-cards-editor-${pkg.version}.js`;
  const editorFile = path.join(root, editorName);
  const runtime = fs.readFileSync(runtimeFile, "utf8");
  const suite = fs.readFileSync(suiteFile, "utf8");

  assert.ok(fs.statSync(runtimeFile).size < 4 * 1024 * 1024, "self-contained HACS bundle should stay below 4 MiB");
  assert.ok(fs.statSync(editorFile).size < 900 * 1024, "lazy editor bundle should stay below 900 KiB");
  assert.ok(gzipSync(runtime).length < 950 * 1024, "self-contained HACS bundle should stay below 950 KiB gzip");
  assert.ok(gzipSync(fs.readFileSync(editorFile)).length < 225 * 1024, "lazy editor bundle should stay below 225 KiB gzip");
  assert.match(runtime, /\.editorStr=function/);
  assert.match(runtime, /window\.NodaliaEditorUI=window\.__NODALIA_EDITOR__/);
  assert.doesNotMatch(runtime, new RegExp(`import\\(\"\\./${editorName.replaceAll(".", "\\.")}\"\\)`));
  assert.doesNotMatch(runtime, /ensureEditorRuntime/);
  assert.match(suite, new RegExp(`import\\(\"\\./${editorName.replaceAll(".", "\\.")}\"\\)`));
  assert.match(suite, /ensureEditorRuntime/);
  assert.doesNotMatch(suite, /\.editorStr=function/);
});

test("card sources use nodalia-utils.js instead of inlined duplicate helpers", () => {
  const cards = [
    "nodalia-navigation-bar.js",
    "nodalia-media-player.js",
    "nodalia-light-card.js",
    "nodalia-fan-card.js",
    "nodalia-humidifier-card.js",
    "nodalia-circular-gauge-card.js",
    "nodalia-graph-card.js",
    "nodalia-power-flow-card.js",
    "nodalia-cover-card.js",
    "nodalia-climate-card.js",
    "nodalia-alarm-panel-card.js",
    "nodalia-advance-vacuum-card.js",
    "nodalia-entity-card.js",
    "nodalia-fav-card.js",
    "nodalia-insignia-card.js",
    "nodalia-person-card.js",
    "nodalia-scenes-card.js",
    "nodalia-weather-card.js",
    "nodalia-notifications-card.js",
    "nodalia-vacuum-card.js",
    "nodalia-news-card.js",
    "nodalia-camera-card.js",
  ];
  const utils = read("nodalia-utils.js");
  assert.match(utils, /function escapeLovelaceWarningText\(/);
  assert.match(utils, /function scheduleCardZoneTap\(/);
  for (const file of cards) {
    const source = read(file);
    assert.doesNotMatch(source, /\/\/ <nodalia-standalone-utils>/, `${file} should not embed utils`);
    assert.doesNotMatch(source, /function escapeLovelaceWarningText\(/, `${file} should not duplicate utils`);
    assert.doesNotMatch(source, /\(function initNodaliaUtils\(\)/, `${file} should not duplicate utils IIFE`);
  }
  const build = read("scripts/build-bundle.mjs");
  assert.match(build, /nodalia-utils\.js/);
});

test("README keeps a single support badge without legacy donation sections", () => {
  const readme = read("README.md");
  const coffeeMatches = readme.match(/buymeacoffee\.com\/danielmigueltejedor/g) || [];
  assert.equal(coffeeMatches.length, 1);
  assert.match(readme, /img\.shields\.io\/badge\/Support%20the%20project-Buy%20Me%20a%20Coffee-/);
  assert.doesNotMatch(readme, /paypal/i);
  assert.doesNotMatch(readme, /## 💰 Donations/);
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

test("editor entity signatures sort ids before formatting rows", () => {
  const source = read("nodalia-utils.js");
  assert.match(source, /const ids = \[\];/);
  assert.match(source, /ids\.sort\(\);/);
  assert.match(source, /const rows = new Array\(ids\.length\);/);
  assert.doesNotMatch(source, /rows\.sort\(\(left, right\)/);
  assert.doesNotMatch(source, /\.split\(":\"\)\[0\]/);
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
  assert.ok(source.includes("\\burl\\s*\\("));
  assert.ok(source.includes("\\b@import\\b"));
});

test("navigation media player status chip stays in title flow", () => {
  const source = read("nodalia-navigation-bar.js");
  assert.match(source, /<div class="media-player__title-row">[\s\S]*<div class="media-player__title">\$\{escapeHtml\(title\)\}<\/div>[\s\S]*\$\{statusMarkup\}/);
  assert.match(source, /\.media-player__title-row \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(source, /\.media-player__status-wrap \{[\s\S]*min-width: 0;/);
  assert.doesNotMatch(source, /\.media-player__status-wrap \{[^}]*position: absolute;/);
});

test("light card default on icon color follows current light tint with contrast", () => {
  const source = read("nodalia-light-card.js");
  assert.match(source, /const lightIconColor = isOn[\s\S]*color-mix\(in srgb, \$\{accentColor\} \$\{darkenBubbleIconGlyph \? 42 : 72\}%, var\(--primary-text-color\)\)/);
  assert.match(source, /const configuredOnIconColor = String\(styles\?\.icon\?\.on_color \?\? ""\)\.trim\(\)/);
  assert.match(source, /: styles\?\.icon\?\.off_color/);
  assert.match(source, /\.light-card__icon ha-icon \{[\s\S]*color: \$\{lightIconColor\};/);
});

test("calendar runtime css sanitizer and webhook admin guard are present", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /function sanitizeCssRuntimeValue\(value\)/);
  assert.ok(source.includes("\\burl\\s*\\("));
  assert.ok(source.includes("\\b@import\\b"));
  assert.match(source, /security\.allow_webhooks_for_non_admin/);
  assert.match(source, /webhookBlockedNonAdmin|webhook blocked for non-admin user/);
  assert.match(source, /window\.NodaliaUtils\.setByPath\(targetConfig, field, value\)/);
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
  assert.match(source, /String\(date\.getMonth\(\) \+ 1\)\.padStart\(2, "0"\)/);
  assert.match(source, /const rowKey = forecastDayKey\(k\)/);
  assert.match(source, /const rowMonth = km - 1/);
  assert.match(source, /if \(targetTs < todayTs\) \{[\s\S]*return null;[\s\S]*\}/);
  assert.match(source, /if \(ky !== y \|\| rowMonth !== m\) \{[\s\S]*continue;[\s\S]*\}/);
});

test("calendar expanded popup reuses daily weather badges", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /_renderWeatherBadge\(dayDate, weatherByDay/);
  assert.match(source, /this\._renderExpandedBody\(groups, config, locale, weatherByDay\)/);
  assert.match(source, /_expandedRangeGroups\(groups, config, locale\)/);
  assert.match(source, /dayDate: existing\.dayDate instanceof Date && !Number\.isNaN\(existing\.dayDate\.getTime\(\)\)/);
  assert.match(source, /const displayGroups = this\._expandedRangeGroups\(groups, config, locale\)/);
  assert.match(source, /<div class="calendar-expanded__body">[\s\S]*this\._error[\s\S]*: this\._renderExpandedBody\(groups, config, locale, weatherByDay\)/);
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
  assert.match(source, /The date cannot be before today\./);
  assert.match(source, /Select a calendar\./);
  assert.match(source, /Enter a title\./);
  assert.match(source, /calendar-composer__error/);
});

test("calendar native composer supports rich HA event fields and details", () => {
  const source = read("nodalia-calendar-card.js");
  const example = read("examples/calendar-native-event-webhook.yaml");
  assert.match(source, /data-native-field="description"/);
  assert.match(source, /data-native-field="location"/);
  assert.match(source, /data-native-field="repeatKind"/);
  assert.match(source, /data-native-field="repeatCustomUnit"/);
  assert.match(source, /data-native-field="repeatCustomInterval"/);
  assert.match(source, /data-native-field-group="repeatCustom" hidden/);
  assert.match(source, /\.calendar-composer__row\[hidden\][\s\S]*display: none !important/);
  assert.match(source, /value="custom">\$\{escapeHtml\(this\._uiText\("repeat\.custom", "Custom"\)\)\}/);
  assert.match(source, /INTERVAL=\$\{customInterval\}/);
  assert.match(source, /dtstart:/);
  assert.match(source, /dtend:/);
  assert.match(source, /_formatRruleDisplayLabel\(rruleRaw\)/);
  assert.match(source, /const repeatLabel = this\._formatRruleDisplayLabel\(rrule\)/);
  assert.doesNotMatch(source, /calendar-expanded__event-section-body">\$\{escapeHtml\(rrule\)\}/);
  assert.match(source, /data-native-field="color"/);
  assert.match(source, /calendar-composer \.editor-color-picker/);
  assert.match(source, /_mountNativeColorControl\(\)/);
  assert.match(source, /value="none">\$\{escapeHtml\(this\._uiText\("repeat\.none", "Does not repeat"\)\)\}/);
  assert.match(source, /value="yearly">\$\{escapeHtml\(this\._uiText\("repeat\.yearly", "Yearly"\)\)\}/);
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
  assert.match(source, /translateCalendarUi/);
  assert.match(source, /_uiText\("allDay", "All day"\)/);
  assert.doesNotMatch(source, /Todo el dia/);
  assert.match(i18n, /function translateCalendarUi/);
  assert.match(i18n, /calendarCard/);
  assert.match(i18n, /allDay: "Ganztägig"/);
  assert.match(i18n, /fields:\s*\{[\s\S]*?calendar:\s*"Kalender"[\s\S]*?title:\s*"Titel"/);
  assert.match(i18n, /buttons:\s*\{[\s\S]*?month:\s*"Mois"[\s\S]*?create:\s*"Créer"/);
  assert.match(i18n, /repeat:\s*\{[\s\S]*?none:\s*"不重复"[\s\S]*?custom:\s*"自定义"/);
  assert.match(i18n, /repeatFrequency:\s*"Frequency"/);
  assert.match(i18n, /selectRepeatFrequency:\s*"Select a frequency for custom repeat\."/);
  assert.match(i18n, /createEventWithMessage:\s*"Nu s-a putut crea evenimentul: \{message\}"/);
  assert.match(i18n, /allDay:\s*"Toute la journée"/);
  assert.match(i18n, /allDay:\s*"全天"/);
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
  assert.match(source, /_renderForecastChart\(visibleItems, activeType, state, forecastLocale(?:, unitPrefs)?\)/);
  assert.match(source, /formatForecastDateTime\(item\?\.datetime, activeType, forecastLocale\)/);
});

test("weather forecast popups use an opaque theme-safe surface", () => {
  const source = read("nodalia-weather-card.js");
  assert.match(source, /--weather-card-popover-surface:/);
  assert.match(source, /\.weather-card__forecast-chart \{[\s\S]*?isolation: isolate;/);
  assert.match(source, /\.weather-card__forecast-popup \{[\s\S]*?background-color: var\(--weather-card-popover-surface\);/);
  assert.match(source, /\.weather-card__forecast-popup \{[\s\S]*?var\(--weather-card-popover-surface\);[\s\S]*?isolation: isolate;/);
  assert.match(source, /\.weather-card__forecast-hover-preview \{[\s\S]*?background-color: var\(--weather-card-popover-surface\);/);
  assert.match(source, /\.weather-card__forecast-hover-preview \{[\s\S]*?var\(--weather-card-popover-surface\);[\s\S]*?isolation: isolate;/);
});

test("weather forecast condition icons use a contrast-safe color", () => {
  const source = read("nodalia-weather-card.js");
  assert.match(source, /function getConditionReadableIconColor\(value, accentColor = getConditionAccent\(value\)\)/);
  assert.match(source, /const key = normalizeTextKey\(value \|\| ""\)/);
  assert.match(source, /color-mix\(in srgb, \$\{accentColor\} \$\{accentWeight\}%, var\(--primary-text-color\)\)/);
  assert.match(source, /function getMetricReadableIconColor\(accentColor\)/);
  assert.match(source, /--chip-icon-color:\$\{escapeHtml\(iconColor\)\}/);
  assert.match(source, /this\._renderChip\("mdi:water-percent", this\._formatHumidity\(state\), "#59aef9"\)/);
  assert.match(source, /this\._renderChip\("mdi:weather-windy", this\._formatWind\(state\), "#7dd7d0"\)/);
  assert.match(source, /\.weather-card__chip ha-icon \{[\s\S]*?color: var\(--chip-icon-color, var\(--chip-accent\)\);/);
  assert.match(source, /const configuredIconColor = String\(styles\?\.icon\?\.color \|\| ""\)\.trim\(\)/);
  assert.match(source, /const conditionIconColor = configuredIconColor && configuredIconColor !== defaultIconColor/);
  assert.match(source, /color: \$\{conditionIconColor\};/);
  assert.match(source, /getForecastIconColor\(accent, conditionValue\)/);
  assert.match(source, /--forecast-icon-color:\$\{escapeHtml\(iconColor\)\}/);
  assert.match(source, /\.weather-card__forecast-popup-main ha-icon \{[\s\S]*?color: var\(--forecast-icon-color, var\(--forecast-accent\)\);/);
  assert.match(source, /\.weather-card__forecast-hover-preview ha-icon \{[\s\S]*?color: var\(--forecast-icon-color, var\(--forecast-accent\)\);/);
  assert.match(source, /\.weather-card__forecast-item > ha-icon \{[\s\S]*?color: var\(--forecast-icon-color, var\(--forecast-accent\)\);/);
  assert.match(source, /\.weather-card__forecast-rain ha-icon \{[\s\S]*?color: var\(--forecast-icon-color, var\(--forecast-accent\)\);/);
});

test("graph unavailable badge keeps help icon centered and dark", () => {
  const source = read("nodalia-graph-card.js");
  assert.match(source, /\.graph-card__unavailable-badge \{[\s\S]*?color: #1f2330;/);
  assert.match(source, /\.graph-card__unavailable-badge \{[\s\S]*?display: inline-flex;[\s\S]*?justify-content: center;/);
  assert.match(source, /\.graph-card__unavailable-badge ha-icon \{[\s\S]*?position: static;/);
  assert.match(source, /\.graph-card__unavailable-badge ha-icon \{[\s\S]*?transform: none;/);
});

test("graph mobile legend chips avoid clipped active shadows", () => {
  const source = read("nodalia-graph-card.js");
  assert.match(source, /@media \(max-width: 640px\) \{[\s\S]*?\.graph-card__primary-row \.graph-card__legend \{[\s\S]*?overflow-x: auto;/);
  assert.match(source, /@media \(max-width: 640px\) \{[\s\S]*?\.graph-card__primary-row \.graph-card__legend \{[\s\S]*?padding-block: 6px;/);
  assert.match(source, /@media \(max-width: 640px\) \{[\s\S]*?\.graph-card__primary-row \.graph-card__legend-item--active \{[\s\S]*?box-shadow:\s*[\s\S]*?inset 0 1px 0/);
});

test("Norwegian language aliases resolve to official no locale", () => {
  const source = read("nodalia-i18n.js");
  assert.match(source, /const alias = \{ nb: "no", nn: "no" \}\[two\]/);
  assert.match(source, /no: "nb-NO"/);
  assert.match(source, /no:\s*\{[\s\S]*vacuumErrorLabels:/);
});

test("shared visual editor ROWS map covers all supported editor languages", () => {
  const source = read("nodalia-editor-ui.js");
  const { languages, rows } = editorRowsFromGeneratedSource(source);
  assert.match(source, /const EDITOR_LANGS = \["en", "de", "fr", "it", "nl", "no", "pt", "ru", "el", "zh", "ro"\]/);
  assert.match(source, /const ROWS_JSON = /);
  assert.match(source, /function getEditorUiMaps\(\)/);
  assert.doesNotMatch(source, /const EDITOR_EXACT_OVERRIDES = \{/);
  assert.doesNotMatch(source, /const EDITOR_EXACT_OVERRIDE_ROWS = \[/);
  assert.match(source, /window\.NodaliaI18n\.editorUiMaps = map/);
  assert.match(source, /window\.NodaliaI18n\.editorStr = function editorStr/);
  assert.deepEqual(languages, ["es", "en", "de", "fr", "it", "nl", "no", "pt", "ru", "el", "zh", "ro"]);
  assert.ok(rows.length > 0);
  rows.forEach(row => assert.equal(row.length, languages.length));
  assert.equal(editorRowBySpanish(rows, "Activar animaciones")[2], "Animationen aktivieren");
  assert.equal(editorRowBySpanish(rows, "Alto chip")[2], "Chip-Höhe");
  assert.equal(editorRowBySpanish(rows, "Mostrar ausente")[2], "„Abwesend“ anzeigen");
  assert.equal(editorRowBySpanish(rows, "Fijar a pantalla")[2], "Am Bildschirm fixieren");
  assert.equal(editorRowBySpanish(rows, "Entidad principal")[10], "主实体");
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
    assert.match(
      source,
      /"(?:Animar icono|ed\.weather\.icon_animation_condition|ed\.vacuum\.icon_animation_active)/,
    );
  });
  assert.match(humidifier, /deviceClass === "dehumidifier"[\s\S]*this\._isOn\(state\) \? "mdi:air-humidifier" : "mdi:air-humidifier-off"/);
  assert.doesNotMatch(advanceVacuum, /class="advance-vacuum-card__control is-primary \$\{animations\.enabled && animations\.iconAnimation && this\._isCleaning\(state\)/);
  assert.match(vacuum, /error_entity: ""/);
  assert.match(vacuum, /_guessRelatedErrorEntity/);
  assert.match(vacuum, /translateVacuumErrorState/);
});

test("light card runtime preset labels use i18n", () => {
  const light = read("nodalia-light-card.js");
  const i18n = read("nodalia-i18n.js");

  assert.match(light, /_lightCardUi\(path, fallback = "", values = \{\}\)/);
  assert.match(light, /temperaturePresets\.warm/);
  assert.match(light, /temperaturePresets\.neutral/);
  assert.match(light, /temperaturePresets\.cool/);
  assert.doesNotMatch(light, /\{ label: "Warm", kelvin: range\.min \}/);
  assert.match(i18n, /function translateLightUi\(hass, configLang, path, fallback = "", values = \{\}\)/);
  assert.match(i18n, /lightCard:\s*\{[\s\S]*?temperaturePresets:\s*\{[\s\S]*?warm:\s*"Warm"/);
  assert.match(i18n, /lightCard:\s*\{[\s\S]*?temperaturePresets:\s*\{[\s\S]*?warm:\s*"Cálida"/);
});

test("notifications translate vacuum cleaning state in smart messages", () => {
  const source = read("nodalia-notifications-card.js");
  const i18n = read("nodalia-i18n.js");
  assert.match(source, /translateAdvanceVacuumReportedState/);
  assert.match(source, /state: stateLabel/);
  assert.doesNotMatch(source, /state: state\.state/);
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
  const pkg = JSON.parse(read("package.json"));
  const readme = read("README.md");
  const bundle = read(`nodalia-cards-${pkg.version}.js`);
  assert.match(source, /const CARD_TAG = "nodalia-climate-card"/);
  assert.match(source, /customElements\.define\(CARD_TAG, NodaliaClimateCard\)/);
  assert.match(build, /nodalia-climate-card\.js/);
  assert.ok(pkg.files.includes("nodalia-climate-card.js"), "nodalia-climate-card.js should be published");
  assert.match(readme, /custom:nodalia-climate-card/);
  assert.match(source, /"show_schedule_button", config\.show_schedule_button/);
  assert.match(source, /"setpoint_schedule_webhook", config\.setpoint_schedule_webhook/);
  assert.match(bundle, /show_schedule_button/);
  assert.match(bundle, /setpoint_schedule_webhook/);
  assert.match(source, /climate-schedule-expanded/);
  assert.match(source, /position:\s*fixed/);
  assert.match(source, /setpoint_schedule_week_starts_on/);
});

test("scenes card is registered and shipped in the HACS bundle", () => {
  const source = read("nodalia-scenes-card.js");
  const build = read("scripts/build-bundle.mjs");
  const sync = read("scripts/sync-standalone-embed.mjs");
  const pkg = JSON.parse(read("package.json"));
  const readme = read("README.md");
  const bundle = read(`nodalia-cards-${pkg.version}.js`);
  assert.match(source, /const CARD_TAG = "nodalia-scenes-card"/);
  assert.match(source, /customElements\.define\(CARD_TAG, NodaliaScenesCard\)/);
  assert.match(source, /callService\("scene", "turn_on"/);
  assert.match(source, /_triggerLaunchAnimation/);
  assert.match(build, /nodalia-scenes-card\.js/);
  assert.match(sync, /nodalia-scenes-card\.js/);
  assert.ok(pkg.files.includes("nodalia-scenes-card.js"), "nodalia-scenes-card.js should be published");
  assert.match(readme, /custom:nodalia-scenes-card/);
  assert.match(bundle, /callService\("scene","turn_on"/);
});

test("news card is registered and shipped in the HACS bundle", () => {
  const source = read("nodalia-news-card.js");
  const build = read("scripts/build-bundle.mjs");
  const pkg = JSON.parse(read("package.json"));
  const bundle = read(`nodalia-cards-${pkg.version}.js`);
  assert.match(source, /const CARD_TAG = "nodalia-news-card"/);
  assert.match(source, /customElements\.define\(CARD_TAG, NodaliaNewsCard\)/);
  assert.match(source, /registerCustomCard\?\.\(\{/);
  assert.match(source, /function isSafeHttpUrl\(/);
  assert.match(build, /nodalia-news-card\.js/);
  assert.ok(pkg.files.includes("nodalia-news-card.js"), "nodalia-news-card.js should be published");
  assert.match(bundle, /nodalia-news-card/);
});

test("camera card is registered and shipped in the HACS bundle", () => {
  const source = read("nodalia-camera-card.js");
  const build = read("scripts/build-bundle.mjs");
  const pkg = JSON.parse(read("package.json"));
  const readme = read("README.md");
  const bundle = read(`nodalia-cards-${pkg.version}.js`);
  assert.match(source, /const CARD_TAG = "nodalia-camera-card"/);
  assert.match(source, /customElements\.define\(CARD_TAG, NodaliaCameraCard\)/);
  assert.match(source, /camera_proxy/);
  assert.match(source, /camera-card__expanded/);
  assert.match(build, /nodalia-camera-card\.js/);
  assert.ok(pkg.files.includes("nodalia-camera-card.js"), "nodalia-camera-card.js should be published");
  assert.match(readme, /custom:nodalia-camera-card/);
  assert.match(bundle, /nodalia-camera-card/);
});

test("cover card is registered and shipped in the HACS bundle", () => {
  const source = read("nodalia-cover-card.js");
  const build = read("scripts/build-bundle.mjs");
  const sync = read("scripts/sync-standalone-embed.mjs");
  const pkg = read("package.json");
  const readme = read("README.md");
  assert.match(source, /const CARD_TAG = "nodalia-cover-card"/);
  assert.match(source, /set_cover_position/);
  assert.match(source, /set_cover_tilt_position/);
  assert.match(source, /customElements\.define\(CARD_TAG, NodaliaCoverCard\)/);
  assert.match(build, /nodalia-cover-card\.js/);
  assert.match(sync, /nodalia-cover-card\.js/);
  assert.match(pkg, /"nodalia-cover-card\.js"/);
  assert.match(readme, /custom:nodalia-cover-card/);
});

test("power flow supports grid feed-in export sensors", () => {
  const source = read("nodalia-power-flow-card.js");
  assert.match(source, /export_entity/);
  assert.match(source, /export_color/);
  assert.match(source, /export_when_negative/);
  assert.match(source, /_resolveGridExportSource/);
  assert.match(source, /value: -Math\.abs\(magnitude\)/);
});

test("notifications card is bundled and supports smart dismissible notifications", () => {
  const source = read("nodalia-notifications-card.js");
  const mobilePolicy = read("nodalia-notifications-mobile-policy.js");
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
  assert.match(source, /smart_entity_overrides\.\$\{index\}\.tap_action/);
  assert.match(source, /smart_entity_overrides\.\$\{index\}\.mobile/);
  assert.match(source, /smart_notifications\.\$\{key\}\.mobile/);
  assert.match(source, /custom_notifications\.\$\{index\}\.mobile/);
  assert.match(source, /mobilePolicy: item\.mobile \|\| "auto"/);
  assert.match(source, /_smartMobilePolicyForKind\(group\.kind, entityId\)/);
  assert.match(source, /smart: Object\.fromEntries/);
  assert.match(source, /findIndex\(item => item\?\.entity === entity\)/);
  assert.doesNotMatch(source, /this\._config\.smart_entity_overrides\[index\]\.entity = entity/);
  assert.match(source, /mobileDeliveryState/);
  assert.match(source, /deliveryState !== "allowed"/);
  assert.match(mobilePolicy, /effectivePolicy === "off"/);
  assert.match(source, /_entranceAnimationTimer/);
  assert.match(source, /const animateEntrance = animations\.enabled && this\._animateContentOnNextRender/);
  assert.match(source, /_scheduleEntranceAnimationReset\(animations\.contentDuration \+ 120\)/);
  assert.match(
    source,
    /this\._entranceAnimationTimer = window\.setTimeout\(\(\) => \{\s*this\._entranceAnimationTimer = 0;\s*if \(!this\.isConnected\) \{\s*return;\s*\}\s*this\._animateContentOnNextRender = false;/,
  );
  assert.doesNotMatch(source, /this\._animateContentOnNextRender = false;\s*this\._stackTransition = "";/);
  assert.match(source, /_renderCollapsedStackCards\(notifications, startIndex\)/);
  assert.match(source, /z-index: 6;/);
  assert.match(source, /const zIndex = 4 - clampedIndex;/);
  assert.match(source, /pointer-events: none;/);
  assert.match(source, /\.slice\(startIndex, startIndex \+ 4\)/);
  assert.match(source, /const stackPeek = 9/);
  assert.match(source, /const firstLayerPeekCorrection = clampedIndex === 1 \? 1 : 0/);
  assert.match(source, /const offset = clampedIndex \* stackPeek \+ firstLayerPeekCorrection/);
  assert.match(source, /top: var\(--stack-offset, 7px\)/);
  assert.match(source, /height: calc\(100% - 2px\)/);
  assert.match(source, /const collapsedStackReserve = collapsedStackDepth \? 4 \+ collapsedStackDepth \* 5 : 0/);
  assert.match(source, /<div class="notifications-list">\s*\$\{\s*shouldStack && !this\._expanded\s*\? this\._renderCollapsedStackCards\(notifications, config\.max_visible\)/);
  assert.doesNotMatch(source, /notifications-card--animated\.notifications-card--enter \.notification-stack-card\s*\{\s*animation: notifications-card-fade-up/);
  assert.match(source, /padding-bottom: var\(--notifications-stack-reserve, 0px\)/);
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
  assert.match(source, /outdoor_temperature_entities/);
  assert.match(source, /outdoor_humidity_entities/);
  assert.match(source, /ed\.notifications\.entity_outdoor_temperature/);
  assert.match(source, /ed\.notifications\.entity_outdoor_humidity/);
  assert.match(source, /battery_entities/);
  assert.match(source, /humidifier_fill_entities/);
  assert.match(source, /humidifier_full_entities/);
  assert.match(source, /ink_entities/);
  assert.match(source, /smart_notifications/);
  assert.match(source, /smart_notifications\.\$\{key\}\.tap_action/);
  assert.match(source, /custom_notifications\.\$\{index\}\.tap_action/);
  assert.match(source, /_customNotificationTemplateValues\(item\)/);
  assert.match(source, /title: this\._formatTemplate\(item\.title, templateValues\)/);
  assert.match(source, /message: this\._formatTemplate\(item\.message, templateValues\)/);
  assert.match(source, /action_label: this\._formatTemplate\(item\.action_label, templateValues\)/);
  assert.match(source, /url: this\._formatTemplate\(item\.url, templateValues\)/);
  assert.match(source, /referencedNotificationTemplateEntities/);
  assert.match(source, /normalizeNotificationTapAction/);
  assert.match(source, /hasNotificationTapAction/);
  assert.match(source, /_buildNativeNotificationAction/);
  assert.match(source, /battery_low/);
  assert.match(source, /humidifier_fill_low/);
  assert.match(source, /humidifier_fill_full/);
  assert.match(source, /ink_low/);
  assert.match(source, /dismissed_entity/);
  assert.match(source, /mobile_notifications/);
  assert.match(source, /mobile_notifications\.entities/);
  assert.match(source, /mobile_notifications\.critical_alerts/);
  assert.match(source, /mobile_notifications\.min_severity/);
  assert.match(source, /ed\.notifications\.mobile_severity_all_info/);
  assert.match(source, /background_mobile/);
  assert.match(source, /background_mobile\.enabled/);
  assert.match(source, /background_mobile\.webhook/);
  assert.match(source, /ed\.notifications\.background_mobile_webhook/);
  assert.match(source, /entities: config\.mobile_notifications\?\.entities \|\| \[\]/);
  assert.match(source, /mobile: normalizeMobilePolicy\(item\?\.mobile\)/);
  assert.match(source, /nodalia_notifications_background_sync/);
  assert.match(source, /_scheduleBackgroundMobileSync/);
  assert.match(source, /_pendingBackgroundMobileSync/);
  assert.match(source, /_forceNextBackgroundMobileSync/);
  assert.match(source, /_scheduleBackgroundMobileSyncFromEditor/);
  assert.match(source, /_syncBackgroundMobileConfigFromEditor/);
  assert.match(source, /buildBackgroundMobileWebhookPayload\(normalized\)/);
  assert.match(source, /await post\(webhookId, payload, this\._hass\)/);
  assert.match(source, /callService\("notify", "send_message"/);
  assert.match(source, /_buildLegacyMobilePayload\(item, hash\)/);
  assert.match(source, /group:\s*"nodalia_notifications"/);
  assert.match(source, /channel:\s*"alarm_stream"/);
  assert.match(source, /critical:\s*1/);
  assert.match(source, /priority:\s*"high"/);
  assert.match(source, /this\._callInternalService\(service, legacyPayload\)/);
  assert.doesNotMatch(source, /data:\s*data\.data/);
  assert.match(source, /data-editor-toggle="connections"/);
  assert.match(source, /type: "calendar-popup"/);
  assert.match(source, /nodalia-calendar-card-open/);
  assert.match(source, /weather\/get_forecasts/);
  assert.match(source, /rain_probability/);
  assert.match(source, /rain_lookahead_hours/);
  assert.match(source, /function entityAreaKey/);
  assert.match(source, /_getFanTargetForSource/);
  assert.match(source, /_getPresenceSensorForSource\(sourceEntityId\)/);
  assert.match(source, /_presenceAllowsComfortNotification\(sourceEntityId\)/);
  assert.match(source, /\.filter\(item => this\._presenceAllowsComfortNotification\(item\.entityId\)\)/);
  assert.doesNotMatch(source, /\.\.\.this\._config\.weather_entities\.map\(entityId => \(\{[\s\S]*?numericState\(this\._hass\.states\?\.\[entityId\], "temperature"\)/);
  assert.match(source, /_buildWeatherNotifications/);
  assert.match(source, /_buildLevelNotifications/);
  assert.match(source, /shouldDarkenNotificationIconGlyph/);
  assert.match(source, /_smartMessage/);
  assert.match(source, /_smartAction/);
  assert.match(source, /_notificationChips\(item\)/);
  assert.doesNotMatch(source, /chips\.push\(\{ kind: "value", label: source \}\)/);
  assert.match(source, /action\.type === "navigate"/);
  assert.match(source, /window\.history\.pushState\(null, "", path\)/);
  assert.match(source, /allowHash: true/);
  assert.match(source, /window\.open\(url, "_blank", "noopener,noreferrer"\)/);
  assert.match(source, /orientationchange/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /_attachViewVisibilityObserver/);
  assert.match(source, /_replayEntranceAnimation/);
  assert.match(source, /_wasHiddenByLayout/);
  assert.match(source, /align-content: start/);
  assert.match(source, /_syncSharedDismissedFromHass/);
  assert.match(source, /_calendarDismissalsHydrated/);
  assert.match(source, /_weatherDismissalsHydrated/);
  assert.match(source, /_canPruneDismissedToken/);
  assert.match(source, /!text\.includes\(":"\)/);
  assert.match(source, /!this\._canPruneDismissedToken\(id\)/);
  assert.match(source, /_queueMobileNotifications/);
  assert.match(source, /_backgroundMobileSuppressesForeground\(\)/);
  assert.match(source, /_lastBackgroundMobileSyncSignature/);
  assert.match(source, /this\._mobileSent\.has\(hash\) \|\| this\._isDismissed\(item\)/);
  assert.match(source, /notify\./);
  const backgroundPackage = read("examples/notifications-background-mobile-package.yaml");
  assert.match(backgroundPackage, /webhook_id: nodalia_notifications_background_sync/);
  assert.match(backgroundPackage, /id: nodalia_notifications_background_state_filter/);
  assert.match(backgroundPackage, /event_type: state_changed/);
  assert.match(backgroundPackage, /event: nodalia_notifications_background_watched_state_changed/);
  assert.match(backgroundPackage, /id: nodalia_notifications_background_state_push/);
  assert.match(backgroundPackage, /event_type: nodalia_notifications_background_watched_state_changed/);
  assert.match(backgroundPackage, /smart_cfg: "\{\{ cfg\.get\('smart', \{\}\) \}\}"/);
  assert.match(backgroundPackage, /smart_override: "\{\{ smart_cfg\.get\(match_kind, \{\}\) if match_kind != '' else \{\} \}\}"/);
  assert.match(backgroundPackage, /smart_mobile: "\{\{ smart_override\.get\('mobile', default_policy\) \}\}"/);
  assert.match(backgroundPackage, /effective_policy/);
  assert.match(backgroundPackage, /context_cfg/);
  assert.match(backgroundPackage, /effective_policy not in \['off', 'card_only'\]/);
  assert.match(backgroundPackage, /mode: parallel/);
  assert.match(backgroundPackage, /max: 50/);
  assert.match(backgroundPackage, /max_exceeded: silent/);
  assert.match(backgroundPackage, /input_text\.nodalia_notifications_background_config_01/);
  assert.match(backgroundPackage, /nodalia_notifications_background_config_40: \{ max: 255 \}/);
  assert.match(backgroundPackage, /count: 40/);
  assert.match(backgroundPackage, /states\('input_text\.nodalia_notifications_background_config_40'\)/);
  assert.match(backgroundPackage, /notify\.send_message/);
  assert.match(backgroundPackage, /notify_entities: "\{\{ notify_cfg\.get\('entities', \[\]\) \}\}"/);
  const notifySendMessageBlock = backgroundPackage.match(/- action: notify\.send_message[\s\S]*?(?=\n      - repeat:)/)?.[0] || "";
  assert.doesNotMatch(notifySendMessageBlock, /\n\s+data:\n\s+tag:/);
  assert.doesNotMatch(notifySendMessageBlock, /\n\s+ttl:/);
  assert.doesNotMatch(notifySendMessageBlock, /\n\s+priority:/);
  assert.doesNotMatch(backgroundPackage, /notify_cfg\.get\('entities', \['notify\.mobile_app_my_phone'\]\)/);
  assert.match(backgroundPackage, /new_state_value: "\{\{ trigger\.event\.data\.new_state\.state/);
  assert.match(backgroundPackage, /old_state_value: "\{\{ trigger\.event\.data\.old_state\.state/);
  assert.match(backgroundPackage, /new_state_value: "\{\{ trigger\.event\.data\.new_state_value/);
  assert.match(backgroundPackage, /old_state_value: "\{\{ trigger\.event\.data\.old_state_value/);
  assert.match(backgroundPackage, /trigger\.event\.data\.old_state\.state != trigger\.event\.data\.new_state\.state/);
  assert.match(backgroundPackage, /new_value: "\{\{ new_state_value \| replace\('%', ''\) \| float\(none\) \}\}"/);
  assert.match(backgroundPackage, /\{% set nv = new_value %\}/);
  assert.match(backgroundPackage, /\{% set ov = old_value %\}/);
  assert.match(backgroundPackage, /nv >= thresholds\.get\('hot_temperature', 27\) and \(ov == none or ov < thresholds\.get\('hot_temperature', 27\)\)/);
  assert.doesNotMatch(backgroundPackage, /hot_temperature', 27\)[^\n]*or ov != nv/);
  assert.match(backgroundPackage, /\| replace\('\{fan\}', 'ventilador'\)/);
  assert.match(backgroundPackage, /\{% elif e in groups\.get\('ink', \[\]\) and nv != none and nv <= thresholds\.get\('ink_low', 15\)/);
  assert.match(backgroundPackage, /presence_ok/);
  assert.doesNotMatch(backgroundPackage, /new_state: "\{\{ trigger\.event\.data\.new_state \}\}"/);
  assert.match(backgroundPackage, /from_json\(default=\{\}\)/);
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
  assert.match(source, /config\.thresholds\?\.hot_temperature/);
  assert.match(source, /editor-section__toggle-button/);
  assert.match(source, /_editorLabel\(s\)/);
  assert.match(source, /this\._editorLabel\(label\)/);
  assert.match(source, /Conexiones inteligentes|ed\.notifications\.connections_section_title/);
  assert.match(source, /Sincronización y móvil|ed\.notifications\.sync_section_title/);
  assert.match(source, /Añadir notificación|ed\.notifications\.add_notification/);
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
  assert.match(source, /_lastNotificationIdsSignature/);
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
  assert.match(i18n, /<nodalia-runtime-i18n-pack>/);
  assert.match(i18n, /\bde:\s*\{[\s\S]*?fallbackEvent:\s*"Termin"/);
  assert.match(i18n, /\bfr:\s*\{[\s\S]*?fallbackEvent:\s*"Événement"/);
  assert.match(i18n, /\bzh:\s*\{[\s\S]*?fallbackEvent:\s*"事件"/);
  assert.match(i18n, /mediaLeftOn: "Multimedia ohne Anwesenheit eingeschaltet"/);
  assert.match(i18n, /hotClimate: "\{source\} zeigt \{value\}\. Du kannst Kühlung auf \{climate\} einschalten\."/);
  assert.match(i18n, /Borrar notificación/);
  const editorUi = read("nodalia-editor-ui.js");
  const { rows: editorRows } = editorRowsFromGeneratedSource(editorUi);
  assert.equal(editorRowBySpanish(editorRows, "Borde tarjeta")[2], "Kartenrand");
  assert.equal(editorRowBySpanish(editorRows, "Etiqueta")[2], "Beschriftung");
  assert.equal(editorRowBySpanish(editorRows, "Mostrar tambien en escritorio")[2], "Auch auf dem Desktop anzeigen");
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
  assert.match(source, /versionedLoaderFile = `nodalia-cards-\$\{pkg\.version\}\.js`/);
  assert.match(source, /coreFile = `nodalia-cards-core-\$\{pkg\.version\}\.js`/);
  assert.match(source, /suiteFile = `nodalia-cards-suite-\$\{pkg\.version\}\.js`/);
  assert.match(source, /fs\.writeFileSync\(path\.join\(root, versionedLoaderFile\), `\$\{hacsBody\}/);
  assert.match(source, /fs\.writeFileSync\(path\.join\(root, coreFile\), `\$\{coreBody\}/);
  assert.match(source, /mode: "inline"/);
  assert.match(source, /window\.__NODALIA_LOADER__/);
  assert.match(source, /window\.__NODALIA_BUNDLE__/);
  assert.match(source, /window\.__NODALIA_CORE__/);
  assert.match(source, /window\.__NODALIA_SUITE__/);
});
