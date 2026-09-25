# Changelog

All notable changes to Quick2DViewer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.25.0] - 2026-09-25

### Added

- **One API task at a time.** Long-running Guide actions (HMMER hmmscan, Foldseek, ESMFold)
  now lock: a second click is refused, every task button is disabled while one runs, the
  running button shows a spinner and reads *Working…*, and a **live-timer toast** says what is
  happening ("Foldseek search (pdb100) with model.pdb running — 12 s") before turning into a
  success/error summary. The lock is shared by the Guide, the Input Data buttons and the
  Analyze menu, so no entry point can start a duplicate job.
- **Domain rows have a real ℹ tooltip.** `DM_` rows used to fall through to the blank
  "… (Structural Prediction)" placeholder. They now name the family and description, attribute
  the source (Pfam via HMMER hmmscan), report the best i-Evalue / bit score, list the covered
  spans, and cite Pfam + HMMER.
- **Step links**: the homologs step links *MPI's HHpred*; the topology step links TMHMM,
  Phobius and DeepTMHMM. `WORKFLOW.md` renders them as Markdown links.
- **The intake can rule a step out.** Answering "No" to membrane-associated now marks the
  topology step **not relevant**: it leaves the recommendation and the coverage count (instead
  of being looped back to) and the card says why. Answering "Not sure" keeps it optional.
- **Foldseek prerequisite.** The step states it needs at least one attached structure, offers
  **Attach Structure(s)** when none is attached, and its hint is explicit that only the active
  model is searched — attaching more models does not widen the search.
- **Guide coachmarks.** "Open Analysis Rules…" / "Interfaces…" from the Guide collapse the
  other Tracks sections, open the target (surfacing the suggested presets) and leave a banner:
  *"From the Guide: pick every rule that applies to this protein, then **Return to Guide**"*.
  Leaving the Tracks tab, or closing the section, clears it and restores what was open.

### Changed

- Homolog rows now default to the **AA letters** view. The intended default never actually
  applied: the default track-control state still carried a `fullBar.HH` key from before the
  `HH_` → `HL_` rename, so the setting was written to a group that no longer exists.

## [0.24.0] - 2026-09-25

### Fixed

- **UniProt name search did nothing.** The `text_search` provider pointed at the EBI
  Proteins API (`/proteins/api/proteins`), which no longer responds — every request
  timed out at 12 s in testing (verified 2026-09). Replaced with **EBI Search** over
  the UniProt index (`/ebisearch/ws/rest/uniprot`), which returns the accession in
  ~1 s; the dead provider stays registered but disabled, with the reason recorded.

### Added

- **Plain FASTA / sequence-only start.** Paste a `>header` plus sequence (via
  *Show raw text* or *Paste Quick2D*) and Q2DV builds a sequence-only session — the
  reference row plus the parsed identifier — so predictions, homologs and annotations
  can be layered on afterwards. Quick2D output still takes precedence when present.
- **Identifier-line parsing** (`sp|P42212|GFP_AEQVI Green fluorescent protein OS=…
  GN=…`, i.e. Quick2D's Protein ID line or any FASTA header) into database, accession,
  entry name, protein name, organism and gene.
- **Lookup defaults + autocorrection.** With a parsed identifier the lookup lands on
  **Accession** (pre-filled) when there is one, otherwise **Search (protein)** with the
  name. A pasted header line — or an empty box while a label is loaded — is
  autocorrected to the entry name (e.g. `GFP_AEQVI`), announced with a top-right toast:
  *"Autocorrected EBI Search to "GFP_AEQVI". Running in the background — you can leave
  this panel."*
- **Lookup progress line** at the top of the UniProt section: mode, field, query, an
  estimate (search 1–5 s, accession 1–3 s, sequence 3–8 min) and elapsed seconds.
- **"Any field"** search option (bare query) — the form that actually matches entry
  names and accessions.
- **Data Sources accordion.** Conservation Scoring / Annotation Offload (UniProt) /
  Topology (membrane) are now collapsible, with only UniProt open; opening it re-applies
  the defaults, so *Find UniProt accession* lands on an expanded, pre-filled section.

### Changed

- *Show raw text ▾* now sits beside *Paste Quick2D* as a pair, and the Import section
  carries the line "Copy and paste data from MPI's Quick2D or FASTA." with the Quick2D
  page linked.
- The raw-text placeholder mentions FASTA, and the parse failure message covers both
  inputs.
- Test harness: `getElementById` now returns a **stable** element per id (it used to
  hand back a fresh stub per call, so `input.value` never persisted). That makes
  input-driven code paths testable; the suite grew from 240 to 273 checks.

## [0.23.0] - 2026-09-25

### Added

- **TM cross-check** (Analyze → *Cross-checks…*, or the topology step's
  *Cross-check TM* action). Compares the pasted topology consensus against the
  Quick2D transmembrane call and writes one **Cross-checks** (`XC_TM`) row:
  `=` both predict TM, `t` topology only, `q` Quick2D only. The panel reports
  per-class counts, 1-based segment ranges and an agreement percentage, and each
  disagreement class can be turned into a selection. Pure client-side; refuses
  clearly when either input (or the sequence) is missing. The guide's read-out
  names the disagreement count when both inputs exist but the cross-check has not
  been run.
- **Methods summary export** (Export → *Methods summary (.md)*, and a button in
  the Guide tab): a Markdown methods record with the intake answers, a workflow
  coverage table (status + the per-step answers), the loaded evidence grouped by
  type, analysis rules in readable form (with preset ids), the TM cross-check when
  run, the automated read-out, and the citations for **covered steps only**.

### Fixed

- **Rules never re-evaluated when data changed.** A preset added before its inputs
  existed produced no row, and a `RULE_` row could outlive the track it queried.
  `renderViewer()` now calls `reevaluateRulesIfNeeded()`, with a re-entrancy guard
  in `applyRules()`.
- **A rule matching nothing added an empty row**; such rules now produce no track
  (consistent with the conservation zero-input fix in 0.21.0).
- **Session restore disagreed with its own tracks.** `topologySources`,
  `uniprotFeatures`, `uniprotFeatureTracks` and `domainHitsInfo` were not
  persisted, so after a reload the guide read steps as not-done, Options showed no
  topology sources, and removing one restored `TP_` row rebuilt the group from an
  empty source list (wiping them all). All four are now saved and restored.

### Added — QA

- `QA_CHECKLIST.md`: a breakage-oriented checklist for everything added this
  session (v0.16.0 → v0.23.0), including cross-cutting state risks and the known
  gaps, since the harness runs against a stubbed DOM and no UI has been verified
  in a real browser.

## [0.22.0] - 2026-09-25

### Added

- **Rule presets** — the eight curated rules from `DESIGN.md` §11 ship in the Rules
  panel (*Presets (curated rules)*), each with its rationale, a readable query, a
  **needs …** note when an input is missing, and DOI-verified citations:
  *Topology contradiction (QC)*, *Conserved buried residue*, *Conserved exposed
  patch*, *Rigid, well-folded core*, *Flexible / disordered region*, *No-model-
  confidence region*, *Conserved but poorly modelled*, *Signal / topology feature*.
  One click adds the rule (deep-copied, so editing it never rewrites the preset);
  re-adding gives a numbered name.
- **Profile → presets.** Suggested presets are ranked to the top from the guide's
  intake answers and the loaded data (membrane → topology/QC presets; variants +
  conservation → conservation presets; a model → confidence presets), and the
  guide's automated read-out names them when no rules exist yet.
- **`group:<GROUP>` rule condition source** — "any track of this type is
  annotated", so presets and hand-written rules survive re-running a predictor or
  swapping a database instead of naming one specific track key. Group sources are
  offered in the rule editor too.
- **pLDDT `mean`/`min` aggregates now work from a single model** (they previously
  required two or more), which the confidence presets depend on.

### Changed

- `WORKFLOW.md` now also documents the preset library (query, rationale,
  citations); the harness asserts every preset name and DOI is present, so the
  document cannot drift from the app.

## [0.21.0] - 2026-09-25

### Added

- **Remove tracks** — hiding is a view choice, removal deletes data. Until now only
  `Reset Data` could clear a stray fetch. You can now remove:
  - **one track** — right-click it → *Remove this track…*, or the **×** next to it
    in the Tracks tab;
  - **a whole type** — *Remove type…* in the per-type popover, or the **×** on the
    type row in the Tracks tab.
  Removal unpicks the backing data as well as the row, so a later re-parse or
  recompute cannot silently resurrect it: homolog hit info, Pfam domain stats,
  the UniProt feature registry (removing the last row clears the fetch), rule
  definitions, the pasted topology source, and variant records plus the derived
  conservation row. Per-track view/filter/hide state is cleaned up too. The
  sequence (`AA`) is refused — that routes to Reset Data. Every route confirms.
- **Guide "Undo"** — once a step reads as done, the guide offers *Undo this step*,
  which removes exactly what that step added (Foldseek undo removes only its own
  hits; the sequence step routes to *Reset all data…*). Manual done/skip overrides
  are left untouched, so "marked done" and "has data" stay independent.

### Fixed

- Removing the last conservation input rebuilt the row as all-zeros instead of
  dropping it. `recomputeConservationScores()` now deletes the row when there are
  no input sequences left (e.g. the last variant was removed).

## [0.20.0] - 2026-09-25

### Added

- **Per-step wizard questions.** Each step now asks its own short questions, and
  the answers pick the *concrete* action and defaults to offer instead of a
  generic one:
  - Sequence → Quick2D / FASTA / UniProt accession → *Attach / paste FASTA* or
    *Fetch UniProt entry*.
  - Annotation → accession / search / **domains only** → *Fetch UniProt* or
    *Scan HMMER/Pfam*.
  - Homologs → no `.hhr` yet → *Open HHpred ↗*.
  - Structure → AlphaFold DB / PDB-CIF / ESMFold → *Fetch AlphaFold model…* /
    *Attach PDB…* / *Predict with ESMFold* (with the ≤400 aa hint).
  - Foldseek → database choice → *Run Foldseek (pdb100)*, and the choice also
    sets the Foldseek database control.
  - Topology → TMHMM / Phobius / DeepTMHMM / none → *Paste … output…*
    (opens the topology box) or *Open a predictor ↗*.
  - Integrate → variant triage / interface / construct / figure → Rules /
    Interfaces / command generator / export.
  - The generic action stays on the card as a secondary button when an answer
    overrides it; re-clicking an option clears it; "reset answers" clears all.
- `openTopologyPanel()` opens Options → Data Sources and scrolls to the topology
  paste box.
- `WORKFLOW.md` now also documents the per-step questions and their options, and
  the harness asserts the document lists them.

## [0.19.0] - 2026-09-25

### Added

- **Guide tab.** The Evaluation Guide now has its own sidebar tab
  (Selection / Tracks / **Guide** / Workflow); the Workflow tab keeps the External
  Workflow command generator. The Input Data modal's checklist is now a
  **read-only indicator** that mirrors the guide (same steps, same status, same
  overrides) and links to it — so the pipeline is maintained in one place.
- **User overrides on every step** — the guide is advisory, so you can now:
  - **Mark done** (settled outside Q2DV) or **Clear "done"** to return to
    auto-detection;
  - **Skip** a step (out of scope) — skipped steps leave the progress count and
    are never recommended, or **Unskip** them;
  - **Re-run** any step's action at any time — the action button is never
    disabled, and reads *Re-run: …* once the step is done, so a category can be
    refreshed when partial data was already added.
  Each card states whether its status came from auto-detection or from you.
- **Citations per step** — every step lists its evidence base as DOI links, plus a
  *promoted when* note explaining when the intake questions recommend it.

### Added — external reference document

- **`WORKFLOW.md`** — the characterization workflow as a standalone reference
  document (purpose, rationale, interpretation, citations per step), **generated
  from the app** by `npm run doc:workflow` (`tools/build-workflow-doc.js`) and
  linked from the guide header. The test harness asserts the document contains
  every step title and DOI, so it cannot drift from the code.

### Fixed — citation accuracy

- Six DOIs carried in `DESIGN.md` §11 resolved to **unrelated papers**. Every DOI
  in `WORKFLOW_STEPS` was re-resolved against the Crossref API (2026-09) and
  corrected: TMHMM `10.1006/jmbi.2000.4315`, Ruff & Pappu `10.1016/j.jmb.2021.167208`,
  Capra & Singh `10.1093/bioinformatics/btm270`, Lichtarge et al.
  `10.1006/jmbi.1996.0167`, Valdar & Thornton
  `10.1002/1097-0134(20010101)42:1<108::aid-prot110>3.0.co;2-o`.
  `DESIGN.md` §11 now records the old→new mapping so the correction is auditable.

## [0.18.0] - 2026-09-25

### Added

- **Evaluation Guide** (Workflow tab) — the literature-backed characterization
  pipeline as a visible, adaptive framework:
  - **8 steps** (sequence → primary-structure features → curated annotation &
    domains → homologs & conservation → structural model → structural homology →
    topology → integrate & export), each with *why it matters*, the in-app action
    that satisfies it, and *how to read it*.
  - **Intake questions** (membrane/secreted, structure, homologs, variants,
    unknown function) re-rank steps as **recommended** vs **optional** and are
    persisted with the session.
  - **Live status + Next:** — progress is measured against the actually-loaded
    tracks, and the guide always names the highest-value unfinished action.
  - **Automated read-out** — advisory warnings from the loaded data: low mean
    pLDDT, no/low-identity homologs, membrane flagged without TM data, variants
    flagged without a variant FASTA, domains without curated boundaries.
- The Input Data checklist and the guide now render from one `WORKFLOW_STEPS`
  definition, so the two views cannot drift.

### Notes

- Everything remains manually reachable: each guide action is the same function
  the menus call, and the full track/metric/tool suite is unchanged.
- See `DESIGN.md` §12 for the model and the next iterations (per-step citations,
  profile-driven rule presets, topology cross-check, methods-report export).

## [0.17.0] - 2026-09-25

### Added

- **HMMER hmmscan (Pfam) domain scan.** Analyze → *Scan Domains (HMMER)…* (or the
  Input Data button) submits the sequence to the EBI Job Dispatcher and adds **one
  track per significant Pfam family**, grouped under a new **Domains** track type,
  with provenance `HMMER (Pfam)`. Only domains above HMMER's inclusion threshold
  (`!`) become tracks; per-family stats (best i-Evalue/score, domain count) are kept.
  Runs through the existing `domain_scan` capability, so providers are swappable.

### Fixed

- The EBI HMMER endpoint moved: the old `/Tools/services/rest/hmmer3/` now answers
  *"Tool 'hmmer3' was not found"*. The live tool id is **`hmmer3_hmmscan`**
  (verified CORS-enabled, `access-control-allow-origin: *`). hmmer3 exposes **no JSON
  renderer**, so the `ebiJob` adapter gained a `resultExt` option and parses the raw
  HMMER text output.

### Changed

- **Track Control ↔ Tracks tab cross-links**: the per-type popover has a **Config…**
  button (Conservation Scoring / cutoffs / predictor info in one click), and both
  menus link to each other so there is a single manager home from either side.

## [0.16.0] - 2026-09-23

### Changed (design pass — see `UX_GUIDELINES.md`)

- **Legend** is now **hidden by default** (the existing Show/Hide Legend button remains
  the single toggle), reordered to match the track order, and its pLDDT/RSA rows appear
  only when that type is shown as a graph — so it no longer occludes tracks.
- **Graph vs heatmap is now a "View as" option** on the pLDDT/RSA rows in Track Control
  (and the View menu); the redundant sidebar "Graph view" checkboxes are removed.
- **Sidebar**: "FASTA Segment" and "Quantitative Metrics" are collapsible sections, so
  the Selection tab is much shorter.
- **Microcopy**: a single-residue selection reads "Residue 148" rather than
  "Residues: 148 - 148 (Length: 1aa)".
- **Menus**: Options moved to **File**; Data renamed **Analyze** (Data & Structures,
  Analysis Rules, Interfaces).
- **Polish / accessibility**: type badges reveal on row hover (kept while active);
  `:focus-visible` outlines on interactive controls; `prefers-reduced-motion` respected.

## [0.15.2] - 2026-09-23

### Changed

- Tracks panel: removed the stray "per type → expand for tracks" helper text, and
  compacted the expand/collapse-all controls to `+` / `−` icon buttons (with tooltips).

### Added

- **New-feature QA highlights** — new UI is tagged with a purple dashed outline
  (`.qa-new`) so it is easy to spot and test, instead of verbose comments. Toggle via
  **File → New-feature highlights**. First applied to the Tracks / Rules / Interfaces
  sections and the lookup / predict-ESMFold / Foldseek row.
- **`UX_GUIDELINES.md`** — a design-pass checklist grounded in modern UX research
  (Nielsen, WCAG 2.2, Gestalt, Tufte, 2026 practice), with Q2DV-specific application
  notes, visual tokens, and anti-patterns to avoid.

## [0.15.1] - 2026-09-23

### Changed

- **Tracks tab is now compact.** The "Tracks" list is a collapsible section and each
  track type is an **accordion** — collapsed by default (header shows type + count +
  show/hide eye), chevron to expand its individual tracks, plus **expand all /
  collapse all** buttons. The sidebar no longer scrolls past every track.

## [0.15.0] - 2026-09-23

### Added

- **Client-side interface analysis** (right sidebar → Tracks → Interfaces, or
  Data → Interfaces…): finds residues at chain–chain interfaces in the active/first
  multi-chain structure (CA–CA contacts within a configurable cutoff, default 8 Å),
  adds an `IF_<chain>` track per chain (own "Interfaces" Track Control group), and
  shows a chain-pair contact table. Runs entirely client-side, so it works on
  AlphaFold / ESMFold models (PDBe PISA only covers deposited entries).

### Fixed

- The **Rules panel is now expanded by default** and reachable from
  **Data → Analysis Rules…**. (It lives in the right sidebar's **Tracks** tab — not
  the Track Control popover at the top-left.)

## [0.14.0] - 2026-09-23

### Added

- **Analysis Rules panel** (Tracks tab → Rules): define boolean queries across
  per-residue tracks — numeric conditions (Conservation; pLDDT per-model / mean / min;
  RSA) and categorical conditions (any string track: is annotated / is not annotated /
  equals char) — combined with **ALL (AND)** or **ANY (OR)**. Each enabled rule becomes
  a coloured `RULE_` track (its own Track Control group) and a "select" action turns its
  matches into a selection. This is the contradiction / co-localization engine's open
  config framework; literature-backed presets will be layered on next.

## [0.13.1] - 2026-09-23

### Changed (UI polish)

- **Track-row / sidebar cleanup.** The per-type `tctl-chevron` is now a ghost caret
  (no heavy box or border): muted by default, darkens on row hover, blue accent when
  the type's view is non-default (`state-on`), and white on the active row. Row labels
  and info icons are lighter (the ⓘ shows just the glyph until the row is hovered),
  rows get subtler hover tints + transitions, and a layout-neutral separator line marks
  the first row of each track type.

## [0.13.0] - 2026-09-23

### Added

- **Foldseek structural homology** (Input Data → "Find structural homologs
  (Foldseek)"): searches a structure database (`afdb50` / `pdb100` / `swissprot` /
  `bfvd`) using the active or first attached model, and adds each hit as an `HL_`
  track (match-quality glyphs + template residues) tagged `source: Foldseek`. Hit
  PDB ids are extracted so they load in the 3D viewer and appear in the Homolog
  Templates table.
  *Note:* Foldseek's server-side sequence (ProstT5) path currently errors for every
  job, so Q2DV queries with the **structure** — which is what it has (AlphaFold /
  ESMFold models).

## [0.12.0] - 2026-09-23

### Added

- **ESMFold structure prediction** (Input Data → "Predict structure (ESMFold)"):
  predicts a 3D model for the current sequence (≤400 aa) and attaches it through the
  normal structure pipeline, so pLDDT / RSA / cofactors / 3D all light up — tagged
  `source: ESMFold`.
- **Config-driven service registry** (`SERVICE_REGISTRY`): each *capability* maps to
  an ordered provider list with automatic fallback (e.g. UniProt REST → EBI Proteins;
  add a second BLAST provider and it is tried if the first fails). Adapters:
  `uniprotRest`, `ebiFeatures`, `ebiSearch`, `ebiJob` (EBI submit/poll/result),
  `esmfold`; Foldseek and HMMER providers are pre-declared but disabled.
- **External-services opt-in**: the first outbound API call asks once; flip it in
  File → External services. The choice persists.

## [0.11.0] - 2026-09-23

### Changed

- **Homolog tracks renamed `HH_` → `HL_`** (generic "Homolog"), with a `source`
  field on `homologHitsInfo` so HHpred / Foldseek / HMMER homologs can coexist and
  be tagged by origin.
- **Track provenance (`trackMeta`).** Every track now reports its source
  (Quick2D / HHpred / UniProt / Topology / Conservation / Structure / Variant
  FASTA), shown in the residue hover tooltip, the Tracks manager, and the Homolog
  Templates table. `trackMeta` holds overrides for sources not inferable from the key.

## [0.10.1] - 2026-09-23

### Changed (housekeeping)

- Committed a headless test harness (`npm test` → `tests/run.js`) covering app load,
  version↔changelog sync, every track-row type, conservation, UniProt/topology
  parsing, homolog template scoring, exports, changelog rendering, and escaping.
- Replaced blocking `alert()`/`confirm()` with toasts + a confirm modal (also makes
  the app automation-friendly).
- Escaped track/file-derived text in tooltips and tables (cross-ref labels, metrics
  table, structure table, predictor tooltips).
- Centralized external service endpoints in `SERVICE_URLS` (with the CORS-verified
  entries for Foldseek / ESMFold / EBI HMMER noted for the upcoming integrations).
- Removed dead code/CSS left over from the UI restructures.

## [0.10.0] - 2026-09-23

### Added

- **In-app Changelog.** The version badge next to the title is now clickable and
  opens a modal rendering `CHANGELOG.md` (fetched from the same folder; with a
  direct-link fallback when opened as a standalone file).

## [0.9.2] - 2026-09-23

### Fixed

- Removed the redundant "Input Data" button from the sidebar toolbar (the same
  panel is reachable from File → Input Data).
- Workflow checklist / summary now refresh from both upload-handler paths
  (structure batch and save-only), so they update live during a batch import.

## [0.9.1] - 2026-09-23

### Fixed

- Empty-viewer message now points to File → Input Data.
- The Input Data workflow checklist + summary now refresh live while the modal
  is open during a batch import (previously only on open).

## [0.9.0] - 2026-09-23

### Changed (UI restructure, Level B)

- **Tabbed sidebar**: Selection / Tracks / Workflow panels.
  - **Tracks** tab: a JalView-style track manager — one row per type (with a
    show/hide eye) and an indented row per individual track, sharing the Track
    Control visibility state.
  - **Workflow** tab: holds the collapsible External Workflow (command generator).
- **Top menu bar** (File / View / Data / Export / Help) replaces the header buttons.

## [0.8.0] - 2026-09-23

### Changed (UI restructure, Level A)

- **Legend** is now a floating, click-through overlay in the viewer (with a
  reactive per-residue hover tooltip showing track name, color, and annotation).
- **Options** modal split into tabs: Appearance / Data Sources / Workflow / Storage.
- **Tool buttons** (Options/Data/Help/3D/Export) moved to a slim app-header toolbar.
- **Per-type graph view**: pLDDT and RSA each have their own graph/heatmap toggle
  (replaces the global Heatmap/Graph mode).
- **Unified Input Data panel** (replaces the import toolbar): import, a loaded-data
  summary, an auto-lookup shortcut, and a characterization workflow checklist.
- **External Workflow** section in the sidebar (collapsible) now holds the
  ChimeraX/PyMOL/VMD command generator.

## [0.7.0] - 2026-09-23

### Added

- **Topology (membrane) consensus bar.** Paste TMHMM-style segments or a DeepTMHMM
  JSON to add per-residue inside / TM-helix / outside tracks (Options → Topology);
  two or more sources produce a majority-vote **Consensus** track. Each state is
  colored distinctly and grouped under "Topology" in Track Control.

## [0.6.1] - 2026-09-23

### Changed

- UniProt load status now reports a per-type breakdown (e.g. "9 Transmembrane")
  instead of just "9 features".

## [0.6.0] - 2026-09-22

### Added

- UniProt annotation offload gains a **Search** lookup mode: find an accession by
  gene / protein / organism name (via the EBI Proteins API, fast) and pick one
  from the results to load its annotations — no need to know the accession or
  run a slow BLAST.

## [0.5.7] - 2026-09-22

### Fixed

- UniProt BLAST polling is now resilient: a single stalled status check no longer
  aborts the whole run (it retries the same job), status timeout raised to 60s,
  and the overall window extended to 15 min so slow EBI jobs finish.

## [0.5.6] - 2026-09-22

### Changed

- UniProt annotations now render **one row per feature type** (e.g. "Transmembrane",
  "Signal", "Disulfide bond") instead of collapsing many types into coarse buckets,
  so distinct features are visually distinguishable and clearly labelled.

## [0.5.5] - 2026-09-22

### Added

- **Debug log** for the UniProt annotation pipeline (Options → Annotation Offload):
  a timestamped, copyable log of every BLAST submit/poll/result step and every
  feature-fetch attempt, mirrored to the browser console.
- BLAST sequence mode now retries the whole job once on failure.

## [0.5.4] - 2026-09-22

### Fixed

- UniProt annotation offload now falls back to the **EBI Proteins API**
  (`www.ebi.ac.uk/proteins/api/features/{acc}.json`) when `rest.uniprot.org` is
  unreachable — some networks/browsers can reach one domain but not the other.

## [0.5.3] - 2026-09-22

### Fixed

- UniProt accession fetch: added a one-shot retry and a clearer diagnostic when
  the request fails at the network layer (Firefox "NetworkError"), pointing to
  browser tracking protection / extensions / DNS as the likely cause.

## [0.5.2] - 2026-09-22

### Fixed

- UniProt **Sequence (BLAST)** mode no longer aborts on slow networks: raised the
  submit/status/result timeouts (90s/30s/60s), added a one-shot submit retry, and
  limited BLAST to 5 alignments at `evalue < 1e-3` (the job still takes ~1.5–2 min,
  which the live progress now reflects).

## [0.5.1] - 2026-09-22

### Fixed

- UniProt **Sequence (BLAST)** mode: added live progress (job id + elapsed time +
  raw status) and per-request timeouts, and extended the polling window from ~1 min
  to ~5 min so a real UniProtKB BLAST finishes instead of silently timing out.
  Removed the misleading "blocked by CORS" message (the EBI endpoint supports CORS).

## [0.5.0] - 2026-09-22

### Added

- **UniProt annotation offload** (Options → Annotation Offload). Fetch curated
  residue-level annotations (domains/regions, topology/signal, active/binding
  sites, PTMs, variants) and render them as rows in the viewer. Two lookup
  modes: **Accession** (direct `rest.uniprot.org` lookup) and **Sequence**
  (BLAST-resolves the current sequence first); mode + accession persist.

## [0.4.0] - 2026-09-22

### Added

- **Homolog Templates table** in the Data modal. HHpred hits are ranked by a
  combined template score (probability × identity × query coverage), with
  identity, coverage, probability, E-value, and structure availability
  (cached / RCSB-fetchable) per homolog, the top hit highlighted, and a
  per-row "3D" action to load that homolog into the viewer.

## [0.3.0] - 2026-09-22

### Added

- **Export menu** (top-right of the sidebar). A single "Export ▾" dropdown with:
  - Export Q2DV Data as JSON (reuses the save-file export)
  - Export Data as TSV / CSV (pLDDT/RSA metrics, computed on demand over the
    current selection or the full sequence — no need to open the Table modal)
  - Export Viewport as SVG / PNG (grid heatmap *and* graph view, dependency-free:
    rows rebuilt by reading the live DOM's computed colors, graph sections
    serialized from their inline-styled `<svg>` nodes; PNG rasterized at 2x)

## [0.2.0] - 2026-09-22

### Added

- **ConSurf-style conservation coloring for the 3D viewer.** "Conservation" is
  now a base coloring scheme (cycled via the Color button) that paints the whole
  model by per-residue conservation using a continuous 9-color gradient
  (rose → yellow → blue, "blue = conserved", matching the heatmap convention).
  It becomes the default scheme automatically once conservation data exists
  (variant FASTA imported or metric switched), and recolors on demand.
- **Version badge** next to the header title, driven by `APP_VERSION`
  (kept in sync with this changelog).

## [0.1.0] - 2026-09-22

Initial public version: a single-file, dependency-free HTML/JS/CSS viewer that
overlays sequence-based predictions (MPI Quick2D) with structure-derived
annotations (pLDDT, RSA, cofactors) for a single target protein.

### Added

- **Views**: heatmap grid (one row per track, per-residue colored cells, pinned
  AA header + residue ruler) and an overlaid graph view (pLDDT/RSA SVG line plots
  over annotation rows, per-model overlays, clickable points).
- **Selection**: drag, additive (Ctrl/Cmd) disjoint selection, row-scope drag,
  type-badge/score-band/residue-class selection, keyboard navigation, and five
  color-coded saved-selection slots with name labels.
- **Sequence search** with curated motif presets (PTMs, localization/trafficking
  signals, binding motifs, compositional stretches) plus regex and case toggles.
- **Conservation scoring** (Shannon entropy / JSD-vs-BLOSUM62 / Wu–Kabat) over
  imported variant FASTA, optional HHpred homolog inclusion, and auto/aligned/
  unaligned alignment modes (Needleman–Wunsch, BLOSUM62).
- **Variant tracks** with per-cell match/mismatch shading against the reference.
- **Homolog tracks** (HHpred) with match-quality coloring, AA-sequence mode, and
  conservation-color mode.
- **Track Control**: per-type and per-track "View as" modes (Glyphs / No letters /
  Bar / AA / Hidden), Config frames, and per-track overrides.
- **Embedded Py3Dmol viewer** with RCSB auto-fetch for PDB-ID homologs,
  selection→structure coloring, and base color schemes.
- **Selection → ChimeraX / PyMOL / VMD command generation** with match-color mode.
- **Persistence & data**: metrics table, options/data/help modals, JSON save-file
  export/import, device-local IndexedDB structure cache, and auto-save.
- **Accessibility**: keyboard navigation, modal focus management, selectable
  annotation color palettes (incl. colourblind-safe), and tooltips.
- **Horizontal accordion zoom** (4–12 px/column) with cursor-anchored Ctrl+wheel.
