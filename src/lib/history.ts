import { allMatches, matchLabel } from './bracket';
import type { Bracket } from './types';

/** Results that can be undone and redone, oldest first. Kept for this session only. */
export interface History {
  past: Bracket[];
  future: Bracket[];
}

export const EMPTY_HISTORY: History = { past: [], future: [] };
const LIMIT = 100;

/** Records a new result: `before` can be returned to, and anything undone is gone. */
export function record(history: History, before: Bracket): History {
  return { past: [...history.past, before].slice(-LIMIT), future: [] };
}

/** Steps back to the previous result, or null if there's none. */
export function undo(history: History, current: Bracket): { history: History; bracket: Bracket } | null {
  const bracket = history.past[history.past.length - 1];
  if (!bracket) return null;
  return { history: { past: history.past.slice(0, -1), future: [...history.future, current] }, bracket };
}

/** Steps forward again after an undo, or null if there's nothing to redo. */
export function redo(history: History, current: Bracket): { history: History; bracket: Bracket } | null {
  const bracket = history.future[history.future.length - 1];
  if (!bracket) return null;
  return { history: { past: [...history.past, current], future: history.future.slice(0, -1) }, bracket };
}

/**
 * What changed from one bracket to the next, as the race clicked: "RoboTalRacer won Semifinal 1",
 * or "Cleared Semifinal 1" when a result was removed. Later races cleared as a knock-on effect
 * aren't mentioned; matches are checked in bracket order, so the clicked race comes first.
 */
export function describeResult(before: Bracket, after: Bracket): string | null {
  const previous = new Map(allMatches(before).map((m) => [m.id, m]));
  for (const match of allMatches(after)) {
    const was = previous.get(match.id);
    if (!was || was.picked?.winner === match.picked?.winner) continue;
    const label = matchLabel(after, match);
    if (match.picked) return `${after.teams[match.picked.winner]?.name ?? 'A team'} won ${label}`;
    return `Cleared ${label}`;
  }
  return null;
}
