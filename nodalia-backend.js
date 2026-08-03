(() => {
  if (typeof window === "undefined" || window.NodaliaBackend) {
    return;
  }

  const API_VERSION = 1;
  const STATUS_TTL_MS = 30_000;
  let statusCache = { connection: null, checkedAt: 0, value: null };

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
    const code = String(error?.code || "").toLowerCase();
    const message = String(error?.message || error || "").toLowerCase();
    return code === "unknown_command"
      || code === "not_found"
      || message.includes("unknown command")
      || message.includes("nodalia/status");
  }

  async function status(hass, options = {}) {
    const now = Date.now();
    const connection = hass?.connection || hass;
    if (
      options.force !== true
      && statusCache.connection === connection
      && statusCache.value
      && now - statusCache.checkedAt < STATUS_TTL_MS
    ) {
      return statusCache.value;
    }
    try {
      const result = await callWS(hass, { type: "nodalia/status", api_version: API_VERSION });
      const serverVersion = Number(result?.api_version) || 0;
      const minimumVersion = Number(result?.api_min_version) || serverVersion;
      const maximumVersion = Number(result?.api_max_version) || serverVersion;
      const value = {
        available: result?.available === true && minimumVersion <= API_VERSION && maximumVersion >= API_VERSION,
        api_version: serverVersion,
        api_min_version: minimumVersion,
        api_max_version: maximumVersion,
        version: String(result?.version || ""),
        capabilities: Array.isArray(result?.capabilities) ? result.capabilities : [],
        limits: result?.limits && typeof result.limits === "object" ? { ...result.limits } : {},
      };
      statusCache = { connection, checkedAt: now, value };
      return value;
    } catch (error) {
      if (!isUnavailableError(error) && options.silent !== true && typeof console?.warn === "function") {
        console.warn("Nodalia Cards: could not query the Nodalia integration.", error);
      }
      const value = {
        available: false,
        api_version: 0,
        api_min_version: 0,
        api_max_version: 0,
        version: "",
        capabilities: [],
        limits: {},
      };
      statusCache = { connection, checkedAt: now, value };
      return value;
    }
  }

  function profileId(config) {
    const value = String(config?.background_mobile?.profile_id || "default").trim();
    return value || "default";
  }

  const backend = {
    API_VERSION,
    callWS,
    status,
    clearStatusCache() {
      statusCache = { connection: null, checkedAt: 0, value: null };
    },
    hasCapability(statusValue, capability) {
      return statusValue?.available === true
        && Array.isArray(statusValue.capabilities)
        && statusValue.capabilities.includes(String(capability || ""));
    },
    notificationProfileId: profileId,
    async getNotificationProfile(hass, id = "default") {
      return callWS(hass, {
        type: "nodalia/notifications/get",
        api_version: API_VERSION,
        profile_id: String(id || "default"),
      });
    },
    async setNotificationProfile(hass, profile, id = "default") {
      return callWS(hass, {
        type: "nodalia/notifications/set",
        api_version: API_VERSION,
        profile_id: String(id || "default"),
        profile,
      });
    },
    async deleteNotificationProfile(hass, id = "default") {
      return callWS(hass, {
        type: "nodalia/notifications/delete",
        api_version: API_VERSION,
        profile_id: String(id || "default"),
      });
    },
    async dismissNotification(hass, id, profile = "default") {
      return callWS(hass, {
        type: "nodalia/notifications/dismiss",
        api_version: API_VERSION,
        profile_id: String(profile || "default"),
        alert_id: String(id || ""),
      });
    },
    async testNotification(hass, id = "default") {
      return callWS(hass, {
        type: "nodalia/notifications/test",
        api_version: API_VERSION,
        profile_id: String(id || "default"),
      });
    },
    async sendExternalNotification(hass, alertId, id = "default") {
      return callWS(hass, {
        type: "nodalia/notifications/send_external",
        api_version: API_VERSION,
        profile_id: String(id || "default"),
        alert_id: String(alertId || ""),
      });
    },
    async getClimateSchedule(hass, entityId) {
      return callWS(hass, {
        type: "nodalia/climate/schedule/get",
        api_version: API_VERSION,
        entity_id: String(entityId || ""),
      });
    },
    async setClimateSchedule(hass, entityId, schedule) {
      return callWS(hass, {
        type: "nodalia/climate/schedule/set",
        api_version: API_VERSION,
        entity_id: String(entityId || ""),
        schedule,
      });
    },
    async deleteClimateSchedule(hass, entityId) {
      return callWS(hass, {
        type: "nodalia/climate/schedule/delete",
        api_version: API_VERSION,
        entity_id: String(entityId || ""),
      });
    },
    async applyClimateSchedule(hass, entityId) {
      return callWS(hass, {
        type: "nodalia/climate/schedule/apply",
        api_version: API_VERSION,
        entity_id: String(entityId || ""),
      });
    },
  };

  window.NodaliaBackend = Object.freeze(backend);
})();
