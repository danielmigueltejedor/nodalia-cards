/**
 * Nodalia visual layout editor (shared module).
 *
 * Purpose
 * - Lets card editors (currently light card) reposition UI blocks on a CSS grid and persist
 *   the result in YAML under `visual_layout`.
 *
 * Architecture
 * - Pure helpers: normalize layout/items, collision detection, YAML serialization.
 * - `VisualLayoutSurface`: in-dialog UI (live card preview, drag, property sidebar, context menu).
 * - `attachEditorOverlay`: mounts a native `<dialog showModal>` above the HA card editor.
 *
 * Live preview mode (`options.livePreview`)
 * - Renders a real card element (`nodalia-light-card`) with `data-vlayout-editing` so the user
 *   sees true chips/icon/sliders while editing.
 * - Pointer hit-testing uses an overlay (`nodalia-vlayout-hit-layer`) because the card sets
 *   `pointer-events: none` during edit (prevents toggling the light on tap).
 * - Selection frames (`nodalia-vlayout-frames`) hug each block's focus element (circle for icon),
 *   not the full grid cell — see `BLOCK_FOCUS_SELECTORS`.
 *
 * Config shape written to YAML (`serializeLayoutForSave`)
 * ```yaml
 * visual_layout:
 *   enabled: true
 *   columns: 12
 *   rows: 10
 *   items:
 *     - id: icon
 *       x: 0
 *       y: 0
 *       w: 2
 *       h: 2
 *       color: "#6da8ff"   # optional per-block accent
 *       radius: 50         # optional, icon only (px, maps to --vlayout-icon-radius)
 * ```
 *
 * Integration checklist for new card types
 * 1. Define a block `catalog` (id → default grid rect, `props`, `frame`, i18n keys).
 * 2. At runtime, build `blocksById` markup and call `renderPlacedBlocks`.
 * 3. In the card editor, call `attachEditorOverlay` with `livePreview: { cardTag, hass, getConfig }`.
 * 4. On save, merge `serializeLayoutForSave` into Lovelace config (see light card `_commitVisualLayout`).
 *
 * Common bugs / fixes
 * - Blocks snap back after drag → `findOpenCell` must prefer drop coordinates (not scan from 0,0).
 * - Overlay behind HA editor → use `<dialog showModal>`, not a div inside `ha-dialog` light DOM.
 * - Card toggles on tap while editing → card must guard `_onShadowClick` when `data-vlayout-editing`.
 *
 * Public API: `window.NodaliaVisualLayout` (also exported for unit tests via `findOpenCell`, etc.).
 */
(function initNodaliaVisualLayout() {
  // HACS bundle may evaluate this file twice; keep a single registration.
  if (typeof window !== "undefined" && window.NodaliaVisualLayout?.attachEditorOverlay) {
    return;
  }

  /** Default grid size when the catalog / config does not override columns or rows. */
  const DEFAULT_COLUMNS = 12;
  const DEFAULT_ROWS = 10;
  /** Ignore micro-movements so click-to-select does not start a drag. */
  const DRAG_THRESHOLD_PX = 6;
  /** Quick tint presets in the right-click menu (accent colors). */
  const TINT_SWATCHES = [
    "#6da8ff",
    "#ff8a4c",
    "#34c759",
    "#ff453a",
    "#bf5af2",
    "#ffd60a",
    "#64d2ff",
    "#ac8e68",
  ];

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

  /**
   * Maps block ids to the DOM node used for tight selection frames in live preview.
   * Each card type provides its own catalog; selectors target light-card shadow DOM classes.
   */
  const BLOCK_FOCUS_SELECTORS = {
    icon: ".light-card__icon",
    title: ".light-card__title",
    chips: ".light-card__chips",
    sliders: ".light-card__controls-shell, .light-card__slider-wrap",
    brightness_presets: ".light-card__preset-row, .light-card__brightness-preset",
    temperature_presets: ".light-card__preset-row, .light-card__temperature-preset",
    color_presets: ".light-card__preset-row, .light-card__color-preset",
    temperature_section: ".light-card__section",
    color_section: ".light-card__section",
  };

  function getBlockFocusElement(itemNode, blockId, catalog) {
    if (!itemNode) {
      return null;
    }
    const selector = BLOCK_FOCUS_SELECTORS[blockId];
    if (selector) {
      const match = itemNode.querySelector(selector);
      if (match) {
        return match;
      }
    }
    const children = [...itemNode.children].filter(node => node instanceof HTMLElement);
    if (children.length === 1) {
      return children[0];
    }
    return itemNode;
  }

  function getBlockFrameDef(catalog, blockId) {
    return getCatalogDef(catalog, blockId)?.frame || { shape: "rounded", pad: 4, radius: 12 };
  }


  /**
   * Normalizes one layout item from YAML or editor draft.
   * Unknown ids are dropped (catalog is the source of truth for valid block types).
   */
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
    const radiusRaw = raw?.radius ?? base.radius;
    const radius = radiusRaw === undefined || radiusRaw === null || radiusRaw === ""
      ? undefined
      : clampInt(radiusRaw, 0, 999);
    return {
      id,
      x,
      y,
      w,
      h,
      visible: raw?.visible !== false,
      ...(color ? { color } : {}),
      ...(radius !== undefined ? { radius } : {}),
    };
  }

  /** Merges raw `visual_layout` config with catalog defaults; dedupes items by id. */
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

  /**
   * Inline grid placement for one block. CSS grid is 1-based; items are 0-based in config.
   * Optional CSS variables are consumed by the card stylesheet (e.g. light card visual items).
   */
  function itemToGridStyle(item) {
    const tint = item.color ? `--block-tint:${item.color};` : "";
    const iconRadius = item.id === "icon" && item.radius !== undefined
      ? `--vlayout-icon-radius:${item.radius}px;`
      : "";
    return `grid-column:${item.x + 1} / span ${item.w};grid-row:${item.y + 1} / span ${item.h};min-width:0;${tint}${iconRadius}`;
  }

  /**
   * Wraps pre-rendered block HTML (icon, chips, etc.) in grid-positioned containers.
   * Used by the card at runtime — not by the editor surface directly in live mode.
   */
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

  function cellHasCollision(layout, item, x, y, excludeId) {
    const candidate = { ...item, x, y };
    return layout.items.some(other => {
      if (other.id === excludeId || other.visible === false) {
        return false;
      }
      return rectsOverlap(candidate, other);
    });
  }

  /**
   * Resolves grid position after resize or drag end.
   *
   * Important: always try `preferX` / `preferY` first (usually the drop location).
   * Scanning from (0,0) caused blocks to snap back to their default slot after every drag.
   * If the preferred cell collides, pick the nearest free cell by Manhattan distance.
   */
  function findOpenCell(layout, item, excludeId, options = {}) {
    const preferX = Number.isFinite(options.preferX) ? options.preferX : item.x;
    const preferY = Number.isFinite(options.preferY) ? options.preferY : item.y;

    if (!cellHasCollision(layout, item, preferX, preferY, excludeId)) {
      return { x: preferX, y: preferY };
    }

    const candidates = [];
    for (let y = 0; y <= layout.rows - item.h; y += 1) {
      for (let x = 0; x <= layout.columns - item.w; x += 1) {
        if (x === preferX && y === preferY) {
          continue;
        }
        candidates.push({
          x,
          y,
          distance: Math.abs(x - preferX) + Math.abs(y - preferY),
        });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);

    for (const candidate of candidates) {
      if (!cellHasCollision(layout, item, candidate.x, candidate.y, excludeId)) {
        return { x: candidate.x, y: candidate.y };
      }
    }

    return { x: item.x, y: item.y };
  }

  /**
   * Produces the object stored in Lovelace YAML on "Save layout".
   * Always sets `enabled: true` and omits `visible` (removed blocks are excluded from items).
   */
  function serializeLayoutForSave(layout, options = {}) {
    const positionOnly = options.positionOnly === true;
    return {
      enabled: true,
      columns: layout.columns,
      rows: layout.rows,
      items: layout.items
        .filter(item => item.visible !== false)
        .map(item => {
          const out = { id: item.id, x: item.x, y: item.y, w: item.w, h: item.h };
          if (!positionOnly) {
            if (item.color) {
              out.color = item.color;
            }
            if (item.radius !== undefined) {
              out.radius = item.radius;
            }
          }
          return out;
        }),
    };
  }

  /**
   * Opening state for the editor: use saved layout or seed all catalog blocks when empty.
   */
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

  /**
   * Native modal layer — stays above the HA card config dialog (top layer in the browser).
   * Do not mount inside `ha-dialog` light DOM; those children are not painted.
   */
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
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    }
    return dialog;
  }

  /**
   * Interactive editor surface inside the dialog body.
   *
   * Modes
   * - Live (`livePreview` set): real card + hit layer + SVG-like frames.
   * - Grid-only (legacy): abstract canvas with placeholder cells (no card integration).
   *
   * Draft state lives in `this._draft`; sync to the card via `_syncLiveCardConfig` (debounced).
   */
  class VisualLayoutSurface {
    constructor(host, options) {
      this._host = host;
      this._options = options;
      this._catalog = options.catalog || {};
      this._draft = normalizeLayout(options.layout || {}, this._catalog, options);
      this._selectedId = this._draft.items.find(item => item.visible !== false)?.id || "";
      this._drag = null;
      this._resize = null;
      this._canvasGap = 6;
      this._canvasPad = 10;
      this._onCanvasPointerDown = this._onCanvasPointerDown.bind(this);
      this._onCanvasPointerMove = this._onCanvasPointerMove.bind(this);
      this._onCanvasPointerUp = this._onCanvasPointerUp.bind(this);
      this._onHandlePointerDown = this._onHandlePointerDown.bind(this);
      this._onHandlePointerMove = this._onHandlePointerMove.bind(this);
      this._onHandlePointerUp = this._onHandlePointerUp.bind(this);
      this._onPaletteDragStart = this._onPaletteDragStart.bind(this);
      this._onCanvasDragOver = this._onCanvasDragOver.bind(this);
      this._onCanvasDrop = this._onCanvasDrop.bind(this);
      this._livePreview = options.livePreview || null;
      this._cardEl = null;
      this._liveSyncTimer = null;
      this._frameRaf = null;
      this._frameRects = [];
      this._paletteDragId = "";
      this._contextMenuEl = null;
      this._contextMenuSuppressUntil = 0;
      this._overlayRoot = options.overlayRoot || null;
      this._styleHandlers = options.styleHandlers || null;
      this._previewConfig = null;
      this._onHitContextMenu = this._onHitContextMenu.bind(this);
      this._onDocumentPointerDown = this._onDocumentPointerDown.bind(this);
      this._onAuxClick = this._onAuxClick.bind(this);
      this._onControlsInput = this._onControlsInput.bind(this);
      this._onControlsClick = this._onControlsClick.bind(this);
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

    _getLiveStage() {
      return this._host.querySelector(".nodalia-vlayout-live-stage");
    }

    /** Bounds of one placed block in stage coordinates (matches what the user sees on the card). */
    _getItemStageRect(item) {
      const stage = this._getLiveStage();
      if (!stage || !item) {
        return null;
      }
      const node = this._cardEl?.shadowRoot?.querySelector(
        `.light-card__visual-item[data-vlayout-id="${item.id}"]`,
      );
      if (node) {
        const stageRect = stage.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const left = nodeRect.left - stageRect.left;
        const top = nodeRect.top - stageRect.top;
        const width = nodeRect.width;
        const height = nodeRect.height;
        return {
          left,
          top,
          width,
          height,
          right: left + width,
          bottom: top + height,
        };
      }
      return this._cellRectFromGrid(item);
    }

    _isCircularBlock(blockId) {
      return getBlockFrameDef(this._catalog, blockId).shape === "circle";
    }

    /**
     * Pushes the in-memory draft into the preview card via `setConfig`.
     * Called after drag end and property edits (debounced via `_scheduleLiveSync`).
     * `auto_expand: true` keeps sliders visible so the preview matches a typical dashboard card.
     */
    _ensurePreviewConfig() {
      if (!this._previewConfig && typeof this._livePreview?.getConfig === "function") {
        let base = deepClone(this._livePreview.getConfig() || {});
        if (this._styleHandlers?.migrateLayoutIntoConfig) {
          base = this._styleHandlers.migrateLayoutIntoConfig(base);
        }
        this._previewConfig = base;
        if (this._styleHandlers?.stripLayoutDecorations) {
          this._draft = normalizeLayout(
            this._styleHandlers.stripLayoutDecorations(this._draft),
            this._catalog,
            this._options,
          );
        }
      }
      return this._previewConfig;
    }

    getPreviewConfig() {
      return deepClone(this._ensurePreviewConfig() || {});
    }

    _syncLiveCardConfig() {
      if (!this._isLiveMode() || !this._cardEl) {
        return;
      }
      const previewConfig = deepClone(this._ensurePreviewConfig() || this._livePreview.getConfig() || {});
      previewConfig.visual_layout = deepClone(this._draft);
      previewConfig.visual_layout.enabled = true;
      const entityOn = this._isPreviewEntityOn();
      // Expanded while on so sliders/sections are visible; off respects `auto_expand` from config.
      previewConfig.auto_expand = entityOn ? true : previewConfig.auto_expand === true;
      this._previewConfig = previewConfig;
      if (this._livePreview.hass !== undefined) {
        this._cardEl.hass = this._livePreview.hass;
      }
      this._cardEl.setAttribute("data-vlayout-editing", "true");
      this._cardEl.setConfig(previewConfig);
      window.requestAnimationFrame(() => {
        this._syncAllPlacedDom();
        this._scheduleFrameUpdate();
        this._fitLiveStageHeight();
        this._bindCanvasListeners();
      });
    }

    _isPreviewEntityOn() {
      if (!this._powerPreview?.supportsToggle) {
        return true;
      }
      return typeof this._powerPreview.isOn === "function"
        ? this._powerPreview.isOn()
        : Boolean(this._powerPreview.isOn);
    }

    /** Let the preview grow with the real card (sliders, presets, sections). */
    _updatePowerToggleButton(dialog) {
      const btn = dialog?.querySelector("[data-vlayout-toggle-power]");
      if (!btn || !this._powerPreview?.supportsToggle) {
        return;
      }
      const isOn = this._isPreviewEntityOn();
      btn.textContent = isOn ? this._powerPreview.labelOn : this._powerPreview.labelOff;
      btn.setAttribute("aria-pressed", isOn ? "true" : "false");
      btn.classList.toggle("is-on", isOn);
    }

    _fitLiveStageHeight() {
      if (!this._isLiveMode() || !this._cardEl) {
        return;
      }
      const stage = this._getLiveStage();
      const host = this._host.querySelector(".nodalia-vlayout-live-host");
      const cardRoot = this._cardEl.shadowRoot?.querySelector(".light-card");
      if (!stage || !host || !cardRoot) {
        return;
      }
      const height = Math.ceil(cardRoot.getBoundingClientRect().height);
      if (height > 0) {
        const padded = height + 28;
        stage.style.minHeight = `${padded}px`;
        host.style.minHeight = `${padded + 16}px`;
      }
    }

    /** Debounces full card re-renders while dragging or scrubbing sliders in the context menu. */
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

    _blockSupportsResize(id) {
      return this._blockSupports(id, "resize");
    }

    _scheduleFrameUpdate() {
      if (this._frameRaf) {
        return;
      }
      this._frameRaf = window.requestAnimationFrame(() => {
        this._frameRaf = null;
        this._updateBlockFrames();
        this._updateGridGuide();
      });
    }

    _cellRectFromGrid(item) {
      const metrics = this._getCanvasMetrics();
      if (!metrics || !item) {
        return null;
      }
      const { gap, pad, cellW, cellH } = metrics;
      const left = pad + item.x * (cellW + gap);
      const top = pad + item.y * (cellH + gap);
      const width = item.w * cellW + (item.w - 1) * gap;
      const height = item.h * cellH + (item.h - 1) * gap;
      return { left, top, width, height, right: left + width, bottom: top + height };
    }

    _updateDropIndicator(item) {
      const stage = this._getLiveStage();
      const hitLayer = stage?.querySelector(".nodalia-vlayout-hit-layer");
      if (!hitLayer) {
        return;
      }
      let indicator = hitLayer.querySelector(".nodalia-vlayout-drop-indicator");
      if (!item) {
        indicator?.remove();
        return;
      }
      const rect = this._isLiveMode()
        ? this._cellRectFromGrid(item)
        : null;
      if (!rect) {
        indicator?.remove();
        return;
      }
      if (!indicator) {
        indicator = document.createElement("div");
        indicator.className = "nodalia-vlayout-drop-indicator";
        indicator.setAttribute("aria-hidden", "true");
        hitLayer.appendChild(indicator);
      }
      indicator.style.left = `${rect.left}px`;
      indicator.style.top = `${rect.top}px`;
      indicator.style.width = `${rect.width}px`;
      indicator.style.height = `${rect.height}px`;
    }

    _updateGridGuide() {
      if (!this._isLiveMode()) {
        return;
      }
      const stage = this._getLiveStage();
      const guide = stage?.querySelector(".nodalia-vlayout-grid-guide");
      const metrics = this._getCanvasMetrics();
      if (!guide || !metrics?.canvas) {
        return;
      }
      const gridRect = metrics.canvas.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      guide.style.left = `${gridRect.left - stageRect.left}px`;
      guide.style.top = `${gridRect.top - stageRect.top}px`;
      guide.style.width = `${gridRect.width}px`;
      guide.style.height = `${gridRect.height}px`;
      guide.style.setProperty("--vlayout-cols", String(metrics.cols));
      guide.style.setProperty("--vlayout-rows", String(metrics.rows));
    }

    _applyContextMenuInput(target) {
      const blockId = this._selectedId;
      const item = this._getItem(blockId);
      if (!item || !(target instanceof HTMLElement)) {
        return;
      }
      const kind = target.dataset?.vlayoutCtx;
      const useStyles = Boolean(this._styleHandlers?.applyColor);
      if (kind === "swatch-color" && this._blockSupports(blockId, "color")) {
        const color = String(target.dataset?.vlayoutColor || "").trim();
        if (useStyles) {
          this._previewConfig = this._styleHandlers.applyColor(this._ensurePreviewConfig(), blockId, color);
        } else {
          item.color = color;
          if (!item.color) {
            delete item.color;
          }
        }
        const colorInput = this._contextMenuEl?.querySelector('[data-vlayout-ctx="color"]');
        if (colorInput instanceof HTMLInputElement) {
          colorInput.value = color || "#6da8ff";
        }
      } else if (kind === "color" && this._blockSupports(blockId, "color")) {
        const color = String(target.value || "").trim();
        if (useStyles) {
          this._previewConfig = this._styleHandlers.applyColor(this._ensurePreviewConfig(), blockId, color);
        } else {
          item.color = color;
          if (!item.color) {
            delete item.color;
          }
        }
      } else if (kind === "diameter" && this._isCircularBlock(blockId)) {
        const size = clampInt(target.value, 1, Math.min(this._draft.columns, this._draft.rows));
        item.w = size;
        item.h = size;
        item.x = clampInt(item.x, 0, this._draft.columns - item.w);
        item.y = clampInt(item.y, 0, this._draft.rows - item.h);
        const valueNode = this._contextMenuEl?.querySelector("[data-vlayout-ctx-diameter-value]");
        if (valueNode) {
          valueNode.textContent = `${size}`;
        }
      } else if (kind === "w") {
        item.w = clampInt(target.value, 1, this._draft.columns);
        item.x = clampInt(item.x, 0, this._draft.columns - item.w);
        if (this._isCircularBlock(blockId)) {
          item.h = item.w;
          item.y = clampInt(item.y, 0, this._draft.rows - item.h);
        }
      } else if (kind === "h") {
        item.h = clampInt(target.value, 1, this._draft.rows);
        item.y = clampInt(item.y, 0, this._draft.rows - item.h);
        if (this._isCircularBlock(blockId)) {
          item.w = item.h;
          item.x = clampInt(item.x, 0, this._draft.columns - item.w);
        }
      } else if (kind === "radius" && blockId === "icon") {
        const radius = clampInt(target.value, 0, 100);
        if (useStyles && this._styleHandlers?.applyRadius) {
          this._previewConfig = this._styleHandlers.applyRadius(this._ensurePreviewConfig(), blockId, radius);
        } else {
          item.radius = radius;
        }
        const valueNode = this._contextMenuEl?.querySelector("[data-vlayout-ctx-radius-value]");
        if (valueNode) {
          valueNode.textContent = `${radius}%`;
        }
      } else {
        return;
      }
      if (kind === "w" || kind === "h" || kind === "diameter") {
        const open = findOpenCell(this._draft, item, item.id);
        item.x = open.x;
        item.y = open.y;
        this._applyItemStyleToDom(item);
        this._scheduleFrameUpdate();
      }
      this._syncControlOutputs();
      this._renderInspector();
      this._refreshChrome();
      this._scheduleLiveSync();
      this._notifyChange();
    }

    _addBlockAtCell(blockId, cellX, cellY) {
      const normalized = normalizeItem({ id: blockId }, this._catalog, this._draft.columns, this._draft.rows);
      if (!normalized) {
        return;
      }
      const existing = this._getItem(blockId);
      if (existing) {
        existing.visible = true;
        existing.x = clampInt(cellX, 0, this._draft.columns - existing.w);
        existing.y = clampInt(cellY, 0, this._draft.rows - existing.h);
        const open = findOpenCell(this._draft, existing, existing.id, {
          preferX: existing.x,
          preferY: existing.y,
        });
        existing.x = open.x;
        existing.y = open.y;
        this._selectedId = existing.id;
      } else {
        normalized.x = clampInt(cellX, 0, this._draft.columns - normalized.w);
        normalized.y = clampInt(cellY, 0, this._draft.rows - normalized.h);
        const open = findOpenCell(this._draft, normalized, "", {
          preferX: normalized.x,
          preferY: normalized.y,
        });
        normalized.x = open.x;
        normalized.y = open.y;
        this._draft.items.push(normalized);
        this._selectedId = normalized.id;
      }
      if (this._isLiveMode()) {
        this._scheduleLiveSync();
      } else {
        this._renderCanvas();
      }
      this._refreshChrome();
      this._scheduleFrameUpdate();
      this._notifyChange();
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
      let x;
      let y;
      if (this._isLiveMode()) {
        const relX = clientX - rect.left;
        const relY = clientY - rect.top;
        x = Math.floor((relX / Math.max(1, rect.width)) * cols);
        y = Math.floor((relY / Math.max(1, rect.height)) * rows);
      } else {
        const relX = clientX - rect.left - pad;
        const relY = clientY - rect.top - pad;
        x = Math.floor(relX / (cellW + gap));
        y = Math.floor(relY / (cellH + gap));
      }
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
      if (!this._styleHandlers?.readColor && item.color) {
        node.style.setProperty("--block-tint", item.color);
      } else {
        node.style.removeProperty("--block-tint");
      }
      if (!this._styleHandlers?.readRadius && item.id === "icon" && item.radius !== undefined) {
        node.style.setProperty("--vlayout-icon-radius", `${item.radius}px`);
      } else if (item.id === "icon") {
        node.style.removeProperty("--vlayout-icon-radius");
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
        this._scheduleFrameUpdate();
      }
    }

    /**
     * Draws dashed selection outlines over the live preview (not on grid cells).
     * Rectangles are computed from `getBlockFocusElement` + catalog `frame` (circle vs rounded).
     * `this._frameRects` is used for hit-testing drags on the transparent hit layer.
     */
    _updateBlockFrames() {
      if (!this._isLiveMode()) {
        return;
      }
      const stage = this._getLiveStage();
      const framesLayer = stage?.querySelector(".nodalia-vlayout-frames");
      if (!stage || !framesLayer || !this._cardEl) {
        return;
      }

      const stageRect = stage.getBoundingClientRect();
      const hitLayer = stage.querySelector(".nodalia-vlayout-hit-layer");
      if (hitLayer) {
        hitLayer.style.width = `${stageRect.width}px`;
        hitLayer.style.height = `${stageRect.height}px`;
      }

      framesLayer.innerHTML = "";
      let handlesLayer = stage.querySelector(".nodalia-vlayout-handles");
      if (!handlesLayer) {
        handlesLayer = document.createElement("div");
        handlesLayer.className = "nodalia-vlayout-handles";
        handlesLayer.setAttribute("aria-hidden", "true");
        stage.appendChild(handlesLayer);
      }
      handlesLayer.innerHTML = "";
      this._frameRects = [];

      const visibleItems = this._draft.items.filter(entry => entry.visible !== false);
      visibleItems.forEach(item => {
          const cellRect = this._getItemStageRect(item);
          if (!cellRect) {
            return;
          }
          if (item.id !== this._selectedId) {
            return;
          }

          const frameDef = getBlockFrameDef(this._catalog, item.id);
          const shape = frameDef.shape || "rounded";
          const radius = item.radius ?? frameDef.radius ?? (shape === "circle" ? 9999 : 12);
          let { left, top, width, height } = cellRect;
          if (shape === "circle") {
            const size = Math.min(width, height);
            left += (width - size) / 2;
            top += (height - size) / 2;
            width = size;
            height = size;
          }

          const frame = document.createElement("div");
          frame.className = `nodalia-vlayout-frame nodalia-vlayout-frame--${shape} is-selected`;
          frame.dataset.vlayoutId = item.id;
          frame.style.left = `${left}px`;
          frame.style.top = `${top}px`;
          frame.style.width = `${width}px`;
          frame.style.height = `${height}px`;
          frame.style.borderRadius = shape === "circle" ? "50%" : `${radius}px`;
          if (item.color) {
            frame.style.setProperty("--frame-tint", item.color);
          }
          framesLayer.appendChild(frame);
          const frameRect = {
            id: item.id,
            left,
            top,
            width,
            height,
            right: left + width,
            bottom: top + height,
          };
          this._frameRects.push(frameRect);

          if (
            item.id === this._selectedId
            && this._blockSupportsResize(item.id)
          ) {
            ["e", "s", "se"].forEach(edge => {
              const handle = document.createElement("button");
              handle.type = "button";
              handle.className = `nodalia-vlayout-handle nodalia-vlayout-handle--${edge}`;
              handle.dataset.vlayoutHandle = edge;
              handle.dataset.vlayoutId = item.id;
              handle.setAttribute("aria-label", edge === "se" ? "Resize" : edge === "e" ? "Width" : "Height");
              if (edge === "e") {
                handle.style.left = `${left + width - 6}px`;
                handle.style.top = `${top + height / 2 - 6}px`;
              } else if (edge === "s") {
                handle.style.left = `${left + width / 2 - 6}px`;
                handle.style.top = `${top + height - 6}px`;
              } else {
                handle.style.left = `${left + width - 6}px`;
                handle.style.top = `${top + height - 6}px`;
              }
              handlesLayer.appendChild(handle);
            });
          }
        });

      this._bindHandleListeners(handlesLayer);
    }

    _bindHandleListeners(handlesLayer) {
      this._handlesAbort?.abort();
      if (!handlesLayer) {
        return;
      }
      this._handlesAbort = new AbortController();
      const { signal } = this._handlesAbort;
      handlesLayer.addEventListener("pointerdown", this._onHandlePointerDown, { signal });
    }

    /** Returns block id under pointer (top-most grid item), or "" if none. */
    _hitTestBlockAt(clientX, clientY) {
      const stage = this._getLiveStage();
      if (!stage || !this._cardEl?.shadowRoot) {
        return "";
      }
      const nodes = [...this._cardEl.shadowRoot.querySelectorAll(".light-card__visual-item[data-vlayout-id]")]
        .map(node => {
          const id = node.dataset.vlayoutId;
          const item = this._getItem(id);
          if (!item || item.visible === false) {
            return null;
          }
          const rect = node.getBoundingClientRect();
          return { id, rect, area: rect.width * rect.height };
        })
        .filter(Boolean)
        .sort((a, b) => a.area - b.area);
      const hit = nodes.find(entry => (
        clientX >= entry.rect.left
        && clientX <= entry.rect.right
        && clientY >= entry.rect.top
        && clientY <= entry.rect.bottom
      ));
      return hit?.id || "";
    }

    _hideContextMenu() {
      if (this._contextMenuEl) {
        this._contextMenuEl.remove();
        this._contextMenuEl = null;
      }
      document.removeEventListener("pointerdown", this._onDocumentPointerDown, true);
    }

    _onDocumentPointerDown(event) {
      if (Date.now() < this._contextMenuSuppressUntil) {
        return;
      }
      if (this._contextMenuEl && !event.target.closest(".nodalia-vlayout-context-menu")) {
        this._hideContextMenu();
      }
    }

    _getOverlayMount() {
      if (this._overlayRoot instanceof HTMLElement) {
        return this._overlayRoot;
      }
      return typeof document !== "undefined" ? document.body : null;
    }

    _openBlockProperties(clientX, clientY, blockId) {
      if (!blockId) {
        return;
      }
      this._selectItem(blockId);
      this._showContextMenu(clientX, clientY, blockId);
    }

    _onAuxClick(event) {
      if (!this._isLiveMode() || event.button !== 2) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const blockId = this._hitTestBlockAt(event.clientX, event.clientY);
      if (blockId) {
        this._openBlockProperties(event.clientX, event.clientY, blockId);
      }
    }

    _readBlockColor(blockId) {
      if (this._styleHandlers?.readColor) {
        return this._styleHandlers.readColor(this._ensurePreviewConfig(), blockId) || "#6da8ff";
      }
      return this._getItem(blockId)?.color || "#6da8ff";
    }

    _readBlockRadius(blockId) {
      if (this._styleHandlers?.readRadius) {
        return this._styleHandlers.readRadius(this._ensurePreviewConfig(), blockId) ?? 50;
      }
      return this._getItem(blockId)?.radius ?? 50;
    }

    _getBlockControlsMarkup(blockId) {
      const item = this._getItem(blockId);
      if (!item) {
        return "";
      }
      const blockColor = this._readBlockColor(blockId);
      const blockRadius = this._readBlockRadius(blockId);
      const isCircle = this._isCircularBlock(blockId);
      const swatches = this._blockSupports(blockId, "color")
        ? `<div class="nodalia-vlayout-controls__swatches" role="group" aria-label="${this._propsLabel("ed.light.vlayout_ctx_tints", "Tint colors")}">
            ${TINT_SWATCHES.map(color => `
              <button
                type="button"
                class="nodalia-vlayout-swatch${blockColor === color ? " is-active" : ""}"
                style="--swatch:${color}"
                data-vlayout-ctx="swatch-color"
                data-vlayout-color="${color}"
                title="${color}"
              ></button>
            `).join("")}
          </div>
          <label class="nodalia-vlayout-controls__field nodalia-vlayout-controls__field--color">
            <span>${this._propsLabel("ed.light.vlayout_props_color", "Accent color")}</span>
            <input type="color" data-vlayout-ctx="color" value="${blockColor}" />
          </label>`
        : "";

      const sizeFields = isCircle
        ? `<label class="nodalia-vlayout-controls__field">
            <span class="nodalia-vlayout-controls__field-head">
              <span>${this._propsLabel("ed.light.vlayout_ctx_diameter", "Diameter (cells)")}</span>
              <output data-vlayout-ctx-diameter-value>${Math.max(item.w, item.h)}</output>
            </span>
            <input type="range" min="1" max="${Math.min(this._draft.columns, this._draft.rows)}" step="1" data-vlayout-ctx="diameter" value="${Math.max(item.w, item.h)}" />
          </label>`
        : `
          <label class="nodalia-vlayout-controls__field">
            <span class="nodalia-vlayout-controls__field-head">
              <span>${this._propsLabel("ed.light.vlayout_props_width", "Width")}</span>
              <output data-vlayout-ctx-w-value>${item.w}</output>
            </span>
            <input type="range" min="1" max="${this._draft.columns}" step="1" data-vlayout-ctx="w" value="${item.w}" />
          </label>
          <label class="nodalia-vlayout-controls__field">
            <span class="nodalia-vlayout-controls__field-head">
              <span>${this._propsLabel("ed.light.vlayout_props_height", "Height")}</span>
              <output data-vlayout-ctx-h-value>${item.h}</output>
            </span>
            <input type="range" min="1" max="${this._draft.rows}" step="1" data-vlayout-ctx="h" value="${item.h}" />
          </label>
        `;

      const radiusField = blockId === "icon"
        ? `<label class="nodalia-vlayout-controls__field">
            <span class="nodalia-vlayout-controls__field-head">
              <span>${this._propsLabel("ed.light.vlayout_props_radius", "Icon radius")}</span>
              <output data-vlayout-ctx-radius-value>${item.radius ?? 50}px</output>
            </span>
            <input type="range" min="0" max="100" step="1" data-vlayout-ctx="radius" value="${blockRadius}" />
          </label>`
        : "";

      return `
        <div class="nodalia-vlayout-controls__title">${this._label(blockId)}</div>
        <div class="nodalia-vlayout-controls__grid">
          ${swatches}
          ${sizeFields}
          ${radiusField}
          <button type="button" class="nodalia-vlayout-controls__remove" data-vlayout-ctx-remove>${this._propsLabel("ed.light.vlayout_props_remove", "Remove block")}</button>
        </div>
      `;
    }

    _syncControlOutputs() {
      const item = this._getItem(this._selectedId);
      if (!item) {
        return;
      }
      const roots = [
        this._host.querySelector(".nodalia-vlayout-inspector"),
        this._contextMenuEl,
      ].filter(Boolean);
      roots.forEach(root => {
        const wOut = root.querySelector("[data-vlayout-ctx-w-value]");
        const hOut = root.querySelector("[data-vlayout-ctx-h-value]");
        const dOut = root.querySelector("[data-vlayout-ctx-diameter-value]");
        const rOut = root.querySelector("[data-vlayout-ctx-radius-value]");
        if (wOut) {
          wOut.textContent = String(item.w);
        }
        if (hOut) {
          hOut.textContent = String(item.h);
        }
        if (dOut) {
          dOut.textContent = String(Math.max(item.w, item.h));
        }
        if (rOut) {
          rOut.textContent = `${item.radius ?? 50}px`;
        }
        root.querySelectorAll(".nodalia-vlayout-swatch").forEach(btn => {
          btn.classList.toggle("is-active", btn.dataset.vlayoutColor === this._readBlockColor(this._selectedId));
        });
      });
    }

    _onControlsInput(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.dataset?.vlayoutCtx) {
        return;
      }
      this._applyContextMenuInput(target);
    }

    _onControlsClick(event) {
      if (!event.target.closest("[data-vlayout-ctx-remove]")) {
        return;
      }
      event.preventDefault();
      const blockId = this._selectedId;
      const removeItem = this._getItem(blockId);
      if (removeItem) {
        removeItem.visible = false;
      }
      if (this._selectedId === blockId) {
        this._selectedId = this._draft.items.find(entry => entry.visible !== false)?.id || "";
      }
      this._hideContextMenu();
      this._scheduleLiveSync();
      this._refreshChrome();
      this._notifyChange();
    }

    _bindControlsRoot(root) {
      if (!root || root.dataset.vlayoutControlsBound === "true") {
        return;
      }
      root.dataset.vlayoutControlsBound = "true";
      root.addEventListener("input", this._onControlsInput);
      root.addEventListener("click", this._onControlsClick);
    }

    _bindInspectorDelegation() {
      const host = this._host.querySelector(".nodalia-vlayout-inspector");
      if (!host || host.dataset.vlayoutInspectorBound === "true") {
        return;
      }
      host.dataset.vlayoutInspectorBound = "true";
      host.addEventListener("input", this._onControlsInput);
      host.addEventListener("click", this._onControlsClick);
    }

    _renderInspector() {
      const host = this._host.querySelector(".nodalia-vlayout-inspector");
      if (!host) {
        return;
      }
      const item = this._getItem(this._selectedId);
      if (!item) {
        host.innerHTML = `
          <div class="nodalia-vlayout-inspector__empty">
            ${this._propsLabel("ed.light.vlayout_inspector_hint", "Select a block on the card, or right-click for the same controls.")}
          </div>
        `;
        host.classList.remove("has-selection");
        return;
      }
      host.classList.add("has-selection");
      host.innerHTML = `<div class="nodalia-vlayout-controls nodalia-vlayout-controls--inspector">${this._getBlockControlsMarkup(item.id)}</div>`;
    }

    _positionContextMenu(menu, clientX, clientY) {
      const margin = 8;
      menu.style.visibility = "hidden";
      menu.style.left = "0";
      menu.style.top = "0";
      const mount = this._getOverlayMount();
      mount?.appendChild(menu);
      const rect = menu.getBoundingClientRect();
      let left = clientX + 4;
      let top = clientY + 4;
      if (left + rect.width > window.innerWidth - margin) {
        left = Math.max(margin, clientX - rect.width - 4);
      }
      if (top + rect.height > window.innerHeight - margin) {
        top = Math.max(margin, clientY - rect.height - 4);
      }
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.style.visibility = "";
    }

    _showContextMenu(clientX, clientY, blockId) {
      this._hideContextMenu();
      if (!this._getItem(blockId)) {
        return;
      }

      const menu = document.createElement("div");
      menu.className = "nodalia-vlayout-context-menu";
      menu.innerHTML = `<div class="nodalia-vlayout-controls nodalia-vlayout-controls--menu">${this._getBlockControlsMarkup(blockId)}</div>`;
      this._bindControlsRoot(menu.querySelector(".nodalia-vlayout-controls"));

      this._positionContextMenu(menu, clientX, clientY);
      this._contextMenuEl = menu;
      this._contextMenuSuppressUntil = Date.now() + 450;
      document.addEventListener("pointerdown", this._onDocumentPointerDown, true);
    }

    _onHitContextMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      const blockId = this._hitTestBlockAt(event.clientX, event.clientY);
      if (blockId) {
        this._openBlockProperties(event.clientX, event.clientY, blockId);
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

      const radiusField = item.id === "icon"
        ? `
          <label class="nodalia-vlayout-field">
            <span>${this._propsLabel("ed.light.vlayout_props_radius", "Icon corner radius")}</span>
            <input type="range" min="0" max="80" step="1" data-vlayout-prop="radius" value="${item.radius ?? 50}" />
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
          ${radiusField}
          <button type="button" class="nodalia-vlayout-remove-block" data-vlayout-remove="${item.id}">
            ${this._propsLabel("ed.light.vlayout_props_remove", "Remove block")}
          </button>
        </div>
      `;
    }

    _refreshChrome() {
      if (this._isLiveMode()) {
        this._renderInspector();
        this._renderPaletteDock();
      } else {
        this._renderSidebar();
      }
    }

    _renderPaletteDock() {
      const dock = this._host.querySelector(".nodalia-vlayout-palette-dock");
      if (!dock) {
        return;
      }
      const palette = Object.keys(this._catalog)
        .filter(id => !this._draft.items.some(item => item.id === id && item.visible !== false))
        .map(id => `
          <button
            type="button"
            class="nodalia-vlayout-palette__item"
            data-vlayout-add="${id}"
            data-vlayout-palette-drag="${id}"
            draggable="true"
          >
            <span class="nodalia-vlayout-palette__grip" aria-hidden="true">⠿</span>
            <span class="nodalia-vlayout-palette__label">${this._label(id)}</span>
          </button>
        `)
        .join("");

      dock.innerHTML = `
        <div class="nodalia-vlayout-palette-dock__label">${this._options.paletteTitle || "Available blocks"}</div>
        <div class="nodalia-vlayout-palette nodalia-vlayout-palette--dock">
          ${palette || `<span class="nodalia-vlayout-muted">${this._propsLabel("ed.light.vlayout_palette_empty", "All blocks placed")}</span>`}
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
          <button
            type="button"
            class="nodalia-vlayout-palette__item"
            data-vlayout-add="${id}"
            data-vlayout-palette-drag="${id}"
            draggable="true"
          >
            <span class="nodalia-vlayout-palette__grip" aria-hidden="true">⠿</span>
            <span class="nodalia-vlayout-palette__label">${this._label(id)}</span>
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

    /**
     * Builds live preview DOM:
     * `.nodalia-vlayout-live-stage` > card + hit layer + frames layer.
     * Width comes from `--nodalia-vlayout-preview-width` (set from HA editor preview).
     */
    _mountLiveCard() {
      const host = this._host.querySelector(".nodalia-vlayout-live-host");
      if (!host) {
        return;
      }
      const tag = this._livePreview.cardTag || "nodalia-light-card";
      const width = this._livePreview.previewWidthPx || 360;
      let stage = host.querySelector(".nodalia-vlayout-live-stage");
      if (!stage) {
        host.innerHTML = "";
        stage = document.createElement("div");
        stage.className = "nodalia-vlayout-live-stage";
        const gridGuide = document.createElement("div");
        gridGuide.className = "nodalia-vlayout-grid-guide";
        gridGuide.setAttribute("aria-hidden", "true");
        const hitLayer = document.createElement("div");
        hitLayer.className = "nodalia-vlayout-hit-layer";
        const framesLayer = document.createElement("div");
        framesLayer.className = "nodalia-vlayout-frames";
        framesLayer.setAttribute("aria-hidden", "true");
        stage.appendChild(gridGuide);
        stage.appendChild(hitLayer);
        stage.appendChild(framesLayer);
        host.appendChild(stage);
      }
      const hostWidth = host.clientWidth || width;
      const previewWidth = Math.max(300, Math.min(Math.round(hostWidth - 16), 560, width));
      stage.style.setProperty("--nodalia-vlayout-preview-width", `${previewWidth}px`);
      if (!this._cardEl) {
        this._cardEl = document.createElement(tag);
        stage.insertBefore(this._cardEl, stage.firstChild);
      }
      this._syncLiveCardConfig();
    }

    _render() {
      if (this._isLiveMode()) {
        this._host.innerHTML = `
          <div class="nodalia-vlayout-workspace nodalia-vlayout-workspace--live">
            <div class="nodalia-vlayout-live-host"></div>
            <div class="nodalia-vlayout-inspector"></div>
            <div class="nodalia-vlayout-palette-dock"></div>
          </div>
        `;
        this._mountLiveCard();
        this._bindInspectorDelegation();
        this._refreshChrome();
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
      // Hit layer receives events; the card underneath has pointer-events disabled.
      const canvas = this._isLiveMode()
        ? this._getLiveStage()?.querySelector(".nodalia-vlayout-hit-layer")
        : this._host.querySelector(".nodalia-vlayout-canvas");
      if (!canvas) {
        return;
      }
      canvas.addEventListener("pointerdown", this._onCanvasPointerDown, { signal });
      canvas.addEventListener("pointermove", this._onCanvasPointerMove, { signal });
      canvas.addEventListener("pointerup", this._onCanvasPointerUp, { signal });
      canvas.addEventListener("pointercancel", this._onCanvasPointerUp, { signal });
      if (this._isLiveMode()) {
        const stage = this._getLiveStage();
        canvas.addEventListener("contextmenu", this._onHitContextMenu, { signal });
        canvas.addEventListener("auxclick", this._onAuxClick, { signal });
        stage?.addEventListener("contextmenu", this._onHitContextMenu, { signal });
        stage?.addEventListener("auxclick", this._onAuxClick, { signal });
        canvas.addEventListener("dragover", this._onCanvasDragOver, { signal });
        canvas.addEventListener("drop", this._onCanvasDrop, { signal });
      }
      this._host.addEventListener("dragstart", this._onPaletteDragStart, { signal });
      this._host.addEventListener("dragend", () => {
        this._paletteDragId = "";
        this._updateDropIndicator(null);
      }, { signal });
    }

    _onPaletteDragStart(event) {
      const paletteBtn = event.target.closest("[data-vlayout-palette-drag]");
      if (!paletteBtn) {
        return;
      }
      const blockId = paletteBtn.dataset.vlayoutPaletteDrag;
      if (!blockId) {
        return;
      }
      this._paletteDragId = blockId;
      event.dataTransfer?.setData("application/x-nodalia-vlayout-block", blockId);
      event.dataTransfer?.setData("text/plain", blockId);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "copy";
      }
    }

    _onCanvasDragOver(event) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
      const cell = this._cellFromPointer(event.clientX, event.clientY);
      if (!cell) {
        return;
      }
      let ghost = this._selectedId ? this._getItem(this._selectedId) : null;
      if (this._paletteDragId) {
        ghost = normalizeItem({ id: this._paletteDragId }, this._catalog, this._draft.columns, this._draft.rows)
          || ghost;
      }
      if (ghost) {
        this._updateDropIndicator({ ...ghost, x: cell.x, y: cell.y });
      }
    }

    _onCanvasDrop(event) {
      event.preventDefault();
      const blockId = event.dataTransfer?.getData("application/x-nodalia-vlayout-block")
        || event.dataTransfer?.getData("text/plain");
      if (!blockId) {
        return;
      }
      const cell = this._cellFromPointer(event.clientX, event.clientY);
      if (!cell) {
        return;
      }
      this._addBlockAtCell(blockId, cell.x, cell.y);
      this._paletteDragId = "";
      this._updateDropIndicator(null);
    }

    _onHandlePointerDown(event) {
      const handle = event.target.closest("[data-vlayout-handle]");
      if (!handle || !this._isLiveMode()) {
        return;
      }
      const edge = handle.dataset.vlayoutHandle;
      const id = handle.dataset.vlayoutId;
      const item = this._getItem(id);
      if (!item || !edge) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this._selectItem(id);
      this._hideContextMenu();
      const captureTarget = handle;
      captureTarget.setPointerCapture?.(event.pointerId);
      this._resize = {
        id,
        edge,
        pointerId: event.pointerId,
        captureTarget,
      };
      const frame = this._getLiveStage()?.querySelector(`.nodalia-vlayout-frame[data-vlayout-id="${id}"]`);
      frame?.classList.add("is-resizing");
      if (typeof window !== "undefined") {
        window.addEventListener("pointermove", this._onHandlePointerMove);
        window.addEventListener("pointerup", this._onHandlePointerUp);
        window.addEventListener("pointercancel", this._onHandlePointerUp);
      }
    }

    _onHandlePointerMove(event) {
      if (!this._resize || event.pointerId !== this._resize.pointerId) {
        return;
      }
      const item = this._getItem(this._resize.id);
      if (!item) {
        return;
      }
      const pointerCell = this._cellFromPointer(event.clientX, event.clientY);
      if (!pointerCell) {
        return;
      }
      const edge = this._resize.edge;
      if (edge === "e" || edge === "se") {
        item.w = clampInt(pointerCell.x + 1 - item.x, 1, this._draft.columns - item.x);
      }
      if (edge === "s" || edge === "se") {
        item.h = clampInt(pointerCell.y + 1 - item.y, 1, this._draft.rows - item.y);
      }
      if (this._isCircularBlock(item.id)) {
        const size = Math.max(item.w, item.h);
        item.w = clampInt(size, 1, this._draft.columns - item.x);
        item.h = clampInt(size, 1, this._draft.rows - item.y);
      }
      this._applyItemStyleToDom(item);
      this._updateDropIndicator(item);
      this._scheduleFrameUpdate();
    }

    _detachResizeWindowListeners() {
      if (typeof window === "undefined") {
        return;
      }
      window.removeEventListener("pointermove", this._onHandlePointerMove);
      window.removeEventListener("pointerup", this._onHandlePointerUp);
      window.removeEventListener("pointercancel", this._onHandlePointerUp);
    }

    _onHandlePointerUp(event) {
      if (!this._resize || event.pointerId !== this._resize.pointerId) {
        return;
      }
      const item = this._getItem(this._resize.id);
      try {
        this._resize.captureTarget?.releasePointerCapture?.(event.pointerId);
      } catch (_error) {
        // ignore
      }
      this._detachResizeWindowListeners();
      this._getLiveStage()?.querySelectorAll(".nodalia-vlayout-frame.is-resizing").forEach(node => {
        node.classList.remove("is-resizing");
      });
      if (item) {
        const open = findOpenCell(this._draft, item, item.id, {
          preferX: item.x,
          preferY: item.y,
        });
        item.x = open.x;
        item.y = open.y;
        this._applyItemStyleToDom(item);
        this._notifyChange();
        this._scheduleLiveSync();
      }
      this._resize = null;
      this._updateDropIndicator(null);
      this._scheduleFrameUpdate();
      this._refreshChrome();
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
      if (this._isLiveMode()) {
        this._scheduleFrameUpdate();
        this._renderInspector();
      }
      this._refreshChrome();
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
      this._refreshChrome();
      this._scheduleLiveSync();
      this._notifyChange();
    }

    /**
     * Pointer routing: live mode uses frame hit-test on the overlay;
     * grid mode uses `.nodalia-vlayout-placed` cells.
     */
    _onCanvasPointerDown(event) {
      if (this._isLiveMode() && event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
        const blockId = this._hitTestBlockAt(event.clientX, event.clientY);
        if (blockId) {
          this._openBlockProperties(event.clientX, event.clientY, blockId);
        } else {
          this._selectItem("");
          this._hideContextMenu();
        }
        return;
      }
      if (this._isLiveMode() && typeof event.button === "number" && event.button !== 0) {
        return;
      }

      const removeBtn = event.target.closest("[data-vlayout-remove]");
      if (removeBtn) {
        return;
      }

      let blockId = "";
      let placed = null;
      if (this._isLiveMode()) {
        blockId = this._hitTestBlockAt(event.clientX, event.clientY);
        if (!blockId) {
          this._selectItem("");
          return;
        }
      } else {
        placed = event.target.closest(".nodalia-vlayout-placed");
        if (!placed) {
          this._selectItem("");
          return;
        }
        blockId = placed.dataset.vlayoutId;
      }

      if (blockId) {
        const id = blockId;
        const item = this._getItem(id);
        if (!item) {
          return;
        }
        event.preventDefault();
        this._selectItem(id);
        const captureTarget = this._isLiveMode()
          ? this._getLiveStage()?.querySelector(".nodalia-vlayout-hit-layer")
          : this._host.querySelector(".nodalia-vlayout-canvas");
        captureTarget?.setPointerCapture?.(event.pointerId);
        this._drag = {
          id,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: item.x,
          originY: item.y,
          moved: false,
        };
        if (this._isLiveMode()) {
          const frame = this._getLiveStage()?.querySelector(`.nodalia-vlayout-frame[data-vlayout-id="${id}"]`);
          frame?.classList.add("is-dragging");
        } else {
          placed.classList.add("is-dragging");
        }
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
      this._updateDropIndicator(item);
      if (this._isLiveMode()) {
        this._scheduleFrameUpdate();
      }
    }

    _onCanvasPointerUp(event) {
      if (!this._drag || event.pointerId !== this._drag.pointerId) {
        return;
      }

      const item = this._getItem(this._drag.id);
      const placed = this._isLiveMode()
        ? this._cardEl?.shadowRoot?.querySelector(`.light-card__visual-item[data-vlayout-id="${this._drag.id}"]`)
        : this._host.querySelector(`.nodalia-vlayout-placed[data-vlayout-id="${this._drag.id}"]`);
      const captureTarget = this._isLiveMode()
        ? this._getLiveStage()?.querySelector(".nodalia-vlayout-hit-layer")
        : this._host.querySelector(".nodalia-vlayout-canvas");
      if (this._isLiveMode()) {
        this._getLiveStage()?.querySelectorAll(".nodalia-vlayout-frame.is-dragging").forEach(node => {
          node.classList.remove("is-dragging");
        });
      } else if (placed) {
        placed.classList.remove("is-dragging");
      }
      try {
        captureTarget?.releasePointerCapture?.(event.pointerId);
      } catch (_error) {
        // ignore
      }

      if (item && this._drag.moved) {
        const targetX = item.x;
        const targetY = item.y;
        // Keep drop position; only nudge if another block occupies the same cells.
        const open = findOpenCell(this._draft, item, item.id, {
          preferX: targetX,
          preferY: targetY,
        });
        item.x = open.x;
        item.y = open.y;
        this._applyItemStyleToDom(item);
        this._scheduleFrameUpdate();
        this._notifyChange();
        this._scheduleLiveSync();
      }

      this._updateDropIndicator(null);
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
      } else if (prop === "radius" && item.id === "icon") {
        item.radius = clampInt(target.value, 0, 999);
      }
      const open = findOpenCell(this._draft, item, item.id);
      item.x = open.x;
      item.y = open.y;
      this._applyItemStyleToDom(item);
      this._scheduleFrameUpdate();
      this._refreshChrome();
      this._scheduleLiveSync();
      this._notifyChange();
    }

    handleKeyDown(event) {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }
      if (
        event.target.closest(".nodalia-vlayout-context-menu")
        || event.target.matches("input, textarea, select, button")
      ) {
        return;
      }
      const item = this._getItem(this._selectedId);
      if (!item) {
        if (event.key === "Escape") {
          this._hideContextMenu();
        }
        return;
      }
      const step = event.shiftKey ? 2 : 1;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        item.x = clampInt(item.x - step, 0, this._draft.columns - item.w);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        item.x = clampInt(item.x + step, 0, this._draft.columns - item.w);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        item.y = clampInt(item.y - step, 0, this._draft.rows - item.h);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        item.y = clampInt(item.y + step, 0, this._draft.rows - item.h);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        item.visible = false;
        this._selectedId = this._draft.items.find(entry => entry.visible !== false)?.id || "";
        if (this._isLiveMode()) {
          this._scheduleLiveSync();
        } else {
          this._renderCanvas();
        }
        this._refreshChrome();
        this._scheduleFrameUpdate();
        this._notifyChange();
        return;
      } else if (event.key === "Escape") {
        this._hideContextMenu();
        return;
      } else {
        return;
      }
      const open = findOpenCell(this._draft, item, item.id, {
        preferX: item.x,
        preferY: item.y,
      });
      item.x = open.x;
      item.y = open.y;
      this._applyItemStyleToDom(item);
      this._scheduleFrameUpdate();
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
          this._refreshChrome();
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
        this._refreshChrome();
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
        this._refreshChrome();
        this._notifyChange();
      }
    }

    destroy() {
      this._hideContextMenu();
      this._detachResizeWindowListeners();
      this._resize = null;
      this._canvasAbort?.abort();
      this._handlesAbort?.abort();
      if (this._liveSyncTimer) {
        window.cancelAnimationFrame(this._liveSyncTimer);
      }
      if (this._frameRaf) {
        window.cancelAnimationFrame(this._frameRaf);
        this._frameRaf = null;
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
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent);
      border-radius: 20px;
      box-shadow:
        0 24px 80px rgba(0, 0, 0, 0.45),
        0 0 0 1px color-mix(in srgb, var(--primary-color) 12%, transparent);
      color: var(--primary-text-color);
      margin: auto;
      max-height: calc(100vh - 20px);
      max-width: min(1180px, calc(100vw - 20px));
      overflow: hidden;
      padding: 0;
      width: calc(100vw - 20px);
      background: var(--card-background-color, var(--ha-card-background, #1c1c1c));
    }
    dialog.nodalia-vlayout-dialog::backdrop {
      background: color-mix(in srgb, #000 62%, transparent);
      backdrop-filter: blur(4px);
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
      padding: 14px 18px;
    }
    .nodalia-vlayout-overlay__header {
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--primary-color) 10%, transparent),
        transparent
      );
      border-bottom: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
    }
    .nodalia-vlayout-overlay__footer {
      border-top: 1px solid var(--divider-color);
      flex-wrap: wrap;
      gap: 10px;
      justify-content: space-between;
    }
    .nodalia-vlayout-overlay__shortcuts {
      color: var(--secondary-text-color);
      flex: 1 1 220px;
      font-size: 11px;
      line-height: 1.45;
      min-width: 0;
    }
    .nodalia-vlayout-overlay__footer-actions {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
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
    .nodalia-vlayout-overlay__header-actions {
      align-items: center;
      display: flex;
      gap: 8px;
    }
    .nodalia-vlayout-power-toggle {
      appearance: none;
      background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
      border-radius: 999px;
      color: var(--primary-text-color);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      min-height: 34px;
      padding: 0 14px;
    }
    .nodalia-vlayout-power-toggle.is-on {
      background: color-mix(in srgb, var(--primary-color) 22%, transparent);
      border-color: var(--primary-color);
      color: var(--primary-color);
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
      font-weight: 600;
      min-height: 38px;
      padding: 0 16px;
      transition: background 140ms ease, border-color 140ms ease, transform 100ms ease;
    }
    .nodalia-vlayout-overlay__footer button:hover {
      border-color: color-mix(in srgb, var(--primary-text-color) 22%, transparent);
    }
    .nodalia-vlayout-overlay__footer button.primary {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: var(--text-primary-color, #fff);
    }
    .nodalia-vlayout-overlay__footer button.primary:hover {
      filter: brightness(1.06);
    }
    .nodalia-vlayout-workspace {
      display: grid;
      gap: 16px;
      grid-template-columns: minmax(0, 1fr) 272px;
      min-height: 420px;
    }
    .nodalia-vlayout-workspace--live {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) auto auto;
      min-height: 480px;
    }
    .nodalia-vlayout-live-host {
      align-items: stretch;
      background: transparent;
      border: 0;
      border-radius: 0;
      display: flex;
      justify-content: center;
      min-height: 280px;
      overflow: visible;
      padding: 8px 4px 4px;
      width: 100%;
    }
    .nodalia-vlayout-inspector {
      background: color-mix(in srgb, var(--primary-text-color) 3%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent);
      border-radius: 14px;
      margin-top: 4px;
      padding: 10px 12px;
    }
    .nodalia-vlayout-inspector__empty {
      color: var(--secondary-text-color);
      font-size: 12px;
      line-height: 1.45;
    }
    .nodalia-vlayout-controls__grid {
      align-items: end;
      display: grid;
      gap: 10px 14px;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }
    .nodalia-vlayout-controls--menu .nodalia-vlayout-controls__grid {
      grid-template-columns: 1fr;
    }
    .nodalia-vlayout-controls__title {
      font-size: 12px;
      font-weight: 700;
      grid-column: 1 / -1;
    }
    .nodalia-vlayout-controls__swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      grid-column: 1 / -1;
    }
    .nodalia-vlayout-controls__field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .nodalia-vlayout-controls__field-head {
      align-items: center;
      display: flex;
      font-size: 11px;
      font-weight: 600;
      justify-content: space-between;
    }
    .nodalia-vlayout-controls__field input[type="range"] {
      accent-color: var(--primary-color);
      width: 100%;
    }
    .nodalia-vlayout-controls__remove {
      appearance: none;
      background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
      border-radius: 10px;
      color: var(--primary-text-color);
      cursor: pointer;
      font: inherit;
      grid-column: 1 / -1;
      min-height: 34px;
    }
    .nodalia-vlayout-palette-dock {
      border-top: 1px solid var(--divider-color);
      display: grid;
      gap: 8px;
      padding: 10px 4px 2px;
    }
    .nodalia-vlayout-palette-dock__label {
      color: var(--secondary-text-color);
      font-size: 11px;
      font-weight: 600;
    }
    .nodalia-vlayout-palette--dock {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .nodalia-vlayout-palette--dock .nodalia-vlayout-palette__item {
      width: auto;
    }
    .nodalia-vlayout-grid-guide {
      display: none;
    }
    .nodalia-vlayout-drop-indicator {
      background: color-mix(in srgb, var(--primary-color) 16%, transparent);
      border: 2px solid var(--primary-color);
      border-radius: 10px;
      box-sizing: border-box;
      pointer-events: none;
      position: absolute;
      transition: left 80ms ease, top 80ms ease, width 80ms ease, height 80ms ease;
      z-index: 2;
    }
    .nodalia-vlayout-live-stage {
      margin-inline: auto;
      position: relative;
      width: min(var(--nodalia-vlayout-preview-width, 360px), 100%);
      max-width: 100%;
    }
    .nodalia-vlayout-live-stage > nodalia-light-card {
      display: block;
      width: 100%;
    }
    .nodalia-vlayout-hit-layer {
      inset: 0;
      position: absolute;
      touch-action: none;
      z-index: 3;
    }
    .nodalia-vlayout-frames {
      inset: 0;
      pointer-events: none;
      position: absolute;
      z-index: 4;
    }
    .nodalia-vlayout-frame {
      border: 1px dashed color-mix(in srgb, var(--primary-text-color) 28%, transparent);
      box-sizing: border-box;
      pointer-events: none;
      position: absolute;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .nodalia-vlayout-frame.is-idle {
      opacity: 0.35;
    }
    .nodalia-vlayout-frame.is-selected {
      border: 2px solid var(--primary-color);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary-color) 30%, transparent);
      opacity: 1;
    }
    .nodalia-vlayout-frame.is-dragging,
    .nodalia-vlayout-frame.is-resizing {
      border-style: solid;
      opacity: 1;
      box-shadow: 0 4px 16px color-mix(in srgb, var(--primary-color) 22%, transparent);
    }
    .nodalia-vlayout-handles {
      inset: 0;
      pointer-events: none;
      position: absolute;
      z-index: 6;
    }
    .nodalia-vlayout-handle {
      appearance: none;
      background: var(--primary-color);
      border: 2px solid var(--card-background-color, #1c1c1c);
      border-radius: 999px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
      cursor: pointer;
      height: 12px;
      margin: 0;
      padding: 0;
      pointer-events: auto;
      position: absolute;
      touch-action: none;
      width: 12px;
      z-index: 7;
    }
    .nodalia-vlayout-handle--e {
      cursor: ew-resize;
    }
    .nodalia-vlayout-handle--s {
      cursor: ns-resize;
    }
    .nodalia-vlayout-handle--se {
      cursor: nwse-resize;
    }
    .nodalia-vlayout-frame[style*="--frame-tint"] {
      border-color: color-mix(in srgb, var(--frame-tint) 55%, var(--primary-color));
    }
    .nodalia-vlayout-context-menu {
      background: var(--card-background-color, var(--ha-card-background, #1c1c1c));
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
      border-radius: 14px;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
      display: grid;
      gap: 10px;
      max-width: min(280px, calc(100vw - 24px));
      min-width: 220px;
      padding: 12px;
      position: fixed;
      z-index: 2147483647;
    }
    .nodalia-vlayout-context-menu__title {
      font-size: 13px;
      font-weight: 700;
    }
    .nodalia-vlayout-context-menu__swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .nodalia-vlayout-swatch {
      appearance: none;
      background: var(--swatch);
      border: 2px solid color-mix(in srgb, var(--primary-text-color) 18%, transparent);
      border-radius: 999px;
      cursor: pointer;
      height: 22px;
      margin: 0;
      padding: 0;
      width: 22px;
    }
    .nodalia-vlayout-swatch.is-active {
      border-color: var(--primary-text-color);
      box-shadow: 0 0 0 2px var(--primary-color);
    }
    .nodalia-vlayout-context-menu__field {
      display: grid;
      gap: 6px;
    }
    .nodalia-vlayout-context-menu__field-head {
      align-items: center;
      display: flex;
      font-size: 11px;
      font-weight: 600;
      justify-content: space-between;
    }
    .nodalia-vlayout-context-menu__field-head output {
      color: var(--secondary-text-color);
      font-size: 11px;
      font-weight: 700;
    }
    .nodalia-vlayout-context-menu__field input[type="range"] {
      accent-color: var(--primary-color);
      width: 100%;
    }
    .nodalia-vlayout-context-menu__field--color input[type="color"] {
      border: 0;
      height: 32px;
      padding: 0;
      width: 100%;
    }
    .nodalia-vlayout-context-menu__remove {
      appearance: none;
      background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
      border-radius: 10px;
      color: var(--primary-text-color);
      cursor: pointer;
      font: inherit;
      min-height: 34px;
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
      background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 100%;
      min-width: 0;
      overflow: auto;
      padding: 12px;
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
      cursor: grab;
      font: inherit;
      font-size: 11px;
      padding: 6px 10px;
    }
    .nodalia-vlayout-palette__item {
      align-items: center;
      display: flex;
      gap: 8px;
      text-align: left;
      width: 100%;
    }
    .nodalia-vlayout-palette__item:active {
      cursor: grabbing;
    }
    .nodalia-vlayout-palette__grip {
      color: var(--secondary-text-color);
      font-size: 14px;
      line-height: 1;
    }
    .nodalia-vlayout-palette__label {
      flex: 1;
      min-width: 0;
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

  /**
   * Opens the full-screen layout editor from a card editor element.
   *
   * @param {HTMLElement} editorHost - Card editor (e.g. `nodalia-light-card-editor`); used as event context only.
   * @param {object} options
   * @param {object} options.catalog - Block definitions (per card type).
   * @param {object} options.layout - Initial layout from config.
   * @param {object} [options.livePreview] - `{ cardTag, hass, getConfig, previewWidthPx }` for WYSIWYG mode.
   * @param {Function} options.onSave - Receives `serializeLayoutForSave` output; must write Lovelace YAML.
   * @returns {{ dialog, surface, close }}
   */
  function attachEditorOverlay(editorHost, options) {
    ensureOverlayStyles();

    const layout = resolveEditorLayout(options.layout, options.catalog, options);
    const powerPreview = options.livePreview?.powerPreview;
    const powerToggleMarkup = powerPreview?.supportsToggle
      ? `<button type="button" class="nodalia-vlayout-power-toggle" data-vlayout-toggle-power aria-pressed="${powerPreview.isOn ? "true" : "false"}">${powerPreview.isOn ? powerPreview.labelOn : powerPreview.labelOff}</button>`
      : "";
    const panelMarkup = `
      <div class="nodalia-vlayout-overlay__panel">
        <header class="nodalia-vlayout-overlay__header">
          <div>
            <div class="nodalia-vlayout-overlay__title">${options.title || "Visual layout"}</div>
            <div class="nodalia-vlayout-overlay__hint">${options.hint || "Drag blocks on the live card preview. Save writes YAML."}</div>
          </div>
          <div class="nodalia-vlayout-overlay__header-actions">
            ${powerToggleMarkup}
            <button type="button" class="nodalia-vlayout-overlay__close" data-vlayout-close aria-label="Close">×</button>
          </div>
        </header>
        <div class="nodalia-vlayout-overlay__body"></div>
        <footer class="nodalia-vlayout-overlay__footer">
          <div class="nodalia-vlayout-overlay__shortcuts">${options.shortcutsHint || "Drag blocks · Corner handles resize · Arrow keys nudge · Del removes · Right-click properties"}</div>
          <div class="nodalia-vlayout-overlay__footer-actions">
            <button type="button" data-vlayout-cancel>${options.cancelLabel || "Cancel"}</button>
            <button type="button" data-vlayout-reset>${options.resetLabel || "Reset"}</button>
            <button type="button" data-vlayout-save class="primary">${options.saveLabel || "Save layout"}</button>
          </div>
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
      overlayRoot: dialog,
      styleHandlers: options.styleHandlers,
      livePreview: options.livePreview,
      onChange: options.onDraftChange,
    });
    surface._powerPreview = powerPreview || null;
    surface.mount();
    surface._updatePowerToggleButton(dialog);
    dialog.tabIndex = -1;
    window.requestAnimationFrame(() => dialog.focus());

    const close = () => {
      surface.destroy();
      if (dialog.open) {
        dialog.close();
      }
      dialog.remove();
      options.onClose?.();
    };

    const onDialogClick = event => {
      if (event.target.closest("[data-vlayout-close], [data-vlayout-cancel]")) {
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
      if (event.target.closest("[data-vlayout-toggle-power]")) {
        event.preventDefault();
        surface._powerPreview?.toggle?.().then?.(() => {
          surface._updatePowerToggleButton(dialog);
          surface._scheduleLiveSync();
        });
        return;
      }
      if (event.target.closest("[data-vlayout-save]")) {
        event.preventDefault();
        event.stopPropagation();
        const saved = serializeLayoutForSave(surface.layout, { positionOnly: Boolean(options.styleHandlers) });
        options.onSave?.(saved, surface.getPreviewConfig());
        close();
        return;
      }
      surface.handleClick(event);
    };

    dialog.addEventListener("click", onDialogClick, true);
    dialog.addEventListener("contextmenu", event => surface._onHitContextMenu(event), true);
    dialog.addEventListener("input", event => surface.handleInput(event), true);
    dialog.addEventListener("keydown", event => surface.handleKeyDown(event));
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      close();
    });

    return { dialog, surface, close };
  }

  /** Public surface attached to `window.NodaliaVisualLayout` (see file header for contract). */
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
    findOpenCell,
    cellHasCollision,
    createSurface: (host, options) => new VisualLayoutSurface(host, options),
    attachEditorOverlay,
    ensureOverlayStyles,
    openOverlayDialog,
  };

  if (typeof window !== "undefined") {
    window.NodaliaVisualLayout = api;
  }
})();
