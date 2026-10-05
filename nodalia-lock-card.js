/* Generated from src/cards/lock. Do not edit. */
"use strict";
(() => {
  // src/cards/lock/lock-styles.ts
  var DEFAULT_LOCK_STYLES = {
    card: {
      background: "var(--ha-card-background, var(--card-background-color, #1c1c20))",
      border: "1px solid var(--divider-color, #ffffff18)",
      border_radius: "var(--nodalia-card-border-radius, 28px)",
      box_shadow: "var(--ha-card-box-shadow, 0 8px 24px #0002)",
      padding: "var(--lock-card-padding, 16px)",
      gap: "var(--lock-card-gap, 14px)"
    },
    icon: {
      size: "var(--lock-icon-size, 38px)",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      on_color: "var(--success-color, #6acb9a)",
      off_color: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))"
    },
    control: {
      size: "var(--lock-handle-default, 42px)",
      background: "color-mix(in srgb, var(--primary-text-color) 8%, var(--lock-surface))"
    },
    chip_border_radius: "999px",
    title_size: "13px",
    chip_font_size: "11px"
  };
  function normalizeLockStyles(value) {
    const utils = window.NodaliaUtils;
    const source = utils.isObject(value) ? value : {};
    const read = (group, key, fallback) => utils.sanitizeCssValue(utils.isObject(group) ? group[key] : void 0, fallback);
    const defaults = DEFAULT_LOCK_STYLES;
    return {
      card: {
        background: read(source.card, "background", defaults.card.background),
        border: read(source.card, "border", defaults.card.border),
        border_radius: read(source.card, "border_radius", defaults.card.border_radius),
        box_shadow: read(source.card, "box_shadow", defaults.card.box_shadow),
        padding: read(source.card, "padding", defaults.card.padding),
        gap: read(source.card, "gap", defaults.card.gap)
      },
      icon: {
        size: read(source.icon, "size", defaults.icon.size),
        background: read(source.icon, "background", defaults.icon.background),
        on_color: read(source.icon, "on_color", defaults.icon.on_color),
        off_color: read(source.icon, "off_color", defaults.icon.off_color)
      },
      control: {
        size: read(source.control, "size", defaults.control.size),
        background: read(source.control, "background", defaults.control.background)
      },
      chip_border_radius: read(source, "chip_border_radius", defaults.chip_border_radius),
      title_size: read(source, "title_size", defaults.title_size),
      chip_font_size: read(source, "chip_font_size", defaults.chip_font_size)
    };
  }

  // src/version.ts
  var CARD_VERSION = "3.0.0-alpha.9";

  // src/cards/lock/lock-config.ts
  var CARD_TAG = "nodalia-lock-card";
  var EDITOR_TAG = "nodalia-lock-card-editor";
  function normalizeConfig(config) {
    if (!config || typeof config.entity !== "string" || !/^lock\.[a-z0-9_]+$/.test(config.entity)) {
      throw new Error("A lock entity is required");
    }
    if (config.unlock_action && config.unlock_action !== "slider") throw new Error("Unlocking requires the slider");
    return {
      ...config,
      entity: config.entity,
      layout: config.layout === "compact" ? "compact" : "standard",
      unlock_action: "slider",
      show_name: config.show_name !== false,
      show_state: config.show_state !== false,
      styles: normalizeLockStyles(config.styles)
    };
  }

  // src/shared/hass-context.ts
  var captureHassContext = (hass) => ({
    present: Boolean(hass),
    connection: hass?.connection,
    auth: hass?.auth,
    user: hass?.user?.id || "",
    admin: hass?.user?.is_admin === true
  });
  var sameHassContext = (a, b) => a.present === b.present && a.connection === b.connection && a.auth === b.auth && a.user === b.user && a.admin === b.admin;

  // src/cards/lock/lock-strings.ts
  function lockText(hass, key) {
    const language = window.NodaliaI18n?.resolveLanguage?.(hass) || "en";
    const strings = window.NodaliaI18n?.strings?.(language)?.lock;
    const fallback = window.NodaliaI18n?.strings?.("en")?.lock;
    return strings?.[key] || fallback?.[key] || key;
  }

  // src/cards/lock/lock-card.ts
  function loadNodaliaLockCard() {
    class NodaliaLockCard extends HTMLElement {
      constructor() {
        super();
        this._nodaliaConstruct();
      }
      _nodaliaConstruct() {
        this.context = null;
        this.config = null;
        this.stateHass = null;
        this.pending = null;
        this.timer = 0;
        this.generation = 0;
        this.progress = 0;
        this.gesture = null;
        this.error = "";
        this.signature = "";
        this.attachShadow({ mode: "open" });
        this.shadowRoot.addEventListener("pointerdown", (event) => this.startDrag(event));
        this.shadowRoot.addEventListener("pointermove", (event) => this.moveDrag(event));
        this.shadowRoot.addEventListener("pointerup", (event) => this.endDrag(event));
        this.shadowRoot.addEventListener("pointercancel", () => this.cancelGesture());
        this.shadowRoot.addEventListener("lostpointercapture", () => this.cancelGesture());
        this.shadowRoot.addEventListener("keydown", (event) => this.keyGesture(event));
        this.shadowRoot.addEventListener("focusout", () => this.cancelGesture());
        this.shadowRoot.addEventListener("click", (event) => {
          if (event.target.closest("[data-lock]")) void this.command("lock");
        });
      }
      static getConfigElement() {
        return document.createElement(EDITOR_TAG);
      }
      static getStubConfig(hass) {
        return { entity: Object.keys(hass?.states || {}).find((id) => id.startsWith("lock.")) || "lock.front_door" };
      }
      static getEntitySuggestion(hass, entityId) {
        return window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, { domains: ["lock"] });
      }
      connectedCallback() {
        this.render();
      }
      disconnectedCallback() {
        this.cancelGesture();
        this.clearPending();
      }
      setConfig(config) {
        const next = normalizeConfig(config);
        this.cancelGesture();
        this.clearPending();
        this.error = "";
        this.config = next;
        this.render();
      }
      set hass(hass) {
        const context = captureHassContext(hass);
        if (this.context && !sameHassContext(this.context, context)) {
          this.cancelGesture();
          this.clearPending();
          this.error = "";
          this.signature = "";
        }
        this.context = context;
        this.stateHass = hass;
        const state = this.state;
        if (this.pending && (state === (this.pending === "lock" ? "locked" : "unlocked") || ["jammed", "unavailable", "unknown"].includes(state))) this.clearPending();
        const signature = JSON.stringify([this.entity, hass.language, hass.locale]);
        if (signature !== this.signature) {
          this.signature = signature;
          this.cancelGesture();
          this.render();
        }
      }
      getCardSize() {
        return this.config?.layout === "compact" ? 2 : 3;
      }
      getGridOptions() {
        return { columns: 6, rows: this.config?.layout === "compact" ? 2 : 3, min_columns: 4 };
      }
      get entity() {
        return this.stateHass?.states[this.config?.entity || ""];
      }
      get state() {
        return this.entity?.state || "unavailable";
      }
      get canUnlock() {
        return this.state === "locked" && !this.pending && Boolean(this.stateHass?.callService);
      }
      cancelGesture() {
        const gesture = this.gesture;
        this.gesture = null;
        if (gesture?.handle.hasPointerCapture(gesture.pointer)) gesture.handle.releasePointerCapture(gesture.pointer);
        this.setProgress(0);
      }
      setProgress(value) {
        this.progress = Math.max(0, Math.min(1, value));
        const slider = this.shadowRoot?.querySelector("[role=slider]");
        slider?.style.setProperty("--progress", String(this.progress));
        slider?.setAttribute("aria-valuenow", String(Math.round(this.progress * 100)));
      }
      startDrag(event) {
        const handle = event.target.closest("[data-handle]");
        if (!handle || !this.canUnlock || this.gesture || !event.isPrimary || event.button !== 0) return;
        const slider = handle.parentElement;
        const travel = slider.clientWidth - handle.offsetWidth - 8;
        if (travel <= 0) return;
        event.preventDefault();
        this.setProgress(0);
        handle.setPointerCapture(event.pointerId);
        this.gesture = { pointer: event.pointerId, x: event.clientX, y: event.clientY, travel, handle };
      }
      moveDrag(event) {
        const gesture = this.gesture;
        if (!gesture || event.pointerId !== gesture.pointer) return;
        if (!this.canUnlock || Math.abs(event.clientY - gesture.y) > 64) {
          this.cancelGesture();
          return;
        }
        event.preventDefault();
        this.setProgress((event.clientX - gesture.x) / gesture.travel);
      }
      endDrag(event) {
        if (!this.gesture || event.pointerId !== this.gesture.pointer) return;
        this.moveDrag(event);
        const complete = Boolean(this.gesture) && this.progress >= 0.98 && this.canUnlock;
        this.cancelGesture();
        if (complete) void this.command("unlock");
      }
      keyGesture(event) {
        if (!event.target.matches("[role=slider]") || !this.canUnlock) return;
        if (["ArrowRight", "ArrowLeft", "Home", "End", "Enter", " ", "Escape"].includes(event.key)) event.preventDefault();
        if (event.repeat || this.gesture) return;
        if (event.key === "ArrowRight") this.setProgress(this.progress + 0.1);
        if (event.key === "ArrowLeft") this.setProgress(this.progress - 0.1);
        if (event.key === "Escape" || event.key === "Home") this.cancelGesture();
        if (event.key === "Enter" && this.progress >= 0.98) {
          this.cancelGesture();
          void this.command("unlock");
        }
      }
      clearPending() {
        window.clearTimeout(this.timer);
        this.timer = 0;
        this.pending = null;
        this.generation += 1;
      }
      async command(action) {
        if (!this.isConnected || this.pending || !this.stateHass?.callService || !this.config) return;
        if (action === "unlock" ? !this.canUnlock : this.state !== "unlocked") return;
        const token = ++this.generation;
        this.pending = action;
        this.error = "";
        this.cancelGesture();
        this.render();
        navigator.vibrate?.([10, 40, 10]);
        this.timer = window.setTimeout(() => {
          if (token !== this.generation) return;
          this.clearPending();
          this.error = "timeout";
          this.render();
        }, 15e3);
        try {
          await this.stateHass.callService("lock", action, { entity_id: this.config.entity });
        } catch (_error) {
          if (token !== this.generation) return;
          this.clearPending();
          this.error = "failed";
          this.render();
        }
      }
      render() {
        if (!this.shadowRoot || !this.config) return;
        const text = (key) => window.NodaliaUtils.escapeHtml(lockText(this.stateHass, key));
        const styles = this.config.styles;
        const status = this.pending ? this.pending === "lock" ? "locking" : "unlocking" : this.state;
        const name = window.NodaliaUtils.escapeHtml(this.config.name || this.entity?.attributes.friendly_name || this.config.entity);
        const unlocked = this.state === "unlocked";
        const icon = ["jammed", "unknown", "unavailable"].includes(this.state) ? "mdi:lock-alert" : unlocked ? "mdi:lock-open-variant" : "mdi:lock";
        this.shadowRoot.innerHTML = `
        <style>
          :host { display:block; }
          * { box-sizing:border-box; }
          ha-card {
            --lock-accent: ${styles.icon.on_color};
            --lock-surface: ${styles.card.background};
            --lock-handle-size: ${styles.control.size};
            display:grid; gap:${styles.card.gap}; padding:${styles.card.padding};
            border-radius:${styles.card.border_radius};
            background:var(--lock-surface); color:var(--primary-text-color, #f4f4f4);
            box-shadow:${styles.card.box_shadow};
            border:${styles.card.border};
            position:relative; overflow:hidden;
          }
          ha-card::before {
            content:""; position:absolute; inset:0; pointer-events:none;
            background:linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), transparent);
          }
          ha-card > * { position:relative; z-index:1; }
          ha-card.is-locked {
            background:linear-gradient(135deg, color-mix(in srgb, var(--lock-accent) 18%, var(--lock-surface)), color-mix(in srgb, var(--lock-accent) 10%, var(--lock-surface)) 52%, var(--lock-surface));
            border-color:color-mix(in srgb, var(--lock-accent) 32%, var(--divider-color, #ffffff18));
          }
          .header { display:flex; align-items:center; gap:12px; min-width:0; }
          .icon {
            display:inline-flex; align-items:center; justify-content:center;
            flex:0 0 ${styles.icon.size}; width:${styles.icon.size}; height:${styles.icon.size}; border-radius:${styles.chip_border_radius};
            background:${styles.icon.background};
            border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
            box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0,0,0,.16);
            color:${styles.icon.off_color};
            transition:background 180ms ease; position:relative;
          }
          .is-locked .icon {
            background:color-mix(in srgb, var(--lock-accent) 24%, ${styles.icon.background});
            color:var(--lock-accent);
          }
          .is-unavailable .icon { color:var(--warning-color, #ff9b4a); }
          .icon ha-icon, .handle ha-icon {
            display:inline-flex; align-items:center; justify-content:center;
            line-height:0; vertical-align:middle;
          }
          .icon ha-icon { --mdc-icon-size:calc(${styles.icon.size} * .46); width:var(--mdc-icon-size); height:var(--mdc-icon-size); }
          .name { font-size:${styles.title_size}; font-weight:600; line-height:1.3; overflow-wrap:anywhere; }
          .state {
            display:inline-flex; align-items:center; min-height:22px; padding:0 9px; margin-top:6px;
            border-radius:${styles.chip_border_radius}; font-size:${styles.chip_font_size}; font-weight:600; line-height:1;
            background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
            border:1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
            color:var(--secondary-text-color, #aeb6c5);
          }
          .slider {
            --progress:0; height:calc(var(--lock-handle-size) + 10px); position:relative;
            border-radius:999px; background:color-mix(in srgb, var(--primary-text-color) 5%, transparent);
            border:1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
            box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
            user-select:none;
          }
          .track-label { position:absolute; inset:0; display:grid; place-items:center; padding-left:calc(var(--lock-handle-size) + 6px); font-size:12px; font-weight:600; pointer-events:none; }
          .handle {
            position:absolute; left:calc(4px + (100% - var(--lock-handle-size) - 8px) * var(--progress)); top:4px;
            width:var(--lock-handle-size); height:var(--lock-handle-size); border-radius:999px;
            display:grid; place-items:center;
            background:${styles.control.background};
            color:var(--primary-text-color);
            border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
            box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0,0,0,.16);
            touch-action:none; cursor:grab; transition:left 160ms ease;
          }
          .handle ha-icon { --mdc-icon-size:20px; width:20px; height:20px; }
          .slider:has(.handle:active) .handle { transition:none; }
          [aria-disabled=true] { opacity:.5; }
          [aria-disabled=true] .handle { cursor:default; }
          button {
            min-height:44px; border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
            border-radius:999px; background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
            color:var(--primary-text-color); font:inherit; font-size:12px; font-weight:600; cursor:pointer;
            box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          }
          button:disabled { opacity:.5; cursor:default; }
          :focus-visible { outline:2px solid var(--primary-color, #71c0ff); outline-offset:3px; }
          .help { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
          .slider:focus-visible + .help { position:static; width:auto; height:auto; margin:8px 4px 0; clip-path:none; white-space:normal; font-size:11px; color:var(--secondary-text-color, #aeb6c5); }
          .error { color:var(--error-color, #ff7777); font-size:12px; }
          .compact { --lock-handle-default:38px; --lock-card-padding:10px 12px; --lock-card-gap:10px; }
          @media (max-width:600px) {
            :host { --lock-icon-size:50px; }
          }
          @media (prefers-reduced-motion:reduce) { .handle, .icon { transition:none; } }
        </style>
        <ha-card class="${this.config.layout} ${this.state === "locked" ? "is-locked" : ""} ${["jammed", "unknown", "unavailable"].includes(this.state) ? "is-unavailable" : ""}" aria-busy="${Boolean(this.pending)}">
          <div class="header"><span class="icon"><ha-icon icon="${icon}"></ha-icon></span><div>
            ${this.config.show_name ? `<div class="name">${name}</div>` : ""}
            ${this.config.show_state ? `<div class="state" role="status">${text(status)}</div>` : ""}
          </div></div>
          ${unlocked ? `<button data-lock ${this.pending || !this.stateHass?.callService ? "disabled" : ""}>${text("lock")}</button>` : `
            <div><div class="slider" role="slider" tabindex="${this.canUnlock ? "0" : "-1"}" aria-label="${text("slide")}" aria-describedby="unlock-help" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-disabled="${!this.canUnlock}">
              <span class="track-label">${text(this.pending ? status : "slide")}</span><span class="handle" data-handle><ha-icon icon="mdi:chevron-right"></ha-icon></span>
            </div><p class="help" id="unlock-help">${text("help")}</p></div>`}
          ${this.error ? `<div class="error" role="alert">${text(this.error)}</div>` : ""}
        </ha-card>`;
      }
    }
    return NodaliaLockCard;
  }

  // src/shared/config-values.ts
  var isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  function cloneConfigValue(value) {
    const cloned = window.NodaliaUtils.deepClone(value);
    if (Array.isArray(value)) return Array.isArray(cloned) ? cloned : [];
    if (isRecord(value)) return isRecord(cloned) ? cloned : {};
    return cloned;
  }

  // src/shared/editor-color.ts
  var clamp = (value, max) => Math.max(0, Math.min(max, value));
  var component = (value, scale) => {
    if (!value || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/i.test(value)) return null;
    const numeric = Number(value.replace(/%$/, ""));
    return Number.isFinite(numeric) ? clamp(value.endsWith("%") ? numeric * scale / 100 : numeric, scale) : null;
  };
  function parseEditorColorChannels(value) {
    const raw = String(value ?? "").trim();
    const hexMatch = raw.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hexMatch?.[1]) {
      const hex = hexMatch[1].length < 5 ? hexMatch[1].split("").map((channel) => channel + channel).join("") : hexMatch[1];
      return { red: parseInt(hex.slice(0, 2), 16), green: parseInt(hex.slice(2, 4), 16), blue: parseInt(hex.slice(4, 6), 16), alpha: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1 };
    }
    const rgb = raw.match(/^rgba?\(([^)]+)\)$/i);
    const srgb = raw.match(/^color\(\s*srgb\s+([^)]+)\)$/i);
    const body = rgb?.[1] ?? srgb?.[1];
    if (!body) return null;
    const sections = body.trim().split(/\s*\/\s*/);
    if (sections.length > 2) return null;
    const parts = sections[0]?.split(/[\s,]+/) ?? [];
    if (sections.length === 2 && parts.length !== 3 || parts.length < 3 || parts.length > 4) return null;
    const scale = srgb ? 1 : 255;
    const red = component(parts[0], scale), green = component(parts[1], scale), blue = component(parts[2], scale);
    const alphaPart = sections[1] ?? parts[3];
    const alpha = alphaPart === void 0 ? 1 : component(alphaPart, 1);
    if (red === null || green === null || blue === null || alpha === null) return null;
    return { red: red * 255 / scale, green: green * 255 / scale, blue: blue * 255 / scale, alpha };
  }
  function formatEditorHexChannel(value) {
    const numeric = Number(value);
    return clamp(Math.round(Number.isFinite(numeric) ? numeric : 0), 255).toString(16).padStart(2, "0");
  }
  function formatEditorColorFromHex(hex, alpha = 1) {
    const normalized = String(hex ?? "").trim().replace(/^#/, "").toLowerCase();
    if (!/^[0-9a-f]{6}$/.test(normalized)) return String(hex ?? "");
    const numeric = Number(alpha);
    const safeAlpha = clamp(Number.isFinite(numeric) ? numeric : 1, 1);
    if (safeAlpha >= 0.999) return `#${normalized}`;
    const red = parseInt(normalized.slice(0, 2), 16), green = parseInt(normalized.slice(2, 4), 16), blue = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${Number(safeAlpha.toFixed(2))})`;
  }
  function resolveEditorColorValue(value) {
    const resolve = typeof window !== "undefined" ? window.NodaliaBubbleContrast?.resolveEditorColorValue : void 0;
    return resolve?.(value) || String(value ?? "").trim();
  }
  function browserColorChannels(value) {
    if (typeof document === "undefined" || !/^(?:color|oklab|oklch|lab|lch)\(/i.test(value)) return null;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.fillStyle = "#000001";
    context.fillStyle = value;
    if (context.fillStyle === "#000001") {
      context.fillStyle = "#000002";
      context.fillStyle = value;
      if (context.fillStyle === "#000002") return null;
    }
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
    if (red === void 0 || green === void 0 || blue === void 0 || alpha === void 0) return null;
    return { red, green, blue, alpha: alpha / 255 };
  }
  function getEditorColorModel(value, fallbackValue = "#71c0ff") {
    const source = String(value ?? "").trim() || String(fallbackValue ?? "").trim() || "#71c0ff";
    const resolved = resolveEditorColorValue(source);
    const channels = parseEditorColorChannels(resolved) || parseEditorColorChannels(source) || browserColorChannels(resolved) || parseEditorColorChannels(resolveEditorColorValue(fallbackValue)) || parseEditorColorChannels(fallbackValue) || { red: 113, green: 192, blue: 255, alpha: 1 };
    const hex = `#${formatEditorHexChannel(channels.red)}${formatEditorHexChannel(channels.green)}${formatEditorHexChannel(channels.blue)}`;
    return { alpha: channels.alpha, hex, label: source, resolved, source, value: formatEditorColorFromHex(hex, channels.alpha) };
  }

  // src/shared/editor-toggle.css
  var editor_toggle_default = ':is(.editor-toggle,.editor-checkbox){align-items:center;column-gap:10px;cursor:pointer;grid-auto-flow:row;grid-template-columns:auto minmax(0,1fr);justify-content:stretch;min-height:40px;padding-top:0;position:relative}:is(.editor-toggle,.editor-checkbox) input{block-size:1px;inline-size:1px;margin:0;opacity:0;pointer-events:none;position:absolute}.editor-toggle__switch{background:color-mix(in srgb,var(--primary-text-color) 8%,transparent);border:1px solid color-mix(in srgb,var(--primary-text-color) 12%,transparent);border-radius:999px;box-shadow:inset 0 1px 0 color-mix(in srgb,var(--primary-text-color) 6%,transparent);display:inline-flex;font-size:0;height:22px;line-height:0;position:relative;transition:background 160ms ease,border-color 160ms ease,box-shadow 160ms ease;width:40px}.editor-toggle__switch::before{background:rgba(255,255,255,0.92);border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,0.24);content:"";height:18px;left:1px;position:absolute;top:1px;transition:transform 160ms ease;width:18px}.editor-toggle__label{min-width:0}:is(.editor-toggle,.editor-checkbox) input:checked+.editor-toggle__switch{background:var(--primary-color);border-color:var(--primary-color)}:is(.editor-toggle,.editor-checkbox) input:checked+.editor-toggle__switch::before{transform:translateX(18px)}:is(.editor-toggle,.editor-checkbox) input:focus-visible+.editor-toggle__switch{box-shadow:0 0 0 3px color-mix(in srgb,var(--primary-text-color) 14%,transparent),inset 0 1px 0 color-mix(in srgb,var(--primary-text-color) 8%,transparent)}';

  // src/shared/editor-radius.css
  var editor_radius_default = ".editor-chip-radius__options{display:flex;flex-wrap:wrap;gap:8px}.editor-chip-radius__option{align-items:center;border:1px solid color-mix(in srgb,var(--primary-text-color) 12%,transparent);border-radius:12px;cursor:pointer;display:inline-flex;gap:8px;padding:8px 12px}.editor-chip-radius__option:has(input:checked){background:color-mix(in srgb,var(--primary-color) 10%,transparent);border-color:var(--primary-color)}.editor-chip-radius__option input[type=radio]{accent-color:var(--primary-color);appearance:auto;margin:0;min-height:auto;padding:0;width:auto}";

  // src/shared/editor-color.css
  var editor_color_default = ".editor-color-field{align-items:center;display:flex;flex-wrap:wrap;gap:10px;min-height:40px}.editor-color-picker{align-items:center;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent);border:1px solid color-mix(in srgb,var(--primary-text-color) 8%,transparent);border-radius:999px;cursor:pointer;display:inline-flex;flex:0 0 auto;height:40px;justify-content:center;position:relative;width:40px}.editor-color-picker input{cursor:pointer;inset:0;opacity:0;position:absolute}.editor-color-picker:hover,.editor-color-picker:focus-within{border-color:color-mix(in srgb,var(--primary-text-color) 22%,transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--primary-text-color) 8%,transparent)}.editor-color-swatch{--editor-swatch: #71c0ff;background:linear-gradient(var(--editor-swatch),var(--editor-swatch)),conic-gradient(from 90deg,color-mix(in srgb,var(--primary-text-color) 6%,transparent) 25%,rgba(0,0,0,0.12) 0 50%,color-mix(in srgb,var(--primary-text-color) 6%,transparent) 0 75%,rgba(0,0,0,0.12) 0);background-position:center;background-size:cover,10px 10px;border:1px solid color-mix(in srgb,var(--primary-text-color) 14%,transparent);border-radius:999px;display:block;height:22px;width:22px}";

  // src/shared/editor-section-action.css
  var editor_section_action_default = ".editor-section__actions{align-items:center;display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}.editor-section__toggle-button{align-items:center;appearance:none;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent);border:1px solid color-mix(in srgb,var(--primary-text-color) 8%,transparent);border-radius:999px;color:var(--primary-text-color);cursor:pointer;display:inline-flex;font:inherit;font-size:12px;font-weight:600;gap:8px;min-height:34px;padding:0 12px}.editor-section__toggle-button ha-icon{--mdc-icon-size: 16px}";

  // src/cards/lock/lock-editor.ts
  function loadNodaliaLockCardEditor() {
    class NodaliaLockCardEditor extends HTMLElement {
      constructor() {
        super();
        this.showStyles = false;
        this._nodaliaConstruct();
      }
      _nodaliaConstruct() {
        this.config = {};
        this.stateHass = null;
        this.showStyles = false;
        this.renderedLanguage = "";
        this.attachShadow({ mode: "open" });
        this.shadowRoot.addEventListener("change", (event) => this.change(event));
        this.shadowRoot.addEventListener("value-changed", (event) => this.change(event));
        this.shadowRoot.addEventListener("click", (event) => {
          if (!(event.target instanceof Element) || !event.target.closest('[data-editor-toggle="styles"]')) return;
          this.showStyles = !this.showStyles;
          this.render();
          this.shadowRoot?.querySelector('[data-editor-toggle="styles"]')?.focus();
        });
      }
      setConfig(config) {
        const cloned = cloneConfigValue(config);
        this.config = window.NodaliaUtils.isObject(cloned) ? cloned : {};
        this.render();
      }
      set hass(hass) {
        const languageChanged = this.renderedLanguage !== (window.NodaliaI18n?.resolveLanguage?.(hass) || "en");
        this.stateHass = hass;
        if (languageChanged || !this.shadowRoot?.querySelector(".editor")) this.render();
        const picker = this.shadowRoot?.querySelector("ha-entity-picker");
        if (picker) Object.assign(picker, { hass });
      }
      change(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const field = target.dataset.field;
        if (!field) return;
        let value;
        if (event instanceof CustomEvent && event.type === "value-changed") value = window.NodaliaUtils.isObject(event.detail) ? event.detail.value : void 0;
        else if (target instanceof HTMLInputElement) value = target.type === "checkbox" ? target.checked : target.type === "color" ? formatEditorColorFromHex(target.value, target.dataset.alpha ?? 1) : target.value;
        else if (target instanceof HTMLSelectElement) value = target.value;
        else return;
        const next = cloneConfigValue(this.config);
        window.NodaliaUtils.setByPath(next, field, value);
        this.config = next;
        if (target instanceof HTMLInputElement && target.type === "color") {
          target.parentElement?.querySelector(".editor-color-swatch")?.style.setProperty("--editor-swatch", String(value));
        }
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this.config }, bubbles: true, composed: true }));
      }
      label(key) {
        const language = this.renderedLanguage;
        return window.NodaliaI18n?.editorStr?.(this.stateHass, language, key) || key;
      }
      field(key, field, value, color = false) {
        const escape = window.NodaliaUtils.escapeHtml;
        const label = escape(this.label(key));
        if (!color) return `<label class="editor-field"><span>${label}</span><input data-field="${field}" value="${escape(value)}"></label>`;
        const model = getEditorColorModel(value);
        return `<div class="editor-field"><span>${label}</span><div class="editor-color-field"><label class="editor-color-picker">
        <input type="color" data-field="${field}" data-alpha="${model.alpha}" value="${model.hex}" aria-label="${label}"><span class="editor-color-swatch" style="--editor-swatch:${escape(value)}"></span>
      </label></div></div>`;
      }
      render() {
        if (!this.shadowRoot) return;
        this.renderedLanguage = window.NodaliaI18n?.resolveLanguage?.(this.stateHass) || "en";
        const text = (key) => window.NodaliaUtils.escapeHtml(lockText(this.stateHass, key));
        const escape = window.NodaliaUtils.escapeHtml;
        const label = (key) => escape(this.label(key));
        const styles = normalizeLockStyles(this.config.styles);
        const radiusLabels = { pill: this.label("ed.entity.chip_radius_pill"), soft: this.label("ed.entity.chip_radius_soft"), round: this.label("ed.entity.chip_radius_round"), square: this.label("ed.entity.chip_radius_square") };
        this.shadowRoot.innerHTML = `<style>
        :host { display:block; }
        * { box-sizing:border-box; }
        .editor { color:var(--primary-text-color); display:grid; gap:16px; }
        .editor-section { background:color-mix(in srgb, var(--primary-text-color) 2%, transparent); border:1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent); border-radius:18px; display:grid; gap:14px; padding:16px; }
        .editor-section__header { display:grid; gap:4px; }
        .editor-section__title { font-size:15px; font-weight:700; }
        .editor-section__hint { color:var(--secondary-text-color); font-size:12px; line-height:1.45; }
        .editor-grid { display:grid; gap:12px; grid-template-columns:repeat(2,minmax(0,1fr)); }
        .editor-field, .editor-toggle { display:grid; gap:6px; min-width:0; }
        .editor-field--full { grid-column:1 / -1; }
        .editor-field > span, .editor-toggle > span { font-size:12px; font-weight:600; }
        .editor-field input, .editor-field select { appearance:none; background:color-mix(in srgb, var(--primary-text-color) 4%, transparent); border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); border-radius:12px; color:var(--primary-text-color); font:inherit; min-height:40px; padding:10px 12px; width:100%; }
        :focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
        @media(max-width:450px) { .editor-grid { grid-template-columns:1fr; } }
        ${editor_toggle_default}
        ${editor_radius_default}
        ${editor_color_default}
        ${editor_section_action_default}
      </style><div class="editor">
        <section class="editor-section">
          <div class="editor-section__header"><div class="editor-section__title">${label("ed.weather.general_section_title")}</div></div>
          <div class="editor-grid">
            <div class="editor-field editor-field--full"><ha-entity-picker data-field="entity"></ha-entity-picker></div>
            <label class="editor-field"><span>${text("name")}</span><input data-field="name" value="${escape(this.config.name || "")}"></label>
            <label class="editor-field"><span>${text("layout")}</span><select data-field="layout"><option value="standard" ${this.config.layout !== "compact" ? "selected" : ""}>${text("standard")}</option><option value="compact" ${this.config.layout === "compact" ? "selected" : ""}>${text("compact")}</option></select></label>
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header"><div class="editor-section__title">${label("ed.vacuum.visibility_section_title")}</div></div>
          <div class="editor-grid">
            <label class="editor-toggle"><input type="checkbox" role="switch" data-field="show_name" ${this.config.show_name !== false ? "checked" : ""}><span class="editor-toggle__switch" aria-hidden="true"></span><span class="editor-toggle__label">${text("showName")}</span></label>
            <label class="editor-toggle"><input type="checkbox" role="switch" data-field="show_state" ${this.config.show_state !== false ? "checked" : ""}><span class="editor-toggle__switch" aria-hidden="true"></span><span class="editor-toggle__label">${text("showState")}</span></label>
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header"><div class="editor-section__title">${label("ed.weather.styles_section_title")}</div><div class="editor-section__hint">${label("ed.entity.styles_section_hint")}</div>
          <div class="editor-section__actions"><button type="button" class="editor-section__toggle-button" data-editor-toggle="styles" aria-expanded="${this.showStyles}"><ha-icon icon="${this.showStyles ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon><span>${label(this.showStyles ? "ed.weather.hide_style_settings" : "ed.weather.show_style_settings")}</span></button></div></div>
          ${this.showStyles ? `<div class="editor-grid">
            ${this.field("ed.entity.style_card_bg", "styles.card.background", styles.card.background, true)}
            ${this.field("ed.entity.style_card_border", "styles.card.border", styles.card.border)}
            ${window.NodaliaUtils.renderEditorCardBorderRadiusHtml({ escapeHtml: escape, field: "styles.card.border_radius", value: styles.card.border_radius, tHeading: this.label("ed.entity.style_card_radius_presets"), labels: radiusLabels })}
            ${this.field("ed.entity.style_card_shadow", "styles.card.box_shadow", styles.card.box_shadow)}
            ${this.field("ed.entity.style_card_padding", "styles.card.padding", styles.card.padding)}
            ${this.field("ed.entity.style_card_gap", "styles.card.gap", styles.card.gap)}
            ${this.field("ed.entity.style_main_button_size", "styles.icon.size", styles.icon.size)}
            ${this.field("ed.entity.style_main_bubble_bg", "styles.icon.background", styles.icon.background, true)}
            ${this.field("ed.entity.style_icon_on", "styles.icon.on_color", styles.icon.on_color, true)}
            ${this.field("ed.entity.style_icon_off", "styles.icon.off_color", styles.icon.off_color, true)}
            ${this.field("ed.entity.style_aux_button_size", "styles.control.size", styles.control.size)}
            ${this.field("ed.entity.style_accent_bg", "styles.control.background", styles.control.background, true)}
            ${this.field("ed.entity.style_title_size", "styles.title_size", styles.title_size)}
            ${this.field("ed.entity.style_chip_font", "styles.chip_font_size", styles.chip_font_size)}
            ${window.NodaliaUtils.renderEditorChipBorderRadiusHtml({ escapeHtml: escape, field: "styles.chip_border_radius", value: styles.chip_border_radius, tHeading: this.label("ed.entity.style_chip_radius"), labels: radiusLabels })}
          </div>` : ""}
        </section>
        <div class="editor-section__hint">${text("help")}</div>
      </div>`;
        const picker = this.shadowRoot.querySelector("ha-entity-picker");
        if (picker) Object.assign(picker, { hass: this.stateHass, value: this.config.entity || "", includeDomains: ["lock"], label: lockText(this.stateHass, "entity"), allowCustomEntity: true });
      }
    }
    return NodaliaLockCardEditor;
  }

  // src/cards/lock/index.ts
  window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaLockCard, { editorTag: EDITOR_TAG });
  window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaLockCardEditor);
  window.NodaliaUtils.registerCustomCard({
    type: CARD_TAG,
    name: "Nodalia Lock Card",
    description: "Lock controls with deliberate slide-to-unlock confirmation.",
    preview: true
  });
  window.__NODALIA_LOCK__ = { CARD_TAG, EDITOR_TAG, CARD_VERSION, normalizeConfig };
})();
