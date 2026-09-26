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
    dataset: {}, attrs: {}, children: [], options: [], selectedIndex: -1, _text: '',
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
const elsById = {};
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
    getElementById(id) { return (elsById[id] = elsById[id] || makeEl()); },
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
assert(ctxRun(`GUIDE_QUESTIONS.length`) === 5 && ctxRun(`GUIDE_QUESTIONS.every(q => q.id && q.options.length >= 3)`), '5 intake questions with at least three options each');
const structQ = ctxRun(`GUIDE_QUESTIONS.filter(q => q.id === 'structure')[0]`);
assert(structQ.options.map(o => o.value).join(',') === 'experimental,predicted,none,unsure', 'the structure question asks for the evidence type, not availability');
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
const presetNames = ctxRun(`RULE_PRESETS.map(p => p.name)`);
let presetDrift = presetNames.filter(n => WORKFLOW_MD.indexOf(n) === -1);
assert(presetDrift.length === 0, 'WORKFLOW.md documents every rule preset' + (presetDrift.length ? ' (missing ' + presetDrift.join(', ') + ')' : ''));
const presetDois = [];
ctxRun(`(function(){ var out = []; RULE_PRESETS.forEach(p => p.refs.forEach(r => out.push(r.doi))); return out; })()`).forEach(d => presetDois.push(d));
const missingDois = presetDois.filter(d => WORKFLOW_MD.indexOf(d) === -1);
assert(missingDois.length === 0, 'WORKFLOW.md carries every preset citation DOI' + (missingDois.length ? ' (missing ' + missingDois.join(', ') + ')' : ''));
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
ctxRun(`setStepAnswer('structure', 'model', 'afdb'); uniprotAccession = null; currentProteinLabel = null;`);
let afAct = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'structure')[0])`);
assert(afAct.run === 'predictStructureESMFold()' && /No UniProt accession/.test(afAct.hint), 'AlphaFold answer without an accession falls back to ESMFold and says why');
ctxRun(`uniprotAccession = 'P42212';`);
afAct = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'structure')[0])`);
assert(afAct.run === 'fetchAlphaFoldModel()' && /P42212/.test(afAct.label), 'with an accession it offers the real AlphaFold DB fetch');
ctxRun(`uniprotAccession = null;`);

ctxRun(`setStepAnswer('foldseek', 'db', 'pdb100');`);
act = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'foldseek')[0])`);
assert(/pdb100/.test(act.label) && act.run === 'runFoldseekSearch()', 'Foldseek answer names the chosen database');
ctxRun(`setStepAnswer('integration', 'goal', 'interface');`);
assert(ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'integration')[0]).run`) === "openGuideCoachmark('interfaces')", 'integration goal opens the interface submenu through the coachmark');
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

section('rule presets + group sources');
ctxRun(`analysisRules = []; guideProfile = {}; guideOverrides = {}; parsedTracks = {};`);

// --- group:<GROUP> categorical source -------------------------------------
ctxRun(`parsedTracks = { AA: 'MKV', 'TM_Quick2D': 'EEE', 'DO_IUPred': '  E' };`);
const catIds = ctxRun(`getRuleCategoricalSources().map(s => s.id)`);
assert(catIds.indexOf('group:TM') !== -1 && catIds.indexOf('group:DO') !== -1, 'group sources appear once the type has string tracks');
assert(ctxRun(`getRuleCategoricalSources().filter(s => s.id === 'group:TM')[0].label`).indexOf('any of') !== -1, 'the group label says it spans the type');
assert(ctxRun(`ruleCategoricalValue('group:TM', 1)`) === 'E', 'a group source reports the first annotated track in the group');
assert(ctxRun(`ruleCategoricalValue('group:TM', 8)`) === ' ', 'a group source reads blank when nothing in the group is annotated');
const gmask = ctxRun(`evaluateRule({ mode: 'all', conditions: [
    { kind: 'categorical', source: 'group:TM', op: 'annotated', value: '' },
    { kind: 'categorical', source: 'group:DO', op: 'annotated', value: '' } ] })`);
assert(gmask[2] === true && gmask[0] === false && gmask[1] === false, 'group conditions co-localize across different types');

// --- readable condition text (used on the preset cards) --------------------
assert(ctxRun(`describeRuleCondition({ kind: 'numeric', source: 'CONSERVATION', op: '>=', value: '0.85' })`) === 'Conservation ≥ 0.85', 'numeric conditions render a readable operator');
assert(ctxRun(`describeRuleCondition({ kind: 'categorical', source: 'group:TM', op: 'annotated', value: '' })`) === 'Transmembrane annotated', 'group conditions render the group label');

// --- pLDDT aggregates must exist for a single model ------------------------
ctxRun(`parsedTracks = { AA: 'MKV', 'm_pLDDT': [{ val: 80 }, { val: 60 }, { val: 40 }] };`);
const numIds = ctxRun(`getRuleNumericSources().map(s => s.id)`);
assert(numIds.indexOf('pLDDT_mean') !== -1 && numIds.indexOf('pLDDT_min') !== -1, 'pLDDT mean/min exist with a single model (presets rely on them)');
assert(ctxRun(`ruleNumericValue('pLDDT_min', 2)`) === 40, 'pLDDT_min reads the single attached model');

// --- preset library integrity ---------------------------------------------
assert(ctxRun(`RULE_PRESETS.length`) === 8, 'eight curated presets (DESIGN §11)');
assert(ctxRun(`RULE_PRESETS.every(p => p.id && p.name && p.color && p.rationale && p.conditions.length && p.refs.length)`), 'every preset is complete');
assert(ctxRun(`RULE_PRESETS.every(p => p.conditions.every(c => c.kind === 'numeric' || c.kind === 'categorical'))`), 'preset conditions use the supported kinds');
assert(ctxRun(`RULE_PRESETS.every(p => p.conditions.every(c => c.kind !== 'numeric' || ['<','<=','>','>=','==','!='].indexOf(c.op) !== -1))`), 'numeric presets use valid operators');
assert(ctxRun(`RULE_PRESETS.every(p => p.refs.every(r => r.doi.indexOf('10.') === 0 && r.cite))`), 'preset citations carry verified-shape DOIs');
assert(ctxRun(`RULE_PRESETS.every(p => p.conditions.every(c => c.source.indexOf('track:') !== 0))`), 'presets never name one specific predictor key (group/aggregate sources only)');

// --- availability reporting -------------------------------------------------
ctxRun(`parsedTracks = { AA: 'MKV', 'TM_Quick2D': 'EEE' };`);
let miss = ctxRun(`presetMissingSources(RULE_PRESETS.filter(p => p.id === 'conserved_buried')[0])`);
assert(miss.indexOf('CONSERVATION') !== -1 && miss.indexOf('RSA:') !== -1, 'a preset reports its missing inputs');
ctxRun(`parsedTracks = { AA: 'MKV', 'TP_TMHMM': 'iii' };`);
assert(ctxRun(`presetMissingSources(RULE_PRESETS.filter(p => p.id === 'signal_feature')[0]).length`) === 0, 'a satisfied preset reports nothing missing');
ctxRun(`parsedTracks = { AA: 'MKV', 'm_RSA': [{ val: 0.1 }] };`);
miss = ctxRun(`presetMissingSources(RULE_PRESETS.filter(p => p.id === 'conserved_buried')[0])`);
assert(miss.indexOf('RSA:') === -1, 'the any-model RSA source is satisfied by one RSA track');

// --- suggestions from the guide profile + loaded data ----------------------
ctxRun(`guideProfile = { membrane: 'yes' }; parsedTracks = { AA: 'MKV', 'TM_Quick2D': 'EEE' };`);
let sug = ctxRun(`suggestedRulePresets().map(p => p.id)`);
assert(sug.indexOf('topology_contradiction') !== -1 && sug.indexOf('signal_feature') !== -1, 'a membrane profile suggests the membrane presets');
ctxRun(`guideProfile = {}; parsedTracks = { AA: 'MKV', 'm_pLDDT': [{ val: 80 }] };`);
sug = ctxRun(`suggestedRulePresets().map(p => p.id)`);
assert(sug.indexOf('rigid_core') !== -1 && sug.indexOf('no_confidence') !== -1, 'a model suggests the confidence presets');
assert(sug.indexOf('signal_feature') === -1, 'unrelated presets are not suggested');
ctxRun(`parsedTracks.CONSERVATION = { type: 'conservation', metric: 'shannon', values: [0.9, 0.2, 0.2] };`);
sug = ctxRun(`suggestedRulePresets().map(p => p.id)`);
assert(sug.indexOf('conserved_buried') !== -1 && sug.indexOf('conserved_poorly_modelled') !== -1, 'conservation + model suggest the conservation presets');

// --- applying a preset ------------------------------------------------------
ctxRun(`
    analysisRules = [];
    guideProfile = { membrane: 'yes' };
    parsedTracks = { AA: 'MKV', 'TM_Quick2D': 'EEE', 'DO_IUPred': '  E', 'm_pLDDT': [{ val: 30 }, { val: 40 }, { val: 20 }] };
`);
ctxRun(`addRuleFromPreset('topology_contradiction');`);
assert(ctxRun(`analysisRules.length`) === 1, 'the preset becomes a rule');
assert(ctxRun(`analysisRules[0].presetId`) === 'topology_contradiction' && ctxRun(`analysisRules[0].mode`) === 'all', 'the rule records its preset and mode');
assert(ctxRun(`analysisRules[0].conditions.length`) === 3, 'conditions are copied from the preset');
assert(ctxRun(`(parsedTracks['RULE_' + analysisRules[0].id] || '')[2]`) === '\u25a0', 'the generated rule track marks the co-localized residue');
assert(ctxRun(`(parsedTracks['RULE_' + analysisRules[0].id] || '')[0]`) === ' ', 'residues outside the query stay blank');
ctxRun(`addRuleFromPreset('topology_contradiction');`);
assert(ctxRun(`analysisRules.length`) === 2 && ctxRun(`analysisRules[1].name`).indexOf('(2)') !== -1, 're-adding a preset gets a numbered name');
// mutation safety: editing the rule must not rewrite the preset
ctxRun(`analysisRules[0].conditions[0].value = 'CHANGED';`);
assert(ctxRun(`RULE_PRESETS.filter(p => p.id === 'topology_contradiction')[0].conditions[0].value`) === '', 'applied conditions are deep copies of the preset');
ctxRun(`analysisRules = []; parsedTracks = {}; guideProfile = {};`);

section('TM cross-check');
ctxRun(`
    analysisRules = []; guideProfile = {}; guideOverrides = {}; trackMeta = {};
    parsedTracks = { AA: 'MKV', 'TM_Quick2D': 'EEE', 'TP_TMHMM': 'MM ' };
    topologySources = [{ name: 'TMHMM', state: 'MM ' }];
`);
assert(ctxRun(`topologyTmText()`) === 'MM ', 'the topology text falls back to the single source');
let xc = ctxRun(`computeTmCrossCheck()`);
assert(xc.ok === true && xc.classes.join('') === '==q', 'concordance classes: both, both, Quick2D-only');
assert(xc.agree === 2 && xc.topoOnly === 0 && xc.q2dOnly === 1 && xc.pct === 67, 'counts and percentage are computed');
assert(xc.q2dSegments.length === 1 && xc.q2dSegments[0][0] === 2 && xc.q2dSegments[0][1] === 2, 'disagreement runs are 0-based inclusive ranges (selection convention)');

assert(ctxRun(`runTmCrossCheck() !== null`), 'running the cross-check succeeds when both inputs exist');
assert(ctxRun(`parsedTracks['XC_TM']`) === '==q', 'the cross-check writes the concordance track');
assert(ctxRun(`getTrackGroup('XC_TM')`) === 'XC' && ctxRun(`trackGroupLabel('XC')`) === 'Cross-checks', 'XC_ rows form the Cross-checks group');
assert(ctxRun(`getTrackSource('XC_TM')`) === 'Cross-check', 'the cross-check track reports its provenance');

// consensus is preferred over a single source
ctxRun(`
    parsedTracks = { AA: 'MKV', 'TM_Quick2D': ' EE', 'TP_Consensus': 'M  ', 'TP_A': 'M  ', 'TP_B': 'M  ' };
    topologySources = [{ name: 'A', state: 'M  ' }, { name: 'B', state: 'M  ' }];
`);
assert(ctxRun(`topologyTmText()`) === 'M  ', 'the consensus is used when it exists');
xc = ctxRun(`computeTmCrossCheck()`);
const cls2 = ctxRun(`computeTmCrossCheck().classes.join('')`);
assert(xc.consensus === true && cls2 === 'tqq', 'topology-only and Quick2D-only are distinguished (got "' + cls2 + '")');
assert(xc.topoOnly === 1 && xc.q2dOnly === 2, 'per-class counts match the synthetic data');
assert(xc.q2dSegments.length === 1 && xc.q2dSegments[0][0] === 1 && xc.q2dSegments[0][1] === 2, 'a contiguous Quick2D-only run is one segment');

// guard rails
ctxRun(`parsedTracks = { AA: 'MKV', 'TM_Quick2D': 'EEE' }; topologySources = [];`);
xc = ctxRun(`computeTmCrossCheck()`);
assert(xc.ok === false && xc.message.indexOf('topology') !== -1, 'missing topology is reported');
ctxRun(`parsedTracks = { AA: 'MKV', 'TP_X': 'M  ' };`);
assert(ctxRun(`computeTmCrossCheck()`).message.indexOf('transmembrane') !== -1, 'missing Quick2D TM is reported');
ctxRun(`parsedTracks = {};`);
assert(ctxRun(`computeTmCrossCheck()`).message.indexOf('sequence') !== -1, 'missing sequence is reported');

section('methods summary report');
ctxRun(`
    parsedTracks = { AA: 'MKV', 'TM_Quick2D': 'EEE', 'TP_TMHMM': 'MM ' };
    topologySources = [{ name: 'TMHMM', state: 'MM ' }];
    analysisRules = []; guideProfile = { membrane: 'yes' }; guideOverrides = {}; guideAnswers = {};
`);
ctxRun(`runTmCrossCheck();`);
let report = ctxRun(`buildMethodsReport()`);
assert(report.indexOf('# Quick2DViewer methods summary') === 0, 'the report opens with a title');
assert(report.indexOf('## Intake') !== -1 && report.indexOf('Is it membrane-associated or secreted?: Yes') !== -1, 'the report records the intake answers');
assert(report.indexOf('## Workflow coverage') !== -1 && report.indexOf('| # | Step | Status | Answer(s) |') !== -1, 'the report has a coverage table');
assert(report.indexOf('Coverage: ' + ctxRun(`guideProgress().covered`) + ' of ' + ctxRun(`guideProgress().denominator`)) !== -1,
    'the report states the coverage count (' + ctxRun(`guideProgress().covered`) + '/' + ctxRun(`guideProgress().denominator`) + ')');
assert(report.indexOf('## Loaded evidence') !== -1 && report.indexOf('Transmembrane: 1 track(s)') !== -1, 'the report lists the loaded evidence by type');
assert(report.indexOf('## TM cross-check') !== -1 && report.indexOf('67%') !== -1, 'the report includes the TM cross-check once run');
assert(report.indexOf('## References') !== -1 && report.indexOf('10.1093/nar/gkac1052') !== -1, 'the report cites the covered steps by DOI');
assert(report.indexOf('v' + ctxRun(`APP_VERSION`)) !== -1, 'the report stamps the app version');

ctxRun(`analysisRules = [{ id: 'r1', name: 'My rule', color: '#f00', mode: 'all', enabled: true, conditions: [{ kind: 'categorical', source: 'group:TM', op: 'annotated', value: '' }] }];`);
report = ctxRun(`buildMethodsReport()`);
assert(report.indexOf('## Analysis rules') !== -1 && report.indexOf('Transmembrane annotated') !== -1, 'the report lists rules in readable form');
ctxRun(`analysisRules = [];`);

let threw = null;
try { ctxRun(`exportMethodsReport()`); } catch (e) { threw = e.message; }
assert(threw === null, 'the export runs without throwing when data is loaded');
ctxRun(`parsedTracks = {};`);
threw = null;
try { ctxRun(`exportMethodsReport()`); } catch (e) { threw = e.message; }
assert(threw === null, 'the export refuses gracefully with no data');
ctxRun(`parsedTracks = { AA: 'MKV' }; guideProfile = {}; topologySources = [];`);

section('rules re-evaluate when data changes');
ctxRun(`
    analysisRules = []; parsedTracks = {}; guideProfile = {}; guideOverrides = {}; guideAnswers = {};
    analysisRules.push({ id: 'rx', name: 'TM probe', color: '#f00', mode: 'all', enabled: true,
        conditions: [{ kind: 'categorical', source: 'group:TM', op: 'annotated', value: '' }] });
`);
ctxRun(`applyRules();`);
assert(ctxRun(`parsedTracks['RULE_rx']`) === undefined, 'a rule with no inputs produces no track');
// loading the missing input must re-evaluate the rule without an explicit re-apply
ctxRun(`parsedTracks.AA = 'MKV'; parsedTracks['TM_Quick2D'] = ' E ';`);
// the harness stubs renderViewer (the real one needs layout APIs the stub DOM
// lacks), so exercise the same entry point it calls, and assert the call site.
assert(HTML.indexOf('reevaluateRulesIfNeeded(tracks);') !== -1, 'renderViewer calls the rule re-evaluation hook');
ctxRun(`reevaluateRulesIfNeeded(parsedTracks);`);
const rxVal = ctxRun(`(parsedTracks['RULE_rx'] || '')`);
assert(rxVal === ' ■ ', 'a data change re-evaluates existing rules (got "' + rxVal + '", rules=' + ctxRun(`analysisRules.length`) + ', tmKeys=' + ctxRun(`getGroupTrackKeys('TM').length`) + ')');
// and removing the input drops the stale row
// (removal is exercised silent here; the app's own path repaints through
// renderViewer, which calls the same hook)
ctxRun(`removeTracks(['TM_Quick2D'], { silent: true });`);
ctxRun(`reevaluateRulesIfNeeded(parsedTracks);`);
assert(ctxRun(`parsedTracks['RULE_rx']`) === undefined, 'removing the queried track drops the stale rule row');
// re-entrancy guard: applyRules must not recurse through renderViewer
let guardOk = true;
try { ctxRun(`applyRules(); applyRules();`); } catch (e) { guardOk = false; }
assert(guardOk, 'applyRules is safe to call repeatedly (re-entrancy guard)');
ctxRun(`analysisRules = []; parsedTracks = {};`);

section('session round-trip (registries persist)');
ctxRun(`
    parsedTracks = { AA: 'MKV', 'TP_TMHMM_run': 'M  ', 'UP_Sites': '\u25a0  ', 'DM_ubiquitin': '\u2588\u2588 ' };
    topologySources = [{ name: 'TMHMM run', state: 'M  ' }];
    uniprotFeatures = { accession: 'P00001', features: [] };
    uniprotFeatureTracks = { UP_Sites: { type: 'Site' } };
    domainHitsInfo = { DM_ubiquitin: { model: 'ubiquitin', database: 'Pfam' } };
    guideProfile = { membrane: 'yes' }; guideOverrides = { foldseek: 'skipped' }; guideAnswers = { 'structure.model': 'esmfold' };
`);
const saved = ctxRun(`gatherPersistableState()`);
assert(saved.topologySources && saved.topologySources.length === 1, 'topology sources are persisted');
assert(saved.uniprotFeatures && saved.uniprotFeatures.accession === 'P00001', 'the UniProt fetch is persisted');
assert(saved.domainHitsInfo && saved.domainHitsInfo.DM_ubiquitin, 'domain stats are persisted');
assert(saved.preferences.guideAnswers['structure.model'] === 'esmfold' && saved.preferences.guideOverrides.foldseek === 'skipped', 'guide answers + overrides are persisted');

// simulate a reload into a fresh context state
ctxRun(`
    parsedTracks = {}; topologySources = []; uniprotFeatures = null; uniprotFeatureTracks = {}; domainHitsInfo = {};
    guideProfile = {}; guideOverrides = {}; guideAnswers = {};
`);
ctxRun(`applyPersistedState(${JSON.stringify(saved)})`);
assert(ctxRun(`topologySources.length`) === 1, 'topology sources are restored');
assert(ctxRun(`uniprotFeatures.accession`) === 'P00001', 'the UniProt fetch is restored');
assert(ctxRun(`domainHitsInfo.DM_ubiquitin.model`) === 'ubiquitin', 'domain stats are restored');
assert(ctxRun(`guideAnswers['structure.model']`) === 'esmfold', 'step answers are restored');
assert(ctxRun(`guideStepStatus().filter(r => r.step.id === 'topology')[0].done`) === true, 'the restored topology data satisfies its guide step');

// and removal after a restore behaves (the bug this persistence fixes)
ctxRun(`removeTracks(['TP_TMHMM_run'], { silent: true });`);
assert(ctxRun(`topologySources.length`) === 0, 'removing the restored topology row removes its source');
assert(ctxRun(`Object.keys(parsedTracks).filter(k => k.indexOf('TP_') === 0).length`) === 0, 'the topology group is left empty rather than resurrected');
ctxRun(`parsedTracks = {}; topologySources = []; uniprotFeatures = null; uniprotFeatureTracks = {}; domainHitsInfo = {}; guideProfile = {}; guideOverrides = {}; guideAnswers = {};`);

section('identifier parsing + lookup defaults');
const headerFull = 'sp|P42212|GFP_AEQVI Green fluorescent protein OS=Aequorea victoria GN=GFP PE=1 SV=1';
let ph = ctxRun(`parseProteinHeaderLine(${JSON.stringify(headerFull)})`);
assert(ph.accession === 'P42212' && ph.entryName === 'GFP_AEQVI' && ph.database === 'sp', 'sp|accession|entry is parsed');
assert(ph.proteinName === 'Green fluorescent protein', 'the protein name is split off the trailing tags');
assert(ph.organism === 'Aequorea victoria' && ph.gene === 'GFP', 'OS= and GN= tags are extracted');

ph = ctxRun(`parseProteinHeaderLine(${JSON.stringify('sp|P42212|GFP_AEQVI Green fluorescent protein OS=')})`);
assert(ph.accession === 'P42212' && ph.organism === '' && ph.proteinName === 'Green fluorescent protein', 'an empty OS= tag is tolerated (the user-reported line)');
ph = ctxRun(`parseProteinHeaderLine('>sp|P42212|GFP_AEQVI GFP')`);
assert(ph.accession === 'P42212' && ph.entryName === 'GFP_AEQVI', 'a FASTA ">" header parses the same way');
ph = ctxRun(`parseProteinHeaderLine('P42212')`);
assert(ph && ph.accession === 'P42212', 'a bare accession is recognised');
assert(ctxRun(`parseProteinHeaderLine('')`) === null, 'an empty label parses to null');

// --- defaults derived from the loaded label --------------------------------
ctxRun(`currentProteinLabel = ${JSON.stringify(headerFull)};`);
let d = ctxRun(`deriveLookupDefaults()`);
assert(d.mode === 'accession' && d.accession === 'P42212', 'a labelled accession defaults the mode to Accession');
assert(d.searchField === 'any' && d.searchTerm === 'GFP_AEQVI', 'the search fallback uses the entry name on the "any field" query');
ctxRun(`currentProteinLabel = '>GFP Aequorea victoria green fluorescent protein';`);
d = ctxRun(`deriveLookupDefaults()`);
assert(d.mode === 'search' && d.searchField === 'protein', 'without an accession it defaults to Search (protein)');
assert(ctxRun(`deriveLookupDefaults()`) !== null, 'a free-text FASTA header still yields a search term');
ctxRun(`currentProteinLabel = null;`);
assert(ctxRun(`deriveLookupDefaults()`) === null, 'no label -> no defaults');

// --- term autocorrection ---------------------------------------------------
ctxRun(`
    currentProteinLabel = ${JSON.stringify(headerFull)};
    uniprotAnnotationMode = 'search';
    document.getElementById('uniprotSearchField').value = 'protein';
    document.getElementById('uniprotSearchInput').value = ${JSON.stringify(headerFull)};
`);
let r = ctxRun(`resolveUniProtSearchTerm()`);
assert(r.term === 'GFP_AEQVI' && r.field === 'any', 'a pasted identifier line is corrected to the entry name');
assert(r.correctedFrom.indexOf('sp|') === 0, 'the correction records what it replaced (for the toast)');
ctxRun(`document.getElementById('uniprotSearchInput').value = 'myoglobin';`);
r = ctxRun(`resolveUniProtSearchTerm()`);
assert(r.term === 'myoglobin' && r.correctedFrom === '', 'a normal search term is left alone');
ctxRun(`document.getElementById('uniprotSearchInput').value = '';`);
r = ctxRun(`resolveUniProtSearchTerm()`);
assert(r.term === 'GFP_AEQVI' && r.field === 'any', 'an empty box is filled from the loaded identifier');
ctxRun(`currentProteinLabel = null; uniprotAnnotationMode = 'accession';`);

// --- plain FASTA / sequence-only start -------------------------------------
assert(ctxRun(`JSON.stringify(parsePlainFasta('>sp|P42212|GFP_AEQVI GFP\\nMSKGEELFTGVVPILVELDGDVNGHKF') )`) !== 'null', 'a plain FASTA parses');
let pf = ctxRun(`parsePlainFasta('>id desc\\nMSKGEEL-FT.GV\\nVPILVEL')`);
assert(pf.label === 'id desc' && pf.sequence === 'MSKGEELFTGVVPILVEL', 'gaps/dots and newlines are stripped from the sequence');
pf = ctxRun(`parsePlainFasta('>one\\nMKV\\n>two\\nAAA')`);
assert(pf.sequence === 'MKV', 'only the first record is used');
assert(ctxRun(`parsePlainFasta('MKV')`) === null, 'sequence with no header is not treated as FASTA');
assert(ctxRun(`isPlainFastaInput('>x\\nMKV')`) === true, '">" input is detected as FASTA');
assert(ctxRun(`isPlainFastaInput('AA_QUERY 1 MSGR 5')`) === false, 'Quick2D output is never mistaken for FASTA');
assert(ctxRun(`isPlainFastaInput('MKV')`) === false, 'a bare sequence is not detected as FASTA');
// and it builds a sequence-only session
ctxRun(`parsedTracks = {}; trackMeta = {}; guideProfile = {};`);
assert(ctxRun(`buildFromPlainFasta('>sp|P42212|GFP_AEQVI GFP\\nMSKGEELFTGVVPILVELDGDVNG')`) === true, 'a plain FASTA builds a session');
assert(ctxRun(`(parsedTracks.AA || '').length`) === 24, 'the FASTA sequence becomes the reference row');
assert(ctxRun(`currentProteinLabel`) === 'sp|P42212|GFP_AEQVI GFP', 'the FASTA header becomes the protein label');
assert(ctxRun(`Object.keys(parsedTracks).length`) === 1, 'a sequence-only session has no other tracks');
ctxRun(`parsedTracks = {}; currentProteinLabel = null;`);

// --- registry + adapter wiring --------------------------------------------
assert(ctxRun(`SERVICE_REGISTRY.capabilities.text_search.providers[0].id`) === 'ebi_search_uniprot', 'EBI Search is the primary text-search provider');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.text_search.providers[0].url`).indexOf('ebisearch/ws/rest/uniprot') !== -1, 'it points at the EBI Search UniProt index');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.text_search.providers[1].enabled`) === false, 'the unresponsive EBI Proteins provider is disabled');
assert(ctxRun(`typeof SERVICE_ADAPTERS.ebiSearchUniprot === 'function'`), 'the EBI Search adapter is registered');
assert(ctxRun(`EBI_SEARCH_FIELDS.protein`) === 'descRecName' && ctxRun(`EBI_SEARCH_FIELDS.any`) === '', 'field prefixes map to real EBI Search fields (any = bare query)');
assert(ctxRun(`typeof beginLookupStatus === 'function' && typeof endLookupStatus === 'function' && LOOKUP_ESTIMATES.search.indexOf('s') !== -1`), 'lookup progress helpers exist with estimates');

section('step links + intake relevance');
const stepsById = ctxRun(`(function(){ var o = {}; WORKFLOW_STEPS.forEach(s => { o[s.id] = s; }); return o; })()`);
assert(stepsById.homologs.desc.indexOf('toolkit.tuebingen.mpg.de/tools/hhpred') !== -1, 'the homologs step links to MPI HHpred');
assert(stepsById.homologs.desc.indexOf("MPI's HHpred") !== -1, 'the link text is MPI\'s HHpred');
assert(stepsById.topology.desc.indexOf('services.healthtech.dtu.dk/services/TMHMM-2.0') !== -1, 'the topology step links TMHMM');
assert(stepsById.topology.desc.indexOf('services/Phobius-1.01') !== -1 && stepsById.topology.desc.indexOf('services/DeepTMHMM-1.0') !== -1, 'the topology step links Phobius and DeepTMHMM');

// --- the intake can rule a step out (the "not membrane associated" loop) ----
ctxRun(`guideOverrides = {}; guideAnswers = {}; parsedTracks = { AA: 'MKV' };`);
ctxRun(`guideProfile = { membrane: 'yes' };`);
let topo = ctxRun(`guideStepStatus().filter(r => r.step.id === 'topology')[0]`);
assert(topo.priority === true && topo.notRelevant === false, 'membrane=yes keeps topology recommended');
ctxRun(`guideProfile = { membrane: 'no' };`);
topo = ctxRun(`guideStepStatus().filter(r => r.step.id === 'topology')[0]`);
assert(topo.notRelevant === true && topo.priority === false, 'membrane=no marks topology not relevant');
assert(ctxRun(`(function(){ var n = nextGuideStep(); return n ? n.step.id : null; })()`) !== 'topology', 'a not-relevant step is never the recommendation');
const progNo = ctxRun(`guideProgress()`);
assert(progNo.notRelevant === 1 && progNo.denominator === progNo.total - 1, 'not-relevant steps leave the coverage denominator');
assert(progNo.excluded === 1, 'the excluded count covers not-relevant steps');
assert(ctxRun(`guideChip(guideStepStatus().filter(r => r.step.id === 'topology')[0])`).indexOf('not relevant') !== -1, 'the chip says not relevant');
ctxRun(`guideProfile = { membrane: 'unsure' };`);
assert(ctxRun(`guideStepStatus().filter(r => r.step.id === 'topology')[0].notRelevant`) === false, 'only an explicit "no" rules it out (unsure keeps it optional)');
ctxRun(`guideProfile = {}; guideOverrides = {}; parsedTracks = {};`);

// --- the doc mirrors the links (markdown, not raw html) --------------------
assert(WORKFLOW_MD.indexOf('https://toolkit.tuebingen.mpg.de/tools/hhpred') !== -1, 'WORKFLOW.md carries the HHpred link');
assert(WORKFLOW_MD.indexOf('[MPI\'s HHpred]') !== -1, 'WORKFLOW.md renders it as a markdown link');
assert(WORKFLOW_MD.indexOf('<a href') === -1, 'WORKFLOW.md has no raw HTML anchors');
assert(WORKFLOW_MD.indexOf('Ruled out when') !== -1, 'WORKFLOW.md documents when the intake rules a step out');

section('short form hosts the current question');
ctxRun(`guideProfile = {}; guideAnswers = {}; guideOverrides = {}; parsedTracks = { AA: 'MKV' }; guideIntakeOpen = null; renderWorkflowGuide();`);
let gHtml2 = ctxRun(`document.getElementById('guidePanel').innerHTML`);
const sliceNext = (h) => h.slice(h.indexOf('guide-next-action'), h.indexOf('guide-steps'));
let nextBlk = sliceNext(gHtml2);
assert(ctxRun(`(function(){ var n = nextGuideStep(); return n ? n.step.id : null; })()`) === 'homologs', 'with only a sequence loaded the homologs step is next (matches the reported case)');
assert(nextBlk.indexOf('Is the HHpred .hhr ready?') !== -1, 'the short form asks the current step question');
assert(nextBlk.indexOf('Yes, ready to attach') !== -1 && nextBlk.indexOf('Not yet') !== -1, 'the options are answerable from the short form');
assert(nextBlk.indexOf('toolkit.tuebingen.mpg.de/tools/hhpred') === -1, 'the long description is NOT repeated in the short form (was the redundancy)');
assert(gHtml2.indexOf('toolkit.tuebingen.mpg.de/tools/hhpred') !== -1, 'the description still lives in the step card below');

ctxRun(`setStepAnswer('homologs', 'hhpred', 'ready');`);
gHtml2 = ctxRun(`document.getElementById('guidePanel').innerHTML`);
nextBlk = sliceNext(gHtml2);
assert(nextBlk.indexOf('Is the HHpred .hhr ready?') === -1, 'answering collapses the question away');
assert(nextBlk.indexOf('Attach the .hhr') !== -1, 'the tailored hint replaces it');
assert(nextBlk.indexOf('Load .hhr / variant FASTA') !== -1, 'the tailored action is offered');
assert(gHtml2.indexOf('guide-opt-on') !== -1, 'the step card keeps the question as the editable record of the answer');

ctxRun(`setStepAnswer('homologs', 'hhpred', 'no');`);
nextBlk = sliceNext(ctxRun(`document.getElementById('guidePanel').innerHTML`));
assert(nextBlk.indexOf('Open HHpred') !== -1 && nextBlk.indexOf('Run HHpred on the sequence') !== -1, 'the other answer yields its own action + hint');
ctxRun(`guideAnswers = {}; parsedTracks = {};`);

section('guide focus, re-scan state + structure evidence');
ctxRun(`guideProfile = {}; guideAnswers = {}; guideOverrides = {}; parsedTracks = { AA: 'MKV' }; guideIntakeOpen = null; renderWorkflowGuide();`);
let gHtml = ctxRun(`document.getElementById('guidePanel').innerHTML`);
const nextId = ctxRun(`(function(){ var n = nextGuideStep(); return n ? n.step.id : null; })()`);
assert(gHtml.indexOf('guide-step-current') !== -1, 'the current step is highlighted');
assert(gHtml.indexOf('data-step="' + nextId + '"') !== -1 && gHtml.indexOf('guide-step-current') !== -1, 'the highlight is on the step the Next card names');
assert((gHtml.match(/guide-step-current/g) || []).length === 1, 'only one step is marked current');

// Re-scan label + done styling once a domain scan exists
ctxRun(`domainHitsInfo = {}; parsedTracks = { AA: 'MKV' };`);
ctxRun(`setStepAnswer('annotation', 'have', 'domains');`);
let annAct = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'annotation')[0])`);
assert(annAct.label === 'Scan HMMER/Pfam' && annAct.done === false, 'a first scan reads Scan HMMER/Pfam');
ctxRun(`domainHitsInfo = { DM_GFP: { model: 'GFP', domains: [] } };`);
annAct = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'annotation')[0])`);
assert(annAct.label === 'Re-scan HMMER/Pfam' && annAct.done === true, 'after a scan it reads Re-scan HMMER/Pfam and reports done (greyed button)');
assert(annAct.run === 'runDomainScan()', 'the re-scan still runs the same action');
ctxRun(`domainHitsInfo = {}; guideAnswers = {};`);

// Structure evidence tailors the offered action and the read-out
ctxRun(`guideProfile = { structure: 'experimental' };`);
assert(ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'structure')[0]).run`) === 'openInputDataModal()', 'experimental evidence offers attaching a file');
ctxRun(`guideProfile = { structure: 'none' };`);
assert(ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'structure')[0]).run`) === 'predictStructureESMFold()', 'no structure offers a prediction');
ctxRun(`parsedTracks = { AA: 'MKV', 'm_pLDDT': [{ val: 90 }] }; guideProfile = { structure: 'predicted' };`);
assert(ctxRun(`computeGuideInsights()`).some(i => /predicted only/.test(i.text)), 'predicted-only evidence adds a read-out caveat');
ctxRun(`parsedTracks = { AA: 'MKV' }; guideProfile = { structure: 'experimental' };`);
assert(!ctxRun(`computeGuideInsights()`).some(i => /predicted only/.test(i.text)), 'the caveat is specific to predicted-only');
// the structure step is never optional (structural homology depends on it)
assert(ctxRun(`WORKFLOW_STEPS.filter(s => s.id === 'structure')[0].priority({})`) === true, 'the structure step is always on the critical path');
ctxRun(`guideProfile = {}; parsedTracks = {};`);

section('layout, hover + copy polish');
// --- 1/2. heatmap rows span the full scroll width (the "doesn't reach the
// right / looks duplicated" report): block boxes in a horizontal scroller are
// viewport-sized, so rows needed max-content + min-width explicitly. ---
assert(HTML.indexOf('width: max-content;') !== -1, 'rows declare a content width');
const rowCss = HTML.slice(HTML.indexOf('.track-row {'), HTML.indexOf('.track-row {') + 700);
assert(rowCss.indexOf('width: max-content') !== -1 && rowCss.indexOf('min-width: 100%') !== -1, '.track-row spans max(content, viewport)');
const stickyCss = HTML.slice(HTML.indexOf('.sticky-top {'), HTML.indexOf('.sticky-top {') + 500);
assert(stickyCss.indexOf('width: max-content') !== -1, '.sticky-top spans the content width too');
const posCss = HTML.slice(HTML.indexOf('.track-position-row {'), HTML.indexOf('.track-position-row {') + 400);
assert(posCss.indexOf('width: max-content') !== -1, 'the residue-position row spans the content width');

// --- 6. the grey column highlight is hover-only ---
assert(typeof ctxRun(`clearHoverHighlight`) === 'function' && typeof ctxRun(`installHoverHighlightClear`) === 'function', 'the hover highlight can be cleared and is installed');
assert(HTML.indexOf("getElementById('alignmentGrid')") !== -1 && HTML.indexOf("addEventListener('mouseleave', clearHoverHighlight)") !== -1, 'leaving the grid clears it');
assert(HTML.indexOf("document.documentElement.addEventListener('mouseleave', clearHoverHighlight)") !== -1, 'leaving the window clears it');
assert(HTML.indexOf("window.addEventListener('blur', clearHoverHighlight)") !== -1, 'losing focus clears it');

// --- 3. no em-dashes anywhere the user reads ---
assert(HTML.indexOf('\u2014') === -1, 'no literal em-dash escapes remain in the app');
assert(HTML.indexOf('\u2014'.replace('\\u', '\\u')) === -1, 'no literal em-dash escapes remain (second form)');
assert(HTML.indexOf(String.fromCharCode(8212)) === -1, 'no real em-dash characters remain in the app');
assert(WORKFLOW_MD.indexOf(String.fromCharCode(8212)) === -1, 'no em-dash in the generated reference doc');

// --- 4. intake is a "Protein Background" accordion that compresses ---
assert(HTML.indexOf('Protein Background') !== -1, 'the intake block is titled Protein Background');
assert(ctxRun(`typeof guideIntakeOpen !== 'undefined'`), 'its open state is tracked');
ctxRun(`guideProfile = {}; guideAnswers = {}; guideOverrides = {}; parsedTracks = { AA: 'MKV' }; guideIntakeOpen = null; renderWorkflowGuide();`);
let guideHtml = ctxRun(`document.getElementById('guidePanel').innerHTML`);
assert(guideHtml.indexOf('Protein Background') !== -1, 'the accordion renders');
assert(guideHtml.indexOf('guideIntake" open') !== -1, 'it starts open while questions are unanswered');
ctxRun(`GUIDE_QUESTIONS.forEach(q => { guideProfile[q.id] = q.options[0].value; }); guideIntakeOpen = null; renderWorkflowGuide();`);
guideHtml = ctxRun(`document.getElementById('guidePanel').innerHTML`);
assert(guideHtml.indexOf('guideIntake" open') === -1, 'it compresses once every question is answered');
assert(guideHtml.indexOf('reset answers') !== -1, 'a reset affordance is still offered');
ctxRun(`guideIntakeOpen = true; renderWorkflowGuide();`);
assert(ctxRun(`document.getElementById('guidePanel').innerHTML`).indexOf('guideIntake" open') !== -1, 'the user can re-open it for the session');

// --- 5. no filler sign-off ---
assert(HTML.indexOf('for the record') === -1, 'the filler "for the record" sign-off is gone');
assert(HTML.indexOf('All steps covered</strong>') !== -1, 'the all-covered state is a plain status line');
ctxRun(`guideProfile = {}; guideIntakeOpen = null; parsedTracks = {};`);

section('guide coachmarks (walk the user to a submenu)');
assert(ctxRun(`Object.keys(GUIDE_COACHMARKS).join(',')`) === 'rules,interfaces', 'coachmarks are declared for the two submenu hand-offs');
assert(ctxRun(`GUIDE_COACHMARKS.rules.banner`) === 'guideCoachmarkRules' && ctxRun(`GUIDE_COACHMARKS.interfaces.banner`) === 'guideCoachmarkInterfaces', 'each coachmark owns a banner');
// the integration step and its resolver both route through the coachmark
assert(ctxRun(`WORKFLOW_STEPS.filter(s => s.id === 'integration')[0].action.run`).indexOf('openGuideCoachmark') === 0, 'the Integrate step opens Rules via the coachmark');
assert(ctxRun(`WORKFLOW_STEPS.filter(s => s.id === 'integration')[0].extraActions[0].run`).indexOf('openGuideCoachmark') === 0, 'its Interfaces action does too');

// open: target opens, siblings collapse, banner explains the way back
ctxRun(`
    guideCoachmark = null;
    document.getElementById('trackManagerSection').open = true;
    document.getElementById('crossCheckSection').open = true;
    document.getElementById('rulesSection').open = false;
    openGuideCoachmark('rules');
`);
assert(ctxRun(`guideCoachmark`) === 'rules', 'the coachmark is active');
assert(ctxRun(`document.getElementById('guideCoachmarkRules').hidden`) === false, 'its banner is shown');
assert(ctxRun(`document.getElementById('guideCoachmarkRules').innerHTML`).indexOf('Return to Guide') !== -1, 'the banner offers the way back');
assert(ctxRun(`document.getElementById('trackManagerSection').open`) === false && ctxRun(`document.getElementById('crossCheckSection').open`) === false, 'sibling Tracks sections collapse');
assert(ctxRun(`document.getElementById('rulesSection').open`) === true, 'the target section opens');
assert(ctxRun(`document.getElementById('rulePresetsSection').open`) === true, 'the suggested presets are surfaced');
assert(ctxRun(`document.getElementById('rulePresetList').classList`) !== undefined, 'the preset list is reachable for highlighting');

// leaving the submenu clears it and restores what was open
ctxRun(`clearGuideCoachmark();`);
assert(ctxRun(`guideCoachmark`) === null, 'clearing deactivates the coachmark');
assert(ctxRun(`document.getElementById('guideCoachmarkRules').hidden`) === true, 'the banner hides again');
assert(ctxRun(`document.getElementById('trackManagerSection').open`) === true, 'the previously-open sections are restored');

// switching tabs away clears it (moving out of the submenu)
ctxRun(`guideCoachmark = null; openGuideCoachmark('rules');`);
ctxRun(`switchSidebarTab('tracks');`);
assert(ctxRun(`guideCoachmark`) === 'rules', 'staying on the Tracks tab keeps the guidance');
ctxRun(`switchSidebarTab('selection');`);
assert(ctxRun(`guideCoachmark`) === null, 'moving to another tab clears it');
ctxRun(`openGuideCoachmark('rules'); returnToGuide();`);
assert(ctxRun(`guideCoachmark`) === null, 'Return to Guide clears the coachmark');
ctxRun(`guideCoachmark = null;`);

section('foldseek prerequisite + lockout');
const fsStep = ctxRun(`WORKFLOW_STEPS.filter(s => s.id === 'foldseek')[0]`);
assert(fsStep.desc.indexOf('at least one structure') !== -1, 'the foldseek step states the structure prerequisite');
assert(!fsStep.extraActions || !fsStep.extraActions.some(a => a.run === 'attachStructures()'), 'Attach Structure(s) is not duplicated as a permanent extra action (the resolver offers it only when needed)');
assert(typeof ctxRun(`attachStructures`) === 'function', 'the attach action is shared with the Input Data button');

// no structure attached -> the prerequisite is what gets offered
ctxRun(`cachedStructureTexts = {}; guideAnswers = {};`);
let fa = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'foldseek')[0])`);
assert(fa.run === 'attachStructures()', 'without a structure the step offers Attach Structure(s) (not a search that can only fail)');
assert(fa.hint.indexOf('3D structure') !== -1, 'the hint explains why a structure is needed');

// with a structure attached -> the real search, labelled with the db + honesty about usage
ctxRun(`cachedStructureTexts = { 'model.pdb': 'ATOM' };`);
ctxRun(`setStepAnswer('foldseek', 'db', 'pdb100');`);
fa = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'foldseek')[0])`);
assert(fa.run === 'runFoldseekSearch()', 'a structure unlocks the Foldseek search action');
assert(fa.label.indexOf('pdb100') !== -1, 'the button names the chosen database');
assert(fa.hint.indexOf('1 attached, 1 used') !== -1, 'the hint says only one model is searched (more do not widen it)');
assert(ctxRun(`STEP_TASK_RUNS.foldseek`) === fa.run, 'the Foldseek button is marked as a long-running task (spinner + lock)');
ctxRun(`cachedStructureTexts = {}; guideAnswers = {};`);

section('default track views (homologs = AA)');
const defState = ctxRun(`getDefaultTrackControlState()`);
assert(defState.aaSeq.HL === true, 'homolog rows default to the AA-letters view');
assert(defState.fullBar.HH === undefined, 'the stale fullBar.HH key from the HH_ rename is gone');
assert(defState.fullBar.TM === true, 'transmembrane still defaults to the bar view');
ctxRun(`trackControlState = getDefaultTrackControlState();`);
assert(ctxRun(`getEffectiveGroupView('HL')`) === 'aa', 'the homolog group resolves to AA with the default state');
assert(ctxRun(`getEffectiveGroupView('TM')`) === 'bar', 'transmembrane resolves to bar with the default state');
ctxRun(`trackControlState = getDefaultTrackControlState(); trackControlState.aaSeq.HL = false;`);
assert(ctxRun(`getEffectiveGroupView('HL')`) === 'glyphs', 'clearing the flag falls back to the match-quality glyphs');

section('task lockout + domain tooltips');
ctxRun(`
    analysisRules = []; guideProfile = {}; guideOverrides = {}; guideAnswers = {};
    parsedTracks = { AA: 'M'.repeat(238), 'DM_GFP': ' '.repeat(16) + '\u2588'.repeat(194) + ' '.repeat(28) };
    domainHitsInfo = { DM_GFP: { model: 'GFP', description: 'Green fluorescent protein', database: 'Pfam',
        evalue: 2.5e-40, score: 180.4, domains: [{ start: 17, end: 210, iEvalue: 2.5e-40, score: 180.4, acc: 0.99 }] } };
`);

// --- domain rows get a real tooltip, not the blank placeholder -------------
const di = ctxRun(`buildDomainPredictorInfo('DM_GFP')`);
assert(di.name.indexOf('GFP') === 0 && di.name.indexOf('Green fluorescent protein') !== -1, 'the tooltip names the family and its description');
assert(di.category.indexOf('HMMER') !== -1 && di.category.indexOf('Pfam') !== -1, 'the tooltip attributes the source (HMMER/Pfam)');
assert(di.description.indexOf('i-Evalue') !== -1 && di.description.indexOf('180') !== -1, 'the tooltip reports the hit statistics');
assert(di.useCase.indexOf('17\u2013210') !== -1 || di.useCase.indexOf('17') !== -1, 'the tooltip explains the covered span');
assert(di.citation.indexOf('10.1093/nar/gkaa913') !== -1, 'the tooltip carries the Pfam citation');
assert(ctxRun(`getPredictorInfo('DM_GFP').category`).indexOf('HMMER') !== -1, 'getPredictorInfo routes DM_ rows to the domain tooltip');
assert(ctxRun(`getPredictorInfo('DM_GFP').category !== 'Structural Prediction'`), 'DM_ rows no longer show the blank Structural Prediction placeholder');
assert(ctxRun(`buildDomainPredictorInfo('DM_Unknown').name`) === 'Unknown', 'an unstatisticised domain row still names its family');
// span semantics: a 238 aa sequence with a 17-210 hit is blank outside the span
const span = ctxRun(`(function(){ var t = parsedTracks['DM_GFP']; return [t.slice(0,16).trim(), t.slice(16,210).replace(/ /g,'').length, t.slice(210).trim()]; })()`);
assert(span[0] === '' && span[1] === 194 && span[2] === '', 'the row marks exactly the aligned span (blank before/after)');

// --- one task at a time -----------------------------------------------------
ctxRun(`guideTask = null;`);
assert(ctxRun(`beginGuideTask('annotation', 'HMMER running')`) === true, 'the first task starts');
assert(ctxRun(`guideTask && guideTask.stepId`) === 'annotation', 'the running task is recorded');
assert(ctxRun(`beginGuideTask('foldseek', 'Foldseek running')`) === false, 'a second task is refused while one runs');
assert(ctxRun(`guideTask.stepId`) === 'annotation', 'the refused task did not replace the running one');
ctxRun(`endGuideTask('foldseek', 'nope', 'error');`);
assert(ctxRun(`guideTask !== null`), 'a mismatched end does not clear the running task');
ctxRun(`endGuideTask('annotation', 'done', 'success');`);
assert(ctxRun(`guideTask === null`), 'the owning task clears it');
assert(ctxRun(`beginGuideTask('annotation', 'again')`) === true && ctxRun(`guideTask !== null`), 'it can start again afterwards');
ctxRun(`endGuideTask('annotation');`);
assert(ctxRun(`guideTask === null`), 'a silent end clears the task');

// --- timer toasts + button markers -----------------------------------------
let toastThrew = null;
try { ctxRun(`showTimerToast('t1', 'Working'); endTimerToast('t1', 'Done', 'success');`); } catch (e) { toastThrew = e.message; }
assert(toastThrew === null, 'timer toasts can be shown and ended without throwing');
assert(ctxRun(`typeof syncTaskButtons === 'function'`), 'task buttons can be synced');
assert(ctxRun(`STEP_TASK_RUNS.annotation`) === 'runDomainScan()' && ctxRun(`STEP_TASK_RUNS.foldseek`) === 'runFoldseekSearch()', 'long-running steps declare their action');
// the marker must match what the resolver actually offers for that answer
ctxRun(`guideAnswers = {}; setStepAnswer('annotation', 'have', 'domains');`);
assert(ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'annotation')[0]).run`) === ctxRun(`STEP_TASK_RUNS.annotation`), 'the domains answer resolves to the task run (so the button gets locked)');
ctxRun(`guideAnswers = {}; parsedTracks = {}; domainHitsInfo = {};`);

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
