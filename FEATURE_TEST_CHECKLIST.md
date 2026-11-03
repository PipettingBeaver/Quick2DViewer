# Feature test checklist

Use this as the rolling manual test log for new ChimeraX/Q2DV features. Check a
box only after running the step on the current host build. Record the version,
date, result and a screenshot/log path when something fails.

Format for new features:

```text
## Feature name - version
- [ ] Normal: ...
- [ ] Edge: ...
- [ ] Edge: ...
- [ ] Result: pass / fail / deferred - notes
```

## LacY local structures - bundle 0.1.1

**Normal use**
- [ ] `bundles/LacY/structures/2CFQ.pdb` and `1PV6.pdb` exist.
- [ ] Load LacY; host banks both in `~/Q2DV_files/structures/`.
- [ ] With no model open, host opens 2CFQ chain A.
- [ ] 1PV6 remains available for the crystal-contact view.

**Edge cases**
- [ ] A non-LacY sequence rejects the bundle.
- [ ] Missing local structures do not block claims/features.
- [ ] 2CFQ auto-open does not duplicate an already-open model.

## First host analysis: ChimeraX RSA/SASA - app 0.71.12 / host 0.6.33

**Normal use**
- [ ] GFP + 1GFL; Analyze -> ChimeraX analysis -> Compute RSA.
- [ ] `CX_RSA` appears with ChimeraX provenance.
- [ ] Status reports model, method and coverage.
- [ ] The row can be graphed and selected like other RSA rows.
- [ ] Browser RSA still exists independently.

**Edge cases**
- [ ] No model gives an actionable error.
- [ ] 1GFL coverage is below 100% because it has 230 resolved residues.
- [ ] No sequence refuses the action.
- [ ] Browser-only mode reports that ChimeraX is not the host.
- [ ] Re-run replaces CX_RSA.
- [ ] A SASA failure leaves browser tracks unchanged.

## Host capability flags + offload skeleton - app 0.71.11 / host 0.6.32

**Normal use**
- [ ] Browser build works with no `Q2DVHost` capability object.
- [ ] Host capabilities advertise command, selection, file, workspace and offload fields.
- [ ] Disabled analyses fall back to the browser path.
- [ ] Enabled skeleton reaches the host without changing claims/tracks.

**Edge cases**
- [ ] Unknown offload is ignored safely.
- [ ] Old host without capabilities still works.
- [ ] Failed offload does not leave partial data.

## Layout presets + dark contrast - app 0.71.10 / host 0.6.30

**Normal use**
- [ ] Browser: Demo, Analysis, Compact, Wide all apply immediately.
- [ ] ChimeraX: the same presets apply at 1640x740.
- [ ] Compact hides the legend; another preset shows it again.
- [ ] Manual sidebar-section or legend changes switch Layout to Custom.
- [ ] Preset/Custom choice survives a reload/restart.
- [ ] Dark empty state, sidebar, cards and modals have readable contrast.
- [ ] Changelog headings/body, host badge and version pill are readable in dark mode.
- [ ] Saved slots 1-5 use dark fills/accents; overlays/rings still distinguish slots.

**Edge cases**
- [ ] Invalid/missing saved layout falls back safely.
- [ ] Compact can restore the legend without a hidden control.
- [ ] Resize to 1280x720; controls and text remain readable.
- [ ] Theme switch does not reset the layout.
- [ ] Browser has no ChimeraX dependency.

## Host file origin + workspace persistence - app 0.71.9 / host 0.6.29

**Normal use**
- [ ] Q2DV opens from `file:///.../q2dv_full/html/index.html?host=chimerax`.
- [ ] No `q2dvfull`/`QWebEngineUrlScheme::registerScheme` warning appears.
- [ ] GFP loads, 1GFL chain A appears, and the bundle is selected.
- [ ] Close/reopen Q2DV; sequence, tracks, selection and theme return.
- [ ] Window size is remembered after resize and reopen.
- [ ] `workspace/current.json` exists and contains no raw PDB/CIF text.

**Edge cases**
- [ ] Delete the WebEngine profile; reopen; workspace still restores.
- [ ] Corrupt `current.json`; the newest valid backup loads.
- [ ] Delete `current.json` and all backups; browser localStorage fallback still opens.
- [ ] Save a workspace with an unsupported schema; it is rejected.
- [ ] External API fetch from the file origin returns HTTP 200.
- [ ] Browser build at `http://` still has no host or workspace dependency.

## GFP public bundle + banking - bundle 0.1.0 / host 0.6.28

**Normal use**
- [ ] Load `bundles/GFP/manifest.json`; 6 claims, 4 relations, 7 features.
- [ ] 1GFL and 1EMA are banked in `~/Q2DV_files/structures/`.
- [ ] 1GFL opens as a single chain A cylinder.
- [ ] Select S65-Y66-G67; 1GFL highlights the chromophore.
- [ ] Select `SS_NETSURFP2`; all 122 positions map to 1GFL chain A.

**Edge cases**
- [ ] A non-GFP sequence rejects the GFP bundle.
- [ ] 1GFL already open does not duplicate on restart.
- [ ] 1EMA opens manually as the single-chain S65T reference.
- [ ] A missing 1GFL file does not prevent claims/features from loading.

## LacY membrane baseline - bundle 0.1.1 / host 0.6.33

**Normal use**
- [ ] Load `bundles/LacY/manifest.json`; 5 claims, 3 relations, 3 features.
- [ ] UniProt topology shows 12 TM ranges.
- [ ] Phobius 12 / TMHMM 11 disagreement is visible.
- [ ] 2CFQ or 1PV6 opens and the membrane selection maps correctly.

**Edge cases**
- [ ] GFP sequence rejects the LacY bundle.
- [ ] 1PV6 is labelled a crystal contact, not a biological dimer.
- [ ] Full-length LacY does not call ESMFold (417 aa > 400 aa cap).
- [ ] ESMFold preflight/fallback message is actionable.

## Compact Selection Workspace + automatic 3D selection - app 0.71.6+

**Normal use**
- [ ] At 1640x740, Scope/Scale/Selected Range are compact and legible.
- [ ] Selecting a range highlights matching residues in ChimeraX.
- [ ] Selecting `SS_NETSURFP2` maps substitutions/short gaps.
- [ ] Clearing the selection is visible and does not leave stale highlighting.

**Edge cases**
- [ ] Shifted/missing initiator Met still maps correctly.
- [ ] Mutated/truncated chain mapping does not select the wrong residue.
- [ ] No open model shows `no atomic model`, not a wrong chain.
- [ ] Browser build remains unchanged.

## Light/dark theme + ChimeraX auto-match - app 0.71.7+

**Normal use**
- [ ] Browser toggle switches Dark -> Light -> Dark.
- [ ] Browser reload remembers the chosen theme.
- [ ] Dark ChimeraX starts Q2DV dark; light starts Q2DV light.
- [ ] Track colours remain distinguishable in both themes.

**Edge cases**
- [ ] `?theme=dark`/`?theme=light` overrides saved preference.
- [ ] No host theme falls back to browser preference/system.
- [ ] Theme switch creates no CSP error.
- [ ] Modals, inputs, sidebar and selection panel remain readable.

## Host file vault + structure opening - host 0.6.21+

**Normal use**
- [ ] Fetched/attached PDB/CIF appears in `~/Q2DV_files/structures/`.
- [ ] Imported `.hhr` and in-app homolog snapshots appear in `homologs/`.
- [ ] Options -> Local Structure Cache shows the ChimeraX path.
- [ ] The per-structure **ChimeraX** button opens it.

**Edge cases**
- [ ] A path outside the vault is refused.
- [ ] A failed save logs but does not block the current Q2DV view.
- [ ] Browser build writes no host files.
- [ ] `Q2DV_FILES_DIR` relocates all subfolders.

## Future feature template

## Feature name - version

**Normal use**
- [ ] ...

**Edge cases**
- [ ] ...

**Result**
- [ ] pass
- [ ] fail - notes:
