# GFP public example bundle

A public-data Q2DV bundle for *Aequorea victoria* green fluorescent protein
(UniProt P42212, 238 aa). It demonstrates claims, relations, and features
without any TerC or laboratory data.

## Contents

- 6 claims: fold, chromophore, dimerization, EGFP, superfolder GFP, reporter use.
- 4 relations: GFP-GFP crystal contact / dimer, O2 requirement, EGFP variant,
  superfolder variant.
- 7 features: chromophore, 11 beta-strands, 1GFL dimer interface, A206K,
  EGFP substitutions, PSIPRED secondary structure, SPOTD disorder.
- 10 evidence records: UniProt, PDB 1GFL/1EMA, six papers, Q2DV Quick2D.

The dimer interface is a 4.5 A heavy-atom contact map from 1GFL chains A/B.
It is marked `crystal_contact`, not a solution measurement. A206K is included
as the standard monomerizing mutation (Zacharias et al. 2002).

## Local structures

The public bundle includes `structures/1GFL.pdb` and `structures/1EMA.pdb`.
The Q2DV ChimeraX host copies them to `~/Q2DV_files/structures/`; it opens
1GFL chain A automatically when no atomic model is already open. 1GFL has two
chains in the asymmetric unit even though its author biological unit is
monomeric; the host shows chain A only. 1EMA is a single-chain S65T reference
and can be opened manually.

## Load

In Q2DV: **Data -> Evidence bundle -> Port URL**, enter:

```text
bundles/GFP/manifest.json
```

The bundle should load into a GFP session (238 aa). In the Q2DV ChimeraX host,
the same bundle is selected automatically when the Q2DV sequence becomes GFP;
no reopen is required. It is refused if a different sequence is loaded.

## Provenance

- PDB 1GFL: https://www.rcsb.org/structure/1GFL
- PDB 1EMA: https://www.rcsb.org/structure/1EMA
- UniProt P42212: https://www.uniprot.org/uniprotkb/P42212/entry
- Q2DV Quick2D predictions: `GFP/Q2D_GFP.txt`

This is a teaching/experimentation bundle, not a curated clinical or
laboratory claim set.
