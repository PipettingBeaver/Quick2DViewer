#!/usr/bin/env node
// Headless regression harness for Quick2DViewer.
//   node tests/run.js
// Extracts the <script> from index.html, loads it in a stubbed-DOM VM, and
// runs invariant + feature checks. Exits non-zero on the first failure.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
const CHANGELOG = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
const WORKFLOW_MD = fs.readFileSync(path.join(ROOT, 'WORKFLOW.md'), 'utf-8');

// ---------- DOM stubs ----------
function makeEl() {
  const el = {
    style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return ''; } },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    dataset: {}, attrs: {}, children: [], _text: '',
    set textContent(v) { this._text = String(v); },
    get textContent() { return this._text; },
    innerHTML: '', value: '', checked: false, type: '', disabled: false, hidden: false,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k]; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
    insertBefore(c) { this.children.unshift(c); return c; },
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }; },
    remove() {}, closest() { return null; }, contains() { return false; },
    focus() {}, blur() {}, click() {},
  };
  return el;
}
const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: cb => setTimeout(cb, 16), cancelAnimationFrame: clearTimeout,
  performance: { now: () => Date.now() },
  Date, Math, JSON, Promise, Map, Set, WeakMap, RegExp, Error, parseInt, parseFloat, isNaN, isFinite,
  URLSearchParams: class URLSearchParams { constructor(o) { this._o = o || {}; } toString() { return Object.keys(this._o).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(this._o[k])).join('&'); } },
  AbortController: class AbortController { constructor() { this.signal = {}; } abort() {} },
  XMLSerializer: class XMLSerializer { serializeToString() { return ''; } },
  Image: class Image { set src(v) {} },
  document: {
    addEventListener() {}, removeEventListener() {},
    getElementById() { return makeEl(); },
    querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    createElement() { return makeEl(); }, createElementNS() { return makeEl(); },
    createTextNode() { return { nodeType: 3 }; },
    body: makeEl(), head: makeEl(), documentElement: makeEl(), title: '', activeElement: null,
    execCommand() { return false; },
  },
  location: { href: '', host: '', protocol: 'file:', pathname: '', search: '', hash: '', reload() {}, assign() {}, replace() {} },
  navigator: { userAgent: 'node', platform: 'linux', language: 'en', clipboard: { writeText() { return Promise.resolve(); } } },
  localStorage: { _s: {}, getItem(k) { return this._s[k] === undefined ? null : this._s[k]; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; }, clear() { this._s = {}; } },
  history: { pushState() {}, replaceState() {}, back() {}, state: {} },
  fetch() { return Promise.resolve({ ok: false, json() { return Promise.resolve({}); }, text() { return Promise.resolve(''); } }); },
  URL: { createObjectURL() { return 'blob:stub'; }, revokeObjectURL() {} },
  Blob: class Blob { constructor() { this.size = 0; } },
  FormData: class FormData { append() {} },
  Event: class Event { constructor(t) { this.type = t; } },
  CustomEvent: class CustomEvent { constructor(t) { this.type = t; } },
  crypto: { randomUUID: () => 'uid-' + Date.now(), getRandomValues() {} },
  confirm: () => true,
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
sandbox.addEventListener = function () {}; sandbox.removeEventListener = function () {};
sandbox.matchMedia = function () { return { matches: false, addListener() {}, removeListener() {} }; };
Object.assign(sandbox, { AMINO_ACID_BG_FREQUENCIES: {}, AA_ALPHABET_ORDER: 'ARNDCQEGHILKMFPSTWYV', blosum62Score: (a, b) => (a === b ? 4 : -1) });

// ---------- load ----------
const scriptMatch = HTML.match(/<script>\n([\s\S]*?)\n<\/script>/);
if (!scriptMatch) { console.error('FAIL: could not extract <script> from index.html'); process.exit(1); }
const app = scriptMatch[1];
vm.createContext(sandbox);
try { vm.runInContext(app, sandbox, { timeout: 60000 }); }
catch (e) { console.error('FAIL: app threw on load:', e.message); console.error(e.stack); process.exit(1); }

const ctxRun = (code) => vm.runInContext(code, sandbox);
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ok  ' + msg); }
  else { failed++; console.error('FAIL  ' + msg); }
}
function section(name) { console.log('\n# ' + name); }

// ---------- tests ----------
section('load + version invariant');
assert(typeof ctxRun('APP_VERSION') === 'string', 'APP_VERSION is defined');
const changelogTop = (CHANGELOG.match(/^## \[(\d+\.\d+\.\d+)\]/m) || [])[1];
assert(changelogTop === ctxRun('APP_VERSION'), `APP_VERSION (${ctxRun('APP_VERSION')}) matches CHANGELOG top release (${changelogTop})`);
assert(ctxRun(`typeof renderViewer === 'function' && typeof buildTrackRow === 'function'`), 'core render functions present');

section('track provenance (trackMeta)');
assert(ctxRun(`getTrackSource('SS_PSIPRED')`) === 'Quick2D', 'Quick2D source derived from prefix');
assert(ctxRun(`getTrackSource('UP_Sites')`) === 'UniProt', 'UniProt source');
assert(ctxRun(`getTrackSource('TP_Consensus')`) === 'Topology', 'Topology source');
assert(ctxRun(`getTrackSource('M_pLDDT')`) === 'Structure', 'structure source');
ctxRun(`homologHitsInfo['HL_09_src'] = { source: 'Foldseek' };`);
assert(ctxRun(`getTrackSource('HL_09_src')`) === 'Foldseek', 'homolog source read from homologHitsInfo');
ctxRun(`setTrackMeta('SS_PSIPRED', { source: 'Custom' });`);
assert(ctxRun(`getTrackSource('SS_PSIPRED')`) === 'Custom', 'trackMeta override wins over derived source');

section('core: track rows render for every track type');
const R = 'MKTAYIAKQRQISFVKSHFSRQDILQDILDLWIYHTQGYFP'.slice(0, 37);
ctxRun(`parsedTracks = { AA: ${JSON.stringify(R)},
  SS_PSIPRED: 'H'.repeat(${R.length}), TM_TMHMM: 'M'.repeat(${R.length}),
  DO_IUPred: 'D'.repeat(${R.length}), HL_01_7MDF: '|'.repeat(${R.length}),
  VAR_x: ' '.repeat(${R.length}), UP_Sites: 'S'.repeat(${R.length}), TP_Consensus: 'M'.repeat(${R.length}) };
homologHitsInfo = { HL_01_7MDF: { rank:1, hitId:'7MDF', hitDesc:'x', stats:{ Probab:'99', 'E-value':'1e-9', Aligned_cols:'30', Identities:'40' }, aaTrack:'A'.repeat(${R.length}) } };
trackControlState = { hidden:{}, hideSymbols:{}, fullBar:{}, filtered:{}, aaSeq:{}, consColor:{}, viewOverride:{} };`);
const rowKeys = ['AA', 'SS_PSIPRED', 'TM_TMHMM', 'DO_IUPred', 'HL_01_7MDF', 'VAR_x', 'UP_Sites', 'TP_Consensus'];
const rowErrs = ctxRun(`(function(){ const out={}; ${JSON.stringify(rowKeys)}.forEach(k => { try { buildTrackRow(k, parsedTracks, ${R.length}, true); out[k]='ok'; } catch(e){ out[k]=e.name+': '+e.message; } }); return out; })()`);
rowKeys.forEach(k => assert(rowErrs[k] === 'ok', `buildTrackRow(${k}) — ${rowErrs[k]}`));

section('track-row polish');
assert(/track-group-first/.test(ctxRun(`buildTrackRow('SS_PSIPRED', parsedTracks, ${R.length}, true).className`)), 'group-first rows carry the separator class');
assert(!/track-group-first/.test(ctxRun(`buildTrackRow('SS_PSIPRED', parsedTracks, ${R.length}, false).className`)), 'non-first rows do not');

section('track groups / labels / order');
assert(ctxRun(`getTrackGroup('HL_01_7MDF')`) === 'HL', 'homolog group resolves');
assert(ctxRun(`getTrackGroup('UP_Sites')`) === 'UP', 'UniProt group');
assert(ctxRun(`getTrackGroup('TP_Consensus')`) === 'TP', 'Topology group');
assert(ctxRun(`getTrackCategoryOrder('UP_Sites') > 0`), 'category order resolves');

section('conservation engine');
const cons = ctxRun(`(function(){ parsedTracks = { AA: 'X'.repeat(4) }; const a = computeConservationScores(['AAAA','AAAT','AAAG'], 'shannon'); return { n: a.length, first: a[0], last: a[3] }; })()`);
assert(cons.n === 4 && cons.first > cons.last, 'Shannon: conserved first column > divergent last column');

section('UniProt feature parsing (both backends)');
const upA = ctxRun(`parseUniProtFeatures({ features: [ { type:'Signal', location:{ start:{value:1}, end:{value:22} } }, { type:'Subcellular location', location:{ value:'x' } } ] })`);
assert(upA.length === 1 && upA[0].type === 'Signal', 'rest.uniprot.org parser (skips non-residue)');
const upB = ctxRun(`parseUniProtFeaturesEBI({ features: [ { type:'TRANSMEM', begin:'12', end:'30' }, { type:'CHAIN', begin:'1', end:'99' } ] })`);
assert(upB.length === 1 && upB[0].type === 'Transmembrane', 'EBI parser maps TRANSMEM, drops CHAIN');

section('topology parser + consensus');
const tp = ctxRun(`parseTopologyText('inside 1 11\\nTMhelix 12 30\\noutside 31 40', 40)`);
assert(tp && tp.state[11] === 'M' && tp.state[30] === 'o', 'TMHMM segments parsed');
ctxRun(`topologySources = [ { name:'Topology 1', state:'iiiiMMMMoooo' }, { name:'Topology 2', state:'iiiiiMMMooooo' } ]; parsedTracks.AA = 'X'.repeat(13); renderViewer = function(){}; schedulePersist = function(){}; applyTopologySources();`);
assert(ctxRun(`typeof parsedTracks['TP_Consensus']`) === 'string', 'topology consensus track built');

section('homolog template metrics');
const hm = ctxRun(`(function(){ homologHitsInfo = { HL_01_A: { rank:1, hitId:'7MDF', hitDesc:'d;x', stats:{ Probab:'99', 'E-value':'1e-9', Aligned_cols:'90', Identities:'45' } } }; parsedTracks = { AA: 'X'.repeat(100), HL_01_A: ' '.repeat(100) }; cachedStructureTexts = {}; return homologTemplateMetrics(); })()`);
assert(hm.length === 1 && hm[0].hasPdb === true && Math.abs(hm[0].score - (99 * 45 * 90) / 10000) < 1e-6, 'template score = probab×identity×coverage');

section('export helpers');
assert(ctxRun(`escapeXml('<a&"b>')`) === '&lt;a&amp;&quot;b&gt;', 'escapeXml escapes');
assert(ctxRun(`svgColor('transparent')`) === null && ctxRun(`svgColor('rgb(1,2,3)')`) === 'rgb(1,2,3)', 'svgColor transparency handling');
const del = ctxRun(`(function(){ parsedTracks = { AA: 'X'.repeat(10), M_pLDDT: Array.from({length:10},()=>({type:'plddt',val:90})) }; selectStart=null; selectEnd=null; const d = buildMetricsDelimited('\\t'); return d ? d.text.split('\\n').length : 0; })()`);
assert(del === 2, 'buildMetricsDelimited produces header + 1 row');

section('HTML escaping of track-derived text');
const escTip = ctxRun(`buildPredictorTooltipHTML({ name: '<img src=x>', description: 'a & b' })`);
assert(!/<img/.test(escTip) && /&lt;img/.test(escTip) && /&amp;/.test(escTip), 'buildPredictorTooltipHTML escapes untrusted name/description');
const escStruct = ctxRun(`structureEscapeHtml('<script>')`);
assert(escStruct === '&lt;script&gt;', 'structureEscapeHtml escapes angle brackets');

section('changelog markdown renderer');
const mdHtml = ctxRun(`renderChangelogMarkdown('## [1.0.0] - x\\n\\n### Added\\n\\n- a **b**\\n')`);
assert(/<h3 class="cl-ver">\[1\.0\.0\]/.test(mdHtml) && /<strong>b<\/strong>/.test(mdHtml), 'changelog markdown renders headings + bold');

section('confirm dialog (headless-safe)');
assert(ctxRun(`typeof confirmDialog === 'function'`), 'confirmDialog is defined');

section('Foldseek parsing + track creation');
assert(ctxRun(`foldseekPdbId('2iiu-assembly1.cif.gz_A desc')`) === '2IIU', 'foldseekPdbId extracts the 4-char PDB id');
assert(ctxRun(`foldseekQualityChar('A','A')`) === '|' && ctxRun(`foldseekQualityChar('A','-')`) === ' ', 'quality glyphs: identity | , gap blank');
const fsHits = ctxRun(`parseFoldseekResults({ results: [ { db:'pdb100', alignments: [ [ { target:'2iiu-assembly1.cif.gz_A desc', seqId:26, prob:0.045, eval:1e-3, score:23, qStartPos:6, qEndPos:28, qAln:'IAKQRQISFVKSHFSRQDILDLW', dbAln:'IQLRRQLFALESELNPVDVMFLY', qLen:37, dbLen:200, taxName:'x' } ] ] } ] })`);
assert(fsHits.length === 1 && fsHits[0].pdbId === '2IIU' && fsHits[0].qStart === 6, 'parseFoldseekResults flattens + extracts pdbId/span');
ctxRun(`parsedTracks = { AA: 'MKTAYIAKQRQISFVKSHFSRQDILDLWIYHTQGYFP' }; homologHitsInfo = {}; graphHighlights = {};`);
const fsAdded = ctxRun(`applyFoldseekHits(${JSON.stringify(fsHits)})`);
assert(fsAdded === 1, 'applyFoldseekHits adds one track');
const fsKey = ctxRun(`Object.keys(parsedTracks).filter(k => k.startsWith('HL_'))[0]`);
assert(!!fsKey && ctxRun(`homologHitsInfo['${fsKey}'].source`) === 'Foldseek', 'Foldseek hit tagged source: Foldseek');
assert(ctxRun(`getTrackSource('${fsKey}')`) === 'Foldseek', 'getTrackSource resolves Foldseek');
assert(ctxRun(`parsedTracks['${fsKey}'][5]`) !== ' ', 'track marks the aligned query span (residue 6)');
assert(ctxRun(`homologHitsInfo['${fsKey}'].stats.Identities`) === '26', 'stats carry identity for the template table');

section('analysis rules engine');
assert(ctxRun(`ruleCompare(5,'<',10)`) === true && ctxRun(`ruleCompare(5,'>',10)`) === false && ctxRun(`ruleCompare(5,'>=',5)`) === true, 'ruleCompare numeric operators');
ctxRun(`parsedTracks = { AA: 'MKTAYIAKQRQISFVKSHFSRQDILDLWIYHTQGYFP',
  DO_IUPred: 'D'.repeat(37), TM_TMHMM: 'M'.repeat(37),
  M_pLDDT: Array.from({ length: 37 }, () => ({ type: 'plddt', val: 40 })) };
homologHitsInfo = {}; graphHighlights = {}; trackMeta = {};
renderViewer = function(){}; schedulePersist = function(){};`);
const rMask = ctxRun(`evaluateRule({ mode:'all', conditions:[{ kind:'numeric', source:'pLDDT:M_pLDDT', op:'<', value:'50' }] })`);
assert(rMask.length === 37 && rMask.every(Boolean), 'numeric rule: pLDDT<50 matches all');
const rMask2 = ctxRun(`evaluateRule({ mode:'all', conditions:[{ kind:'categorical', source:'track:DO_IUPred', op:'annotated' }] })`);
assert(rMask2.every(Boolean), 'categorical rule: disorder annotated matches all');
const rMask3 = ctxRun(`evaluateRule({ mode:'any', conditions:[{ kind:'numeric', source:'pLDDT:M_pLDDT', op:'>', value:'90' }, { kind:'categorical', source:'track:TM_TMHMM', op:'annotated' }] })`);
assert(rMask3.every(Boolean), 'any-mode matches when one condition holds');
const rMask4 = ctxRun(`evaluateRule({ mode:'all', conditions:[{ kind:'numeric', source:'pLDDT:M_pLDDT', op:'>', value:'90' }, { kind:'categorical', source:'track:TM_TMHMM', op:'annotated' }] })`);
assert(rMask4.every(v => v === false), 'all-mode fails when one condition is false (contradiction example)');
ctxRun(`analysisRules = [{ id:'t1', name:'Test', color:'#ef4444', mode:'all', enabled:true, conditions:[{ kind:'categorical', source:'track:TM_TMHMM', op:'annotated' }] }]; applyRules();`);
assert(ctxRun(`typeof parsedTracks['RULE_t1']`) === 'string', 'applyRules creates the RULE_ track');
assert(ctxRun(`getTrackGroup('RULE_t1')`) === 'RULE', 'RULE track group');
assert(ctxRun(`getTrackSource('RULE_t1')`) === 'Rule', 'RULE provenance source');
assert(ctxRun(`getTrackMeta('RULE_t1').color`) === '#ef4444', 'rule colour stored in trackMeta');

section('interface analysis');
const pdbText = [
  'ATOM      1  CA  ALA A   1      10.000  10.000  10.000  1.00 90.00           C',
  'ATOM      2  CA  ALA A   2      20.000  10.000  10.000  1.00 90.00           C',
  'ATOM      3  CA  ALA A   3      30.000  10.000  10.000  1.00 90.00           C',
  'ATOM      4  CA  ALA B   1      11.000  10.000  10.000  1.00 90.00           C',
  'ATOM      5  CA  ALA B   2      21.000  10.000  10.000  1.00 90.00           C'
].join('\n');
ctxRun(`cachedStructureTexts = { 'x.pdb': ${JSON.stringify(pdbText)} }; p3dModel = null;`);
const pchains = ctxRun(`parseStructureChains(cachedStructureTexts['x.pdb'], 'pdb')`);
assert(pchains.A && pchains.A.length === 3 && pchains.B && pchains.B.length === 2, 'parseStructureChains splits by chain');
const iface = ctxRun(`computeInterfaces(parseStructureChains(cachedStructureTexts['x.pdb'], 'pdb'), 8)`);
assert(iface.pairs.length === 1 && iface.pairs[0].contacts === 2, 'computeInterfaces finds the A–B contacts (A1-B1, A2-B2)');
assert(iface.residuesByChain.A.size === 2 && iface.residuesByChain.A.has(1) && iface.residuesByChain.A.has(2), 'interface residues on chain A = {1,2}');
ctxRun(`parsedTracks = { AA: 'MKTAYIAKQRQISFVKSHFSRQDILDLWIYHTQGYFP' }; trackMeta = {}; graphHighlights = {}; renderViewer = function(){}; schedulePersist = function(){};`);
const nIf = ctxRun(`applyInterfaceTracks(computeInterfaces(parseStructureChains(cachedStructureTexts['x.pdb'], 'pdb'), 8))`);
assert(nIf === 2, 'applyInterfaceTracks creates one track per interface chain');
assert(ctxRun(`typeof parsedTracks['IF_A']`) === 'string' && ctxRun(`typeof parsedTracks['IF_B']`) === 'string', 'IF_ tracks created');
assert(ctxRun(`parsedTracks['IF_A'][0]`) === '◆' && ctxRun(`parsedTracks['IF_A'][2]`) === ' ', 'IF_ track marks interface residues only');
assert(ctxRun(`getTrackGroup('IF_A')`) === 'IF' && ctxRun(`getTrackSource('IF_A')`) === 'Interface', 'IF group + provenance');
assert(ctxRun(`computeInterfaces(parseStructureChains(cachedStructureTexts['x.pdb'], 'pdb'), 0.5).pairs.length`) === 0, 'tighter cutoff finds no contacts (sanity)');

section('track manager accordion');
const tmEl = makeEl();
const prevGetTM = sandbox.document.getElementById;
sandbox.document.getElementById = function (id) { return id === 'trackManagerList' ? tmEl : prevGetTM.call(this, id); };
ctxRun(`parsedTracks = { AA: 'X'.repeat(10), SS_PSIPRED: 'H'.repeat(10), TM_TMHMM: 'M'.repeat(10) };
trackManagerExpanded = {};
trackControlState = { hidden: {}, hideSymbols: {}, fullBar: {}, filtered: {}, aaSeq: {}, consColor: {}, viewOverride: {} };`);
ctxRun(`renderTrackManager();`);
assert(tmEl.innerHTML.indexOf('tm-track') === -1 && tmEl.innerHTML.indexOf('tm-chevron') !== -1, 'accordion: collapsed by default (group headers only)');
ctxRun(`trackManagerExpanded = { SS: true }; renderTrackManager();`);
assert(tmEl.innerHTML.indexOf('tm-track') !== -1, 'accordion: expanding a type renders its track rows');
ctxRun(`trackManagerExpandAll(true);`);
assert((tmEl.innerHTML.match(/tm-track/g) || []).length >= 2, 'expand all renders every type\'s rows');
sandbox.document.getElementById = prevGetTM;

section('QA highlights + UX');
assert(ctxRun(`typeof toggleQaHighlights === 'function' && typeof syncQaHighlights === 'function'`), 'QA-highlight toggle functions present');

section('graph mode via Track Control');
ctxRun(`graphMode = { pLDDT: false, RSA: false }; trackControlState = { hidden:{}, hideSymbols:{}, fullBar:{}, filtered:{}, aaSeq:{}, consColor:{}, viewOverride:{} };`);
const plddtOpts = ctxRun(`(function(){ const s = buildGroupViewSelect('pLDDT'); return (s.children || []).map(o => o.value); })()`);
assert(plddtOpts[0] === 'graph' && plddtOpts.indexOf('hidden') !== -1, 'pLDDT View-as leads with Graph');
ctxRun(`setGroupView('pLDDT', 'graph');`);
assert(ctxRun(`graphMode.pLDDT`) === true && ctxRun(`getEffectiveGroupView('pLDDT')`) === 'graph', 'setGroupView(pLDDT, graph) enables graph mode');
ctxRun(`setGroupView('pLDDT', 'glyphs');`);
assert(ctxRun(`graphMode.pLDDT`) === false && ctxRun(`getEffectiveGroupView('pLDDT')`) === 'glyphs', 'setGroupView(pLDDT, glyphs) leaves graph mode');
const ssOpts = ctxRun(`(function(){ const s = buildGroupViewSelect('SS'); return (s.children || []).map(o => o.value); })()`);
assert(ssOpts.indexOf('graph') === -1, 'non-numeric types have no Graph option');

section('guided workflow (evaluation guide)');
assert(ctxRun(`WORKFLOW_STEPS.length`) === 8, 'guide has 8 pipeline steps');
assert(ctxRun(`WORKFLOW_STEPS.every(s => s.id && s.title && s.desc && s.why && s.action && typeof s.action.run === 'string' && Array.isArray(s.how) && s.how.length && typeof s.check === 'function')`), 'every step carries why / action / how / check');
assert(ctxRun(`WORKFLOW_STEPS.map(s => s.id).join(',')`) === 'sequence,features,annotation,homologs,structure,foldseek,topology,integration', 'steps follow the characterized pipeline order');
assert(ctxRun(`GUIDE_QUESTIONS.length`) === 5 && ctxRun(`GUIDE_QUESTIONS.every(q => q.id && q.options.length === 3)`), '5 three-option intake questions');
assert(ctxRun(`typeof setGuideAnswer === 'function' && typeof resetGuideProfile === 'function' && typeof renderWorkflowGuide === 'function' && typeof computeGuideInsights === 'function' && typeof nextGuideStep === 'function'`), 'guide helpers present');

ctxRun(`resetGuideProfile();`);
assert(ctxRun(`Object.keys(guideProfile).length`) === 0, 'reset clears the intake profile');
ctxRun(`setGuideAnswer('membrane', 'yes');`);
assert(ctxRun(`guideProfile.membrane`) === 'yes', 'answers are stored on the profile');
assert(ctxRun(`guideStepStatus().filter(r => r.priority).map(r => r.step.id).indexOf('topology') !== -1`), 'membrane=yes promotes the topology step');
ctxRun(`setGuideAnswer('membrane', 'no');`);
assert(ctxRun(`guideStepStatus().filter(r => r.priority).map(r => r.step.id).indexOf('topology') === -1`), 'membrane=no demotes the topology step');
ctxRun(`setGuideAnswer('unknownFunction', 'yes');`);
const priFn = ctxRun(`guideStepStatus().filter(r => r.priority).map(r => r.step.id)`);
assert(priFn.indexOf('annotation') !== -1 && priFn.indexOf('foldseek') !== -1, 'unknown function promotes domains + Foldseek');

ctxRun(`guideProfile = {}; parsedTracks = { AA: 'MKV' };`);
const nxt = ctxRun(`(function(){ var n = nextGuideStep(); return n ? n.step.id : null; })()`);
assert(nxt && nxt !== 'sequence', 'completed steps are skipped in the recommendation');
ctxRun(`parsedTracks = {};`);
assert(ctxRun(`(function(){ var n = nextGuideStep(); return n ? n.step.id : null; })()`) === 'sequence', 'empty state recommends loading the sequence first');

ctxRun(`parsedTracks = { AA: 'MKV' };`);
const ins = ctxRun(`computeGuideInsights()`);
assert(ins.some(i => /No homologs/.test(i.text)), 'read-out flags missing homologs');
ctxRun(`parsedTracks = { AA: 'MKV', 'm_pLDDT': [{ val: 40 }, { val: 50 }] };`);
assert(ctxRun(`computeGuideInsights()`).some(i => i.level === 'warn' && /Mean pLDDT is 45/.test(i.text)), 'low mean pLDDT raises a warning');
ctxRun(`parsedTracks = { AA: 'MKV', 'm_pLDDT': [{ val: 90 }, { val: 88 }] };`);
assert(ctxRun(`computeGuideInsights()`).some(i => i.level === 'info' && /Mean pLDDT is 89/.test(i.text)), 'high mean pLDDT is reported as confidence');

ctxRun(`guideProfile = { variants: 'yes' };`);
let gPersist = null;
try { gPersist = ctxRun(`gatherPersistableState().preferences.guideProfile.variants`); } catch (e) { gPersist = 'threw: ' + e.message; }
assert(gPersist === 'yes', 'guide profile is persisted in preferences');
ctxRun(`guideProfile = {}; parsedTracks = {};`);

section('guide overrides + citations + reference doc');
ctxRun(`guideProfile = {}; guideOverrides = {}; parsedTracks = {};`);

// --- overrides -----------------------------------------------------------
assert(ctxRun(`Object.keys(guideOverrides).length`) === 0, 'no overrides by default');
ctxRun(`setGuideOverride('foldseek', 'skipped');`);
assert(ctxRun(`guideOverrides.foldseek`) === 'skipped', 'skip is stored on the override map');
let st = ctxRun(`guideStepStatus().filter(r => r.step.id === 'foldseek')[0]`);
assert(st.skipped === true && st.done === false, 'a skipped step is settled but not "done"');
const prog = ctxRun(`guideProgress()`);
assert(prog.skipped === 1 && prog.denominator === prog.total - 1, 'skipped steps leave the progress denominator');
assert(ctxRun(`(function(){ var n = nextGuideStep(); return n ? n.step.id : null; })()`) !== 'foldseek', 'skipped steps are not recommended');

ctxRun(`setGuideOverride('foldseek', 'done');`);
st = ctxRun(`guideStepStatus().filter(r => r.step.id === 'foldseek')[0]`);
assert(st.done === true && st.manualDone === true && st.autoDone === false, 'manual done overrides auto-detection');
assert(ctxRun(`guideStepStatus().filter(r => r.step.id === 'foldseek')[0].done`) === true, 'manually-done steps report done');
assert(ctxRun(`guideProgress().covered >= 1`), 'manually-done steps count as covered');
ctxRun(`setGuideOverride('foldseek', 'clear');`);
assert(ctxRun(`guideOverrides.foldseek`) === undefined, 'clear removes the override');
ctxRun(`setGuideOverride('a', 'done'); setGuideOverride('b', 'skipped');`);
ctxRun(`resetGuideOverrides();`);
assert(ctxRun(`Object.keys(guideOverrides).length`) === 0, 'reset clears all overrides');

// --- citations -----------------------------------------------------------
assert(ctxRun(`WORKFLOW_STEPS.every(s => Array.isArray(s.refs) && s.refs.length > 0)`), 'every step carries at least one citation');
assert(ctxRun(`WORKFLOW_STEPS.every(s => s.refs.every(r => r.doi.indexOf('10.') === 0 && r.doi.indexOf('/') > 3 && r.cite.length > 10))`), 'citations look like DOIs and have a label');
assert(ctxRun(`WORKFLOW_STEPS.every(s => typeof s.priorityNote === 'string' && s.priorityNote.length > 0)`), 'every step explains when it is promoted');
assert(ctxRun(`typeof guideRefsHTML === 'function' && /doi\.org/.test(guideRefsHTML(WORKFLOW_STEPS[0]))`), 'refs render as doi.org links');

// --- external reference doc stays in sync --------------------------------
ctxRun(`guideProfile = {}; parsedTracks = {};`);
const steps = ctxRun(`WORKFLOW_STEPS.map(s => ({ title: s.title, refs: s.refs }))`);
let docDrift = [];
steps.forEach(s => {
  if (WORKFLOW_MD.indexOf(s.title) === -1) docDrift.push('title: ' + s.title);
  s.refs.forEach(r => { if (WORKFLOW_MD.indexOf(r.doi) === -1) docDrift.push('doi: ' + r.doi); });
});
assert(docDrift.length === 0, 'WORKFLOW.md contains every step title and DOI' + (docDrift.length ? ' (missing ' + docDrift.join(', ') + ')' : ''));
assert(WORKFLOW_MD.indexOf('node tools/build-workflow-doc.js') !== -1, 'WORKFLOW.md documents how to regenerate itself');
assert(WORKFLOW_MD.indexOf('Guided questions') !== -1, 'WORKFLOW.md documents the per-step questions');
assert(WORKFLOW_MD.indexOf(ctxRun(`STEP_QUESTIONS.foldseek[0].options[1].label`)) !== -1, 'WORKFLOW.md lists the per-step options');
assert(WORKFLOW_MD.indexOf('quick2dv') !== -1 || WORKFLOW_MD.indexOf('Quick2DViewer') !== -1, 'WORKFLOW.md is the Q2DV reference');

section('per-step wizard questions (action resolution)');
ctxRun(`guideAnswers = {}; guideOverrides = {}; guideProfile = {}; parsedTracks = {};`);
const stepIds = ctxRun(`WORKFLOW_STEPS.map(s => s.id)`);
assert(stepIds.every(id => ctxRun(`Array.isArray(STEP_QUESTIONS['` + id + `']) && STEP_QUESTIONS['` + id + `'].length > 0`)), 'every step has at least one sub-question');
assert(ctxRun(`WORKFLOW_STEPS.every(s => resolveStepAction(s).run && resolveStepAction(s).label)`), 'every step resolves to a runnable action');

// default: no answers -> the step's own action, not flagged as custom
let act = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'structure')[0])`);
assert(act.run === 'openInputDataModal()' && act.custom === false, 'unanswered step offers its own default action');

// answers change the action + mark it custom
ctxRun(`setStepAnswer('structure', 'model', 'esmfold');`);
act = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'structure')[0])`);
assert(act.run === 'predictStructureESMFold()' && act.custom === true, 'ESMFold answer offers the prediction action');
assert(/400 aa/.test(act.hint), 'the resolved action carries a hint');
ctxRun(`setStepAnswer('structure', 'model', 'afdb');`);
assert(ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'structure')[0]).run`) === 'openDataModal()', 'AlphaFold answer offers the data modal');

ctxRun(`setStepAnswer('foldseek', 'db', 'pdb100');`);
act = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'foldseek')[0])`);
assert(/pdb100/.test(act.label) && act.run === 'runFoldseekSearch()', 'Foldseek answer names the chosen database');
ctxRun(`setStepAnswer('integration', 'goal', 'interface');`);
assert(ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'integration')[0]).run`) === 'showInterfacesPanel()', 'integration goal picks the closing action');
ctxRun(`setStepAnswer('integration', 'goal', 'construct');`);
assert(ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'integration')[0]).run`).indexOf('workflow') !== -1, 'construct goal opens the command generator');
ctxRun(`setStepAnswer('topology', 'predictor', 'tmhmm');`);
assert(ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'topology')[0]).run`) === 'openTopologyPanel()', 'topology answer opens the paste panel');
ctxRun(`setStepAnswer('topology', 'predictor', 'none');`);
assert(ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'topology')[0]).run`).indexOf('window.open') === 0, 'no-predictor answer offers an external runner');
ctxRun(`setStepAnswer('annotation', 'have', 'domains');`);
assert(ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'annotation')[0]).run`) === 'runDomainScan()', 'annotation "domains only" resolves to the Pfam scan');

// answers toggle off when re-selected, and reset wholesale
ctxRun(`setStepAnswer('foldseek', 'db', 'pdb100');`);
assert(ctxRun(`getStepAnswer('foldseek', 'db')`) === null, 're-selecting an option clears the answer');
ctxRun(`setStepAnswer('foldseek', 'db', 'afdb50'); setStepAnswer('structure', 'model', 'pdb');`);
ctxRun(`resetStepAnswers();`);
assert(ctxRun(`Object.keys(guideAnswers).length`) === 0, 'reset answers clears them all');

ctxRun(`setStepAnswer('homologs', 'hhpred', 'no');`);
let ansPersist = null;
try { ansPersist = ctxRun(`gatherPersistableState().preferences.guideAnswers['homologs.hhpred']`); } catch (e) { ansPersist = 'threw: ' + e.message; }
assert(ansPersist === 'no', 'step answers are persisted in preferences');
ctxRun(`guideAnswers = {}; guideProfile = {}; guideOverrides = {}; parsedTracks = {};`);

section('track removal + guide undo');
ctxRun(`parsedTracks = {}; trackMeta = {}; guideProfile = {}; guideOverrides = {}; guideAnswers = {}; analysisRules = [];`);

// --- single track: row + backing registry + control state ------------------
ctxRun(`
    parsedTracks.AA = 'MKV';
    parsedTracks['UP_Active_site'] = '\u25a0  ';
    uniprotFeatureTracks['UP_Active_site'] = { type: 'Active site' };
    uniprotFeatures = { accession: 'P00001', features: [] };
    homologHitsInfo['HL_01_hit'] = { source: 'HHpred' };
    parsedTracks['HL_01_hit'] = 'EE ';
    trackControlState.filtered['UP_Active_site'] = true;
    trackControlState.viewOverride['UP_Active_site'] = 'glyphs';
`);
let removed = ctxRun(`removeTracks(['UP_Active_site'], { silent: true })`);
assert(removed === 1, 'removeTracks reports the number of rows removed');
assert(ctxRun(`parsedTracks['UP_Active_site']`) === undefined, 'the row is gone');
assert(ctxRun(`uniprotFeatureTracks['UP_Active_site']`) === undefined, 'the UniProt feature registry entry is gone');
assert(ctxRun(`trackControlState.filtered['UP_Active_site']`) === undefined && ctxRun(`trackControlState.viewOverride['UP_Active_site']`) === undefined, 'per-track control state is cleaned up');
ctxRun(`removeTracks(['HL_01_hit'], { silent: true });`);
assert(ctxRun(`homologHitsInfo['HL_01_hit']`) === undefined, 'homolog info map is cleaned up');

// --- removing the last UniProt row clears the fetch ------------------------
assert(ctxRun(`uniprotFeatures`) === null, 'removing every UP_ row clears the UniProt fetch');
// --- AA is the dataset itself and is protected ----------------------------
assert(ctxRun(`removeTracks(['AA'], { silent: true })`) === 0, 'AA cannot be removed as a track');
assert(ctxRun(`typeof parsedTracks.AA`) === 'string', 'the sequence survives a refused removal');
// --- unknown keys are ignored ---------------------------------------------
assert(ctxRun(`removeTracks(['NOPE_1'], { silent: true })`) === 0, 'unknown keys are ignored');

// --- type-level removal ----------------------------------------------------
ctxRun(`
    parsedTracks['DM_ubiquitin'] = '\u2588\u2588\u2588';
    parsedTracks['DM_Rad60'] = ' \u2588\u2588';
    domainHitsInfo['DM_ubiquitin'] = { model: 'ubiquitin' };
    domainHitsInfo['DM_Rad60'] = { model: 'Rad60' };
`);
assert(ctxRun(`removeTrackGroup('DM', { silent: true })`) === 2, 'type-level removal takes every row of the type');
assert(ctxRun(`getGroupTrackKeys('DM').length`) === 0, 'no DM rows remain');
assert(ctxRun(`Object.keys(domainHitsInfo).length`) === 0, 'domain stats are dropped with the rows');

// --- rules drop their definition too --------------------------------------
ctxRun(`
    analysisRules = [{ id: 'r1', name: 'A', color: '#f00', mode: 'all', enabled: true, conditions: [] }];
    parsedTracks['RULE_r1'] = '\u2588  ';
    setTrackMeta('RULE_r1', { source: 'Rule', color: '#f00' });
`);
ctxRun(`removeTracks(['RULE_r1'], { silent: true });`);
assert(ctxRun(`analysisRules.length`) === 0, 'removing a RULE_ row also removes its rule definition');

// --- variants: registry + derived conservation -----------------------------
ctxRun(`
    keyedVariantsInfo = { v1: { aligned: 'MKV', raw: 'MKV' } };
    parsedTracks['VAR_v1'] = 'MKV';
    parsedTracks.CONSERVATION = { type: 'conservation', metric: 'shannon', values: [1, 1, 1] };
`);
ctxRun(`removeTracks(['VAR_v1'], { silent: true });`);
assert(ctxRun(`keyedVariantsInfo.v1`) === undefined, 'variant registry entry removed');
assert(ctxRun(`parsedTracks.CONSERVATION`) === undefined, 'conservation is recomputed away with its variants');

// --- topology: the pasted source is what actually goes --------------------
ctxRun(`
    parsedTracks.AA = 'MKV';
    topologySources = [{ name: 'TMHMM run', state: 'iii' }];
    applyTopologySources();
`);
assert(ctxRun(`getGroupTrackKeys('TP').length`) >= 1, 'topology source produced a TP_ row');
ctxRun(`removeTracks(getGroupTrackKeys('TP'), { silent: true });`);
assert(ctxRun(`topologySources.length`) === 0, 'removing the TP_ rows removes the pasted topology source');

// --- guide undo ------------------------------------------------------------
assert(stepIds.every(id => ctxRun(`typeof STEP_UNDO['` + id + `'] === 'object'`)), 'every step declares how to undo itself');
ctxRun(`
    parsedTracks.AA = 'MKV';
    parsedTracks['SS_PSIPRED'] = 'HHH';
    parsedTracks['TM_Quick2D'] = '   ';
`);
let undoKeys = ctxRun(`guideStepUndoKeys('features')`);
assert(undoKeys.length === 2, 'features undo targets the prediction groups');
assert(ctxRun(`guideStepStatus().filter(r => r.step.id === 'features')[0].done`) === true, 'features step reads as covered');
ctxRun(`removeTracks(guideStepUndoKeys('features'), { silent: true });`);
assert(ctxRun(`guideStepStatus().filter(r => r.step.id === 'features')[0].done`) === false, 'undoing the step makes it read as not covered again');
ctxRun(`
    parsedTracks['HL_01_hhpred'] = 'EE ';
    homologHitsInfo['HL_01_hhpred'] = { source: 'HHpred' };
    parsedTracks['HL_02_foldseek'] = 'EE ';
    homologHitsInfo['HL_02_foldseek'] = { source: 'Foldseek' };
`);
undoKeys = ctxRun(`guideStepUndoKeys('foldseek')`);
assert(undoKeys.length === 1 && /foldseek/.test(undoKeys[0]), 'Foldseek undo only targets Foldseek hits');
assert(ctxRun(`STEP_UNDO.sequence.reset`) === true, 'the sequence step undoes via a full reset');
assert(ctxRun(`parsedTracks = {}; topologySources = []; keyedVariantsInfo = {}; uniprotFeatures = null; trackMeta = {};`), 'state reset for the next section');

section('hmmer hmmscan (domain scan)');
const hmmerOut = [
    '# hmmscan :: search sequence(s) against a profile database',
    'Query:       EMBOSS_001  [L=76]',
    '',
    'Domain annotation for each model (and alignments):',
    '>> ubiquitin  Ubiquitin family',
    '   #    score  bias  c-Evalue  i-Evalue hmmfrom  hmm to    alifrom  ali to    envfrom  env to     acc',
    ' ---   ------ ----- --------- --------- ------- -------    ------- -------    ------- -------    ----',
    '   1 !  119.1   0.3   2.6e-38   5.5e-35       1      72 []       3      74 ..       3      74 .. 0.99',
    '',
    '>> DUF2407  DUF2407 ubiquitin-like domain',
    '   1 ?   15.0   0.0      0.01      0.03      1      50 ..      10      60 ..      10      60 .. 0.50',
    ''
].join('\n');
const doms = ctxRun(`parseHmmerDomains(${JSON.stringify(hmmerOut)})`);
assert(doms.length === 2, 'hmmscan parser reads both domain blocks');
assert(doms[0].model === 'ubiquitin' && doms[0].description === 'Ubiquitin family', 'model name + description captured');
assert(doms[0].significant === true && doms[0].aliFrom === 3 && doms[0].aliTo === 74, 'domain alignment span captured');
assert(Math.abs(doms[0].iEvalue - 5.5e-35) < 1e-45, 'per-domain i-Evalue captured');
assert(doms[1].significant === false, "'?' domains flagged non-significant");

ctxRun(`parsedTracks.AA = 'MQIFVKTLTGKTITLEVEPSDTIENVKAKIQDKEGIPPDQQRLIFAGKQLEDGRTLSDYNIQKESTLHLVLRLRGG';`);
ctxRun(`Object.keys(parsedTracks).forEach(k => { if (k.indexOf('DM_') === 0) delete parsedTracks[k]; });`);
const dmAdded = ctxRun(`applyDomainTracks(parseHmmerDomains(${JSON.stringify(hmmerOut)}), 'Pfam')`);
assert(dmAdded === 1, 'only significant Pfam families become tracks');
assert(ctxRun(`getTrackGroup('DM_ubiquitin')`) === 'DM', 'DM_ maps to the Domains group');
assert(ctxRun(`trackGroupLabel('DM')`) === 'Domains', 'Domains group label');
assert(ctxRun(`getTrackSource('DM_ubiquitin')`) === 'HMMER (Pfam)', 'domain tracks report HMMER provenance');
assert(ctxRun(`(parsedTracks['DM_ubiquitin'] || '').slice(2, 4)`) === '\u2588\u2588', 'domain track marks the aligned span');
assert(ctxRun(`(parsedTracks['DM_ubiquitin'] || '').slice(0, 2)`) === '  ', 'positions outside the domain stay blank');
assert(ctxRun(`domainHitsInfo['DM_ubiquitin'].domains.length`) === 1, 'one domain recorded for ubiquitin');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.domain_scan.providers[0].enabled`) === true, 'domain_scan provider enabled');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.domain_scan.providers[0].url`).indexOf('hmmer3_hmmscan') !== -1, 'domain_scan points at the live hmmer3_hmmscan tool id');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.domain_scan.providers[0].resultExt`) === 'out', 'hmmer3 requests the raw text renderer');

section('service registry + capability fallback');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.annotation.providers.length`) === 2, 'annotation capability has 2 providers (fallback chain)');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.fold.providers[0].id`) === 'esmfold', 'fold -> esmfold provider');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.sequence_search.providers[0].adapter`) === 'ebiJob', 'sequence_search -> ebiJob adapter');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.structure_search.providers[0].enabled`) === true, 'foldseek provider enabled');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.structure_search.providers[0].adapter`) === 'foldseek', 'structure_search -> foldseek adapter');
assert(ctxRun(`typeof getTrackSource === 'function' && typeof runCapability === 'function'`), 'registry helpers present');

// ---------- async tests ----------
(async () => {
    let err = null;
    try { await ctxRun(`runCapability('fold', { sequence: 'X'.repeat(500) })`); }
    catch (e) { err = e; }
    assert(err && /too long/.test(err.message), 'fold rejects >400 aa before any network call');

    err = null;
    try { await ctxRun(`runCapability('no_such_capability', {})`); }
    catch (e) { err = e; }
    assert(err && /Unknown capability/.test(err.message), 'unknown capability rejects');

    // Provider fallback: a capability whose first provider throws, second succeeds.
    ctxRun(`
        SERVICE_ADAPTERS.__ok = async () => 'second-provider-result';
        SERVICE_REGISTRY.capabilities.__test = { label: 'Test', providers: [
            { id: 'a', label: 'A', adapter: 'nope' },
            { id: 'b', label: 'B', adapter: '__ok' }
        ] };
    `);
    const result = await ctxRun(`runCapability('__test', {})`);
    assert(result === 'second-provider-result', 'runCapability falls through a failing provider to the next');

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})();
