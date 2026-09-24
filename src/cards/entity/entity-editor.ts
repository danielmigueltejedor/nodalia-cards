// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  AIR_QUALITY_GRAPH_SERIES_COLORS,
  AIR_QUALITY_METRIC_KEYS,
  OVERVIEW_LAYOUTS,
} from "./entity-constants";
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
  sanitizeCssValue,
  setByPath,
} from "./entity-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./entity-config";
import {
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
} from "./entity-helpers";

let _lazyNodaliaEntityCardEditor;
export function loadNodaliaEntityCardEditor() {
  if (_lazyNodaliaEntityCardEditor) {
    return _lazyNodaliaEntityCardEditor;
  }
class NodaliaEntityCardEditor extends HTMLElement {
  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showAnimationSection = false;
    this._showTapActionsSection = false;
    this._showStyleSection = false;
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

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorStatesSignature(hass, this._config?.language);
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

  _getEntityOptions(path = "entity") {
    const sortTag = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const options = Object.entries(this._hass?.states || {})
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
        left.label.localeCompare(right.label, sortTag, { sensitivity: "base" })
        || left.value.localeCompare(right.value, sortTag, { sensitivity: "base" })
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
      case "csv": {
        const values = String(input.value || "")
          .split(",")
          .map(item => item.trim().toLowerCase())
          .filter(Boolean);
        return values.length ? values : "";
      }
      default:
        return input.value;
    }
  }

  _moveAction(index, direction) {
    const nextIndex = index + direction;
    if (
      !Array.isArray(this._config.quick_actions) ||
      nextIndex < 0 ||
      nextIndex >= this._config.quick_actions.length
    ) {
      return;
    }

    const [action] = this._config.quick_actions.splice(index, 1);
    this._config.quick_actions.splice(nextIndex, 0, action);
  }

  _moveOverviewEntity(layout, index, direction) {
    const entries = this._config?.[layout]?.entities;
    const nextIndex = index + direction;
    if (!Array.isArray(entries) || nextIndex < 0 || nextIndex >= entries.length) {
      return;
    }
    const [entry] = entries.splice(index, 1);
    entries.splice(nextIndex, 0, entry);
  }

  _findOverviewDefaultEntity(layout) {
    const states = Object.entries(this._hass?.states || {});
    const match = states.find(([entityId, state]) => {
      const deviceClass = String(state?.attributes?.device_class || "").toLowerCase();
      const key = `${entityId} ${state?.attributes?.friendly_name || ""}`.toLowerCase();
      if (layout === "battery") {
        return deviceClass === "battery" || /battery|bater[ií]a|akku/.test(key);
      }
      return /network|internet|router|wifi|speedtest|download|upload|latency|ping|signal|rssi|red\b/.test(key)
        || ["data_rate", "signal_strength"].includes(deviceClass);
    });
    return match?.[0] || states[0]?.[0] || "sensor.entity";
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

    if (toggleButton) {
      event.preventDefault();
      event.stopPropagation();

      if (toggleButton.dataset.editorToggle === "styles") {
        this._showStyleSection = !this._showStyleSection;
        this._render();
      } else if (toggleButton.dataset.editorToggle === "animations") {
        this._showAnimationSection = !this._showAnimationSection;
        this._render();
      } else if (toggleButton.dataset.editorToggle === "tap_actions") {
        this._showTapActionsSection = !this._showTapActionsSection;
        this._render();
      }
      return;
    }

    const button = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorAction);

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const action = button.dataset.editorAction;
    const index = Number(button.dataset.index);

    if (!Array.isArray(this._config.quick_actions)) {
      this._config.quick_actions = [];
    }

    switch (action) {
      case "add-battery-entity":
      case "add-network-entity": {
        const layout = action === "add-battery-entity" ? "battery" : "network";
        const firstEntity = this._findOverviewDefaultEntity(layout);
        if (!Array.isArray(this._config?.[layout]?.entities)) {
          this._config[layout] = { entities: [] };
        }
        this._config[layout].entities.push({
          entity: firstEntity,
          name: "",
          icon: "",
          ...(layout === "network" ? { role: "auto" } : {}),
        });
        this._emitConfig();
        break;
      }
      case "remove-overview-entity": {
        const layout = String(button.dataset.layout || "");
        if (OVERVIEW_LAYOUTS.has(layout) && Number.isInteger(index)) {
          this._config[layout].entities.splice(index, 1);
          this._emitConfig();
        }
        break;
      }
      case "move-overview-entity-up":
      case "move-overview-entity-down": {
        const layout = String(button.dataset.layout || "");
        if (OVERVIEW_LAYOUTS.has(layout) && Number.isInteger(index)) {
          this._moveOverviewEntity(layout, index, action.endsWith("up") ? -1 : 1);
          this._emitConfig();
        }
        break;
      }
      case "add-action":
        this._config.quick_actions.push({
          icon: "mdi:flash",
          type: "toggle",
          label: "",
          entity: "",
          service: "",
          service_data: "",
        });
        this._emitConfig();
        break;
      case "remove-action":
        if (Number.isInteger(index)) {
          this._config.quick_actions.splice(index, 1);
          this._emitConfig();
        }
        break;
      case "move-action-up":
        if (Number.isInteger(index)) {
          this._moveAction(index, -1);
          this._emitConfig();
        }
        break;
      case "move-action-down":
        if (Number.isInteger(index)) {
          this._moveAction(index, 1);
          this._emitConfig();
        }
        break;
      default:
        break;
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

  _renderTextareaField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <textarea data-field="${escapeHtml(field)}" ${placeholder}>${escapeHtml(inputValue)}</textarea>
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
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
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

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    if (customElements.get("ha-entity-picker") || customElements.get("ha-selector")) {
      window.NodaliaUtils.mountEntityPickerHost(host, {
        hass: this._hass,
        field: host.dataset.field || "entity",
        value: host.dataset.value || "",
        onShadowInput: this._onShadowInput,
        onShadowValueChanged: this._onShadowValueChanged,
        copyDatasetFromHost: true,
      });
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    const control = document.createElement("select");
    this._getEntityOptions(field).forEach(option => {
      const optionElement = document.createElement("option");
      optionElement.value = option.value;
      optionElement.textContent = option.displayLabel;
      control.appendChild(optionElement);
    });
    control.addEventListener("change", this._onShadowInput);

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

  _renderQuickActions(config) {
    if (!Array.isArray(config.quick_actions) || !config.quick_actions.length) {
      return `
        <div class="editor-empty">${escapeHtml(this._editorLabel("ed.entity.quick_actions_empty"))}</div>
      `;
    }

    return config.quick_actions
      .map((action, index) => {
        const actionType = action.type || "toggle";

        return `
          <div class="editor-action">
            <div class="editor-action__header">
              <div class="editor-action__title">${escapeHtml(this._editorLabel("ed.entity.action_block_title"))} ${index + 1}</div>
              <div class="editor-action__buttons">
                <button type="button" data-editor-action="move-action-up" data-index="${index}" aria-label="${escapeHtml(this._editorLabel("ed.notifications.move_up"))}">${escapeHtml(this._editorLabel("ed.notifications.move_up"))}</button>
                <button type="button" data-editor-action="move-action-down" data-index="${index}" aria-label="${escapeHtml(this._editorLabel("ed.notifications.move_down"))}">${escapeHtml(this._editorLabel("ed.notifications.move_down"))}</button>
                <button type="button" data-editor-action="remove-action" data-index="${index}" aria-label="${escapeHtml(this._editorLabel("ed.notifications.remove"))}">${escapeHtml(this._editorLabel("ed.notifications.remove"))}</button>
              </div>
            </div>
            <div class="editor-grid">
              ${this._renderIconPickerField("ed.entity.icon", `quick_actions.${index}.icon`, action.icon, {
                placeholder: "mdi:flash",
              })}
              ${this._renderTextField("ed.entity.quick_label", `quick_actions.${index}.label`, action.label, {
                placeholder: this._editorLabel("ed.entity.quick_label_placeholder"),
              })}
              ${this._renderSelectField(
                "ed.entity.action_type",
                `quick_actions.${index}.type`,
                actionType,
                [
                  { value: "toggle", label: "ed.entity.action_type_toggle" },
                  { value: "more-info", label: "ed.entity.action_type_more_info" },
                  { value: "service", label: "ed.entity.action_type_service" },
                ],
              )}
              ${this._renderEntityPickerField("ed.entity.quick_entity", `quick_actions.${index}.entity`, action.entity, {
                fullWidth: true,
              })}
              ${
                actionType === "service"
                  ? `
                    ${this._renderTextField("ed.entity.tap_service_field", `quick_actions.${index}.service`, action.service, {
                      placeholder: "light.turn_on",
                      fullWidth: true,
                    })}
                    ${this._renderTextareaField("ed.entity.tap_service_data_json", `quick_actions.${index}.service_data`, action.service_data, {
                      placeholder: '{"brightness_pct": 50}',
                    })}
                  `
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");
  }

  _renderOverviewEntities(layout, config) {
    const entries = config?.[layout]?.entities || [];
    if (!entries.length) {
      return `<div class="editor-empty">${escapeHtml(this._editorLabel("ed.entity.overview_entities_empty"))}</div>`;
    }
    return entries.map((entry, index) => `
      <div class="editor-action">
        <div class="editor-action__header">
          <div class="editor-action__title">${escapeHtml(this._editorLabel("ed.entity.entity_main"))} ${index + 1}</div>
          <div class="editor-action__buttons">
            <button type="button" data-editor-action="move-overview-entity-up" data-layout="${layout}" data-index="${index}" aria-label="${escapeHtml(this._editorLabel("ed.notifications.move_up"))}">${escapeHtml(this._editorLabel("ed.notifications.move_up"))}</button>
            <button type="button" data-editor-action="move-overview-entity-down" data-layout="${layout}" data-index="${index}" aria-label="${escapeHtml(this._editorLabel("ed.notifications.move_down"))}">${escapeHtml(this._editorLabel("ed.notifications.move_down"))}</button>
            <button type="button" data-editor-action="remove-overview-entity" data-layout="${layout}" data-index="${index}" aria-label="${escapeHtml(this._editorLabel("ed.notifications.remove"))}">${escapeHtml(this._editorLabel("ed.notifications.remove"))}</button>
          </div>
        </div>
        <div class="editor-grid">
          ${this._renderEntityPickerField("ed.entity.entity_main", `${layout}.entities.${index}.entity`, entry.entity, { fullWidth: true })}
          ${this._renderTextField("ed.entity.name", `${layout}.entities.${index}.name`, entry.name, { placeholder: this._editorLabel("ed.entity.name_placeholder") })}
          ${this._renderIconPickerField("ed.entity.icon", `${layout}.entities.${index}.icon`, entry.icon, { placeholder: layout === "battery" ? "mdi:battery" : "mdi:lan" })}
          ${layout === "network" ? this._renderSelectField(
            "ed.entity.network_role",
            `${layout}.entities.${index}.role`,
            entry.role || "auto",
            ["auto", "status", "download", "upload", "latency", "signal", "traffic"].map(role => ({ value: role, label: `ed.entity.network_role_${role}` })),
            { fullWidth: true },
          ) : ""}
        </div>
      </div>
    `).join("");
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const isDefaultLayout = config.layout === "default";
    const isAirQualityLayout = config.layout === "air_quality";
    const isOverviewLayout = OVERVIEW_LAYOUTS.has(config.layout);
    const hapticStyle = config.haptics?.style || "medium";
    const tapAction = config.tap_action || "auto";
    const iconTapActionRaw = String(config.icon_tap_action ?? "").trim();
    const iconTapSelectValue = iconTapActionRaw;
    const showIconTapService = iconTapSelectValue === "service";
    const showCardTapService = tapAction === "service";
    const showIconTapNavigate = iconTapSelectValue === "navigate";
    const showCardTapNavigate = tapAction === "navigate";
    const holdAction = config.hold_action || "none";
    const iconHoldSelect = String(config.icon_hold_action ?? "").trim();
    const showIconHoldNavigate = iconHoldSelect === "navigate";
    const showCardHoldNavigate = holdAction === "navigate";
    const showCardHoldService = holdAction === "service";
    const showIconHoldService = iconHoldSelect === "service" || (iconHoldSelect === "" && holdAction === "service");
    const doubleTapAction = config.double_tap_action || "none";
    const iconDoubleTapSelect = String(config.icon_double_tap_action ?? "").trim();
    const showIconDoubleTapNavigate = iconDoubleTapSelect === "navigate";
    const showCardDoubleTapNavigate = doubleTapAction === "navigate";
    const showCardDoubleTapService = doubleTapAction === "service";
    const showIconDoubleTapService = iconDoubleTapSelect === "service" || (iconDoubleTapSelect === "" && doubleTapAction === "service");
    const showTapServiceSecurity = showIconTapService || showCardTapService || showCardHoldService || showIconHoldService || showCardDoubleTapService || showIconDoubleTapService;
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
          line-height: 1.45;
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

        .editor-field textarea {
          min-height: 86px;
          resize: vertical;
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

        .editor-actions-toolbar {
          display: flex;
          justify-content: flex-start;
        }

        .editor-actions-toolbar button,
        .editor-action__buttons button {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 10px;
          color: var(--primary-text-color);
          cursor: pointer;
          font: inherit;
          min-height: 34px;
          padding: 6px 10px;
        }

        .editor-action {
          background: color-mix(in srgb, var(--primary-text-color) 3%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 16px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }

        .editor-action__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .editor-action__title {
          font-size: 13px;
          font-weight: 700;
        }

        .editor-action__buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .editor-empty {
          color: var(--secondary-text-color);
          font-size: 13px;
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
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.general_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderSelectField(
              "ed.entity.layout",
              "layout",
              config.layout || "default",
              [
                { value: "default", label: "ed.entity.layout_default" },
                { value: "air_quality", label: "ed.entity.layout_air_quality" },
                { value: "battery", label: "ed.entity.layout_battery" },
                { value: "network", label: "ed.entity.layout_network" },
              ],
              { fullWidth: true },
            )}
            ${!isOverviewLayout ? this._renderEntityPickerField("ed.entity.entity_main", "entity", config.entity, {
              fullWidth: true,
            }) : ""}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, {
              placeholder: "mdi:tune",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: this._editorLabel("ed.entity.name_placeholder"),
              fullWidth: true,
            })}
            ${!isOverviewLayout ? this._renderCheckboxField("ed.entity.use_entity_icon", "use_entity_icon", config.use_entity_icon === true) : ""}
            ${isDefaultLayout ? this._renderCheckboxField("ed.entity.show_entity_picture", "show_entity_picture", config.show_entity_picture === true) : ""}
            ${isDefaultLayout ? this._renderTextField("ed.entity.entity_picture", "entity_picture", config.entity_picture, {
              placeholder: "/local/ikea_gu10_bulb.png",
              fullWidth: true,
            }) : ""}
            ${!isOverviewLayout ? this._renderIconPickerField("ed.entity.icon_active", "icon_active", config.icon_active, {
              placeholder: "mdi:door-open",
              fullWidth: true,
            }) : ""}
            ${!isOverviewLayout ? this._renderIconPickerField("ed.entity.icon_inactive", "icon_inactive", config.icon_inactive, {
              placeholder: "mdi:door-closed",
              fullWidth: true,
            }) : ""}
            ${!isOverviewLayout ? `<div class="editor-section__hint editor-field--full" style="grid-column: 1 / -1; margin-top: -4px;">
              ${escapeHtml(this._editorLabel("ed.entity.icons_state_hint"))}
            </div>` : ""}
          </div>
        </section>

        ${
          isAirQualityLayout
            ? `
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.air_quality_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.air_quality_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.entity.air_quality_guidelines",
              "air_quality.guidelines",
              config.air_quality?.guidelines || "who",
              [
                { value: "who", label: "ed.entity.air_quality_guidelines_who" },
                { value: "none", label: "ed.entity.air_quality_guidelines_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderCheckboxField(
              "ed.entity.air_quality_show_graphs",
              "air_quality.show_graphs",
              config.air_quality?.show_graphs === true,
            )}
            ${
              config.air_quality?.show_graphs === true
                ? `
                  ${this._renderTextField(
                    "ed.entity.air_quality_graph_hours",
                    "air_quality.graph_hours",
                    config.air_quality?.graph_hours ?? 24,
                    { placeholder: "24", type: "number" },
                  )}
                  <div class="editor-field editor-field--full">
                    <span>${escapeHtml(this._editorLabel("ed.entity.air_quality_graph_series"))}</span>
                    <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.air_quality_graph_series_hint"))}</div>
                  </div>
                  ${AIR_QUALITY_METRIC_KEYS.map(kind => this._renderCheckboxField(
                    `ed.entity.air_quality_${kind}`,
                    `air_quality.graph_series.${kind}`,
                    config.air_quality?.graph_series?.[kind] !== false,
                  )).join("")}
                  <div class="editor-field editor-field--full">
                    <span>${escapeHtml(this._editorLabel("ed.entity.air_quality_graph_colors"))}</span>
                    <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.air_quality_graph_colors_hint"))}</div>
                  </div>
                  ${AIR_QUALITY_METRIC_KEYS.map(kind => this._renderColorField(
                    `ed.entity.air_quality_${kind}`,
                    `air_quality.graph_colors.${kind}`,
                    config.air_quality?.graph_colors?.[kind],
                    { fallbackValue: AIR_QUALITY_GRAPH_SERIES_COLORS[kind] },
                  )).join("")}
                `
                : ""
            }
            ${this._renderEntityPickerField("ed.entity.air_quality_pm1", "air_quality.pm1", config.air_quality?.pm1 || "", { fullWidth: true })}
            ${this._renderEntityPickerField("ed.entity.air_quality_pm25", "air_quality.pm25", config.air_quality?.pm25 || "", { fullWidth: true })}
            ${this._renderEntityPickerField("ed.entity.air_quality_pm4", "air_quality.pm4", config.air_quality?.pm4 || "", { fullWidth: true })}
            ${this._renderEntityPickerField("ed.entity.air_quality_pm10", "air_quality.pm10", config.air_quality?.pm10 || "", { fullWidth: true })}
            ${this._renderEntityPickerField("ed.entity.air_quality_tvoc", "air_quality.tvoc", config.air_quality?.tvoc || "", { fullWidth: true })}
            ${this._renderEntityPickerField("ed.entity.air_quality_co2", "air_quality.co2", config.air_quality?.co2 || "", { fullWidth: true })}
            ${this._renderEntityPickerField("ed.entity.air_quality_temperature", "air_quality.temperature", config.air_quality?.temperature || "", { fullWidth: true })}
            ${this._renderEntityPickerField("ed.entity.air_quality_humidity", "air_quality.humidity", config.air_quality?.humidity || "", { fullWidth: true })}
          </div>
        </section>
            `
            : ""
        }

        ${isOverviewLayout ? `
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel(config.layout === "battery" ? "ed.entity.battery_section_title" : "ed.entity.network_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel(config.layout === "battery" ? "ed.entity.battery_section_hint" : "ed.entity.network_section_hint"))}</div>
            <div class="editor-section__actions">
              <button type="button" class="editor-section__toggle-button" data-editor-action="add-${escapeHtml(config.layout)}-entity">
                <ha-icon icon="mdi:plus"></ha-icon>
                <span>${escapeHtml(this._editorLabel("ed.room_summary.add_entity"))}</span>
              </button>
            </div>
          </div>
          ${this._renderOverviewEntities(config.layout, config)}
        </section>` : ""}

        ${!isOverviewLayout ? `
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
                { value: "navigate", label: "ed.entity.tap_navigate" },
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
                { value: "navigate", label: "ed.entity.tap_navigate" },
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
              showIconTapNavigate
                ? this._renderTextField("ed.entity.navigation_path", "icon_navigation_path", config.icon_navigation_path, {
                    placeholder: "/home-page/details",
                    fullWidth: true,
                  })
                : ""
            }
            ${
              showCardTapNavigate
                ? this._renderTextField("ed.entity.navigation_path", "navigation_path", config.navigation_path, {
                    placeholder: "/home-page/matt-details",
                    fullWidth: true,
                  })
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
                { value: "navigate", label: "ed.entity.tap_navigate" },
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
                { value: "navigate", label: "ed.entity.tap_navigate" },
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
              showIconHoldNavigate || (iconHoldSelect === "" && showCardHoldNavigate)
                ? this._renderTextField("ed.entity.hold_navigation_path", "icon_hold_navigation_path", config.icon_hold_navigation_path, {
                    placeholder: "/home-page/details",
                    fullWidth: true,
                  })
                : ""
            }
            ${
              showCardHoldNavigate
                ? this._renderTextField("ed.entity.hold_navigation_path", "hold_navigation_path", config.hold_navigation_path, {
                    placeholder: "/home-page/matt-details",
                    fullWidth: true,
                  })
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
            <div class="editor-section__hint editor-field--full" style="margin-top: 8px;">${escapeHtml(this._editorLabel("ed.light.double_tap_actions_section_hint"))}</div>
            ${this._renderSelectField(
              "ed.light.card_double_tap_action",
              "double_tap_action",
              doubleTapAction,
              [
                { value: "none", label: "ed.entity.tap_none" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "navigate", label: "ed.entity.tap_navigate" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
              ],
              { fullWidth: true },
            )}
          </div>
              `
              : ""
          }
        </section>
        ` : ""}

        ${isDefaultLayout ? `
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.content_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.content_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.entity.compact_mode",
              "compact_layout_mode",
              config.compact_layout_mode || "auto",
              [
                { value: "auto", label: "ed.entity.compact_auto" },
                { value: "always", label: "ed.entity.compact_always" },
                { value: "never", label: "ed.entity.compact_never" },
              ],
            )}
            ${this._renderCheckboxField("ed.entity.show_state", "show_state", config.show_state !== false)}
            ${this._renderSelectField(
              "ed.entity.state_position",
              "state_position",
              config.state_position || (config.state_chip_on_title_row === true ? "right" : "below"),
              [
                { value: "below", label: "ed.entity.state_below" },
                { value: "right", label: "ed.entity.state_right" },
              ],
            )}
            ${this._renderTextField("ed.entity.number_decimals", "number_decimals", config.number_decimals, {
              placeholder: "2",
              type: "number",
            })}
            ${this._renderTextField("ed.entity.primary_attribute", "primary_attribute", config.primary_attribute, {
              placeholder: "battery_level",
            })}
            ${this._renderTextField("ed.entity.secondary_attribute", "secondary_attribute", config.secondary_attribute, {
              placeholder: "temperature",
            })}
            ${this._renderCheckboxField("ed.entity.show_primary_chip", "show_primary_chip", config.show_primary_chip !== false)}
            ${this._renderCheckboxField("ed.entity.show_secondary_chip", "show_secondary_chip", config.show_secondary_chip !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.quick_actions_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.quick_actions_hint"))}</div>
            <div class="editor-section__actions">
              <button type="button" class="editor-section__toggle-button" data-editor-action="add-action">
                <ha-icon icon="mdi:plus"></ha-icon>
                <span>${escapeHtml(this._editorLabel("ed.entity.add_action"))}</span>
              </button>
            </div>
          </div>
          ${this._renderQuickActions(config)}
        </section>
        ` : ""}

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.animations_section_hint"))}</div>
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
                  ${this._renderCheckboxField("ed.weather.enable_animations", "animations.enabled", animations.enabled !== false)}
                  ${this._renderTextField("ed.weather.content_entrance_ms", "animations.content_duration", animations.content_duration, {
                    type: "number",
                  })}
                  ${this._renderTextField("ed.weather.button_bounce_ms", "animations.button_bounce_duration", animations.button_bounce_duration, {
                    type: "number",
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.haptics_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.entity.enable_haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("ed.entity.fallback_vibrate", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "ed.weather.haptic_style",
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.styles_section_hint"))}</div>
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
                  ${isDefaultLayout ? this._renderTextField("ed.entity.style_card_border", "styles.card.border", config.styles.card.border) : ""}
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
                  ${!isOverviewLayout ? this._renderTextField("ed.entity.style_main_button_size", "styles.icon.size", config.styles.icon.size) : ""}
                  ${isDefaultLayout ? this._renderColorField("ed.entity.style_main_bubble_bg", "styles.icon.background", config.styles.icon.background, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
                  }) : ""}
                  ${isDefaultLayout ? this._renderColorField("ed.entity.style_icon_on", "styles.icon.on_color", config.styles.icon.on_color, {
                    fallbackValue: "var(--info-color, #71c0ff)",
                  }) : ""}
                  ${isDefaultLayout ? this._renderColorField("ed.entity.style_icon_off", "styles.icon.off_color", config.styles.icon.off_color, {
                    fallbackValue: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
                  }) : ""}
                  ${isDefaultLayout ? this._renderTextField("ed.entity.style_aux_button_size", "styles.control.size", config.styles.control.size) : ""}
                  ${isDefaultLayout ? this._renderColorField("ed.entity.style_accent_bg", "styles.control.accent_background", config.styles.control.accent_background, {
                    fallbackValue: "rgba(113, 192, 255, 0.18)",
                  }) : ""}
                  ${isDefaultLayout ? this._renderColorField("ed.entity.style_accent_color", "styles.control.accent_color", config.styles.control.accent_color, {
                    fallbackValue: "var(--primary-text-color)",
                  }) : ""}
                  ${!isOverviewLayout ? this._renderTextField("ed.entity.style_chip_height", "styles.chip_height", config.styles.chip_height) : ""}
                  ${!isOverviewLayout ? this._renderTextField("ed.entity.style_chip_font", "styles.chip_font_size", config.styles.chip_font_size) : ""}
                  ${!isOverviewLayout ? this._renderTextField("ed.entity.style_chip_padding", "styles.chip_padding", config.styles.chip_padding) : ""}
                  ${!isOverviewLayout ? window.NodaliaUtils.renderEditorChipBorderRadiusHtml({
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
                  }) : ""}
                  ${this._renderTextField("ed.entity.style_title_size", "styles.title_size", config.styles.title_size)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="entity"]')
      .forEach(host => this._mountEntityPicker(host));

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
  _lazyNodaliaEntityCardEditor = NodaliaEntityCardEditor;
  return NodaliaEntityCardEditor;
}
