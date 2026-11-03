# ChimeraX ecosystem and Q2DV interoperability

**Status:** working document, reviewed 2026-10-29.  
**Q2DV baseline:** app 0.71.14, ChimeraX host 0.6.34, ChimeraX 1.12.  
**Scope:** the ChimeraX features and add-ons that could exchange data with Q2DV.
This is a map and a decision log, not a promise to implement every item.
**Demo execution:** see `DEMO_ROADMAP.md` for the two-week GFP/LacY plan,
review gates and acceptance criteria. Post-demo storage/layout/offload work is
in `CHIMERAX_INTEGRATION_PLAN.md`.

## 1. Purpose

Q2DV is strongest at sequence-centric evidence: tracks, claims, relations,
features, residue ranges, provenance and recipes. ChimeraX is strongest at the
3D scene: models, maps, selections, measurements, fitting, editing and figure
production. The useful integration is therefore not "put all of ChimeraX inside
Q2DV". It is a two-way handoff between those two strengths.

The existing Q2DV host already has:

- a pinned local `file://` page with QWebChannel;
- bundle injection selected by the exact Q2DV sequence;
- `Run in ChimeraX` for allowlisted `select`, `color` and `label` commands;
- a ChimeraX file vault under `~/Q2DV_files/` for structures and homologs;
- `openFile` and per-structure **Open in ChimeraX** actions.

What is still missing is the return path: ChimeraX selection and add-on results
do not yet flow back into Q2DV, and Q2DV tracks are not yet exposed as ChimeraX
attributes. Most of this document is about that return path.

## 2. Rules for every integration

1. **One Q2DV core.** Browser and ChimeraX hosts keep the same bundle, tracks,
   claims, relations, features and recipes.
2. **Explicit action.** Q2DV must not silently run a model-building, fitting or
   destructive command. Commands cross the bridge only through a reviewed
   allowlist or a user-confirmed recipe.
3. **Predictions are not observations.** Imported add-on results enter Q2DV as
   `proposed` evidence with method, source, confidence and version. They never
   overwrite accepted experimental claims silently.
4. **Reference numbering is explicit.** Every exchange includes the target,
   model/chain and residue mapping. Raw PDB numbering is not assumed to equal
   Q2DV reference numbering.
5. **Files are the lowest common denominator.** The file vault is the safe
   fallback when an add-on has no stable Python API or JSON output.
6. **Version pin and verify.** An add-on is recorded with its tested ChimeraX
   version and release. Compatibility claims are evidence, not assumptions.
7. **Private data stays local.** Public Q2DV bundles contain public data only.
   Lab file names, structures and HHR files stay under the local file vault.

## 3. Integration ladder

| Level | Mechanism | Direction | Status |
|---|---|---|---|
| L0 | File vault (`~/Q2DV_files/`) | both | implemented |
| L1 | QWebChannel command bridge | Q2DV -> ChimeraX | implemented for select/color/label |
| L2 | Selection sync | both | next prototype |
| L3 | Attribute/value sync (`setattr`, `defattr`) | both | candidate |
| L4 | Structured result envelope (`q2dv.handoff/1`) | both | design |
| L5 | Add-on Python API or session integration | both | research |

L0 and L1 are deliberately boring. They work even when an add-on has no API.
L2-L4 are where Q2DV becomes a real bridge between sequence evidence and 3D
work, rather than a viewer that can only send a command.

## 4. Shared data contracts

### 4.1 Selection

A selection packet should carry a stable model/chain reference and a mapping,
not only a range of integers.

```json
{
  "schema": "q2dv.handoff/1",
  "kind": "selection",
  "target": "P42212",
  "source": "chimerax",
  "model": "#1",
  "chains": ["A"],
  "residues": [[65, 67]],
  "reference_mapping": { "method": "identity", "offset": 0 },
  "label": "Chromophore"
}
```

### 4.2 Add-on result

```json
{
  "schema": "q2dv.handoff/1",
  "kind": "result",
  "source": "PICKLUSTER 2.1",
  "method": "interface clustering",
  "target": "P42212",
  "model": "#1",
  "residues_a": [38, 39, 73],
  "residues_b": [142, 143, 144],
  "values": { "clusters": 2, "score": 0.81 },
  "claim_status": "proposed",
  "confidence": "moderate",
  "evidence_id": "COMPUTATIONAL:PICKLUSTER:2026-10-29",
  "artifacts": ["Q2DV_files/structures/1GFL.pdb"]
}
```

### 4.3 File vault

```text
~/Q2DV_files/
  structures/     PDB, CIF, AF3 JSON, exported models
  homologs/       .hhr, in-app homolog snapshots, Foldseek snapshots
  results/        optional add-on JSON/CSV envelopes
```

`Q2DV_FILES_DIR` moves the root. `openFile` is confined to this root; paths
outside it are refused. A future `results/` adapter should use the same rule.

### 4.4 Command envelope

Commands need a recipe ID, a target and a dry-run preview before execution:

```json
{
  "schema": "q2dv.command/1",
  "recipe": "interface.pickluster",
  "target": { "model": "#1", "chains": ["A", "B"] },
  "commands": ["select #1/A:38-73", "color #1/A:38-73 gold"],
  "risk": "low",
  "requires_confirmation": false
}
```

Only deterministic, non-destructive commands may be auto-run. `delete`,
`close`, `save` and model-editing commands require confirmation.

## 5. Ecosystem map

### 5.0 Current machine snapshot

Checked with `toolshed list` on 2026-10-29:

- ChimeraX 1.12.
- Installed and relevant: **CliX 0.2.7**, **Pellaeon 0.2.13**,
  **MCPServer 0.2.0**, **ShowSequences 1.0.3**, **MDcrds 2.19**.
- Not installed: ISOLDE, ChopChopMF, PICKLUSTER, MolCompose, AllMetal3D, MIC.
- Q2DV host 0.6.34 and Q2DV app 0.71.14 are the current baseline.

Installed does not mean integrated. The adapters below still need their own
version and public-data tests. Some Toolshed compatibility bounds are older than
ChimeraX 1.12 (for example ChopChopMF 1.5 lists ~=1.9, AllMetal3D 0.8 and MIC
0.2 list ~=1.1); test installation before promising an adapter.

### 5.1 Core ChimeraX surfaces

These are built in and do not depend on a separate add-on.

| Surface | What it gives Q2DV | Q2DV -> ChimeraX | ChimeraX -> Q2DV | Fit |
|---|---|---|---|---|
| Selection / atom specs | Stable 3D selection and named selections | residue ranges, chromophore/interface selection | selected residues, chain/model | P0 |
| `setattr` / `defattr` / Render by Attribute | Per-residue values in the 3D scene | Q2DV tracks as attributes | add-on scores as tracks | P0 |
| Sequence Viewer / MatchAlign / msa3d | Sequence/structure-linked alignments | homolog and conservation context | alignment position/selection | P1 |
| Contacts / Clashes / H-Bonds / Interfaces | 3D neighborhood and interface measurements | relation and interface residues | contact pairs, distances, BSA | P1 |
| Model Panel / open / save / sessions | Model identity and persistence | file vault paths, model IDs | open models, saved sessions | P1 |
| 2D Labels / Color Key / Scale Bar / FigureStyle | Publication figures | labels, colors, selection | style names, rendered image | P1 |
| CliX | Command discovery and history | recipe names and command text | executed command log | P1 |
| `remotecontrol` / MCP server | External command access | none by default | external agent commands | P2, guarded |

### 5.2 Structure analysis and validation

| Add-on | What it gives | Q2DV -> add-on | Add-on -> Q2DV | Priority |
|---|---|---|---|---|
| **Gemmi** (Python library) | Fast PDB/mmCIF parsing, symmetry, biological assembly reconstruction, contact search | model and assembly choice, selected chain/residue ranges | reconstructed assembly, contact pairs, alternate numbering | P1; solves the 1GFL ASU/biological-unit problem |
| **ProDy** | Normal-mode analysis and ensemble flexibility (not MD frames) | model, selected region, sequence | predicted flexibility/RMSF-like profiles | P1/P2; label as NMA, not MD |
| **ISOLDE** 1.12.1 | Interactive model building and real-space refinement; read-only validation commands | selected residues, variant/model context, Q2DV claims | validation results, refined model file, residue changes | P2; high value, high risk |
| **Modeller / Model Loops** | Comparative models and missing-loop repair | sequence, domain/feature ranges, template hits | new model in file vault, loop confidence | P2 |
| **Rotamers / swapaa** | Rotamer inspection and mutation | selected variant residue | rotamer score, model mutation | P2 |
| **MutationScores** | Deep mutational scanning display | variant table/residue selection | per-residue score track | P1 |
| **ChopChopMF** 1.5 | Sequence, PAE, interface, phospho/TM/glyco, Foldseek, JSON outputs | sequence, model, selected chains | JSON/CSV result envelopes; interface and domain candidates | P1; strong fit |
| **PICKLUSTER** 2.1 | Protein-interface clustering and scoring | interface relation, chain pairs | interface clusters and scores | P1; strong fit |
| **MolCompose** 0.1.3 | Interface analysis, buried area, contacts, confidence, figures, MCP | interface residues, chain pairs | interface/residue values, JSON/figures | P1; strong fit |
| **ProNA3D / CircosContacts** | Nucleic-acid interfaces / contact plots | protein-nucleic-acid relations | contact maps and interface ranges | P3 |
| **AllMetal3D** 0.8 | Predicted metal and water sites | metal-site claims, cofactor tracks, selected region | predicted sites and confidence | P1 metal adapter |
| **MIC** 0.2 | Classification of water/ion sites | ion/cofactor context | ion class, confidence, CSV | P1 metal adapter |
| **LigandRecognizer / KVFinder / Contacts** | Ligand/cavity/contact analysis | cavity and cofactor features | ligand/cavity scores and residue sets | P2 |
| **Privateer / QScore / DAQplugin / StrudelScore / Clipper / PhenixUI** | Carbohydrate validation, map/model validation, crystallography | validation claims and selected model | validation scores, fitted/refined models | P2-P3 |
| **XMAS** | Crosslink mass-spec analysis | crosslink relations and residue pairs | crosslink scores/pairs | P2 |

### 5.3 Simulation and high-throughput APIs

These are not first-demo features. They require a host-side worker, installed
software, compute resources, licensing review and a result envelope.

| API/library | What it gives | Q2DV -> it | It -> Q2DV | Decision |
|---|---|---|---|---|
| **gmxapi** | Python control of GROMACS setup/runs/trajectories | model, variant list, selected residues | energies, RMSF/RMSD, contacts, trajectories | P2; requires installed GROMACS and a job runner |
| **pyCHARMM** | Python control of CHARMM/PSF and membrane systems | model/membrane system, parameters | energies, per-residue values, trajectories | P2; CHARMM/force-field licensing and environment |
| **CHARMM-GUI REST API** | Remote system building with login/JWT and job status/download endpoints | model/selection, lipid/system request | built system archive, README, job metadata | P2; account, credentials, external compute, long jobs |
| **ProDy** | NMA/ANM/GNM modes and flexibility | model/selection | predicted flexibility, covariance, hinge candidates | P1/P2; no MD required |
| **Modeller Python API** | Comparative models and quality scores (DOPE/GA341) | sequence, template/alignment, domain ranges | model, scores, alignment | P2; academic licensing; use ChimeraX command first |
| **AlphaFold DB / ESMFold** | Precomputed or predicted structures and confidence | sequence/accession | PDB/CIF, pLDDT, PAE where available | already partly integrated; mutation claims need a real mutant model |

### 5.4 Sequence, figures and automation

| Add-on | What it gives | Q2DV -> add-on | Add-on -> Q2DV | Priority |
|---|---|---|---|---|
| **Sequence Viewer / ShowSequences** | Sequence and alignment inspection | sequence, homolog tracks, conservation | selected columns/residues | P1 |
| **MatchAlign / msa3d / Profile Grid** | Structure-guided alignments | model pairs and chains | alignment and mapping | P2 |
| **FigureStyle** | Reusable named figure styles | selected view and annotation context | style name, applied settings | P2 |
| **OpenCommands** | Run commands after opening a file | a Q2DV-recipe-generated command file | automatic scene setup | P2 |
| **CliX** 0.2.7 | Syntax highlighting, completion, history | recipe/command text | command history and errors | P1; installed |
| **Pellaeon** 0.2.13 | Natural-language command drafting with visible commands and confirmation | Q2DV recipes, claims and selected ranges as context | proposed commands, command log | P2; consent required |
| **MCP server** 0.2.0 / `mcp` command | External AI assistant control of ChimeraX | none by default | external tool calls | P2; guarded |

### 5.5 Lower direct fit

These are valuable ChimeraX add-ons but not first candidates for Q2DV data
exchange:

- **ArtiaX, copick, Geopickr, ETSAM** - cryo-ET annotation and particle lists.
  Q2DV can provide sequence context, but the data models do not overlap much.
- **MedicalImaging / DICOM** - medical imaging workflows.
- **SEQCROW** - quantum-chemistry structure editing.
- **CiliaBuilder, AmyloidModifier, CageBuilder, HKCage, GenomeTools** - specialized
  assembly builders.
- **MolecularDynamicsViewer / MDcrds / MDSmooth / LAMMPS / RMF** - high value for
  Q2DV's ensemble/EV tracks, but only after the selection and attribute bridge
  exists.

## 6. High-value interplays

### A. Two-way selection (P0)

**Q2DV -> ChimeraX:** send a residue range plus model/chain mapping, then
`select` the corresponding atoms. The current `select` command is the seed; the
payload needs to carry mapping and label context.

**ChimeraX -> Q2DV:** subscribe to the ChimeraX selection trigger, map the
selected residues back to Q2DV reference numbering, and highlight the matching
track range. This is the missing half of the current integration.

The minimum useful test case is the public GFP bundle: select S65-Y66-G67 in
Q2DV and see the chromophore selected in 1GFL; select residues in ChimeraX and
see the chromophore range highlighted in Q2DV.

### B. Interface analysis (P1)

Q2DV already has relations and interface residues. A relation can carry
`interface_status` and two residue sets. PICKLUSTER or MolCompose can validate
or extend that relation:

1. Q2DV sends the model and the relation's chain/residue sets.
2. The add-on clusters the interface and returns clusters, buried area, contacts
   and confidence.
3. Q2DV imports the result as a `proposed` relation annotation, linked to the
   original relation, not as a replacement.
4. Missing evidence stays missing; an add-on score is not converted into a
   statement such as "this is the biological interface".

### C. Metal/ion/cofactor sites (P1)

Q2DV metal claims and cofactor rows describe coordination. AllMetal3D and MIC
predict sites from structure. The exchange must keep prediction and experiment
separate:

- Q2DV -> add-on: selected structure, metal/cofactor context, candidate region.
- add-on -> Q2DV: predicted site, ion class, confidence, method, model version.
- Q2DV stores it as a proposed feature/claim with `source_type: computational`.
- A predicted metal site never inherits the status of an experimental metal
  claim.

### D. Model building, loops and variants (P2)

Q2DV can identify a missing domain, a variant, or a residue range worth
inspecting. Modeller, Model Loops, Rotamers and ISOLDE can act on that range.
The return file is a new PDB/CIF in the vault; Q2DV attaches it as a new model,
not as an overwrite of the original. ISOLDE's read-only validation commands are
a safer first step than interactive refinement.

### E. Sequence and conservation (P1)

Q2DV's homolog rows and conservation track can seed ChimeraX's Sequence Viewer
or MatchAlign. In return, ChimeraX can send selected alignment columns and the
associated chain/residue mapping. This is especially useful for GFP homologs,
domain boundaries and interface positions.

### F. Figures and provenance (P1)

Q2DV knows the labels, colors and evidence behind a view. ChimeraX's labels,
color keys, scale bars and FigureStyle know how to make the figure. A figure
recipe should save:

- the Q2DV selection and track state;
- the ChimeraX commands and FigureStyle name;
- the evidence and bundle version;
- the image path in the file vault.

### G. Automation and agents (P2)

CliX is the low-risk automation surface: deterministic command text, visible
history. Pellaeon and MCP are higher risk because a model proposes commands.
The rule is: preview, confirm, execute, log. Q2DV recipes should be the
structured input, not free-form prompts. An agent may propose a recipe, but it
must not silently run destructive commands.

## 7. Priority and decision log

### P0 - make the bridge bidirectional

- [x] File vault and open-file action.
- [x] Bundle selection by saved sequence.
- [ ] ChimeraX selection -> Q2DV ranges.
- [ ] Q2DV selection -> ChimeraX with model/chain mapping.
- [ ] `q2dv.handoff/1` envelope parser and validation.
- [ ] Add-on discovery: report installed bundles and versions in the host status.

### P1 - public-data analysis adapters

- [ ] PICKLUSTER/MolCompose interface-result adapter.
- [ ] AllMetal3D/MIC predicted-site adapter.
- [ ] Gemmi biological-assembly adapter (replace chain-specific workarounds).
- [ ] ProDy NMA/flexibility track adapter (label as predicted, not MD RMSF).
- [ ] PAE matrix import and pair-confidence track.
- [ ] Sequence Viewer/MatchAlign selection adapter.
- [ ] FigureStyle/2D-label figure recipe.
- [ ] Public GFP and LacY adapters both tested.

### P2 - editing, MD and agents

- [ ] ISOLDE read-only validation adapter.
- [ ] Modeller/Model Loops model-return adapter.
- [ ] MDcrds/MDSmooth RMSF/ensemble adapter.
- [ ] gmxapi or pyCHARMM worker adapter for a selected residue/metric set.
- [ ] CHARMM-GUI API job-submit/status/download adapter with explicit credentials.
- [ ] Pellaeon/MCP recipe preview and confirmation flow.

### Deferred

- Cryo-ET, medical imaging, quantum chemistry and specialized assembly builders
  until a concrete Q2DV use case appears.

### Decision log

- **2026-10-29:** Start with file/command handoff (L0/L1); selection sync is the
  next bridge feature. Do not make MCP or an LLM a production dependency.
- **2026-10-29:** Keep add-on results as `proposed` evidence with method,
  confidence and version. Never silently convert a prediction into an accepted
  Q2DV claim.
- **2026-10-29:** Use a single versioned envelope for add-on results instead of
  custom per-add-on formats in the Q2DV core.

## 8. Verification checklist for a candidate add-on

Before writing an adapter, record:

1. Bundle name and version tested against ChimeraX 1.12.
2. Public command and tool names.
3. Is there a documented JSON/CSV output or a documented Python API?
4. Does it expose stable residue/model identifiers, or only a screenshot?
5. Can it run headless with `chimerax --nogui --cmd`?
6. Does its external API have a sequence, size or residue limit that excludes the
   test protein? Record the cap and the fallback.
7. Does it require a local server, GPU, account or paid service?
8. Can it overwrite or delete models? If yes, it needs confirmation.
9. What does it produce that Q2DV can store without changing the schema?
10. What is the fallback when it is missing or fails?
11. Which public test system is used? Current defaults: GFP P42212 / 1GFL,
    LacY P02920 / 2CFQ, and the TerC public bundle.

## 9. Open questions

- Should ChimeraX selection changes update Q2DV immediately, or only when the
  user presses **Sync selection**?
- Should Q2DV write annotations as ChimeraX attributes (`q2dv_*`) as well as
  tracks? Attributes would make Render by Attribute and add-ons more useful.
- Which first adapter matters more: interface (PICKLUSTER/MolCompose) or
  metal/ion (AllMetal3D/MIC)?
- Should add-on results land in `~/Q2DV_files/results/` first and require an
  explicit import, or should the host import them automatically after a
  confirmed run?
- Which chain-mapping policy is canonical when a model has multiple copies or
  insertion codes?
- Do we want a Q2DV-specific ChimeraX bundle dependency, or optional runtime
  detection of installed add-ons?

## 10. External API resource review

Reviewed against the supplied roadmap document and the current Q2DV/ChimeraX
implementation. The document contains useful additions, but also repeats work
and makes a few claims that need correction.

### Already covered or partially covered

- **Modeller** is already in the add-on review and P2 model-building path; the
  new detail is the Python API and DOPE/GA341 scores.
- **AlphaFold DB / ESMFold** are already integrated in Q2DV, including the
  400-aa ESMFold limit. PAE is still not a Q2DV track.
- **UniProt REST** is already the source for Q2DV protein summary/features.
- **ChimeraX core / Qt panel** is the current host architecture, but only
  Q2DV -> ChimeraX selection is implemented; ChimeraX -> Q2DV is not.
- **CHARMM-GUI / MD round trip** is already sketched in `DESIGN.md` §26; the
  resource adds API-level details but not a new product direction.

### New gaps worth tracking

1. **Gemmi** for biological assembly reconstruction and contact maps. This is
   more correct than the current 1GFL chain-A workaround for every future PDB
   with an asymmetric unit that differs from its biological assembly.
2. **ProDy** for normal-mode flexibility. This is not a substitute for MD RMSF;
   label it as NMA/predicted flexibility.
3. **gmxapi, pyCHARMM and CHARMM-GUI REST API** as host/worker-side simulation
   adapters. They should never run in the browser or become Q2DV dependencies.
4. **PAE import** as a first-class pairwise matrix/track source, not just a
   pLDDT scalar.
5. **High-throughput mutation scans**: batch generation, mutant model
   provenance, structural comparison, queueing, retries and result storage are
   not designed yet.
6. **Result contract** for energy, RMSF, contact frequency, PAE, NMA
   flexibility and mutation delta values. The existing `q2dv.handoff/1` is the
   right envelope, but these track types need definitions.
7. **ProtVista** as a possible feature-display schema; it is not a new data
   source, because UniProt feature JSON already exists.
8. **Compute/licensing/security**: Modeller, CHARMM, GROMACS, CHARMM-GUI accounts,
   GPU/cluster access and private structures need explicit gates.

### Corrections or cautions

- The resource diagram labels Q2DV as a **Python/Qt engine**. Q2DV is a
  browser-first JavaScript core embedded in the ChimeraX Qt host; only the host
  is Python/Qt. Do not re-architect the core around this diagram.
- **AlphaFold DB / ESMFold do not directly evaluate structural shifts from
  arbitrary mutations.** A mutation scan needs mutant sequence generation,
  structure prediction or modelling, then structural comparison. AlphaFold DB
  is precomputed mainly for wild-type UniProt entries; ESMFold folds a supplied
  sequence and has the 400-aa cap.
- **Gemmi biological assemblies** are authoritative only when the assembly
  metadata is correct; record the assembly ID and source.
- **gmxapi / pyCHARMM** are environments, not small Python add-ons: installation,
  force fields, GPU/CPU, trajectory size and licensing must be handled by a
  host worker.
- **CHARMM-GUI API** requires authentication (JWT) and remote job handling;
  credentials must not be stored in a public bundle or browser profile.
- **ProDy** NMA flexibility is not experimental RMSF. Keep the provenance label
  visible.
- **ProtVista** is a visualization specification; Q2DV already parses UniProt
  feature JSON, so adding ProtVista is optional presentation work.

### Decision for the demo roadmap

Do not add Gemmi, ProDy, gmxapi, pyCHARMM or CHARMM-GUI API to the two-week demo.
The current demo pair already tests the needed bridge: two-way selection, file
vault, biological-unit handling and membrane topology. Add Gemmi and ProDy as
post-demo P1/P2 adapters; treat MD/CHARMM-GUI as a separate compute project.

## 11. Sources

Reviewed 2026-10-29. Toolshed versions can change; check the linked page before
relying on a command or version.

- ChimeraX User Guide, tools and commands:
  <https://www.cgl.ucsf.edu/chimerax/docs/user/>
- ChimeraX `mcp` command:
  <https://www.cgl.ucsf.edu/chimerax/docs/user/commands/mcp.html>
- ChimeraX `remotecontrol` command:
  <https://www.cgl.ucsf.edu/chimerax/docs/user/commands/remotecontrol.html>
- ChimeraX Help Viewer `cxcmd:` links:
  <https://www.cgl.ucsf.edu/chimerax/docs/user/tools/helpviewer.html>
- ChimeraX Toolshed:
  <https://cxtoolshed.rbvi.ucsf.edu/>
- ISOLDE:
  <https://cxtoolshed.rbvi.ucsf.edu/apps/chimeraxisolde>
- ChopChopMF:
  <https://cxtoolshed.rbvi.ucsf.edu/apps/chimeraxchopchopmf>
- PICKLUSTER:
  <https://cxtoolshed.rbvi.ucsf.edu/apps/chimeraxpickluster>
- MolCompose:
  <https://cxtoolshed.rbvi.ucsf.edu/apps/chimeraxmolcompose>
- AllMetal3D:
  <https://cxtoolshed.rbvi.ucsf.edu/apps/chimeraxallmetal3d>
- MIC:
  <https://cxtoolshed.rbvi.ucsf.edu/apps/chimeraxmic>
- CliX:
  <https://cxtoolshed.rbvi.ucsf.edu/apps/chimeraxclix>
- Pellaeon:
  <https://cxtoolshed.rbvi.ucsf.edu/apps/chimeraxpellaeon>
- ChimeraX MCPServer source:
  <https://github.com/RBVI/ChimeraX/tree/develop/src/bundles/mcp_server>
- Gemmi:
  <https://gemmi.readthedocs.io/>
- ProDy:
  <https://prody.csb.pitt.edu/>
- gmxapi:
  <https://manual.gromacs.org/current/gmxapi/>
- CHARMM-GUI API:
  <https://www.charmm-gui.org/?doc=api>
