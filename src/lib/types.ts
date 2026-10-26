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

/**
 * What a car must pass before it may race, under the Roboracer rules: arriving (on-site check-in)
 * and the referees' hardware inspection.
 */
export interface Checks {
  checkedIn: boolean;
  inspected: boolean;
}

/** A row on the setup page, as the user typed it. */
export interface Entrant extends TimeParts {
  id: string;
  name: string;
  /** Only used when eligibility checks are on; missing means nothing passed yet. */
  checks?: Checks;
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
  /**
   * The result the user clicked, kept only while the same two teams are in the match. In a
   * best-of-3 match it follows from `heats`.
   */
  picked: { winner: string; a: string; b: string } | null;
  /** Heats to race: 1, or best of 3. Missing (brackets saved before heats existed) means 1. */
  bestOf?: BestOf;
  /** Best of 3 only: heats won by slots a and b, kept only while the same two teams are in the match. */
  heats?: { a: string; b: string; wins: [number, number] } | null;
}

/** A single heat, or best of 3 heats (first to win 2). */
export type BestOf = 1 | 3;

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
  /**
   * Double elimination only: the extra heat the rules give when the losers-bracket champion wins
   * the grand final, so the winners-bracket champion has lost only once. It has no teams unless
   * that happens. Missing from brackets saved before it existed, until they're migrated.
   */
  grandExtra?: Match | null;
  /**
   * Each round's heats, by round key ("main:0", "losers:2", "grand:0"). Missing rounds, and brackets
   * saved before heats existed, are single heats.
   */
  roundBestOf?: Record<string, BestOf>;
}

export interface EventInfo {
  title: string;
  subtitle: string;
}

export type Theme = 'dark' | 'light';
/** Spotlight (the current race, large) is shown in present mode only. */
export type View = 'customize' | 'setup' | 'standings' | 'bracket' | 'podium' | 'spotlight';
/** Which part of a double-elimination bracket the bracket view shows, when they don't fit together. */
export type BracketPane = 'winners' | 'losers' | 'grand';

export interface AppState {
  event: EventInfo;
  entrants: Entrant[];
  /** Format for the next bracket generated; the current bracket keeps its own. */
  format: ThirdPlaceFormat;
  /** Heats per race for the next bracket generated; its rounds can then be changed one by one. */
  bestOf: BestOf;
  bracket: Bracket | null;
  view: View;
  pane: BracketPane;
  theme: Theme;
  /** First round shown on the bracket view, so early rounds can be hidden. */
  firstRound: number;
  /** The same for the losers bracket view. */
  losersFirstRound: number;
  /** The race countdown on the bracket view. */
  timer: RaceTimer;
  /** Whether teams must be checked in and inspected to be seeded. */
  requireChecks: boolean;
  /** Race ids in the order they're to be run, where the organizers have moved races. */
  queueOrder: string[];
  /** How long each race takes on the day, heat and changeover, for estimated times. */
  slotMs: number;
}

/**
 * A race countdown. Idle shows the full duration; running counts down to `endsAt`; paused
 * holds what was left. Times are kept as moments, not ticks, so a refresh or a background
 * tab doesn't lose time.
 */
export interface RaceTimer {
  durationMs: number;
  /** When a running countdown reaches zero (epoch ms), or null when not running. */
  endsAt: number | null;
  /** Time left when paused, or null when not paused. */
  pausedMs: number | null;
}
