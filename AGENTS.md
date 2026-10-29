# Agent instructions — nodalia-cards

## Repository-specific deterministic quality contract (2026-10-26)

**Project:** JavaScript/TypeScript Home Assistant custom cards with browser and accessibility snapshots.

**Engineering requirements:** Never regress left/center alignment, editor localization, component rendering, HA subscriptions or layout. Pin GitHub Actions by SHA and compare generated bundle diffs.

**Verification commands:** pnpm install --frozen-lockfile && pnpm run i18n:gen-editor && pnpm run i18n:gen-runtime && pnpm run validate:fast; pnpm run validate for browser tests.

Execute applicable checks before claiming completion and report the output honestly. Tests must cover behavior, edge cases and failures. Never delete, skip or weaken tests, quality thresholds or CI for a green result. Review changes to policies, `AGENTS.md`, `QUALITY_GATES.md` and workflows. Make `quality` required in protected branches. Report missing dependencies and failing legacy tests, never hide them. These instructions extend (do not replace) existing rules.
