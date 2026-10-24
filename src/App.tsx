import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BracketView } from './components/BracketView';
import { ConfirmDialog, type ConfirmRequest } from './components/ConfirmDialog';
import { PodiumView } from './components/PodiumView';
import { SetupPage } from './components/SetupPage';
import { StandingsView } from './components/StandingsView';
import { ThemeSwitch } from './components/ThemeSwitch';
import { advanceWinner, buildBracket, progress, roundName } from './lib/bracket';
import { seedTeams } from './lib/entrants';
import { showsBothBrackets } from './lib/layout';
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
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const closeConfirm = useCallback(() => setConfirmRequest(null), []);
  const { event, entrants, format, bracket, view, theme, firstRound } = state;
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
  const stale = !!bracket && (signature(bracketTeams!) !== signature(seeded) || bracket.format !== format);
  const standings = bracketTeams ?? seeded;
  const roundCount = bracket?.rounds.length ?? 0;
  const hasLosers = !!bracket?.losers.length;
  // Smaller double-elimination brackets show both halves together; larger ones switch between them.
  const combined = !!bracket && showsBothBrackets(bracket);
  const split = hasLosers && !combined;
  const pane = split ? state.pane : 'winners';
  const canHideRounds = !combined && pane === 'winners';

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
    const build = () =>
      patch({ bracket: buildBracket(seeded, format), view: 'bracket', pane: 'winners', firstRound: 0 });
    if (!bracket || progress(bracket).decided === 0) return build();
    setConfirmRequest({
      title: 'Regenerate the bracket?',
      message: 'This builds a new bracket from the current teams, times and format, and clears every race result.',
      confirmLabel: 'Regenerate',
      onConfirm: build,
    });
  }

  function resetAll() {
    setConfirmRequest({
      title: 'Reset everything?',
      message: 'This clears the event name, every team and time, and all race results.',
      confirmLabel: 'Reset all',
      onConfirm: () => setState({ ...initialState, theme }),
    });
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
    if (confirmRequest || target?.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'f' || e.key === 'F') {
      if (canPresent || present) togglePresent();
    } else if (e.key === 'Escape' && present) {
      exitPresent();
    } else if (view === 'bracket' && canHideRounds && e.key === 'ArrowRight') {
      shiftRound(1);
    } else if (view === 'bracket' && canHideRounds && e.key === 'ArrowLeft') {
      shiftRound(-1);
    }
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const showEventHeader = view !== 'setup';
  const paneSwitch = (
    <div className="segmented" role="group" aria-label="Bracket">
      {(['winners', 'losers'] as const).map((p) => (
        <button key={p} className={pane === p ? 'active' : ''} aria-pressed={pane === p} onClick={() => patch({ pane: p })}>
          {p === 'winners' ? 'Winners bracket' : 'Losers bracket'}
        </button>
      ))}
    </div>
  );
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
            <ThemeSwitch theme={theme} onChange={(t) => patch({ theme: t })} />
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
          format={format}
          onFormatChange={(f) => patch({ format: f })}
          onGenerate={generate}
          onViewBracket={() => setView('bracket')}
          onConfirm={setConfirmRequest}
        />
      )}

      {showEventHeader && (
        <div className="event-header">
          <h1>{event.title || 'Tournament Bracket'}</h1>
          {event.subtitle && <p>{event.subtitle}</p>}
          {view === 'standings' && <p className="event-header__tag">Time-trial standings</p>}
          {view === 'podium' && <p className="event-header__tag">Podium</p>}
          {view === 'bracket' && split && (
            <p className="event-header__tag">{pane === 'losers' ? 'Losers bracket' : 'Winners bracket'}</p>
          )}
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
              {split && paneSwitch}
              {canHideRounds && (
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
              )}
              {counts && (
                <span className="muted">
                  {counts.decided} of {counts.total} races decided · click a team to mark the winner
                </span>
              )}
              {stale && <span className="warn">Teams, times or format changed since this bracket was made.</span>}
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
            pane={pane}
            firstRound={firstRound}
            present={present}
            onPick={(matchId, teamId) => patch({ bracket: advanceWinner(bracket, matchId, teamId) })}
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
          {view === 'bracket' && split && paneSwitch}
          {view === 'bracket' && bracket && canHideRounds && (
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
          <button className="btn btn-primary" onClick={exitPresent} title="Exit present mode (Esc)">
            Exit present mode
          </button>
        </div>
      )}

      {confirmRequest && <ConfirmDialog request={confirmRequest} onClose={closeConfirm} />}
    </div>
  );
}
