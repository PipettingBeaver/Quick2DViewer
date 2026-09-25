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
