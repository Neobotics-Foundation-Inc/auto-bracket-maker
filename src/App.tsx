import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackupsPanel } from './components/BackupsPanel';
import { BracketView } from './components/BracketView';
import { ConfirmDialog, type ConfirmRequest } from './components/ConfirmDialog';
import { CustomizePage } from './components/CustomizePage';
import { PodiumView } from './components/PodiumView';
import { RaceTimer } from './components/RaceTimer';
import { SetupPage } from './components/SetupPage';
import { StandingsView } from './components/StandingsView';
import { ThemeSwitch } from './components/ThemeSwitch';
import {
  addBackup,
  contentOf,
  loadBackups,
  reasonFor,
  restoreState,
  saveBackups,
  withoutBackup,
  type Backup,
  type BackupReason,
} from './lib/backups';
import { advanceWinner, buildBracket, progress, resetBracket, sectionRoundName } from './lib/bracket';
import { loadBranding, saveBranding, upgradeLogo, type Branding } from './lib/branding';
import { describeEvent, EventFileError, eventFileName, parseEventFile, toEventFile } from './lib/eventFile';
import { describeResult, EMPTY_HISTORY, record, redo as redoResult, undo as undoResult, type History } from './lib/history';
import { chime, unlockAudio } from './lib/chime';
import { inkOn, onLight } from './lib/colors';
import { seedTeams } from './lib/entrants';
import { showsBothBrackets } from './lib/layout';
import { initialState, loadState, saveState } from './lib/storage';
import { adjust, phase, reset as resetTimer, setDuration, toggle } from './lib/timer';
import type { AppState, BracketPane, SeededTeam, View } from './lib/types';

const PRESENT_VIEWS: { view: View; label: string }[] = [
  { view: 'standings', label: 'Standings' },
  { view: 'bracket', label: 'Bracket' },
  { view: 'podium', label: 'Podium' },
];

const PANES: { pane: BracketPane; label: string }[] = [
  { pane: 'winners', label: 'Winners bracket' },
  { pane: 'losers', label: 'Losers bracket' },
  { pane: 'grand', label: 'Grand final' },
];

/** Icons for the view tabs, shown only on phones, where the tabs become a bottom tab bar. */
const TAB_ICONS: Record<View, string> = {
  customize: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  setup: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  standings: 'M12 13V9.5M10 3h4M12 6a7 7 0 1 0 0 14a7 7 0 0 0 0-14',
  bracket: 'M3 5h5v14H3M8 12h5M13 8h8M13 16h8M13 8v8',
  podium: 'M2 20h20M4 20v-7h5v7M9 20V8h6v12M15 20v-5h5v5',
};

function TabIcon({ view }: { view: View }) {
  return (
    <svg className="tabs__icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path d={TAB_ICONS[view]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const signature = (teams: SeededTeam[]) => JSON.stringify(teams.map((t) => [t.id, t.name, t.timeMs]));

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [branding, setBranding] = useState<Branding>(loadBranding);
  const changeBranding = (next: Branding) => {
    setBranding(next);
    return saveBranding(next);
  };
  // A logo saved before the current processing (say, with its white background still on) is redone once.
  useEffect(() => {
    let canceled = false;
    upgradeLogo(loadBranding())
      .then((upgraded) => {
        if (upgraded && !canceled) {
          const next = { ...loadBranding(), ...upgraded };
          setBranding(next);
          saveBranding(next);
        }
      })
      .catch(() => {});
    return () => {
      canceled = true;
    };
  }, []);
  const [present, setPresent] = useState(false);
  // Presenting, the controls and cursor fade out after a few seconds without input.
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!present) return setIdle(false);
    let timer = 0;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), 3000);
    };
    wake();
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, wake);
    return () => {
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, wake);
    };
  }, [present]);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const closeConfirm = useCallback(() => setConfirmRequest(null), []);
  const { event, entrants, format, bracket, view, theme } = state;
  const patch = useCallback((p: Partial<AppState>) => setState((s) => ({ ...s, ...p })), []);

  useEffect(() => saveState(state), [state]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // A short message after an undo, redo, restore or import, so a click on a projector is confirmed.
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // Backups: a copy of the event a couple of seconds after each change settles, and one straight
  // away before anything that replaces it. Kept in this browser (see lib/backups).
  const [backups, setBackups] = useState<Backup[]>(loadBackups);
  const keepBackup = useCallback((content: ReturnType<typeof contentOf>, reason?: BackupReason) => {
    setBackups((list) => {
      const next = addBackup(list, content, reason ?? reasonFor(list[0], content), Date.now());
      return next === list ? list : saveBackups(next);
    });
  }, []);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const id = window.setTimeout(() => keepBackup(contentOf(stateRef.current)), 2000);
    return () => clearTimeout(id);
  }, [event, entrants, format, bracket, keepBackup]);

  // Undo and redo for race results, this session only (backups cover a reload).
  const [history, setHistory] = useState<History>(EMPTY_HISTORY);
  const pick = (matchId: string, teamId: string) => {
    if (!state.bracket) return;
    const next = advanceWinner(state.bracket, matchId, teamId);
    if (next === state.bracket) return;
    setHistory((h) => record(h, state.bracket!));
    patch({ bracket: next });
  };
  const stepHistory = (direction: 'undo' | 'redo') => {
    if (!state.bracket) return;
    const step = (direction === 'undo' ? undoResult : redoResult)(history, state.bracket);
    if (!step) return;
    // The result being undone is the one that turned the earlier bracket into the later one.
    const change =
      direction === 'undo' ? describeResult(step.bracket, state.bracket) : describeResult(state.bracket, step.bracket);
    setHistory(step.history);
    patch({ bracket: step.bracket });
    setToast(`${direction === 'undo' ? 'Undid' : 'Redid'}: ${change ?? 'the last result'}`);
  };
  const canUndo = !!state.bracket && history.past.length > 0;
  const canRedo = !!state.bracket && history.future.length > 0;
  const lastResult = canUndo ? describeResult(history.past[history.past.length - 1], state.bracket!) : null;
  const nextResult = canRedo ? describeResult(state.bracket!, history.future[history.future.length - 1]) : null;
  // The event's theme colors; without them the stylesheet's Neobotics colors apply.
  const colors = branding.colors;
  useEffect(() => {
    const root = document.documentElement.style;
    const vars = colors && {
      '--brand': colors.main,
      '--brand-ink': inkOn(colors.main),
      '--brand-light': onLight(colors.main),
      '--brand-light-ink': inkOn(onLight(colors.main)),
      '--brand-text': colors.text,
    };
    for (const name of ['--brand', '--brand-ink', '--brand-light', '--brand-light-ink', '--brand-text']) {
      if (vars) root.setProperty(name, vars[name as keyof typeof vars]);
      else root.removeProperty(name);
    }
  }, [colors]);
  useEffect(() => {
    document.title = event.title ? `${event.title} · Auto Bracket Generator` : 'Auto Bracket Generator';
  }, [event.title]);

  const seeded = useMemo(() => seedTeams(entrants), [entrants]);
  const bracketTeams = useMemo(
    () => (bracket ? Object.values(bracket.teams).sort((a, b) => a.seed - b.seed) : null),
    [bracket],
  );
  const stale = !!bracket && (signature(bracketTeams!) !== signature(seeded) || bracket.format !== format);
  const standings = bracketTeams ?? seeded;
  const hasLosers = !!bracket?.losers.length;
  // Smaller double-elimination brackets show both halves together; larger ones switch between them.
  const combined = !!bracket && showsBothBrackets(bracket);
  const split = hasLosers && !combined;
  const pane = split ? state.pane : 'winners';

  // Early rounds can be hidden on the winners and losers views, each remembering its own starting round.
  const canHideRounds = !combined && pane !== 'grand';
  const fromKey = pane === 'losers' ? 'losersFirstRound' : 'firstRound';
  // On separate tabs the finals move to the grand final tab, so they aren't offered here.
  const roundCount = ((pane === 'losers' ? bracket?.losers.length : bracket?.rounds.length) ?? 0) - (split ? 1 : 0);
  const shownFrom = Math.min(state[fromKey], Math.max(roundCount - 1, 0));
  const roundLabel = (r: number) => sectionRoundName(bracket!, pane === 'losers' ? 'losers' : 'main', r);
  const setShownFrom = (r: number) => patch({ [fromKey]: Math.min(Math.max(r, 0), roundCount - 1) });

  const setView = (next: View) => patch({ view: next });
  // On a phone, as in its apps, each tab opens at the top rather than where the last one was scrolled.
  useEffect(() => {
    if (window.matchMedia('(max-width: 720px)').matches) window.scrollTo(0, 0);
  }, [view]);

  // The race timer: one button starts, pauses or (once time is up) resets it.
  const { timer } = state;
  const toggleTimer = () => {
    unlockAudio();
    setState((s) => ({ ...s, timer: toggle(s.timer, Date.now()) }));
  };
  const resetRaceTimer = () => setState((s) => ({ ...s, timer: resetTimer(s.timer) }));
  const adjustRaceTimer = (steps: number) => setState((s) => ({ ...s, timer: adjust(s.timer, steps) }));
  const setRaceLength = (ms: number) => setState((s) => ({ ...s, timer: setDuration(s.timer, ms) }));
  // At zero: the chime, and a redraw so controls show the timer has finished.
  const [, setTimeUp] = useState(0);
  useEffect(() => {
    if (timer.endsAt === null || timer.endsAt <= Date.now()) return;
    const id = window.setTimeout(() => {
      chime();
      setTimeUp((n) => n + 1);
    }, timer.endsAt - Date.now());
    return () => clearTimeout(id);
  }, [timer.endsAt]);

  /**
   * Replaces the event wholesale, after backing up the one it replaces. An event brought back (an
   * import, a restore, a reset bracket) is kept as a backup in turn, labeled for what happened, so
   * later changes are compared with it rather than with the event it replaced. Undo starts afresh.
   */
  const replaceEvent = (next: AppState, before: BackupReason, after?: BackupReason) => {
    keepBackup(contentOf(state), before);
    if (after) keepBackup(contentOf(next), after);
    setHistory(EMPTY_HISTORY);
    setState(next);
  };

  function generate() {
    const build = () =>
      replaceEvent(
        { ...state, bracket: buildBracket(seeded, format), view: 'bracket', pane: 'winners', firstRound: 0, losersFirstRound: 0 },
        'before-regenerate',
      );
    if (!bracket || progress(bracket).decided === 0) return build();
    setConfirmRequest({
      title: 'Regenerate the bracket?',
      message:
        'This builds a new bracket from the current teams, times and format, and clears every race result. The current bracket is kept in Backups on the Setup page.',
      confirmLabel: 'Regenerate',
      onConfirm: build,
    });
  }

  // Back to the bracket as generated: the same teams and seeds, every result cleared, the first
  // tab and round showing.
  function resetResults() {
    if (!bracket) return;
    const decided = progress(bracket).decided;
    setConfirmRequest({
      title: 'Reset the bracket?',
      message: `This clears all ${decided} race ${decided === 1 ? 'result' : 'results'}, putting the bracket back as it was when it was generated. The bracket with its results is kept in Backups on the Setup page.`,
      confirmLabel: 'Reset bracket',
      onConfirm: () => {
        replaceEvent(
          { ...state, bracket: resetBracket(bracket), pane: 'winners', firstRound: 0, losersFirstRound: 0 },
          'before-reset-bracket',
          'bracket-reset',
        );
        setToast('Bracket reset');
      },
    });
  }

  function deleteBackup(backup: Backup) {
    setConfirmRequest({
      title: 'Delete this backup?',
      message: `${describeEvent(backup.content)}. It can’t be brought back once deleted.`,
      confirmLabel: 'Delete',
      onConfirm: () => setBackups((list) => saveBackups(withoutBackup(list, backup))),
    });
  }

  function resetAll() {
    setConfirmRequest({
      title: 'Reset everything?',
      message:
        'This clears the event name, every team and time, and all race results. The event is kept in Backups on the Setup page.',
      confirmLabel: 'Reset all',
      onConfirm: () => replaceEvent({ ...initialState, theme }, 'before-reset'),
    });
  }

  // The event as a file: everything, logo and colors included, to keep anywhere and open on any computer.
  function exportEvent() {
    const now = new Date();
    const blob = new Blob([JSON.stringify(toEventFile(state, branding, now), null, 1)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = eventFileName(event.title, now);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function importEvent(file: File): Promise<string | null> {
    let opened: ReturnType<typeof parseEventFile>;
    try {
      opened = parseEventFile(await file.text());
    } catch (e) {
      return e instanceof EventFileError ? e.message : `Couldn’t read ${file.name}.`;
    }
    setConfirmRequest({
      title: 'Open this event?',
      message: `${describeEvent(opened.state)}. It replaces the event here, with its logo and colors; the current event is kept in Backups.`,
      confirmLabel: 'Open event',
      onConfirm: () => {
        replaceEvent({ ...opened.state, theme, view: 'setup' }, 'before-import', 'imported');
        changeBranding(opened.branding);
        setToast(`Opened ${opened.state.event.title.trim() || file.name}`);
      },
    });
    return null;
  }

  function restoreBackup(backup: Backup) {
    setConfirmRequest({
      title: 'Restore this backup?',
      message: `${describeEvent(backup.content)}. It replaces the event here; the current event is kept in Backups.`,
      confirmLabel: 'Restore',
      onConfirm: () => {
        replaceEvent(restoreState(state, backup), 'before-restore', 'restored');
        setToast('Backup restored');
      },
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

  const editing = view === 'customize' || view === 'setup';
  const canPresent = !editing && standings.length > 0;
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (confirmRequest || target?.closest('input, textarea, select')) return;
    // Ctrl+Z undoes the last result, Ctrl+Shift+Z or Ctrl+Y redoes it (Cmd on a Mac).
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.altKey && view === 'bracket' && (key === 'z' || key === 'y')) {
      e.preventDefault();
      stepHistory(key === 'y' || e.shiftKey ? 'redo' : 'undo');
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'f' || e.key === 'F') {
      if (canPresent || present) togglePresent();
    } else if (e.key === 'Escape' && present) {
      exitPresent();
    } else if (view === 'bracket' && bracket && e.key === ' ' && !target?.closest('button')) {
      e.preventDefault();
      toggleTimer();
    } else if (view === 'bracket' && canHideRounds && e.key === 'ArrowRight') {
      setShownFrom(shownFrom + 1);
    } else if (view === 'bracket' && canHideRounds && e.key === 'ArrowLeft') {
      setShownFrom(shownFrom - 1);
    }
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const showEventHeader = !editing;
  const customLogo = theme === 'dark' ? branding.logoDark : branding.logoLight;
  const paneSwitch = (
    <div className="segmented" role="group" aria-label="Bracket">
      {PANES.map(({ pane: p, label }) => (
        <button key={p} className={pane === p ? 'active' : ''} aria-pressed={pane === p} onClick={() => patch({ pane: p })}>
          {label}
        </button>
      ))}
    </div>
  );
  const counts = bracket ? progress(bracket) : null;

  return (
    <div
      className={`app ${present ? 'app--present' : ''} ${present && idle ? 'app--idle' : ''} ${
        theme === 'dark' ? 'app--world' : 'app--day'
      } ${editing ? 'app--setup' : ''}`}
    >
      {/* A grandstand beside the track, rendered in Blender (art/grandstand.py) in the style of
          the website's garage: at night for the dark theme, by day for the light theme. */}
      <div className="world" aria-hidden key={theme}>
        <picture>
          <source
            media="(max-aspect-ratio: 1/1)"
            srcSet={theme === 'dark' ? './world/grandstand-m.webp' : './world/grandstand-day-m.webp'}
          />
          <img src={theme === 'dark' ? './world/grandstand.webp' : './world/grandstand-day.webp'} alt="" />
        </picture>
      </div>
      {!present && (
        <header className="topbar">
          <div className="brand">
            {customLogo ? (
              <img className="custom-logo" src={customLogo} alt={event.title || 'Event logo'} />
            ) : (
              <img
                className="neobotics-logo"
                src={
                  theme === 'dark'
                    ? './brand/neobotics-logo-transparent-white.webp'
                    : './brand/neobotics-logo-transparent.webp'
                }
                alt="Neobotics Foundation Inc."
              />
            )}
            <span>Bracket Generator</span>
          </div>
          <nav className="tabs" aria-label="Views">
            <button className={view === 'customize' ? 'active' : ''} onClick={() => setView('customize')}>
              <TabIcon view="customize" />
              Customize
            </button>
            <button className={view === 'setup' ? 'active' : ''} onClick={() => setView('setup')}>
              <TabIcon view="setup" />
              Setup
            </button>
            <button
              className={view === 'standings' ? 'active' : ''}
              disabled={!standings.length}
              onClick={() => setView('standings')}
            >
              <TabIcon view="standings" />
              Standings
            </button>
            <button className={view === 'bracket' ? 'active' : ''} disabled={!bracket} onClick={() => setView('bracket')}>
              <TabIcon view="bracket" />
              Bracket
            </button>
            <button className={view === 'podium' ? 'active' : ''} disabled={!bracket} onClick={() => setView('podium')}>
              <TabIcon view="podium" />
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

      {view === 'customize' && (
        <CustomizePage branding={branding} onBrandingChange={changeBranding} onNext={() => setView('setup')} />
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
        >
          <BackupsPanel
            backups={backups}
            onExport={exportEvent}
            onImport={importEvent}
            onRestore={restoreBackup}
            onDelete={deleteBackup}
          />
        </SetupPage>
      )}

      {showEventHeader && (
        <div className="event-header">
          <h1>{event.title || 'Tournament Bracket'}</h1>
          {event.subtitle && <p>{event.subtitle}</p>}
          {view === 'standings' && <p className="event-header__tag">Time-trial standings</p>}
          {view === 'podium' && <p className="event-header__tag">Podium</p>}
          {view === 'bracket' && split && (
            <p className="event-header__tag">{PANES.find((p) => p.pane === pane)!.label}</p>
          )}
          {present && view === 'bracket' && bracket && (
            <RaceTimer timer={timer} onToggle={toggleTimer} onReset={resetRaceTimer} onAdjust={adjustRaceTimer} onSetDuration={setRaceLength} variant="stage" />
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
                  <select value={shownFrom} onChange={(e) => setShownFrom(Number(e.target.value))}>
                    {Array.from({ length: roundCount }, (_, r) => (
                      <option key={r} value={r}>
                        {roundLabel(r)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {counts && (
                <span className="muted">
                  {counts.decided} of {counts.total} races decided
                  <span className="toolbar__hint"> · click a team to mark the winner</span>
                </span>
              )}
              {stale && <span className="warn">Teams, times or format changed since this bracket was made.</span>}
              <div className="actions">
                <RaceTimer timer={timer} onToggle={toggleTimer} onReset={resetRaceTimer} onAdjust={adjustRaceTimer} onSetDuration={setRaceLength} variant="toolbar" />
                <button
                  className="btn"
                  disabled={!canUndo}
                  onClick={() => stepHistory('undo')}
                  title={canUndo ? `Undo: ${lastResult ?? 'the last result'} (Ctrl+Z)` : 'Nothing to undo'}
                >
                  Undo
                </button>
                <button
                  className="btn"
                  disabled={!canRedo}
                  onClick={() => stepHistory('redo')}
                  title={canRedo ? `Redo: ${nextResult ?? 'the result undone'} (Ctrl+Shift+Z)` : 'Nothing to redo'}
                >
                  Redo
                </button>
                <button
                  className="btn"
                  disabled={!counts?.decided}
                  onClick={resetResults}
                  title={counts?.decided ? 'Clear every result, back to the bracket as generated' : 'No results to clear yet'}
                >
                  Reset bracket
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
            firstRound={state.firstRound}
            losersFirstRound={state.losersFirstRound}
            present={present}
            onPick={pick}
          />
        </main>
      )}

      {view === 'podium' && bracket && (
        <main className="page page--stage">
          <PodiumView bracket={bracket} />
        </main>
      )}

      {present && (
        <div className={`present-controls ${idle ? 'present-controls--idle' : ''}`}>
          {view === 'bracket' && split && paneSwitch}
          {view === 'bracket' && bracket && canHideRounds && (
            <>
              <button
                className="btn"
                onClick={() => setShownFrom(shownFrom - 1)}
                disabled={shownFrom === 0}
                title="Show earlier rounds (←)"
              >
                ◀
              </button>
              <span>{shownFrom === 0 ? 'All rounds' : `From ${roundLabel(shownFrom)}`}</span>
              <button
                className="btn"
                onClick={() => setShownFrom(shownFrom + 1)}
                disabled={shownFrom >= roundCount - 1}
                title="Hide earlier rounds (→)"
              >
                ▶
              </button>
            </>
          )}
          {view === 'bracket' && bracket && (
            <>
              <button className="btn" onClick={toggleTimer} title="Start or pause the race timer (Space)">
                {{ idle: 'Start timer', running: 'Pause timer', paused: 'Resume timer', finished: 'Reset timer' }[phase(timer, Date.now())]}
              </button>
              {timer.pausedMs !== null && (
                <button className="btn" onClick={resetRaceTimer}>
                  Reset timer
                </button>
              )}
              {canUndo && (
                <button className="btn" onClick={() => stepHistory('undo')} title={`Undo: ${lastResult ?? 'the last result'} (Ctrl+Z)`}>
                  Undo
                </button>
              )}
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

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {confirmRequest && <ConfirmDialog request={confirmRequest} onClose={closeConfirm} />}
    </div>
  );
}
