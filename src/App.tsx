import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildQuery,
  clampDuration,
  createRandomSeed,
  formatTimer,
  generateBoard,
  normalizeWord,
  readInitialState,
  type Language,
  type Mode,
  type SetupState,
} from './game';
import { useDictionary } from './useDictionary';

const modeCopy: Record<
  Mode,
  {
    title: string;
    eyebrow: string;
    description: string;
    bullets: string[];
    primaryAction: string;
    note: string;
  }
> = {
  solo: {
    title: 'Solo',
    eyebrow: 'Practice on your own',
    description: 'One-player rounds with fast setup, local scoring, and a focused play surface.',
    bullets: ['Personal timer and safe setup memory', 'No shared links required', 'Built for desktop and phone'],
    primaryAction: 'Solo play setup',
    note: 'This home screen remembers your language and timer choices without starting a round.',
  },
  tv: {
    title: 'TV Display',
    eyebrow: 'Board + timer only',
    description: 'A distance-readable board and countdown surface for a monitor or shared screen.',
    bullets: ['Presentation-only layout', 'Pairs with local phone play later', 'Keeps private controls out of view'],
    primaryAction: 'TV Display setup',
    note: 'Setup stays editable here so a TV session can be prepared safely before play starts.',
  },
  multiplayer: {
    title: 'Multiplayer',
    eyebrow: 'Same room, no backend',
    description: 'Host, join, or pass a device around once the multiplayer flows land in later slices.',
    bullets: ['Shared-code and same-device paths', 'Backend-free round identity', 'Pre-game setup only in this slice'],
    primaryAction: 'Multiplayer setup',
    note: 'Home keeps the multiplayer entry prominent without exposing lobby or live-round UI yet.',
  },
};

const languageOptions: Array<{ value: Language; label: string }> = [
  { value: 'pol', label: 'Polski' },
  { value: 'eng', label: 'English' },
  { value: 'spa', label: 'Español' },
  { value: 'rus', label: 'Русский' },
];

type SoloRound = {
  seed: number;
  board: ReturnType<typeof generateBoard>;
  remainingSeconds: number;
  phase: 'booting' | 'live' | 'finished';
  words: string[];
  wordSet: Set<string>;
  statusMessage: string;
};

export function App() {
  const [state, setState] = useState<SetupState>(() => readInitialState());
  const [soloRound, setSoloRound] = useState<SoloRound | null>(null);
  const [wordInput, setWordInput] = useState('');
  const [mobileWordsOpen, setMobileWordsOpen] = useState(false);
  const [guardMessage, setGuardMessage] = useState('');
  const selectedModeCopy = modeCopy[state.mode];
  const modeCards = useMemo(() => Object.keys(modeCopy) as Mode[], []);
  const dictionary = useDictionary(state.lang);
  const soloTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onPopState = () => {
      setState(readInitialState());
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (soloRound?.phase !== 'live') {
      if (soloTimerRef.current !== null) {
        window.clearInterval(soloTimerRef.current);
        soloTimerRef.current = null;
      }
      return;
    }

    soloTimerRef.current = window.setInterval(() => {
      setSoloRound((current) => {
        if (!current || current.phase !== 'live') {
          return current;
        }

        if (current.remainingSeconds <= 1) {
          return {
            ...current,
            remainingSeconds: 0,
            phase: 'finished',
            statusMessage: 'Round complete. Reveal and scoring land in the next slice.',
          };
        }

        return { ...current, remainingSeconds: current.remainingSeconds - 1 };
      });
    }, 1000);

    return () => {
      if (soloTimerRef.current !== null) {
        window.clearInterval(soloTimerRef.current);
        soloTimerRef.current = null;
      }
    };
  }, [soloRound?.phase]);

  function updateState(nextState: SetupState, historyMode: 'push' | 'replace' = 'replace') {
    setState(nextState);
    const query = buildQuery(nextState);
    const nextUrl = `${window.location.pathname}?${query}`;

    if (historyMode === 'push') {
      window.history.pushState(null, '', nextUrl);
      return;
    }

    window.history.replaceState(null, '', nextUrl);
  }

  function patchState(patch: Partial<SetupState>, historyMode: 'push' | 'replace' = 'replace') {
    if (soloRound?.phase === 'live') {
      setGuardMessage('Restart to apply setup changes. The active board stays locked.');
      return;
    }

    setGuardMessage('');
    updateState({ ...state, ...patch }, historyMode);
  }

  function startSoloRound() {
    const seed = createRandomSeed();
    const board = generateBoard(state.lang, seed);

    setGuardMessage('');
    setWordInput('');
    setMobileWordsOpen(false);
    setSoloRound({
      seed,
      board,
      remainingSeconds: state.durationSeconds,
      phase: 'booting',
      words: [],
      wordSet: new Set(),
      statusMessage: 'Board ready. Start finding words.',
    });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setSoloRound((current) =>
          current
            ? {
                ...current,
                phase: 'live',
              }
            : current,
        );
      });
    });
  }

  function addWord() {
    const normalizedWord = normalizeWord(wordInput);

    if (!soloRound || soloRound.phase !== 'live') {
      return;
    }

    if (!normalizedWord) {
      setSoloRound({ ...soloRound, statusMessage: 'Type a word before submitting.' });
      return;
    }

    if (soloRound.wordSet.has(normalizedWord)) {
      setSoloRound({ ...soloRound, statusMessage: `Already added: ${normalizedWord}` });
      return;
    }

    const nextWordSet = new Set(soloRound.wordSet);
    nextWordSet.add(normalizedWord);
    setSoloRound({
      ...soloRound,
      words: [...soloRound.words, normalizedWord],
      wordSet: nextWordSet,
      statusMessage: `Added ${normalizedWord}`,
    });
    setWordInput('');
  }

  function onWordKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    addWord();
  }

  const timerUrgent = (soloRound?.remainingSeconds ?? 999) <= 15;
  const showSoloPlay = state.mode === 'solo' && soloRound !== null;
  const showModeGrid = !showSoloPlay;
  const showSoloSetupCard = state.mode === 'solo' && !showSoloPlay;

  return (
    <main className="app-shell">
      <section className="hero-card hero-layout">
        <div>
          <div className="eyebrow">Redesigned home</div>
          <h1>Choose how you want to play</h1>
          <p className="hero-copy">
            Solo, TV Display, and Multiplayer stay visible above the fold while safe pre-game setup
            choices persist in the URL for refreshes and deep links.
          </p>
        </div>
        <div className="hero-summary" aria-label="Current setup summary">
          <div className="summary-pill">Language: {languageOptions.find((option) => option.value === state.lang)?.label}</div>
          <div className="summary-pill">Timer: {Math.floor(state.durationSeconds / 60)} min</div>
          <div className="summary-pill">Mode: {selectedModeCopy.title}</div>
        </div>
      </section>

      <section className="mode-shell">
        <section className="mode-panel">
          <div className="panel-heading">
            <h2>Pick a mode</h2>
            <p>Each card opens a dedicated setup view without exposing live round UI too early.</p>
          </div>
          {showModeGrid ? (
            <div className="mode-grid">
              {modeCards.map((mode) => {
                const copy = modeCopy[mode];
                const active = state.mode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    className={`mode-card${active ? ' active' : ''}`}
                    aria-pressed={active}
                    onClick={() => patchState({ mode }, 'push')}
                  >
                    <span className="mode-eyebrow">{copy.eyebrow}</span>
                    <span className="mode-title">{copy.title}</span>
                    <span className="mode-description">{copy.description}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="status-card">
              <div className="eyebrow">Solo is live</div>
              <h3>Focused play surface</h3>
              <p className="hero-copy">
                Mode switching is hidden during active solo play so board, timer, and word entry
                keep the spotlight.
              </p>
            </div>
          )}
        </section>

        <section className="panel setup-panel">
          <div className="panel-heading">
            <h2>{showSoloPlay ? 'Solo round' : selectedModeCopy.primaryAction}</h2>
            <p>{selectedModeCopy.note}</p>
          </div>

          <div className="setup-grid">
            <label className="field">
              <span>Language</span>
              <select
                aria-label="Language"
                value={state.lang}
                onChange={(event) => patchState({ lang: event.target.value as Language })}
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="field">
              <span>Round length</span>
              <div className="duration-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    patchState({ durationSeconds: clampDuration(state.durationSeconds - 60) })
                  }
                >
                  −1 min
                </button>
                <strong aria-live="polite">{Math.floor(state.durationSeconds / 60)} min</strong>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    patchState({ durationSeconds: clampDuration(state.durationSeconds + 60) })
                  }
                >
                  +1 min
                </button>
              </div>
              <p className="field-note">Clamped from 1 to 10 minutes so setup stays valid.</p>
            </div>
          </div>

          {guardMessage ? (
            <div className="guard-banner" data-testid="round-guard">
              {guardMessage}
            </div>
          ) : null}

          {showSoloSetupCard ? (
            <div className="status-card">
              <div className="eyebrow">Solo pre-start</div>
              <h3>Solo play setup</h3>
              <p className="hero-copy">
                Fresh solo rounds stay readable before play begins: setup is visible, word entry is
                disabled, and the board only becomes live after boot.
              </p>
              <div className="solo-prestart-meta">
                <div className="summary-pill" data-testid="dictionary-status">
                  {dictionary.message}
                </div>
                <div className="summary-pill" data-testid="timer-chip">
                  {formatTimer(state.durationSeconds)}
                </div>
              </div>
              <label className="field">
                <span>Word entry</span>
                <input
                  aria-label="Word entry"
                  disabled
                  placeholder="Starts when the board is live"
                  value=""
                  readOnly
                />
              </label>
              <div className="action-row">
                <button type="button" className="primary-button" onClick={startSoloRound}>
                  Start solo round
                </button>
                <button type="button" className="secondary-button" disabled>
                  Reveal words
                </button>
              </div>
            </div>
          ) : null}

          {showSoloPlay && soloRound ? (
            <div className={`solo-live-shell${timerUrgent ? ' final-seconds' : ''}`}>
              <div className="solo-live-header">
                <div>
                  <div className="eyebrow">Solo live play</div>
                  <h3>Solo round</h3>
                </div>
                <div className="solo-live-chips">
                  <div className={`summary-pill timer-pill${timerUrgent ? ' urgent' : ''}`} data-testid="timer-chip">
                    {formatTimer(soloRound.remainingSeconds)}
                  </div>
                  <div
                    className={`summary-pill dictionary-pill dictionary-${dictionary.state}`}
                    data-testid="dictionary-status"
                  >
                    {dictionary.message}
                  </div>
                </div>
              </div>

              {timerUrgent ? <p className="urgent-copy">Final seconds — submit any last words now.</p> : null}

              <div
                className="solo-board"
                style={{
                  gridTemplateColumns: `repeat(${soloRound.board.cols}, minmax(0, 1fr))`,
                }}
              >
                {soloRound.board.cells.map((cell) => (
                  <div key={cell.id} className="board-cell" data-testid="board-cell">
                    {cell.value}
                  </div>
                ))}
              </div>

              <div className="solo-composer">
                <label className="field solo-word-field">
                  <span>Word entry</span>
                  <input
                    aria-label="Word entry"
                    value={wordInput}
                    onChange={(event) => setWordInput(event.target.value)}
                    onKeyDown={onWordKeyDown}
                    placeholder={soloRound.phase === 'booting' ? 'Board booting…' : 'Type a word'}
                    disabled={soloRound.phase !== 'live'}
                  />
                </label>
                <button
                  type="button"
                  className="primary-button add-word-button"
                  onClick={addWord}
                  disabled={soloRound.phase !== 'live'}
                >
                  Add word
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={dictionary.state !== 'ready'}
                >
                  Reveal words
                </button>
              </div>

              <p className="field-note" data-testid="word-status">
                {soloRound.statusMessage}
              </p>

              <button
                type="button"
                className="secondary-button mobile-words-toggle"
                onClick={() => setMobileWordsOpen((current) => !current)}
              >
                {mobileWordsOpen ? 'Hide entered words' : 'Show entered words'}
              </button>

              <div
                className={`status-card player-word-card${mobileWordsOpen ? ' expanded' : ''}`}
                data-testid="player-word-list"
              >
                <div className="eyebrow">Entered words</div>
                <p className="hero-copy">
                  Solver output stays hidden until reveal or timeout. Only your own submissions show
                  during live play.
                </p>
                <ul className="word-list-live">
                  {soloRound.words.length === 0 ? (
                    <li className="word-list-empty">No words entered yet.</li>
                  ) : (
                    soloRound.words.map((word) => <li key={word}>{word}</li>)
                  )}
                </ul>
              </div>
            </div>
          ) : null}

          {!showSoloSetupCard && state.mode !== 'solo' ? (
            <div className="status-card">
              <div className="eyebrow">{selectedModeCopy.eyebrow}</div>
              <h3>{selectedModeCopy.title} setup</h3>
              <p className="hero-copy">{selectedModeCopy.description}</p>
              <ul className="bullet-list">
                {selectedModeCopy.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <div className="action-row">
                <button type="button" className="primary-button">
                  Coming in the next slice
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>URL-backed setup</h2>
          <p>
            Refreshing or deep-linking with safe setup params restores this home surface without
            auto-starting a round.
          </p>
        </div>
        <div className="placeholder-card">
          <p>
            Safe params persist for language, timer, and selected home mode only. No board, score,
            word entry, or results state appears before play begins.
          </p>
          <code>{window.location.pathname}?{buildQuery(state)}</code>
        </div>
      </section>
    </main>
  );
}
