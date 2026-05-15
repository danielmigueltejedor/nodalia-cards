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

const CARD_TAG = "nodalia-light-card";
const EDITOR_TAG = "nodalia-light-card-editor";
const CARD_VERSION = "1.1.1-alpha.3";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
const COMPACT_LAYOUT_THRESHOLD = 150;
const OPTIMISTIC_TURN_ON_TIMEOUT = 3200;
const OPTIMISTIC_TURN_OFF_TIMEOUT = 3200;
const OPTIMISTIC_VISUAL_SETTLE_MS = 420;
const LIGHT_MEMORY_STORAGE_KEY = "nodalia-light-card:last-visual-state:v1";
const COLOR_PRESETS = [
  { color: "#ffd166", hs: [42, 60], label: "Warm" },
  { color: "#fff1c1", hs: [48, 18], label: "Soft" },
  { color: "#ff7f50", hs: [16, 72], label: "Sunset" },
  { color: "#ff4d6d", hs: [348, 70], label: "Pink" },
  { color: "#4dabf7", hs: [210, 70], label: "Blue" },
  { color: "#38d9a9", hs: [160, 68], label: "Mint" },
];

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  entity_picture: "",
  show_entity_picture: false,
  show_state: false,
  state_position: "right",
  compact_layout_mode: "auto",
  auto_expand: true,
  show_brightness: true,
  show_slider_mode_buttons: true,
  show_quick_brightness: true,
  show_color_controls: true,
  show_temperature_controls: true,
  quick_brightness: [10, 35, 65, 100],
  tap_action: "toggle",
  tap_service: "",
  tap_service_data: "",
  tap_url: "",
  tap_new_tab: false,
  icon_tap_action: "toggle",
  icon_tap_service: "",
  icon_tap_service_data: "",
  icon_tap_url: "",
  icon_tap_new_tab: false,
  hold_action: "more-info",
  hold_service: "",
  hold_service_data: "",
  hold_url: "",
  hold_new_tab: false,
  icon_hold_action: "",
  icon_hold_service: "",
  icon_hold_service_data: "",
  icon_hold_url: "",
  icon_hold_new_tab: false,
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    power_duration: 600,
    controls_duration: 600,
    mode_switch_duration: 600,
    button_bounce_duration: 320,
    mode_switch_horizontal: true,
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
      on_color: "var(--warning-color, #f6b73c)",
      off_color: "var(--primary-text-color)",
    },
    control: {
      size: "36px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(var(--rgb-primary-color), 0.18)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    title_size: "12px",
    slider_wrap_height: "56px",
    slider_height: "16px",
    slider_thumb_size: "28px",
    slider_color: "var(--primary-color)",
  },
};

const STUB_CONFIG = {
  entity: "light.salon",
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

function isUnavailableState(state) {
  return String(state?.state || "").toLowerCase() === "unavailable";
}

function rgbToHs(rgb) {
  if (!Array.isArray(rgb) || rgb.length !== 3) {
    return null;
  }

  const [rawRed, rawGreen, rawBlue] = rgb.map(value => clamp(Number(value) / 255, 0, 1));
  const max = Math.max(rawRed, rawGreen, rawBlue);
  const min = Math.min(rawRed, rawGreen, rawBlue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === rawRed) {
      hue = ((rawGreen - rawBlue) / delta) % 6;
    } else if (max === rawGreen) {
      hue = (rawBlue - rawRed) / delta + 2;
    } else {
      hue = (rawRed - rawGreen) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }

  const saturation = max === 0 ? 0 : (delta / max) * 100;
  return [Math.round(hue), Math.round(saturation)];
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

  if (normalizedField.endsWith("off_color")) {
    return "var(--primary-text-color)";
  }

  if (normalizedField.endsWith("accent_background")) {
    return "rgba(113, 192, 255, 0.2)";
  }

  if (normalizedField.endsWith("progress_background")) {
    return "color-mix(in srgb, var(--primary-text-color) 12%, transparent)";
  }

  if (normalizedField.endsWith("overlay_color")) {
    return "rgba(0, 0, 0, 0.32)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
}

function getRangeValueFromClientX(slider, clientX) {
  const rect = slider.getBoundingClientRect();
  if (!rect.width) {
    return Number(slider.value || 0);
  }

  const min = Number(slider.min || 0);
  const max = Number(slider.max || 100);
  const step = slider.step === "any" ? 0 : Number(slider.step || 1);
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  let nextValue = min + ((max - min) * ratio);

  if (Number.isFinite(step) && step > 0) {
    nextValue = min + (Math.round((nextValue - min) / step) * step);
  }

  return clamp(nextValue, min, max);
}

function getSliderDragGeometry(slider) {
  const rect = slider.getBoundingClientRect();
  return {
    left: rect.left,
    width: rect.width,
    min: Number(slider.min || 0),
    max: Number(slider.max || 100),
    step: slider.step === "any" ? 0 : Number(slider.step || 1),
  };
}

function getRangeValueFromGeometry(geometry, currentValue, clientX) {
  if (!geometry || !Number.isFinite(geometry.width) || geometry.width <= 0) {
    return Number(currentValue || 0);
  }
  const ratio = clamp((clientX - geometry.left) / geometry.width, 0, 1);
  let nextValue = geometry.min + ((geometry.max - geometry.min) * ratio);
  if (Number.isFinite(geometry.step) && geometry.step > 0) {
    nextValue = geometry.min + (Math.round((nextValue - geometry.min) / geometry.step) * geometry.step);
  }
  return clamp(nextValue, geometry.min, geometry.max);
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

function miredToKelvin(value) {
  return value > 0 ? Math.round(1000000 / value) : 0;
}

function kelvinToMired(value) {
  return value > 0 ? Math.round(1000000 / value) : 0;
}

/** Older defaults / editor-saved YAML used `--state-inactive-color`, which stays merged over new defaults. */
const LEGACY_ICON_OFF_COLOR_VALUES = [
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
];

function migrateLegacyIconOffColor(iconStyles, canonicalOffColor) {
  if (!iconStyles) {
    return;
  }
  const raw = String(iconStyles.off_color ?? "").trim();
  if (!raw) {
    return;
  }
  if (LEGACY_ICON_OFF_COLOR_VALUES.includes(raw)) {
    iconStyles.off_color = canonicalOffColor;
    return;
  }
  if (/^var\(\s*--state-inactive-color/i.test(raw)) {
    iconStyles.off_color = canonicalOffColor;
  }
}

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  if (config.keep_collapsed === true) {
    config.auto_expand = false;
  }
  delete config.keep_collapsed;
  const normalizedStatePosition = String(config.state_position || "").toLowerCase();
  config.state_position = normalizedStatePosition === "below" ? "below" : "right";

  if (!Array.isArray(config.quick_brightness) || !config.quick_brightness.length) {
    config.quick_brightness = deepClone(DEFAULT_CONFIG.quick_brightness);
  }

  config.quick_brightness = config.quick_brightness
    .map(value => Number(value))
    .filter(value => Number.isFinite(value))
    .map(value => clamp(Math.round(value), 1, 100));

  if (!config.quick_brightness.length) {
    config.quick_brightness = deepClone(DEFAULT_CONFIG.quick_brightness);
  }

  const numericPowerDuration = Number(config.animations?.power_duration);
  const numericControlsDuration = Number(config.animations?.controls_duration);
  const numericModeSwitchDuration = Number(config.animations?.mode_switch_duration);
  const numericButtonBounceDuration = Number(config.animations?.button_bounce_duration);
  config.animations = {
    enabled: config.animations?.enabled !== false,
    power_duration: Number.isFinite(numericPowerDuration)
      ? clamp(Math.round(numericPowerDuration), 120, 4000)
      : DEFAULT_CONFIG.animations.power_duration,
    controls_duration: Number.isFinite(numericControlsDuration)
      ? clamp(Math.round(numericControlsDuration), 120, 2400)
      : DEFAULT_CONFIG.animations.controls_duration,
    mode_switch_duration: Number.isFinite(numericModeSwitchDuration)
      ? clamp(Math.round(numericModeSwitchDuration), 120, 2400)
      : DEFAULT_CONFIG.animations.mode_switch_duration,
    button_bounce_duration: Number.isFinite(numericButtonBounceDuration)
      ? clamp(Math.round(numericButtonBounceDuration), 120, 1200)
      : DEFAULT_CONFIG.animations.button_bounce_duration,
    mode_switch_horizontal: config.animations?.mode_switch_horizontal !== false,
  };

  migrateLegacyIconOffColor(config.styles?.icon, DEFAULT_CONFIG.styles.icon.off_color);

  const TAP_ACTIONS = new Set(["auto", "toggle", "more-info", "service", "url", "none"]);
  const normTap = String(config.tap_action ?? "toggle").trim().toLowerCase();
  config.tap_action = TAP_ACTIONS.has(normTap) ? normTap : "toggle";
  const normIconTap = String(config.icon_tap_action ?? "toggle").trim().toLowerCase();
  config.icon_tap_action = TAP_ACTIONS.has(normIconTap) ? normIconTap : "toggle";
  config.tap_service = String(config.tap_service ?? "").trim();
  config.tap_service_data = String(config.tap_service_data ?? "").trim();
  config.tap_url = String(config.tap_url ?? "").trim();
  config.tap_new_tab = config.tap_new_tab === true;
  config.icon_tap_service = String(config.icon_tap_service ?? "").trim();
  config.icon_tap_service_data = String(config.icon_tap_service_data ?? "").trim();
  config.icon_tap_url = String(config.icon_tap_url ?? "").trim();
  config.icon_tap_new_tab = config.icon_tap_new_tab === true;

  const normHold = String(config.hold_action ?? "none").trim().toLowerCase();
  config.hold_action = TAP_ACTIONS.has(normHold) ? normHold : "none";
  const iconHoldRaw = config.icon_hold_action;
  const iconHoldStr = iconHoldRaw === undefined || iconHoldRaw === null ? "" : String(iconHoldRaw).trim();
  if (!iconHoldStr) {
    config.icon_hold_action = "";
  } else {
    const normIconHold = iconHoldStr.toLowerCase();
    config.icon_hold_action = TAP_ACTIONS.has(normIconHold) ? normIconHold : "";
  }
  config.hold_service = String(config.hold_service ?? "").trim();
  config.hold_service_data = String(config.hold_service_data ?? "").trim();
  config.hold_url = String(config.hold_url ?? "").trim();
  config.hold_new_tab = config.hold_new_tab === true;
  config.icon_hold_service = String(config.icon_hold_service ?? "").trim();
  config.icon_hold_service_data = String(config.icon_hold_service_data ?? "").trim();
  config.icon_hold_url = String(config.icon_hold_url ?? "").trim();
  config.icon_hold_new_tab = config.icon_hold_new_tab === true;
  config.entity_picture = String(config.entity_picture ?? "").trim();
  config.show_entity_picture = config.show_entity_picture === true;

  return config;
}

class NodaliaLightCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["light"]);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._draftBrightness = new Map();
    this._draftTemperature = new Map();
    this._draftHue = new Map();
    this._lastKnownOnState = new Map();
    this._activeControlMode = "brightness";
    this._cardWidth = 0;
    this._isCompactLayout = false;
    this._activeSliderDrag = null;
    this._pendingRenderAfterDrag = false;
    this._skipNextSliderChange = null;
    this._dragFrame = 0;
    this._pendingDragUpdate = null;
    this._dragWindowListenersAttached = false;
    this._lastRenderSignature = "";
    this._lastRenderedIsOn = null;
    this._lastRenderedShowDetailedControls = null;
    this._lastControlsMarkup = "";
    this._optimisticTurnOn = null;
    this._optimisticTurnOnTimer = 0;
    this._optimisticTurnOff = null;
    this._optimisticTurnOffTimer = 0;
    this._optimisticVisualSettle = null;
    this._animationCleanupTimer = 0;
    this._entranceAnimationResetTimer = 0;
    this._animateContentOnNextRender = true;
    this._suppressNextLightTap = false;
    this._powerTransition = null;
    this._controlsTransition = null;
    this._modeSwitchTimer = 0;
    this._modeSwitchPressTimer = 0;
    this._modeTransition = null;
    this._controlsPanelUserOpen = false;
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

      if (this._activeSliderDrag) {
        this._pendingRenderAfterDrag = true;
        return;
      }

      this._render();
    });
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowChange = this._onShadowChange.bind(this);
    this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
    this._onShadowMouseDown = this._onShadowMouseDown.bind(this);
    this._onShadowTouchStart = this._onShadowTouchStart.bind(this);
    this._onWindowPointerMove = this._onWindowPointerMove.bind(this);
    this._onWindowPointerUp = this._onWindowPointerUp.bind(this);
    this._onWindowMouseMove = this._onWindowMouseMove.bind(this);
    this._onWindowMouseUp = this._onWindowMouseUp.bind(this);
    this._onWindowTouchStartCapture = this._onWindowTouchStartCapture.bind(this);
    this._onWindowTouchMove = this._onWindowTouchMove.bind(this);
    this._onWindowTouchEnd = this._onWindowTouchEnd.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowChange);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown);
    this.shadowRoot.addEventListener("mousedown", this._onShadowMouseDown);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      this.shadowRoot.addEventListener("touchstart", this._onShadowTouchStart, { passive: false });
    }
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const path = event.composedPath();
              if (path.some(node => node instanceof HTMLInputElement && node.dataset?.lightControl)) {
                return null;
              }
              const actionButton = path.find(
                node => node instanceof HTMLElement && node.dataset?.lightAction,
              );
              const zone = actionButton?.dataset?.lightAction;
              return zone === "body" || zone === "icon" ? zone : null;
            },
            shouldBeginHold: zone => this._resolveHoldEffect(zone) !== "none",
            onHold: zone => {
              const effect = this._resolveHoldEffect(zone);
              if (effect === "none") {
                return;
              }
              this._triggerHaptic();
              this._clearModeSwitchTransition();
              this._executeHoldEffect(zone, effect);
            },
            markHoldConsumedClick: () => {
              this._suppressNextLightTap = true;
            },
          })
        : () => {};
  }

  connectedCallback() {
    this._resizeObserver?.observe(this);
    this._scheduleOptimisticTurnOnTimeout();
    this._scheduleOptimisticTurnOffTimeout();
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    this._detachHostHold?.();
    this._resizeObserver?.disconnect();
    this._detachWindowDragListeners();
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }
    if (this._animationCleanupTimer) {
      window.clearTimeout(this._animationCleanupTimer);
      this._animationCleanupTimer = 0;
    }
    this._clearOptimisticTurnOnTimer();
    this._clearOptimisticTurnOffTimer();
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    this._powerTransition = null;
    this._controlsTransition = null;
    if (this._modeSwitchTimer) {
      window.clearTimeout(this._modeSwitchTimer);
      this._modeSwitchTimer = 0;
    }
    if (this._modeSwitchPressTimer) {
      window.clearTimeout(this._modeSwitchPressTimer);
      this._modeSwitchPressTimer = 0;
    }
    this._modeTransition = null;
    this._pendingDragUpdate = null;
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    const previousEntityId = this._config?.entity || "";
    if (previousEntityId && previousEntityId !== config?.entity) {
      this._lastKnownOnState.delete(previousEntityId);
      this._clearDraftValues(previousEntityId);
      this._clearOptimisticTurnOnState();
      this._clearOptimisticTurnOffState();
      this._controlsPanelUserOpen = false;
      this._lastRenderedShowDetailedControls = null;
    }
    this._config = normalizeConfig(config || {});
    this._isCompactLayout = this._shouldUseCompactLayout(
      Math.round(this._cardWidth || this.clientWidth || 0),
    );
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._render();
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

  set hass(hass) {
    this._hass = hass;
    const actualState = this._getActualState();
    this._syncLastKnownOnState(actualState);
    this._syncOptimisticTurnOnState(actualState);
    this._syncOptimisticTurnOffState(actualState);
    const nextSignature = this._getRenderSignature();

    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }

    this._lastRenderSignature = nextSignature;

    if (this._activeSliderDrag) {
      this._pendingRenderAfterDrag = true;
      return;
    }

    this._render();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return {
      columns: "full",
      rows: "auto",
      min_columns: 2,
      min_rows: 2,
    };
  }

  _getRenderSignature(state = this._getState()) {
    const entityId = this._config?.entity || "";
    const attrs = state?.attributes || {};
    return [
      `e:${entityId}`,
      `s:${String(state?.state || "")}`,
      `n:${String(attrs.friendly_name || "")}`,
      `i:${String(attrs.icon || "")}`,
      `sep:${this._config?.show_entity_picture ? 1 : 0}`,
      `ep:${String(this._config?.entity_picture || attrs.entity_picture_local || attrs.entity_picture || "")}`,
      `b:${Number(attrs.brightness ?? -1)}`,
      `ct:${Number(attrs.color_temp ?? -1)}`,
      `ctk:${Number(attrs.color_temp_kelvin ?? -1)}`,
      `hs:${Array.isArray(attrs.hs_color) ? attrs.hs_color.join(",") : ""}`,
      `rgb:${Array.isArray(attrs.rgb_color) ? attrs.rgb_color.join(",") : ""}`,
      `fx:${String(attrs.effect || "")}`,
      `m:${Array.isArray(attrs.supported_color_modes) ? attrs.supported_color_modes.join("|") : ""}`,
      `sf:${Number(attrs.supported_features ?? -1)}`,
      `c:${this._isCompactLayout ? 1 : 0}`,
      `mini:${this._shouldUseMiniLayout() ? 1 : 0}`,
      `cm:${String(this._activeControlMode || "")}`,
      `ss:${this._config?.show_state === true ? 1 : 0}`,
      `sp:${String(this._config?.state_position || "right")}`,
      `ae:${this._config?.auto_expand === false ? 0 : 1}`,
      `co:${this._controlsPanelUserOpen ? 1 : 0}`,
      `tap:${[
        String(this._config?.tap_action || ""),
        String(this._config?.icon_tap_action || ""),
        String(this._config?.tap_service || ""),
        String(this._config?.icon_tap_service || ""),
        String(this._config?.tap_url || ""),
        String(this._config?.icon_tap_url || ""),
        this._config?.tap_new_tab === true ? 1 : 0,
        this._config?.icon_tap_new_tab === true ? 1 : 0,
        String(this._config?.tap_service_data || ""),
        String(this._config?.icon_tap_service_data || ""),
        this._config?.security?.strict_service_actions === false ? 0 : 1,
        Array.isArray(this._config?.security?.allowed_services)
          ? this._config.security.allowed_services.join(",")
          : "",
      ].join("~")}`,
      `hold:${[
        String(this._config?.hold_action || ""),
        String(this._config?.icon_hold_action ?? ""),
        String(this._config?.hold_service || ""),
        String(this._config?.icon_hold_service || ""),
        String(this._config?.hold_url || ""),
        String(this._config?.icon_hold_url || ""),
        this._config?.hold_new_tab === true ? 1 : 0,
        this._config?.icon_hold_new_tab === true ? 1 : 0,
        String(this._config?.hold_service_data || ""),
        String(this._config?.icon_hold_service_data || ""),
      ].join("~")}`,
    ].join("|");
  }

  _controlsEditorStr(key) {
    const hass = this._hass;
    if (typeof key !== "string" || !window.NodaliaI18n?.editorStr) {
      return key;
    }
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", key);
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) && numericColumns > 0 ? numericColumns : null;
  }

  _getCompactLayoutThreshold() {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const iconSize = parseSizeToPixels(styles?.icon?.size, 58);
    const cardPadding = parseSizeToPixels(styles?.card?.padding, 14);
    const cardGap = parseSizeToPixels(styles?.card?.gap, 12);

    return Math.max(
      COMPACT_LAYOUT_THRESHOLD,
      Math.round(iconSize + (cardPadding * 2) + cardGap + 24),
    );
  }

  _getMiniLayoutThreshold() {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const iconSize = parseSizeToPixels(styles?.icon?.size, 58);
    const cardPadding = parseSizeToPixels(styles?.card?.padding, 14);

    return Math.max(
      116,
      Math.round(iconSize + (cardPadding * 2) + 12),
    );
  }

  _shouldUseMiniLayout(width = Math.round(this._cardWidth || this.clientWidth || 0)) {
    const gridColumns = this._getConfiguredGridColumns();
    if (gridColumns !== null) {
      return gridColumns <= 2;
    }

    return width > 0 && width < this._getMiniLayoutThreshold();
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

  _getState() {
    const actualState = this._getActualState();
    if (this._isOptimisticTurnOffPending(actualState)) {
      return this._buildOptimisticTurnOffState(actualState);
    }

    if (this._isOptimisticTurnOnPending(actualState)) {
      return this._buildOptimisticTurnOnState(actualState);
    }

    if (this._shouldUseOptimisticVisualSettle(actualState)) {
      return this._buildOptimisticVisualSettleState(actualState);
    }

    return actualState;
  }

  _getActualState() {
    if (!this._config?.entity || !this._hass?.states) {
      return null;
    }

    return this._hass.states[this._config.entity] || null;
  }

  _createStateSnapshot(state) {
    if (!state) {
      return null;
    }

    return {
      ...state,
      attributes: {
        ...(state.attributes || {}),
      },
    };
  }

  _getStoredLightMemory() {
    if (typeof window === "undefined" || !window.localStorage) {
      return {};
    }

    try {
      const parsed = JSON.parse(window.localStorage.getItem(LIGHT_MEMORY_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  _storeLightMemory(entityId, snapshot) {
    if (!entityId || !snapshot || typeof window === "undefined" || !window.localStorage) {
      return;
    }

    const attrs = snapshot.attributes || {};
    const hasVisualAttrs =
      Array.isArray(attrs.rgb_color) ||
      Array.isArray(attrs.hs_color) ||
      typeof attrs.color_temp_kelvin === "number" ||
      typeof attrs.color_temp === "number" ||
      typeof attrs.brightness === "number";

    if (!hasVisualAttrs) {
      return;
    }

    try {
      const memory = this._getStoredLightMemory();
      memory[entityId] = {
        attributes: {
          brightness: attrs.brightness,
          color_temp: attrs.color_temp,
          color_temp_kelvin: attrs.color_temp_kelvin,
          hs_color: Array.isArray(attrs.hs_color) ? [...attrs.hs_color] : undefined,
          rgb_color: Array.isArray(attrs.rgb_color) ? [...attrs.rgb_color] : undefined,
        },
        last_changed: snapshot.last_changed || new Date().toISOString(),
      };
      window.localStorage.setItem(LIGHT_MEMORY_STORAGE_KEY, JSON.stringify(memory));
    } catch (_error) {
      // Storage may be unavailable in private mode; the in-memory cache still works.
    }
  }

  _getStoredLightSnapshot(entityId = this._config?.entity || "") {
    if (!entityId) {
      return null;
    }

    const stored = this._getStoredLightMemory()[entityId];
    if (!stored?.attributes || typeof stored.attributes !== "object") {
      return null;
    }

    return {
      entity_id: entityId,
      state: "on",
      attributes: {
        ...(stored.attributes || {}),
      },
      last_changed: stored.last_changed || new Date().toISOString(),
      last_updated: stored.last_changed || new Date().toISOString(),
    };
  }

  _syncLastKnownOnState(actualState) {
    const entityId = this._config?.entity || "";
    if (!entityId || !actualState) {
      return;
    }

    const snapshot = this._createStateSnapshot(actualState);

    if (actualState.state === "on") {
      this._lastKnownOnState.set(entityId, snapshot);
      this._storeLightMemory(entityId, snapshot);
      return;
    }

    const attrs = actualState.attributes || {};
    if (
      Array.isArray(attrs.rgb_color) ||
      Array.isArray(attrs.hs_color) ||
      typeof attrs.color_temp_kelvin === "number" ||
      typeof attrs.color_temp === "number" ||
      typeof attrs.brightness === "number"
    ) {
      this._lastKnownOnState.set(entityId, {
        ...snapshot,
        state: "on",
      });
      this._storeLightMemory(entityId, snapshot);
    }
  }

  _getLastKnownOnState(entityId = this._config?.entity || "") {
    if (!entityId) {
      return null;
    }

    const cached = this._lastKnownOnState.get(entityId);
    if (cached) {
      return cached;
    }

    const stored = this._getStoredLightSnapshot(entityId);
    if (stored) {
      this._lastKnownOnState.set(entityId, this._createStateSnapshot(stored));
    }

    return stored;
  }

  _clearDraftValues(entityId = this._config?.entity) {
    if (!entityId) {
      return;
    }

    this._draftBrightness.delete(entityId);
    this._draftTemperature.delete(entityId);
    this._draftHue.delete(entityId);
  }

  _clearOptimisticTurnOnTimer() {
    if (this._optimisticTurnOnTimer) {
      window.clearTimeout(this._optimisticTurnOnTimer);
      this._optimisticTurnOnTimer = 0;
    }
  }

  _clearOptimisticTurnOnState(options = {}) {
    const clearDrafts = options.clearDrafts === true;
    const entityId = this._optimisticTurnOn?.entityId || this._config?.entity;

    this._clearOptimisticTurnOnTimer();
    this._optimisticTurnOn = null;

    if (clearDrafts) {
      this._clearDraftValues(entityId);
    }
  }

  _startOptimisticVisualSettle(actualState, optimisticState) {
    const entityId = this._config?.entity || "";
    if (!entityId || !actualState || actualState.state !== "on" || !optimisticState) {
      this._optimisticVisualSettle = null;
      return;
    }

    this._optimisticVisualSettle = {
      entityId,
      expiresAt: Date.now() + OPTIMISTIC_VISUAL_SETTLE_MS,
      stateSnapshot: this._createStateSnapshot(optimisticState),
    };
  }

  _hasUsefulColorAttributes(state) {
    const attrs = state?.attributes || {};
    return (
      Array.isArray(attrs.rgb_color) ||
      Array.isArray(attrs.hs_color) ||
      typeof attrs.color_temp_kelvin === "number" ||
      typeof attrs.color_temp === "number"
    );
  }

  _shouldUseOptimisticVisualSettle(actualState = this._getActualState()) {
    if (!this._optimisticVisualSettle) {
      return false;
    }

    if (this._optimisticVisualSettle.entityId !== (this._config?.entity || "")) {
      this._optimisticVisualSettle = null;
      return false;
    }

    if (actualState?.state !== "on" || Date.now() >= this._optimisticVisualSettle.expiresAt) {
      this._optimisticVisualSettle = null;
      return false;
    }

    const settledSnapshot = this._optimisticVisualSettle.stateSnapshot;
    if (this._hasUsefulColorAttributes(actualState) && this._hasUsefulColorAttributes(settledSnapshot)) {
      this._optimisticVisualSettle = null;
      return false;
    }

    return true;
  }

  _buildOptimisticVisualSettleState(actualState = this._getActualState()) {
    const snapshot = this._optimisticVisualSettle?.stateSnapshot;
    if (!actualState || !snapshot) {
      return actualState;
    }

    return {
      ...actualState,
      attributes: {
        ...(snapshot.attributes || {}),
        ...(actualState.attributes || {}),
        rgb_color: actualState.attributes?.rgb_color || snapshot.attributes?.rgb_color,
        hs_color: actualState.attributes?.hs_color || snapshot.attributes?.hs_color,
        color_temp_kelvin: actualState.attributes?.color_temp_kelvin ?? snapshot.attributes?.color_temp_kelvin,
        color_temp: actualState.attributes?.color_temp ?? snapshot.attributes?.color_temp,
        brightness: actualState.attributes?.brightness ?? snapshot.attributes?.brightness,
      },
    };
  }

  _clearOptimisticTurnOffTimer() {
    if (this._optimisticTurnOffTimer) {
      window.clearTimeout(this._optimisticTurnOffTimer);
      this._optimisticTurnOffTimer = 0;
    }
  }

  _clearOptimisticTurnOffState() {
    this._clearOptimisticTurnOffTimer();
    this._optimisticTurnOff = null;
  }

  _isOptimisticTurnOnPending(actualState = this._getActualState()) {
    const entityId = this._config?.entity || "";
    if (!entityId || !this._optimisticTurnOn || this._optimisticTurnOn.entityId !== entityId) {
      return false;
    }

    if (actualState?.state === "on") {
      return false;
    }

    return Date.now() < this._optimisticTurnOn.expiresAt;
  }

  _scheduleOptimisticTurnOnTimeout() {
    this._clearOptimisticTurnOnTimer();

    if (!this._optimisticTurnOn) {
      return;
    }

    const remaining = Math.max(0, this._optimisticTurnOn.expiresAt - Date.now());
    if (!remaining || typeof window === "undefined") {
      this._clearOptimisticTurnOnState({ clearDrafts: true });
      this._render();
      return;
    }

    this._optimisticTurnOnTimer = window.setTimeout(() => {
      this._optimisticTurnOnTimer = 0;

      if (!this._isOptimisticTurnOnPending(this._getActualState())) {
        return;
      }

      this._clearOptimisticTurnOnState({ clearDrafts: true });
      this._render();
    }, remaining);
  }

  _startOptimisticTurnOn(actualState = this._getActualState()) {
    if (!this._config?.entity) {
      return;
    }

    const cachedState = this._getLastKnownOnState(this._config.entity);
    this._optimisticTurnOn = {
      entityId: this._config.entity,
      expiresAt: Date.now() + OPTIMISTIC_TURN_ON_TIMEOUT,
      queuedData: {},
      stateSnapshot: this._createStateSnapshot(cachedState || actualState),
    };

    this._scheduleOptimisticTurnOnTimeout();
  }

  _queueOptimisticTurnOnChange(data = {}) {
    if (!this._isOptimisticTurnOnPending(this._getActualState()) || !this._optimisticTurnOn) {
      return false;
    }

    const nextQueuedData = {
      ...(this._optimisticTurnOn.queuedData || {}),
    };

    if (Object.prototype.hasOwnProperty.call(data, "hs_color")) {
      delete nextQueuedData.color_temp_kelvin;
    }

    if (Object.prototype.hasOwnProperty.call(data, "color_temp_kelvin")) {
      delete nextQueuedData.hs_color;
    }

    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined) {
        delete nextQueuedData[key];
        return;
      }

      nextQueuedData[key] = Array.isArray(value) ? [...value] : value;
    });

    this._optimisticTurnOn.queuedData = nextQueuedData;
    return true;
  }

  _buildOptimisticTurnOnState(actualState = this._getActualState()) {
    const snapshot = this._optimisticTurnOn?.stateSnapshot || this._getLastKnownOnState() || null;
    const baseState = snapshot || actualState;
    if (!baseState) {
      return actualState;
    }

    const entityId = this._config?.entity || "";
    const attrs = {
      ...(baseState.attributes || {}),
    };

    if (entityId && this._draftBrightness.has(entityId)) {
      attrs.brightness = clamp(Math.round((Number(this._draftBrightness.get(entityId)) / 100) * 255), 1, 255);
    }

    if (entityId && this._draftTemperature.has(entityId)) {
      const nextKelvin = clamp(Math.round(Number(this._draftTemperature.get(entityId))), 1, 100000);
      attrs.color_temp_kelvin = nextKelvin;
      attrs.color_temp = kelvinToMired(nextKelvin);
    }

    if (entityId && this._draftHue.has(entityId)) {
      attrs.hs_color = [
        clamp(Math.round(Number(this._draftHue.get(entityId))), 0, 360),
        Math.max(this._getCurrentSaturation(baseState), 50),
      ];
    }

    return {
      ...baseState,
      state: "on",
      attributes: {
        ...attrs,
        _nodalia_optimistic_on: true,
      },
    };
  }

  _flushOptimisticTurnOnQueue() {
    const queuedData = this._optimisticTurnOn?.queuedData || {};
    if (!Object.keys(queuedData).length) {
      return;
    }

    this._setLightState(queuedData);
  }

  _syncOptimisticTurnOnState(actualState) {
    if (!this._optimisticTurnOn) {
      return;
    }

    if (this._optimisticTurnOn.entityId !== (this._config?.entity || "")) {
      this._clearOptimisticTurnOnState();
      return;
    }

    if (actualState?.state === "on") {
      const optimisticState = this._buildOptimisticTurnOnState(actualState);
      const queuedData = {
        ...(this._optimisticTurnOn.queuedData || {}),
      };
      this._clearOptimisticTurnOnState();
      this._startOptimisticVisualSettle(actualState, optimisticState);

      if (Object.keys(queuedData).length) {
        this._setLightState(queuedData);
      }
      return;
    }

    if (["unavailable", "unknown"].includes(actualState?.state)) {
      this._clearOptimisticTurnOnState({ clearDrafts: true });
      return;
    }

    if (!this._isOptimisticTurnOnPending(actualState)) {
      this._clearOptimisticTurnOnState({ clearDrafts: true });
      return;
    }

    this._scheduleOptimisticTurnOnTimeout();
  }

  _isOptimisticTurnOffPending(actualState = this._getActualState()) {
    const entityId = this._config?.entity || "";
    if (!entityId || !this._optimisticTurnOff || this._optimisticTurnOff.entityId !== entityId) {
      return false;
    }

    if (actualState?.state === "off") {
      return false;
    }

    return Date.now() < this._optimisticTurnOff.expiresAt;
  }

  _scheduleOptimisticTurnOffTimeout() {
    this._clearOptimisticTurnOffTimer();

    if (!this._optimisticTurnOff) {
      return;
    }

    const remaining = Math.max(0, this._optimisticTurnOff.expiresAt - Date.now());
    if (!remaining || typeof window === "undefined") {
      this._clearOptimisticTurnOffState();
      this._render();
      return;
    }

    this._optimisticTurnOffTimer = window.setTimeout(() => {
      this._optimisticTurnOffTimer = 0;

      if (!this._isOptimisticTurnOffPending(this._getActualState())) {
        return;
      }

      this._clearOptimisticTurnOffState();
      this._render();
    }, remaining);
  }

  _startOptimisticTurnOff(actualState = this._getActualState()) {
    if (!this._config?.entity) {
      return;
    }

    const stateSnapshotSource = actualState?.state === "on"
      ? actualState
      : this._getLastKnownOnState(this._config.entity) || actualState;

    this._optimisticTurnOff = {
      entityId: this._config.entity,
      expiresAt: Date.now() + OPTIMISTIC_TURN_OFF_TIMEOUT,
      stateSnapshot: this._createStateSnapshot(stateSnapshotSource),
    };

    this._scheduleOptimisticTurnOffTimeout();
  }

  _buildOptimisticTurnOffState(actualState = this._getActualState()) {
    const baseState = this._optimisticTurnOff?.stateSnapshot || actualState || this._getLastKnownOnState();
    if (!baseState) {
      return actualState;
    }

    return {
      ...baseState,
      state: "off",
      attributes: {
        ...(baseState.attributes || {}),
        _nodalia_optimistic_off: true,
      },
    };
  }

  _syncOptimisticTurnOffState(actualState) {
    if (!this._optimisticTurnOff) {
      return;
    }

    if (this._optimisticTurnOff.entityId !== (this._config?.entity || "")) {
      this._clearOptimisticTurnOffState();
      return;
    }

    if (actualState?.state === "off") {
      this._clearOptimisticTurnOffState();
      return;
    }

    if (["unavailable", "unknown"].includes(actualState?.state)) {
      this._clearOptimisticTurnOffState();
      return;
    }

    if (!this._isOptimisticTurnOffPending(actualState)) {
      this._clearOptimisticTurnOffState();
      return;
    }

    this._scheduleOptimisticTurnOffTimeout();
  }

  _supportsBrightness(state) {
    if (typeof state?.attributes?.brightness === "number") {
      return true;
    }

    const supportedColorModes = Array.isArray(state?.attributes?.supported_color_modes)
      ? state.attributes.supported_color_modes
      : [];

    return supportedColorModes.some(mode =>
      ["brightness", "color_temp", "hs", "rgb", "rgbw", "rgbww", "xy", "white"].includes(mode),
    );
  }

  _supportsColor(state) {
    const supportedColorModes = Array.isArray(state?.attributes?.supported_color_modes)
      ? state.attributes.supported_color_modes
      : [];

    return supportedColorModes.some(mode =>
      ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(mode),
    );
  }

  _supportsColorTemperature(state) {
    const supportedColorModes = Array.isArray(state?.attributes?.supported_color_modes)
      ? state.attributes.supported_color_modes
      : [];

    return (
      supportedColorModes.includes("color_temp") ||
      typeof state?.attributes?.color_temp_kelvin === "number" ||
      typeof state?.attributes?.color_temp === "number"
    );
  }

  _getBrightnessPercent(state) {
    const entityId = this._config?.entity;
    if (entityId && this._draftBrightness.has(entityId)) {
      return clamp(Number(this._draftBrightness.get(entityId)), 1, 100);
    }

    if (typeof state?.attributes?.brightness === "number") {
      return clamp(Math.round((state.attributes.brightness / 255) * 100), 1, 100);
    }

    return state?.state === "on" ? 100 : 50;
  }

  _getTemperatureRange(state) {
    const minKelvin = Number(state?.attributes?.min_color_temp_kelvin);
    const maxKelvin = Number(state?.attributes?.max_color_temp_kelvin);

    if (Number.isFinite(minKelvin) && Number.isFinite(maxKelvin) && minKelvin > 0 && maxKelvin > 0) {
      return {
        min: Math.min(minKelvin, maxKelvin),
        max: Math.max(minKelvin, maxKelvin),
      };
    }

    const minMireds = Number(state?.attributes?.min_mireds);
    const maxMireds = Number(state?.attributes?.max_mireds);

    if (Number.isFinite(minMireds) && Number.isFinite(maxMireds) && minMireds > 0 && maxMireds > 0) {
      const min = miredToKelvin(Math.max(minMireds, maxMireds));
      const max = miredToKelvin(Math.min(minMireds, maxMireds));
      return {
        min: Math.min(min, max),
        max: Math.max(min, max),
      };
    }

    return {
      min: 2200,
      max: 6500,
    };
  }

  _getTemperatureControlDomain(state) {
    const minMireds = Number(state?.attributes?.min_mireds);
    const maxMireds = Number(state?.attributes?.max_mireds);

    if (Number.isFinite(minMireds) && Number.isFinite(maxMireds) && minMireds > 0 && maxMireds > 0) {
      return {
        unit: "mired",
        min: Math.min(minMireds, maxMireds),
        max: Math.max(minMireds, maxMireds),
        step: 1,
      };
    }

    const range = this._getTemperatureRange(state);
    return {
      unit: "kelvin",
      min: range.min,
      max: range.max,
      step: 25,
    };
  }

  _temperatureSliderValueToKelvin(value, state) {
    const domain = this._getTemperatureControlDomain(state);
    const boundedValue = clamp(Math.round(Number(value)), domain.min, domain.max);
    return domain.unit === "mired" ? miredToKelvin(boundedValue) : boundedValue;
  }

  _kelvinToTemperatureSliderValue(kelvin, state) {
    const domain = this._getTemperatureControlDomain(state);
    const numericKelvin = clamp(Math.round(Number(kelvin)), 1, 100000);
    const nextValue = domain.unit === "mired" ? kelvinToMired(numericKelvin) : numericKelvin;
    return clamp(Math.round(nextValue), domain.min, domain.max);
  }

  _getCurrentKelvin(state) {
    const entityId = this._config?.entity;
    if (entityId && this._draftTemperature.has(entityId)) {
      return this._draftTemperature.get(entityId);
    }

    if (typeof state?.attributes?.color_temp_kelvin === "number") {
      return Math.round(state.attributes.color_temp_kelvin);
    }

    if (typeof state?.attributes?.color_temp === "number") {
      return miredToKelvin(state.attributes.color_temp);
    }

    const range = this._getTemperatureRange(state);
    return Math.round((range.min + range.max) / 2);
  }

  _getCurrentHue(state) {
    const entityId = this._config?.entity;
    if (entityId && this._draftHue.has(entityId)) {
      return this._draftHue.get(entityId);
    }

    const hsColor = Array.isArray(state?.attributes?.hs_color) ? state.attributes.hs_color : null;
    if (hsColor?.length === 2 && hsColor.every(value => Number.isFinite(Number(value)))) {
      return clamp(Math.round(Number(hsColor[0])), 0, 360);
    }

    const rgbColor = Array.isArray(state?.attributes?.rgb_color) ? state.attributes.rgb_color : null;
    const derivedHs = rgbToHs(rgbColor);
    if (derivedHs) {
      return clamp(derivedHs[0], 0, 360);
    }

    return 42;
  }

  _getCurrentSaturation(state) {
    const hsColor = Array.isArray(state?.attributes?.hs_color) ? state.attributes.hs_color : null;
    if (hsColor?.length === 2 && hsColor.every(value => Number.isFinite(Number(value)))) {
      return clamp(Math.round(Number(hsColor[1])), 0, 100);
    }

    const rgbColor = Array.isArray(state?.attributes?.rgb_color) ? state.attributes.rgb_color : null;
    const derivedHs = rgbToHs(rgbColor);
    if (derivedHs) {
      return clamp(derivedHs[1], 0, 100);
    }

    return 75;
  }

  _getTemperaturePresets(state) {
    const range = this._getTemperatureRange(state);
    const middle = Math.round((range.min + range.max) / 2);

    return [
      { label: "Calida", kelvin: range.min },
      { label: "Neutra", kelvin: middle },
      { label: "Fria", kelvin: range.max },
    ];
  }

  _getStateLabel(state) {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const entityStates = window.NodaliaI18n?.strings?.(lang)?.entityCard?.states;

    if (state?.attributes?._nodalia_optimistic_off === true) {
      return entityStates?.closing || "Apagando";
    }

    if (state?.attributes?._nodalia_optimistic_on === true) {
      return entityStates?.opening || "Turning on";
    }

    switch (state?.state) {
      case "on":
        return entityStates?.on || "On";
      case "off":
        return entityStates?.off || "Off";
      case "unavailable":
        return entityStates?.unavailable || "Unavailable";
      case "unknown":
        return entityStates?.unknown || "Unknown";
      default:
        return state?.state ? String(state.state) : (window.NodaliaI18n?.strings?.(lang)?.alarmPanel?.noState || "No state");
    }
  }

  _getLightName(state) {
    if (this._config?.name) {
      return this._config.name;
    }

    if (state?.attributes?.friendly_name) {
      return state.attributes.friendly_name;
    }

    return this._config?.entity || "Luz";
  }

  _getLightIcon(state) {
    return this._config?.icon || state?.attributes?.icon || "mdi:lightbulb";
  }

  _getEntityPicture(state) {
    if (this._config?.show_entity_picture !== true) {
      return "";
    }
    return String(
      this._config?.entity_picture
      || state?.attributes?.entity_picture_local
      || state?.attributes?.entity_picture
      || "",
    ).trim();
  }

  _getAccentColor(state) {
    const rgbColor = Array.isArray(state?.attributes?.rgb_color) ? state.attributes.rgb_color : null;
    if (state?.state === "on" && rgbColor?.length === 3) {
      return `rgb(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]})`;
    }

    if (state?.state === "on") {
      const kelvin = this._getCurrentKelvin(state);
      if (kelvin >= 5200) {
        return "#8fd3ff";
      }

      if (kelvin <= 3000) {
        return "#f4b55f";
      }

      return "#ffd166";
    }

    return this._config?.styles?.icon?.off_color || "var(--primary-text-color)";
  }

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;
    return {
      enabled: configuredAnimations.enabled !== false,
      powerDuration: clamp(Number(configuredAnimations.power_duration) || DEFAULT_CONFIG.animations.power_duration, 120, 4000),
      controlsDuration: clamp(Number(configuredAnimations.controls_duration) || DEFAULT_CONFIG.animations.controls_duration, 120, 2400),
      modeSwitchDuration: clamp(Number(configuredAnimations.mode_switch_duration) || DEFAULT_CONFIG.animations.mode_switch_duration, 120, 2400),
      buttonBounceDuration: clamp(Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration, 120, 1200),
      modeSwitchHorizontal: configuredAnimations.mode_switch_horizontal !== false,
    };
  }

  _scheduleAnimationCleanup(delay) {
    if (this._animationCleanupTimer) {
      window.clearTimeout(this._animationCleanupTimer);
      this._animationCleanupTimer = 0;
    }

    const safeDelay = clamp(Math.round(Number(delay) || 0), 0, 5000);
    if (!safeDelay || typeof window === "undefined") {
      return;
    }

    this._animationCleanupTimer = window.setTimeout(() => {
      this._animationCleanupTimer = 0;
      this._powerTransition = null;
      this._controlsTransition = null;
    }, safeDelay);
  }

  _clearModeSwitchTransition() {
    if (this._modeSwitchTimer) {
      window.clearTimeout(this._modeSwitchTimer);
      this._modeSwitchTimer = 0;
    }

    if (this._modeSwitchPressTimer) {
      window.clearTimeout(this._modeSwitchPressTimer);
      this._modeSwitchPressTimer = 0;
    }

    this._modeTransition = null;
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

  _startModeSwitchTransition(nextMode, state = this._getState()) {
    const animations = this._getAnimationSettings();
    const availableModes = this._getAvailableControlModes(state);
    const currentMode = this._getActiveControlMode(state);

    if (
      !animations.enabled ||
      !state ||
      !nextMode ||
      nextMode === currentMode ||
      !availableModes.includes(nextMode) ||
      !availableModes.includes(currentMode)
    ) {
      this._clearModeSwitchTransition();
      this._activeControlMode = nextMode || currentMode || "brightness";
      this._render();
      return;
    }

    this._clearModeSwitchTransition();

    const phaseDuration = Math.max(100, Math.round(animations.modeSwitchDuration / 2));
    const settleDuration = phaseDuration + 34;
    const fromMode = currentMode;
    const toMode = nextMode;

    this._modeTransition = {
      from: fromMode,
      to: toMode,
      phase: "collapsing",
    };
    this._render();

    this._modeSwitchTimer = window.setTimeout(() => {
      this._modeSwitchTimer = 0;
      this._activeControlMode = toMode;
      this._modeTransition = {
        from: fromMode,
        to: toMode,
        phase: "expanding",
      };
      this._render();

      this._modeSwitchTimer = window.setTimeout(() => {
        this._modeSwitchTimer = 0;

        const finalizeTransition = () => {
          if (
            !this._modeTransition ||
            this._modeTransition.phase !== "expanding" ||
            this._modeTransition.to !== toMode
          ) {
            return;
          }

          this._modeTransition = null;
          this._render();
        };

        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(finalizeTransition);
          });
          return;
        }

        finalizeTransition();
      }, settleDuration);
    }, phaseDuration);
  }

  _setLightState(data = {}) {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    this._hass.callService("light", "turn_on", {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _setLightOff() {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    this._hass.callService("light", "turn_off", {
      entity_id: this._config.entity,
    });
  }

  _isLightToggleableState(state) {
    const key = String(state?.state || "").trim().toLowerCase();
    return key === "on" || key === "off";
  }

  _resolveTapEffect(zone) {
    const raw =
      zone === "icon"
        ? this._config?.icon_tap_action || "toggle"
        : this._config?.tap_action || "toggle";
    let effect = String(raw || "toggle").trim().toLowerCase();
    const allowed = new Set(["auto", "toggle", "more-info", "service", "url", "none"]);
    if (!allowed.has(effect)) {
      effect = "toggle";
    }
    if (effect === "auto") {
      const state = this._getState();
      return this._isLightToggleableState(state) ? "toggle" : "more-info";
    }
    return effect;
  }

  _openMoreInfo(entityId = this._config?.entity) {
    const id = String(entityId || "").trim();
    if (!id) {
      return;
    }
    fireEvent(this, "hass-more-info", {
      entityId: id,
    });
  }

  _parseServiceData(rawValue) {
    if (!rawValue) {
      return {};
    }
    try {
      const parsed = JSON.parse(rawValue);
      return isObject(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
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

  _callConfiguredService(serviceValue, entityId = this._config?.entity, rawData = "") {
    if (!this._hass || !serviceValue) {
      return;
    }
    if (!this._isServiceAllowed(serviceValue)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Light Card", serviceValue);
      return;
    }
    const [domain, service] = String(serviceValue).split(".");
    if (!domain || !service) {
      return;
    }
    const payload = this._parseServiceData(rawData);
    if (entityId && payload.entity_id === undefined) {
      payload.entity_id = entityId;
    }
    this._hass.callService(domain, service, payload);
  }

  _openConfiguredUrl(urlValue, newTab = false) {
    const url = window.NodaliaUtils?.sanitizeActionUrl(urlValue, { allowRelative: true }) || "";
    if (!url) {
      return;
    }
    if (newTab) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.href = url;
  }

  _executeTapEffect(zone, effect) {
    const isIcon = zone === "icon";
    switch (effect) {
      case "toggle":
        this._toggleLight();
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service": {
        const service = isIcon ? this._config?.icon_tap_service : this._config?.tap_service;
        const data = isIcon ? this._config?.icon_tap_service_data : this._config?.tap_service_data;
        this._callConfiguredService(service, this._config?.entity, data);
        break;
      }
      case "url":
        this._openConfiguredUrl(isIcon ? this._config?.icon_tap_url : this._config?.tap_url, isIcon ? this._config?.icon_tap_new_tab === true : this._config?.tap_new_tab === true);
        break;
      case "none":
      default:
        break;
    }
  }

  _resolveHoldEffect(zone) {
    const inheritIcon = zone === "icon" && String(this._config?.icon_hold_action ?? "").trim() === "";
    const raw = inheritIcon
      ? String(this._config?.hold_action ?? "none").trim()
      : String((zone === "icon" ? this._config?.icon_hold_action : this._config?.hold_action) ?? "none").trim();
    let effect = raw.toLowerCase();
    const allowed = new Set(["auto", "toggle", "more-info", "service", "url", "none"]);
    if (!allowed.has(effect)) {
      effect = "none";
    }
    if (effect === "auto") {
      const state = this._getState();
      return this._isLightToggleableState(state) ? "toggle" : "more-info";
    }
    return effect;
  }

  _executeHoldEffect(zone, effect) {
    const isIcon = zone === "icon";
    switch (effect) {
      case "toggle":
        this._toggleLight();
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service": {
        let service = isIcon ? this._config?.icon_hold_service : this._config?.hold_service;
        let data = isIcon ? this._config?.icon_hold_service_data : this._config?.hold_service_data;
        if (isIcon && !String(service || "").trim()) {
          service = this._config?.hold_service;
          data = this._config?.hold_service_data;
        }
        this._callConfiguredService(service, this._config?.entity, data);
        break;
      }
      case "url": {
        let url = isIcon ? this._config?.icon_hold_url : this._config?.hold_url;
        let tab = isIcon ? this._config?.icon_hold_new_tab === true : this._config?.hold_new_tab === true;
        if (isIcon && !String(url || "").trim()) {
          url = this._config?.hold_url;
          tab = this._config?.hold_new_tab === true;
        }
        this._openConfiguredUrl(url, tab);
        break;
      }
      case "none":
      default:
        break;
    }
  }

  _toggleLight() {
    const actualState = this._getActualState();
    const effectiveState = this._getState();
    if (!this._hass || !this._config?.entity) {
      return;
    }

    if (effectiveState?.state === "on") {
      const shouldClearDrafts = this._isOptimisticTurnOnPending(actualState);
      this._clearOptimisticTurnOnState({ clearDrafts: shouldClearDrafts });
      if (actualState?.state === "on" || shouldClearDrafts) {
        this._startOptimisticTurnOff(actualState);
      }
      this._setLightOff();
      this._render();
      return;
    }

    const wasOptimisticallyTurningOff = this._isOptimisticTurnOffPending(actualState);
    this._clearOptimisticTurnOffState();
    if (wasOptimisticallyTurningOff && actualState?.state === "on") {
      this._startOptimisticTurnOn(actualState);
      this._setLightState();
      this._render();
      return;
    }

    this._startOptimisticTurnOn(actualState);
    this._setLightState();
    this._render();
  }

  _commitBrightness(percent) {
    const nextBrightness = clamp(Math.round(Number(percent)), 1, 100);
    if (!Number.isFinite(nextBrightness)) {
      return;
    }

    if (this._queueOptimisticTurnOnChange({ brightness_pct: nextBrightness })) {
      return;
    }

    this._setLightState({
      brightness_pct: nextBrightness,
    });
  }

  _commitColorPreset(hs) {
    if (this._queueOptimisticTurnOnChange({ hs_color: hs })) {
      return;
    }

    this._setLightState({
      hs_color: hs,
    });
  }

  _commitColorHue(hue, state) {
    const numericHue = clamp(Math.round(Number(hue)), 0, 360);
    if (!Number.isFinite(numericHue)) {
      return;
    }

    const saturation = Math.max(this._getCurrentSaturation(state), 50);
    if (this._queueOptimisticTurnOnChange({ hs_color: [numericHue, saturation] })) {
      return;
    }

    this._setLightState({
      hs_color: [numericHue, saturation],
    });
  }

  _commitTemperaturePreset(kelvin) {
    const range = this._getTemperatureRange(this._getState());
    const numericKelvin = clamp(Math.round(Number(kelvin)), range.min, range.max);
    if (!Number.isFinite(numericKelvin) || numericKelvin <= 0) {
      return;
    }

    if (this._queueOptimisticTurnOnChange({ color_temp_kelvin: numericKelvin })) {
      return;
    }

    this._setLightState({
      color_temp_kelvin: numericKelvin,
    });
  }

  _updateBrightnessPreview(value) {
    const slider = this.shadowRoot?.querySelector('.light-card__slider[data-light-control="brightness"]');
    const nextValue = clamp(Number(value), 1, 100);

    if (slider instanceof HTMLInputElement) {
      slider.style.setProperty("--brightness", String(nextValue));
      slider.closest(".light-card__slider-shell")?.style.setProperty("--brightness", String(nextValue));
    }
  }

  _updateTemperaturePreview(value, state) {
    const slider = this.shadowRoot?.querySelector('.light-card__slider[data-light-control="temperature"]');
    const domain = this._getTemperatureControlDomain(state);
    const boundedValue = clamp(Number(value), domain.min, domain.max);
    const percent = domain.max === domain.min
      ? 0
      : ((boundedValue - domain.min) / (domain.max - domain.min)) * 100;

    if (slider instanceof HTMLInputElement) {
      slider.style.setProperty("--temperature-progress", String(clamp(percent, 0, 100)));
      slider.closest(".light-card__slider-shell")?.style.setProperty("--temperature-progress", String(clamp(percent, 0, 100)));
    }
  }

  _updateColorPreview(value) {
    const slider = this.shadowRoot?.querySelector('.light-card__slider[data-light-control="color"]');
    const nextValue = clamp(Math.round(Number(value)), 0, 360);
    const percent = (nextValue / 360) * 100;

    if (slider instanceof HTMLInputElement) {
      slider.style.setProperty("--color-progress", String(clamp(percent, 0, 100)));
      slider.closest(".light-card__slider-shell")?.style.setProperty("--color-progress", String(clamp(percent, 0, 100)));
    }
  }

  _applySliderValue(slider, value, options = {}) {
    const commit = options.commit === true;

    switch (slider.dataset.lightControl) {
      case "brightness": {
        const nextValue = clamp(Number(value), 1, 100);
        this._draftBrightness.set(this._config.entity, nextValue);
        this._updateBrightnessPreview(nextValue);
        if (commit) {
          this._triggerHaptic("selection");
          this._commitBrightness(nextValue);
        }
        break;
      }
      case "temperature": {
        const state = this._getState();
        const domain = this._getTemperatureControlDomain(state);
        const nextValue = clamp(Number(value), domain.min, domain.max);
        const nextKelvin = this._temperatureSliderValueToKelvin(nextValue, state);
        this._draftTemperature.set(this._config.entity, nextKelvin);
        this._updateTemperaturePreview(nextValue, state);
        if (commit) {
          this._triggerHaptic("selection");
          this._commitTemperaturePreset(nextKelvin);
        }
        break;
      }
      case "color": {
        const state = this._getState();
        const nextValue = clamp(Math.round(Number(value)), 0, 360);
        this._draftHue.set(this._config.entity, nextValue);
        this._updateColorPreview(nextValue);
        if (commit) {
          this._triggerHaptic("selection");
          this._commitColorHue(nextValue, state);
        }
        break;
      }
      default:
        break;
    }
  }

  _onShadowPointerDown(event) {
    const slider = event
      .composedPath()
      .find(node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.lightControl,
      );

    if (this._activeSliderDrag || !slider || (typeof event.button === "number" && event.button !== 0)) {
      return;
    }

    this._startSliderDrag(slider, event.clientX, event, event.pointerId);
  }

  _queueSliderDragUpdate(slider, clientX) {
    const nextValue = getRangeValueFromGeometry(this._activeSliderDrag?.geometry, slider.value, clientX);
    slider.value = String(nextValue);
    this._applySliderValue(slider, nextValue, { commit: false });
  }

  _setSliderDragVisualState(slider, isDragging) {
    const sliderShell = slider?.closest?.(".light-card__slider-shell");
    if (!(sliderShell instanceof HTMLElement)) {
      return;
    }

    sliderShell.classList.toggle("is-dragging", isDragging === true);
  }

  _startSliderDrag(slider, clientX, event = null, pointerId = null) {
    if (!slider) {
      return;
    }

    this._activeSliderDrag = {
      pointerId,
      slider,
      geometry: getSliderDragGeometry(slider),
    };
    this._attachWindowDragListeners();

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this._pendingDragUpdate = null;
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }

    this._setSliderDragVisualState(slider, true);
    const nextValue = getRangeValueFromGeometry(this._activeSliderDrag.geometry, slider.value, clientX);
    slider.value = String(nextValue);
    this._applySliderValue(slider, nextValue, { commit: false });
  }

  _commitSliderDrag(clientX, event = null, pointerId = null) {
    const drag = this._activeSliderDrag;
    if (!drag) {
      return;
    }

    if (event) {
      event.preventDefault();
    }

    this._pendingDragUpdate = null;
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }

    const nextValue = getRangeValueFromGeometry(drag.geometry, drag.slider.value, clientX);
    drag.slider.value = String(nextValue);
    this._skipNextSliderChange = drag.slider;
    this._applySliderValue(drag.slider, nextValue, { commit: true });
    this._setSliderDragVisualState(drag.slider, false);

    this._activeSliderDrag = null;
    this._detachWindowDragListeners();

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onShadowMouseDown(event) {
    const slider = event
      .composedPath()
      .find(node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.lightControl,
      );

    if (this._activeSliderDrag || !slider || event.button !== 0) {
      return;
    }

    this._startSliderDrag(slider, event.clientX, event);
  }

  _onShadowTouchStart(event) {
    const slider = event
      .composedPath()
      .find(node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.lightControl,
      );

    if (this._activeSliderDrag || !slider || !event.touches?.length) {
      return;
    }

    this._startSliderDrag(slider, event.touches[0].clientX, event);
  }

  _onWindowPointerMove(event) {
    const drag = this._activeSliderDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(drag.slider, event.clientX);
  }

  _onWindowPointerUp(event) {
    const drag = this._activeSliderDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    this._commitSliderDrag(event.clientX, event, event.pointerId);
  }

  _onWindowMouseMove(event) {
    if (!this._activeSliderDrag || (typeof event.buttons === "number" && (event.buttons & 1) === 0)) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(this._activeSliderDrag.slider, event.clientX);
  }

  _onWindowMouseUp(event) {
    if (!this._activeSliderDrag) {
      return;
    }

    this._commitSliderDrag(event.clientX, event);
  }

  _onWindowTouchMove(event) {
    if (!this._activeSliderDrag || !event.touches?.length) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(this._activeSliderDrag.slider, event.touches[0].clientX);
  }

  _onWindowTouchStartCapture(event) {
    const drag = this._activeSliderDrag;
    if (!drag) {
      return;
    }

    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.includes(drag.slider)) {
      return;
    }

    this._setSliderDragVisualState(drag.slider, false);
    this._activeSliderDrag = null;
    this._detachWindowDragListeners();
    this._pendingDragUpdate = null;
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onWindowTouchEnd(event) {
    if (!this._activeSliderDrag) {
      return;
    }

    const clientX = event.changedTouches?.[0]?.clientX;
    if (!Number.isFinite(clientX)) {
      this._setSliderDragVisualState(this._activeSliderDrag.slider, false);
      this._activeSliderDrag = null;
      this._detachWindowDragListeners();
      if (this._pendingRenderAfterDrag) {
        this._pendingRenderAfterDrag = false;
        this._render();
      }
      return;
    }

    this._commitSliderDrag(clientX, event);
  }

  _attachWindowDragListeners() {
    if (this._dragWindowListenersAttached) {
      return;
    }
    this._dragWindowListenersAttached = true;
    window.addEventListener("pointermove", this._onWindowPointerMove);
    window.addEventListener("pointerup", this._onWindowPointerUp);
    window.addEventListener("pointercancel", this._onWindowPointerUp);
    window.addEventListener("mousemove", this._onWindowMouseMove);
    window.addEventListener("mouseup", this._onWindowMouseUp);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      window.addEventListener("touchstart", this._onWindowTouchStartCapture, { passive: true, capture: true });
      window.addEventListener("touchmove", this._onWindowTouchMove, { passive: false });
      window.addEventListener("touchend", this._onWindowTouchEnd, { passive: false });
      window.addEventListener("touchcancel", this._onWindowTouchEnd, { passive: false });
    }
  }

  _detachWindowDragListeners() {
    if (!this._dragWindowListenersAttached) {
      return;
    }
    this._dragWindowListenersAttached = false;
    window.removeEventListener("pointermove", this._onWindowPointerMove);
    window.removeEventListener("pointerup", this._onWindowPointerUp);
    window.removeEventListener("pointercancel", this._onWindowPointerUp);
    window.removeEventListener("mousemove", this._onWindowMouseMove);
    window.removeEventListener("mouseup", this._onWindowMouseUp);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      window.removeEventListener("touchstart", this._onWindowTouchStartCapture, true);
      window.removeEventListener("touchmove", this._onWindowTouchMove);
      window.removeEventListener("touchend", this._onWindowTouchEnd);
      window.removeEventListener("touchcancel", this._onWindowTouchEnd);
    }
  }

  _getAvailableControlModes(state) {
    const modes = [];

    if (this._config?.show_brightness !== false && this._supportsBrightness(state)) {
      modes.push("brightness");
    }

    if (this._config?.show_temperature_controls !== false && this._supportsColorTemperature(state)) {
      modes.push("temperature");
    }

    if (this._config?.show_color_controls !== false && this._supportsColor(state)) {
      modes.push("color");
    }

    return modes;
  }

  _getActiveControlMode(state) {
    const availableModes = this._getAvailableControlModes(state);
    if (!availableModes.length) {
      return null;
    }

    if (availableModes.includes(this._activeControlMode)) {
      return this._activeControlMode;
    }

    this._activeControlMode = availableModes[0];
    return this._activeControlMode;
  }

  _getControlModeIcon(mode) {
    switch (mode) {
      case "temperature":
        return "mdi:thermometer";
      case "color":
        return "mdi:palette";
      case "brightness":
      default:
        return "mdi:brightness-6";
    }
  }

  _onShadowInput(event) {
    const slider = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.lightControl);

    if (!slider) {
      return;
    }

    event.stopPropagation();

    if (this._activeSliderDrag?.slider === slider) {
      return;
    }

    this._applySliderValue(slider, slider.value, { commit: false });
  }

  _onShadowChange(event) {
    const slider = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.lightControl);

    if (!slider) {
      return;
    }

    event.stopPropagation();
    if (this._skipNextSliderChange === slider) {
      this._skipNextSliderChange = null;
      return;
    }

    this._applySliderValue(slider, slider.value, { commit: true });
  }

  _onShadowClick(event) {
    const path = event.composedPath();
    const slider = path.find(
      node => node instanceof HTMLInputElement && node.dataset?.lightControl,
    );

    if (slider) {
      return;
    }

    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.lightAction);

    if (!actionButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const zone = actionButton.dataset.lightAction;
    if (zone === "body" || zone === "icon") {
      if (this._suppressNextLightTap) {
        this._suppressNextLightTap = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const effect = this._resolveTapEffect(zone);
      if (effect === "none") {
        return;
      }
      this._triggerHaptic();
      this._clearModeSwitchTransition();
      this._executeTapEffect(zone, effect);
      return;
    }

    this._triggerHaptic();

    switch (actionButton.dataset.lightAction) {
      case "mode":
        this._triggerButtonBounce(actionButton);
        if (this._modeSwitchPressTimer) {
          window.clearTimeout(this._modeSwitchPressTimer);
          this._modeSwitchPressTimer = 0;
        }
        this._modeSwitchPressTimer = window.setTimeout(() => {
          this._modeSwitchPressTimer = 0;
          this._startModeSwitchTransition(actionButton.dataset.mode || "brightness", this._getState());
        }, 180);
        break;
      case "brightness": {
        const value = Number(actionButton.dataset.value);
        this._draftBrightness.set(this._config.entity, clamp(Math.round(value), 1, 100));
        this._commitBrightness(value);
        this._render();
        break;
      }
      case "color": {
        const hs = String(actionButton.dataset.hs || "")
          .split(",")
          .map(value => Number(value));
        if (hs.length === 2 && hs.every(value => Number.isFinite(value))) {
          this._draftHue.set(this._config.entity, clamp(Math.round(hs[0]), 0, 360));
          this._commitColorPreset(hs);
          this._render();
        }
        break;
      }
      case "temperature":
        this._draftTemperature.set(this._config.entity, Math.round(Number(actionButton.dataset.kelvin)));
        this._commitTemperaturePreset(Number(actionButton.dataset.kelvin));
        this._render();
        break;
      case "toggle-controls-expand":
        if (this._config?.auto_expand === false) {
          this._controlsPanelUserOpen = !this._controlsPanelUserOpen;
          this._lastRenderSignature = "";
          this._render();
        }
        break;
      default:
        break;
    }
  }

  _renderEmptyState() {
    return `
      <ha-card class="light-card light-card--empty">
        <div class="light-card__empty-title">Nodalia Light Card</div>
        <div class="light-card__empty-text">Configura \`entity\` con una entidad \`light.*\` para mostrar la tarjeta.</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    if (!this._config) {
      this.shadowRoot.innerHTML = "";
      this._lastRenderSignature = "";
      return;
    }

    const state = this._getState();
    const config = this._config;
    const styles = config.styles;

    if (!state) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
          }

          * {
            box-sizing: border-box;
          }

          .light-card--empty {
            background: ${styles.card.background};
            border: ${styles.card.border};
            border-radius: ${styles.card.border_radius};
            box-shadow: ${styles.card.box_shadow};
            display: grid;
            gap: 6px;
            padding: ${styles.card.padding};
          }

          .light-card__empty-title {
            color: var(--primary-text-color);
            font-size: 15px;
            font-weight: 700;
          }

          .light-card__empty-text {
            color: var(--secondary-text-color);
            font-size: 13px;
            line-height: 1.5;
          }
        </style>
        ${this._renderEmptyState()}
      `;
      this._lastRenderSignature = this._getRenderSignature(state);
      return;
    }

    const isOn = state.state === "on";
    if (!isOn) {
      this._controlsPanelUserOpen = false;
    }
    const supportsBrightness = this._supportsBrightness(state);
    const supportsColor = this._supportsColor(state);
    const supportsColorTemperature = this._supportsColorTemperature(state);
    const brightnessPercent = this._getBrightnessPercent(state);
    const currentKelvin = this._getCurrentKelvin(state);
    const accentColor = this._getAccentColor(state);
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const title = this._getLightName(state);
    const icon = this._getLightIcon(state);
    const entityPicture = this._getEntityPicture(state);
    const showUnavailableBadge = isUnavailableState(state);
    const stateLabel = this._getStateLabel(state);
    const isCompactLayout = this._isCompactLayout;
    const isMiniLayout = this._shouldUseMiniLayout();
    const quickBrightness = Array.isArray(config.quick_brightness) ? config.quick_brightness : [];
    const temperaturePresets = this._getTemperaturePresets(state);
    const availableControlModes = isOn ? this._getAvailableControlModes(state) : [];
    const autoExpandControls = config.auto_expand !== false;
    const canShowDetailedControls = isOn && !isMiniLayout && availableControlModes.length > 0;
    const showDetailedControls = canShowDetailedControls && (autoExpandControls || this._controlsPanelUserOpen);
    const useSliderModeButtons = config.show_slider_mode_buttons !== false && availableControlModes.length > 1;
    const activeControlMode = isOn ? this._getActiveControlMode(state) : "brightness";
    const currentHue = this._getCurrentHue(state);
    const temperatureRange = this._getTemperatureRange(state);
    const temperatureControlDomain = this._getTemperatureControlDomain(state);
    const currentTemperatureSliderValue = this._kelvinToTemperatureSliderValue(currentKelvin, state);
    const temperatureProgress = temperatureControlDomain.max === temperatureControlDomain.min
      ? 0
      : ((currentTemperatureSliderValue - temperatureControlDomain.min) / (temperatureControlDomain.max - temperatureControlDomain.min)) * 100;
    const colorProgress = (currentHue / 360) * 100;
    let stateChipMarkup = "";
    let activeValueChipMarkup = "";
    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 52%, ${styles.card.background} 100%)`;
    const onCardBorder = `color-mix(in srgb, ${accentColor} 32%, var(--divider-color))`;
    const onCardShadow = `0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`;
    const animations = this._getAnimationSettings();
    const wasOn = this._lastRenderedIsOn;
    const now = Date.now();
    let powerAnimationState = "";
    let controlsAnimationState = "";

    if (!animations.enabled) {
      this._powerTransition = null;
      this._controlsTransition = null;
    } else if (wasOn !== null && wasOn !== isOn) {
      powerAnimationState = isOn ? "powering-up" : "powering-down";
      this._powerTransition = {
        endsAt: now + animations.powerDuration,
        startedAt: now,
        state: powerAnimationState,
      };

      if (!isMiniLayout) {
        if (isOn) {
          const willShowDetailedOnEnter = availableControlModes.length > 0
            && (autoExpandControls || this._controlsPanelUserOpen);
          if (willShowDetailedOnEnter) {
            controlsAnimationState = "entering";
            this._controlsTransition = {
              endsAt: now + animations.controlsDuration,
              startedAt: now,
              state: controlsAnimationState,
            };
          } else {
            this._controlsTransition = null;
          }
        } else if (this._lastControlsMarkup) {
          controlsAnimationState = "leaving";
          this._controlsTransition = {
            endsAt: now + animations.controlsDuration,
            startedAt: now,
            state: controlsAnimationState,
          };
        } else {
          this._controlsTransition = null;
        }
      } else {
        this._controlsTransition = null;
      }
    } else {
      if (this._powerTransition?.endsAt > now) {
        powerAnimationState = this._powerTransition.state;
      } else {
        this._powerTransition = null;
      }

      if (!isMiniLayout && this._controlsTransition?.endsAt > now) {
        controlsAnimationState = this._controlsTransition.state;
      } else {
        this._controlsTransition = null;
      }
    }

    const controlsTransitionStillActive = Boolean(this._controlsTransition?.endsAt > now);
    if (
      animations.enabled
      && !isMiniLayout
      && isOn
      && this._lastRenderedShowDetailedControls === true
      && !showDetailedControls
      && String(this._lastControlsMarkup || "").trim() !== ""
      && !controlsTransitionStillActive
    ) {
      controlsAnimationState = "leaving";
      this._controlsTransition = {
        endsAt: now + animations.controlsDuration,
        startedAt: now,
        state: "leaving",
      };
    }

    const modeTransition = this._modeTransition
      && isOn
      && useSliderModeButtons
      && availableControlModes.includes(this._modeTransition.from)
      && availableControlModes.includes(this._modeTransition.to)
      ? this._modeTransition
      : null;
    const displayedControlMode = modeTransition
      ? (modeTransition.phase === "collapsing" ? modeTransition.from : modeTransition.to)
      : activeControlMode;
    const modeTransitionAxisClass = animations.modeSwitchHorizontal
      ? "light-card__mode-panel-inner--horizontal"
      : "light-card__mode-panel-inner--vertical";
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const contentEntranceDuration = clamp(Math.round(animations.controlsDuration * 0.9), 180, 900);
    const shouldAnimateBrightnessFill = animations.enabled &&
      powerAnimationState === "powering-up" &&
      isOn &&
      showDetailedControls &&
      supportsBrightness &&
      !isMiniLayout;
    const brightnessFillDuration = shouldAnimateBrightnessFill
      ? clamp(Math.round(animations.controlsDuration * 0.82), 220, 1100)
      : 0;
    const brightnessSliderShellClass = shouldAnimateBrightnessFill ? " light-card__slider-shell--brightness-fill" : "";

    const statePosition = config.state_position === "below" ? "below" : "right";
    if (!isMiniLayout && config.show_state === true) {
      stateChipMarkup = `<span class="light-card__chip light-card__chip--state">${escapeHtml(stateLabel)}</span>`;
    }
    const stateChipHeaderMarkup = statePosition === "right" ? stateChipMarkup : "";
    const stateChipBelowMarkup = statePosition === "below" ? stateChipMarkup : "";

    const showControlsExpandToggle = canShowDetailedControls && !autoExpandControls;
    const controlsPanelToggleLabel = showControlsExpandToggle
      ? escapeHtml(this._controlsEditorStr(
        showDetailedControls ? "ed.light.collapse_controls_panel" : "ed.light.expand_controls_panel",
      ))
      : "";
    const controlsPanelToggleMarkup = showControlsExpandToggle
      ? `
          <button
            type="button"
            class="light-card__mode-button"
            data-light-action="toggle-controls-expand"
            aria-label="${controlsPanelToggleLabel}"
            title="${controlsPanelToggleLabel}"
          >
            <ha-icon icon="${showDetailedControls ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
          </button>
        `
      : "";

    if (showDetailedControls) {
      let activeValueChip = null;

      if (displayedControlMode === "temperature" && config.show_temperature_controls !== false && supportsColorTemperature) {
        activeValueChip = `${currentKelvin}K`;
      } else if (displayedControlMode === "color" && config.show_color_controls !== false && supportsColor) {
        activeValueChip = `${currentHue}°`;
      } else if (config.show_brightness !== false && supportsBrightness) {
        activeValueChip = `${Math.round(brightnessPercent)}%`;
      }

      if (activeValueChip) {
        activeValueChipMarkup = `
          <span class="light-card__active-chip-shell ${modeTransition ? `light-card__active-chip-shell--${modeTransition.phase}` : ""}">
            <span class="light-card__active-chip-inner">
              <span class="light-card__chip">${escapeHtml(activeValueChip)}</span>
            </span>
          </span>
        `;
      }
    }

    const activeValueChipHeaderMarkup = statePosition === "right" ? activeValueChipMarkup : "";
    const activeValueChipBelowMarkup = statePosition === "below" ? activeValueChipMarkup : "";
    const hasHeaderChips = Boolean(stateChipHeaderMarkup || activeValueChipHeaderMarkup || controlsPanelToggleMarkup);
    const hasBelowChips = Boolean(stateChipBelowMarkup || activeValueChipBelowMarkup);
    const showCopyBlock = !isMiniLayout && (!isCompactLayout || hasHeaderChips || hasBelowChips);
    const sliderInnerMarkup = showDetailedControls && availableControlModes.length > 0
      ? `
        ${
          displayedControlMode === "temperature"
            ? `
              <div class="light-card__slider-wrap">
                <div class="light-card__slider-shell" style="--temperature-progress:${clamp(temperatureProgress, 0, 100)};">
                  <div class="light-card__slider-track" data-light-control="temperature"></div>
                  <input
                    type="range"
                    class="light-card__slider"
                    data-light-control="temperature"
                    min="${temperatureControlDomain.min}"
                    max="${temperatureControlDomain.max}"
                    step="any"
                    value="${currentTemperatureSliderValue}"
                    style="--temperature-progress:${clamp(temperatureProgress, 0, 100)};"
                    aria-label="Temperature"
                  />
                  <div class="light-card__slider-thumb" data-light-control="temperature"></div>
                </div>
              </div>
            `
            : displayedControlMode === "color"
              ? `
                <div class="light-card__slider-wrap">
                  <div class="light-card__slider-shell" style="--color-progress:${clamp(colorProgress, 0, 100)};">
                    <div class="light-card__slider-track" data-light-control="color"></div>
                    <input
                      type="range"
                      class="light-card__slider"
                      data-light-control="color"
                      min="0"
                      max="360"
                      step="any"
                      value="${currentHue}"
                      style="--color-progress:${clamp(colorProgress, 0, 100)};"
                      aria-label="Color"
                    />
                    <div class="light-card__slider-thumb" data-light-control="color"></div>
                  </div>
                </div>
              `
              : `
                <div class="light-card__slider-wrap">
                  <div class="light-card__slider-shell${brightnessSliderShellClass}" style="--brightness:${brightnessPercent}; --brightness-target:${brightnessPercent};">
                    <div class="light-card__slider-track" data-light-control="brightness"></div>
                    <input
                      type="range"
                      class="light-card__slider"
                      data-light-control="brightness"
                      min="1"
                      max="100"
                      step="any"
                      value="${brightnessPercent}"
                      style="--brightness:${brightnessPercent};"
                      aria-label="Brillo"
                    />
                  </div>
                </div>
              `
        }
      `
      : "";
    const sliderSectionMarkup = sliderInnerMarkup
      ? `
        <div class="light-card__section">
          <div class="light-card__slider-row">
            ${
              useSliderModeButtons
                ? `
                  <div class="light-card__mode-panel">
                    <div class="light-card__mode-panel-inner ${modeTransition ? `light-card__mode-panel-inner--${modeTransition.phase}` : ""} ${modeTransitionAxisClass}">
                      ${sliderInnerMarkup}
                    </div>
                  </div>
                `
                : sliderInnerMarkup
            }
            ${
              useSliderModeButtons
                ? `
                  <div class="light-card__mode-actions">
                      ${availableControlModes
                        .filter(mode => mode !== displayedControlMode)
                        .map(mode => `
                          <button
                            type="button"
                            class="light-card__mode-button"
                            data-light-action="mode"
                            data-mode="${mode}"
                            ${modeTransition ? "disabled" : ""}
                            aria-label="${mode === "brightness" ? "Show brightness" : mode === "temperature" ? "Show temperature" : "Show color"}"
                          >
                            <ha-icon icon="${this._getControlModeIcon(mode)}"></ha-icon>
                          </button>
                        `)
                        .join("")}
                  </div>
                `
                : ""
            }
          </div>
        </div>
      `
      : "";
    const brightnessPresetsMarkup = showDetailedControls &&
      displayedControlMode === "brightness" &&
      config.show_quick_brightness !== false &&
      supportsBrightness &&
      quickBrightness.length
      ? `
        <div class="light-card__actions">
          ${quickBrightness
            .map(value => `
              <button
                type="button"
                class="light-card__brightness-preset ${value === brightnessPercent ? "is-active" : ""}"
                data-light-action="brightness"
                data-value="${value}"
              >
                ${escapeHtml(`${value}%`)}
              </button>
            `)
            .join("")}
        </div>
      `
      : "";
    const temperatureControlsMarkup = showDetailedControls &&
      !useSliderModeButtons &&
      config.show_temperature_controls !== false &&
      supportsColorTemperature
      ? `
        <div class="light-card__section">
          <div class="light-card__section-header">
            <span>Temperatura</span>
            <span class="light-card__section-value">${escapeHtml(`${currentKelvin}K`)}</span>
          </div>
          <div class="light-card__actions">
            ${temperaturePresets
              .map(item => `
                <button
                  type="button"
                  class="light-card__temperature-preset ${Math.abs(item.kelvin - currentKelvin) <= 250 ? "is-active" : ""}"
                  data-light-action="temperature"
                  data-kelvin="${item.kelvin}"
                >
                  ${escapeHtml(item.label)}
                </button>
              `)
              .join("")}
          </div>
        </div>
      `
      : "";
    const colorControlsMarkup = showDetailedControls &&
      !useSliderModeButtons &&
      config.show_color_controls !== false &&
      supportsColor
      ? `
        <div class="light-card__section">
          <div class="light-card__section-header">
            <span>Color</span>
            <span class="light-card__section-value">Presets</span>
          </div>
          <div class="light-card__actions">
            ${COLOR_PRESETS
              .map(item => `
                <button
                  type="button"
                  class="light-card__color-preset"
                  style="--swatch-color:${escapeHtml(item.color)};"
                  data-light-action="color"
                  data-hs="${escapeHtml(item.hs.join(","))}"
                  aria-label="${escapeHtml(item.label)}"
                  title="${escapeHtml(item.label)}"
                ></button>
              `)
              .join("")}
          </div>
        </div>
      `
      : "";
    const currentControlsMarkup = [
      sliderSectionMarkup,
      brightnessPresetsMarkup,
      temperatureControlsMarkup,
      colorControlsMarkup,
    ].filter(Boolean).join("");
    const controlsContentMarkup = showDetailedControls && currentControlsMarkup
      ? currentControlsMarkup
      : controlsAnimationState === "leaving"
        ? this._lastControlsMarkup
        : "";
    const controlsShellMarkup = !isMiniLayout && controlsContentMarkup
      ? `
        <div class="light-card__controls-shell ${controlsAnimationState ? `light-card__controls-shell--${controlsAnimationState}` : ""}">
          <div class="light-card__controls-inner">
            ${controlsContentMarkup}
          </div>
        </div>
      `
      : "";
    const powerAnimationRemaining = powerAnimationState && this._powerTransition
      ? Math.max(0, this._powerTransition.endsAt - now)
      : 0;
    const powerAnimationDelay = powerAnimationState && this._powerTransition
      ? -clamp(now - Number(this._powerTransition.startedAt || now), 0, animations.powerDuration)
      : 0;
    const controlsAnimationRemaining = controlsAnimationState && this._controlsTransition
      ? Math.max(0, this._controlsTransition.endsAt - now)
      : 0;
    const controlsAnimationDelay = controlsAnimationState && this._controlsTransition
      ? -clamp(now - Number(this._controlsTransition.startedAt || now), 0, animations.controlsDuration)
      : 0;
    const brightnessFillAnimationRemaining = shouldAnimateBrightnessFill
      ? brightnessFillDuration
      : 0;
    const shouldCleanupAfterAnimation = Boolean(powerAnimationRemaining || controlsAnimationRemaining || brightnessFillAnimationRemaining);
    const cleanupDelay = shouldCleanupAfterAnimation
      ? Math.max(powerAnimationRemaining, controlsAnimationRemaining, brightnessFillAnimationRemaining) + 40
      : 0;

    if (isOn && showDetailedControls && currentControlsMarkup) {
      this._lastControlsMarkup = currentControlsMarkup;
    } else if (isOn && !showDetailedControls && controlsAnimationState !== "leaving") {
      this._lastControlsMarkup = "";
    } else if (!isOn && controlsAnimationState !== "leaving") {
      this._lastControlsMarkup = "";
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --light-card-content-duration: ${animations.enabled ? contentEntranceDuration : 0}ms;
          display: block;
          width: 100%;
        }

        * {
          box-sizing: border-box;
        }

        ha-card.light-card {
          --light-card-controls-max-height: 420px;
          --light-card-controls-gap: calc(${styles.card.gap} + 4px);
          --light-card-controls-duration: ${animations.controlsDuration}ms;
          --light-card-mode-duration: ${Math.max(100, Math.round(animations.modeSwitchDuration / 2))}ms;
          --light-card-mode-shell-height: ${styles.slider_wrap_height};
          --light-card-power-duration: ${animations.powerDuration}ms;
          --light-card-power-delay: ${powerAnimationDelay}ms;
          --light-card-controls-delay: ${controlsAnimationDelay}ms;
          --light-card-brightness-fill-delay: 0ms;
          --light-card-brightness-fill-duration: ${brightnessFillDuration}ms;
          --light-card-brightness-empty-duration: ${animations.controlsDuration}ms;
          --light-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          background: ${isOn ? onCardBackground : styles.card.background};
          border: ${isOn ? `1px solid ${onCardBorder}` : styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${isOn ? `${styles.card.box_shadow}, ${onCardShadow}` : styles.card.box_shadow};
          display: block;
          isolation: isolate;
          overflow: hidden;
          padding: ${styles.card.padding};
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .light-card.is-off {
          cursor: pointer;
        }

        .light-card--compact.is-off {
          align-items: center;
          display: flex;
          min-height: 100%;
        }

        .light-card--mini {
          align-items: center;
          display: flex;
          justify-content: center;
          min-height: 100%;
        }

        .light-card::before {
          background: ${isOn
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0))"};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .light-card::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%);
          content: "";
          inset: 0;
          opacity: ${isOn ? "1" : "0"};
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .light-card--powering-up {
          animation: light-card-power-up var(--light-card-power-duration) cubic-bezier(0.24, 0.82, 0.25, 1) var(--light-card-power-delay) both;
        }

        .light-card--powering-down {
          animation: light-card-power-down var(--light-card-power-duration) cubic-bezier(0.32, 0, 0.24, 1) var(--light-card-power-delay) both;
        }

        .light-card--powering-up::after {
          animation: light-card-power-glow-in var(--light-card-power-duration) cubic-bezier(0.24, 0.82, 0.25, 1) var(--light-card-power-delay) both;
        }

        .light-card--powering-down::after {
          animation: light-card-power-glow-out var(--light-card-power-duration) cubic-bezier(0.32, 0, 0.24, 1) var(--light-card-power-delay) both;
        }

        .light-card__content {
          display: grid;
          gap: 0;
          position: relative;
          z-index: 1;
        }

        .light-card__content--entering {
          animation: light-card-fade-up var(--light-card-content-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .light-card--mini .light-card__content {
          align-content: center;
          justify-items: center;
          min-height: 100%;
          width: 100%;
        }

        .light-card--compact.is-off .light-card__content {
          align-content: center;
          min-height: 100%;
          width: 100%;
        }

        .light-card__hero {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: ${styles.icon.size} minmax(0, 1fr);
          min-width: 0;
        }

        .light-card--mini .light-card__hero {
          gap: 0;
          grid-template-columns: 1fr;
          justify-items: center;
        }

        .light-card--compact .light-card__hero {
          gap: 10px;
          grid-template-columns: 1fr;
          justify-items: center;
        }

        .light-card--compact.is-off .light-card__hero {
          align-content: center;
        }

        .light-card--compact.is-off:not(.light-card--with-copy) .light-card__hero {
          gap: 0;
        }

        .light-card__icon,
        .light-card__brightness-preset,
        .light-card__temperature-preset,
        .light-card__color-preset {
          align-items: center;
          appearance: none;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          justify-content: center;
          line-height: 0;
          padding: 0;
          position: relative;
        }

        .light-card__icon {
          background: ${isOn
            ? `color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))`
            : "color-mix(in srgb, var(--primary-text-color) 6%, transparent)"};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${isOn ? styles.icon.on_color : styles.icon.off_color};
          cursor: pointer;
          height: ${styles.icon.size};
          width: ${styles.icon.size};
        }

        .light-card--mini .light-card__icon {
          height: min(${styles.icon.size}, calc(100vw - 48px));
          width: min(${styles.icon.size}, calc(100vw - 48px));
        }

        .light-card__icon ha-icon {
          align-items: center;
          display: inline-flex;
          height: 22px;
          justify-content: center;
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 22px;
          z-index: 1;
        }

        .light-card__icon ha-icon {
          color: ${isOn ? styles.icon.color : styles.icon.off_color};
          font-size: 26px;
        }

        .light-card__picture {
          border-radius: inherit;
          height: 100%;
          inset: 0;
          object-fit: cover;
          pointer-events: none;
          position: absolute;
          width: 100%;
        }

        .light-card__unavailable-badge {
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

        .light-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          color: inherit;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .light-card__copy {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .light-card__copy-header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
          min-width: 0;
          width: 100%;
        }

        .light-card--compact .light-card__copy {
          width: 100%;
        }

        .light-card--compact .light-card__copy-header {
          justify-content: flex-end;
          width: 100%;
        }

        .light-card__title {
          color: var(--primary-text-color);
          flex: 1 1 auto;
          font-size: ${styles.title_size};
          font-weight: 700;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .light-card__chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
          margin-left: auto;
          min-width: 0;
        }

        .light-card__chips--below {
          justify-content: flex-start;
          margin-left: 0;
        }

        .light-card--compact .light-card__chips {
          justify-content: flex-end;
        }

        .light-card__chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: ${chipBorderRadius};
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: ${styles.chip_font_size};
          font-weight: 600;
          line-height: 1;
          min-height: ${styles.chip_height};
          padding: ${styles.chip_padding};
        }

        .light-card__chip--state {
          color: var(--primary-text-color);
        }

        .light-card__active-chip-shell {
          backface-visibility: hidden;
          display: inline-flex;
          overflow: hidden;
          will-change: opacity, transform;
          transform-origin: right center;
        }

        .light-card__active-chip-inner {
          backface-visibility: hidden;
          display: inline-flex;
          opacity: 1;
          transform: none;
          will-change: opacity, transform;
          transform-origin: right center;
        }

        .light-card__active-chip-shell--collapsing .light-card__active-chip-inner {
          animation: light-card-mode-chip-out var(--light-card-mode-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
        }

        .light-card__active-chip-shell--expanding .light-card__active-chip-inner {
          animation: light-card-mode-chip-in var(--light-card-mode-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .light-card__section {
          display: grid;
          gap: 10px;
        }

        .light-card__controls-shell {
          backface-visibility: hidden;
          margin-top: var(--light-card-controls-gap);
          overflow: hidden;
          will-change: margin-top, max-height, opacity;
        }

        .light-card__controls-inner {
          backface-visibility: hidden;
          display: grid;
          gap: 10px;
          will-change: opacity, transform;
        }

        .light-card__mode-panel {
          align-items: center;
          backface-visibility: hidden;
          display: grid;
          min-height: var(--light-card-mode-shell-height);
          overflow: hidden;
          will-change: opacity, transform;
          width: 100%;
        }

        .light-card__mode-panel-inner {
          backface-visibility: hidden;
          display: grid;
          opacity: 1;
          transform: none;
          will-change: opacity, transform;
          width: 100%;
        }

        .light-card__mode-panel-inner--horizontal.light-card__mode-panel-inner--collapsing {
          animation: light-card-mode-slider-out-horizontal var(--light-card-mode-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          pointer-events: none;
          transform-origin: right center;
        }

        .light-card__mode-panel-inner--horizontal.light-card__mode-panel-inner--expanding {
          animation: light-card-mode-slider-in-horizontal var(--light-card-mode-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          pointer-events: none;
          transform-origin: right center;
        }

        .light-card__mode-panel-inner--vertical.light-card__mode-panel-inner--collapsing {
          animation: light-card-mode-slider-out-vertical var(--light-card-mode-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          pointer-events: none;
          transform-origin: center;
        }

        .light-card__mode-panel-inner--vertical.light-card__mode-panel-inner--expanding {
          animation: light-card-mode-slider-in-vertical var(--light-card-mode-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          pointer-events: none;
          transform-origin: center;
        }

        .light-card__controls-shell--entering {
          animation: light-card-controls-expand var(--light-card-controls-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--light-card-controls-delay) both;
          overflow: visible;
          transform-origin: top;
        }

        .light-card__controls-shell--entering .light-card__controls-inner {
          animation: light-card-controls-content-in var(--light-card-controls-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--light-card-controls-delay) both;
          transform-origin: top;
        }

        .light-card__controls-shell--leaving {
          animation: light-card-controls-collapse var(--light-card-controls-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--light-card-controls-delay) both;
          pointer-events: none;
          transform-origin: top;
        }

        .light-card__controls-shell--leaving .light-card__controls-inner {
          animation: light-card-controls-content-out var(--light-card-controls-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--light-card-controls-delay) both;
          transform-origin: top;
        }

        .light-card__section-header {
          align-items: center;
          color: var(--secondary-text-color);
          display: flex;
          font-size: 12px;
          font-weight: 600;
          justify-content: space-between;
          min-width: 0;
        }

        .light-card__section-value {
          color: var(--primary-text-color);
          font-variant-numeric: tabular-nums;
        }

        .light-card__slider-wrap {
          --light-card-slider-input-height: max(44px, var(--light-card-slider-thumb-size));
          --light-card-slider-thumb-size: calc(${styles.slider_thumb_size} + 12px);
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          display: grid;
          min-height: ${styles.slider_wrap_height};
          padding: 0 16px;
        }

        .light-card__slider-shell {
          min-width: 0;
          overflow: visible;
          position: relative;
          width: 100%;
        }

        .light-card__slider-track {
          border-radius: 999px;
          height: ${styles.slider_height};
          left: 0;
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
        }

        .light-card__slider-thumb {
          display: none;
          pointer-events: none;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%) scale(1);
          transition: transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
          z-index: 2;
        }

        .light-card__slider-thumb[data-light-control="temperature"],
        .light-card__slider-thumb[data-light-control="color"] {
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.84) 0%,
              rgba(255, 255, 255, 0.62) 100%
            );
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 18%, transparent);
          border-radius: 999px;
          box-shadow:
            0 10px 24px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 24%, transparent);
          display: block;
          height: calc(${styles.slider_height} + 10px);
          -webkit-backdrop-filter: blur(12px);
          backdrop-filter: blur(12px);
          width: calc(${styles.slider_thumb_size} - 4px);
        }

        .light-card__slider-shell.is-dragging .light-card__slider-thumb[data-light-control="temperature"],
        .light-card__slider-shell.is-dragging .light-card__slider-thumb[data-light-control="color"] {
          transform: translate(-50%, -50%) scale(1.08);
        }

        .light-card__slider-thumb[data-light-control="temperature"] {
          left: clamp(
            calc((${styles.slider_thumb_size} - 4px) / 2),
            calc(var(--temperature-progress, ${clamp(temperatureProgress, 0, 100)}) * 1%),
            calc(100% - ((${styles.slider_thumb_size} - 4px) / 2))
          );
        }

        .light-card__slider-thumb[data-light-control="color"] {
          left: clamp(
            calc((${styles.slider_thumb_size} - 4px) / 2),
            calc(var(--color-progress, ${clamp(colorProgress, 0, 100)}) * 1%),
            calc(100% - ((${styles.slider_thumb_size} - 4px) / 2))
          );
        }

        .light-card__slider-thumb[data-light-control="temperature"]::before,
        .light-card__slider-thumb[data-light-control="color"]::before {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 999px;
          content: "";
          height: calc(100% - 12px);
          left: 50%;
          position: absolute;
          top: 6px;
          transform: translateX(-50%);
          width: 3px;
        }

        .light-card__slider-thumb[data-light-control="temperature"]::after,
        .light-card__slider-thumb[data-light-control="color"]::after {
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: inherit;
          content: "";
          inset: 0;
          position: absolute;
        }

        .light-card__slider-track[data-light-control="brightness"] {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          overflow: hidden;
        }

        .light-card__slider-track[data-light-control="brightness"]::before {
          background: ${styles.slider_color};
          border-radius: inherit;
          content: "";
          inset: 0;
          position: absolute;
          transform: scaleX(calc(var(--brightness, ${brightnessPercent}) / 100));
          transform-origin: left center;
        }

        .light-card__slider-shell--brightness-fill .light-card__slider-track[data-light-control="brightness"]::before {
          animation: light-card-brightness-fill var(--light-card-brightness-fill-duration) cubic-bezier(0.2, 0.86, 0.18, 1) var(--light-card-brightness-fill-delay) both;
        }

        .light-card__controls-shell--leaving .light-card__slider-track[data-light-control="brightness"]::before {
          animation: light-card-brightness-empty var(--light-card-brightness-empty-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
        }

        .light-card__slider-track[data-light-control="temperature"] {
          background: linear-gradient(
            90deg,
            #f4b55f 0%,
            #ffd166 32%,
            #fff1c1 56%,
            #8fd3ff 100%
          );
        }

        .light-card__slider-track[data-light-control="color"] {
          background: linear-gradient(
            90deg,
            #ff4d6d 0%,
            #ff9f1c 17%,
            #ffe66d 33%,
            #4cd964 50%,
            #4dabf7 67%,
            #845ef7 83%,
            #ff4d6d 100%
          );
        }

        .light-card__slider-row {
          align-items: center;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          padding-inline: 4px;
        }

        .light-card__mode-actions {
          display: flex;
          gap: 10px;
        }

        .light-card__mode-button {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: ${styles.control.size};
          justify-content: center;
          line-height: 0;
          min-width: ${styles.control.size};
          padding: 0;
          position: relative;
          transform: scale(1);
          transform-origin: center;
          transition: transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
          width: ${styles.control.size};
        }

        .light-card__mode-button ha-icon {
          --mdc-icon-size: 20px;
          align-items: center;
          display: inline-flex;
          justify-content: center;
        }

        .light-card__mode-button:disabled {
          cursor: default;
          opacity: 0.58;
        }

        :is(
          .light-card__icon,
          .light-card__mode-button,
          .light-card__brightness-preset,
          .light-card__temperature-preset,
          .light-card__color-preset
        ) {
          transform: scale(1);
          transform-origin: center;
          transition: transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
        }

        :is(
          .light-card__icon,
          .light-card__mode-button,
          .light-card__brightness-preset,
          .light-card__temperature-preset,
          .light-card__color-preset
        ):active:not(:disabled),
        :is(
          .light-card__icon,
          .light-card__mode-button,
          .light-card__brightness-preset,
          .light-card__temperature-preset,
          .light-card__color-preset
        ).is-pressing:not(:disabled) {
          animation: light-card-button-bounce var(--light-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .light-card__slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          box-sizing: border-box;
          cursor: pointer;
          display: block;
          height: var(--light-card-slider-input-height);
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
          width: 100%;
          z-index: 1;
        }

        .light-card__slider::-webkit-slider-runnable-track {
          background: transparent;
          border-radius: 999px;
          height: ${styles.slider_height};
        }

        .light-card__slider::-moz-range-progress {
          background: transparent;
          border: 0;
          height: ${styles.slider_height};
        }

        .light-card__slider::-moz-range-track {
          background: transparent;
          border: 0;
          border-radius: 999px;
          height: ${styles.slider_height};
        }

        .light-card__slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
          cursor: pointer;
          height: ${styles.slider_thumb_size};
          margin-top: calc((${styles.slider_height} - ${styles.slider_thumb_size}) / 2);
          width: ${styles.slider_thumb_size};
        }

        .light-card__slider::-moz-range-thumb {
          background: transparent;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
          cursor: pointer;
          height: ${styles.slider_thumb_size};
          width: ${styles.slider_thumb_size};
        }

        .light-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .light-card__brightness-preset,
        .light-card__temperature-preset {
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color: var(--primary-text-color);
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          height: 34px;
          min-width: 46px;
          padding: 0 12px;
        }

        .light-card__brightness-preset.is-active,
        .light-card__temperature-preset.is-active {
          background: ${styles.control.accent_background};
          color: ${styles.control.accent_color};
        }

        .light-card__color-preset {
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          height: 32px;
          width: 32px;
        }

        .light-card__color-preset::after {
          background: var(--swatch-color);
          border-radius: inherit;
          content: "";
          inset: 5px;
          position: absolute;
        }

        @keyframes light-card-power-up {
          0% {
            background: ${styles.card.background};
            box-shadow: ${styles.card.box_shadow};
            transform: scale(0.994);
          }
          55% {
            background: linear-gradient(135deg, color-mix(in srgb, ${accentColor} 26%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 14%, ${styles.card.background}) 52%, ${styles.card.background} 100%);
            box-shadow: ${styles.card.box_shadow}, 0 12px 26px color-mix(in srgb, ${accentColor} 12%, rgba(0, 0, 0, 0.16));
            transform: scale(1);
          }
          100% {
            background: ${onCardBackground};
            box-shadow: ${styles.card.box_shadow}, ${onCardShadow};
            transform: scale(1);
          }
        }

        @keyframes light-card-power-down {
          0% {
            background: ${onCardBackground};
            box-shadow: ${styles.card.box_shadow}, ${onCardShadow};
            transform: scale(1);
          }
          100% {
            background: ${styles.card.background};
            box-shadow: ${styles.card.box_shadow};
            transform: scale(1);
          }
        }

        @keyframes light-card-power-glow-in {
          0% {
            opacity: 0;
          }
          45% {
            opacity: 1;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes light-card-power-glow-out {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes light-card-brightness-fill {
          0% {
            transform: scaleX(0.01);
          }
          100% {
            transform: scaleX(calc(var(--brightness-target, var(--brightness, ${brightnessPercent})) / 100));
          }
        }

        @keyframes light-card-brightness-empty {
          100% {
            transform: scaleX(0.01);
          }
        }

        @keyframes light-card-controls-expand {
          0% {
            margin-top: 0;
            max-height: 0;
            opacity: 0;
          }
          100% {
            margin-top: var(--light-card-controls-gap);
            max-height: var(--light-card-controls-max-height);
            opacity: 1;
          }
        }

        @keyframes light-card-controls-collapse {
          0% {
            margin-top: var(--light-card-controls-gap);
            max-height: var(--light-card-controls-max-height);
            opacity: 1;
          }
          100% {
            margin-top: 0;
            max-height: 0;
            opacity: 0;
          }
        }

        @keyframes light-card-controls-content-in {
          0% {
            opacity: 0;
            transform: translateY(-10px) scaleY(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes light-card-controls-content-out {
          0% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.94);
          }
        }

        @keyframes light-card-mode-slider-out-horizontal {
          0% {
            opacity: 1;
            transform: scaleX(1);
          }
          100% {
            opacity: 0;
            transform: scaleX(0.18);
          }
        }

        @keyframes light-card-mode-slider-in-horizontal {
          0% {
            opacity: 0;
            transform: scaleX(0.18);
          }
          100% {
            opacity: 1;
            transform: scaleX(1);
          }
        }

        @keyframes light-card-mode-slider-out-vertical {
          0% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-4px) scaleY(0.42);
          }
        }

        @keyframes light-card-mode-slider-in-vertical {
          0% {
            opacity: 0;
            transform: translateY(4px) scaleY(0.42);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes light-card-mode-chip-out {
          0% {
            opacity: 1;
            transform: scaleX(1);
          }
          100% {
            opacity: 0;
            transform: scaleX(0.25);
          }
        }

        @keyframes light-card-mode-chip-in {
          0% {
            opacity: 0;
            transform: scaleX(0.25);
          }
          100% {
            opacity: 1;
            transform: scaleX(1);
          }
        }

        @keyframes light-card-button-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.08);
          }
          72% {
            transform: scale(1.03);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes light-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        ${animations.enabled ? "" : `
        .light-card,
        .light-card::after,
        .light-card__controls-shell,
        .light-card__controls-inner,
        .light-card__mode-panel,
        .light-card__mode-panel-inner,
        .light-card__mode-actions,
        .light-card__active-chip-inner,
        .light-card__icon,
        .light-card__mode-button,
        .light-card__brightness-preset,
        .light-card__temperature-preset,
        .light-card__color-preset,
        .light-card__slider-thumb,
        .light-card * {
          animation: none !important;
          transition: none !important;
        }
        `}

        @media (prefers-reduced-motion: reduce) {
          .light-card,
          .light-card::after,
          .light-card__controls-shell,
          .light-card__controls-inner,
          .light-card__mode-panel,
          .light-card__mode-panel-inner,
          .light-card__mode-actions,
          .light-card__active-chip-inner,
          .light-card__icon,
          .light-card__mode-button,
          .light-card__brightness-preset,
          .light-card__temperature-preset,
          .light-card__color-preset,
          .light-card__slider-thumb {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 420px) {
          .light-card__hero {
            grid-template-columns: 50px minmax(0, 1fr);
          }

          .light-card__icon {
            height: 50px;
            width: 50px;
          }
        }
      </style>
      <ha-card
        class="light-card ${isOn ? "is-on" : "is-off"} ${isCompactLayout ? "light-card--compact" : ""} ${isMiniLayout ? "light-card--mini" : ""} ${showCopyBlock ? "light-card--with-copy" : ""} ${powerAnimationState ? `light-card--${powerAnimationState}` : ""}"
        style="--accent-color:${escapeHtml(accentColor)};"
        data-light-action="body"
      >
        <div class="light-card__content ${shouldAnimateEntrance ? "light-card__content--entering" : ""}">
          <div class="light-card__hero">
            <button
              type="button"
              class="light-card__icon"
              data-light-action="icon"
              aria-label="${escapeHtml(window.NodaliaI18n?.translateCommonAria?.(this._hass, config.language ?? "auto", "togglePower", "Turn on or off") || "Turn on or off")}"
            >
              ${entityPicture
                ? `<img class="light-card__picture" src="${escapeHtml(entityPicture)}" alt="" loading="lazy" />`
                : `<ha-icon icon="${escapeHtml(icon)}"></ha-icon>`}
              ${showUnavailableBadge ? `<span class="light-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopyBlock
              ? `
                <div class="light-card__copy">
                  <div class="light-card__copy-header">
                    ${isCompactLayout ? "" : `<div class="light-card__title">${escapeHtml(title)}</div>`}
                    ${hasHeaderChips ? `<div class="light-card__chips">${stateChipHeaderMarkup}${activeValueChipHeaderMarkup}${controlsPanelToggleMarkup}</div>` : ""}
                  </div>
                  ${hasBelowChips ? `<div class="light-card__chips light-card__chips--below">${stateChipBelowMarkup}${activeValueChipBelowMarkup}</div>` : ""}
                </div>
              `
              : ""}
          </div>
          ${controlsShellMarkup}
        </div>
      </ha-card>
    `;

    this._lastRenderedIsOn = isOn;
    this._lastRenderedShowDetailedControls = showDetailedControls;
    this._lastRenderSignature = this._getRenderSignature(state);

    if (shouldCleanupAfterAnimation) {
      this._scheduleAnimationCleanup(cleanupDelay);
    } else if (this._animationCleanupTimer) {
      window.clearTimeout(this._animationCleanupTimer);
      this._animationCleanupTimer = 0;
    }

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(contentEntranceDuration + 120);
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaLightCard);
}

class NodaliaLightCardEditor extends HTMLElement {
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
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id => id.startsWith("light."));
  }

  _getLightEntityOptions() {
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => entityId.startsWith("light."))
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
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      case "csv": {
        const values = arrayFromCsv(input.value)
          .map(value => Number(value))
          .filter(value => Number.isFinite(value))
          .map(value => clamp(Math.round(value), 1, 100));
        return values.length ? values : undefined;
      }
      case "number": {
        const numericValue = Number(input.value);
        return Number.isFinite(numericValue) ? Math.round(numericValue) : undefined;
      }
      case "csv_string": {
        const values = String(input.value || "")
          .split(",")
          .map(item => item.trim().toLowerCase())
          .filter(Boolean);
        return values.length ? values : undefined;
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

    switch (toggleButton.dataset.editorToggle) {
      case "styles":
        this._showStyleSection = !this._showStyleSection;
        this._render();
        break;
      case "animations":
        this._showAnimationSection = !this._showAnimationSection;
        this._render();
        break;
      default:
        break;
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
    const min = options.min !== undefined ? `min="${escapeHtml(String(options.min))}"` : "";
    const max = options.max !== undefined ? `max="${escapeHtml(String(options.max))}"` : "";
    const step = options.step !== undefined ? `step="${escapeHtml(String(options.step))}"` : "";
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
          ${min}
          ${max}
          ${step}
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

  _renderSelectField(label, field, value, selectOptions, layout = {}) {
    const tLabel = this._editorLabel(label);
    const fullClass = layout.fullWidth ? " editor-field--full" : "";
    return `
      <label class="editor-field${fullClass}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${selectOptions
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

  _renderLightEntityField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="light-entity"
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

  _getEntityOptionsMarkup() {
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const entityIds = Object.keys(this._hass?.states || {})
      .filter(entityId => entityId.startsWith("light."))
      .sort((left, right) => left.localeCompare(right, sortLoc));

    if (!entityIds.length) {
      return "";
    }

    return `
      <datalist id="light-card-entities">
        ${entityIds.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
    `;
  }

  _mountLightEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = ["light"];
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => String(stateObj?.entity_id || "").startsWith("light.");
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: {
          domain: "light",
        },
      };
    } else {
      control = document.createElement("select");
      this._getLightEntityOptions().forEach(option => {
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
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";
    const phLightName = this._editorLabel("ed.light.name_placeholder");
    const tapAction = config.tap_action || "toggle";
    const iconTapAction = config.icon_tap_action || "toggle";
    const showIconTapService = iconTapAction === "service";
    const showCardTapService = tapAction === "service";
    const holdAction = config.hold_action || "none";
    const iconHoldSelect = String(config.icon_hold_action ?? "").trim();
    const showCardHoldService = holdAction === "service";
    const showIconHoldService = iconHoldSelect === "service" || (iconHoldSelect === "" && holdAction === "service");
    const showTapServiceSecurity = showIconTapService || showCardTapService || showCardHoldService || showIconHoldService;

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
          min-height: 88px;
          resize: vertical;
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

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
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
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.general_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderLightEntityField("ed.light.light_entity", "entity", config.entity, {
              placeholder: "light.salon",
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, {
              placeholder: "mdi:lightbulb",
              fallbackIcon: "mdi:lightbulb",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: phLightName,
              fullWidth: true,
            })}
            ${this._renderCheckboxField("ed.entity.show_entity_picture", "show_entity_picture", config.show_entity_picture === true)}
            ${this._renderTextField("ed.entity.entity_picture", "entity_picture", config.entity_picture, {
              placeholder: "/local/light.png",
              fullWidth: true,
            })}
            ${this._renderTextField(
              "ed.light.quick_brightness",
              "quick_brightness",
              Array.isArray(config.quick_brightness) ? config.quick_brightness.join(", ") : "",
              {
                valueType: "csv",
                placeholder: this._editorLabel("ed.light.quick_brightness_placeholder"),
                fullWidth: true,
              },
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderSelectField(
              "ed.light.icon_tap_action",
              "icon_tap_action",
              iconTapAction,
              [
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.light.card_tap_action",
              "tap_action",
              tapAction,
              [
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${
              showIconTapService
                ? `
                  ${this._renderTextField("ed.entity.tap_service_field", "icon_tap_service", config.icon_tap_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.tap_service_data_json", "icon_tap_service_data", config.icon_tap_service_data, {
                    placeholder: '{"brightness_pct": 50}',
                  })}
                `
                : ""
            }
            ${
              showCardTapService
                ? `
                  ${this._renderTextField("ed.entity.tap_service_field", "tap_service", config.tap_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.tap_service_data_json", "tap_service_data", config.tap_service_data, {
                    placeholder: '{"brightness_pct": 70}',
                  })}
                `
                : ""
            }
            ${
              showTapServiceSecurity
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
                            valueType: "csv_string",
                            fullWidth: true,
                          },
                        )
                      : ""
                  }
                `
                : ""
            }
            ${
              iconTapAction === "url"
                ? `
                  ${this._renderTextField("ed.entity.tap_url_field", "icon_tap_url", config.icon_tap_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.tap_new_tab", "icon_tap_new_tab", config.icon_tap_new_tab === true)}
                `
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
            <div class="editor-section__hint editor-field--full" style="margin-top: 8px;">${escapeHtml(this._editorLabel("ed.light.hold_actions_section_hint"))}</div>
            ${this._renderSelectField(
              "ed.light.icon_hold_action",
              "icon_hold_action",
              iconHoldSelect,
              [
                { value: "", label: "ed.entity.icon_hold_inherit" },
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.light.card_hold_action",
              "hold_action",
              holdAction,
              [
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${
              showIconHoldService
                ? `
                  ${this._renderTextField("ed.entity.hold_service_field", "icon_hold_service", config.icon_hold_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.hold_service_data_json", "icon_hold_service_data", config.icon_hold_service_data, {
                    placeholder: '{"brightness_pct": 50}',
                  })}
                `
                : ""
            }
            ${
              showCardHoldService
                ? `
                  ${this._renderTextField("ed.entity.hold_service_field", "hold_service", config.hold_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.hold_service_data_json", "hold_service_data", config.hold_service_data, {
                    placeholder: '{"brightness_pct": 70}',
                  })}
                `
                : ""
            }
            ${
              iconHoldSelect === "url" || (iconHoldSelect === "" && holdAction === "url")
                ? `
                  ${this._renderTextField("ed.entity.hold_url_field", "icon_hold_url", config.icon_hold_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.hold_new_tab", "icon_hold_new_tab", config.icon_hold_new_tab === true)}
                `
                : ""
            }
            ${
              holdAction === "url"
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.visibility_section_hint"))}</div>
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
            ${this._renderCheckboxField("ed.light.show_state_bubble", "show_state", config.show_state === true)}
            ${this._renderSelectField(
              "ed.light.state_position_label",
              "state_position",
              config.state_position || "right",
              [
                { value: "right", label: "ed.entity.state_right" },
                { value: "below", label: "ed.entity.state_below" },
              ],
            )}
            ${this._renderCheckboxField("ed.light.show_brightness", "show_brightness", config.show_brightness !== false)}
            ${this._renderCheckboxField("ed.light.slider_mode_buttons", "show_slider_mode_buttons", config.show_slider_mode_buttons !== false)}
            ${this._renderCheckboxField("ed.light.show_quick_brightness", "show_quick_brightness", config.show_quick_brightness !== false)}
            ${this._renderCheckboxField("ed.light.show_color_controls", "show_color_controls", config.show_color_controls !== false)}
            ${this._renderCheckboxField("ed.light.show_temperature_controls", "show_temperature_controls", config.show_temperature_controls !== false)}
            ${this._renderCheckboxField("ed.light.auto_expand_controls", "auto_expand", config.auto_expand !== false)}
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
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.animations_section_hint"))}</div>
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
                  ${this._renderCheckboxField("ed.light.mode_switch_horizontal", "animations.mode_switch_horizontal", config.animations.mode_switch_horizontal !== false)}
                  ${this._renderTextField("ed.light.anim_power_ms", "animations.power_duration", config.animations.power_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 4000,
                    step: 10,
                  })}
                  ${this._renderTextField("ed.light.anim_controls_ms", "animations.controls_duration", config.animations.controls_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 2400,
                    step: 10,
                  })}
                  ${this._renderTextField("ed.light.anim_mode_switch_ms", "animations.mode_switch_duration", config.animations.mode_switch_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 2400,
                    step: 10,
                  })}
                  ${this._renderTextField("ed.vacuum.button_bounce_ms", "animations.button_bounce_duration", config.animations.button_bounce_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 1200,
                    step: 10,
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
                  ${this._renderColorField("ed.entity.style_icon_off", "styles.icon.off_color", config.styles.icon.off_color)}
                  ${this._renderTextField("ed.vacuum.style_button_size", "styles.control.size", config.styles.control.size)}
                  ${this._renderColorField("ed.entity.style_accent_bg", "styles.control.accent_background", config.styles.control.accent_background)}
                  ${this._renderColorField("ed.entity.style_accent_color", "styles.control.accent_color", config.styles.control.accent_color)}
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
                  ${this._renderTextField("ed.light.slider_wrap_height", "styles.slider_wrap_height", config.styles.slider_wrap_height)}
                  ${this._renderTextField("ed.light.slider_height", "styles.slider_height", config.styles.slider_height)}
                  ${this._renderTextField("ed.light.slider_thumb_size", "styles.slider_thumb_size", config.styles.slider_thumb_size)}
                  ${this._renderColorField("ed.light.slider_color", "styles.slider_color", config.styles.slider_color)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="light-entity"]')
      .forEach(host => this._mountLightEntityPicker(host));

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
  customElements.define(EDITOR_TAG, NodaliaLightCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Light Card",
  description: "Tarjeta de luz con estilo Nodalia, presets y editor visual.",
  preview: true,
});
