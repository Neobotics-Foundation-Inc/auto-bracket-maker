import { describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { mergeNames, validateEntrants } from './entrants';
import { namesFromWorkbook } from './excel';
import { checkTimeParts, formatTime, parseTime, partsFromMs, timeFromParts } from './time';

describe('parseTime', () => {
  it('accepts seconds, m:ss and h:mm:ss', () => {
    expect(parseTime('83.45')).toBe(83450);
    expect(parseTime('1:23.45')).toBe(83450);
    expect(parseTime(' 1:23,5 ')).toBe(83500);
    expect(parseTime('1:02:03.5')).toBe(3723500);
  });

  it('rejects invalid input', () => {
    for (const bad of ['', 'abc', '1:75', '0', '-3', '1.2.3']) expect(parseTime(bad)).toBeNull();
  });
});

describe('formatTime', () => {
  it('shows mm:ss:ms, with hours folded into minutes', () => {
    expect(formatTime(5000)).toBe('00:05:000');
    expect(formatTime(83450)).toBe('01:23:450');
    expect(formatTime(83456)).toBe('01:23:456');
    expect(formatTime(3723500)).toBe('62:03:500');
  });

  it('reads its own format back', () => {
    for (const ms of [5000, 83456, 3723500]) expect(parseTime(formatTime(ms))).toBe(ms);
    // Two digits after the last colon are still hours:minutes:seconds.
    expect(parseTime('1:02:03')).toBe(3723000);
    expect(parseTime('00:75:000')).toBeNull();
  });
});

const workbook = (rows: unknown[][]) => {
  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.aoa_to_sheet(rows), 'Teams');
  return write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
};

describe('namesFromWorkbook', () => {
  it('reads the first non-empty column and skips a header', () => {
    expect(namesFromWorkbook(workbook([['', 'Team Name'], ['', 'Rockets'], ['', ''], ['', 'Comets']]))).toEqual([
      'Rockets',
      'Comets',
    ]);
  });

  it('keeps the first row when it is a team name', () => {
    expect(namesFromWorkbook(workbook([['Rockets'], ['Comets']]))).toEqual(['Rockets', 'Comets']);
  });
});

describe('mergeNames', () => {
  it('drops duplicates and caps at 50 teams', () => {
    const names = Array.from({ length: 55 }, (_, i) => `Team ${i + 1}`);
    const result = mergeNames([{ id: 'x', name: 'team 1', min: '', sec: '', ms: '' }], names);
    expect(result.duplicates).toBe(1);
    expect(result.added).toBe(49);
    expect(result.overflow).toBe(5);
    expect(result.entrants).toHaveLength(50);
  });
});

describe('validateEntrants', () => {
  it('explains what is missing', () => {
    expect(
      validateEntrants([
        { id: '1', name: 'A', min: '', sec: '10', ms: '' },
        { id: '2', name: 'a ', min: '', sec: '75', ms: '' },
        { id: '3', name: '', min: '', sec: '11', ms: '' },
      ]),
    ).toEqual(['1 team is missing a name.', 'Duplicate names: A.', '1 team needs a valid time.']);
    expect(validateEntrants([{ id: '1', name: 'A', min: '', sec: '10', ms: '' }])).toEqual(['Add at least 2 teams.']);
  });
});

describe('checkTimeParts', () => {
  const parts = (min: string, sec: string, ms: string) => ({ min, sec, ms });

  it('combines minutes, seconds and milliseconds, with blanks as 0', () => {
    expect(checkTimeParts(parts('1', '23', '450'))).toEqual({ ms: 83450, error: null });
    expect(checkTimeParts(parts('', '58', '2'))).toEqual({ ms: 58002, error: null });
    expect(checkTimeParts(parts('2', '', ''))).toEqual({ ms: 120000, error: null });
  });

  it('treats all-blank as no time yet and explains bad input', () => {
    expect(checkTimeParts(parts('', '', ''))).toEqual({ ms: null, error: null });
    expect(checkTimeParts(parts('1', '60', '0')).error).toBe('Seconds must be under 60');
    expect(checkTimeParts(parts('0', '0', '0')).error).toBe('Time must be above 0');
    expect(checkTimeParts(parts('1', '2.5', '')).error).toBe('Digits only');
  });

  it('round-trips through partsFromMs, folding hours into minutes', () => {
    expect(partsFromMs(83450)).toEqual(parts('1', '23', '450'));
    expect(partsFromMs(3723500)).toEqual(parts('62', '3', '500'));
    expect(timeFromParts(partsFromMs(3723500))).toBe(3723500);
  });
});
