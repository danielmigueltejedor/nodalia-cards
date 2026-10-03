Visual editor i18n — Nodalia Cards 3
===================================

Canonical source: i18n/editor/<lang>.json.
English uses stable ed.<card>.<slug> keys; all supported locale files must
contain the same keys and preserve placeholders/code spans.

Build:
  pnpm i18n:validate-editor
  pnpm i18n:gen-editor
  pnpm i18n:audit
  pnpm bundle

The generator writes src/shared/editor-i18n-data.ts and compiles the checked
lookup in src/shared/editor-i18n-runtime.ts into nodalia-editor-ui.js.
All 25 editors use the same lazy catalog/legacy row lookup. Non-ed.* labels
still use supported generator row inputs; retired catalog shards are not needed.
Commit locale JSON, generated TS, root lookup artifacts, bundle and manifest.

New languages require updating generator/runtime/audit language inventories,
translating both runtime and editor catalogs, and registering Weblate components.
See ../../docs/TRANSLATIONS.md for complete instructions.

Community translations: https://translate.getnodalia.com
Operator docs: ../../docs/weblate/README.md
