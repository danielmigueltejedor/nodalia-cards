# Copilot review guidance — Nodalia Cards

Review changes against `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, and the affected card's existing behavior. Favor actionable findings introduced by the PR over generic refactoring or style suggestions.

- **Backwards compatibility:** protect existing Home Assistant YAML, custom element names, standalone resource paths, the single HACS bundle, card/editor behavior, and established Engine API contracts. Ask for migration notes and tests if a public contract changes.
- **Type safety and architecture:** keep strict TypeScript; flag new unsafe `any` usage, unchecked external inputs, import cycles, bypasses of shared runtime initialization, and edits to generated root `nodalia-*.js` artifacts without matching canonical `src/` changes.
- **Lifecycle and performance:** inspect repeated Home Assistant updates for unnecessary rendering, observer/listener/timer/request leaks, stale async callbacks, animation replay, and expensive per-frame or per-update work. Require measurement before claiming a performance improvement.
- **Interaction and safety:** check accessibility (keyboard/focus and mobile layouts), deliberate lock/unlock confirmation, service-action restrictions, and retained editor drafts across state changes.
- **Translations and distribution:** verify i18n keys/placeholders for changed locales, generated artifacts when required, and HACS compatibility. Do not recommend editing generated translation modules as the primary source.
- **Regression coverage:** request focused regression tests for changed behavior; for UI changes check whether Chromium, Firefox, WebKit, and mobile WebKit need coverage. CI evidence must not be assumed if it is not available.
- **PR description:** if its summary, motivation, tests, or compatibility analysis is missing or misleading, mention that in the overall review. The separate PR-description check handles structural requirements.

For each finding, identify the concrete affected behavior, when it fails, and a minimal feasible fix. Avoid reporting existing problems unrelated to the patch. Do not treat historical beta freeze text as a current release restriction; check current project version and changelog.
