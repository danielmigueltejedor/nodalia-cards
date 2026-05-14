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

const CARD_TAG = "nodalia-fav-card";
const EDITOR_TAG = "nodalia-fav-card-editor";
const CARD_VERSION = "1.1.0-alpha.10";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
const MINI_LAYOUT_THRESHOLD = 126;
const INLINE_LAYOUT_THRESHOLD = 340;
const FEATURE_ARM_HOME = 1;
const FEATURE_ARM_AWAY = 2;
const FEATURE_ARM_NIGHT = 4;
const FEATURE_ARM_CUSTOM_BYPASS = 16;
const FEATURE_ARM_VACATION = 32;

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  use_entity_icon: false,
  entity_mode: "auto",
  tap_action: "auto",
  tap_service: "",
  tap_service_data: "",
  tap_url: "",
  tap_new_tab: false,
  alarm_code: "",
  alarm_code_entity: "",
  alarm_show_code_input: true,
  alarm_show_disarm: true,
  alarm_show_arm_home: true,
  alarm_show_arm_away: true,
  alarm_show_arm_night: true,
  alarm_show_arm_vacation: false,
  alarm_show_custom_bypass: false,
  show_name: true,
  show_state: true,
  state_attribute: "",
  layout_mode: "auto",
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      border_radius: "26px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "10px 12px",
      gap: "10px",
    },
    icon: {
      size: "42px",
      background: "color-mix(in srgb, var(--primary-text-color) 5%, transparent)",
      on_color: "var(--info-color, #71c0ff)",
      off_color: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
    },
    chip_height: "22px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    title_size: "13px",
  },
};

const STUB_CONFIG = {
  entity: "light.sofa",
  name: "Sofa",
  tap_action: "auto",
  show_state: false,
  layout_mode: "auto",
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

function getByPath(target, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((cursor, key) => (cursor == null ? undefined : cursor[key]), target);
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
    return "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
}

function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function miredToKelvin(mired) {
  const numeric = Number(mired);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.round(1000000 / numeric);
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
      case "garage_door":
        return stateKey === "on" ? "mdi:garage-open" : "mdi:garage";
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
      case "moisture":
        return stateKey === "on" ? "mdi:water-alert" : "mdi:water-check";
      case "gas":
        return stateKey === "on" ? "mdi:gas-cylinder" : "mdi:check-circle-outline";
      case "tamper":
      case "safety":
      case "problem":
        return stateKey === "on" ? "mdi:alert-circle" : "mdi:check-circle-outline";
      case "plug":
      case "power":
        return stateKey === "on" ? "mdi:power-plug" : "mdi:power-plug-off";
      case "sound":
        return stateKey === "on" ? "mdi:volume-high" : "mdi:volume-mute";
      case "vibration":
        return stateKey === "on" ? "mdi:vibrate" : "mdi:vibrate-off";
      case "heat":
        return stateKey === "on" ? "mdi:fire" : "mdi:fire-off";
      case "cold":
        return stateKey === "on" ? "mdi:snowflake-alert" : "mdi:snowflake";
      case "light":
        return stateKey === "on" ? "mdi:brightness-7" : "mdi:brightness-5";
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

  if (domain === "lock") {
    switch (stateKey) {
      case "unlocked":
      case "open":
        return "mdi:lock-open-variant";
      case "jammed":
        return "mdi:lock-alert";
      case "locking":
      case "unlocking":
        return "mdi:lock-clock";
      default:
        return "mdi:lock";
    }
  }

  if (domain === "cover") {
    if (deviceClass === "garage") {
      return stateKey === "open" ? "mdi:garage-open" : "mdi:garage";
    }

    if (deviceClass === "door") {
      return stateKey === "open" ? "mdi:door-open" : "mdi:door-closed";
    }

    if (deviceClass === "window") {
      return stateKey === "open" ? "mdi:window-open-variant" : "mdi:window-closed-variant";
    }
  }

  if (domain === "person") {
    switch (stateKey) {
      case "home":
      case "casa":
      case "en_casa":
        return "mdi:home-account";
      case "not_home":
      case "away":
      case "fuera":
        return "mdi:account-arrow-right";
      default:
        return "mdi:account";
    }
  }

  if (domain === "camera") {
    return "mdi:video";
  }

  if (domain === "climate") {
    if (stateKey === "off") {
      return "mdi:thermostat-off";
    }
    return "mdi:thermostat";
  }

  if (domain === "media_player") {
    if (["off", "idle", "standby"].includes(stateKey)) {
      return "mdi:speaker-off";
    }
    return "mdi:speaker";
  }

  if (domain === "humidifier") {
    return stateKey === "on" ? "mdi:air-humidifier" : "mdi:air-humidifier-off";
  }

  if (domain === "vacuum") {
    return "mdi:robot-vacuum";
  }

  if (domain === "alarm_control_panel") {
    switch (stateKey) {
      case "disarmed":
        return "mdi:shield-off-outline";
      case "armed_home":
        return "mdi:home-lock";
      case "armed_away":
        return "mdi:shield-lock";
      case "armed_night":
        return "mdi:weather-night";
      case "armed_vacation":
        return "mdi:palm-tree";
      case "armed_custom_bypass":
        return "mdi:tune-variant";
      case "triggered":
        return "mdi:alarm-light";
      default:
        return "mdi:shield-outline";
    }
  }

  if (domain === "automation") {
    return stateKey === "on" ? "mdi:robot" : "mdi:robot-off";
  }

  if (domain === "script") {
    return "mdi:script-text-outline";
  }

  if (domain === "scene") {
    return "mdi:palette-outline";
  }

  if (domain === "input_boolean") {
    return stateKey === "on" ? "mdi:check-circle" : "mdi:circle-off-outline";
  }

  if (domain === "sensor") {
    switch (deviceClass) {
      case "temperature":
        return "mdi:thermometer";
      case "humidity":
        return "mdi:water-percent";
      case "power":
        return "mdi:flash";
      case "current":
        return "mdi:current-ac";
      case "voltage":
        return "mdi:sine-wave";
      case "energy":
        return "mdi:lightning-bolt";
      case "battery":
        return "mdi:battery";
      case "signal_strength":
        return "mdi:wifi";
      case "pressure":
        return "mdi:gauge";
      case "illuminance":
        return "mdi:brightness-6";
      case "moisture":
        return "mdi:water";
      case "aqi":
        return "mdi:air-filter";
      case "speed":
        return "mdi:speedometer";
      case "distance":
        return "mdi:map-marker-distance";
      case "gas":
        return "mdi:meter-gas";
      case "water":
        return "mdi:water";
      default:
        return "";
    }
  }

  return "";
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
  return mergeConfig(DEFAULT_CONFIG, rawConfig || {});
}

class NodaliaFavCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["light", "switch"]);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._cardWidth = 0;
    this._layout = "inline";
    this._alarmMenuOpen = false;
    this._alarmCodeInput = "";
    this._ignoreNextPrimaryClickUntil = 0;
    this._lastAlarmPanelRenderedOpen = null;
    this._lastRenderSignature = "";
    this._resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextWidth = Math.round(entry.contentRect?.width || this.clientWidth || 0);
      const nextLayout = this._getResolvedLayout(nextWidth);

      if (nextWidth === this._cardWidth && nextLayout === this._layout) {
        return;
      }

      this._cardWidth = nextWidth;
      this._layout = nextLayout;
      this._render();
    });
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowInput = this._onShadowInput.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
  }

  connectedCallback() {
    this._resizeObserver?.observe(this);
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._layout = this._getResolvedLayout(Math.round(this._cardWidth || this.clientWidth || 0));
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

  getCardSize() {
    if (this._alarmMenuOpen && this._isAlarmPanelMode(this._getState())) {
      return this._getAlarmGridSpan();
    }

    return 1;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 1,
      min_columns: 1,
    };
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const helperEntityId = this._config?.alarm_code_entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const helperState = helperEntityId ? hass?.states?.[helperEntityId] || null : null;
    const attrs = state?.attributes || {};
    return JSON.stringify({
      entityId,
      state: String(state?.state || ""),
      friendlyName: String(attrs.friendly_name || ""),
      icon: String(attrs.icon || ""),
      deviceClass: String(attrs.device_class || ""),
      unit: String(attrs.unit_of_measurement || attrs.native_unit_of_measurement || ""),
      helperEntityId,
      helperState: String(helperState?.state || ""),
      layout: String(this._layout || ""),
      alarmOpen: Boolean(this._alarmMenuOpen),
    });
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) ? numericColumns : null;
  }

  _getConfiguredGridRows() {
    const numericRows = Number(this._config?.grid_options?.rows);
    return Number.isFinite(numericRows) ? numericRows : null;
  }

  _getResolvedLayout(width) {
    const mode = this._config?.layout_mode || "auto";

    if (mode === "mini") {
      return "mini";
    }

    if (mode === "inline") {
      return "inline";
    }

    const columns = this._getConfiguredGridColumns();
    const rows = this._getConfiguredGridRows();

    if (columns !== null) {
      if (columns <= 2) {
        return "mini";
      }

      if (columns <= 6 || rows === 1) {
        return "inline";
      }
    }

    if (width > 0 && width <= MINI_LAYOUT_THRESHOLD) {
      return "mini";
    }

    if (width > 0 && width <= INLINE_LAYOUT_THRESHOLD) {
      return "inline";
    }

    return "inline";
  }

  _getState() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _getDomain(entityId = this._config?.entity) {
    return String(entityId || "").split(".")[0] || "";
  }

  _isAlarmPanelMode(state = this._getState()) {
    const mode = normalizeTextKey(this._config?.entity_mode || "auto");

    if (mode === "alarm_control_panel") {
      return true;
    }

    if (mode === "standard") {
      return false;
    }

    return this._getDomain(state?.entity_id || this._config?.entity) === "alarm_control_panel";
  }

  _isBinaryOnOff(state) {
    const stateKey = normalizeTextKey(state?.state);
    return stateKey === "on" || stateKey === "off";
  }

  _isActiveState(state) {
    const stateKey = normalizeTextKey(state?.state);

    if (!stateKey || ["off", "closed", "locked", "unavailable", "unknown", "none", "idle", "standby", "disarmed"].includes(stateKey)) {
      return false;
    }

    return true;
  }

  _isDomainOn(state) {
    const stateKey = normalizeTextKey(state?.state);
    const domain = this._getDomain();

    switch (domain) {
      case "light":
      case "fan":
      case "humidifier":
        return stateKey === "on";
      default:
        return this._isActiveState(state);
    }
  }

  _usesCustomOnColor() {
    const configuredColor = this._config?.styles?.icon?.on_color;
    return Boolean(configuredColor) && configuredColor !== DEFAULT_CONFIG.styles.icon.on_color;
  }

  _usesCustomOffColor() {
    const configuredColor = this._config?.styles?.icon?.off_color;
    return Boolean(configuredColor) && configuredColor !== DEFAULT_CONFIG.styles.icon.off_color;
  }

  _getLightAccentColor(state) {
    const rgbColor = Array.isArray(state?.attributes?.rgb_color) ? state.attributes.rgb_color : null;
    if (this._isActiveState(state) && rgbColor?.length === 3) {
      return `rgb(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]})`;
    }

    if (this._isActiveState(state)) {
      const kelvin = typeof state?.attributes?.color_temp_kelvin === "number"
        ? Math.round(state.attributes.color_temp_kelvin)
        : (typeof state?.attributes?.color_temp === "number" ? miredToKelvin(state.attributes.color_temp) : 0);

      if (kelvin >= 5200) {
        return "#8fd3ff";
      }

      if (kelvin > 0 && kelvin <= 3000) {
        return "#f4b55f";
      }

      if (kelvin > 0) {
        return "#ffe29a";
      }
    }

    return "var(--warning-color, #f6b73c)";
  }

  _getDomainDefaultOnColor(state) {
    switch (this._getDomain()) {
      case "light":
        return this._getLightAccentColor(state);
      case "fan":
        return "var(--info-color, #71c0ff)";
      case "humidifier":
        return "var(--info-color, #71c0ff)";
      case "alarm_control_panel":
        return this._getAlarmAccentColor(state);
      case "switch":
        return "var(--primary-color)";
      case "media_player":
        return "var(--info-color, #71c0ff)";
      case "vacuum":
        return "#82d18a";
      default:
        return DEFAULT_CONFIG.styles.icon.on_color;
    }
  }

  _getAccentColor(state) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    if (!this._isDomainOn(state)) {
      return this._usesCustomOffColor()
        ? styles?.icon?.off_color || DEFAULT_CONFIG.styles.icon.off_color
        : "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))";
    }

    if (this._usesCustomOnColor()) {
      return styles?.icon?.on_color || DEFAULT_CONFIG.styles.icon.on_color;
    }

    return this._getDomainDefaultOnColor(state);
  }

  _getAlarmAccentColor(state) {
    const key = normalizeTextKey(state?.state);

    switch (key) {
      case "armed_home":
        return "#74c0ff";
      case "armed_away":
        return "#8aa7ff";
      case "armed_night":
        return "#9488ff";
      case "armed_vacation":
        return "#5fd7cf";
      case "armed_custom_bypass":
        return "#64d4a6";
      case "arming":
        return "#71c0ff";
      case "pending":
        return "#f2c46d";
      case "triggered":
        return "#ff7474";
      default:
        return "var(--info-color, #71c0ff)";
    }
  }

  _translateStateValue(state) {
    if (!state) {
      return null;
    }

    const rawState = String(state.state ?? "").trim();
    const unit = String(state.attributes?.unit_of_measurement || "").trim();
    const key = normalizeTextKey(rawState);

    if (rawState && unit && /^-?\d+([.,]\d+)?$/.test(rawState)) {
      return `${rawState} ${unit}`;
    }

    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const langCfg = this._config?.language ?? "auto";
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, langCfg) ?? "en";
    if (window.NodaliaI18n?.translateFavState) {
      const translated = window.NodaliaI18n.translateFavState(lang, key);
      if (translated) {
        return translated;
      }
    }

    if (window.NodaliaI18n?.translateEntityStateChip) {
      const chip = window.NodaliaI18n.translateEntityStateChip(hass, langCfg, key);
      if (chip) {
        return chip;
      }
    }

    return rawState || null;
  }

  _formatAttributeValue(state, attributeName) {
    if (!state || !attributeName) {
      return null;
    }

    const value = state.attributes?.[attributeName];
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const key = normalizeTextKey(attributeName);

    if (typeof value === "boolean") {
      return value ? "Si" : "No";
    }

    if (typeof value === "number") {
      if (["battery", "battery_level", "humidity", "current_humidity"].includes(key)) {
        return `${Math.round(value)}%`;
      }

      if (key === "brightness") {
        return `${Math.round((value / 255) * 100)}%`;
      }

      if (key === "volume_level") {
        return `${Math.round(value * 100)}%`;
      }
    }

    return String(value);
  }

  _getTitle(state) {
    return this._config?.name || state?.attributes?.friendly_name || this._config?.entity || "Favorito";
  }

  _getIcon(state) {
    if (this._config?.use_entity_icon === true) {
      const resolvedEntityIcon = state?.attributes?.icon || getDynamicEntityIcon(state);
      if (resolvedEntityIcon) {
        return resolvedEntityIcon;
      }
    }

    return this._config?.icon || state?.attributes?.icon || "mdi:star-four-points";
  }

  _canRunTapAction(state) {
    if (this._isAlarmPanelMode(state)) {
      return Boolean(this._config?.entity);
    }

    const tapAction = this._config?.tap_action || "auto";

    if (tapAction === "none") {
      return false;
    }

    if (tapAction === "service") {
      return Boolean(this._config?.tap_service);
    }

    if (tapAction === "url") {
      return Boolean(this._config?.tap_url);
    }

    if (tapAction === "toggle") {
      return this._isBinaryOnOff(state);
    }

    if (tapAction === "more-info") {
      return Boolean(this._config?.entity);
    }

    return Boolean(this._config?.entity);
  }

  _getAlarmSupportedFeatures(state) {
    const value = Number(state?.attributes?.supported_features);
    return Number.isFinite(value) ? value : 0;
  }

  _supportsAlarmMode(state, mode) {
    const features = this._getAlarmSupportedFeatures(state);

    if (!features) {
      return true;
    }

    switch (mode) {
      case "home":
        return Boolean(features & FEATURE_ARM_HOME);
      case "away":
        return Boolean(features & FEATURE_ARM_AWAY);
      case "night":
        return Boolean(features & FEATURE_ARM_NIGHT);
      case "vacation":
        return Boolean(features & FEATURE_ARM_VACATION);
      case "custom_bypass":
        return Boolean(features & FEATURE_ARM_CUSTOM_BYPASS);
      default:
        return true;
    }
  }

  _getAlarmStateCandidates(state) {
    return [
      state?.state,
      state?.attributes?.next_state,
      state?.attributes?.post_pending_state,
      state?.attributes?.post_delay_state,
      state?.attributes?.arm_mode,
      state?.attributes?.arming_mode,
    ]
      .map(value => normalizeTextKey(value))
      .filter(Boolean);
  }

  _getAlarmCurrentModeKey(state) {
    switch (normalizeTextKey(state?.state)) {
      case "disarmed":
        return "disarm";
      case "armed_home":
        return "home";
      case "armed_away":
        return "away";
      case "armed_night":
        return "night";
      case "armed_vacation":
        return "vacation";
      case "armed_custom_bypass":
        return "custom_bypass";
      default:
        return "";
    }
  }

  _getAlarmActionLabel(modeKey) {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "es";
    const actions = window.NodaliaI18n?.strings?.(lang)?.alarmPanel?.actions;
    const map = {
      disarm: "disarm",
      home: "arm_home",
      away: "arm_away",
      night: "arm_night",
      vacation: "arm_vacation",
      custom_bypass: "arm_custom_bypass",
    };
    const actionKey = map[modeKey];
    if (actionKey && actions?.[actionKey]) {
      return actions[actionKey];
    }
    const fallbacks = {
      disarm: "Desarmar",
      home: "Casa",
      away: "Ausente",
      night: "Noche",
      vacation: "Vacaciones",
      custom_bypass: "Personalizada",
    };
    return fallbacks[modeKey] || modeKey;
  }

  _matchesAlarmMode(state, ...keys) {
    const candidates = this._getAlarmStateCandidates(state);
    return keys.some(key => candidates.includes(normalizeTextKey(key)));
  }

  _getAlarmModeDefinitions(state) {
    const currentModeKey = this._getAlarmCurrentModeKey(state);
    const modes = [
      {
        key: "disarm",
        label: this._getAlarmActionLabel("disarm"),
        icon: "mdi:shield-off-outline",
        service: "alarm_disarm",
        enabled: this._config?.alarm_show_disarm !== false && currentModeKey !== "disarm",
      },
      {
        key: "home",
        label: this._getAlarmActionLabel("home"),
        icon: "mdi:home-lock",
        service: "alarm_arm_home",
        enabled: this._config?.alarm_show_arm_home !== false
          && this._supportsAlarmMode(state, "home")
          && currentModeKey !== "home",
      },
      {
        key: "away",
        label: this._getAlarmActionLabel("away"),
        icon: "mdi:shield-lock",
        service: "alarm_arm_away",
        enabled: this._config?.alarm_show_arm_away !== false
          && this._supportsAlarmMode(state, "away")
          && currentModeKey !== "away",
      },
      {
        key: "night",
        label: this._getAlarmActionLabel("night"),
        icon: "mdi:weather-night",
        service: "alarm_arm_night",
        enabled: this._config?.alarm_show_arm_night !== false
          && this._supportsAlarmMode(state, "night")
          && currentModeKey !== "night",
      },
      {
        key: "vacation",
        label: this._getAlarmActionLabel("vacation"),
        icon: "mdi:palm-tree",
        service: "alarm_arm_vacation",
        enabled: this._config?.alarm_show_arm_vacation === true
          && this._supportsAlarmMode(state, "vacation")
          && currentModeKey !== "vacation",
      },
      {
        key: "custom_bypass",
        label: this._getAlarmActionLabel("custom_bypass"),
        icon: "mdi:tune-variant",
        service: "alarm_arm_custom_bypass",
        enabled: this._config?.alarm_show_custom_bypass === true
          && this._supportsAlarmMode(state, "custom_bypass")
          && currentModeKey !== "custom_bypass",
      },
    ];

    return modes.filter(mode => mode.enabled);
  }

  _getAlarmRenderedModes(state) {
    const detectedModes = this._getAlarmModeDefinitions(state);
    if (detectedModes.length) {
      return detectedModes;
    }

    const currentModeKey = this._getAlarmCurrentModeKey(state);
    const fallbackModes = [
      {
        key: "disarm",
        label: this._getAlarmActionLabel("disarm"),
        icon: "mdi:shield-off-outline",
        service: "alarm_disarm",
        enabled: this._config?.alarm_show_disarm !== false && currentModeKey !== "disarm",
      },
      {
        key: "home",
        label: this._getAlarmActionLabel("home"),
        icon: "mdi:home-lock",
        service: "alarm_arm_home",
        enabled: this._config?.alarm_show_arm_home !== false && currentModeKey !== "home",
      },
      {
        key: "away",
        label: this._getAlarmActionLabel("away"),
        icon: "mdi:shield-lock",
        service: "alarm_arm_away",
        enabled: this._config?.alarm_show_arm_away !== false && currentModeKey !== "away",
      },
      {
        key: "night",
        label: this._getAlarmActionLabel("night"),
        icon: "mdi:weather-night",
        service: "alarm_arm_night",
        enabled: this._config?.alarm_show_arm_night !== false && currentModeKey !== "night",
      },
    ];

    return fallbackModes.filter(mode => mode.enabled);
  }

  _shouldShowAlarmCodeInput(state) {
    if (this._config?.alarm_show_code_input === false) {
      return false;
    }

    return Boolean(String(state?.attributes?.code_format || "").trim());
  }

  _getAlarmCodeValue(state) {
    if (this._shouldShowAlarmCodeInput(state)) {
      const manualCode = String(this._alarmCodeInput || "").trim();
      if (manualCode) {
        return manualCode;
      }
    }

    const helperEntityId = String(this._config?.alarm_code_entity || "").trim();
    if (helperEntityId) {
      const helperState = this._hass?.states?.[helperEntityId];
      const helperValue = String(helperState?.state || "").trim();
      if (helperValue && !["unknown", "unavailable"].includes(normalizeTextKey(helperValue))) {
        return helperValue;
      }
    }

    const configuredCode = String(this._config?.alarm_code || "").trim();
    if (configuredCode) {
      return configuredCode;
    }

    return "";
  }

  _runAlarmAction(service) {
    const state = this._getState();
    if (!this._hass || !this._config?.entity || !service || !state) {
      return;
    }

    const payload = {
      entity_id: this._config.entity,
    };
    const code = this._getAlarmCodeValue(state);
    if (code) {
      payload.code = code;
    }

    this._triggerHaptic();
    this._hass.callService("alarm_control_panel", service, payload);
    this._alarmMenuOpen = false;
    this._applyHostGridSpan(false);
    this._render();
    this._notifyLayoutChange();
  }

  _toggleEntity(entityId = this._config?.entity) {
    const state = this._hass?.states?.[entityId];
    if (!this._hass || !entityId || !state || !this._isBinaryOnOff(state)) {
      return;
    }

    const service = normalizeTextKey(state.state) === "on" ? "turn_off" : "turn_on";
    this._hass.callService("homeassistant", service, {
      entity_id: entityId,
    });
  }

  _openMoreInfo(entityId = this._config?.entity) {
    if (!entityId) {
      return;
    }

    fireEvent(this, "hass-more-info", {
      entityId,
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
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Fav Card", serviceValue);
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

  _openConfiguredUrl(urlValue = this._config?.tap_url, newTab = this._config?.tap_new_tab === true) {
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

  _notifyLayoutChange() {
    fireEvent(this, "iron-resize", {});

    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    }
  }

  _getAlarmGridSpan() {
    const state = this._getState();
    const showCodeInput = this._shouldShowAlarmCodeInput(state);
    return showCodeInput ? 4 : 3;
  }

  _applyHostGridSpan(showAlarmPanel = false) {
    const hostCard = this.closest("hui-card");
    if (!(hostCard instanceof HTMLElement)) {
      return;
    }

    if (showAlarmPanel) {
      hostCard.setAttribute("data-fav-alarm-open", "true");
    } else {
      hostCard.removeAttribute("data-fav-alarm-open");
    }
  }

  _getPrimaryActionTarget(event) {
    const path = event.composedPath();
    const alarmInput = path.find(node => node instanceof HTMLElement && node.dataset?.favAlarmIgnore === "true");
    if (alarmInput) {
      return null;
    }

    const alarmButton = path.find(node => node instanceof HTMLButtonElement && node.dataset?.favAlarmAction);
    if (alarmButton) {
      return null;
    }

    const actionTarget = path.find(node => node instanceof HTMLElement && node.dataset?.favAction === "primary");
    return actionTarget || null;
  }

  _activatePrimaryFromEvent(event) {
    const actionTarget = this._getPrimaryActionTarget(event);
    if (!actionTarget) {
      return false;
    }

    const state = this._getState();
    if (!this._canRunTapAction(state)) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();
    this._performPrimaryAction(state);
    return true;
  }

  _performPrimaryAction(state) {
    if (this._isAlarmPanelMode(state)) {
      this._alarmMenuOpen = !this._alarmMenuOpen;
      this._applyHostGridSpan(this._alarmMenuOpen);
      this._render();
      this._notifyLayoutChange();
      return;
    }

    const tapAction = this._config?.tap_action || "auto";

    switch (tapAction) {
      case "toggle":
        this._toggleEntity(this._config?.entity);
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service":
        this._callConfiguredService(this._config?.tap_service, this._config?.entity, this._config?.tap_service_data);
        break;
      case "url":
        this._openConfiguredUrl(this._config?.tap_url, this._config?.tap_new_tab);
        break;
      case "auto":
      default:
        if (this._isBinaryOnOff(state)) {
          this._toggleEntity(this._config?.entity);
          return;
        }

        this._openMoreInfo(this._config?.entity);
        break;
    }
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

  _onShadowClick(event) {
    if (Date.now() < this._ignoreNextPrimaryClickUntil) {
      const actionTarget = this._getPrimaryActionTarget(event);
      if (actionTarget) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    const alarmInput = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.favAlarmIgnore === "true");

    if (alarmInput) {
      return;
    }

    const alarmButton = event
      .composedPath()
      .find(node => node instanceof HTMLButtonElement && node.dataset?.favAlarmAction);

    if (alarmButton) {
      event.preventDefault();
      event.stopPropagation();
      this._runAlarmAction(alarmButton.dataset.favAlarmAction);
      return;
    }

    this._activatePrimaryFromEvent(event);
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.favAlarmField === "alarm-code");

    if (!input) {
      return;
    }

    event.stopPropagation();
    this._alarmCodeInput = input.value;
  }

  _renderChip(label) {
    if (!label) {
      return "";
    }

    return `<div class="fav-card__chip">${escapeHtml(label)}</div>`;
  }

  _isSingleRowLayout() {
    return this._getConfiguredGridRows() === 1;
  }

  _renderEmptyState() {
    return `
      <ha-card class="fav-card fav-card--empty">
        <div class="fav-card__empty-title">Nodalia Fav Card</div>
        <div class="fav-card__empty-text">Configura \`entity\` para mostrar el favorito.</div>
      </ha-card>
    `;
  }

  _renderAlarmActionButton(mode, accentColor) {
    return `
      <button
        type="button"
        class="fav-card__alarm-button"
        data-fav-alarm-action="${escapeHtml(mode.service)}"
        style="
          --fav-alarm-accent:${escapeHtml(accentColor)};
        "
        aria-label="${escapeHtml(mode.label)}"
      >
        <ha-icon icon="${escapeHtml(mode.icon)}"></ha-icon>
        <span>${escapeHtml(mode.label)}</span>
      </button>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    if (!this._config?.entity) {
      this.shadowRoot.innerHTML = this._renderEmptyState();
      return;
    }

    const state = this._getState();
    if (!state) {
      this.shadowRoot.innerHTML = this._renderEmptyState();
      return;
    }

    const config = this._config;
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const layout = this._layout || "inline";
    const isMini = layout === "mini";
    const configuredColumns = this._getConfiguredGridColumns();
    const configuredRows = this._getConfiguredGridRows();
    const isSingleRow = this._isSingleRowLayout();
    const usesCompactRowMetrics =
      isMini ||
      isSingleRow ||
      (configuredRows !== null && configuredRows <= 1) ||
      (configuredColumns !== null && configuredColumns <= 6);
    const isCompactInline = !isMini && usesCompactRowMetrics;
    const isCompactMini = isMini && usesCompactRowMetrics;
    const isTightInline = isCompactInline && (configuredColumns === null || configuredColumns >= 4);
    const singleRowHeightPx = usesCompactRowMetrics ? 68 : 0;
    const icon = this._getIcon(state);
    const title = this._getTitle(state);
    const accentColor = this._getAccentColor(state);
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const showUnavailableBadge = isUnavailableState(state);
    const displayValue = config.show_state !== false
      ? (config.state_attribute ? this._formatAttributeValue(state, config.state_attribute) : this._translateStateValue(state))
      : null;
    const isAlarmPanel = this._isAlarmPanelMode(state);
    const alarmModes = isAlarmPanel ? this._getAlarmRenderedModes(state) : [];
    const showAlarmPanel = isAlarmPanel && this._alarmMenuOpen;
    const showAlarmCodeInput = showAlarmPanel && this._shouldShowAlarmCodeInput(state);
    const canRunPrimaryAction = this._canRunTapAction(state);
    const isActive = this._isDomainOn(state);
    const iconSizePx = Math.max(32, Math.min(parseSizeToPixels(styles.icon.size, 52), isMini ? (isCompactMini ? 34 : 40) : (isCompactInline ? 36 : 56)));
    const titleSizePx = Math.max(10, Math.min(parseSizeToPixels(styles.title_size, 13), isMini ? 0 : (isCompactInline ? 11 : 14)));
    const chipHeightPx = Math.max(16, Math.min(parseSizeToPixels(styles.chip_height, 22), isCompactInline ? 18 : 24));
    const chipFontSizePx = Math.max(8.5, Math.min(parseSizeToPixels(styles.chip_font_size, 11), isCompactInline ? 9.5 : 12));
    const iconColor = isActive
      ? accentColor
      : (this._usesCustomOffColor()
        ? styles.icon.off_color
        : "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))");
    const cardBackground = isActive
      ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 56%, ${styles.card.background} 100%)`
      : styles.card.background;
    const cardBorder = isActive
      ? `1px solid color-mix(in srgb, ${accentColor} 32%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))`
      : styles.card.border;
    const cardShadow = isActive
      ? `${styles.card.box_shadow}, 0 16px 30px color-mix(in srgb, ${accentColor} 16%, rgba(0, 0, 0, 0.18))`
      : styles.card.box_shadow;
    const showTitle = config.show_name !== false && !isMini;
    const showValue = Boolean(displayValue) && !isMini;
    const showCopy = showTitle || showValue;

    this._applyHostGridSpan(showAlarmPanel);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          overflow: visible;
          position: relative;
          isolation: isolate;
          z-index: ${showAlarmPanel ? 4 : "auto"};
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          height: ${showAlarmPanel ? "auto" : (usesCompactRowMetrics ? `${singleRowHeightPx}px` : "100%")};
          min-height: ${usesCompactRowMetrics ? `${singleRowHeightPx}px` : "0"};
          overflow: hidden;
          position: relative;
          z-index: ${showAlarmPanel ? 2 : 1};
        }

        ha-card::before {
          background: ${isActive
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 3.5%, transparent), rgba(255, 255, 255, 0))"};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .fav-card {
          cursor: ${canRunPrimaryAction ? "pointer" : "default"};
          min-width: 0;
          position: relative;
          touch-action: manipulation;
        }

        .fav-card__content {
          align-content: ${showAlarmPanel ? "start" : "center"};
          display: grid;
          gap: ${showAlarmPanel ? "10px" : (isCompactInline ? "6px" : (isMini ? "0" : styles.card.gap))};
          height: ${showAlarmPanel ? "auto" : (usesCompactRowMetrics ? "100%" : "auto")};
          min-width: 0;
          padding: ${showAlarmPanel ? "8px 10px 10px" : (isCompactInline ? "6px 10px" : (isMini ? "6px" : styles.card.padding))};
          position: relative;
          overflow: hidden;
          z-index: 1;
        }

        .fav-card--mini .fav-card__content {
          justify-items: center;
        }

        .fav-card--single-row .fav-card__content {
          align-content: center;
        }

        .fav-card--alarm-open .fav-card__content {
          align-items: start;
          min-height: 0;
        }

        .fav-card--alarm-open {
          overflow: hidden;
          position: relative;
          z-index: 3;
        }

        .fav-card--alarm-open .fav-card__hero {
          align-items: center;
          height: auto;
        }

        .fav-card__hero {
          align-items: center;
          display: grid;
          gap: ${isMini ? "0" : (isCompactInline ? "10px" : "12px")};
          grid-template-columns: ${isMini ? "1fr" : `${iconSizePx}px minmax(0, 1fr)`};
          height: ${showAlarmPanel ? "auto" : (usesCompactRowMetrics ? "100%" : "auto")};
          min-width: 0;
          width: ${(isCompactInline || isMini) ? "100%" : "auto"};
        }

        .fav-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: ${isSingleRow ? "18px" : (isMini ? "22px" : "24px")};
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
            0 12px 30px rgba(0, 0, 0, 0.18);
          color: ${iconColor};
          cursor: ${canRunPrimaryAction ? "pointer" : "default"};
          display: inline-flex;
          height: ${iconSizePx}px;
          justify-content: center;
          line-height: 0;
          margin: 0;
          min-width: ${iconSizePx}px;
          outline: none;
          padding: 0;
          position: relative;
          width: ${iconSizePx}px;
          touch-action: manipulation;
        }

        .fav-card--mini .fav-card__hero {
          align-content: center;
          justify-items: center;
        }

        .fav-card__icon ha-icon {
          --mdc-icon-size: calc(${iconSizePx}px * 0.45);
          display: inline-flex;
          height: calc(${iconSizePx}px * 0.45);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${iconSizePx}px * 0.45);
        }

        .fav-card__unavailable-badge {
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

        .fav-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .fav-card__copy {
          align-content: center;
          display: grid;
          gap: ${isCompactInline ? "4px" : "6px"};
          min-width: 0;
        }

        .fav-card__alarm-panel {
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, ${accentColor} 12%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)),
              color-mix(in srgb, var(--primary-text-color) 4%, transparent)
            );
          border: 1px solid color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 20px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 18px 36px rgba(0, 0, 0, 0.24);
          display: grid;
          gap: 10px;
          margin-top: 2px;
          min-width: 0;
          padding: 10px;
          pointer-events: auto;
          position: static;
          width: 100%;
          z-index: 1;
        }

        .fav-card__alarm-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          min-width: 0;
        }

        .fav-card__alarm-button {
          align-items: center;
          appearance: none;
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--fav-alarm-accent) 14%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)),
              color-mix(in srgb, var(--primary-text-color) 5%, transparent)
            );
          border: 1px solid color-mix(in srgb, var(--fav-alarm-accent) 28%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 7%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.14);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: ${Math.max(11, chipFontSizePx)}px;
          font-weight: 700;
          gap: 6px;
          min-height: ${Math.max(28, chipHeightPx + 6)}px;
          padding: 0 11px;
          touch-action: manipulation;
        }

        .fav-card__alarm-button ha-icon {
          --mdc-icon-size: 14px;
          height: 14px;
          width: 14px;
        }

        .fav-card__alarm-code {
          min-width: 0;
        }

        .fav-card__alarm-code input {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 14px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 38px;
          padding: 0 12px;
          width: 100%;
        }

        .fav-card__title {
          font-size: ${titleSizePx}px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: ${isCompactInline ? "1.08" : "1.12"};
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .fav-card__chips {
          align-items: center;
          display: flex;
          gap: ${isCompactInline ? "6px" : "8px"};
          min-width: 0;
        }

        .fav-card__chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color: var(--primary-text-color);
          display: inline-flex;
          font-size: ${chipFontSizePx}px;
          font-weight: 700;
          height: ${chipHeightPx}px;
          line-height: 1;
          max-width: 100%;
          min-width: 0;
          padding: ${styles.chip_padding};
          white-space: nowrap;
        }

        .fav-card__empty-title {
          font-size: 14px;
          font-weight: 700;
        }

        .fav-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }

        .fav-card--single-row .fav-card__chip {
          max-width: 100%;
        }

        .fav-card--tight-inline:not(.fav-card--alarm-open) .fav-card__copy {
          align-items: center;
          display: flex;
          gap: 6px;
          min-width: 0;
        }

        .fav-card--tight-inline:not(.fav-card--alarm-open) .fav-card__title {
          flex: 1 1 auto;
          min-width: 0;
        }

        .fav-card--tight-inline:not(.fav-card--alarm-open) .fav-card__chips {
          flex: 0 0 auto;
          gap: 4px;
        }

        .fav-card--tight-inline.fav-card--alarm-open .fav-card__copy {
          align-content: start;
          display: grid;
          gap: 6px;
          min-width: 0;
          width: 100%;
        }

        .fav-card--empty {
          display: grid;
          gap: 8px;
          padding: 14px;
        }
      </style>
      <ha-card
        class="fav-card ${isMini ? "fav-card--mini" : "fav-card--inline"} ${isCompactInline ? "fav-card--single-row" : ""} ${isTightInline ? "fav-card--tight-inline" : ""} ${showAlarmPanel ? "fav-card--alarm-open" : ""} ${canRunPrimaryAction ? "fav-card--clickable" : ""}"
        ${canRunPrimaryAction ? 'data-fav-action="primary"' : ""}
      >
        <div class="fav-card__content" ${canRunPrimaryAction ? 'data-fav-action="primary"' : ""}>
          <div class="fav-card__hero" ${canRunPrimaryAction ? 'data-fav-action="primary"' : ""}>
            <button
              type="button"
              class="fav-card__icon"
              ${canRunPrimaryAction ? 'data-fav-action="primary"' : ""}
              aria-label="${escapeHtml(canRunPrimaryAction ? "Accion principal" : title)}"
            >
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
              ${showUnavailableBadge ? `<span class="fav-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopy
              ? `
                <div class="fav-card__copy">
                  ${showTitle ? `<div class="fav-card__title">${escapeHtml(title)}</div>` : ""}
                  ${showValue ? `<div class="fav-card__chips">${this._renderChip(displayValue)}</div>` : ""}
                </div>
              `
              : ""}
          </div>
          ${showAlarmPanel
            ? `
              <div class="fav-card__alarm-panel">
                <div class="fav-card__alarm-actions">
                  ${alarmModes.map(mode => this._renderAlarmActionButton(mode, accentColor)).join("")}
                </div>
                ${showAlarmCodeInput
                  ? `
                    <label class="fav-card__alarm-code" data-fav-alarm-ignore="true">
                      <input
                        type="password"
                        inputmode="numeric"
                        autocomplete="one-time-code"
                        data-fav-alarm-ignore="true"
                        data-fav-alarm-field="alarm-code"
                        placeholder="PIN"
                        value="${escapeHtml(this._alarmCodeInput)}"
                      />
                    </label>
                  `
                  : ""}
              </div>
            `
            : ""}
        </div>
      </ha-card>
    `;

    if (isAlarmPanel && this._lastAlarmPanelRenderedOpen !== showAlarmPanel) {
      this._lastAlarmPanelRenderedOpen = showAlarmPanel;
      requestAnimationFrame(() => {
        this._applyHostGridSpan(showAlarmPanel);
        this._notifyLayoutChange();
      });
    } else if (!isAlarmPanel) {
      this._lastAlarmPanelRenderedOpen = false;
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaFavCard);
}

class NodaliaFavCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
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
    return window.NodaliaUtils.editorStatesSignature(hass, this._config?.language);
  }

  _getEntityOptions(field = "entity", domains = []) {
    const normalizedDomains = Array.isArray(domains)
      ? domains.map(domain => String(domain || "").trim()).filter(Boolean)
      : [];

    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => (
        !normalizedDomains.length
        || normalizedDomains.some(domain => entityId.startsWith(`${domain}.`))
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
        left.label.localeCompare(right.label, "es", { sensitivity: "base" })
        || left.value.localeCompare(right.value, "es", { sensitivity: "base" })
      ));

    const currentValue = String(getByPath(this._config, field) || "").trim();
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

    if (input.dataset.field === "__info_only") {
      const isInfoOnly = this._readFieldValue(input) === true;

      if (isInfoOnly) {
        this._config.tap_action = "none";
      } else if ((this._config.tap_action || "auto") === "none") {
        this._config.tap_action = "auto";
      }

      this._setEditorConfig();

      if (event.type === "change") {
        this._emitConfig();
      }
      return;
    }

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
    const domains = Array.isArray(options.domains)
      ? options.domains.map(domain => String(domain || "").trim()).filter(Boolean).join(",")
      : "";
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-domains="${escapeHtml(domains)}"
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
    const allowedDomains = String(host.dataset.domains || "")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      if (allowedDomains.length) {
        control.includeDomains = allowedDomains;
        control.entityFilter = stateObj => allowedDomains.some(domain => String(stateObj?.entity_id || "").startsWith(`${domain}.`));
      }
      control.allowCustomEntity = true;
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: allowedDomains.length === 1
          ? { domain: allowedDomains[0] }
          : {},
      };
    } else {
      control = document.createElement("select");
      this._getEntityOptions(field, allowedDomains).forEach(option => {
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
    const phFavName = this._editorLabel("ed.fav.name_placeholder");

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

        .editor-field textarea {
          min-height: 86px;
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

        .editor-toggle {
          align-items: center;
          grid-template-columns: auto 1fr;
          padding-top: 20px;
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
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.fav.general_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityField("ed.entity.quick_entity", "entity", config.entity, {
              fullWidth: true,
            })}
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: phFavName,
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, {
              placeholder: "mdi:lightbulb",
              fullWidth: true,
            })}
            <div class="editor-grid">
              ${this._renderCheckboxField("ed.entity.use_entity_icon", "use_entity_icon", config.use_entity_icon === true)}
              ${this._renderSelectField(
                "ed.fav.card_mode_label",
                "entity_mode",
                config.entity_mode || "auto",
                [
                  { value: "auto", label: "ed.fav.mode_auto" },
                  { value: "standard", label: "ed.fav.mode_standard" },
                  { value: "alarm_control_panel", label: "ed.fav.mode_alarm_panel" },
                ],
              )}
            </div>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.action_block_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.fav.action_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.fav.primary_action_label",
              "tap_action",
              config.tap_action || "auto",
              [
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.fav.tap_select_none_label" },
              ],
            )}
            ${this._renderCheckboxField(
              "ed.fav.tap_info_only_checkbox",
              "__info_only",
              (config.tap_action || "auto") === "none",
            )}
            ${this._renderTextField("ed.fav.tap_service_field", "tap_service", config.tap_service, {
              placeholder: "light.turn_on",
            })}
            ${this._renderTextField("ed.fav.tap_url_field", "tap_url", config.tap_url, {
              placeholder: "https://example.com",
            })}
            ${this._renderCheckboxField("ed.entity.tap_new_tab", "tap_new_tab", config.tap_new_tab === true)}
            ${this._renderTextareaField("ed.entity.tap_service_data_json", "tap_service_data", config.tap_service_data, {
              placeholder: '{"brightness_pct": 70}',
            })}
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
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.fav.visibility_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.fav.layout_mode_label",
              "layout_mode",
              config.layout_mode || "auto",
              [
                { value: "auto", label: "ed.fav.layout_auto" },
                { value: "mini", label: "ed.fav.layout_mini" },
                { value: "inline", label: "ed.fav.layout_inline" },
              ],
            )}
            ${this._renderCheckboxField("ed.person.show_name", "show_name", config.show_name !== false)}
            ${this._renderCheckboxField("ed.entity.show_state", "show_state", config.show_state !== false)}
            ${this._renderTextField("ed.fav.state_attribute_label", "state_attribute", config.state_attribute, {
              placeholder: "battery_level",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.fav.alarm_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.fav.alarm_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.fav.alarm_pin", "alarm_code", config.alarm_code, {
              placeholder: "1234",
            })}
            ${this._renderEntityField("ed.fav.alarm_code_helper", "alarm_code_entity", config.alarm_code_entity)}
            ${this._renderCheckboxField("ed.fav.alarm_show_pin", "alarm_show_code_input", config.alarm_show_code_input !== false)}
            ${this._renderCheckboxField("ed.fav.alarm_show_disarm", "alarm_show_disarm", config.alarm_show_disarm !== false)}
            ${this._renderCheckboxField("ed.fav.alarm_show_arm_home", "alarm_show_arm_home", config.alarm_show_arm_home !== false)}
            ${this._renderCheckboxField("ed.fav.alarm_show_arm_away", "alarm_show_arm_away", config.alarm_show_arm_away !== false)}
            ${this._renderCheckboxField("ed.fav.alarm_show_arm_night", "alarm_show_arm_night", config.alarm_show_arm_night !== false)}
            ${this._renderCheckboxField("ed.fav.alarm_show_arm_vacation", "alarm_show_arm_vacation", config.alarm_show_arm_vacation === true)}
            ${this._renderCheckboxField("ed.fav.alarm_show_custom_bypass", "alarm_show_custom_bypass", config.alarm_show_custom_bypass === true)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.person.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.person.haptics_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.person.enable_haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("ed.person.fallback_vibrate", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.fav.styles_section_hint"))}</div>
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
                  ${this._renderTextField("ed.person.style_avatar_size", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderColorField("ed.person.style_avatar_bg", "styles.icon.background", config.styles.icon.background, {
                    fallbackValue: DEFAULT_CONFIG.styles.icon.background,
                  })}
                  ${this._renderColorField("ed.entity.style_icon_on", "styles.icon.on_color", config.styles.icon.on_color)}
                  ${this._renderColorField("ed.entity.style_icon_off", "styles.icon.off_color", config.styles.icon.off_color)}
                  ${this._renderTextField("ed.person.style_chip_height", "styles.chip_height", config.styles.chip_height)}
                  ${this._renderTextField("ed.person.style_chip_font", "styles.chip_font_size", config.styles.chip_font_size)}
                  ${this._renderTextField("ed.person.style_chip_padding", "styles.chip_padding", config.styles.chip_padding)}
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
                  ${this._renderTextField("ed.person.style_title_size", "styles.title_size", config.styles.title_size)}
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
  customElements.define(EDITOR_TAG, NodaliaFavCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Fav Card",
  description: "Tarjeta mini y elegante para favoritos y controles rapidos en movil.",
  preview: true,
});
