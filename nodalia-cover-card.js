// <nodalia-standalone-utils>
// Inlined for standalone Lovelace resources (single JS file). Stripped when building nodalia-cards.js.
// Source of truth: nodalia-utils.js — regenerate: node scripts/sync-standalone-embed.mjs
/**
 * Shared helpers for Nodalia cards (deep equality, config stripping, editor mounts).
 * Loaded early in nodalia-cards.js bundle; exposed as window.NodaliaUtils.
 */
(function initNodaliaUtils() {
  const REQUIRED_API_KEYS = [
    "isObject",
    "deepClone",
    "deepEqual",
    "stripEqualToDefaults",
    "editorStatesSignature",
    "editorFilteredStatesSignature",
    "sanitizeActionUrl",
    "mountEntityPickerHost",
    "mountIconPickerHost",
    "postHomeAssistantWebhook",
    "warnStrictServiceDenied",
    "renderEditorChipBorderRadiusHtml",
    "renderEditorCardBorderRadiusHtml",
    "bindHostPointerHoldGesture",
  ];
  const existing = typeof window !== "undefined" ? window.NodaliaUtils : null;
  if (
    existing &&
    REQUIRED_API_KEYS.every(key => typeof existing[key] === "function")
  ) {
    return;
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function deepClone(value) {
    if (value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function deepEqual(a, b) {
    if (Object.is(a, b)) {
      return true;
    }
    if (a == null || b == null) {
      return a === b;
    }
    if (typeof a !== typeof b) {
      return false;
    }
    if (typeof a !== "object") {
      return false;
    }
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) {
        return false;
      }
      return a.every((value, index) => deepEqual(value, b[index]));
    }
    if (Array.isArray(b)) {
      return false;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) {
      return false;
    }
    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  function stripEqualToDefaults(config, defaults) {
    if (defaults === undefined || defaults === null) {
      return deepClone(config);
    }
    if (config === undefined || config === null) {
      return undefined;
    }
    if (Array.isArray(config)) {
      return deepEqual(config, defaults) ? undefined : deepClone(config);
    }
    if (isObject(config) && isObject(defaults)) {
      const out = {};
      for (const key of Object.keys(config)) {
        const cv = config[key];
        const dv = defaults[key];
        if (!(key in defaults)) {
          out[key] = deepClone(cv);
          continue;
        }
        if (deepEqual(cv, dv)) {
          continue;
        }
        if (isObject(cv) && !Array.isArray(cv) && isObject(dv) && !Array.isArray(dv)) {
          const stripped = stripEqualToDefaults(cv, dv);
          if (stripped !== undefined) {
            out[key] = stripped;
          }
        } else {
          out[key] = deepClone(cv);
        }
      }
      return Object.keys(out).length ? out : undefined;
    }
    return deepEqual(config, defaults) ? undefined : config;
  }

  /**
   * Signature for entities matching predicate(entityId): id + friendly_name + icon per row,
   * so picker labels update when attributes change. Same locale prefix as editorStatesSignature.
   */
  function editorFilteredStatesSignature(hass, language, predicate) {
    const states = hass?.states || {};
    const ids = [];
    for (const id of Object.keys(states)) {
      if (!predicate(id)) {
        continue;
      }
      ids.push(id);
    }
    ids.sort();

    const rows = new Array(ids.length);
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      const state = states[id];
      rows[index] = `${id}:${String(state?.attributes?.friendly_name ?? "")}:${String(state?.attributes?.icon ?? "")}`;
    }

    const tag =
      typeof window !== "undefined" && window.NodaliaI18n && typeof hass !== "undefined"
        ? window.NodaliaI18n.localeTag(window.NodaliaI18n.resolveLanguage(hass, language))
        : "";
    return `${tag}|${rows.join("|")}`;
  }

  /**
   * Full hass.states signature: every entity as id + friendly_name + icon (sorted by id),
   * plus locale tag — same shape as editorFilteredStatesSignature. Editors that list entities
   * re-render when labels or icons change, not only when the entity count changes.
   */
  function editorStatesSignature(hass, language) {
    return editorFilteredStatesSignature(hass, language, () => true);
  }

  /**
   * Accepts either the webhook id (`my_hook`) or a pasted `/api/webhook/...` path / full URL.
   */
  function normalizeHomeAssistantWebhookId(webhookId) {
    const raw = String(webhookId ?? "").trim();
    if (!raw) {
      return "";
    }
    if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        const m = /\/api\/webhook\/([^/]+)/.exec(u.pathname);
        return m ? decodeURIComponent(m[1]) : "";
      } catch (_err) {
        return "";
      }
    }
    const pathSeg = raw.match(/(?:^|\/)api\/webhook\/([^/?#]+)/i);
    if (pathSeg) {
      return decodeURIComponent(pathSeg[1]);
    }
    return raw;
  }

  /**
   * POST JSON to the Home Assistant webhook endpoint `/api/webhook/<webhook_id>`.
   * Does not rely on the signed-in user's permission to call `input_text.set_value`;
   * an automation triggered by the webhook runs with normal HA privileges.
   * Typical body: `{ "value": "<payload>" }` with `{{ trigger.json.value }}` in actions.
   *
   * Pass **`hass`** (third argument) so **`hass.auth.fetchWithAuth`** is used — raw `fetch`
   * often returns **401** in the HA frontend because API routes expect the bearer/session
   * from `fetchWithAuth`, not cookies alone.
   */
  function postHomeAssistantWebhook(webhookId, body, hass) {
    const id = normalizeHomeAssistantWebhookId(webhookId);
    if (!id) {
      return Promise.resolve(false);
    }
    const payload = body && typeof body === "object" ? body : {};
    const path = `/api/webhook/${encodeURIComponent(id)}`;

    const authFetch = hass?.auth?.fetchWithAuth;
    if (typeof authFetch === "function") {
      return authFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(
        res => res.ok,
        () => false,
      );
    }

    if (typeof fetch !== "function") {
      return Promise.resolve(false);
    }
    const origin = typeof window !== "undefined" && window.location ? window.location.origin : "";
    if (!origin) {
      return Promise.resolve(false);
    }
    const url = `${origin}${path}`;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    }    ).then(
      res => res.ok,
      () => false,
    );
  }

  /**
   * Log once per blocked `domain.service` when `security.strict_service_actions` denylists user actions.
   */
  function warnStrictServiceDenied(cardLabel, serviceValue) {
    const service = String(serviceValue || "").trim();
    if (!service) {
      return;
    }
    if (typeof console === "undefined" || typeof console.warn !== "function") {
      return;
    }
    console.warn(
      `${String(cardLabel || "Nodalia card")}: service blocked by strict_service_actions — not listed under security.allowed_services or security.allowed_service_domains: ${service}`,
    );
  }

  /**
   * Normalize and validate user-provided action URLs.
   * Allows http/https and same-origin relative paths by default.
   */
  function sanitizeActionUrl(value, options = {}) {
    const raw = String(value ?? "").trim();
    if (!raw) {
      return "";
    }
    const allowRelative = options.allowRelative !== false;
    const allowHash = options.allowHash === true;
    if (allowHash && raw.startsWith("#")) {
      return raw;
    }
    if (allowRelative && (/^\/(?!\/)/.test(raw) || raw.startsWith("./") || raw.startsWith("../"))) {
      return raw;
    }
    try {
      const base =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : "https://example.invalid";
      const parsed = new URL(raw, base);
      const protocol = String(parsed.protocol || "").toLowerCase();
      if (protocol !== "http:" && protocol !== "https:") {
        return "";
      }
      if (allowRelative && typeof window !== "undefined" && window.location && parsed.origin === window.location.origin) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return parsed.toString();
    } catch (_error) {
      return "";
    }
  }

  function copyDatasetExcept(control, host, skipKeys) {
    const skip = new Set(skipKeys || []);
    Object.entries(host.dataset || {}).forEach(([key, value]) => {
      if (skip.has(key)) {
        return;
      }
      control.dataset[key] = value;
    });
  }

  /** Latest callbacks for reused picker controls (listeners call into this). */
  const pickerCallbackState = new WeakMap();
  const pickerControlsWithListeners = new WeakSet();

  function dispatchPickerChange(ev) {
    const control = ev.currentTarget;
    const s = pickerCallbackState.get(control);
    if (s && typeof s.onShadowInput === "function") {
      s.onShadowInput(ev);
    }
  }

  function dispatchPickerValueChanged(ev) {
    const control = ev.currentTarget;
    const s = pickerCallbackState.get(control);
    if (!s) {
      return;
    }
    const fn = s.onShadowValueChanged || s.onShadowInput;
    if (typeof fn === "function") {
      fn(ev);
    }
  }

  /**
   * Mount or update ha-entity-picker / ha-selector / text input without recreating each render.
   */
  function mountEntityPickerHost(host, options) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const hass = options.hass;
    const field = options.field || host.dataset.field || "entity";
    const nextValue = options.value !== undefined ? String(options.value) : String(host.dataset.value || "");
    const placeholder =
      options.placeholder !== undefined ? String(options.placeholder) : String(host.dataset.placeholder || "");
    const onShadowInput = options.onShadowInput;
    const onShadowValueChanged = options.onShadowValueChanged;
    const copyDatasetFromHost = options.copyDatasetFromHost !== false;

    const usePicker = typeof customElements !== "undefined" && customElements.get("ha-entity-picker");
    const useSelector = typeof customElements !== "undefined" && customElements.get("ha-selector");

    let desired = "input";
    if (usePicker) {
      desired = "picker";
    } else if (useSelector) {
      desired = "selector";
    }

    let control = host.firstElementChild;
    const tag = control?.tagName || "";
    const matches =
      control &&
      ((desired === "picker" && tag === "HA-ENTITY-PICKER")
        || (desired === "selector" && tag === "HA-SELECTOR")
        || (desired === "input" && tag === "INPUT"));

    if (!matches) {
      host.replaceChildren();
      if (usePicker) {
        control = document.createElement("ha-entity-picker");
        control.allowCustomEntity = true;
      } else if (useSelector) {
        control = document.createElement("ha-selector");
        control.selector = { entity: {} };
      } else {
        control = document.createElement("input");
        control.type = "text";
      }

      control.dataset.field = field;
      if (copyDatasetFromHost) {
        copyDatasetExcept(control, host, ["mountedControl", "value", "placeholder", "field"]);
      }

      if ("hass" in control) {
        control.hass = hass;
      }
      if ("value" in control) {
        control.value = nextValue;
      }
      if (placeholder && "placeholder" in control) {
        control.placeholder = placeholder;
      }

      pickerCallbackState.set(control, { onShadowInput, onShadowValueChanged });
      if (!pickerControlsWithListeners.has(control)) {
        pickerControlsWithListeners.add(control);
        if (control.tagName === "INPUT") {
          control.addEventListener("change", dispatchPickerChange);
        } else {
          control.addEventListener("value-changed", dispatchPickerValueChanged);
        }
      }

      host.appendChild(control);
      return;
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;
    pickerCallbackState.set(control, { onShadowInput, onShadowValueChanged });
    if ("hass" in control) {
      control.hass = hass;
    }
    if (placeholder && "placeholder" in control) {
      control.placeholder = placeholder;
    }
    if ("value" in control && control.value !== nextValue) {
      control.value = nextValue;
    }
  }

  /**
   * Visual editor: preset radios for `styles.chip_border_radius` (capsule / soft / rounded / square).
   * Callers pass translated labels and their `escapeHtml` (card-local).
   */
  function renderEditorChipBorderRadiusHtml(options) {
    const esc = options?.escapeHtml;
    if (typeof esc !== "function") {
      return "";
    }
    const fieldRaw = String(options?.field ?? "styles.chip_border_radius").trim();
    const field = fieldRaw || "styles.chip_border_radius";
    const current = String(options?.value ?? "").trim() || "999px";
    const tHeading = esc(String(options?.tHeading ?? "Chip corner radius"));
    const labels = options?.labels ?? {};
    const tPill = esc(String(labels.pill ?? "Capsule"));
    const tSoft = esc(String(labels.soft ?? "Soft"));
    const tRound = esc(String(labels.round ?? "Rounded"));
    const tSquare = esc(String(labels.square ?? "Square"));
    const STANDARD = [
      { v: "999px", l: tPill },
      { v: "12px", l: tSoft },
      { v: "8px", l: tRound },
      { v: "4px", l: tSquare },
    ];
    const inStandard = STANDARD.some(p => p.v === current);
    const presets = inStandard ? STANDARD : [{ v: current, l: esc(current) }, ...STANDARD];
    const group = `nodalia-cbr-${Math.random().toString(36).slice(2, 11)}`;
    const optionsHtml = presets
      .map(p => {
        const checked = current === p.v ? " checked" : "";
        return `
      <label class="editor-chip-radius__option">
        <input type="radio" name="${esc(group)}" data-field="${esc(field)}" data-value-type="string" value="${esc(p.v)}"${checked} />
        <span>${p.l}</span>
      </label>`;
      })
      .join("");
    return `
    <div class="editor-field editor-field--full editor-chip-radius">
      <span>${tHeading}</span>
      <div class="editor-chip-radius__options" role="radiogroup" aria-label="${tHeading}">
        ${optionsHtml}
      </div>
    </div>`;
  }

  /**
   * Visual editor: preset radios for `styles.card.border_radius` (rounded card corners).
   * Uses the same Capsule / Soft / Rounded / Square labels as chip presets; values are tuned for ha-card scale.
   */
  function renderEditorCardBorderRadiusHtml(options) {
    const esc = options?.escapeHtml;
    if (typeof esc !== "function") {
      return "";
    }
    const fieldRaw = String(options?.field ?? "styles.card.border_radius").trim();
    const field = fieldRaw || "styles.card.border_radius";
    const current = String(options?.value ?? "").trim() || "28px";
    const tHeading = esc(String(options?.tHeading ?? "Card corner radius"));
    const labels = options?.labels ?? {};
    const tPill = esc(String(labels.pill ?? "Capsule"));
    const tSoft = esc(String(labels.soft ?? "Soft"));
    const tRound = esc(String(labels.round ?? "Rounded"));
    const tSquare = esc(String(labels.square ?? "Square"));
    const STANDARD = [
      { v: "28px", l: tPill },
      { v: "20px", l: tSoft },
      { v: "14px", l: tRound },
      { v: "8px", l: tSquare },
    ];
    const inStandard = STANDARD.some(p => p.v === current);
    const presets = inStandard ? STANDARD : [{ v: current, l: esc(current) }, ...STANDARD];
    const group = `nodalia-cbr-card-${Math.random().toString(36).slice(2, 11)}`;
    const optionsHtml = presets
      .map(p => {
        const checked = current === p.v ? " checked" : "";
        return `
      <label class="editor-chip-radius__option">
        <input type="radio" name="${esc(group)}" data-field="${esc(field)}" data-value-type="string" value="${esc(p.v)}"${checked} />
        <span>${p.l}</span>
      </label>`;
      })
      .join("");
    return `
    <div class="editor-field editor-field--full editor-chip-radius">
      <span>${tHeading}</span>
      <div class="editor-chip-radius__options" role="radiogroup" aria-label="${tHeading}">
        ${optionsHtml}
      </div>
    </div>`;
  }

  /**
   * Long-press on the card host (capture): `resolveZone` returns a zone string or null to ignore.
   * After `holdMs`, `onHold(zone)` runs once; `markHoldConsumedClick` should set a flag so the
   * card's click handler can ignore the following click (synthetic after pointerup).
   */
  function bindHostPointerHoldGesture(host, options) {
    if (!(host instanceof HTMLElement)) {
      return () => {};
    }
    if (typeof options?.resolveZone !== "function" || typeof options?.onHold !== "function") {
      return () => {};
    }
    const holdMs = Number.isFinite(Number(options.holdMs)) && Number(options.holdMs) > 0
      ? Math.round(Number(options.holdMs))
      : 500;
    const moveTol = Number.isFinite(Number(options.moveTolerancePx)) && Number(options.moveTolerancePx) > 0
      ? Number(options.moveTolerancePx)
      : 12;
    const shouldBeginHold = typeof options.shouldBeginHold === "function" ? options.shouldBeginHold : () => true;
    const markHoldConsumedClick = typeof options.markHoldConsumedClick === "function"
      ? options.markHoldConsumedClick
      : () => {};

    let timer = null;
    let active = null;

    function clearWindowListeners() {
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
      window.removeEventListener("pointermove", onWindowPointerMove);
    }

    function resetTracking() {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      clearWindowListeners();
      active = null;
    }

    function onWindowPointerMove(ev) {
      if (!active || ev.pointerId !== active.pointerId) {
        return;
      }
      const dx = ev.clientX - active.x;
      const dy = ev.clientY - active.y;
      if (Math.hypot(dx, dy) > moveTol) {
        resetTracking();
      }
    }

    function onWindowPointerUp(ev) {
      if (!active || ev.pointerId !== active.pointerId) {
        return;
      }
      resetTracking();
    }

    function onPointerDownCapture(ev) {
      if (!(ev instanceof PointerEvent)) {
        return;
      }
      if (typeof ev.button === "number" && ev.button !== 0) {
        return;
      }
      const zone = options.resolveZone(ev);
      if (!zone) {
        return;
      }
      if (shouldBeginHold(zone, ev) !== true) {
        return;
      }
      resetTracking();
      active = {
        pointerId: ev.pointerId,
        x: ev.clientX,
        y: ev.clientY,
        zone,
      };
      timer = window.setTimeout(() => {
        timer = null;
        if (!active || active.pointerId !== ev.pointerId) {
          return;
        }
        const z = active.zone;
        resetTracking();
        options.onHold(z);
        markHoldConsumedClick();
      }, holdMs);
      window.addEventListener("pointerup", onWindowPointerUp);
      window.addEventListener("pointercancel", onWindowPointerUp);
      window.addEventListener("pointermove", onWindowPointerMove, { passive: true });
    }

    host.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => {
      host.removeEventListener("pointerdown", onPointerDownCapture, true);
      resetTracking();
    };
  }

  function mountIconPickerHost(host, options) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const hass = options.hass;
    const nextValue = options.value !== undefined ? String(options.value) : String(host.dataset.value || "");
    const placeholder = options.placeholder !== undefined ? options.placeholder : host.dataset.placeholder || "";
    const onShadowInput = options.onShadowInput;
    const onShadowValueChanged = options.onShadowValueChanged;
    const copyDatasetFromHost = options.copyDatasetFromHost !== false;

    const useIconPicker = typeof customElements !== "undefined" && customElements.get("ha-icon-picker");

    let desired = useIconPicker ? "icon" : "input";
    let control = host.firstElementChild;
    const tag = control?.tagName || "";
    const matches =
      control && ((desired === "icon" && tag === "HA-ICON-PICKER") || (desired === "input" && tag === "INPUT"));

    if (!matches) {
      host.replaceChildren();
      if (useIconPicker) {
        control = document.createElement("ha-icon-picker");
      } else {
        control = document.createElement("input");
        control.type = "text";
      }

      if (copyDatasetFromHost) {
        copyDatasetExcept(control, host, ["mountedControl", "value", "placeholder", "field"]);
      }

      if ("hass" in control) {
        control.hass = hass;
      }
      if (placeholder && "placeholder" in control) {
        control.placeholder = placeholder;
      }
      if ("value" in control) {
        control.value = nextValue;
      }

      pickerCallbackState.set(control, { onShadowInput, onShadowValueChanged });
      if (!pickerControlsWithListeners.has(control)) {
        pickerControlsWithListeners.add(control);
        if (control.tagName === "INPUT") {
          control.addEventListener("change", dispatchPickerChange);
        } else {
          control.addEventListener("value-changed", dispatchPickerValueChanged);
        }
      }

      host.appendChild(control);
      return;
    }

    pickerCallbackState.set(control, { onShadowInput, onShadowValueChanged });
    if ("hass" in control) {
      control.hass = hass;
    }
    if (placeholder && "placeholder" in control) {
      control.placeholder = placeholder;
    }
    if ("value" in control && control.value !== nextValue) {
      control.value = nextValue;
    }
  }

  const api = {
    isObject,
    deepClone,
    deepEqual,
    stripEqualToDefaults,
    editorStatesSignature,
    editorFilteredStatesSignature,
    sanitizeActionUrl,
    mountEntityPickerHost,
    mountIconPickerHost,
    postHomeAssistantWebhook,
    warnStrictServiceDenied,
    renderEditorChipBorderRadiusHtml,
    renderEditorCardBorderRadiusHtml,
    bindHostPointerHoldGesture,
  };

  if (typeof window !== "undefined") {
    window.NodaliaUtils = api;
  }
})();

// </nodalia-standalone-utils>

const CARD_TAG = "nodalia-cover-card";
const EDITOR_TAG = "nodalia-cover-card-editor";
const CARD_VERSION = "1.1.0-alpha.1";

const COVER_FEATURES = {
  OPEN: 1,
  CLOSE: 2,
  SET_POSITION: 4,
  STOP: 8,
  OPEN_TILT: 16,
  CLOSE_TILT: 32,
  STOP_TILT: 64,
  SET_TILT_POSITION: 128,
};

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  show_state_chip: true,
  show_position: true,
  show_tilt: true,
  show_stop: true,
  compact_layout_mode: "auto",
  animate_icon: true,
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  grid_options: {
    rows: "auto",
    columns: "full",
    min_rows: 2,
    min_columns: 3,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "28px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "14px",
      gap: "12px",
    },
    icon: {
      size: "42px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      active_color: "var(--info-color, #71c0ff)",
      closed_color: "var(--primary-text-color)",
    },
    control: {
      size: "42px",
      accent_color: "var(--primary-text-color)",
      accent_background: "color-mix(in srgb, var(--primary-text-color) 7%, transparent)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    title_size: "14px",
  },
};

const STUB_CONFIG = {
  entity: "cover.living_room_blinds",
  name: "Blinds",
};

const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
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
  const parts = String(path || "").split(".");
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
  const parts = String(path || "").split(".");
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

function getByPath(target, path) {
  const parts = String(path || "").split(".");
  let cursor = target;
  for (const key of parts) {
    if (!key || (!isObject(cursor) && !Array.isArray(cursor))) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return cursor;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseFiniteNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const numeric = Number(String(value).replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeTextKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
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

function getStubEntityId(hass) {
  return Object.keys(hass?.states || {}).find(entityId => entityId.startsWith("cover.")) || "";
}

function normalizeConfig(config) {
  const merged = mergeConfig(DEFAULT_CONFIG, config || {});
  const compact = String(merged.compact_layout_mode || "auto").trim().toLowerCase();
  merged.compact_layout_mode = ["auto", "always", "never"].includes(compact) ? compact : "auto";
  merged.show_state_chip = merged.show_state_chip !== false;
  merged.show_position = merged.show_position !== false;
  merged.show_tilt = merged.show_tilt !== false;
  merged.show_stop = merged.show_stop !== false;
  merged.animate_icon = merged.animate_icon !== false;
  return merged;
}

function coverDeviceIcon(state) {
  const attrs = state?.attributes || {};
  const deviceClass = normalizeTextKey(attrs.device_class || "");
  const stateKey = normalizeTextKey(state?.state || "");
  const open = stateKey === "open" || stateKey === "opening";
  switch (deviceClass) {
    case "awning":
      return open ? "mdi:awning" : "mdi:awning-outline";
    case "blind":
    case "shade":
      return open ? "mdi:blinds-open" : "mdi:blinds";
    case "curtain":
      return open ? "mdi:curtains" : "mdi:curtains-closed";
    case "door":
      return open ? "mdi:door-open" : "mdi:door-closed";
    case "garage":
      return open ? "mdi:garage-open-variant" : "mdi:garage-variant";
    case "gate":
      return open ? "mdi:gate-open" : "mdi:gate";
    case "shutter":
      return open ? "mdi:window-shutter-open" : "mdi:window-shutter";
    case "window":
      return open ? "mdi:window-open-variant" : "mdi:window-closed-variant";
    default:
      return open ? "mdi:window-open" : "mdi:window-closed";
  }
}

function stateLabel(state) {
  const key = normalizeTextKey(state?.state || "");
  const labels = {
    open: "Open",
    closed: "Closed",
    opening: "Opening",
    closing: "Closing",
    stopped: "Stopped",
    unavailable: "Unavailable",
    unknown: "Unknown",
  };
  return labels[key] || String(state?.state || "Unknown");
}

class NodaliaCoverCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    const config = deepClone(STUB_CONFIG);
    const entityId = getStubEntityId(hass);
    if (entityId) {
      config.entity = entityId;
      config.name = hass?.states?.[entityId]?.attributes?.friendly_name || "";
    }
    return config;
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._onClick = this._onClick.bind(this);
    this._onInput = this._onInput.bind(this);
    this.shadowRoot.addEventListener("click", this._onClick);
    this.shadowRoot.addEventListener("change", this._onInput);
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._lastRenderSignature = "";
    this._render();
  }

  set hass(hass) {
    const signature = this._getRenderSignature(hass);
    this._hass = hass;
    if (this.shadowRoot?.innerHTML && signature === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = signature;
    this._render();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    const base = mergeConfig(DEFAULT_CONFIG.grid_options, this._config?.grid_options || {});
    return {
      rows: base.rows === undefined || base.rows === "" ? "auto" : base.rows,
      columns: base.columns === undefined || base.columns === "" ? "full" : base.columns,
      min_rows: Math.max(1, Number(base.min_rows) || 2),
      min_columns: Math.max(1, Number(base.min_columns) || 3),
    };
  }

  _getState(hass = this._hass) {
    return hass?.states?.[this._config?.entity] || null;
  }

  _getRenderSignature(hass = this._hass) {
    const state = this._getState(hass);
    const attrs = state?.attributes || {};
    return [
      this._config?.entity || "",
      this._config?.name || "",
      this._config?.icon || "",
      state?.state || "",
      attrs.friendly_name || "",
      attrs.icon || "",
      attrs.device_class || "",
      attrs.current_position ?? "",
      attrs.current_tilt_position ?? "",
      attrs.supported_features ?? "",
      this._config?.show_position !== false ? 1 : 0,
      this._config?.show_tilt !== false ? 1 : 0,
      this._config?.show_stop !== false ? 1 : 0,
    ].join("|");
  }

  _features(state = this._getState()) {
    return Number(state?.attributes?.supported_features) || 0;
  }

  _supports(feature, state = this._getState()) {
    return Boolean(this._features(state) & feature);
  }

  _call(service, data = {}) {
    if (!this._hass || !this._config?.entity) {
      return;
    }
    this._hass.callService("cover", service, {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _triggerHaptic(styleOverride = null) {
    const haptics = this._config?.haptics || {};
    if (haptics.enabled !== true) {
      return;
    }
    const style = styleOverride || haptics.style || "medium";
    fireEvent(this, "haptic", style);
    if (haptics.fallback_vibrate === true && typeof navigator?.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection);
    }
  }

  _onClick(event) {
    const action = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.coverAction)
      ?.dataset?.coverAction;
    if (!action) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic("selection");
    switch (action) {
      case "open":
        this._call("open_cover");
        break;
      case "close":
        this._call("close_cover");
        break;
      case "stop":
        this._call("stop_cover");
        break;
      case "more-info":
        fireEvent(this, "hass-more-info", { entityId: this._config?.entity });
        break;
      default:
        break;
    }
  }

  _onInput(event) {
    const input = event.composedPath().find(node => node instanceof HTMLInputElement && node.dataset?.coverSlider);
    if (!input) {
      return;
    }
    event.stopPropagation();
    const value = clamp(Math.round(Number(input.value)), 0, 100);
    if (!Number.isFinite(value)) {
      return;
    }
    this._triggerHaptic("selection");
    if (input.dataset.coverSlider === "position") {
      this._call("set_cover_position", { position: value });
    } else if (input.dataset.coverSlider === "tilt") {
      this._call("set_cover_tilt_position", { tilt_position: value });
    }
  }

  _isCompact() {
    const mode = this._config?.compact_layout_mode || "auto";
    if (mode === "always") {
      return true;
    }
    if (mode === "never") {
      return false;
    }
    const columns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(columns) && columns < 4;
  }

  _accentColor(state) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const key = normalizeTextKey(state?.state || "");
    if (key === "closed") {
      return styles.icon?.closed_color || DEFAULT_CONFIG.styles.icon.closed_color;
    }
    if (["open", "opening", "closing"].includes(key)) {
      return styles.icon?.active_color || DEFAULT_CONFIG.styles.icon.active_color;
    }
    return styles.icon?.color || DEFAULT_CONFIG.styles.icon.color;
  }

  _renderSlider(kind, label, value, supported) {
    if (!supported || value === null) {
      return "";
    }
    return `
      <label class="cover-card__slider">
        <span>${escapeHtml(label)}</span>
        <input type="range" min="0" max="100" step="1" value="${escapeHtml(String(value))}" data-cover-slider="${escapeHtml(kind)}" />
        <span class="cover-card__slider-value">${escapeHtml(String(Math.round(value)))}%</span>
      </label>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    const state = this._getState();
    const attrs = state?.attributes || {};
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const iconStyles = styles.icon || DEFAULT_CONFIG.styles.icon;
    const controlStyles = styles.control || DEFAULT_CONFIG.styles.control;
    const iconGlyphSize = `${Math.round(parseSizeToPixels(iconStyles.size, 42) * 0.56)}px`;
    const accent = this._accentColor(state);
    const title = this._config?.name || attrs.friendly_name || this._config?.entity || "Cover";
    const icon = this._config?.icon || attrs.icon || coverDeviceIcon(state);
    const stateText = state ? stateLabel(state) : "Not configured";
    const position = parseFiniteNumber(attrs.current_position);
    const tilt = parseFiniteNumber(attrs.current_tilt_position);
    const compact = this._isCompact();
    const showPosition = this._config?.show_position !== false;
    const showTilt = this._config?.show_tilt !== false;
    const showStop = this._config?.show_stop !== false && this._supports(COVER_FEATURES.STOP, state);
    const animate = this._config?.animate_icon !== false && ["opening", "closing"].includes(normalizeTextKey(state?.state));

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        * { box-sizing: border-box; }
        ha-card {
          --cover-accent: ${accent};
          background: ${styles.card?.background || DEFAULT_CONFIG.styles.card.background};
          border: ${styles.card?.border || DEFAULT_CONFIG.styles.card.border};
          border-radius: ${styles.card?.border_radius || DEFAULT_CONFIG.styles.card.border_radius};
          box-shadow: ${styles.card?.box_shadow || DEFAULT_CONFIG.styles.card.box_shadow};
          color: var(--primary-text-color);
          display: grid;
          gap: ${styles.card?.gap || DEFAULT_CONFIG.styles.card.gap};
          overflow: hidden;
          padding: ${styles.card?.padding || DEFAULT_CONFIG.styles.card.padding};
        }
        .cover-card {
          display: grid;
          gap: 14px;
        }
        .cover-card--compact {
          gap: 12px;
        }
        .cover-card__header {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: auto minmax(0, 1fr) auto;
        }
        .cover-card__icon {
          align-items: center;
          background: ${iconStyles.background || DEFAULT_CONFIG.styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border-radius: 999px;
          color: var(--cover-accent);
          display: inline-flex;
          height: ${iconStyles.size || DEFAULT_CONFIG.styles.icon.size};
          justify-content: center;
          width: ${iconStyles.size || DEFAULT_CONFIG.styles.icon.size};
        }
        .cover-card__icon ha-icon {
          --mdc-icon-size: ${iconGlyphSize};
        }
        .cover-card__icon.is-moving ha-icon {
          animation: cover-card-breathe 1.2s ease-in-out infinite;
        }
        .cover-card__title {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .cover-card__name {
          font-size: ${styles.title_size || DEFAULT_CONFIG.styles.title_size};
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cover-card__subtitle {
          color: var(--secondary-text-color);
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cover-card__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: flex-end;
        }
        .cover-card__chip {
          align-items: center;
          background: color-mix(in srgb, var(--cover-accent) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--cover-accent) 22%, transparent);
          border-radius: ${styles.chip_border_radius || DEFAULT_CONFIG.styles.chip_border_radius};
          color: var(--primary-text-color);
          display: inline-flex;
          font-size: ${styles.chip_font_size || DEFAULT_CONFIG.styles.chip_font_size};
          font-weight: 700;
          height: ${styles.chip_height || DEFAULT_CONFIG.styles.chip_height};
          padding: ${styles.chip_padding || DEFAULT_CONFIG.styles.chip_padding};
          white-space: nowrap;
        }
        .cover-card__controls {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(${showStop ? 3 : 2}, minmax(0, 1fr));
        }
        .cover-card__button {
          align-items: center;
          background: ${controlStyles.accent_background || DEFAULT_CONFIG.styles.control.accent_background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 18px;
          color: ${controlStyles.accent_color || DEFAULT_CONFIG.styles.control.accent_color};
          cursor: pointer;
          display: inline-flex;
          height: ${controlStyles.size || DEFAULT_CONFIG.styles.control.size};
          justify-content: center;
          min-width: 0;
          transition: transform 160ms ease, background 160ms ease;
        }
        .cover-card__button:hover {
          background: color-mix(in srgb, var(--cover-accent) 12%, transparent);
        }
        .cover-card__button:active {
          transform: scale(.97);
        }
        .cover-card__button ha-icon {
          --mdc-icon-size: 24px;
        }
        .cover-card__sliders {
          display: grid;
          gap: 10px;
        }
        .cover-card__slider {
          align-items: center;
          display: grid;
          gap: 10px;
          grid-template-columns: 58px minmax(0, 1fr) 44px;
        }
        .cover-card__slider span {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 700;
        }
        .cover-card__slider input {
          accent-color: var(--cover-accent);
          min-width: 0;
          width: 100%;
        }
        .cover-card__slider-value {
          color: var(--primary-text-color) !important;
          text-align: right;
        }
        .cover-card--compact .cover-card__header {
          grid-template-columns: auto minmax(0, 1fr);
        }
        .cover-card--compact .cover-card__chips {
          grid-column: 1 / -1;
          justify-content: flex-start;
        }
        @keyframes cover-card-breathe {
          0%, 100% { transform: translateY(0); opacity: .82; }
          50% { transform: translateY(-2px); opacity: 1; }
        }
      </style>
      <ha-card>
        <div class="cover-card ${compact ? "cover-card--compact" : ""}">
          <div class="cover-card__header">
            <button class="cover-card__icon ${animate ? "is-moving" : ""}" data-cover-action="more-info" title="${escapeHtml(title)}">
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
            </button>
            <div class="cover-card__title">
              <div class="cover-card__name">${escapeHtml(title)}</div>
              <div class="cover-card__subtitle">${escapeHtml(this._config?.entity || "Select a cover entity")}</div>
            </div>
            <div class="cover-card__chips">
              ${this._config?.show_state_chip !== false ? `<span class="cover-card__chip">${escapeHtml(stateText)}</span>` : ""}
              ${showPosition && position !== null ? `<span class="cover-card__chip">${Math.round(position)}%</span>` : ""}
              ${showTilt && tilt !== null ? `<span class="cover-card__chip">Tilt ${Math.round(tilt)}%</span>` : ""}
            </div>
          </div>
          <div class="cover-card__controls">
            <button class="cover-card__button" data-cover-action="open" title="Open"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
            ${showStop ? `<button class="cover-card__button" data-cover-action="stop" title="Stop"><ha-icon icon="mdi:stop"></ha-icon></button>` : ""}
            <button class="cover-card__button" data-cover-action="close" title="Close"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
          </div>
          <div class="cover-card__sliders">
            ${showPosition ? this._renderSlider("position", "Position", position, this._supports(COVER_FEATURES.SET_POSITION, state)) : ""}
            ${showTilt ? this._renderSlider("tilt", "Tilt", tilt, this._supports(COVER_FEATURES.SET_TILT_POSITION, state)) : ""}
          </div>
        </div>
      </ha-card>
    `;
  }
}

class NodaliaCoverCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._onInput = this._onInput.bind(this);
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _readValue(input) {
    if (input.type === "checkbox") {
      return input.checked;
    }
    if (input.dataset.valueType === "number") {
      const value = Number(input.value);
      return Number.isFinite(value) ? value : undefined;
    }
    return input.value;
  }

  _setValue(path, value) {
    const next = mergeConfig(DEFAULT_CONFIG, this._config || {});
    if (value === "" || value === undefined || value === null) {
      deleteByPath(next, path);
    } else {
      setByPath(next, path, value);
    }
    this._config = normalizeConfig(next);
    fireEvent(this, "config-changed", { config: compactConfig(this._config) });
  }

  _onInput(event) {
    const input = event.composedPath().find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement);
    if (!input?.dataset?.field) {
      return;
    }
    this._setValue(input.dataset.field, this._readValue(input));
  }

  _field(label, field, value, options = {}) {
    return `
      <label class="editor-field ${options.full ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <input type="${escapeHtml(options.type || "text")}" data-field="${escapeHtml(field)}" data-value-type="${escapeHtml(options.valueType || "string")}" value="${escapeHtml(value ?? "")}" placeholder="${escapeHtml(options.placeholder || "")}" />
      </label>
    `;
  }

  _checkbox(label, field, checked) {
    return `
      <label class="editor-toggle">
        <input type="checkbox" data-field="${escapeHtml(field)}" ${checked ? "checked" : ""} />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  _select(label, field, value, options) {
    return `
      <label class="editor-field">
        <span>${escapeHtml(label)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options.map(option => `<option value="${escapeHtml(option.value)}" ${String(value) === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  _entityDatalist() {
    const ids = Object.keys(this._hass?.states || {}).filter(id => id.startsWith("cover.")).sort();
    return `<datalist id="cover-card-entities">${ids.map(id => `<option value="${escapeHtml(id)}"></option>`).join("")}</datalist>`;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    const c = this._config || normalizeConfig(STUB_CONFIG);
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        * { box-sizing: border-box; }
        .editor { color: var(--primary-text-color); display: grid; gap: 16px; }
        .editor-section {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 18px;
          display: grid;
          gap: 14px;
          padding: 16px;
        }
        .editor-section__title { font-size: 15px; font-weight: 700; }
        .editor-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .editor-field { display: grid; gap: 6px; min-width: 0; }
        .editor-field--full { grid-column: 1 / -1; }
        .editor-field span, .editor-toggle span { font-size: 12px; font-weight: 600; }
        input, select {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 40px;
          padding: 10px 12px;
          width: 100%;
        }
        .editor-toggle {
          align-items: center;
          cursor: pointer;
          display: grid;
          gap: 10px;
          grid-template-columns: auto minmax(0, 1fr);
          min-height: 40px;
        }
        .editor-toggle input {
          block-size: 1px;
          inline-size: 1px;
          opacity: 0;
          position: absolute;
        }
        .editor-toggle__switch {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          display: inline-flex;
          height: 22px;
          position: relative;
          width: 40px;
        }
        .editor-toggle__switch::before {
          background: rgba(255, 255, 255, .92);
          border-radius: 999px;
          content: "";
          height: 18px;
          left: 1px;
          position: absolute;
          top: 1px;
          transition: transform 160ms ease;
          width: 18px;
        }
        .editor-toggle input:checked + .editor-toggle__switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }
        .editor-toggle input:checked + .editor-toggle__switch::before { transform: translateX(18px); }
        @media (max-width: 640px) { .editor-grid { grid-template-columns: 1fr; } }
      </style>
      ${this._entityDatalist()}
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__title">Cover</div>
          <div class="editor-grid">
            ${this._field("Entity", "entity", c.entity, { placeholder: "cover.living_room_blinds", full: true })}
            ${this._field("Name", "name", c.name)}
            ${this._field("Icon", "icon", c.icon, { placeholder: "mdi:blinds" })}
            ${this._select("Layout", "compact_layout_mode", c.compact_layout_mode, [
              { value: "auto", label: "Auto" },
              { value: "always", label: "Compact" },
              { value: "never", label: "Regular" },
            ])}
            ${this._checkbox("Show state chip", "show_state_chip", c.show_state_chip !== false)}
            ${this._checkbox("Show position", "show_position", c.show_position !== false)}
            ${this._checkbox("Show tilt", "show_tilt", c.show_tilt !== false)}
            ${this._checkbox("Show stop button", "show_stop", c.show_stop !== false)}
            ${this._checkbox("Animate icon", "animate_icon", c.animate_icon !== false)}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__title">Style</div>
          <div class="editor-grid">
            ${this._field("Card background", "styles.card.background", c.styles?.card?.background)}
            ${this._field("Card border", "styles.card.border", c.styles?.card?.border)}
            ${this._field("Card radius", "styles.card.border_radius", c.styles?.card?.border_radius)}
            ${this._field("Card padding", "styles.card.padding", c.styles?.card?.padding)}
            ${this._field("Active color", "styles.icon.active_color", c.styles?.icon?.active_color)}
            ${this._field("Closed color", "styles.icon.closed_color", c.styles?.icon?.closed_color)}
            ${this._field("Icon size", "styles.icon.size", c.styles?.icon?.size)}
            ${this._field("Control size", "styles.control.size", c.styles?.control?.size)}
          </div>
        </section>
      </div>
    `;
    this.shadowRoot.querySelectorAll("input, select").forEach(input => {
      input.addEventListener("change", this._onInput);
      if (input instanceof HTMLInputElement && input.type !== "checkbox") {
        input.addEventListener("input", this._onInput);
      }
    });
    this.shadowRoot.querySelector('input[data-field="entity"]')?.setAttribute("list", "cover-card-entities");
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCoverCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCoverCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Cover Card",
  description: "Nodalia-style controls for Home Assistant cover entities.",
  preview: true,
});
