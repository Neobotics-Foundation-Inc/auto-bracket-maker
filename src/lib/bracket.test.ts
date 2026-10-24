import { describe, expect, it } from 'vitest';
import { advanceWinner, buildBracket, champion, podium, progress, roundName, seedOrder, withThirdPlace } from './bracket';
import { seedTeams } from './entrants';
import { layoutBracket } from './layout';
import { BYE, THIRD_PLACE_ROUND, type Bracket, type SeededTeam } from './types';

const makeTeams = (n: number): SeededTeam[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, timeMs: (i + 1) * 1000, seed: i + 1 }));

const seedOf = (b: Bracket, slot: string | null) => (slot && slot !== BYE ? b.teams[slot].seed : slot);

describe('seedOrder', () => {
  it('places seeds so the top two can only meet in the final', () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('pairs seeds that add up to size + 1 in the first round', () => {
    const order = seedOrder(64);
    for (let i = 0; i < 64; i += 2) expect(order[i] + order[i + 1]).toBe(65);
  });
});

describe('roundName', () => {
  it('names the late rounds', () => {
    expect(roundName(64, 0)).toBe('Round of 64');
    expect(roundName(64, 3)).toBe('Quarterfinals');
    expect(roundName(64, 4)).toBe('Semifinals');
    expect(roundName(64, 5)).toBe('Final');
  });
});

describe('buildBracket', () => {
  it('pads 50 teams to 64 slots with 14 byes for the top seeds', () => {
    const b = buildBracket(makeTeams(50));
    expect(b.size).toBe(64);
    expect(b.rounds.map((r) => r.length)).toEqual([32, 16, 8, 4, 2, 1]);

    const byes = b.rounds[0].flatMap((m) => [m.a, m.b]).filter((s) => s === BYE);
    expect(byes).toHaveLength(14);

    const roundTwo = b.rounds[1].flatMap((m) => [m.a, m.b]).filter((s) => s !== null).map((s) => seedOf(b, s));
    expect(roundTwo.sort((x, y) => Number(x) - Number(y))).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
  });

  it('builds an exact bracket with no byes for a power of 2', () => {
    const b = buildBracket(makeTeams(8));
    expect(b.size).toBe(8);
    expect(b.rounds[0].map((m) => [seedOf(b, m.a), seedOf(b, m.b)])).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
    // 7 elimination races plus the third-place race.
    expect(progress(b)).toEqual({ decided: 0, total: 8 });
  });

  it('handles the two-team minimum as a single final', () => {
    const b = buildBracket(makeTeams(2));
    expect(b.rounds).toHaveLength(1);
    expect([b.rounds[0][0].a, b.rounds[0][0].b]).toEqual(['t1', 't2']);
  });
});

describe('advanceWinner', () => {
  it('moves the winner into the right slot of the next round', () => {
    let b = buildBracket(makeTeams(8));
    b = advanceWinner(b, 0, 0, 't1');
    b = advanceWinner(b, 0, 1, 't5');
    expect(b.rounds[1][0]).toMatchObject({ a: 't1', b: 't5', winner: null });
  });

  it('ignores teams that are not in the match and does not mutate the input', () => {
    const b = buildBracket(makeTeams(8));
    expect(advanceWinner(b, 0, 0, 't2')).toBe(b);
    const next = advanceWinner(b, 0, 0, 't1');
    expect(b.rounds[0][0].winner).toBeNull();
    expect(next.rounds[0][0].winner).toBe('t1');
  });

  it('changing an earlier result clears every later result that depended on it', () => {
    let b = buildBracket(makeTeams(8));
    for (const [i, team] of ['t1', 't4', 't2', 't3'].entries()) b = advanceWinner(b, 0, i, team);
    b = advanceWinner(b, 1, 0, 't1');
    b = advanceWinner(b, 1, 1, 't2');
    b = advanceWinner(b, 2, 0, 't1');
    expect(champion(b)).toBe('t1');

    b = advanceWinner(b, 0, 0, 't8');
    expect(b.rounds[0][0].winner).toBe('t8');
    expect(b.rounds[1][0]).toMatchObject({ a: 't8', b: 't4', winner: null });
    expect(b.rounds[2][0]).toMatchObject({ a: null, b: 't2', winner: null });
    expect(champion(b)).toBeNull();
  });

  it('clicking the current winner again undoes the result', () => {
    let b = buildBracket(makeTeams(4));
    b = advanceWinner(b, 0, 0, 't1');
    b = advanceWinner(b, 0, 0, 't1');
    expect(b.rounds[0][0].winner).toBeNull();
    expect(b.rounds[1][0].a).toBeNull();
  });

  it('cannot change a bye', () => {
    const b = buildBracket(makeTeams(3));
    expect(advanceWinner(b, 0, 0, 't1')).toBe(b);
  });
});

describe('seedTeams', () => {
  it('orders by time and keeps entry order on ties', () => {
    const seeded = seedTeams([
      { id: 'a', name: 'Slow', timeText: '1:10.00' },
      { id: 'b', name: 'Fast', timeText: '58.2' },
      { id: 'c', name: 'Tie first', timeText: '1:00' },
      { id: 'd', name: 'Tie second', timeText: '60' },
      { id: 'e', name: 'No time', timeText: '' },
    ]);
    expect(seeded.map((t) => [t.name, t.seed])).toEqual([
      ['Fast', 1],
      ['Tie first', 2],
      ['Tie second', 3],
      ['Slow', 4],
    ]);
  });
});

describe('layoutBracket', () => {
  it('mirrors 64 slots into two 16-match halves facing the final', () => {
    const b = buildBracket(makeTeams(50));
    const layout = layoutBracket(b, { mirrored: true, firstRound: 0 });
    // 63 races plus the third-place race, each half's rounds plus the final and third place.
    expect(layout.cards).toHaveLength(64);
    expect(layout.headers).toHaveLength(12);
    const linear = layoutBracket(b, { mirrored: false, firstRound: 0 });
    expect(layout.height).toBeLessThan(linear.height * 0.6);
  });

  it('can hide early rounds', () => {
    const b = buildBracket(makeTeams(50));
    const layout = layoutBracket(b, { mirrored: true, firstRound: 3 });
    expect(layout.cards).toHaveLength(8);
  });

  it('puts the third-place race under the final without overlapping it', () => {
    for (const teams of [3, 4, 8, 50]) {
      for (const mirrored of [false, true]) {
        const b = buildBracket(makeTeams(teams));
        const layout = layoutBracket(b, { mirrored, firstRound: 0 });
        const final = layout.cards.find((c) => c.match.id === b.rounds[b.rounds.length - 1][0].id)!;
        const third = layout.cards.find((c) => c.match.id === 'third')!;
        expect(third.x).toBe(final.x);
        expect(third.y).toBeGreaterThan(final.y + 76);
        expect(third.y + 76).toBeLessThanOrEqual(layout.height);
      }
    }
  });
});

describe('third-place race and podium', () => {
  const playToFinal = () => {
    let b = buildBracket(makeTeams(8));
    for (const [i, team] of ['t1', 't4', 't2', 't3'].entries()) b = advanceWinner(b, 0, i, team);
    b = advanceWinner(b, 1, 0, 't1');
    b = advanceWinner(b, 1, 1, 't2');
    return b;
  };

  it('puts the semifinal losers into the third-place race', () => {
    const b = playToFinal();
    expect(b.thirdPlace).toMatchObject({ a: 't4', b: 't3', winner: null });
    expect(podium(b)).toEqual({ first: null, second: null, third: null });
  });

  it('fills the podium from the final and the third-place race', () => {
    let b = playToFinal();
    b = advanceWinner(b, 2, 0, 't2');
    b = advanceWinner(b, THIRD_PLACE_ROUND, 0, 't3');
    expect(podium(b)).toEqual({ first: 't2', second: 't1', third: 't3' });
    expect(progress(b)).toEqual({ decided: 8, total: 8 });
  });

  it('correcting a semifinal restarts the third-place race', () => {
    let b = playToFinal();
    b = advanceWinner(b, THIRD_PLACE_ROUND, 0, 't3');
    b = advanceWinner(b, 1, 0, 't4');
    expect(b.thirdPlace).toMatchObject({ a: 't1', b: 't3', winner: null });
    b = advanceWinner(b, 0, 1, 't5');
    expect(b.thirdPlace).toMatchObject({ a: null, b: 't3', winner: null });
  });

  it('gives third place to the only semifinal loser when there are 3 teams', () => {
    let b = buildBracket(makeTeams(3));
    expect(b.thirdPlace).toMatchObject({ a: BYE, b: null });
    b = advanceWinner(b, 0, 1, 't3');
    expect(b.thirdPlace?.winner).toBe('t2');
    expect(progress(b).total).toBe(2);
  });

  it('has no third-place race with 2 teams', () => {
    let b = buildBracket(makeTeams(2));
    expect(b.thirdPlace).toBeNull();
    b = advanceWinner(b, 0, 0, 't2');
    expect(podium(b)).toEqual({ first: 't2', second: 't1', third: null });
  });

  it('adds the race to brackets saved before it existed', () => {
    const { thirdPlace: _, ...old } = playToFinal();
    expect(withThirdPlace(old as Bracket).thirdPlace).toMatchObject({ a: 't4', b: 't3', winner: null });
  });
});
