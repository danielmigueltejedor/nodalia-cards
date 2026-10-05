# Nodalia Cards 3 RC readiness audit

**Verdict: NOT RC READY.** This is an audit checkpoint, not a prepared RC. Package/source version remains `3.0.0-beta.1`. No RC tag or release has been created.

## A. Recorded baseline

[Baseline JSON](rc-readiness-baseline.json) was saved before runtime/tooling edits. Real main/HEAD: `1e2eb55d717279499febc56ec39872cb5a160bef`, published beta.1; 25 cards, 284 checked TypeScript modules, zero suppression/cycle debt, 805 passing Node tests, 397 discovered browser tests per engine. Root bundle: 4,146,005 raw / 946,364 gzip bytes, SHA256 `fc7581f760ad67520dfb555c4674118dc9920e07ab9d9be11927858d500e36de`. No production dependencies; 12 languages, 50 card/editor elements, 25 standalone card resources, Engine API 2/3. No open PRs or relevant source TODO/FIXME at baseline. Existing HACS documentation changes and the unrelated duplicate test were preserved.

## B–E. Findings, reproduction and corrections

| Severity | Finding | Red evidence and correction | Remaining risk |
|---|---|---|---|
| High | Summary failed to retire a pending hold when auth changed while connection/user stayed the same | Existing Summary lifecycle test extended with independent auth replacement failed before; capture auth separately and retire holds/embeds before accepting the replacement context | Correct context changes intentionally reset pending private interaction |
| High | Engine could dispatch an old v3 mutation after observing a replacement HA object | Five deterministic regressions failed before: connection/auth/user/admin replacement and explicit cache reset while discovery remained pending. Observe one bounded owner at status/transport entry and check a distinct context epoch before dispatch; same-owner concurrent handshakes remain valid. A legacy-command replacement is also covered | Already dispatched requests remain owned by HA transport; the bridge cannot retract them |
| Medium | Paused Media rewrote identical progress/time/volume values on every unrelated HA assignment, including Summary embeds | Published beta diagnostic observed 480/483 mutation records for 120 unrelated assignments. Deterministic standalone+embedded browser tests failed before; compare values before writes and preserve trim-normalized time text | Mutation counts are operation evidence, not an overall speed claim; real progress/seek/volume remain tested |
| Medium | Summary first unrelated update replaced already rendered hub content | Connected render did not initialize the signature consumed by the HA setter; save the actual render signature after hub/empty render | Child HA propagation remains active, no parking/cache contract change |
| Medium | Humidifier state/width render dropped native focus and could swallow a keyboard action | Full Chromium suite exposed a missing Enter service call; ten isolated retries passed, then a consumed-state update while focused reproduced focus loss deterministically. Restore the focused semantic control after render with `preventScroll`; body, slider and mode regressions fail before/pass after | No old node is stored; absent controls/guards do not receive a fabricated focus target |
| Release gate | Local Firefox cannot start before loading a fixture | Original installation, alternate temporary directory, explicit workspace profile and clean pinned Firefox download all failed with `Could not find profile folder` | No Apple M4 Firefox timings or local compatibility pass can be claimed |
| Release infrastructure | No controlled reference Actions runner is registered | Repository runner API returned `total_count: 0` | Automatic stable evidence workflow must have an operator-provisioned reference runner before it can complete |

[Red and targeted green transcripts](rc-evidence/) are versioned, with ANSI colors removed and the workspace path normalized; exact source commits are listed in [results](rc-readiness-results.json). Raw benchmark samples are preserved without normalization. Quick runs made while the harness was being developed are diagnostic only and are not release comparisons. Runtime fixes add no public API, YAML, card, dependency or visual-design changes.

## F. Critical review of beta ownership and runtime

The beta report was treated as historical evidence, not inherited acceptance. Reviewed `hass-context.ts`, Engine request epochs/negotiation/cache ownership, Media artwork cache/preload/controller retirement, Camera signing/transport lifetime, Graph requests/numeric ingestion, Summary holds/embedded parking, News persistence and device optimistic/gesture contexts. The summary auth hole above demonstrates why connection-only ownership is insufficient even with passing prior CI.

Shared HA snapshots capture user/admin scalars independently of mutable HA objects and compare auth plus connection. Engine cache is one bounded owner/context, status commits use an epoch, v3 mutations reject retired context before dispatch, and API 2 cold fallback remains compatible. Artwork shares URL palette data with bounded 64-entry caches and a four-second failure deadline; subscriber/controller generations retire UI commits without cancelling other subscribers' shared load. This is bounded shared work, not immediate transport cancellation. Numeric validation preserves zero/false and bounds formatter cache size.

Lifecycle suites exercise mount/update/interact/config/entity/disconnect/reconnect/remount/account/auth changes, out-of-order status/history/signing/service/helper responses, cancelled gestures, owned timers/RAF, listeners/observers/subscriptions and camera stream replacement. Source inventory alone is not a cleanup proof; resource-ledger and transport-allocation tests supply that boundary. No new broad ownership refactor was made.

## G. Lifecycle and memory

The correctness ledger supports 24–500 cycles (`NODALIA_SOAK_CYCLES`), tracking owned timers/frames/observers/global listeners, pending HA work, subscriptions and connected DOM. The extended Chromium run passed all 12 cards: 100 cycles and 4,000 HA assignments per card, with no growth in the resource ledger and zero residual observers/frames/subscriptions/pending calls. It is separate from heap measurements.

The permanent harness runs 100/250/500 cycles for Media, Graph, Advance Vacuum and Light with seven samples. Chromium uses controlled GC, before/after used/total heap, connected DOM and CDP DOM node counts. The benchmark observer is disconnected before GC to avoid instrumentation retaining retired shadow roots. Other engines report heap unavailable. No leak/no-leak claim is made from one quick sample or a single heap delta.

## H–I. Compatibility, bundle and contracts

Before the Humidifier focus correction, the complete three-engine suite had 1,207 passes, one Chromium failure and one existing iPhone skip. The focus correction then passed all 18 Humidifier tests in the three engines; the complete suite must be revalidated on the final commit. Four-engine Linux CI passed on final runtime/harness commit 5f34871c: Chromium/WebKit 405 each, Firefox/iPhone WebKit 404 each with one existing skip each. Final local static validation passes all 825 Node tests, strict types/lint/architecture/translations/distribution/build. The Engine owner fix passes all 31 targeted backend tests. Exact-commit CI, HACS, CodeQL and benchmark smoke all pass; see the linked run IDs in the results JSON. Compatibility evidence is separate from the reference performance run.

Current candidate bundle measurement: 4,146,902 raw / 946,679 gzip bytes, SHA256 `97edb7fd8856861a2668fe55d235009be6860aca4f8b6ed245b11b2e58c66924`. This is a working candidate size check, not published RC evidence. Existing budgets are unchanged. Distribution/standalone/custom elements/language tests preserve existing contracts. No production dependencies were added.

## J–L. Permanent performance methodology and evidence

[Harness](../../bench/README.md), [schema/results](../benchmarks/README.md) and [release process](../releasing.md#official-post-release-performance-evidence) describe exact commands. Assets are fetched from published release tags, size/digest verified, SHA256/raw/gzip/brotli recorded. N versions are supported; forward/reverse ordering, warmups, raw samples, median/p95/min/max/mean and complete metadata are retained. Browsers are separate. Common features use an intersection; pointer pinch and API v3 sessions are generation-3-only. Unsupported gestures/seams/CPU/heap values are unavailable rather than synthetic zeros.

`workMs`, `settleMs` and `totalMs` are distinct. CDP script/layout CPU includes asynchronous work separately. Mutation instrumentation observes light DOM, existing and newly attached open shadow roots. Dedicated profiles cover media tracks/artwork, real Graph histories/stages/native row transitions, framed pointer/touch map feedback/identity, 1,700-state helper discovery, robot switch and the API v3 bridge. Fixtures contain external operations; live Engine latency and physical-device FPS are outside their scope.

CI smoke validates the harness/output with no timing percentage threshold. Stable publication dispatches a controlled reference job, then strict evidence validation generates JSON/CSV/Markdown and a fixed representative release notes table. Both raw/gzip and negative results are retained; raw JSON is linked. Missing browsers, dirty/mutated harnesses, errors, incomplete workload rounds or substituted release assets block performance notes. Stable evidence cannot use beta/RC/working tree values.

## M–O. Remaining risks, exact counts and exit

See [machine-readable results](rc-readiness-results.json) for completed and pending gates/counts. A prepared future RC must pass exact-commit static/types/lint/architecture/translations/distribution/Node, Chromium/Firefox/WebKit/iPhone compatibility, HACS, CodeQL, dependency audit, metadata/budget/determinism and benchmark smoke. After publication, download that exact RC asset and measure 2.2.10/beta.1/RC with the committed harness. Any unexpected material, repeatable regression blocks stable promotion.

Physical iOS Safari, actual HA Sections/dashboard load, robot map streams, live WebSocket/notification delivery and account-specific integrations still need real-environment confirmation; emulation/fixtures cannot prove them. Firefox's observed failure is consistent with [Playwright #42768](https://github.com/microsoft/playwright/issues/42768) and [Mozilla #2062988](https://bugzilla.mozilla.org/show_bug.cgi?id=2062988); this inference does not turn it into a passing engine.

The version is not promoted while required evidence is missing. **NOT RC READY** remains the verdict until those gates complete. Architecture/features/public API/YAML/distribution stay frozen and subsequent work is stabilization only.

## Download-boundary security review

CodeQL identified a substring-host matcher in a test and manifest data reused as a download URL; use an exact parsed hostname in the mock and construct the production download URL from the fixed repository/tag/filename. Direct loader calls now validate version syntax before any path/network work, and alternate hosts/files/traversal reject before cache writes. The new regression fails against ae5d0f8 and passes after correction. CodeQL alerts [295](https://github.com/danielmigueltejedor/nodalia-cards/security/code-scanning/295) and [296](https://github.com/danielmigueltejedor/nodalia-cards/security/code-scanning/296) describe intentional dev-only network-to-cache persistence and were reviewed/dismissed as false positives: exact asset validation precedes writes to fixed local filenames; there is no arbitrary upload endpoint or network-controlled file path. No query was disabled and no source suppression was added. The updated CodeQL check passed.

The map fixture was strengthened before the final run: every four moves change consumed robot state and the map image URL, then yield a real frame. During-gesture render/overlay counts and image/marker identity are checked separately from the settled repaint. All 15 benchmark-framework browser tests pass across the three locally available engines. Earlier interrupted/development runs are not saved as accepted official evidence.

## Exact acceptance counts

| Gate | Result |
|---|---|
| Node / static validation | 825 pass, zero failures/skips; strict types/lint/architecture/translations/distribution/build pass |
| Chromium | 405 pass |
| Firefox on Linux CI | 404 pass, one native-touch constructor skip |
| WebKit | 405 pass |
| iPhone WebKit | 404 pass, one duplicate-DPR scenario skip |
| Chromium resource soak | 12 cards × 100 cycles × 4,000 HA updates; no resource-ledger growth |
| Artifact determinism | 37 root JS files, zero drift after another build |
| Dependency audit | Zero vulnerabilities; zero production dependencies |
| HACS / CodeQL / benchmark smoke | Pass on 5f34871c |

The Linux Firefox compatibility pass cannot replace missing Firefox timings on the Apple M4 reference system. The pending performance and controlled-runner gates therefore still prevent RC preparation.

Repository Actions settings were also inspected: the default token policy is read-only and automatic PR creation is disabled. The benchmark job explicitly requests only contents/PR writes. If GitHub blocks its documentation PR, verified data remains on the pushed report branch and the job summary offers a manual comparison link; the already validated release-notes update continues. No repository-wide permissions were broadened. Runner registration is still zero, so automatic measurement itself remains an external prerequisite.

The PR-creation setting corresponds to [GitHub’s documented repository workflow policy](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#preventing-github-actions-from-creating-or-approving-pull-requests). Its observed disabled value was preserved.
