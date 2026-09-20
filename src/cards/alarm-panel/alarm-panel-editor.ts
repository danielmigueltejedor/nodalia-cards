// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { ALARM_STATE_TINT_FALLBACKS } from "./alarm-panel-constants";
import {
  clamp,
  compactConfig,
  deepClone,
  deleteByPath,
  escapeHtml,
  escapeSelectorValue,
  fireEvent,
  getByPath,
  isObject,
  mergeConfig,
  normalizeTextKey,
  setByPath,
} from "./alarm-panel-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./alarm-panel-config";
import {
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
} from "./alarm-panel-helpers";

let _lazyNodaliaAlarmPanelCardEditor;
export function loadNodaliaAlarmPanelCardEditor() {
  if (_lazyNodaliaAlarmPanelCardEditor) {
    return _lazyNodaliaAlarmPanelCardEditor;
  }
class NodaliaAlarmPanelCardEditor extends HTMLElement {
  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showAnimationSection = false;
    this._showStyleSection = false;
    this._pendingEditorControlTags = new Set();
    this._emitConfigTimer = 0;
    /** `styles` | `animations` when pointerdown handled that toggle; following click for same id is ignored. */
    this._suppressEditorToggleClickFor = null;
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    }

  _attachEditorShadowListeners() {
    window.NodaliaUtils.bindShadowListeners(this, [
      ["input", this._onShadowInput],
      ["change", this._onShadowInput],
      ["value-changed", this._onShadowValueChanged],
      ["pointerdown", this._onShadowPointerDown],
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
    if (this._emitConfigTimer) {
      window.clearTimeout(this._emitConfigTimer);
      this._emitConfigTimer = 0;
    }
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

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(
      hass,
      this._config?.language,
      id =>
        id.startsWith("alarm_control_panel.") || id.startsWith("input_text."),
    );
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

  _getDomainEntityOptions(domains = [], path = "entity") {
    const normalizedDomains = Array.isArray(domains)
      ? domains.filter(Boolean)
      : String(domains || "").split(",").map(domain => domain.trim()).filter(Boolean);

    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => normalizedDomains.some(domain => entityId.startsWith(`${domain}.`)))
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

    const currentValue = String(getByPath(this._config, path) || "").trim();
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

  _scheduleEmitConfig() {
    if (this._emitConfigTimer) {
      window.clearTimeout(this._emitConfigTimer);
    }
    // Defer config emission one tick so blur/change re-renders
    // do not swallow nearby click interactions in the editor.
    this._emitConfigTimer = window.setTimeout(() => {
      this._emitConfigTimer = 0;
      this._emitConfig();
    }, 0);
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
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      case "number": {
        const n = Number(input.value);
        return Number.isFinite(n) ? n : undefined;
      }
      default:
        return input.value;
    }
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement);

    if (!input?.dataset?.field) {
      return;
    }

    event.stopPropagation();

    const nextValue = this._readFieldValue(input);
    this._setFieldValue(input.dataset.field, nextValue);
    this._setEditorConfig();

    if (event.type === "change") {
      this._scheduleEmitConfig();
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

    const toggleId = toggleButton.dataset.editorToggle;
    if (toggleId !== "styles" && toggleId !== "animations") {
      return;
    }

    if (this._suppressEditorToggleClickFor) {
      if (toggleId === this._suppressEditorToggleClickFor) {
        this._suppressEditorToggleClickFor = null;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      this._suppressEditorToggleClickFor = null;
    }

    event.preventDefault();
    event.stopPropagation();

    const focusState = this._captureFocusState();

    if (toggleId === "styles") {
      this._showStyleSection = !this._showStyleSection;
    } else {
      this._showAnimationSection = !this._showAnimationSection;
    }

    this._render();
    this._restoreFocusState(focusState);
  }

  _onShadowPointerDown(event) {
    const toggleButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorToggle);

    if (!toggleButton) {
      return;
    }

    const toggleId = toggleButton.dataset.editorToggle;
    if (toggleId !== "styles" && toggleId !== "animations") {
      return;
    }

    // Handle known section toggles on pointerdown so an in-flight blur/change
    // re-render from another field cannot swallow this interaction.
    // Do not rely on click + defaultPrevented: click is a separate event.
    // Suppress the following click so we do not double-toggle on pointer devices.
    event.preventDefault();
    event.stopPropagation();

    this._suppressEditorToggleClickFor = toggleId;

    const focusState = this._captureFocusState();

    if (toggleId === "styles") {
      this._showStyleSection = !this._showStyleSection;
    } else {
      this._showAnimationSection = !this._showAnimationSection;
    }

    this._render();
    this._restoreFocusState(focusState);
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
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";

    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(options.type || "text")}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(valueType)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        />
      </label>
    `;
  }

  _renderColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("ed.entity.custom_color");
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

  _renderEntityPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder || "";
    const domains = Array.isArray(options.domains)
      ? options.domains.join(",")
      : String(options.domains || "");

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-domains="${escapeHtml(domains)}"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(placeholder)}"
        ></div>
      </div>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder || "";

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="icon-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(placeholder)}"
        ></div>
      </div>
    `;
  }

  _getCodeInputEditorMode(value = this._config?.show_code_input) {
    if (value === true) {
      return "always";
    }
    if (value === false) {
      return "never";
    }
    return "auto";
  }

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    const domains = String(host.dataset.domains || "")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = domains;
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => domains.some(domain => String(stateObj?.entity_id || "").startsWith(`${domain}.`));
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: domains.length === 1
          ? { domain: domains[0] }
          : {},
      };
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || this._editorLabel("ed.person.select_entity");
      control.appendChild(emptyOption);
      this._getDomainEntityOptions(domains, field).forEach(option => {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.displayLabel;
        control.appendChild(optionElement);
      });
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      control.hass = this._hass;
    }

    if ("value" in control) {
      control.value = nextValue;
    }

    host.replaceChildren(control);
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";
    const animations = config.animations || DEFAULT_CONFIG.animations;

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

        .editor-field span,
        .editor-toggle span {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 600;
        }

        .editor-field input,
        .editor-field select {
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
          height: 22px;
          width: 22px;
        }

        .editor-toggle {
          align-items: center;
          grid-template-columns: auto 1fr;
          padding-top: 20px;
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

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }

        @media (max-width: 720px) {
          .editor-grid {
            grid-template-columns: 1fr;
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.alarm_panel.general_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityPickerField("ed.entity.entity_main", "entity", config.entity, {
              domains: ["alarm_control_panel"],
              placeholder: "alarm_control_panel.casa",
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, {
              placeholder: "mdi:shield-home",
              fullWidth: true,
            })}
            ${this._renderCheckboxField("ed.entity.show_entity_picture", "show_entity_picture", config.show_entity_picture === true)}
            ${this._renderTextField("ed.entity.entity_picture", "entity_picture", config.entity_picture, {
              placeholder: "/local/alarm.png",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: "Alarm",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.fav.alarm_pin", "code", config.code, {
              placeholder: "1234",
            })}
            ${this._renderEntityPickerField("ed.fav.alarm_code_helper", "code_entity", config.code_entity, {
              domains: ["input_text"],
              placeholder: "input_text.codigo_alarma",
              fullWidth: true,
            })}
            ${this._renderSelectField(
              "ed.entity.compact_mode",
              "compact_layout_mode",
              config.compact_layout_mode || "auto",
              [
                { value: "auto", label: "ed.entity.compact_auto" },
                { value: "always", label: "ed.entity.compact_always" },
                { value: "never", label: "ed.entity.compact_never" },
              ],
              { fullWidth: true },
            )}
            ${this._renderCheckboxField("ed.alarm_panel.show_state_bubble", "show_state", config.show_state !== false)}
            ${this._renderSelectField(
              "ed.fav.alarm_show_pin",
              "show_code_input",
              this._getCodeInputEditorMode(config.show_code_input),
              [
                { value: "auto", label: "ed.media_player.tristate_auto" },
                { value: "always", label: "ed.media_player.tristate_always" },
                { value: "never", label: "ed.media_player.tristate_never" },
              ],
              { fullWidth: true },
            )}
            ${this._renderTextField("ed.alarm_panel.wrong_code_feedback_ms", "wrong_code_feedback_ms", config.wrong_code_feedback_ms, {
              fullWidth: true,
              type: "number",
              valueType: "number",
              placeholder: "5000",
            })}
            <div class="editor-section__hint" style="grid-column: 1 / -1; margin-top: -4px;">
              ${escapeHtml(this._editorLabel("ed.alarm_panel.wrong_code_feedback_hint"))}
            </div>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.alarm_panel.modes_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.alarm_panel.modes_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.fav.alarm_show_disarm", "show_disarm", config.show_disarm !== false)}
            ${this._renderCheckboxField("ed.fav.alarm_show_arm_home", "show_arm_home", config.show_arm_home !== false)}
            ${this._renderCheckboxField("ed.fav.alarm_show_arm_away", "show_arm_away", config.show_arm_away !== false)}
            ${this._renderCheckboxField("ed.fav.alarm_show_arm_night", "show_arm_night", config.show_arm_night !== false)}
            ${this._renderCheckboxField("ed.fav.alarm_show_arm_vacation", "show_arm_vacation", config.show_arm_vacation === true)}
            ${this._renderCheckboxField("ed.fav.alarm_show_custom_bypass", "show_custom_bypass", config.show_custom_bypass === true)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.climate.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.alarm_panel.animations_hint"))}</div>
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
                  ${this._renderCheckboxField("ed.vacuum.enable_animations", "animations.enabled", animations.enabled !== false)}
                  ${this._renderTextField("ed.power_flow.content_duration_ms", "animations.content_duration", animations.content_duration, {
                    type: "number",
                  })}
                  ${this._renderTextField("ed.power_flow.button_bounce_ms", "animations.button_bounce_duration", animations.button_bounce_duration, {
                    type: "number",
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.person.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.alarm_panel.haptics_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.entity.enable_haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("ed.entity.fallback_vibrate", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "ed.entity.haptic_style",
              "haptics.style",
              hapticStyle,
              [
                { value: "selection", label: "ed.person.haptic_selection" },
                { value: "light", label: "ed.person.haptic_light" },
                { value: "medium", label: "ed.person.haptic_medium" },
                { value: "heavy", label: "ed.person.haptic_heavy" },
                { value: "success", label: "ed.person.haptic_success" },
                { value: "warning", label: "ed.person.haptic_warning" },
                { value: "failure", label: "ed.person.haptic_failure" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.climate.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.alarm_panel.styles_section_hint"))}</div>
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
                  ${this._renderColorField("ed.person.style_card_bg", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("ed.person.style_card_border", "styles.card.border", config.styles.card.border)}
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
                  ${this._renderTextField("ed.person.style_card_shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("ed.person.style_card_padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("ed.person.style_card_gap", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderTextField("ed.entity.style_main_button_size", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderColorField("ed.entity.style_main_bubble_bg", "styles.icon.background", config.styles.icon.background, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
                  })}
                  ${this._renderColorField("ed.entity.style_icon_on", "styles.icon.on_color", config.styles.icon.on_color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderColorField("ed.entity.style_icon_off", "styles.icon.off_color", config.styles.icon.off_color, {
                    fallbackValue: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
                  })}
                  ${this._renderTextField("ed.entity.style_aux_button_size", "styles.control.size", config.styles.control.size)}
                  ${this._renderColorField("ed.entity.style_accent_bg", "styles.control.accent_background", config.styles.control.accent_background, {
                    fallbackValue: "rgba(113, 192, 255, 0.18)",
                  })}
                  ${this._renderColorField("ed.entity.style_accent_color", "styles.control.accent_color", config.styles.control.accent_color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderColorField("ed.alarm_panel.tint_disarmed", "styles.state_tints.disarmed", config.styles.state_tints?.disarmed, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.disarmed,
                  })}
                  ${this._renderColorField("ed.alarm_panel.tint_armed_home", "styles.state_tints.armed_home", config.styles.state_tints?.armed_home, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.armed_home,
                  })}
                  ${this._renderColorField("ed.alarm_panel.tint_armed_away", "styles.state_tints.armed_away", config.styles.state_tints?.armed_away, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.armed_away,
                  })}
                  ${this._renderColorField("ed.alarm_panel.tint_armed_night", "styles.state_tints.armed_night", config.styles.state_tints?.armed_night, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.armed_night,
                  })}
                  ${this._renderColorField("ed.alarm_panel.tint_armed_vacation", "styles.state_tints.armed_vacation", config.styles.state_tints?.armed_vacation, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.armed_vacation,
                  })}
                  ${this._renderColorField("ed.alarm_panel.tint_armed_custom", "styles.state_tints.armed_custom_bypass", config.styles.state_tints?.armed_custom_bypass, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.armed_custom_bypass,
                  })}
                  ${this._renderColorField("ed.alarm_panel.tint_arming", "styles.state_tints.arming", config.styles.state_tints?.arming, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.arming,
                  })}
                  ${this._renderColorField("ed.alarm_panel.tint_pending", "styles.state_tints.pending", config.styles.state_tints?.pending, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.pending,
                  })}
                  ${this._renderColorField("ed.alarm_panel.tint_triggered", "styles.state_tints.triggered", config.styles.state_tints?.triggered, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.triggered,
                  })}
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
                  ${this._renderTextField("ed.alarm_panel.input_height", "styles.input_height", config.styles.input_height)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('.editor-control-host[data-mounted-control="entity"]')
      .forEach(host => this._mountEntityPicker(host));
    this.shadowRoot
      .querySelectorAll('.editor-control-host[data-mounted-control="icon-picker"]')
      .forEach(host => window.NodaliaUtils.mountIconPickerHost(host, {
        hass: this._hass,
        onShadowInput: this._onShadowInput,
        onShadowValueChanged: this._onShadowValueChanged,
      }));

    this._ensureEditorControlsReady();
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}
  _lazyNodaliaAlarmPanelCardEditor = NodaliaAlarmPanelCardEditor;
  return NodaliaAlarmPanelCardEditor;
}
