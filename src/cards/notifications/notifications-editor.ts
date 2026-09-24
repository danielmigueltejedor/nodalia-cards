// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  BACKGROUND_MOBILE_MAX_CHUNKS,
  backgroundMobilePayloadOverLimit,
  normalizeMobilePolicy,
  normalizeSmartEntityMobile,
} from "./notifications-runtime";
import { DEFAULT_CONFIG, normalizeConfig } from "./notifications-config";
import {
  buildBackgroundMobileWebhookPayload,
  compactConfig,
  deleteByPath,
  escapeHtml,
  fireEvent,
  formatEditorColorFromHex,
  friendlyName,
  getByPath,
  getEditorColorFallbackValue,
  getEditorColorModel,
  getBackgroundMobileConfigPayload,
  getBackgroundMobileNativeSignature,
  normalizeEntityList,
  normalizeNotificationTapAction,
  normalizeStringList,
  setByPath,
  syncBackgroundMobileNative,
} from "./notifications-helpers";

let _lazyNodaliaNotificationsCardEditor;
export function loadNodaliaNotificationsCardEditor() {
  if (_lazyNodaliaNotificationsCardEditor) {
    return _lazyNodaliaNotificationsCardEditor;
  }
class NodaliaNotificationsCardEditor extends HTMLElement {
  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig({});
    this._hass = null;
    this._showStyleSection = false;
    this._showConnectionsSection = false;
    this._showSmartSection = false;
    this._showCustomSection = true;
    this._showContextSection = false;
    this._showExternalAlertsSection = false;
    this._showAnimationSection = false;
    this._pendingEditorControlTags = new Set();
    this._backgroundMobileSyncTimer = 0;
    this._lastBackgroundMobileSyncSignature = "";
    this._lastBackgroundMobileNativeSignature = "";
    this._engineStatus = null;
    this._engineStatusSignature = "";
    this._engineStatusInFlight = false;
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
    void this._refreshEngineStatus();
  }

  disconnectedCallback() {
    this._detachEditorShadowListeners();
    window.NodaliaUtils?.releaseEditorDialogLayoutFix?.(this);
    if (this._backgroundMobileSyncTimer) {
      window.clearTimeout(this._backgroundMobileSyncTimer);
      this._backgroundMobileSyncTimer = 0;
    }
  }

  set hass(hass) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender = !this._hass || nextSignature !== this._entityOptionsSignature || !this.shadowRoot?.innerHTML;
    this._hass = hass;
    this._entityOptionsSignature = nextSignature;
    if (shouldRender) {
      const focus = this._captureFocusState();
      this._render();
      this._restoreFocusState(focus);
    }
    void this._refreshEngineStatus();
  }

  setConfig(config) {
    const focus = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._render();
    this._restoreFocusState(focus);
    void this._refreshEngineStatus();
  }

  /** Engine status drives which delivery fields the editor exposes; the bridge caches it for 30s. */
  async _refreshEngineStatus() {
    const backend = typeof window !== "undefined" ? window.NodaliaBackend : null;
    if (!backend || typeof backend.getEditorEngineStatus !== "function" || !this._hass || this._engineStatusInFlight) {
      return;
    }
    this._engineStatusInFlight = true;
    try {
      const engine = await backend.getEditorEngineStatus(this._hass);
      const signature = window.NodaliaUtils?.engineStatusSignature?.(engine) ?? "";
      if (signature === this._engineStatusSignature) {
        return;
      }
      this._engineStatus = engine;
      this._engineStatusSignature = signature;
      if (this.isConnected && this.shadowRoot) {
        const focus = this._captureFocusState();
        this._render();
        this._restoreFocusState(focus);
      }
    } catch (_error) {
      // A missing or unreachable Engine simply keeps the legacy webhook fields visible.
    } finally {
      this._engineStatusInFlight = false;
    }
  }

  _engineBackgroundActive() {
    return this._engineStatus?.available === true && this._engineStatus?.caps?.notificationsBackground === true;
  }

  _renderEngineBannerHtml() {
    return window.NodaliaUtils?.renderEditorEngineBannerHtml?.({
      engine: this._engineStatus,
      label: key => this._editorLabel(key),
      extraRows: this._engineStatus?.caps?.notificationsInbox === true
        ? [this._editorLabel("ed.engine.inbox_synced")]
        : [],
    }) || "";
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils?.editorFilteredStatesSignature
      ? window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id => (
          id.startsWith("calendar.")
          || id.startsWith("vacuum.")
          || id.startsWith("fan.")
          || id.startsWith("weather.")
          || id.startsWith("binary_sensor.")
          || id.startsWith("sensor.")
          || id.startsWith("input_text.")
          || id.startsWith("notify.")
        ))
      : Object.keys(hass?.states || {}).join("|");
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
        if (this.isConnected && this._hass && this.shadowRoot) {
          const focus = this._captureFocusState();
          this._render();
          this._restoreFocusState(focus);
        }
      })
      .catch(() => this._pendingEditorControlTags.delete(tagName));
  }

  _ensureEditorControlsReady() {
    this._watchEditorControlTag("ha-entity-picker");
    this._watchEditorControlTag("ha-selector");
    this._watchEditorControlTag("ha-icon-picker");
  }

  _captureFocusState() {
    return window.NodaliaUtils.captureEditorFocusState(this);
  }

  _restoreFocusState(focusState) {
    window.NodaliaUtils.restoreEditorFocusState(this, focusState);
  }

  _emitConfig() {
    const focus = this._captureFocusState();
    const next = normalizeConfig(this._config, { keepDrafts: true });
    const emitted = normalizeConfig(next);
    this._config = next;
    this._render();
    this._restoreFocusState(focus);
    const stripped = window.NodaliaUtils?.stripEqualToDefaults
      ? window.NodaliaUtils.stripEqualToDefaults(emitted, DEFAULT_CONFIG)
      : emitted;
    fireEvent(this, "config-changed", { config: compactConfig(stripped) || {} });
    this._scheduleBackgroundMobileSyncFromEditor(emitted);
  }

  _scheduleBackgroundMobileSyncFromEditor(config = this._config, delay = 700) {
    const normalized = normalizeConfig(config || {});
    if (!this._hass || !this.isConnected) {
      return;
    }
    if (this._backgroundMobileSyncTimer) {
      window.clearTimeout(this._backgroundMobileSyncTimer);
    }
    this._backgroundMobileSyncTimer = window.setTimeout(() => {
      this._backgroundMobileSyncTimer = 0;
      void this._syncBackgroundMobileConfigFromEditor(normalized);
    }, Math.max(0, Math.min(3000, Number(delay) || 0)));
  }

  async _syncBackgroundMobileConfigFromEditor(config = this._config) {
    const normalized = normalizeConfig(config || {});
    const background = normalized.background_mobile || {};
    const webhookId = String(background.webhook || "").trim();
    if (!this.isConnected) {
      return false;
    }
    const expectedNative = getBackgroundMobileNativeSignature(normalized, this._hass);
    const previousNative = String(this._lastBackgroundMobileNativeSignature || "");
    if (previousNative === expectedNative.signature || previousNative === `active:${expectedNative.profileId}`) {
      return webhookId
        ? this._syncLegacyBackgroundMobileFallbackFromEditor(normalized, webhookId, false)
        : true;
    }
    const native = await syncBackgroundMobileNative(this._hass, normalized);
    if (native.synced) {
      this._lastBackgroundMobileNativeSignature = native.signature;
      if (webhookId) {
        await this._syncLegacyBackgroundMobileFallbackFromEditor(normalized, webhookId, false);
      }
      return true;
    }
    if (native.transient === true || native.available === true) {
      return false;
    }
    this._lastBackgroundMobileNativeSignature = "";
    if (background.enabled !== true) {
      return false;
    }
    if (!webhookId) {
      return false;
    }
    if (
      normalized.security?.allow_webhooks_for_non_admin === false &&
      !this._hass?.user?.is_admin
    ) {
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn("Nodalia Notifications Card editor: background mobile sync webhook blocked for non-admin user (security.allow_webhooks_for_non_admin=false).");
      }
      return false;
    }
    const payload = buildBackgroundMobileWebhookPayload(normalized, this._hass, { enabled: true });
    if (backgroundMobilePayloadOverLimit(payload)) {
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn(
          `Nodalia Notifications Card editor: background mobile config exceeds ${BACKGROUND_MOBILE_MAX_CHUNKS} chunks (${payload.chunk_count}); sync skipped.`,
        );
      }
      this._lastBackgroundMobileSyncSignature = "";
      return false;
    }
    const signature = `${webhookId}:${payload.config_hash}:${payload.chunk_count}`;
    if (signature === this._lastBackgroundMobileSyncSignature) {
      return true;
    }
    const post = typeof window !== "undefined" && window.NodaliaUtils?.postHomeAssistantWebhook;
    if (typeof post !== "function") {
      return false;
    }
    try {
      const ok = Boolean(await post(webhookId, payload, this._hass));
      if (ok) {
        this._lastBackgroundMobileSyncSignature = signature;
      }
      return ok;
    } catch (_error) {
      return false;
    }
  }

  async _syncLegacyBackgroundMobileFallbackFromEditor(config, webhookId, enabled) {
    if (
      config.security?.allow_webhooks_for_non_admin === false
      && !this._hass?.user?.is_admin
    ) {
      return false;
    }
    const payload = buildBackgroundMobileWebhookPayload(config, this._hass, { enabled });
    if (backgroundMobilePayloadOverLimit(payload)) {
      return false;
    }
    const signature = `${webhookId}:${payload.config_hash}:${payload.chunk_count}`;
    if (signature === this._lastBackgroundMobileSyncSignature) {
      return true;
    }
    const post = typeof window !== "undefined" && window.NodaliaUtils?.postHomeAssistantWebhook;
    if (typeof post !== "function") {
      return false;
    }
    try {
      const ok = Boolean(await post(webhookId, payload, this._hass));
      if (ok) {
        this._lastBackgroundMobileSyncSignature = signature;
      }
      return ok;
    } catch (_error) {
      return false;
    }
  }

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    return window.NodaliaI18n.editorStr(this._hass, this._config?.language ?? "auto", s);
  }

  _readFieldValue(input) {
    const type = input.dataset.valueType || "string";
    if (type === "boolean") {
      return Boolean(input.checked);
    }
    if (type === "number") {
      return input.value === "" ? "" : Number(input.value);
    }
    if (type === "color") {
      return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
    }
    if (type === "entity-list") {
      return normalizeEntityList(input.value);
    }
    if (type === "csv") {
      return normalizeStringList(input.value);
    }
    return input.value;
  }

  _entityDomainsForListField(field) {
    switch (String(field || "")) {
      case "calendar_entities":
        return ["calendar"];
      case "vacuum_entities":
        return ["vacuum"];
      case "vacuum_error_entities":
        return ["sensor"];
      case "fan_entities":
        return ["fan"];
      case "climate_entities":
        return ["climate"];
      case "humidifier_entities":
        return ["humidifier"];
      case "media_player_entities":
        return ["media_player"];
      case "weather_entities":
        return ["weather"];
      case "motion_entities":
      case "door_entities":
      case "window_entities":
        return ["binary_sensor"];
      case "temperature_entities":
      case "humidity_entities":
      case "outdoor_temperature_entities":
      case "outdoor_humidity_entities":
      case "battery_entities":
      case "humidifier_fill_entities":
      case "humidifier_full_entities":
      case "ink_entities":
        return ["sensor"];
      case "mobile_notifications.entities":
        return ["notify"];
      default:
        return [];
    }
  }

  _setFieldValue(path, value) {
    const smartEntityMatch = String(path || "").match(/^smart_entity_overrides\.(\d+)\./);
    if (smartEntityMatch) {
      const index = Number(smartEntityMatch[1]);
      const entity = this._smartEntityEditorEntities?.[index] || "";
      const relativePath = String(path || "").split(".").slice(2).join(".");
      if (!entity || !relativePath) {
        return;
      }
      if (!Array.isArray(this._config.smart_entity_overrides)) {
        this._config.smart_entity_overrides = [];
      }
      let overrideIndex = this._config.smart_entity_overrides.findIndex(item => item?.entity === entity);
      if (overrideIndex < 0) {
        overrideIndex = this._config.smart_entity_overrides.length;
        this._config.smart_entity_overrides.push({ entity });
      }
      if (value === "" || value === undefined || value === null) {
        deleteByPath(this._config.smart_entity_overrides[overrideIndex], relativePath);
      } else {
        setByPath(this._config.smart_entity_overrides[overrideIndex], relativePath, value);
      }
      return;
    }
    if (value === "" || value === undefined || value === null || (Array.isArray(value) && !value.length)) {
      deleteByPath(this._config, path);
      return;
    }
    setByPath(this._config, path, value);
  }

  _setEntityListItem(field, index, value) {
    const key = String(field || "");
    if (!key) {
      return;
    }
    const current = normalizeEntityList(getByPath(this._config, key));
    const nextValue = String(value || "").trim();
    const safeIndex = Math.max(0, Number(index) || 0);
    if (nextValue) {
      current[safeIndex] = nextValue;
    } else {
      current.splice(safeIndex, 1);
    }
    const filtered = normalizeEntityList(current, this._entityDomainsForListField(key));
    this._setFieldValue(key, filtered);
  }

  _addEntityListItem(field) {
    const key = String(field || "");
    if (!key) {
      return;
    }
    const current = normalizeEntityList(getByPath(this._config, key), this._entityDomainsForListField(key));
    current.push("");
    setByPath(this._config, key, current);
    this._emitConfig();
  }

  _removeEntityListItem(field, index) {
    const key = String(field || "");
    if (!key) {
      return;
    }
    const current = normalizeEntityList(getByPath(this._config, key), this._entityDomainsForListField(key));
    const safeIndex = Number(index);
    if (Number.isInteger(safeIndex) && safeIndex >= 0) {
      current.splice(safeIndex, 1);
    }
    this._setFieldValue(key, current);
    this._emitConfig();
  }

  _onShadowInput(event) {
    const input = event.composedPath().find(node => (
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLSelectElement
    ));
    if (input?.dataset?.listField) {
      event.stopPropagation();
      this._setEntityListItem(input.dataset.listField, Number(input.dataset.index), input.value);
      if (event.type === "change") {
        this._emitConfig();
      }
      return;
    }
    if (!input?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    this._setFieldValue(input.dataset.field, this._readFieldValue(input));
    if (event.type === "change") {
      this._emitConfig();
    }
  }

  _onShadowValueChanged(event) {
    const control = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.field);
    if (!control?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    const nextValue = typeof event.detail?.value === "string" ? event.detail.value : control.value;
    if (typeof control.dataset.value === "string") {
      control.dataset.value = String(nextValue || "");
    }
    if (control.dataset.listField) {
      this._setEntityListItem(control.dataset.listField, Number(control.dataset.index), nextValue);
      this._emitConfig();
      return;
    }
    this._setFieldValue(control.dataset.field, nextValue);
    this._emitConfig();
  }

  _onShadowClick(event) {
    const toggle = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.editorToggle);
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      if (toggle.dataset.editorToggle === "styles") {
        this._showStyleSection = !this._showStyleSection;
      } else if (toggle.dataset.editorToggle === "connections") {
        this._showConnectionsSection = !this._showConnectionsSection;
      } else if (toggle.dataset.editorToggle === "smart") {
        this._showSmartSection = !this._showSmartSection;
      } else if (toggle.dataset.editorToggle === "custom") {
        this._showCustomSection = !this._showCustomSection;
      } else if (toggle.dataset.editorToggle === "context") {
        this._showContextSection = !this._showContextSection;
      } else if (toggle.dataset.editorToggle === "external") {
        this._showExternalAlertsSection = !this._showExternalAlertsSection;
      } else if (toggle.dataset.editorToggle === "animations") {
        this._showAnimationSection = !this._showAnimationSection;
      }
      this._render();
      return;
    }
    const button = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.editorAction);
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const index = Number(button.dataset.index);
    if (!Array.isArray(this._config.custom_notifications)) {
      this._config.custom_notifications = [];
    }
    switch (button.dataset.editorAction) {
      case "add-entity-list-item":
        this._addEntityListItem(button.dataset.field || "");
        break;
      case "remove-entity-list-item":
        this._removeEntityListItem(button.dataset.field || "", index);
        break;
      case "add-custom":
        this._config.custom_notifications.push({
          _draft: true,
          title: "",
          message: "",
          icon: "mdi:bell-outline",
          severity: "info",
          condition: "always",
          action_type: "none",
        });
        this._emitConfig();
        break;
      case "remove-custom":
        if (Number.isInteger(index)) {
          this._config.custom_notifications.splice(index, 1);
          this._emitConfig();
        }
        break;
      case "move-custom-up":
        if (Number.isInteger(index) && index > 0) {
          const [item] = this._config.custom_notifications.splice(index, 1);
          this._config.custom_notifications.splice(index - 1, 0, item);
          this._emitConfig();
        }
        break;
      case "move-custom-down":
        if (Number.isInteger(index) && index < this._config.custom_notifications.length - 1) {
          const [item] = this._config.custom_notifications.splice(index, 1);
          this._config.custom_notifications.splice(index + 1, 0, item);
          this._emitConfig();
        }
        break;
      case "add-external-alert":
        if (!Array.isArray(this._config.external_alerts)) {
          this._config.external_alerts = [];
        }
        this._config.external_alerts.push({
          _draft: true,
          id: "",
          type: "camera_event",
          title: "",
          message: "",
          severity: "warning",
          mobile: "auto",
        });
        this._showExternalAlertsSection = true;
        this._emitConfig();
        break;
      case "remove-external-alert":
        if (Number.isInteger(index) && Array.isArray(this._config.external_alerts)) {
          this._config.external_alerts.splice(index, 1);
          this._emitConfig();
        }
        break;
      default:
        break;
    }
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tPlaceholder = options.placeholder ? this._editorLabel(options.placeholder) : "";
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(options.type || "text")}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          value="${escapeHtml(value ?? "")}"
          ${tPlaceholder ? `placeholder="${escapeHtml(tPlaceholder)}"` : ""}
        />
      </label>
    `;
  }

  _renderTextareaField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tPlaceholder = options.placeholder ? this._editorLabel(options.placeholder) : "";
    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <textarea
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          ${tPlaceholder ? `placeholder="${escapeHtml(tPlaceholder)}"` : ""}
        >${escapeHtml(value ?? "")}</textarea>
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

  _renderCheckboxField(label, field, checked) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-toggle">
        <input type="checkbox" data-field="${escapeHtml(field)}" data-value-type="boolean" ${checked ? "checked" : ""} />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span>${escapeHtml(tLabel)}</span>
      </label>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const fullWidth = options.fullWidth !== false;
    const tLabel = this._editorLabel(label);
    return `
      <div class="editor-field ${fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="icon"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(value || "")}"
          data-placeholder="${escapeHtml(options.placeholder || "mdi:bell-outline")}"
        ></div>
      </div>
    `;
  }

  _renderColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("ed.notifications.custom_color");
    const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
    const currentValue = value === undefined || value === null || value === ""
      ? fallbackValue
      : String(value);
    const color = getEditorColorModel(currentValue, fallbackValue);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="${escapeHtml(tColorCustom)}">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="color"
              data-alpha="${escapeHtml(color.alpha)}"
              value="${escapeHtml(color.hex)}"
              aria-label="${escapeHtml(tLabel)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};" aria-hidden="true"></span>
          </label>
        </div>
      </div>
    `;
  }

  _renderEntityPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tPlaceholder = options.placeholder ? this._editorLabel(options.placeholder) : "";
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(value || "")}"
          ${options.domains ? `data-domains="${escapeHtml(options.domains)}"` : ""}
          data-placeholder="${escapeHtml(tPlaceholder)}"
        ></div>
      </div>
    `;
  }

  _renderEntityListField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tPlaceholder = options.placeholder ? this._editorLabel(options.placeholder) : "";
    const domains = options.domains || this._entityDomainsForListField(field).join(",");
    const items = normalizeEntityList(value, this._entityDomainsForListField(field));
    const rows = [...items, ""];
    return `
      <div class="editor-field editor-field--full editor-field--entity-list">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-entity-list">
          ${rows.map((entityId, index) => {
            const isNewRow = index >= items.length;
            return `
              <div class="editor-entity-list__row">
                <div
                  class="editor-control-host"
                  data-mounted-control="entity"
                  data-field="${escapeHtml(`${field}.${index}`)}"
                  data-list-field="${escapeHtml(field)}"
                  data-index="${index}"
                  data-value="${escapeHtml(entityId)}"
                  data-domains="${escapeHtml(domains)}"
                  data-placeholder="${escapeHtml(tPlaceholder)}"
                ></div>
                ${
                  isNewRow
                    ? `<span class="editor-entity-list__spacer" aria-hidden="true"></span>`
                    : `<button type="button" class="editor-entity-list__remove" data-editor-action="remove-entity-list-item" data-field="${escapeHtml(field)}" data-index="${index}" aria-label="${escapeHtml(`${this._editorLabel("ed.notifications.remove_entity_row")} ${tLabel}`)}">
                        <ha-icon icon="mdi:close"></ha-icon>
                      </button>`
                }
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  _mountEntityPicker(host) {
    if (window.NodaliaUtils?.mountEntityPickerHost) {
      window.NodaliaUtils.mountEntityPickerHost(host, {
        hass: this._hass,
        field: host.dataset.field,
        value: host.dataset.value || "",
        placeholder: host.dataset.placeholder || "",
        onShadowInput: this._onShadowInput,
        onShadowValueChanged: this._onShadowValueChanged,
        copyDatasetFromHost: true,
      });
    }
    const control = host.firstElementChild;
    if (!(control instanceof HTMLElement)) {
      return;
    }
    const allowedDomains = String(host.dataset.domains || "")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    if (!allowedDomains.length) {
      return;
    }
    if (control.tagName === "HA-ENTITY-PICKER") {
      control.includeDomains = allowedDomains;
      control.entityFilter = stateObj =>
        allowedDomains.some(domain => String(stateObj?.entity_id || "").startsWith(`${domain}.`));
      return;
    }
    if (control.tagName === "HA-SELECTOR") {
      control.selector = {
        entity: allowedDomains.length === 1 ? { domain: allowedDomains[0] } : { domain: allowedDomains },
      };
    }
  }

  _mountIconPicker(host) {
    if (window.NodaliaUtils?.mountIconPickerHost) {
      window.NodaliaUtils.mountIconPickerHost(host, {
        hass: this._hass,
        value: host.dataset.value || "",
        placeholder: host.dataset.placeholder || "mdi:bell-outline",
        onShadowInput: this._onShadowInput,
        onShadowValueChanged: this._onShadowValueChanged,
        copyDatasetFromHost: true,
      });
      const control = host.firstElementChild;
      if (control instanceof HTMLElement) {
        control.dataset.field = host.dataset.field || "";
      }
    }
  }

  _smartEntityEditorRows(config) {
    const labels = [
      ["calendar_entities", "ed.notifications.conn_label_calendar"],
      ["vacuum_entities", "ed.notifications.conn_label_vacuum"],
      ["vacuum_error_entities", "ed.notifications.conn_label_vacuum_error"],
      ["weather_entities", "ed.notifications.conn_label_weather"],
      ["media_player_entities", "ed.notifications.conn_label_media"],
      ["motion_entities", "ed.notifications.conn_label_motion"],
      ["door_entities", "ed.notifications.conn_label_door"],
      ["window_entities", "ed.notifications.conn_label_window"],
      ["temperature_entities", "ed.notifications.conn_label_temperature"],
      ["humidity_entities", "ed.notifications.conn_label_humidity"],
      ["outdoor_temperature_entities", "ed.notifications.conn_label_outdoor_temperature"],
      ["outdoor_humidity_entities", "ed.notifications.conn_label_outdoor_humidity"],
      ["climate_entities", "ed.notifications.conn_label_climate"],
      ["humidifier_entities", "ed.notifications.conn_label_humidifier"],
      ["battery_entities", "ed.notifications.conn_label_battery"],
      ["humidifier_fill_entities", "ed.notifications.conn_label_tank"],
      ["ink_entities", "ed.notifications.conn_label_ink"],
    ];
    const byEntity = new Map((config.smart_entity_overrides || []).map(item => [item.entity, item]));
    const seen = new Set();
    const rows = [];
    labels.forEach(([field, label]) => {
      (config[field] || []).forEach(entity => {
        if (!entity || seen.has(entity)) {
          return;
        }
        seen.add(entity);
        rows.push({
          entity,
          label,
          ...(byEntity.get(entity) || {}),
        });
      });
    });
    (config.smart_entity_overrides || []).forEach(item => {
      if (item.entity && !seen.has(item.entity)) {
        seen.add(item.entity);
        rows.push({ label: "ed.notifications.conn_label_manual", ...item });
      }
    });
    return rows.map(item => ({
      entity: item.entity,
      label: item.label || "ed.notifications.conn_label_entity",
      title: item.title || "",
      message: item.message || "",
      tint_color: item.tint_color || "",
      url: item.url || "",
      action_label: item.action_label || "",
      tap_action: normalizeNotificationTapAction(item.tap_action),
      mobile: normalizeSmartEntityMobile(item.mobile),
    }));
  }

  _renderNotificationTapActionFields(fieldBase, tapAction, options = {}) {
    const action = normalizeNotificationTapAction(tapAction);
    const actionOptions = [
      { value: "none", label: "ed.notifications.action_none" },
      { value: "more-info", label: "ed.notifications.action_more_info" },
      { value: "navigate", label: "ed.notifications.action_navigate" },
      { value: "url", label: "ed.notifications.action_url" },
      { value: "toggle", label: "ed.notifications.action_toggle" },
    ];
    return `
      ${this._renderSelectField(options.label || "ed.notifications.field_tap_action", `${fieldBase}.action`, action.action, actionOptions, { fullWidth: true })}
      ${
        action.action === "navigate"
          ? this._renderTextField("ed.notifications.field_navigation_path", `${fieldBase}.navigation_path`, action.navigation_path, {
              placeholder: "#camera",
              fullWidth: true,
            })
          : ""
      }
      ${
        action.action === "url"
          ? `
            ${this._renderTextField("ed.notifications.field_url_path", `${fieldBase}.url_path`, action.url_path, {
              placeholder: "https://...",
              fullWidth: true,
            })}
            ${this._renderCheckboxField("ed.notifications.field_new_tab", `${fieldBase}.new_tab`, action.new_tab === true)}
          `
          : ""
      }
      ${
        action.action === "more-info" || action.action === "toggle"
          ? this._renderEntityPickerField("ed.notifications.field_action_entity", `${fieldBase}.entity`, action.entity, {
              placeholder: options.entityPlaceholder || "ed.notifications.placeholder_action_entity",
              fullWidth: true,
            })
          : ""
      }
    `;
  }

  _renderMobilePolicyField(field, value, options = {}) {
    return this._renderSelectField(options.label || "ed.notifications.field_mobile", field, normalizeMobilePolicy(value), [
      { value: "auto", label: "ed.notifications.mobile_policy_auto" },
      { value: "push", label: "ed.notifications.mobile_policy_push" },
      { value: "card_only", label: "ed.notifications.mobile_policy_card_only" },
      { value: "off", label: "ed.notifications.mobile_policy_off" },
    ], { fullWidth: options.fullWidth !== false });
  }

  _renderExternalAlerts(config) {
    const rows = config.external_alerts || [];
    if (!rows.length) {
      return `<div class="editor-empty">${escapeHtml(this._editorLabel("ed.notifications.external_alerts_empty"))}</div>`;
    }
    return rows.map((item, index) => `
      <div class="editor-action">
        <div class="editor-action__header">
          <div class="editor-action__title">${escapeHtml(this._editorLabel("ed.notifications.external_alert_n"))} ${index + 1}</div>
          <div class="editor-action__buttons">
            <button type="button" data-editor-action="remove-external-alert" data-index="${index}">${escapeHtml(this._editorLabel("ed.notifications.remove"))}</button>
          </div>
        </div>
        <div class="editor-grid">
          ${this._renderTextField("ed.notifications.external_alert_id", `external_alerts.${index}.id`, item.id, { placeholder: "entrance_person" })}
          ${this._renderSelectField("ed.notifications.external_alert_type", `external_alerts.${index}.type`, item.type || "external_alert", [
            { value: "camera_event", label: "ed.notifications.external_alert_camera" },
            { value: "security_event", label: "ed.notifications.external_alert_security" },
            { value: "external_alert", label: "ed.notifications.external_alert_generic" },
          ])}
          ${this._renderTextField("ed.notifications.field_title", `external_alerts.${index}.title`, item.title)}
          ${this._renderTextareaField("ed.notifications.field_message", `external_alerts.${index}.message`, item.message)}
          ${this._renderSelectField("ed.notifications.field_severity", `external_alerts.${index}.severity`, item.severity, [
            { value: "info", label: "ed.notifications.severity_info" },
            { value: "success", label: "ed.notifications.severity_ok" },
            { value: "warning", label: "ed.notifications.severity_warning" },
            { value: "critical", label: "ed.notifications.severity_critical" },
          ])}
          ${this._renderEntityPickerField("ed.notifications.field_optional_entity", `external_alerts.${index}.entity`, item.entity, { fullWidth: true })}
          ${this._renderMobilePolicyField(`external_alerts.${index}.mobile`, item.mobile)}
        </div>
      </div>
    `).join("");
  }

  _renderSmartNotificationOptions(config) {
    const rows = [
      ["hot", "ed.notifications.smart_hot", "ed.notifications.smart_ph_hot_title", "ed.notifications.smart_ph_hot_message"],
      ["cold", "ed.notifications.smart_cold", "ed.notifications.smart_ph_cold_title", "ed.notifications.smart_ph_cold_message"],
      ["humidity_high", "ed.notifications.smart_humidity_high", "ed.notifications.smart_ph_humidity_high_title", "ed.notifications.smart_ph_humidity_high_message"],
      ["humidity_low", "ed.notifications.smart_humidity_low", "ed.notifications.smart_ph_humidity_low_title", "ed.notifications.smart_ph_humidity_low_message"],
      ["rain", "ed.notifications.smart_rain", "ed.notifications.smart_ph_rain_title", "ed.notifications.smart_ph_rain_message"],
      ["media_left_on", "ed.notifications.smart_media_left_on", "ed.notifications.smart_ph_media_title", "ed.notifications.smart_ph_media_message"],
      ["battery_low", "ed.notifications.smart_battery_low", "ed.notifications.smart_ph_battery_title", "ed.notifications.smart_ph_battery_message"],
      ["humidifier_fill_low", "ed.notifications.smart_tank_low", "ed.notifications.smart_ph_tank_title", "ed.notifications.smart_ph_tank_message"],
      ["humidifier_fill_full", "ed.notifications.smart_tank_full", "ed.notifications.smart_ph_tank_full_title", "ed.notifications.smart_ph_tank_full_message"],
      ["ink_low", "ed.notifications.smart_ink_low", "ed.notifications.smart_ph_ink_title", "ed.notifications.smart_ph_ink_message"],
    ];
    return rows.map(([key, label, titlePlaceholder, messagePlaceholder]) => {
      const item = config.smart_notifications?.[key] || {};
      return `
        <div class="editor-action">
          <div class="editor-action__header">
            <div class="editor-action__title">${escapeHtml(this._editorLabel(label))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.notifications.field_custom_title", `smart_notifications.${key}.title`, item.title, { placeholder: titlePlaceholder })}
            ${this._renderColorField("ed.notifications.field_tint_color", `smart_notifications.${key}.tint_color`, item.tint_color)}
            ${this._renderMobilePolicyField(`smart_notifications.${key}.mobile`, item.mobile)}
            ${this._renderTextareaField("ed.notifications.field_custom_message", `smart_notifications.${key}.message`, item.message, { placeholder: messagePlaceholder })}
            ${this._renderTextField("ed.notifications.field_url_label", `smart_notifications.${key}.action_label`, item.action_label, { placeholder: "ed.notifications.url_label_placeholder", fullWidth: true })}
            ${this._renderNotificationTapActionFields(`smart_notifications.${key}.tap_action`, item.tap_action)}
            ${this._renderTextField("ed.notifications.field_optional_url", `smart_notifications.${key}.url`, item.url, { placeholder: "https://...", fullWidth: true })}
          </div>
        </div>
      `;
    }).join("");
  }

  _renderSmartEntityOverrides(config) {
    const rows = this._smartEntityEditorRows(config);
    this._smartEntityEditorEntities = rows.map(item => item.entity);
    if (!rows.length) {
      return `<div class="editor-empty">${escapeHtml(this._editorLabel("ed.notifications.smart_empty_connections"))}</div>`;
    }
    return rows.map((item, index) => `
      <div class="editor-action">
        <div class="editor-action__header">
          <div>
            <div class="editor-action__title">${escapeHtml(this._editorLabel(item.label))} · ${escapeHtml(friendlyName(this._hass, item.entity) || item.entity)}</div>
            <div class="editor-action__subtitle">${escapeHtml(item.entity)}</div>
          </div>
        </div>
        <div class="editor-grid">
          ${this._renderMobilePolicyField(`smart_entity_overrides.${index}.mobile`, item.mobile)}
          ${this._renderTextField("ed.notifications.field_title_entity_only", `smart_entity_overrides.${index}.title`, item.title, { placeholder: "ed.notifications.placeholder_use_global_title" })}
          ${this._renderColorField("ed.notifications.field_color_entity_only", `smart_entity_overrides.${index}.tint_color`, item.tint_color)}
          ${this._renderTextareaField("ed.notifications.field_message_entity_only", `smart_entity_overrides.${index}.message`, item.message, { placeholder: "ed.notifications.placeholder_use_global_message" })}
          ${this._renderTextField("ed.notifications.field_url_label", `smart_entity_overrides.${index}.action_label`, item.action_label, { placeholder: "ed.notifications.url_label_placeholder" })}
          ${this._renderNotificationTapActionFields(`smart_entity_overrides.${index}.tap_action`, item.tap_action)}
          ${this._renderTextField("ed.notifications.field_url_entity_only", `smart_entity_overrides.${index}.url`, item.url, { placeholder: "https://...", fullWidth: true })}
        </div>
      </div>
    `).join("");
  }

  _renderCustomNotifications(config) {
    if (!config.custom_notifications.length) {
      return `<div class="editor-empty">${escapeHtml(this._editorLabel("ed.notifications.custom_empty"))}</div>`;
    }
    return config.custom_notifications.map((item, index) => `
      <div class="editor-action">
        <div class="editor-action__header">
          <div class="editor-action__title">${escapeHtml(this._editorLabel("ed.notifications.custom_notification_n"))} ${index + 1}</div>
          <div class="editor-action__buttons">
            <button type="button" data-editor-action="move-custom-up" data-index="${index}">${escapeHtml(this._editorLabel("ed.notifications.move_up"))}</button>
            <button type="button" data-editor-action="move-custom-down" data-index="${index}">${escapeHtml(this._editorLabel("ed.notifications.move_down"))}</button>
            <button type="button" data-editor-action="remove-custom" data-index="${index}">${escapeHtml(this._editorLabel("ed.notifications.remove"))}</button>
          </div>
        </div>
        <div class="editor-grid">
          ${this._renderTextField("ed.notifications.field_title", `custom_notifications.${index}.title`, item.title, { placeholder: "ed.notifications.placeholder_notice" })}
          ${this._renderIconPickerField("ed.notifications.field_icon", `custom_notifications.${index}.icon`, item.icon)}
          ${this._renderTextareaField("ed.notifications.field_message", `custom_notifications.${index}.message`, item.message, { placeholder: "ed.notifications.placeholder_visible_text" })}
          ${this._renderSelectField("ed.notifications.field_severity", `custom_notifications.${index}.severity`, item.severity, [
            { value: "info", label: "ed.notifications.severity_info" },
            { value: "success", label: "ed.notifications.severity_ok" },
            { value: "warning", label: "ed.notifications.severity_warning" },
            { value: "critical", label: "ed.notifications.severity_critical" },
          ])}
          ${this._renderColorField("ed.notifications.field_custom_tint", `custom_notifications.${index}.tint_color`, item.tint_color, { fullWidth: true })}
          ${this._renderMobilePolicyField(`custom_notifications.${index}.mobile`, item.mobile)}
          ${this._renderEntityPickerField("ed.notifications.field_optional_entity", `custom_notifications.${index}.entity`, item.entity, { fullWidth: true })}
          ${this._renderTextField("ed.notifications.field_optional_attribute", `custom_notifications.${index}.attribute`, item.attribute, { placeholder: "temperature" })}
          ${this._renderSelectField("ed.notifications.field_condition", `custom_notifications.${index}.condition`, item.condition, [
            { value: "always", label: "ed.notifications.cond_always" },
            { value: "on", label: "ed.notifications.cond_on" },
            { value: "off", label: "ed.notifications.cond_off" },
            { value: "unavailable", label: "ed.notifications.cond_unavailable" },
            { value: "equals", label: "ed.notifications.cond_equals" },
            { value: "not_equals", label: "ed.notifications.cond_not_equals" },
            { value: "above", label: "ed.notifications.cond_above" },
            { value: "below", label: "ed.notifications.cond_below" },
            { value: "missing", label: "ed.notifications.cond_missing" },
          ])}
          ${this._renderTextField("ed.notifications.field_condition_value", `custom_notifications.${index}.value`, item.value, { placeholder: "27" })}
          ${this._renderSelectField("ed.notifications.field_action", `custom_notifications.${index}.action_type`, item.action_type, [
            { value: "none", label: "ed.notifications.action_none" },
            { value: "more-info", label: "ed.notifications.action_more_info" },
            { value: "url", label: "ed.notifications.action_url" },
            { value: "toggle", label: "ed.notifications.action_toggle" },
            { value: "service", label: "ed.notifications.action_service" },
          ])}
          ${this._renderTextField("ed.notifications.field_action_label", `custom_notifications.${index}.action_label`, item.action_label, { placeholder: "ed.notifications.placeholder_run" })}
          ${this._renderNotificationTapActionFields(`custom_notifications.${index}.tap_action`, item.tap_action)}
          ${
            item.action_type === "url"
              ? this._renderTextField("ed.notifications.field_url_plain", `custom_notifications.${index}.url`, item.url, {
                  placeholder: "https://...",
                  fullWidth: true,
                })
              : ""
          }
          ${
            item.action_type === "service"
              ? `
                ${this._renderTextField("ed.notifications.field_service", `custom_notifications.${index}.service`, item.service, {
                  placeholder: "light.turn_on",
                  fullWidth: true,
                })}
                ${this._renderTextareaField("ed.notifications.field_service_data_json", `custom_notifications.${index}.service_data`, item.service_data, {
                  placeholder: '{"brightness_pct": 80}',
                })}
              `
              : ""
          }
        </div>
      </div>
    `).join("");
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    const config = this._config || normalizeConfig({});
    const engineBackgroundActive = this._engineBackgroundActive();
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          overflow-anchor: none;
        }
        * {
          box-sizing: border-box;
        }
        .editor {
          color: var(--primary-text-color);
          display: grid;
          gap: 16px;
          margin: 0;
          overflow-anchor: none;
        }
        .editor-section {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border-radius: 16px;
          display: grid;
          gap: 14px;
          margin: 0;
          padding: 14px;
        }
        .editor-section:last-child {
          margin-bottom: 0;
        }
        .editor-section__header {
          display: grid;
          gap: 5px;
        }
        .editor-section__title {
          font-size: 15px;
          font-weight: 800;
        }
        .editor-section__hint,
        .editor-empty {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.35;
        }
        .editor-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .editor-field {
          display: grid;
          gap: 6px;
        }
        .editor-field--full,
        .editor-grid--stacked {
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
        .editor-grid--stacked {
          grid-template-columns: 1fr;
        }
        .editor-field > span,
        .editor-toggle > span:last-child {
          font-size: 12px;
          font-weight: 700;
        }
        .editor-field input,
        .editor-field textarea,
        .editor-field select {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 38px;
          padding: 8px 10px;
          width: 100%;
        }
        .editor-field textarea {
          min-height: 76px;
          resize: vertical;
        }
        .editor-toggle {
          align-items: center;
          cursor: pointer;
          display: grid;
          gap: 10px;
          grid-template-columns: auto minmax(0, 1fr);
          min-height: 40px;
        }
        .editor-toggle input {
          height: 1px;
          margin: 0;
          opacity: 0;
          position: absolute;
          width: 1px;
        }
        .editor-toggle__switch {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          height: 22px;
          position: relative;
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
        .editor-toggle input:checked + .editor-toggle__switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }
        .editor-toggle input:checked + .editor-toggle__switch::before {
          transform: translateX(18px);
        }
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
          height: 22px;
          width: 22px;
        }
        .editor-entity-list {
          display: grid;
          gap: 8px;
        }
        .editor-entity-list__row {
          align-items: center;
          display: grid;
          gap: 8px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }
        .editor-entity-list__remove {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent);
          border-radius: 999px;
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: 34px;
          justify-content: center;
          min-width: 34px;
          padding: 0;
          width: 34px;
        }
        .editor-entity-list__remove ha-icon {
          --mdc-icon-size: 16px;
        }
        .editor-entity-list__spacer {
          display: block;
          width: 34px;
        }
        .editor-section__actions,
        .editor-action__buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .editor-section__toggle-button,
        .editor-section__actions button,
        .editor-action__buttons button {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font: inherit;
          font-size: 12px;
          font-weight: 750;
          justify-content: center;
          min-height: 34px;
          padding: 0 12px;
        }
        .editor-section__toggle-button ha-icon {
          --mdc-icon-size: 16px;
        }
        .editor-action {
          background: color-mix(in srgb, var(--primary-text-color) 3%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent);
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
          font-weight: 800;
        }
        .editor-action__subtitle {
          color: var(--secondary-text-color);
          font-size: 11px;
          line-height: 1.35;
          margin-top: 2px;
          overflow-wrap: anywhere;
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
        @media (max-width: 640px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.general_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.notifications.empty_message", "empty_message", config.empty_message, { fullWidth: true })}
            ${this._renderTextField("ed.notifications.max_visible_collapsed", "max_visible", config.max_visible, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.calendar_refresh_s", "refresh_interval", config.refresh_interval, { type: "number", valueType: "number" })}
            ${this._renderCheckboxField("ed.notifications.smart_recommendations", "smart_recommendations", config.smart_recommendations !== false)}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.connections_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.connections_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="connections"
                aria-expanded="${this._showConnectionsSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showConnectionsSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showConnectionsSection ? this._editorLabel("ed.notifications.hide") : this._editorLabel("ed.notifications.show"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showConnectionsSection
              ? `
                <div class="editor-grid">
                  ${this._renderEntityListField("ed.notifications.entity_calendars", "calendar_entities", config.calendar_entities, { placeholder: "calendar.casa" })}
                  ${this._renderEntityListField("ed.notifications.entity_vacuums", "vacuum_entities", config.vacuum_entities, { placeholder: "vacuum.robot" })}
                  ${this._renderEntityListField("ed.notifications.entity_vacuum_errors", "vacuum_error_entities", config.vacuum_error_entities, { placeholder: "sensor.robot_error" })}
                  ${this._renderEntityListField("ed.notifications.entity_fans", "fan_entities", config.fan_entities, { placeholder: "fan.salon" })}
                  ${this._renderEntityListField("ed.notifications.entity_climates", "climate_entities", config.climate_entities, { placeholder: "climate.salon" })}
                  ${this._renderEntityListField("ed.notifications.entity_humidifiers", "humidifier_entities", config.humidifier_entities, { placeholder: "humidifier.deshumidificador" })}
                  ${this._renderEntityListField("ed.notifications.entity_media_players", "media_player_entities", config.media_player_entities, { placeholder: "media_player.tv_salon" })}
                  ${this._renderEntityListField("ed.notifications.entity_weather", "weather_entities", config.weather_entities, { placeholder: "weather.casa" })}
                  ${this._renderEntityListField("ed.notifications.entity_motion", "motion_entities", config.motion_entities, { placeholder: "binary_sensor.movimiento" })}
                  ${this._renderEntityListField("ed.notifications.entity_doors", "door_entities", config.door_entities, { placeholder: "binary_sensor.puerta" })}
                  ${this._renderEntityListField("ed.notifications.entity_windows", "window_entities", config.window_entities, { placeholder: "binary_sensor.ventana" })}
                  ${this._renderEntityListField("ed.notifications.entity_temperature", "temperature_entities", config.temperature_entities, { placeholder: "sensor.temperatura" })}
                  ${this._renderEntityListField("ed.notifications.entity_humidity", "humidity_entities", config.humidity_entities, { placeholder: "sensor.humedad" })}
                  ${this._renderEntityListField("ed.notifications.entity_outdoor_temperature", "outdoor_temperature_entities", config.outdoor_temperature_entities, { placeholder: "sensor.temperatura_exterior" })}
                  ${this._renderEntityListField("ed.notifications.entity_outdoor_humidity", "outdoor_humidity_entities", config.outdoor_humidity_entities, { placeholder: "sensor.humedad_exterior" })}
                  ${this._renderEntityListField("ed.notifications.entity_battery", "battery_entities", config.battery_entities, { placeholder: "sensor.pila_mando" })}
                  ${this._renderEntityListField("ed.notifications.entity_humidifier_tank", "humidifier_fill_entities", config.humidifier_fill_entities, { placeholder: "sensor.humidificador_deposito" })}
                  ${this._renderEntityListField("ed.notifications.entity_tank_full", "humidifier_full_entities", config.humidifier_full_entities, { placeholder: "sensor.deposito_sucio" })}
                  ${this._renderEntityListField("ed.notifications.entity_ink", "ink_entities", config.ink_entities, { placeholder: "sensor.impresora_tinta_negra" })}
                </div>
              `
              : ""
          }
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.thresholds_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.thresholds_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.notifications.thresh_hot", "thresholds.hot_temperature", config.thresholds.hot_temperature, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_cold", "thresholds.cold_temperature", config.thresholds.cold_temperature, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_humidity_high", "thresholds.humidity_high", config.thresholds.humidity_high, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_humidity_low", "thresholds.humidity_low", config.thresholds.humidity_low, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_rain_probability", "thresholds.rain_probability", config.thresholds.rain_probability, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_rain_hours", "thresholds.rain_lookahead_hours", config.thresholds.rain_lookahead_hours, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_media_absence_min", "thresholds.media_absence_minutes", config.thresholds.media_absence_minutes, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_battery_low", "thresholds.battery_low", config.thresholds.battery_low, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_tank_low", "thresholds.humidifier_fill_low", config.thresholds.humidifier_fill_low, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_tank_full", "thresholds.humidifier_fill_full", config.thresholds.humidifier_fill_full, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_ink_low", "thresholds.ink_low", config.thresholds.ink_low, { type: "number", valueType: "number" })}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.sync_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.sync_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderEntityPickerField("ed.notifications.dismissed_helper", "dismissed_entity", config.dismissed_entity, {
              domains: "input_text",
              fullWidth: true,
              placeholder: "input_text.nodalia_notifications_dismissed",
            })}
            <div class="editor-action editor-field--full">
              <div class="editor-action__header">
                <div class="editor-action__title">${escapeHtml(this._editorLabel("ed.notifications.mobile_delivery_section_title"))}</div>
                <div class="editor-action__subtitle">${escapeHtml(this._editorLabel("ed.notifications.mobile_delivery_section_hint"))}</div>
              </div>
              <div class="editor-grid">
                ${this._renderCheckboxField("ed.notifications.mobile_send", "mobile_notifications.enabled", config.mobile_notifications?.enabled === true)}
                ${
                  config.mobile_notifications?.enabled === true
                    ? `
                      ${this._renderEntityListField(
                        "ed.notifications.mobile_notify_entities",
                        "mobile_notifications.entities",
                        config.mobile_notifications?.entities,
                        { placeholder: "notify.mobile_app_iphone" },
                      )}
                      ${this._renderTextField(
                        "ed.notifications.mobile_notify_legacy",
                        "mobile_notifications.services",
                        Array.isArray(config.mobile_notifications?.services) ? config.mobile_notifications.services.join(", ") : "",
                        { placeholder: "notify.mobile_app_iphone", valueType: "csv", fullWidth: true },
                      )}
                      ${this._renderCheckboxField(
                        "ed.notifications.mobile_critical_legacy",
                        "mobile_notifications.critical_alerts",
                        config.mobile_notifications?.critical_alerts === true,
                      )}
                    `
                    : ""
                }
                ${this._renderSelectField("ed.notifications.mobile_min_severity", "mobile_notifications.min_severity", config.mobile_notifications?.min_severity, [
                  { value: "info", label: "ed.notifications.mobile_severity_all_info" },
                  { value: "success", label: "ed.notifications.severity_ok" },
                  { value: "warning", label: "ed.notifications.severity_warning" },
                  { value: "critical", label: "ed.notifications.severity_critical" },
                ])}
                ${this._renderSelectField("ed.notifications.mobile_default_policy", "mobile_notifications.default_policy", config.mobile_notifications?.default_policy, [
                  { value: "auto", label: "ed.notifications.mobile_policy_auto" },
                  { value: "push", label: "ed.notifications.mobile_policy_push" },
                  { value: "card_only", label: "ed.notifications.mobile_policy_card_only" },
                  { value: "off", label: "ed.notifications.mobile_policy_off" },
                ])}
                ${this._renderTextField("ed.notifications.mobile_cooldown_minutes", "mobile_notifications.cooldown_minutes", config.mobile_notifications?.cooldown_minutes, { type: "number", valueType: "number" })}
                ${this._renderCheckboxField("ed.notifications.mobile_group_similar", "mobile_notifications.group_similar", config.mobile_notifications?.group_similar !== false)}
              </div>
            </div>
            <div class="editor-action editor-field--full">
              <div class="editor-action__header">
                <div>
                  <div class="editor-action__title">${escapeHtml(this._editorLabel("ed.notifications.background_mobile_title"))}</div>
                  <div class="editor-action__subtitle">${escapeHtml(
                    engineBackgroundActive
                      ? this._editorLabel("ed.engine.managed_hint")
                      : this._editorLabel("ed.notifications.background_mobile_hint"),
                  )}</div>
                </div>
              </div>
              <div class="editor-grid">
                ${engineBackgroundActive ? this._renderEngineBannerHtml() : ""}
                ${this._renderCheckboxField(
                  "ed.notifications.background_mobile_enabled",
                  "background_mobile.enabled",
                  config.background_mobile?.enabled === true,
                )}
                ${
                  config.background_mobile?.enabled === true
                    ? `
                      ${this._renderTextField(
                        "ed.notifications.background_mobile_profile",
                        "background_mobile.profile_id",
                        config.background_mobile?.profile_id,
                        { placeholder: "default", fullWidth: true },
                      )}
                      ${
                        engineBackgroundActive
                          ? ""
                          : `
                            ${this._renderTextField(
                              "ed.notifications.background_mobile_webhook",
                              "background_mobile.webhook",
                              config.background_mobile?.webhook,
                              {
                                placeholder: "nodalia_notifications_background_sync",
                                fullWidth: true,
                              },
                            )}
                            <div class="editor-engine-note editor-field--full">${escapeHtml(this._editorLabel("ed.engine.offline_hint"))}</div>
                          `
                      }
                    `
                    : ""
                }
              </div>
            </div>
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.context_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.context_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="context"
                aria-expanded="${this._showContextSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showContextSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showContextSection ? this._editorLabel("ed.notifications.hide") : this._editorLabel("ed.notifications.show"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showContextSection
              ? `
                <div class="editor-grid">
                  ${this._renderEntityPickerField("ed.notifications.presence_entity", "presence_entity", config.presence_entity, { fullWidth: true, placeholder: "binary_sensor.home_occupied" })}
                  ${this._renderCheckboxField("ed.notifications.only_when_away", "mobile_context.only_when_away", config.mobile_context?.only_when_away === true)}
                  ${this._renderCheckboxField("ed.notifications.only_when_home", "mobile_context.only_when_home", config.mobile_context?.only_when_home === true)}
                  ${this._renderCheckboxField("ed.notifications.quiet_hours_enabled", "mobile_context.quiet_hours.enabled", config.mobile_context?.quiet_hours?.enabled === true)}
                  ${this._renderTextField("ed.notifications.quiet_hours_start", "mobile_context.quiet_hours.start", config.mobile_context?.quiet_hours?.start, { placeholder: "23:00" })}
                  ${this._renderTextField("ed.notifications.quiet_hours_end", "mobile_context.quiet_hours.end", config.mobile_context?.quiet_hours?.end, { placeholder: "08:00" })}
                  ${this._renderCheckboxField("ed.notifications.quiet_hours_allow_critical", "mobile_context.quiet_hours.allow_critical", config.mobile_context?.quiet_hours?.allow_critical !== false)}
                </div>
              `
              : ""
          }
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.smart_alerts_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.smart_alerts_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="smart"
                aria-expanded="${this._showSmartSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showSmartSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showSmartSection ? this._editorLabel("ed.notifications.hide") : this._editorLabel("ed.notifications.show"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showSmartSection
              ? `
                <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.smart_alerts_subhint"))}</div>
                ${this._renderSmartNotificationOptions(config)}
                <div class="editor-section__header">
                  <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.per_entity_section_title"))}</div>
                  <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.per_entity_section_hint"))}</div>
                </div>
                ${this._renderSmartEntityOverrides(config)}
              `
              : ""
          }
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.custom_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.custom_section_hint"))}</div>
            <div class="editor-section__actions">
              <button type="button" data-editor-action="add-custom">${escapeHtml(this._editorLabel("ed.notifications.add_notification"))}</button>
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="custom"
                aria-expanded="${this._showCustomSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showCustomSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showCustomSection ? this._editorLabel("ed.notifications.hide") : this._editorLabel("ed.notifications.show"))}</span>
              </button>
            </div>
          </div>
          ${this._showCustomSection ? this._renderCustomNotifications(config) : ""}
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.external_alerts_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.external_alerts_section_hint"))}</div>
            <div class="editor-section__actions">
              <button type="button" data-editor-action="add-external-alert">${escapeHtml(this._editorLabel("ed.notifications.add_external_alert"))}</button>
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="external"
                aria-expanded="${this._showExternalAlertsSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showExternalAlertsSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showExternalAlertsSection ? this._editorLabel("ed.notifications.hide") : this._editorLabel("ed.notifications.show"))}</span>
              </button>
            </div>
          </div>
          ${this._showExternalAlertsSection ? this._renderExternalAlerts(config) : ""}
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.animations_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("ed.notifications.hide") : this._editorLabel("ed.notifications.show"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("ed.notifications.enable_animations", "animations.enabled", config.animations?.enabled !== false)}
                  ${this._renderTextField("ed.notifications.content_entrance_ms", "animations.content_duration", config.animations?.content_duration, { type: "number", valueType: "number" })}
                  ${this._renderTextField("ed.notifications.button_bounce_ms", "animations.button_bounce_duration", config.animations?.button_bounce_duration, { type: "number", valueType: "number" })}
                </div>
              `
              : ""
          }
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.security_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.security_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField(
              "ed.notifications.security_strict",
              "security.strict_service_actions",
              config.security?.strict_service_actions === true,
            )}
            ${
              config.security?.strict_service_actions === true
                ? this._renderTextField(
                    "ed.notifications.security_allowed_services",
                    "security.allowed_services",
                    Array.isArray(config.security?.allowed_services) ? config.security.allowed_services.join(", ") : "",
                    { placeholder: "light.turn_on, script.turn_on", valueType: "csv", fullWidth: true },
                  )
                : ""
            }
            ${
              config.security?.strict_service_actions === true
                ? this._renderTextField(
                    "ed.notifications.security_allowed_domains",
                    "security.allowed_service_domains",
                    Array.isArray(config.security?.allowed_service_domains) ? config.security.allowed_service_domains.join(", ") : "",
                    { placeholder: "light, script", valueType: "csv", fullWidth: true },
                  )
                : ""
            }
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.styles_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showStyleSection ? this._editorLabel("ed.notifications.hide") : this._editorLabel("ed.notifications.show"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("ed.notifications.card_background", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("ed.notifications.card_border", "styles.card.border", config.styles.card.border)}
                  ${window.NodaliaUtils?.renderEditorCardBorderRadiusHtml?.({
                    escapeHtml,
                    field: "styles.card.border_radius",
                    value: config.styles?.card?.border_radius,
                    tHeading: this._editorLabel("ed.notifications.card_radius_presets"),
                    labels: {
                      pill: this._editorLabel("ed.entity.chip_radius_pill"),
                      soft: this._editorLabel("ed.entity.chip_radius_soft"),
                      round: this._editorLabel("ed.entity.chip_radius_round"),
                      square: this._editorLabel("ed.entity.chip_radius_square"),
                    },
                  }) || this._renderTextField("ed.notifications.card_radius", "styles.card.border_radius", config.styles.card.border_radius)}
                  <div class="editor-section__hint editor-field--full" style="margin-top: -6px;">${escapeHtml(this._editorLabel("ed.notifications.card_radius_yaml_hint"))}</div>
                  ${this._renderTextField("ed.notifications.box_shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("ed.notifications.padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("ed.notifications.gap", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderColorField("ed.notifications.icon_background", "styles.icon.background", config.styles.icon.background)}
                  ${this._renderColorField("ed.notifications.icon_color", "styles.icon.color", config.styles.icon.color)}
                  ${this._renderTextField("ed.notifications.icon_size", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderTextField("ed.notifications.title_size", "styles.title_size", config.styles.title_size)}
                  ${window.NodaliaUtils?.renderEditorCardBorderRadiusHtml?.({
                    escapeHtml,
                    field: "styles.item_radius",
                    value: config.styles?.item_radius,
                    tHeading: this._editorLabel("ed.notifications.item_radius_presets"),
                    labels: {
                      pill: this._editorLabel("ed.entity.chip_radius_pill"),
                      soft: this._editorLabel("ed.entity.chip_radius_soft"),
                      round: this._editorLabel("ed.entity.chip_radius_round"),
                      square: this._editorLabel("ed.entity.chip_radius_square"),
                    },
                  }) || this._renderTextField("ed.notifications.item_radius", "styles.item_radius", config.styles.item_radius)}
                  <div class="editor-section__hint editor-field--full" style="margin-top: -6px;">${escapeHtml(this._editorLabel("ed.notifications.item_radius_yaml_hint"))}</div>
                  ${this._renderColorField("ed.notifications.visual_tint", "styles.accent", config.styles.accent, { fullWidth: true })}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot.querySelectorAll('[data-mounted-control="entity"]').forEach(host => this._mountEntityPicker(host));
    this.shadowRoot.querySelectorAll('[data-mounted-control="icon"]').forEach(host => this._mountIconPicker(host));
    this._ensureEditorControlsReady();
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}
  _lazyNodaliaNotificationsCardEditor = NodaliaNotificationsCardEditor;
  return NodaliaNotificationsCardEditor;
}
