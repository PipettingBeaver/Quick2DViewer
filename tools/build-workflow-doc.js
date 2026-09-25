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
const RULE_PRESETS = new Function(`${extractLiteral('RULE_PRESETS')}; return RULE_PRESETS;`)();
const RULE_SOURCE_LABELS = new Function(`${extractLiteral('RULE_SOURCE_LABELS')}; return RULE_SOURCE_LABELS;`)();

// Local mirror of the app's describeRuleCondition (the app version reads the
// loaded tracks, which do not exist in this build context).
function srcLabel(id) {
  if (RULE_SOURCE_LABELS[id]) return RULE_SOURCE_LABELS[id];
  if (id.indexOf('group:') === 0) return id.slice(6) + ' (any track)';
  if (id.indexOf('track:') === 0) return id.slice(6);
  return id;
}
function condText(c) {
  const l = srcLabel(c.source);
  if (c.kind === 'numeric') {
    const op = { '<': '<', '<=': '≤', '>': '>', '>=': '≥', '==': '=', '!=': '≠' }[c.op] || c.op;
    return `${l} ${op} ${c.value}`;
  }
  if (c.op === 'annotated') return `${l} annotated`;
  if (c.op === 'not_annotated') return `${l} not annotated`;
  return `${l} = ${c.value}`;
}

function doiUrl(doi) { return 'https://doi.org/' + doi; }

// The step text carries real links (the app renders them as HTML); the document
// is Markdown, so convert the few anchors rather than duplicating the text.
function mdLinks(text) {
  return String(text || '').replace(/<a\s+[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g, '[$2]($1)');
}

function render() {
  const lines = [];
  lines.push('# Quick2DViewer: Protein Characterization Workflow (reference)');
  lines.push('');
  lines.push('> **Generated file, do not edit by hand.** Regenerate with');
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
    lines.push(`- **${q.label}**: ${q.options.map(o => o.label).join(' / ')}`);
  });
  lines.push('');
  lines.push('## Steps');
  lines.push('');
  WORKFLOW_STEPS.forEach((s, i) => {
    lines.push(`### ${i + 1}. ${s.title}`);
    lines.push('');
    lines.push(`**Purpose.** ${mdLinks(s.desc)}`);
    lines.push('');
    lines.push(`**Why it matters.** ${mdLinks(s.why)}`);
    lines.push('');
    lines.push('**How to read it.**');
    (s.how || []).forEach(h => lines.push(`- ${mdLinks(h)}`));
    lines.push('');
    lines.push(`**In-app action.** \`${s.action.label}\`` +
      (s.extraActions || []).map(a => ` · \`${a.label}\``).join(''));
    lines.push('');
    const qs = STEP_QUESTIONS[s.id] || [];
    if (qs.length) {
      lines.push('**Guided questions** (the answers choose the concrete action offered).');
      lines.push('');
      qs.forEach(q => lines.push(`- ${q.label}: ${q.options.map(o => o.label).join(' / ')}`));
      lines.push('');
    }
    if (s.priorityNote) {
      lines.push(`**Promoted when.** ${mdLinks(s.priorityNote)}`);
      lines.push('');
    }
    if (s.relevantNote) {
      lines.push(`**Ruled out when.** ${mdLinks(s.relevantNote)}`);
      lines.push('');
    }
    if ((s.refs || []).length) {
      lines.push('**Citations.**');
      s.refs.forEach(r => lines.push(`- ${r.cite}. <${doiUrl(r.doi)}>`));
    } else {
      lines.push('**Citations.** _none yet._');
    }
    lines.push('');
  });
  lines.push('## Rule presets');
  lines.push('');
  lines.push('Curated rules shipped in the Rules panel (the guide suggests the relevant');
  lines.push('ones from your intake answers and loaded data). Each references a *group*');
  lines.push('("any TM track") rather than one predictor key, so re-running a predictor or');
  lines.push('swapping a Foldseek database does not break it. Conditions marked with a');
  lines.push('per-condition "needs" note in the app are simply unavailable until that data');
  lines.push('is loaded.');
  lines.push('');
  RULE_PRESETS.forEach((p, i) => {
    lines.push(`### ${i + 1}. ${p.name}`);
    lines.push('');
    lines.push(`**Query (${p.mode === 'any' ? 'ANY' : 'ALL'}).** ` + p.conditions.map(condText).join(' · '));
    lines.push('');
    lines.push(`**Rationale.** ${p.rationale}`);
    lines.push('');
    if ((p.refs || []).length) {
      lines.push('**Citations.**');
      p.refs.forEach(r => lines.push(`- ${r.cite}. <${doiUrl(r.doi)}>`));
      lines.push('');
    }
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
console.log(`WORKFLOW.md written (${out.length} chars, ${WORKFLOW_STEPS.length} steps, ${GUIDE_QUESTIONS.length} intake + ${totalQs} step questions, ${RULE_PRESETS.length} rule presets)`);
