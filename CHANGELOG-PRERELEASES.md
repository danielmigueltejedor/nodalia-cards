# Changelog — 1.0.0 prerelease line

This file archives per-build notes for **`1.0.0-alpha.*`** and **`1.0.0-beta.*`**, copied from the main [`CHANGELOG.md`](./CHANGELOG.md) before that document was trimmed for stable releases.

For **stable** releases see **`[1.0.0]`** and **`[1.0.1]`**; for **`1.0.2`** prereleases (for example **`[1.0.2-alpha.5]`**) see [`CHANGELOG.md`](./CHANGELOG.md). This file only archives the historical **`1.0.0-alpha.*`** / **`1.0.0-beta.*`** line.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.0.0-alpha.96] - 2026-05-12

Ninety-sixth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.96`** (tag **`v1.0.0-alpha.96`** optional).

- **Nodalia Advance Vacuum card (`0.13.13`):** **Zone** mode no longer shows the extra **zone-count** selection chip in the modes panel (less vertical clutter). **Map raster URL** cache busting uses only the **map entity** **`last_updated` / `last_changed`** (not vacuum position / room id), so the image URL stays stable while the robot state updates and the **background no longer reloads every tick** during cleaning. When the map **does** update, **`stripMapCacheBuster`** reuses the same **`<img>`** if the logical URL matches, and crossfades use **`is-pending` from first paint** plus explicit **`z-index`** so the previous frame stays visible under the new layer until the fade completes.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.96`**.

---

## [1.0.0-alpha.95] - 2026-05-12

Ninety-fifth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.95`** (tag **`v1.0.0-alpha.95`** optional).

- **Nodalia Advance Vacuum card (`0.13.12`):** footer **three-button** row uses **grid slots** (left / center / right); **modes** and **dock** toggles use **`is-panel-open`** (fixed **`controlSize`**) while only the **main action** uses **`advance-vacuum-card__control--primary`**, so side buttons no longer **grow to match the center** when a utility panel is open; **subtle** press bounce on non-primary controls. **`:host`** **`--av-*` design tokens** unify surfaces, borders, inset highlights, shadows, **accent hover**, and **selected** states across **circular controls**, the **modes** pill, **map** frame and tools, **zone handles**, **room / goto markers**, **room chips**, **utility** options and selects, **selection chips**, and **routine** tiles.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.95`**.

---

## [1.0.0-alpha.94] - 2026-05-12

Ninety-fourth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.94`** (tag **`v1.0.0-alpha.94`** optional).

- **Insignia card (`0.2.14`):** header **scroll** rows that do **not** set **`--insignia-scroll-strip-*`** still get safe vertical space — **`:host`** now defaults to **`padding-block: 4px 6px`** and **`align-self: center`** so pills and shadows are not clipped at the bottom.
- **Nodalia Advance Vacuum card:** persistence **`console.warn`** messages are **English** (internal logs); the **visual editor** routes labels through **`ed.advance_vacuum.*`** plus shared **`ed.entity.*`**, **`ed.vacuum.*`**, and **`ed.weather.*`** keys (**`scripts/data/editor-catalog-advance-vacuum.json`**, merged into **`i18n/editor/*.json`**); **`window.customCards`** description is **English**.
- **Fan / Humidifier cards:** active-icon keyframes (**`fan-card-icon-spin`**, **`humidifier-card-icon-breathe`**) use **`translate3d`** so transforms stay consistent with the base **`ha-icon`** style and compositor promotion during animation.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.94`**.

---

## [1.0.0-alpha.93] - 2026-05-12

Ninety-third **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.93`** (tag **`v1.0.0-alpha.93`** optional).

- **Insignia card (`0.2.13`):** horizontal **scroll** strips no longer clip pills at the bottom — **`padding-block`** from **`--insignia-scroll-strip-*`** applies to **all** pills (not only icon-only), and the pill surface uses **`overflow: visible`** so **`box-shadow`** is not cut off.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.93`**.

---

## [1.0.0-alpha.92] - 2026-05-11

Ninety-second **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.92`** (tag **`v1.0.0-alpha.92`** optional).

- **Visual editor i18n:** Climate (legacy and main) and Alarm panel editors route labels through **`ed.climate.*`**, **`ed.alarm_panel.*`**, and shared catalog keys (**`ed.entity.*`**, **`ed.person.*`**, **`ed.fav.alarm_*`**, **`ed.weather.*`**, etc.); new strings live in **`scripts/data/editor-catalog-climate-alarm.json`** (merged into **`i18n/editor/*.json`**).
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.92`**.

---

## [1.0.0-alpha.91] - 2026-05-11

Ninety-first **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.91`** (tag **`v1.0.0-alpha.91`** optional).

- **Visual editor i18n:** Entity, Person, and Vacuum card editors route labels through **`ed.entity.*`**, **`ed.person.*`**, **`ed.vacuum.*`**, and shared **`ed.weather.*`** keys (catalog entries merged into all **`i18n/editor/*.json`** locales).
- **Tests:** release-candidate smoke accepts **`ed.vacuum.icon_animation_active`** for the vacuum editor’s icon-animation checkbox guard.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.91`**.

---

## [1.0.0-alpha.90] - 2026-05-11

Ninetieth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.90`** (tag **`v1.0.0-alpha.90`** optional).

- **Editor catalog i18n:** full locale files for **`de`**, **`fr`**, **`it`**, **`nl`**, **`pt`**, **`ru`**, **`el`**, and **`ro`** under **`i18n/editor/`**, matching the editor catalog languages embedded in **`nodalia-editor-ui.js`** (same keys as **`en.json`**; machine-translated from English where no hand-maintained file existed).
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.90`**.

---

## [1.0.0-alpha.89] - 2026-05-11

Eighty-ninth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.89`** (tag **`v1.0.0-alpha.89`** optional).

- **Notifications card — entrance timing:** `_animateContentOnNextRender` is cleared after the content animation window (`_scheduleEntranceAnimationReset`, same pattern as Entity), so a quick follow-up render (calendar/weather hydration) no longer strips `notifications-card--enter` before the first paint.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.89`**.

---

## [1.0.0-alpha.88] - 2026-05-11

Eighty-eighth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.88`** (tag **`v1.0.0-alpha.88`** optional).

- **Editor i18n — generator fixes:** compact `Show` / `Enable` / `Open` shims in `gen-editor-ui.mjs` now apply full-phrase matches before prefix rules (no more `Aktivieren: animations`, `Öffnen: URL in new tab`, etc.); sentences with a period skip those shims so long hints are not mangled.
- **Editor i18n — layout strings:** `FULL_LOCALE_BY_EN` adds full translations for common geometry/control seeds (chip/slider/chart heights, bubble width, color controls, icon fit, etc.).
- **Editor i18n — Show… labels:** `generate-extra-locale-by-en.mjs` now emits **de / it / nl / fr** for every former French-only “Show …” row so German/Dutch/Italian editors no longer show `Anzeigen: …` English tails.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.88`**.

---

## [1.0.0-alpha.87] - 2026-05-11

Eighty-seventh **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.87`** (tag **`v1.0.0-alpha.87`** optional).

- **Editor i18n — exhaustive cleanup pass:** large legacy blocks that still leaked Spanish in non-ES locales are now translated across all supported languages (badge/action/help/style/position/subtitle/navigation animation toggles, and related editor copy).
- **Editor i18n — stricter consistency:** duplicate legacy variants (`Subtitulo`/`Subtítulo`, `Posicion`/`Posición`, etc.) now resolve to the same localized output to avoid mixed-language drift.
- **Notifications card — navigation entrance trigger:** route-aware replay keeps entry animation consistent on dashboard navigation/reload while preserving anti-flicker safeguards.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.87`**.

---

## [1.0.0-alpha.86] - 2026-05-11

Eighty-sixth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.86`** (tag **`v1.0.0-alpha.86`** optional).

- **Notifications card — entrance behavior refined:** keeps entrance animation on dashboard navigation (like Entity/Weather) while avoiding intermittent double-trigger flicker during rapid visibility transitions.
- **Editor i18n — global fallback hardening:** `editorStr` now resolves stronger exact-locale fallbacks when legacy rows still echo Spanish in non-ES languages, reducing mixed-language labels in visual editors.
- **Icon animation performance pass (Weather/Fan/Humidifier/Vacuum):** icon motion paths are promoted to compositor-friendly transforms (`translate3d/translateZ`, `will-change`, `backface-visibility`) and weather storm effect avoids expensive filter animation, reducing long-session stutter.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.86`**.

---

## [1.0.0-alpha.85] - 2026-05-11

Eighty-fifth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.85`** (tag **`v1.0.0-alpha.85`** optional).

- **Weather card — editor units:** visual editor now includes unit system presets (`European/metric`, `US/imperial`) plus explicit overrides for temperature (`°C/°F`) and wind (`km/h`/`mph`), with runtime conversion applied to main values and forecast views.
- **Editor i18n coverage:** adds complete multi-language exact overrides (including punctuation/dirty variants) for remaining labels like `Event size`, `Accent color (when automatic tinting is disabled)`, vacuum mode visibility/help, and calendar action haptic feedback texts.
- **Calendar + Notifications robustness:** webhook native event creation now shows inline errors on failure; calendar refresh paths clear stale event state on load errors to avoid ghost entries.
- **Notifications mobile delivery:** mobile sent markers are persisted only when at least one delivery channel succeeds.
- **Global perf/stability pass:** locale string merging is cached in `nodalia-i18n` to reduce allocation churn; notifications render signature avoids full attribute stringify; climate drag window listeners are attached only during active drags.
- **Notifications entrance animation fluidity:** entrance animation still plays on dashboard navigation/reopen, but anti-replay guards remove intermittent flicker on hard reloads and rapid visibility transitions.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.85`**.

---

## [1.0.0-alpha.84] - 2026-05-11

Eighty-fourth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.84`** (tag **`v1.0.0-alpha.84`** optional).

- **Visual editors — i18n exacta:** se traducen y normalizan más textos que aún aparecían mezclados (`Allowed services (comma-separated)`, `Chip Padding`, `Intensity`, `Mode panel (ms)`, `Tooltip and hover (ms)`, `Disarmed/Away/Home/Night/Vacation/Custom/Arming/Pending/Triggered tint`, etc.).
- **Visual editors — robustez en literales importados:** se añaden variantes con puntuación residual (`;`, comas y frases largas) para que el normalizador convierta automáticamente esas cadenas al texto localizado correcto.
- **Energy / Gauge / Climate / Vacuum editor labels:** se cubren más aliases de campos y ayudas (`Casa`, `Solar`, `Batería`, `Agua`, `Gas`, `Numeric entity`, `Dial (ms)`, `Minimum/Maximum gauge tint`, `Gauge track`, `Climate entity`, `Modos de aspirado/mopa visibles` y descripciones relacionadas).
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.84`**.

---

## [1.0.0-alpha.83] - 2026-05-11

Eighty-third **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.83`** (tag **`v1.0.0-alpha.83`** optional).

- **Calendar card — UI de repetición personalizada:** los campos de frecuencia e intervalo numérico quedan ocultos salvo cuando el selector está en `Personalizado`.
- **Calendar card — detalle legible de repetición:** la ficha de evento ya no muestra `RRULE` cruda (`FREQ=...`); ahora enseña etiqueta normalizada (`Diariamente`, `Semanalmente`, `Mensualmente`, `Anualmente` o `Personalizado`).
- **Advance Vacuum — persistencia segura en overflow:** si la sesión compartida supera el límite del helper incluso en modo mínimo, se cancela la escritura remota para evitar limpiar accidentalmente `input_text`.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.83`**.

---

## [1.0.0-alpha.82] - 2026-05-11

Eighty-second **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.82`** (tag **`v1.0.0-alpha.82`** optional).

- **Calendar card — repetición nativa corregida:** la creación recurrente por `calendar/event/create` usa `dtstart`/`dtend` (en vez de `start`/`end`), corrigiendo el error de Home Assistant al crear eventos con repetición.
- **Calendar card — nueva opción `Personalizado`:** el selector de repetición añade modo personalizado con frecuencia (`Diariamente`, `Semanalmente`, `Mensualmente`, `Anualmente`) e intervalo numérico (`INTERVAL`) para reglas como “cada 2 semanas”.
- **Calendar card — validación del composer:** el formulario valida frecuencia e intervalo en repetición personalizada y muestra errores inline antes de enviar.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.82`**.

---

## [1.0.0-alpha.81] - 2026-05-09

Eighty-first **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.81`** (tag **`v1.0.0-alpha.81`** optional).

- **Notifications card — stack compacto:** el solape plegado conserva el paso visual de las capas traseras y solo compensa ligeramente la primera capa oculta para que la segunda notificación asome igual que las siguientes.
- **Notifications card — reserva compacta:** el stack plegado reduce de nuevo la altura extra reservada para acercar la siguiente tarjeta sin tocar el dibujo visual de las capas.
- **Notifications card — reserva compacta final:** se recorta otro tramo de reserva vertical en modo compacto para eliminar el aire restante bajo el stack.
- **Notifications card — animación de entrada:** ya no se relanza al hacer scroll dentro del mismo panel; solo se repite cuando la tarjeta vuelve desde un ocultado de layout/vista o al recargar/volver la pestaña.
- **Calendar card — i18n runtime:** las pantallas visibles del calendario, detalle, vacío y creación de evento usan claves de traducción propias (`calendarCard`) en lugar de literales directos.
- **Calendar card — formulario multidioma:** el formulario de creación, botones, campos, repetición, estados vacíos y errores ya tienen traducciones completas en todos los idiomas del bundle.
- **Visual editors — i18n exacta:** se traducen más etiquetas y ayudas que llegaban como literales en inglés, sin tilde o incluso en chino (`Main`, `Offset`, `Button size`, `Media player background`, `最小高度`, etc.) en navegación, media player, badges, energía, climate, alarma, calendario y tarjetas de entidad.
- **Visual editors — i18n exacta ampliada:** se cubren literales pendientes como `Mensaje`, `Severidad`, `Texto visible`, `temperature`, `Main action`, `Tap service`, `Tap URL`, `Fixed PIN`, `Code helper`, `Chip Padding` y `Bubble size` en todos los idiomas del bundle.
- **Visual editors — i18n exacta extendida:** se completan más ayudas y opciones (`Player background`, `Modos de aspirado visibles`, `Modos de mopa visibles`, `Main visual settings for the card.`, `Automatic (toggle or info)`, `Pin to screen`, `Also show on desktop`, etc.) con traducción en todos los idiomas del bundle.
- **Visual editors — i18n de cobertura:** el normalizador aplica traducciones por valor inglés a entradas heredadas del mapa base, cubriendo más etiquetas antiguas de estilos, paneles, sensores, controles y acciones que aún caían en inglés en idiomas no españoles.
- **Notifications card — i18n de avisos inteligentes:** se completan títulos, mensajes y acciones de calor, frío, lluvia, multimedia sin presencia, batería, depósito y tinta baja en todos los idiomas oficiales del bundle.
- **Visual editors — i18n de avisos inteligentes:** los textos editables de notificaciones inteligentes y acciones heredadas (`Navigate`, `Call service`, `Default`, `Service`, etc.) ya pasan por filas exactas multidioma.
- **Visual editors — consistencia:** la Insignia Card usa el mismo bloque plegable **Estilos** / **Mostrar ajustes de estilo** que el resto de editores, y el normalizador español corrige más tildes heredadas en etiquetas antiguas.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.81`**.

---

## [1.0.0-alpha.77] - 2026-05-09

Seventy-seventh **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.77`** (tag **`v1.0.0-alpha.77`** optional).

- **Notifications card — stack plegado con altura propia:** las capas traseras se miden contra la lista real de notificaciones y la tarjeta reserva más espacio cuando hay varias apiladas, evitando colisiones con la tarjeta inferior.
- **Notifications card — preview trasero más discreto:** el offset/opacidad del stack se suaviza para que la segunda notificación no asome más de la cuenta.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.77`**.

---

## [1.0.0-alpha.76] - 2026-05-09

Seventy-sixth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.76`** (tag **`v1.0.0-alpha.76`** optional).

- **Notifications editor — alta de notificaciones personalizadas:** el botón **Añadir notificación** vuelve a crear una fila editable inmediatamente; las filas nuevas se mantienen como borrador local y no se guardan como aviso real hasta que tengan título, mensaje o entidad.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.76`**.

---

## [1.0.0-alpha.75] - 2026-05-09

Seventy-fifth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.75`** (tag **`v1.0.0-alpha.75`** optional).

- **Vacuum card — errores Roborock reales:** nueva entidad auxiliar `error_entity` y autodetección de sensores `sensor.*error*`; los códigos como `main_brush_jammed`, `lidar_blocked`, `filter_blocked`, `return_to_dock_fail` o `audio_error` se muestran como estado legible/traducido y tintan la tarjeta como error. **`nodalia-vacuum-card.js`** `0.6.5`.
- **Notifications card — errores de robot traducidos:** nueva lista `vacuum_error_entities`; si el robot o un sensor auxiliar expone un fallo real, el aviso pasa a crítico con el texto del error en vez de caer en “robot pausado” o estados genéricos.
- **Notifications card — recomendaciones por área:** se añaden `media_player_entities`, `climate_entities` y `humidifier_entities`; la tarjeta puede recomendar apagar multimedia encendido en una estancia sin presencia, activar frío/calor en un climate compatible y encender un deshumidificador del mismo área cuando la humedad sea alta.
- **Visual editors / i18n:** nuevos campos y etiquetas para sensores de error, climates, humidificadores/deshumidificadores, media players y minutos sin presencia.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.75`**.

---

## [1.0.0-alpha.74] - 2026-05-09

Seventy-fourth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.74`** (tag **`v1.0.0-alpha.74`** optional).

- **Notifications card — stack tipo baraja:** las capas plegadas se anclan siempre por debajo de la notificación principal, formando una escalera de hasta cuatro tarjetas donde cada aviso oculto asoma solo un poco más que el anterior.
- **Notifications card — carga estable:** las tarjetas decorativas del stack ya no ejecutan la animación de entrada de contenido, evitando que una capa trasera sobresalga por arriba durante los primeros frames al abrir la pestaña.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.74`**.

---

## [1.0.0-alpha.73] - 2026-05-09

Seventy-third **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.73`** (tag **`v1.0.0-alpha.73`** optional).

- **Humidifier card — icono de deshumidificador:** `device_class: dehumidifier` usa `mdi:air-humidifier-off` solo cuando está apagado; al encender vuelve a `mdi:air-humidifier` y mantiene la animación activa. **`nodalia-humidifier-card.js`** `0.6.6`.
- **Advance Vacuum card — animación corregida:** se evita animar el botón primario cuando la limpieza está activa, ya que el icono mostrado es `pause` y no representa el robot en movimiento. **`nodalia-advance-vacuum-card.js`** `0.13.11`.
- **Vacuum card — icono activo animado:** se añade `animations.icon_animation` al editor y al runtime; el icono principal del robot se mueve en arco mientras limpia, respetando `animations.enabled` y `prefers-reduced-motion`. **`nodalia-vacuum-card.js`** `0.6.4`.
- **Visual editors — i18n polish:** nueva tanda de traducciones exactas para acciones, etiquetas, selectores, condiciones, colores, insignias y textos comunes que aún podían caer a literal/inglés.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.73`**.

---

## [1.0.0-alpha.72] - 2026-05-09

Seventy-second **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.72`** (tag **`v1.0.0-alpha.72`** optional).

- **Visual editors — i18n alias propagation:** los overrides exactos ahora se aplican también a variantes generadas por la tabla base, corrigiendo casos como `Presets de brillo`, `Botones de modo junto al slider`, burbujas/chips/sliders y opciones haptics que antes podían caer a inglés en otros idiomas.
- **Light / Humidifier / Power Flow editors:** los campos especiales de entidad/color vuelven a pasar sus labels por `editorStr`, evitando etiquetas crudas como `Entidad de luz` en locales no españoles.
- **Editor i18n — cobertura adicional:** se añaden traducciones multidioma para acciones, niveles haptics, máximos/mínimos, nombres visibles, horas/días visibles, selectores vacuum y controles comunes.
- **Card versions:** **`nodalia-light-card.js`** `0.7.5`, **`nodalia-humidifier-card.js`** `0.6.5`, **`nodalia-power-flow-card.js`** `0.16.14`.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.72`**.

---

## [1.0.0-alpha.71] - 2026-05-09

Seventy-first **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.71`** (tag **`v1.0.0-alpha.71`** optional).

- **Visual editors — i18n sweep:** se añaden overrides exactos en todos los idiomas soportados para claves pendientes de Notifications, Advance Vacuum y Light (`Máximo visible plegado`, ajustes por entidad, acciones, sensores auxiliares, haptics, animaciones, modos, colores de estado, chips y controles de estilo).
- **Editor i18n — regresión cubierta:** se amplían los tests para detectar etiquetas literales como `Name`, `Button bounce (ms)`, colores de vacuum y `Color icono apagada` antes de publicar.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.71`**.

---

## [1.0.0-alpha.70] - 2026-05-09

Seventieth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.70`** (tag **`v1.0.0-alpha.70`** optional).

- **Fan / Humidifier / Weather / Advance Vacuum — iconos vivos:** nuevo toggle visual `animations.icon_animation` para animar iconos activos; el ventilador gira, el humidificador respira con vapor, Weather anima lluvia/nieve/sol/viento/nubes/tormenta según condición y Advance Vacuum mueve el icono principal en arco mientras limpia. Respeta `animations.enabled` y `prefers-reduced-motion`.
- **Notifications card — estado vacuum traducido:** los avisos del robot ya traducen estados como `cleaning` mediante el i18n compartido de Advance Vacuum antes de renderizar el mensaje.
- **Editor i18n:** se añaden traducciones para los nuevos toggles de animación de icono en todos los idiomas soportados.
- **Card versions:** **`nodalia-fan-card.js`** `0.6.4`, **`nodalia-humidifier-card.js`** `0.6.4`, **`nodalia-weather-card.js`** `0.12.5`, **`nodalia-advance-vacuum-card.js`** `0.13.10`.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.70`**.

---

## [1.0.0-alpha.69] - 2026-05-08

Sixty-ninth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.69`** (tag **`v1.0.0-alpha.69`** optional).

- **Editor i18n — consolidación:** se elimina el bloque alemán duplicado `EDITOR_EXACT_OVERRIDES`; las traducciones exactas quedan en una única tabla multidioma para reducir bundle y mantenimiento.
- **Editor i18n — seguridad defensiva:** la expansión de aliases ignora filas sin `keys`/`key` en lugar de crear entradas `undefined`.
- **Weather card — locale robusta:** `formatForecastDateTime` ya no pasa `auto` a `toLocaleTimeString` / `toLocaleDateString`; usa `undefined` cuando debe delegar en la locale del navegador.
- **Calendar / Notifications i18n:** se confirma `allDay` en el mapa compartido `translateNotificationsUi` para todos los idiomas soportados y se corrige el fallback español sin tilde.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.69`**.

---

## [1.0.0-beta.7] - 2026-05-08

Seventh public **`beta`** candidate for **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-beta.7`** (Git tag **`v1.0.0-beta.7`** recommended for HACS/GitHub Releases).

- **Visual editors — i18n completo en overrides exactos:** la capa que corrige etiquetas escapadas (`Mode buttons next to slider`, `Use album art as background`, `Main entity`, `Posición del estado`, tamaños, chips, browser/player, etc.) pasa de ser solo alemana a cubrir todos los idiomas soportados (`es`, `en`, `de`, `fr`, `it`, `nl`, `pt`, `ru`, `el`, `zh`, `ro`).
- **Release metadata:** bump beta channel references and bundle version metadata to **`1.0.0-beta.7`**.

---

## [1.0.0-beta.6] - 2026-05-08

Sixth public **`beta`** candidate for **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-beta.6`** (Git tag **`v1.0.0-beta.6`** recommended for HACS/GitHub Releases).

- **Weather card — días por idioma:** las etiquetas de previsión diaria/horaria usan la locale resuelta de Home Assistant/configuración, evitando que sigan apareciendo `vie.`, `mié.`, etc. cuando el panel está en alemán u otro idioma. **`nodalia-weather-card.js`**: `CARD_VERSION` **0.12.4**.
- **Calendar card — todo el día traducible:** los eventos de día completo usan el texto i18n compartido en lista, detalle y composer, en lugar de dejar `Todo el día` fijo.
- **Editores visuales — barrido alemán ampliado:** se añaden overrides exactos para textos que todavía aparecían mezclados en Light, Fan, Advance Vacuum, Media Player, Entity y estilos comunes (`Background`, `Mode buttons next to slider`, `Use album art as background`, `Main entity`, `Posición del estado`, etc.).
- **Release metadata:** bump beta channel references and bundle version metadata to **`1.0.0-beta.6`**.

---

## [1.0.0-beta.5] - 2026-05-08

Fifth public **`beta`** candidate for **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-beta.5`** (Git tag **`v1.0.0-beta.5`** recommended for HACS/GitHub Releases).

- **Calendar / Notifications editors — i18n ampliado:** se añaden traducciones explícitas para las cadenas pendientes del editor visual en todos los idiomas soportados, incluyendo secciones, hints, botones, listas de entidades, umbrales, sincronización móvil, seguridad, estilos y controles de calendario.
- **German editor polish:** se corrigen traducciones generadas que aparecían en inglés o mezcladas (`Card border`, `Move up`, `Move down`, `Delete`, `Animations`) y se reemplazan por alemán real dentro del mapa común.
- **Spanish source polish:** se corrigen textos fuente restantes sin tilde (`Frío`, `Alertas críticas`, `Severidad mínima`, `Mostrar ajustes hápticos`, `tipografía`, etc.).
- **Release metadata:** bump beta channel references and bundle version metadata to **`1.0.0-beta.5`**.

---

## [1.0.0-beta.2] - 2026-05-08

Second public **`beta`** candidate for **`1.0.0`**, promoted from **`1.0.0-alpha.68`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-beta.2`** (Git tag **`v1.0.0-beta.2`** recommended for HACS/GitHub Releases).

- **Notifications card — i18n completo:** los textos runtime de avisos inteligentes se traducen en todos los idiomas soportados (`es`, `en`, `de`, `fr`, `it`, `nl`, `pt`, `ru`, `el`, `zh`, `ro`) y el español recupera tildes/ñ en títulos, mensajes, acciones y etiquetas ARIA.
- **Calendar / Notifications editors — traducción visual:** se refuerzan las etiquetas del editor visual de las dos tarjetas nuevas, incluyendo conexiones inteligentes, ajustes por entidad, notificaciones personalizadas, móvil, calendarios y mensajes vacíos.
- **Spanish editor polish:** normalización ampliada para `notificación`, `móvil`, `batería`, `depósito`, `previsión`, `días`, `envío` y textos relacionados.
- **Release metadata:** bump beta channel references and bundle version metadata to **`1.0.0-beta.2`**.

---

## [1.0.0-alpha.68] - 2026-05-08

Sixty-eighth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.68`** (tag **`v1.0.0-alpha.68`** optional).

- **Notifications card — stack plegado corregido:** la notificación más reciente vuelve a quedar siempre en primer plano; las tarjetas traseras se renderizan como capas decorativas por debajo, con menor opacidad, sin capturar clics y mostrando algo menos de borde inferior.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.68`**.

---

## [1.0.0-alpha.67] - 2026-05-08

Sixty-seventh **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.67`** (tag **`v1.0.0-alpha.67`** optional).

- **Notifications card — stack compacto 4 capas:** el modo plegado muestra hasta cuatro tarjetas traseras, subidas y más discretas, limitando el stack visual a cuatro capas aunque haya más avisos para reducir altura y ruido visual.
- **Notifications card — alertas críticas legacy:** nueva opción `mobile_notifications.critical_alerts`; cuando se activa y el aviso tiene severidad `critical`, los servicios legacy `notify.mobile_app_*` reciben payload crítico iOS/Android (`push.sound.critical`, `ttl: 0`, `priority: high`, `channel: alarm_stream`). Las entidades modernas `notify.*` siguen usando `notify.send_message` sin `data` por compatibilidad con HA.
- **Notifications card — auditoría ligera:** se mantiene el comportamiento por defecto y se refuerzan tests para el stack, ausencia de chip `source` automático y payload crítico opt-in.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.67`**.

---

## [1.0.0-alpha.66] - 2026-05-08

Sixty-sixth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.66`** (tag **`v1.0.0-alpha.66`** optional).

- **Notifications card — chips inteligentes:** los avisos ya no añaden automáticamente la entidad/fuente como chip cuando el mensaje personalizado omite `{source}`; el texto configurado se respeta literalmente y solo se mantienen chips de severidad cuando aplican.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.66`**.

---

## [1.0.0-alpha.65] - 2026-05-08

Sixty-fifth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.65`** (tag **`v1.0.0-alpha.65`** optional).

- **Calendar card — solo persistencia nativa:** se elimina por completo el sistema de marcado/completados, `localStorage`, helpers `input_text` y webhook de completados; para quitar eventos se usa únicamente el borrado nativo de Home Assistant (`calendar/event/delete`) cuando el calendario lo soporta.
- **Calendar card — editor más limpio:** desaparecen las opciones de completados compartidos y el editor solo muestra creación/borrado de eventos nativos, forecast, tintado, haptics y estilo.
- **Insignia card — scroll sin recorte:** las insignias icon-only ganan aire inferior por defecto en barras con scroll para evitar que el borde/sombra quede cortado.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.65`**.

---

## [1.0.0-alpha.64] - 2026-05-08

Sixty-fourth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.64`** (tag **`v1.0.0-alpha.64`** optional).

- **Notifications card — animación de entrada:** la clase de entrada se mantiene durante la duración real de la animación para que Home Assistant no la elimine en un re-render inmediato antes del primer paint; vuelve a reproducirse al entrar en la vista.
- **Notifications card — auditoría preestable:** mantiene la corrección del editor por entidad y refuerza cobertura para evitar regresiones en overrides y animaciones.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.64`**.

---

## [1.0.0-alpha.63] - 2026-05-08

Sixty-third **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.63`** (tag **`v1.0.0-alpha.63`** optional).

- **Notifications card — pila compacta:** las tarjetas traseras del modo plegado suben y quedan más discretas bajo la principal, reduciendo el hueco visual inferior.
- **Notifications card — overrides por entidad:** los avisos inteligentes ahora permiten personalizar por entidad concreta el título, mensaje, color, URL, etiqueta de acción y política móvil (`heredar`, `enviar siempre`, `no enviar`), manteniendo como base la configuración por tipo.
- **Notifications card — editor:** cambiar varias veces el color de tintado de un override por entidad actualiza siempre esa misma entidad, sin quedarse bloqueado en el primer color guardado.
- **Navigation Bar:** se conservan fallbacks de tema para el toggle de media player si configuración y defaults quedan vacíos.
- **Advance Vacuum:** la persistencia solo por webhook deduplica también la sesión vacía para evitar POST redundantes.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.63`**.

---

## [1.0.0-beta.1] - 2026-05-08

First public **`beta`** candidate for **`1.0.0`**, promoted from the full **`1.0.0-alpha.1` → `1.0.0-alpha.62`** cycle. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-beta.1`** (Git tag **`v1.0.0-beta.1`** recommended for HACS/GitHub Releases).

### Resumen rápido

| Área | Qué cambia en `1.0.0` |
|------|------------------------|
| **Calendario** | Eventos nativos de Home Assistant, popup grande, forecast moderno, composer más completo y borrado nativo persistente. |
| **Notificaciones** | Nueva tarjeta `custom:nodalia-notifications-card` con avisos inteligentes, pila expandible, descartes persistentes, notificaciones móviles y editor visual. |
| **Vacuum / Advance Vacuum** | Mejor sincronización compartida con `input_text`, paneles de modo/utilidades persistentes y acciones más seguras. |
| **Editores visuales** | Selectores nativos de HA, color pickers consistentes, secciones plegables y controles más compactos. |
| **Bundle / HACS** | Entrypoint más robusto, diagnóstico de versión/hash y menos problemas con caché tras redescargar. |
| **Seguridad / rendimiento** | Allowlist de servicios, URLs saneadas, render signatures más selectivas y bundle minificado. |

### Lo nuevo más importante

- **Calendar card renovada:** crea eventos reales con `calendar/event/create`, soporta descripción, ubicación, recurrencia básica y color propio guardado como metadato Nodalia; también permite borrar eventos nativos cuando HA expone `calendar/event/delete`.
- **Vista de calendario más rica:** el popup ampliado muestra detalle del evento, calendario, horario, repetición, ubicación, descripción y chips de tiempo/forecast cuando existen datos disponibles.
- **Forecast compatible con HA moderno:** usa `weather/subscribe_forecast` y fallback por `weather/get_forecasts`, priorizando previsiones con más días futuros para evitar quedarse solo con "hoy".
- **Notifications card nueva:** centro inteligente de avisos con estado vacío agradable, pila compacta/expandible, capas tintadas, chips de fuente/severidad, acciones rápidas y descartes persistentes.
- **Recomendaciones inteligentes:** avisos de calendario, robot aspirador, calor/frío, humedad, lluvia próxima, batería baja, depósito de humidificador, tinta y notificaciones personalizadas.
- **Notificaciones móviles:** envío opcional a entidades `notify.*` modernas mediante `notify.send_message`, compatible con Home Assistant 2026.5; `data.group`/`data.tag` quedan solo para servicios legacy para evitar errores de payload.
- **Persistencia entre dispositivos:** helper opcional `input_text` para compartir descartes de notificaciones y sesión de vacuum; Calendar queda en persistencia nativa de Home Assistant mediante creación/borrado de eventos reales.
- **Editores más cómodos:** `ha-entity-picker`, `ha-selector`, icon picker, color picker visual, secciones plegables, conexiones inteligentes compactas y feedback inline en formularios.
- **Animación y tacto:** entradas alineadas entre tarjetas, pila de notificaciones con expandir/contraer animado y haptics configurables en acciones principales del calendario.
- **Seguridad reforzada:** acciones de servicio personalizadas con `security.strict_service_actions`, allowlist por dominio/servicio, URLs saneadas y comportamiento fail-closed cuando la allowlist está vacía.
- **Carga más fiable:** `nodalia-cards.js` vuelve a ser autocontenido para HACS/manual, con artefactos auxiliares `bundle`/`manifest` para diagnóstico; el bundle expone `__NODALIA_BUNDLE__` con versión y hash corto.

### Correcciones destacadas

- Evita renders o consultas infinitas al refrescar eventos de calendario en instalaciones con muchos cambios de estado.
- Evita que descartes de calendario/notificaciones se poden durante recargas fuertes antes de hidratar eventos o forecast.
- Corrige cálculos de temperatura baja usando el sensor más frío y mejora la asociación sensor -> ventilador por área/nombre.
- Reduce cortes visuales en móvil, estados vacíos, botones icon-only, chips y capas compactas.
- Mejora compatibilidad con servicios `notify.*` modernos y legacy sin enviar campos no aceptados por Home Assistant.
- Mantiene fallbacks de tema para el toggle de media player en Navigation Bar cuando configuración y defaults quedan vacíos.
- Deduplica también las sesiones vacías de Advance Vacuum cuando la persistencia usa solo webhook, evitando POST redundantes.
- Ajusta la pila compacta de Notifications Card para que las tarjetas traseras asomen menos bajo la principal.
- Añade overrides por entidad en avisos inteligentes: URL, etiqueta, título, mensaje, color y política móvil individual (`heredar`, `enviar siempre`, `no enviar`).

### Metadata

- **Release metadata:** promote prerelease channel references and bundle version metadata to **`1.0.0-beta.1`**.

---

## [1.0.0-alpha.61] - 2026-05-08

Sixty-first **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.61`** (tag **`v1.0.0-alpha.61`** optional).

- **Notifications card — pila compacta:** las tarjetas traseras del modo compacto ahora son capas más altas, casi a ancho completo y tintadas según la notificación oculta, para que solo asome el bajo y la curva no aparezca tan pronto.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.61`**.

---

## [1.0.0-alpha.60] - 2026-05-08

Sixtieth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.60`** (tag **`v1.0.0-alpha.60`** optional).

- **Notifications card — persistencia calendario:** los descartes guardados en `input_text`/localStorage ya no se podan durante el render temprano de una recarga fuerte antes de que se hayan hidratado eventos de calendario o previsión.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.60`**.

---

## [1.0.0-alpha.59] - 2026-05-08

Fifty-ninth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.59`** (tag **`v1.0.0-alpha.59`** optional).

- **Notifications card — colapso animado:** contraer la pila anima primero la salida de las notificaciones sobrantes y después muestra la pila compacta.
- **Notifications card — entrada en pestañas:** la animación de entrada se repite al volver a una vista/pestaña de Home Assistant mediante observer de visibilidad, igual que `nodalia-calendar-card`.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.59`**.

---

## [1.0.0-alpha.58] - 2026-05-08

Fifty-eighth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.58`** (tag **`v1.0.0-alpha.58`** optional).

- **Notifications card — chips superiores:** las burbujas de fuente/severidad se colocan en la esquina superior derecha, justo antes del botón de cierre, para no cortar el ritmo del contenido.
- **Notifications card — animaciones:** entrada alineada con `nodalia-calendar-card` y animación visible al expandir/contraer la pila de notificaciones.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.58`**.

---

## [1.0.0-alpha.57] - 2026-05-08

Fifty-seventh **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.57`** (tag **`v1.0.0-alpha.57`** optional).

- **Notifications card — robustez:** los avisos personalizados vacíos se filtran, sus IDs dejan de depender del orden del editor y la sincronización por `input_text` limita hashes para respetar el máximo de 255 caracteres.
- **Notifications card — notify móvil:** `notify.send_message` vuelve a incluir `data.group`/`data.tag` para agrupación y reemplazo de notificaciones, evitando también enviar avisos que se hayan descartado mientras esperaban en cola.
- **Notifications card — auditoría:** acciones de servicio más ligeras al reutilizar allowlists normalizadas y corrección del cálculo de temperatura baja para usar el sensor más frío, no el más caliente.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.57`**.

---

## [1.0.0-alpha.56] - 2026-05-08

Fifty-sixth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.56`** (tag **`v1.0.0-alpha.56`** optional).

- **Calendar card — selector de color nativo:** el composer de eventos usa el mismo selector visual de color que los editores, con swatch sincronizado y feedback inline si faltan campos obligatorios.
- **Notifications card — notify HA 2026.5:** el envío a entidades `notify.*` usa payload compatible con `notify.send_message` y las notificaciones de calendario enlazan mejor con el detalle del popup.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.56`**.

---

## [1.0.0-alpha.55] - 2026-05-08

Fifty-fifth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.55`** (tag **`v1.0.0-alpha.55`** optional).

- **Calendar card — haptics:** la tarjeta añade respuesta háptica configurable en acciones principales y un apartado propio en el editor visual.
- **Calendar/Notifications card — popup conectado:** las notificaciones de calendario abren el popup grande de `nodalia-calendar-card` mediante evento interno, evitando el more-info genérico de Home Assistant.
- **Notifications card — notify moderno:** el editor permite seleccionar entidades `notify.*` con selector nativo de HA y usa `notify.send_message`, manteniendo servicios `notify.*` legacy como compatibilidad.
- **Notifications card — editor y animaciones:** las conexiones inteligentes se pueden plegar, el selector de color queda alineado con `nodalia-entity-card` y la animación de entrada se dispara al cambiar la pila real de avisos.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.55`**.

---

## [1.0.0-alpha.54] - 2026-05-07

Fifty-fourth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.54`** (tag **`v1.0.0-alpha.54`** optional).

- **Notifications card — editor y legibilidad:** el selector de color vuelve al patrón del resto de tarjetas, se retiran controles de título que no se renderizan y los iconos aplican contraste tipo `NodaliaBubbleContrast` para tintes claros/amarillos.
- **Notifications card — avisos inteligentes configurables:** mensajes, títulos, colores y URL opcional por tipo de aviso (`calor`, `humedad`, `lluvia`, `bateria`, `deposito`, `tinta`), con nuevas entidades inteligentes para batería, depósito de humidificador y tinta.
- **Notifications card — móvil:** las tarjetas dejan de estirarse al volver de horizontal a vertical con alineación superior y reflow en `resize/orientationchange`.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.54`**.

---

## [1.0.0-alpha.53] - 2026-05-07

Fifty-third **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.53`** (tag **`v1.0.0-alpha.53`** optional).

- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.53`**.

---

## [1.0.0-alpha.52] - 2026-05-07

Fifty-second **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.52`** (tag **`v1.0.0-alpha.52`** optional).

- **Bundle loader:** `nodalia-cards.js` vuelve a ser autocontenido para instalaciones HACS de un solo `filename`; `nodalia-cards.bundle.js` y `nodalia-cards.manifest.js` quedan como artefactos auxiliares, evitando que Home Assistant deje todas las tarjetas sin registrar si esos ficheros no se sirven junto al loader.
- **Notifications card — avisos más inteligentes:** las recomendaciones de ventilador cruzan sensores y `fan` por área/nombre de estancia antes de proponer acciones, y el forecast horario de `weather/get_forecasts` añade avisos de lluvia próxima.
- **Notifications card — sincronización y móvil:** nuevo helper opcional `input_text` para compartir descartes entre dispositivos y envío opcional a servicios `notify.*` con severidad mínima configurable.
- **Notifications card — limpieza visual/editor:** se evita el aviso vacío “Nueva notificacion”, se ocultan chips repetidos/`Info`, se reduce la tipografía del estado sin avisos y se elimina el selector de icono general que no tenía efecto real.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.52`**.

---

## [1.0.0-alpha.51] - 2026-05-07

Fifty-first **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.51`** (tag **`v1.0.0-alpha.51`** optional).

- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.51`**.

---

## [1.0.0-alpha.50] - 2026-05-07

Fiftieth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.50`** (tag **`v1.0.0-alpha.50`** optional).

- **Notifications card — tintado Entity Card:** el estado sin avisos y las tarjetas activas usan la misma superficie tintada/pseudo-capas que `nodalia-entity-card`, evitando bordes/sombras recortadas en el estado vacío.
- **Notifications card — editor visual compacto:** las conexiones inteligentes cambian de textarea a selectores nativos de entidad filtrados por dominio, con filas compactas para añadir/quitar entidades.
- **Notifications card — editor visual ampliado:** los selectores nativos de icono ocupan fila completa, los desplegables de secciones usan el mismo boton con chevron del resto de tarjetas, se añaden animaciones configurables y selectores de color para tintado global y por notificacion personalizada.
- **Notifications card — estabilidad de calendario:** el refresco de eventos ya no se reprograma indefinidamente con cada actualización de `hass`, evitando que instalaciones con muchos cambios de estado bloqueen la consulta.
- **Notifications card — i18n y seguridad:** los avisos inteligentes usan `NodaliaI18n` y las acciones de servicio personalizadas incorporan `security.strict_service_actions` con allowlist de servicios/dominios, manteniendo bypass solo para acciones internas de la tarjeta.
- **Bundle loader:** `nodalia-cards.js` pasa a ser un loader cache-busting que lee `nodalia-cards.manifest.js` e importa `nodalia-cards.bundle.js?v=<hash>`, reduciendo cargas antiguas tras redescargar desde HACS.
- **Calendar card — papelera centrada:** el botón icon-only para borrar eventos nativos usa tamaño cuadrado y centrado explícito para evitar que el icono quede desplazado.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.50`**.

---

## [1.0.0-alpha.49] - 2026-05-07

Forty-ninth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.49`** (tag **`v1.0.0-alpha.49`** optional).

- **Calendar card — borrado nativo de eventos:** las filas y el detalle de evento muestran una papelera cuando el calendario soporta borrado; usa `calendar/event/delete` con `uid`/`recurrence_id` como la UI nativa de Home Assistant.
- **Release metadata:** align alpha channel references and bundle version metadata to **`1.0.0-alpha.49`**.

---

## [1.0.0-alpha.48] - 2026-05-07

Forty-eighth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.48`** (tag **`v1.0.0-alpha.48`** optional).

- **Notifications card — escala Entity Card:** reduce iconos, texto y alturas para alinearse con `nodalia-entity-card`, y usa chips/burbujas compactas para fuente, severidad y acciones.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.48`**.

---

## [1.0.0-alpha.47] - 2026-05-07

Forty-seventh **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.47`** (tag **`v1.0.0-alpha.47`** optional).

- **Notifications card:** primera alpha versionada de `custom:nodalia-notifications-card` en el bundle, con centro inteligente de avisos, pila expandible, borrado persistente, recomendaciones y editor visual.
- **Notifications card — estilo Nodalia compacto:** estado sin avisos como barra verde tintada y notificaciones como tarjetas icono+texto apiladas, con cartas traseras visibles y burbuja de despliegue.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.47`**.

---

## [1.0.0-alpha.46] - 2026-05-07

Forty-sixth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.46`** (tag **`v1.0.0-alpha.46`** optional).

- **Calendar card — forecast HA moderno:** suscripción diaria persistente con `weather/subscribe_forecast`, alineada con Weather Card, para recibir días futuros y `templow` cuando `weather/get_forecasts` o atributos legacy no devuelven datos.
- **Calendar card — forecast más robusto:** fallback por `weather.get_forecasts` con respuesta y lectura de tipos soportados (`daily`, `twice_daily`, `hourly`) agregados por día; ahora se prioriza el candidato con más días futuros y no se deja que una suscripción parcial de “solo hoy” pise la previsión semanal.
- **Calendar card — solo eventos nativos:** se elimina el flujo de recordatorios rápidos/locales y el botón de creación pasa a crear siempre eventos reales de Home Assistant, evitando eventos sintéticos que podían interferir con persistencia de completados.
- **Calendar card — composer nativo ampliado:** creación de eventos HA con descripción, ubicación, recurrencia nativa cerrada (`none`/`yearly`/`monthly`/`weekly`/`daily` vía `calendar/event/create`) y color propio opcional guardado como metadato Nodalia en la descripción.
- **Calendar card — detalle de evento:** en la vista mensual ampliada, al pulsar un día y luego un evento se abre una ficha grande con descripción, ubicación, calendario, horario y repetición cuando estén disponibles.
- **Calendar card — composer sin recortes:** el formulario de creación nativa usa altura real de viewport y scroll propio para no cortarse cuando el rango seleccionado no tiene eventos.
- **Calendar card — webhook evento nativo:** el payload de creación añade `service_data` y `ha_action` saneados para `calendar.create_event`, evitando enviar campos vacíos incompatibles como `start_date_time: ""` en eventos de todo el día y pasando `description`/`location` solo si existen; la recurrencia queda en `calendar_event`/websocket para no romper el servicio HA.
- **Calendar card — validación de fechas:** crear un evento nativo con fecha anterior a hoy muestra un error integrado en el popup y evita enviar el webhook/servicio.
- **Calendar card — tiempo en popup ampliado:** la vista grande también muestra el chip de tiempo en columnas/días, celdas del mes y detalle de día cuando hay forecast disponible.
- **Notifications card:** nueva `custom:nodalia-notifications-card` como centro inteligente con vacio amable, pila expandible, borrado persistente, eventos de calendario de hoy, estados de robot, recomendaciones weather/fan, sensores y notificaciones personalizadas desde editor visual.
- **Performance:** bundle minificado y editor de Calendar con firma de entidades filtrada a `calendar`, `input_text` y `weather` para reducir parseo/coste en instalaciones grandes.
- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.46`**.

---

## [1.0.0-alpha.40] - 2026-05-06

Fortieth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.40`** (tag **`v1.0.0-alpha.40`** optional).

- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.40`**.

---

## [1.0.0-alpha.38] - 2026-05-06

Thirty-eighth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.38`** (tag **`v1.0.0-alpha.38`** optional).

- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.38`**.

---

## [1.0.0-alpha.37] - 2026-05-06

Thirty-seventh **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.37`** (tag **`v1.0.0-alpha.37`** optional).

- **Release metadata:** bump alpha channel references and bundle version metadata to **`1.0.0-alpha.37`**.

---

## [1.0.0-alpha.36] - 2026-05-06

Thirty-sixth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.36`** (tag **`v1.0.0-alpha.36`** optional).

- **Calendar card — weather visible en más casos reales:** emparejado día calendario ↔ forecast reforzado (claves locales/padded y fallback por proximidad de día) para evitar cabeceras sin clima cuando el proveedor devuelve formatos heterogéneos.
- **Calendar card — popup composer sin recortes en estado vacío:** al abrir “nuevo recordatorio / nuevo evento” desde una vista sin eventos, el panel expandido eleva altura mínima y evita clipping para mostrar el formulario completo.
- **Calendar card — esquinas/contorno del panel:** ajuste de layout del panel expandido al abrir composer para eliminar artefactos visuales (cortes y esquinas puntiagudas) en overlays.

---

## [1.0.0-alpha.35] - 2026-05-06

Thirty-fifth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.35`** (tag **`v1.0.0-alpha.35`** optional).

- **Calendar card — persistencia `v6` multi-helper (255x4):** nuevo formato compacto `v6:` y soporte para hasta **4** `input_text` (`shared_completed_events_entity` + `_2/_3/_4`) con reparto/reensamblado de payload para ampliar capacidad total.
- **Calendar card — webhook de creación al vuelo:** nuevos campos `quick_reminder_webhook` y `native_event_webhook` para crear recordatorios/eventos mediante automatizaciones webhook cuando el usuario no tiene permisos directos de servicio.
- **Calendar card — clima más resiliente:** si no hay forecast diario utilizable, fallback visual con estado/temperatura actual del `weather_entity` para evitar cabeceras vacías.
- **Calendar card — fix visual composer:** el sub-popup de creación ya no se recorta cuando la vista base tiene poca altura (panel con scroll y sin clipping del contenedor).

---

## [1.0.0-alpha.34] - 2026-05-06

Thirty-fourth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.34`** (tag **`v1.0.0-alpha.34`** optional).

- **Calendar card — forecast normalizado como weather-card:** la lectura de previsión diaria ahora unifica más variantes de payload (arrays, `forecast`, `daily`, `hourly`, estructuras anidadas y puntos sueltos) para reducir casos donde la cabecera diaria no mostraba clima.
- **Calendar card — day-key robusto:** se admiten fechas en `datetime/date` tanto ISO como epoch (segundos o milisegundos), mejorando el emparejado día calendario ↔ día forecast.
- **Calendar card — condición compatible:** fallback de condición (`condition`/`weather`) en el render de cabeceras diarias.

---

## [1.0.0-alpha.33] - 2026-05-06

Thirty-third **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.33`** (tag **`v1.0.0-alpha.33`** optional).

- **Calendar card — clima diario visible en más integraciones:** compatibilidad ampliada de campos de forecast (max/min) para mostrar icono y temperaturas en la cabecera de cada día con más proveedores.
- **Calendar card — fallback visual:** cuando no hay min/max pero sí condición, se muestra el bloque meteorológico con icono y `— / —` en lugar de ocultarlo.
- **Calendar card — rendimiento/memoria:** firma de render compacta basada en hash (menos churn de strings grandes) y protección `single-flight` en refresh para evitar solapes de cargas.

---

## [1.0.0-alpha.32] - 2026-05-06

Thirty-second **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.32`** (tag **`v1.0.0-alpha.32`** optional).

- **Calendar card — selector nativo HA en composer:** el alta de eventos nativos dentro del popup usa control nativo (`ha-selector` de entidad `calendar`) en lugar de `select` HTML, manteniendo fallback de compatibilidad.
- **Calendar card — forecast diario más tolerante:** lectura de `weather/get_forecasts` ampliada para contemplar variantes de estructura de respuesta y fallback a atributos de estado cuando aplica.
- **Advance Vacuum — persistencia webhook-only:** la deduplicación de sesión compartida separa rama webhook sin entidad para no bloquear retransmisión de sesión vacía en casos límite.
- **Tests:** nuevo test de regresión para persistencia webhook-only en Advance Vacuum.

---

## [1.0.0-alpha.31] - 2026-05-06

Thirty-first **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.31`** (tag **`v1.0.0-alpha.31`** optional).

- **Calendar card — composer unificado:** crear evento nativo de Home Assistant deja de usar prompts y pasa a un composer integrado (selector de calendario, título, fecha, horas y todo el día) con el mismo estilo del popup.
- **Calendar card — polish visual composer:** selector de color circular, switch tipo toggle para “Todo el día” y fondo del composer con tinte del acento de la tarjeta para coherencia visual.
- **Calendar card — weather forecast robusto:** prioridad a `weather/get_forecasts` (daily) con fallback a `state.attributes.forecast`, mejorando compatibilidad y visibilidad real del tiempo diario en cabeceras.

---

## [1.0.0-alpha.30] - 2026-05-06

Thirtieth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.30`** (tag **`v1.0.0-alpha.30`** optional).

- **Calendar card:** el flujo de agregar recordatorios rápidos deja de usar prompts del navegador y pasa a un sub-popup estilizado dentro del panel ampliado (misma estética de la tarjeta).
- **Calendar card:** corrección del emparejado de previsión diaria (`weather_entity`) para evitar desajustes de día por timezone al leer `forecast.datetime`.

---

## [1.0.0-alpha.29] - 2026-05-06

Twenty-ninth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.29`** (tag **`v1.0.0-alpha.29`** optional).

- **Calendar card:** popup ampliado con acciones rápidas para crear **recordatorios locales** (titulo, fecha/hora, color) y crear **eventos en calendarios nativos HA** sin salir del dashboard.
- **Calendar card:** integración de recordatorios rápidos dentro de la misma lista/agrupación temporal de eventos.
- **Calendar / Graph cards:** ajuste fino de animación de entrada para mantener consistencia visual tipo rebote con el resto de tarjetas.

---

## [1.0.0-alpha.28] - 2026-05-06

Twenty-eighth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.28`** (tag **`v1.0.0-alpha.28`** optional).

- **Calendar / Graph cards:** la animación de entrada se rearma al volver a mostrar la vista aunque HA mantenga la tarjeta montada (detección por visibilidad en viewport con `IntersectionObserver`).
- **Advance Vacuum:** restauración de sesión corregida para `utilityPanel` (solo se aplica si hay valor persistido, coherente con `modePanelPreset`; evita reset espurio a `null`).

---

## [1.0.0-alpha.27] - 2026-05-06

Twenty-seventh **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.27`** (tag **`v1.0.0-alpha.27`** optional).

- **Calendar card:** la animación de entrada vuelve a dispararse al reentrar al dashboard (reset en attach/detach).
- **Person card:** con **`show_name: false`** el bloque de texto se oculta por completo para centrar de verdad el avatar sin huecos.
- **Light / Entity cards:** corrección de regresión en posición del estado (**derecha** / **debajo**), respetando explícitamente el ajuste seleccionado.

---

## [1.0.0-alpha.26] - 2026-05-06

Twenty-sixth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.26`** (tag **`v1.0.0-alpha.26`** optional).

- **Calendar card — codec completados `v5:`:** huellas **24-bit** + binario Base64URL (`v5:`); hasta **~62** marcados en **255** caracteres; **`pickShortestCompletionPayload`** compite **`v5:`** / **`v4:`** / **`v3:`** (el más corto que quepa).
- **Calendar card — `v4:` más denso:** huellas **40-bit** y recuento **`uint8`** (esquema binario `0x02`); se sigue leyendo el formato anterior **48-bit** / `uint16` (`0x01`).
- **Advance Vacuum:** separación de llamadas internas y externas en modo estricto (`_callInternalService` para servicios fijos de la tarjeta como `vacuum.send_command`, `select.select_option`, `input_text.set_value`, `roborock.set_vacuum_goto_position`), manteniendo la allowlist para acciones definidas por el usuario.
- **Light card:** opción **`state_position`** (`right` / `below`) para colocar el estado a la derecha del nombre o debajo.
- **Person card:** opción **`show_name`** para ocultar el nombre; al ocultarlo, el avatar se centra en la tarjeta.

---

## [1.0.0-alpha.25] - 2026-05-06

Twenty-fifth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.25`** (tag **`v1.0.0-alpha.25`** optional).

- **Calendar card — persistencia completados:** codec **`v4:`** (huellas FNV-1a 48-bit + binario Base64URL, orden-independiente); **`pickShortestCompletionPayload`** elige el **más corto** entre **`v4:`** y **`v3:`** si ambos caben; **`v2:`** / JSON solo si los estables no caben.

---

## [1.0.0-alpha.24] - 2026-05-06

Twenty-fourth **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.24`** (tag **`v1.0.0-alpha.24`** optional).

- **`NodaliaUtils.postHomeAssistantWebhook`:** usa **`hass.auth.fetchWithAuth`** cuando se pasa **`hass`** (evita **401** desde Lovelace frente a **`fetch`** sin token); acepta **`webhook_id`** o URL/pegar **`/api/webhook/…`**; calendario y Advance Vacuum pasan **`this._hass`** en persistencia por webhook.
- **Calendar card — codec completados `v3:`:** huellas **FNV-1a** (UTF-8) + **base62** por clave lógica; orden-independiente frente a **`v2:`**; **`pickShortestCompletionPayload`** compite **v2 / v3 / JSON**.
- **Editor calendario (`ha-selector`):** varios dominios en **`data-domains`** usan **`entity: { domain: [...] }`** en lugar de **`{}`** (restricción alineada con Advance Vacuum).

---

## [1.0.0-alpha.23] - 2026-05-06

Twenty-third **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.23`** (tag **`v1.0.0-alpha.23`** optional).

- **Persistencia sin permiso `input_text.set_value`:** **`NodaliaUtils.postHomeAssistantWebhook`** (`POST` JSON a `/api/webhook/<webhook_id>`). Opciones **`shared_completed_events_webhook`** (calendario) y **`shared_cleaning_session_webhook`** (Advance Vacuum): si están definidas, la escritura compartida usa el webhook en lugar del servicio (una automatización **Webhook** del administrador puede llamar a **`input_text.set_value`**). El **`webhook_id`** debe mantenerse secreto.
- **Advance Vacuum:** **`_isServiceAllowed`** con allowlists vacías ya no usa fail-open (`strict_service_actions` implícito): coincide con el resto de tarjetas (**denegar** si no hay entradas). Por defecto **`security.strict_service_actions: false`** en **`DEFAULT_CONFIG`** mantiene el comportamiento permisivo anterior sin YAML extra.
- **Calendar card — formato compacto `v2:` para completados:** módulo **`nodalia-calendar-completion-codec.js`**: prefijo cronológico (`v2:n{k}` = primeros *k* eventos en ventana), totales `v2:t` / vacío `v2:z`, trozos por día `dYYYYMMDD` + `t` (todo el día), `n{j}` (primeros *j* ese día) o `i1-3` (posiciones 1-based en ese día). Se elige la cadena más corta frente al JSON de claves largas; sigue existiendo compatibilidad con el array JSON legacy. Los índices dependen del orden de eventos cargados (si cambian citas, puede haber que revisar marcas).

---

## [1.0.0-alpha.22] - 2026-05-06

Twenty-second **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.22`** (tag **`v1.0.0-alpha.22`** optional).

- **Calendar card:** persistencia en **`input_text`**: se ignoraban actualizaciones websocket **anticipadas** con el valor **viejo** del helper justo después de marcar completado; `_syncCompletedPersistenceFromHass` volvía a pisar **`_completed`** antes de que **`set_value`** reflejara en HA. Ahora hay **`_pendingSharedCompletedPayload`** (forma canónica del JSON) y no se aplica un estado remoto obsoleto mientras el pendiente no coincide; comparación canónica entre estado HA y payload local.
- **Advance Vacuum (`0.13.9`):** segundo **`console.warn`** si **`set_value`** falla (p. ej. usuario sin permiso sobre el **`input_text`**).

---

## [1.0.0-alpha.21] - 2026-05-06

Twenty-first **`alpha`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.21`** (tag **`v1.0.0-alpha.21`** optional).

- **Advance Vacuum (`0.13.8`):** persistencia **`input_text`** — vuelve la deduplicación con **`_lastSubmittedSharedCleaningSessionValue`** antes del servicio y **`null`** en **`catch`** para no spamear **`set_value`** mientras HA sincroniza y permitir reintento si falla. **`security.strict_service_actions`** explícito **`true`** con listas vacías ya **no** abre todo el mundo: sin entradas en la allowlist se deniega ( **`fail-closed`** ); la persistencia al helper sigue usando el bypass dedicado.
- **Calendar card:** mismo patrón optimista + **`catch`** en **`_saveCompleted`** para el helper de completados.

---

## [1.0.0-alpha.20] - 2026-05-06

Twentieth **`alpha`** on the **`1.0.0`** line (**branch `alpha`**). Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.20`** (tag **`v1.0.0-alpha.20`** optional).

---

## [1.0.0-alpha.19] - 2026-05-06

Nineteenth **`alpha`** on the **`1.0.0`** line (**branch `alpha`**). Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.19`** (tag **`v1.0.0-alpha.19`** optional).

- **Calendar / Advance Vacuum:** persistencia en **`input_text`**: se evitaba reenviar tras un **`set_value` fallido** porque la deduplicación guardaba el valor “optimista” antes de confirmar el servicio; ahora solo se compara con el estado en HA y **`_lastSubmitted`** solo se actualiza si la llamada termina bien (con **`trim`** en calendario). **Vacuum:** **`input_text.set_value`** hacia el helper configurado **ignora la allowlist** de **`security.allowed_*`** para que el modo estricto no bloquee la sincronización. **Vacuum card** **`0.13.6`**: editor visual con **`ha-entity-picker`** primero (como calendario), bloque ancho + texto de ayuda para **`shared_cleaning_session_entity`**.

---

## [1.0.0-alpha.18] - 2026-05-06

Eighteenth **`alpha`** on the **`1.0.0`** line (**branch `alpha`**). Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.18`** (tag **`v1.0.0-alpha.18`** optional).

- **Calendar card:** vista **mes**: un evento compacto por día y **puntos** (tint) para más eventos; vista **día**: todos los eventos con **scroll**; la animación de apertura del **panel** del popup no se repite al marcar **hecho** ni al actualizar dentro del popup.

---

## [1.0.0-alpha.14] - 2026-05-06

Fourteenth **`alpha`** on the **`1.0.0`** line (**branch `alpha`**). Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.14`** (tag **`v1.0.0-alpha.14`** optional).

---

## [1.0.0-alpha.13] - 2026-05-06

Thirteenth **`alpha`** on the **`1.0.0`** line (**branch `alpha`**). Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.13`** (tag **`v1.0.0-alpha.13`** optional).

- **Calendar card:** en el popup **mes**, **pulsa un día** para abrir la vista centrada en ese día: primer evento destacado, **puntos de color** (tint de cada calendario) para el resto, lista **con scroll** de los demás eventos; botón **«Mes»**, **Escape** vuelve al calendario mensual antes de cerrar el popup.

---

## [1.0.0-alpha.12] - 2026-05-06

Twelfth **`alpha`** on the **`1.0.0`** line (**branch `alpha`**). Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.12`** (tag **`v1.0.0-alpha.12`** optional).

- **Calendar card:** en el popup **mes**, los días con **varios eventos** usan de nuevo **scroll vertical dentro del día**: los bloques eran ítems flex con **`flex-shrink: 1`** y **`min-height: 0`** (compact), así que se **aplastaban** unos sobre otros en lugar de desbordar con scroll; ahora cada evento tiene **`flex-shrink: 0`**, altura de fila **`grid-auto-rows`** fija y la zona de eventos ocupa el resto del día con **`overflow-y: auto`**.

---

## [1.0.0-alpha.11] - 2026-05-06

Eleventh **`alpha`** on the **`1.0.0`** line (**branch `alpha`**). Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.11`** (tag **`v1.0.0-alpha.11`** optional).

- **Advance Vacuum card:** **`shared_cleaning_session_entity`** vuelve a **persistir** cuando el modo activo es **`routines`**: `_normalizeCleaningSession` solo admitía `activeMode` en `all` / `rooms` / `zone` / `goto`, así que **`routines`** se perdía y el helper podía quedar vacío o sin `a=routines`. **`nodalia-advance-vacuum-card.js`**: `CARD_VERSION` **0.13.4**.
- **Calendar card:** opción **`shared_completed_events_entity`** (`input_text`): los completados se sincronizan entre dispositivos vía HA (sin helper, solo `localStorage`).
- **Calendar card:** vista mensual del popup con **scroll horizontal** en pantallas estrechas y columnas con **ancho mínimo** para legibilidad en móvil.

---

## [1.0.0-alpha.10] - 2026-05-06

Tenth **`alpha`** on the **`1.0.0`** line (**branch `alpha`**). Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.10`** (tag **`v1.0.0-alpha.10`** optional).

- **Calendar card:** carga de eventos más **compatible con HA Companion / WebKit**: si `callApi` devuelve algo que no es un array o falla, se reintenta con **`fetchWithAuth`** sobre `/api/calendars/...`; respuestas envueltas en objeto se normalizan cuando traen una lista en **`events`**.
- **Calendar card:** fechas **solo día** (`YYYY-MM-DD` / `start.date`) se interpretan en **calendario local** para que el agrupado coincida en **iOS/Safari** con escritorio.
- **Calendar card:** al volver a la pestaña o a la app (`visibilitychange`), se **vuelven a pedir** eventos para recuperar datos tras suspender la vista en móvil.

---

## [1.0.0-alpha.9] - 2026-05-06

Ninth **`alpha`** on the **`1.0.0`** line (**branch `alpha`**). Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.9`** (tag **`v1.0.0-alpha.9`** optional).

- **Calendar card:** panel ampliado con estilo acorde al **popup del gráfico** en Weather (vidrio, acento, animación de entrada); **tintado manual** aplica el mismo cromado que el primario cuando el automático está desactivado; icono por defecto con **mezcla tema** (`primary` + texto) para legibilidad en claro/oscuro.
- **Calendar card:** animación de **entrada** solo tras terminar la carga (no se “gasta” en la vista de carga); al **marcar** un evento como hecho, **salida animada** (escala + desvanecimiento) antes de ocultar la fila.

---

## [1.0.0-alpha.8] - 2026-05-05

Eighth **`alpha`** on the **`1.0.0`** line (**branch `alpha`**). Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-alpha.8`** (tag **`v1.0.0-alpha.8`** optional).

- **Calendar card:** editor adds **etiqueta** y **color de tintado** por calendario (la etiqueta sustituye al subtítulo bajo el evento cuando está definida); el chip del encabezado usa **rangos predefinidos** (3 días, 1 semana, 2 semanas, 1 mes) en lugar de un número libre de días.
- **Calendar card:** al pulsar la tarjeta se abre un **panel ampliado** con todo el rango: columna vertical para 3 días, columnas horizontales desplazables para 1–2 semanas, y **rejilla mensual** para el rango de un mes; **Escape** o el fondo cierran el panel.
- **Calendar card:** con **tintado automático**, la tarjeta usa el mismo esquema visual que **Entity card** en estado activo (degradado 135° sobre `ha-card`, borde `color-mix` con `--divider-color`, sombra de elevación, overlays `::before` / `::after`), burbuja de icono con borde/sombra tipo pill y chips de cabecera alineados con los chips de Entity (`fondo/borde` al 6%, peso 600). Con tintado automático desactivado, la tarjeta pasa a fondo y borde neutros como Entity **inactiva**.

---

## [1.0.0-alpha.7] - 2026-05-05

Seventh **`alpha`** on the **`1.0.0`** line (**branch `alpha`**).

- **Calendar card:** debajo del título del evento se muestra el **nombre amistoso** de la entidad (`friendly_name`) en lugar del id crudo (`calendar.xxx`); si no hay nombre, se usa una forma legible del sufijo de entidad.

---

## [1.0.0-alpha.6] - 2026-05-05

Sixth **`alpha`** on the **`1.0.0`** line (**branch `alpha`**).

- **Calendar editor:** color-related style fields use the same visual color picker + swatch pattern as other Nodalia cards.
- **Calendar editor:** “Añadir calendario” works again (empty calendar slots are preserved instead of being stripped on normalize).
- **Calendar:** default **`max_visible_events`** is now **2** (was 3).

---

## [1.0.0-alpha.5] - 2026-05-05

Fifth **`alpha`** on the **`1.0.0`** line (**branch `alpha`**).

- **Calendar visual editor:** aligned layout and styling with other Nodalia editors (section headers + hints, 18px rounded panels, graph-style series cards per calendar, primary-color toggles, collapsible Animaciones/Estilos with chevron buttons, `ha-icon-picker` for icon, `editorStatesSignature` + focus restore on hass updates).

---

## [1.0.0-alpha.4] - 2026-05-05

Fourth **`alpha`** on the **`1.0.0`** line (**branch `alpha`**). Calendar card stability fix.

- **Calendar card:** stopped re-rendering the full shadow DOM on every Home Assistant `hass` update (the setter was rebuilding `innerHTML` continuously, which caused visible flicker and replayed the entrance animation). Renders are now driven by first `hass`, locale changes, config/refresh, completion toggles, and deduplicated when the visible model is unchanged.
- **Calendar card:** entrance animation runs once per card instance instead of on every paint.

---

## [1.0.0-alpha.3] - 2026-05-05

Third **`alpha`** on the **`1.0.0`** line (**branch `alpha`**). This release continues polishing the new calendar card and editor experience.

- **Calendar editor parity:** visual editor aligned further with Nodalia card-editor patterns and interaction behavior.
- **Calendar UX polish:** continued refinement of list visibility/scroll behavior and event configuration controls.
- **Iteration release:** version bump to keep alpha feedback cycles short while `0.6.1` remains stable on `main`.

---

## [1.0.0-alpha.2] - 2026-05-05

Second **`alpha`** on the **`1.0.0`** line (**branch `alpha`**). This cut refines the initial calendar-card introduction with a stronger visual-editor workflow and event-list behavior.

- **Calendar editor UX:** moved calendar selection to native entity picker rows with add/remove controls (multi-calendar friendly, consistent with other Nodalia editors).
- **Calendar list behavior:** added configurable `max_visible_events` (originally default **3**, now **2** from **1.0.0-alpha.6**) and vertical scroll beyond the visible-event threshold.
- **Polish pass:** aligned interaction flow and config normalization for the new card while keeping `0.6.1` as stable baseline on `main`.

---

## [1.0.0-alpha.1] - 2026-05-05

First **`alpha`** on the **`1.0.0`** line (**branch `alpha`**). This marks the start of the next major cycle while `0.6.1` remains the stable baseline on `main`.

- **New card:** added **`nodalia-calendar-card`** with Nodalia visual style to show upcoming events by configurable day range.
- **Calendar UX:** supports selecting calendar entities, elegant grouped event display, and in-card event completion toggles for already completed/personal tracking flows.
- **Editor support:** added a visual editor for title, calendars list, day range, refresh interval, and completed-event visibility/marking behavior.

---

