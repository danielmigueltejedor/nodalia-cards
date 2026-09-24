// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  MOP_MODE_PATTERNS,
  SHARED_SMART_MODE_PATTERNS,
  SUCTION_MODE_PATTERNS,
} from "./vacuum-constants";
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
} from "./vacuum-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./vacuum-config";
import {
  arrayFromCsv,
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
  humanizeModeLabel,
  isHelperRelatedToConfiguredVacuum,
  listVacuumObjectIds,
} from "./vacuum-helpers";

let _lazyNodaliaVacuumCardEditor;
export function loadNodaliaVacuumCardEditor() {
  if (_lazyNodaliaVacuumCardEditor) {
    return _lazyNodaliaVacuumCardEditor;
  }
class NodaliaVacuumCardEditor extends HTMLElement {
  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
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
    return window.NodaliaUtils.editorFilteredStatesSignature(
      hass,
      this._config?.language,
      id =>
        id.startsWith("vacuum.") || id.startsWith("select.") || id.startsWith("sensor."),
    );
  }

  _buildEntityOptions(filterFn, currentValue = "") {
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId, state]) => filterFn(entityId, state))
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

    if (currentValue && !options.some(option => option.value === currentValue)) {
      options.unshift({
        value: currentValue,
        label: currentValue,
        displayLabel: currentValue,
      });
    }

    return options;
  }

  _getVacuumEntityOptions() {
    return this._buildEntityOptions(
      entityId => entityId.startsWith("vacuum."),
      String(this._config?.entity || "").trim(),
    );
  }

  _getSelectEntityOptions(field) {
    return this._buildEntityOptions(
      entityId => entityId.startsWith("select."),
      String(this._config?.[field] || "").trim(),
    );
  }

  _getSensorEntityOptions(field) {
    return this._buildEntityOptions(
      entityId => entityId.startsWith("sensor."),
      String(this._config?.[field] || "").trim(),
    );
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
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      case "csv":
        return arrayFromCsv(input.value);
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
        this._setModeVisibility(input.dataset.modeListField, input.dataset.modeValue, input.checked);
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

    if (toggleButton.dataset.editorToggle === "tap_actions") {
      this._showTapActionsSection = !this._showTapActionsSection;
      this._render();
      return;
    }

    if (toggleButton.dataset.editorToggle === "styles") {
      this._showStyleSection = !this._showStyleSection;
      this._render();
      return;
    }

    if (toggleButton.dataset.editorToggle === "animations") {
      this._showAnimationSection = !this._showAnimationSection;
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
        />
      </label>
    `;
  }

  _renderColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("ed.vacuum.custom_color");
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

  _getVacuumState() {
    return this._config?.entity ? this._hass?.states?.[this._config.entity] || null : null;
  }

  _getEditorSelectOptionsForMode(kind) {
    const explicitEntity = kind === "mop"
      ? this._config?.mop_select_entity
      : this._config?.suction_select_entity;
    const entityId = explicitEntity || this._guessRelatedSelectEntity(kind);
    const state = entityId ? this._hass?.states?.[entityId] || null : null;

    return Array.isArray(state?.attributes?.options)
      ? state.attributes.options.map(item => String(item || "").trim()).filter(Boolean)
      : [];
  }

  _guessRelatedSelectEntity(kind) {
    if (!this._hass?.states || !this._config?.entity) {
      return "";
    }

    const objectId = normalizeTextKey(String(this._config.entity).split(".").slice(1).join("_"));
    if (!objectId) {
      return "";
    }

    const patterns = kind === "mop"
      ? ["mop", "water", "water_level", "water_volume", "scrub"]
      : ["fan_speed", "fan_power", "suction", "cleaning_mode"];

    const states = this._hass.states;
    const registry = this._hass.entities || {};
    const vacuumObjectIds = listVacuumObjectIds(states);
    const vacuumDeviceId = registry[this._config.entity]?.device_id || "";
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const candidates = Object.keys(states)
      .filter(entityId => entityId.startsWith("select."))
      .filter(entityId => isHelperRelatedToConfiguredVacuum({
        candidateId: entityId,
        searchable: states[entityId]?.attributes?.friendly_name || "",
        isSameDevice: Boolean(vacuumDeviceId && registry[entityId]?.device_id === vacuumDeviceId),
        objectId,
        vacuumObjectIds,
      }))
      .filter(entityId => patterns.some(pattern => entityId.includes(pattern)))
      .sort((left, right) => left.localeCompare(right, sortLoc));

    return candidates[0] || "";
  }

  _categorizeModeOption(value) {
    const key = normalizeTextKey(value);

    if (MOP_MODE_PATTERNS.some(pattern => key.includes(pattern))) {
      return "mop";
    }

    if (SUCTION_MODE_PATTERNS.some(pattern => key.includes(pattern))) {
      return "suction";
    }

    return "unknown";
  }

  _isSharedSmartMode(value) {
    const key = normalizeTextKey(value);
    return SHARED_SMART_MODE_PATTERNS.some(pattern => key.includes(pattern));
  }

  _getEditorFanPresets() {
    const configuredPresets = Array.isArray(this._config?.fan_presets) ? this._config.fan_presets : [];
    if (configuredPresets.length) {
      return configuredPresets;
    }

    const vacuumState = this._getVacuumState();
    return Array.isArray(vacuumState?.attributes?.fan_speed_list)
      ? vacuumState.attributes.fan_speed_list.map(item => String(item || "").trim()).filter(Boolean)
      : [];
  }

  _getModeVisibilityOptions(kind) {
    const selectOptions = this._getEditorSelectOptionsForMode(kind);
    if (selectOptions.length) {
      return selectOptions;
    }

    const rawPresets = this._getEditorFanPresets();
    return rawPresets.filter(option => {
      const optionKind = this._categorizeModeOption(option);
      const isSharedSmartMode = this._isSharedSmartMode(option);

      if (kind === "mop") {
        return optionKind === "mop" || isSharedSmartMode;
      }

      return optionKind !== "mop" || isSharedSmartMode;
    });
  }

  _getHiddenModeList(field) {
    return Array.isArray(this._config?.[field])
      ? this._config[field].map(item => String(item || "").trim()).filter(Boolean)
      : [];
  }

  _isModeVisible(field, value) {
    const expectedKey = normalizeTextKey(value);
    return !this._getHiddenModeList(field).some(item => normalizeTextKey(item) === expectedKey);
  }

  _setModeVisibility(field, value, visible) {
    const rawValue = String(value || "").trim();
    if (!rawValue) {
      return;
    }

    const nextValues = this._getHiddenModeList(field).filter(item => normalizeTextKey(item) !== normalizeTextKey(rawValue));
    if (!visible) {
      nextValues.push(rawValue);
    }

    if (nextValues.length) {
      setByPath(this._config, field, nextValues);
      return;
    }

    deleteByPath(this._config, field);
  }

  _renderModeVisibilityField(field, modeValue, kind) {
    const translatedLabel = humanizeModeLabel(modeValue, kind, this._hass ?? this.hass, this._config?.language ?? "auto");
    const showRawValue = normalizeTextKey(translatedLabel) !== normalizeTextKey(modeValue);
    const label = showRawValue ? `${translatedLabel} (${modeValue})` : translatedLabel;

    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-mode-list-field="${escapeHtml(field)}"
          data-mode-value="${escapeHtml(modeValue)}"
          ${this._isModeVisible(field, modeValue) ? "checked" : ""}
        />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(label)}</span>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options, renderOptions = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
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

  _renderEntityPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholderAttr = options.placeholder
      ? `data-placeholder="${escapeHtml(options.placeholder)}"`
      : "";
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="${escapeHtml(options.controlType || "entity")}"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          ${placeholderAttr}
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

  _mountEntityPicker(host, pickerOptions) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || pickerOptions.field || "entity";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || pickerOptions.placeholder || "";
    const domains = pickerOptions.includeDomains || [];
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      if (domains.length) {
        control.includeDomains = domains;
        control.entityFilter =
          pickerOptions.entityFilter ||
          (stateObj => domains.some(d => String(stateObj?.entity_id || "").startsWith(`${d}.`)));
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
      pickerOptions.getOptions(field).forEach(option => {
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

  _mountVacuumEntityPicker(host) {
    this._mountEntityPicker(host, {
      includeDomains: ["vacuum"],
      entityFilter: stateObj => String(stateObj?.entity_id || "").startsWith("vacuum."),
      getOptions: () => this._getVacuumEntityOptions(),
    });
  }

  _mountSelectEntityPicker(host) {
    this._mountEntityPicker(host, {
      includeDomains: ["select"],
      entityFilter: stateObj => String(stateObj?.entity_id || "").startsWith("select."),
      getOptions: field => this._getSelectEntityOptions(field),
    });
  }

  _mountSensorEntityPicker(host) {
    this._mountEntityPicker(host, {
      includeDomains: ["sensor"],
      entityFilter: stateObj => String(stateObj?.entity_id || "").startsWith("sensor."),
      getOptions: field => this._getSensorEntityOptions(field),
    });
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";
    const suctionModeVisibilityOptions = this._getModeVisibilityOptions("suction");
    const mopModeVisibilityOptions = this._getModeVisibilityOptions("mop");
    const phVacName = this._editorLabel("ed.vacuum.name_placeholder");
    const phFanPresets = this._editorLabel("ed.vacuum.fan_presets_placeholder");
    const tapActionVal = config.tap_action || "default";
    const iconTapSelectValue = String(config.icon_tap_action ?? "").trim();
    const showVacuumNavigatePath =
      normalizeTextKey(tapActionVal) === "navigate" ||
      (Boolean(iconTapSelectValue) && normalizeTextKey(iconTapSelectValue) === "navigate");
    const holdActionVal = config.hold_action || "none";
    const iconHoldSelectValue = String(config.icon_hold_action ?? "").trim();
    const holdBodyKey = normalizeTextKey(holdActionVal);
    const holdIconEffectiveRaw = iconHoldSelectValue || holdActionVal;
    const holdIconKey = normalizeTextKey(holdIconEffectiveRaw);
    const showVacuumHoldNavigateFields = holdBodyKey === "navigate" || holdIconKey === "navigate";
    const showVacuumIconHoldNavField = Boolean(iconHoldSelectValue) && holdIconKey === "navigate";

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
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.general_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityPickerField("ed.vacuum.robot_entity", "entity", config.entity, {
              controlType: "vacuum-entity",
              fullWidth: true,
              placeholder: "vacuum.robot",
            })}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, {
              placeholder: "mdi:robot-vacuum",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: phVacName,
              fullWidth: true,
            })}
            ${this._renderCheckboxField("ed.entity.show_entity_picture", "show_entity_picture", config.show_entity_picture === true)}
            ${this._renderTextField("ed.entity.entity_picture", "entity_picture", config.entity_picture, {
              placeholder: "/local/vacuum.png",
              fullWidth: true,
            })}
            ${this._renderTextField(
              "ed.vacuum.fan_presets",
              "fan_presets",
              Array.isArray(config.fan_presets) ? config.fan_presets.join(", ") : "",
              {
                valueType: "csv",
                placeholder: phFanPresets,
                fullWidth: true,
              },
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.tap_actions_section_hint"))}</div>
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
                { value: "default", label: "ed.vacuum.tap_default" },
                { value: "more-info", label: "ed.vacuum.tap_more_info" },
                { value: "navigate", label: "ed.vacuum.tap_navigate" },
                { value: "none", label: "ed.vacuum.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.light.card_tap_action",
              "tap_action",
              config.tap_action || "default",
              [
                { value: "default", label: "ed.vacuum.tap_default" },
                { value: "more-info", label: "ed.vacuum.tap_more_info" },
                { value: "navigate", label: "ed.vacuum.tap_navigate" },
                { value: "none", label: "ed.vacuum.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${
              showVacuumNavigatePath
                ? this._renderTextField("ed.vacuum.navigation_path", "tap_navigation_path", config.tap_navigation_path, {
                    placeholder: "/lovelace/robot",
                    fullWidth: true,
                  })
                : ""
            }
            <div class="editor-section__hint editor-field--full" style="margin-top: 8px;">${escapeHtml(this._editorLabel("ed.vacuum.hold_actions_section_hint"))}</div>
            ${this._renderSelectField(
              "ed.light.icon_hold_action",
              "icon_hold_action",
              iconHoldSelectValue,
              [
                { value: "", label: "ed.entity.icon_hold_inherit" },
                { value: "default", label: "ed.vacuum.tap_default" },
                { value: "more-info", label: "ed.vacuum.tap_more_info" },
                { value: "navigate", label: "ed.vacuum.tap_navigate" },
                { value: "none", label: "ed.vacuum.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.light.card_hold_action",
              "hold_action",
              holdActionVal,
              [
                { value: "default", label: "ed.vacuum.tap_default" },
                { value: "more-info", label: "ed.vacuum.tap_more_info" },
                { value: "navigate", label: "ed.vacuum.tap_navigate" },
                { value: "none", label: "ed.vacuum.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${
              showVacuumHoldNavigateFields
                ? `
                  ${this._renderTextField("ed.vacuum.hold_navigation_path", "hold_navigation_path", config.hold_navigation_path, {
                    placeholder: "/lovelace/robot",
                    fullWidth: true,
                  })}
                  ${
                    showVacuumIconHoldNavField
                      ? this._renderTextField(
                          "ed.vacuum.icon_hold_navigation_path",
                          "icon_hold_navigation_path",
                          config.icon_hold_navigation_path,
                          {
                            placeholder: "/lovelace/robot",
                            fullWidth: true,
                          },
                        )
                      : ""
                  }
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.aux_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.aux_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderEntityPickerField("ed.vacuum.state_sensor", "state_entity", config.state_entity, {
              controlType: "sensor-entity",
              placeholder: "sensor.robot_estado",
            })}
            ${this._renderEntityPickerField("ed.vacuum.error_sensor", "error_entity", config.error_entity, {
              controlType: "sensor-entity",
              placeholder: "sensor.robot_error",
            })}
            ${this._renderEntityPickerField("ed.vacuum.battery_sensor", "battery_entity", config.battery_entity, {
              controlType: "sensor-entity",
              placeholder: "sensor.robot_bateria",
            })}
            ${this._renderEntityPickerField("ed.vacuum.room_mapping_sensor", "room_mapping_entity", config.room_mapping_entity, {
              controlType: "sensor-entity",
              placeholder: "sensor.room_mapping",
            })}
            ${this._renderEntityPickerField("ed.vacuum.suction_select", "suction_select_entity", config.suction_select_entity, {
              controlType: "select-entity",
              placeholder: "select.robot_fan_speed",
            })}
            ${this._renderEntityPickerField("ed.vacuum.mop_select", "mop_select_entity", config.mop_select_entity, {
              controlType: "select-entity",
              placeholder: "select.robot_mop_mode",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_hint"))}</div>
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
            ${this._renderCheckboxField("ed.vacuum.show_state_chip", "show_state_chip", config.show_state_chip !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_battery_chip", "show_battery_chip", config.show_battery_chip !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_mode_controls", "show_mode_controls", config.show_mode_controls !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_fan_presets", "show_fan_presets", config.show_fan_presets !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_return_base", "show_return_to_base", config.show_return_to_base !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_stop", "show_stop", config.show_stop !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_locate", "show_locate", config.show_locate !== false)}
            ${
              suctionModeVisibilityOptions.length
                ? `
                  <div class="editor-subsection editor-field--full">
                    <div class="editor-subsection__title">${escapeHtml(this._editorLabel("ed.vacuum.suction_modes_title"))}</div>
                    <div class="editor-subsection__hint">${escapeHtml(this._editorLabel("ed.vacuum.suction_modes_hint"))}</div>
                    <div class="editor-grid editor-grid--stacked">
                      ${suctionModeVisibilityOptions.map(mode => this._renderModeVisibilityField("hidden_suction_modes", mode, "suction")).join("")}
                    </div>
                  </div>
                `
                : ""
            }
            ${
              mopModeVisibilityOptions.length
                ? `
                  <div class="editor-subsection editor-field--full">
                    <div class="editor-subsection__title">${escapeHtml(this._editorLabel("ed.vacuum.mop_modes_title"))}</div>
                    <div class="editor-subsection__hint">${escapeHtml(this._editorLabel("ed.vacuum.mop_modes_hint"))}</div>
                    <div class="editor-grid editor-grid--stacked">
                      ${mopModeVisibilityOptions.map(mode => this._renderModeVisibilityField("hidden_mop_modes", mode, "mop")).join("")}
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
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.animations_section_hint"))}</div>
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
                  ${this._renderTextField("ed.vacuum.panel_duration_ms", "animations.panel_duration", config.animations.panel_duration, {
                    type: "number",
                  })}
                  ${this._renderTextField("ed.vacuum.button_bounce_ms", "animations.button_bounce_duration", config.animations.button_bounce_duration, {
                    type: "number",
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
                  ${this._renderColorField("ed.vacuum.style_bg", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("ed.vacuum.style_border", "styles.card.border", config.styles.card.border)}
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
                  ${this._renderTextField("ed.vacuum.style_shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("ed.vacuum.style_padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("ed.vacuum.style_gap", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderTextField("ed.vacuum.style_main_bubble_size", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderColorField("ed.vacuum.style_main_bubble_bg", "styles.icon.background", config.styles.icon.background, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_base", "styles.icon.color", config.styles.icon.color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_cleaning", "styles.icon.active_color", config.styles.icon.active_color, {
                    fallbackValue: "#61c97a",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_washing", "styles.icon.washing_color", config.styles.icon.washing_color, {
                    fallbackValue: "#5aa7ff",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_drying", "styles.icon.drying_color", config.styles.icon.drying_color, {
                    fallbackValue: "#f1c24c",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_emptying", "styles.icon.emptying_color", config.styles.icon.emptying_color, {
                    fallbackValue: "#9b6b4a",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_returning", "styles.icon.returning_color", config.styles.icon.returning_color, {
                    fallbackValue: "#f6b73c",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_docked", "styles.icon.docked_color", config.styles.icon.docked_color, {
                    fallbackValue: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
                  })}
                  ${this._renderColorField("ed.vacuum.style_icon_error", "styles.icon.error_color", config.styles.icon.error_color, {
                    fallbackValue: "var(--error-color, #ff6b6b)",
                  })}
                  ${this._renderTextField("ed.vacuum.style_button_size", "styles.control.size", config.styles.control.size)}
                  ${this._renderColorField("ed.vacuum.style_accent_bg", "styles.control.accent_background", config.styles.control.accent_background, {
                    fallbackValue: "rgba(var(--rgb-primary-color), 0.18)",
                  })}
                  ${this._renderColorField("ed.vacuum.style_accent_color", "styles.control.accent_color", config.styles.control.accent_color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderTextField("ed.vacuum.style_chip_height", "styles.chip_height", config.styles.chip_height)}
                  ${this._renderTextField("ed.vacuum.style_chip_font", "styles.chip_font_size", config.styles.chip_font_size)}
                  ${this._renderTextField("ed.vacuum.style_chip_padding", "styles.chip_padding", config.styles.chip_padding)}
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
                  ${this._renderTextField("ed.vacuum.style_title_size", "styles.title_size", config.styles.title_size)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="vacuum-entity"]')
      .forEach(host => this._mountVacuumEntityPicker(host));

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="select-entity"]')
      .forEach(host => this._mountSelectEntityPicker(host));

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="sensor-entity"]')
      .forEach(host => this._mountSensorEntityPicker(host));

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
  _lazyNodaliaVacuumCardEditor = NodaliaVacuumCardEditor;
  return NodaliaVacuumCardEditor;
}
