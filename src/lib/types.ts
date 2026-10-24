/** Marker placed in a first-round slot that has no team. */
export const BYE = '__bye__';

/** Match.round of the third-place race, which sits outside Bracket.rounds. */
export const THIRD_PLACE_ROUND = -1;

/** A bracket slot holds a team id, BYE, or null while it waits for a winner. */
export type SlotValue = string | null;

/** A row on the setup page, as the user typed it. */
export interface Entrant {
  id: string;
  name: string;
  timeText: string;
}

/** A team with a valid time-trial result and its resulting seed (1 = fastest). */
export interface SeededTeam {
  id: string;
  name: string;
  timeMs: number;
  seed: number;
}

export interface Match {
  id: string;
  /** Index into Bracket.rounds, or THIRD_PLACE_ROUND for the third-place race. */
  round: number;
  index: number;
  a: SlotValue;
  b: SlotValue;
  winner: string | null;
}

export interface Bracket {
  /** Number of first-round slots, always a power of 2. */
  size: number;
  teams: Record<string, SeededTeam>;
  /** rounds[0] is the first round; the last round holds only the final. */
  rounds: Match[][];
  /** The semifinal losers race for third place. Null when there are no semifinals. */
  thirdPlace: Match | null;
}

export interface EventInfo {
  title: string;
  subtitle: string;
}

export type Theme = 'dark' | 'light';
export type View = 'setup' | 'standings' | 'bracket' | 'podium';

export interface AppState {
  event: EventInfo;
  entrants: Entrant[];
  bracket: Bracket | null;
  view: View;
  theme: Theme;
  /** First round shown on the bracket view, so early rounds can be hidden. */
  firstRound: number;
}
