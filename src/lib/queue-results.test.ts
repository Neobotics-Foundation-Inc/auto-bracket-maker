import { describe, expect, it } from 'vitest';
import { advanceWinner, buildBracket } from './bracket';
import { finishesAt, moveInQueue, raceQueue, racesLeft, startsAt } from './queue';
import { csvCell, placings, raceRows, resultsCsv, resultsFileName, standingsCsv } from './results';
import type { SeededTeam } from './types';

const teams = (n: number): SeededTeam[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, timeMs: (i + 1) * 1000, seed: i + 1 }));
const MIN = 60_000;

describe('race queue', () => {
  const b = buildBracket(teams(8), 'race');

  it('lists the races ready to run, in bracket order, leaving out waiting ones', () => {
    expect(raceQueue(b, []).map((m) => m.id)).toEqual(['r0m0', 'r0m1', 'r0m2', 'r0m3']);
    const after = advanceWinner(advanceWinner(b, 'r0m0', 't1'), 'r0m1', 't4');
    // The semifinal is ready once both quarterfinals feeding it are decided.
    expect(raceQueue(after, []).map((m) => m.id)).toEqual(['r0m2', 'r0m3', 'r1m0']);
  });

  it('leaves out byes', () => {
    // 6 teams in 8 slots: seeds 1 and 2 have byes, in the first and third races.
    expect(raceQueue(buildBracket(teams(6), 'race'), []).map((m) => m.id)).toEqual(['r0m1', 'r0m3']);
  });

  it('keeps races where the organizers moved them, with newly ready ones after', () => {
    const order = moveInQueue(raceQueue(b, []), 'r0m2', -1);
    expect(order).toEqual(['r0m0', 'r0m2', 'r0m1', 'r0m3']);
    expect(raceQueue(b, order).map((m) => m.id)).toEqual(order);
    const later = advanceWinner(advanceWinner(b, 'r0m0', 't1'), 'r0m1', 't4');
    expect(raceQueue(later, order).map((m) => m.id)).toEqual(['r0m2', 'r0m3', 'r1m0']);
    // Moving past either end changes nothing.
    expect(moveInQueue(raceQueue(b, []), 'r0m0', -1)).toEqual(['r0m0', 'r0m1', 'r0m2', 'r0m3']);
  });

  it('estimates start and finish times at one slot per race', () => {
    expect(racesLeft(b)).toBe(8); // 4 quarterfinals, 2 semifinals, the final and the third-place race
    expect(startsAt(2, 6 * MIN, 0)).toBe(12 * MIN);
    expect(finishesAt(b, 6 * MIN, 0)).toBe(48 * MIN);
  });
});

describe('results', () => {
  const b = advanceWinner(buildBracket(teams(4), 'race'), 'r0m0', 't1');

  it('escapes cells so commas, quotes and formulas stay text', () => {
    expect(csvCell('Rockets')).toBe('Rockets');
    expect(csvCell('Smith, Jones & Co')).toBe('"Smith, Jones & Co"');
    expect(csvCell('The "Fast" Ones')).toBe('"The ""Fast"" Ones"');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1 Racing')).toBe("'+1 Racing");
    expect(csvCell('+2.00')).toBe('+2.00');
    expect(csvCell('-1:05.5')).toBe('-1:05.5');
  });

  it('writes the standings with shared seeds for tied times and the gap to the fastest', () => {
    const tied = [...teams(3)];
    tied[1] = { ...tied[1], timeMs: 1000 };
    expect(standingsCsv(tied).split('\r\n')).toEqual(['Seed,Team,Time trial,Gap', '1,Team 1,1.00,', '1,Team 2,1.00,', '3,Team 3,3.00,+2.00']);
  });

  it('lists every race with its teams, winner and status', () => {
    expect(raceRows(b).map((r) => [r.race, r.teamA, r.teamB, r.winner, r.status])).toEqual([
      ['Semifinal 1', '1 Team 1', '4 Team 4', '1 Team 1', 'Decided'],
      ['Semifinal 2', '2 Team 2', '3 Team 3', '', 'Ready'],
      ['Final', '1 Team 1', 'TBD', '', 'Waiting'],
      ['Third place', '4 Team 4', 'TBD', '', 'Waiting'],
    ]);
    expect(resultsCsv(b).split('\r\n')[0]).toBe('Section,Race,Team A,Team B,Winner,Status');
  });

  it('gives the placings, with third only when there are semifinals', () => {
    expect(placings(b)).toEqual([
      { place: '1st', team: null },
      { place: '2nd', team: null },
      { place: '3rd', team: null },
    ]);
    expect(placings(buildBracket(teams(2), 'race'))).toHaveLength(2);
  });

  it('names the files after the event', () => {
    expect(resultsFileName('VTC 2026', 'results')).toBe('vtc-2026-results.csv');
    expect(resultsFileName('', 'standings')).toBe('event-standings.csv');
  });
});
