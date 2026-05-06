# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

Work toward **`1.0.0`** on **`alpha`** / **`beta`** while **`0.6.1`** remains the stable baseline on **`main`**: additional polish, performance, security and feature work before the next major stable. Prerelease workflow and tagging: **CONTRIBUTING**.

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

## [1.0.0-beta.2] - 2026-05-06

Second **`beta`** on **`1.0.0`**. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-beta.2`** (tag **`v1.0.0-beta.2`** optional).

- **Advance Vacuum (`0.13.7`):** la sesión compartida en **`input_text`** incluye ahora la «vista» de la tarjeta: **preset del panel de modos** (aspirado/fregado, `pp=` en el helper) y **panel lateral utilidades** abierto (`modes` / `dock`, `xu=`). Cambiar pestañas de modo o abrir/cerrar esos paneles llama a **`set_value`** como el resto de selecciones.

---

## [1.0.0-beta.1] - 2026-05-06

First **`beta`** on the **`1.0.0`** line (**branch `beta`**). Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`1.0.0-beta.1`** (Git tag **`v1.0.0-beta.1`** recommended for HACS/GitHub Releases).

- **Nodalia Vacuum Card (`nodalia-vacuum-card`) `0.6.3`:** editor visual alineado con Advance/calendario: **`ha-entity-picker`** primero, **`ha-selector`** como respaldo, **`select`** nativo al final; placeholders en campos de entidad auxiliar.

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

## [0.6.1] - 2026-05-05

Patch stable release on **`main`**. This version promotes the `0.6.1-alpha.1` fixes to stable, focused on security/i18n consistency and preserving media player style flexibility in navigation.

- **Editor i18n consistency:** new service-security labels are normalized for translation flow in visual editors (Insignia, Entity, Fav, Advance Vacuum).
- **Navigation hardening:** `media_player.background` is sanitized with safe fallback before being used in `color-mix(...)`.
- **Navigation customization restored:** user-configurable `styles.media_player.border`, `styles.media_player.border_radius`, and `styles.media_player.box_shadow` are honored again (with sanitization + defaults).

---

## [0.6.1-alpha.1] - 2026-05-05

First **`alpha`** on the **`0.6.1`** patch line (**branch `alpha`**). This prerelease starts the fast fix stream toward `0.6.1` stable, focusing on review-driven hardening and editor consistency.

- **Editor i18n consistency:** normalized newly added service-security labels to project-consistent translatable strings in visual editors (Insignia, Entity, Fav, Advance Vacuum).
- **Navigation bar hardening:** `media_player.background` now goes through runtime CSS sanitization with safe fallback before use in `color-mix(...)`.
- **Navigation bar customization compatibility:** restored support for user-configured `styles.media_player.border`, `styles.media_player.border_radius`, and `styles.media_player.box_shadow` (with sanitization and defaults), instead of hardcoded values.

---

## [0.6.0] - 2026-05-05

Second stable release on **`main`**.

This version focuses on **refinement, stability and consistency across the entire UI**, consolidating all validated work from the `0.6.0-alpha.*` and `0.6.0-beta.*` cycles into a smoother, more reliable and secure experience.

---

## ✨ Highlights

- Noticeably smoother interactions across multiple cards
- Improved visual consistency aligned with Nodalia design language
- Strengthened security model for actions and user-defined configs
- Better internal structure for long-term maintainability

---

## 🧠 Stability & UX

- **Graph card**
  - Fully stabilized tooltip and hook lifecycle for continuous tracking
  - Reliable close behavior across desktop and mobile
  - Fixed legend chip clipping on press (mobile)

- **Navigation bar**
  - Reduced micro-bounce in mini-player and popups
  - Entrance animations now trigger only on real visibility changes

- **Media presentation**
  - Mini media player visually aligned with Nodalia design system
  - Filtered noisy/irrelevant sources (e.g. `AirMusic` in HomePod scenarios)

---

## 🔒 Security

- Service actions remain **strict by default**
- Visual editors now expose:
  - `strict_service_actions`
  - `allowed_services`
- URL handling fully hardened:
  - Unsafe schemes blocked
  - External links protected with `noopener,noreferrer`
- Runtime style values are sanitized in critical rendering paths

---

## ⚡ Performance & Architecture

- Drag interactions optimized:
  - Geometry caching reused across components
  - Reduced layout recalculations

- Render system improvements:
  - Unified render signature strategy via shared helper
  - More predictable updates in high-frequency UI elements

- Internal structure:
  - Modularization groundwork completed (navigation, graph, media flows)
  - Cleaner separation between runtime and rendering logic

---

## 🛠️ Tooling & Release Quality

- CI pipeline introduced:
  - `npm ci`
  - `npm test`
  - `npm run bundle`

- Expanded test coverage:
  - Interaction tests
  - Smoke tests
  - Security guards
  - Render signature validation

- Stability checklist formalized:
  - `docs/STABILITY_CHECKLIST_0_6_0.md`

- Bundle diagnostics:
  - Version + content hash exposed at startup for quick validation

---

## 💬 Notes

This release is focused on **making everything feel better**:
less friction, fewer edge cases, and more predictable behavior across all cards.

It sets a solid foundation for upcoming improvements in UI, new cards, and advanced features.

---

## [0.6.0-alpha.5] - 2026-05-05

Fifth **`alpha`** on the **`0.6.x`** line (**branch `alpha`**). This release mirrors the latest beta-level fixes under the alpha distribution channel to help validate real-world loading/resource-cache behavior where alpha delivery is preferred. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.6.0-alpha.5`** (tag **`v0.6.0-alpha.5`** optional).

- **Bundle diagnostics:** startup console line now surfaces package version + content hash to quickly confirm which build Home Assistant actually loaded.
- **Graph card (mobile):** chip press clipping fix retained using padding-based scroll-container guard (without ineffective cross-axis overflow override).
- **Review/QA polish:** clarified sanitizer guard test naming and kept regression suite aligned with latest PR feedback loop.

---

## [0.6.0-beta.3] - 2026-05-05

Third **`beta`** on the **`0.6.x`** line (**branch `beta`**). This cut focuses on load/debug clarity so testers can verify they are running the intended build and avoid false “old version” diagnostics. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.6.0-beta.3`** (tag **`v0.6.0-beta.3`** optional).

- **Bundle diagnostics:** added global startup console info from bundle footer with package version + content hash (`nodalia-cards vX.Y.Z (sha)`), aligned with `window.__NODALIA_BUNDLE__`.
- **Graph card (mobile):** kept the chip-press clipping fix while removing ineffective `overflow-y: visible` from the horizontal legend scroller (padding-based fix retained).
- **Regression tests:** refined sanitizer guard test naming for clearer intent and review auditability.

---

## [0.6.0-beta.2] - 2026-05-05

Second **`beta`** on the **`0.6.x`** line (**branch `beta`**). This cut focuses on post-beta.1 regression polish and review feedback closure. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.6.0-beta.2`** (tag **`v0.6.0-beta.2`** optional).

- **Graph card (mobile):** fixed legend chip/button clipping when pressing in narrow layouts by keeping vertical overflow visible and adding vertical padding in the horizontal chip scroller.
- **Regression safety:** extended release-candidate smoke checks to guard sanitizer behavior and keep reviewer findings from reappearing.
- **Validation pass:** memory-leak concern around graph document listeners was verified against lifecycle cleanup (`disconnectedCallback` + detach path).

---

## [0.6.0-beta.1] - 2026-05-05

First **`beta`** on the **`0.6.x`** line (**branch `beta`**). This release consolidates the full **`0.6.0-alpha.*`** cycle into a tester-facing candidate focused on stability, security hardening, render efficiency, and pre-stable auditability. Installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.6.0-beta.1`** (tag **`v0.6.0-beta.1`** optional).

### Stability and UX fixes

- **Graph card:** hover lifecycle hardened so tooltip tracks continuously while moving and closes when pointer leaves the card in any direction.
- **Graph card:** improved marker/guide/popup sync to reduce visual drift and flicker during fast hover transitions.
- **Navigation bar:** reduced mini-player and popup micro-bounce by gating entrance animations to real visibility transitions (`--entering`) instead of generic re-renders.
- **Navigation media presentation:** mini media player restyled to better match the visual language of other Nodalia cards (surface, border, spacing, shadow).
- **Media chips (nav + media player):** noisy source labels such as `AirMusic` are filtered out for normal HomePod scenarios.

### Security hardening

- **Strict service actions by default:** cards using configurable service calls keep deny-by-default behavior unless explicitly disabled.
- **Visual editor security controls:** added editor fields to configure service hardening directly in UI:
  - toggle for `security.strict_service_actions`,
  - CSV input for `security.allowed_services`.
  Implemented in **Insignia**, **Entity**, **Fav**, and **Advance Vacuum** editors.
- **URL hardening:** media/artwork and action URL sinks pass through sanitization flow (`sanitizeActionUrl`) in critical paths.
- **Runtime style hardening:** additional sanitization guards applied to configurable style values in navigation runtime styles and advance-vacuum style trees.
- **New-tab safety:** URL actions remain standardized with `noopener,noreferrer`.

### Performance and fluency

- **Drag performance:** cached geometry + attach-on-drag listeners (move/up only while dragging) across frequent slider cards to reduce idle overhead and layout churn.
- **Render signature efficiency:** reduced hot-path render signature overhead and unified strategy using shared helper runtime instead of ad hoc object serialization.
- **Bundling infra:** maintained esbuild-based pipeline with deterministic standalone embed stripping and stable bundle output.

### Architecture and maintainability

- Added shared module **`nodalia-render-signature.js`** and integrated it into the bundle pipeline.
- Pilot modularization expanded in high-frequency cards:
  - **Navigation:** signature decomposition into focused helper rows.
  - **Graph:** tracked-state signature extraction and non-JSON render signature path.
  - **Media Player:** switched signature construction to shared runtime helper.
- Added project-level CI workflow (`.github/workflows/ci.yml`) with:
  - `npm ci`
  - `npm test`
  - `npm run bundle`

### Regression safety and release readiness

- Added minimal regression suites for:
  - render signature architecture guards,
  - interaction regressions (graph hover watch + nav animation transitions),
  - security/editor exposure assertions,
  - release-candidate smoke checks (URL hardening, drag listener strategy, shared signature runtime).
- Added **`docs/STABILITY_CHECKLIST_0_6_0.md`** to formalize pre-stable validation gates.

---

## [0.6.0-alpha.4] - 2026-05-05

Fourth **`alpha`** on the **`0.6.x`** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.6.0-alpha.4`** (tag **`v0.6.0-alpha.4`** optional). Breaking changes are allowed; prefer stable **`main`** for production dashboards.

- **Navigation bar (mini media player):** visual style aligned with the rest of Nodalia cards (surface, border, shadow, spacing) and reduced hover bounce in popup items for steadier perceived motion.
- **Media player + nav media chips:** filtered noisy source chip values (notably `AirMusic`) so normal HomePods no longer show a redundant extra chip next to progress/duration.
- **Security hardening (Fase A):** artwork/media URL resolution now passes through shared URL sanitization in media paths; runtime route/popup style vars in nav apply sanitized values only.
- **Advance Vacuum hardening (Fase A):** added safe style tree sanitization for configurable CSS values before render-time interpolation (card/map/icon/control/chip style paths).

---

## [0.6.0-alpha.3] - 2026-05-05

Third **`alpha`** on the **`0.6.x`** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.6.0-alpha.3`** (tag **`v0.6.0-alpha.3`** optional). Breaking changes are allowed; prefer stable **`main`** for production dashboards.

- **Navigation bar:** reducción de micro-rebote visual en mini media player y popups al evitar reactivar animaciones de entrada en renders normales.
- **Navigation bar:** las animaciones de superficie para mini player y popup ahora se limitan a aperturas reales (`--entering`) y no a refrescos de estado de la tarjeta.
- **Graph card:** cierre de tooltip de hover más robusto al salir de la tarjeta en cualquier dirección.

---

## [0.6.0-alpha.2] - 2026-05-05

Second **`alpha`** on the **`0.6.x`** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.6.0-alpha.2`** (tag **`v0.6.0-alpha.2`** optional). Breaking changes are allowed; prefer stable **`main`** for production dashboards.

- **Fluidez (Fase 2):** cache de geometría + listeners globales `move/up` solo durante drag en sliders interactivos (**Light/Fan/Humidifier/Media Player**), reduciendo carga en idle y en arrastre continuo.
- **Fluidez (Fase 2):** dial de **Climate** optimizado con geometría cacheada durante drag para evitar lecturas de layout por frame.
- **Eficiencia render (Fase 3):** firmas de render en **Light / Entity / Navigation** migradas de `JSON.stringify` de objetos a firmas string compactas, con menos allocations y menor presión de GC.
- **Infra (Fase 4):** bundling modernizado con **esbuild** en `scripts/build-bundle.mjs`, manteniendo orden de módulos y stripping de embeds standalone para no alterar comportamiento funcional del bundle.

---

## [0.6.0-alpha.1] - 2026-05-05

First **`alpha`** on the **`0.6.x`** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.6.0-alpha.1`** (tag **`v0.6.0-alpha.1`** optional). Breaking changes are allowed; prefer stable **`main`** for production dashboards.

- **Graph card:** hover/tooltip behavior refined during pointer movement, with stronger leave/close handling so the popup does not remain stuck when leaving the card.
- **Navigation bar / media player:** reduced visible flicker when toggling mini ↔ expanded media player and during unrelated dashboard interactions by limiting entrance animation to actual visibility transitions.
- **Advance Vacuum:** map action flow cleanup and async guard polishing (`_mapActionInFlight`) for safer concurrent interaction handling.
- **Shared utils / i18n infra:** neutralized entity-id collation in shared editor signature utilities to avoid locale-hardcoded sorting behavior.

---

## [0.5.0] - 2026-05-06

First stable release on the **`0.5.x`** line (**branch `main`**). This version consolidates all validated work from the **`0.5.0-alpha.*`** cycle into a production-ready bundle aimed at smoother interaction, stronger hardening, better editor UX and broader translation coverage.

### Security hardening

- Added shared **`sanitizeActionUrl()`** and applied it across URL action sinks to block unsafe schemes and normalize relative/same-origin navigation.
- Standardized new-tab actions to **`noopener,noreferrer`** to reduce tabnabbing/referrer leakage risks.
- Hardened service actions with optional strict mode and allowlists (**domains/services**) to reduce accidental abuse in action configs.
- Removed dynamic inline style string interpolation in critical runtime paths (notably Navigation Bar route/popup styles), applying safe runtime style properties instead.
- Added render-boundary CSS sanitization for user-configurable styles in cards with dynamic style templates (including Insignia and Circular Gauge paths), with safe fallback behavior.

### Performance and fluency

- Improved Graph hover fluidity with **`requestAnimationFrame`** coalescing and reduced per-move work under heavy pointer movement.
- Fixed Graph tooltip lifecycle for stable tracking while moving the pointer (without waiting for stationary hover), with robust leave/close behavior.
- Reduced drag overhead in interactive controls by caching geometry during slider drags and minimizing repeated layout reads.
- Smoothed Climate dial interaction by coalescing drag updates per frame.
- Kept standalone embedding/bundle sync idempotent to avoid unnecessary rewrites and noisy rebuild diffs.

### Stability and bug fixes

- Fixed Graph hook alignment issues (marker/guide/popup sync over chart path and viewBox mapping).
- Fixed Graph header layout so icon bubble and title align consistently in the top-left header row.
- Added spacing and layout refinements in Graph value/chips area for better readability in compact and normal views.
- Fixed tooltip edge cases where popups could remain visible after leaving the card.
- Corrected Insignia icon-only sizing/height parity with normal mode and removed clipping/regression cases in strip/scroll layouts.
- Improved async state consistency in Advance Vacuum map actions by preventing overlapping runs and reducing race conditions after awaited service calls.

### Editor and i18n

- Fixed Spanish editor normalization artifacts where labels like **`Mínimo$1`** / **`Máximo$1`** could appear.
- Strengthened editor label normalization and replacement group handling in generated editor UI runtime.
- Expanded editor/source strings and completed additional translation keys across supported locales.
- Maintained bundled language set coverage for cards and visual editors (**es, en, de, fr, it, nl, pt, ru, el, zh, ro**), with graceful fallback behavior for partial trees.

### Developer and tooling

- Refined shared utility behavior for editor entity signatures so label/icon attribute changes trigger expected refreshes (not only entity count changes).
- Kept standalone utility embedding centralized and automatically stripped during bundle build to avoid duplicated runtime code in `nodalia-cards.js`.

---

## [0.5.0-alpha.16] - 2026-05-06

Sixteenth **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.16`** (tag **`v0.5.0-alpha.16`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Security hardening** (**Circular Gauge**): sanitización de valores CSS configurables en el borde de render (`styles.card`, `styles.icon`, `styles.gauge`, tamaños/chips) con fallback seguro antes de interpolación en `<style>`/SVG.
- **Stability** (**Advance Vacuum**): lock de concurrencia para acciones de mapa (`_mapActionInFlight`) y resolución de modo de sesión con estado refrescado tras `await` para evitar carreras en interacciones rápidas.
- **Performance / fluidez**: cache de geometría en arrastre de sliders de **Media Player** (menos `getBoundingClientRect()` por `pointermove`) y coalescing por `requestAnimationFrame` en drag del dial de **Climate**.
- **i18n / editor UI**: ampliadas claves base de traducción y ajuste del generador para preservar correctamente expansiones con grupos (`$1`) en la salida embebida.

---

## [0.5.0-alpha.15] - 2026-05-06

Fifteenth **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.15`** (tag **`v0.5.0-alpha.15`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Performance** (**Graph card**): hover más fluido y estable — actualizaciones coalescidas por **`requestAnimationFrame`**, menos trabajo por evento de puntero y cierre más robusto del popup/hook al salir de la tarjeta.
- **Security hardening**: helper común **`sanitizeActionUrl`** en utilidades compartidas y aplicado a sinks de URL en tarjetas interactivas; aperturas en pestaña nueva unificadas a **`noopener,noreferrer`**.
- **Security hardening** (**Navigation bar**): eliminación de interpolación de estilos inline dinámicos en HTML de runtime; estilos aplicados por **`style.setProperty(...)`** para reducir superficie de inyección.
- **Security hardening**: modo estricto opcional para acciones de servicio configurable por tarjeta (**`strict_service_actions`** + allowlists de dominios/servicios).
- **Editor UI**: corrección definitiva de sufijos literales como **`$1`** en etiquetas normalizadas (p. ej. **Mínimo/Máximo**).

---

## [0.5.0-alpha.14] - 2026-05-06

Fourteenth **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.14`** (tag **`v0.5.0-alpha.14`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Insignia card**: hardening de render en estilos configurables (sanitización de valores CSS antes de interpolarlos en `<style>`), con fallback seguro para patrones de inyección.
- **Graph card** (`0.12.20`): más separación vertical entre cabecera (icono + nombre) y fila de valor/chips.

---

## [0.5.0-alpha.13] - 2026-05-06

Thirteenth **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.13`** (tag **`v0.5.0-alpha.13`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Graph card** (`0.12.20`): header reorganizado — burbuja de icono junto al título en la esquina superior izquierda (icono a la izquierda del nombre).
- **Graph card** (`0.12.20`): hover sincronizado — línea discontinua, círculo y popup comparten mapeo X del **`viewBox`**, sin desfase lateral.
- **Editor UI**: corrección de normalización en etiquetas en español — los reemplazos con grupos (por ejemplo **`mínimo`** / **`máximo`**) ya no muestran sufijos literales como **`$1`**.

---

## [0.5.0-alpha.12] - 2026-05-06

Twelfth **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.12`** (tag **`v0.5.0-alpha.12`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Graph card** (`0.12.20`): **hook/hover marker** alineado al recorrido de la línea (la capa de puntos usa el mismo viewport útil del SVG que el chart, sin desfase vertical por padding del panel).
- **Graph card** (`0.12.20`): popup del hook con estilo más **semitransparente/glass** al estilo weather card (fondo refinado, borde más suave, doble sombra ligera e inner highlight).

---

## [0.5.0-alpha.11] - 2026-05-06

Eleventh **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.11`** (tag **`v0.5.0-alpha.11`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Insignia card** (`0.2.12`): modo **solo icono** — misma **`.insignia-card__content`** que la píldora (**`styles.card.padding`** / **`gap`** / disco **`iconSizePx`**); **sin** segunda columna vacía ni cuadrado fijo; disco del icono como en modo con texto; **`padding-block`** del **`:host`** otra vez **`4px`** por defecto en franjas con scroll (**`--insignia-scroll-strip-*`**).

---

## [0.5.0-alpha.10] - 2026-05-06

Tenth **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.10`** (tag **`v0.5.0-alpha.10`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Internals** (**`nodalia-utils.js`**): **`editorStatesSignature`** vuelve a reflejar **todas** las entidades (**`id`**, **`friendly_name`**, **`icon`** por fila), delegando en **`editorFilteredStatesSignature`** — los editores que listan entidades se actualizan al cambiar etiquetas o iconos, no solo al variar el **conteo**.
- **Insignia card** (`0.2.11`): modo **solo icono** — tamaño exterior alineado con la **píldora con nombre/valor** (**padding** vertical de **`styles.card`** + disco del icono); **`padding-block`** del host por defecto **`0`** (franjas con scroll: variables **`--insignia-scroll-strip-*`**).

---

## [0.5.0-alpha.9] - 2026-05-05

Ninth **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.9`** (tag **`v0.5.0-alpha.9`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Graph card** (`0.12.19`): vista **estrecha** (`max-width: 640px`) — **valor y chips de leyenda** en la **misma fila**; leyenda con **scroll horizontal** si hace falta (ya no se fuerza **`flex-wrap`** de la fila ni **`100%`** de ancho en la leyenda, evitando solaparse con el **chart**).
- **Insignia card** (`0.2.10`): modo **solo icono** — **`border-radius`** del contenedor alineado con **`styles.card.border_radius`** (igual que la píldora con nombre/valor); **`inherit`** en contenido, icono e **imagen**.
- **Standalone scripts:** **`nodalia-utils.js`** incrustado al inicio de cada tarjeta **`nodalia-*.js`** que usa **`window.NodaliaUtils`** (marcadores **`nodalia-standalone-utils`**); **`npm run bundle`** lo **elimina** del **`nodalia-cards.js`** para no duplicar. **`nodalia-bubble-contrast.js`** no lleva embed (no usa **`NodaliaUtils`**).
- **Tooling** (**`scripts/sync-standalone-embed.mjs`**): sincronización **idempotente** — tras **`</nodalia-standalone-utils>`** se eliminan **todos** los saltos de línea iniciales (round-trip estable con **`wrapEmbed`**); comparación con **`CRLF`** normalizado a **`LF`**, de modo que **`npm run bundle`** no reescribe en masa los **`nodalia-*.js`** cuando **`nodalia-utils.js`** no cambia.

---

## [0.5.0-alpha.8] - 2026-05-06

Eighth **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.8`** (tag **`v0.5.0-alpha.8`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

Mismo contenido funcional que **`alpha.7`** con **Insignia** **`0.2.9`** y utilidades **`nodalia-utils`**: número de prerelease subido para etiquetar el bundle corregido (**`nodalia-cards.js`** parseable; ver **`alpha.7`**).

---

## [0.5.0-alpha.7] - 2026-05-06

Seventh **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.7`** (tag **`v0.5.0-alpha.7`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Insignia card** (`0.2.9`): modo **solo icono** — **`align-self: center`** por defecto (variable **`--insignia-icon-only-align-self`**, p. ej. **`stretch`** en franjas con scroll); **`translateY`** fino con **`--insignia-icon-only-row-nudge`** (por defecto **`-2px`**). Corrección: comentario CSS sin **backticks** dentro del **`innerHTML`** en plantilla JS — en **`0.2.8`** rompían el parseo de **`nodalia-cards.js`** y las tarjetas **custom** no se registraban.
- **Internals** (**`nodalia-utils.js`**): **`initNodaliaUtils`** solo hace **early return** si existe la **API completa** en **`window.NodaliaUtils`**; **`editorFilteredStatesSignature`** vuelve a incluir **filas por entidad** (**`id`**, **`friendly_name`**, **`icon`**) para que los editores detecten cambios en etiquetas.

---

## [0.5.0-alpha.6] - 2026-05-05

Sixth **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.6`** (tag **`v0.5.0-alpha.6`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Graph card** (`0.12.18`): **Tooltip** — no evaluar **`hover.x`** cuando no hay hover (**`null`**), evitando **`null is not an object (evaluating 'hover.x')`** en la tarjeta.
- **Insignia card** (`0.2.6`): modo **solo icono** — corrección fina en fila con otras insignias: **`transform: translateY`** en **`:host([data-icon-only])`** con variable **`--insignia-icon-only-row-nudge`** (por defecto **`-2px`**).

---

## [0.5.0-alpha.5] - 2026-05-05

Fifth **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.5`** (tag **`v0.5.0-alpha.5`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Graph card** (`0.12.17`): **Hover** alineado con la **línea** — posición X en overlay y **tooltip** usando el mismo rango que el **viewBox** (padding horizontal negativo: ya no se usa **`x / 100`**). **Marcadores** al vuelo con estética **Power Flow** (gradiente + sombra, **pulse** suave) en lugar de anillos anteriores.
- **Insignia card** (`0.2.5`): modo **solo icono** — alineación en **franjas horizontales** con otras insignias: **`:host`** con **`align-self: stretch`**, **`display: flex`** y **`align-items: center`**; **recorte** en scroll con **`padding-block`** (variables **`--insignia-scroll-strip-padding-block`** / compat **`--insignia-scroll-strip-margin-block`**, por defecto **`4px`**); ajuste óptico **`--insignia-icon-optical-y`** y **`svg { display: block }`**.
- **Internals** (**`nodalia-utils.js`**): **`copyDatasetExcept`** ignora también **`field`**; **`pickerCallbackState`** + listeners estables para **callbacks** actualizados en pickers reutilizados.

---

## [0.5.0-alpha.4] - 2026-05-05

Fourth **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.4`** (tag **`v0.5.0-alpha.4`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Graph card** (`0.12.16`): **`DEFAULT_CONFIG`** y **`STUB`** orientados a **temperatura** — entidades de ejemplo, **`min`** / **`max`** **`15`**–**`25`**, **`points`** **`100`**, **`styles.card`** **`padding`** **`18px`**, **`gap`** **`20px`**, **`icon.size`** **`20px`**; placeholder del editor **Temperatura**. Ejemplo en **`examples/graph-card.yaml`**.
- **Insignia card** (`0.2.4`): modo **solo icono** — **`margin-block`** en **`:host`** (por defecto **`8px`**, sobreescribible con **`--insignia-scroll-strip-margin-block`**) para que las **franjas con scroll horizontal** no recorten el círculo; estado vacío limpia **`data-icon-only`**.

---

## [0.5.0-alpha.3] - 2026-05-05

Third **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.3`** (tag **`v0.5.0-alpha.3`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Graph card** (`0.12.15`): más **margen superior** del **recuadro del chart** respecto a la fila **valor / chips**.
- **Insignia card** (`0.2.3`): modo **solo icono** — **padding** interior **`3px`**, glifo algo más **pequeño** respecto al círculo (**`-12px`** en lugar de `-8px`) y **`overflow: visible`** en **`ha-icon`** para reducir el recorte visual.

---

## [0.5.0-alpha.2] - 2026-05-05

Second **`alpha`** on **`0.5.x`** (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.2`** (tag **`v0.5.0-alpha.2`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Graph card** (`0.12.14`): **chips** de leyenda en la **misma fila** que el **valor** (a la **derecha**), evitando solaparse con el recuadro del chart; en **vista estrecha** la leyenda pasa a **línea inferior** a ancho completo.
- **Insignia card** (`0.2.2`): modo **solo icono** — **`overflow: visible`** en el host y en la píldora, **`icon_only_offset_y`** por defecto **`0`** para quitar el recorte mínimo **abajo** del círculo.
- **Internals**: shared **`nodalia-utils.js`** (**`window.NodaliaUtils`**) — **`deepEqual` / `stripEqualToDefaults`**, firmas ligeras de **`hass`** en editores (**conteo** / **filtrados** + idioma), **`mountEntityPickerHost` / `mountIconPickerHost`** para no recrear **`ha-entity-picker`** / **`ha-icon-picker`** en cada render; **`resolveEditorColorValue`** cachea colores CSS en **`nodalia-bubble-contrast.js`**. El bundle incluye **`nodalia-utils.js`** tras i18n/editor-ui (véase **CONTRIBUTING**). Instalación recomendada: un solo **`nodalia-cards.js`**.

---

## [0.5.0-alpha.1] - 2026-05-06

First **`alpha`** on the **0.5.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.5.0-alpha.1`** (tag **`v0.5.0-alpha.1`** optional). Breaking changes are allowed; prefer **`main`** **`0.4.0`** stable for production dashboards.

- **Graph card** (`0.12.13`): el **recuadro de la gráfica** gana protagonismo — **ancho completo** respecto al contenido de la tarjeta con **márgenes negativos** como el mapa en **advance vacuum**, esquinas del panel alineadas al **`border_radius`** de la tarjeta; **valor principal**, **título** y **chips** de series algo más compactos; **`DEFAULT_CONFIG.styles`** por defecto más bajo en tipografía para dar más aire al área del chart; altura mínima del panel revisada.
- **Insignia card** (`0.2.1`): editor visual con **`icon_active`** / **`icon_inactive`** y mismo criterio de **estado activo** que **Entity card**; hint de ayuda opcional como en Entity.

---

## [0.4.0] - 2026-05-06

### Nodalia Cards v0.4.0

This release is the new recommended **stable** line on **`main`**. It rolls up everything exercised across the **`0.4.0-beta.*`** and **`0.4.0-alpha.*`** prereleases into a single coherent minor: sharper history visuals, a more dependable navigation shell, shared tint/contrast logic across bubble cards, a full-featured **Insignia** editor and tint system, and broad editor / i18n polish. Installs should match **`package.json`** and **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0`** (Git tag **`v0.4.0`**).

Per-prerelease entries below (**alpha.1** through **alpha.25**, **beta.1** through **beta.4**) remain for detailed archaeology.

### 📈 Graph card

- **Line & area**: Reworked stroke/fill, smarter **automatic min/max** by metric (for example humidity anchored around **20–80** when you do not set bounds), denser default history sampling (**`points`** **480**).
- **Layout & chips**: Series chips **reordered and tightened** so they do not collide with the chart frame; **multi-series with the same unit** shows a **mean** in the primary readout until you pick a series; improved **hover/detail** presentation closer to **Weather card**; refined **typography** for the main value and spacing between chips and plot.
- **Fit & polish**: Extra bottom margin in series/container so minima are not clipped; chart container **no longer uses negative side margin** (stays inside the card).

### 🌤️ Weather card

- **Forecast chart mode**: Detail popups / overlays **follow the active Home Assistant theme** more faithfully when switching themes (fixes overly dark panels on light themes).

### 🧭 Navigation bar

- **Look & layout**: “Shelf” geometry when docked (**`bottom`** / **`top`**), **full-width** bar option, **28px** radius and light top wash aligned with other Nodalia cards; **dock entrance** animation (slide/fade, staggered routes, configurable duration).
- **Media**: **Album / entity artwork** resolution aligned with **`nodalia-media-player`** (URLs, cache busting, TV/Plex rules); **mini player ticker** updates progress/time **without** full card re-render (no flicker).
- **Reliability**: Entrance animation reset deferred one **`requestAnimationFrame`** so **`set(hass)`** after **`setConfig`** does not cancel **`--entering`** states.
- **Editor**: Native **`ha-entity-picker`** / **`ha-icon-picker`** (with **`input`** fallbacks) for routes, popup shortcuts, and media players.

### 🎯 Entity, Fan, Humidifier, Climate & shared bubble visuals

- **`nodalia-bubble-contrast.js`** (**`window.NodaliaBubbleContrast`**): one implementation for **named/CSS colors**, hue-aware **cool tint** detection, and **when to darken** the icon glyph on tinted bubbles—used by **Entity**, **Fan**, and **Humidifier** (and **Entity**-aligned behaviour elsewhere).
- **Entity card**: Stronger **active-state** visual parity with Light/Fan (gradient, border, glow, circular bubble); **chip** surfaces and typography; visual editors for **`icon_active`** / **`icon_inactive`** (doors, windows, binary sensors). Card revision **0.6.6**.
- **Active bubble icon colour**: **`ha-icon`** prefers readable **`styles.icon.color`** on coloured bubbles (not always **`on_color`**) across **entity**, **fan**, **humidifier**, **climate** where applicable.

### 🏅 Insignia card

- **Visual editor**: Parity with other Nodalia editors—**`ha-entity-picker`**, robust **icon** control (**`editor-control-host`** / **`_mountIconPicker`** + text fallback), structured sections (badge, haptics, tap action, appearance).
- **Tinting**: **Automatic tint by entity type** with optional **manual tint colour** (**`styles.tint.color`**, **`tint_auto`**); when tint should read clearly (active entities, **sensor**/**weather**, manual mode), **card fill, border, and glow layers** align with **Entity card**; fixes for **weak tint on numeric sensors** and a **gray “shelf”** under pills in toolbars (baseline gap, shadow, containment).

### 🔔 Alarm panel, YAML preview & editors

- **Alarm panel editor**: More reliable **style/animation** toggles (deferred config emission, **`pointerdown`** section open, duplicate-click suppression).
- **Visual editors** (“Show YAML”): **`stripEqualToDefaults`** so generated YAML stays minimal (also wired where added for **vacuum** and similar editors).

### 🎛️ Circular gauge, Climate dial & Power Flow

- **Circular gauge** / **Climate**: **`aspect-ratio: 1`** and **`width: min(…, 100%)`** so previews stay **round** in narrow layouts.
- **Power Flow**: Thinner default connector (**`flow_width`** **1px** in this line), continuing diagram polish from earlier **0.4.x** alphas.

### 🌍 i18n & editor UI map

- **Spanish editor labels**: Wider pass on accents and **ñ** across the shared **`editorStr`** map; **`scripts/gen-editor-ui.mjs`** keeps **`normalizeSpanishEditorLabel`** when regenerating **`nodalia-editor-ui.js`**.
- **Locales**: **`FULL_LOCALE_BY_EN`** coverage for flow/style labels so **pt / ru / el / zh / ro** do not fall back to English for Power Flow and similar strings.

### 🎨 Defaults & misc

- Curated **default `styles`** (icon sizes, chips, sliders, etc.) across several cards for a tighter out-of-the-box look.

### Notes

- If you installed **`0.4.0-beta.*`** or **`0.4.0-alpha.*`**, move **`main`** / GitHub **Release** **`v0.4.0`** or HACS **stable** when ready; **`__NODALIA_BUNDLE__.pkgVersion`** should read **`0.4.0`** after refresh/redownload.

---

## [0.4.0-alpha.25] - 2026-05-06

Twenty-fifth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.25`** (tag **`v0.4.0-alpha.25`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Insignia card (layout / sombra)**: evita la **franja gris** bajo la pastilla en barras — **`inline-flex`** en **`:host`** con **`line-height: 0`** y **`vertical-align: middle`** (hueco típico de baseline en elementos inline); sin **`contain: paint`** ni **`background-clip: padding-box`** que podían marcar el borde; la sombra extra tipo **Entity** (`0 16px 32px`) se sustituye por un **brillo interior** para no proyectar un bloque oscuro bajo insignias compactas.

---

## [0.4.0-alpha.24] - 2026-05-05

Twenty-fourth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.24`** (tag **`v0.4.0-alpha.24`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Insignia card (tinte)**: tintado alineado con **Entity card** cuando el tinte debe leerse fuerte — degradado en el fondo de la pastilla, borde/sombra con acento y capas **`::before` / `::after`** sin la opacidad global que antes dejaba el tinte casi invisible; sensores (**`sensor`**) y **weather** reciben tinte fuerte aunque el estado no sea «activo» (p. ej. temperatura numérica); **`tint_auto: false`** sigue forzando el tinte manual visible.

---

## [0.4.0-alpha.23] - 2026-05-06

Twenty-third **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.23`** (tag **`v0.4.0-alpha.23`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Insignia card (editor visual)**: campos de color (`styles.icon.background`, `styles.icon.on_color`, `styles.icon.off_color`) con selector visual tipo color picker, alineado con el patrón del resto de editores; eliminado el selector por presets de tinte y sustituido por un toggle **«Tintado automático por tipo de entidad»** (si se desactiva, manda el color manual elegido).

---

## [0.4.0-beta.4] - 2026-05-06

Fourth **`beta`** prerelease on the **0.4.x** line (**branch `beta`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-beta.4`** (tag **`v0.4.0-beta.4`**). Same expectations as other **`0.4.0-beta.*`** builds. Use this tag when installing from HACS or GitHub Releases so **`pkgVersion`** matches the release.

---

## [0.4.0-beta.3] - 2026-05-06

Third **`beta`** prerelease on the **0.4.x** line (**branch `beta`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-beta.3`** (tag **`v0.4.0-beta.3`**). Same expectations as other **`0.4.0-beta.*`** builds. Use this tag when installing from HACS or GitHub Releases so **`pkgVersion`** matches the release. For the full list of user-facing changes since **`0.4.0-beta.1`**, see **`0.4.0-beta.2`** below (this line is a version bump for a clean prerelease after **`alpha` → `beta`** merge and release).

---

## [0.4.0-beta.2] - 2026-05-05

Second **`beta`** prerelease on the **0.4.x** line (**branch `beta`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-beta.2`** (tag **`v0.4.0-beta.2`**). This build rolls up **everything since `0.4.0-beta.1`**, i.e. cumulative work from **`0.4.0-alpha.11`** through **`0.4.0-alpha.20`** (there was no **`alpha.19`** tag in this line) **plus** items below that landed in the bundle after the last alpha note. Breaking changes are still possible; recommended for testers and early adopters.

Compared to **`0.4.0-beta.1`**, this release includes:

- **Graph card**: rework visual de línea/área; **rangos automáticos** por tipo de métrica (p. ej. humedad con referencia **20–80** si no fijas `min`/`max`); chips de series **reordenados/compactados** para **no solaparse** con el recuadro de gráfica; en **multi-serie con la misma unidad**, el valor principal muestra la **media** hasta que eliges una serie; **popup de hover** con estilo más cercano a **Weather card**; **tipografía** del valor principal más compacta y legible; ajustes de **layout** entre chips y recuadro y **más margen inferior** en serie/contenedor para que los **mínimos** no queden recortados; el recuadro deja de usar **margen lateral negativo** para no salirse de la tarjeta.
- **Weather card** (modo gráfico de previsión): **popups/overlays** de detalle respetan mejor el **tema activo** al cambiar de theme (evita el aspecto demasiado oscuro en tema claro).
- **Fan card / Humidifier card**: mismo criterio de **contraste del icono** en burbuja tintada que **Entity card** (tonos como **`lightgreen`** / **`pink`** oscurecen el glifo cuando hace falta).
- **Navigation bar editor**: selectores nativos de Home Assistant para **entidad** e **icono** en rutas, popup y reproductores, con fallback a **`ha-selector`** / `input`.
- **Navigation bar**: el **ticker** del reproductor en curso actualiza solo **progreso y tiempo** sin **re-render** completo del media player (evita **parpadeo** continuo al reproducir).
- **Alarm panel card (editor)**: toggles y **“Mostrar estilos / animaciones”** más fiables (emisión de config **diferida**, secciones abiertas en **`pointerdown`**, supresión del **`click`** duplicado para evitar **doble alternancia**, mejor comportamiento ante blur/`change`).
- **Editor visual / español (`editorStr`)**: **primera** normalización de tildes y **ñ** en etiquetas del mapa común del editor; **segunda pasada** ampliada (título, gráfica, táctil/háptica, código, energía, información, acción, añade, etc.); **`scripts/gen-editor-ui.mjs`** vuelve a emitir **`normalizeSpanishEditorLabel`** junto a **`editorStr`** para que **`node scripts/gen-editor-ui.mjs`** no pierda la normalización al regenerar **`nodalia-editor-ui.js`**.
- **Insignia (badge) card**: título de sección del editor corregido a **«Acción»**; **editor visual** alineado con el resto de tarjetas Nodalia (**`ha-entity-picker`**, selector de icono con **`editor-control-host`** / **`_mountIconPicker`** y **`input`** de respaldo si **`ha-icon-picker`** no está cargado, secciones para insignia, **hápticos**, acción al pulsar y apariencia con detalles de estilo plegables).
- **Entity / Fan / Humidifier cards**: lógica compartida de **resolución de color** y **contraste del glifo** en burbuja tintada vía **`nodalia-bubble-contrast.js`** (**`window.NodaliaBubbleContrast`**), cargada en el bundle antes de esas tarjetas.
- **Entity card**: en el editor visual, selectores **`icon_active`** / **`icon_inactive`** para **icono distinto** en estado **activo** vs **inactivo** (útil en **binary_sensor** de puertas, ventanas, etc.); la tarjeta pasa a **`0.6.6`**.

---

## [0.4.0-alpha.20] - 2026-05-04

Twentieth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.20`** (tag **`v0.4.0-alpha.20`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Editor visual (español)**: segunda pasada de tildes y **ñ** en textos de ayuda y etiquetas (p. ej. título, gráfica, táctil/háptica, código, energía, información, acción, añade); **`scripts/gen-editor-ui.mjs`** vuelve a emitir **`normalizeSpanishEditorLabel`** junto a **`editorStr`** para que regenerar el mapa no pierda la normalización.
- **Insignia card**: título de sección del editor corregido a **«Acción»**.

---

## [0.4.0-alpha.18] - 2026-05-05

Eighteenth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.18`** (tag **`v0.4.0-alpha.18`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Graph card**: el recuadro de la gráfica ya no usa margen lateral negativo (evita que se salga de la tarjeta); más margen inferior en serie y contenedor para que valores cercanos al mínimo sigan visibles.
- **Editor visual (`editorStr`)**: normalización de etiquetas en español (tildes y **ñ** en palabras habituales del editor) para todas las tarjetas que usan el mapa común.
- **Navigation bar**: el ticker de reproducción actualiza solo progreso/tiempo sin re-render completo del media player (evita parpadeo continuo al reproducir).
- **Alarm panel editor**: toggles y botones “Mostrar estilos/animaciones” más fiables ante blur/change (emisión de config diferida y apertura de secciones en `pointerdown`).

---

## [0.4.0-alpha.17] - 2026-05-05

Seventeenth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.17`** (tag **`v0.4.0-alpha.17`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Graph card**: incremento del margen inferior real de la serie y del contenedor para que los mínimos no queden ocultos bajo el borde inferior del recuadro.

---

## [0.4.0-alpha.16] - 2026-05-05

Sixteenth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.16`** (tag **`v0.4.0-alpha.16`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Graph card**: ajuste fino del espaciado entre chips y recuadro, y refuerzo visual de tipografía en el valor principal para mejorar legibilidad.

---

## [0.4.0-alpha.15] - 2026-05-05

Fifteenth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.15`** (tag **`v0.4.0-alpha.15`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Graph card**: ajuste extra de layout para separar mejor chips y recuadro de gráfica, y evitar recorte visual en la parte inferior de la línea/área.
- **Graph card**: tipografía del valor principal más compacta y con mayor peso visual para acercar el look a Weather card.

---

## [0.4.0-alpha.14] - 2026-05-05

Fourteenth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.14`** (tag **`v0.4.0-alpha.14`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Graph card**: chips de series recolocados/compactados para evitar solape con el nuevo recuadro de gráfica; valor principal en modo multi-serie con misma unidad muestra media hasta seleccionar serie individual; popup hover con estilo visual más cercano al de Weather card.

---

## [0.4.0-alpha.13] - 2026-05-05

Thirteenth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.13`** (tag **`v0.4.0-alpha.13`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Weather card (forecast chart mode)**: popups/overlays de detalle ajustados para respetar mejor el tema activo al cambiar entre themes (evita oscurecido en tema claro).
- **Graph card**: rework visual de la línea/superficie y auto-rangos inteligentes por métrica (p. ej. humedad con referencia 20–80 cuando no se define `min`/`max` manualmente).

---

## [0.4.0-alpha.12] - 2026-05-05

Twelfth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.12`** (tag **`v0.4.0-alpha.12`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Fan / Humidifier cards**: mismo ajuste de contraste del glifo que en **Entity card** para burbujas tintadas; se detectan tonos de bajo contraste (incluye **`lightgreen`** y **`pink`**) y se oscurece el icono cuando corresponde.

---

## [0.4.0-alpha.11] - 2026-05-05

Eleventh **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.11`** (tag **`v0.4.0-alpha.11`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Navigation bar editor**: usa selectores nativos de Home Assistant para **entidad** e **icono** (pickers en rutas, popup y media players), con fallback a `ha-selector`/`input`.

---

## [0.4.0-beta.1] - 2026-05-05

First **`beta`** prerelease on the **0.4.x** line (**branch `beta`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-beta.1`** (tag **`v0.4.0-beta.1`**). Breaking changes are still possible; recommended for testers and early adopters.

- **Navigation bar**: entrada del dock / animaciones visibles de nuevo cuando Lovelace llama **`set(hass)`** justo después de **`setConfig`** — el reset de **`_animateDockEntranceNext`** se difiere un **`requestAnimationFrame`** para no quitar las clases **`--entering`** antes del pintado.
- **Navigation bar**: **`_getMediaPlayerArtwork`** alineado con **`nodalia-media-player`** (devuelve **`_resolveMediaUrl`** tal cual, sin **`resolved || null`**).
- **Entity card**: contraste del glifo en burbuja tintada con **colores CSS nombrados** (**`lightgreen`**, **`pink`**, …): **`parseCssColorHue`** resuelve el color vía estilo computado para obtener el matiz.

---

## [0.4.0-alpha.10] - 2026-05-05

Tenth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.10`** (tag **`v0.4.0-alpha.10`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Navigation bar**: entrada del dock / animaciones visibles de nuevo cuando Lovelace llama **`set(hass)`** justo después de **`setConfig`** — el reset de **`_animateDockEntranceNext`** se difiere un **`requestAnimationFrame`** para no quitar las clases **`--entering`** antes del pintado.
- **Navigation bar**: **`_getMediaPlayerArtwork`** alineado con **`nodalia-media-player`** (devuelve **`_resolveMediaUrl`** tal cual, sin **`resolved || null`**).
- **Entity card**: contraste del glifo en burbuja tintada con **colores CSS nombrados** (**`lightgreen`**, …): **`parseCssColorHue`** resuelve el color vía estilo computado para obtener el matiz.

---

## [0.4.0-alpha.9] - 2026-05-04

Ninth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.9`** (tag **`v0.4.0-alpha.9`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Navigation bar** (`0.6.5`): **animación de entrada del dock** — al cargar o al volver a mostrarse (p. ej. pasar de escritorio a móvil), **`ha-card`** entra con desliz según **`layout.position`** (abajo / arriba), **rutas** con **escalonado** (`--nav-enter-delay`), **título** y **mini reproductor** con **fade-in**; **`animations.dock_entrance_duration`** (por defecto **420** ms) y control en el **editor** (**Entrada barra (ms)**). Con **`animations.enabled: false`** se anulan también estas entradas.

---

## [0.4.0-alpha.8] - 2026-05-04

Eighth **`alpha`** prerelease on the **0.4.x** line (**branch `alpha`**). **Experimental:** installs match **`package.json`** / **`__NODALIA_BUNDLE__.pkgVersion`** **`0.4.0-alpha.8`** (tag **`v0.4.0-alpha.8`**). Breaking changes are allowed; prefer **`beta`** or **`main`** for production dashboards.

- **Navigation bar** (`0.6.3`): portadas de álbum / **`entity_picture`** igual que **`nodalia-media-player`**: rutas relativas con **`hass.hassUrl()`**, **`entity_picture_local`**, **`nodalia_ts`** anti-caché, y misma lógica **TV / Plex** para no mostrar arte genérico en TVs cuando no aplica.
- **Iconos en burbuja tintada**: **`ha-icon`** usa **`styles.icon.color`** (**`var(--primary-text-color)`** por defecto) cuando la burbuja está activa en **entity**, **fan**, **humidifier** y **climate**, en lugar de **`on_color`** (**info** / azul), para que el glifo contraste con fondos **accent** (p. ej. energía). Versiones de tarjeta: entity **`0.6.4`**, fan / humidifier **`0.6.3`**, climate **`0.10.5`**.

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
