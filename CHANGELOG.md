# Changelog

All notable changes to Quick2DViewer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
