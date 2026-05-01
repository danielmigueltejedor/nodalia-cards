/**
 * Wraps editor-section titles and hints with escapeHtml(this._editorLabel("…")).
 * Skips lines that already call _editorLabel. Run: node scripts/wrap-editor-section-i18n.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const FILES = fs
  .readdirSync(root)
  .filter(n => n.startsWith("nodalia-") && n.endsWith(".js") && n !== "nodalia-cards.js" && n !== "nodalia-editor-ui.js");

function wrap(content) {
  if (!content.includes("_editorLabel(s)")) {
    return content;
  }
  let c = content;
  const titleRe = /<div class="editor-section__title">([^<${]+)<\/div>/g;
  c = c.replace(titleRe, (match, text) => {
    if (match.includes("_editorLabel")) return match;
    const esc = String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `<div class="editor-section__title">\${escapeHtml(this._editorLabel("${esc}"))}</div>`;
  });
  const hintRe = /<div class="editor-section__hint">([^<${]+)<\/div>/g;
  c = c.replace(hintRe, (match, text) => {
    if (match.includes("_editorLabel")) return match;
    const esc = String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `<div class="editor-section__hint">\${escapeHtml(this._editorLabel("${esc}"))}</div>`;
  });
  return c;
}

for (const name of FILES) {
  const abs = path.join(root, name);
  const raw = fs.readFileSync(abs, "utf8");
  const next = wrap(raw);
  if (next !== raw) {
    fs.writeFileSync(abs, next);
    console.log("section i18n:", name);
  }
}
