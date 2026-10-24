import { isByeMatch, isPlayable } from '../lib/bracket';
import { CARD_H, CARD_W } from '../lib/layout';
import { formatTime } from '../lib/time';
import { BYE, type Bracket, type Match, type SlotValue } from '../lib/types';

interface Props {
  bracket: Bracket;
  match: Match;
  x: number;
  y: number;
  onPick: (teamId: string) => void;
}

export function MatchCard({ bracket, match, x, y, onPick }: Props) {
  const bye = isByeMatch(match);
  const playable = isPlayable(match);

  const row = (slot: SlotValue) => {
    if (slot === BYE) return <div className="team team--bye">Bye</div>;
    if (slot === null) return <div className="team team--tbd">TBD</div>;

    const team = bracket.teams[slot];
    const state = !match.winner || bye ? '' : match.winner === slot ? 'team--winner' : 'team--loser';
    return (
      // Keyed by team so a newly advanced team animates in.
      <button
        key={slot}
        className={`team ${state}`}
        disabled={!playable}
        aria-pressed={match.winner === slot}
        title={playable ? `${team.name}: click to ${match.winner === slot ? 'undo the result' : 'mark as winner'}` : team.name}
        onClick={() => onPick(slot)}
      >
        <span className="seed">{team.seed}</span>
        <span className="name">{team.name}</span>
        <span className="time">{formatTime(team.timeMs)}</span>
      </button>
    );
  };

  return (
    <div
      className={`match ${bye ? 'match--bye' : ''} ${match.winner && !bye ? 'match--decided' : ''}`}
      style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
    >
      {row(match.a)}
      {row(match.b)}
    </div>
  );
}
