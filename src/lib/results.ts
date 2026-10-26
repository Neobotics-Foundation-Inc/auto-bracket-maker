import { isPlayable, matchLabel, podium, races } from './bracket';
import { shownSeeds } from './entrants';
import { formatTime } from './time';
import type { Bracket, Match, SeededTeam, Section } from './types';

/**
 * One spreadsheet cell. Quoted when it holds a comma, quote or line break; a leading = + - or @
 * is escaped, so a team named like a formula can't run as one when the file is opened in Excel.
 * Plain numbers and times, such as a gap of "+2.00", are left as they are.
 */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^[+-]?[\d:.]+$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csv = (rows: (string | number)[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

/** The time-trial standings: seed (tied times share one), team, time and gap to the fastest. */
export function standingsCsv(teams: SeededTeam[]): string {
  const sorted = [...teams].sort((a, b) => a.seed - b.seed);
  const seeds = shownSeeds(sorted);
  const fastest = sorted[0]?.timeMs ?? 0;
  return csv([
    ['Seed', 'Team', 'Time trial', 'Gap'],
    ...sorted.map((t) => [seeds.get(t.id) ?? t.seed, t.name, formatTime(t.timeMs), t.timeMs === fastest ? '' : `+${formatTime(t.timeMs - fastest)}`]),
  ]);
}

const SECTIONS: Record<Section, string> = {
  main: 'Winners bracket',
  losers: 'Losers bracket',
  third: 'Third place',
  grand: 'Grand final',
};

export interface RaceRow {
  section: string;
  race: string;
  teamA: string;
  teamB: string;
  winner: string;
  status: 'Decided' | 'Ready' | 'Waiting';
}

/**
 * Every race except byes (and the extra grand-final heat unless it's raced), in bracket order:
 * who raced, who won, and where it stands.
 */
export function raceRows(bracket: Bracket): RaceRow[] {
  const seeds = shownSeeds(Object.values(bracket.teams));
  const team = (slot: Match['a']) => {
    const t = slot ? bracket.teams[slot] : undefined;
    return t ? `${seeds.get(t.id) ?? t.seed} ${t.name}` : 'TBD';
  };
  const single = !bracket.losers.length;
  return races(bracket)
    .map((m) => ({
      section: single && m.section === 'main' ? 'Bracket' : SECTIONS[m.section],
      race: matchLabel(bracket, m),
      teamA: team(m.a),
      teamB: team(m.b),
      winner: m.winner ? team(m.winner) : '',
      status: m.winner ? 'Decided' : isPlayable(m) ? 'Ready' : 'Waiting',
    }));
}

export function resultsCsv(bracket: Bracket): string {
  return csv([
    ['Section', 'Race', 'Team A', 'Team B', 'Winner', 'Status'],
    ...raceRows(bracket).map((r) => [r.section, r.race, r.teamA, r.teamB, r.winner, r.status]),
  ]);
}

/** 1st, 2nd and 3rd by name, where decided. */
export function placings(bracket: Bracket): { place: string; team: string | null }[] {
  const { first, second, third } = podium(bracket);
  const name = (id: string | null) => (id ? (bracket.teams[id]?.name ?? null) : null);
  const rows = [
    { place: '1st', team: name(first) },
    { place: '2nd', team: name(second) },
  ];
  // With 2 teams there are no semifinals, so no third place.
  if (bracket.rounds.length >= 2) rows.push({ place: '3rd', team: name(third) });
  return rows;
}

/** "vtc-2026-results.csv" from the event's name. */
export function resultsFileName(title: string, kind: 'results' | 'standings'): string {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'event';
  return `${slug}-${kind}.csv`;
}
