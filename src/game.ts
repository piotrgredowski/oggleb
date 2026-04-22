export type Mode = 'solo' | 'tv' | 'multiplayer';
export type Language = 'pol' | 'eng' | 'spa' | 'rus';

export type SetupState = {
  lang: Language;
  durationSeconds: number;
  mode: Mode;
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
  const params = new URLSearchParams();
  params.set('lang', state.lang);
  params.set('t', String(state.durationSeconds));
  params.set('mode', state.mode);
  return params.toString();
}

export function readInitialState(): SetupState {
  const params = new URLSearchParams(window.location.search);
  const lang = params.get('lang');
  const duration = Number(params.get('t'));
  const mode = params.get('mode');

  return {
    lang: isLanguage(lang) ? lang : 'pol',
    durationSeconds: Number.isFinite(duration) ? clampDuration(duration) : 180,
    mode: isMode(mode) ? mode : 'solo',
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

export function generateBoard(lang: Language, seed: number) {
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
