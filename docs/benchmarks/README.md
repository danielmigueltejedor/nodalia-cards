# Official release performance evidence

The current reference system is Apple M4 / macOS / arm64 with 16 GiB RAM. This is an execution environment, not a hardcoded harness requirement. Each report records the actual OS, CPU, RAM, Node, pnpm, Playwright, browser version, viewport and device pixel ratio. Do not mix reference-system runs with shared CI, quick runs, a different fixture revision or another browser.

Use [the harness commands and metric definitions](../../bench/README.md). Official JSON retains every measured sample. CSV exports individual metric samples; Markdown presents median/p95/count, per-card unrelated update deltas, workload detail and explicit skips/errors. The four engines are never averaged. Physical iPhone Safari still needs manual validation; Playwright iPhone WebKit is emulation.

## Result schema, version 1

The validator is `validateResult` in [`bench/core.mjs`](../../bench/core.mjs), exercised by Node and browser regressions. Outputs are always validated before being written. Schema changes require a version increment and documented migration.

| Field | Meaning |
|---|---|
| `schemaVersion` | Exactly `1` |
| `metadata` | Timestamp, quick/official mode, harness commit and file SHA256, harness/working-tree dirtiness, OS/architecture/CPU/RAM and tool versions |
| `versions` | At least two distinct exact published versions, in requested order |
| `assets` | Per-version exact tag, GitHub release/asset ID and URL, publication timestamp, verified SHA256, optional GitHub digest and raw/gzip/brotli sizes; provenance `github-release-asset` |
| `bundle` | Size/hash projection of assets |
| `config` | Effective workload counts, iterations, warmups, browser list and settling limits |
| `browsers` | Each engine's availability/version, viewport/DPR and discovered common-card intersection |
| `samples` | Browser/version/iteration/scenario/scope, finite numeric or null metrics, descriptive details, `skipped` array, runtime errors; lifecycle also contains raw memory before/after |
| `summary` | Per-browser/version/scenario/scope statistics: samples, min, max, mean, median, nearest-rank p95, regenerated from samples by the validator |
| `skips` | Reasons an operation could not be measured; `skipped: []` means success |
| `errors` | Launch, suite, runtime, scenario and harness-change failures; a result with errors exits nonzero |

`null`/zero sample counts mean unavailable, never a fabricated zero. New generation-3 capabilities are separate `3.0-only` workloads and do not enter the generation-2 delta. A report with an unavailable engine remains useful diagnostic evidence but cannot pass the release-notes evidence gate.

## Publication and integrity

`benchmark:evidence` accepts only a clean committed harness, official mode, sufficient complete samples, all four available browsers and no errors. It requires exact published 2.2.10 and the requested stable/RC asset. Stable 3.0.0 evidence cannot substitute beta, RC or a working tree. It writes JSON/CSV/Markdown and a fixed representative notes table, showing regressions as well as improvements and both raw/gzip bytes.

The stable release workflow schedules the controlled reference job after the exact stable asset is published. See [setup and review requirements](../releasing.md#official-post-release-performance-evidence). The resulting notes link to raw hashes/samples and a report branch so evidence is readable before its documentation PR merges. Reports are historical evidence: preserve their original metadata and never overwrite samples to make a release look faster.

No official RC comparison exists until RC is published and measured. A pending or failed run must not be advertised as a completed four-engine benchmark. A CPU delta, mutation count or heap change cannot support a global “3.0 is faster” claim. See the [RC audit verdict](../audits/rc-readiness-report.md) for remaining gates.
