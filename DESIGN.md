# Quick2DViewer — Design & Roadmap

Living design reference for the "characterization platform" phase. Companion to
`CHANGELOG.md` (what shipped) and `POTENTIAL_CHANGES.md` (loose ideas).

## 1. Product positioning

Single-file, dependency-free, client-side viewer that overlays **sequence-based
predictions** with **structure-derived annotations** for one target protein, and
turns selections into downstream outputs (3D commands, figures, constructs).

Differentiator vs Jalview/ConSurf/ProtVista: multi-modal overlay on **one**
reference, with per-residue cross-track querying.

**Invariants**
- One HTML file, no build system, no backend.
- Outbound API calls run only through the external-services switch, which is on
  by default on the deployed site and off on local `file://`, and can be turned
  off at any time.
- Tracks live in `parsedTracks[key]` (string, or object array for numeric).

## 2. The standard characterization pipeline (5 steps)

| Step | Standard practice | Tools | Q2DV today |
|---|---|---|---|
| 1. Sequence + local predictions + DB annotation | textbook | Quick2D, TMHMM, IUPred3, UniProt, InterPro | done (Quick2D + UniProt) |
| 2. Deep homology / MSA | standard | HHblits/HHpred (HH-suite3), MMseqs2 | done (HHpred import) |
| 3. Structure prediction | standard | AlphaFold 2/3, ColabFold, ESMFold | manual upload |
| 4. Structural homology / fold matching | standard | Foldseek | **missing** |
| 5. Variant effect | standard (clinical-leaning) | AlphaMissense, EVE, DMS | missing (low priority here) |

Steps 1–4 are the core; step 5 is largely human-genetics and lower priority for
membrane-protein work.

## 3. External services — CORS verdict (empirically tested)

| Service | Browser-callable? | Endpoint / notes |
|---|---|---|
| Foldseek | ✅ `allow-origin: *` | `POST https://search.foldseek.com/api/ticket`, **form-urlencoded** `q=<fasta>&database[]=afdb50&mode=3diaa` → `{id,status}`; poll `/api/ticket/{id}`; results `/api/result/{id}/{db}`. Simple request (no preflight). |
| ESMFold (ESM Atlas) | ✅ `allow-origin: *` | `POST https://api.esmatlas.com/foldSequence/v1/pdb/`, **text/plain** body = sequence → PDB. Simple request. Limit ≈400 aa. |
| RCSB data API | ✅ `allow-origin: *` | `https://data.rcsb.org/rest/v1/core/...` |
| PDBe API (incl. PISA) | ✅ `allow-origin: *` | `https://www.ebi.ac.uk/pdbe/api/...` |
| EBI HMMER (Job Dispatcher) | ✅ `allow-origin: *` | `https://www.ebi.ac.uk/Tools/services/rest/hmmer3/` (submit→poll→result). NOTE: the `/Tools/hmmer/search/...` URLs are the **web UI** (OPTIONS 405), not an API. |
| EBI BLAST (ncbiblast) | ✅ `allow-origin: *` | already integrated |
| MPI Toolkit (HHpred etc.) | ❌ 403 | clipboard wizard only (proxy deferred) |

**Opt-in gate:** a switch under Options -> Data Sources turns outbound API
access off or on. It is **on by default on the deployed site (http/https)** so
Q2DV behaves as a web viewer out of the box, and **off on a local `file://`
page**; the choice is remembered. Every request still carries a per-action
disclosure line in the activity log.

## 4. Architecture change #1 — `trackMeta` + source tagging (enabling refactor)

Every track records provenance:
```js
trackMeta[key] = { source: 'Quick2D'|'HHpred'|'Foldseek'|'HMMER'|'UniProt'|'ESMFold'|'pLDDT'|…,
                   category, fetchedAt, note }
```
Consumers: row labels, hover tooltips, the Tracks manager, the Data modal
(provenance table), and the 3D viewer info line (e.g. "ESMFold" vs "AlphaFold").

## 5. Architecture change #2 — `HH_` → `HL_` (Homolog)

Decision: **rename now** (single user, no legacy saves to preserve). New prefix
`HL_` = generic homolog; `hhpredHitsInfo` → `homologHitsInfo` with a `source`
field so HHpred / Foldseek / HMMER homologs coexist and are tagged.

## 6. Integrations (planned)

- **ESMFold** — button in Input Data: POST sequence → returned PDB flows through
  the existing PDB pipeline (pLDDT/RSA/cofactors/3D). Tagged `source: ESMFold`.
- **Foldseek** — sequence-in (ProstT5) or structure-in; DB default `afdb50`,
  selectable (`afdb50`/`pdb100`/`swissprot`/`bfvd`); results → `HL_` tracks +
  a Foldseek table (TM-score, E-value, coverage).
- **HMMER** — start with **hmmscan** (Pfam/CATH/Gene3D) → domain-architecture
  tracks; built generically so phmmer/jackhmmer can be added later.
- **MPI clipboard wizard** — HHpred (done) + HHblits worth adding; Modeller /
  Clustal / MMseqs2 / PDBsum are redundant or superseded. (Checked 2026-09: the
  EBI Job Dispatcher has no hhblits/hhpred service, so HHblits stays a clipboard
  hand-off - the MPI toolkit has no CORS API.)
- **InterProScan (EBI Job Dispatcher, `iprscan5`)** — done (v0.58.0) for two uses: topology
  prediction (TMHMM + Phobius + SignalP -> topology sources for the consensus) and a domain-scan
  provider (PfamA + NCBIfam). The TSV renderer is used because the JSON one does not name the
  analysis. **Bacteria/viruses:** the app was already species-agnostic through UniProt (any taxon),
  phmmer/BLAST vs Swiss-Prot, hmmscan/Pfam, Foldseek, ESMFold, the topology predictors and
  conservation; NCBIfam now adds the bacterial/viral family models (TIGRFAM/PRK/NF). Dedicated
  pathogen resources (VFDB virulence, CARD AMR, BV-BRC genomes) are **not** integrated - candidates
  for the capability/provider registry once their CORS behaviour is verified.
- **PDBe validation** — experimental structure quality (done, v0.60.0): per-residue wwPDB outlier
  summary + entry quality scores, one `VAL_` row per chain, mapped onto the reference by sequence
  alignment. Any species (it is about the experimental entry, not the organism).
- **AlphaMissense** — variant effect predictions (done, v0.56.0): the AlphaFold DB
  entry's `amAnnotationsUrl` CSV is fetched on demand and only the loaded variants'
  substitutions are kept. Same accession requirement as the AlphaFold model fetch,
  and human-only coverage (the file simply does not exist otherwise).

## 7. Analysis frameworks

1. **Cross-Track Contradiction Engine** — small **Rules panel** with presets
   (e.g. `disorder>0.6 ∧ TM==1 ∧ pLDDT<50`). Low effort, high value.
   *Preset list to be finalized with literature.*
   **Framework done (0.14.0)** — Rules panel (Tracks tab): numeric + categorical
   conditions, ALL/ANY, `RULE_` tracks, select-matches. **Presets still TBD.**
2. **Multi-Metric Co-localization Engine** — boolean query across metrics
   (conservation ∧ distance-to-ligand ∧ variant score). Output: a **track** of
   passing residues **plus** a separate Data **table**. Needs spatial distance
   (cofactor machinery exists).
   **Done (0.35.0)** — the track half is the Rules engine (any numeric/categorical
   source, `RULE_` tracks, select-matches); the table half is the Data modal's
   *Co-localization* section (`buildColocalizationRows` / `renderColocalizationTable`),
   sourced from the current selection or a rule, with cofactor proximity taken from the
   neighbour lists recorded at attach time. A dedicated `distance-to-cofactor` numeric
   rule source is *not* built: proximity is exposed in the table rather than as a
   condition, since the neighbour shell is already a yes/no at attach time.
3. **Ensemble Structural Variance Analyzer** — column-wise coordinate variance
   across models. Output: a **graph** (RMSF-style line plot). Scope: **all
   loaded models or a user-picked subset**.
   **Done (0.34.0 + 0.37.0)** — `computeEnsembleVariance()` + Kabsch superposition
   (`kabschSuperpose` / `largestEigenvector4`, Jacobi eigensolver, no dependencies);
   writes the `EV_RMSF` row (heatmap colours + tooltip), reports per-model RMSD and the
   most mobile residues, and exposes `RMSF:` as a rule numeric source. The **line plot**
   shipped in 0.37.0 by making the graph machinery type-driven: `GRAPH_TYPES` +
   `graphScaleForGroup` / `graphMaxForGroup` / `graphTitleForGroup`, a legend row, the
   View menu toggle, per-type persistence, and metrics-export parity. The plot inherits
   hover/selection/export for free because the points use the `col-<idx>` convention.
4. **Downstream Script Compiler** — ChimeraX/PyMOL/VMD (done) + wet-lab
   **truncated FASTA constructs** (strip disordered termini). Primer design
   scoped out for now.
   **Done (0.36.0)** — Construct designer in the Workflow tab (`computeConstruct` /
   `constructFastaText` / `renderConstructPreview` / `downloadConstructFasta` /
   `copyConstructFasta`): disorder-trimmed or selection-based, threshold on the
   *terminal disordered stretch* length, with guards for no disorder data, no ordered
   core, nothing selected, and too-short results. Exposed on the Integrate step.

## 8. Interfaces (client-side)

Residues where chains' atoms come within a cutoff (default ~5 Å heavy-atom).
Output: **one interface-residue track per chain** + a **contact table**.
Client-side so it works on AlphaFold/ESMFold models (PDBe PISA only covers
deposited entries).

## 9. Implementation order

0. **Housekeeping (done, 0.10.1)** — test harness (`npm test`), non-blocking dialogs,
   HTML escaping pass, centralized `SERVICE_URLS`, dead-code sweep.
1. `trackMeta` + source tagging + `HH_`→`HL_` rename — **done (0.11.0)**
2. ESMFold integration — **done (0.12.0)**; service registry + provider fallback
   + external-services opt-in shipped alongside
3. Foldseek integration — **done (0.13.0)**; structure-query only (server-side
   sequence/ProstT5 path errors), results as `HL_` tracks + template table
4. Contradiction engine (Rules panel)
5. Client-side interface analysis — **done (0.15.0)**: `IF_<chain>` tracks + chain-pair table
6. HMMER hmmscan
7. ~~Ensemble variance~~ — **done (0.34.0 + 0.37.0)**, including the line plot;
   ~~co-localization table~~ — **done (0.35.0)**; ~~wet-lab constructs~~ — **done (0.36.0)**

## 10. Open items / to discuss
- **Tracks vs Track Control redundancy (noted).** The right sidebar's *Tracks* tab and the
  grid's *Track Control* popover overlap (visibility + view-as). Not necessarily a problem,
  but consider consolidating later (e.g. Track Control popover → "open full manager").
- **UI polish — left sidebar / track rows (noted).** The `tctl-chevron state-on`
  on the first row of a track type reads as visually messy; the track rows overall
  should be cleaner and more reactive (hover/active affordances). Revisit the
  chevron placement/styling + row hover states after the service integrations.
- ~~Contradiction **presets**~~ — **done (0.22.0)**, literature-backed (see §11).
- Co-localization UI shape (track + table) — still open; the Rules engine covers the
  boolean query, the separate Data table is not built (see §7.2).
- Foldseek result semantics (TM-score color-coding) — still open; results are ranked
  by probability today.
- MPI proxy — deferred; revisit if clipboard friction is high. The clipboard hand-off
  (0.31.0 / 0.32.1) covers the practical need for HHpred and DeepTMHMM.
- ~~Variant FASTA panel~~ — **done (0.33.0)**: the panel and its Copy Variant button
  were built (the code had been guarding on elements that did not exist) and the
  `VAR_` registry keying fixed.
- ~~3D viewer + removal~~ — **done (0.33.0)**: `syncP3DConservationMode()` resets the
  colour scheme when its row is removed, and removal clears `graphHighlights`.

## 11. Rule presets (implemented v0.22.0)

A curated set of named rules seeding the Rules panel. `RULE_PRESETS` in
`index.html` is the source of truth; `tools/build-workflow-doc.js` renders the
same library (query, rationale, citations) into `WORKFLOW.md`, and the harness
asserts every preset name and DOI appears there, so the document cannot drift.

**The group-source extension is in.** A categorical condition may name
`group:<GROUP>` — "any track of that type is annotated" — so a preset survives
re-running a predictor, attaching a second model, or swapping a Foldseek
database. Numeric conditions use the `RSA:` (any model) pseudo-source or the
`pLDDT_mean` / `pLDDT_min` aggregates, which now work from a single model up.
A test enforces that **no preset references a `track:<key>` source**.

`presetMissingSources(preset)` reports which inputs a preset still needs (shown
as a *needs …* note on the card), and `suggestedRulePresets()` ranks the relevant
ones to the top from `guideProfile` + the loaded data — the profile → presets
link promised in §12. Applied rules are deep copies (`presetId` recorded), so
editing a rule never rewrites the preset.

| # | Preset | Conditions (implemented) | Rationale |

| # | Preset | Conditions (sketch) | Rationale |
|---|--------|--------------------|-----------|
| 1 | **Topology contradiction** (QC) | disorder `group:DO` annotated **AND** `group:TM` annotated **AND** `pLDDT (mean) < 50` | TM and disorder predictions should rarely overlap; a residue flagged both is usually a hydrophobic segment misread as a helix, or a genuinely disordered membrane-proximal region. |
| 2 | **Conserved buried residue** (functional/catalytic candidate) | `conservation ≥ 0.85` **AND** `RSA < 0.2` | Conservation + burial enriches strongly for active-site / binding residues. |
| 3 | **Conserved exposed patch** (interaction/interface candidate) | `conservation ≥ 0.8` **AND** `RSA ≥ 0.5` | Conserved *surface* residues often mark protein–protein interfaces / functional surfaces. |
| 4 | **Rigid, well-folded core** | `pLDDT (min) ≥ 90` **AND** `RSA < 0.25` | High confidence + buried = rigid structural core. |
| 5 | **Flexible / disordered region** | `pLDDT (mean) < 70` **AND** `group:DO` annotated | Agreement between low structural confidence and disorder prediction. |
| 6 | **No-model-confidence region** | `pLDDT (min of models) < 50` | Regions where *no* model is confident → likely flexible / unmodelled. |
| 7 | **Conserved but poorly modelled** | `conservation ≥ 0.8` **AND** `pLDDT (min) < 50` | A real, evolutionarily constrained region the models fail on (ligand-bound or membrane-embedded cores). Prime "look here" flag. |
| 8 | **Signal / topology feature** | `group:TP` annotated (or `UP_Signal`) | Flag signal-peptide / topology features for construct design. |

### References

The canonical, DOI-verified reference list now lives in **`WORKFLOW.md`**
(generated from `WORKFLOW_STEPS` by `tools/build-workflow-doc.js`). Every DOI
there was resolved against the Crossref API on 2026-09.

Six entries in the earlier list below resolved to unrelated papers and were
corrected during that check; the wrong values are kept here only so the
correction is auditable:

| Reference | Was (wrong) | Now (verified) |
|---|---|---|
| TMHMM 2001 | `10.1006/jmbi.2001.4911` | `10.1006/jmbi.2000.4315` |
| Ruff & Pappu 2021 | `10.1016/j.jmb.2021.167089` | `10.1016/j.jmb.2021.167208` |
| Capra & Singh 2007 | `10.1093/bioinformatics/btm242` | `10.1093/bioinformatics/btm270` |
| Lichtarge et al. 1996 | `10.1006/jmbi.1996.0298` | `10.1006/jmbi.1996.0167` |
| Valdar & Thornton 2001 | `10.1002/prot.10103` | `10.1002/1097-0134(20010101)42:1<108::aid-prot110>3.0.co;2-o` |

Unchanged (verified): IUPred2A `10.1093/nar/gky384`; AlphaFold2
`10.1038/s41586-021-03819-2`; ConSurf 2016 `10.1093/nar/gkw408`; SignalP 6.0
`10.1038/s41587-021-01156-3`.

## 12. Guided evaluation workflow ("Evaluation Guide", v0.18.0)

Goal: turn the characterization pipeline from a static checklist into a **visible,
adaptive framework** that helps a researcher stay on track — while leaving every
metric and tool available for manual inspection.

### Model

- `WORKFLOW_STEPS` (`index.html`) is the single source of truth: 8 steps, each with
  `why` (rationale), `action`/`extraActions` (the in-app call that satisfies it),
  `how` (interpretation guidance), `check()` (live status from loaded tracks) and
  `priority(profile)` (intake-driven ranking). The Input Data checklist and the
  guide both render from it, so they cannot drift.
- Pipeline order: sequence → primary-structure features → curated annotation &
  domains → homologs & conservation → structural model → structural homology →
  topology → integrate & export.
- `GUIDE_QUESTIONS` (5) drive `guideProfile` (persisted): membrane/secreted,
  structure available, homologs in hand, evaluating variants, function unknown.

### Semi-autonomous behaviour

1. **Adaptive ranking** — intake answers mark steps *recommended* vs *optional*,
   and a **Next:** card always names the highest-value unfinished action.
2. **Live status** — each step is `done` when its `check()` finds the corresponding
   data in `parsedTracks` (so progress is measured against real loaded state).
3. **Automated read-out** — `computeGuideInsights()` reads loaded tracks back and
   warns before over-reading: mean pLDDT < 70, no homologs / best identity < 30%,
   membrane flagged but no TM data, variants flagged but no variant FASTA, domains
   present without curated UniProt boundaries.

### Deliberate constraints

- The guide never *replaces* the suite: each step's action is the same function the
  menus call, and every track/panel stays reachable manually.
- Insights are advisory and cite their basis ("mean pLDDT", "best homolog identity")
  rather than asserting biology — they are flags to inspect, not conclusions.

### Placement, overrides and citations (v0.19.0)

- **Own tab.** The guide lives in its own **Guide** sidebar tab (Selection /
  Tracks / Guide / Workflow). The Workflow tab keeps the External Workflow
  command generator. The Input Data checklist is now a **read-only indicator**:
  it renders the same `WORKFLOW_STEPS` status + overrides and links to the Guide
  tab, so there is one editable place, not two.
- **User overrides** (`guideOverrides`, persisted): any step can be
  `done` (handled outside Q2DV), `skipped` (out of scope — it leaves the progress
  denominator and is never recommended), or cleared back to auto-detection. The
  `check()` stays the source of truth; overrides only layer on top, and the card
  always states which of the two is speaking.
- **Re-run at any time.** A step's action button is never disabled: when a step
  is done it reads *Re-run: …*, so a category can be refreshed when partial data
  was already added.
- **Citations.** Each step carries `refs` (DOI + label) shown on the card, and
  `priorityNote` (when the intake promotes it). Every DOI was resolved against
  Crossref on 2026-09; six DOIs from the old §11 list were wrong and are corrected.
- **External reference doc.** `WORKFLOW.md` is generated from `WORKFLOW_STEPS` +
  `GUIDE_QUESTIONS` by `tools/build-workflow-doc.js` (`npm run doc:workflow`) and
  is linked from the guide header. The test harness asserts the document contains
  every step title and DOI, so it cannot drift from the app.

### Per-step questions (v0.20.0)

The global intake re-ranks steps; each step then asks its own short questions
(`STEP_QUESTIONS`) that choose *how* the step is satisfied. Answers are stored
flat as `'<stepId>.<questionId>'` in `guideAnswers` (persisted) and are resolved
by `STEP_ACTION_RESOLVERS` into the concrete action to offer — e.g.:

| Step | Answer | Offered action |
|---|---|---|
| Sequence | UniProt accession | `autoLookupAccession()` (fetch entry) |
| Annotation | "Only Pfam domains" | `runDomainScan()` |
| Structure | ESMFold | `predictStructureESMFold()` (≤400 aa hint) |
| Foldseek | pdb100 | `Run Foldseek (pdb100)` — also sets the DB select |
| Topology | TMHMM / Phobius / DeepTMHMM | `openTopologyPanel()`; "None yet" → opens a predictor |
| Integrate | Variant triage / Interface / Construct / Figure | Rules / Interfaces / command generator / export |

`resolveStepAction(step)` always returns something runnable: with no answers it
falls back to the step's own action and reports `custom: false`, so the wizard
degrades to the generic action rather than blocking. Re-clicking a selected
option clears it; `resetStepAnswers()` clears all. The generic action stays on
the card as a secondary button whenever an answer overrides it.

### Roadmap (status)

- ~~**Profile → rule presets**~~ — **done v0.22.0** (`suggestedRulePresets()` +
  the `group:<GROUP>` source from §11).
- ~~**Profile → topology/TM cross-check**~~ — **done v0.23.0**
  (`computeTmCrossCheck()`; the guide read-out names the disagreement count, and
  the topology step carries a *Cross-check TM* action). The comparison is pure and
  client-side; it writes one `XC_TM` row in the new **Cross-checks** group plus a
  segment table whose rows can be turned into selections.
- ~~**Report export**~~ — **done v0.23.0** (`buildMethodsReport()` /
  `exportMethodsReport()`): intake answers, coverage table with the per-step
  answers, loaded evidence, rules (readable queries + preset ids), the TM
  cross-check, the automated read-out, and the citations for covered steps only.
  Reached from Export → *Methods summary (.md)* and the Guide tab.
- Still open: a **`group:<GROUP>` numeric aggregate** (e.g. mean over a type) if a
  future preset needs it; migrating pre-0.23.0 saves (see `QA_CHECKLIST.md` X1).

## 13. Track removal (v0.21.0)

**Hide vs remove.** `trackControlState.hidden/filtered` are view choices and are
reversible; removal deletes the data. Because almost every track is *derived*, a
raw `delete parsedTracks[key]` would be undone by the next re-parse, so removal
runs a per-group cleanup first. `TRACK_REMOVERS` is keyed by **`getTrackGroup`
result** (group names such as `UP`, not key prefixes):

| Group | Cleanup on removal |
|---|---|
| `HL` | `homologHitsInfo[key]` |
| `DM` | `domainHitsInfo[key]` |
| `UP` | `uniprotFeatureTracks[key]`; removing the last row clears `uniprotFeatures` |
| `RULE` | drops the matching `analysisRules` entry + its `trackMeta` |
| `TP` | splices the matching `topologySources` entry, then `applyTopologySources()` rebuilds the rows (consensus included) |
| `VAR` | `keyedVariantsInfo[name]`, then `recomputeConservationScores()` |
| others | session-level row removal (a re-import can restore them — this is why the SCI/SS/pLDDT groups have no registry cleanup) |

`removeTracks(keys, { silent })` also clears the per-track entries in all seven
`trackControlState` bags (and a group's `hidden` flag once its last row is gone),
then repaints viewer / cross-refs / Input Data / Tracks tab / guide and persists.
`AA` is refused — that *is* the dataset, so it routes to `resetAllData()`.

**Surface area.** Per-track: right-click → *Remove this track…*, or the `×` in the
Tracks tab. Per-type: *Remove type…* in the per-type popover, or the `×` on the
type row. All routes confirm first (`confirmDialog`, danger).

**Guide Undo.** The same engine expressed per step in `STEP_UNDO` (groups to
remove, plus an optional `filter` — Foldseek only removes its own hits). Undo
deliberately does **not** touch `guideOverrides`, so "marked done" and "has data"
stay independent signals. The sequence step has no row to remove and routes to
`resetAllData()` instead.

**Bug found while building it.** Removing the last conservation input rebuilt the
row as all-zeros (`computeConservationScores([])` returns a zero-filled array of
the right width) instead of dropping it; `recomputeConservationScores()` now
deletes the row when there are no input sequences.

## 14. UniProt lookup: identifier parsing + the search provider fix (v0.24.0)

**Why lookups appeared to do nothing.** `text_search` pointed at the EBI Proteins API
(`https://www.ebi.ac.uk/proteins/api/proteins`). Re-tested 2026-09: every request
timed out (12 s → 120 s), so the search path never returned. EBI Search's UniProt
index (`https://www.ebi.ac.uk/ebisearch/ws/rest/uniprot`) serves the same data in
~1 s and needs a single request for the whole result list (`fields=acc,id,
gene_primary_name,organism_scientific_name`). The dead provider stays registered but
`enabled: false` with the reason, so the fall-through chain still documents it.

**Field prefixes matter.** EBI Search has no `protein:` field; the verified mapping is
`protein → descRecName`, `gene → gene_primary_name`,
`organism → organism_scientific_name`, and `any → ''` (bare query). A bare query is
what matches *entry names* (`GFP_AEQVI` → 1 hit) and accessions; `descRecName:GFP_AEQVI`
returns 0 hits, which is exactly why the corrected term must use the bare form.

**Identifier lines are parsed, not re-typed.** Quick2D's `Protein ID` line and FASTA
headers share a shape (`sp|P42212|GFP_AEQVI Green fluorescent protein OS=… GN=…`), so
`parseProteinHeaderLine()` extracts database / accession / entry name / protein name /
organism / gene. `deriveLookupDefaults()` turns that into a mode + terms:

| Parsed | Mode | Search fallback |
|---|---|---|
| accession present | **Accession**, pre-filled | field `any`, term = entry name |
| name only | **Search** | field `protein`, term = protein name |

`resolveUniProtSearchTerm()` autocorrects at fetch time: a pasted header line (or an
empty box with a label loaded) becomes the entry name, announced with a top-right toast
so it is obvious what ran and that the panel can be left. A progress line
(`beginLookupStatus`/`endLookupStatus`) shows mode, query, estimate and elapsed time.

**Plain FASTA is a valid start.** `parsePlainFasta()` accepts a `>header` plus sequence
(and is deliberately not fooled by Quick2D output), producing a sequence-only session
via `buildFromPlainFasta()`, so predictions/annotations can be layered on afterwards.

## 15. Homolog sources: what can replace HHpred? (v0.27.0)

Asked in review: "is there really no alternative to HHpred, none with API?"

**What the guide needs from a homolog source is not just hits, but an MSA.**
Conservation, the per-column match-quality glyphs, the homolog template table and
the HMM-derived metrics all read from an alignment of homolog sequences onto the
reference. HHpred/HHblits deliver that in one step (MSA + HMM + per-column
posterior probabilities).

API-available alternatives, in increasing order of work:

| Source | API | Gives | Gap |
|---|---|---|---|
| EBI HMMER **phmmer** | `Tools/services/rest/hmmer3_phmmer` (Job Dispatcher, so the existing `ebiJob` adapter and CORS story apply exactly as for hmmscan) | hits with per-domain alignment coordinates and E-values | no per-column match quality; we would build the MSA and score columns ourselves |
| EBI **NCBI-BLAST** | already wired as the `sequence_search` capability | HSP alignments (query/target strings per alignment) | pairwise HSPs only; hits need aligning onto the reference |
| **Foldseek** | already wired as `structure_search` | structural hits with aligned query/target strings | needs a structure, and it is structural rather than evolutionary evidence |

So HHpred remains the only *curated MSA* source, but a phmmer/BLAST path is
feasible with what already exists. Sketch: run `sequence_search`, build `HL_` rows
from each HSP's aligned query/target pair using the same mapping Foldseek already
uses (`qAln`/`dbAln` -> `foldseekQualityChar`), fall back to
`alignVariantToReference` for hits that need realignment, then let
`recomputeConservationScores()` pick the rows up. The glyphs would come from
BLOSUM62 (`blosum62Score` already exists) rather than HHpred posterior
probabilities, so the rows must be labelled with their own source, e.g.
"BLAST (aligned)", to keep provenance honest.

### Shipped: phmmer homolog search (v0.52.0)

`homolog_search` is now a real capability (`ebi_phmmer`, `hmmer3_phmmer`,
Swiss-Prot, `E=1e-3`) and Analyze -> *Search Homologs (phmmer)…* (or the Input Data
button, or the guide's homolog step) runs it, parses HMMER's text output and adds
`HL_` rows. Three details worth recording:

- **The glyphs did not need building.** HMMER's text output carries a
  posterior-probability line (`*` = 1.0, digits = int(10p), `.` = < 0.05, blank at
  gaps), so phmmer rows reuse the HHpred match-quality scale directly
  (`*`->`|`, 8-9->`=`, 6-7->`+`, 3-5->`:`, else `.`). No BLOSUM62 reconstruction was
  needed and `buildHomologTrackString` needed no changes.
- **Significance is HMMER's own call**: only hits above the inclusion threshold
  become rows (the same rule the domain scan applies to `!` vs `?` domains), which
  is why the provider asks for `E=1e-3` - the parameter is `E`; the `evalue`
  parameter does not control the reporting cut-off.
- Parsing traps handled: `== domain` headers are indented; alignments wrap every
  ~100 columns with blank lines between the wrap blocks (same domain, so blanks
  must not end a segment); the query line's sequence starts at
  `prefix + start-number + space` (not just the prefix) and the target, match and
  posterior lines are padded to that same offset; lowercase target residues are
  insertions aligned to query gaps; target gaps are `-`.

### Shipped: BLAST as the second provider (v0.53.0)

The `homolog_search` capability now offers NCBI-BLAST after phmmer, and Input
Data has a provider picker (`opts.prefer` in `runCapability()` reorders the list;
the other provider stays as a fallback). What the section above predicted held
true, with two corrections:

- **No realignment was needed for the common case.** The JSON renderer carries
  `hsp_qseq`/`hsp_hseq` per HSP, so each HSP becomes a segment directly - the
  `alignVariantToReference` fallback is only relevant for hits whose HSPs leave
  gaps over the reference (they show as partial rows, which is honest).
- **The glyphs are BLOSUM62 via `foldseekQualityChar`** (identical `|`, positive
  `:`, otherwise `.`), the same derivation Foldseek rows already use, and the
  predictor tooltip now switches bands/citation by source (phmmer posterior,
  BLAST/Foldseek BLOSUM62, HHpred match probability).
- Quirk worth keeping: the ncbiblast `database` value is `uniprotkb_swissprot`
  (plain `swissprot` is rejected), and unlike hmmer3 it does have a JSON renderer.

Still open: realigning hits whose HSPs do not cover the reference, and deciding
whether a hit with only partial HSP coverage should be flagged in the row.

### Shipped: one ranking for every source (v0.54.0)

The Data modal's Homolog Templates table now scores all four sources together.
Confidence is the source probability where one exists (HHpred Probab, Foldseek
prob) and an E-value-derived value otherwise (phmmer/BLAST: `-10*log10(E)`,
clamped 0-100, i.e. 10 points per decade), so the score stays interpretable and
the column tooltip says which basis applies. Coverage counts aligned residues in
the stored `aaTrack` rather than summing HSP columns (union-correct for
overlapping BLAST HSPs), identity parsing handles "x/y (z%)" / "%" / 0-1, and
the Structure column resolves cached files, RCSB PDB entries and - for accession
hits - the AlphaFold model, which the 3D action fetches on demand. The table is
also in the methods report and copies as TSV. The identity bug this pass fixed
(`parseFloat("237/238 (100%)")` = 237) had been leaking into the methods report,
which is exactly the kind of number that should never reach a write-up.

### Guide layout: short form vs step card (v0.28.0)

The guide has three layers, and each now has exactly one job:

| Layer | Role | Contains |
|---|---|---|
| **Protein Background** (accordion) | global framing | the 5 intake questions; re-ranks steps, rules a step out |
| **Next:** card (short form) | the active prompt | the current step's *unanswered question* (answerable inline), or, once answered, the tailored action + hint, plus the overrides |
| **Step cards** (below) | the reference | description, why it matters, how to read it, citations, the question as an editable record, every action |

Before v0.28.0 the short form restated the step description while the step card
asked the question, so the two could read as different instructions. Now the short
form *is* the questionnaire for the current step: answering there is what produces
the action it offers, so the two views cannot disagree. The description is only in
the step card (no duplication), and an answered question collapses the short form
to `action + hint`, which is what makes it feel reactive.

## 15b. Variant effect providers — modular framework (v0.57.0)

Variant effect prediction started as an AlphaMissense call (human only). It is
now a provider registry (`VARIANT_EFFECT_PROVIDERS`) so species coverage is a
configuration concern:

| Provider | Kind | Coverage | Gives |
|---|---|---|---|
| `alphamissense` | remote | Human (UniProt proteome) | proteome-wide pathogenicity class per substitution |
| `conservation` | local | Any species (needs homologs/variant FASTA) | how constrained the position is |
| `structure` | local | Any species (needs an attached model) | buried/exposed, pLDDT, SS at the position |
| `curated` | local | Species with curated entries | UniProt features overlapping the position |

Contract: `coverage`, `kind`, `needs`, `available(ctx)`, `run(ctx) ->
{ results: { 'R175H': { label, detail, level } }, summary }`. The UI runs every
applicable provider (failures isolated), merges results per substitution and
shows one line in the tooltips/panel/status/read-out.

**Live check (2026-09) for the species-general APIs:** Ensembl REST VEP returned
HTTP 500 for every request including `/info/ping`; SIFT 4G was 502; PROVEAN
serves no usable API; the ESM Atlas has no variant endpoint. So the local
providers are the honest universal answer for now, and the registry is the hook
for VEP (plants/animals) or any successor when it is reachable. If VEP comes
back, it needs protein->transcript mapping (UniProt xrefs) plus a
`p.`-notation HGVS request - a self-contained provider entry.

## 16. Feature → guide taxonomy (v0.36.0)

Every feature lands in one of these categories, and the category decides whether (and
where) it appears in the Evaluation Guide. This exists so a new feature is never added
without answering "how does a researcher actually use this?", and so the guide stays a
workflow rather than a feature list.

| Category | Meaning | Guide treatment |
|---|---|---|
| **Background** | design choice, plumbing, accessibility, layout, persistence | none. Invisible to the researcher on purpose |
| **Evidence source** | produces tracks/data that satisfy a step | a step action, and it counts toward that step's status |
| **Step extension** | deepens an existing step's evidence | a hint/action on that step, shown when it applies |
| **Interpretation** | reads loaded data back and advises | the automated read-out, and/or a cross-check action |
| **Analysis input** | feeds the Rules / co-localization machinery | the Integrate step's hints plus the Rules panel |
| **Deliverable** | produces an output (report, constructs, figures, commands) | an action on the Integrate step |
| **Step candidate** | significant enough to become its own pipeline stage | would need a `WORKFLOW_STEPS` entry (a deliberate decision, not a default) |

### Retroactive mapping (features shipped before this section)

| Feature | Category | Guide home |
|---|---|---|
| HMMER hmmscan | Evidence source | Annotation step action (`runDomainScan`) |
| AlphaFold fetch / ESMFold | Evidence source | Structure step action |
| Foldseek | Evidence source | Structural homology step |
| Interfaces | Evidence source | Integrate step action |
| Rules + presets | Analysis input + Interpretation | Integrate step action; read-out suggestions |
| TM cross-check | Interpretation | Topology step action; read-out disagreement count |
| Copy-FASTA hand-off | Step extension | Homologs + Topology steps (accessory) |
| UniProt lookup / identifier parsing | Evidence source | Annotation step action; lookup defaults |
| **Ensemble variance (RMSF)** | Step extension + Analysis input | *Added 0.36.0*: Structure step hint + action, read-out line, `RMSF:` rule source |
| **Co-localization table** | Deliverable | *Added 0.36.0*: Integrate step action |
| Methods summary report | Deliverable | *Added 0.36.0*: Integrate step action |
| Variant FASTA panel | Background (utility) | none |
| Empty-track marking | Background (readability) | none (but the read-out flags an empty TM row against a membrane answer) |
| Declared oligomeric state | Step extension (structure / interfaces) | sixth intake question; read-out claim-vs-coordinates; assembly action |
| Experimental assembly import | Evidence source | Structure step action (`showAssemblyPanel`) + the Interfaces control |
| Debugging console (action log) | Background (tooling) | none — a testing/macro aid, not a research feature |
| Track removal / Undo / overrides | Background | none |
| Legend + scroll fix, layout, a11y | Background | none |
| Feature test cards | Process | n/a |

### How to place a new feature (the checklist)

1. Which category? If **Background**, stop: no guide work needed.
2. If **Evidence source**, which step does its output satisfy? Add it as that step's
   action (or an extra action) and make sure the step's `check()` sees the data.
3. If **Step extension**, add a hint (and an action when it applies) to that step, and a
   read-out line when the data is present.
4. If **Analysis input**, add the source to the Rules engine and mention it in the
   Integrate step's hints.
5. If **Deliverable**, add an action to the Integrate step.
6. If **Step candidate**, do not sneak it in: add a `WORKFLOW_STEPS` entry (with why /
   how-to-read / citations) and regenerate `WORKFLOW.md`.
7. Write the feature test card either way.

## 17. Homolog colouring: where it lives (v0.39.0)

**Before 0.39.0** a homolog row's per-residue colour came from
`HH_QUALITY_COLORS[char]`, where `char` is the **per-column match-quality symbol** imported
from the `.hhr` (`|`, `:`, `.`, …). That is a property of *that homolog at that column*, so
the same residue letter in one column is legitimately a different colour in every row — which
reads as noise until you know the encoding. The only alternative was a "Cons. colors" toggle
buried in the per-type chevron popup, plus a checkbox in the type's Config frame that wrote
**stale `HH` keys** from before the `HH_` → `HL_` rename, so it never applied at all.

**Now** the choice is a first-class **Color** column in Track Control, between *View as* and
*Config*, driven by `trackControlState.colorMode[group]`:

| Mode | Colour encodes | Uniformity |
|---|---|---|
| **Match quality** (default) | that homolog's HHpred match quality at the column | varies per row, by design |
| **Conservation** | the per-column conservation band (Options metric) | one colour per column across rows |
| **Residue type** | the residue letter (template's, else the reference) via `RESIDUE_COLORS` | the same letter is one colour everywhere |

Only homologs have more than one mode today (`GROUP_COLOR_MODES`); other types show a muted
dash rather than a fake choice, and adding a mode for another type is a table entry plus a
rendering branch. `isTrackGroupConsColored()` is now a thin wrapper over the mode, so older
call sites and saved sessions keep working, and the old toggle/checkbox were **removed** rather
than duplicated. The colour mode is also independent of the view: choosing Bar no longer
discards it (Bar simply paints over the colours).

## 18. Macro recording — plan (v0.66.10, planning only)

Goal: record a session's actions (fetch UniProt, scan domains, run phmmer, realign, add a rule)
as a named, replayable macro, so a repeated analysis is one click. **Not implemented yet**; this
section records the constraints so the pieces get built in the right order.

Why the activity log is the base: every user-triggered action already funnels through
`logAction()` with a kind and a summary, and the API lifecycle lands in the activity log too. A
recorder taps that funnel instead of building a parallel event system.

What a macro step should be: a *capability call or a pure UI action*, never a DOM event.
- capability runs (`runCapability(id, opts)`) with the resolved provider id,
- imports (FASTA, variant FASTA, PDB id, experimental / ddG paste, offset),
- view actions (add rule, colour mode) - cheap and idempotent,
- never raw clicks, scroll positions, or text selections.

Replay semantics:
- **Dry run first**: replay resolves each step and lists what it would fetch (provider, sequence
  hash); the user confirms before anything runs.
- **Idempotence**: imports replace by track key; a capability run skips when a same-provider
  result for the same sequence is already loaded (with a per-step override).
- **Stale-sequence guard**: the macro records the reference sequence hash; replaying against a
  different sequence warns and offers per-step rebind.
- **No silent network**: every replayed fetch lands in the activity log exactly like a manual one.
- Storage: one JSON (`{name, seqHash, steps:[{capability, provider, params, trackKey}]}`) with the
  same shape as the activity-log export, so "Copy as JSON" doubles as macro export.

Sequencing: (1) activity-log entries gain stable capability/param fields (0.59.0 gave kind +
summary; params still need a pass), (2) a recorder capturing them, (3) the replay engine with the
dry-run sheet, (4) save/load alongside sessions. Only step 1 has partially landed; the rest is
deferred until after 1.0.0 unless asked.

## 19. Feature search: show where, do not act (v0.66.18 plan)

Goal: a top-right **Search** that answers "where is the thing that does X?" for a
JalView-class tool with many surfaces, without becoming a command runner. The
user decision (2026-10-01) is explicit: results navigate and highlight, they do
not execute.

Why navigation-only: Q2DV's actions have context (loaded data, species, selection)
and a search result cannot know it. A result that silently runs `remove track`
or a fetch would be the most dangerous surface in the app. Showing the location
teaches the UI at the same time, which is what a documentation search does.

Index (built locally, no network):
- guide steps, their labels and question text (the workflow spine),
- Options -> Data Sources categories, their names and hint lines,
- menu-bar items (File / View / Data / Export / Help),
- sidebar tabs and panel titles (Track Visibility, Rules, Variant effects, ...),
- curated aliases: "ddG", "offset", "PROSITE", "Ensembl", "pLDDT", "remove track".

Result shape: title, breadcrumb path (`Options -> Data Sources -> Variants`),
one-line description, and a **highlight target** (element id plus an optional
surface opener, e.g. switch category or tab first). Selecting a result opens the
surface, scrolls the target into view and pulses it briefly; it never clicks it.

Ranking: exact title match, then prefix, then substring, then alias/fuzzy.
Guide steps and Options categories get a small boost because they are the
documented paths.

UI: a Search button in the menu bar plus Ctrl/Cmd+K; a modal with the input and
a keyboard-navigable list (up/down/enter, Esc closes). No results state suggests
two or three likely aliases.

Testability: the index builder is pure and unit-tested. A test asserts every
guide step and every Options category appears, and that every highlight target
resolves to an element id in the markup, so the index cannot drift silently.

Non-goals for v1: running actions, searching remote docs, indexing user data
(track names, hit ids) - the last one can be a follow-up once navigation works.

## 20. Feature placement rules (v0.66.26)

A feature belongs on an existing surface; a new top-level entry point needs a
reason. This rule exists because the protein picker first landed inside the
Macro modal, where choosing a protein read as macro feature creep and a preset
run from an empty session failed its sequence-based steps.

Where things go:
- **Choosing or loading data** (accessions, example proteins, FASTA, PDB ids,
  structures) belongs in **Input Data**, the surface whose job is "what am I
  looking at".
- **Provider settings and paste boxes** (which service, databases, categories)
  belong in **Options -> Data Sources**.
- **Per-track behaviour** (visibility, colours, filters, per-row config)
  belongs in **Tracks / the quick controls popover**.
- **Workflow-level actions** (running a saved sequence of actions, retargeting
  a macro) belong in **Macro**; a macro may reference the session's protein but
  must not be the place where it is chosen.
- **Cross-cutting read-outs** (log, hypotheses, methods report) live on the
  menu bar or in the report.

Checklist before UI work on a new feature:
1. Name the existing surface it attaches to.
2. If a new top-level entry is proposed, write the justification in the feature
   card (why no existing surface fits).
3. Make the feature read the session state rather than duplicate it (a macro
   step must not become a second input system).
4. Tests assert the placement (element ids on the right surface).

## 21. AI hand-off pack (planning, 2026-10)

**Status (2026-10-04): deferred.** Priority is the GFP/TerC evidence features
(§22, §23, §24); the pack can be revisited once those surfaces exist, since it
is largely a presentation layer over their output.

**Decision.** Q2DV exports a self-contained "AI pack" that the user hands to a
model of their choosing; the app never calls one. The pack is assembled locally
from state that already exists and is copied or downloaded like any other
export. It carries an explicit recommendation to use a **local/private model**
for unpublished or confidential material, and states the hosted-tier caveats
(consumer plans may train on content; API/enterprise tiers differ; jurisdiction
and retention vary by provider).

**Contents** (all from existing functions):
- header/provenance: `APP_VERSION`, protein label, length, date, sequence hash;
- sequence + FASTA (`copySequenceFasta` / `downloadSequenceFasta`);
- `buildMethodsReport()` sections: intake, coverage, loaded evidence, template
  quality, rules, TM cross-check, read-out, citations;
- `hypothesisTSV()` candidate table;
- metrics TSV, topology consensus summary, interface summary;
- a per-track provenance digest from `trackMeta`, with **trust labels**:
  API-fetched / computed client-side / **user-entered (unverified)**;
- a caveat block ("suggestions to evaluate, not conclusions") and a short
  prompt scaffold (cite only provided data, no invented positions, state
  uncertainty).

**Format.** Markdown (human-readable, paste-ready) plus the existing save JSON
(machine-readable). The raw save alone is not sent: per-residue arrays are
token-heavy and invite arithmetic errors; tables and summaries carry the signal.

**Deliberately out of scope.** PDF ingestion, embeddings/RAG, hosted API calls
and in-app model execution. These break the single-file/no-backend/no-network
invariants and belong to dedicated tools (PaperQA2, NotebookLM, Zotero) or the
user's model of choice.

**Placement (§20).** Deliverable; action on the Integrate step. No new
top-level surface.

**Tests.** Assert the pack contains every section, the trust labels, the caveat
line and the citation list; feature card in `QA_CHECKLIST.md`.

## 22. Metal-site coordination analysis (planning, 2026-10)

**Decision.** Implement the coordination analysis **in-house from the parsed
coordinates**, not by porting or calling MetalHawk. MetalHawk is GPL-3.0 and
ships ~1 MB pickled models plus a PyMOL dependency; the properties needed here
are published deterministic methods (FindGeo geometry templates, CheckMyMetal
bond-valence parameters), and Q2DV already parses atom records and does Kabsch
superposition. MetalHawk's CSV becomes the **benchmark** for the local
implementation, never a dependency; no MetalHawk code or weights are used.

**Status (2026-10-04).** Computation core **done (0.66.29)**; surfaces **done
(0.66.30)**: the read-out rides the existing `_Cofactors` row rather than adding a
parallel surface - every metal site is paired to the cofactor number (1-9) that
row already shows, and the chemistry appears on the row-label tooltip and on the
per-residue hover (`#1 HEM A201 - FE, CN 5, SPY - square pyramidal (RMSD 0.04 A)
[macrocycle]`). Axial ligands are measured against the macrocycle plane, so a bare
metal reports none. Still open: a Metal sites table for the whole model, `COORD_`
track rows, rule sources, frame-aware ensemble coordination, and bond-valence /
nVECSUM - the last held back until its R0 parameters are verified against the
source tables, because a plausible-looking valence is worse than none.

**Data basis.** The same parser `extractCofactorNeighborhoods()` uses:
ATOM/HETATM groups (`chain`/`resSeq`/`iCode`/`resName`, per-atom
element/coords/B-factor), hydrogen-filtered, `MSE`/`SEC` excluded. A metal
centre is a metal-element atom inside any hetero group (`HEM`/`FE`, `ZN`, `MG`,
`CA`, `MN`, `CU`, `FES`, ...). Multi-metal clusters and bridging donors are v2.

**Computed per metal centre:**

| Output | Definition | Method / source |
|---|---|---|
| first shell / CN | donor atoms within a metal-donor cutoff (covalent radii + tolerance; default 2.8 A), C/H excluded, waters listed separately | Harding 2004; FindGeo |
| geometry + distortion | M-L distances normalised, Kabsch against ideal templates, permutation search for n<=6; best RMSD + runner-up gap | FindGeo |
| valence / oxidation state, completeness | bond-valence sum + nVECSUM with published R0/b parameters; acceptable/borderline/dubious bands | Brese & O'Keeffe 1991; CheckMyMetal |
| vacancy / occupancy / B-factor | preferred CN vs observed; metal vs donor B-factor mismatch; alternate-conformer flags | CheckMyMetal |
| heme axial ligands | porphyrin N4 + axial His/Cys/Met/Tyr; extends the existing `axialDist` cofactor class | existing machinery |

v1 template library: linear, trigonal planar, tetrahedral, square planar,
trigonal bipyramidal, square pyramidal, octahedral, trigonal prismatic.

**Entropy - three definitions, each labelled honestly:**
1. *geometry ambiguity* (single model): Shannon entropy over template weights
   derived from their RMSDs; high = distorted or between geometries. This is
   the deterministic analogue of MetalHawk's output entropy (its paper
   correlates that entropy with distortion/misclassification).
2. *donor diversity* (single model): Shannon entropy over donor atom/residue
   classes.
3. *ensemble coordination* (many models): per site, distribution of donor sets
   and geometry classes across attached models/seeds/frames -> entropy; reuses
   the ensemble machinery.

Not computed: thermodynamic dS, ligand exchange rates, density-map validation.
The tooltip states this; Q2DV is a read-out, not CheckMyMetal.

**Surfaces (§20).** Computed `COORD_<metal>_<id>` categorical tracks marking
coordinating residues; a **Metal sites** table in the Data modal (copy TSV,
methods report, AI pack); numeric rule sources `CN:`, `geometry_RMSD:`, `BVS:`,
`donor_entropy:`, `geometry_entropy:`; first-shell highlight in 3D. Provenance
`computed (client-side)`.

**Validation.** Compare in-app CN/geometry against the MetalHawk Colab CSV on
the same files (GPL output is data, not code) and against the published
FindGeo/CheckMyMetal examples. Fixtures: carbonic-anhydrase Zn (tetrahedral), a
5-coordinate heme, an Fe-S cluster. Tests + QA card.

**Citations (Crossref/Europe PMC-resolved 2026-10).**
- FindGeo: Andreini et al., Bioinformatics 2012. `10.1093/bioinformatics/bts246`
- CheckMyMetal: Zheng et al., Acta Cryst D 2017. `10.1107/S2059798317001061`;
  Gucwa et al., Protein Sci 2022. `10.1002/pro.4525`; protocol: Zheng et al.,
  Nat Protoc 2014. `10.1038/nprot.2013.172`
- Harding, Acta Cryst D 2004. `10.1107/S0907444904004081`
- Brese & O'Keeffe, Acta Cryst B 1991. `10.1107/S0108768190011041`
- MetalHawk (cross-reference only): Sgueglia et al., JCIM 2023.
  `10.1021/acs.jcim.3c00873`

## 23. New external evidence sources (planning, 2026-10)

All endpoints were CORS-probed 2026-10 from a browser Origin and answered with
`access-control-allow-origin: *`; re-verify at implementation per §3. Each
becomes a `SERVICE_REGISTRY` provider with provenance tagging.

| Source | Endpoint / notes | Category (§16) | Guide home | Why |
|---|---|---|---|---|
| AlphaFill | `https://alphafill.eu/v1/aff/{AF-ID}`; ligand/cofactor transplants with confidence; label as predicted | Evidence source | Structure | AF monomer models are usually apo; heme/metal state is invisible today |
| AlphaFold PAE | AlphaFold DB API `/api/prediction/{acc}` exposes `paeDocUrl`/`paeImageUrl`; also import AF3 JSON | Evidence source | Structure + Interfaces | domain boundaries and inter-chain/interface confidence - no PAE anywhere today |
| Europe PMC + UniProt refs | Europe PMC REST search; UniProt `references[]` from the already-fetched entry | Evidence source + Deliverable | Annotation | study-system literature seeds, PMIDs/DOIs/BibTeX; feeds §21 |
| STRING | `https://string-db.org/api/json/interaction_partners` (correct identifiers/species; check terms) | Evidence source | Annotation (function unknown) | fills the "no interaction evidence" gap |
| gnomAD / ClinVar | gnomAD GraphQL (preflight OK); ClinVar via EBI/NCBI | Evidence source | Variants | human variant context; low priority per §2 step 5 |

Citations: AlphaFill, Nat Methods 2022, `10.1038/s41592-022-01685-y`; STRING,
NAR 2023, `10.1093/nar/gkac1000`.

## 24. Client-side features and deliverables (planning, 2026-10)

| Feature | What / where | Category (§16) | Notes |
|---|---|---|---|
| Wet-lab constants | pI, MW, A280 extinction, GRAVY; sequence panel, methods report, AI pack | Step extension | **Done (0.66.28)** - Selection tab block beside FASTA Segment; pure JS, offline; nothing of these existed before |
| DNA construct export | codon back-translation with host codon tables, GC/forbidden-site flags; Construct designer | Deliverable | not primer design (still out of scope) |
| MSA export | FASTA/Stockholm/Clustal from the stored alignment rows; optional NJ tree later | Deliverable | addresses EVALUATION dim. 12; no alignment export today |
| Ensemble conformer clustering | cluster the existing pairwise RMSD matrix into states; label/colour models | Step extension | reuses 0.66.9 machinery |
| UniProt functional summary | function text, EC, GO terms, keywords, subcellular location from the fetched JSON | Interpretation | Annotation step + AI pack |
| Client-side geometry QC | disulfide SG-SG, first-shell clash for predicted models where PDBe validation cannot apply | Step extension | resolves the written validation blindspot without a service |
| 3D measurement | distance/angle between selected atoms/residues | Step extension | verifies coordination geometry by eye |
| Figure captions | generate legends from active tracks + citations | Deliverable | open-science packaging |

## 25. Candidates to test, and open decisions (planning, 2026-10)

**Test-first (CORS unverified).**
- **OPM** membrane orientation (model vs membrane planes) - relevant to the
  membrane-protein audience only.
- **PDB-REDO** improved deposited models - same attach pipeline.
- **AllMetal3D / Metal3D / PRIME** predict metal sites in apo models; no
  verified browser API - hand-off only if demand appears.

**Open decisions.**
- Q2DV ships **no LICENSE** today. The AI pack, the independent metal
  implementation and any future permissive release depend on that choice
  (MIT/Apache-2.0 for permissive; GPL-3.0 only if GPL-derived artifacts are
  ever embedded). Decide before optional work that incorporates third-party
  content.
- Any candidate promoted to a pipeline stage must go through §16 (likely a
  Step candidate needs a `WORKFLOW_STEPS` entry + regenerated `WORKFLOW.md`).

## 26. CHARMM-GUI / MD round trip (planning, 2026-10)

**Decision.** Treat molecular dynamics as a *stability and homogeneity filter*
over candidate constructs/states, with Q2DV as the comparison layer on both
ends of the trip; Q2DV neither builds nor runs simulations. The iteration loop:
construct/state candidates -> CHARMM-GUI build -> MD -> per-residue results and
representative frames imported into Q2DV -> compare against predictions ->
rank/fix candidates -> repeat. The loop targets specific questions (trimer
interface stability, heme retention, which termini/loops to trim), not a broad
search: data-free MD does not turn a plausible model into a high-resolution
structure.

**Honest limits (recorded so the loop is not over-read).**
- MD relaxes local geometry and tests physical plausibility under a force
  field; it does not converge on the true structure, and systematic force-field
  error can move a model away from truth.
- Heme/metal parameters are approximate (no polarization; oxidation/spin state
  and covalent c-type links must be set up deliberately).
- Crystallization/purification *conditions* are empirical (screens). Q2DV/MD can
  rank constructs and surface properties; they cannot predict precipitant, pH
  or additive conditions.
- High-resolution information still comes from experiment (cryo-EM/
  crystallography, SAXS, SEC-MALS, labeling); MD supports interpretation and
  candidate choice.
- A heme trimer in explicit solvent is expensive to simulate; iterate on a few
  targeted hypotheses, not brute-force.

**Q2DV -> the builder (hand-off).**
- export the chosen model/selection as PDB with original numbering/chain IDs;
- a simulation-prep block in the methods report: state (monomer/dimer/trimer,
  heme count), disulfide pairs, cofactor identity + axial ligands (covalent
  c-type vs non-covalent b-type), oxidation-state hint from BVS, and the
  residue-numbering offset;
- construct candidates from the Construct designer (trim disordered termini,
  drop low-pLDDT/unmodelled regions);
- orientation for membrane builds from the topology consensus + OPM
  (test-first, §25), preferring PPM in the builder because OPM PDBs lack TER
  records and are often misread.

**The builder -> Q2DV (results).**
- import per-residue MD analysis (RMSF, RMSD, SASA, H-bond/contact counts) as
  `_EXP` tracks; extend the experimental importer to named/multi-column CSV;
- attach an equilibrated representative frame (and optionally a few frames) as
  a model; the numbering-offset machinery re-places imported values;
- §22 coordination on frames: axial-ligand occupancy, geometry distribution,
  BVS plausibility, disulfide persistence;
- predicted-vs-MD `XC_` cross-checks: pLDDT vs MD RMSF, ensemble RMSF vs MD
  RMSF, conservation vs MD rigidity, interfaces/PAE vs contact frequency,
  topology vs TM persistence. Disagreement is the "look here" signal for
  experiment or model repair.

**What Q2DV will not do.** Build CHARMM inputs, parameterize ligands, parse
DCD/XTC trajectories in-browser, or automate the CHARMM-GUI REST API (JWT,
credentials, no-backend). Automation belongs in an external script.

**Work items.**
1. ~~PDB export (selection/model, original numbering).~~ **Done (0.66.27)** - Export menu
   -> *Structure file (PDB/CIF)*; filters the cached original text, so numbering,
   chain IDs, record types and HETATM survive; mmCIF gets a `#` header; a
   cache-only file is re-read from IndexedDB before filtering.
2. Simulation-prep report block.
3. ~~Multi-column MD CSV import (extends the experimental importer).~~ **Done
   (0.66.27)** - a header row makes each numeric column its own experimental
   row; new `MD / trajectory metric` kind for the interpretation text.
4. Predicted-vs-MD `XC_` cross-check (the existing TM cross-check pattern).
5. Frame-aware §22 coordination.
Tests: synthetic MD CSV fixture + the 1GFL fixtures; QA card.

## 27. Usability closures for a first-time researcher (planning, 2026-10)

Context: a 2026-10-07 audit against a professor persona ("show me how GFP works")
found that the mechanism is reachable only by the intended one-click path
(Input Data example -> GFP macro) and invisible to a newcomer who looks for a
search box or a plain-language summary. Five gaps were selected for closure, and
three (Get Started, the protein summary panel, and the header jump box) were
explicitly prioritised. This section is the backlog; each item ships on its own
day-based release per the release invariant, and each needs a `tests/run.js`
check plus a `QA_CHECKLIST.md` card because the stubbed harness cannot verify
rendered UI.

| Pri | Feature | Approach chosen | Category (§16) | Effort | Release |
|---|---|---|---|---|---|
| P1 | **Get Started** onboarding | welcome modal + coachmark tour, header **Try GFP**, empty-state card | Background (onboarding) | 1.5-2.5 d | 0.0.3 |
| P2 | **Protein summary panel** | fetch UniProt FUNCTION comment + keywords/GO; render beside tracks | Interpretation (annotation step + AI pack) | 0.5-1 d | 0.0.5 |
| P3 | **Header jump box** | one box filtering menu commands, loaded track names, guide steps; navigation only | Background (discoverability) | 1-1.5 d | 0.0.6 |
| P4 | **Network opt-in default ON** | default ON for `http(s)`, keep the gate for `file://`; passive indicator | Background (plumbing; policy change) | 0.5-1 d | 0.0.4 |
| P5 | **Accessibility pass** | focus-visible reveals tooltips; `prefers-reduced-motion` disables transitions | Background | 0.5-1 d | 0.0.8 |

### P1 - Get Started (0.0.3)

Shipped (0.0.3). Welcome panel (dismissible, remembered under its own
`q2dViewer_welcome_v1` key), coachmark tour, header Try GFP, and the three-action
empty state. The same release split the old "Reset Data" into **Clear input
data** (session only) and **Clear all data** (also preferences + welcome), so
onboarding state has a deliberate lifetime.

Revised (0.0.7). The direct **Try GFP** shortcuts were removed at the user's
request: no header button and no welcome-modal button. The loader is the
example-protein dropdown in **Input Data**, relabelled **Load example protein**
(`index.html:2216`), the empty state offers **Open Input Data** / **Attach
files**, and the tour's first step teaches File -> Input Data -> Load example
protein -> GFP. This restores §20's rule that choosing data belongs in Input
Data; the header/empty-state entries were onboarding-only exceptions.

Decision. A first-run **welcome modal** introduces the three moves (try an
example, paste Quick2D, attach files) and offers a short **coachmark tour** of the
sidebar tabs, reusing the existing `GUIDE_COACHMARKS` machinery
(`index.html:9882`). The example is also a persistent **Try GFP** button in the
header and a **three-button empty-state card** replacing the current "No data
loaded. Add input data under File..." text (`index.html:2288`). Try GFP reuses
`ACCESSION_PRESETS` GFP (`index.html:7408`) and the "GFP, API-Only" preset
(`index.html:7477`).

Placement (§20). The header button and empty-state card are new top-level
entries; the justification is onboarding - a newcomer has no loaded session, so
Input Data is unreachable until the first load. The tour navigates; it does not
run actions (§19 rule).

Dependencies and limits. Try GFP performs UniProt/BLAST/1GFL calls, so on a
fresh session it still trips the current per-action opt-in confirm until P4
lands; it must show an explicit "network needed" state under `file://` rather
than failing silently. The tour is dismissed per browser and must not re-open on
every load.

Non-goals. No product tour across every surface; no sample data bundle shipped
in-repo beyond the existing presets.

### P2 - Protein summary panel (0.0.5)

Shipped (0.0.5). A new `protein_summary` capability (`uniprotSummary` adapter,
`parseUniProtSummary`) reads the entry JSON; `useUniProtAccession` stores it and
`renderProteinSummary()` fills a **Protein Summary** section in the Selection
workspace, hidden until a summary loads. Persisted with the session and emitted
in the methods report. It does add a second request to the same entry (features
and summary are separate capabilities), but a summary failure is swallowed so it
never blocks the feature tracks.

Decision. Extend the UniProt fetch (`useUniProtAccession`, `index.html:5106`,
which today requests features + FASTA only) to also read the FUNCTION comment,
keywords, GO terms and subcellular location, and render a readable **Protein
summary** block. This is the existing §24 "UniProt functional summary" row
promoted from plan to work, and it is the direct answer to "how does this
protein work".

Placement (§16). Interpretation: belongs on the annotation step and in the
methods report / AI pack, not as a new pipeline stage.

Non-goals. No GO enrichment, no pathway diagrams; no summary for proteins loaded
without a UniProt accession (the panel stays hidden).

### P3 - Header jump box (0.0.6)

Shipped (0.0.6). `buildJumpIndex()` is the pure index; `jumpMatches()` ranks
exact > prefix > substring > description; `jumpNavigate()` opens the surface
(tab / menu dropdown / Options data category / Guide full view) and
`pulseJumpTarget()` flashes the target. Indexed: 5 sidebar tabs, 6 menu-bar
entries, all `WORKFLOW_STEPS`, all `DATA_CATEGORY_HINTS`, loaded track groups,
and homolog hit ids. Tests assert coverage and that every id target is in the
markup. No menu *items* individually yet (top-level menus are the targets), and
guide-step targets use `[data-step]` selectors, not ids.

Decision. Add a header input that searches a locally built index of menu
commands, sidebar tabs, guide step labels/questions, Options categories, and -
extending §19's v1 non-goal - the **loaded track names**. Results navigate and
highlight; they never execute, per the §19 decision. This is the lightweight
sibling of §19's planned Ctrl/Cmd+K palette; the palette can subsume it later.

Testability. The index builder stays pure and unit-tested; a test asserts every
menu item, guide step and Options category is present, and that each highlight
target resolves to a real element id.

Non-goals. No remote/doc search, no residue-pattern search (the existing
`seqSearchInput` at `index.html:2349` already covers that).

### P4 - Network opt-in default ON (0.0.4)

Shipped (0.0.4). `externalServicesDefault()` returns ON unless the page is on
`file://`; the saved preference overrides it when present, `Clear all data`
restores the platform default, and the Options -> Data Sources switch shows the
state and turns it off/on. The §3 invariant and `AGENTS.md` were rewritten in the
same change.

Decision. Default external services ON when the page is served over `http(s)`
(the deployed site), keep the confirm gate for `file://`, and show an always
visible network indicator with an off switch. This rewrites the §3 invariant,
which currently promises no outbound call absent opt-in; the section and
`AGENTS.md` must be updated in the same change, and the switch must persist.

Non-goals. No silent sending: the indicator and the per-action disclosure line
remain; the off switch is honoured everywhere.

### P5 - Accessibility pass (0.0.8)

Decision. Make the `ⓘ` `.tooltip-content` reachable by keyboard (`:focus-visible`
on the already-focusable info icons) and disable transitions under
`prefers-reduced-motion`. Optionally route toasts/status lines through a polite
`aria-live` region. Continues the 0.0.2 `role="tab"` / menu-role work and closes
the highest-value items from EVALUATION dimension 7.

Non-goals. A full WCAG 2.1 AA audit (contrast tokenisation, focus-order review,
automated axe pass) remains a separate future item.

### Sequencing

Shipped so far: P1 (0.0.3), P4 pulled ahead at the user's request (0.0.4),
P2 (0.0.5), P3 (0.0.6); P1 revised (0.0.7). Remaining: P5 (accessibility).
Tests and QA cards are written per release; versions are renumbered rather than
bundled if work overlaps.
