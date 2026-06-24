# Nodalia Cards — Performance & interaction audit

**Date:** 2026-05-18 (pass 1–3); refreshed **2026-06-11** for stable **`1.2.1.1`**; **2026-06-12** for **`1.2.2-alpha.1`** (graph hover patch, calendar hass gate, fav parity)  
**Scope:** Lovelace custom-card bundle (`nodalia-cards.js` / HACS artifact)  
**Target environment:** Home Assistant Core 2025.1+, dashboards with 1700+ entities, 36+ Lovelace resources, mobile + desktop  
**Bundle size (minified HACS):** ~3.8 MB (`nodalia-cards-1.2.2-alpha.1.js`; optional split core + suite)

---

## Executive summary

Nodalia Cards already uses **render signatures** on almost every dashboard card to avoid repainting on unrelated `hass` updates — the right architecture for heavy dashboards. The main costs on a busy system are:

1. **Signature computation** (`JSON.stringify` on large objects, especially advance-vacuum, power-flow, notifications).
2. **Full `shadowRoot.innerHTML` rebuilds** in `_render()` (graph, notifications, advance-vacuum, climate).
3. **Layout-driven CSS animations** (`max-height`, `margin-top`, `box-shadow`) on expand/collapse.
4. **ResizeObserver** paths that used to call `_render()` even when layout semantics did not change.

Shared utilities live in `nodalia-utils.js` (no per-card embed in repo). Optimistic UI exists on **light**, **fan**, **humidifier**, and **entity** (toggle). Timers and global listeners are **generally cleaned up** in `disconnectedCallback`.

This audit documents findings by severity and records **safe fixes applied** vs **recommended follow-ups**. **Pass 2** re-scanned all dashboard cards for hot paths missed in pass 1.

---

## Auditoría 3 — Resumen ejecutivo (2026-05-19)

| Área | Hallazgo | Acción |
|------|----------|--------|
| Fan / humidifier | `set hass` con UI optimista re-renderizaba en cada tick y **reiniciaba** la animación de expansión al encender | **Aplicado:** omitir `_render()` si la firma no cambia y hay transición activa (`_isTransitionAnimationActive`) |
| Fan / humidifier | Fill del slider empezaba ~48% después del expand (parecía scroll lento al encender) | **Aplicado:** fill desde t=0, sincronizado con collapse al apagar |
| Weather | `_ensureForecastSubscription()` en cada `set hass` aunque la firma no cambiara | **Aplicado:** solo tras early-return fallido |

---

## Auditoría 2 — Resumen ejecutivo

| Área | Hallazgo | Acción |
|------|----------|--------|
| Climate | `_syncDraftWithState()` en **cada** `set hass` aunque la firma no cambiara | **Aplicado:** solo si hay draft, `pendingRenderAfterDrag`, o firma nueva |
| Fav / Vacuum | `ResizeObserver` repintaba aunque `layout`/`compact` en firma no cambiara (solo px) | **Aplicado:** comprobar firma antes de `_render()` |
| Power flow | Firma mapeaba todas las entidades rastreadas en cada `set hass` | **Aplicado:** caché de stamp (mismo patrón que notifications) |
| Advance vacuum | Firma sigue siendo `JSON.stringify` grande en early-return | Documentado P0 — lazy parcial ya hecho |
| Notifications | Calendario + weather aún en firma (coste medio) | Documentado — tracked entities ya cacheadas |
| Graph | Hover → `_render()` completo | Sin cambio (pedido explícito) |
| CSS animaciones | `max-height`, blur, `backdrop-filter` | Sin cambio (cambiaría percepción visual) |
| Lifecycle | Sin `console.log` en tarjetas; timers desconectados en cards principales | OK |
| i18n editor | Claves `tap_actions` presentes en JSON + catálogo | OK |

**Cobertura pass 2:** 18 módulos `*-card.js` + `nodalia-navigation-bar.js` — todos usan firma de render o `_renderIfChanged`; editores usan firma de opciones de entidad.

---

## 1. Render pipeline & `set hass`

| ID | Severity | File(s) | Issue | Solution | Regression risk |
|----|----------|---------|-------|----------|-----------------|
| R1 | **High** | `nodalia-advance-vacuum-card.js` | `_getRenderSignature()` builds a large `JSON.stringify` object on **every** `set hass`, even when render is skipped. | **Partial (pass 1):** lazy mode/dock/routine fragments. Full split stamp vs payload: follow-up. | Medium |
| R2 | **High** | `nodalia-notifications-card.js` | `_getRenderSignature()` / `_renderIfChanged()` scans many entities + calendar rows each `set hass`. | **Applied (pass 1):** tracked-entity stamp cache. Calendar/weather rows: see R13. | Medium |
| R3 | **High** | `nodalia-graph-card.js` | `_scheduleHoverRender` → full `_render()` on tooltip index change (~1457). | Update tooltip DOM / SVG highlight only. | Low–medium |
| R4 | **Medium** | `nodalia-fan-card.js`, `humidifier`, `light`, `entity` | `set hass` ran optimistic sync + signature even when signature unchanged and no pending optimistic toggle. | **Applied:** early return before sync when signature unchanged **and** `!_optimisticToggle` (light: turn-on/off flags). | Low |
| R5 | **Medium** | `nodalia-fan-card.js`, `humidifier`, `light`, `entity` | `ResizeObserver` called `_render()` after width/compact update even when render signature unchanged. | **Applied:** signature check before `_render()` (cover-card pattern). | Low |
| R6 | **Medium** | `nodalia-alarm-panel-card.js` | Resize always `_requestRender()` on sub-pixel width changes. | **Applied:** skip when width + compact layout unchanged. | Low |
| R7 | **Medium** | `nodalia-advance-vacuum-card.js` | Early `set hass` return did not assign `_lastRenderSignature`. | **Applied:** set signature on early return. | Low |
| R8 | **Low** | `nodalia-calendar-card.js` | `set hass` only checks locale/label signature; weather via subscriptions. | Document or add forecast entity stamp if gaps found in QA. | Low |
| R9 | **Low** | Most `*-card.js` | `JSON.stringify` render signatures vs `NodaliaRenderSignature.joinParts` (used by graph, nav, media-player). | Migrate pipe-delimited / `joinParts` signatures (see light, entity). | Low per card |
| R10 | **Medium** | `nodalia-climate-card.js` | `_syncDraftWithState()` on every `set hass` before early return. | **Applied (pass 2):** sync only when draft pending, post-drag pending, or signature changed. | Low |
| R11 | **Medium** | `nodalia-fav-card.js`, `nodalia-vacuum-card.js` | ResizeObserver called `_render()` without signature check (sub-pixel width noise). | **Applied (pass 2):** signature gate after layout bucket update. | Low |
| R12 | **Medium** | `nodalia-power-flow-card.js` | `_getRenderSignature` rebuilt tracked entity array each update. | **Applied (pass 2):** `_syncTrackedEntitiesStamp()` cache. | Low |
| R13 | **Low** | `nodalia-notifications-card.js` | Calendar + weather rows still rebuilt in signature each `set hass`. | Cache event/forecast stamps by revision (follow-up). | Medium |
| R14 | **Low** | `nodalia-weather-card.js` | `_ensureForecastSubscription()` before early return (cheap if already subscribed). | Monitor; optional skip if signature unchanged. | Low |
| R15 | **Low** | Several cards | `set hass` without `isConnected` guard (fan, light, climate…) — render only when connected via Lovelace anyway. | Optional early `if (!this.isConnected) { this._hass = hass; return; }` | Low |

**Architecture note:** Cards are **not Lit elements** — no `shouldUpdate` / `requestUpdate`. Updates are manual: `set hass` → signature → `_render()` / `_renderIfChanged()` / `_requestRender()` (alarm).

---

## 2. Timers, listeners & lifecycle

| ID | Severity | File(s) | Issue | Solution | Regression risk |
|----|----------|---------|-------|----------|-----------------|
| T1 | **Low** | All major cards | Stored timers/intervals/observers cleared in `disconnectedCallback`. | Keep pattern; audit new cards. | — |
| T2 | **Medium** | `nodalia-vacuum-card.js` | `_scheduleLayoutRefresh` / `_notifyLayoutChange` could fire `window.resize` after disconnect. | **Applied:** `isConnected` guards. | Low |
| T3 | **Low** | Many cards | Unstored one-shot `setTimeout` (button bounce, panel removal). | Optional shared `_safeTimeout` with disconnect token. | Low |
| T4 | **Low** | `nodalia-utils.js` | `scheduleCardZoneTap` / hold gesture window listeners. | Cleaned via `cancelCardZoneTap` + card `disconnectedCallback` calling detach. | — |

No `MutationObserver` usage found. `IntersectionObserver` used on calendar, graph, notifications, power-flow — all disconnected.

---

## 3. Animations & CSS cost

| ID | Severity | File(s) | Issue | Solution | Regression risk |
|----|----------|---------|-------|----------|-----------------|
| A1 | **High** | `nodalia-light-card.js` | Temp/color thumbs use `left` + `backdrop-filter: blur(12px)` during drag (layout + paint). | Position with `transform: translateX`; reduce/remove blur on thumb. | Medium (visual) |
| A2 | **High** | Fan, light, humidifier | Controls expand/collapse animates `max-height` + `margin-top` (reflow each frame). | `grid-template-rows: 0fr/1fr` + opacity, or transform-only collapse. | Medium |
| A3 | **Medium** | Fan, light | `box-shadow` in card `transition` and power keyframes. | Opacity/transform-only power glow; static end-state shadows. | Low–medium |
| A4 | **Medium** | `nodalia-fan-card.js` | Chips use `backdrop-filter: blur(18px)`. | Opaque/mixed background or config flag. | Low |
| A5 | **Low** | Fan, humidifier | Slider fill/empty uses `transform: scaleX` (good). Empty synced to controls leave with negative delay (alpha.8). | Keep; avoid re-adding separate empty + collapse double-run. | — |
| A6 | **Low** | Both | `will-change: margin-top, max-height` on shells while animating layout props. | Limit `will-change` to active animation classes only. | Low |

`prefers-reduced-motion` respected on fan/light (and similar blocks elsewhere).

---

## 4. Mobile / touch interaction

| ID | Severity | File(s) | Issue | Solution | Regression risk |
|----|----------|---------|-------|----------|-----------------|
| M1 | **Low** | Fan, light, humidifier, cover | Sliders use `touch-action: pan-y` (vertical scroll preserved). | Keep; extend to any new range inputs. | — |
| M2 | **Medium** | Light | Temp/color drag updates CSS vars every frame; combined with A1 causes jank on mobile. | See A1. | Medium |
| M3 | **Low** | Cards with tap zones | `NodaliaUtils.bindHostPointerHoldGesture` + `cancelCardZoneTap` isolate hold vs tap. | Ensure new cards use utils, not ad-hoc document listeners. | — |
| M4 | **Low** | Cover | `touch-action: manipulation` on controls (documented in tests). | Consider same on fan/light icon buttons if tap delay reported. | Low |

Tap/hold/double-tap: configured per card; body vs icon inheritance documented in editors.

---

## 5. Optimistic UI

| Card | Status | Notes |
|------|--------|-------|
| Light | **Mature** | Turn-on/off, visual settle, draft brightness |
| Fan | **Implemented** | `_composeOptimisticToggleState` — snapshot wins on turn-on (alpha.7+) |
| Humidifier | **Implemented** | Same pattern for humidity |
| Entity | **Toggle only** | When `tap_action: toggle` |
| Cover, climate, vacuum | **Not applied** | Different state models; needs per-domain design |

| ID | Severity | Issue | Solution |
|----|----------|-------|----------|
| O1 | **High** | Turn-on spread order put `actualState` (off attrs) over snapshot. | **Fixed earlier:** `turningOn ? actual…, snapshot… : snapshot…, actual…` |
| O2 | **Medium** | Optimistic timeout 3200ms; must revert if HA never confirms. | Existing `_scheduleOptimisticToggleTimeout`; QA on slow networks |
| O3 | **Low** | Generalize to cover/climate without breaking position/preset state. | Design doc + phased rollout (not in this pass) |

---

## 6. Resource usage & bundle

| ID | Severity | Issue | Solution |
|----|----------|-------|----------|
| B1 | **Low** | Single minified IIFE bundle ~3.57 MB (25 modules + i18n). | Expected for all-in-one HACS; no duplicate utils in bundle (embed stripped at build). |
| B2 | **Low** | `JSON.parse(JSON.stringify)` deep clone in many cards. | Prefer targeted copies for hot paths only. |
| B3 | **Low** | `console.warn` in advance-vacuum (session limits, webhook failures) — guarded, not `log`. | Keep warns for real failures; avoid `console.log` in hot paths. |
| B4 | **Info** | esbuild minify; no tree-shaking across cards (monolithic by design). | Optional code-split only if HACS/load model changes |

**Build:** `pnpm run bundle` → `scripts/build-bundle.mjs` (esbuild IIFE). `nodalia-utils.js` loaded once at bundle start.

---

## 7. CSS & layout

| ID | Severity | Issue | Solution |
|----|----------|-------|----------|
| C1 | **Medium** | Frequent `getBoundingClientRect` during slider drag (fan, light, cover). | Unavoidable for drag; batch via rAF if profiling shows issues |
| C2 | **Low** | No `contain: layout paint` on cards. | Trial on `ha-card` inner shell only after visual QA |
| C3 | **Low** | `-webkit-tap-highlight-color: transparent` on controls (fan). | Consistent on other cards |

---

## 8. Visual / edge-case bugs

| ID | Severity | File(s) | Issue | Status |
|----|----------|---------|-------|--------|
| V1 | **Critical** | `nodalia-humidifier-card.js` editor | Missing `</section>` after aux section → nested sections. | **Fixed** (alpha.7+) |
| V2 | **Medium** | `nodalia-advance-vacuum-card.js` | Entity guard used `_getRenderSignature()` on guard path. | **Fixed:** `guard:${entity}` |
| V3 | **Low** | All cards | Entity guard waits for `hass.states` hydration (`nodalia-utils.js`). | Implemented |
| V4 | **Low** | Long names, unavailable, missing attributes | Most cards use `escapeHtml`, fallbacks, guards. | Ongoing QA |

---

## 9. Build & HACS

- **Entry:** 25 card modules + i18n + utils + render-signature + bubble-contrast.
- **Standalone embed:** `scripts/sync-standalone-embed.mjs` for single-file artifacts only (not committed in card sources).
- **Tests:** `node --test tests/**/*.test.mjs` (**149** tests). No ESLint script in `package.json`.
- **i18n:** Editor + runtime JSON; validate via `pnpm run i18n:validate-editor` etc.

---

## Cambios aplicados (this audit pass)

1. **Fan / humidifier / light `set hass`:** Skip optimistic sync when render signature unchanged and no pending optimistic toggle; recompute signature after sync when optimistic active.
2. **Fan / humidifier / light / entity `ResizeObserver`:** Skip full `_render()` when signature unchanged after width/compact update.
3. **Alarm panel resize:** Skip render when width and compact mode unchanged.
4. **Vacuum layout refresh:** `isConnected` checks before `iron-resize` / global `resize`.
5. **Advance vacuum `set hass`:** Assign `_lastRenderSignature` on early return.
6. **Navigation bar editor `set hass`:** Propagate `hass` to `ha-entity-picker` / `ha-icon-picker` without full re-render.
7. **Advance vacuum display mode:** Map/overlays follow `_resolveDisplayMode()` (`_activeCleaningSessionMode` when user is on `all`/`routines`); mode tab highlight stays on `_activeMode`. Lazy mode/dock descriptors in signature when display or panel needs them.
8. **Notifications tracked entities:** `_syncTrackedEntitiesStamp()` caches per-entity revision; signature reuses stamp instead of scanning all entities every `set hass`.
9. **Fan / humidifier last-known on:** While off, only remember `percentage` / humidity when value &gt; 0 (avoids restoring 0% after optimistic turn-on).

### Pass 2 (same day)

10. **Climate `set hass`:** Skip `_syncDraftWithState()` when signature unchanged and no temperature draft / pending post-drag render.
11. **Fav / vacuum resize:** Skip `_render()` when render signature unchanged after width bucket update.
12. **Power flow:** Cached tracked-entity stamp for render signature (same revision-map pattern as notifications).

### Pass 3

13. **Fan / humidifier power-on:** Slider fill starts with controls expand (no staged 48% delay); skip redundant `set hass` re-renders during active optimistic transitions.
14. **Weather `set hass`:** Forecast subscription only when render signature changes.

*(Earlier alpha releases already fixed: utils deduplication, fan/humidifier slider fill/empty animation sync, optimistic attribute spread, humidifier editor `</section>`, advance-vacuum guard signature.)*

**Gemini review (same pass):** i18n keys `ed.light.tap_actions_section_*` are present in `i18n/editor/*.json` and `nodalia-editor-ui.js` catalog — no code change required.

---

## Cambios recomendados pero no aplicados

| Priority | Item | Effort |
|----------|------|--------|
| P0 | Further slim advance-vacuum signature (R1 — avoid full JSON on early return) | Medium |
| P1 | Notifications calendar/weather signature cache (R13) | Medium |
| P1 | Graph hover partial DOM update (R3) | Medium |
| P1 | Light temp/color thumb `transform` + remove blur (A1) | Medium |
| P1 | Controls collapse without `max-height` (A2) | High |
| P2 | Migrate `JSON.stringify` signatures to `joinParts` (R9) | Medium |
| P2 | Optimistic UI for cover (open/position) | High |
| P3 | Shared `_safeTimeout` helper (T3) | Low |
| P3 | `contain: layout paint` trial (C2) | Low |

---

## Checklist de pruebas manuales

### Dashboard pesado (desktop)
- [ ] Vista con 20+ tarjetas Nodalia (mix light, fan, entity, climate, graph, notifications).
- [ ] Dejar correr 10 min con actualizaciones HA frecuentes; comprobar CPU estable en DevTools Performance.
- [ ] Cambiar estado de una entidad no visible en pantalla: tarjetas visibles no deben parpadear.

### Móvil (iOS Safari / Android Chrome)
- [ ] Scroll vertical fluido con sliders en vista.
- [ ] Arrastrar slider fan/humidifier/light brightness sin scroll accidental.
- [ ] Tap / hold / double-tap en icono vs cuerpo (fan, entity, light).
- [ ] Apagar/encender fan o humidifier: animación fill/empty sin lag ni doble barra.

### Optimistic UI
- [ ] Encender fan offline lento: UI on → timeout o confirmación → estado real.
- [ ] Apagar con confirmación rápida: sin quedar “colgado” en on.
- [ ] Entity `tap_action: toggle` en lámpica/interruptor.

### Entidades problemáticas
- [ ] `unavailable` / `unknown` en climate, cover, vacuum, advance-vacuum.
- [ ] Entidad inexistente: guard warning, sin bucle de render.
- [ ] Recargar recurso HACS / cambiar de dashboard: sin errores consola, sin timers huérfanos (Memory heap estable al navegar).

### Modo oscuro / claro
- [ ] Contraste iconos bubble (NodaliaBubbleContrast).
- [ ] Alarm PIN, notifications stack, calendar expanded.

### Tarjetas específicas
- [ ] Graph: hover tooltip sin parpadeo de toda la tarjeta.
- [ ] Power flow: pausa animación al salir de viewport.
- [ ] Advance vacuum: mapa + modos con entidad válida/inválida.
- [ ] Navigation bar: editor pickers actualizan nombres al cambiar `hass`.

### Regresión HACS
- [ ] Recurso `nodalia-cards-1.1.4.js` (o actual) carga una vez.
- [ ] `window.__NODALIA_BUNDLE__.pkgVersion` coincide con `package.json`.

---

## Posibles regresiones a vigilar

- **Optimistic early-return:** Si una tarjeta deja de actualizar tras confirmación HA sin cambio de firma, revisar `_optimisticToggle` clearing.
- **Resize signature skip:** Si layout compacto no actualiza chips/título al redimensionar sin cambio de estado, forzar render cuando cambie solo `_cardWidth` bucket (raro).
- **Alarm resize gate:** Teclado PIN / countdown no debe cortarse al redimensionar 1px.
- **Vacuum `isConnected`:** Paneles animados deben seguir notificando layout mientras la tarjeta está conectada.
- **Nav bar editor hass patch:** Pickers no deben perder foco ni resetear valor al actualizar `hass`.

---

## Commands run

```bash
node --test tests/**/*.test.mjs   # 95 pass
node scripts/build-bundle.mjs     # when releasing
```

`pnpm test` runs the same tests (may trigger `pnpm install` in CI). No `pnpm lint` script defined.

---

## References

- `nodalia-render-signature.js` — lightweight signature helper
- `nodalia-utils.js` — shared guards, tap/hold, entity pickers
- `CONTRIBUTING.md` — bundle order, standalone embed policy
- `tests/interaction-regressions.test.mjs` — optimistic UI, slider animation, interaction guards
