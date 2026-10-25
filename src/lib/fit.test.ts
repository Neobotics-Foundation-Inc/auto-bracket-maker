import { describe, expect, it } from 'vitest';
import { largestFit, textFits } from './fit';

describe('largestFit', () => {
  it('keeps the largest size that fits', () => {
    expect(largestFit((s) => s <= 15, 18, 12)).toBe(15);
    expect(largestFit(() => true, 18, 12)).toBe(18);
  });

  it('stops at the minimum when nothing fits', () => {
    expect(largestFit(() => false, 18, 12)).toBe(12);
  });

  it('tries whole sizes only, from a fractional stylesheet size', () => {
    const tried: number[] = [];
    largestFit((s) => (tried.push(s), false), 18.5, 15);
    expect(tried).toEqual([18, 17, 16]);
  });
});

describe('textFits', () => {
  const box = (textWidth: number, boxWidth: number, scrollHeight: number, clientHeight: number) => ({
    textWidth,
    boxWidth,
    scrollHeight,
    clientHeight,
  });

  it('fits when nothing overflows', () => {
    expect(textFits(box(150, 150, 55, 55), 18)).toBe(true);
  });

  it('allows glyphs poking a pixel or two past the line boxes vertically', () => {
    expect(textFits(box(149.5, 150, 57, 55), 18)).toBe(true);
  });

  it('rejects a word wider than the box', () => {
    expect(textFits(box(160, 150, 18, 18), 18)).toBe(false);
  });

  it('rejects text even a pixel or two too wide, which rounded widths let through', () => {
    // RoboTalRacer at 17px beside a first-round time: scrollWidth 112, clientWidth 111.
    expect(textFits(box(112.19, 110.5, 17, 17), 17)).toBe(false);
  });

  it('rejects a fourth line hidden by the three-line limit', () => {
    expect(textFits(box(150, 150, 73, 55), 18)).toBe(false);
  });
});
