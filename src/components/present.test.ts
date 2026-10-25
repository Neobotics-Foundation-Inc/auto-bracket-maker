import { describe, expect, it } from 'vitest';
import { buildBracket } from '../lib/bracket';
import { CARD_W, layoutBracket, layoutCombined } from '../lib/layout';
import type { SeededTeam } from '../lib/types';
import { fillingCardWidth } from './BracketView';
import { columnCount } from './StandingsView';

const teams = (n: number): SeededTeam[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, timeMs: (i + 1) * 1000, seed: i + 1 }));

// The space left for content on a 1920×1080 projector in present mode.
const PROJECTOR = { w: 1872, h: 940 };

describe('columnCount', () => {
  it('keeps the on-screen rule outside present mode', () => {
    expect(columnCount(8, null)).toBe(1);
    expect(columnCount(26, null)).toBe(2);
  });

  it('keeps a short list in one column, so its rows show largest', () => {
    expect(columnCount(8, PROJECTOR)).toBe(1);
  });

  it('spreads a long list across the width of a widescreen projector', () => {
    expect(columnCount(50, PROJECTOR)).toBe(3);
  });
});

describe('fillingCardWidth', () => {
  it('widens cards until a bracket matches the screen’s shape, without changing its height', () => {
    const bracket = buildBracket(teams(8), 'double');
    const cardW = fillingCardWidth((w) => layoutCombined(bracket, w), PROJECTOR);
    expect(cardW).toBeGreaterThan(CARD_W);
    const wide = layoutCombined(bracket, cardW);
    expect(wide.height).toBe(layoutCombined(bracket).height);
    expect(wide.width / wide.height).toBeCloseTo(PROJECTOR.w / PROJECTOR.h, 1);
  });

  it('leaves cards alone when the bracket is already wider than the screen', () => {
    const bracket = buildBracket(teams(64));
    const at = (w: number) => layoutBracket(bracket, { mirrored: true, firstRound: 0, cardW: w });
    expect(fillingCardWidth(at, { w: 1000, h: 1000 })).toBe(CARD_W);
  });
});
