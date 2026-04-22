import { useEffect, useMemo, useState } from 'react';

type Mode = 'solo' | 'tv' | 'multiplayer';
type Language = 'pol' | 'eng' | 'spa' | 'rus';

type SetupState = {
  lang: Language;
  durationSeconds: number;
  mode: Mode;
};

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

const MIN_DURATION = 60;
const MAX_DURATION = 600;

function clampDuration(value: number): number {
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, value));
}

function readInitialState(): SetupState {
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

function isLanguage(value: string | null): value is Language {
  return value === 'pol' || value === 'eng' || value === 'spa' || value === 'rus';
}

function isMode(value: string | null): value is Mode {
  return value === 'solo' || value === 'tv' || value === 'multiplayer';
}

function buildQuery(state: SetupState): string {
  const params = new URLSearchParams();
  params.set('lang', state.lang);
  params.set('t', String(state.durationSeconds));
  params.set('mode', state.mode);

  return params.toString();
}

export function App() {
  const [state, setState] = useState<SetupState>(() => readInitialState());
  const selectedModeCopy = modeCopy[state.mode];
  const modeCards = useMemo(() => Object.keys(modeCopy) as Mode[], []);

  useEffect(() => {
    const onPopState = () => {
      setState(readInitialState());
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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
    updateState({ ...state, ...patch }, historyMode);
  }

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
        </section>

        <section className="panel setup-panel">
          <div className="panel-heading">
            <h2>{selectedModeCopy.primaryAction}</h2>
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

          <div className="status-card">
            <div className="eyebrow">{selectedModeCopy.eyebrow}</div>
            <h3>{selectedModeCopy.title} setup</h3>
        <p className="hero-copy">
              {selectedModeCopy.description}
            </p>
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
