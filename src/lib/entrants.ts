import { timeFromParts } from './time';
import type { Entrant, SeededTeam } from './types';

export const MAX_TEAMS = 50;

export const EMPTY_TIME = { min: '', sec: '', ms: '' } as const;

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export const normalizeName = (name: string) => name.trim().toLowerCase();

export interface MergeResult {
  entrants: Entrant[];
  added: number;
  duplicates: number;
  overflow: number;
}

/** Appends uploaded names, dropping blank rows, duplicates and anything past MAX_TEAMS. */
export function mergeNames(existing: Entrant[], names: string[]): MergeResult {
  const entrants = existing.filter((e) => e.name.trim() || e.min.trim() || e.sec.trim() || e.ms.trim());
  const seen = new Set(entrants.map((e) => normalizeName(e.name)));
  let added = 0;
  let duplicates = 0;
  let overflow = 0;

  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    if (seen.has(normalizeName(name))) {
      duplicates++;
    } else if (entrants.length >= MAX_TEAMS) {
      overflow++;
    } else {
      entrants.push({ id: newId(), name, ...EMPTY_TIME });
      seen.add(normalizeName(name));
      added++;
    }
  }
  return { entrants, added, duplicates, overflow };
}

/** Ranks named teams with valid times, fastest first; ties keep entry order. */
export function seedTeams(entrants: Entrant[]): SeededTeam[] {
  return entrants
    .map((entrant, order) => ({ entrant, order, timeMs: timeFromParts(entrant) }))
    .filter((row): row is typeof row & { timeMs: number } => row.timeMs !== null && !!row.entrant.name.trim())
    .sort((x, y) => x.timeMs - y.timeMs || x.order - y.order)
    .map((row, i) => ({ id: row.entrant.id, name: row.entrant.name.trim(), timeMs: row.timeMs, seed: i + 1 }));
}

/**
 * The seed number to show for each team: tied times share the better one, and the next time
 * skips past them (12.00, 12.00, 23.00 → 1, 1, 3). Seeds themselves stay distinct, since the
 * bracket needs an order to place teams in.
 */
export function shownSeeds(teams: { id: string; timeMs: number }[]): Map<string, number> {
  const times = teams.map((t) => t.timeMs).sort((x, y) => x - y);
  return new Map(teams.map((t) => [t.id, times.indexOf(t.timeMs) + 1]));
}

/** Human-readable reasons the bracket can't be generated yet; empty when ready. */
export function validateEntrants(entrants: Entrant[]): string[] {
  const problems: string[] = [];
  if (entrants.length < 2) problems.push('Add at least 2 teams.');

  const unnamed = entrants.filter((e) => !e.name.trim()).length;
  if (unnamed) problems.push(`${unnamed} ${unnamed === 1 ? 'team is' : 'teams are'} missing a name.`);

  const counts = new Map<string, { name: string; count: number }>();
  for (const e of entrants) {
    const key = normalizeName(e.name);
    if (!key) continue;
    const entry = counts.get(key) ?? { name: e.name.trim(), count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  const dupes = [...counts.values()].filter((c) => c.count > 1).map((c) => c.name);
  if (dupes.length) problems.push(`Duplicate names: ${dupes.join(', ')}.`);

  const untimed = entrants.filter((e) => timeFromParts(e) === null).length;
  if (untimed) problems.push(`${untimed} ${untimed === 1 ? 'team needs' : 'teams need'} a valid time.`);

  if (entrants.length > MAX_TEAMS) problems.push(`Remove teams to get down to ${MAX_TEAMS}.`);
  return problems;
}
