# Q2DV — QA checklist for the current development session (v0.16.0 → 0.66.10)

**Read this first.** Every item below has automated coverage in `npm test` (1243 checks),
but that harness runs the app script against a **stubbed DOM**: it never renders a
pixel, never lays anything out, never fires a real browser event, and it *replaces*
`renderViewer` with a no-op for speed (one check restores the real renderer just to
count render calls, so a nested re-render cannot sneak back in). So treat **all UI
behaviour as unverified** until you have driven it by hand. The list is written for
trying to break things, not for confirming they work — each row says what to do and
what would count as a bug.

**Round 1 (suggested first pass, ~1–2 h).** Drive these in order and stop as soon as
something fails - report the row number, what you saw, and (for anything API- or
state-related) **Log → Copy as JSON** pasted alongside. I only fix what the round turns
up; no new features land while you are driving it.

1. ~~**X1–X7**~~ - done (self-driven, 0.66.3): X1 found and fixed a reload gap; X2–X5 pass;
   X6 (popup blockers) is still yours; X7 was retired.
2. ~~**L1–L6**~~ - done (self-driven, 0.66.3): all pass; see the *Live checks* table below for
   the evidence and the one environment note (AlphaFold blocks Node's fetch - use the browser).
3. **The newest feature cards** (top of the list): experimental per-residue data (0.65.0),
   methods report (0.66.0), PDB entry lookup (0.63.0/0.64.0), category Options (0.62.0),
   PDBe validation (0.60.0). - still yours
4. **Rows 27–38** - removal, the most destructive class. - still yours

Then work down the *Suggested order* at the bottom for the full pass. Rows are grouped by
the release that added them, so an old row still counts: nothing here has been retired.

## Round 2 — features to debug (the new round, newest first)

Ordered by how much unverified surface each has; the two 0.66.10 features have full cards
below, the rest have quick rows at their release heading. For every failure: the feature,
what you did, what you saw, and **Log → Copy as JSON**.

1. **PROSITE motifs (0.66.10)** — the third domain-scan provider. Card below. Watch: run it on
   LacY (P02920); expect the two LacY signature motifs (PS00896/PS00897) and the MFS profile
   (PS50850) as extra DM rows, each named `ProSitePatterns:PS…` / `ProSiteProfiles:PS…` and
   overlaying with rules/3D like any domain row.
2. **ddG hand-off (0.66.10)** — Options → Data Sources → Stability predictions. Card below.
   Watch: the mutation list copies one-letter tokens; a pasted `R175H -1.2` becomes a `_EXP`
   row with the ddG kind; the offset applies to it like any experimental row. (The services
   need an account, so the on-site flow is untested; links verified 2026-10-01.)
3. **Experimental per-residue data (0.65.0)** — quick rows at its heading. Example paste for
   any protein (DMS-style tolerance, higher = better tolerated), one `position value` per line:
   `1 0.85`, `2 0.40`, `3 0.72`, `4 0.15`, `5 0.60`. A bare series of ≥5 values maps to
   sequential positions. Watch: the row's graph and its correlation line vs conservation.
4. **Methods report completeness (0.66.0)** — quick rows. Watch: with validation/experimental/
   ddG/domains loaded, the report lists each under its own heading and never claims a section
   that has no data.
5. **Ensemble RMSD matrix + the formula fix (0.66.9)** — **start at row 432**: the panel's
   "RMSD to first" column read 0.00 for every model before this release. Then rows 429–434.
   Watch: identical models → 0.00, a perturbed copy → nonzero, symmetric matrix, diagonal 0.
6. **3D colour by any track (0.66.8, refined through 0.66.14)** — quick rows. The colour
   dropdown is a flat list: base schemes + evidence tracks (no "Flat colour" group). The
   **Flat / Per-residue** button beside it owns homolog/conservation colouring: highlighting a
   homolog in per-residue mode colours each residue by its match-quality glyph (`|` `=` `+` `:`
   `.`); Flat keeps one blue. On the conservation scheme, per-residue = gradient, flat = per-hit
   strength. Watch: the toggle changes nothing for rule/validation/pLDDT schemes.
7. **Tracks tab vs quick controls (0.66.7)** — quick rows. Where the cross-links are: sidebar →
   **Tracks** tab → *Track Visibility (full manager)* → the **"Quick controls (View as / Color) ↗"**
   button opens the popover; inside that popover the header carries **"Full manager ↗"** back.
   Watch: the full-row tint follows the active rule; chevrons stay subtle.
8. **Model score colour mode (0.66.6)** — quick rows. Watch: HSL legend gradient, raw stat in
   the tooltip, unscored positions unshaded.
9. **Numbering offset + partial-HSP realignment (0.66.5)** — quick rows. Test case: load a
   topology source or an experimental row, then sidebar → Input Data → **Loaded Data** → set
   **Numbering offset** (e.g. `2`) → Apply; the row's positions shift by 2 and the summary
   updates. Partial HSPs: run BLAST on GFP and hover a hit's name - the tooltip names the
   covered range (the old amber "(partial N%)" label tag moved into the tooltip in 0.66.11).
10. **PDB entry lookup (0.63.0/0.64.0)** — quick rows. Test case: load UniProt **P42212** (GFP),
    then Structure → **Find PDB entries**: the exact-sequence search finds little (1GFL carries
    mutations), but the name fallback finds **1GFL**; press its Fetch. Also type `1GFL` directly
    in Input Data's PDB ID box.
11. **Category Options (0.62.0)** — quick rows. Watch: all eleven categories (ddG is new) switch
    correctly; the guide's "⚙ Data sources" links land on the right category.
12. **PDBe validation (0.60.0)** — card at its heading. Watch: per-chain rows, alignment mapping,
    removal, and that dimer totals say "2 chain rows".
13. **InterProScan topology + domains (0.58.0)** — quick rows. Membrane test case: **LacY
    (P02920)** - TMHMM and Phobius should agree on ~12 TM helices (SignalP: none, it is not
    secreted); for a SignalP-positive control use a secreted protein such as insulin precursor
    **P01308**. Watch: the TSV renderer path; consensus conflicts flag when sources disagree.
14. **Variant effect providers + AlphaMissense (0.56.0/0.57.0)** — card above. Watch: the
    human-only skip reason, per-provider failure isolation, the merged line's registry order.
15. **Rows 27–38 — removal**, the most destructive class (still from Round 1).

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

### Species-specific variant effects (Ensembl VEP/SIFT) — 0.66.17

**Should do.** Options -> Variants detects the species (header OS= tag, else the UniProt entry's
organism), lets the user override it from a shortlist or by typing, and the "Assess variant
effects" run adds an Ensembl VEP (SIFT) provider that scores each substitution species-aware.
The hand-off section links PROVEAN, PolyPhen-2 and MutationTaster with the mutation-list copy.

**Try (normal use).**
1. Load TP53 (**P04637**) and a variant FASTA carrying `R175H`; open Options -> Variants.
   *Expect:* Species shows `Homo sapiens (homo_sapiens) - detected`; the panel explains VEP.
2. Press **Assess variant effects**.
   *Expect:* the status/log line includes `Ensembl VEP (SIFT): 1 of 1 substitution(s) scored by
   SIFT (0 deleterious, 1 tolerated)`; hovering the substitution's variant row shows
   `SIFT tolerated` with score 0.08 alongside AlphaMissense/conservation/structure.
3. Type a different species (e.g. `Mus musculus`) and press **Set**, then **Detect**.
   *Expect:* the status flips to manual, then back to detected.
4. Press **Copy mutation list** and one of the three hand-off links.
   *Expect:* one-letter tokens on the clipboard; the tools open.

**Edge cases.**
- *No species / no accession:* VEP is skipped with its `needs` reason in the run line; the other
  providers still report.
- *UniProt and Ensembl numbering differ (some species):* positions map through the aligner; if a
  substitution's reference residue does not match the Ensembl protein it is counted as unmapped
  in the summary rather than scored wrongly.
- *VEP down or rate-limited:* the provider fails alone with an HTTP reason; nothing else stalls.
- *A species outside Ensembl:* the run reports the VEP HTTP error; the hand-off links still work.

---

### Homolog source tracking — 0.66.16

**Should do.** With several homolog sources loaded, Track Control's Homologs group breaks the
rows into per-source sub-headers with counts, each with its own show/hide eye, and every row
carries a colour-coded source badge. The quick-controls Filter section for Homologs gets the
same sources as one-click chips.

**Try (normal use).**
1. Load BLAST hits (Analyze -> Homologs -> BLAST) and phmmer hits, then open the **Tracks** tab
   and expand **Homologs**.
   *Expect:* sub-headers `BLAST (n)` and `phmmer (m)` with an eye each; each row ends in a
   coloured badge (`BLAST` blue, `phmmer` green, `Foldseek` amber, `HHpred` purple).
2. Click the BLAST sub-header eye.
   *Expect:* every BLAST row flips to `(filtered)` and leaves the viewer; the eye goes hollow;
   click again to restore.
3. Open the quick controls popover on Homologs and press **Filter**.
   *Expect:* source chips `BLAST (n)`, `phmmer (m)` above the per-track list; a chip hides or
   restores that whole source and shows struck-through while active.

**Edge cases.**
- *Old save / imported hits with no source recorded:* they land under a single `Homolog`
  sub-header; nothing should disappear.
- *All rows of a source removed:* its sub-header goes with them.
- *One source only:* a single sub-header with the count; the group still works.
- *Unusual source names:* the badge class is sanitised, so odd characters cannot break the
  markup; the visible text stays as recorded.

---

### PROSITE motifs via InterProScan — 0.66.10

**Should do.** The domain-scan picker gains a third choice, "InterProScan + PROSITE motifs", which
adds the PROSITE signature patterns and profiles (PS… motifs, e.g. glycosylation and
family-signature sites) to the Pfam/NCBIfam scan. They arrive as ordinary domain rows, so every
overlay (rules with `group:DM`, the 3D colour picker, tooltips, the methods report) treats them
like any other domain.

**Try (normal use).**
1. Load LacY (P02920) or fetch it, open Options → Data Sources → Domains, pick
   **InterProScan + PROSITE motifs**,
   press **Scan for domains**.
   *Expect:* the log line names "EBI InterProScan (Pfam + NCBIfam + PROSITE motifs)"; the DM rows
   include `ProSitePatterns:PS00896` / `PS00897` ("LacY/RafB permease family, conserved site",
   residues 64–78 and 280–294) and `ProSiteProfiles:PS50850` ("Major facilitator superfamily
   (MFS) profile", ~8–404), plus the usual Pfam/NCBIfam rows.
2. Hover a motif row and its cells.
   *Expect:* the tooltip names the signature and the InterPro description where the entry maps.
3. Add a rule with source `group:DM` and a position span over PS00896.
   *Expect:* the motif highlights through the rule, like any domain row.

**Edge cases.**
- *Motif rows missing entirely:* the provider list or `appl` string lost PrositePatterns /
  PrositeProfiles (the live-verified analysis names are exactly `ProSitePatterns` /
  `ProSiteProfiles`, capital S). Check the request line in the activity log.
- *Rows named `PrositePatterns:…` (lowercase s):* the parser's model naming drifted; the rows
  should keep the TSV's own spelling.
- *Signature with no InterPro mapping:* the description falls back to the signature's own text;
  it must not render an empty tooltip.
- *PROSITE rows appear in an ordinary InterProScan run:* the third provider's `appl` leaked into
  the default one; the default must stay Pfam + NCBIfam only.

### ddG hand-off (stability predictions) — 0.66.10

**Status: the on-service flow is untested** (the sites need an account/login); the four links
were reachability-verified 2026-10-01, and the copy/import side is covered by tests and manual
checks. Treat everything past "Open …" as unverified until someone runs a prediction.

**Should do.** Options → Data Sources → Stability predictions links the four services that verified as alive
(DynaMut2, DUET, mCSM, FoldX suite), copies the loaded substitutions as one-letter tokens, and
imports a pasted `mutation value` table as an experimental row of the ddG kind. There is no API;
this is deliberately a hand-off, and the import reuses the experimental-row machinery so the
overlays all apply.

**Try (normal use).**
1. Load a variant FASTA with substitutions (e.g. GFP R175H), open Options → Data Sources →
   Stability predictions.
   *Expect:* the panel explains the hand-off, shows the two copy buttons and the four service links.
2. Press **Copy mutation list**, paste into a text editor.
   *Expect:* `R175H` (one letter, one per line, deduplicated); a toast confirms the count.
   (With no variants loaded: a clear message, not an empty clipboard.)
3. On a service, run the prediction, then paste its results as `R175H -1.2` lines into the box,
   name it, press **Add ddG row**.
   *Expect:* a `<name>_EXP` row appears; hovering says "ddG (negative = destabilising)"; the graph
   plots it; the status line reports the mapped/out-of-range counts; the correlation vs
   conservation appears if a conservation track is loaded.
4. Change the reference numbering offset.
   *Expect:* the ddG row shifts with the other evidence rows (raw rows are kept for re-placement).

**Edge cases.**
- *`p.Arg175His -1.2` accepted, `G175A` (no value) skipped:* the parser takes the mutation token
  plus a trailing number; lines without a value or a valid token are ignored, and if nothing
  parses the status says so.
- *ddG values plotted on the wrong positions:* the substitution token's position must be the
  reference numbering; check `parseDdgTable` output in the console (Log) before blaming the offset.
- *Import lands as kind "other":* the kind select value drifted; the tooltip wording is the tell.
- *Links open dead services:* the four linked services were curl-verified 2026-10-01; if one
  dies, remove it from the panel rather than leaving a 404 in the docs.

---

### Variant effect providers — 0.57.0

**Should do.** One button ("Assess variant effects") runs every source that applies to the session -
AlphaMissense (human), conservation, structure context, curated UniProt features - and merges their
read-outs per substitution, so a non-human protein still gets useful evidence.

**Try (normal use).**
1. Load a non-human protein with homologs or a variant FASTA (e.g. an Arabidopsis entry with
   conservation from a phmmer search), attach a model, and press **Assess variant effects**.
   *Expect:* the status lists only the applicable providers (AlphaMissense is skipped - no
   accession/human coverage); the tooltip shows Conservation + Structure context (+ Curated if the
   entry has features).
2. Do the same for human TP53 with an accession.
   *Expect:* all four providers run; the merged tooltip line reads AlphaMissense, Conservation,
   Structure context and Curated (UniProt) in that order.
3. Fail one provider on purpose (offline, or block AlphaFold DB).
   *Expect:* the status names that provider's failure and the others still report their results.

**Edge cases (symptom → likely cause).**
- With nothing loaded, the button says no source applies and lists what each needs.
- A substitution the provider cannot place (position outside the track) simply gets no line from
  that provider - the merged line shows the rest.
- Providers are per-substitution; a variant whose header names one change gets one line even if the
  alignment differs elsewhere.

---

### AlphaMissense variant effects — 0.56.0

**Should do.** With a UniProt accession and a variant FASTA loaded, one button fetches the
AlphaMissense substitution scores and reports each variant's pathogenicity class in the viewer
tooltips, the variant panel, the status line and the guide read-out.

**Try (normal use).**
1. Load a human protein with an accession (TP53/P04637 works), attach a variant FASTA naming the
   substitution (e.g. `>R175H`), then Input Data → **Predict variant effects (AlphaMissense)**.
   *Expect:* status "AlphaMissense (P04637): 1 of 1 substitution(s) matched - 0 pathogenic,
   1 likely pathogenic, ...".
2. Hover the variant row's mismatch cell.
   *Expect:* tooltip ends "; AlphaMissense: pathogenic or likely pathogenic (0.99)".
3. Select the variant row and look at the FASTA Segment label.
   *Expect:* it names the same class.
4. Open the Guide with the scores loaded.
   *Expect:* a read-out line counting pathogenic substitutions; the homologs step offers the action.

**Edge cases (symptom → likely cause).**
- A non-human protein: status explains AlphaMissense annotations exist for human proteins only
  (the AFDB entry has no `amAnnotationsUrl`).
- A variant header with no substitution token: the alignment difference is used instead (check the
  "N of M matched" count; several differences are all looked up).
- No accession loaded: toast asks for one (same rule as the AlphaFold fetch).
- Scores are memory-only: a restored session re-fetches with one click.

---

### Topology consensus completion — 0.55.0

**Should do.** Paste topology predictors under Options → Data Sources → Topology; the majority-vote
Consensus row marks columns the sources disagree on with a red `?` instead of blanking them, and the
panel plus the row tooltips report the N-terminus call and segment/disagreement counts.

**Try (normal use).**
1. Paste a TMHMM-style segment list, then paste a TOPCONS per-residue line
   (`TOPCONS  ooooMMMMMMiiii…`).
   *Expect:* both become topology rows; a Consensus row appears once two sources are loaded.
2. Find a column where the two sources disagree.
   *Expect:* the consensus cell shows `?` in red, and the tooltip says "Sources disagree (no
   majority)" - not a blank "no call".
3. Look at the topology panel and hover the Consensus row's ℹ.
   *Expect:* "Consensus (2 sources): N-terminus outside · N TM segment(s) · N disagreement column(s)",
   and the tooltip gives the same breakdown.
4. Run **Cross-check TM** with Quick2D TM loaded.
   *Expect:* the footer names the consensus N-terminus and any disagreement columns.

**Edge cases (symptom → likely cause).**
- A pasted line of ordinary words is ignored (runs under 10 characters are not topology).
- TOPCONS output with several method lines becomes one source (its consensus line), not five.
- An odd-length run (fewer residues than the sequence) is padded; trailing columns read "no call".
- A tie between two sources is `?`, not a majority - with three sources a 2:1 split still resolves.

---

### Homolog Templates table upgrade — 0.54.0

**Should do.** The Data modal's Homolog Templates table ranks every Homologs row - .hhr, phmmer,
BLAST or Foldseek - by one comparable template score, with correct identity, source-aware
confidence, real coverage, and a structure cell that resolves to a cached file, a PDB entry or the
AlphaFold model for the hit's accession.

**Try (normal use).**
1. Load GFP, run **Search homologs (phmmer)**, then switch the picker to **BLAST** and run again;
   optionally import an .hhr and run Foldseek. Open **Data → Homolog Templates**.
   *Expect:* one table, all sources mixed and sorted by Template score; the top row (GFP itself)
   shows 100.0% identity, 100.0% confidence, 100.0% coverage, "AlphaFold P42212", score 100.0 ★ best.
2. Look at a Foldseek row and an HHpred row.
   *Expect:* Foldseek identity reads as a percentage (92.0%, not 1.0%), HHpred shows its probability
   (95.0%) and "PDB xxxx"; neither shows N/A for the score.
3. Press **Copy table (TSV)**.
   *Expect:* the ranking copies with the same columns; paste it into a spreadsheet.
4. Export **Methods summary (.md)**.
   *Expect:* a "## Template quality" section with the ranked table, and "Best homolog identity: 100%"
   (not the old raw count like 237%).

**Edge cases (symptom → likely cause).**
- A row with no probability and no E-value still shows "-" for Confidence and N/A for the score.
  Expected: nothing to rank on; this is only reachable with hand-edited data.
- Press **3D** on a phmmer/BLAST row. *Expect:* the AlphaFold model for that accession downloads
  and renders; if the service is offline the notice says AlphaFold DB covers UniProt entries and
  suggests attaching a PDB/CIF.
- BLAST rows covering only part of the sequence show coverage < 100%. Expected: HSP coverage.

---

### BLAST homolog provider — 0.53.0

**Should do.** The homolog search can run through EBI NCBI-BLAST instead of phmmer, chosen from a
picker in Input Data; BLAST hits become Homologs rows attributed to BLAST, with BLOSUM62-based
match colouring and a BLAST-specific tooltip.

**Try (normal use).**
1. Load GFP, Input Data → set the provider picker to **BLAST (NCBI)**, press **Find homologs**.
   *Expect:* a status line counts up, then ~13 Homologs rows appear; the first row's tooltip says
   "BLAST homolog" with E-value, bits, identity, aligned columns and HSP count, citing NCBI BLAST.
2. Compare with the phmmer run (picker back to phmmer).
   *Expect:* phmmer rows are denser (posterior probability per column); BLAST rows are sparser
   (pairwise HSP coverage), and both feed conservation when the option is on.
3. Leave the picker on BLAST and run with the sequence already having phmmer rows.
   *Expect:* BLAST rows continue the numbering; nothing is overwritten.

**Edge cases (symptom → likely cause).**
- A BLAST row covers only part of the sequence. Expected: BLAST HSPs are local; the row shows the
  aligned region only (unlike phmmer's profile coverage). Worth flagging if it confuses.
- Choosing BLAST while the BLAST service is down falls back to phmmer (and vice versa); the status
  line names the provider that failed before the retry.
- The provider picker only affects the homolog search; the UniProt accession lookup keeps its own
  BLAST setting.

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
| X6 | Use the wizard's `Open HHpred ↗` / `Open a predictor ↗` actions (0.66.4) | *Verified by design:* `openExternal()` surfaces the URL in a toast + the activity log when the popup is blocked; try it with popups blocked to see the fallback |
| X7 | Turn **File → New-feature highlights** on | *Convention retired (0.66.3):* the marker set lapsed once the QA cards took over; the toggle still works for ad-hoc marking, but nothing is expected to be marked |

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

## 0.53.0 - BLAST homolog provider (quick rows)

| # | Try | Watch for |
|---|---|---|
| 297 | Input Data → provider picker → BLAST → Find homologs (GFP) | ~13 Homologs rows, attributed to BLAST |
| 298 | Hover the first BLAST row's ℹ | "BLAST homolog", E-value/bits/identity/HSPs, NCBI BLAST citation |
| 299 | Compare row texture with a phmmer run | BLAST rows sparser (HSP coverage), phmmer denser (per-column posterior) |
| 300 | Run BLAST after phmmer | Numbering continues; both sets coexist and count towards conservation |
| 301 | Pick BLAST while it is unreachable (or phmmer) | Status line names the failed provider, then the other runs |
| 302 | Analyze menu label | Says "Search Homologs (HMMER/BLAST)…" |

## 0.54.0 - Homolog Templates table upgrade (quick rows)

| # | Try | Watch for |
|---|---|---|
| 303 | Data → Homolog Templates with mixed sources | One sorted table; no N/A scores; identity as a percentage everywhere |
| 304 | Check the Identity column against the source | phmmer/BLAST/HHpred "x/y (z%)" and Foldseek fractions all read as percentages |
| 305 | Check Confidence and its tooltip | Probability for HHpred/Foldseek; E-value-derived for phmmer/BLAST |
| 306 | Check Structure on an accession hit | "AlphaFold <accession>"; PDB entries show "PDB xxxx"; cached files "✓ cached" |
| 307 | Press 3D on a phmmer/BLAST row | AlphaFold model downloads and renders |
| 308 | Copy table (TSV) + Methods summary (.md) | Table copies; report has "## Template quality" and a correct best identity |

## 0.55.0 - topology consensus completion (quick rows)

| # | Try | Watch for |
|---|---|---|
| 309 | Paste a TOPCONS per-residue line in Options → Data Sources → Topology | It becomes a topology row named TOPCONS |
| 310 | Paste two disagreeing sources | Consensus row appears; the tie column is a red "?" |
| 311 | Hover the "?" cell and the Consensus ℹ | "Sources disagree (no majority)"; tooltip has N-terminus + counts |
| 312 | Topology panel read-out | "Consensus (N sources): N-terminus …, N TM segment(s), N disagreement column(s)" |
| 313 | Cross-check TM footer | Names the consensus N-terminus and disagreement columns |
| 314 | A source row's list line | "N TM residues in M segment(s)" (not "N segments") |

## 0.55.1 - per-provider menu + source-aware glyph wording (quick rows)

| # | Try | Watch for |
|---|---|---|
| 315 | Analyze → **Search Homologs (BLAST)…** | Runs BLAST directly; the Input Data picker shows BLAST afterwards |
| 316 | Analyze → **Search Homologs (phmmer)…** | Runs phmmer; the picker follows it |
| 317 | Hover the cells of a BLAST (or phmmer/Foldseek) row | Tooltip names that basis ("BLAST substitution score (BLOSUM62)"), never "HHpred match quality" |
| 318 | Show Legend → the Homologs entry | Explains the shared glyph scale and that the meaning depends on the source |

## 0.56.0 - AlphaMissense variant effects (quick rows)

| # | Try | Watch for |
|---|---|---|
| 319 | Human protein + variant FASTA → Predict variant effects | Status: N of M substitutions matched, with class counts |
| 320 | Hover the variant's mismatch cell | "; AlphaMissense: pathogenic or likely pathogenic (0.99)" |
| 321 | Select the variant row | FASTA Segment label names the class |
| 322 | Guide read-out | Counts the pathogenic substitutions for that accession |
| 323 | Guide homologs step with variants loaded | Offers "Predict variant effects (AlphaMissense)" |
| 324 | A non-human protein | Clear message that annotations exist for human proteins only |
| 325 | A variant header with no token (e.g. `>var1`) | Falls back to the alignment difference |

## 0.58.0 - InterProScan topology + domains (quick rows)

| # | Try | Watch for |
|---|---|---|
| 332 | Load LacY (P02920) → Predict topology (TMHMM/Phobius/SignalP) | Phobius + TMHMM source rows appear; status names both TM counts |
| 333 | Look at the Consensus row | TM 11-vs-12 disagreement shown as red `?` columns, N-terminus reported |
| 334 | Re-run the prediction | Sources are replaced, not stacked (TMHMM/Phobius stay one each) |
| 335 | Scan domains with the picker on InterProScan | DM_ rows labelled `Pfam:PF01306` and `NCBIfam:TIGR00882` etc. |
| 336 | Scan domains with the picker on hmmscan | The original Pfam behaviour is unchanged |
| 337 | Load GFP (soluble control) and predict topology | ~0 TM; no signal peptide; the consensus is mostly inside/outside |
| 338 | Try a viral case (P0DTC2 spike) | Signal peptide + 1 TM in the sources |
| 339 | Run the guide's topology step | Leads with "Predict topology (InterProScan)"; "Paste topology…" stays as an alternative |
| 340 | Cross-check TM with a Quick2D TM row loaded | Uses the InterProScan consensus like a pasted source |

## 0.57.0 - variant effect providers (quick rows)

| # | Try | Watch for |
|---|---|---|
| 326 | Non-human protein + conservation + model → Assess variant effects | AlphaMissense skipped with a reason; Conservation + Structure report |
| 327 | Human TP53 with accession | All four providers in one merged line |
| 328 | Read the merged tooltip/panel line | Providers in registry order, each labelled |
| 329 | Block one service and rerun | That provider fails in the status; the others still report |
| 330 | Nothing loaded → press the button | Clear message listing what each provider needs |
| 331 | Add a new provider (dev) | One registry entry; tooltips/status/read-out pick it up |

### Experimental structure validation (PDBe) — 0.60.0

**Should do.** For an attached experimental entry, one button pulls the wwPDB validation outliers and
quality scores and shows them as per-chain rows, so experimental quality sits beside pLDDT.

**Try (normal use).**
1. In Input Data type `1GFL` in the **PDB ID** box and press **Fetch PDB entry** (or attach a file
   named after the entry), then press **Fetch validation (PDBe)**.
   *Expect:* "PDBe validation (1GFL): 2 chain row(s) - … | geometry 7.5, data 53.6, overall 11.5";
   two amber rows appear ("Validation 1GFL (chain A/B)").
2. Hover a flagged cell and the row's ℹ.
   *Expect:* "Residue N: validation outlier(s) - sidechain outlier (PDBe)"; the ℹ lists the
   breakdown and the quality percentiles.
3. Open the Guide.
   *Expect:* a read-out line with the worst outlier types and the entry quality.
4. Remove the row (Tracks → ×).
   *Expect:* it stays removed (the info map unpicks), and a restored session keeps the rows.

**Edge cases (symptom → likely cause).**
- No PDB-id-like structure attached: the button explains it needs an experimental entry.
- A renumbered entry: rows are mapped through the chain alignment, so the flags land on the right
  reference residues (check the status/log if something looks shifted).
- Predicted models (AlphaFold/ESMFold) have no wwPDB validation - use pLDDT there.

---

### Activity log — 0.59.0

**Should do.** The "Log" button in the menu bar shows what the session is doing in plain words -
clicks, menu choices, API submits/polls/results and what was parsed - newest first, updating live.

**Try (normal use).**
1. Press **Log**, then run something with an API (topology prediction, domain scan, phmmer).
   *Expect:* submit -> poll -> result-size -> parse-summary lines appear live, plus task start/end.
2. Run the InterProScan topology prediction on LacY.
   *Expect:* "36 row(s) -> 2 source(s) [Phobius 12 TM, TMHMM 11 TM]" - the numbers to compare with
   what appears in the viewer.
3. Run a scan that finds nothing (e.g. topology on a soluble protein).
   *Expect:* an explicit "N row(s) parsed, no TM/signal regions found - nothing added" instead of
   silence.
4. Copy as JSON and paste it back when reporting a problem.

**Edge cases (symptom → likely cause).**
- A prediction run on a different sequence length than the loaded one logs "ranges clipped" - check
  the sequence you loaded.
- The log is session-only and capped at 200 entries; JSON copy is the durable form.
- 3D viewer open/close should no longer print colorscheme or framebuffer warnings to the console.

---

## Reference systems (verified expectations) — use these to test

| System | Accession | Class | Verified expectation | Exercises |
|---|---|---|---|---|
| GFP (avGFP) | P42212 | soluble, non-membrane | ~0 TM helices, no signal peptide, Pfam PF01316 | the soluble control for every pipeline |
| **LacY** lactose permease (*E. coli*) | P02920 | bacterial, 12-TM | curated 12 TM; Phobius 12, **TMHMM 11** - expect a flagged disagreement | topology prediction + `?` conflicts, InterProScan domains (Pfam PF01306 + NCBIfam TIGR00882/NF007077) |
| KcsA (*S. lividans*) | P0A334 | bacterial, 2-TM channel | 2 TM | small membrane protein |
| Bacteriorhodopsin (*H. salinarum*) | P02945 | archaeal, 7-TM | 7 TM | classic membrane control |
| PhoE porin (*E. coli*) | P02932 | bacterial beta-barrel | 0 TM helices (barrel, not helical) | "membrane protein without TM helices" contrast |
| FhuA (*E. coli*) | P06971 | bacterial beta-barrel | 22 TM-like strands | outer-membrane barrel stress test |
| SARS-CoV-2 spike | P0DTC2 | viral, signal + 1 TM | signal peptide + TM 1214-1234 | viral membrane case |
| Influenza HA | P03452 | viral, signal + 1 TM | signal peptide + TM 529-549 | viral membrane case |

**Validation test case:** 1GFL (GFP crystal structure, a dimer) - Fetch validation (PDBe) should
give two rows (chains A+B), 76 clashes and 2 Ramachandran outliers across them, with the amber `!`
markers on the flagged residues and the quality line "geometry 7.5, data 53.6, overall 11.5".

**How to run a membrane case:** load the sequence (UniProt or FASTA) → **Predict topology
(TMHMM/Phobius/SignalP)** → expect the source rows plus a Consensus row; check the N-terminus and
any `?` conflicts; then **Scan domains** with the picker on InterProScan to see Pfam + NCBIfam
families; run **phmmer** for conservation; cross-check TM once a Quick2D TM row is loaded.

**Bacteria / viruses: what already covers them.** UniProt (any taxon), phmmer/BLAST vs Swiss-Prot,
hmmscan/Pfam, InterProScan with NCBIfam (TIGRFAM/PRK/NF: bacterial and viral family models),
Foldseek (AFDB/PDB), ESMFold, the topology predictors and conservation. **Not integrated** (would
need a live CORS check first): VFDB (virulence factors), CARD (antimicrobial resistance), BV-BRC
(bacterial/viral genomes), viral-specific databases. The capability/provider registry is the hook.

## 0.59.0 - activity log + 3D console cleanup (quick rows)

| # | Try | Watch for |
|---|---|---|
| 341 | Menu bar between Analyze and Export | A "Log" button opens the Activity log |
| 342 | Run any API job with the log open | Submit / poll / result-size / parse-summary lines appear live |
| 343 | InterProScan topology on LacY (P02920) | Log: 36 row(s) -> 2 source(s) [Phobius 12 TM, TMHMM 11 TM] |
| 344 | Topology on a soluble protein (e.g. GFP) | Log says no TM/signal regions found - nothing added |
| 345 | Load a truncated sequence, then predict | Log warns the prediction ran on a different length (ranges clipped) |
| 346 | Cycle the 3D colour schemes (incl. hydro/spectrum) | Colours actually change; no "Could not interpret colorscheme" |
| 347 | Open/close/resize the 3D viewer | No OffscreenCanvas/framebuffer warnings in the console |
| 348 | Copy as JSON | Valid JSON for macro work (macro recording itself is a future idea) |

## 0.66.17 - species-specific variant effects (quick rows)

| # | Try this | Watch for |
|---|---|---|
| 464 | TP53 (P04637) + R175H variant, Options -> Variants | Species detects Homo sapiens; Assess runs "Ensembl VEP (SIFT)" |
| 465 | Read the merged line/tooltip | "SIFT tolerated" 0.08 from the live call; other providers still merge |
| 466 | Override species by hand, then Detect | Manual sticks; Detect re-reads header/entry |
| 467 | No accession or no species | VEP skipped with its needs reason; others still run |
| 468 | Hand-off links + Copy mutation list | PROVEAN/PolyPhen-2/MutationTaster open; list copies |

## 0.66.16 - homolog source tracking (quick rows)

| # | Try this | Watch for |
|---|---|---|
| 460 | Load BLAST + phmmer hits, Tracks tab, expand Homologs | Sub-headers per source with counts; rows carry coloured badges |
| 461 | Click a sub-header eye | That whole source hides (rows say filtered); click again to restore |
| 462 | Quick controls -> Homologs -> Filter | Source chips per source; one click hides/restores all of it |
| 463 | A session with one source / an old save without source | One sub-header (or "Homolog"); nothing lost |

## 0.66.15 - 3D modal polish (quick rows)

| # | Try this | Watch for |
|---|---|---|
| 456 | Toggle Flat / Per-residue | The toolbar does not shift (button width reserved) |
| 457 | Fetch a PDB entry, then open 3D | Model info shows "PDB on RCSB" linking to the entry page |
| 458 | Attach a local .pdb, then open 3D | A "Local model" chip, not clickable |
| 459 | Drag to a corner, toggle +, shrink the window | The panel stays inside with a margin; both sizes stay on screen |

## 0.66.14 - homolog selection colours per glyph (quick rows)

| # | Try this | Watch for |
|---|---|---|
| 453 | Highlight a homolog row in per-residue mode | Residues coloured by their glyph: `|` `=` `+` `:` `.` each a different colour |
| 454 | Toggle Flat with the homolog highlighted | Every covered residue back to one blue |

## 0.66.13 - 3D colour cleanup + Lock scope (quick rows)

| # | Try this | Watch for |
|---|---|---|
| 448 | Lock Model, then highlight another line | Model stays loaded, colours update; status says "(model locked)" |
| 449 | Unlock, then highlight another homolog line | The model follows the selection again |
| 450 | Open the colour dropdown | Flat list: base schemes + tracks; no groups, no per-homolog entries |
| 451 | Base: conservation, toggle Flat vs Per-residue | Flat: stronger hits greener/darker; Per-residue: gradient |
| 452 | Toggle while a rule/validation scheme is active | The model does not change (toggle owns homolog/conservation only) |

## 0.66.11 - 3D picker refinement + partial-coverage tooltip (quick rows)

| # | Try this | Watch for |
|---|---|---|
| 443 | Base: conservation with the toggle on Per-residue | The ConSurf gradient on the model |
| 444 | The same with the toggle on Flat | Each hit's residues in its model-score colour; stronger hits greener |
| 445 | Remove the conservation row while the conservation scheme is active | Scheme falls back to a base scheme, status stays honest |
| 446 | Hover a partial homolog row name in the sidebar | Coverage range in the tooltip; no "(partial N%)" in the visible name |
| 447 | pLDDT/RSA/experimental 3D colouring | Colours render as before (hex conversion) - no uncoloured model |

## 0.66.10 - PROSITE motifs + ddG hand-off (quick rows)

| # | Try this | Watch for |
|---|---|---|
| 435 | Domains → InterProScan + PROSITE motifs on LacY | PS00896/PS00897 patterns + PS50850 profile as DM rows, analysis names kept |
| 436 | The same run on a protein with no PROSITE matches | Pfam/NCBIfam rows still arrive; no empty motif rows |
| 437 | Rule over group:DM covering a motif | Motif highlights through the rule like any domain row |
| 438 | Copy mutation list with variants loaded / without | Tokens once each / clear message, not an empty clipboard |
| 439 | Paste `R175H -1.2` + `p.Arg175His -0.4`, add | One ddG row, kind ddG, values at 175, status counts |
| 440 | Change the reference offset after the import | The ddG row shifts with the other evidence |
| 441 | Report with a ddG row loaded | Report lists the ddG row under experimental data |
| 442 | All four service links | They open the verified services (DynaMut2, DUET, mCSM, FoldX) |

## 0.66.9 - ensemble RMSD matrix + the RMSD formula fix (quick rows)

| # | Try | Watch for |
|---|---|---|
| 429 | Attach 2+ models, run Ensemble variance | A "Pairwise RMSD" table appears with a heat tint and the pair summary |
| 430 | Compare two models that differ only by position | ~0.00 A (superposition removes it) |
| 431 | Compare models that really differ | A non-zero RMSD, warm tint; the log records mean/max |
| 432 | The "RMSD to first" column | Now real numbers (was 0.00 for every model - fixed) |
| 433 | Export the methods report | An "Ensemble: mean RMSF ... mean pairwise RMSD ..." line |
| 434 | One model only | The panel explains it needs an ensemble (unchanged) |

## 0.66.8 - colour the 3D model by any track (quick rows)

| # | Try | Watch for |
|---|---|---|
| 423 | Open the 3D viewer with validation rows loaded | The toolbar picker lists the base schemes **and** the tracks (validation, pLDDT/RSA, rules, interfaces, consensus) |
| 424 | Pick a validation row | Flagged residues amber on the model, the rest grey; the status counts matched residues |
| 425 | Pick an experimental or pLDDT track | A low-to-high ramp over the model (same family as Model score) |
| 426 | Pick a rule | Matching residues in the rule's colour against grey |
| 427 | Remove the chosen track, then re-render | The picker falls back to a base scheme (no dead colouring, toolbar honest) |
| 428 | Switch back to a base scheme | The base colouring returns; selection colouring still works |

## 0.66.7 - Tracks tab vs quick controls + row polish (quick rows)

| # | Try | Watch for |
|---|---|---|
| 416 | Open the Tracks tab | "Track Visibility (full manager)" + the role line + "Quick controls (View as / Color) ↗" |
| 417 | Open the Track Control popover | "Full manager ↗" in its header; clicking it opens the sidebar list |
| 418 | Filter a track in the popover, then look at the tab | The row says "(filtered)" (loaded, not drawn) |
| 419 | Hover the first row of a type | Its chevron strengthens from the subtle default |
| 420 | Select a row (band/variant click) | The whole row tints, not just the label chip |
| 421 | Tab through both surfaces | Focus rings intact; links reachable |
| 422 | Reload | Hidden/filtered states and the colour mode persist (unchanged) |

## 0.66.6 - model score colour mode (quick rows)

| # | Try | Watch for |
|---|---|---|
| 411 | Track Control → Color → **Model score** (homologs) | Rows shade light-red (low) to teal (high) confidence; letters stay readable |
| 412 | Hover a shaded cell | "model score N (98.5% probability)" / "(E-value 1e-5)" - the raw statistic |
| 413 | A hit with no probability and no E-value | Left unshaded (no misleading colour) |
| 414 | Switch back to Match quality | The glyph colours return; the mode is remembered per group |
| 415 | Reload | The chosen mode sticks (persisted with the session) |

## 0.66.5 - numbering offset + partial-HSP realignment (quick rows)

| # | Try | Watch for |
|---|---|---|
| 403 | Load a sequence, set Numbering offset to +20, import an experimental table at positions 1-3 | The values land at 21-23; the status/log says "global +20" |
| 404 | Change the offset again | Values re-place from the stored table (nothing is lost); out-of-range counted |
| 405 | Paste topology segments with an offset set | The source shifts; the consensus follows |
| 406 | Fetch a UniProt entry with an offset set | Feature rows shift by the same amount |
| 407 | Give the active row its own override, then clear it | The override wins, then falls back to the global |
| 408 | Run a BLAST search with weak/local hits | Partial rows carry "(partial N%)"; the tooltip names the range |
| 409 | Watch the same run's log | "partial hits realigned: N of M realigned (X columns filled)" |
| 410 | Hover a realigned row | The tooltip says it was realigned and why the glyphs mix |

## 0.66.3 - self-driven state round (quick rows)

| # | Try | Watch for |
|---|---|---|
| 398 | Import an experimental row, reload, hover it | Label/kind survive (fixed: the info map is now persisted) |
| 399 | Reload, then remove one restored row of each type | Only that row (and its info entry) goes - verified |
| 400 | Remove a row while the Guide card is open | The card stays open - verified in a browser |
| 401 | Undo a step you marked done | The override survives; the card reads "done (you)" - verified |
| 402 | File → New-feature highlights | The toggle works; the marking convention is retired (nothing expected marked) |

## 0.66.0 - methods report completeness (quick rows)

| # | Try | Watch for |
|---|---|---|
| 391 | Fetch + validate an entry, then Export → Methods summary (.md) | A "Structure validation" section with the outlier breakdown and quality percentiles |
| 392 | Import an experimental row with conservation loaded | An "Experimental per-residue data" section with mean and r |
| 393 | Assess variant effects, then export | A "Variant effect evidence" section (per provider + per substitution) |
| 394 | Load topology sources | "Topology consensus" in the evidence list (TM, N-terminus, conflicts) |
| 395 | Scan domains | Domain families named with their database |
| 396 | Any session with several sources | A "Data sources" provenance section listing what contributed |
| 397 | A bare sequence-only session | The report still renders (no empty sections) |

## 0.65.0 - experimental per-residue data (quick rows)

| # | Try | Watch for |
|---|---|---|
| 383 | Options → Data Sources → Experimental data: label + kind + `position value` lines → Add | Status: "Added …, N value(s), mean …, correlation with conservation r=…" |
| 384 | Switch the new row to a graph (Track Control → View as → graph) | Auto-scaled line plot, "Experimental score" axis, points per residue |
| 385 | Hover the graph points / the row tooltip | Value tooltips; the ℹ names the label + kind meaning |
| 386 | Paste one series of ≥5 numbers (no positions) | Positions 1..N assigned in order |
| 387 | Paste junk / positions out of range | Clear message; out-of-range counted, not silently dropped |
| 388 | Add a rule using `EXP:<key>` | The row is offered as a numeric rule source |
| 389 | Import DMS tolerance with conservation loaded | r reported; sign makes sense against the conservation pattern |
| 390 | Guide → structure step → "Import experimental data…" | Opens Options at the Experimental category |

## 0.64.0 - the loaded name feeds the lookups (quick rows)

| # | Try | Watch for |
|---|---|---|
| 378 | Paste Q2D text with a `Protein ID:` line (or a FASTA header), then open Options → UniProt | The lookup is pre-filled (accession mode, or a name search with that name) |
| 379 | Structure panel → Find PDB entries with a name but no accession | Sequence hits first; the status names the name fallback |
| 380 | A sequence with no exact PDB match but a recognisable name | The name search returns entries (GFP → 1GFL) with titles |
| 381 | Structure panel → Find UniProt accession | Resolves the name to an accession; Find PDB entries then ranks via PDBe |
| 382 | A name with no PDB entries at all | "no entries match …" - a clear failure, logged |

## 0.63.0 - find PDB entries from the sequence (quick rows)

| # | Try | Watch for |
|---|---|---|
| 371 | Load a sequence with no accession → Options → Structure → Find PDB entries | RCSB exact-identity hits with titles (GFP → 2G16, 2G5Z, 2G2S, 2G3D) |
| 372 | Load a sequence **with** an accession (or fetch one) → Find PDB entries | PDBe best structures, ranked by resolution (P42212 → 2WUR 0.90 Å first) |
| 373 | Press Fetch on a hit | Downloads and attaches it; the status says validation works now |
| 374 | Then Fetch validation (PDBe) | Outlier rows for that entry |
| 375 | Enter a nonsense id in the PDB box | Message points at Find PDB entries |
| 376 | Block the network and press Find PDB entries | Clear failure message; the activity log has the reason |
| 377 | A sequence with no experimental structure | "No experimental entries match the sequence" (not a crash) |

## 0.62.0 - category-based Data Sources (quick rows)

| # | Try | Watch for |
|---|---|---|
| 361 | Options → Data Sources | A "Data source" dropdown (9 categories); one panel at a time, with a short description |
| 362 | Switch categories | Exactly one panel shows; the hint under the dropdown changes |
| 363 | Any panel | Its provider picker / action / status live there, plus an "Open the website ↗" link |
| 364 | Input Data → "Data sources…" | Opens Options at UniProt lookup |
| 365 | Guide → any step → "⚙ Data sources" | Opens Options at that step's category (all eight steps) |
| 366 | Guide → topology step → "Paste topology…" | Still opens the topology category (the paste box) |
| 367 | Run a job from a panel | The status line updates inside that panel; the Log records it |
| 368 | Input Data after a job | Summary intact; the PDB fetch and its status are still there |
| 369 | Website links | Each opens the matching site as the manual fallback |
| 370 | Switch to another Options tab and back | The last data category is remembered |

## 0.61.0 - fetch PDB entry by id (quick rows)

| # | Try | Watch for |
|---|---|---|
| 357 | Type `1GFL` in the PDB ID box → Fetch PDB entry | Status: "Fetched 1GFL (PDB, 360126 bytes)"; the 3D viewer can show it |
| 358 | Then Fetch validation (PDBe) | Two chain rows, as in the validation card |
| 359 | Enter `zzzz` | Rejected before any request, with the expected form explained |
| 360 | Guide → structure step → "Fetch PDB entry…" | Opens Input Data with the box focused |

## 0.60.0 - PDBe structure validation (quick rows)

| # | Try | Watch for |
|---|---|---|
| 349 | Attach 1GFL.pdb → Fetch validation (PDBe) | Two rows (chains A+B); 76 clashes, 2 Ramachandran outliers |
| 350 | Hover a flagged cell | "validation outlier(s) - <type> (PDBe)" with real plurals |
| 351 | Row ℹ tooltip | Breakdown + "geometry 7.5, data 53.6, overall 11.5" |
| 352 | Guide read-out | Worst outlier types + entry quality for the entry |
| 353 | Fetch with no PDB-id-like structure | Clear message that it needs an experimental entry |
| 354 | Remove a validation row, then re-fetch | Removal sticks; re-fetch rebuilds it |
| 355 | Activity log | "PDBe validation 1GFL: 2 chain row(s) [breakdown | quality]" |
| 356 | Reload the session | Validation rows and tooltips survive (info map persisted) |

## Live checks (API calls + UI integration) — verified 0.66.3

Driven end to end with the app's own runners against the live services; no action needed from you.

| # | Result (2026-10-01) |
|---|---------------------|
| L1 | **phmmer**: 13 hits -> 13 Homologs rows, source `phmmer`; status "13 significant hits (13 reported)" |
| L2 | **BLAST**: 13 more rows, sources `phmmer` + `BLAST`; status names both |
| L3 | **Template table**: 26 metrics rows across both sources, no N/A; TSV copies with 27 lines; top = `sp|P42212|GFP_AEQVI` phmmer score 100.0 |
| L4 | **AlphaFold text**: `AF-P42212-F1-model_v6.pdb` (159 KB) and `AF-P02920-F1-model_v6.pdb` (273 KB), both valid PDB - verified in a browser; note the AlphaFold API answers **403 to Node's fetch**, so drive this one from the app |
| L5 | **Provider fallback**: covered by the harness (prefer reorders; a failing provider falls through) - not re-driven live |
| L6 | **Methods report**: "Data sources" lists phmmer + BLAST, "Template quality" present with the mixed ranking |

## Known gaps / already-suspect areas (don't be surprised)

- **FIXED (0.66.4): UI copy tone.** The 26-string sweep is done (toasts, guide hints, read-out
  insights). New strings should keep the same rule: state the fact and the way forward, prefer
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
- **FIXED (0.66.4): older saves** are now explained on restore - a log entry + toast names the
  groups whose rows have no backing data (topology/domain/UniProt feature) and the two ways out.
  Migration is not possible (the backing data was never in the file).
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
6ae. 297–302 (BLAST homolog provider - new 0.53.0; card at the top, check 297 first).
6af. 303–308 (Homolog Templates table upgrade - 0.54.0; card at the top, check 303 first).
6ag. 309–314 (topology consensus completion - new 0.55.0; card at the top, check 310 first).
6ah. 315–318 (per-provider menu + source-aware glyph wording - 0.55.1; check 317 first).
6ai. 319–325 (AlphaMissense variant effects - new 0.56.0; card at the top, check 319 first).
6aj. 326–331 (variant effect provider framework - new 0.57.0; card at the top, check 326 first).
6ak. 332–340 + the reference-systems table (InterProScan topology/domains - new 0.58.0; check 332 first).
6al. 341–348 (activity log + 3D console cleanup - new 0.59.0; card at the top, check 343 first).
6am. 349–356 (PDBe structure validation - new 0.60.0; card at the top, check 349 first).
6an. 357–360 (fetch PDB entry by id - new 0.61.0; check 357 first).
6ao. 361–370 (category-based Data Sources - new 0.62.0; check 361 first).
6ap. 371–377 (find PDB entries from the sequence - new 0.63.0; check 371 first).
6aq. 378–382 (the loaded name feeds the lookups - new 0.64.0; check 378 first).
6ar. 383–390 (experimental per-residue data - new 0.65.0; check 383 first).
6as. 391–397 (methods report completeness - 0.66.0; check 391 first).
6at. 398–402 (self-driven state round - 0.66.3; the X-items it closes are noted in their rows).
6au. 403–410 (numbering offset + partial-HSP realignment - new 0.66.5; check 403 first).
6av. 411–415 (model score colour mode - new 0.66.6; check 411 first).
6aw. 416–422 (Tracks tab vs quick controls + row polish - new 0.66.7; check 417 first).
6ax. 423–428 (colour the 3D model by any track - new 0.66.8; check 424 first).
6ay. 429–434 (ensemble RMSD matrix + formula fix - new 0.66.9; check 432 first - it was silently wrong).
7. 1–12 (design pass + HMMER) last, as they are the most self-contained.
