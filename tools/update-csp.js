#!/usr/bin/env node
// Recompute the inline app-script SHA-256 used by the CSP meta tag.
// Run after any edit to the <script> block, before npm test / release.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const start = html.indexOf('<script>');
const end = html.indexOf('</script>');
if (start < 0 || end < 0 || end < start) throw new Error('inline <script> block not found');
const scriptText = html.slice(start + '<script>'.length, end);
const hash = crypto.createHash('sha256').update(scriptText, 'utf8').digest('base64');

const metaRe = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/;
const match = html.match(metaRe);
if (!match) throw new Error('CSP meta tag not found');
let csp = match[2];
let replaced = false;
if (csp.indexOf("'sha256-__APP_SCRIPT_HASH__'") !== -1) {
    csp = csp.replace("'sha256-__APP_SCRIPT_HASH__'", "'sha256-" + hash + "'");
    replaced = true;
} else {
    csp = csp.replace(/'sha256-[A-Za-z0-9+/=]+'/g, token => {
        if (replaced) return token;
        replaced = true;
        return "'sha256-" + hash + "'";
    });
}
if (!replaced) throw new Error('CSP script hash slot not found');
html = html.replace(metaRe, (all, pre, old, post) => pre + csp + post);
fs.writeFileSync(file, html);
console.log('CSP app hash: sha256-' + hash);
