import { migrateBracket } from './bracket';
import { partsFromMs, parseTime } from './time';
import { migrateTimer, newTimer } from './timer';
import type { AppState, Entrant } from './types';

/** Entrants saved before times had separate boxes kept one timeText string. */
function migrateEntrant(saved: Entrant & { timeText?: string }): Entrant {
  if (saved.timeText === undefined) return saved;
  const { timeText, ...rest } = saved;
  const ms = parseTime(timeText);
  return { ...rest, ...(ms === null ? { min: '', sec: '', ms: '' } : partsFromMs(ms)) };
}

const KEY = 'auto-bracket-maker:v1';

export const initialState: AppState = {
  event: { title: '', subtitle: '' },
  entrants: [],
  format: 'race',
  bracket: null,
  view: 'customize',
  pane: 'winners',
  theme: 'dark',
  firstRound: 0,
  losersFirstRound: 0,
  timer: newTimer(),
};

/** A saved state (from storage, a backup or an event file), brought up to date. */
export function migrateState(saved: Partial<AppState>): AppState {
  const state: AppState = { ...initialState, ...saved };
  return {
    ...state,
    entrants: state.entrants.map(migrateEntrant),
    bracket: state.bracket && migrateBracket(state.bracket),
    timer: migrateTimer(state.timer),
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrateState(JSON.parse(raw) as Partial<AppState>);
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  return initialState;
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage blocked or full: the app still works for this page load.
  }
}
