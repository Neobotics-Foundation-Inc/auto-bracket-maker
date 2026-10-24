import { describe, expect, it } from 'vitest';
import {
  advanceWinner,
  allMatches,
  buildBracket,
  findMatch,
  isPlayable,
  matchLabel,
  migrateBracket,
  podium,
  progress,
  roundName,
  seedOrder,
} from './bracket';
import { seedTeams } from './entrants';
import { layoutBracket, layoutCombined, layoutGrandFinal, layoutLosers, showsBothBrackets } from './layout';
import { BYE, type Bracket, type SeededTeam } from './types';

const makeTeams = (n: number): SeededTeam[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, timeMs: (i + 1) * 1000, seed: i + 1 }));

const seedOf = (b: Bracket, slot: string | null) => (slot && slot !== BYE ? b.teams[slot].seed : slot);
const match = (b: Bracket, id: string) => findMatch(b, id)!;

/** Plays every race in order, the better seed always winning unless `upsets` names the winner. */
function playAll(b: Bracket, upsets: Record<string, string> = {}): Bracket {
  for (let guard = 0; guard < 500; guard++) {
    const next = allMatches(b).find((m) => isPlayable(m) && !m.winner);
    if (!next) return b;
    const better = b.teams[next.a!].seed < b.teams[next.b!].seed ? next.a! : next.b!;
    b = advanceWinner(b, next.id, upsets[next.id] ?? better);
  }
  throw new Error('bracket never finished');
}

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
    b = advanceWinner(b, 'r0m0', 't1');
    b = advanceWinner(b, 'r0m1', 't5');
    expect(b.rounds[1][0]).toMatchObject({ a: 't1', b: 't5', winner: null });
  });

  it('ignores teams that are not in the match and does not mutate the input', () => {
    const b = buildBracket(makeTeams(8));
    expect(advanceWinner(b, 'r0m0', 't2')).toBe(b);
    const next = advanceWinner(b, 'r0m0', 't1');
    expect(b.rounds[0][0].winner).toBeNull();
    expect(next.rounds[0][0].winner).toBe('t1');
  });

  it('changing an earlier result clears every later result that depended on it', () => {
    let b = buildBracket(makeTeams(8));
    for (const [i, team] of ['t1', 't4', 't2', 't3'].entries()) b = advanceWinner(b, `r0m${i}`, team);
    b = advanceWinner(b, 'r1m0', 't1');
    b = advanceWinner(b, 'r1m1', 't2');
    b = advanceWinner(b, 'r2m0', 't1');
    expect(podium(b).first).toBe('t1');

    b = advanceWinner(b, 'r0m0', 't8');
    expect(b.rounds[0][0].winner).toBe('t8');
    expect(b.rounds[1][0]).toMatchObject({ a: 't8', b: 't4', winner: null });
    expect(b.rounds[2][0]).toMatchObject({ a: null, b: 't2', winner: null });
    expect(podium(b).first).toBeNull();
  });

  it('clears a later result when the opponent changes, even if the winner is the same', () => {
    let b = buildBracket(makeTeams(8));
    for (const [i, team] of ['t1', 't4', 't2', 't3'].entries()) b = advanceWinner(b, `r0m${i}`, team);
    b = advanceWinner(b, 'r1m0', 't1');
    b = advanceWinner(b, 'r0m1', 't5');
    expect(b.rounds[1][0]).toMatchObject({ a: 't1', b: 't5', winner: null });
  });

  it('clicking the current winner again undoes the result', () => {
    let b = buildBracket(makeTeams(4));
    b = advanceWinner(b, 'r0m0', 't1');
    b = advanceWinner(b, 'r0m0', 't1');
    expect(b.rounds[0][0].winner).toBeNull();
    expect(b.rounds[1][0].a).toBeNull();
  });

  it('cannot change a bye', () => {
    const b = buildBracket(makeTeams(3));
    expect(advanceWinner(b, 'r0m0', 't1')).toBe(b);
  });
});

describe('third-place race', () => {
  const playToFinal = () => {
    let b = buildBracket(makeTeams(8), 'race');
    for (const [i, team] of ['t1', 't4', 't2', 't3'].entries()) b = advanceWinner(b, `r0m${i}`, team);
    b = advanceWinner(b, 'r1m0', 't1');
    b = advanceWinner(b, 'r1m1', 't2');
    return b;
  };

  it('puts the semifinal losers into the third-place race', () => {
    const b = playToFinal();
    expect(b.thirdPlace).toMatchObject({ a: 't4', b: 't3', winner: null });
    expect(podium(b)).toEqual({ first: null, second: null, third: null });
  });

  it('fills the podium from the final and the third-place race', () => {
    let b = playToFinal();
    b = advanceWinner(b, 'r2m0', 't2');
    b = advanceWinner(b, 'third', 't3');
    expect(podium(b)).toEqual({ first: 't2', second: 't1', third: 't3' });
    expect(progress(b)).toEqual({ decided: 8, total: 8 });
  });

  it('correcting a semifinal restarts the third-place race', () => {
    let b = playToFinal();
    b = advanceWinner(b, 'third', 't3');
    b = advanceWinner(b, 'r1m0', 't4');
    expect(b.thirdPlace).toMatchObject({ a: 't1', b: 't3', winner: null });
    b = advanceWinner(b, 'r0m1', 't5');
    expect(b.thirdPlace).toMatchObject({ a: null, b: 't3', winner: null });
  });

  it('gives third place to the only semifinal loser when there are 3 teams', () => {
    let b = buildBracket(makeTeams(3), 'race');
    expect(b.thirdPlace).toMatchObject({ a: BYE, b: null });
    b = advanceWinner(b, 'r0m1', 't3');
    expect(b.thirdPlace?.winner).toBe('t2');
    expect(progress(b).total).toBe(2);
  });

  it('has no third place with 2 teams, whatever the format', () => {
    for (const format of ['race', 'double', 'seed'] as const) {
      let b = buildBracket(makeTeams(2), format);
      expect(b.thirdPlace).toBeNull();
      expect(b.losers).toHaveLength(0);
      b = advanceWinner(b, 'r0m0', 't2');
      expect(podium(b)).toEqual({ first: 't2', second: 't1', third: null });
    }
  });
});

describe('time-trial tiebreak', () => {
  it('gives 3rd to the semifinal loser with the better seed, once both semifinals are done', () => {
    let b = buildBracket(makeTeams(8), 'seed');
    expect(b.thirdPlace).toBeNull();
    for (const [i, team] of ['t1', 't4', 't2', 't3'].entries()) b = advanceWinner(b, `r0m${i}`, team);
    b = advanceWinner(b, 'r1m0', 't4');
    expect(podium(b).third).toBeNull();
    b = advanceWinner(b, 'r1m1', 't3');
    // Semifinal losers are seeds 1 and 2; seed 1 was faster in the time trial.
    expect(podium(b).third).toBe('t1');
    expect(progress(b).total).toBe(7);
  });
});

describe('double elimination', () => {
  it('builds 2(k-1) losers rounds and a grand final', () => {
    const b = buildBracket(makeTeams(50), 'double');
    expect(b.losers.map((r) => r.length)).toEqual([16, 16, 8, 8, 4, 4, 2, 2, 1, 1]);
    expect(b.grandFinal).not.toBeNull();
    expect(b.thirdPlace).toBeNull();
    // 50 teams, each out after two losses except the champion: 2·49 races, give or take the grand final.
    expect(progress(b).total).toBe(2 * 49 - 1 + 1);
  });

  it('drops first-round losers into the losers bracket and later losers in reverse order', () => {
    let b = buildBracket(makeTeams(8), 'double');
    for (const [i, team] of ['t1', 't4', 't2', 't3'].entries()) b = advanceWinner(b, `r0m${i}`, team);
    expect(match(b, 'l0m0')).toMatchObject({ a: 't8', b: 't5' });
    expect(match(b, 'l0m1')).toMatchObject({ a: 't7', b: 't6' });
    b = advanceWinner(b, 'r1m0', 't1');
    b = advanceWinner(b, 'r1m1', 't2');
    // Semifinal 2's loser meets losers match 1's winner, and vice versa.
    expect(match(b, 'l1m0').b).toBe('t3');
    expect(match(b, 'l1m1').b).toBe('t4');
  });

  it('fills the podium from the grand final and the losers final', () => {
    const b = playAll(buildBracket(makeTeams(8), 'double'));
    // Seed 1 wins the winners bracket and the grand final against seed 2, who lost the winners final.
    expect(podium(b)).toEqual({ first: 't1', second: 't2', third: 't3' });
    expect(progress(b)).toEqual({ decided: 14, total: 14 });
  });

  it('lets a team that lost once still win the title', () => {
    const b = playAll(buildBracket(makeTeams(8), 'double'), { r2m0: 't2', grand: 't1' });
    expect(match(b, 'grand')).toMatchObject({ a: 't2', b: 't1', winner: 't1' });
    expect(podium(b).first).toBe('t1');
  });

  it('settles byes in the losers bracket without races', () => {
    const b = playAll(buildBracket(makeTeams(50), 'double'));
    expect(podium(b).first).toBe('t1');
    expect(progress(b).decided).toBe(progress(b).total);
    // Nobody is in the losers bracket twice.
    const losersTeams = b.losers[0].flatMap((m) => [m.a, m.b]).filter((s) => s && s !== BYE);
    expect(new Set(losersTeams).size).toBe(losersTeams.length);
  });

  it('works with 3 teams', () => {
    const b = playAll(buildBracket(makeTeams(3), 'double'));
    expect(podium(b)).toEqual({ first: 't1', second: 't2', third: 't3' });
  });

  it('labels where losers come from', () => {
    const b = buildBracket(makeTeams(8), 'double');
    expect(matchLabel(b, match(b, 'r1m1'))).toBe('Semifinal 2');
    expect(matchLabel(b, match(b, 'r2m0'))).toBe('Winners final');
    expect(matchLabel(b, match(b, 'l3m0'))).toBe('Losers final');
    expect(matchLabel(b, match(b, 'l0m1'))).toBe('Losers round 1 · 2');
  });
});

describe('seedTeams', () => {
  it('orders by time and keeps entry order on ties', () => {
    const seeded = seedTeams([
      { id: 'a', name: 'Slow', min: '1', sec: '10', ms: '0' },
      { id: 'b', name: 'Fast', min: '', sec: '58', ms: '200' },
      { id: 'c', name: 'Tie first', min: '1', sec: '', ms: '' },
      { id: 'd', name: 'Tie second', min: '1', sec: '0', ms: '000' },
      { id: 'e', name: 'No time', min: '', sec: '', ms: '' },
    ]);
    expect(seeded.map((t) => [t.name, t.seed])).toEqual([
      ['Fast', 1],
      ['Tie first', 2],
      ['Tie second', 3],
      ['Slow', 4],
    ]);
  });
});

describe('layout', () => {
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
        const b = buildBracket(makeTeams(teams), 'race');
        const layout = layoutBracket(b, { mirrored, firstRound: 0 });
        const final = layout.cards.find((c) => c.match.id === b.rounds[b.rounds.length - 1][0].id)!;
        const third = layout.cards.find((c) => c.match.id === 'third')!;
        expect(third.x).toBe(final.x);
        expect(third.y).toBeGreaterThan(final.y + 76);
        expect(third.y + 76).toBeLessThanOrEqual(layout.height);
      }
    }
  });

  it('keeps the grand final out of the winners and losers views, on a tab of its own', () => {
    const b = buildBracket(makeTeams(50), 'double');
    expect(layoutBracket(b, { mirrored: true, firstRound: 0 }).cards.some((c) => c.match.id === 'grand')).toBe(false);
    expect(layoutLosers(b).cards.some((c) => c.match.id === 'grand')).toBe(false);

    const layout = layoutGrandFinal(b);
    expect(layout.cards.map((c) => c.match.id)).toEqual(['r5m0', 'l9m0', 'grand']);
    expect(layout.headers.map((h) => h.label)).toEqual(['Winners final', 'Losers final', 'Grand final']);
    const [winnersFinal, losersFinal, grand] = layout.cards;
    // The grand final sits to the right, level with the gap between the two finals feeding it.
    expect(grand.x).toBeGreaterThan(winnersFinal.x + 232);
    expect(grand.y).toBeGreaterThan(winnersFinal.y);
    expect(grand.y).toBeLessThan(losersFinal.y);
    expect(layout.paths).toHaveLength(2);
  });

  it('shows both brackets together up to 16 teams', () => {
    expect(showsBothBrackets(buildBracket(makeTeams(16), 'double'))).toBe(true);
    expect(showsBothBrackets(buildBracket(makeTeams(17), 'double'))).toBe(false);
    expect(showsBothBrackets(buildBracket(makeTeams(8), 'race'))).toBe(false);

    for (const teams of [3, 8, 16]) {
      const b = buildBracket(makeTeams(teams), 'double');
      const layout = layoutCombined(b);
      // Every race once, with the grand final between the winners and losers brackets.
      expect(layout.cards).toHaveLength(allMatches(b).length);
      const winnersBottom = Math.max(...layout.cards.filter((c) => c.match.section === 'main').map((c) => c.y + 76));
      const losersTop = Math.min(...layout.cards.filter((c) => c.match.section === 'losers').map((c) => c.y));
      const grand = layout.cards.find((c) => c.match.section === 'grand')!;
      expect(grand.y).toBeGreaterThan(winnersBottom);
      expect(grand.y + 76).toBeLessThan(losersTop);
      for (const c of layout.cards) expect(c.x + 232).toBeLessThanOrEqual(layout.width);
      expect(layout.headers.filter((h) => h.section).map((h) => h.label)).toEqual(['Winners bracket', 'Losers bracket']);
    }
  });

  it('lays out the losers bracket without overlapping cards', () => {
    const b = buildBracket(makeTeams(50), 'double');
    const layout = layoutLosers(b);
    expect(layout.cards).toHaveLength(b.losers.flat().length);
    expect(layout.headers.map((h) => h.label).at(-1)).toBe('Losers final');
    const boxes = layout.cards.map((c) => `${c.x}:${Math.round(c.y)}`);
    expect(new Set(boxes).size).toBe(boxes.length);
  });
});

describe('migrateBracket', () => {
  it('rebuilds a bracket saved before formats and keeps its results', () => {
    const fresh = buildBracket(makeTeams(4), 'race');
    const old = {
      size: 4,
      teams: fresh.teams,
      rounds: [
        [
          { id: 'r0m0', round: 0, index: 0, a: 't1', b: 't4', winner: 't4' },
          { id: 'r0m1', round: 0, index: 1, a: 't2', b: 't3', winner: 't2' },
        ],
        [{ id: 'r1m0', round: 1, index: 0, a: 't4', b: 't2', winner: null }],
      ],
      thirdPlace: { id: 'third', round: -1, index: 0, a: 't1', b: 't3', winner: 't3' },
    } as unknown as Bracket;
    const b = migrateBracket(old);
    expect(b.format).toBe('race');
    expect(b.rounds[1][0]).toMatchObject({ a: 't4', b: 't2', winner: null });
    expect(podium(b).third).toBe('t3');
  });
});
