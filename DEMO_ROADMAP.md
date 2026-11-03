# Two-week Q2DV demo roadmap

**Status:** working plan, started 2026-10-29.  
**Target:** in-person demo for at least two professors, approximately 2026-11-12.  
**Baseline:** Q2DV 0.71.14, ChimeraX host 0.6.34, ChimeraX 1.12.  
**Public reference proteins:** GFP P42212 and lactose permease LacY P02920.

This roadmap converts the ideas in `CHIMERAX_ECOSYSTEM.md` into a demo-sized
program. It is deliberately narrower than the ecosystem document: the demo must
be reliable offline, understandable in ten minutes, and defensible under
questions. Add-ons are optional evidence, not the foundation.

## 1. Demo goal

Show one Q2DV core with two hosts and two protein systems:

1. **GFP, public soluble standard.** Sequence, tracks, claims, relations and
   features; chromophore selection; 3D structure and file handoff.
2. **LacY, public membrane baseline.** Twelve transmembrane helices, topology
   agreement and disagreement, membrane orientation, and membrane selection.
3. **One bridge story.** Q2DV selection goes to ChimeraX; a ChimeraX selection
   or add-on result can come back to Q2DV with provenance.
4. **One honest limits slide.** What is measured, what is predicted, what is
   still a prototype, and what is not installed or not yet validated.

The demo is successful when both proteins can be driven from the browser build
and the ChimeraX host, without a network dependency, and the audience can see
where each piece of evidence came from.

## 2. Model systems

| Role | Protein | Why it is the right baseline | Public assets | Known signals |
|---|---|---|---|---|
| Soluble standard | **GFP P42212**, 238 aa | Small, well studied, public bundle exists, clear chromophore and dimer interface | `bundles/GFP/`, PDB 1GFL and 1EMA | S65-Y66-G67; 11-strand barrel; 1GFL dimer contact; A206K |
| Membrane standard | **LacY P02920**, 417 aa | Canonical MFS transporter, 12 TM, public structures, existing Q2DV topology fixtures | UniProt P02920; PDB 2CFQ and 1PV6; `tests/fixtures/iprscan-lacy-*` | 12 TM; Phobius 12 vs TMHMM 11 disagreement; PS00896/PS00897 motifs |
| Lab-only optional | TerC Q52356, 346 aa | Private 9-TM membrane project; not for the public demo | `TerC/bundle/` | Useful only after the public pair is stable |

### Why these two

- GFP and LacY stress different parts of Q2DV. GFP tests a small soluble bundle,
  a precise active site and a public demo path. LacY tests membrane topology,
  multiple topology sources, longer sequence, membrane orientation and a
  membrane-bound 3D view.
- Both are public and already present in the test/QA material. LacY is already
  the reference for topology disagreement (`Phobius 12`, `TMHMM 11`), which is
  more useful to show than a fake "all methods agree" example.
- TerC remains a private third system. Do not put it in a public bundle or use
  it as the only membrane story.

### API length edge case: LacY 417 aa vs ESMFold 400 aa

The Q2DV ESMFold adapter is capped at **400 aa** (`SERVICE_POLICY.esmfold.maxLength`).
LacY P02920 is **417 aa**, so a live ESMFold prediction cannot be the primary
LacY structure and must never be silently truncated to fit.

LacY is still the right membrane baseline:

- **PDB 2CFQ and 1PV6 are the primary structures** for the demo. They are
  experimental, public and exact-sequence entries.
- **AlphaFold DB P02920** is the full-length predicted fallback if a predicted
  model is wanted. Q2DV can fetch it by accession; keep a local copy for the
  offline demo.
- **ESMFold is optional.** If the demo shows a live prediction, use a membrane
  control shorter than 400 aa (for example bacteriorhodopsin P02945, 262 aa,
  7 TM) and label it as a different protein, not as LacY.
- Do **not** use a 400-aa LacY truncation for a membrane-architecture claim.
  Removing 17 residues can remove a terminus or distort the topology; a fragment
  is only valid for a clearly labelled domain hypothesis.
- The UI should preflight the length and say what to do instead, rather than
  sending the request and showing a raw "sequence too long" error.

**Workarounds to add**

1. Preflight in `predictStructureESMFold`: when the sequence is over the cap,
   stop before the API call and offer AlphaFold DB / PDB / local-file actions.
2. Prefer AlphaFold DB for full-length LacY; use the local `AF-P02920` file if
   the network is unavailable.
3. Keep a smaller membrane control (bacteriorhodopsin) for an ESMFold smoke test;
   do not present it as the LacY baseline.
4. Add a test asserting that a 417-aa sequence makes no ESMFold request and gets
   an actionable message.
5. Show the model source on every view: `2CFQ`, `1PV6`, `AlphaFold DB`, or
   `ESMFold (truncated control)`.

### LacY facts to verify during the build

- UniProt P02920, 417 aa, 12 TM.
- PDB 2CFQ: sugar-free lactose permease at neutral pH, one chain.
- PDB 1PV6: crystal structure of lactose permease, two chains.
- Curated 12 TM ranges and the Phobius/TMHMM disagreement must come from the
  same topology source the demo displays; do not hard-code a different range
  set in the deck.
- Signature motifs PS00896 and PS00897 are useful sequence evidence but are not
  a substitute for the topology track.

## 3. Demo scope: keep, defer, reject

### Must have for the demo

- GFP and LacY public bundles with claims, relations, features and evidence.
- Sequence-matched bundle loading in browser and ChimeraX host.
- Two-way selection between Q2DV and ChimeraX, with model/chain mapping.
- File vault: open saved PDB/CIF in ChimeraX; saved HHR/homolog snapshots visible.
- Membrane view for LacY: TM ranges, orientation, membrane plane/clipping, and
  a clear difference between topology prediction and 3D structure.
- Browser/host parity check and an offline fallback.
- A short, rehearsed demo script with expected outputs and recovery steps.

### Should have, only if it passes a gate

- One optional add-on demo: PICKLUSTER or MolCompose for the GFP/1GFL interface,
  or ChopChopMF for LacY TM/sequence analysis.
- A figure recipe using labels, color key and FigureStyle-style output.
- A selection/attribute export/import envelope for one add-on result.

### Defer until after the demo

- ISOLDE interactive fitting.
- Modeller/large model building.
- AllMetal3D/MIC metal-site prediction.
- XMAS crosslinks.
- MD trajectory and RMSF exchange.
- Pellaeon/MCP agent workflows as a live demo dependency.

### Reject for this demo

- Any workflow that needs a cloud account, API key or live network during the
  talk.
- Any automatic destructive edit (`delete`, `close`, `save`, model overwrite).
- Any claim that a predicted site or score is an experimental observation.
- Any use of TerC as the only membrane system or any private lab image.

## 4. Workstreams

### W1. Data and bundles

- Freeze the GFP bundle schema and counts.
- Build a public LacY bundle at `bundles/LacY/` with the same `q2dv.bundle/1`
  schema:
  - claims: MFS/LacY family, 12 TM, proton-coupled lactose symport,
    alternating-access context, ligand/sugar site;
  - relations: LacY dimer from 1PV6 (crystal contact), substrate/ligand context;
  - features: 12 TM ranges, N/C termini, PS00896/PS00897, 2CFQ/1PV6 structure
    references, topology confidence;
  - evidence: UniProt, PDBs, public papers, Q2DV topology analysis.
- Add counts, evidence links and a manifest hash check.
- Add `bundles/LacY/README.md` with the same "public data only" statement as GFP.

**Review:** validate all evidence references, feature lengths, residue ranges and
manifest hashes. The bundle must be refused against a GFP sequence and accepted
against LacY.

### W2. Bridge and selection

- Add ChimeraX -> Q2DV selection handling with model/chain mapping.
- Extend the Q2DV -> ChimeraX payload from a bare `select` command to a
  selection envelope.
- Keep the existing allowlist for automatic commands; add only reviewed,
  deterministic commands needed by the demo.
- Show the selected residue range in both UIs and log the mapping method.

**Review:** GFP 65-67 selects the chromophore in 1GFL and returns the same range.
LacY TM3 (or a curated TM range) selects in 2CFQ and returns the same reference
range. A mismatched chain must fail visibly, not select the wrong residue.

### W3. Membrane workflow

- Define a membrane recipe with:
  - input: model, chain, topology source, orientation;
  - view: TM helices highlighted, membrane plane/clipping, labels;
  - evidence: topology source and confidence;
  - output: commands, figure, provenance.
- Use core ChimeraX commands first. Pellaeon's `membrane_view` is optional and
  must not be the only path.
- Test both a topology-only view and a 2CFQ/1PV6 structure view.
- Show the Phobius 12 / TMHMM 11 disagreement as a feature of the evidence, not
  as an error to hide.

**Review:** LacY shows 12 TM; the predicted topology and the experimental
structure are visibly linked; the orientation is stated; the two-source
disagreement is visible in Q2DV.

### W4. Optional add-on gate

Pick at most one add-on after installation and public-data testing:

| Candidate | Demo use | Gate |
|---|---|---|
| **PICKLUSTER 2.1** | GFP/1GFL interface clustering | installs on 1.12; public 1GFL result; JSON/result import |
| **MolCompose 0.1.3** | interface, buried area, contacts, figure | installs; no missing-metric crash; JSON/result import |
| **ChopChopMF 1.5** | LacY TM/sequence analysis | installs on 1.12 despite `~=1.9` metadata; JSON output |

If none passes, the demo uses core ChimeraX analysis and the add-on slide is a
roadmap, not a live demo. Do not install multiple heavy add-ons during the final
week.

### W5. Packaging and fallback

- Freeze app/host versions at demo time.
- Produce a demo folder with both public bundles, the host wheel, a startup
  note, and a local HTTP server command for the browser build.
- Record a short fallback video and keep screenshots of every expected view.
- Test on the actual demo laptop, projector resolution and offline mode.
- Keep `~/Q2DV_files/` clean and clearly named for the demo.

## 5. W1 progress

**2026-10-29:** The public `bundles/LacY/` example now exists:

- 5 claims, 3 relations, 3 features, 7 evidence records;
- UniProt P02920, 417 aa, 12 TM ranges;
- PDB 1PV6 and 2CFQ references;
- 1PV6 contact explicitly marked `crystal_contact`, author biological unit
  monomeric;
- host candidate `bundles/LacY/` added;
- automated checks: `1928 passed, 0 failed`.

Host auto-selection was verified separately: `bundle check='loaded P02920'` with
three candidates. Remaining W1 work: evidence/document review, browser visual
check, and the ESMFold preflight gate.

**W2 progress:** Q2DV -> ChimeraX automatic selection is implemented in app
0.71.14 / host 0.6.34: the host matches the active model chain by sequence and
maps Q2DV reference positions to its residue numbers. The GFP bundle now banks
1GFL/1EMA and opens 1GFL when no model is present. The reverse direction,
ChimeraX -> Q2DV, is still pending.

## 5. Two-week schedule

Day 1 is 2026-10-29; the target demo is approximately 2026-11-12. Adjust if the
actual date differs. Weekends are buffer, not planned work.

### Week 1 - make the two proteins boring and reliable

| Day | Work | Deliverable | Gate |
|---|---|---|---|
| 1 | Freeze baseline; review ecosystem doc; confirm demo date, audience and laptop | this roadmap + `CHIMERAX_ECOSYSTEM.md` links | G0 scope signoff |
| 2 | Build public LacY bundle; validate GFP and LacY bundles | `bundles/LacY/`, bundle validation report | G1 data gate |
| 3 | Selection return path; model/chain mapping; log/provenance | two-way selection on GFP 65-67 | G2 bridge gate |
| 4 | File vault and open-file flow; host status; browser/host parity | saved 1GFL and 2CFQ open in ChimeraX | G2 bridge gate |
| 5 | GFP end-to-end rehearsal; fix mapping and wording; record baseline | GFP demo script + screenshots | G3 GFP gate |

### Week 2 - membrane, one option, and rehearsal

| Day | Work | Deliverable | Gate |
|---|---|---|---|
| 6 | LacY topology and 12-TM view; two-source disagreement | LacY browser walkthrough | G3 membrane gate |
| 7 | LacY 3D membrane recipe; 2CFQ/1PV6; orientation; clipping | membrane demo and commands | G3 membrane gate |
| 8 | Optional add-on gate; install one candidate in isolation; test public data | one add-on or explicit "not this time" | G4 optional gate |
| 9 | Full cross-host QA; file vault cleanup; fallback video; second machine | QA report + fallback package | G4 release gate |
| 10 | Rehearsal with a critical reviewer; cut anything fragile; freeze | final demo script and backup | G5 demo freeze |

If a gate fails, cut scope, not reliability. The minimum demo is still strong:
two public bundles, two hosts, selection, file vault, and a membrane view built
from core ChimeraX commands.

## 6. Review and test plan

### 6.1 Automated

- `npm test`: application invariants and bundle behavior.
- `npm run csp` after any app-script edit; release invariant must hold.
- Bundle validator: manifest hashes, counts, evidence refs, feature lengths,
  residue bounds, target/sequence.
- Host smoke test: page loaded, bridge ping, bundle selected by sequence,
  file save/open, no local HTTP port.

### 6.2 Integration

- Browser: GFP and LacY load from a local server; no host bridge required.
- ChimeraX: saved GFP session selects GFP; saved LacY session selects LacY;
  mismatched sequence does not inject.
- Selection: both directions; test a multi-chain model and a chain-specific
  range.
- File vault: PDB/CIF saved and opened; HHR/homolog snapshot appears; path
  outside the vault is refused.
- Membrane: 12 TM count, orientation, membrane plane/clipping, topology source
  labels, and the Phobius/TMHMM disagreement.
- API caps: LacY 417 aa against ESMFold 400 aa must fail closed with an
  actionable route to PDB/AlphaFold, not a silent truncation or raw HTTP error.
- Host persistence: localStorage survives a restart; no hidden network port.

### 6.3 Human review

- **Data review:** a second reader checks every claim, DOI, PDB reference and
  residue range. Reject any claim that cannot be traced to a public source.
- **Visual review:** check the exact demo laptop and projector; text size,
  contrast, 3D clipping, and whether the membrane plane is interpretable.
- **Adversarial review:** ask "where did this come from?", "is this predicted
  or measured?", "what happens with the wrong sequence?", "what is not
  installed?", and "what would break if the network is off?"
- **Timed rehearsal:** 10 minutes maximum, then 10 minutes of questions. Stop
  and fix anything that requires an explanation longer than one sentence.

### 6.4 Demo acceptance criteria

- Both bundles load in both hosts.
- GFP chromophore selection works in both directions.
- LacY 12-TM/membrane view is understandable without a second slide.
- The file vault is visible and openable from ChimeraX.
- No demo step depends on a live external API.
- Fallback video and screenshots exist.
- Every displayed number has a visible source or is labelled as a prediction.
- The presenter can state what is implemented, what is optional and what is
  deferred.

## 7. Demo script (draft)

| Time | Segment | Expected evidence |
|---|---|---|
| 0:00 | Open browser Q2DV with GFP | bundle ID, 6 claims, 4 relations, 7 features |
| 0:02 | Select S65-Y66-G67 | chromophore feature and 1GFL context |
| 0:04 | Open Q2DV host with the same saved session | GFP bundle auto-selected; no TerC, no port |
| 0:05 | Send selection to ChimeraX; select in ChimeraX and return | matching residue range in both |
| 0:06 | Open the saved 1GFL file in ChimeraX | file vault path and 3D model |
| 0:07 | Switch to LacY | 12 TM, topology source disagreement, membrane view |
| 0:09 | Show provenance and one optional add-on result | source, method, confidence, status |
| 0:10 | Limits and roadmap | what is public, what is deferred, what is next |

## 8. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Selection mapping is wrong for LacY or multi-chain models | medium | test identity, offset, chain, insertion code; fail visibly |
| Add-on does not install on ChimeraX 1.12 | high | optional gate; core commands are the fallback |
| LacY exceeds the ESMFold 400-aa cap | certain | use 2CFQ/1PV6 or AlphaFold DB; preflight ESMFold; never truncate silently |
| Membrane view is visually unclear | medium | test on projector; use simple plane/clipping and labels |
| Network/API failure during demo | medium | offline bundles and local server; no live APIs |
| LacY topology sources disagree and confuse the audience | high | present it as evidence quality, not a bug |
| Demo reveals an unverified UI path | medium | final rehearsal on actual laptop; cut fragile steps |
| Private TerC data appears in the public demo | low | public bundles only; separate private checklist |
| Time slips | high | must-have list is fixed; optional add-on is expendable |

## 9. Decisions to confirm

- Exact demo date, room/laptop and projector resolution.
- Whether the professors care more about membrane biology, structural
  validation, or the software/data-provenance story.
- Whether to install one add-on now or keep the demo entirely core.
- Whether the membrane view should show a simple plane/clipping or a lipid
  bilayer context.
- Whether TerC should be mentioned only as the private extension, never shown.

## 10. Links

- `CHIMERAX_INTEGRATION_PLAN.md` - post-demo storage, layout, offload and preset plan.

- `CHIMERAX_ECOSYSTEM.md` - add-on map, contracts and priorities.
- `CHIMERAX_PLUGIN_PLAN.md` - host architecture and phased features.
- `CHIMERAX_STARTUP.md` - startup, file vault and host paths.
- `RECIPE_MODEL.md` - recipe definition and host-neutral protocols.
- `bundles/GFP/README.md` - current public standard.
- QA rows for LacY: `QA_CHECKLIST.md` around the topology, InterProScan and
  reference-systems sections.
- ChimeraX user guide: <https://www.cgl.ucsf.edu/chimerax/docs/user/>
- ChimeraX Toolshed: <https://cxtoolshed.rbvi.ucsf.edu/>
