/**
 * The daily reward ad doubler pays once, only while the day's popup is open.
 * lib/ads/dailyAdBonus.ts.
 */
import { applyDailyAdBonus, dailyAdBonusFor, DAILY_AD_BONUS_MAX_GEMS } from '@/lib/ads/dailyAdBonus';
import { createTestGameState } from '../helpers/createTestGameState';
import fs from 'fs';
import path from 'path';

describe('dailyAdBonusFor', () => {
  it('doubles the day reward up to the cap', () => {
    expect(dailyAdBonusFor(25)).toBe(25);
    expect(dailyAdBonusFor(500)).toBe(DAILY_AD_BONUS_MAX_GEMS);
    expect(dailyAdBonusFor(0)).toBe(0);
    expect(dailyAdBonusFor(undefined)).toBe(0);
    expect(dailyAdBonusFor(Number.NaN)).toBe(0);
  });
});

describe('applyDailyAdBonus', () => {
  const pending = () => createTestGameState({
    showDailyRewardPopup: true,
    dailyRewardAmount: 25,
    stats: { gems: 100 },
  });

  it('credits the bonus and closes the popup in one update', () => {
    const next = applyDailyAdBonus(pending());
    expect(next.stats.gems).toBe(125);
    expect(next.showDailyRewardPopup).toBe(false);
    expect(next.dailyRewardAmount).toBeUndefined();
  });

  it('pays once when the callback lands twice', () => {
    const once = applyDailyAdBonus(pending());
    const twice = applyDailyAdBonus(once);
    expect(twice).toBe(once);
    expect(twice.stats.gems).toBe(125);
  });

  it('pays nothing once the popup was claimed', () => {
    const claimed = createTestGameState({ showDailyRewardPopup: false, dailyRewardAmount: undefined, stats: { gems: 100 } });
    expect(applyDailyAdBonus(claimed)).toBe(claimed);
  });
});

describe('DailyRewardPopup', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'components/DailyRewardPopup.tsx'), 'utf8');

  it('offers the doubler only when a real ad can be shown', () => {
    expect(src).toMatch(/adsAvailable\(areAdsRemoved\(gameState\)\)/);
  });

  it('hides its Modal before the ad presents', () => {
    expect(src).toMatch(/visible=\{visible && !hiddenForAd\}/);
    const flow = src.slice(src.indexOf('const handleWatchAd'));
    expect(flow.indexOf('setHiddenForAd(true)')).toBeLessThan(flow.indexOf('runRewardedAd('));
    expect(flow.indexOf('await waitForDismissal()')).toBeLessThan(flow.indexOf('runRewardedAd('));
  });
});
