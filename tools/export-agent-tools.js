#!/usr/bin/env node
// Generates mcp/tools.json from the live agent registry in index.html.
// Run with: npm run agent:tools
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const nodeCrypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');

function makeEl() {
  return {
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
  crypto: (nodeCrypto.webcrypto || { randomUUID: () => 'uid-' + Date.now(), getRandomValues() {} }),
  TextEncoder,
  confirm: () => true,
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
sandbox.addEventListener = function () {};
sandbox.removeEventListener = function () {};
sandbox.matchMedia = function () { return { matches: false, addListener() {}, removeListener() {} }; };
Object.assign(sandbox, { AMINO_ACID_BG_FREQUENCIES: {}, AA_ALPHABET_ORDER: 'ARNDCQEGHILKMFPSTWYV', blosum62Score: (a, b) => (a === b ? 4 : -1) });

const scriptMatch = HTML.match(/<script>\n([\s\S]*?)\n<\/script>/);
if (!scriptMatch) {
  console.error('FAIL: could not extract <script> from index.html');
  process.exit(1);
}
vm.createContext(sandbox);
try {
  vm.runInContext(scriptMatch[1], sandbox, { timeout: 60000 });
} catch (err) {
  console.error('FAIL: app threw on load:', err.message);
  process.exit(1);
}

const tools = vm.runInContext('agentToolSpecs()', sandbox);
const reference = vm.runInContext('agentToolReference()', sandbox);
const version = vm.runInContext('APP_VERSION', sandbox);
const payload = {
  schema: 'q2dv.tool-cache/1',
  app_version: version,
  generated_at: new Date().toISOString(),
  tools,
  reference
};
const target = path.join(ROOT, 'mcp', 'tools.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(payload, null, 2) + '\n');

const refTarget = path.join(ROOT, 'mcp', 'reference.json');
fs.writeFileSync(refTarget, JSON.stringify(reference, null, 2) + '\n');

const lines = [
  '# Agent tool reference',
  '',
  'Generated from `AGENT_TOOLS` in `index.html` by `npm run agent:tools`.',
  'Do not edit by hand.',
  '',
  '| Tool | Tier | Approval | Effects | Input |',
  '|---|---|---|---|---|'
];
reference.tools.forEach(tool => {
  const input = Object.keys((tool.input && tool.input.properties) || {}).join(', ') || '-';
  lines.push('| `' + tool.id + '` | ' + tool.tier + ' | ' + tool.approval + ' | ' + tool.effects + ' | ' + input + ' |');
});
lines.push('', 'Human documentation: `mcp/README.md` and `MCP_AGENT_PLAN.md`.', '');
fs.writeFileSync(path.join(ROOT, 'AGENT_REFERENCE.md'), lines.join('\n'));

console.log('wrote ' + target + ' (' + tools.length + ' tools, app ' + version + ')');
console.log('wrote ' + refTarget + ' and AGENT_REFERENCE.md');
