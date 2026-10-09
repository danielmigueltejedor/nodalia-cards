# Published-release benchmark

This development-only harness imports the exact `nodalia-cards.js` asset from each published GitHub release. It supports N releases, validates tag, publication state, asset size and GitHub SHA256 when supplied, and stores its own SHA256 plus raw/gzip/brotli sizes. It never uses a working tree bundle as official release evidence.

## Commands

Use the pinned pnpm/Playwright dependencies, Node 22+, and install the browsers once:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps
pnpm benchmark:quick -- --browsers chromium 2.2.10 3.0.0-beta.1
NODALIA_BENCH_QUICK=1 pnpm benchmark:releases -- 2.2.10 3.0.0-rc.1
pnpm benchmark:releases -- 2.2.10 3.0.0-rc.1
pnpm benchmark:releases -- 2.2.10 3.0.0-beta.1 3.0.0-rc.1
```

A nonexistent/unpublished release is an error, not an empty successful result. `--` is accepted as the pnpm separator. Official runs require all four distinct projects by default. The release owner authorized `--skip-firefox-on-mac` solely for this macOS RC acceptance: `pnpm benchmark:releases -- --skip-firefox-on-mac 2.2.10 3.0.0-beta.1 3.0.0-rc.1`. It records `metadata.referenceException: macos-firefox-rc` and an unavailable Firefox descriptor without launching Firefox. This explicit exception is rejected on other platforms, quick runs, custom subsets and stable 3.0.0 comparisons. The three remaining engines and all workloads/rounds remain required. Quick mode can choose a subset, has fewer iterations/workloads, and cannot generate release performance notes. Commit the harness before an official run and do not modify its files while it runs. A file hash comparison rejects mid-run changes. Avoid concurrent test suites, builds and other substantial work on the reference machine. The harness works with Node on macOS/Linux/Windows; browser availability is governed by Playwright and the OS.

`bench/releases/` caches downloaded bundles and GitHub metadata; `bench/results/` contains JSON, CSV and Markdown. Both are ignored by Git. Automatic downloads use optional `GH_TOKEN` only for GitHub API requests; credentials are never sent to asset hosts or stored in reports. Remove a version's cache folder to refetch an immutable release if verifying remote metadata again.

## Workloads

`benchmark.config.json` defines seven measured rounds, two warmups, 120 HA assignments, 50/250 media track changes, 100/1,000/5,000/10,000 Graph input points, 20/80/200 map moves and 100/250/500 lifecycle cycles. Forward/reverse version ordering alternates each round. Every round/version has a fresh browser context. Each profile starts in a fresh page/import outside its timed dispatch, and preparation clears fixture local/session storage. This prevents an earlier gesture, module cache or retired frame from changing the next profile. Warm reconnect and cached artwork are warmed explicitly inside their own profile. Desktop and iPhone WebKit results remain separate.

The intersection of the releases' registered cards is discovered at runtime. All common cards have mount, warm reconnect, unrelated and consumed-entity profiles. The common dashboard contains that intersection. Its relevant profile changes `sensor.one`, affecting consumers of that sensor; it does not claim every card changes. News has no remote feeds: its baseline is an empty card, not a feed parsing benchmark. Unrelated assignments change only `sensor.unrelated`. Media uses paused playback to separate HA feedback from time-driven progress. Cold artwork has a unique local URL, cached artwork reuses one URL, and failed artwork receives HTTP 404. Track updates preserve artwork to isolate track metadata/position updates.

Each assignment delivers a new HA object and replaces changed entity records, while reusing the fixture's states dictionary. This isolates card work from allocating/copying the complete HA catalog. It is not a measurement of the full frontend's immutable state-map delivery or allocation cost; the recorded harness hash identifies this fixture model.

Vacuum gestures dispatch synthetic pointer events or constructed native `Touch`/`TouchEvent` objects through the actual event handlers. Chromium uses constructors; WebKit uses its native `createTouch`/`createTouchList` API with `TouchEvent`. A native getter-brand regression rejects prototype-only event substitutes. Neither route is a physical touchscreen input. Every four moves change consumed robot state and the map image URL, then yield a real browser frame. Both feedback counts are recorded; unchanged HA snapshots would test unrelated-update guards rather than live gesture ownership. Scale change proves the operation happened; unchanged scale is a skip rather than a zero-cost win. Pointer pinch is a generation-3-only profile because generation 2 does not implement it. Image and room-marker identity, full-render and overlay-rebuild seams are recorded when observable. Helper profiles add 1,700 unrelated states and compare automatic vs explicit discovery, plus robot configuration switch. Engine session profiling exercises the actual negotiated API v3 bridge against a deterministic fixture transport; it is generation-3-only, not a measurement of a running Engine server or direct Vacuum UI integration.

Graph history generation occurs outside timed dispatch and is reported separately. The fixture returns actual history rows; observed ingested samples and numeric processing seams guard against an empty-chart benchmark. Sections profiles transition the native inline `hui-card`/grid-cell hierarchy between automatic and fixed rows, checking final height/overflow. These are fixture models of HA Sections, not the full HA frontend.

## Measurements and limitations

- `workMs`: accumulated synchronous dispatch wall time. It includes setters/configuration/event handlers, not all asynchronous rendering CPU.
- `settleMs`: elapsed remainder after dispatch, including actual frame scheduling, pending fixture requests, short runtime timers, artwork watches and DOM quiet time. It includes the configured 40 ms quiet floor. It is not CPU time.
- `totalMs = workMs + settleMs`. Chromium's CDP `scriptCpuMs` and `layoutCpuMs` capture asynchronous CPU separately; other engines report these as unavailable.
- Cold startup means a fresh context importing a local release file; it includes transfer/parse/initialization. It does not imply cold OS disk/process/JIT caches. Warm remount reconnects the same instance within the round.
- One observer recursively observes existing light/open-shadow DOM and instruments later shadow attachment. It classifies attributes, child lists, character data and removed-node counts. More records alone do not establish a regression.
- `_render` boundaries are observed when available, including nested registered instances. Missing seams are not equivalent to zero renders. `renderBoundaryMs` may contain numeric processing and is not additive with it. `svgRenderingMs` and complete `paletteWorkMs` are unavailable because no isolated public seam exists. Canvas `getImageData` counts/sampling CPU do not represent the whole palette algorithm.
- Chromium lifecycle uses GC before/after, pauses for fixture cleanup, disconnects/reinstalls the benchmark observer to avoid retaining detached shadow roots, and records used/total heap, connected nodes and CDP DOM nodes. Raw before/after values are retained. Multiple rounds and cycle-count trends matter; an isolated heap delta does not prove a leak. Other engines have unavailable heap values.
- Fixtures contain HA/service/Engine calls and local images. No external account, physical robot, live camera WebSocket, real mobile compositor, notification delivery or HA network latency is benchmarked. Resource ownership/transport replacement is checked separately by browser lifecycle and soak tests.

Instrumentation adds overhead equally but can alter workload cost; do not interpret percentages near the timer resolution or on sub-millisecond baselines as material. Median and nearest-rank p95 are accompanied by raw samples, min/max/mean/count. Seven rounds provide a coarse p95, effectively the largest sample. Inspect repeatability, absolute cost and correctness before classifying a >5% change.

See [results/schema](../docs/benchmarks/README.md), [testing](../docs/testing.md) and [publication workflow](../docs/releasing.md).

## 3.0.x local candidate diagnostics

`pnpm benchmark:maintenance` compares the exact verified published `3.0.0`
asset with the current locally built candidate. It uses the existing fixture,
settling rules and per-engine median/p95 statistics, two warmups and seven
alternating-order samples, including independent map robot/frame/selection
updates, Lock transitions, relevant/unrelated updates, native gestures and
Advanced Vacuum lifecycle/Chromium heap cleanup. `--smoke` checks the new
workloads with one sample and must not be used as performance evidence.

Output is `bench/results/maintenance-<candidate-version>.json`, with candidate
provenance, bytes/hash, source commit/dirtiness, harness checksum, environment,
raw samples, summaries and errors. The current diagnostic runs Chromium,
WebKit and iPhone WebKit emulation; Firefox is deliberately excluded on this
Mac under the owner's instruction. This does **not** weaken the official
published-release evidence gate or supply a Firefox result.

The canonical configuration opts into the new profiles with the internal
`maintenanceUpdates` flag. Historical report configurations without that flag
keep their original workload coverage and remain verifiable.

`pnpm benchmark:maintenance -- --baseline=<published version>` compares the local candidate with any published release instead of `3.0.0`. `--broad` runs every registered card's mount, unrelated and relevant profiles, the 25-card dashboard and the Advanced Vacuum map, gesture, helper and lifecycle profiles; `--iterations` and `--warmups` shorten or lengthen the run. Output is `bench/results/maintenance-<candidate>[-vs-<baseline>][-broad].json`.
