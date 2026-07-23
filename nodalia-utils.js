/**
 * Shared helpers for Nodalia cards (deep equality, config stripping, editor mounts).
 * Loaded early in nodalia-cards.js bundle; exposed as window.NodaliaUtils.
 */
(function initNodaliaUtils() {
  const REQUIRED_API_KEYS = [
    "isObject",
    "deepClone",
    "deepEqual",
    "mergeDeep",
    "compactConfig",
    "getByPath",
    "clamp",
    "escapeHtml",
    "escapeSelectorValue",
    "fireEvent",
    "normalizeTextKey",
    "stripEqualToDefaults",
    "editorStatesSignature",
    "editorFilteredStatesSignature",
    "editorSortLocale",
    "sanitizeActionUrl",
    "sanitizeCssValue",
    "sanitizeStyleTree",
    "mountEntityPickerHost",
    "mountIconPickerHost",
    "postHomeAssistantWebhook",
    "warnStrictServiceDenied",
    "registerCustomCard",
    "renderEditorChipBorderRadiusHtml",
    "renderEditorCardBorderRadiusHtml",
    "bindHostPointerHoldGesture",
    "installPointerFocusRingGuard",
    "isKeyboardActivationEvent",
    "bindModalFocus",
    "releaseModalFocus",
    "cancelCardZoneTap",
    "scheduleCardZoneTap",
    "isNodaliaSliderChromeHit",
    "renderLovelaceEntityGuardCardHtml",
    "renderLovelaceEntityGuardForEntities",
    "renderEditorCollapsibleToggleHtml",
    "renderEditorCollapsibleSectionHeaderHtml",
    "getEntityFriendlyName",
    "applyDefaultConfigNameFromEntity",
    "coerceCardTapAction",
    "applyCardTapActionField",
    "invokeHomeAssistantService",
    "renderCardEmptyStateDocument",
    "bindEditorDialogLayoutFix",
    "releaseEditorDialogLayoutFix",
    "clampEditorDialogScroll",
    "renderReducedMotionStyles",
    "captureEditorFocusState",
    "restoreEditorFocusState",
    "bindShadowListeners",
    "releaseShadowListeners",
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

  function sanitizeCssValue(value, fallback = "") {
    const raw = String(value ?? "").trim();
    const safeFallback = String(fallback ?? "").trim();
    if (!raw) {
      return safeFallback;
    }
    if (
      /[\u0000-\u001f\u007f<>;"'{}]/.test(raw)
      || raw.includes("/*")
      || raw.includes("*/")
    ) {
      return safeFallback;
    }
    return raw;
  }

  function sanitizeStyleTree(candidate, fallback) {
    if (isObject(fallback)) {
      const source = isObject(candidate) ? candidate : {};
      const result = {};
      Object.keys(fallback).forEach(key => {
        result[key] = sanitizeStyleTree(source[key], fallback[key]);
      });
      return result;
    }
    if (Array.isArray(fallback)) {
      return deepClone(Array.isArray(candidate) ? candidate : fallback);
    }
    if (typeof fallback === "string") {
      return sanitizeCssValue(candidate, fallback);
    }
    if (typeof fallback === "number") {
      const numeric = Number(candidate);
      return Number.isFinite(numeric) ? numeric : fallback;
    }
    if (typeof fallback === "boolean") {
      return typeof candidate === "boolean" ? candidate : fallback;
    }
    return deepClone(fallback);
  }

  function isUnsafeConfigPathKey(key) {
    return key === "__proto__" || key === "constructor" || key === "prototype";
  }

  function setByPath(target, path, value) {
    const parts = String(path || "").split(".");
    if (parts.some(isUnsafeConfigPathKey)) {
      return;
    }
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
    if (parts.some(isUnsafeConfigPathKey)) {
      return;
    }
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

  /**
   * Recursively merges plain objects while replacing arrays and cloning every
   * inherited value. This is the canonical configuration merge used by cards.
   */
  function mergeDeep(base, override) {
    if (Array.isArray(base)) {
      return Array.isArray(override) ? deepClone(override) : deepClone(base);
    }
    if (!isObject(base)) {
      return override === undefined ? deepClone(base) : deepClone(override);
    }

    const source = isObject(override) ? override : {};
    const result = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(source)]);
    keys.forEach(key => {
      const baseValue = base[key];
      const overrideValue = source[key];
      if (overrideValue === undefined) {
        result[key] = deepClone(baseValue);
      } else if (isObject(baseValue) && isObject(overrideValue)) {
        result[key] = mergeDeep(baseValue, overrideValue);
      } else {
        result[key] = deepClone(overrideValue);
      }
    });
    return result;
  }

  /** Removes empty editor values without mutating the input configuration. */
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

  function getByPath(target, path) {
    const parts = String(path || "").split(".");
    if (parts.some(isUnsafeConfigPathKey)) {
      return undefined;
    }
    let cursor = target;
    for (const key of parts) {
      if (!key || (!isObject(cursor) && !Array.isArray(cursor))) {
        return undefined;
      }
      cursor = cursor[key];
    }
    return cursor;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
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

  function normalizeTextKey(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
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
   *
   * From Lovelace, prefer the authenticated WebSocket command `webhook/handle` when
   * `hass.callWS` is available — it reliably triggers automations even when HTTP POST
   * would return 200 without firing (e.g. `local_only` webhooks via remote/Nabu Casa).
   * Falls back to same-origin POST, then `hass.auth.fetchWithAuth`.
   */
  function postHomeAssistantWebhookViaWebSocket(hass, webhookId, payloadJson) {
    if (typeof hass?.callWS !== "function") {
      return Promise.resolve(false);
    }

    return Promise.resolve(
      hass.callWS({
        type: "webhook/handle",
        webhook_id: webhookId,
        method: "POST",
        body: payloadJson,
        headers: { "Content-Type": "application/json" },
      }),
    ).then(
      result => {
        const status = Number(result?.status);
        if (Number.isFinite(status)) {
          return status >= 200 && status < 300;
        }
        return result != null;
      },
      () => false,
    );
  }

  function postHomeAssistantWebhook(webhookId, body, hass) {
    const id = normalizeHomeAssistantWebhookId(webhookId);
    if (!id) {
      return Promise.resolve(false);
    }
    const payload = body && typeof body === "object" ? body : {};
    const path = `/api/webhook/${encodeURIComponent(id)}`;
    const payloadJson = JSON.stringify(payload);

    const postSameOrigin = () => {
      if (typeof fetch !== "function") {
        return Promise.resolve(false);
      }
      const origin = typeof window !== "undefined" && window.location ? window.location.origin : "";
      if (!origin) {
        return Promise.resolve(false);
      }
      return fetch(`${origin}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadJson,
        credentials: "same-origin",
      }).then(
        res => res.ok,
        () => false,
      );
    };

    const postViaAuthFetch = () => {
      const authFetch = hass?.auth?.fetchWithAuth;
      if (typeof authFetch !== "function") {
        return postSameOrigin();
      }
      return authFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadJson,
      }).then(
        res => (res.ok ? true : postSameOrigin()),
        () => postSameOrigin(),
      );
    };

    const postViaHttp = () => postSameOrigin().then(ok => (ok ? true : postViaAuthFetch()));

    if (hass && typeof hass.callWS === "function") {
      return postHomeAssistantWebhookViaWebSocket(hass, id, payloadJson).then(
        ok => (ok ? true : postViaHttp()),
      );
    }

    return postViaHttp();
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

  function getEntityFriendlyName(hass, entityId) {
    const id = String(entityId || "").trim();
    if (!id || !hass?.states?.[id]) {
      return "";
    }
    return String(hass.states[id].attributes?.friendly_name || "").trim();
  }

  /**
   * When `name` is empty (or still matches the previous entity id/label), copy the entity friendly name.
   */
  function applyDefaultConfigNameFromEntity(config, hass, options = {}) {
    if (!config || !isObject(config)) {
      return config;
    }
    const entityId = String(config.entity || "").trim();
    if (!entityId || !hass?.states?.[entityId]) {
      return config;
    }
    const fallback = getEntityFriendlyName(hass, entityId) || entityId;
    const currentName = String(config.name ?? "").trim();
    const previousEntity = String(options.previousEntity ?? "").trim();
    const previousFriendly = previousEntity
      ? (getEntityFriendlyName(hass, previousEntity) || previousEntity)
      : "";
    const shouldApply =
      !currentName
      || (previousEntity && (currentName === previousEntity || currentName === previousFriendly));
    if (shouldApply) {
      config.name = fallback;
    }
    return config;
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

  const CARD_ZONE_DOUBLE_TAP_MS = 320;
  const CARD_TAP_ACTIONS = new Set(["auto", "toggle", "more-info", "service", "navigate", "url", "none"]);

  function normalizeTapActionToken(raw) {
    return String(raw ?? "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");
  }

  /**
   * Lovelace may store tap/hold actions as plain strings or HA action objects
   * (`{ action: "toggle" }`, `{ action: "perform-action", perform_action: "..." }`).
   */
  function coerceCardTapAction(value, fallback = "auto") {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }
    if (typeof value === "string") {
      const key = normalizeTapActionToken(value);
      return CARD_TAP_ACTIONS.has(key) ? key : fallback;
    }
    if (!isObject(value)) {
      const key = normalizeTapActionToken(value);
      if (!key || key === "[object object]") {
        return fallback;
      }
      return CARD_TAP_ACTIONS.has(key) ? key : fallback;
    }

    let action = normalizeTapActionToken(value.action || value.perform_action || "");
    if (action === "more-info-dialog") {
      action = "more-info";
    }
    if (action === "open-url") {
      action = "url";
    }
    if (action === "perform-action" || action === "call-service") {
      const service = String(value.perform_action || value.service || "").trim().toLowerCase();
      if (service === "homeassistant.toggle" || service.endsWith(".toggle")) {
        return "toggle";
      }
      if (service) {
        return "service";
      }
    }
    if (action.includes(".")) {
      if (action === "homeassistant.toggle" || action.endsWith(".toggle")) {
        return "toggle";
      }
      return "service";
    }
    return CARD_TAP_ACTIONS.has(action) ? action : fallback;
  }

  function applyCardTapActionField(config, keys, rawValue, fallback) {
    if (!isObject(config)) {
      return;
    }
    const actionKey = keys.actionKey || "tap_action";
    const serviceKey = keys.serviceKey || "tap_service";
    const serviceDataKey = keys.serviceDataKey || "tap_service_data";
    const serviceTargetKey = keys.serviceTargetKey || "tap_service_target";
    const urlKey = keys.urlKey || "tap_url";
    const navigationKey = keys.navigationKey || "navigation_path";
    const newTabKey = keys.newTabKey || "tap_new_tab";

    config[actionKey] = coerceCardTapAction(rawValue, fallback);
    if (!isObject(rawValue)) {
      return;
    }

    const navigationPath = String(rawValue.navigation_path || rawValue.path || "").trim();
    const urlPath = String(rawValue.url_path || rawValue.url || "").trim();
    const service = String(rawValue.perform_action || rawValue.service || "").trim();
    if (navigationPath && !String(config[navigationKey] || "").trim()) {
      config[navigationKey] = navigationPath;
      if (config[actionKey] === "auto") {
        config[actionKey] = "navigate";
      }
    }
    if (urlPath && !String(config[urlKey] || "").trim()) {
      config[urlKey] = urlPath;
      if (config[actionKey] === "auto") {
        config[actionKey] = "url";
      }
    }
    if (service && !String(config[serviceKey] || "").trim() && config[actionKey] !== "toggle") {
      config[serviceKey] = service;
      if (config[actionKey] === "auto") {
        config[actionKey] = "service";
      }
    }
    const dataPayload = rawValue.data ?? rawValue.service_data;
    if (dataPayload !== undefined && dataPayload !== null && !String(config[serviceDataKey] || "").trim()) {
      config[serviceDataKey] = typeof dataPayload === "string"
        ? dataPayload
        : JSON.stringify(dataPayload);
    }
    if (rawValue.target !== undefined && rawValue.target !== null && !String(config[serviceTargetKey] || "").trim()) {
      config[serviceTargetKey] = typeof rawValue.target === "string"
        ? rawValue.target
        : JSON.stringify(rawValue.target);
    }
    if (rawValue.new_tab !== undefined) {
      config[newTabKey] = rawValue.new_tab === true;
    }
  }

  function invokeHomeAssistantService(host, hass, domain, service, serviceData = {}, target = null) {
    if (!hass || !domain || !service) {
      return Promise.resolve(false);
    }
    const payload = isObject(serviceData) ? serviceData : {};
    if (typeof hass.callService === "function") {
      try {
        const result = target != null
          ? hass.callService(domain, service, payload, target)
          : hass.callService(domain, service, payload);
        return Promise.resolve(result);
      } catch (err) {
        if (typeof console !== "undefined" && typeof console.warn === "function") {
          console.warn("NodaliaUtils: callService failed", `${domain}.${service}`, err);
        }
        return Promise.resolve(false);
      }
    }
    if (host instanceof HTMLElement && typeof host.dispatchEvent === "function") {
      host.dispatchEvent(new CustomEvent("hass-action", {
        bubbles: true,
        composed: true,
        detail: {
          action: "call-service",
          service: `${domain}.${service}`,
          serviceData: payload,
          data: payload,
          target: target || undefined,
        },
      }));
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  function escapeLovelaceWarningText(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isLovelaceHassStatesHydrated(hass) {
    if (!hass) {
      return false;
    }
    if (hass.connected === false) {
      return false;
    }
    const states = hass.states;
    return Boolean(states && typeof states === "object" && Object.keys(states).length > 0);
  }

  function isLovelaceEntityKnown(hass, entityId) {
    const id = String(entityId ?? "").trim();
    if (!id || !hass) {
      return false;
    }
    if (hass.states?.[id]) {
      return true;
    }
    const registry = hass.entities ?? hass.entityRegistry ?? hass.entity_registry;
    return Boolean(registry && typeof registry === "object" && registry[id]);
  }

  function getLovelaceEntityWarningMessage(hass, entityId) {
    const id = String(entityId ?? "").trim();
    if (!id) {
      return (
        hass?.localize?.("ui.panel.lovelace.cards.show_entity_picker")
        ?? "No entity specified"
      );
    }
    if (!isLovelaceHassStatesHydrated(hass)) {
      return "";
    }
    if (isLovelaceEntityKnown(hass, id)) {
      return "";
    }
    return (
      hass?.localize?.("ui.components.entity.entity_not_found", { entity: id })
      ?? hass?.localize?.("ui.card.common.entity_not_found")
      ?? `Entity not found: ${id}`
    );
  }

  function renderLovelaceEntityWarningMarkup(hass, entityId) {
    const message = getLovelaceEntityWarningMessage(hass, entityId);
    if (!message) {
      return "";
    }
    const safe = escapeLovelaceWarningText(message);
    if (typeof customElements !== "undefined" && customElements.get("hui-warning")) {
      return `<hui-warning>${safe}</hui-warning>`;
    }
    if (typeof customElements !== "undefined" && customElements.get("ha-alert")) {
      return `<ha-alert alert-type="warning">${safe}</ha-alert>`;
    }
    return `<div style="display:block;padding:16px;color:var(--error-color);">${safe}</div>`;
  }

  function renderCardEmptyStateDocument(innerHtml, options = {}) {
    const markup = String(innerHtml ?? "").trim();
    if (!markup) {
      return "";
    }
    if (markup.includes("<style")) {
      return markup;
    }
    const card = isObject(options.card) ? options.card : {};
    const background = sanitizeCssValue(card.background, "var(--ha-card-background)");
    const border = sanitizeCssValue(
      card.border,
      "1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
    );
    const borderRadius = sanitizeCssValue(card.border_radius, "var(--ha-card-border-radius, 12px)");
    const boxShadow = sanitizeCssValue(card.box_shadow, "var(--ha-card-box-shadow, none)");
    const padding = sanitizeCssValue(card.padding, "16px");
    return `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        [class$="--empty"] {
          background: ${background};
          border: ${border};
          border-radius: ${borderRadius};
          box-shadow: ${boxShadow};
          display: grid;
          gap: 8px;
          padding: ${padding};
        }

        [class$="__empty-title"] {
          color: var(--primary-text-color);
          font-size: 15px;
          font-weight: 700;
        }

        [class$="__empty-text"] {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }
      </style>
      ${markup}
    `;
  }

  function renderLovelaceEntityGuardCardHtml(hass, entityId, options = {}) {
    const markup = renderLovelaceEntityWarningMarkup(hass, entityId);
    if (!markup) {
      return null;
    }
    const cardClass = String(options.cardClass ?? "").trim();
    const classAttr = cardClass ? ` class="${cardClass.replace(/"/g, "")}"` : "";
    return `<ha-card${classAttr}>${markup}</ha-card>`;
  }

  /** First configured id with a warning (missing or empty list → no entity). */
  function renderLovelaceEntityGuardForEntities(hass, entityIds, options = {}) {
    const ids = (Array.isArray(entityIds) ? entityIds : [entityIds])
      .map((id) => String(id ?? "").trim());
    if (!ids.length || ids.every((id) => !id)) {
      return renderLovelaceEntityGuardCardHtml(hass, "", options);
    }
    for (const id of ids) {
      const guard = renderLovelaceEntityGuardCardHtml(hass, id, options);
      if (guard) {
        return guard;
      }
    }
    return null;
  }

  function renderEditorCollapsibleToggleHtml(options = {}) {
    const escapeHtml = options.escapeHtml;
    const toggleId = String(options.toggleId ?? "").trim().replace(/"/g, "");
    if (typeof escapeHtml !== "function" || !toggleId) {
      return "";
    }
    const expanded = options.expanded === true;
    const showLabel = escapeHtml(String(options.showLabel ?? "Show"));
    const hideLabel = escapeHtml(String(options.hideLabel ?? "Hide"));
    const label = expanded ? hideLabel : showLabel;
    return `<button type="button" class="editor-section__toggle-button" data-editor-toggle="${toggleId}" aria-expanded="${expanded ? "true" : "false"}"><ha-icon icon="${expanded ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon><span>${label}</span></button>`;
  }

  /**
   * Collapsible editor section header (title + hint + chevron toggle). Pair with
   * `this._showTapActionsSection ? \`...\` : ""` around the section body.
   */
  function renderEditorCollapsibleSectionHeaderHtml(options = {}) {
    const escapeHtml = options.escapeHtml;
    const editorLabel = options.editorLabel;
    if (typeof escapeHtml !== "function" || typeof editorLabel !== "function") {
      return "";
    }
    const titleKey = String(options.titleKey ?? "ed.light.tap_actions_section_title");
    const hintKey = String(options.hintKey ?? "ed.light.tap_actions_section_hint");
    const toggleId = String(options.toggleId ?? "tap_actions").replace(/"/g, "");
    const expanded = options.expanded === true;
    const showLabelKey = String(options.showLabelKey ?? "ed.shared.show_tap_action_settings");
    const hideLabelKey = String(options.hideLabelKey ?? "ed.shared.hide_tap_action_settings");
    const toggle = renderEditorCollapsibleToggleHtml({
      toggleId,
      expanded,
      showLabel: editorLabel(showLabelKey),
      hideLabel: editorLabel(hideLabelKey),
      escapeHtml,
    });
    return `<div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(editorLabel(titleKey))}</div>
            <div class="editor-section__hint">${escapeHtml(editorLabel(hintKey))}</div>
            <div class="editor-section__actions">${toggle}</div>
          </div>`;
  }

  function cancelCardZoneTap(host) {
    if (!(host instanceof HTMLElement) || !host._nodaliaZoneTap) {
      return;
    }
    const pending = host._nodaliaZoneTap;
    if (pending?.timer) {
      window.clearTimeout(pending.timer);
    }
    host._nodaliaZoneTap = null;
  }

  const NODALIA_SLIDER_CHROME_CLASS_MARKERS = [
    "__slider-wrap",
    "__slider-shell",
    "__slider-track",
    "__slider-thumb",
    "__active-chip-shell",
    "__controls-shell",
    "__controls-inner",
  ];

  /** Slider / controls chrome must not trigger card-body tap (toggle). */
  function isNodaliaSliderChromeHit(event) {
    const path = typeof event?.composedPath === "function" ? event.composedPath() : [];
    for (const node of path) {
      if (!(node instanceof Element)) {
        continue;
      }
      if (node instanceof HTMLElement && node.dataset?.nodaliaTapShield === "true") {
        return true;
      }
      const className = typeof node.className === "string"
        ? node.className
        : String(node.getAttribute?.("class") || "");
      if (
        className &&
        NODALIA_SLIDER_CHROME_CLASS_MARKERS.some(marker => className.includes(marker))
      ) {
        return true;
      }
    }
    return false;
  }

  function scheduleCardZoneTap(host, options) {
    if (!(host instanceof HTMLElement)) {
      return;
    }
    const zone = String(options?.zone ?? "body");
    const delayMs = Number.isFinite(Number(options?.doubleTapMs)) && Number(options.doubleTapMs) > 0
      ? Math.round(Number(options.doubleTapMs))
      : CARD_ZONE_DOUBLE_TAP_MS;
    const onSingle = typeof options?.onSingle === "function" ? options.onSingle : () => {};
    const onDouble = typeof options?.onDouble === "function" ? options.onDouble : null;
    const now = Date.now();
    const pending = host._nodaliaZoneTap;

    if (onDouble && pending && pending.zone === zone && now - pending.at <= delayMs) {
      if (pending.timer) {
        window.clearTimeout(pending.timer);
      }
      host._nodaliaZoneTap = null;
      onDouble();
      return;
    }

    cancelCardZoneTap(host);
    const token = { zone, at: now };
    host._nodaliaZoneTap = token;
    token.timer = window.setTimeout(() => {
      if (host._nodaliaZoneTap !== token) {
        return;
      }
      host._nodaliaZoneTap = null;
      onSingle();
    }, delayMs);
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

  const POINTER_FOCUSABLE_SELECTOR = [
    "button",
    "a[href]",
    "summary",
    "[role='button']",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  /**
   * Safari/WebKit can keep :focus-visible on role=button surfaces after a
   * touch. Suppress only that pointer-created outline; the first keyboard
   * event restores the element's original inline style before it is handled.
   */
  function installPointerFocusRingGuard() {
    if (
      typeof window === "undefined"
      || typeof document === "undefined"
      || typeof document.addEventListener !== "function"
    ) {
      return false;
    }
    if (window.__nodaliaPointerFocusRingGuardInstalled === true) {
      return true;
    }

    const inlineOutlineState = new WeakMap();
    let pointerFocusedElement = null;

    const restoreOutline = element => {
      if (!(typeof HTMLElement !== "undefined" && element instanceof HTMLElement)) {
        return;
      }
      const previous = inlineOutlineState.get(element);
      if (previous) {
        if (previous.value) {
          element.style.setProperty("outline", previous.value, previous.priority);
        } else {
          element.style.removeProperty("outline");
        }
        inlineOutlineState.delete(element);
      }
      element.removeAttribute("data-nodalia-pointer-focus");
      if (pointerFocusedElement === element) {
        pointerFocusedElement = null;
      }
    };

    const suppressOutline = element => {
      if (!(typeof HTMLElement !== "undefined" && element instanceof HTMLElement)) {
        return;
      }
      if (pointerFocusedElement && pointerFocusedElement !== element) {
        restoreOutline(pointerFocusedElement);
      }
      if (!inlineOutlineState.has(element)) {
        inlineOutlineState.set(element, {
          priority: element.style.getPropertyPriority("outline"),
          value: element.style.getPropertyValue("outline"),
        });
      }
      element.setAttribute("data-nodalia-pointer-focus", "");
      element.style.setProperty("outline", "none", "important");
      pointerFocusedElement = element;
    };

    document.addEventListener("pointerdown", event => {
      if (typeof event.button === "number" && event.button !== 0) {
        return;
      }
      const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
      const belongsToNodalia = path.some(node => (
        typeof HTMLElement !== "undefined"
        && node instanceof HTMLElement
        && String(node.tagName || "").startsWith("NODALIA-")
      ));
      if (!belongsToNodalia) {
        return;
      }
      const target = path.find(node => (
        typeof HTMLElement !== "undefined"
        && node instanceof HTMLElement
        && typeof node.matches === "function"
        && node.matches(POINTER_FOCUSABLE_SELECTOR)
      ));
      if (target) {
        suppressOutline(target);
      }
    }, true);

    document.addEventListener("keydown", () => {
      restoreOutline(pointerFocusedElement);
    }, true);

    document.addEventListener("focusout", event => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
      if (pointerFocusedElement && path.includes(pointerFocusedElement)) {
        restoreOutline(pointerFocusedElement);
      }
    }, true);

    window.__nodaliaPointerFocusRingGuardInstalled = true;
    return true;
  }

  function isKeyboardActivationEvent(event) {
    if (!event || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") {
      return false;
    }
    const origin = typeof event.composedPath === "function" ? event.composedPath()[0] : event.target;
    if (!(origin instanceof HTMLElement)) {
      return true;
    }
    if (origin.isContentEditable) {
      return false;
    }
    return !["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(origin.tagName);
  }

  const modalFocusState = new WeakMap();
  const MODAL_FOCUSABLE_SELECTOR = [
    "button:not([disabled])",
    "[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  function modalFocusableElements(dialog) {
    if (!(dialog instanceof HTMLElement)) {
      return [];
    }
    return Array.from(dialog.querySelectorAll(MODAL_FOCUSABLE_SELECTOR)).filter(element => (
      element instanceof HTMLElement
      && element.hidden !== true
      && element.getAttribute("aria-hidden") !== "true"
    ));
  }

  function bindModalFocus(host, dialog, options = {}) {
    if (!(host instanceof HTMLElement) || !(dialog instanceof HTMLElement)) {
      return () => {};
    }

    const previousState = modalFocusState.get(host);
    const previousFocus = previousState?.previousFocus
      || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (previousState) {
      previousState.dialog.removeEventListener("keydown", previousState.onKeyDown);
      if (previousState.focusTimer) {
        window.clearTimeout(previousState.focusTimer);
      }
    }

    const onKeyDown = event => {
      if (event.key !== "Tab") {
        return;
      }
      const focusable = modalFocusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    if (!dialog.hasAttribute("tabindex")) {
      dialog.setAttribute("tabindex", "-1");
    }
    dialog.addEventListener("keydown", onKeyDown);
    const state = {
      dialog,
      onKeyDown,
      previousFocus,
      restoreFocus: typeof options.restoreFocus === "function" ? options.restoreFocus : null,
      focusTimer: 0,
    };
    modalFocusState.set(host, state);
    state.focusTimer = window.setTimeout(() => {
      state.focusTimer = 0;
      if (modalFocusState.get(host) !== state || !dialog.isConnected) {
        return;
      }
      const requested = options.initialFocusSelector
        ? dialog.querySelector(options.initialFocusSelector)
        : null;
      const target = requested instanceof HTMLElement
        ? requested
        : modalFocusableElements(dialog)[0] || dialog;
      target.focus({ preventScroll: true });
    }, 0);
    return () => releaseModalFocus(host);
  }

  function releaseModalFocus(host) {
    const state = modalFocusState.get(host);
    if (!state) {
      return;
    }
    modalFocusState.delete(host);
    state.dialog.removeEventListener("keydown", state.onKeyDown);
    if (state.focusTimer) {
      window.clearTimeout(state.focusTimer);
    }
    if (state.restoreFocus) {
      state.restoreFocus();
    } else if (state.previousFocus?.isConnected && typeof state.previousFocus.focus === "function") {
      state.previousFocus.focus({ preventScroll: true });
    }
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

  function clearDeferTimers(host) {
    const timers = host?._nodaliaDeferTimers;
    if (!timers?.size) {
      return;
    }
    timers.forEach(timer => window.clearTimeout(timer));
    timers.clear();
  }

  function normalizeSecurityConfig(security = {}, defaults = {}) {
    const base = {
      strict_service_actions: false,
      allowed_services: [],
      allowed_service_domains: [],
      ...(isObject(defaults) ? defaults : {}),
    };
    const src = isObject(security) ? security : {};
    const normalized = { ...base };
    normalized.strict_service_actions = src.strict_service_actions === true;
    if (Array.isArray(src.allowed_services)) {
      normalized.allowed_services = src.allowed_services
        .map(item => String(item || "").trim().toLowerCase())
        .filter(Boolean);
    }
    if (Array.isArray(src.allowed_service_domains)) {
      normalized.allowed_service_domains = src.allowed_service_domains
        .map(item => String(item || "").trim().toLowerCase())
        .filter(Boolean);
    }
    return normalized;
  }

  /**
   * Lovelace card dialog (.element-editor) stretches to match preview height on wide layouts.
   * Short visual editors then scroll past their fields into empty space — align the pane to content.
   */
  const EDITOR_DIALOG_EMPTY_GAP_CLAMP_PX = 96;

  function findLovelaceElementEditorPane(editorHost) {
    if (!(editorHost instanceof HTMLElement)) {
      return null;
    }
    let node = editorHost.parentElement;
    while (node) {
      if (node.classList?.contains("element-editor")) {
        return node;
      }
      node = getComposedParentElement(node);
    }
    return null;
  }

  function getComposedParentElement(node) {
    if (!(node instanceof HTMLElement)) {
      return null;
    }
    if (node.parentElement) {
      return node.parentElement;
    }
    const root = typeof node.getRootNode === "function" ? node.getRootNode() : null;
    const host = root instanceof ShadowRoot ? root.host : null;
    return host instanceof HTMLElement ? host : null;
  }

  function findParentNodaliaEditorHost(editorHost) {
    let node = getComposedParentElement(editorHost);
    while (node && !node.classList?.contains("element-editor")) {
      const tagName = String(node.localName || "").toLowerCase();
      if (tagName.startsWith("nodalia-") && tagName.endsWith("-editor")) {
        return node;
      }
      node = getComposedParentElement(node);
    }
    return null;
  }

  function getEditorDialogScrollAncestors(editorHost) {
    const nodes = [];
    let node = findLovelaceElementEditorPane(editorHost) || editorHost;
    while (node && node !== document.documentElement) {
      nodes.push(node);
      node = getComposedParentElement(node);
    }
    return nodes;
  }

  function isLikelyLovelacePreviewPane(node) {
    if (!(node instanceof HTMLElement)) {
      return false;
    }
    const marker = [
      node.localName,
      node.id,
      typeof node.className === "string" ? node.className : "",
      node.getAttribute?.("part") || "",
    ].join(" ").toLowerCase();
    return marker.includes("preview") || marker.includes("card-preview");
  }

  function getEditorDialogPreviewPanes(editorHost) {
    const pane = findLovelaceElementEditorPane(editorHost);
    const nodes = [];
    const seen = new Set();
    const add = node => {
      if (!(node instanceof HTMLElement) || seen.has(node) || node === pane || node.contains(editorHost)) {
        return;
      }
      seen.add(node);
      nodes.push(node);
    };
    let node = pane;
    while (node) {
      const parent = getComposedParentElement(node);
      if (!parent) {
        break;
      }
      Array.from(parent.children || []).forEach(child => {
        if (!(child instanceof HTMLElement) || child === node || child.contains(editorHost)) {
          return;
        }
        if (isLikelyLovelacePreviewPane(child) || child.scrollHeight > child.clientHeight + 1) {
          add(child);
        }
        child.querySelectorAll?.('[class*="preview" i], [id*="preview" i], [part*="preview" i]').forEach(add);
      });
      node = parent;
    }
    return nodes;
  }

  function bindEditorDialogLayoutFix(editorHost) {
    if (!(editorHost instanceof HTMLElement)) {
      return;
    }
    if (findParentNodaliaEditorHost(editorHost)) {
      releaseEditorDialogLayoutFix(editorHost);
      return;
    }
    const pane = findLovelaceElementEditorPane(editorHost);
    if (!pane) {
      return;
    }
    releaseEditorDialogLayoutFix(editorHost);
    const previous = {
      alignSelf: pane.style.alignSelf,
      height: pane.style.height,
      minHeight: pane.style.minHeight,
      maxHeight: pane.style.maxHeight,
      overflowY: pane.style.overflowY,
      overflowAnchor: pane.style.overflowAnchor,
    };
    const scrollAncestors = getEditorDialogScrollAncestors(editorHost);
    const previewPanes = getEditorDialogPreviewPanes(editorHost);
    const previousAncestors = scrollAncestors.map(node => ({
      node,
      overscrollBehaviorY: node.style.overscrollBehaviorY,
      overflowAnchor: node.style.overflowAnchor,
    }));
    const previousPreviewPanes = previewPanes.map(node => ({
      node,
      overscrollBehaviorY: node.style.overscrollBehaviorY,
      overflowAnchor: node.style.overflowAnchor,
      overflowY: node.style.overflowY,
      scrollTop: node.scrollTop,
    }));
    pane.style.alignSelf = "flex-start";
    pane.style.height = "auto";
    pane.style.minHeight = "0";
    pane.style.maxHeight = "var(--code-mirror-max-height, calc(100vh - 209px))";
    pane.style.overflowY = "auto";
    pane.style.overflowAnchor = "none";
    previousAncestors.forEach(({ node }) => {
      node.style.overscrollBehaviorY = "contain";
      node.style.overflowAnchor = "none";
    });
    previousPreviewPanes.forEach(({ node }) => {
      node.style.overscrollBehaviorY = "contain";
      node.style.overflowAnchor = "none";
      node.style.overflowY = "auto";
    });
    const onScroll = () => {
      if (editorHost._nodaliaEditorDialogClampFrame) {
        return;
      }
      editorHost._nodaliaEditorDialogClampFrame = window.requestAnimationFrame(() => {
        editorHost._nodaliaEditorDialogClampFrame = 0;
        runEditorDialogScrollClamp(editorHost);
      });
    };
    const onPreviewWheel = event => {
      const node = event.currentTarget;
      const deltaY = Number(event.deltaY) || 0;
      if (canPreviewPaneScroll(node, deltaY)) {
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onScroll();
    };
    window.addEventListener("scroll", onScroll, true);
    scrollAncestors.forEach(node => node.addEventListener("scroll", onScroll, { passive: true }));
    previewPanes.forEach(node => node.addEventListener("wheel", onPreviewWheel, { passive: false }));
    editorHost._nodaliaEditorDialogLayoutPane = pane;
    editorHost._nodaliaEditorDialogLayoutRelease = () => {
      window.removeEventListener("scroll", onScroll, true);
      scrollAncestors.forEach(node => node.removeEventListener("scroll", onScroll));
      previewPanes.forEach(node => node.removeEventListener("wheel", onPreviewWheel));
      if (editorHost._nodaliaEditorDialogClampFrame) {
        window.cancelAnimationFrame(editorHost._nodaliaEditorDialogClampFrame);
        editorHost._nodaliaEditorDialogClampFrame = 0;
      }
      previousAncestors.forEach(({ node, overscrollBehaviorY, overflowAnchor }) => {
        node.style.overscrollBehaviorY = overscrollBehaviorY;
        node.style.overflowAnchor = overflowAnchor;
      });
      previousPreviewPanes.forEach(({ node, overscrollBehaviorY, overflowAnchor, overflowY, scrollTop }) => {
        node.style.overscrollBehaviorY = overscrollBehaviorY;
        node.style.overflowAnchor = overflowAnchor;
        node.style.overflowY = overflowY;
        node.scrollTop = scrollTop;
      });
      pane.style.alignSelf = previous.alignSelf;
      pane.style.height = previous.height;
      pane.style.minHeight = previous.minHeight;
      pane.style.maxHeight = previous.maxHeight;
      pane.style.overflowY = previous.overflowY;
      pane.style.overflowAnchor = previous.overflowAnchor;
      editorHost._nodaliaEditorDialogLayoutPane = null;
    };
  }

  function releaseEditorDialogLayoutFix(editorHost) {
    if (editorHost?._nodaliaEditorDialogLayoutRelease) {
      editorHost._nodaliaEditorDialogLayoutRelease();
      editorHost._nodaliaEditorDialogLayoutRelease = null;
    }
  }

  function runEditorDialogScrollClamp(editorHost) {
    if (
      !(editorHost instanceof HTMLElement)
      || !editorHost.isConnected
      || findParentNodaliaEditorHost(editorHost)
    ) {
      return;
    }
    const editorContent = editorHost.shadowRoot?.querySelector(".editor") || editorHost;
    const contentRect = editorContent instanceof HTMLElement
      ? editorContent.getBoundingClientRect()
      : null;
    const nodes = getEditorDialogScrollAncestors(editorHost);
    for (const node of nodes) {
      const style = getComputedStyle(node);
      const scrollable =
        /(auto|scroll|overlay)/.test(style.overflowY) &&
        node.scrollHeight > node.clientHeight + 1;
      if (scrollable) {
        const maxScroll = Math.max(0, node.scrollHeight - node.clientHeight);
        if (node.scrollTop > maxScroll) {
          node.scrollTop = maxScroll;
        }
        if (contentRect) {
          const scrollportRect = node.getBoundingClientRect();
          const emptyBottomGap = scrollportRect.bottom - contentRect.bottom;
          if (emptyBottomGap > EDITOR_DIALOG_EMPTY_GAP_CLAMP_PX && node.scrollTop > 0) {
            node.scrollTop = Math.max(
              0,
              node.scrollTop - Math.ceil(emptyBottomGap - EDITOR_DIALOG_EMPTY_GAP_CLAMP_PX)
            );
          }
        }
      }
    }
    getEditorDialogPreviewPanes(editorHost).forEach(node => {
      const maxScroll = Math.max(0, node.scrollHeight - node.clientHeight);
      if (node.scrollTop > maxScroll) {
        node.scrollTop = maxScroll;
      }
    });
  }

  function canPreviewPaneScroll(node, deltaY) {
    if (!(node instanceof HTMLElement) || !Number.isFinite(deltaY) || deltaY === 0) {
      return false;
    }
    const maxScroll = Math.max(0, node.scrollHeight - node.clientHeight);
    if (maxScroll <= 1) {
      return false;
    }
    return deltaY > 0
      ? node.scrollTop < maxScroll - 1
      : node.scrollTop > 1;
  }

  function clampEditorDialogScroll(editorHost) {
    if (!(editorHost instanceof HTMLElement) || typeof window === "undefined") {
      return;
    }
    window.requestAnimationFrame(() => {
      if (!editorHost.isConnected) {
        return;
      }
      bindEditorDialogLayoutFix(editorHost);
      runEditorDialogScrollClamp(editorHost);
    });
  }

  function scheduleDeferTimer(host, callback, delayMs) {
    if (!host || typeof window === "undefined" || typeof callback !== "function") {
      return 0;
    }
    if (!host._nodaliaDeferTimers) {
      host._nodaliaDeferTimers = new Set();
    }
    const timer = window.setTimeout(() => {
      host._nodaliaDeferTimers?.delete(timer);
      callback();
    }, delayMs);
    host._nodaliaDeferTimers.add(timer);
    return timer;
  }

  function isEditorTextControl(value) {
    return (
      (typeof HTMLInputElement !== "undefined" && value instanceof HTMLInputElement)
      || (typeof HTMLTextAreaElement !== "undefined" && value instanceof HTMLTextAreaElement)
      || (typeof HTMLSelectElement !== "undefined" && value instanceof HTMLSelectElement)
    );
  }

  /** Captures the editor control and caret without retaining a detached DOM node. */
  function captureEditorFocusState(editorHost) {
    const activeElement = editorHost?.shadowRoot?.activeElement;
    if (!isEditorTextControl(activeElement)) {
      return null;
    }
    const field = String(activeElement.dataset?.field || "");
    if (!field) {
      return null;
    }
    const supportsSelection =
      typeof activeElement.selectionStart === "number"
      && typeof activeElement.selectionEnd === "number";
    return {
      selector: `[data-field="${escapeSelectorValue(field)}"]`,
      selectionEnd: supportsSelection ? activeElement.selectionEnd : null,
      selectionStart: supportsSelection ? activeElement.selectionStart : null,
      type: activeElement.type,
    };
  }

  /** Restores focus after an editor render while keeping Lovelace scroll stable. */
  function restoreEditorFocusState(editorHost, focusState) {
    if (!focusState?.selector || !editorHost?.shadowRoot) {
      return;
    }
    const target = editorHost.shadowRoot.querySelector(focusState.selector);
    if (!isEditorTextControl(target)) {
      return;
    }
    try {
      target.focus({ preventScroll: true });
    } catch (_error) {
      target.focus();
    }
    const canRestoreSelection =
      focusState.type !== "checkbox"
      && typeof focusState.selectionStart === "number"
      && typeof focusState.selectionEnd === "number"
      && typeof target.setSelectionRange === "function";
    if (!canRestoreSelection) {
      return;
    }
    try {
      target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    } catch (_error) {
      // Some input types expose selection properties but reject setSelectionRange.
    }
  }

  /**
   * Idempotently binds a declarative event map to a component shadow root.
   * The same map key can later be released during disconnectedCallback.
   */
  function bindShadowListeners(host, listeners, key = "editor") {
    const root = host?.shadowRoot;
    if (!root || !Array.isArray(listeners)) {
      return false;
    }
    if (!host._nodaliaShadowListenerGroups) {
      host._nodaliaShadowListenerGroups = new Map();
    }
    if (host._nodaliaShadowListenerGroups.has(key)) {
      return false;
    }
    const active = listeners
      .map(item => Array.isArray(item)
        ? { type: item[0], listener: item[1], options: item[2] }
        : item)
      .filter(item => item && typeof item.type === "string" && typeof item.listener === "function")
      .map(item => ({ type: item.type, listener: item.listener, options: item.options }));
    active.forEach(item => root.addEventListener(item.type, item.listener, item.options));
    host._nodaliaShadowListenerGroups.set(key, active);
    return true;
  }

  function releaseShadowListeners(host, key = "editor") {
    const groups = host?._nodaliaShadowListenerGroups;
    const active = groups?.get(key);
    if (!active || !host?.shadowRoot) {
      return false;
    }
    active.forEach(item => host.shadowRoot.removeEventListener(item.type, item.listener, item.options));
    groups.delete(key);
    return true;
  }

  function renderReducedMotionStyles() {
    return `
      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-delay: 0ms !important;
          animation-duration: 1ms !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-delay: 0ms !important;
          transition-duration: 1ms !important;
        }
      }
    `;
  }

  const api = {
    isObject,
    isUnsafeConfigPathKey,
    setByPath,
    deleteByPath,
    deepClone,
    deepEqual,
    mergeDeep,
    compactConfig,
    getByPath,
    clamp,
    escapeHtml,
    escapeSelectorValue,
    fireEvent,
    normalizeTextKey,
    stripEqualToDefaults,
    editorStatesSignature,
    editorFilteredStatesSignature,
    editorSortLocale,
    sanitizeActionUrl,
    sanitizeCssValue,
    sanitizeStyleTree,
    mountEntityPickerHost,
    mountIconPickerHost,
    postHomeAssistantWebhook,
    warnStrictServiceDenied,
    registerCustomCard,
    renderEditorChipBorderRadiusHtml,
    renderEditorCardBorderRadiusHtml,
    bindHostPointerHoldGesture,
    installPointerFocusRingGuard,
    isKeyboardActivationEvent,
    bindModalFocus,
    releaseModalFocus,
    cancelCardZoneTap,
    scheduleCardZoneTap,
    isNodaliaSliderChromeHit,
    renderLovelaceEntityGuardCardHtml,
    renderLovelaceEntityGuardForEntities,
    renderEditorCollapsibleToggleHtml,
    renderEditorCollapsibleSectionHeaderHtml,
    getEntityFriendlyName,
    applyDefaultConfigNameFromEntity,
    coerceCardTapAction,
    applyCardTapActionField,
    invokeHomeAssistantService,
    renderCardEmptyStateDocument,
    bindEditorDialogLayoutFix,
    releaseEditorDialogLayoutFix,
    clampEditorDialogScroll,
    renderReducedMotionStyles,
    captureEditorFocusState,
    restoreEditorFocusState,
    bindShadowListeners,
    releaseShadowListeners,
    scheduleDeferTimer,
    clearDeferTimers,
    normalizeSecurityConfig,
  };

  if (typeof window !== "undefined") {
    ensureCustomCardsDeduped();
    window.NodaliaUtils = api;
    installPointerFocusRingGuard();
  }
})();
