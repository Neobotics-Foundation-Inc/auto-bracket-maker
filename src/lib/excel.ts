import { read, utils } from 'xlsx';

const HEADER_RE = /^(teams?|team names?|names?)$/i;

/** Reads team names from the first non-empty column of the first sheet. */
export function namesFromWorkbook(data: ArrayBuffer): string[] {
  const workbook = read(data);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
  const width = Math.max(0, ...rows.map((r) => r.length));
  for (let col = 0; col < width; col++) {
    const cells = rows.map((r) => String(r[col] ?? '').trim()).filter(Boolean);
    if (cells.length === 0) continue;
    return HEADER_RE.test(cells[0]) ? cells.slice(1) : cells;
  }
  return [];
}

export async function readTeamNames(file: File): Promise<string[]> {
  return namesFromWorkbook(await file.arrayBuffer());
}
