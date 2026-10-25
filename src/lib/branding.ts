import { isHex, type ThemeColors } from './colors';

/** An event's own logo and colors, replacing the Neobotics ones. Logos are data URLs. */
export interface Branding {
  /** The logo as shown on the dark theme's black bar. */
  logoDark: string | null;
  /** The logo as shown on the light theme's white bar. */
  logoLight: string | null;
  /** Which version of the logo processing made these; older logos are processed again. */
  version?: number;
  /** The event's theme colors; null for the Neobotics colors. */
  colors?: ThemeColors | null;
}

/** A processed logo, in both theme versions. */
export type PreparedLogo = { logoDark: string; logoLight: string; version: number };

export const DEFAULT_BRANDING: Branding = { logoDark: null, logoLight: null };

/** Bumped whenever logo processing improves, so logos saved before it are processed again. */
export const LOGO_VERSION = 2;

// Kept apart from the main state: the images are large and rarely change.
const KEY = 'auto-bracket-maker:branding';

/** Only images can stand in for the logo, whatever a file or old save holds. */
const imageOrNull = (logo: unknown): string | null =>
  typeof logo === 'string' && /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/.test(logo) ? logo : null;

/** Saved branding (from storage or an event file), checked and brought up to date. */
export function migrateBranding(saved: unknown): Branding {
  if (!saved || typeof saved !== 'object') return DEFAULT_BRANDING;
  // The first version kept one logo for both themes; venue backgrounds are no longer used.
  const { logo, logoDark, logoLight, version, colors } = saved as Partial<Branding> & { logo?: unknown };
  const checked = colors && isHex(colors.main) && isHex(colors.text) ? colors : null;
  return logoDark || logoLight
    ? { logoDark: imageOrNull(logoDark), logoLight: imageOrNull(logoLight), version, colors: checked }
    : { logoDark: imageOrNull(logo), logoLight: imageOrNull(logo), colors: checked };
}

export function loadBranding(): Branding {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrateBranding(JSON.parse(raw));
  } catch {
    // Storage blocked or corrupt: use the defaults.
  }
  return DEFAULT_BRANDING;
}

/** Returns false when the browser couldn't store it (storage full or blocked). */
export function saveBranding(branding: Branding): boolean {
  try {
    if (branding.logoDark || branding.logoLight || branding.colors) localStorage.setItem(KEY, JSON.stringify(branding));
    else localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

const LOGO_MAX_W = 800;
const LOGO_MAX_H = 320;

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const colorDistance = (data: Uint8ClampedArray, i: number, [r, g, b]: number[]) =>
  Math.hypot(data[i] - r, data[i + 1] - g, data[i + 2] - b);

// A border pixel within NEAR of the background color counts as background.
const NEAR = 40;
// Within NOISE of the background is always background (compression specks, paper texture).
const NOISE = 4;
// The artwork is fully opaque from this far off the background: at most MAX_INK (dark
// lettering on white), and at least MIN_INK (faint, near-white lettering on white).
const MIN_INK = 12;
const MAX_INK = 96;
// Below this, the artwork is light on light (a white wordmark on white): letter bodies are the
// background's color and only their outlines stand out, so the bodies are filled by shape.
const FAINT_INK = 40;

/** Grows a mask by one pixel in every direction. */
function dilate(mask: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) out[ny * width + nx] = 1;
        }
      }
    }
  }
  return out;
}

/**
 * Finds background-colored areas inside an odd number of outlines: the body of a letter
 * drawn as a light outline on a light background is inside one, while the background
 * (reached from the border) is inside none and the hole of an "o" inside two. Outlines join
 * diagonally; background areas only through edges.
 */
export function enclosedAreas(isOutline: Uint8Array, width: number, height: number): Uint8Array {
  const count = width * height;
  const component = new Int32Array(count).fill(-1);
  const kinds: boolean[] = [];
  const stack: number[] = [];
  for (let start = 0; start < count; start++) {
    if (component[start] !== -1) continue;
    const id = kinds.length;
    const outline = !!isOutline[start];
    kinds.push(outline);
    component[start] = id;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % width;
      const y = (p - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || (!outline && dx && dy)) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          if (component[q] === -1 && !!isOutline[q] === outline) {
            component[q] = id;
            stack.push(q);
          }
        }
      }
    }
  }

  const neighbors = kinds.map(() => new Set<number>());
  for (let p = 0; p < count; p++) {
    const x = p % width;
    for (const q of [x < width - 1 ? p + 1 : -1, p + width < count ? p + width : -1]) {
      if (q >= 0 && component[q] !== component[p]) {
        neighbors[component[p]].add(component[q]);
        neighbors[component[q]].add(component[p]);
      }
    }
  }

  // Nesting depth, counted in outlines crossed from the border.
  const depth = new Int32Array(kinds.length).fill(-1);
  const queue: number[] = [];
  const reach = (id: number, d: number) => {
    if (depth[id] !== -1) return;
    depth[id] = d;
    queue.push(id);
  };
  for (let x = 0; x < width; x++) {
    reach(component[x], kinds[component[x]] ? 1 : 0);
    reach(component[count - 1 - x], kinds[component[count - 1 - x]] ? 1 : 0);
  }
  for (let y = 0; y < height; y++) {
    reach(component[y * width], kinds[component[y * width]] ? 1 : 0);
    reach(component[y * width + width - 1], kinds[component[y * width + width - 1]] ? 1 : 0);
  }
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    // Stepping into an outline crosses it; stepping out of one into an area doesn't.
    for (const n of neighbors[id]) reach(n, kinds[n] ? depth[id] + 1 : depth[id]);
  }

  const inside = new Uint8Array(count);
  for (let p = 0; p < count; p++) {
    const id = component[p];
    if (!kinds[id] && depth[id] % 2 === 1) inside[p] = 1;
  }
  return inside;
}

/**
 * Makes a logo's solid background transparent, in place. The background color is taken
 * from the border; if the border isn't one solid color (a photo, or already transparent),
 * nothing changes. Returns whether a background was removed.
 *
 * Each pixel's opacity follows its distance from the background color, scaled to how far
 * the logo's own gray tones stand off it. Black lettering on white stands far off; a white
 * wordmark placed on white stands off by only a few levels, and is lifted to full opacity
 * rather than cleared with the background. Areas of background color inside the artwork
 * (the inside of an "O") are cleared too.
 */
export function removeBackground(data: Uint8ClampedArray, width: number, height: number): boolean {
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);
  const opaque = border.filter((p) => data[p * 4 + 3] > 250);
  if (opaque.length < border.length * 0.9) return false;

  const channel = (c: number) => {
    const values = opaque.map((p) => data[p * 4 + c]).sort((a, b) => a - b);
    return values[values.length >> 1];
  };
  const bg = [channel(0), channel(1), channel(2)];
  const matching = opaque.filter((p) => colorDistance(data, p * 4, bg) < NEAR).length;
  if (matching < opaque.length * 0.85) return false;

  // How far the artwork's gray tones stand off the background: most of its neutral pixels
  // should end up fully opaque.
  const count = width * height;
  const distance = new Float32Array(count);
  const neutralInk: number[] = [];
  for (let p = 0; p < count; p++) {
    const i = p * 4;
    distance[p] = colorDistance(data, i, bg);
    const chroma = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
    if (distance[p] > NOISE && chroma < 25) neutralInk.push(distance[p]);
  }
  neutralInk.sort((a, b) => a - b);
  const ink = Math.min(Math.max(neutralInk[Math.floor(neutralInk.length * 0.9)] ?? MAX_INK, MIN_INK), MAX_INK);
  const clear = Math.max(NOISE, ink * 0.2);
  let filled: Uint8Array | null = null;
  if (ink < FAINT_INK) {
    // Only the faint gray outlines count: solid colored artwork has holes, not bodies.
    const outline = new Uint8Array(count);
    // Low, so the faintest stretches of outline still join up around each letter.
    const edge = clear + (ink - clear) * 0.3;
    for (let p = 0; p < count; p++) {
      const i = p * 4;
      const chroma = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
      outline[p] = distance[p] > edge && chroma < 25 ? 1 : 0;
    }
    // Thickened by a pixel to close small breaks in faint outlines, then the seam that leaves
    // between outline and body is filled back in.
    const inside = dilate(enclosedAreas(dilate(outline, width, height), width, height), width, height);
    filled = new Uint8Array(count);
    for (let p = 0; p < count; p++) filled[p] = inside[p] && !outline[p] ? 1 : 0;
  }

  const alpha = new Float32Array(count);
  for (let p = 0; p < count; p++) alpha[p] = filled?.[p] ? 1 : smoothstep(clear, ink, distance[p]);
  if (filled) fillSpecks(alpha, width, height);

  for (let p = 0; p < count; p++) {
    const i = p * 4;
    const a = alpha[p];
    if (a >= 1) continue;
    // Take the background's tint out of anti-aliased edges so they don't leave a halo.
    for (let c = 0; c < 3; c++) data[i + c] = a > 0 ? (data[i + c] - bg[c] * (1 - a)) / a : 0;
    data[i + 3] = Math.min(data[i + 3], a * 255);
  }
  return true;
}

/**
 * Fills see-through specks and patches inside solid areas, in place: opacity averaged over
 * a small neighborhood lifts pixels that sit mostly among solid ones. Separate letters
 * don't join, since the gap between them is mostly see-through.
 */
export function fillSpecks(alpha: Float32Array, width: number, height: number, radius = 2) {
  const blurred = new Float32Array(alpha.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          sum += alpha[ny * width + nx];
          n++;
        }
      }
      blurred[y * width + x] = sum / n;
    }
  }
  for (let p = 0; p < alpha.length; p++) alpha[p] = Math.max(alpha[p], smoothstep(0.3, 0.55, blurred[p]));
}

/**
 * Adapts a transparent logo to one theme's bar, in place, as the Neobotics logo pair does:
 * black or gray lettering turns white on the dark bar, white lettering turns Tarmac Blue on
 * the light bar, and colored parts (the red mark) stay as they are.
 */
export function adaptLogo(data: Uint8ClampedArray, tone: 'dark' | 'light') {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // How neutral (gray) the pixel is: fully for grays, not at all for clear colors.
    const neutral = 1 - smoothstep(0.12, 0.28, chroma);
    if (neutral === 0) continue;
    if (tone === 'dark' && lum < 0.5) {
      const to = 1 - lum;
      for (let c = 0; c < 3; c++) data[i + c] += (to * 255 - data[i + c]) * neutral;
    } else if (tone === 'light' && lum > 0.5) {
      // Towards Tarmac Blue (#1b2036) rather than pure black.
      const dark = 1 - lum;
      const tarmac = [27, 32, 54];
      for (let c = 0; c < 3; c++) data[i + c] += (tarmac[c] * (0.6 + dark) - data[i + c]) * neutral;
    }
  }
}

function readImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read the image"));
    };
    img.src = url;
  });
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true })! };
}

/** WebP where the browser can write it, otherwise the fallback type. */
function encode(canvas: HTMLCanvasElement, fallback: 'image/png' | 'image/jpeg', quality: number) {
  const webp = canvas.toDataURL('image/webp', quality);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL(fallback, quality);
}

/** Bounds of the pixels that aren't fully transparent, so built-in padding doesn't shrink the logo. */
function opaqueBounds(data: Uint8ClampedArray, width: number, height: number) {
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return right < 0 ? { left: 0, top: 0, width, height } : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

const hasTransparency = (data: Uint8ClampedArray) => {
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
};

/**
 * Removes a solid background, trims the padding and makes a version for each theme's bar.
 * A logo that stays a full rectangle (a photo) is used as it is on both.
 */
export async function prepareLogo(file: Blob): Promise<PreparedLogo> {
  const img = await readImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const full = canvasOf(w, h);
  full.ctx.drawImage(img, 0, 0);
  const pixels = full.ctx.getImageData(0, 0, w, h);
  removeBackground(pixels.data, w, h);
  full.ctx.putImageData(pixels, 0, 0);

  const box = opaqueBounds(pixels.data, w, h);
  const scale = Math.min(1, LOGO_MAX_W / box.width, LOGO_MAX_H / box.height);
  const out = canvasOf(Math.round(box.width * scale), Math.round(box.height * scale));
  out.ctx.drawImage(full.canvas, box.left, box.top, box.width, box.height, 0, 0, out.canvas.width, out.canvas.height);
  const trimmed = out.ctx.getImageData(0, 0, out.canvas.width, out.canvas.height);
  if (!hasTransparency(trimmed.data)) {
    const same = encode(out.canvas, 'image/png', 0.92);
    return { logoDark: same, logoLight: same, version: LOGO_VERSION };
  }

  const version = (tone: 'dark' | 'light') => {
    const copy = new ImageData(new Uint8ClampedArray(trimmed.data), trimmed.width, trimmed.height);
    adaptLogo(copy.data, tone);
    out.ctx.putImageData(copy, 0, 0);
    return encode(out.canvas, 'image/png', 0.92);
  };
  return { logoDark: version('dark'), logoLight: version('light'), version: LOGO_VERSION };
}

/**
 * Processes a logo saved by an older version again (one kept from before backgrounds were
 * removed, say). Returns null when it's already current.
 */
export async function upgradeLogo(branding: Branding): Promise<PreparedLogo | null> {
  if (!branding.logoDark || branding.version === LOGO_VERSION) return null;
  const blob = await (await fetch(branding.logoDark)).blob();
  return prepareLogo(blob);
}
