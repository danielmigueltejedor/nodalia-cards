# 3.0.1-alpha.1 maintenance audit

Scope: #316, #317, #318. Existing 3.0.0 YAML, tags, service actions, editors
and Engine API are unchanged.

## Root causes and decisions

- Lock replaced its entire shadow content on relevant HA updates; transitions
  had no stable element to animate. Patch the owned view and reuse the existing
  finite animation/cleanup infrastructure. Commit HA state immediately.
- Advanced Vacuum removed/reinserted the base image and replaced map children,
  even with unchanged geometry. Map camera timestamps also invalidated
  calibration. Reconcile independently keyed layers, compare actual calibration
  and room data, and separate frame updates from content updates. Load/decode
  only the latest pending frame; retire on context/config/disconnect and keep
  the previous frame on failure. Remove unused crossfade/stale-image CSS.
- Rain was painted over the cloud and began above its lower edge. Give the
  icon a foreground stacking layer and emit rain below the cloud.
- Humidity particles always used the outward keyframes. Reuse those keyframes
  in reverse for dehumidifiers, using active action, device class, then mode.
  Names, icons and the presence of an available mode do not classify a device.

## Coverage

New browser regressions cover Lock states and immediate/reduced/bounded motion,
unchanged nodes, feedback restart avoidance and retirement; map position,
selection, decoded frame races/errors/retirement, dimensions and structural
changes; rain layering and both particle directions. Unit tests exercise the
metadata classification and versioned benchmark workloads. Existing gesture,
smart-mode, lifecycle, focus, accessibility and standalone suites remain required.

Local full browser suite: **1,256 passed, 1 skipped** across Chromium, WebKit
and iPhone WebKit emulation. Firefox is excluded on this Mac by the owner's
explicit instruction; the full Linux Firefox CI suite remains required.

Final runtime commit `62fbcbd5f979c81c18cb54815b3173822bc15dfa` passes
[Linux CI](https://github.com/danielmigueltejedor/nodalia-cards/actions/runs/37464386073):
**833 unit tests**, strict TypeScript, lint, translations, deterministic build,
distribution/version/bundle gates; **1,677 browser tests passed, 3 existing
conditional skips** (Chromium 420, Firefox 418/2 skips, WebKit 420, iPhone
WebKit 419/1 skip). No Firefox was launched locally.

The final source also passes 27 focused local map/Lock regressions after the
fresh-clone optimization; the controlled-selector fix passed 81 focused
map/gesture/lifecycle/Lock cases. HACS, CodeQL and the published-asset benchmark
smoke pass. Dependency audit: no known vulnerabilities. All generated card
versions and the package are `3.0.1-alpha.1`; no dependency/lockfile change.

The audit also reproduced a native-select regression introduced by retaining
nodes: selected attributes could match while the live value stayed dirty after
interaction. Reconcile controlled select values with the HA model without
replacing the focused node. A real dock-selector regression fails before this
fix and covers both rejection/old-state feedback and a new provider value.

## Performance assessment

[Complete diagnostics](benchmarks/3.0.1-alpha.1-maintenance.md) and
[798 raw samples](benchmarks/3.0.1-alpha.1-maintenance.json) compare exact
published 3.0.0 with the clean final runtime, using two warmups/seven alternating
rounds per profile on the reference M4 Mac. Zero workload/runtime errors.

| Twenty map frames: synchronous work median | 3.0.0 | Alpha | Change |
|---|---:|---:|---:|
| Chromium | 55.7 ms | 24.3 ms | −56.4% |
| WebKit | 57 ms | 20 ms | −64.9% |
| iPhone WebKit emulation | 60 ms | 22 ms | −63.3% |

In each engine, 120 robot-metadata updates go from 960 map mutations/840
removed nodes to zero, preserving all observed layers. Twenty frame changes
go from 20 view/overlay builds to zero and from 200 map mutations to 20.
Selection retains unchanged rooms/markers and only adds/removes required
highlight layers. Robot metadata still computes compatible view content;
zero map DOM mutations does not mean zero view computation.

Slower results are retained and accepted for this alpha with explicit limits:
120 consumed Lock updates rise from 7.7 to 15.8 ms in Chromium and 9 to 14 ms
in WebKit (approximately 0.04–0.07 ms additional synchronous work per update).
Advanced Vacuum consumed updates rise from 82.4 to 98.1 ms in Chromium;
selection and gesture medians also vary by engine. This is not a global speed
claim or proof of low-powered physical-device performance. Initial Advanced
Vacuum mount is 8.8 → 8.7 ms Chromium, 10 → 10 ms WebKit, 9 → 10 ms iPhone
emulation. The audit removed an unnecessary recursive pass over freshly
cloned nodes before the final measurements.

One hundred lifecycle cycles leave zero fixture residual connected nodes in
all three engines. Chromium's controlled-GC heap delta is 883,220 → 889,652
bytes and browser DOM delta 0 → 1, including runtime/module warmup. This single
cycle-count diagnostic does not prove absence of a leak. Existing ownership,
context and resource lifecycle regressions additionally pass.

Bundle raw bytes: 4,147,261 → 4,151,153 (+0.094%); gzip:
946,772 → 943,166 (−0.38%); Brotli: 596,363 → 597,326 (+0.16%).
Unchanged budgets pass. Candidate SHA256:
`78ce7efc8e0f32b79e7dda3bf975711bdf3bab8ea43754268cf50162f3bcea12`.
Release quality gates and checksum verification apply to this same runtime.

## Changed files and architecture review

- Runtime: `src/cards/lock/lock-card.ts`,
  `src/cards/advance-vacuum/advance-vacuum-card.ts`,
  `src/cards/advance-vacuum/advance-vacuum-map-surface.css`,
  `src/cards/humidifier/{humidifier-card,humidifier-helpers}.ts`,
  `src/cards/weather/weather-card.ts`.
- Shared ownership: `src/shared/view-animation-work.ts` and new
  `src/shared/view-reconcile.ts`. Only Lock and Advanced Vacuum use the
  reconciler; no framework replacement, global DOM cache or API expansion.
  Keys include SVG namespaces and stable room/zone identities. Live native
  select values are controlled by the HA model while focus/node identity is kept.
- Regressions: `tests/browser/{lock-state-motion,icon-motion-direction,
  advance-vacuum-incremental-map}.spec.mjs`,
  `tests/humidity-particle-direction.test.mjs`,
  `tests/benchmark-framework.test.mjs`.
- Measurement: `bench/{compare-maintenance,workloads}.mjs`,
  `bench/fixtures/runtime.mjs`, `bench/benchmark.config.json`, `bench/README.md`.
  New workloads are opt-in by versioned configuration so historical reports
  keep their original coverage and official evidence requirements.
- Release/docs: `package.json`, `src/version.ts`, roadmap, prerelease changelog,
  architecture/integration docs, issue-template preview examples and this audit.
  Generated root JS/manifest files embed the same version; runtime logic changes
  are generated from the TS sources, not separately hand-maintained.

No new listener scope, unbounded cache, dependency or public configuration.
The new frame request is limited to one per card; cancellation removes its
source and callbacks. State animations retire on replacement/disconnect and
finish in 220 ms. HA state, busy semantics and actionable controls update
immediately; reduced motion removes decorative movement. Existing security,
service, keyboard, focus and Sections behavior remain covered by the full suite.

Implementation commits: `5ca9dfb`, `4003bac`, `62fbcbd`.
[PR #319](https://github.com/danielmigueltejedor/nodalia-cards/pull/319)
closes #316, #317 and #318. Final notes/evidence are committed separately;
the measured runtime hash is unchanged by documentation.

## Provider and measurement limits

Robot/path pixels baked into a raster provider require a new frame. Cards does
not expose or invent separate robot/path coordinates; it keeps base/SVG/markers
and independent selection layers mounted. Arbitrary vacuum attributes may
still require view computation for compatibility, but unchanged map nodes
receive no DOM writes. No unbounded frame or markup cache is introduced.

Benchmarks use the existing fixture and statistics, an exact checksum-verified
3.0.0 release asset and the local alpha candidate. They are maintenance
diagnostics, not official published-release evidence. Native iPhone Safari and
real Roborock network latency still require field validation.
