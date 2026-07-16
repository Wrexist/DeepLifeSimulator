/**
 * Spark → Pulse bridge — pure payload generation + the auto-post gate.
 *
 * The bridge translates a relationship milestone into the exact args shape
 * `composePost` consumes, and `shouldAutoPostMilestone` decides whether to post
 * at all (never surprise a player who has never used Pulse).
 */
import {
  milestoneToPulsePost,
  shouldAutoPostMilestone,
  type SparkMilestone,
} from '@/lib/dating/sparkPulseBridge';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

describe('milestoneToPulsePost', () => {
  it('builds a lifestyle engagement post (photo) mentioning the partner + ring', () => {
    const args = milestoneToPulsePost({ kind: 'engagement', partnerName: 'Maya', ringTier: 'Platinum Halo' });
    expect(args).not.toBeNull();
    expect(args!.category).toBe('lifestyle');
    expect(args!.contentType).toBe('photo');
    expect(args!.content).toContain('Maya');
    expect(args!.content).toContain('Platinum Halo');
    expect(args!.hashtags).toContain('#engaged');
  });

  it('builds a wedding post naming the venue', () => {
    const args = milestoneToPulsePost({ kind: 'wedding', partnerName: 'Sam', venue: 'The Grand Hall' });
    expect(args!.content).toContain('Sam');
    expect(args!.content).toContain('The Grand Hall');
    expect(args!.hashtags).toContain('#married');
  });

  it('builds a divorce post (text)', () => {
    const args = milestoneToPulsePost({ kind: 'divorce', partnerName: 'Alex' });
    expect(args!.contentType).toBe('text');
    expect(args!.content).toContain('Alex');
    expect(args!.hashtags).toContain('#divorce');
  });

  it('builds an anniversary post with correct pluralization', () => {
    expect(milestoneToPulsePost({ kind: 'anniversary', partnerName: 'Jo', yearsMarried: 1 })!.content)
      .toContain('1 year with Jo');
    expect(milestoneToPulsePost({ kind: 'anniversary', partnerName: 'Jo', yearsMarried: 5 })!.content)
      .toContain('5 years with Jo');
  });

  it('covers every milestone kind without returning null', () => {
    const kinds: SparkMilestone[] = [
      { kind: 'engagement', partnerName: 'A' },
      { kind: 'wedding', partnerName: 'A' },
      { kind: 'divorce', partnerName: 'A' },
      { kind: 'anniversary', partnerName: 'A', yearsMarried: 2 },
      { kind: 'new_baby', partnerName: 'A', childGender: 'female', childName: 'Rae' },
      { kind: 'breakup', partnerName: 'A' },
    ];
    for (const m of kinds) {
      const args = milestoneToPulsePost(m);
      expect(args).not.toBeNull();
      expect(args!.content.length).toBeGreaterThan(0);
      expect(args!.category).toBe('lifestyle');
    }
  });
});

describe('shouldAutoPostMilestone', () => {
  function withSocial(patch: Partial<NonNullable<GameState['socialMedia']>> | undefined): GameState {
    const s = createTestGameState({ weeksLived: 1 });
    s.socialMedia = patch === undefined ? undefined : { ...s.socialMedia!, ...patch };
    return s;
  }

  it('is false when the player has no Pulse account', () => {
    expect(shouldAutoPostMilestone(withSocial(undefined))).toBe(false);
  });

  it('is false when the player has never posted (totalPosts === 0)', () => {
    expect(shouldAutoPostMilestone(withSocial({ totalPosts: 0 }))).toBe(false);
  });

  it('is true once the player has posted before', () => {
    expect(shouldAutoPostMilestone(withSocial({ totalPosts: 3 }))).toBe(true);
  });
});
