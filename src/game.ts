export type Mode = 'solo' | 'tv' | 'multiplayer';
export type Language = 'pol' | 'eng' | 'spa' | 'rus';

export type SetupState = {
  lang: Language;
  durationSeconds: number;
  mode: Mode;
};

export type MultiplayerStep = 'overview' | 'join' | 'lobby' | 'pass-play';

export type SharedGameDescriptor = {
  version: 1;
  lang: Language;
  durationSeconds: number;
  seed: number;
};

export type AppRouteState = SetupState & {
  multiplayerStep: MultiplayerStep;
  sharedCode: string | null;
  sharedGame: SharedGameDescriptor | null;
  sharedError: string | null;
};

export type TrieNode = {
  $?: 1;
  [key: string]: TrieNode | 1 | undefined;
};

export type BoardCell = {
  id: string;
  value: string;
};

export type Board = {
  rows: number;
  cols: number;
  cells: BoardCell[];
};

export type SolverResults = {
  found: Set<string>;
  wordPaths: Record<string, number[][]>;
};

type BoardSpec = {
  rows: number;
  cols: number;
  dice: string;
};

const boardSpecs: Record<Language, BoardSpec> = {
  pol: {
    rows: 4,
    cols: 4,
    dice: 'UIEWNĄICDTOŻOAEKOOIZUPŹYŃDBTTWMJENSNCAGANNERIĘAIIZECZÓIIŁOOYZSĆELAGZZKAŁŻRSYAPHDLWAMRHEMOĘĄBŚŁSF',
  },
  eng: {
    rows: 4,
    cols: 4,
    dice: 'HCPTYNBWAHALOFRHBKNOWAQTAXFTSMEALIAERELEHEDRPGGREVNEYTRWETZOATOIFEEDOMNSEIOUEUOIATNTDSSSJHNRSMIC',
  },
  spa: {
    rows: 4,
    cols: 4,
    dice: 'ÓNSNOSEÑUKAANNEDNTCHXMQINZYFEWAAOÚUASLDURÁEÉDÍTAEIÜOTEAEOOEAOLLDERSRIOPJAVDMAPEARLUCSSRALIBCREOI',
  },
  rus: {
    rows: 5,
    cols: 5,
    dice: 'ЖАДАЧАОНБЬИГЫМЩПТЁАУАООИКЬЛВМЯПФИИПНЙЬЛОУКВЕГСРЕЛОЕГДЙЯАИИОЦТТСЛСООАЕЫЧЮИЗОЕЖЕТНЪАНЛОНСАВНСРРЛИЕБЭТШОВВРАЕАЕПМТОТОАСШБКОЕВНУРХРЛЯУРЗОКДСКРЕНХИЧНИОДЛМТ',
  },
};

export function clampDuration(value: number): number {
  return Math.min(600, Math.max(60, value));
}

export function isLanguage(value: string | null): value is Language {
  return value === 'pol' || value === 'eng' || value === 'spa' || value === 'rus';
}

export function isMode(value: string | null): value is Mode {
  return value === 'solo' || value === 'tv' || value === 'multiplayer';
}

export function buildQuery(state: SetupState): string {
  return buildRouteQuery({
    ...state,
    multiplayerStep: 'overview',
    sharedCode: null,
    sharedGame: null,
    sharedError: null,
  });
}

export function buildRouteQuery(state: AppRouteState): string {
  const params = new URLSearchParams();
  params.set('lang', state.lang);
  params.set('t', String(state.durationSeconds));
  params.set('mode', state.mode);
  if (state.mode === 'multiplayer' && state.multiplayerStep !== 'overview') {
    params.set('mp', state.multiplayerStep);
  }
  if (state.sharedCode) {
    params.set('g', state.sharedCode);
  }
  return params.toString();
}

export function readInitialState(): SetupState {
  const routeState = readInitialRouteState();
  return {
    lang: routeState.lang,
    durationSeconds: routeState.durationSeconds,
    mode: routeState.mode,
  };
}

function checksumPayload(payload: string): string {
  let sum = 0;
  for (let index = 0; index < payload.length; index += 1) {
    sum = (sum + payload.charCodeAt(index) * (index + 1)) % 1296;
  }
  return sum.toString(36).toUpperCase().padStart(2, '0');
}

export function encodeSharedGame(descriptor: SharedGameDescriptor): string {
  const payload = [
    descriptor.version.toString(36),
    descriptor.lang,
    descriptor.durationSeconds.toString(36),
    descriptor.seed.toString(36).toUpperCase(),
  ].join('-');
  return `${payload}-${checksumPayload(payload)}`;
}

export function decodeSharedGame(value: string): { descriptor: SharedGameDescriptor | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { descriptor: null, error: 'Enter a shared code or link before joining.' };
  }

  let raw = trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      raw = url.searchParams.get('g') ?? '';
      if (!raw) {
        return { descriptor: null, error: 'That link does not include a shared game code.' };
      }
    }
  } catch {
    return { descriptor: null, error: 'Enter a valid shared code or full link.' };
  }

  const code = raw.trim();
  const parts = code.split('-');
  if (parts.length !== 5) {
    return { descriptor: null, error: 'That shared code format is not supported.' };
  }

  const [rawVersionToken, rawLangToken, rawDurationToken, rawSeedToken, rawChecksumToken] = parts;
  const versionToken = rawVersionToken.toLowerCase();
  const langToken = rawLangToken.toLowerCase();
  const durationToken = rawDurationToken.toUpperCase();
  const seedToken = rawSeedToken.toUpperCase();
  const checksumToken = rawChecksumToken.toUpperCase();
  const payload = [versionToken, langToken, durationToken, seedToken].join('-');
  if (checksumPayload(payload) !== checksumToken) {
    return { descriptor: null, error: 'That shared code failed validation. Check for typos and try again.' };
  }

  const version = Number.parseInt(versionToken, 36);
  const durationSeconds = Number.parseInt(durationToken, 36);
  const seed = Number.parseInt(seedToken, 36);
  if (version !== 1) {
    return { descriptor: null, error: 'That shared code version is not supported.' };
  }
  if (!isLanguage(langToken.toLowerCase())) {
    return { descriptor: null, error: 'That shared code uses an unsupported language.' };
  }
  if (!Number.isFinite(durationSeconds) || clampDuration(durationSeconds) !== durationSeconds) {
    return { descriptor: null, error: 'That shared code uses an invalid round duration.' };
  }
  if (!Number.isFinite(seed) || seed <= 0) {
    return { descriptor: null, error: 'That shared code uses an invalid round seed.' };
  }

  return {
    descriptor: {
      version: 1,
      lang: langToken as Language,
      durationSeconds,
      seed,
    },
    error: null,
  };
}

export function readInitialRouteState(): AppRouteState {
  const params = new URLSearchParams(window.location.search);
  const lang = params.get('lang');
  const duration = Number(params.get('t'));
  const mode = params.get('mode');
  const multiplayerStepParam = params.get('mp');
  const sharedCode = params.get('g');
  const decoded = sharedCode ? decodeSharedGame(sharedCode) : { descriptor: null, error: null };
  const sharedGame = decoded.descriptor;
  const normalizedMode: Mode =
    sharedCode || multiplayerStepParam ? 'multiplayer' : isMode(mode) ? mode : 'solo';
  const modeFromGame = sharedGame?.lang ?? undefined;
  const durationFromGame = sharedGame?.durationSeconds ?? undefined;
  const multiplayerStep: MultiplayerStep =
    sharedGame
      ? 'lobby'
      : multiplayerStepParam === 'join' || multiplayerStepParam === 'pass-play'
        ? multiplayerStepParam
        : 'overview';

  return {
    lang: modeFromGame ?? (isLanguage(lang) ? lang : 'pol'),
    durationSeconds: durationFromGame ?? (Number.isFinite(duration) ? clampDuration(duration) : 180),
    mode: normalizedMode,
    multiplayerStep,
    sharedCode: sharedGame ? encodeSharedGame(sharedGame) : null,
    sharedGame,
    sharedError: sharedCode && !sharedGame ? decoded.error : null,
  };
}

function normalizeSeed(seed: number): number {
  return (Number(seed) >>> 0) || 1;
}

export function createRandomSeed(): number {
  if (window.crypto?.getRandomValues) {
    return normalizeSeed(window.crypto.getRandomValues(new Uint32Array(1))[0] ?? 1);
  }

  return normalizeSeed(Math.floor(Math.random() * 0xffffffff));
}

function createSeededRandom(seed: number) {
  let state = normalizeSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRandom<T>(items: T[], rng: () => number): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function getRandomLetter(die: string, rng: () => number): string {
  return die[Math.floor(rng() * die.length)] ?? die[0] ?? '';
}

export function generateBoard(lang: Language, seed: number): Board {
  const spec = boardSpecs[lang];
  const dice = spec.dice.match(/.{1,6}/g) ?? [];
  const rng = createSeededRandom(seed);
  const flatLetters = shuffleWithRandom(dice, rng).map((die) => getRandomLetter(die, rng).toUpperCase());

  const cells = Array.from({ length: spec.rows * spec.cols }, (_, index) => ({
    id: `${index}`,
    value: flatLetters[index] ?? '',
  }));

  return {
    rows: spec.rows,
    cols: spec.cols,
    cells,
  };
}

export function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function normalizeWord(value: string): string {
  return value.trim().toLocaleUpperCase();
}

export function scoreWord(word: string): number {
  const len = word.length;
  if (len < 3) return 0;
  if (len <= 4) return 1;
  if (len === 5) return 2;
  if (len === 6) return 3;
  if (len === 7) return 5;
  return 11;
}

export function sortWordsLongestFirst(words: Iterable<string>): string[] {
  return [...words].sort((left, right) => right.length - left.length || left.localeCompare(right));
}

export function findWords(board: Board, trie: TrieNode, minLength = 3): SolverResults {
  const visited = Array.from({ length: board.cells.length }, () => false);
  const found = new Set<string>();
  const wordPaths: Record<string, number[][]> = {};
  const path: number[] = [];

  function record(word: string) {
    if (!wordPaths[word]) {
      wordPaths[word] = [];
    }
    wordPaths[word].push([...path]);
  }

  function step(index: number, node: TrieNode, word: string) {
    if (visited[index]) {
      return;
    }

    const value = board.cells[index]?.value;
    if (!value) {
      return;
    }

    const next = node[value];
    if (!next) {
      return;
    }

    const nextWord = word + value;
    path.push(index);

    if (next === 1) {
      if (nextWord.length >= minLength) {
        found.add(nextWord);
        record(nextWord);
      }
      path.pop();
      return;
    }

    if (next.$ && nextWord.length >= minLength) {
      found.add(nextWord);
      record(nextWord);
    }

    visited[index] = true;
    const row = Math.floor(index / board.cols);
    const col = index % board.cols;

    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
        if (rowOffset === 0 && colOffset === 0) {
          continue;
        }

        const nextRow = row + rowOffset;
        const nextCol = col + colOffset;
        if (
          nextRow < 0 ||
          nextRow >= board.rows ||
          nextCol < 0 ||
          nextCol >= board.cols
        ) {
          continue;
        }

        step(nextRow * board.cols + nextCol, next, nextWord);
      }
    }

    visited[index] = false;
    path.pop();
  }

  for (let index = 0; index < board.cells.length; index += 1) {
    step(index, trie, '');
  }

  return { found, wordPaths };
}
