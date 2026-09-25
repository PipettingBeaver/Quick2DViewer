# Quick2DViewer — UX Guidelines & Design-Pass Checklist

A lens for evaluating Q2DV's interface, and a concrete checklist to run on each
feature ("a design pass"). Grounded in established UX research + current (2026)
best practice; see §7 for sources.

## 0. How to use this

- **A design pass** = walk the checklist in §5 over the *changed* screens, with
  real data (a loaded protein + structures), and note violations.
- **New UI is tagged `.qa-new`** — a purple dashed outline — so additions are easy
  to spot and test rather than described in verbose code comments. Toggle it from
  **File → New-feature highlights: ON/OFF** (persisted). Remove the tag once a
  design pass has been done.
- Cheap to re-run: the checklist is short by design.

## 1. Principles (the "why")

1. **User-centricity / intent before click-count.** Support the researcher's goal
   (characterize a protein), not a minimal number of clicks. A few extra steps are
   fine if they match the mental model.
2. **Consistency** — visual (color, type, spacing, iconography) *and* functional
   (the same control behaves the same everywhere). Reuse patterns; don't invent a
   second way to do the same thing.
3. **Hierarchy** — information architecture (what groups with what) and visual
   hierarchy (what draws the eye first). One obvious primary action per view.
4. **Accessibility** — WCAG 2.2 AA (now ISO-standardized): contrast ≥ 4.5:1 for
   text, visible focus states, keyboard reachability, no color-only meaning,
   respect `prefers-reduced-motion`.
5. **Gestalt** — proximity/similarity/common-region: things that belong together
   should be *visually* grouped. Grouping beats separators and labels.
6. **Information density** — Q2DV is a data instrument: dense is good, *cluttered*
   is not. Show what's needed at this moment; push the rest behind progressive
   disclosure (tabs, accordions, modals).
7. **Data-ink (Tufte)** — actions should live *in/on* the data representation;
   strip chrome. The data is the interface.
8. **Feedback & micro-interactions** — purposeful hover/active/focus transitions
   that orient the user and confirm state; never decorative motion for its own sake.
9. **Words matter** — every label, tooltip, and empty state is a design decision.
   Prefer self-evident; when not, one short sentence. Avoid jargon in the UI.
10. **States** — design empty, loading, error, and success — not just the happy path.

## 2. Q2DV-specific applications

- **The grid + Track Control** is the core instrument. Keep per-residue chrome
  minimal; the letter + color *is* the content. Actions belong on the row (label)
  and in the chevron popover, not in extra buttons.
- **Sidebar** = Selection / Tracks / Workflow. Tracks/Workflow are *setup*; the
  Selection tab is the *work*. Setup should collapse; work should stay open.
- **Right pattern per job:** *popover* for a quick, contextual action (Track
  Control, bands); *modal* for a focused, blocking task (Options, rule editor);
  *inline* for something used while looking at the data (legend, status).
  Don't use a modal as an escape hatch for a crowded page.
- **The "Tracks" (right) vs "Track Control" (left) overlap** is acceptable
  (different contexts), but any *new* control should have exactly one home.
- **Density:** default to compact for loaded-data lists; expand on demand.

## 3. Anti-patterns observed in Q2DV (avoid repeating)

- **Stray helper text** ("per type → expand for tracks") — if a control needs a
  sentence to explain itself, fix the affordance (e.g. chevrons) or use a tooltip.
- **Labeled buttons where an icon suffices** ("expand all"/"collapse all" →
  `+` / `−` with tooltips).
- **Redundant affordances** doing the same job in two places with different styling.
- **Heavy chrome** (boxed chevrons, bordered icons) that competes with the data.
- **Comments explaining *what*** in code instead of clear names + a QA marker.

## 4. Visual grammar (tokens in use)

- **Type scale:** `0.68 / 0.72 / 0.78 / 0.85 / 0.95 / 1.05 rem`; monospace for
  sequence/labels, system sans for UI.
- **Spacing:** 4 / 6 / 8 / 12 / 16 px rhythm.
- **Radius:** 4 px controls, 6–8 px panels, 999 px pills.
- **Color semantics:** slate greys for structure; blue `#2563eb` = primary/active;
  purple `#a855f7` = *new/QA only*; warm→cool for numeric bands (blue = conserved).
- **Motion:** `0.12s ease` for hover/state; nothing animated that changes layout.

## 5. Design-pass checklist

**Hierarchy & grouping**
- [ ] Is the primary action obvious without reading?
- [ ] Are related controls grouped (Gestalt), not just separated by lines?
- [ ] Does anything compete for attention that shouldn't?

**Consistency**
- [ ] Does this reuse an existing pattern (popover/modal/inline) rather than a new one?
- [ ] Same control → same look/behavior everywhere? Same labels for the same concept?

**Density & disclosure**
- [ ] Is the default view compact? Are rarely-needed things collapsed/behind a click?
- [ ] Any stray helper text that should be a tooltip or removed?

**Affordance & feedback**
- [ ] Hover/active/focus states on every interactive element? (and *only* on interactive ones)
- [ ] Do icon-only controls have tooltips? Do they need labels instead?

**Accessibility**
- [ ] Keyboard reachable + visible focus? Contrast ≥ 4.5:1? No color-only meaning?
- [ ] `prefers-reduced-motion` respected for any animation?

**States & words**
- [ ] Empty / loading / error / success designed?
- [ ] Microcopy short, self-evident, non-jargony?

**Data-ink**
- [ ] Can any border, box, or label be removed without losing meaning?

## 6. Suggested polish targets (running list)

- ~~The selection workspace block is long; collapse FASTA/metrics.~~ **done (0.16.0)**
- ~~Unify all "collapse/expand" affordances on the ghost-caret style.~~ **done (0.16.0)**
- ~~Menus: group as File / View / Analyze / Export / Help.~~ **done (0.16.0)**
- Options modal tabs are good; move per-track Config *into* the row's popover
  where possible.
- Consider unifying the Track Control popover and the Tracks tab (one "manager" home).

## 7. References

- Nielsen, J. *10 Usability Heuristics for User Interface Design* (NN/g, 1994/updated).
- Shneiderman, B. *Eight Golden Rules of Interface Design*.
- *Web Content Accessibility Guidelines (WCAG) 2.2* — W3C (ISO/IEC 40500).
- Tufte, E. *The Visual Display of Quantitative Information* (data-ink ratio).
- Gestalt principles of perception (proximity, similarity, common region, continuity).
- *UX Design Principles (2026)* — UX Design Institute / UXPin.
- *Designing data-intensive applications* — Thomas Sutton, UX Collective (2026).
- *Designing for information density* — UX Collective.
- W3C *Web Sustainability Guidelines* (WSG).
