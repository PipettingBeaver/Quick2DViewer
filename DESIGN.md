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
- Nothing leaves the device unless the user **opts in** to external services.
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

**Opt-in gate:** a File-menu switch ("Q2DV may make API calls on your behalf")
gates every outbound request, with a per-action disclosure line. Seamless when on.

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
  Clustal / MMseqs2 / PDBsum are redundant or superseded.

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
3. **Ensemble Structural Variance Analyzer** — column-wise coordinate variance
   across models. Output: a **graph** (RMSF-style line plot). Scope: **all
   loaded models or a user-picked subset**.
4. **Downstream Script Compiler** — ChimeraX/PyMOL/VMD (done) + wet-lab
   **truncated FASTA constructs** (strip disordered termini). Primer design
   scoped out for now.

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
7. Ensemble variance graph; co-localization table; wet-lab constructs

## 10. Open items / to discuss
- **Tracks vs Track Control redundancy (noted).** The right sidebar's *Tracks* tab and the
  grid's *Track Control* popover overlap (visibility + view-as). Not necessarily a problem,
  but consider consolidating later (e.g. Track Control popover → "open full manager").
- **UI polish — left sidebar / track rows (noted).** The `tctl-chevron state-on`
  on the first row of a track type reads as visually messy; the track rows overall
  should be cleaner and more reactive (hover/active affordances). Revisit the
  chevron placement/styling + row hover states after the service integrations.
- Contradiction **presets** — need literature backing before finalizing.
- Co-localization UI shape (track + table) — confirm during build.
- Foldseek result semantics (TM-score color-coding) — confirm during build.
- MPI proxy — deferred; revisit if clipboard friction is high.

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
