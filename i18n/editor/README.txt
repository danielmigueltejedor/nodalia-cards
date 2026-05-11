Editor visual i18n (new path)
==============================

Stable keys:  ed.<card>.<slug>   (example: ed.calendar.visible_range)

Source files (per language, same keys in every file):
  i18n/editor/en.json   — canonical English (required)
  i18n/editor/es.json   — Spanish
  i18n/editor/zh.json   — Chinese
  i18n/editor/de.json, fr.json, it.json, nl.json, pt.json, ru.json, el.json, ro.json — same keys (validated)
  Any editor catalog language without a file still merges English at build time.

In card editors, use the same helper as before:
  this._editorLabel("ed.calendar.visible_range")

Build pipeline:
  1) node scripts/validate-editor-i18n.mjs   — all locale files must list the same keys as en.json
  2) node scripts/gen-editor-ui.mjs          — embeds window.NodaliaI18n.editorCatalog + legacy ROWS map
  3) npm run bundle

Adding a new language (e.g. Japanese):
  - Add "ja" to EDITOR_CATALOG_LANGS in scripts/gen-editor-ui.mjs and ensure nodalia-i18n PACK supports "ja" for resolveLanguage.
  - Copy i18n/editor/en.json to i18n/editor/ja.json and translate values.
  - Run validate + gen-editor + bundle.

Legacy: strings without the "ed." prefix still use the generated ROWS table (Spanish keys → locales) until migrated card-by-card.

Migrated editors (ed.* + JSON): calendar, weather, notifications, entity, person, vacuum, light, fav, media player.

Catalog shards (merged by scripts/merge-editor-catalog-additions.mjs): scripts/data/editor-catalog-*.json
