# Q2DV — manual QA checklist

**Baseline:** app `0.72.12`, ChimeraX host `0.6.35`, ChimeraX `1.12`,
`npm test` `2061 passed / 0 failed` (plus 3 MCP protocol tests and 7 MaveDB
provider tests). Update the baseline line when the build changes.

**Surface:** every item here is **manual**. `npm test` runs the app script against
a stubbed DOM, replaces `renderViewer` with a no-op, never lays out a pixel and
never fires a real browser event, so all UI, layout, focus, theme, 3D and host
behaviour is unverified until driven by hand. Agent/MCP protocol paths have their
own automated suite (`mcp/test_q2dv_mcp.py`); those results are recorded as
backend evidence, not as a manual pass.

**This is the active checklist.** Historical cards and the numbered per-version
`0.16.0` → `0.66.x` regression rows live in [`QA_ARCHIVE.md`](QA_ARCHIVE.md).
Old rows still count: use the archive when a regression might have touched an
older surface. New features get a card here, not in the archive.

## How to use this file

1. Run `npm test` first and record the count in §1. A failing harness invalidates
   the rest of the pass.
2. Tick a box only after doing the step on the build named in the session block.
3. Stop at the first failure in a feature. Record it in §12 and keep going only
   when the failure cannot contaminate the next feature.
4. For state, API or host failures, attach **Log → Copy as JSON** plus a
   screenshot/log path. For UI failures, name the surface and the exact step.
5. "Edge" items are the point of this file: they are the cases the automated
   harness cannot reach. A feature is not signed off until its edge boxes are
   ticked or explicitly deferred.

**Session**

```
Build/commit: a5a8102 (0.72.10)  Deployed URL version: 0.72.10  Date: 2026-11-15
Browser/OS: ChimeraX Flatpak / Wayland  ChimeraX/host: 1.12 / 0.6.35  Display: host 1640×740
Tester: OpenCode backend pass      npm test: 2053 passed / 0 failed
```

**Result legend:** `[ ] pass` `[ ] fail` `[ ] deferred` — add build, date and a
one-line note. A deferred box must say why (no license, no model, no network,
not installed, awaiting another fix).

---

## 0. Mode matrix — browser vs add-on host

Run **both modes** for every release. The browser is the reference implementation;
the ChimeraX host must never be required for a browser feature.

| Area | Browser (standalone, no `Q2DVHost`) | Add-on host (ChimeraX Q2DV) | Details |
|---|---|---|---|
| Release/CSP | Must pass | Must pass | §1 |
| Bundles | GFP + LacY load by URL; claims/relations/features | Auto-select bundle by model sequence; wrong sequence refuses | §3 |
| Selection | Local highlight/track selection only | Q2DV ↔ ChimeraX mapping: chain, offset, insertion code; both directions | §4 |
| Commands/clipboard | Host controls absent, no errors | Contextual bridge, allowlist, paste label, injection guard | §4 |
| Agent/MCP | In-page agent API only; no external MCP | Host socket + `q2dv-mcp`, decisions, capabilities, timeline, audit | §4 |
| Files | Writes no host files | Vault banking, open PDB/CIF, refuse outside path, `Q2DV_FILES_DIR` | §4 |
| Persistence | localStorage restore; layout/theme survive reload | `workspace/current.json` + window size; corrupt/backup fallback | §5 |
| Analysis | Browser RSA, 3Dmol, validation | `CX_RSA`/SASA offload with provenance; browser fallback | §6 |
| UI/themes | Dark/light, compact workspace, layout presets, a11y | Theme auto-match, compact workspace, presets at 1640×740 | §7 |
| Services/offline | Switch on for http(s), off for `file://`; fails closed | Same, plus no host dependency in browser | §8–9 |
| Demo path | GFP + LacY walkthrough | Bridge, file vault, membrane recipe | §2 |
| Membrane | Topology + evidence in Q2DV | **Phase 4 pending** — test when the recipe lands | §2 |
| Third-party add-on | Not applicable | One gate candidate only (PICKLUSTER/MolCompose/ChopChopMF), public data, fallback | §2 |

**Per-mode sign-off**

- [ ] Browser mode complete — build: ______ · date: ______
- [ ] Add-on host mode complete — host: ______ · ChimeraX: ______ · date: ______
- [ ] Cross-host parity: same bundle gives the same claims/tracks/features;
      selection round-trips; browser-only features still work with no host.
- [ ] Known pending, explicitly deferred: membrane recipes, optional add-on
      install gate, structured add-on manifests, policy file/editor, ChimeraX
      MCP integration, full browser UI QA pass.

---

## 1. Session and release gate

**Applies to every pass.**

- [x] `npm test` passes with no failures (`node tests/run.js` plus the host
      workspace test). — 2053 + 3 MCP, 2026-11-15.
- [x] `npm run csp` reports the inline app-script hash is current.
      — `sha256-nmEHR1AVtcPhbyaLG9hH4rLryHhOzToAC+jwyc3qGZc=`.
- [x] `APP_VERSION` equals the top `## [x.y.z]` heading in `CHANGELOG.md`.
      — both `0.72.10`.
- [x] The build under test is the **deployed** GitHub Pages version, not only a
      local `file://` copy (the local copy cannot make API calls).
      — Pages serves `0.72.10`.
- [x] `git status` is clean and the deployed commit is the commit you expect.
      — clean at `a5a8102`; Pages reports the matching version.
- [ ] Browser console has no uncaught errors and no CSP violations on load.
- [ ] `file://` load works with the external-services switch off.
- [ ] `http://`/`https://` load works with the external-services switch on.
- [x] The host starts against the pinned `file:///.../q2dv_full/html/index.html?host=chimerax`
      URL with no scheme-registration warning. — socket live, status `0.72.10`,
      host `chimerax`.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes: backend/release checks
pass (2026-11-15); browser console, `file://` and `http(s)` checks remain
manual.

---

## 2. Demo acceptance (GFP + LacY, browser and ChimeraX)

Target: the two-week demo in `DEMO_ROADMAP.md` (§6.4). Run this end to end on the
demo laptop and projector resolution before the rehearsal.

### Must-have path

- [ ] Browser: load GFP, then LacY, from a local server with no host bridge.
- [x] ChimeraX: load a saved GFP session and a saved LacY session; each selects
      the matching bundle by sequence.
- [ ] A mismatched sequence refuses the bundle instead of injecting rows.
- [ ] Selection works **both directions** between Q2DV and ChimeraX, with
      model/chain mapping and visible provenance.
- [ ] File vault: save/open a PDB or CIF; an HHR or homolog snapshot is visible;
      a path outside the vault is refused.
- [ ] LacY membrane view: 12 TM ranges, orientation, membrane plane/clipping,
      topology-source labels, and the Phobius 12 vs TMHMM 11 disagreement.
- [ ] LacY 417 aa is never sent to ESMFold (400 aa cap); the preflight offers
      PDB/AlphaFold/local file and never truncates silently.
- [ ] No demo step depends on a live external API.
- [ ] Dark and light themes are readable on the projector.
- [ ] A fallback video and screenshots of every expected view exist.
- [ ] Every displayed number has a visible source or is labelled as a prediction.
- [ ] The presenter can state what is implemented, optional, and deferred.

### Demo edge cases

- [ ] Wrong protein loaded while a bundle is active: stale claims/relations/
      features clear, no mixing.
- [ ] Missing local structure file: claims/features still load; the view says
      what is missing.
- [ ] 2CFQ auto-open does not duplicate an already-open model.
- [ ] Network off: both bundles and both hosts still work; no blocking spinner.
- [ ] Restart the host: sequence, tracks, selection, theme and window size return.
- [ ] 1640x740 and 1280x720: controls, text and the membrane view stay legible.
- [ ] Recovery: one failed step can be retried without restarting the demo.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

---

## 3. Evidence bundles, claims and relations

### Evidence bundle loader + Claims/Relations — 0.69.0

**Surface:** Data → evidence bundle URL; Claims, Relations and Features panels;
Q2DV host bundle auto-detection.

**Normal**

- [ ] Load a bundle by URL/field; manifest, claims, relations and features
      appear with counts matching the manifest.
- [ ] Evidence links open the DOI/PDB/UniProt records named in the bundle.
- [ ] The loaded bundle survives a save/reload and a host restart.
- [ ] Loading a second bundle replaces the first cleanly.

**Edge**

- [ ] A non-matching sequence refuses the bundle.
- [ ] Malformed JSON, missing manifest keys or a schema mismatch fail with a
      readable message, not a partial load.
- [ ] A bad manifest hash is rejected.
- [ ] Missing optional files (schema/profiles) do not block claims/features.
- [ ] Claim/feature text is rendered as text, not HTML (XSS guard).
- [ ] Removing the bundle leaves no stale rows, badges or evidence links.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### Public GFP bundle — bundle 0.1.0

**Surface:** `bundles/GFP/`, Data bundle field, host banking.

**Normal**

- [ ] `bundles/GFP/manifest.json` loads **6 claims, 4 relations, 7 features and
      10 evidence records**.
- [ ] 1GFL and 1EMA are banked in `~/Q2DV_files/structures/`.
- [ ] With no model open, the host opens 1GFL chain A.
- [ ] Select S65-Y66-G67; 1GFL highlights the chromophore.
- [ ] Select `SS_NETSURFP2`; all 122 positions map to 1GFL chain A.
- [ ] The beta-barrel, dimer interface, A206K and EGFP tracks are visible and
      selectable.

**Edge**

- [ ] A non-GFP sequence rejects the bundle.
- [ ] 1GFL already open does not duplicate on restart.
- [ ] 1EMA opens manually as the single-chain S65T reference.
- [ ] A missing 1GFL file does not prevent claims/features from loading.
- [ ] The 1GFL interface is described as a crystal contact, never as a solution
      dimer measurement.
- [ ] Switching to a non-matching sequence clears GFP rows.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### Public LacY bundle — bundle 0.1.1

**Surface:** `bundles/LacY/`, Data bundle field, host banking, topology steps.

**Normal**

- [ ] `bundles/LacY/manifest.json` loads **5 claims, 3 relations, 3 features and
      7 evidence records**.
- [ ] UniProt P02920: 417 aa, 12 TM ranges.
- [ ] Phobius 12 vs TMHMM 11 disagreement is visible.
- [ ] 2CFQ and 1PV6 are banked; with no model open, 2CFQ chain A opens.
- [ ] 2CFQ or 1PV6 opens and the membrane selection maps correctly.
- [ ] 1PV6 remains available for the crystal-contact view.

**Edge**

- [ ] A GFP sequence rejects the LacY bundle.
- [ ] Missing local structures do not block claims/features.
- [ ] 1PV6 is labelled a crystal contact, not a biological dimer.
- [ ] Full-length LacY never calls ESMFold; the 417 > 400 cap is actionable.
- [ ] Model source is visible on every view (`2CFQ`, `1PV6`, `AlphaFold DB`,
      `ESMFold (truncated control)`).
- [ ] The 12-TM ranges shown match the topology source displayed; no hard-coded
      second set in the deck.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

---

## 4. ChimeraX host, bridge and bridge safety

### ChimeraX model context + selection link — 2026-11-10 (host pass)

**Surface:** Input Data → ChimeraX model; Selection Workspace → ChimeraX link.

**Normal**

- [ ] Open ChimeraX with 1GFL loaded, then open Q2DV with no workspace: Q2DV
      fills the reference sequence from the model and selects the GFP bundle.
- [ ] With several model chains open, Q2DV lists them in Input Data → ChimeraX
      model and does **not** silently guess; "Use model" loads the chosen one.
- [ ] A workspace with a saved Q2DV sequence is not overwritten by a host model.
- [ ] Selection Workspace → ChimeraX link: **Both**, **Q2DV → ChimeraX**,
      **ChimeraX → Q2DV** and **Off** each behave as named.
- [ ] **ChimeraX → Q2DV**: selecting residues/atoms in ChimeraX highlights the
      matching Q2DV range; clearing in ChimeraX clears Q2DV.
- [ ] **Q2DV → ChimeraX**: selecting a Q2DV range highlights the model; a
      ChimeraX selection does not move Q2DV.
- [ ] The link mode survives a host restart.
- [ ] Input Data shows the ChimeraX viewport size and screen size.

**Edge**

- [ ] Restored workspace + selection before the model is open: the selection is
      deferred and applied after the model opens, with no error toast.
- [ ] Shifted/truncated model: only covered residues map; no wrong-chain pick.
- [ ] Multi-chain model: selected residues from each chain map to the right
      reference positions.
- [ ] Clearing the selection in one app does not leave a stale highlight in the
      other.
- [ ] Off mode: neither app moves the other.
- [ ] Browser mode: the ChimeraX model and link controls are hidden.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### Host badge and identity — 0.70.0

- [ ] Browser shows the **Standalone** badge; the host shows **ChimeraX**.
- [ ] The version pill names the app version in both hosts.
- [ ] Switching host state updates the badge without a reload.
- [ ] Browser with no `Q2DVHost` object loads with no host error.

**Edge**

- [ ] Old host without a version/capability object still shows a safe badge.
- [ ] Badge and pill stay readable in dark mode.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### Host selection context + Py3Dmol guard — 0.71.0

- [ ] The host selects the bundle by the active model sequence (TerC, GFP, LacY).
- [ ] Selecting a Q2DV range highlights the matching model residues.
- [ ] Reference positions map correctly through offset, chain and numbering.
- [ ] The in-app 3D path is guarded when the host owns the scene.

**Edge**

- [ ] No open model gives `no atomic model`, not a wrong chain.
- [ ] Multi-chain model: the correct chain is chosen and reported.
- [ ] Shifted/missing initiator Met still maps correctly.
- [ ] Mutated or truncated chain maps the covered part and reports gaps.
- [ ] Insertion codes do not shift the selection.
- [ ] Wrong sequence does not inject a selection.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### Contextual ChimeraX command bridge — 0.71.1

- [ ] Commands run against the current model/selection context.
- [ ] User-supplied text cannot inject a second command or escape quoting.
- [ ] A failed command reports the failure and leaves the scene usable.

**Edge**

- [ ] Unknown command: readable error, no host crash.
- [ ] Quotes, spaces and residue names in a label are handled.
- [ ] Command output does not leak into an unrelated toast.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### ChimeraX clipboard controls — 0.71.2

- [ ] Copy/paste controls appear in the host and are hidden in the browser.
- [ ] Copy selection and paste label produce the expected residue range.
- [ ] A denied clipboard permission reports an actionable message.

**Edge**

- [ ] Pasted text is sanitized before it reaches a label or command.
- [ ] Empty clipboard does nothing destructive.
- [ ] Browser build has no clipboard host dependency.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### CSP-safe collapsible sections — 0.71.3

- [ ] Guide, rules, interface, ensemble and construct sections open/close in the
      browser and host.
- [ ] No inline event handlers and no CSP console errors.
- [ ] Keyboard/assistive activation works where the section is focusable.

**Edge**

- [ ] A section without `data-toggle-action` is ignored safely.
- [ ] A missing action key does not throw.
- [ ] Rapid open/close does not leave a stale coachmark or scroll jump.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### Native toggle listeners — 0.71.4

- [ ] Opening the rules section renders presets.
- [ ] Opening/closing the guide clears its coachmark.
- [ ] Interface and ensemble sections refresh when opened.
- [ ] The construct preview updates on change.
- [ ] No inline handlers or CSP errors.

**Edge**

- [ ] A section without `data-toggle-action` is ignored.
- [ ] A missing action key must not throw.
- [ ] Opening a section twice does not duplicate listeners or cards.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### ChimeraX file handoff and vault — 0.71.5 / host 0.6.21+

- [ ] Fetched/attached PDB/CIF appears in `~/Q2DV_files/structures/`.
- [ ] Imported `.hhr` and in-app homolog snapshots appear in `homologs/`.
- [ ] Options → Local Structure Cache shows the ChimeraX path.
- [ ] The per-structure **ChimeraX** button opens it.
- [ ] Browser build writes no host files.

**Edge**

- [ ] A path outside the vault is refused.
- [ ] A failed save logs but does not block the current Q2DV view.
- [ ] `Q2DV_FILES_DIR` relocates all subfolders.
- [ ] Reopening an already-open file does not duplicate it.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### Agent API, decisions, timeline and capabilities — 0.72.2 → 0.72.10

**Surface:** Agent panel and in-page API (`window.q2dvAgentRequest`); MCP via
`mcp/q2dv_mcp.py`.

- [x] `agentRequest({ action: 'q2dv.status' })` returns an `q2dv.agent.result/1`
      envelope with the app version and host mode. — live, `0.72.10`.
- [x] `q2dv.snapshot` reports the sequence length, a 64-character SHA-256, the
      selection and non-sequence tracks. — live.
- [x] `q2dv.read_track` returns only the requested slice and flags truncation.
      — harness.
- [x] `q2dv.select` moves the page selection and mirrors it to ChimeraX when the
      link allows it. — harness.
- [x] `q2dv.import` for a sequence/PDB returns `human_required` with a decision;
      the approval token is not returned to the caller. — harness + live command.
- [x] A wrong or missing token is refused; replaying an approved decision does
      not re-run. — harness.
- [x] `q2dv.ledger` shows actor, tool, args, status and duration, capped at 500
      events / 100 MB. — live.
- [x] `npm test` covers the registry, validation, tiers, grants and ledger.

**Edge**

- [x] An unregistered action (for example `q2dv.eval`) is rejected. — harness.
- [x] An import whose arguments changed after approval is refused. — harness.
- [x] Replacing a non-matching reference sequence without clearing input is a
      precondition error, not a silent overwrite. — harness.
- [ ] A session grant expires at local midnight; revoking it restores the gate.

**Decision queue (0.72.3)**

- [ ] The header **Agent** badge appears only while a decision is pending and
      shows the count.
- [ ] Session → Agent decisions shows tool, arguments, why, effects and
      expected result for each card.
- [ ] Approve runs the action once and the badge decrements; Reject closes the
      card without running it.
- [ ] Allow `<class>` for today grants a session pass; the card still needs
      Approve.
- [ ] Pause closes the panel and leaves the card pending.
- [ ] **Queue a test request** uses radio chips (no native dropdown) and creates
      a decision without opening DevTools; invalid JSON is reported inline.
- [ ] Selecting a chip updates the JSON arguments to that tool's default.
- [ ] In ChimeraX, opening the request picker does not draw an expanding white
      rectangle.
- [ ] Tab reaches every button, and closing returns focus to the opener.
- [ ] HTML-looking rationale is displayed as text, never as markup.
- [ ] Dark mode: File/View/Analyze menu items and the Agent modal title, intro
      and request form are readable, not dark-on-dark.

**Activity timeline and scenarios (0.72.7)**

- [ ] Agent → Agent activity lists events with time, tool, status and duration.
- [ ] Step highlights one row; Play advances it; Pause stops.
- [ ] **Restore step** reapplies the recorded selection and reports tracks added
      since or not recreated.
- [ ] Export scenario copies a `q2dv.scenario/1` JSON with only
      import/select/run steps.
- [ ] `q2dvAgent.runScenario({steps:[...]})` passes a matching assertion and
      reports a failing one by step index.
- [ ] A scenario import step stops with "human approval" rather than running.
- [ ] Approving a decision adds the executed action as its own timeline row.
- [ ] A `human_required` result carries no usable approval token; a `q2dv_decide`
      call without the page-held token is refused.

**Capabilities, commands and audit (0.72.9)**

- [x] `q2dv_host_capabilities` lists the host version and installed
      `ChimeraX-*` bundles. — live, 185 bundles.
- [x] `q2dv_command` returns `human_required` and the card shows the command
      text. — live, `dec-0001`, no token returned.
- [x] A disallowed prefix (`delete all`) or a command containing `;`/a newline
      is refused. — harness.
- [x] Grant commands for today; an approved command runs; Revoke restores the
      gate. — harness (fake host).
- [x] An approved command that fails resolves as `failed` with the host message
      instead of staying pending. — harness + live `dec-0001` rejection.
- [ ] The Agent panel lists active grants with Revoke.
- [x] `~/Q2DV_files/agent/audit.jsonl` gains one line per host call and rotates
      to `.1`/`.2` at 10 MB. — line growth live; rotation not exercised.

**MaveDB and reset (0.72.12)**

- [ ] `q2dv.mavedb` returns `human_required`; approving fetches/caches the CSV
      and adds a `..._EXP` experimental track.
- [ ] The top cluster is selected and the components/weights are reported.
- [ ] A second run uses the cache; `refresh` re-fetches; five CSVs are retained.
- [ ] A mismatched reference reports `wt_mismatches` instead of shifting
      silently.
- [ ] **Reset all add-on data...** requires two confirmations and warns to save
      a session first; **Clear input data** remains the light action.

**MaveDB backend evidence (2026-11-15):** the real avGFP score set
`urn:mavedb:00000080-a-2` fetched and parsed 53,990 rows; the target DNA
translated to a 237-aa DMS reference and aligned to the 238-aa Q2DV sequence
(ratio 0.994); F64L is the only reference mismatch. Ranked clusters: 81-85
(0.61), 63-67 (0.60, chromophore), 53-57, 216-220, 27-31. Provider tests pass;
the live host bridge needs a ChimeraX restart.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes: backend evidence recorded
2026-11-15; UI approval, grant chips, timeline interactions and the pending token
expiry edge remain manual.

### MCP server and host socket — 0.72.6 → 0.72.10

**Surface:** `mcp/q2dv_mcp.py`, MCP client, `~/Q2DV_files/agent/agent.sock`.

- [x] `npm run agent:tools` regenerates `mcp/tools.json`; `npm test` agrees with
      the app registry and version. — 14 tools, `0.72.12`.
- [x] `npm run test:mcp` passes without ChimeraX running. — 3 tests pass.
- [x] With ChimeraX and the Q2DV tool open, `agent.sock` exists, the directory
      is `0700` and the socket is `0600`. — live.
- [x] An MCP client lists 14 `q2dv_*` tools and reads `q2dv://state`. — live.
- [x] `q2dv_status` returns the app version; an import/command returns
      `human_required`. — live.
- [ ] Approving in Q2DV → Agent lets a later status/ledger call show the result.
- [x] With ChimeraX closed, tools/list still works and a call reports
      `host_unavailable` (not a protocol crash). — protocol test + stale socket.
- [x] No TCP listener is created for the agent bridge. — Unix socket only.

**Edge**

- [x] An unknown tool is a `-32602` JSON-RPC error; an unknown resource is too.
      — protocol test.
- [x] Restarting ChimeraX removes the stale socket and recreates it. — verified
      after reboot.
- [ ] Dropping the client mid-call does not leave the host blocked.

**Backend evidence (2026-11-15):** MCP initialize/tools/resources, status,
capabilities (185 add-ons, 24 commands), snapshot, command decision with no
token, ledger and audit line growth all verified against the live host. UI
approval, grant chips and timeline interactions remain manual.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

---

## 5. Workspace, storage and layout

### Host file origin + workspace persistence — 0.71.8 / 0.71.9

- [ ] Q2DV opens from `file:///.../q2dv_full/html/index.html?host=chimerax`.
- [ ] No `q2dvfull` / `QWebEngineUrlScheme::registerScheme` warning appears.
- [ ] GFP loads, 1GFL chain A appears, and the bundle is selected.
- [ ] Close/reopen Q2DV; sequence, tracks, selection and theme return.
- [ ] Window size is remembered after resize and reopen.
- [ ] `workspace/current.json` exists and contains **no raw PDB/CIF text**.
- [ ] An external API fetch from the `file://` origin returns HTTP 200.

**Edge**

- [ ] Delete the WebEngine profile; reopen; workspace still restores.
- [ ] Corrupt `current.json`; the newest valid backup loads.
- [ ] Delete `current.json` and all backups; the localStorage fallback opens.
- [ ] Save a workspace with an unsupported schema; it is rejected.
- [ ] Browser at `http://` still has no host or workspace dependency.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### Workspace persistence + layout presets — 0.71.10 / 0.71.13

- [ ] Browser: Demo, Analysis, Compact and Wide apply immediately.
- [ ] ChimeraX: the same presets apply at 1640x740.
- [ ] Compact hides the legend; another preset shows it again.
- [ ] Manual sidebar-section or legend changes switch Layout to **Custom**.
- [ ] Preset/Custom choice survives reload/restart.
- [ ] Workspace save/restore includes the layout and selection state.
- [ ] Theme switch does not reset the layout.
- [ ] Browser has no ChimeraX dependency.

**Edge**

- [ ] Invalid/missing saved layout falls back safely.
- [ ] Compact can restore the legend without a hidden control.
- [ ] Resize to 1280x720; controls and text remain readable.
- [ ] Two restores in a row do not accumulate stale sections.
- [ ] No raw structure coordinates are written to the workspace.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

---

## 6. Host analysis and offload

### Capability flags + offload skeleton — 0.71.11

- [ ] Browser build works with no `Q2DVHost.capabilities` object.
- [ ] Host capabilities advertise command, selection, file, workspace and
      offload fields.
- [ ] Disabled analyses fall back to the browser path.
- [ ] An enabled skeleton reaches the host without changing claims/tracks.
- [ ] An old host without capabilities still works.

**Edge**

- [ ] Unknown offload is ignored safely.
- [ ] A failed offload leaves no partial track or partial data.
- [ ] Retry after failure works and replaces, not duplicates.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### First host analysis: ChimeraX RSA/SASA — 0.71.12

**Surface:** Analyze → ChimeraX analysis → Compute RSA; `CX_RSA`; model/chain mapping.

- [ ] GFP + 1GFL: Compute RSA succeeds.
- [ ] `CX_RSA` appears with ChimeraX provenance.
- [ ] Status names the model, method and coverage.
- [ ] The row can be graphed and selected like other RSA rows.
- [ ] Browser RSA still exists independently.
- [ ] Re-running replaces `CX_RSA`; it does not duplicate.

**Edge**

- [ ] No model: actionable error, not a crash.
- [ ] 1GFL coverage is below 100% because it has 230 resolved residues; the UI
      explains that rather than looking like a failure.
- [ ] No sequence: the action refuses.
- [ ] Browser-only mode reports that ChimeraX is not the host.
- [ ] A SASA failure leaves browser tracks unchanged.
- [ ] The method difference from browser RSA is stated, not implied to be equal.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

---

## 7. Themes, UI, CSP and accessibility

### Compact Selection Workspace + automatic 3D selection — 0.71.6

- [ ] At 1640x740, Scope/Scale/Selected Range are compact and legible.
- [ ] Selecting a range highlights matching residues in ChimeraX.
- [ ] Selecting `SS_NETSURFP2` maps substitutions/short gaps.
- [ ] Clearing the selection is visible and leaves no stale highlighting.

**Edge**

- [ ] Shifted/missing initiator Met still maps correctly.
- [ ] Mutated/truncated chain mapping does not select the wrong residue.
- [ ] No open model shows `no atomic model`, not a wrong chain.
- [ ] Browser build remains unchanged.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### Light/dark theme + ChimeraX auto-match — 0.71.7

- [ ] Browser toggle switches Dark → Light → Dark.
- [ ] Browser reload remembers the chosen theme.
- [ ] Dark ChimeraX starts Q2DV dark; light starts Q2DV light.
- [ ] Track colours remain distinguishable in both themes.
- [ ] Modals, inputs, sidebar and selection panel remain readable.

**Edge**

- [ ] `?theme=dark` / `?theme=light` overrides the saved preference.
- [ ] No host theme falls back to the browser preference/system.
- [ ] Theme switch creates no CSP error.
- [ ] Theme switch does not reset tracks, selection or layout.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### Legend default + dark dropdown contrast — 2026-11-10

- [ ] Demo, Analysis, Compact and Wide presets all start with the legend hidden.
- [ ] The legend toggle still shows/hides it and switches Layout to Custom.
- [ ] A previously saved `legendHidden` preference is respected.
- [ ] Dark theme: opened `<select>` option lists are light-on-dark and readable
      (not dark-on-dark), including the category, track, layout and macro pickers.
- [ ] Disabled and checked options are distinguishable in dark mode.
- [ ] Light theme dropdowns are unchanged.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### Annotation concordance — 2026-11-10

**Surface:** Analyze → Annotation concordance.

- [ ] Compare an `SS_` track with an attached PDB: helix and sheet precision,
      recall and agreement appear, plus the disagreement ranges.
- [ ] Compare a `TM_`/`TP_` track: predicted TM helices are compared with the
      structure HELIX records.
- [ ] Only residues the structure covers are counted; the mapped/total count is
      shown.
- [ ] Selecting a track in the dropdown repopulates after a re-render.
- [ ] A CIF-only structure, a missing PDB, or no SS/TM track gives an actionable
      message instead of a result.

**Edge**

- [ ] A shifted model maps by sequence, not by raw residue number.
- [ ] A structure with no HELIX/SHEET records says so explicitly.
- [ ] An annotation with no helix (only coil/sheet) reports 0 predicted helix,
      not an error.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### Protein Summary dark contrast — 0.71.14

- [ ] UniProt protein name and function text are readable on dark panels.
- [ ] Accession/reviewed chips use dark-appropriate surfaces.
- [ ] Keyword and GO-term chips are readable, including hover/focus.
- [ ] Light mode is unchanged.

**Edge**

- [ ] Long names/functions wrap without clipping or invisible text.
- [ ] Missing UniProt data falls back to readable empty text.
- [ ] Links keep visible focus in both themes.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

### Dark info-icon controls — 0.71.15

- [ ] The ⓘ buttons beside Protein Summary, Scope, Scale, Selected Range,
      FASTA Segment, Protein constants and Quantitative Metrics use dark surfaces.
- [ ] Hover and focus states have accessible contrast.
- [ ] Light mode is unchanged.
- [ ] Tooltips are readable and dismiss correctly.

**Edge**

- [ ] Keyboard focus reaches every ⓘ with a visible ring.
- [ ] Small viewport: icons do not overlap labels.
- [ ] No CSP error or inline handler is introduced.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

---

## 8. Security, services and import hardening (0.68.x)

**Surface:** Options → Data Sources, Import, Log, CSP.

- [ ] EBI refusal messages are understood and actionable (0.68.0).
- [ ] EBI contact email is accepted/persisted where configured (0.68.1).
- [ ] Service policies show the current provider limits (0.68.3).
- [ ] Request caps stop runaway loops; the usage log records requests (0.68.4).
- [ ] Import hardening rejects script/HTML payloads (0.68.5).
- [ ] Schema versions reject or migrate unsupported saves (0.68.6).
- [ ] The 3Dmol bundle is integrity-checked; external links are safe (0.68.7).
- [ ] App identity/version reporting matches the build (0.68.8).
- [ ] CSP + event delegation: no inline handlers, no policy violations (0.68.9).

**Edge**

- [ ] Network off: every provider fails closed with a reason, not a hang.
- [ ] A provider returns 4xx/5xx: other providers still work.
- [ ] Oversized sequence/request is refused before the call.
- [ ] A failed import leaves zero partial rows.
- [ ] Pasted text with `<script>`, quotes and newlines is inert.
- [ ] Log → Copy as JSON contains no secrets/API keys.
- [ ] A stale CSP hash makes `npm test` fail as intended.

**Result:** `[ ] pass` `[ ] fail` `[ ] deferred` — notes:

---

## 9. Cross-cutting edge suites

Run these when the release touches shared code, even if the feature card looks
unrelated.

### A. Release and CSP

- [ ] `APP_VERSION` == top `CHANGELOG.md` heading.
- [ ] Inline app-script hash matches the CSP meta tag.
- [ ] Exactly one `<script>` block in `index.html`.
- [ ] `WORKFLOW.md` is current after any `WORKFLOW_STEPS`/question/preset change.
- [ ] No stale build is being tested (version badge vs deployed commit).

### B. External services and offline

- [ ] External-services switch off: no outbound request is attempted.
- [ ] Local `file://`: switch defaults off; `http(s)`: defaults on.
- [ ] Each disabled/unavailable provider states the reason.
- [ ] Provider failure is isolated: one failure does not blank the others.
- [ ] A retry after recovery works without reloading the page.

### C. Persistence and restore

- [ ] Save → reload → restore keeps sequence, tracks, rules, selection, theme.
- [ ] Older saves name any rows without backing data and explain the two ways out.
- [ ] Corrupt/unsupported save is rejected without wiping the current session.
- [ ] Removal survives reload and re-fetch does not resurrect removed rows.
- [ ] Clearing all data leaves a usable empty state, not a broken shell.

### D. Import and XSS

- [ ] FASTA, PDB/CIF, topology, experimental table and HHR imports all reject a
      wrong-format file with a readable reason.
- [ ] HTML/script in any imported name, label or claim renders as text.
- [ ] Very large files fail cleanly or are capped with a message.
- [ ] Unicode, blank lines, CRLF and comment lines are handled.

### E. Removal and undo

- [ ] Removing each track group removes its rows, tooltips, graph and 3D tint.
- [ ] Removing a rule removes the rule, not just the row, and Undo restores it.
- [ ] Removing a validation/domain/topology row does not remove unrelated rows.
- [ ] Remove → re-fetch rebuilds only the expected row.
- [ ] Debris check: legends, range selectors, metrics and export lists update.

### F. Selection and mapping

- [ ] Reference ↔ model mapping: identity, offset, chain, insertion code.
- [ ] Covered range with gaps selects only covered residues.
- [ ] Wrong sequence/model refuses the selection.
- [ ] Clear selection is visible in both hosts.
- [ ] Multi-chain model never highlights the wrong chain.

### G. Clipboard and export

- [ ] Copy FASTA, TSV, methods report and AI pack produce complete content.
- [ ] Export PDB/CIF round-trips into the viewer with the same numbers.
- [ ] Copy/paste hand-off to an external tool preserves the residue range.
- [ ] Empty/partial data exports say what is missing.

### H. Accessibility and contrast

- [ ] Keyboard reachability for menus, sections, tabs, dialogs and ⓘ buttons.
- [ ] Visible focus ring in light and dark themes.
- [ ] `prefers-reduced-motion` does not hide content that relies on a transition.
- [ ] Text/background contrast is readable on dark panels, chips and hints.
- [ ] No information is conveyed by colour alone.

### I. Browser/host parity

- [ ] Every browser-only feature still works with no host adapter.
- [ ] Every host feature reports a fallback when the host is absent.
- [ ] The same bundle gives the same claims/tracks/features in both hosts.
- [ ] Host-specific UI never appears in a plain browser.

### J. Macro failure diagnostics

- [ ] Run the GFP preset; a failed step names the step, status and message in
      the run report.
- [ ] An API failure shown in the step status (domain, homology, topology,
      validation, PDB) also appears as **failed** in the run report, not done.
- [ ] Reload the session; the last macro run report is still available and
      **Copy run report** reproduces it (now persisted in the workspace/save).
- [ ] The report separates API failures from skipped steps and says what the
      failure starves downstream.
- [ ] A retry after an EBI timeout/fair-use block gives the same underlying
      error, not a different one.

---

## 10. Regression smoke for older surfaces

Use the archive for the full historical rows. These are the minimum boxes when a
release touches shared state. Historical detail: [`QA_ARCHIVE.md`](QA_ARCHIVE.md).

### Input data and intake

- [ ] UniProt/PDB/FASTA intake loads and names the protein correctly.
- [ ] PDB sequence fallback and accession/name lookup still work.
- [ ] Local structure cache and PDB fetch still work.
- [ ] Empty/invalid input gives the expected guidance.

### Guide and workflow

- [ ] Every step opens from the guide and the short-form card.
- [ ] Questions/answers persist and clear correctly.
- [ ] "Data sources" links land on the right category.
- [ ] Read-out/methods report never claims a section with no data.

### Tracks, rules and graphs

- [ ] Track visibility, order and colour controls still work.
- [ ] Rule presets apply, remove and undo.
- [ ] Graph selection, range read-out and right-click menu work.
- [ ] Hover tooltips resolve the same row they describe.

### Homologs, topology and variants

- [ ] phmmer/BLAST ranking and source labels are consistent.
- [ ] Topology consensus still shows the Phobius/TMHMM disagreement.
- [ ] Variant providers isolate failures and skip unsupported species.
- [ ] PROSITE/InterProScan domain rows still overlay correctly.

### Structure, validation and 3D

- [ ] PDB/CIF attach, 3D view and colour-by-track work.
- [ ] PDBe validation rows, tooltips and removal work.
- [ ] Metal-site/cofactor coordination still attaches.
- [ ] Ensemble RMSD/RMSF still produce nonzero values for perturbed models.

### Exports, macros and options

- [ ] Methods report, hypothesis TSV, saves and structure export are complete.
- [ ] Macro record/export/replay and the run report work.
- [ ] Options categories, Data Sources and service policies still switch.
- [ ] Saved macros/presets still load after reload.

---

## 11. Reference expectations

| Item | Expected |
|---|---|
| App baseline | `0.72.12` (update per build) |
| Host / ChimeraX | host `0.6.35`, ChimeraX `1.12` |
| `npm test` | `2061 passed, 0 failed` plus 3 MCP and 7 MaveDB provider tests |
| GFP bundle | 6 claims, 4 relations, 7 features, 10 evidence |
| GFP chromophore | S65-Y66-G67; 1GFL chain A |
| GFP structure | 1GFL and 1EMA; 1GFL has 230 resolved residues |
| LacY bundle | 5 claims, 3 relations, 3 features, 7 evidence |
| LacY protein | P02920, 417 aa, 12 TM |
| LacY topology | Phobius 12 vs TMHMM 11 (expected disagreement) |
| LacY structures | 2CFQ (single chain), 1PV6 (two chains, crystal contact) |
| ESMFold cap | 400 aa; LacY 417 aa must not be sent |
| Browser save | `APP_VERSION` == top `CHANGELOG.md` heading |
| CSP | inline app-script SHA-256 must match |

**Known limits** (do not report as new bugs without checking):

- The test harness stubs the DOM and disables `renderViewer`; UI is manual-only.
- AlphaFold answers 403 to Node's fetch; drive that path from the browser.
- HMMER/Foldseek/ESMFold are live services; a failure can be the service.
- `group:pLDDT` / `group:RSA` are not categorical sources; use `pLDDT:`/`RSA:`.
- Rules: removing a `RULE_` row deletes the rule; there is no "hide row, keep rule".
- LacY is over the ESMFold cap by design; use 2CFQ/1PV6/AlphaFold DB.

---

## 12. Bug log

| ID | Date | Build | Surface | Expected | Actual | Severity | Log/screenshot |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |

For every failure: feature/card, build, exact steps, expected vs actual, and
**Log → Copy as JSON** plus a screenshot or log path. Say whether it is a
regression (worked before) or an unverified edge case.

**2026-11-15 backend pass (0.72.10, `a5a8102`):** no defects found. Verified the
release gate, live MCP initialize/tools/resources, status, capabilities
(185 bundles), snapshot, command decision without a token, ledger and audit line
growth. **0.72.11** adds the failed-approval resolution (`dec-0001` with no atoms
now resolves as `failed`, harness-verified); live re-check after reopening the
tool. **0.72.12** adds the host-side MaveDB provider and the explicit
**Reset all add-on data...** flow. During the MaveDB pass, raw HGVS positions
were found to be offset by one because the avGFP DMS lacks the initiator Met and
carries F64L; fixed by translating the target DNA and aligning (ratio 0.994).
The live host bridge still needs a ChimeraX restart. Pending manual work: browser
console/CSP, `file://`/`http(s)` loads, the approval click, grant chips, timeline
Step/Restore/Play, MaveDB UI, and token mid-call disconnect.

---

## 13. Links

- [`QA_ARCHIVE.md`](QA_ARCHIVE.md) — historical cards, numbered rows, live checks.
- [`DEMO_ROADMAP.md`](DEMO_ROADMAP.md) — demo scope, gates, acceptance, script.
- [`DESIGN.md`](DESIGN.md) — design, surface placement and open items.
- [`README.md`](README.md) — documentation index.
- Run the app with `python3 -m http.server` for the `http://` path; use `file://`
  only when testing the offline fallback.
