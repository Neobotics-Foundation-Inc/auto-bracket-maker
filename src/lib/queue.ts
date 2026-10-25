import { allMatches, isByeMatch, isPlayable, progress } from './bracket';
import type { Bracket, Match } from './types';

/**
 * The races ready to run (both teams known, no result yet), in running order: the bracket's own
 * order, which puts each race after the ones feeding it, except where the organizers moved
 * races, say when two teams swapped slots. `order` holds those moved ids; races not in it (ready
 * since) follow, in bracket order.
 */
export function raceQueue(bracket: Bracket, order: string[]): Match[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  const ready = allMatches(bracket).filter((m) => isPlayable(m) && !m.winner && !isByeMatch(m));
  return ready
    .map((match, i) => ({ match, key: rank.get(match.id) ?? order.length + i }))
    .sort((x, y) => x.key - y.key)
    .map((x) => x.match);
}

/** The new order after moving one race up (-1) or down (+1) the queue. */
export function moveInQueue(queue: Match[], id: string, delta: -1 | 1): string[] {
  const ids = queue.map((m) => m.id);
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}

/** Races still to run, including those waiting for their teams. */
export const racesLeft = (bracket: Bracket) => {
  const { decided, total } = progress(bracket);
  return total - decided;
};

/** When the race at this place in the queue should start (0 is on track now). */
export const startsAt = (place: number, slotMs: number, now: number) => now + place * slotMs;

/** When the last race should finish, at one slot per race left. */
export const finishesAt = (bracket: Bracket, slotMs: number, now: number) => now + racesLeft(bracket) * slotMs;

/** "2:45 PM" (or "14:45"), in the viewer's own clock format. */
export const clockTime = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
