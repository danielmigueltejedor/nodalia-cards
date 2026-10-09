import { EDITOR_TOGGLE_STYLES, EDITOR_RADIUS_STYLES, EDITOR_COLOR_STYLES, EDITOR_SECTION_ACTION_STYLES } from "../../shared/editor-toggle-styles";
import type { HomeAssistant, HassEntity } from "../../core/types/home-assistant";
import type { EditorFocusState } from "../../core/types/nodalia-utils";
import { editorControlValue, isNativeEditorInput, type NativeEditorInput } from "../../shared/editor-controls";
import { parseFiniteNumericValue } from "../../shared/numeric-values";
import { escapeHtml, isObject } from "./calendar-runtime";
import { DEFAULT_CONFIG, normalizeConfig } from "./calendar-config";
import {
  compactCalendarConfig,
  deepClone,
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
  sanitizeCalendarTint,
} from "./calendar-helpers";

type CalendarEntry = ReturnType<typeof normalizeConfig>["calendars"][number];
interface FieldOptions { fullWidth?: boolean; type?: string; valueType?: string; placeholder?: string; hint?: string; fallbackValue?: string; options?: { value: string; label: string }[]; }
let _lazyNodaliaCalendarCardEditor: CustomElementConstructor | undefined;
export function loadNodaliaCalendarCardEditor(): CustomElementConstructor {
  if (_lazyNodaliaCalendarCardEditor) {
    return _lazyNodaliaCalendarCardEditor;
  }
class NodaliaCalendarCardEditor extends HTMLElement {
  private _config!: ReturnType<typeof normalizeConfig>;
  private _hass!: HomeAssistant | null;
  private _showHapticsSection!: boolean;
  private _showAnimationSection!: boolean;
  private _showStyleSection!: boolean;
  private _entityOptionsSignature!: string;
  private _pendingEditorControlTags!: Set<string>;

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(DEFAULT_CONFIG);
    this._hass = null;
    this._showHapticsSection = false;
    this._showAnimationSection = false;
    this._showStyleSection = false;
    this._entityOptionsSignature = "";
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

  set hass(hass: HomeAssistant) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender =
      !this._hass ||
      nextSignature !== this._entityOptionsSignature ||
      !this.shadowRoot?.firstChild;

    this._hass = hass;
    this._entityOptionsSignature = nextSignature;

    if (shouldRender) {
      const focusState = this._captureFocusState();
      this._render();
      this._restoreFocusState(focusState);
      return;
    }

    this.shadowRoot?.querySelectorAll("ha-entity-picker, ha-selector, ha-icon-picker").forEach(el => {
      if ("hass" in el) {
        el.hass = hass;
      }
    });
  }

  setConfig(config: unknown) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._render();
    this._restoreFocusState(focusState);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    if (window.NodaliaUtils?.editorFilteredStatesSignature) {
      return window.NodaliaUtils.editorFilteredStatesSignature(
        hass,
        this._config?.language,
        id => id.startsWith("calendar.") || id.startsWith("weather."),
      );
    }
    return Object.keys(hass?.states || {})
      .filter(id => id.startsWith("calendar.") || id.startsWith("weather."))
      .join("|");
  }

  _editorLabel(s: string) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    return window.NodaliaI18n.editorStr(this._hass, this._config?.language ?? "auto", s);
  }

  _emitConfig() {
    const raw = deepClone(this._config || DEFAULT_CONFIG);
    const stripped =
      typeof window !== "undefined" && window.NodaliaUtils?.stripEqualToDefaults
        ? window.NodaliaUtils.stripEqualToDefaults(raw, DEFAULT_CONFIG)
        : raw;
    const payload = compactCalendarConfig(
      stripped !== undefined && stripped !== null ? stripped : {},
    );
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        bubbles: true,
        composed: true,
        detail: { config: payload },
      }),
    );
  }

  _captureFocusState() {
    return window.NodaliaUtils.captureEditorFocusState(this);
  }

  _restoreFocusState(focusState: EditorFocusState | null) {
    window.NodaliaUtils.restoreEditorFocusState(this, focusState);
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

  _setFieldValue(targetConfig: Record<string,unknown>, field: string, value: unknown) {
    if (!field) {
      return;
    }
    if (
      !field.startsWith("calendars.") &&
      typeof window !== "undefined" &&
      window.NodaliaUtils &&
      typeof window.NodaliaUtils.setByPath === "function"
    ) {
      window.NodaliaUtils.setByPath(targetConfig, field, value);
      return;
    }
    if (field.startsWith("calendars.")) {
      const calendars=Array.isArray(targetConfig.calendars)?targetConfig.calendars:[];
      targetConfig.calendars=calendars;
      const parts = field.split(".");
      const index = Number(parts[1]);
      if (!Number.isInteger(index) || index < 0 || !parts[1]?.trim()
          || index > calendars.length || parts.length > 3) {
        return;
      }
      const key = parts.length >= 3 ? parts[2] : null;
      if (parts.length >= 3 && (!key || !["entity", "label", "tint"].includes(key))) return;
      while (calendars.length <= index) {
        calendars.push({ entity: "", label: "", tint: "" });
      }
      if (key) {
        let entry = calendars[index];
        if (typeof entry === "string") {
          entry = { entity: String(entry).trim(), label: "", tint: "" };
        } else if (!isObject(entry)) {
          entry = { entity: "", label: "", tint: "" };
        }
        if (key === "entity") {
          entry.entity = String(value ?? "").trim();
        } else if (key === "label") {
          entry.label = String(value ?? "").trim();
        } else if (key === "tint") {
          entry.tint = sanitizeCalendarTint(value);
        }
        calendars[index] = entry;
        return;
      }
      calendars[index] = {
        entity: String(value ?? "").trim(),
        label: "",
        tint: "",
      };
      return;
    }
  }

  _readFieldValue(input: NativeEditorInput) {
    const valueType = input.dataset.valueType || "string";
    if (valueType === "boolean") {
      return input instanceof HTMLInputElement && input.checked;
    }
    if (valueType === "number") {
      return parseFiniteNumericValue(input.value) ?? undefined;
    }
    if (valueType === "color") {
      return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
    }
    return input.value;
  }

  _onShadowInput(event: Event) {
    const input = event
      .composedPath()
      .find(isNativeEditorInput);
    if (!input?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    if (input.type === "checkbox" && event.type === "input") {
      return;
    }
    const next = deepClone(this._config || DEFAULT_CONFIG);
    const field = input.dataset.field || "";
    const value = this._readFieldValue(input);
    this._setFieldValue(next, field, value);
    this._config = normalizeConfig(next);
    if (event.type === "change") {
      this._emitConfig();
      const focusState = this._captureFocusState();
      this._render();
      this._restoreFocusState(focusState);
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
    const field = control.dataset.field;
    const next = deepClone(this._config || DEFAULT_CONFIG);
    const value = editorControlValue(event, control);
    this._setFieldValue(next, field, value);
    this._config = normalizeConfig(next);
    this._emitConfig();
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _moveCalendar(index: number, delta: number) {
    const next = deepClone(this._config || DEFAULT_CONFIG);
    const list = Array.isArray(next.calendars) ? [...next.calendars] : [];
    const j = index + delta;
    if (!Number.isInteger(index) || index < 0 || index >= list.length || !Number.isInteger(j) || j < 0 || j >= list.length) {
      return;
    }
    const source = list[index], target = list[j];
    if (!source || !target) return;
    list[index] = target;
    list[j] = source;
    next.calendars = list;
    this._config = normalizeConfig(next);
    this._emitConfig();
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _onShadowClick(event: Event) {
    const rootTarget = event.target instanceof Element ? event.target : null;
    const toggleButton = rootTarget?.closest<HTMLElement>("[data-editor-toggle]");
    if (toggleButton) {
      event.preventDefault();
      event.stopPropagation();
      if (toggleButton.dataset.editorToggle === "styles") {
        this._showStyleSection = !this._showStyleSection;
      } else if (toggleButton.dataset.editorToggle === "animations") {
        this._showAnimationSection = !this._showAnimationSection;
      } else if (toggleButton.dataset.editorToggle === "haptics") {
        this._showHapticsSection = !this._showHapticsSection;
      }
      const focusState = this._captureFocusState();
      this._render();
      this._restoreFocusState(focusState);
      return;
    }

    const button = rootTarget?.closest<HTMLElement>("[data-editor-action]");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.editorAction;
    if (action === "move-calendar-up") {
      this._moveCalendar(Number(button.dataset.index || -1), -1);
      return;
    }
    if (action === "move-calendar-down") {
      this._moveCalendar(Number(button.dataset.index || -1), 1);
      return;
    }
    const next = deepClone(this._config || DEFAULT_CONFIG);
    const calendars = Array.isArray(next.calendars)?next.calendars:[];
    next.calendars=calendars;
    if (action === "add-calendar") {
      // The empty-list view already exposes one editable placeholder row.
      if (!calendars.length) calendars.push({ entity: "", label: "", tint: "" });
      calendars.push({ entity: "", label: "", tint: "" });
    } else if (action === "remove-calendar") {
      const index = Number(button.dataset.index || -1);
      if (!Number.isInteger(index) || index < 0 || index >= calendars.length) return;
      calendars.splice(index, 1);
    } else {
      return;
    }
    this._config = normalizeConfig(next);
    this._emitConfig();
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _mountCalendarEntityHost(host: HTMLElement) {
    if (!(host instanceof HTMLElement)) {
      return;
    }
    const field = host.dataset.field || "calendars.0";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    const allowedDomains = String(host.dataset.domains || "")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    let control: HTMLElement;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      if (allowedDomains.length) {
        Object.assign(control, { includeDomains: allowedDomains });
        Object.assign(control, { entityFilter: (stateObj: HassEntity) =>
          allowedDomains.some(domain => String(stateObj.entity_id || "").startsWith(`${domain}.`)) });
      }
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
      Object.assign(control, { allowCustomEntity: true });
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      const entitySelector =
        allowedDomains.length === 1
          ? { domain: allowedDomains[0] }
          : allowedDomains.length > 1
            ? { domain: allowedDomains }
            : {};
      Object.assign(control, { selector: { entity: entitySelector } });
    } else {
      control = document.createElement("input");
      Object.assign(control, { type: "text", placeholder: placeholder || "calendar.ejemplo" });
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

  _renderCheckboxField(label: string, field: string, checked: boolean) {
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

  _renderTintAutoToggle(checked: boolean) {
    const tTitle = this._editorLabel("ed.calendar.tint_auto_title");
    const tHint = this._editorLabel("ed.calendar.tint_auto_hint");
    const aria = escapeHtml(`${tTitle}. ${tHint}`);
    return `
      <div class="editor-tint-block">
        <div class="editor-tint-block__text">
          <div class="editor-tint-block__title">${escapeHtml(tTitle)}</div>
          <div class="editor-tint-block__hint">${escapeHtml(tHint)}</div>
        </div>
        <label class="editor-toggle">
          <input
            type="checkbox"
            data-field="tint_auto"
            data-value-type="boolean"
            aria-label="${aria}"
            ${checked ? "checked" : ""}
          />
          <span class="editor-toggle__switch" aria-hidden="true"></span>
          <span class="editor-toggle__label"></span>
        </label>
      </div>
    `;
  }

  _renderSelectField(label: string, field: string, value: unknown, options: FieldOptions = {}) {
    const tLabel = this._editorLabel(label);
    const opts = options.options || [];
    const current = String(value ?? "");
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${opts
            .map(
              o =>
                `<option value="${escapeHtml(String(o.value))}" ${String(o.value) === current ? "selected" : ""}>${escapeHtml(
                  typeof o.label === "string" && o.label ? this._editorLabel(o.label) : String(o.label ?? ""),
                )}</option>`,
            )
            .join("")}
        </select>
      </label>
    `;
  }

  _renderTextField(label: string, field: string, value: unknown, options: FieldOptions = {}) {
    const tLabel = this._editorLabel(label);
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || (inputType === "number" ? "number" : "string");
    const inputValue = value === undefined || value === null ? "" : String(value);
    const hintRaw = options.hint ? String(options.hint) : "";
    const hintHtml = hintRaw
      ? `<span class="editor-field__hint">${escapeHtml(this._editorLabel(hintRaw))}</span>`
      : "";
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
        ${hintHtml}
      </label>
    `;
  }

  _renderIconPickerField(label: string, field: string, value: unknown, options: FieldOptions = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
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

  _renderColorField(label: string, field: string, value: unknown, options: FieldOptions = {}) {
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
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>
    `;
  }

  _renderCalendarCard(entry: CalendarEntry, index: number, total: number) {
    const ent =
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? entry
        : { entity: String(entry ?? "").trim(), label: "", tint: "" };
    const entityId = String(ent.entity ?? "").trim();
    const label = String(ent.label ?? "").trim();
    const tint = String(ent.tint ?? "").trim();
    return `
      <div class="series-editor-card">
        <div class="series-editor-card__header">
          <div class="series-editor-card__title">${escapeHtml(this._editorLabel("ed.calendar.row_title"))} ${index + 1}</div>
          <div class="series-editor-card__actions">
            <button type="button" data-editor-action="move-calendar-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>${escapeHtml(this._editorLabel("Subir"))}</button>
            <button type="button" data-editor-action="move-calendar-down" data-index="${index}" ${index === total - 1 ? "disabled" : ""}>${escapeHtml(this._editorLabel("Bajar"))}</button>
            <button type="button" data-editor-action="remove-calendar" data-index="${index}" class="danger">${escapeHtml(this._editorLabel("Eliminar"))}</button>
          </div>
        </div>
        <div class="series-editor-subgroup">
          <div class="series-editor-subgroup__title">${escapeHtml(this._editorLabel("Entidad"))}</div>
          <div class="editor-grid editor-grid--stacked">
            <div class="editor-field editor-field--full">
              <span>${escapeHtml(this._editorLabel("ed.calendar.ha_calendar_entity"))}</span>
              <div
                class="editor-control-host"
                data-mounted-control="calendar-entity"
                data-field="calendars.${index}.entity"
                data-value="${escapeHtml(entityId)}"
                data-domains="calendar"
                data-placeholder="calendar.cumpleanos"
              ></div>
            </div>
            ${this._renderTextField("ed.calendar.visible_label", `calendars.${index}.label`, label, {
              fullWidth: true,
              placeholder: this._editorLabel("ed.calendar.label_placeholder"),
            })}
            ${this._renderColorField("ed.calendar.row_card_tint", `calendars.${index}.tint`, tint, {
              fullWidth: true,
              fallbackValue: "#71c0ff",
            })}
          </div>
        </div>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    this._ensureEditorControlsReady();
    const config = normalizeConfig(this._config || DEFAULT_CONFIG);
    const calendars =
      Array.isArray(config.calendars) && config.calendars.length
        ? config.calendars
        : [{ entity: "", label: "", tint: "" }];
    const hapticStyle = config.haptics?.style || DEFAULT_CONFIG.haptics.style;
    const animations = isObject(config.animations) ? config.animations : DEFAULT_CONFIG.animations;

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

        ${EDITOR_SECTION_ACTION_STYLES}

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

        .editor-tint-block {
          align-items: center;
          background: color-mix(in srgb, var(--primary-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
          border-radius: 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px 18px;
          grid-column: 1 / -1;
          justify-content: space-between;
          padding: 14px 16px;
        }

        .editor-tint-block__text {
          display: grid;
          flex: 1 1 220px;
          gap: 5px;
          min-width: 0;
        }

        .editor-tint-block__title {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .editor-tint-block__hint {
          color: var(--secondary-text-color);
          font-size: 11px;
          line-height: 1.45;
          max-width: 44em;
        }

        .editor-tint-block .editor-toggle {
          align-self: center;
          flex: 0 0 auto;
          margin: 0;
          min-height: 0;
          padding-top: 0;
        }

        .editor-tint-block .editor-toggle__label:empty {
          display: none;
        }

        .editor-field:has(> .editor-control-host[data-mounted-control="entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="calendar-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="weather-entity"]),
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

        ${EDITOR_RADIUS_STYLES}

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

        ${EDITOR_COLOR_STYLES}

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

        ${EDITOR_TOGGLE_STYLES}
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("General"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.calendar.general_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.nav.title", "title", config.title, { fullWidth: true, placeholder: "Calendar" })}
            ${this._renderIconPickerField("Icono", "icon", config.icon || DEFAULT_CONFIG.icon, {
              fullWidth: true,
              placeholder: "mdi:calendar-month",
            })}
            ${this._renderSelectField("ed.calendar.visible_range", "time_range", config.time_range || DEFAULT_CONFIG.time_range, {
              fullWidth: true,
              options: [
                { value: "3d", label: this._editorLabel("ed.calendar.period_3d") },
                { value: "1w", label: this._editorLabel("ed.calendar.period_1w") },
                { value: "2w", label: this._editorLabel("ed.calendar.period_2w") },
                { value: "1m", label: this._editorLabel("ed.calendar.period_1m") },
              ],
            })}
            ${this._renderTextField("ed.calendar.max_events_before_scroll", "max_visible_events", config.max_visible_events, { type: "number" })}
            ${this._renderTextField("ed.calendar.refresh_seconds", "refresh_interval", config.refresh_interval, { type: "number" })}
            <div class="editor-field editor-field--full">
              <span>${escapeHtml(this._editorLabel("ed.calendar.weather_entity_label"))}</span>
              <div
                class="editor-control-host"
                data-mounted-control="weather-entity"
                data-field="weather_entity"
                data-value="${escapeHtml(String(config.weather_entity ?? ""))}"
                data-domains="weather"
                data-placeholder="weather.casa"
              ></div>
              <span class="editor-field__hint">${escapeHtml(this._editorLabel("ed.calendar.weather_row_explainer"))}</span>
            </div>
            ${this._renderTintAutoToggle(config.tint_auto !== false)}
            ${this._renderCheckboxField("ed.calendar.allow_delete_native", "allow_delete", config.allow_delete !== false)}
            ${this._renderTextField("ed.calendar.native_webhook_id", "native_event_webhook", config.native_event_webhook || "", {
              fullWidth: true,
              placeholder: "nodalia_calendar_create_event",
              hint: "ed.calendar.native_webhook_hint",
            })}
            ${this._renderCheckboxField(
              "ed.calendar.allow_webhooks_non_admin",
              "security.allow_webhooks_for_non_admin",
              isObject(config.security) && config.security.allow_webhooks_for_non_admin === true,
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.calendar.calendars_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.calendar.calendars_section_hint"))}</div>
          </div>
          <div class="series-editor-list">
            ${
              calendars.length
                ? calendars.map((entityId, index) => this._renderCalendarCard(entityId, index, calendars.length)).join("")
                : `<div class="empty-note">${escapeHtml(this._editorLabel("ed.calendar.no_calendars_yet"))}</div>`
            }
          </div>
          <div class="editor-actions">
            <button type="button" class="editor-section__toggle-button" data-editor-action="add-calendar">
              <ha-icon icon="mdi:plus"></ha-icon>
              <span>${escapeHtml(this._editorLabel("ed.calendar.add_calendar"))}</span>
            </button>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Respuesta háptica"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.calendar.haptics_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="haptics"
                aria-expanded="${this._showHapticsSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showHapticsSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showHapticsSection ? this._editorLabel("ed.calendar.hide_haptic_settings") : this._editorLabel("ed.calendar.show_haptic_settings"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showHapticsSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("Activar respuesta háptica", "haptics.enabled", config.haptics?.enabled === true)}
                  ${this._renderCheckboxField("Usar vibración si no hay háptica", "haptics.fallback_vibrate", config.haptics?.fallback_vibrate === true)}
                  ${this._renderSelectField("Intensidad", "haptics.style", hapticStyle, {
                    fullWidth: true,
                    options: [
                      { value: "selection", label: "ed.calendar.haptic_selection" },
                      { value: "light", label: "ed.calendar.haptic_light" },
                      { value: "medium", label: "ed.calendar.haptic_medium" },
                      { value: "heavy", label: "ed.calendar.haptic_heavy" },
                      { value: "success", label: "ed.calendar.haptic_success" },
                      { value: "warning", label: "ed.calendar.haptic_warning" },
                      { value: "failure", label: "ed.calendar.haptic_failure" },
                    ],
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Animaciones"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.calendar.animation_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("ed.calendar.hide_animation_settings") : this._editorLabel("ed.calendar.show_animation_settings"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("Activar animaciones", "animations.enabled", animations.enabled !== false)}
                  ${this._renderTextField("ed.calendar.content_entrance_ms", "animations.content_duration", animations.content_duration, {
                    type: "number",
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Estilos"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.calendar.styles_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showStyleSection ? this._editorLabel("ed.calendar.hide_style_settings") : this._editorLabel("ed.calendar.show_style_settings"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("Fondo tarjeta", "styles.card.background", config.styles?.card?.background, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.card.background,
                  })}
                  ${this._renderTextField("Borde tarjeta", "styles.card.border", config.styles?.card?.border)}
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
                  ${this._renderTextField("Sombra tarjeta", "styles.card.box_shadow", config.styles?.card?.box_shadow, { fullWidth: true })}
                  ${this._renderTextField("Padding", "styles.card.padding", config.styles?.card?.padding)}
                  ${this._renderTextField("Separación", "styles.card.gap", config.styles?.card?.gap)}
                  ${this._renderTextField("Tamaño título", "styles.title_size", config.styles?.title_size)}
                  ${this._renderTextField("Tamaño evento", "styles.event_size", config.styles?.event_size)}
                  ${this._renderTextField("Alto chips", "styles.chip_height", config.styles?.chip_height)}
                  ${this._renderTextField("Texto chips", "styles.chip_font_size", config.styles?.chip_font_size)}
                  ${this._renderTextField("Relleno chips", "styles.chip_padding", config.styles?.chip_padding)}
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
                  ${this._renderColorField("Icono burbuja fondo", "styles.icon.background", config.styles?.icon?.background, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.icon.background,
                  })}
                  ${this._renderColorField("Color icono activo", "styles.icon.on_color", config.styles?.icon?.on_color, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.icon.on_color,
                  })}
                  ${this._renderColorField("Color icono inactivo", "styles.icon.off_color", config.styles?.icon?.off_color, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.icon.off_color,
                  })}
                  ${this._renderTextField("Icono burbuja tamaño", "styles.icon.size", config.styles?.icon?.size)}
                  ${this._renderColorField("ed.calendar.accent_if_tint_off", "styles.tint.color", config.styles?.tint?.color, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.tint.color,
                  })}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll<HTMLElement>(
        '[data-mounted-control="calendar-entity"], [data-mounted-control="weather-entity"]',
      )
      .forEach(host => {
        this._mountCalendarEntityHost(host);
      });
  }
}
  _lazyNodaliaCalendarCardEditor = NodaliaCalendarCardEditor;
  return NodaliaCalendarCardEditor;
}
