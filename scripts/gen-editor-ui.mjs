import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SPANISH_TO_ENGLISH_EXACT } from "./spanish-nav-exact.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Per-locale flat maps for editor keys `ed.<card>.<slug>` (see i18n/editor/en.json). Missing locales fall back to English. */
const EDITOR_CATALOG_LANGS = ["en", "es", "de", "fr", "it", "nl", "no", "pt", "ru", "el", "zh", "ro"];

function loadEditorCatalog() {
  const catalogDir = path.join(root, "i18n", "editor");
  const basePath = path.join(catalogDir, "en.json");
  const empty = () => Object.fromEntries(EDITOR_CATALOG_LANGS.map(L => [L, {}]));
  if (!fs.existsSync(basePath)) {
    return empty();
  }
  const baseEn = JSON.parse(fs.readFileSync(basePath, "utf8"));
  const out = {};
  for (const L of EDITOR_CATALOG_LANGS) {
    const p = path.join(catalogDir, `${L}.json`);
    const overlay = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
    out[L] = { ...baseEn, ...overlay };
  }
  return out;
}

const EDITOR_CATALOG = loadEditorCatalog();

let keys = JSON.parse(fs.readFileSync(path.join(__dirname, "editor-source-strings.json"), "utf8"));

const EDITOR_EXTRA_FULL_LOCALE_BY_EN = JSON.parse(
  fs.readFileSync(path.join(__dirname, "editor-extra-locale-by-en.json"), "utf8"),
);

/** pt/ru/el/zh/ro for editor hints not covered by FULL_LOCALE_BY_EN (Show … chips + long sentences). */
const EDITOR_SHOW_PHRASES = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "editor-show-phrases.json"), "utf8"),
);
const EDITOR_REST_LONG_PHRASES = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "editor-rest-long-phrases.json"), "utf8"),
);
const EDITOR_REST_COMPACT_LONG_PHRASES = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "editor-rest-compact-long-phrases.json"), "utf8"),
);
const EDITOR_PHRASE_LANGS = {
  ...EDITOR_SHOW_PHRASES,
  ...EDITOR_REST_LONG_PHRASES,
  ...EDITOR_REST_COMPACT_LONG_PHRASES,
};

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
Barra a ancho completo
Barra y hover (ms)
Entrada barra (ms)
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
Ocultar ajustes hápticos
Mostrar ajustes hápticos
Usar vibración si no hay háptica
Intensidad
Ligera
Media
Fuerte
Error
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
    [/Barra a ancho completo/gi, "Full-width bar"],
    [/Entrada barra \(ms\)/gi, "Dock entrance (ms)"],
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
    [/Usar carátula como fondo/gi, "Use album art as background"],
    [/Usar el icono de la entidad/gi, "Use entity icon"],
    [/Usar foto de entidad/gi, "Use entity photo"],
    [/Usar foto de la entidad/gi, "Use entity photo"],
    [/Usar icono de la entidad/gi, "Use entity icon"],
    [/Usar icono de zona/gi, "Use zone icon"],
    [/Usar vibracion de respaldo/gi, "Use vibration fallback"],
    [/Usar vibración si no hay háptica/gi, "Use vibration if haptics unavailable"],
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
  if (typeof s !== "string" || !s) {
    return false;
  }
  if (/,/.test(s) || /\./.test(s)) {
    return false;
  }
  return s.length <= 72;
}

function enToDe(s) {
  if (!isCompactUiEnglish(s)) {
    return s;
  }
  return s
    .replace(/^Open URL in new tab$/i, "URL in neuem Tab öffnen")
    .replace(/^Open URL$/i, "URL öffnen")
    .replace(/^Open in new tab$/i, "In neuem Tab öffnen")
    .replace(/^Enable haptic feedback$/i, "Haptisches Feedback aktivieren")
    .replace(/^Enable animations$/i, "Animationen aktivieren")
    .replace(/^Enable haptics$/i, "Haptik aktivieren")
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
    .replace(/^Haptic feedback$/i, "Haptisches Feedback");
}

function enToFr(s) {
  if (!isCompactUiEnglish(s)) {
    return s;
  }
  return s
    .replace(/^Open URL in new tab$/i, "Ouvrir l’URL dans un nouvel onglet")
    .replace(/^Open URL$/i, "Ouvrir l’URL")
    .replace(/^Open in new tab$/i, "Ouvrir dans un nouvel onglet")
    .replace(/^Enable haptic feedback$/i, "Activer le retour haptique")
    .replace(/^Enable animations$/i, "Activer les animations")
    .replace(/^Enable haptics$/i, "Activer la haptique")
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
    .replace(/^Haptic feedback$/i, "Retour haptique");
}

function enToIt(s) {
  if (!isCompactUiEnglish(s)) {
    return s;
  }
  return s
    .replace(/^Open URL in new tab$/i, "Apri URL in una nuova scheda")
    .replace(/^Open URL$/i, "Apri URL")
    .replace(/^Open in new tab$/i, "Apri in una nuova scheda")
    .replace(/^Enable haptic feedback$/i, "Abilita feedback aptico")
    .replace(/^Enable animations$/i, "Abilita animazioni")
    .replace(/^Enable haptics$/i, "Abilita aptica")
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
    .replace(/^Haptic feedback$/i, "Feedback aptico");
}

function enToNl(s) {
  if (!isCompactUiEnglish(s)) {
    return s;
  }
  return s
    .replace(/^Open URL in new tab$/i, "URL openen in nieuw tabblad")
    .replace(/^Open URL$/i, "URL openen")
    .replace(/^Open in new tab$/i, "Openen in nieuw tabblad")
    .replace(/^Enable haptic feedback$/i, "Haptische feedback inschakelen")
    .replace(/^Enable animations$/i, "Animaties inschakelen")
    .replace(/^Enable haptics$/i, "Haptiek inschakelen")
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
    .replace(/^Haptic feedback$/i, "Haptische feedback");
}

function enToNo(s) {
  return s;
}

function enToPt(s) {
  if (!isCompactUiEnglish(s)) {
    return s;
  }
  return s
    .replace(/^Open URL in new tab$/i, "Abrir URL num novo separador")
    .replace(/^Open URL$/i, "Abrir URL")
    .replace(/^Open in new tab$/i, "Abrir num novo separador")
    .replace(/^Enable haptic feedback$/i, "Ativar feedback háptico")
    .replace(/^Enable animations$/i, "Ativar animações")
    .replace(/^Enable haptics$/i, "Ativar háptico")
    .replace(/^Show /, "Mostrar ")
    .replace(/^Enable /, "Ativar ")
    .replace(/^Open /, "Abrir ")
    .replace(/^Icon$/i, "Ícone")
    .replace(/^General$/i, "Geral")
    .replace(/^Styles$/i, "Estilos")
    .replace(/^Map$/i, "Mapa")
    .replace(/^Border$/i, "Borda")
    .replace(/^Shadow$/i, "Sombra")
    .replace(/^Padding$/i, "Margem interna")
    .replace(/^Color$/i, "Cor")
    .replace(/^Title$/i, "Título")
    .replace(/^Entity$/i, "Entidade")
    .replace(/^Alarm$/i, "Alarme")
    .replace(/^Layout$/i, "Layout")
    .replace(/^Flow$/i, "Fluxo")
    .replace(/^Players$/i, "Leitores")
    .replace(/^Routes$/i, "Rotas")
    .replace(/^Series$/i, "Séries")
    .replace(/^Modes$/i, "Modos")
    .replace(/^Individuals$/i, "Individuais")
    .replace(/^Haptic feedback$/i, "Feedback háptico");
}

function enToRu(s) {
  if (!isCompactUiEnglish(s)) {
    return s;
  }
  return s
    .replace(/^Open URL in new tab$/i, "Открыть URL в новой вкладке")
    .replace(/^Open URL$/i, "Открыть URL")
    .replace(/^Open in new tab$/i, "Открыть в новой вкладке")
    .replace(/^Enable haptic feedback$/i, "Включить тактильную отдачу")
    .replace(/^Enable animations$/i, "Включить анимации")
    .replace(/^Enable haptics$/i, "Включить тактильную отдачу")
    .replace(/^Show /, "Показать: ")
    .replace(/^Enable /, "Включить ")
    .replace(/^Open /, "Открыть ")
    .replace(/^Icon$/i, "Значок")
    .replace(/^General$/i, "Общее")
    .replace(/^Styles$/i, "Стили")
    .replace(/^Map$/i, "Карта")
    .replace(/^Border$/i, "Граница")
    .replace(/^Shadow$/i, "Тень")
    .replace(/^Padding$/i, "Отступ")
    .replace(/^Color$/i, "Цвет")
    .replace(/^Title$/i, "Заголовок")
    .replace(/^Entity$/i, "Объект")
    .replace(/^Alarm$/i, "Сигнализация")
    .replace(/^Layout$/i, "Макет")
    .replace(/^Flow$/i, "Поток")
    .replace(/^Players$/i, "Плееры")
    .replace(/^Routes$/i, "Маршруты")
    .replace(/^Series$/i, "Ряды")
    .replace(/^Modes$/i, "Режимы")
    .replace(/^Individuals$/i, "Отдельные")
    .replace(/^Haptic feedback$/i, "Тактильная отдача");
}

function enToEl(s) {
  if (!isCompactUiEnglish(s)) {
    return s;
  }
  return s
    .replace(/^Open URL in new tab$/i, "Άνοιγμα URL σε νέα καρτέλα")
    .replace(/^Open URL$/i, "Άνοιγμα URL")
    .replace(/^Open in new tab$/i, "Άνοιγμα σε νέα καρτέλα")
    .replace(/^Enable haptic feedback$/i, "Ενεργοποίηση απτικής ανάδρασης")
    .replace(/^Enable animations$/i, "Ενεργοποίηση κινούμενων εικόνων")
    .replace(/^Enable haptics$/i, "Ενεργοποίηση απτικής ανάδρασης")
    .replace(/^Show /, "Εμφάνιση ")
    .replace(/^Enable /, "Ενεργοποίηση ")
    .replace(/^Open /, "Άνοιγμα ")
    .replace(/^Icon$/i, "Εικονίδιο")
    .replace(/^General$/i, "Γενικά")
    .replace(/^Styles$/i, "Στυλ")
    .replace(/^Map$/i, "Χάρτης")
    .replace(/^Border$/i, "Περίγραμμα")
    .replace(/^Shadow$/i, "Σκιά")
    .replace(/^Padding$/i, "Εσωτερικό περιθώριο")
    .replace(/^Color$/i, "Χρώμα")
    .replace(/^Title$/i, "Τίτλος")
    .replace(/^Entity$/i, "Οντότητα")
    .replace(/^Alarm$/i, "Συναγερμός")
    .replace(/^Layout$/i, "Διάταξη")
    .replace(/^Flow$/i, "Ροή")
    .replace(/^Players$/i, "Αναπαραγωγείς")
    .replace(/^Routes$/i, "Διαδρομές")
    .replace(/^Series$/i, "Σειρές")
    .replace(/^Modes$/i, "Λειτουργίες")
    .replace(/^Individuals$/i, "Μεμονωμένα")
    .replace(/^Haptic feedback$/i, "Απτική ανάδραση");
}

function enToZh(s) {
  if (!isCompactUiEnglish(s)) {
    return s;
  }
  return s
    .replace(/^Open URL in new tab$/i, "在新标签页打开链接")
    .replace(/^Open URL$/i, "打开链接")
    .replace(/^Open in new tab$/i, "在新标签页打开")
    .replace(/^Enable haptic feedback$/i, "启用触觉反馈")
    .replace(/^Enable animations$/i, "启用动画")
    .replace(/^Enable haptics$/i, "启用触觉反馈")
    .replace(/^Show /, "显示")
    .replace(/^Enable /, "启用")
    .replace(/^Open /, "打开")
    .replace(/^Icon$/i, "图标")
    .replace(/^General$/i, "常规")
    .replace(/^Styles$/i, "样式")
    .replace(/^Map$/i, "地图")
    .replace(/^Border$/i, "边框")
    .replace(/^Shadow$/i, "阴影")
    .replace(/^Padding$/i, "内边距")
    .replace(/^Color$/i, "颜色")
    .replace(/^Title$/i, "标题")
    .replace(/^Entity$/i, "实体")
    .replace(/^Alarm$/i, "警报")
    .replace(/^Layout$/i, "布局")
    .replace(/^Flow$/i, "流向")
    .replace(/^Players$/i, "播放器")
    .replace(/^Routes$/i, "路线")
    .replace(/^Series$/i, "系列")
    .replace(/^Modes$/i, "模式")
    .replace(/^Individuals$/i, "单项")
    .replace(/^Haptic feedback$/i, "触觉反馈");
}

function enToRo(s) {
  if (!isCompactUiEnglish(s)) {
    return s;
  }
  return s
    .replace(/^Open URL in new tab$/i, "Deschide URL într-o filă nouă")
    .replace(/^Open URL$/i, "Deschide URL")
    .replace(/^Open in new tab$/i, "Deschide într-o filă nouă")
    .replace(/^Enable haptic feedback$/i, "Activează feedback haptic")
    .replace(/^Enable animations$/i, "Activează animațiile")
    .replace(/^Enable haptics$/i, "Activează haptic")
    .replace(/^Show /, "Afișează ")
    .replace(/^Enable /, "Activează ")
    .replace(/^Open /, "Deschide ")
    .replace(/^Icon$/i, "Pictogramă")
    .replace(/^General$/i, "General")
    .replace(/^Styles$/i, "Stiluri")
    .replace(/^Map$/i, "Hartă")
    .replace(/^Border$/i, "Chenar")
    .replace(/^Shadow$/i, "Umbră")
    .replace(/^Padding$/i, "Umplere")
    .replace(/^Color$/i, "Culoare")
    .replace(/^Title$/i, "Titlu")
    .replace(/^Entity$/i, "Entitate")
    .replace(/^Alarm$/i, "Alarmă")
    .replace(/^Layout$/i, "Aranjament")
    .replace(/^Flow$/i, "Flux")
    .replace(/^Players$/i, "Playere")
    .replace(/^Routes$/i, "Rute")
    .replace(/^Series$/i, "Serii")
    .replace(/^Modes$/i, "Moduri")
    .replace(/^Individuals$/i, "Individuale")
    .replace(/^Haptic feedback$/i, "Feedback haptic");
}

/** Full-sentence / editor phrases where compact locale shims cannot apply (length, commas). Key = English seed (`row.en`). */
const FULL_LOCALE_BY_EN = {
  Visibility: {
    de: "Sichtbarkeit",
    fr: "Visibilité",
    it: "Visibilità",
    nl: "Zichtbaarheid",
    pt: "Visibilidade",
    ru: "Видимость",
    el: "Ορατότητα",
    zh: "可见性",
    ro: "Vizibilitate",
  },
  "Choose which chips and controls should be shown.": {
    de: "Wähle, welche Chips und Steuerelemente angezeigt werden sollen.",
    fr: "Choisissez les puces et contrôles à afficher.",
    it: "Scegli quali chip e controlli mostrare.",
    nl: "Kies welke chips en bediening zichtbaar zijn.",
    pt: "Escolha quais chips e controlos mostrar.",
    ru: "Выберите, какие чипы и элементы управления показывать.",
    el: "Επιλέξτε ποια chip και στοιχεία ελέγχου θα εμφανίζονται.",
    zh: "选择要显示的芯片和控件。",
    ro: "Alegeți ce chipuri și comenzi să fie afișate.",
  },
  "Choose the information and visible controls.": {
    de: "Wähle die sichtbaren Informationen und Steuerelemente.",
    fr: "Choisissez les informations et contrôles visibles.",
    it: "Scegli le informazioni e i controlli visibili.",
    nl: "Kies zichtbare informatie en bediening.",
    pt: "Escolha as informações e os controlos visíveis.",
    ru: "Выберите отображаемую информацию и элементы управления.",
    el: "Επιλέξτε τις ορατές πληροφορίες και τα στοιχεία ελέγχου.",
    zh: "选择可见信息与控件。",
    ro: "Alegeți informațiile și comenzile vizibile.",
  },
  "State chip": { de: "Status-Chip", fr: "Puce d’état", it: "Chip di stato", nl: "Statuschip", pt: "Chip de estado", ru: "Чип состояния", el: "Chip κατάστασης", zh: "状态芯片", ro: "Chip stare"},
  "Current temperature chip": { de: "Aktuelle Temperatur (Chip)", fr: "Puce température actuelle", it: "Chip temperatura attuale", nl: "Huidige temperatuur (chip)", pt: "Chip da temperatura atual", ru: "Чип текущей температуры", el: "Chip τρέχουσας θερμοκρασίας", zh: "当前温度芯片", ro: "Chip temperatură curentă"},
  "Humidity chip": { de: "Feuchtigkeits-Chip", fr: "Puce humidité", it: "Chip umidità", nl: "Vochtigheidschip", pt: "Chip de humidade", ru: "Чип влажности", el: "Chip υγρασίας", zh: "湿度芯片", ro: "Chip umiditate"},
  "Show state chip": { de: "Status-Chip anzeigen", fr: "Afficher la puce d’état", it: "Mostra chip di stato", nl: "Toon statuschip", pt: "Mostrar chip de estado", ru: "Показать чип состояния", el: "Εμφάνιση chip κατάστασης", zh: "显示状态芯片", ro: "Afișează chip stare"},
  "Show current temperature chip": {
    de: "Aktuelle Temperatur anzeigen",
    fr: "Afficher la température actuelle",
    it: "Mostra chip temperatura attuale",
    nl: "Toon huidige temperatuur",
    pt: "Mostrar temperatura atual",
    ru: "Показать текущую температуру",
    el: "Εμφάνιση τρέχουσας θερμοκρασίας",
    zh: "显示当前温度",
    ro: "Afișează temperatura curentă",
  },
  "Show humidity chip": { de: "Feuchtigkeits-Chip anzeigen", fr: "Afficher l’humidité", it: "Mostra chip umidità", nl: "Toon vochtigheidschip", pt: "Mostrar chip de humidade", ru: "Показать чип влажности", el: "Εμφάνιση chip υγρασίας", zh: "显示湿度芯片", ro: "Afișează chip umiditate"},
  "Mode buttons": { de: "Modus-Tasten", fr: "Boutons de mode", it: "Pulsanti modalità", nl: "Modusknoppen", pt: "Botões de modo", ru: "Кнопки режима", el: "Κουμπιά λειτουργίας", zh: "模式按钮", ro: "Butoane mod"},
  "Show mode buttons": { de: "Modus-Tasten anzeigen", fr: "Afficher les boutons de mode", it: "Mostra pulsanti modalità", nl: "Toon modusknoppen", pt: "Mostrar botões de modo", ru: "Показать кнопки режима", el: "Εμφάνιση κουμπιών λειτουργίας", zh: "显示模式按钮", ro: "Afișează butoane mod"},
  "+ / − buttons": { de: "+/−-Tasten", fr: "Boutons +/−", it: "Pulsanti +/−", nl: "+/−-knoppen", pt: "Botões + / −", ru: "Кнопки +/−", el: "Κουμπιά +/−", zh: "+/− 按钮", ro: "Butoane +/−"},
  "Unavailable badge": { de: "Nicht-verfügbar-Abzeichen", fr: "Badge indisponible", it: "Badge non disponibile", nl: "Niet-beschikbaar-badge", pt: "Distintivo indisponível", ru: "Значок недоступности", el: "Σήμα μη διαθεσιμότητας", zh: "不可用标记", ro: "Insignă indisponibil"},
  "Show unavailable badge": { de: "Abzeichen „Nicht verfügbar“ anzeigen", fr: "Afficher le badge indisponible", it: "Mostra badge non disponibile", nl: "Toon niet-beschikbaar-badge", pt: "Mostrar distintivo indisponível", ru: "Показать значок недоступности", el: "Εμφάνιση σήματος μη διαθεσιμότητας", zh: "显示不可用标记", ro: "Afișează insignă indisponibil"},
  "Optional tactile feedback when using the dial and buttons.": {
    de: "Optionales haptisches Feedback beim Drehregler und den Tasten.",
    fr: "Retour tactile optionnel pour le cadran et les boutons.",
    it: "Feedback tattile opzionale per il dial e i pulsanti.",
    nl: "Optionele haptische feedback bij draaiknop en knoppen.",
    pt: "Feedback tátil opcional ao usar o mostrador e os botões.",
    ru: "Дополнительная тактильная отдача при использовании диска и кнопок.",
    el: "Προαιρετική απτική ανταπόκριση κατά τη χρήση του δίσκου και των κουμπιών.",
    zh: "使用旋钮和按钮时的可选触觉反馈。",
    ro: "Feedback tactil opțional la utilizarea discului și a butoanelor.",
  },
  "Optional haptic feedback for dial and controls.": {
    de: "Optionales haptisches Feedback für Drehregler und Steuerelemente.",
    fr: "Retour haptique optionnel pour le cadran et les contrôles.",
    it: "Feedback aptico opzionale per il dial e i controlli.",
    nl: "Optionele haptische feedback voor draaiknop en bediening.",
    pt: "Feedback háptico opcional para o mostrador e controlos.",
    ru: "Дополнительная тактильная отдача для диска и элементов управления.",
    el: "Προαιρετική απτική ανταπόκριση για τον δίσκο και τα στοιχεία ελέγχου.",
    zh: "旋钮与控件的可选触觉反馈。",
    ro: "Feedback haptic opțional pentru disc și comenzi.",
  },
  "Enable haptics": { de: "Haptik aktivieren", fr: "Activer le retour haptique", it: "Abilita feedback aptico", nl: "Haptiek inschakelen", pt: "Ativar háptica", ru: "Включить тактильную отдачу", el: "Ενεργοποίηση απτικής ανταπόκρισης", zh: "启用触觉", ro: "Activează haptic"},
  "Use entity icon": {
    de: "Entitätssymbol verwenden",
    fr: "Utiliser l’icône de l’entité",
    it: "Usa l’icona dell’entità",
    nl: "Pictogram van entiteit gebruiken",
    pt: "Usar ícone da entidade",
    ru: "Использовать значок объекта",
    el: "Χρήση εικονιδίου οντότητας",
    zh: "使用实体图标",
    ro: "Folosește pictograma entității",
  },
  "Use zone icon": {
    de: "Zonensymbol verwenden",
    fr: "Utiliser l’icône de zone",
    it: "Usa l’icona della zona",
    nl: "Zonepictogram gebruiken",
    pt: "Usar ícone da zona",
    ru: "Использовать значок зоны",
    el: "Χρήση εικονιδίου ζώνης",
    zh: "使用区域图标",
    ro: "Folosește pictograma zonei",
  },
  "Use entity photo": {
    de: "Entitätsfoto verwenden",
    fr: "Utiliser la photo de l’entité",
    it: "Usa la foto dell’entità",
    nl: "Entiteitsfoto gebruiken",
    pt: "Usar foto da entidade",
    ru: "Использовать фото объекта",
    el: "Χρήση φωτογραφίας οντότητας",
    zh: "使用实体照片",
    ro: "Folosește fotografia entității",
  },
  "Tap action": {
    de: "Tipp-Aktion",
    fr: "Action au toucher",
    it: "Azione al tocco",
    nl: "Tikactie",
    pt: "Ação ao tocar",
    ru: "Действие при нажатии",
    el: "Ενέργεια πατήματος",
    zh: "点击操作",
    ro: "Acțiune la atingere",
  },
  "Use vibration fallback": {
    de: "Vibrations-Fallback verwenden",
    fr: "Utiliser la vibration de secours",
    it: "Usa vibrazione di riserva",
    nl: "Trillen als reserve gebruiken",
    pt: "Usar vibração de reserva",
    ru: "Использовать вибрацию как запасной вариант",
    el: "Χρήση δόνησης ως εφεδρικής",
    zh: "使用振动后备",
    ro: "Folosește vibrația de rezervă",
  },
  "Use vibration if haptics unavailable": {
    de: "Vibration nutzen, wenn keine Haptik",
    fr: "Vibrer si pas de retour haptique",
    it: "Usa vibrazione se non c’è aptica",
    nl: "Trillen als geen haptiek",
    pt: "Vibrar se não houver háptica",
    ru: "Вибрация, если тактильная отдача недоступна",
    el: "Δόνηση όταν δεν υπάρχει απτική ανταπόκριση",
    zh: "无触觉时使用振动",
    ro: "Vibrație dacă nu e haptic",
  },
  "Vibration fallback": { de: "Vibrations-Fallback", fr: "Secours vibration", it: "Fallback vibrazione", nl: "Trilling reserve", pt: "Reserva por vibração", ru: "Резервная вибрация", el: "Εναλλακτικό δόνησης", zh: "振动后备", ro: "Rezervă vibrație"},
  "Customize the Nodalia look for the climate card, dial and controls.": {
    de: "Passe das Nodalia-Erscheinungsbild für die Thermostat-Karte, den Drehregler und die Steuerung an.",
    fr: "Personnalisez le rendu Nodalia de la carte climat, du cadran et des contrôles.",
    it: "Personalizza l’aspetto Nodalia della climate card, del dial e dei controlli.",
    nl: "Pas de Nodalia-stijl aan voor de thermostaatkaart, draaiknop en bediening.",
    pt: "Personalize o aspeto Nodalia do cartão de clima, mostrador e controlos.",
    ru: "Настройте вид Nodalia для карты климата, диска и элементов управления.",
    el: "Προσαρμόστε την εμφάνιση Nodalia για την κάρτα κλίματος, τον δίσκο και τα στοιχεία ελέγχου.",
    zh: "自定义气候卡片、旋钮与控件的 Nodalia 外观。",
    ro: "Personalizați aspectul Nodalia pentru cardul climă, disc și comenzi.",
  },
  "Hide style settings": {
    de: "Stileinstellungen ausblenden",
    fr: "Masquer les paramètres de style",
    it: "Nascondi impostazioni di stile",
    nl: "Stijlinstellingen verbergen",
    pt: "Ocultar definições de estilo",
    ru: "Скрыть настройки стиля",
    el: "Απόκρυψη ρυθμίσεων στιλ",
    zh: "隐藏样式设置",
    ro: "Ascunde setările de stil",
  },
  "Show style settings": {
    de: "Stileinstellungen anzeigen",
    fr: "Afficher les paramètres de style",
    it: "Mostra impostazioni di stile",
    nl: "Stijlinstellingen tonen",
    pt: "Mostrar definições de estilo",
    ru: "Показать настройки стиля",
    el: "Εμφάνιση ρυθμίσεων στιλ",
    zh: "显示样式设置",
    ro: "Afișează setările de stil",
  },
  "Hide animation settings": {
    de: "Animationseinstellungen ausblenden",
    fr: "Masquer les paramètres d’animation",
    it: "Nascondi impostazioni animazioni",
    nl: "Animatie-instellingen verbergen",
    pt: "Ocultar definições de animação",
    ru: "Скрыть настройки анимации",
    el: "Απόκρυψη ρυθμίσεων κινούμενης εικόνας",
    zh: "隐藏动画设置",
    ro: "Ascunde setările de animație",
  },
  "Show animation settings": {
    de: "Animationseinstellungen anzeigen",
    fr: "Afficher les paramètres d’animation",
    it: "Mostra impostazioni animazioni",
    nl: "Animatie-instellingen tonen",
    pt: "Mostrar definições de animação",
    ru: "Показать настройки анимации",
    el: "Εμφάνιση ρυθμίσεων κινούμενης εικόνας",
    zh: "显示动画设置",
    ro: "Afișează setările de animație",
  },
  "Controls dial transition, content entrance and button bounce.": {
    de: "Steuert den Übergang des Drehreglers, den Eingang des Inhalts und den Tasten-Federungseffekt.",
    fr: "Contrôle la transition du cadran, l’entrée du contenu et le rebond des boutons.",
    it: "Controlla la transizione del dial, l’ingresso del contenuto e il rimbalzo dei pulsanti.",
    nl: "Regelt de draaiknop-overgang, binnenkomst van inhoud en knop-veer.",
    pt: "Controla a transição do mostrador, a entrada do conteúdo e o salto dos botões.",
    ru: "Управляет переходом диска, появлением содержимого и отскоком кнопок.",
    el: "Ελέγχει τη μετάβαση του δίσκου, την είσοδο περιεχομένου και το αναπήδημα των κουμπιών.",
    zh: "控制旋钮过渡、内容进入与按钮弹跳。",
    ro: "Controlează tranziția discului, intrarea conținutului și săritura butoanelor.",
  },
  "Card background": { de: "Kartenhintergrund", fr: "Fond de la carte", it: "Sfondo scheda", nl: "Kaartachtergrond", pt: "Fundo do cartão", ru: "Фон карточки", el: "Φόντο κάρτας", zh: "卡片背景", ro: "Fundal card"},
  "Bubble background": { de: "Blasen-Hintergrund", fr: "Fond de la bulle", it: "Sfondo bolla", nl: "Bel-achtergrond", pt: "Fundo da bolha", ru: "Фон пузырька", el: "Φόντο φυσαλίδας", zh: "气泡背景", ro: "Fundal bulă"},
  "Dial background": { de: "Drehregler-Hintergrund", fr: "Fond du cadran", it: "Sfondo dial", nl: "Draaiknop-achtergrond", pt: "Fundo do mostrador", ru: "Фон диска", el: "Φόντο δίσκου", zh: "旋钮背景", ro: "Fundal disc"},
  "Button accent background": { de: "Akzent-Hintergrund der Tasten", fr: "Fond d’accent des boutons", it: "Sfondo accento pulsanti", nl: "Knopaccent-achtergrond", pt: "Fundo de destaque dos botões", ru: "Фон акцента кнопок", el: "Φόντο τονισμού κουμπιών", zh: "按钮强调背景", ro: "Fundal accent butoane"},
  "Helps compact the climate card based on available space.": {
    de: "Hilft, die Thermostat-Karte je nach verfügbarem Platz zu kompaktieren.",
    fr: "Aide à compacter la carte climat selon l’espace disponible.",
    it: "Aiuta a compattare la climate card in base allo spazio.",
    nl: "Houdt de thermostaatkaart compact naargelang de ruimte.",
    pt: "Ajuda a compactar o cartão de clima conforme o espaço disponível.",
    ru: "Помогает компактнее отображать карту климата в зависимости от места.",
    el: "Βοηθά στη συμπύκνωση της κάρτας κλίματος ανάλογα με τον διαθέσιμο χώρο.",
    zh: "根据可用空间压缩气候卡片。",
    ro: "Ajută la compactarea cardului climă în funcție de spațiul disponibil.",
  },
  "Entity bubble size": {
    de: "Größe Entitätsblase",
    fr: "Taille de la bulle d’entité",
    it: "Dimensione bolla entità",
    nl: "Grootte entiteitsbel",
    pt: "Tamanho da bolha da entidade",
    ru: "Размер пузырька сущности",
    el: "Μέγεθος φυσαλίδας οντότητας",
    zh: "实体气泡大小",
    ro: "Dimensiune bulă entitate",
  },
  "On icon color": { de: "Symbolfarbe (Ein)", fr: "Couleur icône (actif)", it: "Colore icona (acceso)", nl: "Pictogramkleur (aan)", pt: "Cor do ícone (ligado)", ru: "Цвет значка (вкл.)", el: "Χρώμα εικονιδίου (ενεργό)", zh: "开启图标颜色", ro: "Culoare pictogramă (pornit)"},
  "Off icon color": { de: "Symbolfarbe (Aus)", fr: "Couleur icône (inactif)", it: "Colore icona (spento)", nl: "Pictogramkleur (uit)", pt: "Cor do ícone (desligado)", ru: "Цвет значка (выкл.)", el: "Χρώμα εικονιδίου (ανενεργό)", zh: "关闭图标颜色", ro: "Culoare pictogramă (oprit)"},
  "Active icon color": { de: "Aktive Symbolfarbe", fr: "Couleur d’icône active", it: "Colore icona attivo", nl: "Actieve pictogramkleur", pt: "Cor do ícone ativo", ru: "Цвет активного значка", el: "Χρώμα ενεργού εικονιδίου", zh: "活动图标颜色", ro: "Culoare pictogramă activă"},
  "Inactive icon color": { de: "Inaktive Symbolfarbe", fr: "Couleur d’icône inactive", it: "Colore icona inattivo", nl: "Inactieve pictogramkleur", pt: "Cor do ícone inativo", ru: "Цвет неактивного значка", el: "Χρώμα ανενεργού εικονιδίου", zh: "非活动图标颜色", ro: "Culoare pictogramă inactivă"},
  "Icon bubble background": { de: "Hintergrund Symbolblase", fr: "Fond de la bulle d’icône", it: "Sfondo bolla icona", nl: "Achtergrond pictogrambel", pt: "Fundo da bolha do ícone", ru: "Фон пузырька значка", el: "Φόντο φυσαλίδας εικονιδίου", zh: "图标气泡背景", ro: "Fundal bulă pictogramă"},
  "Heat color": { de: "Heizfarbe", fr: "Couleur chaleur", it: "Colore calore", nl: "Verwarmingskleur", pt: "Cor de aquecimento", ru: "Цвет нагрева", el: "Χρώμα θέρμανσης", zh: "制热颜色", ro: "Culoare încălzire"},
  "Cool color": { de: "Kühlfarbe", fr: "Couleur froid", it: "Colore freddo", nl: "Koelkleur", pt: "Cor de arrefecimento", ru: "Цвет охлаждения", el: "Χρώμα ψύξης", zh: "制冷颜色", ro: "Culoare răcire"},
  "Current temperature size": {
    de: "Größe aktuelle Temperatur",
    fr: "Taille température actuelle",
    it: "Dimensione temperatura attuale",
    nl: "Grootte huidige temperatuur",
    pt: "Tamanho da temperatura atual",
    ru: "Размер текущей температуры",
    el: "Μέγεθος τρέχουσας θερμοκρασίας",
    zh: "当前温度大小",
    ro: "Dimensiune temperatură curentă",
  },
  "Target temperature size": {
    de: "Größe Solltemperatur",
    fr: "Taille consigne de température",
    it: "Dimensione temperatura obiettivo",
    nl: "Grootte doeltemperatuur",
    pt: "Tamanho da temperatura alvo",
    ru: "Размер целевой температуры",
    el: "Μέγεθος στοχευμένης θερμοκρασίας",
    zh: "目标温度大小",
    ro: "Dimensiune temperatură țintă",
  },
  "Target size": { de: "Ziel-Größe", fr: "Taille cible", it: "Dimensione obiettivo", nl: "Doelgrootte", pt: "Tamanho do alvo", ru: "Размер цели", el: "Μέγεθος στόχου", zh: "目标大小", ro: "Dimensiune țintă"},
  "Condition size": { de: "Vorhersage-Größe", fr: "Taille condition", it: "Dimensione condizione", nl: "Voorwaardegrootte", pt: "Tamanho da condição", ru: "Размер условия", el: "Μέγεθος συνθήκης", zh: "状况大小", ro: "Dimensiune condiție"},
  "Chip text": { de: "Chip-Text", fr: "Texte de puce", it: "Testo chip", nl: "Chip-tekst", pt: "Texto do chip", ru: "Текст чипа", el: "Κείμενο chip", zh: "芯片文字", ro: "Text chip"},
  "Chip texts": { de: "Chip-Texte", fr: "Textes de puces", it: "Testi chip", nl: "Chip-teksten", pt: "Textos dos chips", ru: "Тексты чипов", el: "Κείμενα chip", zh: "芯片文字", ro: "Texte chip"},
  "Icon Color": { de: "Symbolfarbe", fr: "Couleur d’icône", it: "Colore icona", nl: "Pictogramkleur", pt: "Cor do ícone", ru: "Цвет значка", el: "Χρώμα εικονιδίου", zh: "图标颜色", ro: "Culoare pictogramă"},
  "Auto Color": { de: "Auto-Farbe", fr: "Couleur auto", it: "Colore auto", nl: "Autokleur", pt: "Cor automática", ru: "Цвет авто", el: "Αυτόματο χρώμα", zh: "自动颜色", ro: "Culoare automată"},
  "Dry Color": { de: "Trocknungsfarbe", fr: "Couleur séchage", it: "Colore asciugatura", nl: "Droogkleur", pt: "Cor de secagem", ru: "Цвет сушки", el: "Χρώμα στεγνώματος", zh: "除湿颜色", ro: "Culoare uscare"},
  "Fan Color": { de: "Lüfterfarbe", fr: "Couleur ventilateur", it: "Colore ventola", nl: "Ventilatorkleur", pt: "Cor do ventilador", ru: "Цвет вентилятора", el: "Χρώμα ανεμιστήρα", zh: "风扇颜色", ro: "Culoare ventilator"},
  "Content entrance (ms)": { de: "Inhaltseingang (ms)", fr: "Entrée du contenu (ms)", it: "Ingresso contenuto (ms)", nl: "Inhoud binnenkomst (ms)", pt: "Entrada do conteúdo (ms)", ru: "Появление содержимого (мс)", el: "Είσοδος περιεχομένου (ms)", zh: "内容进入（毫秒）", ro: "Intrare conținut (ms)"},
  "Tap bounce (ms)": { de: "Tipp-Feder (ms)", fr: "Rebond au toucher (ms)", it: "Rimbalzo tap (ms)", nl: "Tik-veer (ms)", pt: "Salto ao toque (ms)", ru: "Отскок при нажатии (мс)", el: "Αναπήδηση πατήματος (ms)", zh: "点击弹跳（毫秒）", ro: "Săritură la atingere (ms)"},
  "Size + / − buttons": { de: "Größe +/−-Tasten", fr: "Taille des boutons +/−", it: "Dimensione pulsanti +/−", nl: "Grootte +/− knoppen", pt: "Tamanho dos botões + / −", ru: "Размер кнопок +/−", el: "Μέγεθος κουμπιών +/−", zh: "+/− 按钮大小", ro: "Dimensiune butoane +/−"},
  "Title size": { de: "Titelgröße", fr: "Taille du titre", it: "Dimensione titolo", nl: "Titelgrootte", pt: "Tamanho do título", ru: "Размер заголовка", el: "Μέγεθος τίτλου", zh: "标题大小", ro: "Dimensiune titlu"},
  "Temperature size": { de: "Temperatur-Größe", fr: "Taille température", it: "Dimensione temperatura", nl: "Temperatuurgrootte", pt: "Tamanho da temperatura", ru: "Размер температуры", el: "Μέγεθος θερμοκρασίας", zh: "温度大小", ro: "Dimensiune temperatură"},
  "Thumb size": { de: "Griffgröße", fr: "Taille du curseur", it: "Dimensione thumb", nl: "Duimgrootte", pt: "Tamanho do indicador", ru: "Размер ползунка", el: "Μέγεθος λαβής", zh: "滑块大小", ro: "Dimensiune cursor"},
  "Dial track": { de: "Drehregler-Spur", fr: "Piste du cadran", it: "Traccia dial", nl: "Draaiknop-spoor", pt: "Trilho do mostrador", ru: "Дорожка диска", el: "Διαδρομή δίσκου", zh: "旋钮轨道", ro: "Pistă disc"},
  "Basic visual settings for the card.": {
    de: "Grundlegende visuelle Einstellungen für die Karte.",
    fr: "Réglages visuels de base pour la carte.",
    it: "Impostazioni visive di base per la scheda.",
    nl: "Basis visuele instellingen voor de kaart.",
    pt: "Definições visuais básicas do cartão.",
    ru: "Базовые визуальные настройки карточки.",
    el: "Βασικές οπτικές ρυθμίσεις για την κάρτα.",
    zh: "卡片的基本视觉设置。",
    ro: "Setări vizuale de bază pentru card.",
  },
  "Basic visual settings for the favourite card.": {
    de: "Grundlegende visuelle Einstellungen für die Favoritenkarte.",
    fr: "Réglages visuels de base pour la carte favoris.",
    it: "Impostazioni visive di base per la scheda preferiti.",
    nl: "Basis visuele instellingen voor de favorietenkaart.",
    pt: "Definições visuais básicas do cartão de favoritos.",
    ru: "Базовые визуальные настройки карточки избранного.",
    el: "Βασικές οπτικές ρυθμίσεις για την κάρτα αγαπημένων.",
    zh: "收藏卡片的基本视觉设置。",
    ro: "Setări vizuale de bază pentru cardul favorite.",
  },
  "Line thickness": {
    de: "Linienstärke",
    fr: "Épaisseur des lignes",
    it: "Spessore linee",
    nl: "Lijndikte",
    pt: "Espessura das linhas",
    ru: "Толщина линий",
    el: "Πάχος γραμμών",
    zh: "线条粗细",
    ro: "Grosime linii",
  },
  "Slider thickness": {
    de: "Schieberegler-Stärke",
    fr: "Épaisseur du curseur",
    it: "Spessore slider",
    nl: "Schuifregelaardikte",
    pt: "Espessura do controlo deslizante",
    ru: "Толщина ползунка",
    el: "Πάχος ρυθμιστή",
    zh: "滑块粗细",
    ro: "Grosime cursor",
  },
  "Dial thickness": {
    de: "Drehregler-Stärke",
    fr: "Épaisseur du cadran",
    it: "Spessore del dial",
    nl: "Draaiknopdikte",
    pt: "Espessura do mostrador",
    ru: "Толщина диска",
    el: "Πάχος δίσκου",
    zh: "旋钮粗细",
    ro: "Grosime disc",
  },
  "Node size": {
    de: "Knotengröße",
    fr: "Taille du nœud",
    it: "Dimensione nodo",
    nl: "Knooppuntgrootte",
    pt: "Tamanho do nó",
    ru: "Размер узла",
    el: "Μέγεθος κόμβου",
    zh: "节点大小",
    ro: "Dimensiune nod",
  },
  "Home size": {
    de: "Hausgröße",
    fr: "Taille du foyer",
    it: "Dimensione casa",
    nl: "Thuisgrootte",
    pt: "Tamanho da casa",
    ru: "Размер дома",
    el: "Μέγεθος σπιτιού",
    zh: "用电主体大小",
    ro: "Dimensiune casă",
  },
  "Individual size": {
    de: "Einzelgröße",
    fr: "Taille individuelle",
    it: "Dimensione individuale",
    nl: "Individuele grootte",
    pt: "Tamanho individual",
    ru: "Размер индивидуального узла",
    el: "Μέγεθος ατομικής παροχής",
    zh: "单独回路大小",
    ro: "Dimensiune individuală",
  },
  "Zero-line transparency": {
    de: "Transparenz bei Null-Linien",
    fr: "Transparence des lignes à zéro",
    it: "Trasparenza linee a zero",
    nl: "Transparantie nul-lijnen",
    pt: "Transparência das linhas a zero",
    ru: "Прозрачность нулевых линий",
    el: "Διαφάνεια μηδενικών γραμμών",
    zh: "零流量线透明度",
    ro: "Transparență linii la zero",
  },
  "Secondary text": {
    de: "Sekundärtext",
    fr: "Texte secondaire",
    it: "Testo secondario",
    nl: "Secundaire tekst",
    pt: "Texto secundário",
    ru: "Дополнительный текст",
    el: "Δευτερεύον κείμενο",
    zh: "次要文字",
    ro: "Text secundar",
  },
  "Chip padding": {
    de: "Chip-Innenabstand",
    fr: "Remplissage de la puce",
    it: "Padding chip",
    nl: "Chip-opvulling",
    pt: "Margem interna do chip",
    ru: "Отступ чипа",
    el: "Εσωτερικό chip",
    zh: "芯片内边距",
    ro: "Padding chip",
  },
  "Icon color": {
    de: "Symbolfarbe",
    fr: "Couleur de l’icône",
    it: "Colore icona",
    nl: "Pictogramkleur",
    pt: "Cor dos ícones",
    ru: "Цвет значков",
    el: "Χρώμα εικονιδίων",
    zh: "图标颜色",
    ro: "Culoare pictograme",
  },
  "Gray RGB color": {
    de: "Grau (RGB)",
    fr: "Gris RVB",
    it: "Grigio RGB",
    nl: "Grijs RGB",
    pt: "Cinza RGB",
    ru: "Серый RGB",
    el: "Γκρι RGB",
    zh: "灰色 RGB",
    ro: "Gri RGB",
  },
  "Minimum flow (s)": {
    de: "Minimaler Fluss (s)",
    fr: "Flux minimum (s)",
    it: "Flusso minimo (s)",
    nl: "Minimale stroom (s)",
    pt: "Fluxo mínimo (s)",
    ru: "Минимальный поток (с)",
    el: "Ελάχιστη ροή (δ)",
    zh: "最小流量（秒）",
    ro: "Flux minim (s)",
  },
  "Maximum flow (s)": {
    de: "Maximaler Fluss (s)",
    fr: "Flux maximum (s)",
    it: "Flusso massimo (s)",
    nl: "Maximale stroom (s)",
    pt: "Fluxo máximo (s)",
    ru: "Максимальный поток (с)",
    el: "Μέγιστη ροή (δ)",
    zh: "最大流量（秒）",
    ro: "Flux maxim (s)",
  },
  "Chip size": {
    de: "Chip-Größe",
    fr: "Taille de la puce",
    it: "Dimensione chip",
    nl: "Chipgrootte",
    pt: "Tamanho do chip",
    ru: "Размер чипа",
    el: "Μέγεθος chip",
    zh: "芯片尺寸",
    ro: "Dimensiune chip",
  },
  "Home value": {
    de: "Hauswert",
    fr: "Valeur foyer",
    it: "Valore casa",
    nl: "Thuiswaarde",
    pt: "Valor da casa",
    ru: "Значение дома",
    el: "Τιμή σπιτιού",
    zh: "用电数值大小",
    ro: "Valoare casă",
  },
  "Node value": {
    de: "Knotenwert",
    fr: "Valeur du nœud",
    it: "Valore nodo",
    nl: "Knooppuntwaarde",
    pt: "Valor do nó",
    ru: "Значение узла",
    el: "Τιμή κόμβου",
    zh: "节点数值大小",
    ro: "Valoare nod",
  },
  "Home unit": {
    de: "Hauseinheit",
    fr: "Unité foyer",
    it: "Unità casa",
    nl: "Thuis eenheid",
    pt: "Unidade da casa",
    ru: "Единица дома",
    el: "Μονάδα σπιτιού",
    zh: "用电单位大小",
    ro: "Unitate casă",
  },
  "Chip height": {
    de: "Chip-Höhe",
    fr: "Hauteur du chip",
    it: "Altezza chip",
    nl: "Chiphoogte",
    pt: "Altura do chip",
    ru: "Высота чипа",
    el: "Ύψος chip",
    zh: "芯片高度",
    ro: "Înalțime chip",
  },
  "Chip heights": {
    de: "Chip-Höhen",
    fr: "Hauteurs des chips",
    it: "Altezze chip",
    nl: "Chiphoogtes",
    pt: "Alturas dos chips",
    ru: "Высоты чипов",
    el: "Ύψη chip",
    zh: "芯片高度",
    ro: "Înălțimi chip",
  },
  "Slider container height": {
    de: "Höhe des Schieberegler-Containers",
    fr: "Hauteur du conteneur du curseur",
    it: "Altezza contenitore slider",
    nl: "Hoogte schuifregelaarcontainer",
    pt: "Altura do contentor do controlo deslizante",
    ru: "Высота контейнера ползунка",
    el: "Ύψος δοχείου ρυθμιστή",
    zh: "滑块容器高度",
    ro: "Înălțime container cursor",
  },
  "Info bubble height": {
    de: "Höhe der Info-Blase",
    fr: "Hauteur de la bulle d’info",
    it: "Altezza bolla informazioni",
    nl: "Hoogte infobel",
    pt: "Altura da bolha de informação",
    ru: "Высота информационного пузыря",
    el: "Ύψος φυσαλίδας πληροφοριών",
    zh: "信息气泡高度",
    ro: "Înălțime bulă informații",
  },
  "Chart height": {
    de: "Diagrammhöhe",
    fr: "Hauteur du graphique",
    it: "Altezza grafico",
    nl: "Grafiekhoogte",
    pt: "Altura do gráfico",
    ru: "Высота графика",
    el: "Ύψος γραφήματος",
    zh: "图表高度",
    ro: "Înălțime grafic",
  },
  "Code input height": {
    de: "Höhe des Codefelds",
    fr: "Hauteur du champ de code",
    it: "Altezza campo codice",
    nl: "Hoogte code-invoer",
    pt: "Altura do campo de código",
    ru: "Высота поля кода",
    el: "Ύψος πεδίου κωδικού",
    zh: "密码输入框高度",
    ro: "Înălțime câmp cod",
  },
  "Minimum height": {
    de: "Mindesthöhe",
    fr: "Hauteur minimale",
    it: "Altezza minima",
    nl: "Minimumhoogte",
    pt: "Altura mínima",
    ru: "Минимальная высота",
    el: "Ελάχιστο ύψος",
    zh: "最小高度",
    ro: "Înălțime minimă",
  },
  "Reserved height": {
    de: "Reservierte Höhe",
    fr: "Hauteur réservée",
    it: "Altezza riservata",
    nl: "Gereserveerde hoogte",
    pt: "Altura reservada",
    ru: "Зарезервированная высота",
    el: "Δεσμευμένο ύψος",
    zh: "预留高度",
    ro: "Înălțime rezervată",
  },
  "Slider bubble width": {
    de: "Breite der Schieberegler-Blase",
    fr: "Largeur de la bulle du curseur",
    it: "Larghezza bolla slider",
    nl: "Breedte schuifregelaarbel",
    pt: "Largura da bolha do controlo deslizante",
    ru: "Ширина пузыря ползунка",
    el: "Πλάτος φυσαλίδας ρυθμιστή",
    zh: "滑块气泡宽度",
    ro: "Lățime bulă cursor",
  },
  "Maximum width": {
    de: "Maximalbreite",
    fr: "Largeur maximale",
    it: "Larghezza massima",
    nl: "Maximale breedte",
    pt: "Largura máxima",
    ru: "Максимальная ширина",
    el: "Μέγιστο πλάτος",
    zh: "最大宽度",
    ro: "Lățime maximă",
  },
  "Icon fit (icon only)": {
    de: "Symbol einpassen (nur Symbol)",
    fr: "Adapter l’icône (icône seule)",
    it: "Adatta icona (solo icona)",
    nl: "Pictogram passend (alleen pictogram)",
    pt: "Ajustar ícone (só ícone)",
    ru: "Подгонка значка (только значок)",
    el: "Προσαρμογή εικονιδίου (μόνο εικονίδιο)",
    zh: "图标适配（仅图标）",
    ro: "Potrivire pictogramă (doar pictogramă)",
  },
  "Slider switch (ms)": {
    de: "Schiebereglerwechsel (ms)",
    fr: "Changement de curseur (ms)",
    it: "Cambio slider (ms)",
    nl: "Schuifregelaarwissel (ms)",
    pt: "Mudança de controlo deslizante (ms)",
    ru: "Переключение ползунка (мс)",
    el: "Εναλλαγή ρυθμιστή (ms)",
    zh: "滑块切换（毫秒）",
    ro: "Comutare cursor (ms)",
  },
  "Slider horizontal shrink": {
    de: "Horizontale Schieberegler-Stauchung",
    fr: "Rétrécissement horizontal du curseur",
    it: "Compressione orizzontale slider",
    nl: "Horizontaal krimpen schuifregelaar",
    pt: "Encolhimento horizontal do controlo deslizante",
    ru: "Горизонтальное сжатие ползунка",
    el: "Οριζόντια σύσφιξη ρυθμιστή",
    zh: "滑块水平收缩",
    ro: "Micșorare orizontală cursor",
  },
  "Color controls": {
    de: "Farbsteuerung",
    fr: "Contrôles de couleur",
    it: "Controlli colore",
    nl: "Kleurinstellingen",
    pt: "Controlos de cor",
    ru: "Управление цветом",
    el: "Χρωματικά στοιχεία ελέγχου",
    zh: "颜色控件",
    ro: "Comenzi culoare",
  },
  "More info": {
    de: "Mehr Infos",
    fr: "Plus d’infos",
    it: "Altre informazioni",
    nl: "Meer info",
    pt: "Mais informações",
    ru: "Подробнее",
    el: "Περισσότερα",
    zh: "更多信息",
    ro: "Mai multe informații",
  },
  "Call service": {
    de: "Dienst aufrufen",
    fr: "Appeler le service",
    it: "Chiama servizio",
    nl: "Service aanroepen",
    pt: "Chamar serviço",
    ru: "Вызвать службу",
    el: "Κλήση υπηρεσίας",
    zh: "调用服务",
    ro: "Apelează serviciul",
  },
  "Pin to screen": {
    de: "Am Bildschirm fixieren",
    fr: "Épingler à l’écran",
    it: "Blocca sullo schermo",
    nl: "Aan scherm vastmaken",
    pt: "Fixar ao ecrã",
    ru: "Закрепить на экране",
    el: "Καρφίτσωμα στην οθόνη",
    zh: "固定到屏幕",
    ro: "Fixare pe ecran",
  },
  "Also show on desktop": {
    de: "Auch auf dem Desktop anzeigen",
    fr: "Afficher aussi sur le bureau",
    it: "Mostra anche sul desktop",
    nl: "Ook op desktop tonen",
    pt: "Mostrar também no ambiente de trabalho",
    ru: "Показывать и на компьютере",
    el: "Εμφάνιση και στην επιφάνεια εργασίας",
    zh: "在桌面端也显示",
    ro: "Afișează și pe desktop",
  },
  "Card border": {
    de: "Kartenrand",
    fr: "Bordure de la carte",
    it: "Bordo scheda",
    nl: "Kaartrand",
    pt: "Borda do cartão",
    ru: "Граница карточки",
    el: "Περίγραμμα κάρτας",
    zh: "卡片边框",
    ro: "Chenar card",
  },
  Label: {
    de: "Beschriftung",
    fr: "Étiquette",
    it: "Etichetta",
    nl: "Label",
    pt: "Etiqueta",
    ru: "Подпись",
    el: "Ετικέτα",
    zh: "标签",
    ro: "Etichetă",
  },
  "Main entity": {
    de: "Hauptentität",
    fr: "Entité principale",
    it: "Entità principale",
    nl: "Hoofdentiteit",
    pt: "Entidade principal",
    ru: "Основной объект",
    el: "Κύρια οντότητα",
    zh: "主实体",
    ro: "Entitate principală",
  },
};

function pickNewLang(rowEn, mergedVal, compactFn) {
  if (mergedVal !== undefined && mergedVal !== "") {
    return mergedVal;
  }
  if (isCompactUiEnglish(rowEn)) {
    return compactFn(rowEn);
  }
  return rowEn;
}

function applyFullLocaleByEn(row) {
  const patch = FULL_LOCALE_BY_EN[row.en];
  const extra = EDITOR_EXTRA_FULL_LOCALE_BY_EN[row.en];
  const phrase = EDITOR_PHRASE_LANGS[row.en];
  /** editor-extra → phrase overlays (Show/long hints) → FULL_LOCALE wins for climate card. */
  const merged = { ...(extra || {}), ...(phrase || {}), ...(patch || {}) };
  return {
    ...row,
    de: merged.de !== undefined ? merged.de : row.de,
    fr: merged.fr !== undefined ? merged.fr : row.fr,
    it: merged.it !== undefined ? merged.it : row.it,
    nl: merged.nl !== undefined ? merged.nl : row.nl,
    no: pickNewLang(row.en, merged.no, enToNo),
    pt: pickNewLang(row.en, merged.pt, enToPt),
    ru: pickNewLang(row.en, merged.ru, enToRu),
    el: pickNewLang(row.en, merged.el, enToEl),
    zh: pickNewLang(row.en, merged.zh, enToZh),
    ro: pickNewLang(row.en, merged.ro, enToRo),
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
    no: enToNo(en),
    pt: enToPt(en),
    ru: enToRu(en),
    el: enToEl(en),
    zh: enToZh(en),
    ro: enToRo(en),
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
        no: r.no,
        pt: r.pt,
        ru: r.ru,
        el: r.el,
        zh: r.zh,
        ro: r.ro,
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
  const ROWS_JSON = ${JSON.stringify(JSON.stringify(dedupedRows))};
  const EDITOR_CATALOG_JSON = ${JSON.stringify(JSON.stringify(EDITOR_CATALOG))};
  let ROWS_CACHE = null;
  let MAP_CACHE = null;
  let EDITOR_CATALOG_CACHE = null;
  let FOLD_TO_CANONICAL_ES_CACHE = null;

  function getRows() {
    if (!ROWS_CACHE) {
      ROWS_CACHE = JSON.parse(ROWS_JSON);
    }
    return ROWS_CACHE;
  }

  function buildMap(lang) {
    const m = {};
    for (const r of getRows()) {
      m[r.es] = r[lang];
    }
    return m;
  }

  const EDITOR_LANGS = ["en", "de", "fr", "it", "nl", "no", "pt", "ru", "el", "zh", "ro"];
  function getEditorUiMaps() {
    if (MAP_CACHE) {
      return MAP_CACHE;
    }
    const map = { es: {} };
    for (const L of EDITOR_LANGS) {
      map[L] = buildMap(L);
    }
    for (const r of getRows()) {
      map.es[r.es] = r.es;
    }
    MAP_CACHE = map;
    window.NodaliaI18n.editorUiMaps = map;
    return map;
  }

  function foldEditorUiKey(s) {
    try {
      return String(s || "")
        .normalize("NFD")
        .replace(/\\p{M}/gu, "")
        .trim()
        .toLowerCase();
    } catch (_e) {
      return String(s || "")
        .toLowerCase()
        .trim();
    }
  }

  function getEditorUiFoldToCanonicalEs() {
    if (FOLD_TO_CANONICAL_ES_CACHE) {
      return FOLD_TO_CANONICAL_ES_CACHE;
    }
    const map = new Map();
    for (const r of getRows()) {
      const canon = r.es;
      if (typeof canon !== "string" || !canon) {
        continue;
      }
      const f = foldEditorUiKey(canon);
      if (!map.has(f)) {
        map.set(f, canon);
      }
    }
    FOLD_TO_CANONICAL_ES_CACHE = map;
    return map;
  }

  function getEditorCatalog() {
    if (!EDITOR_CATALOG_CACHE) {
      EDITOR_CATALOG_CACHE = JSON.parse(EDITOR_CATALOG_JSON);
      window.NodaliaI18n.editorCatalog = EDITOR_CATALOG_CACHE;
    }
    return EDITOR_CATALOG_CACHE;
  }

  window.NodaliaI18n.editorUiMaps = null;
  window.NodaliaI18n.editorCatalog = null;

  function normalizeSpanishEditorLabel(text) {
    let out = String(text || "");
    if (!out) {
      return out;
    }

    const withMatchCase = (match, replacement) => {
      if (match === match.toUpperCase()) {
        return replacement.toUpperCase();
      }
      if (match[0] === match[0].toUpperCase()) {
        return replacement[0].toUpperCase() + replacement.slice(1);
      }
      return replacement;
    };

    const substitutions = [
      [/\\banimaciones\\b/gi, "animaciones"],
      [/\\banimacion\\b/gi, "animación"],
      [/\\bconfiguraciones\\b/gi, "configuraciones"],
      [/\\bconfiguracion\\b/gi, "configuración"],
      [/\\bgraficas\\b/gi, "gráficas"],
      [/\\bgrafica\\b/gi, "gráfica"],
      [/\\blogica\\b/gi, "lógica"],
      [/\\bmaximo(s)?\\b/gi, "máximo$1"],
      [/\\bminimo(s)?\\b/gi, "mínimo$1"],
      [/\\bmusica\\b/gi, "música"],
      [/\\bnavegacion\\b/gi, "navegación"],
      [/\\bnumero(s)?\\b/gi, "número$1"],
      [/\\bpanel(es)?\\b/gi, "panel$1"],
      [/\\bpequeno\\b/gi, "pequeño"],
      [/\\bpulsacion\\b/gi, "pulsación"],
      [/\\bsecciones\\b/gi, "secciones"],
      [/\\bseccion\\b/gi, "sección"],
      [/\\btamano(s)?\\b/gi, "tamaño$1"],
      [/\\btecnica\\b/gi, "técnica"],
      [/\\btecnicas\\b/gi, "técnicas"],
      [/\\bversiones\\b/gi, "versiones"],
      [/\\bversion\\b/gi, "versión"],
      [/\\banadir\\b/gi, "añadir"],
      [/\\banade\\b/gi, "añade"],
      [/\\bano(s)?\\b/gi, "año$1"],
      [/\\btitulos\\b/gi, "títulos"],
      [/\\btitulo\\b/gi, "título"],
      [/\\benergias\\b/gi, "energías"],
      [/\\benergia\\b/gi, "energía"],
      [/\\bcodigos\\b/gi, "códigos"],
      [/\\bcodigo\\b/gi, "código"],
      [/\\btactil\\b/gi, "táctil"],
      [/\\bhaptica\\b/gi, "háptica"],
      [/\\binformacion\\b/gi, "información"],
      [/\\btransicion\\b/gi, "transición"],
      [/\\bubicacion\\b/gi, "ubicación"],
      [/\\bfuncion\\b/gi, "función"],
      [/\\bopcion\\b/gi, "opción"],
      [/\\bseleccion\\b/gi, "selección"],
      [/\\breaccion\\b/gi, "reacción"],
      [/\\baccion\\b/gi, "acción"],
      [/\\bmetodos\\b/gi, "métodos"],
      [/\\bmetodo\\b/gi, "método"],
      [/\\bautomaticos\\b/gi, "automáticos"],
      [/\\bautomatico\\b/gi, "automático"],
      [/\\bautomaticas\\b/gi, "automáticas"],
      [/\\bautomatica\\b/gi, "automática"],
      [/\\bduracion\\b/gi, "duración"],
      [/\\bposicion\\b/gi, "posición"],
      [/\\bbasicos\\b/gi, "básicos"],
      [/\\bbasico\\b/gi, "básico"],
      [/\\bbasicas\\b/gi, "básicas"],
      [/\\bbasica\\b/gi, "básica"],
      [/\\bgenericos\\b/gi, "genéricos"],
      [/\\bgenerico\\b/gi, "genérico"],
      [/\\bgenericas\\b/gi, "genéricas"],
      [/\\bgenerica\\b/gi, "genérica"],
    ];

    substitutions.forEach(([pattern, replacement]) => {
      out = out.replace(pattern, (match, ...rest) => {
        const groups = rest.slice(0, -2);
        const expanded = String(replacement).replace(/\\$(\\d+)/g, (_, groupIndexRaw) => {
          const groupIndex = Number(groupIndexRaw) - 1;
          return groups[groupIndex] ?? "";
        });
        return withMatchCase(match, expanded);
      });
    });

    // Clean up legacy literal replacement artifacts left by earlier generator versions.
    out = out.replace(/\\$(\\d+)/g, "");

    return out;
  }

  window.NodaliaI18n.editorStr = function editorStr(hass, configLang, spanishText) {
    if (spanishText == null || spanishText === "") {
      return "";
    }
    const rawInput = String(spanishText);
    const lang = window.NodaliaI18n.resolveLanguage(hass, configLang);
    if (rawInput.startsWith("ed.")) {
      const cat = getEditorCatalog();
      if (cat && typeof cat === "object") {
        const order = [lang, "en", "es"];
        const seen = new Set();
        for (const L of order) {
          if (!L || seen.has(L)) {
            continue;
          }
          seen.add(L);
          const pack = cat[L];
          const v = pack && pack[rawInput];
          if (typeof v === "string" && v !== "") {
            return v;
          }
        }
      }
      return rawInput;
    }
    const maps = getEditorUiMaps();
    const resolveEditorUiKey = () => {
      const candidates = [rawInput, normalizeSpanishEditorLabel(rawInput)];
      for (const c of candidates) {
        if (maps.es[c] !== undefined || maps.en[c] !== undefined) {
          return c;
        }
      }
      for (const c of candidates) {
        const canon = getEditorUiFoldToCanonicalEs().get(foldEditorUiKey(c));
        if (canon && (maps.es[canon] !== undefined || maps.en[canon] !== undefined)) {
          return canon;
        }
      }
      return rawInput;
    };
    const key = resolveEditorUiKey();
    if (maps.es[key] === undefined && maps.en[key] === undefined) {
      return lang === "es" ? normalizeSpanishEditorLabel(rawInput) : rawInput;
    }
    const primary = maps[lang]?.[key];
    if (primary !== undefined && primary !== "") {
      return lang === "es" ? normalizeSpanishEditorLabel(primary) : primary;
    }
    if (lang !== "es") {
      const enVal = maps.en?.[key];
      if (enVal !== undefined && enVal !== "") {
        return enVal;
      }
    }
    const esVal = maps.es?.[key];
    if (esVal !== undefined && esVal !== "") {
      return normalizeSpanishEditorLabel(esVal);
    }
    return lang === "es" ? normalizeSpanishEditorLabel(rawInput) : rawInput;
  };
})();
`;

fs.writeFileSync(path.join(root, "nodalia-editor-ui.js"), out);
console.log("Wrote nodalia-editor-ui.js", dedupedRows.length, "strings");
