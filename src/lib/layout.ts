import { extraHeatNeeded, sectionRoundName, showsExtraHeat } from './bracket';
import type { Bracket, Match, Section } from './types';

// Kept tight so a 64-slot bracket still scales to a legible size on one 16:9 screen.
// Present mode widens cards (every layout takes `cardW`) to fill the projected screen.
export const CARD_W = 232;
// Tall enough for three lines of name per team, so long names wrap instead of being cut off.
export const CARD_H = 112;
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
  /** The round it heads, for its heats setting. Not on section titles or the extra heat. */
  round?: { section: Section; round: number };
}
export interface Layout {
  width: number;
  height: number;
  cards: CardBox[];
  paths: string[];
  headers: Header[];
  /** Width of every card in this layout. */
  cardW: number;
}

type Side = 'left' | 'right';

const elbow = (fromX: number, fromY: number, toX: number, toY: number) => {
  const mid = fromX + (toX > fromX ? COL_GAP / 2 : -COL_GAP / 2);
  return `M${fromX} ${fromY}H${mid}V${toY}H${toX}`;
};

/**
 * Positions the main (winners) bracket's cards and connector lines.
 * Linear: rounds run left to right with the final last.
 * Mirrored: two halves face a final in the center, which is half as tall for projectors.
 * The third-place race, if any, sits under the final. With `withoutFinal` the bracket
 * stops at the semifinals (the final is shown elsewhere), and mirrored halves face each
 * other with nothing in between.
 */
export function layoutBracket(
  bracket: Bracket,
  opts: { mirrored: boolean; firstRound: number; withoutFinal?: boolean; cardW?: number },
): Layout {
  const cw = opts.cardW ?? CARD_W;
  const { rounds } = bracket;
  const finalRound = rounds.length - 1;
  const centerFinal = !opts.withoutFinal;
  const lastRound = centerFinal ? finalRound : finalRound - 1;
  const first = Math.min(Math.max(opts.firstRound, 0), lastRound);
  const mirrored = opts.mirrored && (centerFinal ? first < finalRound : true);
  const extra = centerFinal ? bracket.thirdPlace : null;

  // Columns on one side, outermost first. In linear mode the final is the last column.
  const sideRounds: number[] = [];
  for (let r = first; r < (mirrored && centerFinal ? finalRound : lastRound + 1); r++) sideRounds.push(r);

  const outerCount = mirrored ? rounds[first].length / 2 : rounds[first].length;
  const bodyH = Math.max(outerCount * (CARD_H + ROW_GAP), extra ? MIN_BODY_H : 0);
  const height = HEADER_H + bodyH;
  const step = cw + COL_GAP;
  const columns = mirrored ? sideRounds.length * 2 + (centerFinal ? 1 : 0) : sideRounds.length;
  const width = columns * cw + (columns - 1) * COL_GAP;

  const cards: CardBox[] = [];
  const paths: string[] = [];
  const headers: Header[] = [];
  const centerY = (i: number, count: number) => HEADER_H + ((i + 0.5) * bodyH) / count;

  const placeSide = (side: Side) => {
    const xOf = (col: number) => (side === 'left' ? col * step : width - cw - col * step);
    sideRounds.forEach((round, col) => {
      const all = rounds[round];
      const matches = !mirrored ? all : side === 'left' ? all.slice(0, all.length / 2) : all.slice(all.length / 2);
      const x = xOf(col);
      headers.push({ label: sectionRoundName(bracket, 'main', round), x, y: 0, round: { section: 'main', round } });

      matches.forEach((match, i) => {
        const cy = centerY(i, matches.length);
        cards.push({ match, x, y: cy - CARD_H / 2 });

        const isLastCol = col === sideRounds.length - 1;
        if (isLastCol && !(mirrored && centerFinal)) return;
        // Parent is the next column on this side, or the final in the center.
        const parentX = isLastCol ? sideRounds.length * step : xOf(col + 1);
        const parentY = isLastCol ? HEADER_H + bodyH / 2 : centerY(i >> 1, matches.length / 2);
        paths.push(side === 'left' ? elbow(x + cw, cy, parentX, parentY) : elbow(x, cy, parentX + cw, parentY));
      });
    });
  };

  placeSide('left');
  const finalY = HEADER_H + bodyH / 2 - CARD_H / 2;
  let finalX: number;
  if (mirrored) placeSide('right');
  if (mirrored && centerFinal) {
    finalX = sideRounds.length * step;
    headers.push({ label: sectionRoundName(bracket, 'main', finalRound), x: finalX, y: 0, round: { section: 'main', round: finalRound } });
    cards.push({ match: rounds[finalRound][0], x: finalX, y: finalY });
  } else {
    finalX = (sideRounds.length - 1) * step;
  }

  if (extra) {
    const y = finalY + CARD_H + EXTRA_GAP;
    headers.push({
      label: sectionRoundName(bracket, extra.section, 0),
      x: finalX,
      y: y - EXTRA_LABEL_H,
      sub: true,
      round: { section: extra.section, round: 0 },
    });
    cards.push({ match: extra, x: finalX, y });
  }

  return { width, height, cards, paths, headers, cardW: cw };
}

/**
 * Positions the losers bracket, left to right. A round the same size as the one before
 * takes in teams dropping from the winners bracket (one line in per match); a round half
 * the size pairs off the previous winners (two lines in). Rounds before `firstRound` are
 * hidden, and with `withoutFinal` so is the losers final (shown elsewhere).
 */
export function layoutLosers(bracket: Bracket, firstRound = 0, { withoutFinal = false, cardW: cw = CARD_W } = {}): Layout {
  const shown = withoutFinal ? bracket.losers.slice(0, -1) : bracket.losers;
  const columns = shown.slice(Math.min(Math.max(firstRound, 0), shown.length - 1));
  const step = cw + COL_GAP;
  const bodyH = Math.max(...columns.map((c) => c.length)) * (CARD_H + ROW_GAP);
  const width = columns.length * cw + (columns.length - 1) * COL_GAP;

  const cards: CardBox[] = [];
  const paths: string[] = [];
  const headers: Header[] = [];
  let prevY: number[] = [];

  columns.forEach((matches, col) => {
    const x = col * step;
    const match0 = matches[0];
    headers.push({
      label: sectionRoundName(bracket, match0.section, match0.round),
      x,
      y: 0,
      round: { section: match0.section, round: match0.round },
    });
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

  return { width, height: HEADER_H + bodyH, cards, paths, headers, cardW: cw };
}

/** Double-elimination brackets up to this size fit both halves on one screen. */
const COMBINED_MAX_SIZE = 16;
const SECTION_H = 40;
// Space above and below the grand final, which sits between the two brackets.
const GRAND_PAD = 28;

export const showsBothBrackets = (bracket: Bracket) =>
  bracket.losers.length > 0 && bracket.size <= COMBINED_MAX_SIZE;

/**
 * The extra grand-final heat, one column right of the grand final with a line across, while
 * it's shown: labeled "if needed" until the grand final is decided. Nothing once it isn't.
 */
function extraHeat(bracket: Bracket, grandX: number, grandY: number, labelY: number, cw: number) {
  if (!showsExtraHeat(bracket)) return { cards: [], paths: [], headers: [], width: 0 };
  const x = grandX + cw + COL_GAP;
  const cy = grandY + CARD_H / 2;
  return {
    cards: [{ match: bracket.grandExtra!, x, y: grandY }],
    paths: [`M${grandX + cw} ${cy}H${x}`],
    headers: [{ label: extraHeatNeeded(bracket) ? 'Extra heat' : 'Extra heat, if needed', x, y: labelY, sub: true }],
    width: COL_GAP + cw,
  };
}

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
 * events. The grand final sits between the two, past their last rounds, with a line in
 * from the winners final above and the losers final below.
 */
export function layoutCombined(bracket: Bracket, cw = CARD_W): Layout {
  const winners = shift(layoutBracket(bracket, { mirrored: false, firstRound: 0, cardW: cw }), SECTION_H);
  const grandLabelY = SECTION_H + winners.height + GRAND_PAD;
  const grandY = grandLabelY + EXTRA_LABEL_H;
  const losersTop = grandY + CARD_H + GRAND_PAD;
  const losers = shift(layoutLosers(bracket, 0, { cardW: cw }), losersTop + SECTION_H);
  const grandX = Math.max(winners.width, losers.width) + COL_GAP;
  const grandCy = grandY + CARD_H / 2;

  const lastCard = (cards: CardBox[], section: 'main' | 'losers', round: number) =>
    cards.find((c) => c.match.section === section && c.match.round === round)!;
  const final = lastCard(winners.cards, 'main', bracket.rounds.length - 1);
  const losersFinal = lastCard(losers.cards, 'losers', bracket.losers.length - 1);
  const into = (from: CardBox) => elbow(from.x + cw, from.y + CARD_H / 2, grandX, grandCy);
  const extra = extraHeat(bracket, grandX, grandY, grandLabelY, cw);

  return {
    width: grandX + cw + extra.width,
    height: losersTop + SECTION_H + losers.height,
    cardW: cw,
    cards: [...winners.cards, { match: bracket.grandFinal!, x: grandX, y: grandY }, ...extra.cards, ...losers.cards],
    paths: [...winners.paths, ...losers.paths, into(final), into(losersFinal), ...extra.paths],
    headers: [
      { label: 'Winners bracket', x: 0, y: 0, section: true },
      ...winners.headers,
      { label: sectionRoundName(bracket, 'grand', 0), x: grandX, y: grandLabelY, sub: true, round: { section: 'grand', round: 0 } },
      ...extra.headers,
      { label: 'Losers bracket', x: 0, y: losersTop, section: true },
      ...losers.headers,
    ],
  };
}

const FINALS_GAP = 56;

/**
 * The grand final on its own: the winners final above and the losers final below on the
 * left, both feeding the grand final on the right.
 */
export function layoutGrandFinal(bracket: Bracket, cw = CARD_W): Layout {
  const winnersFinal = bracket.rounds[bracket.rounds.length - 1][0];
  const losersFinal = bracket.losers[bracket.losers.length - 1][0];
  const topY = EXTRA_LABEL_H;
  const bottomY = topY + CARD_H + FINALS_GAP + EXTRA_LABEL_H;
  const grandX = cw + 2 * COL_GAP;
  const grandY = (topY + bottomY) / 2;
  const grandCy = grandY + CARD_H / 2;
  const label = (match: Match, x: number, y: number): Header => ({
    label: sectionRoundName(bracket, match.section, match.round),
    x,
    y: y - EXTRA_LABEL_H,
    sub: true,
    round: { section: match.section, round: match.round },
  });
  const extra = extraHeat(bracket, grandX, grandY, grandY - EXTRA_LABEL_H, cw);

  return {
    width: grandX + cw + extra.width,
    height: bottomY + CARD_H,
    cardW: cw,
    cards: [
      { match: winnersFinal, x: 0, y: topY },
      { match: losersFinal, x: 0, y: bottomY },
      { match: bracket.grandFinal!, x: grandX, y: grandY },
      ...extra.cards,
    ],
    paths: [...[topY, bottomY].map((y) => `M${cw} ${y + CARD_H / 2}H${cw + COL_GAP}V${grandCy}H${grandX}`), ...extra.paths],
    headers: [
      label(winnersFinal, 0, topY),
      label(losersFinal, 0, bottomY),
      label(bracket.grandFinal!, grandX, grandY),
      ...extra.headers,
    ],
  };
}
