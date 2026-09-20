// @ts-nocheck
/* Visual editor extracted from the legacy media-player source. */
import {
  CARD_TAG,
  EDITOR_TAG,
  INVALID_EDITOR_VALUE,
} from "./media-player-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./media-player-config";
import { loadNodaliaMediaPlayer } from "./media-player-card";
import { clamp, deepClone, deleteByPath, escapeHtml, fireEvent, isObject, setByPath } from "./media-player-runtime";
import {
  getStubEntityId,
  getStubFriendlyName,
  compactConfig,
  formatEditorJsonValue,
  parseEditorJsonObject,
  normalizePowerActionConfig,
  getByPath,
  arrayFromCsv,
  escapeSelectorValue,
  resolveEditorColorValue,
  resolveColorInContext,
  parseRgbColor,
  getRelativeLuminance,
  formatEditorHexChannel,
  formatEditorColorFromHex,
  getEditorColorModel,
  getEditorColorFallbackValue,
  moveItem,
  getRangeValueFromClientX,
  getSliderDragGeometry,
  getRangeValueFromGeometry,
  formatDuration,
  normalizeTextKey,
  getRenderSignatureRuntime,
  sanitizeMediaArtworkUrl,
  appendQueryParam,
  isUnavailableState,
} from "./media-player-helpers";

let _lazyNodaliaMediaPlayerEditor;
export function loadNodaliaMediaPlayerEditor() {
  if (_lazyNodaliaMediaPlayerEditor) {
    return _lazyNodaliaMediaPlayerEditor;
  }
class NodaliaMediaPlayerEditor extends HTMLElement {
  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(loadNodaliaMediaPlayer().getStubConfig());
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

  _captureFocusState() {
    return window.NodaliaUtils.captureEditorFocusState(this);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id => id.startsWith("media_player."));
  }

  _getEntityOptions(field = "players.0.entity", domains = []) {
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

  _restoreFocusState(focusState) {
    window.NodaliaUtils.restoreEditorFocusState(this, focusState);
  }

  _emitConfig() {
    const focusState = this._captureFocusState();
    const nextConfig = deepClone(this._config);

    if (!Array.isArray(nextConfig.players)) {
      nextConfig.players = [];
    }

    delete nextConfig.entity;
    this._config = normalizeConfig(compactConfig(nextConfig));
    this._render();
    this._restoreFocusState(focusState);
    fireEvent(this, "config-changed", {
      config: compactConfig(window.NodaliaUtils.stripEqualToDefaults(nextConfig, DEFAULT_CONFIG) ?? {}),
    });
  }

  _setFieldValue(path, value) {
    const normalizedPath = String(path || "").trim();
    const isEntityField = normalizedPath === "entity" || normalizedPath.endsWith(".entity");

    if (isEntityField && (value === undefined || value === null || value === "")) {
      setByPath(this._config, normalizedPath, "");
      return;
    }

    if (value === undefined || value === null || value === "") {
      deleteByPath(this._config, normalizedPath);
      return;
    }

    setByPath(this._config, normalizedPath, value);
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
      case "csv": {
        const values = arrayFromCsv(input.value);
        return values.length ? values : undefined;
      }
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      case "json": {
        const parsed = parseEditorJsonObject(input.value);
        if (!parsed.valid) {
          input.setCustomValidity(this._editorLabel("ed.media_player.invalid_json_object"));
          input.setAttribute("aria-invalid", "true");
          return INVALID_EDITOR_VALUE;
        }

        input.setCustomValidity("");
        input.removeAttribute("aria-invalid");
        return parsed.value;
      }
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
    if (nextValue === INVALID_EDITOR_VALUE) {
      return;
    }
    this._setFieldValue(input.dataset.field, nextValue);

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
    this._emitConfig();
  }

  _onShadowClick(event) {
    const toggleButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorToggle);

    if (toggleButton) {
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

    if (action === "add-player") {
      this._config.players = Array.isArray(this._config.players) ? this._config.players : [];
      this._config.players.push({
        entity: "",
        label: "",
        tap_action: {
          action: "more-info",
        },
        power_action_off: {
          action: "default",
        },
        power_action_on: {
          action: "default",
        },
        power_action_unavailable: {
          action: "default",
        },
      });
      this._emitConfig();
      return;
    }

    if (!Number.isInteger(index) || index < 0 || index >= this._config.players.length) {
      return;
    }

    if (action === "remove-player") {
      this._config.players.splice(index, 1);
      this._emitConfig();
      return;
    }

    if (action === "move-player-up") {
      moveItem(this._config.players, index, index - 1);
      this._emitConfig();
      return;
    }

    if (action === "move-player-down") {
      moveItem(this._config.players, index, index + 1);
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
    const inputValue = valueType === "json"
      ? formatEditorJsonValue(value)
      : (value === undefined || value === null ? "" : String(value));

    if (tag === "textarea") {
      return `
        <label class="editor-field editor-field--full">
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

  _renderTextareaField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    return this._renderTextField(label, field, value, {
      ...options,
      multiline: true,
      fullWidth: options.fullWidth !== false,
    });
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

  _renderActionConfigFields(titleKey, path, action = {}) {
    return `
      <div class="player-editor-subgroup">
        <div class="player-editor-subgroup__title">${escapeHtml(this._editorLabel(titleKey))}</div>
        <div class="editor-grid">
          ${this._renderSelectField(
            "ed.media_player.action_block",
            `${path}.action`,
            action?.action || "default",
            [
              { value: "default", label: "ed.media_player.action_default" },
              { value: "none", label: "ed.entity.tap_none" },
              { value: "more-info", label: "ed.entity.tap_more_info" },
              { value: "navigate", label: "ed.media_player.action_navigate" },
              { value: "url", label: "ed.entity.tap_open_url" },
              { value: "call-service", label: "ed.entity.tap_service" },
            ],
          )}
          ${this._renderEntityField("ed.media_player.more_info_entity", `${path}.entity`, action?.entity, {
            placeholder: "media_player.salon",
          })}
          ${this._renderTextField("ed.media_player.navigation_path", `${path}.navigation_path`, action?.navigation_path, {
            placeholder: "/lovelace/salon",
          })}
          ${this._renderTextField("ed.entity.tap_url_field", `${path}.url`, action?.url || action?.url_path, {
            placeholder: "https://example.com",
          })}
          ${this._renderCheckboxField("ed.entity.tap_new_tab", `${path}.new_tab`, action?.new_tab === true)}
          ${this._renderTextField("ed.entity.tap_service_field", `${path}.service`, action?.service, {
            placeholder: "input_boolean.turn_off",
          })}
          ${this._renderTextareaField("ed.entity.tap_service_data_json", `${path}.service_data`, action?.service_data ?? action?.data, {
            placeholder: '{"entity_id":"input_boolean.media_power"}',
            rows: 4,
            valueType: "json",
          })}
        </div>
      </div>
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

  _renderPlayerCard(player, index) {
    const phShort = this._editorLabel("ed.media_player.name_placeholder");
    return `
      <div class="player-editor-card">
        <div class="player-editor-card__header">
          <div class="player-editor-card__title">${escapeHtml(this._editorLabel("ed.media_player.player_prefix"))} ${index + 1}</div>
          <div class="player-editor-card__actions">
            <button type="button" data-action="move-player-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>${escapeHtml(this._editorLabel("ed.notifications.move_up"))}</button>
            <button type="button" data-action="move-player-down" data-index="${index}" ${index === this._config.players.length - 1 ? "disabled" : ""}>${escapeHtml(this._editorLabel("ed.notifications.move_down"))}</button>
            <button type="button" data-action="remove-player" data-index="${index}" class="danger">${escapeHtml(this._editorLabel("ed.notifications.remove"))}</button>
          </div>
        </div>
        <div class="player-editor-subgroup">
          <div class="player-editor-subgroup__title">${escapeHtml(this._editorLabel("ed.media_player.primary_subgroup"))}</div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityField("ed.entity.quick_entity", `players.${index}.entity`, player.entity, {
              domains: ["media_player"],
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.entity.icon", `players.${index}.icon`, player.icon, {
              placeholder: "mdi:speaker",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.media_player.short_label", `players.${index}.label`, player.label, {
              placeholder: phShort,
              fullWidth: true,
            })}
            ${this._renderTextField("ed.media_player.title_fixed", `players.${index}.title`, player.title, {
              fullWidth: true,
            })}
            ${this._renderTextField("ed.media_player.subtitle_fixed", `players.${index}.subtitle`, player.subtitle, {
              fullWidth: true,
            })}
          </div>
        </div>
        <div class="player-editor-subgroup">
          <div class="player-editor-subgroup__title">${escapeHtml(this._editorLabel("ed.media_player.behavior_subgroup"))}</div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.media_player.tv_mode", `players.${index}.tv_mode`, player.tv_mode === true)}
            ${this._renderCheckboxField("ed.media_player.show_sources", `players.${index}.show_source_controls`, player.show_source_controls !== false)}
            ${this._renderSelectField(
              "ed.media_player.visibility_subgroup",
              `players.${index}.show`,
              player.show,
              [
                { value: undefined, label: "ed.media_player.tristate_auto" },
                { value: true, label: "ed.media_player.tristate_always" },
                { value: false, label: "ed.media_player.tristate_never" },
              ],
              "tristate",
            )}
            ${this._renderTextField("ed.media_player.max_sources", `players.${index}.max_sources`, player.max_sources, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("ed.media_player.browse_path", `players.${index}.browse_path`, player.browse_path, {
              placeholder: "/media-browser/browser",
            })}
            ${this._renderTextField("ed.media_player.custom_image", `players.${index}.image`, player.image, {
              placeholder: "/local/cover.png",
            })}
            ${this._renderTextField("ed.media_player.show_states", `players.${index}.show_states`, Array.isArray(player.show_states) ? player.show_states.join(", ") : "", {
              placeholder: "playing, paused",
              valueType: "csv",
              fullWidth: true,
            })}
          </div>
        </div>
        <div class="editor-tap-actions-subsection editor-field--full">
          ${window.NodaliaUtils.renderEditorCollapsibleSectionHeaderHtml({
            titleKey: "ed.media_player.tap_on_card",
            hintKey: "ed.light.tap_actions_section_hint",
            toggleId: "tap_actions",
            expanded: this._showTapActionsSection === true,
            escapeHtml,
            editorLabel: (key) => this._editorLabel(key),
          })}
          ${this._showTapActionsSection ? `${this._renderActionConfigFields("ed.media_player.tap_on_card", `players.${index}.tap_action`, player.tap_action)}` : ""}</div>
        ${this._renderActionConfigFields("ed.media_player.power_action_off", `players.${index}.power_action_off`, player.power_action_off)}
        ${this._renderActionConfigFields("ed.media_player.power_action_active", `players.${index}.power_action_on`, player.power_action_on)}
        ${this._renderActionConfigFields("ed.media_player.power_action_unavailable", `players.${index}.power_action_unavailable`, player.power_action_unavailable)}
      </div>
    `;
  }

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "players.0.entity";
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
      control.allowCustomEntity = true;
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
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
      const entityLabel = this._editorLabel("ed.entity.quick_entity");
      emptyOption.textContent = String(entityLabel || "Select entity");
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

    const field = host.dataset.field || "players.0.icon";
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

        .editor-field textarea[aria-invalid="true"] {
          border-color: var(--error-color, #db4437);
          box-shadow: 0 0 0 1px var(--error-color, #db4437);
        }

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

        .editor-field textarea {
          min-height: 72px;
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

        .player-editor-list {
          display: grid;
          gap: 12px;
        }

        .player-editor-card {
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 16px;
          display: grid;
          gap: 12px;
          padding: 14px;
        }

        .player-editor-subgroup {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }

        .player-editor-subgroup__title {
          font-size: 12px;
          font-weight: 700;
        }

        .player-editor-card__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .player-editor-card__title {
          font-size: 13px;
          font-weight: 700;
        }

        .player-editor-card__actions {
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

          .editor-toggle {
            padding-top: 0;
          }

          .player-editor-card__header {
            align-items: start;
            flex-direction: column;
          }

          .player-editor-card__actions {
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.media_player.general_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.media_player.show_card",
              "show",
              config.show,
              [
                { value: undefined, label: "ed.media_player.tristate_auto" },
                { value: true, label: "ed.media_player.tristate_always" },
                { value: false, label: "ed.media_player.tristate_never" },
              ],
              "tristate",
            )}
            ${this._renderCheckboxField("ed.media_player.show_state_text", "show_state", config.show_state === true)}
            ${this._renderCheckboxField("ed.media_player.album_cover_background", "album_cover_background", config.album_cover_background !== false)}
            ${this._renderCheckboxField("ed.media_player.show_unavailable_badge", "show_unavailable_badge", config.show_unavailable_badge !== false)}
            ${this._renderCheckboxField("ed.media_player.show_desktop", "layout.show_desktop", config.layout.show_desktop === true)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.media_player.layout_section"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.media_player.layout_dashboard_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.media_player.presentation_mode",
              "layout.mode",
              config.layout.mode || "auto",
              [
                { value: "auto", label: "ed.media_player.layout_auto" },
                { value: "standard", label: "ed.media_player.layout_standard" },
                { value: "square", label: "ed.media_player.layout_square" },
                { value: "chip", label: "ed.media_player.layout_chip" },
                { value: "compact", label: "ed.media_player.layout_compact" },
                { value: "artwork", label: "ed.media_player.layout_artwork" },
              ],
            )}
            ${this._renderCheckboxField("ed.media_player.fixed_card", "layout.fixed", config.layout.fixed === true)}
            ${this._renderCheckboxField("ed.media_player.reserve_space", "layout.reserve_space", config.layout.reserve_space === true)}
            ${this._renderSelectField(
              "ed.media_player.layout_position",
              "layout.position",
              config.layout.position,
              [
                { value: "bottom", label: "ed.media_player.position_bottom" },
                { value: "top", label: "ed.media_player.position_top" },
              ],
            )}
            ${this._renderTextField("ed.media_player.reserve_height", "layout.reserve_height", config.layout.reserve_height)}
            ${this._renderTextField("ed.media_player.layout_offset", "layout.offset", config.layout.offset)}
            ${this._renderTextField("ed.media_player.side_margin", "layout.side_margin", config.layout.side_margin)}
            ${this._renderTextField("ed.media_player.layout_max_width", "layout.max_width", config.layout.max_width)}
            ${this._renderTextField("ed.media_player.mobile_breakpoint", "layout.mobile_breakpoint", config.layout.mobile_breakpoint, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("ed.media_player.layout_z_index", "layout.z_index", config.layout.z_index, {
              type: "number",
              valueType: "number",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.media_player.artwork_section"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.media_player.artwork_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.media_player.artwork_mode",
              "artwork.mode",
              config.artwork?.mode || "immersive",
              [
                { value: "immersive", label: "ed.media_player.artwork_immersive" },
                { value: "blur", label: "ed.media_player.artwork_blurred" },
                { value: "off", label: "ed.media_player.artwork_off" },
              ],
            )}
            ${this._renderTextField("ed.media_player.artwork_blur", "artwork.blur", config.artwork?.blur, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.media_player.artwork_dim", "artwork.dim", config.artwork?.dim, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.media_player.artwork_saturation", "artwork.saturation", config.artwork?.saturation, { type: "number", valueType: "number" })}
            ${this._renderCheckboxField("ed.media_player.artwork_dynamic_colors", "artwork.dynamic_colors", config.artwork?.dynamic_colors !== false)}
            ${this._renderCheckboxField("ed.media_player.artwork_crossfade", "artwork.crossfade", config.artwork?.crossfade !== false)}
            ${this._renderCheckboxField("ed.media_player.progress_show", "progress.show", config.progress?.show !== false)}
            ${this._renderCheckboxField("ed.media_player.progress_draggable", "progress.draggable", config.progress?.draggable !== false)}
            ${this._renderCheckboxField("ed.media_player.idle_artwork_enabled", "idle_artwork.enabled", config.idle_artwork?.enabled !== false)}
            ${this._renderCheckboxField("ed.media_player.idle_artwork_slideshow", "idle_artwork.slideshow", config.idle_artwork?.slideshow !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.media_player.players_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.media_player.players_section_hint"))}</div>
          </div>
          <div class="player-editor-list">
            ${
              Array.isArray(config.players) && config.players.length
                ? config.players.map((player, index) => this._renderPlayerCard(player, index)).join("")
                : `<div class="empty-note">${escapeHtml(this._editorLabel("ed.media_player.players_empty"))}</div>`
            }
          </div>
          <div class="editor-actions">
            <button type="button" data-action="add-player">${escapeHtml(this._editorLabel("ed.media_player.add_player"))}</button>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.person.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.media_player.haptics_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.person.enable_haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("ed.person.fallback_vibrate", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
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
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.media_player.animations_section_hint"))}</div>
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
                  ${this._renderTextField("ed.media_player.panel_tv_ms", "animations.panel_duration", config.animations.panel_duration, {
                    type: "number",
                  })}
                  ${this._renderTextField("ed.media_player.browser_duration_ms", "animations.browser_duration", config.animations.browser_duration, {
                    type: "number",
                  })}
                  ${this._renderTextField("ed.media_player.button_bounce_ms", "animations.button_bounce_duration", config.animations.button_bounce_duration, {
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
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.media_player.styles_section_hint"))}</div>
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
                  ${this._renderColorField("ed.media_player.style_player_background", "styles.player.background", config.styles.player.background)}
                  ${this._renderTextField("ed.media_player.style_player_border", "styles.player.border", config.styles.player.border)}
                  ${this._renderTextField("ed.media_player.style_player_radius", "styles.player.border_radius", config.styles.player.border_radius)}
                  ${this._renderTextField("ed.media_player.style_player_shadow", "styles.player.box_shadow", config.styles.player.box_shadow)}
                  ${this._renderTextField("ed.media_player.style_player_padding", "styles.player.padding", config.styles.player.padding)}
                  ${this._renderTextField("ed.media_player.style_player_min_height", "styles.player.min_height", config.styles.player.min_height)}
                  ${this._renderTextField("ed.media_player.style_artwork_size", "styles.player.artwork_size", config.styles.player.artwork_size)}
                  ${this._renderTextField("ed.media_player.style_tv_artwork_size", "styles.player.tv_artwork_size", config.styles.player.tv_artwork_size)}
                  ${this._renderTextField("ed.media_player.style_control_size", "styles.player.control_size", config.styles.player.control_size)}
                  ${this._renderTextField("ed.media_player.style_title_size", "styles.player.title_size", config.styles.player.title_size)}
                  ${this._renderTextField("ed.media_player.style_subtitle_size", "styles.player.subtitle_size", config.styles.player.subtitle_size)}
                  ${this._renderTextField("ed.media_player.style_slider_wrap_height", "styles.player.slider_wrap_height", config.styles.player.slider_wrap_height)}
                  ${this._renderTextField("ed.media_player.style_slider_height", "styles.player.slider_height", config.styles.player.slider_height)}
                  ${this._renderTextField("ed.media_player.style_slider_thumb", "styles.player.slider_thumb_size", config.styles.player.slider_thumb_size)}
                  ${this._renderColorField("ed.media_player.style_progress_color", "styles.player.progress_color", config.styles.player.progress_color)}
                  ${this._renderColorField("ed.media_player.style_progress_background", "styles.player.progress_background", config.styles.player.progress_background)}
                  ${this._renderColorField("ed.media_player.style_overlay_color", "styles.player.overlay_color", config.styles.player.overlay_color)}
                  ${this._renderColorField("ed.media_player.style_active_tint", "styles.player.active_tint_color", config.styles.player.active_tint_color)}
                  ${this._renderTextField("ed.media_player.style_dot_size", "styles.player.dot_size", config.styles.player.dot_size)}
                  ${this._renderColorField("ed.media_player.style_accent_color", "styles.player.accent_color", config.styles.player.accent_color)}
                  ${this._renderColorField("ed.media_player.style_accent_background", "styles.player.accent_background", config.styles.player.accent_background)}
                  ${this._renderColorField("ed.media_player.style_browser_background", "styles.browser.background", config.styles.browser.background)}
                  ${this._renderTextField("ed.media_player.style_browser_border", "styles.browser.border", config.styles.browser.border)}
                  ${this._renderTextField("ed.media_player.style_browser_radius", "styles.browser.border_radius", config.styles.browser.border_radius)}
                  ${this._renderTextField("ed.media_player.style_browser_shadow", "styles.browser.box_shadow", config.styles.browser.box_shadow)}
                  ${this._renderColorField("ed.media_player.style_browser_backdrop", "styles.browser.backdrop", config.styles.browser.backdrop)}
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
  _lazyNodaliaMediaPlayerEditor = NodaliaMediaPlayerEditor;
  return NodaliaMediaPlayerEditor;
}
