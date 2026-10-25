import { describe, expect, it } from 'vitest';
import {
  addBackup,
  contentOf,
  loadBackups,
  MAX_BACKUPS,
  reasonFor,
  restoreState,
  saveBackups,
  withoutBackup,
  type Backup,
} from './backups';
import { advanceWinner, buildBracket } from './bracket';
import { initialState } from './storage';
import type { AppState, SeededTeam } from './types';

const teams: SeededTeam[] = Array.from({ length: 8 }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, timeMs: (i + 1) * 1000, seed: i + 1 }));
const withTeams = (names: string[]): AppState => ({
  ...initialState,
  event: { title: 'VTC', subtitle: '' },
  entrants: names.map((name, i) => ({ id: `e${i}`, name, min: '', sec: '10', ms: '' })),
});
const MIN = 60 * 1000;

describe('backups', () => {
  it('keeps nothing for an empty event, and nothing twice', () => {
    expect(addBackup([], contentOf(initialState), 'edit', 0)).toEqual([]);
    const once = addBackup([], contentOf(withTeams(['A'])), 'edit', 0);
    expect(addBackup(once, contentOf({ ...withTeams(['A']), view: 'bracket', pane: 'losers' }), 'edit', MIN)).toBe(once);
  });

  it('folds a burst of setup typing into one backup', () => {
    let list: Backup[] = [];
    list = addBackup(list, contentOf(withTeams(['A'])), 'edit', 0);
    list = addBackup(list, contentOf(withTeams(['A', 'B'])), 'edit', MIN);
    list = addBackup(list, contentOf(withTeams(['A', 'B', 'C'])), 'edit', 2 * MIN);
    expect(list).toHaveLength(1);
    expect(list[0].content.entrants).toHaveLength(3);
    // A pause of more than five minutes starts a new one.
    list = addBackup(list, contentOf(withTeams(['A', 'B', 'C', 'D'])), 'edit', 10 * MIN);
    expect(list).toHaveLength(2);
  });

  it('keeps every race result, and backups taken before replacing the event', () => {
    const bracket = buildBracket(teams, 'race');
    const base = { ...withTeams(['A']), bracket };
    let list = addBackup([], contentOf(base), 'bracket', 0);
    list = addBackup(list, contentOf({ ...base, bracket: advanceWinner(bracket, 'r0m0', 't1') }), 'result', 1000);
    list = addBackup(list, contentOf({ ...base, bracket: advanceWinner(bracket, 'r0m1', 't4') }), 'result', 2000);
    list = addBackup(list, contentOf(withTeams(['A', 'Z'])), 'before-reset', 3000);
    expect(list.map((b) => b.reason)).toEqual(['before-reset', 'result', 'result', 'bracket']);
  });

  it('keeps the newest twenty', () => {
    let list: Backup[] = [];
    for (let i = 0; i < 30; i++) list = addBackup(list, contentOf(withTeams([`Team ${i}`])), 'before-import', i * 10 * MIN);
    expect(list).toHaveLength(MAX_BACKUPS);
    expect(list[0].content.entrants[0].name).toBe('Team 29');
  });

  it('names automatic backups by what changed', () => {
    const bracket = buildBracket(teams, 'race');
    const latest: Backup = { at: 0, reason: 'bracket', content: contentOf({ ...withTeams(['A']), bracket }) };
    expect(reasonFor(latest, contentOf({ ...withTeams(['A', 'B']), bracket }))).toBe('edit');
    expect(reasonFor(latest, contentOf({ ...withTeams(['A']), bracket: advanceWinner(bracket, 'r0m0', 't1') }))).toBe('result');
    expect(reasonFor(latest, contentOf({ ...withTeams(['A']), bracket: buildBracket(teams.slice(0, 4), 'race') }))).toBe('bracket');
    // With nothing earlier to compare, it's simply the first.
    expect(reasonFor(undefined, contentOf({ ...withTeams(['A']), bracket }))).toBe('first');
  });

  it('restores the event but keeps the theme and the timer', () => {
    const backup = addBackup([], contentOf(withTeams(['A', 'B'])), 'edit', 0)[0];
    const current = { ...withTeams(['X']), theme: 'light' as const, view: 'podium' as const };
    const restored = restoreState(current, backup);
    expect(restored.entrants.map((e) => e.name)).toEqual(['A', 'B']);
    expect(restored.theme).toBe('light');
    expect(restored.timer).toEqual(current.timer);
  });

  it('drops the oldest backups when the browser’s storage is full', () => {
    let stored = '';
    const store = {
      getItem: () => stored,
      setItem: (_: string, value: string) => {
        if (value.length > 2000) throw new Error('QuotaExceededError');
        stored = value;
      },
    };
    let list: Backup[] = [];
    for (let i = 0; i < 10; i++) list = addBackup(list, contentOf(withTeams([`Team ${i}`])), 'before-import', i * 10 * MIN);
    const kept = saveBackups(list, store);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(10);
    expect(kept[0]).toEqual(list[0]);
    expect(loadBackups(store)).toEqual(kept);
  });

  it('deletes just the one backup, even when two share a timestamp', () => {
    let list: Backup[] = [];
    list = addBackup(list, contentOf(withTeams(['A'])), 'before-restore', 5000);
    list = addBackup(list, contentOf(withTeams(['B'])), 'restored', 5000);
    list = addBackup(list, contentOf(withTeams(['C'])), 'edit', 9000);
    const left = withoutBackup(list, list[1]);
    expect(left.map((b) => b.content.entrants[0].name)).toEqual(['C', 'A']);
  });

  it('reads nothing from missing or corrupt storage', () => {
    expect(loadBackups({ getItem: () => null, setItem: () => {} })).toEqual([]);
    expect(loadBackups({ getItem: () => '{oops', setItem: () => {} })).toEqual([]);
  });
});
