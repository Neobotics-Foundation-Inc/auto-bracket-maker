import { sectionRoundName } from './bracket';
import type { Bracket, Match } from './types';

// Kept tight so a 64-slot bracket still scales to a legible size on one 16:9 screen.
export const CARD_W = 232;
export const CARD_H = 76;
export const COL_GAP = 36;
export const ROW_GAP = 10;
export const HEADER_H = 44;
// Space between the final and the race below it (third place or grand final), including its label.
const EXTRA_GAP = 64;
const EXTRA_LABEL_H = 28;
// Leaves room for that race under the final, even in small brackets.
const MIN_BODY_H = 2 * (CARD_H / 2 + EXTRA_GAP + CARD_H) + ROW_GAP;

export interface Box {
  x: number;
  y: number;
}
export interface CardBox extends Box {
  match: Match;
}
export interface Header extends Box {
  label: string;
  /** A title over a whole bracket ("Winners bracket") rather than a round. */
  section?: boolean;
  /** A small label over a single race below the final ("Third place"). */
  sub?: boolean;
}
export interface Layout {
  width: number;
  height: number;
  cards: CardBox[];
  paths: string[];
  headers: Header[];
}

type Side = 'left' | 'right';

const elbow = (fromX: number, fromY: number, toX: number, toY: number) => {
  const mid = fromX + (toX > fromX ? COL_GAP / 2 : -COL_GAP / 2);
  return `M${fromX} ${fromY}H${mid}V${toY}H${toX}`;
};

/**
 * Positions the main (winners) bracket's cards and connector lines.
 * Linear: rounds run left to right with the final last.
 * Mirrored: two halves face a final in the centre, which is half as tall for projectors.
 * The third-place race or grand final sits under the final.
 */
export function layoutBracket(
  bracket: Bracket,
  opts: { mirrored: boolean; firstRound: number; withExtra?: boolean },
): Layout {
  const { rounds } = bracket;
  const finalRound = rounds.length - 1;
  const first = Math.min(Math.max(opts.firstRound, 0), finalRound);
  const mirrored = opts.mirrored && first < finalRound;
  const extra = opts.withExtra === false ? null : (bracket.thirdPlace ?? bracket.grandFinal);

  // Columns on one side, outermost first. In linear mode the final is the last column.
  const sideRounds: number[] = [];
  for (let r = first; r < (mirrored ? finalRound : finalRound + 1); r++) sideRounds.push(r);

  const outerCount = mirrored ? rounds[first].length / 2 : rounds[first].length;
  const bodyH = Math.max(outerCount * (CARD_H + ROW_GAP), extra ? MIN_BODY_H : 0);
  const height = HEADER_H + bodyH;
  const step = CARD_W + COL_GAP;
  const columns = mirrored ? sideRounds.length * 2 + 1 : sideRounds.length;
  const width = columns * CARD_W + (columns - 1) * COL_GAP;

  const cards: CardBox[] = [];
  const paths: string[] = [];
  const headers: Header[] = [];
  const centerY = (i: number, count: number) => HEADER_H + ((i + 0.5) * bodyH) / count;

  const placeSide = (side: Side) => {
    const xOf = (col: number) => (side === 'left' ? col * step : width - CARD_W - col * step);
    sideRounds.forEach((round, col) => {
      const all = rounds[round];
      const matches = !mirrored ? all : side === 'left' ? all.slice(0, all.length / 2) : all.slice(all.length / 2);
      const x = xOf(col);
      headers.push({ label: sectionRoundName(bracket, 'main', round), x, y: 0 });

      matches.forEach((match, i) => {
        const cy = centerY(i, matches.length);
        cards.push({ match, x, y: cy - CARD_H / 2 });

        const isLastCol = col === sideRounds.length - 1;
        if (isLastCol && !mirrored) return;
        // Parent is the next column on this side, or the final in the centre.
        const parentX = isLastCol ? sideRounds.length * step : xOf(col + 1);
        const parentY = isLastCol ? HEADER_H + bodyH / 2 : centerY(i >> 1, matches.length / 2);
        paths.push(side === 'left' ? elbow(x + CARD_W, cy, parentX, parentY) : elbow(x, cy, parentX + CARD_W, parentY));
      });
    });
  };

  placeSide('left');
  const finalY = HEADER_H + bodyH / 2 - CARD_H / 2;
  let finalX: number;
  if (mirrored) {
    placeSide('right');
    finalX = sideRounds.length * step;
    headers.push({ label: sectionRoundName(bracket, 'main', finalRound), x: finalX, y: 0 });
    cards.push({ match: rounds[finalRound][0], x: finalX, y: finalY });
  } else {
    finalX = (sideRounds.length - 1) * step;
  }

  if (extra) {
    const y = finalY + CARD_H + EXTRA_GAP;
    headers.push({ label: sectionRoundName(bracket, extra.section, 0), x: finalX, y: y - EXTRA_LABEL_H, sub: true });
    cards.push({ match: extra, x: finalX, y });
  }

  return { width, height, cards, paths, headers };
}

/**
 * Positions the losers bracket, left to right. A round the same size as the one before
 * takes in teams dropping from the winners bracket (one line in per match); a round half
 * the size pairs off the previous winners (two lines in). The grand final comes last.
 */
export function layoutLosers(bracket: Bracket): Layout {
  const columns = bracket.grandFinal ? [...bracket.losers, [bracket.grandFinal]] : bracket.losers;
  const step = CARD_W + COL_GAP;
  const bodyH = Math.max(...columns.map((c) => c.length)) * (CARD_H + ROW_GAP);
  const width = columns.length * CARD_W + (columns.length - 1) * COL_GAP;

  const cards: CardBox[] = [];
  const paths: string[] = [];
  const headers: Header[] = [];
  let prevY: number[] = [];

  columns.forEach((matches, col) => {
    const x = col * step;
    const match0 = matches[0];
    headers.push({ label: sectionRoundName(bracket, match0.section, match0.round), x, y: 0 });
    const ys = matches.map((_, i) => {
      if (col === 0) return HEADER_H + ((i + 0.5) * bodyH) / matches.length;
      // Same size: straight across. Half the size: between the two matches feeding it.
      return matches.length === prevY.length ? prevY[i] : (prevY[2 * i] + prevY[2 * i + 1]) / 2;
    });
    ys.forEach((cy, i) => {
      cards.push({ match: matches[i], x, y: cy - CARD_H / 2 });
      if (col === 0) return;
      const fromX = x - COL_GAP;
      const feeders = matches.length === prevY.length ? [prevY[i]] : [prevY[2 * i], prevY[2 * i + 1]];
      for (const fy of feeders) paths.push(elbow(fromX, fy, x, cy));
    });
    prevY = ys;
  });

  return { width, height: HEADER_H + bodyH, cards, paths, headers };
}

/** Double-elimination brackets up to this size fit both halves on one screen. */
const COMBINED_MAX_SIZE = 16;
const SECTION_H = 40;
const SECTION_GAP = 48;

export const showsBothBrackets = (bracket: Bracket) =>
  bracket.losers.length > 0 && bracket.size <= COMBINED_MAX_SIZE;

const shiftPath = (d: string, dy: number) =>
  d.replace(/M(\S+) (\S+?)(?=[HV])/, (_, x, y) => `M${x} ${Number(y) + dy}`).replace(/V([\d.]+)/g, (_, y) => `V${Number(y) + dy}`);

function shift(layout: Layout, dy: number): Layout {
  return {
    ...layout,
    cards: layout.cards.map((c) => ({ ...c, y: c.y + dy })),
    headers: layout.headers.map((h) => ({ ...h, y: h.y + dy })),
    paths: layout.paths.map((d) => shiftPath(d, dy)),
  };
}

/**
 * Winners bracket on top and losers bracket underneath, for smaller double-elimination
 * events. The grand final ends the losers row, with a line in from the winners final.
 */
export function layoutCombined(bracket: Bracket): Layout {
  const winners = shift(layoutBracket(bracket, { mirrored: false, firstRound: 0, withExtra: false }), SECTION_H);
  const losersTop = winners.height + SECTION_H + SECTION_GAP;
  const losers = shift(layoutLosers(bracket), losersTop + SECTION_H);

  const final = winners.cards.find((c) => c.match.section === 'main' && c.match.round === bracket.rounds.length - 1)!;
  const grand = losers.cards.find((c) => c.match.section === 'grand')!;
  // Around the right of the grand final, so the line doesn't cross the losers bracket's headings.
  const laneX = grand.x + CARD_W + COL_GAP / 2;
  const toFinal = `M${final.x + CARD_W} ${final.y + CARD_H / 2}H${laneX}V${grand.y + CARD_H / 2}H${grand.x + CARD_W}`;

  return {
    width: Math.max(winners.width, losers.width) + COL_GAP / 2,
    height: losersTop + SECTION_H + losers.height,
    cards: [...winners.cards, ...losers.cards],
    paths: [...winners.paths, ...losers.paths, toFinal],
    headers: [
      { label: 'Winners bracket', x: 0, y: 0, section: true },
      ...winners.headers,
      { label: 'Losers bracket', x: 0, y: losersTop, section: true },
      ...losers.headers,
    ],
  };
}
