// @ts-nocheck -- extracted schedule helpers; public signatures are the typed contract
import {
  CARD_TAG,
  CARD_VERSION,
  SCHEDULE_MIN_BLOCK_MINUTES,
  SCHEDULE_TIMELINE_SNAP_MINUTES,
  SETPOINT_SCHEDULE_DAY_ORDER,
  SETPOINT_SCHEDULE_DAY_TO_JS,
  SETPOINT_SCHEDULE_MINUTES_PER_DAY,
} from "./climate-constants";
import { clamp, isObject } from "./climate-runtime";

export function createSetpointScheduleSlotId() {
  return `slot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function parseScheduleClockMinutes(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) {
    return null;
  }

  return (hours * 60) + minutes;
}

export function formatScheduleClockMinutes(totalMinutes: unknown) {
  const safe = clamp(Math.round(Number(totalMinutes) || 0), 0, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function normalizeSetpointScheduleDay(value: unknown) {
  const key = String(value ?? "").trim().toLowerCase();
  if (SETPOINT_SCHEDULE_DAY_ORDER.includes(key)) {
    return key;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const byIndex = SETPOINT_SCHEDULE_DAY_ORDER[numeric];
    if (byIndex) {
      return byIndex;
    }
    const jsMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    if (numeric >= 0 && numeric <= 6 && jsMap[numeric]) {
      return jsMap[numeric];
    }
  }

  return "mon";
}

export function normalizeSetpointScheduleSlot(rawSlot: unknown, index: unknown =  0) {
  const source = isObject(rawSlot) ? rawSlot : {};
  const startMinutes = parseScheduleClockMinutes(source.start) ?? (7 * 60);
  let endMinutes = parseScheduleClockMinutes(source.end) ?? (22 * 60);
  if (endMinutes <= startMinutes) {
    endMinutes = Math.min(startMinutes + 60, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1);
  }

  const temperature = Number(source.temperature);
  const normalized = {
    id: String(source.id || "").trim() || createSetpointScheduleSlotId(),
    day: normalizeSetpointScheduleDay(source.day ?? SETPOINT_SCHEDULE_DAY_ORDER[index % 7]),
    start: formatScheduleClockMinutes(startMinutes),
    end: formatScheduleClockMinutes(endMinutes),
    temperature: Number.isFinite(temperature) ? temperature : 21,
    enabled: source.enabled !== false,
  };
  const hvacMode = String(source.hvac_mode || "").trim().toLowerCase();
  if (["off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only"].includes(hvacMode)) {
    normalized.hvac_mode = hvacMode;
  }
  ["fan_mode", "preset_mode"].forEach(key => {
    const value = String(source[key] || "").trim();
    if (value) {
      normalized[key] = value;
    }
  });
  const targetLow = Number(source.target_temp_low);
  const targetHigh = Number(source.target_temp_high);
  if (Number.isFinite(targetLow) && Number.isFinite(targetHigh) && targetLow <= targetHigh) {
    normalized.target_temp_low = targetLow;
    normalized.target_temp_high = targetHigh;
  }
  return normalized;
}

export function normalizeSetpointScheduleConfig(rawSchedule: unknown) {
  const schedule = isObject(rawSchedule) ? rawSchedule : {};
  const slots = Array.isArray(schedule.slots)
    ? schedule.slots.map((slot, index) => normalizeSetpointScheduleSlot(slot, index))
    : [];

  return {
    enabled: schedule.enabled !== false,
    week_starts_on: schedule.week_starts_on === "sunday" ? "sunday" : "monday",
    slots,
  };
}

export const SETPOINT_SCHEDULE_STORAGE_VERSION = 1;
export const SETPOINT_SCHEDULE_STORAGE_VERSION_PACKED = 2;
export const SETPOINT_SCHEDULE_STORAGE_VERSION_BINARY = 3;
export const SETPOINT_SCHEDULE_INPUT_TEXT_MAX = 255;
/** Times in storage are quantized to this many minutes (matches agenda snap). */
export const SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM = SCHEDULE_TIMELINE_SNAP_MINUTES;

export function buildCompactSetpointScheduleSlotId(dayIdx: unknown, startMins: unknown, endMins: unknown) {
  return `c${dayIdx}_${startMins}_${endMins}`;
}

export function quantizeSetpointScheduleStorageMinutes(minutes: unknown) {
  return clamp(
    Math.round(Number(minutes) / SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM) * SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM,
    0,
    SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1,
  );
}

export function packSetpointScheduleSlot(dayIdx: unknown, startMins: unknown, endMins: unknown, temperature: unknown, enabled: unknown =  true) {
  const startQ = clamp(Math.floor(quantizeSetpointScheduleStorageMinutes(startMins) / SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM), 0, 287);
  let endQ = clamp(Math.floor(quantizeSetpointScheduleStorageMinutes(endMins) / SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM), 0, 287);
  if (endQ <= startQ) {
    endQ = Math.min(startQ + Math.ceil(SCHEDULE_MIN_BLOCK_MINUTES / SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM), 287);
  }

  const day = clamp(Number(dayIdx), 0, 6);
  const snappedTemp = Math.round(Number(temperature) * 4) / 4;
  const tempInteger = Math.floor(snappedTemp);
  const fractionQ = Math.round((snappedTemp - tempInteger) * 4) & 3;
  const temp = clamp(tempInteger - 5, 0, 255);
  const disabled = enabled === false ? 1 : 0;

  return (
    startQ |
    (endQ << 9) |
    (day << 18) |
    (disabled << 21) |
    (temp << 22) |
    (fractionQ << 30)
  ) >>> 0;
}

export function unpackSetpointSchedulePacked(packedValue: unknown) {
  const packed = Number(packedValue) >>> 0;
  const startQ = packed & 0x1FF;
  const endQ = (packed >> 9) & 0x1FF;
  const dayIdx = (packed >> 18) & 7;
  const disabled = (packed >> 21) & 1;
  const temperatureInt = ((packed >> 22) & 0xFF) + 5;
  const fractionQ = (packed >>> 30) & 3;
  const temperature = temperatureInt + (fractionQ / 4);
  const startMins = startQ * SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM;
  let endMins = endQ * SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM;
  if (endMins <= startMins) {
    endMins = Math.min(startMins + SCHEDULE_MIN_BLOCK_MINUTES, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1);
  }

  return {
    id: buildCompactSetpointScheduleSlotId(dayIdx, startMins, endMins),
    day: SETPOINT_SCHEDULE_DAY_ORDER[dayIdx] || "mon",
    start: formatScheduleClockMinutes(startMins),
    end: formatScheduleClockMinutes(endMins),
    temperature,
    enabled: disabled !== 1,
  };
}

export function encodeSetpointScheduleBinaryBase64(slots: unknown) {
  const bytes = new Uint8Array(slots.length * 4);
  slots.forEach((slot, index) => {
    const dayIdx = Math.max(0, SETPOINT_SCHEDULE_DAY_ORDER.indexOf(slot.day));
    const startMins = parseScheduleClockMinutes(slot.start) ?? 0;
    const endMins = parseScheduleClockMinutes(slot.end) ?? startMins + 60;
    const packed = packSetpointScheduleSlot(dayIdx, startMins, endMins, slot.temperature, slot.enabled);
    const offset = index * 4;
    bytes[offset] = (packed >>> 24) & 0xFF;
    bytes[offset + 1] = (packed >>> 16) & 0xFF;
    bytes[offset + 2] = (packed >>> 8) & 0xFF;
    bytes[offset + 3] = packed & 0xFF;
  });

  if (typeof btoa === "function") {
    let binary = "";
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  return "";
}

export function decodeSetpointScheduleBinaryBase64(base64Value: unknown, slotCountHint: unknown =  null) {
  const raw = String(base64Value ?? "").trim();
  if (!raw) {
    return [];
  }

  let bytes;
  if (typeof atob === "function") {
    const binary = atob(raw);
    bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  } else {
    return [];
  }

  const slotCount = Number.isFinite(Number(slotCountHint)) && Number(slotCountHint) > 0
    ? Number(slotCountHint)
    : Math.floor(bytes.length / 4);

  const slots = [];
  for (let index = 0; index < slotCount; index += 1) {
    const offset = index * 4;
    if (offset + 3 >= bytes.length) {
      break;
    }
    const packed = (
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]
    ) >>> 0;
    slots.push(unpackSetpointSchedulePacked(packed));
  }

  return slots;
}

export function decodeSetpointScheduleStorageState(rawState: unknown): import("./climate-types").ClimateSetpointSchedule {
  const trimmed = String(rawState ?? "").trim();
  if (!trimmed || trimmed === "unknown" || trimmed === "unavailable") {
    return normalizeSetpointScheduleConfig({ enabled: true, slots: [] });
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!isObject(parsed)) {
      return normalizeSetpointScheduleConfig({ enabled: true, slots: [] });
    }

    if (Number(parsed.v) === SETPOINT_SCHEDULE_STORAGE_VERSION_BINARY && typeof parsed.b === "string") {
      const enabled = parsed.e !== 0;
      const slots = decodeSetpointScheduleBinaryBase64(parsed.b, parsed.n);
      return normalizeSetpointScheduleConfig({ enabled, slots });
    }

    if (Number(parsed.v) === SETPOINT_SCHEDULE_STORAGE_VERSION_PACKED && Array.isArray(parsed.s)) {
      const enabled = parsed.e !== 0;
      const slots = parsed.s
        .map(value => unpackSetpointSchedulePacked(value))
        .filter(Boolean);
      return normalizeSetpointScheduleConfig({ enabled, slots });
    }

    if (Number(parsed.v) === SETPOINT_SCHEDULE_STORAGE_VERSION && Array.isArray(parsed.s)) {
      const enabled = parsed.e !== 0;
      const slots = parsed.s
        .map((row, index) => {
          if (!Array.isArray(row) || row.length < 4) {
            return null;
          }

          const dayIdx = clamp(Number(row[0]), 0, SETPOINT_SCHEDULE_DAY_ORDER.length - 1);
          const startMins = clamp(Number(row[1]), 0, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1);
          let endMins = clamp(Number(row[2]), 0, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1);
          const temperature = Number(row[3]);
          const slotEnabled = row[4] === undefined || Number(row[4]) !== 0;

          if (endMins <= startMins) {
            endMins = Math.min(startMins + 60, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1);
          }

          return {
            id: buildCompactSetpointScheduleSlotId(dayIdx, startMins, endMins),
            day: SETPOINT_SCHEDULE_DAY_ORDER[dayIdx] || SETPOINT_SCHEDULE_DAY_ORDER[index % 7],
            start: formatScheduleClockMinutes(startMins),
            end: formatScheduleClockMinutes(endMins),
            temperature: Number.isFinite(temperature) ? temperature : 21,
            enabled: slotEnabled,
          };
        })
        .filter(Boolean);

      return normalizeSetpointScheduleConfig({ enabled, slots });
    }

    return normalizeSetpointScheduleConfig(parsed);
  } catch (_error) {
    return normalizeSetpointScheduleConfig({ enabled: true, slots: [] });
  }
}

export function encodeSetpointScheduleStorageState(schedule: unknown): string {
  const normalized = normalizeSetpointScheduleConfig(schedule);
  const pathBCandidates = [];
  const overflowCandidates = [];

  if (normalized.slots.length > 0) {
    const packed = normalized.slots.map(slot => {
      const dayIdx = Math.max(0, SETPOINT_SCHEDULE_DAY_ORDER.indexOf(slot.day));
      const startMins = parseScheduleClockMinutes(slot.start) ?? 0;
      const endMins = parseScheduleClockMinutes(slot.end) ?? startMins + 60;
      return packSetpointScheduleSlot(dayIdx, startMins, endMins, slot.temperature, slot.enabled);
    });

    const binaryPayload = {
      v: SETPOINT_SCHEDULE_STORAGE_VERSION_BINARY,
      b: encodeSetpointScheduleBinaryBase64(normalized.slots),
      n: normalized.slots.length,
    };
    if (normalized.enabled === false) {
      binaryPayload.e = 0;
    }
    overflowCandidates.push(JSON.stringify(binaryPayload));

    const packedPayload = {
      v: SETPOINT_SCHEDULE_STORAGE_VERSION_PACKED,
      s: packed,
    };
    if (normalized.enabled === false) {
      packedPayload.e = 0;
    }
    pathBCandidates.push(JSON.stringify(packedPayload));
  }

  const rows = normalized.slots.map(slot => {
    const dayIdx = Math.max(0, SETPOINT_SCHEDULE_DAY_ORDER.indexOf(slot.day));
    const startMins = parseScheduleClockMinutes(slot.start) ?? 0;
    const endMins = parseScheduleClockMinutes(slot.end) ?? startMins + 60;
    const row = [dayIdx, startMins, endMins, slot.temperature];
    if (slot.enabled === false) {
      row.push(0);
    }
    return row;
  });

  const legacyCompactPayload = {
    v: SETPOINT_SCHEDULE_STORAGE_VERSION,
    s: rows,
  };
  if (normalized.enabled === false) {
    legacyCompactPayload.e = 0;
  }
  pathBCandidates.push(JSON.stringify(legacyCompactPayload));

  if (!normalized.slots.length) {
    const emptyPayload = { v: SETPOINT_SCHEDULE_STORAGE_VERSION, s: [] };
    if (normalized.enabled === false) {
      emptyPayload.e = 0;
    }
    pathBCandidates.push(JSON.stringify(emptyPayload));
  }

  const pathBWithinLimit = pathBCandidates.filter(candidate => candidate.length <= SETPOINT_SCHEDULE_INPUT_TEXT_MAX);
  if (pathBWithinLimit.length) {
    return pathBWithinLimit.sort((left, right) => left.length - right.length)[0];
  }

  const withinLimit = [...overflowCandidates, ...pathBCandidates]
    .filter(candidate => candidate.length <= SETPOINT_SCHEDULE_INPUT_TEXT_MAX);
  if (withinLimit.length) {
    return withinLimit.sort((left, right) => left.length - right.length)[0];
  }

  return [...overflowCandidates, ...pathBCandidates].sort((left, right) => left.length - right.length)[0];
}

export function isSetpointScheduleStorageStateWithinLimit(storageState: unknown): boolean {
  return String(storageState ?? "").length <= SETPOINT_SCHEDULE_INPUT_TEXT_MAX;
}

export function normalizeSetpointScheduleWeekStartsOn(value: unknown): "monday" | "sunday" {
  const key = String(value ?? "monday").trim().toLowerCase();
  return key === "sunday" ? "sunday" : "monday";
}

export function getSetpointScheduleDayOrder(weekStartsOn: unknown) {
  if (normalizeSetpointScheduleWeekStartsOn(weekStartsOn) === "sunday") {
    return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  }
  return [...SETPOINT_SCHEDULE_DAY_ORDER];
}

export function snapScheduleTimelineMinutes(minutes: unknown) {
  return clamp(
    Math.round(Number(minutes) / SCHEDULE_TIMELINE_SNAP_MINUTES) * SCHEDULE_TIMELINE_SNAP_MINUTES,
    0,
    SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1,
  );
}

export function getSetpointScheduleBlockLayout(slot: unknown) {
  const start = parseScheduleClockMinutes(slot.start) ?? 0;
  let end = parseScheduleClockMinutes(slot.end) ?? start + 60;
  if (end <= start) {
    end = Math.min(start + SCHEDULE_MIN_BLOCK_MINUTES, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1);
  }
  const span = Math.max(end - start, SCHEDULE_MIN_BLOCK_MINUTES);
  const left = (start / SETPOINT_SCHEDULE_MINUTES_PER_DAY) * 100;
  const width = (span / SETPOINT_SCHEDULE_MINUTES_PER_DAY) * 100;
  return { start, end, left, width };
}

export function findScheduleGapForDay(slots: unknown, day: unknown) {
  const daySlots = (Array.isArray(slots) ? slots : [])
    .filter(slot => slot.day === day && slot.enabled !== false)
    .map(slot => {
      const start = parseScheduleClockMinutes(slot.start) ?? 0;
      const end = parseScheduleClockMinutes(slot.end) ?? start + 60;
      return { start, end: Math.max(end, start + SCHEDULE_MIN_BLOCK_MINUTES) };
    })
    .sort((left, right) => left.start - right.start);

  if (!daySlots.length) {
    return {
      start: 0,
      end: SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1,
    };
  }

  let best = { start: 0, end: 0, size: 0 };
  let cursor = 0;
  daySlots.forEach(slot => {
    const gapSize = slot.start - cursor;
    if (gapSize > best.size) {
      best = { start: cursor, end: slot.start, size: gapSize };
    }
    cursor = Math.max(cursor, slot.end);
  });

  const tailSize = SETPOINT_SCHEDULE_MINUTES_PER_DAY - cursor;
  if (tailSize > best.size) {
    best = { start: cursor, end: SETPOINT_SCHEDULE_MINUTES_PER_DAY, size: tailSize };
  }

  if (best.size >= SCHEDULE_MIN_BLOCK_MINUTES) {
    return {
      start: best.start,
      end: Math.max(best.start + SCHEDULE_MIN_BLOCK_MINUTES, best.end - 1),
    };
  }

  const last = daySlots[daySlots.length - 1];
  const start = clamp(last.end, 0, SETPOINT_SCHEDULE_MINUTES_PER_DAY - SCHEDULE_MIN_BLOCK_MINUTES);
  return {
    start,
    end: Math.min(start + 60, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1),
  };
}

export function scheduleMinutesFromTrackClientX(track: unknown, clientX: unknown) {
  const rect = track.getBoundingClientRect();
  if (!rect.width) {
    return 0;
  }
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  return snapScheduleTimelineMinutes(ratio * SETPOINT_SCHEDULE_MINUTES_PER_DAY);
}

export function getActiveSetpointScheduleSlot(slots, date = new Date()) {
  if (!Array.isArray(slots) || !slots.length) {
    return null;
  }

  const jsDay = date.getDay();
  const minutesNow = (date.getHours() * 60) + date.getMinutes();

  let winner = null;
  let winnerStart = -1;

  slots.forEach(slot => {
    if (slot?.enabled === false) {
      return;
    }
    if (SETPOINT_SCHEDULE_DAY_TO_JS[slot.day] !== jsDay) {
      return;
    }

    const start = parseScheduleClockMinutes(slot.start);
    const end = parseScheduleClockMinutes(slot.end);
    if (start === null || end === null) {
      return;
    }

    const inRange = end > start
      ? minutesNow >= start && minutesNow < end
      : minutesNow >= start || minutesNow < end;
    if (!inRange) {
      return;
    }

    if (start > winnerStart) {
      winner = slot;
      winnerStart = start;
    }
  });

  return winner;
}

export const SETPOINT_SCHEDULE_HA_WEEKDAY = {
  mon: ["mon"],
  tue: ["tue"],
  wed: ["wed"],
  thu: ["thu"],
  fri: ["fri"],
  sat: ["sat"],
  sun: ["sun"],
};

export function getClimateScheduleStorageEntityId(entityId: unknown, configuredHelper: unknown =  "") {
  const custom = String(configuredHelper ?? "").trim();
  if (custom) {
    return custom;
  }

  const slug = String(entityId ?? "")
    .trim()
    .replace(/^climate\./, "")
    .replace(/[^a-z0-9_]+/gi, "_")
    .replace(/^_+|_+$/g, "");
  return slug ? `input_text.nodalia_climate_schedule_${slug}` : "";
}

export function buildClimateSetpointScheduleAutomationId(entityId: unknown, slotId: unknown) {
  const base = `nodalia_climate_${String(entityId ?? "").replace(".", "_")}_${String(slotId ?? "")}`;
  return base.replace(/[^a-z0-9_]/gi, "_").slice(0, 120);
}

export function buildClimateSetpointScheduleAutomationSpecs(entityId: unknown, schedule: unknown, friendlyName: unknown =  "") {
  if (!String(entityId ?? "").trim() || schedule?.enabled === false) {
    return [];
  }

  const label = String(friendlyName || entityId).trim();
  return (Array.isArray(schedule?.slots) ? schedule.slots : [])
    .filter(slot => slot?.enabled !== false)
    .map(slot => {
      const start = String(slot.start || "08:00").trim();
      const at = /^\d{2}:\d{2}:\d{2}$/.test(start) ? start : `${start}:00`;
      const weekday = SETPOINT_SCHEDULE_HA_WEEKDAY[slot.day] || [slot.day];
      return {
        id: buildClimateSetpointScheduleAutomationId(entityId, slot.id),
        alias: `Nodalia | ${label} | ${slot.day} ${slot.start}-${slot.end}`,
        description: "Managed by Nodalia Climate Card setpoint schedule webhook.",
        mode: "single",
        trigger: [{ platform: "time", at }],
        condition: [{ condition: "time", weekday }],
        action: [{
          action: "climate.set_temperature",
          target: { entity_id: entityId },
          data: { temperature: slot.temperature },
        }],
      };
    });
}

export function yamlQuote(value: unknown) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

export function buildClimateSetpointScheduleAutomationsYaml(entityId: unknown, schedule: unknown, friendlyName: unknown =  "") {
  const specs = buildClimateSetpointScheduleAutomationSpecs(entityId, schedule, friendlyName);
  if (!specs.length) {
    return "";
  }

  return specs
    .map(spec => {
      const triggerAt = spec.trigger?.[0]?.at || "08:00:00";
      const weekday = spec.condition?.[0]?.weekday || ["mon"];
      const temperature = spec.action?.[0]?.data?.temperature ?? 21;
      const weekdayYaml = weekday.map(day => `        - ${day}`).join("\n");
      return `- id: ${yamlQuote(spec.id)}
  alias: ${yamlQuote(spec.alias)}
  description: ${yamlQuote(spec.description)}
  mode: single
  trigger:
    - platform: time
      at: ${yamlQuote(triggerAt)}
  condition:
    - condition: time
      weekday:
${weekdayYaml}
  action:
    - action: climate.set_temperature
      target:
        entity_id: ${yamlQuote(entityId)}
      data:
        temperature: ${temperature}`;
    })
    .join("\n\n");
}

export function buildClimateSetpointScheduleWebhookBody(options: unknown =  {}) {
  const entityId = String(options.entityId ?? "").trim();
  const schedule = normalizeSetpointScheduleConfig(options.schedule);
  const storageEntityId = String(options.storageEntityId ?? "").trim();
  const friendlyName = String(options.friendlyName ?? "").trim();
  const automationSpecs = buildClimateSetpointScheduleAutomationSpecs(entityId, schedule, friendlyName);
  const storageState = encodeSetpointScheduleStorageState(schedule);
  const automationYamlBundle = buildClimateSetpointScheduleAutomationsYaml(entityId, schedule, friendlyName);

  return {
    type: "climate_setpoint_schedule",
    card: CARD_TAG,
    card_version: options.cardVersion || CARD_VERSION,
    entity_id: entityId,
    friendly_name: friendlyName,
    schedule,
    storage_entity_id: storageEntityId,
    storage_state: storageState,
    automation_specs: automationSpecs,
    automation_yaml_bundle: automationYamlBundle,
    automation_id_prefix: entityId ? `nodalia_climate_${entityId.replace(".", "_")}_` : "nodalia_climate_",
    ha_action: storageEntityId
      ? {
        action: "input_text.set_value",
        target: { entity_id: storageEntityId },
        data: { value: storageState },
      }
      : null,
  };
}
