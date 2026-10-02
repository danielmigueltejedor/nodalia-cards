import type { HomeAssistant } from "../../core/types/home-assistant";
import { cloneConfigValue } from "../../shared/config-values";
import { normalizeLockStyles } from "./lock-styles";
import { getEditorColorModel, formatEditorColorFromHex } from "../../shared/editor-color";
import { lockText } from "./lock-strings";
import { EDITOR_TOGGLE_STYLES, EDITOR_RADIUS_STYLES, EDITOR_COLOR_STYLES, EDITOR_SECTION_ACTION_STYLES } from "../../shared/editor-toggle-styles";

export function loadNodaliaLockCardEditor(): CustomElementConstructor {
  class NodaliaLockCardEditor extends HTMLElement {
    private config!: Record<string,unknown>;
    private stateHass!: HomeAssistant | null;
    private showStyles = false;
    constructor() { super(); this._nodaliaConstruct(); }
    _nodaliaConstruct(): void {
      this.config = {}; this.stateHass = null; this.showStyles = false;
      this.attachShadow({ mode: "open" });
      this.shadowRoot!.addEventListener("change", event => this.change(event));
      this.shadowRoot!.addEventListener("value-changed", event => this.change(event));
      this.shadowRoot!.addEventListener("click", event => {
        if (!(event.target instanceof Element) || !event.target.closest('[data-editor-toggle="styles"]')) return;
        this.showStyles = !this.showStyles;
        this.render();
        this.shadowRoot?.querySelector<HTMLButtonElement>('[data-editor-toggle="styles"]')?.focus();
      });
    }
    setConfig(config: unknown): void { const cloned=cloneConfigValue(config);this.config = window.NodaliaUtils.isObject(cloned)?cloned:{}; this.render(); }
    set hass(hass: HomeAssistant) {
      const languageChanged = window.NodaliaI18n?.resolveLanguage?.(this.stateHass) !== window.NodaliaI18n?.resolveLanguage?.(hass);
      this.stateHass = hass;
      if (languageChanged || !this.shadowRoot?.querySelector(".editor")) this.render();
      const picker = this.shadowRoot?.querySelector("ha-entity-picker");
      if (picker) Object.assign(picker, { hass });
    }
    private change(event: Event): void {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const field = target.dataset.field;
      if (!field) return;
      let value: unknown;
      if (event instanceof CustomEvent && event.type === "value-changed") value = window.NodaliaUtils.isObject(event.detail)?event.detail.value:undefined;
      else if (target instanceof HTMLInputElement) value = target.type === "checkbox" ? target.checked
        : target.type === "color" ? formatEditorColorFromHex(target.value, target.dataset.alpha ?? 1) : target.value;
      else if (target instanceof HTMLSelectElement) value = target.value;
      else return;
      const next = cloneConfigValue(this.config);
      window.NodaliaUtils.setByPath(next, field, value);
      this.config = next;
      if (target instanceof HTMLInputElement && target.type === "color") {
        target.parentElement?.querySelector<HTMLElement>(".editor-color-swatch")?.style.setProperty("--editor-swatch", String(value));
      }
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this.config }, bubbles: true, composed: true }));
    }
    private label(key: string): string {
      const language = window.NodaliaI18n?.resolveLanguage?.(this.stateHass) || "en";
      return window.NodaliaI18n?.editorStr?.(this.stateHass, language, key) || key;
    }
    private field(key: string, field: string, value: string, color = false): string {
      const escape = window.NodaliaUtils.escapeHtml;
      const label = escape(this.label(key));
      if (!color) return `<label class="editor-field"><span>${label}</span><input data-field="${field}" value="${escape(value)}"></label>`;
      const model = getEditorColorModel(value);
      return `<div class="editor-field"><span>${label}</span><div class="editor-color-field"><label class="editor-color-picker">
        <input type="color" data-field="${field}" data-alpha="${model.alpha}" value="${model.hex}" aria-label="${label}"><span class="editor-color-swatch" style="--editor-swatch:${escape(value)}"></span>
      </label></div></div>`;
    }
    private render(): void {
      if (!this.shadowRoot) return;
      const text = (key: string) => window.NodaliaUtils.escapeHtml(lockText(this.stateHass, key));
      const escape = window.NodaliaUtils.escapeHtml;
      const label = (key: string) => escape(this.label(key));
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
        ${EDITOR_TOGGLE_STYLES}
        ${EDITOR_RADIUS_STYLES}
        ${EDITOR_COLOR_STYLES}
        ${EDITOR_SECTION_ACTION_STYLES}
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
