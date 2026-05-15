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
    ensureCustomCardsDeduped();
    window.NodaliaUtils = api;
  }
})();

// </nodalia-standalone-utils>

const CARD_TAG = "nodalia-power-flow-card";
const EDITOR_TAG = "nodalia-power-flow-card-editor";
const CARD_VERSION = "1.1.1-alpha.2";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};

const NODE_DEFAULTS = {
  grid: {
    name: "Grid",
    icon: "mdi:transmission-tower",
    color: "#6da8ff",
    export_color: "#44d07b",
    export_entity: "",
    export_when_negative: true,
    entity: "",
    secondary_info: {},
  },
  home: {
    name: "Home",
    icon: "mdi:home",
    color: "#ffffff",
    entity: "",
    secondary_info: {},
  },
  solar: {
    name: "Solar",
    icon: "mdi:solar-power-variant",
    color: "#f6b73c",
    entity: "",
    secondary_info: {},
  },
  battery: {
    name: "Battery",
    icon: "mdi:battery",
    color: "#61c97a",
    entity: "",
    secondary_info: {},
  },
  water: {
    name: "Water",
    icon: "mdi:water",
    color: "#55b7ff",
    entity: "",
    secondary_info: {},
  },
  gas: {
    name: "Gas",
    icon: "mdi:fire",
    color: "#f28a5d",
    entity: "",
    secondary_info: {},
  },
};

const DEFAULT_CONFIG = {
  title: "",
  name: "",
  entities: {
    grid: deepCloneNode(NODE_DEFAULTS.grid),
    home: deepCloneNode(NODE_DEFAULTS.home),
    solar: deepCloneNode(NODE_DEFAULTS.solar),
    battery: deepCloneNode(NODE_DEFAULTS.battery),
    water: deepCloneNode(NODE_DEFAULTS.water),
    gas: deepCloneNode(NODE_DEFAULTS.gas),
    individual: [],
  },
  display_zero_lines: {
    mode: "show",
    transparency: 50,
    grey_color: [189, 189, 189],
  },
  dashboard_link: "",
  dashboard_link_label: "Energy",
  show_header: true,
  show_dashboard_link_button: true,
  show_labels: true,
  show_values: true,
  show_secondary_info: true,
  show_unavailable_badge: true,
  clickable_entities: true,
  tap_action: "none",
  min_flow_rate: 1.4,
  max_flow_rate: 5.8,
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    content_duration: 460,
    button_bounce_duration: 320,
  },
  grid_options: {
    rows: "auto",
    columns: "full",
    min_rows: 1,
    min_columns: 6,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "32px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "12px",
      gap: "10px",
    },
    icon: {
      node_size: "48px",
      home_size: "96px",
      individual_size: "40px",
      color: "var(--primary-text-color)",
    },
    title_size: "15px",
    chip_height: "21px",
    chip_font_size: "10px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    home_value_size: "22px",
    home_unit_size: "14px",
    node_value_size: "11px",
    secondary_size: "10px",
    flow_width: "1px",
  },
};

const STUB_CONFIG = {
  title: "Energy",
  entities: {
    grid: {
      entity: "sensor.shelly_pro_3em_puerto_c_potencia",
    },
    home: {
      entity: "sensor.shelly_pro_3em_puerto_c_potencia",
    },
    solar: {
      entity: "",
    },
    battery: {
      entity: "",
    },
    individual: [],
  },
  dashboard_link: "/energy/overview",
};

function deepCloneNode(value) {
  return JSON.parse(JSON.stringify(value));
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

function getStubEntityId(hass, domains = []) {
  const states = hass?.states || {};
  const normalizedDomains = domains.map(domain => String(domain).trim()).filter(Boolean);
  return Object.keys(states).find(entityId => (
    !normalizedDomains.length || normalizedDomains.some(domain => entityId.startsWith(`${domain}.`))
  )) || "";
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

function getByPath(target, path) {
  const parts = String(path || "").split(".");
  let cursor = target;

  for (const key of parts) {
    if (!key) {
      return undefined;
    }

    if (!isObject(cursor) && !Array.isArray(cursor)) {
      return undefined;
    }

    cursor = cursor[key];
  }

  return cursor;
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
  if (typeof probe.remove === "function") {
    probe.remove();
  } else if (probe.parentNode && typeof probe.parentNode.removeChild === "function") {
    probe.parentNode.removeChild(probe);
  }
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
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseNumber(value) {
  const numeric = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function getHassLocaleTag(hass, language = "auto") {
  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, language);
  return window.NodaliaI18n?.localeTag?.(lang) || hass?.locale?.language || undefined;
}

function isUnavailableState(state) {
  const key = normalizeTextKey(state?.state);
  return key === "unavailable" || key === "unknown";
}

function formatRawValue(value, decimals = 0, locale = undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "--";
  }

  return numeric.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDisplayValue(value, unit = "", locale = undefined) {
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

function rgbArrayToColor(value, fallback = [189, 189, 189]) {
  const source = Array.isArray(value) && value.length >= 3 ? value : fallback;
  const [r, g, b] = source.map(item => clamp(Number(item) || 0, 0, 255));
  return `rgb(${r}, ${g}, ${b})`;
}

function arrayFromMaybe(value) {
  return Array.isArray(value) ? value : [];
}

function resolveNodeConfig(kind, config) {
  return mergeConfig(NODE_DEFAULTS[kind] || {}, config?.entities?.[kind] || {});
}

/** True if the YAML `entity` field is set (string id or split consumption/production object). */
function isEntitySourceConfigured(entity) {
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

function resolveIndividualConfigs(config) {
  return arrayFromMaybe(config?.entities?.individual)
    .filter(isObject)
    .map((item, index) => ({
      entity: String(item.entity || "").trim(),
      name: String(item.name || "").trim(),
      icon: String(item.icon || "mdi:flash").trim(),
      color: String(item.color || ["#f29f05", "#42a5f5", "#7fd0c8", "#f56aa0"][index % 4]).trim(),
      secondary_info: isObject(item.secondary_info) ? item.secondary_info : {},
    }))
    .filter(item => item.entity);
}

function normalizeConfig(rawConfig) {
  const merged = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  merged.entities = merged.entities || {};
  merged.entities.individual = resolveIndividualConfigs(merged);
  return merged;
}

function getNodePosition(kind, index = 0, total = 0, hasBottomUtilities = false) {
  return getNodePositionForLayout(kind, index, total, hasBottomUtilities, "full", {});
}

/** Active grid / solar / battery branches so %-layout can spread vertically when several sources exist. */
function getFlowLayoutFlagsFromConfig(config) {
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
  const individualCount = resolveIndividualConfigs(c).length;
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

function getLayoutPreset(nodeCounts = {}) {
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

function getNodePositionForLayout(kind, index = 0, total = 0, hasBottomUtilities = false, layoutPreset = "full", flowFlags = {}) {
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

function offsetPoint(from, to, distance) {
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
function buildFlowPath(from, to, fromRadius = 0, toRadius = 0, hints = {}) {
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
function buildStraightFlowPath(from, to, fromRadius = 0, toRadius = 0) {
  const start = offsetPoint(from, to, fromRadius);
  const end = offsetPoint(to, from, toRadius);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

class NodaliaPowerFlowCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    const config = deepClone(STUB_CONFIG);
    const entityId = getStubEntityId(hass, ["sensor"]);
    if (!entityId) {
      return config;
    }

    config.entities.grid.entity = entityId;
    config.entities.home.entity = entityId;
    return config;
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._flowViewportVisible = true;
    this._flowViewportObserver = null;
    this._onFlowViewport = this._onFlowViewport.bind(this);
    this._onFlowVisibility = this._onFlowVisibility.bind(this);
    this._flowUnpauseRaf = 0;
  }

  _onFlowViewport(entries) {
    const hit = entries.some(entry => entry.isIntersecting);
    this._flowViewportVisible = hit;
    this._syncFlowMotionPause();
  }

  _onFlowVisibility() {
    this._syncFlowMotionPause();
  }

  _attachFlowViewportTracking() {
    this._detachFlowViewportTracking();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this._onFlowVisibility);
    }
    if (typeof IntersectionObserver === "function") {
      this._flowViewportObserver = new IntersectionObserver(this._onFlowViewport, {
        root: null,
        rootMargin: "0px",
        threshold: 0,
      });
      this._flowViewportObserver.observe(this);
    } else {
      this._flowViewportVisible = true;
    }
    this._syncFlowMotionPause();
  }

  _detachFlowViewportTracking() {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this._onFlowVisibility);
    }
    if (this._flowViewportObserver) {
      this._flowViewportObserver.disconnect();
      this._flowViewportObserver = null;
    }
    this._flowViewportVisible = true;
    this._clearFlowUnpauseRaf();
  }

  _clearFlowUnpauseRaf() {
    if (this._flowUnpauseRaf && typeof window !== "undefined") {
      window.cancelAnimationFrame(this._flowUnpauseRaf);
      this._flowUnpauseRaf = 0;
    }
  }

  _syncFlowMotionPause() {
    if (!this.shadowRoot) {
      return;
    }
    const docHidden = typeof document !== "undefined" && document.hidden;
    const shouldPause = docHidden || !this._flowViewportVisible;
    const haCard = this.shadowRoot.querySelector("ha-card");
    if (shouldPause) {
      this._clearFlowUnpauseRaf();
      haCard?.classList.add("power-flow-card--motion-paused");
      for (const svg of this.shadowRoot.querySelectorAll("svg")) {
        try {
          if (typeof svg.pauseAnimations === "function") {
            svg.pauseAnimations();
          }
        } catch (_err) {
          // Ignore SVG animation control failures in older engines.
        }
      }
      return;
    }
    haCard?.classList.remove("power-flow-card--motion-paused");
    this._clearFlowUnpauseRaf();
    const runUnpause = () => {
      this._flowUnpauseRaf = 0;
      if (!this.isConnected || !this.shadowRoot) {
        return;
      }
      const stillHidden = typeof document !== "undefined" && document.hidden;
      if (stillHidden || !this._flowViewportVisible) {
        return;
      }
      for (const svg of this.shadowRoot.querySelectorAll("svg")) {
        try {
          if (typeof svg.unpauseAnimations === "function") {
            svg.unpauseAnimations();
          }
        } catch (_err) {
          // Ignore SVG animation control failures in older engines.
        }
      }
    };
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      this._flowUnpauseRaf = window.requestAnimationFrame(() => {
        this._flowUnpauseRaf = 0;
        runUnpause();
      });
    } else {
      runUnpause();
    }
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this._attachFlowViewportTracking();
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    this._clearFlowUnpauseRaf();
    this._detachFlowViewportTracking();
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
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
    const individualCount = resolveIndividualConfigs(this._config).length;
    const topCount = [
      resolveNodeConfig("grid", this._config),
      resolveNodeConfig("solar", this._config),
      resolveNodeConfig("battery", this._config),
    ].filter(item => item.entity).length;
    const bottomCount = [
      resolveNodeConfig("water", this._config),
      resolveNodeConfig("gas", this._config),
    ].filter(item => item.entity).length;
    const layoutPreset = getLayoutPreset({
      top: topCount,
      bottom: bottomCount,
      individual: individualCount,
    });

    return layoutPreset === "simple" ? 4 : 4;
  }

  getGridOptions() {
    const individualCount = resolveIndividualConfigs(this._config).length;
    const topCount = [
      resolveNodeConfig("grid", this._config),
      resolveNodeConfig("solar", this._config),
      resolveNodeConfig("battery", this._config),
    ].filter(item => item.entity).length;
    const bottomCount = [
      resolveNodeConfig("water", this._config),
      resolveNodeConfig("gas", this._config),
    ].filter(item => item.entity).length;
    const layoutPreset = getLayoutPreset({
      top: topCount,
      bottom: bottomCount,
      individual: individualCount,
    });

    const base = mergeConfig(DEFAULT_CONFIG.grid_options || {}, this._config?.grid_options || {});
    const minRows = Math.max(1, Number(base.min_rows) || 1);
    return {
      rows: base.rows === undefined || base.rows === "" ? "auto" : base.rows,
      columns: base.columns === undefined || base.columns === "" ? "full" : base.columns,
      min_rows: layoutPreset === "simple" ? Math.max(minRows, 3) : minRows,
      min_columns: Math.max(1, Number(base.min_columns) || 6),
    };
  }

  _getLocaleTag() {
    return getHassLocaleTag(this._hass, this._config?.language ?? "auto");
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

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;

    return {
      enabled: configuredAnimations.enabled !== false,
      buttonBounceDuration: clamp(
        Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
        120,
        1200,
      ),
      contentDuration: clamp(
        Number(configuredAnimations.content_duration) || DEFAULT_CONFIG.animations.content_duration,
        160,
        1800,
      ),
    };
  }

  _triggerPressAnimation(element, className = "is-pressing") {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    const animations = this._getAnimationSettings();
    if (!animations.enabled) {
      return;
    }

    element.classList.remove(className);
    element.getBoundingClientRect();
    element.classList.add(className);

    window.setTimeout(() => {
      element.classList.remove(className);
    }, animations.buttonBounceDuration + 40);
  }

  _navigate(path) {
    if (!path) {
      return;
    }

    window.history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  _getNodeSourceState(source) {
    if (!this._hass?.states) {
      return null;
    }

    if (typeof source === "string") {
      return this._hass.states[source] || null;
    }

    if (isObject(source)) {
      const entityId = source.entity || source.consumption || source.production || "";
      return entityId ? this._hass.states[entityId] || null : null;
    }

    return null;
  }

  _getSourceUnit(state) {
    return String(state?.attributes?.unit_of_measurement || state?.attributes?.native_unit_of_measurement || "").trim();
  }

  /**
   * Resolves a numeric `value` from a string entity id or a `{ entity | consumption | production }` object.
   * Split **grid** entities follow import/export semantics: `consumption − production` (positive = net import).
   * Split **battery** entities follow HA energy semantics: `production − consumption` (positive = discharge,
   * negative = charge), matching the single-sensor convention documented on `_applyDerivedHomeAndGridDisplay`.
   */
  _resolveSourceValue(source, kind = null) {
    if (!this._hass?.states || !source) {
      return { value: null, unit: "", state: null, entityId: "" };
    }

    if (typeof source === "string") {
      const state = this._hass.states[source] || null;
      return {
        value: parseNumber(state?.state),
        unit: this._getSourceUnit(state),
        state,
        entityId: source,
      };
    }

    if (isObject(source)) {
      const directEntity = String(source.entity || "").trim();
      if (directEntity) {
        const state = this._hass.states[directEntity] || null;
        return {
          value: parseNumber(state?.state),
          unit: this._getSourceUnit(state),
          state,
          entityId: directEntity,
        };
      }

      const consumptionEntity = String(source.consumption || "").trim();
      const productionEntity = String(source.production || "").trim();
      const consumptionState = consumptionEntity ? this._hass.states[consumptionEntity] || null : null;
      const productionState = productionEntity ? this._hass.states[productionEntity] || null : null;
      const consumptionValue = parseNumber(consumptionState?.state) || 0;
      const productionValue = parseNumber(productionState?.state) || 0;
      const unit = String(
        consumptionState?.attributes?.unit_of_measurement
        || productionState?.attributes?.unit_of_measurement
        || consumptionState?.attributes?.native_unit_of_measurement
        || productionState?.attributes?.native_unit_of_measurement
        || "",
      ).trim();

      const net =
        kind === "battery"
          ? productionValue - consumptionValue
          : consumptionValue - productionValue;

      return {
        value: net,
        unit,
        state: consumptionState || productionState,
        entityId: consumptionEntity || productionEntity,
      };
    }

    return { value: null, unit: "", state: null, entityId: "" };
  }

  _resolveGridExportSource(nodeConfig, sourceResult) {
    const exportEntityId = String(nodeConfig?.export_entity || "").trim();
    const exportState = exportEntityId ? this._hass?.states?.[exportEntityId] || null : null;
    const exportValue = parseNumber(exportState?.state);
    const splitExportActive = Number.isFinite(exportValue) && exportValue > 0.001;
    const negativeExportActive =
      nodeConfig?.export_when_negative !== false &&
      Number.isFinite(sourceResult?.value) &&
      sourceResult.value < -0.001;

    if (!splitExportActive && !negativeExportActive) {
      return null;
    }

    const magnitude = splitExportActive ? exportValue : Math.abs(sourceResult.value);
    const unit = splitExportActive ? this._getSourceUnit(exportState) : sourceResult.unit;
    return {
      value: -Math.abs(magnitude),
      unit,
      state: splitExportActive ? exportState : sourceResult.state,
      entityId: splitExportActive ? exportEntityId : sourceResult.entityId,
      active: true,
    };
  }

  _getSecondaryInfoText(nodeConfig, baseState) {
    if (this._config?.show_secondary_info === false || !isObject(nodeConfig?.secondary_info)) {
      return "";
    }

    const info = nodeConfig.secondary_info;
    const infoEntity = String(info.entity || "").trim();
    const infoAttribute = String(info.attribute || "").trim();
    const infoState = infoEntity ? this._hass?.states?.[infoEntity] || null : baseState;

    if (!infoState) {
      return "";
    }

    if (infoAttribute) {
      const rawAttribute = infoState.attributes?.[infoAttribute];
      if (rawAttribute === undefined || rawAttribute === null || rawAttribute === "") {
        return "";
      }
      return String(rawAttribute);
    }

    if (!infoEntity) {
      return "";
    }

    const rawValue = parseNumber(infoState.state);
    const unit = String(info.unit || infoState.attributes?.unit_of_measurement || infoState.attributes?.native_unit_of_measurement || "").trim();
    if (rawValue === null) {
      return String(infoState.state || "");
    }

    const decimals = Number.isFinite(Number(info.decimals)) ? Number(info.decimals) : 0;
    return `${formatRawValue(rawValue, decimals, this._getLocaleTag())}${unit ? ` ${unit}` : ""}`;
  }

  _resolveNodeDescriptor(kind, configOverride = null, index = 0, total = 0, hasBottomUtilities = false, flowFlags = {}) {
    const nodeConfig = configOverride || resolveNodeConfig(kind, this._config);
    let sourceResult = this._resolveSourceValue(nodeConfig.entity, kind);
    if (
      kind === "grid" &&
      !sourceResult.entityId &&
      String(nodeConfig?.export_entity || "").trim()
    ) {
      const exportEntityId = String(nodeConfig.export_entity).trim();
      const exportState = this._hass?.states?.[exportEntityId] || null;
      sourceResult = {
        value: 0,
        unit: this._getSourceUnit(exportState),
        state: exportState,
        entityId: exportEntityId,
      };
    }
    const gridExport = kind === "grid" ? this._resolveGridExportSource(nodeConfig, sourceResult) : null;
    if (gridExport) {
      sourceResult = {
        ...sourceResult,
        value: gridExport.value,
        unit: gridExport.unit,
        state: gridExport.state,
        entityId: gridExport.entityId,
      };
    }
    const state = sourceResult.state;
    const unavailable = Boolean(nodeConfig.entity || nodeConfig.export_entity) && (!state || isUnavailableState(state));
    const label = nodeConfig.name || state?.attributes?.friendly_name || NODE_DEFAULTS[kind]?.name || kind;
    let icon = nodeConfig.icon || state?.attributes?.icon || NODE_DEFAULTS[kind]?.icon || "mdi:flash";
    const color = gridExport
      ? (nodeConfig.export_color || NODE_DEFAULTS.grid.export_color)
      : (nodeConfig.color || NODE_DEFAULTS[kind]?.color || "#ffffff");
    const secondary = this._getSecondaryInfoText(nodeConfig, state);
    const display = formatDisplayValue(sourceResult.value, sourceResult.unit, this._getLocaleTag());
    const nodeKind = kind === "individual" ? "individual" : kind;

    const descriptor = {
      id: kind === "individual" ? `${kind}-${index}` : kind,
      kind: nodeKind,
      entityId: sourceResult.entityId || String(nodeConfig.entity || ""),
      label,
      icon,
      color,
      value: sourceResult.value,
      unit: sourceResult.unit,
      valueText: display.value,
      unitText: display.unit,
      isExporting: Boolean(gridExport),
      state,
      secondary,
      unavailable,
      position: getNodePositionForLayout(nodeKind, index, total, hasBottomUtilities, this._layoutPreset || "full", flowFlags),
      sourceConfig: nodeConfig,
    };

    if (nodeKind === "battery") {
      descriptor.icon = this._getBatteryStatusIcon(descriptor, icon);
    }

    return descriptor;
  }

  _getBatteryLevel(node) {
    const values = [];
    const addCandidate = value => {
      const parsed = parseNumber(value);
      if (parsed !== null) {
        values.push(parsed);
      }
    };

    addCandidate(node?.state?.attributes?.battery_level);
    addCandidate(node?.state?.attributes?.battery);
    addCandidate(node?.state?.attributes?.battery_remaining);
    addCandidate(node?.state?.attributes?.battery_state_of_charge);
    addCandidate(node?.state?.attributes?.state_of_charge);
    addCandidate(node?.state?.attributes?.soc);

    const info = node?.sourceConfig?.secondary_info;
    if (isObject(info)) {
      const infoEntity = String(info.entity || "").trim();
      const infoState = infoEntity ? this._hass?.states?.[infoEntity] : node?.state;
      if (infoState) {
        const attribute = String(info.attribute || "").trim();
        if (attribute) {
          addCandidate(infoState.attributes?.[attribute]);
        } else {
          const unit = String(info.unit || infoState.attributes?.unit_of_measurement || infoState.attributes?.native_unit_of_measurement || "").trim();
          if (unit === "%") {
            addCandidate(infoState.state);
          }
        }
      }
    }

    const level = values.find(value => Number.isFinite(value) && value >= 0 && value <= 100);
    return Number.isFinite(level) ? clamp(level, 0, 100) : null;
  }

  _getBatteryStatusIcon(node, fallbackIcon = NODE_DEFAULTS.battery.icon) {
    const configuredIcon = String(this._config?.entities?.battery?.icon ?? "").trim();
    if (configuredIcon && configuredIcon !== NODE_DEFAULTS.battery.icon) {
      return configuredIcon;
    }

    const value = Number(node?.value);
    if (Number.isFinite(value)) {
      if (value < -0.001) {
        return "mdi:battery-charging";
      }
      if (value > 0.001) {
        return "mdi:battery-arrow-down";
      }
    }

    const level = this._getBatteryLevel(node);
    if (level !== null && level >= 99.5) {
      return "mdi:battery-check";
    }

    return fallbackIcon || NODE_DEFAULTS.battery.icon;
  }

  _getTrackedEntityIds() {
    const config = this._config || {};
    const entityIds = new Set();

    const registerNodeEntity = nodeConfig => {
      if (!nodeConfig) {
        return;
      }

      const source = nodeConfig.entity;
      if (typeof source === "string" && source.trim()) {
        entityIds.add(source.trim());
      } else if (isObject(source)) {
        if (String(source.entity || "").trim()) {
          entityIds.add(String(source.entity).trim());
        }
        if (String(source.consumption || "").trim()) {
          entityIds.add(String(source.consumption).trim());
        }
        if (String(source.production || "").trim()) {
          entityIds.add(String(source.production).trim());
        }
      }

      const exportEntity = String(nodeConfig.export_entity || "").trim();
      if (exportEntity) {
        entityIds.add(exportEntity);
      }

      const secondaryEntity = String(nodeConfig.secondary_info?.entity || "").trim();
      if (secondaryEntity) {
        entityIds.add(secondaryEntity);
      }
    };

    ["grid", "home", "solar", "battery", "water", "gas"].forEach(kind => {
      registerNodeEntity(resolveNodeConfig(kind, config));
    });

    resolveIndividualConfigs(config).forEach(registerNodeEntity);

    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    return [...entityIds].sort((left, right) => left.localeCompare(right, sortLoc));
  }

  _getRenderSignature(hass = this._hass) {
    const trackedStates = this._getTrackedEntityIds().map(entityId => {
      const state = hass?.states?.[entityId] || null;
      return {
        entityId,
        state: String(state?.state || ""),
        lu: String(state?.last_updated || state?.last_changed || ""),
      };
    });

    return JSON.stringify({
      title: this._config?.title || this._config?.name || "",
      dashboard_link: this._config?.dashboard_link || "",
      show_header: this._config?.show_header !== false,
      show_values: this._config?.show_values !== false,
      show_labels: this._config?.show_labels !== false,
      trackedStates,
    });
  }

  /**
   * No "Home" entity: instantaneous consumption is roughly solar + grid + battery (card conventions:
   * red +import / -export, batería +descarga / -carga).
   * Nodo red con exportación: número en positivo y flecha integrada en el chip de valor.
   */
  _applyDerivedHomeAndGridDisplay(nodes) {
    const homeCfg = resolveNodeConfig("home", this._config);
    const homeConfigured = isEntitySourceConfigured(homeCfg.entity);
    if (!homeConfigured) {
      const grid = nodes.grid;
      const solar = nodes.solar;
      const battery = nodes.battery;
      const branchCount = [grid, solar, battery].filter(n => n.entityId).length;
      const canCompute = branchCount >= 2 || (branchCount === 1 && grid.entityId);

      if (canCompute) {
        let invalid = false;
        let sum = 0;
        const add = (n) => {
          if (!n.entityId) {
            return;
          }
          if (n.unavailable) {
            invalid = true;
            return;
          }
          if (!Number.isFinite(n.value)) {
            invalid = true;
            return;
          }
          sum += n.value;
        };
        add(grid);
        add(solar);
        add(battery);

        if (invalid) {
          nodes.home.unavailable = true;
          nodes.home.value = null;
          nodes.home.valueText = "--";
          nodes.home.unitText = "";
        } else {
          nodes.home.unavailable = false;
          nodes.home.value = sum;
          const unit = String(grid.unit || solar.unit || battery.unit || "").trim();
          const display = formatDisplayValue(sum, unit, this._getLocaleTag());
          nodes.home.valueText = display.value;
          nodes.home.unitText = display.unit;
          nodes.home.state = grid.state || solar.state || battery.state;
        }
      }
    } else {
      this._applyHomeDemandDerivedFlows(nodes);
    }

    const g = nodes.grid;
    if (g.entityId && !g.unavailable && Number.isFinite(g.value) && (g.value < -0.001 || g.isExporting)) {
      const display = formatDisplayValue(Math.abs(g.value), g.unit, this._getLocaleTag());
      g.valueText = display.value;
      g.unitText = display.unit;
    }
  }

  _applyHomeDemandDerivedFlows(nodes) {
    const home = nodes.home;
    const grid = nodes.grid;
    const solar = nodes.solar;
    const battery = nodes.battery;
    if (!home?.entityId || home.unavailable || !Number.isFinite(home.value)) {
      return;
    }

    const hasGridSensor = Boolean(isEntitySourceConfigured(resolveNodeConfig("grid", this._config).entity) || String(resolveNodeConfig("grid", this._config).export_entity || "").trim());
    const hasSolar = Boolean(solar?.entityId && !solar.unavailable && Number.isFinite(solar.value));
    const hasBattery = Boolean(battery?.entityId && !battery.unavailable && Number.isFinite(battery.value));
    if (!hasSolar && !hasBattery && hasGridSensor) {
      return;
    }

    const homeDemand = Math.max(0, Number(home.value));
    const solarProduction = hasSolar ? Math.max(0, Number(solar.value)) : 0;
    const batteryPower = hasBattery ? Number(battery.value) : 0;
    const batteryDischarge = Math.max(0, batteryPower);
    const batteryCharge = Math.max(0, -batteryPower);

    const solarToHome = Math.min(solarProduction, homeDemand);
    let remainingHomeDemand = Math.max(0, homeDemand - solarToHome);
    const batteryToHome = Math.min(batteryDischarge, remainingHomeDemand);
    remainingHomeDemand = Math.max(0, remainingHomeDemand - batteryToHome);
    const gridToHome = remainingHomeDemand;

    let remainingSolar = Math.max(0, solarProduction - solarToHome);
    const solarToBattery = Math.min(remainingSolar, batteryCharge);
    remainingSolar = Math.max(0, remainingSolar - solarToBattery);
    const gridToBattery = Math.max(0, batteryCharge - solarToBattery);
    const batteryToGrid = Math.max(0, batteryDischarge - batteryToHome);
    const solarToGrid = Math.max(0, remainingSolar);
    const gridExport = Math.max(0, solarToGrid + batteryToGrid);
    const gridImport = Math.max(0, gridToHome + gridToBattery);
    const gridNet = gridImport > 0.001 ? gridImport : gridExport > 0.001 ? -gridExport : 0;
    const unit = String(home.unit || solar?.unit || battery?.unit || grid?.unit || "").trim();

    grid.entityId = grid.entityId || home.entityId;
    grid.state = grid.state || home.state;
    grid.unavailable = false;
    grid.value = gridNet;
    grid.unit = unit;
    grid.isDerived = true;
    grid.isExporting = gridExport > 0.001;
    if (grid.isExporting) {
      const gridCfg = resolveNodeConfig("grid", this._config);
      grid.color = gridCfg.export_color || NODE_DEFAULTS.grid.export_color;
    }
    const gridDisplay = formatDisplayValue(Math.abs(gridNet), unit, this._getLocaleTag());
    grid.valueText = gridDisplay.value;
    grid.unitText = gridDisplay.unit;

    nodes._flowValues = {
      gridHome: gridToHome,
      solarHome: solarToHome,
      batteryHome: batteryToHome,
      solarBattery: solarToBattery,
      gridBattery: gridToBattery,
      solarGrid: solarToGrid,
      batteryGrid: batteryToGrid,
      gridImport,
      gridExport,
    };
  }

  _applyMeasuredFlowValues(nodes) {
    if (nodes._flowValues) {
      return;
    }

    const home = nodes.home;
    const grid = nodes.grid;
    const solar = nodes.solar;
    const battery = nodes.battery;
    const hasGrid = Boolean(grid?.entityId && !grid.unavailable && Number.isFinite(grid.value));
    const hasSolar = Boolean(solar?.entityId && !solar.unavailable && Number.isFinite(solar.value));
    const hasBattery = Boolean(battery?.entityId && !battery.unavailable && Number.isFinite(battery.value));
    if (!hasGrid && !hasSolar && !hasBattery) {
      return;
    }

    const homeDemand = home && !home.unavailable && Number.isFinite(home.value) ? Math.max(0, Number(home.value)) : 0;
    const gridNet = hasGrid ? Number(grid.value) : 0;
    const gridImport = gridNet > 0.001 ? gridNet : 0;
    const gridExport = gridNet < -0.001 || grid?.isExporting ? Math.abs(gridNet) : 0;
    const solarProduction = hasSolar ? Math.max(0, Number(solar.value)) : 0;
    const batteryPower = hasBattery ? Number(battery.value) : 0;
    const batteryDischarge = Math.max(0, batteryPower);
    const batteryCharge = Math.max(0, -batteryPower);

    const solarToHome = Math.min(solarProduction, homeDemand);
    let remainingHomeDemand = Math.max(0, homeDemand - solarToHome);
    const batteryToHome = Math.min(batteryDischarge, remainingHomeDemand);
    remainingHomeDemand = Math.max(0, remainingHomeDemand - batteryToHome);
    const gridToHome = Math.min(gridImport, remainingHomeDemand);
    let remainingGridImport = Math.max(0, gridImport - gridToHome);

    let remainingSolar = Math.max(0, solarProduction - solarToHome);
    const solarToBattery = Math.min(remainingSolar, batteryCharge);
    remainingSolar = Math.max(0, remainingSolar - solarToBattery);
    const remainingBatteryCharge = Math.max(0, batteryCharge - solarToBattery);
    const gridToBattery = Math.min(remainingGridImport, remainingBatteryCharge);
    remainingGridImport = Math.max(0, remainingGridImport - gridToBattery);

    let remainingGridExport = gridExport;
    let solarToGrid = Math.min(remainingSolar, remainingGridExport);
    remainingGridExport = Math.max(0, remainingGridExport - solarToGrid);
    const batteryExportCapacity = Math.max(0, batteryDischarge - batteryToHome);
    let batteryToGrid = Math.min(batteryExportCapacity, remainingGridExport);
    remainingGridExport = Math.max(0, remainingGridExport - batteryToGrid);

    // Small positive remainder after measured splits: visualization-only; prefer a solar export path
    // when a solar entity exists (typical PV surplus), else battery discharge-to-grid — not strict physics.
    if (remainingGridExport > 0.001) {
      if (hasSolar) {
        solarToGrid += remainingGridExport;
      } else if (hasBattery) {
        batteryToGrid += remainingGridExport;
      }
    }

    nodes._flowValues = {
      gridHome: gridToHome,
      solarHome: solarToHome,
      batteryHome: batteryToHome,
      solarBattery: solarToBattery,
      gridBattery: gridToBattery,
      solarGrid: solarToGrid,
      batteryGrid: batteryToGrid,
      gridImport,
      gridExport,
    };
  }

  _getNodes() {
    const flowFlags = getFlowLayoutFlagsFromConfig(this._config);
    const bottomUtilities = flowFlags.bottomUtilities;
    const individualConfigs = resolveIndividualConfigs(this._config);
    this._layoutPreset = getLayoutPreset({
      top: flowFlags.topCount,
      bottom: bottomUtilities,
      individual: individualConfigs.length,
    });

    const hasBottom = bottomUtilities > 0;
    const nodes = {
      home: this._resolveNodeDescriptor("home", null, 0, 0, hasBottom, flowFlags),
      grid: this._resolveNodeDescriptor("grid", null, 0, 0, hasBottom, flowFlags),
      solar: this._resolveNodeDescriptor("solar", null, 0, 0, hasBottom, flowFlags),
      battery: this._resolveNodeDescriptor("battery", null, 0, 0, hasBottom, flowFlags),
      water: this._resolveNodeDescriptor("water", null, 0, bottomUtilities, hasBottom, flowFlags),
      gas: this._resolveNodeDescriptor("gas", null, 1, bottomUtilities, hasBottom, flowFlags),
      individual: individualConfigs.map((config, index) =>
        this._resolveNodeDescriptor("individual", config, index, individualConfigs.length, hasBottom, flowFlags),
      ),
    };

    if (!nodes.home.entityId) {
      nodes.home.entityId = nodes.grid.entityId || nodes.solar.entityId || nodes.battery.entityId || "";
    }

    this._applyDerivedHomeAndGridDisplay(nodes);
    this._applyMeasuredFlowValues(nodes);

    nodes._layoutPreset = this._layoutPreset;
    nodes._flowFlags = flowFlags;

    return nodes;
  }

  _getLineNeutralStyle() {
    const grey = rgbArrayToColor(this._config?.display_zero_lines?.grey_color);
    const opacity = 1 - (clamp(Number(this._config?.display_zero_lines?.transparency ?? 50), 0, 100) / 100);
    return { color: grey, opacity };
  }

  _shouldShowZeroLines() {
    return normalizeTextKey(this._config?.display_zero_lines?.mode) !== "hide";
  }

  _toFlowMagnitude(value, unit) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const unitKey = normalizeTextKey(unit);
    if (unitKey === "kw") {
      return Math.abs(value) * 1000;
    }
    return Math.abs(value);
  }

  _flowDuration(magnitude, maxMagnitude) {
    const minFlowRate = Math.max(0.6, Number(this._config?.min_flow_rate) || DEFAULT_CONFIG.min_flow_rate);
    const maxFlowRate = Math.max(minFlowRate + 0.1, Number(this._config?.max_flow_rate) || DEFAULT_CONFIG.max_flow_rate);
    const safeMax = Math.max(maxMagnitude, 1);
    const ratio = clamp(magnitude / safeMax, 0, 1);
    return maxFlowRate - ((maxFlowRate - minFlowRate) * ratio);
  }

  _buildLines(nodes) {
    const home = nodes.home;
    const layoutPreset = nodes._layoutPreset || "full";
    const zeroLineVisible = this._shouldShowZeroLines();
    const neutralStyle = this._getLineNeutralStyle();
    /** In viewBox units; distance from node centre toward the other node so the stroke meets the bubble edge. */
    const homeRadius = layoutPreset === "simple" ? 8.8 : layoutPreset === "compact" ? 10.2 : 11.8;
    const nodeRadius = layoutPreset === "simple" ? 4.8 : layoutPreset === "compact" ? 5.5 : 6.1;
    const individualRadius = layoutPreset === "simple" ? 4.2 : layoutPreset === "compact" ? 4.6 : 5;
    const lineCandidates = [];
    const flowValues = nodes._flowValues || {};

    const pushLine = (id, sourceNode, targetNode, value, unit, color, bidirectional = true, straight = false) => {
      const magnitude = this._toFlowMagnitude(value, unit);
      const active = magnitude > 0.001;
      if (!active && !zeroLineVisible) {
        return;
      }

      let fromNode = sourceNode;
      let toNode = targetNode;

      if (active && bidirectional && value < 0) {
        fromNode = targetNode;
        toNode = sourceNode;
      }

      const baseFromR = fromNode.kind === "home" ? homeRadius : fromNode.kind === "individual" ? individualRadius : nodeRadius;
      const baseToR = toNode.kind === "home" ? homeRadius : toNode.kind === "individual" ? individualRadius : nodeRadius;
      const chord = Math.hypot(
        toNode.position.x - fromNode.position.x,
        toNode.position.y - fromNode.position.y,
      ) || 0.001;
      /**
       * Endpoints sit on the chord at `baseFromR` / `baseToR` from each centre (toward the other node).
       * Capping each side with a small fraction of the chord (old behaviour) made long spans (1–2 sources)
       * use tiny trims so the stroke never reached the bubble outline. Only scale down when the sum would
       * exceed most of the chord (short diagonal / cramped layouts).
       */
      const maxSum = Math.max(chord * 0.92, 0.55);
      let fromRadius = baseFromR;
      let toRadius = baseToR;
      const sum = fromRadius + toRadius;
      if (sum > maxSum) {
        const scale = maxSum / sum;
        fromRadius *= scale;
        toRadius *= scale;
      }

      lineCandidates.push({
        id,
        fromNode,
        toNode,
        value,
        unit,
        magnitude,
        active,
        color: active ? color : neutralStyle.color,
        opacity: active ? 0.9 : neutralStyle.opacity,
        fromRadius,
        straight,
        toRadius,
      });
    };

    if (nodes.grid.entityId) {
      const value = Number.isFinite(flowValues.gridHome) ? flowValues.gridHome : nodes.grid.value;
      pushLine("grid", nodes.grid, home, value, nodes.grid.unit, nodes.grid.color, true, true);
    }
    if (nodes.solar.entityId) {
      const value = Number.isFinite(flowValues.solarHome) ? flowValues.solarHome : nodes.solar.value;
      pushLine("solar", nodes.solar, home, value, nodes.solar.unit, nodes.solar.color, true);
    }
    if (nodes.solar.entityId && nodes.grid.entityId && Number.isFinite(flowValues.solarGrid)) {
      pushLine("solar-grid", nodes.solar, nodes.grid, flowValues.solarGrid, nodes.solar.unit || nodes.grid.unit, nodes.solar.color, false);
    }
    if (nodes.battery.entityId) {
      const value = Number.isFinite(flowValues.batteryHome) ? flowValues.batteryHome : nodes.battery.value;
      pushLine("battery", nodes.battery, home, value, nodes.battery.unit, nodes.battery.color, true);
    }
    if (nodes.battery.entityId && nodes.grid.entityId && Number.isFinite(flowValues.batteryGrid) && flowValues.batteryGrid > 0.001) {
      pushLine("battery-grid", nodes.battery, nodes.grid, flowValues.batteryGrid, nodes.battery.unit || nodes.grid.unit, nodes.battery.color, false);
    }
    if (nodes.solar.entityId && nodes.battery.entityId && Number.isFinite(flowValues.solarBattery)) {
      pushLine("solar-battery", nodes.solar, nodes.battery, flowValues.solarBattery, nodes.solar.unit || nodes.battery.unit, nodes.battery.color, false, true);
    }
    if (nodes.grid.entityId && nodes.battery.entityId && Number.isFinite(flowValues.gridBattery) && flowValues.gridBattery > 0.001) {
      pushLine("grid-battery", nodes.grid, nodes.battery, flowValues.gridBattery, nodes.grid.unit || nodes.battery.unit, nodes.battery.color, false);
    }
    if (nodes.water.entityId) {
      pushLine("water", nodes.water, home, nodes.water.value, nodes.water.unit, nodes.water.color, false);
    }
    if (nodes.gas.entityId) {
      pushLine("gas", nodes.gas, home, nodes.gas.value, nodes.gas.unit, nodes.gas.color, false);
    }

    nodes.individual.forEach(node => {
      pushLine(node.id, home, node, node.value, node.unit, node.color, true);
    });

    /** Solar often shares the vertical with home; paint it last so it is not covered where paths cross. */
    const lineStackOrder = (id) => {
      if (id === "solar") {
        return 50;
      }
      if (id === "solar-grid") {
        return 48;
      }
      if (id === "gas") {
        return 40;
      }
      if (id === "water") {
        return 35;
      }
      if (id === "battery") {
        return 25;
      }
      if (id === "solar-battery" || id === "grid-battery" || id === "battery-grid") {
        return 30;
      }
      if (id === "grid") {
        return 15;
      }
      return 5;
    };
    lineCandidates.sort((left, right) => lineStackOrder(left.id) - lineStackOrder(right.id));

    const maxMagnitude = Math.max(
      ...lineCandidates.filter(item => item.active).map(item => item.magnitude),
      1,
    );

    return lineCandidates.map(line => {
      const pathHints = {};
      if (line.id === "solar" || line.id === "solar-grid") {
        pathHints.preferVerticalFirst = true;
      }
      /** Battery sits on the bottom spine: vertical-first for home↔battery; grid→battery uses horizontal-first (hub routing). */
      if (line.id === "battery" || line.id === "battery-grid") {
        pathHints.preferVerticalFirst = true;
      }
      const path = line.straight
        ? buildStraightFlowPath(line.fromNode.position, line.toNode.position, line.fromRadius, line.toRadius)
        : buildFlowPath(line.fromNode.position, line.toNode.position, line.fromRadius, line.toRadius, pathHints);
      return {
        ...line,
        path,
        duration: this._flowDuration(line.magnitude, maxMagnitude),
      };
    });
  }

  _getDominantColor(lines) {
    const active = [...lines]
      .filter(line => line.active)
      .sort((left, right) => right.magnitude - left.magnitude);

    return active[0]?.color || "#f6b73c";
  }

  _renderFlowDots(line, dotMetrics = {}) {
    if (!line.active) {
      return "";
    }

    const bubbleDuration = 5.6;
    const glowR = Number(dotMetrics.glowR) || 2.1;
    const coreR = Number(dotMetrics.coreR) || 1.08;
    const coreStroke = Number(dotMetrics.coreStroke) || 0.26;
    const viewAspect = Number(dotMetrics.viewAspect) > 0 ? Number(dotMetrics.viewAspect) : 1;
    /** With preserveAspectRatio none, user Y is squeezed vs X on wide surfaces; taller ry in viewBox renders round on screen. */
    const glowRy = glowR * viewAspect;
    const coreRy = coreR * viewAspect;
    const motionPhase = ((String(line.id || "").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 19) / 19) * 0.92;
    const beginAttr = motionPhase > 0.02 ? ` begin="${motionPhase.toFixed(3)}s"` : "";
    return `
      <g class="power-flow-card__dot-group" style="--dot-color:${escapeHtml(line.color)};">
        <ellipse class="power-flow-card__dot-glow" rx="${glowR.toFixed(3)}" ry="${glowRy.toFixed(3)}">
          <animateMotion dur="${bubbleDuration.toFixed(2)}s" repeatCount="indefinite" calcMode="linear" path="${line.path}"${beginAttr}></animateMotion>
        </ellipse>
        <ellipse class="power-flow-card__dot-core" rx="${coreR.toFixed(3)}" ry="${coreRy.toFixed(3)}" stroke-width="${coreStroke.toFixed(2)}">
          <animateMotion dur="${bubbleDuration.toFixed(2)}s" repeatCount="indefinite" calcMode="linear" path="${line.path}"${beginAttr}></animateMotion>
        </ellipse>
      </g>
    `;
  }

  _getNodeAnimationDelay(node, index = 0) {
    const delayByKind = {
      home: 110,
      grid: 150,
      solar: 185,
      battery: 215,
      water: 245,
      gas: 275,
      individual: 245,
    };

    const baseDelay = delayByKind[node?.kind] || 150;
    return node?.kind === "individual"
      ? baseDelay + (Math.max(0, Number(index) || 0) * 34)
      : baseDelay;
  }

  _renderNode(node, options = {}) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const iconSizes = styles.icon || DEFAULT_CONFIG.styles.icon;
    const layoutPreset = options.layoutPreset || "full";
    const animateEntrance = options.animateEntrance === true;
    const enterDelay = Math.max(0, Number(options.enterDelay) || 0);
    const nodeSize = node.kind === "home"
      ? Math.max(92, parseSizeToPixels(iconSizes.home_size, 96))
      : node.kind === "individual"
        ? Math.max(38, parseSizeToPixels(iconSizes.individual_size, 40))
        : Math.max(44, parseSizeToPixels(iconSizes.node_size, 48));
    const scaledNodeSize = Math.round(
      nodeSize * (
        layoutPreset === "simple"
          ? (node.kind === "home" ? 0.74 : 0.78)
        : layoutPreset === "compact"
            ? (node.kind === "home" ? 0.88 : 0.92)
            : 1
      )
    );
    const chipHeight = Math.max(22, parseSizeToPixels(styles.chip_height, 24));
    const chipFontSize = Math.max(11, parseSizeToPixels(styles.chip_font_size, 11));
    const chipPadding = styles.chip_padding || "0 10px";
    const secondarySize = Math.max(10, parseSizeToPixels(styles.secondary_size, 11));
    const isBottom = node.position.y >= 74;
    let infoClass;
    if (layoutPreset === "simple") {
      infoClass = node.kind === "home"
        ? "power-flow-card__node-info--home"
        : isBottom
          ? "power-flow-card__node-info--above"
          : "power-flow-card__node-info--below";
    } else if (node.kind === "home") {
      infoClass = "power-flow-card__node-info--home";
    } else if (node.kind === "solar" || node.kind === "gas") {
      infoClass = "power-flow-card__node-info--above";
    } else if (node.kind === "battery" || node.kind === "water" || node.kind === "individual" || node.kind === "grid") {
      infoClass = "power-flow-card__node-info--below";
    } else {
      infoClass = isBottom ? "power-flow-card__node-info--above" : "power-flow-card__node-info--below";
    }
    const color = node.color;
    const unavailableBadge = this._config?.show_unavailable_badge !== false && node.unavailable
      ? `<span class="power-flow-card__unavailable"><ha-icon icon="mdi:help"></ha-icon></span>`
      : "";
    const isClickable = this._config?.clickable_entities !== false && node.entityId;
    const nodeClassName = [
      "power-flow-card__node",
      `power-flow-card__node--${escapeHtml(node.kind)}`,
      animateEntrance ? "power-flow-card__node--entering" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const gridDirectionIcon = this._getGridDirectionIcon(node);
    const valueMarkup = this._config?.show_values === false
      ? ""
      : `
          <span class="power-flow-card__chip power-flow-card__chip--value" style="--chip-tint:${escapeHtml(color)};">
            ${gridDirectionIcon ? `<ha-icon class="power-flow-card__chip-direction" icon="${escapeHtml(gridDirectionIcon)}"></ha-icon>` : ""}
            <span>${escapeHtml(node.valueText)}</span>
            ${node.unitText ? `<span class="power-flow-card__chip-unit">${escapeHtml(node.unitText)}</span>` : ""}
          </span>
        `;

    const labelMarkup = this._config?.show_labels === false
      ? ""
      : `<span class="power-flow-card__chip power-flow-card__chip--label">${escapeHtml(node.label)}</span>`;

    const secondaryMarkup = node.secondary
      ? `<span class="power-flow-card__node-secondary">${escapeHtml(node.secondary)}</span>`
      : "";

    if (node.kind === "home") {
      return `
        <div class="${nodeClassName}" style="left:${node.position.x}%; top:${node.position.y}%; --node-enter-delay:${enterDelay}ms;">
          <button
            class="power-flow-card__bubble power-flow-card__bubble--home ${isClickable ? "is-clickable" : ""}"
            data-node-entity="${escapeHtml(node.entityId)}"
            data-node-action="${isClickable ? "more-info" : ""}"
            style="--node-size:${scaledNodeSize}px; --node-tint:${escapeHtml(color)};"
            title="${escapeHtml(node.label)}"
          >
            ${unavailableBadge}
            <span class="power-flow-card__home-icon-wrap">
              <ha-icon icon="${escapeHtml(node.icon)}"></ha-icon>
            </span>
            ${
              this._config?.show_values === false
                ? ""
                : `
                  <span class="power-flow-card__home-value">
                    <span class="power-flow-card__home-value-number">${escapeHtml(node.valueText)}</span>
                    ${node.unitText ? `<span class="power-flow-card__home-value-unit">${escapeHtml(node.unitText)}</span>` : ""}
                  </span>
                `
            }
          </button>
          <div class="power-flow-card__node-info ${infoClass}">
            ${labelMarkup}
            ${secondaryMarkup}
          </div>
        </div>
      `;
    }

    return `
      <div class="${nodeClassName}" style="left:${node.position.x}%; top:${node.position.y}%; --chip-height:${chipHeight}px; --chip-font-size:${chipFontSize}px; --chip-padding:${escapeHtml(chipPadding)}; --secondary-size:${secondarySize}px; --node-enter-delay:${enterDelay}ms;">
        <button
          class="power-flow-card__bubble ${node.kind === "individual" ? "power-flow-card__bubble--individual" : ""} ${isClickable ? "is-clickable" : ""}"
          data-node-entity="${escapeHtml(node.entityId)}"
          data-node-action="${isClickable ? "more-info" : ""}"
          style="--node-size:${scaledNodeSize}px; --node-tint:${escapeHtml(color)};"
          title="${escapeHtml(node.label)}"
        >
          ${unavailableBadge}
          <ha-icon icon="${escapeHtml(node.icon)}"></ha-icon>
        </button>
        <div class="power-flow-card__node-info ${infoClass}">
          ${labelMarkup}
          ${valueMarkup}
          ${secondaryMarkup}
        </div>
      </div>
    `;
  }

  _getSimpleSourceNode(nodes) {
    return [
      nodes.grid,
      nodes.solar,
      nodes.battery,
      ...nodes.individual,
    ].find(node => node?.entityId) || nodes.home;
  }

  _renderSimpleLabelChip(node) {
    if (this._config?.show_labels === false) {
      return "";
    }

    return `<span class="power-flow-card__chip power-flow-card__chip--label">${escapeHtml(node.label)}</span>`;
  }

  _renderSimpleValueChip(node) {
    if (this._config?.show_values === false) {
      return "";
    }
    const gridDirectionIcon = this._getGridDirectionIcon(node);

    return `
      <span class="power-flow-card__chip power-flow-card__chip--value" style="--chip-tint:${escapeHtml(node.color)};">
        ${gridDirectionIcon ? `<ha-icon class="power-flow-card__chip-direction" icon="${escapeHtml(gridDirectionIcon)}"></ha-icon>` : ""}
        <span>${escapeHtml(node.valueText)}</span>
        ${node.unitText ? `<span class="power-flow-card__chip-unit">${escapeHtml(node.unitText)}</span>` : ""}
      </span>
    `;
  }

  _getGridDirectionIcon(node) {
    if (node?.kind !== "grid" || !Number.isFinite(Number(node.value)) || Math.abs(Number(node.value)) <= 0.001) {
      return "";
    }
    return node.isExporting || Number(node.value) < -0.001
      ? "mdi:transmission-tower-import"
      : "mdi:transmission-tower-export";
  }

  _renderSimpleLayout(nodes, lines, options = {}) {
    const animateEntrance = options.animateEntrance === true;
    const sourceNode = this._getSimpleSourceNode(nodes);
    const flowLine = lines.find(line => line.id === sourceNode.id || line.fromNode?.id === sourceNode.id || line.toNode?.id === sourceNode.id) || null;
    const lineColor = flowLine?.color || sourceNode.color || "#6da8ff";
    const lineOpacity = flowLine?.active ? 0.92 : (this._shouldShowZeroLines() ? this._getLineNeutralStyle().opacity : 0);
    const lineBackground = flowLine?.active
      ? `color-mix(in srgb, ${lineColor} 24%, rgba(255,255,255,0.12))`
      : this._getLineNeutralStyle().color;
    const bubbleDuration = Math.max(3.6, Number(flowLine?.duration || 4.8));
    const homeSize = Math.round(Math.max(92, parseSizeToPixels(this._config?.styles?.icon?.home_size, 96)) * 0.72);
    const nodeSize = Math.round(Math.max(44, parseSizeToPixels(this._config?.styles?.icon?.node_size, 48)) * 0.8);
    const lineStartOffset = Math.max(18, Math.round(nodeSize * 0.42));
    const lineEndOffset = Math.max(30, Math.round(homeSize * 0.38));
    const sourceClickable = this._config?.clickable_entities !== false && sourceNode.entityId;
    const homeClickable = this._config?.clickable_entities !== false && nodes.home.entityId;
    const sourceUnavailableBadge = this._config?.show_unavailable_badge !== false && sourceNode.unavailable
      ? `<span class="power-flow-card__unavailable"><ha-icon icon="mdi:help"></ha-icon></span>`
      : "";
    const homeUnavailableBadge = this._config?.show_unavailable_badge !== false && nodes.home.unavailable
      ? `<span class="power-flow-card__unavailable"><ha-icon icon="mdi:help"></ha-icon></span>`
      : "";
    const showDashboardButton = this._config?.show_dashboard_link_button !== false && Boolean(this._config?.dashboard_link);
    const dashboardLabel = this._config?.dashboard_link_label || "Energy";

    return `
      <div class="power-flow-card__simple-layout ${showDashboardButton ? "has-footer" : ""} ${animateEntrance ? "power-flow-card__simple-layout--entering" : ""}">
        <div
          class="power-flow-card__simple-top ${animateEntrance ? "power-flow-card__simple-top--entering" : ""}"
          style="--simple-source-column:${nodeSize}px; --simple-home-column:${homeSize}px;"
        >
          <div class="power-flow-card__simple-column power-flow-card__simple-column--source-top">
            ${this._renderSimpleLabelChip(sourceNode)}
          </div>
          <div></div>
          <div class="power-flow-card__simple-column power-flow-card__simple-column--home power-flow-card__simple-column--home-top">
            ${this._renderSimpleLabelChip(nodes.home)}
          </div>
        </div>

        <div
          class="power-flow-card__simple-rail ${animateEntrance ? "power-flow-card__simple-rail--entering" : ""}"
          style="--simple-rail-height:${Math.max(nodeSize, homeSize)}px; --simple-source-column:${nodeSize}px; --simple-home-column:${homeSize}px;"
        >
          <div
            class="power-flow-card__simple-line-wrap"
            style="--line-start-offset:${lineStartOffset}px; --line-end-offset:${lineEndOffset}px;"
          >
            <div
              class="power-flow-card__simple-line ${flowLine?.active ? "is-active" : ""}"
              style="--line-color:${escapeHtml(lineColor)}; --line-opacity:${lineOpacity}; --line-background:${escapeHtml(lineBackground)};"
            >
              ${flowLine?.active ? `
                <span class="power-flow-card__simple-dot" style="animation-duration:${bubbleDuration.toFixed(2)}s;"></span>
              ` : ""}
            </div>
          </div>

          <div class="power-flow-card__simple-rail-node power-flow-card__simple-rail-node--source" style="--simple-node-cover-size:${nodeSize}px;">
            <button
              class="power-flow-card__bubble ${sourceClickable ? "is-clickable" : ""}"
              data-node-entity="${escapeHtml(sourceNode.entityId)}"
              data-node-action="${sourceClickable ? "more-info" : ""}"
              style="--node-size:${nodeSize}px; --node-tint:${escapeHtml(sourceNode.color)};"
              title="${escapeHtml(sourceNode.label)}"
            >
              ${sourceUnavailableBadge}
              <ha-icon icon="${escapeHtml(sourceNode.icon)}"></ha-icon>
            </button>
          </div>

          <div class="power-flow-card__simple-rail-spacer"></div>

          <div class="power-flow-card__simple-rail-node power-flow-card__simple-rail-node--home" style="--simple-node-cover-size:${homeSize}px;">
            <button
              class="power-flow-card__bubble power-flow-card__bubble--home ${homeClickable ? "is-clickable" : ""}"
              data-node-entity="${escapeHtml(nodes.home.entityId)}"
              data-node-action="${homeClickable ? "more-info" : ""}"
              style="--node-size:${homeSize}px; --node-tint:${escapeHtml(nodes.home.color)};"
              title="${escapeHtml(nodes.home.label)}"
            >
              ${homeUnavailableBadge}
              <span class="power-flow-card__home-icon-wrap">
                <ha-icon icon="${escapeHtml(nodes.home.icon)}"></ha-icon>
              </span>
              ${
                this._config?.show_values === false
                  ? ""
                  : `
                    <span class="power-flow-card__home-value">
                      <span class="power-flow-card__home-value-number">${escapeHtml(nodes.home.valueText)}</span>
                      ${nodes.home.unitText ? `<span class="power-flow-card__home-value-unit">${escapeHtml(nodes.home.unitText)}</span>` : ""}
                    </span>
                  `
              }
            </button>
          </div>
        </div>

        <div
          class="power-flow-card__simple-bottom ${animateEntrance ? "power-flow-card__simple-bottom--entering" : ""}"
          style="--simple-source-column:${nodeSize}px; --simple-home-column:${homeSize}px;"
        >
          <div class="power-flow-card__simple-column power-flow-card__simple-column--source power-flow-card__simple-column--source-bottom">
            ${this._renderSimpleValueChip(sourceNode)}
            ${sourceNode.secondary ? `<span class="power-flow-card__node-secondary">${escapeHtml(sourceNode.secondary)}</span>` : ""}
          </div>
          <div></div>
          <div></div>
        </div>

        ${
          showDashboardButton
            ? `
              <div class="power-flow-card__simple-footer ${animateEntrance ? "power-flow-card__simple-footer--entering" : ""}">
                <button class="power-flow-card__dashboard-button power-flow-card__dashboard-button--footer" data-dashboard-action="navigate" title="${escapeHtml(dashboardLabel)}">
                  <ha-icon icon="mdi:lightning-bolt-circle"></ha-icon>
                  <span>${escapeHtml(dashboardLabel)}</span>
                </button>
              </div>
            `
            : ""
        }
      </div>
    `;
  }

  _onShadowClick(event) {
    const dashboardButton = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.dashboardAction === "navigate");
    if (dashboardButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerPressAnimation(dashboardButton);
      this._triggerHaptic("selection");
      this._navigate(this._config?.dashboard_link);
      return;
    }

    const nodeAction = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.nodeAction === "more-info");
    if (nodeAction && nodeAction.dataset?.nodeEntity) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerPressAnimation(nodeAction);
      this._triggerHaptic("selection");
      fireEvent(this, "hass-more-info", {
        entityId: nodeAction.dataset.nodeEntity,
      });
      return;
    }

    if ((this._config?.tap_action || "none") === "more-info" && this._config?.entities?.home?.entity) {
      const content = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.cardAction === "primary");
      if (content) {
        event.preventDefault();
        event.stopPropagation();
        this._triggerPressAnimation(this.shadowRoot.querySelector(".power-flow-card__content"));
        this._triggerHaptic("selection");
        fireEvent(this, "hass-more-info", {
          entityId: this._config.entities.home.entity,
        });
      }
    }
  }

  _getTitle() {
    return this._config?.title || this._config?.name || "Flujo";
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const nodes = this._getNodes();
    const lines = this._buildLines(nodes);
    const dominantColor = this._getDominantColor(lines);
    const flowWidth = Math.max(1, parseSizeToPixels(styles.flow_width, 1.2));
    const hasLowerNodes = Boolean(nodes.water.entityId || nodes.gas.entityId || nodes.individual.length);
    const layoutPreset = nodes._layoutPreset || "full";
    const flowFlags = nodes._flowFlags || getFlowLayoutFlagsFromConfig(this._config);
    const flowDotBoost = 1 + Math.max(0, flowWidth - 1) * 0.065;
    const flowDotGlowR = 2.1 * flowDotBoost;
    const flowDotCoreR = 1.12 * flowDotBoost;
    const flowDotCoreStroke = 0.26;
    const surfaceLayoutExtras = (() => {
      let add = 0;
      if (layoutPreset !== "simple") {
        add += Math.min(Math.max(0, flowFlags.individualCount - 1), 5) * 22;
      }
      return add;
    })();
    const topEnergyConfigured = [nodes.grid.entityId, nodes.solar.entityId, nodes.battery.entityId].filter(Boolean).length;
    const minimalFlowDiagram = layoutPreset !== "simple" && topEnergyConfigured <= 1 && !hasLowerNodes;
    const stripOnlyGridHome =
      layoutPreset !== "simple"
      && Boolean(nodes.grid.entityId && nodes.home.entityId)
      && !nodes.solar.entityId
      && !nodes.battery.entityId
      && !hasLowerNodes
      && !nodes.individual?.length;
    const upperBandHubOnly =
      layoutPreset !== "simple"
      && Boolean(nodes.solar.entityId && nodes.grid.entityId && nodes.home.entityId)
      && !nodes.battery.entityId
      && !hasLowerNodes;
    const baseSurfaceDiagram = (() => {
      if (layoutPreset === "simple") {
        return 162;
      }
      if (stripOnlyGridHome) {
        return layoutPreset === "compact" ? 132 : 146;
      }
      if (upperBandHubOnly) {
        return layoutPreset === "compact" ? 188 : 202;
      }
      if (minimalFlowDiagram) {
        return layoutPreset === "compact" ? 200 : 222;
      }
      return layoutPreset === "compact" ? (hasLowerNodes ? 306 : 264) : (hasLowerNodes ? 336 : 286);
    })();
    const surfaceFloor = (() => {
      if (layoutPreset === "simple") {
        return 148;
      }
      if (stripOnlyGridHome) {
        return layoutPreset === "compact" ? 122 : 128;
      }
      if (upperBandHubOnly) {
        return layoutPreset === "compact" ? 152 : 160;
      }
      if (minimalFlowDiagram) {
        return layoutPreset === "compact" ? 158 : 168;
      }
      return 236;
    })();
    const surfaceMinHeight = Math.min(
      Math.max(
        (layoutPreset === "simple" ? 162 : baseSurfaceDiagram) + surfaceLayoutExtras,
        surfaceFloor,
      ),
      540,
    );
    const baseSurfaceMobile = (() => {
      if (layoutPreset === "simple") {
        return 144;
      }
      if (stripOnlyGridHome) {
        return layoutPreset === "compact" ? 126 : 136;
      }
      if (upperBandHubOnly) {
        return layoutPreset === "compact" ? 172 : 184;
      }
      if (minimalFlowDiagram) {
        return layoutPreset === "compact" ? 186 : 200;
      }
      return hasLowerNodes ? 308 : 268;
    })();
    const surfaceMinHeightMobile = Math.min(
      Math.max(
        baseSurfaceMobile + surfaceLayoutExtras,
        layoutPreset === "simple"
          ? 132
          : stripOnlyGridHome
            ? (layoutPreset === "compact" ? 118 : 124)
            : upperBandHubOnly
              ? (layoutPreset === "compact" ? 146 : 152)
              : minimalFlowDiagram
              ? (layoutPreset === "compact" ? 150 : 158)
              : 236,
      ),
      520,
    );
    const surfaceAspectCss = upperBandHubOnly
      ? (layoutPreset === "compact" ? "1 / 0.64" : "1 / 0.58")
      : stripOnlyGridHome
        ? (layoutPreset === "compact" ? "1 / 0.40" : "1 / 0.36")
        : "1 / 1.04";
    const flowDotViewAspect = (() => {
      const m = String(surfaceAspectCss).trim().match(/^([\d.]+)\s*\/\s*([\d.]+)/);
      if (!m) {
        return 1;
      }
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a > 0 && b > 0) {
        return a / b;
      }
      return 1;
    })();
    const flowDotOpts = {
      glowR: flowDotGlowR,
      coreR: flowDotCoreR,
      coreStroke: flowDotCoreStroke,
      viewAspect: flowDotViewAspect,
    };
    const showDashboardButton = this._config?.show_dashboard_link_button !== false && Boolean(this._config?.dashboard_link);
    const titleText = this._config?.title || this._config?.name || (layoutPreset === "simple" ? "" : "Flujo");
    const hasHeader = this._config?.show_header !== false && (Boolean(titleText) || (showDashboardButton && layoutPreset !== "simple"));
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --power-flow-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          --power-flow-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          display: block;
          height: auto;
          min-height: 0;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          background-color: var(--ha-card-background, var(--card-background-color, #fff));
          border-radius: ${styles.card.border_radius};
          height: auto;
          isolation: isolate;
          min-height: 0;
          overflow: hidden;
          position: relative;
        }

        ha-card::before {
          background: color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 95%, transparent);
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .power-flow-card {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${dominantColor} 12%, transparent) 0%, transparent 42%),
            linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(0,0,0,0.03) 100%),
            ${styles.card.background};
          border: 1px solid color-mix(in srgb, ${dominantColor} 18%, var(--divider-color));
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow}, 0 14px 28px color-mix(in srgb, ${dominantColor} 7%, rgba(0,0,0,0.14));
          color: var(--primary-text-color);
          display: flex;
          flex-direction: column;
          gap: ${styles.card.gap};
          height: auto;
          isolation: isolate;
          min-height: 0;
          overflow: hidden;
          padding: ${styles.card.padding};
          position: relative;
          transform-origin: center;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 160ms ease;
        }

        .power-flow-card__header {
          align-items: center;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          isolation: isolate;
          position: relative;
          z-index: 4;
        }

        .power-flow-card__header--entering {
          animation: power-flow-card-fade-up calc(var(--power-flow-card-content-duration) * 0.82) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .power-flow-card__title {
          color: var(--primary-text-color);
          font-size: ${Math.max(14, parseSizeToPixels(styles.title_size, 16))}px;
          font-weight: 700;
          line-height: 1.1;
          min-width: 0;
          opacity: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .power-flow-card__dashboard-button {
          align-items: center;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--primary-text-color) 7%, transparent) 0%,
            color-mix(in srgb, var(--primary-text-color) 3%, transparent) 100%
          );
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          min-height: 34px;
          padding: 0 12px;
          transform-origin: center;
          transition: transform 160ms ease, border-color 160ms ease, box-shadow 180ms ease, background 180ms ease;
          will-change: transform;
        }

        .power-flow-card__dashboard-button:hover {
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--primary-text-color) 11%, transparent) 0%,
            color-mix(in srgb, var(--primary-text-color) 5%, transparent) 100%
          );
          border-color: color-mix(in srgb, var(--primary-text-color) 20%, transparent);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 12%, transparent),
            0 6px 16px rgba(0, 0, 0, 0.08);
        }

        .power-flow-card__dashboard-button ha-icon {
          --mdc-icon-size: 16px;
        }

        .power-flow-card__content {
          flex: 0 1 auto;
          min-height: 0;
          position: relative;
          transform-origin: center;
          z-index: 1;
        }

        .power-flow-card__content--entering {
          animation: power-flow-card-fade-up var(--power-flow-card-content-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 34ms;
        }

        .power-flow-card--simple .power-flow-card__content {
          align-items: stretch;
          display: flex;
          justify-content: flex-start;
        }

        .power-flow-card__surface {
          background: linear-gradient(180deg, color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 18%, transparent) 0%, transparent 100%);
          border-radius: calc(${styles.card.border_radius} - 6px);
          box-sizing: border-box;
          height: auto;
          min-height: ${surfaceMinHeight}px;
          position: relative;
          transform-origin: center;
          width: 100%;
        }

        .power-flow-card--compact .power-flow-card__surface,
        .power-flow-card--full .power-flow-card__surface {
          aspect-ratio: ${surfaceAspectCss};
          max-height: none;
          padding: 9px 11px 11px;
        }

        .power-flow-card__surface--entering {
          animation: power-flow-card-surface-in calc(var(--power-flow-card-content-duration) * 0.94) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 46ms;
        }

        .power-flow-card__svg {
          height: 100%;
          inset: 0;
          overflow: hidden;
          position: absolute;
          width: 100%;
          pointer-events: none;
          shape-rendering: geometricPrecision;
        }

        .power-flow-card__svg--lines {
          z-index: 0;
        }

        .power-flow-card__surface--entering .power-flow-card__svg--lines {
          animation: power-flow-card-lines-in calc(var(--power-flow-card-content-duration) * 0.92) cubic-bezier(0.22, 0.84, 0.26, 1) forwards;
          animation-delay: 82ms;
          transform-origin: center;
        }

        .power-flow-card__svg--dots {
          z-index: 3;
        }

        .power-flow-card__surface--entering .power-flow-card__svg--dots {
          animation: power-flow-card-dots-in calc(var(--power-flow-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) forwards;
          animation-delay: 124ms;
          transform: none;
          transform-origin: center;
        }

        .power-flow-card__line {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: ${flowWidth}px;
        }

        .power-flow-card__line-glow {
          fill: none;
          filter: url(#power-flow-glow);
          opacity: 0.08;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: ${flowWidth * 1.28}px;
        }

        .power-flow-card__dot-glow {
          fill: color-mix(in srgb, var(--dot-color) 32%, rgba(255,255,255,0.2));
          opacity: 0.88;
        }

        .power-flow-card__dot-core {
          fill: rgba(255, 255, 255, 0.98);
          stroke: color-mix(in srgb, var(--dot-color) 36%, rgba(255,255,255,0.5));
        }

        .power-flow-card__node {
          position: absolute;
          transform: translate(-50%, -50%);
          transform-origin: center;
          will-change: opacity, transform;
          z-index: 1;
        }

        .power-flow-card__node--entering {
          animation: power-flow-card-node-in calc(var(--power-flow-card-content-duration) * 0.86) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: var(--node-enter-delay, 0ms);
        }

        .power-flow-card__node-info {
          align-items: center;
          display: flex;
          flex-direction: column;
          gap: 5px;
          left: 50%;
          max-width: 180px;
          min-width: 0;
          position: absolute;
          transform: translateX(-50%);
        }

        .power-flow-card__node-info--below {
          top: calc(100% + 5px);
        }

        .power-flow-card__node-info--above {
          bottom: calc(100% + 5px);
        }

        .power-flow-card__node-info--home {
          bottom: calc(100% + 8px);
        }

        .power-flow-card--simple .power-flow-card__header {
          gap: 8px;
        }

        .power-flow-card--simple {
          gap: 8px;
          padding: 10px;
        }

        .power-flow-card--simple .power-flow-card__dashboard-button {
          min-height: 38px;
          padding: 0 15px;
        }

        .power-flow-card--simple .power-flow-card__surface {
          min-height: 148px;
        }

        .power-flow-card--simple .power-flow-card__node-info {
          gap: 4px;
        }

        .power-flow-card--simple .power-flow-card__chip {
          max-width: 120px;
        }

        .power-flow-card__simple-layout {
          align-content: space-between;
          display: grid;
          gap: 4px;
          grid-template-rows: auto 1fr auto;
          min-height: 100%;
          position: relative;
          width: 100%;
        }

        .power-flow-card__simple-layout.has-footer {
          padding-bottom: 42px;
        }

        .power-flow-card__simple-top--entering {
          animation: power-flow-card-fade-up calc(var(--power-flow-card-content-duration) * 0.74) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 46ms;
        }

        .power-flow-card__simple-rail--entering {
          animation: power-flow-card-surface-in calc(var(--power-flow-card-content-duration) * 0.88) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 92ms;
        }

        .power-flow-card__simple-bottom--entering {
          animation: power-flow-card-fade-up calc(var(--power-flow-card-content-duration) * 0.76) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 132ms;
        }

        .power-flow-card__simple-top,
        .power-flow-card__simple-bottom {
          align-items: center;
          display: grid;
          gap: 0;
          grid-template-columns: var(--simple-source-column, 48px) minmax(64px, 1fr) var(--simple-home-column, 96px);
          width: 100%;
        }

        .power-flow-card__simple-top {
          margin-bottom: 1px;
        }

        .power-flow-card__simple-bottom {
          margin-top: 2px;
        }

        .power-flow-card__simple-rail {
          align-items: center;
          display: grid;
          gap: 0;
          grid-template-columns: var(--simple-source-column, 48px) minmax(64px, 1fr) var(--simple-home-column, 96px);
          min-height: var(--simple-rail-height, 96px);
          position: relative;
          width: 100%;
        }

        .power-flow-card__simple-rail-node {
          align-items: center;
          display: flex;
          justify-content: center;
          min-width: 0;
          position: relative;
          z-index: 2;
        }

        .power-flow-card__simple-rail-node::before {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${dominantColor} 9%, transparent) 0%, transparent 58%),
            linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(0,0,0,0.03) 100%),
            ${styles.card.background};
          border-radius: 999px;
          content: "";
          height: calc(var(--simple-node-cover-size, 48px) + 12px);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(var(--simple-node-cover-size, 48px) + 12px);
          z-index: 0;
        }

        .power-flow-card__simple-rail-node--source {
          grid-column: 1;
        }

        .power-flow-card__simple-rail-node--home {
          grid-column: 3;
        }

        .power-flow-card__simple-rail-spacer {
          grid-column: 2;
          min-width: 64px;
        }

        .power-flow-card__simple-column {
          align-items: center;
          display: grid;
          gap: 4px;
          justify-items: center;
          min-width: 0;
          position: relative;
          z-index: 1;
        }

        .power-flow-card__simple-column--home {
          gap: 3px;
          justify-self: center;
          margin-bottom: 0;
          max-width: 100%;
          width: max-content;
        }

        .power-flow-card__simple-column--source {
          justify-self: center;
          margin-top: 0;
          max-width: 100%;
          width: max-content;
        }

        .power-flow-card__simple-column--source-top {
          justify-self: center;
          max-width: 100%;
          width: max-content;
        }

        .power-flow-card__simple-column--home-top {
          transform: translateY(-4px);
        }

        .power-flow-card__simple-column--source-top {
          gap: 3px;
          transform: translateY(4px);
        }

        .power-flow-card__simple-column--source-bottom {
          gap: 3px;
          transform: translateY(-6px);
        }

        .power-flow-card__simple-info {
          align-items: center;
          display: grid;
          gap: 4px;
          justify-items: center;
          min-width: 0;
        }

        .power-flow-card__simple-info .power-flow-card__chip,
        .power-flow-card__simple-info .power-flow-card__node-secondary {
          max-width: 150px;
        }

        .power-flow-card__simple-top .power-flow-card__chip,
        .power-flow-card__simple-bottom .power-flow-card__chip {
          justify-self: center;
          margin-left: auto;
          margin-right: auto;
        }

        .power-flow-card__simple-line-wrap {
          left: var(--line-start-offset, 18px);
          min-width: 64px;
          pointer-events: none;
          position: absolute;
          right: var(--line-end-offset, 28px);
          top: 50%;
          transform: translateY(-50%);
          width: auto;
          z-index: 1;
        }

        .power-flow-card__simple-line {
          background: linear-gradient(180deg, color-mix(in srgb, var(--line-background) 100%, transparent) 0%, color-mix(in srgb, var(--line-background) 78%, transparent) 100%);
          border-radius: 999px;
          height: ${Math.max(flowWidth, 2)}px;
          opacity: var(--line-opacity);
          overflow: hidden;
          position: relative;
          width: 100%;
        }

        .power-flow-card__simple-line.is-active {
          box-shadow: 0 0 12px color-mix(in srgb, var(--line-color) 16%, transparent);
        }

        .power-flow-card__simple-dot {
          background: radial-gradient(circle at 35% 35%, rgba(255,255,255,0.98) 0 35%, color-mix(in srgb, var(--line-color) 44%, rgba(255,255,255,0.92)) 36% 100%);
          border-radius: 999px;
          box-shadow:
            0 0 0 3px color-mix(in srgb, var(--line-color) 14%, transparent),
            0 0 10px color-mix(in srgb, var(--line-color) 20%, transparent);
          height: 8px;
          left: 0;
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 8px;
          will-change: left, opacity;
          animation: power-flow-card-simple-dot linear infinite;
        }

        .power-flow-card--motion-paused .power-flow-card__simple-dot {
          animation-play-state: paused !important;
        }

        @keyframes power-flow-card-simple-dot {
          0% {
            left: 0;
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          92% {
            opacity: 1;
          }
          100% {
            left: calc(100% - 8px);
            opacity: 0;
          }
        }

        .power-flow-card__bubble {
          align-items: center;
          appearance: none;
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--node-tint) 12%, transparent) 0%, transparent 48%),
            linear-gradient(180deg, color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 88%, rgba(255,255,255,0.07)) 0%, color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 72%, rgba(255,255,255,0.03)) 100%);
          border: 1px solid color-mix(in srgb, var(--node-tint) 24%, rgba(255,255,255,0.09));
          border-radius: 999px;
          box-shadow: 0 10px 20px color-mix(in srgb, var(--node-tint) 7%, rgba(0,0,0,0.14));
          color: ${styles.icon.color || "var(--primary-text-color)"};
          cursor: default;
          display: inline-flex;
          height: var(--node-size);
          justify-content: center;
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
          will-change: transform;
          z-index: 1;
          width: var(--node-size);
        }

        .power-flow-card__bubble.is-clickable {
          cursor: pointer;
        }

        .power-flow-card__bubble:hover.is-clickable {
          transform: translateY(-1px);
        }

        .power-flow-card__simple-footer {
          display: flex;
          inset: auto 0 0 0;
          justify-content: center;
          position: absolute;
          width: 100%;
        }

        .power-flow-card__simple-footer--entering {
          animation: power-flow-card-fade-up calc(var(--power-flow-card-content-duration) * 0.74) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 168ms;
        }

        .power-flow-card__dashboard-button--footer {
          min-width: 0;
          min-height: 40px;
          padding: 0 16px;
        }

        .power-flow-card__dashboard-button--footer ha-icon {
          --mdc-icon-size: 18px;
        }

        .power-flow-card__bubble ha-icon {
          --mdc-icon-size: calc(var(--node-size) * 0.44);
        }

        .power-flow-card__bubble--home {
          align-items: center;
          border-radius: 30px;
          display: grid;
          gap: 5px;
          grid-auto-rows: min-content;
          justify-items: center;
          padding: 10px 12px;
        }

        .power-flow-card--simple .power-flow-card__bubble--home {
          gap: 4px;
          padding: 9px 11px;
        }

        .power-flow-card__home-icon-wrap {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          display: inline-flex;
          height: 31px;
          justify-content: center;
          width: 31px;
        }

        .power-flow-card--simple .power-flow-card__home-icon-wrap {
          height: 29px;
          width: 29px;
        }

        .power-flow-card__home-icon-wrap ha-icon {
          --mdc-icon-size: 17px;
        }

        .power-flow-card__home-value {
          align-items: baseline;
          display: inline-flex;
          gap: 4px;
          justify-content: center;
          min-width: 0;
        }

        .power-flow-card--simple .power-flow-card__home-value {
          gap: 3px;
        }

        .power-flow-card__home-value-number {
          font-size: ${Math.max(19, parseSizeToPixels(styles.home_value_size, 22))}px;
          font-weight: 700;
          letter-spacing: -0.04em;
          line-height: 0.9;
        }

        .power-flow-card--simple .power-flow-card__home-value-number {
          font-size: ${Math.max(16, parseSizeToPixels(styles.home_value_size, 22) - 4)}px;
          letter-spacing: -0.035em;
        }

        .power-flow-card__home-value-unit {
          font-size: ${Math.max(12, parseSizeToPixels(styles.home_unit_size, 14))}px;
          font-weight: 600;
          opacity: 0.84;
        }

        .power-flow-card--simple .power-flow-card__home-value-unit {
          font-size: ${Math.max(10, parseSizeToPixels(styles.home_unit_size, 14) - 2)}px;
        }

        .power-flow-card__bubble--individual {
          border-radius: 18px;
        }

        .power-flow-card__chip {
          align-items: center;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--primary-text-color) 6%, transparent) 0%,
            color-mix(in srgb, var(--primary-text-color) 3%, transparent) 100%
          );
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          color: var(--primary-text-color);
          display: inline-flex;
          font-size: var(--chip-font-size, 10px);
          font-weight: 600;
          gap: 4px;
          height: var(--chip-height, 22px);
          justify-content: center;
          max-width: 180px;
          min-width: 0;
          padding: var(--chip-padding, 0 9px);
          white-space: nowrap;
        }

        .power-flow-card__chip--label,
        .power-flow-card__chip--value {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .power-flow-card__chip--value {
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--chip-tint) 16%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)) 0%,
            color-mix(in srgb, var(--primary-text-color) 4%, transparent) 100%
          );
          border-color: color-mix(in srgb, var(--chip-tint) 30%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }

        .power-flow-card__chip-unit {
          opacity: 0.82;
        }

        .power-flow-card__chip-direction {
          --mdc-icon-size: calc(var(--chip-font-size, 10px) + 4px);
          flex: 0 0 auto;
          opacity: 0.9;
        }

        .power-flow-card__node-secondary {
          color: var(--secondary-text-color);
          display: block;
          font-size: var(--secondary-size, 10px);
          font-weight: 500;
          max-width: 170px;
          overflow: hidden;
          text-align: center;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .power-flow-card__unavailable {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          color: #fff;
          display: inline-flex;
          height: 18px;
          justify-content: center;
          position: absolute;
          right: -3px;
          top: -3px;
          width: 18px;
          z-index: 2;
        }

        .power-flow-card__unavailable ha-icon {
          --mdc-icon-size: 11px;
        }

        .power-flow-card__content.is-pressing {
          animation: power-flow-card-content-bounce var(--power-flow-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        :is(.power-flow-card__bubble, .power-flow-card__dashboard-button).is-pressing {
          animation: power-flow-card-bubble-bounce var(--power-flow-card-button-bounce-duration) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
        }

        @keyframes power-flow-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes power-flow-card-surface-in {
          0% {
            opacity: 0;
            transform: scale(0.975);
          }
          60% {
            opacity: 1;
            transform: scale(1.015);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes power-flow-card-lines-in {
          0% {
            opacity: 0;
            transform: scale(0.985);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes power-flow-card-dots-in {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes power-flow-card-node-in {
          0% {
            opacity: 0;
            transform: translate(-50%, calc(-50% + 10px)) scale(0.9);
          }
          62% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.04);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes power-flow-card-content-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.015);
          }
          72% {
            transform: scale(1.006);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes power-flow-card-bubble-bounce {
          0% {
            transform: scale(1);
          }
          48% {
            transform: scale(1.1);
          }
          72% {
            transform: scale(1.03);
          }
          100% {
            transform: scale(1);
          }
        }

        @media (max-width: 640px) {
          .power-flow-card__surface {
            min-height: ${surfaceMinHeightMobile}px;
          }

          .power-flow-card__dashboard-button {
            min-height: 34px;
            padding: 0 12px;
          }
        }

        ${animations.enabled ? "" : `
        .power-flow-card,
        .power-flow-card *,
        .power-flow-card *::before,
        .power-flow-card *::after {
          animation: none !important;
          transition: none !important;
        }
        `}
      </style>
      <ha-card class="power-flow-card power-flow-card--${layoutPreset}">
        ${
          hasHeader
            ? `
              <div class="power-flow-card__header ${shouldAnimateEntrance ? "power-flow-card__header--entering" : ""}">
                <div class="power-flow-card__title">${escapeHtml(titleText)}</div>
                ${
                  showDashboardButton && layoutPreset !== "simple"
                    ? `
                      <button class="power-flow-card__dashboard-button" data-dashboard-action="navigate" title="${escapeHtml(this._config?.dashboard_link_label || "Energy")}">
                        <ha-icon icon="mdi:lightning-bolt-circle"></ha-icon>
                        <span>${escapeHtml(this._config?.dashboard_link_label || "Energy")}</span>
                      </button>
                    `
                    : ""
                }
              </div>
            `
            : ""
        }
        <div class="power-flow-card__content ${shouldAnimateEntrance ? "power-flow-card__content--entering" : ""}" ${this._config?.tap_action === "more-info" ? 'data-card-action="primary"' : ""}>
          ${
            layoutPreset === "simple"
              ? this._renderSimpleLayout(nodes, lines, {
                animateEntrance: shouldAnimateEntrance,
              })
              : `
                <div class="power-flow-card__surface ${shouldAnimateEntrance ? "power-flow-card__surface--entering" : ""}">
                  <svg class="power-flow-card__svg power-flow-card__svg--lines" viewBox="0 0 100 100" preserveAspectRatio="none" shape-rendering="geometricPrecision">
                    <defs>
                      <filter id="power-flow-glow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="0.85"></feGaussianBlur>
                      </filter>
                      <filter id="power-flow-soften" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="0.06"></feGaussianBlur>
                      </filter>
                    </defs>
                    ${lines.map(line => `
                      <path class="power-flow-card__line-glow" d="${line.path}" stroke="${escapeHtml(line.color)}" opacity="${line.opacity * (line.active ? 1 : 0.7)}"></path>
                      <path class="power-flow-card__line" d="${line.path}" stroke="${escapeHtml(line.color)}" opacity="${line.opacity}"></path>
                    `).join("")}
                  </svg>
                  ${this._renderNode(nodes.home, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.home),
                  })}
                  ${nodes.grid.entityId ? this._renderNode(nodes.grid, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.grid),
                  }) : ""}
                  ${nodes.solar.entityId ? this._renderNode(nodes.solar, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.solar),
                  }) : ""}
                  ${nodes.battery.entityId ? this._renderNode(nodes.battery, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.battery),
                  }) : ""}
                  ${nodes.water.entityId ? this._renderNode(nodes.water, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.water),
                  }) : ""}
                  ${nodes.gas.entityId ? this._renderNode(nodes.gas, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.gas),
                  }) : ""}
                  ${nodes.individual.map((node, index) => this._renderNode(node, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(node, index),
                  })).join("")}
                  <svg class="power-flow-card__svg power-flow-card__svg--dots" viewBox="0 0 100 100" preserveAspectRatio="none" shape-rendering="geometricPrecision">
                    ${lines.map(line => this._renderFlowDots(line, flowDotOpts)).join("")}
                  </svg>
                </div>
              `
          }
        </div>
      </ha-card>
    `;

    this._syncFlowMotionPause();
    this._lastRenderSignature = this._getRenderSignature();

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 180);
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaPowerFlowCard);
}

class NodaliaPowerFlowCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._onShadowInput = this._onShadowInput.bind(this);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
  }

  set hass(hass) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender = !this._hass || nextSignature !== this._entityOptionsSignature || !this.shadowRoot?.innerHTML;
    this._hass = hass;
    this._entityOptionsSignature = nextSignature;

    if (shouldRender) {
      this._render();
    }
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._render();
  }

  _getEntityOptionsSignature(hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id =>
      id.startsWith("sensor.") || id.startsWith("number.") || id.startsWith("input_number."),
    );
  }

  _captureFocusState() {
    const activeElement = this.shadowRoot?.activeElement;
    if (
      !(
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement
      ) ||
      !activeElement.dataset?.field
    ) {
      return null;
    }

    const selector = `[data-field="${CSS.escape(activeElement.dataset.field)}"]`;
    const supportsSelection =
      (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) &&
      activeElement.type !== "checkbox" &&
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
        const numeric = Number(input.value);
        return Number.isFinite(numeric) ? numeric : undefined;
      }
      case "rgb-array":
        return String(input.value || "")
          .split(",")
          .map(item => clamp(Number.parseInt(item.trim(), 10) || 0, 0, 255))
          .slice(0, 3);
      case "individuals":
        return String(input.value || "")
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const [entity, name = "", icon = "", color = ""] = line.split("|").map(part => part.trim());
            return { entity, name, icon, color };
          })
          .filter(item => item.entity);
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
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";

    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <textarea
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          rows="${escapeHtml(String(options.rows || 4))}"
          ${placeholder}
        >${escapeHtml(inputValue)}</textarea>
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

  _renderSelectField(label, field, value, options) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options.map(option => `
            <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
              ${escapeHtml(this._editorLabel(option.label))}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _serializeIndividuals() {
    return resolveIndividualConfigs(this._config)
      .map(entry => [entry.entity || "", entry.name || "", entry.icon || "", entry.color || ""].join("|"))
      .join("\n");
  }

  _getEntityOptionsMarkup() {
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const allEntities = Object.keys(this._hass?.states || {})
      .filter(entityId => entityId.startsWith("sensor.") || entityId.startsWith("number.") || entityId.startsWith("input_number."))
      .sort((left, right) => left.localeCompare(right, sortLoc));

    return `
      <datalist id="power-flow-card-entity-options">
        ${allEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
    `;
  }

  _renderNodeSection(titleKey, hintKey, prefix, values) {
    const isGrid = prefix === "entities.grid";
    const gridExportFields = isGrid ? `
          ${this._renderTextField("ed.power_flow.node_grid_export_entity", `${prefix}.export_entity`, values.export_entity, { placeholder: "sensor.grid_feed_in" })}
          ${this._renderTextField("ed.power_flow.node_grid_export_color", `${prefix}.export_color`, values.export_color || NODE_DEFAULTS.grid.export_color, { placeholder: NODE_DEFAULTS.grid.export_color })}
          ${this._renderCheckboxField("ed.power_flow.node_grid_export_when_negative", `${prefix}.export_when_negative`, values.export_when_negative !== false)}
    ` : "";
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div class="editor-section__title">${escapeHtml(this._editorLabel(titleKey))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel(hintKey))}</div>
        </div>
        <div class="editor-grid">
          ${this._renderTextField("ed.entity.entity_main", `${prefix}.entity`, values.entity, { placeholder: "sensor.mi_sensor" })}
          ${this._renderTextField("ed.entity.name", `${prefix}.name`, values.name)}
          ${this._renderTextField("ed.entity.icon", `${prefix}.icon`, values.icon, { placeholder: "mdi:flash" })}
          ${this._renderTextField("ed.power_flow.node_color", `${prefix}.color`, values.color, { placeholder: "#f6b73c" })}
          ${gridExportFields}
          ${this._renderTextField("ed.power_flow.node_secondary_entity", `${prefix}.secondary_info.entity`, values.secondary_info?.entity, { placeholder: "sensor.mi_secundaria" })}
          ${this._renderTextField("ed.power_flow.node_secondary_attribute", `${prefix}.secondary_info.attribute`, values.secondary_info?.attribute, { placeholder: "battery_level" })}
        </div>
      </section>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig(STUB_CONFIG);
    const hapticStyle = config.haptics?.style || "medium";
    const grid = resolveNodeConfig("grid", config);
    const home = resolveNodeConfig("home", config);
    const solar = resolveNodeConfig("solar", config);
    const battery = resolveNodeConfig("battery", config);
    const water = resolveNodeConfig("water", config);
    const gas = resolveNodeConfig("gas", config);

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
          min-height: 110px;
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
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.general_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.nav.title_bar", "title", config.title, { placeholder: "Energy" })}
            ${this._renderTextField("ed.power_flow.energy_dashboard_url", "dashboard_link", config.dashboard_link, { placeholder: "/energy/overview" })}
            ${this._renderTextField("ed.power_flow.energy_dashboard_button_label", "dashboard_link_label", config.dashboard_link_label, { placeholder: "Energy" })}
            ${this._renderSelectField("ed.power_flow.card_tap_action", "tap_action", config.tap_action || "none", [
              { value: "none", label: "ed.power_flow.tap_none" },
              { value: "more-info", label: "ed.power_flow.tap_more_info_home" },
            ])}
            ${this._renderCheckboxField("ed.power_flow.show_header", "show_header", config.show_header !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_dashboard_button", "show_dashboard_link_button", config.show_dashboard_link_button !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_labels", "show_labels", config.show_labels !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_values", "show_values", config.show_values !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_secondary_info", "show_secondary_info", config.show_secondary_info !== false)}
            ${this._renderCheckboxField("ed.power_flow.clickable_entities", "clickable_entities", config.clickable_entities !== false)}
            ${this._renderCheckboxField("ed.power_flow.badge_unavailable", "show_unavailable_badge", config.show_unavailable_badge !== false)}
          </div>
        </section>

        ${this._renderNodeSection("ed.power_flow.node_grid_title", "ed.power_flow.node_grid_hint_yaml", "entities.grid", grid)}
        ${this._renderNodeSection("ed.power_flow.node_home_title", "ed.power_flow.node_home_hint_yaml", "entities.home", home)}
        ${this._renderNodeSection("ed.power_flow.node_solar_title", "ed.power_flow.node_solar_hint", "entities.solar", solar)}
        ${this._renderNodeSection("ed.power_flow.node_battery_title", "ed.power_flow.node_battery_hint_yaml", "entities.battery", battery)}
        ${this._renderNodeSection("ed.power_flow.node_water_title", "ed.power_flow.node_water_hint", "entities.water", water)}
        ${this._renderNodeSection("ed.power_flow.node_gas_title", "ed.power_flow.node_gas_hint", "entities.gas", gas)}

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.power_flow.individuals_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.individuals_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextareaField("ed.power_flow.individuals_entities", "entities.individual", this._serializeIndividuals(), {
              valueType: "individuals",
              rows: 5,
              placeholder: "sensor.cargador_coche|Cargador|mdi:car-electric|#42a5f5",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.power_flow.flow_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.flow_hint_yaml"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("ed.power_flow.zero_lines_mode", "display_zero_lines.mode", config.display_zero_lines?.mode || "show", [
              { value: "show", label: "ed.power_flow.zero_lines_show" },
              { value: "hide", label: "ed.power_flow.zero_lines_hide" },
            ])}
            ${this._renderTextField("ed.power_flow.zero_lines_transparency", "display_zero_lines.transparency", config.display_zero_lines?.transparency, {
              type: "number",
              valueType: "number",
              placeholder: "50",
            })}
            ${this._renderTextField("ed.power_flow.grey_rgb", "display_zero_lines.grey_color", arrayFromMaybe(config.display_zero_lines?.grey_color).join(", "), {
              valueType: "rgb-array",
              placeholder: "189, 189, 189",
            })}
            ${this._renderTextField("ed.power_flow.flow_min_s", "min_flow_rate", config.min_flow_rate, {
              type: "number",
              valueType: "number",
              placeholder: "1.4",
            })}
            ${this._renderTextField("ed.power_flow.flow_max_s", "max_flow_rate", config.max_flow_rate, {
              type: "number",
              valueType: "number",
              placeholder: "5.8",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.power_flow.style_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.style_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.person.style_card_bg", "styles.card.background", config.styles?.card?.background)}
            ${this._renderTextField("ed.person.style_card_border", "styles.card.border", config.styles?.card?.border)}
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
            ${this._renderTextField("ed.person.style_card_shadow", "styles.card.box_shadow", config.styles?.card?.box_shadow)}
            ${this._renderTextField("ed.person.style_card_padding", "styles.card.padding", config.styles?.card?.padding)}
            ${this._renderTextField("ed.person.style_card_gap", "styles.card.gap", config.styles?.card?.gap)}
            ${this._renderTextField("ed.power_flow.icon_node_size", "styles.icon.node_size", config.styles?.icon?.node_size)}
            ${this._renderTextField("ed.power_flow.icon_home_size", "styles.icon.home_size", config.styles?.icon?.home_size)}
            ${this._renderTextField("ed.power_flow.icon_individual_size", "styles.icon.individual_size", config.styles?.icon?.individual_size)}
            ${this._renderTextField("ed.person.style_title_size", "styles.title_size", config.styles?.title_size)}
            ${this._renderTextField("ed.person.style_chip_height", "styles.chip_height", config.styles?.chip_height)}
            ${this._renderTextField("ed.person.style_chip_font", "styles.chip_font_size", config.styles?.chip_font_size)}
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
            ${this._renderTextField("ed.power_flow.home_value_size", "styles.home_value_size", config.styles?.home_value_size)}
            ${this._renderTextField("ed.power_flow.home_unit_size", "styles.home_unit_size", config.styles?.home_unit_size)}
            ${this._renderTextField("ed.power_flow.node_value_size", "styles.node_value_size", config.styles?.node_value_size)}
            ${this._renderTextField("ed.power_flow.flow_line_width", "styles.flow_width", config.styles?.flow_width)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.person.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.haptics_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.power_flow.enable_haptics", "haptics.enabled", config.haptics?.enabled === true)}
            ${this._renderCheckboxField("ed.nav.vibrate_fallback", "haptics.fallback_vibrate", config.haptics?.fallback_vibrate === true)}
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
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot.querySelectorAll('input[data-field$=".entity"]').forEach(input => {
      input.setAttribute("list", "power-flow-card-entity-options");
    });
  }
}

class NodaliaPowerFlowCardVisualEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showAnimationSection = false;
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

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("input", this._onShadowInput);
    this.shadowRoot.removeEventListener("change", this._onShadowInput);
    this.shadowRoot.removeEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.removeEventListener("click", this._onShadowClick);
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

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id =>
      id.startsWith("sensor.") || id.startsWith("number.") || id.startsWith("input_number."),
    );
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

  _getPowerEntityOptions(path = "entity") {
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => entityId.startsWith("sensor.") || entityId.startsWith("number.") || entityId.startsWith("input_number."))
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

    const currentValue = String(getByPath(this._config, path) || "").trim();
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
      case "number": {
        const numeric = Number(input.value);
        return Number.isFinite(numeric) ? numeric : undefined;
      }
      case "rgb-array-color": {
        const normalizedHex = String(input.value || "").trim().replace(/^#/, "");
        if (!/^[0-9a-f]{6}$/i.test(normalizedHex)) {
          return undefined;
        }
        return [
          Number.parseInt(normalizedHex.slice(0, 2), 16),
          Number.parseInt(normalizedHex.slice(2, 4), 16),
          Number.parseInt(normalizedHex.slice(4, 6), 16),
        ];
      }
      case "individuals":
        return String(input.value || "")
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const [entity, name = "", icon = "", color = ""] = line.split("|").map(part => part.trim());
            return { entity, name, icon, color };
          })
          .filter(item => item.entity);
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
    } else if (toggleButton.dataset.editorToggle === "animations") {
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
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";

    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(options.type || "text")}"
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
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";

    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <textarea
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          rows="${escapeHtml(String(options.rows || 4))}"
          ${placeholder}
        >${escapeHtml(inputValue)}</textarea>
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

  _renderRgbArrayColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("ed.weather.custom_color");
    const fallbackValue = arrayFromMaybe(options.fallbackValue || DEFAULT_CONFIG.display_zero_lines.grey_color);
    const sourceValue = arrayFromMaybe(value);
    const rgbValue = sourceValue.length >= 3 ? sourceValue : fallbackValue;
    const hexValue = `#${rgbValue.slice(0, 3).map(channel => formatEditorHexChannel(channel)).join("")}`;
    const swatchValue = rgbArrayToColor(rgbValue, fallbackValue);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="${escapeHtml(tColorCustom)}">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="rgb-array-color"
              value="${escapeHtml(hexValue)}"
              aria-label="${escapeHtml(tLabel)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(swatchValue)};"></span>
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

  _renderSelectField(label, field, value, options, renderOptions = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options.map(option => `
            <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
              ${escapeHtml(this._editorLabel(option.label))}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _renderEntityPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder || "";

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(placeholder)}"
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

  _serializeIndividuals() {
    return resolveIndividualConfigs(this._config)
      .map(entry => [entry.entity || "", entry.name || "", entry.icon || "", entry.color || ""].join("|"))
      .join("\n");
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
        entity: {
          domain: ["sensor", "number", "input_number"],
        },
      };
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || this._editorLabel("ed.person.select_entity");
      control.appendChild(emptyOption);
      this._getPowerEntityOptions(field).forEach(option => {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.displayLabel;
        control.appendChild(optionElement);
      });
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      control.hass = this._hass;
    }

    if ("value" in control) {
      control.value = nextValue;
    }

    host.replaceChildren(control);
  }

  _renderNodeSection(titleKey, hintKey, prefix, values) {
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div class="editor-section__title">${escapeHtml(this._editorLabel(titleKey))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel(hintKey))}</div>
        </div>
        <div class="editor-grid editor-grid--stacked">
          ${this._renderEntityPickerField("ed.entity.entity_main", `${prefix}.entity`, values.entity, {
            placeholder: "sensor.mi_sensor",
            fullWidth: true,
          })}
          ${this._renderTextField("ed.entity.name", `${prefix}.name`, values.name)}
          ${this._renderIconPickerField("ed.entity.icon", `${prefix}.icon`, values.icon, {
            placeholder: "mdi:flash",
          })}
          ${this._renderColorField("ed.power_flow.node_color", `${prefix}.color`, values.color)}
          ${this._renderEntityPickerField("ed.power_flow.node_secondary_entity", `${prefix}.secondary_info.entity`, values.secondary_info?.entity, {
            placeholder: "sensor.mi_secundaria",
            fullWidth: true,
          })}
          ${this._renderTextField("ed.power_flow.node_secondary_attribute", `${prefix}.secondary_info.attribute`, values.secondary_info?.attribute, {
            placeholder: "battery_level",
          })}
          ${this._renderTextField("ed.power_flow.node_secondary_unit", `${prefix}.secondary_info.unit`, values.secondary_info?.unit, {
            placeholder: "kWh",
          })}
          ${this._renderTextField("ed.power_flow.node_secondary_decimals", `${prefix}.secondary_info.decimals`, values.secondary_info?.decimals, {
            type: "number",
            valueType: "number",
            placeholder: "0",
          })}
        </div>
      </section>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig(STUB_CONFIG);
    const hapticStyle = config.haptics?.style || "medium";
    const tapAction = config.tap_action || "none";
    const animations = config.animations || DEFAULT_CONFIG.animations;
    const grid = resolveNodeConfig("grid", config);
    const home = resolveNodeConfig("home", config);
    const solar = resolveNodeConfig("solar", config);
    const battery = resolveNodeConfig("battery", config);
    const water = resolveNodeConfig("water", config);
    const gas = resolveNodeConfig("gas", config);

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
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 14px;
          color: var(--primary-text-color);
          font: inherit;
          min-width: 0;
          outline: none;
          padding: 10px 12px;
          width: 100%;
        }

        .editor-field textarea {
          min-height: 120px;
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

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
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

        @media (max-width: 720px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.general_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderTextField("ed.nav.title_bar", "title", config.title, { placeholder: "Energy", fullWidth: true })}
            ${this._renderTextField("ed.power_flow.energy_dashboard_url", "dashboard_link", config.dashboard_link, { placeholder: "/energy/overview", fullWidth: true })}
            ${this._renderTextField("ed.power_flow.energy_dashboard_button_label", "dashboard_link_label", config.dashboard_link_label, { placeholder: "Energy", fullWidth: true })}
            ${this._renderSelectField("ed.power_flow.card_tap_action", "tap_action", tapAction, [
              { value: "none", label: "ed.power_flow.tap_none" },
              { value: "more-info", label: "ed.power_flow.tap_more_info_home" },
            ], { fullWidth: true })}
            ${this._renderCheckboxField("ed.power_flow.show_header", "show_header", config.show_header !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_dashboard_button", "show_dashboard_link_button", config.show_dashboard_link_button !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_labels", "show_labels", config.show_labels !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_values", "show_values", config.show_values !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_secondary_info", "show_secondary_info", config.show_secondary_info !== false)}
            ${this._renderCheckboxField("ed.power_flow.clickable_entities", "clickable_entities", config.clickable_entities !== false)}
            ${this._renderCheckboxField("ed.power_flow.badge_unavailable", "show_unavailable_badge", config.show_unavailable_badge !== false)}
          </div>
        </section>

        ${this._renderNodeSection("ed.power_flow.node_grid_title", "ed.power_flow.node_grid_hint_visual", "entities.grid", grid)}
        ${this._renderNodeSection("ed.power_flow.node_home_title", "ed.power_flow.node_home_hint_visual", "entities.home", home)}
        ${this._renderNodeSection("ed.power_flow.node_solar_title", "ed.power_flow.node_solar_hint", "entities.solar", solar)}
        ${this._renderNodeSection("ed.power_flow.node_battery_title", "ed.power_flow.node_battery_hint_visual", "entities.battery", battery)}
        ${this._renderNodeSection("ed.power_flow.node_water_title", "ed.power_flow.node_water_hint", "entities.water", water)}
        ${this._renderNodeSection("ed.power_flow.node_gas_title", "ed.power_flow.node_gas_hint", "entities.gas", gas)}

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.power_flow.individuals_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.individuals_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderTextareaField("ed.power_flow.individuals_entities", "entities.individual", this._serializeIndividuals(), {
              valueType: "individuals",
              rows: 5,
              placeholder: "sensor.cargador_coche|Cargador|mdi:car-electric|#42a5f5",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.power_flow.flow_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.flow_hint_visual"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("ed.power_flow.zero_lines_mode", "display_zero_lines.mode", config.display_zero_lines?.mode || "show", [
              { value: "show", label: "ed.power_flow.zero_lines_show" },
              { value: "hide", label: "ed.power_flow.zero_lines_hide" },
            ])}
            ${this._renderTextField("ed.power_flow.zero_lines_transparency", "display_zero_lines.transparency", config.display_zero_lines?.transparency, {
              type: "number",
              valueType: "number",
              placeholder: "50",
            })}
            ${this._renderRgbArrayColorField("ed.power_flow.zero_line_color", "display_zero_lines.grey_color", config.display_zero_lines?.grey_color)}
            ${this._renderTextField("ed.power_flow.flow_min_s", "min_flow_rate", config.min_flow_rate, {
              type: "number",
              valueType: "number",
              placeholder: "1.4",
            })}
            ${this._renderTextField("ed.power_flow.flow_max_s", "max_flow_rate", config.max_flow_rate, {
              type: "number",
              valueType: "number",
              placeholder: "5.8",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.haptics_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.power_flow.enable_haptics", "haptics.enabled", config.haptics?.enabled === true)}
            ${this._renderCheckboxField("ed.nav.vibrate_fallback", "haptics.fallback_vibrate", config.haptics?.fallback_vibrate === true)}
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
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.animations_hint_visual"))}</div>
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
                  ${this._renderCheckboxField("ed.power_flow.enable_animations", "animations.enabled", animations.enabled !== false)}
                  ${this._renderTextField("ed.power_flow.content_duration_ms", "animations.content_duration", animations.content_duration, {
                    type: "number",
                    valueType: "number",
                  })}
                  ${this._renderTextField("ed.power_flow.button_bounce_ms", "animations.button_bounce_duration", animations.button_bounce_duration, {
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.power_flow.style_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.style_section_hint"))}</div>
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
                  ${this._renderTextField("ed.person.style_card_bg", "styles.card.background", config.styles?.card?.background)}
                  ${this._renderTextField("ed.person.style_card_border", "styles.card.border", config.styles?.card?.border)}
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
                  ${this._renderTextField("ed.person.style_card_shadow", "styles.card.box_shadow", config.styles?.card?.box_shadow)}
                  ${this._renderTextField("ed.person.style_card_padding", "styles.card.padding", config.styles?.card?.padding)}
                  ${this._renderTextField("ed.person.style_card_gap", "styles.card.gap", config.styles?.card?.gap)}
                  ${this._renderTextField("ed.power_flow.icon_node_size", "styles.icon.node_size", config.styles?.icon?.node_size)}
                  ${this._renderTextField("ed.power_flow.icon_home_size", "styles.icon.home_size", config.styles?.icon?.home_size)}
                  ${this._renderTextField("ed.power_flow.icon_individual_size", "styles.icon.individual_size", config.styles?.icon?.individual_size)}
                  ${this._renderTextField("ed.power_flow.icons_color", "styles.icon.color", config.styles?.icon?.color)}
                  ${this._renderTextField("ed.person.style_title_size", "styles.title_size", config.styles?.title_size)}
                  ${this._renderTextField("ed.person.style_chip_height", "styles.chip_height", config.styles?.chip_height)}
                  ${this._renderTextField("ed.person.style_chip_font", "styles.chip_font_size", config.styles?.chip_font_size)}
                  ${this._renderTextField("ed.entity.style_chip_padding", "styles.chip_padding", config.styles?.chip_padding)}
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
                  ${this._renderTextField("ed.power_flow.home_value_size", "styles.home_value_size", config.styles?.home_value_size)}
                  ${this._renderTextField("ed.power_flow.home_unit_size", "styles.home_unit_size", config.styles?.home_unit_size)}
                  ${this._renderTextField("ed.power_flow.node_value_size", "styles.node_value_size", config.styles?.node_value_size)}
                  ${this._renderTextField("ed.power_flow.secondary_text_size", "styles.secondary_size", config.styles?.secondary_size)}
                  ${this._renderTextField("ed.power_flow.flow_line_width", "styles.flow_width", config.styles?.flow_width)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="entity"]')
      .forEach(host => this._mountEntityPicker(host));

    this.shadowRoot
      .querySelectorAll("ha-icon-picker[data-field]")
      .forEach(control => {
        control.hass = this._hass;
        control.value = control.dataset.value || "";
      });

    this._ensureEditorControlsReady();
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaPowerFlowCardVisualEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Power Flow Card",
  description: "Tarjeta Nodalia de flujo energetico para red, solar, bateria, agua, gas y consumos individuales.",
  preview: true,
});
