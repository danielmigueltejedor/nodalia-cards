// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { SERIES_COLORS } from "./graph-constants";
import {
  deepClone,
  deleteByPath,
  escapeHtml,
  fireEvent,
  setByPath,
} from "./graph-runtime";
import {
  DEFAULT_CONFIG,
  STUB_CONFIG,
  normalizeConfig,
  normalizeEditorConfig,
} from "./graph-config";
import {
  compactConfig,
  formatEditorColorFromHex,
  getByPath,
  getEditorColorFallbackValue,
  getEditorColorModel,
  moveItem,
} from "./graph-helpers";

let _lazyNodaliaGraphCardEditorLegacy;
export function loadNodaliaGraphCardEditorLegacy() {
  if (_lazyNodaliaGraphCardEditorLegacy) {
    return _lazyNodaliaGraphCardEditorLegacy;
  }
class NodaliaGraphCardEditorLegacy extends HTMLElement {
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
      case "entities":
        return String(input.value || "")
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean)
          .map((line, index) => {
            const [entity, name = "", color = ""] = line.split("|").map(part => part.trim());
            return {
              entity,
              name,
              color: color || SERIES_COLORS[index % SERIES_COLORS.length],
            };
          })
          .filter(entry => entry.entity);
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

  _serializeEntities() {
    return this._config.entities
      .map(entry => [entry.entity || "", entry.name || "", entry.color || ""].join("|"))
      .join("\n");
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";

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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("General"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Configura titulo, entidades y rango visible de la grafica."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Temperature",
            })}
            ${this._renderTextField("Icono", "icon", config.icon, {
              placeholder: "mdi:water-percent",
            })}
            ${this._renderTextField("Minimo", "min", config.min, {
              type: "number",
              placeholder: "0",
            })}
            ${this._renderTextField("Maximo", "max", config.max, {
              type: "number",
              placeholder: "100",
            })}
            ${this._renderTextField("Horas a mostrar", "hours_to_show", config.hours_to_show, {
              type: "number",
              placeholder: "24",
            })}
            ${this._renderTextField("Puntos", "points", config.points, {
              type: "number",
              placeholder: "48",
            })}
            ${this._renderTextareaField("Entidades", "entities", this._serializeEntities(), {
              valueType: "entities",
              rows: 5,
              placeholder: "sensor.humedad_dormitorio|Dormitorio de Rocio|#f29f05\nsensor.humedad_pasillo|Pasillo|#42a5f5",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Visibilidad"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Activa o desactiva cabecera, valor, leyenda y relleno."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Mostrar cabecera", "show_header", config.show_header !== false)}
            ${this._renderCheckboxField("Mostrar icono", "show_icon", config.show_icon !== false)}
            ${this._renderCheckboxField("Mostrar valor grande", "show_value", config.show_value !== false)}
            ${this._renderCheckboxField("Mostrar leyenda", "show_legend", config.show_legend !== false)}
            ${this._renderCheckboxField("Mostrar relleno", "show_fill", config.show_fill !== false)}
            ${this._renderCheckboxField("Mostrar badge de no disponible", "show_unavailable_badge", config.show_unavailable_badge !== false)}
            ${this._renderSelectField(
              "ed.entity.tap_action",
              "tap_action",
              config.tap_action || "more-info",
              [
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
            )}
            ${this._renderSelectField(
              "ed.light.card_hold_action",
              "hold_action",
              config.hold_action || "more-info",
              [
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Haptics"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Respuesta haptica opcional al tocar la tarjeta."))}</div>
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Estilos"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Ajustes visuales del grafico y el look Nodalia."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Background", "styles.card.background", config.styles.card.background)}
            ${this._renderTextField("Border", "styles.card.border", config.styles.card.border)}
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
            ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
            ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
            ${this._renderTextField("Separacion", "styles.card.gap", config.styles.card.gap)}
            ${this._renderTextField("Tamano icono", "styles.icon.size", config.styles.icon.size)}
            ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
            ${this._renderTextField("Tamano valor", "styles.value_size", config.styles.value_size)}
            ${this._renderTextField("Tamano unidad", "styles.unit_size", config.styles.unit_size)}
            ${this._renderTextField("Tamano leyenda", "styles.legend_size", config.styles.legend_size)}
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
            ${this._renderTextField("Alto grafico", "styles.chart_height", config.styles.chart_height)}
            ${this._renderTextField("Grosor linea", "styles.line_width", config.styles.line_width)}
          </div>
        </section>
      </div>
    `;
  }
}
  _lazyNodaliaGraphCardEditorLegacy = NodaliaGraphCardEditorLegacy;
  return NodaliaGraphCardEditorLegacy;
}

let _lazyNodaliaGraphCardEditor;
export function loadNodaliaGraphCardEditor() {
  if (_lazyNodaliaGraphCardEditor) {
    return _lazyNodaliaGraphCardEditor;
  }
class NodaliaGraphCardEditor extends HTMLElement {
  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeEditorConfig(STUB_CONFIG);
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
    this._config = normalizeEditorConfig(config || {});
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
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id =>
      id.startsWith("sensor.") || id.startsWith("number.") || id.startsWith("input_number."),
    );
  }

  _getEntityOptions(field = "entities.0.entity", domains = []) {
    const normalizedDomains = Array.isArray(domains)
      ? domains.map(domain => String(domain || "").trim()).filter(Boolean)
      : [];
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => (
        !normalizedDomains.length
        || normalizedDomains.some(domain => entityId.startsWith(`${domain}.`))
      ))
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

  _captureFocusState() {
    return window.NodaliaUtils.captureEditorFocusState(this);
  }

  _restoreFocusState(focusState) {
    window.NodaliaUtils.restoreEditorFocusState(this, focusState);
  }

  _emitConfig() {
    const focusState = this._captureFocusState();
    const nextConfig = deepClone(this._config);

    if (!Array.isArray(nextConfig.entities)) {
      nextConfig.entities = [];
    }

    delete nextConfig.entity;
    this._config = normalizeEditorConfig(compactConfig(nextConfig));
    this._render();
    this._restoreFocusState(focusState);
    fireEvent(this, "config-changed", {
      config: compactConfig(window.NodaliaUtils.stripEqualToDefaults(nextConfig, DEFAULT_CONFIG) ?? {}),
    });
  }

  _setEditorConfig() {
    this._config = normalizeEditorConfig(compactConfig(this._config));
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
        const trimmed = String(input.value || "").trim();
        if (!trimmed) {
          return undefined;
        }

        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : trimmed;
      }
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      case "tristate":
        if (input.value === "true") {
          return true;
        }

        if (input.value === "false") {
          return false;
        }

        return undefined;
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

      return;
    }

    const button = event
      .composedPath()
      .find(node => node instanceof HTMLButtonElement && node.dataset?.action);

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const action = button.dataset.action;
    const index = Number(button.dataset.index);
    this._config.entities = Array.isArray(this._config.entities) ? this._config.entities : [];

    if (action === "add-series") {
      this._config.entities.push({
        entity: "",
        name: "",
        color: SERIES_COLORS[this._config.entities.length % SERIES_COLORS.length],
      });
      this._emitConfig();
      return;
    }

    if (!Number.isInteger(index) || index < 0 || index >= this._config.entities.length) {
      return;
    }

    if (action === "remove-series") {
      this._config.entities.splice(index, 1);
      this._emitConfig();
      return;
    }

    if (action === "move-series-up") {
      moveItem(this._config.entities, index, index - 1);
      this._emitConfig();
      return;
    }

    if (action === "move-series-down") {
      moveItem(this._config.entities, index, index + 1);
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
    const tag = options.multiline ? "textarea" : "input";
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";
    const inputValue = value === undefined || value === null ? "" : String(value);

    if (tag === "textarea") {
      return `
        <label class="editor-field ${options.fullWidth !== false ? "editor-field--full" : ""}">
          <span>${escapeHtml(tLabel)}</span>
          <textarea data-field="${escapeHtml(field)}" data-value-type="${escapeHtml(valueType)}" rows="${options.rows || 2}" ${placeholder}>${escapeHtml(inputValue)}</textarea>
        </label>
      `;
    }

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
    const tColorCustom = this._editorLabel("Color personalizado");
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
            <span class="editor-color-swatch" style="--editor-swatch:${escapeHtml(currentValue)};"></span>
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

  _renderSelectField(label, field, value, options, valueType = "string") {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}" data-value-type="${escapeHtml(valueType)}">
          ${options
            .map(option => {
              const optionValue = option.value === undefined ? "auto" : String(option.value);
              const isSelected =
                value === option.value ||
                (option.value === undefined && value === undefined);

              return `
                <option value="${escapeHtml(optionValue)}" ${isSelected ? "selected" : ""}>
                  ${escapeHtml(this._editorLabel(option.label))}
                </option>
              `;
            })
            .join("")}
        </select>
      </label>
    `;
  }

  _renderEntityField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const domains = Array.isArray(options.domains)
      ? options.domains.map(domain => String(domain || "").trim()).filter(Boolean).join(",")
      : "";

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
          data-domains="${escapeHtml(domains)}"
        ></div>
      </div>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="icon-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
        ></div>
      </div>
    `;
  }

  _renderSeriesCard(series, index, total) {
    const fallbackColor = SERIES_COLORS[index % SERIES_COLORS.length];

    return `
      <div class="series-editor-card">
        <div class="series-editor-card__header">
          <div class="series-editor-card__title">${escapeHtml(this._editorLabel("Serie"))} ${index + 1}</div>
          <div class="series-editor-card__actions">
            <button type="button" data-action="move-series-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>${escapeHtml(this._editorLabel("Subir"))}</button>
            <button type="button" data-action="move-series-down" data-index="${index}" ${index === total - 1 ? "disabled" : ""}>${escapeHtml(this._editorLabel("Bajar"))}</button>
            <button type="button" data-action="remove-series" data-index="${index}" class="danger">${escapeHtml(this._editorLabel("Eliminar"))}</button>
          </div>
        </div>
        <div class="series-editor-subgroup">
          <div class="series-editor-subgroup__title">${escapeHtml(this._editorLabel("Datos"))}</div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityField("Entidad", `entities.${index}.entity`, series.entity, {
              domains: ["sensor", "number", "input_number"],
              placeholder: "sensor.humedad_dormitorio",
              fullWidth: true,
            })}
            ${this._renderTextField("Nombre visible", `entities.${index}.name`, series.name, {
              placeholder: "Bedroom",
              fullWidth: true,
            })}
            ${this._renderColorField("Color de la linea", `entities.${index}.color`, series.color, {
              fallbackValue: fallbackColor,
            })}
          </div>
        </div>
      </div>
    `;
  }

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entities.0.entity";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    const allowedDomains = String(host.dataset.domains || "")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      if (allowedDomains.length) {
        control.includeDomains = allowedDomains;
        control.entityFilter = stateObj => allowedDomains.some(domain => String(stateObj?.entity_id || "").startsWith(`${domain}.`));
      }
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
      control.allowCustomEntity = true;
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: allowedDomains.length === 1
          ? { domain: allowedDomains[0] }
          : {},
      };
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || this._editorLabel("Selecciona una entidad");
      control.appendChild(emptyOption);
      this._getEntityOptions(field, allowedDomains).forEach(option => {
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

  _mountIconPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "icon";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    let control = null;

    if (customElements.get("ha-icon-picker")) {
      control = document.createElement("ha-icon-picker");
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        icon: {},
      };
    } else {
      control = document.createElement("input");
      control.type = "text";
      control.placeholder = placeholder;
      control.addEventListener("input", this._onShadowInput);
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

    if (control.tagName !== "INPUT") {
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
    const entities = Array.isArray(config.entities) ? config.entities : [];

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
        .editor-field select,
        .editor-field textarea,
        .editor-control-host input,
        .editor-control-host select,
        .editor-control-host textarea {
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
          min-height: 72px;
          resize: vertical;
        }

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
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

        .editor-actions {
          display: flex;
          justify-content: flex-start;
        }

        button {
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

        button.danger {
          color: var(--error-color);
        }

        button:disabled {
          cursor: default;
          opacity: 0.45;
        }

        .series-editor-list {
          display: grid;
          gap: 12px;
        }

        .series-editor-card {
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 16px;
          display: grid;
          gap: 12px;
          padding: 14px;
        }

        .series-editor-subgroup {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }

        .series-editor-subgroup__title {
          font-size: 12px;
          font-weight: 700;
        }

        .series-editor-card__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .series-editor-card__title {
          font-size: 13px;
          font-weight: 700;
        }

        .series-editor-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .empty-note {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }

          .series-editor-card__header {
            align-items: start;
            flex-direction: column;
          }

          .series-editor-card__actions {
            justify-content: flex-start;
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("General"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Nombre, icono, rango visible y comportamiento basico de la grafica."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Statistics",
            })}
            ${this._renderIconPickerField("Icono", "icon", config.icon, {
              placeholder: "mdi:chart-line",
            })}
            ${this._renderTextField("Horas a mostrar", "hours_to_show", config.hours_to_show, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("Puntos", "points", config.points, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("Minimo", "min", config.min, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("Maximo", "max", config.max, {
              type: "number",
              valueType: "number",
            })}
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
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.entity.tap_action",
              "tap_action",
              config.tap_action || "more-info",
              [
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
            )}
            ${this._renderSelectField(
              "ed.light.card_hold_action",
              "hold_action",
              config.hold_action || "more-info",
              [
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
            )}
          </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Series"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Anade, reordena y personaliza cada entidad mostrada en la grafica."))}</div>
          </div>
          <div class="series-editor-list">
            ${
              entities.length
                ? entities.map((series, index) => this._renderSeriesCard(series, index, entities.length)).join("")
                : `<div class="empty-note">${escapeHtml(this._editorLabel("Todavia no has anadido ninguna serie."))}</div>`
            }
          </div>
          <div class="editor-actions">
            <button type="button" data-action="add-series">${escapeHtml(this._editorLabel("Anadir serie"))}</button>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Visibilidad"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Activa o desactiva cabecera, valor grande, leyenda y relleno."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Mostrar cabecera", "show_header", config.show_header !== false)}
            ${this._renderCheckboxField("Mostrar icono", "show_icon", config.show_icon !== false)}
            ${this._renderCheckboxField("Mostrar valor grande", "show_value", config.show_value !== false)}
            ${this._renderCheckboxField("Mostrar leyenda", "show_legend", config.show_legend !== false)}
            ${this._renderCheckboxField("Mostrar relleno", "show_fill", config.show_fill !== false)}
            ${this._renderCheckboxField("Mostrar badge de no disponible", "show_unavailable_badge", config.show_unavailable_badge !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Haptics"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Respuesta tactil opcional para taps, hover y cambios de serie."))}</div>
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Animaciones"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Controla la entrada del tooltip y el rebote visual de los chips."))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("Ocultar ajustes de animacion") : this._editorLabel("Mostrar ajustes de animacion"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("Activar animaciones", "animations.enabled", config.animations.enabled !== false)}
                  ${this._renderTextField("Tooltip y hover (ms)", "animations.hover_duration", config.animations.hover_duration, {
                    type: "number",
                    valueType: "number",
                  })}
                  ${this._renderTextField("Rebote de chips (ms)", "animations.button_bounce_duration", config.animations.button_bounce_duration, {
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Estilos"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Ajustes visuales de la card, el icono y el grafico."))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showStyleSection ? this._editorLabel("Ocultar ajustes de estilo") : this._editorLabel("Mostrar ajustes de estilo"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("Fondo tarjeta", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("Borde", "styles.card.border", config.styles.card.border)}
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
                  ${this._renderTextField("Sombra", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("Separacion", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderColorField("Color icono", "styles.icon.color", config.styles.icon.color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderTextField("Tamano icono", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("Tamano valor", "styles.value_size", config.styles.value_size)}
                  ${this._renderTextField("Tamano unidad", "styles.unit_size", config.styles.unit_size)}
                  ${this._renderTextField("Tamano leyenda", "styles.legend_size", config.styles.legend_size)}
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
                  ${this._renderTextField("Alto grafica", "styles.chart_height", config.styles.chart_height)}
                  ${this._renderTextField("Grosor linea", "styles.line_width", config.styles.line_width)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="entity-picker"]')
      .forEach(host => this._mountEntityPicker(host));

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="icon-picker"]')
      .forEach(host => this._mountIconPicker(host));

    this._ensureEditorControlsReady();
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}
  _lazyNodaliaGraphCardEditor = NodaliaGraphCardEditor;
  return NodaliaGraphCardEditor;
}
