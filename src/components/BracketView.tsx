import { useMemo } from 'react';
import { CARD_W, HEADER_H, layoutBracket, layoutCombined, layoutGrandFinal, layoutLosers, showsBothBrackets } from '../lib/layout';
import type { Bracket, BracketPane } from '../lib/types';
import { FitToScreen } from './FitToScreen';
import { MatchCard } from './MatchCard';

interface Props {
  bracket: Bracket;
  pane: BracketPane;
  firstRound: number;
  losersFirstRound: number;
  present: boolean;
  onPick: (matchId: string, teamId: string) => void;
}

export function BracketView({ bracket, pane, firstRound, losersFirstRound, present, onPick }: Props) {
  const layout = useMemo(() => {
    if (showsBothBrackets(bracket)) return layoutCombined(bracket);
    // On separate tabs, the winners and losers finals appear only on the grand final tab.
    const tabs = bracket.losers.length > 0;
    if (tabs && pane === 'losers') return layoutLosers(bracket, losersFirstRound, { withoutFinal: true });
    if (tabs && pane === 'grand') return layoutGrandFinal(bracket);
    return layoutBracket(bracket, { mirrored: present, firstRound, withoutFinal: tabs });
  }, [bracket, pane, present, firstRound, losersFirstRound]);

  return (
    // The grand final is a single small picture, so it's always scaled to fill the space.
    <FitToScreen width={layout.width} height={layout.height} fit={present || pane === 'grand'}>
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
              style={{ left: h.x, top: h.y, width: CARD_W, height: h.sub ? undefined : HEADER_H }}
            >
              {h.label}
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
            match={match}
            x={x}
            y={y}
            onPick={(teamId) => onPick(match.id, teamId)}
          />
        ))}
      </div>
    </FitToScreen>
  );
}
