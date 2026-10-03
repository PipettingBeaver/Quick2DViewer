# Q2DV evaluation framework

A reusable rubric for judging Q2DV as a protein-analysis UI: how it looks, how the
information flows, and how the feature set holds up. It exists to find weaknesses
deliberately rather than by accident, to score against a concrete class benchmark
("a modern JalView"), and to turn low scores into backlog items.

## How to use it

1. Score each dimension 1-5 using the anchors below. **A score needs evidence**:
   a feature, a test, a user report, or a measured gap. No vibes.
2. Anything scored 1-2 becomes a backlog item automatically; 3s become candidates.
3. Re-score at each milestone (after a QA sweep, before a 1.0 cut). Keep the
   previous table so movement is visible.
4. The benchmark column is deliberately demanding: JalView-class tools have had
   decades of expert users. The point is the gap, not the absolute number.

**Anchors.** 1 = absent or misleading. 2 = present but ad hoc, user must know it
exists. 3 = works with friction or only for experts. 4 = solid, discoverable,
covered by tests or repeated user runs. 5 = exemplar for the class, would be
cited as a strength.

## Dimensions

| # | Dimension | What it asks |
|---|---|---|
| 1 | Discoverability | Can a user find a feature without reading docs? Search, naming, entry points. |
| 2 | Information architecture | Does intake → evidence → rules → report/export form a coherent flow? Are roles of each surface clear? |
| 3 | Onboarding | Can a newcomer get to a first useful result? Wizard, defaults, empty states. |
| 4 | Expert efficiency | Batch, presets, shortcuts, repeatability, macros. |
| 5 | Feedback and state visibility | Does the UI say what is running, what failed, what is filtered, what is stale? |
| 6 | Error recovery and safety | Undo, removal, confirmations, destructive-action containment. |
| 7 | Accessibility | Keyboard paths, focus, ARIA, contrast, colour-independence, motion. |
| 8 | Data integrity and reproducibility | Saves, provenance, citations, exports that another person can re-run. |
| 9 | Extensibility | Cost of adding a provider, track type, or input source. |
| 10 | Performance at scale | Long sequences, many tracks, many models, large sessions. |
| 11 | Trust and honesty | Uncertainty surfaced, sources named, no overclaiming, live-verified APIs. |
| 12 | Benchmark fit (modern JalView) | Alignment work, annotation transfer, expert keyboard operation, ecosystem. |

## First assessment (2026-10-01, v0.66.17)

| # | Dimension | Score | Evidence | Main weakness |
|---|---|---|---|---|
| 1 | Discoverability | 3 | Options → Data Sources categories; guide with coachmarks; Input Data "Data sources…" links | No global search; names drift between docs and UI ("Options" vs "Data Sources") |
| 2 | Information architecture | 4 | Guide is the spine; Tracks tab vs quick controls roles clarified (0.66.7); per-version cards | Many parallel surfaces (Options categories, sidebar tabs, popovers) raise cognitive load |
| 3 | Onboarding | 4 | Wizard questions, guide short form, empty-track markers, reference systems in QA | No one-click sample session; a newcomer still needs a protein and a question |
| 4 | Expert efficiency | 3 | Rule presets, batch imports, TSV/CSV exports, auto-fetch chains | No command palette (planned), no macros (planned), little keyboard operation |
| 5 | Feedback and state visibility | 4 | Activity log, status lines, "(filtered)"/"(Empty)" markers, model provenance button | 3D engine failures are browser-only to diagnose; long jobs rely on the task lockout |
| 6 | Error recovery and safety | 4 | Undo for guide steps, removal framework with confirmations, legacy-save warning | Group removal is one confirmation for a lot of data; no trash/restore after confirm |
| 7 | Accessibility | 2 | Colour encodings are backed by glyphs; buttons are native | Hover-only tooltips, no focus management, minimal ARIA, contrast and motion unaudited |
| 8 | Data integrity and reproducibility | 4 | Session save v1, structure hashing/cache, methods report with citations | Structure provenance is session-scoped; export schema not documented for outsiders |
| 9 | Extensibility | 4.5 | Service registry + provider frameworks; phmmer, BLAST, PROSITE, VEP each landed as one registry entry plus tests | Single-file app (~19k lines) and one large test file are approaching the limit |
| 10 | Performance at scale | 3 | Canvas grid, lazy 3D, size guards, structure cache | No perf budget or large-sequence fixtures; alignment is O(N·M) in memory |
| 11 | Trust and honesty | 4.5 | Live-verified APIs with fixtures, citations in tooltips/report, uncertainty markers (partial, conflict, empty) | Provenance not persisted; prediction confidence wording varies by provider |
| 12 | Benchmark fit (modern JalView) | 3.5 | Stronger provenance, integrated workflow, report export | JalView strengths not matched: alignment editing/annotation transfer, keyboard-first use, plugin ecosystem |

**Composite: ~3.6 / 5.** The three levers with the best return are, in order:
**accessibility** (7), **discoverability via search** (1), and **performance at
scale** (10). Expert efficiency (4) follows once search and macros exist.

## Blindspots parsed

These are the known unknowns this assessment is built on, kept explicit so they
are not mistaken for verified strengths:

- Headless WebGL cannot run the 3D viewer, so its visuals are verified by unit
  tests plus hand-driving only.
- Structure provenance is session-scoped: restored sessions read "Local model".
- Accessibility has never been audited (no screen-reader pass, no focus-order
  test, no contrast measurement).
- No large-input fixtures: titin-scale sequences and 50+ track sessions are
  untested.
- Search and macros are planned, not built.
- Documentation dates before 0.66.1 are stale; QA Round 2 is partly undriven.
- Species detection needs a header OS= tag or a UniProt accession; a bare FASTA
  is manual. VEP mapping depends on UniProt xref quality (mouse P02340's first
  xref does not match its canonical sequence) and fails gracefully to the
  hand-off links.
- PolyPhen is not returned by the Ensembl VEP REST service; the in-app SIFT call
  is the only species-aware score.

## Derived weakness backlog

| Priority | Item | Dimension |
|---|---|---|
| 1 | Feature search (navigation, show-where) | 1 |
| 2 | Accessibility pass: keyboard, focus, ARIA, contrast | 7 |
| 3 | Performance budget + large-sequence/many-track fixtures | 10 |
| 4 | Persist structure provenance across saves | 8 |
| 5 | Macro recording and dry-run replay (planned, DESIGN 18) | 4 |
| 6 | One-click sample session for onboarding | 3 |
| 7 | Document the session/export schema for outsiders | 8 |

## Cadence

Re-score after each QA sweep and before any 1.0 decision. Record the date, the
version, and one line per changed dimension. The composite is a conversation
starter, not a gate.
