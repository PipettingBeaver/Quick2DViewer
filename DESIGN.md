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
3. Foldseek integration
4. Contradiction engine (Rules panel)
5. Client-side interface analysis
6. HMMER hmmscan
7. Ensemble variance graph; co-localization table; wet-lab constructs

## 10. Open items / to discuss

- Contradiction **presets** — need literature backing before finalizing.
- Co-localization UI shape (track + table) — confirm during build.
- Foldseek result semantics (TM-score color-coding) — confirm during build.
- MPI proxy — deferred; revisit if clipboard friction is high.
