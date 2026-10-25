/** The largest whole font size from max down to min at which `fits` holds, or min if none does. */
export function largestFit(fits: (size: number) => boolean, max: number, min: number): number {
  for (let size = Math.floor(max); size > min; size--) {
    if (fits(size)) return size;
  }
  return min;
}

export interface TextBox {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * Whether text fits its box: no wider (a word too long for a line), and no taller by a line or
 * more (more lines than the box shows). Glyphs poke a pixel or two past tight line boxes, so
 * height only counts as overflowing by most of a line.
 */
export function textFits(box: TextBox, lineHeight: number): boolean {
  return box.scrollWidth <= box.clientWidth + 1 && box.scrollHeight <= box.clientHeight + lineHeight * 0.5;
}
