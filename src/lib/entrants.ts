import { partsFromMs, timeFromParts } from './time';
import type { Checks, Entrant, SeededTeam } from './types';

export const MAX_TEAMS = 50;

export const EMPTY_TIME = { min: '', sec: '', ms: '' } as const;

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export const normalizeName = (name: string) => name.trim().toLowerCase();

export const NO_CHECKS: Checks = { checkedIn: false, inspected: false, obstacleTest: false };

/** Checked in, inspected and through the obstacle test: allowed to race. */
export const isCleared = (e: Entrant) => !!(e.checks?.checkedIn && e.checks.inspected && e.checks.obstacleTest);

/** A row read from a spreadsheet: a name, and a time and checks where the sheet has them. */
export interface ImportRow {
  name: string;
  /** Milliseconds; null when the sheet has a time that couldn't be read. */
  timeMs?: number | null;
  checks?: Partial<Checks>;
}

export interface MergeResult {
  entrants: Entrant[];
  added: number;
  /** Teams already listed whose time or checks the sheet filled in. */
  updated: number;
  /** Teams already listed, with nothing new for them in the sheet. */
  duplicates: number;
  overflow: number;
  /** Times in the sheet that couldn't be read, left blank. */
  badTimes: number;
}

/**
 * Merges spreadsheet rows into the list. A team not yet listed is added (up to MAX_TEAMS); one
 * already listed (by name, ignoring case) gets the sheet's time and checks, so results entered
 * in a spreadsheet after the time trials can be brought in. Blank rows are dropped.
 */
export function mergeRows(existing: Entrant[], rows: ImportRow[]): MergeResult {
  const entrants = existing.filter((e) => e.name.trim() || e.min.trim() || e.sec.trim() || e.ms.trim());
  const byName = new Map(entrants.map((e, i) => [normalizeName(e.name), i]));
  const result = { added: 0, updated: 0, duplicates: 0, overflow: 0, badTimes: 0 };

  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    if (row.timeMs === null) result.badTimes++;
    // Under a minute, the minutes box stays blank, as when a time is typed in.
    const time = row.timeMs ? { ...partsFromMs(row.timeMs), ...(row.timeMs < 60_000 && { min: '' }) } : null;
    const index = byName.get(normalizeName(name));
    if (index !== undefined) {
      const current = entrants[index];
      if (!time && !row.checks) {
        result.duplicates++;
        continue;
      }
      entrants[index] = { ...current, ...time, ...(row.checks && { checks: { ...NO_CHECKS, ...current.checks, ...row.checks } }) };
      result.updated++;
    } else if (entrants.length >= MAX_TEAMS) {
      result.overflow++;
    } else {
      entrants.push({ id: newId(), name, ...(time ?? EMPTY_TIME), ...(row.checks && { checks: { ...NO_CHECKS, ...row.checks } }) });
      byName.set(normalizeName(name), entrants.length - 1);
      result.added++;
    }
  }
  return { entrants, ...result };
}

/** Appends uploaded names, dropping blank rows, duplicates and anything past MAX_TEAMS. */
export const mergeNames = (existing: Entrant[], names: string[]): MergeResult =>
  mergeRows(
    existing,
    names.map((name) => ({ name })),
  );

/**
 * Ranks named teams with valid times, fastest first; ties keep entry order. With eligibility
 * checks on, only cleared teams are seeded.
 */
export function seedTeams(entrants: Entrant[], requireChecks = false): SeededTeam[] {
  return entrants
    .map((entrant, order) => ({ entrant, order, timeMs: timeFromParts(entrant) }))
    .filter((row): row is typeof row & { timeMs: number } => row.timeMs !== null && !!row.entrant.name.trim())
    .filter((row) => !requireChecks || isCleared(row.entrant))
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

/**
 * Human-readable reasons the bracket can't be generated yet; empty when ready. With eligibility
 * checks on, only cleared teams need a time, and at least two must be cleared; the others simply
 * aren't seeded.
 */
export function validateEntrants(entrants: Entrant[], requireChecks = false): string[] {
  const problems: string[] = [];
  if (entrants.length < 2) problems.push('Add at least 2 teams.');
  else if (requireChecks && entrants.filter(isCleared).length < 2) {
    problems.push('At least 2 teams must be checked in, inspected and through the obstacle test.');
  }

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

  const untimed = entrants.filter((e) => (!requireChecks || isCleared(e)) && timeFromParts(e) === null).length;
  if (untimed) problems.push(`${untimed} ${untimed === 1 ? 'team needs' : 'teams need'} a valid time.`);

  if (entrants.length > MAX_TEAMS) problems.push(`Remove teams to get down to ${MAX_TEAMS}.`);
  return problems;
}
