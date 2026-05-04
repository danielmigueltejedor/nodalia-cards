# 🛣️ Nodalia Cards Roadmap

This roadmap is flexible and may change depending on feedback, testing and real usage.

---

## Current status

**Stable `0.3.0`** ships from **`main`**. Upcoming **`0.4.x`** uses three branches: **`alpha`** (experimental, may break), **`beta`** (testers), **`main`** (stable only)—see **CONTRIBUTING** (*Releases: main, beta, and alpha*). Focus: Power Flow polish, translations, Graph Card line work, stronger default styles.

The project is still being refined before a real **`1.0.0`** release.

---

## Phase 1 — Beta foundation

Goal: prepare the project for faster iteration without breaking the stable version.

### Focus
- Keep stable branch untouched unless critical fixes are needed
- Use beta releases for active development
- Collect real user feedback
- Improve documentation and project structure

---

## Phase 2 — Translations and visual editor

Goal: improve accessibility and make configuration easier.

### Planned work
- Add proper translation structure
- Improve Spanish support
- Add English as the main secondary language
- Prepare the project for community translations
- Fix visual editor layout issues
- Improve editor consistency between cards
- Make editor options clearer and easier to understand

---

## Phase 3 — Visual polish

Goal: make all cards feel part of the same UI system.

### Planned work
- Reduce and standardize drop shadows
- Refine spacing and border radius consistency
- Improve card active/inactive states
- Polish animations and transitions where needed
- Improve light/dark theme behavior

---

## Phase 4 — Card redesigns

Goal: improve the cards that still feel less mature than the rest.

### Graph card
- Redesign based on the cleaner weather card graph style
- Improve readability
- Improve multi-entity display
- Refine tooltips, labels and visual hierarchy

### Energy flow card
- Fix visual issues with complex setups
- Improve support for:
  - Grid
  - Solar
  - Battery
  - Water
  - Gas
  - Multiple consumption sources
- Add a more adaptive layout

### Navigation card
- Redesign to better match the rest of the system
- Decide between full-width app-style bar or card-style container
- Improve visual consistency

### Advanced vacuum card
- Polish selected areas/rooms behavior
- Improve visual details
- Refine controls and edge cases
- Improve Roborock-specific experience

---

## Phase 5 — Stability before 1.0.0

Goal: prepare the first truly polished stable release.

### Before 1.0.0
- Fix obvious bugs
- Improve documentation
- Add more examples
- Validate all main cards
- Ensure visual consistency
- Improve install/update experience
- Finalize stable/beta workflow

---

## Target for 1.0.0

Nodalia Cards `1.0.0` should feel:

- Stable
- Coherent
- Polished
- Easy to configure
- Visually consistent
- Ready for daily use

## After 1.0.0 — New cards and ecosystem expansion

Once the first stable 1.0.0 release is polished and reliable, the goal will be to slowly expand the Nodalia ecosystem with new cards while keeping the same design language and quality standards.

### Planned cards

#### Calendar Card
A modern calendar card for Home Assistant.

Possible features:
- Upcoming events
- Daily / weekly view
- Clean mobile-first layout
- Event color support
- Compact and expanded modes

#### Notifications Card
A dynamic notification card for important home states.

Possible features:
- Show messages when a sensor is below or above a value
- Show messages when a binary sensor changes state
- Support for priority levels
- Custom icons and colors
- Empty state text when there are no active notifications

Example empty state:
No active notifications

#### Section / Header Card
A custom alternative to the default Home Assistant heading / section card.

Possible features:
- Cleaner visual style
- Optional subtitle
- Icon support
- Action button support
- Better spacing control
- Nodalia-style consistency
