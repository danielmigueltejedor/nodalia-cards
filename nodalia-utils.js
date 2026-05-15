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
