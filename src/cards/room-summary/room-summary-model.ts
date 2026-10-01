import { parseFiniteNumericValue } from "../../shared/numeric-values";
import type { HassEntity, HomeAssistant } from "../../core/types/home-assistant";

/** Pure projection input; configuration normalization remains owned by the card. */
export type RoomProjectionConfig = Partial<Record<"name" | "temperature" | "humidity" | "presence" | "occupancy" | "climate" | "camera" | "media_player" | "power" | "air_quality", string>>
  & Partial<Record<"media_players" | "lights" | "covers" | "locks" | "vacuums" | "fans" | "humidifiers" | "others" | "doors" | "windows" | "alerts" | "alarms", readonly string[]>>
  & { media_config?: { players?: readonly { entity?: unknown }[] } };

export function normalizeTextKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeEntityField(value: unknown) {
  if (Array.isArray(value)) {
    const seen = new Set();
    return value
      .map(item => String(item || "").trim())
      .filter(entityId => entityId && !seen.has(entityId) && seen.add(entityId));
  }
  const single = String(value ?? "").trim();
  return single ? [single] : [];
}

export function hubMediaPlayerIds(config?: RoomProjectionConfig | null) {
  const ids: string[] = [];
  const seen = new Set();
  const add = (entityId: unknown) => {
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

export function finiteNumber(value: unknown) {
  return parseFiniteNumericValue(value);
}

export function isUnavailable(state?: HassEntity | null) {
  const key = normalizeTextKey(state?.state);
  return key === "unavailable" || key === "unknown";
}

export function stateIsOn(state?: HassEntity | null) {
  return ["on", "open", "opening", "true", "home", "occupied", "present", "detected", "unlocked", "playing", "paused"]
    .includes(normalizeTextKey(state?.state));
}

export function stateIsOpen(state?: HassEntity | null) {
  return ["on", "open", "opening"].includes(normalizeTextKey(state?.state));
}

export function stateIsUnlocked(state?: HassEntity | null) {
  return ["unlocked", "open"].includes(normalizeTextKey(state?.state));
}

export function stateIsAlarmTriggered(state?: HassEntity | null) {
  return ["triggered", "pending", "arming"].includes(normalizeTextKey(state?.state));
}

export function formatMetric(state?: HassEntity | null, unitFallback = "") {
  if (!state || isUnavailable(state)) return "—";
  const unit = String(state.attributes?.unit_of_measurement || unitFallback || "").trim();
  const number = finiteNumber(state.state);
  if (number !== null) return `${Number.isInteger(number) ? number : number.toFixed(1)}${unit}`;
  const text = String(state.state ?? "");
  return text.trim() ? text : "—";
}

export function getState(hass: Pick<HomeAssistant, "states"> | null | undefined, entityId: unknown) {
  const id = String(entityId || "").trim();
  return id ? hass?.states?.[id] || null : null;
}

export function countMatching(hass: Pick<HomeAssistant, "states"> | null | undefined, ids: readonly string[] | undefined, predicate: (state: HassEntity) => boolean) {
  return (ids || []).filter(entityId => {
    const state = getState(hass, entityId);
    return state && !isUnavailable(state) && predicate(state);
  }).length;
}

export function hasRoomContent(config?: RoomProjectionConfig | null) {
  const c = config || {};
  return Boolean(
    c.name || c.temperature || c.humidity || c.presence || c.occupancy || c.climate
    || c.camera || c.media_player || c.power || c.air_quality
    || (c.media_players || []).length
    || (c.media_config?.players || []).length
    || (c.lights || []).length || (c.covers || []).length || (c.locks || []).length
    || (c.vacuums || []).length || (c.fans || []).length
    || (c.humidifiers || []).length || (c.others || []).length
    || (c.doors || []).length || (c.windows || []).length || (c.alerts || []).length
    || (c.alarms || []).length,
  );
}

export function buildRoomSummary(hass: Pick<HomeAssistant, "states"> | null | undefined, config?: RoomProjectionConfig | null, comfort: Partial<Record<"hot" | "cold" | "humid" | "dry", number>> = {}) {
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
  const alarmsTriggered = countMatching(hass, c.alarms, stateIsAlarmTriggered);
  const occupied = presenceState && !isUnavailable(presenceState) ? stateIsOn(presenceState) : null;
  const mediaPlaying = mediaState && normalizeTextKey(mediaState.state) === "playing";
  const cameraAvailable = cameraState ? !isUnavailable(cameraState) : false;
  const cameraOffline = cameraState ? isUnavailable(cameraState) : false;
  const hot = tempNum !== null && tempNum >= Number(comfort.hot ?? 27);
  const cold = tempNum !== null && tempNum <= Number(comfort.cold ?? 17);
  const humid = humidityNum !== null && humidityNum >= Number(comfort.humid ?? 70);
  const dry = humidityNum !== null && humidityNum <= Number(comfort.dry ?? 30);
  const comfortable = tempNum !== null && !hot && !cold && !humid && !dry;
  const securityIssue = doorsOpen > 0 || windowsOpen > 0 || locksUnlocked > 0 || alertsActive > 0 || alarmsTriggered > 0;

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
    alarmsTriggered,
    mediaState: mediaState ? String(mediaState.state) : "",
  };
}


export const roomSummaryModel = Object.freeze({ normalizeTextKey, normalizeEntityField, hubMediaPlayerIds, finiteNumber, isUnavailable, stateIsOn, stateIsOpen, stateIsUnlocked, stateIsAlarmTriggered, formatMetric, getState, countMatching, hasRoomContent, buildRoomSummary });
