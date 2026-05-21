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
3. Draft layout lives in `surface.layout` (`this._draft`).
4. **Save layout** → `serializeLayoutForSave` → light card `_commitVisualLayout` → `config-changed` event → Lovelace YAML.
5. Dashboard card reads `visual_layout` in `normalizeConfig` and renders via `_renderVisualLayoutGrid`.

## Debugging checklist

| Symptom | Likely cause |
|---------|----------------|
| Editor behind HA dialog | Overlay not using `showModal()` |
| Card toggles on tap | Missing `data-vlayout-editing` guard on `_onShadowClick` / pointer |
| Drag snaps back on release | `findOpenCell` not using `preferX`/`preferY` |
| YAML missing `visual_layout` | Save path not calling `serializeLayoutForSave` or strip removing it |
| Preview wider than dashboard | `previewWidthPx` not matching `hui-card-preview` width |
| Context menu sliders do nothing | Missing `_applyContextMenuInput` (regression guard in tests) |
| Resize handles missing | Block catalog needs `props.resize: true`; handles render on selected frame |
| Orange boxes obscure card | Selection uses grid item bounds; properties via right-click menu, not sidebar |

## Adding another card type

1. Define `MY_CARD_VISUAL_LAYOUT_CATALOG` (copy shape from light card).
2. Build `blocksById` at runtime and call `renderPlacedBlocks`.
3. Wire editor button to `attachEditorOverlay` with `catalog` + `livePreview`.
4. Extend `BLOCK_FOCUS_SELECTORS` in the visual layout module (or move selectors into per-card catalog).
