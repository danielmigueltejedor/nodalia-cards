// @ts-nocheck -- SVG layout and editor color helpers stay loosely typed until remaining unknowns are narrowed.
import { NODE_DEFAULTS } from "./power-flow-constants";
import { clamp, isObject, isUnsafeConfigPathKey, mergeConfig, normalizeTextKey } from "./power-flow-runtime";

export function deepCloneNode(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getStubEntityId(hass, domains = [], entities = [], entitiesFallback = []) {
  return window.NodaliaUtils.findStubEntityIds(hass, entities, entitiesFallback, domains, 1)[0] || "";
}


export function compactConfig(value) {
  if (Array.isArray(value)) {
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
  }

  if (isObject(value)) {
    const compacted = {};

    Object.entries(value).forEach(([key, item]) => {
      if (window.NodaliaUtils?.isUnsafeConfigPathKey?.(key)) {
        return;
      }
      const cleaned = compactConfig(item);
      const isEmptyObject = isObject(cleaned) && Object.keys(cleaned).length === 0;

      if (cleaned !== undefined && !isEmptyObject) {
        compacted[key] = cleaned;
      }
    });

    return compacted;
  }

  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  return value;
}







export function moveItem(list, fromIndex, toIndex) {
  if (!Array.isArray(list) || fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return;
  }
  if (fromIndex >= list.length || toIndex >= list.length) {
    return;
  }
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
}

export const POWER_FLOW_ENTITY_DOMAINS = ["sensor", "number", "input_number"];

export function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function formatSvgMotionNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }
  return String(Number(number.toFixed(3)));
}

export const SVG_PATH_TOKEN_RE = /[AaCcHhLlMmQqSsTtVvZz]|[+-]?(?:(?:\d*\.\d+)|(?:\d+\.?))(?:[eE][+-]?\d+)?/g;

export function tokenizeSvgPath(pathD) {
  return String(pathD || "").match(SVG_PATH_TOKEN_RE) || [];
}

export function isSvgPathCommand(token) {
  return /^[AaCcHhLlMmQqSsTtVvZz]$/.test(String(token || ""));
}

export function createSvgTokenReader(tokens) {
  let index = 0;

  return {
    get index() {
      return index;
    },
    set index(value) {
      index = value;
    },
    hasMore() {
      return index < tokens.length;
    },
    hasNumber() {
      return index < tokens.length && !isSvgPathCommand(tokens[index]);
    },
    peek() {
      return tokens[index];
    },
    readCommand() {
      return isSvgPathCommand(tokens[index]) ? tokens[index++] : "";
    },
    readNumber() {
      if (index >= tokens.length || isSvgPathCommand(tokens[index])) {
        return NaN;
      }
      const value = Number(tokens[index]);
      index += 1;
      return value;
    },
    readFlag() {
      if (index >= tokens.length || isSvgPathCommand(tokens[index])) {
        return NaN;
      }
      const raw = String(tokens[index]);
      const first = raw.charAt(0);
      if (first !== "0" && first !== "1") {
        index += 1;
        return NaN;
      }
      if (raw.length > 1) {
        tokens[index] = raw.slice(1);
      } else {
        index += 1;
      }
      return Number(first);
    },
  };
}

export function getSvgPathMotionStart(pathD) {
  const tokens = tokenizeSvgPath(pathD);
  const reader = createSvgTokenReader(tokens);
  const command = reader.readCommand();
  if (String(command).toUpperCase() !== "M") {
    return { x: 0, y: 0 };
  }
  const x = reader.readNumber();
  const y = reader.readNumber();
  return Number.isFinite(x) && Number.isFinite(y)
    ? { x, y }
    : { x: 0, y: 0 };
}

export function pushSvgPoint(output, command, x, y, start, absolute) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }
  output.push(
    command,
    formatSvgMotionNumber(absolute ? x - start.x : x),
    formatSvgMotionNumber(absolute ? y - start.y : y),
  );
  return true;
}

export function getSvgRelativeMotionPath(pathD) {
  const source = String(pathD || "").trim();
  const start = getSvgPathMotionStart(source);
  if (!source) {
    return { start, path: "M 0 0" };
  }

  const tokens = tokenizeSvgPath(source);
  if (!tokens.length) {
    return { start, path: "M 0 0" };
  }

  const reader = createSvgTokenReader(tokens);
  const output = [];
  let command = "";
  let firstMove = true;

  while (reader.hasMore()) {
    if (isSvgPathCommand(reader.peek())) {
      command = reader.readCommand();
    } else if (!command) {
      return { start, path: "M 0 0" };
    }

    const upper = String(command).toUpperCase();
    const absolute = command === upper;

    if (upper === "Z") {
      output.push(command);
      continue;
    }

    if (upper === "M") {
      let firstPair = true;
      while (reader.hasNumber()) {
        const x = reader.readNumber();
        const y = reader.readNumber();
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return { start, path: "M 0 0" };
        }
        if (firstMove) {
          output.push("M", "0", "0");
          firstMove = false;
        } else {
          const outCommand = firstPair ? (absolute ? "M" : "m") : (absolute ? "L" : "l");
          if (!pushSvgPoint(output, outCommand, x, y, start, absolute)) {
            return { start, path: "M 0 0" };
          }
        }
        firstPair = false;
      }
      command = absolute ? "L" : "l";
      continue;
    }

    if (upper === "L" || upper === "T") {
      while (reader.hasNumber()) {
        const x = reader.readNumber();
        const y = reader.readNumber();
        if (!pushSvgPoint(output, command, x, y, start, absolute)) {
          return { start, path: "M 0 0" };
        }
      }
      continue;
    }

    if (upper === "H") {
      while (reader.hasNumber()) {
        const x = reader.readNumber();
        if (!Number.isFinite(x)) {
          return { start, path: "M 0 0" };
        }
        output.push(command, formatSvgMotionNumber(absolute ? x - start.x : x));
      }
      continue;
    }

    if (upper === "V") {
      while (reader.hasNumber()) {
        const y = reader.readNumber();
        if (!Number.isFinite(y)) {
          return { start, path: "M 0 0" };
        }
        output.push(command, formatSvgMotionNumber(absolute ? y - start.y : y));
      }
      continue;
    }

    if (upper === "C") {
      while (reader.hasNumber()) {
        const values = [
          reader.readNumber(),
          reader.readNumber(),
          reader.readNumber(),
          reader.readNumber(),
          reader.readNumber(),
          reader.readNumber(),
        ];
        if (values.some(value => !Number.isFinite(value))) {
          return { start, path: "M 0 0" };
        }
        output.push(command);
        for (let valueIndex = 0; valueIndex < values.length; valueIndex += 2) {
          output.push(
            formatSvgMotionNumber(absolute ? values[valueIndex] - start.x : values[valueIndex]),
            formatSvgMotionNumber(absolute ? values[valueIndex + 1] - start.y : values[valueIndex + 1]),
          );
        }
      }
      continue;
    }

    if (upper === "S" || upper === "Q") {
      while (reader.hasNumber()) {
        const values = [
          reader.readNumber(),
          reader.readNumber(),
          reader.readNumber(),
          reader.readNumber(),
        ];
        if (values.some(value => !Number.isFinite(value))) {
          return { start, path: "M 0 0" };
        }
        output.push(command);
        for (let valueIndex = 0; valueIndex < values.length; valueIndex += 2) {
          output.push(
            formatSvgMotionNumber(absolute ? values[valueIndex] - start.x : values[valueIndex]),
            formatSvgMotionNumber(absolute ? values[valueIndex + 1] - start.y : values[valueIndex + 1]),
          );
        }
      }
      continue;
    }

    if (upper === "A") {
      while (reader.hasNumber()) {
        const rx = reader.readNumber();
        const ry = reader.readNumber();
        const rotation = reader.readNumber();
        const largeArc = reader.readFlag();
        const sweep = reader.readFlag();
        const x = reader.readNumber();
        const y = reader.readNumber();
        if (
          !Number.isFinite(rx) ||
          !Number.isFinite(ry) ||
          !Number.isFinite(rotation) ||
          !Number.isFinite(largeArc) ||
          !Number.isFinite(sweep) ||
          !Number.isFinite(x) ||
          !Number.isFinite(y)
        ) {
          return { start, path: "M 0 0" };
        }
        output.push(
          command,
          formatSvgMotionNumber(rx),
          formatSvgMotionNumber(ry),
          formatSvgMotionNumber(rotation),
          String(largeArc ? 1 : 0),
          String(sweep ? 1 : 0),
          formatSvgMotionNumber(absolute ? x - start.x : x),
          formatSvgMotionNumber(absolute ? y - start.y : y),
        );
      }
      continue;
    }

    if (reader.hasNumber()) {
      return { start, path: "M 0 0" };
    }
  }

  return {
    start,
    path: output.length ? output.join(" ") : "M 0 0",
  };
}



export function resolveEditorColorValue(value) {
  const resolver = window.NodaliaBubbleContrast?.resolveEditorColorValue;
  if (typeof resolver === "function") {
    return resolver(value);
  }
  return String(value ?? "").trim();
}

export function formatEditorHexChannel(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

export function formatEditorColorFromHex(hex, alpha = 1) {
  const normalizedHex = String(hex ?? "").trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(normalizedHex)) {
    return String(hex ?? "");
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  const safeAlpha = clamp(Number(alpha), 0, 1);
  if (safeAlpha >= 0.999) {
    return `#${normalizedHex}`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${Number(safeAlpha.toFixed(2))})`;
}

export function getEditorColorModel(value, fallbackValue = "#71c0ff") {
  const sourceValue = String(value ?? "").trim() || String(fallbackValue ?? "").trim() || "#71c0ff";
  const resolvedValue = resolveEditorColorValue(sourceValue) || resolveEditorColorValue(fallbackValue) || "rgb(113, 192, 255)";
  const channels = resolvedValue.match(/[\d.]+/g) || [];
  const red = clamp(Math.round(Number(channels[0] ?? 113)), 0, 255);
  const green = clamp(Math.round(Number(channels[1] ?? 192)), 0, 255);
  const blue = clamp(Math.round(Number(channels[2] ?? 255)), 0, 255);
  const alpha = channels.length > 3 ? clamp(Number(channels[3]), 0, 1) : 1;
  const hex = `#${formatEditorHexChannel(red)}${formatEditorHexChannel(green)}${formatEditorHexChannel(blue)}`;

  return {
    alpha,
    hex,
    resolved: resolvedValue,
    source: sourceValue,
    value: formatEditorColorFromHex(hex, alpha),
  };
}

export function getEditorColorFallbackValue(field) {
  const normalizedField = String(field ?? "");
  if (normalizedField.endsWith("entities.grid.export_color")) {
    return NODE_DEFAULTS.grid.export_color;
  }

  const nodeColorMatch = normalizedField.match(/entities\.(grid|home|solar|battery|water|gas)\.color$/);

  if (nodeColorMatch) {
    return NODE_DEFAULTS[nodeColorMatch[1]]?.color || "#71c0ff";
  }

  if (normalizedField.endsWith("display_zero_lines.grey_color")) {
    return rgbArrayToColor(DEFAULT_CONFIG.display_zero_lines.grey_color);
  }

  if (normalizedField.endsWith(".color")) {
    return "#71c0ff";
  }

  return "var(--info-color, #71c0ff)";
}



export function parseNumber(value) {
  const numeric = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

export function getHassLocaleTag(hass, language = "auto") {
  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, language);
  return window.NodaliaI18n?.localeTag?.(lang) || hass?.locale?.language || undefined;
}

export function isUnavailableState(state) {
  const key = normalizeTextKey(state?.state);
  return key === "unavailable" || key === "unknown";
}

export function formatRawValue(value, decimals = 0, locale = undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "--";
  }

  return numeric.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDisplayValue(value, unit = "", locale = undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return { value: "--", unit: unit || "" };
  }

  const normalizedUnit = String(unit || "").trim();
  const key = normalizeTextKey(normalizedUnit);
  if (["w", "watt", "watts"].includes(key) && Math.abs(numeric) >= 1000) {
    return {
      value: formatRawValue(numeric / 1000, 2, locale).replace(/[.,]00$/, "").replace(/0$/, ""),
      unit: "kW",
    };
  }

  const decimals = Math.abs(numeric - Math.round(numeric)) < 0.01 ? 0 : Math.abs(numeric) >= 100 ? 0 : Math.abs(numeric) >= 10 ? 1 : 2;
  return {
    value: formatRawValue(numeric, decimals, locale),
    unit: normalizedUnit,
  };
}

export function rgbArrayToColor(value, fallback = [189, 189, 189]) {
  const source = Array.isArray(value) && value.length >= 3 ? value : fallback;
  const [r, g, b] = source.map(item => clamp(Number(item) || 0, 0, 255));
  return `rgb(${r}, ${g}, ${b})`;
}

export function arrayFromMaybe(value) {
  return Array.isArray(value) ? value : [];
}

export function resolveNodeConfig(kind, config) {
  return mergeConfig(NODE_DEFAULTS[kind] || {}, config?.entities?.[kind] || {});
}

/** True if the YAML `entity` field is set (string id or split consumption/production object). */
export function isEntitySourceConfigured(entity) {
  if (entity == null || entity === false) {
    return false;
  }
  if (typeof entity === "string") {
    return entity.trim().length > 0;
  }
  if (isObject(entity)) {
    return Boolean(
      String(entity.entity || "").trim()
      || String(entity.consumption || "").trim()
      || String(entity.production || "").trim(),
    );
  }
  return false;
}

export function resolveIndividualConfigs(config) {
  return sanitizeIndividualEntries(config).filter(item => item.entity);
}

export function sanitizeIndividualEntries(config) {
  return arrayFromMaybe(config?.entities?.individual)
    .filter(isObject)
    .map((item, index) => ({
      entity: String(item.entity || "").trim(),
      name: String(item.name || "").trim(),
      icon: String(item.icon || "mdi:flash").trim() || "mdi:flash",
      color: String(item.color || ["#f29f05", "#42a5f5", "#7fd0c8", "#f56aa0"][index % 4]).trim(),
      secondary_info: isObject(item.secondary_info) ? item.secondary_info : {},
    }));
}

export function getDiagramIndividualCount(config) {
  const configuredCount = resolveIndividualConfigs(config).length;
  if (configuredCount && isHomeDevicePopupEnabled(config)) {
    return 0;
  }
  return configuredCount;
}

export function isHomeDevicePopupEnabled(config) {
  return config?.show_home_device_popup !== false;
}

export function getNodePosition(kind, index = 0, total = 0, hasBottomUtilities = false) {
  return getNodePositionForLayout(kind, index, total, hasBottomUtilities, "full", {});
}

/** Active grid / solar / battery branches so %-layout can spread vertically when several sources exist. */
export function getFlowLayoutFlagsFromConfig(config) {
  const c = config || {};
  const homeConfigured = isEntitySourceConfigured(resolveNodeConfig("home", c)?.entity);
  const activeTopKinds = ["grid", "solar", "battery"].filter(kind => {
    const node = resolveNodeConfig(kind, c);
    if (kind === "grid" && homeConfigured) {
      return true;
    }
    return isEntitySourceConfigured(node?.entity) || Boolean(String(node?.export_entity || "").trim());
  });
  const topCount = activeTopKinds.length;
  const hasGrid = activeTopKinds.includes("grid");
  const hasSolar = activeTopKinds.includes("solar");
  const hasBattery = activeTopKinds.includes("battery");
  const bottomUtilities = [resolveNodeConfig("water", c), resolveNodeConfig("gas", c)].filter(item => item.entity).length;
  const individualCount = getDiagramIndividualCount(c);
  return {
    hasGrid,
    hasSolar,
    hasBattery,
    topCount,
    activeTopKinds,
    bottomUtilities,
    individualCount,
  };
}

export function getLayoutPreset(nodeCounts = {}) {
  const topCount = Number(nodeCounts.top || 0);
  const bottomCount = Number(nodeCounts.bottom || 0);
  const individualCount = Number(nodeCounts.individual || 0);

  /**
   * Always use the same SVG bubble diagram as multi-source layouts.
   * (The old "simple" horizontal rail made a single branch look like a different card.)
   */
  if (bottomCount === 0 && individualCount <= 1 && topCount <= 3) {
    return "compact";
  }

  return "full";
}

export function getNodePositionForLayout(kind, index = 0, total = 0, hasBottomUtilities = false, layoutPreset = "full", flowFlags = {}) {
  const flags = flowFlags && typeof flowFlags === "object" ? flowFlags : {};
  const topN = Number(flags.topCount) || 0;
  const bottomN = Number(flags.bottomUtilities) || 0;
  const bottomSpread = bottomN >= 2 ? 6 : 0;
  const individualCount = Number(flags.individualCount) || 0;

  if (layoutPreset === "simple") {
    if (kind === "home") {
      return { x: 58, y: 42 };
    }
    if (kind === "solar") {
      return { x: 50, y: 18 };
    }
    if (kind === "grid") {
      return { x: 26, y: 42 };
    }
    if (kind === "battery") {
      return { x: 80, y: 42 };
    }
    if (kind === "water") {
      return { x: 39, y: 69 };
    }
    if (kind === "gas") {
      return { x: 61, y: 69 };
    }
    if (kind === "individual") {
      return total <= 1 ? { x: 80, y: 42 } : { x: 50, y: 69 };
    }
  }

  if (kind === "home") {
    return { x: 82, y: 52 };
  }
  if (kind === "solar") {
    const upperBandSolo =
      flags.hasSolar &&
      flags.hasGrid &&
      !flags.hasBattery &&
      bottomN === 0 &&
      individualCount === 0;
    return { x: 50, y: upperBandSolo ? 20.5 : 17 };
  }
  if (kind === "grid") {
    const upperBandSolo =
      flags.hasSolar &&
      flags.hasGrid &&
      !flags.hasBattery &&
      bottomN === 0 &&
      individualCount === 0;
    return { x: upperBandSolo ? 20 : 18, y: 52 };
  }
  if (kind === "battery") {
    return { x: 50, y: 84 };
  }
  if (kind === "water") {
    return { x: 82, y: 84 };
  }
  if (kind === "gas") {
    return { x: 82, y: 17 };
  }
  if (kind === "individual") {
    let y = hasBottomUtilities || topN >= 2 ? 96 : 84;
    y += bottomSpread + Math.min(Math.max(0, individualCount - 1), 4) * 1.5;
    if (total <= 1) {
      return { x: 50, y: Math.min(y, 96) };
    }
    const start = 26;
    const end = 74;
    const step = (end - start) / Math.max(total - 1, 1);
    return {
      x: start + (step * index),
      y: Math.min(y, 96),
    };
  }
  return { x: 50, y: 50 };
}

export function offsetPoint(from, to, distance) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(Math.hypot(dx, dy), 0.0001);
  return {
    x: from.x + ((dx / len) * distance),
    y: from.y + ((dy / len) * distance),
  };
}

/**
 * Orthogonal connector: straight leg + single 90° circular arc + straight leg (no S-shaped cubic).
 * Chooses horizontal-first vs vertical-first from the trimmed chord unless `hints.preferVerticalFirst`
 * forces vertical-first (solar→home / solar→grid, and battery→home / battery↔grid when |dx|≈|dy|).
 */
export function buildFlowPath(from, to, fromRadius = 0, toRadius = 0, hints = {}) {
  const start = offsetPoint(from, to, fromRadius);
  const end = offsetPoint(to, from, toRadius);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const sx = dx >= 0 ? 1 : -1;
  const sy = dy >= 0 ? 1 : -1;

  if (adx < 0.3 && ady < 0.3) {
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }
  if (ady < 1.05 || adx < 1.05) {
    return buildStraightFlowPath(from, to, fromRadius, toRadius);
  }

  let horizFirst = adx >= ady;
  if (hints.preferVerticalFirst === true) {
    horizFirst = false;
  }
  let r = Math.min(adx, ady) * 0.54;
  const capX = Math.max(adx - 0.32, 0);
  const capY = Math.max(ady - 0.32, 0);
  r = Math.min(Math.max(r, 2.55), 14.5, capX, capY);
  if (!Number.isFinite(r) || r < 1.62) {
    return buildStraightFlowPath(from, to, fromRadius, toRadius);
  }

  if (horizFirst) {
    const paX = end.x - sx * r;
    const paY = start.y;
    const pbX = end.x;
    const pbY = start.y + sy * r;
    const sweep = sx * sy > 0 ? 1 : 0;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${paX.toFixed(2)} ${paY.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${sweep} ${pbX.toFixed(2)} ${pbY.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  const paX = start.x;
  const paY = end.y - sy * r;
  const pbX = start.x + sx * r;
  const pbY = end.y;
  const sweep = sx * sy > 0 ? 0 : 1;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${paX.toFixed(2)} ${paY.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${sweep} ${pbX.toFixed(2)} ${pbY.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/** Straight segment between trimmed endpoints (short grid–home or similar runs). */
export function buildStraightFlowPath(from, to, fromRadius = 0, toRadius = 0) {
  const start = offsetPoint(from, to, fromRadius);
  const end = offsetPoint(to, from, toRadius);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}
