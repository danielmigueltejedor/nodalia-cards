# 🛣️ Nodalia Cards Roadmap

This roadmap is flexible and evolves based on real-world usage, testing, community feedback and the long-term vision for the Nodalia ecosystem.

---

# 📍 Current status

## Current preview release

Current preview release:

```text
3.0.2-alpha.1
```

See [the curated prerelease notes](./CHANGELOG-PRERELEASES.md) for this build.
Stable **`3.0.1`** remains the recommended daily-driver release.

## Current stable release

Current stable release:

```text
3.0.1
```

Stable changes and migration notes are summarized in [CHANGELOG.md](./CHANGELOG.md).

The project currently includes:

- Unified design language
- Shared visual systems
- Smart contextual cards
- Advanced visual editors
- Extensive i18n support
- Mobile-first interactions
- Native-feeling animations
- Advanced vacuum and calendar systems
- Smart notification center
- Shared internal infrastructure

---

# 🎯 Current focus (`3.0.x` maintenance)

Stable 3.0.0 promotes the validated RC runtime. The 3.0.x maintenance cycle accepts
bug fixes, accessibility, compatibility, lifecycle/memory corrections,
documentation and tests. Preserve YAML and resource contracts, strict types,
typed lint, zero suppression/import-cycle debt and existing bundle budgets.
New cards, substantial features and broad refactors belong to a later cycle.
See [releasing](docs/releasing.md).

## Completed for version 3

- Canonical checked TypeScript for every card, editor and shared runtime.
- One card registry, generated version declarations and standalone compatibility.
- Typed lint across all source modules and empty enforced debt inventories.
- Shared CI/release gates, curated notes and release integrity metadata.
- Consistent Lock editor, centered icon chips and native Lock in Summary.
- Centered translucent media transport and artwork-aware capsules/selectors.
- Vacuum state localization and constrained status chips.
- Context-owned asynchronous work and native focus/gesture regressions.
- Retired migration scripts, duplicate catalogs and historical worklogs removed;
  current contributor, architecture and audit guides replace them.

The stable 2.x and version 3 preview history remains in
[CHANGELOG.md](CHANGELOG.md) and [CHANGELOG-PRERELEASES.md](CHANGELOG-PRERELEASES.md).

## Future work (after stable 3.0.0)

These are directions to revalidate against real dashboard feedback, not committed
version 3 release scope:

- Refine existing translations and compact editor hints through Weblate.
- Improve chart, calendar and notification workflows where a reproducible gap exists.
- Profile large dashboards on actual desktop and mobile devices before changing
  rendering, CSS containment or animation strategies.
- Extend shared controls only when consumers have matching behavior.
- Consider new cards only when they address a distinct Home Assistant use case.

The experimental WYSIWYG layout editor is preserved on
`future/2.0.0-visual-layout`. It is separate from the version 3 bundle and can be
reconsidered in a later feature cycle. Its old standalone design plan is retired.

## Completed RC evidence

The [RC audit](docs/audits/rc-readiness-report.md) and
[reference assessment](docs/benchmarks/3.0.0-rc.1-analysis.md) record completed
lifecycle, compatibility and three-engine performance evidence, with the owner
exception for Firefox performance on this Mac. Stable promotes the same runtime;
the owner requested no repeated benchmarks. Historical samples remain labelled
RC and are not exact stable-asset measurements. Permanent benchmark tooling
remains available for later explicitly requested measurements.
