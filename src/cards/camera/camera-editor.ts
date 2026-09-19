// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { MAX_CAMERAS } from "./camera-constants";
import { escapeHtml, getByPath } from "./camera-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./camera-config";
import {
  fireEvent,
  mergeConfig,
  setByPath,
  stripEqualToDefaults,
} from "./camera-helpers";

export class NodaliaCameraCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
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
    const shouldRender = !this._hass || nextSignature !== this._entityOptionsSignature || !this.shadowRoot?.innerHTML;
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
    this._config = mergeConfig(DEFAULT_CONFIG, config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._render();
    this._restoreFocusState(focusState);
  }

  _editorLabel(key) {
    return window.NodaliaI18n?.editorStr?.(this._hass, this._config?.language ?? "auto", key) || key;
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(
      hass,
      this._config?.language,
      id => /^(camera|light|fan|humidifier|vacuum|cover|climate|lock|switch|input_boolean)\./.test(id),
    );
  }

  _captureFocusState() {
    return window.NodaliaUtils.captureEditorFocusState(this);
  }

  _restoreFocusState(focusState) {
    window.NodaliaUtils.restoreEditorFocusState(this, focusState);
  }

  _emitConfig(reRender = false) {
    const normalized = normalizeConfig(this._config);
    normalized.camera_streams = compactCameraStreams(normalized.camera_streams);
    normalized.camera_tap_actions = compactCameraTapActions(
      normalized.camera_tap_actions,
      normalized,
    );
    const outgoing = stripEqualToDefaults(normalized);
    fireEvent(this, "config-changed", {
      config: outgoing,
    });
    if (reRender) {
      this._render();
    }
  }

  _editorCameras() {
    if (Array.isArray(this._config?.cameras) && this._config.cameras.length) {
      return this._config.cameras.map(normalizeCameraEntityId);
    }
    const entity = String(this._config?.entity ?? "").trim();
    return entity ? [entity] : [];
  }

  _syncEditorCameraStreams() {
    const cameras = this._editorCameras().filter(Boolean).slice(0, MAX_CAMERAS);
    const existing = Array.isArray(this._config?.camera_streams) ? this._config.camera_streams : [];
    this._config.camera_streams = cameras.map(camera => {
      const configured = existing.find(item => item?.camera === camera);
      return {
        provider: "home_assistant",
        client_id: "frigate",
        base_url: "",
        stream: cameraStreamName(camera),
        mode: "auto",
        url: "",
        muted: true,
        controls: false,
        ...(isObject(configured) ? configured : {}),
        camera,
      };
    });
  }

  _syncEditorCameraTapActions() {
    const cameras = this._editorCameras().filter(Boolean).slice(0, MAX_CAMERAS);
    const existing = Array.isArray(this._config?.camera_tap_actions) ? this._config.camera_tap_actions : [];
    const legacy = {
      tap_action: this._config?.tap_action || "toggle",
      tap_service: this._config?.tap_service || "",
      tap_service_data: this._config?.tap_service_data || "",
      tap_service_target: this._config?.tap_service_target || "",
      tap_url: this._config?.tap_url || "",
      navigation_path: this._config?.navigation_path || "",
      tap_new_tab: this._config?.tap_new_tab === true,
    };
    this._config.camera_tap_actions = cameras.map(camera => {
      const configured = existing.find(item => normalizeCameraEntityId(item?.camera) === camera);
      const source = isObject(configured) ? { camera, ...configured } : { camera, ...legacy };
      return normalizeCameraTapActions([source], [camera])[0];
    }).filter(Boolean);
  }

  _migrateCameraReferences(previousCamera, nextCamera) {
    const previous = String(previousCamera || "").trim();
    const next = String(nextCamera || "").trim();
    if (!previous || previous === next) {
      return;
    }
    if (Array.isArray(this._config.camera_actions)) {
      this._config.camera_actions.forEach(action => {
        if (action?.camera === previous) {
          action.camera = next;
        }
      });
    }
    if (Array.isArray(this._config.camera_tap_actions)) {
      this._config.camera_tap_actions.forEach(action => {
        if (action?.camera === previous) {
          action.camera = next;
        }
      });
    }
    if (Array.isArray(this._config.camera_streams)) {
      this._config.camera_streams.forEach(stream => {
        if (stream?.camera !== previous) {
          return;
        }
        stream.camera = next;
        if (!stream.stream || stream.stream === cameraStreamName(previous)) {
          stream.stream = cameraStreamName(next);
        }
      });
    }
  }

  _onShadowInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.dataset?.field) {
      return;
    }
    const field = target.dataset.field;
    const cameraField = field.match(/^cameras\.(\d+)$/);
    const previousCamera = cameraField
      ? String(getByPath(this._config, field) || "").trim()
      : field === "entity" ? String(this._config.entity || "").trim() : "";
    const value = target instanceof HTMLInputElement && target.type === "checkbox"
      ? target.checked
      : target.value;
    setByPath(this._config, field, value);
    if (cameraField || field === "entity") {
      this._migrateCameraReferences(previousCamera, value);
    }
    if (field === "entity" && value) {
      if (!Array.isArray(this._config.cameras) || !this._config.cameras.length) {
        this._config.cameras = [value];
      } else {
        this._config.cameras[0] = value;
      }
    } else if (cameraField?.[1] === "0") {
      this._config.entity = String(value || "").trim();
    }
    this._emitConfig(
      field === "tap_action"
      || field === "hold_action"
      || field.includes("tap_action")
      || field.endsWith(".provider")
      || Boolean(cameraField)
      || field === "entity",
    );
  }

  _onShadowValueChanged(event) {
    const host = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.field);
    if (!host?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    const detailValue = event.detail?.value ?? "";
    const field = host.dataset.field;
    const cameraField = field.match(/^cameras\.(\d+)$/);
    const previousCamera = cameraField
      ? String(getByPath(this._config, field) || "").trim()
      : field === "entity" ? String(this._config.entity || "").trim() : "";
    const nextValue = String(detailValue || "").trim();
    setByPath(this._config, field, nextValue);
    if (cameraField || field === "entity") {
      this._migrateCameraReferences(previousCamera, nextValue);
    }
    if (field === "entity" && detailValue) {
      if (!Array.isArray(this._config.cameras) || !this._config.cameras.length) {
        this._config.cameras = [detailValue];
      } else {
        this._config.cameras[0] = detailValue;
      }
    } else if (cameraField?.[1] === "0") {
      this._config.entity = nextValue;
    }
    this._emitConfig(Boolean(cameraField) || field === "entity");
  }

  _onShadowClick(event) {
    const button = event.composedPath().find(node => node instanceof HTMLButtonElement && node.dataset?.editorAction);
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.editorAction;
      const index = Number(button.dataset.index);
      if (action === "add-camera") {
        if (!Array.isArray(this._config.cameras)) {
          this._config.cameras = this._editorCameras();
        }
        if (this._config.cameras.length < MAX_CAMERAS) {
          this._config.cameras.push("");
          this._render();
        }
        return;
      }
      if (action === "remove-camera" && Number.isInteger(index)) {
        if (!Array.isArray(this._config.cameras)) {
          this._config.cameras = this._editorCameras();
        }
        const removedCamera = String(this._config.cameras[index] || "").trim();
        this._config.cameras.splice(index, 1);
        if (removedCamera && Array.isArray(this._config.camera_actions)) {
          this._config.camera_actions = this._config.camera_actions.filter(item => item?.camera !== removedCamera);
        }
        if (removedCamera && Array.isArray(this._config.camera_tap_actions)) {
          this._config.camera_tap_actions = this._config.camera_tap_actions.filter(item => item?.camera !== removedCamera);
        }
        if (removedCamera && Array.isArray(this._config.camera_streams)) {
          this._config.camera_streams = this._config.camera_streams.filter(item => item?.camera !== removedCamera);
        }
        this._config.entity = this._config.cameras[0] || "";
        this._emitConfig(true);
        return;
      }
      if (action === "add-camera-action") {
        const cameraId = String(button.dataset.camera || "").trim();
        if (!cameraId) {
          return;
        }
        if (!Array.isArray(this._config.camera_actions)) {
          this._config.camera_actions = [];
        }
        if (this._config.camera_actions.filter(item => item?.camera === cameraId).length < 8) {
          this._config.camera_actions.push({
            camera: cameraId,
            entity: "",
            name: "",
            icon: "",
            tap_action: "toggle",
          });
          this._render();
        }
        return;
      }
      if (action === "remove-camera-action" && Number.isInteger(index)) {
        if (!Array.isArray(this._config.camera_actions)) {
          this._config.camera_actions = [];
        }
        this._config.camera_actions.splice(index, 1);
        this._emitConfig(true);
        return;
      }
      if (action === "add-expanded-action") {
        if (!Array.isArray(this._config.expanded_actions)) {
          this._config.expanded_actions = [];
        }
        this._config.expanded_actions.push({
          entity: "",
          name: "",
          icon: "",
          tap_action: "toggle",
        });
        this._render();
        return;
      }
      if (action === "remove-expanded-action" && Number.isInteger(index)) {
        if (!Array.isArray(this._config.expanded_actions)) {
          this._config.expanded_actions = [];
        }
        this._config.expanded_actions.splice(index, 1);
        this._emitConfig(true);
      }
      return;
    }

    const toggleButton = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.editorToggle);
    if (!toggleButton) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (toggleButton.dataset.editorToggle === "tap_actions") {
      this._showTapActionsSection = !this._showTapActionsSection;
      this._render();
    }
  }

  _renderTextareaField(label, field, value, options = {}) {
    const textValue = isObject(value) ? JSON.stringify(value, null, 2) : value ?? "";
    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(this._editorLabel(label))}</span>
        <textarea data-field="${escapeHtml(field)}">${escapeHtml(textValue)}</textarea>
      </label>
    `;
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input data-field="${escapeHtml(field)}" value="${escapeHtml(value ?? "")}" placeholder="${escapeHtml(options.placeholder || "")}" />
      </label>
    `;
  }

  _renderSelectField(label, field, value, options) {
    return `
      <label class="editor-field">
        <span>${escapeHtml(this._editorLabel(label))}</span>
        <select data-field="${escapeHtml(field)}">
          ${(options || []).map(option => `
            <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
              ${escapeHtml(this._editorLabel(option.label))}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    return `
      <label class="editor-toggle">
        <input type="checkbox" data-field="${escapeHtml(field)}" ${checked ? "checked" : ""} />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(this._editorLabel(label))}</span>
      </label>
    `;
  }

  _renderCameraEntityField(label, field, value, domains = "camera") {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-control-host" data-mounted-control="camera-entity" data-field="${escapeHtml(field)}" data-domains="${escapeHtml(domains)}" data-value="${escapeHtml(value || "")}"></div>
      </label>
    `;
  }

  _renderIconField(label, field, value) {
    return `
      <label class="editor-field">
        <span>${escapeHtml(this._editorLabel(label))}</span>
        <div
          class="editor-control-host"
          data-mounted-control="camera-icon"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(value || "")}"
        ></div>
      </label>
    `;
  }

  _mountCameraEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }
    if (host.querySelector("ha-entity-picker")) {
      return;
    }
    const field = host.dataset.field || "entity";
    const value = getByPath(this._config, field) || "";
    const domains = String(host.dataset.domains || "camera").split(",").filter(Boolean);
    const picker = document.createElement("ha-entity-picker");
    picker.dataset.field = field;
    picker.hass = this._hass;
    picker.value = value;
    picker.includeDomains = domains.length ? domains : ["camera"];
    picker.allowCustomEntity = true;
    host.replaceChildren(picker);
  }

  _mountIconPicker(host) {
    if (!(host instanceof HTMLElement) || host.querySelector("ha-icon-picker")) {
      return;
    }
    const picker = document.createElement("ha-icon-picker");
    picker.dataset.field = host.dataset.field || "icon";
    picker.hass = this._hass;
    picker.value = host.dataset.value || "";
    host.replaceChildren(picker);
  }

  _renderCameraListSection(config) {
    const cameras = this._editorCameras();
    const rows = cameras.length ? cameras : [String(config.entity || "")];
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div>
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.camera.cameras_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.cameras_section_hint"))}</div>
          </div>
          <button type="button" data-editor-action="add-camera" ${rows.length >= MAX_CAMERAS ? "disabled" : ""}>
            ${escapeHtml(this._editorLabel("ed.camera.add_camera"))}
          </button>
        </div>
        <div class="editor-list">
          ${rows.map((cameraId, index) => `
            <div class="editor-card">
              <div class="editor-card__header">
                <span>${escapeHtml(this._editorLabel("ed.camera.camera_item"))} ${index + 1}</span>
                <button type="button" class="danger" data-editor-action="remove-camera" data-index="${index}">
                  ${escapeHtml(this._editorLabel("ed.camera.remove_camera"))}
                </button>
              </div>
              ${this._renderCameraEntityField("ed.camera.select_entity", `cameras.${index}`, cameraId)}
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  _renderExpandedActionsSection(config) {
    const cameras = this._editorCameras().filter(Boolean);
    const cameraActions = Array.isArray(config.camera_actions) ? config.camera_actions : [];
    const legacyActions = Array.isArray(config.expanded_actions) ? config.expanded_actions : [];
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div>
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.camera.expanded_actions_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.expanded_actions_section_hint"))}</div>
          </div>
        </div>
        <div class="editor-list">
          ${cameras.length ? cameras.map((cameraId, cameraIndex) => {
    const actions = cameraActions
      .map((action, sourceIndex) => ({ action, sourceIndex }))
      .filter(item => item.action?.camera === cameraId);
    const legacy = cameraIndex === 0 && !actions.length
      ? legacyActions.map((action, sourceIndex) => ({ action, sourceIndex, legacy: true }))
      : [];
    const rows = actions.length ? actions : legacy;
    const cameraName = this._hass?.states?.[cameraId]?.attributes?.friendly_name || cameraId;
    return `
            <div class="editor-camera-group">
              <div class="editor-card__header">
                <strong>${escapeHtml(cameraName)}</strong>
                <button type="button" data-editor-action="add-camera-action" data-camera="${escapeHtml(cameraId)}" ${actions.length >= 8 ? "disabled" : ""}>
                  ${escapeHtml(this._editorLabel("ed.camera.add_expanded_action"))}
                </button>
              </div>
              ${rows.length ? rows.map(({ action, sourceIndex, legacy }) => {
    const prefix = legacy ? `expanded_actions.${sourceIndex}` : `camera_actions.${sourceIndex}`;
    const removeAction = legacy ? "remove-expanded-action" : "remove-camera-action";
    return `
              <div class="editor-card">
                <div class="editor-card__header">
                  <span>${escapeHtml(this._editorLabel("ed.camera.expanded_action_item"))} ${sourceIndex + 1}</span>
                  <button type="button" class="danger" data-editor-action="${removeAction}" data-index="${sourceIndex}">
                    ${escapeHtml(this._editorLabel("ed.camera.remove_expanded_action"))}
                  </button>
                </div>
                <div class="editor-grid editor-grid--stacked">
                  ${this._renderCameraEntityField("ed.camera.expanded_action_entity", `${prefix}.entity`, action.entity, "light,fan,humidifier,vacuum,cover,climate,lock,switch,input_boolean")}
                  ${this._renderTextField("ed.camera.expanded_action_name", `${prefix}.name`, action.name, { fullWidth: true })}
                  ${this._renderIconField("ed.camera.expanded_action_icon", `${prefix}.icon`, action.icon)}
                  ${this._renderTextField("ed.notifications.icon_color", `${prefix}.icon_color`, action.icon_color, { placeholder: "var(--primary-color)" })}
                  ${this._renderSelectField("ed.camera.expanded_action_tap", `${prefix}.tap_action`, action.tap_action || "toggle", [
    { value: "toggle", label: "ed.entity.tap_toggle" },
    { value: "more-info", label: "ed.entity.tap_more_info" },
    { value: "service", label: "ed.entity.tap_service" },
  ])}
                  ${String(action.tap_action) === "service"
    ? this._renderTextField("ed.entity.tap_service_field", `${prefix}.tap_service`, action.tap_service, { placeholder: "lock.open", fullWidth: true })
      + this._renderTextareaField("ed.entity.tap_service_data_json", `${prefix}.tap_service_data`, action.tap_service_data, { placeholder: "{}" })
    : ""}
                </div>
              </div>
              `;
  }).join("") : `<div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.expanded_actions_empty"))}</div>`}
            </div>
          `;
  }).join("") : `<div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.expanded_actions_empty"))}</div>`}
        </div>
      </section>
    `;
  }

  _renderCameraTapActionsSection(config) {
    const cameras = this._editorCameras().filter(Boolean);
    const actions = Array.isArray(config.camera_tap_actions) ? config.camera_tap_actions : [];
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div>
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.camera.tap_actions_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.tap_actions_section_hint"))}</div>
          </div>
        </div>
        <div class="editor-list">
          ${cameras.map((cameraId, index) => {
    const action = actions.find(item => item?.camera === cameraId) || { camera: cameraId, tap_action: "toggle" };
    const tapAction = String(action.tap_action || "toggle") === "auto"
      ? "more-info"
      : String(action.tap_action || "toggle");
    const cameraName = this._hass?.states?.[cameraId]?.attributes?.friendly_name || cameraId;
    const prefix = `camera_tap_actions.${index}`;
    return `
            <div class="editor-camera-group">
              <div class="editor-card__header"><strong>${escapeHtml(cameraName)}</strong></div>
              <div class="editor-grid editor-grid--stacked">
                ${this._renderSelectField("ed.camera.tap_action", `${prefix}.tap_action`, tapAction, [
    { value: "toggle", label: "ed.camera.tap_open_live" },
    { value: "more-info", label: "ed.entity.tap_more_info" },
    { value: "navigate", label: "ed.entity.tap_navigate" },
    { value: "url", label: "ed.entity.tap_open_url" },
    { value: "service", label: "ed.entity.tap_service" },
    { value: "none", label: "ed.entity.tap_none" },
  ])}
                ${tapAction === "service"
    ? this._renderTextField("ed.entity.tap_service_field", `${prefix}.tap_service`, action.tap_service, { placeholder: "camera.turn_on", fullWidth: true })
      + this._renderTextareaField("ed.entity.tap_service_data_json", `${prefix}.tap_service_data`, action.tap_service_data, { placeholder: `{\"entity_id\":\"${cameraId}\"}` })
    : ""}
                ${tapAction === "url"
    ? this._renderTextField("ed.entity.tap_url_field", `${prefix}.tap_url`, action.tap_url, { placeholder: "https://example.com", fullWidth: true })
      + this._renderCheckboxField("ed.entity.tap_new_tab", `${prefix}.tap_new_tab`, action.tap_new_tab === true)
    : ""}
                ${tapAction === "navigate"
    ? this._renderTextField("ed.entity.navigation_path", `${prefix}.navigation_path`, action.navigation_path, { placeholder: "/lovelace/cameras", fullWidth: true })
    : ""}
              </div>
            </div>
          `;
  }).join("")}
        </div>
      </section>
    `;
  }

  _renderCameraStreamsSection(config) {
    const cameras = this._editorCameras().filter(Boolean);
    const streams = Array.isArray(config.camera_streams) ? config.camera_streams : [];
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div>
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.camera.live_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.live_section_hint"))}</div>
          </div>
        </div>
        <div class="editor-list">
          ${cameras.map((cameraId, index) => {
    const stream = streams[index] || {};
    const provider = stream.provider || "home_assistant";
    const cameraName = this._hass?.states?.[cameraId]?.attributes?.friendly_name || cameraId;
    const prefix = `camera_streams.${index}`;
    return `
            <div class="editor-camera-group">
              <div class="editor-card__header"><strong>${escapeHtml(cameraName)}</strong></div>
              <div class="editor-grid editor-grid--stacked">
                ${this._renderSelectField("ed.camera.live_provider", `${prefix}.provider`, provider, [
    { value: "home_assistant", label: "ed.camera.live_provider_home_assistant" },
    { value: "frigate_go2rtc", label: "ed.camera.live_provider_frigate_go2rtc" },
    { value: "go2rtc", label: "ed.camera.live_provider_go2rtc" },
    { value: "iframe", label: "ed.camera.live_provider_iframe" },
  ])}
                ${provider === "home_assistant" ? `
                  ${this._renderCheckboxField("ed.camera.live_muted", `${prefix}.muted`, stream.muted !== false)}
                  ${this._renderCheckboxField("ed.camera.live_controls", `${prefix}.controls`, stream.controls === true)}
                ` : ""}
                ${provider === "frigate_go2rtc" ? `
                  ${this._renderTextField("ed.camera.live_stream_name", `${prefix}.stream`, stream.stream || cameraStreamName(cameraId), { placeholder: cameraStreamName(cameraId), fullWidth: true })}
                  ${this._renderTextField("ed.camera.live_frigate_client_id", `${prefix}.client_id`, stream.client_id || "frigate", { placeholder: "frigate", fullWidth: true })}
                  ${this._renderSelectField("ed.camera.live_mode", `${prefix}.mode`, stream.mode || "auto", [
    { value: "auto", label: "ed.camera.live_mode_auto" },
    { value: "webrtc", label: "ed.camera.live_mode_webrtc" },
    { value: "mse", label: "ed.camera.live_mode_mse" },
    { value: "hls", label: "ed.camera.live_mode_hls" },
    { value: "mjpeg", label: "ed.camera.live_mode_mjpeg" },
  ])}
                  ${this._renderCheckboxField("ed.camera.live_muted", `${prefix}.muted`, stream.muted !== false)}
                  ${this._renderCheckboxField("ed.camera.live_controls", `${prefix}.controls`, stream.controls === true)}
                ` : ""}
                ${provider === "go2rtc" ? `
                  ${this._renderTextField("ed.camera.live_base_url", `${prefix}.base_url`, stream.base_url, { placeholder: "http://frigate.local:1984", fullWidth: true })}
                  ${this._renderTextField("ed.camera.live_stream_name", `${prefix}.stream`, stream.stream || cameraStreamName(cameraId), { placeholder: cameraStreamName(cameraId), fullWidth: true })}
                  ${this._renderSelectField("ed.camera.live_mode", `${prefix}.mode`, stream.mode || "auto", [
    { value: "auto", label: "ed.camera.live_mode_auto" },
    { value: "webrtc", label: "ed.camera.live_mode_webrtc" },
    { value: "mse", label: "ed.camera.live_mode_mse" },
    { value: "hls", label: "ed.camera.live_mode_hls" },
    { value: "mjpeg", label: "ed.camera.live_mode_mjpeg" },
  ])}
                  ${this._renderCheckboxField("ed.camera.live_muted", `${prefix}.muted`, stream.muted !== false)}
                  ${this._renderCheckboxField("ed.camera.live_controls", `${prefix}.controls`, stream.controls === true)}
                ` : ""}
                ${provider === "iframe"
    ? this._renderTextField("ed.camera.live_url", `${prefix}.url`, stream.url, { placeholder: "https://camera.example/player", fullWidth: true })
    : ""}
              </div>
            </div>
          `;
  }).join("")}
        </div>
      </section>
    `;
  }

  _render() {
    this._syncEditorCameraStreams();
    this._syncEditorCameraTapActions();
    const config = this._config || mergeConfig(DEFAULT_CONFIG, {});

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        * { box-sizing: border-box; }
        .editor { color: var(--primary-text-color); display: grid; gap: 16px; }
        .editor-section {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 18px;
          display: grid;
          gap: 14px;
          padding: 16px;
        }
        .editor-section:last-child { margin-bottom: 0; }
        .editor-section__header { align-items: start; display: flex; gap: 12px; justify-content: space-between; }
        .editor-section__title { font-size: 15px; font-weight: 700; }
        .editor-section__hint { color: var(--secondary-text-color); font-size: 12px; line-height: 1.45; }
        .editor-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .editor-grid--stacked, .editor-field--full { grid-column: 1 / -1; }
        .editor-field, .editor-toggle { display: grid; gap: 6px; min-width: 0; }
        .editor-field > span, .editor-toggle > span:not(.editor-toggle__switch) {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 600;
        }
        .editor-field input, .editor-field select, .editor-field textarea {
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
        .editor-field textarea { min-height: 76px; resize: vertical; }
        .editor-control-host, .editor-control-host > * { display: block; width: 100%; }
        .editor-toggle {
          align-items: center;
          column-gap: 10px;
          cursor: pointer;
          grid-template-columns: auto minmax(0, 1fr);
          min-height: 40px;
          position: relative;
        }
        .editor-toggle input {
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
          display: inline-flex;
          height: 22px;
          position: relative;
          transition: background 160ms ease, border-color 160ms ease;
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
        .editor-section__actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .editor-section__header button,
        .editor-card__header button {
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
        .editor-section__header button.danger,
        .editor-card__header button.danger { color: var(--error-color); }
        .editor-section__header button:disabled { cursor: default; opacity: 0.45; }
        .editor-list { display: grid; gap: 12px; }
        .editor-camera-group { display: grid; gap: 10px; padding-block: 4px 12px; }
        .editor-camera-group + .editor-camera-group { border-top: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); padding-top: 16px; }
        .editor-card {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }
        .editor-card__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }
        @media (max-width: 640px) { .editor-grid { grid-template-columns: 1fr; } }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div>
              <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.camera.general_section_title"))}</div>
              <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.general_section_hint"))}</div>
            </div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderCameraEntityField("ed.camera.select_entity", "entity", config.entity)}
            ${this._renderTextField("ed.camera.name_placeholder", "name", config.name, { placeholder: "Entrada", fullWidth: true })}
            ${this._renderCheckboxField("ed.camera.show_name", "show_name", config.show_name !== false)}
            ${this._renderCheckboxField("ed.camera.show_state", "show_state", config.show_state !== false)}
            ${this._renderCheckboxField("ed.camera.show_status_chips", "show_status_chips", config.show_status_chips !== false)}
            ${this._renderCheckboxField("ed.camera.show_last_changed", "show_last_changed", config.show_last_changed !== false)}
            ${this._renderCheckboxField("ed.camera.show_preview_age", "show_preview_age", config.show_preview_age !== false)}
          </div>
        </section>
        ${this._renderCameraListSection(config)}
        ${this._renderCameraTapActionsSection(config)}
        ${this._renderCameraStreamsSection(config)}
        ${this._renderExpandedActionsSection(config)}
      </div>
    `;

    this.shadowRoot.querySelectorAll('[data-mounted-control="camera-entity"]').forEach(node => {
      this._mountCameraEntityPicker(node);
    });
    this.shadowRoot.querySelectorAll('[data-mounted-control="camera-icon"]').forEach(node => {
      this._mountIconPicker(node);
    });
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}
