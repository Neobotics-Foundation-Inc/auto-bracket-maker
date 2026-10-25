import { progress } from './bracket';
import { migrateBranding, type Branding } from './branding';
import { migrateState } from './storage';
import { newTimer } from './timer';
import type { AppState, Bracket } from './types';

/**
 * An event saved as one file: teams, times, format, the bracket with every result, and the logo
 * and colors. Kept off the laptop, it survives a crash, a cleared browser or a change of machine.
 */
export interface EventFile {
  kind: typeof FILE_KIND;
  version: number;
  savedAt: string;
  state: AppState;
  branding: Branding;
}

export const FILE_KIND = 'auto-bracket-generator/event';
export const FILE_VERSION = 1;

export class EventFileError extends Error {}

export function toEventFile(state: AppState, branding: Branding, now = new Date()): EventFile {
  return { kind: FILE_KIND, version: FILE_VERSION, savedAt: now.toISOString(), state, branding };
}

/** "vtc-2026-2026-10-25-1432.bracket.json": the event's name and when it was saved. */
export function eventFileName(title: string, now = new Date()): string {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'event';
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${slug}-${stamp}.bracket.json`;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';

/** Enough of a bracket's shape that the views can draw it. */
function looksLikeBracket(b: unknown): b is Bracket {
  return (
    isObject(b) &&
    typeof b.size === 'number' &&
    isObject(b.teams) &&
    Array.isArray(b.rounds) &&
    b.rounds.every((round) => Array.isArray(round) && round.every((m) => isObject(m) && isString(m.id))) &&
    (b.losers === undefined || Array.isArray(b.losers))
  );
}

/**
 * Reads an event file, checking it thoroughly first: it may be from another version of the app,
 * edited by hand, or not an event file at all. A timer that was running when the file was saved
 * comes back stopped. Throws EventFileError with a message to show.
 */
export function parseEventFile(text: string): { state: AppState; branding: Branding } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new EventFileError('This file isn’t an event file: it couldn’t be read.');
  }
  if (!isObject(data) || data.kind !== FILE_KIND) throw new EventFileError('This file isn’t an event file from this app.');
  if (typeof data.version !== 'number' || data.version > FILE_VERSION) {
    throw new EventFileError('This event file is from a newer version of the app. Update the app to open it.');
  }

  const saved = data.state;
  const ok =
    isObject(saved) &&
    isObject(saved.event) &&
    isString(saved.event.title) &&
    Array.isArray(saved.entrants) &&
    saved.entrants.every((e) => isObject(e) && isString(e.id) && isString(e.name)) &&
    (saved.format === 'race' || saved.format === 'double' || saved.format === 'seed') &&
    (saved.bracket === null || looksLikeBracket(saved.bracket));
  if (!ok) throw new EventFileError('This event file is damaged: its teams or bracket are missing or malformed.');

  let state: AppState;
  try {
    state = migrateState(saved as Partial<AppState>);
  } catch {
    throw new EventFileError('This event file is damaged: its bracket couldn’t be rebuilt.');
  }
  return { state: { ...state, timer: newTimer(state.timer.durationMs) }, branding: migrateBranding(data.branding) };
}

/** "VTC2026 · 50 teams · 12 of 98 races decided", to say which event a file or backup holds. */
export function describeEvent(state: Pick<AppState, 'event' | 'entrants' | 'bracket'>): string {
  const parts = [state.event.title.trim() || 'Untitled event', `${state.entrants.length} ${state.entrants.length === 1 ? 'team' : 'teams'}`];
  if (state.bracket) {
    const { decided, total } = progress(state.bracket);
    parts.push(`${decided} of ${total} races decided`);
  } else {
    parts.push('no bracket yet');
  }
  return parts.join(' · ');
}
