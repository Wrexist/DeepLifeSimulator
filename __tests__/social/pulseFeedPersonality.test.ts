import { generateRandomProfilePosts } from '@/lib/social/randomProfiles';
import { contactPostCopy } from '@/lib/social/pulseFeedCopy';
import { generateNpcPostsForFeed } from '@/lib/social/npcPosts';
import { createTestGameState } from '../helpers/createTestGameState';
import type { Relationship } from '@/contexts/game/types';

const contact: Relationship = { id: 'friend', name: 'Alex', type: 'friend', age: 30, gender: 'male', personality: 'creative', relationshipScore: 80 };

afterEach(() => jest.restoreAllMocks());

it('never repeats ambient text within a seven-post feed, even with identical random draws', () => {
  jest.spyOn(Math, 'random').mockReturnValue(0);
  for (let week = 0; week < 52; week++) {
    const posts = generateRandomProfilePosts(week, 7);
    expect(posts).toHaveLength(7);
    expect(new Set(posts.map(p => p.content)).size).toBe(7);
    expect(new Set(posts.map(p => p.id)).size).toBe(7);
  }
});
it('keeps weekly copy stable and varies it across weeks', () => {
  const copy = (week: number) => generateRandomProfilePosts(week, 7).map(p => p.content);
  expect(copy(3)).toEqual(copy(3));
  expect(copy(3)).not.toEqual(copy(4));
});
it('uses recorded calls, hangouts and recent life events, never future or stale events', () => {
  expect(contactPostCopy({ ...contact, actions: { call: 10 } }, 10)).toContain('catch-up call');
  expect(contactPostCopy({ ...contact, actions: { hangout: 9 } }, 10)).toContain('hang out');
  const promoted = { ...contact, lastLifeEvent: { event: 'Alex got a promotion at work!', weeksLived: 10 } };
  expect(contactPostCopy(promoted, 10)).toContain('promotion');
  expect(contactPostCopy(promoted, 9)).not.toContain('promotion');
  expect(contactPostCopy(promoted, 12)).not.toContain('promotion');
  expect(contactPostCopy({ ...contact, actions: { call: 11 } }, 10)).not.toContain('catch-up call');
});
it('uses mood and avoids reusing another contacts copy', () => {
  const sad = { ...contact, npcMood: 'sad' as const };
  const first = contactPostCopy(sad, 5)!;
  expect(first).toContain('quieter week');
  expect(contactPostCopy(sad, 5, new Set([first]))).not.toBe(first);
});
it('does not mutate relationships, recorded posts or player activity', () => {
  const state = createTestGameState({ relationships: [contact], weeksLived: 10 });
  const before = JSON.stringify(state);
  generateNpcPostsForFeed(state, 10, 4);
  expect(JSON.stringify(state)).toBe(before);
});
