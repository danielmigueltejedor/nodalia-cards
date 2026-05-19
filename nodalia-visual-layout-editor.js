/**
 * Shared visual layout editor for Nodalia card editors (drag blocks on a grid → YAML).
 * Exposed as window.NodaliaVisualLayout.
 */
(function initNodaliaVisualLayout() {
  if (typeof window !== "undefined" && window.NodaliaVisualLayout?.createSurface) {
    return;
  }

  const DEFAULT_COLUMNS = 12;
  const DEFAULT_ROWS = 10;

  function clampInt(value, min, max) {
    const numeric = Math.round(Number(value));
    if (!Number.isFinite(numeric)) {
      return min;
    }
    return Math.min(Math.max(numeric, min), max);
  }

  function normalizeItem(raw, catalog, columns, rows) {
    const id = String(raw?.id ?? "").trim();
    const def = catalog[id];
    if (!def) {
      return null;
    }
    const base = def.default || { x: 0, y: 0, w: 4, h: 1 };
    const w = clampInt(raw?.w ?? base.w, 1, columns);
    const h = clampInt(raw?.h ?? base.h, 1, rows);
    const x = clampInt(raw?.x ?? base.x, 0, Math.max(0, columns - w));
    const y = clampInt(raw?.y ?? base.y, 0, Math.max(0, rows - h));
    return {
      id,
      x,
      y,
      w,
      h,
      visible: raw?.visible !== false,
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
    return `grid-column:${item.x + 1} / span ${item.w};grid-row:${item.y + 1} / span ${item.h};min-width:0;`;
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

  class VisualLayoutSurface {
    constructor(host, options) {
      this._host = host;
      this._options = options;
      this._catalog = options.catalog || {};
      this._draft = normalizeLayout(options.layout || {}, this._catalog, options);
      this._drag = null;
      this._onPointerDown = this._onPointerDown.bind(this);
      this._onPointerMove = this._onPointerMove.bind(this);
      this._onPointerUp = this._onPointerUp.bind(this);
    }

    get layout() {
      return this._draft;
    }

    _label(id) {
      const def = this._catalog[id];
      if (!def) {
        return id;
      }
      if (typeof this._options.labelFor === "function") {
        return this._options.labelFor(def.labelKey || id, def.fallbackLabel || id);
      }
      return def.fallbackLabel || id;
    }


    _renderBlockPreviewClean(id) {
      if (typeof this._options.renderBlockPreview === "function") {
        return this._options.renderBlockPreview(id, this._draft);
      }
      return `<div class="nodalia-vlayout-block-preview">${this._label(id)}</div>`;
    }

    _render() {
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
        .map(item => `
          <div
            class="nodalia-vlayout-placed"
            data-vlayout-id="${item.id}"
            style="grid-column:${item.x + 1} / span ${item.w};grid-row:${item.y + 1} / span ${item.h};"
          >
            <div class="nodalia-vlayout-placed__toolbar">
              <span>${this._label(item.id)}</span>
              <button type="button" data-vlayout-remove="${item.id}" title="Remove">×</button>
            </div>
            <div class="nodalia-vlayout-placed__body">${this._renderBlockPreviewClean(item.id)}</div>
          </div>
        `)
        .join("");

      const palette = Object.keys(this._catalog)
        .filter(id => !this._draft.items.some(item => item.id === id && item.visible !== false))
        .map(id => `
          <button type="button" class="nodalia-vlayout-palette__item" data-vlayout-add="${id}">
            + ${this._label(id)}
          </button>
        `)
        .join("");

      this._host.innerHTML = `
        <div class="nodalia-vlayout-workspace">
          <div
            class="nodalia-vlayout-canvas"
            style="grid-template-columns:repeat(${cols}, minmax(0, 1fr));grid-template-rows:repeat(${rows}, minmax(36px, auto));"
          >
            ${cells}
            ${placed}
          </div>
          <aside class="nodalia-vlayout-sidebar">
            <div class="nodalia-vlayout-sidebar__title">${this._options.paletteTitle || "Blocks"}</div>
            <div class="nodalia-vlayout-palette">${palette || `<span class="nodalia-vlayout-muted">All blocks placed</span>`}</div>
          </aside>
        </div>
      `;

      this._host.querySelectorAll(".nodalia-vlayout-placed").forEach(node => {
        node.addEventListener("pointerdown", this._onPointerDown);
      });
    }

    mount() {
      this._render();
    }

    _getItem(id) {
      return this._draft.items.find(item => item.id === id);
    }

    _onPointerDown(event) {
      const placed = event.target.closest(".nodalia-vlayout-placed");
      if (!placed || event.button !== 0) {
        return;
      }
      if (event.target.closest("[data-vlayout-remove]")) {
        return;
      }
      const id = placed.dataset.vlayoutId;
      const item = this._getItem(id);
      if (!item) {
        return;
      }
      event.preventDefault();
      placed.setPointerCapture(event.pointerId);
      this._drag = {
        id,
        pointerId: event.pointerId,
      };
      placed.classList.add("is-dragging");
    }

    _cellFromPoint(clientX, clientY) {
      const canvas = this._host.querySelector(".nodalia-vlayout-canvas");
      if (!canvas) {
        return null;
      }
      const cell = document.elementFromPoint(clientX, clientY)?.closest?.(".nodalia-vlayout-cell");
      if (!cell || !canvas.contains(cell)) {
        return null;
      }
      return {
        x: clampInt(cell.dataset.cellX, 0, this._draft.columns - 1),
        y: clampInt(cell.dataset.cellY, 0, this._draft.rows - 1),
      };
    }

    _onPointerMove(event) {
      if (!this._drag || event.pointerId !== this._drag.pointerId) {
        return;
      }
      const item = this._getItem(this._drag.id);
      if (!item) {
        return;
      }
      const cell = this._cellFromPoint(event.clientX, event.clientY);
      if (!cell) {
        return;
      }
      item.x = clampInt(cell.x, 0, this._draft.columns - item.w);
      item.y = clampInt(cell.y, 0, this._draft.rows - item.h);
      const placed = this._host.querySelector(`.nodalia-vlayout-placed[data-vlayout-id="${this._drag.id}"]`);
      if (placed) {
        placed.style.gridColumn = `${item.x + 1} / span ${item.w}`;
        placed.style.gridRow = `${item.y + 1} / span ${item.h}`;
      }
    }

    _onPointerUp(event) {
      if (!this._drag || event.pointerId !== this._drag.pointerId) {
        return;
      }
      const item = this._getItem(this._drag.id);
      const placed = this._host.querySelector(`.nodalia-vlayout-placed[data-vlayout-id="${this._drag.id}"]`);
      if (placed) {
        placed.classList.remove("is-dragging");
        try {
          placed.releasePointerCapture(event.pointerId);
        } catch (_error) {
          // ignore
        }
      }
      if (item) {
        const open = findOpenCell(this._draft, item, item.id);
        item.x = open.x;
        item.y = open.y;
      }
      this._drag = null;
      this._render();
      this._options.onChange?.(this._draft);
    }

    handleClick(event) {
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
        this._render();
        this._options.onChange?.(this._draft);
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
        this._render();
        this._options.onChange?.(this._draft);
      }
    }

    setLayout(layout) {
      this._draft = normalizeLayout(layout, this._catalog, this._options);
      this._render();
    }
  }

  const OVERLAY_STYLES = `
    .nodalia-vlayout-overlay {
      inset: 0;
      position: fixed;
      z-index: 10000;
    }
    .nodalia-vlayout-overlay__backdrop {
      background: color-mix(in srgb, var(--primary-background-color, #111) 55%, transparent);
      border: 0;
      cursor: pointer;
      inset: 0;
      position: absolute;
    }
    .nodalia-vlayout-overlay__panel {
      background: var(--card-background-color, var(--ha-card-background, #1c1c1c));
      border: 1px solid var(--divider-color);
      border-radius: 18px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      inset: 24px;
      max-height: calc(100vh - 48px);
      position: absolute;
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
      grid-template-columns: minmax(0, 1fr) 200px;
      min-height: 360px;
    }
    .nodalia-vlayout-canvas {
      background: color-mix(in srgb, var(--primary-text-color) 3%, transparent);
      border: 1px dashed color-mix(in srgb, var(--primary-text-color) 16%, transparent);
      border-radius: 14px;
      display: grid;
      gap: 6px;
      min-height: 360px;
      padding: 10px;
      position: relative;
    }
    .nodalia-vlayout-cell {
      background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
      border-radius: 8px;
      min-height: 32px;
    }
    .nodalia-vlayout-placed {
      background: color-mix(in srgb, var(--primary-color) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary-color) 28%, transparent);
      border-radius: 12px;
      cursor: grab;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      min-height: 48px;
      overflow: hidden;
      touch-action: none;
      z-index: 2;
    }
    .nodalia-vlayout-placed.is-dragging {
      cursor: grabbing;
      opacity: 0.92;
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
      min-height: 40px;
      padding: 8px;
    }
    .nodalia-vlayout-block-preview {
      color: var(--secondary-text-color);
      font-size: 12px;
      text-align: center;
    }
    .nodalia-vlayout-sidebar__title {
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .nodalia-vlayout-palette {
      display: grid;
      gap: 8px;
    }
    .nodalia-vlayout-palette__item {
      appearance: none;
      background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent);
      border-radius: 10px;
      color: var(--primary-text-color);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      padding: 8px 10px;
      text-align: left;
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
      }
    }
  `;

  function ensureOverlayStyles() {
    if (typeof document === "undefined") {
      return;
    }
    if (document.getElementById("nodalia-vlayout-styles")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "nodalia-vlayout-styles";
    style.textContent = OVERLAY_STYLES;
    document.head.appendChild(style);
  }

  function attachEditorOverlay(editorHost, options) {
    ensureOverlayStyles();
    const overlay = document.createElement("div");
    overlay.className = "nodalia-vlayout-overlay";
    overlay.innerHTML = `
      <button type="button" class="nodalia-vlayout-overlay__backdrop" data-vlayout-close aria-label="Close"></button>
      <div class="nodalia-vlayout-overlay__panel" role="dialog" aria-modal="true">
        <header class="nodalia-vlayout-overlay__header">
          <div>
            <div class="nodalia-vlayout-overlay__title">${options.title || "Visual layout"}</div>
            <div class="nodalia-vlayout-overlay__hint">${options.hint || "Drag blocks on the grid. Save applies to card YAML."}</div>
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

    const body = overlay.querySelector(".nodalia-vlayout-overlay__body");
    const surface = new VisualLayoutSurface(body, {
      catalog: options.catalog,
      layout: options.layout,
      columns: options.columns,
      rows: options.rows,
      labelFor: options.labelFor,
      renderBlockPreview: options.renderBlockPreview,
      paletteTitle: options.paletteTitle,
      onChange: options.onDraftChange,
    });
    surface.mount();

    const close = () => {
      overlay.remove();
      options.onClose?.();
    };

    overlay.addEventListener("click", event => {
      if (event.target.closest("[data-vlayout-close]")) {
        event.preventDefault();
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
        const saved = {
          ...surface.layout,
          enabled: true,
        };
        options.onSave?.(saved);
        close();
        return;
      }
      surface.handleClick(event);
    });

    overlay.addEventListener("pointermove", surface._onPointerMove);
    overlay.addEventListener("pointerup", surface._onPointerUp);
    overlay.addEventListener("pointercancel", surface._onPointerUp);

    document.body.appendChild(overlay);

    return { overlay, surface, close };
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
    createSurface: (host, options) => new VisualLayoutSurface(host, options),
    attachEditorOverlay,
    ensureOverlayStyles,
  };

  if (typeof window !== "undefined") {
    window.NodaliaVisualLayout = api;
  }
})();
