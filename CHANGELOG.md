# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

Work-in-progress on **`alpha`** ahead of the next **`0.4.0-alpha.N`** tag or promotion to **`beta`**. Roadmap: **Power Flow**, **translations**, **Graph Card** lines/axes, **curated default styles** — see **CONTRIBUTING**.

---

## [0.4.0-alpha.7] - 2026-05-02

Seventh **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.7`** (tag **`v0.4.0-alpha.7`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Navigation bar** (`0.6.2`): modo **estantería** cuando **`layout.position`** es **`bottom`** (por defecto): **`border-radius`** solo en la parte superior (**`styles.bar.border_radius`** → **`R R 0 0`**), borde inferior recto al ras del viewport (evita la pastilla con solo las curvas visibles); con **`top`** se usa **`0 0 R R`**. **`layout.full_width: true`** sigue anulando todo el radio (**barra totalmente rectangular**).

---

## [0.4.0-alpha.6] - 2026-05-02

Sixth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.6`** (tag **`v0.4.0-alpha.6`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Navigation bar** (`0.6.1`): estética alineada con el resto de tarjetas Nodalia (radio de barra **28px**, capa superior tipo light con **`color-mix` 5%**, burbujas de icono con borde **8%** y sombra **inset + drop** como iconos light; **`layout.full_width`**: barra **sin** **`border-radius`**, **dock** a borde del viewport e **`max-width`** sin tope; editor visual con interruptor **«Barra a ancho completo»**; si hay **media player** encima, también **sin** esquinas cuando **`full_width`** está activo.

---

## [0.4.0-alpha.5] - 2026-05-02

Fifth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.5`** (tag **`v0.4.0-alpha.5`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Entity card**: visual parity with **Light / Fan** — active card gradient, border, shadow, **`ha-card::after`** accent glow, circular icon bubble (**`border-radius: 999px`**), icon **`color-mix`** / inset shadow matching light card; chips use **6%** **`color-mix`** surfaces, **`font-weight: 600`**, default **`chip_font_size`** **11px**; card **`0.6.3`**.

---

## [0.4.0-alpha.4] - 2026-05-07

Fourth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.4`** (tag **`v0.4.0-alpha.4`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Lovelace YAML preview**: visual editors emit **`stripEqualToDefaults(..., DEFAULT_CONFIG)`** so “Mostrar código YAML” stays minimal when only non-default options are set.
- **Circular gauge & climate**: **dial** uses **`aspect-ratio: 1`** and **`width: min(var(--*-dial-size), 100%)`** so card-picker previews stay **circular** in narrow layouts (**`0.12.1`** / **`0.10.4`**).
- **Power Flow**: default **`flow_width`** **`1px`**; card **`0.16.13`**.

---

## [0.4.0-alpha.3] - 2026-05-06

Third **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.3`** (tag **`v0.4.0-alpha.3`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Default sizes** (icons, titles, chips, sliders, media artwork/controls): tighter curated **`DEFAULT_CONFIG.styles`** on **light**, **fav**, **entity**, **media player**, **vacuum**, **fan**, and **humidifier** cards; theme-adaptive **`color-mix`** icon backgrounds and semantic colours unchanged from prior behaviour.
- **Graph card**: default **`points`** **480** for denser history sampling (**`0.12.12`**).

---

## [0.4.0-alpha.2] - 2026-05-02

Second **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.2`** (tag **`v0.4.0-alpha.2`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Power Flow**: thinner default connector stroke (**`flow_width`** **2px**), slightly tighter glow halo and rail floor; card **`0.16.12`**.
- **Visual editor**: **`FULL_LOCALE_BY_EN`** entries for flow/style labels (line thickness, node/home sizes, zero-line transparency, chip padding, min/max flow, etc.) so **pt / ru / el / zh / ro** show proper strings instead of English fallbacks.

---

## [0.4.0-alpha.1] - 2026-05-05

First **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.1`** (tag **`v0.4.0-alpha.1`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

---

## [0.3.0] - 2026-05-04

### Nodalia Cards v0.3.0

This release brings substantial improvements across the bundle and is the new recommended **stable** version. Everything below shipped across the **0.3.0-beta** prerelease line (**beta.01** through **beta.25**); per-build notes remain under *Historical: 0.3.0 beta series* for detail.

### 🌍 Translations & locales

- **Portuguese, Russian, Greek, Chinese, Romanian**: reliable runtime dictionaries by merging each partial `PACK` over English (`deepMergeLocale` / `strings()`), so sparse locales no longer miss `fan`, `alarmPanel`, `entityCard`, and other sections.
- **Weather, humidifier, graph, fan, alarm panel, person, entity, fav** strings for **pt / ru / el / zh / ro** via locale data scripts; **Music Assistant** browse folder titles use **`NodaliaI18n.navigationMusicAssist`** (plus broader keyword lists for directory icons) instead of hard-coded Spanish.
- **Advanced vacuum** and **simple vacuum** copy for **pt / ru / el / zh / ro** (`locale-vacuum-packs`).
- **Lovelace editor UI** (`scripts/gen-editor-ui.mjs` → `nodalia-editor-ui.js`): editor maps and `enToPt` / `enToRu` / … helpers; phrase overlays for *Show …* chips and long REST strings; merge order so climate/visual `FULL_LOCALE` wins; **`editorStr`** prefers English when the profile is not Spanish; **`translateEsToEn`** ordering so *Usar … entidad* / zone / vibration phrases translate before blanket replacements.
- **Person / graph / weather** editors: consistent *Tap action* keys for `editorStr`. Spanish **`locationUnknown`** accent fix under `person`.

### ⚡ Energy Flow (Power Flow) card

- **Layout & diagram**: Dynamic %-positions when many branches are active (grid, solar, battery, water, gas, individuals), extra vertical spacing, adaptive **`min-height`**, **`aspect-ratio`**, and **`height: auto`** so the tile grows with content instead of squashing the SVG. **1–2** top branches use a wide strip (sources left/right or flanking a centred home); **3** branches keep the classic triangle. **Single electrical source** reuses the same **bubble + SVG** diagram as compact multi-source (no separate “simple” map for one branch only). **Home** x-centre aligned between **compact** and **full**.
- **Lines & motion**: Chord-based endpoint trims, improved nearly-horizontal / nearly-vertical cubic control points, **straight `M L` paths** for **1–2** top branches (curves kept for 3+ or individuals), crisp main stroke (blur removed from the primary path; soft halo kept). **`preserveAspectRatio="none"`** so SVG user space lines up with `%`-positioned nodes on wide surfaces; trim radii and **92%** chord cap so strokes meet bubbles; default **`flow_width`** **2.5px** and subtler glow multiplier.
- **Markers**: Larger flow dot, then **ellipse** geometry with **`ry` scaled by surface aspect** so the dot stays visually round under non-uniform stretch; strip/simple rail dot sizes and animation keyframes; **`flow_width`**-linked sizing.
- **Semantics**: If **Home** has no entity, estimated consumption from branches (grid-only and sign conventions); export chip magnitude and *to grid* style secondary text where applicable.
- **Light theme**: Label/value chips, home icon chip, and **Energy** dashboard button use **`color-mix` with `var(--primary-text-color)`** for readable borders and fills; header/title hover fixes (drop stray **`will-change`**, header **`z-index`**, explicit title colour/opacity, line/dot animations use **`forwards`**).
- **Editor**: Prefer **`ha-selector`** / **`ha-entity-picker`** when Lovelace registers late instead of a hand-rolled `<select>`.

### 🧹 Other cards & polish

- **Climate card**: dial and bubble chips use **primary** text colour where they were washed out on **secondary**.
- **Person card**: pill vertical centring (avatar track, flex/grid tweaks) when the dashboard cell is taller than content.
- **Advance vacuum card**: mode controls (**All / Rooms / Zone / Routines**) wrapped in a **segmented pill** like Weather forecast tabs; **`advanceVacuum.aria.modeTablist`** in all `PACK` locales.

### Notes

- Newer locales are still being refined—reports and PRs for wording are welcome.
- **v0.4.x** will continue Power Flow polish, i18n, **Graph Card** line work, and **default style presets** for a stronger out-of-the-box look.

---

### Historical: 0.3.0 beta series

Per-prerelease entries (Spanish + technical detail) from **beta.03** through **beta.25**:

## [0.3.0-beta.25] - 2026-05-04

### Changed

- **Power flow card**: **Línea** un poco más fina (`flow_width` por defecto **2.5px**, mínimo **2.5px**, fallback de parseo **3.2px**; halo **×1.35** en lugar de ×1.5). **Marcador de flujo** (elipses viewBox y punto rail **simple** / **strip**) y sombras del rail algo **más pequeños**. **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.16.11**.

## [0.3.0-beta.24] - 2026-05-04

### Fixed

- **Power flow card**: Con **`preserveAspectRatio="none"`** el marcador de flujo se veía **ovalado**; el punto pasa a **`ellipse`** con **`ry = rx * (aspect-ratio ancho/alto)`** de la superficie para compensar el estiramiento y verse **circular** en pantalla. **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.16.10**.

## [0.3.0-beta.23] - 2026-05-04

### Changed

- **Power flow card**: Con **1 o 2 fuentes** el trazo entre nodos pasa a ser **recto** (`M … L …`) en lugar de la curva cúbica; con **3 fuentes** o **individuales** se mantiene el trazado curvo. **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.16.9**.

## [0.3.0-beta.22] - 2026-05-04

### Fixed

- **Power flow card**: **Chips** de etiqueta y valor (**Red**, **Casa**, etc.) y **icono casa** en la burbuja: borde/fondo con **`color-mix` + `var(--primary-text-color)`** (como el botón Energía) para que se lean en **modo claro**. **Líneas SVG**: `preserveAspectRatio` de **`meet` a `none`** para que el viewBox **0–100** coincida con el mismo rectángulo que las posiciones en `%` de los nodos (con **superficie alargada** 1–2 fuentes, `meet` centraba el SVG y el trazo **no alineaba** con las burbujas). Radios de acercamiento al trazo **mayores** y tope de suma **92%** de la cuerda. **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.16.8**.

## [0.3.0-beta.21] - 2026-05-04

### Changed

- **Power flow card**: **Punto de flujo** más grande en diagrama **1–2 fuentes** (coords viewBox y `flow_width`), clase **`power-flow-card--strip`** y punto del rail **simple** a **14px** con animación acorde. **Botón Energía** (cabecera / pie): borde y fondo con **`color-mix` sobre `var(--primary-text-color)`** e **`inset`**, como otras tarjetas Nodalia, para que el borde se lea en **modo claro**; hover suave. **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.16.7**.

## [0.3.0-beta.20] - 2026-05-04

### Fixed

- **Power flow card**: Con **1–2 fuentes** el trazo quedaba **corto** respecto a las burbujas porque cada extremo se limitaba a **~5,5% de la cuerda** (`min(radioBase, …)`), mucho menor que el radio útil del nodo en tramos largos. Los extremos vuelven a usar el **radio base** hacia el otro nodo y solo se **escalan a la vez** si `fromRadius + toRadius` supera **~88% de la cuerda** (layouts muy compactos). **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.16.6**.

## [0.3.0-beta.19] - 2026-05-04

### Changed

- **Advance vacuum card**: Los botones de modo (**Todo**, **Habitaciones**, **Zona**, **Rutinas**, etc.) van dentro de una **burbuja segmentada** al estilo de la weather card (contenedor con fondo/borde redondeado y pestañas internas transparentes; la activa resalta dentro). **`nodalia-advance-vacuum-card.js`**: `CARD_VERSION` **0.13.3**. **`nodalia-i18n.js`**: `advanceVacuum.aria.modeTablist` para el `aria-label` del `tablist`.

## [0.3.0-beta.18] - 2026-05-04

### Changed

- **Power flow card**: El **punto animado** del flujo de energía era demasiado pequeño en coords del viewBox; **radios** del halo y del núcleo aumentados (`r` ~0,92/0,52 → ~1,65/0,95), **borde** del núcleo algo más grueso y halo un poco más visible. **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.16.5**.

## [0.3.0-beta.17] - 2026-05-04

### Fixed

- **Power flow card**: El trazo seguía corto porque los **radios de recorte** eran demasiado grandes respecto a la **cuerda** entre nodos; ahora cada extremo usa `min(radioBase, 5.5% de la distancia)` (mínimo 0,3). En curvas casi horizontales los **puntos de control** van casi en línea con los extremos (`hx` pequeño) para que el trazo ocupe casi todo el hueco. Quitado **`vector-effect: non-scaling-stroke`** en las líneas (evita desalineación visual de los extremos). **Título «Flujo»** que se oscurecía al pasar el ratón: **`will-change: transform`** en la tarjeta/contenido/superficie eliminado (capas GPU raras), cabecera con **`z-index: 4`**, título con **`color` / `opacity`** explícitos, animación de líneas/puntos con **`forwards`** en lugar de **`both`**. **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.16.4**.

## [0.3.0-beta.16] - 2026-05-04

### Fixed

- **Power flow card**: Los radios en coords del SVG que acortaban el trazo eran **demasiado grandes** respecto al dibujo real de las burbujas (quedaba un **hueco** entre línea y nodos); se han **reducido** `homeRadius` / `nodeRadius` / `individualRadius`. Curvas casi **horizontales** (p. ej. una sola fuente) usan menos **tir vertical** para un trazo más limpio. El trazo principal ya **no** aplica el filtro blur (`power-flow-soften`) para bordes más nítidos (el halo suave sigue en `__line-glow`).
- **Climate card**: La **temperatura actual** bajo el objetivo en el dial heredaba `color` de **`.climate-card__dial-meta`** (`--secondary-text-color`); pasa a **`--primary-text-color`** como el objetivo. **`nodalia-climate-card.js`**: `CARD_VERSION` **0.10.3**. **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.16.3**.

## [0.3.0-beta.15] - 2026-05-04

### Fixed

- **Climate card**: Los chips burbuja de **temperatura actual** y **humedad** usaban `var(--secondary-text-color)` y se veían apagados frente al chip de **estado** (y al resto del título); ahora usan **`var(--primary-text-color)`** como el de estado. **`nodalia-climate-card.js`**: `CARD_VERSION` **0.10.2**.

## [0.3.0-beta.14] - 2026-05-04

### Changed

- **Power flow card**: Con **1** rama eléctrica (red/solar/batería), la **fuente queda a la izquierda** y **Casa a la derecha** en la misma fila; con **2** ramas, **Casa al centro**, la **segunda** en el orden grid→solar→batería a la **izquierda** y la **primera** a la **derecha**. Con **3** ramas se mantiene el triángulo clásico. La superficie usa **menos altura** y **aspect-ratio más ancho** (`1.52/1` sin fila inferior, `1.2/1` con agua/gas) y ya no suma el extra vertical pensado para 3 fuentes cuando solo hay 1–2. Si hay **individuales**, se conserva el layout anterior para no solaparlos. **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.16.2**.

## [0.3.0-beta.13] - 2026-05-04

### Changed

- **Power flow card**: Con **una sola** fuente (red, solar o batería) ya no se usa el layout horizontal **«simple»**; se muestra el **mismo diagrama de burbujas y SVG** que en modo compacto (varias fuentes). La casa en **compact** queda centrada en **x: 50** como en **full** para alinear el dibujo. **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.16.1**.

## [0.3.0-beta.12] - 2026-05-04

### Added

- **Power flow card**: Si **no** configuras entidad en **Casa**, el valor central es el **consumo estimado** `P_solar + P_red + P_batería` (misma convención que ya usa la tarjeta: red +importación / −exportación, batería +descarga / −carga). Con **una sola** rama solo se calcula si es la **red** (equivalente a solo contador). En **Red**, cuando la potencia es **exportación** (valor negativo del sensor), el chip muestra el **módulo** y, si no hay secundario configurado, un texto tipo **«A la red»** (traducible según idioma HA vía Nodalia i18n).

### Changed

- **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.16.0**; textos de ayuda del editor (Casa / Red).

## [0.3.0-beta.11] - 2026-05-04

### Fixed

- **Power flow card (editor visual)**: Si **`ha-entity-picker`** aún no está registrado en el primer pintado, se usa **`ha-selector`** con selector de entidad (`domain: sensor, number, input_number`) en lugar del `<select>` generado a mano; se observa **`whenDefined("ha-selector")`** para volver a montar controles nativos al cargar el frontend.

### Changed

- **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.15.2**.

## [0.3.0-beta.10] - 2026-05-04

### Fixed

- **Power flow card**: Tramos casi **verticales** (solar encima de casa) usan curva con **tir horizontal** para que el trazo no quede en un “pelo” bajo el nodo central; la **solar** se pinta **al final** del SVG. **`grid_options`** por defecto en la config normalizada (`rows: "auto"`, etc.) y **`getGridOptions`** los fusiona con lo que pongas en YAML. Menos **blur** en filtros SVG, **`shape-rendering: geometricPrecision`** y **`vector-effect: non-scaling-stroke`** en los trazos para bordes más limpios al escalar.
- **Person card**: **`ha-card`** en columna flex con **`justify-content: center`** y la fila principal **`flex: 0 0 auto`** en modo pastilla para centrar el bloque cuando la celda del dashboard es más alta que el contenido; **`:host`** pasa a flex columna **`height: 100%`**.

### Changed

- **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.15.1**. **`nodalia-person-card.js`**: `CARD_VERSION` **0.9.1**.

## [0.3.0-beta.09] - 2026-05-04

### Fixed

- **Power flow card**: With several active branches (red + solar + batería, agua/gas, individuales, etc.) the nodes no longer collapse on top of each other: **dynamic %-positions** from `getFlowLayoutFlagsFromConfig`, extra **vertical spacing** when `topCount ≥ 2` / `≥ 3`, and a taller **adaptive `min-height`** (plus mobile). The diagram surface uses **`aspect-ratio`** on **compact/full** and the card uses **`height: auto`** so the tile grows with the flow instead of crushing the SVG into a short band.
- **Person card**: The avatar track uses **`align-self: stretch`** so the photo stays vertically centred when the text column is taller than the bubble.

### Changed

- **`nodalia-power-flow-card.js`**: `CARD_VERSION` **0.15.0** (layout behaviour above).

## [0.3.0-beta.08] - 2026-05-04

### Fixed

- **Person card**: Avatar / entity photo is vertically centred with the pill card: main row uses **flex** with a dedicated **`person-card__avatar-track`** (centred track) instead of a CSS grid that left the bubble visually high relative to the title row.
- **Visual editors (all Nodalia card editors using the shared grid)**: `ha-icon-picker` and mounted icon-picker hosts span the full editor row (`grid-column: 1 / -1`), matching entity pickers so long icon paths do not clip.

### Changed

- **Editor i18n (`scripts/gen-editor-ui.mjs` → `nodalia-editor-ui.js`)**: `translateEsToEn` applies **`Usar … entidad` / `Usar … zona` / vibration phrases before** the blanket **`Entidad → Entity`** replacement, fixing broken English seeds and duplicate wrong rows (for example **Use entity icon** and locale columns no longer stuck on mixed Spanish/English).
- **`FULL_LOCALE_BY_EN`**: Proper **`de`/`fr`/…** strings for **Use entity icon**, **Use zone icon**, **Use entity photo**, **Tap action**, **Use vibration fallback**, and **Use vibration if haptics unavailable**.
- **Person, graph, weather card editors**: Section label key **`Acción al tocar`** (accented) so `editorStr` resolves **`Tap action`** and translations consistently.
- **`nodalia-i18n.js` → `person`**: **`emptyTitle`**, **`emptyBody`**, **`defaultName`** for the empty configuration state and title fallback; **`locationUnknown`** accent fixed in Spanish (`Ubicación`).

## [0.3.0-beta.07] - 2026-05-03

### Added

- **`advanceVacuum`** + **`vacuumSimple`** for **`pt`**, **`ru`**, **`el`**, **`zh`**, **`ro`** (`scripts/data/locale-vacuum-packs.json`, applied with **`node scripts/prepend-locale-vacuum.mjs`**): robot modes, base/dock copy, reported states and simple vacuum labels no longer fall through to English.
- **Editor Lovelace (`nodalia-editor-ui.js`)**: phrase packs **`scripts/data/editor-show-phrases.json`** (all **Show …** chips), **`editor-rest-long-phrases.json`** (comma/long sentences), **`editor-rest-compact-long-phrases.json`** (long sentences without commas that `enTo*` did not translate). **`scripts/gen-editor-ui.mjs`** merges them after **`editor-extra-locale-by-en.json`** and before **`FULL_LOCALE_BY_EN`** so climate/visual strings from **`FULL_LOCALE`** still win.

### Changed

- **`scripts/gen-editor-ui.mjs`**: **`applyFullLocaleByEn`** merge order is **`editor-extra` → phrase overlays → `FULL_LOCALE_BY_EN`** (was patch-then-extra).

## [0.3.0-beta.06] - 2026-05-03

### Added

- **`nodalia-i18n.js`**: Full **`weatherCard`** (conditions, forecast, Meteoalarm), **`humidifierCard.modes`**, **`graphCard`**, **`fan`**, **`alarmPanel`**, **`person`**, **`entityCard`**, **`favCard`** for **`pt`**, **`ru`**, **`el`**, **`zh`**, **`ro`** (source: `scripts/data/locale-extra.json`; inject via `scripts/apply-locale-extra.mjs`).
- **`scripts/gen-editor-ui.mjs`**: **`FULL_LOCALE_BY_EN`** completed with **`pt`/`ru`/`el`/`zh`/`ro`** for climate-visual-editor phrases (source: `scripts/data/full-locale-extra.json`; inject via `scripts/apply-full-locale-extra.mjs`).

### Fixed

- Portuguese and other new locales no longer show English weather labels such as **cloudy** / humidifier modes / editor chips because partial PACK trees now override **`PACK.en`** for those cards.

## [0.3.0-beta.05] - 2026-05-03

### Added

- **`nodalia-i18n.js`**: `deepMergeLocale` + **`strings()`** builds **full card dictionaries** for **pt / ru / el / zh / ro** by merging each partial PACK over **`PACK.en`** (same pattern as other locales, extended for new codes).

### Changed

- **`scripts/gen-editor-ui.mjs`**: Lovelace **`editorUiMaps`** includes **pt, ru, el, zh, ro**; compact labels via **`enToPt`** / **`enToRu`** / …; long strings use **English** until **`FULL_LOCALE_BY_EN`** supplies a translation (add **`pt`/`ru`/…** keys next to **`de`**); **`editorStr`** prefers **English** over Spanish when the profile is not Spanish (fixes mixed ES copy under EN-driven editors).

### Fixed

- Sparse locales no longer miss **`fan`**, **`alarmPanel`**, **`entityCard`**, etc. at runtime (previously only a shallow merge).

## [0.3.0-beta.04] - 2026-05-03

### Added

- **Locales** (`nodalia-i18n.js`): **`pt`**, **`ru`**, **`el`**, **`zh`**, **`ro`** registered for **`language: auto`** / `localeTag`; initial **`navigationMusicAssist`** strings for Music Assistant folder titles (artists, playlists, etc.).
- **`strings()`** merges **`navigationMusicAssist`** like other partial locales.

### Fixed

- **Media player** (`nodalia-media-player.js`): Music Assistant browser titles used a **hardcoded Spanish** map; they now use **`NodaliaI18n.navigationMusicAssist`** + English fallback (same as **navigation bar**).
- **Navigation bar / media player**: broader **Music Assistant directory icon** keyword lists (ES/EN/FR/DE/… plus **pt / ru / ro / el / zh** fragments) so icons match localized browse titles.

## [0.3.0-beta.03] - 2026-05-03

### Changed

- **Prerelease track**: merge **`main` v0.2.1**; bump to **0.3.0-beta.03**; **`nodalia-cards.js`** rebundled with `__NODALIA_BUNDLE__.pkgVersion` set for the beta line.
- **Tagging**: from this prerelease, Git tags use **`v0.3.0-beta.XX`** with **two-digit** `XX` (e.g. `…-beta.03`); see **CONTRIBUTING**.

## [0.2.1] - 2026-05-03

### Fixed

- **HACS / Lovelace**: rebuilt **`nodalia-cards.js`** with a **`window.__NODALIA_BUNDLE__`** footer (`pkgVersion` + short content hash) so installs can confirm which script loaded; new bytes **break stale caches** that could keep an old bundle on the stable resource while prerelease looked correct. See **README** (HACS `hacstag` note).

## [0.3.0-beta.2] - 2026-05-03

### Changed

- **Bundle** (`scripts/build-bundle.mjs`): built **`nodalia-cards.js`** appends `window.__NODALIA_BUNDLE__` (`pkgVersion` + short content hash) so you can verify in the browser console which script loaded. **Regenerated** the bundle (new bytes **invalidate** stale HACS/proxy caches that could still serve an old script on the stable resource).
- **Docs** (`README.md`): **HACS `hacstag`** differs between stable and prerelease installs by design; if translations behave differently between channels, **Redownload** in HACS and use the resource URL HACS shows.

## [0.3.0-beta.1] - 2026-05-03

### Changed

- Opens the **0.3.x** prerelease line on branch **`beta`**: continued **translation** polish, Lovelace editor refinements, and **card UX** work (graph, energy flow, navigation bar, etc.). **`main`** remains the **0.2.x** stable line (**v0.2.0** ships multilingual UI at ~80% coverage).

## [0.2.0] - 2026-05-03

### Summary

First **stable** line with **multilingual UI** for the bundle and **Lovelace visual editors** at approximately **~80%** coverage across **es, en, de, fr, it, nl** (runtime + `nodalia-i18n.js`, editor maps in `nodalia-editor-ui.js`, `language: auto` on supported cards). Remaining glitches: use the **Translation correction** issue template; refinements ship in **0.3.0** prereleases.

The sections **`[0.2.0-beta.16]` … `[0.2.0-beta.2]`** below are the per-beta notes that built up to this release.

## [0.2.0-beta.16] - 2026-05-03

### Fixed

- **Lovelace editor i18n** (`scripts/gen-editor-ui.mjs`): `Entidad` → `Entity` is applied **after** compound phrases (e.g. **Tamaño burbuja entidad**), fixing broken English seeds like “Size burbuja Entity” and improving downstream **de / fr / it / nl** editor labels.
- **Advance vacuum** (`nodalia-advance-vacuum-card.js`): `window.NodaliaI18n?.resolveLanguage?.(…)` everywhere it is used in templates/signature; **`nodalia-i18n-ready`** event + short locale reconciliation so the card re-renders when i18n or profile language becomes available (avoids stuck fallbacks).
- **Visual editors (layout)**: `ha-entity-picker` / `ha-selector` hosts in **`.editor-field`** use **full grid width** (no two entity pickers on one row), so long entity names are readable.

### Changed

- **Editor strings**: `scripts/editor-source-strings.json` and `scripts/spanish-nav-exact.mjs` extended for icon/bubble/colour labels; **`FULL_LOCALE_BY_EN`** in `gen-editor-ui.mjs` adds fuller **de / fr / it / nl** for style/animation/hint phrasing; **`nodalia-i18n.js`** dispatches **`nodalia-i18n-ready`** when the pack is registered.
- **Community**: **Translation correction** issue template (`.github/ISSUE_TEMPLATE/translation.yml`); **CONTRIBUTING** links to it for wrong-locale copy.
- Regenerated **`nodalia-editor-ui.js`** and bundled **`nodalia-cards.js`**.

## [0.2.0-beta.14] - 2026-05-02

### Fixed

- **Lovelace editor i18n** (`scripts/gen-editor-ui.mjs`): hints (`__H__:…`) now resolve through the same **Spanish → English** exact map as other editor strings, so long hints (e.g. navigation bar transitions) are no longer left in Spanish in the `en` column and never reached French.
- **Editor UI**: `Mostrar tarjeta` and **`Layout estrecho`** are registered and mapped to English seeds; **double period** on one “Transiciones suaves…” hint line removed.
- **French (and de / it / nl) editor copy**: `scripts/editor-extra-locale-by-en.json` (maintained via `scripts/generate-extra-locale-by-en.mjs`) merges **full translations** for long hints (media player, weather, navigation bar, graphs, etc.), **“Show …”** compound labels, section word **Haptics**, **Show card** / **Narrow layout**, so profiles like **fr** no longer show English sentences or hybrids such as “Afficher textual state” or “General player options…”.

### Changed

- **`scripts/spanish-nav-exact.mjs`**: shared Spanish→English map for generator hints + main pipeline.
- Regenerated **`nodalia-editor-ui.js`** and bundled **`nodalia-cards.js`**.

## [0.2.0-beta.13] - 2026-05-02

### Added

- **Advance vacuum editor**: selector **Idioma de la tarjeta** (`auto`, `es`, `en`, `de`, `fr`, `it`, `nl`) so you can match Home Assistant or force a locale; existing dashboards that still stored the old default **`language: es`** can switch to **Automático** to follow the UI language (e.g. français).

### Changed

- **Advance vacuum runtime** (`nodalia-advance-vacuum-card.js`): buttons, chips, map tools, markers, zone handles, routine tiles and map chrome use **theme-aware** fills and borders (`color-mix` with `--primary-text-color`) and clearer inset shadows, aligned with cards like the humidifier — readable borders on **light** themes; active states keep accent tints.
- **Animations**: slightly softer entrance motion and bounce timing on utility panel / footer / primary bounce keyframes.
- **`scripts/editor-source-strings.json`** + regenerated **`nodalia-editor-ui.js`** for new editor strings.
- Regenerated artifact: bundled **`nodalia-cards.js`**.

## [0.2.0-beta.12] - 2026-05-02

### Fixed

- **`nodalia-i18n.js`**: `effectiveHaLanguageCode` now reads **`home-assistant` root `hass` first**, then the Lovelace card `hass`, so the profile language wins over incomplete card snapshots.
- **`resolveLanguage`**: when the Home Assistant shell is present (`<home-assistant>`), **`navigator.language` is no longer used** as a fallback — it often disagreed with the HA profile (e.g. French browser + Spanish UI), causing mixed Meteoalarm UI (French row labels / dates like “mai” vs Spanish alert copy) and wrong packs for advance vacuum.
- **Weather** (`nodalia-weather-card.js`): default config includes **`language: "auto"`** explicitly.
- Regenerated artifact: bundled `nodalia-cards.js`.

## [0.2.0-beta.11] - 2026-05-02

### Fixed

- **`nodalia-i18n.js`**: `resolveLanguage` now reads UI language via `effectiveHaLanguageCode`, which prefers `hass.language` / `selectedLanguage` / `locale.language` and falls back to `<home-assistant>.hass` when Lovelace passes a hass object that has entity state but not yet i18n fields — fixes Meteoalarm chip/popup and advance vacuum (and other cards using `language: auto`) staying on Spanish copy despite an English or other profile.
- Exposed `effectiveHaLanguageCode` on `window.NodaliaI18n`.
- Regenerated artifact: bundled `nodalia-cards.js`.

## [0.2.0-beta.10] - 2026-05-02

### Changed

- **Weather** (`nodalia-weather-card.js`): Meteoalarm chip and popup use `translateMeteoalarmTerm` with localized row labels and enum-style values (Spanish/French/English API strings mapped to the active locale); popup dates use `localeTag(resolveLanguage(...))`; description/instructions headings use `weatherCard.meteoalarm.descriptionTitle` / `instructionsTitle`.
- **`nodalia-i18n.js`**: `translateMeteoalarmTerm` with `meteoalarmApiKey` and cross-language aliases for Meteoalarm/CAP values.
- **Advance vacuum** (`nodalia-advance-vacuum-card.js`): default `language` is `auto` so the card follows Home Assistant unless overridden.
- Regenerated artifact: bundled `nodalia-cards.js`.

## [0.2.0-beta.9] - 2026-05-02

### Changed

- **Advance vacuum** (`nodalia-advance-vacuum-card.js`): vacuum mode humanization always goes through `translateAdvanceVacuumVacuumMode` when `nodalia-i18n` is loaded, using `resolveHass(null)` when the card has no `hass` yet so labels no longer fall back to Spanish on first paint.
- **`nodalia-i18n.js`**: `strings()` merges `advanceVacuum` from the fallback pack when a locale omits it.
- **Alarm actions** (all locales): `alarmPanel.actions` uses compact labels (e.g. Home, Away, Night) instead of long “Arm …” wording; **favourite card** alarm mode buttons use these via `_getAlarmActionLabel`.
- **Favourite card** (`nodalia-fav-card.js`): entity name stays visible when the alarm panel is expanded; tight-inline layout adjusted when the alarm panel is open.
- **Climate editor i18n** (`scripts/gen-editor-ui.mjs`): added `FULL_LOCALE_BY_EN` overrides and extra `NAV_EXACT` keys so visibility, chips, haptics, style/animation hints and background colour labels translate to **de / fr / it / nl** (not only English).
- Regenerated artifacts: `nodalia-editor-ui.js` and bundled `nodalia-cards.js`.

## [0.2.0-beta.8] - 2026-05-02

### Changed

- **Advance vacuum runtime** (`nodalia-advance-vacuum-card.js`) now resolves additional UI copy through `window.NodaliaI18n` namespaces (`modeLabels`, `panelModes`, `dockControls`, `dockSettings`, `dockSections`, `actions`, `handles`, `utility`) so control labels, tooltips and action titles no longer stay fixed in Spanish.
- **Advance vacuum editor** fallback entity picker placeholder now uses `_editorLabel("Selecciona una entidad")` for localized fallback selects.
- Performed a cross-editor i18n sweep in **alarm, light, fan, vacuum, humidifier, power-flow, person, climate and entity editors** to route remaining hardcoded show/hide section toggles and fallback entity-picker placeholders through `_editorLabel`.
- Regenerated artifact: bundled `nodalia-cards.js`.

## [0.2.0-beta.7] - 2026-05-02

### Changed

- **Weather editor** (`nodalia-weather-card.js`) now routes remaining hardcoded editor strings through `_editorLabel` for fallback entity picker and animation/style section toggles (`Mostrar/Ocultar ajustes...`), avoiding Spanish-only UI in non-ES locales.
- **Graph editor** (`nodalia-graph-card.js`) now translates the style section toggle label through `_editorLabel` to keep show/hide copy localized.
- **Circular gauge editor** (`nodalia-circular-gauge-card.js`) now localizes fallback entity-picker placeholder and animation/style show/hide toggle copy via `_editorLabel`.
- **Fav editor** (`nodalia-fav-card.js`) now localizes style section show/hide toggle copy via `_editorLabel`.
- Regenerated artifact: bundled `nodalia-cards.js`.

## [0.2.0-beta.6] - 2026-05-02

### Changed

- **Navigation bar editor** (`nodalia-navigation-bar.js`) now routes remaining hardcoded labels through `_L` (move/remove actions, popup placeholders, haptic/layout select labels, style labels, and helper hints), including popup/layout option captions.
- **Graph editor** (`nodalia-graph-card.js`) now translates remaining hardcoded series editor copy (series title, action buttons, data subgroup title, empty-series note, add-series CTA, selection/action labels, and animation toggle text).
- **Alarm / Fav / Fan / Light** runtimes now resolve additional fallback state labels and default names through `window.NodaliaI18n` namespaces instead of fixed Spanish copy.
- **Alarm panel runtime** now uses dedicated localized **action labels** (`disarm`, `arm_home`, `arm_away`, `arm_night`, `arm_vacation`, `arm_custom_bypass`) so mode buttons no longer mirror state adjectives in non-Spanish locales.
- Editor UI generator (`scripts/gen-editor-ui.mjs`) extends explicit mappings (`NAV_EXACT`) so newly added Spanish keys emit stable English seeds before de/fr/it/nl shims.
- Regenerated artifacts: `nodalia-editor-ui.js` and bundled `nodalia-cards.js`.

## [0.2.0-beta.5] - 2026-05-02

### Added

- Full **de / fr / it / nl** runtime packs for `weatherCard`, `humidifierCard`, and `graphCard` in `nodalia-i18n.js` (conditions, forecast UI copy, humidifier modes, graph empty-history text), reducing fallback-to-English cases.
- New editor-source keys for media-player visual editor strings (power-button actions by state, action labels, add-player controls, animation/style toggles, progress/browser style labels, and related copy), wired into `scripts/editor-source-strings.json`.

### Changed

- **Vacuum** runtime (`nodalia-vacuum-card.js`) now resolves mode/state labels through `window.NodaliaI18n` with `hass` + card `language` (`humanizeModeLabel`, mode panel options, mode visibility labels, and state-chip mapping).
- **Weather** condition translation helper now resolves `hass` with `resolveHass` fallback even when `hass` is not explicitly passed.
- **Media player editor** (`nodalia-media-player.js`) routes additional hardcoded UI text through `_editorLabel` (e.g. `Comportamiento`, add-player button, empty-state note, show/hide animation & style settings toggles).

## [0.2.0-beta.4] - 2026-05-02

### Added

- Extra **`weatherCard.forecast`** keys used by the weather card UI: insufficient chart data, forecast popup close control, and popup metric headers (high/low/temperature/rain/humidity/wind).

### Changed

- **Weather** runtime (`nodalia-weather-card.js`): forecast tabs (Cards/Chart, Hours/Week), tablist `aria-label`, empty forecast copy, chart `aria-label`, insufficient-data message, forecast popup close label, popup row headers, and conditions continue to resolve through `translateWeatherForecastUi` / `translateCondition` with `hass` and card `language`.
- **Humidifier** runtime and editor (`nodalia-humidifier-card.js`): humidifier and fan mode labels use **`translateHumidifierMode`** (via `translateModeLabel`) with resolved `hass` and `language` on chips, panels, and editor mode-visibility toggles.
- **Graph** runtime (`nodalia-graph-card.js`): empty chart strip uses **`translateGraphEmptyHistory`**.

## [0.2.0-beta.3] - 2026-05-01

### Added

- Shared internationalization module (`nodalia-i18n.js`): language packs for **es**, **en**, **de**, **fr**, **it**, and **nl**; `resolveLanguage` from card `language` (`auto` or fixed code), Home Assistant locale, `navigator.language`, with **es** as fallback; `resolveHass` fallback via `document.querySelector("home-assistant")?.hass` when the editor has no `hass` yet.
- Runtime string namespaces and helpers on `window.NodaliaI18n`, including **`weatherCard`** (conditions and base forecast strings), **`humidifierCard.modes`**, **`graphCard.emptyHistory`**, and advance-vacuum helpers (`translateAdvanceVacuumReportedState`, `translateAdvanceVacuumVacuumMode`, etc.). Locales without a full pack merge **weather / humidifier / graph** from **en** so lookups stay valid.
- Lovelace editor string maps (`nodalia-editor-ui.js`), generated from `scripts/editor-source-strings.json` and `scripts/gen-editor-ui.mjs`, exposed as `window.NodaliaI18n.editorStr(hass, configLang, spanishText)`.
- Single-file bundle (`nodalia-cards.js`) via `npm run bundle` (`scripts/build-bundle.mjs`).
- Supporting scripts under `scripts/` for editor i18n maintenance (patch/wrap helpers, etc.).

### Changed

- Card editors resolve labels, section titles, hints, and select options through `_editorLabel` → `editorStr` (e.g. advance vacuum, alarm panel; broader coverage across entity, climate, graph, navigation bar, fan, favourite, person, weather, and related cards on this branch).
- **Advance vacuum** runtime: reported state chip, suction/mop/mop-mode labels, mode panel utilities (cleaning mode/counter/zones/point/dock actions), dock setting `<select>` options, map dock status titles, routine default label, and mode humanization respect `language` and HA locale when `nodalia-i18n` is loaded.
- Other integrated cards (entity, alarm, person, favourite, fan, simple vacuum, navigation bar, etc.) use `window.NodaliaI18n` for runtime strings where wired on this branch.
- `package.json` includes the `bundle` script; README and CONTRIBUTING updated as on the branch.

### Fixed

- Editor UI generator (`gen-editor-ui.mjs`): safer regex ordering (longer phrases before shorter ones), word-boundary rules where needed (`Borde`, `Radio`, `Icono`), correct stripping length for `__H__:` / `__T__:` prefixes, hints no longer passed through Spanish `reps` twice, `ROWS` deduplicated by Spanish key for stable `buildMap`, and `Show` / `Enable` / `Open` locale shims only on compact English labels so long hint sentences are not mangled in de/fr/it/nl.

### Removed

- Large binary GIF assets from the repository where applicable (smaller clone).

### Notes

- Prefer loading `nodalia-cards.js` (or the HACS `filename`) so i18n and editor maps register before opening card editors.
- Optional card option: `language: auto` or `es` / `en` / … to override runtime and editor language.
- Some long editor hints may remain in **English** for **de / fr / it / nl** until explicit translations are added in the generator or a dedicated hint table.

## [0.2.0-beta.2]

Prior beta; see git tag and release notes for that version.
