import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadMobileHelpers() {
  const sandbox = {
    URL,
    window: { NodaliaUtils: {} },
    customElements: { define() {}, get() { return null; } },
    HTMLElement: class {},
    globalThis: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-notifications-card.js"), sandbox);
  return sandbox.__NODALIA_NOTIFICATIONS_MOBILE__;
}

const mobile = loadMobileHelpers();

const baseOptions = {
  defaultPolicy: "auto",
  globalMobileEnabled: true,
  minSeverity: "warning",
  alertSeverity: "warning",
  backgroundMobileEnabled: false,
  notifyTargetsConfigured: true,
  mobileContext: { only_when_away: false, only_when_home: false, quiet_hours: { enabled: false, start: "23:00", end: "08:00", allow_critical: true } },
  presenceOccupancy: null,
  cooldownActive: false,
};

test("normalizeMobilePolicy accepts new policy values", () => {
  assert.equal(mobile.normalizeMobilePolicy("auto"), "auto");
  assert.equal(mobile.normalizeMobilePolicy("push"), "push");
  assert.equal(mobile.normalizeMobilePolicy("card_only"), "card_only");
  assert.equal(mobile.normalizeMobilePolicy("off"), "off");
  assert.equal(mobile.normalizeMobilePolicy({ policy: "push" }), "push");
});

test("normalizeMobilePolicy keeps legacy boolean and string values", () => {
  assert.equal(mobile.normalizeMobilePolicy(true), "push");
  assert.equal(mobile.normalizeMobilePolicy(false), "off");
  assert.equal(mobile.normalizeMobilePolicy("on"), "push");
  assert.equal(mobile.normalizeMobilePolicy("inherit"), "auto");
  assert.equal(mobile.normalizeMobilePolicy("off"), "off");
});

test("default_policy applies when alert policy is auto", () => {
  assert.equal(
    mobile.resolveMobileDeliveryState({ ...baseOptions, alertPolicy: "auto", defaultPolicy: "card_only" }),
    "card_only",
  );
});

test("per-alert policy overrides default_policy", () => {
  assert.equal(
    mobile.resolveMobileDeliveryState({ ...baseOptions, alertPolicy: "push", defaultPolicy: "off" }),
    "allowed",
  );
});

test("card_only is visible state and blocks push delivery", () => {
  assert.equal(
    mobile.resolveMobileDeliveryState({ ...baseOptions, alertPolicy: "card_only" }),
    "card_only",
  );
});

test("off policy is respected", () => {
  assert.equal(
    mobile.resolveMobileDeliveryState({ ...baseOptions, alertPolicy: "off" }),
    "off",
  );
});

test("push forces delivery when context and severity allow", () => {
  assert.equal(
    mobile.resolveMobileDeliveryState({
      ...baseOptions,
      alertPolicy: "push",
      alertSeverity: "info",
      globalMobileEnabled: false,
    }),
    "allowed",
  );
});

test("min_severity still applies for auto policy", () => {
  assert.equal(
    mobile.resolveMobileDeliveryState({
      ...baseOptions,
      alertPolicy: "auto",
      alertSeverity: "info",
      minSeverity: "warning",
    }),
    "blocked_by_severity",
  );
});

test("quiet hours blocks non-critical push", () => {
  assert.equal(
    mobile.resolveMobileDeliveryState({
      ...baseOptions,
      quietHoursActive: true,
      mobileContext: {
        quiet_hours: { enabled: true, start: "23:00", end: "08:00", allow_critical: true },
      },
    }),
    "blocked_by_quiet_hours",
  );
});

test("quiet hours allows critical when allow_critical is enabled", () => {
  assert.equal(
    mobile.resolveMobileDeliveryState({
      ...baseOptions,
      alertSeverity: "critical",
      quietHoursActive: true,
      mobileContext: {
        quiet_hours: { enabled: true, start: "23:00", end: "08:00", allow_critical: true },
      },
    }),
    "allowed",
  );
});

test("quiet hours supports midnight crossing", () => {
  const lateNight = new Date("2026-05-29T23:30:00");
  assert.equal(
    mobile.isWithinQuietHours({ enabled: true, start: "23:00", end: "08:00", allow_critical: true }, lateNight),
    true,
  );
  const morning = new Date("2026-05-29T07:30:00");
  assert.equal(
    mobile.isWithinQuietHours({ enabled: true, start: "23:00", end: "08:00", allow_critical: true }, morning),
    true,
  );
  const afternoon = new Date("2026-05-29T15:00:00");
  assert.equal(
    mobile.isWithinQuietHours({ enabled: true, start: "23:00", end: "08:00", allow_critical: true }, afternoon),
    false,
  );
});

test("only_when_away and only_when_home do not break without presence entity", () => {
  assert.equal(
    mobile.passesPresenceContext({ only_when_away: true, only_when_home: false }, null),
    true,
  );
  assert.equal(
    mobile.passesPresenceContext({ only_when_away: true, only_when_home: false }, "away"),
    true,
  );
  assert.equal(
    mobile.passesPresenceContext({ only_when_away: true, only_when_home: false }, "home"),
    false,
  );
});

test("cooldown blocks delivery but card_only/off remain unchanged", () => {
  assert.equal(
    mobile.resolveMobileDeliveryState({ ...baseOptions, cooldownActive: true }),
    "blocked_by_cooldown",
  );
  assert.equal(
    mobile.resolveMobileDeliveryState({ ...baseOptions, alertPolicy: "card_only", cooldownActive: true }),
    "card_only",
  );
});

test("external_alerts normalize and deduplicate by id", () => {
  const rows = mobile.normalizeExternalAlerts([
    { id: "a", title: "One", type: "camera_event", mobile: { policy: "push" } },
    { id: "a", title: "Dup", type: "camera_event" },
    { id: "b", title: "Two", type: "security_event", mobile: "off" },
    { id: "", title: "Missing id" },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].mobile, "push");
  assert.equal(rows[1].mobile, "off");
});

test("external alert editor drafts survive normalization until required fields are filled", () => {
  const draft = { _draft: true, id: "", title: "", type: "camera_event", severity: "warning" };
  const editorRows = mobile.normalizeExternalAlerts([draft], { keepDrafts: true });
  const emittedRows = mobile.normalizeExternalAlerts([draft]);
  assert.equal(editorRows.length, 1);
  assert.equal(editorRows[0]._draft, true);
  assert.equal(emittedRows.length, 0);

  const source = read("nodalia-notifications-card.js");
  assert.match(source, /case "add-external-alert":[\s\S]*_draft: true/);
  assert.match(source, /case "add-external-alert":[\s\S]*this\._showExternalAlertsSection = true;[\s\S]*this\._emitConfig\(\)/);
});

test("background payload includes policy context cooldown and external alerts", () => {
  const payload = mobile.getBackgroundMobileConfigPayload({
    background_mobile: { enabled: true },
    mobile_notifications: {
      enabled: true,
      entities: ["notify.phone"],
      default_policy: "auto",
      cooldown_minutes: 15,
      group_similar: false,
      min_severity: "warning",
    },
    presence_entity: "binary_sensor.home",
    mobile_context: {
      only_when_away: true,
      quiet_hours: { enabled: true, start: "22:00", end: "07:00", allow_critical: false },
    },
    external_alerts: [{ id: "cam1", title: "Person", type: "camera_event", mobile: "auto" }],
    smart_notifications: { battery_low: { mobile: "push" } },
    smart_entity_overrides: [{ entity: "binary_sensor.door", mobile: "off" }],
  });
  assert.equal(payload.version, 2);
  assert.equal(payload.notify.default_policy, "auto");
  assert.equal(payload.notify.cooldown_minutes, 15);
  assert.equal(payload.notify.group_similar, false);
  assert.equal(payload.context.presence_entity, "binary_sensor.home");
  assert.equal(payload.context.only_when_away, true);
  assert.equal(payload.external_alerts.length, 1);
  assert.equal(payload.smart.battery_low.mobile, "push");
  assert.equal(payload.overrides["binary_sensor.door"].mobile, "off");
});

test("background webhook payload uses version 2", () => {
  const payload = mobile.buildBackgroundMobileWebhookPayload({
    background_mobile: { enabled: true, webhook: "nodalia_notifications_background_sync" },
    mobile_notifications: { enabled: true, entities: ["notify.phone"] },
  });
  assert.equal(payload.version, 2);
  assert.ok(payload.chunks.length > 0);
});

test("editor emits normalized mobile policy values", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(source, /mobile_policy_auto/);
  assert.match(source, /mobile_notifications\.default_policy/);
  assert.match(source, /external_alerts\.\$\{index\}\.mobile/);
  assert.match(source, /stripEqualToDefaults/);
});

test("foreground push is skipped only after background sync succeeds", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(source, /_backgroundMobileSuppressesForeground\(\)/);
  assert.match(source, /_lastBackgroundMobileSyncSignature/);
  assert.match(source, /background\.enabled !== true[\s\S]*return false/);
});

test("background payload rejects configs exceeding 40 chunks", () => {
  const oversized = {
    background_mobile: { enabled: true, chunk_size: 120 },
    custom_notifications: Array.from({ length: 80 }, (_, index) => ({
      title: `Alert ${index}`,
      message: "x".repeat(180),
      severity: "warning",
    })),
  };
  const payload = mobile.buildBackgroundMobileWebhookPayload(oversized);
  assert.ok(mobile.backgroundMobilePayloadOverLimit(payload));
  assert.equal(payload.over_limit, true);
  assert.ok(payload.chunk_count > mobile.BACKGROUND_MOBILE_MAX_CHUNKS);
});

test("smart entity override inherit preserves kind-level mobile off", () => {
  const config = {
    smart_notifications: { hot: { mobile: "off" } },
    smart_entity_overrides: [{ entity: "sensor.living_temp", title: "Custom title", mobile: "inherit" }],
  };
  const normalized = mobile.resolveSmartEntityMobilePolicy("inherit", config.smart_notifications.hot.mobile);
  assert.equal(normalized, "off");
});

test("smart entity override explicit off overrides kind push", () => {
  const resolved = mobile.resolveSmartEntityMobilePolicy("off", "push");
  assert.equal(resolved, "off");
});

test("smart entity override inherit does not override kind off when only customizing text", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(source, /resolveSmartEntityMobilePolicy\(override\?\.mobile, base\.mobile/);
  assert.match(source, /normalizeSmartEntityOverrideMobile/);
});

test("background package rejects oversized payloads and uses local_only", () => {
  const backgroundPackage = read("examples/notifications-background-mobile-package.yaml");
  assert.match(backgroundPackage, /local_only: true/);
  assert.match(backgroundPackage, /chunk_count \| int > 40/);
  assert.match(backgroundPackage, /chunk_count \| int < 1/);
  assert.match(backgroundPackage, /chunk_count \| int >= repeat\.index/);
  assert.match(backgroundPackage, /Rejected background mobile payload/);
  assert.match(backgroundPackage, /override_mobile_policy in \['inherit', 'auto', ''\]/);
  assert.match(backgroundPackage, /\{\{ smart_mobile \}\}/);
});

test("threshold crossing remains in background package templates", () => {
  const backgroundPackage = read("examples/notifications-background-mobile-package.yaml");
  assert.match(backgroundPackage, /ov == none or ov < thresholds/);
  assert.match(backgroundPackage, /old_state\.state != trigger\.event\.data\.new_state\.state/);
});

test("notifications card version is 2.0.0-alpha.37", () => {
  assert.match(read("nodalia-notifications-card.js"), /CARD_VERSION = "2\.0\.0-alpha\.37"/);
});
