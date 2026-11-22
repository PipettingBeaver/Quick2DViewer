# ChimeraX add-on audit for Q2DV

**Status:** working audit, 2026-11-15. Baseline Q2DV 0.72.15, ChimeraX 1.12,
host 0.6.35. Installed inventory is available live through
`q2dv_host_capabilities` (185 bundles at the time of writing).

**Purpose:** choose a small set of add-ons that complement Q2DV's
classification layer, are realistic to demo, and can be described as structured
capability manifests rather than hardcoded commands.

## Selection rules

1. Prefer data the agent can verify: a file, CSV, JSON or a stable Python API.
2. Prefer commands whose effect is visible in the 3D scene and can be replayed.
3. Record the bundle version and a public-data test; never promise an adapter
   that has not been run.
4. Keep destructive or model-building operations behind human approval.
5. Do not depend on an add-on for core Q2DV viewing; every adapter degrades to
   `capability_missing`.
6. MaveDB and Mutation Scores are already the first end-to-end path; extend that
   before adding a new data source.

## Candidate table

| Add-on | Installed | Data in | Data out | Q2DV fit | Risk | Priority |
|---|---|---|---|---|---|---|
| **Mutation Scores** | yes (1.0) | MaveDB id, mutation CSV, structure | heatmap, scatter, histogram, structure colors, score statistics | direct: DMS evidence and vignettes | low; MaveDB format gaps | **P0 for demo** |
| **KVFinder** | yes (1.8.2) | structure, chain/selection | cavity/pocket list, scores, cavity files | high: pockets and ligand sites for drug-development framing | low; needs output files | **P0 demo / P1 manifest** |
| **Contacts / Clashes / Hbonds** | yes (1.0.1 / 2.4 / 2.5.3) | atom spec, radius | contact/clash/H-bond pairs, counts | high: interfaces, cofactor sites, residue evidence | low; log parsing unless Python API | **P0 demo / P1 manifest** |
| **ShowSequences / SeqView** | yes (1.0.3 / 2.18) | model, chain, selection | sequence/alignment viewer state | high: selection and sequence context | low | P1 |
| **AlphaFold / ESMFold / Boltz / OpenFold** | yes | sequence, templates | predicted structure, confidence | medium: structure predictions for dark regions | network, runtime, licensing per model | P1 |
| **DockPrep / Modeller** | yes (1.2.2 / 1.5.23) | structure, sequence | prepared model, loops, scores | medium: missing residues and mutation modeling | model-building; human approval | P2 |
| **MatchMaker / MatchAlign** | yes (2.4.1 / 1.2) | two structures/sequences | superposition, alignment | medium: compare 1GFL/1EMA or homologs | low | P2 |
| **RenderByAttr / Color Key / FigureStyle** | yes (1.8.2 / 1.5.8) | attributes, scores | colored scene, figure | high: vignette figures | low | P1 |
| **Crosslinks / CrystalContacts / UnitCell** | yes | model, maps | crosslink/crystal contacts | niche: oligomer and crystal context | low | P3 |
| **MolCompose** | **no** (0.1.3 on Toolshed) | interface residues, chain pairs | interface values, JSON/figures, MCP | very high | install + license + version bound | P1 after install |
| **PICKLUSTER** | **no** (2.1) | interface relation, chain pairs | clusters, scores | very high | install + version bound | P1 after install |
| **ChopChopMF** | **no** (1.5) | sequence, model, chains | sequence/PAE/interface/domain JSON | high | old ChimeraX bound; install test | P2 |
| **AllMetal3D / MIC** | **no** (0.8 / 0.2) | metal-site context | predicted sites, ion classes | high for cofactors | install + old bounds | P2 |
| **ISOLDE** | **no** (1.12.1) | selected residues, maps | refined model, validation | high but heavy | model-building; human approval | P3 |
| **ProDy / Gemmi** | libraries, not bundles | model, sequence | flexibility, assembly, contacts | high for analysis depth | Python API, no UI | P2 |

The full installed list is discoverable at runtime; it changes with Toolshed
installs, so this table is a curated subset, not a fixed allowlist.

## Focus for tomorrow's demo

1. **Mutation Scores + MaveDB** (already integrated): show the host-side
   combined-score track, top cluster 81-85, and the chromophore cluster 63-67;
   optionally open the same scan in Mutation Scores for the heatmap.
2. **KVFinder**: show a cavity/pocket ranking on 1GFL, then export the cavity
   file and cite it in a vignette. This is the strongest drug-development angle
   that is already installed.
3. **Contacts / Clashes / Hbonds**: the chromophore and barrel interior are a
   concrete interface/contact example; use the reviewed command path and cite
   the resulting residue set.
4. **ShowSequences / SeqView**: keep the sequence and 3D selection aligned while
   showing a cluster. Low effort, visual, and reinforces the SSOT mapping.
5. **Figure-ready output**: RenderByAttr or Color Key for a vignette figure.

AlphaFold/ESMFold/Boltz are reserved for a structure-prediction beat, not the
main demo: network and runtime make them a poor first impression.

## Manifest plan

Manifests are data (`q2dv.capability/1`), discovered at runtime from shipped
`mcp/adapters/*.json` and local `~/Q2DV_files/adapters/*.json`. The first
manifest layer is **command-only**:

```json
{
  "schema": "q2dv.capability/1",
  "id": "chimerax.mutationscores",
  "kind": "addon",
  "bundle": "ChimeraX-MutationScores",
  "version": "1.0",
  "actions": [
    {
      "id": "chimerax.mutationscores.open_mavedb",
      "mode": "command",
      "command": "open {id} from mavedb",
      "args": {"id": {"type": "string", "pattern": "^[0-9]+$"}},
      "effects": ["opens a MaveDB mutation set", "changes the Mutation Scores panel"],
      "review": true
    }
  ]
}
```

The agent calls `q2dv_addon` with the manifest id, action and arguments. The
page validates the action, renders the command and sends it through the reviewed
`runAgentCommand` path; human approval (or the `commands` grant/auto-approve)
still applies. Command-only manifests are enough for visualization and
file-producing tools; structured **query** adapters (returning a
`q2dv.handoff/1`) are the next layer for Contacts/KVFinder and for add-ons with
stable Python APIs.

### First manifests

- `chimerax.mutationscores`: `open <id> from mavedb`, `mutationscores heatmap`,
  `mutationscores color`.
- `chimerax.contacts`: `contacts <atoms> radius <radius>` (base command; the
  `ChimeraX-Contacts` bundle is a chain-contact-map tool, not this command).
- `chimerax.kvfinder`: `kvfinder <atoms> gridSpacing <spacing> volumeCutoff <cutoff>`
  (command-only) plus `chimerax.kvfinder.summary` (query returning volume/area/
  depth per cavity).
- Structured `chimerax.contacts.query_structured` returns residue pairs and
  minimum distances as `q2dv.handoff/1`.
- Next: project the structured contacts/cavities into Q2DV tracks or vignette
  evidence, and add a PyMOL-style handoff for other add-ons with stable APIs.

### Structured query criteria

An add-on graduates from command-only to a query manifest when it has a stable
Python object or a machine-readable file. The adapter must return
`q2dv.handoff/1` with source version, target model/chain/sequence hash, mapping,
values and confidence. Log scraping is a last resort and must be labelled as
such.

## Roadmap

| Phase | Work | Estimate |
|---|---|---|
| A | Command-only manifest loader + `q2dv_addon` for Mutation Scores and Contacts | 1-2 sessions |
| B | KVFinder manifest with cavity file output | 1 session |
| C | Structured Contacts query (residue pairs) | 1-2 sessions |
| D | Visual figure workflow (RenderByAttr/ColorKey + vignette) | 1 session |
| E | Install-test MolCompose and PICKLUSTER; write manifests only after public-data tests | 2-3 sessions |
| F | Metal/ion and model-building adapters (AllMetal3D, MIC, ISOLDE) behind review | future |

Estimates are judgement ranges; the calibration data is thin (n=1).

## Open questions

- Do we want the command-only executor to be a separate tool (`q2dv_addon`) or
  an extension of `q2dv_command` with a manifest id?
- Should a manifest be allowed to ship a Python adapter module, or only commands
  and files?
- Which demo beat is primary: DMS sensitivity, cavities/pockets, or interfaces?
- Do we install MolCompose/PICKLUSTER before the demo, or keep the demo on
  installed add-ons?
