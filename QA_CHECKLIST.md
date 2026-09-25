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
6. 1–12 (design pass + HMMER) last, as they are the most self-contained.
