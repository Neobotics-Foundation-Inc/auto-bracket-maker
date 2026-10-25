import { migrateState } from './storage';
import type { AppState } from './types';

/** What a backup keeps: the event itself, not how it was being viewed (theme, tab, timer). */
export type EventContent = Pick<AppState, 'event' | 'entrants' | 'format' | 'bracket' | 'pane' | 'firstRound' | 'losersFirstRound'>;

/**
 * A copy of the event taken automatically as it changes, or just before something that replaces
 * it (a new bracket, Reset all, an import, a restore). Kept in this browser only.
 */
export interface Backup {
  at: number;
  /** Why it was taken: an edit, or the action about to replace the event. */
  reason: BackupReason;
  content: EventContent;
}

export type BackupReason =
  | 'first'
  | 'edit'
  | 'bracket'
  | 'result'
  | 'before-regenerate'
  | 'before-reset-bracket'
  | 'before-reset'
  | 'before-import'
  | 'before-restore'
  | 'imported'
  | 'restored'
  | 'bracket-reset';

export const BACKUP_LABELS: Record<BackupReason, string> = {
  first: 'First backup',
  edit: 'Setup changed',
  bracket: 'Bracket generated',
  result: 'Race result',
  'before-regenerate': 'Before a new bracket',
  'before-reset-bracket': 'Before Reset bracket',
  'before-reset': 'Before Reset all',
  'before-import': 'Before an import',
  'before-restore': 'Before a restore',
  imported: 'Imported',
  restored: 'Restored',
  'bracket-reset': 'Bracket reset',
};

export const MAX_BACKUPS = 20;
/** Setup edits this close together (typing names and times) share one backup. */
const COALESCE_MS = 5 * 60 * 1000;
const KEY = 'auto-bracket-maker:backups';

export function contentOf(state: AppState): EventContent {
  const { event, entrants, format, bracket, pane, firstRound, losersFirstRound } = state;
  return { event, entrants, format, bracket, pane, firstRound, losersFirstRound };
}

/** Whether the event itself differs; which tab or round was showing doesn't count. */
const eventKey = (c: EventContent) => JSON.stringify([c.event, c.entrants, c.format, c.bracket]);
const isEmpty = (c: EventContent) => !c.entrants.length && !c.bracket && !c.event.title.trim() && !c.event.subtitle.trim();

/**
 * Adds a backup of `content` to the list (newest first), at most MAX_BACKUPS. Nothing is added
 * when the event is empty or unchanged since the last backup. A setup edit soon after another
 * setup edit to the same bracket replaces it, so typing a list of teams leaves one backup, not
 * twenty; race results and backups before replacing actions are always kept.
 */
export function addBackup(list: Backup[], content: EventContent, reason: BackupReason, at: number): Backup[] {
  if (isEmpty(content)) return list;
  const [latest, ...rest] = list;
  if (latest && eventKey(latest.content) === eventKey(content)) return list;
  const entry: Backup = { at, reason, content };
  const coalesce =
    latest &&
    reason === 'edit' &&
    latest.reason === 'edit' &&
    at - latest.at < COALESCE_MS &&
    JSON.stringify(latest.content.bracket) === JSON.stringify(content.bracket);
  return (coalesce ? [entry, ...rest] : [entry, ...list]).slice(0, MAX_BACKUPS);
}

/** Why an automatic backup is being taken, from what changed since the last one (if any). */
export function reasonFor(latest: Backup | undefined, content: EventContent): 'first' | 'edit' | 'bracket' | 'result' {
  if (!latest) return 'first';
  const before = latest.content.bracket;
  const after = content.bracket;
  if (JSON.stringify(before) === JSON.stringify(after)) return 'edit';
  const shape = (b: typeof after) => b && JSON.stringify([b.size, b.format, Object.keys(b.teams).sort()]);
  return before && after && shape(before) === shape(after) ? 'result' : 'bracket';
}

/** The event a backup holds, as app state, keeping how it's being viewed now. */
export function restoreState(current: AppState, backup: Backup): AppState {
  return migrateState({ ...current, ...backup.content });
}

/** The list without one backup (matched by identity, since two can share a timestamp). */
export const withoutBackup = (list: Backup[], backup: Backup): Backup[] => list.filter((b) => b !== backup);

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function loadBackups(store: Store | undefined = globalThis.localStorage): Backup[] {
  try {
    const list = JSON.parse(store?.getItem(KEY) ?? '[]') as Backup[];
    return Array.isArray(list) ? list.filter((b) => b && typeof b.at === 'number' && b.content?.entrants) : [];
  } catch {
    return [];
  }
}

/**
 * Saves the list, dropping the oldest backups if the browser's storage is full, so the newest
 * always fit. Returns what was kept.
 */
export function saveBackups(list: Backup[], store: Store | undefined = globalThis.localStorage): Backup[] {
  for (let keep = list.length; keep >= 0; keep--) {
    try {
      store?.setItem(KEY, JSON.stringify(list.slice(0, keep)));
      return list.slice(0, keep);
    } catch {
      // Too big for what's left of the storage: try again with one fewer.
    }
  }
  return [];
}
