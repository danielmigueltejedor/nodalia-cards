# Adding a Nodalia card

Use Lock as the small checked example; preserve the existing public resource
contract rather than copying a large unchecked view/controller.

1. Create `src/cards/<id>/`: `<id>-card.ts`, `<id>-editor.ts`,
   `<id>-config.ts`, `<id>-types.ts` when needed, `index.ts`, `standalone.ts`.
   Extract styles/domain helpers only when they have an independent responsibility.
2. Define immutable tag names and re-export `CARD_VERSION` from `../../version`.
   Do not edit the generated version or root distribution files.
3. Normalize YAML at `setConfig`. Keep an input config type and a normalized
   type whose defaulted fields are required. Preserve unknown YAML options and
   old aliases deliberately; characterize defaults/migrations in tests.
4. Register the card and editor with `NodaliaUtils.defineLazyCustomElement`, then
   `registerCustomCard`. Provide `getConfigElement`, `getStubConfig`, and
   `getEntitySuggestion` with explicit supported domains. Include both runtime
   and visual-editor registration, including under lazy initialization.
5. Add one entry to `src/cards/registry.json`. Its artifact is the existing public
   filename, its entry is `index.ts`, and its standalone source imports `index`.
   Add the artifact to `package.json.files`; architecture tests enforce this.
6. Reuse HA/core types and existing service/navigation/focus/cleanup helpers.
   Do not add another global API without a typed declaration and compatibility
   reason. Pure domain modules should not require `window` or DOM initialization.
7. Use editor section/grid/field conventions; retain focus during HA updates.
   Fire bubbling, composed `config-changed` with `{ config }`. Guard absent HA
   entities and optional services; do not trigger services while rendering.
8. Put runtime text in every `i18n/runtime/*.json` locale and editor labels in
   the editor catalog. Generate and validate translations. Do not silently fall
   back to raw keys for new labels.
9. Add unit normalization/domain tests, a `createHassFixture({ entities })` case
   under `tests/fixtures/hass.ts` consumers, and Playwright render/editor/action
   coverage. Include missing/unavailable state, reconnect, small width, WebKit,
   keyboard, and relevant overlay/gesture behavior. Model inner icon content
   when testing glyph geometry; an empty ha-icon is insufficient.
10. Add a usage guide under `docs/cards`, an example, and curated Unreleased
    notes. Run `pnpm validate` and inspect the generated diff. Check that HACS
    still installs one `nodalia-cards.js` resource and that the new card is in
    the registry, package, documentation and regression tests.

No new `@ts-nocheck`, `any`, unsafe casts or runtime import cycles are permitted
as a shortcut. `scripts/type-debt.json` tracks old debt, not a template for new code.
