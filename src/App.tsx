import { useMemo, useState } from 'react';

type Mode = 'solo' | 'tv' | 'multiplayer';
type Surface = 'shell' | 'legacy';
type Language = 'pol' | 'eng' | 'spa' | 'rus';

type SetupState = {
  lang: Language;
  durationSeconds: number;
  mode: Mode;
  surface: Surface;
};

const modeCopy: Record<Mode, { title: string; description: string }> = {
  solo: {
    title: 'Solo',
    description: 'One-player rounds with modern setup, play, and results flows.',
  },
  tv: {
    title: 'TV Display',
    description: 'Read-only presentation surface for board and timer visibility.',
  },
  multiplayer: {
    title: 'Multiplayer',
    description: 'Foundation for same-device and shared-code play without a backend.',
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
  const surface = params.get('surface');

  return {
    lang: isLanguage(lang) ? lang : 'pol',
    durationSeconds: Number.isFinite(duration) ? clampDuration(duration) : 180,
    mode: isMode(mode) ? mode : 'solo',
    surface: surface === 'legacy' ? 'legacy' : 'shell',
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

  if (state.surface === 'legacy') {
    params.set('surface', 'legacy');
  }

  return params.toString();
}

function buildLegacyUrl(state: SetupState): string {
  const params = new URLSearchParams();
  params.set('lang', state.lang);
  params.set('t', String(state.durationSeconds));
  return `./legacy.html?${params.toString()}`;
}

export function App() {
  const [state, setState] = useState<SetupState>(() => readInitialState());

  const legacyUrl = useMemo(() => buildLegacyUrl(state), [state]);
  const selectedModeCopy = modeCopy[state.mode];

  function updateState(nextState: SetupState) {
    setState(nextState);
    const query = buildQuery(nextState);
    window.history.replaceState(null, '', `${window.location.pathname}?${query}`);
  }

  function patchState(patch: Partial<SetupState>) {
    updateState({ ...state, ...patch });
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="eyebrow">Static web app foundation</div>
        <h1>Oggleb redesign bootstrap</h1>
        <p className="hero-copy">
          React + TypeScript + Vite now hosts the redesign shell while the current deterministic
          board, local dictionaries, and single-file game remain available behind a legacy bridge.
        </p>
      </section>

      <section className="shell-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Modes</h2>
            <p>Choose the redesign surface to continue building.</p>
          </div>
          <div className="mode-grid">
            {(Object.keys(modeCopy) as Mode[]).map((mode) => {
              const active = state.mode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  className={`mode-card${active ? ' active' : ''}`}
                  onClick={() => patchState({ mode, surface: 'shell' })}
                >
                  <span className="mode-title">{modeCopy[mode].title}</span>
                  <span className="mode-description">{modeCopy[mode].description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Setup state</h2>
            <p>These values already persist in the URL for future screen work.</p>
          </div>

          <label className="field">
            <span>Language</span>
            <select
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
              <strong>{Math.floor(state.durationSeconds / 60)} min</strong>
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
          </div>

          <div className="status-card">
            <h3>{selectedModeCopy.title}</h3>
            <p>{selectedModeCopy.description}</p>
            <p className="status-note">
              This foundation keeps the current game logic reachable while later features replace the
              placeholder shell with dedicated mode controllers.
            </p>
          </div>

          <div className="action-row">
            <button type="button" className="primary-button" onClick={() => patchState({ surface: 'legacy' })}>
              Launch classic board
            </button>
            {state.surface === 'legacy' ? (
              <button type="button" className="secondary-button" onClick={() => patchState({ surface: 'shell' })}>
                Back to shell
              </button>
            ) : null}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Migration bridge</h2>
          <p>
            The embedded legacy surface below runs the existing single-file game entry with local trie
            assets, preserving deterministic gameplay during the redesign.
          </p>
        </div>

        {state.surface === 'legacy' ? (
          <iframe
            className="legacy-frame"
            title="Legacy Oggleb board"
            src={legacyUrl}
          />
        ) : (
          <div className="placeholder-card">
            <p>
              The redesign shell is active. Use <strong>Launch classic board</strong> to open the
              current implementation inside the new app foundation.
            </p>
            <code>{window.location.pathname}?{buildQuery(state)}</code>
          </div>
        )}
      </section>
    </main>
  );
}
