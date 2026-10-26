import type { TimeParts } from './types';

// Accepts "83.45", "1:23.45" or "1:02:03.5" (hours:minutes:seconds).
const TIME_RE = /^(?:(?:(\d+):)?(\d+):)?(\d+(?:\.\d+)?)$/;
// The app's own mm:ss:ms ("01:23:450"), as in its exported spreadsheets: three digits after the
// last colon are milliseconds, where hours:minutes:seconds would have two.
const MS_RE = /^(\d+):(\d{1,2}):(\d{3})$/;

/** Parses a time-trial result into milliseconds, or null if it isn't a valid positive time. */
export function parseTime(input: string): number | null {
  const own = MS_RE.exec(input.trim());
  if (own) {
    const [, m, s, f] = own.map(Number);
    if (s >= 60) return null;
    const ms = (m * 60 + s) * 1000 + f;
    return ms > 0 ? ms : null;
  }
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

export type TimeCheck = { ms: number; error: null } | { ms: null; error: string | null };

/**
 * Validates minute, second and millisecond boxes. Blank boxes count as 0; all blank is
 * "no time yet" (error null), anything unusable gives an error message.
 */
export function checkTimeParts({ min, sec, ms }: TimeParts): TimeCheck {
  if (!min.trim() && !sec.trim() && !ms.trim()) return { ms: null, error: null };
  if (![min, sec, ms].every((part) => /^\d*$/.test(part.trim()))) return { ms: null, error: 'Digits only' };
  const [m, s, f] = [min, sec, ms].map((part) => Number(part.trim() || 0));
  if (s >= 60) return { ms: null, error: 'Seconds must be under 60' };
  if (f >= 1000) return { ms: null, error: 'Milliseconds must be under 1000' };
  const total = (m * 60 + s) * 1000 + f;
  return total > 0 ? { ms: total, error: null } : { ms: null, error: 'Time must be above 0' };
}

export const timeFromParts = (parts: TimeParts) => checkTimeParts(parts).ms;

/** Splits milliseconds into box values, folding hours into minutes: 83450 → 1 / 23 / 450. */
export function partsFromMs(total: number): TimeParts {
  return {
    min: String(Math.floor(total / 60_000)),
    sec: String(Math.floor((total % 60_000) / 1000)),
    ms: String(total % 1000).padStart(3, '0'),
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Formats milliseconds as MIN:SEC:MS (two-digit minutes), folding hours into minutes: 5000 → "00:05:000", 83456 → "01:23:456". */
export function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${pad2(minutes)}:${pad2(seconds)}:${String(ms % 1000).padStart(3, '0')}`;
}
