/* Generated from src/shared/utils-runtime.ts. Do not edit. */
"use strict";
(() => {
  // src/shared/card-layout-notifier.ts
  function normalizeCardLayoutWrapper(host) {
    const wrapper = host.parentElement;
    if (wrapper?.localName !== "hui-card" || wrapper.parentElement?.matches(".card.fit-rows") || wrapper.style.display || getComputedStyle(wrapper).display !== "inline") {
      return () => {
      };
    }
    wrapper.style.display = "block";
    return () => {
      if (wrapper.style.display === "block") wrapper.style.removeProperty("display");
    };
  }

  // src/shared/utils-empty-state.css
  var utils_empty_state_default = ":host{display:block}*{box-sizing:border-box}[class$=--empty]{display:grid;gap:8px}[class$=__empty-title]{color:var(--primary-text-color);font-size:15px;font-weight:700}[class$=__empty-text]{color:var(--secondary-text-color);font-size:13px;line-height:1.5}";

  // src/shared/config-values.ts
  var isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  var unsafeKeys = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  function compactConfig(value, preserveEmptyKeys = []) {
    if (Array.isArray(value)) return value.map((item) => compactConfig(item, preserveEmptyKeys)).filter((item) => item !== void 0);
    if (isRecord(value)) {
      const result = {};
      for (const [key, item] of Object.entries(value)) {
        if (unsafeKeys.has(key)) continue;
        if (item === "" && preserveEmptyKeys.includes(key)) {
          result[key] = "";
          continue;
        }
        const cleaned = compactConfig(item, preserveEmptyKeys);
        if (cleaned !== void 0 && !(isRecord(cleaned) && Object.keys(cleaned).length === 0)) result[key] = cleaned;
      }
      return result;
    }
    return value === "" || value === null || value === void 0 ? void 0 : value;
  }

  // src/shared/utils-reduced-motion.css
  var utils_reduced_motion_default = "@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-delay:0ms!important;animation-duration:1ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-delay:0ms!important;transition-duration:1ms!important}}";

  // src/shared/utils-engine-banner.css
  var utils_engine_banner_default = ".editor-engine-banner{align-items:flex-start;background:color-mix(in srgb,var(--primary-color) 8%,transparent);border:1px solid color-mix(in srgb,var(--primary-color) 26%,transparent);border-radius:14px;display:flex;gap:10px;padding:10px 12px}.editor-engine-banner ha-icon{--mdc-icon-size: 20px;color:var(--primary-color);flex:0 0 auto}.editor-engine-banner__copy{display:grid;gap:2px;min-width:0}.editor-engine-banner__title{font-size:13px;font-weight:600}.editor-engine-banner__meta{color:var(--secondary-text-color);font-size:11px;line-height:1.35;overflow-wrap:anywhere}";

  // src/shared/utils-runtime.ts
  (function initNodaliaUtils() {
    const REQUIRED_API_KEYS = [
      "isObject",
      "deepClone",
      "deepEqual",
      "mergeDeep",
      "compactConfig",
      "shouldUseCompactCardLayout",
      "resolveCompactLayoutParentWidth",
      "shouldShowCompactCardTitle",
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
      "defineLazyCustomElement",
      "findStubEntityIds",
      "createEntitySuggestion",
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
      "releaseShadowListeners"
    ];
    const existing = typeof window !== "undefined" ? window.NodaliaUtils : null;
    if (existing && isObject(existing) && REQUIRED_API_KEYS.every((key) => typeof existing[key] === "function")) {
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
      if (/[<>;"'{}]/.test(raw) || Array.from(raw).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || raw.includes("/*") || raw.includes("*/")) {
        return safeFallback;
      }
      return raw;
    }
    function sanitizeStyleTree(candidate, fallback) {
      if (isObject(fallback)) {
        const source = isObject(candidate) ? candidate : {};
        const result = {};
        Object.keys(fallback).forEach((key) => {
          defineOwnValue(result, key, sanitizeStyleTree(source[key], fallback[key]));
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
    function defineOwnValue(target, key, value) {
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true
      });
    }
    function pathValue(target, key) {
      if (isObject(target)) return target[key];
      if (Array.isArray(target)) return Reflect.get(target, key);
      return void 0;
    }
    function setByPath(target, path, value) {
      const parts = String(path || "").split(".");
      if (parts.some(isUnsafeConfigPathKey) || !isObject(target) && !Array.isArray(target)) return;
      let cursor = target;
      for (let index = 0; index < parts.length - 1; index++) {
        const key2 = parts[index], nextKey = parts[index + 1];
        if (key2 === void 0 || nextKey === void 0) return;
        const current = Object.prototype.hasOwnProperty.call(cursor, key2) ? pathValue(cursor, key2) : void 0;
        if (!isObject(current) && !Array.isArray(current)) defineOwnValue(cursor, key2, /^\d+$/.test(nextKey) ? [] : {});
        const child = pathValue(cursor, key2);
        if (!isObject(child) && !Array.isArray(child)) return;
        cursor = child;
      }
      const key = parts[parts.length - 1];
      if (key !== void 0) defineOwnValue(cursor, key, value);
    }
    function deleteByPath(target, path) {
      const parts = String(path || "").split(".");
      if (parts.some(isUnsafeConfigPathKey) || !isObject(target) && !Array.isArray(target)) return;
      let cursor = target;
      for (let index = 0; index < parts.length - 1; index++) {
        const key2 = parts[index];
        if (key2 === void 0) return;
        const current = Object.prototype.hasOwnProperty.call(cursor, key2) ? pathValue(cursor, key2) : void 0;
        if (!isObject(current) && !Array.isArray(current)) return;
        cursor = current;
      }
      const key = parts[parts.length - 1];
      if (key !== void 0 && Object.prototype.hasOwnProperty.call(cursor, key)) Reflect.deleteProperty(cursor, key);
    }
    function deepClone(value) {
      if (value === void 0) {
        return void 0;
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
      if (!isObject(a) || !isObject(b)) return false;
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) {
        return false;
      }
      return keysA.every((key) => deepEqual(a[key], b[key]));
    }
    function mergeDeep(base, override) {
      if (Array.isArray(base)) {
        return Array.isArray(override) ? deepClone(override) : deepClone(base);
      }
      if (!isObject(base)) {
        return override === void 0 ? deepClone(base) : deepClone(override);
      }
      const source = isObject(override) ? override : {};
      const result = {};
      const keys = /* @__PURE__ */ new Set([...Object.keys(base), ...Object.keys(source)]);
      keys.forEach((key) => {
        if (isUnsafeConfigPathKey(key)) {
          return;
        }
        const baseValue = base[key];
        const overrideValue = source[key];
        if (overrideValue === void 0) {
          result[key] = deepClone(baseValue);
        } else if (isObject(baseValue) && isObject(overrideValue)) {
          result[key] = mergeDeep(baseValue, overrideValue);
        } else {
          result[key] = deepClone(overrideValue);
        }
      });
      return result;
    }
    function compactConfig2(value) {
      return compactConfig(value);
    }
    function getByPath(target, path) {
      const parts = String(path || "").split(".");
      if (parts.some(isUnsafeConfigPathKey)) {
        return void 0;
      }
      let cursor = target;
      for (const key of parts) {
        if (!key || !isObject(cursor) && !Array.isArray(cursor)) {
          return void 0;
        }
        cursor = pathValue(cursor, key);
      }
      return cursor;
    }
    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }
    const COMPACT_CARD_MAX_WIDTH = 640;
    const COMPACT_CARD_MAX_COLUMNS = 6;
    const COMPACT_CARD_TILE_PARENT_RATIO = 0.62;
    function shouldUseCompactCardLayout({ mode, width, gridColumns, parentWidth } = {}) {
      const compactMode = String(mode || "auto").trim().toLowerCase();
      if (compactMode === "always" || compactMode === "true") {
        return true;
      }
      if (compactMode === "never" || compactMode === "false") {
        return false;
      }
      const columns = Number(gridColumns);
      if (Number.isFinite(columns) && columns > 0 && columns <= COMPACT_CARD_MAX_COLUMNS) {
        return true;
      }
      const measured = Number(width);
      if (Number.isFinite(measured) && measured > 0 && measured < COMPACT_CARD_MAX_WIDTH) {
        return true;
      }
      const parent = Number(parentWidth);
      if (Number.isFinite(measured) && measured > 0 && Number.isFinite(parent) && parent > measured && measured / parent <= COMPACT_CARD_TILE_PARENT_RATIO && measured < 900) {
        return true;
      }
      return false;
    }
    function resolveCompactLayoutParentWidth(host) {
      if (!host || typeof host !== "object") {
        return 0;
      }
      const candidates = [
        host.parentElement,
        typeof host.closest === "function" ? host.closest("hui-card, hui-grid-section, hui-section, .card, .column") : null,
        host.offsetParent && typeof host.offsetParent === "object" ? host.offsetParent : null
      ];
      for (const node of candidates) {
        const width = Math.round(Number(node?.clientWidth) || 0);
        if (width > 0) {
          return width;
        }
      }
      return 0;
    }
    function shouldShowCompactCardTitle(_options = {}) {
      return true;
    }
    function escapeHtml(value) {
      return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
    }
    function escapeSelectorValue(value) {
      return String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
    }
    function fireEvent(node, type, detail, options = {}) {
      const event = new CustomEvent(type, {
        bubbles: options.bubbles ?? true,
        cancelable: Boolean(options.cancelable),
        composed: options.composed ?? true,
        detail
      });
      node.dispatchEvent(event);
      return event;
    }
    function normalizeTextKey(value) {
      return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    }
    function stripEqualToDefaults(config, defaults) {
      if (defaults === void 0 || defaults === null) {
        return deepClone(config);
      }
      if (config === void 0 || config === null) {
        return void 0;
      }
      if (Array.isArray(config)) {
        return deepEqual(config, defaults) ? void 0 : deepClone(config);
      }
      if (isObject(config) && isObject(defaults)) {
        const out = {};
        for (const key of Object.keys(config)) {
          if (isUnsafeConfigPathKey(key)) continue;
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
            if (stripped !== void 0) {
              out[key] = stripped;
            }
          } else {
            out[key] = deepClone(cv);
          }
        }
        return Object.keys(out).length ? out : void 0;
      }
      return deepEqual(config, defaults) ? void 0 : config;
    }
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
        if (id === void 0) continue;
        const state = states[id];
        rows[index] = `${id}:${String(state?.attributes?.friendly_name ?? "")}:${String(state?.attributes?.icon ?? "")}`;
      }
      const tag = typeof window !== "undefined" && window.NodaliaI18n?.localeTag && window.NodaliaI18n?.resolveLanguage && typeof hass !== "undefined" ? window.NodaliaI18n.localeTag(window.NodaliaI18n.resolveLanguage(hass, language)) : "";
      return `${tag}|${rows.join("|")}`;
    }
    function editorStatesSignature(hass, language) {
      return editorFilteredStatesSignature(hass, language, () => true);
    }
    function editorSortLocale(hass, language) {
      if (typeof window !== "undefined" && window.NodaliaI18n?.resolveLanguage && window.NodaliaI18n?.localeTag) {
        return window.NodaliaI18n.localeTag(window.NodaliaI18n.resolveLanguage(hass, language ?? "auto"));
      }
      const raw = hass?.locale?.language || hass?.selectedLanguage || hass?.language;
      const s = String(raw || "").trim();
      return s || "en";
    }
    function normalizeHomeAssistantWebhookId(webhookId) {
      const raw = String(webhookId ?? "").trim();
      if (!raw) {
        return "";
      }
      if (/^https?:\/\//i.test(raw)) {
        try {
          const u = new URL(raw);
          const m = /\/api\/webhook\/([^/]+)/.exec(u.pathname);
          return m ? decodeURIComponent(m[1] ?? "") : "";
        } catch (_err) {
          return "";
        }
      }
      const pathSeg = raw.match(/(?:^|\/)api\/webhook\/([^/?#]+)/i);
      if (pathSeg) {
        return decodeURIComponent(pathSeg[1] ?? "");
      }
      return raw;
    }
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
          headers: { "Content-Type": "application/json" }
        })
      ).then(
        (result) => {
          const status = Number(isObject(result) ? result.status : void 0);
          if (Number.isFinite(status)) {
            return status >= 200 && status < 300;
          }
          return result != null;
        },
        () => false
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
          credentials: "same-origin"
        }).then(
          (res) => res.ok,
          () => false
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
          body: payloadJson
        }).then(
          (res) => res.ok ? true : postSameOrigin(),
          () => postSameOrigin()
        );
      };
      const postViaHttp = () => postSameOrigin().then((ok) => ok ? true : postViaAuthFetch());
      if (hass && typeof hass.callWS === "function") {
        return postHomeAssistantWebhookViaWebSocket(hass, id, payloadJson).then(
          (ok) => ok ? true : postViaHttp()
        );
      }
      return postViaHttp();
    }
    function warnStrictServiceDenied(cardLabel, serviceValue) {
      const service = String(serviceValue || "").trim();
      if (!service) {
        return;
      }
      if (typeof console === "undefined" || typeof console.warn !== "function") {
        return;
      }
      console.warn(
        `${String(cardLabel || "Nodalia card")}: service blocked by strict_service_actions — not listed under security.allowed_services or security.allowed_service_domains: ${service}`
      );
    }
    function getEntityFriendlyName(hass, entityId) {
      const id = String(entityId || "").trim();
      if (!id || !hass?.states?.[id]) {
        return "";
      }
      return String(hass.states[id].attributes?.friendly_name || "").trim();
    }
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
      const previousFriendly = previousEntity ? getEntityFriendlyName(hass, previousEntity) || previousEntity : "";
      const shouldApply = !currentName || previousEntity && (currentName === previousEntity || currentName === previousFriendly);
      if (shouldApply) {
        config.name = fallback;
      }
      return config;
    }
    function dedupeCustomCardsArray(cards) {
      if (!Array.isArray(cards)) {
        return [];
      }
      const seen = /* @__PURE__ */ new Set();
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
    function normalizeEntityDomains(domains) {
      return (Array.isArray(domains) ? domains : [domains]).map((domain) => String(domain || "").trim().toLowerCase()).filter(Boolean);
    }
    function entityMatchesDomains(entityId, domains = []) {
      const normalizedId = String(entityId || "").trim();
      const normalizedDomains = normalizeEntityDomains(domains);
      if (!normalizedId || !normalizedId.includes(".")) {
        return false;
      }
      return !normalizedDomains.length || normalizedDomains.includes(normalizedId.slice(0, normalizedId.indexOf(".")).toLowerCase());
    }
    function findStubEntityIds(hass, entities = [], entitiesFallback = [], domains = [], limit = 1) {
      const states = hass?.states || {};
      const maxItems = Math.max(0, Number(limit) || 0);
      if (!maxItems) {
        return [];
      }
      const selected = Array.isArray(entities) ? entities : [];
      const fallback = Array.isArray(entitiesFallback) ? entitiesFallback : [];
      const candidates = [...selected, ...fallback, ...Object.keys(states)];
      const result = [];
      const seen = /* @__PURE__ */ new Set();
      for (const candidate of candidates) {
        const entityId = String(candidate || "").trim();
        if (seen.has(entityId) || !Object.prototype.hasOwnProperty.call(states, entityId) || !entityMatchesDomains(entityId, domains)) {
          continue;
        }
        seen.add(entityId);
        result.push(entityId);
        if (result.length >= maxItems) {
          break;
        }
      }
      return result;
    }
    function createEntitySuggestion(cardType, hass, entityId, options = {}) {
      const type = String(cardType || "").trim();
      const normalizedId = String(entityId || "").trim();
      if (!type || !Object.prototype.hasOwnProperty.call(hass?.states || {}, normalizedId) || !entityMatchesDomains(normalizedId, options.domains) || typeof options.isSupported === "function" && !options.isSupported(hass, normalizedId)) {
        return null;
      }
      const suggestedConfig = typeof options.buildConfig === "function" ? options.buildConfig(hass, normalizedId) : { entity: normalizedId };
      if (!suggestedConfig || typeof suggestedConfig !== "object" || Array.isArray(suggestedConfig)) {
        return null;
      }
      const suggestion = {
        config: {
          ...suggestedConfig,
          type: `custom:${type}`
        }
      };
      const label = String(options.label || "").trim();
      if (label) {
        suggestion.label = label;
      }
      return suggestion;
    }
    function registerCustomCard(metadata) {
      if (typeof window === "undefined" || !isObject(metadata)) {
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
      const entry = { ...metadata, type };
      if (typeof entry.getEntitySuggestion !== "function" && type && typeof window.customElements?.get === "function") {
        const cardClass = window.customElements.get(type);
        if (cardClass && "getEntitySuggestion" in cardClass && typeof cardClass.getEntitySuggestion === "function") {
          const suggestion = cardClass.getEntitySuggestion;
          entry.getEntitySuggestion = (hass, entityId) => {
            const result = Reflect.apply(suggestion, cardClass, [hass, entityId]);
            return result;
          };
        }
      }
      cards.push(entry);
    }
    function defineLazyCustomElement(tag, loadClass, options = {}) {
      if (typeof customElements === "undefined" || !tag || typeof loadClass !== "function") {
        return;
      }
      if (customElements.get(tag)) {
        return;
      }
      const wrapperReleases = /* @__PURE__ */ new WeakMap();
      let realClass = null;
      const getReal = () => {
        if (!realClass) {
          realClass = loadClass();
        }
        return realClass;
      };
      function forwardLifecycle(name) {
        Object.defineProperty(NodaliaLazyHost.prototype, name, {
          configurable: true,
          enumerable: false,
          writable: true,
          value: function nodaliaLazyLifecycleForward(...args) {
            if (options.editorTag && name === "connectedCallback") {
              wrapperReleases.get(this)?.();
              wrapperReleases.set(this, normalizeCardLayoutWrapper(this));
            } else if (name === "disconnectedCallback") {
              wrapperReleases.get(this)?.();
              wrapperReleases.delete(this);
            }
            const Real = getReal();
            const prototype = Real.prototype;
            const fn = isObject(prototype) ? prototype[name] : void 0;
            if (typeof fn === "function") {
              const result = Reflect.apply(fn, this, args);
              return result;
            }
            return void 0;
          }
        });
      }
      class NodaliaLazyHost extends HTMLElement {
        constructor() {
          super();
          const Real = getReal();
          Object.setPrototypeOf(this, Real.prototype);
          if (typeof this._nodaliaConstruct === "function") {
            this._nodaliaConstruct();
          }
        }
      }
      for (const name of [
        "connectedCallback",
        "disconnectedCallback",
        "adoptedCallback",
        "attributeChangedCallback"
      ]) {
        forwardLifecycle(name);
      }
      Object.defineProperty(NodaliaLazyHost, "observedAttributes", {
        configurable: true,
        get() {
          const Real = getReal();
          return "observedAttributes" in Real && Array.isArray(Real.observedAttributes) ? Real.observedAttributes : [];
        }
      });
      const editorTag = String(options.editorTag || "").trim();
      Object.defineProperty(NodaliaLazyHost, "getConfigElement", {
        configurable: true,
        value: async function getConfigElement() {
          if (editorTag) {
            return document.createElement(editorTag);
          }
          const Real = getReal();
          if ("getConfigElement" in Real && typeof Real.getConfigElement === "function") {
            const result = Reflect.apply(Real.getConfigElement, Real, []);
            return result;
          }
          return void 0;
        }
      });
      for (const name of ["getStubConfig", "getEntitySuggestion"]) {
        Object.defineProperty(NodaliaLazyHost, name, {
          configurable: true,
          value: function lazyStaticForward(...args) {
            const Real = getReal();
            const fn = name in Real ? Reflect.get(Real, name) : void 0;
            const result = typeof fn === "function" ? Reflect.apply(fn, Real, args) : void 0;
            return result;
          }
        });
      }
      customElements.define(tag, NodaliaLazyHost);
    }
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
        const base = typeof window !== "undefined" && window.location ? window.location.origin : "https://example.invalid";
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
    const pickerCallbackState = /* @__PURE__ */ new WeakMap();
    const pickerControlsWithListeners = /* @__PURE__ */ new WeakSet();
    function dispatchPickerChange(ev) {
      const control = ev.currentTarget;
      if (!control) return;
      const s = pickerCallbackState.get(control);
      if (s && typeof s.onShadowInput === "function") {
        s.onShadowInput(ev);
      }
    }
    function dispatchPickerValueChanged(ev) {
      const control = ev.currentTarget;
      if (!control) return;
      const s = pickerCallbackState.get(control);
      if (!s) {
        return;
      }
      const fn = s.onShadowValueChanged || s.onShadowInput;
      if (typeof fn === "function") {
        fn(ev);
      }
    }
    function mountEntityPickerHost(host, options) {
      if (!(host instanceof HTMLElement)) {
        return;
      }
      const hass = options.hass;
      const field = options.field || host.dataset.field || "entity";
      const nextValue = options.value !== void 0 ? String(options.value) : String(host.dataset.value || "");
      const placeholder = options.placeholder !== void 0 ? String(options.placeholder) : String(host.dataset.placeholder || "");
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
      let control = host.firstElementChild instanceof HTMLElement ? host.firstElementChild : null;
      const tag = control?.tagName || "";
      const matches = control && (desired === "picker" && tag === "HA-ENTITY-PICKER" || desired === "selector" && tag === "HA-SELECTOR" || desired === "input" && tag === "INPUT");
      if (!matches) {
        host.replaceChildren();
        if (usePicker) {
          control = document.createElement("ha-entity-picker");
          Object.assign(control, { allowCustomEntity: true });
        } else if (useSelector) {
          control = document.createElement("ha-selector");
          Object.assign(control, { selector: { entity: {} } });
        } else {
          control = document.createElement("input");
          Object.assign(control, { type: "text" });
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
      if (!control) return;
      control.dataset.field = field;
      control.dataset.value = nextValue;
      if (!control) return;
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
        { v: "4px", l: tSquare }
      ];
      const inStandard = STANDARD.some((p) => p.v === current);
      const presets = inStandard ? STANDARD : [{ v: current, l: esc(current) }, ...STANDARD];
      const group = `nodalia-cbr-${Math.random().toString(36).slice(2, 11)}`;
      const optionsHtml = presets.map((p) => {
        const checked = current === p.v ? " checked" : "";
        return `
      <label class="editor-chip-radius__option">
        <input type="radio" name="${esc(group)}" data-field="${esc(field)}" data-value-type="string" value="${esc(p.v)}"${checked} />
        <span>${p.l}</span>
      </label>`;
      }).join("");
      return `
    <div class="editor-field editor-field--full editor-chip-radius">
      <span>${tHeading}</span>
      <div class="editor-chip-radius__options" role="radiogroup" aria-label="${tHeading}">
        ${optionsHtml}
      </div>
    </div>`;
    }
    function renderEditorCardBorderRadiusHtml(options) {
      const esc = options?.escapeHtml;
      if (typeof esc !== "function") {
        return "";
      }
      const fieldRaw = String(options?.field ?? "styles.card.border_radius").trim();
      const field = fieldRaw || "styles.card.border_radius";
      const FAMILY_RADIUS = "var(--nodalia-card-border-radius, 28px)";
      let current = String(options?.value ?? "").trim() || "28px";
      if (current === FAMILY_RADIUS) {
        current = "28px";
      }
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
        { v: "8px", l: tSquare }
      ];
      const inStandard = STANDARD.some((p) => p.v === current);
      const presets = inStandard ? STANDARD : [{ v: current, l: esc(current) }, ...STANDARD];
      const group = `nodalia-cbr-card-${Math.random().toString(36).slice(2, 11)}`;
      const optionsHtml = presets.map((p) => {
        const checked = current === p.v ? " checked" : "";
        return `
      <label class="editor-chip-radius__option">
        <input type="radio" name="${esc(group)}" data-field="${esc(field)}" data-value-type="string" value="${esc(p.v)}"${checked} />
        <span>${p.l}</span>
      </label>`;
      }).join("");
      return `
    <div class="editor-field editor-field--full editor-chip-radius">
      <span>${tHeading}</span>
      <div class="editor-chip-radius__options" role="radiogroup" aria-label="${tHeading}">
        ${optionsHtml}
      </div>
    </div>`;
    }
    const CARD_ZONE_DOUBLE_TAP_MS = 320;
    const CARD_TAP_ACTIONS = /* @__PURE__ */ new Set(["auto", "toggle", "more-info", "service", "navigate", "url", "none"]);
    function normalizeTapActionToken(raw) {
      return String(raw ?? "").trim().toLowerCase().replace(/_/g, "-");
    }
    function coerceCardTapAction(value, fallback = "auto") {
      if (value === void 0 || value === null || value === "") {
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
      if (dataPayload !== void 0 && dataPayload !== null && !String(config[serviceDataKey] || "").trim()) {
        config[serviceDataKey] = typeof dataPayload === "string" ? dataPayload : JSON.stringify(dataPayload);
      }
      if (rawValue.target !== void 0 && rawValue.target !== null && !String(config[serviceTargetKey] || "").trim()) {
        config[serviceTargetKey] = typeof rawValue.target === "string" ? rawValue.target : JSON.stringify(rawValue.target);
      }
      if (rawValue.new_tab !== void 0) {
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
          const result = target != null ? hass.callService(domain, service, payload, target) : hass.callService(domain, service, payload);
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
            target: target || void 0
          }
        }));
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }
    function escapeLovelaceWarningText(text) {
      return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
      return Boolean(isObject(registry) && registry[id]);
    }
    function getLovelaceEntityWarningMessage(hass, entityId) {
      const id = String(entityId ?? "").trim();
      if (!id) {
        return hass?.localize?.("ui.panel.lovelace.cards.show_entity_picker") ?? "No entity specified";
      }
      if (!isLovelaceHassStatesHydrated(hass)) {
        return "";
      }
      if (isLovelaceEntityKnown(hass, id)) {
        return "";
      }
      return hass?.localize?.("ui.components.entity.entity_not_found", { entity: id }) ?? hass?.localize?.("ui.card.common.entity_not_found") ?? `Entity not found: ${id}`;
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
        "1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent)"
      );
      const borderRadius = sanitizeCssValue(card.border_radius, "var(--ha-card-border-radius, 12px)");
      const boxShadow = sanitizeCssValue(card.box_shadow, "var(--ha-card-box-shadow, none)");
      const padding = sanitizeCssValue(card.padding, "16px");
      return `<style>${utils_empty_state_default}[class$="--empty"]{background:${background};border:${border};border-radius:${borderRadius};box-shadow:${boxShadow};padding:${padding};}</style>${markup}`;
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
    function renderLovelaceEntityGuardForEntities(hass, entityIds, options = {}) {
      const ids = (Array.isArray(entityIds) ? entityIds : [entityIds]).map((id) => String(id ?? "").trim());
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
      const escapeHtml2 = options.escapeHtml;
      const toggleId = String(options.toggleId ?? "").trim().replace(/"/g, "");
      if (typeof escapeHtml2 !== "function" || !toggleId) {
        return "";
      }
      const expanded = options.expanded === true;
      const showLabel = escapeHtml2(String(options.showLabel ?? "Show"));
      const hideLabel = escapeHtml2(String(options.hideLabel ?? "Hide"));
      const label = expanded ? hideLabel : showLabel;
      return `<button type="button" class="editor-section__toggle-button" data-editor-toggle="${toggleId}" aria-expanded="${expanded ? "true" : "false"}"><ha-icon icon="${expanded ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon><span>${label}</span></button>`;
    }
    function renderEditorCollapsibleSectionHeaderHtml(options = {}) {
      const escapeHtml2 = options.escapeHtml;
      const editorLabel = options.editorLabel;
      if (typeof escapeHtml2 !== "function" || typeof editorLabel !== "function") {
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
        escapeHtml: escapeHtml2
      });
      return `<div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml2(editorLabel(titleKey))}</div>
            <div class="editor-section__hint">${escapeHtml2(editorLabel(hintKey))}</div>
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
      "__circular-dial",
      "__circular-hit",
      "__circular-step"
    ];
    function isNodaliaSliderChromeHit(event) {
      const path = typeof event?.composedPath === "function" ? event.composedPath() : [];
      for (const node of path) {
        if (!(node instanceof Element)) {
          continue;
        }
        if (node instanceof HTMLElement && node.dataset?.nodaliaTapShield === "true") {
          return true;
        }
        const className = typeof node.className === "string" ? node.className : String(node.getAttribute?.("class") || "");
        if (className && NODALIA_SLIDER_CHROME_CLASS_MARKERS.some((marker) => className.includes(marker))) {
          return true;
        }
      }
      return false;
    }
    function isElementHost(node) {
      return node instanceof HTMLElement || Boolean(node) && typeof node === "object" && isObject(node) && node.nodeType === 1 && typeof node.addEventListener === "function";
    }
    function scheduleCardZoneTap(host, options) {
      if (!isElementHost(host)) {
        return;
      }
      const zone = String(options?.zone ?? "body");
      const delayMs = Number.isFinite(Number(options?.doubleTapMs)) && Number(options.doubleTapMs) > 0 ? Math.round(Number(options.doubleTapMs)) : CARD_ZONE_DOUBLE_TAP_MS;
      const onSingle = typeof options?.onSingle === "function" ? options.onSingle : () => {
      };
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
        if (host.isConnected === false) return;
        onSingle();
      }, delayMs);
    }
    function bindHostPointerHoldGesture(host, options) {
      if (!isElementHost(host)) {
        return () => {
        };
      }
      if (typeof options?.resolveZone !== "function" || typeof options?.onHold !== "function") {
        return () => {
        };
      }
      const holdMs = Number.isFinite(Number(options.holdMs)) && Number(options.holdMs) > 0 ? Math.round(Number(options.holdMs)) : 500;
      const moveTol = Number.isFinite(Number(options.moveTolerancePx)) && Number(options.moveTolerancePx) > 0 ? Number(options.moveTolerancePx) : 12;
      const shouldBeginHold = typeof options.shouldBeginHold === "function" ? options.shouldBeginHold : () => true;
      const markHoldConsumedClick = typeof options.markHoldConsumedClick === "function" ? options.markHoldConsumedClick : () => {
      };
      let timer = null;
      let active = null;
      function clearWindowListeners() {
        window.removeEventListener("pointerup", onWindowPointerUp, true);
        window.removeEventListener("pointercancel", onWindowPointerUp, true);
        window.removeEventListener("pointermove", onWindowPointerMove, { capture: true });
        window.removeEventListener("blur", resetTracking);
        if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      function resetTracking() {
        if (timer) {
          window.clearTimeout(timer);
          timer = null;
        }
        clearWindowListeners();
        active = null;
      }
      function onVisibilityChange() {
        if (document.hidden) resetTracking();
      }
      function onWindowPointerMove(ev) {
        if (!(ev instanceof PointerEvent)) return;
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
        if (!(ev instanceof PointerEvent)) return;
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
          zone
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
        window.addEventListener("pointerup", onWindowPointerUp, true);
        window.addEventListener("pointercancel", onWindowPointerUp, true);
        window.addEventListener("pointermove", onWindowPointerMove, { passive: true, capture: true });
        window.addEventListener("blur", resetTracking);
        if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);
      }
      let attached = false;
      const reconnect = () => {
        if (attached) {
          return;
        }
        host.addEventListener("pointerdown", onPointerDownCapture, true);
        attached = true;
      };
      const disconnect = () => {
        if (attached) {
          host.removeEventListener("pointerdown", onPointerDownCapture, true);
          attached = false;
        }
        resetTracking();
      };
      disconnect.reconnect = reconnect;
      reconnect();
      return disconnect;
    }
    const POINTER_FOCUSABLE_SELECTOR = [
      "button",
      "a[href]",
      "summary",
      "[role='button']",
      "[tabindex]:not([tabindex='-1'])"
    ].join(",");
    function installPointerFocusRingGuard() {
      if (typeof window === "undefined" || typeof document === "undefined" || typeof document.addEventListener !== "function") {
        return false;
      }
      if (window.__nodaliaPointerFocusRingGuardInstalled === true) {
        return true;
      }
      const inlineOutlineState = /* @__PURE__ */ new WeakMap();
      let pointerFocusedElement = null;
      const restoreOutline = (element) => {
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
      const suppressOutline = (element) => {
        if (!(typeof HTMLElement !== "undefined" && element instanceof HTMLElement)) {
          return;
        }
        if (pointerFocusedElement && pointerFocusedElement !== element) {
          restoreOutline(pointerFocusedElement);
        }
        if (!inlineOutlineState.has(element)) {
          inlineOutlineState.set(element, {
            priority: element.style.getPropertyPriority("outline"),
            value: element.style.getPropertyValue("outline")
          });
        }
        element.setAttribute("data-nodalia-pointer-focus", "");
        element.style.setProperty("outline", "none", "important");
        pointerFocusedElement = element;
      };
      document.addEventListener("pointerdown", (event) => {
        if (typeof event.button === "number" && event.button !== 0) {
          return;
        }
        const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
        const belongsToNodalia = path.some((node) => typeof HTMLElement !== "undefined" && node instanceof HTMLElement && String(node.tagName || "").startsWith("NODALIA-"));
        if (!belongsToNodalia) {
          return;
        }
        const target = path.find((node) => typeof HTMLElement !== "undefined" && node instanceof HTMLElement && typeof node.matches === "function" && node.matches(POINTER_FOCUSABLE_SELECTOR));
        if (target) {
          suppressOutline(target);
        }
      }, true);
      document.addEventListener("keydown", () => {
        restoreOutline(pointerFocusedElement);
      }, true);
      document.addEventListener("focusout", (event) => {
        const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
        if (pointerFocusedElement && path.includes(pointerFocusedElement)) {
          restoreOutline(pointerFocusedElement);
        }
      }, true);
      window.__nodaliaPointerFocusRingGuardInstalled = true;
      return true;
    }
    function isKeyboardActivationEvent(event) {
      if (!(event instanceof KeyboardEvent)) return false;
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
    const modalFocusState = /* @__PURE__ */ new WeakMap();
    const MODAL_FOCUSABLE_SELECTOR = [
      "button:not([disabled])",
      "[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])"
    ].join(",");
    function modalFocusableElements(dialog) {
      if (!(dialog instanceof HTMLElement)) {
        return [];
      }
      return Array.from(dialog.querySelectorAll(MODAL_FOCUSABLE_SELECTOR)).filter((element) => element instanceof HTMLElement && element.hidden !== true && element.getAttribute("aria-hidden") !== "true");
    }
    function modalActiveElement() {
      let active = document.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      return active;
    }
    function bindModalFocus(host, dialog, options = {}) {
      if (!(host instanceof HTMLElement) || !(dialog instanceof HTMLElement)) {
        return () => {
        };
      }
      const previousState = modalFocusState.get(host);
      const activeElement = modalActiveElement();
      const previousFocus = previousState?.previousFocus || (activeElement instanceof HTMLElement ? activeElement : null);
      if (previousState) {
        previousState.dialog.removeEventListener("keydown", previousState.onKeyDown);
        if (previousState.focusTimer) {
          window.clearTimeout(previousState.focusTimer);
        }
      }
      const onKeyDown = (event) => {
        if (!(event instanceof KeyboardEvent)) return;
        if (event.key !== "Tab") {
          return;
        }
        const focusable = modalFocusableElements(dialog);
        if (!focusable.length) {
          event.preventDefault();
          dialog.focus({ preventScroll: true });
          return;
        }
        const root = dialog.getRootNode();
        const active = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
        const index = active instanceof HTMLElement ? focusable.indexOf(active) : -1;
        const next = index < 0 ? event.shiftKey ? focusable.length - 1 : 0 : (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
        event.preventDefault();
        focusable[next]?.focus({ preventScroll: true });
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
        focusTimer: 0
      };
      modalFocusState.set(host, state);
      state.focusTimer = window.setTimeout(() => {
        state.focusTimer = 0;
        if (modalFocusState.get(host) !== state || !dialog.isConnected) {
          return;
        }
        const requested = options.initialFocusSelector ? dialog.querySelector(options.initialFocusSelector) : null;
        const target = requested instanceof HTMLElement ? requested : modalFocusableElements(dialog)[0] || dialog;
        target.focus({ preventScroll: true });
      }, 0);
      return () => {
        if (modalFocusState.get(host) === state) releaseModalFocus(host);
      };
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
      const nextValue = options.value !== void 0 ? String(options.value) : String(host.dataset.value || "");
      const placeholder = options.placeholder !== void 0 ? options.placeholder : host.dataset.placeholder || "";
      const onShadowInput = options.onShadowInput;
      const onShadowValueChanged = options.onShadowValueChanged;
      const copyDatasetFromHost = options.copyDatasetFromHost !== false;
      const useIconPicker = typeof customElements !== "undefined" && customElements.get("ha-icon-picker");
      const desired = useIconPicker ? "icon" : "input";
      let control = host.firstElementChild instanceof HTMLElement ? host.firstElementChild : null;
      const tag = control?.tagName || "";
      const matches = control && (desired === "icon" && tag === "HA-ICON-PICKER" || desired === "input" && tag === "INPUT");
      if (!matches) {
        host.replaceChildren();
        if (useIconPicker) {
          control = document.createElement("ha-icon-picker");
        } else {
          control = document.createElement("input");
          Object.assign(control, { type: "text" });
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
      if (!control) return;
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
    const deferTimers = /* @__PURE__ */ new WeakMap();
    function ownedDeferTimers(host) {
      let timers = deferTimers.get(host);
      if (!timers) {
        timers = /* @__PURE__ */ new Set();
        deferTimers.set(host, timers);
        Object.defineProperty(host, "_nodaliaDeferTimers", { value: timers, writable: true, configurable: true, enumerable: true });
      }
      return timers;
    }
    function clearDeferTimers(host) {
      const timers = deferTimers.get(host);
      if (!timers) return;
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    }
    function normalizeSecurityConfig(security = {}, defaults = {}) {
      const base = {
        strict_service_actions: true,
        allowed_services: [],
        allowed_service_domains: [],
        ...isObject(defaults) ? defaults : {}
      };
      const src = isObject(security) ? security : {};
      const normalized = { ...base };
      normalized.strict_service_actions = src.strict_service_actions === void 0 ? base.strict_service_actions === true : src.strict_service_actions === true;
      if (src.allow_webhooks_for_non_admin !== void 0 || base.allow_webhooks_for_non_admin !== void 0) {
        normalized.allow_webhooks_for_non_admin = src.allow_webhooks_for_non_admin === void 0 ? base.allow_webhooks_for_non_admin === true : src.allow_webhooks_for_non_admin === true;
      }
      if (Array.isArray(src.allowed_services)) {
        normalized.allowed_services = src.allowed_services.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
      }
      if (Array.isArray(src.allowed_service_domains)) {
        normalized.allowed_service_domains = src.allowed_service_domains.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
      }
      return normalized;
    }
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
        node.getAttribute?.("part") || ""
      ].join(" ").toLowerCase();
      return marker.includes("preview") || marker.includes("card-preview");
    }
    function getEditorDialogPreviewPanes(editorHost) {
      const pane = findLovelaceElementEditorPane(editorHost);
      const nodes = [];
      const seen = /* @__PURE__ */ new Set();
      const add = (node2) => {
        if (!(node2 instanceof HTMLElement) || seen.has(node2) || node2 === pane || node2.contains(editorHost)) {
          return;
        }
        seen.add(node2);
        nodes.push(node2);
      };
      let node = pane;
      while (node) {
        const parent = getComposedParentElement(node);
        if (!parent) {
          break;
        }
        Array.from(parent.children || []).forEach((child) => {
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
        overflowAnchor: pane.style.overflowAnchor
      };
      const scrollAncestors = getEditorDialogScrollAncestors(editorHost);
      const previewPanes = getEditorDialogPreviewPanes(editorHost);
      const previousAncestors = scrollAncestors.map((node) => ({
        node,
        overscrollBehaviorY: node.style.overscrollBehaviorY,
        overflowAnchor: node.style.overflowAnchor
      }));
      const previousPreviewPanes = previewPanes.map((node) => ({
        node,
        overscrollBehaviorY: node.style.overscrollBehaviorY,
        overflowAnchor: node.style.overflowAnchor,
        overflowY: node.style.overflowY,
        scrollTop: node.scrollTop
      }));
      pane.style.alignSelf = "flex-start";
      pane.style.height = "auto";
      pane.style.minHeight = "0";
      const viewportHeightUnit = typeof CSS !== "undefined" && CSS.supports?.("height", "100dvh") ? "100dvh" : "100vh";
      pane.style.maxHeight = `var(--code-mirror-max-height, calc(${viewportHeightUnit} - 209px))`;
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
      const onPreviewWheel = (event) => {
        if (!(event instanceof WheelEvent)) return;
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
      scrollAncestors.forEach((node) => node.addEventListener("scroll", onScroll, { passive: true }));
      previewPanes.forEach((node) => node.addEventListener("wheel", onPreviewWheel, { passive: false }));
      editorHost._nodaliaEditorDialogLayoutPane = pane;
      editorHost._nodaliaEditorDialogLayoutRelease = () => {
        window.removeEventListener("scroll", onScroll, true);
        scrollAncestors.forEach((node) => node.removeEventListener("scroll", onScroll));
        previewPanes.forEach((node) => node.removeEventListener("wheel", onPreviewWheel));
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
      if (editorHost?._nodaliaEditorDialogLayoutFrame) {
        window.cancelAnimationFrame(editorHost._nodaliaEditorDialogLayoutFrame);
        editorHost._nodaliaEditorDialogLayoutFrame = 0;
      }
      if (editorHost?._nodaliaEditorDialogLayoutRelease) {
        editorHost._nodaliaEditorDialogLayoutRelease();
        editorHost._nodaliaEditorDialogLayoutRelease = null;
      }
    }
    function runEditorDialogScrollClamp(editorHost) {
      if (!(editorHost instanceof HTMLElement) || !editorHost.isConnected || findParentNodaliaEditorHost(editorHost)) {
        return;
      }
      const editorContent = editorHost.shadowRoot?.querySelector(".editor") || editorHost;
      const contentRect = editorContent instanceof HTMLElement ? editorContent.getBoundingClientRect() : null;
      const nodes = getEditorDialogScrollAncestors(editorHost);
      for (const node of nodes) {
        const style = getComputedStyle(node);
        const scrollable = /(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
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
      getEditorDialogPreviewPanes(editorHost).forEach((node) => {
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
      return deltaY > 0 ? node.scrollTop < maxScroll - 1 : node.scrollTop > 1;
    }
    function clampEditorDialogScroll(editorHost) {
      if (!(editorHost instanceof HTMLElement) || typeof window === "undefined") {
        return;
      }
      if (editorHost._nodaliaEditorDialogLayoutFrame) return;
      const frame = window.requestAnimationFrame(() => {
        if (editorHost._nodaliaEditorDialogLayoutFrame !== frame) return;
        editorHost._nodaliaEditorDialogLayoutFrame = 0;
        if (!editorHost.isConnected) {
          return;
        }
        bindEditorDialogLayoutFix(editorHost);
        runEditorDialogScrollClamp(editorHost);
      });
      editorHost._nodaliaEditorDialogLayoutFrame = frame;
    }
    function scheduleDeferTimer(host, callback, delayMs) {
      const timers = ownedDeferTimers(host);
      const timer = window.setTimeout(() => {
        if (!timers.delete(timer)) return;
        callback();
      }, delayMs);
      timers.add(timer);
      return timer;
    }
    function isEditorTextControl(value) {
      return typeof HTMLInputElement !== "undefined" && value instanceof HTMLInputElement || typeof HTMLTextAreaElement !== "undefined" && value instanceof HTMLTextAreaElement || typeof HTMLSelectElement !== "undefined" && value instanceof HTMLSelectElement;
    }
    function captureEditorFocusState(editorHost) {
      const activeElement = editorHost?.shadowRoot?.activeElement;
      if (!isEditorTextControl(activeElement)) {
        return null;
      }
      const field = String(activeElement.dataset?.field || "");
      if (!field) {
        return null;
      }
      const supportsSelection = !(activeElement instanceof HTMLSelectElement) && typeof activeElement.selectionStart === "number" && typeof activeElement.selectionEnd === "number";
      return {
        selector: `[data-field="${escapeSelectorValue(field)}"]`,
        selectionEnd: supportsSelection && !(activeElement instanceof HTMLSelectElement) ? activeElement.selectionEnd : null,
        selectionStart: supportsSelection && !(activeElement instanceof HTMLSelectElement) ? activeElement.selectionStart : null,
        type: activeElement.type
      };
    }
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
      const canRestoreSelection = !(target instanceof HTMLSelectElement) && focusState.type !== "checkbox" && typeof focusState.selectionStart === "number" && typeof focusState.selectionEnd === "number" && typeof target.setSelectionRange === "function";
      if (!canRestoreSelection || target instanceof HTMLSelectElement) {
        return;
      }
      try {
        target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
      } catch (_error) {
      }
    }
    const isListenerTuple = (item) => Array.isArray(item);
    function bindShadowListeners(host, listeners, key = "editor") {
      const root = host?.shadowRoot;
      if (!root || !Array.isArray(listeners)) return false;
      const groups = host._nodaliaShadowListenerGroups ?? /* @__PURE__ */ new Map();
      host._nodaliaShadowListenerGroups = groups;
      if (groups.has(key)) return false;
      const active = listeners.map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = isListenerTuple(item) ? { type: item[0], listener: item[1], options: item[2] } : { type: item.type, listener: item.listener, options: item.options };
        return typeof row.type === "string" && typeof row.listener === "function" ? row : null;
      }).filter((item) => item !== null);
      active.forEach((item) => root.addEventListener(item.type, item.listener, item.options));
      groups.set(key, { root, listeners: active });
      return true;
    }
    function releaseShadowListeners(host, key = "editor") {
      const groups = host?._nodaliaShadowListenerGroups;
      const group = groups?.get(key);
      if (!group) return false;
      group.listeners.forEach((item) => group.root.removeEventListener(item.type, item.listener, item.options));
      groups?.delete(key);
      return true;
    }
    function applyLabelValues(text, values = {}) {
      return String(text ?? "").replace(/\{([a-zA-Z0-9_]+)\}/g, (match, token) => Object.prototype.hasOwnProperty.call(values, token) ? String(values[token] ?? "") : match);
    }
    function engineStatusSignature(engineValue) {
      if (!engineValue) return "";
      const engine = isObject(engineValue) ? engineValue : {};
      const caps = isObject(engine.caps) ? engine.caps : {};
      const health = isObject(engine.health) ? engine.health : {};
      return [
        engine.available === true ? "1" : "0",
        String(engine.version || ""),
        caps.notificationsBackground === true ? "1" : "0",
        caps.notificationsInbox === true ? "1" : "0",
        caps.climateSchedules === true ? "1" : "0",
        caps.climateOverrides === true ? "1" : "0",
        Number(health.profile_count) || 0,
        Number(health.schedule_count) || 0,
        Number(health.inbox_count) || 0,
        Number(health.override_count) || 0
      ].join("|");
    }
    function renderEditorEngineBannerStyles() {
      return utils_engine_banner_default;
    }
    function renderEditorEngineBannerHtml(options = {}) {
      const engine = isObject(options.engine) ? options.engine : {};
      const label = (key) => {
        const value = options.label;
        return typeof value === "function" ? String(value(key)) : key;
      };
      if (!engine || engine.available !== true) {
        return "";
      }
      const health = isObject(engine.health) ? engine.health : {};
      const version = applyLabelValues(label("ed.engine.active_version"), { version: engine.version || "—" });
      const summary = applyLabelValues(label("ed.engine.health_summary"), {
        profiles: Number(health.profile_count) || 0,
        schedules: Number(health.schedule_count) || 0,
        inbox: Number(health.inbox_count) || 0
      });
      const extraRows = (Array.isArray(options.extraRows) ? options.extraRows : []).filter((row) => typeof row === "string" && row.trim() !== "").map((row) => `<div class="editor-engine-banner__meta">${escapeHtml(row)}</div>`).join("");
      return `
      <div class="editor-engine-banner ${options.fullWidthClass || "editor-field--full"}">
        <ha-icon icon="mdi:shield-check-outline"></ha-icon>
        <div class="editor-engine-banner__copy">
          <div class="editor-engine-banner__title">${escapeHtml(label("ed.engine.active_title"))}</div>
          <div class="editor-engine-banner__meta">${escapeHtml(version)}</div>
          <div class="editor-engine-banner__meta">${escapeHtml(summary)}</div>
          ${extraRows}
        </div>
      </div>
    `;
    }
    function renderReducedMotionStyles() {
      return utils_reduced_motion_default;
    }
    function composeCardSurfaceBackground(options = {}) {
      const base = String(options.base || "var(--ha-card-background)").trim() || "var(--ha-card-background)";
      const accentColor = String(options.accentColor || "var(--primary-color)").trim() || "var(--primary-color)";
      const glazeStrengthRaw = Number(options.glazeStrength);
      const glazeStrength = Number.isFinite(glazeStrengthRaw) ? Math.max(0, glazeStrengthRaw) : 22;
      const glazeNeutralStrengthRaw = Number(options.glazeNeutralStrength);
      const glazeNeutralStrength = Number.isFinite(glazeNeutralStrengthRaw) ? Math.max(0, glazeNeutralStrengthRaw) : 5;
      const glazeMode = options.glazeMode === "neutral" || options.glazeMode === "none" ? options.glazeMode : "accent";
      const extraLayers = Array.isArray(options.extraLayers) ? options.extraLayers.filter((layer) => typeof layer === "string" && layer.trim() !== "") : [];
      const layers = [...extraLayers];
      if (glazeMode === "accent" && glazeStrength > 0) {
        const textWash = Number.isFinite(Number(options.glazeTextWash)) ? Math.max(0, Number(options.glazeTextWash)) : 6;
        layers.push(
          `linear-gradient(180deg, color-mix(in srgb, ${accentColor} ${glazeStrength}%, color-mix(in srgb, var(--primary-text-color) ${textWash}%, transparent)), rgba(255, 255, 255, 0))`
        );
      } else if (glazeMode === "neutral" && glazeNeutralStrength > 0) {
        layers.push(
          `linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) ${glazeNeutralStrength}%, transparent), rgba(255, 255, 255, 0))`
        );
      }
      layers.push(base);
      return layers.join(", ");
    }
    const api = {
      isObject,
      isUnsafeConfigPathKey,
      setByPath,
      deleteByPath,
      deepClone,
      deepEqual,
      mergeDeep,
      compactConfig: compactConfig2,
      shouldUseCompactCardLayout,
      resolveCompactLayoutParentWidth,
      shouldShowCompactCardTitle,
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
      findStubEntityIds,
      createEntitySuggestion,
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
      applyLabelValues,
      engineStatusSignature,
      renderEditorEngineBannerStyles,
      renderEditorEngineBannerHtml,
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
      composeCardSurfaceBackground,
      captureEditorFocusState,
      restoreEditorFocusState,
      bindShadowListeners,
      releaseShadowListeners,
      scheduleDeferTimer,
      clearDeferTimers,
      normalizeSecurityConfig,
      defineLazyCustomElement
    };
    if (typeof window !== "undefined") {
      ensureCustomCardsDeduped();
      window.NodaliaUtils = api;
      installPointerFocusRingGuard();
    }
  })();
})();
