import { describe, expect, it } from 'vitest';
import { contrast, inkOn, isHex, luminance, NEOBOTICS_COLORS, onLight, PALETTES, readabilityWarnings } from './colors';

describe('color helpers', () => {
  it('checks hex colors', () => {
    expect(isHex('#ff0033')).toBe(true);
    expect(isHex('#FF0033')).toBe(true);
    expect(isHex('ff0033')).toBe(false);
    expect(isHex('#f03')).toBe(false);
    expect(isHex(null)).toBe(false);
  });

  it('measures luminance and contrast as WCAG does', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1, 6);
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 6);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 6);
  });

  it('picks the readable label color for a button', () => {
    expect(inkOn('#ff0033')).toBe('#ffffff');
    expect(inkOn('#f5b700')).toBe('#14161c');
    expect(inkOn('#1f6bff')).toBe('#ffffff');
  });
});

describe('onLight', () => {
  it('leaves colors that already read on white alone', () => {
    expect(onLight('#ff0033')).toBe('#ff0033');
    expect(onLight('#1f6bff')).toBe('#1f6bff');
  });

  it('deepens light colors just enough to read on white', () => {
    const gold = onLight('#f5b700');
    expect(contrast(gold, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrast(gold, '#ffffff')).toBeLessThan(3.6);
    expect(onLight('#ffffff')).not.toBe('#ffffff');
  });
});

describe('readabilityWarnings', () => {
  it('passes every ready-made palette', () => {
    for (const p of PALETTES) expect(readabilityWarnings(p.colors), p.name).toEqual([]);
  });

  it('flags colors that would be hard to read', () => {
    expect(readabilityWarnings({ main: '#0a0a12', text: NEOBOTICS_COLORS.text })).toHaveLength(1);
    expect(readabilityWarnings({ main: '#fafafa', text: NEOBOTICS_COLORS.text })).toHaveLength(1);
    expect(readabilityWarnings({ main: NEOBOTICS_COLORS.main, text: '#cccccc' })).toHaveLength(1);
  });
});
