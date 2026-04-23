import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildQuery,
  clampDuration,
  createRandomSeed,
  findWords,
  formatTimer,
  generateBoard,
  normalizeWord,
  readInitialState,
  scoreWord,
  sortWordsLongestFirst,
  type Language,
  type Mode,
  type SetupState,
  type SolverResults,
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
  phase: 'booting' | 'live' | 'finishing' | 'finished';
  words: string[];
  wordSet: Set<string>;
  statusMessage: string;
  solverResults: SolverResults | null;
  completedBy: 'timeout' | 'reveal' | null;
  completionError: string | null;
  scoringEnabled: Record<string, boolean>;
  highlightedWord: string | null;
};

type PassPlayPlayer = {
  id: string;
  name: string;
  active: boolean;
};

type PassPlayTurnRecord = {
  playerId: string;
  playerName: string;
  words: string[];
  wordSet: Set<string>;
};

type PassPlayRound = {
  seed: number;
  board: ReturnType<typeof generateBoard>;
  playerOrder: Array<{ id: string; name: string }>;
  activePlayerIndex: number;
  remainingSeconds: number;
  phase: 'handoff' | 'live' | 'turn-complete' | 'round-complete';
  turnRecords: Record<string, PassPlayTurnRecord>;
  statusMessage: string;
};

type PendingPassPlayAction =
  | { type: 'mode'; mode: Mode }
  | { type: 'lang'; lang: Language }
  | { type: 'duration'; durationSeconds: number }
  | { type: 'multiplayer-overview' };

type MultiplayerView = 'overview' | 'pass-play';

const initialPassPlayPlayers = (): PassPlayPlayer[] => [
  { id: 'p1', name: '', active: true },
  { id: 'p2', name: '', active: true },
  { id: 'p3', name: '', active: false },
  { id: 'p4', name: '', active: false },
];

export function App() {
  const [state, setState] = useState<SetupState>(() => readInitialState());
  const [soloRound, setSoloRound] = useState<SoloRound | null>(null);
  const [wordInput, setWordInput] = useState('');
  const [mobileWordsOpen, setMobileWordsOpen] = useState(false);
  const [guardMessage, setGuardMessage] = useState('');
  const [multiplayerView, setMultiplayerView] = useState<MultiplayerView>('overview');
  const [passPlayPlayers, setPassPlayPlayers] = useState<PassPlayPlayer[]>(() => initialPassPlayPlayers());
  const [passPlayRound, setPassPlayRound] = useState<PassPlayRound | null>(null);
  const [passPlayWordInput, setPassPlayWordInput] = useState('');
  const [pendingPassPlayAction, setPendingPassPlayAction] = useState<PendingPassPlayAction | null>(null);
  const selectedModeCopy = modeCopy[state.mode];
  const modeCards = useMemo(() => Object.keys(modeCopy) as Mode[], []);
  const dictionary = useDictionary(state.lang);
  const soloTimerRef = useRef<number | null>(null);
  const passPlayTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onPopState = () => {
      setState(readInitialState());
      setMultiplayerView('overview');
      setPassPlayPlayers(initialPassPlayPlayers());
      setPassPlayRound(null);
      setPassPlayWordInput('');
      setPendingPassPlayAction(null);
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
            phase: 'finishing',
            completedBy: 'timeout',
            statusMessage:
              dictionary.state === 'ready'
                ? 'Time up. Preparing results…'
                : 'Time up. Waiting for the dictionary so results can finish loading…',
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
  }, [dictionary.state, soloRound?.phase]);

  useEffect(() => {
    if (!soloRound || soloRound.phase !== 'finishing') {
      return;
    }

    setSoloRound((current) => {
      if (!current || current.phase !== 'finishing') {
        return current;
      }

      if (dictionary.state === 'error') {
        return {
          ...current,
          phase: 'finished',
          completionError: 'Results could not be produced because the dictionary failed to load.',
          statusMessage: 'Results could not be produced because the dictionary failed to load.',
        };
      }

      if (dictionary.state !== 'ready' || !dictionary.trie) {
        return current;
      }

      const solverResults = findWords(current.board, dictionary.trie);
      const scoringEnabled = Object.fromEntries(
        current.words.map((word) => [word, solverResults.found.has(word)]),
      );

      return {
        ...current,
        phase: 'finished',
        solverResults,
        completionError: null,
        scoringEnabled,
        statusMessage:
          current.completedBy === 'timeout'
            ? 'Time up. Results and scoring are ready.'
            : 'Reveal complete. Results and scoring are ready.',
      };
    });
  }, [dictionary.state, dictionary.trie, soloRound]);

  useEffect(() => {
    if (passPlayRound?.phase !== 'live') {
      if (passPlayTimerRef.current !== null) {
        window.clearInterval(passPlayTimerRef.current);
        passPlayTimerRef.current = null;
      }
      return;
    }

    passPlayTimerRef.current = window.setInterval(() => {
      setPassPlayRound((current) => {
        if (!current || current.phase !== 'live') {
          return current;
        }

        if (current.remainingSeconds <= 1) {
          const activePlayer = current.playerOrder[current.activePlayerIndex];
          return {
            ...current,
            remainingSeconds: 0,
            phase: current.activePlayerIndex === current.playerOrder.length - 1 ? 'round-complete' : 'turn-complete',
            statusMessage: `${activePlayer?.name ?? 'Current player'}’s turn is locked in.`,
          };
        }

        return { ...current, remainingSeconds: current.remainingSeconds - 1 };
      });
    }, 1000);

    return () => {
      if (passPlayTimerRef.current !== null) {
        window.clearInterval(passPlayTimerRef.current);
        passPlayTimerRef.current = null;
      }
    };
  }, [passPlayRound?.phase]);

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

  function applyPendingPassPlayAction(action: PendingPassPlayAction) {
    setPendingPassPlayAction(null);
    setPassPlayRound(null);
    setPassPlayWordInput('');
    setPassPlayPlayers(initialPassPlayPlayers());
    setGuardMessage('');

    if (action.type === 'multiplayer-overview') {
      setMultiplayerView('overview');
      return;
    }

    if (action.type === 'mode') {
      setMultiplayerView('overview');
      updateState({ ...state, mode: action.mode }, 'push');
      return;
    }

    if (action.type === 'lang') {
      updateState({ ...state, lang: action.lang }, 'replace');
      return;
    }

    updateState({ ...state, durationSeconds: action.durationSeconds }, 'replace');
  }

  function queuePassPlayAction(action: PendingPassPlayAction) {
    setPendingPassPlayAction(action);
    setGuardMessage('');
  }

  function patchState(patch: Partial<SetupState>, historyMode: 'push' | 'replace' = 'replace') {
    if (soloRound?.phase === 'live') {
      setGuardMessage('Restart to apply setup changes. The active board stays locked.');
      return;
    }

    if (passPlayRound && passPlayRound.phase !== 'round-complete') {
      if (patch.mode) {
        queuePassPlayAction({ type: 'mode', mode: patch.mode });
        return;
      }

      if (patch.lang) {
        queuePassPlayAction({ type: 'lang', lang: patch.lang });
        return;
      }

      if (patch.durationSeconds && patch.durationSeconds !== state.durationSeconds) {
        queuePassPlayAction({ type: 'duration', durationSeconds: patch.durationSeconds });
        return;
      }
    }

    setGuardMessage('');
    if (patch.mode && patch.mode !== 'multiplayer') {
      setMultiplayerView('overview');
      setPassPlayPlayers(initialPassPlayPlayers());
      setPassPlayRound(null);
      setPassPlayWordInput('');
    }
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
      solverResults: null,
      completedBy: null,
      completionError: null,
      scoringEnabled: {},
      highlightedWord: null,
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

  function finalizeSoloRound(source: 'timeout' | 'reveal') {
    setSoloRound((current) => {
      if (!current || (current.phase !== 'live' && current.phase !== 'finishing')) {
        return current;
      }

      if (dictionary.state === 'error') {
        return {
          ...current,
          remainingSeconds: source === 'timeout' ? 0 : current.remainingSeconds,
          phase: 'finished',
          completedBy: source,
          completionError: 'Results could not be produced because the dictionary failed to load.',
          solverResults: null,
          statusMessage: 'Results could not be produced because the dictionary failed to load.',
        };
      }

      const waitingForDictionary = dictionary.state !== 'ready' || !dictionary.trie;
      const solverResults = waitingForDictionary ? current.solverResults : findWords(current.board, dictionary.trie);
      const scoringEnabled = waitingForDictionary
        ? current.scoringEnabled
        : Object.fromEntries(current.words.map((word) => [word, solverResults?.found.has(word) ?? false]));

      return {
        ...current,
        remainingSeconds: source === 'timeout' ? 0 : current.remainingSeconds,
        phase: waitingForDictionary ? 'finishing' : 'finished',
        completedBy: source,
        completionError: null,
        solverResults,
        scoringEnabled,
        statusMessage: waitingForDictionary
          ? source === 'timeout'
            ? 'Time up. Waiting for the dictionary so results can finish loading…'
            : 'Waiting for the dictionary so reveal can finish…'
          : source === 'timeout'
            ? 'Time up. Results and scoring are ready.'
            : 'Reveal complete. Results and scoring are ready.',
      };
    });
  }

  function restartSoloRound() {
    startSoloRound();
  }

  function startPassPlayRound() {
    const playerOrder = activePassPlayPlayers.map((player) => ({
      id: player.id,
      name: player.name.trim(),
    }));
    const seed = createRandomSeed();
    const board = generateBoard(state.lang, seed);
    const turnRecords = Object.fromEntries(
      playerOrder.map((player) => [
        player.id,
        {
          playerId: player.id,
          playerName: player.name,
          words: [],
          wordSet: new Set<string>(),
        } satisfies PassPlayTurnRecord,
      ]),
    ) as Record<string, PassPlayTurnRecord>;

    setGuardMessage('');
    setPendingPassPlayAction(null);
    setPassPlayWordInput('');
    setPassPlayRound({
      seed,
      board,
      playerOrder,
      activePlayerIndex: 0,
      remainingSeconds: state.durationSeconds,
      phase: 'handoff',
      turnRecords,
      statusMessage: `${playerOrder[0]?.name ?? 'First player'}, get ready for your turn.`,
    });
  }

  function startPassPlayTurn() {
    setPassPlayWordInput('');
    setPassPlayRound((current) => {
      if (!current || current.phase !== 'handoff') {
        return current;
      }

      return {
        ...current,
        remainingSeconds: state.durationSeconds,
        phase: 'live',
        statusMessage: `${current.playerOrder[current.activePlayerIndex]?.name ?? 'Current player'} is live. Only this player’s words are visible.`,
      };
    });
  }

  function addPassPlayWord() {
    const normalizedWord = normalizeWord(passPlayWordInput);

    setPassPlayRound((current) => {
      if (!current || current.phase !== 'live') {
        return current;
      }

      const activePlayer = current.playerOrder[current.activePlayerIndex];
      const currentRecord = current.turnRecords[activePlayer.id];

      if (!normalizedWord) {
        return {
          ...current,
          statusMessage: 'Type a word before submitting.',
        };
      }

      if (currentRecord.wordSet.has(normalizedWord)) {
        return {
          ...current,
          statusMessage: `Already added: ${normalizedWord}`,
        };
      }

      const nextWordSet = new Set(currentRecord.wordSet);
      nextWordSet.add(normalizedWord);

      return {
        ...current,
        turnRecords: {
          ...current.turnRecords,
          [activePlayer.id]: {
            ...currentRecord,
            words: [...currentRecord.words, normalizedWord],
            wordSet: nextWordSet,
          },
        },
        statusMessage: `Added ${normalizedWord}`,
      };
    });

    setPassPlayWordInput('');
  }

  function finishPassPlayTurn() {
    setPassPlayRound((current) => {
      if (!current || current.phase !== 'live') {
        return current;
      }

      const activePlayer = current.playerOrder[current.activePlayerIndex];
      return {
        ...current,
        phase: current.activePlayerIndex === current.playerOrder.length - 1 ? 'round-complete' : 'turn-complete',
        statusMessage: `${activePlayer?.name ?? 'Current player'}’s turn is locked in.`,
      };
    });
    setPassPlayWordInput('');
  }

  function advancePassPlayTurn() {
    setPassPlayWordInput('');
    setPassPlayRound((current) => {
      if (!current || current.phase !== 'turn-complete') {
        return current;
      }

      const nextPlayerIndex = current.activePlayerIndex + 1;
      const nextPlayer = current.playerOrder[nextPlayerIndex];

      return {
        ...current,
        activePlayerIndex: nextPlayerIndex,
        remainingSeconds: state.durationSeconds,
        phase: 'handoff',
        statusMessage: `${nextPlayer?.name ?? 'Next player'}, get ready for your turn.`,
      };
    });
  }

  function onPassPlayWordKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    addPassPlayWord();
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
  const solvedWords = soloRound?.solverResults ? sortWordsLongestFirst(soloRound.solverResults.found) : [];
  const playerWordRows =
    soloRound?.phase === 'finished' && soloRound.solverResults
      ? soloRound.words.map((word) => {
          const valid = soloRound.solverResults?.found.has(word) ?? false;
          const enabled = valid && (soloRound.scoringEnabled[word] ?? true);
          return {
            word,
            valid,
            enabled,
            points: enabled ? scoreWord(word) : 0,
          };
        })
      : [];
  const playerScore = playerWordRows.reduce((total, row) => total + row.points, 0);
  const highlightedCells = new Set(
    soloRound?.highlightedWord && soloRound.solverResults?.wordPaths[soloRound.highlightedWord]
      ? soloRound.solverResults.wordPaths[soloRound.highlightedWord].flat()
      : [],
  );
  const canRevealEarly =
    showSoloPlay && soloRound?.phase === 'live' && (dictionary.state === 'ready' || dictionary.state === 'error');
  const roundFinished = soloRound?.phase === 'finished';
  const mobileSoloFocus = showSoloPlay && !roundFinished;
  const activePassPlayPlayers = passPlayPlayers.filter((player) => player.active);
  const normalizedActivePassPlayNames = activePassPlayPlayers.map((player) => normalizeWord(player.name));
  const duplicatePassPlayNames = new Set(
    normalizedActivePassPlayNames.filter(
      (name, index) => name && normalizedActivePassPlayNames.indexOf(name) !== index,
    ),
  );
  const passPlayPlayerErrors = new Map<string, string>();

  activePassPlayPlayers.forEach((player, index) => {
    const normalizedName = normalizeWord(player.name);
    if (!normalizedName) {
      passPlayPlayerErrors.set(player.id, `Player ${index + 1} needs a visible name.`);
      return;
    }

    if (duplicatePassPlayNames.has(normalizedName)) {
      passPlayPlayerErrors.set(player.id, 'Player names must be unique.');
    }
  });

  let passPlayRosterMessage = `Roster ready for ${activePassPlayPlayers.length} players.`;
  if (activePassPlayPlayers.length < 2) {
    passPlayRosterMessage = 'Add at least two players to start pass-and-play.';
  } else if (passPlayPlayerErrors.size > 0) {
    passPlayRosterMessage = passPlayPlayerErrors.values().next().value ?? 'Fix the roster before starting.';
  }
  const passPlayRosterReady = activePassPlayPlayers.length >= 2 && passPlayPlayerErrors.size === 0;
  const activePassPlayPlayer = passPlayRound?.playerOrder[passPlayRound.activePlayerIndex] ?? null;
  const activePassPlayRecord = activePassPlayPlayer ? passPlayRound?.turnRecords[activePassPlayPlayer.id] : null;
  const showPassPlayActiveRound = state.mode === 'multiplayer' && multiplayerView === 'pass-play' && passPlayRound !== null;

  return (
    <main className={`app-shell${mobileSoloFocus ? ' mobile-solo-focus' : ''}`}>
      <section className="hero-card hero-layout home-hero">
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
          <div className="panel-heading live-round-chrome">
            <h2>{showSoloPlay ? 'Solo round' : selectedModeCopy.primaryAction}</h2>
            <p>{selectedModeCopy.note}</p>
          </div>

          <div className="setup-grid live-round-chrome">
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
            <div className="guard-banner live-round-chrome" data-testid="round-guard">
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
                <span>Word entry (disabled until the round starts)</span>
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
              <div className={`solo-live-shell${timerUrgent ? ' final-seconds' : ''}${roundFinished ? ' round-finished' : ''}`}>
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
                  <div
                    key={cell.id}
                    className={`board-cell${highlightedCells.has(Number(cell.id)) ? ' highlighted' : ''}`}
                    data-testid="board-cell"
                    data-highlighted={highlightedCells.has(Number(cell.id)) ? 'true' : 'false'}
                  >
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
                    placeholder={soloRound.phase === 'booting' ? 'Board booting…' : roundFinished ? 'Round complete' : 'Type a word'}
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
                  onClick={() => finalizeSoloRound('reveal')}
                  disabled={!canRevealEarly}
                >
                  Reveal words
                </button>
                <button type="button" className="secondary-button" onClick={restartSoloRound}>
                  Restart round
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

              {roundFinished && soloRound.completionError ? (
                <div className="status-card" data-testid="solo-error-state">
                  <div className="eyebrow">Round complete</div>
                  <h3>Dictionary error</h3>
                  <p className="hero-copy">{soloRound.completionError}</p>
                  <p className="field-note">
                    Restart the round to try again with a fresh board once the dictionary asset is available.
                  </p>
                </div>
              ) : null}

              {roundFinished && soloRound.solverResults ? (
                <div className="results-shell" data-testid="solver-output">
                  <div className="status-card">
                    <div className="eyebrow">Round complete</div>
                    <h3>Solo results</h3>
                    <p className="hero-copy">
                      {soloRound.completedBy === 'timeout'
                        ? 'Timeout and manual reveal now share the same scoring and inspection surface.'
                        : 'Manual reveal now lands on the same scoring and inspection surface as timeout.'}
                    </p>
                    <div className="results-summary-grid">
                      <div className="summary-pill">Found words: {solvedWords.length}</div>
                      <div className="summary-pill">Entered: {soloRound.words.length}</div>
                      <div className="summary-pill" data-testid="player-score-total">
                        Score: {playerScore}
                      </div>
                    </div>
                  </div>

                  <div className="results-grid">
                    <div className="status-card">
                      <div className="eyebrow">Your words</div>
                      <ul className="results-word-list" data-testid="player-results-list">
                        {playerWordRows.length === 0 ? (
                          <li className="word-list-empty">No words entered this round.</li>
                        ) : (
                          playerWordRows.map((row) => (
                            <li key={row.word} className={`player-result-row ${row.valid ? 'valid' : 'invalid'}`}>
                              <button
                                type="button"
                                className="result-word-button"
                                disabled={!row.valid}
                                onMouseEnter={() =>
                                  setSoloRound((current) =>
                                    current ? { ...current, highlightedWord: row.valid ? row.word : null } : current,
                                  )
                                }
                                onMouseLeave={() =>
                                  setSoloRound((current) =>
                                    current?.highlightedWord ? { ...current, highlightedWord: null } : current,
                                  )
                                }
                              >
                                {row.word}
                              </button>
                              <span className={`result-state-pill ${row.valid ? 'valid' : 'invalid'}`}>
                                {row.valid ? 'Valid' : 'Invalid'}
                              </span>
                              <span className="player-result-points">{row.points} pts</span>
                              <label className="score-toggle">
                                <input
                                  aria-label={`Count ${row.word} as unique`}
                                  type="checkbox"
                                  checked={row.enabled}
                                  disabled={!row.valid}
                                  onChange={(event) =>
                                    setSoloRound((current) =>
                                      current
                                        ? {
                                            ...current,
                                            scoringEnabled: {
                                              ...current.scoringEnabled,
                                              [row.word]: event.target.checked,
                                            },
                                          }
                                        : current,
                                    )
                                  }
                                />
                                unique
                              </label>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>

                    <div className="status-card">
                      <div className="eyebrow">Solver output</div>
                      <p className="hero-copy">Sorted longest to shortest so the answer list is easy to scan.</p>
                      <ol className="results-word-list" data-testid="solver-results-list">
                        {solvedWords.map((word) => (
                          <li key={word}>
                            <button
                              type="button"
                              className="result-word-button"
                              onMouseEnter={() =>
                                setSoloRound((current) =>
                                  current ? { ...current, highlightedWord: word } : current,
                                )
                              }
                              onMouseLeave={() =>
                                setSoloRound((current) =>
                                  current?.highlightedWord ? { ...current, highlightedWord: null } : current,
                                )
                              }
                            >
                              {word}
                            </button>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!showSoloSetupCard && state.mode !== 'solo' ? (
            <div className="status-card">
              <div className="eyebrow">{selectedModeCopy.eyebrow}</div>
              <h3>{selectedModeCopy.title} setup</h3>
              {state.mode === 'multiplayer' && multiplayerView === 'overview' ? (
                <div className="multiplayer-branch-shell">
                  <p className="hero-copy">
                    Choose the multiplayer branch first so same-device pass-and-play stays distinct
                    from backend-free shared-code hosting and joining.
                  </p>
                  <div className="multiplayer-branch-grid">
                    <button
                      type="button"
                      className="mode-card multiplayer-branch-card"
                      onClick={() => setMultiplayerView('pass-play')}
                    >
                      <span className="mode-eyebrow">Same device</span>
                      <span className="mode-title">Pass-and-play on this device</span>
                      <span className="mode-description">
                        Build a local roster, hand the phone around, and keep every player&apos;s
                        answers private to this device.
                      </span>
                    </button>
                    <button type="button" className="mode-card multiplayer-branch-card">
                      <span className="mode-eyebrow">Shared code</span>
                      <span className="mode-title">Host or join with a shared code</span>
                      <span className="mode-description">
                        Shared-code hosting and joining stays separate from private pass-and-play
                        roster setup.
                      </span>
                    </button>
                  </div>
                </div>
              ) : null}

              {state.mode === 'multiplayer' && multiplayerView === 'pass-play' && !showPassPlayActiveRound ? (
                <div className="pass-play-setup-shell">
                  <div className="pass-play-heading-row">
                    <div>
                      <div className="eyebrow">Same device</div>
                      <h3>Pass-and-play roster</h3>
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setMultiplayerView('overview');
                        setPassPlayPlayers(initialPassPlayPlayers());
                      }}
                    >
                      Back to multiplayer
                    </button>
                  </div>
                  <p className="hero-copy">
                    Private pass-and-play state stays on this device only. Names, turn order, and
                    entered words are not added to the URL or shared-code flow.
                  </p>

                  <div className="pass-play-roster-list">
                    {passPlayPlayers.map((player, index) => {
                      const playerNumber = index + 1;
                      const error = player.active ? passPlayPlayerErrors.get(player.id) : null;
                      return (
                        <div key={player.id} className={`pass-play-player-card${player.active ? ' active' : ''}`}>
                          <div className="pass-play-player-header">
                            <label className="pass-play-toggle">
                              <input
                                aria-label={`Player ${playerNumber} active`}
                                type="checkbox"
                                checked={player.active}
                                onChange={(event) =>
                                  setPassPlayPlayers((current) =>
                                    current.map((entry) =>
                                      entry.id === player.id ? { ...entry, active: event.target.checked } : entry,
                                    ),
                                  )
                                }
                              />
                              Player {playerNumber}
                            </label>
                            <span className="summary-pill">{player.active ? 'Active' : 'Optional'}</span>
                          </div>
                          <label className="field">
                            <span>Player {playerNumber} name</span>
                            <input
                              aria-label={`Player ${playerNumber} name`}
                              value={player.name}
                              onChange={(event) =>
                                setPassPlayPlayers((current) =>
                                  current.map((entry) =>
                                    entry.id === player.id ? { ...entry, name: event.target.value } : entry,
                                  ),
                                )
                              }
                              placeholder={player.active ? 'Enter name' : 'Optional player'}
                            />
                          </label>
                          {error ? <p className="field-note pass-play-error">{error}</p> : null}
                        </div>
                      );
                    })}
                  </div>

                  <div
                    className={`guard-banner pass-play-status${passPlayRosterReady ? ' ready' : ''}`}
                    data-testid="pass-play-roster-status"
                  >
                    {passPlayRosterMessage}
                  </div>

                  <div className="action-row">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={!passPlayRosterReady}
                      onClick={startPassPlayRound}
                    >
                      Start pass-and-play round
                    </button>
                  </div>
                </div>
              ) : null}

              {showPassPlayActiveRound && passPlayRound && activePassPlayPlayer ? (
                <div className="pass-play-round-shell">
                  {pendingPassPlayAction ? (
                    <div className="guard-banner pass-play-abandon-guard" data-testid="pass-play-abandon-guard">
                      <strong>Leave pass-and-play and abandon this local round?</strong>
                      <p className="hero-copy">
                        Changing mode or setup now would discard the shared board and every hidden turn.
                      </p>
                      <div className="action-row">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setPendingPassPlayAction(null)}
                        >
                          Keep current round
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => applyPendingPassPlayAction(pendingPassPlayAction)}
                        >
                          Abandon round
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {passPlayRound.phase === 'handoff' ? (
                    <div className="status-card pass-play-handoff-card" data-testid="pass-play-handoff">
                      <div className="eyebrow">Private handoff</div>
                      <h3>{activePassPlayPlayer.name}, get ready for your turn.</h3>
                      <p className="hero-copy">
                        Pass the device now. Only this player’s entries will appear after the explicit start action.
                      </p>
                      <div className="results-summary-grid">
                        <div className="summary-pill">Board seed: {passPlayRound.seed}</div>
                        <div className="summary-pill" data-testid="timer-chip">
                          {formatTimer(state.durationSeconds)}
                        </div>
                        <div className="summary-pill">Player {passPlayRound.activePlayerIndex + 1} of {passPlayRound.playerOrder.length}</div>
                      </div>
                      <div className="action-row">
                        <button type="button" className="primary-button" onClick={startPassPlayTurn}>
                          Start {activePassPlayPlayer.name}’s turn
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {passPlayRound.phase === 'live' ? (
                    <div className="solo-live-shell pass-play-live-shell">
                      <div className="solo-live-header">
                        <div>
                          <div className="eyebrow">Pass-and-play live</div>
                          <h3 data-testid="pass-play-active-player">{activePassPlayPlayer.name}</h3>
                        </div>
                        <div className="solo-live-chips">
                          <div className="summary-pill" data-testid="timer-chip">
                            {formatTimer(passPlayRound.remainingSeconds)}
                          </div>
                          <div className="summary-pill">
                            Shared board for all {passPlayRound.playerOrder.length} players
                          </div>
                        </div>
                      </div>

                      <div
                        className="solo-board"
                        style={{
                          gridTemplateColumns: `repeat(${passPlayRound.board.cols}, minmax(0, 1fr))`,
                        }}
                      >
                        {passPlayRound.board.cells.map((cell) => (
                          <div key={cell.id} className="board-cell" data-testid="board-cell">
                            {cell.value}
                          </div>
                        ))}
                      </div>

                      <div className="solo-composer pass-play-composer">
                        <label className="field solo-word-field">
                          <span>Word entry</span>
                          <input
                            aria-label="Word entry"
                            value={passPlayWordInput}
                            onChange={(event) => setPassPlayWordInput(event.target.value)}
                            onKeyDown={onPassPlayWordKeyDown}
                            placeholder="Type a word"
                          />
                        </label>
                        <button type="button" className="primary-button add-word-button" onClick={addPassPlayWord}>
                          Add word
                        </button>
                        <button type="button" className="secondary-button" onClick={finishPassPlayTurn}>
                          End {activePassPlayPlayer.name}’s turn
                        </button>
                      </div>

                      <p className="field-note" data-testid="word-status">
                        {passPlayRound.statusMessage}
                      </p>

                      <div className="status-card player-word-card pass-play-active-words-card" data-testid="pass-play-active-words">
                        <div className="eyebrow">Private entries</div>
                        <p className="hero-copy">
                          Only {activePassPlayPlayer.name} can see this list during the live turn.
                        </p>
                        <ul className="word-list-live">
                          {activePassPlayRecord && activePassPlayRecord.words.length > 0 ? (
                            activePassPlayRecord.words.map((word) => <li key={word}>{word}</li>)
                          ) : (
                            <li className="word-list-empty">No words entered yet.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  ) : null}

                  {passPlayRound.phase === 'turn-complete' ? (
                    <div className="status-card pass-play-turn-complete-card" data-testid="pass-play-turn-complete">
                      <div className="eyebrow">Turn complete</div>
                      <h3>{activePassPlayPlayer.name}’s turn is locked in.</h3>
                      <p className="hero-copy">
                        The board stays the same for the next player, but private entries stay hidden until the final summary.
                      </p>
                      <div className="action-row">
                        <button type="button" className="primary-button" onClick={advancePassPlayTurn}>
                          Continue to next player
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {passPlayRound.phase === 'round-complete' ? (
                    <div className="status-card pass-play-turn-complete-card" data-testid="pass-play-round-complete">
                      <div className="eyebrow">All turns complete</div>
                      <h3>Every player finished one private turn.</h3>
                      <p className="hero-copy">
                        The shared board stayed fixed and each turn used a fresh timer. The detailed summary lands in the next slice.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {state.mode !== 'multiplayer' ? (
                <>
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
                </>
              ) : null}
            </div>
          ) : null}
        </section>
      </section>

      <section className="panel url-setup-panel">
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
