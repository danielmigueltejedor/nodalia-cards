import { captureHassContext, sameHassContext } from "../../shared/hass-context";
import type { HassContext } from "../../shared/hass-context";
import { EDITOR_TOGGLE_STYLES, EDITOR_RADIUS_STYLES, EDITOR_SECTION_ACTION_STYLES } from "../../shared/editor-toggle-styles";
import {
  compactConfig,
  deepClone,
  deleteByPath,
  escapeHtml,
  fireEvent,
  setByPath,
} from "./climate-runtime";

import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./climate-config";
import {
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
} from "./climate-model";

import type { HomeAssistant, HassEntity } from "../../core/types/home-assistant";
import type { EditorFocusState } from "../../core/types/nodalia-utils";
import type { NodaliaEngineStatus } from "../../core/types/engine";
import type { ClimateConfig } from "./climate-types";
import { editorControlValue, isNativeEditorInput, type NativeEditorInput } from "../../shared/editor-controls";
import { parseFiniteNumericValue } from "../../shared/numeric-values";
interface FieldOptions { fullWidth?: boolean; multiline?: boolean; rows?: number; placeholder?: string; type?: string; valueType?: string; fallbackValue?: string; }
interface ClimateEditorEngineSurface {
  _hass: HomeAssistant | null;
  _engineStatus: NodaliaEngineStatus | null;
  _engineStatusSignature: string;
  _engineStatusInFlight: boolean;
  _engineRequestGeneration: number;
  isConnected: boolean;
  shadowRoot: ShadowRoot | null;
  _captureFocusState(): EditorFocusState | null;
  _restoreFocusState(state: EditorFocusState | null): void;
  _render(): void;
  _editorLabel(key: string): string;
  _renderSelectField(label: string, field: string, value: unknown, options: {value: string; label: string}[], renderOptions?: FieldOptions): string;
  _renderTextField(label: string, field: string, value: unknown, options?: FieldOptions): string;
  _renderCheckboxField(label: string, field: string, checked: unknown): string;
}

/**
 * Engine status plumbing for the registered Climate editor: while the Engine owns schedules the
 * legacy webhook and helper fields are hidden, otherwise they stay available as a fallback.
 */
export async function refreshClimateEditorEngineStatus(editor: ClimateEditorEngineSurface) {
  const backend = typeof window !== "undefined" ? window.NodaliaBackend : null;
  if (!backend || typeof backend.getEditorEngineStatus !== "function" || !editor._hass || editor._engineStatusInFlight) {
    return;
  }
  if (!editor.isConnected) return;
  const generation = editor._engineRequestGeneration;
  const hass = editor._hass;
  editor._engineStatusInFlight = true;
  try {
    const engine = await backend.getEditorEngineStatus(hass);
    if (!editor.isConnected || generation !== editor._engineRequestGeneration) return;
    const signature = window.NodaliaUtils?.engineStatusSignature?.(engine) ?? "";
    if (signature === editor._engineStatusSignature) {
      return;
    }
    editor._engineStatus = engine;
    editor._engineStatusSignature = signature;
    if (editor.isConnected && editor.shadowRoot) {
      const focusState = editor._captureFocusState();
      editor._render();
      editor._restoreFocusState(focusState);
    }
  } catch (_error) {
    // Without the Engine the editor keeps rendering the legacy schedule fields.
  } finally {
    if (generation === editor._engineRequestGeneration) editor._engineStatusInFlight = false;
  }
}

export function climateEditorEngineSchedulesActive(editor: ClimateEditorEngineSurface) {
  return editor?._engineStatus?.available === true && editor._engineStatus?.caps?.climateSchedules === true;
}

export function renderClimateEditorEngineBannerHtml(editor: ClimateEditorEngineSurface) {
  return window.NodaliaUtils?.renderEditorEngineBannerHtml?.({
    engine: editor?._engineStatus,
    label: (key: string) => editor._editorLabel(key),
    fullWidthClass: "",
    extraRows: editor?._engineStatus?.caps?.climateOverrides === true
      ? [
        window.NodaliaUtils?.applyLabelValues?.(editor._editorLabel("ed.engine.climate_overrides_hint"), {
          hold: editor._editorLabel("ed.climate.override_2h"),
          resume: editor._editorLabel("ed.climate.override_clear"),
        }) || "",
      ]
      : [],
  }) || "";
}

export function renderClimateEditorScheduleSectionHtml(editor: ClimateEditorEngineSurface, config: ClimateConfig) {
  const engineActive = climateEditorEngineSchedulesActive(editor);
  const weekStartsField = editor._renderSelectField(
    "ed.climate.schedule_week_starts_on",
    "setpoint_schedule_week_starts_on",
    config.setpoint_schedule_week_starts_on === "sunday" ? "sunday" : "monday",
    [
      { value: "monday", label: "ed.climate.schedule_week_starts_monday" },
      { value: "sunday", label: "ed.climate.schedule_week_starts_sunday" },
    ],
  );

  if (engineActive) {
    return `
      ${renderClimateEditorEngineBannerHtml(editor)}
      ${weekStartsField}
    `;
  }

  return `
    <div class="editor-engine-note">${escapeHtml(editor._editorLabel("ed.engine.offline_hint"))}</div>
    ${editor._renderTextField("ed.climate.schedule_webhook", "setpoint_schedule_webhook", config.setpoint_schedule_webhook || "", {
      placeholder: "nodalia_climate_setpoint_schedule",
      fullWidth: true,
    })}
    ${editor._renderTextField("ed.climate.schedule_helper", "setpoint_schedule_helper", config.setpoint_schedule_helper || "", {
      placeholder: "input_text.nodalia_climate_schedule_salon",
      fullWidth: true,
    })}
    ${weekStartsField}
    ${editor._renderCheckboxField(
      "ed.calendar.allow_webhooks_non_admin",
      "security.allow_webhooks_for_non_admin",
      config.security?.allow_webhooks_for_non_admin === true,
    )}
  `;
}

let _lazyNodaliaClimateCardEditor: CustomElementConstructor | undefined;
export function loadNodaliaClimateCardEditor(): CustomElementConstructor {
  if (_lazyNodaliaClimateCardEditor) {
    return _lazyNodaliaClimateCardEditor;
  }
class NodaliaClimateCardEditor extends HTMLElement {
  declare private _hassContext: HassContext | null;
  _config!: ClimateConfig;
  _hass!: HomeAssistant | null;
  _entityOptionsSignature!: string;
  _showStyleSection!: boolean;
  _showAnimationSection!: boolean;
  _showTapActionsSection!: boolean;
  _pendingEditorControlTags!: Set<string>;
  _engineStatus!: NodaliaEngineStatus | null;
  _engineStatusSignature!: string;
  _engineStatusInFlight!: boolean;
  _engineRequestGeneration!: number;

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._hassContext = null;
    this._entityOptionsSignature = "";
    this._showStyleSection = false;
    this._showAnimationSection = false;
    this._showTapActionsSection = false;
    this._pendingEditorControlTags = new Set();
    this._engineStatus = null;
    this._engineStatusSignature = "";
    this._engineStatusInFlight = false;
    this._engineRequestGeneration = 0;
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
    void refreshClimateEditorEngineStatus(this);
  }

  disconnectedCallback() {
    this._detachEditorShadowListeners();
    window.NodaliaUtils?.releaseEditorDialogLayoutFix?.(this);
    this._engineRequestGeneration++;
    this._engineStatusInFlight = false;
  }

  set hass(hass: HomeAssistant) {
    const context = captureHassContext(hass);
    const changedContext = !this._hassContext || !sameHassContext(this._hassContext, context);
    this._hassContext = context;
    if (changedContext) {
      this._engineRequestGeneration++;
      this._engineStatusInFlight = false;
      this._engineStatus = null;
      this._engineStatusSignature = "";
    }
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender = changedContext ||
      !this._hass ||
      nextSignature !== this._entityOptionsSignature ||
      !this.shadowRoot?.firstChild;

    this._hass = hass;
    this._entityOptionsSignature = nextSignature;

    if (!shouldRender) {
      void refreshClimateEditorEngineStatus(this);
      return;
    }

    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
    void refreshClimateEditorEngineStatus(this);
  }

  setConfig(config: unknown) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._render();
    this._restoreFocusState(focusState);
    void refreshClimateEditorEngineStatus(this);
  }

  _watchEditorControlTag(tagName: string) {
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

  _getEntityOptionsSignature(hass: HomeAssistant | null = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature?.(hass, this._config?.language, id => id.startsWith("climate.")) ?? "";
  }

  _getClimateEntityOptions() {
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => entityId.startsWith("climate."))
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

  _restoreFocusState(focusState: EditorFocusState | null) {
    window.NodaliaUtils.restoreEditorFocusState(this, focusState);
  }

  _emitConfig() {
    const focusState = this._captureFocusState();
    const nextConfig = deepClone(this._config);
    this._config = normalizeConfig(compactConfig(nextConfig));
    this._render();
    this._restoreFocusState(focusState);
    fireEvent(this, "config-changed", {
      config: compactConfig(window.NodaliaUtils.stripEqualToDefaults?.(nextConfig, DEFAULT_CONFIG) ?? {}),
    });
  }

  _setEditorConfig() {
    this._config = normalizeConfig(compactConfig(this._config));
  }

  _setFieldValue(path: string, value: unknown) {
    if (value === undefined || value === null || value === "") {
      deleteByPath(this._config, path);
      return;
    }

    setByPath(this._config, path, value);
  }

  _readFieldValue(input: NativeEditorInput) {
    const valueType = input.dataset.valueType || "string";

    switch (valueType) {
      case "boolean":
        return input instanceof HTMLInputElement && input.checked;
      case "number": {
        return parseFiniteNumericValue(input.value) ?? undefined;
      }
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      default:
        return input.value;
    }
  }

  _onShadowInput(event: Event) {
    const input = event
      .composedPath()
      .find(isNativeEditorInput);

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

  _onShadowValueChanged(event: Event) {
    const control = event
      .composedPath()
      .find((node): node is HTMLElement => node instanceof HTMLElement && Boolean(node.dataset.field));

    if (!control?.dataset?.field) {
      return;
    }

    event.stopPropagation();

    const nextValue = editorControlValue(event, control);
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

  _onShadowClick(event: Event) {
    const toggleButton = event
      .composedPath()
      .find((node): node is HTMLElement => node instanceof HTMLElement && Boolean(node.dataset.editorToggle));

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

  _editorLabel(s: string) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    const hass = this._hass;
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", s);
  }

  _renderTextField(label: string, field: string, value: unknown, options: FieldOptions = {}) {
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

  _renderColorField(label: string, field: string, value: unknown, options: FieldOptions = {}) {
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
            <span class="editor-color-swatch" style="--editor-swatch:${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>
    `;
  }

  _renderCheckboxField(label: string, field: string, checked: unknown) {
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

  _renderSelectField(label: string, field: string, value: unknown, options: {value: string; label: string}[], renderOptions: FieldOptions = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field${renderOptions.fullWidth ? " editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options
            .map(option => `
              <option value="${escapeHtml(String(option.value))}" ${String(value) === String(option.value) ? "selected" : ""}>
                ${escapeHtml(this._editorLabel(option.label))}
              </option>
            `)
            .join("")}
        </select>
      </label>
    `;
  }

  _renderEntityField(label: string, field: string, value: unknown, options: FieldOptions = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
        ></div>
      </div>
    `;
  }

  _renderIconPickerField(label: string, field: string, value: unknown, options: FieldOptions = {}) {
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

  _mountEntityPicker(host: HTMLElement) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    let control: HTMLElement;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      Object.assign(control, { includeDomains: ["climate"] });
      Object.assign(control, { allowCustomEntity: true });
      Object.assign(control, { entityFilter: (stateObj: HassEntity) => String(stateObj?.entity_id || "").startsWith("climate.") });
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      Object.assign(control, { selector: {
        entity: {
          domain: "climate",
        },
      } });
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || this._editorLabel("ed.person.select_entity");
      control.appendChild(emptyOption);
      this._getClimateEntityOptions().forEach(option => {
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
      Object.assign(control, { hass: this._hass });
    }

    if ("value" in control) {
      Object.assign(control, { value: nextValue });
    }

    if (control.tagName !== "SELECT") {
      control.addEventListener("value-changed", this._onShadowValueChanged);
    }

    host.replaceChildren(control);
  }

  _mountIconPicker(host: HTMLElement) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "icon";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    let control: HTMLElement;

    if (customElements.get("ha-icon-picker")) {
      control = document.createElement("ha-icon-picker");
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      Object.assign(control, { selector: {
        icon: {},
      } });
    } else {
      control = document.createElement("input");
      Object.assign(control, { type: "text" });
      Object.assign(control, { placeholder });
      control.addEventListener("input", this._onShadowInput);
      control.addEventListener("change", this._onShadowInput);
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      Object.assign(control, { hass: this._hass });
    }

    if ("value" in control) {
      Object.assign(control, { value: nextValue });
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
    const tapAction = config.tap_action || "more-info";
    const holdAction = config.hold_action || "more-info";
    const doubleTapAction = config.double_tap_action || "none";

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

        ${window.NodaliaUtils?.renderEditorEngineBannerStyles?.() || ""}

        .editor-engine-banner {
          grid-column: 1 / -1;
        }

        .editor-engine-note {
          color: var(--secondary-text-color);
          font-size: 11px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        ${EDITOR_SECTION_ACTION_STYLES}

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

        ${EDITOR_RADIUS_STYLES}


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

        @media (max-width: 640px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }
        }

        ${EDITOR_TOGGLE_STYLES}
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.general_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderEntityField("ed.climate.climate_entity", "entity", config.entity, {
              placeholder: "climate.salon",
              fullWidth: true,
            })}
            ${this._renderSelectField("ed.entity.layout", "layout", config.layout || "circular", [
              { value: "compact", label: "ed.shared.layout_compact" },
              { value: "circular", label: "ed.shared.layout_circular" },
            ])}
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: "Salon",
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, {
              placeholder: "mdi:thermostat",
              fullWidth: true,
            })}
            ${this._renderCheckboxField("ed.entity.show_entity_picture", "show_entity_picture", config.show_entity_picture === true)}
            ${this._renderTextField("ed.entity.entity_picture", "entity_picture", config.entity_picture, {
              placeholder: "/local/climate.png",
              fullWidth: true,
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
          <div class="editor-grid editor-grid--stacked">
            ${this._renderSelectField(
              "ed.climate.tap_action",
              "tap_action",
              tapAction,
              [
                { value: "more-info", label: "ed.climate.tap_more_info" },
                { value: "none", label: "ed.climate.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.climate.hold_action",
              "hold_action",
              holdAction,
              [
                { value: "more-info", label: "ed.climate.tap_more_info" },
                { value: "none", label: "ed.climate.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.climate.double_tap_action",
              "double_tap_action",
              doubleTapAction,
              [
                { value: "none", label: "ed.climate.tap_none" },
                { value: "more-info", label: "ed.climate.tap_more_info" },
              ],
              { fullWidth: true },
            )}
          </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.climate.display_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.display_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.climate.main_temperature",
              "display.main_temperature",
              config.display?.main_temperature === "current" ? "current" : "target",
              [
                { value: "target", label: "ed.climate.main_temperature_target" },
                { value: "current", label: "ed.climate.main_temperature_current" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.visibility_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.climate.chip_state", "show_state_chip", config.show_state_chip !== false)}
            ${this._renderCheckboxField("ed.climate.chip_current_temp", "show_current_temperature_chip", config.show_current_temperature_chip !== false)}
            ${this._renderCheckboxField("ed.climate.chip_humidity", "show_humidity_chip", config.show_humidity_chip !== false)}
            ${this._renderCheckboxField("ed.climate.mode_buttons", "show_mode_buttons", config.show_mode_buttons !== false)}
            ${this._renderCheckboxField("ed.climate.step_controls", "show_step_controls", config.show_step_controls !== false)}
            ${this._renderCheckboxField("ed.climate.schedule_button", "show_schedule_button", config.show_schedule_button !== false)}
            ${this._renderCheckboxField("ed.media_player.show_unavailable_badge", "show_unavailable_badge", config.show_unavailable_badge !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.climate.schedule_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(
              climateEditorEngineSchedulesActive(this)
                ? this._editorLabel("ed.engine.climate_managed_hint")
                : this._editorLabel("ed.climate.schedule_section_hint"),
            )}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${renderClimateEditorScheduleSectionHtml(this, config)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.haptics_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.entity.enable_haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("ed.entity.fallback_vibrate", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderCheckboxField("ed.haptics.dial_temperature", "haptics.scrolls.temperature_dial", config.haptics.scrolls?.temperature_dial !== false)}
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.climate.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.animations_hint"))}</div>
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
                  ${this._renderTextField("ed.climate.dial_ms", "animations.dial_duration", config.animations.dial_duration, {
                    type: "number",
                    valueType: "number",
                  })}
                  ${this._renderTextField("ed.climate.button_bounce_ms", "animations.button_bounce_duration", config.animations.button_bounce_duration, {
                    type: "number",
                    valueType: "number",
                  })}
                  ${this._renderTextField("ed.climate.content_entrance_ms", "animations.content_duration", config.animations.content_duration, {
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.climate.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.styles_hint_main"))}</div>
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
                  ${this._renderTextField("ed.climate.bubble_size", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderColorField("ed.climate.bubble_bg", "styles.icon.background", config.styles.icon.background, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
                  })}
                  ${this._renderColorField("ed.climate.icon_on", "styles.icon.on_color", config.styles.icon.on_color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderColorField("ed.climate.icon_off", "styles.icon.off_color", config.styles.icon.off_color, {
                    fallbackValue: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
                  })}
                  ${this._renderTextField("ed.climate.title_size", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("ed.climate.current_temp_size", "styles.current_size", config.styles.current_size)}
                  ${this._renderTextField("ed.climate.target_size", "styles.target_size", config.styles.target_size)}
                  ${this._renderTextField("ed.climate.chip_height", "styles.chip_height", config.styles.chip_height)}
                  ${this._renderTextField("ed.climate.chip_text", "styles.chip_font_size", config.styles.chip_font_size)}
                  ${this._renderTextField("ed.climate.chip_padding", "styles.chip_padding", config.styles.chip_padding)}
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
                  ${this._renderTextField("ed.climate.dial_size", "styles.dial.size", config.styles.dial.size)}
                  ${this._renderTextField("ed.climate.dial_max_size", "styles.dial.max_size", config.styles.dial.max_size)}
                  ${this._renderTextField("ed.climate.dial_stroke", "styles.dial.stroke", config.styles.dial.stroke)}
                  ${this._renderTextField("ed.climate.thumb_size", "styles.dial.thumb_size", config.styles.dial.thumb_size)}
                  ${this._renderColorField("ed.climate.dial_background", "styles.dial.background", config.styles.dial.background, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 2%, transparent)",
                  })}
                  ${this._renderColorField("ed.climate.track_dial", "styles.dial.track_color", config.styles.dial.track_color, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 24%, var(--ha-card-background))",
                  })}
                  ${this._renderColorField("ed.climate.color_heat", "styles.dial.heat_color", config.styles.dial.heat_color, {
                    fallbackValue: "#f59f42",
                  })}
                  ${this._renderColorField("ed.climate.color_cool", "styles.dial.cool_color", config.styles.dial.cool_color, {
                    fallbackValue: "#71c0ff",
                  })}
                  ${this._renderColorField("ed.climate.color_dry", "styles.dial.dry_color", config.styles.dial.dry_color, {
                    fallbackValue: "#7fd0c8",
                  })}
                  ${this._renderColorField("ed.climate.color_auto", "styles.dial.auto_color", config.styles.dial.auto_color, {
                    fallbackValue: "#c5a66f",
                  })}
                  ${this._renderColorField("ed.climate.color_fan", "styles.dial.fan_color", config.styles.dial.fan_color, {
                    fallbackValue: "#83d39c",
                  })}
                  ${this._renderColorField("ed.climate.color_off", "styles.dial.off_color", config.styles.dial.off_color, {
                    fallbackValue: "rgba(255, 255, 255, 0.28)",
                  })}
                  ${this._renderTextField("ed.climate.mode_button_size", "styles.control.size", config.styles.control.size)}
                  ${this._renderColorField("ed.entity.style_accent_bg", "styles.control.accent_background", config.styles.control.accent_background, {
                    fallbackValue: "rgba(113, 192, 255, 0.18)",
                  })}
                  ${this._renderColorField("ed.entity.style_accent_color", "styles.control.accent_color", config.styles.control.accent_color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderTextField("ed.climate.step_button_size", "styles.step_control.size", config.styles.step_control.size)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll<HTMLElement>('[data-mounted-control="entity-picker"]')
      .forEach(host => this._mountEntityPicker(host));

    this.shadowRoot
      .querySelectorAll<HTMLElement>('[data-mounted-control="icon-picker"]')
      .forEach(host => this._mountIconPicker(host));

    this._ensureEditorControlsReady();
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}
  _lazyNodaliaClimateCardEditor = NodaliaClimateCardEditor;
  return NodaliaClimateCardEditor;
}
