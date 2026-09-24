// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { CUSTOMIZABLE_EMBED_LISTS } from "./room-summary-constants";
import {
  deepClone,
  escapeHtml,
  getByPath,
  isObject,
  mergeConfig,
} from "./room-summary-runtime";
import { DEFAULT_CONFIG, hubMediaPlayerIds, normalizeConfig } from "./room-summary-config";
import {
  fireEvent,
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
  moveListItem,
  setByPath,
  stripEqualToDefaults,
} from "./room-summary-helpers";

let _lazyNodaliaRoomSummaryCardEditor;
export function loadNodaliaRoomSummaryCardEditor() {
  if (_lazyNodaliaRoomSummaryCardEditor) {
    return _lazyNodaliaRoomSummaryCardEditor;
  }
class NodaliaRoomSummaryCardEditor extends HTMLElement {
  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = mergeConfig(DEFAULT_CONFIG, {});
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showStyleSection = false;
    this._editorShadowListenersAttached = false;
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onMediaConfigChanged = this._onMediaConfigChanged.bind(this);
    this._onCameraConfigChanged = this._onCameraConfigChanged.bind(this);
    }

  connectedCallback() {
    this._attachEditorShadowListeners();
    window.NodaliaUtils?.bindEditorDialogLayoutFix?.(this);
  }

  disconnectedCallback() {
    this._detachEditorShadowListeners();
    window.NodaliaUtils?.releaseEditorDialogLayoutFix?.(this);
  }

  _attachEditorShadowListeners() {
    window.NodaliaUtils.bindShadowListeners(this, [
      ["input", this._onShadowInput],
      ["change", this._onShadowInput],
      ["click", this._onShadowClick],
      ["value-changed", this._onShadowValueChanged],
    ], "editor");
  }

  _detachEditorShadowListeners() {
    window.NodaliaUtils.releaseShadowListeners(this, "editor");
  }

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    this._render();
    this._restoreFocusState(focusState);
  }

  set hass(hass) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender = !this._hass || nextSignature !== this._entityOptionsSignature || !this.shadowRoot?.innerHTML;
    this._hass = hass;
    this._entityOptionsSignature = nextSignature;
    if (!shouldRender) {
      this.shadowRoot?.querySelectorAll('[data-mounted-control="entity"]').forEach(host => this._mountEntityPicker(host));
      this.shadowRoot?.querySelectorAll("nodalia-media-player-editor").forEach(editor => { editor.hass = hass; });
      this.shadowRoot?.querySelectorAll("nodalia-camera-card-editor").forEach(editor => { editor.hass = hass; });
      return;
    }
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils?.editorStatesSignature?.(hass, this._config?.language ?? "auto") || "";
  }

  _captureFocusState() {
    return window.NodaliaUtils.captureEditorFocusState(this);
  }

  _restoreFocusState(focusState) {
    window.NodaliaUtils.restoreEditorFocusState(this, focusState);
  }

  _watchEditorControlTag(tagName) {
    if (!tagName || this._pendingEditorControlTags.has(tagName)) {
      return;
    }
    if (typeof customElements?.whenDefined !== "function" || customElements.get(tagName)) {
      return;
    }
    this._pendingEditorControlTags.add(tagName);
    customElements
      .whenDefined(tagName)
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
    this._watchEditorControlTag("nodalia-media-player-editor");
    this._watchEditorControlTag("nodalia-camera-card-editor");
  }

  _editorLabel(key) {
    return window.NodaliaI18n?.editorStr?.(this._hass, this._config?.language ?? "auto", key) || key;
  }

  _emitConfig(reRender = false) {
    const outgoing = stripEqualToDefaults(normalizeConfig(deepClone(this._config)), DEFAULT_CONFIG);
    fireEvent(this, "config-changed", { config: outgoing || {} });
    if (reRender) {
      this._render();
    }
  }

  _onShadowInput(e) {
    const input = e.composedPath().find(n => n instanceof HTMLInputElement || n instanceof HTMLSelectElement || n instanceof HTMLTextAreaElement);
    if (!input?.dataset?.field) return;
    e.stopPropagation();
    let value = input.type === "checkbox" ? input.checked : input.value;
    if (input.dataset.valueType === "color" && input instanceof HTMLInputElement) {
      value = formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
    }
    setByPath(this._config, input.dataset.field, value);
    if (e.type === "change") this._emitConfig(false);
  }

  _onShadowValueChanged(e) {
    const nestedEditor = e.composedPath().find(node =>
      node instanceof HTMLElement
      && (node.localName === "nodalia-media-player-editor" || node.localName === "nodalia-camera-card-editor")
    );
    if (nestedEditor) return;
    const host = e.composedPath().find(node => node instanceof HTMLElement && node.dataset?.field);
    if (!host?.dataset?.field) {
      return;
    }
    e.stopPropagation();
    setByPath(this._config, host.dataset.field, String(e.detail?.value || "").trim());
    if (host.dataset.field === "camera") {
      const camera = String(this._config.camera || "").trim();
      if (!isObject(this._config.camera_config)) this._config.camera_config = {};
      this._config.camera_config.entity = camera;
      const cameras = Array.isArray(this._config.camera_config.cameras)
        ? this._config.camera_config.cameras.map(id => String(id || "").trim()).filter(Boolean)
        : [];
      if (camera && !cameras.includes(camera)) {
        this._config.camera_config.cameras = [camera, ...cameras];
      }
      this._emitConfig(true);
      return;
    }
    this._emitConfig(false);
  }

  _onShadowClick(e) {
    const btn = e.composedPath().find(n => n instanceof HTMLElement && n.dataset?.act);
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const list = btn.dataset.list;
    const idx = Number(btn.dataset.index);
    if (btn.dataset.act === "add" && list) {
      if (!Array.isArray(this._config[list])) this._config[list] = [];
      this._config[list].push("");
      if (CUSTOMIZABLE_EMBED_LISTS.has(list)) {
        if (!Array.isArray(this._config.embed_options?.[list])) this._config.embed_options[list] = [];
        this._config.embed_options[list].push({ entity: "", name: "", icon: "" });
      }
      this._emitConfig(true);
      return;
    }
    if (btn.dataset.act === "remove" && list && Number.isInteger(idx)) {
      if (!Array.isArray(this._config[list])) this._config[list] = [];
      this._config[list].splice(idx, 1);
      if (CUSTOMIZABLE_EMBED_LISTS.has(list) && Array.isArray(this._config.embed_options?.[list])) {
        this._config.embed_options[list].splice(idx, 1);
      }
      this._emitConfig(true);
      return;
    }
    if (btn.dataset.act === "move-up" && list && Number.isInteger(idx)) {
      if (!Array.isArray(this._config[list])) this._config[list] = [];
      moveListItem(this._config[list], idx, idx - 1);
      if (CUSTOMIZABLE_EMBED_LISTS.has(list) && Array.isArray(this._config.embed_options?.[list])) {
        moveListItem(this._config.embed_options[list], idx, idx - 1);
      }
      this._emitConfig(true);
      return;
    }
    if (btn.dataset.act === "move-down" && list && Number.isInteger(idx)) {
      if (!Array.isArray(this._config[list])) this._config[list] = [];
      moveListItem(this._config[list], idx, idx + 1);
      if (CUSTOMIZABLE_EMBED_LISTS.has(list) && Array.isArray(this._config.embed_options?.[list])) {
        moveListItem(this._config.embed_options[list], idx, idx + 1);
      }
      this._emitConfig(true);
      return;
    }
    if (btn.dataset.act === "toggle-styles") {
      this._showStyleSection = !this._showStyleSection;
      this._emitConfig(true);
    }
  }

  _editorList(listKey) {
    return Array.isArray(this._config[listKey]) ? this._config[listKey] : [];
  }

  _mediaEditorConfig() {
    const native = isObject(this._config?.media_config) ? deepClone(this._config.media_config) : {};
    if (!Array.isArray(native.players) || !native.players.length) {
      native.players = hubMediaPlayerIds(this._config).map(entity => ({ entity }));
    }
    return native;
  }

  _onMediaConfigChanged(event) {
    event.stopPropagation();
    const mediaConfig = isObject(event.detail?.config) ? deepClone(event.detail.config) : {};
    const ids = (mediaConfig.players || []).map(player => String(player?.entity || "").trim()).filter(Boolean);
    this._config.media_config = mediaConfig;
    this._config.media_player = ids[0] || "";
    this._config.media_players = ids.slice(1);
    this._emitConfig(false);
  }

  _cameraEditorConfig() {
    const native = isObject(this._config?.camera_config) ? deepClone(this._config.camera_config) : {};
    const camera = String(this._config?.camera || native.entity || "").trim();
    if (camera) {
      native.entity = camera;
      const cameras = Array.isArray(native.cameras)
        ? native.cameras.map(id => String(id || "").trim()).filter(Boolean)
        : [];
      if (!cameras.includes(camera)) {
        native.cameras = [camera, ...cameras];
      }
    }
    return native;
  }

  _onCameraConfigChanged(event) {
    event.stopPropagation();
    const cameraConfig = isObject(event.detail?.config) ? deepClone(event.detail.config) : {};
    this._config.camera_config = cameraConfig;
    this._config.camera = String(
      cameraConfig.entity
      || (Array.isArray(cameraConfig.cameras) ? cameraConfig.cameras[0] : "")
      || "",
    ).trim();
    this._emitConfig(false);
  }

  _entityLabel(entityId) {
    const id = String(entityId || "").trim();
    if (!id) {
      return this._editorLabel("ed.room_summary.entity");
    }
    const friendly = String(this._hass?.states?.[id]?.attributes?.friendly_name || "").trim();
    return friendly && friendly !== id ? `${friendly} (${id})` : id;
  }

  _field(label, field, value, opts = {}) {
    return `<label class="editor-field ${opts.full ? "editor-field--full" : ""}"><span>${escapeHtml(this._editorLabel(label))}</span>
      <input data-field="${escapeHtml(field)}" value="${escapeHtml(value ?? "")}" placeholder="${escapeHtml(opts.ph ? this._editorLabel(opts.ph) : "")}" /></label>`;
  }

  _check(label, field, checked) {
    return `<label class="editor-toggle">
      <input type="checkbox" data-field="${escapeHtml(field)}" ${checked ? "checked" : ""} />
      <span class="editor-toggle__switch" aria-hidden="true"></span>
      <span>${escapeHtml(this._editorLabel(label))}</span>
    </label>`;
  }

  _select(label, field, value, options) {
    return `<label class="editor-field"><span>${escapeHtml(this._editorLabel(label))}</span><select data-field="${escapeHtml(field)}">
      ${options.map(o => `<option value="${escapeHtml(o.v)}" ${String(value) === o.v ? "selected" : ""}>${escapeHtml(this._editorLabel(o.l))}</option>`).join("")}
    </select></label>`;
  }

  _entity(label, field, value, domains = []) {
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `<label class="editor-field editor-field--full"><span>${escapeHtml(this._editorLabel(label))}</span>
      <div
        class="editor-control-host"
        data-mounted-control="entity"
        data-field="${escapeHtml(field)}"
        data-value="${escapeHtml(inputValue)}"
        data-include-domains="${escapeHtml(domains.join(","))}"
      ></div></label>`;
  }

  _iconField(label, field, value) {
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `<div class="editor-field">
      <span>${escapeHtml(this._editorLabel(label))}</span>
      <div
        class="editor-control-host"
        data-mounted-control="icon-picker"
        data-field="${escapeHtml(field)}"
        data-value="${escapeHtml(inputValue)}"
      ></div>
    </div>`;
  }

  _renderColorField(label, field, value, options = {}) {
    const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
    const currentValue = value === undefined || value === null || value === ""
      ? fallbackValue
      : String(value);
    const colorModel = getEditorColorModel(currentValue, fallbackValue);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(this._editorLabel(label))}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="${escapeHtml(this._editorLabel("ed.entity.custom_color"))}">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="color"
              data-alpha="${escapeHtml(String(colorModel.alpha))}"
              value="${escapeHtml(colorModel.hex)}"
              aria-label="${escapeHtml(this._editorLabel(label))}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>`;
  }

  _listSection(title, hint, listKey, domains, customizable = false) {
    const rows = this._editorList(listKey);
    const total = rows.length;
    const moveUp = this._editorLabel("ed.notifications.move_up");
    const moveDown = this._editorLabel("ed.notifications.move_down");
    return `<section class="editor-section editor-section--nested"><div class="editor-section__header">
      <div><div class="editor-section__title">${escapeHtml(this._editorLabel(title))}</div>
      <div class="editor-section__hint">${escapeHtml(this._editorLabel(hint))}</div></div>
      <button type="button" data-act="add" data-list="${escapeHtml(listKey)}">${escapeHtml(this._editorLabel("ed.room_summary.add_entity"))}</button></div>
      ${rows.length ? rows.map((id, i) => {
    const option = this._config.embed_options?.[listKey]?.[i] || {};
    return `<div class="item-card"><div class="item-card__header">
        <span class="item-card__title">${escapeHtml(this._entityLabel(id))}</span>
        <div class="item-card__actions">
          <button type="button" data-act="move-up" data-list="${escapeHtml(listKey)}" data-index="${i}" ${i === 0 ? "disabled" : ""} title="${escapeHtml(moveUp)}">↑</button>
          <button type="button" data-act="move-down" data-list="${escapeHtml(listKey)}" data-index="${i}" ${i >= total - 1 ? "disabled" : ""} title="${escapeHtml(moveDown)}">↓</button>
          <button type="button" class="danger" data-act="remove" data-list="${escapeHtml(listKey)}" data-index="${i}">${escapeHtml(this._editorLabel("ed.room_summary.remove_entity"))}</button>
        </div></div>
        ${this._entity("ed.room_summary.entity", `${listKey}.${i}`, id, domains)}
        ${customizable ? `<div class="editor-grid item-card__customization">
          ${this._field("ed.entity.name", `embed_options.${listKey}.${i}.name`, option.name, { full: true })}
          ${this._iconField("ed.entity.icon", `embed_options.${listKey}.${i}.icon`, option.icon)}
        </div>` : ""}</div>`;
  }).join("") : `<div class="empty">${escapeHtml(this._editorLabel("ed.room_summary.list_empty"))}</div>`}
    </section>`;
  }

  _mediaConfigSection() {
    return `<section class="editor-section editor-section--nested">
      <div class="editor-section__header"><div>
        <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.room_summary.media_players_section_title"))}</div>
        <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.room_summary.media_players_section_hint"))}</div>
      </div></div>
      <div class="native-editor-host" data-mounted-control="media-config-editor"></div>
    </section>`;
  }

  _cameraConfigSection() {
    return `<section class="editor-section editor-section--nested">
      <div class="editor-section__header"><div>
        <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.room_summary.camera_section_title"))}</div>
        <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.room_summary.camera_section_hint"))}</div>
      </div></div>
      <div class="native-editor-host" data-mounted-control="camera-config-editor"></div>
    </section>`;
  }

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) return;
    window.NodaliaUtils?.mountEntityPickerHost?.(host, {
      hass: this._hass,
      field: host.dataset.field || "entity",
      value: host.dataset.value || getByPath(this._config, host.dataset.field || "") || "",
      onShadowInput: this._onShadowInput,
      onShadowValueChanged: this._onShadowValueChanged,
      copyDatasetFromHost: true,
    });
    const domains = String(host.dataset.includeDomains || "").split(",").map(item => item.trim()).filter(Boolean);
    const picker = host.querySelector("ha-entity-picker");
    if (picker && domains.length) {
      picker.includeDomains = domains;
    }
  }

  _mountIconPicker(host) {
    window.NodaliaUtils?.mountIconPickerHost?.(host, {
      hass: this._hass,
      value: host.dataset.value || getByPath(this._config, host.dataset.field || "") || "",
      onShadowInput: this._onShadowInput,
      onShadowValueChanged: this._onShadowValueChanged,
      copyDatasetFromHost: true,
    });
  }

  _mountMediaConfigEditor(host) {
    if (!(host instanceof HTMLElement)) return;
    if (!customElements.get("nodalia-media-player-editor")) {
      this._watchEditorControlTag("nodalia-media-player-editor");
      return;
    }
    try {
      const editor = document.createElement("nodalia-media-player-editor");
      editor.addEventListener("config-changed", this._onMediaConfigChanged);
      editor.hass = this._hass;
      editor.setConfig(this._mediaEditorConfig());
      host.replaceChildren(editor);
    } catch (error) {
      console.warn("[nodalia-room-summary-card] media editor mount failed", error);
    }
  }

  _mountCameraConfigEditor(host) {
    if (!(host instanceof HTMLElement)) return;
    if (!customElements.get("nodalia-camera-card-editor")) {
      this._watchEditorControlTag("nodalia-camera-card-editor");
      return;
    }
    try {
      const editor = document.createElement("nodalia-camera-card-editor");
      editor.addEventListener("config-changed", this._onCameraConfigChanged);
      editor.hass = this._hass;
      editor.setConfig(this._cameraEditorConfig());
      host.replaceChildren(editor);
    } catch (error) {
      console.warn("[nodalia-room-summary-card] camera editor mount failed", error);
    }
  }

  _render() {
    const c = this._config || {};
    this.shadowRoot.innerHTML = `<style>
      :host { display: block; overflow-anchor: none; }
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
      .editor-section--nested {
        background: color-mix(in srgb, var(--primary-text-color) 1.5%, transparent);
        border-radius: 14px;
        padding: 12px;
      }
      .editor-section__header { align-items: start; display: flex; gap: 10px; justify-content: space-between; }
      .editor-section__title { font-size: 15px; font-weight: 700; }
      .editor-section__hint { color: var(--secondary-text-color); font-size: 12px; line-height: 1.45; }
      .editor-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .editor-field, .editor-toggle { display: grid; gap: 6px; min-width: 0; }
      .editor-field--full { grid-column: 1 / -1; }
      .editor-field > span, .editor-toggle > span:not(.editor-toggle__switch) {
        color: var(--secondary-text-color);
        font-size: 12px;
        font-weight: 600;
      }
      .editor-field input, .editor-field select {
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
      .editor-control-host, .editor-control-host > * { display: block; width: 100%; }
      .native-editor-host, .native-editor-host > * { display: block; min-width: 0; width: 100%; }
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
      button.danger { color: var(--error-color); }
      button:disabled { cursor: default; opacity: 0.45; }
      .item-card__actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .item-card {
        background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
        border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
        border-radius: 14px;
        display: grid;
        gap: 10px;
        padding: 12px;
      }
      .item-card__header { align-items: center; display: flex; gap: 10px; justify-content: space-between; }
      .item-card__title { font-size: 13px; font-weight: 700; }
      .empty { color: var(--secondary-text-color); font-size: 12px; line-height: 1.45; }
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
        width: 100%;
      }
      .editor-color-swatch {
        background: var(--editor-swatch, var(--primary-color));
        border: 1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent);
        border-radius: 999px;
        display: block;
        height: 28px;
        width: 28px;
      }
      @media (max-width: 640px) { .editor-grid { grid-template-columns: 1fr; } }
    </style><div class="editor">
      <section class="editor-section">
        <div class="editor-section__header">
          <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.room_summary.general_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.room_summary.general_section_hint"))}</div>
        </div>
        <div class="editor-grid">
        ${this._field("ed.room_summary.name", "name", c.name, { ph: "ed.room_summary.name_placeholder", full: true })}
        ${this._iconField("ed.room_summary.icon", "icon", c.icon)}
        ${this._field("ed.room_summary.image", "image", c.image, { full: true })}
      </div></section>
      <section class="editor-section">
        <div class="editor-section__header">
          <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.room_summary.entities_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.room_summary.entities_section_hint"))}</div>
        </div>
        <div class="editor-grid">
        ${this._entity("ed.room_summary.temperature_entity", "temperature", c.temperature, ["sensor"])}
        ${this._entity("ed.room_summary.humidity_entity", "humidity", c.humidity, ["sensor"])}
        ${this._entity("ed.room_summary.presence_entity", "presence", c.presence, ["binary_sensor", "device_tracker", "person"])}
        ${this._entity("ed.room_summary.climate_entity", "climate", c.climate, ["climate"])}
        ${this._entity("ed.room_summary.power_entity", "power", c.power, ["sensor"])}
        ${this._entity("ed.room_summary.air_quality_entity", "air_quality", c.air_quality, ["sensor"])}
      </div>
      ${this._cameraConfigSection()}
      ${this._mediaConfigSection()}
      ${this._listSection("ed.room_summary.lights_section_title", "ed.room_summary.lights_section_hint", "lights", ["light"], true)}
      ${this._listSection("ed.room_summary.covers_section_title", "ed.room_summary.covers_section_hint", "covers", ["cover"])}
      ${this._listSection("ed.room_summary.vacuums_section_title", "ed.room_summary.vacuums_section_hint", "vacuums", ["vacuum"], true)}
      ${this._listSection("ed.room_summary.fans_section_title", "ed.room_summary.fans_section_hint", "fans", ["fan"], true)}
      ${this._listSection("ed.room_summary.humidifiers_section_title", "ed.room_summary.humidifiers_section_hint", "humidifiers", ["humidifier"], true)}
      ${this._listSection("ed.room_summary.others_section_title", "ed.room_summary.others_section_hint", "others", [], true)}
      ${this._listSection("ed.room_summary.doors_section_title", "ed.room_summary.doors_section_hint", "doors", ["binary_sensor"])}
      ${this._listSection("ed.room_summary.windows_section_title", "ed.room_summary.windows_section_hint", "windows", ["binary_sensor"])}
      ${this._listSection("ed.room_summary.locks_section_title", "ed.room_summary.locks_section_hint", "locks", ["lock"])}
      ${this._listSection("ed.room_summary.alerts_section_title", "ed.room_summary.alerts_section_hint", "alerts", ["binary_sensor"])}
      ${this._listSection("ed.room_summary.alarms_section_title", "ed.room_summary.alarms_section_hint", "alarms", ["alarm_control_panel"])}
      </section>
      <section class="editor-section">
        <div class="editor-section__header">
          <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.room_summary.display_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.room_summary.display_section_hint"))}</div>
        </div>
        <div class="editor-grid">
        ${this._check("ed.room_summary.show_temperature", "show_temperature", c.show_temperature)}
        ${this._check("ed.room_summary.show_humidity", "show_humidity", c.show_humidity)}
        ${this._check("ed.room_summary.show_presence", "show_presence", c.show_presence)}
        ${this._check("ed.room_summary.show_climate", "show_climate", c.show_climate)}
        ${this._check("ed.room_summary.show_lights", "show_lights", c.show_lights)}
        ${this._check("ed.room_summary.show_covers", "show_covers", c.show_covers)}
        ${this._check("ed.room_summary.show_camera", "show_camera", c.show_camera)}
        ${this._check("ed.room_summary.show_media", "show_media", c.show_media)}
        ${this._check("ed.room_summary.show_security", "show_security", c.show_security)}
        ${this._check("ed.room_summary.show_power", "show_power", c.show_power)}
        ${this._check("ed.room_summary.show_quick_actions", "show_quick_actions", c.show_quick_actions)}
        ${this._check("ed.room_summary.collapsible", "collapsible", c.collapsible)}
      </div></section>
      <section class="editor-section">
        <div class="editor-section__header">
          <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.room_summary.actions_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.room_summary.actions_section_hint"))}</div>
        </div>
        <div class="editor-grid">
        ${this._select("ed.room_summary.tap_action", "tap_action", c.tap_action, [
          { v: "none", l: "ed.room_summary.tap_none" },
          { v: "more-info", l: "ed.room_summary.tap_more_info" },
          { v: "navigate", l: "ed.room_summary.tap_navigate" },
        ])}
        ${this._field("ed.room_summary.navigation_path", "navigation_path", c.navigation_path, { full: true, ph: "ed.room_summary.navigation_path" })}
      </div></section>
      <section class="editor-section">
        <div class="editor-section__header">
          <div>
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.styles_section_hint"))}</div>
          </div>
          <button type="button" data-act="toggle-styles">
            ${escapeHtml(this._showStyleSection ? this._editorLabel("ed.weather.hide_style_settings") : this._editorLabel("ed.weather.show_style_settings"))}
          </button>
        </div>
        ${this._showStyleSection ? `<div class="editor-grid">
          ${this._renderColorField("ed.entity.style_accent_color", "styles.accent", c.styles?.accent)}
          ${this._renderColorField("ed.entity.style_card_bg", "styles.card.background", c.styles?.card?.background)}
          ${this._renderColorField("ed.room_summary.style_embed_off_tint", "styles.embed_off_tint", c.styles?.embed_off_tint)}
          ${this._field("ed.room_summary.style_title_size", "styles.title_size", c.styles?.title_size)}
          <div class="editor-section__hint editor-field--full">${escapeHtml(this._editorLabel("ed.room_summary.hub_styles_section_hint"))}</div>
          ${this._field("ed.room_summary.style_hub_metric_chip_font", "styles.hub.metric_chip_font_size", c.styles?.hub?.metric_chip_font_size)}
          ${this._field("ed.room_summary.style_hub_metric_chip_height", "styles.hub.metric_chip_height", c.styles?.hub?.metric_chip_height)}
          ${this._field("ed.room_summary.style_hub_metric_chip_padding", "styles.hub.metric_chip_padding", c.styles?.hub?.metric_chip_padding)}
          ${this._field("ed.room_summary.style_hub_metric_chip_icon", "styles.hub.metric_chip_icon_size", c.styles?.hub?.metric_chip_icon_size)}
          ${this._field("ed.room_summary.style_hub_context_action_size", "styles.hub.context_action_size", c.styles?.hub?.context_action_size)}
          ${this._field("ed.room_summary.style_hub_context_action_icon", "styles.hub.context_action_icon_size", c.styles?.hub?.context_action_icon_size)}
          ${this._field("ed.room_summary.style_hub_embed_title_size", "styles.hub.embed_title_size", c.styles?.hub?.embed_title_size)}
          ${this._field("ed.room_summary.style_hub_embed_chip_font", "styles.hub.embed_chip_font_size", c.styles?.hub?.embed_chip_font_size)}
          ${this._field("ed.room_summary.style_hub_embed_chip_height", "styles.hub.embed_chip_height", c.styles?.hub?.embed_chip_height)}
          ${this._field("ed.room_summary.style_hub_embed_chip_padding", "styles.hub.embed_chip_padding", c.styles?.hub?.embed_chip_padding)}
          ${this._field("ed.room_summary.style_hub_device_name_size", "styles.hub.device_name_size", c.styles?.hub?.device_name_size)}
          ${this._field("ed.room_summary.style_hub_device_state_size", "styles.hub.device_state_size", c.styles?.hub?.device_state_size)}
        </div>` : ""}
      </section>
    </div>`;
    this._detachEditorShadowListeners();
    this._attachEditorShadowListeners();
    this.shadowRoot.querySelectorAll('[data-mounted-control="entity"]').forEach(host => this._mountEntityPicker(host));
    this.shadowRoot.querySelectorAll('[data-mounted-control="icon-picker"]').forEach(host => this._mountIconPicker(host));
    this.shadowRoot.querySelectorAll('[data-mounted-control="media-config-editor"]').forEach(host => this._mountMediaConfigEditor(host));
    this.shadowRoot.querySelectorAll('[data-mounted-control="camera-config-editor"]').forEach(host => this._mountCameraConfigEditor(host));
    this._ensureEditorControlsReady();
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}
  _lazyNodaliaRoomSummaryCardEditor = NodaliaRoomSummaryCardEditor;
  return NodaliaRoomSummaryCardEditor;
}
