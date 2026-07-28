/** Pure state projection used by Nodalia Room Summary Card. */
(function initNodaliaRoomSummaryModel() {
  if (typeof window !== "undefined" && window.NodaliaRoomSummaryModel) {
    return;
  }

  function normalizeTextKey(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function normalizeEntityField(value) {
    if (Array.isArray(value)) {
      const seen = new Set();
      return value
        .map(item => String(item || "").trim())
        .filter(entityId => entityId && !seen.has(entityId) && seen.add(entityId));
    }
    const single = String(value ?? "").trim();
    return single ? [single] : [];
  }

  function hubMediaPlayerIds(config) {
    const ids = [];
    const seen = new Set();
    const add = entityId => {
      const normalized = String(entityId || "").trim();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        ids.push(normalized);
      }
    };
    add(config?.media_player);
    (config?.media_players || []).forEach(add);
    (config?.media_config?.players || []).forEach(player => add(player?.entity));
    return ids;
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function isUnavailable(state) {
    const key = normalizeTextKey(state?.state);
    return key === "unavailable" || key === "unknown";
  }

  function stateIsOn(state) {
    return ["on", "open", "opening", "true", "home", "occupied", "present", "detected", "unlocked", "playing", "paused"]
      .includes(normalizeTextKey(state?.state));
  }

  function stateIsOpen(state) {
    return ["on", "open", "opening"].includes(normalizeTextKey(state?.state));
  }

  function stateIsUnlocked(state) {
    return ["unlocked", "open"].includes(normalizeTextKey(state?.state));
  }

  function formatMetric(state, unitFallback = "") {
    if (!state || isUnavailable(state)) return "—";
    const unit = String(state.attributes?.unit_of_measurement || unitFallback || "").trim();
    const number = finiteNumber(state.state);
    if (number !== null) return `${Number.isInteger(number) ? number : number.toFixed(1)}${unit}`;
    return String(state.state ?? "—");
  }

  function getState(hass, entityId) {
    const id = String(entityId || "").trim();
    return id ? hass?.states?.[id] || null : null;
  }

  function countMatching(hass, ids, predicate) {
    return (ids || []).filter(entityId => {
      const state = getState(hass, entityId);
      return state && !isUnavailable(state) && predicate(state);
    }).length;
  }

  function hasRoomContent(config) {
    const c = config || {};
    return Boolean(
      c.name || c.temperature || c.humidity || c.presence || c.occupancy || c.climate
      || c.camera || c.media_player || c.power || c.air_quality
      || (c.media_players || []).length
      || (c.media_config?.players || []).length
      || (c.lights || []).length || (c.covers || []).length || (c.locks || []).length
      || (c.vacuums || []).length || (c.fans || []).length
      || (c.humidifiers || []).length || (c.others || []).length
      || (c.doors || []).length || (c.windows || []).length || (c.alerts || []).length,
    );
  }

  function buildRoomSummary(hass, config, comfort = {}) {
    const c = config || {};
    const tempState = getState(hass, c.temperature);
    const humidityState = getState(hass, c.humidity);
    const presenceState = getState(hass, c.presence) || getState(hass, c.occupancy);
    const climateState = getState(hass, c.climate);
    const cameraState = getState(hass, c.camera);
    const mediaState = getState(hass, hubMediaPlayerIds(c)[0]);
    const tempNum = tempState ? finiteNumber(tempState.state) : null;
    const humidityNum = humidityState ? finiteNumber(humidityState.state) : null;
    const lightsOn = countMatching(hass, c.lights, stateIsOn);
    const lightsTotal = (c.lights || []).length;
    const coversOpen = countMatching(hass, c.covers, stateIsOpen);
    const doorsOpen = countMatching(hass, c.doors, stateIsOpen);
    const windowsOpen = countMatching(hass, c.windows, stateIsOpen);
    const locksUnlocked = countMatching(hass, c.locks, stateIsUnlocked);
    const alertsActive = countMatching(hass, c.alerts, stateIsOn);
    const occupied = presenceState && !isUnavailable(presenceState) ? stateIsOn(presenceState) : null;
    const mediaPlaying = mediaState && normalizeTextKey(mediaState.state) === "playing";
    const cameraAvailable = cameraState ? !isUnavailable(cameraState) : false;
    const cameraOffline = cameraState ? isUnavailable(cameraState) : false;
    const hot = tempNum !== null && tempNum >= Number(comfort.hot ?? 27);
    const cold = tempNum !== null && tempNum <= Number(comfort.cold ?? 17);
    const humid = humidityNum !== null && humidityNum >= Number(comfort.humid ?? 70);
    const dry = humidityNum !== null && humidityNum <= Number(comfort.dry ?? 30);
    const comfortable = tempNum !== null && !hot && !cold && !humid && !dry;
    const securityIssue = doorsOpen > 0 || windowsOpen > 0 || locksUnlocked > 0 || alertsActive > 0;

    let climateLabel = "";
    if (climateState && !isUnavailable(climateState)) {
      const mode = normalizeTextKey(climateState.attributes?.hvac_mode || climateState.state);
      const current = finiteNumber(climateState.attributes?.current_temperature);
      const target = finiteNumber(climateState.attributes?.temperature);
      const unit = String(climateState.attributes?.unit_of_measurement || "°").trim();
      climateLabel = mode;
      if (current !== null) {
        climateLabel = target !== null && target !== current ? `${current}${unit} → ${target}${unit}` : `${current}${unit}`;
      }
    }

    return {
      occupied: occupied === true,
      empty: occupied === false,
      comfortable,
      cold,
      hot,
      humid,
      dry,
      lights_on: lightsOn > 0,
      all_lights_off: lightsTotal > 0 && lightsOn === 0,
      lightsOn,
      lightsTotal,
      cover_open: coversOpen > 0,
      cover_closed: (c.covers || []).length > 0 && coversOpen === 0,
      coversOpen,
      media_playing: mediaPlaying,
      camera_available: cameraAvailable,
      camera_offline: cameraOffline,
      security_issue: securityIssue,
      alert: alertsActive > 0,
      unknown: !tempState && !humidityState && !presenceState && lightsTotal === 0,
      temperature: formatMetric(tempState),
      humidity: formatMetric(humidityState, "%"),
      climateLabel,
      doorsOpen,
      windowsOpen,
      locksUnlocked,
      alertsActive,
      mediaState: mediaState ? String(mediaState.state) : "",
    };
  }

  const api = Object.freeze({
    normalizeEntityField,
    hubMediaPlayerIds,
    finiteNumber,
    isUnavailable,
    stateIsOn,
    stateIsOpen,
    stateIsUnlocked,
    formatMetric,
    getState,
    countMatching,
    hasRoomContent,
    buildRoomSummary,
  });
  if (typeof window !== "undefined") {
    window.NodaliaRoomSummaryModel = api;
  }
})();
