# 0.6.0 Stability Checklist

Release target for `0.6.0` stable:
- very low bug count,
- smooth interactions (no flicker / jank),
- secure default behavior,
- maintainable architecture for adding cards quickly.

## 1) Functional regressions

- Graph card:
  - tooltip appears continuously while moving over chart,
  - tooltip closes when pointer leaves card in any direction,
  - hook/marker aligns with plotted line.
- Navigation bar:
  - mini media player does not bounce/flicker on unrelated updates,
  - popup entrance animation only on real open transitions.
- Media player:
  - source chips do not show noisy labels like `AirMusic`,
  - slider drag remains responsive during long sessions.

## 2) Security hardening

- Service actions:
  - strict mode defaults to enabled unless explicitly disabled,
  - visual editor exposes `strict_service_actions` and `allowed_services`.
- URLs:
  - action/artwork URLs pass through sanitization helper,
  - `_blank` opens with `noopener,noreferrer`.
- Runtime styles:
  - user style inputs sanitized before runtime interpolation/setProperty.

## 3) Performance and fluency

- Render signatures:
  - shared strategy (`NodaliaRenderSignature`) used in high-frequency cards,
  - avoid object `JSON.stringify` signatures on hot render paths.
- Drag interactions:
  - geometry cached at drag start,
  - move/up listeners attached only during active drag.
- Build outputs:
  - standalone sync remains idempotent,
  - bundle generation stable and reproducible.

## 4) Maintainability and architecture

- Pilot modularization complete for `navigation` and `graph`.
- Shared runtime helpers centralized in dedicated modules.
- New card onboarding baseline:
  - card template follows shared security/render helpers,
  - minimal regression tests included before merge.

## 5) CI and quality gate

Required checks on PR:
- `pnpm test`
- `pnpm run bundle`

Do not cut stable release unless all checks pass and manual smoke tests above are green.
