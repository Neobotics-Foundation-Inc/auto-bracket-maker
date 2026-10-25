/** An event's theme colors, as #rrggbb. */
export interface ThemeColors {
  /** Buttons, the active tab, highlights, winners and seed badges. */
  main: string;
  /** Headings and team names in the light theme. */
  text: string;
}

export const NEOBOTICS_COLORS: ThemeColors = { main: '#ff0033', text: '#1b2036' };

/** Ready-made palettes; the first is the Neobotics default. */
export const PALETTES: { name: string; colors: ThemeColors }[] = [
  { name: 'Neobotics', colors: NEOBOTICS_COLORS },
  { name: 'Electric blue', colors: { main: '#1f6bff', text: '#0f1f3d' } },
  { name: 'Track green', colors: { main: '#12b76a', text: '#0d2a1c' } },
  { name: 'Safety orange', colors: { main: '#ff7a00', text: '#2b1a0c' } },
  { name: 'Violet', colors: { main: '#8b5cf6', text: '#1f1638' } },
  { name: 'Gold', colors: { main: '#f5b700', text: '#2a2108' } },
];

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (value: unknown): value is string => typeof value === 'string' && HEX.test(value);

function channels(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string) {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors, 1 to 21. */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The label color on a main-color button: white, as on the Neobotics red, unless white
 * would fall below 3:1 (the bar for bold UI text), then near-black.
 */
export const inkOn = (hex: string) => (contrast(hex, '#ffffff') >= 3 ? '#ffffff' : '#14161c');

/**
 * The main color as used on the light theme, where it also colors text on white (the
 * active tab, links): deepened towards black just enough to reach 3:1 against white.
 * Colors that already reach it are unchanged.
 */
export function onLight(hex: string): string {
  const [r, g, b] = channels(hex);
  for (let keep = 1; keep > 0; keep -= 0.04) {
    const mixed = `#${[r, g, b].map((v) => Math.round(v * keep).toString(16).padStart(2, '0')).join('')}`;
    if (contrast(mixed, '#ffffff') >= 3) return mixed;
  }
  return '#000000';
}

/** Warnings for colors that would be hard to read, empty when both are fine. */
export function readabilityWarnings({ main, text }: ThemeColors): string[] {
  const warnings: string[] = [];
  // Large text and UI parts need 3:1; body text needs 4.5:1 (WCAG AA).
  if (contrast(main, '#000000') < 3) warnings.push('The main color is very dark: highlights will be hard to see in the dark theme.');
  if (contrast(main, '#ffffff') < 1.6) warnings.push('The main color is very light: the light theme uses a deeper shade of it so it stays readable.');
  if (contrast(text, '#ffffff') < 4.5) warnings.push('The text color is too light to read comfortably on the light theme’s white panels.');
  return warnings;
}
