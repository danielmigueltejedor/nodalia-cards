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
    "editorSortLocale",
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
   * BCP-47 locale for `String.prototype.localeCompare` in editors and entity-id tie-break sorts,
   * aligned with `resolveLanguage` / card `language` the same way as `editorFilteredStatesSignature`.
   */
  function editorSortLocale(hass, language) {
    if (typeof window !== "undefined" && window.NodaliaI18n?.resolveLanguage && window.NodaliaI18n?.localeTag) {
      return window.NodaliaI18n.localeTag(window.NodaliaI18n.resolveLanguage(hass, language ?? "auto"));
    }
    const raw = hass?.locale?.language || hass?.selectedLanguage || hass?.language;
    const s = String(raw || "").trim();
    return s || "en";
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
    editorSortLocale,
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

const CARD_TAG = "nodalia-circular-gauge-card";
const EDITOR_TAG = "nodalia-circular-gauge-card-editor";
const CARD_VERSION = "1.1.0";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
const DIAL_START_ANGLE = 135;
const DIAL_END_ANGLE = 405;
const DIAL_SWEEP = DIAL_END_ANGLE - DIAL_START_ANGLE;
const DIAL_VIEWBOX_SIZE = 240;
const DIAL_CIRCLE_RADIUS = 86;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_CIRCLE_RADIUS;
const DIAL_VISIBLE_LENGTH = DIAL_CIRCUMFERENCE * (DIAL_SWEEP / 360);
const DIAL_HIDDEN_LENGTH = DIAL_CIRCUMFERENCE - DIAL_VISIBLE_LENGTH;
const DEFAULT_GAUGE_MIN_TINT_COLOR = "color-mix(in srgb, var(--primary-text-color) 24%, transparent)";
const DEFAULT_GAUGE_MAX_TINT_COLOR = "#ff7d57";
const GAUGE_TINT_SEGMENT_COUNT = 40;

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  min: "",
  max: "",
  min_label: "",
  max_label: "",
  unit: "",
  decimals: "",
  start_from_zero: true,
  show_header: true,
  show_name: true,
  show_icon: true,
  show_name_chip: true,
  show_percentage_chip: false,
  show_range_labels: true,
  show_unavailable_badge: true,
  show_bottom_icon_bubble: false,
  tap_action: "more-info",
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    dial_duration: 220,
    button_bounce_duration: 320,
    content_duration: 420,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "30px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "16px",
      gap: "14px",
    },
    icon: {
      size: "58px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 10px",
    chip_border_radius: "999px",
    title_size: "16px",
    value_size: "52px",
    range_size: "14px",
    name_chip_max_width: "170px",
    gauge: {
      size: "280px",
      stroke: "18px",
      thumb_size: "22px",
      track_color: "color-mix(in srgb, var(--primary-text-color) 24%, var(--ha-card-background))",
      background: "color-mix(in srgb, var(--primary-text-color) 2%, transparent)",
      min_tint_color: DEFAULT_GAUGE_MIN_TINT_COLOR,
      max_tint_color: DEFAULT_GAUGE_MAX_TINT_COLOR,
      foreground_color: "",
    },
  },
};

const STUB_CONFIG = {
  entity: "sensor.enchufe_inteligente_potencia",
  name: "Potencia",
  min: 0,
  max: 2500,
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
  const state = hass?.states?.[entityId];
  const unit = String(state?.attributes?.unit_of_measurement || "").trim();
  const numericState = Number(state?.state);
  config.name = state?.attributes?.friendly_name || entityId;

  if (unit === "%") {
    config.min = 0;
    config.max = 100;
  } else if (Number.isFinite(numericState) && numericState > Number(config.max || 0)) {
    config.min = 0;
    config.max = Math.ceil(numericState * 1.25);
  }

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeSelectorValue(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

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
  const defaults = DEFAULT_CONFIG.styles;
  const card = styles?.card || {};
  const icon = styles?.icon || {};
  const gauge = styles?.gauge || {};
  return {
    card: {
      background: sanitizeCssValue(card.background, defaults.card.background),
      border: sanitizeCssValue(card.border, defaults.card.border),
      border_radius: sanitizeCssValue(card.border_radius, defaults.card.border_radius),
      box_shadow: sanitizeCssValue(card.box_shadow, defaults.card.box_shadow),
      padding: sanitizeCssValue(card.padding, defaults.card.padding),
      gap: sanitizeCssValue(card.gap, defaults.card.gap),
    },
    icon: {
      size: sanitizeCssValue(icon.size, defaults.icon.size),
      background: sanitizeCssValue(icon.background, defaults.icon.background),
      color: sanitizeCssValue(icon.color, defaults.icon.color),
    },
    chip_height: sanitizeCssValue(styles?.chip_height, defaults.chip_height),
    chip_font_size: sanitizeCssValue(styles?.chip_font_size, defaults.chip_font_size),
    chip_padding: sanitizeCssValue(styles?.chip_padding, defaults.chip_padding),
    chip_border_radius: sanitizeCssValue(styles?.chip_border_radius, defaults.chip_border_radius),
    title_size: sanitizeCssValue(styles?.title_size, defaults.title_size),
    value_size: sanitizeCssValue(styles?.value_size, defaults.value_size),
    range_size: sanitizeCssValue(styles?.range_size, defaults.range_size),
    name_chip_max_width: sanitizeCssValue(styles?.name_chip_max_width, defaults.name_chip_max_width),
    gauge: {
      size: sanitizeCssValue(gauge.size, defaults.gauge.size),
      stroke: sanitizeCssValue(gauge.stroke, defaults.gauge.stroke),
      thumb_size: sanitizeCssValue(gauge.thumb_size, defaults.gauge.thumb_size),
      track_color: sanitizeCssValue(gauge.track_color, defaults.gauge.track_color),
      background: sanitizeCssValue(gauge.background, defaults.gauge.background),
      min_tint_color: sanitizeCssValue(gauge.min_tint_color, defaults.gauge.min_tint_color),
      max_tint_color: sanitizeCssValue(gauge.max_tint_color, defaults.gauge.max_tint_color),
      foreground_color: sanitizeCssValue(gauge.foreground_color, defaults.gauge.foreground_color),
    },
  };
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

  if (normalizedField.endsWith("icon.background")) {
    return "color-mix(in srgb, var(--primary-text-color) 6%, transparent)";
  }

  if (normalizedField.endsWith("gauge.background")) {
    return "color-mix(in srgb, var(--primary-text-color) 2%, transparent)";
  }

  if (normalizedField.endsWith("track_color")) {
    return "color-mix(in srgb, var(--primary-text-color) 24%, var(--ha-card-background))";
  }

  if (normalizedField.endsWith("min_tint_color")) {
    return DEFAULT_GAUGE_MIN_TINT_COLOR;
  }

  if (normalizedField.endsWith("max_tint_color")) {
    return DEFAULT_GAUGE_MAX_TINT_COLOR;
  }

  if (normalizedField.endsWith("foreground_color")) {
    return DEFAULT_GAUGE_MAX_TINT_COLOR;
  }

  if (normalizedField.endsWith("icon.color")) {
    return "var(--primary-text-color)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
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

function resolveColorInContext(contextNode, value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue || typeof document === "undefined") {
    return rawValue;
  }

  const probe = document.createElement("span");
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.color = "";
  probe.style.color = rawValue;
  (contextNode || document.body || document.documentElement).appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || rawValue;
}

function parseRgbColor(value) {
  const source = String(value ?? "").trim();
  if (!source) {
    return null;
  }

  const rgbMatch = source.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const channels = rgbMatch[1]
      .split(",")
      .map(channel => Number.parseFloat(channel.trim()))
      .filter(channel => Number.isFinite(channel));

    if (channels.length >= 3) {
      return {
        red: clamp(channels[0], 0, 255),
        green: clamp(channels[1], 0, 255),
        blue: clamp(channels[2], 0, 255),
      };
    }
  }

  const hexMatch = source.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1].length === 3
      ? hexMatch[1].split("").map(channel => channel + channel).join("")
      : hexMatch[1];

    return {
      red: Number.parseInt(hex.slice(0, 2), 16),
      green: Number.parseInt(hex.slice(2, 4), 16),
      blue: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  return null;
}

function getRelativeLuminance(color) {
  if (!color) {
    return null;
  }

  const toLinear = channel => {
    const normalized = clamp(Number(channel) / 255, 0, 1);
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  const red = toLinear(color.red);
  const green = toLinear(color.green);
  const blue = toLinear(color.blue);
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function normalizeTextKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

function getStepPrecision(step) {
  const text = String(step ?? "");
  if (!text.includes(".")) {
    return 0;
  }

  return text.split(".")[1].length;
}

function inferDecimals(rawValue) {
  const text = String(rawValue ?? "").trim();
  const normalized = text.replace(",", ".");
  if (!normalized.includes(".")) {
    return 0;
  }

  return Math.min(3, normalized.split(".")[1].length);
}

function getHassLocaleTag(hass, language = "auto") {
  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, language);
  return window.NodaliaI18n?.localeTag?.(lang) || hass?.locale?.language || undefined;
}

function formatNumberValue(value, decimals = 0, locale = undefined) {
  if (!Number.isFinite(Number(value))) {
    return "--";
  }

  return Number(value).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function normalizeConfig(rawConfig) {
  return mergeConfig(DEFAULT_CONFIG, rawConfig || {});
}

function inferReasonableMax(currentValue, unit, state) {
  const normalizedUnit = normalizeTextKey(unit);
  const domainHint = `${state?.entity_id || ""} ${state?.attributes?.device_class || ""} ${state?.attributes?.friendly_name || ""}`.toLowerCase();

  if (normalizedUnit === "%" || domainHint.includes("battery") || domainHint.includes("humidity")) {
    return 100;
  }

  if (["w", "watt", "watts", "va"].includes(normalizedUnit) || domainHint.includes("power") || domainHint.includes("potencia")) {
    return 2500;
  }

  if (["kw"].includes(normalizedUnit)) {
    return 10;
  }

  if (["a", "ma"].includes(normalizedUnit) || domainHint.includes("current") || domainHint.includes("corriente")) {
    return normalizedUnit === "ma" ? 3000 : 32;
  }

  if (["v", "mv"].includes(normalizedUnit) || domainHint.includes("voltage") || domainHint.includes("tension")) {
    return normalizedUnit === "mv" ? 1000 : 260;
  }

  if (
    normalizedUnit.includes("l_s")
    || normalizedUnit.includes("l_min")
    || normalizedUnit.includes("m3_h")
    || domainHint.includes("water")
    || domainHint.includes("agua")
    || domainHint.includes("caudal")
    || domainHint.includes("flow")
  ) {
    if (normalizedUnit.includes("l_s")) {
      return 10;
    }
    if (normalizedUnit.includes("l_min")) {
      return 60;
    }
    if (normalizedUnit.includes("m3_h")) {
      return 10;
    }
    return 100;
  }

  if (["c", "f", "degc", "degf"].includes(normalizedUnit) || domainHint.includes("temperature") || domainHint.includes("temperatura")) {
    return 40;
  }

  if (["bar", "hpa", "pa"].includes(normalizedUnit) || domainHint.includes("pressure") || domainHint.includes("presion")) {
    return 1200;
  }

  if (Number.isFinite(currentValue)) {
    if (currentValue <= 10) return 10;
    if (currentValue <= 50) return 50;
    if (currentValue <= 100) return 100;
    if (currentValue <= 250) return 250;
    if (currentValue <= 500) return 500;
    if (currentValue <= 1000) return 1000;
    if (currentValue <= 2500) return 2500;
    if (currentValue <= 5000) return 5000;
    if (currentValue <= 10000) return 10000;
  }

  return 100;
}

function getDialMarkerPosition(angle) {
  const markerRadiusPercent = (DIAL_CIRCLE_RADIUS / DIAL_VIEWBOX_SIZE) * 100;
  const radians = (angle * Math.PI) / 180;
  return {
    left: Number((50 + (Math.cos(radians) * markerRadiusPercent)).toFixed(3)),
    top: Number((50 + (Math.sin(radians) * markerRadiusPercent)).toFixed(3)),
  };
}

function getDialMarkerCoordinates(angle) {
  const center = DIAL_VIEWBOX_SIZE / 2;
  const radians = (angle * Math.PI) / 180;
  return {
    x: Number((center + (Math.cos(radians) * DIAL_CIRCLE_RADIUS)).toFixed(3)),
    y: Number((center + (Math.sin(radians) * DIAL_CIRCLE_RADIUS)).toFixed(3)),
  };
}

function mixCssColors(leftColor, rightColor, ratio) {
  const safeRatio = clamp(Number(ratio) || 0, 0, 1);
  if (safeRatio <= 0) {
    return leftColor;
  }

  if (safeRatio >= 1) {
    return rightColor;
  }

  const rightPercent = Number((safeRatio * 100).toFixed(2));
  const leftPercent = Number((100 - rightPercent).toFixed(2));

  return `color-mix(in srgb, ${leftColor} ${leftPercent}%, ${rightColor} ${rightPercent}%)`;
}

function buildGaugeTintScale(minTintColor, maxTintColor) {
  const safeMinTintColor = String(minTintColor || DEFAULT_GAUGE_MIN_TINT_COLOR).trim() || DEFAULT_GAUGE_MIN_TINT_COLOR;
  const safeMaxTintColor = String(maxTintColor || DEFAULT_GAUGE_MAX_TINT_COLOR).trim() || DEFAULT_GAUGE_MAX_TINT_COLOR;

  return [
    { offset: 0, color: safeMinTintColor },
    { offset: 0.28, color: mixCssColors("#71cf78", safeMaxTintColor, 0.08) },
    { offset: 0.52, color: mixCssColors("#d9c45a", safeMaxTintColor, 0.14) },
    { offset: 0.76, color: mixCssColors("#f5a03d", safeMaxTintColor, 0.22) },
    { offset: 1, color: safeMaxTintColor },
  ];
}

function resolveGaugeTintColor(scale, ratio) {
  const safeRatio = clamp(Number(ratio) || 0, 0, 1);
  const tintScale = Array.isArray(scale) && scale.length ? scale : buildGaugeTintScale();

  if (safeRatio <= tintScale[0].offset) {
    return tintScale[0].color;
  }

  for (let index = 1; index < tintScale.length; index += 1) {
    const currentStop = tintScale[index];
    const previousStop = tintScale[index - 1];

    if (safeRatio <= currentStop.offset) {
      const span = Math.max(currentStop.offset - previousStop.offset, 0.0001);
      const localRatio = (safeRatio - previousStop.offset) / span;
      return mixCssColors(previousStop.color, currentStop.color, localRatio);
    }
  }

  return tintScale[tintScale.length - 1].color;
}

class NodaliaCircularGaugeCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["sensor", "number", "input_number"]);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._lastGaugeVisualState = null;
    this._gaugeVisualFrame = 0;
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
  }

  connectedCallback() {
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    if (this._gaugeVisualFrame) {
      window.cancelAnimationFrame(this._gaugeVisualFrame);
      this._gaugeVisualFrame = 0;
    }
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._render();
  }

  set hass(hass) {
    const nextSignature = this._getRenderSignature(hass);
    this._hass = hass;
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 5,
      min_columns: 6,
    };
  }

  _getState() {
    return this._config?.entity ? this._hass?.states?.[this._config.entity] || null : null;
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const attrs = state?.attributes || {};
    return JSON.stringify({
      entityId,
      state: String(state?.state || ""),
      friendlyName: String(attrs.friendly_name || ""),
      icon: String(attrs.icon || ""),
      unit: String(attrs.unit_of_measurement || attrs.native_unit_of_measurement || ""),
      rows: Number(this._config?.grid_options?.rows || 0),
      columns: Number(this._config?.grid_options?.columns || 0),
    });
  }

  _getConfiguredGridRows() {
    const numericRows = Number(this._config?.grid_options?.rows);
    return Number.isFinite(numericRows) ? numericRows : null;
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) ? numericColumns : null;
  }

  _getCompactLevel() {
    const configuredRows = this._getConfiguredGridRows();
    const configuredColumns = this._getConfiguredGridColumns();

    if (
      (configuredRows !== null && configuredRows <= 3)
      || (configuredColumns !== null && configuredColumns <= 6)
    ) {
      return "compact";
    }

    return "default";
  }

  _getTitle(state) {
    return this._config?.name
      || state?.attributes?.friendly_name
      || this._config?.entity
      || "Gauge";
  }

  _getIcon(state) {
    return this._config?.icon
      || state?.attributes?.icon
      || "mdi:gauge";
  }

  _getUnit(state) {
    return String(
      this._config?.unit
      || state?.attributes?.unit_of_measurement
      || state?.attributes?.native_unit_of_measurement
      || "",
    ).trim();
  }

  _getNumericValue(state) {
    const direct = Number(String(state?.state ?? "").replace(",", "."));
    if (Number.isFinite(direct)) {
      return direct;
    }

    const nativeValue = Number(state?.attributes?.native_value);
    return Number.isFinite(nativeValue) ? nativeValue : null;
  }

  _getDecimals(state) {
    const configured = Number(this._config?.decimals);
    if (Number.isFinite(configured) && configured >= 0) {
      return Math.min(3, configured);
    }

    const rawState = String(state?.state ?? "").trim();
    return inferDecimals(rawState);
  }

  _getRange(state, currentValue) {
    const configuredMin = Number(this._config?.min);
    const configuredMax = Number(this._config?.max);
    const attrMin = Number(state?.attributes?.min);
    const attrMax = Number(state?.attributes?.max);
    const unit = this._getUnit(state);

    const min = Number.isFinite(configuredMin)
      ? configuredMin
      : Number.isFinite(attrMin)
        ? attrMin
        : this._config?.start_from_zero === false && Number.isFinite(currentValue) && currentValue < 0
          ? Math.floor(currentValue)
          : 0;

    let max = Number.isFinite(configuredMax)
      ? configuredMax
      : Number.isFinite(attrMax)
        ? attrMax
        : inferReasonableMax(currentValue, unit, state);

    if (!Number.isFinite(max) || max <= min) {
      max = min + 100;
    }

    return { min, max };
  }

  _getRangeLabel(boundary, range, state) {
    const configuredLabel = String(
      boundary === "min" ? this._config?.min_label ?? "" : this._config?.max_label ?? "",
    ).trim();

    if (configuredLabel) {
      return configuredLabel;
    }

    return formatNumberValue(boundary === "min" ? range.min : range.max, this._getDecimals(state), this._getLocaleTag());
  }

  _getGaugeTintScale() {
    const gaugeStyles = this._config?.styles?.gauge || DEFAULT_CONFIG.styles.gauge;
    return buildGaugeTintScale(gaugeStyles.min_tint_color, gaugeStyles.max_tint_color);
  }

  _getGaugeProgressSegments(ratio, tintScale) {
    const safeRatio = clamp(Number(ratio) || 0, 0, 1);
    const configuredColor = String(this._config?.styles?.gauge?.foreground_color || "").trim();
    const segmentLength = DIAL_VISIBLE_LENGTH / GAUGE_TINT_SEGMENT_COUNT;
    const segmentRatioSize = 1 / GAUGE_TINT_SEGMENT_COUNT;

    return Array.from({ length: GAUGE_TINT_SEGMENT_COUNT }, (_, index) => {
      const startRatio = index * segmentRatioSize;
      const fillRatio = clamp((safeRatio - startRatio) / segmentRatioSize, 0, 1);
      const visibleLength = Number((segmentLength * fillRatio).toFixed(3));

      return {
        color: configuredColor || resolveGaugeTintColor(tintScale, startRatio + (segmentRatioSize * 0.5)),
        dasharray: `${visibleLength} ${DIAL_CIRCUMFERENCE}`,
        dashoffset: `${Number((-segmentLength * index).toFixed(3))}`,
        opacity: visibleLength > 0.05 ? 0.96 : 0,
      };
    });
  }

  _getAccentColor(state, ratio) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const configuredColor = String(styles?.gauge?.foreground_color || "").trim();
    if (configuredColor) {
      return configuredColor;
    }

    return resolveGaugeTintColor(this._getGaugeTintScale(), ratio);
  }

  _formatValue(value, state, withUnit = false) {
    const decimals = this._getDecimals(state);
    const formatted = formatNumberValue(value, decimals, this._getLocaleTag());
    if (!withUnit) {
      return formatted;
    }

    const unit = this._getUnit(state);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  _getLocaleTag() {
    return getHassLocaleTag(this._hass, this._config?.language ?? "auto");
  }

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;

    return {
      enabled: configuredAnimations.enabled !== false,
      dialDuration: clamp(
        Number(configuredAnimations.dial_duration) || DEFAULT_CONFIG.animations.dial_duration,
        80,
        2000,
      ),
      buttonBounceDuration: clamp(
        Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
        120,
        1200,
      ),
      contentDuration: clamp(
        Number(configuredAnimations.content_duration) || DEFAULT_CONFIG.animations.content_duration,
        140,
        1800,
      ),
    };
  }

  _isLightThemeSurface() {
    const textColor = parseRgbColor(resolveColorInContext(this, "var(--primary-text-color)"));
    const backgroundColor = parseRgbColor(resolveColorInContext(this, "var(--ha-card-background, var(--card-background-color, #ffffff))"));

    const textLuminance = getRelativeLuminance(textColor);
    if (textLuminance !== null) {
      return textLuminance < 0.36;
    }

    const backgroundLuminance = getRelativeLuminance(backgroundColor);
    if (backgroundLuminance !== null) {
      return backgroundLuminance > 0.62;
    }

    return false;
  }

  _canRunTapAction() {
    return (this._config?.tap_action || "more-info") !== "none" && Boolean(this._config?.entity);
  }

  _triggerHaptic(styleOverride = null) {
    const haptics = this._config?.haptics || {};
    if (haptics.enabled !== true) {
      return;
    }

    const style = styleOverride || haptics.style || "medium";
    fireEvent(this, "haptic", style, {
      bubbles: true,
      cancelable: false,
      composed: true,
    });

    if (haptics.fallback_vibrate === true && typeof navigator?.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection);
    }
  }

  _triggerContentBounce(content) {
    if (!(content instanceof HTMLElement)) {
      return;
    }

    const animations = this._getAnimationSettings();
    if (!animations.enabled) {
      return;
    }

    content.classList.remove("is-pressing");
    content.getBoundingClientRect();
    content.classList.add("is-pressing");

    window.setTimeout(() => {
      content.classList.remove("is-pressing");
    }, animations.buttonBounceDuration + 40);
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

  _openMoreInfo() {
    if (!this._config?.entity) {
      return;
    }

    fireEvent(this, "hass-more-info", {
      entityId: this._config.entity,
    });
  }

  _onShadowClick(event) {
    const target = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.gaugeAction === "primary");

    if (!target || !this._canRunTapAction()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();
    this._triggerContentBounce(target);
    this._openMoreInfo();
  }

  _renderEmptyState() {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    return `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        .gauge-card--empty {
          background: ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          display: grid;
          gap: 6px;
          padding: ${styles.card.padding};
        }

        .gauge-card__empty-title {
          color: var(--primary-text-color);
          font-size: 15px;
          font-weight: 700;
        }

        .gauge-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }
      </style>
      <ha-card class="gauge-card gauge-card--empty">
        <div class="gauge-card__empty-title">Nodalia Circular Gauge Card</div>
        <div class="gauge-card__empty-text">Configura \`entity\` con una entidad numerica para mostrar el dial.</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const styles = getSafeStyles(config.styles);
    const state = this._getState();

    if (!state) {
      this.shadowRoot.innerHTML = this._renderEmptyState();
      return;
    }

    const compactLayout = this._getCompactLevel() === "compact";
    const title = this._getTitle(state);
    const icon = this._getIcon(state);
    const value = this._getNumericValue(state);
    const unit = this._getUnit(state);
    const range = this._getRange(state, value);
    const ratio = value === null ? 0 : clamp((value - range.min) / Math.max(range.max - range.min, 1), 0, 1);
    const tintScale = this._getGaugeTintScale();
    const accentColor = this._getAccentColor(state, ratio);
    const progressLength = Number((DIAL_VISIBLE_LENGTH * ratio).toFixed(3));
    const dialAngle = DIAL_START_ANGLE + (ratio * DIAL_SWEEP);
    const thumbPosition = getDialMarkerPosition(dialAngle);
    const dialStartCoordinates = getDialMarkerCoordinates(DIAL_START_ANGLE);
    const dialStartCapColor =
      sanitizeCssValue(styles.gauge.foreground_color, "") || resolveGaugeTintColor(tintScale, 0.02);
    const showUnavailableBadge = config.show_unavailable_badge !== false && isUnavailableState(state);
    const showHeader = config.show_header !== false;
    const showName = config.show_name !== false;
    const showIcon = config.show_icon !== false;
    const dialSizePx = Math.max(
      220,
      Math.min(parseSizeToPixels(styles.gauge.size, 280), compactLayout ? 248 : 280),
    );
    const dialStrokePx = Math.max(
      15,
      Math.min(parseSizeToPixels(styles.gauge.stroke, 18), compactLayout ? 17 : 18),
    );
    const thumbSizePx = Math.max(
      18,
      Math.min(parseSizeToPixels(styles.gauge.thumb_size, 22), compactLayout ? 20 : 22),
    );
    const effectiveCardPadding = compactLayout ? "14px" : styles.card.padding;
    const effectiveGap = compactLayout ? "12px" : styles.card.gap;
    const effectiveIconSize = `${Math.max(50, Math.min(parseSizeToPixels(styles.icon.size, 58), compactLayout ? 54 : 58))}px`;
    const effectiveTitleSize = `${Math.max(14, Math.min(parseSizeToPixels(styles.title_size, 16), compactLayout ? 15 : 16))}px`;
    const effectiveValueSize = `${Math.max(42, Math.min(parseSizeToPixels(styles.value_size, 52), compactLayout ? 46 : 52))}px`;
    const effectiveRangeSize = `${Math.max(12, Math.min(parseSizeToPixels(styles.range_size, 14), compactLayout ? 13 : 14))}px`;
    const effectiveChipHeight = `${Math.max(22, Math.min(parseSizeToPixels(styles.chip_height, 24), compactLayout ? 23 : 24))}px`;
    const effectiveChipFontSize = `${Math.max(10, Math.min(parseSizeToPixels(styles.chip_font_size, 11), compactLayout ? 10.5 : 11))}px`;
    const effectiveChipPadding = compactLayout ? "0 9px" : styles.chip_padding;
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const effectiveNameChipMaxWidth = `${Math.max(120, Math.min(parseSizeToPixels(styles.name_chip_max_width, 170), compactLayout ? 148 : 170))}px`;
    const cardBackground = value === null
      ? styles.card.background
      : `
        linear-gradient(135deg, color-mix(in srgb, ${accentColor} 22%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 12%, ${styles.card.background}) 56%, ${styles.card.background} 100%)
      `.trim();
    const cardBorder = value === null
      ? styles.card.border
      : `1px solid color-mix(in srgb, ${accentColor} 34%, var(--divider-color))`;
    const cardShadow = value === null
      ? styles.card.box_shadow
      : `${styles.card.box_shadow}, 0 18px 36px color-mix(in srgb, ${accentColor} 14%, rgba(0, 0, 0, 0.16))`;
    const dialSurfaceBackground = `
      radial-gradient(circle at 24% 18%, color-mix(in srgb, ${accentColor} 20%, transparent), transparent 30%),
      linear-gradient(180deg, color-mix(in srgb, ${accentColor} 14%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)) 0%, rgba(255, 255, 255, 0) 42%),
      linear-gradient(135deg, color-mix(in srgb, ${accentColor} 16%, ${styles.gauge.background}) 0%, color-mix(in srgb, ${accentColor} 8%, ${styles.gauge.background}) 60%, ${styles.gauge.background} 100%)
    `.trim();
    const dialTrackColor = `color-mix(in srgb, ${styles.gauge.track_color} 68%, var(--primary-text-color) 32%)`;
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const previousVisualState = animations.enabled && !shouldAnimateEntrance ? this._lastGaugeVisualState : null;
    const initialRatio = previousVisualState ? previousVisualState.ratio : shouldAnimateEntrance ? 0 : ratio;
    const initialProgressLength = Number((DIAL_VISIBLE_LENGTH * initialRatio).toFixed(3));
    const initialThumbPosition = previousVisualState ? previousVisualState.thumbPosition : shouldAnimateEntrance ? getDialMarkerPosition(DIAL_START_ANGLE) : thumbPosition;
    const initialProgressSegments = this._getGaugeProgressSegments(initialRatio, tintScale);
    const chips = [];

    if (config.show_percentage_chip === true && value !== null) {
      chips.push(`<div class="gauge-card__chip">${escapeHtml(`${Math.round(ratio * 100)}%`)}</div>`);
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --gauge-card-dial-duration: ${animations.enabled ? animations.dialDuration : 0}ms;
          --gauge-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --gauge-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          display: block;
          height: 100%;
          min-height: 0;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          height: 100%;
          min-height: 0;
          overflow: hidden;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .gauge-card {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${accentColor} 34%, transparent) 0%, transparent 60%),
            radial-gradient(circle at 50% 38%, color-mix(in srgb, ${accentColor} 16%, transparent) 0%, transparent 64%),
            linear-gradient(180deg, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)) 0%, rgba(255, 255, 255, 0) 44%),
            ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          isolation: isolate;
          overflow: hidden;
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .gauge-card::before {
          background: ${value === null
            ? "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0))"
            : `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 28%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .gauge-card::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 28%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 54%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, transparent) 0%, transparent 68%);
          content: "";
          inset: 0;
          opacity: ${value === null ? "0" : "1"};
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .gauge-card__content {
          cursor: ${this._canRunTapAction() ? "pointer" : "default"};
          display: flex;
          flex-direction: column;
          gap: ${effectiveGap};
          height: 100%;
          min-height: 0;
          padding: ${effectiveCardPadding};
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease;
          will-change: transform;
          z-index: 1;
        }

        .gauge-card__content.is-pressing {
          animation: gauge-card-content-bounce var(--gauge-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .gauge-card__hero {
          align-items: center;
          display: grid;
          gap: ${effectiveGap};
          grid-template-columns: ${showIcon ? `${effectiveIconSize} minmax(0, 1fr)` : "minmax(0, 1fr)"};
          min-height: 0;
          width: 100%;
        }

        .gauge-card__icon {
          align-items: center;
          appearance: none;
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--primary-text-color) 6%, transparent), transparent 60%),
            ${styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: calc(${effectiveIconSize} * 0.5);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent),
            0 10px 26px rgba(0, 0, 0, 0.16);
          color: ${styles.icon.color};
          display: inline-flex;
          height: ${effectiveIconSize};
          justify-content: center;
          margin: 0;
          padding: 0;
          position: relative;
          width: ${effectiveIconSize};
        }

        .gauge-card__icon ha-icon {
          --mdc-icon-size: calc(${effectiveIconSize} * 0.44);
          display: inline-flex;
          height: calc(${effectiveIconSize} * 0.44);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${effectiveIconSize} * 0.44);
        }

        .gauge-card__unavailable-badge {
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

        .gauge-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          width: 11px;
        }

        .gauge-card__copy {
          display: grid;
          gap: 10px;
          min-width: 0;
        }

        .gauge-card__headline {
          align-items: start;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .gauge-card__title {
          color: var(--primary-text-color);
          font-size: ${effectiveTitleSize};
          font-weight: 700;
          line-height: 1.14;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .gauge-card__chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          min-width: 0;
        }

        .gauge-card__chip {
          align-items: center;
          backdrop-filter: blur(18px);
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          color: var(--primary-text-color);
          display: inline-flex;
          font-size: ${effectiveChipFontSize};
          font-weight: 700;
          height: ${effectiveChipHeight};
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding: ${effectiveChipPadding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .gauge-card__hero--entering {
          animation: gauge-card-fade-up calc(var(--gauge-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .gauge-card__dial-wrap {
          align-items: center;
          display: flex;
          flex: 1 1 auto;
          justify-content: center;
          min-height: 0;
        }

        .gauge-card__dial-wrap--entering {
          animation: gauge-card-fade-up var(--gauge-card-content-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 40ms;
        }

        .gauge-card__dial-wrap--entering .gauge-card__dial {
          animation: gauge-card-dial-bloom calc(var(--gauge-card-content-duration) * 1.02) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .gauge-card__dial-wrap--entering .gauge-card__dial-center {
          animation: gauge-card-dial-center-bloom calc(var(--gauge-card-content-duration) * 0.92) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 70ms;
        }

        .gauge-card__dial-wrap--entering .gauge-card__dial-thumb {
          animation: gauge-card-dial-thumb-pop calc(var(--gauge-card-content-duration) * 0.66) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
          animation-delay: 90ms;
        }

        .gauge-card__dial {
          --gauge-progress-length: ${initialProgressLength};
          --gauge-dial-size: ${dialSizePx}px;
          --gauge-thumb-size: ${thumbSizePx}px;
          align-self: center;
          aspect-ratio: 1;
          background: ${dialSurfaceBackground};
          border: 1px solid color-mix(in srgb, ${accentColor} 10%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 50%;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent),
            0 18px 38px rgba(0, 0, 0, 0.16);
          box-sizing: border-box;
          flex-shrink: 0;
          height: auto;
          max-width: 100%;
          position: relative;
          transform: translateZ(0) scale(1);
          transform-origin: center;
          transition:
            background 220ms cubic-bezier(0.22, 0.84, 0.26, 1),
            border-color 220ms cubic-bezier(0.22, 0.84, 0.26, 1),
            box-shadow 220ms cubic-bezier(0.22, 0.84, 0.26, 1),
            transform 220ms cubic-bezier(0.22, 0.84, 0.26, 1);
          width: min(var(--gauge-dial-size), 100%);
          -webkit-backdrop-filter: blur(18px);
          backdrop-filter: blur(18px);
        }

        .gauge-card__dial-svg {
          display: block;
          height: 100%;
          overflow: visible;
          width: 100%;
        }

        .gauge-card__dial-track,
        .gauge-card__dial-progress-segment {
          fill: none;
          stroke-width: ${dialStrokePx};
          transform: rotate(${DIAL_START_ANGLE}deg);
          transform-origin: ${DIAL_VIEWBOX_SIZE / 2}px ${DIAL_VIEWBOX_SIZE / 2}px;
        }

        .gauge-card__dial-track {
          stroke-dasharray: ${DIAL_VISIBLE_LENGTH} ${DIAL_HIDDEN_LENGTH};
          stroke-linecap: round;
          stroke: ${dialTrackColor};
        }

        .gauge-card__dial-progress-segment {
          filter: drop-shadow(0 0 0 transparent);
          opacity: 0;
          stroke-linecap: butt;
          transition:
            stroke var(--gauge-card-dial-duration) ease,
            stroke-dasharray var(--gauge-card-dial-duration) ease-out,
            opacity 180ms ease,
            filter 180ms ease,
            stroke-dashoffset 0ms linear;
        }

        .gauge-card__dial-progress-start {
          opacity: ${initialRatio > 0 ? "0.96" : "0"};
          transition:
            fill var(--gauge-card-dial-duration) ease,
            opacity 180ms ease;
        }

        .gauge-card__dial-thumb {
          background: transparent;
          border-radius: 50%;
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--primary-text-color) 4%, transparent),
            0 0 0 6px color-mix(in srgb, var(--primary-text-color) 5%, transparent),
            0 0 18px color-mix(in srgb, ${accentColor} 12%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.18);
          height: var(--gauge-thumb-size);
          left: var(--gauge-thumb-left, 50%);
          position: absolute;
          top: var(--gauge-thumb-top, 50%);
          transform: translate(-50%, -50%) scale(1);
          transition:
            left var(--gauge-card-dial-duration) ease-out,
            top var(--gauge-card-dial-duration) ease-out,
            transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1),
            border-color var(--gauge-card-dial-duration) ease,
            box-shadow var(--gauge-card-dial-duration) ease,
            background var(--gauge-card-dial-duration) ease;
          width: var(--gauge-thumb-size);
          z-index: 2;
        }

        .gauge-card__dial-thumb::before {
          -webkit-backdrop-filter: blur(16px);
          backdrop-filter: blur(16px);
          background: radial-gradient(circle, color-mix(in srgb, var(--primary-text-color) 14%, transparent) 0%, color-mix(in srgb, var(--primary-text-color) 8%, transparent) 38%, color-mix(in srgb, var(--primary-text-color) 3%, transparent) 58%, transparent 76%);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 50%;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          content: "";
          inset: 0;
          position: absolute;
        }

        .gauge-card__dial-thumb::after {
          background: rgba(255, 255, 255, 0.96);
          border-radius: 50%;
          content: "";
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          height: 82%;
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 82%;
        }

        .gauge-card__dial-center {
          align-content: center;
          display: grid;
          gap: ${compactLayout ? "8px" : "10px"};
          inset: ${compactLayout ? "28% 16% 24% 16%" : "26% 16% 24% 16%"};
          justify-items: center;
          position: absolute;
          text-align: center;
          transform: scale(1);
          transition:
            opacity 220ms cubic-bezier(0.22, 0.84, 0.26, 1),
            transform 220ms cubic-bezier(0.22, 0.84, 0.26, 1);
        }

        .gauge-card__name-chip {
          left: ${compactLayout ? "14px" : "16px"};
          max-width: ${effectiveNameChipMaxWidth};
          position: absolute;
          top: ${compactLayout ? "14px" : "16px"};
          z-index: 3;
        }

        .gauge-card__value {
          color: var(--primary-text-color);
          display: inline-block;
          font-size: ${effectiveValueSize};
          font-weight: 500;
          letter-spacing: -0.06em;
          line-height: 0.94;
          min-height: calc(${effectiveValueSize} * 0.94);
          min-width: 0;
          padding-right: ${unit ? `calc(${effectiveValueSize} * 0.34)` : "0"};
          position: relative;
          white-space: nowrap;
        }

        .gauge-card__value-unit {
          color: var(--primary-text-color);
          font-size: calc(${effectiveValueSize} * 0.24);
          font-weight: 500;
          line-height: 1;
          opacity: 0.92;
          position: absolute;
          right: 0;
          top: 0.16em;
        }

        .gauge-card__range-label {
          color: var(--secondary-text-color);
          font-size: ${effectiveRangeSize};
          font-weight: 600;
          line-height: 1;
          position: absolute;
          z-index: 2;
        }

        .gauge-card__range-label--min {
          bottom: ${compactLayout ? "-6px" : "-8px"};
          left: ${compactLayout ? "10px" : "14px"};
        }

        .gauge-card__range-label--max {
          bottom: ${compactLayout ? "-6px" : "-8px"};
          right: ${compactLayout ? "10px" : "14px"};
        }

        .gauge-card__bottom-icon {
          align-items: center;
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--primary-text-color) 8%, transparent), transparent 60%),
            ${styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent),
            0 10px 26px rgba(0, 0, 0, 0.16);
          color: ${styles.icon.color};
          display: inline-flex;
          height: ${compactLayout ? "42px" : "46px"};
          justify-content: center;
          left: 50%;
          bottom: ${compactLayout ? "36px" : "40px"};
          position: absolute;
          transform: translateX(-50%);
          width: ${compactLayout ? "42px" : "46px"};
          z-index: 3;
        }

        .gauge-card__bottom-icon ha-icon {
          --mdc-icon-size: ${compactLayout ? "20px" : "22px"};
          height: ${compactLayout ? "20px" : "22px"};
          width: ${compactLayout ? "20px" : "22px"};
        }

        @keyframes gauge-card-content-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.02);
          }
          72% {
            transform: scale(1.008);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes gauge-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.965);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes gauge-card-dial-bloom {
          0% {
            opacity: 0;
            transform: translateZ(0) scale(0.95);
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 2%, transparent),
              0 10px 24px rgba(0, 0, 0, 0.08);
          }
          55% {
            opacity: 1;
            transform: translateZ(0) scale(1.015);
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
              0 22px 42px rgba(0, 0, 0, 0.16);
          }
          100% {
            opacity: 1;
            transform: translateZ(0) scale(1);
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent),
              0 18px 38px rgba(0, 0, 0, 0.16);
          }
        }

        @keyframes gauge-card-dial-center-bloom {
          0% {
            opacity: 0;
            transform: scale(0.96);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes gauge-card-dial-thumb-pop {
          0% {
            transform: translate(-50%, -50%) scale(1);
          }
          48% {
            transform: translate(-50%, -50%) scale(1.22);
          }
          72% {
            transform: translate(-50%, -50%) scale(1.06);
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
          }
        }

        ${animations.enabled ? "" : `
        ha-card,
        .gauge-card,
        .gauge-card * {
          animation: none !important;
          transition: none !important;
        }
        `}

        @media (max-width: 560px) {
          .gauge-card__headline {
            grid-template-columns: minmax(0, 1fr);
          }

          .gauge-card__chips {
            justify-content: flex-start;
          }
        }
      </style>
      <ha-card class="gauge-card">
        <div class="gauge-card__content" ${this._canRunTapAction() ? 'data-gauge-action="primary"' : ""}>
          ${
            showHeader
              ? `
                <div class="gauge-card__hero ${shouldAnimateEntrance ? "gauge-card__hero--entering" : ""}">
                  ${
                    showIcon
                      ? `
                        <div class="gauge-card__icon">
                          <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
                          ${showUnavailableBadge ? `<span class="gauge-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                        </div>
                      `
                      : ""
                  }
                  <div class="gauge-card__copy">
                    <div class="gauge-card__headline">
                      ${showName ? `<div class="gauge-card__title">${escapeHtml(title)}</div>` : `<div></div>`}
                      ${chips.length ? `<div class="gauge-card__chips">${chips.join("")}</div>` : ""}
                    </div>
                  </div>
                </div>
              `
              : ""
          }

          ${
            !showHeader && showName && config.show_name_chip !== false
              ? `<div class="gauge-card__chip gauge-card__name-chip">${escapeHtml(title)}</div>`
              : ""
          }
          <div class="gauge-card__dial-wrap ${shouldAnimateEntrance ? "gauge-card__dial-wrap--entering" : ""}">
            <div
              class="gauge-card__dial"
              aria-hidden="true"
              style="--gauge-progress-length:${initialProgressLength};--gauge-thumb-left:${initialThumbPosition.left}%;--gauge-thumb-top:${initialThumbPosition.top}%;"
            >
              <svg class="gauge-card__dial-svg" viewBox="0 0 ${DIAL_VIEWBOX_SIZE} ${DIAL_VIEWBOX_SIZE}">
                <circle
                  class="gauge-card__dial-track"
                  cx="${DIAL_VIEWBOX_SIZE / 2}"
                  cy="${DIAL_VIEWBOX_SIZE / 2}"
                  r="${DIAL_CIRCLE_RADIUS}"
                ></circle>
                ${initialProgressSegments
                  .map((segment, index) => `
                    <circle
                      class="gauge-card__dial-progress-segment"
                      data-progress-segment="${index}"
                      cx="${DIAL_VIEWBOX_SIZE / 2}"
                      cy="${DIAL_VIEWBOX_SIZE / 2}"
                      r="${DIAL_CIRCLE_RADIUS}"
                      style="stroke:${sanitizeCssValue(segment.color, styles.gauge.max_tint_color)};stroke-dasharray:${segment.dasharray};stroke-dashoffset:${segment.dashoffset};opacity:${segment.opacity};"
                    ></circle>
                  `)
                  .join("")}
                <circle
                  class="gauge-card__dial-progress-start"
                  data-progress-start
                  cx="${dialStartCoordinates.x}"
                  cy="${dialStartCoordinates.y}"
                  r="${Number((dialStrokePx / 2).toFixed(3))}"
                  style="fill:${sanitizeCssValue(dialStartCapColor, styles.gauge.max_tint_color)};"
                ></circle>
              </svg>
              <span class="gauge-card__dial-thumb" aria-hidden="true"></span>
              ${
                config.show_range_labels !== false
                  ? `
                    <span class="gauge-card__range-label gauge-card__range-label--min">
                      ${escapeHtml(this._getRangeLabel("min", range, state))}
                    </span>
                    <span class="gauge-card__range-label gauge-card__range-label--max">
                      ${escapeHtml(this._getRangeLabel("max", range, state))}
                    </span>
                  `
                  : ""
              }
              ${
                config.show_bottom_icon_bubble === true && showIcon
                  ? `
                    <div class="gauge-card__bottom-icon">
                      <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
                    </div>
                  `
                  : ""
              }
              <div class="gauge-card__dial-center">
                <div class="gauge-card__value">
                  ${escapeHtml(this._formatValue(value, state, false))}
                  ${unit ? `<span class="gauge-card__value-unit">${escapeHtml(unit)}</span>` : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ha-card>
    `;

    if (this._gaugeVisualFrame) {
      window.cancelAnimationFrame(this._gaugeVisualFrame);
      this._gaugeVisualFrame = 0;
    }

    if (animations.enabled && (shouldAnimateEntrance || previousVisualState)) {
      const dial = this.shadowRoot.querySelector(".gauge-card__dial");
      if (dial instanceof HTMLElement) {
        this._gaugeVisualFrame = window.requestAnimationFrame(() => {
          const nextProgressSegments = this._getGaugeProgressSegments(ratio, tintScale);
          dial.querySelectorAll("[data-progress-segment]").forEach((segmentElement, index) => {
            const segment = nextProgressSegments[index];
            if (!(segmentElement instanceof SVGElement) || !segment) {
              return;
            }

            segmentElement.style.stroke = segment.color;
            segmentElement.style.strokeDasharray = segment.dasharray;
            segmentElement.style.strokeDashoffset = segment.dashoffset;
            segmentElement.style.opacity = String(segment.opacity);
          });

          const startCap = dial.querySelector("[data-progress-start]");
          if (startCap instanceof SVGElement) {
            startCap.style.fill = dialStartCapColor;
            startCap.style.opacity = ratio > 0 ? "0.96" : "0";
          }

          dial.style.setProperty("--gauge-progress-length", `${progressLength}`);
          dial.style.setProperty("--gauge-thumb-left", `${thumbPosition.left}%`);
          dial.style.setProperty("--gauge-thumb-top", `${thumbPosition.top}%`);
          this._gaugeVisualFrame = 0;
        });
      }
    }

    this._lastGaugeVisualState = {
      progressLength,
      ratio,
      thumbPosition,
    };

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 120);
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCircularGaugeCard);
}

class NodaliaCircularGaugeCardEditor extends HTMLElement {
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

        if (!this.isConnected || !this._hass || !this.shadowRoot) {
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
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id =>
      id.startsWith("sensor.") || id.startsWith("number.") || id.startsWith("input_number."),
    );
  }

  _getNumericEntityOptions() {
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => (
        entityId.startsWith("sensor.")
        || entityId.startsWith("number.")
        || entityId.startsWith("input_number.")
      ))
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
        left.label.localeCompare(right.label, sortLoc, { sensitivity: "base" })
        || left.value.localeCompare(right.value, sortLoc, { sensitivity: "base" })
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
      case "number": {
        const trimmed = String(input.value || "").trim();
        if (!trimmed) {
          return undefined;
        }

        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : trimmed;
      }
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      default:
        return input.value;
    }
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement);

    if (!input?.dataset?.field) {
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
    const tag = options.multiline ? "textarea" : "input";
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";
    const inputValue = value === undefined || value === null ? "" : String(value);

    if (tag === "textarea") {
      return `
        <label class="editor-field ${options.fullWidth !== false ? "editor-field--full" : ""}">
          <span>${escapeHtml(tLabel)}</span>
          <textarea data-field="${escapeHtml(field)}" data-value-type="${escapeHtml(valueType)}" rows="${options.rows || 2}" ${placeholder}>${escapeHtml(inputValue)}</textarea>
        </label>
      `;
    }

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
            <span class="editor-color-swatch" style="--editor-swatch:${escapeHtml(currentValue)};"></span>
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

  _renderSelectField(label, field, value, options) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field">
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

  _renderEntityField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
        ></div>
      </div>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="icon-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
        ></div>
      </div>
    `;
  }

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = ["sensor", "number", "input_number"];
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => {
        const entityId = String(stateObj?.entity_id || "");
        return entityId.startsWith("sensor.") || entityId.startsWith("number.") || entityId.startsWith("input_number.");
      };
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: {},
      };
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || this._editorLabel("ed.person.select_entity");
      control.appendChild(emptyOption);
      this._getNumericEntityOptions().forEach(option => {
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

  _mountIconPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "icon";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    let control = null;

    if (customElements.get("ha-icon-picker")) {
      control = document.createElement("ha-icon-picker");
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        icon: {},
      };
    } else {
      control = document.createElement("input");
      control.type = "text";
      control.placeholder = placeholder;
      control.addEventListener("input", this._onShadowInput);
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

    if (control.tagName !== "INPUT") {
      control.addEventListener("value-changed", this._onShadowValueChanged);
    }

    host.replaceChildren(control);
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";

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
        .editor-field select,
        .editor-field textarea,
        .editor-control-host input,
        .editor-control-host select,
        .editor-control-host textarea {
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

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
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
          height: 18px;
          width: 18px;
        }

        .editor-color-picker .editor-color-swatch {
          height: 22px;
          width: 22px;
        }

        @media (max-width: 640px) {
          .editor-grid {
            grid-template-columns: 1fr;
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
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.circular_gauge.general_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderEntityField("ed.circular_gauge.numeric_entity", "entity", config.entity, {
              placeholder: "sensor.enchufe_inteligente_potencia",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: this._editorLabel("ed.circular_gauge.name_placeholder_power"),
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, {
              placeholder: "mdi:flash",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.circular_gauge.unit", "unit", config.unit, {
              placeholder: "W",
            })}
            ${this._renderTextField("ed.circular_gauge.min_value", "min", config.min, {
              placeholder: "0",
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("ed.circular_gauge.max_value", "max", config.max, {
              placeholder: "2500",
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("ed.circular_gauge.label_min", "min_label", config.min_label, {
              placeholder: "0",
            })}
            ${this._renderTextField("ed.circular_gauge.label_max", "max_label", config.max_label, {
              placeholder: "∞",
            })}
            ${this._renderTextField("ed.entity.number_decimals", "decimals", config.decimals, {
              placeholder: "0",
              type: "number",
              valueType: "number",
            })}
            ${this._renderSelectField(
              "ed.entity.tap_action",
              "tap_action",
              config.tap_action || "more-info",
              [
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.media_player.layout_section"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.circular_gauge.layout_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.circular_gauge.grid_rows", "grid_options.rows", config.grid_options?.rows, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("ed.circular_gauge.grid_columns", "grid_options.columns", config.grid_options?.columns, {
              type: "number",
              valueType: "number",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.circular_gauge.visibility_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.circular_gauge.start_from_zero", "start_from_zero", config.start_from_zero !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_header", "show_header", config.show_header !== false)}
            ${this._renderCheckboxField("ed.person.show_name", "show_name", config.show_name !== false)}
            ${this._renderCheckboxField("ed.circular_gauge.show_name_chip", "show_name_chip", config.show_name_chip !== false)}
            ${this._renderCheckboxField("ed.circular_gauge.show_icon", "show_icon", config.show_icon !== false)}
            ${this._renderCheckboxField("ed.circular_gauge.percentage_chip", "show_percentage_chip", config.show_percentage_chip === true)}
            ${this._renderCheckboxField("ed.circular_gauge.range_labels", "show_range_labels", config.show_range_labels !== false)}
            ${this._renderCheckboxField("ed.circular_gauge.bottom_icon_bubble", "show_bottom_icon_bubble", config.show_bottom_icon_bubble === true)}
            ${this._renderCheckboxField("ed.media_player.show_unavailable_badge", "show_unavailable_badge", config.show_unavailable_badge !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.haptics_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.person.enable_haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("ed.entity.fallback_vibrate", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
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
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.circular_gauge.animations_hint"))}</div>
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
                  ${this._renderTextField("ed.circular_gauge.dial_duration_ms", "animations.dial_duration", config.animations.dial_duration, {
                    type: "number",
                    valueType: "number",
                  })}
                  ${this._renderTextField("ed.notifications.button_bounce_ms", "animations.button_bounce_duration", config.animations.button_bounce_duration, {
                    type: "number",
                    valueType: "number",
                  })}
                  ${this._renderTextField("ed.weather.content_entrance_ms", "animations.content_duration", config.animations.content_duration, {
                    type: "number",
                    valueType: "number",
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.circular_gauge.styles_hint"))}</div>
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
                  ${this._renderColorField("ed.person.style_card_bg", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("ed.person.style_card_border", "styles.card.border", config.styles.card.border)}
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
                  ${this._renderTextField("ed.person.style_card_shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("ed.person.style_card_padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("ed.person.style_card_gap", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderTextField("ed.circular_gauge.entity_bubble_size", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderColorField("ed.entity.style_main_bubble_bg", "styles.icon.background", config.styles.icon.background, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
                  })}
                  ${this._renderColorField("ed.circular_gauge.bubble_icon_color", "styles.icon.color", config.styles.icon.color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderTextField("ed.person.style_title_size", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("ed.circular_gauge.value_size", "styles.value_size", config.styles.value_size)}
                  ${this._renderTextField("ed.circular_gauge.range_size", "styles.range_size", config.styles.range_size)}
                  ${this._renderTextField("ed.circular_gauge.name_chip_max_width", "styles.name_chip_max_width", config.styles.name_chip_max_width)}
                  ${this._renderTextField("ed.circular_gauge.dial_size", "styles.gauge.size", config.styles.gauge.size)}
                  ${this._renderTextField("ed.circular_gauge.dial_stroke", "styles.gauge.stroke", config.styles.gauge.stroke)}
                  ${this._renderTextField("ed.circular_gauge.thumb_size", "styles.gauge.thumb_size", config.styles.gauge.thumb_size)}
                  ${this._renderColorField("ed.circular_gauge.dial_background", "styles.gauge.background", config.styles.gauge.background, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 2%, transparent)",
                  })}
                  ${this._renderColorField("ed.circular_gauge.min_tint", "styles.gauge.min_tint_color", config.styles.gauge.min_tint_color, {
                    fallbackValue: DEFAULT_GAUGE_MIN_TINT_COLOR,
                  })}
                  ${this._renderColorField("ed.circular_gauge.max_tint", "styles.gauge.max_tint_color", config.styles.gauge.max_tint_color, {
                    fallbackValue: DEFAULT_GAUGE_MAX_TINT_COLOR,
                  })}
                  ${this._renderColorField("ed.circular_gauge.fixed_gauge_color", "styles.gauge.foreground_color", config.styles.gauge.foreground_color, {
                    fallbackValue: DEFAULT_GAUGE_MAX_TINT_COLOR,
                  })}
                  ${this._renderColorField("ed.circular_gauge.track_color", "styles.gauge.track_color", config.styles.gauge.track_color, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 24%, var(--ha-card-background))",
                  })}
                  ${this._renderTextField("ed.person.style_chip_height", "styles.chip_height", config.styles.chip_height)}
                  ${this._renderTextField("ed.person.style_chip_font", "styles.chip_font_size", config.styles.chip_font_size)}
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
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="entity-picker"]')
      .forEach(host => this._mountEntityPicker(host));

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="icon-picker"]')
      .forEach(host => this._mountIconPicker(host));

    this._ensureEditorControlsReady();
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCircularGaugeCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Circular Gauge Card",
  description: "Tarjeta circular para sensores y valores numericos con estetica Nodalia.",
  preview: true,
});
