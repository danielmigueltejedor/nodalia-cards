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
    set hass(hass: HomeAssistant) { this.stateHass = hass; this.render(); }
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
