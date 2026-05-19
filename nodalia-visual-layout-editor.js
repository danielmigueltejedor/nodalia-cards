/**
 * Shared visual layout editor for Nodalia card editors (drag blocks on a grid → YAML).
 * Exposed as window.NodaliaVisualLayout.
 */
(function initNodaliaVisualLayout() {
  if (typeof window !== "undefined" && window.NodaliaVisualLayout?.attachEditorOverlay) {
    return;
  }

  const DEFAULT_COLUMNS = 12;
  const DEFAULT_ROWS = 10;
  const DRAG_THRESHOLD_PX = 6;

  function clampInt(value, min, max) {
    const numeric = Math.round(Number(value));
    if (!Number.isFinite(numeric)) {
      return min;
    }
    return Math.min(Math.max(numeric, min), max);
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getCatalogDef(catalog, id) {
    return catalog?.[id] || null;
  }

  function normalizeItem(raw, catalog, columns, rows) {
    const id = String(raw?.id ?? "").trim();
    const def = getCatalogDef(catalog, id);
    if (!def) {
      return null;
    }
    const base = def.default || { x: 0, y: 0, w: 4, h: 1 };
    const w = clampInt(raw?.w ?? base.w, 1, columns);
    const h = clampInt(raw?.h ?? base.h, 1, rows);
    const x = clampInt(raw?.x ?? base.x, 0, Math.max(0, columns - w));
    const y = clampInt(raw?.y ?? base.y, 0, Math.max(0, rows - h));
    const color = String(raw?.color ?? base.color ?? "").trim();
    return {
      id,
      x,
      y,
      w,
      h,
      visible: raw?.visible !== false,
      ...(color ? { color } : {}),
    };
  }

  function normalizeLayout(rawLayout, catalog, options = {}) {
    const columns = clampInt(rawLayout?.columns ?? options.columns ?? DEFAULT_COLUMNS, 4, 24);
    const rows = clampInt(rawLayout?.rows ?? options.rows ?? DEFAULT_ROWS, 4, 32);
    const enabled = rawLayout?.enabled === true;
    const rawItems = Array.isArray(rawLayout?.items) ? rawLayout.items : [];
    const items = [];
    const seen = new Set();

    rawItems.forEach(entry => {
      const normalized = normalizeItem(entry, catalog, columns, rows);
      if (!normalized || seen.has(normalized.id)) {
        return;
      }
      seen.add(normalized.id);
      items.push(normalized);
    });

    return {
      enabled,
      columns,
      rows,
      items,
    };
  }

  function defaultLayoutFromCatalog(catalog, columns = DEFAULT_COLUMNS, rows = DEFAULT_ROWS) {
    return {
      enabled: true,
      columns,
      rows,
      items: Object.keys(catalog)
        .map(id => normalizeItem({ id }, catalog, columns, rows))
        .filter(Boolean),
    };
  }

  function layoutToGridStyle(layout) {
    return [
      "display:grid",
      `grid-template-columns:repeat(${layout.columns}, minmax(0, 1fr))`,
      "grid-auto-rows:minmax(28px, auto)",
      "gap:10px",
      "align-items:stretch",
    ].join(";");
  }

  function itemToGridStyle(item) {
    const tint = item.color ? `--block-tint:${item.color};` : "";
    return `grid-column:${item.x + 1} / span ${item.w};grid-row:${item.y + 1} / span ${item.h};min-width:0;${tint}`;
  }

  function renderPlacedBlocks(blocksById, layout, options = {}) {
    const wrapClass = options.wrapClass || "nodalia-vlayout-item";
    return layout.items
      .filter(item => item.visible !== false)
      .map(item => {
        const markup = blocksById[item.id];
        if (!markup) {
          return "";
        }
        return `<div class="${wrapClass}" data-vlayout-id="${item.id}" style="${itemToGridStyle(item)}">${markup}</div>`;
      })
      .join("");
  }

  function rectsOverlap(a, b) {
    return !(
      a.x + a.w <= b.x
      || b.x + b.w <= a.x
      || a.y + a.h <= b.y
      || b.y + b.h <= a.y
    );
  }

  function findOpenCell(layout, item, excludeId) {
    for (let y = 0; y <= layout.rows - item.h; y += 1) {
      for (let x = 0; x <= layout.columns - item.w; x += 1) {
        const candidate = { ...item, x, y };
        const collision = layout.items.some(other => {
          if (other.id === excludeId || other.visible === false) {
            return false;
          }
          return rectsOverlap(candidate, other);
        });
        if (!collision) {
          return { x, y };
        }
      }
    }
    return { x: item.x, y: item.y };
  }

  function serializeLayoutForSave(layout) {
    return {
      enabled: true,
      columns: layout.columns,
      rows: layout.rows,
      items: layout.items
        .filter(item => item.visible !== false)
        .map(item => {
          const out = { id: item.id, x: item.x, y: item.y, w: item.w, h: item.h };
          if (item.color) {
            out.color = item.color;
          }
          return out;
        }),
    };
  }

  function resolveEditorLayout(rawLayout, catalog, options = {}) {
    let layout = normalizeLayout(rawLayout || {}, catalog, options);
    const hasBlocks = layout.items.some(item => item.visible !== false);
    if (!hasBlocks) {
      layout = defaultLayoutFromCatalog(
        catalog,
        layout.columns || options.columns,
        layout.rows || options.rows,
      );
    }
    return layout;
  }

  function openOverlayDialog(panelMarkup) {
    const existing = document.querySelector("dialog[data-nodalia-vlayout-overlay]");
    if (existing) {
      existing.close();
      existing.remove();
    }

    const dialog = document.createElement("dialog");
    dialog.className = "nodalia-vlayout-dialog";
    dialog.setAttribute("data-nodalia-vlayout-overlay", "true");
    dialog.innerHTML = panelMarkup;
    document.body.appendChild(dialog);
    dialog.showModal();
    return dialog;
  }

  class VisualLayoutSurface {
    constructor(host, options) {
      this._host = host;
      this._options = options;
      this._catalog = options.catalog || {};
      this._draft = normalizeLayout(options.layout || {}, this._catalog, options);
      this._selectedId = this._draft.items.find(item => item.visible !== false)?.id || "";
      this._drag = null;
      this._canvasGap = 6;
      this._canvasPad = 10;
      this._onCanvasPointerDown = this._onCanvasPointerDown.bind(this);
      this._onCanvasPointerMove = this._onCanvasPointerMove.bind(this);
      this._onCanvasPointerUp = this._onCanvasPointerUp.bind(this);
      this._livePreview = options.livePreview || null;
      this._cardEl = null;
      this._liveSyncTimer = null;
    }

    get layout() {
      return this._draft;
    }

    _isLiveMode() {
      return typeof this._livePreview?.getConfig === "function";
    }

    _getLiveGrid() {
      return this._cardEl?.shadowRoot?.querySelector(".light-card__visual-grid") || null;
    }

    _getLivePlacedNodes() {
      const root = this._cardEl?.shadowRoot;
      if (!root) {
        return [];
      }
      return [...root.querySelectorAll(".light-card__visual-item[data-vlayout-id]")];
    }

    _syncLiveCardConfig() {
      if (!this._isLiveMode() || !this._cardEl) {
        return;
      }
      const base = this._livePreview.getConfig() || {};
      const previewConfig = deepClone(base);
      previewConfig.visual_layout = deepClone(this._draft);
      previewConfig.visual_layout.enabled = true;
      if (this._livePreview.hass !== undefined) {
        this._cardEl.hass = this._livePreview.hass;
      }
      this._cardEl.setAttribute("data-vlayout-editing", "true");
      this._cardEl.setConfig(previewConfig);
      window.requestAnimationFrame(() => {
        this._syncAllPlacedDom();
        this._bindCanvasListeners();
      });
    }

    _scheduleLiveSync() {
      if (!this._isLiveMode()) {
        return;
      }
      if (this._liveSyncTimer) {
        window.cancelAnimationFrame(this._liveSyncTimer);
      }
      this._liveSyncTimer = window.requestAnimationFrame(() => {
        this._liveSyncTimer = null;
        this._syncLiveCardConfig();
      });
    }

    _label(id) {
      const def = getCatalogDef(this._catalog, id);
      if (!def) {
        return id;
      }
      if (typeof this._options.labelFor === "function") {
        return this._options.labelFor(def.labelKey || id, def.fallbackLabel || id);
      }
      return def.fallbackLabel || id;
    }

    _propsLabel(key, fallback) {
      if (typeof this._options.labelFor === "function") {
        return this._options.labelFor(key, fallback);
      }
      return fallback;
    }

    _blockSupports(id, prop) {
      const def = getCatalogDef(this._catalog, id);
      return Boolean(def?.props?.[prop]);
    }

    _renderBlockPreview(id) {
      if (typeof this._options.renderBlockPreview === "function") {
        return this._options.renderBlockPreview(id, this._draft);
      }
      const item = this._getItem(id);
      const tint = item?.color ? ` style="--preview-tint:${item.color}"` : "";
      return `<div class="nodalia-vlayout-block-preview"${tint}>${this._label(id)}</div>`;
    }

    _getCanvasMetrics() {
      const canvas = this._isLiveMode()
        ? this._getLiveGrid()
        : this._host.querySelector(".nodalia-vlayout-canvas");
      if (!canvas) {
        return null;
      }
      const rect = canvas.getBoundingClientRect();
      const cols = this._draft.columns;
      const rows = this._draft.rows;
      const computed = typeof window !== "undefined" ? window.getComputedStyle(canvas) : null;
      const gap = this._isLiveMode()
        ? Number.parseFloat(computed?.rowGap || computed?.gap || "10") || 10
        : this._canvasGap;
      const pad = this._isLiveMode() ? 0 : this._canvasPad;
      const innerW = Math.max(1, rect.width - pad * 2 - gap * Math.max(0, cols - 1));
      const innerH = Math.max(1, rect.height - pad * 2 - gap * Math.max(0, rows - 1));
      return {
        canvas,
        rect,
        cols,
        rows,
        gap,
        pad,
        cellW: innerW / cols,
        cellH: innerH / rows,
      };
    }

    _cellFromPointer(clientX, clientY, item = null) {
      const metrics = this._getCanvasMetrics();
      if (!metrics) {
        return null;
      }
      const { rect, cols, rows, gap, pad, cellW, cellH } = metrics;
      const relX = clientX - rect.left - pad;
      const relY = clientY - rect.top - pad;
      let x = Math.floor(relX / (cellW + gap));
      let y = Math.floor(relY / (cellH + gap));
      if (item) {
        x = clampInt(x, 0, cols - item.w);
        y = clampInt(y, 0, rows - item.h);
      } else {
        x = clampInt(x, 0, cols - 1);
        y = clampInt(y, 0, rows - 1);
      }
      return { x, y };
    }

    _applyItemStyleToDom(item) {
      const selector = `[data-vlayout-id="${item.id}"]`;
      const node = this._isLiveMode()
        ? this._cardEl?.shadowRoot?.querySelector(`.light-card__visual-item${selector}`)
        : this._host.querySelector(`.nodalia-vlayout-placed${selector}`);
      if (!node) {
        return;
      }
      node.style.gridColumn = `${item.x + 1} / span ${item.w}`;
      node.style.gridRow = `${item.y + 1} / span ${item.h}`;
      if (item.color) {
        node.style.setProperty("--block-tint", item.color);
      } else {
        node.style.removeProperty("--block-tint");
      }
      if (!this._isLiveMode()) {
        if (item.color) {
          node.style.borderColor = `color-mix(in srgb, ${item.color} 40%, transparent)`;
          node.style.background = `color-mix(in srgb, ${item.color} 12%, transparent)`;
        }
        node.classList.toggle("is-selected", item.id === this._selectedId);
      } else {
        node.classList.toggle("is-vlayout-selected", item.id === this._selectedId);
        node.classList.remove("is-selected");
      }
    }

    _syncAllPlacedDom() {
      this._draft.items
        .filter(item => item.visible !== false)
        .forEach(item => this._applyItemStyleToDom(item));
      if (this._isLiveMode()) {
        this._getLivePlacedNodes().forEach(node => {
          const id = node.dataset.vlayoutId;
          if (!this._draft.items.some(item => item.id === id && item.visible !== false)) {
            return;
          }
          node.classList.toggle("is-vlayout-selected", id === this._selectedId);
        });
      }
    }

    _renderPropertiesPanel() {
      const item = this._getItem(this._selectedId);
      if (!item) {
        return `
          <div class="nodalia-vlayout-props-empty">
            ${this._propsLabel("ed.light.vlayout_props_select", "Tap a block to edit size and color.")}
          </div>
        `;
      }

      const colorField = this._blockSupports(item.id, "color")
        ? `
          <label class="nodalia-vlayout-field">
            <span>${this._propsLabel("ed.light.vlayout_props_color", "Accent color")}</span>
            <input type="color" data-vlayout-prop="color" value="${item.color || "#6da8ff"}" />
          </label>
        `
        : "";

      return `
        <div class="nodalia-vlayout-props">
          <div class="nodalia-vlayout-props__title">${this._label(item.id)}</div>
          <div class="nodalia-vlayout-prop-actions">
            <button type="button" data-vlayout-resize="w-1">−W</button>
            <button type="button" data-vlayout-resize="w+1">+W</button>
            <button type="button" data-vlayout-resize="h-1">−H</button>
            <button type="button" data-vlayout-resize="h+1">+H</button>
            <button type="button" data-vlayout-resize="full">${this._propsLabel("ed.light.vlayout_props_full_width", "Full width")}</button>
          </div>
          <label class="nodalia-vlayout-field">
            <span>${this._propsLabel("ed.light.vlayout_props_width", "Width (columns)")}</span>
            <input type="number" min="1" max="${this._draft.columns}" data-vlayout-prop="w" value="${item.w}" />
          </label>
          <label class="nodalia-vlayout-field">
            <span>${this._propsLabel("ed.light.vlayout_props_height", "Height (rows)")}</span>
            <input type="number" min="1" max="${this._draft.rows}" data-vlayout-prop="h" value="${item.h}" />
          </label>
          ${colorField}
          <button type="button" class="nodalia-vlayout-remove-block" data-vlayout-remove="${item.id}">
            ${this._propsLabel("ed.light.vlayout_props_remove", "Remove block")}
          </button>
        </div>
      `;
    }

    _renderSidebar() {
      const sidebar = this._host.querySelector(".nodalia-vlayout-sidebar");
      if (!sidebar) {
        return;
      }
      const palette = Object.keys(this._catalog)
        .filter(id => !this._draft.items.some(item => item.id === id && item.visible !== false))
        .map(id => `
          <button type="button" class="nodalia-vlayout-palette__item" data-vlayout-add="${id}">
            + ${this._label(id)}
          </button>
        `)
        .join("");

      sidebar.innerHTML = `
        <div class="nodalia-vlayout-sidebar__title">${this._propsLabel("ed.light.vlayout_props_title", "Block properties")}</div>
        ${this._renderPropertiesPanel()}
        <div class="nodalia-vlayout-sidebar__title nodalia-vlayout-sidebar__title--spaced">${this._options.paletteTitle || "Blocks"}</div>
        <div class="nodalia-vlayout-palette">${palette || `<span class="nodalia-vlayout-muted">${this._propsLabel("ed.light.vlayout_palette_empty", "All blocks placed")}</span>`}</div>
      `;
    }

    _renderCanvas() {
      const cols = this._draft.columns;
      const rows = this._draft.rows;
      const cells = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          cells.push(`<div class="nodalia-vlayout-cell" data-cell-x="${x}" data-cell-y="${y}"></div>`);
        }
      }

      const placed = this._draft.items
        .filter(item => item.visible !== false)
        .map(item => {
          const tint = item.color ? `--block-tint:${item.color};` : "";
          const selected = item.id === this._selectedId ? " is-selected" : "";
          return `
            <div
              class="nodalia-vlayout-placed${selected}"
              data-vlayout-id="${item.id}"
              style="grid-column:${item.x + 1} / span ${item.w};grid-row:${item.y + 1} / span ${item.h};${tint}"
            >
              <div class="nodalia-vlayout-placed__toolbar">
                <span>${this._label(item.id)}</span>
                <button type="button" data-vlayout-remove="${item.id}" title="Remove">×</button>
              </div>
              <div class="nodalia-vlayout-placed__body">${this._renderBlockPreview(item.id)}</div>
            </div>
          `;
        })
        .join("");

      const canvasHost = this._host.querySelector(".nodalia-vlayout-canvas-host");
      if (canvasHost) {
        canvasHost.innerHTML = `
          <div
            class="nodalia-vlayout-canvas"
            style="grid-template-columns:repeat(${cols}, minmax(0, 1fr));grid-template-rows:repeat(${rows}, minmax(40px, auto));"
          >
            ${cells}
            ${placed}
          </div>
        `;
        this._bindCanvasListeners();
      }
    }

    _mountLiveCard() {
      const host = this._host.querySelector(".nodalia-vlayout-live-host");
      if (!host) {
        return;
      }
      const tag = this._livePreview.cardTag || "nodalia-light-card";
      if (!this._cardEl) {
        this._cardEl = document.createElement(tag);
        host.appendChild(this._cardEl);
      }
      this._syncLiveCardConfig();
    }

    _render() {
      if (this._isLiveMode()) {
        this._host.innerHTML = `
          <motion.div class="nodalia-vlayout-workspace nodalia-vlayout-workspace--live">
            <div class="nodalia-vlayout-live-host"></div>
            <aside class="nodalia-vlayout-sidebar"></aside>
          </div>
        `.replace("</motion.div>", "</div>").replace('<motion.div class="nodalia-vlayout-workspace nodalia-vlayout-workspace--live">', '<div class="nodalia-vlayout-workspace nodalia-vlayout-workspace--live">');
        this._mountLiveCard();
        this._renderSidebar();
        return;
      }

      const cols = this._draft.columns;
      const rows = this._draft.rows;

      this._host.innerHTML = `
        <div class="nodalia-vlayout-workspace">
          <div class="nodalia-vlayout-canvas-host">
            <div
              class="nodalia-vlayout-canvas"
              style="grid-template-columns:repeat(${cols}, minmax(0, 1fr));grid-template-rows:repeat(${rows}, minmax(40px, auto));"
            >
            </div>
          </div>
          <aside class="nodalia-vlayout-sidebar"></aside>
        </div>
      `;

      this._renderCanvas();
      this._renderSidebar();
      this._bindCanvasListeners();
    }

    _bindCanvasListeners() {
      this._canvasAbort?.abort();
      this._canvasAbort = new AbortController();
      const { signal } = this._canvasAbort;
      const canvas = this._isLiveMode()
        ? this._getLiveGrid()
        : this._host.querySelector(".nodalia-vlayout-canvas");
      if (!canvas) {
        return;
      }
      canvas.addEventListener("pointerdown", this._onCanvasPointerDown, { signal });
      canvas.addEventListener("pointermove", this._onCanvasPointerMove, { signal });
      canvas.addEventListener("pointerup", this._onCanvasPointerUp, { signal });
      canvas.addEventListener("pointercancel", this._onCanvasPointerUp, { signal });
    }

    mount() {
      this._render();
    }

    _getItem(id) {
      return this._draft.items.find(item => item.id === id);
    }

    _notifyChange() {
      this._options.onChange?.(deepClone(this._draft));
    }

    _selectItem(id) {
      this._selectedId = id || "";
      this._syncAllPlacedDom();
      this._renderSidebar();
    }

    _resizeItem(item, deltaW, deltaH) {
      if (!item) {
        return;
      }
      const nextW = clampInt(item.w + deltaW, 1, this._draft.columns);
      const nextH = clampInt(item.h + deltaH, 1, this._draft.rows);
      item.w = nextW;
      item.h = nextH;
      item.x = clampInt(item.x, 0, this._draft.columns - item.w);
      item.y = clampInt(item.y, 0, this._draft.rows - item.h);
      const open = findOpenCell(this._draft, item, item.id);
      item.x = open.x;
      item.y = open.y;
      this._applyItemStyleToDom(item);
      this._renderSidebar();
      this._scheduleLiveSync();
      this._notifyChange();
    }

    _onCanvasPointerDown(event) {
      const placed = event.target.closest(".light-card__visual-item")
        || event.target.closest(".nodalia-vlayout-placed");
      const removeBtn = event.target.closest("[data-vlayout-remove]");
      if (removeBtn) {
        return;
      }

      if (placed) {
        const id = placed.dataset.vlayoutId;
        const item = this._getItem(id);
        if (!item) {
          return;
        }
        event.preventDefault();
        this._selectItem(id);
        const canvas = this._isLiveMode()
          ? this._getLiveGrid()
          : this._host.querySelector(".nodalia-vlayout-canvas");
        canvas?.setPointerCapture?.(event.pointerId);
        this._drag = {
          id,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: item.x,
          originY: item.y,
          moved: false,
        };
        placed.classList.add(this._isLiveMode() ? "is-vlayout-dragging" : "is-dragging");
        return;
      }

      this._selectItem("");
    }

    _onCanvasPointerMove(event) {
      if (!this._drag || event.pointerId !== this._drag.pointerId) {
        return;
      }
      const item = this._getItem(this._drag.id);
      if (!item) {
        return;
      }

      const dx = event.clientX - this._drag.startX;
      const dy = event.clientY - this._drag.startY;
      if (!this._drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
        return;
      }
      this._drag.moved = true;

      const cell = this._cellFromPointer(event.clientX, event.clientY, item);
      if (!cell) {
        return;
      }
      item.x = cell.x;
      item.y = cell.y;
      this._applyItemStyleToDom(item);
    }

    _onCanvasPointerUp(event) {
      if (!this._drag || event.pointerId !== this._drag.pointerId) {
        return;
      }

      const item = this._getItem(this._drag.id);
      const placed = this._isLiveMode()
        ? this._cardEl?.shadowRoot?.querySelector(`.light-card__visual-item[data-vlayout-id="${this._drag.id}"]`)
        : this._host.querySelector(`.nodalia-vlayout-placed[data-vlayout-id="${this._drag.id}"]`);
      const canvas = this._isLiveMode()
        ? this._getLiveGrid()
        : this._host.querySelector(".nodalia-vlayout-canvas");
      if (placed) {
        placed.classList.remove(this._isLiveMode() ? "is-vlayout-dragging" : "is-dragging");
      }
      try {
        canvas?.releasePointerCapture?.(event.pointerId);
      } catch (_error) {
        // ignore
      }

      if (item && this._drag.moved) {
        const open = findOpenCell(this._draft, item, item.id);
        item.x = open.x;
        item.y = open.y;
        this._applyItemStyleToDom(item);
        this._scheduleLiveSync();
        this._notifyChange();
      }

      this._drag = null;
    }

    _applyPropFromSidebar(target) {
      const item = this._getItem(this._selectedId);
      if (!item) {
        return;
      }

      const prop = target.dataset?.vlayoutProp;
      if (prop === "w") {
        item.w = clampInt(target.value, 1, this._draft.columns);
        item.x = clampInt(item.x, 0, this._draft.columns - item.w);
      } else if (prop === "h") {
        item.h = clampInt(target.value, 1, this._draft.rows);
        item.y = clampInt(item.y, 0, this._draft.rows - item.h);
      } else if (prop === "color") {
        item.color = String(target.value || "").trim();
        if (!item.color) {
          delete item.color;
        }
      }
      const open = findOpenCell(this._draft, item, item.id);
      item.x = open.x;
      item.y = open.y;
      this._applyItemStyleToDom(item);
      this._renderSidebar();
      this._scheduleLiveSync();
      this._notifyChange();
    }

    handleClick(event) {
      const resize = event.target.closest("[data-vlayout-resize]")?.dataset?.vlayoutResize;
      if (resize) {
        event.preventDefault();
        const item = this._getItem(this._selectedId);
        if (!item) {
          return;
        }
        if (resize === "full") {
          item.x = 0;
          item.w = this._draft.columns;
          this._applyItemStyleToDom(item);
          this._renderSidebar();
          this._scheduleLiveSync();
          this._notifyChange();
          return;
        }
        if (resize === "w-1") {
          this._resizeItem(item, -1, 0);
        } else if (resize === "w+1") {
          this._resizeItem(item, 1, 0);
        } else if (resize === "h-1") {
          this._resizeItem(item, 0, -1);
        } else if (resize === "h+1") {
          this._resizeItem(item, 0, 1);
        }
        return;
      }

      const addId = event.target.closest("[data-vlayout-add]")?.dataset?.vlayoutAdd;
      if (addId) {
        event.preventDefault();
        const normalized = normalizeItem({ id: addId }, this._catalog, this._draft.columns, this._draft.rows);
        if (!normalized) {
          return;
        }
        const open = findOpenCell(this._draft, normalized, "");
        normalized.x = open.x;
        normalized.y = open.y;
        this._draft.items.push(normalized);
        this._selectedId = normalized.id;
        if (this._isLiveMode()) {
          this._scheduleLiveSync();
        } else {
          this._renderCanvas();
        }
        this._renderSidebar();
        this._notifyChange();
        return;
      }

      const removeId = event.target.closest("[data-vlayout-remove]")?.dataset?.vlayoutRemove;
      if (removeId) {
        event.preventDefault();
        const item = this._getItem(removeId);
        if (item) {
          item.visible = false;
        } else {
          this._draft.items = this._draft.items.filter(entry => entry.id !== removeId);
        }
        if (this._selectedId === removeId) {
          this._selectedId = this._draft.items.find(entry => entry.visible !== false)?.id || "";
        }
        if (this._isLiveMode()) {
          this._scheduleLiveSync();
        } else {
          this._renderCanvas();
        }
        this._renderSidebar();
        this._notifyChange();
      }
    }

    destroy() {
      this._canvasAbort?.abort();
      if (this._liveSyncTimer) {
        window.cancelAnimationFrame(this._liveSyncTimer);
      }
      if (this._cardEl) {
        this._cardEl.removeAttribute("data-vlayout-editing");
      }
    }

    handleInput(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.dataset?.vlayoutProp) {
        return;
      }
      this._applyPropFromSidebar(target);
    }

    setLayout(layout) {
      this._draft = normalizeLayout(layout, this._catalog, this._options);
      this._selectedId = this._draft.items.find(item => item.visible !== false)?.id || "";
      this._render();
    }
  }

  const OVERLAY_STYLES = `
    dialog.nodalia-vlayout-dialog {
      border: none;
      border-radius: 18px;
      color: var(--primary-text-color);
      margin: auto;
      max-height: calc(100vh - 24px);
      max-width: min(1120px, calc(100vw - 24px));
      overflow: hidden;
      padding: 0;
      width: calc(100vw - 24px);
      background: var(--card-background-color, var(--ha-card-background, #1c1c1c));
    }
    dialog.nodalia-vlayout-dialog::backdrop {
      background: color-mix(in srgb, #000 58%, transparent);
    }
    .nodalia-vlayout-overlay__panel {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      max-height: calc(100vh - 24px);
      width: 100%;
    }
    .nodalia-vlayout-overlay__header,
    .nodalia-vlayout-overlay__footer {
      align-items: center;
      display: flex;
      gap: 12px;
      justify-content: space-between;
      padding: 14px 16px;
    }
    .nodalia-vlayout-overlay__footer {
      border-top: 1px solid var(--divider-color);
      justify-content: flex-end;
    }
    .nodalia-vlayout-overlay__title {
      font-size: 16px;
      font-weight: 700;
    }
    .nodalia-vlayout-overlay__hint {
      color: var(--secondary-text-color);
      font-size: 12px;
      margin-top: 2px;
    }
    .nodalia-vlayout-overlay__close {
      appearance: none;
      background: transparent;
      border: 0;
      color: var(--primary-text-color);
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
    }
    .nodalia-vlayout-overlay__body {
      min-height: 0;
      overflow: auto;
      padding: 0 16px 16px;
    }
    .nodalia-vlayout-overlay__footer button {
      appearance: none;
      background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
      border-radius: 999px;
      color: var(--primary-text-color);
      cursor: pointer;
      font: inherit;
      min-height: 38px;
      padding: 0 14px;
    }
    .nodalia-vlayout-overlay__footer button.primary {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: var(--text-primary-color, #fff);
    }
    .nodalia-vlayout-workspace {
      display: grid;
      gap: 14px;
      grid-template-columns: minmax(0, 1fr) 240px;
      min-height: 400px;
    }
    .nodalia-vlayout-workspace--live {
      grid-template-columns: minmax(0, 1fr) 260px;
      min-height: 360px;
    }
    .nodalia-vlayout-live-host {
      align-items: stretch;
      display: flex;
      justify-content: center;
      min-height: 320px;
      overflow: auto;
      padding: 4px;
    }
    .nodalia-vlayout-live-host > nodalia-light-card {
      display: block;
      width: min(100%, 520px);
    }
    .nodalia-vlayout-canvas-host {
      min-height: 400px;
    }
    .nodalia-vlayout-canvas {
      background: color-mix(in srgb, var(--primary-text-color) 3%, transparent);
      border: 1px dashed color-mix(in srgb, var(--primary-text-color) 16%, transparent);
      border-radius: 14px;
      display: grid;
      gap: 6px;
      min-height: 400px;
      padding: 10px;
      position: relative;
      touch-action: none;
      user-select: none;
    }
    .nodalia-vlayout-cell {
      background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
      border-radius: 8px;
      min-height: 36px;
      pointer-events: none;
    }
    .nodalia-vlayout-placed {
      background: color-mix(in srgb, var(--primary-color) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary-color) 28%, transparent);
      border-radius: 12px;
      cursor: grab;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      min-height: 52px;
      overflow: hidden;
      touch-action: none;
      z-index: 2;
    }
    .nodalia-vlayout-placed.is-selected {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 35%, transparent);
    }
    .nodalia-vlayout-placed.is-dragging {
      cursor: grabbing;
      opacity: 0.94;
      z-index: 5;
    }
    .nodalia-vlayout-placed__toolbar {
      align-items: center;
      background: color-mix(in srgb, var(--primary-color) 12%, transparent);
      display: flex;
      font-size: 11px;
      font-weight: 600;
      justify-content: space-between;
      padding: 4px 8px;
    }
    .nodalia-vlayout-placed__toolbar button {
      appearance: none;
      background: transparent;
      border: 0;
      color: inherit;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
    }
    .nodalia-vlayout-placed__body {
      align-items: center;
      display: flex;
      justify-content: center;
      min-height: 44px;
      padding: 8px;
    }
    .nodalia-vlayout-block-preview {
      color: var(--secondary-text-color);
      font-size: 12px;
      text-align: center;
    }
    .nodalia-vlayout-sidebar {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
    }
    .nodalia-vlayout-sidebar__title {
      font-size: 12px;
      font-weight: 700;
    }
    .nodalia-vlayout-sidebar__title--spaced {
      margin-top: 6px;
      padding-top: 10px;
      border-top: 1px solid var(--divider-color);
    }
    .nodalia-vlayout-props {
      display: grid;
      gap: 10px;
    }
    .nodalia-vlayout-props-empty {
      color: var(--secondary-text-color);
      font-size: 12px;
      line-height: 1.4;
    }
    .nodalia-vlayout-field {
      display: grid;
      gap: 6px;
    }
    .nodalia-vlayout-field span {
      font-size: 11px;
      font-weight: 600;
    }
    .nodalia-vlayout-field input[type="number"],
    .nodalia-vlayout-field input[type="color"] {
      appearance: none;
      background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent);
      border-radius: 10px;
      color: var(--primary-text-color);
      font: inherit;
      min-height: 36px;
      padding: 6px 10px;
      width: 100%;
    }
    .nodalia-vlayout-prop-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .nodalia-vlayout-prop-actions button,
    .nodalia-vlayout-palette__item,
    .nodalia-vlayout-remove-block {
      appearance: none;
      background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent);
      border-radius: 10px;
      color: var(--primary-text-color);
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      padding: 6px 10px;
    }
    .nodalia-vlayout-remove-block {
      margin-top: 4px;
      width: 100%;
    }
    .nodalia-vlayout-palette {
      display: grid;
      gap: 8px;
    }
    .nodalia-vlayout-muted {
      color: var(--secondary-text-color);
      font-size: 12px;
    }
    @media (max-width: 720px) {
      .nodalia-vlayout-workspace {
        grid-template-columns: 1fr;
      }
      .nodalia-vlayout-overlay__panel {
        inset: 8px;
        width: calc(100% - 16px);
      }
    }
  `;

  function ensureOverlayStyles() {
    if (typeof document === "undefined") {
      return;
    }
    const existing = document.getElementById("nodalia-vlayout-styles");
    if (existing) {
      existing.textContent = OVERLAY_STYLES;
      return;
    }
    const style = document.createElement("style");
    style.id = "nodalia-vlayout-styles";
    style.textContent = OVERLAY_STYLES;
    document.head.appendChild(style);
  }

  function attachEditorOverlay(editorHost, options) {
    ensureOverlayStyles();

    const layout = resolveEditorLayout(options.layout, options.catalog, options);
    const panelMarkup = `
      <div class="nodalia-vlayout-overlay__panel">
        <header class="nodalia-vlayout-overlay__header">
          <div>
            <div class="nodalia-vlayout-overlay__title">${options.title || "Visual layout"}</div>
            <div class="nodalia-vlayout-overlay__hint">${options.hint || "Drag blocks on the live card preview. Save writes YAML."}</div>
          </div>
          <button type="button" class="nodalia-vlayout-overlay__close" data-vlayout-close aria-label="Close">×</button>
        </header>
        <div class="nodalia-vlayout-overlay__body"></div>
        <footer class="nodalia-vlayout-overlay__footer">
          <button type="button" data-vlayout-reset>${options.resetLabel || "Reset"}</button>
          <button type="button" data-vlayout-save class="primary">${options.saveLabel || "Save layout"}</button>
        </footer>
      </div>
    `;

    let dialog;
    try {
      dialog = openOverlayDialog(panelMarkup);
    } catch (error) {
      console.error("[Nodalia] visual layout dialog failed", error);
      throw error;
    }

    const body = dialog.querySelector(".nodalia-vlayout-overlay__body");
    const surface = new VisualLayoutSurface(body, {
      catalog: options.catalog,
      layout,
      columns: options.columns,
      rows: options.rows,
      labelFor: options.labelFor,
      renderBlockPreview: options.renderBlockPreview,
      paletteTitle: options.paletteTitle,
      livePreview: options.livePreview,
      onChange: options.onDraftChange,
    });
    surface.mount();

    const close = () => {
      surface.destroy();
      if (dialog.open) {
        dialog.close();
      }
      dialog.remove();
      options.onClose?.();
    };

    const onDialogClick = event => {
      if (event.target.closest("[data-vlayout-close]")) {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.target === dialog) {
        close();
        return;
      }
      if (event.target.closest("[data-vlayout-reset]")) {
        event.preventDefault();
        const resetLayout = defaultLayoutFromCatalog(options.catalog, options.columns, options.rows);
        surface.setLayout(resetLayout);
        options.onDraftChange?.(resetLayout);
        return;
      }
      if (event.target.closest("[data-vlayout-save]")) {
        event.preventDefault();
        event.stopPropagation();
        const saved = serializeLayoutForSave(surface.layout);
        options.onSave?.(saved);
        close();
        return;
      }
      surface.handleClick(event);
    };

    dialog.addEventListener("click", onDialogClick, true);
    dialog.addEventListener("input", event => surface.handleInput(event), true);
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      close();
    });

    return { dialog, surface, close };
  }

  const api = {
    DEFAULT_COLUMNS,
    DEFAULT_ROWS,
    normalizeLayout,
    normalizeItem,
    defaultLayoutFromCatalog,
    layoutToGridStyle,
    itemToGridStyle,
    renderPlacedBlocks,
    serializeLayoutForSave,
    resolveEditorLayout,
    createSurface: (host, options) => new VisualLayoutSurface(host, options),
    attachEditorOverlay,
    ensureOverlayStyles,
    openOverlayDialog,
  };

  if (typeof window !== "undefined") {
    window.NodaliaVisualLayout = api;
  }
})();
