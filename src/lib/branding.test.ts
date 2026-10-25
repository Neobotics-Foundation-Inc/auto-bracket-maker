import { describe, expect, it } from 'vitest';
import { adaptLogo, removeBackground } from './branding';

/** A size×size image filled with one color. */
function solid(size: number, [r, g, b]: number[]) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i += 4) data.set([r, g, b, 255], i);
  return data;
}

/** A white 12×12 logo with a black 5×5 square ("lettering") and a red 2×2 square ("mark"), plus a white hole in the black. */
function whiteLogo() {
  const size = 12;
  const data = solid(size, [255, 255, 255]);
  const paint = (x0: number, y0: number, w: number, rgb: number[]) => {
    for (let y = y0; y < y0 + w; y++) for (let x = x0; x < x0 + w; x++) data.set([...rgb, 255], (y * size + x) * 4);
  };
  paint(2, 2, 5, [0, 0, 0]);
  paint(4, 4, 1, [255, 255, 255]);
  paint(8, 8, 2, [255, 0, 51]);
  return { data, size, at: (x: number, y: number) => [...data.slice((y * size + x) * 4, (y * size + x) * 4 + 4)] };
}

describe('removeBackground', () => {
  it('clears a solid background, including enclosed holes, and keeps the artwork', () => {
    const logo = whiteLogo();
    expect(removeBackground(logo.data, logo.size, logo.size)).toBe(true);
    expect(logo.at(0, 0)[3]).toBe(0);
    expect(logo.at(4, 4)[3]).toBe(0);
    expect(logo.at(2, 2)).toEqual([0, 0, 0, 255]);
    expect(logo.at(8, 8)).toEqual([255, 0, 51, 255]);
  });

  it('keeps faint, near-white lettering instead of clearing it with the background', () => {
    const w = 20;
    const data = solid(w, [255, 255, 255]);
    // A light gray bar, 3 pixels wide, as a wordmark only 20 levels off white.
    for (let y = 4; y < 16; y++) for (let x = 8; x < 11; x++) data.set([235, 235, 235, 255], (y * w + x) * 4);
    expect(removeBackground(data, w, w)).toBe(true);
    expect(data[(10 * w + 9) * 4 + 3]).toBe(255);
    expect(data[(10 * w + 2) * 4 + 3]).toBe(0);
  });

  it('fills the body of a white letter drawn only by its faint outline, keeping a large hole clear', () => {
    const w = 40;
    const h = 30;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) data.set([255, 255, 255, 255], i);
    const ring = (x0: number, y0: number, x1: number, y1: number, rgb: number[]) => {
      for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) data.set([...rgb, 255], (y * w + x) * 4);
      for (let y = y0; y <= y1; y++) for (const x of [x0, x1]) data.set([...rgb, 255], (y * w + x) * 4);
    };
    // The letter body, just off white, between an outer and an inner outline; a big hole inside.
    for (let y = 4; y <= 25; y++) for (let x = 4; x <= 35; x++) data.set([252, 252, 252, 255], (y * w + x) * 4);
    for (let y = 11; y <= 18; y++) for (let x = 13; x <= 26; x++) data.set([255, 255, 255, 255], (y * w + x) * 4);
    ring(4, 4, 35, 25, [238, 238, 238]);
    ring(12, 10, 27, 19, [238, 238, 238]);
    expect(removeBackground(data, w, h)).toBe(true);
    const alphaAt = (x: number, y: number) => data[(y * w + x) * 4 + 3];
    expect(alphaAt(1, 1)).toBe(0);
    expect(alphaAt(7, 7)).toBe(255);
    expect(alphaAt(20, 14)).toBe(0);
  });

  it('leaves images without a solid border alone', () => {
    const data = solid(6, [255, 255, 255]);
    for (let i = 0; i < data.length; i += 8) data.set([20, 120, 200, 255], i);
    const before = [...data];
    expect(removeBackground(data, 6, 6)).toBe(false);
    expect([...data]).toEqual(before);
  });
});

describe('adaptLogo', () => {
  const pixel = (rgb: number[]) => new Uint8ClampedArray([...rgb, 255]);

  it('turns dark lettering white for the dark bar, keeping colors', () => {
    const black = pixel([10, 10, 10]);
    const red = pixel([255, 0, 51]);
    const white = pixel([250, 250, 250]);
    adaptLogo(black, 'dark');
    adaptLogo(red, 'dark');
    adaptLogo(white, 'dark');
    expect(black[0]).toBeGreaterThan(230);
    expect([...red]).toEqual([255, 0, 51, 255]);
    expect(white[0]).toBe(250);
  });

  it('turns light lettering Tarmac Blue for the light bar', () => {
    const white = pixel([255, 255, 255]);
    const black = pixel([0, 0, 0]);
    adaptLogo(white, 'light');
    adaptLogo(black, 'light');
    expect(white[2]).toBeLessThan(60);
    expect(white[2]).toBeGreaterThan(white[0]);
    expect(black[0]).toBe(0);
  });
});
