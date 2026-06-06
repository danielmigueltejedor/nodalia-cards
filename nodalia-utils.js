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
    "cancelCardZoneTap",
    "scheduleCardZoneTap",
    "isNodaliaSliderChromeHit",
    "renderLovelaceEntityGuardCardHtml",
    "renderLovelaceEntityGuardForEntities",
    "renderEditorCollapsibleToggleHtml",
    "renderEditorCollapsibleSectionHeaderHtml",
    "getEntityFriendlyName",
    "applyDefaultConfigNameFromEntity",
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
    isUnsafeConfigPathKey,
    setByPath,
    deleteByPath,
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
    cancelCardZoneTap,
    scheduleCardZoneTap,
    isNodaliaSliderChromeHit,
    renderLovelaceEntityGuardCardHtml,
    renderLovelaceEntityGuardForEntities,
    renderEditorCollapsibleToggleHtml,
    renderEditorCollapsibleSectionHeaderHtml,
    getEntityFriendlyName,
    applyDefaultConfigNameFromEntity,
  };

  if (typeof window !== "undefined") {
    ensureCustomCardsDeduped();
    window.NodaliaUtils = api;
  }
})();
