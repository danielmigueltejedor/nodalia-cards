// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { NODE_DEFAULTS } from "./power-flow-constants";
import {
  clamp,
  deepClone,
  deleteByPath,
  escapeHtml,
  fireEvent,
  getByPath,
  isObject,
  setByPath,
} from "./power-flow-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./power-flow-config";
import {
  arrayFromMaybe,
  compactConfig,
  formatEditorColorFromHex,
  formatEditorHexChannel,
  getEditorColorFallbackValue,
  getEditorColorModel,
  moveItem,
  resolveIndividualConfigs,
  resolveNodeConfig,
  rgbArrayToColor,
  sanitizeIndividualEntries,
} from "./power-flow-helpers";

let _lazyNodaliaPowerFlowCardEditor;
export function loadNodaliaPowerFlowCardEditor() {
  if (_lazyNodaliaPowerFlowCardEditor) {
    return _lazyNodaliaPowerFlowCardEditor;
  }
class NodaliaPowerFlowCardEditor extends HTMLElement {
  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._onShadowInput = this._onShadowInput.bind(this);
    }

  _attachEditorShadowListeners() {
    if (this._editorShadowListenersAttached || !this.shadowRoot) {
      return;
    }
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this._editorShadowListenersAttached = true;
  }

  _detachEditorShadowListeners() {
    if (!this._editorShadowListenersAttached || !this.shadowRoot) {
      return;
    }
    this.shadowRoot.removeEventListener("input", this._onShadowInput);
    this.shadowRoot.removeEventListener("change", this._onShadowInput);
    this._editorShadowListenersAttached = false;
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
    const shouldRender = !this._hass || nextSignature !== this._entityOptionsSignature || !this.shadowRoot?.innerHTML;
    this._hass = hass;
    this._entityOptionsSignature = nextSignature;

    if (shouldRender) {
      this._render();
    }
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._render();
  }

  _getEntityOptionsSignature(hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id =>
      id.startsWith("sensor.") || id.startsWith("number.") || id.startsWith("input_number."),
    );
  }

  _captureFocusState() {
    const activeElement = this.shadowRoot?.activeElement;
    if (
      !(
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement
      ) ||
      !activeElement.dataset?.field
    ) {
      return null;
    }

    const selector = `[data-field="${CSS.escape(activeElement.dataset.field)}"]`;
    const supportsSelection =
      (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) &&
      activeElement.type !== "checkbox" &&
      typeof activeElement.selectionStart === "number" &&
      typeof activeElement.selectionEnd === "number";

    return {
      selector,
      selectionEnd: supportsSelection ? activeElement.selectionEnd : null,
      selectionStart: supportsSelection ? activeElement.selectionStart : null,
      type: activeElement.type,
    };
  }

  _restoreFocusState(focusState) {
    if (!focusState?.selector || !this.shadowRoot) {
      return;
    }

    const target = this.shadowRoot.querySelector(focusState.selector);
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
    ) {
      return;
    }

    try {
      target.focus({ preventScroll: true });
    } catch (_error) {
      target.focus();
    }

    const canRestoreSelection =
      focusState.type !== "checkbox" &&
      typeof focusState.selectionStart === "number" &&
      typeof focusState.selectionEnd === "number" &&
      typeof target.setSelectionRange === "function";

    if (!canRestoreSelection) {
      return;
    }

    try {
      target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    } catch (_error) {
      // Ignore unsupported inputs.
    }
  }

  _emitConfig() {
    const focusState = this._captureFocusState();
    const nextConfig = deepClone(this._config);
    this._config = normalizeConfig(compactConfig(nextConfig));
    this._render();
    this._restoreFocusState(focusState);

    const persisted = deepClone(this._config);
    if (Array.isArray(persisted.entities?.individual)) {
      persisted.entities.individual = sanitizeIndividualEntries(persisted).filter(item => item.entity);
    }

    fireEvent(this, "config-changed", {
      config: compactConfig(window.NodaliaUtils.stripEqualToDefaults(persisted, DEFAULT_CONFIG) ?? {}),
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
        const numeric = Number(input.value);
        return Number.isFinite(numeric) ? numeric : undefined;
      }
      case "rgb-array":
        return String(input.value || "")
          .split(",")
          .map(item => clamp(Number.parseInt(item.trim(), 10) || 0, 0, 255))
          .slice(0, 3);
      case "individuals":
        return String(input.value || "")
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const [entity, name = "", icon = "", color = ""] = line.split("|").map(part => part.trim());
            return { entity, name, icon, color };
          })
          .filter(item => item.entity);
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
      this._emitConfig();
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
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";

    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <textarea
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          rows="${escapeHtml(String(options.rows || 4))}"
          ${placeholder}
        >${escapeHtml(inputValue)}</textarea>
      </label>
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

  _renderSelectField(label, field, value, options) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field">
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

  _serializeIndividuals() {
    return resolveIndividualConfigs(this._config)
      .map(entry => [entry.entity || "", entry.name || "", entry.icon || "", entry.color || ""].join("|"))
      .join("\n");
  }

  _getEntityOptionsMarkup() {
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const allEntities = Object.keys(this._hass?.states || {})
      .filter(entityId => entityId.startsWith("sensor.") || entityId.startsWith("number.") || entityId.startsWith("input_number."))
      .sort((left, right) => left.localeCompare(right, sortLoc));

    return `
      <datalist id="power-flow-card-entity-options">
        ${allEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
    `;
  }

  _renderNodeSection(titleKey, hintKey, prefix, values) {
    const isGrid = prefix === "entities.grid";
    const gridExportFields = isGrid ? `
          ${this._renderTextField("ed.power_flow.node_grid_export_entity", `${prefix}.export_entity`, values.export_entity, { placeholder: "sensor.grid_feed_in" })}
          ${this._renderTextField("ed.power_flow.node_grid_export_color", `${prefix}.export_color`, values.export_color || NODE_DEFAULTS.grid.export_color, { placeholder: NODE_DEFAULTS.grid.export_color })}
          ${this._renderCheckboxField("ed.power_flow.node_grid_export_when_negative", `${prefix}.export_when_negative`, values.export_when_negative !== false)}
    ` : "";
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div class="editor-section__title">${escapeHtml(this._editorLabel(titleKey))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel(hintKey))}</div>
        </div>
        <div class="editor-grid">
          ${this._renderTextField("ed.entity.entity_main", `${prefix}.entity`, values.entity, { placeholder: "sensor.mi_sensor" })}
          ${this._renderTextField("ed.entity.name", `${prefix}.name`, values.name)}
          ${this._renderTextField("ed.entity.icon", `${prefix}.icon`, values.icon, { placeholder: "mdi:flash" })}
          ${this._renderTextField("ed.power_flow.node_color", `${prefix}.color`, values.color, { placeholder: "#f6b73c" })}
          ${gridExportFields}
          ${this._renderTextField("ed.power_flow.node_secondary_entity", `${prefix}.secondary_info.entity`, values.secondary_info?.entity, { placeholder: "sensor.mi_secundaria" })}
          ${this._renderTextField("ed.power_flow.node_secondary_attribute", `${prefix}.secondary_info.attribute`, values.secondary_info?.attribute, { placeholder: "battery_level" })}
        </div>
      </section>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig(STUB_CONFIG);
    const hapticStyle = config.haptics?.style || "medium";
    const grid = resolveNodeConfig("grid", config);
    const home = resolveNodeConfig("home", config);
    const solar = resolveNodeConfig("solar", config);
    const battery = resolveNodeConfig("battery", config);
    const water = resolveNodeConfig("water", config);
    const gas = resolveNodeConfig("gas", config);

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
          min-height: 110px;
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.general_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.nav.title_bar", "title", config.title, { placeholder: "Energy" })}
            ${this._renderTextField("ed.power_flow.energy_dashboard_url", "dashboard_link", config.dashboard_link, { placeholder: "/energy/overview" })}
            ${this._renderTextField("ed.power_flow.energy_dashboard_button_label", "dashboard_link_label", config.dashboard_link_label, { placeholder: "Energy" })}
            ${this._renderCheckboxField("ed.power_flow.show_header", "show_header", config.show_header !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_dashboard_button", "show_dashboard_link_button", config.show_dashboard_link_button !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_labels", "show_labels", config.show_labels !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_values", "show_values", config.show_values !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_secondary_info", "show_secondary_info", config.show_secondary_info !== false)}
            ${this._renderCheckboxField("ed.power_flow.clickable_entities", "clickable_entities", config.clickable_entities !== false)}
            ${this._renderCheckboxField("ed.power_flow.badge_unavailable", "show_unavailable_badge", config.show_unavailable_badge !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_home_device_popup", "show_home_device_popup", config.show_home_device_popup !== false)}
          </div>
        </section>

        <section class="editor-section">
          ${window.NodaliaUtils.renderEditorCollapsibleSectionHeaderHtml({
            escapeHtml,
            editorLabel: key => this._editorLabel(key),
            titleKey: "ed.light.tap_actions_section_title",
            hintKey: "ed.light.tap_actions_section_hint",
            toggleId: "tap_actions",
            expanded: this._showTapActionsSection === true,
          })}
          ${
            this._showTapActionsSection
              ? `
          <div class="editor-grid editor-grid--stacked">
            ${this._renderSelectField("ed.power_flow.card_tap_action", "tap_action", tapAction, [
              { value: "none", label: "ed.power_flow.tap_none" },
              { value: "more-info", label: "ed.power_flow.tap_more_info_home" },
            ], { fullWidth: true })}
          </div>
              `
              : ""
          }
        </section>

        ${this._renderNodeSection("ed.power_flow.node_grid_title", "ed.power_flow.node_grid_hint_yaml", "entities.grid", grid)}
        ${this._renderNodeSection("ed.power_flow.node_home_title", "ed.power_flow.node_home_hint_yaml", "entities.home", home)}
        ${this._renderNodeSection("ed.power_flow.node_solar_title", "ed.power_flow.node_solar_hint", "entities.solar", solar)}
        ${this._renderNodeSection("ed.power_flow.node_battery_title", "ed.power_flow.node_battery_hint_yaml", "entities.battery", battery)}
        ${this._renderNodeSection("ed.power_flow.node_water_title", "ed.power_flow.node_water_hint", "entities.water", water)}
        ${this._renderNodeSection("ed.power_flow.node_gas_title", "ed.power_flow.node_gas_hint", "entities.gas", gas)}

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.power_flow.individuals_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.individuals_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextareaField("ed.power_flow.individuals_entities", "entities.individual", this._serializeIndividuals(), {
              valueType: "individuals",
              rows: 5,
              placeholder: "sensor.cargador_coche|Cargador|mdi:car-electric|#42a5f5",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.power_flow.consumption_chips_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.consumption_chips_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.power_flow.consumption_day_entity", "consumption_chips.day_entity", config.consumption_chips?.day_entity, { placeholder: "sensor.home_energy_today" })}
            ${this._renderTextField("ed.power_flow.consumption_day_label", "consumption_chips.day_label", config.consumption_chips?.day_label, { placeholder: "Today" })}
            ${this._renderTextField("ed.power_flow.consumption_month_entity", "consumption_chips.month_entity", config.consumption_chips?.month_entity, { placeholder: "sensor.home_energy_month" })}
            ${this._renderTextField("ed.power_flow.consumption_month_label", "consumption_chips.month_label", config.consumption_chips?.month_label, { placeholder: "Month" })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.power_flow.flow_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.flow_hint_yaml"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("ed.power_flow.zero_lines_mode", "display_zero_lines.mode", config.display_zero_lines?.mode || "show", [
              { value: "show", label: "ed.power_flow.zero_lines_show" },
              { value: "hide", label: "ed.power_flow.zero_lines_hide" },
            ])}
            ${this._renderTextField("ed.power_flow.zero_lines_transparency", "display_zero_lines.transparency", config.display_zero_lines?.transparency, {
              type: "number",
              valueType: "number",
              placeholder: "50",
            })}
            ${this._renderTextField("ed.power_flow.grey_rgb", "display_zero_lines.grey_color", arrayFromMaybe(config.display_zero_lines?.grey_color).join(", "), {
              valueType: "rgb-array",
              placeholder: "189, 189, 189",
            })}
            ${this._renderTextField("ed.power_flow.flow_min_s", "min_flow_rate", config.min_flow_rate, {
              type: "number",
              valueType: "number",
              placeholder: "1.4",
            })}
            ${this._renderTextField("ed.power_flow.flow_max_s", "max_flow_rate", config.max_flow_rate, {
              type: "number",
              valueType: "number",
              placeholder: "5.8",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.power_flow.style_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.style_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.person.style_card_bg", "styles.card.background", config.styles?.card?.background)}
            ${this._renderTextField("ed.person.style_card_border", "styles.card.border", config.styles?.card?.border)}
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
            ${this._renderTextField("ed.person.style_card_shadow", "styles.card.box_shadow", config.styles?.card?.box_shadow)}
            ${this._renderTextField("ed.person.style_card_padding", "styles.card.padding", config.styles?.card?.padding)}
            ${this._renderTextField("ed.person.style_card_gap", "styles.card.gap", config.styles?.card?.gap)}
            ${this._renderTextField("ed.power_flow.icon_node_size", "styles.icon.node_size", config.styles?.icon?.node_size)}
            ${this._renderTextField("ed.power_flow.icon_home_size", "styles.icon.home_size", config.styles?.icon?.home_size)}
            ${this._renderTextField("ed.power_flow.icon_individual_size", "styles.icon.individual_size", config.styles?.icon?.individual_size)}
            ${this._renderTextField("ed.person.style_title_size", "styles.title_size", config.styles?.title_size)}
            ${this._renderTextField("ed.person.style_chip_height", "styles.chip_height", config.styles?.chip_height)}
            ${this._renderTextField("ed.person.style_chip_font", "styles.chip_font_size", config.styles?.chip_font_size)}
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
            ${this._renderTextField("ed.power_flow.home_value_size", "styles.home_value_size", config.styles?.home_value_size)}
            ${this._renderTextField("ed.power_flow.home_unit_size", "styles.home_unit_size", config.styles?.home_unit_size)}
            ${this._renderTextField("ed.power_flow.node_value_size", "styles.node_value_size", config.styles?.node_value_size)}
            ${this._renderTextField("ed.power_flow.flow_line_width", "styles.flow_width", config.styles?.flow_width)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.person.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.haptics_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.power_flow.enable_haptics", "haptics.enabled", config.haptics?.enabled === true)}
            ${this._renderCheckboxField("ed.nav.vibrate_fallback", "haptics.fallback_vibrate", config.haptics?.fallback_vibrate === true)}
            ${this._renderSelectField("ed.vacuum.haptic_style", "haptics.style", hapticStyle, [
              { value: "selection", label: "ed.weather.haptic_selection" },
              { value: "light", label: "ed.weather.haptic_light" },
              { value: "medium", label: "ed.weather.haptic_medium" },
              { value: "heavy", label: "ed.weather.haptic_heavy" },
              { value: "success", label: "ed.weather.haptic_success" },
              { value: "warning", label: "ed.weather.haptic_warning" },
              { value: "failure", label: "ed.weather.haptic_failure" },
            ])}
          </div>
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot.querySelectorAll('input[data-field$=".entity"]').forEach(input => {
      input.setAttribute("list", "power-flow-card-entity-options");
    });
  }
}
  _lazyNodaliaPowerFlowCardEditor = NodaliaPowerFlowCardEditor;
  return NodaliaPowerFlowCardEditor;
}

let _lazyNodaliaPowerFlowCardVisualEditor;
export function loadNodaliaPowerFlowCardVisualEditor() {
  if (_lazyNodaliaPowerFlowCardVisualEditor) {
    return _lazyNodaliaPowerFlowCardVisualEditor;
  }
class NodaliaPowerFlowCardVisualEditor extends HTMLElement {
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

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id =>
      id.startsWith("sensor.") || id.startsWith("number.") || id.startsWith("input_number."),
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

  _getPowerEntityOptions(path = "entity", domains = POWER_FLOW_ENTITY_DOMAINS) {
    const normalizedDomains = arrayFromMaybe(domains).map(domain => String(domain).trim()).filter(Boolean);
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

    const persisted = deepClone(this._config);
    if (Array.isArray(persisted.entities?.individual)) {
      persisted.entities.individual = sanitizeIndividualEntries(persisted).filter(item => item.entity);
    }

    fireEvent(this, "config-changed", {
      config: compactConfig(window.NodaliaUtils.stripEqualToDefaults(persisted, DEFAULT_CONFIG) ?? {}),
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
      case "number": {
        const numeric = Number(input.value);
        return Number.isFinite(numeric) ? numeric : undefined;
      }
      case "rgb-array-color": {
        const normalizedHex = String(input.value || "").trim().replace(/^#/, "");
        if (!/^[0-9a-f]{6}$/i.test(normalizedHex)) {
          return undefined;
        }
        return [
          Number.parseInt(normalizedHex.slice(0, 2), 16),
          Number.parseInt(normalizedHex.slice(2, 4), 16),
          Number.parseInt(normalizedHex.slice(4, 6), 16),
        ];
      }
      case "individuals":
        return String(input.value || "")
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const [entity, name = "", icon = "", color = ""] = line.split("|").map(part => part.trim());
            return { entity, name, icon, color };
          })
          .filter(item => item.entity);
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

    const actionButton = event.composedPath().find(node => node instanceof HTMLButtonElement && node.dataset?.action);
    if (!actionButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const action = actionButton.dataset.action;
    const index = Number(actionButton.dataset.index);
    if (!isObject(this._config.entities)) {
      this._config.entities = {};
    }
    if (!Array.isArray(this._config.entities.individual)) {
      this._config.entities.individual = [];
    }

    if (action === "add-individual") {
      this._config.entities.individual.push({
        entity: "",
        name: "",
        icon: "mdi:power-plug",
        color: "",
      });
      this._setEditorConfig();
      const focusState = this._captureFocusState();
      this._render();
      this._restoreFocusState(focusState);
      return;
    }

    if (!Number.isInteger(index) || index < 0 || index >= this._config.entities.individual.length) {
      return;
    }

    if (action === "remove-individual") {
      this._config.entities.individual.splice(index, 1);
      this._emitConfig();
      return;
    }

    if (action === "move-individual-up") {
      moveItem(this._config.entities.individual, index, index - 1);
      this._emitConfig();
      return;
    }

    if (action === "move-individual-down") {
      moveItem(this._config.entities.individual, index, index + 1);
      this._emitConfig();
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

  _renderTextareaField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";

    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <textarea
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          rows="${escapeHtml(String(options.rows || 4))}"
          ${placeholder}
        >${escapeHtml(inputValue)}</textarea>
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

  _renderRgbArrayColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("ed.weather.custom_color");
    const fallbackValue = arrayFromMaybe(options.fallbackValue || DEFAULT_CONFIG.display_zero_lines.grey_color);
    const sourceValue = arrayFromMaybe(value);
    const rgbValue = sourceValue.length >= 3 ? sourceValue : fallbackValue;
    const hexValue = `#${rgbValue.slice(0, 3).map(channel => formatEditorHexChannel(channel)).join("")}`;
    const swatchValue = rgbArrayToColor(rgbValue, fallbackValue);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="${escapeHtml(tColorCustom)}">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="rgb-array-color"
              value="${escapeHtml(hexValue)}"
              aria-label="${escapeHtml(tLabel)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(swatchValue)};"></span>
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
    const domains = arrayFromMaybe(options.domains).length
      ? arrayFromMaybe(options.domains)
      : POWER_FLOW_ENTITY_DOMAINS;

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

  _serializeIndividuals() {
    return resolveIndividualConfigs(this._config)
      .map(entry => [entry.entity || "", entry.name || "", entry.icon || "", entry.color || ""].join("|"))
      .join("\n");
  }

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    const domains = String(host.dataset.domains || POWER_FLOW_ENTITY_DOMAINS.join(","))
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    let control = null;

    if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: {
          domain: domains.length === 1 ? domains[0] : domains,
        },
      };
    } else if (customElements.get("ha-entity-picker")) {
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
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || this._editorLabel("ed.person.select_entity");
      control.appendChild(emptyOption);
      this._getPowerEntityOptions(field, domains).forEach(option => {
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

    if (control.tagName === "SELECT") {
      control.addEventListener("change", this._onShadowInput);
    } else {
      control.addEventListener("value-changed", this._onShadowValueChanged);
    }

    host.replaceChildren(control);
  }

  _renderIndividualEditorCard(item, index, total) {
    const entry = item || {};
    return `
      <div class="power-flow-individual-card">
        <div class="power-flow-individual-card__header">
          <div class="power-flow-individual-card__title">${escapeHtml(this._editorLabel("ed.power_flow.individual_row_title"))} ${index + 1}</div>
          <div class="power-flow-individual-card__actions">
            <button type="button" data-action="move-individual-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" data-action="move-individual-down" data-index="${index}" ${index >= total - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="danger" data-action="remove-individual" data-index="${index}">${escapeHtml(this._editorLabel("ed.power_flow.remove_individual"))}</button>
          </div>
        </div>
        ${this._renderEntityPickerField("ed.power_flow.individual_entity", `entities.individual.${index}.entity`, entry.entity, {
          placeholder: "sensor.smart_plug_power",
          fullWidth: true,
          domains: ["sensor", "number", "input_number"],
        })}
        ${this._renderTextField("ed.entity.name", `entities.individual.${index}.name`, entry.name, { fullWidth: true })}
        ${this._renderIconPickerField("ed.entity.icon", `entities.individual.${index}.icon`, entry.icon, { placeholder: "mdi:power-plug" })}
        ${this._renderColorField("ed.power_flow.node_color", `entities.individual.${index}.color`, entry.color, { fullWidth: true })}
      </div>
    `;
  }

  _renderNodeSection(titleKey, hintKey, prefix, values) {
    const isGrid = prefix === "entities.grid";
    const gridExportFields = isGrid ? `
          ${this._renderEntityPickerField("ed.power_flow.node_grid_export_entity", `${prefix}.export_entity`, values.export_entity, {
            placeholder: "sensor.grid_feed_in",
            fullWidth: true,
            domains: ["sensor", "number", "input_number"],
          })}
          ${this._renderTextField("ed.power_flow.node_grid_export_color", `${prefix}.export_color`, values.export_color || NODE_DEFAULTS.grid.export_color, { placeholder: NODE_DEFAULTS.grid.export_color })}
          ${this._renderCheckboxField("ed.power_flow.node_grid_export_when_negative", `${prefix}.export_when_negative`, values.export_when_negative !== false)}
    ` : "";
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div class="editor-section__title">${escapeHtml(this._editorLabel(titleKey))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel(hintKey))}</div>
        </div>
        <div class="editor-grid editor-grid--stacked">
          ${this._renderEntityPickerField("ed.entity.entity_main", `${prefix}.entity`, values.entity, {
            placeholder: "sensor.mi_sensor",
            fullWidth: true,
            domains: ["sensor", "number", "input_number"],
          })}
          ${this._renderTextField("ed.entity.name", `${prefix}.name`, values.name)}
          ${this._renderIconPickerField("ed.entity.icon", `${prefix}.icon`, values.icon, {
            placeholder: "mdi:flash",
          })}
          ${this._renderColorField("ed.power_flow.node_color", `${prefix}.color`, values.color)}
          ${gridExportFields}
          ${this._renderEntityPickerField("ed.power_flow.node_secondary_entity", `${prefix}.secondary_info.entity`, values.secondary_info?.entity, {
            placeholder: "sensor.mi_secundaria",
            fullWidth: true,
            domains: ["sensor", "number", "input_number"],
          })}
          ${this._renderTextField("ed.power_flow.node_secondary_attribute", `${prefix}.secondary_info.attribute`, values.secondary_info?.attribute, {
            placeholder: "battery_level",
          })}
          ${this._renderTextField("ed.power_flow.node_secondary_unit", `${prefix}.secondary_info.unit`, values.secondary_info?.unit, {
            placeholder: "kWh",
          })}
          ${this._renderTextField("ed.power_flow.node_secondary_decimals", `${prefix}.secondary_info.decimals`, values.secondary_info?.decimals, {
            type: "number",
            valueType: "number",
            placeholder: "0",
          })}
        </div>
      </section>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig(STUB_CONFIG);
    const hapticStyle = config.haptics?.style || "medium";
    const tapAction = config.tap_action || "none";
    const animations = config.animations || DEFAULT_CONFIG.animations;
    const grid = resolveNodeConfig("grid", config);
    const home = resolveNodeConfig("home", config);
    const solar = resolveNodeConfig("solar", config);
    const battery = resolveNodeConfig("battery", config);
    const water = resolveNodeConfig("water", config);
    const gas = resolveNodeConfig("gas", config);
    const individuals = sanitizeIndividualEntries(config);

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

        .editor-field textarea {
          min-height: 120px;
          resize: vertical;
        }

        .power-flow-individual-list {
          display: grid;
          gap: 12px;
        }

        .editor-empty-note {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.5;
        }

        .editor-actions {
          display: flex;
          justify-content: flex-start;
        }

        .editor-actions button,
        .editor-section__toggle-button {
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

        .editor-actions button:hover,
        .editor-section__toggle-button:hover {
          border-color: color-mix(in srgb, var(--primary-text-color) 16%, transparent);
        }

        button.danger {
          color: var(--error-color, #ff4d4f);
        }

        button:disabled {
          cursor: default;
          opacity: 0.45;
        }

        .power-flow-individual-card {
          background: color-mix(in srgb, var(--primary-text-color) 3%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 16px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }

        .power-flow-individual-card__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .power-flow-individual-card__title {
          font-size: 13px;
          font-weight: 700;
        }

        .power-flow-individual-card__actions {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .power-flow-individual-card__actions button {
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          border-radius: 10px;
          color: var(--primary-text-color);
          cursor: pointer;
          font: inherit;
          min-height: 32px;
          padding: 0 10px;
        }

        .power-flow-individual-card__actions button.danger {
          color: var(--error-color, #ff4d4f);
        }

        .power-flow-individual-card__actions button:disabled {
          cursor: default;
          opacity: 0.45;
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

        @media (max-width: 720px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.general_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderTextField("ed.nav.title_bar", "title", config.title, { placeholder: "Energy", fullWidth: true })}
            ${this._renderTextField("ed.power_flow.energy_dashboard_url", "dashboard_link", config.dashboard_link, { placeholder: "/energy/overview", fullWidth: true })}
            ${this._renderTextField("ed.power_flow.energy_dashboard_button_label", "dashboard_link_label", config.dashboard_link_label, { placeholder: "Energy", fullWidth: true })}
            ${this._renderCheckboxField("ed.power_flow.show_header", "show_header", config.show_header !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_dashboard_button", "show_dashboard_link_button", config.show_dashboard_link_button !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_labels", "show_labels", config.show_labels !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_values", "show_values", config.show_values !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_secondary_info", "show_secondary_info", config.show_secondary_info !== false)}
            ${this._renderCheckboxField("ed.power_flow.clickable_entities", "clickable_entities", config.clickable_entities !== false)}
            ${this._renderCheckboxField("ed.power_flow.badge_unavailable", "show_unavailable_badge", config.show_unavailable_badge !== false)}
            ${this._renderCheckboxField("ed.power_flow.show_home_device_popup", "show_home_device_popup", config.show_home_device_popup !== false)}
          </div>
        </section>

        <section class="editor-section">
          ${window.NodaliaUtils.renderEditorCollapsibleSectionHeaderHtml({
            escapeHtml,
            editorLabel: key => this._editorLabel(key),
            titleKey: "ed.light.tap_actions_section_title",
            hintKey: "ed.light.tap_actions_section_hint",
            toggleId: "tap_actions",
            expanded: this._showTapActionsSection === true,
          })}
          ${
            this._showTapActionsSection
              ? `
          <div class="editor-grid editor-grid--stacked">
            ${this._renderSelectField("ed.power_flow.card_tap_action", "tap_action", tapAction, [
              { value: "none", label: "ed.power_flow.tap_none" },
              { value: "more-info", label: "ed.power_flow.tap_more_info_home" },
            ], { fullWidth: true })}
          </div>
              `
              : ""
          }
        </section>

        ${this._renderNodeSection("ed.power_flow.node_grid_title", "ed.power_flow.node_grid_hint_visual", "entities.grid", grid)}
        ${this._renderNodeSection("ed.power_flow.node_home_title", "ed.power_flow.node_home_hint_visual", "entities.home", home)}
        ${this._renderNodeSection("ed.power_flow.node_solar_title", "ed.power_flow.node_solar_hint", "entities.solar", solar)}
        ${this._renderNodeSection("ed.power_flow.node_battery_title", "ed.power_flow.node_battery_hint_visual", "entities.battery", battery)}
        ${this._renderNodeSection("ed.power_flow.node_water_title", "ed.power_flow.node_water_hint", "entities.water", water)}
        ${this._renderNodeSection("ed.power_flow.node_gas_title", "ed.power_flow.node_gas_hint", "entities.gas", gas)}

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.power_flow.individuals_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.individuals_hint"))}</div>
          </div>
          <div class="power-flow-individual-list">
            ${
              individuals.length
                ? individuals.map((item, index) => this._renderIndividualEditorCard(item, index, individuals.length)).join("")
                : `<div class="editor-empty-note">${escapeHtml(this._editorLabel("ed.power_flow.individuals_empty"))}</div>`
            }
          </div>
          <div class="editor-actions">
            <button type="button" data-action="add-individual">${escapeHtml(this._editorLabel("ed.power_flow.add_individual"))}</button>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.power_flow.consumption_chips_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.consumption_chips_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityPickerField("ed.power_flow.consumption_day_entity", "consumption_chips.day_entity", config.consumption_chips?.day_entity, {
              placeholder: "sensor.home_energy_today",
              fullWidth: true,
              domains: ["sensor"],
            })}
            ${this._renderTextField("ed.power_flow.consumption_day_label", "consumption_chips.day_label", config.consumption_chips?.day_label, { placeholder: "Today", fullWidth: true })}
            ${this._renderEntityPickerField("ed.power_flow.consumption_month_entity", "consumption_chips.month_entity", config.consumption_chips?.month_entity, {
              placeholder: "sensor.home_energy_month",
              fullWidth: true,
              domains: ["sensor"],
            })}
            ${this._renderTextField("ed.power_flow.consumption_month_label", "consumption_chips.month_label", config.consumption_chips?.month_label, { placeholder: "Month", fullWidth: true })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.power_flow.flow_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.flow_hint_visual"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("ed.power_flow.zero_lines_mode", "display_zero_lines.mode", config.display_zero_lines?.mode || "show", [
              { value: "show", label: "ed.power_flow.zero_lines_show" },
              { value: "hide", label: "ed.power_flow.zero_lines_hide" },
            ])}
            ${this._renderTextField("ed.power_flow.zero_lines_transparency", "display_zero_lines.transparency", config.display_zero_lines?.transparency, {
              type: "number",
              valueType: "number",
              placeholder: "50",
            })}
            ${this._renderRgbArrayColorField("ed.power_flow.zero_line_color", "display_zero_lines.grey_color", config.display_zero_lines?.grey_color)}
            ${this._renderTextField("ed.power_flow.flow_min_s", "min_flow_rate", config.min_flow_rate, {
              type: "number",
              valueType: "number",
              placeholder: "1.4",
            })}
            ${this._renderTextField("ed.power_flow.flow_max_s", "max_flow_rate", config.max_flow_rate, {
              type: "number",
              valueType: "number",
              placeholder: "5.8",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.haptics_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.power_flow.enable_haptics", "haptics.enabled", config.haptics?.enabled === true)}
            ${this._renderCheckboxField("ed.nav.vibrate_fallback", "haptics.fallback_vibrate", config.haptics?.fallback_vibrate === true)}
            ${this._renderSelectField("ed.vacuum.haptic_style", "haptics.style", hapticStyle, [
              { value: "selection", label: "ed.weather.haptic_selection" },
              { value: "light", label: "ed.weather.haptic_light" },
              { value: "medium", label: "ed.weather.haptic_medium" },
              { value: "heavy", label: "ed.weather.haptic_heavy" },
              { value: "success", label: "ed.weather.haptic_success" },
              { value: "warning", label: "ed.weather.haptic_warning" },
              { value: "failure", label: "ed.weather.haptic_failure" },
            ])}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.animations_hint_visual"))}</div>
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
                  ${this._renderCheckboxField("ed.power_flow.enable_animations", "animations.enabled", animations.enabled !== false)}
                  ${this._renderTextField("ed.power_flow.content_duration_ms", "animations.content_duration", animations.content_duration, {
                    type: "number",
                    valueType: "number",
                  })}
                  ${this._renderTextField("ed.power_flow.button_bounce_ms", "animations.button_bounce_duration", animations.button_bounce_duration, {
                    type: "number",
                    valueType: "number",
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.power_flow.style_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.power_flow.style_section_hint"))}</div>
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
                  ${this._renderTextField("ed.person.style_card_bg", "styles.card.background", config.styles?.card?.background)}
                  ${this._renderTextField("ed.person.style_card_border", "styles.card.border", config.styles?.card?.border)}
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
                  ${this._renderTextField("ed.person.style_card_shadow", "styles.card.box_shadow", config.styles?.card?.box_shadow)}
                  ${this._renderTextField("ed.person.style_card_padding", "styles.card.padding", config.styles?.card?.padding)}
                  ${this._renderTextField("ed.person.style_card_gap", "styles.card.gap", config.styles?.card?.gap)}
                  ${this._renderTextField("ed.power_flow.icon_node_size", "styles.icon.node_size", config.styles?.icon?.node_size)}
                  ${this._renderTextField("ed.power_flow.icon_home_size", "styles.icon.home_size", config.styles?.icon?.home_size)}
                  ${this._renderTextField("ed.power_flow.icon_individual_size", "styles.icon.individual_size", config.styles?.icon?.individual_size)}
                  ${this._renderTextField("ed.power_flow.icons_color", "styles.icon.color", config.styles?.icon?.color)}
                  ${this._renderTextField("ed.person.style_title_size", "styles.title_size", config.styles?.title_size)}
                  ${this._renderTextField("ed.person.style_chip_height", "styles.chip_height", config.styles?.chip_height)}
                  ${this._renderTextField("ed.person.style_chip_font", "styles.chip_font_size", config.styles?.chip_font_size)}
                  ${this._renderTextField("ed.entity.style_chip_padding", "styles.chip_padding", config.styles?.chip_padding)}
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
                  ${this._renderTextField("ed.power_flow.home_value_size", "styles.home_value_size", config.styles?.home_value_size)}
                  ${this._renderTextField("ed.power_flow.home_unit_size", "styles.home_unit_size", config.styles?.home_unit_size)}
                  ${this._renderTextField("ed.power_flow.node_value_size", "styles.node_value_size", config.styles?.node_value_size)}
                  ${this._renderTextField("ed.power_flow.secondary_text_size", "styles.secondary_size", config.styles?.secondary_size)}
                  ${this._renderTextField("ed.power_flow.flow_line_width", "styles.flow_width", config.styles?.flow_width)}
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
      });

    this._ensureEditorControlsReady();
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}
  _lazyNodaliaPowerFlowCardVisualEditor = NodaliaPowerFlowCardVisualEditor;
  return NodaliaPowerFlowCardVisualEditor;
}
