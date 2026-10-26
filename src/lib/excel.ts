import { read, utils } from 'xlsx';
import type { ImportRow } from './entrants';
import { parseTime } from './time';
import type { Checks } from './types';

const HEADER_RE = /^(teams?|team names?|names?)$/i;

/** Columns recognised by their header, in any order (case and spacing don't matter). */
const COLUMNS = {
  name: HEADER_RE,
  time: /^(time.?trial|time|result|best.?time|lap.?time|fastest.?lap)/i,
  checkedIn: /^check(ed)?.?in/i,
  inspected: /^inspect/i,
} as const;

/** The columns a template has, in the order they appear. */
export const TEMPLATE_HEADERS = ['Team', 'Time trial', 'Checked in', 'Inspected'];

/** A spreadsheet (CSV, which Excel opens) to fill in and upload: the headers and two examples. */
export function templateCsv(): string {
  return [TEMPLATE_HEADERS, ['Example Racing', '1:23.450', 'yes', 'yes'], ['Second Team', '58.2', 'yes', 'no']]
    .map((row) => row.join(','))
    .join('\r\n');
}

/**
 * A time cell: text like "1:23.450" or "83.45", a plain number of seconds, or an Excel time
 * (a fraction of a day, as cells formatted mm:ss hold). Undefined when blank, null when unreadable.
 */
export function readTime(cell: unknown): number | null | undefined {
  if (cell === '' || cell === null || cell === undefined) return undefined;
  if (typeof cell === 'number') {
    if (!(cell > 0)) return null;
    return Math.round(cell < 1 ? cell * 86_400_000 : cell * 1000);
  }
  return parseTime(String(cell));
}

/** A check cell: yes, y, true, x, ✓, pass, done or 1 count as passed; blank or anything else doesn't. */
export const readCheck = (cell: unknown): boolean =>
  /^(y|yes|true|x|✓|✔|pass|passed|ok|done|1)$/i.test(String(cell ?? '').trim());

/**
 * Reads teams from the first sheet. With a header row (Team, Time trial, Checked in, Inspected, as
 * in the template), each column is read by its header. Without one, names come
 * from the first non-empty column, as before, and a time from the column after it if it holds times.
 */
export function rowsFromWorkbook(data: ArrayBuffer): ImportRow[] {
  // raw: CSV cells stay text, so "1:23.450" isn't taken for a clock time; Excel's own time cells
  // still arrive as numbers.
  const workbook = read(data, { raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '', raw: true });
  const width = Math.max(0, ...rows.map((r) => r.length));

  const headerIndex = rows.findIndex((r) => r.some((c) => String(c).trim()));
  const header = (rows[headerIndex] ?? []).map((c) => String(c).trim());
  const find = (re: RegExp) => header.findIndex((h) => re.test(h));
  const nameCol = find(COLUMNS.name);

  if (nameCol >= 0) {
    const cols = {
      time: find(COLUMNS.time),
      checkedIn: find(COLUMNS.checkedIn),
      inspected: find(COLUMNS.inspected),
    };
    const checkKeys = (['checkedIn', 'inspected'] as const).filter((k) => cols[k] >= 0);
    return rows.slice(headerIndex + 1).flatMap((r) => {
      const name = String(r[nameCol] ?? '').trim();
      if (!name) return [];
      const row: ImportRow = { name };
      if (cols.time >= 0) {
        const time = readTime(r[cols.time]);
        if (time !== undefined) row.timeMs = time;
      }
      if (checkKeys.length) {
        row.checks = Object.fromEntries(checkKeys.map((k) => [k, readCheck(r[cols[k]])])) as Partial<Checks>;
      }
      return [row];
    });
  }

  for (let col = 0; col < width; col++) {
    const names = rows.map((r) => String(r[col] ?? '').trim());
    if (!names.some(Boolean)) continue;
    const start = HEADER_RE.test(names.find(Boolean)!) ? names.findIndex(Boolean) + 1 : 0;
    const times = rows.map((r) => readTime(r[col + 1]));
    const hasTimes = times.slice(start).some((t) => typeof t === 'number');
    return rows.slice(start).flatMap((_, i) => {
      const name = names[start + i];
      if (!name) return [];
      const time = times[start + i];
      return [hasTimes && time !== undefined ? { name, timeMs: time } : { name }];
    });
  }
  return [];
}

/** Team names only, from the first non-empty column (a header like "Team" skipped). */
export const namesFromWorkbook = (data: ArrayBuffer): string[] => rowsFromWorkbook(data).map((r) => r.name);

export async function readTeamRows(file: File): Promise<ImportRow[]> {
  return rowsFromWorkbook(await file.arrayBuffer());
}
