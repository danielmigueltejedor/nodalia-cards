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

`tests/browser/shared-row-collapse.spec.mjs` reproduces the native Sections hierarchy (`.card` grid cell → inline `hui-card` → custom card), with block shadow styles on `ha-card`. An inline wrapper is significant: replacing it with a block grid item masks WebKit's retained intrinsic height. Regression coverage interleaves Alarm favourite expansion, sibling Light favourite feedback and collapse, plus animated Light/Fan/Humidifier controls, repeated cycles, detach and explicitly configured/hidden wrappers. Settled height notifications reuse existing observers and do not emit global window resize events.

### Rounded shadows and scrollports

`tests/browser/rounded-shadow-clipping.spec.mjs` uses native block `ha-card` styles and a light theme to cover compact armed Alarm favourites, TV player chips standalone and inside Room Summary, long names, settled Light temperature/color sliders, narrow Graph legends and both Weather forecast views. External control shadows must reach the rounded card boundary without encountering an inner rectangular clip. Scrollable rows retain scrolling and use inset highlights; text and image clipping remain local to the label or image. Mode transitions retain temporary containment until their cleanup frame completes.


### Graph grid height

`tests/browser/graph-grid-height.spec.mjs` recreates native Sections `.card.fit-rows` cells with inline `hui-card` wrappers. Two adjacent graphs use the reported humidity/temperature styles and string point counts. Geometry checks cover automatic, four-row and eight-row layouts at desktop/mobile widths, delayed history, series selection and reconnect. The card and plot must remain inside their cell and leave the next card unobscured.
