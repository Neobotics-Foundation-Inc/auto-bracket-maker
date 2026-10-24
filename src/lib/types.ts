/** Marker placed in a first-round slot that has no team. */
export const BYE = '__bye__';

/** A bracket slot holds a team id, BYE, or null while it waits for a result. */
export type SlotValue = string | null;

/** A time-trial result as typed into its minute, second and millisecond boxes (digits only). */
export interface TimeParts {
  min: string;
  sec: string;
  ms: string;
}

/** A row on the setup page, as the user typed it. */
export interface Entrant extends TimeParts {
  id: string;
  name: string;
}

/** A team with a valid time-trial result and its resulting seed (1 = fastest). */
export interface SeededTeam {
  id: string;
  name: string;
  timeMs: number;
  seed: number;
}

/**
 * How third place is decided:
 * race   – the semifinal losers race once more;
 * double – double elimination: a losers bracket and a grand final;
 * seed   – the semifinal loser with the faster time trial takes 3rd, with no extra race.
 */
export type ThirdPlaceFormat = 'race' | 'double' | 'seed';

/** main is the (winners) bracket; losers only exists in double elimination. */
export type Section = 'main' | 'losers' | 'third' | 'grand';

/** Where a slot's team comes from: the winner or loser of an earlier match. */
export interface Source {
  match: string;
  take: 'winner' | 'loser';
}

export interface Match {
  id: string;
  section: Section;
  /** Round within its section. */
  round: number;
  index: number;
  /** Filled in from `sources` (or the seeding, in the first round) by resolving the bracket. */
  a: SlotValue;
  b: SlotValue;
  sources: [Source | null, Source | null];
  /** A team, BYE when two byes meet, or null while undecided. */
  winner: SlotValue;
  /** The result the user clicked, kept only while the same two teams are in the match. */
  picked: { winner: string; a: string; b: string } | null;
}

export interface Bracket {
  /** Number of first-round slots, always a power of 2. */
  size: number;
  format: ThirdPlaceFormat;
  teams: Record<string, SeededTeam>;
  /** rounds[0] is the first round; the last round holds only the final (the winners final in double elimination). */
  rounds: Match[][];
  /** Losers bracket rounds, empty unless double elimination. */
  losers: Match[][];
  /** Race format only: the semifinal losers race for third place. */
  thirdPlace: Match | null;
  /** Double elimination only: winners-bracket champion against losers-bracket champion. */
  grandFinal: Match | null;
}

export interface EventInfo {
  title: string;
  subtitle: string;
}

export type Theme = 'dark' | 'light';
export type View = 'setup' | 'standings' | 'bracket' | 'podium';
/** Which part of a double-elimination bracket the bracket view shows, when they don't fit together. */
export type BracketPane = 'winners' | 'losers' | 'grand';

export interface AppState {
  event: EventInfo;
  entrants: Entrant[];
  /** Format for the next bracket generated; the current bracket keeps its own. */
  format: ThirdPlaceFormat;
  bracket: Bracket | null;
  view: View;
  pane: BracketPane;
  theme: Theme;
  /** First round shown on the bracket view, so early rounds can be hidden. */
  firstRound: number;
  /** The same for the losers bracket view. */
  losersFirstRound: number;
}
