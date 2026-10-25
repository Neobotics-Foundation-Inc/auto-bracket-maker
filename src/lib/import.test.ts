import { describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { isCleared, mergeRows, seedTeams, validateEntrants } from './entrants';
import { readCheck, readTime, rowsFromWorkbook, templateCsv } from './excel';
import type { Entrant } from './types';

const xlsx = (rows: unknown[][]) => {
  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.aoa_to_sheet(rows), 'Teams');
  return write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
};
const csvFile = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe('reading a spreadsheet', () => {
  it('reads every column of the template by its header', () => {
    const rows = rowsFromWorkbook(csvFile(templateCsv()));
    expect(rows).toEqual([
      { name: 'Example Racing', timeMs: 83450, checks: { checkedIn: true, inspected: true, obstacleTest: true } },
      { name: 'Second Team', timeMs: 58200, checks: { checkedIn: true, inspected: false, obstacleTest: false } },
    ]);
  });

  it('finds columns in any order and with other wording', () => {
    const rows = rowsFromWorkbook(xlsx([['Inspection', 'Best time', 'Team name'], ['yes', '1:02.5', 'Rockets']]));
    expect(rows).toEqual([{ name: 'Rockets', timeMs: 62500, checks: { inspected: true } }]);
  });

  it('reads Excel time cells, plain seconds and text times alike', () => {
    expect(readTime(83.45)).toBe(83450);
    expect(readTime(83.45 / 86400)).toBe(83450); // an mm:ss cell, stored as part of a day
    expect(readTime('1:23.45')).toBe(83450);
    expect(readTime('')).toBeUndefined();
    expect(readTime('fast')).toBeNull();
  });

  it('reads checks written many ways', () => {
    for (const yes of ['yes', 'Y', 'TRUE', 'x', '✓', 'Pass', 'done', '1']) expect(readCheck(yes)).toBe(true);
    for (const no of ['', 'no', 'n', 'false', '0', 'later']) expect(readCheck(no)).toBe(false);
  });

  it('still reads a plain list of names, and a time column beside it', () => {
    expect(rowsFromWorkbook(xlsx([['Rockets'], ['Comets']]))).toEqual([{ name: 'Rockets' }, { name: 'Comets' }]);
    expect(rowsFromWorkbook(xlsx([['Rockets', '1:10.5'], ['Comets', 72.25]]))).toEqual([
      { name: 'Rockets', timeMs: 70500 },
      { name: 'Comets', timeMs: 72250 },
    ]);
  });
});

const team = (name: string, sec = '', checks?: Entrant['checks']): Entrant => ({ id: name, name, min: '', sec, ms: '', checks });

describe('merging rows into the list', () => {
  it('adds new teams with their times and checks, and updates teams already listed', () => {
    const result = mergeRows([team('Rockets'), team('Comets', '40')], [
      { name: 'rockets', timeMs: 61200, checks: { checkedIn: true } },
      { name: 'Comets' },
      { name: 'Meteors', timeMs: 55000 },
      { name: 'Bad Time', timeMs: null },
    ]);
    expect(result).toMatchObject({ added: 2, updated: 1, duplicates: 1, badTimes: 1, overflow: 0 });
    const [rockets, comets, meteors, bad] = result.entrants;
    expect(rockets).toMatchObject({ min: '1', sec: '1', ms: '200', checks: { checkedIn: true, inspected: false, obstacleTest: false } });
    expect(comets.sec).toBe('40');
    expect(meteors).toMatchObject({ name: 'Meteors', min: '', sec: '55', ms: '000' });
    expect(bad).toMatchObject({ name: 'Bad Time', min: '', sec: '' });
  });
});

describe('eligibility checks', () => {
  const cleared = { checkedIn: true, inspected: true, obstacleTest: true };
  const teams = [team('A', '10', cleared), team('B', '11', { ...cleared, obstacleTest: false }), team('C', '12', cleared), team('D')];

  it('seeds only cleared teams when checks are on', () => {
    expect(seedTeams(teams, true).map((t) => [t.name, t.seed])).toEqual([
      ['A', 1],
      ['C', 2],
    ]);
    expect(seedTeams(teams).map((t) => t.name)).toEqual(['A', 'B', 'C']);
    expect(isCleared(teams[1])).toBe(false);
  });

  it('asks for times only from cleared teams, and for two of them', () => {
    expect(validateEntrants(teams, true)).toEqual([]);
    expect(validateEntrants(teams)).toEqual(['1 team needs a valid time.']);
    expect(validateEntrants([team('A', '10', cleared), team('B', '11')], true)).toEqual([
      'At least 2 teams must be checked in, inspected and through the obstacle test.',
    ]);
  });
});
