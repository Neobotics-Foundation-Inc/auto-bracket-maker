import {
  BYE,
  type BestOf,
  type Bracket,
  type Match,
  type SeededTeam,
  type Section,
  type SlotValue,
  type Source,
  type ThirdPlaceFormat,
} from './types';

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
/** A match against a bye is decided automatically and isn't a race. */
export const isByeMatch = (m: Match) => m.a === BYE || m.b === BYE;

export function roundName(size: number, round: number): string {
  const teams = size >> round;
  if (teams === 2) return 'Final';
  if (teams === 4) return 'Semifinals';
  if (teams === 8) return 'Quarterfinals';
  return `Round of ${teams}`;
}

/** Column heading for a round in any section. */
export function sectionRoundName(bracket: Bracket, section: Section, round: number): string {
  if (section === 'third') return 'Third place';
  if (section === 'grand') return 'Grand final';
  if (section === 'losers') return round === bracket.losers.length - 1 ? 'Losers final' : `Losers round ${round + 1}`;
  if (bracket.format === 'double' && round === bracket.rounds.length - 1) return 'Winners final';
  return roundName(bracket.size, round);
}

const SINGULAR: Record<string, string> = { Semifinals: 'Semifinal', Quarterfinals: 'Quarterfinal' };

/** Short name for one match, e.g. "Quarterfinal 2" or "Losers round 3 · 1". */
export function matchLabel(bracket: Bracket, match: Match): string {
  const name = sectionRoundName(bracket, match.section, match.round);
  const count =
    match.section === 'main'
      ? bracket.rounds[match.round].length
      : match.section === 'losers'
        ? bracket.losers[match.round].length
        : 1;
  if (count === 1) return name;
  return SINGULAR[name] ? `${SINGULAR[name]} ${match.index + 1}` : `${name} · ${match.index + 1}`;
}

/** Every match, each one after the matches it draws its teams from. */
export function allMatches(bracket: Bracket): Match[] {
  const extra = [bracket.thirdPlace, ...bracket.losers.flat(), bracket.grandFinal].filter((m): m is Match => !!m);
  return [...bracket.rounds.flat(), ...extra];
}

export const findMatch = (bracket: Bracket, id: string) => allMatches(bracket).find((m) => m.id === id);

/** "main:2", "losers:0", "grand:0": a round in its section. */
export const roundKey = (section: Section, round: number) => `${section}:${round}`;
export const bestOfOf = (m: Match): BestOf => m.bestOf ?? 1;
/** A round's heats setting, as its header shows it. */
export const roundBestOf = (bracket: Bracket, section: Section, round: number): BestOf =>
  bracket.roundBestOf?.[roundKey(section, round)] ?? 1;
/** Heats a team must win to take the match: 1, or 2 of 3. */
const winsNeeded = (m: Match) => (bestOfOf(m) + 1) / 2;

/**
 * The score to show for each side, [a, b]: heats won in a best-of-3 match (0–0 once both teams are
 * known), or 1–0 once a single race is decided. Null while there's nothing to show.
 */
export function heatScore(m: Match): [number, number] | null {
  if (!isPlayable(m)) return null;
  if (bestOfOf(m) > 1) return m.heats ? [...m.heats.wins] : [0, 0];
  if (!isTeam(m.winner)) return null;
  return m.winner === m.a ? [1, 0] : [0, 1];
}

/** Which heat is next in a best-of-3 match still being raced, counting from 1. */
export const nextHeat = (m: Match) => (m.heats ? m.heats.wins[0] + m.heats.wins[1] : 0) + 1;

/** Every race that counts: no byes. */
export const races = (bracket: Bracket) => allMatches(bracket).filter((m) => !isByeMatch(m));

/** The race that decides 1st and 2nd: the final, or the grand final. */
export const deciderOf = (bracket: Bracket): Match => bracket.grandFinal ?? bracket.rounds[bracket.rounds.length - 1][0];

export function loserOf(m: Match): SlotValue {
  if (!m.winner) return null;
  if (m.winner === BYE) return BYE;
  return m.winner === m.a ? m.b : m.a;
}

function decide(m: Match): SlotValue {
  if (m.a === BYE && m.b === BYE) return BYE;
  if (m.a === BYE) return isTeam(m.b) ? m.b : null;
  if (m.b === BYE) return isTeam(m.a) ? m.a : null;
  return m.picked?.winner ?? null;
}

/**
 * Fills every slot from its source and settles each match. A result the user picked is
 * dropped as soon as either team in that match changes, so correcting an early race
 * clears every later result that depended on it.
 */
function resolve(bracket: Bracket) {
  const byId = new Map<string, Match>();
  for (const m of allMatches(bracket)) {
    m.sources.forEach((source, side) => {
      if (!source) return;
      const from = byId.get(source.match)!;
      m[side === 0 ? 'a' : 'b'] = source.take === 'winner' ? from.winner : loserOf(from);
    });
    if (m.picked && (m.picked.a !== m.a || m.picked.b !== m.b)) m.picked = null;
    if (m.heats && (m.heats.a !== m.a || m.heats.b !== m.b)) m.heats = null;
    if (bestOfOf(m) > 1) {
      // The first to win enough heats takes the match.
      const side = m.heats?.wins.findIndex((w) => w >= winsNeeded(m)) ?? -1;
      m.picked = m.heats && side >= 0 ? { winner: side === 0 ? m.heats.a : m.heats.b, a: m.heats.a, b: m.heats.b } : null;
    }
    m.winner = decide(m);
    byId.set(m.id, m);
  }
}

const newMatch = (
  id: string,
  section: Section,
  round: number,
  index: number,
  sources: Match['sources'] = [null, null],
): Match => ({ id, section, round, index, a: null, b: null, sources, winner: null, picked: null });

const winnerOf = (match: string): Source => ({ match, take: 'winner' });
const loserFrom = (match: string): Source => ({ match, take: 'loser' });

/**
 * Losers bracket for double elimination. With k winners rounds it has 2(k−1) rounds:
 * the first pairs off first-round losers, then rounds alternate between taking in the
 * losers dropping from the next winners round and halving the field. Dropping losers
 * are fed in reverse order so teams don't meet again straight away.
 */
function buildLosers(rounds: Match[][]): Match[][] {
  const losers: Match[][] = [];
  const add = (count: number, sources: (i: number) => Match['sources']) => {
    const round = losers.length;
    losers.push(Array.from({ length: count }, (_, i) => newMatch(`l${round}m${i}`, 'losers', round, i, sources(i))));
    return losers[round];
  };

  let prev = add(rounds[0].length / 2, (i) => [loserFrom(rounds[0][2 * i].id), loserFrom(rounds[0][2 * i + 1].id)]);
  for (let j = 1; j < rounds.length; j++) {
    const dropping = rounds[j];
    const feeders = prev;
    prev = add(dropping.length, (i) => [winnerOf(feeders[i].id), loserFrom(dropping[dropping.length - 1 - i].id)]);
    if (j < rounds.length - 1) {
      const pairs = prev;
      prev = add(pairs.length / 2, (i) => [winnerOf(pairs[2 * i].id), winnerOf(pairs[2 * i + 1].id)]);
    }
  }
  return losers;
}

/**
 * Builds a bracket from seeded teams, giving byes to the top seeds. Every round races `bestOf`
 * heats, except rounds set otherwise in `roundHeats`; the extra grand-final heat is always a single race.
 */
export function buildBracket(
  teams: SeededTeam[],
  format: ThirdPlaceFormat = 'race',
  bestOf: BestOf = 1,
  roundHeats: Record<string, BestOf> = {},
): Bracket {
  const size = nextPow2(Math.max(teams.length, 2));
  const idBySeed = new Map(teams.map((t) => [t.seed, t.id]));
  const order = seedOrder(size);

  const rounds: Match[][] = [];
  for (let round = 0; size >> (round + 1) >= 1; round++) {
    const count = size >> (round + 1);
    rounds.push(
      Array.from({ length: count }, (_, i) =>
        newMatch(
          `r${round}m${i}`,
          'main',
          round,
          i,
          round === 0 ? [null, null] : [winnerOf(`r${round - 1}m${2 * i}`), winnerOf(`r${round - 1}m${2 * i + 1}`)],
        ),
      ),
    );
  }
  for (const match of rounds[0]) {
    match.a = idBySeed.get(order[2 * match.index]) ?? BYE;
    match.b = idBySeed.get(order[2 * match.index + 1]) ?? BYE;
  }

  // Deciding third place needs semifinals, so at least 3 teams.
  const hasSemis = rounds.length >= 2;
  const semis = rounds[rounds.length - 2];
  const final = rounds[rounds.length - 1][0];
  const losers = format === 'double' && hasSemis ? buildLosers(rounds) : [];
  const bracket: Bracket = {
    size,
    format,
    teams: Object.fromEntries(teams.map((t) => [t.id, t])),
    rounds,
    losers,
    thirdPlace:
      format === 'race' && hasSemis ? newMatch('third', 'third', 0, 0, [loserFrom(semis[0].id), loserFrom(semis[1].id)]) : null,
    grandFinal: losers.length
      ? newMatch('grand', 'grand', 0, 0, [winnerOf(final.id), winnerOf(losers[losers.length - 1][0].id)])
      : null,
    roundBestOf: {},
  };
  for (const m of allMatches(bracket)) {
    const key = roundKey(m.section, m.round);
    m.bestOf = roundHeats[key] ?? bestOf;
    bracket.roundBestOf![key] = m.bestOf;
  }
  resolve(bracket);
  return bracket;
}

/**
 * The bracket as it was when it was generated: the same teams, seeds and format, with every
 * result cleared. Built from the bracket's own teams and heats settings, not the setup page's, so
 * edits made there since don't change it.
 */
export function resetBracket(bracket: Bracket): Bracket {
  return buildBracket(
    Object.values(bracket.teams).sort((x, y) => x.seed - y.seed),
    bracket.format,
    1,
    bracket.roundBestOf,
  );
}

/**
 * Records teamId as the winner of a match. Picking a different team corrects the
 * result; picking the current winner again clears it. Either way, later results that
 * involved the old winner or loser are cleared.
 */
export function advanceWinner(bracket: Bracket, matchId: string, teamId: string): Bracket {
  const current = findMatch(bracket, matchId);
  if (!current || !isPlayable(current) || (teamId !== current.a && teamId !== current.b)) return bracket;

  const next = structuredClone(bracket);
  const match = findMatch(next, matchId)!;
  match.picked = match.picked?.winner === teamId ? null : { winner: teamId, a: current.a!, b: current.b! };
  resolve(next);
  return next;
}

/**
 * A click on a team in a race. In a single race it records the winner, as advanceWinner does. In
 * a best-of-3 match it adds a heat won by that team, and the first to 2 takes the match; clicking
 * the winner of a decided match clears its score (and any later results that depended on it).
 */
export function recordHeat(bracket: Bracket, matchId: string, teamId: string): Bracket {
  const current = findMatch(bracket, matchId);
  if (!current || bestOfOf(current) === 1) return advanceWinner(bracket, matchId, teamId);
  if (!isPlayable(current) || (teamId !== current.a && teamId !== current.b)) return bracket;
  if (current.winner && current.winner !== teamId) return bracket;

  const next = structuredClone(bracket);
  const match = findMatch(next, matchId)!;
  if (match.winner) {
    match.heats = null;
  } else {
    const wins: [number, number] = match.heats ? [...match.heats.wins] : [0, 0];
    wins[teamId === match.a ? 0 : 1]++;
    match.heats = { a: match.a!, b: match.b!, wins };
  }
  resolve(next);
  return next;
}

/**
 * Sets how many heats the rounds whose matches pass `inRound` race. Matches already under way or
 * decided keep their format, so no result is lost; the setting applies to the rest.
 */
function setBestOf(bracket: Bracket, bestOf: BestOf, inRound: (m: Match) => boolean): Bracket {
  const next = structuredClone(bracket);
  next.roundBestOf = { ...next.roundBestOf };
  for (const m of allMatches(next)) {
    if (!inRound(m)) continue;
    next.roundBestOf[roundKey(m.section, m.round)] = bestOf;
    if (!m.picked && !m.heats) m.bestOf = bestOf;
  }
  resolve(next);
  return next;
}

/** Sets how many heats one round races (see setBestOf). */
export const setRoundBestOf = (bracket: Bracket, section: Section, round: number, bestOf: BestOf) =>
  setBestOf(bracket, bestOf, (m) => m.section === section && m.round === round);

/** Sets every round to the same heats (see setBestOf). */
export const setAllBestOf = (bracket: Bracket, bestOf: BestOf) => setBestOf(bracket, bestOf, () => true);

/** The heats every round races, or null when rounds differ. */
export function allRoundsBestOf(bracket: Bracket): BestOf | null {
  const settings = new Set(allMatches(bracket).map((m) => roundBestOf(bracket, m.section, m.round)));
  return settings.size === 1 ? [...settings][0] : null;
}

export interface Podium {
  first: string | null;
  second: string | null;
  /** Null until it's decided, and always null with only 2 teams. */
  third: string | null;
}

export function podium(bracket: Bracket): Podium {
  const team = (slot: SlotValue) => (isTeam(slot) ? slot : null);
  const final = deciderOf(bracket);
  let third: string | null = null;
  if (bracket.format === 'race') {
    third = team(bracket.thirdPlace?.winner ?? null);
  } else if (bracket.format === 'double') {
    const losersFinal = bracket.losers[bracket.losers.length - 1]?.[0];
    third = losersFinal ? team(loserOf(losersFinal)) : null;
  } else if (bracket.rounds.length >= 2) {
    // Time-trial tiebreak: once both semifinals are decided, the better seed of their losers.
    const semiLosers = bracket.rounds[bracket.rounds.length - 2].map(loserOf);
    if (semiLosers.every((slot) => slot !== null)) {
      const ranked = semiLosers.filter(isTeam).sort((x, y) => bracket.teams[x].seed - bracket.teams[y].seed);
      third = ranked[0] ?? null;
    }
  }
  return { first: team(final.winner), second: team(loserOf(final)), third };
}

/** Counts real races (not byes) and how many have a result. */
export function progress(bracket: Bracket): { decided: number; total: number } {
  const all = races(bracket);
  return { decided: all.filter((m) => m.winner).length, total: all.length };
}

/**
 * Brackets saved before formats existed have no sources or picks: rebuild them as a
 * third-place-race bracket and replay their results. Double-elimination brackets saved while
 * the grand final had an extra heat lose it: the grand final decides the title.
 */
export function migrateBracket(saved: Bracket): Bracket {
  if ('grandExtra' in saved) {
    const { grandExtra: _, ...bracket } = saved as Bracket & { grandExtra?: unknown };
    return migrateBracket(bracket);
  }
  if (saved.format) return saved;
  const old = saved as unknown as { teams: Bracket['teams']; rounds: Match[][]; thirdPlace?: Match | null };
  let bracket = buildBracket(
    Object.values(old.teams).sort((x, y) => x.seed - y.seed),
    'race',
  );
  for (const m of [...old.rounds.flat(), ...(old.thirdPlace ? [old.thirdPlace] : [])]) {
    if (isTeam(m.winner) && isTeam(m.a) && isTeam(m.b)) bracket = advanceWinner(bracket, m.id, m.winner);
  }
  return bracket;
}
