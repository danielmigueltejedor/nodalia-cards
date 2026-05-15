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

  function ensureCustomCardsDeduped() {
    if (typeof window === "undefined") {
      return null;
    }
    window.customCards = dedupeCustomCardsArray(window.customCards || []);
    return window.customCards;
  }

  /**
   * Registers one Lovelace custom card entry, replacing any prior entry with the same `type`.
   * Uses normal array `push` (no monkey-patch on `window.customCards`) so we stay compatible with
   * other front-end code that may also touch the shared array.
   */
  function registerCustomCard(metadata) {
    if (typeof window === "undefined" || !metadata || typeof metadata !== "object") {
      return;
    }
    const cards = ensureCustomCardsDeduped();
    if (!cards) {
      return;
    }
    const type = String(metadata.type || "").trim();
    if (type) {
      for (let index = cards.length - 1; index >= 0; index -= 1) {
        if (String(cards[index]?.type || "").trim() === type) {
          cards.splice(index, 1);
        }
      }
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

    /** Match capture + passive flags used on add (required for removeEventListener). */
    function clearWindowListeners() {
      window.removeEventListener("pointerup", onWindowPointerUp, true);
      window.removeEventListener("pointercancel", onWindowPointerUp, true);
      window.removeEventListener("pointermove", onWindowPointerMove, { capture: true });
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
      /** Drop stale tracking before zone checks so a lost `pointerup` (e.g. HA dialog stopping propagation on bubble) cannot brick the next hold. */
      resetTracking();
      const zone = options.resolveZone(ev);
      if (!zone) {
        return;
      }
      if (shouldBeginHold(zone, ev) !== true) {
        return;
      }
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
      /** Capture on `window` so `pointerup` / `pointercancel` still run if a modal stops bubbling before the default target phase reaches `window`. */
      window.addEventListener("pointerup", onWindowPointerUp, true);
      window.addEventListener("pointercancel", onWindowPointerUp, true);
      window.addEventListener("pointermove", onWindowPointerMove, { passive: true, capture: true });
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
    ensureCustomCardsDeduped();
    window.NodaliaUtils = api;
  }
})();

// </nodalia-standalone-utils>

const CARD_TAG = "nodalia-insignia-card";
const EDITOR_TAG = "nodalia-insignia-card-editor";
const CARD_VERSION = "1.1.1";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  icon_active: "",
  icon_inactive: "",
  use_entity_icon: false,
  use_entity_picture: false,
  state_attribute: "",
  tap_action: "auto",
  tap_service: "",
  tap_service_data: "",
  tap_url: "",
  tap_new_tab: false,
  hold_action: "more-info",
  hold_service: "",
  hold_service_data: "",
  hold_url: "",
  hold_new_tab: false,
  show_name: true,
  show_value: true,
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      border_radius: "999px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "4px 8px",
      gap: "8px",
    },
    icon: {
      size: "26px",
      background: "color-mix(in srgb, var(--primary-text-color) 5%, transparent)",
      on_color: "var(--info-color, #71c0ff)",
      off_color: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
      icon_only_offset_y: "0",
    },
    tint: {
      color: "var(--info-color, #71c0ff)",
    },
    title_size: "12px",
    value_size: "12px",
  },
  tint_auto: true,
};

const STUB_CONFIG = {
  entity: "sensor.temperatura_salon",
  name: "Salon",
  show_name: true,
  show_value: true,
  tap_action: "more-info",
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
    if (!isObject(cursor[key])) {
      cursor[key] = {};
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
    if (!isObject(cursor[key])) {
      return;
    }
    cursor = cursor[key];
  }
  delete cursor[parts[parts.length - 1]];
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

function normalizeTintPreset(value) {
  const key = normalizeTextKey(value);
  if (!key) {
    return "";
  }

  const map = {
    grey: "gray",
    light_grey: "gray",
    light_gray: "gray",
    red: "red",
    orange: "orange",
    yellow: "yellow",
    green: "green",
    blue: "blue",
    purple: "purple",
    pink: "pink",
    teal: "teal",
    gray: "gray",
    auto: "auto",
  };

  return map[key] || key;
}

function getTintPresetColor(preset) {
  const presets = {
    red: "#ff6b6b",
    orange: "#f6b04d",
    yellow: "#f2c94c",
    green: "#83d39c",
    blue: "#4da3ff",
    purple: "#b59dff",
    pink: "#ff8fd1",
    teal: "#7fd0c8",
    gray: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
  };
  return presets[preset] || presets.blue;
}

function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

function getEntityDomain(state) {
  const entityId = String(state?.entity_id || "");
  return entityId.includes(".") ? entityId.split(".")[0] : "";
}

function getDynamicEntityIcon(state) {
  if (!state) {
    return "";
  }

  const domain = getEntityDomain(state);
  const stateKey = normalizeTextKey(state.state);
  const deviceClass = normalizeTextKey(state.attributes?.device_class);

  if (domain === "binary_sensor") {
    switch (deviceClass) {
      case "door":
      case "opening":
        return stateKey === "on" ? "mdi:door-open" : "mdi:door-closed";
      case "window":
        return stateKey === "on" ? "mdi:window-open-variant" : "mdi:window-closed-variant";
      case "motion":
        return stateKey === "on" ? "mdi:motion-sensor" : "mdi:motion-sensor-off";
      case "occupancy":
      case "presence":
      case "person":
        return stateKey === "on" ? "mdi:account" : "mdi:account-off-outline";
      case "smoke":
        return stateKey === "on" ? "mdi:smoke-detector-alert" : "mdi:smoke-detector-variant";
      default:
        break;
    }
  }

  if (domain === "light") {
    return stateKey === "on" ? "mdi:lightbulb" : "mdi:lightbulb-off";
  }

  if (domain === "switch") {
    return stateKey === "on" ? "mdi:toggle-switch-variant" : "mdi:toggle-switch-variant-off";
  }

  if (domain === "fan") {
    return stateKey === "on" ? "mdi:fan" : "mdi:fan-off";
  }

  if (domain === "humidifier") {
    return stateKey === "on" ? "mdi:air-humidifier" : "mdi:air-humidifier-off";
  }

  if (domain === "lock") {
    return stateKey === "unlocked" ? "mdi:lock-open-variant" : "mdi:lock";
  }

  if (domain === "person") {
    return "mdi:account";
  }

  return state.attributes?.icon || "";
}

function formatNumericString(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const numeric = Number(raw.replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return raw;
  }

  if (Number.isInteger(numeric)) {
    return String(numeric);
  }

  return raw
    .replace(/(\.\d*?[1-9])0+$/g, "$1")
    .replace(/\.0+$/g, "");
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
  const defaults = DEFAULT_CONFIG.styles;
  const card = styles?.card || {};
  const icon = styles?.icon || {};
  const tint = styles?.tint || {};

  return {
    card: {
      background: sanitizeCssValue(card.background, defaults.card.background),
      border: sanitizeCssValue(card.border, defaults.card.border),
      border_radius: sanitizeCssValue(card.border_radius, defaults.card.border_radius),
      box_shadow: sanitizeCssValue(card.box_shadow, defaults.card.box_shadow),
      gap: sanitizeCssValue(card.gap, defaults.card.gap),
      padding: sanitizeCssValue(card.padding, defaults.card.padding),
    },
    icon: {
      background: sanitizeCssValue(icon.background, defaults.icon.background),
      icon_only_offset_y: sanitizeCssValue(icon.icon_only_offset_y, defaults.icon.icon_only_offset_y),
      off_color: sanitizeCssValue(icon.off_color, defaults.icon.off_color),
      on_color: sanitizeCssValue(icon.on_color, defaults.icon.on_color),
      size: sanitizeCssValue(icon.size, defaults.icon.size),
    },
    tint: {
      color: sanitizeCssValue(tint.color, defaults.tint.color),
    },
    title_size: sanitizeCssValue(styles?.title_size, defaults.title_size),
    value_size: sanitizeCssValue(styles?.value_size, defaults.value_size),
  };
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatEditorHexChannel(value) {
  return clampNumber(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function resolveEditorColorValue(value) {
  const resolver = window.NodaliaBubbleContrast?.resolveEditorColorValue;
  if (typeof resolver === "function") {
    return resolver(value);
  }
  return String(value ?? "").trim();
}

function formatEditorColorFromHex(hex, alpha = 1) {
  const normalizedHex = String(hex ?? "").trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(normalizedHex)) {
    return String(hex ?? "");
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  const safeAlpha = clampNumber(Number(alpha), 0, 1);
  if (safeAlpha >= 0.999) {
    return `#${normalizedHex}`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${Number(safeAlpha.toFixed(2))})`;
}

function getEditorColorModel(value, fallbackValue = "#71c0ff") {
  const sourceValue = String(value ?? "").trim() || String(fallbackValue ?? "").trim() || "#71c0ff";
  const resolvedValue = resolveEditorColorValue(sourceValue) || resolveEditorColorValue(fallbackValue) || "rgb(113, 192, 255)";
  const channels = resolvedValue.match(/[\d.]+/g) || [];
  const red = clampNumber(Math.round(Number(channels[0] ?? 113)), 0, 255);
  const green = clampNumber(Math.round(Number(channels[1] ?? 192)), 0, 255);
  const blue = clampNumber(Math.round(Number(channels[2] ?? 255)), 0, 255);
  const alpha = channels.length > 3 ? clampNumber(Number(channels[3]), 0, 1) : 1;
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

  if (normalizedField.endsWith("tint.color")) {
    return "var(--info-color, #71c0ff)";
  }

  if (normalizedField.endsWith("off_color")) {
    return "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))";
  }

  if (normalizedField.endsWith("background")) {
    return "color-mix(in srgb, var(--primary-text-color) 6%, transparent)";
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

function normalizeConfig(rawConfig) {
  const merged = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const legacyPreset = normalizeTintPreset(rawConfig?.tint_preset || rawConfig?.color);
  if (legacyPreset === "auto") {
    merged.tint_auto = true;
  } else if (legacyPreset) {
    merged.tint_auto = false;
    if (!rawConfig?.styles?.tint?.color) {
      merged.styles.tint.color = getTintPresetColor(legacyPreset);
    }
  }
  const HOLD_ACTIONS = new Set(["auto", "toggle", "more-info", "service", "navigate", "url", "none"]);
  const h = String(merged.hold_action ?? "none").trim().toLowerCase();
  merged.hold_action = HOLD_ACTIONS.has(h) ? h : "none";
  merged.hold_service = String(merged.hold_service ?? "").trim();
  merged.hold_service_data = String(merged.hold_service_data ?? "").trim();
  merged.hold_url = String(merged.hold_url ?? "").trim();
  merged.hold_new_tab = merged.hold_new_tab === true;
  return merged;
}

class NodaliaInsigniaCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["sensor", "binary_sensor"]);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._suppressNextInsigniaTap = false;
    this._onClick = this._onClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot.addEventListener("click", this._onClick);
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const trigger = event
                .composedPath()
                .find(node => node instanceof HTMLElement && node.dataset?.insigniaAction === "primary");
              return trigger ? "primary" : null;
            },
            shouldBeginHold: () => this._resolveInsigniaHoldAction() !== "none",
            onHold: () => {
              this._handlePrimaryHoldAction();
            },
            markHoldConsumedClick: () => {
              this._suppressNextInsigniaTap = true;
            },
          })
        : () => {};
  }

  disconnectedCallback() {
    this._detachHostHold?.();
    this.shadowRoot.removeEventListener("click", this._onClick);
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._lastRenderSignature = "";
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

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 1,
      min_columns: 1,
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
      attrValue: this._config?.state_attribute ? String(attrs[this._config.state_attribute] ?? "") : "",
      config: this._config,
    });
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

  _getResolvedName(state) {
    return this._config.name
      || state?.attributes?.friendly_name
      || this._config.entity
      || "Insignia";
  }

  _getResolvedValue(state) {
    if (this._config.state_attribute) {
      const attrValue = state?.attributes?.[this._config.state_attribute];
      return attrValue === undefined || attrValue === null ? "" : formatNumericString(attrValue);
    }

    if (!state) {
      return "";
    }

    const unit = String(state.attributes?.unit_of_measurement || "").trim();
    const formatted = formatNumericString(state.state);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  _isActiveState(state) {
    const stateKey = normalizeTextKey(state?.state);

    if (!stateKey || ["off", "closed", "locked", "unavailable", "unknown", "none", "idle", "standby"].includes(stateKey)) {
      return false;
    }

    return true;
  }

  _getResolvedIcon(state) {
    const trimIcon = value => (typeof value === "string" ? value.trim() : "");
    const iconActive = trimIcon(this._config?.icon_active);
    const iconInactive = trimIcon(this._config?.icon_inactive);

    if (iconActive || iconInactive) {
      const chosen = this._isActiveState(state) ? iconActive : iconInactive;
      if (chosen) {
        return chosen;
      }
    }

    if (this._config.use_entity_icon) {
      return getDynamicEntityIcon(state) || trimIcon(this._config?.icon) || "mdi:star-four-points-circle";
    }

    return trimIcon(this._config?.icon) || state?.attributes?.icon || "mdi:star-four-points-circle";
  }

  _getResolvedPicture(state) {
    if (!this._config.use_entity_picture) {
      return "";
    }

    const picture = state?.attributes?.entity_picture;
    return picture ? String(picture) : "";
  }

  _evaluateVisibility() {
    const rules = Array.isArray(this._config?.visibility) ? this._config.visibility : [];
    if (!rules.length) {
      return true;
    }

    for (const rule of rules) {
      if (!rule || rule.condition !== "template") {
        continue;
      }
      const rawValue = String(rule.value ?? "").trim();
      const hasDrawerLogic = rawValue.includes("drawer")
        || rawValue.includes("mdc-drawer")
        || rawValue.includes("hass-toggle-menu");
      if (hasDrawerLogic) {
        const main = document
          .querySelector("body > home-assistant")
          ?.shadowRoot?.querySelector("home-assistant-main");
        const drawer =
          main?.shadowRoot?.querySelector("ha-drawer") ||
          main?.shadowRoot?.querySelector("[drawer]") ||
          main?.shadowRoot?.querySelector(".mdc-drawer");
        const isOpen =
          drawer?.opened === true ||
          drawer?.open === true ||
          drawer?.hasAttribute?.("open") ||
          drawer?.classList?.contains("mdc-drawer--open");
        if (isOpen) {
          return false;
        }
        continue;
      }
    }

    return true;
  }

  _isActive(state) {
    const stateKey = normalizeTextKey(state?.state);
    if (!state) {
      return false;
    }

    return ["on", "home", "playing", "heat", "cool", "dry", "fan_only", "open", "unlocked"].includes(stateKey);
  }

  /**
   * Match Entity card–level tint strength: numeric sensors (temperature, etc.) are never "active"
   * but should still read a clear semantic tint; manual tint mode always wins visibility.
   */
  _shouldApplyStrongCardTint(state) {
    if (!state) {
      return false;
    }
    if (this._config?.tint_auto === false) {
      return true;
    }
    if (this._isActive(state)) {
      return true;
    }
    const domain = getEntityDomain(state);
    return domain === "sensor" || domain === "weather";
  }

  _shouldDimIcon(state) {
    if (!state) {
      return false;
    }

    const domain = getEntityDomain(state);
    if (["sensor", "input_number", "input_datetime", "input_text", "number"].includes(domain)) {
      return false;
    }

    return [
      "light",
      "switch",
      "fan",
      "humidifier",
      "binary_sensor",
      "alarm_control_panel",
      "lock",
      "cover",
      "media_player",
      "vacuum",
      "input_boolean",
      "device_tracker",
      "person",
    ].includes(domain);
  }

  _getTintColor(state) {
    if (this._config?.tint_auto === false) {
      return sanitizeCssValue(this._config?.styles?.tint?.color, DEFAULT_CONFIG.styles.tint.color);
    }

    const domain = getEntityDomain(state);
    const stateKey = normalizeTextKey(state?.state);
    const deviceClass = normalizeTextKey(state?.attributes?.device_class);
    const rawUnit = String(state?.attributes?.unit_of_measurement || "").trim().toLowerCase();
    const unit = normalizeTextKey(rawUnit);

    if (domain === "light") {
      return stateKey === "on" ? "var(--warning-color, #f6b04d)" : "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))";
    }
    if (domain === "fan") {
      return "var(--info-color, #71c0ff)";
    }
    if (domain === "humidifier") {
      return "#7fd0c8";
    }
    if (domain === "person") {
      return "#83d39c";
    }
    if (domain === "alarm_control_panel") {
      return "#b59dff";
    }
    if (domain === "weather") {
      return "#8fc9ff";
    }
    if (domain === "sensor") {
      if (deviceClass === "temperature" || unit === "c" || rawUnit.includes("°c") || rawUnit.includes("degc")) {
        return "#ff6b6b";
      }
      if (deviceClass === "humidity" || rawUnit.includes("%") || unit === "percent") {
        return "#4da3ff";
      }
    }

    return "var(--info-color, #71c0ff)";
  }

  _isServiceAllowed(serviceValue) {
    const security = this._config?.security || {};
    if (security.strict_service_actions === false) {
      return true;
    }
    const normalizedService = String(serviceValue || "").trim().toLowerCase();
    if (!normalizedService || !normalizedService.includes(".")) {
      return false;
    }
    const [domain] = normalizedService.split(".");
    const domains = Array.isArray(security.allowed_service_domains)
      ? security.allowed_service_domains.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    const services = Array.isArray(security.allowed_services)
      ? security.allowed_services.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    if (!domains.length && !services.length) {
      return false;
    }
    return services.includes(normalizedService) || domains.includes(domain);
  }

  _onClick(event) {
    const trigger = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.insigniaAction === "primary");

    if (!trigger) {
      return;
    }

    if (this._suppressNextInsigniaTap) {
      this._suppressNextInsigniaTap = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._handlePrimaryAction();
  }

  _resolveInsigniaHoldAction() {
    const state = this._getState();
    const action = String(this._config?.hold_action || "none").trim().toLowerCase();
    if (action === "none") {
      return "none";
    }
    if (action === "auto") {
      return state && this._config?.entity ? "more-info" : "none";
    }
    if (action === "more-info") {
      return this._config?.entity ? "more-info" : "none";
    }
    if (action === "toggle") {
      return this._config?.entity ? "toggle" : "none";
    }
    if (action === "service") {
      return String(this._config?.hold_service || "").trim() ? "service" : "none";
    }
    if (action === "navigate") {
      return String(this._config?.hold_url || "").trim() ? "navigate" : "none";
    }
    if (action === "url") {
      return String(this._config?.hold_url || "").trim() ? "url" : "none";
    }
    return "none";
  }

  _handlePrimaryHoldAction() {
    const state = this._getState();
    const action = String(this._config?.hold_action || "none").trim().toLowerCase();
    const navigationPath = this._config.hold_url;

    if (action === "none") {
      return;
    }

    this._triggerHaptic();

    if (action === "more-info" || (action === "auto" && state)) {
      fireEvent(this, "hass-more-info", { entityId: this._config.entity });
      return;
    }

    if (action === "toggle") {
      this._hass?.callService("homeassistant", "toggle", { entity_id: this._config.entity });
      return;
    }

    if (action === "service" && this._config.hold_service) {
      if (!this._isServiceAllowed(this._config.hold_service)) {
        window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Insignia Card", this._config.hold_service);
        return;
      }
      const [domain, service] = this._config.hold_service.split(".");
      if (domain && service) {
        let serviceData = {};
        if (this._config.hold_service_data) {
          try {
            serviceData = JSON.parse(this._config.hold_service_data);
          } catch (_error) {
            serviceData = {};
          }
        }
        this._hass?.callService(domain, service, serviceData);
      }
      return;
    }

    if (action === "navigate" && navigationPath) {
      const path = navigationPath;
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
      return;
    }

    if (action === "url" && this._config.hold_url) {
      const safeUrl = window.NodaliaUtils?.sanitizeActionUrl(this._config.hold_url, { allowRelative: true });
      if (!safeUrl) {
        return;
      }
      if (this._config.hold_new_tab) {
        window.open(safeUrl, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = safeUrl;
      }
    }
  }

  _handlePrimaryAction() {
    const state = this._getState();
    const tapConfig = this._config.tap_action;
    const isObjectTap = isObject(tapConfig);
    const action = isObjectTap ? (tapConfig.action || "auto") : (tapConfig || "auto");
    const navigationPath = isObjectTap ? tapConfig.navigation_path : this._config.tap_url;

    if (action === "none") {
      return;
    }

    this._triggerHaptic();

    if (action === "more-info" || (action === "auto" && state)) {
      fireEvent(this, "hass-more-info", { entityId: this._config.entity });
      return;
    }

    if (action === "toggle") {
      this._hass?.callService("homeassistant", "toggle", { entity_id: this._config.entity });
      return;
    }

    if (action === "service" && this._config.tap_service) {
      if (!this._isServiceAllowed(this._config.tap_service)) {
        window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Insignia Card", this._config.tap_service);
        return;
      }
      const [domain, service] = this._config.tap_service.split(".");
      if (domain && service) {
        let serviceData = {};
        if (this._config.tap_service_data) {
          try {
            serviceData = JSON.parse(this._config.tap_service_data);
          } catch (_error) {
            serviceData = {};
          }
        }
        this._hass?.callService(domain, service, serviceData);
      }
      return;
    }

    if (action === "navigate" && navigationPath) {
      const path = navigationPath;
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
      return;
    }

    if (action === "url" && this._config.tap_url) {
      const safeUrl = window.NodaliaUtils?.sanitizeActionUrl(this._config.tap_url, { allowRelative: true });
      if (!safeUrl) {
        return;
      }
      if (this._config.tap_new_tab) {
        window.open(safeUrl, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = safeUrl;
      }
    }
  }

  _renderEmptyState() {
    return `
      <ha-card class="insignia-card insignia-card--empty">
        <div class="insignia-card__empty-title">Nodalia Insignia Card</div>
        <div class="insignia-card__empty-text">Configure \`entity\` or basic content to show the badge.</div>
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

    if (!state && !config.name && !config.icon) {
      this.removeAttribute("data-icon-only");
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; }
          * { box-sizing: border-box; }
          .insignia-card--empty {
            background: ${styles.card.background};
            border: ${styles.card.border};
            border-radius: ${styles.card.border_radius};
            box-shadow: ${styles.card.box_shadow};
            display: grid;
            gap: 6px;
            padding: ${styles.card.padding};
          }
          .insignia-card__empty-title {
            color: var(--primary-text-color);
            font-size: 14px;
            font-weight: 700;
          }
          .insignia-card__empty-text {
            color: var(--secondary-text-color);
            font-size: 12px;
            line-height: 1.45;
          }
        </style>
        ${this._renderEmptyState()}
      `;
      return;
    }

    const iconSizePx = Math.max(28, Math.min(parseSizeToPixels(styles.icon.size, 34), 40));
    const titleSize = `${Math.max(12, Math.min(parseSizeToPixels(styles.title_size, 13), 14))}px`;
    const valueSize = `${Math.max(12, Math.min(parseSizeToPixels(styles.value_size, 13), 14))}px`;
    const title = this._getResolvedName(state);
    const value = this._getResolvedValue(state);
    const icon = this._getResolvedIcon(state);
    const active = this._isActive(state);
    const dimIcon = this._shouldDimIcon(state);
    const tint = sanitizeCssValue(this._getTintColor(state), DEFAULT_CONFIG.styles.tint.color);
    const strongTint = this._shouldApplyStrongCardTint(state);
    const cardBackground = strongTint
      ? `linear-gradient(135deg, color-mix(in srgb, ${tint} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${tint} 10%, ${styles.card.background}) 52%, ${styles.card.background} 100%)`
      : styles.card.background;
    const cardBorder = strongTint
      ? `1px solid color-mix(in srgb, ${tint} 32%, var(--divider-color))`
      : styles.card.border;
    // Match Entity card elevation on full ha-cards; a second large drop shadow on compact
    // pill insignias reads as a flat gray “shelf” under the rounded bottom in toolbars.
    const cardShadow = strongTint
      ? `${styles.card.box_shadow}, inset 0 1px 0 color-mix(in srgb, ${tint} 28%, rgba(255, 255, 255, 0.35))`
      : styles.card.box_shadow;
    const unavailable = config.entity && isUnavailableState(state);
    const showName = config.show_name !== false;
    const showValue = config.show_value !== false && Boolean(value);
    const iconOnly = !showName && !showValue;
    const iconOnlyOffsetY = String(styles.icon?.icon_only_offset_y ?? DEFAULT_CONFIG.styles.icon.icon_only_offset_y);
    const pictureUrl = this._getResolvedPicture(state);
    const showPicture = Boolean(pictureUrl);
    const isVisible = this._evaluateVisibility();

    this.toggleAttribute("data-icon-only", iconOnly);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          line-height: 0;
          vertical-align: middle;
          box-sizing: border-box;
          /* Horizontal scroll rows often omit custom props; a non-zero default keeps pill + shadow inside the strip. */
          align-self: center;
          min-height: min-content;
          /* Scroll strips (header horizontal overflow) need block padding on every pill, not only icon-only,
             or the strip clips shadows and the bottom of the pill. Parent can set --insignia-scroll-strip-padding-block. */
          padding-block: var(
            --insignia-scroll-strip-padding-block,
            var(--insignia-scroll-strip-margin-block, 4px 6px)
          );
        }

        :host([data-icon-only]) {
          /* Same cross-axis behavior as non–icon-only pills (align-items: center on row).
             stretch forced full line height and skewed vertical center vs text pills + menu. */
          align-self: var(--insignia-icon-only-align-self, center);
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
          width: auto;
          min-height: min-content;
          transform: translateY(var(--insignia-icon-only-row-nudge, -2px));
          padding-block: var(
            --insignia-scroll-strip-padding-block,
            var(--insignia-scroll-strip-margin-block, 4px 8px)
          );
        }

        * {
          box-sizing: border-box;
        }

        .insignia-card {
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          display: inline-flex;
          height: auto;
          min-height: 0;
          isolation: isolate;
          position: relative;
          /* visible: overflow:hidden clipped card box-shadow and rounded bottom in horizontal scroll headers */
          overflow: visible;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .insignia-card--icon-only {
          border-radius: ${styles.card.border_radius};
          height: auto;
          width: fit-content;
          max-width: 100%;
        }

        .insignia-card::before {
          background: ${strongTint
      ? `linear-gradient(180deg, color-mix(in srgb, ${tint} 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`
      : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0))"};
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .insignia-card::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${tint} 26%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${tint} 16%, transparent) 0%, transparent 66%);
          border-radius: inherit;
          content: "";
          inset: 0;
          opacity: ${strongTint ? "1" : "0"};
          pointer-events: none;
          position: absolute;
          transition: opacity 180ms ease;
          z-index: 0;
        }

        .insignia-card__content {
          align-items: center;
          cursor: pointer;
          display: grid;
          gap: ${styles.card.gap};
          grid-template-columns: ${iconSizePx}px minmax(0, 1fr);
          padding: ${styles.card.padding};
          position: relative;
          z-index: 1;
        }

        /* Solo icono: misma fila / padding / gap que la píldora con texto; sin segunda columna (no forzar cuadrado). */
        .insignia-card--icon-only .insignia-card__content {
          grid-template-columns: min(${iconSizePx}px, 100%);
          width: fit-content;
          max-width: 100%;
        }

        .insignia-card__icon {
          align-items: center;
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--primary-text-color) 6%, transparent), transparent 60%),
            ${styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent),
            0 8px 20px rgba(0, 0, 0, 0.14);
          color: ${active ? styles.icon.on_color : (dimIcon ? styles.icon.off_color : "var(--primary-text-color)")};
          display: inline-flex;
          height: ${iconSizePx}px;
          justify-content: center;
          position: relative;
          width: ${iconSizePx}px;
        }

        .insignia-card__icon img {
          border-radius: inherit;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .insignia-card__icon ha-icon {
          --mdc-icon-size: ${Math.round(iconSizePx * 0.5)}px;
          height: ${Math.round(iconSizePx * 0.5)}px;
          width: ${Math.round(iconSizePx * 0.5)}px;
        }

        .insignia-card--icon-only .insignia-card__icon ha-icon {
          overflow: visible;
          position: relative;
          top: var(--icon-only-offset-y);
          transform: translateY(var(--insignia-icon-optical-y, -1px));
        }

        .insignia-card__copy {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 4px 8px;
          min-width: 0;
        }

        .insignia-card__title,
        .insignia-card__value {
          line-height: 1.15;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .insignia-card__title {
          color: var(--primary-text-color);
          font-size: ${titleSize};
          font-weight: 700;
        }

        .insignia-card__value {
          color: var(--primary-text-color);
          font-size: ${valueSize};
          font-weight: 600;
        }

        .insignia-card__dot {
          background: color-mix(in srgb, ${tint} 82%, white 18%);
          border-radius: 999px;
          box-shadow: 0 0 0 4px color-mix(in srgb, ${tint} 16%, transparent);
          flex: 0 0 auto;
          height: 7px;
          width: 7px;
        }

        .insignia-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          color: #ffffff;
          display: inline-flex;
          height: 16px;
          justify-content: center;
          position: absolute;
          right: -2px;
          top: -2px;
          width: 16px;
        }

        .insignia-card__unavailable-badge ha-icon {
          --mdc-icon-size: 10px;
          height: 10px;
          width: 10px;
        }
      </style>
      <div class="insignia-card ${iconOnly ? "insignia-card--icon-only" : ""}" style="--icon-only-offset-y: ${iconOnlyOffsetY}; ${isVisible ? "" : "display:none;"}">
        <div class="insignia-card__content" data-insignia-action="primary">
          <div class="insignia-card__icon">
            ${showPicture
              ? `<img src="${escapeHtml(pictureUrl)}" alt="${escapeHtml(title)}" />`
              : `<ha-icon icon="${escapeHtml(icon)}"></ha-icon>`
            }
            ${unavailable ? '<span class="insignia-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>' : ""}
          </div>
          ${iconOnly
            ? ""
            : `
          <div class="insignia-card__copy">
            ${showName ? `<div class="insignia-card__title">${escapeHtml(title)}</div>` : ""}
            ${showName && showValue ? '<span class="insignia-card__dot"></span>' : ""}
            ${showValue ? `<div class="insignia-card__value">${escapeHtml(value)}</div>` : ""}
          </div>
          `}
        </div>
      </div>
    `;
  }
}

class NodaliaInsigniaCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig({});
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showStyleSection = false;
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
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
    return window.NodaliaUtils.editorStatesSignature(hass, this._config?.language ?? "auto");
  }

  _watchEditorControlTag(tagName) {
    if (!tagName || this._pendingEditorControlTags.has(tagName)) {
      return;
    }

    if (typeof customElements?.whenDefined !== "function" || customElements.get(tagName)) {
      return;
    }

    this._pendingEditorControlTags.add(tagName);
    customElements
      .whenDefined(tagName)
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
    const selector = dataset.field ? `[data-field="${escapeSelectorValue(dataset.field)}"]` : null;

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
      case "csv": {
        const values = String(input.value || "")
          .split(",")
          .map(item => item.trim().toLowerCase())
          .filter(Boolean);
        return values.length ? values : "";
      }
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

    const nextValue =
      typeof event.detail?.value === "string" ? event.detail.value : control.value;
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

  _renderTextareaField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <textarea data-field="${escapeHtml(field)}" ${placeholder}>${escapeHtml(inputValue)}</textarea>
      </label>
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

  _renderSelectField(label, field, value, options, renderOptions = {}) {
    const tLabel = this._editorLabel(label);
    const strValue = String(value ?? "");
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options
            .map(
              option => `
            <option value="${escapeHtml(option.value)}" ${String(option.value) === strValue ? "selected" : ""}>
              ${escapeHtml(this._editorLabel(option.label))}
            </option>
          `,
            )
            .join("")}
        </select>
      </label>
    `;
  }

  _renderEntityPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
        ></div>
      </div>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const placeholderAttr = options.placeholder
      ? `data-placeholder="${escapeHtml(options.placeholder)}"`
      : "";
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="icon-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          ${placeholderAttr}
        ></div>
      </div>
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

  _mountEntityPicker(host) {
    window.NodaliaUtils.mountEntityPickerHost(host, {
      hass: this._hass,
      field: host.dataset.field || "entity",
      value: host.dataset.value || "",
      onShadowInput: this._onShadowInput,
      onShadowValueChanged: this._onShadowValueChanged,
      copyDatasetFromHost: true,
    });
  }

  _mountIconPicker(host) {
    window.NodaliaUtils.mountIconPickerHost(host, {
      hass: this._hass,
      value: host.dataset.value || "",
      placeholder: host.dataset.placeholder || "",
      onShadowInput: this._onShadowInput,
      onShadowValueChanged: this._onShadowValueChanged,
      copyDatasetFromHost: true,
    });
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const rawTap = config.tap_action;
    const tapAction = typeof rawTap === "string" ? rawTap : isObject(rawTap) ? String(rawTap.action || "auto") : "auto";
    const holdActionStr = typeof config.hold_action === "string" ? config.hold_action : "none";
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

        .editor-field:has(> .editor-control-host[data-mounted-control="entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="icon-picker"]) {
          grid-column: 1 / -1;
        }

        .editor-field > span,
        .editor-toggle > span {
          color: var(--secondary-text-color);
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
          min-height: 86px;
          resize: vertical;
        }

        .editor-color-field {
          align-items: center;
          display: flex;
          gap: 10px;
          min-height: 46px;
        }

        .editor-color-picker {
          align-items: center;
          appearance: none;
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

        .editor-toggle {
          align-items: center;
          column-gap: 10px;
          cursor: pointer;
          grid-auto-flow: column;
          grid-template-columns: auto minmax(0, 1fr);
          min-height: 40px;
          padding-top: 4px;
          position: relative;
        }

        .editor-toggle input {
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
          flex-shrink: 0;
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

        .editor-toggle input:checked + .editor-toggle__switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }

        .editor-toggle input:checked + .editor-toggle__switch::before {
          transform: translateX(18px);
        }

        .editor-toggle input:focus-visible + .editor-toggle__switch {
          box-shadow:
            0 0 0 3px color-mix(in srgb, var(--primary-text-color) 14%, transparent),
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }

        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.insignia.section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.insignia.section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityPickerField("ed.entity.entity_main", "entity", config.entity, {
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, {
              placeholder: "mdi:star-four-points-circle",
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.entity.icon_active", "icon_active", config.icon_active, {
              placeholder: "mdi:door-open",
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.entity.icon_inactive", "icon_inactive", config.icon_inactive, {
              placeholder: "mdi:door-closed",
              fullWidth: true,
            })}
            <div class="editor-section__hint editor-field--full" style="grid-column: 1 / -1; margin-top: -4px;">
              ${escapeHtml(this._editorLabel("ed.entity.icons_state_hint"))}
            </div>
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: this._editorLabel("ed.insignia.name_placeholder"),
              fullWidth: true,
            })}
            ${this._renderTextField("ed.fav.state_attribute_label", "state_attribute", config.state_attribute, {
              placeholder: "battery_level",
              fullWidth: true,
            })}
            <div class="editor-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
              ${this._renderCheckboxField("ed.entity.use_entity_icon", "use_entity_icon", config.use_entity_icon === true)}
              ${this._renderCheckboxField("ed.person.use_entity_picture", "use_entity_picture", config.use_entity_picture === true)}
              ${this._renderCheckboxField("ed.person.show_name", "show_name", config.show_name !== false)}
              ${this._renderCheckboxField("ed.insignia.show_value", "show_value", config.show_value !== false)}
            </div>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.person.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.insignia.haptics_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderCheckboxField("ed.person.enable_haptics", "haptics.enabled", config.haptics?.enabled === true)}
            ${this._renderCheckboxField("ed.entity.fallback_vibrate", "haptics.fallback_vibrate", config.haptics?.fallback_vibrate === true)}
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
              { fullWidth: true },
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.insignia.tap_actions_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderSelectField(
              "ed.entity.action_type",
              "tap_action",
              tapAction,
              [
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "navigate", label: "ed.vacuum.tap_navigate" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${
              tapAction === "service"
                ? `
                  ${this._renderTextField("ed.entity.tap_service_field", "tap_service", config.tap_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.tap_service_data_json", "tap_service_data", config.tap_service_data, {
                    placeholder: '{"brightness_pct": 50}',
                  })}
                `
                : ""
            }
            ${
              tapAction === "navigate"
                ? this._renderTextField("ed.insignia.panel_path", "tap_url", config.tap_url, {
                    placeholder: "/lovelace/0",
                    fullWidth: true,
                  })
                : ""
            }
            ${
              tapAction === "url"
                ? `
                  ${this._renderTextField("ed.entity.tap_url_field", "tap_url", config.tap_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.tap_new_tab", "tap_new_tab", config.tap_new_tab === true)}
                `
                : ""
            }
            ${
              tapAction === "service" || holdActionStr === "service"
                ? `
                  ${this._renderCheckboxField(
                    "ed.entity.security_strict",
                    "security.strict_service_actions",
                    config.security?.strict_service_actions !== false,
                  )}
                  ${
                    config.security?.strict_service_actions !== false
                      ? this._renderTextField(
                          "ed.entity.allowed_services_csv",
                          "security.allowed_services",
                          Array.isArray(config.security?.allowed_services) ? config.security.allowed_services.join(", ") : "",
                          {
                            placeholder: "browser_mod.javascript, light.turn_on",
                            valueType: "csv",
                            fullWidth: true,
                          },
                        )
                      : ""
                  }
                `
                : ""
            }
            <div class="editor-section__hint editor-field--full" style="margin-top: 8px;">${escapeHtml(this._editorLabel("ed.insignia.hold_section_hint"))}</div>
            ${this._renderSelectField(
              "ed.insignia.hold_action",
              "hold_action",
              holdActionStr,
              [
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "navigate", label: "ed.vacuum.tap_navigate" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${
              holdActionStr === "service"
                ? `
                  ${this._renderTextField("ed.entity.hold_service_field", "hold_service", config.hold_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.hold_service_data_json", "hold_service_data", config.hold_service_data, {
                    placeholder: '{"brightness_pct": 50}',
                  })}
                `
                : ""
            }
            ${
              holdActionStr === "navigate"
                ? this._renderTextField("ed.insignia.panel_path", "hold_url", config.hold_url, {
                    placeholder: "/lovelace/0",
                    fullWidth: true,
                  })
                : ""
            }
            ${
              holdActionStr === "url"
                ? `
                  ${this._renderTextField("ed.entity.hold_url_field", "hold_url", config.hold_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.hold_new_tab", "hold_new_tab", config.hold_new_tab === true)}
                `
                : ""
            }
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.styles_section_hint"))}</div>
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
            <div class="editor-grid editor-grid--stacked">
              ${this._renderCheckboxField("ed.insignia.tint_auto", "tint_auto", config.tint_auto !== false)}
              ${this._renderColorField("ed.insignia.manual_tint_color", "styles.tint.color", config.styles?.tint?.color || DEFAULT_CONFIG.styles.tint.color, { fullWidth: true })}
              ${this._renderTextField("ed.entity.style_main_button_size", "styles.icon.size", config.styles?.icon?.size || DEFAULT_CONFIG.styles.icon.size)}
              ${this._renderTextField("ed.person.style_title_size", "styles.title_size", config.styles?.title_size || DEFAULT_CONFIG.styles.title_size)}
              ${this._renderTextField("ed.circular_gauge.value_size", "styles.value_size", config.styles?.value_size || DEFAULT_CONFIG.styles.value_size)}
              ${this._renderTextField("ed.person.style_card_padding", "styles.card.padding", config.styles?.card?.padding || DEFAULT_CONFIG.styles.card.padding)}
              ${this._renderTextField("ed.person.style_card_gap", "styles.card.gap", config.styles?.card?.gap || DEFAULT_CONFIG.styles.card.gap)}
              ${this._renderTextField("ed.insignia.icon_only_offset_y", "styles.icon.icon_only_offset_y", config.styles?.icon?.icon_only_offset_y || DEFAULT_CONFIG.styles.icon.icon_only_offset_y)}
              ${this._renderColorField("ed.entity.style_main_bubble_bg", "styles.icon.background", config.styles?.icon?.background || DEFAULT_CONFIG.styles.icon.background, { fullWidth: true })}
              ${this._renderColorField("ed.entity.style_icon_on", "styles.icon.on_color", config.styles?.icon?.on_color || DEFAULT_CONFIG.styles.icon.on_color, { fullWidth: true })}
              ${this._renderColorField("ed.entity.style_icon_off", "styles.icon.off_color", config.styles?.icon?.off_color || DEFAULT_CONFIG.styles.icon.off_color, { fullWidth: true })}
            </div>
          `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot.querySelectorAll('[data-mounted-control="entity"]').forEach(host => this._mountEntityPicker(host));
    this.shadowRoot.querySelectorAll('[data-mounted-control="icon-picker"]').forEach(host => this._mountIconPicker(host));

    this._ensureEditorControlsReady();
  }
}


if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaInsigniaCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaInsigniaCardEditor);
}

if (Array.isArray(window.customCards)) {
  for (let index = window.customCards.length - 1; index >= 0; index -= 1) {
    if (window.customCards[index]?.type === CARD_TAG) {
      window.customCards.splice(index, 1);
    }
  }
}

window.customBadges = window.customBadges || [];
if (!window.customBadges.some(item => item?.type === CARD_TAG)) {
  window.customBadges.push({
    type: CARD_TAG,
    name: "Nodalia Insignia",
    preview: true,
    description: "Insignia compacta estilo chip burbuja para usar en la zona de badges.",
    documentationURL: "https://developers.home-assistant.io/docs/frontend/custom-ui/custom-badge/",
  });
}
