import { describe, expect, it } from 'vitest';
import { advanceWinner, buildBracket, recordHeat, setAllBestOf, setRoundBestOf } from './bracket';
import { describeResult, EMPTY_HISTORY, record, redo, undo } from './history';
import type { SeededTeam } from './types';

const teams: SeededTeam[] = Array.from({ length: 8 }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, timeMs: (i + 1) * 1000, seed: i + 1 }));

describe('undo and redo', () => {
  const b0 = buildBracket(teams, 'race');
  const b1 = advanceWinner(b0, 'r0m0', 't1');
  const b2 = advanceWinner(b1, 'r0m1', 't4');

  it('steps back through results and forward again', () => {
    let history = record(record(EMPTY_HISTORY, b0), b1);
    const back = undo(history, b2)!;
    expect(back.bracket).toBe(b1);
    history = back.history;
    const back2 = undo(history, back.bracket)!;
    expect(back2.bracket).toBe(b0);
    expect(undo(back2.history, back2.bracket)).toBeNull();
    const forward = redo(back2.history, back2.bracket)!;
    expect(forward.bracket).toBe(b1);
    expect(redo(redo(forward.history, forward.bracket)!.history, b2)).toBeNull();
  });

  it('forgets what was undone once a new result is entered', () => {
    const back = undo(record(EMPTY_HISTORY, b0), b1)!;
    const after = record(back.history, back.bracket);
    expect(after.future).toEqual([]);
  });

  it('says which result a step changes', () => {
    expect(describeResult(b0, b1)).toBe('Team 1 won Quarterfinal 1');
    expect(describeResult(b1, b2)).toBe('Team 4 won Quarterfinal 2');
    // Clicking the winner again clears the result.
    expect(describeResult(b1, advanceWinner(b1, 'r0m0', 't1'))).toBe('Cleared Quarterfinal 1');
    expect(describeResult(b1, b1)).toBeNull();
  });

  it('says which heat was won in a best of 3, and the score', () => {
    const h0 = buildBracket(teams, 'race', 3);
    const h1 = recordHeat(h0, 'r0m0', 't8');
    const h2 = recordHeat(h1, 'r0m0', 't1');
    const h3 = recordHeat(h2, 'r0m0', 't1');
    expect(describeResult(h0, h1)).toBe('Team 8 won heat 1 of Quarterfinal 1 (0–1)');
    expect(describeResult(h1, h2)).toBe('Team 1 won heat 2 of Quarterfinal 1 (1–1)');
    expect(describeResult(h2, h3)).toBe('Team 1 won Quarterfinal 1 (2–1)');
    expect(describeResult(h3, recordHeat(h3, 'r0m0', 't1'))).toBe('Cleared Quarterfinal 1');
  });

  it('says when a round’s heats change', () => {
    const bo3 = setRoundBestOf(b0, 'main', 1, 3);
    expect(describeResult(b0, bo3)).toBe('Semifinals set to best of 3');
    expect(describeResult(bo3, setRoundBestOf(bo3, 'main', 1, 1))).toBe('Semifinals set to a single heat');
    expect(describeResult(b0, setAllBestOf(b0, 3))).toBe('All rounds set to best of 3');
  });

  it('names the race clicked, not the later ones cleared by it', () => {
    const semis = advanceWinner(b2, 'r1m0', 't1');
    // Changing quarterfinal 1's winner also clears the semifinal Team 1 had won.
    expect(describeResult(semis, advanceWinner(semis, 'r0m0', 't8'))).toBe('Team 8 won Quarterfinal 1');
  });
});
