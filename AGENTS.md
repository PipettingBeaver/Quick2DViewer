# Quick2DViewer — agent notes

Single-file, dependency-free, client-side protein viewer. `index.html` is the entire
app (~20k lines: CSS, markup, one `<script>`); `package.json` is dev tooling only.
No build step, no backend. Deployed to GitHub Pages from `main` (root `index.html`).

## Commands

- `npm test` (`node tests/run.js`) — headless regression harness, ~1350 checks, ~1s.
  Extracts the single `<script>` from `index.html` and runs it in a stubbed-DOM VM
  against fixtures in `tests/fixtures/`. Add checks here for every feature.
- `npm run doc:workflow` (`node tools/build-workflow-doc.js`) — regenerates
  `WORKFLOW.md` from literals in `index.html`. Never edit `WORKFLOW.md` by hand.

No lint, typecheck, formatter, or CI is configured.

## Release invariant

- `APP_VERSION` in `index.html` must equal the top `## [x.y.z]` heading in
  `CHANGELOG.md`; `npm test` fails otherwise.
- Versioning is day-based: middle number advances once per day, last per update
  that day; every push is a release; `1.0.0` is reserved. Commit messages read
  `0.66.26: summary of change`.

## Editing quirks

- Keep exactly one `<script>` block in `index.html`; the test regex grabs the
  first `<script>...</script>`, and the doc tool parses literals out of it.
- `tools/build-workflow-doc.js` extracts `const WORKFLOW_STEPS / GUIDE_QUESTIONS /
  STEP_QUESTIONS / RULE_PRESETS / RULE_SOURCE_LABELS = [...]` by regex — keep those
  literals in that exact `= [` … `\n];` shape. After touching steps, questions, or
  presets, run `npm run doc:workflow`; tests assert `WORKFLOW.md` carries every
  step title, DOI, preset, and per-step option.
- The harness stubs the DOM and often replaces `renderViewer` with a no-op, so UI
  layout/events are unverified. New features need a check in `tests/run.js` plus a
  feature test card in `QA_CHECKLIST.md` naming the surface they attach to.

## Architecture

- Tracks live in `parsedTracks[key]`, prefix-grouped: `AA`, `SS_`/`TM_`/`DO_`/`CC_`/
  `SP_` (Quick2D), `HL_` homologs, `UP_` UniProt, `DM_` domains, `TP_` topology,
  `XC_` cross-checks, `VAR_`, `RULE_`, `_pLDDT`/`_RSA`/`_RMSF`/`_EXP`/`_Cofactors`.
  `trackMeta` records provenance; `TRACK_REMOVERS` is keyed by `getTrackGroup()`
  result, not by prefix.
- `WORKFLOW_STEPS` is the single source of truth for the Evaluation Guide, Input
  Data checklist, and methods report. Place new features per `DESIGN.md` §16
  (taxonomy) and §20 (surface placement rules).
- Nothing leaves the device unless the user enables the external-services opt-in.
  Only add APIs whose CORS behaviour is verified (`DESIGN.md` §3); several
  providers are deliberately registered but disabled with the reason recorded.

## Docs

- `DESIGN.md` — living design/roadmap; `CHANGELOG.md` — release notes (Keep a
  Changelog); `WORKFLOW.md` — generated reference; `UX_GUIDELINES.md` — design-pass
  checklist; `EVALUATION.md` — scoring rubric. `POTENTIAL_CHANGES.md`, `TerC/`, and
  `backups/` are gitignored local files.
- Run via `file://` or `python3 -m http.server`; in-app fetches of `CHANGELOG.md` /
  `WORKFLOW.md` behave differently under `file://` (a fallback link is shown).

## Definition of done
- `npm test` passes, including the release invariant (`APP_VERSION` == top `CHANGELOG.md` heading).
- New feature: a check in `tests/run.js` plus a feature test card in `QA_CHECKLIST.md`; surfaces the harness cannot verify are checked manually and that is stated.
- After touching `WORKFLOW_STEPS`/questions/presets, run `npm run doc:workflow`; never hand-edit `WORKFLOW.md`.
- Commit message `x.y.z: summary` with the day-based version bump.
- **Commit and push as the default.** Every push is a release, and the user QA's the
  *deployed* browser version (GitHub Pages), because the local `file://` copy cannot
  make API calls and live web connections are what they need to verify. So: finish a
  feature, bump the version, commit, push, then let them test it live. Verify the
  committed state independently (e.g. `git worktree add` + `node tests/run.js` per
  commit) before pushing. Keep versions one feature per release; when several
  features are in flight, renumber rather than bundling them.
- Diff-only edits to `index.html`; never a whole-file rewrite. Follow the global `code-standards` skill.
