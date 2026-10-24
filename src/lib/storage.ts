import { withThirdPlace } from './bracket';
import type { AppState } from './types';

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
      return { ...state, bracket: state.bracket && withThirdPlace(state.bracket) };
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
