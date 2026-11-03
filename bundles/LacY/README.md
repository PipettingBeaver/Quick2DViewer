# LacY public example bundle

A public-data Q2DV bundle for *Escherichia coli* lactose permease
(UniProt P02920, 417 aa, 12 TM). It is the membrane baseline for the two-week
demo roadmap.

## Contents

- 5 claims: 12-TM MFS/LacY family, proton-coupled lactose symport,
  alternating access, PS00896/PS00897 signatures, and the 1PV6/2CFQ structures.
- 3 relations: 1PV6 crystal contact (not a biological dimer), lactose transport,
  and the proton requirement.
- 3 features: UniProt 12-TM topology, LacY/RafB signatures, and the 1PV6
  crystal-contact residues.
- 7 evidence records: UniProt, PDB 1PV6/2CFQ, three papers, and PROSITE.

The 1PV6 asymmetric unit has two chains, but its author biological unit is
monomeric. The contact track is labelled `crystal_contact`, not a functional
dimer.

## Length note

LacY is 417 aa. ESMFold's public API is capped at 400 aa, so ESMFold must not be
used for full-length LacY. Use 2CFQ/1PV6 or the full-length AlphaFold DB model.
Do not silently truncate LacY for membrane-architecture claims.

## Local structures

The bundle includes `structures/2CFQ.pdb` and `structures/1PV6.pdb`. The host
banks both in `~/Q2DV_files/structures/` and opens 2CFQ chain A automatically
when no atomic model is already open. 1PV6 remains available for the crystal
contact view.

## Load

In Q2DV: **Data -> Evidence bundle -> Port URL**, enter:

```text
bundles/LacY/manifest.json
```

The bundle should load into a LacY session (417 aa). In the Q2DV ChimeraX host,
the bundle is selected automatically when the current sequence is LacY. It is
refused for a different sequence.

## Provenance

- PDB 1PV6: https://www.rcsb.org/structure/1PV6
- PDB 2CFQ: https://www.rcsb.org/structure/2CFQ
- UniProt P02920: https://www.uniprot.org/uniprotkb/P02920/entry
- Abramson et al. 2003: https://doi.org/10.1126/science.1088196
- Mirza et al. 2006: https://doi.org/10.1038/sj.emboj.7601028
- Guan et al. 2007: https://doi.org/10.1073/pnas.0707688104

This is a teaching/experimentation bundle, not a curated clinical or
laboratory claim set.
