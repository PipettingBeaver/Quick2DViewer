# ChimeraX integration plan: storage, layout, offload, presets

**Status:** Phase A implemented 2026-10-29; remaining phases planned.  
**Baseline:** Q2DV 0.71.13, ChimeraX host 0.6.33, ChimeraX 1.12.  
**Related:** `DEMO_ROADMAP.md`, `CHIMERAX_ECOSYSTEM.md`,
`CHIMERAX_PLUGIN_PLAN.md`, `RECIPE_MODEL.md`.

This plan covers the integration work that is **not** part of the two-week
GFP/LacY demo hardening. The order is deliberate: storage first, then window
layout, then moving more work into the ChimeraX host, then presets.

## 1. Current state

What already works:

- Q2DV app and ChimeraX host share one bundle/track/claim/features model.
- The host selects the bundle by the current sequence (TerC, GFP, or LacY).
- Q2DV -> ChimeraX selection is automatic and uses sequence-aware mapping.
- Structures and homologs are banked in `~/Q2DV_files/`.
- GFP now banks 1GFL/1EMA and shows 1GFL chain A as the biological unit.
- The host injects the initial ChimeraX light/dark theme.
- The browser build still uses localStorage + IndexedDB and remains standalone.

What is still weak:

- **Persistence depends on WebEngine localStorage.** A profile change, cache
  reset, reinstall, or a profile path mismatch looks like “all my data reset”.
- The host window is a fixed `size_hint=(1100, 900)` and has no layout preset.
- The selection sidebar was tuned for one window size; the rest of the app is
  not.
- Most analysis still runs in JavaScript, even when ChimeraX already has the
  model and a mature analysis API.
- There are rule/data/workflow presets, but no saved **workspace/layout**
  presets.

## 2. Storage redesign (do this first)

### Decision

In the ChimeraX host, the **host filesystem workspace is canonical**, not
localStorage. The browser continues to use localStorage/IndexedDB as its
standalone fallback.

This removes the dependency on a WebEngine profile and gives Q2DV a recoverable
file the user can inspect, back up and move.

### Workspace layout

```text
~/Q2DV_files/
  workspace/
    current.json          canonical workspace (atomic replace)
    backups/
      current-2026-10-29T16-05-00.json
    settings.json         host window size, theme, layout preset, last bundle
  structures/             banked PDB/CIF/AF3
  homologs/               HHR and homolog snapshots
  results/                add-on/result envelopes (future)
```

`Q2DV_FILES_DIR` moves the entire root.

### Workspace schema

Start with a versioned envelope; the payload can reuse the existing
`gatherPersistableState()` shape.

```json
{
  "schema": "q2dv.workspace/1",
  "saved_at": "2026-10-29T16:05:00Z",
  "app_version": "0.71.13",
  "host_version": "0.6.33",
  "sequence_hash": "sha256:...",
  "bundle_id": "gfp-p42212-public",
  "layout": {
    "preset": "demo",
    "sidebar_width": 380,
    "collapsed_sections": []
  },
  "state": {
    "rawInput": "...",
    "parsedTracks": {},
    "currentProteinLabel": "GFP",
    "structureFiles": [],
    "structureReferences": {},
    "homologHitsInfo": {},
    "selection": {},
    "preferences": {}
  },
  "files": {
    "structures": ["structures/1GFL.pdb"],
    "homologs": []
  }
}
```

The JSON must **not** embed raw PDB/CIF text. Files are referenced by name/hash
and live in the vault.

### Lifecycle

1. App starts. Host reads `workspace/current.json`.
2. If valid, host sends it to Q2DV through the bridge **before** the normal save
   restore path. Q2DV applies it like a portable save.
3. If invalid/corrupt, try the newest backup; never silently overwrite a valid
   file.
4. Auto-save on a 750-1000 ms debounce after state changes; explicit **Save
   workspace** is available.
5. Save on tool close and on page `pagehide` (best effort).
6. Writes are atomic: temp file, fsync, replace; keep the last 5 backups.
7. Clearing input data updates the workspace intentionally; clearing all data
   also removes the workspace after confirmation.
8. Browser mode ignores the host workspace and keeps its current local storage
   behaviour.

### Bridge additions

```text
loadWorkspace() -> JSON or null
saveWorkspace(json) -> { ok, path, saved_at }
getHostSettings() -> JSON
saveHostSettings(json) -> { ok }
listFiles(kind) -> [...]
```

`saveWorkspace` validates schema/version/size and refuses paths outside the
vault. The existing `saveFile`/`openFile` remain.

### Why this should fix the “reset”

The current save only exists inside the WebEngine profile. If the profile path
changes, Chromium clears site data, or the user switches between an installed and
a source-tree host, localStorage appears empty. The workspace file is
independent of the profile and travels with the vault.

### Storage tests

- Save -> restart -> identical sequence, selection, tracks, layout and theme.
- Kill ChimeraX without a clean close -> recover last debounce/backup.
- Corrupt `current.json` -> load newest valid backup.
- Delete the WebEngine profile -> workspace still restores.
- Move `Q2DV_FILES_DIR` -> all files resolve from the new root.
- Browser build still works with no host.
- Workspace has no raw PDB/CIF payload.

## 3. Window size and layout presets

### Measurements

Current demo target: Q2DV panel about **1640 x 740** physical pixels, with the
Selection sidebar about **575 x 580**. Treat the sidebar as roughly **35% of
the window width**; the compact host CSS currently targets that proportion.

### Host window

- Default `size_hint` for the demo: `(1640, 740)`.
- Remember the last window geometry in `workspace/settings.json` and restore it
  on the next open.
- Do not force a size when the user has already resized the tool.
- Add a **Reset window** action.
- At narrow sizes, collapse the sidebar to tabs or a drawer instead of crushing
  the grid.

### Layout presets

| Preset | Target | Sidebar | Behaviour |
|---|---|---|---|
| **Demo** | 1640 x 740 | ~35% | Selection open; compact typography; low-priority details collapsed |
| **Analysis** | 1920 x 1080 | ~28% | Standard type; Claims/Features/Tracks expanded |
| **Focus** | 1280 x 800 | ~24% | Minimal chrome; advanced sections collapsed; larger grid |
| **Wide** | 2560+ | ~22% | Wide grid; two-column sidebar details where useful |

Layout presets control only presentation:

- sidebar width/visibility;
- section collapse state;
- compact/standard typography;
- optional legend/status visibility;
- not the data, bundle or claims.

Persist `layout.preset` and per-section overrides in the workspace. A preset
must be reversible and must not hide a control needed to recover it.

### Screen tests

- 1280 x 720, 1640 x 740, 1920 x 1080 and 2560 x 1440.
- Selection text remains legible; range controls do not wrap into a broken row.
- The 575-wide sidebar remains usable at the default demo scale.
- A resized/undocked ChimeraX tool does not overflow or clip.
- Browser layout is unchanged unless the user chooses a preset.

## 4. Offloading functions to ChimeraX

### Principle

Offload only when **ChimeraX is the host**. The browser must keep its current
standalone capability. Each function gets a capability flag and a browser
fallback.

### Matrix

| Function | Current owner | Target | Fallback | Phase |
|---|---|---|---|---|
| 3D display | Browser Py3Dmol (standalone) | ChimeraX | browser Py3Dmol | done in host |
| 3D selection | Host command bridge | ChimeraX | browser grid selection | done for Q2DV -> CX |
| Save/open structure files | Host file vault | ChimeraX + vault | browser download/upload | done |
| Workspace persistence | localStorage | host workspace | localStorage | **A** |
| Structure parsing for 3D | JS | ChimeraX model API | JS parser | B |
| RSA / cofactor / interface quick metrics | JS | ChimeraX when available | JS | B |
| Validation / map fitting | JS/PDB API | ChimeraX/add-on | current JS | C |
| Model building / loops / ISOLDE | none | ChimeraX add-ons | disabled in browser | C |
| Figures and labels | browser canvas/SVG | ChimeraX | browser export | B |
| Sequence/alignment selection | JS | ChimeraX Sequence Viewer bridge | JS | C |
| External API calls | JS | keep in JS for browser; optional host proxy | JS | D |
| Add-on results | files | host result envelope | file load | C |

### What not to offload

- Bundle parsing, claims/relations/features, track rendering and the evaluation
  guide remain in Q2DV. They are the product, not a ChimeraX side effect.
- Browser-only API calls should not become host-dependent.
- Do not route every keystroke or hover through QWebChannel.

### Offload order

1. Workspace persistence and window/layout settings (host-owned files).
2. Structures: host opens/banks local files; app stops treating its JS cache as
   the canonical copy in host mode.
3. Computed metrics: one adapter at a time (RSA/interface first) with a
   comparison test against the JS result.
4. Add-ons: interface/metal/validation adapters through the result envelope.
5. Model building and MD only after the bridge is stable.

### Bridge contract

Every offloaded function must expose:

- `capability` flag on `window.Q2DVHost`;
- `method` with a schema/version;
- browser fallback;
- visible provenance (`ChimeraX`, command/add-on version, model id);
- failure path that leaves the browser result untouched.

## 5. Presets

There are three different preset layers; do not conflate them.

### A. Workspace/layout presets

Saved presentation states: demo, analysis, focus, wide. Store in
`workspace/settings.json`; user can create a custom preset later.

### B. Workspace content presets

A named combination of bundle + layout + visible tracks + saved selection.
Examples:

- **GFP demo**: GFP bundle, 1GFL chain A, chromophore selected, compact layout.
- **GFP interface**: 1GFL A/B, interface relation highlighted, analysis layout.
- **LacY demo**: LacY bundle, 12-TM track, 2CFQ, membrane layout.
- **LacY topology audit**: Phobius/TMHMM disagreement selected.

These are *not* recipes; they load a known state. A saved selection slot remains
the lighter-weight version for one range.

### C. Analysis presets

Existing rule presets, macro presets and future recipe presets stay as they are.
They answer "what analysis runs?", not "what does the workspace look like?".

### Preset requirements

- versioned and inspectable JSON;
- no private absolute paths in public presets;
- missing bundle/files reported explicitly;
- applying a preset is reversible (snapshot or undo);
- preset name, source and version shown in the UI;
- test GFP and LacY presets after any layout change.

## 6. Implementation order

### Phase A - storage and settings (implemented)

- [x] Host workspace read/write with atomic replace and five backups.
- [x] App load/save bridge; browser fallback unchanged.
- [x] Host settings for window geometry and theme.
- [x] Default window 1640x740 and remembered geometry.
- [x] Verified restore after deleting the WebEngine profile.
- [x] Added `tests/host_workspace_test.py` for corrupt-current recovery, backup rotation and schema rejection; `npm test` now runs it.
- [ ] Layout preset persistence is deferred to Phase B.

### Phase B - layout and offload foundation

- [x] Default 1640x740 host size and remembered geometry.
- [x] Demo/Analysis/Compact/Wide layout presets in browser and ChimeraX.
- [x] Compact hides the legend; manual changes switch to Custom.
- [x] Dark-mode contrast pass for inline text and empty states.
- [x] Capability flags and offload adapter skeleton (analyses still disabled).
- [x] Browser dark empty-state/layout screenshot reviewed at 1640x740; host visual QA still recommended.

### Phase C - move one analysis path (RSA shipped)

- [x] Pick RSA first; `measure sasa` + Tien max-ASA normalization.
- [x] Map the active model chain to the Q2DV reference sequence.
- [x] Keep the JS/browser RSA path available.
- [x] Add `CX_RSA` provenance and failure UI.
- [x] Test GFP/1GFL (230 mapped residues, 96.6% coverage).
- [ ] Compare the host and browser RSA shapes on GFP/LacY and document the method difference.
- [x] LacY 2CFQ is bundled and auto-opened; offload coverage check remains.

### Phase D - presets and add-ons

- Workspace content presets (GFP/LacY).
- One add-on result adapter from the ecosystem plan.
- Document/QA every new preset.

## 7. Acceptance criteria

- Restarting Q2DV with a deleted WebEngine profile still restores the workspace.
- Window size and layout preset survive a restart.
- Demo layout remains legible at 1640x740 and 1280x720.
- One offloaded metric matches the browser result on GFP and LacY.
- Applying a workspace preset is deterministic and reversible.
- Browser mode remains dependency-free and does not require a host.
- No raw structure text in the workspace JSON.
- Every new bridge method has a fallback and a test.

## 8. Open questions

- Should workspace auto-save be immediate after every selection, or only after
  data/preferences change (with explicit save on close)?
- Should layout presets be per-user settings or part of the portable save?
- Is the desktop window size measured in logical Qt pixels or physical display
  pixels? The current 1640x740/575x580 values need one calibration capture.
- Which first offload is more valuable: RSA/cofactor metrics or interface
  analysis?
- Do we need a custom preset editor, or are four built-ins enough for the demo?
- Should private TerC workspace presets live only in the local vault?

## 9. Decision log

- **2026-10-29:** Host-owned workspace file becomes canonical in ChimeraX;
  localStorage remains the browser fallback.
- **2026-10-29:** Storage comes before further offloading; without durable state,
  larger window layouts and add-on results are not trustworthy.
- **2026-10-29:** Layout presets are presentation-only; content presets are a
  separate layer.
- **2026-10-29:** Manual section/legend changes switch the layout selector to
  Custom; Compact hides the legend; presets are available in both hosts.
- **2026-10-29:** Do not offload bundle parsing/claims/features or browser-only
  API calls.
