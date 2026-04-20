"use strict";

const fs = require('fs');
const path = require('path');

const configs = [
    {
        name: 'PL',
        src: path.join(__dirname, 'boggle_pl_js', 'pl_sjp.pl.txt'),
        out: path.join(__dirname, 'pl_dict_trie.js'),
        globalVar: 'PL_TRIE',
        filter: w => w.length >= 2,
    },
    {
        name: 'EN',
        src: path.join(__dirname, 'dicts', 'en_merged.txt'),
        out: path.join(__dirname, 'en_dict_trie.js'),
        globalVar: 'EN_TRIE',
        filter: w => w.length >= 2 && /^[A-Z]+$/.test(w),
    },
    {
        name: 'ES',
        src: path.join(__dirname, 'dicts', 'es_file2017.txt'),
        out: path.join(__dirname, 'es_dict_trie.js'),
        globalVar: 'ES_TRIE',
        filter: w => w.length >= 2,
    },
    {
        name: 'RU',
        src: path.join(__dirname, 'dicts', 'ru_danakt.txt'),
        out: path.join(__dirname, 'ru_dict_trie.js'),
        globalVar: 'RU_TRIE',
        filter: w => w.length >= 2 && /^[А-ЯЁ]+$/.test(w),
    },
];

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

const target = process.argv[2]; // optional: 'PL', 'EN', 'ES', 'RU' or omit for all

for (const cfg of configs) {
    if (target && cfg.name !== target.toUpperCase()) continue;

    console.log(`\n=== ${cfg.name} ===`);
    console.log(`Reading ${cfg.src}...`);
    const raw = fs.readFileSync(cfg.src, 'utf8');
    const words = raw.split(/\r?\n/).map(w => w.trim().toUpperCase()).filter(cfg.filter);
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

    console.log('Compacting...');
    const compact = compactify(root);

    const json = JSON.stringify(compact);
    const js = `window.${cfg.globalVar}=${json};\n`;

    fs.writeFileSync(cfg.out, js);
    const sizeMB = (Buffer.byteLength(js) / 1024 / 1024).toFixed(1);
    console.log(`Written ${cfg.out} (${sizeMB} MB)`);
}
