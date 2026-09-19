// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  deepClone,
  deleteByPath,
  escapeHtml,
  fireEvent,
  getByPath,
  setByPath,
} from "./scenes-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./scenes-config";
import {
  compactConfig,
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
  moveItem,
} from "./scenes-helpers";

export class NodaliaScenesCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG, { keepEmpty: true });
    this._hass = null;
    this._entityOptionsSignature = "";
    this._pendingEditorControlTags = new Set();
    this._showStyleSection = false;
    this._showActionsSection = false;
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
  }

  _attachEditorShadowListeners() {
    window.NodaliaUtils.bindShadowListeners(this, [
      ["input", this._onShadowInput],
      ["change", this._onShadowInput],
      ["value-changed", this._onShadowValueChanged],
      ["click", this._onShadowClick],
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

  set hass(hass) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender =
      !this._hass ||
      nextSignature !== this._entityOptionsSignature ||
      !this.shadowRoot?.innerHTML;

    this._hass = hass;
    this._entityOptionsSignature = nextSignature;

    if (!shouldRender) {
      this._syncMountedPickerHass();
      return;
    }

    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {}, { keepEmpty: true });
    this._render();
    this._restoreFocusState(focusState);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils?.editorFilteredStatesSignature?.(
      hass,
      this._config?.language,
      id => id.startsWith("scene."),
    ) ?? "";
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
    this._watchEditorControlTag("ha-icon-picker");
  }

  _syncMountedPickerHass() {
    if (!this._hass || !this.shadowRoot) {
      return;
    }

    this.shadowRoot.querySelectorAll("ha-entity-picker[data-field], ha-icon-picker[data-field]").forEach(control => {
      if ("hass" in control) {
        control.hass = this._hass;
      }
    });
  }

  _captureFocusState() {
    return window.NodaliaUtils.captureEditorFocusState(this);
  }

  _restoreFocusState(focusState) {
    window.NodaliaUtils.restoreEditorFocusState(this, focusState);
  }

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    const hass = this._hass ?? this.hass;
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", s);
  }

  _emitConfig() {
    const focusState = this._captureFocusState();
    const nextConfig = deepClone(this._config);
    this._config = normalizeConfig(nextConfig, { keepEmpty: true });
    this._render();
    this._restoreFocusState(focusState);
    const base = window.NodaliaUtils?.stripEqualToDefaults?.(nextConfig, DEFAULT_CONFIG) ?? nextConfig;
    const exportConfig = {
      ...base,
      scenes: normalizeSceneRows(nextConfig.scenes, { keepEmpty: false }),
    };
    fireEvent(this, "config-changed", {
      config: compactConfig(exportConfig),
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
    if (valueType === "color") {
      return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
    }
    return input.value;
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement);
    if (!input?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    this._setFieldValue(input.dataset.field, this._readFieldValue(input));
    this._config = normalizeConfig(this._config, { keepEmpty: true });
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
    const field = control.dataset.field;
    const nextValue = typeof event.detail?.value === "string" ? event.detail.value : control.value;
    const previousValue = getByPath(this._config, field);
    if (String(nextValue ?? "") === String(previousValue ?? "")) {
      return;
    }
    if (typeof control.dataset?.value === "string") {
      control.dataset.value = String(nextValue || "");
    }
    this._setFieldValue(field, nextValue);
    this._config = normalizeConfig(this._config, { keepEmpty: true });
    this._emitConfig();
  }

  _onShadowClick(event) {
    const toggleButton = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.editorToggle);
    if (toggleButton) {
      event.preventDefault();
      event.stopPropagation();
      const focusState = this._captureFocusState();
      if (toggleButton.dataset.editorToggle === "styles") {
        this._showStyleSection = !this._showStyleSection;
      } else if (toggleButton.dataset.editorToggle === "actions") {
        this._showActionsSection = !this._showActionsSection;
      }
      this._render();
      this._restoreFocusState(focusState);
      return;
    }

    const button = event.composedPath().find(node => node instanceof HTMLButtonElement && node.dataset?.action);
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.action;
    const index = Number(button.dataset.index);
    this._config.scenes = Array.isArray(this._config.scenes) ? this._config.scenes : [];

    if (action === "add-scene") {
      this._config.scenes.push({ entity: "", name: "", icon: "", color: "" });
      this._emitConfig();
      return;
    }

    if (!Number.isInteger(index) || index < 0 || index >= this._config.scenes.length) {
      return;
    }

    if (action === "remove-scene") {
      this._config.scenes.splice(index, 1);
      this._emitConfig();
      return;
    }

    if (action === "move-scene-up") {
      moveItem(this._config.scenes, index, index - 1);
      this._emitConfig();
      return;
    }

    if (action === "move-scene-down") {
      moveItem(this._config.scenes, index, index + 1);
      this._emitConfig();
    }
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(options.type || "text")}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          value="${escapeHtml(inputValue)}"
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
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options.map(option => `
            <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
              ${escapeHtml(this._editorLabel(option.label))}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _renderColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("ed.person.custom_color");
    const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
    const currentValue = value === undefined || value === null || value === ""
      ? fallbackValue
      : String(value);
    const colorModel = getEditorColorModel(currentValue, fallbackValue);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="${escapeHtml(tColorCustom)}">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="color"
              data-alpha="${escapeHtml(String(colorModel.alpha))}"
              value="${escapeHtml(colorModel.hex)}"
              aria-label="${escapeHtml(tLabel)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>
    `;
  }

  _renderEntityPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="scene-entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
        ></div>
      </label>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    return `
      <div class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <ha-icon-picker
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        ></ha-icon-picker>
      </div>
    `;
  }

  _mountSceneEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = ["scene"];
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => String(stateObj?.entity_id || "").startsWith("scene.");
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: {
          domain: "scene",
        },
      };
    } else {
      control = document.createElement("input");
      control.type = "text";
      if (placeholder) {
        control.placeholder = placeholder;
      }
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      control.hass = this._hass;
    }

    if ("value" in control) {
      control.value = nextValue;
    }

    if (control.tagName !== "INPUT") {
      control.addEventListener("value-changed", this._onShadowValueChanged);
    } else {
      control.addEventListener("change", this._onShadowInput);
    }

    host.replaceChildren(control);
  }

  _renderSceneEditorCard(item, index, total) {
    return `
      <div class="scene-editor-card">
        <div class="scene-editor-card__header">
          <div class="scene-editor-card__title">${escapeHtml(this._editorLabel("ed.scenes.scenes_section_title"))} ${index + 1}</div>
          <div class="scene-editor-card__actions">
            <button type="button" data-action="move-scene-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" data-action="move-scene-down" data-index="${index}" ${index >= total - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="danger" data-action="remove-scene" data-index="${index}">${escapeHtml(this._editorLabel("ed.scenes.remove_scene"))}</button>
          </div>
        </div>
        ${this._renderEntityPickerField("ed.scenes.scene_entity", `scenes.${index}.entity`, item.entity, { placeholder: "scene.living_room_relax" })}
        ${this._renderTextField("ed.scenes.scene_name", `scenes.${index}.name`, item.name, { fullWidth: true, placeholder: this._editorLabel("ed.scenes.scene_name") })}
        ${this._renderIconPickerField("ed.scenes.scene_icon", `scenes.${index}.icon`, item.icon, { placeholder: "mdi:palette-outline" })}
        ${this._renderColorField("ed.scenes.scene_color", `scenes.${index}.color`, item.color, { fullWidth: true })}
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || {};
    const scenes = Array.isArray(config.scenes) ? config.scenes : [];
    const isSingle = config.layout === "single";
    const visibleScenes = isSingle ? scenes.slice(0, 1) : scenes;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        * { box-sizing: border-box; }
        .editor { display: grid; gap: 16px; }
        .editor-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 18px;
          display: grid;
          gap: 12px;
          padding: 14px;
        }
        .editor-section__title { font-size: 14px; font-weight: 700; }
        .editor-section__hint { color: var(--secondary-text-color); font-size: 12px; line-height: 1.45; }
        .editor-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .editor-grid--stacked { grid-template-columns: 1fr; }
        .editor-field { display: grid; gap: 6px; min-width: 0; }
        .editor-field--full { grid-column: 1 / -1; }
        .editor-field span, .editor-toggle span { color: var(--secondary-text-color); font-size: 12px; font-weight: 600; }
        .editor-field input, .editor-field select {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 14px;
          color: var(--primary-text-color);
          font: inherit;
          min-width: 0;
          outline: none;
          padding: 10px 12px;
          width: 100%;
        }
        .editor-color-field {
          align-items: center;
          display: flex;
          gap: 10px;
          min-height: 46px;
        }
        .editor-color-picker {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: 40px;
          justify-content: center;
          position: relative;
          width: 40px;
        }
        .editor-color-picker input {
          cursor: pointer;
          inset: 0;
          opacity: 0;
          padding: 0;
          position: absolute;
        }
        .editor-color-picker:hover,
        .editor-color-picker:focus-within {
          border-color: color-mix(in srgb, var(--primary-text-color) 22%, transparent);
        }
        .editor-color-swatch {
          --editor-swatch: #71c0ff;
          background:
            linear-gradient(var(--editor-swatch), var(--editor-swatch)),
            conic-gradient(from 90deg, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 25%, rgba(0, 0, 0, 0.12) 0 50%, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 0 75%, rgba(0, 0, 0, 0.12) 0);
          background-position: center;
          background-size: cover, 10px 10px;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
          border-radius: 999px;
          display: block;
          height: 22px;
          width: 22px;
        }
        .editor-styles-subgroup {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }
        .editor-styles-subgroup__title {
          font-size: 12px;
          font-weight: 700;
        }
        .editor-styles-subgroup__hint {
          color: var(--secondary-text-color);
          font-size: 11px;
          line-height: 1.45;
          margin-top: -4px;
        }
        .editor-chip-radius__options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .editor-chip-radius__option {
          align-items: center;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 12px;
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          padding: 8px 12px;
        }
        .editor-chip-radius__option:has(input:checked) {
          background: color-mix(in srgb, var(--primary-color) 10%, transparent);
          border-color: var(--primary-color);
        }
        .editor-chip-radius__option input[type="radio"] {
          accent-color: var(--primary-color);
          margin: 0;
          min-height: auto;
          padding: 0;
          width: auto;
        }
        .editor-toggle {
          align-items: center;
          cursor: pointer;
          display: grid;
          gap: 10px;
          grid-template-columns: auto 1fr;
          min-height: 40px;
        }
        .editor-toggle input { opacity: 0; position: absolute; width: 1px; height: 1px; }
        .editor-toggle__switch {
          background: color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          border-radius: 999px;
          height: 22px;
          position: relative;
          width: 38px;
        }
        .editor-toggle__switch::after {
          background: #fff;
          border-radius: 999px;
          content: "";
          height: 18px;
          left: 2px;
          position: absolute;
          top: 2px;
          transition: transform 160ms ease;
          width: 18px;
        }
        .editor-toggle input:checked + .editor-toggle__switch {
          background: var(--primary-color);
        }
        .editor-toggle input:checked + .editor-toggle__switch::after {
          transform: translateX(16px);
        }
        .editor-section__actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .editor-section__toggle-button, button {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          min-height: 34px;
          padding: 0 12px;
        }
        button.danger { color: var(--error-color); }
        button:disabled { cursor: default; opacity: 0.45; }
        .scene-editor-list { display: grid; gap: 12px; }
        .scene-editor-card {
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 16px;
          display: grid;
          gap: 12px;
          padding: 14px;
        }
        .scene-editor-card__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }
        .scene-editor-card__title { font-size: 13px; font-weight: 700; }
        .scene-editor-card__actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
        .empty-note { color: var(--secondary-text-color); font-size: 12px; line-height: 1.5; }
        @media (max-width: 640px) { .editor-grid { grid-template-columns: 1fr; } }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.general_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.scenes.general_section_hint"))}</div>
          <div class="editor-grid editor-grid--stacked">
            ${!isSingle ? this._renderTextField("ed.weather.card_name", "name", config.name, {
              fullWidth: true,
              placeholder: this._editorLabel("ed.scenes.name_placeholder"),
            }) : ""}
            ${!isSingle ? this._renderCheckboxField("ed.scenes.show_title", "show_title", config.show_title !== false) : ""}
            ${this._renderSelectField(
              "ed.scenes.layout",
              "layout",
              config.layout,
              [
                { value: "grid", label: "ed.scenes.layout_grid" },
                { value: "list", label: "ed.scenes.layout_list" },
                { value: "single", label: "ed.scenes.layout_single" },
              ],
              { fullWidth: true },
            )}
            ${config.layout === "grid" ? this._renderTextField("ed.scenes.columns", "columns", config.columns, { type: "number", valueType: "number" }) : ""}
            ${this._renderCheckboxField("ed.scenes.use_entity_icon", "use_entity_icon", config.use_entity_icon !== false)}
            ${this._renderCheckboxField("ed.scenes.show_entity_picture", "use_entity_picture", config.use_entity_picture === true)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.scenes.scenes_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.scenes.scenes_section_hint"))}</div>
          <div class="scene-editor-list">
            ${
              visibleScenes.length
                ? visibleScenes.map((item, index) => this._renderSceneEditorCard(item, index, visibleScenes.length)).join("")
                : `<div class="empty-note">${escapeHtml(this._editorLabel("ed.scenes.scenes_empty"))}</div>`
            }
          </div>
          <div class="editor-actions" ${isSingle && scenes.length ? "hidden" : ""}>
            <button type="button" data-action="add-scene">${escapeHtml(this._editorLabel("ed.scenes.add_scene"))}</button>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.scenes.tap_action"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.scenes.actions_section_hint"))}</div>
            <div class="editor-section__actions">
              <button type="button" class="editor-section__toggle-button" data-editor-toggle="actions" aria-expanded="${this._showActionsSection ? "true" : "false"}">
                ${escapeHtml(this._showActionsSection ? this._editorLabel("ed.weather.hide_style_settings") : this._editorLabel("ed.weather.show_style_settings"))}
              </button>
            </div>
          </div>
          ${
            this._showActionsSection
              ? `
            <div class="editor-grid editor-grid--stacked">
              ${this._renderSelectField(
                "ed.scenes.tap_action",
                "tap_action",
                config.tap_action,
                [
                  { value: "activate", label: "ed.scenes.tap_activate" },
                  { value: "more-info", label: "ed.scenes.tap_more_info" },
                  { value: "none", label: "ed.scenes.hold_none" },
                ],
                { fullWidth: true },
              )}
              ${this._renderSelectField(
                "ed.scenes.hold_action",
                "hold_action",
                config.hold_action,
                [
                  { value: "more-info", label: "ed.scenes.hold_more_info" },
                  { value: "activate", label: "ed.scenes.hold_activate" },
                  { value: "none", label: "ed.scenes.hold_none" },
                ],
                { fullWidth: true },
              )}
            </div>
          `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.person.haptics_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.person.haptics_section_hint"))}</div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderCheckboxField("ed.person.enable_haptics", "haptics.enabled", config.haptics?.enabled !== false)}
            ${this._renderCheckboxField("ed.person.fallback_vibrate", "haptics.fallback_vibrate", config.haptics?.fallback_vibrate === true)}
            ${this._renderSelectField(
              "ed.person.haptic_style",
              "haptics.style",
              config.haptics?.style || "medium",
              [
                { value: "selection", label: "ed.person.haptic_selection" },
                { value: "light", label: "ed.person.haptic_light" },
                { value: "medium", label: "ed.person.haptic_medium" },
                { value: "heavy", label: "ed.person.haptic_heavy" },
                { value: "success", label: "ed.person.haptic_success" },
                { value: "warning", label: "ed.person.haptic_warning" },
                { value: "failure", label: "ed.person.haptic_failure" },
              ],
              { fullWidth: true },
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.weather.styles_section_hint"))}</div>
            <div class="editor-section__actions">
              <button type="button" class="editor-section__toggle-button" data-editor-toggle="styles" aria-expanded="${this._showStyleSection ? "true" : "false"}">
                ${escapeHtml(this._showStyleSection ? this._editorLabel("ed.weather.hide_style_settings") : this._editorLabel("ed.weather.show_style_settings"))}
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
            <div class="editor-grid editor-grid--stacked">
              ${this._renderColorField("ed.scenes.styles_accent", "styles.accent", config.styles?.accent || DEFAULT_CONFIG.styles.accent, { fullWidth: true })}
              <div class="editor-styles-subgroup editor-field--full">
                <div class="editor-styles-subgroup__title">${escapeHtml(this._editorLabel("ed.scenes.styles_card_section"))}</div>
                <div class="editor-styles-subgroup__hint">${escapeHtml(this._editorLabel("ed.scenes.styles_card_hint"))}</div>
                ${this._renderColorField("ed.entity.style_card_bg", "styles.card.background", config.styles?.card?.background, { fullWidth: true })}
                ${this._renderTextField("ed.entity.style_card_border", "styles.card.border", config.styles?.card?.border, { fullWidth: true })}
                ${this._renderTextField("ed.entity.style_card_shadow", "styles.card.box_shadow", config.styles?.card?.box_shadow, { fullWidth: true })}
                ${this._renderTextField("ed.person.style_card_padding", "styles.card.padding", config.styles?.card?.padding || DEFAULT_CONFIG.styles.card.padding)}
                ${this._renderTextField("ed.person.style_card_gap", "styles.card.gap", config.styles?.card?.gap || DEFAULT_CONFIG.styles.card.gap)}
                ${window.NodaliaUtils.renderEditorCardBorderRadiusHtml({
                  escapeHtml,
                  field: "styles.card.border_radius",
                  value: config.styles?.card?.border_radius || DEFAULT_CONFIG.styles.card.border_radius,
                  tHeading: this._editorLabel("ed.entity.style_card_radius_presets"),
                  labels: {
                    pill: this._editorLabel("ed.entity.chip_radius_pill"),
                    soft: this._editorLabel("ed.entity.chip_radius_soft"),
                    round: this._editorLabel("ed.entity.chip_radius_round"),
                    square: this._editorLabel("ed.entity.chip_radius_square"),
                  },
                })}
              </div>

              <div class="editor-styles-subgroup editor-field--full">
                <div class="editor-styles-subgroup__title">${escapeHtml(this._editorLabel("ed.scenes.styles_icon_section"))}</div>
                <div class="editor-styles-subgroup__hint">${escapeHtml(this._editorLabel("ed.scenes.styles_icon_hint"))}</div>
                ${this._renderTextField("ed.person.style_title_size", "styles.icon.size", config.styles?.icon?.size || DEFAULT_CONFIG.styles.icon.size)}
                ${this._renderColorField("ed.entity.style_main_bubble_bg", "styles.icon.background", config.styles?.icon?.background, { fullWidth: true })}
                ${this._renderColorField("ed.person.style_avatar_color", "styles.icon.color", config.styles?.icon?.color, { fullWidth: true })}
                ${this._renderColorField("ed.entity.style_icon_on", "styles.icon.on_color", config.styles?.icon?.on_color, { fullWidth: true })}
              </div>

              <div class="editor-styles-subgroup editor-field--full">
                <div class="editor-styles-subgroup__title">${escapeHtml(this._editorLabel("ed.scenes.styles_buttons_section"))}</div>
                <div class="editor-styles-subgroup__hint">${escapeHtml(this._editorLabel("ed.scenes.styles_buttons_hint"))}</div>
                ${this._renderColorField("ed.scenes.style_button_bg", "styles.button.background", config.styles?.button?.background, { fullWidth: true })}
                ${this._renderTextField("ed.scenes.style_button_border", "styles.button.border", config.styles?.button?.border, { fullWidth: true })}
                ${this._renderTextField("ed.scenes.style_button_min_height", "styles.button.min_height", config.styles?.button?.min_height || DEFAULT_CONFIG.styles.button.min_height)}
                ${this._renderTextField("ed.entity.style_main_button_size", "styles.button.icon_size", config.styles?.button?.icon_size || DEFAULT_CONFIG.styles.button.icon_size)}
                ${this._renderTextField("ed.circular_gauge.value_size", "styles.button.label_size", config.styles?.button?.label_size || DEFAULT_CONFIG.styles.button.label_size)}
                ${this._renderTextField("ed.person.style_title_size", "styles.title_size", config.styles?.title_size || DEFAULT_CONFIG.styles.title_size)}
                ${window.NodaliaUtils.renderEditorChipBorderRadiusHtml({
                  escapeHtml,
                  field: "styles.button.border_radius",
                  value: config.styles?.button?.border_radius || DEFAULT_CONFIG.styles.button.border_radius,
                  tHeading: this._editorLabel("ed.entity.style_chip_radius"),
                  labels: {
                    pill: this._editorLabel("ed.entity.chip_radius_pill"),
                    soft: this._editorLabel("ed.entity.chip_radius_soft"),
                    round: this._editorLabel("ed.entity.chip_radius_round"),
                    square: this._editorLabel("ed.entity.chip_radius_square"),
                  },
                })}
              </div>

              <div class="editor-styles-subgroup editor-field--full">
                <div class="editor-styles-subgroup__title">${escapeHtml(this._editorLabel("ed.scenes.styles_launch_section"))}</div>
                <div class="editor-styles-subgroup__hint">${escapeHtml(this._editorLabel("ed.scenes.styles_launch_hint"))}</div>
                ${this._renderTextField("ed.scenes.launch_duration", "animations.launch_duration", config.animations?.launch_duration || DEFAULT_CONFIG.animations.launch_duration, { type: "number", valueType: "number" })}
              </div>
            </div>
          `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot.querySelectorAll('[data-mounted-control="scene-entity"]').forEach(host => this._mountSceneEntityPicker(host));
    this.shadowRoot.querySelectorAll("ha-icon-picker[data-field]").forEach(control => {
      control.hass = this._hass;
      control.value = control.dataset.value || "";
      control.addEventListener("value-changed", this._onShadowValueChanged);
    });
    this._ensureEditorControlsReady();
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}
