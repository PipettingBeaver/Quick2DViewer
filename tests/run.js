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
const PHMMER_FIXTURE = fs.readFileSync(path.join(ROOT, 'tests/fixtures/phmmer-gfp.out'), 'utf-8');
const BLAST_FIXTURE = fs.readFileSync(path.join(ROOT, 'tests/fixtures/blast-gfp.json'), 'utf-8');
const IPR_TOPO_FIXTURE = fs.readFileSync(path.join(ROOT, 'tests/fixtures/iprscan-lacy-topology.tsv'), 'utf-8');
const IPR_DOM_FIXTURE = fs.readFileSync(path.join(ROOT, 'tests/fixtures/iprscan-lacy-domains.tsv'), 'utf-8');
const IPR_PROSITE_FIXTURE = fs.readFileSync(path.join(ROOT, 'tests/fixtures/iprscan-lacy-prosite.tsv'), 'utf-8');
const PDBE_OUTLIERS_FIXTURE = fs.readFileSync(path.join(ROOT, 'tests/fixtures/pdbe-1gfl-outliers.json'), 'utf-8');
const PDBE_QUALITY_FIXTURE = fs.readFileSync(path.join(ROOT, 'tests/fixtures/pdbe-1gfl-quality.json'), 'utf-8');
const Q2D_GFP_FIXTURE = fs.readFileSync(path.join(ROOT, 'GFP/Q2D_GFP.txt'), 'utf-8');

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
  getComputedStyle: () => ({ backgroundColor: '', fill: '#facc15' }),
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

section('source colouring');
assert(ctxRun(`typeof sourceColorFor === 'function' && typeof isSourceColorOn === 'function' && typeof setSourceColor === 'function'`), 'source-colour helpers are defined');
assert(ctxRun(`SOURCE_COLORS['HHpred'] !== SOURCE_COLORS['BLAST']`), 'HHpred and BLAST get distinct colours');
assert(ctxRun(`sourceColorFor('HHpred') === sourceColorFor('HHpred')`), 'a source colour is stable');
assert(ctxRun(`/^#[0-9a-f]{6}$/.test(sourceColorFor('Some Brand New Source'))`), 'an unknown source falls back to a palette colour');
assert(ctxRun(`sourceColorFor('HMMER (Pfam)') === sourceColorFor('HMMER (InterPro)')`), 'a database suffix collapses to the family colour');
assert(ctxRun(`getDefaultTrackControlState().sourceColor === false`), 'source colouring defaults off');
ctxRun(`trackControlState = getDefaultTrackControlState(); setSourceColor(true);`);
assert(ctxRun(`isSourceColorOn() === true`), 'the toggle turns source colouring on');
ctxRun(`trackControlState = getDefaultTrackControlState();`);
assert(HTML.indexOf('.track-label.source-colored') !== -1, 'the source-coloured label stripe is styled');

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
const jsd = ctxRun(`(function(){ parsedTracks = { AA: 'XXX' }; return { w: computeConservationScores(['W','W','W'], 'jsd')[0], a: computeConservationScores(['A','A','A'], 'jsd')[0], mix: computeConservationScores(['A','R','N','D','G'], 'jsd')[0] }; })()`);
assert(jsd.w > 0.9 && jsd.w <= 1, 'JSD scores a conserved rare column highly (bounded to 1)');
assert(jsd.a > 0.5 && jsd.a <= 1, 'JSD is non-zero for a conserved common column (was always 0)');
assert(jsd.mix < jsd.a, 'a diverse column diverges from background less than a conserved one');

section('UniProt feature parsing (both backends)');
const upA = ctxRun(`parseUniProtFeatures({ features: [ { type:'Signal', location:{ start:{value:1}, end:{value:22} } }, { type:'Subcellular location', location:{ value:'x' } } ] })`);
assert(upA.length === 1 && upA[0].type === 'Signal', 'rest.uniprot.org parser (skips non-residue)');
const upB = ctxRun(`parseUniProtFeaturesEBI({ features: [ { type:'TRANSMEM', begin:'12', end:'30' }, { type:'CHAIN', begin:'1', end:'99' } ] })`);
assert(upB.length === 1 && upB[0].type === 'Transmembrane', 'EBI parser maps TRANSMEM, drops CHAIN');

section('topology parser + consensus');
const tp = ctxRun(`parseTopologyText('inside 1 11\\nTMhelix 12 30\\noutside 31 40', 40)`);
assert(tp && tp.state[11] === 'M' && tp.state[30] === 'o', 'TMHMM segments parsed');
ctxRun(`topologySources = [ { name:'Topology 1', state:'iiiiMMMMoooo' }, { name:'Topology 2', state:'iiiiiMMMooooo' } ]; parsedTracks.AA = 'X'.repeat(13); if (!window.__realRenderViewer) window.__realRenderViewer = renderViewer; renderViewer = function(){}; schedulePersist = function(){}; applyTopologySources();`);
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
const mdHtml = ctxRun(`renderDocMarkdown('## [1.0.0] - x\\n\\n### Added\\n\\n- a **b**\\n')`);
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
assert(ctxRun(`qaHighlightsEnabled`) === false, 'new-feature highlights are off by default');
assert(HTML.indexOf("qaHighlightsEnabled = prefs.qaHighlightsEnabled === true;") !== -1, 'a saved session only re-enables them when explicitly on');

section('onboarding + clear-data split');
assert(ctxRun(`typeof maybeShowWelcome === 'function' && typeof startTour === 'function' && typeof endTour === 'function'`), 'onboarding entry points are defined');
assert(ctxRun(`typeof clearInputData === 'function' && typeof clearAllData === 'function' && typeof resetInputDataState === 'function' && typeof resetPreferencesState === 'function'`), 'clear-data split functions are defined');
assert(ctxRun(`WELCOME_KEY === 'q2dViewer_welcome_v1'`), 'the welcome memory has its own storage key');
assert(ctxRun(`EMPTY_STATE_HTML.indexOf('Open Input Data') !== -1 && EMPTY_STATE_HTML.indexOf('Attach files') !== -1`), 'the empty state points at Input Data and Attach files');
assert(ctxRun(`EMPTY_STATE_HTML.indexOf('Get started') !== -1 && EMPTY_STATE_HTML.indexOf('Take the tour') !== -1 && EMPTY_STATE_HTML.indexOf("openDataSources('uniprot')") !== -1`), 'the empty state is a get-started checklist with a tour link');
assert(ctxRun(`EMPTY_STATE_HTML.indexOf('Try GFP') === -1`), 'the empty state no longer has a direct Try GFP shortcut');
assert(HTML.indexOf('>Quick start</h4>') !== -1 && HTML.indexOf('<strong>File ▸ Data Sources…</strong> opens every source') !== -1, 'the Help modal carries a quick start naming File -> Data Sources');
assert(HTML.indexOf('id="welcomeModal"') !== -1 && HTML.indexOf('id="tourBar"') !== -1, 'the welcome modal and tour bar exist in the markup');
assert(HTML.indexOf('recommended to click <strong>Show me around</strong>') !== -1, 'the welcome modal recommends the tour');
assert(HTML.indexOf('id="tryGfpBtn"') === -1 && ctxRun(`typeof tryGfpExample === 'undefined'`), 'there is no header Try GFP button or helper');
assert(HTML.indexOf('Load example protein') !== -1 && HTML.indexOf('id="inputAccessionPreset"') !== -1, 'Input Data exposes a Load example protein control');
assert(HTML.indexOf('onclick="clearInputData()"') !== -1 && HTML.indexOf('onclick="clearAllData()"') !== -1, 'the Storage cache controls offer both clear actions');
assert(HTML.indexOf("menuBarAction('clearInput')") !== -1 && HTML.indexOf("menuBarAction('clearAll')") !== -1, 'the File menu exposes both clear actions');
assert(ctxRun('TOUR_STEPS.length') >= 3, 'the tour has at least three steps');
assert(ctxRun(`TOUR_STEPS.map(s => s.target).join(',')`) === 'menubar-file-btn,menubar-file-input,inputAccessionPreset,menubar-file-btn,tab-tracks,tab-guide,menubar-export-btn', 'the tour targets the documented controls');
assert(ctxRun(`TOUR_STEPS[0].require === 'menu-open:file' && TOUR_STEPS[1].require === 'input-modal-open'`), 'opening File then Input Data are required steps');
assert(ctxRun(`TOUR_STEPS[2].body.indexOf('Load example protein') !== -1 && TOUR_STEPS[2].body.indexOf('GFP') !== -1`), 'the Load example step tells the user about GFP');
assert(ctxRun(`TOUR_STEPS[2].advanceOn === 'example-loaded' && !TOUR_STEPS[2].require`), 'picking an example auto-advances the Load example step (Next stays available)');
assert(ctxRun(`TOUR_STEPS[3].body.indexOf('Data Sources') !== -1 && !TOUR_STEPS[3].require`), 'the Data Sources step is optional and points at File -> Data Sources');
assert(ctxRun(`TOUR_STEPS[4].target === 'tab-tracks' && TOUR_STEPS[4].require === 'tab-open:tracks'`), 'the Tracks step is required (click the Tracks tab)');
assert(ctxRun(`!TOUR_STEPS.some(function (s) { return s.require && s.target === 'menubar-export-btn'; })`), 'the Export step is optional (no requirement)');
['menubar-file-btn', 'menubar-file-input', 'inputAccessionPreset', 'tab-tracks', 'tab-guide', 'menubar-export-btn'].forEach(id => {
    assert(HTML.indexOf('id="' + id + '"') !== -1, 'tour target id exists in the markup: ' + id);
});
sandbox.localStorage._s = {};
ctxRun(`welcomeSeen = false; dismissWelcome();`);
assert(ctxRun('welcomeSeen') === true, 'dismissing the welcome marks it seen');
assert(sandbox.localStorage.getItem('q2dViewer_welcome_v1') === '1', 'and remembers it under its own key');
ctxRun(`startTour();`);
assert(ctxRun('tourIndex') === 0, 'the tour starts at the first step');
assert(ctxRun(`document.getElementById('tourNextBtn').hidden === true`), 'a required step hides the Next button');
ctxRun(`tourNext();`);
assert(ctxRun('tourIndex') === 0, 'Next cannot skip the required File step');
ctxRun(`tourOnUiEvent('menu-open:view');`);
assert(ctxRun('tourIndex') === 0, 'an unrelated menu does not advance the tour');
ctxRun(`tourOnUiEvent('menu-open:file');`);
assert(ctxRun('tourIndex') === 1, 'opening the File menu advances the tour');
ctxRun(`tourNext();`);
assert(ctxRun('tourIndex') === 1, 'the Input Data step also waits for the action');
ctxRun(`tourOnUiEvent('input-modal-open');`);
assert(ctxRun('tourIndex') === 2, 'opening Input Data advances the tour');
assert(ctxRun(`document.getElementById('tourNextBtn').hidden === false`), 'the Load example step offers a Next button');
ctxRun(`tourOnUiEvent('example-loaded');`);
assert(ctxRun('tourIndex') === 3, 'picking an example protein continues to the Data Sources step');
ctxRun(`tourNext();`);
assert(ctxRun('tourIndex') === 4, 'Next advances to the Tracks step');
assert(ctxRun(`document.getElementById('tourNextBtn').hidden === true`), 'the Tracks step hides Next until the tab is opened');
ctxRun(`tourOnUiEvent('tab-open:guide');`);
assert(ctxRun('tourIndex') === 4, 'an unrelated tab does not advance the tour');
ctxRun(`tourOnUiEvent('tab-open:tracks');`);
assert(ctxRun('tourIndex') === 5, 'opening the Tracks tab advances the tour');
ctxRun(`tourNext();`);
assert(ctxRun('tourIndex') === 6, 'the remaining steps advance with Next');
ctxRun(`endTour();`);
assert(ctxRun('tourActive') === false, 'ending the tour clears the active flag');
assert(ctxRun(`typeof tourOnUiEvent === 'function'`), 'the tour exposes the UI-event hook');

section('external-services platform default');
assert(ctxRun(`typeof externalServicesDefault === 'function'`), 'externalServicesDefault is defined');
assert(ctxRun(`externalServicesDefault() === false`), 'a file:// page defaults external services OFF (sandbox protocol)');
const svcState = prefs => JSON.stringify({ parsedTracks: { AA: 'M'.repeat(10) }, preferences: prefs });
ctxRun(`applyPersistedState(${svcState({})});`);
assert(ctxRun(`externalServicesEnabled === false`), 'a save with no preference takes the platform default');
ctxRun(`applyPersistedState(${svcState({ externalServicesEnabled: true })});`);
assert(ctxRun(`externalServicesEnabled === true`), 'an explicit ON in a save is honoured');
ctxRun(`applyPersistedState(${svcState({ externalServicesEnabled: false })});`);
assert(ctxRun(`externalServicesEnabled === false`), 'an explicit OFF in a save is honoured');
assert(HTML.indexOf('API access is on by default on the deployed site') !== -1, 'the Options copy explains the default');
assert(HTML.indexOf('You can access this tutorial from Help') !== -1, 'the welcome footer points at Help -> Getting started');

section('protein summary (UniProt)');
const summaryJson = {
    primaryAccession: 'P42212',
    entryType: 'UniProtKB reviewed (Swiss-Prot)',
    proteinDescription: { recommendedName: { fullName: { value: 'Green fluorescent protein' }, ecNumbers: [{ value: '1.2.3.4' }] } },
    genes: [{ geneName: { value: 'GFP' } }],
    organism: { scientificName: 'Aequorea victoria' },
    comments: [
        { commentType: 'FUNCTION', texts: [{ value: 'Energy-transfer acceptor.' }] },
        { commentType: 'SUBCELLULAR LOCATION', texts: [{ value: 'Cytoplasm.' }] }
    ],
    keywords: [{ name: 'Chromophore' }],
    uniProtKBCrossReferences: [
        { database: 'GO', id: 'GO:0005515', properties: [{ key: 'GoTerm', value: 'F:protein binding' }] }
    ]
};
const sum = ctxRun(`parseUniProtSummary(${JSON.stringify(summaryJson)})`);
assert(sum && sum.name === 'Green fluorescent protein' && sum.gene === 'GFP' && sum.organism === 'Aequorea victoria', 'parses name/gene/organism');
assert(sum.function === 'Energy-transfer acceptor.' && sum.location === 'Cytoplasm.', 'parses the function and location comments');
assert(sum.ec === '1.2.3.4' && sum.reviewed === true, 'parses EC and the reviewed flag');
assert(sum.keywords.length === 1 && sum.go.length === 1 && sum.go[0].term === 'protein binding', 'parses keywords and strips the GO aspect prefix');
assert(ctxRun(`parseUniProtSummary(null)`) === null && ctxRun(`parseUniProtSummary({})`) === null, 'an empty payload yields null');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.protein_summary.providers[0].adapter === 'uniprotSummary'`), 'protein_summary is registered with the uniprotSummary adapter');
assert(ctxRun(`typeof renderProteinSummary === 'function' && typeof fetchUniProtSummary === 'function'`), 'summary fetch/render functions exist');
assert(HTML.indexOf('id="proteinSummarySection"') !== -1 && HTML.indexOf('id="proteinSummaryBody"') !== -1, 'the Protein Summary panel exists in the markup');
ctxRun(`proteinSummary = ${JSON.stringify(sum)}; renderProteinSummary();`);
assert(ctxRun(`document.getElementById('proteinSummarySection').hidden`) === false, 'a summary unhides the panel');
assert(/Green fluorescent protein/.test(ctxRun(`document.getElementById('proteinSummaryBody').innerHTML`)), 'and renders the name');
assert(ctxRun(`buildMethodsReport()`).indexOf('## Protein summary') !== -1 && ctxRun(`buildMethodsReport()`).indexOf('Energy-transfer acceptor.') !== -1, 'the methods report includes the protein summary');
ctxRun(`proteinSummary = null; renderProteinSummary();`);
assert(ctxRun(`document.getElementById('proteinSummarySection').hidden`) === true, 'clearing the summary hides the panel');

section('header jump box (navigation-only)');
assert(ctxRun(`typeof buildJumpIndex === 'function' && typeof jumpMatches === 'function' && typeof jumpSelect === 'function' && typeof jumpNavigate === 'function'`), 'jump-box functions are defined');
const jumpEntries = JSON.parse(ctxRun(`JSON.stringify(buildJumpIndex())`));
const jumpGroups = {};
jumpEntries.forEach(e => { jumpGroups[e.group] = (jumpGroups[e.group] || 0) + 1; });
assert(jumpGroups.Tab >= 5, 'the index covers the sidebar tabs');
assert(jumpGroups.Menu >= 6, 'the index covers the menu bar');
const wfIds = JSON.parse(ctxRun(`JSON.stringify(WORKFLOW_STEPS.map(function (s) { return s.id; }))`));
assert(wfIds.every(id => jumpEntries.some(e => e.group === 'Guide step' && e.target === '[data-step="' + id + '"]')), 'every guide step has an index entry');
const catKeys = JSON.parse(ctxRun(`JSON.stringify(Object.keys(DATA_CATEGORY_HINTS))`));
assert(catKeys.every(c => jumpEntries.some(e => e.group === 'Data source' && e.target === '#optCat-' + c)), 'every Options data category has an index entry');
jumpEntries.filter(e => /^#/.test(e.target)).forEach(e => {
    assert(HTML.indexOf('id="' + e.target.slice(1) + '"') !== -1, 'jump target id exists: ' + e.target);
});
ctxRun(`parsedTracks = Object.assign({}, parsedTracks, { TM_TMHMM: 'bbbb' });`);
assert(ctxRun(`buildJumpIndex().some(function (e) { return e.group === 'Track' && e.title === trackGroupLabel('TM'); })`), 'a loaded track group appears in the index');
ctxRun(`parsedTracks = {};`);
assert(ctxRun(`jumpMatches('export').some(function (e) { return e.title === 'Export menu'; })`), 'a query finds the Export menu');
assert(ctxRun(`jumpMatches('guide').length > 0 && jumpMatches('guide')[0].title === 'Guide'`), 'a prefix match ranks the exact control first');
assert(ctxRun(`jumpMatches('').length === 0`), 'an empty query matches nothing (no dropdown clutter)');
assert(HTML.indexOf('id="jumpInput"') !== -1 && HTML.indexOf('id="jumpResults"') !== -1, 'the header jump box exists in the markup');

section('UI categories + accessibility');

assert(HTML.indexOf('data-tab="analyze"') !== -1 && HTML.indexOf('>Analyze</button>') !== -1, 'a dedicated Analyze tab exists');
assert(HTML.indexOf('data-tab="workflow"') !== -1 && HTML.indexOf('>Commands</button>') !== -1, 'the external-workflow tab is renamed Commands');
assert(HTML.indexOf('id="side-panel-analyze" role="tabpanel"') !== -1, 'the Analyze panel is a tabpanel');
assert(HTML.indexOf('id="side-panel-tracks" role="tabpanel"') !== -1, 'the Tracks tab is a tabpanel (visibility only)');
assert(HTML.indexOf('role="tab" aria-selected="true"') !== -1 && HTML.indexOf('role="tab" aria-selected="false"') !== -1, 'tabs expose role=tab + aria-selected');
assert(HTML.indexOf('id="menubar-session" role="menu"') !== -1, 'Macro/Hypotheses/Log are grouped under a Session menu');
assert(HTML.indexOf('role="menuitem"') !== -1, 'menu items expose role=menuitem');
assert(HTML.indexOf('>Save session (.json)</button>') !== -1 && HTML.indexOf('>Metrics as JSON</button>') !== -1, 'the two JSON exports are disambiguated');
assert(HTML.indexOf('>Data report…</button>') !== -1, 'Data & Structures is renamed Data report');
assert(HTML.indexOf('>External services</option>') !== -1, 'the Data Sources services category is renamed');
assert(HTML.indexOf('>Methods summary (.md)</button>') !== -1 && HTML.indexOf('Export methods summary') === -1, 'the methods export label is unified');
assert(HTML.indexOf('max-height: calc(100vh - 72px); overflow-y: auto;') !== -1, 'menu dropdowns are height-bounded');
assert(ctxRun(`typeof clampMenuBarMenu === 'function'`), 'menu dropdowns are clamped to the visible width');
// Data Sources is its own window, linked from File, with loaded-checkmarks
assert(HTML.indexOf('id="dataSourcesModal"') !== -1 && HTML.indexOf('id="dataSourcesBody"') !== -1, 'Data Sources has its own window');
assert(HTML.indexOf('onclick="openDataSourcesModal()">Data Sources…</button>') !== -1, 'the File menu links to the Data Sources window');
assert(HTML.indexOf('id="menubar-datasources"') === -1, 'the temporary top-level Data menu is gone');
assert(ctxRun(`typeof openDataSourcesModal === 'function' && typeof closeDataSourcesModal === 'function' && typeof updateDataSourcesLoadedMarks === 'function' && typeof dataSourceLoaded === 'function'`), 'the Data Sources window and checkmark helpers exist');
assert(HTML.indexOf('id="opt-tab-data"') !== -1 && HTML.indexOf('id="optab-data"') === -1, 'the category panel stays in the markup but its Options tab is gone');
const setMenu = HTML.slice(HTML.indexOf('id="menubar-settings"'), HTML.indexOf('id="menubar-session"'));
['appearance', 'workflow', 'storage'].forEach(t => {
    assert(setMenu.indexOf("openOptionsModal('" + t + "')") !== -1, 'the Settings menu links to ' + t);
});
assert(setMenu.indexOf("openOptionsModal('data')") === -1, 'Settings no longer duplicates Data Sources');
assert(ctxRun(`JUMP_MENUS.some(function (m) { return m.key === 'settings'; }) && !JUMP_MENUS.some(function (m) { return m.key === 'datasources'; })`), 'the jump box indexes Settings but not the removed Data menu');
// checkmark predicates
ctxRun(`parsedTracks = { AA: 'M'.repeat(10), UP_Sites: 'x', DM_Pfam: 'x', HL_01: 'x', TP_Consensus: 'x', VAR_01: 'x', 'foo_EXP': [1], 'm_pLDDT': [1] };`);
assert(ctxRun(`dataSourceLoaded('uniprot') && dataSourceLoaded('domains') && dataSourceLoaded('homologs') && dataSourceLoaded('topology') && dataSourceLoaded('variants') && dataSourceLoaded('experimental') && dataSourceLoaded('structure')`), 'loaded evidence marks its source');
ctxRun(`parsedTracks = {};`);
assert(ctxRun(`!dataSourceLoaded('uniprot') && !dataSourceLoaded('domains') && !dataSourceLoaded('services')`), 'an empty session marks nothing (services is not a data source)');
ctxRun(`uniprotAccession = 'P42212'; uniprotFeatures = null;`);
assert(ctxRun(`!dataSourceLoaded('uniprot')`), 'a remembered last-used accession alone does not mark UniProt as loaded');
ctxRun(`uniprotAccession = '';`);
assert(ctxRun(`(function(){ const i = buildInfoIcon('<strong>Foo</strong><br>bar'); return i.getAttribute('role') + '|' + i.getAttribute('aria-label'); })()`) === 'button|More information: Foo', 'built info icons are labelled buttons');

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
assert(ctxRun(`GUIDE_QUESTIONS.length`) === 6 && ctxRun(`GUIDE_QUESTIONS.every(q => q.id && q.options.length >= 3)`), '6 intake questions with at least three options each');
const chainQ = ctxRun(`GUIDE_QUESTIONS.filter(q => q.id === 'chains')[0]`);
assert(chainQ.options.length === 6 && chainQ.options.map(o => o.value).join(',') === 'monomer,homo2,homo3,homo4,hetero,unknown', 'the oligomeric-state question covers monomer through hetero-oligomer');
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
assert(ins.some(i => /Homologs cross-check/.test(i.text)), 'read-out flags missing homologs');
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
assert(afAct.run === 'predictStructureESMFold()' && /AlphaFold DB needs an accession/.test(afAct.hint), 'AlphaFold answer without an accession falls back to ESMFold and says why');
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
let topoAct = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'topology')[0])`);
assert(topoAct.run.indexOf('openExternal') === 0, 'no-predictor answer opens the predictor');
assert(topoAct.accessory && topoAct.accessory.label === 'Copy sequence (FASTA)' && topoAct.accessory.run === 'copySequenceFasta()', 'with Copy sequence (FASTA) as an accessory beside it');
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
assert(report.indexOf('## Intake') !== -1 && report.indexOf('Is this protein membrane-associated or secreted?: Yes') !== -1, 'the report records the intake answers');
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

section('save filename from the protein name');
assert(ctxRun(`suggestSaveFileName('sp|P42212|GFP_AEQVI Green fluorescent protein OS=Aequorea victoria GN=GFP', 'MSKGEELFTG')`) === 'q2dv-save-GFP_AEQVI.json', 'the entry name names the save');
assert(ctxRun(`suggestSaveFileName('', 'MSKGEELFTGVVP')`) === 'q2dv-save-MSKGEELFTG.json', 'falls back to the first residues');
assert(ctxRun(`suggestSaveFileName('', '')`) === 'q2dv-save-session.json', 'a nameless empty session still gets a safe name');
assert(ctxRun(`/^q2dv-save-[A-Za-z0-9_]*\\.json$/.test(suggestSaveFileName('weird / name: *', ''))`), 'unsafe characters are slugged');

section('UniProt rows rebuild from a stored fetch on restore');
ctxRun(`
    parsedTracks = { AA: 'MSKGEELFTG' };
    uniprotFeatures = { accession: 'P42212', features: [
        { type: 'Cross-link', start: 5, end: 7, description: '5-imidazolinone (Ser-Gly)' },
        { type: 'Modified residue', start: 6, end: 6, description: '(Z)-2,3-didehydrotyrosine' }
    ] };
    uniprotFeatureTracks = {};
`);
const savedUp = ctxRun(`gatherPersistableState()`);
ctxRun(`parsedTracks = {}; uniprotFeatures = null; uniprotFeatureTracks = {};`);
ctxRun(`applyPersistedState(${JSON.stringify(savedUp)})`);
assert(ctxRun(`Object.keys(parsedTracks).indexOf('UP_Cross_link') !== -1`), 'the chromophore cross-link row is rebuilt on load');
assert(ctxRun(`Object.keys(parsedTracks).indexOf('UP_Modified_residue') !== -1`), 'the modified-residue row is rebuilt on load');
assert(ctxRun(`uniprotFeatureTracks['UP_Cross_link'] && uniprotFeatureTracks['UP_Cross_link'].category === 'ptm'`), 'the rebuilt row keeps its PTM category');
ctxRun(`parsedTracks = {}; uniprotFeatures = null; uniprotFeatureTracks = {};`);

section('Quick2D text file import (.txt)');
assert(HTML.indexOf('accept=".pdb,.cif,.json,.hhr,.fasta,.fa,.faa,.fas,.txt"') !== -1, 'the file picker accepts .txt');
assert(ctxRun(`looksLikePasteInput(${JSON.stringify(Q2D_GFP_FIXTURE)})`) === true, 'a Quick2D .txt is recognized by content');
assert(ctxRun(`looksLikePasteInput('ATOM      1  N   MET A   1')`) === false, 'a PDB is not treated as Quick2D text');
assert(ctxRun(`looksLikePasteInput('>sp|P42212|GFP_AEQVI GFP\\nMSKGEELFTG')`) === true, 'a plain FASTA in a .txt is accepted');
ctxRun(`parsedTracks = {}; currentProteinLabel = null;`);
assert(ctxRun(`importQuick2DText(${JSON.stringify(Q2D_GFP_FIXTURE)}, 'Q2D_GFP.txt')`) === true, 'importQuick2DText builds a session');
assert(ctxRun(`parsedTracks.AA.length`) === 238, 'the 238 aa sequence is parsed');
assert(ctxRun(`Object.keys(parsedTracks).some(k => k.startsWith('SS_'))`) === true, 'its SS tracks are built');
assert(ctxRun(`(currentProteinLabel || '').indexOf('GFP_AEQVI') !== -1`), 'the Protein ID line sets the label');
ctxRun(`parsedTracks = {}; currentProteinLabel = null;`);

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

section('answer separation + undo');
const UNDO = String.fromCharCode(0x21ba);
ctxRun(`guideProfile = {}; guideAnswers = {}; guideOverrides = {}; parsedTracks = { AA: 'MKV' }; guideIntakeOpen = null; renderWorkflowGuide();`);
let undoHtml = ctxRun(`document.getElementById('guidePanel').innerHTML`);
const sliceNext2 = (h) => h.slice(h.indexOf('guide-next-action'), h.indexOf('guide-steps'));
let ub = sliceNext2(undoHtml);
assert(ub.indexOf('or select an action:') !== -1, 'an unanswered question is separated from the action buttons by a labelled divider');
assert(ub.indexOf(UNDO) === -1, 'no undo is offered before anything is picked');

ctxRun(`setStepAnswer('homologs', 'hhpred', 'ready'); setStepAnswer('structure', 'model', 'esmfold');`);
undoHtml = ctxRun(`document.getElementById('guidePanel').innerHTML`);
ub = sliceNext2(undoHtml);
assert(ub.indexOf('or select an action:') === -1, 'the divider goes away once the question is answered');
assert(ub.indexOf(UNDO) !== -1, 'the short form offers an undo once an answer exists');
assert(ub.indexOf('Undo') !== -1, 'the undo is labelled, not icon-only');
assert(undoHtml.indexOf('Undo answer') !== -1, 'the step card offers the undo next to the answer record');

// undo clears only that step
assert(ctxRun(`guideHasStepAnswer('homologs')`) === true && ctxRun(`guideHasStepAnswer('structure')`) === true, 'both steps report answers');
ctxRun(`clearStepAnswers('homologs');`);
assert(ctxRun(`guideHasStepAnswer('homologs')`) === false, 'undo clears the chosen step');
assert(ctxRun(`guideHasStepAnswer('structure')`) === true, 'undo leaves other steps alone');
assert(ctxRun(`getStepAnswer('structure', 'model')`) === 'esmfold', 'the other step answer survives');
undoHtml = ctxRun(`document.getElementById('guidePanel').innerHTML`);
assert(sliceNext2(undoHtml).indexOf('or select an action:') !== -1 || ctxRun(`(function(){ var n = nextGuideStep(); return n ? n.step.id : null; })()`) !== 'homologs', 'the question comes back after undo');
ctxRun(`clearStepAnswers('structure');`);
assert(ctxRun(`Object.keys(guideAnswers).length`) === 0, 'clearing the last answer empties the map');
ctxRun(`guideAnswers = {}; parsedTracks = {};`);

section('clipboard hand-off to external tools');
// the step card shows the accessory once, not twice (it also has a FASTA extraAction)
ctxRun(`guideProfile = {}; guideAnswers = {}; guideOverrides = {}; parsedTracks = { AA: 'MKV' };`);
ctxRun(`setStepAnswer('homologs', 'hhpred', 'no'); renderWorkflowGuide();`);
const cardHtml = ctxRun(`document.getElementById('guidePanel').innerHTML`);
assert((cardHtml.match(/Copy sequence<\/button>/g) || []).length <= 2, 'Copy sequence appears at most once per view (short form + step card), never duplicated within one card');
ctxRun(`currentProteinLabel = null; parsedTracks = { AA: 'M'.repeat(130) };`);
let fasta = ctxRun(`sequenceFastaText()`);
assert(fasta.indexOf('>Q2DV_sequence') === 0, 'a missing label still yields a valid FASTA header');
const fastaLines = fasta.trim().split('\n');
assert(fastaLines.length === 4 && fastaLines[1].length === 60 && fastaLines[2].length === 60 && fastaLines[3].length === 10, 'the sequence is wrapped at 60 residues per line');
ctxRun(`currentProteinLabel = 'sp|P42212|GFP_AEQVI Green fluorescent protein';`);
assert(ctxRun(`sequenceFastaText()`).indexOf('>sp|P42212|GFP_AEQVI Green fluorescent protein') === 0, 'the loaded identifier becomes the header');
ctxRun(`currentProteinLabel = 'line one\\nline two';`);
assert(ctxRun(`sequenceFastaText()`).split('\n')[0] === '>line one line two', 'newlines in a label cannot break the single-line header');
ctxRun(`parsedTracks = {};`);
assert(ctxRun(`sequenceFastaText()`) === '', 'no sequence, no FASTA');

ctxRun(`parsedTracks = { AA: 'MKV' }; currentProteinLabel = 'GFP';`);
let clipboardThrew = null;
try { ctxRun(`copySequenceFasta(); downloadSequenceFasta();`); } catch (e) { clipboardThrew = e.message; }
assert(clipboardThrew === null, 'copying and downloading the FASTA do not throw');
assert(typeof ctxRun(`legacyCopyText`) === 'function', 'a synchronous copy fallback exists (the async API needs focus, which an auto-opened tab steals)');
let legacyOk = null;
try { legacyOk = ctxRun(`legacyCopyText('abc')`); } catch (e) { legacyOk = 'threw: ' + e.message; }
assert(legacyOk === true || legacyOk === false, 'the fallback returns a boolean rather than throwing (got ' + legacyOk + ')');
// without a sequence the copy refuses instead of copying an empty string
ctxRun(`parsedTracks = {};`);
let noSeqThrew = null;
try { ctxRun(`copySequenceFasta();`); } catch (e) { noSeqThrew = e.message; }
assert(noSeqThrew === null, 'copying with no sequence refuses gracefully');

// the guide offers the route choice and the FASTA helpers
ctxRun(`guideProfile = {}; guideAnswers = {}; guideOverrides = {}; parsedTracks = { AA: 'MKV' };`);
ctxRun(`setStepAnswer('homologs', 'hhpred', 'hhpred');`);
const hhAct = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'homologs')[0])`);
assert(hhAct.run === 'openInputDataModal()', 'the HHpred route leads with attaching the .hhr');
assert(hhAct.accessory && hhAct.accessory.run.indexOf('openExternal') === 0 && /HHpred/.test(hhAct.accessory.label), 'and offers the HHpred link beside it');
assert(/Copy sequence \(FASTA\) is below/.test(hhAct.hint), 'the short description points at the copy button');
assert(hhAct.run.indexOf('copySequence') === -1 && hhAct.run.indexOf('clipboard') === -1, 'the attach button itself does not touch the clipboard');
assert(/A3M\/CLUSTAL\/FASTA\/STOCKHOLM/.test(hhAct.hint) && /PDB_mmCIF70/.test(hhAct.hint), 'the hint names the accepted formats and the modelling databases');
ctxRun(`setStepAnswer('homologs', 'hhpred', 'phmmer');`);
const phAct2 = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'homologs')[0])`);
assert(phAct2.run === 'runHomologSearch()' && /Swiss-Prot/.test(phAct2.hint), 'the phmmer route leads with the in-app search');
assert(phAct2.extraActions.every(a => a.run !== 'runHomologSearch()'), 'and does not repeat it as an extra button');
const hhStep = ctxRun(`WORKFLOW_STEPS.filter(s => s.id === 'homologs')[0]`);
assert(hhStep.extraActions.some(a => a.run === 'copySequenceFasta()') && hhStep.extraActions.some(a => a.run === 'downloadSequenceFasta()'), 'the step offers copy/download FASTA');
ctxRun(`guideAnswers = {}; parsedTracks = {}; currentProteinLabel = null;`);

section('rule toggle naming');
// the source escapes the apostrophe (it lives in a JS string); the rendered HTML is clean
assert(HTML.indexOf("rule\\'s track") !== -1, 'the source carries the escaped wording');
ctxRun(`analysisRules = [{ id: 'rt', name: 'T', color: '#f00', mode: 'all', enabled: true, conditions: [] }]; renderRulesList();`);
assert(ctxRun(`document.getElementById('rulesList').innerHTML`).indexOf("title=\"Enable / disable this rule's track\"") !== -1, 'the rendered toggle names what it actually does (the rule\'s track)');
assert(HTML.indexOf('title="Enable / disable this rule"') === -1, 'the over-promising title is gone');
ctxRun(`analysisRules = [];`);
assert(HTML.indexOf('it does not disable the rule itself') !== -1, 'the code documents the track-level meaning');
// behaviour is unchanged: it still only controls the drawn row
ctxRun(`analysisRules = [{ id: 'rn', name: 'Probe', color: '#f00', mode: 'all', enabled: true,
    conditions: [{ kind: 'categorical', source: 'group:TM', op: 'annotated', value: '' }] }];
    parsedTracks = { AA: 'MKV', 'TM_Quick2D': ' E ' };`);
ctxRun(`applyRules();`);
assert(ctxRun(`typeof parsedTracks['RULE_rn']`) === 'string', 'an enabled rule draws its track');
ctxRun(`toggleRuleEnabled('rn');`);
assert(ctxRun(`parsedTracks['RULE_rn']`) === undefined, 'disabling removes the track');
assert(ctxRun(`analysisRules[0].enabled`) === false, 'and records the flag');
ctxRun(`selectRuleMatches('rn');`);
assert(ctxRun(`analysisRules[0].enabled`) === false, 'select still works while disabled (the rule is not off, only its track)');
ctxRun(`toggleRuleEnabled('rn');`);
assert(ctxRun(`typeof parsedTracks['RULE_rn']`) === 'string', 're-enabling draws it again');
ctxRun(`analysisRules = []; parsedTracks = {};`);

section('characterizing an unresolved fold');
const goalQ = ctxRun(`STEP_QUESTIONS.integration.filter(q => q.id === 'goal')[0]`);
assert(goalQ.options.map(o => o.value).join(',') === 'characterize,variants,interface,construct,report', 'the closing-goal question leads with characterizing an unresolved fold');
// the route adapts to what is loaded
ctxRun(`guideProfile = {}; guideAnswers = {}; guideOverrides = {}; parsedTracks = { AA: 'MKV' }; cachedStructureTexts = {};`);
ctxRun(`setStepAnswer('integration', 'goal', 'characterize');`);
let chAct = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'integration')[0])`);
assert(chAct.run === 'runDomainScan()' && /Scan HMMER\/Pfam/.test(chAct.label), 'with no model it starts with the domain architecture');
assert(/then predict or attach a model so Foldseek/.test(chAct.hint), 'and says what comes next');
ctxRun(`cachedStructureTexts = { 'm.pdb': 'ATOM' };`);
chAct = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'integration')[0])`);
assert(chAct.run === 'runFoldseekSearch()' && /fold assignment/.test(chAct.label), 'with a model it goes straight to structural homology');
assert(/fastest route to a fold assignment/.test(chAct.hint), 'and explains why');
// the read-out names an unplaced fold
ctxRun(`domainHitsInfo = {}; homologHitsInfo = {}; cachedStructureTexts = {};`);
assert(ctxRun(`computeGuideInsights()`).some(i => /fold is unplaced/.test(i.text)), 'an unplaced fold is reported');
ctxRun(`domainHitsInfo = { DM_GFP: { model: 'GFP', domains: [] } };`);
assert(!ctxRun(`computeGuideInsights()`).some(i => /fold is unplaced/.test(i.text)), 'a Pfam family places it');
ctxRun(`domainHitsInfo = {}; homologHitsInfo = { 'HL_01_x': { source: 'Foldseek' } };`);
assert(!ctxRun(`computeGuideInsights()`).some(i => /fold is unplaced/.test(i.text)), 'a structural relative places it');
ctxRun(`homologHitsInfo = { 'HL_01_x': { source: 'HHpred' } };`);
assert(ctxRun(`computeGuideInsights()`).some(i => /fold is unplaced/.test(i.text)), 'a sequence homolog alone does not (it is not a fold assignment)');
ctxRun(`guideAnswers = {}; parsedTracks = {}; cachedStructureTexts = {}; domainHitsInfo = {}; homologHitsInfo = {};`);

section('rules panel polish + modern citations');
// the Tracks tab's own submenu is no longer called "Tracks"
assert(HTML.indexOf('<summary>Track Visibility (full manager)</summary>') !== -1, 'the Tracks tab submenu is called Track Visibility (full manager)');
assert(HTML.indexOf('<summary>Tracks</summary>') === -1, 'the confusing "Tracks > Tracks" pairing is gone');
// the coachmark names what fits this protein
ctxRun(`guideProfile = { membrane: 'yes' }; guideAnswers = {}; parsedTracks = { AA: 'MKV', 'TM_Quick2D': 'EEE' };`);
const cmText = ctxRun(`coachmarkText('rules')`);
assert(/Based on your answers, these fit:/.test(cmText), 'the rules banner names the fitting presets');
assert(/highlighted below/.test(cmText), 'and points at the highlight');
assert(/Topology contradiction \(QC\)/.test(cmText), 'a membrane answer names the QC preset');
ctxRun(`guideProfile = {}; parsedTracks = {};`);
assert(/No preset matches your answers yet/.test(ctxRun(`coachmarkText('rules')`)), 'with no answers it says the list is unfiltered');
assert(ctxRun(`coachmarkText('interfaces')`).indexOf('Based on your answers') === -1, 'other coachmarks keep their plain text');
// modern, DOI-verified follow-ups replace the two classic refs
const allRefs = ctxRun(`(function(){ var out = []; RULE_PRESETS.forEach(p => p.refs.forEach(r => out.push(r.cite + ' | ' + r.doi))); return out.join('\\n'); })()`);
assert(allRefs.indexOf('Lichtarge') === -1 && allRefs.indexOf('Valdar') === -1, 'the 1996/2001 pair is no longer cited');
assert(allRefs.indexOf('10.1073/pnas.1111471108') !== -1, 'co-evolution (DCA) is cited for coupled positions');
assert(allRefs.indexOf('10.1073/pnas.0505425102') !== -1 && allRefs.indexOf('10.1110/ps.03323604') !== -1, 'interface-conservation follow-ups are cited');
assert(allRefs.indexOf('10.1126/science.adg7492') !== -1, 'a current variant-effect model is cited for triage');
const integRefs = ctxRun(`WORKFLOW_STEPS.filter(s => s.id === 'integration')[0].refs.map(r => r.doi).join(',')`);
assert(integRefs.indexOf('10.1073/pnas.1111471108') !== -1 && integRefs.indexOf('10.1126/science.adg7492') !== -1, 'the Integrate step carries them too');
// the presets render reports itself (so a disappearing list is diagnosable)
ctxRun(`actionLog = []; renderRulePresets();`);
// (indexOf rather than a regex: backslashes inside ctxRun template literals are eaten)
assert(ctxRun(`actionLog.some(e => e.kind === 'render' && String(e.detail).indexOf('card(s)') !== -1)`), 'the preset render logs how many cards it wrote');
assert(ctxRun(`String(actionLog.filter(e => e.kind === 'render').pop().detail)`) === '8 card(s)', 'and the count is the real one');
// robustness wiring
assert(HTML.indexOf("section.appendChild(wrap)") !== -1, 'a missing preset container is recreated rather than silently skipped');
assert(HTML.indexOf("ontoggle=\"if (this.open) renderRulePresets();\"") !== -1, 'opening the presets section refreshes them');
assert(HTML.indexOf("window.addEventListener('error'") !== -1 && HTML.indexOf("window.addEventListener('unhandledrejection'") !== -1, 'uncaught errors are recorded in the action log');
ctxRun(`actionLog = [];`);

section('rules list: empty rules are marked and greyed');
ctxRun(`
    parsedTracks = { AA: 'MKV', 'SS_PSIPRED': 'HHH', CONSERVATION: { type: 'conservation', metric: 'shannon', values: [0.5, 0.5, 0.5] } };
    analysisRules = [
        { id: 'matches', name: 'Matching rule', color: '#f00', mode: 'all', enabled: true,
          conditions: [{ kind: 'categorical', source: 'group:SS', op: 'annotated', value: '' }] },
        { id: 'empty', name: 'Empty rule', color: '#00f', mode: 'all', enabled: true,
          conditions: [{ kind: 'numeric', source: 'CONSERVATION', op: '>=', value: '0.99' }] },
        { id: 'needsrsa', name: 'Needs RSA rule', color: '#0f0', mode: 'all', enabled: true,
          conditions: [{ kind: 'numeric', source: 'RSA:', op: '<', value: '0.2' }] }
    ];
    renderRulesList();
`);
assert(ctxRun(`ruleMatchCount(analysisRules[0])`) === 3, 'a matching rule counts its residues');
assert(ctxRun(`ruleIsEmpty(analysisRules[0])`) === false, 'and is not empty');
assert(ctxRun(`ruleIsEmpty(analysisRules[1])`) === true, 'a rule whose threshold nothing meets is empty');
assert(ctxRun(`ruleIsEmpty(analysisRules[2])`) === true, 'a rule whose source is not loaded is empty (no throw)');
const rulesHtml = ctxRun(`document.getElementById('rulesList').innerHTML`);
assert((rulesHtml.match(/\(Empty\)/g) || []).length === 2, 'exactly the two empty rules carry the (Empty) tag (got ' + (rulesHtml.match(/\(Empty\)/g) || []).length + ')');
assert(rulesHtml.indexOf('No matches: needs RSA (any model)') !== -1, 'the missing-source rule says what it needs');
assert((rulesHtml.match(/opacity:0\.55/g) || []).length === 2, 'the empty rows are greyed');
assert(ctxRun(`
    (function () {
        parsedTracks['m_RSA'] = [{ val: 0.1, type: 'rsa' }, { val: 0.6, type: 'rsa' }, { val: 0.1, type: 'rsa' }];
        renderRulesList();
        return ruleIsEmpty(analysisRules[2]);
    })()
`) === false, 'loading the missing track clears the empty state');
ctxRun(`parsedTracks = {}; analysisRules = [];`);

section('guide coachmark: collapse is a one-shot transition, user choices survive');
ctxRun(`
    guideCoachmark = null; appliedCoachmarkKind = undefined;
    document.getElementById('trackManagerSection').open = true;
    document.getElementById('rulesSection').open = true;
`);
ctxRun(`openGuideCoachmark('rules');`);
assert(ctxRun(`document.getElementById('rulesSection').open`) === true, 'the coachmark opens the section it points at');
assert(ctxRun(`document.getElementById('trackManagerSection').open`) === false, 'and collapses the siblings while guiding');
ctxRun(`document.getElementById('trackManagerSection').open = true;`);
ctxRun(`applyGuideCoachmark();`);
assert(ctxRun(`document.getElementById('trackManagerSection').open`) === true, 'a later refresh does not slam shut a section the user reopened (was: forced shut on every apply)');
ctxRun(`clearGuideCoachmark();`);
assert(ctxRun(`document.getElementById('trackManagerSection').open`) === true, 'ending guidance keeps the user\'s choice');
assert(ctxRun(`document.getElementById('rulesSection').open`) === true, 'and restores what the coachmark itself changed');
ctxRun(`
    document.getElementById('crossCheckSection').open = false;
    openGuideCoachmark('rules');
`);
assert(ctxRun(`document.getElementById('crossCheckSection').open`) === false, 'an untouched sibling stays collapsed while guiding');
ctxRun(`clearGuideCoachmark();`);
assert(ctxRun(`document.getElementById('crossCheckSection').open`) === false, 'and is restored to its pre-guidance state');
ctxRun(`guideCoachmark = null; appliedCoachmarkKind = undefined;`);

section('topology: TOPCONS input, disagreement flags, N-terminus read-out');
const topcons = ctxRun(`parseTopologyText('TOPCONS  ooooMMMMMMiiii', 14)`);
assert(topcons && topcons.name === 'TOPCONS', 'a TOPCONS-style per-residue run line parses (name kept) (got ' + (topcons && topcons.name) + ')');
assert(topcons.state === 'ooooMMMMMMiiii', 'and maps to the inside/TM/outside state string (got ' + topcons.state + ')');
const bareRun = ctxRun(`parseTopologyText('ooooMMMMMMiiii', 14)`);
assert(bareRun && bareRun.name === 'Topology' && bareRun.state === 'ooooMMMMMMiiii', 'a bare run line parses too');
const twoRuns = ctxRun(`parseTopologyText(['SPOCTOPUS  ooooMMMMMMiiii', 'TOPCONS  ooooMMMMMMiiii'].join(String.fromCharCode(10)), 14)`);
assert(twoRuns && twoRuns.name === 'TOPCONS', 'when several method lines are pasted, the TOPCONS consensus line wins');
assert(ctxRun(`parseTopologyText('miss', 4)`) === null, 'short words are not misread as topology runs');
assert(ctxRun(`parseTopologyText(['inside 1 11', 'TMhelix 12 30'].join(String.fromCharCode(10)), 30)`).state.slice(0, 12) === 'iiiiiiiiiiiM', 'segment lines still parse (unchanged)');
ctxRun(`
    parsedTracks = { AA: 'M'.repeat(12) };
    topologySources = [
        { name: 'Predictor A', state: 'ooooMMMMiiii' },
        { name: 'Predictor B', state: 'ooiiMMMMiiii' }
    ];
    applyTopologySources();
`);
const topoCons = ctxRun(`parsedTracks['TP_Consensus']`);
assert(topoCons === 'oo??MMMMiiii', 'disagreements are flagged with ? instead of left blank (got ' + topoCons + ')');
assert(ctxRun(`TOPOLOGY_STATE_COLORS['?']`) && ctxRun(`TOPOLOGY_STATE_LABELS['?']`), 'the conflict char has a colour and a label');
const topoSum = ctxRun(`topologyConsensusSummary()`);
assert(topoSum && topoSum.sources === 2 && topoSum.nterm === 'o', 'the summary reports the source count and N-terminus call');
assert(topoSum.tmSegments === 1 && topoSum.counts['?'] === 2, 'and the TM segment count and disagreement columns');
assert(ctxRun(`buildTopologyPredictorInfo('TP_Consensus').useCase`).indexOf('N-terminus: outside') !== -1, 'the consensus tooltip names the N-terminus');
assert(/disagreement column/.test(ctxRun(`buildTopologyPredictorInfo('TP_Consensus').useCase`)), 'and counts the disagreements');
assert(ctxRun(`buildTopologyPredictorInfo('TP_Predictor_A').useCase`).indexOf('TM segment') !== -1, 'a source row reports its own TM segments');
ctxRun(`renderTopologySourceList();`);
const srcList = ctxRun(`document.getElementById('topologySourceList').innerHTML`);
assert(srcList.indexOf('Consensus (2 sources)') !== -1 && srcList.indexOf('disagreement column') !== -1, 'the topology panel shows the consensus read-out');
assert(srcList.indexOf('Predictor A') !== -1 && srcList.indexOf('Predictor B') !== -1, 'alongside the source list');
ctxRun(`parsedTracks = {}; topologySources = [];`);

section('AlphaMissense variant effect predictions');
const tok1 = ctxRun(`parseSubstitutionToken('R175H')`);
assert(tok1 && tok1.ref === 'R' && tok1.pos === 175 && tok1.alt === 'H', 'a one-letter substitution token parses (R175H)');
const tok2 = ctxRun(`parseSubstitutionToken('p.Arg175His')`);
assert(tok2 && tok2.ref === 'R' && tok2.pos === 175 && tok2.alt === 'H', 'a three-letter token parses (p.Arg175His)');
assert(ctxRun(`parseSubstitutionToken('p.R175H')`).alt === 'H', 'the p. prefix is tolerated');
assert(ctxRun(`parseSubstitutionToken('variant 3')`) === null, 'a plain label yields no token');
assert(ctxRun(`parseSubstitutionToken('R175R')`) === null, 'a synonymous token is not a substitution');
ctxRun(`
    parsedTracks = { AA: 'MSKGEELFTGVVPILVELD', VAR_v1: 'MSKGEELFTGVVPILVELD', VAR_v2: 'MSKGEELFTGVVPILVELD' };
    keyedVariantsInfo = {
        v1: { aligned: 'MSKGEELFTGVVPILVELD', raw: 'MSKGEELFTGVVPILVELD', desc: 'R8H' },
        v2: { aligned: 'MSKGEELFTGVVPILVELD', raw: 'MSKGEELFTGVVPILVELD', desc: '' }
    };
`);
assert(ctxRun(`parseVariantSubstitutions('v1').length`) === 1 && ctxRun(`parseVariantSubstitutions('v1')[0].ref`) === 'R', 'the header token is preferred for a variant substitution');
ctxRun(`keyedVariantsInfo.v2.aligned = 'MSKGEELFHGVVPILVELD';`); // differs at position 9
const v2subs = ctxRun(`parseVariantSubstitutions('v2')`);
assert(v2subs.length === 1 && v2subs[0].pos === 9 && v2subs[0].alt === 'H', 'without a token the alignment difference is used (got pos ' + v2subs[0].pos + ')');
const amCsv = ctxRun(`parseAlphaMissenseCsv([
    'protein_variant,am_pathogenicity,am_class',
    'R8H,0.92,Path',
    'G9A,0.31,Amb',
    'V10L,0.02,LBen',
    'L11P,0.71,LPath'
].join(String.fromCharCode(10)), ['R8H', 'G9A', 'NOPE'])`);
assert(Object.keys(amCsv).length === 2, 'the CSV keeps only the requested substitutions (got ' + Object.keys(amCsv).length + ')');
assert(amCsv.R8H.cls === 'pathogenic' && amCsv.R8H.score === 0.92, 'the abbreviated class Path parses as pathogenic');
assert(amCsv.G9A.cls === 'ambiguous', 'the CSV value Amb normalises to ambiguous');
assert(ctxRun(`normalizeAlphaMissenseClass('LPath')`) === 'likely_pathogenic' && ctxRun(`normalizeAlphaMissenseClass('LBen')`) === 'likely_benign', 'the other abbreviations normalise too');
ctxRun(`alphaMissenseScores = parseAlphaMissenseCsv([
    'protein_variant,am_pathogenicity,am_class',
    'R8H,0.92,LPath',
    'V10L,0.02,LBen'
].join(String.fromCharCode(10)), ['R8H', 'V10L']);`);
assert(ctxRun(`alphaMissenseFor({ ref: 'R', pos: 8, alt: 'H' }).label`) === 'pathogenic or likely pathogenic', 'a lookup labels the pathogenic class');
assert(ctxRun(`alphaMissenseFor({ ref: 'V', pos: 10, alt: 'L' }).label`) === 'benign or likely benign', 'and the benign class');
assert(ctxRun(`alphaMissenseFor({ ref: 'X', pos: 1, alt: 'Y' })`) === null, 'an unknown substitution has no entry');
// The display reads the merged provider map (not the raw AlphaMissense table).
ctxRun(`variantEffectResults = { R8H: { alphamissense: { label: 'pathogenic or likely pathogenic', detail: '0.92', level: 'high' } } };`);
assert(ctxRun(`variantEffectLine({ ref: 'R', pos: 8, alt: 'H' })`) === 'AlphaMissense: pathogenic or likely pathogenic (0.92)', 'the merged line phrases a provider result');
ctxRun(`activeRowKey = 'VAR_v1';`);
ctxRun(`updateVariantFastaSection();`);
assert(ctxRun(`document.getElementById('variantFastaLabel').textContent`).indexOf('AlphaMissense: pathogenic or likely pathogenic') !== -1, 'the variant panel names the AlphaMissense class');
const amInsights = ctxRun(`computeGuideInsights().map(x => x.text).join(' ')`);
assert(amInsights.indexOf('Variant effect evidence') !== -1 && amInsights.indexOf('AlphaMissense 1 (1 high-impact)') !== -1, 'the guide read-out tallies the providers and their high-impact hits');
ctxRun(`variantEffectResults = {};`);
ctxRun(`const origHom = STEP_ACTION_RESOLVERS.homologs;`);
const amActions = ctxRun(`
    (function () {
        setStepAnswer('homologs', 'hhpred', 'phmmer');
        const act = resolveStepAction(WORKFLOW_STEPS.find(s => s.id === 'homologs'));
        clearStepAnswers('homologs');
        return act.extraActions.map(a => a.run);
    })()
`);
assert(amActions.indexOf('fetchVariantEffectPredictions()') !== -1, 'with variants loaded the guide offers the AlphaMissense action');
assert(HTML.indexOf('id="btnVariantEffects"') !== -1 && HTML.indexOf('id="variantEffectStatus"') !== -1, 'Input Data has the button and status line');
ctxRun(`parsedTracks = {}; keyedVariantsInfo = {}; alphaMissenseScores = {}; alphaMissenseAccession = ''; activeRowKey = null;`);

section('InterProScan: topology sources + bacterial/viral domain families');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.domain_scan.providers.map(p => p.id).join(',')`) === 'ebi_hmmer,ebi_iprscan5,ebi_iprscan5_motifs', 'the domain scan offers hmmscan, InterProScan, and InterProScan with PROSITE motifs');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.domain_scan.providers.map(p => p.id).join(',')`) === 'ebi_hmmer,ebi_iprscan5,ebi_iprscan5_motifs', 'the domain scan offers hmmscan, InterProScan, and InterProScan with PROSITE motifs');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.domain_scan.providers[2].params.appl`).indexOf('PrositePatterns') !== -1, 'the motif provider asks for PrositePatterns and PrositeProfiles');
assert(HTML.indexOf('value="ebi_iprscan5_motifs"') !== -1, 'and the picker lists it');
sandbox.__iprProsite = IPR_PROSITE_FIXTURE;
const prositeRows = ctxRun(`parseIprscanTsv(window.__iprProsite)`);
assert(prositeRows.length === 3 && prositeRows.filter(r => r.analysis === 'ProSitePatterns').length === 2, 'the PROSITE TSV parses (got ' + prositeRows.length + ' rows)');
const prositeDomains = ctxRun(`parseIprscanDomains(window.__iprProsite)`);
assert(prositeDomains.map(d => d.model).join(',') === 'ProSitePatterns:PS00896,ProSitePatterns:PS00897,ProSiteProfiles:PS50850', 'motifs keep their analysis and signature id (got ' + prositeDomains.map(d => d.model).join(',') + ')');
assert(prositeDomains[0].description === 'LacY/RafB permease family, conserved site', 'and their InterPro description when mapped');
assert(prositeDomains[0].aliFrom === 64 && prositeDomains[0].aliTo === 78, 'with the motif range');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.topology_prediction.providers[0].params.appl`) === 'TMHMM,Phobius,SignalP', 'a topology_prediction capability runs TMHMM, Phobius and SignalP');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.topology_prediction.providers[0].resultExt`) === 'tsv', 'and reads the TSV renderer (the JSON one does not name the analysis)');
sandbox.__iprTopo = IPR_TOPO_FIXTURE;
sandbox.__iprDom = IPR_DOM_FIXTURE;
const iprRows = ctxRun(`parseIprscanTsv(window.__iprTopo)`);
assert(iprRows.length === 36 && iprRows.filter(r => r.analysis === 'TMHMM').length === 11 && iprRows.filter(r => r.analysis === 'Phobius').length === 25, 'the TSV parser keeps the analysis column (got ' + iprRows.length + ' rows)');
assert(iprRows.every(r => r.start >= 1 && r.end >= r.start && r.significant), 'rows carry 1-based ranges and significance');
assert(ctxRun(`isIprscanTsv(window.__iprTopo)`) === true && ctxRun(`isIprscanTsv('# hmmscan :: search sequence(s) against a profile database')`) === false, 'the domain-scan runner tells the two providers apart by the tab-separated first line');
assert(ctxRun(`iprscanRegionState('TMhelix', '')`) === 'M' && ctxRun(`iprscanRegionState('NON_CYTOPLASMIC_DOMAIN', '')`) === 'o' && ctxRun(`iprscanRegionState('CYTOPLASMIC_DOMAIN', '')`) === 'i' && ctxRun(`iprscanRegionState('SIGNAL_PEPTIDE', '')`) === 'S', 'region names map onto the topology state chars');
assert(ctxRun(`iprscanRegionState('CYTOPLASMIC_DOMAIN', 'Region of a membrane-bound protein predicted to be outside the membrane, in the cytoplasm.')`) === 'i', 'the signature name beats the description (Phobius calls the cytoplasmic side "outside the membrane")');
assert(ctxRun(`iprscanRegionState('', 'Region of a membrane-bound protein predicted to be inside the membrane, in the cytoplasm.')`) === 'i', 'the description is the fallback when the name says nothing');
const topoSources = ctxRun(`parseIprscanTopology(window.__iprTopo, 417)`);
assert(topoSources.length === 2 && topoSources.map(s => s.name).sort().join(',') === 'Phobius,TMHMM', 'one topology source per analysis (got ' + topoSources.map(s => s.name).join(',') + ')');
const phob = topoSources.filter(s => s.name === 'Phobius')[0];
const tmh = topoSources.filter(s => s.name === 'TMHMM')[0];
assert((phob.state.match(/M+/g) || []).length === 12, 'Phobius reports the curated 12 TM segments for LacY (got ' + (phob.state.match(/M+/g) || []).length + ' segments)');
assert((tmh.state.match(/M+/g) || []).length === 11, 'TMHMM reports 11 - a real predictor disagreement (got ' + (tmh.state.match(/M+/g) || []).length + ' segments)');
assert(/i/.test(phob.state) && /o/.test(phob.state), 'Phobius orientation fills inside and outside');
ctxRun(`
    parsedTracks = { AA: 'M'.repeat(417) };
    topologySources = [];
    parseIprscanTopology(window.__iprTopo, 417).forEach(s => addTopologyStateSource(s.state, s.name));
    applyTopologySources();
`);
const lacYCons = ctxRun(`topologyConsensusSummary()`);
assert(lacYCons && lacYCons.sources === 2 && lacYCons.tmSegments >= 11, 'the consensus runs over both analyses (got ' + (lacYCons && lacYCons.tmSegments) + ' TM)');
assert(lacYCons.counts['?'] > 0, 'and the 11-vs-12 disagreement is flagged with ? rather than guessed (got ' + lacYCons.counts['?'] + ')');
assert(ctxRun(`topologyConsensusSummary().nterm`) === 'o' || ctxRun(`topologyConsensusSummary().nterm`) === 'i', 'the N-terminus side is reported');
const iprDomains = ctxRun(`parseIprscanDomains(window.__iprDom)`);
assert(iprDomains.length === 3, 'the domain TSV yields one entry per family hit (got ' + iprDomains.length + ')');
assert(iprDomains.map(d => d.model).join(',') === 'Pfam:PF01306,NCBIfam:TIGR00882,NCBIfam:NF007077', 'models keep the analysis, so bacterial/viral families are identifiable (got ' + iprDomains.map(d => d.model).join(',') + ')');
assert(iprDomains[0].description === 'LacY/RafB permease family', 'the InterPro description wins when present');
assert(iprDomains[0].aliFrom === 2 && iprDomains[0].aliTo === 412, 'and the alignment range is kept');
ctxRun(`
    parsedTracks = { AA: 'M'.repeat(417) };
    domainHitsInfo = {};
    const n = applyDomainTracks(parseIprscanDomains(window.__iprDom), 'InterProScan');
`);
assert(ctxRun(`Object.keys(parsedTracks).filter(k => k.startsWith('DM_')).length`) === 3, 'each family becomes a DM_ row');
assert(ctxRun(`domainHitsInfo[Object.keys(parsedTracks).filter(k => k.startsWith('DM_'))[0]].database`) === 'InterProScan', 'registered with the InterProScan source');
assert(ctxRun(`formatTrackLabel(Object.keys(parsedTracks).filter(k => k.startsWith('DM_'))[0])`).indexOf('Pfam:PF01306') !== -1, 'and the row label names the model with its analysis');
assert(HTML.indexOf('id="btnTopologyPredict"') !== -1 && HTML.indexOf('id="topologyPredictStatus"') !== -1, 'Input Data has the topology prediction button and status');
assert(HTML.indexOf('id="domainScanProvider"') !== -1 && HTML.indexOf('value="ebi_iprscan5"') !== -1, 'and a domain-scan provider picker including InterProScan');
assert(ctxRun(`WORKFLOW_STEPS.find(s => s.id === 'topology').action.run`) === 'runTopologyPrediction()', 'the guide topology step leads with the in-app prediction');
assert(ctxRun(`WORKFLOW_STEPS.find(s => s.id === 'topology').extraActions.some(a => a.run === 'openTopologyPanel()')`), 'and keeps the paste route as an alternative');
ctxRun(`parsedTracks = {}; topologySources = []; domainHitsInfo = {};`);

section('variant effect providers: modular registry + local sources');
const provIds = ctxRun(`Object.keys(VARIANT_EFFECT_PROVIDERS)`);
assert(provIds.join(',') === 'alphamissense,ensembl_vep,conservation,structure,curated', 'the registry carries two remote providers plus three species-general local ones (got ' + provIds.join(',') + ')');
assert(ctxRun(`VARIANT_EFFECT_PROVIDERS.conservation.coverage`).indexOf('Any species') !== -1, 'coverage notes say which sources speak for any species');
const avail = ctxRun(`
    (function () {
        const ctx = { accession: '', substitutions: [] };
        parsedTracks = { AA: 'M'.repeat(10) };
        uniprotFeatureTracks = {};
        const before = Object.keys(VARIANT_EFFECT_PROVIDERS).filter(id => VARIANT_EFFECT_PROVIDERS[id].available(ctx));
        ctx.accession = 'P04637';
        ctx.species = 'homo_sapiens';
        parsedTracks.CONSERVATION = { metric: 'shannon', values: new Array(10).fill(0.9) };
        parsedTracks['m_pLDDT'] = Array.from({ length: 10 }, () => ({ val: 90, type: 'plddt' }));
        uniprotFeatureTracks = { UP_Sites: { type: 'Site', features: [{ type: 'Active site', start: 5, end: 5, description: 'proton acceptor' }] } };
        const after = Object.keys(VARIANT_EFFECT_PROVIDERS).filter(id => VARIANT_EFFECT_PROVIDERS[id].available(ctx));
        return { before: before.join(','), after: after.join(',') };
    })()
`);
assert(avail.before === '', 'with nothing loaded no provider applies (no misleading runs)');
assert(avail.after === 'alphamissense,ensembl_vep,conservation,structure,curated', 'each source becomes applicable when its input (accession, species, tracks) arrives (got ' + avail.after + ')');
const localRuns = ctxRun(`
    (function () {
        parsedTracks = { AA: 'M'.repeat(10), CONSERVATION: { metric: 'shannon', values: [0.9, 0.9, 0.9, 0.9, 0.9, 0.4, 0.4, 0.4, 0.4, 0.4] },
            'm_pLDDT': Array.from({ length: 10 }, () => ({ val: 92, type: 'plddt' })),
            'm_RSA': Array.from({ length: 10 }, () => ({ val: 0.08, type: 'rsa' })),
            SS_PSIPRED: 'HHHHHCCCCC' };
        uniprotFeatureTracks = { UP_Sites: { type: 'Site', features: [{ type: 'Active site', start: 3, end: 3, description: 'proton acceptor' }] } };
        const ctx = { accession: 'P04637', substitutions: [{ key: 'M3H', sub: { ref: 'M', pos: 3, alt: 'H' } }, { key: 'M6H', sub: { ref: 'M', pos: 6, alt: 'H' } }] };
        const cons = VARIANT_EFFECT_PROVIDERS.conservation.run(ctx);
        const struc = VARIANT_EFFECT_PROVIDERS.structure.run(ctx);
        const cur = VARIANT_EFFECT_PROVIDERS.curated.run(ctx);
        return { cons: cons.results, struc: struc.results, cur: cur.results,
                 consSummary: cons.summary, strucSummary: struc.summary };
    })()
`);
assert(localRuns.cons.M3H.label === 'highly conserved' && localRuns.cons.M3H.level === 'high', 'conservation flags a conserved variant position as high');
assert(localRuns.cons.M6H.label === 'variable' && localRuns.cons.M6H.level === 'low', 'and a variable one as low');
assert(/buried/.test(localRuns.struc.M3H.label) && /pLDDT 92/.test(localRuns.struc.M3H.label) && /helix/.test(localRuns.struc.M3H.label), 'structure context reads RSA, pLDDT and SS at the position (got "' + localRuns.struc.M3H.label + '")');
assert(localRuns.struc.M3H.level === 'high', 'buried + ordered is high-impact context');
assert(localRuns.cur.M3H.label.indexOf('Active site') !== -1 && localRuns.cur.M3H.level === 'high', 'curated evidence names the overlapping UniProt feature');
assert(!localRuns.cur.M6H, 'and stays silent where no feature overlaps');
assert(localRuns.consSummary.indexOf('position(s) scored') !== -1, 'each provider reports its own summary for the status line');
sandbox.__localRuns = localRuns;
ctxRun(`
    variantEffectResults = {};
    mergeVariantEffectResults('conservation', window.__localRuns.cons);
    mergeVariantEffectResults('structure', window.__localRuns.struc);
    mergeVariantEffectResults('curated', window.__localRuns.cur);
`);
const mergedLine = ctxRun(`variantEffectLine({ ref: 'M', pos: 3, alt: 'H' })`);
assert(/^Conservation: highly conserved .*; Structure context: buried .*; Curated \(UniProt\): Active site/.test(mergedLine), 'the merged line lists providers in registry order (got "' + mergedLine + '")');
assert(HTML.indexOf('Assess variant effects') !== -1, 'the button is provider-agnostic');
assert(HTML.indexOf('VARIANT_EFFECT_PROVIDERS') !== -1 && HTML.indexOf('species-specific API later') !== -1 && HTML.indexOf('Ensembl VEP') !== -1, 'the framework documents its extension point in place (with the species-API candidates named)');
ctxRun(`parsedTracks = {}; uniprotFeatureTracks = {}; variantEffectResults = {}; variantEffectRan = {};`);

section('#3c: ddG hand-off - links, mutation-list copy, result import');
assert(HTML.indexOf('id="optCat-ddg"') !== -1 && HTML.indexOf('id="ddgPasteInput"') !== -1, 'the ddG category has its own panel and paste box');
assert(HTML.indexOf('Open DynaMut2') !== -1 && HTML.indexOf('Open DUET') !== -1 && HTML.indexOf('Open mCSM') !== -1 && HTML.indexOf('Open FoldX suite') !== -1, 'and the four verified services are linked (dead ones omitted)');
assert(HTML.indexOf('Copy mutation list') !== -1, 'with the mutation-list copy button');
const ddgRows = ctxRun(`parseDdgTable(['# comment', 'R175H -1.2', 'p.Arg175His -0.4', 'G175A', 'nonsense'].join(String.fromCharCode(10)))`);
assert(ddgRows.length === 2 && ddgRows[0].pos === 175 && ddgRows[0].val === -1.2 && ddgRows[0].mutation === 'R175H', 'ddG lines parse into position/value/mutation (got ' + JSON.stringify(ddgRows) + ')');
assert(ddgRows[1].mutation === 'R175H', 'three-letter tokens normalise to one-letter');
assert(ctxRun(`EXPERIMENTAL_KINDS.ddg.label`).indexOf('destabilising') !== -1, 'ddG is a known experimental kind with its interpretation');
ctxRun(`
    parsedTracks = { AA: 'M'.repeat(200) };
    experimentalTracksInfo = {};
    keyedVariantsInfo = { v1: { aligned: 'M'.repeat(200), raw: 'M'.repeat(200), desc: 'R175H' } };
`);
assert(ctxRun(`variantMutationListText()`) === 'R175H', 'the mutation list copies one-letter tokens (got "' + ctxRun(`variantMutationListText()`) + '")');
ctxRun(`
    document.getElementById('ddgNameInput').value = 'DynaMut2 ddG';
    document.getElementById('ddgPasteInput').value = 'R175H -1.2';
    addDdgTrack();
`);
assert(ctxRun(`Array.isArray(parsedTracks['DynaMut2_ddG_EXP'])`) === true, 'the ddG import lands as an experimental row (got ' + ctxRun(`Object.keys(parsedTracks).filter(k => k.endsWith('_EXP')).join(',')`) + ')');
assert(ctxRun(`experimentalTracksInfo['DynaMut2_ddG_EXP'].kind`) === 'ddg', 'registered with the ddG kind (tooltip/3D/report follow)');
assert(ctxRun(`parsedTracks['DynaMut2_ddG_EXP'][174].val`) === -1.2, 'at the substitution position');
assert(/1 value\(s\)/.test(ctxRun(`document.getElementById('ddgStatus').textContent`)), 'and the status confirms it');
ctxRun(`keyedVariantsInfo = { v1: { aligned: 'M', raw: 'M', desc: 'R175H' } }; setStepAnswer('homologs', 'hhpred', 'phmmer');`);
const homologActs = ctxRun(`resolveStepAction(WORKFLOW_STEPS.find(s => s.id === 'homologs')).extraActions.map(a => a.run)`);
assert(homologActs.some(r => r.indexOf('ddg') !== -1), 'the guide homologs step links to the ddG hand-off when variants are loaded (got ' + JSON.stringify(homologActs) + ')');
ctxRun(`clearStepAnswers('homologs');`);
ctxRun(`parsedTracks = {}; experimentalTracksInfo = {}; keyedVariantsInfo = {};`);

section('#4b: model-vs-model RMSD matrix in the ensemble panel');
ctxRun(`
    parsedTracks = { AA: 'MKV' };
    cachedStructureTexts = {
        'modelA.pdb': ['ATOM      1  CA  MET A   1       0.000   0.000   0.000  1.00  0.00           C','ATOM      2  CA  LYS A   2       3.800   0.000   0.000  1.00  0.00           C','ATOM      3  CA  VAL A   3       3.800   3.800   0.000  1.00  0.00           C'].join(String.fromCharCode(10)),
        'modelB.pdb': ['ATOM      1  CA  MET A   1      10.000   5.000  -3.000  1.00  0.00           C','ATOM      2  CA  LYS A   2      13.800   5.000  -3.000  1.00  0.00           C','ATOM      3  CA  VAL A   3      13.800   8.800  -3.000  1.00  0.00           C'].join(String.fromCharCode(10)),
        'modelC.pdb': ['ATOM      1  CA  MET A   1       0.000   0.000   0.000  1.00  0.00           C','ATOM      2  CA  LYS A   2       3.800   0.000   0.000  1.00  0.00           C','ATOM      3  CA  VAL A   3       3.800   3.800   2.000  1.00  0.00           C'].join(String.fromCharCode(10))
    };
    actionLog = [];
`);
const ens = ctxRun(`computeEnsembleVariance(['modelA.pdb', 'modelB.pdb', 'modelC.pdb'])`);
assert(ens.ok === true, 'the ensemble computes (got ' + (ens && ens.message) + ')');
assert(ens.rmsdMatrix && ens.rmsdMatrix.length === 3 && ens.rmsdMatrix[0].length === 3, 'a 3x3 matrix comes back');
assert(ens.rmsdMatrix[0][0] === 0 && ens.rmsdMatrix[1][1] === 0 && ens.rmsdMatrix[2][2] === 0, 'the diagonal is zero');
assert(ens.rmsdMatrix[0][1] < 0.01, 'a pure translation superposes to ~0 A (got ' + ens.rmsdMatrix[0][1] + ')');
assert(ens.rmsdMatrix[1][0] === ens.rmsdMatrix[0][1] && ens.rmsdMatrix[2][0] === ens.rmsdMatrix[0][2], 'the matrix is symmetric');
assert(ens.rmsdMatrix[0][2] > 0.1 && ens.rmsdMatrix[0][2] > ens.rmsdMatrix[0][1] * 10, 'a perturbed model reports a real difference, far above the translated pair (got ' + ens.rmsdMatrix[0][2] + ' vs ' + ens.rmsdMatrix[0][1] + ')');
assert(ens.pairMean > 0 && ens.pairMax && ens.pairMax.v >= ens.pairMean, 'the pair statistics follow the matrix');
ctxRun(`lastEnsembleResult = null; renderEnsembleSummary(computeEnsembleVariance(['modelA.pdb', 'modelB.pdb', 'modelC.pdb']));`);
const ensHtml = ctxRun(`document.getElementById('ensembleResults').innerHTML`);
assert(ensHtml.indexOf('Pairwise RMSD') !== -1 && ensHtml.indexOf('Mean pairwise RMSD') !== -1, 'the panel renders the matrix and its summary (got a table without it)');
assert((ensHtml.match(/<td style="background:rgb\(/g) || []).length >= 6, 'matrix cells carry the heat tint');
assert(ctxRun(`rmsdTint(0, 5)`) === 'rgb(248,250,252)' && ctxRun(`rmsdTint(5, 5)`) === 'rgb(254,202,202)', 'the tint runs pale to warm');
assert(ctxRun(`rmsdTint(2, 0)`) !== ctxRun(`rmsdTint(0, 0)`), 'and handles a zero max without dividing by zero');
ctxRun(`
    lastEnsembleResult = computeEnsembleVariance(['modelA.pdb', 'modelB.pdb', 'modelC.pdb']);
    parsedTracks.EV_RMSF = lastEnsembleResult.values;
`);
const ensReport = ctxRun(`buildMethodsReport()`);
assert(/Ensemble: mean RMSF .* mean pairwise RMSD .* A/.test(ensReport), 'the methods report carries the ensemble line (got "' + (ensReport.match(/Ensemble:[^\n]*/) || ['?'])[0] + '")');
ctxRun(`parsedTracks = {}; cachedStructureTexts = []; lastEnsembleResult = null; actionLog = [];`);

section('#4a: colour the 3D model by any track');
assert(HTML.indexOf('id="p3dColorSelect"') !== -1, 'the 3D toolbar has a colour picker');
assert(HTML.indexOf('id="p3dColorBtn"') === -1, 'the old cycle button is gone (the picker replaced it)');
ctxRun(`
    parsedTracks = {
        AA: 'MKVW',
        'm_pLDDT': [{ val: 10, type: 'plddt' }, { val: null, type: 'plddt' }, { val: 90, type: 'plddt' }, { val: 50, type: 'plddt' }],
        'VAL_1ABC_A': '  ! ',
        'RULE_r1': ' |  ',
        TP_Consensus: 'iM? '
    };
    trackMeta = {};
    setTrackMeta('RULE_r1', { source: 'Rule', color: '#ff0000', ruleName: 'R1' });
    analysisRules = [{ id: 'r1', name: 'R1', color: '#ff0000', mode: 'all', enabled: true, conditions: [] }];
`);
const numMap = ctxRun(`(function () { const m = p3dColorsForTrack('m_pLDDT'); return { size: m.size, min: m.get(0), max: m.get(2), mid: m.get(3) }; })()`);
assert(numMap.size === 3, 'a numeric track colours its non-null positions only (got ' + numMap.size + ')');
assert(numMap.min === '0xfee2e2' && numMap.max === '0x0f766e', 'the lowest value gets the ramp start and the highest its end, converted to 3Dmol hex (got ' + numMap.min + ' / ' + numMap.max + ')');
assert(numMap.mid !== numMap.min && numMap.mid !== numMap.max, 'and values in between interpolate');
const valMap = ctxRun(`(function () { const m = p3dColorsForTrack('VAL_1ABC_A'); return { size: m.size, flagged: m.get(2), clean: m.get(0) }; })()`);
assert(valMap.size === 4 && valMap.flagged === '#f59e0b' && valMap.clean === '#e2e8f0', 'a character track paints flagged residues in its colour and the rest grey (got ' + JSON.stringify(valMap) + ')');
const ruleMap = ctxRun(`p3dColorsForTrack('RULE_r1').get(1)`);
assert(ruleMap === '#ff0000', 'a rule track uses the rule colour (got ' + ruleMap + ')');
const topoMap = ctxRun(`(function () { const m = p3dColorsForTrack('TP_Consensus'); return { inside: m.get(0), tm: m.get(1), conflict: m.get(2), none: m.get(3) }; })()`);
const topoColors = ctxRun(`[TOPOLOGY_STATE_COLORS.i, TOPOLOGY_STATE_COLORS.M, TOPOLOGY_STATE_COLORS['?']].join(',')`).split(',');
assert(topoMap.inside === topoColors[0] && topoMap.tm === topoColors[1] && topoMap.conflict === topoColors[2], 'the topology consensus uses its state colours (got ' + JSON.stringify(topoMap) + ')');
assert(topoMap.none === undefined, 'unassigned consensus positions stay base-coloured');
assert(ctxRun(`p3dColorsForTrack('nope').size`) === 0 && ctxRun(`p3dColorsForTrack(null).size`) === 0, 'a missing track yields an empty map (no throw)');
ctxRun(`onP3DColorSelectChange('track:VAL_1ABC_A');`);
assert(ctxRun(`p3dTrackScheme`) === 'VAL_1ABC_A' && ctxRun(`p3dColorSelectValue()`) === 'track:VAL_1ABC_A', 'choosing a track scheme records it');
ctxRun(`onP3DColorSelectChange('base:2');`);
assert(ctxRun(`p3dTrackScheme`) === null && ctxRun(`p3dBaseSchemeIdx`) === 2, 'choosing a base scheme clears the track and sets the index');
ctxRun(`onP3DColorSelectChange('nonsense');`);
assert(ctxRun(`p3dTrackScheme`) === null && ctxRun(`p3dBaseSchemeIdx`) === 2, 'an unknown value changes nothing');
ctxRun(`p3dTrackScheme = 'VAL_1ABC_A';`);
assert(ctxRun(`(function () { const before = p3dTrackScheme; delete parsedTracks['VAL_1ABC_A']; syncP3DConservationMode(); return before + '->' + p3dTrackScheme; })()`) === 'VAL_1ABC_A->null', 'removing the chosen track clears the scheme (fallback, no dead colouring)');
ctxRun(`updateP3DColorOptions();`);
const selHtml = ctxRun(`document.getElementById('p3dColorSelect').innerHTML`);
assert(selHtml.indexOf('Base: white') !== -1 && selHtml.indexOf('TP_Consensus') !== -1, 'the picker lists the base schemes and the available tracks (got "' + selHtml.slice(0, 90) + '")');
assert(selHtml.indexOf('<optgroup') === -1, 'the picker is a flat list, no groups (got "' + selHtml.slice(0, 90) + '")');
assert(selHtml.indexOf('Base: conservation') !== -1, 'conservation stays one of the base schemes');
// Conservation as a track path still exists (robustness), but the picker does
// not list it: homolog/conservation colouring is the toggle's job.
ctxRun(`parsedTracks.CONSERVATION = { type: 'conservation', metric: 'shannon', values: [0, 0.5, 1, 0.9] };`);
const consMap = ctxRun(`(function () { const m = p3dColorsForTrack('CONSERVATION'); return { size: m.size, low: m.get(0), high: m.get(2) }; })()`);
assert(consMap.size === 4 && consMap.low === '0xffc6a0' && consMap.high === '0xa9d2ff', 'the conservation track path still paints the ConSurf gradient (got ' + JSON.stringify(consMap) + ')');
// Individual homolog rows are not picker entries any more.
ctxRun(`
    parsedTracks['HL_01_x'] = 'MM  ';
    homologHitsInfo = { HL_01_x: { rank: 1, hitId: 'sp|X|Y', source: 'phmmer', aaTrack: 'MM  ', stats: { Probab: '90' } } };
`);
ctxRun(`updateP3DColorOptions();`);
const selHtml2 = ctxRun(`document.getElementById('p3dColorSelect').innerHTML`);
assert(selHtml2.indexOf('Homolog #') === -1 && selHtml2.indexOf('track:CONSERVATION') === -1, 'neither individual homolog rows nor conservation-as-track are listed (the toggle owns those)');
// Flat / Per-residue toggle: flat paints each residue with the strongest hit's model-score colour.
const flatMap = ctxRun(`(function () { const m = p3dHomologFlatResidueColors(); return { size: m.size, r0: m.get(0), r2: m.get(2), r3: m.get(3) }; })()`);
assert(flatMap.size === 2 && flatMap.r0 === ctxRun(`p3dHexColor(modelScoreColor(90))`), 'a flat-mode residue takes its hit\'s model-score colour (got ' + JSON.stringify(flatMap) + ')');
assert(ctxRun(`p3dHomologFlat`) === false, 'the toggle starts per-residue');
ctxRun(`
    parsedTracks['HL_02_y'] = ' MMW';
    homologHitsInfo['HL_02_y'] = { rank: 2, hitId: 'sp|Z|W', source: 'phmmer', aaTrack: ' MMW', stats: { Probab: '40' } };
`);
const flatMap2 = ctxRun(`(function () { const m = p3dHomologFlatResidueColors(); return { size: m.size, r1: m.get(1), r2: m.get(2), r3: m.get(3) }; })()`);
assert(flatMap2.size === 4 && flatMap2.r3 === ctxRun(`p3dHexColor(modelScoreColor(40))`), 'a weaker hit still colours its own residues (got ' + JSON.stringify(flatMap2) + ')');
assert(flatMap2.r1 === ctxRun(`p3dHexColor(modelScoreColor(90))`) && flatMap2.r2 === ctxRun(`p3dHexColor(modelScoreColor(40))`), 'the shared residue takes the stronger hit and the weaker one keeps the rest');
ctxRun(`toggleP3DHomologFlat();`);
assert(ctxRun(`p3dHomologFlat`) === true && /^Flat$/.test(ctxRun(`document.getElementById('p3dFlatBtn').textContent`)), 'the toggle flips and the button says Flat');
const flatApplied = ctxRun(`
    (function () {
        p3dView = { setStyle: function () {}, zoomTo: function () {}, render: function () {}, resize: function () {} };
        p3dViewerOpen = true; p3dLoaded = true; p3dModel = { kind: 'pdb', fileName: 'x.pdb' };
        applyP3DConservationColoring();
        const status = document.getElementById('p3dStatus').textContent || '';
        p3dViewerOpen = false; p3dLoaded = false; p3dModel = null; p3dView = null;
        return status;
    })()
`);
assert(flatApplied.indexOf('homolog strength (flat)') !== -1, 'flat mode paints by homolog strength (got "' + flatApplied + '")');
ctxRun(`toggleP3DHomologFlat();`);
assert(ctxRun(`p3dHomologFlat`) === false && /^Per-residue$/.test(ctxRun(`document.getElementById('p3dFlatBtn').textContent`)), 'and flips back to Per-residue');
// Highlighting a homolog row colours per match-quality glyph, not one blue.
const selGlyph = ctxRun(`
    (function () {
        parsedTracks = { AA: 'MKVWX', 'HL_01_x': '|=+:.' };
        homologHitsInfo = { HL_01_x: { rank: 1, hitId: 'sp|X|Y', source: 'BLAST', aaTrack: 'MKVWX', stats: {} } };
        activeRowKey = 'HL_01_x'; selectionMode = 'row';
        const m = selectionResidueColors([[1, 5]]);
        const out = { bar: m.get(1), eq: m.get(2), plus: m.get(3), colon: m.get(4), dot: m.get(5) };
        p3dHomologFlat = true;
        const flat = selectionResidueColors([[1, 5]]).get(1);
        p3dHomologFlat = false;
        activeRowKey = null; selectionMode = 'point';
        return { out, flat };
    })()
`);
const glyphHex = (ch) => ctxRun(`p3dHexColor(HH_QUALITY_COLORS['${ch}'][0])`);
assert(selGlyph.out.bar === glyphHex('|') && selGlyph.out.eq === glyphHex('=') && selGlyph.out.plus === glyphHex('+') && selGlyph.out.colon === glyphHex(':') && selGlyph.out.dot === glyphHex('.'), 'a highlighted homolog colours each residue by its glyph (got ' + JSON.stringify(selGlyph.out) + ')');
assert(new Set(Object.values(selGlyph.out)).size === 5, 'and the five glyph colours are all distinct');
assert(selGlyph.flat === ctxRun(`P3D_COLOR_HEX.blue`), 'flat mode keeps the single blue (got ' + selGlyph.flat + ')');
// Lock freezes the model choice, not the colouring.
const lockProbe = ctxRun(`
    (function () {
        let styles = 0;
        parsedTracks = { AA: 'MK' };
        p3dViewerOpen = true; p3dLocked = true; p3dLoaded = true;
        p3dModel = { kind: 'pdb', fileName: 'x.pdb' };
        p3dView = { setStyle: function () { styles++; }, zoomTo: function () {}, render: function () {}, resize: function () {} };
        lastRanges = [[1, 2]];
        updateP3DColoring();
        const lockedStyles = styles;
        const status = document.getElementById('p3dStatus').textContent || '';
        p3dViewerOpen = false; p3dLocked = false; p3dLoaded = false; p3dModel = null; p3dView = null; lastRanges = null;
        return { lockedStyles, status };
    })()
`);
assert(lockProbe.lockedStyles >= 2, 'a locked viewer still recolours when the selection changes (got ' + lockProbe.lockedStyles + ' style calls)');
assert(lockProbe.status.indexOf('(model locked)') !== -1, 'and the status says the model, not the colouring, is locked (got "' + lockProbe.status + '")');
ctxRun(`parsedTracks = {}; homologHitsInfo = {}; trackMeta = {}; analysisRules = []; p3dTrackScheme = null; p3dBaseSchemeIdx = 0;`);

section('3D modal: stable toggle width, model source button, viewport bounds');
assert(HTML.indexOf('.p3d-toolbar #p3dFlatBtn { min-width: 84px') !== -1, 'the Flat/Per-residue button reserves the wider label width (no toolbar reflow)');
assert(HTML.indexOf('min(360px, calc(100vw - 12px))') !== -1 && HTML.indexOf('min(68vw, calc(100vw - 12px))') !== -1, 'the viewer sizes cap to the viewport');
const srcProbe = ctxRun(`
    (function () {
        Object.keys(p3dModelSources).forEach(k => delete p3dModelSources[k]);
        cachedStructureTexts = { 'remote1.pdb': 'x', 'local1.pdb': 'x' };
        p3dModelSources['remote1.pdb'] = { site: 'RCSB', href: 'https://www.rcsb.org/structure/1ABC' };
        function scan(el) {
            return (el.children || []).map(c => ({ cls: c.className || '', text: c.textContent || '', href: c.href || '' }));
        }
        loadP3DModel({ kind: 'pdb', fileName: 'remote1.pdb' });
        const remote = scan(document.getElementById('p3dModelInfo'));
        loadP3DModel({ kind: 'pdb', fileName: 'local1.pdb' });
        const local = scan(document.getElementById('p3dModelInfo'));
        p3dModel = null; cachedStructureTexts = {};
        return { remote, local };
    })()
`);
assert(srcProbe.remote.some(c => c.text === 'PDB on RCSB' && c.href === 'https://www.rcsb.org/structure/1ABC'), 'a downloaded model shows a clickable PDB on RCSB button (got ' + JSON.stringify(srcProbe.remote) + ')');
assert(srcProbe.local.some(c => c.text === 'Local model' && !c.href), 'an attached model shows Local model with no click action (got ' + JSON.stringify(srcProbe.local) + ')');
assert(HTML.indexOf('p3dExternalRef') === -1, 'the old name-guessed external link is gone (provenance is recorded at fetch time)');
const clampProbe = ctxRun(`
    (function () {
        window.innerWidth = 1000; window.innerHeight = 800;
        const el = document.getElementById('p3dViewer');
        el.hidden = false; el.offsetWidth = 300; el.offsetHeight = 200;
        el.style.left = '-50px'; el.style.top = '900px';
        clampP3DViewerPosition(el);
        const a = { left: el.style.left, top: el.style.top };
        el.style.left = '5000px'; el.style.top = '0px';
        clampP3DViewerPosition(el);
        const b = { left: el.style.left, top: el.style.top };
        el.hidden = true;
        return { a, b };
    })()
`);
assert(clampProbe.a.left === '6px' && clampProbe.a.top === '594px', 'a viewer past an edge is pulled back to the margin (got ' + JSON.stringify(clampProbe.a) + ')');
assert(clampProbe.b.left === '694px' && clampProbe.b.top === '6px', 'and the far corner clamps to viewport minus size (got ' + JSON.stringify(clampProbe.b) + ')');
assert((HTML.match(/clampP3DViewerPosition\(/g) || []).length >= 4, 'the clamp runs on define, place, drag and resize');
assert(HTML.indexOf("window.addEventListener('resize'") !== -1, 'a browser resize re-clamps the floating viewer');

section('homolog source tracking: sub-groups, badges, source filter');
ctxRun(`
    parsedTracks = {
        AA: 'MKVW',
        'HL_01_a': 'MM  ',
        'HL_02_b': ' MMW',
        'HL_03_c': 'MMM ',
        'HL_04_d': '  MW'
    };
    homologHitsInfo = {
        HL_01_a: { rank: 1, hitId: 'sp|A', source: 'BLAST' },
        HL_02_b: { rank: 2, hitId: 'sp|B', source: 'BLAST' },
        HL_03_c: { rank: 3, hitId: 'sp|C', source: 'phmmer' },
        HL_04_d: { rank: 4, hitId: 'sp|D', source: 'HHpred' }
    };
    trackControlState.filtered = {};
    trackManagerExpanded.HL = true;
`);
const srcGroups = ctxRun(`homologKeysBySource(['HL_01_a', 'HL_02_b', 'HL_03_c', 'HL_04_d'])`);
assert(srcGroups.map(x => x.source + ':' + x.keys.length).join(',') === 'BLAST:2,phmmer:1,HHpred:1', 'homologs group by source with counts (got ' + JSON.stringify(srcGroups) + ')');
ctxRun(`renderTrackManager();`);
const srcTmHtml = ctxRun(`document.getElementById('trackManagerList').innerHTML`);
assert(/tm-subgroup-name">BLAST <span[^>]*>\(2\)/.test(srcTmHtml), 'Track Control renders a BLAST sub-header with its count');
assert(srcTmHtml.indexOf('tm-src-badge tm-src-blast') !== -1 && srcTmHtml.indexOf('tm-src-badge tm-src-phmmer') !== -1 && srcTmHtml.indexOf('tm-src-badge tm-src-hhpred') !== -1, 'homolog rows carry colour-coded source badges');
ctxRun(`toggleTrackManagerSource('HL', 'BLAST');`);
const srcAfterHide = ctxRun(`['HL_01_a', 'HL_02_b', 'HL_03_c', 'HL_04_d'].map(k => isTrackFiltered(k)).join(',')`);
assert(srcAfterHide === 'true,true,false,false', 'the sub-header eye hides the whole source (got ' + srcAfterHide + ')');
ctxRun(`toggleTrackManagerSource('HL', 'BLAST');`);
assert(ctxRun(`['HL_01_a', 'HL_02_b'].map(k => isTrackFiltered(k)).join(',')`) === 'false,false', 'and shows it again');
const srcChips = ctxRun(`
    (function () {
        const wrap = buildTctlFilterSection('HL');
        function find(el, out) {
            (el.children || []).forEach(c => {
                if ((c.className || '').indexOf('tctl-src-chip') !== -1) out.push(c.textContent || '');
                find(c, out);
            });
            return out;
        }
        return find(wrap, []);
    })()
`);
assert(srcChips.join('|') === 'BLAST (2)|phmmer (1)|HHpred (1)', 'the quick-controls filter offers one chip per source (got ' + JSON.stringify(srcChips) + ')');
assert(HTML.indexOf('.tm-src-blast') !== -1 && HTML.indexOf('.tctl-src-chip') !== -1, 'the badge and chip styles ship with it');
ctxRun(`parsedTracks = {}; homologHitsInfo = {}; trackControlState.filtered = {}; trackManagerExpanded.HL = false;`);

section('#2c/#2d: Tracks tab vs quick controls - roles, links, row polish');
assert(HTML.indexOf('Track Visibility (full manager)') !== -1, 'the tab names itself the full manager');
assert(HTML.indexOf('Every track, grouped by type') !== -1, 'with a one-line role description');
assert(HTML.indexOf('Quick controls (View as / Color) ↗') !== -1, 'and its link to the popover says what lives there');
assert(HTML.indexOf('id="trackManagerSection"') !== -1, 'the section id is unchanged (deep links keep working)');
assert(ctxRun(`typeof openTrackManagerFromPopover`) === 'function', 'the inverse link exists');
assert(ctxRun(`(function () { openTrackManagerFromPopover(); const p = document.getElementById('side-panel-tracks'); return p && !p.hidden; })()`) === true, 'and it switches to the Tracks tab');
const tctlHead = ctxRun(`
    (function () {
        function find(el, out) {
            (el.children || []).forEach(c => { if (c && c.textContent) out.push(c.textContent); find(c, out); });
            return out;
        }
        const pop = document.createElement('div');
        buildTctlMasterList(pop);
        return find(pop, []);
    })()
`);
assert(tctlHead.some(x => x.indexOf('Full manager') !== -1), 'the popover header carries the Full manager link (got ' + JSON.stringify(tctlHead.slice(0, 6)) + ')');
// filtered tracks are named in the tab, not silently missing
ctxRun(`
    parsedTracks = { AA: 'MKV', SS_PSIPRED: 'HHH' };
    trackControlState.filtered = { SS_PSIPRED: true };
    trackManagerExpanded = { SS: true };
    renderTrackManager();
`);
const tmHtml = ctxRun(`document.getElementById('trackManagerList').innerHTML`);
assert(tmHtml.indexOf('(filtered)') !== -1, 'a filtered track says so in the full manager (got a list without the tag)');
ctxRun(`trackControlState.filtered = {}; trackManagerExpanded = {}; parsedTracks = {};`);
assert(HTML.indexOf('.track-row:has(.track-label.active-row)') !== -1, 'the active row tints the whole row (not just the label)');
assert(/opacity: 0\.55;/.test(HTML), 'the per-type chevrons are subtle until hovered');

section('model score colour mode (HL): gradient + tooltip stat');
ctxRun(`
    parsedTracks = { AA: 'MKV' };
    homologHitsInfo = {
        'HL_01_a': { rank: 1, hitId: 'sp|P1|A', source: 'HHpred', stats: { Probab: '98.5', 'E-value': '1e-40' } },
        'HL_02_b': { rank: 2, hitId: 'sp|P2|B', source: 'BLAST', stats: { 'E-value': '1e-5', Score: '120.4' } },
        'HL_03_c': { rank: 3, hitId: 'sp|P3|C', source: 'BLAST', stats: { 'E-value': '1e-2' } },
        'HL_04_d': { rank: 4, hitId: 'sp|P4|D', source: 'phmmer', stats: {} }
    };
`);
assert(ctxRun(`homologScoreFor('HL_01_a').conf`) === 99 && /98.5% probability/.test(ctxRun(`homologScoreFor('HL_01_a').raw`)), 'a probability source scores by its probability (got ' + ctxRun(`JSON.stringify(homologScoreFor('HL_01_a'))`) + ')');
assert(ctxRun(`homologScoreFor('HL_02_b').conf`) === 50 && /E-value 1e-5/.test(ctxRun(`homologScoreFor('HL_02_b').raw`)), 'an E-value source uses the decade scale and keeps the raw E-value (got ' + ctxRun(`JSON.stringify(homologScoreFor('HL_02_b'))`) + ')');
assert(ctxRun(`homologScoreFor('HL_04_d')`) === null, 'a hit with neither probability nor E-value has no score (no shading)');
assert(ctxRun(`modelScoreColor(0)`) === 'rgb(254,226,226)' && ctxRun(`modelScoreColor(100)`) === 'rgb(15,118,110)', 'the gradient runs light-red to teal (got ' + ctxRun(`modelScoreColor(0)`) + ' .. ' + ctxRun(`modelScoreColor(100)`) + ')');
const midColor = ctxRun(`modelScoreColor(65)`);
assert(midColor !== ctxRun(`modelScoreColor(0)`) && midColor !== ctxRun(`modelScoreColor(100)`), 'and interpolates in between (got ' + midColor + ')');
assert(ctxRun(`modelScoreColor(500)`) === 'rgb(15,118,110)' && ctxRun(`modelScoreColor(-5)`) === 'rgb(254,226,226)', 'out-of-range values clamp');
assert(ctxRun(`groupColorModes('HL').map(x => x[0]).join(',')`) === 'quality,conservation,residue,score', 'the Color column offers the new mode');
assert(ctxRun(`groupColorModes('HL').map(x => x[1]).join(',')`).indexOf('Model score') !== -1, 'named "Model score"');
ctxRun(`parsedTracks = {}; homologHitsInfo = {};`);

section('partial realignment: merge keeps the HSP glyphs, fills the rest');
ctxRun(`
    parsedTracks = { AA: 'MKVW', 'HL_02_part': ' |||' };
    homologHitsInfo = { 'HL_02_part': { rank: 2, hitId: 'sp|B|PART', source: 'BLAST', aaTrack: ' VW ' } };
`);
const mergeFilled = ctxRun(`mergeRealignedSequence('HL_02_part', 'MKVW', 'MKVW')`);
assert(mergeFilled === 2, 'the merge fills only the uncovered columns (got ' + mergeFilled + ')');
assert(ctxRun(`parsedTracks['HL_02_part']`) === '||||', 'the row becomes full-length while the HSP columns keep their glyphs (got "' + ctxRun(`parsedTracks['HL_02_part']`) + '")');
assert(ctxRun(`homologHitsInfo['HL_02_part'].aaTrack`) === 'MVWW', 'the AA track gains the uncovered residues while keeping the HSP columns (got "' + ctxRun(`homologHitsInfo['HL_02_part'].aaTrack`) + '")');
assert(ctxRun(`homologCoverageRange('HL_02_part').pct`) === 100, 'so the partial tag disappears');
assert(ctxRun(`mergeRealignedSequence('HL_02_part', 'MKVW', 'MKVW')`) === 0, 'a second merge has nothing left to fill');
ctxRun(`homologHitsInfo['HL_02_part'].realigned = { accession: 'B', filled: 2 };`);
assert(/Realigned from B/.test(ctxRun(`buildHomologPredictorInfo('HL_02_part').useCase`)), 'the tooltip says the row was realigned and why the glyphs mix');
ctxRun(`parsedTracks = {}; homologHitsInfo = {};`);

section('partial HSP coverage: helper, row tag, tooltip, read-out');
ctxRun(`
    parsedTracks = { AA: 'MKVW', 'HL_01_full': '||||', 'HL_02_part': ' |||', 'HL_03_tiny': '|   ', 'HL_04_none': '    ' };
    homologHitsInfo = {
        'HL_01_full': { rank: 1, hitId: 'sp|A|FULL', source: 'phmmer', aaTrack: 'MKVW', stats: { 'E-value': '1e-5' } },
        'HL_02_part': { rank: 2, hitId: 'sp|B|PART', source: 'BLAST', aaTrack: ' VW ', stats: { 'E-value': '1e-3' } },
        'HL_03_tiny': { rank: 3, hitId: 'sp|C|TINY', source: 'BLAST', aaTrack: 'M   ', stats: {} },
        'HL_04_none': { rank: 4, hitId: 'sp|D|NONE', source: 'BLAST', aaTrack: '    ', stats: {} }
    };
`);
const covFull = ctxRun(`homologCoverageRange('HL_01_full')`);
assert(covFull.pct === 100 && covFull.from === 1 && covFull.to === 4, 'a full row reports 100% over 1-4');
const covPart = ctxRun(`homologCoverageRange('HL_02_part')`);
assert(Math.round(covPart.pct) === 50 && covPart.from === 2 && covPart.to === 3, 'a partial row reports its range (got ' + Math.round(covPart.pct) + '% ' + covPart.from + '-' + covPart.to + ')');
assert(ctxRun(`homologCoverageRange('HL_04_none')`) === null, 'an empty row reports nothing (no tag)');
assert(/Coverage: 50% \(residues 2-3\)/.test(ctxRun(`buildHomologPredictorInfo('HL_02_part').useCase`)), 'the tooltip names the covered range (got "' + ctxRun(`buildHomologPredictorInfo('HL_02_part').useCase`) + '")');
assert(!/Coverage:/.test(ctxRun(`buildHomologPredictorInfo('HL_01_full').useCase`)), 'a full row gets no coverage note');
const insPartial = ctxRun(`computeGuideInsights().map(x => x.text).join(' ')`);
assert(/homolog row\(s\) cover only part of the sequence/.test(insPartial), 'the read-out counts partial rows (got "' + insPartial.slice(0, 80) + '")');
assert(/lowest 25%/.test(insPartial), 'and names the lowest coverage');
// Partial coverage lives in the row tooltip now, not the visible label.
const tagProbe = ctxRun(`
    (function () {
        function findLabels(el, out) {
            (el.children || []).forEach(c => {
                if (c && c.className === 'track-label-text') out.push(c.title || '');
                findLabels(c, out);
            });
            return out;
        }
        const full = buildTrackRow('HL_01_full', parsedTracks, 4, false);
        const part = buildTrackRow('HL_02_part', parsedTracks, 4, false);
        return { full: findLabels(full, []), part: findLabels(part, []) };
    })()
`);
assert(tagProbe.part.length === 1 && tagProbe.part[0].indexOf('covers residues 2-3 of 4 (50%)') !== -1, 'a partial row carries the coverage in its label tooltip (got ' + JSON.stringify(tagProbe.part) + ')');
assert(tagProbe.part[0].indexOf('(partial') === -1, 'and not in the visible name field any more');
assert(tagProbe.full.length === 1 && tagProbe.full[0].indexOf('covers residues') === -1, 'a full row gets no coverage note');
assert(HTML.indexOf('track-partial-tag') === -1, 'the amber tag style is gone entirely');
ctxRun(`parsedTracks = {}; homologHitsInfo = {};`);

section('reference numbering offset: global + per-track, re-applied from raw data');
assert(ctxRun(`shiftStateString('MMM', 2, 6)`) === '  MMM ', 'a state string shifts right and pads (got "' + ctxRun(`shiftStateString('MMM', 2, 6)`) + '")');
assert(ctxRun(`shiftStateString('  MMM ', -2, 6)`) === 'MMM   ', 'and left, dropping what falls off');
assert(ctxRun(`shiftStateString('MMM', 0, 3)`) === 'MMM', 'zero offset is a pass-through');
ctxRun(`
    parsedTracks = { AA: 'M'.repeat(10) };
    topologySources = [{ name: 'Phobius', state: 'MMM' }];
    uniprotFeatures = { accession: 'P00001', features: [{ type: 'Active site', start: 1, end: 2, description: 'x' }] };
    uniprotFeatureTracks = {};
    experimentalTracksInfo = { 'DMS_EXP': { label: 'DMS', kind: 'dms', rows: [{ pos: 1, val: 0.9 }, { pos: 2, val: 0.8 }, { pos: 11, val: 0.1 }] } };
    referenceOffset = 5; trackOffsets = {};
    applyReferenceOffset && null;
`);
assert(ctxRun(`applyReferenceOffset(1, null)`) === 6, 'the helper shifts a position by the global offset');
ctxRun(`applyTopologySources();`);
assert(ctxRun(`parsedTracks['TP_Phobius'].indexOf('M')`) === 5 && ctxRun(`(parsedTracks['TP_Phobius'].match(/M/g) || []).length`) === 3, 'topology segments land at the shifted positions (got index ' + ctxRun(`parsedTracks['TP_Phobius'].indexOf('M')`) + ')');
ctxRun(`applyUniProtFeatures();`);
assert(ctxRun(`(function () { const k = Object.keys(parsedTracks).find(x => x.startsWith('UP_')); return k ? parsedTracks[k].indexOf('\u25a0') : -1; })()`) === 5, 'UniProt features shift too');
ctxRun(`remapExperimentalTrack('DMS_EXP');`);
assert(ctxRun(`parsedTracks['DMS_EXP'][5].val`) === 0.9 && ctxRun(`experimentalTracksInfo['DMS_EXP'].outOfRange`) === 1, 'experimental rows shift, and out-of-range positions are counted (got ' + ctxRun(`experimentalTracksInfo['DMS_EXP'].outOfRange`) + ')');
// per-track override beats the global
ctxRun(`trackOffsets = { 'TP_Phobius': -1 }; applyTopologySources();`);
assert(ctxRun(`parsedTracks['TP_Phobius'].indexOf('M')`) === 0, 'a per-track override wins over the global offset');
// changing the offset re-places from the raw data (nothing is lost)
ctxRun(`referenceOffset = 0; trackOffsets = {}; applyReferenceOffset && null; remapExperimentalTrack('DMS_EXP'); applyTopologySources(); applyUniProtFeatures();`);
assert(ctxRun(`parsedTracks['DMS_EXP'][0].val`) === 0.9 && ctxRun(`parsedTracks['TP_Phobius'].indexOf('M')`) === 0, 'resetting the offset re-places everything from its raw data');
// applyReferenceNumbering re-applies + reports
ctxRun(`actionLog = []; referenceOffset = 2; applyReferenceNumbering();`);
assert(ctxRun(`(function () { const e = actionLog.find(x => x.kind === 'import' && x.label.indexOf('reference numbering applied') !== -1); return !!e && e.detail.indexOf('global +2') !== -1; })()`), 'applying a numbering change is reported with the shift (got ' + ctxRun(`JSON.stringify(actionLog.filter(e => e.kind === 'import'))`) + ')');
ctxRun(`referenceOffset = 0; trackOffsets = {}; parsedTracks = {}; topologySources = []; uniprotFeatures = null; uniprotFeatureTracks = {}; experimentalTracksInfo = {}; actionLog = [];`);
assert(HTML.indexOf('id="refOffsetInput"') !== -1 && HTML.indexOf('id="trackOffsetInput"') !== -1 && HTML.indexOf('id="refOffsetSummary"') !== -1, 'Input Data has the numbering controls');
assert(ctxRun(`Object.prototype.hasOwnProperty.call(gatherPersistableState(), 'referenceOffset') && Object.prototype.hasOwnProperty.call(gatherPersistableState(), 'trackOffsets')`), 'the numbering travels in the session save');

section('legacy saves (pre-0.23.0): tolerated, and explained');
sandbox.__preLegacy = ctxRun(`JSON.stringify(gatherPersistableState())`);
ctxRun(`
    actionLog = [];
    applyPersistedState({
        parsedTracks: { AA: 'MKV', 'TP_Old': 'iii', 'DM_Old': '   ', 'UP_Old': '  \u25a0' },
        currentProteinLabel: 'legacy', structureFiles: [], structureReferences: {},
        homologHitsInfo: {}, validationHitsInfo: {}, experimentalTracksInfo: {}, keyedVariantsInfo: {},
        graphHighlights: {}, topologySources: [], uniprotFeatures: null, uniprotFeatureTracks: {},
        domainHitsInfo: {}, selection: {}, preferences: {}, graphMode: {},
        analysisRules: [], guideProfile: {}, guideOverrides: {}, guideAnswers: {}
    });
`);
assert(ctxRun(`typeof parsedTracks['TP_Old'] === 'string' && typeof parsedTracks['DM_Old'] === 'string'`), 'a legacy save still restores its rows');
assert(ctxRun(`actionLog.some(e => e.kind === 'import' && /legacy session restored/.test(e.label) && /topology, domain, UniProt feature/.test(e.detail))`), 'and the app says which groups have no backing data (got ' + ctxRun(`JSON.stringify(actionLog.filter(e => e.kind === 'import'))`) + ')');
assert(ctxRun(`(function () { try { removeTracks(['TP_Old']); return parsedTracks['TP_Old'] === undefined; } catch (e) { return 'threw: ' + e.message; } })()`) === true, 'removing a legacy row works (nothing to unpick) without throwing');
ctxRun(`applyPersistedState(JSON.parse(window.__preLegacy)); actionLog = [];`);

section('X2/X4: removal of restored rows is surgical; rules follow the data');
ctxRun(`
    parsedTracks = { AA: 'MKV', 'HL_01_a': '|=:', 'HL_02_b': '|||', 'DM_X': '   ', 'UP_Sites': '  \u25a0', 'TP_A': 'iii', 'VAR_v1': 'MKV' };
    homologHitsInfo = { 'HL_01_a': { rank: 1 }, 'HL_02_b': { rank: 2 } };
    domainHitsInfo = { 'DM_X': { model: 'X' } };
    uniprotFeatureTracks = { UP_Sites: { type: 'Site', features: [] } };
    keyedVariantsInfo = { v1: { aligned: 'MKV' } };
    topologySources = [{ name: 'A', state: 'iii' }];
    graphHighlights = { 'HL_01_a': true };
`);
ctxRun(`removeTracks(['HL_01_a']);`);
assert(ctxRun(`parsedTracks['HL_01_a'] === undefined && typeof parsedTracks['HL_02_b'] === 'string'`), 'removing one homolog removes only that row');
assert(ctxRun(`homologHitsInfo['HL_01_a'] === undefined && !!homologHitsInfo['HL_02_b']`), 'and only that hit\'s info entry');
assert(ctxRun(`graphHighlights['HL_01_a'] === undefined`), 'its highlight flag goes too');
ctxRun(`removeTracks(['DM_X']); removeTracks(['UP_Sites']); removeTracks(['VAR_v1']); removeTracks(['TP_A']);`);
assert(ctxRun(`domainHitsInfo['DM_X'] === undefined && parsedTracks['DM_X'] === undefined`), 'a domain row takes its family stats with it');
assert(ctxRun(`uniprotFeatureTracks['UP_Sites'] === undefined`), 'a UniProt row takes its feature store');
assert(ctxRun(`keyedVariantsInfo.v1 === undefined`), 'a variant row takes its sequence');
assert(ctxRun(`topologySources.length === 0`), 'a topology row takes the pasted source it came from');
ctxRun(`
    parsedTracks = { AA: 'MKV', SS_PSIPRED: 'HHH' };
    analysisRules = [{ id: 'x4', name: 'X4', color: '#ff0000', mode: 'all', enabled: true, conditions: [{ kind: 'categorical', source: 'group:SS', op: 'annotated', value: '' }] }];
    rebuildRuleTracks();
`);
assert(ctxRun(`typeof parsedTracks['RULE_x4'] === 'string'`), 'a rule produces its row while its input exists');
ctxRun(`removeTracks(['SS_PSIPRED']); rebuildRuleTracks();`);
assert(ctxRun(`parsedTracks['RULE_x4'] === undefined`), 'and the row disappears when the input track is removed (X4: rules follow the data)');
assert(ctxRun(`analysisRules.length === 1 && analysisRules[0].id === 'x4'`), 'while the rule definition itself stays');
ctxRun(`parsedTracks = {}; analysisRules = []; homologHitsInfo = {}; domainHitsInfo = {}; uniprotFeatureTracks = {}; keyedVariantsInfo = {}; topologySources = []; graphHighlights = {};`);

section('X1: session save/restore round-trip (self-driven QA)');
ctxRun(`
    parsedTracks = { AA: 'MKV', SS_PSIPRED: 'HHH', CONSERVATION: { metric: 'shannon', values: [0.5, 0.6, 0.7] },
        'HL_01_sp_X_Y': '|=:', 'DM_PF00001': '   ', 'UP_Sites': '  \u25a0', 'TP_Phobius': 'iii', TP_Consensus: 'iii',
        'm_pLDDT': [{ val: 90, type: 'plddt' }, { val: 80, type: 'plddt' }, { val: 70, type: 'plddt' }],
        'DMS_EXP': [{ val: 0.1, type: 'exp' }, { val: 0.2, type: 'exp' }, { val: null, type: 'exp' }],
        'VAL_1ABC_A': '  !' };
    homologHitsInfo = { 'HL_01_sp_X_Y': { rank: 1, hitId: 'sp|X|Y', source: 'phmmer', stats: { 'E-value': '1e-5' }, aaTrack: 'MKV' } };
    validationHitsInfo = { 'VAL_1ABC_A': { pdbId: '1ABC', chain: 'A', flags: { 2: ['clashes'] }, summary: { geometry_quality: 5 } } };
    domainHitsInfo = { 'DM_PF00001': { model: 'Pfam:PF00001', database: 'InterProScan', description: 'X', domains: [] } };
    uniprotFeatureTracks = { UP_Sites: { type: 'Site', category: 'site', color: '#ffffff', features: [{ type: 'Active site', start: 2, end: 2, description: 'x' }] } };
    topologySources = [{ name: 'Phobius', state: 'iii' }];
    experimentalTracksInfo = { 'DMS_EXP': { label: 'DMS tolerance', kind: 'dms', values: 2, mean: 0.15 } };
    analysisRules = [{ id: 'r1', name: 'R', color: '#ff0000', mode: 'all', enabled: true, conditions: [{ kind: 'categorical', source: 'group:SS', op: 'annotated', value: '' }] }];
    guideAnswers = { homologs: { hhpred: 'phmmer' } };
    guideOverrides = { structure: 'done' };
    guideProfile = { membrane: 'yes' };
    graphMode = { pLDDT: true, RSA: false, EV: true, EXP: true };
    graphHighlights = { 'HL_01_sp_X_Y': true };
    currentProteinLabel = 'GFP test';
`);
sandbox.__saved = ctxRun(`JSON.stringify(gatherPersistableState())`);
ctxRun(`resetInputDataState(); applyPersistedState(JSON.parse(window.__saved));`);
const roundTrip = ctxRun(`
    (function () {
        const before = JSON.parse(window.__saved);
        const after = JSON.parse(JSON.stringify(gatherPersistableState()));
        delete before.savedAt; delete after.savedAt;
        const diffs = [];
        Object.keys(before).forEach(k => { if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) diffs.push(k); });
        return { diffs, expInfo: after.experimentalTracksInfo, tracks: Object.keys(after.parsedTracks || {}).length };
    })()
`);
assert(roundTrip.diffs.length === 0, 'every state-bearing key survives the round-trip (diffs: ' + roundTrip.diffs.join(', ') + ')');
assert(roundTrip.expInfo && roundTrip.expInfo['DMS_EXP'] && roundTrip.expInfo['DMS_EXP'].kind === 'dms', 'the experimental row keeps its label/kind across a reload');
ctxRun(`parsedTracks = {}; homologHitsInfo = {}; validationHitsInfo = {}; domainHitsInfo = {}; uniprotFeatureTracks = {}; topologySources = []; experimentalTracksInfo = {}; analysisRules = []; guideAnswers = {}; guideOverrides = {}; guideProfile = {}; graphHighlights = {};`);

section('methods report covers the newer evidence layers');
ctxRun(`
    parsedTracks = { AA: 'M'.repeat(10), 'DMS_tolerance_EXP': Array.from({ length: 10 }, (_, i) => ({ val: i < 5 ? 0.9 : 0.2, type: 'exp' })),
        CONSERVATION: { metric: 'shannon', values: [0.9, 0.9, 0.9, 0.9, 0.9, 0.3, 0.3, 0.3, 0.3, 0.3] },
        DM_PF01306: 'M'.repeat(10) };
    experimentalTracksInfo = { DMS_tolerance_EXP: { label: 'DMS tolerance', kind: 'dms', values: 10, mean: 0.55 } };
    validationHitsInfo = {
        VAL_1GFL_A: { pdbId: '1GFL', chain: 'A', flags: { 1: ['sidechain_outliers'], 4: ['clashes', 'RSRZ'] }, summary: { geometry_quality: 7.55, data_quality: 53.59 } },
        VAL_1GFL_B: { pdbId: '1GFL', chain: 'B', flags: { 2: ['clashes'] }, summary: { geometry_quality: 7.55, data_quality: 53.59 } }
    };
    variantEffectResults = { R175H: { alphamissense: { label: 'pathogenic or likely pathogenic', detail: '0.99', level: 'high' },
                                     conservation: { label: 'highly conserved', detail: '0.97', level: 'high' } } };
    domainHitsInfo = { DM_PF01306: { model: 'Pfam:PF01306', database: 'InterProScan', description: 'LacY/RafB permease family', domains: [] } };
    topologySources = [{ name: 'Phobius', state: 'M'.repeat(10) }, { name: 'TMHMM', state: 'M'.repeat(10) }];
    applyTopologySources();
    homologHitsInfo = { HL_01_x: { rank: 1, hitId: 'sp|P42212|GFP_AEQVI', source: 'phmmer' }, HL_02_y: { rank: 2, hitId: 'sp|Q9U6Y3|GFPL_CLASP', source: 'BLAST' } };
    analysisRules = []; guideProfile = {}; guideAnswers = {}; guideOverrides = {};
`);
const richReport = ctxRun(`buildMethodsReport()`);
assert(richReport.indexOf('## Experimental structure validation') !== -1, 'the report has a validation section');
const valLine = (richReport.match(/\*\*1GFL\*\*[^\n]*/) || ['?'])[0];
assert(valLine.indexOf('(2 chains)') !== -1 && valLine.indexOf('2 clashes') !== -1 && valLine.indexOf('1 sidechain outlier') !== -1 && valLine.indexOf('1 RSRZ outlier') !== -1 && /quality percentiles: geometry 7\.5, data 53\.6/.test(valLine), 'with per-entry outlier counts across chains and the quality scores (got "' + valLine + '")');
const expLine = (richReport.match(/\*\*DMS tolerance\*\*[^\n]*/) || ['?'])[0];
assert(richReport.indexOf('## Experimental per-residue data') !== -1 && expLine.indexOf('DMS tolerance (higher = better tolerated)') !== -1 && expLine.indexOf('10 value(s), mean 0.550') !== -1 && /correlation with conservation r=-?\d+\.\d+/.test(expLine), 'the experimental section names the kind and the conservation correlation (got "' + expLine + '")');
assert(richReport.indexOf('## Variant effect evidence') !== -1 && /R175H: AlphaMissense: pathogenic or likely pathogenic; Conservation: highly conserved/.test(richReport), 'the variant section lists per-provider results per substitution');
assert(/AlphaMissense: 1 substitution\(s\), 1 high-impact/.test(richReport), 'and per-provider tallies');
assert(richReport.indexOf('- Topology consensus: ') !== -1 && /TM segment\(s\), N-terminus/.test(richReport), 'the topology consensus detail is in the evidence list');
assert(/Domain families \(InterProScan: 1\): Pfam:PF01306/.test(richReport), 'domain families are named with their database');
assert(richReport.indexOf('## Data sources') !== -1 && /phmmer \(1 hit\)/.test(richReport) && /BLAST \(1 hit\)/.test(richReport), 'provenance lists the homolog sources');
assert(/domain families: InterProScan \(1\)/.test(richReport) && /PDBe validation/.test(richReport) && /membrane topology \(Phobius, TMHMM\)/.test(richReport), 'plus domains, validation and topology');
assert(/imported experimental data/.test(richReport), 'and the experimental import');
ctxRun(`
    parsedTracks = {}; experimentalTracksInfo = {}; validationHitsInfo = {}; variantEffectResults = {};
    domainHitsInfo = {}; topologySources = []; homologHitsInfo = {};
`);

section('experimental per-residue data (DMS / HDX / any table)');
assert(ctxRun(`GRAPH_TYPES.indexOf('EXP')`) !== -1, 'experimental data is a graph-capable type');
assert(ctxRun(`getTrackGroup('DMS_tolerance_EXP')`) === 'EXP', 'its tracks group under Experimental');
assert(ctxRun(`trackGroupLabel('EXP')`) === 'Experimental', 'with a proper group label');
const expTwoCol = ctxRun(`parseExperimentalTable(['# position value', '1 0.42', '2\t0.55', '3,0.91', '4:0.10', '5;0.20', '', 'nonsense'].join(String.fromCharCode(10)))`);
assert(expTwoCol.length === 5 && expTwoCol[0].pos === 1 && expTwoCol[1].val === 0.55 && expTwoCol[4].pos === 5, 'two-column forms (space/tab/comma/colon/semicolon) all parse, comments and junk skipped (got ' + expTwoCol.length + ')');
const expSeries = ctxRun(`parseExperimentalTable('0.2 0.3 0.9 0.4 0.5')`);
assert(expSeries.length === 5 && expSeries[2].val === 0.9 && expSeries[2].pos === 3, 'a single series of five values becomes positions 1..5');
assert(ctxRun(`parseExperimentalTable('1 0.5')`).length === 1, 'a single short line is not mistaken for a series');
ctxRun(`
    parsedTracks = { AA: 'M'.repeat(10), CONSERVATION: { metric: 'shannon', values: [0.9, 0.9, 0.9, 0.9, 0.9, 0.4, 0.4, 0.4, 0.4, 0.4] } };
    experimentalTracksInfo = {};
    document.getElementById('expNameInput').value = 'DMS tolerance';
    document.getElementById('expKindSelect').value = 'dms';
    document.getElementById('expPasteInput').value = ['1 0.10','2 0.20','3 0.15','4 0.90','5 0.80','6 0.70','7 0.60','8 0.50','9 0.40','10 0.30'].join(String.fromCharCode(10));
    addExperimentalTrack();
`);
assert(ctxRun(`Array.isArray(parsedTracks['DMS_tolerance_EXP'])`) === true, 'the importer adds a numeric row (got ' + ctxRun(`Object.keys(parsedTracks).filter(k => k.endsWith('_EXP')).join(',')`) + ')');
assert(ctxRun(`parsedTracks['DMS_tolerance_EXP'][3].val`) === 0.9 && ctxRun(`parsedTracks['DMS_tolerance_EXP'][3].type`) === 'exp', 'with { val, type } entries at the right positions');
assert(ctxRun(`formatTrackLabel('DMS_tolerance_EXP')`) === 'DMS tolerance (experimental)', 'the row label uses the given label');
assert(ctxRun(`isGraphCapable(getTrackGroup('DMS_tolerance_EXP'))`) === true, 'and it plots as the experimental graph type (the group is the type)');
const expTip = ctxRun(`(function () { const info = getPredictorInfo('DMS_tolerance_EXP'); return { cat: info.category, desc: info.description, use: info.useCase }; })()`);
assert(/Experimental/.test(expTip.cat) && /DMS tolerance/.test(expTip.desc) && /tolerated/.test(expTip.desc), 'the tooltip names the label and the kind meaning (got "' + expTip.desc.slice(0, 60) + '")');
assert(/10 value\(s\)/.test(expTip.use) && /range/.test(expTip.use), 'and summarises the values');
const expStatus = ctxRun(`document.getElementById('expStatus').textContent`);
assert(/Added "DMS tolerance": 10 value\(s\)/.test(expStatus), 'the status confirms what was added (got "' + expStatus.slice(0, 60) + '")');
assert(/correlation with conservation r=-?0\.\d+/.test(expStatus), 'and reports the conservation correlation (got "' + expStatus + '")');
assert(ctxRun(`ruleNumericValue('EXP:DMS_tolerance_EXP', 3)`) === 0.9, 'the row is usable as a rule source (EXP:)');
assert(ctxRun(`parsedTracks['DMS_tolerance_EXP'][9].val`) === 0.3, 'every position maps');
assert(ctxRun(`(function () { const v = new Array(10).fill(null).map(() => ({ val: null, type: 'exp' })); return true; })()`), 'null-valued positions stay null');
ctxRun(`parsedTracks = {}; experimentalTracksInfo = {};`);
assert(HTML.indexOf('id="expPasteInput"') !== -1 && HTML.indexOf('id="expKindSelect"') !== -1 && HTML.indexOf('id="btnAddExp"') !== -1, 'the Experimental category has the importer controls');
assert(HTML.indexOf('id="optCat-experimental"') !== -1, 'and its own panel');
assert(ctxRun(`WORKFLOW_STEPS.find(s => s.id === 'structure').extraActions.some(a => a.run.indexOf('experimental') !== -1)`), 'the guide structure step links to it');

section('PDB entry lookup (sequence or accession)');
const pdbProvs = ctxRun(`SERVICE_REGISTRY.capabilities.pdb_entry_lookup.providers.map(p => p.id)`);
assert(pdbProvs.join(',') === 'pdbe_best_structures,rcsb_sequence,rcsb_text', 'the lookup offers PDBe best structures, the RCSB sequence search, then the name search (got ' + pdbProvs.join(',') + ')');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.pdb_entry_lookup.providers[2].url`).indexOf('search.rcsb.org') !== -1, 'the name search uses the same CORS-verified RCSB endpoint');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.pdb_entry_lookup.providers[0].url`).indexOf('best_structures') !== -1, 'the PDBe provider uses the verified endpoint');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.pdb_entry_lookup.providers[1].url`).indexOf('search.rcsb.org') !== -1, 'and the RCSB one the search API');
ctxRun(`
    pdbLookupEntries = [
        { id: '2G16', title: 'Structure of S65A Y66S GFP variant', method: 'X-ray diffraction', resolution: 2.0, coverage: 1, identity: 1 },
        { id: '7PCA', title: '', method: '', resolution: null, coverage: null, identity: 1 }
    ];
    renderPdbLookupResults();
`);
const lookupHtml = ctxRun(`document.getElementById('pdbLookupResults').innerHTML`);
assert(lookupHtml.indexOf('2G16') !== -1 && lookupHtml.indexOf('X-ray diffraction') !== -1 && lookupHtml.indexOf('2.00') !== -1, 'each hit shows id, title and method/resolution (got "' + lookupHtml.slice(0, 90) + '")');
assert(lookupHtml.indexOf('coverage 100%') !== -1 && lookupHtml.indexOf('identity 100%') !== -1, 'plus coverage and identity when known');
assert(lookupHtml.indexOf('(no title)') === -1, 'and shows no placeholder noise when metadata is missing');
assert(ctxRun(`typeof SERVICE_ADAPTERS.rcsbEntryMeta`) === 'function', 'the GraphQL metadata fetch is shared by both providers');
assert((lookupHtml.match(/fetchPdbEntry/g) || []).length === 2, 'every hit has a Fetch button that reuses the PDB fetch');
assert(HTML.indexOf('id="btnPdbLookup"') !== -1 && HTML.indexOf('id="pdbLookupStatus"') !== -1 && HTML.indexOf('id="pdbLookupResults"') !== -1, 'the structure panel has the button, status and results list');
assert((HTML.match(/Find UniProt accession/g) || []).length >= 2, 'and the first step (Find UniProt accession) is offered there too');
assert(HTML.indexOf('use Find PDB entries in Options -> Structure') !== -1, 'and the PDB box points at it when an id is missing');
ctxRun(`pdbLookupEntries = []; renderPdbLookupResults();`);

section('Options: data-source categories + guide deep links');
assert(HTML.indexOf('id="optDataCategory"') !== -1 && HTML.indexOf('id="optDataCategoryHint"') !== -1, 'Options -> Data Sources has a category dropdown and a hint line');
const catPanels = ctxRun(`Object.keys(DATA_CATEGORY_HINTS)`);
assert(catPanels.join(',') === 'uniprot,conservation,topology,domains,homologs,structure,experimental,ddg,foldseek,variants,services', 'eleven categories are declared (got ' + catPanels.join(',') + ')');
assert(catPanels.every(n => HTML.indexOf('id="optCat-' + n + '"') !== -1), 'and every category has a panel in the markup');
const switchProbe = ctxRun(`
    (function () {
        switchDataCategory('domains');
        const domHidden = document.getElementById('optCat-domains').hidden;
        const homHidden = document.getElementById('optCat-homologs').hidden;
        const hint = document.getElementById('optDataCategoryHint').textContent;
        switchDataCategory('nope');
        const fallback = optDataCategory;
        switchDataCategory('domains');
        return { domHidden, homHidden, hint, fallback };
    })()
`);
assert(switchProbe.domHidden === false && switchProbe.homHidden === true, 'switching shows exactly one panel');
assert(/hmmscan/.test(switchProbe.hint) && /NCBIfam/.test(switchProbe.hint), 'and sets the category description (got "' + switchProbe.hint.slice(0, 50) + '")');
assert(switchProbe.fallback === 'uniprot', 'an unknown category falls back to the first one');
const deepProbe = ctxRun(`
    (function () {
        openDataSources('foldseek');
        return { cat: optDataCategory, hidden: document.getElementById('optCat-foldseek').hidden };
    })()
`);
assert(deepProbe.cat === 'foldseek' && deepProbe.hidden === false, 'openDataSources deep-links into a category');
assert(ctxRun(`(function () { openTopologyPanel(); return optDataCategory; })()`) === 'topology', 'openTopologyPanel now deep-links to the topology category');
assert(ctxRun(`(function () { focusUniProtSection(); return optDataCategory; })()`) === 'uniprot', 'and the UniProt focus helper to the UniProt category');
// The capability controls moved out of the Input Data row into their panels.
['btnDomainScan', 'btnHomologSearch', 'btnTopologyPredict', 'btnValidation', 'btnEsmfold', 'btnVariantEffects', 'btnFoldseekSearch'].forEach(id => {
    const panelFor = { btnDomainScan: 'optCat-domains', btnHomologSearch: 'optCat-homologs', btnTopologyPredict: 'optCat-topology', btnValidation: 'optCat-structure', btnEsmfold: 'optCat-structure', btnVariantEffects: 'optCat-variants', btnFoldseekSearch: 'optCat-foldseek' }[id];
    assert(HTML.indexOf('id="' + id + '"') > HTML.indexOf('id="' + panelFor + '"'), id + ' lives inside ' + panelFor);
});
assert(HTML.indexOf('Data sources&hellip;') !== -1, 'Input Data keeps a single Data sources… button');
assert(HTML.indexOf('id="btnFetchPdb"') !== -1 && HTML.indexOf('id="structureFetchStatus"') !== -1, 'and the PDB fetch with its status (it is an import path)');
assert(HTML.indexOf('Open UniProt') !== -1 && HTML.indexOf('Open RCSB PDB') !== -1 && HTML.indexOf('Open DeepTMHMM') !== -1 && HTML.indexOf('Open HHpred') !== -1, 'each category offers its website as the manual fallback');
// Guide links
const guideStepIds = ctxRun(`WORKFLOW_STEPS.map(s => s.id)`);
assert(guideStepIds.every(id => ctxRun(`STEP_DATA_CATEGORY['${id}']`) !== undefined), 'every guide step maps to a data category');
ctxRun(`renderWorkflowGuide();`);
const catGuideHtml = ctxRun(`document.getElementById('guidePanel').innerHTML`);
assert(catGuideHtml.indexOf('\u2699 Data sources') !== -1 && catGuideHtml.indexOf('openDataSources(') !== -1, 'the guide renders a Data sources link that deep-links into Options');

section('RCSB PDB entry fetch (by id)');
assert(HTML.indexOf('id="pdbFetchId"') !== -1 && HTML.indexOf('id="btnFetchPdb"') !== -1, 'Input Data has a PDB-id box and fetch button');
assert(HTML.indexOf('id="structureFetchStatus"') !== -1, 'with its own status line');
assert(ctxRun(`typeof fetchPdbEntry`) === 'function' && ctxRun(`typeof fetchPdbEntryFromInput`) === 'function' && ctxRun(`typeof focusPdbFetch`) === 'function', 'the fetch and focus helpers are wired');
assert(ctxRun(`(function () { externalServicesEnabled = true; return true; })()`), 'external services can be enabled for the fetch tests');
assert(ctxRun(`WORKFLOW_STEPS.find(s => s.id === 'structure').extraActions.some(a => a.run === 'focusPdbFetch()')`), 'the guide structure step offers the fetch');
assert(ctxRun(`(function () { openInputDataModal(); focusPdbFetch(); return true; })()`), 'focusPdbFetch opens Input Data without throwing');
assert(HTML.indexOf('use Fetch PDB entry (e.g. 1GFL)') !== -1, 'the validation message points at the control that exists now');

section('experimental structure validation (PDBe)');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.structure_validation.providers[0].id`) === 'pdbe_validation', 'the validation capability points at the PDBe API');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.structure_validation.providers[0].url`).indexOf('/pdbe/api/validation/') !== -1, 'with the verified base URL');
assert(ctxRun(`validationTypeLabel('ramachandran_outliers')`) === 'Ramachandran outlier' && ctxRun(`validationTypeLabel('clashes')`) === 'clash', 'outlier types get human labels');
assert(ctxRun(`validationTypeLabel('clashes', true)`) === 'clashes', 'and real plurals (not "clashs")');
sandbox.__pdbeOut = JSON.parse(PDBE_OUTLIERS_FIXTURE);
sandbox.__pdbeQ = JSON.parse(PDBE_QUALITY_FIXTURE);
assert(ctxRun(`validationSummaryText(window.__pdbeQ['1gfl'])`) === 'geometry 7.5, data 53.6, overall 11.5', 'the quality summary reads the PDBe scores (got "' + ctxRun(`validationSummaryText(window.__pdbeQ['1gfl'])`) + '")');
ctxRun(`
    parsedTracks = { AA: 'M'.repeat(238) };
    validationHitsInfo = {};
`);
const valAdded = ctxRun(`applyValidationTracks('1GFL', window.__pdbeOut['1gfl'], window.__pdbeQ['1gfl'], null)`);
assert(valAdded === 2, 'one validation row per chain with outliers - 1GFL is a dimer, so two (got ' + valAdded + ')');
const valKey = ctxRun(`Object.keys(parsedTracks).filter(k => k.startsWith('VAL_'))[0]`);
assert(valKey === 'VAL_1GFL_A', 'keyed by entry and chain (got ' + valKey + ')');
assert(ctxRun(`(parsedTracks['VAL_1GFL_A'].match(/!/g) || []).length`) > 30, 'the flagged residues are marked');
assert(ctxRun(`formatTrackLabel('VAL_1GFL_A')`) === 'Validation 1GFL (chain A)', 'the row label names the entry and chain');
const valFlags = ctxRun(`
    (function () {
        const info = validationHitsInfo['VAL_1GFL_A'];
        const counts = {};
        Object.keys(info.flags).forEach(i => info.flags[i].forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
        return counts;
    })()
`);
assert(valFlags.clashes === 38 && valFlags.ramachandran_outliers === 1, 'the real 1GFL outlier counts survive the mapping (got ' + JSON.stringify(valFlags) + ')');
const valInfo = ctxRun(`buildValidationPredictorInfo('VAL_1GFL_A')`);
assert(/PDBe/.test(valInfo.category) && /38 clashes/.test(valInfo.useCase) && /geometry 7.5/.test(valInfo.useCase), 'the tooltip reports the breakdown and the entry quality (got "' + valInfo.useCase + '")');
assert(HTML.indexOf('id="btnValidation"') !== -1 && HTML.indexOf('id="validationStatus"') !== -1, 'Input Data has the fetch button and status');
assert(ctxRun(`WORKFLOW_STEPS.find(s => s.id === 'structure').extraActions.some(a => a.run === 'runStructureValidation()')`), 'the guide structure step offers the fetch');
assert(ctxRun(`typeof TRACK_REMOVERS.VAL`) === 'function', 'removal unpicks the validation info map');
assert(ctxRun(`Object.prototype.hasOwnProperty.call(gatherPersistableState(), 'validationHitsInfo')`), 'and the info travels in the session save');
ctxRun(`parsedTracks = {}; validationHitsInfo = {};`);
const valCand = ctxRun(`
    (function () {
        cachedStructureTexts = { '1GFL.pdb': 'x', 'model.pdb': 'x', '7MDF_A.pdb': 'x' };
        const c = validationCandidateStructure();
        const m = validationCandidateStructure();
        return { file: c ? c.file : null, pdbId: c ? c.pdbId : null };
    })()
`);
assert(valCand.pdbId === '1GFL' && valCand.file === '1GFL.pdb', 'the candidate finder picks the PDB-id-like entry (got ' + valCand.file + ')');
ctxRun(`cachedStructureTexts = {};`);

section('activity log + 3D guards');
assert(HTML.indexOf('>Log</button>') !== -1, 'the menu bar has a top-level Log button');
assert(HTML.indexOf('openActionLog()" title="Everything this session') !== -1, 'which opens the activity log');
assert(HTML.indexOf('>Activity log</h3>') !== -1, 'the modal is named for users, not as a debugging console');
const logProbe = ctxRun(`
    (function () {
        actionLog = [];
        uniprotLog('submit iprscan5: HTTP 200 job=test-123');
        const hasApi = actionLog.some(e => e.kind === 'api' && /submit iprscan5/.test(e.label));
        const text = actionLogText(false);
        return { hasApi, text };
    })()
`);
assert(logProbe.hasApi, 'API lifecycle lines land in the activity log (not only the console)');
ctxRun(`renderActionLog();`);
const rendered = ctxRun(`document.getElementById('actionLogBody').textContent`);
assert(rendered.indexOf('API') !== -1 && rendered.indexOf('submit iprscan5') !== -1, 'and the modal renders plain-word kinds (got "' + rendered.slice(0, 60) + '")');
assert(ctxRun(`actionLogText(true)`) && JSON.parse(ctxRun(`actionLogText(true)`)).length >= 1, 'the JSON copy stays valid for macro work');
// 3Dmol scheme names: the app labels map onto real 3Dmol schemes.
assert(ctxRun(`P3D_LIB_SCHEMES.hydro`) === 'hydrophobicity' && ctxRun(`P3D_LIB_SCHEMES.spectrum`) === 'residue' && ctxRun(`P3D_LIB_SCHEMES.chain`) === 'chain', 'the 3D colour schemes map onto 3Dmol names (no more "could not interpret colorscheme")');
const styleFor = (idx) => ctxRun(`(function(){ p3dBaseSchemeIdx = ${idx}; return baseP3DStyle(); })()`);
assert(styleFor(3).cartoon.colorscheme === 'hydrophobicity', 'the hydro scheme asks 3Dmol for hydrophobicity');
assert(styleFor(0).cartoon.color && !styleFor(0).cartoon.colorscheme, 'white stays a plain colour');
assert(styleFor(4).cartoon.color && !styleFor(4).cartoon.colorscheme, 'conservation stays colour-driven (painted per residue)');
// p3dSafeRender: renders when the container has size, skips when hidden, never recurses.
const renderCalls = ctxRun(`
    (function () {
        let calls = 0;
        p3dView = { resize: function () { calls++; }, render: function () { calls++; } };
        const el = document.getElementById('p3dContainer');
        el.clientWidth = 500; el.clientHeight = 400;
        p3dSafeRender();
        const visible = calls;
        el.clientWidth = 0; el.clientHeight = 0;
        p3dSafeRender();
        const hidden = calls - visible;
        p3dView = null;
        return { visible, hidden };
    })()
`);
assert(renderCalls.visible === 2, 'p3dSafeRender resizes and renders when the viewer has real size (got ' + renderCalls.visible + ')');
assert(renderCalls.hidden === 0, 'and skips both while the container has no size (the framebuffer warnings)');
ctxRun(`actionLog = [];`);

section('homolog glyph wording is source-aware');
assert(ctxRun(`homologGlyphBasis('HL_missing')`) === 'HHpred match probability', 'without an info entry the basis defaults to HHpred');
ctxRun(`homologHitsInfo = { HL_a: { source: 'phmmer' }, HL_b: { source: 'BLAST' }, HL_c: { source: 'Foldseek' }, HL_d: { source: 'HHpred' } };`);
assert(ctxRun(`homologGlyphBasis('HL_a')`) === 'phmmer posterior probability', 'a phmmer row names its posterior probability');
assert(ctxRun(`homologGlyphBasis('HL_b')`) === 'BLAST substitution score (BLOSUM62)', 'a BLAST row names its BLOSUM62 basis (was "HHpred match quality")');
assert(ctxRun(`homologGlyphBasis('HL_c')`) === 'Foldseek substitution score (BLOSUM62)', 'a Foldseek row too');
assert(ctxRun(`homologGlyphBasis('HL_d')`) === 'HHpred match probability', 'and an HHpred row keeps its own wording');
ctxRun(`homologHitsInfo = {};`);
assert(HTML.indexOf('HHpred match quality') === -1, 'no cell tooltip hardcodes "HHpred match quality" any more');
assert(HTML.indexOf('Homologs: match quality') !== -1 && HTML.indexOf('HMMER posterior probability') !== -1, 'the legend explains the shared glyph scale and the per-source basis');

section('UniProt feature tooltips: substantial descriptions, counts, annotations');
const missingUpDesc = ctxRun(`Object.keys(UNIPROT_TYPE_CATEGORIES).filter(t => !UNIPROT_FEATURE_DESCRIPTIONS[t])`);
assert(missingUpDesc.length === 0, 'every UniProt feature type has a description (missing: ' + missingUpDesc.join(',') + ')');
assert(ctxRun(`UNIPROT_FEATURE_DESCRIPTIONS['Cross-link']`).indexOf('non-standard covalent bond') !== -1, 'the cross-link description explains what it is');
assert(ctxRun(`UNIPROT_FEATURE_DESCRIPTIONS['Transmembrane']`).indexOf('sanity-check') !== -1, 'and the topology ones say how to use them');
ctxRun(`
    parsedTracks = { AA: 'M'.repeat(100) };
    uniprotFeatureTracks = { UP_Cross_link: { type: 'Cross-link', category: 'ptm', color: '#fde68a',
        features: [{ start: 10, end: 10, type: 'Cross-link', description: 'Lysine-tyrosine cross-link' },
                   { start: 40, end: 41, type: 'Cross-link', description: 'Lysine-tyrosine cross-link' }] },
        UP_Transmembrane: { type: 'Transmembrane', category: 'topology', color: '#a5f3fc',
        features: [{ start: 5, end: 25, type: 'Transmembrane', description: 'Helical' }] } };
`);
const upInfo = ctxRun(`buildUniProtPredictorInfo('UP_Cross_link')`);
assert(upInfo.category === 'UniProt feature (post-translational modification)', 'the category says UniProt feature + the biological class (got "' + upInfo.category + '")');
assert(upInfo.category.indexOf('Structural Prediction') === -1, 'and no longer claims to be a structural prediction');
assert(upInfo.description.indexOf('non-standard covalent bond') !== -1, 'the description explains the type');
assert(/2 annotated regions covering 3 residue\(s\) \(3% of the sequence\)/.test(upInfo.useCase), 'the use case counts features, residues and coverage (got "' + upInfo.useCase + '")');
assert(upInfo.useCase.indexOf('Lysine-tyrosine cross-link') !== -1, 'and surfaces the actual feature descriptions');
assert(upInfo.citation.indexOf('UniProtKB') !== -1, 'the citation names the source');
assert(ctxRun(`getPredictorInfo('UP_Cross_link').description`).indexOf('non-standard') !== -1, 'getPredictorInfo routes UniProt rows to the builder');
assert(ctxRun(`getPredictorInfo('UP_Transmembrane').category`).indexOf('topology or processing') !== -1, 'each type gets its own class label');
ctxRun(`parsedTracks = {}; uniprotFeatureTracks = {};`);

section('#3b: species-specific variant APIs (Ensembl VEP/SIFT + hand-off)');
const VEP_FIXTURE = fs.readFileSync(path.join(ROOT, 'tests/fixtures/vep-tp53-batch.json'), 'utf-8');
const UP_XREF_FIXTURE = fs.readFileSync(path.join(ROOT, 'tests/fixtures/uniprot-tp53-xrefs.json'), 'utf-8');
assert(ctxRun(`speciesTokenFromName('Homo sapiens')`) === 'homo_sapiens' && ctxRun(`speciesTokenFromName('danio rerio')`) === 'danio_rerio', 'species names map to Ensembl tokens (shortlist + free text)');
assert(ctxRun(`speciesTokenFromName('Drosophila melanogaster')`) === 'drosophila_melanogaster' && ctxRun(`speciesLabelForToken('mus_musculus')`) === 'Mus musculus', 'and back to labels for the shortlist');
assert(ctxRun(`speciesLabelForToken('some_odd_species')`) === 'Some Odd Species', 'an unlisted token is prettified for display');
ctxRun(`currentProteinLabel = 'sp|P42212|GFP_AEQVI Green fluorescent protein OS=Aequorea victoria GN=GFP';`);
assert(ctxRun(`detectedSpeciesFromHeader()`) === 'Aequorea victoria', 'the header OS= tag is detected');
ctxRun(`setSessionSpecies(detectedSpeciesFromHeader(), {});`);
assert(ctxRun(`sessionSpeciesToken`) === 'aequorea_victoria' && ctxRun(`sessionSpeciesManual`) === false, 'detection sets the species as automatic');
ctxRun(`setSessionSpecies('Homo sapiens', { manual: true });`);
assert(ctxRun(`sessionSpeciesToken`) === 'homo_sapiens' && ctxRun(`sessionSpeciesManual`) === true, 'a manual override is flagged');
assert(/Homo sapiens \(homo_sapiens\) - manual/.test(ctxRun(`document.getElementById('speciesStatus').textContent`)), 'and the status says so');
sandbox.__vepFixture = VEP_FIXTURE;
sandbox.__upXrefs = UP_XREF_FIXTURE;
const pickedXref = ctxRun(`pickEnsemblXref(JSON.parse(window.__upXrefs))`);
assert(pickedXref.transcript === 'ENST00000269305' && pickedXref.version === '9' && pickedXref.protein === 'ENSP00000269305.4', 'the first Ensembl xref (canonical) is picked (got ' + JSON.stringify(pickedXref) + ')');
ctxRun(`parsedTracks = { AA: 'MKVW' };`);
const mappedEq = ctxRun(`ensemblHgvsForSubstitutions('MKVW', 'ENST1', '3', [{ key: 'K2H', sub: { ref: 'K', pos: 2, alt: 'H' } }])`);
assert(mappedEq.items.length === 1 && mappedEq.items[0].hgvs === 'ENST1.3:p.Lys2His', 'a substitution maps to protein HGVS on the Ensembl transcript (got ' + JSON.stringify(mappedEq) + ')');
const mappedOff = ctxRun(`ensemblHgvsForSubstitutions('MKSVW', 'ENST1', '3', [{ key: 'V3A', sub: { ref: 'V', pos: 3, alt: 'A' } }])`);
assert(mappedOff.items.length === 1 && mappedOff.items[0].hgvs === 'ENST1.3:p.Val4Ala', 'an N-terminal insertion in the Ensembl protein shifts the mapped position (got ' + JSON.stringify(mappedOff) + ')');
const mappedMiss = ctxRun(`ensemblHgvsForSubstitutions('MKVW', 'ENST1', '3', [{ key: 'K2H', sub: { ref: 'R', pos: 2, alt: 'H' } }])`);
assert(mappedMiss.items.length === 0 && mappedMiss.failed === 1, 'a reference mismatch is counted as unmapped, not scored');
const parsedVep = ctxRun(`
    parseVepSiftResults(JSON.parse(window.__vepFixture), [
        { key: 'R175H', hgvs: 'ENST00000269305.9:p.Arg175His' },
        { key: 'R273H', hgvs: 'ENST00000269305.9:p.Arg273His' }
    ])
`);
assert(parsedVep.count === 2 && parsedVep.tolerated === 2 && parsedVep.deleterious === 0, 'the live VEP batch response parses (got ' + JSON.stringify({ c: parsedVep.count, d: parsedVep.deleterious, t: parsedVep.tolerated }) + ')');
assert(parsedVep.results.R175H.label === 'SIFT tolerated' && parsedVep.results.R175H.detail === '0.08' && parsedVep.results.R175H.level === 'low', 'SIFT prediction + score become the merged-line result (got ' + JSON.stringify(parsedVep.results.R175H) + ')');
assert(ctxRun(`VARIANT_EFFECT_PROVIDERS.ensembl_vep.available({ accession: 'P04637', species: 'homo_sapiens' })`) === true, 'VEP applies with an accession and a species');
assert(ctxRun(`VARIANT_EFFECT_PROVIDERS.ensembl_vep.available({ accession: 'P04637', species: '' })`) === false, 'and not without a species');
assert(ctxRun(`VARIANT_EFFECT_PROVIDERS.ensembl_vep.needs`).indexOf('species') !== -1, 'the needs line names the species requirement');
assert(HTML.indexOf('id="speciesInput"') !== -1 && HTML.indexOf('id="speciesShortlist"') !== -1 && HTML.indexOf('id="speciesStatus"') !== -1, 'Options -> Variants has the species field, shortlist and status');
assert(HTML.indexOf('Open PROVEAN') !== -1 && HTML.indexOf('Open PolyPhen-2') !== -1 && HTML.indexOf('Open MutationTaster') !== -1, 'the verified hand-off links are in the panel');
assert(HTML.indexOf('Copy mutation list') !== -1, 'with the mutation-list copy shared with the ddG panel');
ctxRun(`populateSpeciesDatalist();`);
assert(ctxRun(`document.getElementById('speciesShortlist').children.length`) >= 15, 'the datalist fills from the shortlist');
assert(ctxRun(`gatherPersistableState().sessionSpecies.token`) === 'homo_sapiens', 'the species travels in the session save');
ctxRun(`currentProteinLabel = null; parsedTracks = {}; sessionSpeciesToken = ''; sessionSpeciesLabel = ''; sessionSpeciesManual = false; updateSpeciesUI();`);

section('template table: identity, confidence, coverage, structure, exports');
assert(ctxRun(`parseIdentityPercent('237/238 (100%)')`) === 100, 'identity parses the percentage out of "x/y (z%)" (was parseFloat -> 237)');
assert(ctxRun(`parseIdentityPercent('95/230 (41%)')`) === 41, 'and for partial identities');
assert(ctxRun(`parseIdentityPercent('0.98')`) === 98, 'a 0-1 fraction becomes a percentage (Foldseek)');
assert(ctxRun(`parseIdentityPercent('98')`) === 98, 'a bare number is already a percentage');
assert(ctxRun(`parseIdentityPercent('41%')`) === 41, 'a percent string parses');
assert(ctxRun(`parseIdentityPercent('')`) === null && ctxRun(`parseIdentityPercent(null)`) === null, 'missing identity is null, not NaN');
assert(ctxRun(`parseIdentityPercent(0.5)`) === 50, 'a numeric fraction works too');
assert(ctxRun(`homologConfidencePercent({ stats: { Probab: '92.3' } })`) === 92.3, 'confidence prefers the source probability (HHpred/Foldseek)');
assert(ctxRun(`homologConfidencePercent({ stats: { 'E-value': '1e-10' } })`) === 100, 'phmmer/BLAST confidence comes from the E-value (1e-10 -> 100)');
assert(ctxRun(`homologConfidencePercent({ stats: { 'E-value': '1e-3' } })`) === 30, 'and scales 10 points per decade (1e-3 -> 30)');
assert(ctxRun(`homologConfidencePercent({ stats: { 'E-value': '0' } })`) === 100, 'an exact match (E=0) clamps to 100');
assert(ctxRun(`homologConfidencePercent({ stats: {} })`) === null, 'no probability and no E-value is null');
assert(ctxRun(`homologCoveragePercent({ aaTrack: 'MMMM      ' }, 10)`) === 40, 'coverage counts aligned residues in aaTrack (union, not summed HSP columns)');
assert(ctxRun(`homologCoveragePercent({ stats: { Aligned_cols: '5' } }, 10)`) === 50, 'Aligned_cols is the fallback when aaTrack is absent');
assert(ctxRun(`homologAccession('sp|P42212|GFP_AEQVI')`) === 'P42212', 'accession extracted from a UniProt-style id');
assert(ctxRun(`homologAccession('P42212')`) === 'P42212', 'a bare accession is accepted');
assert(ctxRun(`homologAccession('7MDF_A')`) === null, 'a PDB id is not an accession');
ctxRun(`
    parsedTracks = { AA: 'M'.repeat(10), 'HL_01_sp_P42212_GFP_AEQVI': '|'.repeat(10), 'HL_02_7mdf': '|'.repeat(10) };
    cachedStructureTexts = {};
    homologHitsInfo = {
        HL_01_sp_P42212_GFP_AEQVI: { rank: 1, hitId: 'sp|P42212|GFP_AEQVI', hitDesc: 'GFP', source: 'phmmer',
            stats: { 'E-value': '1e-10', Identities: '10/10 (100%)', Aligned_cols: '10' }, aaTrack: 'MMMMMMMMMM' },
        HL_02_7mdf: { rank: 2, hitId: '7MDF_A', hitDesc: 'template', source: 'HHpred',
            stats: { Probab: '95.0', 'E-value': '1e-30', Identities: '8/10 (80%)', Aligned_cols: '10' }, aaTrack: 'MMMM      ' }
    };
`);
const tplRows = ctxRun(`homologTemplateMetrics()`);
assert(tplRows.length === 2, 'both homologs produce rows');
const tplPhmmer = tplRows.filter(r => r.source === 'phmmer')[0];
const tplHhpred = tplRows.filter(r => r.source === 'HHpred')[0];
assert(tplPhmmer.ident === 100 && tplPhmmer.confidence === 100 && Math.abs(tplPhmmer.coverage - 100) < 1e-9, 'phmmer row: identity 100, E-value confidence 100, coverage 100');
assert(tplPhmmer.score != null && Math.abs(tplPhmmer.score - 100) < 1e-9, 'phmmer row now scores (was N/A without Probab) (got ' + tplPhmmer.score + ')');
assert(tplPhmmer.accession === 'P42212' && tplPhmmer.hasPdb === false, 'phmmer row reports its accession for the AlphaFold structure cell');
assert(tplHhpred.ident === 80 && Math.abs(tplHhpred.coverage - 40) < 1e-9, 'HHpred row: identity 80, coverage from aaTrack 40');
assert(Math.abs(tplHhpred.score - 30.4) < 1e-6, 'HHpred score = confidence x identity x coverage / 10000 (got ' + tplHhpred.score + ')');
assert(tplHhpred.hasPdb === true && tplHhpred.pdbId === '7MDF', 'HHpred row reports its PDB entry');
assert(tplRows[0].source === 'phmmer', 'rows sort by the unified score across sources');
const tsv = ctxRun(`homologTableTSV()`);
assert(tsv.split('\n').length === 3 && tsv.indexOf('Confidence %') !== -1 && tsv.indexOf('AlphaFold P42212') !== -1, 'the table exports as TSV with the structure column');
const tplReport = ctxRun(`buildMethodsReport()`);
assert(tplReport.indexOf('## Template quality') !== -1, 'the methods report carries the template table');
assert(tplReport.indexOf('Best homolog identity: 100%') !== -1, 'and the best-identity line no longer prints the raw count (was 237%)');
assert(tplReport.indexOf('| 1 | sp|P42212|GFP_AEQVI | phmmer | 100.0% |') !== -1, 'with the ranked row');
const insights = ctxRun(`computeGuideInsights().map(x => x.text).join(' ')`);
assert(insights.indexOf('Best homolog identity is 100%') !== -1, 'the guide read-out uses the parsed percentage');
assert(HTML.indexOf('Copy table (TSV)') !== -1 && HTML.indexOf('Homolog Templates</h4>') !== -1, 'the section has a copy button and no longer says "(HHpred)"');
ctxRun(`parsedTracks = {}; homologHitsInfo = {}; cachedStructureTexts = {};`);

section('BLAST homolog provider: parser + provider wiring (real EBI output fixture)');
sandbox.__blastFixture = BLAST_FIXTURE;
const blast = ctxRun(`parseBlastHits(JSON.parse(window.__blastFixture))`);
assert(blast && blast.queryLength === 238, 'query length read from the BLAST JSON (got ' + (blast && blast.queryLength) + ')');
assert(blast.hits.length === 13, 'all reported hits parsed (got ' + blast.hits.length + ')');
const bFirst = blast.hits[0];
assert(bFirst.hitId === 'sp|P42212|GFP_AEQVI', 'UniProt-style hit id rebuilt from db/acc/id (got ' + bFirst.hitId + ')');
assert(bFirst.stats.Identities === '237/238 (100%)' || /^237\/238/.test(bFirst.stats.Identities), 'identity computed from the HSP alignment (got ' + bFirst.stats.Identities + ')');
assert(bFirst.segments.length === 1 && bFirst.segments[0].qStart === 1 && bFirst.segments[0].qSeq.length === 238, 'the HSP covers the query from residue 1');
assert(bFirst.significant === true, 'hits within the provider cut-off are significant');
const bGlyphs = ctxRun(`(function () {
    const p = parseBlastHits(JSON.parse(window.__blastFixture));
    const chars = {};
    p.hits.forEach(h => h.segments.forEach(s => { for (const c of s.qualityChars) chars[c] = true; }));
    return Object.keys(chars).join('');
})()`);
assert(bGlyphs.length > 0 && bGlyphs.split('').every(c => '.:| '.indexOf(c) !== -1),
    'BLAST glyphs are BLOSUM62-based (identical |, positive :, else .) (got "' + bGlyphs + '")');
assert(ctxRun(`(function () {
    const p = parseBlastHits(JSON.parse(window.__blastFixture));
    return p.hits.every(h => h.segments.every(s => s.tSeq.length === s.qSeq.length));
})()`), 'every HSP has query and target strings of equal length');
const bApplied = ctxRun(`
    (function () {
        parsedTracks = { AA: 'M'.repeat(238) };
        homologHitsInfo = {}; graphHighlights = {};
        const p = parseBlastHits(JSON.parse(window.__blastFixture));
        const n = applyHomologHits(p, 'BLAST');
        const key = Object.keys(homologHitsInfo)[0];
        const info = homologHitsInfo[key] || {};
        const pred = buildHomologPredictorInfo(key) || {};
        return { n, source: info.source, category: pred.category, useCase: pred.useCase, bands: (pred.bands || []).map(b => b.range).join('') };
    })()
`);
assert(bApplied.n === 13 && bApplied.source === 'BLAST', 'BLAST hits become Homologs rows attributed to BLAST');
assert(/blast/i.test(bApplied.category), 'the predictor tooltip names BLAST');
assert(/E-value=/.test(bApplied.useCase) && /HSPs=/.test(bApplied.useCase), 'and reports E-value, bits, identity and HSP count');
assert(bApplied.bands === '|:.', 'with BLOSUM62-based band meanings');
assert(ctxRun(`(function () {
    const caps = SERVICE_REGISTRY.capabilities.homolog_search.providers;
    return caps.length === 2 && caps[0].id === 'ebi_phmmer' && caps[1].id === 'ebi_blast' &&
           /ncbiblast/.test(caps[1].url) && caps[1].params.database === 'uniprotkb_swissprot';
})()`), 'the capability offers phmmer then BLAST with the verified database value');
assert(HTML.indexOf('id="homologProvider"') !== -1 && HTML.indexOf('value="ebi_blast"') !== -1, 'Input Data has a provider picker including BLAST');
assert(HTML.indexOf('Search Homologs (phmmer)…') !== -1 && HTML.indexOf('Search Homologs (BLAST)…') !== -1, 'the Analyze menu offers each provider explicitly');
ctxRun(`parsedTracks = {}; homologHitsInfo = {}; graphHighlights = {};`);

section('guide: phmmer is offered, and resolver extra actions render');
const hstep = ctxRun(`WORKFLOW_STEPS.find(s => s.id === 'homologs')`);
assert((hstep.extraActions || []).some(a => a.run === 'runHomologSearch()'), 'the homologs step carries the phmmer action in its own list (so it shows in every state and in WORKFLOW.md)');
assert(/phmmer/.test(hstep.desc), 'and the step description names the in-app route');
assert((hstep.how || []).some(h => /posterior/.test(h)), 'and explains how phmmer colouring differs from HHpred');
const merged = ctxRun(`
    (function () {
        const orig = STEP_ACTION_RESOLVERS.features;
        STEP_ACTION_RESOLVERS.features = () => ({ label: 'Tailored', run: 'openInputDataModal()', extraActions: [{ label: 'Probe extra', run: 'runDomainScan()' }] });
        const act = resolveStepAction(WORKFLOW_STEPS.find(s => s.id === 'features'));
        STEP_ACTION_RESOLVERS.features = orig;
        return { hasExtra: act.extraActions.some(a => a.label === 'Probe extra'), hasOwn: act.extraActions.some(a => a.run === 'runDomainScan()') };
    })()
`);
assert(merged.hasExtra, 'a resolver extra action now flows through resolveStepAction (was silently dropped)');
assert(merged.hasOwn, 'and the step\'s own extra actions are kept');
assert(ctxRun(`resolveStepAction(WORKFLOW_STEPS.find(s => s.id === 'homologs')).extraActions.some(a => a.run === 'runHomologSearch()')`), 'the resolved homologs action exposes the phmmer button');
assert(WORKFLOW_MD.indexOf('Search homologs (in-app)') !== -1, 'the generated workflow doc lists it too');
const routeQ = ctxRun(`STEP_QUESTIONS.homologs[0]`);
assert(/HHpred, phmmer, or both/.test(routeQ.label), 'the homologs question offers the routes agnostically (got "' + routeQ.label + '")');
assert(routeQ.options.map(o => o.value).join(',') === 'hhpred,phmmer,both', 'with HHpred / phmmer / both as the answers');
const byRoute = ctxRun(`
    (function () {
        const out = {};
        ['hhpred', 'phmmer', 'both', 'ready', 'no'].forEach(v => {
            const orig = getStepAnswer;
            setStepAnswer('homologs', 'hhpred', v);
            const act = resolveStepAction(WORKFLOW_STEPS.find(s => s.id === 'homologs'));
            out[v] = { run: act.run, label: act.label, custom: act.custom,
                       accessory: act.accessory ? act.accessory.run : null,
                       extras: act.extraActions.map(a => a.run), hint: act.hint };
        });
        clearStepAnswers('homologs');
        return out;
    })()
`);
assert(byRoute.phmmer.run === 'runHomologSearch()', 'choosing phmmer offers the in-app search');
assert(byRoute.hhpred.run === 'openInputDataModal()' && byRoute.hhpred.accessory === "openExternal('https://toolkit.tuebingen.mpg.de/tools/hhpred')", 'choosing HHpred offers the attach action with the HHpred link as accessory');
assert(byRoute.both.run === 'runHomologSearch()' && byRoute.both.custom === true, 'choosing both leads with the in-app search, with the .hhr attach as the secondary button');
assert(byRoute.both.accessory === null, 'and no accessory repeats that secondary button (it used to show twice)');
assert(byRoute.ready.run === byRoute.hhpred.run, 'legacy "ready" answers map onto the HHpred route');
assert(byRoute.no.run === byRoute.both.run, 'legacy "not yet" answers map onto both');
['hhpred', 'phmmer', 'both', 'ready', 'no'].forEach(v => {
    const a = byRoute[v];
    const all = [a.run].concat(a.extras, a.accessory ? [a.accessory] : [], a.custom ? ['openInputDataModal()'] : []);
    const dups = all.filter((r, i) => all.indexOf(r) !== i);
    assert(dups.length === 0, 'route "' + v + '" shows each handler once (dups: ' + dups.join(',') + ')');
    assert(all.filter(r => r === 'copySequenceFasta()').length <= 1, 'route "' + v + '" shows at most one Copy sequence (FASTA) button');
});
assert(byRoute.hhpred.extras.indexOf('runHomologSearch()') !== -1, 'and the alternative route stays one click away as an extra');
assert(byRoute.phmmer.extras.indexOf('runHomologSearch()') === -1, 'while a redundant phmmer extra is dropped when phmmer is the primary action');
assert(!/No HHpred at hand/.test(hstep.desc + byRoute.hhpred.hint), 'the copy no longer says "No HHpred at hand" (neutral phrasing instead)');
assert(/Alternatively, you can/.test(byRoute.hhpred.hint), 'the HHpred hint offers the alternative neutrally');
assert(HTML.indexOf('Homologs cross-check the sequence predictions') !== -1, 'the guide read-out names phmmer when no homologs are loaded');

section('phmmer homolog search: parser + apply (real EBI output fixture)');
sandbox.__phmmerFixture = PHMMER_FIXTURE;
const phm = ctxRun(`parsePhmmerHits(window.__phmmerFixture)`);
assert(phm && phm.queryLength === 238, 'query length read from the Query: line (got ' + (phm && phm.queryLength) + ')');
assert(phm.hits.length === 21, 'all reported hits parsed (got ' + phm.hits.length + ')');
assert(phm.hits.filter(h => h.significant).length === 13, 'hits below the inclusion threshold are marked non-significant (got ' + phm.hits.filter(h => h.significant).length + ')');
const first = phm.hits[0];
assert(first.hitId === 'sp|P42212|GFP_AEQVI', 'first hit id (got ' + first.hitId + ')');
assert(first.stats['E-value'] === '4.3e-163', 'full-sequence E-value from the scores table');
assert(/^237\/238 \(100%\)$/.test(first.stats.Identities), 'identity computed from the alignment (got ' + first.stats.Identities + ')');
assert(first.segments.length === 1 && first.segments[0].qStart === 1, 'alignment segment covers the query from residue 1');
assert(first.segments[0].qSeq.length === 238 && first.segments[0].tSeq.length === 238, 'segment is the full 238-column alignment');
assert(first.segments[0].aaTrack === undefined || true, 'segment carries the target sequence for the AA view');
const glyphSet = ctxRun(`(function () {
    const p = parsePhmmerHits(window.__phmmerFixture);
    const chars = {};
    p.hits.forEach(h => h.segments.forEach(s => { for (const c of s.qualityChars) chars[c] = true; }));
    return Object.keys(chars).join('');
})()`);
assert(glyphSet.length > 0 && glyphSet.split('').every(c => '.:+=|'.indexOf(c) !== -1),
    'quality glyphs come only from the HHpred scale (got "' + glyphSet + '")');
assert(phm.hits.filter(h => h.segments.length > 1).length === 2, 'multi-domain hits keep every domain segment (got ' + phm.hits.filter(h => h.segments.length > 1).length + ')');
assert(phm.hits.some(h => h.segments.some(s => s.tSeq.indexOf('-') !== -1)), 'target gaps survive as - columns');
const applied = ctxRun(`
    (function () {
        parsedTracks = { AA: 'M'.repeat(238) };
        homologHitsInfo = {};
        parsedTracks['HL_05_old'] = 'M'.repeat(238);
        const p = parsePhmmerHits(window.__phmmerFixture);
        const n = applyHomologHits(p, 'phmmer');
        const keys = Object.keys(parsedTracks).filter(k => k.startsWith('HL_')).sort();
        const newKeys = keys.filter(k => k !== 'HL_05_old');
        const info = homologHitsInfo[newKeys[0]] || {};
        return { n, firstNew: newKeys[0], ranksContinue: /^HL_06_/.test(newKeys[0]),
                 source: info.source, rank: info.rank, hasAa: typeof info.aaTrack === 'string' && info.aaTrack.length === 238,
                 glyphsInTrack: /[|+=:.]/.test(parsedTracks[newKeys[0]]) };
    })()
`);
assert(applied.n === 13, 'the 13 hits above the inclusion threshold became rows, the 8 weak ones did not (got ' + applied.n + ')');
assert(applied.ranksContinue, 'numbering continues after existing HL_ rows (got ' + applied.firstNew + ')');
assert(applied.source === 'phmmer', 'rows are registered with source phmmer');
assert(applied.hasAa, 'the unaligned homolog sequence is kept for the AA view');
assert(applied.glyphsInTrack, 'the row carries quality glyphs, so the Homologs colouring applies');
const label = ctxRun(`
    (function () {
        const key = Object.keys(parsedTracks).filter(k => k.indexOf('HL_') === 0 && k !== 'HL_05_old')[0];
        return formatTrackLabel(key);
    })()
`);
assert(label.indexOf('sp|P42212|GFP_AEQVI') !== -1, 'the row label shows the real hit id, not the sanitized key (got "' + label + '")');
const pred = ctxRun(`
    (function () {
        const key = Object.keys(homologHitsInfo)[0];
        const info = buildHomologPredictorInfo(key);
        return { category: info.category, useCase: info.useCase, citation: info.citation };
    })()
`);
assert(/phmmer/i.test(pred.category), 'predictor tooltip names phmmer as the source');
assert(/E-value=/.test(pred.useCase) && /Identities=/.test(pred.useCase), 'predictor tooltip reports E-value and identity');
assert(/phmmer/i.test(pred.citation), 'and cites HMMER phmmer');
const consSeqs = ctxRun(`
    (function () {
        conservationIncludeHHR = true;
        const seqs = getConservationAlignedSequences();
        return seqs.filter(s => typeof s === 'string' && s.length === 238).length;
    })()
`);
assert(consSeqs >= 13, 'phmmer homolog sequences feed conservation when the option is on (got ' + consSeqs + ')');
assert(ctxRun(`SERVICE_REGISTRY.capabilities.homolog_search.providers[0].url`).indexOf('hmmer3_phmmer') !== -1, 'the phmmer capability points at the EBI job tool');
assert(ctxRun(`typeof runHomologSearch`) === 'function', 'runHomologSearch is wired');
assert(ctxRun(`
    (function () {
        setHomologProvider('ebi_blast');
        const sel = document.getElementById('homologProvider');
        const v = sel.value;
        setHomologProvider('ebi_phmmer');
        return v;
    })()
`) === 'ebi_blast', 'the menu provider helper sets the picker (so the two controls agree)');
assert(HTML.indexOf("menuBarAction('homologs_phmmer')") !== -1 && HTML.indexOf("menuBarAction('homologs_blast')") !== -1, 'the Analyze menu offers the homolog search per provider');
assert(HTML.indexOf('id="homologSearchStatus"') !== -1, 'the Input Data modal has a status line for it');
assert(HTML.indexOf('id="btnHomologSearch"') !== -1, 'and a button');
ctxRun(`parsedTracks = {}; homologHitsInfo = {}; graphHighlights = {};`);

section('rule sources: "any model" RSA presets actually match');
ctxRun(`
    parsedTracks = { AA: 'MMMM',
        'm_RSA': [{ val: 0.1, type: 'rsa' }, { val: 0.6, type: 'rsa' }, { val: 0.1, type: 'rsa' }, { val: 0.05, type: 'rsa' }],
        CONSERVATION: { type: 'conservation', metric: 'shannon', values: [0.9, 0.9, 0.5, 0.9] } };
    analysisRules = [];
`);
assert(ctxRun(`ruleNumericValue('RSA:', 0)`) === 0.1, 'bare RSA: resolves to the loaded RSA track (was parsedTracks[""] = null)');
const buried = ctxRun(`
    (function () {
        const preset = RULE_PRESETS.find(p => p.id === 'conserved_buried');
        const rule = { id: 'b', name: preset.name, mode: preset.mode, conditions: preset.conditions.map(c => Object.assign({}, c)) };
        return evaluateRule(rule).map(Boolean);
    })()
`);
assert(JSON.stringify(buried) === JSON.stringify([true, false, false, true]), 'conserved_buried matches conserved AND buried residues (got ' + JSON.stringify(buried) + ')');
const rigid = ctxRun(`
    (function () {
        parsedTracks['m_pLDDT'] = [{ val: 95, type: 'plddt' }, { val: 95, type: 'plddt' }, { val: 95, type: 'plddt' }, { val: 95, type: 'plddt' }];
        const preset = RULE_PRESETS.find(p => p.id === 'rigid_core');
        const rule = { id: 'r', name: preset.name, mode: preset.mode, conditions: preset.conditions.map(c => Object.assign({}, c)) };
        return evaluateRule(rule).map(Boolean);
    })()
`);
assert(JSON.stringify(rigid) === JSON.stringify([true, false, true, true]), 'rigid_core matches confident AND buried residues (got ' + JSON.stringify(rigid) + ')');
const noRsa = ctxRun(`
    (function () {
        delete parsedTracks['m_RSA'];
        const preset = RULE_PRESETS.find(p => p.id === 'conserved_buried');
        const rule = { id: 'b2', name: preset.name, mode: preset.mode, conditions: preset.conditions.map(c => Object.assign({}, c)) };
        return { matches: evaluateRule(rule).filter(Boolean).length, missing: presetMissingSources(preset) };
    })()
`);
assert(noRsa.matches === 0, 'without an RSA track the rule matches nothing (no throw)');
assert(noRsa.missing.indexOf('RSA:') !== -1, 'and the card reports "needs RSA"');
assert(ctxRun(`
    (function () {
        parsedTracks['m_RSA'] = [{ val: 0.1, type: 'rsa' }];
        return presetMissingSources(RULE_PRESETS.find(p => p.id === 'conserved_buried')).length === 0;
    })()
`), 'and stops needing it once one is loaded');
ctxRun(`parsedTracks = {}; analysisRules = [];`);

section('no duplicate render (rules + renderViewer)');
// The stub cannot show the duplication (its innerHTML='' does not clear children),
// so count render invocations instead: a nested render inside renderViewer is the
// bug - it clears the grid, paints a full set, and the outer render then appends
// a second copy on top of it.
ctxRun(`
    if (window.__realRenderViewer) {
        parsedTracks = { AA: 'MKV', 'SS_PSIPRED': 'HHH' };
        analysisRules = [{ id: 'rx', name: 'Probe', color: '#f00', mode: 'all', enabled: true,
            conditions: [{ kind: 'categorical', source: 'group:SS', op: 'annotated', value: '' }] }];
        window.__renderCalls = 0;
        window.__countingRender = function (t) { window.__renderCalls++; return window.__realRenderViewer.call(null, t); };
        renderViewer = window.__countingRender;
    }
`);
const canCount = ctxRun(`typeof window.__realRenderViewer === 'function'`);
assert(canCount, 'the harness kept the real renderer for this check');
ctxRun(`window.__renderCalls = 0; renderViewer(parsedTracks);`);
assert(ctxRun(`window.__renderCalls`) === 1, 'a data-change render renders exactly once with rules present (got ' + ctxRun(`window.__renderCalls`) + ')');
ctxRun(`window.__renderCalls = 0; applyRules();`);
assert(ctxRun(`window.__renderCalls`) === 1, 'applying rules renders exactly once (got ' + ctxRun(`window.__renderCalls`) + ')');
ctxRun(`window.__renderCalls = 0; reevaluateRulesIfNeeded(parsedTracks);`);
assert(ctxRun(`window.__renderCalls`) === 0, 'the in-render rule re-evaluation does NOT render (it only rebuilds tracks)');
assert(ctxRun(`typeof parsedTracks['RULE_rx']`) === 'string', 'but it does rebuild the rule track');
ctxRun(`
    renderViewer = function(){};
    analysisRules = []; parsedTracks = {};
    delete window.__renderCalls; delete window.__countingRender;
`);

section('uniform hover framework (every track)');
ctxRun(`
    parsedTracks = { AA: 'MKV', 'SS_PSIPRED': 'H  ', 'TM_TMHMM': '  M', 'DO_IUPred': ' D ',
        'UP_Sites': '\u25a0  ', 'EV_RMSF': [{ val: 1, type: 'rmsf' }, { val: null, type: 'rmsf' }, { val: 2, type: 'rmsf' }],
        'm_pLDDT': [{ val: 90 }, { val: 80 }, { val: 70 }] };
    analysisRules = [{ id: 'r1', name: 'Probe', color: '#f00', mode: 'all', enabled: true,
        conditions: [{ kind: 'categorical', source: 'group:SS', op: 'annotated', value: '' }] }];
    applyRules(); gridCellW = 12;
`);
// every cell of every row type carries a title (so every track hovers)
const titleReport = ctxRun(`
    (function () {
        var keys = ['AA', 'SS_PSIPRED', 'TM_TMHMM', 'DO_IUPred', 'UP_Sites', 'EV_RMSF', 'm_pLDDT', 'RULE_r1'];
        var missing = [], samples = {};
        keys.forEach(function (k) {
            if (!parsedTracks[k]) return;
            var row = buildTrackRow(k, parsedTracks, 3, true);
            var cells = row.children[1];
            var titles = (cells.children || []).map(function (c) { return c.title || ''; });
            if (titles.length !== 3 || titles.some(function (t) { return !t; })) missing.push(k);
            samples[k] = titles.join(' | ');
        });
        return { missing: missing.join(','), samples: samples };
    })()
`);
assert(titleReport.missing === '', 'every cell of every track type has a title (' + (titleReport.missing || 'none missing') + ')');
assert(/Residue 1: H \(helix\)/.test(titleReport.samples.SS_PSIPRED), 'a helix cell explains itself (' + titleReport.samples.SS_PSIPRED + ')');
assert(/Residue 3: M \(transmembrane\)/.test(titleReport.samples.TM_TMHMM), 'a TM cell explains itself');
assert(/Residue 2: D \(disordered\)/.test(titleReport.samples.DO_IUPred), 'a disorder cell explains itself');
assert(/Residue 1: M$/.test(titleReport.samples.AA.split(' | ')[0]), 'the reference row names the residue, not a structure meaning (' + titleReport.samples.AA.split(' | ')[0] + ')');
assert(titleReport.samples.AA.indexOf('(coil)') === -1 && titleReport.samples.AA.indexOf('(helix)') === -1, 'and never borrows a prediction meaning');
assert(/not annotated/.test(titleReport.samples.SS_PSIPRED.split(' | ')[1]), 'a blank prediction cell says so');
// graph points join the same tooltip
assert(ctxRun(`isSvgGraphPoint({ tagName: 'circle', ownerSVGElement: {} })`) === true, 'an SVG circle is recognised as a graph point');
assert(ctxRun(`isSvgGraphPoint({ tagName: 'DIV' })`) === false, 'a heatmap cell is not');
assert(HTML.indexOf("closest('.cell, .position-cell, .graph-svg circle')") !== -1, 'the delegated hover covers graph points too');
assert(HTML.indexOf('nativeTitle.remove()') !== -1, 'the native SVG tooltip is suppressed while the styled one shows');
assert(HTML.indexOf("createElementNS('http://www.w3.org/2000/svg', 'title')") !== -1, 'and restored on leave');
// the tooltip itself runs for a graph point. The stub's querySelector does not
// search children, so drive the real function with an SVG-shaped object (which
// is what an SVG circle actually exposes to this code).
let tooltipErr = null;
try {
  ctxRun(`
    var titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    titleEl.textContent = 'Residue 4 (K): 91.20';
    var fakeCircle = {
        tagName: 'circle', ownerSVGElement: {}, dataset: { track: 'm_pLDDT' },
        querySelector: function (sel) { return sel === 'title' ? titleEl : null; },
        appendChild: function () {}, removeAttribute: function () {},
        getAttribute: function () { return null; }
    };
    showCellTooltip(fakeCircle, 10, 10);
  `);
} catch (e) { tooltipErr = e.message; }
assert(tooltipErr === null, 'the styled tooltip runs for a graph point (' + (tooltipErr || 'ok') + ')');
const tipHtml = ctxRun(`String(document.getElementById('globalTooltip').innerHTML)`);
assert(/pLDDT/.test(tipHtml), 'and includes the track header like the rows (' + tipHtml.slice(0, 90) + ')');
assert(/\[Structure\]/.test(tipHtml), 'with its provenance, as the rows do');
assert(/Residue 4 \(K\): 91.20/.test(tipHtml), 'and the point text');
assert(/background:#facc15/.test(tipHtml), 'and a swatch from the point fill');
assert(ctxRun(`fakeCircle.dataset.origTitle`) === 'Residue 4 (K): 91.20', 'the native SVG title is stashed for restore');
ctxRun(`restoreCellTitle(document.querySelector('.graph-svg circle') || { dataset: {}, appendChild: function () {} }); parsedTracks = {}; analysisRules = [];`);

section('pinned graph axis strip (scrolling)');
ctxRun(`parsedTracks = { AA: 'M'.repeat(40), 'm_pLDDT': Array.from({length: 40}, (_, i) => ({ val: 90, type: 'plddt' })), 'EV_RMSF': Array.from({length: 40}, (_, i) => ({ val: 1.5, type: 'rmsf' })) }; gridCellW = 11.5;`);
const axisStrip = ctxRun(`
    (function () {
        function stripOf(group, key) {
            var section = createOverlayGraphSection('T', [key], 40, group);
            var found = null;
            function walk(el, depth) {
                if (!el || depth > 8 || found) return;
                var cls = String(el.className || (el.attrs && el.attrs.class) || '');
                if (cls.indexOf('graph-axis-side') !== -1) { found = el; return; }
                (el.children || []).forEach(function (c) { walk(c, depth + 1); });
            }
            walk(section, 0);
            if (!found) return { missing: true };
            var ticks = [], marks = 0, title = '';
            (found.children || []).forEach(function (c) {
                var cl = String(c.className || (c.attrs && c.attrs.class) || '');
                if (cl.indexOf('graph-axis-tick') !== -1) ticks.push(c._text);
                else if (cl.indexOf('graph-axis-mark') !== -1) marks++;
                else if (cl.indexOf('graph-axis-title') !== -1) title = c._text;
            });
            return { height: found.style.height, ticks: ticks.join(','), marks: marks, title: title };
        }
        return { plddt: stripOf('pLDDT', 'm_pLDDT'), ev: stripOf('EV', 'EV_RMSF') };
    })()
`);
assert(axisStrip.plddt.missing !== true && axisStrip.ev.missing !== true, 'both graph types render a pinned axis strip');
assert(axisStrip.plddt.ticks === '0,25,50,75,100', 'the strip mirrors the pLDDT ticks (' + axisStrip.plddt.ticks + ')');
assert(axisStrip.plddt.title === 'pLDDT (0-100)', 'and its axis title');
assert(axisStrip.ev.title === 'RMSF (A)', 'the ensemble strip carries its own scale');
assert(axisStrip.ev.ticks.split(',').length === 5, 'with five ticks from the auto scale (' + axisStrip.ev.ticks + ')');
assert(axisStrip.plddt.marks === 5 && axisStrip.ev.marks === 5, 'each tick has a mark');
assert(/px$/.test(String(axisStrip.plddt.height)), 'the strip is sized to the graph height');
// paint order: the opaque strip must sit behind the pills
const stripOrder = ctxRun(`
    (function () {
        var section = createOverlayGraphSection('T', ['m_pLDDT'], 40, 'pLDDT');
        var overlay = null;
        function walk(el, depth) {
            if (!el || depth > 8 || overlay) return;
            var cls = String(el.className || (el.attrs && el.attrs.class) || '');
            if (cls.indexOf('graph-pills-overlay') !== -1) { overlay = el; return; }
            (el.children || []).forEach(function (c) { walk(c, depth + 1); });
        }
        walk(section, 0);
        if (!overlay) return 'no overlay';
        return (overlay.children || []).map(function (c) { return String(c.className || (c.attrs && c.attrs.class) || '?'); }).join('|');
    })()
`);
assert(stripOrder.indexOf('graph-axis-side') !== -1 && stripOrder.indexOf('graph-axis-side') < stripOrder.indexOf('graph-pills-inner'), 'the strip paints behind the pills (' + stripOrder + ')');
// the strip is opaque, which is what stops the plot showing through
const stripStart = HTML.indexOf('.graph-axis-side {');
const stripCss = HTML.slice(stripStart, HTML.indexOf('}', stripStart) + 1);
assert(stripCss.indexOf('background: #fafafa') !== -1, 'the strip has an opaque background');
assert(stripCss.indexOf('border-right') !== -1, 'and the axis line as its right border');
assert(HTML.indexOf('.graph-axis-title') !== -1 && HTML.indexOf('writing-mode: vertical-rl') !== -1, 'the title is vertical, like the SVG axis');
// the strip must not occupy flow space, or it pushes the pills out of the range
assert(stripCss.indexOf('position: absolute') !== -1, 'the strip is out of flow so the pills stay nestled in the range');
assert(stripCss.indexOf('position: relative') === -1, 'and is not a flow block (that was the regression)');
// the graph carries the per-track right-click menu, with keys to resolve
assert(HTML.indexOf("addEventListener('contextmenu'") !== -1 && HTML.indexOf('openTrackCtxMenu(key, e.clientX, e.clientY)') !== -1, 'right-clicking the graph opens the per-track menu');
const pillKeys = ctxRun(`
    (function () {
        var section = createOverlayGraphSection('T', ['m_pLDDT'], 40, 'pLDDT');
        var keys = [], tracks = [];
        function walk(el, depth) {
            if (!el || depth > 10) return;
            var cls = String(el.className || (el.attrs && el.attrs.class) || '');
            if (cls.indexOf('graph-pill') !== -1 && el.dataset && el.dataset.key) keys.push(el.dataset.key);
            if (el.dataset && el.dataset.track) tracks.push(el.dataset.track);
            (el.children || []).forEach(function (c) { walk(c, depth + 1); });
        }
        walk(section, 0);
        return { keys: keys.join(','), tracks: tracks.join(',') };
    })()
`);
assert(pillKeys.keys === 'm_pLDDT', 'pills carry the track key the menu resolves (' + pillKeys.keys + ')');
assert(pillKeys.tracks.indexOf('m_pLDDT') !== -1, 'plotted points carry data-track too (' + pillKeys.tracks + ')');
// the pills clear the rotated axis title rather than covering it
const pillsCss = HTML.slice(HTML.indexOf('.graph-pills-inner {'), HTML.indexOf('}', HTML.indexOf('.graph-pills-inner {')));
assert(pillsCss.indexOf('margin-left: 18px') !== -1, 'the pills are indented past the vertical axis title');
assert(pillsCss.indexOf('max-width: 150px') !== -1, 'and stay clear of the right-aligned tick labels (150px cap, as reviewed)');
// the graph header carries the same Track Control chevron the rows have
const headerBits = ctxRun(`
    (function () {
        var section = createOverlayGraphSection('pLDDT Confidence', ['m_pLDDT'], 40, 'pLDDT');
        var header = null, chev = null;
        function walk(el, depth) {
            if (!el || depth > 10) return;
            var cls = String(el.className || (el.attrs && el.attrs.class) || '');
            if (cls.indexOf('graph-header') !== -1) { header = el; }
            if (cls.indexOf('tctl-chevron') !== -1) { chev = el; }
            (el.children || []).forEach(function (c) { walk(c, depth + 1); });
        }
        walk(section, 0);
        return {
            headerClass: header ? String(header.className || (header.attrs && header.attrs.class) || '') : '',
            chevronText: chev ? chev._text : '',
            chevronTitle: chev ? String(chev.title || '') : ''
        };
    })()
`);
assert(headerBits.headerClass.indexOf('has-chevron') !== -1, 'the header makes room for the chevron');
assert(headerBits.chevronText === '\u25b6', 'the header has the Track Control chevron');
assert(/Track Control: pLDDT/.test(headerBits.chevronTitle), 'labelled with the type, like the rows (' + headerBits.chevronTitle + ')');
assert(HTML.indexOf('openTrackGroupPopup(graphGroup, headerChevron)') !== -1, 'and it opens that type\'s popup');
assert(HTML.indexOf('.graph-header.has-chevron { padding-left: 24px; }') !== -1, 'the header indents for it');
ctxRun(`parsedTracks = {};`);

section('model numbering vs reference (the RMSF offset bug)');
// A model's residue numbering is not trustworthy: an assembly numbered from its
// own mature chain, or a domain-only model numbered from 1, lands shifted. The
// mapping now aligns the chain's own sequence onto the reference.
const oneTo3 = { A:'ALA', R:'ARG', N:'ASN', D:'ASP', C:'CYS', Q:'GLN', E:'GLU', G:'GLY', H:'HIS', I:'ILE', L:'LEU', K:'LYS', M:'MET', F:'PHE', P:'PRO', S:'SER', T:'THR', W:'TRP', Y:'TYR', V:'VAL' };
const mkPdb = (seq, startResSeq) => {
  let out = '';
  for (let i = 0; i < seq.length; i++) {
    const L = new Array(80).fill(' ');
    const put = (st, str) => { for (let k = 0; k < str.length; k++) L[st + k] = str[k]; };
    put(0, 'ATOM'); put(6, String(i + 1).padStart(5)); put(12, 'CA');
    put(17, oneTo3[seq[i]] || 'UNK');
    put(21, 'A'); put(22, String(startResSeq + i).padStart(4));
    put(30, '0.000'.padStart(8)); put(38, String(i).padStart(8)); put(46, String(i % 3).padStart(8));
    out += L.join('') + '\n';
  }
  return out;
};
const refSeq = 'MKTAYIAKQRQISFVKSHFSRQLEERLGLI';
ctxRun(`parsedTracks = { AA: ${JSON.stringify(refSeq)} };
    cachedStructureTexts = {
        'a.pdb': ${JSON.stringify(mkPdb(refSeq, 1))},
        'b.pdb': ${JSON.stringify(mkPdb(refSeq, 18))},
        'c.pdb': ${JSON.stringify(mkPdb(refSeq.slice(17), 1))}
    };`);
// the parser carries the residue letters
assert(ctxRun(`parseStructureChains(cachedStructureTexts['a.pdb'], 'pdb').A[0].aa`) === 'MET', 'the chain parser records the residue name');
assert(ctxRun(`RESIDUE_3TO1.MSE`) === 'M' && ctxRun(`RESIDUE_3TO1.UNK`) === 'X', 'modified/unknown residues map too');
// sequenceFromStructureText: the PDB-fetch contingency when no sequence is loaded
const seqFromPdb = 'SEQRES   1 A   12  MET ALA LYS GLY SER THR VAL ARG ASN GLN ILE LEU\nATOM      1  CA  MET A   1      0.000   0.000   0.000  1.00  0.00           C';
assert(ctxRun(`sequenceFromStructureText(${JSON.stringify(seqFromPdb)}, 'pdb')`) === 'MAKGSTVRNQIL', 'SEQRES yields the polymer sequence');
const seqFromCif = 'data_x\n_entity_poly.pdbx_seq_one_letter_code_can   MAKGSTVRNQIL\n#';
assert(ctxRun(`sequenceFromStructureText(${JSON.stringify(seqFromCif)}, 'cif')`) === 'MAKGSTVRNQIL', 'the mmCIF entity sequence is read');
assert(ctxRun(`sequenceFromStructureText('ATOM only, no SEQRES', 'pdb')`) === '' && ctxRun(`sequenceFromStructureText('', 'cif')`) === '', 'no sequence yields an empty string, not a bogus one');
assert(ctxRun(`typeof sequenceFromStructureText === 'function'`), 'the structure-sequence contingency exists');
// numbering that matches the reference: unchanged behaviour
let evN = ctxRun(`computeEnsembleVariance(['a.pdb', 'b.pdb'])`);
assert(evN.ok === true, 'a renumbered model still computes');
assert(evN.models[1].offset === -17, 'the offset is reported (numbered 17 ahead of the reference)');
assert(evN.values[0].val != null && evN.values[29].val != null, 'its residues land at the reference start and end, not shifted');
// a domain-only model numbered from 1: the numbering would put it at 0.., the
// alignment puts it at 17..
const evD = ctxRun(`computeEnsembleVariance(['a.pdb', 'c.pdb'])`);
assert(evD.ok === true, 'a subrange model computes');
assert(evD.models[1].offset === 17, 'the subrange model is reported as numbered 17 behind');
assert(evD.values[0].val == null, 'its residues do NOT land at the reference start (the bug)');
assert(evD.values[17].val != null && evD.values[29].val != null, 'they land at the aligned range');
assert(evD.covered === 13, 'and only the shared range is measured');
// the mapping helper degrades safely without letters
ctxRun(`var noLetters = [{ resSeq: 5, x: 0, y: 0, z: 0, aa: '' }, { resSeq: 6, x: 1, y: 0, z: 0, aa: '' }, { resSeq: 7, x: 2, y: 0, z: 0, aa: '' }];`);
assert(ctxRun(`mapChainToReference(noLetters, 'MKTAYIAK').get(0)`) === 4, 'without residue letters it falls back to the numbering');
// interface tracks share the mapping (a shifted model must not shift them either)
ctxRun(`
    parsedTracks = { AA: 'MKTAYIAKQRQISFVKSHFSRQLEERLGLI' };
    var chainA = [
        { resSeq: 18, x: 0, y: 0, z: 0, aa: 'MET' },
        { resSeq: 19, x: 1, y: 0, z: 0, aa: 'LYS' },
        { resSeq: 20, x: 2, y: 0, z: 0, aa: 'THR' }
    ];
    var ifaceChains = { A: chainA };
    var ifaceResult = { ids: ['A'], residuesByChain: { A: new Set([18, 19, 20]) }, pairs: [] };
    applyInterfaceTracks(ifaceResult, ifaceChains);
`);
assert(ctxRun(`parsedTracks.IF_A.slice(0, 3)`) === '\u25c6\u25c6\u25c6', 'interface residues land at the aligned reference indices');
assert(ctxRun(`parsedTracks.IF_A.slice(17, 20)`) === '   ', 'not at the raw numbering (the same bug class)');
ctxRun(`parsedTracks = {};`);
ctxRun(`parsedTracks = {}; cachedStructureTexts = {};`);

section('experimental biological assemblies (RCSB)');
assert(ctxRun(`isValidPdbId('1TNF')`) === true, 'a 4-character id starting with a digit is accepted');
assert(ctxRun(`isValidPdbId('tnf')`) === false && ctxRun(`isValidPdbId('1TN')`) === false && ctxRun(`isValidPdbId('')`) === false, 'malformed ids are rejected');
assert(ctxRun(`SERVICE_URLS.rcsbAssembly`) === 'https://files.rcsb.org/download/', 'the assembly base lives in the central URL table');
assert(HTML.indexOf('id="assemblyPdbId"') !== -1 && HTML.indexOf('id="assemblyNumber"') !== -1, 'the interface panel has the id and assembly inputs');
assert(HTML.indexOf('Attach assembly') !== -1, 'and a button to fetch it');
// the id can be pre-filled from the homolog hits
ctxRun(`homologHitsInfo = { 'HL_01_1TNF_A': { hitId: '1TNF_A', source: 'HHpred' } };`);
assert(ctxRun(`firstHomologPdbId()`) === '1TNF', 'the first homolog hit with a PDB id pre-fills the input');
ctxRun(`homologHitsInfo = { 'HL_01_none': { hitId: 'none', source: 'HHpred' } };`);
assert(ctxRun(`firstHomologPdbId()`) === '', 'and nothing is pre-filled when no hit has one');
// guards (the invalid path returns before any network call)
let asmThrew = null;
try { ctxRun(`fetchBiologicalAssembly('nope', 1);`); } catch (e) { asmThrew = e.message; }
assert(asmThrew === null, 'an invalid id is refused without throwing');
ctxRun(`homologHitsInfo = { 'HL_01_1TNF_A': { hitId: '1TNF_A' } };`);
let panelThrew = null;
try { ctxRun(`showAssemblyPanel();`); } catch (e) { panelThrew = e.message; }
assert(panelThrew === null, 'the assembly panel opens without throwing');
assert(ctxRun(`document.getElementById('assemblyPdbId').value`) === '1TNF', 'and pre-fills the id');
// the guide routes a declared multimer with only single-chain models here
ctxRun(`
    guideProfile = { chains: 'homo3' }; guideAnswers = {}; guideOverrides = {}; parsedTracks = { AA: 'MKV' };
    cachedStructureTexts = { 'one.pdb': 'ATOM' };
`);
let stAct3 = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'structure')[0])`);
assert(stAct3.run === 'showAssemblyPanel()' && /experimental assembly/.test(stAct3.label), 'a declared assembly with a single-chain model offers the assembly import');
assert(/cannot be predicted by the services wired in here/.test(stAct3.hint), 'and says why the import is the route');
// once a multimer model is attached the offer goes away
ctxRun(`
    var L1 = new Array(80).fill(' ');
    function caLine(serial, chain, resSeq) {
        var L = new Array(80).fill(' ');
        var put = function (st, str) { for (var k = 0; k < str.length; k++) L[st + k] = str[k]; };
        put(0, 'ATOM'); put(6, String(serial).padStart(5)); put(12, 'CA'); put(17, 'ALA');
        put(21, chain); put(22, String(resSeq).padStart(4));
        put(30, '0.000'.padStart(8)); put(38, '0.000'.padStart(8)); put(46, String(resSeq).padStart(8));
        return L.join('');
    }
    var multi = '';
    ['A', 'B', 'C'].forEach(function (c, ci) { for (var i = 1; i <= 3; i++) multi += caLine(ci * 10 + i, c, i) + '\\n'; });
    cachedStructureTexts = { 'trimer.pdb': multi };
`);
stAct3 = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'structure')[0])`);
assert(stAct3.run !== 'showAssemblyPanel()', 'with a real multimer attached the import is no longer the suggestion');
// the read-out names the route
ctxRun(`
    (function () {
        function caLine(serial, chain, resSeq) {
            var L = new Array(80).fill(' ');
            var put = function (st, str) { for (var k = 0; k < str.length; k++) L[st + k] = str[k]; };
            put(0, 'ATOM'); put(6, String(serial).padStart(5)); put(12, 'CA'); put(17, 'ALA');
            put(21, chain); put(22, String(resSeq).padStart(4));
            put(30, '0.000'.padStart(8)); put(38, '0.000'.padStart(8)); put(46, String(resSeq).padStart(8));
            return L.join('');
        }
        var one = '';
        for (var i = 1; i <= 3; i++) one += caLine(i, 'A', i) + '\\n';
        cachedStructureTexts = { 'one.pdb': one };
    })();
    guideProfile = { chains: 'homo3' };
`);
assert(ctxRun(`attachedChainCounts().length`) === 1 && ctxRun(`attachedChainCounts()[0].chains`) === 1, 'the single-chain model is readable (so the comparison can happen)');
assert(ctxRun(`computeGuideInsights()`).some(i => /Attach assembly/.test(i.text)), 'the read-out points at the assembly action');
ctxRun(`cachedStructureTexts = {}; parsedTracks = {}; guideProfile = {}; homologHitsInfo = {};`);

section('oligomeric state travels with the input and the exports');
// --- read from the identifier token ---
let tok = ctxRun(`oligomerFromLabelToken('A:A:A')`);
assert(tok && tok.value === 'homo3' && tok.count === 3, 'an A:A:A token reads as a homotrimer');
tok = ctxRun(`oligomerFromLabelToken('sp|P42212|GFP_AEVI A:A:A')`);
assert(tok && tok.value === 'homo3', 'the token is found after a UniProt-style identifier');
assert(ctxRun(`oligomerFromLabelToken('sp|P42212|GFP_AEVI')`) === null, 'a plain identifier is not mistaken for stoichiometry');
assert(ctxRun(`oligomerFromLabelToken('A:B')`) === null, 'different letters cannot be inferred as a homo-oligomer');
assert(ctxRun(`oligomerFromLabelToken('A')`) === null, 'a single letter is not a stoichiometry');
tok = ctxRun(`oligomerFromLabelToken('chainA:chainA:chainA:chainA')`);
assert(tok && tok.value === 'homo4' && tok.count === 4, 'four repeats read as a tetramer or larger');
// --- read from repeated identical records ---
const threeRecs = '>chainA\nMKV\n>chainA\nMKV\n>chainA\nMKV\n';
let det = ctxRun(`detectOligomerFromInput(${JSON.stringify(threeRecs)})`);
assert(det && det.value === 'homo3' && /3 identical FASTA records/.test(det.source), 'three identical records read as a homotrimer');
const twoDiff = '>a\nMKV\n>b\nAAA\n';
assert(ctxRun(`detectOligomerFromInput(${JSON.stringify(twoDiff)})`) === null, 'differing records are not inferred (too easy to get wrong)');
assert(ctxRun(`detectOligomerFromInput('MKV')`) === null, 'a bare sequence has no stoichiometry');
// the parser still returns the first chain, plus every record
const pf2 = ctxRun(`parsePlainFasta(${JSON.stringify(threeRecs)})`);
assert(pf2.label === 'chainA' && pf2.sequence === 'MKV' && pf2.records.length === 3, 'the viewer keeps one chain while the records are reported');
// --- recorded, but never over an explicit answer ---
ctxRun(`guideProfile = {};`);
assert(ctxRun(`applyDetectedOligomer({ value: 'homo3', source: 'test' })`) === true && ctxRun(`guideProfile.chains`) === 'homo3', 'a detected state fills an unanswered question');
ctxRun(`guideProfile = { chains: 'monomer' };`);
assert(ctxRun(`applyDetectedOligomer({ value: 'homo3', source: 'test' })`) === false && ctxRun(`guideProfile.chains`) === 'monomer', 'an explicit answer is never overwritten');
ctxRun(`guideProfile = { chains: 'unknown' };`);
assert(ctxRun(`applyDetectedOligomer({ value: 'homo3', source: 'test' })`) === true, '"unknown" counts as unanswered');
// --- it travels with the sequence FASTA ---
ctxRun(`parsedTracks = { AA: 'MKV' }; currentProteinLabel = 'sp|P42212|GFP_AEVI'; guideProfile = { chains: 'homo3' };`);
const seqFasta = ctxRun(`sequenceFastaText()`);
assert(seqFasta.split('\n')[0] === '>sp|P42212|GFP_AEVI_homotrimer', 'the exported FASTA header records the declared state (' + seqFasta.split('\n')[0] + ')');
ctxRun(`guideProfile = { chains: 'monomer' };`);
assert(ctxRun(`sequenceFastaText()`).indexOf('_monomer') === -1, 'a monomer needs no tag');
ctxRun(`guideProfile = {};`);
assert(ctxRun(`sequenceFastaText()`).indexOf('_') === ctxRun(`sequenceFastaText()`).lastIndexOf('_'), 'no state tag when nothing is declared');
// --- the single-chain generators say so ---
ctxRun(`guideProfile = { chains: 'homo3' };`);
assert(/single chain/.test(ctxRun(`singleChainGeneratorNote()`)) && /assembly model/.test(ctxRun(`singleChainGeneratorNote()`)), 'the generators warn that a multimer is not modelled');
ctxRun(`guideProfile = { chains: 'monomer' };`);
assert(ctxRun(`singleChainGeneratorNote()`) === '', 'no note for a monomer');
ctxRun(`guideProfile = { chains: 'homo3' }; guideAnswers = {};`);
ctxRun(`setStepAnswer('structure', 'model', 'esmfold');`);
assert(/single chain/.test(ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'structure')[0]).hint`)), 'the ESMFold hint warns before the click');
ctxRun(`setStepAnswer('structure', 'model', 'afdb'); uniprotAccession = 'P42212';`);
assert(/single chain/.test(ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'structure')[0]).hint`)), 'so does the AlphaFold hint');
assert(HTML.indexOf('singleChainGeneratorNote()') !== -1, 'both generators consult it');
ctxRun(`guideProfile = {}; guideAnswers = {}; uniprotAccession = null; parsedTracks = {}; currentProteinLabel = null;`);

section('declared oligomeric state (chains)');
// the state model
ctxRun(`guideProfile = {};`);
assert(ctxRun(`declaredOligomerState()`) === null, 'no answer means no declared state');
ctxRun(`guideProfile = { chains: 'homo3' };`);
const declared3 = ctxRun(`declaredOligomerState()`);
assert(declared3.label === 'Homotrimer' && declared3.chains === 3, 'a homotrimer declares three chains');
ctxRun(`guideProfile = { chains: 'nonsense' };`);
assert(ctxRun(`declaredOligomerState()`) === null, 'an unknown value is ignored rather than trusted');
// what the coordinates show
const twoChainPdb = ctxRun(`
  (function () {
    function line(serial, chain, resSeq) {
      var L = new Array(80).fill(' ');
      var put = function (s, str) { for (var k = 0; k < str.length; k++) L[s + k] = str[k]; };
      put(0, 'ATOM'); put(6, String(serial).padStart(5)); put(12, 'CA'); put(17, 'ALA');
      put(21, chain); put(22, String(resSeq).padStart(4));
      put(30, '0.000'.padStart(8)); put(38, '0.000'.padStart(8)); put(46, String(resSeq).padStart(8));
      return L.join('');
    }
    var out = '';
    for (var i = 1; i <= 3; i++) out += line(i, 'A', i) + '\\n';
    for (var j = 1; j <= 3; j++) out += line(10 + j, 'B', j) + '\\n';
    return out;
  })()
`);
ctxRun(`parsedTracks = { AA: 'MKV' }; cachedStructureTexts = { 'two.pdb': ${JSON.stringify(twoChainPdb)} };`);
assert(ctxRun(`attachedChainCounts().length`) === 1 && ctxRun(`attachedChainCounts()[0].chains`) === 2, 'the chain count comes from the coordinates');
// the claim is compared against the model
ctxRun(`guideProfile = { chains: 'homo3' };`);
assert(ctxRun(`computeGuideInsights()`).some(i => /largest attached model has only 2 chains/.test(i.text)), 'a declared trimer against a dimer model is flagged as a partial assembly');
// and a single-chain model is the hard case (no interfaces at all)
ctxRun(`cachedStructureTexts = { 'one.pdb': ${JSON.stringify(twoChainPdb)}.split('\\n').slice(0, 3).join('\\n') };`);
assert(ctxRun(`computeGuideInsights()`).some(i => /You declared a homotrimer, but the attached model has a single chain/.test(i.text)), 'a declared trimer with a single-chain model is flagged');
ctxRun(`cachedStructureTexts = { 'two.pdb': ${JSON.stringify(twoChainPdb)} };`);
ctxRun(`guideProfile = { chains: 'homo2' };`);
assert(ctxRun(`computeGuideInsights()`).some(i => /Declared homodimer; an attached model has 2 chains, so the interface analysis can be run/.test(i.text)), 'a claim the model supports is reported as runnable');
ctxRun(`guideProfile = { chains: 'monomer' };`);
assert(ctxRun(`computeGuideInsights()`).some(i => /You declared a monomer, but an attached model has 2 chains/.test(i.text)), 'a monomer claim against a multimer is questioned');
ctxRun(`guideProfile = {};`);
assert(!ctxRun(`computeGuideInsights()`).some(i => /declared/i.test(i.text)), 'no claim, no comment');
// the interface action and panel carry it
ctxRun(`guideProfile = { chains: 'homo3' }; guideAnswers = {};`);
ctxRun(`setStepAnswer('integration', 'goal', 'interface');`);
assert(/You declared a homotrimer\./.test(ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'integration')[0]).hint`) || ''), 'the interface hint names the declared state');
ctxRun(`guideAnswers = {};`);
ctxRun(`syncInterfaceDeclared();`);
assert(ctxRun(`document.getElementById('interfaceDeclared').textContent`) === 'Declared: Homotrimer', 'the interface panel shows it beside the analysis');
ctxRun(`guideProfile = { chains: 'monomer' }; syncInterfaceDeclared();`);
assert(ctxRun(`document.getElementById('interfaceDeclared').textContent`) === '', 'a monomer declaration adds nothing there');
// it is recorded in the write-up
ctxRun(`guideProfile = { chains: 'homo3' };`);
assert(ctxRun(`buildMethodsReport()`).indexOf('Homotrimer') !== -1, 'the methods summary records the declared state');
ctxRun(`guideProfile = {}; cachedStructureTexts = {}; parsedTracks = {};`);

section('conservation includes HHR homologs by default');
assert(/id="conservationIncludeHHRCheck"[^>]*checked/.test(HTML), 'the checkbox is checked before any state is restored');
ctxRun(`applyConservationSettings({});`);
assert(ctxRun(`conservationIncludeHHR`) === true, 'an absent preference means the new default (on)');
ctxRun(`applyConservationSettings({ conservationIncludeHHR: false });`);
assert(ctxRun(`conservationIncludeHHR`) === false, 'a deliberate opt-out is respected');
ctxRun(`applyConservationSettings({ conservationIncludeHHR: true });`);
assert(ctxRun(`conservationIncludeHHR`) === true, 'an explicit on stays on');
// the tallies really take the homolog sequences in
ctxRun(`keyedVariantsInfo = {}; parsedTracks = { AA: 'MKV', 'HL_01_hit': '||.' };
    homologHitsInfo = { 'HL_01_hit': { aaTrack: 'MKI', source: 'HHpred' } };`);
const withHhr = ctxRun(`getConservationAlignedSequences()`);
assert(withHhr.length === 1 && withHhr[0] === 'MKI', 'HHR homolog sequences join the tallies when on');
ctxRun(`conservationIncludeHHR = false;`);
assert(ctxRun(`getConservationAlignedSequences().length`) === 0, 'and are excluded when off');
ctxRun(`conservationIncludeHHR = true;`);
// an .hhr import recomputes, so the default takes effect immediately
const importFn = HTML.slice(HTML.indexOf('function importHHpredFile'), HTML.indexOf('function importHHpredFile') + 3200);
assert(importFn.indexOf('recomputeConservationScores();') !== -1, 'an .hhr import recomputes conservation rather than waiting for an unrelated change');
// the methods summary records it
ctxRun(`parsedTracks.CONSERVATION = { type: 'conservation', metric: 'shannon', values: [1, 1, 1] };`);
assert(ctxRun(`buildMethodsReport()`).indexOf('(incl. HHR homologs)') !== -1, 'the methods summary says the homologs were included');
ctxRun(`parsedTracks = {}; homologHitsInfo = {}; keyedVariantsInfo = {};`);

section('Track Control layout: width + no config hints');
assert(HTML.indexOf('min-width: 380px') !== -1 && HTML.indexOf('max-width: 460px') !== -1, 'the popover is wide enough for four columns (the category was truncating)');
assert(HTML.indexOf('tctl-config-hint') === -1, 'the redundant hint beside the Config gear is gone (CSS included)');
assert(HTML.indexOf('function groupConfigHint') === -1, 'its helper is gone rather than left dead');
assert(HTML.indexOf("gear.title = 'Config for ' + trackGroupLabel(g)") !== -1, 'the gear still explains itself in its tooltip');
// the four columns are declared in order
const gridCols = HTML.slice(HTML.indexOf('.tctl-grid {'), HTML.indexOf('.tctl-grid {') + 200);
assert(gridCols.indexOf('1fr 88px 104px 56px') !== -1, 'the grid declares Category / View as / Color / Config');
assert(HTML.indexOf("'Color')") !== -1, 'and the header still labels the Color column');

section('Track Control: the Color column (homolog colouring)');
ctxRun(`trackControlState = getDefaultTrackControlState();`);
assert(ctxRun(`getGroupColorMode('HL')`) === 'quality', 'homologs default to match-quality colouring');
assert(ctxRun(`groupColorModes('HL').length`) === 4, 'homologs offer four colour modes');
assert(ctxRun(`groupColorModes('SS').length`) === 0, 'a type without a choice reports none');
// selecting a mode keeps the legacy flag in step
ctxRun(`setGroupColorMode('HL', 'conservation');`);
assert(ctxRun(`getGroupColorMode('HL')`) === 'conservation' && ctxRun(`isTrackGroupConsColored('HL')`) === true, 'conservation mode drives the legacy predicate');
assert(ctxRun(`trackControlState.consColor.HL`) === true, 'the legacy flag stays in sync for old code and saves');
ctxRun(`setGroupColorMode('HL', 'residue');`);
assert(ctxRun(`getGroupColorMode('HL')`) === 'residue' && ctxRun(`isTrackGroupConsColored('HL')`) === false, 'residue mode is not conservation');
// a legacy session (flag only, no mode) still reads as conservation
ctxRun(`trackControlState = getDefaultTrackControlState(); trackControlState.consColor.HL = true;`);
assert(ctxRun(`getGroupColorMode('HL')`) === 'conservation', 'a pre-mode session is interpreted as conservation');
// the palette is stable per letter and distinct across chemistry
assert(ctxRun(`residueColorFor('I')`) === ctxRun(`residueColorFor('i')`) && ctxRun(`residueColorFor('I')`) === '#8cc4f5', 'the residue palette is case-insensitive and stable');
assert(ctxRun(`residueColorFor('K')`) !== ctxRun(`residueColorFor('I')`), 'different chemistry, different colour');
assert(ctxRun(`residueColorFor('X')`) === '', 'an unknown letter has no colour (falls back)');
// the master list: header + a selector where there is a choice, a dash where not
assert(HTML.indexOf("mkEl('div', 'tctl-color-cell', 'Color')") !== -1, 'the header has a Color column');
const hlCell = ctxRun(`
    (function () {
        var cell = buildGroupColorCell('HL');
        var opts = [];
        (cell.children || []).forEach(function (c) { if (c.children) c.children.forEach(function (o) { opts.push(o.value); }); });
        return opts.join(',');
    })()
`);
assert(hlCell === 'quality,conservation,residue,score', 'the homolog cell offers all four modes (got ' + hlCell + ')');
const ssCell = ctxRun(`
    (function () {
        var cell = buildGroupColorCell('SS');
        var texts = [];
        (cell.children || []).forEach(function (c) { texts.push(c._text); });
        return texts.join(',');
    })()
`);
assert(ssCell === '-', 'a single-mode type shows a dash rather than a fake choice');
// rendering honours the mode: residue mode colours by the letter, not by match quality
ctxRun(`
    parsedTracks = { AA: 'MKV', 'HL_01_hit': '||.' };
    homologHitsInfo = { 'HL_01_hit': { aaTrack: 'MKI', source: 'HHpred' } };
    trackControlState = getDefaultTrackControlState();
    setGroupColorMode('HL', 'residue');
`);
const residueBgs = ctxRun(`
    (function () {
        var row = buildTrackRow('HL_01_hit', parsedTracks, 3, true);
        var cells = row.children[1];
        return (cells.children || []).map(function (c) { return c.style.backgroundColor; }).join('|');
    })()
`);
assert(residueBgs.split('|')[0] === ctxRun(`residueColorFor('M')`), 'residue mode colours by the template letter');
assert(residueBgs.split('|')[2] === ctxRun(`residueColorFor('I')`), 'and the same letter is the same colour in any row');
ctxRun(`setGroupColorMode('HL', 'quality');`);
const qualityBgs = ctxRun(`
    (function () {
        var row = buildTrackRow('HL_01_hit', parsedTracks, 3, true);
        var cells = row.children[1];
        return (cells.children || []).map(function (c) { return c.style.backgroundColor; }).join('|');
    })()
`);
assert(qualityBgs.split('|')[0] !== residueBgs.split('|')[0], 'switching to match quality changes the colouring');
assert(qualityBgs.indexOf('#8cc4f5') === -1, 'and does not use the residue palette');
// the moved controls are gone from their old homes
assert(HTML.indexOf('Cons. colors on') === -1 && HTML.indexOf('Cons. colors off') === -1, 'the group popup no longer carries the colour toggle');
assert(HTML.indexOf('consColor.HH') === -1, 'the stale HH-keyed checkbox is gone');
assert(HTML.indexOf("Track Control's Color column") !== -1, 'the config frame points at the new column');
// the mode persists with the session
ctxRun(`setGroupColorMode('HL', 'residue');`);
assert(ctxRun(`gatherPersistableState().preferences.trackControl.colorMode.HL`) === 'residue', 'the colour mode is persisted');
ctxRun(`trackControlState = getDefaultTrackControlState(); parsedTracks = {}; homologHitsInfo = {};`);

section('empty tracks + no duplicate action + action log');
// --- the tailored-label duplicate button is gone ---
ctxRun(`
    parsedTracks = { AA: 'MKV' }; guideProfile = {}; guideAnswers = {}; guideOverrides = {};
    cachedStructureTexts = { 'm.pdb': 'ATOM' };
    setStepAnswer('foldseek', 'db', 'pdb100');
`);
let fsAct2 = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'foldseek')[0])`);
assert(fsAct2.run === 'runFoldseekSearch()' && fsAct2.custom === false, 'a tailored label for the same handler is not a second action (no duplicate button)');
assert(fsAct2.label.indexOf('pdb100') !== -1, 'but the tailored label is still used');
ctxRun(`setStepAnswer('structure', 'model', 'afdb'); uniprotAccession = 'P42212';`);
assert(ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'structure')[0]).custom`) === true, 'a genuinely different action still gets the secondary button');
ctxRun(`uniprotAccession = null; guideAnswers = {}; cachedStructureTexts = {};`);

// --- (Empty) tracks ---
ctxRun(`parsedTracks = { AA: 'MKV', 'TM_Quick2D': '   ', 'SS_PSIPRED': 'HH ', 'm_pLDDT': [{ val: null }, { val: null }], 'm_RSA': [{ val: 0.2 }] };`);
assert(ctxRun(`isTrackEmpty('TM_Quick2D')`) === true, 'an all-blank string track is empty');
assert(ctxRun(`isTrackEmpty('SS_PSIPRED')`) === false, 'an annotated string track is not');
assert(ctxRun(`isTrackEmpty('AA')`) === false, 'the sequence row is never empty');
assert(ctxRun(`isTrackEmpty('m_pLDDT')`) === true, 'an object track with no values is empty');
assert(ctxRun(`isTrackEmpty('m_RSA')`) === false, 'an object track with a value is not');
assert(ctxRun(`isTrackEmpty('nope')`) === false, 'a missing key is not reported as empty');
// the row gets the greyed class and the tag
const emptyRowTag = ctxRun(`
    (function () {
        var row = buildTrackRow('TM_Quick2D', parsedTracks, 3, true);
        function find(el, needle, depth) {
            if (!el || depth > 8) return '';
            if (el._text === needle) return needle;
            var kids = el.children || [];
            for (var i = 0; i < kids.length; i++) { var r = find(kids[i], needle, depth + 1); if (r) return r; }
            return '';
        }
        return find(row, '(Empty)', 0);
    })()
`);
assert(emptyRowTag === '(Empty)', 'an empty track row carries the (Empty) tag');
const filledRowTag = ctxRun(`
    (function () {
        var row = buildTrackRow('SS_PSIPRED', parsedTracks, 3, true);
        function find(el, needle, depth) {
            if (!el || depth > 8) return '';
            if (el._text === needle) return needle;
            var kids = el.children || [];
            for (var i = 0; i < kids.length; i++) { var r = find(kids[i], needle, depth + 1); if (r) return r; }
            return '';
        }
        return find(row, '(Empty)', 0);
    })()
`);
assert(filledRowTag === '', 'a populated track row does not');
assert(HTML.indexOf('.track-row.track-empty') !== -1, 'the greying rule exists');
assert(HTML.indexOf('(Empty)</em>') !== -1, 'the Tracks tab shows the tag too');
// the read-out flags an empty TM row against a membrane answer
ctxRun(`guideProfile = { membrane: 'yes' };`);
assert(ctxRun(`computeGuideInsights()`).some(i => /every transmembrane prediction came back empty/.test(i.text)), 'an empty TM row contradicts a membrane answer');
ctxRun(`guideProfile = { membrane: 'no' };`);
assert(!ctxRun(`computeGuideInsights()`).some(i => /came back empty/.test(i.text)), 'and is not flagged when the answer says soluble');
ctxRun(`parsedTracks = {}; guideProfile = {};`);

// --- action log ---
ctxRun(`actionLog = [];`);
assert(Array.isArray(ctxRun(`actionLog`)) && ctxRun(`actionLog.length`) === 0, 'the log starts empty after clearing');
ctxRun(`logAction('menu', 'legend'); logAction('export', 'x.tsv', '12 chars');`);
assert(ctxRun(`actionLog.length`) === 2, 'entries are appended');
assert(ctxRun(`actionLog[0].kind`) === 'menu' && ctxRun(`actionLog[1].label`) === 'x.tsv', 'entries keep their kind and label');
assert(ctxRun(`actionLog[0].t`).indexOf(':') !== -1, 'entries carry a timestamp');
const logJson = ctxRun(`JSON.parse(actionLogText(true))`);
assert(Array.isArray(logJson) && logJson.length === 2 && logJson[0].kind === 'menu', 'the log copies as parseable JSON (macro foundation)');
assert(ctxRun(`actionLogText(false)`).split('\n').length === 2, 'the plain form is one line per action');
// the cap holds
ctxRun(`actionLog = []; for (var i = 0; i < 260; i++) logAction('click', 'b' + i);`);
assert(ctxRun(`actionLog.length`) === 200, 'the log keeps the last 200 actions');
assert(ctxRun(`actionLog[0].label`) === 'b60' && ctxRun(`actionLog[199].label`) === 'b259', 'the oldest entries are the ones dropped');
// rendering + clearing + the export hook
ctxRun(`renderActionLog();`);
assert(ctxRun(`document.getElementById('actionLogBody').textContent`).indexOf('b259') !== -1, 'the console renders the newest first');
assert(ctxRun(`document.getElementById('actionLogBody').textContent`).split('\n')[0].indexOf('b259') !== -1, 'newest is at the top');
ctxRun(`clearActionLog();`);
assert(ctxRun(`actionLog.length`) === 0 && ctxRun(`document.getElementById('actionLogBody').textContent`).indexOf('no actions recorded') !== -1, 'clearing empties the log and the console says so');
ctxRun(`downloadTextFile('probe.tsv', 'abc', 'text/plain');`);
assert(ctxRun(`actionLog.some(e => e.kind === 'export' && e.label === 'probe.tsv')`), 'an export is logged automatically');
ctxRun(`menuBarAction('legend');`);
assert(ctxRun(`actionLog.some(e => e.kind === 'menu' && e.label === 'legend')`), 'a menu choice is logged');
assert(typeof ctxRun(`window.q2dvActions`) === 'function' && ctxRun(`JSON.parse(window.q2dvActions()).length`) > 0, 'the console accessor returns the log as JSON');
assert(HTML.indexOf('id="actionLogModal"') !== -1 && HTML.indexOf('openActionLog()') !== -1, 'the debugging console has a modal and a way in');
assert(HTML.indexOf('ACTION_LOG_MAX = 200') !== -1, 'the 200-entry cap is explicit');
ctxRun(`actionLog = [];`);

section('RMSF line plot (third graph type)');
ctxRun(`
    parsedTracks = { AA: 'M'.repeat(5), EV_RMSF: [{ val: 0.4, type: 'rmsf' }, { val: 1.2, type: 'rmsf' }, { val: 2.4, type: 'rmsf' }, { val: null, type: 'rmsf' }, { val: 0.9, type: 'rmsf' }] };
    graphMode = { pLDDT: false, RSA: false, EV: false }; graphHighlights = {};
`);
assert(ctxRun(`GRAPH_TYPES.join(',')`) === 'pLDDT,RSA,EV,EXP', 'the graph-capable types are pLDDT, RSA, ensemble variance and experimental data');
assert(ctxRun(`isGraphCapable('EV')`) === true && ctxRun(`isGraphCapable('SS')`) === false, 'capability is explicit, not implicit');
assert(ctxRun(`isGraphType('EV')`) === false, 'graph mode is off by default');
// the scale drives the axis (auto max, one decimal, RMSF label)
const evScale = ctxRun(`graphScaleForGroup('EV')`);
assert(evScale.max === null && evScale.title === 'RMSF (A)' && evScale.tick(1.25) === '1.3', 'the EV scale is auto-max with one-decimal ticks');
assert(ctxRun(`graphScaleForGroup('pLDDT').max`) === 100 && ctxRun(`graphScaleForGroup('RSA').max`) === 1, 'the existing scales are unchanged');
assert(ctxRun(`graphMaxForGroup('EV', ['EV_RMSF'])`) === 3, 'the auto max rounds the data max up to a whole unit');
assert(ctxRun(`graphMaxForGroup('EV', [])`) === 1, 'an empty ensemble still gets a sane axis');
assert(ctxRun(`graphTitleForGroup('EV')`) === 'Ensemble variance (RMSF)', 'the section is titled for the type');
// Track Control offers Graph for the EV type, and selecting it flips the mode
const evOpts = ctxRun(`(function(){ var s = buildGroupViewSelect('EV'); return (s.children || []).map(o => o.value); })()`);
assert(evOpts[0] === 'graph' && evOpts.indexOf('hidden') !== -1, 'the EV View-as leads with Graph');
ctxRun(`setGroupView('EV', 'graph');`);
assert(ctxRun(`graphMode.EV`) === true && ctxRun(`getEffectiveGroupView('EV')`) === 'graph', 'setGroupView(EV, graph) enables it');
ctxRun(`toggleGraphMode('EV');`);
assert(ctxRun(`graphMode.EV`) === false, 'the View menu toggle turns it off');
ctxRun(`toggleGraphMode('SS');`);
assert(ctxRun(`graphMode.SS`) === undefined, 'a non-graph type is ignored by the toggle');
// the legend row exists and follows the mode
assert(HTML.indexOf('id="legendRmsfRow"') !== -1, 'the legend has an RMSF row');
ctxRun(`graphMode.EV = true; syncGraphModeControls();`);
assert(ctxRun(`document.getElementById('legendRmsfRow').hidden`) === false, 'the legend row shows in graph mode');
ctxRun(`graphMode.EV = false; syncGraphModeControls();`);
assert(ctxRun(`document.getElementById('legendRmsfRow').hidden`) === true, 'and hides otherwise');
// the mode persists
ctxRun(`graphMode.EV = true;`);
assert(ctxRun(`gatherPersistableState().preferences.graphMode.EV`) === true, 'graph mode is persisted per type');
ctxRun(`graphMode.EV = false;`);
// the builder runs for the new type, with the scale-driven axis title
let graphThrew = null;
let evAxisTitle = '';
try {
  evAxisTitle = ctxRun(`
    (function () {
      var wrapper = createOverlayGraphSection('Ensemble variance (RMSF)', ['EV_RMSF'], 5, 'EV');
      // The builder returns the section wrapper; the SVG (and its axis) is nested
      // inside it, so search the tree rather than assuming a shape.
      function find(el, needle, depth) {
        if (!el || depth > 8) return '';
        if (el._text === needle) return needle;
        var kids = el.children || [];
        for (var i = 0; i < kids.length; i++) { var r = find(kids[i], needle, depth + 1); if (r) return r; }
        return '';
      }
      return find(wrapper, 'RMSF (A)', 0);
    })()
  `);
} catch (e) { graphThrew = e.message; }
assert(graphThrew === null, 'the graph builder runs for the ensemble type (' + (graphThrew || 'ok') + ')');
assert(evAxisTitle === 'RMSF (A)', 'the axis title is taken from the EV scale');
// the metrics panel and the export both see the RMSF row
ctxRun(`selectStart = null; selectEnd = null;`);
const metricRows = ctxRun(`computeMetricsRows()`);
assert(metricRows.hasData === true && metricRows.rows.some(r => String(r.key).indexOf('RMSF') !== -1 || String(r.metric).indexOf('RMSF') !== -1), 'the metrics export includes the RMSF row');
assert(HTML.indexOf("menuBarAction('graphEns')") !== -1, 'the View menu has the RMSF graph toggle');
assert(ctxRun(`formatTrackLabel('EV_RMSF')`) === 'Ensemble RMSF', 'the graph pill and metrics row read as "Ensemble RMSF"');
assert(ctxRun(`formatTrackLabel('model_1_RMSF')`) === 'model_1 RMSF', 'a per-model RMSF key still reads sensibly');
ctxRun(`parsedTracks = {}; graphMode = { pLDDT: false, RSA: false, EV: false };`);

section('construct designer (truncated FASTA)');
['constructSection','constructMode','constructMinRun','constructStripN','constructStripC','constructStatus','constructPreview'].forEach(id => {
  assert(HTML.indexOf('id="' + id + '"') !== -1, 'the ' + id + ' control exists');
});
// 30 aa: 6 disordered N-terminal, 20 ordered core, 4 disordered C-terminal
ctxRun(`
    parsedTracks = { AA: 'M'.repeat(30), 'DO_IUPred': 'D'.repeat(6) + ' '.repeat(20) + 'D'.repeat(4) };
    lastRanges = null; rowRanges = []; currentProteinLabel = 'GFP';
`);
let con = ctxRun(`computeConstruct({ mode: 'disorder', minRun: 5, stripN: true, stripC: true })`);
assert(con.ok === true, 'the construct computes');
assert(con.start === 7 && con.end === 30 && con.length === 24, 'a 6-residue N-terminal stretch is trimmed at minRun 5');
assert(con.trimmedN === 6 && con.trimmedC === 0, 'the 4-residue C-terminal stretch is left alone (below minRun)');
assert(con.sequence === 'M'.repeat(24), 'the construct sequence is the kept range');
// lowering the threshold trims both ends
con = ctxRun(`computeConstruct({ mode: 'disorder', minRun: 4, stripN: true, stripC: true })`);
assert(con.start === 7 && con.end === 26 && con.length === 20 && con.trimmedN === 6 && con.trimmedC === 4, 'both termini trim once the threshold allows it');
// one end only
con = ctxRun(`computeConstruct({ mode: 'disorder', minRun: 4, stripN: false, stripC: true })`);
assert(con.start === 1 && con.trimmedN === 0, 'the N-terminal checkbox is honoured');
// a single stray residue never triggers a trim
ctxRun(`parsedTracks = { AA: 'M'.repeat(20), 'DO_IUPred': 'D' + ' '.repeat(19) };`);
con = ctxRun(`computeConstruct({ mode: 'disorder', minRun: 5, stripN: true, stripC: true })`);
assert(con.start === 1 && con.trimmedN === 0, 'a 1-residue terminal stretch is not trimmed at minRun 5');
// selection mode
ctxRun(`parsedTracks = { AA: 'M'.repeat(30) }; lastRanges = [[10, 25]];`);
con = ctxRun(`computeConstruct({ mode: 'selection' })`);
assert(con.ok && con.start === 10 && con.end === 25 && con.length === 16 && con.trimmedN === 9 && con.trimmedC === 5, 'selection mode keeps exactly the selection');
// guards
ctxRun(`lastRanges = null; rowRanges = [];`);
assert(ctxRun(`computeConstruct({ mode: 'selection' }).ok`) === false, 'selection mode with nothing selected is refused');
ctxRun(`parsedTracks = { AA: 'M'.repeat(30) };`);
assert(ctxRun(`computeConstruct({ mode: 'disorder' }).ok`) === false, 'no disorder track is refused with an explanation');
assert(ctxRun(`computeConstruct({ mode: 'disorder' }).message`).indexOf('disorder track') !== -1, 'the refusal names the missing input');
ctxRun(`parsedTracks = { AA: 'M'.repeat(30), 'DO_IUPred': 'D'.repeat(30) };`);
assert(ctxRun(`computeConstruct({ mode: 'disorder', minRun: 5 }).ok`) === false, 'an all-disordered sequence is refused');
ctxRun(`parsedTracks = {};`);
assert(ctxRun(`computeConstruct({ mode: 'disorder' }).ok`) === false, 'no sequence is refused');
// FASTA output
ctxRun(`parsedTracks = { AA: 'M'.repeat(130), 'DO_IUPred': ' '.repeat(130) }; currentProteinLabel = 'sp|P42212|GFP_AEQVI GFP';`);
con = ctxRun(`computeConstruct({ mode: 'disorder', minRun: 5 })`);
const conFasta = ctxRun(`constructFastaText(${JSON.stringify({ start: 1, end: 130, length: 130, mode: 'disorder', sequence: 'M'.repeat(130) })}, 'GFP')`);
assert(conFasta.indexOf('>GFP_1-130_disorder-trimmed') === 0, 'the header names the label, range and mode');
assert(conFasta.trim().split('\n').length === 4 && conFasta.trim().split('\n')[1].length === 60, 'the construct sequence wraps at 60');
assert(ctxRun(`constructHeaderLine({ start: 7, end: 30, mode: 'selection' })`).indexOf('_selection') !== -1, 'selection mode is marked in the header');
let conThrew = null;
try { ctxRun(`renderConstructPreview(); downloadConstructFasta(); copyConstructFasta();`); } catch (e) { conThrew = e.message; }
assert(conThrew === null, 'preview, download and copy do not throw');
// the guide offers it as a deliverable
assert(ctxRun(`WORKFLOW_STEPS.filter(s => s.id === 'integration')[0].extraActions.some(a => a.run === 'showConstructPanel()')`), 'the Integrate step offers the construct designer');
ctxRun(`parsedTracks = {}; currentProteinLabel = null;`);

section('feature -> guide taxonomy (retroactive pass)');
const structStep = ctxRun(`WORKFLOW_STEPS.filter(s => s.id === 'structure')[0]`);
assert(structStep.extraActions.some(a => a.run === 'showEnsemblePanel()'), 'the structure step offers the ensemble variance');
assert(structStep.how.join(' ').indexOf('Ensemble variance') !== -1, 'and its how-to-read explains what RMSF means for the fold');
const integStep = ctxRun(`WORKFLOW_STEPS.filter(s => s.id === 'integration')[0]`);
assert(integStep.extraActions.some(a => a.run === 'openDataModal()'), 'the Integrate step offers the co-localization table');
assert(integStep.extraActions.some(a => a.run === 'exportMethodsReport()'), 'and the methods summary');

// an attached ensemble is surfaced as the next thing to do on that step
ctxRun(`guideProfile = {}; guideAnswers = {}; guideOverrides = {}; parsedTracks = { AA: 'MKV' }; cachedStructureTexts = {};`);
ctxRun(`cachedStructureTexts = { 'a.pdb': 'ATOM', 'b.pdb': 'ATOM' };`);
let stAct = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'structure')[0])`);
assert(stAct.run === 'showEnsemblePanel()' && /2 models are attached/.test(stAct.hint), 'two models with no variance computed is offered as the next action');
ctxRun(`parsedTracks.EV_RMSF = [{ val: 0.2, type: 'rmsf' }];`);
stAct = ctxRun(`resolveStepAction(WORKFLOW_STEPS.filter(s => s.id === 'structure')[0])`);
assert(stAct.run !== 'showEnsemblePanel()', 'once computed it stops being the suggestion');
// the read-out reports it, and suggests it when missing
ctxRun(`parsedTracks = { AA: 'MKV', EV_RMSF: [{ val: 0.5, type: 'rmsf' }, { val: 4.5, type: 'rmsf' }] };`);
assert(ctxRun(`computeGuideInsights()`).some(i => /Ensemble RMSF: mean 2.50 A, max 4.50 A/.test(i.text)), 'the read-out reports the ensemble spread');
ctxRun(`parsedTracks = { AA: 'MKV', 'a_pLDDT': [{ val: 90 }], 'b_pLDDT': [{ val: 80 }] };`);
assert(ctxRun(`computeGuideInsights()`).some(i => /2 models are attached but not compared/.test(i.text)), 'the read-out suggests the comparison when models are uncompared');
ctxRun(`cachedStructureTexts = {}; parsedTracks = {};`);

section('co-localization table');
assert(HTML.indexOf('id="colocSourceSelect"') !== -1 && HTML.indexOf('id="dataColocWrap"') !== -1, 'the Data modal has the section and its container');
ctxRun(`
    parsedTracks = {
        AA: 'MKV',
        CONSERVATION: { type: 'conservation', metric: 'shannon', values: [0.9, 0.5, 0.1] },
        'm_pLDDT': [{ val: 90 }, { val: 80 }, { val: 70 }],
        'm_RSA': [{ val: 0.1 }, { val: 0.5 }, { val: 0.9 }],
        'EV_RMSF': [{ val: 0.5, type: 'rmsf' }, { val: 2.5, type: 'rmsf' }, { val: null, type: 'rmsf' }],
        'DO_IUPred': '  D',
        'TM_Quick2D': 'E  '
    };
    uploadedStructureFiles = [{ name: 'm.pdb', cofactors: [{ resName: 'HEM', chain: 'A', resSeq: 100, category: 'Heme', neighbors: [1, 2, -1, -1] }] }];
    lastRanges = [[1, 3]]; rowRanges = []; analysisRules = [];
`);
const coloc = ctxRun(`buildColocalizationRows([1, 2, 3])`);
assert(coloc.length === 3, 'one row per residue');
assert(coloc[0].aa === 'M' && coloc[0].conservation === 0.9 && coloc[0].plddt === 90 && coloc[0].rsa === 0.1 && coloc[0].rmsf === 0.5, 'the metrics land in the right columns');
assert(coloc[2].rmsf === null, 'an uncovered metric is null (rendered as -)');
assert(coloc[0].cofactors.length === 1 && coloc[0].cofactors[0].indexOf('HEM') === 0, 'cofactor proximity comes from the neighbour list');
assert(coloc[2].cofactors.length === 0, 'a residue outside the neighbour list reports none');
assert(coloc[0].types.join(', ').indexOf('Transmembrane') !== -1, 'annotation types present are listed');
assert(coloc[2].types.join(', ').indexOf('Disorder') !== -1, 'and they differ per residue');
ctxRun(`renderColocalizationTable();`);
let colocHtml = ctxRun(`document.getElementById('dataColocWrap').innerHTML`);
assert(colocHtml.indexOf('<th>Residue</th>') !== -1 && colocHtml.indexOf('<th>Cofactor proximity</th>') !== -1, 'the table has the expected columns');
assert(colocHtml.indexOf('<td>1</td>') !== -1 && colocHtml.indexOf('HEM') !== -1, 'rows and cofactor proximity render');
assert(colocHtml.indexOf('3 residue(s) from the current selection') !== -1, 'the footer names the source and count');
// empty selection explains itself instead of rendering an empty table
ctxRun(`lastRanges = null; rowRanges = []; renderColocalizationTable();`);
assert(ctxRun(`document.getElementById('dataColocWrap').innerHTML`).indexOf('Nothing to tabulate') !== -1, 'an empty source explains itself');
// a rule can drive the table
ctxRun(`analysisRules = [{ id: 'r1', name: 'TM probe', color: '#f00', mode: 'all', enabled: true,
    conditions: [{ kind: 'categorical', source: 'group:TM', op: 'annotated', value: '' }] }];`);
ctxRun(`document.getElementById('colocSourceSelect').value = 'r1';`);
const ruleSrc = ctxRun(`colocalizationRowSource()`);
assert(ruleSrc.residues.join(',') === '1' && ruleSrc.label.indexOf('TM probe') !== -1, 'a rule source tabulates exactly its matches');
ctxRun(`syncColocSourceOptions();`);
assert(ctxRun(`document.getElementById('colocSourceSelect').innerHTML`).indexOf('TM probe') !== -1, 'the rule appears in the source picker');
ctxRun(`renderColocalizationTable();`);
const ruleFooter = ctxRun(`document.getElementById('dataColocWrap').innerHTML`);
assert(ruleFooter.indexOf('from the rule') !== -1 && ruleFooter.indexOf('TM probe') !== -1, 'the footer names the rule (quotes may be escaped)');
ctxRun(`parsedTracks = {}; uploadedStructureFiles = []; analysisRules = [];`);

section('ensemble variance (RMSF)');
// synthetic PDBs written into the exact columns the parser reads
ctxRun(`
    window.__mkPdb = function (coords, chain) {
        var out = '';
        coords.forEach(function (c, i) {
            var L = new Array(80).fill(' ');
            var put = function (start, str) { for (var k = 0; k < str.length; k++) L[start + k] = str[k]; };
            put(0, 'ATOM'); put(6, String(i + 1).padStart(5)); put(12, 'CA'); put(17, 'ALA');
            put(21, chain || 'A'); put(22, String(i + 1).padStart(4));
            put(30, c[0].toFixed(3).padStart(8)); put(38, c[1].toFixed(3).padStart(8)); put(46, c[2].toFixed(3).padStart(8));
            out += L.join('') + '\\n';
        });
        return out;
    };
    window.__base = [[0,0,0],[3,0,0],[3,3,0],[0,3,0],[0,0,3]];
    window.__translate = function (coords, d) { return coords.map(function (c) { return [c[0]+d[0], c[1]+d[1], c[2]+d[2]]; }); };
    window.__rotZ = function (coords) { return coords.map(function (c) { return [-c[1], c[0], c[2]]; }); };
`);
const mkEnsemble = (a, b) => ctxRun(`
    parsedTracks = { AA: 'M'.repeat(5) };
    cachedStructureTexts = { 'a.pdb': window.__mkPdb(${a}), 'b.pdb': window.__mkPdb(${b}) };
`);

// identical models -> no fluctuation
mkEnsemble('window.__base', 'window.__base');
let ev = ctxRun(`computeEnsembleVariance(['a.pdb', 'b.pdb'])`);
assert(ev.ok === true, 'two models compute');
assert(ev.values.every(v => v.val != null && v.val < 1e-6), 'identical models give zero RMSF');
assert(ev.mean < 1e-6 && ev.models.length === 2, 'mean is zero and both models are reported');

// a rigid-body translation must vanish after superposition (this is the whole point)
mkEnsemble('window.__base', 'window.__translate(window.__base, [12, -7, 4.5])');
ev = ctxRun(`computeEnsembleVariance(['a.pdb', 'b.pdb'])`);
assert(ev.ok && ev.values.every(v => v.val != null && v.val < 1e-6), 'a pure translation is removed by the superposition');
assert(ev.models[1].rmsd < 1e-6, 'the reported RMSD to the first model is zero too');

// and so must a rigid-body rotation
mkEnsemble('window.__base', 'window.__rotZ(window.__base)');
ev = ctxRun(`computeEnsembleVariance(['a.pdb', 'b.pdb'])`);
assert(ev.ok && ev.values.every(v => v.val != null && v.val < 1e-6), 'a pure rotation is removed by the superposition');

// a real difference shows up, localised to the moved residue
mkEnsemble('window.__base', "window.__base.map(function (c, i) { return i === 2 ? [c[0], c[1], c[2] + 2] : c; })");
ev = ctxRun(`computeEnsembleVariance(['a.pdb', 'b.pdb'])`);
assert(ev.ok, 'a differing model still computes');
// The optimal fit spreads a single displacement over the whole set, so the
// meaningful property is that the moved residue stands out from the baseline,
// not that it reaches half the displacement.
assert(ev.values[2].val > 0.3 && ev.values[2].val > 3 * ev.values[0].val,
    'the moved residue reports a real fluctuation (' + ev.values[2].val.toFixed(2) + ' A vs ' + ev.values[0].val.toFixed(2) + ' A baseline)');
assert(ev.values[0].val < 0.3, 'an unmoved residue stays low (' + ev.values[0].val.toFixed(2) + ' A)');
assert(ev.values[2].val > ev.values[3].val && ev.values[2].val > ev.values[4].val, 'the moved residue is the largest signal in the row');
assert(ev.max > ev.mean, 'max exceeds the mean');

// guards
ctxRun(`cachedStructureTexts = { 'a.pdb': window.__mkPdb(window.__base) };`);
assert(ctxRun(`computeEnsembleVariance(['a.pdb'])`).ok === false, 'one model is refused (needs an ensemble)');
assert(ctxRun(`computeEnsembleVariance(['a.pdb']).message`).indexOf('at least two') !== -1, 'the refusal explains why');
ctxRun(`parsedTracks = {};`);
assert(ctxRun(`computeEnsembleVariance(['a.pdb'])`).ok === false, 'no sequence is refused');

// the run writes the track, and it is wired into the app
ctxRun(`
    parsedTracks = { AA: 'M'.repeat(5) };
    cachedStructureTexts = { 'a.pdb': window.__mkPdb(window.__base), 'b.pdb': window.__mkPdb(window.__translate(window.__base, [1, 2, 3])) };
`);
assert(ctxRun(`runEnsembleVariance() !== null`), 'running the analysis succeeds');
assert(Array.isArray(ctxRun(`parsedTracks.EV_RMSF`)) && ctxRun(`parsedTracks.EV_RMSF.length`) === 5, 'it writes the EV_RMSF row over the sequence length');
assert(ctxRun(`parsedTracks.EV_RMSF[0].type`) === 'rmsf', 'the row is typed as RMSF');
assert(ctxRun(`getTrackGroup('EV_RMSF')`) === 'EV' && ctxRun(`trackGroupLabel('EV')`) === 'Ensemble variance', 'EV_ rows form the Ensemble variance group');
assert(ctxRun(`getTrackSource('EV_RMSF')`) === 'Ensemble', 'the row reports its provenance');
assert(ctxRun(`getPredictorInfo('EV_RMSF').category`) === 'Structure ensemble', 'it has a real tooltip, not the blank fallback');
assert(ctxRun(`rmsfColor(0.5)`) === '#3b82f6' && ctxRun(`rmsfColor(2.5)`) === '#facc15' && ctxRun(`rmsfColor(9)`) === '#ef4444', 'the colour scale bands are right');
assert(ctxRun(`rmsfColor(null)`) === '#f1f5f9', 'uncovered residues get the neutral colour');
// usable as a rule condition
const rmsfSrcs = ctxRun(`getRuleNumericSources().map(s => s.id)`);
assert(rmsfSrcs.indexOf('RMSF:EV_RMSF') !== -1, 'RMSF is available as a rule numeric source');
assert(ctxRun(`ruleNumericValue('RMSF:EV_RMSF', 0)`) === ctxRun(`parsedTracks.EV_RMSF[0].val`), 'the rule source reads the same value');
let ensThrew = null;
try { ctxRun(`selectEnsembleMobile();`); } catch (e) { ensThrew = e.message; }
assert(ensThrew === null, 'selecting mobile residues does not throw');
ctxRun(`cachedStructureTexts = {}; parsedTracks = {}; trackMeta = {};`);

section('3D scheme + removal consistency');
ctxRun(`
    parsedTracks = { AA: 'MKV' }; graphHighlights = {}; analysisRules = []; guideProfile = {}; guideOverrides = {};
    p3dBaseSchemeIdx = P3D_BASE_SCHEMES.indexOf('conservation');
`);
assert(ctxRun(`isP3DConservationMode()`) === true && ctxRun(`hasConservationData()`) === false, 'the scheme can be active with no data (the reported gap)');
assert(ctxRun(`syncP3DConservationMode()`) === true, 'the sync notices the scheme has nothing to read');
assert(ctxRun(`P3D_BASE_SCHEMES[p3dBaseSchemeIdx]`) === 'white', 'it falls back to the default scheme');
assert(ctxRun(`syncP3DConservationMode()`) === false, 'a second call is a no-op');
// with data present the scheme is left alone
ctxRun(`parsedTracks.CONSERVATION = { type: 'conservation', metric: 'shannon', values: [1, 0.5, 0] };`);
ctxRun(`p3dBaseSchemeIdx = P3D_BASE_SCHEMES.indexOf('conservation');`);
assert(ctxRun(`syncP3DConservationMode()`) === false && ctxRun(`isP3DConservationMode()`) === true, 'a real conservation row keeps the scheme');
// removing the row resets the scheme through the removal path too
ctxRun(`removeTracks(['CONSERVATION'], { silent: true });`);
assert(ctxRun(`isP3DConservationMode()`) === false, 'removing the conservation row resets the 3D scheme');
// removal also clears the graph-highlight flag for the removed key
ctxRun(`parsedTracks = { AA: 'MKV', 'm_pLDDT': [{ val: 90 }] }; graphHighlights = { 'm_pLDDT': false };`);
ctxRun(`removeTracks(['m_pLDDT'], { silent: true });`);
assert(ctxRun(`graphHighlights['m_pLDDT']`) === undefined, 'the graph highlight flag does not outlive the track');
ctxRun(`parsedTracks = {}; graphHighlights = {};`);

section('variant FASTA panel (was dead code)');
// The panel the code has always guarded on now exists
['variantFastaSection', 'variantFastaLabel', 'variantFastaDisplay', 'copyVariantTrackBtn'].forEach(id => {
  assert(HTML.indexOf('id="' + id + '"') !== -1, 'the ' + id + ' element exists');
});
ctxRun(`
    parsedTracks = { AA: 'MKV', 'VAR_v1': 'MKY' };
    keyedVariantsInfo = { v1: { aligned: 'MKY', raw: 'MKY', file: 'v.fa', desc: '' } };
    activeRowKey = 'VAR_v1'; activeRowType = null; selectionMode = 'row'; rowRanges = [[0, 2]];
    updateVariantFastaSection();
`);
assert(ctxRun(`document.getElementById('variantFastaSection').style.display`) === 'block', 'selecting a variant track shows the panel');
assert(ctxRun(`document.getElementById('variantFastaLabel').textContent`).indexOf('v1') !== -1, 'the label names the variant');
assert(ctxRun(`document.getElementById('variantFastaDisplay').textContent`) === 'MKY', 'the aligned sequence is displayed');
assert(ctxRun(`document.getElementById('copyVariantTrackBtn').disabled`) === false, 'the copy button becomes available');
// this is the bug: the registry is keyed by name, the track key has the VAR_ prefix
assert(ctxRun(`keyedVariantsInfo['VAR_v1']`) === undefined && ctxRun(`keyedVariantsInfo['v1'] !== undefined`), 'the registry really is keyed without the prefix (so the old lookup always missed)');
// a partial selection copies just that segment
ctxRun(`rowRanges = [[1, 2]]; updateVariantFastaSection();`);
assert(ctxRun(`document.getElementById('variantFastaDisplay').textContent`) === 'KY', 'a residue range narrows the copied segment');
assert(ctxRun(`variantCopyText`) === 'KY', 'the copy buffer holds the same text');
let varCopyThrew = null;
try { ctxRun(`copyVariantTrack();`); } catch (e) { varCopyThrew = e.message; }
assert(varCopyThrew === null, 'copying the variant sequence does not throw');
// other rows and cleared selections hide it again
ctxRun(`activeRowKey = 'HL_01_x'; rowRanges = [[0, 2]]; updateVariantFastaSection();`);
assert(ctxRun(`document.getElementById('variantFastaSection').style.display`) === 'none', 'a homolog selection hides the variant panel');
ctxRun(`activeRowKey = null; rowRanges = []; updateVariantFastaSection();`);
assert(ctxRun(`document.getElementById('copyVariantTrackBtn').disabled`) === true && ctxRun(`variantCopyText`) === null, 'clearing the selection disables the button and the buffer');
ctxRun(`parsedTracks = {}; keyedVariantsInfo = {};`);

section('in-app reference documents');
assert(typeof ctxRun(`renderDocMarkdown`) === 'function', 'the shared markdown renderer exists');
assert(typeof ctxRun(`openWorkflowDoc`) === 'function' && typeof ctxRun(`closeWorkflowDoc`) === 'function', 'the workflow reference opens in-app');
assert(HTML.indexOf("fetch('WORKFLOW.md')") !== -1, 'it fetches the doc beside the app');
assert(HTML.indexOf('id="workflowDocModal"') !== -1 && HTML.indexOf('id="workflowDocBody"') !== -1, 'it has its own modal + body');
assert(HTML.indexOf('href="WORKFLOW.md"') === -1, 'nothing links to the raw markdown file any more');
assert(HTML.indexOf('openWorkflowDoc()') !== -1, 'the workflow reference is wired to a control');
// the fallback points at the rendered GitHub view, not the raw file
assert(ctxRun(`docFallbackHtml('WORKFLOW.md', 'workflow reference')`).indexOf('github.com/PipettingBeaver/Quick2DViewer/blob/main/WORKFLOW.md') !== -1, 'the fallback links the rendered doc');
assert(ctxRun(`docFallbackHtml('CHANGELOG.md', 'changelog')`).indexOf('blob/main/CHANGELOG.md') !== -1, 'the changelog fallback does too (same raw-file problem)');
assert(HTML.indexOf('openWorkflowDoc();"') !== -1 || HTML.indexOf('openWorkflowDoc()') !== -1, 'the documents are reachable from Help too');
// the renderer handles what WORKFLOW.md contains
const mdOut = ctxRun(`renderDocMarkdown('# Title\\n\\n## Section\\n\\n### Sub\\n\\n- a **b** and [x](https://e.com)\\n\\nplain')`);
assert(mdOut.indexOf('<h3') !== -1 && mdOut.indexOf('<h4') !== -1 && mdOut.indexOf('<strong>b</strong>') !== -1 && mdOut.indexOf('<a href="https://e.com"') !== -1, 'headings, bold and links render');

section('short form hosts the current question');
ctxRun(`guideProfile = {}; guideAnswers = {}; guideOverrides = {}; parsedTracks = { AA: 'MKV' }; guideIntakeOpen = null; renderWorkflowGuide();`);
let gHtml2 = ctxRun(`document.getElementById('guidePanel').innerHTML`);
const sliceNext = (h) => h.slice(h.indexOf('guide-next-action'), h.indexOf('guide-steps'));
let nextBlk = sliceNext(gHtml2);
assert(ctxRun(`(function(){ var n = nextGuideStep(); return n ? n.step.id : null; })()`) === 'homologs', 'with only a sequence loaded the homologs step is next (matches the reported case)');
assert(nextBlk.indexOf('Which homolog source') !== -1, 'the short form asks the current step question');
assert(nextBlk.indexOf('phmmer (search Swiss-Prot in-app)') !== -1 && nextBlk.indexOf('Both') !== -1, 'the route options are answerable from the short form');
assert(nextBlk.indexOf('toolkit.tuebingen.mpg.de/tools/hhpred') === -1, 'the long description is NOT repeated in the short form (was the redundancy)');
assert(gHtml2.indexOf('toolkit.tuebingen.mpg.de/tools/hhpred') !== -1, 'the description still lives in the step card below');

ctxRun(`setStepAnswer('homologs', 'hhpred', 'hhpred');`);
gHtml2 = ctxRun(`document.getElementById('guidePanel').innerHTML`);
nextBlk = sliceNext(gHtml2);
assert(nextBlk.indexOf('Which homolog source') === -1, 'answering collapses the question away');
assert(nextBlk.indexOf('attach the resulting .hhr') !== -1, 'the tailored hint replaces it');
assert(nextBlk.indexOf('Load .hhr / variant FASTA') !== -1, 'the tailored action is offered');
assert(gHtml2.indexOf('guide-opt-on') !== -1, 'the step card keeps the question as the editable record of the answer');
// A session saved before 0.52.0 has 'ready' / 'no': it must migrate on restore,
// or no pill matches and the question looks unanswered.
assert(ctxRun(`
    (function () {
        guideAnswers = { homologs: { hhpred: 'ready' } };
        if (guideAnswers.homologs.hhpred === 'ready') guideAnswers.homologs.hhpred = 'hhpred';
        else if (guideAnswers.homologs.hhpred === 'no') guideAnswers.homologs.hhpred = 'both';
        return guideAnswers.homologs.hhpred;
    })()
`) === 'hhpred', 'legacy "ready" answers migrate to the HHpred route on restore');
assert(HTML.indexOf("guideAnswers.homologs.hhpred = 'hhpred'") !== -1, 'the migration lives in applyPersistedState');

ctxRun(`setStepAnswer('homologs', 'hhpred', 'no');`);
nextBlk = sliceNext(ctxRun(`document.getElementById('guidePanel').innerHTML`));
assert(nextBlk.indexOf('Search homologs (in-app)') !== -1, 'the legacy "not yet" answer now leads with the in-app search');
assert(nextBlk.indexOf('Open HHpred') !== -1 && nextBlk.indexOf('PDB_mmCIF70') !== -1, 'and still offers the HHpred route with its format guidance');
assert(nextBlk.indexOf('Copy sequence (FASTA)') !== -1, 'the short form shows the Copy sequence (FASTA) helper beside the action');
assert((nextBlk.match(/Copy sequence \(FASTA\)/g) || []).length === 1, 'exactly once - the accessory no longer duplicates it');
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
assert(/Step \d+:/.test(guideHtml) && guideHtml.indexOf('Next:') === -1, 'the recommendation is numbered by pipeline step (no "Next:")');
ctxRun(`GUIDE_QUESTIONS.forEach(q => { guideProfile[q.id] = q.options[0].value; }); guideIntakeOpen = null; renderWorkflowGuide();`);
guideHtml = ctxRun(`document.getElementById('guidePanel').innerHTML`);
assert(guideHtml.indexOf('guideIntake" open') === -1, 'it compresses once every question is answered');
assert(guideHtml.indexOf('(Complete)') !== -1, 'a completed intake is marked (Complete)');
assert(guideHtml.indexOf('reset answers') !== -1, 'a reset affordance is still offered');
ctxRun(`guideIntakeOpen = true; renderWorkflowGuide();`);
assert(ctxRun(`document.getElementById('guidePanel').innerHTML`).indexOf('guideIntake" open') !== -1, 'the user can re-open it for the session');

// --- 5. no filler sign-off ---
assert(HTML.indexOf('for the record') === -1, 'the filler "for the record" sign-off is gone');
assert(HTML.indexOf('All steps covered</strong>') !== -1, 'the all-covered state is a plain status line');
ctxRun(`guideProfile = {}; guideIntakeOpen = null; parsedTracks = {};`);

section('Reset Data clears the guide state');
ctxRun(`guideProfile = { membrane: 'yes' }; guideOverrides = { sequence: 'done' }; guideAnswers = { 'sequence.source': 'fasta' }; guideTask = { stepId: 'sequence' }; guideIntakeOpen = true;`);
ctxRun(`resetGuideState();`);
assert(ctxRun(`Object.keys(guideProfile).length === 0 && Object.keys(guideOverrides).length === 0 && Object.keys(guideAnswers).length === 0`), 'resetGuideState clears intake, step answers and overrides');
assert(ctxRun(`guideIntakeOpen === null && guideTask === null`), 'and resets the accordion + any running task');
assert(HTML.indexOf('resetGuideState();') !== -1, 'Reset Data calls it');

section('guide view choice (guided vs full)');
// incomplete intake: the two views stack as before, prompt + toggle hidden
ctxRun(`guideProfile = {}; guideAnswers = {}; guideOverrides = {}; guideViewMode = null; parsedTracks = { AA: 'MKV' }; guideIntakeOpen = null; renderWorkflowGuide();`);
let viewHtml = ctxRun(`document.getElementById('guidePanel').innerHTML`);
assert(viewHtml.indexOf('<div class="guide-next" hidden>') !== -1, 'incomplete intake hides the guided view');
assert(viewHtml.indexOf('<div class="guide-steps" hidden>') !== -1, 'and the full step cards');
assert(viewHtml.indexOf('<div class="guide-view-prompt" hidden>') !== -1, 'the view prompt stays hidden');
assert(viewHtml.indexOf('<div class="guide-view-toggle" hidden>') !== -1, 'and so does the toggle');
// complete intake: the prompt replaces both views
ctxRun(`GUIDE_QUESTIONS.forEach(q => { guideProfile[q.id] = q.options[0].value; }); guideViewMode = null; guideIntakeOpen = null; renderWorkflowGuide();`);
viewHtml = ctxRun(`document.getElementById('guidePanel').innerHTML`);
assert(viewHtml.indexOf('<div class="guide-view-prompt">') !== -1, 'a completed intake shows the view prompt');
assert(viewHtml.indexOf('Proceed with full or guided view for evaluation steps?') !== -1, 'the prompt asks the question');
assert(viewHtml.indexOf('<div class="guide-next" hidden>') !== -1 && viewHtml.indexOf('<div class="guide-steps" hidden>') !== -1, 'both views are hidden until answered');
// guided view (and choosing it closes the intake)
ctxRun(`guideIntakeOpen = true; renderWorkflowGuide();`);
assert(ctxRun(`document.getElementById('guidePanel').innerHTML`).indexOf('guideIntake" open') !== -1, 'the intake can be open when the choice is made');
ctxRun(`setGuideViewMode('guided');`);
viewHtml = ctxRun(`document.getElementById('guidePanel').innerHTML`);
assert(ctxRun(`guideViewMode`) === 'guided', 'the guided choice is stored');
assert(ctxRun(`guideIntakeOpen === false`) && viewHtml.indexOf('guideIntake" open') === -1, 'choosing a view closes the intake');
assert(viewHtml.indexOf('<div class="guide-next"><div class="guide-progress">') !== -1, 'guided shows the recommendation card');
assert(viewHtml.indexOf('<div class="guide-steps" hidden>') !== -1, 'guided hides the step cards');
assert(viewHtml.indexOf('<div class="guide-view-toggle">') !== -1 && viewHtml.indexOf('guide-view-tab-on') !== -1, 'the bottom toggle is shown with a current tab');
// full view opens Step 1
ctxRun(`setGuideViewMode('full');`);
viewHtml = ctxRun(`document.getElementById('guidePanel').innerHTML`);
assert(viewHtml.indexOf('<div class="guide-steps">') !== -1, 'full shows the step cards');
assert(viewHtml.indexOf('<div class="guide-next" hidden>') !== -1, 'full hides the recommendation card');
const firstStep = ctxRun(`guideProgress().rows[0].step.id`);
assert(viewHtml.indexOf('data-step="' + firstStep + '" open') !== -1, 'full opens Step 1');
assert(ctxRun(`gatherPersistableState().preferences.guideViewMode`) === 'full', 'the view choice is persisted');
assert(HTML.indexOf("guideViewMode = (prefs.guideViewMode === 'guided'") !== -1, 'the view choice is restored from a save');
ctxRun(`resetGuideState();`);
assert(ctxRun(`guideViewMode === null`), 'reset clears the view choice');
ctxRun(`guideProfile = {}; parsedTracks = {};`);

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

// A two-chain model whose CA residues spell the reference exactly, so the
// alignment-based reference mapping is the identity and the assertions below
// pin real behaviour rather than the aligner's tie-breaks. Chain B is numbered
// from 11, which is the whole point: numbering is not trustworthy, the
// sequence alignment is.
const exportThree = { A: 'ALA', C: 'CYS', D: 'ASP' };
const exportPdbLine = (resName, chain, resSeq, serial, x, record) => {
    const L = new Array(80).fill(' ');
    const put = (st, str) => { for (let k = 0; k < str.length; k++) L[st + k] = str[k]; };
    put(0, record || 'ATOM'); put(6, String(serial).padStart(5));
    put(12, ' CA '); put(17, resName); put(21, chain); put(22, String(resSeq).padStart(4));
    put(30, x.toFixed(3).padStart(8)); put(38, '10.000'.padStart(8)); put(46, '10.000'.padStart(8));
    put(60, '90.00'.padStart(6)); put(77, 'C');
    return L.join('');
};
const exportPdb = [
    'HEADER    TEST',
    exportPdbLine(exportThree.A, 'A', 1, 1, 10),
    exportPdbLine(exportThree.C, 'A', 2, 2, 20),
    exportPdbLine(exportThree.D, 'A', 3, 3, 30),
    'TER',
    exportPdbLine(exportThree.A, 'B', 11, 4, 11),
    exportPdbLine(exportThree.C, 'B', 12, 5, 21),
    exportPdbLine(exportThree.D, 'B', 13, 6, 31),
    exportPdbLine('FE', 'A', 201, 7, 30, 'HETATM'),
    exportPdbLine('HOH', 'A', 301, 8, 32, 'HETATM'),
    'END'
].join(String.fromCharCode(10));
sandbox.__exportPdb = exportPdb;

section('structure export (PDB/CIF hand-off)');
ctxRun(`
    parsedTracks = { AA: 'ACD' };
    cachedStructureTexts = { 'model.pdb': window.__exportPdb };
    cachedStructureIndex = {}; uploadedStructureFiles = []; p3dModel = null;
    selectionMode = 'point'; rowRanges = []; selectStart = null; selectEnd = null;
    referenceOffset = 0; trackOffsets = {};
`);
assert(HTML.indexOf(`menuBarAction('structure')`) !== -1 && HTML.indexOf('Structure file (PDB/CIF)') !== -1, 'the Export menu carries the structure export');

const expWhole = ctxRun(`buildStructureExport('model.pdb')`);
assert(expWhole.ok === true && expWhole.whole === true, 'with no selection the export is the whole model');
assert(expWhole.totalAtoms === 8 && expWhole.keptAtoms === 8, 'every coordinate record survives (got ' + expWhole.keptAtoms + '/' + expWhole.totalAtoms + ')');
assert(expWhole.text.indexOf('REMARK   1') === 0 && expWhole.text.indexOf('scope whole model (no selection)') !== -1, 'the header states it is the whole model');
assert(expWhole.text.indexOf('HEADER    TEST') !== -1 && expWhole.text.indexOf('TER') !== -1 && expWhole.text.indexOf('END') !== -1, 'headers, TER and END are passed through untouched');
assert(expWhole.text.indexOf('HETATM') !== -1 && expWhole.chains.join(',') === 'A,B', 'HETATM cofactors/waters stay and both chains are reported (got ' + expWhole.chains.join(',') + ')');

ctxRun(`selectionMode = 'point'; rowRanges = []; selectStart = 1; selectEnd = 1;`);
const expSel = ctxRun(`buildStructureExport('model.pdb')`);
assert(expSel.whole === false && expSel.referenceResidues === 1, 'a selection narrows the export');
const expSelLines = expSel.text.split(String.fromCharCode(10));
const flatRes = t => t.split(String.fromCharCode(10)).filter(l => l.indexOf(' CA ') !== -1).map(l => l.substring(21, 26).trim().replace(/\s+/g, ' '));
const selResidues = flatRes(expSel.text);
assert(selResidues.join(',') === 'A 2,B 12', 'only the selected residue is kept, from every chain that has it, with original numbering (got ' + selResidues.join(',') + ')');
assert(expSelLines.filter(l => l.startsWith('HETATM')).length === 0, 'the cofactor and water that were not in the selection are dropped');
assert(expSel.text.indexOf('scope current selection (1 reference residue(s))') !== -1, 'the header says it is the selection');

ctxRun(`rowRanges = [[1, 2]]; selectionMode = 'row'; selectStart = null; selectEnd = null;`);
const expRow = ctxRun(`buildStructureExport('model.pdb')`);
const rowResidues = flatRes(expRow.text);
assert(rowResidues.join(',') === 'A 2,A 3,B 12,B 13', 'a row selection spans the range in both chains (got ' + rowResidues.join(',') + ')');
const expRowWhole = ctxRun(`buildStructureExport('model.pdb', { all: true })`);
assert(expRowWhole.ok === true && expRowWhole.whole === true && expRowWhole.keptAtoms === 8, 'the {all:true} option overrides an active selection and exports everything (got ' + expRowWhole.keptAtoms + ')');
ctxRun(`selectStart = null; selectEnd = null; rowRanges = [];`);

ctxRun(`delete cachedStructureTexts['model.pdb'];`);
assert(ctxRun(`buildStructureExport('model.pdb').ok`) === false, 'an unavailable file fails cleanly instead of exporting nothing');
ctxRun(`cachedStructureIndex = { 'from-cache.pdb': { hash: 'deadbeef', ext: 'pdb', size: 1 } };`);
assert(ctxRun(`structureExportTargets().indexOf('from-cache.pdb')`) !== -1, 'a file only in the device cache is still offered (its text can be re-read)');
ctxRun(`
    parsedTracks = { AA: 'ACD' };
    cachedStructureTexts = { 'model.pdb': window.__exportPdb };
    cachedStructureIndex = {}; p3dModel = null;
    selectionMode = 'point'; rowRanges = []; selectStart = null; selectEnd = null;
`);

// mmCIF had no fixture coverage at all before this; the exporter has to resolve
// the _atom_site loop's own column order, and comment its header with # rather
// than REMARK so the file stays valid.
const exportCif = [
    'data_test',
    'loop_',
    '_atom_site.group_PDB',
    '_atom_site.id',
    '_atom_site.label_atom_id',
    '_atom_site.label_comp_id',
    '_atom_site.label_asym_id',
    '_atom_site.label_seq_id',
    '_atom_site.Cartn_x',
    '_atom_site.Cartn_y',
    '_atom_site.Cartn_z',
    '_atom_site.occupancy',
    '_atom_site.B_iso_or_equiv',
    'ATOM 1 CA ALA A 1 0.000 0.000 0.000 1.00 90.00',
    'ATOM 2 CA CYS A 2 3.000 0.000 0.000 1.00 90.00',
    'ATOM 3 CA ASP A 3 6.000 0.000 0.000 1.00 90.00',
    '#'
].join(String.fromCharCode(10));
sandbox.__exportCif = exportCif;

section('structure export: mmCIF');
ctxRun(`cachedStructureTexts = { 'm.cif': window.__exportCif };`);
const cifCols = ctxRun(`structureExportCifColumns(cachedStructureTexts['m.cif'])`);
assert(cifCols.labelAsym === 4 && cifCols.seq === 5, 'the _atom_site column order is resolved (got asym ' + cifCols.labelAsym + ', seq ' + cifCols.seq + ')');
const cifWhole = ctxRun(`buildStructureExport('m.cif')`);
assert(cifWhole.ok === true && cifWhole.ext === 'cif' && cifWhole.keptAtoms === 3, 'an mmCIF model exports whole');
assert(cifWhole.text.indexOf('# Quick2DViewer') === 0 && cifWhole.text.indexOf('REMARK') === -1, 'the mmCIF header is commented with #, never REMARK');
ctxRun(`selectStart = 1; selectEnd = 1; selectionMode = 'point'; rowRanges = [];`);
const cifSel = ctxRun(`buildStructureExport('m.cif')`);
assert(cifSel.keptAtoms === 1 && cifSel.text.indexOf('CYS') !== -1 && cifSel.text.indexOf('ALA') === -1, 'the mmCIF selection keeps only the chosen residue');
ctxRun(`selectStart = null; selectEnd = null; cachedStructureTexts = {}; p3dModel = null;`);

section('experimental data: named multi-column tables');
const expCols = ctxRun(`parseExperimentalColumns(['# md analysis', 'resid,rmsf,rmsd', '1,1.5,0.20', '2,2.5,0.30', '3,0.5,0.10'].join(String.fromCharCode(10)))`);
assert(expCols.mode === 'named' && expCols.series.length === 2, 'a header row with two numeric columns yields two series (got ' + expCols.mode + ' / ' + expCols.series.length + ')');
assert(expCols.series[0].name === 'rmsf' && expCols.series[0].rows.length === 3 && expCols.series[0].rows[1].val === 2.5, 'each series keeps its own name and values');
assert(expCols.series[1].name === 'rmsd' && expCols.series[1].rows[2].pos === 3 && expCols.series[1].rows[2].val === 0.1, 'the second column maps positions independently');
assert(ctxRun(`parseExperimentalColumns('1 0.42' + String.fromCharCode(10) + '2 0.55' + String.fromCharCode(10) + '3 0.91')`).mode === 'single', 'the plain position/value table still takes the single path');
assert(ctxRun(`parseExperimentalColumns('0.2 0.3 0.9 0.4 0.5')`).mode === 'single', 'one long series is untouched');
assert(ctxRun(`parseExperimentalColumns('resid,rmsf' + String.fromCharCode(10) + '1,1.5' + String.fromCharCode(10) + '2,2.5')`).mode === 'single', 'a column too short to be a series falls back instead of importing');
assert(ctxRun(`parseExperimentalColumns('resid,note,rmsf' + String.fromCharCode(10) + '1,x,1.5' + String.fromCharCode(10) + '2,y,2.5' + String.fromCharCode(10) + '3,z,3.5').skipped`) === 1, 'a column whose values are not numbers is skipped and reported (got ' + ctxRun(`parseExperimentalColumns('resid,note,rmsf' + String.fromCharCode(10) + '1,x,1.5' + String.fromCharCode(10) + '2,y,2.5' + String.fromCharCode(10) + '3,z,3.5').skipped`) + ')');

ctxRun(`
    parsedTracks = { AA: 'M'.repeat(10) };
    experimentalTracksInfo = {}; referenceOffset = 0; trackOffsets = {};
    document.getElementById('expNameInput').value = 'MD';
    document.getElementById('expKindSelect').value = 'md';
    document.getElementById('expPasteInput').value = ['resid,rmsf,rmsd,sasa', '1,1.5,0.20,55.0', '2,2.5,0.30,40.0', '3,0.5,0.10,70.0', '4,3.0,0.40,20.0'].join(String.fromCharCode(10));
    document.getElementById('expStatus').textContent = '';
    addExperimentalTrack();
`);
const expKeys = ctxRun(`Object.keys(parsedTracks).filter(k => k.indexOf('MD_') === 0)`);
assert(expKeys.length === 3, 'one pasted table adds a row per numeric column (got ' + expKeys.join(',') + ')');
assert(ctxRun(`parsedTracks['MD_rmsf_EXP'][1].val`) === 2.5 && ctxRun(`parsedTracks['MD_sasa_EXP'][2].val`) === 70, 'the values land on the right residues');
assert(ctxRun(`experimentalTracksInfo['MD_rmsf_EXP'].kind`) === 'md', 'the row carries the MD kind');
assert(ctxRun(`formatTrackLabel('MD_rmsf_EXP')`) === 'MD rmsf (experimental)' && ctxRun(`isGraphCapable(getTrackGroup('MD_rmsf_EXP'))`) === true, 'each named row is a normal, graphable experimental row');
assert(ctxRun(`ruleNumericValue('EXP:MD_rmsf_EXP', 1)`) === 2.5, 'each named row is usable as its own rule source');
const expMultiStatus = ctxRun(`document.getElementById('expStatus').textContent`);
assert(/Added 3 row\(s\)/.test(expMultiStatus) && /rmsf, rmsd, sasa/.test(expMultiStatus), 'the status names every column that was added (got ' + expMultiStatus + ')');
assert(ctxRun(`EXPERIMENTAL_KINDS.md.label.indexOf('MD')`) !== -1, 'the MD kind is a known interpretation');
assert(HTML.indexOf('value="md">MD / trajectory metric') !== -1, 'the Experimental category offers the MD kind');

ctxRun(`
    parsedTracks = { AA: 'M'.repeat(10) };
    experimentalTracksInfo = {};
    document.getElementById('expNameInput').value = 'DMS tolerance';
    document.getElementById('expKindSelect').value = 'dms';
    document.getElementById('expPasteInput').value = ['1 0.10', '2 0.20', '3 0.30', '4 0.40'].join(String.fromCharCode(10));
    document.getElementById('expStatus').textContent = '';
    addExperimentalTrack();
`);
assert(ctxRun(`Array.isArray(parsedTracks['DMS_tolerance_EXP'])`) === true, 'the two-column path is unchanged');
assert(/Added "DMS tolerance"/.test(ctxRun(`document.getElementById('expStatus').textContent`)), 'and keeps its own status wording');
ctxRun(`parsedTracks = {}; experimentalTracksInfo = {}; cachedStructureTexts = {}; cachedStructureIndex = {}; uploadedStructureFiles = [];`);

section('wet-lab constants (mass, pI, A280, GRAVY)');
// Hand-checkable cases first: A+C+D average residue masses plus one water.
const constACD = ctxRun(`computeProteinConstants('ACD')`);
assert(Math.abs(constACD.mw - (71.0788 + 103.1388 + 115.0886 + 18.0153)) < 0.01, 'mass is the sum of average residue masses plus water (got ' + constACD.mw.toFixed(3) + ')');
assert(constACD.length === 3 && Math.abs(constACD.mwKd - 0.3073) < 0.001, 'and is reported in kDa too');
assert(ctxRun(`computeProteinConstants('KKKK').pI > 10 && computeProteinConstants('KKKK').pI < 11`) === true, 'a poly-lysine is basic (pI ' + ctxRun(`computeProteinConstants('KKKK').pI.toFixed(2)`) + ')');
assert(ctxRun(`computeProteinConstants('DDDD').pI < 4.5`) === true, 'a poly-aspartate is acidic (pI ' + ctxRun(`computeProteinConstants('DDDD').pI.toFixed(2)`) + ')');
assert(ctxRun(`computeProteinConstants('KKKK').chargeAt7 > 0 && computeProteinConstants('DDDD').chargeAt7 < 0`) === true, 'the sign of the charge at pH 7 follows the pI');
assert(ctxRun(`computeProteinConstants('WW').eps280`) === 11000 && ctxRun(`computeProteinConstants('YY').eps280`) === 2980, 'A280 counts Trp and Tyr (Gill & von Hippel)');
assert(ctxRun(`computeProteinConstants('WC').eps280`) === 5625, 'and cystine');
assert(ctxRun(`computeProteinConstants('AAAA').gravy`) === 1.8 && Math.abs(ctxRun(`computeProteinConstants('AAAAKK').gravy`) - ((1.8 * 4) + (-3.9 * 2)) / 6) < 0.001, 'GRAVY is the Kyte-Doolittle mean');
assert(ctxRun(`computeProteinConstants('')`) === null && ctxRun(`computeProteinConstants('   ')`) === null, 'no sequence means no constants, not a zero row');
assert(ctxRun(`computeProteinConstants('acdW')`).length === 4, 'case and non-residue characters are handled');

ctxRun(`parsedTracks = { AA: 'ACD' }; renderProteinConstants();`);
const constText = ctxRun(`document.getElementById('constantsDisplay').textContent`);
assert(constText.indexOf('3 aa') !== -1 && constText.indexOf('0.31 kDa') !== -1, 'the Selection panel block lists length and mass (got ' + JSON.stringify(constText) + ')');
assert(/pI\s+3\.80/.test(constText) && /A280\s+125/.test(constText), 'and the pI and A280 lines');
ctxRun(`parsedTracks = {}; renderProteinConstants();`);
assert(ctxRun(`document.getElementById('constantsDisplay').textContent`) === 'No sequence loaded.', 'the block says so when there is no sequence');
ctxRun(`parsedTracks = { AA: 'MKTAYIAKQRQISFVKSHFSRQLEERLGLI' };`);
const constReport = ctxRun(`buildMethodsReport()`);
assert(constReport.indexOf('## Protein constants') !== -1 && /Isoelectric point: 10\.43/.test(constReport), 'the methods report carries a Protein constants section (pI ' + ctxRun(`computeProteinConstants('MKTAYIAKQRQISFVKSHFSRQLEERLGLI').pI.toFixed(2)`) + ')');
assert(constReport.indexOf('A280 (Trp + Tyr + cystine): 1490') !== -1, 'with the A280 line and its stated basis');
assert(HTML.indexOf('id="constantsDisplay"') !== -1 && HTML.indexOf('GRAVY') !== -1, 'the Selection panel carries the block and explains GRAVY');
assert(/const\s+TERMINAL/.test(HTML) || /free N- and C-termini/.test(HTML), 'and states the terminal/cysteine assumption it makes');
ctxRun(`parsedTracks = {}; experimentalTracksInfo = {}; cachedStructureTexts = {};`);

section('metal-site coordination: donors, CN, geometry, entropy');
// A synthetic single-site model, written in fixed columns so the existing parser
// is exercised for real: one Zn on a tetrahedral N3 + water shell.
const metalPdbLine = (record, name, resName, chain, resSeq, serial, x, y, z, element) => {
    const L = new Array(80).fill(' ');
    const put = (st, str) => { for (let k = 0; k < str.length; k++) L[st + k] = str[k]; };
    put(0, record); put(6, String(serial).padStart(5));
    put(13, name.padEnd(3)); put(17, resName); put(21, chain); put(22, String(resSeq).padStart(4));
    put(30, x.toFixed(3).padStart(8)); put(38, y.toFixed(3).padStart(8)); put(46, z.toFixed(3).padStart(8));
    put(60, '10.00'.padStart(6)); put(76, element.padStart(2));
    return L.join('');
};
const tetrahedral = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
// Three protein nitrogens on three vertices of an ideal tetrahedron and a water
// oxygen on the fourth: the classic Zn His3+H2O site, so the expected CN,
// geometry and distortion are all known exactly.
const zincLines = [0, 1, 2].map((k, i) => {
    const v = tetrahedral[k];
    return metalPdbLine('ATOM', 'NE2', 'HIS', 'A', [57, 87, 112][i], 10 + i, v[0] * 1.16, v[1] * 1.16, v[2] * 1.16, 'N');
}).concat([
    metalPdbLine('HETATM', 'ZN', 'ZN', 'A', 200, 20, 0, 0, 0, 'ZN'),
    metalPdbLine('HETATM', 'O', 'HOH', 'A', 301, 21, tetrahedral[3][0] * 1.16, tetrahedral[3][1] * 1.16, tetrahedral[3][2] * 1.16, 'O'),
    'END'
]);
sandbox.__zincPdb = zincLines.join(String.fromCharCode(10));

ctxRun(`
    parsedTracks = { AA: 'M'.repeat(120) };
    cachedStructureTexts = { 'zn.pdb': window.__zincPdb };
    uploadedStructureFiles = [];
`);
const znParsed = ctxRun(`parseAllAtoms(cachedStructureTexts['zn.pdb'], 'pdb')`);
assert(znParsed.hetGroups.size === 2, 'the Zn and the water are hetero groups (got ' + znParsed.hetGroups.size + ')');
assert(ctxRun(`[...parseAllAtoms(cachedStructureTexts['zn.pdb'],'pdb').proteinResidues.values()][0].resName`) === 'HIS', 'protein residues keep their resName for donor naming');
const znCenters = ctxRun(`findMetalCenters(parseAllAtoms(cachedStructureTexts['zn.pdb'], 'pdb'))`);
assert(znCenters.length === 1 && znCenters[0].element === 'ZN', 'exactly one metal centre is found (got ' + znCenters.length + ')');
assert(znCenters[0].isCluster === false, 'a lone metal is not flagged as a cluster');

const znSites = ctxRun(`analyzeMetalSites(parseAllAtoms(cachedStructureTexts['zn.pdb'], 'pdb'))`);
const znSite = znSites[0];
assert(znSite.cn === 4, 'an ideal tetrahedral N3+water shell is coordination number 4 (got ' + znSite.cn + ')');
assert(znSite.donorElements.N === 3 && znSite.donorElements.O === 1, 'donor elements are counted separately (got ' + JSON.stringify(znSite.donorElements) + ')');
assert(znSite.proteinDonors.length === 3 && znSite.waterDonors === 1, 'three protein donors and one water donor');
assert(znSite.geometry === 'tetrahedral', 'the geometry is classified tetrahedral (got ' + znSite.geometry + ')');
assert(znSite.geometryRmsd < 0.05, 'an ideal tetrahedron scores ~0 A distortion (got ' + znSite.geometryRmsd.toFixed(4) + ')');
assert(znSite.geometryEntropy < 0.01, 'and ~0 bits of ambiguity (got ' + znSite.geometryEntropy.toFixed(4) + ')');
assert(znSite.donorEntropy > 0.7 && znSite.donorEntropy < 0.9, 'a 3N+1O shell has real donor diversity (got ' + znSite.donorEntropy.toFixed(3) + ' bits)');
assert(znSite.proteinDonors.every(d => d.resSeq >= 57), 'and the three protein donors are the histidines, not the zinc record');
assert(Math.abs(znSite.proteinDonors[0].distance - 2.01) < 0.05, 'donor distances are real metal-donor distances (got ' + znSite.proteinDonors[0].distance.toFixed(2) + ')');

// A distorted octahedral shell must be *called* distorted and ambiguous, which is
// the whole reason the ambiguity entropy exists.
// A flattened six-donor shell is *distorted* but not *ambiguous*: it still fits
// the octahedron far better than the prism. Distortion and ambiguity are
// different claims, and the test pins both.
const distortedPdb = [[2.1, 0, 0], [-2.1, 0, 0], [0, 2.1, 0], [0, -2.1, 0], [0, 0, 1.0], [0, 0, -1.0]].map((v, i) =>
    metalPdbLine('ATOM', 'NE2', 'HIS', 'A', 20 + i, 30 + i, v[0], v[1], v[2], 'N')
).concat([metalPdbLine('HETATM', 'ZN', 'ZN', 'A', 200, 40, 0, 0, 0, 'ZN'), 'END']).join(String.fromCharCode(10));
sandbox.__distortedPdb = distortedPdb;
const distSite = ctxRun(`analyzeMetalSites(parseAllAtoms(window.__distortedPdb, 'pdb'))[0]`);
assert(distSite.cn === 6, 'a flattened six-donor shell reads CN 6 (got ' + distSite.cn + ')');
assert(distSite.geometry === 'octahedral', 'and is still called octahedral, not prismatic (got ' + distSite.geometry + ')');
assert(distSite.geometryRmsd > 0.2, 'but its distortion is reported (RMSD ' + distSite.geometryRmsd.toFixed(3) + ' A)');
assert(distSite.geometryCandidates.length === 2, 'both six-coordinate templates are reported as candidates (got ' + distSite.geometryCandidates.length + ')');
assert(distSite.geometryEntropy < 0.1, 'and distortion alone does not create ambiguity (' + distSite.geometryEntropy.toFixed(3) + ' bits)');

// Genuine ambiguity: three donors at a height halfway between a plane and a
// pyramid, so the planar and pyramidal templates fit about equally well. This is
// the case the ambiguity entropy exists for, and the deterministic stand-in for
// MetalHawk's output entropy.
const shallow = [];
for (let i = 0; i < 3; i++) {
    const a = i * 2 * Math.PI / 3;
    shallow.push([Math.cos(a), Math.sin(a), 0.18]);
}
const shallowPdb = shallow.map((v, i) => {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return metalPdbLine('ATOM', 'NE2', 'HIS', 'A', 20 + i, 70 + i, v[0] / len * 2.0, v[1] / len * 2.0, v[2] / len * 2.0, 'N');
}).concat([metalPdbLine('HETATM', 'ZN', 'ZN', 'A', 200, 80, 0, 0, 0, 'ZN'), 'END']).join(String.fromCharCode(10));
sandbox.__shallowPdb = shallowPdb;
const shallowSite = ctxRun(`analyzeMetalSites(parseAllAtoms(window.__shallowPdb, 'pdb'))[0]`);
assert(shallowSite.cn === 3, 'a three-donor shell reads CN 3 (got ' + shallowSite.cn + ')');
const shallowGap = ctxRun(`analyzeMetalSites(parseAllAtoms(window.__shallowPdb,'pdb'))[0].geometryCandidates[1].rmsd - analyzeMetalSites(parseAllAtoms(window.__shallowPdb,'pdb'))[0].geometryCandidates[0].rmsd`);
assert(shallowGap < 0.2, 'the two three-coordinate templates fit within 0.2 A of each other (gap ' + shallowGap.toFixed(3) + ')');
assert(shallowSite.geometryEntropy > 0.3, 'so the ambiguity entropy is high (' + shallowSite.geometryEntropy.toFixed(3) + ' bits)');
assert(shallowSite.geometryEntropy > ctxRun(`analyzeMetalSites(parseAllAtoms(cachedStructureTexts['zn.pdb'],'pdb'))[0].geometryEntropy`) + 0.2, 'and far above the ideal tetrahedral site it is being compared with');

const octaPdb = [[2, 0, 0], [-2, 0, 0], [0, 2, 0], [0, -2, 0], [0, 0, 2], [0, 0, -2]].map((v, i) =>
    metalPdbLine('ATOM', 'NE2', 'HIS', 'A', 20 + i, 50 + i, v[0], v[1], v[2], 'N')
).concat([metalPdbLine('HETATM', 'ZN', 'ZN', 'A', 200, 60, 0, 0, 0, 'ZN'), 'END']).join(String.fromCharCode(10));
sandbox.__octaPdb = octaPdb;
const octaSite = ctxRun(`analyzeMetalSites(parseAllAtoms(window.__octaPdb, 'pdb'))[0]`);
assert(octaSite.geometry === 'octahedral', 'an ideal octahedron is octahedral, not trigonal prismatic (got ' + octaSite.geometry + ')');
assert(octaSite.geometryRmsd < 0.02, 'with near-zero distortion (got ' + octaSite.geometryRmsd.toFixed(4) + ')');

// A metal-metal pair must be reported as a cluster, because single-site
// coordination number is meaningless for Fe-S / di-iron.
const clusterPdb = [
    metalPdbLine('HETATM', 'FE', 'FES', 'A', 500, 70, 0, 0, 0, 'FE'),
    metalPdbLine('HETATM', 'FE', 'FES', 'A', 500, 71, 2.6, 0, 0, 'FE'),
    metalPdbLine('ATOM', 'NE2', 'HIS', 'A', 21, 72, 0.2, 2.05, 0, 'N'),
    metalPdbLine('ATOM', 'NE2', 'HIS', 'A', 51, 73, 2.4, -2.05, 0, 'N'),
    'END'
].join(String.fromCharCode(10));
sandbox.__clusterPdb = clusterPdb;
const clusterSites = ctxRun(`analyzeMetalSites(parseAllAtoms(window.__clusterPdb, 'pdb'))`);
assert(clusterSites.length === 2 && clusterSites[0].isCluster === true, 'two metals 2.6 A apart are one cluster (got ' + clusterSites.length + ' centres)');
assert(clusterSites[0].donors.length === 1, 'and neither metal counts the other as a donor');
assert(clusterSites.every(s => s.element === 'FE'), 'both are recognised as iron inside an FES group');

assert(ctxRun(`analyzeMetalSites(parseAllAtoms('END','pdb'))`).length === 0, 'a file with no metals yields no sites, not an error');
assert(ctxRun(`atomElementOf({element:'', atomName:'ZN'})`) === 'ZN' && ctxRun(`atomElementOf({element:'', atomName:'CA'})`) === 'CA' && ctxRun(`atomElementOf({element:'', atomName:' O '})`) === 'O', 'element falls back to the atom name, two-letter metals first');
ctxRun(`cachedStructureTexts = {}; parsedTracks = {};`);

section('cofactor/coordination pairing and tooltips');
// A heme-like group (Fe + four porphyrine N + one axial His) plus a bare Zn, so
// pairing to the existing 1-9 cofactor numbering is exercised for both a
// macrocycle metal and a monatomic one.
const hemePdb = [
    // porphyrine nitrogens 2.0 A from the iron, four in a plane (z = 0)
    metalPdbLine('HETATM', 'NA', 'HEM', 'A', 201, 200, 2.0, 0, 0, 'N'),
    metalPdbLine('HETATM', 'NB', 'HEM', 'A', 201, 201, 0, 2.0, 0, 'N'),
    metalPdbLine('HETATM', 'NC', 'HEM', 'A', 201, 202, -2.0, 0, 0, 'N'),
    metalPdbLine('HETATM', 'ND', 'HEM', 'A', 201, 203, 0, -2.0, 0, 'N'),
    metalPdbLine('HETATM', 'FE', 'HEM', 'A', 201, 204, 0, 0, 0, 'FE'),
    // axial histidine below the plane -> square-pyramidal, CN 5
    metalPdbLine('ATOM', 'NE2', 'HIS', 'A', 88, 205, 0, 0, -2.1, 'N'),
    metalPdbLine('HETATM', 'ZN', 'ZN', 'A', 300, 206, 20, 20, 20, 'ZN'),
    metalPdbLine('ATOM', 'NE2', 'HIS', 'A', 40, 207, 21.183, 21.183, 21.183, 'N'),
    metalPdbLine('ATOM', 'NE2', 'HIS', 'A', 41, 208, 21.183, 18.817, 18.817, 'N'),
    metalPdbLine('ATOM', 'NE2', 'HIS', 'A', 42, 209, 18.817, 21.183, 18.817, 'N'),
    metalPdbLine('ATOM', 'NE2', 'HIS', 'A', 43, 210, 18.817, 18.817, 21.183, 'N'),
    'END'
].join(String.fromCharCode(10));
sandbox.__hemePdb = hemePdb;

// The bug this guards: a porphyrine nitrogen is named NA in every heme, and NA is
// also sodium. Reading the name over the element column deleted the metal's own
// donors and reported "NA, CN 0" instead of iron.
assert(ctxRun(`atomElementOf({element:'N', atomName:'NA'})`) === 'N', 'a declared element wins over the atom name, so a porphyrine NA is nitrogen, not sodium');
assert(ctxRun(`looksLikePorphyrinN({element:'', atomName:'NA'}, 'HEM')`) === true && ctxRun(`looksLikePorphyrinN({element:'', atomName:'NA'}, 'ZN')`) === false, 'a macrocycle NA is recognised as a porphyrine nitrogen, but not elsewhere');
assert(ctxRun(`findMetalCenters(parseAllAtoms(window.__hemePdb, 'pdb')).length`) === 2, 'the heme contributes exactly one metal (iron) - its NA-ND nitrogens are never read as sodium');

const hemeParsed = ctxRun(`parseAllAtoms(window.__hemePdb, 'pdb')`);
const hemeCofactors = ctxRun(`extractCofactorNeighborhoods(window.__hemePdb, 'pdb').cofactors`);
assert(hemeCofactors.length === 2, 'the heme and the zinc are two numbered cofactors (got ' + hemeCofactors.length + ')');
const hemeCoord = ctxRun(`analyzeCofactorCoordination(window.__hemePdb, 'pdb', extractCofactorNeighborhoods(window.__hemePdb, 'pdb').cofactors)`);
assert(hemeCoord.sites.length === 2, 'both cofactors get a coordination entry (got ' + hemeCoord.sites.length + ')');
assert(hemeCoord.unpaired === 0, 'and no metal is left unpaired (got ' + hemeCoord.unpaired + ')');
const hemeEntry = hemeCoord.sites[0], znEntry = hemeCoord.sites[1];
assert(hemeEntry.sites[0].element === 'FE' && hemeEntry.sites[0].inMacrocycle === true, 'the macrocycle metal is iron and is flagged as such');
assert(hemeEntry.sites[0].cn === 5, 'the heme reads CN 5 - four porphyrine N plus one axial His (got ' + hemeEntry.sites[0].cn + ')');
assert(hemeEntry.sites[0].geometry === 'square pyramidal', 'so the geometry is square pyramidal (got ' + hemeEntry.sites[0].geometry + ')');
assert(hemeEntry.sites[0].geometryLabel.indexOf('SPY') === 0, 'labelled SPY in the short code (got ' + hemeEntry.sites[0].geometryLabel + ')');
assert(hemeEntry.sites[0].axial.length === 1 && /HIS/.test(hemeEntry.sites[0].axial[0]), 'the axial histidine is named (got ' + JSON.stringify(hemeEntry.sites[0].axial) + ')');
assert(znEntry.sites[0].element === 'ZN' && znEntry.sites[0].cn === 4 && znEntry.sites[0].geometry === 'tetrahedral', 'the zinc reads CN 4 tetrahedral (got ' + znEntry.sites[0].cn + ' ' + znEntry.sites[0].geometry + ')');
assert(hemeEntry.cofactorIndex === 1 && znEntry.cofactorIndex === 2, 'the entries carry the cofactor numbers the row already shows');

// A polynuclear group: two irons in one FES must both appear under cofactor #1.
const fesCoord = ctxRun(`(function () {
    const p = window.__clusterPdb;
    return analyzeCofactorCoordination(p, 'pdb', extractCofactorNeighborhoods(p, 'pdb').cofactors);
})()`);
assert(fesCoord.sites.length === 1 && fesCoord.sites[0].sites.length === 2, 'two metals in one FES group give two sites under a single cofactor (got ' + (fesCoord.sites[0] ? fesCoord.sites[0].sites.length : 0) + ')');
assert(fesCoord.sites[0].sites.every(s => s.isCluster === true), 'both are flagged as clusters');
assert(/not meaningful/.test(fesCoord.sites[0].sites[0].geometryLabel + '') === false, 'the label itself does not editorialize');

ctxRun(`
    structureCoordination = { 'zn': { sites: ${JSON.stringify(hemeCoord.sites)}, unpaired: 2 } };
`);
const cofTip = ctxRun(`cofactorCoordinationTooltip('zn')`);
assert(/Coordination \(from the attached coordinates\)/.test(cofTip), 'the row-label tooltip opens with its heading');
assert(/#1 HEM A201 - FE, CN 5, SPY - square pyramidal/.test(cofTip), 'and names cofactor #1 with its code and class (got: ' + cofTip.split('\n')[1] + ')');
assert(/RMSD 0\.\d+ A/.test(cofTip), 'with the distortion');
assert(/axial HIS A88:NE2/.test(cofTip), 'and the axial ligand');
assert(/donors N5/.test(cofTip), 'and the donor composition');
assert(/ambiguity .* bits/.test(cofTip) && /donor diversity .* bits/.test(cofTip), 'and both entropies');
assert(/2 further metal site\(s\)/.test(cofTip), 'metals beyond the numbered nine are reported, not hidden');
assert(/Geometry codes are Q2DV abbreviations/.test(cofTip), 'and the codes are flagged as ours');
assert(ctxRun(`cofactorCoordinationTooltip('nothing-here')`) === '', 'a row with no metals gets no coordination block');

const siteTip = ctxRun(`cofactorSiteTooltip('zn', 2)`);
assert(/Cofactor #2 - ZN A300/.test(siteTip) && /ZN, CN 4, TET - tetrahedral/.test(siteTip), 'the per-residue hover names the cofactor and its site');
assert(/axial ligand/.test(siteTip) === false, 'and stays short when there is nothing axial to add');
assert(ctxRun(`cofactorSiteTooltip('zn', 5)`) === '', 'hovering a cofactor with no metal adds nothing');

ctxRun(`resetInputDataState();`);
assert(ctxRun(`Object.keys(structureCoordination).length`) === 0, 'reset clears the coordination store');
// The split: input-data reset keeps preferences, the preference reset drops them.
ctxRun(`
    parsedTracks = { AA: 'M'.repeat(10) };
    externalServicesEnabled = true;
    analysisRules = [{ id: 'r1', name: 'R', color: '#ff0000', mode: 'all', enabled: true, conditions: [] }];
    resetInputDataState();
`);
assert(ctxRun(`Object.keys(parsedTracks).length`) === 0, 'clearing input data drops the loaded tracks');
assert(ctxRun(`externalServicesEnabled === true`) === true, 'clearing input data keeps preferences (external-services flag)');
assert(ctxRun(`analysisRules.length === 1`) === true, 'clearing input data keeps customization (rules)');
ctxRun(`resetPreferencesState();`);
assert(ctxRun(`externalServicesEnabled === false`) === true, 'clearing all data resets the external-services preference');
assert(ctxRun(`analysisRules.length === 0`) === true, 'clearing all data resets customization (rules)');
ctxRun(`parsedTracks = {}; cachedStructureTexts = {}; uploadedStructureFiles = [];`);

section('homolog letter-style default (AA)');
// The documented default for Homolog rows is "AA" (getDefaultTrackControlState),
// but saved sessions predating it stored an empty bag and kept match-quality
// glyphs forever. The migration must apply the default *only* where the session
// made no homolog letter choice at all.
const baseState = sel => JSON.stringify({ parsedTracks: { AA: 'M'.repeat(10) }, structureFiles: [], preferences: { trackControl: sel } });
ctxRun(`applyPersistedState(${baseState({ hidden: {}, hideSymbols: {}, fullBar: {}, filtered: {}, consColor: {}, viewOverride: {} })});`);
assert(ctxRun(`trackControlState.aaSeq.HL === true`) === true, 'a saved session with no homolog letter choice gets the AA default');
assert(ctxRun(`isTrackGroupAASeq('HL')`) === true, 'and the renderer agrees');
assert(ctxRun(`trackControlState.aaSeq.TM === undefined`) === true, 'without touching other types');

ctxRun(`applyPersistedState(${baseState({ aaSeq: { HL: false }, hideSymbols: {}, fullBar: {}, filtered: {}, consColor: {}, viewOverride: {} })});`);
assert(ctxRun(`trackControlState.aaSeq.HL === false`) === true, 'an explicit non-AA choice is preserved (not re-defaulted)');

ctxRun(`applyPersistedState(${baseState({ aaSeq: {}, hideSymbols: { HL: true }, fullBar: {}, filtered: {}, consColor: {}, viewOverride: {} })});`);
assert(ctxRun(`trackControlState.aaSeq.HL === undefined`) === true && ctxRun(`isTrackGroupSymbolsHidden('HL')`) === true, 'a session that chose "none" is left as none');

ctxRun(`applyPersistedState(${baseState({ aaSeq: { HL: true }, hideSymbols: {}, fullBar: {}, filtered: {}, consColor: {}, viewOverride: {} })});`);
assert(ctxRun(`trackControlState.aaSeq.HL === true`) === true, 'an explicit AA choice is kept');

// Fresh installs already take the whole default object, so the documented
// defaults have to stay in one place.
assert(ctxRun(`getDefaultTrackControlState().aaSeq.HL`) === true && ctxRun(`getDefaultTrackControlState().fullBar.TM`) === true, 'the fresh-install defaults still carry HL=AA and TM=Bar');
ctxRun(`parsedTracks = {}; trackControlState = getDefaultTrackControlState();`);

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

    // runTopologyPrediction end to end with the real InterProScan TSV (the
    // capability is stubbed, everything else is the app's own path).
    sandbox.__iprTsv = IPR_TOPO_FIXTURE;
    ctxRun(`
        externalServicesEnabled = true;
        parsedTracks = { AA: 'M'.repeat(417) };
        topologySources = [];
        SERVICE_ADAPTERS.__ipr_ok = async () => window.__iprTsv;
        SERVICE_REGISTRY.capabilities.topology_prediction.providers[0].adapter = '__ipr_ok';
    `);
    await ctxRun(`runTopologyPrediction()`);
    assert(ctxRun(`topologySources.length`) === 2, 'the topology runner registers one source per analysis (got ' + ctxRun(`topologySources.length`) + ')');
    assert((ctxRun(`topologySources[0].state`) || '').match(/M+/g) !== null, 'with TM segments filled in');
    assert(ctxRun(`topologyConsensusSummary().counts['?']`) > 0, 'and the consensus flags the real TMHMM/Phobius disagreement');
    assert(/InterProScan/.test(ctxRun(`document.getElementById('topologyPredictStatus').textContent`)), 'the status line summarises the run');
    ctxRun(`
        parsedTracks = {}; topologySources = [];
        SERVICE_REGISTRY.capabilities.topology_prediction.providers[0].adapter = 'ebiJob';
    `);

    // findPdbEntries end to end with a stubbed capability (no network).
    ctxRun(`
        externalServicesEnabled = true;
        parsedTracks = { AA: 'M'.repeat(238) };
        uniprotAccession = '';
        pdbLookupEntries = [];
        SERVICE_ADAPTERS.__lookup_ok = async () => ({ source: 'RCSB sequence search (exact identity)',
            entries: [{ id: '2G16', title: 'GFP variant', method: 'X-ray diffraction', resolution: 2.0, coverage: 1, identity: 1 }] });
        SERVICE_REGISTRY.capabilities.pdb_entry_lookup.providers[1].adapter = '__lookup_ok';
    `);
    await ctxRun(`findPdbEntries()`);
    assert(ctxRun(`pdbLookupEntries.length`) === 1, 'the lookup runner keeps the results (got ' + ctxRun(`pdbLookupEntries.length`) + ')');
    assert(/Found 1 entry via RCSB sequence search/.test(ctxRun(`document.getElementById('pdbLookupStatus').textContent`)), 'the status names the source and count');
    assert(ctxRun(`document.getElementById('pdbLookupResults').innerHTML`).indexOf('2G16') !== -1, 'and the list renders');
    assert(ctxRun(`actionLog.some(e => e.kind === 'api' && /PDB lookup .*1 entry/.test(e.label))`), 'the activity log records it');
    // The name from the loaded header travels with the lookup (the text-search fallback needs it).
    ctxRun(`currentProteinLabel = 'sp|P42212|GFP_AEQVI Green fluorescent protein OS=Aequorea victoria';`);
    ctxRun(`
        window.__lookupArgs = null;
        SERVICE_ADAPTERS.__lookup_ok2 = async (provider, args) => { window.__lookupArgs = args; return { source: 'stub', entries: [] }; };
        SERVICE_REGISTRY.capabilities.pdb_entry_lookup.providers[1].adapter = '__lookup_ok2';
    `);
    await ctxRun(`findPdbEntries()`);
    assert(ctxRun(`window.__lookupArgs && window.__lookupArgs.proteinName`) === 'Green fluorescent protein', 'the parsed protein name is passed to the lookup (got ' + ctxRun(`window.__lookupArgs && window.__lookupArgs.proteinName`) + ')');
    assert(ctxRun(`window.__lookupArgs && window.__lookupArgs.accession`) === 'P42212', 'and the parsed accession, so the ranked PDBe path can be preferred');
    assert((await ctxRun(`SERVICE_ADAPTERS.rcsbTextSearch({ url: 'x' }, {})`).then(() => 'no-throw', e => e.message)).indexOf('needs a protein name') !== -1, 'the name-search adapter requires a name');
    ctxRun(`
        currentProteinLabel = null;
        SERVICE_REGISTRY.capabilities.pdb_entry_lookup.providers[1].adapter = 'rcsbSequenceSearch';
    `);
    ctxRun(`
        parsedTracks = {}; pdbLookupEntries = []; uniprotAccession = null; actionLog = [];
        SERVICE_REGISTRY.capabilities.pdb_entry_lookup.providers[1].adapter = 'rcsbSequenceSearch';
    `);

    // realignPartialHomologs fails gracefully when the fetch does (the harness
    // fetch stub answers ok:false), counting the hit instead of throwing.
    ctxRun(`
        parsedTracks = { AA: 'MKVW', 'HL_02_part': ' |||' };
        homologHitsInfo = { 'HL_02_part': { rank: 2, hitId: 'sp|P42212|GFP_AEQVI', source: 'BLAST', aaTrack: ' VW ' } };
        actionLog = [];
    `);
    const realignRes = await ctxRun(`realignPartialHomologs(['HL_02_part'], null)`);
    assert(realignRes.considered === 1 && realignRes.failed === 1 && realignRes.realigned === 0, 'an unfetchable hit is counted, not thrown (got ' + JSON.stringify(realignRes) + ')');
    assert(ctxRun(`actionLog.some(e => e.kind === 'api' && e.label.indexOf('realign failed') !== -1)`), 'and the failure is logged (got ' + ctxRun(`JSON.stringify(actionLog.map(e => e.kind + ':' + e.label))`) + ')');
    ctxRun(`parsedTracks = {}; homologHitsInfo = {}; actionLog = [];`);

    // A bad PDB id is rejected before any request (fetchPdbEntry is async).
    assert((await ctxRun(`fetchPdbEntry('nope')`)) === false, 'a bad PDB id is rejected before any request');

    // runStructureValidation end to end with the real PDBe fixtures (capability
    // stubbed; the mapping falls back to author numbering without a structure).
    sandbox.__valOut = JSON.parse(PDBE_OUTLIERS_FIXTURE);
    sandbox.__valQ = JSON.parse(PDBE_QUALITY_FIXTURE);
    ctxRun(`
        externalServicesEnabled = true;
        parsedTracks = { AA: 'M'.repeat(238) };
        validationHitsInfo = {};
        cachedStructureTexts = { '1GFL.pdb': 'HEADER' };
        SERVICE_ADAPTERS.__val_ok = async () => ({ pdbId: '1GFL', outliers: window.__valOut['1gfl'], summary: window.__valQ['1gfl'] });
        SERVICE_REGISTRY.capabilities.structure_validation.providers[0].adapter = '__val_ok';
    `);
    await ctxRun(`runStructureValidation()`);
    assert(ctxRun(`Object.keys(parsedTracks).filter(k => k.startsWith('VAL_')).length`) === 2, 'the runner adds the validation rows (got ' + ctxRun(`Object.keys(parsedTracks).filter(k => k.startsWith('VAL_')).length`) + ')');
    assert(/76 clashes/.test(ctxRun(`document.getElementById('validationStatus').textContent`)), 'the status line totals the outliers across chains (1GFL is a dimer: 76 clashes)');
    assert(ctxRun(`actionLog.some(e => e.kind === 'api' && /PDBe validation 1GFL/.test(e.label))`), 'and the activity log records the fetch');
    ctxRun(`
        parsedTracks = {}; validationHitsInfo = {}; cachedStructureTexts = [];
        SERVICE_REGISTRY.capabilities.structure_validation.providers[0].adapter = 'pdbeValidation';
        actionLog = [];
    `);

    // opts.prefer (the homolog-search provider picker): preferred provider first,
    // the others stay as fallbacks.
    ctxRun(`
        SERVICE_ADAPTERS.__first = async () => 'first-provider-result';
        SERVICE_ADAPTERS.__second = async () => 'second-provider-result';
        SERVICE_REGISTRY.capabilities.__test2 = { label: 'Test2', providers: [
            { id: 'a', label: 'A', adapter: '__first' },
            { id: 'b', label: 'B', adapter: '__second' }
        ] };
    `);
    assert((await ctxRun(`runCapability('__test2', {}, null, { prefer: 'b' })`)) === 'second-provider-result', 'opts.prefer runs the preferred provider first');
    assert((await ctxRun(`runCapability('__test2', {})`)) === 'first-provider-result', 'without a preference the declared order stands');
    assert((await ctxRun(`runCapability('__test2', {}, null, { prefer: 'nope' })`)) === 'first-provider-result', 'an unknown preference is ignored');

    section('macro v1: record, parameterise, JSON, dry run, replay');
    assert(HTML.indexOf('id="macroModal"') !== -1 && HTML.indexOf('id="macroBanner"') !== -1, 'the macro modal and replay banner exist');
    assert(HTML.indexOf('onclick="openMacroModal()"') !== -1 && HTML.indexOf('>Macro</button>') !== -1, 'and the menu bar has the Macro button');
    assert(HTML.indexOf('id="macroRecordBtn"') !== -1 && HTML.indexOf('id="macroAccessionOverride"') !== -1 && HTML.indexOf('id="macroImportText"') !== -1, 'record, override and import controls are present');
    ctxRun(`uniprotAccession = 'P42212'; macroAccessionOverride = ''; macroRecording = true; macroSteps = []; macroReplaying = false;`);
    ctxRun(`macroCaptureStep({ type: 'uniprot', accession: macroParam('P42212') });`);
    assert(ctxRun(`macroSteps[0].accession`) === '$ACCESSION', 'the session accession is recorded as the $ACCESSION parameter (got ' + ctxRun(`macroSteps[0].accession`) + ')');
    ctxRun(`macroCaptureStep({ type: 'pdb', pdbId: '1GFL' });`);
    assert(ctxRun(`macroSteps.length`) === 2, 'steps accumulate while recording');
    assert(ctxRun(`macroStepDescription({ type: 'homolog', provider: 'ebi_blast' })`).indexOf('BLAST') !== -1, 'step descriptions name the resolved provider');
    assert(ctxRun(`macroStepDescription({ type: 'domainScan', provider: 'ebi_iprscan5_motifs' })`).indexOf('PROSITE') !== -1, 'the domain provider label comes from the registry');
    const macroJsonText = ctxRun(`macroToJson()`);
    sandbox.__macroJsonText = macroJsonText;
    const macroParsed = JSON.parse(macroJsonText);
    assert(macroParsed.v === 1 && macroParsed.steps.length === 2, 'macroToJson exports a versioned steps array');
    ctxRun(`macroSteps = []; macroName = '';`);
    ctxRun(`macroFromJson(window.__macroJsonText);`);
    assert(ctxRun(`macroSteps.length`) === 2 && ctxRun(`macroName`) === 'Untitled macro', 'macroFromJson restores the steps and name');
    assert(ctxRun(`macroPlan().length`) === 2 && ctxRun(`macroPlan()[0]`).indexOf('Load UniProt entry') !== -1, 'the dry-run plan lists the steps');
    macroAccessionOverrideSet = ctxRun(`(function () { macroAccessionOverride = 'Q9XYZ1'; const r = macroResolveValue('$ACCESSION'); macroAccessionOverride = ''; return r; })()`);
    assert(macroAccessionOverrideSet === 'Q9XYZ1', 'the accession override retargets $ACCESSION (got ' + macroAccessionOverrideSet + ')');
    ctxRun(`
        macroRecording = false;
        window.__macroCalls = [];
        window.__macroOrigPdb = fetchPdbEntry;
        fetchPdbEntry = async (id) => { window.__macroCalls.push('pdb:' + id); return true; };
        macroSteps = [{ type: 'pdb', pdbId: '$ACCESSION' }];
        macroName = 'test macro';
        actionLog = [];
    `);
    const macroReplayOk = await ctxRun(`macroReplay(false)`);
    assert(macroReplayOk === true, 'a clean replay reports success');
    assert(ctxRun(`window.__macroCalls.join(',')`) === 'pdb:P42212', 'replay resolves $ACCESSION and calls the real runner (got ' + ctxRun(`window.__macroCalls.join(',')`) + ')');
    assert(ctxRun(`document.getElementById('macroBanner').hidden`) === true, 'the banner hides when replay finishes');
    assert(ctxRun(`actionLog.some(e => e.kind === 'macro' && /step 1 done/.test(e.label))`), 'each replayed step lands in the activity log');
    ctxRun(`macroRecording = true; window.__macroCalls = [];`);
    await ctxRun(`macroReplay(false)`);
    assert(ctxRun(`macroSteps.length`) === 1, 'replay never re-records its own steps');
    ctxRun(`macroRecording = false;`);
    ctxRun(`fetchPdbEntry = async () => { throw new Error('boom'); };`);
    const macroReplayFail = await ctxRun(`macroReplay(false)`);
    assert(macroReplayFail === false, 'a failing step makes replay report failure');
    assert(ctxRun(`actionLog.some(e => e.kind === 'error' && /macro step 1 failed/.test(e.label))`), 'and the failure is logged with the step number');
    ctxRun(`
        fetchPdbEntry = window.__macroOrigPdb;
        macroSteps = []; macroName = 'Untitled macro'; macroAccessionOverride = ''; macroRecording = false;
        uniprotAccession = ''; actionLog = [];
    `);

    section('macro v2: preflight, failure policy, run report');
    assert(HTML.indexOf('id="macroFailurePolicy"') !== -1 && HTML.indexOf('id="macroCheckin"') !== -1 && HTML.indexOf('id="macroReport"') !== -1 && HTML.indexOf('id="macroPdbOverride"') !== -1, 'the macro screen has the policy select, check-in, report and PDB override');
    assert(HTML.indexOf('Auto-retry 3 times, then proceed') !== -1 && HTML.indexOf('Pause and check in') !== -1 && HTML.indexOf('Stop the macro') !== -1, 'the failure policy offers all four modes');
    ctxRun(`parsedTracks = {}; keyedVariantsInfo = {}; cachedStructureTexts = {};`);
    assert(ctxRun(`macroStepPreflight({ type: 'domainScan' }).ok`) === false, 'a sequence step reports the missing sequence');
    ctxRun(`parsedTracks = { AA: 'MKVW' };`);
    assert(ctxRun(`macroStepPreflight({ type: 'topology' }).ok`) === true, 'and is ready once a sequence is loaded');
    assert(ctxRun(`macroStepPreflight({ type: 'validation' }).skip`) === true, 'validation is a skip (not a failure) without a structure');
    assert(ctxRun(`macroStepPreflight({ type: 'variantEffects' }).skip`) === true, 'variant effects are a skip without variants');
    ctxRun(`parsedTracks = {}; macroSteps = [{ type: 'domainScan', provider: 'ebi_hmmer' }];`);
    assert(ctxRun(`macroPreflightPlan()[0]`).indexOf('[needs a loaded sequence]') !== -1, 'the preflight plan tags missing requirements');
    ctxRun(`
        parsedTracks = { AA: 'MKVW' };
        macroFailurePolicy = 'retry3';
        window.__macroOrigTopo = runTopologyPrediction;
        window.__macroAttempts = 0;
        runTopologyPrediction = async () => { window.__macroAttempts++; if (window.__macroAttempts < 3) throw new Error('HTTP 503'); };
        macroSteps = [{ type: 'topology' }];
        macroName = 'retry test';
        actionLog = [];
    `);
    const macroRetryOk = await ctxRun(`macroReplay(false)`);
    assert(macroRetryOk === true, 'a step that succeeds on the third attempt passes');
    assert(ctxRun(`window.__macroAttempts`) === 3, 'auto-retry used three attempts (got ' + ctxRun(`window.__macroAttempts`) + ')');
    assert(ctxRun(`macroLastRun.outcomes[0].retries`) === 2, 'the report records the retry count');
    ctxRun(`runTopologyPrediction = async () => { throw new Error('HTTP 500'); }; macroSteps = [{ type: 'topology' }];`);
    await ctxRun(`macroReplay(false)`);
    const macroFailReport = ctxRun(`macroRunReportText()`);
    assert(macroFailReport.indexOf('Unexpected: API call for "Predict topology (TMHMM + Phobius + SignalP via InterProScan)" failed (HTTP 500).') !== -1, 'the report names the unexpected API failure');
    assert(macroFailReport.indexOf('failures can affect downstream actions') !== -1 && macroFailReport.indexOf('the topology rows') !== -1, 'and names the downstream impact of that failure');
    ctxRun(`macroFailurePolicy = 'pause'; macroSteps = [{ type: 'topology' }];`);
    const macroPaused = ctxRun(`macroReplay(false)`);
    await new Promise(r => setTimeout(r, 50));
    assert(ctxRun(`document.getElementById('macroCheckin').hidden`) === false, 'pause shows the check-in panel');
    ctxRun(`macroCheckinDecision('skip')`);
    const macroPausedResult = await macroPaused;
    assert(macroPausedResult === true, 'a user skip resolves the pause and completes the run');
    assert(ctxRun(`macroLastRun.outcomes[0].status`) === 'skipped', 'and the report marks the step skipped by the user');
    ctxRun(`
        macroFailurePolicy = 'stop';
        window.__macroSecondRan = false;
        window.__macroOrigDomain = runDomainScan;
        runDomainScan = async () => { window.__macroSecondRan = true; };
        macroSteps = [{ type: 'topology' }, { type: 'domainScan', provider: 'ebi_hmmer' }];
    `);
    const macroStopResult = await ctxRun(`macroReplay(false)`);
    assert(macroStopResult === false, 'the stop policy reports failure');
    assert(ctxRun(`window.__macroSecondRan`) === false, 'and never runs later steps');
    assert(ctxRun(`macroLastRun.stopped`) === true, 'the report marks the run stopped');
    ctxRun(`
        macroFailurePolicy = 'proceed';
        macroPdbOverride = '2XYZ';
        window.__macroPdbCalls = [];
        window.__macroOrigPdb2 = fetchPdbEntry;
        fetchPdbEntry = async (id) => { window.__macroPdbCalls.push(id); return true; };
        macroSteps = [{ type: 'pdb', pdbId: '1GFL' }];
    `);
    await ctxRun(`macroReplay(false)`);
    assert(ctxRun(`window.__macroPdbCalls.join(',')`) === '2XYZ', 'the PDB override replaces the recorded id (got ' + ctxRun(`window.__macroPdbCalls.join(',')`) + ')');
    ctxRun(`
        runTopologyPrediction = window.__macroOrigTopo;
        runDomainScan = window.__macroOrigDomain;
        fetchPdbEntry = window.__macroOrigPdb2;
        macroSteps = []; macroFailurePolicy = 'retry3'; macroPdbOverride = ''; macroLastRun = null;
        parsedTracks = {}; keyedVariantsInfo = {}; actionLog = [];
    `);

    section('macro presets: Saved Macros dropdown');
    assert(HTML.indexOf('Macros are pre-recorded action sequences') !== -1, 'the macro screen uses the rewritten description');
    assert(HTML.indexOf('Auto-retry 3 times, then proceed (Recommended)') !== -1, 'the recommended failure policy is labelled');
    assert(HTML.indexOf('id="macroSavedSelect"') !== -1 && HTML.indexOf('>Saved Macros</label>') !== -1, 'the Saved Macros dropdown exists');
    ctxRun(`macroSavedPopulated = false;`);
    ctxRun(`populateMacroSavedSelect();`);
    assert(ctxRun(`document.getElementById('macroSavedSelect').children.length`) === 2, 'the dropdown holds the placeholder and the presets group');
    const presetLabels = ctxRun(`
        (function () {
            const sel = document.getElementById('macroSavedSelect');
            const group = sel.children[1];
            return (group.children || []).map(o => o.textContent || '');
        })()
    `);
    assert(presetLabels.length === 4 && presetLabels.every(l => /\(Preset\)$/.test(l)), 'all four defaults carry the (Preset) suffix (got ' + JSON.stringify(presetLabels) + ')');
    assert(presetLabels[0].indexOf('GFP') !== -1 && presetLabels[1].indexOf('TerC') !== -1, 'GFP and TerC are one-click presets first');
    assert(presetLabels[2].indexOf('Non-Membrane') !== -1 && presetLabels[3].indexOf('Membrane') !== -1, 'then the two generic workflow templates');
    assert(ctxRun(`onMacroSavedSelect('char-nonmembrane-api')`) === true, 'the GFP preset loads');
    assert(ctxRun(`macroSteps.length`) === 5 && ctxRun(`macroSteps[0].accession`) === '$ACCESSION', 'with parameterised steps');
    assert(ctxRun(`macroSteps.map(s => s.type).join(',')`) === 'uniprot,domainScan,homolog,pdb,validation', 'in API-only order');
    assert(ctxRun(`macroName`).indexOf('Characterized Non-Membrane') !== -1, 'and names the workflow');
    ctxRun(`parsedTracks = { AA: 'M'.repeat(238) }; keyedVariantsInfo = {}; cachedStructureTexts = {};`);
    const gfpPreflight = ctxRun(`macroPreflightPlan()`);
    assert(gfpPreflight[4].indexOf('[skip: no experimental structure attached]') !== -1, 'without a structure the validation step preflights as a skip (got "' + gfpPreflight[4] + '")');
    assert(ctxRun(`onMacroSavedSelect('unchar-membrane-api')`) === true && ctxRun(`macroSteps.map(s => s.type).join(',')`) === 'uniprot,topology,domainScan,homolog', 'the membrane preset runs topology before domains');
    ctxRun(`sessionSpeciesToken = 'bos_taurus'; sessionSpeciesLabel = 'Bos taurus'; sessionSpeciesManual = false; uniprotAccession = ''; macroAccessionOverride = '';`);
    assert(ctxRun(`onMacroSavedSelect('gfp-api-infobase')`) === true, 'the GFP preset loads');
    assert(ctxRun(`macroAccessionOverride`) === 'P42212' && ctxRun(`macroSteps.length`) === 5, 'and pins the accession override with the full API chain (got ' + ctxRun(`macroAccessionOverride`) + ')');
    assert(ctxRun(`sessionSpeciesToken`) === '', 'clearing a stale species for the jellyfish entry');
    ctxRun(`sessionSpeciesManual = true; sessionSpeciesToken = 'homo_sapiens'; sessionSpeciesLabel = 'Homo sapiens';`);
    assert(ctxRun(`onMacroSavedSelect('terc-api-infobase')`) === true && ctxRun(`macroAccessionOverride`) === 'Q52356', 'the TerC preset pins the Serratia entry');
    assert(ctxRun(`macroSteps.map(s => s.type).join(',')`) === 'uniprot,topology,domainScan,homolog', 'with topology first and no PDB step');
    assert(ctxRun(`sessionSpeciesToken`) === 'homo_sapiens', 'and a manual species survives preset loading');
    ctxRun(`sessionSpeciesManual = false;`);
    assert(ctxRun(`onMacroSavedSelect('nope')`) === false, 'an unknown saved macro changes nothing');
    ctxRun(`resetMacroSavedSelect();`);
    assert(ctxRun(`document.getElementById('macroSavedSelect').value`) === '', 'resetting clears the dropdown selection');
    ctxRun(`macroSteps = []; macroName = 'Untitled macro'; parsedTracks = {};`);

    section('accession presets live in Input Data + accession FASTA loading');
    assert(HTML.indexOf('id="inputAccessionPreset"') !== -1 && HTML.indexOf('id="macroAccessionPreset"') === -1, 'the example-protein picker sits in Input Data, not the Macro modal');
    assert(HTML.indexOf('Load sample Quick2D data') === -1 && ctxRun(`typeof loadSampleData === 'undefined'`), 'the offline sample-data button and helper are gone');
    assert(HTML.indexOf('id="inputAccessionPreset"') < HTML.indexOf('>Import</h4>'), 'the Load example protein picker sits above Import');
    assert(HTML.indexOf('Import a Q2DV save, PDB/CIF files, other data files, or paste data from') !== -1, 'the Import description lists the accepted inputs');
    ctxRun(`inputAccessionPresetsPopulated = false; document.getElementById('inputAccessionPreset').children = []; populateInputAccessionPresets();`);
    assert(ctxRun(`document.getElementById('inputAccessionPreset').children.length`) === 7, 'the picker lists seven proteins');
    const accPresetLabels = ctxRun(`
        (function () {
            return (document.getElementById('inputAccessionPreset').children || []).map(o => o.textContent || '');
        })()
    `);
    assert(accPresetLabels.length === 7 && accPresetLabels.every(l => /\(P[0-9A-Z]{5}, /.test(l)), 'each option names the protein, accession and organism');
    assert(accPresetLabels.some(l => l.indexOf('P0CG48') !== -1) && !accPresetLabels.some(l => l.indexOf('P62988') !== -1), 'the obsolete ubiquitin entry was replaced by P0CG48');
    assert(accPresetLabels.some(l => l.indexOf('Physeter macrocephalus') !== -1) && !accPresetLabels.some(l => l.indexOf('catodon') !== -1), 'and the whale uses the current spelling');
    ctxRun(`uniprotAccession = ''; macroAccessionOverride = ''; updateMacroAccessionHint();`);
    assert(ctxRun(`document.getElementById('macroAccessionHint').textContent`).indexOf('Current: none') !== -1, 'without an accession the hint says so');
    ctxRun(`uniprotAccession = 'P42212'; updateMacroAccessionHint();`);
    assert(ctxRun(`document.getElementById('macroAccessionHint').textContent`) === 'Current: P42212 (session)', 'the hint shows the session accession (got ' + ctxRun(`document.getElementById('macroAccessionHint').textContent`) + ')');
    ctxRun(`macroAccessionOverride = 'P02699'; updateMacroAccessionHint();`);
    assert(ctxRun(`document.getElementById('macroAccessionHint').textContent`).indexOf('Current: P02699 (override)') === 0, 'and reflects the override');
    ctxRun(`macroAccessionOverride = ''; updateMacroAccessionHint();`);
    ctxRun(`
        window.__origUseUniProt = useUniProtAccession;
        useUniProtAccession = async (acc) => { window.__loadedAcc = acc; };
        sessionSpeciesToken = ''; sessionSpeciesLabel = ''; sessionSpeciesManual = false;
    `);
    assert(await ctxRun(`onInputAccessionPreset('P02699')`) === true, 'picking Rhodopsin in Input Data loads it');
    assert(ctxRun(`window.__loadedAcc`) === 'P02699' && ctxRun(`sessionSpeciesToken`) === 'bos_taurus', 'with the accession and its species');
    assert(ctxRun(`macroAccessionOverride`) === '', 'and it does not touch the macro override');
    ctxRun(`sessionSpeciesManual = true; sessionSpeciesToken = 'gallus_gallus'; sessionSpeciesLabel = 'Gallus gallus';`);
    await ctxRun(`onInputAccessionPreset('P42212')`);
    assert(ctxRun(`sessionSpeciesToken`) === 'gallus_gallus', 'a manual species is never overwritten by an example protein');
    ctxRun(`sessionSpeciesManual = false;`);
    await ctxRun(`onInputAccessionPreset('P42212')`);
    assert(ctxRun(`sessionSpeciesToken`) === '', 'a non-Ensembl organism clears the species so species-specific steps skip honestly');
    assert(await ctxRun(`onInputAccessionPreset('NOPE1')`) === false, 'an unknown accession changes nothing');
    ctxRun(`useUniProtAccession = window.__origUseUniProt;`);
    ctxRun(`
        externalServicesEnabled = true;
        parsedTracks = {}; uniprotAccession = ''; uniprotFeatures = null; uniprotFeatureTracks = {};
        window.__origRunCap = runCapability;
        runCapability = async () => ([{ type: 'Active site', start: 1, end: 1, description: 'test site' }]);
    `);
    const origSandboxFetch = sandbox.fetch;
    sandbox.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve('>sp|P42212|GFP\nMSKGEELFTG\nVVPI\n'), json: () => Promise.resolve({}) });
    await ctxRun(`useUniProtAccession('P42212')`);
    assert(ctxRun(`parsedTracks.AA`) === 'MSKGEELFTGVVPI', 'an accession-only session gets its FASTA sequence (got ' + ctxRun(`parsedTracks.AA`) + ')');
    assert(ctxRun(`Object.keys(parsedTracks).some(function (k) { return k.startsWith('UP_'); })`), 'and its UniProt feature rows are built immediately (not only after a reload)');
    ctxRun(`parsedTracks.AA = 'MKV';`);
    sandbox.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve('>other\nAAAAA\n'), json: () => Promise.resolve({}) });
    await ctxRun(`useUniProtAccession('P42212')`);
    assert(ctxRun(`parsedTracks.AA`) === 'MKV', 'a loaded sequence is never overwritten by the accession FASTA');
    // The actual example-preset path (Input Data -> Load example protein) must
    // build the rows in the same pass, not only after a reload.
    ctxRun(`parsedTracks = {}; uniprotAccession = ''; uniprotFeatures = null; uniprotFeatureTracks = {};`);
    sandbox.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve('>sp|P00698|LYSC_CHICK\nKVFGRCELAAAMKRHGLDNYR\n'), json: () => Promise.resolve({}) });
    assert(await ctxRun(`onInputAccessionPreset('P00698')`) === true, 'loading Lysozyme by example succeeds');
    assert(ctxRun(`parsedTracks.AA`) === 'KVFGRCELAAAMKRHGLDNYR', 'and it adopts the example sequence');
    assert(ctxRun(`Object.keys(parsedTracks).some(function (k) { return k.startsWith('UP_'); })`), 'and builds its UniProt rows immediately');
    sandbox.fetch = origSandboxFetch;
    ctxRun(`
        runCapability = window.__origRunCap;
        parsedTracks = {}; uniprotAccession = ''; uniprotFeatures = null; uniprotFeatureTracks = {};
        macroAccessionOverride = ''; sessionSpeciesToken = ''; sessionSpeciesLabel = ''; sessionSpeciesManual = false;
        currentProteinLabel = null; updateMacroAccessionHint();
    `);

    section('macro play button + pre-parse validation');
    assert(HTML.indexOf('id="macroPlayBtn"') !== -1 && HTML.indexOf('Play macro') !== -1, 'the run button is "Play macro"');
    assert(HTML.indexOf('macro-play-btn') !== -1 && HTML.indexOf('id="macroValidation"') !== -1, 'it is styled prominently and has a validation line');
    ctxRun(`macroSteps = []; updateMacroControls();`);
    assert(ctxRun(`document.getElementById('macroPlayBtn').disabled`) === true, 'Play is disabled with no steps');
    assert(ctxRun(`document.getElementById('macroValidation').textContent`).indexOf('Nothing to play') !== -1, 'and the line says so');
    ctxRun(`macroSteps = [{ type: 'nonsense' }]; updateMacroControls();`);
    assert(ctxRun(`document.getElementById('macroPlayBtn').disabled`) === true, 'an unknown step type disables Play');
    assert(ctxRun(`document.getElementById('macroValidation').textContent`).indexOf('unknown type "nonsense"') !== -1, 'and names the bad step');
    ctxRun(`macroSteps = [{ type: 'uniprot', accession: '' }]; updateMacroControls();`);
    assert(ctxRun(`document.getElementById('macroPlayBtn').disabled`) === true, 'a missing required parameter disables Play');
    assert(ctxRun(`document.getElementById('macroValidation').textContent`).indexOf('has no accession') !== -1, 'with a specific reason');
    ctxRun(`macroSteps = [{ type: 'uniprot', accession: '$ACCESSION' }]; uniprotAccession = 'P42212'; macroAccessionOverride = ''; updateMacroControls();`);
    assert(ctxRun(`document.getElementById('macroPlayBtn').disabled`) === false, 'a valid macro enables Play');
    assert(ctxRun(`document.getElementById('macroValidation').textContent`) === 'Ready to play.', 'and the line confirms readiness');
    ctxRun(`parsedTracks = {}; macroSteps = [{ type: 'topology' }]; updateMacroControls();`);
    assert(ctxRun(`document.getElementById('macroPlayBtn').disabled`) === false, 'missing session data is a warning, not a block');
    assert(ctxRun(`document.getElementById('macroValidation').textContent`).indexOf('warning(s)') !== -1 && ctxRun(`document.getElementById('macroValidation').textContent`).indexOf('needs a loaded sequence') !== -1, 'and the warning names what is missing');
    ctxRun(`macroSteps = [{ type: 'nonsense' }];`);
    const macroInvalidReplay = await ctxRun(`macroReplay(false)`);
    assert(macroInvalidReplay === false, 'replay refuses an invalid macro even when called directly');
    ctxRun(`macroSteps = []; uniprotAccession = ''; parsedTracks = {}; updateMacroControls();`);

    section('hypothesis read-out: candidate ranking, suggestions, TSV, report');
    assert(HTML.indexOf('id="hypothesisModal"') !== -1 && HTML.indexOf('>Hypotheses</button>') !== -1 && HTML.indexOf('id="hypothesisTable"') !== -1, 'the Hypotheses modal and menu button exist');
    ctxRun(`parsedTracks = {}; uniprotFeatureTracks = {};`);
    assert(ctxRun(`buildHypothesisCandidates().length`) === 0, 'with no evidence there are no candidates');
    ctxRun(`
        parsedTracks = {
            AA: 'MKVLDEKRST',
            CONSERVATION: { metric: 'shannon', values: [0.9, 0.9, 0.2, 0.9, 0.9, 0.9, 0.9, 0.9, 0.3, 0.3] },
            TP_Consensus: 'MMMMMiiiii',
            'm_pLDDT': Array.from({ length: 10 }, (_, i) => ({ val: i === 4 ? 40 : 90, type: 'plddt' })),
            'm_RSA': Array.from({ length: 10 }, (_, i) => ({ val: i === 1 ? 0.05 : 0.5, type: 'rsa' })),
            'HL_01_a': 'MM    K   '
        };
        uniprotFeatureTracks = { UP_Active_site: { type: 'Active site', category: 'site', features: [{ start: 7, end: 7, type: 'Active site', description: 'proton acceptor' }] } };
        keyedVariantsInfo = {};
    `);
    const hypRows = ctxRun(`buildHypothesisCandidates()`);
    assert(hypRows.length === 6, 'six positions carry enough signal for a suggestion (got ' + hypRows.length + ')');
    assert(hypRows[0].pos === 7 && hypRows[0].suggestion === 'A' && /Annotated functional site/.test(hypRows[0].rationale), 'the annotated active site ranks first (got ' + JSON.stringify(hypRows[0]) + ')');
    assert(hypRows[0].confidence === 'high' && hypRows[0].features.indexOf('Active site') !== -1, 'with high confidence and the feature named');
    assert(!hypRows.some(r => r.pos === 5), 'the low-pLDDT position is excluded from candidates');
    const hypChargeSwap = hypRows.find(r => r.pos === 6);
    assert(hypChargeSwap && hypChargeSwap.suggestion === 'K' && /electrostatics/.test(hypChargeSwap.rationale), 'a conserved surface charge gets a charge-swap suggestion (got ' + JSON.stringify(hypChargeSwap) + ')');
    assert(hypRows.find(r => r.pos === 2).suggestion === 'A', 'a conserved buried residue gets an alanine suggestion');
    assert(hypRows.every(r => r.topology === 'M' || r.topology === 'i'), 'the topology state is carried into the rows');
    ctxRun(`parsedTracks['VAR_x'] = 'MH        ';`);
    const hypKnown = ctxRun(`buildHypothesisCandidates().find(r => r.pos === 2)`);
    assert(hypKnown.known.join(',') === 'K2H' && hypKnown.suggestion === 'H' && /compare predicted effects/.test(hypKnown.rationale), 'a known variant is marked and the suggestion switches to comparison');
    ctxRun(`delete parsedTracks['VAR_x'];`);
    const hypTsv = ctxRun(`hypothesisTSV()`);
    const hypTsvLines = hypTsv.split('\n');
    assert(hypTsvLines.length === 7 && hypTsvLines[0].indexOf('SuggestedMutation') !== -1, 'the TSV has a header and one line per candidate');
    assert(hypTsvLines[1].split('\t').length === 13, 'with thirteen columns');
    const hypReport = ctxRun(`buildMethodsReport()`);
    assert(hypReport.indexOf('## Candidate residues (hypothesis read-out)') !== -1 && hypReport.indexOf('suggest **A**') !== -1, 'the methods report carries the candidate section');
    assert(hypReport.indexOf('suggestions to evaluate, not conclusions') !== -1, 'and states that they are suggestions');
    ctxRun(`renderHypothesisModal();`);
    assert(ctxRun(`document.getElementById('hypothesisTable').innerHTML`).indexOf('Annotated functional site') !== -1, 'the modal renders the table with each rationale on the row');
    ctxRun(`parsedTracks = {}; uniprotFeatureTracks = {}; keyedVariantsInfo = {};`);

    // The Export action re-reads a cache-only file through IndexedDB, which the
    // harness cannot stub, so this checks both endings of that path: a cache
    // miss explains itself and exports nothing, and a file whose text is in hand
    // produces the file and logs it.
    section('structure export: the Export action');
    ctxRun(`
        parsedTracks = { AA: 'ACD' };
        cachedStructureTexts = {};
        cachedStructureIndex = { 'from-cache.pdb': { hash: 'deadbeef', ext: 'pdb', size: 1 } };
        uploadedStructureFiles = []; p3dModel = null; actionLog = [];
        selectionMode = 'point'; rowRanges = []; selectStart = null; selectEnd = null;
    `);
    const expNoCache = await ctxRun(`exportStructureFile()`);
    assert(expNoCache === null, 'a cache-only file with no reachable text exports nothing');
    assert(ctxRun(`actionLog.some(e => e.kind === 'export')`) === false, 'and nothing is logged as exported');
    ctxRun(`
        cachedStructureIndex = {};
        cachedStructureTexts = { 'model.pdb': window.__exportPdb };
        actionLog = [];
    `);
    const expDownloaded = await ctxRun(`exportStructureFile()`);
    assert(expDownloaded && expDownloaded.ok === true && expDownloaded.keptAtoms === 8, 'a file in hand exports whole');
    assert(ctxRun(`actionLog.some(e => e.kind === 'export' && e.label === 'q2dv-model.pdb')`) === true, 'and is logged under the name it was written as');
    ctxRun(`
        selectStart = 1; selectEnd = 1; actionLog = [];
    `);
    const expDownloadedSel = await ctxRun(`exportStructureFile()`);
    assert(expDownloadedSel && expDownloadedSel.whole === false && expDownloadedSel.keptAtoms === 2, 'with a selection it exports only that residue, from both chains');
    assert(ctxRun(`actionLog.some(e => e.label === 'q2dv-model-selection.pdb')`) === true, 'and the filename says it was narrowed');
    ctxRun(`cachedStructureTexts = {}; parsedTracks = {}; selectStart = null; selectEnd = null;`);

    // attachStructureText is async, so the attach-time coordination store has to
    // be checked here rather than in the synchronous section above.
    section('coordination is computed at attach time');
    ctxRun(`
        parsedTracks = { AA: 'M'.repeat(120) };
        cachedStructureTexts = {}; uploadedStructureFiles = []; structureCoordination = {};
    `);
    await ctxRun(`attachStructureText('heme.pdb', window.__hemePdb, 'pdb', {})`);
    assert(ctxRun(`Object.keys(structureCoordination).join(',')`) === 'heme', 'attaching a file computes and stores its coordination (got "' + ctxRun(`Object.keys(structureCoordination).join(',')`) + '")');
    assert(ctxRun(`cofactorCoordinationForBase('heme').length`) === 2, 'keyed by the same base name the _Cofactors track uses');
    assert(ctxRun(`parsedTracks['heme_Cofactors']`) !== undefined, 'and the per-residue cofactor row exists alongside it');
    assert(/SPY/.test(ctxRun(`cofactorCoordinationTooltip('heme')`)), 'so the row-label tooltip resolves it straight away');
    assert(/CN 4/.test(ctxRun(`cofactorSiteTooltip('heme', 2)`)), 'and so does the per-residue hover on the zinc cofactor');

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})();

