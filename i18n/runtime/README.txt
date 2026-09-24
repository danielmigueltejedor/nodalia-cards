Runtime card i18n
=================

Weblate (self-hosted community translations): https://translate.getnodalia.com
Operator docs: ../../docs/weblate/README.md
Contributor guide: ../../docs/TRANSLATIONS.md

Canonical source language: English
  i18n/runtime/en.json

Per-locale nested JSON (same tree as en.json):
  i18n/runtime/<lang>.json

Build pipeline:
  1) node scripts/validate-runtime-i18n.mjs
  2) node scripts/gen-runtime-i18n.mjs   — embeds const PACK in nodalia-i18n.js
  3) pnpm run i18n:audit
  4) pnpm run bundle
