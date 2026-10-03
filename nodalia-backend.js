/* Generated from src/core/engine-client-runtime.ts. Do not edit. */
"use strict";
(() => {
  // src/core/engine-client.ts
  var isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  var API_VERSION = 3;
  var LEGACY_API_VERSION = 2;
  var STATUS_TTL_MS = 3e4;
  var statusCache = { connection: null, checkedAt: 0, value: null };
  function callWS(hass, message) {
    if (typeof hass?.callWS === "function") {
      return hass.callWS(message);
    }
    if (typeof hass?.connection?.sendMessagePromise === "function") {
      return hass.connection.sendMessagePromise(message);
    }
    return Promise.reject(new Error("Home Assistant WebSocket API is unavailable"));
  }
  function isUnavailableError(error) {
    const row = isRecord(error) ? error : {};
    const code = String(row.code || "").toLowerCase();
    const message = String(row.message || error || "").toLowerCase();
    return code === "unknown_command" || code === "not_found" || message.includes("unknown command");
  }
  async function status(hass, options = {}) {
    const now = Date.now();
    const connection = hass?.connection || hass;
    if (options.force !== true && statusCache.connection === connection && statusCache.value && now - statusCache.checkedAt < STATUS_TTL_MS) {
      return statusCache.value;
    }
    try {
      const response = await callWS(hass, { type: "nodalia/status", api_version: LEGACY_API_VERSION });
      const result = isRecord(response) ? response : {};
      const serverVersion = Number(result?.api_version) || 0;
      const minimumVersion = Number(result?.api_min_version) || serverVersion;
      const maximumVersion = Number(result?.api_max_version) || serverVersion;
      const negotiated = [API_VERSION, LEGACY_API_VERSION].find((version) => minimumVersion <= version && maximumVersion >= version) || 0;
      const value = {
        available: result?.available === true && negotiated > 0,
        negotiated_api_version: negotiated,
        api_version: serverVersion,
        api_min_version: minimumVersion,
        api_max_version: maximumVersion,
        version: String(result?.version || ""),
        capabilities: Array.isArray(result.capabilities) ? result.capabilities.filter((value2) => typeof value2 === "string") : [],
        limits: isRecord(result.limits) ? { ...result.limits } : {},
        health: isRecord(result.health) ? { ...result.health } : {}
      };
      statusCache = { connection, checkedAt: now, value };
      return value;
    } catch (error) {
      const engineMissing = isUnavailableError(error);
      if (!engineMissing && options.silent !== true && typeof console?.warn === "function") {
        console.warn("Nodalia Cards: could not query the Nodalia integration.", error);
      }
      const value = {
        available: false,
        api_version: 0,
        api_min_version: 0,
        api_max_version: 0,
        negotiated_api_version: 0,
        version: "",
        capabilities: [],
        limits: {},
        health: {},
        transient: !engineMissing
      };
      if (engineMissing) {
        statusCache = { connection, checkedAt: now, value };
      }
      return value;
    }
  }
  function profileId(config) {
    const background = isRecord(config) && isRecord(config.background_mobile) ? config.background_mobile : {};
    const value = String(background.profile_id || "default").trim();
    return value || "default";
  }
  function hasCapability(value, capability) {
    const statusValue = isRecord(value) ? value : {};
    return statusValue?.available === true && Array.isArray(statusValue.capabilities) && statusValue.capabilities.includes(String(capability || ""));
  }
  function commandVersion(hass) {
    const cached = statusCache.connection === (hass?.connection || hass) ? statusCache.value : null;
    return cached?.available ? cached.negotiated_api_version : LEGACY_API_VERSION;
  }
  async function v3Command(hass, capability, type, data) {
    const value = await status(hass);
    if (value.negotiated_api_version !== API_VERSION || !hasCapability(value, capability)) {
      throw Object.assign(new Error(`Engine capability unavailable: ${capability}`), { code: "unsupported_capability" });
    }
    return callWS(hass, { ...data, type, api_version: API_VERSION });
  }
  var nodaliaBackend = Object.freeze({
    API_VERSION,
    callWS,
    previewNotificationProfile(hass, profile, id = "default") {
      return v3Command(hass, "notifications_preview", "nodalia/notifications/preview", { profile_id: id, profile });
    },
    snoozeNotification(hass, alertId, until, id = "default") {
      return v3Command(hass, "notifications_snooze", "nodalia/notifications/snooze", { profile_id: id, alert_id: alertId, until });
    },
    previewClimateSchedule(hass, entityId, schedule, at) {
      return v3Command(hass, "climate_schedule_preview", "nodalia/climate/schedule/preview", { entity_id: entityId, schedule, at });
    },
    getVacuumSession(hass, entityId) {
      return v3Command(hass, "vacuum_sessions", "nodalia/vacuum/session/get", { entity_id: entityId });
    },
    setVacuumSession(hass, entityId, session, expectedRevision) {
      return v3Command(hass, "vacuum_sessions", "nodalia/vacuum/session/set", { entity_id: entityId, session, expected_revision: expectedRevision });
    },
    status,
    clearStatusCache() {
      statusCache = { connection: null, checkedAt: 0, value: null };
    },
    hasCapability,
    /** Compact status snapshot used by card editors to switch between Engine and legacy fields. */
    async getEditorEngineStatus(hass) {
      const statusValue = await status(hass, { silent: true });
      return {
        available: statusValue?.available === true,
        version: String(statusValue?.version || ""),
        capabilities: Array.isArray(statusValue?.capabilities) ? [...statusValue.capabilities] : [],
        health: statusValue?.health && typeof statusValue.health === "object" ? { ...statusValue.health } : {},
        caps: {
          notificationsBackground: hasCapability(statusValue, "notifications_background"),
          climateSchedules: hasCapability(statusValue, "climate_schedules"),
          notificationsInbox: hasCapability(statusValue, "notifications_inbox"),
          climateOverrides: hasCapability(statusValue, "climate_overrides")
        }
      };
    },
    notificationProfileId: profileId,
    async listNotificationProfiles(hass) {
      return callWS(hass, {
        type: "nodalia/notifications/list",
        api_version: commandVersion(hass)
      });
    },
    async listNotificationInbox(hass, id = "default") {
      return callWS(hass, {
        type: "nodalia/notifications/inbox/list",
        api_version: commandVersion(hass),
        profile_id: String(id || "default")
      });
    },
    async clearNotificationInbox(hass, id = "default") {
      return callWS(hass, {
        type: "nodalia/notifications/inbox/clear",
        api_version: commandVersion(hass),
        profile_id: String(id || "default")
      });
    },
    async getNotificationProfile(hass, id = "default") {
      return callWS(hass, {
        type: "nodalia/notifications/get",
        api_version: commandVersion(hass),
        profile_id: String(id || "default")
      });
    },
    async setNotificationProfile(hass, profile, id = "default") {
      return callWS(hass, {
        type: "nodalia/notifications/set",
        api_version: commandVersion(hass),
        profile_id: String(id || "default"),
        profile
      });
    },
    async deleteNotificationProfile(hass, id = "default") {
      return callWS(hass, {
        type: "nodalia/notifications/delete",
        api_version: commandVersion(hass),
        profile_id: String(id || "default")
      });
    },
    async dismissNotification(hass, id, profile = "default") {
      return callWS(hass, {
        type: "nodalia/notifications/dismiss",
        api_version: commandVersion(hass),
        profile_id: String(profile || "default"),
        alert_id: String(id || "")
      });
    },
    async testNotification(hass, id = "default") {
      return callWS(hass, {
        type: "nodalia/notifications/test",
        api_version: commandVersion(hass),
        profile_id: String(id || "default")
      });
    },
    async sendExternalNotification(hass, alertId, id = "default") {
      return callWS(hass, {
        type: "nodalia/notifications/send_external",
        api_version: commandVersion(hass),
        profile_id: String(id || "default"),
        alert_id: String(alertId || "")
      });
    },
    async getClimateSchedule(hass, entityId) {
      return callWS(hass, {
        type: "nodalia/climate/schedule/get",
        api_version: commandVersion(hass),
        entity_id: String(entityId || "")
      });
    },
    async listClimateSchedules(hass) {
      return callWS(hass, {
        type: "nodalia/climate/schedule/list",
        api_version: commandVersion(hass)
      });
    },
    async setClimateOverride(hass, entityId, override) {
      return callWS(hass, {
        type: "nodalia/climate/override/set",
        api_version: commandVersion(hass),
        entity_id: String(entityId || ""),
        override
      });
    },
    async clearClimateOverride(hass, entityId) {
      return callWS(hass, {
        type: "nodalia/climate/override/clear",
        api_version: commandVersion(hass),
        entity_id: String(entityId || "")
      });
    },
    async setClimateSchedule(hass, entityId, schedule) {
      return callWS(hass, {
        type: "nodalia/climate/schedule/set",
        api_version: commandVersion(hass),
        entity_id: String(entityId || ""),
        schedule
      });
    },
    async deleteClimateSchedule(hass, entityId) {
      return callWS(hass, {
        type: "nodalia/climate/schedule/delete",
        api_version: commandVersion(hass),
        entity_id: String(entityId || "")
      });
    },
    async applyClimateSchedule(hass, entityId) {
      return callWS(hass, {
        type: "nodalia/climate/schedule/apply",
        api_version: commandVersion(hass),
        entity_id: String(entityId || "")
      });
    }
  });

  // src/core/engine-client-runtime.ts
  if (typeof window !== "undefined" && !window.NodaliaBackend) {
    window.NodaliaBackend = nodaliaBackend;
  }
})();
