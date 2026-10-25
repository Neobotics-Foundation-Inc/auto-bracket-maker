import { useEffect, useLayoutEffect, useState, type DependencyList, type RefObject } from 'react';
import { largestFit, textFits } from '../lib/fit';

/**
 * Shrinks an element's text, from its stylesheet size down to minSize, until it fits without
 * breaking a word: no word wider than the box, and no more lines than its parent's height holds
 * (smaller text gets more lines, through line-clamp). A single word too wide even at minSize is
 * hyphenated, or broken, rather than cut off; a name with too many words for the space ends in
 * an ellipsis. Measured again when `deps` change and once the web fonts have loaded.
 */
export function useFitText(ref: RefObject<HTMLElement | null>, minSize: number, deps: DependencyList) {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => live && setFontsLoaded(true));
    return () => {
      live = false;
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sizing = ['font-size', 'line-clamp', '-webkit-line-clamp'];
    for (const prop of [...sizing, 'overflow-wrap', 'hyphens']) el.style.removeProperty(prop);
    const style = getComputedStyle(el);
    const max = parseFloat(style.fontSize);
    const lineRatio = parseFloat(style.lineHeight) / max || 1;
    const room = el.parentElement?.clientHeight ?? 0;
    const setSize = (size: number) => {
      el.style.setProperty('font-size', `${size}px`);
      if (room) {
        const lines = String(Math.max(1, Math.floor(room / (size * lineRatio))));
        el.style.setProperty('line-clamp', lines);
        el.style.setProperty('-webkit-line-clamp', lines);
      }
    };
    const fitsAt = (size: number) => {
      setSize(size);
      return textFits(el, size * lineRatio);
    };
    if (fitsAt(max)) {
      for (const prop of sizing) el.style.removeProperty(prop);
      return;
    }
    const size = largestFit(fitsAt, max, minSize);
    setSize(size);
    if (el.scrollWidth > el.clientWidth + 1) {
      el.style.setProperty('hyphens', 'auto');
      el.style.setProperty('overflow-wrap', 'anywhere');
    }
  }, [...deps, fontsLoaded, minSize]);
}
