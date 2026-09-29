import type { HomeAssistant } from "../../core/types/home-assistant";
import type { LockConfig } from "./lock-config";
import { lockText } from "./lock-strings";

export function loadNodaliaLockCardEditor(): CustomElementConstructor {
  class NodaliaLockCardEditor extends HTMLElement {
    private config!: Partial<LockConfig>;
    private stateHass!: HomeAssistant | null;
    constructor() { super(); this._nodaliaConstruct(); }
    _nodaliaConstruct(): void {
      this.config = {}; this.stateHass = null;
      this.attachShadow({ mode: "open" });
      this.shadowRoot!.addEventListener("change", event => this.change(event));
      this.shadowRoot!.addEventListener("value-changed", event => this.change(event));
    }
    setConfig(config: Partial<LockConfig>): void { this.config = { ...config }; this.render(); }
    set hass(hass: HomeAssistant) {
      const languageChanged = this.stateHass?.language !== hass.language;
      this.stateHass = hass;
      if (languageChanged || !this.shadowRoot?.querySelector(".editor")) this.render();
      const picker = this.shadowRoot?.querySelector("ha-entity-picker");
      if (picker) Object.assign(picker, { hass });
    }
    private change(event: Event): void {
      const target = event.target as HTMLInputElement;
      const field = target.dataset.field;
      if (!field) return;
      const value = event.type === "value-changed" ? (event as CustomEvent<{ value: string }>).detail.value
        : target.type === "checkbox" ? target.checked : target.value;
      this.config = { ...this.config, [field]: value };
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this.config }, bubbles: true, composed: true }));
    }
    private render(): void {
      if (!this.shadowRoot) return;
      const text = (key: string) => window.NodaliaUtils.escapeHtml(lockText(this.stateHass, key));
      const escape = window.NodaliaUtils.escapeHtml;
      const language = window.NodaliaI18n?.resolveLanguage?.(this.stateHass) || "en";
      const label = (key: string) => escape(window.NodaliaI18n?.editorStr?.(this.stateHass, language, key) || key);
      this.shadowRoot.innerHTML = `<style>
        :host { display:block; }
        * { box-sizing:border-box; }
        .editor { color:var(--primary-text-color); display:grid; gap:16px; }
        .editor-section { background:color-mix(in srgb, var(--primary-text-color) 2%, transparent); border:1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent); border-radius:18px; display:grid; gap:14px; padding:16px; }
        .editor-section__header { display:grid; gap:4px; }
        .editor-section__title { font-size:15px; font-weight:700; }
        .editor-section__hint { color:var(--secondary-text-color); font-size:12px; line-height:1.45; }
        .editor-grid { display:grid; gap:12px; grid-template-columns:repeat(2,minmax(0,1fr)); }
        .editor-field { display:grid; gap:6px; min-width:0; }
        .editor-field--full { grid-column:1 / -1; }
        .editor-field > span, .editor-toggle > span { font-size:12px; font-weight:600; }
        .editor-field input, .editor-field select { appearance:none; background:color-mix(in srgb, var(--primary-text-color) 4%, transparent); border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); border-radius:12px; color:var(--primary-text-color); font:inherit; min-height:40px; padding:10px 12px; width:100%; }
        .editor-toggle { display:flex; gap:10px; align-items:center; min-height:40px; }
        input[type=checkbox] { accent-color:var(--primary-color); width:18px; height:18px; }
        :focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
        @media(max-width:450px) { .editor-grid { grid-template-columns:1fr; } }
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
            <label class="editor-toggle"><input type="checkbox" data-field="show_name" ${this.config.show_name !== false ? "checked" : ""}><span>${text("showName")}</span></label>
            <label class="editor-toggle"><input type="checkbox" data-field="show_state" ${this.config.show_state !== false ? "checked" : ""}><span>${text("showState")}</span></label>
          </div>
        </section>
        <div class="editor-section__hint">${text("help")}</div>
      </div>`;
      const picker = this.shadowRoot.querySelector("ha-entity-picker");
      if (picker) Object.assign(picker, { hass: this.stateHass, value: this.config.entity || "", includeDomains: ["lock"], label: text("entity"), allowCustomEntity: true });
    }
  }
  return NodaliaLockCardEditor;
}
