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
