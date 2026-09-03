/**
 * Week-ahead ("anticipation") types.
 *
 * Like the goal engine this is a PURE read over `GameState` — it stores
 * nothing and grants nothing. Everything it reports is already scheduled by
 * some other system; this only makes it VISIBLE before it happens.
 */

/** Coarse tone, so the UI can colour without re-deriving meaning. */
export type UpcomingTone = 'good' | 'neutral' | 'caution';

export type UpcomingKind =
  | 'education'
  | 'birth'
  | 'wedding'
  | 'loan'
  | 'debt'
  | 'health'
  | 'savings'
  | 'career'
  | 'election'
  | 'letter'
  | 'jobs';

export interface UpcomingEvent {
  /**
   * Stable within a state — derived from the kind plus the underlying record's
   * id, never from an index, so a React key survives one item resolving.
   */
  id: string;
  kind: UpcomingKind;
  tone: UpcomingTone;
  title: string;
  /** One line of detail; may name a number or a person. */
  detail: string;
  /**
   * Weeks from now until it lands. 0 means "this coming week". Always ≥ 0 —
   * anything already past is not upcoming and is filtered out at source.
   */
  weeksAway: number;
  /** `weeksLived` the event is expected on. */
  dueWeeksLived: number;
}
