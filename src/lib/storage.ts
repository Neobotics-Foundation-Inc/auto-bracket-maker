import { withThirdPlace } from './bracket';
import { partsFromMs, parseTime } from './time';
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
  bracket: null,
  view: 'setup',
  theme: 'dark',
  firstRound: 0,
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const state: AppState = { ...initialState, ...(JSON.parse(raw) as Partial<AppState>) };
      return {
        ...state,
        entrants: state.entrants.map(migrateEntrant),
        bracket: state.bracket && withThirdPlace(state.bracket),
      };
    }
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
