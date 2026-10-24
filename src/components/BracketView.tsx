import { useMemo } from 'react';
import { CARD_W, HEADER_H, layoutBracket, layoutLosers } from '../lib/layout';
import type { Bracket, BracketPane } from '../lib/types';
import { FitToScreen } from './FitToScreen';
import { MatchCard } from './MatchCard';

interface Props {
  bracket: Bracket;
  pane: BracketPane;
  firstRound: number;
  present: boolean;
  onPick: (matchId: string, teamId: string) => void;
}

export function BracketView({ bracket, pane, firstRound, present, onPick }: Props) {
  const showLosers = pane === 'losers' && bracket.losers.length > 0;
  const layout = useMemo(
    () => (showLosers ? layoutLosers(bracket) : layoutBracket(bracket, { mirrored: present, firstRound })),
    [bracket, showLosers, present, firstRound],
  );

  return (
    <FitToScreen width={layout.width} height={layout.height} fit={present}>
      <div className="stage" style={{ width: layout.width, height: layout.height }}>
        {layout.headers.map((h, i) => (
          <div
            key={i}
            className={`round-header ${h.y ? 'round-header--sub' : ''}`}
            style={{ left: h.x, top: h.y, width: CARD_W, height: h.y ? undefined : HEADER_H }}
          >
            {h.label}
          </div>
        ))}
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
