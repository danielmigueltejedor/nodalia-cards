// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  clamp,
  compactConfig,
  deepClone,
  deleteByPath,
  escapeHtml,
  escapeSelectorValue,
  fireEvent,
  isObject,
  mergeConfig,
  normalizeTextKey,
  setByPath,
} from "./fan-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./fan-config";
import {
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
  translatePresetLabel,
} from "./fan-helpers";

export class NodaliaFanCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showStyleSection = false;
    this._showAnimationSection = false;
    this._showTapActionsSection = false;
    this._pendingEditorControlTags = new Set();
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
      return;
    }

    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
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
    this._watchEditorControlTag("ha-icon-picker");
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id => id.startsWith("fan."));
  }

  _getFanEntityOptions() {
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => entityId.startsWith("fan."))
      .map(([entityId, state]) => {
        const friendlyName = String(state?.attributes?.friendly_name || "").trim();
        return {
          value: entityId,
          label: friendlyName || entityId,
          displayLabel: friendlyName && friendlyName !== entityId
            ? `${friendlyName} (${entityId})`
            : entityId,
        };
      })
      .sort((left, right) => (
        left.label.localeCompare(right.label, sortLoc, { sensitivity: "base" })
        || left.value.localeCompare(right.value, sortLoc, { sensitivity: "base" })
      ));

    const currentValue = String(this._config?.entity || "").trim();
    if (currentValue && !options.some(option => option.value === currentValue)) {
      options.unshift({
        value: currentValue,
        label: currentValue,
        displayLabel: currentValue,
      });
    }

    return options;
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
      config: compactConfig(window.NodaliaUtils.stripEqualToDefaults(nextConfig, DEFAULT_CONFIG) ?? {}),
    });
  }

  _setEditorConfig() {
    this._config = normalizeConfig(compactConfig(this._config));
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

    switch (valueType) {
      case "boolean":
        return Boolean(input.checked);
      case "number": {
        if (input.value === "") {
          return "";
        }

        const numericValue = Number(input.value);
        return Number.isFinite(numericValue) ? numericValue : "";
      }
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      default:
        return input.value;
    }
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement);

    if (!input?.dataset?.field) {
      if (input?.dataset?.modeListField && input.dataset.modeValue !== undefined) {
        event.stopPropagation();
        this._setPresetModeVisibility(input.dataset.modeValue, input.checked);
        this._setEditorConfig();

        if (event.type === "change") {
          this._emitConfig();
        }
      }
      return;
    }

    event.stopPropagation();

    const nextValue = this._readFieldValue(input);
    this._setFieldValue(input.dataset.field, nextValue);
    this._setEditorConfig();

    if (event.type === "change") {
      this._emitConfig();
    }
  }

  _onShadowValueChanged(event) {
    const control = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.field);

    if (!control?.dataset?.field) {
      return;
    }

    event.stopPropagation();

    const nextValue = typeof event.detail?.value === "string"
      ? event.detail.value
      : control.value;
    if (typeof control.dataset?.value === "string") {
      control.dataset.value = String(nextValue || "");
    }

    const field = control.dataset.field;
    const previousEntity = field === "entity" ? String(this._config?.entity || "").trim() : "";
    this._setFieldValue(field, nextValue);
    if (field === "entity") {
      window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass, { previousEntity });
    }
    this._setEditorConfig();
    this._emitConfig();
  }

  _onShadowClick(event) {
    const toggleButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorToggle);

    if (!toggleButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (toggleButton.dataset.editorToggle === "styles") {
      this._showStyleSection = !this._showStyleSection;
      this._render();
      return;
    }

    if (toggleButton.dataset.editorToggle === "animations") {
      this._showAnimationSection = !this._showAnimationSection;
      this._render();
      return;
    }

    if (toggleButton.dataset.editorToggle === "tap_actions") {
      this._showTapActionsSection = !this._showTapActionsSection;
      this._render();
    }
  }

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    const hass = this._hass ?? this.hass;
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", s);
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const min = options.min !== undefined ? `min="${escapeHtml(String(options.min))}"` : "";
    const max = options.max !== undefined ? `max="${escapeHtml(String(options.max))}"` : "";
    const step = options.step !== undefined ? `step="${escapeHtml(String(options.step))}"` : "";
    const valueType = options.valueType || "string";
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(inputType)}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(valueType)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
          ${min}
          ${max}
          ${step}
        />
      </label>
    `;
  }

  _renderColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("ed.weather.custom_color");
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

  _renderCheckboxField(label, field, checked) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-field="${escapeHtml(field)}"
          data-value-type="boolean"
          ${checked ? "checked" : ""}
        />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(tLabel)}</span>
      </label>
    `;
  }

  _getFanState() {
    return this._config?.entity ? this._hass?.states?.[this._config.entity] || null : null;
  }

  _getPresetModeVisibilityOptions() {
    const fanState = this._getFanState();
    return Array.isArray(fanState?.attributes?.preset_modes)
      ? fanState.attributes.preset_modes.map(item => String(item || "").trim()).filter(Boolean)
      : [];
  }

  _getHiddenPresetModes() {
    return Array.isArray(this._config?.hidden_preset_modes)
      ? this._config.hidden_preset_modes.map(item => String(item || "").trim()).filter(Boolean)
      : [];
  }

  _isPresetModeVisible(value) {
    const expectedKey = normalizeTextKey(value);
    return !this._getHiddenPresetModes().some(item => normalizeTextKey(item) === expectedKey);
  }

  _setPresetModeVisibility(value, visible) {
    const rawValue = String(value || "").trim();
    if (!rawValue) {
      return;
    }

    const nextValues = this._getHiddenPresetModes().filter(item => normalizeTextKey(item) !== normalizeTextKey(rawValue));
    if (!visible) {
      nextValues.push(rawValue);
    }

    if (nextValues.length) {
      setByPath(this._config, "hidden_preset_modes", nextValues);
      return;
    }

    deleteByPath(this._config, "hidden_preset_modes");
  }

  _renderPresetModeVisibilityField(modeValue) {
    const translatedLabel = translatePresetLabel(modeValue);
    const showRawValue = normalizeTextKey(translatedLabel) !== normalizeTextKey(modeValue);
    const label = showRawValue ? `${translatedLabel} (${modeValue})` : translatedLabel;

    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-mode-list-field="hidden_preset_modes"
          data-mode-value="${escapeHtml(modeValue)}"
          ${this._isPresetModeVisible(modeValue) ? "checked" : ""}
        />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(label)}</span>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options
            .map(option => `
              <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
                ${escapeHtml(this._editorLabel(option.label))}
              </option>
            `)
            .join("")}
        </select>
      </label>
    `;
  }

  _renderFanEntityField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="fan-entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
        ></div>
      </div>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
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

  _mountFanEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = ["fan"];
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => String(stateObj?.entity_id || "").startsWith("fan.");
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: {
          domain: "fan",
        },
      };
    } else {
      control = document.createElement("select");
      this._getFanEntityOptions().forEach(option => {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.displayLabel;
        control.appendChild(optionElement);
      });
      control.addEventListener("change", this._onShadowInput);
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      control.hass = this._hass;
    }

    if ("value" in control) {
      control.value = nextValue;
    }

    if (control.tagName !== "SELECT") {
      control.addEventListener("value-changed", this._onShadowValueChanged);
    }

    host.replaceChildren(control);
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";
    const presetModeVisibilityOptions = this._getPresetModeVisibilityOptions();
    const phFanName = this._editorLabel("ed.light.name_placeholder");
    const tapAction = config.tap_action || "toggle";
    const iconTapActionRaw = String(config.icon_tap_action ?? "").trim();
    const iconTapSelectValue = iconTapActionRaw;
    const showIconTapService = iconTapSelectValue === "service";
    const showCardTapService = tapAction === "service";
    const holdAction = config.hold_action || "none";
    const iconHoldSelect = String(config.icon_hold_action ?? "").trim();
    const showCardHoldService = holdAction === "service";
    const showIconHoldService = iconHoldSelect === "service" || (iconHoldSelect === "" && holdAction === "service");
    const showTapServiceSecurity = showIconTapService || showCardTapService || showCardHoldService || showIconHoldService;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        .editor {
          color: var(--primary-text-color);
          display: grid;
          gap: 16px;
        }

        .editor-section {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 18px;
          display: grid;
          gap: 14px;
          padding: 16px;
        }

        .editor-section__header {
          display: grid;
          gap: 4px;
        }

        .editor-section__title {
          font-size: 15px;
          font-weight: 700;
        }

        .editor-section__hint {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }

        .editor-section__actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 2px;
        }

        .editor-section__toggle-button {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          gap: 8px;
          min-height: 34px;
          padding: 0 12px;
        }

        .editor-section__toggle-button ha-icon {
          --mdc-icon-size: 16px;
        }

        .editor-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .editor-grid--stacked {
          grid-template-columns: 1fr;
        }

        .editor-field,
        .editor-toggle {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .editor-field--full {
          grid-column: 1 / -1;
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
          appearance: auto;
          margin: 0;
          min-height: auto;
          padding: 0;
          width: auto;
        }


        .editor-field:has(> .editor-control-host[data-mounted-control="entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="entity-picker"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="vacuum-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="select-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="sensor-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="light-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="fan-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="humidifier-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="icon-picker"]),
        .editor-field:has(> ha-icon-picker) {
          grid-column: 1 / -1;
        }

        .editor-field > span,
        .editor-toggle > span {
          font-size: 12px;
          font-weight: 600;
        }

        .editor-field input,
        .editor-field select {
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

        .editor-color-field {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          min-height: 40px;
        }

        .editor-color-picker {
          align-items: center;
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
          position: absolute;
        }

        .editor-color-picker:hover,
        .editor-color-picker:focus-within {
          border-color: color-mix(in srgb, var(--primary-text-color) 22%, transparent);
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
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
          height: 18px;
          width: 18px;
        }

        .editor-color-picker .editor-color-swatch {
          height: 22px;
          width: 22px;
        }

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }

        .editor-subsection {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 10px;
          padding: 12px;
        }

        .editor-subsection__title {
          font-size: 12px;
          font-weight: 700;
        }

        .editor-subsection__hint {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }

        .editor-toggle {
          align-items: center;
          grid-template-columns: auto 1fr;
          padding-top: 20px;
        }

        .editor-toggle input {
          accent-color: var(--primary-color);
          height: 18px;
          margin: 0;
          width: 18px;
        }

        @media (max-width: 640px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }

          .editor-toggle {
            padding-top: 0;
          }
        }
      
        :is(.editor-toggle, .editor-checkbox) {
          align-items: center;
          column-gap: 10px;
          cursor: pointer;
          grid-auto-flow: row;
          grid-template-columns: auto minmax(0, 1fr);
          justify-content: stretch;
          min-height: 40px;
          padding-top: 0;
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
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          display: inline-flex;
          font-size: 0;
          height: 22px;
          line-height: 0;
          position: relative;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
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

        .editor-toggle__label {
          min-width: 0;
        }

        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }

        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch::before {
          transform: translateX(18px);
        }

        :is(.editor-toggle, .editor-checkbox) input:focus-visible + .editor-toggle__switch {
          box-shadow:
            0 0 0 3px color-mix(in srgb, var(--primary-text-color) 14%, transparent),
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }
</style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.general_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderFanEntityField("ed.fan.fan_entity", "entity", config.entity, {
              placeholder: "fan.salon",
              fullWidth: true,
            })}
            ${this._renderSelectField("ed.entity.layout", "layout", config.layout || "compact", [
              { value: "compact", label: "ed.shared.layout_compact" },
              { value: "circular", label: "ed.shared.layout_circular" },
            ])}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, {
              placeholder: "mdi:fan",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: phFanName,
              fullWidth: true,
            })}
            ${this._renderCheckboxField("ed.entity.show_entity_picture", "show_entity_picture", config.show_entity_picture === true)}
            ${this._renderTextField("ed.entity.entity_picture", "entity_picture", config.entity_picture, {
              placeholder: "/local/fan.png",
              fullWidth: true,
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_hint"))}</div>
            <div class="editor-section__actions">
              ${window.NodaliaUtils.renderEditorCollapsibleToggleHtml({
                toggleId: "tap_actions",
                expanded: this._showTapActionsSection === true,
                showLabel: this._editorLabel("ed.shared.show_tap_action_settings"),
                hideLabel: this._editorLabel("ed.shared.hide_tap_action_settings"),
                escapeHtml,
              })}
            </div>
          </div>
          ${
            this._showTapActionsSection
              ? `
          <div class="editor-grid editor-grid--stacked">
            ${this._renderSelectField(
              "ed.light.icon_tap_action",
              "icon_tap_action",
              iconTapSelectValue,
              [
                { value: "", label: "ed.entity.icon_tap_inherit" },
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.light.card_tap_action",
              "tap_action",
              tapAction,
              [
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${
              showIconTapService
                ? `
                  ${this._renderTextField("ed.entity.tap_service_field", "icon_tap_service", config.icon_tap_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.tap_service_data_json", "icon_tap_service_data", config.icon_tap_service_data, {
                    placeholder: '{"brightness_pct": 50}',
                  })}
                `
                : ""
            }
            ${
              showCardTapService
                ? `
                  ${this._renderTextField("ed.entity.tap_service_field", "tap_service", config.tap_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.tap_service_data_json", "tap_service_data", config.tap_service_data, {
                    placeholder: '{"brightness_pct": 70}',
                  })}
                `
                : ""
            }
            ${
              showTapServiceSecurity
                ? `
                  ${this._renderCheckboxField(
                    "ed.entity.security_strict",
                    "security.strict_service_actions",
                    config.security?.strict_service_actions !== false,
                  )}
                  ${
                    config.security?.strict_service_actions !== false
                      ? this._renderTextField(
                          "ed.entity.allowed_services_csv",
                          "security.allowed_services",
                          Array.isArray(config.security?.allowed_services) ? config.security.allowed_services.join(", ") : "",
                          {
                            placeholder: "browser_mod.javascript, light.turn_on",
                            valueType: "csv",
                            fullWidth: true,
                          },
                        )
                      : ""
                  }
                `
                : ""
            }
            ${
              iconTapSelectValue === "url"
                ? `
                  ${this._renderTextField("ed.entity.tap_url_field", "icon_tap_url", config.icon_tap_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.tap_new_tab", "icon_tap_new_tab", config.icon_tap_new_tab === true)}
                `
                : ""
            }
            ${
              tapAction === "url"
                ? `
                  ${this._renderTextField("ed.entity.tap_url_field", "tap_url", config.tap_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.tap_new_tab", "tap_new_tab", config.tap_new_tab === true)}
                `
                : ""
            }
            <div class="editor-section__hint editor-field--full" style="margin-top: 8px;">${escapeHtml(this._editorLabel("ed.light.hold_actions_section_hint"))}</div>
            ${this._renderSelectField(
              "ed.light.icon_hold_action",
              "icon_hold_action",
              iconHoldSelect,
              [
                { value: "", label: "ed.entity.icon_hold_inherit" },
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.light.card_hold_action",
              "hold_action",
              holdAction,
              [
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${
              showIconHoldService
                ? `
                  ${this._renderTextField("ed.entity.hold_service_field", "icon_hold_service", config.icon_hold_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.hold_service_data_json", "icon_hold_service_data", config.icon_hold_service_data, {
                    placeholder: '{"brightness_pct": 50}',
                  })}
                `
                : ""
            }
            ${
              showCardHoldService
                ? `
                  ${this._renderTextField("ed.entity.hold_service_field", "hold_service", config.hold_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.hold_service_data_json", "hold_service_data", config.hold_service_data, {
                    placeholder: '{"brightness_pct": 70}',
                  })}
                `
                : ""
            }
            ${
              iconHoldSelect === "url" || (iconHoldSelect === "" && holdAction === "url")
                ? `
                  ${this._renderTextField("ed.entity.hold_url_field", "icon_hold_url", config.icon_hold_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.hold_new_tab", "icon_hold_new_tab", config.icon_hold_new_tab === true)}
                `
                : ""
            }
            ${
              holdAction === "url"
                ? `
                  ${this._renderTextField("ed.entity.hold_url_field", "hold_url", config.hold_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.hold_new_tab", "hold_new_tab", config.hold_new_tab === true)}
                `
                : ""
            }
          </div>

              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.visibility_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.vacuum.layout_narrow",
              "compact_layout_mode",
              config.compact_layout_mode || "auto",
              [
                { value: "auto", label: "ed.vacuum.layout_auto" },
                { value: "always", label: "ed.vacuum.layout_always" },
                { value: "never", label: "ed.vacuum.layout_never" },
              ],
            )}
            ${this._renderCheckboxField("ed.fan.show_state_bubble", "show_state", config.show_state === true)}
            ${this._renderCheckboxField("ed.fan.speed_chip", "show_percentage_chip", config.show_percentage_chip !== false)}
            ${this._renderCheckboxField("ed.fan.mode_chip", "show_mode_chip", config.show_mode_chip !== false)}
            ${this._renderCheckboxField("ed.fan.show_slider", "show_slider", config.show_slider !== false)}
            ${this._renderCheckboxField("ed.fan.oscillation_button", "show_oscillation", config.show_oscillation !== false)}
            ${this._renderCheckboxField("ed.fan.preset_modes_toggle", "show_preset_modes", config.show_preset_modes !== false)}
            ${
              presetModeVisibilityOptions.length
                ? `
                  <div class="editor-subsection editor-field--full">
                    <div class="editor-subsection__title">${escapeHtml(this._editorLabel("ed.fan.preset_modes_title"))}</div>
                    <div class="editor-subsection__hint">${escapeHtml(this._editorLabel("ed.fan.preset_modes_hint"))}</div>
                    <div class="editor-grid editor-grid--stacked">
                      ${presetModeVisibilityOptions.map(mode => this._renderPresetModeVisibilityField(mode)).join("")}
                    </div>
                  </div>
                `
                : ""
            }
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.haptics_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.vacuum.enable_haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("ed.vacuum.fallback_vibrate", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderCheckboxField("ed.haptics.slider_percentage", "haptics.scrolls.percentage", config.haptics.scrolls?.percentage !== false)}
            ${this._renderSelectField(
              "ed.vacuum.haptic_style",
              "haptics.style",
              hapticStyle,
              [
                { value: "selection", label: "ed.weather.haptic_selection" },
                { value: "light", label: "ed.weather.haptic_light" },
                { value: "medium", label: "ed.weather.haptic_medium" },
                { value: "heavy", label: "ed.weather.haptic_heavy" },
                { value: "success", label: "ed.weather.haptic_success" },
                { value: "warning", label: "ed.weather.haptic_warning" },
                { value: "failure", label: "ed.weather.haptic_failure" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.fan.animations_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("ed.weather.hide_animation_settings") : this._editorLabel("ed.weather.show_animation_settings"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("ed.vacuum.enable_animations", "animations.enabled", config.animations.enabled !== false)}
                  ${this._renderCheckboxField("ed.vacuum.icon_animation_active", "animations.icon_animation", config.animations.icon_animation !== false)}
                  ${this._renderTextField("ed.light.anim_power_ms", "animations.power_duration", config.animations.power_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 4000,
                    step: 10,
                  })}
                  ${this._renderTextField("ed.light.anim_controls_ms", "animations.controls_duration", config.animations.controls_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 2400,
                    step: 10,
                  })}
                  ${this._renderTextField("ed.fan.anim_preset_ms", "animations.preset_duration", config.animations.preset_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 2400,
                    step: 10,
                  })}
                  ${this._renderTextField("ed.vacuum.button_bounce_ms", "animations.button_bounce_duration", config.animations.button_bounce_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 1200,
                    step: 10,
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.styles_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showStyleSection ? this._editorLabel("ed.weather.hide_style_settings") : this._editorLabel("ed.weather.show_style_settings"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("ed.entity.style_card_bg", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("ed.entity.style_card_border", "styles.card.border", config.styles.card.border)}
                  ${window.NodaliaUtils.renderEditorCardBorderRadiusHtml({
                    escapeHtml,
                    field: "styles.card.border_radius",
                    value: config.styles?.card?.border_radius,
                    tHeading: this._editorLabel("ed.entity.style_card_radius_presets"),
                    labels: {
                      pill: this._editorLabel("ed.entity.chip_radius_pill"),
                      soft: this._editorLabel("ed.entity.chip_radius_soft"),
                      round: this._editorLabel("ed.entity.chip_radius_round"),
                      square: this._editorLabel("ed.entity.chip_radius_square"),
                    },
                  })}
                  <div class="editor-section__hint editor-field--full" style="margin-top: -6px;">${escapeHtml(this._editorLabel("ed.entity.style_card_radius_yaml_hint"))}</div>
                  ${this._renderTextField("ed.entity.style_card_shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("ed.entity.style_card_padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("ed.entity.style_card_gap", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderTextField("ed.entity.style_main_button_size", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderColorField("ed.entity.style_icon_on", "styles.icon.on_color", config.styles.icon.on_color)}
                  ${this._renderColorField("ed.entity.style_icon_off", "styles.icon.off_color", config.styles.icon.off_color)}
                  ${this._renderTextField("ed.vacuum.style_button_size", "styles.control.size", config.styles.control.size)}
                  ${this._renderColorField("ed.entity.style_accent_bg", "styles.control.accent_background", config.styles.control.accent_background)}
                  ${this._renderColorField("ed.entity.style_accent_color", "styles.control.accent_color", config.styles.control.accent_color)}
                  ${this._renderTextField("ed.entity.style_chip_height", "styles.chip_height", config.styles.chip_height)}
                  ${this._renderTextField("ed.entity.style_chip_font", "styles.chip_font_size", config.styles.chip_font_size)}
                  ${this._renderTextField("ed.entity.style_chip_padding", "styles.chip_padding", config.styles.chip_padding)}
                  ${window.NodaliaUtils.renderEditorChipBorderRadiusHtml({
                    escapeHtml,
                    field: "styles.chip_border_radius",
                    value: config.styles?.chip_border_radius,
                    tHeading: this._editorLabel("ed.entity.style_chip_radius"),
                    labels: {
                      pill: this._editorLabel("ed.entity.chip_radius_pill"),
                      soft: this._editorLabel("ed.entity.chip_radius_soft"),
                      round: this._editorLabel("ed.entity.chip_radius_round"),
                      square: this._editorLabel("ed.entity.chip_radius_square"),
                    },
                  })}
                  ${this._renderTextField("ed.entity.style_title_size", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("ed.light.slider_wrap_height", "styles.slider_wrap_height", config.styles.slider_wrap_height)}
                  ${this._renderTextField("ed.light.slider_height", "styles.slider_height", config.styles.slider_height)}
                  ${this._renderColorField("ed.light.slider_color", "styles.slider_color", config.styles.slider_color)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="fan-entity"]')
      .forEach(host => this._mountFanEntityPicker(host));

    this.shadowRoot
      .querySelectorAll("ha-icon-picker[data-field]")
      .forEach(control => {
        control.hass = this._hass;
        control.value = control.dataset.value || "";
        control.addEventListener("value-changed", this._onShadowValueChanged);
      });

    this._ensureEditorControlsReady();
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}
