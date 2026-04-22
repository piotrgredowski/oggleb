import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const legacyFiles = [
  'legacy.html',
  'bg.webp',
  'pl_dict_trie.js',
  'en_dict_trie.js',
  'es_dict_trie.js',
  'ru_dict_trie.js',
] as const;

function legacyAssetBridge(): Plugin {
  const root = resolve(__dirname);

  return {
    name: 'legacy-asset-bridge',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestPath = req.url?.split('?')[0] ?? '';
        const assetName = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;

        if (!legacyFiles.includes(assetName as (typeof legacyFiles)[number])) {
          next();
          return;
        }

        const filePath = resolve(root, assetName);
        const source = readFileSync(filePath);
        const contentType = assetName.endsWith('.html')
          ? 'text/html; charset=utf-8'
          : assetName.endsWith('.webp')
            ? 'image/webp'
            : 'application/javascript; charset=utf-8';

        res.setHeader('Content-Type', contentType);
        res.end(source);
      });
    },
    generateBundle() {
      for (const fileName of legacyFiles) {
        this.emitFile({
          type: 'asset',
          fileName,
          source: readFileSync(resolve(root, fileName)),
        });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), legacyAssetBridge()],
});
