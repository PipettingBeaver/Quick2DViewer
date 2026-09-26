# Q2DV — QA checklist for the current development session (v0.16.0 → v0.23.0)

**Read this first.** Every item below has automated coverage in `npm test` (240 checks),
but that harness runs the app script against a **stubbed DOM**: it never renders a
pixel, never lays anything out, never fires a real browser event, and it *replaces*
`renderViewer` with a no-op for speed. So treat **all UI behaviour as unverified**
until you have driven it by hand. The list is written for trying to break things,
not for confirming they work — each row says what to do and what would count as a bug.

## Setup / reset between attempts

| Purpose | How |
|---|---|
| Full reset | `File → Reset Data` (clears tracks + selection; preferences survive) |
| Full reset incl. preferences | devtools → `localStorage.removeItem('q2dViewer_state_v1')` → reload |
| Inspect the saved session | devtools → `JSON.parse(localStorage.getItem('q2dViewer_state_v1'))` |
| Force a slow/absent network | devtools → Network → Offline (external services must already be enabled) |
| Open both ways | `file://` **and** `python3 -m http.server` — `fetch()` of `CHANGELOG.md` / `WORKFLOW.md` differs |
| Keyboard pass | Tab through every new control; then repeat with devtools → Rendering → *Emulate prefers-reduced-motion* |
| Long input | Paste a 400–600 aa sequence so rules/cross-checks have real ranges |

## Cross-cutting risks (check these first — they cut across everything)

| # | Try | Watch for |
|---|---|---|
| X1 | Do a full workflow, reload the page, and compare every panel | Anything that comes back **different**: a step marked done while its data is gone, a `needs …` preset that now reports nothing missing, topology rows present but Options → Data Sources showing no sources, `[HMMER (Pfam)]` provenance on a row whose stats tooltip is empty |
| X2 | Reload, then **remove one row of a type that was restored** (TP_, UP_, DM_, HL_, VAR_) | Should remove exactly that row (or, for TP_, its pasted source). Anything that removes *more* than asked is a bug |
| X3 | Remove rows while the **Guide** tab is open and the same step is expanded | The card must not collapse (open state is preserved by `data-step`), and the "Next:" card must update |
| X4 | Load data while a rule exists | Rules now re-evaluate on every data change. A `RULE_` row must appear/disappear as its inputs change; nothing should hang on a 600 aa sequence with 8 rules |
| X5 | Undo a step you had **manually marked done** | Undo removes the data but deliberately keeps the override — so the card can read "done (you)" with nothing loaded. Is that understandable, or confusing? |
| X6 | Use the wizard's `Open HHpred ↗` / `Open a predictor ↗` actions | Popup blockers may swallow `window.open`; the button must not look broken if it does |
| X7 | Turn **File → New-feature highlights** on | The purple markers should cover every new section; anything new that is *not* marked is a gap in the convention |

## 0.16.0 — design pass

| # | Try | Watch for |
|---|---|---|
| 1 | Toggle the legend, reload | Legend starts **hidden**; the Show/Hide button is the only toggle; hidden state survives reload |
| 2 | Show pLDDT as a graph (Track Control → pLDDT → View as → Graph) | The legend's pLDDT row appears; switch back to Glyphs and it disappears; RSA behaves the same independently |
| 3 | Compare legend order with the track order in the viewer | Same order (AA, H, P, E, M, D, C, pLDDT, RSA) |
| 4 | Collapse "FASTA Segment" and "Quantitative Metrics" in the Selection tab | Both collapse; the ⓘ info icons inside the summaries must **not** toggle the section |
| 5 | Select exactly one residue | Reads "Residue 148" (no "Length: 1aa"); select 2+ → "Residues: 148 - 149 (Length: 2aa)"; do the same on a non-AA row (row readout) |
| 6 | Open every menu | File has Options + both toggles; **Analyze** holds Data & Structures / Analysis Rules / Interfaces / Scan Domains / Cross-checks; Export has 6 items; no crossed handlers |
| 7 | Hover a type row (e.g. SS) | Type badges fade in; move away → fade out; click one to activate → stays visible |
| 8 | Tab to the chevrons / ✕ buttons | Visible focus ring; with reduced-motion on, no transitions animate |

## 0.17.0 — HMMER hmmscan + Track Control links

| # | Try | Watch for |
|---|---|---|
| 9 | Analyze → Scan Domains (HMMER)… with a real sequence (needs external services) | One **Domains** row per significant Pfam family; provenance `HMMER (Pfam)`; a 76 aa sequence should give ~7 rows; the `?`-only families must **not** appear |
| 10 | Scan with no sequence loaded / offline / with services disabled | Clear message, no crash, no half-written rows |
| 11 | Track Control → a type's popover → **Config…** | Opens that type's config frame; "← Track Control" returns to the list |
| 12 | Track Control → **Open Track Manager →**, and Tracks tab → **Track Controls ↗** | Each jumps to the other with the same visibility state (no desync after hiding something on one side) |

## 0.18.0 / 0.19.0 — Evaluation Guide

| # | Try | Watch for |
|---|---|---|
| 13 | Open the Guide tab with nothing loaded | 8 step cards, all `optional`/`recommended` per profile, "Next: Load sequence", read-out says to load a sequence |
| 14 | Answer intake questions, then reload | Answers persist; recommended vs optional changes accordingly (membrane = Yes → features + topology promoted) |
| 15 | Answer intake, then look at the Input Data modal checklist | It mirrors the guide (read-only), shows the same coverage count, and its link lands on the Guide tab |
| 16 | Mark a step **done**, then **Skip** it, then **Reset** the override | Chip changes done → skipped → back to auto; skipped steps leave the "X of Y" denominator |
| 17 | Load partial data for a step (e.g. only a `TM_` row) | Status is `done` from detection; the button reads "Re-run: …" and still works |
| 18 | Click the DOI links on a step card / preset card | Each opens the right paper (they were Crossref-verified); no broken `<`/`>` in the URL |
| 19 | Click **Export methods summary (.md)** in the Guide tab | File downloads; open it and check the coverage table, intake answers, evidence list, rules, references |
| 20 | Open `WORKFLOW.md` from the guide header | Works over http; under `file://` the link may be inert (browser policy) — note which |

## 0.20.0 — per-step wizard questions

| # | Try | Watch for |
|---|---|---|
| 21 | Structure → ESMFold, then press the action | Primary button becomes *Predict with ESMFold* (with the ≤400 aa hint) and the generic *Attach / predict structure…* stays as a secondary button |
| 22 | Foldseek → pdb100, then press the action | Button names pdb100 **and** the Input Data modal's Foldseek dropdown is now pdb100 (the answer drives the control) |
| 23 | Topology → TMHMM | Action opens Options → Data Sources and scrolls to the paste box |
| 24 | Integrate → Construct design | Action jumps to the Workflow tab (command generator) |
| 25 | Re-click a selected option, then "reset answers" | First click clears that answer; reset clears all; both persist across reload |
| 26 | Set answers, then use the step anyway with the *generic* action | Nothing should be blocked or overwritten by having an answer set |

## 0.21.0 — removal + Undo

| # | Try | Watch for |
|---|---|---|
| 27 | Right-click a track → *Remove this track…* → Cancel | Nothing changes (no partial removal, no toast) |
| 28 | Remove an `HL_` row, then open the Homolog Templates table | The row is gone from the table too (no ghost hit) |
| 29 | Remove a `UP_` row, then remove the **last** one | After the last, the annotation step must read *not done* again (the fetch itself is cleared) |
| 30 | Remove one `TP_` row when 2+ sources exist | Only that source goes; the consensus is **rebuilt** from what remains |
| 31 | Remove `TP_Consensus` on its own | Consensus returns if ≥2 sources remain (it is derived) — confirm that is what you expect |
| 32 | Remove a `VAR_` row while HHR homologs also feed conservation | Conservation should survive if the HHR path still has input; if it does not, it must be *absent*, never an all-zero row |
| 33 | Remove a `RULE_` row | The rule **definition** disappears from the Rules panel too (it must not silently return on the next data change) |
| 34 | Remove the whole **Domains** type from the Tracks tab ✕, then re-run the scan | Clean re-add, no duplicate rows, no stale stats |
| 35 | Try to remove the AA row | Refused (no ✕ / no menu item); Reset Data is the only way |
| 36 | Remove something that a saved selection references, then click the saved selection | Should fail gracefully, not throw or select the wrong range |
| 37 | Undo the **sequence** step | Routes to Reset Data with confirmation; Cancel leaves everything intact |
| 38 | Undo Foldseek after also having HHpred hits | Only the Foldseek hits go |

## 0.22.0 — rule presets

| # | Try | Watch for |
|---|---|---|
| 39 | Open Presets with nothing loaded | All 8 cards list their `needs …` inputs; suggested ones (if any) sort first |
| 40 | Add *Topology contradiction* with no TM/DO/pLDDT data, then load the missing data | No row until the data exists, then the `RULE_` row appears by itself (re-evaluation) |
| 41 | Add a preset, edit it in the editor, re-open Presets | The preset card is unchanged (deep copy); the edited rule keeps its own values |
| 42 | Add the same preset twice | Second gets "(2)" in the name; both rows are independent |
| 43 | Build a rule in the editor using a **group** source (e.g. "Transmembrane (any of N)") | Matches if *any* TM track is annotated; re-run a predictor with a new key → still matches |
| 44 | Disable a rule | Its row disappears; re-enable → row returns |
| 45 | Make a rule that matches nothing | No empty row is added; the rule still appears in the list |
| 46 | Add a rule, then remove the track it queries | The stale row goes with it |

## 0.23.0 — TM cross-check + methods report

| # | Try | Watch for |
|---|---|---|
| 47 | Run the TM cross-check with topology + Quick2D TM loaded | `XC_TM` row appears in **Cross-checks**; the table shows counts, 1-based segment ranges, and a per-class *select* button |
| 48 | Click *select* on a disagreement class | Selects exactly those ranges in the viewer; count matches the table |
| 49 | Run it with 2+ topology sources | Header says "N-source consensus"; with one source it says "single topology source" |
| 50 | Run it with topology but **no** TM row (or vice versa) | Clear refusal message, no empty `XC_TM` row written |
| 51 | Run it twice, and after changing a topology source | Counts update; no duplicate `XC_TM` rows; removal of the row works like any other |
| 52 | Check the guide's read-out with both inputs present but no cross-check yet | It should warn about the disagreement count and name the action |
| 53 | Export the methods report with rules + cross-check + interfaces present | Sections appear in order; the TM cross-check section only appears if `XC_TM` exists |
| 54 | Export with nothing loaded | Refused with a message (no empty file) |
| 55 | Open the exported `.md` in a Markdown viewer | Table renders (pipes/headers), DOIs are links, no stray escaping |

## 0.24.0 — import line, FASTA start, UniProt lookup

Test this round with GFP as the reference system
(`sp|P42212|GFP_AEQVI Green fluorescent protein OS=Aequorea victoria GN=GFP`) — the
EBI Search query for it was verified live: bare `GFP_AEQVI` → 1 hit (P42212) in ~1 s.

| # | Try | Watch for |
|---|---|---|
| 56 | Open Input Data | The line under **Import** reads "Copy and paste data from MPI's Quick2D or FASTA." and *MPI's Quick2D* is a working link; *Paste Quick2D* and *Show raw text ▾* sit together as a pair |
| 57 | Paste a bare FASTA (`>sp\|P42212\|GFP_AEQVI GFP` + sequence) into *Show raw text* | A sequence-only session (AA row only), label taken from the header, success toast; no "unable to parse" error |
| 58 | Paste that same FASTA while a Quick2D dataset is loaded, then Cancel | Cancel must leave the existing session untouched |
| 59 | Paste a multi-record FASTA | Only the first record is used — confirm that is what you expect |
| 60 | Paste text that is neither (e.g. `hello world`) | Clear error, drawer stays open, nothing partially loaded |
| 61 | Load the GFP header, then open **Options → Data Sources** | Conservation/Topology are collapsed, UniProt is open, **Lookup Mode = Accession** with `P42212` pre-filled |
| 62 | Click a section summary (Conservation, Topology, UniProt) | Accordion opens/closes; only one open at a time is *not* enforced — check nothing looks broken if you open two |
| 63 | Load the GFP header, switch Lookup Mode to **Search**, and put the *whole header line* in the term box, then Fetch | Term is autocorrected to `GFP_AEQVI` (visible in the box afterwards), a top-right toast says "Autocorrected EBI Search to "GFP_AEQVI". Running in the background — you can leave this panel.", and the result row is `P42212 — GFP_AEQVI · gene GFP · Aequorea victoria` |
| 64 | Watch the progress line during the search | Names the mode, field and query, shows an estimate ("usually 1-5 s") and elapsed seconds; disappears or turns into "✓ N result(s)" when done |
| 65 | Search with a normal term (`myoglobin`, `terC`, `GFP`) | Left alone (no spurious "autocorrected" toast); sensible hits appear |
| 66 | Search **Any field** with `P42212` then with `GFP_AEQVI` | Both return the GFP entry — if either returns nothing, the field mapping regressed |
| 67 | Search Protein / Gene / Organism fields with `Green fluorescent protein` / `GFP` / `Aequorea victoria` | Each returns the GFP entry near the top (verified: 38 / 30 / 28 hits) |
| 68 | Fetch by Accession `P42212` | ~1 s; the progress line shows the estimate and elapsed time; `UP_` rows appear |
| 69 | Click a search result | Loads that accession's annotations; the result list is replaced/cleared sensibly |
| 70 | Turn the network off, then Fetch in each mode | Clean failure: status line clears, error toast, log entry — no spinner left running |
| 71 | Click **Find UniProt accession** from Input Data | Lands on Options → Data Sources with UniProt expanded and pre-filled; the toast names what it set |
| 72 | Fetch from the UniProt section, then close the Options modal mid-request | The request should still complete (or fail cleanly); re-opening shows the outcome — confirm nothing is left half-rendered |
| 73 | Type a header with no accession (`>GFP Aequorea victoria green fluorescent protein`) | Lookup defaults to **Search (protein)** with that name — check the term is sensible and the search finds GFP |

## 0.25.0 — task lockout, domain tooltips, step links, relevance, Foldseek, coachmarks

| # | Try | Watch for |
|---|---|---|
| 74 | Click **Scan domains (HMMER/Pfam)** twice, fast | Second click is refused; the button disables, shows a spinner and reads *Working…*; a top-right toast counts elapsed seconds and ends with "Added N Pfam domain track(s) from hmmscan (Xs)" |
| 75 | While hmmscan runs, look at the Input Data modal and the Guide's other task buttons | Every task button is disabled (HMMER, Foldseek, ESMFold) — nothing can start a second job |
| 76 | Press Scan with no sequence loaded | Refused with a message; the lock is **not** taken (no spinner left behind) |
| 77 | Toggle **External services** off, then press Scan | No task is started; the lock clears cleanly; toggling on and retrying works |
| 78 | Hover the ℹ on a `DM_` row (or its Track Control tooltip) | Names the family + description, says *Protein domain (Pfam, HMMER hmmscan)*, gives best i-Evalue/bit score, lists the spans and cites Pfam/HMMER — no blank "Structural Prediction" |
| 79 | Click the *MPI's HHpred* link in the Guide's homologs step | Opens the HHpred tool page; the topology step's TMHMM/Phobius/DeepTMHMM links likewise |
| 80 | Answer the membrane question **No**, then read the topology card | Chip says *not relevant*, the card explains why, coverage excludes it, and "Next:" never points at it |
| 81 | Answer **Not sure** | Topology is *optional* (not ruled out) — confirm that distinction reads clearly |
| 82 | Answer **Yes** after having answered No | The step becomes recommended again and rejoins the coverage count |
| 83 | With no structure attached, open the Foldseek step | The offered action is **Attach Structure(s)…**, with a hint explaining that Foldseek needs coordinates |
| 84 | Attach a PDB, then open the Foldseek step | The action becomes *Run Foldseek (<db>)*; the hint states "N attached, 1 used" |
| 85 | Attach two models, then run Foldseek | The running toast names the model actually searched and says "using 1 of 2 attached" — confirm that reads as intended rather than as a bug |
| 86 | From the Guide's Integrate step click **Open Analysis Rules…** | Jumps to Tracks; Tracks manager / Interfaces / Cross-checks collapse; Rules + Presets open; suggested presets get a highlight; banner says "…then **Return to Guide**" |
| 87 | Click **Return to Guide** | Returns to the Guide tab with the coachmark gone and the previously-open Tracks sections restored |
| 88 | Open the coachmark, then click the **Selection** or **Guide** sidebar tab | Coachmark clears (moving out of the submenu) and sections restore |
| 89 | Open the coachmark, then collapse the Rules section | Coachmark clears |
| 90 | Check a homolog row's default view (fresh session, or after Reset Data) | Rows show **AA letters**; TM still defaults to Bar; changing either persists across reload |
| 91 | Track Control → a homolog row → View as → Bar/Glyphs/AA | Each still switches correctly (the default changed, not the options) |

## 0.26.0 - layout, hover and copy polish

| # | Try | Watch for |
|---|---|---|
| 92 | Load a long sequence, zoom in until it scrolls sideways, hover a row, then scroll right | The row's hover band and background follow all the way to the last residue (this was the "doesn't adhere to the right" report) |
| 93 | Same, watching the pinned AA + residue-number block | Its background and bottom border span the full content width; the AA area must not look cut or duplicated mid-panel |
| 94 | Repeat with pLDDT/RSA in **graph** mode | Still aligned (that mode was already correct, so it must not regress) |
| 95 | Hover a residue, then move the mouse out of the grid / out of the window | The grey column highlight clears immediately; the cell tooltip goes with it |
| 96 | Hover a residue, then Alt+Tab away and back | Highlight is gone (window blur clears it) |
| 97 | Hover a residue and take a screenshot without moving the mouse | The highlight is *expected* while hovering; the bug was only that it survived leaving |
| 98 | Read every guide read-out line, toast, tooltip and panel | No em-dashes anywhere (they were swept; the harness fails if one returns) |
| 99 | Open the Guide tab fresh | "Protein Background" accordion is **open** while questions are unanswered |
| 100 | Answer all five questions | The accordion compresses itself to one line showing "5/5" |
| 101 | Click it back open, then reload | Re-opens for the session; after reload it is auto (open until complete) |
| 102 | Click "reset answers" inside it | Answers clear and the accordion reopens |
| 103 | Finish every step (or mark them done) | The Next card reads "**All steps covered** (N of M)." with no advice sentence |
| 104 | Check the homolog table and methods report for empty values | Placeholders render as `-` (not an em-dash) |

## 0.27.0 - guide focus, re-scan state, structure evidence, AlphaFold fetch

| # | Try | Watch for |
|---|---|---|
| 105 | Open the Guide with nothing loaded | The step named in "Next:" is highlighted (blue summary fill + border); only one step is highlighted |
| 106 | Complete that step | The highlight moves to the new "Next:" step |
| 107 | Run a domain scan, then look at the guide's annotation step | The button reads **Re-scan HMMER/Pfam** and is greyed (still clickable); the Input Data button reads "Re-scan domains (HMMER/Pfam)" |
| 108 | Re-scan | Replaces the DM_ rows rather than duplicating them; the timer toast runs again |
| 109 | With an accession loaded (e.g. GFP), set Structure to "AlphaFold DB" and press the action | Button says *Fetch AlphaFold model (P42212)*; the model downloads and attaches; pLDDT/RSA/3D become available |
| 110 | Same, with no accession at all | Falls back to *Predict with ESMFold* and explains that AlphaFold DB needs an accession |
| 111 | Press ESMFold (or AlphaFold) twice quickly | One job only; spinner + timer toast; the other task buttons are disabled |
| 112 | Force a network failure (devtools offline), then press ESMFold | Dismissible error naming the likely cause + the URL to test; the lock clears |
| 113 | Answer the structure question with each of the four options | Experimental offers attaching a file, Predicted offers the AlphaFold fetch, None offers ESMFold, Not sure falls back sensibly |
| 114 | Answer "Predicted only" and read the read-out | A caveat about fold-level claims appears (and does not appear for experimental) |
| 115 | Answer "None yet" and check the structure step | It is still **recommended**, never optional (structural homology depends on it) |
| 116 | Open the Foldseek step with no structure attached | Exactly one Attach Structure(s) button (this was duplicated) |
| 117 | Check the AlphaFold DB link/entry for a non-UniProt id (e.g. a made-up label) | Clear error saying the DB is keyed by UniProt accession, with ESMFold suggested |

## 0.28.0 - guide short form vs step card

| # | Try | Watch for |
|---|---|---|
| 118 | Load only a sequence, open the Guide | The "Next:" card asks the current step's **question** with its options inline (no repeated description) |
| 119 | Answer from the short form | It collapses to the tailored action + hint; the question is gone from the short form |
| 120 | Look at the step card below | The same question is still there with your answer selected (editable record) and the full description/citations |
| 121 | Change the answer in the step card | The short form's action + hint update to match (the two cannot disagree) |
| 122 | Answer "Not yet" for HHpred, then press the offered action | Opens the HHpred tool page; the card hints to attach the .hhr afterwards |
| 123 | Answer "Yes, ready to attach" | The card switches to Load .hhr / variant FASTA with attach guidance |
| 124 | Read the short form for a step with no sub-question | Falls back to the generic action + hint (no empty question block) |

## 0.29.0 - question/action separation + undo

| # | Try | Watch for |
|---|---|---|
| 125 | Open the Guide with an unanswered current question | The option pills are closed off by a dashed rule and an "or go straight to:" divider; the action buttons clearly sit below, not merged into the options |
| 126 | Answer it | The divider disappears and the tailored action + hint replace it |
| 127 | Look at the "Protein Background" intake with several questions | Each question is separated by a rule (label + options can't read as the next question) |
| 128 | Answer, then press **↺ Undo** in the short form | The question comes back, the generic action is offered again, and only that step's answer is cleared |
| 129 | Answer two different steps, then undo one | The other step's answer survives (check the step card still shows it selected) |
| 130 | Undo from the step card's "↺ Undo answer" | Same effect as the short-form undo |
| 131 | Undo, then reload | The cleared answer stays cleared |

## 0.31.0 - clipboard hand-off to external tools

| # | Try | Watch for |
|---|---|---|
| 132 | Load a sequence, answer "Not yet" for HHpred, press the offered action | HHpred opens in a new tab **and** a toast confirms the sequence was copied with the length; no popup-blocker warning |
| 133 | In HHpred, paste (Ctrl+V) into the sequence box | A valid FASTA with the loaded identifier as the header and 60-residue lines |
| 134 | Try it with the browser's clipboard permission denied | The tab still opens; the toast says the write was blocked and points at Show raw text |
| 135 | Press it with no sequence loaded | Refused with a message, and no tab opens |
| 136 | Use "Copy sequence (FASTA)" on the homologs step | Clipboard holds the FASTA (paste somewhere to confirm); no tab opens |
| 137 | Use "Download FASTA" | A `.fasta` file downloads, named from the protein label |
| 138 | Check a label containing spaces/pipes (e.g. the `sp|P42212|GFP_AEQVI ...` line) | Header is a single valid line, no stray newlines |
| 139 | Topology step → "None yet" → press the action | Same hand-off, opening DeepTMHMM |
| 140 | Open the app over `file://` and use a copy action | Clipboard still works (file:// is a secure context in Chrome/Firefox); if not, the fallback message appears |

## 0.32.0 - copy split from open (HHpred clipboard fix)

| # | Try | Watch for |
|---|---|---|
| 141 | Answer "Not yet" for HHpred | Two buttons: **Open HHpred ↗** and **Copy sequence** beside it; the description says to use Copy sequence first |
| 142 | Press **Copy sequence**, then paste anywhere | The full FASTA arrives (this was the broken case: the copy used to run after a tab stole focus) |
| 143 | Press **Open HHpred ↗** | Opens the tool; no clipboard interaction attempted |
| 144 | Copy, then paste into HHpred's sequence box and search | HHpred accepts it; the .hhr can then be attached back in Q2DV |
| 145 | Deny clipboard permission (or use a browser without the async API) | The fallback path still copies; if both fail the toast says to copy from Show raw text |
| 146 | Press **Copy sequence** with no sequence loaded | Refused with a message, nothing copied |
| 147 | Topology → "None yet" | Same pair (Open DeepTMHMM ↗ + Copy sequence) |
| 148 | Check the homologs step card | Copy sequence appears once (not duplicated by the step's own FASTA action) |

## Known gaps / already-suspect areas (don't be surprised)

- **Rules and manual removal interplay.** Removing a `RULE_` row deletes its rule; there is
  no "hide the rule row but keep the rule" concept.
- **`group:pLDDT` / `group:RSA` are not offered** as categorical sources (those tracks hold
  objects, not chars) — use the numeric `pLDDT:`/`RSA:` sources instead.
- **Older saves** (pre-0.23.0) have no `topologySources`/`uniprotFeatures`/`domainHitsInfo`,
  so a restored old session can still show the inconsistency in X1. Worth deciding whether
  to migrate or to warn.
- **3D viewer + removal** has not been reasoned through: removing a `_pLDDT`/`_RSA` row
  leaves the model attached, so the viewer may still color by a metric whose row is gone.
- **`prefers-reduced-motion`** is implemented as a blanket transition/animation reset; check
  it does not freeze something that relies on a transition to become visible.
- **HMMER/Foldseek/ESMFold are live services**: a failure there is not necessarily an app bug.
  The debug log (Options → Data Sources) is the place to look.

## Suggested order

1. X1–X7 (they catch the highest-severity class: state that disagrees with itself).
2. 27–38 (removal — most destructive, most likely to leave debris).
3. 13–26 (guide/wizard — most interactive).
4. 39–46 (rules/presets), then 47–55 (cross-check/report).
5. 56–73 (import/FASTA/lookup — test this round with GFP as the reference system).
6. 74–91 (task lockout, domain tooltips, relevance, Foldseek, coachmarks).
6b. 92–104 (layout/hover/copy polish - check 92/93 first, they are the reported bug).
6c. 105–117 (guide focus, re-scan state, structure evidence, AlphaFold/ESMFold).
6d. 118–124 (short form = questionnaire; check 118/119/121 together).
6e. 125–131 (question/action separation + undo).
6f. 132–140 (clipboard hand-off; 132/133 are the HHpred flow).
6g. 141–148 (copy split from open; 142 is the fixed copy).
7. 1–12 (design pass + HMMER) last, as they are the most self-contained.
