import { allMatches, matchLabel, sectionRoundName } from './bracket';
import type { Bracket, Section } from './types';

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

const scoreOf = (wins: [number, number] | undefined) => (wins ? ` (${wins[0]}–${wins[1]})` : '');

/**
 * What changed from one bracket to the next, as the race clicked: "RoboTalRacer won Semifinal 1",
 * "RoboTalRacer won heat 2 of Semifinal 1 (1–1)", "Cleared Semifinal 1" when a result was removed,
 * or "Semifinals set to best of 3". Later races cleared as a knock-on effect aren't mentioned;
 * matches are checked in bracket order, so the clicked race comes first.
 */
export function describeResult(before: Bracket, after: Bracket): string | null {
  const changed = Object.entries(after.roundBestOf ?? {}).filter(([key, bestOf]) => (before.roundBestOf?.[key] ?? 1) !== bestOf);
  if (changed.length) {
    const [key, bestOf] = changed[0];
    const [section, round] = key.split(':');
    const name = changed.length > 1 ? 'All rounds' : sectionRoundName(after, section as Section, Number(round));
    return `${name} set to ${bestOf === 1 ? 'a single heat' : `best of ${bestOf}`}`;
  }
  const previous = new Map(allMatches(before).map((m) => [m.id, m]));
  for (const match of allMatches(after)) {
    const was = previous.get(match.id);
    if (!was) continue;
    const label = matchLabel(after, match);
    const wins = match.heats?.wins;
    if (was.picked?.winner === match.picked?.winner) {
      // A heat won in a best-of-3 match that's still going.
      if (!wins || JSON.stringify(wins) === JSON.stringify(was.heats?.wins)) continue;
      const side = wins[0] > (was.heats?.wins[0] ?? 0) ? 0 : 1;
      const team = after.teams[side === 0 ? match.heats!.a : match.heats!.b]?.name ?? 'A team';
      return `${team} won heat ${wins[0] + wins[1]} of ${label}${scoreOf(wins)}`;
    }
    if (match.picked) return `${after.teams[match.picked.winner]?.name ?? 'A team'} won ${label}${scoreOf(wins)}`;
    return `Cleared ${label}`;
  }
  return null;
}
