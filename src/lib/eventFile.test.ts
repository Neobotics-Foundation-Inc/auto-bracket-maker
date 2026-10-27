import { describe, expect, it } from 'vitest';
import { advanceWinner, buildBracket } from './bracket';
import { describeEvent, EventFileError, eventFileName, FILE_KIND, parseEventFile, toEventFile } from './eventFile';
import { initialState } from './storage';
import type { AppState, SeededTeam } from './types';

const teams = (n: number): SeededTeam[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, timeMs: (i + 1) * 1000, seed: i + 1 }));

function eventWithResult(): AppState {
  const bracket = buildBracket(teams(8), 'double');
  return {
    ...initialState,
    event: { title: 'VTC 2026', subtitle: 'Main hall' },
    entrants: teams(8).map((t) => ({ id: t.id, name: t.name, min: '', sec: String(t.timeMs / 1000), ms: '' })),
    format: 'double',
    bracket: advanceWinner(bracket, 'r0m0', 't1'),
    view: 'bracket',
    timer: { durationMs: 150000, endsAt: Date.now() + 60000, pausedMs: null },
  };
}

const branding = { logoDark: 'data:image/webp;base64,AAAA', logoLight: 'data:image/png;base64,BBBB', colors: { main: '#1f6bff', text: '#0f1f3d', textDark: '#eaf1ff' } };

describe('event files', () => {
  it('round-trips an event with its results, logo and colors', () => {
    const state = eventWithResult();
    const { state: opened, branding: brand } = parseEventFile(JSON.stringify(toEventFile(state, branding)));
    expect(opened.event).toEqual(state.event);
    expect(opened.entrants).toEqual(state.entrants);
    expect(opened.bracket).toEqual(state.bracket);
    expect(brand).toEqual({ ...branding, version: undefined });
  });

  it('brings a running timer back stopped, at the same length', () => {
    const { state } = parseEventFile(JSON.stringify(toEventFile(eventWithResult(), branding)));
    expect(state.timer).toEqual({ durationMs: 150000, endsAt: null, pausedMs: null });
  });

  it('refuses files that aren’t event files, with a reason', () => {
    expect(() => parseEventFile('not json')).toThrow(EventFileError);
    expect(() => parseEventFile(JSON.stringify({ hello: 'world' }))).toThrow(/isn’t an event file/);
    const newer = { ...toEventFile(eventWithResult(), branding), version: 99 };
    expect(() => parseEventFile(JSON.stringify(newer))).toThrow(/newer version/);
  });

  it('refuses damaged events rather than letting them break the views', () => {
    const file = toEventFile(eventWithResult(), branding);
    const broken = [
      { ...file, state: { ...file.state, entrants: 'lots' } },
      { ...file, state: { ...file.state, format: 'swiss' } },
      { ...file, state: { ...file.state, bracket: { size: 8 } } },
      { ...file, state: { ...file.state, event: null } },
    ];
    for (const f of broken) expect(() => parseEventFile(JSON.stringify(f))).toThrow(/damaged/);
  });

  it('drops a logo that isn’t an image', () => {
    const file = { ...toEventFile(eventWithResult(), branding), kind: FILE_KIND };
    const sneaky = { ...file, branding: { ...branding, logoDark: 'javascript:alert(1)' } };
    expect(parseEventFile(JSON.stringify(sneaky)).branding.logoDark).toBeNull();
  });

  it('names the file after the event and when it was saved', () => {
    const at = new Date(2026, 9, 25, 14, 32);
    expect(eventFileName('VTC 2026: Finals!', at)).toBe('vtc-2026-finals-2026-10-25-1432.bracket.json');
    expect(eventFileName('', at)).toBe('event-2026-10-25-1432.bracket.json');
  });

  it('describes an event in a line', () => {
    expect(describeEvent(eventWithResult())).toMatch(/^VTC 2026 · 8 teams · 1 of \d+ races decided$/);
    expect(describeEvent({ event: { title: '', subtitle: '' }, entrants: [], bracket: null })).toBe(
      'Untitled event · 0 teams · no bracket yet',
    );
  });
});
