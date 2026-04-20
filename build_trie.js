"use strict";

const fs = require('fs');
const path = require('path');

const dictPath = path.join(__dirname, 'boggle_pl_js', 'pl_sjp.pl.txt');
const outPath = path.join(__dirname, 'pl_dict_trie.js');

console.log('Reading dictionary...');
const raw = fs.readFileSync(dictPath, 'utf8');
const words = raw.split(/\r?\n/).map(w => w.trim().toUpperCase()).filter(w => w.length >= 2);
console.log(`${words.length} words`);

console.log('Building trie...');
const root = Object.create(null);
for (const word of words) {
    let node = root;
    for (const ch of word) {
        if (!node[ch]) node[ch] = Object.create(null);
        node = node[ch];
    }
    node.$ = 1;
}

function compactify(node) {
    const keys = Object.keys(node);
    if (keys.length === 0) return 1;
    if (keys.length === 1 && keys[0] === '$') return 1;
    const out = {};
    for (const k of keys) {
        if (k === '$') { out.$ = 1; continue; }
        out[k] = compactify(node[k]);
    }
    return out;
}

console.log('Compacting & deduplicating...');
const compact = compactify(root);

const json = JSON.stringify(compact);
const js = `window.PL_TRIE=${json};\n`;

fs.writeFileSync(outPath, js);
const sizeMB = (Buffer.byteLength(js) / 1024 / 1024).toFixed(1);
console.log(`Written ${outPath} (${sizeMB} MB)`);
