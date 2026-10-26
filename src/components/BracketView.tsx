import { useMemo, useState } from 'react';
import {
  CARD_W,
  HEADER_H,
  layoutBracket,
  layoutCombined,
  layoutGrandFinal,
  layoutLosers,
  showsBothBrackets,
  type Layout,
} from '../lib/layout';
import { roundBestOf, sectionRoundName } from '../lib/bracket';
import { shownSeeds } from '../lib/entrants';
import type { BestOf, Bracket, BracketPane, Section } from '../lib/types';
import { FitToScreen, type Box } from './FitToScreen';
import { MatchCard } from './MatchCard';

interface Props {
  bracket: Bracket;
  pane: BracketPane;
  firstRound: number;
  losersFirstRound: number;
  present: boolean;
  onPick: (matchId: string, teamId: string) => void;
  onRoundBestOf: (section: Section, round: number, bestOf: BestOf) => void;
}

// Presenting, the bracket may enlarge this far, and cards widen up to this, to fill the screen.
const PRESENT_MAX_SCALE = 4;
const MAX_CARD_W = 400;

/**
 * The card width at which a layout matches the screen's shape. A bracket that is narrower
 * than the screen (by proportion) gets wider cards: the same height, so the same scale, but
 * room for larger, untruncated names. Width grows in step with card width, so two trial
 * layouts give the exact answer.
 */
export function fillingCardWidth(layoutAt: (cardW: number) => Layout, box: Box): number {
  const base = layoutAt(CARD_W);
  const perPixel = (layoutAt(CARD_W + 100).width - base.width) / 100;
  const wanted = (box.w / box.h) * base.height - base.width;
  if (wanted <= 0 || perPixel <= 0) return CARD_W;
  return Math.min(CARD_W + wanted / perPixel, MAX_CARD_W);
}

/**
 * A round's heats under its name: a button switching between a single heat and best of 3 while
 * editing, and a plain "Best of 3" when presenting (nothing for single heats).
 */
function HeatsChip(props: {
  bracket: Bracket;
  section: Section;
  round: number;
  present: boolean;
  onChange: (section: Section, round: number, bestOf: BestOf) => void;
}) {
  const { bracket, section, round } = props;
  const bestOf = roundBestOf(bracket, section, round);
  const text = bestOf === 1 ? '1 heat' : `Best of ${bestOf}`;
  if (props.present) return bestOf > 1 ? <span className="heats-chip heats-chip--on">{text}</span> : null;
  const name = sectionRoundName(bracket, section, round);
  return (
    <button
      className={`heats-chip ${bestOf > 1 ? 'heats-chip--on' : ''}`}
      onClick={() => props.onChange(section, round, bestOf === 1 ? 3 : 1)}
      title={`${name}: ${bestOf === 1 ? 'a single heat per race' : `best of ${bestOf} heats`}. Click to switch to ${bestOf === 1 ? 'best of 3' : 'a single heat'}; races already under way keep theirs.`}
    >
      {text}
    </button>
  );
}

export function BracketView({ bracket, pane, firstRound, losersFirstRound, present, onPick, onRoundBestOf }: Props) {
  const [box, setBox] = useState<Box | null>(null);
  const seeds = useMemo(() => shownSeeds(Object.values(bracket.teams)), [bracket.teams]);
  // The grand final is a single small picture, so it's always scaled to fill the space.
  const fit = present || pane === 'grand';

  const layout = useMemo(() => {
    const layoutAt = (cardW: number) => {
      if (showsBothBrackets(bracket)) return layoutCombined(bracket, cardW);
      // On separate tabs, the winners and losers finals appear only on the grand final tab.
      const tabs = bracket.losers.length > 0;
      if (tabs && pane === 'losers') return layoutLosers(bracket, losersFirstRound, { withoutFinal: true, cardW });
      if (tabs && pane === 'grand') return layoutGrandFinal(bracket, cardW);
      return layoutBracket(bracket, { mirrored: present, firstRound, withoutFinal: tabs, cardW });
    };
    return layoutAt(present && box?.w && box.h ? fillingCardWidth(layoutAt, box) : CARD_W);
  }, [bracket, pane, present, firstRound, losersFirstRound, box]);

  return (
    <FitToScreen
      width={layout.width}
      height={layout.height}
      fit={fit}
      maxScale={present ? PRESENT_MAX_SCALE : undefined}
      onBox={setBox}
    >
      <div className="stage" style={{ width: layout.width, height: layout.height }}>
        {layout.headers.map((h, i) =>
          h.section ? (
            <div key={i} className="section-header" style={{ left: h.x, top: h.y }}>
              {h.label}
            </div>
          ) : (
            <div
              key={i}
              className={`round-header ${h.sub ? 'round-header--sub' : ''}`}
              style={{ left: h.x, top: h.y, width: layout.cardW, height: h.sub ? undefined : HEADER_H }}
            >
              <span>{h.label}</span>
              {h.round && <HeatsChip bracket={bracket} {...h.round} present={present} onChange={onRoundBestOf} />}
            </div>
          ),
        )}
        <svg className="connectors" width={layout.width} height={layout.height} aria-hidden>
          {layout.paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>
        {layout.cards.map(({ match, x, y }) => (
          <MatchCard
            key={match.id}
            bracket={bracket}
            seeds={seeds}
            match={match}
            x={x}
            y={y}
            width={layout.cardW}
            present={present}
            onPick={(teamId) => onPick(match.id, teamId)}
          />
        ))}
      </div>
    </FitToScreen>
  );
}
