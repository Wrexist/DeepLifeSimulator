import { unlockGuide } from '@/lib/progress/featureUnlocks';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

/**
 * A locked app must say HOW to open it, with the player's progress on every
 * route `unlockTier` actually honours (tester, 2026-10-11: nobody knew how to
 * reach the Dark Web).
 */
describe('unlockGuide', () => {
  const fresh = () => createTestGameState({ completedChapters: [], weeksLived: 0, lifeStartWeek: 0 });

  it('names all three routes and the numbers behind them for a tier-5 app', () => {
    const g = unlockGuide(fresh(), 'app:onion');
    expect(g).not.toBeNull();
    expect(g!.requirement).toMatch(/Chapter 5/);
    expect(g!.details).toMatch(/Any ONE of these/);
    expect(g!.details).toMatch(/\$200K net worth/);
    expect(g!.details).toMatch(/120 weeks/);
    expect(g!.progress.length).toBeGreaterThan(0);
  });

  it('returns nothing for an app that is already open, or unknown', () => {
    expect(unlockGuide(fresh(), 'app:mail')).toBeNull();
    expect(unlockGuide(fresh(), 'app:not-a-real-app')).toBeNull();
  });
});
