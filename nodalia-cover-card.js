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

const CARD_TAG = "nodalia-cover-card";
const EDITOR_TAG = "nodalia-cover-card-editor";
const CARD_VERSION = "1.1.0-alpha.7";

const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};

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
  show_state: false,
  show_position_chip: true,
  show_tilt_chip: true,
  show_position_slider: true,
  show_tilt_slider: true,
  show_stop: true,
  compact_layout_mode: "auto",
  tap_action: "toggle",
  tap_service: "",
  tap_service_data: "",
  tap_url: "",
  tap_new_tab: false,
  icon_tap_action: "",
  icon_tap_service: "",
  icon_tap_service_data: "",
  icon_tap_url: "",
  icon_tap_new_tab: false,
  hold_action: "none",
  hold_service: "",
  hold_service_data: "",
  hold_url: "",
  hold_new_tab: false,
  icon_hold_action: "",
  icon_hold_service: "",
  icon_hold_service_data: "",
  icon_hold_url: "",
  icon_hold_new_tab: false,
  security: {
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: [],
  },
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    icon_animation: true,
    power_duration: 600,
    controls_duration: 600,
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
      size: "38px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      on_color: "var(--info-color, #71c0ff)",
      off_color: "var(--primary-text-color)",
    },
    control: {
      size: "36px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(113, 192, 255, 0.2)",
    },
    chip_height: "24px",
    chip_font_size: "9px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    title_size: "12px",
    slider_wrap_height: "44px",
    slider_height: "22px",
    slider_thumb_size: "22px",
    slider_color: "var(--info-color, #71c0ff)",
  },
};

const STUB_CONFIG = {
  entity: "cover.salon",
  name: "Salon",
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
    } else if (Array.isArray(overrideValue)) {
      result[key] = deepClone(overrideValue);
    } else if (isObject(baseValue) && isObject(overrideValue)) {
      result[key] = mergeConfig(baseValue, overrideValue);
    } else {
      result[key] = overrideValue;
    }
  });
  return result;
}

function compactConfig(value) {
  if (Array.isArray(value)) {
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
  }
  if (isObject(value)) {
    const result = {};
    Object.entries(value).forEach(([key, item]) => {
      const compact = compactConfig(item);
      if (compact !== undefined && !(isObject(compact) && Object.keys(compact).length === 0)) {
        result[key] = compact;
      }
    });
    return result;
  }
  if (value !== "" && value !== null && value !== undefined) {
    return value;
  }
  return undefined;
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  return String(value || "").split(",").map(item => item.trim()).filter(Boolean);
}

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  config.compact_layout_mode = ["auto", "always", "never"].includes(config.compact_layout_mode)
    ? config.compact_layout_mode
    : "auto";
  config.security.allowed_services = normalizeList(config.security?.allowed_services);
  config.security.allowed_service_domains = normalizeList(config.security?.allowed_service_domains);
  return config;
}

function setByPath(obj, path, value) {
  const parts = String(path || "").split(".");
  let target = obj;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (!isObject(target[part]) && !Array.isArray(target[part])) {
      target[part] = {};
    }
    target = target[part];
  }
  target[parts[parts.length - 1]] = value;
}

function deleteByPath(obj, path) {
  const parts = String(path || "").split(".");
  let target = obj;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (!isObject(target[part]) && !Array.isArray(target[part])) {
      return;
    }
    target = target[part];
  }
  delete target[parts[parts.length - 1]];
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
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(String(value))
    : String(value).replaceAll('"', '\\"');
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

function normalizeTextKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(String(value).replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function fireEvent(node, type, detail, options = {}) {
  const event = new CustomEvent(type, {
    bubbles: options.bubbles ?? true,
    cancelable: Boolean(options.cancelable),
    composed: options.composed ?? true,
    detail,
  });
  node.dispatchEvent(event);
  return event;
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

function isUnavailableState(state) {
  const key = normalizeTextKey(state?.state);
  return key === "unavailable" || key === "unknown";
}

function parseServiceData(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return isObject(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function shouldOpenNewTab(value) {
  return value === true;
}

function getEditorColorFallbackValue(field) {
  const normalized = String(field || "");
  if (normalized.endsWith("icon.on_color") || normalized.endsWith("slider_color")) {
    return DEFAULT_CONFIG.styles.icon.on_color;
  }
  if (normalized.endsWith("icon.off_color") || normalized.endsWith("control.accent_color") || normalized.endsWith("icon.color")) {
    return DEFAULT_CONFIG.styles.icon.off_color;
  }
  if (normalized.endsWith("control.accent_background")) {
    return DEFAULT_CONFIG.styles.control.accent_background;
  }
  if (normalized.endsWith("background")) {
    return DEFAULT_CONFIG.styles.card.background;
  }
  return DEFAULT_CONFIG.styles.icon.on_color;
}

function coverDeviceIcon(state) {
  const deviceClass = normalizeTextKey(state?.attributes?.device_class || "");
  const isOpen = ["open", "opening"].includes(normalizeTextKey(state?.state || ""));
  switch (deviceClass) {
    case "awning": return isOpen ? "mdi:awning" : "mdi:awning-outline";
    case "blind":
    case "shade": return isOpen ? "mdi:blinds-open" : "mdi:blinds";
    case "curtain": return isOpen ? "mdi:curtains" : "mdi:curtains-closed";
    case "door": return isOpen ? "mdi:door-open" : "mdi:door-closed";
    case "garage": return isOpen ? "mdi:garage-open-variant" : "mdi:garage-variant";
    case "gate": return isOpen ? "mdi:gate-open" : "mdi:gate";
    case "shutter": return isOpen ? "mdi:window-shutter-open" : "mdi:window-shutter";
    case "window": return isOpen ? "mdi:window-open-variant" : "mdi:window-closed-variant";
    default: return isOpen ? "mdi:window-open" : "mdi:window-closed";
  }
}

class NodaliaCoverCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["cover"]);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._lastRenderedIsActive = null;
    this._controlsTransition = null;
    this._powerTransition = null;
    this._animationCleanupTimer = 0;
    this._activeSliderDrag = null;
    this._skipNextSliderChange = null;
    this._suppressNextCoverTap = false;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowChange = this._onShadowChange.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowChange);
    this.shadowRoot.addEventListener("pointerdown", this._onPointerDown);
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const path = event.composedPath();
              if (path.some(node => node instanceof HTMLInputElement && node.dataset?.coverControl)) {
                return null;
              }
              const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.coverAction);
              const zone = actionButton?.dataset?.coverAction;
              return zone === "body" || zone === "icon" ? zone : null;
            },
            shouldBeginHold: zone => this._resolveHoldAction(zone) !== "none",
            onHold: zone => {
              const action = this._resolveHoldAction(zone);
              if (action === "none") {
                return;
              }
              this._triggerHaptic();
              this._runAction(zone, "hold", action);
            },
            markHoldConsumedClick: () => {
              this._suppressNextCoverTap = true;
            },
          })
        : () => {};
  }

  connectedCallback() {
    this._render();
  }

  disconnectedCallback() {
    this._detachHostHold?.();
    if (this._animationCleanupTimer) {
      window.clearTimeout(this._animationCleanupTimer);
      this._animationCleanupTimer = 0;
    }
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
    return { rows: "auto", columns: "full", min_rows: 2, min_columns: 3 };
  }

  _getState(hass = this._hass) {
    return hass?.states?.[this._config?.entity] || null;
  }

  _getRenderSignature(hass = this._hass) {
    const state = this._getState(hass);
    const attrs = state?.attributes || {};
    return JSON.stringify({
      config: this._config,
      state: state?.state || "",
      attrs: {
        friendly_name: attrs.friendly_name || "",
        icon: attrs.icon || "",
        device_class: attrs.device_class || "",
        current_position: attrs.current_position ?? "",
        current_tilt_position: attrs.current_tilt_position ?? "",
        supported_features: attrs.supported_features ?? "",
      },
    });
  }

  _features(state = this._getState()) {
    return Number(state?.attributes?.supported_features) || 0;
  }

  _supports(feature, state = this._getState()) {
    return Boolean(this._features(state) & feature);
  }

  _isActive(state = this._getState()) {
    const key = normalizeTextKey(state?.state);
    return ["open", "opening", "closing"].includes(key);
  }

  _stateLabel(state = this._getState()) {
    const key = normalizeTextKey(state?.state);
    return {
      open: "Open",
      closed: "Closed",
      opening: "Opening",
      closing: "Closing",
      stopped: "Stopped",
      unavailable: "Unavailable",
      unknown: "Unknown",
    }[key] || String(state?.state || "Unknown");
  }

  _getName(state = this._getState()) {
    return this._config?.name || state?.attributes?.friendly_name || this._config?.entity || "Cover";
  }

  _getIcon(state = this._getState()) {
    return this._config?.icon || state?.attributes?.icon || coverDeviceIcon(state);
  }

  _getAccentColor(state = this._getState()) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    return this._isActive(state)
      ? styles.icon.on_color || DEFAULT_CONFIG.styles.icon.on_color
      : styles.icon.off_color || DEFAULT_CONFIG.styles.icon.off_color;
  }

  _getAnimationSettings() {
    const animations = this._config?.animations || DEFAULT_CONFIG.animations;
    return {
      enabled: animations.enabled !== false,
      iconAnimation: animations.icon_animation !== false,
      powerDuration: clamp(Number(animations.power_duration) || DEFAULT_CONFIG.animations.power_duration, 120, 4000),
      controlsDuration: clamp(Number(animations.controls_duration) || DEFAULT_CONFIG.animations.controls_duration, 120, 2400),
      buttonBounceDuration: clamp(Number(animations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration, 120, 1200),
    };
  }

  _isCompactLayout() {
    const mode = this._config?.compact_layout_mode || "auto";
    if (mode === "always") return true;
    if (mode === "never") return false;
    return false;
  }

  _triggerHaptic(styleOverride = null) {
    const haptics = this._config?.haptics || {};
    if (haptics.enabled !== true) return;
    const style = styleOverride || haptics.style || "medium";
    fireEvent(this, "haptic", style);
    if (haptics.fallback_vibrate === true && typeof navigator?.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection);
    }
  }

  _triggerButtonBounce(element) {
    if (!(element instanceof HTMLElement)) return;
    const animations = this._getAnimationSettings();
    if (!animations.enabled) return;
    element.classList.remove("is-pressing");
    element.getBoundingClientRect();
    element.classList.add("is-pressing");
    window.setTimeout(() => element.classList.remove("is-pressing"), animations.buttonBounceDuration + 40);
  }

  _isServiceAllowed(service) {
    const security = this._config?.security || {};
    if (security.strict_service_actions !== true) return true;
    const value = String(service || "").trim().toLowerCase();
    if (!value || !value.includes(".")) return false;
    const [domain] = value.split(".");
    const allowedServices = Array.isArray(security.allowed_services) ? security.allowed_services : [];
    const allowedDomains = Array.isArray(security.allowed_service_domains) ? security.allowed_service_domains : [];
    return allowedServices.includes(value) || allowedDomains.includes(domain);
  }

  _callNamedService(service, data = {}) {
    if (!this._hass || typeof this._hass.callService !== "function") return;
    if (!this._isServiceAllowed(service)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Cover Card", service);
      return;
    }
    const [domain, serviceName] = String(service || "").split(".");
    if (!domain || !serviceName) return;
    this._hass.callService(domain, serviceName, data);
  }

  _callCover(service, data = {}) {
    if (!this._hass || !this._config?.entity) return;
    this._hass.callService("cover", service, { entity_id: this._config.entity, ...data });
  }

  _openMoreInfo(entityId = this._config?.entity) {
    if (entityId) fireEvent(this, "hass-more-info", { entityId });
  }

  _navigate(url, newTab = false) {
    const safeUrl = window.NodaliaUtils?.sanitizeActionUrl?.(url, { allowRelative: true }) || "";
    if (!safeUrl) return;
    if (newTab) {
      window.open(safeUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (/^(?:https?:)?\/\//i.test(safeUrl)) {
      window.open(safeUrl, "_self", "noopener,noreferrer");
      return;
    }
    window.history.pushState(null, "", safeUrl);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  _toggleCover(state = this._getState()) {
    const key = normalizeTextKey(state?.state);
    if (["open", "opening"].includes(key)) {
      this._callCover("close_cover");
      return;
    }
    this._callCover("open_cover");
  }

  _resolveTapAction(zone) {
    const bodyRaw = this._config?.tap_action ?? "toggle";
    const iconRaw = this._config?.icon_tap_action;
    const raw = zone === "icon" && String(iconRaw ?? "").trim() ? iconRaw : bodyRaw;
    let action = String(raw || "toggle").trim().toLowerCase();
    const allowed = new Set(["auto", "toggle", "more-info", "service", "url", "none"]);
    if (!allowed.has(action)) {
      action = "toggle";
    }
    if (action === "auto") {
      return "toggle";
    }
    return action;
  }

  _resolveHoldAction(zone) {
    const bodyRaw = this._config?.hold_action ?? "none";
    const iconRaw = this._config?.icon_hold_action;
    const raw = zone === "icon" && String(iconRaw ?? "").trim() ? iconRaw : bodyRaw;
    let action = String(raw || "none").trim().toLowerCase();
    const allowed = new Set(["auto", "toggle", "more-info", "service", "url", "none"]);
    if (!allowed.has(action)) {
      action = "none";
    }
    if (action === "auto") {
      return "more-info";
    }
    return action;
  }

  _runAction(zone, interaction = "tap", resolvedAction = null) {
    const isIcon = zone === "icon";
    const isHold = interaction === "hold";
    const action = resolvedAction || (isHold ? this._resolveHoldAction(zone) : this._resolveTapAction(zone));
    if (action === "none") return;
    if (action === "more_info" || action === "more-info") {
      this._openMoreInfo();
      return;
    }
    if (action === "url") {
      let url = isHold
        ? (isIcon ? this._config?.icon_hold_url : this._config?.hold_url)
        : (isIcon ? this._config?.icon_tap_url : this._config?.tap_url);
      let newTab = isHold
        ? (isIcon ? this._config?.icon_hold_new_tab === true : this._config?.hold_new_tab === true)
        : (isIcon ? this._config?.icon_tap_new_tab === true : this._config?.tap_new_tab === true);
      if (isHold && isIcon && !String(url || "").trim()) {
        url = this._config?.hold_url;
        newTab = this._config?.hold_new_tab === true;
      }
      this._navigate(url, newTab);
      return;
    }
    if (action === "service") {
      let service = isHold
        ? (isIcon ? this._config?.icon_hold_service : this._config?.hold_service)
        : (isIcon ? this._config?.icon_tap_service : this._config?.tap_service);
      let dataRaw = isHold
        ? (isIcon ? this._config?.icon_hold_service_data : this._config?.hold_service_data)
        : (isIcon ? this._config?.icon_tap_service_data : this._config?.tap_service_data);
      if (isHold && isIcon && !String(service || "").trim()) {
        service = this._config?.hold_service;
        dataRaw = this._config?.hold_service_data;
      }
      const data = parseServiceData(dataRaw);
      this._callNamedService(service, data);
      return;
    }
    this._toggleCover();
  }

  _onShadowClick(event) {
    const path = event.composedPath();
    const slider = path.find(node => node instanceof HTMLInputElement && node.dataset?.coverControl);
    if (slider) return;
    const button = path.find(node => node instanceof HTMLElement && node.dataset?.coverAction);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();
    this._triggerButtonBounce(button);
    switch (button.dataset.coverAction) {
      case "body":
      case "icon":
        if (this._suppressNextCoverTap) {
          this._suppressNextCoverTap = false;
          break;
        }
        this._runAction(button.dataset.coverAction);
        break;
      case "open":
        this._callCover("open_cover");
        break;
      case "close":
        this._callCover("close_cover");
        break;
      case "stop":
        this._callCover("stop_cover");
        break;
      default:
        break;
    }
  }

  _onPointerDown(event) {
    const slider = event.composedPath().find(node => node instanceof HTMLInputElement && node.dataset?.coverControl);
    if (slider) this._activeSliderDrag = { slider };
  }

  _onShadowInput(event) {
    const slider = event.composedPath().find(node => node instanceof HTMLInputElement && node.dataset?.coverControl);
    if (!slider) return;
    event.stopPropagation();
    this._applySliderValue(slider, slider.value, { commit: false });
  }

  _onShadowChange(event) {
    const slider = event.composedPath().find(node => node instanceof HTMLInputElement && node.dataset?.coverControl);
    if (!slider) return;
    event.stopPropagation();
    if (this._skipNextSliderChange === slider) {
      this._skipNextSliderChange = null;
      return;
    }
    this._applySliderValue(slider, slider.value, { commit: true });
    this._activeSliderDrag = null;
  }

  _applySliderValue(slider, rawValue, options = {}) {
    const nextValue = clamp(Math.round(Number(rawValue)), 0, 100);
    if (!Number.isFinite(nextValue)) return;
    slider.style.setProperty("--percentage", String(nextValue));
    slider.closest(".fan-card__slider-shell")?.style.setProperty("--percentage", String(nextValue));
    if (options.commit !== true) return;
    this._triggerHaptic("selection");
    if (slider.dataset.coverControl === "position") {
      this._callCover("set_cover_position", { position: nextValue });
    } else if (slider.dataset.coverControl === "tilt") {
      this._callCover("set_cover_tilt_position", { tilt_position: nextValue });
    }
  }

  _renderSlider(kind, label, value) {
    const styles = this._config.styles;
    const percentage = clamp(Math.round(Number(value) || 0), 0, 100);
    return `
      <div class="fan-card__slider-row fan-card__slider-row--solo">
        <div class="fan-card__slider-wrap">
          <div class="fan-card__slider-shell" style="--percentage:${percentage};">
            <div class="fan-card__slider-track"></div>
            <input
              type="range"
              class="fan-card__slider"
              data-cover-control="${escapeHtml(kind)}"
              min="0"
              max="100"
              step="1"
              value="${percentage}"
              style="--percentage:${percentage};"
              aria-label="${escapeHtml(label)}"
            />
          </div>
        </div>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) return;
    const config = this._config || normalizeConfig({});
    const state = this._getState();
    const styles = config.styles;
    if (!state) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; }
          * { box-sizing: border-box; }
          .fan-card--empty {
            background: ${styles.card.background};
            border: ${styles.card.border};
            border-radius: ${styles.card.border_radius};
            box-shadow: ${styles.card.box_shadow};
            display: grid;
            gap: 6px;
            padding: ${styles.card.padding};
          }
          .fan-card__empty-title { color: var(--primary-text-color); font-size: 15px; font-weight: 700; }
          .fan-card__empty-text { color: var(--secondary-text-color); font-size: 13px; line-height: 1.5; }
        </style>
        <ha-card class="fan-card fan-card--empty">
          <div class="fan-card__empty-title">Nodalia Cover Card</div>
          <div class="fan-card__empty-text">Configura \`entity\` con una entidad \`cover.*\` para mostrar la tarjeta.</div>
        </ha-card>
      `;
      return;
    }

    const isActive = this._isActive(state);
    const isMoving = ["opening", "closing"].includes(normalizeTextKey(state.state));
    const title = this._getName(state);
    const icon = this._getIcon(state);
    const accentColor = this._getAccentColor(state);
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const animations = this._getAnimationSettings();
    const position = parseNumber(state.attributes?.current_position);
    const tilt = parseNumber(state.attributes?.current_tilt_position);
    const supportsPosition = config.show_position_slider !== false && this._supports(COVER_FEATURES.SET_POSITION, state) && position !== null;
    const supportsTilt = config.show_tilt_slider !== false && this._supports(COVER_FEATURES.SET_TILT_POSITION, state) && tilt !== null;
    const supportsStop = config.show_stop !== false && this._supports(COVER_FEATURES.STOP, state);
    const showCopyBlock = !this._isCompactLayout() || config.show_state === true || config.show_position_chip !== false || config.show_tilt_chip !== false;
    const chips = [];
    if (config.show_state === true) chips.push(`<span class="fan-card__chip fan-card__chip--state">${escapeHtml(this._stateLabel(state))}</span>`);
    if (config.show_position_chip !== false && position !== null) chips.push(`<span class="fan-card__chip">${Math.round(position)}%</span>`);
    if (config.show_tilt_chip !== false && tilt !== null) chips.push(`<span class="fan-card__chip">Tilt ${Math.round(tilt)}%</span>`);
    const controlsMarkup = `
      <div class="fan-card__controls">
        <button type="button" class="fan-card__control" data-cover-action="open" aria-label="Open"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
        ${supportsStop ? `<button type="button" class="fan-card__control" data-cover-action="stop" aria-label="Stop"><ha-icon icon="mdi:stop"></ha-icon></button>` : ""}
        <button type="button" class="fan-card__control" data-cover-action="close" aria-label="Close"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
      </div>
      ${supportsPosition ? this._renderSlider("position", "Position", position) : ""}
      ${supportsTilt ? this._renderSlider("tilt", "Tilt", tilt) : ""}
    `;
    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 54%, ${styles.card.background} 100%)`;
    const onCardBorder = `color-mix(in srgb, ${accentColor} 34%, var(--divider-color))`;
    const onCardShadow = `0 16px 32px color-mix(in srgb, ${accentColor} 14%, rgba(0, 0, 0, 0.18))`;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        * { box-sizing: border-box; }
        ha-card.fan-card {
          --fan-card-controls-gap: calc(${styles.card.gap} + 4px);
          --fan-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          background: ${isActive ? onCardBackground : styles.card.background};
          border: ${isActive ? `1px solid ${onCardBorder}` : styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${isActive ? `${styles.card.box_shadow}, ${onCardShadow}` : styles.card.box_shadow};
          color: var(--primary-text-color);
          min-width: 0;
          overflow: hidden;
          padding: ${styles.card.padding};
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        ha-card::before {
          background: ${isActive
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 18%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0))"};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }
        .fan-card { display: grid; min-width: 0; position: relative; z-index: 1; }
        .fan-card__content { display: grid; gap: 0; }
        .fan-card__hero {
          align-items: center;
          display: grid;
          gap: ${styles.card.gap};
          grid-template-columns: auto minmax(0, 1fr);
          min-width: 0;
        }
        .fan-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${isActive ? `color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))` : "color-mix(in srgb, var(--primary-text-color) 6%, transparent)"};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${isActive ? styles.icon.on_color : styles.icon.off_color};
          cursor: pointer;
          display: inline-flex;
          height: ${styles.icon.size};
          justify-content: center;
          line-height: 0;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          width: ${styles.icon.size};
        }
        .fan-card__icon ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.46);
          color: ${isActive ? styles.icon.on_color : styles.icon.off_color};
        }
        .fan-card__icon--active-motion ha-icon { animation: cover-card-icon-breathe 1.15s ease-in-out infinite; }
        .fan-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          color: #fff;
          display: inline-flex;
          height: 18px;
          justify-content: center;
          position: absolute;
          right: -2px;
          top: -2px;
          width: 18px;
        }
        .fan-card__unavailable-badge ha-icon { --mdc-icon-size: 11px; }
        .fan-card__copy { display: grid; gap: 10px; min-width: 0; }
        .fan-card__headline {
          align-items: start;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }
        .fan-card__title {
          font-size: ${styles.title_size};
          font-weight: 700;
          line-height: 1.15;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fan-card__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          min-width: 0;
        }
        .fan-card__chip {
          align-items: center;
          backdrop-filter: blur(18px);
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: ${chipBorderRadius};
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          height: ${styles.chip_height};
          overflow: hidden;
          padding: ${styles.chip_padding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fan-card__chip--state { color: var(--primary-text-color); }
        .fan-card__controls-shell {
          margin-top: var(--fan-card-controls-gap);
          overflow: visible;
        }
        .fan-card__controls-inner { display: grid; gap: 10px; }
        .fan-card__controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          padding-inline: 4px;
        }
        .fan-card__control,
        .fan-card__preset {
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
          font: inherit;
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          height: ${styles.control.size};
          justify-content: center;
          line-height: 0;
          margin: 0;
          min-width: ${styles.control.size};
          outline: none;
          padding: 0 14px;
          transform-origin: center;
          white-space: nowrap;
        }
        .fan-card__control { padding: 0; width: ${styles.control.size}; }
        .fan-card__control ha-icon { --mdc-icon-size: calc(${styles.control.size} * 0.46); }
        .fan-card__preset.is-active {
          background: ${styles.control.accent_background};
          border-color: color-mix(in srgb, ${accentColor} 48%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: ${styles.control.accent_color};
        }
        .fan-card__slider-row {
          align-items: center;
          display: grid;
          gap: 14px;
          grid-template-columns: minmax(0, 1fr);
          padding-inline: 4px;
        }
        .fan-card__slider-wrap {
          --fan-card-slider-input-height: max(44px, calc(${styles.slider_thumb_size} + 12px));
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          display: flex;
          min-height: ${styles.slider_wrap_height};
          padding: 0 14px;
        }
        .fan-card__slider-shell { flex: 1; min-width: 0; position: relative; }
        .fan-card__slider-track {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          height: ${styles.slider_height};
          left: 0;
          overflow: hidden;
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
        }
        .fan-card__slider-track::before {
          background: ${styles.slider_color};
          border-radius: inherit;
          content: "";
          inset: 0;
          position: absolute;
          transform: scaleX(calc(var(--percentage, 0) / 100));
          transform-origin: left center;
        }
        .fan-card__slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          cursor: pointer;
          height: var(--fan-card-slider-input-height);
          margin: 0;
          padding: 0;
          position: relative;
          touch-action: pan-y;
          width: 100%;
          z-index: 1;
        }
        .fan-card__slider::-webkit-slider-runnable-track { background: transparent; height: ${styles.slider_height}; }
        .fan-card__slider::-moz-range-track { background: transparent; border: 0; height: ${styles.slider_height}; }
        .fan-card__slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          height: ${styles.slider_thumb_size};
          margin-top: calc((${styles.slider_height} - ${styles.slider_thumb_size}) / 2);
          width: ${styles.slider_thumb_size};
        }
        .fan-card__slider::-moz-range-thumb {
          background: transparent;
          border: 0;
          height: ${styles.slider_thumb_size};
          width: ${styles.slider_thumb_size};
        }
        .fan-card__preset-panel {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          margin-top: 8px;
          min-width: 0;
        }
        :is(.fan-card__icon, .fan-card__control, .fan-card__preset):active:not(:disabled),
        :is(.fan-card__icon, .fan-card__control, .fan-card__preset).is-pressing:not(:disabled) {
          animation: fan-card-button-bounce var(--fan-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }
        @keyframes fan-card-button-bounce {
          0% { transform: scale(1); }
          45% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        @keyframes cover-card-icon-breathe {
          0%, 100% { transform: translateY(0); opacity: .86; }
          50% { transform: translateY(-2px); opacity: 1; }
        }
        ${animations.enabled ? "" : `.fan-card, .fan-card * { animation: none !important; transition: none !important; }`}
      </style>
      <ha-card
        class="fan-card ${isActive ? "is-on" : "is-off"} ${this._isCompactLayout() ? "fan-card--compact" : ""} ${showCopyBlock ? "fan-card--with-copy" : ""}"
        data-cover-action="body"
      >
        <div class="fan-card__content">
          <div class="fan-card__hero">
            <button type="button" class="fan-card__icon ${animations.enabled && animations.iconAnimation && isMoving ? "fan-card__icon--active-motion" : ""}" data-cover-action="icon" aria-label="Toggle cover">
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
              ${isUnavailableState(state) ? `<span class="fan-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopyBlock ? `
              <div class="fan-card__copy">
                <div class="fan-card__headline">
                  ${this._isCompactLayout() ? "" : `<div class="fan-card__title">${escapeHtml(title)}</div>`}
                  ${chips.length ? `<div class="fan-card__chips">${chips.join("")}</div>` : ""}
                </div>
              </div>
            ` : ""}
          </div>
          <div class="fan-card__controls-shell">
            <div class="fan-card__controls-inner">
              ${controlsMarkup}
            </div>
          </div>
        </div>
      </ha-card>
    `;
    this._lastRenderedIsActive = isActive;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCoverCard);
}

class NodaliaCoverCardEditor extends HTMLElement {
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
    const shouldRender = !this._hass || nextSignature !== this._entityOptionsSignature || !this.shadowRoot?.innerHTML;
    this._hass = hass;
    this._entityOptionsSignature = nextSignature;
    if (!shouldRender) return;
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
    if (!tagName || this._pendingEditorControlTags.has(tagName)) return;
    if (typeof customElements?.whenDefined !== "function" || customElements.get(tagName)) return;
    this._pendingEditorControlTags.add(tagName);
    customElements.whenDefined(tagName).then(() => {
      this._pendingEditorControlTags.delete(tagName);
      if (!this._hass || !this.shadowRoot) return;
      const focusState = this._captureFocusState();
      this._render();
      this._restoreFocusState(focusState);
    }).catch(() => this._pendingEditorControlTags.delete(tagName));
  }

  _ensureEditorControlsReady() {
    this._watchEditorControlTag("ha-entity-picker");
    this._watchEditorControlTag("ha-selector");
    this._watchEditorControlTag("ha-icon-picker");
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id => id.startsWith("cover."));
  }

  _getCoverEntityOptions() {
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => entityId.startsWith("cover."))
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

    const currentValue = String(this._config?.entity || "").trim();
    if (currentValue && !options.some(option => option.value === currentValue)) {
      options.unshift({
        value: currentValue,
        label: currentValue,
        displayLabel: currentValue,
      });
    }

    return options;
  }

  _captureFocusState() {
    const activeElement = this.shadowRoot?.activeElement;
    if (!(activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLSelectElement)) return null;
    const selector = activeElement.dataset?.field ? `[data-field="${escapeSelectorValue(activeElement.dataset.field)}"]` : null;
    if (!selector) return null;
    return {
      selector,
      selectionEnd: typeof activeElement.selectionEnd === "number" ? activeElement.selectionEnd : null,
      selectionStart: typeof activeElement.selectionStart === "number" ? activeElement.selectionStart : null,
      type: activeElement.type,
    };
  }

  _restoreFocusState(focusState) {
    if (!focusState?.selector || !this.shadowRoot) return;
    const target = this.shadowRoot.querySelector(focusState.selector);
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    try { target.focus({ preventScroll: true }); } catch (_error) { target.focus(); }
    if (focusState.type !== "checkbox" && typeof focusState.selectionStart === "number" && typeof target.setSelectionRange === "function") {
      try { target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd); } catch (_error) {}
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
    switch (input.dataset.valueType || "string") {
      case "boolean": return Boolean(input.checked);
      case "number": {
        if (input.value === "") {
          return "";
        }
        const numericValue = Number(input.value);
        return Number.isFinite(numericValue) ? numericValue : "";
      }
      case "csv": return normalizeList(input.value);
      case "color": return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      default: return input.value;
    }
  }

  _onShadowInput(event) {
    const input = event.composedPath().find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement);
    if (!input?.dataset?.field) return;
    event.stopPropagation();
    this._setFieldValue(input.dataset.field, this._readFieldValue(input));
    this._setEditorConfig();
    if (event.type === "change") this._emitConfig();
  }

  _onShadowValueChanged(event) {
    const control = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.field);
    if (!control?.dataset?.field) return;
    event.stopPropagation();
    const nextValue = typeof event.detail?.value === "string" ? event.detail.value : control.value;
    if (typeof control.dataset?.value === "string") control.dataset.value = String(nextValue || "");
    this._setFieldValue(control.dataset.field, nextValue);
    this._setEditorConfig();
    this._emitConfig();
  }

  _onShadowClick(event) {
    const toggleButton = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.editorToggle);
    if (!toggleButton) return;
    event.preventDefault();
    event.stopPropagation();
    if (toggleButton.dataset.editorToggle === "styles") this._showStyleSection = !this._showStyleSection;
    if (toggleButton.dataset.editorToggle === "animations") this._showAnimationSection = !this._showAnimationSection;
    this._render();
  }

  _editorLabel(value) {
    if (typeof value !== "string" || !window.NodaliaI18n?.editorStr) return value;
    return window.NodaliaI18n.editorStr(this._hass, this._config?.language ?? "auto", value);
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const min = options.min !== undefined ? `min="${escapeHtml(String(options.min))}"` : "";
    const max = options.max !== undefined ? `max="${escapeHtml(String(options.max))}"` : "";
    const step = options.step !== undefined ? `step="${escapeHtml(String(options.step))}"` : "";
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(options.type || "text")}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
          ${min}
          ${max}
          ${step}
        />
      </label>
    `;
  }

  _renderTextareaField(label, field, value, options = {}) {
    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(this._editorLabel(label))}</span>
        <textarea data-field="${escapeHtml(field)}" ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ""}>${escapeHtml(value || "")}</textarea>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options, fieldOptions = {}) {
    return `
      <label class="editor-field ${fieldOptions.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(this._editorLabel(label))}</span>
        <select data-field="${escapeHtml(field)}">
          ${(options || []).map(option => `<option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>${escapeHtml(this._editorLabel(option.label))}</option>`).join("")}
        </select>
      </label>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    return `
      <label class="editor-toggle">
        <input type="checkbox" data-field="${escapeHtml(field)}" data-value-type="boolean" ${checked ? "checked" : ""} />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(this._editorLabel(label))}</span>
      </label>
    `;
  }

  _renderColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("ed.weather.custom_color");
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

  _renderCoverEntityField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="cover-entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
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

  _mountCoverEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = ["cover"];
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => String(stateObj?.entity_id || "").startsWith("cover.");
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: {
          domain: "cover",
        },
      };
    } else {
      control = document.createElement("select");
      this._getCoverEntityOptions().forEach(option => {
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

  _render() {
    if (!this.shadowRoot) return;
    const config = normalizeConfig(this._config || {});
    const iconTap = String(config.icon_tap_action || "");
    const tapAction = String(config.tap_action || "toggle");
    const iconHold = String(config.icon_hold_action || "");
    const holdAction = String(config.hold_action || "none");
    const hapticStyle = config.haptics?.style || "medium";
    const showTapServiceSecurity = iconTap === "service" || tapAction === "service" || iconHold === "service" || holdAction === "service";
    const showIconHoldService = iconHold === "service" || (iconHold === "" && holdAction === "service");
    const showIconHoldUrl = iconHold === "url" || (iconHold === "" && holdAction === "url");
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

        .editor-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .editor-grid--stacked { grid-template-columns: 1fr; }

        .editor-field,
        .editor-toggle {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .editor-field--full { grid-column: 1 / -1; }

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

        .editor-field:has(> .editor-control-host[data-mounted-control="cover-entity"]),
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
        .editor-field select,
        .editor-field textarea {
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

        .editor-field textarea {
          min-height: 76px;
          resize: vertical;
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
            0 0 0 2px color-mix(in srgb, var(--primary-color) 40%, transparent),
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent);
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
        @media (max-width: 640px) { .editor-grid { grid-template-columns: 1fr; } }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div>
              <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.general_section_title"))}</div>
              <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.general_section_hint"))}</div>
            </div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderCoverEntityField("Cover entity", "entity", config.entity, { placeholder: "cover.salon", fullWidth: true })}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, { placeholder: "mdi:blinds", fullWidth: true })}
            ${this._renderTextField("ed.entity.name", "name", config.name, { placeholder: "Salon", fullWidth: true })}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div>
              <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_title"))}</div>
              <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_hint"))}</div>
            </div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderSelectField("ed.light.icon_tap_action", "icon_tap_action", iconTap, [
              { value: "", label: "ed.entity.icon_tap_inherit" },
              { value: "auto", label: "ed.entity.tap_auto" },
              { value: "toggle", label: "ed.entity.tap_toggle" },
              { value: "more-info", label: "ed.entity.tap_more_info" },
              { value: "url", label: "ed.entity.tap_open_url" },
              { value: "service", label: "ed.entity.tap_service" },
              { value: "none", label: "ed.entity.tap_none" },
            ], { fullWidth: true })}
            ${this._renderSelectField("ed.light.card_tap_action", "tap_action", tapAction, [
              { value: "auto", label: "ed.entity.tap_auto" },
              { value: "toggle", label: "ed.entity.tap_toggle" },
              { value: "more-info", label: "ed.entity.tap_more_info" },
              { value: "url", label: "ed.entity.tap_open_url" },
              { value: "service", label: "ed.entity.tap_service" },
              { value: "none", label: "ed.entity.tap_none" },
            ], { fullWidth: true })}
            ${showTapServiceSecurity ? this._renderCheckboxField("ed.entity.security_strict", "security.strict_service_actions", config.security?.strict_service_actions !== false) : ""}
            ${config.security?.strict_service_actions !== false && showTapServiceSecurity ? this._renderTextField("ed.entity.allowed_services_csv", "security.allowed_services", Array.isArray(config.security?.allowed_services) ? config.security.allowed_services.join(", ") : "", { placeholder: "cover.open_cover, cover.close_cover", valueType: "csv", fullWidth: true }) : ""}
            ${iconTap === "service" ? this._renderTextField("ed.entity.tap_service_field", "icon_tap_service", config.icon_tap_service, { placeholder: "cover.open_cover", fullWidth: true }) + this._renderTextareaField("ed.entity.tap_service_data_json", "icon_tap_service_data", config.icon_tap_service_data, { placeholder: '{"entity_id":"cover.salon"}' }) : ""}
            ${tapAction === "service" ? this._renderTextField("ed.entity.tap_service_field", "tap_service", config.tap_service, { placeholder: "cover.open_cover", fullWidth: true }) + this._renderTextareaField("ed.entity.tap_service_data_json", "tap_service_data", config.tap_service_data, { placeholder: '{"entity_id":"cover.salon"}' }) : ""}
            ${iconTap === "url" ? this._renderTextField("ed.entity.tap_url_field", "icon_tap_url", config.icon_tap_url, { placeholder: "https://example.com", fullWidth: true }) + this._renderCheckboxField("ed.entity.tap_new_tab", "icon_tap_new_tab", config.icon_tap_new_tab === true) : ""}
            ${tapAction === "url" ? this._renderTextField("ed.entity.tap_url_field", "tap_url", config.tap_url, { placeholder: "https://example.com", fullWidth: true }) + this._renderCheckboxField("ed.entity.tap_new_tab", "tap_new_tab", config.tap_new_tab === true) : ""}
            <div class="editor-section__hint editor-field--full">${escapeHtml(this._editorLabel("ed.light.hold_actions_section_hint"))}</div>
            ${this._renderSelectField("ed.light.icon_hold_action", "icon_hold_action", iconHold, [
              { value: "", label: "ed.entity.icon_hold_inherit" },
              { value: "auto", label: "ed.entity.tap_auto" },
              { value: "toggle", label: "ed.entity.tap_toggle" },
              { value: "more-info", label: "ed.entity.tap_more_info" },
              { value: "url", label: "ed.entity.tap_open_url" },
              { value: "service", label: "ed.entity.tap_service" },
              { value: "none", label: "ed.entity.tap_none" },
            ], { fullWidth: true })}
            ${this._renderSelectField("ed.light.card_hold_action", "hold_action", holdAction, [
              { value: "auto", label: "ed.entity.tap_auto" },
              { value: "toggle", label: "ed.entity.tap_toggle" },
              { value: "more-info", label: "ed.entity.tap_more_info" },
              { value: "url", label: "ed.entity.tap_open_url" },
              { value: "service", label: "ed.entity.tap_service" },
              { value: "none", label: "ed.entity.tap_none" },
            ], { fullWidth: true })}
            ${showIconHoldService ? this._renderTextField("ed.entity.hold_service_field", "icon_hold_service", config.icon_hold_service, { placeholder: "cover.stop_cover", fullWidth: true }) + this._renderTextareaField("ed.entity.hold_service_data_json", "icon_hold_service_data", config.icon_hold_service_data, { placeholder: '{"entity_id":"cover.salon"}' }) : ""}
            ${holdAction === "service" ? this._renderTextField("ed.entity.hold_service_field", "hold_service", config.hold_service, { placeholder: "cover.stop_cover", fullWidth: true }) + this._renderTextareaField("ed.entity.hold_service_data_json", "hold_service_data", config.hold_service_data, { placeholder: '{"entity_id":"cover.salon"}' }) : ""}
            ${showIconHoldUrl ? this._renderTextField("ed.entity.hold_url_field", "icon_hold_url", config.icon_hold_url, { placeholder: "https://example.com", fullWidth: true }) + this._renderCheckboxField("ed.entity.hold_new_tab", "icon_hold_new_tab", config.icon_hold_new_tab === true) : ""}
            ${holdAction === "url" ? this._renderTextField("ed.entity.hold_url_field", "hold_url", config.hold_url, { placeholder: "https://example.com", fullWidth: true }) + this._renderCheckboxField("ed.entity.hold_new_tab", "hold_new_tab", config.hold_new_tab === true) : ""}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div>
              <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_title"))}</div>
              <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.visibility_section_hint"))}</div>
            </div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("ed.vacuum.layout_narrow", "compact_layout_mode", config.compact_layout_mode || "auto", [
              { value: "auto", label: "ed.vacuum.layout_auto" },
              { value: "always", label: "ed.vacuum.layout_always" },
              { value: "never", label: "ed.vacuum.layout_never" },
            ])}
            ${this._renderCheckboxField("ed.fan.show_state_bubble", "show_state", config.show_state === true)}
            ${this._renderCheckboxField("Show position chip", "show_position_chip", config.show_position_chip !== false)}
            ${this._renderCheckboxField("Show tilt chip", "show_tilt_chip", config.show_tilt_chip !== false)}
            ${this._renderCheckboxField("Show position slider", "show_position_slider", config.show_position_slider !== false)}
            ${this._renderCheckboxField("Show tilt slider", "show_tilt_slider", config.show_tilt_slider !== false)}
            ${this._renderCheckboxField("Show stop button", "show_stop", config.show_stop !== false)}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div>
              <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.haptics_section_title"))}</div>
              <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.haptics_section_hint"))}</div>
            </div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.vacuum.enable_haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("ed.vacuum.fallback_vibrate", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField("ed.vacuum.haptic_style", "haptics.style", hapticStyle, [
              { value: "selection", label: "ed.weather.haptic_selection" },
              { value: "light", label: "ed.weather.haptic_light" },
              { value: "medium", label: "ed.weather.haptic_medium" },
              { value: "heavy", label: "ed.weather.haptic_heavy" },
              { value: "success", label: "ed.weather.haptic_success" },
              { value: "warning", label: "ed.weather.haptic_warning" },
              { value: "failure", label: "ed.weather.haptic_failure" },
            ])}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.fan.animations_section_hint"))}</div>
            <div class="editor-section__actions">
              <button type="button" class="editor-section__toggle-button" data-editor-toggle="animations" aria-expanded="${this._showAnimationSection ? "true" : "false"}">
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("ed.weather.hide_animation_settings") : this._editorLabel("ed.weather.show_animation_settings"))}</span>
              </button>
            </div>
          </div>
          ${this._showAnimationSection ? `
            <div class="editor-grid">
              ${this._renderCheckboxField("ed.vacuum.enable_animations", "animations.enabled", config.animations.enabled !== false)}
              ${this._renderCheckboxField("ed.vacuum.icon_animation_active", "animations.icon_animation", config.animations.icon_animation !== false)}
              ${this._renderTextField("ed.light.anim_power_ms", "animations.power_duration", config.animations.power_duration, { type: "number", valueType: "number", min: 120, max: 4000, step: 10 })}
              ${this._renderTextField("ed.light.anim_controls_ms", "animations.controls_duration", config.animations.controls_duration, { type: "number", valueType: "number", min: 120, max: 2400, step: 10 })}
              ${this._renderTextField("ed.vacuum.button_bounce_ms", "animations.button_bounce_duration", config.animations.button_bounce_duration, { type: "number", valueType: "number", min: 120, max: 1200, step: 10 })}
            </div>
          ` : ""}
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.styles_section_hint"))}</div>
            <div class="editor-section__actions">
              <button type="button" class="editor-section__toggle-button" data-editor-toggle="styles" aria-expanded="${this._showStyleSection ? "true" : "false"}">
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showStyleSection ? this._editorLabel("ed.weather.hide_style_settings") : this._editorLabel("ed.weather.show_style_settings"))}</span>
              </button>
            </div>
          </div>
          ${this._showStyleSection ? `
            <div class="editor-grid">
              ${this._renderColorField("ed.entity.style_card_bg", "styles.card.background", config.styles.card.background)}
              ${this._renderTextField("ed.entity.style_card_border", "styles.card.border", config.styles.card.border)}
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
              ${this._renderTextField("ed.entity.style_card_shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
              ${this._renderTextField("ed.entity.style_card_padding", "styles.card.padding", config.styles.card.padding)}
              ${this._renderTextField("ed.entity.style_card_gap", "styles.card.gap", config.styles.card.gap)}
              ${this._renderTextField("ed.entity.style_main_button_size", "styles.icon.size", config.styles.icon.size)}
              ${this._renderColorField("ed.entity.style_icon_on", "styles.icon.on_color", config.styles.icon.on_color)}
              ${this._renderColorField("ed.entity.style_icon_off", "styles.icon.off_color", config.styles.icon.off_color)}
              ${this._renderTextField("ed.vacuum.style_button_size", "styles.control.size", config.styles.control.size)}
              ${this._renderColorField("ed.entity.style_accent_bg", "styles.control.accent_background", config.styles.control.accent_background)}
              ${this._renderColorField("ed.entity.style_accent_color", "styles.control.accent_color", config.styles.control.accent_color)}
              ${this._renderTextField("ed.fan.style_slider_wrap_height", "styles.slider_wrap_height", config.styles.slider_wrap_height)}
              ${this._renderTextField("ed.fan.style_slider_height", "styles.slider_height", config.styles.slider_height)}
              ${this._renderColorField("ed.fan.style_slider_color", "styles.slider_color", config.styles.slider_color)}
              ${this._renderTextField("ed.entity.style_chip_height", "styles.chip_height", config.styles.chip_height)}
              ${this._renderTextField("ed.entity.style_chip_font", "styles.chip_font_size", config.styles.chip_font_size)}
              ${this._renderTextField("ed.entity.style_chip_padding", "styles.chip_padding", config.styles.chip_padding)}
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
              ${this._renderTextField("ed.entity.style_title_size", "styles.title_size", config.styles.title_size)}
            </div>
          ` : ""}
        </section>
      </div>
    `;
    this.shadowRoot.querySelectorAll('[data-mounted-control="cover-entity"]').forEach(host => this._mountCoverEntityPicker(host));
    this.shadowRoot.querySelectorAll("ha-icon-picker[data-field]").forEach(control => {
      control.hass = this._hass;
      control.value = control.dataset.value || "";
      control.addEventListener("value-changed", this._onShadowValueChanged);
    });
    this._ensureEditorControlsReady();
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCoverCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Cover Card",
  description: "Fan-card style controls for Home Assistant cover entities.",
  preview: true,
});
