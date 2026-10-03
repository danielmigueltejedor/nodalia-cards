# Version 3 performance and interaction verification

This guide covers current source ownership and repeatable dashboard profiling.
Historical version 1/2 audit measurements remain in Git history and changelogs;
they are not a current unresolved backlog or a version 3 performance benchmark.

## Current architecture

All 25 cards and support runtimes build from checked TypeScript. Small lazy hosts
register at startup; actual card/editor classes initialize when first created.
The single HACS resource includes runtime and editor UI. It has no production npm
dependencies and requires no additional component CSS download.

Render signatures track consumed HA state; unrelated updates should not rebuild
visible controls. Configuration stamps, owned callbacks and bounded caches avoid
repeated catalog work. Preserve those gates while ensuring auxiliary entity,
locale, theme and layout changes still invalidate the appropriate presentation.

Media Player and Navigation share bounded artwork sampling and cached palettes.
Returning to a dashboard uses warm colors synchronously. Covers and tint commit
together; Media entrance animates the cover with its controls without a
controls-only opacity fade that would block backdrop reflection. Unseen artwork
still depends on network transfer and decoding.

Disconnect and HA/configuration context changes retire owned timers, frames,
observers, listeners, requests and persistence work. Room Summary parking invokes
child disconnect cleanup. Native focus and in-progress fields remain stable on
ordinary updates. Gesture cancellation restores previews without commands.

## Automated verification

```bash
pnpm validate:fast
pnpm validate
```

The fast gate includes strict types, lint, zero-debt architecture guards,
translations, distribution syntax, build and Node regressions. Full validation
adds Chromium, Firefox, WebKit and iPhone WebKit. CI also checks generated drift.
See [testing](testing.md) and [current audit](TECHNICAL_AUDIT.md).

The [version 3 bundle-size audit](BUNDLE_SIZE_AUDIT.md) records the measured
baseline, per-area savings, editor parity checks and compatibility paths retained
after the size-only pass. Its final resource is 4,132,872 raw / 942,929 gzip bytes;
the existing budgets remain unchanged.

Distribution tests enforce unchanged raw/gzip budgets. Do not increase a budget
or trade away translucent appearance without measuring the relevant behavior.
CSS animation tests control lifecycle time as well as native animation time;
media tests check actual composition during entrance, not just final CSS values.

## Manual large-dashboard profile

Record Cards version, Home Assistant version, browser/device, entity/card counts,
network conditions and whether the artwork/cache is cold or warm.

1. Open a representative dashboard containing device, Climate, Graph,
   Notifications, Camera, Summary and Media cards. Record a Performance trace
   while HA updates normally; use your real entity count rather than claiming a
   universal 1700-entity result from fixtures.
2. Update an unrelated entity. Check that visible controls do not repaint or
   replay animations unnecessarily. Update a consumed auxiliary entity and confirm
   its card still refreshes correctly.
3. Navigate between views repeatedly with warm media artwork. Inspect transport
   tint during entrance, then change tracks and test a cold or failed cover.
4. Expand/collapse controls and dialogs. Drag sliders/dials/maps, cancel gestures,
   and verify vertical scrolling, keyboard focus and service calls.
5. Test slow acknowledgements and failed requests. Optimistic state must settle
   or revert; notifications must respect retry bounds and camera streams must stop
   when their views detach.
6. Compare heap snapshots after repeated navigation and a settling period. Check
   detached cards, body portals, stream instances and listeners rather than
   assuming a single allocation peak is a leak.
7. Repeat on mobile and desktop with light/dark and reduced-motion settings.
   Note dropped frames, long tasks and console errors with a reproducible trace.

Use measurements to choose changes. CSS containment, broader sharing, partial DOM
updates and additional code splitting need behavior-specific evidence and visual
verification; they are not automatic consequences of the TypeScript migration.
