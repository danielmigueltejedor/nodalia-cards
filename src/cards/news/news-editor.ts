// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { deepClone } from "./news-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./news-config";
import {
  compactConfig,
  deleteByPath,
  escapeHtml,
  fireEvent,
  setByPath,
} from "./news-helpers";

let _lazyNodaliaNewsCardEditor;
export function loadNodaliaNewsCardEditor() {
  if (_lazyNodaliaNewsCardEditor) {
    return _lazyNodaliaNewsCardEditor;
  }
class NodaliaNewsCardEditor extends HTMLElement {
  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    }

  _attachEditorShadowListeners() {
    window.NodaliaUtils.bindShadowListeners(this, [
      ["input", this._onShadowInput],
      ["change", this._onShadowInput],
      ["value-changed", this._onShadowValueChanged],
    ], "editor");
  }

  _detachEditorShadowListeners() {
    window.NodaliaUtils.releaseShadowListeners(this, "editor");
  }

  connectedCallback() {
    this._attachEditorShadowListeners();
    window.NodaliaUtils?.bindEditorDialogLayoutFix?.(this);
  }

  disconnectedCallback() {
    this._detachEditorShadowListeners();
    window.NodaliaUtils?.releaseEditorDialogLayoutFix?.(this);
  }

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    this._render();
    this._restoreFocusState(focusState);
  }

  set hass(hass) {
    const nextSignature = window.NodaliaUtils?.editorFilteredStatesSignature?.(
      hass,
      this._config?.language,
      id => id.startsWith("sensor."),
    ) || "";
    const shouldRender = !this._hass || nextSignature !== this._entityOptionsSignature || !this.shadowRoot?.innerHTML;
    this._hass = hass;
    this._entityOptionsSignature = nextSignature;
    if (!shouldRender) {
      return;
    }
    const focusState = this._captureFocusState();
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
        if (!this.isConnected || !this._hass || !this.shadowRoot) {
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
  }

  _captureFocusState() {
    return window.NodaliaUtils.captureEditorFocusState(this);
  }

  _restoreFocusState(focusState) {
    window.NodaliaUtils.restoreEditorFocusState(this, focusState);
  }

  _emitConfig() {
    const focusState = this._captureFocusState();
    const nextConfig = deepClone(this._config);
    this._config = normalizeConfig(compactConfig(nextConfig));
    this._render();
    this._restoreFocusState(focusState);
    fireEvent(this, "config-changed", {
      config: compactConfig(window.NodaliaUtils?.stripEqualToDefaults?.(nextConfig, DEFAULT_CONFIG) ?? nextConfig),
    });
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
    if (valueType === "boolean") {
      return Boolean(input.checked);
    }
    if (valueType === "number") {
      const numeric = Number(input.value);
      return Number.isFinite(numeric) ? numeric : input.value;
    }
    return input.value;
  }

  _onShadowInput(event) {
    const input = event.composedPath().find(node => (
      node instanceof HTMLInputElement
      || node instanceof HTMLSelectElement
      || node instanceof HTMLTextAreaElement
    ));
    if (!input?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    this._setFieldValue(input.dataset.field, this._readFieldValue(input));
    this._config = normalizeConfig(this._config);
    if (event.type === "change") {
      this._emitConfig();
    }
  }

  _onShadowValueChanged(event) {
    const control = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.field);
    if (!control?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    const nextValue = typeof event.detail?.value === "string" ? event.detail.value : control.value;
    if (typeof control.dataset?.value === "string") {
      control.dataset.value = String(nextValue || "");
    }
    this._setFieldValue(control.dataset.field, nextValue);
    this._config = normalizeConfig(this._config);
    this._emitConfig();
  }

  _editorLabel(key) {
    if (typeof key !== "string" || !window.NodaliaI18n?.editorStr) {
      return key;
    }
    return window.NodaliaI18n.editorStr(this._hass, this._config?.language ?? "auto", key);
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(inputType)}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(valueType)}"
          value="${escapeHtml(String(value ?? ""))}"
          ${placeholder}
        />
      </label>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-toggle">
        <input type="checkbox" data-field="${escapeHtml(field)}" data-value-type="boolean" ${checked ? "checked" : ""} />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(tLabel)}</span>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options, renderOptions = {}) {
    const tLabel = this._editorLabel(label);
    const strValue = String(value ?? "");
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options.map(option => `
            <option value="${escapeHtml(option.value)}" ${String(option.value) === strValue ? "selected" : ""}>
              ${escapeHtml(this._editorLabel(option.label))}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _renderEntityPickerField(label, field, value) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
        ></div>
      </div>
    `;
  }

  _mountEntityPicker(host) {
    window.NodaliaUtils?.mountEntityPickerHost?.(host, {
      hass: this._hass,
      field: host.dataset.field || "entity",
      value: host.dataset.value || "",
      onShadowInput: this._onShadowInput,
      onShadowValueChanged: this._onShadowValueChanged,
      copyDatasetFromHost: true,
    });
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    const config = this._config || DEFAULT_CONFIG;
    const layout = config.layout || DEFAULT_CONFIG.layout;
    const appearance = config.appearance || DEFAULT_CONFIG.appearance;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        * { box-sizing: border-box; }
        .editor { color: var(--primary-text-color); display: grid; gap: 16px; }
        .editor-section {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 18px;
          display: grid;
          gap: 14px;
          padding: 16px;
        }
        .editor-section__header { display: grid; gap: 4px; }
        .editor-section__title { font-size: 15px; font-weight: 700; }
        .editor-section__hint {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }
        .editor-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .editor-grid--stacked { grid-template-columns: 1fr; }
        .editor-field, .editor-toggle { display: grid; gap: 6px; min-width: 0; }
        .editor-field--full { grid-column: 1 / -1; }
        .editor-field:has(> .editor-control-host[data-mounted-control="entity"]) { grid-column: 1 / -1; }
        .editor-field > span, .editor-toggle > span {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 600;
        }
        .editor-field input, .editor-field select {
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
        .editor-field ha-entity-picker, .editor-field ha-selector, .editor-control-host, .editor-control-host > * {
          display: block;
          width: 100%;
        }
        :is(.editor-toggle, .editor-checkbox) {
          align-items: center;
          column-gap: 10px;
          cursor: pointer;
          grid-template-columns: auto minmax(0, 1fr);
          min-height: 40px;
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
          display: inline-flex;
          height: 22px;
          position: relative;
          transition: background 160ms ease, border-color 160ms ease;
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
        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }
        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch::before {
          transform: translateX(18px);
        }
        @media (max-width: 640px) {
          .editor-grid { grid-template-columns: 1fr; }
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.news.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.news.general_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityPickerField("ed.news.entity", "entity", config.entity)}
            ${this._renderTextField("ed.news.title", "title", config.title, { fullWidth: true })}
            ${this._renderTextField("ed.news.max_items", "max_items", config.max_items, { type: "number", valueType: "number" })}
            ${this._renderCheckboxField("ed.news.remember_items", "remember_items", config.remember_items !== false)}
            ${this._renderTextField("ed.news.history_helper", "history_helper", config.history_helper || "", {
              fullWidth: true,
              placeholder: "input_text.nodalia_news_history",
            })}
            ${this._renderCheckboxField("ed.news.mirror_history_local", "mirror_history_local", config.mirror_history_local !== false)}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.news.layout_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.news.layout_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("ed.news.layout_mode", "layout.mode", layout.mode, [
              { value: "magazine", label: "ed.news.layout_mode_magazine" },
              { value: "compact", label: "ed.news.layout_mode_compact" },
              { value: "list", label: "ed.news.layout_mode_list" },
            ])}
            ${this._renderSelectField("ed.news.density", "layout.density", layout.density || "normal", [
              { value: "compact", label: "ed.news.density_compact" },
              { value: "normal", label: "ed.news.density_normal" },
              { value: "relaxed", label: "ed.news.density_relaxed" },
            ])}
            ${this._renderCheckboxField("ed.news.show_images", "layout.show_images", layout.show_images !== false)}
            ${this._renderCheckboxField("ed.news.show_summary", "layout.show_summary", layout.show_summary !== false)}
            ${this._renderCheckboxField("ed.news.show_source", "layout.show_source", layout.show_source !== false)}
            ${this._renderCheckboxField("ed.news.show_time", "layout.show_time", layout.show_time !== false)}
            ${this._renderCheckboxField("ed.news.show_category", "layout.show_category", layout.show_category !== false)}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.news.appearance_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.news.appearance_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("ed.news.appearance_preset", "appearance.preset", appearance.preset || "glass", [
              { value: "glass", label: "ed.news.appearance_glass" },
              { value: "default", label: "ed.news.appearance_default" },
            ], { fullWidth: true })}
          </div>
        </section>
      </div>
    `;

    this.shadowRoot.querySelectorAll('[data-mounted-control="entity"]').forEach(host => {
      this._mountEntityPicker(host);
    });
    this._ensureEditorControlsReady();
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}
  _lazyNodaliaNewsCardEditor = NodaliaNewsCardEditor;
  return NodaliaNewsCardEditor;
}
