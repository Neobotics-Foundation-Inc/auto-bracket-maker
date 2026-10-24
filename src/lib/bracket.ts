import { BYE, type Bracket, type Match, type SeededTeam, type SlotValue } from './types';

export function nextPow2(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/**
 * Standard bracket placement, so that seed 1 and 2 can only meet in the final:
 * [1,2] → [1,4,2,3] → [1,8,4,5,2,7,3,6] → …
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((seed) => [seed, n + 1 - seed]);
  }
  return order;
}

export const isTeam = (slot: SlotValue): slot is string => slot !== null && slot !== BYE;
export const isPlayable = (m: Match) => isTeam(m.a) && isTeam(m.b);
export const isByeMatch = (m: Match) => m.round === 0 && (m.a === BYE || m.b === BYE);

export function roundName(size: number, round: number): string {
  const teams = size >> round;
  if (teams === 2) return 'Final';
  if (teams === 4) return 'Semifinals';
  if (teams === 8) return 'Quarterfinals';
  return `Round of ${teams}`;
}

/** Puts the winner of match (round, index) into its slot in the next round. */
function place(bracket: Bracket, round: number, index: number, teamId: string) {
  const parent = bracket.rounds[round + 1]?.[index >> 1];
  if (parent) parent[index % 2 === 0 ? 'a' : 'b'] = teamId;
}

/** Removes the winner of match (round, index) from later rounds, clearing any results that depended on them. */
function vacate(bracket: Bracket, round: number, index: number) {
  const parent = bracket.rounds[round + 1]?.[index >> 1];
  if (!parent) return;
  parent[index % 2 === 0 ? 'a' : 'b'] = null;
  if (parent.winner) {
    parent.winner = null;
    vacate(bracket, round + 1, index >> 1);
  }
}

/** Builds a single-elimination bracket from seeded teams, giving byes to the top seeds. */
export function buildBracket(teams: SeededTeam[]): Bracket {
  const size = nextPow2(Math.max(teams.length, 2));
  const idBySeed = new Map(teams.map((t) => [t.seed, t.id]));
  const order = seedOrder(size);

  const rounds: Match[][] = [];
  for (let round = 0; size >> (round + 1) >= 1; round++) {
    const count = size >> (round + 1);
    rounds.push(
      Array.from({ length: count }, (_, index) => ({
        id: `r${round}m${index}`,
        round,
        index,
        a: null,
        b: null,
        winner: null,
      })),
    );
  }

  const bracket: Bracket = { size, teams: Object.fromEntries(teams.map((t) => [t.id, t])), rounds };
  for (const match of rounds[0]) {
    match.a = idBySeed.get(order[2 * match.index]) ?? BYE;
    match.b = idBySeed.get(order[2 * match.index + 1]) ?? BYE;
    const advancing = match.a === BYE ? match.b : match.b === BYE ? match.a : null;
    if (isTeam(advancing)) {
      match.winner = advancing;
      place(bracket, 0, match.index, advancing);
    }
  }
  return bracket;
}

/**
 * Records teamId as the winner of a match and moves them on. Picking a different
 * team corrects the result; picking the current winner again clears it. Either way,
 * later results that involved the old winner are cleared.
 */
export function advanceWinner(bracket: Bracket, round: number, index: number, teamId: string): Bracket {
  const current = bracket.rounds[round]?.[index];
  if (!current || !isPlayable(current) || (teamId !== current.a && teamId !== current.b)) return bracket;

  const next = structuredClone(bracket);
  const match = next.rounds[round][index];
  const previous = match.winner;
  if (previous) {
    match.winner = null;
    vacate(next, round, index);
  }
  if (previous !== teamId) {
    match.winner = teamId;
    place(next, round, index, teamId);
  }
  return next;
}

export function champion(bracket: Bracket): string | null {
  return bracket.rounds[bracket.rounds.length - 1][0].winner;
}

/** Counts real races (not byes) and how many have a result. */
export function progress(bracket: Bracket): { decided: number; total: number } {
  let decided = 0;
  let total = 0;
  for (const match of bracket.rounds.flat()) {
    if (isByeMatch(match)) continue;
    total++;
    if (match.winner) decided++;
  }
  return { decided, total };
}
