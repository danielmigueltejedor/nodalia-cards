/**
 * Inserts _editorLabel and wraps labels in editor _render* helpers (per HTMLElement class chunk).
 * Run: node scripts/patch-editor-i18n.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const EDITOR_LABEL = `  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    const hass = this._hass ?? this.hass;
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", s);
  }

`;

const FILES = [
  "nodalia-fav-card.js",
  "nodalia-person-card.js",
  "nodalia-fan-card.js",
  "nodalia-vacuum-card.js",
  "nodalia-alarm-panel-card.js",
  "nodalia-weather-card.js",
  "nodalia-circular-gauge-card.js",
  "nodalia-humidifier-card.js",
  "nodalia-light-card.js",
  "nodalia-media-player.js",
  "nodalia-insignia-card.js",
  "nodalia-advance-vacuum-card.js",
  "nodalia-graph-card.js",
  "nodalia-power-flow-card.js",
  "nodalia-climate-card.js",
];

function findMatchingBrace(src, openBraceIdx) {
  let depth = 0;
  for (let i = openBraceIdx; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Opening `{` of the method body: last `{` on the signature line (avoids `options = {}` in params). */
function methodBodyOpenBrace(methodSrc) {
  const nl = methodSrc.indexOf("\n");
  const firstLine = nl < 0 ? methodSrc : methodSrc.slice(0, nl);
  const lastOpen = firstLine.lastIndexOf("{");
  return lastOpen < 0 ? -1 : lastOpen;
}

function methodRange(content, sigStart) {
  const relOpen = methodBodyOpenBrace(content.slice(sigStart));
  if (relOpen < 0) return null;
  const braceOpen = sigStart + relOpen;
  const braceClose = findMatchingBrace(content, braceOpen);
  if (braceClose < 0) return null;
  return { start: sigStart, end: braceClose + 1 };
}

function injectTLabel(methodSrc) {
  if (methodSrc.includes("const tLabel = this._editorLabel(label)")) {
    return methodSrc;
  }
  if (!/\(label[,)]/.test(methodSrc)) {
    return methodSrc;
  }
  const open = methodBodyOpenBrace(methodSrc);
  if (open < 0) {
    return methodSrc;
  }
  return `${methodSrc.slice(0, open + 1)}\n    const tLabel = this._editorLabel(label);${methodSrc.slice(open + 1)}`;
}

function replaceLabelEscapes(methodSrc) {
  return methodSrc.replace(/escapeHtml\(label\)/g, "escapeHtml(tLabel)");
}

function patchColorMethod(methodSrc) {
  if (methodSrc.includes("const tLabel = this._editorLabel(label)")) {
    let m = methodSrc;
    if (!m.includes("const tColorCustom = this._editorLabel(\"Color personalizado\")")) {
      const open = methodBodyOpenBrace(m);
      if (open >= 0) {
        m = `${m.slice(0, open + 1)}\n    const tColorCustom = this._editorLabel("Color personalizado");${m.slice(open + 1)}`;
      }
    }
    m = m.replace(/escapeHtml\(label\)/g, "escapeHtml(tLabel)");
    m = m.replace(/title="Color personalizado"/g, 'title="${escapeHtml(tColorCustom)}"');
    return m;
  }
  const open = methodBodyOpenBrace(methodSrc);
  if (open < 0) {
    return methodSrc;
  }
  let m = `${methodSrc.slice(0, open + 1)}\n    const tLabel = this._editorLabel(label);\n    const tColorCustom = this._editorLabel("Color personalizado");${methodSrc.slice(open + 1)}`;
  m = m.replace(/escapeHtml\(label\)/g, "escapeHtml(tLabel)");
  m = m.replace(/title="Color personalizado"/g, 'title="${escapeHtml(tColorCustom)}"');
  return m;
}

function patchSelectMethod(methodSrc) {
  let m = injectTLabel(methodSrc);
  m = replaceLabelEscapes(m);
  m = m.replace(/\$\{escapeHtml\(option\.label\)\}/g, "${escapeHtml(this._editorLabel(option.label))}");
  return m;
}

function patchPlainLabelMethod(methodSrc) {
  let m = injectTLabel(methodSrc);
  return replaceLabelEscapes(m);
}

function collectSignatureStarts(content, sig) {
  const out = [];
  let from = 0;
  while (true) {
    const i = content.indexOf(sig, from);
    if (i < 0) break;
    out.push(i);
    from = i + sig.length;
  }
  return out;
}

function patchClassChunk(chunk) {
  const hasRender = chunk.includes("_renderTextField(label, field, value, options = {}) {")
    || chunk.includes("_renderTextField(label, path, value = \"\", options = {}) {");
  if (!hasRender || chunk.includes("_editorLabel(s)")) {
    return chunk;
  }

  const insertAt = chunk.indexOf("  _renderTextField(label,");
  if (insertAt < 0) return chunk;
  let full = chunk.slice(0, insertAt) + EDITOR_LABEL + chunk.slice(insertAt);

  const jobs = [];

  const pushJobs = (sig, kind) => {
    for (const st of collectSignatureStarts(full, sig)) {
      jobs.push({ start: st, kind });
    }
  };

  pushJobs("  _renderTextField(label, field, value, options = {}) {", "text");
  pushJobs("  _renderTextField(label, path, value = \"\", options = {}) {", "text");
  pushJobs("  _renderTextareaField(label, field, value, options = {}) {", "plain");
  pushJobs("  _renderColorField(label, field, value, options = {}) {", "color");
  pushJobs("  _renderCheckboxField(label, field, checked) {", "plain");
  pushJobs("  _renderCheckboxField(label, field, checked, options = {}) {", "plain");
  pushJobs("  _renderSelectField(label, field, value, options, renderOptions = {}) {", "select");
  pushJobs("  _renderSelectField(label, field, value, options) {", "select");
  pushJobs("  _renderSelectField(label, field, value, options, valueType = \"string\") {", "select");
  pushJobs("  _renderEntityPickerField(label, field, value, options = {}) {", "plain");
  pushJobs("  _renderFanEntityField(label, field, value, options = {}) {", "plain");
  pushJobs("  _renderIconPickerField(label, field, value, options = {}) {", "plain");
  pushJobs("  _renderEntityField(label, field, value, options = {}) {", "plain");

  jobs.sort((a, b) => b.start - a.start);

  for (const { start, kind } of jobs) {
    const range = methodRange(full, start);
    if (!range) continue;
    const oldText = full.slice(range.start, range.end);
    let next = oldText;
    if (kind === "color") next = patchColorMethod(oldText);
    else if (kind === "select") next = patchSelectMethod(oldText);
    else if (kind === "text" || kind === "plain") next = patchPlainLabelMethod(oldText);
    if (next !== oldText) {
      full = full.slice(0, range.start) + next + full.slice(range.end);
    }
  }

  // Second _renderTextField variant (graph editor): multiline branch
  const altNeedle = "  _renderTextField(label, field, value, options = {}) {\n    const tag = options.multiline";
  if (full.includes(altNeedle) && !full.includes("const tLabel = this._editorLabel(label);\n    const tag = options.multiline")) {
    full = full.replace(
      altNeedle,
      "  _renderTextField(label, field, value, options = {}) {\n    const tLabel = this._editorLabel(label);\n    const tag = options.multiline",
    );
    full = full.replace(
      /<span>\$\{escapeHtml\(label\)\}<\/span>/g,
      "<span>${escapeHtml(tLabel)}</span>",
    );
  }

  return full;
}

function patchFile(filePath) {
  const abs = path.join(root, filePath);
  if (!fs.existsSync(abs)) {
    console.warn("missing", filePath);
    return;
  }
  let content = fs.readFileSync(abs, "utf8");
  if (content.includes("_editorLabel(s)")) {
    console.log("skip", filePath);
    return;
  }

  const classRe = /\nclass ([A-Za-z0-9_]+) extends HTMLElement \{/g;
  const starts = [];
  let m;
  while ((m = classRe.exec(content))) {
    starts.push(m.index + 1);
  }
  if (!starts.length) {
    console.log("no class", filePath);
    return;
  }
  starts.push(content.length);

  let out = content.slice(0, starts[0]);
  for (let i = 0; i < starts.length - 1; i++) {
    out += patchClassChunk(content.slice(starts[i], starts[i + 1]));
  }

  if (out === content) {
    console.log("unchanged", filePath);
    return;
  }
  fs.writeFileSync(abs, out);
  console.log("patched", filePath);
}

for (const f of FILES) {
  patchFile(f);
}
