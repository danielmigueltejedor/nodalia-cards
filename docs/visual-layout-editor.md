# Visual layout editor — maintainer guide

This document complements inline comments in `nodalia-visual-layout-editor.js` and the light card integration.
For the full card suite overview see [cards-architecture.md](./cards-architecture.md).

## Files

| File | Role |
|------|------|
| `nodalia-visual-layout-editor.js` | Shared module (`window.NodaliaVisualLayout`) |
| `nodalia-light-card.js` | Catalog, runtime grid, editor entry, `data-vlayout-editing` guards |
| `scripts/build-bundle.mjs` | Bundles visual layout **before** dependent cards |
| `tests/visual-layout-find-cell.test.mjs` | Regression test for drag snap-back (`findOpenCell`) |

## Data flow

1. User opens **Open visual layout editor** in the light card editor.
2. `attachEditorOverlay` opens a `<dialog>` and creates `VisualLayoutSurface` with `livePreview`.
3. Draft layout lives in `surface.layout` (`this._draft`) — **positions only** (`x`, `y`, `w`, `h`, `id`).
4. Right-click a block for **layout** (only the controls that block uses: e.g. icon → diameter + `styles.icon.*`; presets → accent colors when visible) and **styles** filtered per block. Blocks hidden by config or off-state show layout + a hint only. Right-click empty preview area for **card** styles.
5. **Save layout** → `serializeLayoutForSave(..., { positionOnly: true })` + merged `styles` from preview config → `_commitVisualLayout` → Lovelace YAML.
6. Legacy `color` / `radius` on layout items are migrated into `styles` on load and stripped from YAML on save.

## Power preview

When the entity domain supports `turn_on` / `turn_off`, the dialog header shows a toggle that calls HA services, waits for the entity state to update, then calls `refreshPreviewHass()` once so the live card re-renders (on/off layout). The preview is **not** refreshed on every HA `hass` poll (that caused constant flicker). While **on**, the preview forces `auto_expand: true` so sliders and sections are visible for layout. While **off**, `auto_expand` from card config applies (compact vs expanded off-state).

## Debugging checklist

| Symptom | Likely cause |
|---------|----------------|
| Editor behind HA dialog | Overlay not using `showModal()` |
| Card toggles on tap | Missing `data-vlayout-editing` guard on `_onShadowClick` / pointer |
| Drag snaps back on release | `findOpenCell` not using `preferX`/`preferY` |
| YAML missing `visual_layout` | Save path not calling `serializeLayoutForSave` or strip removing it |
| Tint not in YAML after save | Expected — check `styles.*` paths, not `visual_layout.items[].color` |
| Preview wider than dashboard | `previewWidthPx` not matching `hui-card-preview` width |
| Context menu sliders do nothing | Missing `_applyContextMenuInput` or `styleHandlers` not passed |
| Off-state preview always expanded | `auto_expand: true` forced while entity is on only |
| Power button toggles entity but preview unchanged | Missing `waitForEntityState` after service call or `refreshPreviewHass` not wired |
| Resize handles missing | Block catalog needs `props.resize: true`; handles render on selected frame |

## Adding another card type

1. Define `MY_CARD_VISUAL_LAYOUT_CATALOG` (copy shape from light card).
2. Implement `styleHandlers` (`migrateLayoutIntoConfig`, `readColor`, `applyColor`, …) mapping block ids to `styles` paths.
3. Build `blocksById` at runtime and call `renderPlacedBlocks`.
4. Wire editor button to `attachEditorOverlay` with `catalog` + `livePreview` + `styleHandlers`.
5. Extend `BLOCK_FOCUS_SELECTORS` in the visual layout module (or move selectors into per-card catalog).
