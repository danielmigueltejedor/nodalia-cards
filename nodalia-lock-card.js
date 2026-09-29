/* Generated from src/cards/lock. Do not edit. */
"use strict";
(() => {
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
      show_state: config.show_state !== false
    };
  }

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
        const status = this.pending ? this.pending === "lock" ? "locking" : "unlocking" : this.state;
        const name = window.NodaliaUtils.escapeHtml(this.config.name || this.entity?.attributes.friendly_name || this.config.entity);
        const unlocked = this.state === "unlocked";
        const icon = ["jammed", "unknown", "unavailable"].includes(this.state) ? "mdi:lock-alert" : unlocked ? "mdi:lock-open-variant" : "mdi:lock";
        this.shadowRoot.innerHTML = `
        <style>
          :host { display:block; }
          * { box-sizing:border-box; }
          ha-card {
            --lock-accent: var(--success-color, #6acb9a);
            --lock-surface: var(--ha-card-background, var(--card-background-color, #1c1c20));
            --lock-handle-size: 42px;
            display:grid; gap:14px; padding:16px;
            border-radius:var(--nodalia-card-border-radius, 28px);
            background:var(--lock-surface); color:var(--primary-text-color, #f4f4f4);
            box-shadow:var(--ha-card-box-shadow, 0 8px 24px #0002);
            border:1px solid var(--divider-color, #ffffff18);
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
            flex:0 0 38px; width:38px; height:38px; border-radius:999px;
            background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
            border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
            box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0,0,0,.16);
            color:var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent));
            transition:background 180ms ease; position:relative;
          }
          .is-locked .icon {
            background:color-mix(in srgb, var(--lock-accent) 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
            color:var(--lock-accent);
          }
          .is-unavailable .icon { color:var(--warning-color, #ff9b4a); }
          .icon ha-icon { --mdc-icon-size:17.48px; width:17.48px; height:17.48px; }
          .name { font-size:13px; font-weight:600; line-height:1.3; overflow-wrap:anywhere; }
          .state {
            display:inline-flex; align-items:center; min-height:22px; padding:0 9px; margin-top:6px;
            border-radius:999px; font-size:11px; font-weight:600; line-height:1;
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
            background:color-mix(in srgb, var(--primary-text-color) 8%, var(--lock-surface));
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
          .compact { --lock-handle-size:38px; padding:10px 12px; gap:10px; }
          @media (max-width:600px) {
            .icon { flex-basis:50px; width:50px; height:50px; }
            .icon ha-icon { --mdc-icon-size:23px; width:23px; height:23px; }
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

  // src/cards/lock/lock-editor.ts
  function loadNodaliaLockCardEditor() {
    class NodaliaLockCardEditor extends HTMLElement {
      constructor() {
        super();
        this._nodaliaConstruct();
      }
      _nodaliaConstruct() {
        this.config = {};
        this.stateHass = null;
        this.attachShadow({ mode: "open" });
        this.shadowRoot.addEventListener("change", (event) => this.change(event));
        this.shadowRoot.addEventListener("value-changed", (event) => this.change(event));
      }
      setConfig(config) {
        this.config = { ...config };
        this.render();
      }
      set hass(hass) {
        this.stateHass = hass;
        this.render();
      }
      change(event) {
        const target = event.target;
        const field = target.dataset.field;
        if (!field) return;
        const value = event.type === "value-changed" ? event.detail.value : target.type === "checkbox" ? target.checked : target.value;
        this.config = { ...this.config, [field]: value };
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this.config }, bubbles: true, composed: true }));
      }
      render() {
        if (!this.shadowRoot) return;
        const text = (key) => window.NodaliaUtils.escapeHtml(lockText(this.stateHass, key));
        const escape = window.NodaliaUtils.escapeHtml;
        this.shadowRoot.innerHTML = `<style>
        :host { display:block; } .fields { display:grid; gap:16px; padding:12px; }
        label { display:grid; gap:6px; } input, select { font:inherit; padding:10px; color:var(--primary-text-color); background:var(--card-background-color); border:1px solid var(--divider-color); border-radius:8px; }
        .check { display:flex; align-items:center; } p { color:var(--secondary-text-color); }
      </style><div class="fields">
        <ha-entity-picker data-field="entity"></ha-entity-picker>
        <label>${text("name")}<input data-field="name" value="${escape(this.config.name || "")}"></label>
        <label>${text("layout")}<select data-field="layout"><option value="standard" ${this.config.layout !== "compact" ? "selected" : ""}>${text("standard")}</option><option value="compact" ${this.config.layout === "compact" ? "selected" : ""}>${text("compact")}</option></select></label>
        <label class="check"><input type="checkbox" data-field="show_name" ${this.config.show_name !== false ? "checked" : ""}>${text("showName")}</label>
        <label class="check"><input type="checkbox" data-field="show_state" ${this.config.show_state !== false ? "checked" : ""}>${text("showState")}</label>
        <p>${text("help")}</p>
      </div>`;
        const picker = this.shadowRoot.querySelector("ha-entity-picker");
        if (picker) Object.assign(picker, { hass: this.stateHass, value: this.config.entity || "", includeDomains: ["lock"], label: text("entity"), allowCustomEntity: true });
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
})();
