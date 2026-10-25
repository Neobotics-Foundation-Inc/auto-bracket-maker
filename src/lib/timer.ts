import type { RaceTimer } from './types';

export const DEFAULT_RACE_MS = 3 * 60 * 1000;
/** The − and + buttons change the duration by this (− stops here); typed lengths may be shorter. */
export const STEP_MS = 30 * 1000;
export const MIN_RACE_MS = 5 * 1000;
export const MAX_RACE_MS = 30 * 60 * 1000;
/** The final stretch, shown as a warning. */
export const WARNING_MS = 10 * 1000;

export const newTimer = (durationMs = DEFAULT_RACE_MS): RaceTimer => ({ durationMs, endsAt: null, pausedMs: null });

export type TimerPhase = 'idle' | 'running' | 'paused' | 'finished';

/** Time left at `now`, never below zero. */
export function remaining(timer: RaceTimer, now: number): number {
  if (timer.endsAt !== null) return Math.max(0, timer.endsAt - now);
  return timer.pausedMs ?? timer.durationMs;
}

export function phase(timer: RaceTimer, now: number): TimerPhase {
  if (timer.endsAt !== null) return timer.endsAt <= now ? 'finished' : 'running';
  return timer.pausedMs !== null ? 'paused' : 'idle';
}

/** Starts from idle, or resumes from paused. */
export const start = (timer: RaceTimer, now: number): RaceTimer => ({
  ...timer,
  endsAt: now + remaining(timer, now),
  pausedMs: null,
});

export const pause = (timer: RaceTimer, now: number): RaceTimer => ({
  ...timer,
  endsAt: null,
  pausedMs: remaining(timer, now),
});

/** Back to the full duration, stopped. */
export const reset = (timer: RaceTimer): RaceTimer => newTimer(timer.durationMs);

/** Start, pause or (once finished) reset: the one button that matters mid-event. */
export function toggle(timer: RaceTimer, now: number): RaceTimer {
  const p = phase(timer, now);
  if (p === 'running') return pause(timer, now);
  if (p === 'finished') return reset(timer);
  return start(timer, now);
}

/** A race length within the limits, in whole seconds. */
export const clampDuration = (ms: number) => Math.min(Math.max(Math.round(ms / 1000) * 1000, MIN_RACE_MS), MAX_RACE_MS);

/** Lengthens or shortens the race by whole steps; only while idle. Shortening stops at one step. */
export function adjust(timer: RaceTimer, steps: number): RaceTimer {
  if (timer.endsAt !== null || timer.pausedMs !== null) return timer;
  const floor = Math.min(timer.durationMs, STEP_MS);
  return newTimer(Math.min(Math.max(timer.durationMs + steps * STEP_MS, floor), MAX_RACE_MS));
}

/** Sets the race length (within the limits); only while idle. */
export function setDuration(timer: RaceTimer, ms: number): RaceTimer {
  if (timer.endsAt !== null || timer.pausedMs !== null) return timer;
  return newTimer(clampDuration(ms));
}

/**
 * Reads a typed race length: "m:ss" (also "mm:ss"), or a plain number, read as minutes up to
 * 30 ("3" is 3:00) and as seconds above that ("90" is 1:30). Null if it isn't a time.
 */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  const colon = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (colon) {
    const seconds = Number(colon[2]);
    if (seconds >= 60) return null;
    const ms = (Number(colon[1]) * 60 + seconds) * 1000;
    return ms > 0 ? ms : null;
  }
  if (/^\d{1,4}$/.test(t)) {
    const n = Number(t);
    if (n === 0) return null;
    return (n <= 30 ? n * 60 : n) * 1000;
  }
  return null;
}

/** m:ss, rounding up so the display reaches 0:00 exactly when time is up. */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * m:ss and .mmm separately, for the present-mode timer. Milliseconds count down to the
 * moment, so it shows 0:00.000 exactly when time is up.
 */
export function formatCountdownParts(ms: number): { main: string; millis: string } {
  const total = Math.max(0, Math.floor(ms));
  const seconds = Math.floor(total / 1000);
  return {
    main: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
    millis: `.${String(total % 1000).padStart(3, '0')}`,
  };
}

/** A saved timer, checked; a fresh 3-minute one if missing or malformed. */
export function migrateTimer(saved: Partial<RaceTimer> | undefined): RaceTimer {
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!saved || !ok(saved.durationMs)) return newTimer();
  return {
    durationMs: Math.min(Math.max(saved.durationMs, MIN_RACE_MS), MAX_RACE_MS),
    endsAt: ok(saved.endsAt) ? saved.endsAt : null,
    pausedMs: ok(saved.pausedMs) ? saved.pausedMs : null,
  };
}
