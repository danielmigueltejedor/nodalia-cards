/**
 * Wraps static <span>...</span> in NodaliaNavigationBarEditor with this._L("...").
 * Run: node scripts/wrap-nav-editor-spans.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const file = path.join(root, "nodalia-navigation-bar.js");
const s = fs.readFileSync(file, "utf8");

const start = s.indexOf("class NodaliaNavigationBarEditor extends HTMLElement");
const end = s.indexOf("if (!customElements.get(CARD_TAG))", start);
const before = s.slice(0, start);
let c = s.slice(start, end);
const after = s.slice(end);

const SPANS = [
  "Altura minima media player",
  "Tamano etiqueta popup",
  "Tamano minimo badge",
  "Mostrar tambien en escritorio",
  "Marcar activa por prefijo",
  "Fallback con vibracion",
  "Altura minima",
  "Ancho maximo barra",
  "Ancho maximo popup",
  "Ancho minimo popup",
  "Barra y hover (ms)",
  "Breakpoint movil",
  "Color etiqueta activa",
  "Etiqueta opcional",
  "Estilo haptico",
  "Fijar a pantalla",
  "Icono fallback",
  "Layout popup",
  "Media player (ms)",
  "Mostrar etiquetas",
  "Nombre reproductor",
  "Offset icono X",
  "Offset icono Y",
  "Path activo extra",
  "Radio media player",
  "Reservar espacio",
  "Respuesta botones (ms)",
  "Respuesta haptica",
  "Ruta medios",
  "Separacion botones",
  "Separacion con navbar",
  "Separacion etiqueta",
  "Separacion popup",
  "Separacion stack",
  "Sombra media player",
  "Tamano controles",
  "Tamano etiqueta",
  "Tamano indicadores",
  "Tamano item popup",
  "Tamano portada",
  "Tamano subtitulo",
  "Tamano texto badge",
  "Tamano titulo",
  "Usar caratula de fondo",
  "Veladura popup",
  "Activar animaciones",
  "Altura reservada",
  "Backdrop filter",
  "Borde media player",
  "Color etiqueta",
  "Color progreso",
  "Descripcion",
  "Estados visibles",
  "Fondo media player",
  "Fondo progreso",
  "Imagen fija",
  "Justificacion",
  "Margen lateral",
  "Mostrar siempre",
  "Overlay portada",
  "Padding media player",
  "Paths activos",
  "Radio boton",
  "Sombra barra",
  "Sombra popup",
  "Tamano boton",
  "Tamano icono",
  "Activa por prefijo",
  "Color botones",
  "Fondo botones",
  "Fondo popup",
  "Padding popup",
  "Popup (ms)",
  "Radio popup",
  "Borde popup",
  "Color activo",
  "Color badge",
  "Fondo activo",
  "Fondo badge",
  "Fondo barra",
  "Padding barra",
  "Radio barra",
  "Usuarios",
  "Entidad",
  "Etiqueta",
  "Subtitulo",
  "Titulo",
  "Icono",
  "Path",
  "Posicion",
  "Z-index",
  "Offset",
];

for (const text of SPANS) {
  const plain = `<span>${text}</span>`;
  const esc = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const wrapped = `<span>\${this._L("${esc}")}</span>`;
  if (!c.includes(plain)) continue;
  if (c.includes(wrapped)) continue;
  c = c.split(plain).join(wrapped);
}

c = c.replace(
  /\$\{this\._showStyleSection \? "Ocultar ajustes de estilo" : "Mostrar ajustes de estilo"\}/g,
  '${this._showStyleSection ? this._L("Ocultar ajustes de estilo") : this._L("Mostrar ajustes de estilo")}',
);
c = c.replace(
  /\$\{this\._showAnimationSection \? "Ocultar ajustes de animación" : "Mostrar ajustes de animación"\}/g,
  '${this._showAnimationSection ? this._L("Ocultar ajustes de animación") : this._L("Mostrar ajustes de animación")}',
);

for (const display of ["Anadir ruta", "Anadir player", "Anadir popup", "Subir", "Bajar", "Eliminar"]) {
  const esc = display.replace(/"/g, '\\"');
  c = c.split(`>${display}<`).join(`>\${this._L("${esc}")}<`);
}

c = c.replace("<strong>Popup</strong>", "<strong>${this._L(\"Popup\")}</strong>");
c = c.replace("<strong>Player ${index + 1}</strong>", "<strong>${this._L(\"Player\")} ${index + 1}</strong>");
c = c.replace("<strong>Ruta ${index + 1}</strong>", "<strong>${this._L(\"Ruta\")} ${index + 1}</strong>");
c = c.replace("<strong>Popup ${popupIndex + 1}</strong>", "<strong>${this._L(\"Popup\")} ${popupIndex + 1}</strong>");

c = c.replace(
  "${playersMarkup || '<p class=\"hint\">No hay reproductores configurados.</p>'}",
  "${playersMarkup || `<p class=\"hint\">${this._L(\"No hay reproductores configurados.\")}</p>`}",
);
c = c.replace(
  "${routesMarkup || '<p class=\"hint\">No hay rutas todavia.</p>'}",
  "${routesMarkup || `<p class=\"hint\">${this._L(\"No hay rutas todavia.\")}</p>`}",
);
c = c.replace(
  ": '<p class=\"hint\">Esta ruta no tiene popup todavia.</p>';",
  ": `<p class=\"hint\">${this._L(\"Esta ruta no tiene popup todavia.\")}</p>`;",
);

fs.writeFileSync(file, before + c + after);
console.log("wrap-nav-editor-spans done");
