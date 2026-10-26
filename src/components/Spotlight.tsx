import { bestOfOf, heatScore, matchLabel, nextHeat, podium } from '../lib/bracket';
import { formatTime } from '../lib/time';
import type { Bracket, Match } from '../lib/types';
import { pairing } from './QueuePanel';

interface Props {
  bracket: Bracket;
  queue: Match[];
  seeds: Map<string, number>;
  onPick: (matchId: string, teamId: string) => void;
}

/**
 * Present mode's view of the race on track, for the hall and a livestream: the two teams large,
 * with the races on deck below. Clicking a team records it as the winner, and the next race comes up;
 * in a best-of-3 match it records a heat won, with the score under each team, until one has 2.
 * The race timer sits in the header, as on the bracket view.
 */
export function Spotlight({ bracket, queue, seeds, onPick }: Props) {
  const [current, ...next] = queue;

  if (!current) {
    const { first } = podium(bracket);
    const champion = first ? bracket.teams[first] : undefined;
    return (
      <div className="spotlight spotlight--done">
        <p className="spotlight__label">{champion ? 'Champion' : 'Waiting for results'}</p>
        {champion && <p className="spotlight__champion">{champion.name}</p>}
      </div>
    );
  }

  const bestOf = bestOfOf(current);
  const score = bestOf > 1 ? heatScore(current) : null;
  const side = (slot: string | null, i: 0 | 1) => {
    const team = slot ? bracket.teams[slot] : undefined;
    if (!team) return null;
    return (
      <button
        className="spotlight__team"
        onClick={() => onPick(current.id, team.id)}
        title={`${team.name}: click to ${score ? 'add a heat win' : 'mark as winner'}`}
      >
        <span className="seed">{seeds.get(team.id) ?? team.seed}</span>
        <span className="spotlight__name">{team.name}</span>
        {score ? (
          <span className="spotlight__score mono" aria-label={`${score[i]} ${score[i] === 1 ? 'heat' : 'heats'} won`}>
            {score[i]}
          </span>
        ) : (
          <span className="spotlight__time mono">Time trial {formatTime(team.timeMs)}</span>
        )}
      </button>
    );
  };

  return (
    <div className="spotlight">
      <p className="spotlight__label">
        {matchLabel(bracket, current)}
        {bestOf > 1 && ` · Heat ${nextHeat(current)} of ${bestOf}`}
      </p>
      <div className="spotlight__pair">
        {side(current.a, 0)}
        <span className="spotlight__vs">vs</span>
        {side(current.b, 1)}
      </div>
      {next.length > 0 && (
        <div className="spotlight__deck">
          <p className="spotlight__deck-title">On deck</p>
          <ol>
            {next.slice(0, 3).map((m) => (
              <li key={m.id}>
                <span className="spotlight__deck-race">{matchLabel(bracket, m)}</span>
                <span>{pairing(bracket, m)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
