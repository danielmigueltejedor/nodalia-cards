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
    "registerCustomCard",
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

  function dedupeCustomCardsArray(cards) {
    if (!Array.isArray(cards)) {
      return [];
    }
    const seen = new Set();
    for (let index = cards.length - 1; index >= 0; index -= 1) {
      const type = String(cards[index]?.type || "").trim();
      if (!type) {
        continue;
      }
      if (seen.has(type)) {
        cards.splice(index, 1);
        continue;
      }
      seen.add(type);
    }
    return cards;
  }

  function installCustomCardsDedupe() {
    if (typeof window === "undefined") {
      return null;
    }
    window.customCards = dedupeCustomCardsArray(window.customCards || []);
    const cards = window.customCards;
    if (cards.__nodaliaDedupePushInstalled === true) {
      return cards;
    }
    Object.defineProperty(cards, "__nodaliaDedupePushInstalled", {
      configurable: true,
      enumerable: false,
      value: true,
    });
    Object.defineProperty(cards, "push", {
      configurable: true,
      enumerable: false,
      value(...items) {
        let length = this.length;
        items.forEach(item => {
          const type = String(item?.type || "").trim();
          if (type) {
            for (let index = this.length - 1; index >= 0; index -= 1) {
              if (String(this[index]?.type || "").trim() === type) {
                this.splice(index, 1);
              }
            }
          }
          length = Array.prototype.push.call(this, item);
        });
        return length;
      },
    });
    return cards;
  }

  function registerCustomCard(metadata) {
    const cards = installCustomCardsDedupe();
    if (!cards || !metadata || typeof metadata !== "object") {
      return;
    }
    cards.push(metadata);
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
    registerCustomCard,
    renderEditorChipBorderRadiusHtml,
    renderEditorCardBorderRadiusHtml,
    bindHostPointerHoldGesture,
  };

  if (typeof window !== "undefined") {
    installCustomCardsDedupe();
    window.NodaliaUtils = api;
  }
})();

// </nodalia-standalone-utils>

const CARD_TAG = "nodalia-vacuum-card";
const EDITOR_TAG = "nodalia-vacuum-card-editor";
const CARD_VERSION = "1.1.0-alpha.6";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
const COMPACT_LAYOUT_THRESHOLD = 190;
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
const MODE_LABELS = {
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
};

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  tap_action: "default",
  tap_navigation_path: "",
  icon_tap_action: "",
  hold_action: "none",
  icon_hold_action: "",
  hold_navigation_path: "",
  icon_hold_navigation_path: "",
  compact_layout_mode: "auto",
  show_state_chip: true,
  show_battery_chip: true,
  show_fan_speed_chip: true,
  show_mode_controls: true,
  show_fan_presets: true,
  show_return_to_base: true,
  show_stop: true,
  show_locate: true,
  fan_presets: [],
  hidden_suction_modes: [],
  hidden_mop_modes: [],
  state_entity: "",
  error_entity: "",
  battery_entity: "",
  room_mapping_entity: "",
  suction_select_entity: "",
  mop_select_entity: "",
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    icon_animation: true,
    panel_duration: 800,
    button_bounce_duration: 320,
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
      size: "50px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      active_color: "#61c97a",
      washing_color: "#5aa7ff",
      drying_color: "#f1c24c",
      emptying_color: "#9b6b4a",
      returning_color: "#f6b73c",
      error_color: "var(--error-color, #ff6b6b)",
      docked_color: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
    },
    control: {
      size: "40px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(var(--rgb-primary-color), 0.18)",
    },
    chip_height: "24px",
    chip_font_size: "9px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    title_size: "12px",
  },
};

const STUB_CONFIG = {
  entity: "vacuum.salon",
  name: "Robot salon",
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

function getStubEntityId(hass, domains = []) {
  const states = hass?.states || {};
  const normalizedDomains = domains.map(domain => String(domain).trim()).filter(Boolean);
  return Object.keys(states).find(entityId => (
    !normalizedDomains.length || normalizedDomains.some(domain => entityId.startsWith(`${domain}.`))
  )) || "";
}

function applyStubEntity(config, hass, domains) {
  const entityId = getStubEntityId(hass, domains);
  if (!entityId) {
    return config;
  }

  config.entity = entityId;
  config.name = hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
  return config;
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
    return value
      .map(item => compactConfig(item))
      .filter(item => item !== undefined);
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

function arrayFromCsv(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeSelectorValue(value) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function sanitizeCssValue(value, fallback) {
  const raw = String(value ?? "").trim();
  const safeFallback = String(fallback ?? "").trim();
  if (!raw) {
    return safeFallback;
  }
  if (/[\u0000-\u001f\u007f<>;"'{}]/.test(raw) || raw.includes("/*") || raw.includes("*/")) {
    return safeFallback;
  }
  return raw;
}

function getSafeStyles(styles = DEFAULT_CONFIG.styles) {
  const walk = (candidate, fallback) => {
    if (isObject(fallback)) {
      const out = {};
      const source = isObject(candidate) ? candidate : {};
      Object.keys(fallback).forEach(key => {
        out[key] = walk(source[key], fallback[key]);
      });
      return out;
    }
    if (typeof fallback === "string") {
      return sanitizeCssValue(candidate, fallback);
    }
    return candidate === undefined ? fallback : candidate;
  };
  return walk(styles, DEFAULT_CONFIG.styles);
}

function resolveEditorColorValue(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue || typeof document === "undefined") {
    return "";
  }

  const probe = document.createElement("span");
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.color = "";
  probe.style.color = rawValue;
  if (!probe.style.color) {
    return rawValue;
  }

  (document.body || document.documentElement).appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || rawValue;
}

function formatEditorHexChannel(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function formatEditorColorFromHex(hex, alpha = 1) {
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

function getEditorColorModel(value, fallbackValue = "#71c0ff") {
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

function getEditorColorFallbackValue(field) {
  const normalizedField = String(field ?? "");

  if (normalizedField.endsWith("off_color") || normalizedField.endsWith("docked_color")) {
    return "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))";
  }

  if (normalizedField.endsWith("accent_background")) {
    return "rgba(var(--rgb-primary-color), 0.18)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  if (normalizedField.endsWith("error_color")) {
    return "var(--error-color, #ff6b6b)";
  }

  return "var(--info-color, #71c0ff)";
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

function normalizeTextKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

function humanizeModeLabel(value, kind = "generic", hass = null, configLang = null) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const key = normalizeTextKey(raw);
  const h = hass ?? (typeof window !== "undefined" ? window.NodaliaI18n?.resolveHass?.(null) : null);
  if (window.NodaliaI18n?.translateAdvanceVacuumVacuumMode) {
    return window.NodaliaI18n.translateAdvanceVacuumVacuumMode(h, configLang ?? "auto", raw, kind);
  }
  if (key === "off" && kind === "suction") {
    return "Off";
  }

  if (MODE_LABELS[key]) {
    return MODE_LABELS[key];
  }

  return raw
    .replaceAll("_", " ")
    .replace(/\b\w/g, match => match.toUpperCase());
}

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const normalizeList = value => (
    Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",")
        : []
  )
    .map(item => String(item || "").trim())
    .filter(Boolean);

  if (!Array.isArray(config.fan_presets)) {
    config.fan_presets = [];
  }

  config.fan_presets = config.fan_presets
    .map(item => String(item || "").trim())
    .filter(Boolean);
  config.hidden_suction_modes = normalizeList(config.hidden_suction_modes);
  config.hidden_mop_modes = normalizeList(config.hidden_mop_modes);

  const VACUUM_CARD_ACTION_KEYS = new Set(["default", "more_info", "navigate", "none"]);
  const normVacuumCardActionKey = raw => {
    const key = normalizeTextKey(String(raw ?? "").trim());
    return VACUUM_CARD_ACTION_KEYS.has(key) ? key : null;
  };
  const holdKey = normVacuumCardActionKey(config.hold_action);
  config.hold_action = holdKey || "none";
  const iconHoldRaw = String(config.icon_hold_action ?? "").trim();
  if (!iconHoldRaw) {
    config.icon_hold_action = "";
  } else {
    const iconHoldKey = normVacuumCardActionKey(iconHoldRaw);
    config.icon_hold_action = iconHoldKey || "";
  }
  config.hold_navigation_path = String(config.hold_navigation_path ?? "").trim();
  config.icon_hold_navigation_path = String(config.icon_hold_navigation_path ?? "").trim();

  return config;
}

class NodaliaVacuumCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["vacuum"]);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._cardWidth = 0;
    this._isCompactLayout = false;
    this._activeModePanel = null;
    this._roomPanelOpen = false;
    this._selectedCleaningAreas = [];
    this._lastNonSmartModeSelection = {
      suction: "",
      mop: "",
    };
    this._pendingModeSelection = {
      suction: "",
      mop: "",
    };
    this._pendingModeSelectionTimers = {
      suction: 0,
      mop: 0,
    };
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._suppressNextVacuumTap = false;
    this._resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextWidth = Math.round(entry.contentRect?.width || this.clientWidth || 0);
      const nextCompact = this._shouldUseCompactLayout(nextWidth);

      if (nextWidth === this._cardWidth && nextCompact === this._isCompactLayout) {
        return;
      }

      this._cardWidth = nextWidth;
      this._isCompactLayout = nextCompact;
      this._render();
    });
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const node = event
                .composedPath()
                .find(n => n instanceof HTMLElement && n.dataset?.vacuumAction);
              const action = node?.dataset?.vacuumAction;
              if (action === "body_tap") {
                return "body";
              }
              if (action === "icon_tap") {
                return "icon";
              }
              return null;
            },
            shouldBeginHold: zone => this._canRunConfiguredCardHoldAction(zone),
            onHold: zone => {
              const state = this._getState();
              this._syncRememberedModeSelections(state);
              this._triggerHaptic();
              this._runConfiguredCardHoldAction(state, zone);
            },
            markHoldConsumedClick: () => {
              this._suppressNextVacuumTap = true;
            },
          })
        : () => {};
  }

  connectedCallback() {
    this._resizeObserver?.observe(this);
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    this._detachHostHold?.();
    this._resizeObserver?.disconnect();
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    Object.keys(this._pendingModeSelectionTimers).forEach(kind => {
      if (this._pendingModeSelectionTimers[kind]) {
        window.clearTimeout(this._pendingModeSelectionTimers[kind]);
        this._pendingModeSelectionTimers[kind] = 0;
      }
    });
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._isCompactLayout = this._shouldUseCompactLayout(
      Math.round(this._cardWidth || this.clientWidth || 0),
    );
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._render();
  }

  set hass(hass) {
    const nextSignature = this._getRenderSignature(hass);
    this._hass = hass;
    const pendingChanged = this._syncPendingModeSelections();

    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature && !pendingChanged) {
      return;
    }

    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    return this._getEstimatedCardSize();
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 2,
      min_columns: 2,
    };
  }

  _notifyLayoutChange() {
    fireEvent(this, "iron-resize", {});

    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    }
  }

  _scheduleLayoutRefresh(delay = 0) {
    if (typeof window === "undefined") {
      return;
    }

    window.setTimeout(() => {
      this._notifyLayoutChange();
    }, Math.max(0, Number(delay) || 0));
  }

  _scheduleEntranceAnimationReset(delay) {
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }

    const safeDelay = clamp(Math.round(Number(delay) || 0), 0, 3000);
    if (!safeDelay || typeof window === "undefined") {
      this._animateContentOnNextRender = false;
      return;
    }

    this._entranceAnimationResetTimer = window.setTimeout(() => {
      this._entranceAnimationResetTimer = 0;
      this._animateContentOnNextRender = false;
    }, safeDelay);
  }

  _getEstimatedCardSize(state = this._getState()) {
    let size = 3;
    const availableModeDescriptors = this._getVisibleModeDescriptors(state);
    const activeModeDescriptor = availableModeDescriptors.find(mode => mode.kind === this._activeModePanel)
      || null;
    const roomMappings = this._getRoomMappings(state);
    const modePanelVisible = Boolean(this._activeModePanel);
    const roomPanelVisible = Boolean(this._roomPanelOpen && roomMappings.length);

    if (modePanelVisible && activeModeDescriptor?.options?.length) {
      size += Math.min(3, Math.max(1, Math.ceil(activeModeDescriptor.options.length / 4)));
    }

    if (roomPanelVisible) {
      size += Math.min(3, Math.max(1, Math.ceil(roomMappings.length / 4)));
    }

    return size;
  }

  _getRoomPanelMaxHeight(roomMappings) {
    const roomCount = Array.isArray(roomMappings) ? roomMappings.length : 0;
    return clamp(84 + (roomCount * 52), 220, 720);
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const errorEntityId = this._config?.error_entity || this._guessRelatedErrorEntity();
    const errorState = errorEntityId ? hass?.states?.[errorEntityId] || null : null;
    const attrs = state?.attributes || {};
    return JSON.stringify({
      entityId,
      state: String(state?.state || ""),
      friendlyName: String(attrs.friendly_name || ""),
      icon: String(attrs.icon || ""),
      batteryLevel: Number(attrs.battery_level ?? -1),
      status: String(attrs.status || ""),
      fanSpeed: String(attrs.fan_speed || ""),
      waterGrade: String(attrs.water_grade || attrs.water_box_mode || ""),
      currentRoom: String(attrs.current_room || attrs.current_segment || ""),
      errorEntityId,
      errorState: String(errorState?.state || ""),
      compact: Boolean(this._isCompactLayout),
      activeModePanel: String(this._activeModePanel || ""),
      roomPanelOpen: Boolean(this._roomPanelOpen),
      tapAction: String(this._config?.tap_action || ""),
      iconTapAction: String(this._config?.icon_tap_action ?? ""),
      tapNav: String(this._config?.tap_navigation_path || ""),
      holdAction: String(this._config?.hold_action || ""),
      iconHoldAction: String(this._config?.icon_hold_action ?? ""),
      holdNav: String(this._config?.hold_navigation_path || ""),
      iconHoldNav: String(this._config?.icon_hold_navigation_path || ""),
    });
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) && numericColumns > 0 ? numericColumns : null;
  }

  _getCompactLayoutThreshold() {
    const styles = getSafeStyles(this._config?.styles);
    const iconSize = parseSizeToPixels(styles?.icon?.size, 58);
    const cardPadding = parseSizeToPixels(styles?.card?.padding, 14);
    const cardGap = parseSizeToPixels(styles?.card?.gap, 12);

    return Math.max(
      COMPACT_LAYOUT_THRESHOLD,
      Math.round(iconSize + (cardPadding * 2) + (cardGap * 2) + 48),
    );
  }

  _shouldUseCompactLayout(width = Math.round(this._cardWidth || this.clientWidth || 0)) {
    const mode = this._config?.compact_layout_mode || "auto";

    if (mode === "always") {
      return true;
    }

    if (mode === "never") {
      return false;
    }

    const gridColumns = this._getConfiguredGridColumns();
    if (gridColumns !== null) {
      return gridColumns < 4;
    }

    return width > 0 && width < this._getCompactLayoutThreshold();
  }

  _triggerHaptic(style = this._config?.haptics?.style) {
    if (!this._config?.haptics?.enabled) {
      return;
    }

    const hapticStyle = String(style || "medium");

    try {
      fireEvent(this, "haptic", hapticStyle);
    } catch (_error) {
      // Ignore event dispatch issues and try vibration fallback below.
    }

    if (
      !this._config.haptics.fallback_vibrate ||
      typeof navigator === "undefined" ||
      typeof navigator.vibrate !== "function"
    ) {
      return;
    }

    navigator.vibrate(HAPTIC_PATTERNS[hapticStyle] || HAPTIC_PATTERNS.selection);
  }

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;
    return {
      enabled: configuredAnimations.enabled !== false,
      iconAnimation: configuredAnimations.icon_animation !== false,
      panelDuration: clamp(
        Number(configuredAnimations.panel_duration) || DEFAULT_CONFIG.animations.panel_duration,
        120,
        2400,
      ),
      buttonBounceDuration: clamp(
        Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
        120,
        1200,
      ),
    };
  }

  _triggerButtonBounce(button) {
    if (!(button instanceof HTMLElement)) {
      return;
    }

    const animations = this._getAnimationSettings();
    if (!animations.enabled) {
      return;
    }

    button.classList.remove("is-pressing");
    button.getBoundingClientRect();
    button.classList.add("is-pressing");

    window.setTimeout(() => {
      button.classList.remove("is-pressing");
    }, animations.buttonBounceDuration + 40);
  }

  _openMoreInfo(entityId = this._config?.entity) {
    if (!entityId) {
      return;
    }

    fireEvent(this, "hass-more-info", {
      entityId,
    });
  }

  _navigate(path) {
    const navigationPath = String(path || "").trim();
    if (!navigationPath) {
      return;
    }

    window.history.pushState(null, "", navigationPath);
    window.dispatchEvent(new CustomEvent("location-changed", {
      detail: { replace: false },
    }));
  }

  _effectiveVacuumTapAction(zone = "body") {
    const body = normalizeTextKey(this._config?.tap_action || "default");
    if (zone === "icon") {
      const raw = String(this._config?.icon_tap_action ?? "").trim();
      if (!raw) {
        return body;
      }
      return normalizeTextKey(raw);
    }
    return body;
  }

  _runConfiguredCardTapAction(state = this._getState(), zone = "body") {
    const action = this._effectiveVacuumTapAction(zone);

    switch (action) {
      case "none":
        break;
      case "more_info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "navigate":
        this._navigate(this._config?.tap_navigation_path);
        break;
      case "default":
      default:
        this._runPrimaryAction(state);
        break;
    }
  }

  _canRunConfiguredCardTapAction(zone = "body") {
    const action = this._effectiveVacuumTapAction(zone);

    if (action === "none") {
      return false;
    }

    if (action === "navigate") {
      return Boolean(String(this._config?.tap_navigation_path || "").trim());
    }

    if (action === "more_info") {
      return Boolean(this._config?.entity);
    }

    return true;
  }

  _effectiveVacuumHoldAction(zone = "body") {
    const body = normalizeTextKey(this._config?.hold_action || "none");
    if (zone === "icon") {
      const raw = String(this._config?.icon_hold_action ?? "").trim();
      if (!raw) {
        return body;
      }
      return normalizeTextKey(raw);
    }
    return body;
  }

  _resolveVacuumHoldNavigationPath(zone = "body") {
    const tapPath = String(this._config?.tap_navigation_path ?? "").trim();
    const holdPath = String(this._config?.hold_navigation_path ?? "").trim();
    const iconHoldPath = String(this._config?.icon_hold_navigation_path ?? "").trim();
    if (zone === "icon") {
      return iconHoldPath || holdPath || tapPath;
    }
    return holdPath || tapPath;
  }

  _runConfiguredCardHoldAction(state = this._getState(), zone = "body") {
    const action = this._effectiveVacuumHoldAction(zone);

    switch (action) {
      case "none":
        break;
      case "more_info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "navigate":
        this._navigate(this._resolveVacuumHoldNavigationPath(zone));
        break;
      case "default":
      default:
        this._runPrimaryAction(state);
        break;
    }
  }

  _canRunConfiguredCardHoldAction(zone = "body") {
    const action = this._effectiveVacuumHoldAction(zone);

    if (action === "none") {
      return false;
    }

    if (action === "navigate") {
      return Boolean(this._resolveVacuumHoldNavigationPath(zone));
    }

    if (action === "more_info") {
      return Boolean(this._config?.entity);
    }

    return true;
  }

  _getState() {
    if (!this._config?.entity || !this._hass?.states) {
      return null;
    }

    return this._hass.states[this._config.entity] || null;
  }

  _guessRelatedStateEntity() {
    if (!this._hass?.states || !this._config?.entity) {
      return "";
    }

    const objectId = String(this._config.entity).split(".")[1] || "";
    if (!objectId) {
      return "";
    }

    const candidates = Object.keys(this._hass.states)
      .filter(entityId => entityId.startsWith("sensor."))
      .filter(entityId => entityId.includes(objectId))
      .filter(entityId => ["estado", "status", "state"].some(pattern => entityId.includes(pattern)))
      .sort((left, right) => left.localeCompare(right, "es"));

    return candidates[0] || "";
  }

  _getAuxiliaryState() {
    const entityId = this._config?.state_entity || this._guessRelatedStateEntity();
    return entityId ? this._hass?.states?.[entityId] || null : null;
  }

  _guessRelatedErrorEntity() {
    if (!this._hass?.states || !this._config?.entity) {
      return "";
    }
    const objectId = String(this._config.entity).split(".")[1] || "";
    if (!objectId) {
      return "";
    }
    const candidates = Object.keys(this._hass.states)
      .filter(entityId => entityId.startsWith("sensor."))
      .filter(entityId => entityId.includes(objectId) || entityId.includes("roborock"))
      .filter(entityId => ["error", "fault", "fallo", "erro"].some(pattern => entityId.includes(pattern)))
      .sort((left, right) => left.localeCompare(right, "es"));
    return candidates[0] || "";
  }

  _getErrorState() {
    const entityId = this._config?.error_entity || this._guessRelatedErrorEntity();
    return entityId ? this._hass?.states?.[entityId] || null : null;
  }

  _getErrorLabel() {
    const raw = String(this._getErrorState()?.state || "").trim();
    if (!raw || !window.NodaliaI18n?.isVacuumErrorState?.(raw)) {
      return "";
    }
    return window.NodaliaI18n?.translateVacuumErrorState
      ? window.NodaliaI18n.translateVacuumErrorState(this._hass, this._config?.language ?? "auto", raw, raw)
      : raw;
  }

  _hasVacuumError() {
    return Boolean(this._getErrorLabel());
  }

  _guessRelatedBatteryEntity() {
    if (!this._hass?.states || !this._config?.entity) {
      return "";
    }

    const objectId = String(this._config.entity).split(".")[1] || "";
    if (!objectId) {
      return "";
    }

    const candidates = Object.keys(this._hass.states)
      .filter(entityId => entityId.startsWith("sensor."))
      .filter(entityId => entityId.includes(objectId))
      .filter(entityId => ["battery", "bateria"].some(pattern => entityId.includes(pattern)))
      .sort((left, right) => left.localeCompare(right, "es"));

    return candidates[0] || "";
  }

  _getAuxiliaryBatteryState() {
    const entityId = this._config?.battery_entity || this._guessRelatedBatteryEntity();
    return entityId ? this._hass?.states?.[entityId] || null : null;
  }

  _guessRelatedRoomMappingEntity() {
    if (!this._hass?.states || !this._config?.entity) {
      return "";
    }

    const objectId = String(this._config.entity).split(".")[1] || "";
    if (!objectId) {
      return "";
    }

    const candidates = Object.keys(this._hass.states)
      .filter(entityId => entityId.startsWith("sensor."))
      .filter(entityId => entityId.includes(objectId))
      .filter(entityId => ["room_mapping", "rooms", "segments", "habitaciones"].some(pattern => entityId.includes(pattern)))
      .sort((left, right) => left.localeCompare(right, "es"));

    return candidates[0] || "";
  }

  _getRoomMappingSourceState() {
    const explicitEntityId = this._config?.room_mapping_entity;
    if (explicitEntityId && this._hass?.states?.[explicitEntityId]) {
      return this._hass.states[explicitEntityId];
    }

    const auxiliaryState = this._getAuxiliaryState();
    if (
      auxiliaryState &&
      (
        auxiliaryState.attributes?.room_mapping !== undefined ||
        auxiliaryState.attributes?.rooms !== undefined ||
        String(auxiliaryState.state || "").includes("cleaning_area_id:")
      )
    ) {
      return auxiliaryState;
    }

    const state = this._getState();
    if (
      state &&
      (
        state.attributes?.room_mapping !== undefined ||
        state.attributes?.rooms !== undefined ||
        String(state.state || "").includes("cleaning_area_id:")
      )
    ) {
      return state;
    }

    const guessedEntityId = this._guessRelatedRoomMappingEntity();
    return guessedEntityId ? this._hass?.states?.[guessedEntityId] || null : null;
  }

  _extractRoomsFromString(rawValue) {
    const text = String(rawValue || "").trim();
    if (!text) {
      return [];
    }

    try {
      const parsed = JSON.parse(text);
      return this._normalizeRoomCollection(parsed);
    } catch (_error) {
      // Fall through to YAML-like parsing.
    }

    const roomBlocks = text
      .split(/\n(?=-\s*id:|\s*-\s*id:)/g)
      .map(block => block.trim())
      .filter(Boolean);

    const rooms = roomBlocks
      .map(block => {
        const idMatch = block.match(/(?:^|\n)\s*-?\s*id:\s*([^\n]+)/i);
        const nameMatch = block.match(/(?:^|\n)\s*name:\s*([^\n]+)/i);
        const cleaningAreaMatch = block.match(/(?:^|\n)\s*cleaning_area_id:\s*([^\n]+)/i);

        const id = idMatch ? idMatch[1].trim() : "";
        const name = nameMatch ? nameMatch[1].trim() : "";
        const cleaningAreaId = cleaningAreaMatch ? cleaningAreaMatch[1].trim() : "";

        if (!id && !name && !cleaningAreaId) {
          return null;
        }

        return {
          id,
          name,
          cleaning_area_id: cleaningAreaId,
        };
      })
      .filter(Boolean);

    return this._normalizeRoomCollection(rooms);
  }

  _normalizeRoomCollection(rawValue) {
    let collection = rawValue;

    if (typeof collection === "string") {
      return this._extractRoomsFromString(collection);
    }

    if (Array.isArray(collection)) {
      return collection;
    }

    if (collection && typeof collection === "object") {
      if (Array.isArray(collection.room_mapping)) {
        return collection.room_mapping;
      }

      if (Array.isArray(collection.rooms)) {
        return collection.rooms;
      }

      return Object.values(collection);
    }

    return [];
  }

  _getReportedStateValue(state) {
    const error = this._getErrorLabel();
    if (error) {
      return error;
    }
    const auxiliaryState = this._getAuxiliaryState();
    if (auxiliaryState?.state && !["unknown", "unavailable"].includes(String(auxiliaryState.state).toLowerCase())) {
      return String(auxiliaryState.state);
    }

    return state?.state ? String(state.state) : "";
  }

  _getReportedStateKey(state) {
    return normalizeTextKey(this._getReportedStateValue(state));
  }

  _getVacuumName(state) {
    if (this._config?.name) {
      return this._config.name;
    }

    if (state?.attributes?.friendly_name) {
      return state.attributes.friendly_name;
    }

    return this._config?.entity || "Vacuum";
  }

  _getVacuumIcon(state) {
    if (this._config?.icon) {
      return this._config.icon;
    }

    if (this._hasVacuumError()) {
      return "mdi:alert-circle-outline";
    }

    if (state?.attributes?.icon) {
      return state.attributes.icon;
    }

    switch (state?.state) {
      case "cleaning":
        return "mdi:robot-vacuum";
      case "returning":
        return "mdi:home-map-marker";
      case "paused":
        return "mdi:pause-circle-outline";
      case "error":
        return "mdi:alert-circle-outline";
      default:
        return "mdi:robot-vacuum";
    }
  }

  _getStateLabel(state) {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const langCfg = this._config?.language ?? "auto";
    const trState = (stateKey, rawFallback = state?.state) => (
      window.NodaliaI18n?.translateAdvanceVacuumReportedState
        ? window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, langCfg, stateKey, rawFallback)
        : rawFallback
    );

    const errorLabel = this._getErrorLabel();
    if (errorLabel) {
      return errorLabel;
    }

    if (this._isGoingToWashMops(state)) {
      return this._humanizeStateLabel("going_to_wash_mop", hass, langCfg);
    }

    if (this._isWashingMops(state)) {
      return trState("washing_mop", "Lavando mopas");
    }

    if (this._isDryingMops(state)) {
      return trState("drying_mop", "Secando");
    }

    if (this._isAutoEmptying(state)) {
      return trState("emptying", "Autovaciando");
    }

    const roomMappings = this._getRoomMappings(state);
    const cleaningAreaLabel = this._getCleaningAreaLabel(state, roomMappings);
    if (cleaningAreaLabel) {
      return `${trState("cleaning", "Limpiando")}: ${cleaningAreaLabel}`;
    }

    const reportedKey = normalizeTextKey(this._getReportedStateValue(state));
    switch (reportedKey) {
      case "cleaning":
      case "segment_cleaning":
      case "room_cleaning":
      case "zone_cleaning":
      case "segment_clean":
      case "room_clean":
      case "zone_clean":
      case "clean_area":
      case "vacuuming":
      case "limpiando":
        return trState("cleaning", "Limpiando");
      case "going_to_wash_the_mop":
      case "going_to_wash_mop":
      case "go_to_wash_mop":
      case "go_wash_mop":
      case "returning_to_wash_mop":
        return this._humanizeStateLabel("going_to_wash_mop", hass, langCfg);
      case "paused":
      case "pause":
      case "pausado":
        return trState("paused", "Pausado");
      case "returning":
      case "return_to_base":
      case "returning_home":
      case "volviendo":
        return trState("returning", "Volviendo a la base");
      case "docked":
      case "charging":
      case "charging_completed":
      case "en_base":
      case "base":
        return trState("docked", "En base");
      case "idle":
      case "standby":
      case "en_espera":
        return trState("fallback", "En espera");
      case "error":
      case "fallo":
        return trState("error", "Error");
      case "unavailable":
        return trState("unavailable", "No disponible");
      case "unknown":
        return trState("unknown", "Desconocido");
      default:
        return this._humanizeStateLabel(this._getReportedStateValue(state), hass, langCfg) || "Sin estado";
    }
  }

  _humanizeStateLabel(value, hass = null, configLang = null) {
    const raw = String(value ?? "").trim();
    if (!raw) {
      return "";
    }

    const normalized = normalizeTextKey(raw);
    if (!normalized) {
      return raw;
    }

    if (normalized.includes("go") && normalized.includes("wash") && normalized.includes("mop")) {
      return window.NodaliaI18n?.translateAdvanceVacuumReportedState
        ? window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, configLang ?? "auto", "washing_mop", "Yendo a lavar mopas")
        : "Yendo a lavar mopas";
    }

    if (normalized.includes("wash") && normalized.includes("mop")) {
      return window.NodaliaI18n?.translateAdvanceVacuumReportedState
        ? window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, configLang ?? "auto", "washing_mop", "Lavando mopas")
        : "Lavando mopas";
    }

    if (normalized.includes("dry") && normalized.includes("mop")) {
      return window.NodaliaI18n?.translateAdvanceVacuumReportedState
        ? window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, configLang ?? "auto", "drying_mop", "Secando mopas")
        : "Secando mopas";
    }

    if (normalized.includes("empty")) {
      return window.NodaliaI18n?.translateAdvanceVacuumReportedState
        ? window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, configLang ?? "auto", "emptying", "Autovaciando")
        : "Autovaciando";
    }

    if (normalized.includes("zone") && normalized.includes("clean")) {
      return window.NodaliaI18n?.translateAdvanceVacuumReportedState
        ? window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, configLang ?? "auto", "cleaning", "Limpiando zona")
        : "Limpiando zona";
    }

    if ((normalized.includes("room") || normalized.includes("segment")) && normalized.includes("clean")) {
      return window.NodaliaI18n?.translateAdvanceVacuumReportedState
        ? window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, configLang ?? "auto", "cleaning", "Limpiando habitación")
        : "Limpiando habitación";
    }

    return raw
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, match => match.toUpperCase());
  }

  _getActivityTextBlob(state) {
    const attributes = state?.attributes || {};
    const auxiliaryState = this._getAuxiliaryState();
    const auxiliaryAttributes = auxiliaryState?.attributes || {};
    return [
      auxiliaryState?.state,
      auxiliaryAttributes.status,
      auxiliaryAttributes.state,
      auxiliaryAttributes.activity,
      auxiliaryAttributes.phase,
      auxiliaryAttributes.job,
      auxiliaryAttributes.job_state,
      auxiliaryAttributes.task_status,
      auxiliaryAttributes.current_task,
      auxiliaryAttributes.vacuum_state,
      auxiliaryAttributes.robot_status,
      auxiliaryAttributes.cleaning_state,
      auxiliaryAttributes.cleaning_progress,
      auxiliaryAttributes.operation,
      state?.state,
      attributes.status,
      attributes.state,
      attributes.activity,
      attributes.phase,
      attributes.job,
      attributes.job_state,
      attributes.task_status,
      attributes.current_task,
      attributes.vacuum_state,
      attributes.robot_status,
      attributes.cleaning_state,
      attributes.cleaning_progress,
      attributes.operation,
    ]
      .filter(Boolean)
      .map(value => normalizeTextKey(value))
      .join(" ");
  }

  _getActiveTaskTokens(state) {
    const attributes = state?.attributes || {};
    const auxiliaryState = this._getAuxiliaryState();
    const auxiliaryAttributes = auxiliaryState?.attributes || {};

    return [
      auxiliaryState?.state,
      auxiliaryAttributes.activity,
      auxiliaryAttributes.phase,
      auxiliaryAttributes.job,
      auxiliaryAttributes.job_state,
      auxiliaryAttributes.task_status,
      auxiliaryAttributes.current_task,
      auxiliaryAttributes.cleaning_state,
      auxiliaryAttributes.operation,
      state?.state,
      attributes.activity,
      attributes.phase,
      attributes.job,
      attributes.job_state,
      attributes.task_status,
      attributes.current_task,
      attributes.cleaning_state,
      attributes.operation,
    ]
      .filter(Boolean)
      .map(value => normalizeTextKey(value));
  }

  _matchesActivity(state, keywords) {
    const activityBlob = this._getActivityTextBlob(state);
    return keywords.some(keyword => activityBlob.includes(normalizeTextKey(keyword)));
  }

  _getBatteryLevel(state) {
    const directValue = Number(state?.attributes?.battery_level);
    if (Number.isFinite(directValue)) {
      return clamp(Math.round(directValue), 0, 100);
    }

    const auxiliaryState = this._getAuxiliaryState();
    const auxiliaryBatteryLevel = Number(
      auxiliaryState?.attributes?.battery_level ??
      auxiliaryState?.attributes?.battery ??
      auxiliaryState?.attributes?.battery_remaining,
    );
    if (Number.isFinite(auxiliaryBatteryLevel)) {
      return clamp(Math.round(auxiliaryBatteryLevel), 0, 100);
    }

    const batterySensorState = this._getAuxiliaryBatteryState();
    const batterySensorValue = Number(
      batterySensorState?.state ??
      batterySensorState?.attributes?.battery_level ??
      batterySensorState?.attributes?.battery ??
      batterySensorState?.attributes?.battery_remaining,
    );
    if (Number.isFinite(batterySensorValue)) {
      return clamp(Math.round(batterySensorValue), 0, 100);
    }

    return null;
  }

  _getBatteryColor(level) {
    if (!Number.isFinite(level)) {
      return "var(--secondary-text-color)";
    }

    if (level <= 15) {
      return "var(--error-color, #ff6b6b)";
    }

    if (level <= 35) {
      return "#f59e0b";
    }

    if (level <= 60) {
      return "#f1c24c";
    }

    return "#61c97a";
  }

  _getRoomMappings(state) {
    const mappingSource = this._getRoomMappingSourceState();
    const rawRooms = [
      mappingSource?.attributes?.room_mapping,
      mappingSource?.attributes?.rooms,
      mappingSource?.state,
      state?.attributes?.room_mapping,
      state?.attributes?.rooms,
    ]
      .map(value => this._normalizeRoomCollection(value))
      .find(value => Array.isArray(value) && value.length) || [];

    if (!Array.isArray(rawRooms)) {
      return [];
    }

    const seen = new Set();
    return rawRooms
      .map(room => {
        if (!room || typeof room !== "object") {
          return null;
        }

        const cleaningAreaId = this._normalizeCleaningAreaId(
          room.cleaning_area_id ?? room.cleaningAreaId ?? room.area_id ?? room.areaId,
        );
        const fallbackId = room.id !== undefined && room.id !== null ? String(room.id) : "";
        const uniqueId = cleaningAreaId || fallbackId;
        if (!uniqueId || seen.has(uniqueId)) {
          return null;
        }

        seen.add(uniqueId);
        const rawName = room.name ? String(room.name) : "";
        const normalizedName = this._humanizeRoomLabel(rawName || uniqueId);
        return {
          cleaningAreaId: uniqueId,
          id: fallbackId,
          name: normalizedName,
        };
      })
      .filter(Boolean);
  }

  _normalizeCleaningAreaId(value) {
    const raw = String(value ?? "").trim();
    if (!raw) {
      return "";
    }

    const cleaned = raw
      .replace(/[\[\]\(\)"']/g, " ")
      .replace(/cleaning_area_id[:=]/gi, " ")
      .replace(/,+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) {
      return "";
    }

    return cleaned.split(" ")[0] || cleaned;
  }

  _humanizeRoomLabel(value) {
    const raw = String(value ?? "").trim();
    if (!raw) {
      return "";
    }

    const normalized = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return raw;
    }

    if (/^\d+$/.test(normalized)) {
      return `Area ${normalized}`;
    }

    return normalized
      .split(" ")
      .map(token => (token ? token[0].toUpperCase() + token.slice(1) : token))
      .join(" ");
  }

  _getCleaningAreaIdFromState(state) {
    const reported = this._getReportedStateValue(state);
    const match = String(reported || "").match(/cleaning_area_id:\s*([^\s,]+)/i);
    return match ? this._normalizeCleaningAreaId(match[1]) : "";
  }

  _getCleaningAreaLabel(state, roomMappings) {
    const id = this._getCleaningAreaIdFromState(state);
    if (!id) {
      return "";
    }

    const room = roomMappings.find(item => item.cleaningAreaId === id || item.id === id);
    return room?.name || "";
  }

  _sanitizeSelectedCleaningAreas(roomMappings) {
    const validIds = new Set(roomMappings.map(room => room.cleaningAreaId));
    this._selectedCleaningAreas = this._selectedCleaningAreas.filter(areaId => validIds.has(areaId));
  }

  _toggleCleaningAreaSelection(areaId) {
    if (!areaId) {
      return;
    }

    if (this._selectedCleaningAreas.includes(areaId)) {
      this._selectedCleaningAreas = this._selectedCleaningAreas.filter(value => value !== areaId);
      return;
    }

    this._selectedCleaningAreas = [...this._selectedCleaningAreas, areaId];
  }

  _canSelectRooms(state, roomMappings = this._getRoomMappings(state)) {
    return this._isDocked(state) && roomMappings.length > 0;
  }

  _runAreaCleaning(roomMappings) {
    if (!roomMappings.length) {
      return false;
    }

    const selectedIds = this._selectedCleaningAreas.length
      ? this._selectedCleaningAreas
      : roomMappings.map(room => room.cleaningAreaId);

    if (!selectedIds.length) {
      return false;
    }

    this._callService("clean_area", {
      cleaning_area_id: selectedIds,
    });
    return true;
  }

  _getCurrentFanSpeed(state) {
    const current = state?.attributes?.fan_speed;
    return current ? String(current) : "";
  }

  _getModeVisibilityField(kind) {
    return kind === "mop" ? "hidden_mop_modes" : "hidden_suction_modes";
  }

  _isModeHidden(kind, value) {
    const field = this._getModeVisibilityField(kind);
    const hiddenModes = Array.isArray(this._config?.[field]) ? this._config[field] : [];
    const expectedKey = normalizeTextKey(value);
    return hiddenModes.some(item => normalizeTextKey(item) === expectedKey);
  }

  _getSelectOptions(entityId) {
    const selectState = entityId ? this._hass?.states?.[entityId] : null;
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

  _guessRelatedSelectEntity(kind) {
    if (!this._hass?.states || !this._config?.entity) {
      return "";
    }

    const objectId = String(this._config.entity).split(".")[1] || "";
    if (!objectId) {
      return "";
    }

    const patterns = kind === "mop"
      ? ["mop", "water", "water_level", "water_volume", "scrub"]
      : ["fan_speed", "fan_power", "suction", "cleaning_mode"];

    const candidates = Object.keys(this._hass.states)
      .filter(entityId => entityId.startsWith("select."))
      .filter(entityId => entityId.includes(objectId))
      .filter(entityId => patterns.some(pattern => entityId.includes(pattern)))
      .sort((left, right) => left.localeCompare(right, "es"));

    return candidates[0] || "";
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

  _getFanPresets(state) {
    const configuredPresets = Array.isArray(this._config?.fan_presets) ? this._config.fan_presets : [];
    if (configuredPresets.length) {
      return configuredPresets;
    }

    if (Array.isArray(state?.attributes?.fan_speed_list)) {
      return state.attributes.fan_speed_list
        .map(item => String(item || "").trim())
        .filter(Boolean);
    }

    return [];
  }

  _getModeDescriptor(kind, state) {
    const explicitEntity = kind === "mop"
      ? this._config?.mop_select_entity
      : this._config?.suction_select_entity;
    const selectEntity = explicitEntity || this._guessRelatedSelectEntity(kind);
    const selectDescriptor = this._getSelectOptions(selectEntity);

    if (selectDescriptor.entityId && selectDescriptor.options.length) {
      const visibleOptions = selectDescriptor.options.filter(option => !this._isModeHidden(kind, option));
      if (!visibleOptions.length) {
        return null;
      }

      return {
        current: selectDescriptor.value,
        kind,
        label: kind === "mop" ? "Fregado" : "Aspirado",
        options: visibleOptions,
        service: "select",
        target: selectDescriptor.entityId,
      };
    }

    const rawPresets = this._getFanPresets(state);
    if (!rawPresets.length) {
      return null;
    }

    const options = rawPresets.filter(option => {
      const optionKind = this._categorizeModeOption(option);
      const isSharedSmartMode = this._isSharedSmartMode(option);

      if (kind === "mop") {
        return optionKind === "mop" || isSharedSmartMode;
      }

      return optionKind !== "mop" || isSharedSmartMode;
    }).filter(option => !this._isModeHidden(kind, option));

    if (!options.length) {
      return null;
    }

    return {
      current: this._getCurrentFanSpeed(state),
      kind,
      label: kind === "mop" ? "Fregado" : "Aspirado",
      options,
      service: "fan",
      target: this._config?.entity,
    };
  }

  _getVisibleModeDescriptors(state) {
    const modeControlsEnabled = this._config?.show_mode_controls !== false && this._config?.show_fan_presets !== false;
    if (!modeControlsEnabled) {
      return [];
    }

    return [
      this._getModeDescriptor("suction", state),
      this._getModeDescriptor("mop", state),
    ].filter(Boolean);
  }

  _getActiveModeDescriptor(state, panelKind = this._activeModePanel) {
    return this._getVisibleModeDescriptors(state).find(mode => mode.kind === panelKind) || null;
  }

  _getModePanelMaxHeight(descriptors) {
    const maxOptions = Array.isArray(descriptors)
      ? descriptors.reduce((maxValue, descriptor) => Math.max(maxValue, descriptor?.options?.length || 0), 0)
      : 0;

    return clamp(84 + (maxOptions * 52), 220, 560);
  }

  _getModePanelMarkup(panelKind, state = this._getState()) {
    const descriptor = this._getActiveModeDescriptor(state, panelKind);
    if (!descriptor) {
      return "";
    }

    const activeModeDisplayValue = this._getOptimisticModeValue(
      descriptor.kind,
      descriptor.current,
      descriptor.options,
    );

    return `
      <div class="vacuum-card__presets vacuum-card__mode-panel">
        ${descriptor.options
          .map(option => `
            <button
              class="vacuum-card__preset ${normalizeTextKey(option) === normalizeTextKey(activeModeDisplayValue) ? "vacuum-card__preset--active" : ""}"
              type="button"
              data-vacuum-action="${descriptor.service === "select" ? "select" : "fan"}"
              ${descriptor.service === "select" ? `data-target-entity="${escapeHtml(descriptor.target)}"` : ""}
              data-mode-kind="${escapeHtml(descriptor.kind)}"
              data-value="${escapeHtml(option)}"
            >
              ${escapeHtml(humanizeModeLabel(option, descriptor.kind, this._hass, this._config?.language ?? "auto"))}
            </button>
          `)
          .join("")}
      </div>
    `;
  }

  _getRoomPanelMarkup(state = this._getState()) {
    const roomMappings = this._getRoomMappings(state);
    if (!(this._roomPanelOpen && roomMappings.length)) {
      return "";
    }

    return `
      <div class="vacuum-card__room-panel">
        ${roomMappings
          .map(room => `
            <button
              class="vacuum-card__preset ${this._selectedCleaningAreas.includes(room.cleaningAreaId) ? "vacuum-card__preset--active" : ""}"
              type="button"
              data-vacuum-action="toggle-room"
              data-cleaning-area-id="${escapeHtml(room.cleaningAreaId)}"
            >
              ${escapeHtml(room.name)}
            </button>
          `)
          .join("")}
      </div>
    `;
  }

  _getPanelMarkup(panelKey, state = this._getState()) {
    if (panelKey === "room") {
      return this._getRoomPanelMarkup(state);
    }

    if (panelKey === "suction" || panelKey === "mop") {
      return this._getModePanelMarkup(panelKey, state);
    }

    return "";
  }

  _setPanelToggleButtonsState(panelKey) {
    this.shadowRoot
      ?.querySelectorAll('[data-vacuum-action="toggle-mode-panel"]')
      .forEach(button => {
        if (!(button instanceof HTMLElement)) {
          return;
        }

        const isActive = (button.dataset.modeKind || "") === panelKey;
        button.classList.toggle("vacuum-card__mode-toggle--active", isActive);
        button.classList.toggle("vacuum-card__control--active", isActive);
      });

    this.shadowRoot
      ?.querySelectorAll('[data-vacuum-action="toggle-room-panel"]')
      .forEach(button => {
        if (!(button instanceof HTMLElement)) {
          return;
        }

        const isActive = panelKey === "room";
        button.classList.toggle("vacuum-card__control--active", isActive);
      });
  }

  _setModePanelActiveSelection(modeKind, value) {
    const panelShell = this.shadowRoot?.querySelector(".vacuum-card__panel-shell");
    if (!(panelShell instanceof HTMLElement) || panelShell.dataset.panelKey !== String(modeKind || "")) {
      return;
    }

    panelShell
      .querySelectorAll(".vacuum-card__preset")
      .forEach(button => {
        if (!(button instanceof HTMLElement)) {
          return;
        }

        const isActive = normalizeTextKey(button.dataset.value || "") === normalizeTextKey(value);
        button.classList.toggle("vacuum-card__preset--active", isActive);
      });
  }

  _createMarkupNode(markup) {
    if (!markup || typeof document === "undefined") {
      return null;
    }

    const template = document.createElement("template");
    template.innerHTML = String(markup).trim();
    const node = template.content.firstElementChild;
    return node instanceof HTMLElement ? node : null;
  }

  _setVisiblePanelKey(panelKey, state = this._getState()) {
    const nextPanelKey = panelKey === "room"
      ? (this._canSelectRooms(state) ? "room" : "")
      : this._getActiveModeDescriptor(state, panelKey)?.kind || "";

    this._activeModePanel = nextPanelKey === "suction" || nextPanelKey === "mop" ? nextPanelKey : null;
    this._roomPanelOpen = nextPanelKey === "room";
    const animations = this._getAnimationSettings();
    const panelsHost = this.shadowRoot?.querySelector(".vacuum-card__panels");
    const panelMarkup = nextPanelKey ? this._getPanelMarkup(nextPanelKey, state) : "";

    this._setPanelToggleButtonsState(nextPanelKey);

    if (!panelsHost || !(panelsHost instanceof HTMLElement) || !state) {
      this._render();
      this._notifyLayoutChange();
      return;
    }

    const existingPanel = panelsHost.querySelector(".vacuum-card__panel-shell");
    if (!animations.enabled) {
      if (existingPanel instanceof HTMLElement) {
        existingPanel.remove();
      }

      if (panelMarkup) {
        const panelNode = this._createMarkupNode(`
          <div class="vacuum-card__panel-shell" data-panel-key="${nextPanelKey}">
            <div class="vacuum-card__panel-inner">
              ${panelMarkup}
            </div>
          </div>
        `);

        if (panelNode instanceof HTMLElement) {
          panelsHost.replaceChildren(panelNode);
          this._notifyLayoutChange();
          return;
        }
      }

      panelsHost.replaceChildren();
      this._notifyLayoutChange();
      return;
    }

    const removePanel = (panel, onDone = null) => {
      if (!(panel instanceof HTMLElement)) {
        if (typeof onDone === "function") {
          onDone();
        }
        return;
      }

      panel.classList.remove("vacuum-card__panel-shell--entering");
      panel.classList.add("vacuum-card__panel-shell--leaving");

      const finalizeRemoval = () => {
        if (panel.isConnected) {
          panel.remove();
        }
        this._notifyLayoutChange();
        if (typeof onDone === "function") {
          onDone();
        }
      };

      panel.addEventListener("animationend", finalizeRemoval, { once: true });
      window.setTimeout(finalizeRemoval, animations.panelDuration + 80);
    };

    const appendPanel = () => {
      if (!panelMarkup) {
        panelsHost.replaceChildren();
        this._notifyLayoutChange();
        return;
      }

      const panelNode = this._createMarkupNode(`
        <div class="vacuum-card__panel-shell vacuum-card__panel-shell--entering" data-panel-key="${nextPanelKey}">
          <div class="vacuum-card__panel-inner">
            ${panelMarkup}
          </div>
        </div>
      `);

      if (!(panelNode instanceof HTMLElement)) {
        this._render();
        return;
      }

      panelsHost.replaceChildren(panelNode);
      this._notifyLayoutChange();
      this._scheduleLayoutRefresh(animations.panelDuration + 120);
      window.setTimeout(() => {
        if (panelNode.isConnected) {
          panelNode.classList.remove("vacuum-card__panel-shell--entering");
        }
      }, animations.panelDuration + 80);
    };

    if (!nextPanelKey) {
      if (existingPanel instanceof HTMLElement) {
        removePanel(existingPanel, () => {
          panelsHost.replaceChildren();
        });
      } else {
        panelsHost.replaceChildren();
        this._notifyLayoutChange();
      }
      return;
    }

    if (!panelMarkup) {
      if (existingPanel instanceof HTMLElement) {
        removePanel(existingPanel, () => {
          panelsHost.replaceChildren();
        });
      } else {
        panelsHost.replaceChildren();
        this._notifyLayoutChange();
      }
      return;
    }

    const existingPanelKey = existingPanel instanceof HTMLElement ? existingPanel.dataset.panelKey || "" : "";
    if (existingPanel instanceof HTMLElement && existingPanelKey === nextPanelKey) {
      if (existingPanel.classList.contains("vacuum-card__panel-shell--leaving")) {
        existingPanel.remove();
      } else {
        const panelInner = existingPanel.querySelector(".vacuum-card__panel-inner");
        if (panelInner instanceof HTMLElement) {
          panelInner.innerHTML = panelMarkup;
        }
        return;
      }
    }

    if (existingPanel instanceof HTMLElement) {
      removePanel(existingPanel, appendPanel);
      return;
    }

    appendPanel();
  }

  _isCleaning(state) {
    return this._matchesActivity(state, [
      "cleaning",
      "segment_cleaning",
      "segment_clean",
      "room_cleaning",
      "room_clean",
      "zone_cleaning",
      "zone_clean",
      "clean_area",
      "clean_zone",
      "clean_room",
      "spot_cleaning",
      "vacuuming",
      "limpiando",
    ]);
  }

  _isGoingToWashMops(state) {
    return this._matchesActivity(state, [
      "going_to_wash_the_mop",
      "going_to_wash_mop",
      "go_to_wash_mop",
      "go_wash_mop",
      "returning_to_wash_mop",
      "heading_to_wash_mop",
    ]);
  }

  _isWashingMops(state) {
    return this._matchesActivity(state, [
      "washing",
      "wash_mop",
      "washmop",
      "mop_wash",
      "mopwash",
      "washing_mop",
      "clean_mop",
      "mop_clean",
      "lavando_mopas",
      "lavando_mopa",
      "lavado_mopa",
      "washing_pads",
      "rinse_mop",
      "wash_the_mop",
      "washing_the_mop",
      "mop_rinsing",
      "rinsing_mop",
    ]);
  }

  _isDryingMops(state) {
    return this._matchesActivity(state, [
      "drying",
      "dry_mop",
      "mop_dry",
      "drying_mop",
      "drying_the_mop",
      "air_dry",
      "secando",
      "secado_mopa",
      "secando_mopas",
    ]);
  }

  _isAutoEmptying(state) {
    const keywords = [
      "emptying",
      "self_emptying",
      "selfemptying",
      "auto_empty",
      "autoempty",
      "dust_empty",
      "collecting_dust",
      "dock_empty",
      "autovaciando",
      "auto_vaciado",
      "vaciando",
    ];

    const reportedKey = this._getReportedStateKey(state);
    if (keywords.some(keyword => reportedKey.includes(normalizeTextKey(keyword)))) {
      return true;
    }

    const activeTokens = this._getActiveTaskTokens(state);
    return keywords.some(keyword => activeTokens.includes(normalizeTextKey(keyword)));
  }

  _isPaused(state) {
    return this._matchesActivity(state, [
      "paused",
      "pause",
      "pausado",
    ]);
  }

  _isReturning(state) {
    return this._matchesActivity(state, [
      "returning",
      "return_to_base",
      "returning_home",
      "volviendo",
    ]);
  }

  _isDocked(state) {
    return this._matchesActivity(state, [
      "docked",
      "charging",
      "charging_completed",
      "en_base",
      "base",
    ]);
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

  _shouldTintCard(state) {
    const reportedStateKey = this._getReportedStateKey(state);

    if (this._hasVacuumError()) {
      return true;
    }

    if (!reportedStateKey || ["unknown", "unavailable"].includes(reportedStateKey)) {
      return false;
    }

    if (this._isDocked(state)) {
      return false;
    }

    return true;
  }

  _getAccentColor(state) {
    const styles = getSafeStyles(this._config?.styles);

    if (state?.state === "error" || this._hasVacuumError()) {
      return styles.icon.error_color;
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
      return styles.icon.returning_color;
    }

    if (this._isCleaning(state) || this._isPaused(state)) {
      return styles.icon.active_color;
    }

    return styles.icon.docked_color;
  }

  _callService(service, data = {}) {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    this._hass.callService("vacuum", service, {
      entity_id: this._config.entity,
      ...data,
    });
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

  _clearPendingModeSelection(kind) {
    if (!kind || !(kind in this._pendingModeSelection)) {
      return false;
    }

    if (this._pendingModeSelectionTimers[kind]) {
      window.clearTimeout(this._pendingModeSelectionTimers[kind]);
      this._pendingModeSelectionTimers[kind] = 0;
    }

    if (!this._pendingModeSelection[kind]) {
      return false;
    }

    this._pendingModeSelection[kind] = "";
    return true;
  }

  _setPendingModeSelection(kind, value) {
    if (!kind || !(kind in this._pendingModeSelection)) {
      return;
    }

    this._clearPendingModeSelection(kind);
    this._pendingModeSelection[kind] = String(value || "").trim();

    if (!this._pendingModeSelection[kind]) {
      return;
    }

    this._pendingModeSelectionTimers[kind] = window.setTimeout(() => {
      this._pendingModeSelectionTimers[kind] = 0;
      if (!this._pendingModeSelection[kind]) {
        return;
      }

      this._pendingModeSelection[kind] = "";
      this._render();
    }, 2500);
  }

  _syncPendingModeSelections(state = this._getState()) {
    let didChange = false;

    ["suction", "mop"].forEach(kind => {
      const pendingValue = this._pendingModeSelection[kind];
      if (!pendingValue) {
        return;
      }

      const descriptor = this._getModeDescriptor(kind, state);
      if (!descriptor?.current) {
        return;
      }

      if (normalizeTextKey(descriptor.current) === normalizeTextKey(pendingValue)) {
        didChange = this._clearPendingModeSelection(kind) || didChange;
      }
    });

    return didChange;
  }

  _getOptimisticModeValue(kind, currentValue, options = []) {
    const pendingValue = this._pendingModeSelection?.[kind];
    if (!pendingValue) {
      return currentValue;
    }

    const matchedOption = Array.isArray(options)
      ? options.find(option => normalizeTextKey(option) === normalizeTextKey(pendingValue))
      : "";

    return matchedOption || currentValue;
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
      this._callService("set_fan_speed", {
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

  _runPrimaryAction(state) {
    const roomMappings = this._getRoomMappings(state);
    if (this._roomPanelOpen && this._canSelectRooms(state, roomMappings) && this._runAreaCleaning(roomMappings)) {
      this._roomPanelOpen = false;
      return;
    }

    if (this._shouldUsePausePrimary(state)) {
      this._callService("pause");
      return;
    }

    this._callService("start");
  }

  _shouldUsePausePrimary(state) {
    const reportedStateKey = this._getReportedStateKey(state);

    if (this._hasVacuumError() || !reportedStateKey || ["unknown", "unavailable", "error"].includes(reportedStateKey)) {
      return false;
    }

    if (this._isDocked(state) || this._isPaused(state)) {
      return false;
    }

    return true;
  }

  _getControls(state) {
    const controls = [];
    const usePausePrimary = this._shouldUsePausePrimary(state);
    const roomMappings = this._getRoomMappings(state);

    controls.push({
      action: "primary",
      icon: usePausePrimary ? "mdi:pause" : "mdi:play",
      label: usePausePrimary ? "Pausar" : "Iniciar",
      active: usePausePrimary,
    });

    if (
      this._config?.show_return_to_base !== false &&
      state?.state !== "unavailable" &&
      !this._isDocked(state)
    ) {
      controls.push({
        action: "return_to_base",
        icon: "mdi:home-import-outline",
        label: "Base",
        active: this._isReturning(state),
      });
    }

    if (this._config?.show_stop !== false && (this._isCleaning(state) || this._isPaused(state) || this._isReturning(state))) {
      controls.push({
        action: "stop",
        icon: "mdi:stop",
        label: "Parar",
        active: false,
      });
    }

    if (this._config?.show_locate !== false && state?.state !== "unavailable") {
      controls.push({
        action: "locate",
        icon: "mdi:crosshairs-gps",
        label: "Buscar",
        active: false,
      });
    }

    if (this._canSelectRooms(state, roomMappings)) {
      controls.push({
        action: "toggle-room-panel",
        icon: "mdi:floor-plan",
        label: "Habitaciones",
        active: this._roomPanelOpen,
      });
    }

    return controls.slice(0, 4);
  }

  _renderEmptyState() {
    return `
      <ha-card class="vacuum-card vacuum-card--empty">
        <div class="vacuum-card__empty-title">Nodalia Vacuum Card</div>
        <div class="vacuum-card__empty-text">Configura \`entity\` con una entidad \`vacuum.*\` para mostrar la tarjeta.</div>
      </ha-card>
    `;
  }

  _onShadowClick(event) {
    const button = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.vacuumAction);

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const vacuumAction = button.dataset.vacuumAction;
    if ((vacuumAction === "body_tap" || vacuumAction === "icon_tap") && this._suppressNextVacuumTap) {
      this._suppressNextVacuumTap = false;
      return;
    }

    this._triggerHaptic();
    if (button instanceof HTMLButtonElement) {
      this._triggerButtonBounce(button);
    }

    const state = this._getState();
    this._syncRememberedModeSelections(state);

    switch (vacuumAction) {
      case "body_tap":
        this._runConfiguredCardTapAction(state, "body");
        break;
      case "icon_tap":
        this._runConfiguredCardTapAction(state, "icon");
        break;
      case "primary":
        this._runPrimaryAction(state);
        break;
      case "start":
        this._callService("start");
        break;
      case "pause":
        this._callService("pause");
        break;
      case "stop":
        this._callService("stop");
        break;
      case "return_to_base":
        this._callService("return_to_base");
        break;
      case "locate":
        this._callService("locate");
        break;
      case "toggle-mode-panel": {
        const modeKind = button.dataset.modeKind || "";
        const nextModeKind = this._activeModePanel === modeKind ? "" : modeKind;
        this._setVisiblePanelKey(nextModeKind, state);
        break;
      }
      case "toggle-room-panel":
        this._setVisiblePanelKey(this._roomPanelOpen ? "" : "room", state);
        break;
      case "toggle-room":
        if (button.dataset.cleaningAreaId) {
          this._toggleCleaningAreaSelection(button.dataset.cleaningAreaId);
        }
        this._render();
        break;
      case "fan":
        if (button.dataset.value) {
          this._setPendingModeSelection(button.dataset.modeKind || "suction", button.dataset.value);
          this._rememberNonSmartModeSelection(button.dataset.modeKind || "suction", button.dataset.value);
          this._setModePanelActiveSelection(button.dataset.modeKind || "suction", button.dataset.value);
          this._callService("set_fan_speed", {
            fan_speed: button.dataset.value,
          });
        }
        break;
      case "select":
        if (button.dataset.targetEntity && button.dataset.value) {
          this._setPendingModeSelection(button.dataset.modeKind || "", button.dataset.value);
          this._rememberNonSmartModeSelection(button.dataset.modeKind || "", button.dataset.value);
          this._setModePanelActiveSelection(button.dataset.modeKind || "", button.dataset.value);
          this._applyLinkedSmartModeSelection(button.dataset.modeKind || "", button.dataset.value, state);
        }
        break;
      default:
        break;
    }
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    if (!this._config) {
      this.shadowRoot.innerHTML = "";
      return;
    }

    const config = this._config;
    const styles = config.styles;
    const state = this._getState();

    if (!state) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
          }

          * {
            box-sizing: border-box;
          }

          .vacuum-card--empty {
            background: ${styles.card.background};
            border: ${styles.card.border};
            border-radius: ${styles.card.border_radius};
            box-shadow: ${styles.card.box_shadow};
            display: grid;
            gap: 6px;
            padding: ${styles.card.padding};
          }

          .vacuum-card__empty-title {
            color: var(--primary-text-color);
            font-size: 15px;
            font-weight: 700;
          }

          .vacuum-card__empty-text {
            color: var(--secondary-text-color);
            font-size: 13px;
            line-height: 1.5;
          }
        </style>
        ${this._renderEmptyState()}
      `;
      return;
    }

    const title = this._getVacuumName(state);
    const icon = this._getVacuumIcon(state);
    const stateLabel = this._getStateLabel(state);
    const showUnavailableBadge = isUnavailableState(state);
    const batteryLevel = this._getBatteryLevel(state);
    const availableModeDescriptors = this._getVisibleModeDescriptors(state);
    const isCompactLayout = this._isCompactLayout;
    const accentColor = this._getAccentColor(state);
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const shouldAnimateActiveIcon = animations.enabled && animations.iconAnimation && this._isCleaning(state);
    const controls = this._getControls(state);
    const isTintedState = this._shouldTintCard(state);
    const roomMappings = this._getRoomMappings(state);
    const chips = [];
    const batteryChipColor = this._getBatteryColor(batteryLevel);
    const modePanelMaxHeight = this._getModePanelMaxHeight(availableModeDescriptors);
    const roomPanelMaxHeight = this._getRoomPanelMaxHeight(roomMappings);
    const batteryChipMarkup = config.show_battery_chip !== false && batteryLevel !== null
      ? `
        <span class="vacuum-card__chip vacuum-card__chip--battery">
          <ha-icon icon="mdi:battery"></ha-icon>
          <span>${batteryLevel}%</span>
        </span>
      `
      : "";
    const cardBackground = isTintedState
      ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 52%, ${styles.card.background} 100%)`
      : styles.card.background;
    const cardBorder = isTintedState
      ? `color-mix(in srgb, ${accentColor} 34%, var(--divider-color))`
      : styles.card.border;
    const cardShadow = isTintedState
      ? `${styles.card.box_shadow}, 0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`
      : styles.card.box_shadow;

    if (config.show_state_chip !== false) {
      chips.push(`<span class="vacuum-card__chip vacuum-card__chip--state">${escapeHtml(stateLabel)}</span>`);
    }

    if (this._activeModePanel && !availableModeDescriptors.some(mode => mode.kind === this._activeModePanel)) {
      this._activeModePanel = null;
    }
    if (this._roomPanelOpen && !this._canSelectRooms(state, roomMappings)) {
      this._roomPanelOpen = false;
    }
    this._sanitizeSelectedCleaningAreas(roomMappings);

    const activeModeDescriptor = availableModeDescriptors.find(mode => mode.kind === this._activeModePanel) || null;
    const currentModePanelMarkup = activeModeDescriptor ? this._getModePanelMarkup(activeModeDescriptor.kind, state) : "";
    const currentPanelKey = this._roomPanelOpen && roomMappings.length
      ? "room"
      : activeModeDescriptor?.kind || "";
    const currentPanelMarkup = currentPanelKey
      ? this._getPanelMarkup(currentPanelKey, state)
      : "";
    const panelShellMarkup = currentPanelMarkup
      ? `
        <div class="vacuum-card__panel-shell" data-panel-key="${escapeHtml(currentPanelKey)}">
          <div class="vacuum-card__panel-inner">
            ${currentPanelMarkup}
          </div>
        </div>
      `
      : "";

    const showCopyBlock = !isCompactLayout || chips.length > 0;
    const canRunBodyCardTap =
      this._canRunConfiguredCardTapAction("body") || this._canRunConfiguredCardHoldAction("body");
    const canRunIconCardTap =
      this._canRunConfiguredCardTapAction("icon") || this._canRunConfiguredCardHoldAction("icon");
    const iconTapEffective = this._effectiveVacuumTapAction("icon");
    const iconButtonLabel = iconTapEffective === "navigate"
      ? "Abrir vista del robot"
      : iconTapEffective === "more_info"
        ? "Mostrar mas informacion"
        : this._isCleaning(state)
          ? "Pausar limpieza"
          : "Iniciar limpieza";

    this.shadowRoot.innerHTML = `
        <style>
          :host {
            --vacuum-card-content-duration: ${animations.enabled ? clamp(Math.round(animations.panelDuration * 0.9), 180, 900) : 0}ms;
            display: block;
          }

        * {
          box-sizing: border-box;
        }

        ha-card {
          --vacuum-card-panel-duration: ${animations.enabled ? animations.panelDuration : 0}ms;
          --vacuum-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --vacuum-card-panel-max-height: ${Math.max(modePanelMaxHeight, roomPanelMaxHeight)}px;
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          display: grid;
          gap: ${styles.card.gap};
          min-width: 0;
          overflow: hidden;
          padding: ${styles.card.padding};
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        ha-card::before {
          background: ${isTintedState
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0))"};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .vacuum-card {
          color: var(--primary-text-color);
          display: grid;
          gap: ${styles.card.gap};
          min-width: 0;
          position: relative;
          z-index: 1;
        }

        .vacuum-card--entering {
          animation: vacuum-card-fade-up var(--vacuum-card-content-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .vacuum-card__icon-button,
        .vacuum-card__control,
        .vacuum-card__preset {
          transform: translateZ(0);
          transform-origin: center;
          will-change: transform;
        }

        :is(.vacuum-card__icon-button, .vacuum-card__control, .vacuum-card__preset):active:not(:disabled),
        :is(.vacuum-card__icon-button, .vacuum-card__control, .vacuum-card__preset).is-pressing:not(:disabled) {
          animation: vacuum-card-button-bounce var(--vacuum-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .vacuum-card__header {
          align-items: start;
          display: grid;
          gap: ${styles.card.gap};
          grid-template-columns: auto minmax(0, 1fr) auto;
          min-width: 0;
          padding-right: ${batteryChipMarkup ? "88px" : "0"};
          position: relative;
        }

        .vacuum-card--compact .vacuum-card__header {
          grid-template-columns: auto minmax(0, 1fr) auto;
          text-align: center;
        }

        .vacuum-card--compact .vacuum-card__copy {
          justify-items: ${batteryChipMarkup ? "start" : "center"};
        }

        .vacuum-card--compact .vacuum-card__chips {
          justify-content: center;
        }

        .vacuum-card__icon-button {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${isTintedState
            ? `color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))`
            : "color-mix(in srgb, var(--primary-text-color) 6%, transparent)"};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${isTintedState ? accentColor : styles.icon.color};
          cursor: pointer;
          display: inline-flex;
          height: ${styles.icon.size};
          justify-content: center;
          line-height: 0;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, color 180ms ease, transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
          width: ${styles.icon.size};
        }

        .vacuum-card__icon-button ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.46);
          display: inline-flex;
          height: calc(${styles.icon.size} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          backface-visibility: hidden;
          transform: translate3d(-50%, -50%, 0);
          transform-origin: 50% 70%;
          width: calc(${styles.icon.size} * 0.46);
          will-change: transform;
        }

        .vacuum-card__icon-button--active-motion ha-icon {
          animation: vacuum-card-icon-sweep 1.45s ease-in-out infinite;
          transform-origin: 50% 70%;
        }

        .vacuum-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          color: #ffffff;
          display: inline-flex;
          height: 18px;
          justify-content: center;
          position: absolute;
          right: -2px;
          top: -2px;
          width: 18px;
          z-index: 2;
        }

        .vacuum-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .vacuum-card__copy {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .vacuum-card__header-meta {
          align-items: flex-start;
          display: flex;
          justify-content: flex-end;
          min-width: 0;
          position: absolute;
          right: 0;
          top: 0;
        }

        .vacuum-card__title {
          font-size: ${styles.title_size};
          font-weight: 700;
          letter-spacing: -0.01em;
          line-height: 1.15;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .vacuum-card__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-width: 0;
        }

        .vacuum-card__chip {
          align-items: center;
          backdrop-filter: blur(18px);
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          height: ${styles.chip_height};
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding: ${styles.chip_padding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .vacuum-card__chip--state {
          color: var(--primary-text-color);
        }

        .vacuum-card__chip--battery {
          background: color-mix(in srgb, ${batteryChipColor} 16%, color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border-color: color-mix(in srgb, ${batteryChipColor} 38%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          color: ${batteryChipColor};
          gap: 6px;
        }

        .vacuum-card__chip--battery ha-icon {
          --mdc-icon-size: 13px;
          display: inline-flex;
          height: 13px;
          width: 13px;
        }

        .vacuum-card__controls-group {
          display: grid;
          gap: 0;
          min-width: 0;
        }

        .vacuum-card__controls-inner {
          display: grid;
          gap: 0;
          min-width: 0;
        }

        .vacuum-card__controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }

        .vacuum-card--compact .vacuum-card__controls {
          justify-content: center;
        }

        .vacuum-card__control {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: ${styles.control.size};
          justify-content: center;
          line-height: 0;
          min-width: ${styles.control.size};
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          width: ${styles.control.size};
        }

        .vacuum-card__control--active {
          background: color-mix(in srgb, ${accentColor} 18%, ${styles.control.accent_background});
          border-color: color-mix(in srgb, ${accentColor} 48%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: ${styles.control.accent_color};
        }

        .vacuum-card__control ha-icon {
          --mdc-icon-size: calc(${styles.control.size} * 0.46);
          display: inline-flex;
          height: calc(${styles.control.size} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${styles.control.size} * 0.46);
        }

        .vacuum-card__presets {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          min-width: 0;
        }

        .vacuum-card__room-panel {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          margin-top: 8px;
          min-width: 0;
        }

        .vacuum-card__mode-toggle {
          color: var(--primary-text-color);
        }

        .vacuum-card__mode-toggle--active {
          background: color-mix(in srgb, ${accentColor} 18%, color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border-color: color-mix(in srgb, ${accentColor} 42%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: var(--primary-text-color);
        }

        .vacuum-card__mode-toggle ha-icon {
          --mdc-icon-size: calc(${styles.control.size} * 0.42);
        }

        .vacuum-card__preset {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          height: ${styles.chip_height};
          justify-content: center;
          margin: 0;
          max-width: 100%;
          min-width: 0;
          padding: ${styles.chip_padding};
          white-space: nowrap;
        }

        .vacuum-card__preset--active {
          background: color-mix(in srgb, ${accentColor} 18%, color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border-color: color-mix(in srgb, ${accentColor} 42%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: var(--primary-text-color);
        }

        .vacuum-card__mode-panel {
          margin-top: 8px;
        }

        .vacuum-card__panels {
          display: grid;
          min-width: 0;
        }

        .vacuum-card__panel-shell {
          backface-visibility: hidden;
          min-width: 0;
          overflow: hidden;
          transform-origin: top center;
          will-change: max-height, opacity;
          width: 100%;
        }

        .vacuum-card__panel-inner {
          backface-visibility: hidden;
          display: grid;
          min-width: 0;
          padding: 4px;
          will-change: opacity, transform;
        }

        .vacuum-card__panel-shell--entering {
          animation: vacuum-card-panel-shell-in var(--vacuum-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .vacuum-card__panel-shell--entering .vacuum-card__panel-inner {
          animation: vacuum-card-panel-content-in var(--vacuum-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .vacuum-card__panel-shell--leaving {
          animation: vacuum-card-panel-shell-out var(--vacuum-card-panel-duration) cubic-bezier(0.36, 0, 0.2, 1) both;
          pointer-events: none;
        }

        .vacuum-card__panel-shell--leaving .vacuum-card__panel-inner {
          animation: vacuum-card-panel-content-out var(--vacuum-card-panel-duration) cubic-bezier(0.36, 0, 0.2, 1) both;
        }

        @keyframes vacuum-card-button-bounce {
          0% { transform: scale(1); }
          38% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }

        @keyframes vacuum-card-icon-sweep {
          0%, 100% {
            transform: translate(-50%, -50%) rotate(-7deg) translateX(-2px);
          }
          50% {
            transform: translate(-50%, -50%) rotate(7deg) translateX(2px);
          }
        }

        @keyframes vacuum-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes vacuum-card-panel-shell-in {
          0% {
            max-height: 0;
            opacity: 0;
          }
          100% {
            max-height: var(--vacuum-card-panel-max-height);
            opacity: 1;
          }
        }

        @keyframes vacuum-card-panel-shell-out {
          0% {
            max-height: var(--vacuum-card-panel-max-height);
            opacity: 1;
          }
          100% {
            max-height: 0;
            opacity: 0;
          }
        }

        @keyframes vacuum-card-panel-content-in {
          0% {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes vacuum-card-panel-content-out {
          0% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-6px) scaleY(0.96);
          }
        }

        ${animations.enabled ? "" : `
        ha-card,
        ha-card::before,
        .vacuum-card,
        .vacuum-card * {
          animation: none !important;
          transition: none !important;
        }
        `}

        @media (prefers-reduced-motion: reduce) {
          .vacuum-card__icon-button--active-motion ha-icon {
            animation: none !important;
          }
        }

        .vacuum-card--compact .vacuum-card__presets {
          justify-content: center;
        }

        @media (max-width: 480px) {
          .vacuum-card__controls {
            gap: 8px;
          }

          .vacuum-card__header {
            gap: 10px;
            grid-template-columns: auto minmax(0, 1fr) auto;
            padding-right: ${batteryChipMarkup ? "82px" : "0"};
          }

          .vacuum-card__header-meta {
            justify-content: flex-end;
            right: 0;
            top: 0;
          }

          .vacuum-card__chip--battery {
            font-size: max(10px, calc(${styles.chip_font_size} - 1px));
            gap: 5px;
            height: max(22px, calc(${styles.chip_height} - 2px));
            padding: 0 8px;
          }

          .vacuum-card__chip--battery ha-icon {
            --mdc-icon-size: 12px;
            height: 12px;
            width: 12px;
          }
        }
      </style>

      <ha-card ${canRunBodyCardTap ? 'data-vacuum-action="body_tap"' : ""}>
        <div class="vacuum-card ${isCompactLayout ? "vacuum-card--compact" : ""} ${shouldAnimateEntrance ? "vacuum-card--entering" : ""}">
          <div class="vacuum-card__header">
            <button
              class="vacuum-card__icon-button ${shouldAnimateActiveIcon ? "vacuum-card__icon-button--active-motion" : ""}"
              type="button"
              ${canRunIconCardTap ? 'data-vacuum-action="icon_tap"' : ""}
              aria-label="${escapeHtml(iconButtonLabel)}"
            >
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
              ${showUnavailableBadge ? `<span class="vacuum-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${
              showCopyBlock
                ? `
                  <div class="vacuum-card__copy">
                    <div class="vacuum-card__title">${escapeHtml(title)}</div>
                    ${chips.length ? `<div class="vacuum-card__chips">${chips.join("")}</div>` : ""}
                  </div>
                `
                : ""
            }
            ${batteryChipMarkup ? `<div class="vacuum-card__header-meta">${batteryChipMarkup}</div>` : ""}
          </div>

          ${
            controls.length || availableModeDescriptors.length
              ? `
                <div class="vacuum-card__controls-group">
                  <div class="vacuum-card__controls-inner">
                    <div class="vacuum-card__controls">
                      ${controls
                        .map(control => `
                          <button
                              class="vacuum-card__control ${control.active ? "vacuum-card__control--active" : ""}"
                              type="button"
                              data-vacuum-action="${escapeHtml(control.action)}"
                              aria-label="${escapeHtml(control.label)}"
                            >
                              <ha-icon icon="${escapeHtml(control.icon)}"></ha-icon>
                            </button>
                          `)
                        .join("")}
                      ${availableModeDescriptors
                        .map(mode => `
                          <button
                            class="vacuum-card__control vacuum-card__mode-toggle ${activeModeDescriptor?.kind === mode.kind ? "vacuum-card__mode-toggle--active vacuum-card__control--active" : ""}"
                            type="button"
                            data-vacuum-action="toggle-mode-panel"
                            data-mode-kind="${escapeHtml(mode.kind)}"
                            aria-label="${escapeHtml(mode.label)}"
                          >
                            <ha-icon icon="${mode.kind === "mop" ? "mdi:waves" : "mdi:fan"}"></ha-icon>
                          </button>
                        `)
                        .join("")}
                    </div>
                  </div>
                </div>
              `
              : ""
          }

          <div class="vacuum-card__panels">
            ${panelShellMarkup}
          </div>

        </div>
      </ha-card>
    `;

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(clamp(Math.round(animations.panelDuration * 0.9), 180, 900) + 120);
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaVacuumCard);
}

class NodaliaVacuumCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showStyleSection = false;
    this._showAnimationSection = false;
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
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

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    this._render();
    this._restoreFocusState(focusState);
  }

  _watchEditorControlTag(tagName) {
    if (!tagName || this._pendingEditorControlTags.has(tagName)) {
      return;
    }

    if (typeof customElements?.whenDefined !== "function" || customElements.get(tagName)) {
      return;
    }

    this._pendingEditorControlTags.add(tagName);
    customElements.whenDefined(tagName)
      .then(() => {
        this._pendingEditorControlTags.delete(tagName);

        if (!this._hass || !this.shadowRoot) {
          return;
        }

        const focusState = this._captureFocusState();
        this._render();
        this._restoreFocusState(focusState);
      })
      .catch(() => {
        this._pendingEditorControlTags.delete(tagName);
      });
  }

  _ensureEditorControlsReady() {
    this._watchEditorControlTag("ha-entity-picker");
    this._watchEditorControlTag("ha-selector");
    this._watchEditorControlTag("ha-icon-picker");
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(
      hass,
      this._config?.language,
      id =>
        id.startsWith("vacuum.") || id.startsWith("select.") || id.startsWith("sensor."),
    );
  }

  _buildEntityOptions(filterFn, currentValue = "") {
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId, state]) => filterFn(entityId, state))
      .map(([entityId, state]) => {
        const friendlyName = String(state?.attributes?.friendly_name || "").trim();
        return {
          value: entityId,
          label: friendlyName || entityId,
          displayLabel: friendlyName && friendlyName !== entityId
            ? `${friendlyName} (${entityId})`
            : entityId,
        };
      })
      .sort((left, right) => (
        left.label.localeCompare(right.label, "es", { sensitivity: "base" })
        || left.value.localeCompare(right.value, "es", { sensitivity: "base" })
      ));

    if (currentValue && !options.some(option => option.value === currentValue)) {
      options.unshift({
        value: currentValue,
        label: currentValue,
        displayLabel: currentValue,
      });
    }

    return options;
  }

  _getVacuumEntityOptions() {
    return this._buildEntityOptions(
      entityId => entityId.startsWith("vacuum."),
      String(this._config?.entity || "").trim(),
    );
  }

  _getSelectEntityOptions(field) {
    return this._buildEntityOptions(
      entityId => entityId.startsWith("select."),
      String(this._config?.[field] || "").trim(),
    );
  }

  _getSensorEntityOptions(field) {
    return this._buildEntityOptions(
      entityId => entityId.startsWith("sensor."),
      String(this._config?.[field] || "").trim(),
    );
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
      ? `[data-field="${escapeSelectorValue(dataset.field)}"]`
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

  _emitConfig() {
    const focusState = this._captureFocusState();
    const nextConfig = deepClone(this._config);
    this._config = normalizeConfig(compactConfig(nextConfig));
    this._render();
    this._restoreFocusState(focusState);
    fireEvent(this, "config-changed", {
      config: compactConfig(window.NodaliaUtils.stripEqualToDefaults(nextConfig, DEFAULT_CONFIG) ?? {}),
    });
  }

  _setEditorConfig() {
    this._config = normalizeConfig(compactConfig(this._config));
  }

  _setFieldValue(path, value) {
    if (value === undefined || value === null || value === "") {
      deleteByPath(this._config, path);
      return;
    }

    setByPath(this._config, path, value);
  }

  _readFieldValue(input) {
    const valueType = input.dataset.valueType || "string";

    switch (valueType) {
      case "boolean":
        return Boolean(input.checked);
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      case "csv":
        return arrayFromCsv(input.value);
      default:
        return input.value;
    }
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement);

    if (!input?.dataset?.field) {
      if (input?.dataset?.modeListField && input.dataset.modeValue !== undefined) {
        event.stopPropagation();
        this._setModeVisibility(input.dataset.modeListField, input.dataset.modeValue, input.checked);
        this._setEditorConfig();

        if (event.type === "change") {
          this._emitConfig();
        }
      }
      return;
    }

    event.stopPropagation();

    const nextValue = this._readFieldValue(input);
    this._setFieldValue(input.dataset.field, nextValue);
    this._setEditorConfig();

    if (event.type === "change") {
      this._emitConfig();
    }
  }

  _onShadowValueChanged(event) {
    const control = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.field);

    if (!control?.dataset?.field) {
      return;
    }

    event.stopPropagation();

    const nextValue = typeof event.detail?.value === "string"
      ? event.detail.value
      : control.value;
    if (typeof control.dataset?.value === "string") {
      control.dataset.value = String(nextValue || "");
    }

    this._setFieldValue(control.dataset.field, nextValue);
    this._setEditorConfig();
    this._emitConfig();
  }

  _onShadowClick(event) {
    const toggleButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorToggle);

    if (!toggleButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (toggleButton.dataset.editorToggle === "styles") {
      this._showStyleSection = !this._showStyleSection;
      this._render();
      return;
    }

    if (toggleButton.dataset.editorToggle === "animations") {
      this._showAnimationSection = !this._showAnimationSection;
      this._render();
    }
  }

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    const hass = this._hass ?? this.hass;
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", s);
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(inputType)}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(valueType)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        />
      </label>
    `;
  }

  _renderColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("ed.vacuum.custom_color");
    const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
    const currentValue = value === undefined || value === null || value === ""
      ? fallbackValue
      : String(value);
    const colorModel = getEditorColorModel(currentValue, fallbackValue);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="${escapeHtml(tColorCustom)}">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="color"
              data-alpha="${escapeHtml(String(colorModel.alpha))}"
              value="${escapeHtml(colorModel.hex)}"
              aria-label="${escapeHtml(tLabel)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-field="${escapeHtml(field)}"
          data-value-type="boolean"
          ${checked ? "checked" : ""}
        />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(tLabel)}</span>
      </label>
    `;
  }

  _getVacuumState() {
    return this._config?.entity ? this._hass?.states?.[this._config.entity] || null : null;
  }

  _getEditorSelectOptionsForMode(kind) {
    const explicitEntity = kind === "mop"
      ? this._config?.mop_select_entity
      : this._config?.suction_select_entity;
    const entityId = explicitEntity || this._guessRelatedSelectEntity(kind);
    const state = entityId ? this._hass?.states?.[entityId] || null : null;

    return Array.isArray(state?.attributes?.options)
      ? state.attributes.options.map(item => String(item || "").trim()).filter(Boolean)
      : [];
  }

  _guessRelatedSelectEntity(kind) {
    if (!this._hass?.states || !this._config?.entity) {
      return "";
    }

    const objectId = String(this._config.entity).split(".")[1] || "";
    if (!objectId) {
      return "";
    }

    const patterns = kind === "mop"
      ? ["mop", "water", "water_level", "water_volume", "scrub"]
      : ["fan_speed", "fan_power", "suction", "cleaning_mode"];

    const candidates = Object.keys(this._hass.states)
      .filter(entityId => entityId.startsWith("select."))
      .filter(entityId => entityId.includes(objectId))
      .filter(entityId => patterns.some(pattern => entityId.includes(pattern)))
      .sort((left, right) => left.localeCompare(right, "es"));

    return candidates[0] || "";
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

  _getEditorFanPresets() {
    const configuredPresets = Array.isArray(this._config?.fan_presets) ? this._config.fan_presets : [];
    if (configuredPresets.length) {
      return configuredPresets;
    }

    const vacuumState = this._getVacuumState();
    return Array.isArray(vacuumState?.attributes?.fan_speed_list)
      ? vacuumState.attributes.fan_speed_list.map(item => String(item || "").trim()).filter(Boolean)
      : [];
  }

  _getModeVisibilityOptions(kind) {
    const selectOptions = this._getEditorSelectOptionsForMode(kind);
    if (selectOptions.length) {
      return selectOptions;
    }

    const rawPresets = this._getEditorFanPresets();
    return rawPresets.filter(option => {
      const optionKind = this._categorizeModeOption(option);
      const isSharedSmartMode = this._isSharedSmartMode(option);

      if (kind === "mop") {
        return optionKind === "mop" || isSharedSmartMode;
      }

      return optionKind !== "mop" || isSharedSmartMode;
    });
  }

  _getHiddenModeList(field) {
    return Array.isArray(this._config?.[field])
      ? this._config[field].map(item => String(item || "").trim()).filter(Boolean)
      : [];
  }

  _isModeVisible(field, value) {
    const expectedKey = normalizeTextKey(value);
    return !this._getHiddenModeList(field).some(item => normalizeTextKey(item) === expectedKey);
  }

  _setModeVisibility(field, value, visible) {
    const rawValue = String(value || "").trim();
    if (!rawValue) {
      return;
    }

    const nextValues = this._getHiddenModeList(field).filter(item => normalizeTextKey(item) !== normalizeTextKey(rawValue));
    if (!visible) {
      nextValues.push(rawValue);
    }

    if (nextValues.length) {
      setByPath(this._config, field, nextValues);
      return;
    }

    deleteByPath(this._config, field);
  }

  _renderModeVisibilityField(field, modeValue, kind) {
    const translatedLabel = humanizeModeLabel(modeValue, kind, this._hass ?? this.hass, this._config?.language ?? "auto");
    const showRawValue = normalizeTextKey(translatedLabel) !== normalizeTextKey(modeValue);
    const label = showRawValue ? `${translatedLabel} (${modeValue})` : translatedLabel;

    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-mode-list-field="${escapeHtml(field)}"
          data-mode-value="${escapeHtml(modeValue)}"
          ${this._isModeVisible(field, modeValue) ? "checked" : ""}
        />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(label)}</span>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options, renderOptions = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options
            .map(option => `
              <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
                ${escapeHtml(this._editorLabel(option.label))}
              </option>
            `)
            .join("")}
        </select>
      </label>
    `;
  }

  _renderEntityPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholderAttr = options.placeholder
      ? `data-placeholder="${escapeHtml(options.placeholder)}"`
      : "";
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="${escapeHtml(options.controlType || "entity")}"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          ${placeholderAttr}
        ></div>
      </div>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <ha-icon-picker
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        ></ha-icon-picker>
      </div>
    `;
  }

  _mountEntityPicker(host, pickerOptions) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || pickerOptions.field || "entity";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || pickerOptions.placeholder || "";
    const domains = pickerOptions.includeDomains || [];
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      if (domains.length) {
        control.includeDomains = domains;
        control.entityFilter =
          pickerOptions.entityFilter ||
          (stateObj => domains.some(d => String(stateObj?.entity_id || "").startsWith(`${d}.`)));
      }
      control.allowCustomEntity = true;
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      const entitySelector =
        domains.length === 1
          ? { domain: domains[0] }
          : domains.length > 1
            ? { domain: domains }
            : {};
      control.selector = { entity: entitySelector };
      if (placeholder) {
        control.setAttribute("label", placeholder);
      }
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || this._editorLabel("ed.vacuum.select_entity");
      control.appendChild(emptyOption);
      pickerOptions.getOptions(field).forEach(option => {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.displayLabel;
        control.appendChild(optionElement);
      });
      control.addEventListener("change", this._onShadowInput);
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      control.hass = this._hass;
    }

    if ("value" in control) {
      control.value = nextValue;
    }

    if (control.tagName !== "SELECT") {
      control.addEventListener("value-changed", this._onShadowValueChanged);
    }

    host.replaceChildren(control);
  }

  _mountVacuumEntityPicker(host) {
    this._mountEntityPicker(host, {
      includeDomains: ["vacuum"],
      entityFilter: stateObj => String(stateObj?.entity_id || "").startsWith("vacuum."),
      getOptions: () => this._getVacuumEntityOptions(),
    });
  }

  _mountSelectEntityPicker(host) {
    this._mountEntityPicker(host, {
      includeDomains: ["select"],
      entityFilter: stateObj => String(stateObj?.entity_id || "").startsWith("select."),
      getOptions: field => this._getSelectEntityOptions(field),
    });
  }

  _mountSensorEntityPicker(host) {
    this._mountEntityPicker(host, {
      includeDomains: ["sensor"],
      entityFilter: stateObj => String(stateObj?.entity_id || "").startsWith("sensor."),
      getOptions: field => this._getSensorEntityOptions(field),
    });
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";
    const suctionModeVisibilityOptions = this._getModeVisibilityOptions("suction");
    const mopModeVisibilityOptions = this._getModeVisibilityOptions("mop");
    const phVacName = this._editorLabel("ed.vacuum.name_placeholder");
    const phFanPresets = this._editorLabel("ed.vacuum.fan_presets_placeholder");
    const tapActionVal = config.tap_action || "default";
    const iconTapSelectValue = String(config.icon_tap_action ?? "").trim();
    const showVacuumNavigatePath =
      normalizeTextKey(tapActionVal) === "navigate" ||
      (Boolean(iconTapSelectValue) && normalizeTextKey(iconTapSelectValue) === "navigate");
    const holdActionVal = config.hold_action || "none";
    const iconHoldSelectValue = String(config.icon_hold_action ?? "").trim();
    const holdBodyKey = normalizeTextKey(holdActionVal);
    const holdIconEffectiveRaw = iconHoldSelectValue || holdActionVal;
    const holdIconKey = normalizeTextKey(holdIconEffectiveRaw);
    const showVacuumHoldNavigateFields = holdBodyKey === "navigate" || holdIconKey === "navigate";
    const showVacuumIconHoldNavField = Boolean(iconHoldSelectValue) && holdIconKey === "navigate";

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
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
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

        .editor-section__actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 2px;
        }

        .editor-section__toggle-button {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          gap: 8px;
          min-height: 34px;
          padding: 0 12px;
        }

        .editor-section__toggle-button ha-icon {
          --mdc-icon-size: 16px;
        }

        .editor-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .editor-grid--stacked {
          grid-template-columns: 1fr;
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

        .editor-chip-radius__options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .editor-chip-radius__option {
          align-items: center;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 12px;
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          padding: 8px 12px;
        }

        .editor-chip-radius__option:has(input:checked) {
          background: color-mix(in srgb, var(--primary-color) 10%, transparent);
          border-color: var(--primary-color);
        }

        .editor-chip-radius__option input[type="radio"] {
          accent-color: var(--primary-color);
          appearance: auto;
          margin: 0;
          min-height: auto;
          padding: 0;
          width: auto;
        }


        .editor-field:has(> .editor-control-host[data-mounted-control="entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="entity-picker"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="vacuum-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="select-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="sensor-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="light-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="fan-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="humidifier-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="icon-picker"]),
        .editor-field:has(> ha-icon-picker) {
          grid-column: 1 / -1;
        }

        .editor-field > span,
        .editor-toggle > span {
          font-size: 12px;
          font-weight: 600;
        }

        .editor-field input,
        .editor-field select {
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

        .editor-color-field {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          min-height: 40px;
        }

        .editor-color-picker {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: 40px;
          justify-content: center;
          position: relative;
          width: 40px;
        }

        .editor-color-picker input {
          cursor: pointer;
          inset: 0;
          opacity: 0;
          position: absolute;
        }

        .editor-color-picker:hover,
        .editor-color-picker:focus-within {
          border-color: color-mix(in srgb, var(--primary-text-color) 22%, transparent);
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }

        .editor-color-swatch {
          --editor-swatch: #71c0ff;
          background:
            linear-gradient(var(--editor-swatch), var(--editor-swatch)),
            conic-gradient(from 90deg, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 25%, rgba(0, 0, 0, 0.12) 0 50%, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 0 75%, rgba(0, 0, 0, 0.12) 0);
          background-position: center;
          background-size: cover, 10px 10px;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
          border-radius: 999px;
          display: block;
          height: 22px;
          width: 22px;
        }

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }

        .editor-subsection {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 10px;
          padding: 12px;
        }

        .editor-subsection__title {
          font-size: 12px;
          font-weight: 700;
        }

        .editor-subsection__hint {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
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
      
        :is(.editor-toggle, .editor-checkbox) {
          align-items: center;
          column-gap: 10px;
          cursor: pointer;
          grid-auto-flow: row;
          grid-template-columns: auto minmax(0, 1fr);
          justify-content: stretch;
          min-height: 40px;
          padding-top: 0;
          position: relative;
        }

        :is(.editor-toggle, .editor-checkbox) input {
          block-size: 1px;
          inline-size: 1px;
          margin: 0;
          opacity: 0;
          pointer-events: none;
          position: absolute;
        }

        .editor-toggle__switch {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          display: inline-flex;
          font-size: 0;
          height: 22px;
          line-height: 0;
          position: relative;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
          width: 40px;
        }

        .editor-toggle__switch::before {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
          content: "";
          height: 18px;
          left: 1px;
          position: absolute;
          top: 1px;
          transition: transform 160ms ease;
          width: 18px;
        }

        .editor-toggle__label {
          min-width: 0;
        }

        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }

        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch::before {
          transform: translateX(18px);
        }

        :is(.editor-toggle, .editor-checkbox) input:focus-visible + .editor-toggle__switch {
          box-shadow:
            0 0 0 3px color-mix(in srgb, var(--primary-text-color) 14%, transparent),
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }
</style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.general_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityPickerField("ed.vacuum.robot_entity", "entity", config.entity, {
              controlType: "vacuum-entity",
              fullWidth: true,
              placeholder: "vacuum.robot",
            })}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, {
              placeholder: "mdi:robot-vacuum",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: phVacName,
              fullWidth: true,
            })}
            ${this._renderTextField(
              "ed.vacuum.fan_presets",
              "fan_presets",
              Array.isArray(config.fan_presets) ? config.fan_presets.join(", ") : "",
              {
                valueType: "csv",
                placeholder: phFanPresets,
                fullWidth: true,
              },
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.tap_actions_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderSelectField(
              "ed.light.icon_tap_action",
              "icon_tap_action",
              iconTapSelectValue,
              [
                { value: "", label: "ed.entity.icon_tap_inherit" },
                { value: "default", label: "ed.vacuum.tap_default" },
                { value: "more-info", label: "ed.vacuum.tap_more_info" },
                { value: "navigate", label: "ed.vacuum.tap_navigate" },
                { value: "none", label: "ed.vacuum.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.light.card_tap_action",
              "tap_action",
              config.tap_action || "default",
              [
                { value: "default", label: "ed.vacuum.tap_default" },
                { value: "more-info", label: "ed.vacuum.tap_more_info" },
                { value: "navigate", label: "ed.vacuum.tap_navigate" },
                { value: "none", label: "ed.vacuum.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${
              showVacuumNavigatePath
                ? this._renderTextField("ed.vacuum.navigation_path", "tap_navigation_path", config.tap_navigation_path, {
                    placeholder: "/lovelace/robot",
                    fullWidth: true,
                  })
                : ""
            }
            <div class="editor-section__hint editor-field--full" style="margin-top: 8px;">${escapeHtml(this._editorLabel("ed.vacuum.hold_actions_section_hint"))}</div>
            ${this._renderSelectField(
              "ed.light.icon_hold_action",
              "icon_hold_action",
              iconHoldSelectValue,
              [
                { value: "", label: "ed.entity.icon_hold_inherit" },
                { value: "default", label: "ed.vacuum.tap_default" },
                { value: "more-info", label: "ed.vacuum.tap_more_info" },
                { value: "navigate", label: "ed.vacuum.tap_navigate" },
                { value: "none", label: "ed.vacuum.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.light.card_hold_action",
              "hold_action",
              holdActionVal,
              [
                { value: "default", label: "ed.vacuum.tap_default" },
                { value: "more-info", label: "ed.vacuum.tap_more_info" },
                { value: "navigate", label: "ed.vacuum.tap_navigate" },
                { value: "none", label: "ed.vacuum.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${
              showVacuumHoldNavigateFields
                ? `
                  ${this._renderTextField("ed.vacuum.hold_navigation_path", "hold_navigation_path", config.hold_navigation_path, {
                    placeholder: "/lovelace/robot",
                    fullWidth: true,
                  })}
                  ${
                    showVacuumIconHoldNavField
                      ? this._renderTextField(
                          "ed.vacuum.icon_hold_navigation_path",
                          "icon_hold_navigation_path",
                          config.icon_hold_navigation_path,
                          {
                            placeholder: "/lovelace/robot",
                            fullWidth: true,
                          },
                        )
                      : ""
                  }
                `
                : ""
            }
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.aux_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.aux_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderEntityPickerField("ed.vacuum.state_sensor", "state_entity", config.state_entity, {
              controlType: "sensor-entity",
              placeholder: "sensor.robot_estado",
            })}
            ${this._renderEntityPickerField("ed.vacuum.error_sensor", "error_entity", config.error_entity, {
              controlType: "sensor-entity",
              placeholder: "sensor.robot_error",
            })}
            ${this._renderEntityPickerField("ed.vacuum.battery_sensor", "battery_entity", config.battery_entity, {
              controlType: "sensor-entity",
              placeholder: "sensor.robot_bateria",
            })}
            ${this._renderEntityPickerField("ed.vacuum.room_mapping_sensor", "room_mapping_entity", config.room_mapping_entity, {
              controlType: "sensor-entity",
              placeholder: "sensor.room_mapping",
            })}
            ${this._renderEntityPickerField("ed.vacuum.suction_select", "suction_select_entity", config.suction_select_entity, {
              controlType: "select-entity",
              placeholder: "select.robot_fan_speed",
            })}
            ${this._renderEntityPickerField("ed.vacuum.mop_select", "mop_select_entity", config.mop_select_entity, {
              controlType: "select-entity",
              placeholder: "select.robot_mop_mode",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.vacuum.layout_narrow",
              "compact_layout_mode",
              config.compact_layout_mode || "auto",
              [
                { value: "auto", label: "ed.vacuum.layout_auto" },
                { value: "always", label: "ed.vacuum.layout_always" },
                { value: "never", label: "ed.vacuum.layout_never" },
              ],
            )}
            ${this._renderCheckboxField("ed.vacuum.show_state_chip", "show_state_chip", config.show_state_chip !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_battery_chip", "show_battery_chip", config.show_battery_chip !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_mode_controls", "show_mode_controls", config.show_mode_controls !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_fan_presets", "show_fan_presets", config.show_fan_presets !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_return_base", "show_return_to_base", config.show_return_to_base !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_stop", "show_stop", config.show_stop !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_locate", "show_locate", config.show_locate !== false)}
            ${
              suctionModeVisibilityOptions.length
                ? `
                  <div class="editor-subsection editor-field--full">
                    <div class="editor-subsection__title">${escapeHtml(this._editorLabel("ed.vacuum.suction_modes_title"))}</div>
                    <div class="editor-subsection__hint">${escapeHtml(this._editorLabel("ed.vacuum.suction_modes_hint"))}</div>
                    <div class="editor-grid editor-grid--stacked">
                      ${suctionModeVisibilityOptions.map(mode => this._renderModeVisibilityField("hidden_suction_modes", mode, "suction")).join("")}
                    </div>
                  </div>
                `
                : ""
            }
            ${
              mopModeVisibilityOptions.length
                ? `
                  <div class="editor-subsection editor-field--full">
                    <div class="editor-subsection__title">${escapeHtml(this._editorLabel("ed.vacuum.mop_modes_title"))}</div>
                    <div class="editor-subsection__hint">${escapeHtml(this._editorLabel("ed.vacuum.mop_modes_hint"))}</div>
                    <div class="editor-grid editor-grid--stacked">
                      ${mopModeVisibilityOptions.map(mode => this._renderModeVisibilityField("hidden_mop_modes", mode, "mop")).join("")}
                    </div>
                  </div>
                `
                : ""
            }
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.haptics_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.vacuum.enable_haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("ed.vacuum.fallback_vibrate", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "ed.vacuum.haptic_style",
              "haptics.style",
              hapticStyle,
              [
                { value: "selection", label: "ed.weather.haptic_selection" },
                { value: "light", label: "ed.weather.haptic_light" },
                { value: "medium", label: "ed.weather.haptic_medium" },
                { value: "heavy", label: "ed.weather.haptic_heavy" },
                { value: "success", label: "ed.weather.haptic_success" },
                { value: "warning", label: "ed.weather.haptic_warning" },
                { value: "failure", label: "ed.weather.haptic_failure" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.animations_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("ed.weather.hide_animation_settings") : this._editorLabel("ed.weather.show_animation_settings"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("ed.vacuum.enable_animations", "animations.enabled", config.animations.enabled !== false)}
                  ${this._renderCheckboxField("ed.vacuum.icon_animation_active", "animations.icon_animation", config.animations.icon_animation !== false)}
                  ${this._renderTextField("ed.vacuum.panel_duration_ms", "animations.panel_duration", config.animations.panel_duration, {
                    type: "number",
                  })}
                  ${this._renderTextField("ed.vacuum.button_bounce_ms", "animations.button_bounce_duration", config.animations.button_bounce_duration, {
                    type: "number",
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.styles_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showStyleSection ? this._editorLabel("ed.weather.hide_style_settings") : this._editorLabel("ed.weather.show_style_settings"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("ed.vacuum.style_bg", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("ed.vacuum.style_border", "styles.card.border", config.styles.card.border)}
                  ${window.NodaliaUtils.renderEditorCardBorderRadiusHtml({
                    escapeHtml,
                    field: "styles.card.border_radius",
                    value: config.styles?.card?.border_radius,
                    tHeading: this._editorLabel("ed.entity.style_card_radius_presets"),
                    labels: {
                      pill: this._editorLabel("ed.entity.chip_radius_pill"),
                      soft: this._editorLabel("ed.entity.chip_radius_soft"),
                      round: this._editorLabel("ed.entity.chip_radius_round"),
                      square: this._editorLabel("ed.entity.chip_radius_square"),
                    },
                  })}
                  <div class="editor-section__hint editor-field--full" style="margin-top: -6px;">${escapeHtml(this._editorLabel("ed.entity.style_card_radius_yaml_hint"))}</div>
                  ${this._renderTextField("ed.vacuum.style_shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("ed.vacuum.style_padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("ed.vacuum.style_gap", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderTextField("ed.vacuum.style_main_bubble_size", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderColorField("ed.vacuum.style_main_bubble_bg", "styles.icon.background", config.styles.icon.background, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_base", "styles.icon.color", config.styles.icon.color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_cleaning", "styles.icon.active_color", config.styles.icon.active_color, {
                    fallbackValue: "#61c97a",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_washing", "styles.icon.washing_color", config.styles.icon.washing_color, {
                    fallbackValue: "#5aa7ff",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_drying", "styles.icon.drying_color", config.styles.icon.drying_color, {
                    fallbackValue: "#f1c24c",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_emptying", "styles.icon.emptying_color", config.styles.icon.emptying_color, {
                    fallbackValue: "#9b6b4a",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_returning", "styles.icon.returning_color", config.styles.icon.returning_color, {
                    fallbackValue: "#f6b73c",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_docked", "styles.icon.docked_color", config.styles.icon.docked_color, {
                    fallbackValue: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_error", "styles.icon.error_color", config.styles.icon.error_color, {
                    fallbackValue: "var(--error-color, #ff6b6b)",
                  })}
                  ${this._renderTextField("ed.vacuum.style_button_size", "styles.control.size", config.styles.control.size)}
                  ${this._renderColorField("ed.vacuum.style_accent_bg", "styles.control.accent_background", config.styles.control.accent_background, {
                    fallbackValue: "rgba(var(--rgb-primary-color), 0.18)",
                  })}
                  ${this._renderColorField("ed.vacuum.style_accent_color", "styles.control.accent_color", config.styles.control.accent_color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderTextField("ed.vacuum.style_chip_height", "styles.chip_height", config.styles.chip_height)}
                  ${this._renderTextField("ed.vacuum.style_chip_font", "styles.chip_font_size", config.styles.chip_font_size)}
                  ${this._renderTextField("ed.vacuum.style_chip_padding", "styles.chip_padding", config.styles.chip_padding)}
                  ${window.NodaliaUtils.renderEditorChipBorderRadiusHtml({
                    escapeHtml,
                    field: "styles.chip_border_radius",
                    value: config.styles?.chip_border_radius,
                    tHeading: this._editorLabel("ed.entity.style_chip_radius"),
                    labels: {
                      pill: this._editorLabel("ed.entity.chip_radius_pill"),
                      soft: this._editorLabel("ed.entity.chip_radius_soft"),
                      round: this._editorLabel("ed.entity.chip_radius_round"),
                      square: this._editorLabel("ed.entity.chip_radius_square"),
                    },
                  })}
                  ${this._renderTextField("ed.vacuum.style_title_size", "styles.title_size", config.styles.title_size)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="vacuum-entity"]')
      .forEach(host => this._mountVacuumEntityPicker(host));

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="select-entity"]')
      .forEach(host => this._mountSelectEntityPicker(host));

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="sensor-entity"]')
      .forEach(host => this._mountSensorEntityPicker(host));

    this.shadowRoot
      .querySelectorAll("ha-icon-picker[data-field]")
      .forEach(control => {
        control.hass = this._hass;
        control.value = control.dataset.value || "";
        control.addEventListener("value-changed", this._onShadowValueChanged);
      });

    this._ensureEditorControlsReady();
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaVacuumCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Vacuum Card",
  description: "Tarjeta de aspirador con look Nodalia, acciones rápidas y editor visual.",
  preview: true,
});
