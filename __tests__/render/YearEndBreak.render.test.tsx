/**
 * The year-end break's intro card: names the reward, can be skipped, and
 * starts the ad only after the countdown (AdMob rewarded-interstitial policy).
 */
import React from 'react';
import { act } from 'react-test-renderer';

const mockShow = jest.fn<Promise<boolean>, [() => void, { placement?: string }?]>();
jest.mock('@/services/AdMobService', () => ({
  adMobService: {
    showRewardedInterstitialAd: (onReward: () => void, opts?: { placement?: string }) => mockShow(onReward, opts),
  },
}));

import { renderWithProviders } from './helpers/renderWithProviders';
import YearEndBreak from '@/components/YearEndBreak';
import {
  YEAR_END_BREAK,
  getYearEndOffer,
  openYearEndOffer,
  __resetYearEndBreak,
} from '@/lib/ads/yearEndBreak';

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

const text = (r: { toJSON: () => unknown }) => JSON.stringify(r.toJSON());

beforeEach(() => {
  jest.useFakeTimers();
  __resetYearEndBreak();
  mockShow.mockReset();
  mockShow.mockResolvedValue(true);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('YearEndBreak', () => {
  it('renders nothing without an offer', () => {
    const { json, unmount } = renderWithProviders(<YearEndBreak />);
    expect(json).not.toContain('No thanks');
    unmount();
  });

  it('names the reward and lets the player skip without an ad', async () => {
    const { renderer, unmount } = renderWithProviders(<YearEndBreak />);
    act(() => openYearEndOffer({ boundaryWeek: 520, yearNumber: 3 }));
    await flush();
    expect(text(renderer)).toContain('Year ');
    expect(text(renderer)).toContain(`${YEAR_END_BREAK.rewardGems}`);
    expect(text(renderer)).toContain('No thanks');

    const skip = renderer.root.findAll((n) => n.props?.accessibilityLabel === 'No thanks, skip the ad')[0];
    act(() => skip.props.onPress());
    await flush();
    expect(getYearEndOffer()).toBeNull();
    expect(mockShow).not.toHaveBeenCalled();
    unmount();
  });

  it('starts the ad when the countdown runs out, then closes', async () => {
    const { renderer, unmount } = renderWithProviders(<YearEndBreak />);
    act(() => openYearEndOffer({ boundaryWeek: 520, yearNumber: 3 }));
    await flush();
    for (let i = 0; i < YEAR_END_BREAK.introSeconds; i++) {
      act(() => { jest.advanceTimersByTime(1000); });
      await flush();
    }
    await flush();
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow.mock.calls[0][1]).toEqual({ placement: 'year_end' });
    expect(getYearEndOffer()).toBeNull();
    expect(text(renderer)).not.toContain('No thanks');
    unmount();
  });
});
