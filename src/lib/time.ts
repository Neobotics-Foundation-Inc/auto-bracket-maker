// Accepts "83.45", "1:23.45" or "1:02:03.5" (hours:minutes:seconds).
const TIME_RE = /^(?:(?:(\d+):)?(\d+):)?(\d+(?:\.\d+)?)$/;

/** Parses a time-trial result into milliseconds, or null if it isn't a valid positive time. */
export function parseTime(input: string): number | null {
  const text = input.trim().replace(',', '.');
  const match = TIME_RE.exec(text);
  if (!match) return null;

  const [, h, m, s] = match;
  const hours = h ? Number(h) : 0;
  const minutes = m ? Number(m) : 0;
  const seconds = Number(s);
  if (m !== undefined && seconds >= 60) return null;
  if (h !== undefined && minutes >= 60) return null;

  const ms = Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
  return ms > 0 ? ms : null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Formats milliseconds with at least two decimals: 5000 → "5.00", 83456 → "1:23.456". */
export function formatTime(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  let fraction = String(ms % 1000).padStart(3, '0');
  if (fraction.endsWith('0')) fraction = fraction.slice(0, 2);

  if (hours) return `${hours}:${pad2(minutes)}:${pad2(seconds)}.${fraction}`;
  if (minutes) return `${minutes}:${pad2(seconds)}.${fraction}`;
  return `${seconds}.${fraction}`;
}
