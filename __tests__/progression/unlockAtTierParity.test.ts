/**
 * PERF-4: the app launcher now selects `unlockTier(state)` once and decorates
 * every tile with the `*AtTier` helpers, instead of subscribing to the whole
 * state. That is only safe while lock state is a function of the tier alone,
 * so pin the helpers to the state-based originals for every registered
 * feature at every tier.
 */
import {
  FEATURE_UNLOCKS,
  isFeatureUnlocked,
  isFeatureUnlockedAtTier,
  unlockGuide,
  unlockRequirement,
  unlockRequirementAtTier,
  unlockShortLabel,
  unlockTier,
} from '@/lib/progress/featureUnlocks';
import { createTestGameState } from '../helpers/createTestGameState';

const STATES = [
  createTestGameState({ weeksLived: 0, lifeStartWeek: 0 }),
  createTestGameState({ weeksLived: 10, lifeStartWeek: 0, currentJob: 'fast_food' }),
  createTestGameState({ completedChapters: ['chapter_1', 'chapter_2'] }),
  createTestGameState({ weeksLived: 400, lifeStartWeek: 0 }),
];

describe('tier-based unlock helpers match the state-based ones (PERF-4)', () => {
  it.each(STATES.map((s, i) => [i, s] as const))('state #%i', (_i, state) => {
    const tier = unlockTier(state);
    for (const feature of FEATURE_UNLOCKS) {
      expect(isFeatureUnlockedAtTier(tier, feature.id)).toBe(isFeatureUnlocked(state, feature.id));
      expect(unlockRequirementAtTier(tier, feature.id)).toBe(unlockRequirement(state, feature.id));
      const guide = unlockGuide(state, feature.id);
      if (guide) expect(unlockShortLabel(feature.id)).toBe(guide.short);
    }
  });

  it('an unregistered id is unlocked at any tier', () => {
    expect(isFeatureUnlockedAtTier(0, 'app:not-a-real-app')).toBe(true);
    expect(unlockRequirementAtTier(0, 'app:not-a-real-app')).toBe('');
  });
});
