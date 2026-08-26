# 🛣️ Nodalia Cards Roadmap

This roadmap is flexible and evolves based on real-world usage, testing, community feedback and the long-term vision for the Nodalia ecosystem.

---

# 📍 Current status

## Preview release

Current preview release:

```text
2.2.1-alpha.4
```

Preview **`2.2.1-alpha.4`** restores Graph's unboxed value and edge-to-edge plot, aligns legacy Entity/Fav icon bubbles with Light, and applies the shared contrast-aware glyph tint to Fav and Vacuum. It also improves stable-release notes while retaining all Navigation, Notifications, Climate, Weather and Advance Vacuum fixes from the earlier alphas. Stable **`2.2.0`** remains the recommended daily-driver release. Stable changes are summarized in [`CHANGELOG.md`](./CHANGELOG.md); prerelease history lives in [`CHANGELOG-PRERELEASES.md`](./CHANGELOG-PRERELEASES.md).

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

# 🎯 Current focus (`2.2.x` maintenance)

The current maintenance stage focuses on:

- Regression-free mobile and desktop behavior on stable **`2.2.0`**
- Lightweight single-bundle HACS installs and updates
- Security and service-action policy consistency
- Camera and notification delivery resilience
- Bundle startup and render performance
- Documentation and release automation parity
- Ongoing cross-browser and Home Assistant compatibility testing
- i18n and editor maturity (Phase 2)

The goal is no longer “making cards exist”.

The goal is making the entire system feel:
- coherent
- fluid
- reliable
- scalable
- premium

---

# ✅ Phase 1.5 — 2.2 stabilization (completed)

Completed in stable **`2.2.0`**: unified device layouts, interactive circular dials, Entity battery/network overviews, notification failover hardening and single-bundle HACS publishing validated across Node and browser CI.

---

# ✅ Phase 1 — 2.0 stabilization (completed)

Completed in stable `2.0.0`: the shared architecture from the prerelease cycle was validated across the full automated, browser, accessibility, HACS and release pipelines.

## Focus areas

### Stability
- Fix edge-case bugs
- Improve HA compatibility
- Improve mobile behavior
- Reduce rendering edge cases
- Improve persistence resilience

### Performance
- Reduce unnecessary renders
- Improve animation efficiency
- Reduce layout thrashing
- Improve large-dashboard performance
- Improve editor responsiveness

### UX polish
- Better transitions
- More consistent popup behavior
- Better compact layouts
- Better tablet responsiveness
- More coherent interaction language

### Visual consistency
- Continue unifying:
  - spacing
  - shadows
  - chips
  - tint systems
  - buttons
  - panels
  - popups
  - hover states
  - animations

---

# 🌍 Phase 2 — i18n and editor maturity

Goal: make Nodalia feel truly international and easier to configure.

## Planned work

### Translation improvements
- Continue refining existing locales
- Improve machine-translated strings
- Add missing editor translations
- Improve runtime translation consistency
- Expand translation coverage across all cards

### Editor improvements
- More native Home Assistant selectors
- Better grouped sections
- Cleaner advanced settings
- Better mobile editing experience
- Better validation feedback
- More discoverable options

### Documentation
- More examples
- Better screenshots
- Per-card documentation
- Migration guides
- Troubleshooting documentation

---

# 🎨 Phase 3 — Visual system refinement

Goal: continue evolving Nodalia into a truly cohesive UI framework.

## Planned work

### Shared design system
- Shared surface tokens
- Shared motion system
- Shared popup framework
- Shared chip system
- Shared button styles
- Shared utility components

### Theme integration
- Better light theme behavior
- Better dark theme behavior
- Better dynamic tinting
- Improved accessibility contrast
- Improved typography scaling

### Motion and interactions
- More natural animations
- Better reduced-motion handling
- More tactile interactions
- Better layered transitions
- More fluid mobile interactions

---

# 📊 Phase 4 — Major card redesigns

Goal: audit mature cards against the current shared design tokens and interaction model, then redesign only where a material consistency or usability gap remains.

> The items in this phase are directional ideas rather than committed release scope. Several original goals have already evolved during the `1.x` and `2.0.0` cycles and should be revalidated before implementation.

---

## 📈 Graph Card redesign

### Goals
- Cleaner visual hierarchy
- Better readability
- Better tooltip system
- Better multi-series rendering
- More modern chart aesthetics

### Planned improvements
- Better interpolation
- Better legends
- Better mobile scaling
- Better hover behavior
- Better animation handling
- Weather-card-inspired rendering style

---

## ⚡ Power Flow Card redesign

### Goals
- Better handling of complex setups
- More adaptive layouts
- Cleaner energy visualization

### Planned improvements
Support improvements for:
- Grid
- Solar
- Battery
- Water
- Gas
- EV charging
- Multiple consumption sources

Additional goals:
- Better node positioning
- Better flow animations
- Cleaner compact mode
- Better responsive layouts

---

## 🧭 Navigation Bar redesign

### Goals
- Feel more app-like
- Improve visual integration
- Improve mobile ergonomics

### Planned improvements
- Better blur/background handling
- Better floating behavior
- Better active indicators
- Improved animations
- Better responsive scaling

---

## 🤖 Advanced Vacuum evolution

### Goals
Push the vacuum experience closer to a native Roborock-like experience directly inside Home Assistant.

### Planned improvements
- Better map interactions
- Better room editing
- Better zone workflows
- Better goto handling
- More advanced routines
- Better multi-floor support
- More resilient persistence
- Better map rendering performance
- Better mobile ergonomics

---

# 🔔 Notifications ecosystem expansion

The Notifications Card is expected to become one of the central systems in Nodalia.

## Planned improvements

### Smart recommendations
- Better contextual logic
- Presence-aware recommendations
- Multi-device awareness
- Climate intelligence
- Energy-aware recommendations

### Mobile integrations
- Better actionable notifications
- Better grouping
- Better synchronization
- Better persistent notification handling

### Visual improvements
- More compact modes
- Better stack animations
- Better filtering/grouping
- More notification layouts

---

# 🗓️ Calendar ecosystem expansion

The Calendar Card introduced in 1.0.0 will continue evolving.

## Planned improvements

### Native calendar workflows
- Better recurrence support
- Better event editing
- Better drag/drop interactions
- Better month layouts

### Smart integrations
- Weather-aware events
- Presence-aware reminders
- Smart notification integration
- Better timeline experiences

### UI improvements
- Better tablet layouts
- Better compact modes
- Better animation consistency
- More customizable views

---

# 🧩 New cards planned

The ecosystem will continue growing slowly and carefully.

Priority is quality and consistency over quantity.

---

## 🪧 Section / Header Card

A polished replacement for Home Assistant heading cards.

### Possible features
- Subtitle support
- Action buttons
- Better spacing control
- Better visual hierarchy
- Nodalia design consistency

---

## 📦 More ecosystem cards

Potential future additions:
- Timeline card
- Dashboard overview card
- Statistics card
- Device health card
- Smart recommendation panels
- Automation status cards

---

# 🛡️ Long-term goals

## Nodalia Cards should become:

- Stable
- Fast
- Cohesive
- Beautiful
- Easy to configure
- Pleasant to use daily
- Consistent across all cards
- Reliable for real homes

The long-term vision is not just a set of custom cards.

It is building a complete frontend experience layer for Home Assistant.

---

# 🚀 Release workflow

## Stable (`main`)
Production-ready releases.

## Beta (`beta`)
Feature-preview releases for advanced users.

## Alpha (`alpha`)
Experimental builds with rapid iteration.

## Release candidate (`vX.Y.Z-rc.N`)
Feature-frozen builds used for final regression, compatibility and release checks. RC maturity is represented by the Git tag; a candidate may be cut from a staging branch once its exact commit is validated.

New work normally progresses through `alpha`, then `beta` when broader testing is useful, then one or more RC tags before promotion to `main` as a stable release. Small, low-risk fixes may skip an intermediate branch, but never the version, bundle and release validation gates.

---

# 🤝 Community feedback

Community feedback remains one of the most important parts of the project.

Real-world dashboard usage continues shaping:
- layouts
- animations
- interactions
- mobile ergonomics
- editor UX
- smart systems
- overall polish
