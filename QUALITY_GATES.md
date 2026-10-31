# Deterministic Quality Contract

The AI must not claim a task is complete without real test output. Any changed behavior requires tests for normal, edge, and failure cases. Do not skip tests, lower thresholds, hide diagnostics, or weaken CI to get a green check. Security and regression-critical changes need human review.

## Measured gate
- `git diff --check`
- `pnpm run validate:fast (lint, types, architecture, i18n, build and tests)`

The `quality` job must be marked as a required status check in branch protection. Changes to quality policy, tests, and CI require human review. Coverage or performance thresholds are **not claimed enforced** here unless the underlying existing scripts enforce them; introduce numerical budgets only after measuring stable baselines.
