# Quick2DViewer — Protein Characterization Workflow (reference)

> **Generated file — do not edit by hand.** Regenerate with
> `node tools/build-workflow-doc.js`. The Evaluation Guide in the app is
> driven by the same definition, so the steps, rationale and citations below
> are exactly what the guide shows.

This is the literature-backed pipeline Q2DV is built around: sequence and
identity first, then orthogonal prediction layers, then curated and
evolutionary evidence, then structure, and finally integration. Each step is
followed by *why* it matters and *how* to read its output, so a result is
never interpreted in isolation.

## Intake questions

The guide asks these to re-rank the steps for the protein at hand. Each step
then asks its own short questions (below) that pick the *specific* action and
defaults to offer. Everything is advisory: any step can be marked done,
skipped or re-run at any time, and all tools stay reachable from the menus.

- **Is it membrane-associated or secreted?** — Yes / No / Not sure
- **Is a 3D structure available or planned?** — Yes / Not yet / Not sure
- **Are homologs / an HHpred MSA in hand?** — Yes / No / Not sure
- **Are you evaluating sequence variants?** — Yes / No / Not sure
- **Is the function / domain architecture unknown?** — Yes / No / Not sure

## Steps

### 1. Load sequence

**Purpose.** Paste Quick2D output or attach a FASTA/sequence.

**Why it matters.** Every track, selection and export is indexed to this residue numbering, so the sequence boundaries and the protein identity must be settled before anything else is compared.

**How to read it.**
- Check the length and the first/last residues match your construct.
- Confirm the protein label/accession so the UniProt step fetches the right entry.

**In-app action.** `Load data…`

**Guided questions** (the answers choose the concrete action offered).

- How is the sequence coming in? — Quick2D output / FASTA / paste / UniProt accession

**Promoted when.** Always — it is the prerequisite for every other step.

**Citations.**
- UniProt Consortium, Nucleic Acids Res 2023 — <https://doi.org/10.1093/nar/gkac1052>

### 2. SS / disorder / TM predictions

**Purpose.** Quick2D secondary structure, disorder, transmembrane, coiled-coil and signal-peptide tracks.

**Why it matters.** Predicted SS and disorder are the fastest orthogonal read on domain architecture, and they anchor every later cross-check (a variant in a helix, a domain inside a disordered linker).

**How to read it.**
- Helix/sheet runs suggest a folded core; long disorder runs suggest flexible regions.
- TM segments should line up with the topology consensus later — a conflict is a flag to inspect, not an error.

**In-app action.** `Load Quick2D output…`

**Guided questions** (the answers choose the concrete action offered).

- Are the Quick2D predictions ready to paste? — Yes / Not yet

**Promoted when.** Promoted when the protein is flagged membrane-associated or secreted.

**Citations.**
- Buchan & Jones, Nucleic Acids Res 2019 (PSIPRED workbench) — <https://doi.org/10.1093/nar/gkz297>
- Klausen et al., Proteins 2019 (NetSurfP-2.0) — <https://doi.org/10.1002/prot.25674>
- Mészáros, Erdős & Dosztányi, Nucleic Acids Res 2018 (IUPred2A) — <https://doi.org/10.1093/nar/gky384>
- Krogh et al., J Mol Biol 2001 (TMHMM) — <https://doi.org/10.1006/jmbi.2000.4315>
- Teufel et al., Nat Biotechnol 2022 (SignalP 6.0) — <https://doi.org/10.1038/s41587-021-01156-3>
- Ruff & Pappu, J Mol Biol 2021 (AlphaFold and IDPs) — <https://doi.org/10.1016/j.jmb.2021.167208>

### 3. Curated annotation & domains

**Purpose.** UniProt domains/PTMs/variants, plus HMMER/Pfam domain architecture.

**Why it matters.** Curated entries and profile searches place the sequence in a known family and mark the residues that already have experimental support — the baseline every prediction is judged against.

**How to read it.**
- Prefer curated domain boundaries where they agree with the profile hits; investigate where they disagree.
- PTM/site annotations mark residues where a variant is more likely to matter.

**In-app action.** `Fetch UniProt` · `Scan HMMER/Pfam`

**Guided questions** (the answers choose the concrete action offered).

- Do you already have the accession or family? — Yes — fetch it / No — search for it / Only Pfam domains

**Promoted when.** Promoted when the function or domain architecture is unknown or unclear.

**Citations.**
- Mistry et al., Nucleic Acids Res 2021 (Pfam) — <https://doi.org/10.1093/nar/gkaa913>
- Finn, Clements & Eddy, Nucleic Acids Res 2011 (HMMER web server) — <https://doi.org/10.1093/nar/gkr367>

### 4. Homologs & conservation

**Purpose.** Run HHpred (toolkit.tuebingen.mpg.de) and attach the .hhr; attach a variant FASTA for per-residue conservation.

**Why it matters.** Homologs supply the evolutionary evidence: match quality, template coverage, and the per-column conservation that separates tolerated from constrained positions.

**How to read it.**
- Probability > 90% with coverage near 100% makes a template a solid model.
- Conservation is only as good as the alignment depth — check how many sequences went in.

**In-app action.** `Load .hhr / variant FASTA…`

**Guided questions** (the answers choose the concrete action offered).

- Is the HHpred .hhr ready? — Yes, ready to attach / Not yet

**Promoted when.** Always — homology is the main cross-check on the sequence-based layers.

**Citations.**
- Söding, Biegert & Lupas, Nucleic Acids Res 2005 (HHpred) — <https://doi.org/10.1093/nar/gki408>
- Remmert et al., Nat Methods 2012 (HHblits) — <https://doi.org/10.1038/nmeth.1818>
- Ashkenazy et al., Nucleic Acids Res 2016 (ConSurf 2016) — <https://doi.org/10.1093/nar/gkw408>
- Capra & Singh, Bioinformatics 2007 (functionally important residues) — <https://doi.org/10.1093/bioinformatics/btm270>

### 5. Structural model

**Purpose.** Attach AlphaFold/PDB/CIF (or predict with ESMFold) for pLDDT, RSA, cofactors and the 3D view.

**Why it matters.** A model converts sequence annotations into spatial context: buried vs exposed, domain packing, and which residues form interfaces.

**How to read it.**
- pLDDT > 70 is confident, 50–70 tentative, < 50 unreliable — read it per region, not per protein.
- RSA says whether a residue is buried; a variant in a buried position is usually more disruptive.

**In-app action.** `Attach / predict structure…`

**Guided questions** (the answers choose the concrete action offered).

- Where should the model come from? — AlphaFold DB / PDB / CIF file / Predict (ESMFold)

**Promoted when.** Promoted when a structure is available or planned, or the answer is unsure.

**Citations.**
- Jumper et al., Nature 2021 (AlphaFold2) — <https://doi.org/10.1038/s41586-021-03819-2>
- Lin et al., Science 2023 (ESMFold) — <https://doi.org/10.1126/science.ade2574>
- Kabsch & Sander, Biopolymers 1983 (DSSP) — <https://doi.org/10.1002/bip.360221211>

### 6. Structural homology

**Purpose.** Search Foldseek for remote relatives that sequence search misses.

**Why it matters.** Structure is more conserved than sequence: Foldseek finds the remote homologs that decide a fold assignment when BLAST/HMMER come up empty.

**How to read it.**
- High probability + low E-value with good query coverage is a credible structural relative.
- Use it to sanity-check the family assignment, not to overrule curated data.

**In-app action.** `Run Foldseek`

**Guided questions** (the answers choose the concrete action offered).

- Which Foldseek database? — afdb50 / pdb100 / swissprot / bfvd

**Promoted when.** Promoted when the function or domain architecture is unknown.

**Citations.**
- van Kempen et al., Nat Biotechnol 2023 (Foldseek) — <https://doi.org/10.1038/s41587-023-01773-0>

### 7. Membrane topology

**Purpose.** Paste TMHMM/Phobius/DeepTMHMM output for a consensus topology bar.

**Why it matters.** Orientation decides which loops face the cytosol: it changes which residues are accessible to ligands, antibodies and variants.

**How to read it.**
- Build a consensus across predictors; a segment that flips orientation between tools is not settled.
- Compare the consensus with the Quick2D TM call to judge how robust the TM prediction is.

**In-app action.** `Paste topology…`

**Guided questions** (the answers choose the concrete action offered).

- Which predictor output do you have? — TMHMM / Phobius / DeepTMHMM / None yet

**Promoted when.** Promoted when the protein is flagged membrane-associated or secreted.

**Citations.**
- Krogh et al., J Mol Biol 2001 (TMHMM) — <https://doi.org/10.1006/jmbi.2000.4315>

### 8. Integrate & export

**Purpose.** Combine evidence with Rules, check interfaces, then export figures and commands.

**Why it matters.** The last step is where evidence becomes a claim: co-localization and contradiction rules keep the reasoning explicit, inspectable and reproducible.

**How to read it.**
- A rule hit is a hypothesis to inspect, not a conclusion — click through its matches.
- Export the figure plus table so the track state behind the claim is archived.

**In-app action.** `Open Analysis Rules…` · `Interfaces…`

**Guided questions** (the answers choose the concrete action offered).

- What are you closing on? — Variant triage / Binding interface / Construct design / Figure / report

**Promoted when.** Always — it is where the collected evidence is combined.

**Citations.**
- Lichtarge, Bourne & Cohen, J Mol Biol 1996 (evolutionary trace) — <https://doi.org/10.1006/jmbi.1996.0167>
- Valdar & Thornton, Proteins 2001 (interface conservation) — <https://doi.org/10.1002/1097-0134(20010101)42:1<108::aid-prot110>3.0.co;2-o>

---

## Citation status

Every DOI above was resolved against the Crossref API (last verified
2026-09); the reference list that previously lived in `DESIGN.md` had six
entries that resolved to unrelated papers and has been corrected to match
this document.
