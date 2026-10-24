import { roundName } from './bracket';
import type { Bracket, Match } from './types';

// Kept tight so a 64-slot bracket still scales to a legible size on one 16:9 screen.
export const CARD_W = 232;
export const CARD_H = 76;
export const COL_GAP = 36;
export const ROW_GAP = 10;
export const HEADER_H = 44;
export const CHAMP_W = CARD_W + COL_GAP;
export const CHAMP_H = 156;
const CHAMP_GAP = 28;
// Leaves room for the champion card above the final, even in small brackets.
const MIN_BODY_H = 2 * (CHAMP_H + CHAMP_GAP) + CARD_H;

export interface Box {
  x: number;
  y: number;
}
export interface CardBox extends Box {
  match: Match;
}
export interface Header {
  label: string;
  x: number;
}
export interface Layout {
  width: number;
  height: number;
  cards: CardBox[];
  paths: string[];
  headers: Header[];
  champion: Box;
}

type Side = 'left' | 'right';

/**
 * Positions every match card and connector line.
 * Linear: rounds run left to right with the final last.
 * Mirrored: two halves face a final in the centre, which is half as tall for projectors.
 */
export function layoutBracket(bracket: Bracket, opts: { mirrored: boolean; firstRound: number }): Layout {
  const { rounds, size } = bracket;
  const finalRound = rounds.length - 1;
  const first = Math.min(Math.max(opts.firstRound, 0), finalRound);
  const mirrored = opts.mirrored && first < finalRound;

  // Columns on one side, outermost first. In linear mode the final is the last column.
  const sideRounds: number[] = [];
  for (let r = first; r < (mirrored ? finalRound : finalRound + 1); r++) sideRounds.push(r);

  const outerCount = mirrored ? rounds[first].length / 2 : rounds[first].length;
  const bodyH = Math.max(outerCount * (CARD_H + ROW_GAP), MIN_BODY_H);
  const height = HEADER_H + bodyH;
  const step = CARD_W + COL_GAP;
  const columns = mirrored ? sideRounds.length * 2 + 1 : sideRounds.length;
  const contentW = columns * CARD_W + (columns - 1) * COL_GAP;
  const width = Math.max(contentW, CHAMP_W);
  const offset = (width - contentW) / 2;

  const cards: CardBox[] = [];
  const paths: string[] = [];
  const headers: Header[] = [];
  const centerY = (i: number, count: number) => HEADER_H + ((i + 0.5) * bodyH) / count;

  const placeSide = (side: Side) => {
    const xOf = (col: number) => (side === 'left' ? offset + col * step : offset + contentW - CARD_W - col * step);
    sideRounds.forEach((round, col) => {
      const all = rounds[round];
      const matches = !mirrored ? all : side === 'left' ? all.slice(0, all.length / 2) : all.slice(all.length / 2);
      const x = xOf(col);
      headers.push({ label: roundName(size, round), x });

      matches.forEach((match, i) => {
        const cy = centerY(i, matches.length);
        cards.push({ match, x, y: cy - CARD_H / 2 });

        const isLastCol = col === sideRounds.length - 1;
        if (isLastCol && !mirrored) return;
        // Parent is the next column on this side, or the final in the centre.
        const parentX = isLastCol ? offset + sideRounds.length * step : xOf(col + 1);
        const parentY = isLastCol ? HEADER_H + bodyH / 2 : centerY(i >> 1, matches.length / 2);
        if (side === 'left') {
          const mid = x + CARD_W + COL_GAP / 2;
          paths.push(`M${x + CARD_W} ${cy}H${mid}V${parentY}H${parentX}`);
        } else {
          const mid = x - COL_GAP / 2;
          paths.push(`M${x} ${cy}H${mid}V${parentY}H${parentX + CARD_W}`);
        }
      });
    });
  };

  placeSide('left');
  let finalX: number;
  if (mirrored) {
    placeSide('right');
    finalX = offset + sideRounds.length * step;
    headers.push({ label: roundName(size, finalRound), x: finalX });
    cards.push({ match: rounds[finalRound][0], x: finalX, y: HEADER_H + bodyH / 2 - CARD_H / 2 });
  } else {
    finalX = offset + (sideRounds.length - 1) * step;
  }

  // Champion card sits above the final, centred in mirrored mode and right-aligned in linear mode.
  const champX = mirrored || columns === 1 ? finalX + CARD_W / 2 - CHAMP_W / 2 : finalX + CARD_W - CHAMP_W;
  const champion = {
    x: Math.max(0, champX),
    y: HEADER_H + bodyH / 2 - CARD_H / 2 - CHAMP_GAP - CHAMP_H,
  };

  return { width, height, cards, paths, headers, champion };
}
