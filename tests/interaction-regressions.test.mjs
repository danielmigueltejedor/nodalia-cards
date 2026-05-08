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

test("navigation media player toggle keeps theme fallbacks after sanitized values", () => {
  const source = read("nodalia-navigation-bar.js");
  assert.match(source, /const mediaToggleBackgroundBase = sanitizeCssRuntimeValue\(config\.styles\.media_player\.background\)[\s\S]*"var\(--ha-card-background, var\(--card-background-color\)\)"/);
  assert.match(source, /const mediaToggleBorder = sanitizeCssRuntimeValue\(config\.styles\.media_player\.border\)[\s\S]*"1px solid color-mix\(in srgb, var\(--primary-text-color\) 8%, transparent\)"/);
  assert.match(source, /const mediaToggleBorderRadius = sanitizeCssRuntimeValue\(config\.styles\.media_player\.border_radius\)[\s\S]*"18px"/);
  assert.match(source, /const mediaToggleBoxShadow = sanitizeCssRuntimeValue\(config\.styles\.media_player\.box_shadow\)[\s\S]*"inset 0 1px 0 color-mix\(in srgb, var\(--primary-text-color\) 4%, transparent\), 0 10px 24px rgba\(0, 0, 0, 0\.16\)"/);
});
