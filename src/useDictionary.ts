import { useEffect, useState } from 'react';
import type { Language, TrieNode } from './game';

type DictionaryAsset = {
  script: string;
  globalName: string;
};

export type DictionaryTrie = TrieNode;

type DictionaryStatus =
  | { state: 'loading'; message: string; trie: null }
  | { state: 'ready'; message: string; trie: DictionaryTrie }
  | { state: 'error'; message: string; trie: null };

declare global {
  interface Window {
    PL_TRIE?: unknown;
    EN_TRIE?: unknown;
    ES_TRIE?: unknown;
    RU_TRIE?: unknown;
  }
}

const dictionaryAssets: Record<Language, DictionaryAsset> = {
  pol: { script: 'pl_dict_trie.js', globalName: 'PL_TRIE' },
  eng: { script: 'en_dict_trie.js', globalName: 'EN_TRIE' },
  spa: { script: 'es_dict_trie.js', globalName: 'ES_TRIE' },
  rus: { script: 'ru_dict_trie.js', globalName: 'RU_TRIE' },
};

const cache = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();

function loadDictionary(language: Language): Promise<unknown> {
  const asset = dictionaryAssets[language];

  if (cache.has(asset.globalName)) {
    return Promise.resolve(cache.get(asset.globalName));
  }

  if (pending.has(asset.globalName)) {
    return pending.get(asset.globalName) ?? Promise.reject(new Error('Missing pending dictionary'));
  }

  const promise = new Promise<unknown>((resolve, reject) => {
    if (window[asset.globalName as keyof Window]) {
      const trie = window[asset.globalName as keyof Window];
      cache.set(asset.globalName, trie);
      resolve(trie);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[data-dict="${asset.globalName}"]`);

    if (existing) {
      existing.addEventListener('load', () => resolve(window[asset.globalName as keyof Window]));
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${asset.script}`)));
      return;
    }

    const script = document.createElement('script');
    script.src = asset.script;
    script.async = true;
    script.dataset.dict = asset.globalName;
    script.onload = () => {
      const trie = window[asset.globalName as keyof Window];
      if (!trie) {
        reject(new Error(`Missing global ${asset.globalName}`));
        return;
      }

      cache.set(asset.globalName, trie);
      resolve(trie);
    };
    script.onerror = () => reject(new Error(`Failed to load ${asset.script}`));
    document.head.appendChild(script);
  }).finally(() => {
    pending.delete(asset.globalName);
  });

  pending.set(asset.globalName, promise);
  return promise;
}

export function useDictionary(language: Language): DictionaryStatus {
  const [status, setStatus] = useState<DictionaryStatus>({
    state: 'loading',
    message: 'Loading dictionary…',
    trie: null,
  });

  useEffect(() => {
    let active = true;
    setStatus({ state: 'loading', message: 'Loading dictionary…', trie: null });

    loadDictionary(language)
      .then((trie) => {
        if (!active) {
          return;
        }
        setStatus({ state: 'ready', message: 'Dictionary ready', trie: trie as DictionaryTrie });
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setStatus({ state: 'error', message: 'Dictionary failed to load', trie: null });
      });

    return () => {
      active = false;
    };
  }, [language]);

  return status;
}
