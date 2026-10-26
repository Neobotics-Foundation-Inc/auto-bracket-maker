import { describe, expect, it } from 'vitest';
import { adjust, clampDuration, DEFAULT_RACE_MS, formatCountdown, formatCountdownParts, migrateTimer, parseDuration, setDuration, newTimer, pause, phase, remaining, reset, start, toggle } from './timer';

describe('race timer', () => {
  it('defaults to 3 minutes, idle', () => {
    const t = newTimer();
    expect(DEFAULT_RACE_MS).toBe(180000);
    expect(phase(t, 0)).toBe('idle');
    expect(formatCountdown(remaining(t, 0))).toBe('03:00');
  });

  it('counts down, pauses and resumes without losing time', () => {
    let t = start(newTimer(), 1000);
    expect(phase(t, 2000)).toBe('running');
    expect(remaining(t, 61000)).toBe(120000);
    t = pause(t, 61000);
    expect(phase(t, 500000)).toBe('paused');
    expect(remaining(t, 500000)).toBe(120000);
    t = start(t, 500000);
    expect(remaining(t, 560000)).toBe(60000);
  });

  it('finishes at zero, and the main button then resets it', () => {
    const t = start(newTimer(), 0);
    expect(phase(t, 180000)).toBe('finished');
    expect(remaining(t, 999999)).toBe(0);
    const again = toggle(t, 200000);
    expect(phase(again, 200000)).toBe('idle');
    expect(remaining(again, 200000)).toBe(180000);
  });

  it('toggles between running and paused', () => {
    const running = toggle(newTimer(), 0);
    expect(phase(running, 1)).toBe('running');
    expect(phase(toggle(running, 1000), 1000)).toBe('paused');
  });

  it('changes the duration in 30-second steps, only while idle, within limits', () => {
    expect(adjust(newTimer(), 1).durationMs).toBe(210000);
    expect(adjust(newTimer(), -1).durationMs).toBe(150000);
    expect(adjust(newTimer(30000), -1).durationMs).toBe(30000);
    expect(adjust(newTimer(45000), -1).durationMs).toBe(30000);
    expect(adjust(newTimer(20000), -1).durationMs).toBe(20000);
    expect(adjust(newTimer(1800000), 1).durationMs).toBe(1800000);
    const running = start(newTimer(), 0);
    expect(adjust(running, 1)).toBe(running);
  });

  it('reads typed race lengths', () => {
    expect(parseDuration('2:30')).toBe(150000);
    expect(parseDuration(' 10:05 ')).toBe(605000);
    expect(parseDuration('0:45')).toBe(45000);
    expect(parseDuration('3')).toBe(180000);
    expect(parseDuration('30')).toBe(1800000);
    expect(parseDuration('90')).toBe(90000);
    for (const bad of ['', 'abc', '1:5', '1:60', '0:00', '0', '1:30:00', '-2']) expect(parseDuration(bad), bad).toBeNull();
  });

  it('sets a typed length within the limits, only while idle', () => {
    expect(setDuration(newTimer(), 150000).durationMs).toBe(150000);
    expect(setDuration(newTimer(), 1000).durationMs).toBe(5000);
    expect(setDuration(newTimer(), 99 * 60000).durationMs).toBe(1800000);
    expect(clampDuration(61499)).toBe(61000);
    const running = start(newTimer(), 0);
    expect(setDuration(running, 60000)).toBe(running);
  });

  it('resets to the chosen duration', () => {
    expect(reset(pause(start(newTimer(240000), 0), 5000))).toEqual(newTimer(240000));
  });

  it('shows mm:ss, reaching 00:00 only when time is up', () => {
    expect(formatCountdown(180000)).toBe('03:00');
    expect(formatCountdown(59001)).toBe('01:00');
    expect(formatCountdown(9500)).toBe('00:10');
    expect(formatCountdown(1)).toBe('00:01');
    expect(formatCountdown(0)).toBe('00:00');
  });

  it('shows milliseconds for present mode, reaching 00:00:000 when time is up', () => {
    expect(formatCountdownParts(180000)).toEqual({ main: '03:00', millis: ':000' });
    expect(formatCountdownParts(179999)).toEqual({ main: '02:59', millis: ':999' });
    expect(formatCountdownParts(61234.9)).toEqual({ main: '01:01', millis: ':234' });
    expect(formatCountdownParts(5)).toEqual({ main: '00:00', millis: ':005' });
    expect(formatCountdownParts(0)).toEqual({ main: '00:00', millis: ':000' });
    expect(formatCountdownParts(-20)).toEqual({ main: '00:00', millis: ':000' });
  });

  it('restores saved timers, falling back to a fresh one', () => {
    expect(migrateTimer(undefined)).toEqual(newTimer());
    expect(migrateTimer({ durationMs: 'x' as unknown as number })).toEqual(newTimer());
    expect(migrateTimer({ durationMs: 240000, endsAt: 5, pausedMs: null })).toEqual({ durationMs: 240000, endsAt: 5, pausedMs: null });
  });
});
