#!/usr/bin/env node
/**
 * Standardize collapsible "Tap actions" editor sections across all card editors.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content);
}

function ensureTapState(s) {
  if (s.includes("this._showTapActionsSection = false")) {
    return s;
  }
  if (s.includes("this._showAnimationSection = false;")) {
    return s.replace(
      "this._showAnimationSection = false;\n",
      "this._showAnimationSection = false;\n    this._showTapActionsSection = false;\n",
      1,
    );
  }
  if (s.includes("this._showStyleSection = false;")) {
    return s.replace(
      "this._showStyleSection = false;\n",
      "this._showStyleSection = false;\n    this._showTapActionsSection = false;\n",
      1,
    );
  }
  return s.replace(
    /(class \w+Editor extends HTMLElement \{\s*\n\s*constructor\(\) \{\s*\n\s*super\(\);)/,
    "$1\n    this._showTapActionsSection = false;",
    1,
  );
}

function ensureTapHandler(s) {
  if (s.includes('case "tap_actions":')) {
    return s;
  }
  if (s.includes('case "styles":')) {
    return s.replace(
      '      case "styles":',
      `      case "tap_actions":
        this._showTapActionsSection = !this._showTapActionsSection;
        this._render();
        break;
      case "styles":`,
      1,
    );
  }
  if (s.includes('toggleButton.dataset.editorToggle === "styles"')) {
    return s.replace(
      'if (toggleButton.dataset.editorToggle === "styles")',
      'if (toggleButton.dataset.editorToggle === "tap_actions") this._showTapActionsSection = !this._showTapActionsSection;\n    else if (toggleButton.dataset.editorToggle === "styles")',
      1,
    );
  }
  return s;
}

function headerBlock(hintKey, gridClass = "editor-grid editor-grid--stacked") {
  return `        <section class="editor-section">
          \${window.NodaliaUtils.renderEditorCollapsibleSectionHeaderHtml({
            titleKey: "ed.light.tap_actions_section_title",
            hintKey: "${hintKey}",
            toggleId: "tap_actions",
            expanded: this._showTapActionsSection === true,
            escapeHtml,
            editorLabel: (key) => this._editorLabel(key),
          })}
          \${
            this._showTapActionsSection
              ? \`
          <div class="${gridClass}">`;
}

const sectionClose = `          </div>
              \`
              : ""
          }
        </section>

`;

function extractAndWrap(file, { removeStart, removeEnd, insertBefore, hintKey, gridClass }) {
  let s = read(file);
  if (s.includes('toggleId: "tap_actions"') && !removeStart) {
    console.log("skip (has tap collapse):", file);
    return false;
  }
  const block = s.slice(s.indexOf(removeStart), s.indexOf(removeEnd, s.indexOf(removeStart)) + removeEnd.length);
  if (!block.includes(removeStart)) {
    console.warn("extract failed:", file);
    return false;
  }
  s = s.replace(block, "");
  const insert = headerBlock(hintKey, gridClass) + block.trimStart() + "\n" + sectionClose;
  if (!s.includes(insertBefore)) {
    console.warn("insert marker missing:", file, insertBefore.slice(0, 40));
    return false;
  }
  s = s.replace(insertBefore, insert + insertBefore, 1);
  s = ensureTapState(s);
  s = ensureTapHandler(s);
  write(file, s);
  console.log("patched:", file);
  return true;
}

function wrapExistingTapSection(file, hintKey) {
  let s = read(file);
  if (!s.includes('ed.light.tap_actions_section_title') || s.includes("renderEditorCollapsibleSectionHeaderHtml")) {
    if (s.includes("renderEditorCollapsibleSectionHeaderHtml")) {
      console.log("skip (standard header):", file);
    }
    return false;
  }
  const oldHeader = `          <div class="editor-section__header">
            <motion.div class="editor-section__title">\${escapeHtml(this._editorLabel("ed.light.tap_actions_section_title"))}</motion.div>`;
  const oldHeader2 = `          <div class="editor-section__header">
            <div class="editor-section__title">\${escapeHtml(this._editorLabel("ed.light.tap_actions_section_title"))}</motion.div>`;
  const newHeader = `          \${window.NodaliaUtils.renderEditorCollapsibleSectionHeaderHtml({
            titleKey: "ed.light.tap_actions_section_title",
            hintKey: "${hintKey}",
            toggleId: "tap_actions",
            expanded: this._showTapActionsSection === true,
            escapeHtml,
            editorLabel: (key) => this._editorLabel(key),
          })}`;
  if (s.includes(oldHeader2)) {
    s = s.replace(
      /          <div class="editor-section__header">\s*\n\s*<div class="editor-section__title">\$\{escapeHtml\(this\._editorLabel\("ed\.light\.tap_actions_section_title"\)\)\}<\/motion.div>\s*\n\s*<div class="editor-section__hint">\$\{escapeHtml\(this\._editorLabel\("[^"]+"\)\)\}<\/motion.div>\s*\n(?:\s*<div>\s*\n)?(?:\s*<div class="editor-section__actions">[\s\S]*?<\/motion.div>\s*\n)?\s*<\/motion.div>/,
      newHeader,
      1,
    );
  }
  write(file, s);
  console.log("wrapped header:", file);
  return true;
}

// --- Weather: move tap/hold/double out of general ---
extractAndWrap("nodalia-weather-card.js", {
  removeStart: '            ${this._renderSelectField(\n              "ed.weather.tap_action",',
  removeEnd: '              { fullWidth: true },\n            )}\n            ${this._renderSelectField(\n              "ed.weather.unit_system",',
  insertBefore: `        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">\${escapeHtml(this._editorLabel("ed.weather.forecast_section_title"))}`,
  hintKey: "ed.light.tap_actions_section_hint",
});

// --- Climate main editor ---
extractAndWrap("nodalia-climate-card.js", {
  removeStart: '            ${this._renderSelectField(\n              "ed.climate.tap_action",',
  removeEnd: '              { fullWidth: true },\n            )}\n\n          </motion.div>\n        </section>\n\n        <section class="editor-section">\n          <div class="editor-section__header">\n            <div class="editor-section__title">\${escapeHtml(this._editorLabel("ed.climate.display_section_title"))}',
  insertBefore: `        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">\${escapeHtml(this._editorLabel("ed.climate.display_section_title"))}`,
  hintKey: "ed.light.tap_actions_section_hint",
  gridClass: "editor-grid",
});

// Climate legacy (second editor class) - only if still has inline tap in general
{
  let s = read("nodalia-climate-card.js");
  const legacyMarker = 'class NodaliaClimateCardEditorLegacy';
  if (s.includes(legacyMarker) && s.includes('"ed.climate.tap_action"')) {
    const idx = s.indexOf(legacyMarker);
    const part = s.slice(idx);
    if (!part.includes('renderEditorCollapsibleSectionHeaderHtml') || part.indexOf('"ed.climate.tap_action"') < part.indexOf('renderEditorCollapsibleSectionHeaderHtml')) {
      extractAndWrap("nodalia-climate-card.js", {
        removeStart: '            ${this._renderSelectField(\n              "ed.climate.tap_action",',
        removeEnd: '              { fullWidth: true },\n            )}\n          </motion.div>\n        </section>\n\n        <section class="editor-section">\n          <div class="editor-section__header">\n            <div class="editor-section__title">\${escapeHtml(this._editorLabel("ed.climate.display_section_title"))}',
        insertBefore: `        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">\${escapeHtml(this._editorLabel("ed.climate.display_section_title"))}`,
        hintKey: "ed.light.tap_actions_section_hint",
      });
    }
  }
}

// --- Person ---
extractAndWrap("nodalia-person-card.js", {
  removeStart: '            ${this._renderSelectField(\n              "ed.entity.tap_action",',
  removeEnd: '              { fullWidth: true },\n            )}\n            ${this._renderCheckboxField("ed.person.show_location",',
  insertBefore: `        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">\${escapeHtml(this._editorLabel("ed.weather.animations_section_title"))}`,
  hintKey: "ed.light.tap_actions_section_hint",
});

// --- Circular gauge ---
extractAndWrap("nodalia-circular-gauge-card.js", {
  removeStart: '            ${this._renderSelectField(\n              "ed.entity.tap_action",',
  removeEnd: '              ],\n            )}\n          </motion.div>\n        </section>\n\n        <section class="editor-section">\n          <div class="editor-section__header">\n            <div class="editor-section__title">\${escapeHtml(this._editorLabel("ed.media_player.layout_section"))}',
  insertBefore: `        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">\${escapeHtml(this._editorLabel("ed.media_player.layout_section"))}`,
  hintKey: "ed.light.tap_actions_section_hint",
  gridClass: "editor-grid",
});

// --- Graph main ---
extractAndWrap("nodalia-graph-card.js", {
  removeStart: '            ${this._renderSelectField(\n              "ed.entity.tap_action",',
  removeEnd: '              ],\n            )}\n            ${this._renderTextField("Horas a mostrar",',
  insertBefore: '            ${this._renderTextField("Horas a mostrar",',
  hintKey: "ed.light.tap_actions_section_hint",
  gridClass: "editor-grid",
});

// --- Power flow ---
extractAndWrap("nodalia-power-flow-card.js", {
  removeStart: '            ${this._renderSelectField("ed.power_flow.card_tap_action",',
  removeEnd: '            ], { fullWidth: true })}\n            ${this._renderCheckboxField("ed.power_flow.show_header",',
  insertBefore: '            ${this._renderCheckboxField("ed.power_flow.show_header",',
  hintKey: "ed.light.tap_actions_section_hint",
});

// --- Fav: collapse existing action block ---
{
  let s = read("nodalia-fav-card.js");
  if (!s.includes('toggleId: "tap_actions"') && s.includes("ed.entity.action_block_title")) {
    s = ensureTapState(s);
    s = ensureTapHandler(s);
    s = s.replace(
      `        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">\${escapeHtml(this._editorLabel("ed.entity.action_block_title"))}</div>
            <div class="editor-section__hint">\${escapeHtml(this._editorLabel("ed.fav.action_section_hint"))}</div>
          </motion.div>
          <div class="editor-grid">`,
      headerBlock("ed.fav.action_section_hint", "editor-grid").replace(
        "ed.light.tap_actions_section_title",
        "ed.entity.action_block_title",
      ),
    );
    // fix title in header - use custom titleKey
    s = s.replace(
      'titleKey: "ed.light.tap_actions_section_title",\n            hintKey: "ed.fav.action_section_hint"',
      'titleKey: "ed.entity.action_block_title",\n            hintKey: "ed.fav.action_section_hint"',
    );
    const closeAt = s.indexOf(`        </section>

        <section class="editor-section">`, s.indexOf("ed.fav.tap_service_field"));
    if (closeAt > 0) {
      const gridEnd = s.lastIndexOf("          </motion.div>\n        </section>", closeAt);
      if (gridEnd > 0 && !s.slice(gridEnd - 80, gridEnd + 40).includes(": \"\"")) {
        s = `${s.slice(0, gridEnd)}${sectionClose}${s.slice(gridEnd + "          </motion.div>\n        </section>".length)}`;
      }
    }
    write("nodalia-fav-card.js", s);
    console.log("patched: nodalia-fav-card.js");
  }
}

// --- Media player: collapsible tap per player block ---
{
  let s = read("nodalia-media-player.js");
  if (!s.includes("this._showTapActionsSection = false")) {
    s = ensureTapState(s);
    s = ensureTapHandler(s);
    const needle = '${this._renderActionConfigFields("ed.media_player.tap_on_card"';
    if (s.includes(needle) && !s.includes("tap_actions_subsection")) {
      s = s.replace(
        needle,
        `<div class="editor-tap-actions-subsection editor-field--full">
          \${window.NodaliaUtils.renderEditorCollapsibleSectionHeaderHtml({
            titleKey: "ed.media_player.tap_on_card",
            hintKey: "ed.light.tap_actions_section_hint",
            toggleId: "tap_actions",
            expanded: this._showTapActionsSection === true,
            escapeHtml,
            editorLabel: (key) => this._editorLabel(key),
          })}
          \${this._showTapActionsSection ? \`\${this._renderActionConfigFields("ed.media_player.tap_on_card"`,
      );
      s = s.replace(
        '${this._renderActionConfigFields("ed.media_player.tap_on_card", `players.${index}.tap_action`, player.tap_action)}',
        '${this._renderActionConfigFields("ed.media_player.tap_on_card", `players.${index}.tap_action`, player.tap_action)}\` : ""}</div>',
      );
      write("nodalia-media-player.js", s);
      console.log("patched: nodalia-media-player.js");
    }
  }
}

// Refactor cards that use manual toggle to shared header
for (const [file, hint] of [
  ["nodalia-light-card.js", "ed.light.tap_actions_section_hint"],
  ["nodalia-fan-card.js", "ed.light.tap_actions_section_hint"],
  ["nodalia-entity-card.js", "ed.light.tap_actions_section_hint"],
  ["nodalia-vacuum-card.js", "ed.vacuum.tap_actions_section_hint"],
  ["nodalia-cover-card.js", "ed.light.tap_actions_section_hint"],
  ["nodalia-humidifier-card.js", "ed.humidifier.tap_actions_section_hint"],
  ["nodalia-insignia-card.js", "ed.insignia.tap_actions_section_hint"],
]) {
  let s = read(file);
  if (!s.includes("renderEditorCollapsibleToggleHtml({") || s.includes("renderEditorCollapsibleSectionHeaderHtml({")) {
    continue;
  }
  s = s.replace(
    /<div class="editor-section__header">[\s\S]*?data-editor-toggle="tap_actions"[\s\S]*?<\/div>\s*\n\s*<\/div>\s*\n\s*\$\{/,
    `\${window.NodaliaUtils.renderEditorCollapsibleSectionHeaderHtml({
            titleKey: "ed.light.tap_actions_section_title",
            hintKey: "${hint}",
            toggleId: "tap_actions",
            expanded: this._showTapActionsSection === true,
            escapeHtml,
            editorLabel: (key) => this._editorLabel(key),
          })}
          \$\{`,
    1,
  );
  write(file, s);
  console.log("refactored header:", file);
}

console.log("done");
