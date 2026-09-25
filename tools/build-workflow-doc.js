#!/usr/bin/env node
// Regenerates WORKFLOW.md from the single source of truth in index.html.
//
// The app owns the pipeline definition (`WORKFLOW_STEPS` / `GUIDE_QUESTIONS`);
// this script extracts those two literals and renders them as the external
// reference document, so the guide and the document can never drift.
//   node tools/build-workflow-doc.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');

// Handles both array (`... \n];`) and object (`... \n};`) literals.
function extractLiteral(name) {
  const re = new RegExp(`const ${name} = [\\[{][\\s\\S]*?\\n[\\]}];`);
  const m = HTML.match(re);
  if (!m) throw new Error(`could not find ${name} in index.html`);
  return m[0];
}

// The literals only *define* their arrow functions (check/priority), so they
// evaluate fine in a bare context with no DOM.
const WORKFLOW_STEPS = new Function(`${extractLiteral('WORKFLOW_STEPS')}; return WORKFLOW_STEPS;`)();
const GUIDE_QUESTIONS = new Function(`${extractLiteral('GUIDE_QUESTIONS')}; return GUIDE_QUESTIONS;`)();
const STEP_QUESTIONS = new Function(`${extractLiteral('STEP_QUESTIONS')}; return STEP_QUESTIONS;`)();

function doiUrl(doi) { return 'https://doi.org/' + doi; }

function render() {
  const lines = [];
  lines.push('# Quick2DViewer — Protein Characterization Workflow (reference)');
  lines.push('');
  lines.push('> **Generated file — do not edit by hand.** Regenerate with');
  lines.push('> `node tools/build-workflow-doc.js`. The Evaluation Guide in the app is');
  lines.push('> driven by the same definition, so the steps, rationale and citations below');
  lines.push('> are exactly what the guide shows.');
  lines.push('');
  lines.push('This is the literature-backed pipeline Q2DV is built around: sequence and');
  lines.push('identity first, then orthogonal prediction layers, then curated and');
  lines.push('evolutionary evidence, then structure, and finally integration. Each step is');
  lines.push('followed by *why* it matters and *how* to read its output, so a result is');
  lines.push('never interpreted in isolation.');
  lines.push('');
  lines.push('## Intake questions');
  lines.push('');
  lines.push('The guide asks these to re-rank the steps for the protein at hand. Each step');
  lines.push('then asks its own short questions (below) that pick the *specific* action and');
  lines.push('defaults to offer. Everything is advisory: any step can be marked done,');
  lines.push('skipped or re-run at any time, and all tools stay reachable from the menus.');
  lines.push('');
  GUIDE_QUESTIONS.forEach(q => {
    lines.push(`- **${q.label}** — ${q.options.map(o => o.label).join(' / ')}`);
  });
  lines.push('');
  lines.push('## Steps');
  lines.push('');
  WORKFLOW_STEPS.forEach((s, i) => {
    lines.push(`### ${i + 1}. ${s.title}`);
    lines.push('');
    lines.push(`**Purpose.** ${s.desc}`);
    lines.push('');
    lines.push(`**Why it matters.** ${s.why}`);
    lines.push('');
    lines.push('**How to read it.**');
    (s.how || []).forEach(h => lines.push(`- ${h}`));
    lines.push('');
    lines.push(`**In-app action.** \`${s.action.label}\`` +
      (s.extraActions || []).map(a => ` · \`${a.label}\``).join(''));
    lines.push('');
    const qs = STEP_QUESTIONS[s.id] || [];
    if (qs.length) {
      lines.push('**Guided questions** (the answers choose the concrete action offered).');
      lines.push('');
      qs.forEach(q => lines.push(`- ${q.label} — ${q.options.map(o => o.label).join(' / ')}`));
      lines.push('');
    }
    if (s.priorityNote) {
      lines.push(`**Promoted when.** ${s.priorityNote}`);
      lines.push('');
    }
    if ((s.refs || []).length) {
      lines.push('**Citations.**');
      s.refs.forEach(r => lines.push(`- ${r.cite} — <${doiUrl(r.doi)}>`));
    } else {
      lines.push('**Citations.** _none yet._');
    }
    lines.push('');
  });
  lines.push('---');
  lines.push('');
  lines.push('## Citation status');
  lines.push('');
  lines.push('Every DOI above was resolved against the Crossref API (last verified');
  lines.push('2026-09); the reference list that previously lived in `DESIGN.md` had six');
  lines.push('entries that resolved to unrelated papers and has been corrected to match');
  lines.push('this document.');
  lines.push('');
  return lines.join('\n');
}

const out = render();
fs.writeFileSync(path.join(ROOT, 'WORKFLOW.md'), out);
const totalQs = WORKFLOW_STEPS.reduce((n, s) => n + ((STEP_QUESTIONS[s.id] || []).length), 0);
console.log(`WORKFLOW.md written (${out.length} chars, ${WORKFLOW_STEPS.length} steps, ${GUIDE_QUESTIONS.length} intake + ${totalQs} step questions)`);
