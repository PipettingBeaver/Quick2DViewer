# Changelog

All notable changes to Quick2DViewer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
