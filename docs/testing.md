# Testing

Use Node 22+ and the pinned pnpm version in `package.json` (`corepack enable`).
Install with `pnpm install --frozen-lockfile`.

- `pnpm build`: regenerate standalone card/support artifacts and the HACS bundle.
- `pnpm validate:fast`: version and dependency-graph checks, strict typecheck,
  typed lint for every source module, distributed JavaScript syntax, translations,
  build and Node tests.
- `pnpm validate`: fast validation plus all four Playwright projects.
- `pnpm test:browser`: build and run Chromium, Firefox, WebKit and iPhone WebKit.
- `pnpm dev`: build and serve the fixture at localhost:4173; rerun build after edits.

Install browser engines once with `pnpm exec playwright install --with-deps`.
On macOS environments where Firefox cannot create its profile, run the other
three projects locally and require Linux CI Firefox before merging/publishing.
Do not turn a browser failure into a skip to hide it.

## Test boundaries

Pure algorithms and configuration compatibility belong in Node tests. Prefer
behavior to regexes over source formatting. Some historical source-contract
checks remain; update them to the new canonical source when moving a module.
The registry tests protect every public card and editor tag, including Lock.

`tests/fixtures/hass.ts` exports `createHassFixture({ entities, overrides })`;
its generated `hass.mjs` is consumed by Node and browser tests. Each invocation
creates independent state/attribute objects. `browser.html` retains `makeHass`
as a compatibility adapter while exposing the shared factory for new cases.

Browser tests cover real geometry, focus, gestures, services, lifecycle and
accessibility. Compare element centers/containment with small tolerances rather
than entire pixel screenshots unless the visual contract requires snapshots.
Artwork tests use explicit delayed responses and synchronous cache assertions.

## CI and artifact drift

`.github/workflows/quality.yml` is the shared gate for PRs and releases. Static
validation and the four browsers run in parallel. Browser downloads are cached
by OS/project/lockfile using the official pinned cache action; system dependencies
are still installed. The cache action uses Node 24 on GitHub-hosted runners; the
project itself builds/tests with Node 22. Static validation
regenerates translations and bundles and fails on `git diff --exit-code`.
Never edit root generated JS or generated fixtures by hand.
`tests/lint-coverage.test.mjs` verifies typed lint coverage across all source modules
and confirms every runtime artifact has a canonical TypeScript entry.

Animation trajectory tests must control both CSS animation time and JS lifecycle
timers. Install the [Playwright clock](https://playwright.dev/docs/clock) before
loading the page; pause after loading, set CSS hold times and advance animation
frames with `page.clock.runFor`. Advance cleanup explicitly after sampling. See
`tests/browser/device-expansion-animations.spec.mjs`: deliberate wall-time stalls
and connected-element assertions guard against sampling detached nodes on slow CI
workers. Keep geometry and final cleanup assertions; retries are not a fix.

### Shared automatic row collapse

`tests/browser/shared-row-collapse.spec.mjs` reproduces the native Sections hierarchy (`hui-section` → `.card` grid cell → inline `hui-card` → custom card), with block shadow styles on `ha-card`. An inline wrapper is significant: replacing it with a block grid item masks WebKit's retained intrinsic height. Regression coverage interleaves Alarm favourite expansion, sibling Light favourite feedback and collapse, plus animated Light/Fan/Humidifier controls, repeated cycles, detach and explicitly configured/hidden wrappers. Settled height notifications reuse existing observers and do not emit global window resize events.

### Rounded shadows and scrollports

`tests/browser/rounded-shadow-clipping.spec.mjs` uses native block `ha-card` styles and a light theme to cover compact armed Alarm favourites, TV player chips standalone and inside Room Summary, long names, settled Light temperature/color sliders, narrow Graph legends and both Weather forecast views. External control shadows must reach the rounded card boundary without encountering an inner rectangular clip. Scrollable rows retain scrolling and use inset highlights; text and image clipping remain local to the label or image. Mode transitions retain temporary containment until their cleanup frame completes.


### Graph grid height

`tests/browser/graph-grid-height.spec.mjs` recreates native Sections `.card.fit-rows` cells with inline `hui-card` wrappers. Two adjacent graphs use the reported humidity/temperature styles and string point counts. Geometry checks cover automatic, four-row and eight-row layouts at desktop/mobile widths, delayed history, series selection, reconnect and live row-mode changes on existing cells. The card and plot must remain inside their cell and leave the next card unobscured; detached hosts release their cell observers.

### Runtime audit regressions

`tests/browser/advance-vacuum-lifecycle.spec.mjs` instruments state-catalog enumeration with 1700 unrelated entities. Explicit tracking must avoid enumeration while updating helper arrival/removal and live room values; existing automatic-discovery tests retain mutable registry coverage. `tests/browser/news-lifecycle-editor.spec.mjs` advances the debounce clock across configuration and HA-owner changes to ensure retired helper writes cannot execute, while ordinary updates preserve their valid write. `tests/numeric-values.test.mjs` compares native formatting and instruments formatter construction/eviction without imposing machine-dependent timing thresholds.

## Final alpha resource and contract audit

`resource-soak.spec.mjs` tracks active owned timers/frames, observed targets,
global listeners, live shadow DOM and fixture subscription/request counts through
24 mount/update/interact/reconnect/entity/remount cycles per complex card.
Summary verifies real embedded children; the camera fixture supplies successful
images. The ledger does not measure JS heap reclamation, GPU memory or codecs.
`go2rtc-lifecycle.spec.mjs` adds 60 transport replacement cycles with explicit
socket, poster URL, video frame and media-node ownership checks.

`standalone-contract.spec.mjs` cold-loads each of the 25 standalone cards/editors
after the documented shared support resources, without HACS. Bundle metadata
footers are checked separately through the HACS entrypoint. Regression evidence
and release acceptance are recorded in [the beta audit](BETA_READINESS_AUDIT.md).

## Release benchmark regression checks

`pnpm benchmark:quick -- --browsers chromium 2.2.10 3.0.0-beta.1` verifies the harness on exact published assets. Node regressions cover CLI separators/N versions, missing release/asset, provenance, statistics, schema, CSV/Markdown and release-evidence rejection. Browser checks cover existing/later shadow roots, runtime failures, real Graph history and Vacuum/helper/API profiles. The shared CI smoke has no percentage gate.

For a longer resource ledger run use `NODALIA_SOAK_CYCLES=100 pnpm exec playwright test tests/browser/resource-soak.spec.mjs --project=chromium --workers=1`. This is a correctness check of owned resources, separate from the benchmark controlled-GC 100/250/500-cycle trend measurements.

Firefox failing before loading any fixture is an unavailable browser, not a passing test. On macOS 27, [Playwright #42768](https://github.com/microsoft/playwright/issues/42768) describes the same profile-access failure; [Mozilla #2062988](https://bugzilla.mozilla.org/show_bug.cgi?id=2062988) explains the diagnostic. A fresh browser installation/profile did not resolve it on this audit machine. Linux CI can verify code compatibility but cannot supply missing Apple M4 Firefox performance figures.

### View relayout feedback

`card-updated` is only sent from inside `hui-section`/`hui-grid-section`. HA Masonry, Sidebar and Panel views answer it by rebuilding their columns and re-appending every card. `tests/browser/view-layout-feedback.spec.mjs` mirrors that view behavior (#321): two reporter Light Cards in a horizontal stack, every size-reporting card, on/off states, unrelated HA updates and the responsive threshold must leave the view, card nodes and animations untouched. Sections must still receive real size changes.

### Scroll stability on interaction

`tests/browser/interaction-scroll-stability.spec.mjs` uses a long Sections page with a block `ha-card`. WebKit (desktop and iPhone) runs scroll anchoring; a re-rendered query container made it scroll by roughly the card's content height (#320). HA feedback, Humidifier power/mode/slider presses at several viewport sizes and positions and keyboard activation must leave the scroll position unchanged and keep focus on the re-rendered control.
