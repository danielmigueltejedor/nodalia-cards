# Alpha 47 architecture refactor

This document records the experimental refactor on branch
`refactor/alpha47-architecture`. It does not change the package version or
publish a release. The existing Alpha 47 line remains the comparison point.

## Preserved public contract

- 24 card custom elements and their 24 editor elements keep their exact tags.
- YAML keys, defaults, migrations, Lovelace action objects, editor events,
  translations, styles and animations remain compatible.
- Notifications Card receives no visual redesign.
- Camera providers, Home Assistant path signing, Frigate/go2rtc paths, direct
  go2rtc fallback and mixed-content proxy behavior remain covered.
- The generated loader, full bundle, core/suite split and editor bundle retain
  the Alpha 47 filenames.

These invariants are executable in `tests/architecture-contracts.test.mjs`, in
the existing unit suites and in the Chromium/WebKit browser suite.

A final differential check against the branch base also compared all 24
`DEFAULT_CONFIG`/`STUB_CONFIG` values and 72 representative `normalizeConfig`
results, including native Lovelace service objects; every serialized result and
validation error matched.

## Resulting architecture

```text
loaders and generated bundles
  ├─ core runtime
  │   ├─ i18n
  │   ├─ shared utilities and lifecycle primitives
  │   ├─ render signatures
  │   └─ bubble contrast
  ├─ card support models (pure or side-effect free)
  │   ├─ Notifications mobile-delivery policy
  │   ├─ Room Summary state projection
  │   └─ Camera/go2rtc URL and transport rules
  ├─ card view/controllers (24 custom elements)
  └─ visual-editor catalog
```

The HACS entrypoint is deliberately self-contained because HACS installs only
`nodalia-cards.js`. The explicit core + suite distribution keeps the visual
editor as an adjacent lazy sidecar for advanced/manual deployments.

`nodalia-utils.js` is the source of truth for generic immutable configuration,
safe paths, escaping, Lovelace events/actions, editor focus, shadow listeners,
deferred work and dialog lifecycle. Card-specific variants remain local when
their semantics differ.

The three complex support models are loaded before card views by
`CARD_SUPPORT_PARTS`. The standalone generator embeds the required support
model together with shared utilities for Notifications, Room Summary and
Camera resources.

## Change log

1. Established a reproducible Alpha 47 baseline and recorded raw/compressed
   bundle sizes, build time, source size and test results.
2. Added characterization tests for public elements, published sources,
   configuration merge/compaction, native Lovelace service actions and editor
   lifecycle behavior.
3. Centralized 230 identical helper implementations across all cards.
4. Centralized reconnect-safe editor shadow listeners for all 24 editors.
5. Centralized focus/caret restoration for 23 editors. Navigation retains its
   specialized selectors for nested routes, players and popups.
6. Extracted Notifications mobile policy, Room Summary projection and Camera
   stream URL rules into focused support models.
7. Updated the official bundle and standalone generation paths and reran the
   complete validation matrix.

## Metrics

| Metric | Alpha 47 baseline | Refactor | Difference |
|---|---:|---:|---:|
| Source files in measured graph | 29 | 32 | +3 focused models |
| Source lines | 128,433 | 125,085 | -3,348 (-2.6%) |
| Source bytes | 5,406,762 | 5,313,002 | -93,760 (-1.7%) |
| Card runtime raw (without editor catalog) | 3,118,747 | 3,068,061 | -50,686 (-1.6%) |
| HACS bundle raw (self-contained) | 3,118,747 | 3,887,386 | +768,639 (+24.6%) |
| HACS bundle gzip (self-contained) | 653,351 | 850,469 | +197,118 (+30.2%) |
| HACS bundle Brotli (self-contained) | 362,087 | 506,178 | +144,091 (+39.8%) |
| Core raw | 355,679 | 359,002 | +3,323 |
| Suite raw | 2,761,950 | 2,707,934 | -54,016 |
| Lazy editor raw | 820,692 | 820,692 | unchanged |
| Unit tests | 316 passing | 322 passing | +6 contracts |
| Browser tests | 12 passing | 12 passing | unchanged |
| Bundle build | 0.42 s | 0.38 s | -0.04 s |

The card runtime itself is still smaller after the refactor. The shipped HACS
file grows because it now embeds the 820,692-byte editor catalog that Alpha 47
incorrectly left in a sidecar HACS does not install. This restores the
single-file HACS/manual-install contract; the explicit split distribution keeps
the smaller runtime and lazy editor for deployments that copy every artifact.

## Remaining technical debt

Priority 1:

- Split the largest render methods behind DOM/visual snapshots: Climate, Light,
  Media Player, Navigation, Power Flow, Humidifier and Advanced Vacuum.
- Converge the remaining per-card `compactConfig`, safe-path and selector
  variants only after their intentionally different empty-value semantics are
  characterized.
- Introduce one shared Lovelace action executor. Parsing and service invocation
  are shared now, but several cards still own similar action-routing branches.

Priority 2:

- Extract reusable editor field renderers and entity/icon picker orchestration;
  today lifecycle is shared while markup builders remain duplicated.
- Move Camera signing/cache/source resolution into a transport controller once
  failure and retry ordering has dedicated integration coverage.
- Separate Notifications template evaluation/background payload serialization
  from its view/controller, following the mobile-policy model.

Priority 3:

- Replace repeated CSS template blocks with documented family tokens without
  changing Notifications Card's established visual design.
- Add golden DOM snapshots for representative default and customized cards so
  future render decomposition can prove structural equivalence.

These items are intentionally not hidden inside the current refactor: each
requires broader DOM or integration characterization to preserve behavior with
the same confidence as the completed blocks.
