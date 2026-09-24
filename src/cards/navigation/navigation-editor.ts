// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  compactConfig,
  deepClone,
  escapeHtml,
  fireEvent,
  isObject,
  mergeConfig,
} from "./navigation-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./navigation-config";
import {
  arrayFromCsv,
  deleteByPath,
  escapeSelectorValue,
  moveItem,
  parsePrimitiveValue,
  setByPath,
} from "./navigation-helpers";

let _lazyNodaliaNavigationBarEditor;
export function loadNodaliaNavigationBarEditor() {
  if (_lazyNodaliaNavigationBarEditor) {
    return _lazyNodaliaNavigationBarEditor;
  }
class NodaliaNavigationBarEditor extends HTMLElement {
  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = deepClone(STUB_CONFIG);
    this._hass = null;
    this._showStyleSection = false;
    this._showAnimationSection = false;
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    }

  _attachEditorShadowListeners() {
    window.NodaliaUtils.bindShadowListeners(this, [
      ["input", this._onShadowInput],
      ["change", this._onShadowInput],
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
    this._hass = hass;
    this.shadowRoot?.querySelectorAll("ha-entity-picker, ha-selector, ha-icon-picker").forEach(el => {
      if ("hass" in el) {
        el.hass = hass;
      }
    });
  }

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    const hass = this._hass ?? this.hass;
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", s);
  }

  _L(s) {
    return escapeHtml(this._editorLabel(s));
  }

  _renderControlDatasetAttributes(dataset = {}) {
    return Object.entries(dataset)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        const attr = String(key).replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
        return `data-${attr}="${escapeHtml(String(value))}"`;
      })
      .join(" ");
  }

  _renderEntityPickerField(label, dataset = {}, value = "", options = {}) {
    const datasetAttrs = this._renderControlDatasetAttributes(dataset);
    const placeholderAttr = options.placeholder ? `data-placeholder="${escapeHtml(options.placeholder)}"` : "";
    return `
      <label>
        <span>${this._L(label)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity-picker"
          data-value="${escapeHtml(String(value ?? ""))}"
          ${placeholderAttr}
          ${datasetAttrs}
        ></div>
      </label>
    `;
  }

  _renderIconPickerField(label, dataset = {}, value = "", options = {}) {
    const datasetAttrs = this._renderControlDatasetAttributes(dataset);
    const placeholderAttr = options.placeholder ? `data-placeholder="${escapeHtml(options.placeholder)}"` : "";
    return `
      <label>
        <span>${this._L(label)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="icon-picker"
          data-value="${escapeHtml(String(value ?? ""))}"
          ${placeholderAttr}
          ${datasetAttrs}
        ></div>
      </label>
    `;
  }

  _mountEntityPicker(host) {
    const playerField = host.dataset.playerField;
    const playerIndex = host.dataset.playerIndex;
    const field = host.dataset.field
      || (playerField && playerIndex !== undefined
        ? `media_player.players.${playerIndex}.${playerField}`
        : "entity");
    window.NodaliaUtils.mountEntityPickerHost(host, {
      hass: this._hass,
      field,
      value: host.dataset.value || "",
      placeholder: host.dataset.placeholder || "",
      onShadowInput: this._onShadowInput,
      onShadowValueChanged: this._onShadowInput,
      copyDatasetFromHost: true,
    });
  }

  _mountIconPicker(host) {
    window.NodaliaUtils.mountIconPickerHost(host, {
      hass: this._hass,
      value: host.dataset.value || "",
      placeholder: host.dataset.placeholder || "",
      onShadowInput: this._onShadowInput,
      onShadowValueChanged: this._onShadowInput,
      copyDatasetFromHost: true,
    });
  }

  _prepareEditorConfig(config) {
    if (!Array.isArray(config.routes)) {
      config.routes = [];
    }

    if (!isObject(config.layout)) {
      config.layout = {};
    }

    if (!isObject(config.haptics)) {
      config.haptics = {};
    }

    if (!isObject(config.animations)) {
      config.animations = {};
    }

    if (!isObject(config.media_player)) {
      config.media_player = {};
    }

    if (!Array.isArray(config.media_player.players)) {
      config.media_player.players = [];
    }

    return config;
  }

  setConfig(config) {
    const nextConfig = deepClone(config || STUB_CONFIG);
    if (!Array.isArray(nextConfig.routes) && Array.isArray(nextConfig.items)) {
      nextConfig.routes = nextConfig.items;
      delete nextConfig.items;
    }
    this._config = this._prepareEditorConfig(nextConfig);
    this._render();
  }

  _captureFocusState() {
    const activeElement = this.shadowRoot?.activeElement;

    if (
      !(
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement
      )
    ) {
      return null;
    }

    const dataset = activeElement.dataset || {};
    let selector = null;

    if (dataset.field) {
      selector = `[data-field="${escapeSelectorValue(dataset.field)}"]`;
    } else if (dataset.playerField && dataset.playerIndex !== undefined) {
      selector =
        `[data-player-index="${escapeSelectorValue(dataset.playerIndex)}"]` +
        `[data-player-field="${escapeSelectorValue(dataset.playerField)}"]`;
    } else if (
      dataset.popupField &&
      dataset.routeIndex !== undefined &&
      dataset.popupIndex !== undefined
    ) {
      selector =
        `[data-route-index="${escapeSelectorValue(dataset.routeIndex)}"]` +
        `[data-popup-index="${escapeSelectorValue(dataset.popupIndex)}"]` +
        `[data-popup-field="${escapeSelectorValue(dataset.popupField)}"]`;
    } else if (dataset.routeField && dataset.routeIndex !== undefined) {
      selector =
        `[data-route-index="${escapeSelectorValue(dataset.routeIndex)}"]` +
        `[data-route-field="${escapeSelectorValue(dataset.routeField)}"]`;
    }

    if (!selector) {
      return null;
    }

    const supportsSelection =
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
      // Ignore inputs that do not support selection ranges.
    }
  }

  _emitConfig(nextConfig) {
    const focusState = this._captureFocusState();
    const prepared = this._prepareEditorConfig(deepClone(nextConfig));
    this._config = compactConfig(prepared);
    this._render();
    this._restoreFocusState(focusState);
    const merged = mergeConfig(DEFAULT_CONFIG, prepared);
    fireEvent(this, "config-changed", {
      config: compactConfig(window.NodaliaUtils.stripEqualToDefaults(merged, DEFAULT_CONFIG) ?? {}),
    });
  }

  _setEditorConfig(nextConfig) {
    this._config = compactConfig(this._prepareEditorConfig(nextConfig));
  }

  _commitEditorConfig(nextConfig, shouldEmit) {
    if (shouldEmit) {
      this._emitConfig(nextConfig);
      return;
    }

    this._setEditorConfig(nextConfig);
  }

  _applyFieldValue(target, key, field) {
    if (!target || !key) {
      return;
    }
    if (window.NodaliaUtils?.isUnsafeConfigPathKey?.(key)) {
      return;
    }

    if (field.type === "checkbox" && field.dataset.checkedValue !== undefined) {
      if (field.checked) {
        target[key] = parsePrimitiveValue(field.dataset.checkedValue);
      } else if (field.dataset.uncheckedDelete === "true") {
        delete target[key];
      } else if (field.dataset.uncheckedValue !== undefined) {
        target[key] = parsePrimitiveValue(field.dataset.uncheckedValue);
      } else {
        target[key] = false;
      }
      return;
    }

    if (field.dataset.csv === "true") {
      const values = arrayFromCsv(field.value);
      if (values.length > 0) {
        target[key] = values;
      } else {
        delete target[key];
      }
      return;
    }

    if (field.type === "checkbox") {
      target[key] = field.checked;
      return;
    }

    if (field.value === "" && field.dataset.optional === "true") {
      delete target[key];
      return;
    }

    if (field.type === "number") {
      target[key] = Number(field.value);
      return;
    }

    target[key] = field.value;
  }

  _isHomeAssistantPicker(node) {
    const tag = String(node?.tagName || "").toUpperCase();
    return tag === "HA-ENTITY-PICKER" || tag === "HA-SELECTOR" || tag === "HA-ICON-PICKER";
  }

  _onShadowInput(event) {
    const shouldEmit = event.type === "change" || event.type === "value-changed";
    const playerField = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.playerField);

    if (playerField) {
      // Ignore picker blur/input; only value-changed has the committed entity.
      if (this._isHomeAssistantPicker(playerField) && event.type !== "value-changed") {
        return;
      }

      event.stopPropagation();
      const nextConfig = deepClone(this._config);
      this._prepareEditorConfig(nextConfig);
      const playerIndex = Number(playerField.dataset.playerIndex);
      const player = nextConfig.media_player.players[playerIndex];

      if (!player) {
        return;
      }

      if (playerField.dataset.playerField === "label") {
        delete player.name;
      }

      if (playerField.dataset.playerField === "browse_path") {
        delete player.media_browser_path;
      }

      const eventValue = event.detail?.value;
      if (event.type === "value-changed" && eventValue !== undefined) {
        playerField.value = eventValue ?? "";
        playerField.dataset.value = String(eventValue ?? "");
      }
      this._applyFieldValue(player, playerField.dataset.playerField, playerField);
      this._commitEditorConfig(nextConfig, shouldEmit);
      return;
    }

    const field = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.field);

    if (field) {
      const nextConfig = deepClone(this._config);
      const eventValue = event.detail?.value;
      const value = field.type === "checkbox"
        ? field.checked
        : event.type === "value-changed" && eventValue !== undefined
          ? eventValue ?? ""
          : field.value;

      if (value === "" && field.dataset.optional === "true") {
        deleteByPath(nextConfig, field.dataset.field);
      } else if (field.type === "number") {
        setByPath(nextConfig, field.dataset.field, Number(value));
      } else {
        setByPath(nextConfig, field.dataset.field, value);
      }

      this._commitEditorConfig(nextConfig, shouldEmit);
      return;
    }

    const routeField = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.routeField);

    if (routeField) {
      const routeIndex = Number(routeField.dataset.routeIndex);
      const nextConfig = deepClone(this._config);
      this._prepareEditorConfig(nextConfig);
      const route = nextConfig.routes[routeIndex];

      if (!route) {
        return;
      }

      this._applyFieldValue(route, routeField.dataset.routeField, routeField);
      this._commitEditorConfig(nextConfig, shouldEmit);
      return;
    }

    const popupField = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.popupField);

    if (!popupField) {
      return;
    }

    const nextConfig = deepClone(this._config);
    this._prepareEditorConfig(nextConfig);
    const routeIndex = Number(popupField.dataset.routeIndex);
    const popupIndex = Number(popupField.dataset.popupIndex);
    const route = nextConfig.routes[routeIndex];

    if (!route || !Array.isArray(route.popup)) {
      return;
    }

    const popupItem = route.popup[popupIndex];
    if (!popupItem) {
      return;
    }

    this._applyFieldValue(popupItem, popupField.dataset.popupField, popupField);
    this._commitEditorConfig(nextConfig, shouldEmit);
  }

  _onShadowClick(event) {
    const toggleButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorToggle);

    if (toggleButton) {
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

    const actionButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorAction);

    if (!actionButton) {
      return;
    }

    const nextConfig = deepClone(this._config);
    this._prepareEditorConfig(nextConfig);

    if (actionButton.dataset.editorAction === "add-route") {
      nextConfig.routes.push({
        icon: "mdi:circle-outline",
        label: `Ruta ${nextConfig.routes.length + 1}`,
        path: "/lovelace/nueva-ruta",
      });
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "remove-route") {
      const index = Number(actionButton.dataset.routeIndex);
      nextConfig.routes.splice(index, 1);
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "move-route-up") {
      const index = Number(actionButton.dataset.routeIndex);

      if (index <= 0 || index >= nextConfig.routes.length) {
        return;
      }

      nextConfig.routes = moveItem(nextConfig.routes, index, index - 1);
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "move-route-down") {
      const index = Number(actionButton.dataset.routeIndex);

      if (index < 0 || index >= nextConfig.routes.length - 1) {
        return;
      }

      nextConfig.routes = moveItem(nextConfig.routes, index, index + 1);
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "add-popup-item") {
      const routeIndex = Number(actionButton.dataset.routeIndex);
      const route = nextConfig.routes[routeIndex];

      if (!route) {
        return;
      }

      if (!Array.isArray(route.popup)) {
        route.popup = [];
      }

      route.popup.push({
        icon: "mdi:dots-circle",
        path: "/lovelace/nueva-ruta",
      });
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "remove-popup-item") {
      const routeIndex = Number(actionButton.dataset.routeIndex);
      const popupIndex = Number(actionButton.dataset.popupIndex);
      const route = nextConfig.routes[routeIndex];

      if (!route || !Array.isArray(route.popup)) {
        return;
      }

      route.popup.splice(popupIndex, 1);
      if (route.popup.length === 0) {
        delete route.popup;
      }
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "move-popup-item-up") {
      const routeIndex = Number(actionButton.dataset.routeIndex);
      const popupIndex = Number(actionButton.dataset.popupIndex);
      const route = nextConfig.routes[routeIndex];

      if (!route || !Array.isArray(route.popup) || popupIndex <= 0 || popupIndex >= route.popup.length) {
        return;
      }

      route.popup = moveItem(route.popup, popupIndex, popupIndex - 1);
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "move-popup-item-down") {
      const routeIndex = Number(actionButton.dataset.routeIndex);
      const popupIndex = Number(actionButton.dataset.popupIndex);
      const route = nextConfig.routes[routeIndex];

      if (!route || !Array.isArray(route.popup) || popupIndex < 0 || popupIndex >= route.popup.length - 1) {
        return;
      }

      route.popup = moveItem(route.popup, popupIndex, popupIndex + 1);
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "add-player") {
      nextConfig.media_player.players.push({
        entity: "",
      });
      this._emitConfig(nextConfig);
      return;
    }

    if (actionButton.dataset.editorAction === "remove-player") {
      const playerIndex = Number(actionButton.dataset.playerIndex);
      nextConfig.media_player.players.splice(playerIndex, 1);
      this._emitConfig(nextConfig);
    }
  }

  _renderPopupItem(routeIndex, popupItem, popupIndex, popupTotal) {
    return `
      <div class="sub-card">
        <div class="route-head route-head--sub">
          <strong>${this._L("ed.nav.popup_word")} ${popupIndex + 1}</strong>
          <div class="head-actions">
            <button
              type="button"
              class="secondary"
              data-editor-action="move-popup-item-up"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              ${popupIndex === 0 ? "disabled" : ""}
            >
              ${this._L("ed.notifications.move_up")}
            </button>
            <button
              type="button"
              class="secondary"
              data-editor-action="move-popup-item-down"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              ${popupIndex === popupTotal - 1 ? "disabled" : ""}
            >
              ${this._L("ed.notifications.move_down")}
            </button>
            <button
              type="button"
              class="danger"
              data-editor-action="remove-popup-item"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
            >
              ${this._L("ed.notifications.remove")}
            </button>
          </div>
        </div>
        <div class="grid">
          <label>
            <span>${this._L("ed.nav.label_optional")}</span>
            <input
              type="text"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              data-popup-field="label"
              data-optional="true"
              value="${escapeHtml(popupItem.label || "")}"
              placeholder="${escapeHtml(this._L("ed.nav.icon_optional_hint"))}"
            />
          </label>
          ${this._renderIconPickerField(
            "ed.entity.icon",
            {
              routeIndex,
              popupIndex,
              popupField: "icon",
            },
            popupItem.icon || "",
          )}
          <label>
            <span>${this._L("ed.nav.path")}</span>
            <input
              type="text"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              data-popup-field="path"
              value="${escapeHtml(popupItem.path || "")}"
            />
          </label>
          <label>
            <span>${this._L("ed.nav.description")}</span>
            <input
              type="text"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              data-popup-field="description"
              data-optional="true"
              value="${escapeHtml(popupItem.description || "")}"
            />
          </label>
          <label>
            <span>${this._L("ed.nav.users")}</span>
            <input
              type="text"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              data-popup-field="users"
              data-csv="true"
              data-optional="true"
              value="${escapeHtml((popupItem.users || []).join(", "))}"
              placeholder="id1, id2"
            />
          </label>
          <label>
            <span>${this._L("ed.nav.active_paths")}</span>
            <input
              type="text"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              data-popup-field="active_paths"
              data-csv="true"
              data-optional="true"
              value="${escapeHtml((popupItem.active_paths || []).join(", "))}"
              placeholder="/lovelace/seguridad/camaras"
            />
          </label>
          <label class="checkbox">
            <input
              type="checkbox"
              data-route-index="${routeIndex}"
              data-popup-index="${popupIndex}"
              data-popup-field="match"
              data-checked-value="prefix"
              data-unchecked-delete="true"
              ${popupItem.match === "prefix" ? "checked" : ""}
            />
            <span class="toggle-switch" aria-hidden="true"></span>
            <span>${this._L("ed.nav.active_by_prefix")}</span>
          </label>
        </div>
      </div>
    `;
  }

  _renderMediaPlayerPlayer(player, index) {
    return `
      <div class="route-card">
        <div class="route-head">
          <strong>${this._L("ed.nav.player_word")} ${index + 1}</strong>
          <button type="button" class="danger" data-editor-action="remove-player" data-player-index="${index}">
            ${this._L("ed.notifications.remove")}
          </button>
        </div>
        <div class="grid">
          ${this._renderEntityPickerField(
            "ed.entity.entity_main",
            {
              playerIndex: index,
              playerField: "entity",
            },
            player.entity || "",
            { placeholder: "media_player.spotify" },
          )}
          <label>
            <span>${this._L("ed.nav.player_name")}</span>
            <input
              type="text"
              data-player-index="${index}"
              data-player-field="label"
              data-optional="true"
              value="${escapeHtml(player.label || player.name || "")}"
              placeholder="HomePod mini Salon"
            />
          </label>
          <label>
            <span>${this._L("ed.nav.media_browse_path")}</span>
            <input
              type="text"
              data-player-index="${index}"
              data-player-field="browse_path"
              data-optional="true"
              value="${escapeHtml(player.browse_path || player.media_browser_path || "")}"
              placeholder="/media-browser/browser"
            />
          </label>
          <label>
            <span>${this._L("ed.nav.title")}</span>
            <input
              type="text"
              data-player-index="${index}"
              data-player-field="title"
              data-optional="true"
              value="${escapeHtml(player.title || "")}"
            />
          </label>
          <label>
            <span>${this._L("ed.nav.subtitle")}</span>
            <input
              type="text"
              data-player-index="${index}"
              data-player-field="subtitle"
              data-optional="true"
              value="${escapeHtml(player.subtitle || "")}"
            />
          </label>
          ${this._renderIconPickerField(
            "ed.person.fallback_icon",
            {
              playerIndex: index,
              playerField: "icon",
              optional: "true",
            },
            player.icon || "",
            { placeholder: "mdi:speaker" },
          )}
          <label>
            <span>${this._L("ed.nav.static_image")}</span>
            <input
              type="text"
              data-player-index="${index}"
              data-player-field="image"
              data-optional="true"
              value="${escapeHtml(player.image || "")}"
            />
          </label>
          <label>
            <span>${this._L("ed.nav.visible_states")}</span>
            <input
              type="text"
              data-player-index="${index}"
              data-player-field="show_states"
              data-csv="true"
              data-optional="true"
              value="${escapeHtml((player.show_states || []).join(", "))}"
              placeholder="playing, paused"
            />
          </label>
          <label class="checkbox">
            <input
              type="checkbox"
              data-player-index="${index}"
              data-player-field="show"
              data-checked-value="true"
              data-unchecked-delete="true"
              ${player.show === true ? "checked" : ""}
            />
            <span class="toggle-switch" aria-hidden="true"></span>
            <span>${this._L("ed.nav.show_always")}</span>
          </label>
        </div>
      </div>
    `;
  }

  _renderRoute(route, index, totalRoutes) {
    const popupMarkup = Array.isArray(route.popup) && route.popup.length > 0
      ? route.popup.map((popupItem, popupIndex) => this._renderPopupItem(index, popupItem, popupIndex, route.popup.length)).join("")
      : `<p class="hint">${this._L("ed.nav.no_route_popup")}</p>`;

    return `
      <div class="route-card">
        <div class="route-head">
          <strong>${this._L("ed.nav.route_word")} ${index + 1}</strong>
          <div class="head-actions">
            <button
              type="button"
              class="secondary"
              data-editor-action="move-route-up"
              data-route-index="${index}"
              ${index === 0 ? "disabled" : ""}
            >
              ${this._L("ed.notifications.move_up")}
            </button>
            <button
              type="button"
              class="secondary"
              data-editor-action="move-route-down"
              data-route-index="${index}"
              ${index === totalRoutes - 1 ? "disabled" : ""}
            >
              ${this._L("ed.notifications.move_down")}
            </button>
            <button type="button" class="danger" data-editor-action="remove-route" data-route-index="${index}">
              ${this._L("ed.notifications.remove")}
            </button>
          </div>
        </div>
        <div class="grid">
          <label>
            <span>${this._L("ed.entity.quick_label")}</span>
            <input type="text" data-route-index="${index}" data-route-field="label" value="${escapeHtml(route.label || "")}" />
          </label>
          ${this._renderIconPickerField(
            "ed.entity.icon",
            {
              routeIndex: index,
              routeField: "icon",
            },
            route.icon || "",
          )}
          <label>
            <span>${this._L("ed.nav.path")}</span>
            <input type="text" data-route-index="${index}" data-route-field="path" value="${escapeHtml(route.path || "")}" />
          </label>
          <label>
            <span>${this._L("ed.nav.extra_active_path")}</span>
            <input
              type="text"
              data-route-index="${index}"
              data-route-field="active_paths"
              data-csv="true"
              data-optional="true"
              value="${escapeHtml((route.active_paths || []).join(", "))}"
              placeholder="/lovelace/principal/subvista"
            />
          </label>
          <label>
            <span>${this._L("ed.nav.users")}</span>
            <input
              type="text"
              data-route-index="${index}"
              data-route-field="users"
              data-csv="true"
              data-optional="true"
              value="${escapeHtml((route.users || []).join(", "))}"
              placeholder="id1, id2"
            />
          </label>
          <label>
            <span>${this._L("ed.nav.layout_popup")}</span>
            <select data-route-index="${index}" data-route-field="popup_layout" data-optional="true">
              <option value="" ${!route.popup_layout ? "selected" : ""}>${this._L("ed.nav.layout_auto")}</option>
              <option value="vertical" ${route.popup_layout === "vertical" ? "selected" : ""}>${this._L("ed.nav.layout_vertical")}</option>
              <option value="horizontal" ${route.popup_layout === "horizontal" ? "selected" : ""}>${this._L("ed.nav.layout_horizontal")}</option>
            </select>
          </label>
          <label class="checkbox">
            <input
              type="checkbox"
              data-route-index="${index}"
              data-route-field="match"
              data-checked-value="prefix"
              data-unchecked-delete="true"
              ${route.match === "prefix" ? "checked" : ""}
            />
            <span class="toggle-switch" aria-hidden="true"></span>
            <span>${this._L("ed.nav.active_prefix_route")}</span>
          </label>
        </div>
        <div class="subsection">
          <div class="route-head route-head--subsection">
            <strong>${this._L("ed.nav.popup_word")}</strong>
            <button type="button" data-editor-action="add-popup-item" data-route-index="${index}">
              ${this._L("ed.nav.add_popup")}
            </button>
          </div>
          ${popupMarkup}
        </div>
      </div>
    `;
  }

  _render() {
    const config = normalizeConfig(this._config || STUB_CONFIG);
    const routesMarkup = config.routes.map((route, index) => this._renderRoute(route, index, config.routes.length)).join("");
    const playersMarkup = (config.media_player?.players || [])
      .map((player, index) => this._renderMediaPlayerPlayer(player, index))
      .join("");
    const animationEnabled = config.animations?.enabled !== false;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        .editor {
          display: grid;
          gap: 16px;
          padding: 8px 0;
        }

        .editor-section,
        .route-card,
        .sub-card {
          background: color-mix(in srgb, var(--primary-text-color) 2%, var(--card-background-color, var(--ha-card-background, #fff)));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 18px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          padding: 16px;
        }

        .editor-section__header {
          display: grid;
          gap: 4px;
          margin-bottom: 12px;
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

        .route-head {
          align-items: center;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .route-head--subsection,
        .route-head--sub {
          margin-bottom: 10px;
        }

        .head-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .editor-grid,
        .grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .subsection {
          border-top: 1px solid var(--divider-color);
          margin-top: 16px;
          padding-top: 16px;
        }

        .sub-card {
          background: rgba(127, 127, 127, 0.08);
          margin-top: 10px;
        }

        label {
          color: var(--primary-text-color);
          display: grid;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          min-width: 0;
        }

        label span {
          color: var(--secondary-text-color);
          font-weight: 600;
        }

        label:has(> .editor-control-host[data-mounted-control="entity-picker"]),
        label:has(> .editor-control-host[data-mounted-control="icon-picker"]),
        label:has(> ha-entity-picker),
        label:has(> ha-icon-picker),
        label:has(> ha-selector) {
          grid-column: 1 / -1;
        }

        input,
        select {
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

        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }

        .checkbox {
          align-items: center;
          column-gap: 10px;
          cursor: pointer;
          grid-template-columns: auto minmax(0, 1fr);
          min-height: 40px;
          position: relative;
        }

        .checkbox input {
          margin: 0;
          opacity: 0;
          pointer-events: none;
          position: absolute;
          width: 1px;
          min-height: 1px;
        }

        .checkbox .toggle-switch {
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

        .checkbox .toggle-switch::before {
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

        .checkbox input:checked + .toggle-switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }

        .checkbox input:checked + .toggle-switch::before {
          transform: translateX(18px);
        }

        .checkbox input:focus-visible + .toggle-switch {
          box-shadow:
            0 0 0 3px color-mix(in srgb, var(--primary-text-color) 14%, transparent),
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }

        button {
          background: var(--primary-color);
          border: 0;
          border-radius: 999px;
          color: var(--text-primary-color, #fff);
          cursor: pointer;
          min-height: 34px;
          padding: 0 14px;
        }

        button.danger {
          background: var(--error-color);
        }

        button.secondary {
          background: var(--secondary-background-color);
          border: 1px solid var(--divider-color);
          color: var(--primary-text-color);
        }

        button[disabled] {
          cursor: default;
          opacity: 0.45;
        }

        .hint {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.4;
        }

        @media (max-width: 640px) {
          .editor-grid,
          .grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${this._L("ed.weather.general_section_title")}</div>
            <div class="editor-section__hint">${this._L("ed.nav.general_hint")}</div>
          </div>
          <div class="editor-grid">
            <label>
              <span>${this._L("ed.nav.title_bar")}</span>
              <input type="text" data-field="title" data-optional="true" value="${escapeHtml(config.title || "")}" />
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="haptics.enabled" ${config.haptics.enabled ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("ed.nav.haptic_response")}</span>
            </label>
            <label>
              <span>${this._L("ed.nav.haptic_style")}</span>
              <select data-field="haptics.style">
                <option value="selection" ${config.haptics.style === "selection" ? "selected" : ""}>${this._L("ed.weather.haptic_selection")}</option>
                <option value="light" ${config.haptics.style === "light" ? "selected" : ""}>${this._L("ed.weather.haptic_light")}</option>
                <option value="medium" ${config.haptics.style === "medium" ? "selected" : ""}>${this._L("ed.weather.haptic_medium")}</option>
                <option value="heavy" ${config.haptics.style === "heavy" ? "selected" : ""}>${this._L("ed.weather.haptic_heavy")}</option>
                <option value="success" ${config.haptics.style === "success" ? "selected" : ""}>${this._L("ed.weather.haptic_success")}</option>
                <option value="warning" ${config.haptics.style === "warning" ? "selected" : ""}>${this._L("ed.weather.haptic_warning")}</option>
                <option value="failure" ${config.haptics.style === "failure" ? "selected" : ""}>${this._L("ed.weather.haptic_failure")}</option>
              </select>
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="haptics.fallback_vibrate" ${config.haptics.fallback_vibrate ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("ed.nav.vibrate_fallback")}</span>
            </label>
            <label>
              <span>${this._L("ed.nav.breakpoint_mobile")}</span>
              <input type="number" data-field="layout.mobile_breakpoint" value="${escapeHtml(config.layout.mobile_breakpoint || 1279)}" />
            </label>
            <label>
              <span>${this._L("ed.nav.position")}</span>
              <select data-field="layout.position">
                <option value="bottom" ${config.layout.position === "bottom" ? "selected" : ""}>${this._L("ed.nav.position_bottom")}</option>
                <option value="top" ${config.layout.position === "top" ? "selected" : ""}>${this._L("ed.nav.position_top")}</option>
              </select>
            </label>
            <label>
              <span>${this._L("ed.media_player.layout_offset")}</span>
              <input type="text" data-field="layout.offset" value="${escapeHtml(config.layout.offset || "")}" />
            </label>
            <label>
              <span>${this._L("ed.nav.side_margin")}</span>
              <input type="text" data-field="layout.side_margin" value="${escapeHtml(config.layout.side_margin || "")}" />
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="layout.full_width" ${config.layout.full_width ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("ed.nav.bar_full_width")}</span>
            </label>
            <label>
              <span>${this._L("ed.nav.stack_gap")}</span>
              <input type="text" data-field="layout.stack_gap" value="${escapeHtml(config.layout.stack_gap || "")}" />
            </label>
            <label>
              <span>${this._L("ed.nav.reserve_height")}</span>
              <input type="text" data-field="layout.reserve_height" value="${escapeHtml(config.layout.reserve_height || "")}" />
            </label>
            <label>
              <span>${this._L("ed.media_player.layout_z_index")}</span>
              <input type="number" data-field="layout.z_index" value="${escapeHtml(config.layout.z_index || 2)}" />
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="show_labels" ${config.show_labels ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("ed.nav.show_labels")}</span>
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="layout.fixed" ${config.layout.fixed ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("ed.nav.fixed_screen")}</span>
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="layout.reserve_space" ${config.layout.reserve_space ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("ed.nav.reserve_space")}</span>
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="layout.show_desktop" ${config.layout.show_desktop ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("ed.nav.show_desktop")}</span>
            </label>
          </div>
          <p class="hint">
            ${this._L("ed.nav.hint_yaml")}
          </p>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${this._L("ed.weather.animations_section_title")}</div>
            <div class="editor-section__hint">${this._L("ed.nav.anim_hint")}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${this._showAnimationSection ? this._L("ed.weather.hide_animation_settings") : this._L("ed.weather.show_animation_settings")}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  <label class="checkbox">
                    <input type="checkbox" data-field="animations.enabled" ${animationEnabled ? "checked" : ""} />
                    <span class="toggle-switch" aria-hidden="true"></span>
                    <span>${this._L("ed.vacuum.enable_animations")}</span>
                  </label>
                  <label>
                    <span>${this._L("ed.nav.anim_bar_hover_ms")}</span>
                    <input type="number" data-field="animations.bar_duration" value="${escapeHtml(config.animations.bar_duration || DEFAULT_CONFIG.animations.bar_duration)}" />
                  </label>
                  <label>
                    <span>${this._L("ed.nav.anim_bar_enter_ms")}</span>
                    <input type="number" data-field="animations.dock_entrance_duration" value="${escapeHtml(config.animations.dock_entrance_duration ?? DEFAULT_CONFIG.animations.dock_entrance_duration)}" />
                  </label>
                  <label>
                    <span>${this._L("ed.nav.anim_popup_ms")}</span>
                    <input type="number" data-field="animations.popup_duration" value="${escapeHtml(config.animations.popup_duration || DEFAULT_CONFIG.animations.popup_duration)}" />
                  </label>
                  <label>
                    <span>${this._L("ed.nav.anim_media_ms")}</span>
                    <input type="number" data-field="animations.media_duration" value="${escapeHtml(config.animations.media_duration || DEFAULT_CONFIG.animations.media_duration)}" />
                  </label>
                  <label>
                    <span>${this._L("ed.nav.anim_button_ms")}</span>
                    <input type="number" data-field="animations.button_bounce_duration" value="${escapeHtml(config.animations.button_bounce_duration || DEFAULT_CONFIG.animations.button_bounce_duration)}" />
                  </label>
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${this._L("ed.weather.styles_section_title")}</div>
            <div class="editor-section__hint">${this._L("ed.nav.styles_hint")}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${this._showStyleSection ? this._L("ed.weather.hide_style_settings") : this._L("ed.weather.show_style_settings")}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  <label><span>${this._L("ed.nav.style_bar_bg")}</span><input type="text" data-field="styles.bar.background" value="${escapeHtml(config.styles.bar.background || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_bar_border")}</span><input type="text" data-field="styles.bar.border" value="${escapeHtml(config.styles.bar.border || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_bar_radius")}</span><input type="text" data-field="styles.bar.border_radius" value="${escapeHtml(config.styles.bar.border_radius || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_bar_shadow")}</span><input type="text" data-field="styles.bar.box_shadow" value="${escapeHtml(config.styles.bar.box_shadow || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_bar_padding")}</span><input type="text" data-field="styles.bar.padding" value="${escapeHtml(config.styles.bar.padding || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_bar_min_height")}</span><input type="text" data-field="styles.bar.min_height" value="${escapeHtml(config.styles.bar.min_height || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_bar_gap")}</span><input type="text" data-field="styles.bar.gap" value="${escapeHtml(config.styles.bar.gap || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_justify")}</span><input type="text" data-field="styles.bar.justify_content" value="${escapeHtml(config.styles.bar.justify_content || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_bar_max_width")}</span><input type="text" data-field="styles.bar.max_width" value="${escapeHtml(config.styles.bar.max_width || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_bar_backdrop")}</span><input type="text" data-field="styles.bar.backdrop_filter" value="${escapeHtml(config.styles.bar.backdrop_filter || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_button_bg")}</span><input type="text" data-field="styles.button.background" value="${escapeHtml(config.styles.button.background || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_button_color")}</span><input type="text" data-field="styles.button.color" value="${escapeHtml(config.styles.button.color || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_active_color")}</span><input type="text" data-field="styles.button.active_color" value="${escapeHtml(config.styles.button.active_color || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_active_bg")}</span><input type="text" data-field="styles.button.active_background" value="${escapeHtml(config.styles.button.active_background || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_button_radius")}</span><input type="text" data-field="styles.button.border_radius" value="${escapeHtml(config.styles.button.border_radius || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_button_size")}</span><input type="text" data-field="styles.button.size" value="${escapeHtml(config.styles.button.size || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_button_icon_size")}</span><input type="text" data-field="styles.button.icon_size" value="${escapeHtml(config.styles.button.icon_size || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_button_icon_off_x")}</span><input type="text" data-field="styles.button.icon_offset_x" value="${escapeHtml(config.styles.button.icon_offset_x || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_button_icon_off_y")}</span><input type="text" data-field="styles.button.icon_offset_y" value="${escapeHtml(config.styles.button.icon_offset_y || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_button_label_color")}</span><input type="text" data-field="styles.button.label_color" value="${escapeHtml(config.styles.button.label_color || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_button_label_active")}</span><input type="text" data-field="styles.button.active_label_color" value="${escapeHtml(config.styles.button.active_label_color || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_button_label_size")}</span><input type="text" data-field="styles.button.label_size" value="${escapeHtml(config.styles.button.label_size || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_button_label_gap")}</span><input type="text" data-field="styles.button.label_gap" value="${escapeHtml(config.styles.button.label_gap || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_badge_bg")}</span><input type="text" data-field="styles.badge.background" value="${escapeHtml(config.styles.badge.background || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_badge_color")}</span><input type="text" data-field="styles.badge.color" value="${escapeHtml(config.styles.badge.color || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_badge_min")}</span><input type="text" data-field="styles.badge.min_size" value="${escapeHtml(config.styles.badge.min_size || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_badge_font")}</span><input type="text" data-field="styles.badge.font_size" value="${escapeHtml(config.styles.badge.font_size || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_popup_bg")}</span><input type="text" data-field="styles.popup.background" value="${escapeHtml(config.styles.popup.background || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_popup_border")}</span><input type="text" data-field="styles.popup.border" value="${escapeHtml(config.styles.popup.border || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_popup_radius")}</span><input type="text" data-field="styles.popup.border_radius" value="${escapeHtml(config.styles.popup.border_radius || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_popup_shadow")}</span><input type="text" data-field="styles.popup.box_shadow" value="${escapeHtml(config.styles.popup.box_shadow || "")}" /></label>
                  <label>
                    <span>${this._L("ed.nav.layout_popup")}</span>
                    <select data-field="styles.popup.layout" data-optional="true">
                      <option value="" ${!config.styles.popup.layout || config.styles.popup.layout === "auto" ? "selected" : ""}>${this._L("ed.nav.layout_auto")}</option>
                      <option value="vertical" ${config.styles.popup.layout === "vertical" ? "selected" : ""}>${this._L("ed.nav.layout_vertical")}</option>
                      <option value="horizontal" ${config.styles.popup.layout === "horizontal" ? "selected" : ""}>${this._L("ed.nav.layout_horizontal")}</option>
                    </select>
                  </label>
                  <label><span>${this._L("ed.nav.style_popup_padding")}</span><input type="text" data-field="styles.popup.padding" value="${escapeHtml(config.styles.popup.padding || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_popup_min_w")}</span><input type="text" data-field="styles.popup.min_width" value="${escapeHtml(config.styles.popup.min_width || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_popup_max_w")}</span><input type="text" data-field="styles.popup.max_width" value="${escapeHtml(config.styles.popup.max_width || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_popup_item_size")}</span><input type="text" data-field="styles.popup.item_size" value="${escapeHtml(config.styles.popup.item_size || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_popup_label")}</span><input type="text" data-field="styles.popup.label_size" value="${escapeHtml(config.styles.popup.label_size || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_popup_item_gap")}</span><input type="text" data-field="styles.popup.item_gap" value="${escapeHtml(config.styles.popup.item_gap || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_popup_backdrop")}</span><input type="text" data-field="styles.popup.backdrop" value="${escapeHtml(config.styles.popup.backdrop || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_media_bg")}</span><input type="text" data-field="styles.media_player.background" value="${escapeHtml(config.styles.media_player.background || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_media_border")}</span><input type="text" data-field="styles.media_player.border" value="${escapeHtml(config.styles.media_player.border || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_media_radius")}</span><input type="text" data-field="styles.media_player.border_radius" value="${escapeHtml(config.styles.media_player.border_radius || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_media_shadow")}</span><input type="text" data-field="styles.media_player.box_shadow" value="${escapeHtml(config.styles.media_player.box_shadow || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_media_padding")}</span><input type="text" data-field="styles.media_player.padding" value="${escapeHtml(config.styles.media_player.padding || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_media_min_h")}</span><input type="text" data-field="styles.media_player.min_height" value="${escapeHtml(config.styles.media_player.min_height || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_media_artwork")}</span><input type="text" data-field="styles.media_player.artwork_size" value="${escapeHtml(config.styles.media_player.artwork_size || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_media_controls")}</span><input type="text" data-field="styles.media_player.control_size" value="${escapeHtml(config.styles.media_player.control_size || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_media_title")}</span><input type="text" data-field="styles.media_player.title_size" value="${escapeHtml(config.styles.media_player.title_size || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_media_subtitle")}</span><input type="text" data-field="styles.media_player.subtitle_size" value="${escapeHtml(config.styles.media_player.subtitle_size || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_media_progress")}</span><input type="text" data-field="styles.media_player.progress_color" value="${escapeHtml(config.styles.media_player.progress_color || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_media_progress_bg")}</span><input type="text" data-field="styles.media_player.progress_background" value="${escapeHtml(config.styles.media_player.progress_background || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_media_overlay")}</span><input type="text" data-field="styles.media_player.overlay_color" value="${escapeHtml(config.styles.media_player.overlay_color || "")}" /></label>
                  <label><span>${this._L("ed.nav.style_media_dot")}</span><input type="text" data-field="styles.media_player.dot_size" value="${escapeHtml(config.styles.media_player.dot_size || "")}" /></label>
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${this._L("ed.nav.media_player_section")}</div>
            <div class="editor-section__hint">${this._L("ed.nav.media_section_hint")}</div>
            <div class="editor-section__actions">
              <button type="button" data-editor-action="add-player">${this._L("ed.nav.add_player")}</button>
            </div>
          </div>
          <div class="editor-grid">
            <label class="checkbox">
              <input type="checkbox" data-field="media_player.show_desktop" ${config.media_player.show_desktop ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("ed.nav.show_desktop")}</span>
            </label>
            <label class="checkbox">
              <input type="checkbox" data-field="media_player.album_cover_background" ${config.media_player.album_cover_background ? "checked" : ""} />
              <span class="toggle-switch" aria-hidden="true"></span>
              <span>${this._L("ed.nav.cover_art_background")}</span>
            </label>
            <label>
              <span>${this._L("ed.nav.reserve_height")}</span>
              <input type="text" data-field="media_player.reserve_height" value="${escapeHtml(config.media_player.reserve_height || "")}" />
            </label>
            <label>
              <span>${this._L("ed.nav.media_gap_nav")}</span>
              <input type="text" data-field="media_player.gap" value="${escapeHtml(config.media_player.gap || "")}" />
            </label>
            <label>
              <span>${this._L("ed.nav.style_media_artwork")}</span>
              <input type="text" data-field="styles.media_player.artwork_size" value="${escapeHtml(config.styles.media_player.artwork_size || "")}" />
            </label>
            <label>
              <span>${this._L("ed.nav.style_media_controls")}</span>
              <input type="text" data-field="styles.media_player.control_size" value="${escapeHtml(config.styles.media_player.control_size || "")}" />
            </label>
            <label>
              <span>${this._L("ed.nav.style_media_title")}</span>
              <input type="text" data-field="styles.media_player.title_size" value="${escapeHtml(config.styles.media_player.title_size || "")}" />
            </label>
            <label>
              <span>${this._L("ed.nav.style_media_subtitle")}</span>
              <input type="text" data-field="styles.media_player.subtitle_size" value="${escapeHtml(config.styles.media_player.subtitle_size || "")}" />
            </label>
          </div>
          <div class="subsection">
            ${playersMarkup || `<p class="hint">${this._L("ed.nav.empty_players")}</p>`}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${this._L("ed.nav.routes_title")}</div>
            <div class="editor-section__hint">${this._L("ed.nav.routes_hint")}</div>
            <div class="editor-section__actions">
              <button type="button" data-editor-action="add-route">${this._L("ed.nav.add_route")}</button>
            </div>
          </div>
          ${routesMarkup || `<p class="hint">${this._L("ed.nav.empty_routes")}</p>`}
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="entity-picker"]')
      .forEach(host => this._mountEntityPicker(host));

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="icon-picker"]')
      .forEach(host => this._mountIconPicker(host));
  }
}
  _lazyNodaliaNavigationBarEditor = NodaliaNavigationBarEditor;
  return NodaliaNavigationBarEditor;
}
