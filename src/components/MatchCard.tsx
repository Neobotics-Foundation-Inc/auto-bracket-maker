import { useRef } from 'react';
import { findMatch, isByeMatch, isPlayable, matchLabel } from '../lib/bracket';
import { CARD_H } from '../lib/layout';
import { formatTime } from '../lib/time';
import { BYE, type Bracket, type Match, type SlotValue } from '../lib/types';
import { useFitText } from './useFitText';

/** Below this, a name is too small to read from the back of a hall. */
const MIN_NAME_SIZE = 12;

/** A team name at the largest size where it fits its half of the card without splitting a word. */
function TeamName({ name, width, present }: { name: string; width: number; present: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useFitText(ref, MIN_NAME_SIZE, [name, width, present]);
  return (
    <span ref={ref} className="name">
      {name}
    </span>
  );
}

interface Props {
  bracket: Bracket;
  /** The seed number to show for each team (tied times share one). */
  seeds: Map<string, number>;
  match: Match;
  x: number;
  y: number;
  /** Card width; wider in present mode. */
  width: number;
  /** Present mode sets larger type, so names are fitted again. */
  present: boolean;
  onPick: (teamId: string) => void;
}

export function MatchCard({ bracket, seeds, match, x, y, width, present, onPick }: Props) {
  const bye = isByeMatch(match);
  const playable = isPlayable(match);
  // Time-trial times explain the seeding, so they only appear in the opening round.
  const showTime = match.section === 'main' && match.round === 0;

  const row = (slot: SlotValue, side: 0 | 1) => {
    if (slot === BYE) return <div className="team team--bye">Bye</div>;
    if (slot === null) {
      // Say where a dropping loser will come from, so the losers bracket reads on its own.
      const source = match.sources[side];
      const from = source?.take === 'loser' ? findMatch(bracket, source.match) : undefined;
      return from ? (
        <div className="team team--source">Loser of {matchLabel(bracket, from)}</div>
      ) : (
        <div className="team team--tbd">TBD</div>
      );
    }

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
        <span className="seed">{seeds.get(slot) ?? team.seed}</span>
        <TeamName name={team.name} width={width} present={present} />
        {showTime && <span className="time">{formatTime(team.timeMs)}</span>}
      </button>
    );
  };

  // The gradient ring turns while a race is ready to run and stops once it's decided; it waits,
  // dimmed, for teams still to come. Byes have none.
  const ring = bye ? '' : match.winner ? 'ring ring--still' : playable ? 'ring' : 'ring ring--idle';

  return (
    <div
      className={`match ${ring} ${bye ? 'match--bye' : ''} ${match.winner && !bye ? 'match--decided' : ''}`}
      style={{ left: x, top: y, width, height: CARD_H }}
    >
      {row(match.a, 0)}
      {row(match.b, 1)}
    </div>
  );
}
