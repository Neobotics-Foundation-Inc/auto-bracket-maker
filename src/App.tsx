import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BracketView } from './components/BracketView';
import { PodiumView } from './components/PodiumView';
import { SetupPage } from './components/SetupPage';
import { StandingsView } from './components/StandingsView';
import { advanceWinner, buildBracket, isByeMatch, progress, roundName } from './lib/bracket';
import { seedTeams } from './lib/entrants';
import { initialState, loadState, saveState } from './lib/storage';
import type { AppState, SeededTeam, View } from './lib/types';

const PRESENT_VIEWS: { view: View; label: string }[] = [
  { view: 'standings', label: 'Standings' },
  { view: 'bracket', label: 'Bracket' },
  { view: 'podium', label: 'Podium' },
];

const signature = (teams: SeededTeam[]) => JSON.stringify(teams.map((t) => [t.id, t.name, t.timeMs]));

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [present, setPresent] = useState(false);
  const { event, entrants, bracket, view, theme, firstRound } = state;
  const patch = useCallback((p: Partial<AppState>) => setState((s) => ({ ...s, ...p })), []);

  useEffect(() => saveState(state), [state]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.title = event.title ? `${event.title} · Auto Bracket Maker` : 'Auto Bracket Maker';
  }, [event.title]);

  const seeded = useMemo(() => seedTeams(entrants), [entrants]);
  const bracketTeams = useMemo(
    () => (bracket ? Object.values(bracket.teams).sort((a, b) => a.seed - b.seed) : null),
    [bracket],
  );
  const stale = !!bracketTeams && signature(bracketTeams) !== signature(seeded);
  const standings = bracketTeams ?? seeded;
  const roundCount = bracket?.rounds.length ?? 0;

  const setView = (next: View) => patch({ view: next });
  const shiftRound = useCallback(
    (delta: number) =>
      setState((s) => {
        const max = (s.bracket?.rounds.length ?? 1) - 1;
        return { ...s, firstRound: Math.min(Math.max(s.firstRound + delta, 0), max) };
      }),
    [],
  );

  function generate() {
    const hasResults = bracket?.rounds.flat().some((m) => m.winner && !isByeMatch(m));
    if (hasResults && !confirm('Regenerating clears every race result. Continue?')) return;
    patch({ bracket: buildBracket(seeded), view: 'bracket', firstRound: 0 });
  }

  function resetAll() {
    if (confirm('Clear the event, all teams, times and results?')) setState({ ...initialState, theme });
  }

  // Present mode: fullscreen with editing controls hidden. Leaving fullscreen (Esc) leaves present mode.
  const enterPresent = () => {
    setPresent(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const exitPresent = useCallback(() => {
    setPresent(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);
  const togglePresent = () => (present ? exitPresent() : enterPresent());

  useEffect(() => {
    const onFullscreen = () => {
      if (!document.fullscreenElement) setPresent(false);
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  const canPresent = view !== 'setup' && standings.length > 0;
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'f' || e.key === 'F') {
      if (canPresent || present) togglePresent();
    } else if (e.key === 'Escape' && present) {
      exitPresent();
    } else if (view === 'bracket' && e.key === 'ArrowRight') {
      shiftRound(1);
    } else if (view === 'bracket' && e.key === 'ArrowLeft') {
      shiftRound(-1);
    }
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const showEventHeader = view !== 'setup';
  const counts = bracket ? progress(bracket) : null;

  return (
    <div
      className={`app ${present ? 'app--present' : ''} ${theme === 'dark' ? 'app--world' : ''} ${
        view === 'setup' ? 'app--setup' : ''
      }`}
    >
      {theme === 'dark' && (
        // The Neobotics garage at night, as behind the website's home page.
        <div className="world" aria-hidden>
          <picture>
            <source media="(max-aspect-ratio: 1/1)" srcSet="./world/garage-m.webp" />
            <img src="./world/garage.webp" alt="" />
          </picture>
        </div>
      )}
      {!present && (
        <header className="topbar">
          <div className="brand">
            <img
              src={
                theme === 'dark'
                  ? './brand/neobotics-logo-transparent-white.webp'
                  : './brand/neobotics-logo-transparent.webp'
              }
              alt="Neobotics Foundation Inc."
            />
            <span>Bracket Maker</span>
          </div>
          <nav className="tabs" aria-label="Views">
            <button className={view === 'setup' ? 'active' : ''} onClick={() => setView('setup')}>
              Setup
            </button>
            <button
              className={view === 'standings' ? 'active' : ''}
              disabled={!standings.length}
              onClick={() => setView('standings')}
            >
              Standings
            </button>
            <button className={view === 'bracket' ? 'active' : ''} disabled={!bracket} onClick={() => setView('bracket')}>
              Bracket
            </button>
            <button className={view === 'podium' ? 'active' : ''} disabled={!bracket} onClick={() => setView('podium')}>
              Podium
            </button>
          </nav>
          <div className="actions">
            <button
              className="btn btn-quiet"
              onClick={() => patch({ theme: theme === 'dark' ? 'light' : 'dark' })}
              title="Switch colour theme"
            >
              {theme === 'dark' ? 'Light theme' : 'Dark theme'}
            </button>
            <button className="btn btn-primary" disabled={!canPresent} onClick={enterPresent} title="Present (F)">
              Present
            </button>
          </div>
        </header>
      )}

      {view === 'setup' && (
        <SetupPage
          event={event}
          entrants={entrants}
          hasBracket={!!bracket}
          bracketStale={stale}
          onEventChange={(e) => patch({ event: e })}
          onEntrantsChange={(list) => patch({ entrants: list })}
          onGenerate={generate}
          onViewBracket={() => setView('bracket')}
        />
      )}

      {showEventHeader && (
        <div className="event-header">
          <h1>{event.title || 'Tournament Bracket'}</h1>
          {event.subtitle && <p>{event.subtitle}</p>}
          {view === 'standings' && <p className="event-header__tag">Time-trial standings</p>}
          {view === 'podium' && <p className="event-header__tag">Podium</p>}
        </div>
      )}

      {view === 'standings' && (
        <main className="page page--stage">
          <StandingsView teams={standings} present={present} />
        </main>
      )}

      {view === 'bracket' && bracket && (
        <main className="page page--stage">
          {!present && (
            <div className="toolbar">
              <label>
                <span>Show from</span>
                <select value={firstRound} onChange={(e) => patch({ firstRound: Number(e.target.value) })}>
                  {bracket.rounds.map((_, r) => (
                    <option key={r} value={r}>
                      {roundName(bracket.size, r)}
                    </option>
                  ))}
                </select>
              </label>
              {counts && (
                <span className="muted">
                  {counts.decided} of {counts.total} races decided · click a team to mark the winner
                </span>
              )}
              {stale && <span className="warn">Teams or times changed since this bracket was made.</span>}
              <div className="actions">
                <button className="btn" onClick={() => setView('setup')}>
                  Back to setup
                </button>
                <button className="btn btn-quiet" onClick={resetAll}>
                  Reset all
                </button>
              </div>
            </div>
          )}
          <BracketView
            bracket={bracket}
            firstRound={firstRound}
            present={present}
            onPick={(round, index, teamId) => patch({ bracket: advanceWinner(bracket, round, index, teamId) })}
          />
        </main>
      )}

      {view === 'podium' && bracket && (
        <main className="page page--stage">
          <PodiumView bracket={bracket} />
        </main>
      )}

      {present && (
        <div className="present-controls">
          {view === 'bracket' && bracket && (
            <>
              <button className="btn" onClick={() => shiftRound(-1)} disabled={firstRound === 0} title="Show earlier rounds (←)">
                ◀
              </button>
              <span>{firstRound === 0 ? 'All rounds' : `From ${roundName(bracket.size, firstRound)}`}</span>
              <button
                className="btn"
                onClick={() => shiftRound(1)}
                disabled={firstRound >= roundCount - 1}
                title="Hide earlier rounds (→)"
              >
                ▶
              </button>
            </>
          )}
          {bracket &&
            PRESENT_VIEWS.filter((v) => v.view !== view).map((v) => (
              <button key={v.view} className="btn" onClick={() => setView(v.view)}>
                {v.label}
              </button>
            ))}
          <button className="btn" onClick={exitPresent} title="Exit (Esc)">
            Exit
          </button>
        </div>
      )}
    </div>
  );
}
