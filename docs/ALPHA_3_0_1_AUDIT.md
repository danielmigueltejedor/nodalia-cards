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

Static validation, performance measurements and release verification are being
completed before publication. Results will be recorded here.

The audit also reproduced a native-select regression introduced by retaining
nodes: selected attributes could match while the live value stayed dirty after
interaction. Reconcile controlled select values with the HA model without
replacing the focused node. A real dock-selector regression fails before this
fix and covers both rejection/old-state feedback and a new provider value.

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
