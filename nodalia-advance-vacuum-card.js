const CARD_TAG = "nodalia-advance-vacuum-card";
const EDITOR_TAG = "nodalia-advance-vacuum-card-editor";
const CARD_VERSION = "0.12.4";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};

const MODE_LABELS = {
  all: "Todo",
  rooms: "Habitaciones",
  zone: "Zona",
  goto: "Ir a punto",
};

const PANEL_MODE_PRESETS = [
  { id: "smart", label: "Inteligente", icon: "mdi:brain" },
  { id: "vacuum_mop", label: "Aspirado y fregado", icon: "mdi:robot-vacuum-variant" },
  { id: "vacuum", label: "Aspirado", icon: "mdi:vacuum-outline" },
  { id: "mop", label: "Fregado", icon: "mdi:water" },
  { id: "custom", label: "Personalizado", icon: "mdi:tune-variant" },
];

const DOCK_PANEL_SECTIONS = [
  { id: "control", label: "Control de base", icon: "mdi:home-import-outline" },
  { id: "settings", label: "Ajuste de base de carga", icon: "mdi:cog-outline" },
];

const DOCK_SETTING_DEFINITIONS = [
  {
    id: "mop_wash_frequency",
    label: "Frecuencia de lavado de la mopa",
    entity_ids: ["input_select.frecuencia_lavado_mopa"],
    patterns: ["mop_wash_frequency", "wash_frequency", "washing_frequency", "frecuencia_lavado", "mop_wash"],
  },
  {
    id: "mop_mode",
    label: "Modo de fregado",
    entity_ids: ["input_select.modo_de_fregado"],
    patterns: ["modo_de_fregado", "mop_mode", "wash_mode", "dock_mop_mode", "washing_mode"],
  },
  {
    id: "auto_empty_frequency",
    label: "Frecuencia de vaciado automático",
    patterns: ["auto_empty_frequency", "empty_frequency", "dust_collection_frequency", "frecuencia_vaciado", "frecuencia_vaciado_automatico"],
  },
  {
    id: "empty_mode",
    label: "Modo de vaciado",
    entity_ids: ["input_select.modo_de_vaciado"],
    patterns: ["empty_mode", "dock_dust_collection_mode", "dust_collection_mode", "modo_vaciado"],
  },
  {
    id: "drying_duration",
    label: "Duración de secado",
    entity_ids: ["input_select.duracion_del_secado_de_la_mopa"],
    patterns: ["drying_duration", "dry_duration", "mop_dry_duration", "duracion_secado", "drying_time", "duracion_del_secado_de_la_mopa"],
  },
];

const DOCK_CONTROL_DEFINITIONS = [
  {
    id: "empty",
    label: "Vaciar depósito",
    active_label: "Parar vaciado",
    icon: "mdi:delete-empty-outline",
    active_icon: "mdi:stop-circle-outline",
    entity_ids: ["input_boolean.vaciar_deposito"],
    start_patterns: [
      "start_emptying",
      "start_empty",
      "start_dust_collection",
      "dust_collection",
      "collect_dust",
      "dock_empty",
      "auto_empty",
      "empty_dock",
    ],
    stop_patterns: [
      "stop_emptying",
      "stop_empty",
      "stop_dust_collection",
      "stop_collect_dust",
      "end_emptying",
    ],
  },
  {
    id: "wash",
    label: "Lavar el paño",
    active_label: "Parar lavado de paño",
    icon: "mdi:washing-machine",
    active_icon: "mdi:stop-circle-outline",
    entity_ids: ["input_boolean.lavar_mopa"],
    start_patterns: [
      "start_wash",
      "start_washing",
      "start_wash_mop",
      "wash_mop",
      "mop_wash",
      "clean_mop",
      "clean_mopping_pad",
      "self_clean",
    ],
    stop_patterns: [
      "stop_wash",
      "stop_washing",
      "stop_wash_mop",
      "stop_mop_wash",
      "stop_clean_mop",
      "stop_self_clean",
    ],
  },
  {
    id: "dry",
    label: "Secar la mopa",
    active_label: "Detener el secado",
    icon: "mdi:hair-dryer",
    active_icon: "mdi:stop-circle-outline",
    entity_ids: ["input_boolean.secado_de_mopa"],
    start_patterns: [
      "start_dry",
      "start_drying",
      "start_dry_mop",
      "mop_dry",
      "dry_mop",
      "air_dry",
      "drying",
    ],
    stop_patterns: [
      "stop_dry",
      "stop_drying",
      "stop_dry_mop",
      "stop_mop_dry",
      "stop_air_dry",
    ],
  },
];

const SUCTION_MODE_PATTERNS = [
  "quiet",
  "silent",
  "balanced",
  "standard",
  "normal",
  "turbo",
  "max",
  "strong",
  "gentle",
  "suction",
  "vacuum",
  "carpet",
];

const MOP_MODE_PATTERNS = [
  "mop",
  "water",
  "scrub",
  "wet",
  "off",
  "deep",
  "soak",
  "rinse",
];

const SHARED_SMART_MODE_PATTERNS = [
  "smart",
  "intelligent",
  "inteligente",
];

const VACUUM_MODE_LABELS = {
  quiet: "Silencioso",
  silent: "Silencioso",
  balanced: "Equilibrado",
  standard: "Estándar",
  normal: "Normal",
  turbo: "Turbo",
  max: "Max",
  maxplus: "Max+",
  max_plus: "Max+",
  gentle: "Suave",
  strong: "Fuerte",
  smart: "Inteligente",
  smartmode: "Inteligente",
  smart_mode: "Inteligente",
  intelligent: "Inteligente",
  custom: "Personalizado",
  custommode: "Personalizado",
  custom_mode: "Personalizado",
  custom_water_flow: "Caudal de agua personalizado",
  custom_watter_flow: "Caudal de agua personalizado",
  off: "Sin fregado",
  low: "Baja",
  medium: "Media",
  high: "Alta",
  intense: "Intenso",
  deep: "Profundo",
  deep_plus: "Profundo+",
  deepplus: "Profundo+",
  fast: "Rápido",
  rapido: "Rápido",
};

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  vacuum_platform: "Roborock",
  map_source: {
    camera: "",
    image: "",
  },
  calibration_source: {
    camera: true,
    entity: "",
    calibration_points: [],
  },
  map_locked: true,
  two_finger_pan: false,
  language: "es",
  show_state_chip: true,
  show_battery_chip: true,
  show_room_labels: true,
  show_room_markers: true,
  show_header_icons: true,
  show_return_to_base: true,
  show_stop: true,
  show_locate: true,
  show_all_mode: true,
  allow_segment_mode: true,
  allow_zone_mode: true,
  allow_goto_mode: true,
  max_zone_selections: 5,
  max_repeats: 3,
  suction_select_entity: "",
  mop_select_entity: "",
  mop_mode_select_entity: "",
  custom_menu: {
    label: "Base",
    icon: "mdi:home-import-outline",
    items: [],
  },
  room_segments: [],
  goto_points: [],
  predefined_zones: [],
  icons: [],
  map_modes: [],
  haptics: {
    enabled: false,
    style: "selection",
    fallback_vibrate: false,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "32px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "16px",
      gap: "14px",
    },
    icon: {
      size: "64px",
      background: "rgba(255, 255, 255, 0.06)",
      color: "var(--primary-text-color)",
      active_color: "#61c97a",
      washing_color: "#5aa7ff",
      drying_color: "#f1c24c",
      emptying_color: "#9b6b4a",
      returning_color: "#f6b73c",
      error_color: "var(--error-color, #ff6b6b)",
      docked_color: "rgba(255, 255, 255, 0.56)",
    },
    chip_height: "26px",
    chip_font_size: "11px",
    chip_padding: "0 10px",
    title_size: "16px",
    map: {
      radius: "26px",
      marker_size: "34px",
      label_size: "12px",
      room_color: "rgba(97, 201, 122, 0.18)",
      room_border: "rgba(97, 201, 122, 0.55)",
      zone_color: "rgba(90, 167, 255, 0.18)",
      zone_border: "rgba(90, 167, 255, 0.72)",
      goto_color: "#f6b73c",
    },
    control: {
      size: "42px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(var(--rgb-primary-color), 0.18)",
    },
  },
};

const STUB_CONFIG = {
  entity: "vacuum.roborock_qrevo_s",
  name: "Roborock Qrevo S",
  vacuum_platform: "Roborock",
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function mergeConfig(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override.map(item => deepClone(item)) : deepClone(base);
  }

  if (!isObject(base)) {
    return override === undefined ? base : override;
  }

  const result = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(override || {})]);

  keys.forEach(key => {
    const baseValue = base[key];
    const overrideValue = override ? override[key] : undefined;

    if (overrideValue === undefined) {
      result[key] = deepClone(baseValue);
      return;
    }

    if (Array.isArray(overrideValue)) {
      result[key] = deepClone(overrideValue);
      return;
    }

    if (isObject(baseValue) && isObject(overrideValue)) {
      result[key] = mergeConfig(baseValue, overrideValue);
      return;
    }

    result[key] = overrideValue;
  });

  return result;
}

function compactConfig(value) {
  if (Array.isArray(value)) {
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
  }

  if (isObject(value)) {
    const compacted = {};
    Object.entries(value).forEach(([key, item]) => {
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

function setByPath(target, path, value) {
  const parts = path.split(".");
  let cursor = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(cursor[key]) && !Array.isArray(cursor[key])) {
      cursor[key] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    }
    cursor = cursor[key];
  }

  cursor[parts[parts.length - 1]] = value;
}

function deleteByPath(target, path) {
  const parts = path.split(".");
  let cursor = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(cursor[key]) && !Array.isArray(cursor[key])) {
      return;
    }
    cursor = cursor[key];
  }

  delete cursor[parts[parts.length - 1]];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeTextKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fireEvent(node, type, detail, options) {
  const event = new CustomEvent(type, {
    bubbles: options?.bubbles ?? true,
    cancelable: Boolean(options?.cancelable),
    composed: options?.composed ?? true,
    detail,
  });
  node.dispatchEvent(event);
  return event;
}

function isUnavailableState(state) {
  const key = normalizeTextKey(state?.state);
  return ["unavailable", "unknown", "none"].includes(key);
}

function parseNumber(value) {
  const numeric = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseInteger(value, fallback = null) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parsePoint(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  if (isObject(value)) {
    const x = Number(value.x);
    const y = Number(value.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  return null;
}

function parseRectangleLike(value) {
  if (!isObject(value)) {
    return [];
  }

  const hasLegacyBounds = [value.x0, value.y0, value.x1, value.y1].every(item => Number.isFinite(Number(item)));
  const x1 = Number(hasLegacyBounds ? value.x0 : (value.x1 ?? value.left ?? value.min_x ?? value.start_x));
  const y1 = Number(hasLegacyBounds ? value.y0 : (value.y1 ?? value.top ?? value.min_y ?? value.start_y));
  const x2 = Number(hasLegacyBounds ? value.x1 : (value.x2 ?? value.right ?? value.max_x ?? value.end_x));
  const y2 = Number(hasLegacyBounds ? value.y1 : (value.y2 ?? value.bottom ?? value.max_y ?? value.end_y));
  if (![x1, y1, x2, y2].every(Number.isFinite)) {
    return [];
  }

  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

function parseOutline(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(point => parsePoint(point))
    .filter(Boolean);
}

function isFiniteScalar(value) {
  return Number.isFinite(Number(value));
}

function isPointLike(value) {
  return Boolean(parsePoint(value));
}

function isRectangleOutline(value) {
  return Array.isArray(value) && value.length === 4 && value.every(isFiniteScalar);
}

function parsePolygon(value) {
  if (isObject(value)) {
    if (Array.isArray(value.points)) {
      return parsePolygon(value.points);
    }
    if (Array.isArray(value.outline)) {
      return parsePolygon(value.outline);
    }
    return parseRectangleLike(value);
  }

  if (!Array.isArray(value)) {
    return [];
  }

  if (isRectangleOutline(value)) {
    const [x1, y1, x2, y2] = value.map(Number);
    return [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ];
  }

  const scalarPolygon = value.every(isFiniteScalar);
  if (scalarPolygon && value.length >= 6 && value.length % 2 === 0) {
    const points = [];
    for (let index = 0; index < value.length; index += 2) {
      points.push({
        x: Number(value[index]),
        y: Number(value[index + 1]),
      });
    }
    return points;
  }

  return value
    .map(point => parsePoint(point))
    .filter(Boolean);
}

function parseOutlines(value) {
  if (!Array.isArray(value) || !value.length) {
    return [];
  }

  const isSinglePolygon =
    value.every(isPointLike)
    || isRectangleOutline(value)
    || (value.every(isFiniteScalar) && value.length >= 6 && value.length % 2 === 0);

  if (isSinglePolygon) {
    const polygon = parsePolygon(value);
    return polygon.length >= 3 ? [polygon] : [];
  }

  const looksNestedCollection = value.every(item => Array.isArray(item) || isObject(item));

  if (looksNestedCollection) {
    return value
      .map(polygon => parsePolygon(polygon))
      .filter(polygon => polygon.length >= 3);
  }

  const polygon = parsePolygon(value);
  return polygon.length >= 3 ? [polygon] : [];
}

function flattenPolygons(polygons) {
  return arrayFromMaybe(polygons).flatMap(polygon => arrayFromMaybe(polygon));
}

function pickShapeSource(...sources) {
  return sources.find(source => {
    if (Array.isArray(source)) {
      return source.length > 0;
    }
    return isObject(source);
  });
}

function centroid(points) {
  if (!Array.isArray(points) || !points.length) {
    return { x: 0, y: 0 };
  }

  const sum = points.reduce((acc, point) => ({
    x: acc.x + point.x,
    y: acc.y + point.y,
  }), { x: 0, y: 0 });

  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

function polygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += (current.x * next.y) - (next.x * current.y);
  }

  return Math.abs(area) / 2;
}

function polygonBounds(points) {
  if (!Array.isArray(points) || !points.length) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      width: 0,
      height: 0,
    };
  }

  const bounds = points.reduce((acc, point) => ({
    minX: Math.min(acc.minX, point.x),
    maxX: Math.max(acc.maxX, point.x),
    minY: Math.min(acc.minY, point.y),
    maxY: Math.max(acc.maxY, point.y),
  }), {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });

  return {
    ...bounds,
    width: Math.max(0, bounds.maxX - bounds.minX),
    height: Math.max(0, bounds.maxY - bounds.minY),
  };
}

function pointInPolygon(point, polygon) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) {
    return false;
  }

  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const minX = Math.min(currentPoint.x, previousPoint.x);
    const maxX = Math.max(currentPoint.x, previousPoint.x);
    const minY = Math.min(currentPoint.y, previousPoint.y);
    const maxY = Math.max(currentPoint.y, previousPoint.y);
    const crossProduct = ((point.y - currentPoint.y) * (previousPoint.x - currentPoint.x))
      - ((point.x - currentPoint.x) * (previousPoint.y - currentPoint.y));

    if (Math.abs(crossProduct) < 0.001 && point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
      return true;
    }

    const intersects = ((currentPoint.y > point.y) !== (previousPoint.y > point.y))
      && (point.x < (((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / ((previousPoint.y - currentPoint.y) || 1e-9)) + currentPoint.x);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function rectIntersectionArea(firstRect, secondRect) {
  if (!firstRect || !secondRect) {
    return 0;
  }

  const width = Math.max(0, Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left));
  const height = Math.max(0, Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top));
  return width * height;
}

function arrayFromMaybe(value) {
  return Array.isArray(value) ? value : [];
}

function sortByOrder(items) {
  return [...items].sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}

function humanizeModeLabel(value, kind = "generic") {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const key = normalizeTextKey(raw);
  if (key === "off" && kind === "suction") {
    return "Off";
  }

  if (VACUUM_MODE_LABELS[key]) {
    return VACUUM_MODE_LABELS[key];
  }

  return raw
    .replaceAll("_", " ")
    .replace(/\bplus\b/gi, "+")
    .replace(/\b\w/g, match => match.toUpperCase());
}

function humanizeSelectOptionLabel(value, kind = "generic") {
  const baseLabel = humanizeModeLabel(value, kind);
  if (!baseLabel) {
    return "";
  }

  const normalized = baseLabel
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function normalizeCustomMenuItems(items) {
  return arrayFromMaybe(items)
    .filter(isObject)
    .map(item => ({
      label: String(item.label || item.name || "").trim(),
      icon: String(item.icon || "mdi:flash").trim(),
      visible_when: String(item.visible_when || "always").trim(),
      tap_action: isObject(item.tap_action) ? deepClone(item.tap_action) : null,
      builtin_action: String(item.builtin_action || "").trim(),
    }))
    .filter(item => item.label && (item.tap_action || item.builtin_action));
}

function solveLinearSystem(matrix, vector) {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    let pivotValue = Math.abs(augmented[column][column]);

    for (let row = column + 1; row < size; row += 1) {
      const candidate = Math.abs(augmented[row][column]);
      if (candidate > pivotValue) {
        pivotValue = candidate;
        pivotRow = row;
      }
    }

    if (pivotValue < 1e-10) {
      return null;
    }

    if (pivotRow !== column) {
      const tmp = augmented[column];
      augmented[column] = augmented[pivotRow];
      augmented[pivotRow] = tmp;
    }

    const divisor = augmented[column][column];
    for (let k = column; k <= size; k += 1) {
      augmented[column][k] /= divisor;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }

      const factor = augmented[row][column];
      for (let k = column; k <= size; k += 1) {
        augmented[row][k] -= factor * augmented[column][k];
      }
    }
  }

  return augmented.map(row => row[size]);
}

function invert3x3(matrix) {
  const [
    a, b, c,
    d, e, f,
    g, h, i,
  ] = matrix;

  const det = (
    a * (e * i - f * h) -
    b * (d * i - f * g) +
    c * (d * h - e * g)
  );

  if (Math.abs(det) < 1e-10) {
    return null;
  }

  const invDet = 1 / det;
  return [
    (e * i - f * h) * invDet,
    (c * h - b * i) * invDet,
    (b * f - c * e) * invDet,
    (f * g - d * i) * invDet,
    (a * i - c * g) * invDet,
    (c * d - a * f) * invDet,
    (d * h - e * g) * invDet,
    (b * g - a * h) * invDet,
    (a * e - b * d) * invDet,
  ];
}

function applyHomography(matrix, x, y) {
  const denominator = (matrix[6] * x) + (matrix[7] * y) + matrix[8];
  if (Math.abs(denominator) < 1e-10) {
    return { x, y };
  }

  return {
    x: ((matrix[0] * x) + (matrix[1] * y) + matrix[2]) / denominator,
    y: ((matrix[3] * x) + (matrix[4] * y) + matrix[5]) / denominator,
  };
}

function createAffineMatrix(fromPoints, toPoints) {
  const matrix = [];
  const vector = [];

  for (let index = 0; index < 3; index += 1) {
    const from = fromPoints[index];
    const to = toPoints[index];
    matrix.push([from.x, from.y, 1, 0, 0, 0]);
    matrix.push([0, 0, 0, from.x, from.y, 1]);
    vector.push(to.x);
    vector.push(to.y);
  }

  return solveLinearSystem(matrix, vector);
}

function applyAffineMatrix(matrix, x, y) {
  return {
    x: (matrix[0] * x) + (matrix[1] * y) + matrix[2],
    y: (matrix[3] * x) + (matrix[4] * y) + matrix[5],
  };
}

function createHomographyMatrix(fromPoints, toPoints) {
  const matrix = [];
  const vector = [];

  for (let index = 0; index < 4; index += 1) {
    const from = fromPoints[index];
    const to = toPoints[index];
    matrix.push([from.x, from.y, 1, 0, 0, 0, -(to.x * from.x), -(to.x * from.y)]);
    matrix.push([0, 0, 0, from.x, from.y, 1, -(to.y * from.x), -(to.y * from.y)]);
    vector.push(to.x);
    vector.push(to.y);
  }

  const solved = solveLinearSystem(matrix, vector);
  return solved ? [...solved, 1] : null;
}

class CoordinatesConverter {
  constructor(calibrationPoints) {
    this.calibrated = false;
    this.mode = "";
    this.vacuumToMapMatrix = null;
    this.mapToVacuumMatrix = null;

    const points = arrayFromMaybe(calibrationPoints)
      .map(point => ({
        map: parsePoint(point?.map),
        vacuum: parsePoint(point?.vacuum),
      }))
      .filter(point => point.map && point.vacuum);

    if (points.length === 3) {
      const vacuumPoints = points.map(point => point.vacuum);
      const mapPoints = points.map(point => point.map);
      const forward = createAffineMatrix(vacuumPoints, mapPoints);
      const reverse = createAffineMatrix(mapPoints, vacuumPoints);

      if (forward && reverse) {
        this.calibrated = true;
        this.mode = "affine";
        this.vacuumToMapMatrix = forward;
        this.mapToVacuumMatrix = reverse;
      }
      return;
    }

    if (points.length >= 4) {
      const vacuumPoints = points.slice(0, 4).map(point => point.vacuum);
      const mapPoints = points.slice(0, 4).map(point => point.map);
      const forward = createHomographyMatrix(vacuumPoints, mapPoints);
      const reverse = createHomographyMatrix(mapPoints, vacuumPoints);

      if (forward && reverse) {
        this.calibrated = true;
        this.mode = "projective";
        this.vacuumToMapMatrix = forward;
        this.mapToVacuumMatrix = reverse;
      }
    }
  }

  vacuumToMap(x, y) {
    if (!this.calibrated) {
      return { x, y };
    }

    if (this.mode === "affine") {
      return applyAffineMatrix(this.vacuumToMapMatrix, x, y);
    }

    return applyHomography(this.vacuumToMapMatrix, x, y);
  }

  mapToVacuum(x, y) {
    if (!this.calibrated) {
      return { x, y };
    }

    if (this.mode === "affine") {
      return applyAffineMatrix(this.mapToVacuumMatrix, x, y);
    }

    return applyHomography(this.mapToVacuumMatrix, x, y);
  }
}

function parseCalibrationPoints(config, hass) {
  const directPoints = arrayFromMaybe(config?.calibration_source?.calibration_points);
  if (directPoints.length) {
    return directPoints;
  }

  const calibrationEntityId = config?.calibration_source?.entity;
  if (calibrationEntityId && hass?.states?.[calibrationEntityId]?.attributes?.calibration_points) {
    return hass.states[calibrationEntityId].attributes.calibration_points;
  }

  if (config?.calibration_source?.camera === true) {
    const mapEntityId = config?.map_source?.camera || config?.map_camera || "";
    return hass?.states?.[mapEntityId]?.attributes?.calibration_points || [];
  }

  return [];
}

function resolveLegacyMode(config, templateName) {
  return arrayFromMaybe(config?.map_modes).find(mode => normalizeTextKey(mode?.template) === normalizeTextKey(templateName));
}

function resolveRoomsFromVacuumState(hass, entityId) {
  const vacuumState = entityId ? hass?.states?.[entityId] || null : null;
  const maps = arrayFromMaybe(vacuumState?.attributes?.maps);
  const mapWithRooms = maps.find(map => isObject(map?.rooms) && Object.keys(map.rooms).length > 0);
  if (!mapWithRooms) {
    return [];
  }

  return Object.entries(mapWithRooms.rooms).map(([id, label]) => ({
    id: String(id ?? ""),
    label: String(label || id || "").trim(),
    icon: "mdi:broom",
    outlines: [],
    outline: [],
    iconPoint: null,
    labelPoint: null,
    labelOffsetY: 0,
  })).filter(room => room.id);
}

function resolveRoomsFromMapState(hass, entityId) {
  const mapState = entityId ? hass?.states?.[entityId] || null : null;
  const rooms = mapState?.attributes?.rooms;
  if (!isObject(rooms) || !Object.keys(rooms).length) {
    return [];
  }

  return Object.entries(rooms).map(([id, room]) => {
    const shapeSource = pickShapeSource(
      room?.outlines,
      room?.outline,
      room?.zones,
      room?.rectangles,
      room?.segments,
      room?.areas,
      room?.polygons,
      room,
    );
    const outlines = Array.isArray(shapeSource)
      ? parseOutlines(shapeSource)
      : (() => {
          const polygon = parsePolygon(shapeSource);
          return polygon.length >= 3 ? [polygon] : [];
        })();
    const outline = flattenPolygons(outlines);
    const centerX = parseNumber(room?.pos_x);
    const centerY = parseNumber(room?.pos_y);
    const fallbackCenter = outline.length ? centroid(outline) : null;

    return {
      id: String(room?.number ?? id ?? ""),
      label: String(room?.name || room?.label || id || "").trim(),
      icon: "mdi:broom",
      outlines,
      outline,
      iconPoint: Number.isFinite(centerX) && Number.isFinite(centerY)
        ? { x: centerX, y: centerY }
        : fallbackCenter,
      labelPoint: Number.isFinite(centerX) && Number.isFinite(centerY)
        ? { x: centerX, y: centerY }
        : fallbackCenter,
      labelOffsetY: 0,
    };
  }).filter(room => room.id);
}

function resolveRoomSegments(config, hass = null, entityId = "", mapEntityId = "") {
  const directRooms = arrayFromMaybe(config?.room_segments);
  if (directRooms.length) {
    return directRooms.map(room => {
      const outlines = parseOutlines(pickShapeSource(
        room.outlines,
        room.outline,
        room.zones,
        room.rectangles,
        room.segments,
        room.areas,
        room.polygons,
      ));
      return {
        id: String(room.id ?? ""),
        label: room.label || room.name || room?.label?.text || "",
        icon: room.icon || room?.icon?.name || "mdi:broom",
        outlines,
        outline: flattenPolygons(outlines),
        iconPoint: parsePoint(room.iconPoint || room.icon || room.position),
        labelPoint: parsePoint(room.labelPoint || room.label || room.position),
        labelOffsetY: Number(room.labelOffsetY ?? room?.label?.offset_y ?? 0) || 0,
      };
    }).filter(room => room.id && room.outlines.length);
  }

  const segmentMode = resolveLegacyMode(config, "vacuum_clean_segment");
  const legacyRooms = arrayFromMaybe(segmentMode?.predefined_selections).map(selection => {
    const outlines = parseOutlines(pickShapeSource(
      selection?.outlines,
      selection?.outline,
      selection?.zones,
      selection?.rectangles,
      selection?.segments,
      selection?.areas,
      selection?.polygons,
    ));
    return {
      id: String(selection.id ?? ""),
      label: String(selection?.label?.text || selection?.label || selection?.text || selection.id || "").trim(),
      icon: String(selection?.icon?.name || selection?.icon || "mdi:broom").trim(),
      outlines,
      outline: flattenPolygons(outlines),
      iconPoint: parsePoint(selection?.icon),
      labelPoint: parsePoint(selection?.label),
      labelOffsetY: Number(selection?.label?.offset_y ?? 0) || 0,
    };
  }).filter(room => room.id && room.outlines.length);

  if (legacyRooms.length) {
    return legacyRooms;
  }

  const mapRooms = resolveRoomsFromMapState(hass, mapEntityId);
  if (mapRooms.length) {
    return mapRooms;
  }

  return resolveRoomsFromVacuumState(hass, entityId);
}

function resolveGotoPoints(config) {
  const directPoints = arrayFromMaybe(config?.goto_points);
  if (directPoints.length) {
    return directPoints.map(point => ({
      id: String(point.id || point.label || point.name || ""),
      label: point.label || point.name || point?.label?.text || "",
      icon: point.icon || point?.icon?.name || "mdi:map-marker",
      position: parsePoint(point.position),
    })).filter(point => point.position);
  }

  const gotoMode = resolveLegacyMode(config, "vacuum_goto_predefined");
  return arrayFromMaybe(gotoMode?.predefined_selections).map(point => ({
    id: String(point.id || point?.label?.text || point?.icon?.name || "goto"),
    label: String(point?.label?.text || point?.label || "").trim(),
    icon: String(point?.icon?.name || point?.icon || "mdi:map-marker").trim(),
    position: parsePoint(point.position),
  })).filter(point => point.position);
}

function resolvePredefinedZones(config) {
  const directZones = arrayFromMaybe(config?.predefined_zones);
  if (directZones.length) {
    return directZones.map(zone => ({
      id: String(zone.id || zone.label || zone.name || ""),
      label: zone.label || zone.name || zone?.label?.text || "",
      icon: zone.icon || zone?.icon?.name || "mdi:vector-rectangle",
      zones: arrayFromMaybe(zone.zones).map(item => arrayFromMaybe(item).map(Number)).filter(item => item.length >= 4),
      position: parsePoint(zone.position || zone.icon || zone.label),
    })).filter(zone => zone.zones.length);
  }

  const zoneMode = resolveLegacyMode(config, "vacuum_clean_zone_predefined");
  return arrayFromMaybe(zoneMode?.predefined_selections).map(zone => ({
    id: String(zone.id || zone?.label?.text || zone?.icon?.name || "zone"),
    label: String(zone?.label?.text || zone?.label || "").trim(),
    icon: String(zone?.icon?.name || zone?.icon || "mdi:vector-rectangle").trim(),
    zones: arrayFromMaybe(zone.zones).map(item => arrayFromMaybe(item).map(Number)).filter(item => item.length >= 4),
    position: parsePoint(zone?.icon || zone?.label),
  })).filter(zone => zone.zones.length);
}

function resolveHeaderIcons(config) {
  return sortByOrder(arrayFromMaybe(config?.icons)).map((item, index) => ({
    id: String(item.id || item.icon_id || index),
    icon: String(item.icon || "mdi:gesture-tap-button").trim(),
    tooltip: String(item.tooltip || item.label || "").trim(),
    order: Number(item.order || index),
    tap_action: isObject(item.tap_action) ? item.tap_action : {},
  }));
}

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  config.custom_menu = mergeConfig(DEFAULT_CONFIG.custom_menu, config.custom_menu || {});
  config.custom_menu.items = normalizeCustomMenuItems(config.custom_menu.items);
  return config;
}

class NodaliaAdvanceVacuumCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig() {
    return deepClone(STUB_CONFIG);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._mapImageWidth = 1024;
    this._mapImageHeight = 1024;
    this._activeMode = "all";
    this._activeUtilityPanel = null;
    this._selectedRoomIds = [];
    this._activeCleaningRoomIds = [];
    this._activeCleaningZones = [];
    this._selectedPredefinedZoneIds = [];
    this._manualZones = [];
    this._selectedManualZoneIndex = -1;
    this._transientZoneReturnMode = "";
    this._draftZone = null;
    this._gotoPoint = null;
    this._repeats = 1;
    this._activeSeries = "";
    this._activeModePanelPreset = "";
    this._activeDockPanelSection = DOCK_PANEL_SECTIONS[0]?.id || "control";
    this._lastNonSmartModeSelection = {
      suction: "",
      mop: "",
    };
    this._converter = new CoordinatesConverter([]);
    this._mapScale = 1;
    this._mapOffset = { x: 0, y: 0 };
    this._activeMapPointers = new Map();
    this._pinchGesture = null;
    this._touchPinchGesture = null;
    this._zoneHandleDrag = null;
    this._pointerStart = null;
    this._pointerSurfaceRect = null;
    this._lastRenderSignature = "";

    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowChange = this._onShadowChange.bind(this);
    this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
    this._onShadowPointerMove = this._onShadowPointerMove.bind(this);
    this._onShadowPointerUp = this._onShadowPointerUp.bind(this);
    this._onShadowTouchStart = this._onShadowTouchStart.bind(this);
    this._onShadowTouchMove = this._onShadowTouchMove.bind(this);
    this._onShadowTouchEnd = this._onShadowTouchEnd.bind(this);
    this._onMapImageLoad = this._onMapImageLoad.bind(this);

    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("change", this._onShadowChange);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown);
    this.shadowRoot.addEventListener("pointermove", this._onShadowPointerMove);
    this.shadowRoot.addEventListener("pointerup", this._onShadowPointerUp);
    this.shadowRoot.addEventListener("pointercancel", this._onShadowPointerUp);
    this.shadowRoot.addEventListener("pointerleave", this._onShadowPointerUp);
    this.shadowRoot.addEventListener("touchstart", this._onShadowTouchStart, { passive: false });
    this.shadowRoot.addEventListener("touchmove", this._onShadowTouchMove, { passive: false });
    this.shadowRoot.addEventListener("touchend", this._onShadowTouchEnd, { passive: false });
    this.shadowRoot.addEventListener("touchcancel", this._onShadowTouchEnd, { passive: false });
  }

  connectedCallback() {
    this._render();
  }

  disconnectedCallback() {
    const image = this.shadowRoot?.querySelector("[data-map-image]");
    if (image) {
      image.removeEventListener("load", this._onMapImageLoad);
    }
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._lastRenderSignature = "";
    this._repeats = clamp(Number(this._config.max_repeats || 1), 1, 9);
    this._selectedRoomIds = [];
    this._activeCleaningRoomIds = [];
    this._activeCleaningZones = [];
    this._selectedPredefinedZoneIds = [];
    this._manualZones = [];
    this._selectedManualZoneIndex = -1;
    this._transientZoneReturnMode = "";
    this._draftZone = null;
    this._gotoPoint = null;
    this._activeUtilityPanel = null;
    this._activeModePanelPreset = "";
    this._activeDockPanelSection = DOCK_PANEL_SECTIONS[0]?.id || "control";
    this._mapScale = 1;
    this._mapOffset = { x: 0, y: 0 };
    this._activeMapPointers = new Map();
    this._pinchGesture = null;
    this._touchPinchGesture = null;
    this._zoneHandleDrag = null;
    this._activeMode = this._getAvailableModes()[0]?.id || "all";
    this._updateCalibration();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const nextSignature = this._getRenderSignature(hass);
    if (nextSignature === this._lastRenderSignature && this.shadowRoot?.innerHTML) {
      return;
    }
    this._updateCalibration();
    this._render();
  }

  getCardSize() {
    return 8;
  }

  getGridOptions() {
    return {
      rows: 6,
      columns: 12,
      min_rows: 5,
      min_columns: 6,
    };
  }

  _triggerHaptic(styleOverride = null) {
    const haptics = this._config?.haptics || {};
    if (haptics.enabled !== true) {
      return;
    }

    const style = styleOverride || haptics.style || "selection";
    fireEvent(this, "haptic", style, {
      bubbles: true,
      cancelable: false,
      composed: true,
    });

    if (haptics.fallback_vibrate === true && typeof navigator?.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection);
    }
  }

  _getVacuumState() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _getName() {
    const state = this._getVacuumState();
    return this._config?.name || state?.attributes?.friendly_name || this._config?.entity || "Robot";
  }

  _getIcon() {
    const state = this._getVacuumState();
    return this._config?.icon || state?.attributes?.icon || "mdi:robot-vacuum";
  }

  _getReportedStateKey(state) {
    return normalizeTextKey(state?.state);
  }

  _matchesActivity(state, values) {
    const key = this._getReportedStateKey(state);
    return values.map(item => normalizeTextKey(item)).includes(key);
  }

  _isCleaning(state) {
    return this._matchesActivity(state, [
      "cleaning",
      "spot_cleaning",
      "segment_cleaning",
      "room_cleaning",
      "zone_cleaning",
      "clean_area",
      "vacuuming",
      "limpiando",
    ]);
  }

  _isPaused(state) {
    return this._matchesActivity(state, ["paused", "pause", "pausado"]);
  }

  _isWashingMops(state) {
    return this._matchesActivity(state, [
      "washing",
      "wash_mop",
      "mop_wash",
      "washing_mop",
      "washing_pads",
      "lavando_mopas",
      "lavando_mopa",
    ]);
  }

  _isDryingMops(state) {
    return this._matchesActivity(state, ["drying", "drying_mop", "secando", "secando_mopas"]);
  }

  _isAutoEmptying(state) {
    return this._matchesActivity(state, ["emptying", "self_emptying", "autovaciando", "vaciando"]);
  }

  _isReturning(state) {
    return this._matchesActivity(state, ["returning", "return_to_base", "returning_home", "volviendo"]);
  }

  _isDocked(state) {
    return this._matchesActivity(state, ["docked", "charging", "charging_completed", "en_base", "base"]);
  }

  _isActive(state) {
    return (
      this._isCleaning(state) ||
      this._isPaused(state) ||
      this._isReturning(state) ||
      this._isWashingMops(state) ||
      this._isDryingMops(state) ||
      this._isAutoEmptying(state)
    );
  }

  _getStateLabel(state) {
    const key = this._getReportedStateKey(state);
    const labels = {
      docked: "En base",
      charging: "Cargando",
      charging_completed: "Cargando",
      cleaning: "Limpiando",
      spot_cleaning: "Limpiando",
      segment_cleaning: "Limpiando",
      room_cleaning: "Limpiando",
      zone_cleaning: "Limpiando",
      clean_area: "Limpiando",
      paused: "Pausado",
      returning: "Volviendo a la base",
      return_to_base: "Volviendo a la base",
      returning_home: "Volviendo a la base",
      washing: "Lavando mopas",
      wash_mop: "Lavando mopas",
      washing_mop: "Lavando mopas",
      washing_pads: "Lavando mopas",
      drying: "Secando",
      drying_mop: "Secando",
      emptying: "Autovaciando",
      self_emptying: "Autovaciando",
      unavailable: "No disponible",
      unknown: "Desconocido",
      error: "Error",
    };

    return labels[key] || (state?.state ? String(state.state) : "Desconocido");
  }

  _getAccentColor(state) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;

    if (this._getReportedStateKey(state) === "error") {
      return styles.icon.error_color || "#ff6b6b";
    }
    if (this._isWashingMops(state)) {
      return styles.icon.washing_color || "#5aa7ff";
    }
    if (this._isDryingMops(state)) {
      return styles.icon.drying_color || "#f1c24c";
    }
    if (this._isAutoEmptying(state)) {
      return styles.icon.emptying_color || "#9b6b4a";
    }
    if (this._isReturning(state)) {
      return styles.icon.returning_color || "#f6b73c";
    }
    if (this._isCleaning(state) || this._isPaused(state)) {
      return styles.icon.active_color || "#61c97a";
    }
    return styles.icon.docked_color || "rgba(255, 255, 255, 0.56)";
  }

  _getBatteryLevel(state) {
    const direct = Number(state?.attributes?.battery_level);
    if (Number.isFinite(direct)) {
      return clamp(Math.round(direct), 0, 100);
    }
    return null;
  }

  _getBatteryColor(level) {
    if (!Number.isFinite(level)) {
      return "rgba(255,255,255,0.62)";
    }
    if (level >= 70) {
      return "#61c97a";
    }
    if (level >= 35) {
      return "#f1c24c";
    }
    return "#ff8c69";
  }

  _getMapEntityId() {
    return this._config?.map_source?.camera || this._config?.map_source?.image || this._config?.map_camera || "";
  }

  _getMapState() {
    const entityId = this._getMapEntityId();
    return entityId ? this._hass?.states?.[entityId] || null : null;
  }

  _extractRoomIdsFromValue(value) {
    return arrayFromMaybe(value)
      .flatMap(item => {
        if (item === null || item === undefined) {
          return [];
        }

        if (typeof item === "object") {
          const candidate = item.id ?? item.room_id ?? item.segment_id ?? item.number;
          return candidate === null || candidate === undefined ? [] : [String(candidate)];
        }

        return [String(item)];
      })
      .map(item => item.trim())
      .filter(Boolean);
  }

  _getReportedCleaningRoomIds(state = this._getVacuumState()) {
    const mapState = this._getMapState();
    const candidates = [
      state?.attributes?.segments,
      state?.attributes?.segment_ids,
      state?.attributes?.selected_segments,
      state?.attributes?.selected_rooms,
      state?.attributes?.room_ids,
      state?.attributes?.rooms_to_clean,
      state?.attributes?.cleaning_segments,
      state?.attributes?.current_segments,
      mapState?.attributes?.selected_rooms,
      mapState?.attributes?.room_ids,
      mapState?.attributes?.segments,
    ];

    return [...new Set(candidates.flatMap(value => this._extractRoomIdsFromValue(value)))];
  }

  _getCurrentVacuumRoomId(state = this._getVacuumState()) {
    const mapState = this._getMapState();
    const candidate = (
      mapState?.attributes?.vacuum_room ??
      state?.attributes?.vacuum_room ??
      state?.attributes?.room_id ??
      state?.attributes?.current_room_id
    );

    if (candidate === null || candidate === undefined || candidate === "") {
      return "";
    }

    return String(candidate).trim();
  }

  _isRoomCleaningSessionActive(state = this._getVacuumState()) {
    return this._matchesActivity(state, ["segment_cleaning", "room_cleaning"]) || (
      this._activeCleaningRoomIds.length > 0 && (this._isPaused(state) || this._isReturning(state))
    );
  }

  _syncActiveCleaningRoomIds(state = this._getVacuumState()) {
    const reportedRoomIds = this._getReportedCleaningRoomIds(state);
    const currentRoomId = this._getCurrentVacuumRoomId(state);
    const isRoomCleaning = this._matchesActivity(state, ["segment_cleaning", "room_cleaning"]);

    if (reportedRoomIds.length) {
      this._activeCleaningRoomIds = reportedRoomIds;
      return;
    }

    if (isRoomCleaning && currentRoomId) {
      this._activeCleaningRoomIds = [...new Set([currentRoomId, ...this._activeCleaningRoomIds])];
      return;
    }

    if (!this._isActive(state)) {
      this._activeCleaningRoomIds = [];
      this._activeCleaningZones = [];
    }
  }

  _getHighlightedRoomIds(state = this._getVacuumState()) {
    const highlighted = new Set(this._selectedRoomIds.map(id => String(id)));

    if (this._isRoomCleaningSessionActive(state)) {
      this._activeCleaningRoomIds.forEach(id => highlighted.add(String(id)));
      const currentRoomId = this._getCurrentVacuumRoomId(state);
      if (currentRoomId) {
        highlighted.add(currentRoomId);
      }
    }

    return [...highlighted];
  }

  _getMapImageUrl() {
    const mapState = this._getMapState();
    const entityId = this._getMapEntityId();
    if (!mapState || !this._hass) {
      return "";
    }

    const fromPicture = mapState.attributes?.entity_picture;
    if (fromPicture) {
      return this._hass.hassUrl(fromPicture);
    }

    if (normalizeTextKey(entityId.split(".")[0]) === "image") {
      return this._hass.hassUrl(`/api/image_proxy/${entityId}`);
    }

    return "";
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const mapEntityId = this._getMapEntityId();
    const mapState = mapEntityId ? hass?.states?.[mapEntityId] || null : null;
    const mapPicture = String(mapState?.attributes?.entity_picture || "");
    const currentRoomId = this._getCurrentVacuumRoomId(state);
    const suctionDescriptor = this._getModeDescriptor("suction", state);
    const mopDescriptor = this._getModeDescriptor("mop", state);
    const mopModeDescriptor = this._getMopModeDescriptor(state);
    const dockControlDescriptors = this._getDockControlDescriptors(state);
    const dockSettingDescriptors = this._getDockSettingDescriptors(state);

    return JSON.stringify({
      vacuum: {
        state: String(state?.state || ""),
        lastUpdated: String(state?.last_updated || ""),
        battery: Number(state?.attributes?.battery_level ?? -1),
        fanSpeed: String(state?.attributes?.fan_speed || ""),
        icon: String(this._getIcon() || ""),
        name: String(this._getName() || ""),
      },
      map: {
        entity: String(mapEntityId || ""),
        state: String(mapState?.state || ""),
        lastUpdated: String(mapState?.last_updated || ""),
        picture: mapPicture,
      },
      calibration: {
        camera: this._config?.calibration_source?.camera === true,
        entity: String(this._config?.calibration_source?.entity || ""),
        points: parseCalibrationPoints(this._config, this._hass).length,
      },
      activeMode: String(this._activeMode || ""),
      transientZoneReturnMode: String(this._transientZoneReturnMode || ""),
      activeUtilityPanel: String(this._activeUtilityPanel || ""),
      activeModePanelPreset: String(this._activeModePanelPreset || ""),
      activeDockPanelSection: String(this._activeDockPanelSection || ""),
      selectedRooms: this._selectedRoomIds.join("|"),
      activeCleaningRooms: this._activeCleaningRoomIds.join("|"),
      activeCleaningZones: this._activeCleaningZones.map(zone => `${zone.x1}:${zone.y1}:${zone.x2}:${zone.y2}`).join("|"),
      currentRoom: currentRoomId,
      selectedZones: this._selectedPredefinedZoneIds.join("|"),
      manualZones: this._manualZones.length,
      goto: this._gotoPoint ? `${Math.round(this._gotoPoint.x)}:${Math.round(this._gotoPoint.y)}` : "",
      repeats: Number(this._repeats || 1),
      dimensions: `${this._mapImageWidth}x${this._mapImageHeight}`,
      modes: {
        suction: suctionDescriptor
          ? `${suctionDescriptor.service}:${suctionDescriptor.target}:${suctionDescriptor.current}:${suctionDescriptor.options.join("|")}`
          : "",
        mop: mopDescriptor
          ? `${mopDescriptor.service}:${mopDescriptor.target}:${mopDescriptor.current}:${mopDescriptor.options.join("|")}`
          : "",
        mopMode: mopModeDescriptor
          ? `${mopModeDescriptor.service}:${mopModeDescriptor.target}:${mopModeDescriptor.current}:${mopModeDescriptor.options.join("|")}`
          : "",
      },
      dock: {
        controls: dockControlDescriptors.map(descriptor => `${descriptor.id}:${descriptor.target}:${descriptor.active ? "1" : "0"}`).join("|"),
        settings: dockSettingDescriptors.map(descriptor => `${descriptor.id}:${descriptor.target}:${descriptor.current}:${descriptor.options.join("|")}`).join("|"),
      },
    });
  }

  _updateCalibration() {
    this._converter = new CoordinatesConverter(parseCalibrationPoints(this._config, this._hass));
  }

  _getRoomSegments() {
    return resolveRoomSegments(this._config, this._hass, this._config?.entity, this._getMapEntityId());
  }

  _getPredefinedZones() {
    return resolvePredefinedZones(this._config);
  }

  _getGotoPoints() {
    return resolveGotoPoints(this._config);
  }

  _getHeaderIcons() {
    return resolveHeaderIcons(this._config);
  }

  _getAvailableModes() {
    const modes = [];
    const showAllMode = this._config?.show_all_mode !== false;
    const hasRooms = this._getRoomSegments().length > 0;
    const hasZones = this._config?.allow_zone_mode !== false || this._getPredefinedZones().length > 0 || Boolean(resolveLegacyMode(this._config, "vacuum_clean_zone"));

    if (showAllMode) {
      modes.push({ id: "all", label: MODE_LABELS.all, icon: "mdi:home" });
    }
    if (hasRooms && this._config?.allow_segment_mode !== false) {
      modes.push({ id: "rooms", label: MODE_LABELS.rooms, icon: "mdi:floor-plan" });
    }
    if (hasZones) {
      modes.push({ id: "zone", label: MODE_LABELS.zone, icon: "mdi:vector-rectangle" });
    }

    return modes;
  }

  _getSelectOptions(entityId) {
    const selectState = entityId ? this._hass?.states?.[entityId] || null : null;
    const options = Array.isArray(selectState?.attributes?.options)
      ? selectState.attributes.options.map(item => String(item || "").trim()).filter(Boolean)
      : [];

    return {
      entityId,
      options,
      state: selectState,
      value: selectState?.state ? String(selectState.state) : "",
    };
  }

  _getModeEntityPatterns(kind) {
    return kind === "mop"
      ? [
        "mop_intensity",
        "intensidad_mopa",
        "mop_level",
        "mop",
        "water_level",
        "water_volume",
        "water_flow",
        "water_box_mode",
        "water_grade",
        "nivel_agua",
        "caudal_agua",
        "water",
      ]
      : [
        "vacuum_cleaner_mode",
        "vacuum_mode",
        "modo_aspirado",
        "suction_level",
        "suction_mode",
        "intensidad_aspirado",
        "fan_speed",
        "fan_power",
        "suction",
        "clean_mode",
        "cleaning_mode",
      ];
  }

  _getMopModeEntityPatterns() {
    return [
      "modo_mopa",
      "mop_mode",
      "scrub_mode",
      "scrub",
      "mop_route",
      "patron_mopa",
      "trayectoria_mopa",
    ];
  }

  _getEntityMatchScore(entityId, patterns) {
    const normalizedEntityId = normalizeTextKey(entityId);
    return patterns.reduce((bestScore, pattern, index) => {
      const normalizedPattern = normalizeTextKey(pattern);
      if (!normalizedPattern || !normalizedEntityId.includes(normalizedPattern)) {
        return bestScore;
      }

      return Math.max(bestScore, patterns.length - index);
    }, 0);
  }

  _guessRelatedEntityByPatterns(domain, patterns, excludedEntities = []) {
    if (!this._hass?.states || !this._config?.entity) {
      return "";
    }

    const objectId = String(this._config.entity).split(".")[1] || "";
    if (!objectId) {
      return "";
    }

    const candidates = Object.keys(this._hass.states)
      .filter(entityId => entityId.startsWith(`${domain}.`))
      .filter(entityId => entityId.includes(objectId))
      .filter(entityId => !excludedEntities.includes(entityId))
      .map(entityId => ({
        entityId,
        score: this._getEntityMatchScore(entityId, patterns),
      }))
      .filter(candidate => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.entityId.localeCompare(right.entityId, "es"));

    return candidates[0]?.entityId || "";
  }

  _guessRelatedSelectEntityByPatterns(patterns, excludedEntities = []) {
    return this._guessRelatedEntityByPatterns("select", patterns, excludedEntities);
  }

  _guessRelatedButtonEntityByPatterns(patterns, excludedEntities = []) {
    return this._guessRelatedEntityByPatterns("button", patterns, excludedEntities);
  }

  _guessGlobalEntityByPatterns(domains, patterns, excludedEntities = []) {
    if (!this._hass?.states || !Array.isArray(patterns) || !patterns.length) {
      return "";
    }

    const domainList = arrayFromMaybe(domains).map(domain => String(domain || "").trim()).filter(Boolean);
    if (!domainList.length) {
      return "";
    }

    const candidates = Object.keys(this._hass.states)
      .filter(entityId => domainList.some(domain => entityId.startsWith(`${domain}.`)))
      .filter(entityId => !excludedEntities.includes(entityId))
      .map(entityId => ({
        entityId,
        score: this._getEntityMatchScore(entityId, patterns),
      }))
      .filter(candidate => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.entityId.localeCompare(right.entityId, "es"));

    return candidates[0]?.entityId || "";
  }

  _getEntityState(entityId) {
    return entityId ? this._hass?.states?.[entityId] || null : null;
  }

  _getEntityDomain(entityId) {
    return String(entityId || "").split(".")[0] || "";
  }

  _findFirstAvailableEntity(entityIds = [], excludedEntities = []) {
    if (!this._hass?.states) {
      return "";
    }

    return arrayFromMaybe(entityIds)
      .map(entityId => String(entityId || "").trim())
      .find(entityId => entityId && !excludedEntities.includes(entityId) && this._hass.states[entityId]) || "";
  }

  _isBooleanEntityOn(entityId) {
    return normalizeTextKey(this._getEntityState(entityId)?.state) === "on";
  }

  _toggleBooleanEntity(entityId) {
    if (!this._hass || !entityId) {
      return;
    }

    this._hass.callService("homeassistant", this._isBooleanEntityOn(entityId) ? "turn_off" : "turn_on", {
      entity_id: entityId,
    });
  }

  _setEntityOption(entityId, value) {
    if (!this._hass || !entityId || !value) {
      return;
    }

    const domain = this._getEntityDomain(entityId);
    const serviceName = domain === "input_select" ? "input_select.select_option" : "select.select_option";
    this._callNamedService(serviceName, {
      entity_id: entityId,
      option: value,
    });
  }

  _guessRelatedSelectEntity(kind) {
    return this._guessRelatedSelectEntityByPatterns(this._getModeEntityPatterns(kind));
  }

  _categorizeModeOption(value) {
    const key = normalizeTextKey(value);

    if (MOP_MODE_PATTERNS.some(pattern => key.includes(pattern))) {
      return "mop";
    }

    if (SUCTION_MODE_PATTERNS.some(pattern => key.includes(pattern))) {
      return "suction";
    }

    return "unknown";
  }

  _isSharedSmartMode(value) {
    const key = normalizeTextKey(value);
    return SHARED_SMART_MODE_PATTERNS.some(pattern => key.includes(pattern));
  }

  _isOffModeValue(value) {
    return ["off", "apagado", "disabled", "none", "sin_fregado"].includes(normalizeTextKey(value));
  }

  _isCustomModeValue(value) {
    const key = normalizeTextKey(value);
    return key === "custom" || key.startsWith("custom_");
  }

  _isMopIntensityDescriptor(descriptor) {
    if (!descriptor?.options?.length) {
      return false;
    }

    return descriptor.options.some(option => {
      const key = normalizeTextKey(option);
      return [
        "off",
        "apagado",
        "sin_fregado",
        "low",
        "medium",
        "media",
        "high",
        "alta",
        "intense",
        "deep",
      ].includes(key);
    });
  }

  _getFanPresets(state) {
    if (Array.isArray(state?.attributes?.fan_speed_list)) {
      return state.attributes.fan_speed_list
        .map(item => String(item || "").trim())
        .filter(Boolean);
    }

    return [];
  }

  _getCurrentFanSpeed(state) {
    const current = state?.attributes?.fan_speed;
    return current ? String(current) : "";
  }

  _getModeDescriptor(kind, state = this._getVacuumState()) {
    const explicitEntity = kind === "mop"
      ? this._config?.mop_select_entity
      : this._config?.suction_select_entity;
    const explicitDescriptor = explicitEntity ? this._getSelectOptions(explicitEntity) : null;
    const shouldUseExplicitDescriptor = kind !== "mop" || this._isMopIntensityDescriptor(explicitDescriptor);
    const selectEntity = shouldUseExplicitDescriptor && explicitDescriptor?.entityId
      ? explicitDescriptor.entityId
      : this._guessRelatedSelectEntity(kind);
    const descriptor = explicitDescriptor?.entityId === selectEntity
      ? explicitDescriptor
      : this._getSelectOptions(selectEntity);

    if (descriptor.entityId && descriptor.options.length) {
      return {
        kind,
        label: kind === "mop" ? "Fregado" : "Aspirado",
        target: descriptor.entityId,
        options: descriptor.options,
        current: descriptor.value,
        service: "select",
      };
    }

    const rawPresets = this._getFanPresets(state);
    if (!rawPresets.length) {
      return null;
    }

    const options = rawPresets.filter(option => {
      const optionKind = this._categorizeModeOption(option);
      const isSharedSmartMode = this._isSharedSmartMode(option);
      const isOffOption = normalizeTextKey(option) === "off";

      if (kind === "mop") {
        return optionKind === "mop" || isSharedSmartMode;
      }

      return optionKind !== "mop" || isSharedSmartMode || isOffOption;
    });

    if (!options.length) {
      return null;
    }

    return {
      kind,
      label: kind === "mop" ? "Fregado" : "Aspirado",
      target: this._config?.entity,
      options,
      current: this._getCurrentFanSpeed(state),
      service: "fan",
    };
  }

  _getModeDescriptors(state = this._getVacuumState()) {
    return ["suction", "mop", "mop_mode"]
      .map(kind => this._getModeDescriptorById(kind, state))
      .filter(Boolean);
  }

  _getMopModeDescriptor(state = this._getVacuumState()) {
    const explicitEntity = this._config?.mop_mode_select_entity || (
      this._config?.mop_select_entity && !this._isMopIntensityDescriptor(this._getSelectOptions(this._config?.mop_select_entity))
        ? this._config.mop_select_entity
        : ""
    );
    const explicitDescriptor = explicitEntity ? this._getSelectOptions(explicitEntity) : null;
    const excludedEntities = [this._getModeDescriptor("mop", state)?.target].filter(Boolean);
    const guessedEntity = explicitDescriptor?.entityId
      ? explicitDescriptor.entityId
      : this._guessRelatedSelectEntityByPatterns(this._getMopModeEntityPatterns(), excludedEntities);
    const descriptor = explicitDescriptor?.entityId === guessedEntity
      ? explicitDescriptor
      : this._getSelectOptions(guessedEntity);

    if (!descriptor?.entityId || !descriptor.options?.length) {
      return null;
    }

    return {
      kind: "mop_mode",
      label: "Modo de mopa",
      target: descriptor.entityId,
      options: descriptor.options,
      current: descriptor.value,
      service: "select",
    };
  }

  _getModeDescriptorById(descriptorId, state = this._getVacuumState()) {
    if (descriptorId === "mop_mode") {
      return this._getMopModeDescriptor(state);
    }

    return this._getModeDescriptor(descriptorId, state);
  }

  _getDockPanelSectionConfig(sectionId = this._activeDockPanelSection) {
    return DOCK_PANEL_SECTIONS.find(section => section.id === sectionId) || DOCK_PANEL_SECTIONS[0];
  }

  _setActiveDockPanelSection(sectionId) {
    if (!sectionId || sectionId === this._activeDockPanelSection) {
      return;
    }

    this._activeDockPanelSection = sectionId;
    this._triggerHaptic("selection");
    this._render();
  }

  _getDockControlState(definition, state) {
    switch (definition?.id) {
      case "empty":
        return this._isAutoEmptying(state);
      case "wash":
        return this._isWashingMops(state);
      case "dry":
        return this._isDryingMops(state);
      default:
        return false;
    }
  }

  _getDockControlDescriptor(definition, state = this._getVacuumState()) {
    if (!definition) {
      return null;
    }

    const toggleEntity = this._findFirstAvailableEntity(definition.entity_ids || []);
    if (toggleEntity) {
      const isActive = this._isBooleanEntityOn(toggleEntity);
      return {
        id: definition.id,
        label: isActive ? definition.active_label : definition.label,
        icon: isActive ? definition.active_icon || definition.icon : definition.icon,
        target: toggleEntity,
        active: isActive,
        type: "toggle",
      };
    }

    const startEntity = this._guessGlobalEntityByPatterns(["button"], definition.start_patterns || []);
    const stopEntity = this._guessGlobalEntityByPatterns(["button"], definition.stop_patterns || [], [startEntity].filter(Boolean));
    const isActive = this._getDockControlState(definition, state);
    const target = isActive ? stopEntity || startEntity : startEntity || stopEntity;

    if (!target) {
      return null;
    }

    return {
      id: definition.id,
      label: isActive ? definition.active_label : definition.label,
      icon: isActive ? definition.active_icon || definition.icon : definition.icon,
      target,
      active: isActive,
      type: "button",
    };
  }

  _getDockControlDescriptors(state = this._getVacuumState()) {
    const isCleaningSessionActive = this._isCleaning(state) || this._isPaused(state) || this._isReturning(state);
    if (isCleaningSessionActive) {
      const descriptors = [];

      if (this._config?.show_return_to_base !== false && !this._isDocked(state)) {
        descriptors.push({
          id: "return_to_base",
          label: "Volver a base",
          icon: "mdi:home-import-outline",
          builtin_action: "return_to_base",
        });
      }

      if (this._config?.show_locate !== false) {
        descriptors.push({
          id: "locate",
          label: "Localizar",
          icon: "mdi:crosshairs-gps",
          builtin_action: "locate",
        });
      }

      return descriptors;
    }

    return DOCK_CONTROL_DEFINITIONS
      .map(definition => this._getDockControlDescriptor(definition, state))
      .filter(Boolean);
  }

  _getDockSettingDescriptor(definition, state = this._getVacuumState()) {
    if (!definition) {
      return null;
    }

    const explicitEntity = this._findFirstAvailableEntity(definition.entity_ids || []);
    const entityId = explicitEntity || this._guessGlobalEntityByPatterns(["input_select", "select"], definition.patterns || []);
    const descriptor = this._getSelectOptions(entityId);
    if (descriptor?.entityId && descriptor.options?.length) {
      return {
        id: definition.id,
        label: definition.label,
        target: descriptor.entityId,
        options: descriptor.options,
        current: descriptor.value,
      };
    }

    if (definition.id === "mop_mode") {
      const mopModeDescriptor = this._getMopModeDescriptor(state);
      return mopModeDescriptor
        ? {
            id: definition.id,
            label: definition.label,
            target: mopModeDescriptor.target,
            options: mopModeDescriptor.options,
            current: mopModeDescriptor.current,
          }
        : null;
    }

    return null;
  }

  _getDockSettingDescriptors(state = this._getVacuumState()) {
    return DOCK_SETTING_DEFINITIONS
      .map(definition => this._getDockSettingDescriptor(definition, state))
      .filter(Boolean);
  }

  _pressButtonEntity(entityId) {
    if (!this._hass || !entityId) {
      return;
    }

    this._hass.callService("button", "press", {
      entity_id: entityId,
    });
  }

  _runDockControlAction(actionId, state = this._getVacuumState()) {
    if (actionId === "return_to_base" || actionId === "locate") {
      this._handleControlAction(actionId);
      return;
    }

    const descriptor = this._getDockControlDescriptors(state).find(item => item.id === actionId);
    if (!descriptor?.target) {
      return;
    }

    if (descriptor.type === "toggle") {
      this._toggleBooleanEntity(descriptor.target);
    } else {
      this._pressButtonEntity(descriptor.target);
    }
    this._triggerHaptic("selection");
  }

  _setDockSettingOption(settingId, value, state = this._getVacuumState()) {
    if (!this._hass || !settingId || !value) {
      return;
    }

    const descriptor = this._getDockSettingDescriptors(state).find(item => item.id === settingId);
    if (!descriptor?.target) {
      return;
    }

    this._setEntityOption(descriptor.target, value);
    this._triggerHaptic("selection");
  }

  _findMatchingModeOption(options, value) {
    const expectedKey = normalizeTextKey(value);
    if (!expectedKey || !Array.isArray(options)) {
      return "";
    }

    return options.find(option => normalizeTextKey(option) === expectedKey) || "";
  }

  _findSharedSmartOption(options) {
    return Array.isArray(options)
      ? options.find(option => this._isSharedSmartMode(option)) || ""
      : "";
  }

  _getModeFallbackCandidates(kind) {
    return kind === "mop"
      ? ["off", "low", "medium", "high", "deep", "standard", "normal", "custom"]
      : ["balanced", "standard", "normal", "quiet", "silent", "gentle", "turbo", "max", "strong", "custom"];
  }

  _getModeFallbackOption(kind, descriptor) {
    if (!descriptor?.options?.length) {
      return "";
    }

    const remembered = this._findMatchingModeOption(
      descriptor.options,
      this._lastNonSmartModeSelection[kind],
    );
    if (remembered && !this._isSharedSmartMode(remembered)) {
      return remembered;
    }

    const normalizedOptions = descriptor.options.map(option => ({
      key: normalizeTextKey(option),
      value: option,
    }));

    for (const candidate of this._getModeFallbackCandidates(kind)) {
      const exactMatch = normalizedOptions.find(option => option.key === candidate);
      if (exactMatch && !this._isSharedSmartMode(exactMatch.value)) {
        return exactMatch.value;
      }
    }

    const firstNonSmart = descriptor.options.find(option => !this._isSharedSmartMode(option));
    return firstNonSmart || "";
  }

  _rememberNonSmartModeSelection(kind, value) {
    if (!kind || !value || this._isSharedSmartMode(value)) {
      return;
    }

    this._lastNonSmartModeSelection[kind] = value;
  }

  _syncRememberedModeSelections(state) {
    ["suction", "mop"].forEach(kind => {
      const descriptor = this._getModeDescriptor(kind, state);
      if (descriptor?.current && !this._isSharedSmartMode(descriptor.current)) {
        this._rememberNonSmartModeSelection(kind, descriptor.current);
      }
    });
  }

  _applyLinkedSmartModeSelection(kind, value, state) {
    const descriptor = this._getModeDescriptor(kind, state);
    const otherKind = kind === "mop" ? "suction" : "mop";
    const otherDescriptor = this._getModeDescriptor(otherKind, state);

    if (descriptor?.service === "select" && descriptor.target && value) {
      this._hass.callService("select", "select_option", {
        entity_id: descriptor.target,
        option: value,
      });
    } else if (descriptor?.service === "fan" && value) {
      this._callVacuumService("set_fan_speed", {
        fan_speed: value,
      });
      return;
    }

    if (!descriptor || !otherDescriptor || otherDescriptor.service !== "select" || !otherDescriptor.target) {
      return;
    }

    if (otherDescriptor.target === descriptor.target) {
      return;
    }

    if (this._isSharedSmartMode(value)) {
      const sharedSmartOption = this._findSharedSmartOption(otherDescriptor.options);
      if (
        sharedSmartOption &&
        normalizeTextKey(sharedSmartOption) !== normalizeTextKey(otherDescriptor.current)
      ) {
        this._hass.callService("select", "select_option", {
          entity_id: otherDescriptor.target,
          option: sharedSmartOption,
        });
      }
      return;
    }

    if (!this._isSharedSmartMode(otherDescriptor.current)) {
      return;
    }

    const fallbackOption = this._getModeFallbackOption(otherKind, otherDescriptor);
    if (
      fallbackOption &&
      normalizeTextKey(fallbackOption) !== normalizeTextKey(otherDescriptor.current)
    ) {
      this._hass.callService("select", "select_option", {
        entity_id: otherDescriptor.target,
        option: fallbackOption,
      });
    }
  }

  _setModeOption(kind, value, state = this._getVacuumState(), options = {}) {
    const triggerHaptic = options.triggerHaptic !== false;
    if (!this._hass || !value) {
      return;
    }

    if (kind === "mop_mode") {
      const descriptor = this._getMopModeDescriptor(state);
      if (!descriptor?.target) {
        return;
      }

      this._hass.callService("select", "select_option", {
        entity_id: descriptor.target,
        option: value,
      });

      if (triggerHaptic) {
        this._triggerHaptic("selection");
      }
      return;
    }

    const descriptor = this._getModeDescriptor(kind, state);
    if (!descriptor?.target) {
      return;
    }

    this._rememberNonSmartModeSelection(kind, value);
    this._applyLinkedSmartModeSelection(kind, value, state);
    if (triggerHaptic) {
      this._triggerHaptic("selection");
    }
  }

  _findOptionByCandidates(options, candidates) {
    if (!Array.isArray(options) || !options.length || !Array.isArray(candidates) || !candidates.length) {
      return "";
    }

    const normalizedOptions = options.map(option => ({
      key: normalizeTextKey(option),
      value: option,
    }));

    for (const candidate of candidates) {
      const key = normalizeTextKey(candidate);
      const exactMatch = normalizedOptions.find(option => option.key === key);
      if (exactMatch) {
        return exactMatch.value;
      }
    }

    for (const candidate of candidates) {
      const key = normalizeTextKey(candidate);
      const partialMatch = normalizedOptions.find(option => option.key.includes(key) || key.includes(option.key));
      if (partialMatch) {
        return partialMatch.value;
      }
    }

    return "";
  }

  _getPresetDefaultOption(descriptor, candidates, { excludeOff = false } = {}) {
    if (!descriptor?.options?.length) {
      return "";
    }

    const preferred = this._findOptionByCandidates(descriptor.options, candidates);
    if (preferred) {
      return preferred;
    }

    return descriptor.options.find(option => {
      if (this._isSharedSmartMode(option) || this._isCustomModeValue(option)) {
        return false;
      }

      if (excludeOff && this._isOffModeValue(option)) {
        return false;
      }

      return true;
    }) || "";
  }

  _getModePanelPresetSelection(presetId, state = this._getVacuumState()) {
    const suctionDescriptor = this._getModeDescriptor("suction", state);
    const mopDescriptor = this._getModeDescriptor("mop", state);
    const mopModeDescriptor = this._getMopModeDescriptor(state);

    switch (presetId) {
      case "smart":
        return {
          suction: this._findSharedSmartOption(suctionDescriptor?.options),
          mop: this._findSharedSmartOption(mopDescriptor?.options),
          mopMode: this._findSharedSmartOption(mopModeDescriptor?.options),
        };
      case "vacuum_mop":
        return {
          suction: this._getPresetDefaultOption(suctionDescriptor, ["balanced", "equilibrado", "standard", "normal"], {
            excludeOff: true,
          }),
          mop: this._getPresetDefaultOption(mopDescriptor, ["medium", "media", "normal", "standard"], {
            excludeOff: true,
          }),
          mopMode: this._getPresetDefaultOption(mopModeDescriptor, ["standard", "estandar", "normal", "default"]),
        };
      case "vacuum":
        return {
          suction: this._getPresetDefaultOption(suctionDescriptor, ["balanced", "equilibrado", "standard", "normal"], {
            excludeOff: true,
          }),
          mop: this._findOptionByCandidates(mopDescriptor?.options, ["off", "sin_fregado", "apagado", "none"]),
          mopMode: this._getPresetDefaultOption(mopModeDescriptor, ["standard", "estandar", "normal", "default"]),
        };
      case "mop":
        return {
          suction: this._findOptionByCandidates(suctionDescriptor?.options, ["off", "apagado", "none"]),
          mop: this._getPresetDefaultOption(mopDescriptor, ["medium", "media", "normal", "standard"], {
            excludeOff: true,
          }),
          mopMode: this._getPresetDefaultOption(mopModeDescriptor, ["standard", "estandar", "normal", "default"]),
        };
      case "custom":
        return {
          suction: this._findOptionByCandidates(suctionDescriptor?.options, ["custom", "custom_mode", "custommode", "personalizado"]),
          mop: this._findOptionByCandidates(mopDescriptor?.options, ["custom", "custom_mode", "custommode", "custom_water_flow", "personalizado"]),
          mopMode: this._findOptionByCandidates(mopModeDescriptor?.options, ["custom", "custom_mode", "custommode", "personalizado"]),
        };
      default:
        return null;
    }
  }

  _detectModePanelPreset(state = this._getVacuumState()) {
    const suctionDescriptor = this._getModeDescriptor("suction", state);
    const mopDescriptor = this._getModeDescriptor("mop", state);
    const mopModeDescriptor = this._getMopModeDescriptor(state);
    const suctionCurrent = suctionDescriptor?.current || "";
    const mopCurrent = mopDescriptor?.current || "";
    const mopModeCurrent = mopModeDescriptor?.current || "";

    if (
      this._isSharedSmartMode(suctionCurrent) &&
      this._isSharedSmartMode(mopCurrent) &&
      (!mopModeCurrent || this._isSharedSmartMode(mopModeCurrent))
    ) {
      return "smart";
    }

    if (
      this._isCustomModeValue(suctionCurrent) ||
      this._isCustomModeValue(mopCurrent) ||
      this._isCustomModeValue(mopModeCurrent)
    ) {
      return "custom";
    }

    const suctionEnabled = Boolean(suctionCurrent) && !this._isOffModeValue(suctionCurrent) && !this._isSharedSmartMode(suctionCurrent);
    const mopEnabled = Boolean(mopCurrent) && !this._isOffModeValue(mopCurrent) && !this._isSharedSmartMode(mopCurrent);

    if (suctionEnabled && mopEnabled) {
      return "vacuum_mop";
    }

    if (suctionEnabled) {
      return "vacuum";
    }

    if (mopEnabled) {
      return "mop";
    }

    return "custom";
  }

  _getActiveModePanelPreset(state = this._getVacuumState()) {
    return this._activeModePanelPreset || this._detectModePanelPreset(state) || "vacuum_mop";
  }

  _getActiveModePanelPresetConfig(state = this._getVacuumState()) {
    const activePreset = this._getActiveModePanelPreset(state);
    return PANEL_MODE_PRESETS.find(preset => preset.id === activePreset) || PANEL_MODE_PRESETS[0];
  }

  _selectModePanelPreset(presetId, state = this._getVacuumState()) {
    this._activeModePanelPreset = presetId;

    const selection = this._getModePanelPresetSelection(presetId, state);
    if (!selection) {
      this._triggerHaptic("selection");
      this._render();
      return;
    }

    if (
      selection.suction &&
      normalizeTextKey(selection.suction) !== normalizeTextKey(this._getModeDescriptor("suction", state)?.current)
    ) {
      this._setModeOption("suction", selection.suction, state, { triggerHaptic: false });
    }

    if (
      selection.mop &&
      normalizeTextKey(selection.mop) !== normalizeTextKey(this._getModeDescriptor("mop", state)?.current)
    ) {
      this._setModeOption("mop", selection.mop, state, { triggerHaptic: false });
    }

    if (
      selection.mopMode &&
      normalizeTextKey(selection.mopMode) !== normalizeTextKey(this._getMopModeDescriptor(state)?.current)
    ) {
      this._setModeOption("mop_mode", selection.mopMode, state, { triggerHaptic: false });
    }

    this._triggerHaptic("selection");
    this._render();
  }

  _filterModePanelOptions(descriptor, presetId) {
    if (!descriptor?.options?.length) {
      return [];
    }

    return descriptor.options.filter(option => {
      const isSmart = this._isSharedSmartMode(option);
      const isOff = this._isOffModeValue(option);
      const isCustom = this._isCustomModeValue(option);

      switch (presetId) {
        case "smart":
          return false;
        case "vacuum_mop":
          if (descriptor.kind === "suction" || descriptor.kind === "mop") {
            return !isSmart && !isOff && !isCustom;
          }
          return !isSmart;
        case "vacuum":
          if (descriptor.kind === "suction") {
            return !isSmart && !isOff && !isCustom;
          }
          return false;
        case "mop":
          if (descriptor.kind === "mop") {
            return !isSmart && !isOff && !isCustom;
          }
          if (descriptor.kind === "mop_mode") {
            return !isSmart;
          }
          return false;
        case "custom":
          return false;
        default:
          return !isSmart;
      }
    });
  }

  _getVisibleModePanelDescriptors(state = this._getVacuumState(), presetId = this._getActiveModePanelPreset(state)) {
    return [
      this._getModeDescriptor("suction", state),
      this._getModeDescriptor("mop", state),
      this._getMopModeDescriptor(state),
    ]
      .filter(Boolean)
      .map(descriptor => ({
        ...descriptor,
        options: this._filterModePanelOptions(descriptor, presetId),
      }))
      .filter(descriptor => descriptor.options.length > 0);
  }

  _getDefaultCustomMenuItems(state) {
    const items = [];

    if (this._config?.show_return_to_base !== false && !this._isDocked(state)) {
      items.push({
        label: "Volver a base",
        icon: "mdi:home-import-outline",
        builtin_action: "return_to_base",
      });
    }

    if (this._config?.show_stop !== false && this._isActive(state)) {
      items.push({
        label: "Parar",
        icon: "mdi:stop",
        builtin_action: "stop",
      });
    }

    if (this._config?.show_locate !== false) {
      items.push({
        label: "Localizar",
        icon: "mdi:crosshairs-gps",
        builtin_action: "locate",
      });
    }

    return items;
  }

  _isMenuItemVisible(item, state) {
    const condition = normalizeTextKey(item?.visible_when || "always");

    if (condition === "active") {
      return this._isActive(state) || this._isPaused(state);
    }

    if (condition === "docked" || condition === "base") {
      return this._isDocked(state);
    }

    if (condition === "undocked" || condition === "idle_away") {
      return !this._isDocked(state);
    }

    return true;
  }

  _getVisibleCustomMenuItems(state) {
    const configuredItems = normalizeCustomMenuItems(this._config?.custom_menu?.items);
    const sourceItems = configuredItems.length ? configuredItems : this._getDefaultCustomMenuItems(state);
    return sourceItems.filter(item => this._isMenuItemVisible(item, state));
  }

  _getMapSurfaceRect() {
    return this.shadowRoot?.querySelector("[data-map-surface]")?.getBoundingClientRect() || null;
  }

  _getMapViewportPoint(event, rect = this._getMapSurfaceRect()) {
    if (!rect) {
      return null;
    }

    return {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
    };
  }

  _clampMapTransform(scale = this._mapScale, offset = this._mapOffset, rect = this._getMapSurfaceRect()) {
    const safeScale = clamp(Number(scale || 1), 1, 3);
    if (!rect || safeScale <= 1) {
      return {
        scale: 1,
        offset: { x: 0, y: 0 },
      };
    }

    const minOffsetX = rect.width * (1 - safeScale);
    const minOffsetY = rect.height * (1 - safeScale);

    return {
      scale: safeScale,
      offset: {
        x: clamp(Number(offset?.x || 0), minOffsetX, 0),
        y: clamp(Number(offset?.y || 0), minOffsetY, 0),
      },
    };
  }

  _setMapTransform(scale = this._mapScale, offset = this._mapOffset) {
    const nextTransform = this._clampMapTransform(scale, offset);
    this._mapScale = nextTransform.scale;
    this._mapOffset = nextTransform.offset;
  }

  _resetMapTransform() {
    this._mapScale = 1;
    this._mapOffset = { x: 0, y: 0 };
    this._pinchGesture = null;
    this._touchPinchGesture = null;
    this._activeMapPointers.clear();
  }

  _eventToMapPoint(event) {
    const rect = this._getMapSurfaceRect();
    if (!rect) {
      return null;
    }

    const viewportPoint = this._getMapViewportPoint(event, rect);
    if (!viewportPoint) {
      return null;
    }

    const localX = clamp((viewportPoint.x - this._mapOffset.x) / this._mapScale, 0, rect.width);
    const localY = clamp((viewportPoint.y - this._mapOffset.y) / this._mapScale, 0, rect.height);
    const x = clamp((localX / rect.width) * this._mapImageWidth, 0, this._mapImageWidth);
    const y = clamp((localY / rect.height) * this._mapImageHeight, 0, this._mapImageHeight);
    return { x, y };
  }

  _eventToVacuumPoint(event) {
    const mapPoint = this._eventToMapPoint(event);
    return mapPoint ? this._converter.mapToVacuum(mapPoint.x, mapPoint.y) : null;
  }

  _vacuumToPercent(point) {
    const mapped = this._converter.vacuumToMap(point.x, point.y);
    return {
      left: clamp((mapped.x / this._mapImageWidth) * 100, 0, 100),
      top: clamp((mapped.y / this._mapImageHeight) * 100, 0, 100),
    };
  }

  _mapToViewportPercent(point) {
    if (!point) {
      return {
        left: 50,
        top: 50,
      };
    }

    const rect = this._getMapSurfaceRect();
    const width = rect?.width || this._mapImageWidth || 1;
    const height = rect?.height || this._mapImageHeight || 1;
    const offsetX = rect ? this._mapOffset.x : 0;
    const offsetY = rect ? this._mapOffset.y : 0;
    const x = ((point.x / this._mapImageWidth) * width * this._mapScale) + offsetX;
    const y = ((point.y / this._mapImageHeight) * height * this._mapScale) + offsetY;
    return {
      left: clamp((x / width) * 100, 0, 100),
      top: clamp((y / height) * 100, 0, 100),
    };
  }

  _vacuumToViewportPercent(point) {
    const mapped = this._converter.vacuumToMap(point.x, point.y);
    return this._mapToViewportPercent(mapped);
  }

  _vacuumOutlineToSvgPoints(points) {
    return points
      .map(point => this._converter.vacuumToMap(point.x, point.y))
      .map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(" ");
  }

  _vacuumOutlineToCssPolygon(points) {
    return points
      .map(point => this._converter.vacuumToMap(point.x, point.y))
      .map(point => {
        const left = clamp((point.x / this._mapImageWidth) * 100, 0, 100);
        const top = clamp((point.y / this._mapImageHeight) * 100, 0, 100);
        return `${left.toFixed(3)}% ${top.toFixed(3)}%`;
      })
      .join(", ");
  }

  _vacuumZoneToCssPolygon(zone) {
    if (!zone) {
      return "";
    }

    return this._vacuumOutlineToCssPolygon([
      { x: zone.x1, y: zone.y1 },
      { x: zone.x2, y: zone.y1 },
      { x: zone.x2, y: zone.y2 },
      { x: zone.x1, y: zone.y2 },
    ]);
  }

  _zoneToSvgRect(zone) {
    const first = this._converter.vacuumToMap(zone.x1, zone.y1);
    const second = this._converter.vacuumToMap(zone.x2, zone.y2);
    return {
      x: Math.min(first.x, second.x),
      y: Math.min(first.y, second.y),
      width: Math.abs(second.x - first.x),
      height: Math.abs(second.y - first.y),
    };
  }

  _mapRectToVacuumZone(rect) {
    if (!rect) {
      return null;
    }

    const first = this._converter.mapToVacuum(rect.x1, rect.y1);
    const second = this._converter.mapToVacuum(rect.x2, rect.y2);
    return {
      x1: Math.round(Math.min(first.x, second.x)),
      y1: Math.round(Math.min(first.y, second.y)),
      x2: Math.round(Math.max(first.x, second.x)),
      y2: Math.round(Math.max(first.y, second.y)),
    };
  }

  _getManualZoneCountLimit() {
    return clamp(Number(this._config?.max_zone_selections || 5), 1, 10);
  }

  _sanitizeSelectedManualZoneIndex() {
    if (this._selectedManualZoneIndex >= this._manualZones.length) {
      this._selectedManualZoneIndex = this._manualZones.length - 1;
    }

    if (this._manualZones.length <= 0) {
      this._selectedManualZoneIndex = -1;
    }
  }

  _selectManualZone(index, { triggerHaptic = false } = {}) {
    const normalizedIndex = Number(index);
    if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= this._manualZones.length) {
      return;
    }

    this._selectedManualZoneIndex = normalizedIndex;
    if (triggerHaptic) {
      this._triggerHaptic("selection");
    }
    this._render();
  }

  _updateManualZone(index, nextZone) {
    if (!Number.isInteger(index) || index < 0 || index >= this._manualZones.length || !nextZone) {
      return;
    }

    this._manualZones = this._manualZones.map((zone, zoneIndex) => (zoneIndex === index ? nextZone : zone));
    this._selectedManualZoneIndex = index;
  }

  _getVisibleMapCenter() {
    const rect = this._getMapSurfaceRect();
    if (!rect) {
      return {
        x: this._mapImageWidth / 2,
        y: this._mapImageHeight / 2,
      };
    }

    return {
      x: clamp(((rect.width / 2) - this._mapOffset.x) / this._mapScale / rect.width * this._mapImageWidth, 0, this._mapImageWidth),
      y: clamp(((rect.height / 2) - this._mapOffset.y) / this._mapScale / rect.height * this._mapImageHeight, 0, this._mapImageHeight),
    };
  }

  _createDefaultManualZone() {
    const center = this._getVisibleMapCenter();
    const size = Math.max(120, Math.round(Math.min(this._mapImageWidth, this._mapImageHeight) * 0.18));
    const halfSize = size / 2;
    const rect = {
      x1: clamp(center.x - halfSize, 0, this._mapImageWidth),
      y1: clamp(center.y - halfSize, 0, this._mapImageHeight),
      x2: clamp(center.x + halfSize, 0, this._mapImageWidth),
      y2: clamp(center.y + halfSize, 0, this._mapImageHeight),
    };

    return this._mapRectToVacuumZone(rect);
  }

  _addManualZone() {
    if (this._manualZones.length >= this._getManualZoneCountLimit()) {
      return;
    }

    const zone = this._createDefaultManualZone();
    if (!zone) {
      return;
    }

    this._manualZones = [...this._manualZones, zone];
    this._selectedManualZoneIndex = this._manualZones.length - 1;
    this._draftZone = null;
    this._triggerHaptic("selection");
    this._render();
  }

  _deleteManualZone(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this._manualZones.length) {
      return;
    }

    this._manualZones = this._manualZones.filter((_zone, zoneIndex) => zoneIndex !== index);

    if (this._selectedManualZoneIndex > index) {
      this._selectedManualZoneIndex -= 1;
    } else if (this._selectedManualZoneIndex === index) {
      this._selectedManualZoneIndex = Math.min(index, this._manualZones.length - 1);
    }

    this._sanitizeSelectedManualZoneIndex();
    this._zoneHandleDrag = null;
    this._triggerHaptic("selection");
    this._render();
  }

  _getMinimumManualZoneSize() {
    return Math.max(72, Math.round(Math.min(this._mapImageWidth, this._mapImageHeight) * 0.06));
  }

  _getZoneHandlePoints(zone) {
    const rect = this._zoneToSvgRect(zone);
    return {
      rect,
      handles: [
        { id: "move", icon: "mdi:arrow-all", x: rect.x, y: rect.y, title: "Mover zona" },
        { id: "delete", icon: "mdi:trash-can-outline", x: rect.x, y: rect.y + rect.height, title: "Eliminar zona" },
        { id: "resize", icon: "mdi:arrow-bottom-right", x: rect.x + rect.width, y: rect.y + rect.height, title: "Redimensionar zona" },
      ],
    };
  }

  _updateManualZoneFromHandleDrag(event) {
    if (!this._zoneHandleDrag || event.pointerId !== this._zoneHandleDrag.pointerId) {
      return false;
    }

    const mapPoint = this._eventToMapPoint(event);
    if (!mapPoint) {
      return false;
    }

    let nextZone = null;
    if (this._zoneHandleDrag.action === "move") {
      const deltaX = mapPoint.x - this._zoneHandleDrag.startPoint.x;
      const deltaY = mapPoint.y - this._zoneHandleDrag.startPoint.y;
      const width = this._zoneHandleDrag.startRect.width;
      const height = this._zoneHandleDrag.startRect.height;
      const nextX = clamp(this._zoneHandleDrag.startRect.x + deltaX, 0, this._mapImageWidth - width);
      const nextY = clamp(this._zoneHandleDrag.startRect.y + deltaY, 0, this._mapImageHeight - height);

      nextZone = this._mapRectToVacuumZone({
        x1: nextX,
        y1: nextY,
        x2: nextX + width,
        y2: nextY + height,
      });
    } else if (this._zoneHandleDrag.action === "resize") {
      const minSize = this._getMinimumManualZoneSize();
      nextZone = this._mapRectToVacuumZone({
        x1: this._zoneHandleDrag.fixedPoint.x,
        y1: this._zoneHandleDrag.fixedPoint.y,
        x2: clamp(mapPoint.x, this._zoneHandleDrag.fixedPoint.x + minSize, this._mapImageWidth),
        y2: clamp(mapPoint.y, this._zoneHandleDrag.fixedPoint.y + minSize, this._mapImageHeight),
      });
    }

    if (!nextZone) {
      return false;
    }

    this._updateManualZone(this._zoneHandleDrag.index, nextZone);
    this._render();
    return true;
  }

  _startPinchGesture() {
    if (this._activeMapPointers.size < 2) {
      return;
    }

    const rect = this._getMapSurfaceRect();
    if (!rect) {
      return;
    }

    const [first, second] = [...this._activeMapPointers.values()];
    const midpoint = {
      x: ((first.clientX + second.clientX) / 2) - rect.left,
      y: ((first.clientY + second.clientY) / 2) - rect.top,
    };
    const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);

    this._pinchGesture = {
      startDistance: Math.max(distance, 1),
      startScale: this._mapScale,
      anchor: {
        x: (midpoint.x - this._mapOffset.x) / this._mapScale,
        y: (midpoint.y - this._mapOffset.y) / this._mapScale,
      },
    };
    this._draftZone = null;
    this._zoneHandleDrag = null;
  }

  _updatePinchGesture() {
    if (!this._pinchGesture || this._activeMapPointers.size < 2) {
      return false;
    }

    const rect = this._getMapSurfaceRect();
    if (!rect) {
      return false;
    }

    const [first, second] = [...this._activeMapPointers.values()];
    const midpoint = {
      x: ((first.clientX + second.clientX) / 2) - rect.left,
      y: ((first.clientY + second.clientY) / 2) - rect.top,
    };
    const distance = Math.max(Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY), 1);
    const scale = this._pinchGesture.startScale * (distance / this._pinchGesture.startDistance);
    const offset = {
      x: midpoint.x - (this._pinchGesture.anchor.x * scale),
      y: midpoint.y - (this._pinchGesture.anchor.y * scale),
    };

    this._setMapTransform(scale, offset);
    this._render();
    return true;
  }

  _getTouchDistance(touches) {
    if (!touches || touches.length < 2) {
      return 0;
    }

    const [first, second] = Array.from(touches);
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  }

  _getTouchMidpoint(touches, rect = this._getMapSurfaceRect()) {
    if (!rect || !touches || touches.length < 2) {
      return null;
    }

    const [first, second] = Array.from(touches);
    return {
      x: clamp(((first.clientX + second.clientX) / 2) - rect.left, 0, rect.width),
      y: clamp(((first.clientY + second.clientY) / 2) - rect.top, 0, rect.height),
    };
  }

  _beginTouchPinchGesture(touches) {
    const rect = this._getMapSurfaceRect();
    if (!rect || !touches || touches.length < 2) {
      this._touchPinchGesture = null;
      return false;
    }

    const midpoint = this._getTouchMidpoint(touches, rect);
    const distance = this._getTouchDistance(touches);
    if (!midpoint || distance <= 0) {
      this._touchPinchGesture = null;
      return false;
    }

    this._activeMapPointers.clear();
    this._pinchGesture = null;
    this._draftZone = null;
    this._zoneHandleDrag = null;
    this._pointerStart = null;
    this._touchPinchGesture = {
      startDistance: Math.max(distance, 1),
      startScale: this._mapScale,
      anchor: {
        x: (midpoint.x - this._mapOffset.x) / this._mapScale,
        y: (midpoint.y - this._mapOffset.y) / this._mapScale,
      },
    };
    return true;
  }

  _onShadowTouchStart(event) {
    const zoneHandleTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.zoneHandleIndex && node.dataset?.zoneHandleAction === "delete");
    if (zoneHandleTarget && event.touches.length === 1) {
      event.preventDefault();
      event.stopPropagation();
      this._deleteManualZone(Number(zoneHandleTarget.dataset.zoneHandleIndex));
      return;
    }

    const surface = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.mapSurface === "main");
    if (!surface || event.touches.length < 2) {
      return;
    }

    if (this._beginTouchPinchGesture(event.touches)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  _onShadowTouchMove(event) {
    if (!this._touchPinchGesture) {
      return;
    }

    if (event.touches.length < 2) {
      this._touchPinchGesture = null;
      return;
    }

    const rect = this._getMapSurfaceRect();
    const midpoint = this._getTouchMidpoint(event.touches, rect);
    if (!rect || !midpoint) {
      return;
    }

    const distance = Math.max(this._getTouchDistance(event.touches), 1);
    const scale = this._touchPinchGesture.startScale * (distance / this._touchPinchGesture.startDistance);
    const offset = {
      x: midpoint.x - (this._touchPinchGesture.anchor.x * scale),
      y: midpoint.y - (this._touchPinchGesture.anchor.y * scale),
    };

    this._setMapTransform(scale, offset);
    this._render();
    event.preventDefault();
    event.stopPropagation();
  }

  _onShadowTouchEnd(event) {
    if (!this._touchPinchGesture) {
      return;
    }

    if (event.touches.length < 2) {
      this._touchPinchGesture = null;
      return;
    }

    if (this._beginTouchPinchGesture(event.touches)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  _navigate(path) {
    if (!path) {
      return;
    }
    if (this._hass?.navigate) {
      this._hass.navigate(path);
      return;
    }
    if (window?.history?.pushState) {
      window.history.pushState(null, "", path);
      fireEvent(this, "location-changed", { replace: false });
      return;
    }
    fireEvent(this, "hass-navigate", { path });
  }

  _runExternalAction(actionConfig = {}) {
    const action = normalizeTextKey(actionConfig.action);

    if (!action || action === "none") {
      return;
    }

    if (action === "navigate") {
      this._navigate(actionConfig.navigation_path);
      return;
    }

    if (action === "url") {
      const target = actionConfig.new_tab === true ? "_blank" : "_self";
      window.open(actionConfig.url_path || actionConfig.url, target);
      return;
    }

    if (action === "more_info") {
      fireEvent(this, "hass-more-info", {
        entityId: actionConfig.entity || this._config?.entity,
      });
      return;
    }

    if (["call_service", "call-service", "perform_action", "perform-action"].includes(action)) {
      const service = actionConfig.service || actionConfig.perform_action;
      if (!service || !this._hass) {
        return;
      }
      const [domain, serviceName] = String(service).split(".");
      if (!domain || !serviceName) {
        return;
      }
      this._hass.callService(domain, serviceName, actionConfig.service_data || {}, actionConfig.target);
    }
  }

  _callVacuumService(service, data = {}) {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    return this._hass.callService("vacuum", service, {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _callNamedService(service, data = {}, target = null) {
    if (!this._hass || !service) {
      return;
    }

    const [domain, serviceName] = String(service).split(".");
    if (!domain || !serviceName) {
      return;
    }

    return this._hass.callService(domain, serviceName, data, target || undefined);
  }

  _toggleRoomSelection(roomId) {
    this._selectedRoomIds = this._selectedRoomIds.includes(roomId)
      ? this._selectedRoomIds.filter(id => id !== roomId)
      : [...this._selectedRoomIds, roomId];
    this._triggerHaptic("selection");
    this._render();
  }

  _togglePredefinedZone(zoneId) {
    this._selectedPredefinedZoneIds = this._selectedPredefinedZoneIds.includes(zoneId)
      ? this._selectedPredefinedZoneIds.filter(id => id !== zoneId)
      : [...this._selectedPredefinedZoneIds, zoneId];
    this._selectedManualZoneIndex = -1;
    this._triggerHaptic("selection");
    this._render();
  }

  _restoreTransientZoneMode() {
    if (!this._transientZoneReturnMode) {
      return false;
    }

    this._selectedPredefinedZoneIds = [];
    this._manualZones = [];
    this._selectedManualZoneIndex = -1;
    this._draftZone = null;
    this._gotoPoint = null;
    this._zoneHandleDrag = null;
    this._activeUtilityPanel = null;
    this._activeMode = this._transientZoneReturnMode;
    this._transientZoneReturnMode = "";
    return true;
  }

  _openTransientZoneMode() {
    const hasZoneMode = this._getAvailableModes().some(mode => mode.id === "zone");
    if (!hasZoneMode) {
      return;
    }

    if (this._activeMode !== "zone") {
      this._transientZoneReturnMode = this._activeMode || "all";
      this._activeMode = "zone";
      this._activeUtilityPanel = null;
      this._selectedPredefinedZoneIds = [];
      this._manualZones = [];
      this._selectedManualZoneIndex = -1;
      this._draftZone = null;
      this._gotoPoint = null;
    }

    this._addManualZone();
  }

  _setActiveMode(modeId) {
    if (!modeId || modeId === this._activeMode) {
      return;
    }
    this._activeMode = modeId;
    this._transientZoneReturnMode = "";
    this._activeUtilityPanel = null;
    this._manualZones = [];
    this._selectedManualZoneIndex = -1;
    this._draftZone = null;
    this._gotoPoint = null;
    this._selectedPredefinedZoneIds = [];
    this._triggerHaptic("selection");
    this._render();
  }

  _toggleUtilityPanel(panelId) {
    this._activeUtilityPanel = this._activeUtilityPanel === panelId ? null : panelId;
    this._triggerHaptic("selection");
    this._render();
  }

  _cycleRepeats() {
    const maxRepeats = clamp(Number(this._config?.max_repeats || 1), 1, 9);
    this._repeats = this._repeats >= maxRepeats ? 1 : this._repeats + 1;
    this._triggerHaptic("selection");
    this._render();
  }

  _clearSelection() {
    this._selectedRoomIds = [];
    this._selectedPredefinedZoneIds = [];
    this._manualZones = [];
    this._selectedManualZoneIndex = -1;
    this._draftZone = null;
    this._gotoPoint = null;
    this._triggerHaptic("selection");
    this._render();
  }

  _goBack() {
    if (this._restoreTransientZoneMode()) {
      this._triggerHaptic("selection");
      this._render();
      return;
    }

    const shouldReturnToAll = this._activeMode !== "all";
    this._selectedRoomIds = [];
    this._selectedPredefinedZoneIds = [];
    this._manualZones = [];
    this._selectedManualZoneIndex = -1;
    this._draftZone = null;
    this._gotoPoint = null;
    this._zoneHandleDrag = null;
    this._activeUtilityPanel = null;

    if (shouldReturnToAll) {
      this._activeMode = "all";
    }

    this._triggerHaptic("selection");
    this._render();
  }

  async _runMapAction() {
    const state = this._getVacuumState();
    const selectedPredefinedZones = this._getPredefinedZones()
      .filter(zone => this._selectedPredefinedZoneIds.includes(zone.id))
      .flatMap(zone => zone.zones.map(item => [...item, this._repeats]));
    const manualZones = this._manualZones.map(zone => [zone.x1, zone.y1, zone.x2, zone.y2, this._repeats]);
    const selectedZones = [...selectedPredefinedZones, ...manualZones].slice(0, clamp(Number(this._config?.max_zone_selections || 5), 1, 10));
    const canRunZoneAction = this._activeMode === "zone" && selectedZones.length > 0;

    if ((this._isCleaning(state) || this._isPaused(state)) && !canRunZoneAction) {
      await this._callVacuumService(this._isCleaning(state) ? "pause" : "start");
      this._triggerHaptic("selection");
      return;
    }

    if (this._activeMode === "rooms" && this._selectedRoomIds.length) {
      const segments = this._selectedRoomIds
        .map(id => parseInteger(id))
        .filter(Number.isFinite);

      if (segments.length) {
        this._activeCleaningRoomIds = segments.map(item => String(item));
        this._activeCleaningZones = [];
        await this._callNamedService("vacuum.send_command", {
          entity_id: this._config.entity,
          command: "app_segment_clean",
          params: [{
            segments,
            repeat: this._repeats,
          }],
        });
        this._triggerHaptic("success");
        this._render();
        return;
      }
    }

    if (this._activeMode === "zone") {
      if (selectedZones.length) {
        const isTransientZoneAddition = Boolean(this._transientZoneReturnMode) && (
          this._isCleaning(state) ||
          this._isPaused(state) ||
          this._isReturning(state) ||
          this._isRoomCleaningSessionActive(state)
        );
        if (!this._isRoomCleaningSessionActive(state)) {
          this._activeCleaningRoomIds = [];
        }
        this._activeCleaningZones = selectedZones.map(zone => ({
          x1: Number(zone[0]),
          y1: Number(zone[1]),
          x2: Number(zone[2]),
          y2: Number(zone[3]),
        }));

        if (isTransientZoneAddition && this._isCleaning(state)) {
          await this._callVacuumService("pause");
          await new Promise(resolve => window.setTimeout(resolve, 450));
        }

        await this._callNamedService("vacuum.send_command", {
          entity_id: this._config.entity,
          command: "app_zoned_clean",
          params: selectedZones,
        });
        this._restoreTransientZoneMode();
        this._triggerHaptic("success");
        this._render();
        return;
      }
    }

    if (this._activeMode === "goto" && this._gotoPoint) {
      this._activeCleaningRoomIds = [];
      this._activeCleaningZones = [];
      await this._callNamedService("roborock.set_vacuum_goto_position", {
        entity_id: this._config.entity,
        x: Math.round(this._gotoPoint.x),
        y: Math.round(this._gotoPoint.y),
      });
      this._triggerHaptic("success");
      return;
    }

    this._activeCleaningRoomIds = [];
    this._activeCleaningZones = [];
    await this._callVacuumService("start");
    this._triggerHaptic("selection");
  }

  _runCustomMenuItem(item) {
    if (!item) {
      return;
    }

    if (item.builtin_action) {
      this._handleControlAction(item.builtin_action);
    } else {
      this._triggerHaptic("selection");
      this._runExternalAction(item.tap_action || {});
    }

    this._activeUtilityPanel = null;
    this._render();
  }

  _handleControlAction(action) {
    switch (action) {
      case "primary":
        this._runMapAction();
        break;
      case "toggle_modes":
        this._toggleUtilityPanel("modes");
        break;
      case "toggle_dock_panel":
        if (this._activeUtilityPanel !== "dock") {
          this._activeDockPanelSection = DOCK_PANEL_SECTIONS[0]?.id || "control";
        }
        this._toggleUtilityPanel("dock");
        break;
      case "return_to_base":
        this._callVacuumService("return_to_base");
        this._triggerHaptic("selection");
        break;
      case "stop":
        this._callVacuumService("stop");
        this._triggerHaptic("selection");
        break;
      case "locate":
        this._callVacuumService("locate");
        this._triggerHaptic("selection");
        break;
      case "clear":
        if (this._restoreTransientZoneMode()) {
          this._triggerHaptic("selection");
          this._render();
          break;
        }
        this._navigate("/lovelace/principal");
        break;
      case "add_zone":
        if ((this._isCleaning(this._getVacuumState()) || this._isPaused(this._getVacuumState()) || this._isReturning(this._getVacuumState())) && this._activeMode !== "zone") {
          this._openTransientZoneMode();
        } else {
          this._addManualZone();
        }
        break;
      case "repeats":
        this._cycleRepeats();
        break;
      default:
        break;
    }
  }

  _onShadowClick(event) {
    const zoneHandleTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.zoneHandleIndex && node.dataset?.zoneHandleAction);
    if (zoneHandleTarget) {
      event.preventDefault();
      event.stopPropagation();

      const index = Number(zoneHandleTarget.dataset.zoneHandleIndex);
      const action = zoneHandleTarget.dataset.zoneHandleAction;
      if (action === "delete") {
        this._deleteManualZone(index);
      } else {
        this._selectManualZone(index, { triggerHaptic: true });
      }
      return;
    }

    const roomTarget = event.composedPath().find(node => node instanceof Element && typeof node.getAttribute === "function" && node.getAttribute("data-room-id"));
    if (roomTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._toggleRoomSelection(roomTarget.getAttribute("data-room-id"));
      return;
    }

    const zoneTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.zoneId);
    if (zoneTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._togglePredefinedZone(zoneTarget.dataset.zoneId);
      return;
    }

    const gotoTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.gotoId);
    if (gotoTarget) {
      const gotoPoint = this._getGotoPoints().find(point => point.id === gotoTarget.dataset.gotoId);
      if (gotoPoint?.position) {
        event.preventDefault();
        event.stopPropagation();
        this._gotoPoint = gotoPoint.position;
        this._triggerHaptic("selection");
        this._render();
      }
      return;
    }

    const modeTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.modeId);
    if (modeTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._setActiveMode(modeTarget.dataset.modeId);
      return;
    }

    const headerAction = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.headerActionIndex);
    if (headerAction) {
      const action = this._getHeaderIcons()[Number(headerAction.dataset.headerActionIndex)];
      if (action) {
        event.preventDefault();
        event.stopPropagation();
        this._triggerHaptic("selection");
        this._runExternalAction(action.tap_action);
      }
      return;
    }

    const manualZoneTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.manualZoneIndex);
    if (manualZoneTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._selectManualZone(Number(manualZoneTarget.dataset.manualZoneIndex), { triggerHaptic: true });
      return;
    }

    const controlTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.controlAction);
    if (controlTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._handleControlAction(controlTarget.dataset.controlAction);
      return;
    }

    const modePresetTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.modePresetId);
    if (modePresetTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._selectModePanelPreset(modePresetTarget.dataset.modePresetId, this._getVacuumState());
      return;
    }

    const modeOptionTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.modeOptionKind && node.dataset?.modeOptionValue);
    if (modeOptionTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._setModeOption(
        modeOptionTarget.dataset.modeOptionKind,
        modeOptionTarget.dataset.modeOptionValue,
        this._getVacuumState(),
      );
      return;
    }

    const dockSectionTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.dockSectionId);
    if (dockSectionTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._setActiveDockPanelSection(dockSectionTarget.dataset.dockSectionId);
      return;
    }

    const dockActionTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.dockActionId);
    if (dockActionTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._runDockControlAction(dockActionTarget.dataset.dockActionId, this._getVacuumState());
      return;
    }

    const customMenuItemTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.customMenuIndex);
    if (customMenuItemTarget) {
      const items = this._getVisibleCustomMenuItems(this._getVacuumState());
      const item = items[Number(customMenuItemTarget.dataset.customMenuIndex)];
      if (item) {
        event.preventDefault();
        event.stopPropagation();
        this._runCustomMenuItem(item);
      }
    }
  }

  _onShadowChange(event) {
    const selectTarget = event.composedPath().find(node => node instanceof HTMLSelectElement && node.dataset?.dockSettingId);
    if (!selectTarget) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._setDockSettingOption(selectTarget.dataset.dockSettingId, selectTarget.value, this._getVacuumState());
  }

  _onShadowPointerDown(event) {
    if (this._touchPinchGesture && event.pointerType === "touch") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const surface = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.mapSurface === "main");
    if (!surface) {
      return;
    }

    if (event.pointerId !== undefined) {
      this._activeMapPointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      try {
        surface.setPointerCapture(event.pointerId);
      } catch (_error) {
        // Ignore unsupported pointer capture.
      }
    }

    if (this._activeMapPointers.size >= 2) {
      this._startPinchGesture();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this._activeMode !== "zone") {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const zoneHandleTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.zoneHandleIndex && node.dataset?.zoneHandleAction);
    if (zoneHandleTarget) {
      const index = Number(zoneHandleTarget.dataset.zoneHandleIndex);
      const zone = this._manualZones[index];
      const handlePoints = zone ? this._getZoneHandlePoints(zone) : null;
      const selectedHandle = handlePoints?.handles?.find(handle => handle.id === zoneHandleTarget.dataset.zoneHandleAction);

      if (!zone || !selectedHandle) {
        return;
      }

      this._selectedManualZoneIndex = index;
      event.preventDefault();
      event.stopPropagation();

      if (selectedHandle.id === "delete") {
        this._deleteManualZone(index);
        return;
      }

      const rect = handlePoints.rect;
      const mapPoint = this._eventToMapPoint(event);
      this._zoneHandleDrag = selectedHandle.id === "move"
        ? {
            pointerId: event.pointerId,
            index,
            action: "move",
            startPoint: mapPoint || { x: rect.x, y: rect.y },
            startRect: rect,
          }
        : {
            pointerId: event.pointerId,
            index,
            action: "resize",
            fixedPoint: {
              x: rect.x,
              y: rect.y,
            },
          };

      this._render();
      return;
    }

    const skip = event.composedPath().find(node => node instanceof HTMLElement && (
      node.dataset?.roomId ||
      node.dataset?.zoneId ||
      node.dataset?.gotoId ||
      node.dataset?.controlAction ||
      node.dataset?.modeId ||
      node.dataset?.headerActionIndex ||
      node.dataset?.modeOptionKind ||
      node.dataset?.customMenuIndex ||
      node.dataset?.dockSectionId ||
      node.dataset?.dockActionId ||
      node.dataset?.dockSettingId ||
      node.dataset?.manualZoneIndex
    ));

    if (skip) {
      return;
    }

    const vacuumPoint = this._eventToVacuumPoint(event);
    if (!vacuumPoint) {
      return;
    }

    if (this._manualZones.length >= this._getManualZoneCountLimit()) {
      return;
    }

    this._pointerStart = vacuumPoint;
    this._pointerSurfaceRect = this._getMapSurfaceRect();
    this._draftZone = {
      x1: Math.round(vacuumPoint.x),
      y1: Math.round(vacuumPoint.y),
      x2: Math.round(vacuumPoint.x),
      y2: Math.round(vacuumPoint.y),
    };

    event.preventDefault();
    event.stopPropagation();
    this._render();
  }

  _onShadowPointerMove(event) {
    if (this._touchPinchGesture && event.pointerType === "touch") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this._activeMapPointers.has(event.pointerId)) {
      this._activeMapPointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    if (this._updatePinchGesture()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this._updateManualZoneFromHandleDrag(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (!this._draftZone || this._activeMode !== "zone") {
      return;
    }

    const vacuumPoint = this._eventToVacuumPoint(event);
    if (!vacuumPoint) {
      return;
    }

    this._draftZone = {
      x1: Math.round(this._pointerStart.x),
      y1: Math.round(this._pointerStart.y),
      x2: Math.round(vacuumPoint.x),
      y2: Math.round(vacuumPoint.y),
    };
    this._render();
  }

  _onShadowPointerUp(event) {
    if (this._touchPinchGesture && event.pointerType === "touch") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const wasPinching = Boolean(this._pinchGesture);
    if (this._activeMapPointers.has(event.pointerId)) {
      this._activeMapPointers.delete(event.pointerId);
    }

    if (wasPinching) {
      if (this._activeMapPointers.size < 2) {
        this._pinchGesture = null;
      }
      return;
    }

    if (this._zoneHandleDrag?.pointerId === event.pointerId) {
      this._zoneHandleDrag = null;
      this._triggerHaptic("selection");
      this._render();
      return;
    }

    if (this._activeMode === "goto") {
      const skip = event.composedPath().find(node => node instanceof HTMLElement && (
        node.dataset?.roomId ||
        node.dataset?.zoneId ||
        node.dataset?.gotoId ||
        node.dataset?.controlAction ||
        node.dataset?.modeId ||
        node.dataset?.headerActionIndex ||
        node.dataset?.modeOptionKind ||
        node.dataset?.customMenuIndex ||
        node.dataset?.dockSectionId ||
        node.dataset?.dockActionId ||
        node.dataset?.dockSettingId ||
        node.dataset?.manualZoneIndex ||
        node.dataset?.zoneHandleIndex
      ));

      const surface = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.mapSurface === "main");
      if (!skip && surface) {
        const point = this._eventToVacuumPoint(event);
        if (point) {
          this._gotoPoint = {
            x: Math.round(point.x),
            y: Math.round(point.y),
          };
          this._triggerHaptic("selection");
          this._render();
        }
      }
      return;
    }

    if (!this._draftZone || this._activeMode !== "zone") {
      return;
    }

    const zone = this._draftZone;
    this._draftZone = null;

    const width = Math.abs(zone.x2 - zone.x1);
    const height = Math.abs(zone.y2 - zone.y1);
    if (width > 200 && height > 200) {
      this._manualZones = [...this._manualZones, {
        x1: Math.min(zone.x1, zone.x2),
        y1: Math.min(zone.y1, zone.y2),
        x2: Math.max(zone.x1, zone.x2),
        y2: Math.max(zone.y1, zone.y2),
      }];
      this._selectedManualZoneIndex = this._manualZones.length - 1;
      this._triggerHaptic("selection");
    }

    this._render();
  }

  _onMapImageLoad(event) {
    const image = event.currentTarget;
    const width = Number(image?.naturalWidth || image?.width || 0);
    const height = Number(image?.naturalHeight || image?.height || 0);
    if (width > 0 && height > 0) {
      this._mapImageWidth = width;
      this._mapImageHeight = height;
      this._render();
    }
  }

  _estimateRoomMarkerFootprint(room, markerSize, labelSize, iconSize) {
    if (this._config?.show_room_labels === false) {
      return {
        width: markerSize,
        height: markerSize,
      };
    }

    const label = String(room?.label || room?.id || "").trim();
    const estimatedTextWidth = Math.max(labelSize * 2.6, label.length * labelSize * 0.57);
    return {
      width: Math.max(markerSize, estimatedTextWidth + iconSize + 24),
      height: markerSize,
    };
  }

  _isPointInsideRoom(point, room) {
    return arrayFromMaybe(room?.outlines).some(outline => pointInPolygon(point, outline));
  }

  _getRoomMarkerCandidatePoints(room) {
    const outlines = arrayFromMaybe(room?.outlines)
      .filter(outline => outline.length >= 3)
      .sort((left, right) => polygonArea(right) - polygonArea(left));
    const primaryOutline = outlines[0] || arrayFromMaybe(room?.outline);
    const bounds = polygonBounds(primaryOutline);
    const overallCenter = room?.outline?.length ? centroid(room.outline) : centroid(primaryOutline);
    const lowerCenter = {
      x: bounds.minX + (bounds.width * 0.5),
      y: bounds.minY + (bounds.height * 0.72),
    };
    const lowerDeepCenter = {
      x: bounds.minX + (bounds.width * 0.5),
      y: bounds.minY + (bounds.height * 0.84),
    };
    const upperCenter = {
      x: bounds.minX + (bounds.width * 0.5),
      y: bounds.minY + (bounds.height * 0.36),
    };
    const leftCenter = {
      x: bounds.minX + (bounds.width * 0.34),
      y: bounds.minY + (bounds.height * 0.56),
    };
    const rightCenter = {
      x: bounds.minX + (bounds.width * 0.66),
      y: bounds.minY + (bounds.height * 0.56),
    };

    const candidates = [
      room?.labelPoint,
      lowerCenter,
      centroid(primaryOutline),
      lowerDeepCenter,
      upperCenter,
      leftCenter,
      rightCenter,
      room?.iconPoint,
      overallCenter,
    ]
      .filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))
      .filter((point, index, items) => items.findIndex(item => Math.abs(item.x - point.x) < 1 && Math.abs(item.y - point.y) < 1) === index);

    return candidates.filter(point => this._isPointInsideRoom(point, room));
  }

  _getRoomMarkerPlacements(rooms, markerSize, labelSize, iconSize) {
    const mapRect = this._getMapSurfaceRect();
    const viewportWidth = mapRect?.width || this._mapImageWidth || 1;
    const viewportHeight = mapRect?.height || this._mapImageHeight || 1;
    const placements = new Map();
    const placedRects = [];

    const orderedRooms = rooms
      .filter(room => room.outlines.length > 0)
      .map(room => {
        const primaryOutline = [...room.outlines].sort((left, right) => polygonArea(right) - polygonArea(left))[0] || room.outline;
        return {
          room,
          area: polygonArea(primaryOutline) || polygonArea(room.outline),
          preferredAnchor: room.labelPoint || room.iconPoint || centroid(room.outline),
        };
      })
      .sort((left, right) => left.area - right.area);

    orderedRooms.forEach(({ room, preferredAnchor }) => {
      const footprint = this._estimateRoomMarkerFootprint(room, markerSize, labelSize, iconSize);
      const candidates = this._getRoomMarkerCandidatePoints(room);
      const fallbackAnchor = preferredAnchor && Number.isFinite(preferredAnchor.x) && Number.isFinite(preferredAnchor.y)
        ? preferredAnchor
        : centroid(room.outline);

      if (!candidates.length && fallbackAnchor) {
        candidates.push(fallbackAnchor);
      }

      let bestPlacement = null;
      let bestScore = Number.POSITIVE_INFINITY;

      candidates.forEach((candidate, index) => {
        const percent = this._vacuumToViewportPercent(candidate);
        const centerX = (percent.left / 100) * viewportWidth;
        const centerY = ((percent.top / 100) * viewportHeight) + Number(room.labelOffsetY || 0);
        const rect = {
          left: centerX - (footprint.width / 2),
          top: centerY - (footprint.height / 2),
          right: centerX + (footprint.width / 2),
          bottom: centerY + (footprint.height / 2),
        };
        const overflow = (
          Math.max(0, 8 - rect.left) +
          Math.max(0, 8 - rect.top) +
          Math.max(0, rect.right - (viewportWidth - 8)) +
          Math.max(0, rect.bottom - (viewportHeight - 8))
        );
        const overlap = placedRects.reduce((acc, placedRect) => acc + rectIntersectionArea(rect, placedRect), 0);
        const distancePenalty = preferredAnchor
          ? Math.hypot(candidate.x - preferredAnchor.x, candidate.y - preferredAnchor.y) * 0.01
          : 0;
        const score = (overlap * 1000) + (overflow * 100) + (index * 4) + distancePenalty;

        if (score < bestScore) {
          bestScore = score;
          bestPlacement = {
            left: clamp((centerX / viewportWidth) * 100, 0, 100),
            top: clamp((centerY / viewportHeight) * 100, 0, 100),
            rect,
          };
        }

        if (overlap === 0 && overflow === 0 && index > 0) {
          bestScore = score;
          bestPlacement = {
            left: clamp((centerX / viewportWidth) * 100, 0, 100),
            top: clamp((centerY / viewportHeight) * 100, 0, 100),
            rect,
          };
        }
      });

      if (bestPlacement) {
        placements.set(String(room.id), bestPlacement);
        placedRects.push(bestPlacement.rect);
      }
    });

    return placements;
  }

  _renderRoomMarkers(rooms) {
    if (this._config?.show_room_markers === false) {
      return "";
    }

    const highlightedRoomIds = new Set(this._getHighlightedRoomIds());
    const markerSize = Math.max(22, Math.round(parseSizeToPixels(this._config?.styles?.map?.marker_size, 34) * 0.76));
    const labelSize = Math.max(9, Math.round(parseSizeToPixels(this._config?.styles?.map?.label_size, 12) * 0.84));
    const iconSize = Math.max(12, Math.round(markerSize * 0.42));
    const placements = this._getRoomMarkerPlacements(rooms, markerSize, labelSize, iconSize);

    return rooms
      .filter(room => room.outlines.length > 0)
      .map(room => {
      const placement = placements.get(String(room.id));
      const anchor = room.iconPoint || room.labelPoint || centroid(room.outline);
      const percent = placement || this._vacuumToViewportPercent(anchor);
      const selected = highlightedRoomIds.has(String(room.id));
      return `
        <button
          class="advance-vacuum-card__room-marker ${selected ? "is-selected" : ""} ${this._config?.show_room_labels === false ? "is-icon-only" : ""}"
          style="left:${percent.left}%; top:${percent.top}%; --marker-size:${markerSize}px; --room-label-size:${labelSize}px; --room-icon-size:${iconSize}px; --room-marker-gap:5px; --room-marker-padding:0 9px;"
          data-room-id="${escapeHtml(room.id)}"
          title="${escapeHtml(room.label || room.id)}"
        >
          <ha-icon icon="${escapeHtml(room.icon || "mdi:broom")}"></ha-icon>
          ${
            this._config?.show_room_labels === false
              ? ""
              : `<span>${escapeHtml(room.label || room.id)}</span>`
          }
        </button>
      `;
    }).join("");
  }

  _renderRoomSelectionHighlights(rooms, highlightedRoomIds, mapImageUrl) {
    if (
      this._activeMode !== "rooms" ||
      !mapImageUrl
    ) {
      return "";
    }

    const highlights = rooms
      .filter(room => highlightedRoomIds.has(String(room.id)))
      .flatMap(room => room.outlines.map((outline, index) => ({
        clipPath: this._vacuumOutlineToCssPolygon(outline),
        key: `${room.id}-${index}`,
      })))
      .filter(item => item.clipPath);

    if (!highlights.length) {
      return "";
    }

    return `
      <div class="advance-vacuum-card__room-highlight-layer" aria-hidden="true">
        ${highlights.map(highlight => `
          <img
            class="advance-vacuum-card__room-highlight-image"
            src="${escapeHtml(mapImageUrl)}"
            alt=""
            draggable="false"
            style="clip-path: polygon(${escapeHtml(highlight.clipPath)});"
            data-room-highlight-id="${escapeHtml(highlight.key)}"
          />
        `).join("")}
      </div>
    `;
  }

  _renderZoneSelectionHighlights(zones, mapImageUrl) {
    if (
      this._activeMode !== "rooms" ||
      !Array.isArray(zones) ||
      !zones.length ||
      !mapImageUrl
    ) {
      return "";
    }

    const highlights = zones
      .map((zone, index) => ({
        clipPath: this._vacuumZoneToCssPolygon(zone),
        key: `zone-${index}`,
      }))
      .filter(item => item.clipPath);

    if (!highlights.length) {
      return "";
    }

    return `
      <div class="advance-vacuum-card__room-highlight-layer advance-vacuum-card__room-highlight-layer--zones" aria-hidden="true">
        ${highlights.map(highlight => `
          <img
            class="advance-vacuum-card__room-highlight-image"
            src="${escapeHtml(mapImageUrl)}"
            alt=""
            draggable="false"
            style="clip-path: polygon(${escapeHtml(highlight.clipPath)});"
            data-zone-highlight-id="${escapeHtml(highlight.key)}"
          />
        `).join("")}
      </div>
    `;
  }

  _renderRoomFallbackList(rooms) {
    if (this._activeMode !== "rooms" || !rooms.length) {
      return "";
    }

    const highlightedRoomIds = new Set(this._getHighlightedRoomIds());
    const fallbackRooms = rooms.filter(room => room.outlines.length === 0);
    if (!fallbackRooms.length) {
      return "";
    }

    return `
      <div class="advance-vacuum-card__room-list">
        ${fallbackRooms.map(room => `
          <button
            class="advance-vacuum-card__room-chip ${highlightedRoomIds.has(String(room.id)) ? "is-selected" : ""}"
            data-room-id="${escapeHtml(room.id)}"
            title="${escapeHtml(room.label || room.id)}"
          >
            <ha-icon icon="${escapeHtml(room.icon || "mdi:broom")}"></ha-icon>
            <span>${escapeHtml(room.label || room.id)}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  _renderGotoMarkers(points) {
    if (this._activeMode !== "goto") {
      return "";
    }

    return points.map(point => {
      const percent = this._vacuumToViewportPercent(point.position);
      const selected = this._gotoPoint && Math.round(this._gotoPoint.x) === Math.round(point.position.x) && Math.round(this._gotoPoint.y) === Math.round(point.position.y);
      return `
        <button
          class="advance-vacuum-card__goto-marker ${selected ? "is-selected" : ""}"
          style="left:${percent.left}%; top:${percent.top}%;"
          data-goto-id="${escapeHtml(point.id)}"
          title="${escapeHtml(point.label || "Punto")}"
        >
          <ha-icon icon="${escapeHtml(point.icon || "mdi:map-marker")}"></ha-icon>
        </button>
      `;
    }).join("");
  }

  _renderManualZoneEditors() {
    if (this._activeMode !== "zone" || !this._manualZones.length) {
      return "";
    }

    this._sanitizeSelectedManualZoneIndex();

    return this._manualZones.map((zone, index) => {
      const { rect, handles } = this._getZoneHandlePoints(zone);
      const selected = index === this._selectedManualZoneIndex;
      const topLeft = this._mapToViewportPercent({ x: rect.x, y: rect.y });
      const bottomRight = this._mapToViewportPercent({ x: rect.x + rect.width, y: rect.y + rect.height });
      const left = Math.min(topLeft.left, bottomRight.left);
      const top = Math.min(topLeft.top, bottomRight.top);
      const width = Math.abs(bottomRight.left - topLeft.left);
      const height = Math.abs(bottomRight.top - topLeft.top);
      const handleMarkup = selected
        ? handles.map(handle => {
            const percent = this._mapToViewportPercent({ x: handle.x, y: handle.y });
            return `
              <button
                class="advance-vacuum-card__zone-handle"
                style="left:${percent.left}%; top:${percent.top}%;"
                data-zone-handle-index="${index}"
                data-zone-handle-action="${escapeHtml(handle.id)}"
                title="${escapeHtml(handle.title)}"
              >
                <ha-icon icon="${escapeHtml(handle.icon)}"></ha-icon>
              </button>
            `;
          }).join("")
        : "";

      return `
        <button
          class="advance-vacuum-card__zone-hitbox ${selected ? "is-selected" : ""}"
          style="left:${left}%; top:${top}%; width:${width}%; height:${height}%;"
          data-manual-zone-index="${index}"
          title="Editar zona ${index + 1}"
        ></button>
        ${handleMarkup}
      `;
    }).join("");
  }

  _renderMapTools() {
    const state = this._getVacuumState();
    const hasZoneMode = this._getAvailableModes().some(mode => mode.id === "zone");
    const isCleaningSessionActive = this._isCleaning(state) || this._isPaused(state) || this._isReturning(state);
    const showAddZoneButton = hasZoneMode && (this._activeMode === "zone" || isCleaningSessionActive);
    const canAddZone = this._manualZones.length < this._getManualZoneCountLimit();
    return `
      <div class="advance-vacuum-card__map-tools">
        <div class="advance-vacuum-card__map-tools-group advance-vacuum-card__map-tools-group--left">
          <button
            class="advance-vacuum-card__map-tool advance-vacuum-card__map-tool--back"
            data-control-action="clear"
            title="Volver al panel principal"
          >
            <ha-icon icon="mdi:arrow-left"></ha-icon>
          </button>
        </div>
        <div class="advance-vacuum-card__map-tools-group advance-vacuum-card__map-tools-group--right">
          ${
            showAddZoneButton
              ? `
                <button
                  class="advance-vacuum-card__map-tool advance-vacuum-card__map-tool--add ${!canAddZone ? "is-disabled" : ""}"
                  data-control-action="add_zone"
                  title="Añadir zona"
                  ${!canAddZone ? "disabled" : ""}
                >
                  <ha-icon icon="mdi:plus"></ha-icon>
                  <span class="advance-vacuum-card__map-tool-label">Zona</span>
                </button>
              `
              : ""
          }
        </div>
      </div>
    `;
  }

  _renderStateChip(state) {
    if (this._config?.show_state_chip === false) {
      return "";
    }
    return `
      <span class="advance-vacuum-card__chip">
        ${escapeHtml(this._getStateLabel(state))}
      </span>
    `;
  }

  _renderBatteryChip(state) {
    const level = this._getBatteryLevel(state);
    if (this._config?.show_battery_chip === false || level === null) {
      return "";
    }
    return `
      <span class="advance-vacuum-card__chip advance-vacuum-card__chip--battery" style="--battery-color:${escapeHtml(this._getBatteryColor(level))};">
        <ha-icon icon="mdi:battery"></ha-icon>
        <span>${level}%</span>
      </span>
    `;
  }

  _renderModePanel(state) {
    const activePreset = this._getActiveModePanelPreset(state);
    const descriptors = this._getVisibleModePanelDescriptors(state, activePreset);
    const highlightedRoomIds = new Set(this._getHighlightedRoomIds(state));
    if (!PANEL_MODE_PRESETS.length && !descriptors.length && this._activeMode === "all") {
      return "";
    }

    return `
      <div class="advance-vacuum-card__utility-panel">
        <div class="advance-vacuum-card__utility-group">
          <div class="advance-vacuum-card__utility-label">Modo de limpieza</div>
          <div class="advance-vacuum-card__utility-options advance-vacuum-card__utility-options--presets">
            ${PANEL_MODE_PRESETS.map(preset => `
              <button
                class="advance-vacuum-card__utility-option ${preset.id === activePreset ? "is-active" : ""}"
                data-mode-preset-id="${escapeHtml(preset.id)}"
              >
                ${escapeHtml(preset.label)}
              </button>
            `).join("")}
          </div>
        </div>
        ${descriptors.map(descriptor => `
          <div class="advance-vacuum-card__utility-group">
            <div class="advance-vacuum-card__utility-label">${escapeHtml(descriptor.label)}</div>
            <div class="advance-vacuum-card__utility-options">
              ${descriptor.options.map(option => `
                <button
                  class="advance-vacuum-card__utility-option ${descriptor.current === option ? "is-active" : ""}"
                  data-mode-option-kind="${escapeHtml(descriptor.kind)}"
                  data-mode-option-value="${escapeHtml(option)}"
                >
                  ${escapeHtml(humanizeModeLabel(option, descriptor.kind))}
                </button>
              `).join("")}
            </div>
          </div>
        `).join("")}
        <div class="advance-vacuum-card__utility-meta">
          ${
            ["smart", "custom"].includes(activePreset)
              ? ""
              : `
                <div class="advance-vacuum-card__utility-chip-group">
                  <div class="advance-vacuum-card__utility-label">Contador de limpiezas</div>
                  <button class="advance-vacuum-card__selection-chip" data-control-action="repeats">
                    <ha-icon icon="mdi:repeat"></ha-icon>
                    <strong>x${this._repeats}</strong>
                  </button>
                </div>
              `
          }
          ${
            this._activeMode === "rooms"
              ? `<div class="advance-vacuum-card__selection-chip"><strong>${highlightedRoomIds.size}</strong><span>habitaciones</span></div>`
              : this._activeMode === "zone"
                ? `<div class="advance-vacuum-card__selection-chip"><strong>${this._manualZones.length + this._selectedPredefinedZoneIds.length}</strong><span>zonas</span></div>`
                : this._activeMode === "goto"
                  ? `<div class="advance-vacuum-card__selection-chip"><strong>${this._gotoPoint ? "1" : "0"}</strong><span>punto</span></div>`
                  : ""
          }
          ${
            this._activeMode !== "all"
              ? ""
              : ""
          }
        </div>
      </div>
    `;
  }

  _renderDockControlSection(state) {
    const descriptors = this._getDockControlDescriptors(state);
    if (!descriptors.length) {
      return "";
    }

    return `
      <div class="advance-vacuum-card__utility-group">
        <div class="advance-vacuum-card__utility-label">Acciones de base</div>
        <div class="advance-vacuum-card__utility-options advance-vacuum-card__utility-options--menu">
          ${descriptors.map(descriptor => `
            <button
              class="advance-vacuum-card__utility-option advance-vacuum-card__utility-option--menu ${descriptor.active ? "is-active" : ""}"
              data-dock-action-id="${escapeHtml(descriptor.id)}"
            >
              <ha-icon icon="${escapeHtml(descriptor.icon || "mdi:flash")}"></ha-icon>
              <span>${escapeHtml(descriptor.label)}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  _renderDockSettingsSection(state) {
    const descriptors = this._getDockSettingDescriptors(state);
    if (!descriptors.length) {
      return "";
    }

    return descriptors.map(descriptor => `
      <label class="advance-vacuum-card__utility-field">
        <span class="advance-vacuum-card__utility-label">${escapeHtml(descriptor.label)}</span>
        <select class="advance-vacuum-card__utility-select" data-dock-setting-id="${escapeHtml(descriptor.id)}">
          ${descriptor.options.map(option => `
            <option value="${escapeHtml(option)}" ${normalizeTextKey(descriptor.current) === normalizeTextKey(option) ? "selected" : ""}>
              ${escapeHtml(humanizeSelectOptionLabel(option, descriptor.id === "mop_mode" ? "mop_mode" : "generic"))}
            </option>
          `).join("")}
        </select>
      </label>
    `).join("");
  }

  _renderDockPanel(state) {
    const controlDescriptors = this._getDockControlDescriptors(state);
    const settingDescriptors = this._getDockSettingDescriptors(state);
    const availableSections = DOCK_PANEL_SECTIONS.filter(section => (
      section.id === "control" ? controlDescriptors.length > 0 : settingDescriptors.length > 0
    ));

    if (!availableSections.length) {
      return "";
    }

    const activeSection = availableSections.find(section => section.id === this._activeDockPanelSection) || availableSections[0];
    if (activeSection.id !== this._activeDockPanelSection) {
      this._activeDockPanelSection = activeSection.id;
    }

    return `
      <div class="advance-vacuum-card__utility-panel">
        <div class="advance-vacuum-card__utility-group">
          <div class="advance-vacuum-card__utility-label">Base de carga</div>
          <div class="advance-vacuum-card__utility-options advance-vacuum-card__utility-options--presets">
            ${availableSections.map(section => `
              <button
                class="advance-vacuum-card__utility-option ${section.id === activeSection.id ? "is-active" : ""}"
                data-dock-section-id="${escapeHtml(section.id)}"
              >
                ${escapeHtml(section.label)}
              </button>
            `).join("")}
          </div>
        </div>
        ${activeSection.id === "control" ? this._renderDockControlSection(state) : this._renderDockSettingsSection(state)}
      </div>
    `;
  }

  _renderCustomMenuPanel(state) {
    const items = this._getVisibleCustomMenuItems(state);
    if (!items.length) {
      return "";
    }

    return `
      <div class="advance-vacuum-card__utility-panel">
        <div class="advance-vacuum-card__utility-options advance-vacuum-card__utility-options--menu">
          ${items.map((item, index) => `
            <button class="advance-vacuum-card__utility-option advance-vacuum-card__utility-option--menu" data-custom-menu-index="${index}">
              <ha-icon icon="${escapeHtml(item.icon || "mdi:flash")}"></ha-icon>
              <span>${escapeHtml(item.label)}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const previousImage = this.shadowRoot.querySelector("[data-map-image]");
    const previousImageSrc = previousImage?.getAttribute("src") || "";

    const config = this._config || normalizeConfig({});
    const state = this._getVacuumState();
    const accentColor = this._getAccentColor(state);
    const styles = config.styles || DEFAULT_CONFIG.styles;
    this._syncActiveCleaningRoomIds(state);
    const rooms = this._getRoomSegments();
    const gotoPoints = this._getGotoPoints();
    const predefinedZones = this._getPredefinedZones();
    const highlightedRoomIds = new Set(this._getHighlightedRoomIds(state));
    const modes = this._getAvailableModes();
    const currentMode = modes.find(mode => mode.id === this._activeMode) || modes[0] || { id: "all", label: MODE_LABELS.all, icon: "mdi:home" };
    const iconSize = Math.max(54, parseSizeToPixels(styles.icon.size, 64));
    const controlSize = Math.max(38, parseSizeToPixels(styles.control.size, 42));
    const titleSize = Math.max(15, parseSizeToPixels(styles.title_size, 16));
    const mapRadius = Math.max(22, parseSizeToPixels(styles.map.radius, 26));
    const chipHeight = Math.max(24, parseSizeToPixels(styles.chip_height, 26));
    const chipPadding = styles.chip_padding || "0 10px";
    const chipFontSize = Math.max(11, parseSizeToPixels(styles.chip_font_size, 11));
    const mapImageUrl = this._getMapImageUrl();
    const unavailable = isUnavailableState(state) || !mapImageUrl;
    this._syncRememberedModeSelections(state);
    this._sanitizeSelectedManualZoneIndex();
    const roomColor = styles.map.room_color || "rgba(97, 201, 122, 0.18)";
    const roomBorder = styles.map.room_border || "rgba(97, 201, 122, 0.55)";
    const zoneColor = styles.map.zone_color || "rgba(90, 167, 255, 0.18)";
    const zoneBorder = styles.map.zone_border || "rgba(90, 167, 255, 0.72)";
    const gotoColor = styles.map.goto_color || "#f6b73c";
    const isCleaningSessionActive = this._isCleaning(state) || this._isPaused(state) || this._isReturning(state);
    const isRoomSelectionMode = currentMode.id === "rooms";
    const activeCleaningZones = isRoomSelectionMode ? this._activeCleaningZones : [];
    const showRoomSelectionDim = isRoomSelectionMode;
    const showRealRoomSelectionColors = isRoomSelectionMode && (highlightedRoomIds.size > 0 || activeCleaningZones.length > 0);
    const hasPendingZoneSelection = currentMode.id === "zone" && (
      this._selectedPredefinedZoneIds.length > 0 ||
      this._manualZones.length > 0
    );
    const primaryButtonIcon = hasPendingZoneSelection
      ? "mdi:check"
      : this._isCleaning(state)
        ? "mdi:pause"
        : "mdi:play";
    const primaryButtonTitle = hasPendingZoneSelection
      ? (isCleaningSessionActive ? "Añadir zona a la limpieza" : "Limpiar zona")
      : "Ejecutar";
    const modeDescriptors = this._getModeDescriptors(state);
    const dockControlDescriptors = this._getDockControlDescriptors(state);
    const dockSettingDescriptors = this._getDockSettingDescriptors(state);
    const activeModePanelPresetConfig = this._getActiveModePanelPresetConfig(state);
    const activeDockPanelSectionConfig = this._getDockPanelSectionConfig();
    const showModeMenuButton = modeDescriptors.length > 0 || currentMode.id !== "all";
    const showDockMenuButton = dockControlDescriptors.length > 0 || dockSettingDescriptors.length > 0;
    const utilityPanelMarkup = this._activeUtilityPanel === "modes"
      ? this._renderModePanel(state)
      : this._activeUtilityPanel === "dock"
        ? this._renderDockPanel(state)
        : "";
    const mapTransformStyle = `transform: translate(${this._mapOffset.x.toFixed(1)}px, ${this._mapOffset.y.toFixed(1)}px) scale(${this._mapScale.toFixed(3)});`;

    const selectedPredefinedZones = predefinedZones.filter(zone => this._selectedPredefinedZoneIds.includes(zone.id));
    const allZoneRects = [
      ...selectedPredefinedZones.flatMap(zone => zone.zones.map(item => ({
        x1: Number(item[0]),
        y1: Number(item[1]),
        x2: Number(item[2]),
        y2: Number(item[3]),
        predefined: true,
      }))),
      ...this._manualZones.map(zone => ({ ...zone, predefined: false })),
      ...(this._draftZone ? [{ ...this._draftZone, predefined: false, draft: true }] : []),
    ];

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          overflow: hidden;
        }

        .advance-vacuum-card {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${accentColor} 12%, transparent) 0%, transparent 42%),
            linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.03) 100%),
            ${styles.card.background};
          border: 1px solid color-mix(in srgb, ${accentColor} 20%, var(--divider-color));
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow}, 0 18px 34px color-mix(in srgb, ${accentColor} 8%, rgba(0,0,0,0.14));
          color: var(--primary-text-color);
          display: grid;
          gap: ${styles.card.gap};
          overflow: hidden;
          padding: ${styles.card.padding};
          position: relative;
        }

        .advance-vacuum-card__footer {
          align-items: center;
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }

        .advance-vacuum-card__header,
        .advance-vacuum-card__icon,
        .advance-vacuum-card__unavailable,
        .advance-vacuum-card__header-main,
        .advance-vacuum-card__title,
        .advance-vacuum-card__chips,
        .advance-vacuum-card__chip,
        .advance-vacuum-card__header-actions,
        .advance-vacuum-card__header-action {
          display: none !important;
        }

        .advance-vacuum-card__control,
        .advance-vacuum-card__mode-button,
        .advance-vacuum-card__goto-marker,
        .advance-vacuum-card__room-marker {
          appearance: none;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font: inherit;
          margin: 0;
          padding: 0;
        }

        .advance-vacuum-card__control {
          align-items: center;
          background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.035) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          box-shadow: 0 10px 24px rgba(0,0,0,0.14);
          display: inline-flex;
          height: ${controlSize}px;
          justify-content: center;
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease;
          width: ${controlSize}px;
        }

        .advance-vacuum-card__control:hover,
        .advance-vacuum-card__mode-button:hover {
          transform: translateY(-1px);
        }

        .advance-vacuum-card__control ha-icon {
          --mdc-icon-size: ${Math.round(controlSize * 0.48)}px;
        }

        .advance-vacuum-card__modes {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          width: 100%;
        }

        .advance-vacuum-card__mode-button {
          align-items: center;
          background: linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.03) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: 12px;
          font-weight: 600;
          gap: 8px;
          min-height: 34px;
          padding: 0 12px;
        }

        .advance-vacuum-card__mode-button.is-active {
          background: linear-gradient(180deg, color-mix(in srgb, ${accentColor} 16%, rgba(255,255,255,0.06)) 0%, rgba(255,255,255,0.04) 100%);
          border-color: color-mix(in srgb, ${accentColor} 38%, rgba(255,255,255,0.08));
          color: var(--primary-text-color);
          box-shadow: 0 12px 26px color-mix(in srgb, ${accentColor} 10%, rgba(0,0,0,0.16));
        }

        .advance-vacuum-card__mode-button ha-icon {
          --mdc-icon-size: 15px;
        }

        .advance-vacuum-card__utility-panel {
          animation: advance-vacuum-utility-panel-in 180ms ease forwards;
          display: grid;
          gap: 10px;
          justify-items: center;
          opacity: 0;
          transform: translateY(-8px);
          transform-origin: top center;
          width: 100%;
        }

        .advance-vacuum-card__utility-panel-slot {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .advance-vacuum-card__utility-group {
          display: grid;
          gap: 8px;
          justify-items: center;
          width: 100%;
        }

        .advance-vacuum-card__utility-label {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .advance-vacuum-card__utility-options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          width: 100%;
        }

        .advance-vacuum-card__utility-options--menu {
          max-width: 100%;
        }

        .advance-vacuum-card__utility-options--presets {
          justify-content: center;
        }

        .advance-vacuum-card__utility-option {
          align-items: center;
          appearance: none;
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          gap: 8px;
          justify-content: center;
          margin: 0;
          min-height: 34px;
          padding: 0 12px;
        }

        .advance-vacuum-card__utility-option.is-active {
          background: linear-gradient(180deg, color-mix(in srgb, ${accentColor} 16%, rgba(255,255,255,0.06)) 0%, rgba(255,255,255,0.04) 100%);
          border-color: color-mix(in srgb, ${accentColor} 38%, rgba(255,255,255,0.08));
          box-shadow: 0 12px 26px color-mix(in srgb, ${accentColor} 10%, rgba(0,0,0,0.16));
        }

        .advance-vacuum-card__utility-option--menu ha-icon {
          --mdc-icon-size: 16px;
        }

        .advance-vacuum-card__utility-field {
          display: grid;
          gap: 8px;
          justify-items: center;
          max-width: 340px;
          width: min(100%, 340px);
        }

        .advance-vacuum-card__utility-select {
          appearance: none;
          background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          color: var(--primary-text-color);
          cursor: pointer;
          font: inherit;
          min-height: 42px;
          padding: 0 14px;
          text-align: center;
          width: 100%;
        }

        .advance-vacuum-card__utility-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          width: 100%;
        }

        .advance-vacuum-card__utility-chip-group {
          display: grid;
          gap: 6px;
          justify-items: center;
        }

        .advance-vacuum-card__map {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.01) 100%),
            rgba(0, 0, 0, 0.12);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: ${mapRadius}px;
          overflow: hidden;
          position: relative;
        }

        .advance-vacuum-card__map-surface {
          aspect-ratio: ${this._mapImageWidth} / ${this._mapImageHeight};
          min-height: 280px;
          overflow: hidden;
          position: relative;
          touch-action: none;
          user-select: none;
        }

        .advance-vacuum-card__map-viewport {
          inset: 0;
          overflow: hidden;
          position: absolute;
        }

        .advance-vacuum-card__map-canvas {
          height: 100%;
          inset: 0;
          position: absolute;
          transform-origin: top left;
          width: 100%;
        }

        .advance-vacuum-card__map-image {
          display: block;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .advance-vacuum-card__map-room-dim,
        .advance-vacuum-card__room-highlight-layer,
        .advance-vacuum-card__map-svg,
        .advance-vacuum-card__map-markers,
        .advance-vacuum-card__map-overlays {
          inset: 0;
          position: absolute;
        }

        .advance-vacuum-card__map-room-dim {
          background: rgba(8, 12, 20, 0.5);
          pointer-events: none;
          z-index: 1;
        }

        .advance-vacuum-card__room-highlight-layer {
          pointer-events: none;
          z-index: 2;
        }

        .advance-vacuum-card__room-highlight-image {
          display: block;
          height: 100%;
          inset: 0;
          object-fit: cover;
          pointer-events: none;
          position: absolute;
          width: 100%;
        }

        .advance-vacuum-card__map-svg {
          height: 100%;
          pointer-events: none;
          width: 100%;
          z-index: 3;
        }

        .advance-vacuum-card__map-markers {
          pointer-events: none;
        }

        .advance-vacuum-card__map-overlays {
          pointer-events: none;
          z-index: 4;
        }

        .advance-vacuum-card__room-polygon {
          cursor: pointer;
          fill: rgba(255, 255, 255, 0.01);
          pointer-events: all;
          stroke: rgba(255,255,255,0.16);
          stroke-dasharray: 10 10;
          stroke-width: 10;
          transition: fill 160ms ease, stroke 160ms ease;
        }

        .advance-vacuum-card__room-polygon.is-selected {
          fill: ${roomColor};
          stroke: ${roomBorder};
        }

        .advance-vacuum-card__room-polygon.is-revealed {
          fill: rgba(255, 255, 255, 0.05);
          stroke: rgba(255, 255, 255, 0.42);
        }

        .advance-vacuum-card__zone-rect {
          fill: ${zoneColor};
          stroke: ${zoneBorder};
          stroke-dasharray: 16 12;
          stroke-linecap: round;
          stroke-width: 10;
        }

        .advance-vacuum-card__zone-rect.is-draft {
          opacity: 0.72;
        }

        .advance-vacuum-card__zone-rect--room-overlay {
          fill: rgba(255, 255, 255, 0.04);
          stroke: rgba(255, 255, 255, 0.42);
        }

        .advance-vacuum-card__goto-line {
          stroke: color-mix(in srgb, ${gotoColor} 72%, rgba(255,255,255,0.8));
          stroke-dasharray: 10 10;
          stroke-width: 8;
        }

        .advance-vacuum-card__zone-hitbox,
        .advance-vacuum-card__zone-handle,
        .advance-vacuum-card__map-tool {
          appearance: none;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font: inherit;
          margin: 0;
          padding: 0;
        }

        .advance-vacuum-card__zone-hitbox {
          background: rgba(255,255,255,0.01);
          border: 2px dashed transparent;
          border-radius: 16px;
          pointer-events: auto;
          position: absolute;
          z-index: 2;
        }

        .advance-vacuum-card__zone-hitbox.is-selected {
          border-color: color-mix(in srgb, ${accentColor} 46%, rgba(255,255,255,0.18));
        }

        .advance-vacuum-card__zone-handle {
          align-items: center;
          background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 999px;
          box-shadow: 0 12px 26px rgba(0,0,0,0.18);
          color: var(--primary-text-color);
          display: inline-flex;
          height: 34px;
          justify-content: center;
          pointer-events: auto;
          position: absolute;
          transform: translate(-50%, -50%);
          width: 34px;
          z-index: 3;
        }

        .advance-vacuum-card__zone-handle[data-zone-handle-action="move"] {
          border-color: color-mix(in srgb, ${accentColor} 34%, rgba(255,255,255,0.14));
          color: color-mix(in srgb, ${accentColor} 72%, #ffffff);
        }

        .advance-vacuum-card__zone-handle[data-zone-handle-action="delete"] {
          border-color: rgba(255, 130, 130, 0.32);
          color: #ffb3b3;
        }

        .advance-vacuum-card__zone-handle ha-icon,
        .advance-vacuum-card__map-tool ha-icon {
          --mdc-icon-size: 16px;
        }

        .advance-vacuum-card__map-tools {
          align-items: flex-start;
          display: flex;
          gap: 8px;
          justify-content: space-between;
          left: 12px;
          pointer-events: none;
          position: absolute;
          right: 12px;
          top: 12px;
          z-index: 4;
        }

        .advance-vacuum-card__map-tools-group {
          display: flex;
          gap: 8px;
        }

        .advance-vacuum-card__map-tools-group--right {
          justify-content: flex-end;
        }

        .advance-vacuum-card__map-tool--back {
          padding: 0;
          width: 44px;
        }

        .advance-vacuum-card__map-tool {
          align-items: center;
          background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 999px;
          box-shadow: 0 12px 26px rgba(0,0,0,0.18);
          color: var(--primary-text-color);
          display: inline-flex;
          gap: 6px;
          justify-content: center;
          min-height: 44px;
          min-width: 44px;
          padding: 0 14px;
          pointer-events: auto;
        }

        .advance-vacuum-card__map-tool--add {
          background: linear-gradient(180deg, color-mix(in srgb, ${accentColor} 18%, rgba(255,255,255,0.08)) 0%, rgba(255,255,255,0.06) 100%);
          border-color: color-mix(in srgb, ${accentColor} 32%, rgba(255,255,255,0.12));
          font-size: 12px;
          font-weight: 700;
        }

        .advance-vacuum-card__map-tool-label {
          line-height: 1;
        }

        .advance-vacuum-card__map-tool.is-disabled {
          opacity: 0.45;
        }

        .advance-vacuum-card__room-marker,
        .advance-vacuum-card__goto-marker {
          align-items: center;
          background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          box-shadow: 0 12px 26px rgba(0,0,0,0.18);
          color: var(--primary-text-color);
          display: inline-flex;
          gap: var(--room-marker-gap, 8px);
          justify-content: center;
          left: 0;
          min-height: var(--marker-size, 34px);
          min-width: var(--marker-size, 34px);
          padding: var(--room-marker-padding, 0 12px);
          pointer-events: auto;
          position: absolute;
          top: 0;
          transform: translate(-50%, -50%);
          white-space: nowrap;
          z-index: 2;
        }

        .advance-vacuum-card__room-marker.is-icon-only {
          border-radius: 999px;
          padding: 0;
          width: var(--marker-size, 34px);
        }

        .advance-vacuum-card__room-marker.is-selected,
        .advance-vacuum-card__goto-marker.is-selected {
          background: linear-gradient(180deg, color-mix(in srgb, ${accentColor} 16%, rgba(255,255,255,0.06)) 0%, rgba(255,255,255,0.04) 100%);
          border-color: color-mix(in srgb, ${accentColor} 40%, rgba(255,255,255,0.08));
          box-shadow: 0 16px 30px color-mix(in srgb, ${accentColor} 12%, rgba(0,0,0,0.18));
        }

        .advance-vacuum-card__room-marker ha-icon,
        .advance-vacuum-card__goto-marker ha-icon {
          --mdc-icon-size: var(--room-icon-size, 16px);
        }

        .advance-vacuum-card__room-marker span {
          font-size: var(--room-label-size, ${Math.max(11, parseSizeToPixels(styles.map.label_size, 12))}px);
          font-weight: 600;
        }

        .advance-vacuum-card__goto-marker {
          height: 38px;
          width: 38px;
        }

        .advance-vacuum-card__room-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          width: 100%;
        }

        .advance-vacuum-card__room-chip {
          align-items: center;
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          min-height: 36px;
          padding: 0 14px;
        }

        .advance-vacuum-card__room-chip.is-selected {
          background: linear-gradient(180deg, color-mix(in srgb, ${accentColor} 16%, rgba(255,255,255,0.06)) 0%, rgba(255,255,255,0.04) 100%);
          border-color: color-mix(in srgb, ${accentColor} 40%, rgba(255,255,255,0.08));
          color: var(--primary-text-color);
        }

        .advance-vacuum-card__room-chip ha-icon {
          --mdc-icon-size: 16px;
        }

        .advance-vacuum-card__room-chip span {
          font-size: 12px;
          font-weight: 600;
        }

        .advance-vacuum-card__controls {
          align-items: center;
          display: grid;
          gap: 10px;
          justify-items: center;
          width: 100%;
        }

        .advance-vacuum-card__controls-row {
          align-items: center;
          column-gap: 10px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          width: 100%;
        }

        .advance-vacuum-card__controls-main,
        .advance-vacuum-card__controls-side {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .advance-vacuum-card__controls-main {
          align-items: center;
          grid-column: 2;
          justify-content: center;
        }

        .advance-vacuum-card__controls-side {
          align-items: center;
          grid-column: 3;
          justify-content: flex-start;
        }

        .advance-vacuum-card__control.is-primary {
          background: linear-gradient(180deg, color-mix(in srgb, ${accentColor} 18%, rgba(255,255,255,0.06)) 0%, rgba(255,255,255,0.04) 100%);
          border-color: color-mix(in srgb, ${accentColor} 40%, rgba(255,255,255,0.08));
          color: ${styles.control.accent_color};
          height: ${Math.round(controlSize * 1.16)}px;
          width: ${Math.round(controlSize * 1.16)}px;
        }

        .advance-vacuum-card__selection-chip {
          align-items: center;
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: 12px;
          font-weight: 600;
          gap: 8px;
          min-height: 34px;
          padding: 0 12px;
        }

        .advance-vacuum-card__selection-chip strong {
          color: var(--primary-text-color);
        }

        @keyframes advance-vacuum-utility-panel-in {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      </style>
      <ha-card class="advance-vacuum-card">
        <div class="advance-vacuum-card__map">
          <div class="advance-vacuum-card__map-surface" data-map-surface="main">
            <div class="advance-vacuum-card__map-viewport">
              <div class="advance-vacuum-card__map-canvas" style="${mapTransformStyle}">
                ${
                  mapImageUrl
                    ? `<img class="advance-vacuum-card__map-image" data-map-image src="${escapeHtml(mapImageUrl)}" alt="Mapa del robot" />`
                    : `<div class="advance-vacuum-card__map-image" style="display:flex;align-items:center;justify-content:center;color:var(--secondary-text-color);">Mapa no disponible</div>`
                }
                ${showRoomSelectionDim ? `<div class="advance-vacuum-card__map-room-dim"></div>` : ""}
                ${showRealRoomSelectionColors ? this._renderRoomSelectionHighlights(rooms, highlightedRoomIds, mapImageUrl) : ""}
                ${showRealRoomSelectionColors ? this._renderZoneSelectionHighlights(activeCleaningZones, mapImageUrl) : ""}
                <svg class="advance-vacuum-card__map-svg" viewBox="0 0 ${this._mapImageWidth} ${this._mapImageHeight}" preserveAspectRatio="none">
                  ${currentMode.id === "rooms" ? rooms.map(room => room.outlines.map(outline => `
                    <polygon
                      class="advance-vacuum-card__room-polygon ${highlightedRoomIds.has(String(room.id)) ? (showRealRoomSelectionColors ? "is-revealed" : "is-selected") : ""}"
                      data-room-id="${escapeHtml(room.id)}"
                      points="${escapeHtml(this._vacuumOutlineToSvgPoints(outline))}"
                    ></polygon>
                  `).join("")).join("") : ""}

                  ${currentMode.id === "rooms" ? activeCleaningZones.map(zone => {
                    const rect = this._zoneToSvgRect(zone);
                    return `
                      <rect
                        class="advance-vacuum-card__zone-rect advance-vacuum-card__zone-rect--room-overlay"
                        x="${rect.x.toFixed(1)}"
                        y="${rect.y.toFixed(1)}"
                        width="${rect.width.toFixed(1)}"
                        height="${rect.height.toFixed(1)}"
                        rx="18"
                        ry="18"
                      ></rect>
                    `;
                  }).join("") : ""}

                  ${currentMode.id === "zone" ? allZoneRects.map(zone => {
                    const rect = this._zoneToSvgRect(zone);
                    return `
                      <rect
                        class="advance-vacuum-card__zone-rect ${zone.draft ? "is-draft" : ""}"
                        x="${rect.x.toFixed(1)}"
                        y="${rect.y.toFixed(1)}"
                        width="${rect.width.toFixed(1)}"
                        height="${rect.height.toFixed(1)}"
                        rx="18"
                        ry="18"
                      ></rect>
                    `;
                  }).join("") : ""}

                  ${
                    currentMode.id === "goto" && this._gotoPoint
                      ? (() => {
                          const mapped = this._converter.vacuumToMap(this._gotoPoint.x, this._gotoPoint.y);
                          return `
                            <circle cx="${mapped.x.toFixed(1)}" cy="${mapped.y.toFixed(1)}" r="22" fill="color-mix(in srgb, ${gotoColor} 22%, rgba(255,255,255,0.08))"></circle>
                            <circle cx="${mapped.x.toFixed(1)}" cy="${mapped.y.toFixed(1)}" r="10" fill="${gotoColor}" stroke="rgba(255,255,255,0.94)" stroke-width="5"></circle>
                          `;
                        })()
                      : ""
                  }
                </svg>
              </div>
            </div>
            <div class="advance-vacuum-card__map-overlays">
              ${this._renderManualZoneEditors()}
              ${currentMode.id === "rooms" ? this._renderRoomMarkers(rooms) : ""}
              ${currentMode.id === "goto" ? this._renderGotoMarkers(gotoPoints) : ""}
              ${
                currentMode.id === "zone" ? predefinedZones.map(zone => {
                  const position = zone.position || centroid(zone.zones.map(item => ({ x: Number(item[0]), y: Number(item[1]) })));
                  const percent = this._vacuumToViewportPercent(position);
                  const selected = this._selectedPredefinedZoneIds.includes(zone.id);
                  return `
                    <button
                      class="advance-vacuum-card__room-marker ${selected ? "is-selected" : ""}"
                      style="left:${percent.left}%; top:${percent.top}%;"
                      data-zone-id="${escapeHtml(zone.id)}"
                      title="${escapeHtml(zone.label || zone.id)}"
                    >
                      <ha-icon icon="${escapeHtml(zone.icon || "mdi:vector-rectangle")}"></ha-icon>
                      <span>${escapeHtml(zone.label || zone.id)}</span>
                    </button>
                  `;
                }).join("") : ""
              }
            </div>
            ${this._renderMapTools()}
          </div>
        </div>

        ${this._renderRoomFallbackList(rooms)}

        <div class="advance-vacuum-card__footer">

        ${
          !isCleaningSessionActive
            ? `
              <div class="advance-vacuum-card__modes">
                ${modes.map(mode => `
                  <button class="advance-vacuum-card__mode-button ${mode.id === currentMode.id ? "is-active" : ""}" data-mode-id="${escapeHtml(mode.id)}">
                    <ha-icon icon="${escapeHtml(mode.icon)}"></ha-icon>
                    <span>${escapeHtml(mode.label)}</span>
                  </button>
                `).join("")}
              </div>
            `
            : ""
        }

        <div class="advance-vacuum-card__controls">
          <div class="advance-vacuum-card__controls-row">
            <div class="advance-vacuum-card__controls-main">
              ${
                showModeMenuButton
                  ? `
                    <button class="advance-vacuum-card__control ${this._activeUtilityPanel === "modes" ? "is-primary" : ""}" data-control-action="toggle_modes" title="${escapeHtml(activeModePanelPresetConfig?.label || "Modos de aspirado y fregado")}">
                      <ha-icon icon="${escapeHtml(activeModePanelPresetConfig?.icon || "mdi:tune-variant")}"></ha-icon>
                    </button>
                  `
                  : ""
              }
              <button class="advance-vacuum-card__control is-primary" data-control-action="primary" title="${escapeHtml(primaryButtonTitle)}">
                <ha-icon icon="${primaryButtonIcon}"></ha-icon>
              </button>
              ${
                showDockMenuButton
                  ? `
                    <button class="advance-vacuum-card__control ${this._activeUtilityPanel === "dock" ? "is-primary" : ""}" data-control-action="toggle_dock_panel" title="${escapeHtml(activeDockPanelSectionConfig?.label || "Base de carga")}">
                      <ha-icon icon="${escapeHtml(activeDockPanelSectionConfig?.icon || "mdi:home-import-outline")}"></ha-icon>
                    </button>
                `
                  : ""
              }
            </div>
          </div>
        </div>

        ${
          utilityPanelMarkup
            ? `<div class="advance-vacuum-card__utility-panel-slot">${utilityPanelMarkup}</div>`
            : ""
        }
        </div>
      </ha-card>
    `;

    let image = this.shadowRoot.querySelector("[data-map-image]");
    if (previousImage && image && previousImageSrc && previousImageSrc === image.getAttribute("src")) {
      image.replaceWith(previousImage);
      image = previousImage;
    }

    if (image) {
      image.removeEventListener("load", this._onMapImageLoad);
      image.addEventListener("load", this._onMapImageLoad);
    }

    this._lastRenderSignature = this._getRenderSignature();
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaAdvanceVacuumCard);
}

class NodaliaAdvanceVacuumCardEditor extends HTMLElement {
  static get properties() {
    return {
      hass: {},
      _config: {},
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig({});
    this._entityOptionsSignature = "";
    this._onInputChange = this._onInputChange.bind(this);
  }

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    this._render();
    this._restoreFocusState(focusState);
  }

  set hass(hass) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender =
      !this._hass ||
      nextSignature !== this._entityOptionsSignature ||
      !this.shadowRoot?.innerHTML;

    this._hass = hass;
    this._entityOptionsSignature = nextSignature;

    if (!shouldRender) {
      return;
    }

    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return Object.keys(hass?.states || {})
      .sort((left, right) => left.localeCompare(right, "es"))
      .join("|");
  }

  _captureFocusState() {
    const activeElement = this.shadowRoot?.activeElement;

    if (
      !(
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement
      )
    ) {
      return null;
    }

    const dataset = activeElement.dataset || {};
    const selector = dataset.field
      ? `[data-field="${String(dataset.field).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`
      : null;

    if (!selector) {
      return null;
    }

    const supportsSelection =
      typeof activeElement.selectionStart === "number" &&
      typeof activeElement.selectionEnd === "number";

    return {
      selector,
      selectionEnd: supportsSelection ? activeElement.selectionEnd : null,
      selectionStart: supportsSelection ? activeElement.selectionStart : null,
      type: activeElement.type,
    };
  }

  _restoreFocusState(focusState) {
    if (!focusState?.selector || !this.shadowRoot) {
      return;
    }

    const target = this.shadowRoot.querySelector(focusState.selector);
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
    ) {
      return;
    }

    try {
      target.focus({ preventScroll: true });
    } catch (_error) {
      target.focus();
    }

    const canRestoreSelection =
      focusState.type !== "checkbox" &&
      typeof focusState.selectionStart === "number" &&
      typeof focusState.selectionEnd === "number" &&
      typeof target.setSelectionRange === "function";

    if (!canRestoreSelection) {
      return;
    }

    try {
      target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    } catch (_error) {
      // Ignore unsupported inputs.
    }
  }

  _notifyConfigChange(nextConfig) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(nextConfig);
    this._render();
    this._restoreFocusState(focusState);
    fireEvent(this, "config-changed", {
      config: compactConfig(this._config),
    });
  }

  _onInputChange(event) {
    const target = event.currentTarget;
    const field = target.dataset.field;
    const valueType = target.dataset.valueType || "string";
    const checked = target.type === "checkbox" ? target.checked : undefined;

    // Keep typing stable in Home Assistant's editor by only committing
    // free-text fields on change/blur, not on every keystroke.
    if (
      event.type === "input" &&
      target.type !== "checkbox" &&
      target.tagName !== "SELECT"
    ) {
      return;
    }

    const nextConfig = deepClone(this._config);
    let nextValue = target.value;

    if (target.type === "checkbox") {
      nextValue = checked;
    } else if (valueType === "number") {
      nextValue = target.value === "" ? "" : Number(target.value);
    } else if (valueType === "json") {
      if (target.value.trim() === "") {
        nextValue = "";
      } else {
        try {
          nextValue = JSON.parse(target.value);
        } catch (_error) {
          return;
        }
      }
    }

    if (nextValue === "" || nextValue === null || nextValue === undefined) {
      deleteByPath(nextConfig, field);
    } else {
      setByPath(nextConfig, field, nextValue);
    }

    this._notifyConfigChange(nextConfig);
  }

  _renderTextField(label, field, value, options = {}) {
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <input
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          type="${escapeHtml(options.type || "text")}"
          value="${escapeHtml(value ?? "")}"
          placeholder="${escapeHtml(options.placeholder || "")}"
        />
      </label>
    `;
  }

  _renderTextareaField(label, field, value, options = {}) {
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <textarea
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          rows="${escapeHtml(String(options.rows || 6))}"
          placeholder="${escapeHtml(options.placeholder || "")}"
        >${escapeHtml(value ?? "")}</textarea>
      </label>
    `;
  }

  _renderSelectField(label, field, value, items, options = {}) {
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <select data-field="${escapeHtml(field)}">
          ${items.map(item => `
            <option value="${escapeHtml(item.value)}" ${String(value ?? "") === String(item.value) ? "selected" : ""}>
              ${escapeHtml(item.label)}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    return `
      <label class="editor-toggle">
        <input data-field="${escapeHtml(field)}" type="checkbox" ${checked ? "checked" : ""} />
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  _getEntityOptionsMarkup() {
    const states = this._hass?.states || {};
    const allEntities = Object.keys(states).sort();
    const vacuumEntities = allEntities.filter(entityId => entityId.startsWith("vacuum."));
    const mapEntities = allEntities.filter(entityId => entityId.startsWith("camera.") || entityId.startsWith("image."));
    const helperEntities = allEntities.filter(entityId => entityId.startsWith("sensor.") || entityId.startsWith("image.") || entityId.startsWith("camera."));
    const selectEntities = allEntities.filter(entityId => entityId.startsWith("select."));

    return `
      <datalist id="advance-vacuum-card-vacuum-entities">
        ${vacuumEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
      <datalist id="advance-vacuum-card-map-entities">
        ${mapEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
      <datalist id="advance-vacuum-card-helper-entities">
        ${helperEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
      <datalist id="advance-vacuum-card-select-entities">
        ${selectEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "selection";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        .editor {
          color: var(--primary-text-color);
          display: grid;
          gap: 16px;
        }

        .editor-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 18px;
          display: grid;
          gap: 14px;
          padding: 16px;
        }

        .editor-section__header {
          display: grid;
          gap: 4px;
        }

        .editor-section__title {
          font-size: 15px;
          font-weight: 700;
        }

        .editor-section__hint {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }

        .editor-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .editor-field,
        .editor-toggle {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .editor-field--full {
          grid-column: 1 / -1;
        }

        .editor-field > span,
        .editor-toggle > span {
          font-size: 12px;
          font-weight: 600;
        }

        .editor-field input,
        .editor-field select,
        .editor-field textarea {
          appearance: none;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 40px;
          padding: 10px 12px;
          width: 100%;
        }

        .editor-field textarea {
          min-height: 120px;
          resize: vertical;
        }

        .editor-toggle {
          align-items: center;
          grid-template-columns: auto 1fr;
          padding-top: 20px;
        }

        .editor-toggle input {
          accent-color: var(--primary-color);
          height: 18px;
          margin: 0;
          width: 18px;
        }

        @media (max-width: 640px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }

          .editor-toggle {
            padding-top: 0;
          }
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">General</div>
            <div class="editor-section__hint">Entidad del robot y fuente principal del mapa.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Entidad vacuum", "entity", config.entity, { placeholder: "vacuum.roborock_qrevo_s" })}
            ${this._renderTextField("Nombre", "name", config.name, { placeholder: "Roborock Qrevo S" })}
            ${this._renderTextField("Icono", "icon", config.icon, { placeholder: "mdi:robot-vacuum" })}
            ${this._renderTextField("Entidad mapa (camera/image)", "map_source.camera", config.map_source?.camera, { placeholder: "image.roborock_qrevo_s_custom" })}
            ${this._renderSelectField("Plataforma", "vacuum_platform", config.vacuum_platform || "Roborock", [
              { value: "Roborock", label: "Roborock" },
              { value: "send_command", label: "Send command" },
            ])}
            ${this._renderTextField("Entidad calibracion", "calibration_source.entity", config.calibration_source?.entity, { placeholder: "image.roborock_qrevo_s_custom" })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Mapa</div>
            <div class="editor-section__hint">La tarjeta reutiliza automaticamente tu config legacy de \`map_modes\` e \`icons\` si la pegas en YAML.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Calibracion desde camera", "calibration_source.camera", config.calibration_source?.camera !== false)}
            ${this._renderCheckboxField("Mapa bloqueado", "map_locked", config.map_locked !== false)}
            ${this._renderCheckboxField("Mostrar etiquetas habitaciones", "show_room_labels", config.show_room_labels !== false)}
            ${this._renderCheckboxField("Mostrar marcadores habitaciones", "show_room_markers", config.show_room_markers !== false)}
            ${this._renderCheckboxField("Modo habitaciones", "allow_segment_mode", config.allow_segment_mode !== false)}
            ${this._renderCheckboxField("Modo zona", "allow_zone_mode", config.allow_zone_mode !== false)}
            ${this._renderCheckboxField("Modo ir a punto", "allow_goto_mode", config.allow_goto_mode !== false)}
            ${this._renderTextField("Max zonas", "max_zone_selections", config.max_zone_selections, { type: "number", valueType: "number", placeholder: "5" })}
            ${this._renderTextField("Max repeticiones", "max_repeats", config.max_repeats, { type: "number", valueType: "number", placeholder: "3" })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Controles avanzados</div>
            <div class="editor-section__hint">Selector de aspirado/fregado y menu derecho configurable. En los items del menu usa JSON con \`label\`, \`icon\`, \`visible_when\`, \`builtin_action\` o \`tap_action\`.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Modo todo", "show_all_mode", config.show_all_mode !== false)}
            ${this._renderTextField("Select aspirado", "suction_select_entity", config.suction_select_entity, {
              placeholder: "select.robot_salon_suction",
            })}
            ${this._renderTextField("Select fregado", "mop_select_entity", config.mop_select_entity, {
              placeholder: "select.robot_salon_mop_mode",
            })}
            ${this._renderTextField("Select modo mopa", "mop_mode_select_entity", config.mop_mode_select_entity, {
              placeholder: "select.roborock_qrevo_s_modo_mopa",
            })}
            ${this._renderTextField("Etiqueta menu derecho", "custom_menu.label", config.custom_menu?.label, {
              placeholder: "Base",
            })}
            ${this._renderTextField("Icono menu derecho", "custom_menu.icon", config.custom_menu?.icon, {
              placeholder: "mdi:home-import-outline",
            })}
            ${this._renderTextareaField("Items del menu derecho (JSON)", "custom_menu.items", JSON.stringify(config.custom_menu?.items || [], null, 2), {
              fullWidth: true,
              rows: 10,
              valueType: "json",
              placeholder: '[\n  {\n    "label": "Vaciar deposito",\n    "icon": "mdi:delete-empty",\n    "visible_when": "docked",\n    "tap_action": {\n      "action": "perform-action",\n      "perform_action": "vacuum.send_command",\n      "service_data": {\n        "entity_id": "vacuum.roborock_qrevo_s",\n        "command": "app_start_emptying"\n      }\n    }\n  },\n  {\n    "label": "Volver a base",\n    "icon": "mdi:home-import-outline",\n    "visible_when": "active",\n    "builtin_action": "return_to_base"\n  }\n]',
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Visibilidad</div>
            <div class="editor-section__hint">Que elementos quieres mantener siempre visibles.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Chip de estado", "show_state_chip", config.show_state_chip !== false)}
            ${this._renderCheckboxField("Chip de bateria", "show_battery_chip", config.show_battery_chip !== false)}
            ${this._renderCheckboxField("Iconos cabecera", "show_header_icons", config.show_header_icons !== false)}
            ${this._renderCheckboxField("Boton volver a base", "show_return_to_base", config.show_return_to_base !== false)}
            ${this._renderCheckboxField("Boton parar", "show_stop", config.show_stop !== false)}
            ${this._renderCheckboxField("Boton localizar", "show_locate", config.show_locate !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Haptics</div>
            <div class="editor-section__hint">Respuesta haptica opcional para clicks y selecciones.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Activar haptics", "haptics.enabled", config.haptics?.enabled === true)}
            ${this._renderCheckboxField("Fallback con vibracion", "haptics.fallback_vibrate", config.haptics?.fallback_vibrate === true)}
            ${this._renderSelectField("Estilo", "haptics.style", hapticStyle, [
              { value: "selection", label: "Selection" },
              { value: "light", label: "Light" },
              { value: "medium", label: "Medium" },
              { value: "heavy", label: "Heavy" },
              { value: "success", label: "Success" },
              { value: "warning", label: "Warning" },
              { value: "failure", label: "Failure" },
            ])}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Estilo</div>
            <div class="editor-section__hint">Ajustes visuales base del mapa y las burbujas.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Background", "styles.card.background", config.styles?.card?.background)}
            ${this._renderTextField("Border", "styles.card.border", config.styles?.card?.border)}
            ${this._renderTextField("Radius", "styles.card.border_radius", config.styles?.card?.border_radius)}
            ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles?.card?.box_shadow)}
            ${this._renderTextField("Padding", "styles.card.padding", config.styles?.card?.padding)}
            ${this._renderTextField("Separacion", "styles.card.gap", config.styles?.card?.gap)}
            ${this._renderTextField("Tamano burbuja entidad", "styles.icon.size", config.styles?.icon?.size)}
            ${this._renderTextField("Tamano chips", "styles.chip_height", config.styles?.chip_height)}
            ${this._renderTextField("Texto chips", "styles.chip_font_size", config.styles?.chip_font_size)}
            ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles?.title_size)}
            ${this._renderTextField("Tamano botones", "styles.control.size", config.styles?.control?.size)}
            ${this._renderTextField("Radius mapa", "styles.map.radius", config.styles?.map?.radius)}
            ${this._renderTextField("Tamano marcadores", "styles.map.marker_size", config.styles?.map?.marker_size)}
            ${this._renderTextField("Texto marcadores", "styles.map.label_size", config.styles?.map?.label_size)}
          </div>
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot.querySelectorAll("input, select, textarea").forEach(input => {
      input.addEventListener("change", this._onInputChange);
      if (
        (input.tagName === "INPUT" && input.type !== "checkbox") ||
        input.tagName === "TEXTAREA"
      ) {
        input.addEventListener("input", this._onInputChange);
      }
    });

    this.shadowRoot.querySelectorAll('input[data-field="entity"]').forEach(input => input.setAttribute("list", "advance-vacuum-card-vacuum-entities"));
    this.shadowRoot.querySelectorAll('input[data-field="map_source.camera"]').forEach(input => input.setAttribute("list", "advance-vacuum-card-map-entities"));
    this.shadowRoot.querySelectorAll('input[data-field="calibration_source.entity"]').forEach(input => input.setAttribute("list", "advance-vacuum-card-helper-entities"));
    this.shadowRoot.querySelectorAll('input[data-field="suction_select_entity"], input[data-field="mop_select_entity"], input[data-field="mop_mode_select_entity"]').forEach(input => input.setAttribute("list", "advance-vacuum-card-select-entities"));
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaAdvanceVacuumCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Advance Vacuum Card",
  description: "Tarjeta de mapa avanzada para robots con estilo Nodalia y seleccion de habitaciones, zonas y puntos.",
  preview: true,
});
