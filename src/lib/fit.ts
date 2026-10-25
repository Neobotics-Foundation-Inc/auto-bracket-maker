/** The largest whole font size from max down to min at which `fits` holds, or min if none does. */
export function largestFit(fits: (size: number) => boolean, max: number, min: number): number {
  for (let size = Math.floor(max); size > min; size--) {
    if (fits(size)) return size;
  }
  return min;
}

export interface TextBox {
  /** The text's exact width (from a Range), and the box's: fractional, unlike scrollWidth,
   *  whose rounding let text a pixel or two too wide pass, its last letter clipped. */
  textWidth: number;
  boxWidth: number;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * Whether text fits its box: no wider at all (a word too long for a line), and no taller by a
 * line or more (more lines than the box shows). Glyphs poke a pixel or two past tight line
 * boxes, so height only counts as overflowing by most of a line.
 */
export function textFits(box: TextBox, lineHeight: number): boolean {
  return box.textWidth <= box.boxWidth + 0.01 && box.scrollHeight <= box.clientHeight + lineHeight * 0.5;
}
