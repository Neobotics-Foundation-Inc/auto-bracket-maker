import { useMemo } from 'react';
import { champion } from '../lib/bracket';
import { CARD_W, CHAMP_H, CHAMP_W, HEADER_H, layoutBracket } from '../lib/layout';
import { formatTime } from '../lib/time';
import type { Bracket } from '../lib/types';
import { FitToScreen } from './FitToScreen';
import { MatchCard } from './MatchCard';

interface Props {
  bracket: Bracket;
  firstRound: number;
  present: boolean;
  onPick: (round: number, index: number, teamId: string) => void;
}

export function BracketView({ bracket, firstRound, present, onPick }: Props) {
  const layout = useMemo(
    () => layoutBracket(bracket, { mirrored: present, firstRound }),
    [bracket, present, firstRound],
  );
  const winnerId = champion(bracket);
  const winner = winnerId ? bracket.teams[winnerId] : null;

  return (
    <FitToScreen width={layout.width} height={layout.height} fit={present}>
      <div className="stage" style={{ width: layout.width, height: layout.height }}>
        {layout.headers.map((h, i) => (
          <div key={i} className="round-header" style={{ left: h.x, width: CARD_W, height: HEADER_H }}>
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
            onPick={(teamId) => onPick(match.round, match.index, teamId)}
          />
        ))}
        {winner && (
          <div
            key={winner.id}
            className="champion"
            style={{ left: layout.champion.x, top: layout.champion.y, width: CHAMP_W, height: CHAMP_H }}
          >
            <span className="champion__label">Champion</span>
            <span className="champion__name">{winner.name}</span>
            <span className="champion__meta">
              Seed {winner.seed} · Time trial {formatTime(winner.timeMs)}
            </span>
          </div>
        )}
      </div>
    </FitToScreen>
  );
}
