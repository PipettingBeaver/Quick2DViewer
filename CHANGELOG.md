# Changelog

All notable changes to Quick2DViewer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

**Versioning (development, day-based).** Every push is a release, so the number doubles as a build
identifier: the second number advances **once per day**, the third advances **per update within that
day** (e.g. 0.66.1 -> 0.66.2 on the same day; the next day starts 0.67.0). Features and fixes are
distinguished by the sections below, not by the number. Dates before 2026-10-01 were recorded as the
same stale value and are not reliable; from 0.66.1 on they are the actual release dates. The 1.0.0
milestone is reserved for the point where the feature set is declared stable (after the QA and copy
sweeps), from which the usual feature/patch cadence resumes.

## [0.66.12] - 2026-10-01

### Fixed
- **Lock Model no longer freezes the colouring.** Locking now keeps the current structure
  loaded (the model no longer auto-switches when the selection moves to another homolog),
  while highlighting a new line still recolours the model. The status line says
  "(model locked)" so the scope is clear.

## [0.66.11] - 2026-10-01

### Fixed
- **Partial-coverage tag moved out of the track name.** Homolog rows showed "(partial N%)" in the
  sidebar label, crowding out the hit name; the covered range now lives only in the row tooltip
  (the info icon already carried it).
- **3D colour conversion.** Numeric track colours (pLDDT / RSA / experimental) were handed to
  3Dmol as CSS `rgb(...)` strings; they are now converted to the `0xrrggbb` form the renderer
  expects, matching the selection and conservation paths.

### Changed
- **3D colour picker grouped and extended.** Options are grouped **Flat colour** (rules,
  validation, interfaces, topology consensus, homolog hits) versus **Per-residue** (pLDDT, RSA,
  experimental, conservation). Conservation is now an explicit track using the ConSurf gradient,
  and a homolog row is painted flat in its model-score colour, so hits of different strength
  read differently on the structure. The picker's bases sit in their own group.

### Docs
- Data Sources paths corrected (Options → Data Sources → Domains / Stability predictions); the
  ddG service flow is marked untested because the sites require an account (links verified).

## [0.66.10] - 2026-10-01

### Added
- **PROSITE motifs via InterProScan.** The domain-scan picker gains a third provider, "InterProScan
  + PROSITE motifs" (`PrositePatterns,PrositeProfiles` on top of Pfam/NCBIfam, live-verified
  analysis names). Signature patterns and profiles arrive as ordinary domain rows
  (`ProSitePatterns:PS00896` etc.), so rules (`group:DM`), tooltips, the 3D colour picker and the
  methods report treat them like any other domain evidence. The run line now names the provider
  from the registry instead of a hardcoded pair.
- **ddG hand-off (stability predictions).** New Options category linking the four services that
  verified as alive (DynaMut2, DUET, mCSM, FoldX suite; ThermoNet/INPS/PoPMuSiC/CUPSAT did not
  respond and are omitted), a **Copy mutation list** helper (one-letter substitution tokens, the
  format those tools expect), and a **ddG import**: pasted `mutation value` lines become an
  experimental row of the new `ddg` kind ("negative = destabilising"), so numbering offsets,
  graphs, tooltips, 3D colouring and the methods report all apply. The experimental importer was
  factored into a shared `addExperimentalRows` used by both paths; the guide's homologs step links
  to the panel when variants are loaded.
- DESIGN §18 records the macro-recording plan (activity log as the base, capability-level steps,
  dry-run replay, stale-sequence guard, JSON storage) - planning only, not implemented.

### Fixed
- Nothing this release.

## [Unreleased]

## [0.66.9] - 2026-10-01

### Added

- **Model-vs-model RMSD matrix in the ensemble panel** (#4b). `computeEnsembleVariance()` now also
  returns a symmetric pairwise RMSD matrix over the shared residues (capped at 12 models), plus the
  mean pairwise RMSD and the most divergent pair. The panel renders it as a heat-tinted table
  (pale = agreeing, warm = divergent) with the pair summary underneath, the activity log records the
  stats, and the methods report gains an ensemble line (mean RMSF + mean pairwise RMSD).

### Fixed

- **`kabschSuperpose()`'s RMSD was always 0** - found by the new matrix test. The quaternion formula
  omitted the reference set's squared-norm term, so `(|P|^2 - 2*lambda_max)/n` was always negative
  and clamped to zero: the ensemble panel's "RMSD to first" column has read 0.00 A for every model
  since 0.34.0. The formula now includes `|Q|^2` (verified: a translated copy superposes to ~0 A,
  a perturbed one reports 0.22 A on a 3-residue toy model). The RMSF values themselves were
  unaffected - they use the fitted coordinates, not this number.

## [0.66.8] - 2026-10-01

### Added

- **Colour the 3D model by any evidence track** (#4a). The 3D toolbar's cycle button becomes a picker
  listing the base schemes (white / spectrum / chain / hydro / conservation) plus every track the
  viewer can speak for: **validation rows** (flagged residues amber, the rest grey), **experimental
  data**, **pLDDT** and **RSA** (the same low-to-high ramp as the Model score colour mode),
  **rules** (the rule's colour against grey), **interfaces** (the chain colour) and the **topology
  consensus** (its inside/TM/outside/signal/conflict colours). Anything visible in 1D can now be seen
  on the structure, through the same residue->colour path the selection and conservation modes
  already used.
  - `p3dColorsForTrack(key)` builds the map (numeric tracks normalise min-max onto the ramp;
    character tracks highlight flagged residues; unassigned consensus positions stay base-coloured);
    `onP3DColorSelectChange()` switches between base and track schemes; the picker rebuilds on every
    toolbar update and keeps its value when a track vanishes, with `syncP3DConservationMode()` now
    also clearing a stale track scheme so the toolbar can never lie.
  - Tests: the map builders per track kind (numeric ramp endpoints/interpolation, character
    highlight vs grey, rule colour, consensus state colours, missing track -> empty), the picker's
    value/change handling, the stale-track fallback, and the toolbar markup.

## [0.66.7] - 2026-10-01

### Changed

- **The Tracks tab and the Track Control popover now have defined roles and cross-link both ways**
  (#2c). The sidebar section is titled **"Track Visibility (full manager)"** with a one-line
  description (every track, grouped by type, own show/hide) and its link relabelled
  **"Quick controls (View as / Color) ↗"**; the popover's header gains **"Full manager ↗"**, which
  closes it and opens the sidebar list (`openTrackManagerFromPopover()` - the inverse of the existing
  link). Shared behaviour is unchanged (both route visibility through the same state), and a track
  filtered in the popover now says **"(filtered)"** in the full manager instead of just looking
  missing.
- **Track-row polish** (#2d): the per-type chevrons (one sits on the first row of every type) are
  subtle until hovered or open, the active row now tints the whole row rather than just the label
  chip (`.track-row:has(.track-label.active-row)`), and row background changes transition instead of
  snapping.
- Verified in the browser: the popover header reads "Track Controls | Hide All | Full manager ↗ |
  Reset"; the full manager shows "(Empty) (filtered) [Quick2D]"; the active row tints end to end.

## [0.66.6] - 2026-10-01

### Added

- **"Model score" colour mode for homolog rows** - the Foldseek TM-score idea, generalised to every
  source. A fourth option in Track Control's Color column, alongside Match quality, Conservation and
  Residue type: each hit gets one comparable 0-100 confidence (the source's own probability where it
  has one - HHpred, Foldseek - otherwise the E-value decade scale used by the template table) shaded
  as a continuous light-red -> amber -> green -> teal gradient. The AA letters show over the shading
  (white on dark), the tooltip names the raw statistic ("model score 99 (98.5% probability)",
  "model score 50 (E-value 1e-5)"), and a hit with neither probability nor E-value is left unshaded.
  - Verified in the browser: HHpred 98.5% -> teal 99; Foldseek 85% -> green 85; BLAST 1e-5 -> amber
    50; BLAST 1e-2 -> 20; the gradient interpolates and clamps.
  - Tests: the score helper per source, gradient endpoints/interpolation/clamping, the mode list, and
    the updated colour-mode assertions.

## [0.66.5] - 2026-10-01

### Added

- **Reference numbering offset (global + per-track).** Imported data sometimes uses different
  numbering than the loaded sequence (a construct missing its N-terminus, a mature chain, a table
  numbered from another start). Input Data now has a **Numbering offset** (source position + offset =
  reference position) plus an **override for the active row**, applied to the positional imports that
  cannot be aligned - topology sources, UniProt features and experimental rows - while sequences that
  can be aligned (models, variant FASTAs, homolog hits) keep their alignment placement and report
  their own shift. Everything re-derives from its raw data, so changing the offset re-places
  immediately, is logged with the shift, and travels in the session save.
- **Partial HSP coverage is now visible, and partial hits are realigned.** BLAST/Foldseek HSPs are
  local, so a short row is normal there; a phmmer or HHpred hit that short is worth a look.
  - Rows covering under 95% carry an amber **(partial N%)** tag, the tooltip names the covered range
    ("Coverage: 50% (residues 2-3)."), and the read-out counts them with the lowest coverage.
  - The homolog search then **fetches each partial hit's full UniProt sequence** (capped at 8, before
    conservation is recomputed) and merges it in: columns the HSP already covered keep their own
    glyphs, the newly covered ones use the BLOSUM62 scale, and the tooltip says so
    ("Realigned from P42212 (columns outside the original HSP use BLOSUM62 glyphs)."). Verified live:
    8 of 13 BLAST hits realigned, e.g. GFPL_CLASP +52 columns to 96% coverage.
  - Failures are counted and logged, never fatal.
  - Tests: the shift helper, all three offset-aware imports, the per-track override, re-placement from
    raw data, persistence, the coverage helper/tag/tooltip/read-out, the merge semantics (HSP columns
    win) and the graceful failure path.

## [0.66.4] - 2026-10-01

### Changed

- **Tone sweep: 26 user-facing strings rewritten to neutral, helpful phrasing** (the rework noted
  during QA). The "Load/Attach/Enter X first" toast family now states the fact and the way forward
  ("Nothing to scan yet: hmmscan searches the loaded sequence against Pfam."), the three guide hints
  drop their negative framing ("AlphaFold DB needs an accession; without one, ESMFold folds the
  sequence directly instead."), and the read-out insights lead with the observation instead of the
  absence ("Homologs cross-check the sequence predictions; add them with Search homologs (in-app),
  an HHpred .hhr, or Foldseek."). Meaning is unchanged; tests updated to the new wording.
- **Legacy saves are explained rather than mysterious.** A session saved before the info maps
  existed (pre-0.23.0) still restores its rows, but they have no backing data - tooltips degrade and
  the Options panels show no sources (the X1 class). Restoring one now logs and toasts exactly which
  groups are affected and the two ways out (re-import or remove).

### Fixed

- **Popup-blocked external links no longer look broken (X6).** The guide's "Open HHpred ↗" and
  "Open DeepTMHMM ↗" actions go through `openExternal()`, which surfaces the URL in a toast and the
  activity log when the browser blocks the popup, instead of silently doing nothing.

### QA (self-driven round 1, continued)

- **Live checks L1-L6 verified against the live services** with the app's own runners (documentation
  only; no app change, so no version bump): phmmer 13 hits -> 13 rows; BLAST 13 more, both sources in
  the template table (26 rows, TSV 27 lines, top score 100.0); AlphaFold text fetches valid models in
  the browser (the API 403s Node's fetch - an environment note, not an app issue); the methods report
  lists both homolog sources and the mixed template ranking. The checklist's live-check table now
  records the results, and Round 1 is trimmed to what is genuinely left: X6 (popup blockers), the
  newest feature cards, and the removal rows 27-38.

## [0.66.3] - 2026-10-01

### Fixed

- **The experimental-data row lost its meaning across a reload** (found by self-driving the QA
  sweep's X1): the values survived in `parsedTracks` but `experimentalTracksInfo` (label, kind,
  mean) was never persisted, so a restored session showed the row without its label, kind meaning
  or the methods-report entry. It is now saved with the session, and `applyPersistedState()` also
  rebuilds the derived track metas for experimental and validation rows (their colour/source lives
  in `trackMeta`, which is not persisted) - the same treatment the rule rows already had.

### Changed

- **The "New-feature highlights" marking convention is retired.** It asked that every new section
  carry a `qa-new` marker so unreviewed additions were easy to spot; only one marker survived (on a
  row that has since been slimmed), because the QA checklist cards and the per-release rows took
  over that job. The lone marker is removed and the CSS comment says so; the File menu toggle
  remains for ad-hoc marking.

### QA (self-driven round 1, state items)

- **X1** found the reload bug above; **X2** (surgical removal of restored rows), **X3** (guide card
  stays open across a removal, verified in a browser), **X4** (rule rows follow their input data)
  and **X5** (undo keeps a manual override - the card reads "done (you)", verified in a browser)
  all pass. X6 (popup blockers) remains yours to try; X7 is the retirement above.

## [0.66.2] - 2026-10-01

### Changed

- **QA checklist refreshed for the sweep**: header updated to the current range and check
  count, and a **Round 1** plan added at the top (cross-cutting X1-X7, the live checks
  L1-L6, the newest feature cards, then the removal rows) with how to report failures.
  Documentation only; no app change.

## [0.66.1] - 2026-10-01

### Changed

- **Versioning policy is now day-based** (see above): same-day updates bump the third number, a new
  day bumps the second. This release only records the policy and the corrected dates; no app change.

## [0.66.0] - 2026-09-25

### Changed

- **The methods report now covers every evidence layer** (it predated the last several features):
  - a **Structure validation** section: per entry, the outlier breakdown across chains plus the
    quality percentiles (verified with a real fetch: 1GFL -> 57 sidechain outliers, 76 clashes, ...
    | geometry 7.5, data 53.6, overall 11.5);
  - an **Experimental per-residue data** section: label, kind meaning, value count, mean and the
    conservation correlation;
  - a **Variant effect evidence** section: per-provider tallies (including high-impact counts) and
    the per-substitution results;
  - **Topology consensus** detail in the evidence list (TM segments, N-terminus, disagreement
    columns) alongside the source names;
  - **domain families** named with their database (e.g. "Domain families (InterProScan: 1):
    Pfam:PF01306");
  - and a **Data sources** provenance section: homolog sources with hit counts, domain databases,
    PDBe validation, topology sources, imported experimental data, and model/rule track sources.
  - Tests seed every layer and assert the sections, wording and cross-read-outs; a live run
    (fetch 1GFL -> validation + an experimental import) renders the real numbers.

## [0.65.0] - 2026-09-25

### Added

- **Experimental per-residue data (DMS / HDX / NMR / any table)** - the lab-measured layer the app
  had none of. Options -> Data Sources -> **Experimental data (DMS / HDX)**: give it a label and a
  kind, paste `position value` lines (space, tab, comma, colon or semicolon) or one series of at
  least five values, and it becomes:
  - a numeric row (`<label>_EXP`) that groups under **Experimental**, plots through the same graph
    machinery as ensemble variance (View as -> graph, auto-scaled, "Experimental score" axis) and is
    usable in rules as `EXP:<key>`;
  - a tooltip naming the label and kind with the value summary (count, mean, range);
  - a **cross-read-out against conservation** (Pearson r) in the status line and the activity log.
  - Kinds carry their interpretation (DMS tolerance / HDX protection / NMR order / other), and the
    guide's structure step links to the category ("Import experimental data…").
  - Tests: two-column forms plus the single-series rule and junk skipping, the importer end to end
    (positions, {val,type} entries, label, group, graph capability, `EXP:` rule source, status and
    correlation), and the panel markup.

## [0.64.0] - 2026-09-25

### Added

- **The loaded name/identifier now feeds the PDB lookup too.** It already fed the UniProt lookup (a
  Q2D `Protein ID:` line or a FASTA description is parsed by `parseProteinHeaderLine()` and
  `deriveLookupDefaults()` pre-fills the lookup with an accession, or a name search) - but the PDB
  lookup ignored it. Now:
  - `findPdbEntries()` passes the parsed **protein name** alongside the sequence and accession, and
  - a third provider, **RCSB name search** (full-text, CORS-verified), runs as the fallback when the
    exact-sequence search finds nothing: "green fluorescent protein" finds **1GFL**, which exact
    identity cannot (verified live).
  - The Structure panel gains the missing first step - **Find UniProt accession** - so the ranked
    PDBe path is one click from a name, and the lookup status names the fallback it will try.
  - Live chain: Q2D-style label `GFP` -> UniProt controls pre-filled (search "GFP") -> sequence
    lookup 4 exact hits -> name search 8 hits incl. 1GFL -> with P42212, ranked PDBe best structures.
  - Tests: the three-provider registry, the name required by the text adapter, the parsed name and
    accession travelling into the lookup, and the panel's two buttons.

## [0.63.0] - 2026-09-25

### Added

- **Find PDB entries from the sequence or accession** - the answer to "I have a sequence, which
  experimental entry is it?". New capability `pdb_entry_lookup` with two CORS-verified providers:
  - **PDBe best structures** (used when a UniProt accession is known): ranked by resolution with
    coverage, e.g. P42212 -> 2WUR at 0.90 A first.
  - **RCSB sequence search** (works from the sequence alone): exact identity first, then 90% for
    close variants; titles and resolutions come from one RCSB GraphQL batch (`rcsbEntryMeta()`,
    shared with the PDBe path, best-effort).
  - The Structure panel gains **Find PDB entries**, a status line and a results list where every hit
    shows id, title, method, resolution and coverage with a **Fetch** button that reuses the PDB
    fetch - so the loop is sequence -> entry -> attached structure -> validation. The PDB-id box's
    error message points at the lookup when an id is missing.
  - Live-verified: the GFP sequence with no accession -> 4 exact hits (2G16, 2G5Z, 2G2S, 2G3D) with
    titles; with P42212 -> 8 ranked entries; fetch 2G16 -> validation (2 chains, 8 clashes, geometry
    89.1).
  - Tests: provider registry and endpoints, the shared metadata helper, the results renderer
    (bits + Fetch per hit, no placeholder noise), the runner end to end with a stubbed capability
    (status, list, activity log), and the markup.

## [0.62.0] - 2026-09-25

### Changed

- **Options -> Data Sources is now category-based.** The Loaded Data row had grown to ten controls;
  Data Sources now has a **"Data source" dropdown** (UniProt lookup / Conservation scoring /
  Membrane topology / Domain families / Homolog search / Structure models & validation / Structural
  homology / Variant effects / External services & activity log) showing **one panel at a time**,
  each with a short description, its own controls (provider pickers, action button, status line) and
  an **"Open the website ↗"** link as the manual fallback when an API is down.
  - The capability controls moved out of Input Data's row into their panels; Input Data keeps the
    PDB fetch (it is an import path) and gains a single **"Data sources…"** button.
  - **Guide pairing:** every step keeps its direct action and gains a **"⚙ Data sources"** link that
    opens Options at the matching category (`STEP_DATA_CATEGORY`); `openTopologyPanel()` and
    `focusUniProtSection()` deep-link there too, and switching to the Data Sources tab restores the
    last category (`switchDataCategory()` + per-category hints).
  - Also fixed: the Input Data row replacement had dropped the header row's closing `</div>` -
    markup re-verified balanced (230/230) with the depth profile matching the previous commit at
    every section boundary.
  - Tests: category declaration/panels, single-panel switching, hint text, unknown-category
    fallback, deep links, control placement per panel, website links, the Input Data button, and the
    guide link for every step.

## [0.61.0] - 2026-09-25

### Added

- **Fetch a PDB entry by id from RCSB** - the control the validation message had been promising.
  Input Data now has a PDB-id box and a **Fetch PDB entry** button (first in the Loaded Data row):
  PDB format first (its file name matches the id, which the validation fetch looks for), CIF as the
  fallback for very large entries, then attach + viewer/track refresh + activity-log entry
  ("RCSB 1GFL 360126 bytes (pdb)"). The guide's structure step offers "Fetch PDB entry…" which opens
  Input Data with the box focused. The validation message now points at it.
  - Live-verified flow: type 1GFL -> Fetch PDB entry (360 KB) -> Fetch validation -> two chain rows,
    76 clashes, 2 Ramachandran outliers.
  - Tests: markup, helper wiring, bad-id rejection before any request, the guide extra, and the
    focus helper.

## [0.60.0] - 2026-09-25

### Added

- **Experimental structure validation (PDBe) - the experimental counterpart of pLDDT.** For an
  attached experimental entry, Input Data -> **Fetch validation (PDBe)** pulls the wwPDB per-residue
  outlier summary and the entry's quality scores (CORS-verified) and adds one row per chain: amber
  `!` markers on flagged residues, a tooltip naming the outlier types ("validation outlier(s) -
  sidechain outlier (PDBe)"), a row tooltip with the breakdown and quality percentiles, a guide
  read-out, a status line and an activity-log entry.
  - New capability `structure_validation` (adapter `pdbeValidation`); outlier types covered:
    Ramachandran, sidechain, clashes, RSRZ, bond angles/lengths, planarity, chirality.
  - Author numbering is mapped onto the reference through the attached structure's chains (the same
    alignment-based mapping as the interface/ensemble tracks), so a renumbered entry lands correctly;
    one row per chain means a dimer reports both chains (verified live: 1GFL -> chains A+B, 76
    clashes, 2 Ramachandran outliers across the two).
  - `validationHitsInfo` travels in the session save and unpicks on removal (`TRACK_REMOVERS.VAL`);
    `formatTrackLabel()` names the rows ("Validation 1GFL (chain A)").
  - Real PDBe responses committed as fixtures; tests cover the labels (including real plurals - the
    first pass said "clashs"), the quality summary, the mapping and counts, the candidate-structure
    finder, the tooltip text, persistence, removal, and the runner end to end with the fixtures.

## [0.59.0] - 2026-09-25

### Added

- **A user-facing Activity log, reachable from the menu bar ("Log", between Analyze and Export).** The
  existing action log now says what the app is doing in plain words and, crucially, what came back
  from every API job: submit (tool, HTTP status, job id), poll status changes with elapsed time,
  result size, and **what was parsed from it** ("Topology prediction: 36 row(s) -> 2 source(s)
  [Phobius 12 TM, TMHMM 11 TM]"), or why nothing was added. It keeps the last 200 entries, updates
  live while open, copies as text or JSON (`q2dvActions()`), and stays session-only. The modal is
  renamed from "Debugging console" to "Activity log" (Help links to it too).
  - `uniprotLog()` now also feeds the activity log (prefix changed to `[Q2DV api]`), so the API
    lifecycle is in one place instead of only in Options -> Data Sources and the console.
  - Runner summaries: domain scans log matches -> tracks (HMMER text vs InterProScan TSV), homolog
    searches log hits -> tracks, variant-effect providers log per-provider results or failures.
  - A prediction that ran on a different sequence length than the loaded one is logged explicitly
    ("ran on a 355 aa sequence, the loaded one is 417 aa - ranges clipped"), which is exactly the
    kind of silent-looking mismatch the log exists to surface.
  - Macro recording saved as a future idea (the JSON log is the starting point; nothing built yet).

### Fixed

- **3D viewer console noise, considered and cleaned up:**
  - `Could not interpret colorscheme hydro`: the app's labels did not match 3Dmol's scheme names, so
    "hydro" and "spectrum" silently kept the previous colours. They now map to `hydrophobicity` and
    `residue` (`P3D_LIB_SCHEMES`); white/conservation stay colour-driven as before.
  - `OffscreenCanvas.transferToImageBitmap` + WebGL "Framebuffer not complete ... no width or
    height": 3Dmol was asked to resize/render while the viewer was hidden (zero-size container).
    `p3dSafeRender()` skips both until the container has real dimensions; the show path renders once
    visible.
  - Topology source summaries counted M **residues** as "TM" (215 instead of 12); they now count
    segments, matching the source list wording.

## [0.58.0] - 2026-09-25

### Added

- **InterProScan (EBI) joins the app, for topology and for bacterial/viral domain families.** One
  Job Dispatcher tool, two uses, both species-agnostic:
  - **Predict topology in-app** (Input Data button, or the guide's topology step): TMHMM + Phobius +
    SignalP run on the loaded sequence and each analysis is registered as a topology source, so the
    majority-vote consensus, the `?` conflict flags and the TM cross-check light up without a manual
    paste. Verified live on LacY (P02920): Phobius 12 TM with orientation, TMHMM 11 - a real
    predictor disagreement the consensus now flags.
  - **Domain scan provider**: InterProScan (PfamA + NCBIfam) is selectable next to hmmscan. NCBIfam
    carries the bacterial and viral family models (TIGRFAM/PRK/NF), so bacterial/viral proteins get
    family annotations where Pfam alone is thin. Verified live on LacY: Pfam PF01306 (LacY/RafB
    permease family) plus NCBIfam TIGR00882 and NF007077.
  - Both parsers read the **TSV** renderer: the JSON one does not say which analysis a match came
    from (column 4 does), and a tab-separated first line distinguishes it from HMMER text
    (`isIprscanTsv()`).
  - `iprscanRegionState()` maps region names to the topology chars **name-first**: Phobius describes
    `CYTOPLASMIC_DOMAIN` as "outside the membrane, in the cytoplasm", which the description-only
    version read as outside (caught by the real fixture).
  - `addTopologyStateSource()` registers a prebuilt state string and **replaces** a same-named
    source, so re-running a prediction refreshes instead of stacking duplicates; `DM_` row labels
    now use the recorded model (`Pfam:PF01306`, `NCBIfam:TIGR00882`).
  - Also cleaned up: the harness had a duplicated async test block whose second copy could exit the
    process before the first finished (it was masking the new end-to-end test).
  - Tests: TSV parsing with the real LacY outputs as fixtures (analyses, ranges, significance),
    region-name mapping incl. the Phobius trap, topology sources and the flagged disagreement,
    domain models/descriptions, the runner end to end with the fixture (no network), provider
    registry and markup.

## [0.57.0] - 2026-09-25

### Added

- **Variant effects are now a modular provider framework**, so species coverage is a registry
  concern instead of being hard-wired to AlphaMissense (human only). `VARIANT_EFFECT_PROVIDERS`
  declares each source's coverage, requirements, availability test and run; the button (now
  "Assess variant effects") runs every applicable provider, isolates failures, and merges the
  results into one line per substitution used by the cell tooltips, the variant panel, the status
  line and the guide read-out. Adding a species-specific API later (Ensembl VEP for plants/animals,
  SIFT 4G, PROVEAN, ESM-1v) is one registry entry - nothing else changes.
  - **Remote**: `alphamissense` (human, needs a UniProt accession) - unchanged behaviour, now a
    provider.
  - **Local, any species**: `conservation` (reads the Conservation row: highly/moderately conserved
    or variable at the variant position), `structure` (RSA + pLDDT + SS at the position: buried and
    ordered is high-impact context), and `curated` (UniProt features overlapping the position, e.g.
    active/binding sites and natural variants).
  - Coverage notes are shown in the UI, so it is always clear which sources can speak for the
    current protein. Providers that do not apply are skipped with a clear message rather than
    silently doing nothing.
  - Research note (live-checked 2026-09): no verifiable species-general per-substitution API exists
    today - Ensembl REST VEP answered 500 across the board (including `/info/ping`), SIFT 4G was
    502, PROVEAN has no usable API, and the ESM Atlas exposes no variant endpoint. The local
    providers cover those species in the meantime, and the registry is the hook for the APIs once
    they are reachable.
  - Tests: registry contents and coverage notes, availability gating (nothing applies until its
    input arrives; all four apply once accession/tracks/features are loaded), each local provider's
    output and levels, the merged line's ordering, and the display/read-out reading the merged map.

## [0.56.0] - 2026-09-25

### Added

- **AlphaMissense variant effect predictions.** For a protein with a UniProt accession and a loaded
  variant FASTA, Input Data -> **Predict variant effects (AlphaMissense)** looks up the substitution
  scores from the AlphaFold DB annotation file (`amAnnotationsUrl`, CORS-enabled) and reports the
  pathogenicity class per variant. Verified live: TP53 R175H -> likely pathogenic (0.9857).
  - `parseVariantSubstitutions()` reads the substitution from the variant's header token (`R175H`,
    `p.Arg175His` - three-letter codes included) and falls back to comparing the variant's aligned
    sequence with the reference when the header carries no token.
  - `parseAlphaMissenseCsv()` keeps only the substitutions the loaded variants carry (the full table
    is ~7,500 rows per protein, so nothing bulky is stored) and normalises the file's abbreviated
    classes (`Ben` / `LBen` / `Amb` / `LPath` / `Path`). Scores stay in memory; the button re-fetches.
  - Surfaced in the variant row's cell tooltip ("; AlphaMissense: pathogenic or likely pathogenic
    (0.99)"), the variant FASTA-segment label, the Input Data status line (class counts), a guide
    read-out, and the guide's homologs step offers the action whenever variants are loaded.
  - Tests: token parsing (one- and three-letter, `p.` prefix, synonymous rejected), header vs
    alignment fallback, CSV filtering and class normalisation, lookups and labels, the panel label,
    the guide read-out and action.

## [0.55.1] - 2026-09-25

### Changed

- **The Analyze menu offers each homolog provider explicitly**: "Search Homologs (phmmer)…" and
  "Search Homologs (BLAST)…", instead of one combined entry that ran whatever the Input Data picker
  happened to be set to. Each entry calls `setHomologProvider()` and then runs, so the menu and the
  panel picker never disagree.
- **Homolog glyph wording is source-aware.** A BLAST (or phmmer/Foldseek) row's cell tooltips used to
  say "HHpred match quality", which was wrong for anything that was not an HHpred hit. They now name
  the actual basis via `homologGlyphBasis()`: HHpred match probability, phmmer posterior probability,
  or a BLOSUM62 substitution class for BLAST/Foldseek. The legend gained a "Homologs: match quality"
  entry explaining that the glyph scale (`|` strongest ... `.` weakest) is deliberately shared across
  sources so rows stay comparable at a glance, while the quantity behind it depends on the search;
  Track Control's Color description says the same.

## [0.55.0] - 2026-09-25

### Added

- **Topology: TOPCONS input, visible disagreements, and an orientation read-out** - the last pieces
  of the locked "orientation + consensus" decision. The consensus bar, majority vote and TM
  cross-check already existed; this closes the gaps around them.
  - `parseTopologyText()` now also accepts TOPCONS-style per-residue run lines
    (`TOPCONS  ooooMMMMiiii`), with or without a leading method name, so the multi-method consensus
    line can be pasted directly. When several method lines are pasted, the TOPCONS line wins (it is
    itself a cross-method consensus); otherwise the longest run is used. Runs shorter than 10
    characters are ignored so ordinary words cannot be misread.
  - **Disagreements are flagged instead of blanked**: a column where the sources tie is marked `?`
    (red `#fca5a5`) rather than left empty, so "no majority" is visible rather than looking like
    "no data". Labels/colours for `?` added to `TOPOLOGY_STATE_COLORS`/`TOPOLOGY_STATE_LABELS`.
  - `topologyConsensusSummary()` reports the N-terminus call, TM segment count and disagreement
    columns. It drives the topology panel read-out ("Consensus (2 sources): N-terminus outside ·
    1 TM segment · 1 disagreement column"), the TM cross-check footer, and the row tooltips:
    `buildTopologyPredictorInfo()` gives every `TP_` row a summary and the consensus row the
    N-terminus/disagreement breakdown (they previously had no description at all).
  - Also fixed: the source list called M *residues* "segments" (5 residues = "5 segments"); it now
    counts runs ("5 TM residues in 1 segment").
  - Tests: run-line parsing (named, bare, multi-line preference, short words ignored, segments
    unchanged), tie -> `?`, the summary fields, tooltips and the panel read-out.

## [0.54.0] - 2026-09-25

### Fixed

- **The Homolog Templates table showed identity as a raw count and left every phmmer/BLAST row
  unranked.** `parseFloat("237/238 (100%)")` returned 237, so the Identity column read "237.0%", the
  template score was inflated, and the same wrong number reached the guide read-out ("Best homolog
  identity is 237%") and the methods report ("Best homolog identity: 237%"). Foldseek's 0-1 fraction
  read as "1.0%". `parseIdentityPercent()` now handles all three shapes ("x/y (z%)", "z%", 0-1).
  - `Probab` existed only for HHpred (and Foldseek's prob), so phmmer/BLAST rows showed "-" and a
    null template score. `homologConfidencePercent()` derives one from the E-value where there is no
    probability (10 points per decade: 1e-3 -> 30, 1e-10 -> 100), so **every source now scores and
    ranks together** (verified: 28 mixed rows, zero unscored).
  - Coverage now counts aligned residues in the stored `aaTrack` (union-correct even when BLAST HSPs
    overlap) with `Aligned_cols` as the fallback, instead of summing HSP columns.

### Changed

- **The table is now source-aware.** Columns are `# | Homolog | Confidence | E-value | Identity |
  Coverage | Structure | Template score`, with tooltips explaining the confidence basis and the score
  formula (confidence x identity x coverage / 10000). **Structure** resolves cached files, auto-fetchable
  PDB entries, and - for accession hits - the AlphaFold model (`AlphaFold P42212`); the 3D action now
  fetches that model for phmmer/BLAST hits instead of only explaining that no PDB id matches
  (`fetchAlphaFoldModelText()` extracted and shared, `p3dHomologStructureFile()` matches
  `AlphaFold_<accession>` files). A **Copy table (TSV)** button exports the ranking, and the methods
  report gained a "## Template quality" section with the ranked table. Heading/empty-state copy no
  longer says "(HHpred)" or "attach an .hhr file".
  - Tests: identity parsing across shapes, confidence mapping (probability, E-value decades, E=0,
    neither), coverage from aaTrack and the fallback, accession extraction, mixed-source metrics
    (phmmer now scores 100, HHpred 79.8), sort order, TSV, methods report and guide read-out.

## [0.53.0] - 2026-09-25

### Added

- **EBI NCBI-BLAST joins phmmer as a homolog-search provider.** Input Data now has a provider picker
  (phmmer / BLAST); the Analyze menu entry and the button are provider-agnostic, and the guide's
  in-app action mentions both. Whichever is chosen, the other stays in the capability as a fallback,
  so one service being down does not stop the search.
  - `runCapability()` takes `opts.prefer`, which moves the chosen provider to the front of the list
    (unknown ids are ignored); `runHomologSearch()` reads the picker and dispatches on the result
    type - HMMER text for phmmer, Job Dispatcher JSON for BLAST.
  - `parseBlastHits()` reads `hits[].hit_hsps[]`: one segment per HSP with `hsp_query_from`
    coordinates, `hsp_qseq`/`hsp_hseq` as the aligned pair, and per-column glyphs from the HSP
    alignment via `foldseekQualityChar` (BLOSUM62: identical `|`, positive `:`, otherwise `.`).
    Hit ids are rebuilt UniProt-style (`sp|P42212|GFP_AEQVI`) from the db/acc/id fields, and
    identity, aligned columns, bits and HSP count go into the tooltip stats.
  - `applyPhmmerHits()` became `applyHomologHits(parsed, source)`, and `buildHomologPredictorInfo()`
    is now four-way source aware: phmmer (posterior bands), BLAST and Foldseek (BLOSUM62 bands),
    HHpred (match-probability bands), each with its own category, stats line and citation.
  - Verified live: the database value for ncbiblast is `uniprotkb_swissprot` (plain `swissprot` is
    rejected) and the JSON renderer exists, unlike hmmer3. GFP vs Swiss-Prot returns 13 hits; the
    real response is committed as a test fixture.
  - Tests: BLAST JSON parsing (13 hits, UniProt-style ids, 237/238 identity, glyph set `.:| `,
    equal-length HSP strings), BLAST attribution and tooltip, provider registry order and database
    value, the picker and menu markup, and `opts.prefer` (preferred first, unknown ignored).

## [0.52.1] - 2026-09-25

### Changed

- **The homologs route question is no longer HHpred-centric.** "Is the HHpred .hhr ready?" becomes
  "For homologs, would you prefer MPI's HHpred, phmmer, or both?", with answers that match the
  routes (HHpred / phmmer / both). Each answer leads with its own action: phmmer -> the in-app
  search, HHpred -> attach the .hhr with the HHpred link beside it, both -> the in-app search with
  the .hhr attach as the secondary button and the HHpred link alongside. Saved answers from older
  sessions ('ready' / 'no') migrate on restore so the right pill is highlighted.
  - Step copy uses neutral phrasing: the description offers both routes instead of "No HHpred at
    hand?", and the HHpred hint says "Alternatively, you can search Swiss-Prot in-app with phmmer"
    while keeping the accepted formats and modelling-database guidance.

### Fixed

- **Duplicate action buttons in the guide.** The short form rendered the accessory without the
  dedup the step card had, and a route accessory could repeat the step's own action (rendered as
  the secondary button). `resolveStepAction()` now guarantees one handler, one button: an accessory
  that repeats the primary action, an extra, or (when the action changed) the step's own action is
  dropped. Verified across all three routes: phmmer, HHpred link, Copy sequence (FASTA) and
  "Load .hhr / variant FASTA…" each appear exactly once in both the short form and the step card.

## [0.52.0] - 2026-09-25

### Added

- **Homolog search with HMMER phmmer (EBI).** Analyze -> "Search Homologs (phmmer)…" (or the
  button in Input Data, or the guide's homolog step) submits the current sequence to the EBI Job
  Dispatcher (`hmmer3_phmmer`, Swiss-Prot, `E=1e-3`), parses HMMER's text output and adds one
  Homologs row per significant hit (top 30; numbering continues after any imported .hhr). The rows
  feed conservation, the Homologs match-quality colouring and the predictor tooltips exactly like
  an imported .hhr - no external HHpred run needed for a first-pass MSA.
  - `parsePhmmerHits()`: query length; the full-sequence scores table (E-value, score, domain
    count, and the inclusion threshold deciding significance); every domain's alignment, including
    wrapped blocks, query gaps (`.`), target gaps (`-`) and lowercase insertion residues. The
    posterior-probability line (`*`/0-9/`.`) maps onto the existing HHpred glyph scale
    (`|`/`=`/`+`/`:`/`.`), and identity is computed from the alignment.
  - `runHomologSearch()` mirrors the domain scan: task lockout, live status line, progress, toasts,
    and refreshes conservation, the viewer, the track manager and the Input Data summary.
  - `applyPhmmerHits()` sanitizes the hit id for the track key (`sp|P42212|GFP_AEQVI` ->
    `HL_01_sp_P42212_GFP_AEQVI`) while the row label and tooltip show the real id;
    `nextHomologRank()` now numbers both .hhr imports and searches. Only hits above HMMER's
    inclusion threshold become rows, like the domain scan's significant domains.
  - `buildHomologPredictorInfo()` is source-aware: phmmer rows report E-value, score, identity and
    aligned columns, and cite HMMER phmmer.
  - The guide is wired properly: the homologs step carries "Search homologs (phmmer)" as a
    first-class action button (Next card and step card, in every state), its description and "how to
    read it" explain the in-app route and how phmmer colouring differs from HHpred, the generated
    WORKFLOW.md lists it, and the read-out suggests it when no homologs are loaded.
    `resolveStepAction()` now also lets a resolver add context actions - they were silently dropped
    before, so a tailored action could never appear in the guide.
  - Tests: a real EBI phmmer output (GFP vs Swiss-Prot, `tests/fixtures/phmmer-gfp.out`) is parsed
    end to end - 21 reported hits, 13 above the inclusion threshold, 237/238 identity for the top
    hit, glyphs restricted to the HHpred scale, multi-domain and gapped hits, rank continuation,
    real hit ids in labels, predictor tooltip and conservation inclusion.

## [0.51.0] - 2026-09-25

### Added

- **The rules list marks empty rules the same way tracks are marked.** A rule that currently marks
  no residue is greyed (opacity 0.55) and tagged "(Empty)", with a tooltip that says why: "No
  matches: needs RSA (any model)" when one of its sources is not loaded, otherwise "No residue in
  the loaded data matches this rule" (plus ", and its track is switched off" for a disabled rule).
  A rule that silently did nothing now reads as "no matches here" instead of looking broken.
  - Helpers `ruleMatchCount()` / `ruleIsEmpty()`; `refreshTrackManagerIfVisible()` also re-renders
    the rules list, so the markers update with the data while the Tracks tab is open.
  - Tests: a matching rule counts its residues; a threshold nothing meets is empty; a rule whose
    source is not loaded is empty without throwing; exactly the two empty rules carry the tag and
    the grey; loading the missing track clears the marker.

## [0.50.3] - 2026-09-25

### Fixed

- **Preset cards vanished while the guide's rules coachmark was active.** The coachmark's
  "collapse the sibling sections while guidance is active" ran on *every* `applyGuideCoachmark()`
  call, not just when the coachmark changed. So any guide refresh re-slammed the sections shut and
  forced the active one open, and when guidance ended the saved states were restored over whatever
  the user had done in the meantime - including collapsing the Rules section (with its Presets
  accordion and all eight cards) right while they were adding or removing a preset from it.
  - The collapse/restore is now a **one-shot transition**: it runs only when the coachmark kind
    actually changes, and it only undoes what it set itself - if the user opened or closed a
    section since, their choice wins.
  - `renderRulesList()` now snapshots the sidebar scroll position and the Presets accordion state
    around its rewrite (which destroys the clicked button and can shift the view), and puts them
    back afterwards.
  - Tests: the coachmark opens its section and collapses siblings; a later refresh does not slam
    shut a section the user reopened; ending guidance keeps the user's choice and restores what the
    coachmark changed; an untouched sibling is restored to its pre-guidance state.

## [0.50.2] - 2026-09-25

### Fixed

- **Two curated presets could never match anything.** "Conserved buried residue" and "Rigid,
  well-folded core" use the bare `RSA:` source ("any model"), but the `anyKey` flag was never
  resolved: evaluation read `parsedTracks['']`, got `null`, and every residue failed the
  comparison. The rules were added, listed and evaluated, but produced no track, forever.
  - `ruleNumericValue()` now resolves a bare keyed source (`RSA:`, and for consistency `pLDDT:`
    and `RMSF:`) to the first loaded track of that kind, so the presets start matching as soon
    as an RSA track exists - and any saved rule that used the bare form keeps working.
  - `presetMissingSources()` simplified to match (the unused rename map is gone); the card's
    "needs RSA" label was already correct.
  - Tests: bare `RSA:` resolves to the loaded track; `conserved_buried` matches exactly the
    conserved+buried residues; `rigid_core` matches exactly the confident+buried residues;
    without an RSA track the rule matches nothing and the card reports "needs RSA", which
    clears once a track is loaded.

## [0.50.1] - 2026-09-25

### Fixed

- **The viewport duplicated itself vertically once any rule existed** (reported as "A, B, C, A, B, C").
  A regression from 0.23.0: `renderViewer` re-evaluates the rules mid-render, and that hook called
  `applyRules()` — which **renders**. So the sequence was: the outer render clears the grid → the
  hook's nested render clears it again and paints a full set → the outer render then **appends its own
  copy on top of it**. Every data change (attach, remove, zoom, parse) doubled the viewport, and more
  nesting meant more copies — which is why it appeared "at some point" and kept getting worse.
  - `reevaluateRulesIfNeeded()` now calls a new **`rebuildRuleTracks()`** that rebuilds the `RULE_`
    tracks *without touching the DOM*; `applyRulesInner()` = rebuild + render + refresh + persist, as
    before. The in-render path can no longer repaint.
  - Regression test: the harness now keeps the real `renderViewer` (it stubs it for speed) and
    **counts render invocations** — a data-change render must be exactly 1 with rules present, and the
    in-render hook exactly 0 while still rebuilding the track. The stub cannot show the duplication
    itself, because its `innerHTML = ''` does not clear children; counting calls is the reliable check.

## [0.50.0] - 2026-09-25

### Changed

- **The reactive hover tooltip is now the default for every track.** The styled tooltip (swatch,
  track name, provenance, residue detail) already covered the rows that set a title — Conservation,
  UniProt, Rules, Ensemble, variants, topology, domains — but the SS/TM/disorder/coiled-coil/signal
  rows only added a colour class, so they had **no tooltip at all**, and the reference row's cells
  had none either.
  - Every cell now carries a title: prediction letters get a plain meaning ("H (helix)", "M
    (transmembrane)", "D (disordered)"), blanks say "not annotated in &lt;track&gt;", and the
    reference row names the residue ("Residue 12: M") — deliberately **without** a meaning, because
    on a sequence row those same letters are residues (C is cysteine, not "coil").
  - Residue-position markers all hover now, not only the labelled ones.
  - **Graph points join the same tooltip.** An SVG circle keeps its text in a `<title>` child and
    its colour in `fill`, so both are handled; the native tooltip is suppressed while the styled one
    shows and restored on leave.

`QA_CHECKLIST.md` gained the feature card for the framework.

## [0.49.1] - 2026-09-25

### Changed

- The graph model pills are wider again (max-width 150 px, up from 110 px) so model names truncate
  less, while still clearing the right-aligned tick labels in the pinned axis strip.

## [0.49.0] - 2026-09-25

### Fixed

- **The model pills covered the rotated axis title.** They are indented 18 px now (clearing the
  vertical "pLDDT (0-100)" / "RSA (0-1)" / "RMSF (A)" title at the strip's left edge) and their
  width cap dropped to 110 px so the right-aligned tick labels stay readable too.

### Added

- **The graph header carries the same Track Control chevron the rows have**, so a graph is no longer
  a dead end for the controls the rows offer: clicking it opens that type's popup (View as / Color /
  Config / hide) for the type the graph is showing. The header indents to make room, the chevron
  shows the `state-on` colour when that type's view is non-default, and it is focusable like the
  row chevrons.

## [0.48.0] - 2026-09-25

### Fixed

- **The pinned axis strip pushed the model pills out of the range.** It was a flow block, so it
  occupied the graph's full height and the pills were laid out *below* it instead of nestled inside
  the strip. It is now absolutely positioned (the sticky overlay is its containing block), so it
  paints the strip behind the pills without taking any layout space.

### Added

- **Right-click on a graph opens the same per-track menu the rows use** — View as, hide/show, Config,
  Track Control, and Remove. The target decides which track: a **model pill** names its own key, a
  **plotted point** carries `data-track`, and anything else (the strip, the plot background) falls
  back to the section's first track. Hiding a track this way removes it from the graph, since the
  graph's keys are filtered the same way the rows are.

## [0.47.0] - 2026-09-25

### Fixed

- **The graph axis scrolled away with the data, and the plot showed through the label column.**
  Two symptoms of one layout gap: a graph's axis is drawn *inside* the SVG (so it scrolls with the
  data), and the sticky pills overlay was zero-height, so nothing covered the 195 px axis strip —
  scrolled plot content and the SVG's own axis appeared in the region the pinned row labels occupy.
  - The overlay now carries a **pinned, opaque axis strip** (`graph-axis-side`) sized to the graph
    height, mirroring the axis: the vertical title, the tick labels and the tick marks, positioned
    from the same scale (so pLDDT/RSA and the auto-scaled RMSF each get their own).
  - It is painted **behind** the pills, so the model pills stay readable and clickable.
  - The SVG keeps its own axis, because an exported SVG has to be self-contained; on screen that one
    is simply hidden behind the strip.
  - The pills container is narrower than the strip now (max-width 128 px) so the right-aligned tick
    labels stay clear of it.

## [0.46.0] - 2026-09-25

### Fixed

- **Models were mapped onto the reference by residue numbering alone**, so a model
  whose numbering differs from the sequence (an assembly numbered from its own mature
  chain, an experimental entry with different author numbering, or a domain-only model
  numbered from 1) was placed **shifted by its start** — reported as "the RMSF graph is
  offset by ~17 residues". The ensemble variance and the interface tracks now map
  residues by **aligning each chain's own sequence onto the reference** (the same
  aligner the variant FASTA path uses), so a shifted model lands where it belongs.
  - `parseStructureChains` now records the residue letter (PDB `resName` / mmCIF
    `label_comp_id`, with `RESIDUE_3TO1` covering MSE and the ambiguous codes), which
    is what makes the alignment possible.
  - `mapChainToReference()` is the shared mapping, falling back to the raw numbering
    when a model carries no usable letters (or when the alignment cannot be built).
  - The ensemble summary **names any model whose numbering differs** ("Aligned by
    sequence (their numbering differs from the reference): m.pdb (-17)"), so a
    renumbering is visible rather than silent.
- The interface tracks had the same assumption and are fixed with it.

### Notes

- Horizontal scrolling was a red herring: the graph geometry is identical across
  graph types (verified by comparing the generated SVG), so the apparent misalignment
  was the mapping, visible only once you scrolled to compare features.

## [0.45.1] - 2026-09-25

### Changed

- **The rule toggle is now labelled "Enable / disable this rule's track"** (it was "Enable /
  disable this rule"). The control only governs whether the rule draws a `RULE_` row: a disabled
  rule is still evaluated by **select** and by the **co-localization** source picker. The label now
  matches that, and the code comment records the distinction so it is not re-widened by accident.

## [0.45.0] - 2026-09-25

### Added

- **"Characterizing an unresolved fold"** as a closing goal (Guide → Integrate → *What are you
  closing on?*). Review noticed the question had no route for an undetermined or partially
  determined model. The tools existed (Foldseek for fold assignment, HMMER/Pfam for domain
  architecture) but nothing pointed at them from that question.
  - The route is **adaptive**: with no structure attached it offers **Scan HMMER/Pfam** ("the
    domain architecture is the first evidence, then predict or attach a model so Foldseek can
    search it"); with a model attached it goes straight to **Run Foldseek (fold assignment)**.
  - The read-out now names the state: while there is **no Pfam family and no structural
    relative**, it says the fold is unplaced and names the two routes that place it. A *sequence*
    homolog (HHpred) does not clear it — that is not a fold assignment.
  - Honest scope: the app cannot determine a fold *de novo*. It places one by homology — curated
    family, profile search, or structural relative — and an unresolved fold with no relatives
    anywhere stays unresolved.

## [0.44.0] - 2026-09-25

### Changed

- **The Tracks tab's own submenu is now "Track Visibility"** — "Tracks > Tracks" was confusing.
- **The Rules coachmark now says which rules fit.** The Guide's hand-off to the Rules panel was
  just "pick every rule that applies"; it now names the presets its intake answers and loaded data
  suggest ("Based on your answers, these fit: … (highlighted below)"), or says plainly that nothing
  matches yet and the list is unfiltered.
- **Modern, DOI-verified follow-ups replace the classic rule citations.** Lichtarge et al. 1996
  (evolutionary trace) and Valdar & Thornton 2001 (interface conservation) were the oldest
  references in the rule library. They are replaced by, each resolved against Crossref:
  - **Morcos et al., PNAS 2011** (direct-coupling analysis — co-evolution marks coupled positions)
  - **Guharoy & Chakrabarti, PNAS 2005** (residue importance across protein–protein interfaces)
  - **Caffrey et al., Protein Sci 2004** (interfaces are more conserved than the rest of the surface)
  - **Cheng et al., Science 2023** (AlphaMissense — a current missense variant-effect model, for the
    variant-triage rationale)
  They now back the *Conserved buried residue*, *Conserved exposed patch* and *Integrate* step
  references, so the scenarios are cited from the current literature rather than the origins.

### Fixed (robustness)

- **The Rules panel now diagnoses itself.** A report that adding a preset makes the preset cards
  disappear could not be reproduced: the render logic keeps all eight cards through every path
  (plain add, two adds, the coachmark route), the generated markup parses into the right tree, and
  the deployed build is byte-identical to this one. So instead of guessing: `renderRulePresets()`
  now **logs how many cards it wrote** (visible in Help → Debugging console), **recreates its
  container** if it ever goes missing, and **refreshes when the section is opened**; and
  **uncaught errors / rejected promises are recorded in the action log** so a failure that only
  happens in a real browser shows up in the console rather than vanishing.

## [0.43.0] - 2026-09-25

### Added

- **Experimental biological assemblies can be imported.** Review asked whether a trimer model can
  be fetched by API; for experimental assemblies it can. RCSB serves `{id}.pdb{n}` as biological
  assembly n — CORS-enabled (verified with an Origin header) and readable by the existing chain
  parser (verified: `1TNF.pdb1` comes back as three chains of 152 CA). Analyze → Interfaces now
  has an **id + assembly number + Attach assembly** control, and the Guide's structure step offers
  *Attach an experimental assembly…* when a declared oligomer has no multimer model. The id
  pre-fills from the first homolog hit that carries one (the Homolog Templates table), and the
  status reports the chain count that arrived.
- The read-out **routes** a declared multimer to that action instead of only warning, and the
  guide hint explains why the import is the route.

### Notes

- A multimer still cannot be **predicted** here: ESMFold has no complex mode and the AlphaFold DB
  path is per-accession monomers. When there is no experimental assembly (a novel sequence, or an
  entry without one) the failure message says so and names the external options — AlphaFold-
  Multimer, ColabFold, AF Server — rather than implying the app can produce one.

## [0.42.0] - 2026-09-25

### Added

- **The declared oligomeric state now travels with the workflows.** Review found that it was
  advisory only: exports and structure generation still produced a single chain regardless.
  - **Exported FASTA** (the HHpred clipboard hand-off and *Download FASTA*) carries the state in
    the header, e.g. `>sp|P42212|GFP_AEVI_homotrimer`, so whatever consumes it is not left
    assuming one chain.
  - **ESMFold and the AlphaFold DB fetch state what they produce.** Both return a single chain —
    the AlphaFold DB's per-accession model is the monomer (verified: its API exposes no assembly
    fields for a known trimer, only `AF-<acc>-F1-model_v6.pdb`) — so with a declared oligomer
    they warn at the point of generation, and the pre-action hint says it *before* the click.
  - **The state is read from the input when it is there.** A FASTA header carrying a stoichiometry
    token (`A:A:A`, `chainA:chainA:chainA`) or repeating the same record N times fills the intake
    question automatically — never overwriting an explicit answer — while the viewer still shows
    **one** chain (a homotrimer is one sequence). `parsePlainFasta` now reports every record so
    this is possible; differing records are deliberately *not* inferred.

### Notes

- The detection is narrow on purpose (identical short token, colons without spaces), so prose
  labels are not mistaken for stoichiometry; the answer stays editable either way.

## [0.41.0] - 2026-09-25

### Added

- **A declared oligomeric state** — the sixth intake question ("What is its oligomeric state?":
  Monomer / Homodimer / Homotrimer / Homotetramer or larger / Hetero-oligomer / Unknown). Until
  now the state could only be *inferred* from an attached structure, so a sequence-only session
  (FASTA or Quick2D) had no way to say "this is a homotrimer". The declaration is recorded in
  the methods summary and drives the interface step:
  - **Claim vs coordinates.** The read-out compares the declaration with the chain count of the
    attached models: a declared assembly against a single-chain model warns that interface
    analysis needs a multimer; against a *smaller* assembly it warns about a partial assembly;
    when the model supports it, it says the analysis can be run; a monomer declaration against a
    multimer asks whether the assembly is biological or a crystallographic artefact.
  - The interface action's hint names the declared state, and the interface panel shows
    "Declared: Homotrimer" beside the analysis.

### Fixed (caught while building it)

- The interface hint was computed once at load (an IIFE in the resolver table) instead of per
  call, so it would have frozen whatever the profile was at startup.
- A declared assembly that the model only *partly* matched (declared trimer, dimer model) fell
  through to the reassuring branch; it now warns about the partial assembly.

## [0.40.0] - 2026-09-25

### Changed

- **"Include HHR homolog sequences in the tallies" is now on by default.** The homologs are
  already loaded and on screen, so excluding them from the conservation row made the row
  disagree with the viewer (and with what a researcher expects). Consequence worth knowing:
  a session with an `.hhr` but no variant FASTA now gets a conservation row where previously
  there was none.
- **Restoring a session respects a deliberate choice.** The preference is read as
  `!== false`, so a session that explicitly turned it off keeps it off, while a session saved
  before the option existed picks up the new default rather than inheriting the old one.
- **Importing an `.hhr` now recomputes conservation.** It previously only recomputed on
  variant import, an option change, or a removal — so with the new default the row would have
  appeared only after some unrelated action.
- Reset Data returns the option to its new default (on).

### Notes

- Structural homologs (Foldseek) are deliberately **not** included in the tallies: the option
  says HHR, and mixing structural alignments into a sequence-conservation tally is a judgement
  call worth keeping explicit.

## [0.39.1] - 2026-09-25

### Fixed

- **Track Control was too narrow for its four columns**, so the Category name was truncated.
  The popover is now 380–460 px wide (it was 265–330), which gives the Category column room
  alongside View as / Color / Config.
- **Removed the redundant hint beside each Config gear** (the little "(Conservation)" /
  "(Entropy/PID)" / "(Cutoffs)" text). The gear keeps a plain "Config for <type>" tooltip, and
  the helper plus its CSS were deleted rather than left as dead code.

## [0.39.0] - 2026-09-25

### Added

- **Track Control gained a Color column**, between *View as* and *Config*, for a type's
  per-residue **colour meaning** — a separate choice from how the row is drawn. Homologs offer
  three modes:
  - **Match quality** (default): the existing per-homolog HHpred match-quality colour. Worth
    stating plainly: this encodes *that homolog at that column*, so the same residue letter in
    one column is legitimately a different colour in every row.
  - **Conservation**: the per-column conservation band, so a column is one colour across rows.
  - **Residue type**: a chemistry palette (`RESIDUE_COLORS`), so the same letter is the same
    colour in every row and column; it also forces the letters, like the conservation mode.
  Types with a single mode show a muted dash rather than a fake choice; adding a mode for
  another type is a `GROUP_COLOR_MODES` entry plus a rendering branch.

### Fixed

- **The homolog "Cons. colors" controls never worked.** The per-type Config frame's checkbox
  wrote `consColor.HH` / `hideSymbols.HH` / `fullBar.HH` / `aaSeq.HH` — all stale keys from the
  `HH_` → `HL_` rename — so it appeared to do nothing. Both it and the chevron popup's toggle
  are **removed**, replaced by the Color column (the config frame now points at it).
- Choosing **Bar** no longer silently discards the colour choice: the mode is independent of the
  view, so returning to Glyphs keeps it.
- `isTrackGroupConsColored()` is now a thin wrapper over the colour mode, so existing call sites
  and pre-0.39.0 saved sessions (which only had the boolean) keep working.

### Notes

- `DESIGN.md` §17 records where homolog colouring lives and why the default looks the way it
  does; the feature card is in `QA_CHECKLIST.md`.

## [0.38.0] - 2026-09-25

### Added

- **Empty tracks are marked, not hidden.** A track that imported but found nothing (a TM row
  for a soluble protein, say) now carries an **(Empty)** tag and is greyed slightly in the
  viewer and the Tracks tab, so it reads as "ran, found nothing" instead of looking like data
  or a failed import. The read-out also warns when the membrane answer is *Yes* but every
  transmembrane prediction came back empty.
- **Debugging console (action log).** Help → *Debugging console* shows the last **200** actions
  of the session — clicks, menu choices, task starts/finishes, imports, structure attaches,
  removals and exports — newest first, with Copy log / Copy as JSON / Clear. `q2dvActions()`
  in the browser console returns the same log as JSON. Structured entries are a deliberate
  starting point for macros. Session-only: never persisted, never sent anywhere.

### Fixed

- **A duplicated action button in the guided questionnaire.** After choosing a Foldseek
  database the card showed *Run Foldseek (pdb100)* **and** *Run Foldseek* — the tailored label
  was being treated as a second action. The secondary button now appears only when the
  *handler* differs, not the label (so it still appears for genuinely different actions, e.g.
  fetching an AlphaFold model vs attaching a file).
- The action log mirrors only meaningful events to the browser console (not raw clicks), so a
  user clicking around does not flood the console they are debugging with.

### Notes

- Both features have feature cards in `QA_CHECKLIST.md`, per the convention.

## [0.37.0] - 2026-09-25

### Added

- **Ensemble RMSF line plot.** The ensemble variance can now be shown as a graph instead of
  a heatmap row, like pLDDT/RSA: Track Control's *View as* offers **Graph** for the type, the
  View menu has *Toggle Ensemble RMSF graph*, and the mode persists per type.

### Changed (the graph machinery is now type-driven)

- `GRAPH_TYPES` + `graphScaleForGroup` / `graphMaxForGroup` / `graphTitleForGroup` replace the
  hardcoded pLDDT-vs-RSA branches, so a fourth graph type is a three-line change (declare it,
  give it a scale, give it a legend row). The RMSF scale is **auto-max** (rounded up to the
  next whole Å, minimum 1) with one-decimal ticks and a "RMSF (A)" axis.
- `renderViewer` partitions graph keys by type group instead of two named arrays, so the graph
  sections are built in `GRAPH_TYPES` order.
- The legend gained an **RMSF** row (the five colour bands), shown only while that type is a
  graph — the same rule as the pLDDT/RSA rows.
- Export parity: the SVG/PNG path already serialized `.graph-section-wrapper` generically, so
  the new graph exports for free; the metrics panel and the TSV/CSV export now include the
  `_RMSF` row, labelled **RMSF (A)** with the mean and the % mobile (≥ 3 Å) — previously the
  label was hardcoded to pLDDT/RSA.
- `formatTrackLabel` learned the `_RMSF` suffix, so the graph pill, legend and metrics rows
  read "Ensemble RMSF" rather than a mangled key.
- The graph's hover/selection integration needed no changes: the plotted points already carry
  the `col-<idx>` class convention, so the shared tooltip, column highlight, drag selection,
  cofactor rings and saved-selection rings all apply.

`QA_CHECKLIST.md` gained the feature card for the plot.

## [0.36.0] - 2026-09-25

### Added

- **Construct designer (truncated FASTA)** — Workflow tab, or *Construct FASTA…* on the
  Integrate step. Turns the annotations into a wet-lab construct: trim the disordered
  termini (only a terminal disordered stretch of at least N residues, so a short tail or
  a single stray residue is left alone) or keep the current selection, then preview,
  download or copy the construct as FASTA. Refuses when there is no disorder track, no
  ordered core, nothing selected, or when trimming would leave fewer than N residues.
  Primer design stays out of scope.
- **Feature → guide taxonomy** (`DESIGN.md` §16): every feature is classified
  (Background / Evidence source / Step extension / Interpretation / Analysis input /
  Deliverable / Step candidate), and the class decides whether and where it appears in
  the Evaluation Guide — plus a checklist for placing a new feature. This came out of
  review: the guide should explain *how a feature is used in a workflow* (e.g. what RMSF
  means for a fold claim), not just that the feature exists.

### Changed (retroactive taxonomy pass)

- **Ensemble variance** is now surfaced as a *step extension*: the Structure step carries
  an *Ensemble variance…* action and a how-to-read line about model agreement, the
  resolver offers *Compute ensemble variance* when more than one model is attached and
  none has been compared, and the read-out reports the ensemble spread (or suggests
  computing it).
- The **Integrate** step now carries the deliverables as actions: *Co-localization
  table…*, *Methods summary (.md)* and *Construct FASTA…*.
- `QA_CHECKLIST.md` gained the construct designer's feature card.

## [0.35.0] - 2026-09-25

### Added

- **Co-localization table** (DESIGN §7.2). The Data modal now tabulates, for the current
  selection or for a rule's matches, every metric that applies to each residue side by
  side: conservation, pLDDT, RSA, ensemble RMSF, the annotation types present, and which
  cofactors that residue sits near. Cofactor proximity reuses the neighbour lists
  recorded when each structure was attached, so no extra geometry work happens. The
  source picker lists the current selection plus every rule, and the table caps at 300
  rows with a note.

### Notes

- This completes the *table* half of §7.2; the boolean-query half was already the Rules
  engine. `QA_CHECKLIST.md` gained the feature card for it (should-do / try / edge cases).

### Added

- **Feature test cards** in `QA_CHECKLIST.md`: a documented convention that every new
  feature ships with a card giving *what it should do*, a normal-use walkthrough with
  the expected result at each step, and the likely edge cases with their symptom and
  cause. The first card covers Ensemble variance (RMSF).

## [0.34.0] - 2026-09-25

### Added

- **Ensemble variance (RMSF).** Tracks tab -> *Ensemble variance (RMSF)* (or Analyze ->
  *Ensemble variance…*): pick which attached models to compare (all by default) and
  compute the per-residue fluctuation across them. Comparing coordinates between
  models is only meaningful once the rigid-body difference is removed, so each model
  is superposed onto the first over their shared residues (**Kabsch**, solved through
  the quaternion eigenvector with a Jacobi eigensolver, so no matrix library is
  needed), and the spread about the ensemble mean is measured afterwards.
  - Writes one **Ensemble variance** (`EV_RMSF`) row: blue (rigid) through cyan,
    yellow and orange to red (very mobile), with a per-residue RMSF tooltip and a
    neutral colour where too few models cover a residue.
  - Reports each model's chain, residue count and **RMSD to the first**, plus the
    eight most mobile residues, and offers *Select mobile (RMSF >= 3 A)*.
  - Available as a rule condition (`RMSF:EV_RMSF`), so "mobile in the ensemble AND
    disordered" is a one-line rule.
  - Refuses clearly with fewer than two models, no sequence, or models sharing fewer
    than three residues.

### Fixed

- The floating legend overlapped the alignment grid's horizontal scrollbar; it now
  sits 20 px higher (`bottom: 40px`).

### Notes

- The RMSF is drawn as a heatmap row plus the summary table; the RMSF **line plot**
  (the shape DESIGN §7.3 describes) is the next increment — the graph machinery is
  currently pLDDT/RSA-specific.

## [0.33.0] - 2026-09-25

### Fixed

- **The variant FASTA panel was dead code.** `updateVariantFastaSection()` guarded on
  `#variantFastaSection`, `#variantFastaLabel`, `#variantFastaDisplay` and
  `#copyVariantTrackBtn`, none of which existed in the HTML, so it always returned
  early. The panel and its **Copy Variant** button now exist inside the FASTA Segment
  section (mirroring the homolog panel), and selecting a variant row shows its aligned
  sequence, narrowed to the selected residue range when there is one.
- **The latent `VAR_` keying bug** in that function: `keyedVariantsInfo` is keyed by
  the variant *name* while the track key carries the `VAR_` prefix, so the lookup
  always missed. It now strips the prefix (matching `getVariantAATrack`).
- **The 3D conservation colour scheme could outlive its data.** Removing the
  `CONSERVATION` row left the scheme selected with nothing to read, so the viewer
  showed an uncoloured model while the toolbar still claimed "Color: conservation".
  `syncP3DConservationMode()` now falls back to the default scheme and updates the
  toolbar, both when the scheme is next used and immediately on removal.
- Track removal also clears the removed key's `graphHighlights` entry, so no per-track
  state outlives its row.

### Notes

- Phase 1 of the agreed plan (loose ends). Old pre-0.23.0 saves are deliberately left
  alone per review: they only affect sessions saved before the registry persistence
  landed.

## [0.32.1] - 2026-09-25

### Changed

- The HHpred / DeepTMHMM hand-off button is named consistently: the action only
  **opens** the tool (no clipboard interaction at all) and the button beside it is
  labelled **Copy sequence (FASTA)**, matching the same button on the step card
  rather than introducing a second name for the same thing. The short description
  points at that button by name.

## [0.32.0] - 2026-09-25

### Fixed

- **Copying the sequence failed in the HHpred hand-off.** The combined action
  opened the tool first, and an auto-opened tab takes focus away, so
  `navigator.clipboard.writeText` rejected with "document is not focused". The copy
  is now a separate button (see below), so it runs while the page still has focus.
  As a second line of defence the copy falls back to a synchronous
  `document.execCommand('copy')` via a hidden textarea when the async Clipboard API
  is unavailable or refuses.

### Changed

- **"Copy sequence & open HHpred" is split into an open action plus a Copy sequence
  accessory**, per review: the primary button opens the tool, `Copy sequence` sits
  beside it, and the short description says to use it ("Use Copy sequence first, then
  paste it into HHpred..."). The same treatment applies to the topology step's
  DeepTMHMM hand-off. The accessory renders in both the short form and the step card,
  deduplicated against the step's own extra actions.

## [0.31.0] - 2026-09-25

### Added

- **Clipboard hand-off to external tools.** A third-party tool cannot be pre-filled
  from here (cross-origin, and HHpred has no sequence query parameter), so the useful
  thing is to hand the input over:
  - **Copy sequence & open HHpred** is what the homologs step now offers when the
    `.hhr` is not ready: it opens HHpred inside the click gesture (so popup blockers
    allow it) and copies the current sequence as FASTA, with a toast saying to paste
    it with Ctrl+V. The hint also names what HHpred accepts (A3M/CLUSTAL/FASTA/
    STOCKHOLM) and the databases to pick for template-based modelling
    (PDB_mmCIF70 / PDB_mmCIF30).
  - **Copy sequence & open DeepTMHMM** does the same for the topology step's
    "no predictor yet" answer.
  - **Copy sequence (FASTA)** and **Download FASTA** are always available on the
    homologs step, for pasting into any other tool or keeping a record.
  - The FASTA writer uses the loaded identifier as the header (newlines collapsed so
    the header stays a single valid line) and wraps at 60 residues; with no sequence
    loaded the actions refuse rather than opening an empty tool.

## [0.30.0] - 2026-09-25

### Fixed

- **The workflow reference opened as raw Markdown.** The guide header linked
  `WORKFLOW.md` directly, which GitHub Pages serves as plain text. It now opens in
  an in-app **Workflow reference** modal that fetches and renders the document with
  the same Markdown renderer the changelog uses (headings, lists, bold, code,
  links). If the fetch is blocked (browsers refuse to read local files over
  `file://`), the fallback points at GitHub's **rendered** view rather than the raw
  file. The changelog's fallback had the same raw-file problem and now uses the same
  rendered link.
- The renderer was changelog-specific (`renderChangelogMarkdown`); it is now the
  shared `renderDocMarkdown`.

### Added

- **Help** now lists the two documents (Workflow reference, Changelog), so they are
  reachable without hunting for the header link.

## [0.29.0] - 2026-09-25

### Fixed

- **Question options and action buttons read as one merged cluster** in the guide's
  short form: both are rows of pill buttons sitting next to each other. An
  unanswered question is now closed off with a dashed rule and a labelled divider
  ("or go straight to:") before the actions, and stacked questions (intake and step
  cards) get a rule between them so one question's options can never look like part
  of the next question.

### Added

- **Undo for a step's answer.** Picking an option was reversible only by clicking it
  again, which is not discoverable. The short form now offers **↺ Undo** next to the
  action, and the step card offers **↺ Undo answer** next to the question record.
  Both clear just that step's picks, so the question comes back and the generic
  action is offered again; other steps' answers are untouched.

## [0.28.0] - 2026-09-25

### Changed

- **The guide's short form ("Next:") is now the questionnaire for the current step**
  instead of a second copy of the step description. It shows the step's
  *unanswered* question with its options inline; answering it collapses the card to
  the tailored action + hint. That removes the redundancy where the short form said
  one thing while the step card below asked a leading question, and makes the short
  form reactive by construction: both views read the same question state, so they
  cannot disagree.
- The step description now appears only in the step card (full context: description,
  why it matters, how to read it, citations, and the question as an editable record).
- The "ready" answer for the homologs step now gets its own guidance
  (*"Attach the .hhr (and any variant FASTA) in Input Data..."*) rather than falling
  back to a bare button.
- `DESIGN.md` records the three-layer model (Protein Background / short form / step
  cards) and what each layer is for.

## [0.27.0] - 2026-09-25

### Fixed

- **"Fetch AlphaFold model…" did nothing but open the Data window.** The action was
  never implemented, only labelled. It now really fetches: the AlphaFold DB API and
  its model files are CORS-enabled (verified 2026-09), so it looks up
  `/api/prediction/<accession>`, downloads the returned `pdbUrl` and attaches the
  model like any other structure. Without an accession it falls back to ESMFold and
  says why (the DB is keyed by UniProt accession, not by sequence).
- **ESMFold "NetworkError".** The API is up (a 238 aa job returned 200 in 0.7 s,
  155 KB). The request now sends **no explicit Content-Type**, so a string body goes
  as `text/plain` (CORS-safelisted) and the call stays a "simple" request that can
  never be blocked by a failed preflight (the API answers OPTIONS with 403). If a
  browser still blocks it, the error is now dismissible and names the likely cause
  (privacy extension / tracking protection) plus the URL to test in a new tab.
  ESMFold also takes the task lock now (spinner + timer toast, one job at a time).

### Changed

- **The structure question asks for evidence type, not availability**:
  *Experimental (X-ray / cryo-EM / NMR)*, *Predicted only (AlphaFold / ESMFold)*,
  *None yet*, *Not sure*. The structure step is now **always on the critical path**
  (it was marked optional on a "Not yet" answer, even though structural homology and
  interfaces both depend on a model), and the offered action is tailored: attach a
  file for experimental, fetch AlphaFold for predicted, predict with ESMFold for
  none. Predicted-only evidence adds a read-out caveat.
- **The step the "Next:" card points at is highlighted** in the guide (blue summary
  fill + border, and a distinct recommended chip).
- **"Scan HMMER/Pfam" becomes "Re-scan HMMER/Pfam"** once a scan has run, greyed to
  read as done while staying clickable (the Input Data button follows too).
- Removed the duplicate *Attach Structure(s)* button in the Foldseek step (it is
  offered by the resolver only when no structure is attached).
- `DESIGN.md` §15 records the homolog-source analysis: what could replace HHpred
  (EBI phmmer, NCBI-BLAST, Foldseek), and why an MSA, not just hits, is the gap.

## [0.26.0] - 2026-09-25

### Fixed

- **Heatmap rows did not reach the right edge** (and the pinned AA block looked cut
  off / duplicated once you scrolled). A block box inside a horizontal scroll
  container is sized to the *viewport*, not to its overflowing content, so a row's
  background and hover band stopped where the visible area ended. Graph sections set
  an explicit content width, which is why graph mode looked right. `.track-row`,
  `.track-position-row` and `.sticky-top` now use `width: max-content` with
  `min-width: 100%`, so they span max(content, viewport) in both directions.
- **The grey column highlight lingered.** It is a hover affordance, but nothing
  cleared it when the pointer left, so it stayed in screenshots and after the mouse
  left the window. It is now cleared on grid `mouseleave`, on document `mouseleave`
  and on window `blur` (and hides the cell tooltip with it).

### Changed

- **All em-dashes removed** from the app's user-facing text and from the generated
  `WORKFLOW.md` (95 sites): read-out sentences became separate sentences, short
  status/tooltip separators became colons, and standalone "no value" dashes became
  hyphens. The test harness now fails if an em-dash is reintroduced.
- **"Tell the guide about this protein" is now the "Protein Background" accordion**,
  and it compresses itself once every question is answered (re-openable for the
  session, with a "reset answers" affordance inside).
- The all-covered state is a plain status line ("**All steps covered** (8 of 8).")
  instead of the filler sign-off sentence.

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
