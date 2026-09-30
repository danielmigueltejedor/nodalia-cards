/* Generated from src/cards/notifications/notifications-mobile-policy-runtime.ts. Do not edit. */
"use strict";
(() => {
  // src/cards/notifications/notifications-mobile-policy.ts
  var MOBILE_POLICY_VALUES = /* @__PURE__ */ new Set(["auto", "push", "card_only", "off"]);
  var BACKGROUND_MOBILE_MAX_CHUNKS = 40;
  var MOBILE_DELIVERY_STATES = /* @__PURE__ */ new Set([
    "allowed",
    "card_only",
    "off",
    "blocked_by_severity",
    "blocked_by_context",
    "blocked_by_quiet_hours",
    "blocked_by_cooldown"
  ]);
  var MOBILE_COOLDOWN_STORAGE_KEY = "nodalia_notifications_mobile_cooldown_v1";
  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function normalizeSeverity(value) {
    const key = String(value || "info").trim().toLowerCase();
    return key === "success" || key === "warning" || key === "critical" ? key : "info";
  }
  function normalizeMobilePolicy(value = void 0) {
    if (isRecord(value) && value.policy !== void 0) {
      return normalizeMobilePolicy(value.policy);
    }
    if (value === true) {
      return "push";
    }
    if (value === false) {
      return "off";
    }
    const normalized = String(value ?? "auto").trim().toLowerCase();
    if (normalized === "auto" || normalized === "push" || normalized === "card_only" || normalized === "off") {
      return normalized;
    }
    if (["on", "true", "enabled", "yes", "1"].includes(normalized)) {
      return "push";
    }
    if (["off", "false", "disabled", "no", "0"].includes(normalized)) {
      return "off";
    }
    return "auto";
  }
  function isExplicitSmartEntityMobile(value = void 0) {
    if (value === void 0 || value === null) {
      return false;
    }
    const raw = String(value).trim().toLowerCase();
    if (!raw || raw === "inherit" || raw === "auto") {
      return false;
    }
    const normalized = normalizeMobilePolicy(value);
    return normalized === "push" || normalized === "off" || normalized === "card_only";
  }
  function resolveSmartEntityMobilePolicy(overrideMobile, baseMobile) {
    if (!isExplicitSmartEntityMobile(overrideMobile)) {
      return normalizeMobilePolicy(baseMobile ?? "auto");
    }
    return normalizeMobilePolicy(overrideMobile);
  }
  function backgroundMobilePayloadOverLimit(payload) {
    return Number(isRecord(payload) ? payload.chunk_count : void 0) > BACKGROUND_MOBILE_MAX_CHUNKS;
  }
  function normalizeSmartEntityMobile(value = void 0) {
    return normalizeMobilePolicy(value);
  }
  function normalizeSmartEntityOverrideMobile(value = void 0) {
    if (value === void 0 || value === null || String(value).trim() === "") {
      return "inherit";
    }
    const raw = String(value).trim().toLowerCase();
    return raw === "inherit" ? "inherit" : normalizeSmartEntityMobile(value);
  }
  function parseClockMinutes(value = void 0) {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      return null;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) {
      return null;
    }
    return hours * 60 + minutes;
  }
  function isWithinQuietHours(value, date = /* @__PURE__ */ new Date()) {
    const quietHours = isRecord(value) ? value : {};
    if (!quietHours?.enabled) {
      return false;
    }
    const start = parseClockMinutes(quietHours.start);
    const end = parseClockMinutes(quietHours.end);
    if (start === null || end === null) {
      return false;
    }
    const now = date.getHours() * 60 + date.getMinutes();
    if (start === end) {
      return false;
    }
    return start < end ? now >= start && now < end : now >= start || now < end;
  }
  function getNextQuietHoursBoundaryDelay(quietHours, date = /* @__PURE__ */ new Date()) {
    const normalized = normalizeQuietHours(quietHours);
    const current = date instanceof Date ? date : new Date(date === null ? 0 : date);
    if (!normalized.enabled || Number.isNaN(current.getTime())) {
      return null;
    }
    const start = parseClockMinutes(normalized.start);
    const end = parseClockMinutes(normalized.end);
    if (start === null || end === null || start === end) {
      return null;
    }
    const nowMs = current.getTime();
    const candidates = [start, end].map((minutes) => {
      const boundary = new Date(current);
      boundary.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      if (boundary.getTime() <= nowMs) {
        boundary.setDate(boundary.getDate() + 1);
      }
      return boundary.getTime() - nowMs;
    });
    return Math.min(...candidates);
  }
  function normalizeQuietHours(value = void 0) {
    const row = isRecord(value) ? value : {};
    return {
      enabled: row.enabled === true,
      start: String(row.start || "23:00").trim() || "23:00",
      end: String(row.end || "08:00").trim() || "08:00",
      allow_critical: row.allow_critical !== false
    };
  }
  function normalizeMobileContext(value = void 0) {
    const row = isRecord(value) ? value : {};
    return {
      only_when_away: row.only_when_away === true,
      only_when_home: row.only_when_home === true,
      quiet_hours: normalizeQuietHours(row.quiet_hours)
    };
  }
  function severityScore(severity) {
    return { critical: 4, warning: 3, success: 2, info: 1 }[normalizeSeverity(severity)] || 1;
  }
  function resolvePresenceOccupancy(hass, presenceEntityId) {
    const states = isRecord(hass) && isRecord(hass.states) ? hass.states : {};
    const entityId = String(presenceEntityId || "").trim();
    const entity = states[entityId];
    if (!entityId || !isRecord(entity)) {
      return null;
    }
    const stateKey = String(entity.state || "").trim().toLowerCase();
    if (["home", "on", "true", "occupied", "present"].includes(stateKey)) {
      return "home";
    }
    if (["not_home", "away", "off", "false", "absent", "out"].includes(stateKey)) {
      return "away";
    }
    return "unknown";
  }
  function passesPresenceContext(mobileContext, occupancy) {
    const context = normalizeMobileContext(mobileContext);
    if (context.only_when_away && context.only_when_home || occupancy === null) {
      return true;
    }
    if (context.only_when_away) {
      return occupancy === "away";
    }
    if (context.only_when_home) {
      return occupancy === "home";
    }
    return true;
  }
  function buildMobileAlertIdentity(value = {}) {
    const item = isRecord(value) ? value : {};
    const parts = [
      String(item.alertType || item.type || "").trim(),
      String(item.entity || "").trim(),
      String(item.id || "").trim(),
      String(item.severity || "").trim(),
      item.threshold !== void 0 && item.threshold !== null ? String(item.threshold) : ""
    ].filter(Boolean);
    return parts.join("|") || String(item.id || "");
  }
  function buildMobileGroupIdentity(value = {}) {
    const item = isRecord(value) ? value : {};
    return [
      String(item.alertType || item.type || "").trim(),
      String(item.entity || "").trim(),
      String(item.severity || "").trim()
    ].filter(Boolean).join("|");
  }
  function resolveMobileDeliveryState(value = {}) {
    const options = isRecord(value) ? value : {};
    const alertPolicy = normalizeMobilePolicy(options.alertPolicy ?? options.mobilePolicy ?? "auto");
    const defaultPolicy = normalizeMobilePolicy(options.defaultPolicy ?? "auto");
    const effectivePolicy = alertPolicy === "auto" ? defaultPolicy : alertPolicy;
    if (effectivePolicy === "off" || effectivePolicy === "card_only") {
      return effectivePolicy;
    }
    const minSeverity = normalizeSeverity(options.minSeverity || "warning");
    const alertSeverity = normalizeSeverity(options.alertSeverity || "info");
    const isCritical = alertSeverity === "critical";
    const notifyTargetsConfigured = options.notifyTargetsConfigured === true;
    const globalMobileEnabled = options.globalMobileEnabled === true;
    const quietHours = normalizeQuietHours(options.quietHours);
    const quietActive = options.quietHoursActive === true || isWithinQuietHours(quietHours, options.now instanceof Date ? options.now : /* @__PURE__ */ new Date());
    const contextAllowed = passesPresenceContext(options.mobileContext, options.presenceOccupancy ?? null);
    if (!contextAllowed) {
      return "blocked_by_context";
    }
    if (quietActive && !(quietHours.allow_critical && isCritical)) {
      return "blocked_by_quiet_hours";
    }
    if (options.cooldownActive === true) {
      return "blocked_by_cooldown";
    }
    if (effectivePolicy !== "push" && severityScore(alertSeverity) < severityScore(minSeverity)) {
      return "blocked_by_severity";
    }
    const canDeliver = (globalMobileEnabled || effectivePolicy === "push") && notifyTargetsConfigured;
    if (!canDeliver) {
      return effectivePolicy === "push" ? "blocked_by_context" : "card_only";
    }
    return "allowed";
  }
  function legacyMobilePolicyLabel(policy) {
    const normalized = normalizeMobilePolicy(policy);
    if (normalized === "push") return "on";
    if (normalized === "off") return "off";
    return "inherit";
  }
  var notificationsMobilePolicy = Object.freeze({
    MOBILE_POLICY_VALUES,
    BACKGROUND_MOBILE_MAX_CHUNKS,
    MOBILE_DELIVERY_STATES,
    MOBILE_COOLDOWN_STORAGE_KEY,
    normalizeMobilePolicy,
    resolveSmartEntityMobilePolicy,
    backgroundMobilePayloadOverLimit,
    normalizeSmartEntityMobile,
    normalizeSmartEntityOverrideMobile,
    isExplicitSmartEntityMobile,
    isWithinQuietHours,
    getNextQuietHoursBoundaryDelay,
    normalizeQuietHours,
    normalizeMobileContext,
    resolvePresenceOccupancy,
    passesPresenceContext,
    buildMobileAlertIdentity,
    buildMobileGroupIdentity,
    resolveMobileDeliveryState,
    legacyMobilePolicyLabel
  });

  // src/cards/notifications/notifications-mobile-policy-runtime.ts
  if (typeof window !== "undefined" && !window.NodaliaNotificationsMobilePolicy) {
    window.NodaliaNotificationsMobilePolicy = notificationsMobilePolicy;
  }
})();
