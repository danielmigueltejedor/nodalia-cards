# 🛣️ Nodalia Cards Roadmap

This roadmap is flexible and evolves based on real-world usage, testing, community feedback and the long-term vision for the Nodalia ecosystem.

---

# 📍 Current status

## Current preview release

Current preview release:

```text
3.0.0-alpha.8
```

See [the curated prerelease notes](./CHANGELOG-PRERELEASES.md) for this build.
Stable **`2.2.10`** remains the recommended daily-driver release.

## Current stable release

Current stable release:

```text
2.2.10
```

Stable **`2.2.10`** restores Advance Vacuum fan speed on newer Roborock robots that expose a `cleaning_mode` select beside `fan_speed_list`. Stable changes are summarized in [`CHANGELOG.md`](./CHANGELOG.md); prerelease history lives in [`CHANGELOG-PRERELEASES.md`](./CHANGELOG-PRERELEASES.md).

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

Prepare the completed version 3 migration for a stable release:

- Keep all 25 cards, editors and runtime sources strictly checked with zero
  suppression and import-cycle debt.
- Preserve existing YAML, standalone artifacts and single-bundle HACS installs.
- Verify desktop/mobile artwork tint, animations, native focus and editor behavior.
- Keep source generators, Weblate sync, documentation and release automation aligned.
- Validate the exact release commit across static and four-browser CI gates.
- Record remaining device/integration issues honestly before stable promotion.

The current package remains a preview until an explicitly prepared stable version
passes validation and its tag is published. See [releasing](docs/releasing.md).

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

## Future work

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
