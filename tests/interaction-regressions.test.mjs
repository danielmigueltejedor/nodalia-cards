import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("graph tooltip keeps document hover watch guards", () => {
  const source = read("nodalia-graph-card.js");
  assert.match(source, /_onDocumentPointerMove\(/);
  assert.match(source, /_attachDocumentHoverWatch\(/);
  assert.match(source, /_detachDocumentHoverWatch\(/);
  assert.match(source, /document\.addEventListener\("pointermove", this\._onDocumentPointerMove, true\)/);
  assert.match(source, /document\.removeEventListener\("pointermove", this\._onDocumentPointerMove, true\)/);
  assert.match(source, /_scheduleHoverRender\(null\)/);
});

test("nav media/popup entrance animations are transition-driven", () => {
  const source = read("nodalia-navigation-bar.js");
  assert.match(source, /_lastMediaToggleVisible/);
  assert.match(source, /_playPopupEntrance/);
  assert.match(source, /media-player-toggle--entering/);
  assert.match(source, /popup-panel--entering/);
  assert.match(source, /playMediaToggleEntrance = .*?!this\._lastMediaToggleVisible/);
});

test("service-security controls are exposed in visual editors", () => {
  const files = [
    "nodalia-insignia-card.js",
    "nodalia-entity-card.js",
    "nodalia-fav-card.js",
    "nodalia-advance-vacuum-card.js",
    "nodalia-notifications-card.js",
  ];

  files.forEach(file => {
    const source = read(file);
    assert.match(source, /security\.strict_service_actions/);
    assert.match(source, /security\.allowed_services/);
    assert.match(source, /valueType:\s*"csv"|data-value-type="\$\{escapeHtml\(valueType\)\}"/);
  });
});

test("insignia icon-only pills keep bottom breathing room in scroll strips", () => {
  const source = read("nodalia-insignia-card.js");
  assert.match(source, /--insignia-scroll-strip-padding-block/);
  assert.match(source, /var\(--insignia-scroll-strip-margin-block, 4px 8px\)/);
  assert.match(source, /overflow: visible;[\s\S]*width: auto;/);
});

test("advanced vacuum internal service calls bypass strict external allowlist", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  assert.match(source, /_callInternalService\(service, data = \{\}, target = null\)/);
  assert.match(source, /_callNamedService\(service, data = \{\}, target = null\)/);
  assert.doesNotMatch(source, /persistenceBypass/);
  assert.match(source, /_callInternalService\("input_text\.set_value"/);
  assert.match(source, /_callInternalService\("vacuum\.send_command"/);
  assert.match(source, /_callInternalService\("roborock\.set_vacuum_goto_position"/);
  assert.match(source, /_callNamedService\(item\.service, serviceData, item\.target \|\| null\)/);
});

test("advanced vacuum webhook-only persistence deduplicates empty sessions", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  assert.match(source, /const hasEntityTarget = Boolean\(entityId\)/);
  assert.match(source, /const hasWebhookTarget = Boolean\(webhookId\)/);
  assert.match(source, /if \(hasEntityTarget && serializedTrim === currentValue\)/);
  assert.match(source, /if \(hasEntityTarget && serializedTrim === this\._lastSubmittedSharedCleaningSessionValue\)/);
  assert.match(
    source,
    /!hasEntityTarget &&\s*hasWebhookTarget &&\s*serializedTrim === this\._lastSubmittedSharedCleaningSessionValue/,
  );
  assert.doesNotMatch(source, /serializedTrim !== "" &&\s*serializedTrim === this\._lastSubmittedSharedCleaningSessionValue/);
});

test("advanced vacuum skips remote write when serialized session still overflows", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  assert.match(source, /if \(serialized\.length > maxLength\) \{\s*serialized = this\._serializeSharedCleaningSession\(session, \{ minimal: true \}\);\s*\}/);
  assert.match(source, /console\.warn\("Nodalia Advance Vacuum Card shared cleaning session exceeds helper length limit"\)/);
  assert.match(source, /if \(serialized\.length > maxLength\) \{[\s\S]*console\.warn\("Nodalia Advance Vacuum Card shared cleaning session exceeds helper length limit"\);[\s\S]*return;\s*\}/);
  assert.doesNotMatch(source, /if \(serialized\.length > maxLength\) \{[\s\S]*serialized = ""/);
});

test("navigation media player toggle keeps theme fallbacks after sanitized values", () => {
  const source = read("nodalia-navigation-bar.js");
  assert.match(source, /const mediaToggleBackgroundBase = sanitizeCssRuntimeValue\(config\.styles\.media_player\.background\)[\s\S]*"var\(--ha-card-background, var\(--card-background-color\)\)"/);
  assert.match(source, /const mediaToggleBorder = sanitizeCssRuntimeValue\(config\.styles\.media_player\.border\)[\s\S]*"1px solid color-mix\(in srgb, var\(--primary-text-color\) 8%, transparent\)"/);
  assert.match(source, /const mediaToggleBorderRadius = sanitizeCssRuntimeValue\(config\.styles\.media_player\.border_radius\)[\s\S]*"18px"/);
  assert.match(source, /const mediaToggleBoxShadow = sanitizeCssRuntimeValue\(config\.styles\.media_player\.box_shadow\)[\s\S]*"inset 0 1px 0 color-mix\(in srgb, var\(--primary-text-color\) 4%, transparent\), 0 10px 24px rgba\(0, 0, 0, 0\.16\)"/);
});

test("notifications mobile sent state only marks successful deliveries", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(source, /Promise\.all\(\[[\s\S]*\]\)\.then\(results => \{/);
  assert.match(source, /const delivered = results\.some\(Boolean\)/);
  assert.match(source, /if \(delivered\) \{\s*this\._mobileSent\.add\(hash\);/);
});

test("calendar native webhook failures show composer errors", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /if \(!ok\) \{\s*this\._setComposerError\("native", this\._uiText\("errors\.createEvent"/);
});

test("climate dial drag attaches window listeners only while dragging", () => {
  const source = read("nodalia-climate-card.js");
  assert.match(source, /this\._dragWindowListenersAttached = false/);
  assert.match(source, /_setDragWindowListeners\(enabled\)/);
  assert.match(source, /this\._setDragWindowListeners\(true\)/);
  assert.match(source, /this\._setDragWindowListeners\(false\)/);
});

test("notifications entrance animation does not rearm on list refreshes", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(source, /const animateEntrance = animations\.enabled && this\._animateContentOnNextRender/);
  assert.doesNotMatch(source, /notificationSetChanged/);
  assert.doesNotMatch(source, /_renderIfChanged\(true\);\s*\n\s*\}, Math\.max\(180, animations\.contentDuration \+ 160\)\);/);
  assert.match(source, /_lastRouteKey = ""/);
  assert.match(source, /_getRouteKey\(\)/);
  assert.match(source, /if \(nextRouteKey && nextRouteKey !== this\._lastRouteKey\) \{/);
  assert.match(source, /this\._replayEntranceAnimation\(\{ force: true \}\)/);
  assert.match(
    source,
    /\/\/ Match entity\/weather cards: do not render \(or consume entrance\) before hass/,
  );
});
