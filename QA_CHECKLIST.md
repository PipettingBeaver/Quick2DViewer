# Q2DV — QA checklist for the current development session (v0.16.0 → v0.50.1)

**Read this first.** Every item below has automated coverage in `npm test` (753 checks),
but that harness runs the app script against a **stubbed DOM**: it never renders a
pixel, never lays anything out, never fires a real browser event, and it *replaces*
`renderViewer` with a no-op for speed (one check restores the real renderer just to
count render calls, so a nested re-render cannot sneak back in). So treat **all UI
behaviour as unverified** until you have driven it by hand. The list is written for
trying to break things, not for confirming they work — each row says what to do and
what would count as a bug.

**Current pass (0.50.1).** Start with rows 273–277 (the duplicate viewport that was
reported and fixed) and the two live OPEN items under *Known gaps*; then follow the
*Suggested order* at the bottom.

## Feature test cards (newest first)

**Convention, going forward: every new feature ships with a card here.** The per-version
tables further down are quick "try this, watch for that" rows; a card is the fuller form
for a feature that is *entirely* unverified, and it has three parts:

- **Should do** — one sentence: the behaviour in normal use.
- **Try** — the normal-use walkthrough, each step with the result you expect. If a step
  doesn't produce the expected result, that's the bug report.
- **Edge cases** — the specific ways it is likely to break, each with the symptom and the
  most likely cause, so a failure points at a diagnosis rather than a mystery.

Cards stay until the feature has been driven by hand at least once.

---

### Homolog search with phmmer — 0.52.0

**Should do.** With a protein sequence loaded, one click searches Swiss-Prot with HMMER phmmer
(EBI) and adds one Homologs row per significant hit, feeding conservation, the match-quality
colouring and the predictor tooltips without needing an external HHpred run.

**Try (normal use).**
1. Load a well-known protein (GFP works well), then Analyze → **Search Homologs (phmmer)…**
   *Expect:* a status line counts up while the job runs (usually under a minute), then the
   Homologs rows appear under the existing tracks, numbered from #1 (or after any .hhr rows).
2. Look at the first row.
   *Expect:* a solid band of teal `=`/`|` glyphs for a close homolog; the ℹ tooltip says
   "phmmer homolog", with E-value, score, identity and aligned columns, citing HMMER phmmer.
3. Run it again with the Conservation row visible.
   *Expect:* new rows continue the numbering (no overwrite), and Conservation is recomputed from
   all homolog sequences when "Include HHR homolog sequences" is on.
4. Guide → homolog step, answer "No" to the HHpred question.
   *Expect:* the step offers "Search homologs (phmmer)" next to the HHpred route.

**Edge cases (symptom → likely cause).**
- Hits below HMMER's inclusion threshold do not get rows. Expected: the domain scan treats `?`
  domains the same way; only HMMER-significant hits are imported.
- A very short or low-complexity sequence returns no hits. Expected: nothing to import; the status
  line says so and no rows are added (not a bug).
- The E-value cut-off is the provider's `E=1e-3` parameter (Options → Data Sources shows the
  capability); changing it changes how many hits are reported.
- Live-service failures (queue full, network) surface in the status line and the Debugging
  console; that is not an app bug.

---

### Empty rules in the rules list — 0.51.0

**Should do.** A rule that currently marks no residue is greyed and tagged "(Empty)" in the
Tracks tab's rules list, with a tooltip saying why, so a rule that silently does nothing reads as
"no matches here" instead of looking broken.

**Try (normal use).**
1. Load a protein with conservation, then Tracks → Rules → add "Conserved buried residue" with no
   structure attached.
   *Expect:* the rule row is greyed, tagged "(Empty)", and its tooltip says "No matches: needs
   RSA (any model)".
2. Attach a structure (the RSA track appears) with the Tracks tab open.
   *Expect:* the marker clears as soon as residues match; a matching rule is never greyed.
3. Remove a track a rule depends on.
   *Expect:* the rule greys and tags itself again without switching tabs.

**Edge cases (symptom → likely cause).**
- A disabled rule that matches residues is not marked empty. By design: the marker is about
  matches, not visibility - the ○ toggle already shows the track is off.
- Every numeric rule is greyed after loading a bare FASTA. Expected: no sources are loaded yet;
  each tooltip names what that rule needs.
- The marker looks stale after a data change while another tab is open. The list refreshes when
  you switch back to Tracks; the marker is computed, not stored.

---

### Ensemble variance (RMSF) — 0.34.0

**Should do.** Given two or more attached models of the same construct, measure how much
each residue moves across them (in angstroms) after removing the rigid-body difference,
and add an *Ensemble variance* row plus a summary of which models were compared and which
residues are most mobile.

**Try (normal use).**
1. Attach two models of the same protein (e.g. an AlphaFold model and an ESMFold
   prediction), then **Tracks → Ensemble variance (RMSF)**.
   *Expect:* one checkbox per attached model, all ticked.
2. Press **Compute variance**.
   *Expect:* a status line "Ensemble variance over 2 models: mean RMSF x.xx A, max y.yy A
   (N residues covered)"; a new **Ensemble variance** row appears near the bottom of the
   viewer (below Cross-checks), mostly blue with warmer colours at loops and termini; a
   table listing each model's chain, residue count and RMSD to the first.
3. Hover a warm residue.
   *Expect:* "Residue 148 RMSF: 3.21 A across the ensemble".
4. Press **Select mobile (RMSF ≥ 3 A)**.
   *Expect:* the selection jumps to those ranges, with a toast naming the count.
5. Build a rule with the RMSF source (Analyze → Analysis Rules → new, source
   "RMSF (A)") combined with, say, *Disorder annotated*.
   *Expect:* matches only where both hold; the rule row appears as usual.

**Edge cases (symptom → likely cause).**
- **Two copies of the same model give non-zero RMSF.** The superposition is broken — this
  is the sharpest diagnostic, because a rigid body must fit exactly.
- **A model moved or rotated (same shape, different frame) gives non-zero RMSF.** Same
  cause, one step stronger: this is the case the Kabsch step exists to handle.
- **Only one model attached.** *Expect* a refusal ("Select at least two models…"), not a
  crash or an empty row.
- **The row is mostly neutral grey.** Those residues were covered by fewer than two models
  (their tooltip says "not covered by enough models"). Models are matched by their own
  residue numbering, so a crystal structure numbered differently from your sequence will
  cover the wrong range or none.
- **A partial model (domain-only) leaves most of the row blank.** Expected: only the
  modelled range can carry values.
- **A multi-chain model only reports one chain.** Expected: the largest chain is used, and
  the summary table names it.
- **The top-8 "most mobile" list is all termini.** Check whether those termini are modelled
  at all; a partly-modelled terminus is a modelling artefact, not flexibility.
- **Numbers look smaller than the visible displacement.** RMSF is measured about the
  ensemble *mean*, and the optimal fit redistributes a single displacement across the whole
  set — a 2 Å move by one residue in a small toy reads ≈0.45 Å, less in a real protein.
  Compare residues *within* the row (and the top-8 list) rather than expecting half the
  displacement.
- **The row is missing after Compute.** It may be hidden: check the Tracks tab / Track
  Control for the **Ensemble variance** group (a saved hide state persists).
- **The row survives a reload but the numbers are stale after adding a model.** Expected:
  the row is a snapshot; press Compute again. The model *list* refreshes when the section
  is opened.

---

### Co-localization table — 0.35.0

**Should do.** Tabulate, for the current selection or for a rule's matches, every metric
that applies to each residue side by side: conservation, pLDDT, RSA, ensemble RMSF, the
annotation types present, and which cofactors that residue sits near.

**Try (normal use).**
1. Select a residue range, then **Analyze → Data & Structures**, and look at the
   **Co-localization** section.
   *Expect:* one row per residue, metrics in columns, footer "N residue(s) from the
   current selection".
2. Change the source picker to a rule (if any exist).
   *Expect:* the table re-renders with exactly that rule's matches, and the footer names
   the rule.
3. With two models and an ensemble RMSF row present.
   *Expect:* the RMSF column is filled; without that row it reads "-".
4. With a ligand-bearing structure attached (e.g. a heme protein).
   *Expect:* residues in that cofactor's neighbour shell name it in the last column.
5. Open the modal with nothing selected.
   *Expect:* "Nothing to tabulate yet: make a selection (or pick a rule that matches)
   first."

**Edge cases (symptom → likely cause).**
- **A whole metric column is "-".** That metric has no data: no CONSERVATION row, no
  attached model (pLDDT/RSA), or the variance has not been computed (RMSF).
- **The cofactor column is empty for a structure that clearly has a ligand.** The
  neighbour shell is computed once, at attach time, with a distance cutoff — check the
  **Structure Files** table lists the cofactor for that file. Re-attaching the file
  recomputes it.
- **More than 300 residues selected.** By design the table shows the first 300 with a
  note; narrow the selection or use a rule to get a smaller set.
- **The rule is missing from the source picker.** There are no rules yet, or the modal
  was opened before the rule was created — reopen the modal (the picker syncs on open).
- **"Homologs" or "Variants" appear in the Types column.** Expected: any track annotated
  at that residue contributes its type, including imported ones.
- **The table looks stale after loading new data.** It rebuilds when the modal opens or
  the source changes; press **Build table** to force it.

---

### Construct designer (truncated FASTA) — 0.36.0

**Should do.** Turn the annotations into a wet-lab construct: trim the disordered termini
(only terminal stretches of at least N residues) or keep the current selection, then
export or copy the construct as FASTA.

**Try (normal use).**
1. Load a sequence with Quick2D disorder output, then **Workflow → Construct designer**.
   *Expect:* a status line "Construct: residues X-Y (N aa). Trimmed A N-terminal and B
   C-terminal residue(s) (runs of at least 5 disordered residues)." and the FASTA in a box.
2. Lower **Min disordered run** to 2 and press **Preview**.
   *Expect:* more is trimmed (both termini, if both are disordered).
3. Untick **N-term**.
   *Expect:* the start returns to residue 1.
4. Switch **Mode** to *Keep the current selection*, with a range selected in the viewer.
   *Expect:* the construct is exactly that range; the status reports the trimmed counts.
5. **Download FASTA** then **Copy FASTA**.
   *Expect:* the file is named `<label>_<start>-<end>_disorder-trimmed.fasta` and the
   clipboard holds the same text.

**Edge cases (symptom → likely cause).**
- **"No disorder track is loaded…"** — no `DO_` row is present. Load Quick2D disorder
  output, or use selection mode.
- **"Every residue is predicted disordered…"** — there is no ordered core to keep; the
  design refuses rather than emitting a whole-sequence "construct".
- **A short disordered tail is not trimmed.** Expected: the threshold is the point — a
  4-residue tail at minRun 5 is deliberately left alone.
- **Selection mode with nothing selected is refused.** Make a selection first (or switch
  back to disorder mode).
- **"Trimming would leave fewer than N residues."** Raise the threshold or untick an end.
- **The preview looks stale after loading new data.** It refreshes when the section is
  opened or **Preview** is pressed; nothing is recomputed in the background.
- **The header looks mangled for a `sp|...|...` label.** Expected: the header is
  sanitised to `[A-Za-z0-9._-]` so it stays a valid single-line FASTA header.
- **Trimmed residues are reported as counts, not sequences.** The full sequence is still
  in the viewer and the FASTA Segment panel if you need to inspect what was removed.

---

### Ensemble RMSF line plot — 0.37.0

**Should do.** Render the ensemble variance as a **line plot** (auto-scaled Y axis in Å)
instead of a heatmap row, through the same graph machinery as pLDDT/RSA — so selection,
hover, the legend, export and persistence all behave identically to the existing graphs.

**Try (normal use).**
1. Compute the variance (Tracks → Ensemble variance → Compute), then set that type's
   View as = **Graph** (Track Control → Ensemble variance → Graph, or View → *Toggle
   Ensemble RMSF graph*).
   *Expect:* the heatmap row is replaced by a section titled "Ensemble variance (RMSF)",
   with a Y axis labelled **RMSF (A)**, ticks at whole-Å steps, and the line in the model
   colour.
2. Hover a point.
   *Expect:* the shared cell tooltip names the residue and the value, and the grey column
   highlight follows the cursor as it does over the heatmap.
3. Click or drag on the graph.
   *Expect:* the selection behaves exactly as in the heatmap — the points carry the same
   `col-<idx>` classes, so the existing selection/hover/column machinery drives them.
4. Show the legend.
   *Expect:* an "RMSF:" row with the five colour bands appears (only while graph mode is on).
5. Export → SVG and PNG, then Export → TSV/CSV.
   *Expect:* the graph section serializes like the other graphs; the metrics row is labelled
   **RMSF (A)** with the mean and the % mobile (≥ 3 Å).
6. Reload the page.
   *Expect:* the graph mode persists per type.

**Edge cases (symptom → likely cause).**
- **The Y axis max looks arbitrary** (e.g. 3 when the data max is 2.4). By design: auto-max
  rounds up to the next whole Å, minimum 1.
- **The line has gaps.** Uncovered residues (null value) break the line — that is "no data",
  not zero. Compute over more models to fill it in.
- **The line is flat along the bottom.** With one model there is no fluctuation to plot;
  RMSF needs at least two.
- **Toggling the graph seems to remove the row.** It is *replaced* by the graph section, not
  hidden. Switch View as back to Glyphs to restore the heatmap row.
- **The legend has no RMSF row.** The row is tied to graph mode *and* the legend must be
  shown (View → Legend).
- **A single model's name appears in the metrics export.** Expected: the export lists one row
  per structural key, and the ensemble row is one key.

---

### Empty-track marking — 0.38.0

**Should do.** A track that imported successfully but found nothing (a TM row for a soluble
protein, say) stays visible, greyed slightly, with an **(Empty)** tag, so it reads as "ran,
found nothing" rather than looking like data or a broken import.

**Try (normal use).**
1. Load the Quick2D output for a soluble protein (GFP) that includes a TM track.
   *Expect:* the TM row is drawn at ~55% opacity with "(Empty)" after its name; its tooltip
   explains that nothing was annotated.
2. Open the Tracks tab.
   *Expect:* the same track shows "(Empty)" in the manager list.
3. Answer **Yes** to the membrane question with that dataset.
   *Expect:* the read-out warns that every transmembrane prediction came back empty.

**Edge cases (symptom → likely cause).**
- **A populated track is greyed.** `isTrackEmpty` treats any non-blank character as data; a
  track holding only spaces/tabs/dashes is the empty case. Report it if a real track trips this.
- **The AA row never gets the tag.** By design — it is the reference sequence, not a prediction.
- **A pLDDT/RSA/RMSF row is marked empty when the model covers nothing.** Correct: those rows
  are object arrays and count as empty only when every entry has a null value.
- **No warning for the empty TM row.** It only fires when the membrane answer is *Yes*; with
  *No* (or unanswered) an empty TM row is expected and stays quiet.
- **The greying is too subtle / too strong.** It is one CSS rule (`.track-row.track-empty`).

---

### Debugging console (action log) — 0.38.0

**Should do.** Record the last 200 actions of the session (clicks, menu choices, task
starts/finishes, imports, attaches, removals, exports) so a workflow can be reconstructed,
with the log copyable as text or JSON.

**Try (normal use).**
1. Do a few things — open a menu, run a task, export something — then **Help → Debugging
   console**.
   *Expect:* the newest action at the top with a timestamp and kind; buttons to Copy log,
   Copy as JSON and Clear.
2. Press **Copy as JSON** and paste into an editor.
   *Expect:* an array of `{t, kind, label, detail}` objects.
3. In the browser console, run `q2dvActions()`.
   *Expect:* the same JSON.
4. Reload the page and reopen the console.
   *Expect:* empty (the log is deliberately session-only, not saved).

**Edge cases (symptom → likely cause).**
- **A click is missing from the log.** Only clicks landing on a `button`, `a`,
  `[role="button"]` or `[onclick]` element are captured; a click on a bare cell or a label is
  not an action.
- **The log stops growing past 200 entries.** By design; the oldest are dropped first.
- **The browser console only shows some entries.** Meaningful events (menu, task, export,
  import, remove, attach) are mirrored to the console; raw clicks are not, so a user clicking
  around does not flood the console.
- **The log looks empty after reload.** Expected: session-only, never persisted and never sent.
- **Entries look truncated.** Labels cap at 120 characters and details at 200, so one action
  cannot blow up the log.

---

### Track Control: the Color column — 0.39.0

**Should do.** Let a type's per-residue *colour meaning* be chosen in Track Control, between
View as and Config. Homologs: **Match quality** (default) / **Conservation** / **Residue type**.

**Try (normal use).**
1. Load an `.hhr` with several homologs, then open Track Control.
   *Expect:* a **Color** column header between *View as* and *Config*; the Homologs row has a
   selector reading "Match quality"; other types show a dash.
2. Look at one column down the homolog rows.
   *Expect (Match quality):* the colours differ per row — that is the per-homolog match-quality
   encoding, not noise.
3. Switch the Homologs Color to **Conservation**.
   *Expect:* the column becomes one colour across every row (the conservation band), and the
   rows show letters.
4. Switch to **Residue type**.
   *Expect:* each letter takes a chemistry colour, identical for the same residue in any row or
   column; rows show letters.
5. Reload.
   *Expect:* the mode persists.
6. Open the type's **Config** frame.
   *Expect:* no colour checkbox; a note pointing at the Color column.

**Edge cases (symptom → likely cause).**
- **A dash in the Color column.** That type has a single colour mode, so there is nothing to
  choose (by design, rather than offering a fake option).
- **Choosing Bar then returning to Glyphs.** The colour choice survives — the mode is
  independent of the view.
- **Conservation mode looks like match quality.** With no conservation data the band is null,
  so the row falls back to the match-quality colour. Check the Conservation row exists.
- **Residue mode shows no letters.** It should force letters; if not, the template sequence may
  be missing (older saves) — it then colours by the reference AA.
- **A pre-0.39.0 session with "Cons. colors" on.** It reads as Conservation mode.
- **An unknown letter (X, gaps).** No residue colour, so the match-quality colour shows through.

---

### Declared oligomeric state — 0.41.0 / 0.42.0

**Should do.** Let a sequence-only session (FASTA or Quick2D) declare its oligomeric state, so
the biology is recorded, the interface step knows what to expect, **and the exports and
structure generators carry it** — previously the state could only be *inferred* from attached
structures, and every export was silently a single chain.

**Try (normal use).**
1. Guide → **Protein Background**.
   *Expect:* a sixth question, "What is its oligomeric state?", with Monomer / Homodimer /
   Homotrimer / Homotetramer or larger / Hetero-oligomer / Unknown.
2. Answer **Homotrimer** with no structure attached.
   *Expect:* no claim about interfaces yet (nothing to compare), and the methods summary
   records "Homotrimer".
3. Attach a **single-chain** model.
   *Expect:* the read-out warns *"You declared a homotrimer, but the attached model has a
   single chain. Interface analysis needs a multi-chain model, so predict or attach the
   assembly."*
4. Attach a **dimer** model instead.
   *Expect:* *"…the largest attached model has only 2 chains. That is a partial assembly…"*
5. Attach a **trimer** model.
   *Expect:* *"Declared homotrimer; an attached model has 3 chains, so the interface analysis
   can be run on it."*
6. Answer **Monomer** with a multimer attached.
   *Expect:* an info line asking whether that assembly is biological or a crystallographic
   artefact.
7. Set Integrate → goal = *Binding interface*.
   *Expect:* the hint names the declared state, and the interface panel shows
   "Declared: Homotrimer".

8. Export the sequence (**Copy sequence (FASTA)** / **Download FASTA**) with a multimer declared.
   *Expect:* the header ends with the state, e.g. `>sp|P42212|GFP_AEVI_homotrimer` — so HHpred or
   a colleague does not read it as one chain.
9. Press **Predict with ESMFold** (or **Fetch AlphaFold model**) with a multimer declared.
   *Expect:* the hint warns *before* the click, and the status/toast afterwards says the model is
   a single chain and that an assembly is needed for the interface step.
10. Paste a FASTA whose header says `A:A:A`, or one that repeats the same record three times.
   *Expect:* the intake question fills itself in as Homotrimer (a toast says what was read), the
   viewer still shows **one** chain, and the export header then carries `_homotrimer`.

**Edge cases (symptom → likely cause).**
- **A detected state overwrote your answer.** It should not: detection only fills an *unanswered*
  question (and "Unknown" counts as unanswered). If it ever overwrites an explicit answer, that
  is the bug.
- **A FASTA with different records sets nothing.** Only identical repeats are inferred; differing
  chains are too easy to get wrong, so the question stays open.
- **A prose label was read as stoichiometry.** The token pattern needs an identical short token
  joined by colons with no spaces (`A:A:A`); report the label if it tripped.
- **No answer → no comment anywhere.** The parameter is optional; only a declared state is
  compared against the coordinates.
- **"Unknown" is recorded but never compared.** It implies no chain count, so there is nothing
  to check — that is deliberate.
- **The claim and the model differ by count.** You get the *partial assembly* warning, not the
  hard one; only fewer than two chains blocks interface analysis entirely.
- **A model whose chains cannot be read.** No comparison happens (the file is skipped), so no
  warning either way.
- **The methods report says "Unknown".** Expected: it records whatever was answered.

---

### Experimental biological assembly import — 0.43.0

**Should do.** Import a real multimer model when one exists experimentally: give a PDB id and
fetch RCSB's biological assembly file, which contains the assembly's chains — so the interface
step has something to work on, instead of the declaration only producing a warning.

**Try (normal use).**
1. Declare a homotrimer with no multimer model attached.
   *Expect:* the Guide's structure step offers **Attach an experimental assembly…**, the read-out
   points at the same route, and Analyze → Interfaces shows the id/assembly inputs.
2. In Analyze → Interfaces, enter a known trimer's id (**1TNF**) and press **Attach assembly**.
   *Expect:* `1TNF.pdb1` downloads and attaches as `RCSB_1TNF_assembly1.pdb`; the status reads
   "(3 chains). Compute interfaces on it."
3. Press **Compute interfaces**.
   *Expect:* `IF_` tracks per chain, exactly as with any multi-chain model.
4. Check the Data modal → Structure Files.
   *Expect:* the assembly is listed, with its oligomeric state inferred from the chain count.
5. Enter a valid-format id that has no assembly (or a bogus one).
   *Expect:* a dismissible error saying a multimer would then have to be predicted outside Q2DV.

**Edge cases (symptom → likely cause).**
- **A malformed id** (`tnf`, `1TN`) is refused *before* any network call.
- **"Could not fetch assembly …"** — the entry has no biological assembly, or the id is wrong;
  the message names the external options (AlphaFold-Multimer, ColabFold, AF Server).
- **A novel sequence with no PDB entry** — there is nothing to import; that is the honest answer,
  and the reason the declaration produces a caveat rather than a model.
- **The status says "It has one chain, so it is not a multimer"** — the file fetched fine but is
  not an assembly (some entries' assembly 1 is the asymmetric unit).
- **Assembly 2 or 3** — use the number field (`{id}.pdb2`).
- **The Guide's offer vanishes after attaching a multimer** — by design; it only appears when the
  declared assembly has no multimer model.
- **The id box pre-fills with a homolog's PDB id** — taken from the first hit that has one; it is
  editable.

---

### Characterizing an unresolved fold — 0.45.0

**Should do.** Give the closing-goal question a characterization route, so a protein whose
fold/family is unresolved has an obvious first move — and name that state in the read-out while
nothing has placed the sequence.

**Try (normal use).**
1. Guide → Integrate → answer **Characterizing an unresolved fold**.
   *Expect:* with **no** structure attached the action is **Scan HMMER/Pfam** ("the domain
   architecture is the first evidence, then predict or attach a model so Foldseek can search it");
   with a model attached it is **Run Foldseek (fold assignment)**.
2. Run it, then read the read-out.
   *Expect:* the "fold is unplaced" line disappears once a **Pfam family** or a **Foldseek** hit
   exists. A sequence homolog (HHpred) alone does *not* clear it.
3. With nothing loaded.
   *Expect:* "No Pfam family and no structural relative are assigned yet, so the fold is unplaced.
   The Pfam scan … and a Foldseek search are the two routes that place it."

**Edge cases (symptom → likely cause).**
- **The line stays after a Pfam scan.** Correct: that scan found no family, so nothing placed the
  fold. The scan's own status says whether it found significant domains.
- **An HHpred hit does not clear it.** By design — sequence homology is not a fold assignment;
  only a Pfam family or a structural relative counts.
- **The Foldseek action refuses.** It needs an attached model (that is why the route changes when
  one is present) and a structure database selected in the foldseek step.
- **A partially determined model.** The read-out already covers model confidence (pLDDT) and
  ensemble disagreement (RMSF); this route adds the family/relative question on top.
- **What this is not:** the app cannot determine a fold *de novo* — it places one by homology
  (curated family, profile search, or structural relative). An unresolved fold with no relatives
  anywhere stays unresolved, and the methods summary will say so.

---

### Uniform hover framework (every track) — 0.50.0

**Should do.** Every track — predictions, annotations, the reference row, the residue-position
markers, and graph points — explains itself on hover with the *same* styled tooltip: a colour
swatch, the track name and its provenance, and the residue detail.

**Try (normal use).**
1. Hover a residue in **any** row: SS, TM, disorder, coiled-coil, signal, homolog, variant,
   UniProt, topology, rule, interface, domain, pLDDT/RSA/RMSF.
   *Expect:* the styled tooltip with the swatch, "Track [Source]" and the residue text — for
   **every** row, not just the ones that already had rich titles.
2. Hover a **blank** prediction cell.
   *Expect:* "Residue N: not annotated in &lt;track&gt;".
3. Hover the **reference (AA)** row, and the residue numbers above it.
   *Expect:* "Residue N: &lt;letter&gt;" and "Residue N" — every marker hovers now, not just the
   labelled ones.
4. Show a type as a **graph** and hover a plotted point.
   *Expect:* the same styled tooltip (swatch from the point's colour, track header, point value);
   the browser's own tooltip is suppressed while it shows.

**Edge cases (symptom → likely cause).**
- **A letter that is both a residue and a structure code** (C, H, P, E, M, D, S). On a
  *prediction* row it reads as the meaning ("C (coil)"); on the *reference* row those letters are
  residues and get no meaning — that asymmetry is deliberate.
- **A graph point with no tooltip.** Points hidden by the model pills have no circles at all
  (expected); a visible point with no text means its `<title>` was not written.
- **A native SVG tooltip appearing *as well*.** The styled tooltip removes the `<title>` child while
  it shows and restores it on leave; seeing both means the restore path fired early.
- **A cell with no tooltip at all.** Every cell now carries a title — a gap means a new row type was
  added without one (or without falling through to the generic title).

---

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

## 0.33.0 - Phase 1 loose ends (variant FASTA panel, 3D scheme)

| # | Try | Watch for |
|---|---|---|
| 149 | Select a Variant (`VAR_`) row | The FASTA Segment section shows "Variant sequence (name)" with the aligned sequence; **Copy Variant** becomes enabled |
| 150 | Select a residue range on that variant row | The panel narrows to just that segment |
| 151 | Press **Copy Variant** | The aligned sequence lands on the clipboard |
| 152 | Select a Homolog row, then a Variant row, then a normal row | Each swap shows/hides the right panel and disables the other's button |
| 153 | Colour the 3D view by conservation, then remove the CONSERVATION row | The colour resets to the default and the toolbar no longer says "conservation" |
| 154 | Remove a pLDDT/RSA row with the 3D viewer open | The model stays attached and still renders (removing the row does not detach the model) |
| 155 | Remove a graph-mode row, then re-open the graph | No stale highlight state for the removed key |

## 0.34.0 - ensemble variance (RMSF)

| # | Try | Watch for |
|---|---|---|
| 156 | Attach two models of the same protein, then Tracks -> Ensemble variance -> Compute | An **Ensemble variance** row appears; the status reports the model count, mean and max RMSF in A |
| 157 | Attach two *identical* files (or the same model twice) | Every residue reports ~0.00 A (a rigid-body difference must be removed before measuring) |
| 158 | Attach a model and a copy moved/rotated (e.g. re-exported from another tool) | Still ~0.00 A: the superposition cancels the rigid-body difference. Non-zero here means the Kabsch step regressed |
| 159 | Attach a genuinely different model (a homolog, or a partially disordered prediction) | The mobile regions light up (orange/red); the rigid core stays blue |
| 160 | Check the summary table | Per-model chain, residue count and RMSD-to-first; the eight most mobile residues listed |
| 161 | Press **Select mobile (RMSF >= 3 A)** | Selects exactly the residues at or above 3 A |
| 162 | Try it with one model / no models / models that share almost nothing | Clear refusal message, nothing written |
| 163 | Build a rule with the RMSF source (e.g. RMSF >= 3 AND Disorder annotated) | Works like any numeric source |
| 164 | Remove the Ensemble variance row | Goes like any other row (recomputable via Compute) |
| 165 | Show the legend and scroll the grid sideways at the bottom | The legend no longer overlaps the horizontal scrollbar (raised 20 px) |
| 166 | Open the Ensemble section | The model list is populated with one checkbox per attached model, all ticked |

## 0.35.0 - co-localization table (quick rows)

| # | Try | Watch for |
|---|---|---|
| 167 | Select a range, open Analyze → Data & Structures | The Co-localization table lists one row per residue with metrics and the selection footer |
| 168 | Switch the source to a rule | Re-renders with that rule's matches; footer names the rule |
| 169 | Check the RMSF column with/without a computed variance | Filled when `EV_RMSF` exists, "-" otherwise |
| 170 | Attach a ligand-bearing structure and look at the last column | Residues in the cofactor's neighbour shell name it |
| 171 | Open with nothing selected | "Nothing to tabulate yet…" hint, no empty table |
| 172 | Select more than 300 residues | Capped at 300 with a note |

## 0.36.0 - construct designer + guide taxonomy (quick rows)

| # | Try | Watch for |
|---|---|---|
| 173 | Workflow → Construct designer with disorder data | Status line names the kept range, the trimmed counts and the threshold; FASTA preview appears |
| 174 | Change Min disordered run / untick an end | The preview updates to match |
| 175 | Selection mode with a viewer selection | The construct is exactly the selection |
| 176 | Download / Copy FASTA | `label_start-end_disorder-trimmed.fasta`; clipboard holds the same text |
| 177 | Integrate step in the Guide | Offers Co-localization table, Methods summary and Construct FASTA actions |
| 178 | Structure step with two models attached | Offers Compute ensemble variance; the read-out reports the spread once computed |

## 0.37.0 - RMSF line plot (quick rows)

| # | Try | Watch for |
|---|---|---|
| 179 | Track Control → Ensemble variance → View as → Graph | The heatmap row becomes a line plot with an "RMSF (A)" axis and whole-Å ticks |
| 180 | View → Toggle Ensemble RMSF graph | Same toggle from the menu; persists across reload |
| 181 | Hover / drag on the plot | Shared tooltip + grey column highlight + drag selection behave as in the heatmap |
| 182 | Show the legend in graph mode | An "RMSF:" row with five colour bands appears (hidden otherwise) |
| 183 | Export SVG/PNG then TSV/CSV | The plot serializes; the metrics row reads "RMSF (A)" with the mean and % mobile |
| 184 | Switch back to Glyphs | The heatmap row returns |

## 0.38.0 - empty tracks, duplicate button, debugging console (quick rows)

| # | Try | Watch for |
|---|---|---|
| 185 | Load GFP Quick2D output with a TM track | The TM row is greyed with "(Empty)"; the Tracks tab shows it too |
| 186 | Answer Yes to membrane with that dataset | The read-out warns that every TM prediction was empty |
| 187 | Foldseek step: choose pdb100 | Exactly one action button, labelled "Run Foldseek (pdb100)" (no duplicate) |
| 188 | Do a few actions, then Help → Debugging console | Newest first, with kinds and timestamps; Copy log / Copy as JSON / Clear work |
| 189 | Run `q2dvActions()` in the browser console | The same log as JSON |
| 190 | Reload and reopen the console | Empty (session-only by design) |

## 0.39.0 - Track Control Color column (quick rows)

| # | Try | Watch for |
|---|---|---|
| 191 | Open Track Control with homologs loaded | A **Color** column sits between View as and Config; Homologs offers three modes, other types show a dash |
| 192 | Switch Homologs to Conservation | A column becomes one colour across rows; rows show letters |
| 193 | Switch to Residue type | Same letter = same colour in every row/column |
| 194 | Reload after choosing a mode | The mode persists |
| 195 | Choose Bar, then Glyphs | The colour mode survives |
| 196 | Open the homolog Config frame | No colour checkbox; a note points at the Color column |

## 0.39.1 - Track Control width + config hints (quick rows)

| # | Try | Watch for |
|---|---|---|
| 197 | Open Track Control | Full category names (no truncation); the popover is noticeably wider |
| 198 | Look at the Config column | Just the gear, no "(Conservation)"-style hint text beside it |
| 199 | Hover a gear | Tooltip reads "Config for <type>" |
| 200 | Open Track Control near the right edge of a narrow window | The popover clamps to the viewport rather than overflowing |

## 0.40.0 - HHR homologs included in conservation by default (quick rows)

| # | Try | Watch for |
|---|---|---|
| 201 | Load a Quick2D dataset + an `.hhr`, with **no** variant FASTA | A Conservation row appears (previously none, because the homologs were excluded) |
| 202 | Open Options → Conservation Scoring | "Include HHR homolog sequences in the tallies" is ticked on a fresh session |
| 203 | Untick it, then reload | Stays off (a deliberate opt-out is respected) |
| 204 | Clear `localStorage`, load an `.hhr` | Ticked again (the new default) |
| 205 | Load variant FASTA + `.hhr` together | The tallies use both; the methods summary says "(incl. HHR homologs)" |
| 206 | Import Foldseek hits | They do **not** join the conservation tallies (by design: the option says HHR) |
| 207 | Reset Data | The option returns to on |

## 0.41.0 - declared oligomeric state (quick rows)

| # | Try | Watch for |
|---|---|---|
| 208 | Guide → Protein Background | A sixth question, "What is its oligomeric state?", with six options |
| 209 | Declare Homotrimer, attach a single-chain model | Read-out warns that interfaces need a multimer |
| 210 | Attach a dimer instead | "partial assembly" warning, not the hard one |
| 211 | Attach a trimer | "can be run on it" |
| 212 | Declare Monomer with a multimer attached | Info line about biological vs crystallographic |
| 213 | Set Integrate → Binding interface | Hint names the declared state; panel shows "Declared: Homotrimer" |
| 214 | Check the methods summary | The declared state is recorded |

## 0.42.0 - chain count travels with the exports (quick rows)

| # | Try | Watch for |
|---|---|---|
| 215 | Declare a homotrimer, then Copy sequence (FASTA) | The header ends `_homotrimer` |
| 216 | Predict with ESMFold while a multimer is declared | The hint warns before the click; the toast afterwards says the model is a single chain |
| 217 | Fetch an AlphaFold model while a multimer is declared | Same warning (the DB model is the monomer) |
| 218 | Paste a FASTA whose header says `A:A:A` | The intake fills in as Homotrimer, one chain shown in the viewer, export header tagged |
| 219 | Paste the same record three times | Detected as a homotrimer |
| 220 | Paste two *different* records | Nothing is inferred; the question stays open |
| 221 | Answer Monomer yourself, then paste an `A:A:A` FASTA | Your answer is kept |

## 0.43.0 - experimental assembly import (quick rows)

| # | Try | Watch for |
|---|---|---|
| 222 | Declare a homotrimer with a single-chain model attached | The structure step offers "Attach an experimental assembly…"; the read-out names the route |
| 223 | Analyze → Interfaces → id `1TNF`, assembly 1 → Attach assembly | Downloads `1TNF.pdb1`, attaches it, status says "(3 chains)" |
| 224 | Compute interfaces on it | IF_ tracks per chain |
| 225 | Data modal → Structure Files | The assembly is listed with its inferred oligomeric state |
| 226 | Attach assembly with a bogus id | Dismissible error naming the external options |
| 227 | Attach assembly for an entry with no assembly | Clear failure; nothing half-attached |
| 228 | Check the id box with an .hhr loaded | Pre-filled from the first homolog hit that has a PDB id |

## 0.44.0 - rules panel polish, coachmark guidance, modern citations (quick rows)

| # | Try | Watch for |
|---|---|---|
| 229 | Open the Tracks tab | The submenu reads **Track Visibility**, not "Tracks" |
| 230 | Guide → Integrate → Open Analysis Rules | The banner names the fitting presets and says they are highlighted below |
| 231 | Answer the intake so nothing is suggested | The banner says no preset matches yet and the list is unfiltered |
| 232 | Read a preset card's citations | DCA / interface-conservation / AlphaMissense instead of the 1996-2001 pair |
| 233 | Add a preset, then Help → Debugging console | A "render / rule presets / 8 card(s)" line confirms the cards were written |
| 234 | Reproduce the "cards disappear" report | Check the console for an `error` entry (uncaught errors are now logged) — please share it if it appears |

## 0.45.0 - characterizing an unresolved fold (quick rows)

| # | Try | Watch for |
|---|---|---|
| 235 | Guide → Integrate → "Characterizing an unresolved fold" with no model | Action is Scan HMMER/Pfam, with the follow-on explained |
| 236 | Same with a model attached | Action is Run Foldseek (fold assignment) |
| 237 | Load data with no Pfam family and no Foldseek hit | The read-out says the fold is unplaced and names both routes |
| 238 | Run the Pfam scan and find a family | The line clears |
| 239 | Import an HHpred .hhr only | The line does **not** clear (sequence homology ≠ fold assignment) |
| 240 | Import Foldseek hits | The line clears |

## 0.45.1 - rule toggle naming (quick rows)

| # | Try | Watch for |
|---|---|---|
| 241 | Hover the ○/● toggle on a rule | Tooltip reads "Enable / disable this rule's track" |
| 242 | Disable a rule, then press its **select** | Still selects the matches (the rule is not off, only its track) |
| 243 | Disable a rule, then open the co-localization table's source picker | The rule is still listed and tabulates |

## 0.46.0 - model numbering vs the reference (quick rows)

| # | Try | Watch for |
|---|---|---|
| 244 | Attach two models numbered differently from your sequence (e.g. an assembly whose chain starts at its own residue 1) | The RMSF features sit where the *sequence* says, not shifted; the summary lists "Aligned by sequence (their numbering differs …) (offset)" |
| 245 | Attach a domain-only model numbered from 1 | Its values land at the aligned reference range, not at the start |
| 246 | Attach two models numbered like the sequence | Unchanged behaviour; no offset note |
| 247 | Run the interface analysis on a renumbered model | IF_ tracks land at the aligned reference indices |
| 248 | Scroll horizontally across the RMSF graph and the grids | The columns line up (this was the "offset" report; the geometry was already correct) |

## 0.47.0 - pinned graph axis strip (quick rows)

| # | Try | Watch for |
|---|---|---|
| 249 | Show pLDDT (or RSA/RMSF) as a graph and scroll right | The axis title and tick labels stay pinned at the left; the plot no longer appears in the label column |
| 250 | Scroll right, then click a model pill | Pills stay visible and clickable above the strip |
| 251 | Check the tick values per type | pLDDT 0-100, RSA 0.00-1.00, RMSF from its auto max |
| 252 | Export the viewport as SVG | The exported file still carries its own axis (the strip is on-screen only) |
| 253 | Hover the strip's tick labels | They are decorative text (the interactive axis is the SVG's, for selection) |

## 0.48.0 - graph pills in range + right-click menu (quick rows)

| # | Try | Watch for |
|---|---|---|
| 254 | Show a type as a graph with 2+ models | The model pills sit **inside** the left strip (not below the graph) |
| 255 | Click a pill | Toggles that model's line, as before |
| 256 | Right-click a **pill** | The per-track menu opens for that model's track |
| 257 | Right-click a **plotted point** | The menu opens for that point's track |
| 258 | Right-click the plot background or the strip | The menu opens for the section's first track |
| 259 | Use **Hide this track** from that menu | The line disappears from the graph (and the row is hidden too) |
| 260 | Use **View as → Glyphs** from that menu | The graph collapses back to heatmap rows |
| 261 | Scroll right with the graph shown | The axis strip stays pinned; pills stay clickable; no plot in the label column |

## 0.49.0 - graph axis title + header chevron (quick rows)

| # | Try | Watch for |
|---|---|---|
| 262 | Show a type as a graph with model pills | The pills start right of the vertical axis title (title fully readable) |
| 263 | Check the tick labels on the right of the strip | Still readable beside the pills |
| 264 | Look at the graph header ("pLDDT Confidence", …) | A chevron sits before the title, like the rows |
| 265 | Click that chevron | Opens the type's Track Control popup (View as / Color / Config / hide) |
| 266 | Change the type's view (e.g. to Glyphs) | The chevron shows its active colour; the graph collapses |
| 267 | Tab to the chevron | It takes focus (keyboard reachable) |

## 0.50.0 - uniform hover framework (quick rows)

| # | Try | Watch for |
|---|---|---|
| 268 | Hover residues in SS / TM / disorder / coiled-coil / signal rows | A tooltip with the swatch, track name and provenance (these had none before) |
| 269 | Hover a blank prediction cell | "not annotated in &lt;track&gt;" |
| 270 | Hover the AA row and the residue numbers | "Residue N: M" / "Residue N" |
| 271 | Hover a plotted graph point | The same styled tooltip; no duplicate native one |
| 272 | Check a C/H/P/E/M/D/S residue on a prediction row vs the AA row | Meaning on the prediction row, plain residue on the AA row |

## 0.50.1 - duplicate viewport with rules (quick rows)

| # | Try | Watch for |
|---|---|---|
| 273 | With a rule added, change the data (attach a structure, remove a track, zoom, re-parse) | The viewport stays a **single** set of rows + graphs (this was the A,B,C,A,B,C report) |
| 274 | Add a rule, then reload and change data again | Still single |
| 275 | With rules present, toggle a rule's track (○/●) | One render, one set |
| 276 | Check the row count against the Tracks tab | They agree (a duplicate would double the rows on screen) |
| 277 | Export the viewport as SVG with rules present | One set of rows in the file |

## 0.50.3 - preset cards vanish while guiding + dead RSA presets (quick rows)

| # | Try | Watch for |
|---|---|---|
| 278 | Guide → rules step → **Open Analysis Rules...**, then in the Tracks tab reopen **Track Visibility** while the coachmark is up, then add/remove a preset | Track Visibility stays open (it used to be slammed shut on any guide refresh) |
| 279 | Same coachmark, open **Interfaces** while guiding, then end guidance (close the section, switch tab, or Return to Guide) | Interfaces stays open - your choice is kept, not overwritten by the restore |
| 280 | Same coachmark, expand **Presets (curated rules)** and add/remove rules repeatedly | The accordion stays open and the cards stay where you left them; the sidebar does not jump |
| 281 | Add **Conserved buried residue** or **Rigid, well-folded core** with an RSA track loaded (structure attached) | A rule row now appears where those presets used to add a rule that marked nothing |
| 282 | Add either RSA preset with no structure/RSA track loaded | The card says "needs RSA (any model)" and no row is added (no error) |

## 0.51.0 - empty rules in the rules list (quick rows)

| # | Try | Watch for |
|---|---|---|
| 283 | Add a rule whose source is not loaded (e.g. Conserved buried residue with no structure) | Greyed row, "(Empty)" tag, tooltip names the missing source |
| 284 | Add a rule that matches residues | Normal colour, no tag |
| 285 | Load the missing source with the Tracks tab open (attach a structure) | The marker clears without switching tabs |
| 286 | Remove that source again | The marker comes back |

## 0.52.0 - homolog search with phmmer (quick rows)

| # | Try | Watch for |
|---|---|---|
| 287 | Load GFP, Analyze → Search Homologs (phmmer) | Status line runs; ~13 Homologs rows appear, numbered from #1 |
| 288 | Inspect row #1 and its ℹ tooltip | Solid teal `=`/`|` band; tooltip names phmmer with E-value/score/identity |
| 289 | Run it again | Numbering continues; no rows overwritten |
| 290 | Check Conservation with homologs included | Recomputes from the phmmer sequences too |
| 291 | Run it with no sequence loaded | Error toast, no job submitted |
| 292 | Import an .hhr first, then run phmmer | phmmer rows continue after the .hhr numbers |

## 0.52.1 - homologs route question + duplicate buttons (quick rows)

| # | Try | Watch for |
|---|---|---|
| 293 | Guide → homologs step, answer **phmmer** | Leads with Search homologs (phmmer); no HHpred link; one Copy sequence (FASTA) |
| 294 | Answer **MPI's HHpred** | Leads with Load .hhr / variant FASTA…, Open HHpred ↗ beside it, one Copy button |
| 295 | Answer **Both** | Search homologs (phmmer) leads, .hhr attach is the secondary button, HHpred link alongside - each control exactly once |
| 296 | Restore an old session whose answer was "Not yet" | The "Both" pill shows as answered (migrated), and the action matches |

## Known gaps / already-suspect areas (don't be surprised)

- **UI copy tone (rework wanted).** Several strings are still tool-centric or imperative where a
  neutral, helpful phrasing reads better ("No HHpred at hand?", "Is the HHpred .hhr ready?"). The
  homologs step is the first pass (0.52.1); note other offenders here as they turn up, and prefer
  "Alternatively, you can ..." over warnings or commands.
- **Rules and manual removal interplay.** Removing a `RULE_` row deletes its rule; there is
  no "hide the rule row but keep the rule" concept.
- **FIXED (0.50.3): "adding a preset makes the preset cards disappear"** (reported 0.43.0). The
  guide coachmark's "collapse the sibling sections while guidance is active" ran on *every* refresh,
  not just when the coachmark changed, and on clear it restored the saved states over whatever the
  user had done since - so a guide refresh could collapse the Rules section (with its Presets
  accordion and all eight cards) while you were working in it. The collapse/restore is now a
  one-shot transition that never overrides your own open/close choices, and the rules-panel
  re-render preserves the sidebar scroll. Rows 278-280 are the checks; if it recurs, the Debugging
  console (console line + error capture) should say why.
- **`group:pLDDT` / `group:RSA` are not offered** as categorical sources (those tracks hold
  objects, not chars) — use the numeric `pLDDT:`/`RSA:` sources instead.
- **Older saves** (pre-0.23.0) have no `topologySources`/`uniprotFeatures`/`domainHitsInfo`,
  so a restored old session can still show the inconsistency in X1. Worth deciding whether
  to migrate or to warn.
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
6h. 149–155 (Phase 1 loose ends).
6i. 166/156–165 (ensemble variance; 157/158 are the superposition checks).
6j. 167–172 (co-localization table; its full card is at the top).
6k. 173–178 (construct designer + taxonomy pass; full card at the top).
6l. 179–184 (RMSF line plot; full card at the top).
6m. 185–190 (empty tracks / duplicate button / debugging console; cards at the top).
6n. 191–196 (Track Control Color column; full card at the top).
6o. 197–200 (Track Control width + config hints).
6p. 201–207 (HHR conservation default).
6q. 208–214 + 215–221 (declared oligomeric state and its export/generator wiring; card at the top).
6r. 222–228 (experimental assembly import; card at the top).
6s. 229–234 (rules panel polish + modern citations).
6t. 235–240 (characterizing an unresolved fold; card at the top).
6u. 241–243 (rule toggle naming).
6v. 244–248 (model numbering vs the reference).
6w. 249–253 (pinned graph axis strip) + 254–261 (its regression fix and the graph right-click menu).
6x. 262–267 (graph axis title clearance + header chevron).
6y. 268–272 (uniform hover framework; card at the top).
6z. 273–277 (duplicate viewport with rules - fixed 0.50.1; check 273 first).
6aa. 278–282 (preset cards vanish while guiding + dead RSA presets - fixed 0.50.2/0.50.3; check 278 first).
6ab. 283–286 (empty rules in the rules list - new 0.51.0; card at the top, check 283 first).
6ac. 287–292 (homolog search with phmmer - new 0.52.0; card at the top, check 287 first).
6ad. 293–296 (homologs route question + duplicate buttons - 0.52.1; check 293 first).
7. 1–12 (design pass + HMMER) last, as they are the most self-contained.
