/**
 * Who counts as a friend for an event's purposes.
 *
 * `state.relationships` holds EVERYONE: the parents seeded into every new life
 * (and never removed), partners, spouses and children. Events that said "a
 * friend" read the whole list, so early in a life "the friend you lent $50"
 * was your mother, a newborn could invite you to the gym, the parents alone
 * satisfied "your friends throw a surprise party", and the two events written
 * for a player with nobody around them (`friendly_stranger`, `loneliness`)
 * could never fire in a first life.
 */
import type { GameState, Relationship } from '@/contexts/game/types';

/** Relationships of type `friend` - the people a "friend" event is about. */
export function friendsOf(state: Pick<GameState, 'relationships'>): Relationship[] {
  const all = Array.isArray(state.relationships) ? state.relationships : [];
  return all.filter((r) => r?.type === 'friend');
}

/** Friends plus a partner or spouse: the adults a player chose, not family they were born into. */
export function chosenCompanyOf(state: Pick<GameState, 'relationships'>): Relationship[] {
  const all = Array.isArray(state.relationships) ? state.relationships : [];
  return all.filter((r) => r?.type === 'friend' || r?.type === 'partner' || r?.type === 'spouse');
}

/**
 * Children who have NOT yet lived a once-per-child milestone event ("first
 * words", "first steps", "first tooth", "graduating high school").
 *
 * Those templates are not `oncePerLife` - a parent of three should see each
 * child's first steps - so before this the only repeat guard was the 26-week
 * cooldown, and the same toddler said their first word several times across
 * the age band. `eventLog` entries do not carry the child's id, but every one
 * of these templates OPENS its description with the child's name, so the log
 * already records whom each one was about. Matching the name as the leading
 * word (followed by a space or an apostrophe) keeps "Ann" from matching "Anna".
 */
export function childrenAwaitingMilestone<T extends { name?: string }>(
  state: Pick<GameState, 'eventLog'>,
  eventId: string,
  children: readonly T[],
): T[] {
  const log = Array.isArray(state.eventLog) ? state.eventLog : [];
  const lived = log.filter((e) => e && e.id === eventId && typeof e.description === 'string');
  if (lived.length === 0) return [...children];
  return children.filter((c) => {
    const name = typeof c?.name === 'string' ? c.name : '';
    if (!name) return true;
    return !lived.some((e) => e.description.startsWith(`${name} `) || e.description.startsWith(`${name}'`));
  });
}
