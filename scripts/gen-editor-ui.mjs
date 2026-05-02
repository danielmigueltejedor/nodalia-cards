import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SPANISH_TO_ENGLISH_EXACT } from "./spanish-nav-exact.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
let keys = JSON.parse(fs.readFileSync(path.join(__dirname, "editor-source-strings.json"), "utf8"));

const EDITOR_EXTRA_FULL_LOCALE_BY_EN = JSON.parse(
  fs.readFileSync(path.join(__dirname, "editor-extra-locale-by-en.json"), "utf8"),
);

const EXTRA_EDITOR_KEYS = `
Ocultar ajustes de estilo
Mostrar ajustes de estilo
Ocultar ajustes de animación
Mostrar ajustes de animación
Anadir ruta
Anadir player
Anadir popup
Mostrar tarjeta
Layout estrecho
No hay reproductores configurados.
No hay rutas todavia.
Esta ruta no tiene popup todavia.
Player
Popup
Ruta
Altura minima media player
Tamano etiqueta popup
Tamano minimo badge
Mostrar tambien en escritorio
Marcar activa por prefijo
Fallback con vibracion
Altura minima
Ancho maximo barra
Ancho maximo popup
Ancho minimo popup
Barra y hover (ms)
Breakpoint movil
Color etiqueta activa
Etiqueta opcional
Estilo haptico
Fijar a pantalla
Icono fallback
Layout popup
Media player (ms)
Mostrar etiquetas
Nombre reproductor
Offset icono X
Offset icono Y
Path activo extra
Radio media player
Reservar espacio
Respuesta botones (ms)
Respuesta haptica
Ruta medios
Separacion botones
Separacion con navbar
Separacion etiqueta
Separacion popup
Separacion stack
Sombra media player
Tamano controles
Tamano etiqueta
Tamano indicadores
Tamano item popup
Tamano portada
Tamano subtitulo
Tamano texto badge
Usar caratula de fondo
Veladura popup
Activar animaciones
Altura reservada
Backdrop filter
Borde media player
Color etiqueta
Color progreso
Descripcion
Estados visibles
Fondo media player
Fondo progreso
Fondo tarjeta
Fondo burbuja
Fondo dial
Fondo acento botones
Imagen fija
Justificacion
Margen lateral
Mostrar siempre
Overlay portada
Padding media player
Paths activos
Radio boton
Sombra barra
Sombra popup
Tamano boton
Tamano icono
Activa por prefijo
Color botones
Fondo botones
Fondo popup
Padding popup
Popup (ms)
Radio popup
Borde popup
Color activo
Color badge
Fondo activo
Fondo badge
Fondo barra
Padding barra
Radio barra
Todavía no hay acciones rápidas.
Añadir acción
Tipo de acción
Automática (toggle o info)
Modo compacto
Automático (<4 columnas)
Compacto siempre
Nunca compacto
Acción al tocar
Usar el icono de la entidad
Abrir en pestaña nueva
Color personalizado
Acción
Subir
Bajar
Eliminar
`
  .trim()
  .split("\n")
  .map(line => line.trim())
  .filter(Boolean);

const seenKey = new Set(keys);
for (const k of EXTRA_EDITOR_KEYS) {
  if (!seenKey.has(k)) {
    seenKey.add(k);
    keys.push(k);
  }
}

function translateEsToEn(s) {
  if (s.startsWith("__T__:")) {
    return translateEsToEnTitle(s.slice("__T__:".length));
  }
  if (s.startsWith("__H__:")) {
    return translateEsToEnHint(s.slice("__H__:".length));
  }
  if (/^(Background|Border|Gap|Padding|Radius|Shadow|URL|Tap action|Tap card)$/i.test(s)) {
    return s;
  }

  let t = s;
  const reps = [
    [/Abrir URL en nueva pestana/gi, "Open URL in new tab"],
    [/Abrir URL en pestaña nueva/gi, "Open URL in new tab"],
    [/Abrir en pestaña nueva/gi, "Open in new tab"],
    [/Activar animaciones/gi, "Enable animations"],
    [/Activar haptics/gi, "Enable haptics"],
    [/Activar respuesta háptica/gi, "Enable haptic feedback"],
    [/Ajuste icono \(solo icono\)/gi, "Icon fit (icon only)"],
    [/Alto burbuja informativa/gi, "Info bubble height"],
    [/Alto burbuja info/gi, "Info bubble height"],
    [/Alto chip/gi, "Chip height"],
    [/Alto chips/gi, "Chip height"],
    [/Alto contenedor slider/gi, "Slider container height"],
    [/Alto de chips/gi, "Chip height"],
    [/Alto del contenedor del slider/gi, "Slider container height"],
    [/Alto grafica/gi, "Chart height"],
    [/Alto grafico/gi, "Chart height"],
    [/Alto input codigo/gi, "Code input height"],
    [/Altura mínima/gi, "Minimum height"],
    [/Altura reservada/gi, "Reserved height"],
    [/Ancho burbuja slider/gi, "Slider bubble width"],
    [/Ancho máximo/gi, "Maximum width"],
    [/Atributo a mostrar/gi, "Attribute to show"],
    [/Atributo chip principal/gi, "Primary chip attribute"],
    [/Atributo chip secundario/gi, "Secondary chip attribute"],
    [/Atributo de estado/gi, "State attribute"],
    [/Atributo secundario/gi, "Secondary attribute"],
    [/Borde de la tarjeta/gi, "Card border"],
    [/Borde del navegador/gi, "Browser border"],
    [/Borde del reproductor/gi, "Player border"],
    [/Borde tarjeta/gi, "Card border"],
    [/Radio borde/gi, "Border radius"],
    [/Radio del borde/gi, "Border radius"],
    [/Radio del navegador/gi, "Browser radius"],
    [/\bBorde\b/gi, "Border"],
    [/Boton localizar/gi, "Locate button"],
    [/Boton parar/gi, "Stop button"],
    [/Boton volver a base/gi, "Return to dock button"],
    [/Botón localizar/gi, "Locate button"],
    [/Botón parar/gi, "Stop button"],
    [/Botón volver a base/gi, "Return to dock button"],
    [/Breakpoint móvil/gi, "Mobile breakpoint"],
    [/Calibracion desde camera/gi, "Calibration from camera"],
    [/Cambio entre sliders \(ms\)/gi, "Slider switch (ms)"],
    [/Click entidades/gi, "Entity click"],
    [/Color auto/gi, "Auto color"],
    [/Color calor/gi, "Heat color"],
    [/Color frio/gi, "Cool color"],
    [/Color gris RGB/gi, "Gray RGB color"],
    [/Color iconos/gi, "Icon color"],
    [/Color secado/gi, "Dry color"],
    [/Color ventilador/gi, "Fan color"],
    [/Color/gi, "Color"],
    [/Columnas de grid/gi, "Grid columns"],
    [/Contracción horizontal del slider/gi, "Slider horizontal shrink"],
    [/Controles de color/gi, "Color controls"],
    [/Controles de modo/gi, "Mode controls"],
    [/Controles de temperatura/gi, "Temperature controls"],
    [/Datos del servicio \(JSON\)/gi, "Service data (JSON)"],
    [/Decimales en estado y chips/gi, "Decimals in state and chips"],
    [/Decimales secundarios/gi, "Secondary decimals"],
    [/Decimales/gi, "Decimals"],
    [/Dial \(ms\)/gi, "Dial (ms)"],
    [/Dias visibles/gi, "Visible days"],
    [/Empezar desde cero/gi, "Start from zero"],
    [/Encendido y apagado \(ms\)/gi, "Power on/off (ms)"],
    [/Enlace panel energia/gi, "Energy panel link"],
    [/Tamano burbuja entidad/gi, "Entity bubble size"],
    [/Tamaño burbuja entidad/gi, "Entity bubble size"],
    [/Entidad Meteoalarm/gi, "Meteoalarm entity"],
    [/Entidad calibracion/gi, "Calibration entity"],
    [/Entidad del robot/gi, "Robot entity"],
    [/Entidad mapa \(camera\/image\)/gi, "Map entity (camera/image)"],
    [/Entidad principal/gi, "Main entity"],
    [/Entidad secundaria/gi, "Secondary entity"],
    [/Entidad vacuum/gi, "Vacuum entity"],
    [/Entidades individuales/gi, "Individual entities"],
    [/Entidades/gi, "Entities"],
    [/Entidad/gi, "Entity"],
    [/Entrada contenido \(ms\)/gi, "Content entrance (ms)"],
    [/Entrada del contenido \(ms\)/gi, "Content entrance (ms)"],
    [/Estado a la derecha del nombre/gi, "State on title row"],
    [/Estados visibles/gi, "Visible states"],
    [/Estilo/gi, "Style"],
    [/Expansión de controles \(ms\)/gi, "Controls expand (ms)"],
    [/Fallback con vibracion/gi, "Vibration fallback"],
    [/Fallback con vibración/gi, "Vibration fallback"],
    [/Flujo maximo \(s\)/gi, "Maximum flow (s)"],
    [/Flujo minimo \(s\)/gi, "Minimum flow (s)"],
    [/Grafico en color/gi, "Color chart"],
    [/Grosor del slider/gi, "Slider thickness"],
    [/Grosor dial/gi, "Dial thickness"],
    [/Grosor lineas/gi, "Line thickness"],
    [/Grosor linea/gi, "Line thickness"],
    [/Grosor slider/gi, "Slider thickness"],
    [/Helper codigo/gi, "Code helper"],
    [/Helper sesion compartida/gi, "Shared session helper"],
    [/Horas a mostrar/gi, "Hours to show"],
    [/Horas visibles/gi, "Visible hours"],
    [/Icono fallback/gi, "Fallback icon"],
    [/Icono menu derecho/gi, "Right menu icon"],
    [/Iconos cabecera/gi, "Header icons"],
    [/Imagen personalizada/gi, "Custom image"],
    [/Info secundaria/gi, "Secondary info"],
    [/Items del menu derecho \(JSON\)/gi, "Right menu items (JSON)"],
    [/Lineas a cero/gi, "Lines to zero"],
    [/Mapa bloqueado/gi, "Map locked"],
    [/Margen lateral/gi, "Side margin"],
    [/Max repeticiones/gi, "Max repeats"],
    [/Max zonas/gi, "Max zones"],
    [/Maximo/gi, "Maximum"],
    [/Minimo/gi, "Minimum"],
    [/Modo TV \/ Apple TV/gi, "TV / Apple TV mode"],
    [/Modo habitaciones/gi, "Rooms mode"],
    [/Modo ir a punto/gi, "Go-to-point mode"],
    [/Modo todo/gi, "All mode"],
    [/Modo zona/gi, "Zone mode"],
    [/Modos rápidos de potencia/gi, "Quick power presets"],
    [/Mostrar ausente/gi, "Show away"],
    [/Mostrar badge de no disponible/gi, "Show unavailable badge"],
    [/Mostrar badge de zona/gi, "Show zone badge"],
    [/Mostrar boton energia/gi, "Show energy button"],
    [/Mostrar botones \+ \/ -/gi, "Show +/- buttons"],
    [/Mostrar botones de modo/gi, "Show mode buttons"],
    [/Mostrar botón de modo/gi, "Show mode button"],
    [/Mostrar botón de oscilación/gi, "Show oscillate button"],
    [/Mostrar botón de ventilación/gi, "Show fan mode button"],
    [/Mostrar brillo/gi, "Show brightness"],
    [/Mostrar burbuja de estado/gi, "Show state bubble"],
    [/Mostrar cabecera/gi, "Show header"],
    [/Mostrar chip Meteoalarm/gi, "Show Meteoalarm chip"],
    [/Mostrar chip de estado/gi, "Show state chip"],
    [/Mostrar chip de humedad objetivo/gi, "Show target humidity chip"],
    [/Mostrar chip de humedad/gi, "Show humidity chip"],
    [/Mostrar chip de modo/gi, "Show mode chip"],
    [/Mostrar chip de porcentaje/gi, "Show percentage chip"],
    [/Mostrar chip de temperatura actual/gi, "Show current temperature chip"],
    [/Mostrar chip de velocidad/gi, "Show speed chip"],
    [/Mostrar chip de ventilación/gi, "Show fan chip"],
    [/Mostrar chip humedad/gi, "Show humidity chip"],
    [/Mostrar chip presion/gi, "Show pressure chip"],
    [/Mostrar chip principal/gi, "Show primary chip"],
    [/Mostrar chip secundario/gi, "Show secondary chip"],
    [/Mostrar chip viento/gi, "Show wind chip"],
    [/Mostrar condicion/gi, "Show condition"],
    [/Mostrar control deslizante/gi, "Show slider"],
    [/Mostrar cuadro de texto del PIN/gi, "Show PIN text field"],
    [/Mostrar desarmar/gi, "Show disarm"],
    [/Mostrar en casa/gi, "Show home"],
    [/Mostrar en escritorio/gi, "Show on desktop"],
    [/Mostrar estado actual/gi, "Show current state"],
    [/Mostrar estado en burbuja/gi, "Show state in bubble"],
    [/Mostrar estado textual/gi, "Show textual state"],
    [/Mostrar estado/gi, "Show state"],
    [/Mostrar etiquetas del grafico/gi, "Show chart labels"],
    [/Mostrar etiquetas habitaciones/gi, "Show room labels"],
    [/Etiqueta boton energia/gi, "Energy button label"],
    [/Etiqueta maximo/gi, "Maximum label"],
    [/Etiqueta menu derecho/gi, "Right menu label"],
    [/Etiqueta minimo/gi, "Minimum label"],
    [/Etiqueta/gi, "Label"],
    [/Etiquetas/gi, "Labels"],
    [/Mostrar fuentes y apps/gi, "Show sources and apps"],
    [/Mostrar icono inferior/gi, "Show bottom icon"],
    [/Mostrar icono/gi, "Show icon"],
    [/\bIcono\b/gi, "Icon"],
    [/Mostrar leyenda/gi, "Show legend"],
    [/Mostrar marcadores habitaciones/gi, "Show room markers"],
    [/Mostrar noche/gi, "Show night"],
    [/Mostrar nombre en chip/gi, "Show name in chip"],
    [/Mostrar nombre/gi, "Show name"],
    [/Mostrar personalizado/gi, "Show custom"],
    [/Mostrar prediccion ampliada/gi, "Show extended forecast"],
    [/Mostrar presets de modo/gi, "Show mode presets"],
    [/Mostrar rango min\/max/gi, "Show min/max range"],
    [/Mostrar relleno/gi, "Show fill"],
    [/Mostrar selector de vista/gi, "Show view selector"],
    [/Mostrar slider/gi, "Show slider"],
    [/Mostrar ubicacion/gi, "Show location"],
    [/Mostrar vacaciones/gi, "Show vacation"],
    [/Mostrar valor grande/gi, "Show large value"],
    [/Mostrar valor/gi, "Show value"],
    [/Badge de no disponible/gi, "Unavailable badge"],
    [/Badge no disponible/gi, "Unavailable badge"],
    [/Botones de modo junto al slider/gi, "Mode buttons next to slider"],
    [/Botones de modo/gi, "Mode buttons"],
    [/Botones \+ \/ -/gi, "+ / − buttons"],
    [/Chip de bateria/gi, "Battery chip"],
    [/Chip de batería/gi, "Battery chip"],
    [/Chip de temperatura actual/gi, "Current temperature chip"],
    [/Chip de estado/gi, "State chip"],
    [/Chip de humedad/gi, "Humidity chip"],
    [/Máx ancho chip nombre/gi, "Max name chip width"],
    [/Máximo de fuentes/gi, "Maximum sources"],
    [/Navegador de medios \(ms\)/gi, "Media browser (ms)"],
    [/Nombre corto/gi, "Short name"],
    [/Nombre visible/gi, "Visible name"],
    [/Nombre/gi, "Name"],
    [/Offset/gi, "Offset"],
    [/PIN fijo/gi, "Fixed PIN"],
    [/Padding burbuja info/gi, "Info bubble padding"],
    [/Padding chip/gi, "Chip padding"],
    [/Padding chips/gi, "Chip padding"],
    [/Padding de chips/gi, "Chip padding"],
    [/Padding interior/gi, "Inner padding"],
    [/Padding tarjeta/gi, "Card padding"],
    [/Padding/gi, "Padding"],
    [/Panel de modos \(ms\)/gi, "Mode panel (ms)"],
    [/Paneles TV \(ms\)/gi, "TV panels (ms)"],
    [/Paneles \(ms\)/gi, "Panels (ms)"],
    [/Plataforma/gi, "Platform"],
    [/Presets de brillo/gi, "Brightness presets"],
    [/Puntos/gi, "Points"],
    [/\bRadio\b/gi, "Radius"],
    [/Radius mapa/gi, "Map radius"],
    [/Rebote botones \(ms\)/gi, "Button bounce (ms)"],
    [/Rebote de botones \(ms\)/gi, "Button bounce (ms)"],
    [/Rebote de chips \(ms\)/gi, "Chip bounce (ms)"],
    [/Rebote pulsacion \(ms\)/gi, "Tap bounce (ms)"],
    [/Rebote pulsación \(ms\)/gi, "Tap bounce (ms)"],
    [/Rebote tap \(ms\)/gi, "Tap bounce (ms)"],
    [/Relleno burbuja informativa/gi, "Info bubble padding"],
    [/Relleno chips/gi, "Chip padding"],
    [/Relleno interior/gi, "Inner padding"],
    [/Reservar espacio/gi, "Reserve space"],
    [/Rows de grid/gi, "Grid rows"],
    [/Ruta de medios/gi, "Media path"],
    [/Ruta de navegación/gi, "Navigation path"],
    [/Rutinas \(JSON\)/gi, "Routines (JSON)"],
    [/Select aspirado/gi, "Suction select"],
    [/Select fregado/gi, "Mop select"],
    [/Select modo mopa/gi, "Mop mode select"],
    [/Selector de aspirado/gi, "Suction selector"],
    [/Selector de fregado/gi, "Mop selector"],
    [/Sensor de batería/gi, "Battery sensor"],
    [/Sensor de estado/gi, "State sensor"],
    [/Sensor de habitaciones/gi, "Rooms sensor"],
    [/Separacion interna/gi, "Inner gap"],
    [/Separación interna/gi, "Inner gap"],
    [/Separacion/gi, "Gap"],
    [/Separación/gi, "Gap"],
    [/Service data JSON/gi, "Service data JSON"],
    [/Servicio al tocar/gi, "Tap service"],
    [/Servicio/gi, "Service"],
    [/Sombra del navegador/gi, "Browser shadow"],
    [/Sombra/gi, "Shadow"],
    [/Subtítulo fijo/gi, "Fixed subtitle"],
    [/Tamano avatar/gi, "Avatar size"],
    [/Tamano badge/gi, "Badge size"],
    [/Tamano boton \+ \/ -/gi, "+/- button size"],
    [/Tamano boton modo/gi, "Mode button size"],
    [/Tamano botones/gi, "Button size"],
    [/Tamano casa/gi, "Home size"],
    [/Tamano chip/gi, "Chip size"],
    [/Tamano chips/gi, "Chip size"],
    [/Tamano condicion/gi, "Condition size"],
    [/Tamano dial/gi, "Dial size"],
    [/Tamano icono/gi, "Icon size"],
    [/Tamano individual/gi, "Individual size"],
    [/Tamano leyenda/gi, "Legend size"],
    [/Tamano marcadores/gi, "Marker size"],
    [/Tamano nodo/gi, "Node size"],
    [/Tamano nombre/gi, "Name size"],
    [/Tamano subtitulo/gi, "Subtitle size"],
    [/Tamano temperatura actual/gi, "Current temperature size"],
    [/Tamano temperatura objetivo/gi, "Target temperature size"],
    [/Tamano temperatura/gi, "Temperature size"],
    [/Tamano thumb dial/gi, "Dial thumb size"],
    [/Tamano titulo/gi, "Title size"],
    [/Tamano unidad/gi, "Unit size"],
    [/Tamano valor/gi, "Value size"],
    [/Tamaño botones \+ \/ -/gi, "+ / − button size"],
    [/Tamaño botones auxiliares/gi, "Auxiliary button size"],
    [/Tamaño botones modo/gi, "Mode button size"],
    [/Tamaño botones/gi, "Button size"],
    [/Tamaño botón principal/gi, "Primary button size"],
    [/Tamaño botón/gi, "Button size"],
    [/Tamaño burbuja principal/gi, "Primary bubble size"],
    [/Tamaño burbuja/gi, "Bubble size"],
    [/Tamaño chip/gi, "Chip size"],
    [/Tamaño de botones/gi, "Button size"],
    [/Tamaño de indicadores/gi, "Indicator size"],
    [/Tamaño de la burbuja/gi, "Bubble size"],
    [/Tamaño de portada TV/gi, "TV cover art size"],
    [/Tamaño de portada/gi, "Cover art size"],
    [/Tamaño del subtítulo/gi, "Subtitle size"],
    [/Tamaño del thumb del slider/gi, "Slider thumb size"],
    [/Tamaño del título/gi, "Title size"],
    [/Tamaño dial/gi, "Dial size"],
    [/Tamaño objetivo/gi, "Target size"],
    [/Tamaño rango/gi, "Range size"],
    [/Tamaño temperatura actual/gi, "Current temperature size"],
    [/Tamaño thumb/gi, "Thumb size"],
    [/Tamaño título/gi, "Title size"],
    [/Tamaño valor/gi, "Value size"],
    [/Tarjeta fija/gi, "Fixed card"],
    [/Texto burbuja informativa/gi, "Info bubble text"],
    [/Texto burbuja info/gi, "Info bubble text"],
    [/Texto chip/gi, "Chip text"],
    [/Texto chips/gi, "Chip text"],
    [/Texto de chips/gi, "Chip text"],
    [/Texto marcadores/gi, "Marker text"],
    [/Texto secundario/gi, "Secondary text"],
    [/Tinte/gi, "Tint"],
    [/Titulo/gi, "Title"],
    [/Tooltip y hover \(ms\)/gi, "Tooltip and hover (ms)"],
    [/Track dial/gi, "Dial track"],
    [/Transparencia lineas cero/gi, "Zero-line transparency"],
    [/Título fijo/gi, "Fixed title"],
    [/URL al tocar/gi, "Tap URL"],
    [/URL/gi, "URL"],
    [/Unidad casa/gi, "Home unit"],
    [/Unidad secundaria/gi, "Secondary unit"],
    [/Unidad/gi, "Unit"],
    [/Usar carátula como fondo/gi, "Use album art as background"],
    [/Usar el icono de la entidad/gi, "Use entity icon"],
    [/Usar foto de entidad/gi, "Use entity photo"],
    [/Usar foto de la entidad/gi, "Use entity photo"],
    [/Usar icono de la entidad/gi, "Use entity icon"],
    [/Usar icono de zona/gi, "Use zone icon"],
    [/Usar vibracion de respaldo/gi, "Use vibration fallback"],
    [/Usar vibración si no hay háptica/gi, "Use vibration if haptics unavailable"],
    [/Valor casa/gi, "Home value"],
    [/Valor nodo/gi, "Node value"],
    [/Valores/gi, "Values"],
    [/Z-index/gi, "Z-index"],
  ];
  for (const [rx, rep] of reps) {
    t = t.replace(rx, rep);
  }
  t = t.replace(/\bgrafica\b/gi, "chart");
  t = t.replace(/\bgrafico\b/gi, "chart");
  t = t.replace(/\bpestana\b/gi, "tab");
  t = t.replace(/\bTamano\b/g, "Size");
  t = t.replace(/\bTamaño\b/g, "Size");
  t = t.replace(/\bbateria\b/gi, "battery");
  t = t.replace(/\bbatería\b/gi, "battery");
  t = t.replace(/\bpresion\b/gi, "pressure");
  t = t.replace(/\bcondicion\b/gi, "condition");
  t = t.replace(/\benergia\b/gi, "energy");
  t = t.replace(/\bcodigo\b/gi, "code");
  t = t.replace(/\bcalibracion\b/gi, "calibration");
  t = t.replace(/\bmóvil\b/gi, "mobile");
  t = t.replace(/\bmovil\b/gi, "mobile");
  t = t.replace(/Mostrar tarjeta/gi, "Show card");
  t = t.replace(/Layout estrecho/gi, "Narrow layout");

  if (SPANISH_TO_ENGLISH_EXACT[s]) {
    return SPANISH_TO_ENGLISH_EXACT[s];
  }
  return t;
}

function translateEsToEnTitle(s) {
  const map = {
    General: "General",
    Mapa: "Map",
    Estilos: "Styles",
    Estilo: "Style",
    Animaciones: "Animations",
    Haptics: "Haptics",
    Visibilidad: "Visibility",
    "Controles avanzados": "Advanced controls",
    "Acciones rápidas": "Quick actions",
    Contenido: "Content",
    "Respuesta háptica": "Haptic feedback",
    "Respuesta haptica": "Haptic feedback",
    Alarma: "Alarm",
    Rutas: "Routes",
    "Media Player": "Media player",
    Reproductores: "Players",
    Layout: "Layout",
    Flujo: "Flow",
    Series: "Series",
    Modos: "Modes",
    Individuales: "Individuals",
    "Entidades auxiliares": "Auxiliary entities",
    Acción: "Action",
  };
  return map[s] || translateEsToEn(s);
}

function translateEsToEnHint(s) {
  let t = s;
  t = t.replace(/La tarjeta reutiliza automaticamente tu config legacy de `map_modes` e `icons` si la pegas en YAML\./gi,
    "The card automatically reuses your legacy `map_modes` and `icons` config if you paste it in YAML.");
  t = t.replace(/Selector de aspirado\/fregado, menu derecho y rutinas configurables\. En rutinas puedes usar `entity`, `label`, `icon`, `service`, `service_data` o `tap_action`\./gi,
    "Vacuum/mop selector, right menu and configurable routines. In routines you can use `entity`, `label`, `icon`, `service`, `service_data` or `tap_action`.");
  t = t.replace(/Entidad del robot y fuente principal del mapa\./gi, "Robot entity and main map source.");
  t = t.replace(/Que elementos quieres mantener siempre visibles\./gi, "Which elements you want to keep always visible.");
  t = t.replace(/Respuesta haptica opcional para clicks y selecciones\./gi, "Optional haptic feedback for clicks and selections.");
  t = t.replace(/Entrada suave de la tarjeta, paneles y respuesta visual al pulsar controles\./gi, "Smooth card entrance, panels and visual feedback when pressing controls.");
  t = t.replace(/Opciones generales del reproductor y cuándo debe mostrarse la tarjeta\./gi, "General player options and when the card should be shown.");
  t = t.replace(/Añade, reordena y personaliza cada reproductor visible en la tarjeta\./gi, "Add, reorder and customize each player shown on the card.");
  t = t.replace(/Añade, reordena y personaliza los destinos de la barra y sus popups\./gi, "Add, reorder and customize bar destinations and their popups.");
  t = t.replace(/Opciones base de la barra, layout y visibilidad general\./gi, "Base bar options, layout and general visibility.");
  t = t.replace(/Ajustes visuales del reproductor principal y del navegador de medios\./gi, "Visual settings for the main player and media browser.");
  t = t.replace(/Ajustes visuales de barra, botones, popup y media player\./gi, "Visual settings for bar, buttons, popup and media player.");
  t = t.replace(/Ideal si quieres usarlo fijo arriba o abajo del dashboard\./gi, "Ideal if you want it fixed at the top or bottom of the dashboard.");
  t = t.replace(/Una linea por entidad: `entity\|nombre\|icono\|color`\./gi, "One line per entity: `entity|name|icon|color`.");
  t = t.replace(/Titulo, enlace al panel de energia y comportamiento general de la tarjeta\./gi, "Title, energy panel link and general card behaviour.");
  t = t.replace(/Controla las lineas a cero y la velocidad del flujo\./gi, "Controls zero lines and flow speed.");
  t = t.replace(/Entidad principal, nombre visible e icono de la tarjeta\./gi, "Main entity, visible name and card icon.");
  t = t.replace(/Entidad principal, nombre visible y comportamiento al tocar la tarjeta\./gi, "Main entity, visible name and tap behaviour.");
  t = t.replace(/Entidad principal, nombre visible e icono base de la tarjeta\./gi, "Main entity, visible name and base card icon.");
  t = t.replace(/Entidad principal y textos visibles\./gi, "Main entity and visible texts.");
  t = t.replace(/Entidad favorita, nombre visible e icono principal\./gi, "Favourite entity, visible name and main icon.");
  t = t.replace(/Entidad meteorologica principal, nombre visible, icono y contenido mostrado\./gi, "Main weather entity, visible name, icon and displayed content.");
  t = t.replace(/Entidad numérica principal, nombre, icono y rango del gauge\./gi, "Main numeric entity, name, icon and gauge range.");
  t = t.replace(/Entidad persona, foto, icono de zona y comportamiento principal de la tarjeta\./gi, "Person entity, photo, zone icon and main card behaviour.");
  t = t.replace(/Entidad principal, helper opcional del codigo, icono y comportamiento base de la tarjeta\./gi, "Main entity, optional code helper, icon and base card behaviour.");
  t = t.replace(/Estado visible, chips adicionales, decimales de los valores y comportamiento en modo compacto\./gi, "Visible state, extra chips, value decimals and compact mode behaviour.");
  t = t.replace(/Qué hace la tarjeta cuando la tocas\./gi, "What the card does when you tap it.");
  t = t.replace(/Qué elementos quieres mostrar dentro de la tarjeta\./gi, "Which elements you want to show inside the card.");
  t = t.replace(/Qué bloques quieres mostrar dentro de la tarjeta\./gi, "Which blocks you want to show inside the card.");
  t = t.replace(/Elige qué chips y controles deben mostrarse\./gi, "Choose which chips and controls should be shown.");
  t = t.replace(/Elige la informacion y los controles visibles\./gi, "Choose the information and visible controls.");
  t = t.replace(/Botones de armado y desarmado visibles en la tarjeta\./gi, "Arm and disarm buttons visible on the card.");
  t = t.replace(/Opciones extra si la entidad es un panel de alarma\./gi, "Extra options if the entity is an alarm panel.");
  t = t.replace(/Botones secundarios con icono para alternar, abrir más información o llamar un servicio\./gi, "Secondary icon buttons to toggle, open more info or call a service.");
  t = t.replace(/Sensores y selectores opcionales para enriquecer el estado y los controles\./gi, "Optional sensors and selectors to enrich state and controls.");
  t = t.replace(/Selectores opcionales para el modo principal y la ventilación\./gi, "Optional selectors for main mode and fan.");
  t = t.replace(/Presentación compacta y elementos visibles dentro de la tarjeta\./gi, "Compact layout and visible elements inside the card.");
  t = t.replace(/Ajustes visuales base de la tarjeta\./gi, "Base visual settings for the card.");
  t = t.replace(/Ajustes visuales base de la tarjeta favorita\./gi, "Base visual settings for the favourite card.");
  t = t.replace(/Ajustes visuales base de la tarjeta y las burbujas\./gi, "Base visual settings for the card and bubbles.");
  t = t.replace(/Ajustes visuales base del mapa y las burbujas\./gi, "Base visual settings for the map and bubbles.");
  t = t.replace(/Ajustes visuales básicos del look Nodalia\./gi, "Basic visual settings for the Nodalia look.");
  t = t.replace(/Ajustes visuales principales de la tarjeta\./gi, "Main visual settings for the card.");
  t = t.replace(/Ajustes visuales del grafico y el look Nodalia\./gi, "Visual settings for the chart and Nodalia look.");
  t = t.replace(/Ajustes visuales de la card, el icono y el grafico\./gi, "Visual settings for the card, icon and chart.");
  t = t.replace(/Personaliza el look Nodalia de la climate card, el dial y los controles\./gi, "Customize the Nodalia look for the climate card, dial and controls.");
  t = t.replace(/Personaliza el look Nodalia, el dial circular, la nueva burbuja del thumb y la escala de tinte del gauge\./gi, "Customize the Nodalia look, circular dial, new thumb bubble and gauge tint scale.");
  t = t.replace(/Ajustes visuales del look Nodalia y el dial circular\./gi, "Visual settings for the Nodalia look and circular dial.");
  t = t.replace(/Nombre, icono, rango visible y comportamiento basico de la grafica\./gi, "Name, icon, visible range and basic chart behaviour.");
  t = t.replace(/Anade, reordena y personaliza cada entidad mostrada en la grafica\./gi, "Add, reorder and customize each entity shown on the chart.");
  t = t.replace(/Añade, reordena y personaliza cada entidad mostrada en la grafica\./gi, "Add, reorder and customize each entity shown on the chart.");
  t = t.replace(/Configura titulo, entidades y rango visible de la grafica\./gi, "Configure title, entities and visible chart range.");
  t = t.replace(/Controla la visualizacion de lineas sin consumo y la velocidad de animacion\./gi, "Controls display of zero-consumption lines and animation speed.");
  t = t.replace(/Controla la transición del dial, la entrada del contenido y el rebote al tocar la tarjeta\./gi, "Controls dial transition, content entrance and tap bounce.");
  t = t.replace(/Controla la transición del dial, la entrada del contenido y el rebote de los botones\./gi, "Controls dial transition, content entrance and button bounce.");
  t = t.replace(/Controla la entrada del tooltip y el rebote visual de los chips\./gi, "Controls tooltip entrance and visual chip bounce.");
  t = t.replace(/Transiciones suaves al encender, apagar, desplegar controles, cambiar entre sliders y dar respuesta visual a los botones\./gi,
    "Smooth transitions when powering on/off, expanding controls, switching sliders and visual button feedback.");
  t = t.replace(/Transiciones suaves al encender, apagar, desplegar controles, cambiar paneles y dar respuesta visual a los botones\./gi,
    "Smooth transitions when powering on/off, expanding controls, changing panels and visual button feedback.");
  t = t.replace(/Transiciones suaves al encender, apagar, desplegar controles, abrir modos y dar respuesta visual a los botones\./gi,
    "Smooth transitions when powering on/off, expanding controls, opening modes and visual button feedback.");
  t = t.replace(/Ayuda a compactar el gauge según el espacio disponible en la vista\./gi, "Helps compact the gauge based on available space.");
  t = t.replace(/Ayuda a compactar la climate card según el espacio disponible en la vista\./gi, "Helps compact the climate card based on available space.");
  t = t.replace(/Feedback visual para botones y paneles del robot\./gi, "Visual feedback for robot buttons and panels.");
  t = t.replace(/Activa o desactiva cabecera, valor grande, leyenda y relleno\./gi, "Enable or disable header, large value, legend and fill.");
  t = t.replace(/Activa o desactiva cabecera, valor, leyenda y relleno\./gi, "Enable or disable header, value, legend and fill.");
  t = t.replace(/Activa u oculta cada bloque de la tarjeta\./gi, "Show or hide each card block.");
  t = t.replace(/Ajusta la apertura de paneles, navegador y el rebote de los botones\./gi, "Adjust panel opening, browser and button bounce.");
  t = t.replace(/Ajustes de cabecera, chips y rango visible\./gi, "Header, chips and visible range settings.");
  t = t.replace(/Opciones generales del reproductor integrado y lista de players visibles\./gi, "General options for the embedded player and visible player list.");
  t = t.replace(/Respuesta tactil opcional al pulsar acciones\./gi, "Optional tactile feedback when tapping actions.");
  t = t.replace(/Respuesta tactil opcional al pulsar nodos o botones\./gi, "Optional tactile feedback when tapping nodes or buttons.");
  t = t.replace(/Respuesta tactil opcional al tocar la tarjeta\./gi, "Optional tactile feedback when tapping the card.");
  t = t.replace(/Respuesta tactil opcional para taps, hover y cambios de serie\./gi, "Optional tactile feedback for taps, hover and series changes.");
  t = t.replace(/Respuesta táctil opcional al interactuar con el dial y los botones\./gi, "Optional tactile feedback when using the dial and buttons.");
  t = t.replace(/Respuesta táctil opcional al tocar la tarjeta\./gi, "Optional tactile feedback when tapping the card.");
  t = t.replace(/Respuesta táctil opcional al usar la tarjeta y sus acciones\./gi, "Optional tactile feedback when using the card and its actions.");
  t = t.replace(/Respuesta táctil opcional al usar los controles\./gi, "Optional tactile feedback when using controls.");
  t = t.replace(/Respuesta táctil opcional para los controles del reproductor\./gi, "Optional tactile feedback for player controls.");
  t = t.replace(/Respuesta háptica opcional para los controles\./gi, "Optional haptic feedback for controls.");
  t = t.replace(/Respuesta haptica opcional al tocar la tarjeta\./gi, "Optional haptic feedback when tapping the card.");
  t = t.replace(/Respuesta haptica opcional para dial y controles\./gi, "Optional haptic feedback for dial and controls.");
  t = t.replace(/Respuesta haptica opcional para los controles\./gi, "Optional haptic feedback for controls.");
  t = t.replace(/Respuesta haptica opcional para clicks y selecciones\./gi, "Optional haptic feedback for clicks and selections.");
  t = t.replace(/Entrada suave del contenido y pequeno rebote al pulsar acciones e icono\./gi, "Smooth content entrance and small bounce when tapping actions and icon.");
  t = t.replace(/Entrada suave del contenido y pequeno rebote al pulsar la tarjeta\./gi, "Smooth content entrance and small bounce when tapping the card.");
  t = t.replace(/Entrada suave del contenido y pequeño rebote al pulsar la tarjeta o sus acciones\./gi, "Smooth content entrance and small bounce when tapping the card or its actions.");
  t = t.replace(/Entrada suave del contenido y rebote ligero al pulsar la tarjeta\./gi, "Smooth content entrance and light bounce when tapping the card.");
  t = t.replace(/Entrada suave del flujo y rebote al pulsar nodos o acciones\./gi, "Smooth flow entrance and bounce when tapping nodes or actions.");
  t = t.replace(/Entrada suave del contenido y rebote al pulsar la tarjeta\./gi, "Smooth content entrance and bounce when tapping the card.");
  if (SPANISH_TO_ENGLISH_EXACT[t]) {
    return SPANISH_TO_ENGLISH_EXACT[t];
  }
  return t;
}

/** Only apply Show/Enable/Open shims to short field labels, not full English hint sentences. */
function isCompactUiEnglish(s) {
  return typeof s === "string" && !/,/.test(s) && s.length <= 72;
}

function enToDe(s) {
  if (!isCompactUiEnglish(s)) {
    return s;
  }
  return s
    .replace(/^Show /, "Anzeigen: ")
    .replace(/^Enable /, "Aktivieren: ")
    .replace(/^Open /, "Öffnen: ")
    .replace(/^Name$/i, "Name")
    .replace(/^Icon$/i, "Symbol")
    .replace(/^General$/i, "Allgemein")
    .replace(/^Styles$/i, "Stile")
    .replace(/^Map$/i, "Karte")
    .replace(/^Border$/i, "Rahmen")
    .replace(/^Shadow$/i, "Schatten")
    .replace(/^Padding$/i, "Innenabstand")
    .replace(/^Color$/i, "Farbe")
    .replace(/^Title$/i, "Titel")
    .replace(/^Entity$/i, "Entität")
    .replace(/^Alarm$/i, "Alarm")
    .replace(/^Layout$/i, "Layout")
    .replace(/^Flow$/i, "Fluss")
    .replace(/^Players$/i, "Player")
    .replace(/^Routes$/i, "Routen")
    .replace(/^Series$/i, "Serien")
    .replace(/^Modes$/i, "Modi")
    .replace(/^Individuals$/i, "Einzelwerte")
    .replace(/^Haptic feedback$/i, "Haptisches Feedback")
    .replace(/^Enable animations$/i, "Animationen aktivieren")
    .replace(/^Enable haptics$/i, "Haptik aktivieren");
}

function enToFr(s) {
  if (!isCompactUiEnglish(s)) {
    return s;
  }
  return s
    .replace(/^Show /, "Afficher ")
    .replace(/^Enable /, "Activer ")
    .replace(/^Open /, "Ouvrir ")
    .replace(/^Icon$/i, "Icône")
    .replace(/^General$/i, "Général")
    .replace(/^Styles$/i, "Styles")
    .replace(/^Map$/i, "Carte")
    .replace(/^Border$/i, "Bordure")
    .replace(/^Shadow$/i, "Ombre")
    .replace(/^Padding$/i, "Marge intérieure")
    .replace(/^Color$/i, "Couleur")
    .replace(/^Title$/i, "Titre")
    .replace(/^Entity$/i, "Entité")
    .replace(/^Alarm$/i, "Alarme")
    .replace(/^Layout$/i, "Mise en page")
    .replace(/^Flow$/i, "Flux")
    .replace(/^Players$/i, "Lecteurs")
    .replace(/^Routes$/i, "Routes")
    .replace(/^Series$/i, "Séries")
    .replace(/^Modes$/i, "Modes")
    .replace(/^Individuals$/i, "Individuels")
    .replace(/^Haptic feedback$/i, "Retour haptique")
    .replace(/^Enable animations$/i, "Activer les animations")
    .replace(/^Enable haptics$/i, "Activer la haptique");
}

function enToIt(s) {
  if (!isCompactUiEnglish(s)) {
    return s;
  }
  return s
    .replace(/^Show /, "Mostra ")
    .replace(/^Enable /, "Abilita ")
    .replace(/^Open /, "Apri ")
    .replace(/^Icon$/i, "Icona")
    .replace(/^General$/i, "Generale")
    .replace(/^Styles$/i, "Stili")
    .replace(/^Map$/i, "Mappa")
    .replace(/^Border$/i, "Bordo")
    .replace(/^Shadow$/i, "Ombra")
    .replace(/^Padding$/i, "Padding")
    .replace(/^Color$/i, "Colore")
    .replace(/^Title$/i, "Titolo")
    .replace(/^Entity$/i, "Entità")
    .replace(/^Alarm$/i, "Allarme")
    .replace(/^Layout$/i, "Layout")
    .replace(/^Flow$/i, "Flusso")
    .replace(/^Players$/i, "Lettori")
    .replace(/^Routes$/i, "Percorsi")
    .replace(/^Series$/i, "Serie")
    .replace(/^Modes$/i, "Modalità")
    .replace(/^Individuals$/i, "Singoli")
    .replace(/^Haptic feedback$/i, "Feedback aptico")
    .replace(/^Enable animations$/i, "Abilita animazioni")
    .replace(/^Enable haptics$/i, "Abilita aptica");
}

function enToNl(s) {
  if (!isCompactUiEnglish(s)) {
    return s;
  }
  return s
    .replace(/^Show /, "Toon ")
    .replace(/^Enable /, "Schakel ")
    .replace(/^Open /, "Open ")
    .replace(/^Icon$/i, "Pictogram")
    .replace(/^General$/i, "Algemeen")
    .replace(/^Styles$/i, "Stijlen")
    .replace(/^Map$/i, "Kaart")
    .replace(/^Border$/i, "Rand")
    .replace(/^Shadow$/i, "Schaduw")
    .replace(/^Padding$/i, "Opvulling")
    .replace(/^Color$/i, "Kleur")
    .replace(/^Title$/i, "Titel")
    .replace(/^Entity$/i, "Entiteit")
    .replace(/^Alarm$/i, "Alarm")
    .replace(/^Layout$/i, "Lay-out")
    .replace(/^Flow$/i, "Stroom")
    .replace(/^Players$/i, "Spelers")
    .replace(/^Routes$/i, "Routes")
    .replace(/^Series$/i, "Reeksen")
    .replace(/^Modes$/i, "Modi")
    .replace(/^Individuals$/i, "Individueel")
    .replace(/^Haptic feedback$/i, "Haptische feedback")
    .replace(/^Enable animations$/i, "Animaties inschakelen")
    .replace(/^Enable haptics$/i, "Haptiek inschakelen");
}

/** Full-sentence / editor phrases where compact locale shims cannot apply (length, commas). Key = English seed (`row.en`). */
const FULL_LOCALE_BY_EN = {
  Visibility: { de: "Sichtbarkeit", fr: "Visibilité", it: "Visibilità", nl: "Zichtbaarheid" },
  "Choose which chips and controls should be shown.": {
    de: "Wähle, welche Chips und Steuerelemente angezeigt werden sollen.",
    fr: "Choisissez les puces et contrôles à afficher.",
    it: "Scegli quali chip e controlli mostrare.",
    nl: "Kies welke chips en bediening zichtbaar zijn.",
  },
  "Choose the information and visible controls.": {
    de: "Wähle die sichtbaren Informationen und Steuerelemente.",
    fr: "Choisissez les informations et contrôles visibles.",
    it: "Scegli le informazioni e i controlli visibili.",
    nl: "Kies zichtbare informatie en bediening.",
  },
  "State chip": { de: "Status-Chip", fr: "Puce d’état", it: "Chip di stato", nl: "Statuschip" },
  "Current temperature chip": { de: "Aktuelle Temperatur (Chip)", fr: "Puce température actuelle", it: "Chip temperatura attuale", nl: "Huidige temperatuur (chip)" },
  "Humidity chip": { de: "Feuchtigkeits-Chip", fr: "Puce humidité", it: "Chip umidità", nl: "Vochtigheidschip" },
  "Show state chip": { de: "Status-Chip anzeigen", fr: "Afficher la puce d’état", it: "Mostra chip di stato", nl: "Toon statuschip" },
  "Show current temperature chip": {
    de: "Aktuelle Temperatur anzeigen",
    fr: "Afficher la température actuelle",
    it: "Mostra chip temperatura attuale",
    nl: "Toon huidige temperatuur",
  },
  "Show humidity chip": { de: "Feuchtigkeits-Chip anzeigen", fr: "Afficher l’humidité", it: "Mostra chip umidità", nl: "Toon vochtigheidschip" },
  "Mode buttons": { de: "Modus-Tasten", fr: "Boutons de mode", it: "Pulsanti modalità", nl: "Modusknoppen" },
  "Show mode buttons": { de: "Modus-Tasten anzeigen", fr: "Afficher les boutons de mode", it: "Mostra pulsanti modalità", nl: "Toon modusknoppen" },
  "+ / − buttons": { de: "+/−-Tasten", fr: "Boutons +/−", it: "Pulsanti +/−", nl: "+/−-knoppen" },
  "Unavailable badge": { de: "Nicht-verfügbar-Abzeichen", fr: "Badge indisponible", it: "Badge non disponibile", nl: "Niet-beschikbaar-badge" },
  "Show unavailable badge": { de: "Abzeichen „Nicht verfügbar“ anzeigen", fr: "Afficher le badge indisponible", it: "Mostra badge non disponibile", nl: "Toon niet-beschikbaar-badge" },
  "Optional tactile feedback when using the dial and buttons.": {
    de: "Optionales haptisches Feedback beim Drehregler und den Tasten.",
    fr: "Retour tactile optionnel pour le cadran et les boutons.",
    it: "Feedback tattile opzionale per il dial e i pulsanti.",
    nl: "Optionele haptische feedback bij draaiknop en knoppen.",
  },
  "Optional haptic feedback for dial and controls.": {
    de: "Optionales haptisches Feedback für Drehregler und Steuerelemente.",
    fr: "Retour haptique optionnel pour le cadran et les contrôles.",
    it: "Feedback aptico opzionale per il dial e i controlli.",
    nl: "Optionele haptische feedback voor draaiknop en bediening.",
  },
  "Enable haptics": { de: "Haptik aktivieren", fr: "Activer le retour haptique", it: "Abilita feedback aptico", nl: "Haptiek inschakelen" },
  "Vibration fallback": { de: "Vibrations-Fallback", fr: "Secours vibration", it: "Fallback vibrazione", nl: "Trilling reserve" },
  "Customize the Nodalia look for the climate card, dial and controls.": {
    de: "Passe das Nodalia-Erscheinungsbild für die Thermostat-Karte, den Drehregler und die Steuerung an.",
    fr: "Personnalisez le rendu Nodalia de la carte climat, du cadran et des contrôles.",
    it: "Personalizza l’aspetto Nodalia della climate card, del dial e dei controlli.",
    nl: "Pas de Nodalia-stijl aan voor de thermostaatkaart, draaiknop en bediening.",
  },
  "Hide style settings": {
    de: "Stileinstellungen ausblenden",
    fr: "Masquer les paramètres de style",
    it: "Nascondi impostazioni di stile",
    nl: "Stijlinstellingen verbergen",
  },
  "Show style settings": {
    de: "Stileinstellungen anzeigen",
    fr: "Afficher les paramètres de style",
    it: "Mostra impostazioni di stile",
    nl: "Stijlinstellingen tonen",
  },
  "Hide animation settings": {
    de: "Animationseinstellungen ausblenden",
    fr: "Masquer les paramètres d’animation",
    it: "Nascondi impostazioni animazioni",
    nl: "Animatie-instellingen verbergen",
  },
  "Show animation settings": {
    de: "Animationseinstellungen anzeigen",
    fr: "Afficher les paramètres d’animation",
    it: "Mostra impostazioni animazioni",
    nl: "Animatie-instellingen tonen",
  },
  "Controls dial transition, content entrance and button bounce.": {
    de: "Steuert den Übergang des Drehreglers, den Eingang des Inhalts und den Tasten-Federungseffekt.",
    fr: "Contrôle la transition du cadran, l’entrée du contenu et le rebond des boutons.",
    it: "Controlla la transizione del dial, l’ingresso del contenuto e il rimbalzo dei pulsanti.",
    nl: "Regelt de draaiknop-overgang, binnenkomst van inhoud en knop-veer.",
  },
  "Card background": { de: "Kartenhintergrund", fr: "Fond de la carte", it: "Sfondo scheda", nl: "Kaartachtergrond" },
  "Bubble background": { de: "Blasen-Hintergrund", fr: "Fond de la bulle", it: "Sfondo bolla", nl: "Bel-achtergrond" },
  "Dial background": { de: "Drehregler-Hintergrund", fr: "Fond du cadran", it: "Sfondo dial", nl: "Draaiknop-achtergrond" },
  "Button accent background": { de: "Akzent-Hintergrund der Tasten", fr: "Fond d’accent des boutons", it: "Sfondo accento pulsanti", nl: "Knopaccent-achtergrond" },
  "Helps compact the climate card based on available space.": {
    de: "Hilft, die Thermostat-Karte je nach verfügbarem Platz zu kompaktieren.",
    fr: "Aide à compacter la carte climat selon l’espace disponible.",
    it: "Aiuta a compattare la climate card in base allo spazio.",
    nl: "Houdt de thermostaatkaart compact naargelang de ruimte.",
  },
  "Entity bubble size": {
    de: "Größe Entitätsblase",
    fr: "Taille de la bulle d’entité",
    it: "Dimensione bolla entità",
    nl: "Grootte entiteitsbel",
  },
  "On icon color": { de: "Symbolfarbe (Ein)", fr: "Couleur icône (actif)", it: "Colore icona (acceso)", nl: "Pictogramkleur (aan)" },
  "Off icon color": { de: "Symbolfarbe (Aus)", fr: "Couleur icône (inactif)", it: "Colore icona (spento)", nl: "Pictogramkleur (uit)" },
  "Active icon color": { de: "Aktive Symbolfarbe", fr: "Couleur d’icône active", it: "Colore icona attivo", nl: "Actieve pictogramkleur" },
  "Inactive icon color": { de: "Inaktive Symbolfarbe", fr: "Couleur d’icône inactive", it: "Colore icona inattivo", nl: "Inactieve pictogramkleur" },
  "Icon bubble background": { de: "Hintergrund Symbolblase", fr: "Fond de la bulle d’icône", it: "Sfondo bolla icona", nl: "Achtergrond pictogrambel" },
  "Heat color": { de: "Heizfarbe", fr: "Couleur chaleur", it: "Colore calore", nl: "Verwarmingskleur" },
  "Cool color": { de: "Kühlfarbe", fr: "Couleur froid", it: "Colore freddo", nl: "Koelkleur" },
  "Current temperature size": {
    de: "Größe aktuelle Temperatur",
    fr: "Taille température actuelle",
    it: "Dimensione temperatura attuale",
    nl: "Grootte huidige temperatuur",
  },
  "Target temperature size": {
    de: "Größe Solltemperatur",
    fr: "Taille consigne de température",
    it: "Dimensione temperatura obiettivo",
    nl: "Grootte doeltemperatuur",
  },
  "Target size": { de: "Ziel-Größe", fr: "Taille cible", it: "Dimensione obiettivo", nl: "Doelgrootte" },
  "Condition size": { de: "Vorhersage-Größe", fr: "Taille condition", it: "Dimensione condizione", nl: "Voorwaardegrootte" },
  "Chip text": { de: "Chip-Text", fr: "Texte de puce", it: "Testo chip", nl: "Chip-tekst" },
  "Chip texts": { de: "Chip-Texte", fr: "Textes de puces", it: "Testi chip", nl: "Chip-teksten" },
  "Icon Color": { de: "Symbolfarbe", fr: "Couleur d’icône", it: "Colore icona", nl: "Pictogramkleur" },
  "Auto Color": { de: "Auto-Farbe", fr: "Couleur auto", it: "Colore auto", nl: "Autokleur" },
  "Dry Color": { de: "Trocknungsfarbe", fr: "Couleur séchage", it: "Colore asciugatura", nl: "Droogkleur" },
  "Fan Color": { de: "Lüfterfarbe", fr: "Couleur ventilateur", it: "Colore ventola", nl: "Ventilatorkleur" },
  "Content entrance (ms)": { de: "Inhaltseingang (ms)", fr: "Entrée du contenu (ms)", it: "Ingresso contenuto (ms)", nl: "Inhoud binnenkomst (ms)" },
  "Tap bounce (ms)": { de: "Tipp-Feder (ms)", fr: "Rebond au toucher (ms)", it: "Rimbalzo tap (ms)", nl: "Tik-veer (ms)" },
  "Size + / − buttons": { de: "Größe +/−-Tasten", fr: "Taille des boutons +/−", it: "Dimensione pulsanti +/−", nl: "Grootte +/− knoppen" },
  "Title size": { de: "Titelgröße", fr: "Taille du titre", it: "Dimensione titolo", nl: "Titelgrootte" },
  "Temperature size": { de: "Temperatur-Größe", fr: "Taille température", it: "Dimensione temperatura", nl: "Temperatuurgrootte" },
  "Thumb size": { de: "Griffgröße", fr: "Taille du curseur", it: "Dimensione thumb", nl: "Duimgrootte" },
  "Dial track": { de: "Drehregler-Spur", fr: "Piste du cadran", it: "Traccia dial", nl: "Draaiknop-spoor" },
  "Basic visual settings for the card.": {
    de: "Grundlegende visuelle Einstellungen für die Karte.",
    fr: "Réglages visuels de base pour la carte.",
    it: "Impostazioni visive di base per la scheda.",
    nl: "Basis visuele instellingen voor de kaart.",
  },
  "Basic visual settings for the favourite card.": {
    de: "Grundlegende visuelle Einstellungen für die Favoritenkarte.",
    fr: "Réglages visuels de base pour la carte favoris.",
    it: "Impostazioni visive di base per la scheda preferiti.",
    nl: "Basis visuele instellingen voor de favorietenkaart.",
  },
};

function applyFullLocaleByEn(row) {
  const patch = FULL_LOCALE_BY_EN[row.en];
  const extra = EDITOR_EXTRA_FULL_LOCALE_BY_EN[row.en];
  if (!patch && !extra) {
    return row;
  }
  const merged = { ...(patch || {}), ...(extra || {}) };
  return {
    ...row,
    de: merged.de !== undefined ? merged.de : row.de,
    fr: merged.fr !== undefined ? merged.fr : row.fr,
    it: merged.it !== undefined ? merged.it : row.it,
    nl: merged.nl !== undefined ? merged.nl : row.nl,
  };
}

const rows = [];
const seenEs = new Set();
for (const es of keys) {
  const en = translateEsToEn(es);
  rows.push(
    applyFullLocaleByEn({
      es,
      en,
      de: enToDe(en),
      fr: enToFr(en),
      it: enToIt(en),
      nl: enToNl(en),
    }),
  );
  seenEs.add(es);
}
for (const r of [...rows]) {
  if (r.es.startsWith("__T__:") || r.es.startsWith("__H__:")) {
    const plain = r.es.replace(/^__T__:|^__H__:/, "");
    if (plain && !seenEs.has(plain)) {
      seenEs.add(plain);
      rows.push({
        es: plain,
        en: r.en,
        de: r.de,
        fr: r.fr,
        it: r.it,
        nl: r.nl,
      });
    }
  }
}

const rowByEs = new Map();
for (const r of rows) {
  rowByEs.set(r.es, r);
}
const dedupedRows = [...rowByEs.values()];

const out = `/* eslint-disable max-len */
/* Auto-generated by scripts/gen-editor-ui.mjs — run: node scripts/gen-editor-ui.mjs */
(() => {
  const ROWS = ${JSON.stringify(dedupedRows, null, 2)};

  function buildMap(lang) {
    const m = {};
    for (const r of ROWS) {
      m[r.es] = r[lang];
    }
    return m;
  }

  const MAP = { es: {}, en: buildMap("en"), de: buildMap("de"), fr: buildMap("fr"), it: buildMap("it"), nl: buildMap("nl") };
  for (const r of ROWS) {
    MAP.es[r.es] = r.es;
  }

  window.NodaliaI18n.editorUiMaps = MAP;

  window.NodaliaI18n.editorStr = function editorStr(hass, configLang, spanishText) {
    if (spanishText == null || spanishText === "") {
      return "";
    }
    const lang = window.NodaliaI18n.resolveLanguage(hass, configLang);
    const maps = window.NodaliaI18n.editorUiMaps;
    if (maps.es[spanishText] === undefined && maps.en[spanishText] === undefined) {
      return spanishText;
    }
    return maps[lang]?.[spanishText] ?? maps.en[spanishText] ?? maps.es[spanishText] ?? spanishText;
  };
})();
`;

fs.writeFileSync(path.join(root, "nodalia-editor-ui.js"), out);
console.log("Wrote nodalia-editor-ui.js", dedupedRows.length, "strings");
