// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  deleteByPath,
  deepClone,
  escapeHtml,
  fireEvent,
  isObject,
  normalizeTextKey,
  setByPath,
} from "./advance-vacuum-runtime";
import { DEFAULT_CONFIG, normalizeConfig } from "./advance-vacuum-config";
import {
  arrayFromMaybe,
  compactConfig,
  getByPath,
} from "./advance-vacuum-helpers";

let _lazyNodaliaAdvanceVacuumCardEditor;
export function loadNodaliaAdvanceVacuumCardEditor() {
  if (_lazyNodaliaAdvanceVacuumCardEditor) {
    return _lazyNodaliaAdvanceVacuumCardEditor;
  }
class NodaliaAdvanceVacuumCardEditor extends HTMLElement {
  static get properties() {
    return {
      hass: {},
      _config: {},
    };
  }

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig({});
    this._entityOptionsSignature = "";
    this._pendingEditorControlTags = new Set();
    this._showStyleSection = false;
    this._onInputChange = this._onInputChange.bind(this);
    this._onValueChanged = this._onValueChanged.bind(this);
    this._onEditorClick = this._onEditorClick.bind(this);
    }

  _attachEditorShadowListeners() {
    window.NodaliaUtils.bindShadowListeners(this, [
      ["value-changed", this._onValueChanged],
      ["click", this._onEditorClick],
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
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._render();
    this._restoreFocusState(focusState);
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

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorStatesSignature(hass, this._config?.language);
  }

  _captureFocusState() {
    return window.NodaliaUtils.captureEditorFocusState(this);
  }

  _restoreFocusState(focusState) {
    window.NodaliaUtils.restoreEditorFocusState(this, focusState);
  }

  _notifyConfigChange(nextConfig) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(nextConfig);
    this._render();
    this._restoreFocusState(focusState);
    fireEvent(this, "config-changed", {
      config: compactConfig(window.NodaliaUtils.stripEqualToDefaults(deepClone(this._config), DEFAULT_CONFIG) ?? {}),
    });
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
    this._watchEditorControlTag("ha-selector");
    this._watchEditorControlTag("ha-entity-picker");
    this._watchEditorControlTag("ha-icon-picker");
  }

  _onValueChanged(event) {
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
    const nextConfig = deepClone(this._config);

    if (nextValue === "" || nextValue === null || nextValue === undefined) {
      deleteByPath(nextConfig, control.dataset.field);
    } else {
      setByPath(nextConfig, control.dataset.field, nextValue);
    }

    this._notifyConfigChange(nextConfig);
  }

  _onEditorClick(event) {
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
    }
  }

  _onInputChange(event) {
    const target = event.currentTarget;
    const field = target.dataset.field;
    const valueType = target.dataset.valueType || "string";
    const checked = target.type === "checkbox" ? target.checked : undefined;

    // Keep typing stable in Home Assistant's editor by only committing
    // free-text fields on change/blur, not on every keystroke.
    if (
      event.type === "input" &&
      target.type !== "checkbox" &&
      target.tagName !== "SELECT"
    ) {
      return;
    }

    const nextConfig = deepClone(this._config);
    let nextValue = target.value;

    if (target.type === "checkbox") {
      nextValue = checked;
    } else if (valueType === "number") {
      nextValue = target.value === "" ? "" : Number(target.value);
    } else if (valueType === "csv") {
      const values = String(target.value || "")
        .split(",")
        .map(item => item.trim().toLowerCase())
        .filter(Boolean);
      nextValue = values.length ? values : "";
    } else if (valueType === "json") {
      if (target.value.trim() === "") {
        nextValue = "";
      } else {
        try {
          nextValue = JSON.parse(target.value);
        } catch (_error) {
          return;
        }
      }
    }

    if (nextValue === "" || nextValue === null || nextValue === undefined) {
      deleteByPath(nextConfig, field);
    } else {
      setByPath(nextConfig, field, nextValue);
    }

    this._notifyConfigChange(nextConfig);
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
    const hintRaw = options.hint ? String(options.hint) : "";
    const hintHtml = hintRaw
      ? `<span class="editor-field__hint">${escapeHtml(this._editorLabel(hintRaw))}</span>`
      : "";
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          type="${escapeHtml(options.type || "text")}"
          value="${escapeHtml(value ?? "")}"
          placeholder="${escapeHtml(options.placeholder || "")}"
        />
        ${hintHtml}
      </label>
    `;
  }

  _renderTextareaField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <textarea
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          rows="${escapeHtml(String(options.rows || 6))}"
          placeholder="${escapeHtml(options.placeholder || "")}"
        >${escapeHtml(value ?? "")}</textarea>
      </label>
    `;
  }

  _renderEntityPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder || "";
    const domains = arrayFromMaybe(options.domains).map(domain => String(domain).trim()).filter(Boolean);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-field="${escapeHtml(field)}"
          data-domains="${escapeHtml(domains.join(","))}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(placeholder)}"
        ></div>
      </div>
    `;
  }

  _getEntityOptions(field = "entity", domains = []) {
    const normalizedDomains = domains.map(domain => String(domain).trim()).filter(Boolean);
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => !normalizedDomains.length || normalizedDomains.some(domain => entityId.startsWith(`${domain}.`)))
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

    const currentValue = String(getByPath(this._config, field) || "").trim();
    if (currentValue && !options.some(option => option.value === currentValue)) {
      options.unshift({
        value: currentValue,
        label: currentValue,
        displayLabel: currentValue,
      });
    }

    return options;
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
      if (domains.length) {
        control.includeDomains = domains;
        control.entityFilter = stateObj =>
          domains.some(domain => String(stateObj?.entity_id || "").startsWith(`${domain}.`));
      }
      control.allowCustomEntity = true;
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      const entitySelector =
        domains.length === 1
          ? { domain: domains[0] }
          : domains.length > 1
            ? { domain: domains }
            : {};
      control.selector = { entity: entitySelector };
      if (placeholder) {
        control.setAttribute("label", placeholder);
      }
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || this._editorLabel("ed.vacuum.select_entity");
      control.appendChild(emptyOption);
      this._getEntityOptions(field, domains).forEach(option => {
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

    if (control instanceof HTMLSelectElement) {
      control.addEventListener("change", this._onInputChange);
    }

    host.replaceChildren(control);
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <ha-icon-picker
          class="editor-control-host"
          data-field="${escapeHtml(field)}"
          value="${escapeHtml(value || "")}"
          placeholder="${escapeHtml(options.placeholder || "mdi:robot-vacuum")}"
        ></ha-icon-picker>
      </div>
    `;
  }

  _renderSelectField(label, field, value, items, options = {}) {
    const tLabel = typeof label === "string" ? this._editorLabel(label) : label;
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${items.map(item => {
            const optLabel = item.labelKey ? this._editorLabel(item.labelKey) : item.label;
            return `
            <option value="${escapeHtml(item.value)}" ${String(value ?? "") === String(item.value) ? "selected" : ""}>
              ${escapeHtml(optLabel)}
            </option>
          `;
          }).join("")}
        </select>
      </label>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-toggle">
        <input data-field="${escapeHtml(field)}" type="checkbox" ${checked ? "checked" : ""} />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(tLabel)}</span>
      </label>
    `;
  }

  _getEntityOptionsMarkup() {
    const states = this._hass?.states || {};
    const allEntities = Object.keys(states).sort();
    const vacuumEntities = allEntities.filter(entityId => entityId.startsWith("vacuum."));
    const mapEntities = allEntities.filter(entityId => entityId.startsWith("camera.") || entityId.startsWith("image."));
    const helperEntities = allEntities.filter(entityId => entityId.startsWith("sensor.") || entityId.startsWith("image.") || entityId.startsWith("camera."));
    const selectEntities = allEntities.filter(entityId => entityId.startsWith("select."));
    const inputTextEntities = allEntities.filter(entityId => entityId.startsWith("input_text."));

    return `
      <datalist id="advance-vacuum-card-vacuum-entities">
        ${vacuumEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
      <datalist id="advance-vacuum-card-map-entities">
        ${mapEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
      <datalist id="advance-vacuum-card-helper-entities">
        ${helperEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
      <datalist id="advance-vacuum-card-select-entities">
        ${selectEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
      <datalist id="advance-vacuum-card-input-text-entities">
        ${inputTextEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";
    const animations = config.animations || DEFAULT_CONFIG.animations;
    this._ensureEditorControlsReady();

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
          display: flex;
          justify-content: flex-end;
        }

        .editor-section__toggle-button {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          gap: 6px;
          min-height: 30px;
          padding: 0 10px;
        }

        .editor-section__toggle-button ha-icon {
          --mdc-icon-size: 15px;
        }

        .editor-grid {
          align-items: start;
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .editor-field,
        .editor-toggle {
          align-content: start;
          align-self: start;
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .editor-field--full {
          grid-column: 1 / -1;
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

        .editor-field__hint {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 500;
          line-height: 1.45;
        }

        .editor-field input,
        .editor-field select,
        .editor-field textarea {
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

        .editor-field select {
          background-image:
            linear-gradient(45deg, transparent 50%, var(--secondary-text-color, #9aa0ad) 50%),
            linear-gradient(135deg, var(--secondary-text-color, #9aa0ad) 50%, transparent 50%);
          background-position:
            calc(100% - 17px) 50%,
            calc(100% - 12px) 50%;
          background-repeat: no-repeat;
          background-size: 5px 5px, 5px 5px;
          cursor: pointer;
          height: 40px;
          padding-inline-end: 36px;
        }

        .editor-field ha-icon-picker,
        .editor-field ha-selector,
        .editor-field ha-entity-picker,
        .editor-control-host {
          display: block;
          min-height: 40px;
          width: 100%;
        }

        .editor-field textarea {
          min-height: 120px;
          resize: vertical;
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.general_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.advance_vacuum.general_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("ed.advance_vacuum.card_language", "language", config.language ?? "auto", [
              { value: "auto", labelKey: "ed.advance_vacuum.lang_auto_ha_profile" },
              { value: "es", label: "Español" },
              { value: "en", label: "English" },
              { value: "de", label: "Deutsch" },
              { value: "fr", label: "Français" },
              { value: "it", label: "Italiano" },
              { value: "nl", label: "Nederlands" },
              { value: "no", label: "Norsk" },
            ], { fullWidth: true })}
            ${this._renderEntityPickerField("ed.vacuum.robot_entity", "entity", config.entity, { domains: ["vacuum"] })}
            ${this._renderTextField("ed.entity.name", "name", config.name, { placeholder: "Roborock Qrevo S" })}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, { placeholder: "mdi:robot-vacuum" })}
            ${this._renderEntityPickerField("ed.advance_vacuum.map_source_entity", "map_source.camera", config.map_source?.camera, { domains: ["camera", "image"] })}
            ${this._renderSelectField("ed.advance_vacuum.platform", "vacuum_platform", config.vacuum_platform || "auto", [
              { value: "auto", label: "Auto (Home Assistant)" },
              { value: "Roborock", label: "Roborock" },
              { value: "Tasshack/dreame-vacuum", label: "Dreame Vacuum" },
              { value: "Xiaomi Miio", label: "Xiaomi Miio" },
              { value: "Ecovacs", label: "Ecovacs (Home Assistant)" },
              { value: "DeebotUniverse/Deebot-4-Home-Assistant", label: "Deebot Universe (legacy)" },
              { value: "Matter", label: "Matter / vacuum.clean_area" },
              { value: "Hypfer/Valetudo", label: "Valetudo" },
              { value: "send_command", label: "Generic send_command" },
            ], { fullWidth: true })}
            ${normalizeTextKey(config.vacuum_platform || "auto").includes("valetudo")
              ? this._renderTextField("ed.advance_vacuum.mqtt_topic", "vacuum_mqtt_topic", config.vacuum_mqtt_topic || "", {
                  fullWidth: true,
                  placeholder: "valetudo/robot",
                  hint: "ed.advance_vacuum.mqtt_topic_hint",
                })
              : ""}
            ${this._renderEntityPickerField("ed.advance_vacuum.calibration_entity", "calibration_source.entity", config.calibration_source?.entity, { domains: ["camera", "image", "sensor"] })}
            ${this._renderEntityPickerField("ed.advance_vacuum.room_tracking_entity", "room_tracking.entity", config.room_tracking?.entity, { domains: ["sensor", "select", "text", "input_text"] })}
            ${this._renderEntityPickerField("ed.advance_vacuum.room_tracking_activity_entity", "room_tracking.activity_entity", config.room_tracking?.activity_entity, { domains: ["sensor", "binary_sensor", "select", "text", "input_text"] })}
            ${this._renderTextField("ed.advance_vacuum.room_tracking_attribute", "room_tracking.attribute", config.room_tracking?.attribute || "", {
              placeholder: "active_segments",
              hint: "ed.advance_vacuum.room_tracking_attribute_hint",
            })}
            ${this._renderCheckboxField("ed.advance_vacuum.room_tracking_auto", "room_tracking.auto_detect", config.room_tracking?.auto_detect !== false)}
            <div class="editor-field editor-field--full">
              <span>${escapeHtml(this._editorLabel("ed.advance_vacuum.shared_session_helper_label"))}</span>
              <div
                class="editor-control-host"
                data-mounted-control="entity"
                data-field="shared_cleaning_session_entity"
                data-domains="input_text"
                data-value="${escapeHtml(String(config.shared_cleaning_session_entity ?? ""))}"
                data-placeholder="${escapeHtml("input_text.roborock_session")}"
              ></div>
              <span class="editor-field__hint">${escapeHtml(
                this._editorLabel(
                  "ed.advance_vacuum.shared_session_helper_hint",
                ),
              )}</span>
            </div>
            ${this._renderTextField("ed.advance_vacuum.shared_session_webhook", "shared_cleaning_session_webhook", config.shared_cleaning_session_webhook || "", {
              fullWidth: true,
              placeholder: "nodalia_advance_vacuum_session",
              hint: "ed.advance_vacuum.shared_session_webhook_hint",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.advance_vacuum.map_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.advance_vacuum.map_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.advance_vacuum.calibration_from_camera", "calibration_source.camera", config.calibration_source?.camera !== false)}
            ${this._renderCheckboxField("ed.advance_vacuum.map_locked", "map_locked", config.map_locked !== false)}
            ${this._renderCheckboxField("ed.advance_vacuum.show_room_labels", "show_room_labels", config.show_room_labels !== false)}
            ${this._renderCheckboxField("ed.advance_vacuum.show_room_markers", "show_room_markers", config.show_room_markers !== false)}
            ${this._renderCheckboxField("ed.advance_vacuum.segment_mode", "allow_segment_mode", config.allow_segment_mode !== false)}
            ${this._renderCheckboxField("ed.advance_vacuum.zone_mode", "allow_zone_mode", config.allow_zone_mode !== false)}
            ${this._renderCheckboxField("ed.advance_vacuum.goto_mode", "allow_goto_mode", config.allow_goto_mode !== false)}
            ${this._renderTextField("ed.advance_vacuum.max_zones", "max_zone_selections", config.max_zone_selections, { type: "number", valueType: "number", placeholder: "5" })}
            ${this._renderTextField("ed.advance_vacuum.max_repeats", "max_repeats", config.max_repeats, { type: "number", valueType: "number", placeholder: "3" })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.advance_vacuum.advanced_controls_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.advance_vacuum.advanced_controls_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.advance_vacuum.show_all_mode", "show_all_mode", config.show_all_mode !== false)}
            ${this._renderEntityPickerField("ed.vacuum.suction_select", "suction_select_entity", config.suction_select_entity, { domains: ["select"] })}
            ${this._renderEntityPickerField("ed.vacuum.mop_select", "mop_select_entity", config.mop_select_entity, { domains: ["select"] })}
            ${this._renderEntityPickerField("ed.advance_vacuum.mop_mode_select", "mop_mode_select_entity", config.mop_mode_select_entity, { domains: ["select"] })}
            ${this._renderTextField("ed.advance_vacuum.custom_menu_label", "custom_menu.label", config.custom_menu?.label, {
              placeholder: "Base",
            })}
            ${this._renderIconPickerField("ed.advance_vacuum.custom_menu_icon", "custom_menu.icon", config.custom_menu?.icon, {
              placeholder: "mdi:home-import-outline",
            })}
            ${this._renderTextareaField("ed.advance_vacuum.custom_menu_items_json", "custom_menu.items", JSON.stringify(config.custom_menu?.items || [], null, 2), {
              fullWidth: true,
              rows: 10,
              valueType: "json",
              placeholder: '[\n  {\n    "label": "Vaciar deposito",\n    "icon": "mdi:delete-empty",\n    "visible_when": "docked",\n    "tap_action": {\n      "action": "perform-action",\n      "perform_action": "vacuum.send_command",\n      "service_data": {\n        "entity_id": "vacuum.roborock_qrevo_s",\n        "command": "app_start_emptying"\n      }\n    }\n  },\n  {\n    "label": "Volver a base",\n    "icon": "mdi:home-import-outline",\n    "visible_when": "active",\n    "builtin_action": "return_to_base"\n  }\n]',
            })}
            ${this._renderTextareaField("ed.advance_vacuum.routines_json", "routines", JSON.stringify(config.routines || [], null, 2), {
              fullWidth: true,
              rows: 12,
              valueType: "json",
              placeholder: '[\n  {\n    "entity": "button.roborock_qrevo_s_barrido_intensivo",\n    "label": "Barrido intensivo",\n    "icon": "mdi:weather-windy"\n  },\n  {\n    "entity": "button.roborock_qrevo_s_fregar_tras_aspirar",\n    "label": "Fregar tras aspirar",\n    "icon": "mdi:water"\n  },\n  {\n    "entity": "script.limpieza_rapida_cocina",\n    "label": "Cocina rapida",\n    "icon": "mdi:script-text-play"\n  }\n]',
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.advance_vacuum.visibility_always_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.vacuum.show_state_chip", "show_state_chip", config.show_state_chip !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_battery_chip", "show_battery_chip", config.show_battery_chip !== false)}
            ${this._renderCheckboxField("ed.advance_vacuum.show_header_icons", "show_header_icons", config.show_header_icons !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_return_base", "show_return_to_base", config.show_return_to_base !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_stop", "show_stop", config.show_stop !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_locate", "show_locate", config.show_locate !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.haptics_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.vacuum.enable_haptics", "haptics.enabled", config.haptics?.enabled === true)}
            ${this._renderCheckboxField("ed.vacuum.fallback_vibrate", "haptics.fallback_vibrate", config.haptics?.fallback_vibrate === true)}
            ${this._renderSelectField("ed.entity.haptic_style", "haptics.style", hapticStyle, [
              { value: "selection", label: "Selection" },
              { value: "light", label: "Light" },
              { value: "medium", label: "Medium" },
              { value: "heavy", label: "Heavy" },
              { value: "success", label: "Success" },
              { value: "warning", label: "Warning" },
              { value: "failure", label: "Failure" },
            ])}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.advance_vacuum.security_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.advance_vacuum.security_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField(
              "ed.entity.security_strict",
              "security.strict_service_actions",
              config.security?.strict_service_actions === true,
            )}
            ${this._renderCheckboxField(
              "ed.calendar.allow_webhooks_non_admin",
              "security.allow_webhooks_for_non_admin",
              config.security?.allow_webhooks_for_non_admin === true,
            )}
            ${
              config.security?.strict_service_actions === true
                ? this._renderTextField(
                    "ed.entity.allowed_services_csv",
                    "security.allowed_services",
                    Array.isArray(config.security?.allowed_services) ? config.security.allowed_services.join(", ") : "",
                    {
                      placeholder: "vacuum.send_command, script.run",
                      valueType: "csv",
                      fullWidth: true,
                    },
                  )
                : ""
            }
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.advance_vacuum.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.advance_vacuum.animations_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.vacuum.enable_animations", "animations.enabled", animations.enabled !== false)}
            ${this._renderCheckboxField("ed.vacuum.icon_animation_active", "animations.icon_animation", animations.icon_animation !== false)}
            ${this._renderTextField("ed.advance_vacuum.content_duration_ms", "animations.content_duration", animations.content_duration, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("ed.vacuum.panel_duration_ms", "animations.panel_duration", animations.panel_duration, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("ed.vacuum.button_bounce_ms", "animations.button_bounce_duration", animations.button_bounce_duration, {
              type: "number",
              valueType: "number",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.advance_vacuum.style_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.advance_vacuum.style_section_hint_map"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._editorLabel(this._showStyleSection ? "ed.weather.hide_style_settings" : "ed.weather.show_style_settings"))}</span>
              </button>
            </div>
          </div>
          ${this._showStyleSection ? `
            <div class="editor-grid">
              ${this._renderTextField("ed.entity.style_card_bg", "styles.card.background", config.styles?.card?.background)}
              ${this._renderTextField("ed.entity.style_card_border", "styles.card.border", config.styles?.card?.border)}
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
              ${this._renderTextField("ed.entity.style_card_shadow", "styles.card.box_shadow", config.styles?.card?.box_shadow)}
              ${this._renderTextField("ed.entity.style_card_padding", "styles.card.padding", config.styles?.card?.padding)}
              ${this._renderTextField("ed.entity.style_card_gap", "styles.card.gap", config.styles?.card?.gap)}
              ${this._renderTextField("ed.vacuum.style_main_bubble_size", "styles.icon.size", config.styles?.icon?.size)}
              ${this._renderTextField("ed.vacuum.style_chip_height", "styles.chip_height", config.styles?.chip_height)}
              ${this._renderTextField("ed.vacuum.style_chip_font", "styles.chip_font_size", config.styles?.chip_font_size)}
              ${this._renderTextField("ed.vacuum.style_title_size", "styles.title_size", config.styles?.title_size)}
              ${this._renderTextField("ed.vacuum.style_button_size", "styles.control.size", config.styles?.control?.size)}
              ${this._renderTextField("ed.advance_vacuum.map_radius", "styles.map.radius", config.styles?.map?.radius)}
              ${this._renderTextField("ed.advance_vacuum.map_marker_size", "styles.map.marker_size", config.styles?.map?.marker_size)}
              ${this._renderTextField("ed.advance_vacuum.map_label_size", "styles.map.label_size", config.styles?.map?.label_size)}
            </div>
          ` : ""}
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot.querySelectorAll("input, select, textarea").forEach(input => {
      input.addEventListener("change", this._onInputChange);
      if (
        (input.tagName === "INPUT" && input.type !== "checkbox") ||
        input.tagName === "TEXTAREA"
      ) {
        input.addEventListener("input", this._onInputChange);
      }
    });

    this.shadowRoot.querySelectorAll('[data-mounted-control="entity"]').forEach(host => this._mountEntityPicker(host));

    this.shadowRoot.querySelectorAll("ha-icon-picker").forEach(control => {
      control.hass = this._hass;
    });

    this.shadowRoot.querySelectorAll('input[data-field="entity"]').forEach(input => input.setAttribute("list", "advance-vacuum-card-vacuum-entities"));
    this.shadowRoot.querySelectorAll('input[data-field="map_source.camera"]').forEach(input => input.setAttribute("list", "advance-vacuum-card-map-entities"));
    this.shadowRoot.querySelectorAll('input[data-field="calibration_source.entity"]').forEach(input => input.setAttribute("list", "advance-vacuum-card-helper-entities"));
    this.shadowRoot.querySelectorAll('input[data-field="shared_cleaning_session_entity"]').forEach(input => input.setAttribute("list", "advance-vacuum-card-input-text-entities"));
    this.shadowRoot.querySelectorAll('input[data-field="suction_select_entity"], input[data-field="mop_select_entity"], input[data-field="mop_mode_select_entity"]').forEach(input => input.setAttribute("list", "advance-vacuum-card-select-entities"));
  }
}
  _lazyNodaliaAdvanceVacuumCardEditor = NodaliaAdvanceVacuumCardEditor;
  return NodaliaAdvanceVacuumCardEditor;
}
