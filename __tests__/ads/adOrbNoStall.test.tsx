/**
 * The reward orb never goes quiet for the session.
 *
 * Once the no-fill courtesy grant was on cooldown (52 game weeks), the spawn
 * timer returned without rescheduling. With no orb on screen nothing could
 * fill an ad and clear the cooldown, so the orb vanished for the rest of the
 * session - and on every launch until the cooldown ran out. It now waits for
 * a loaded ad and looks again. 2026-10-17 audit.
 */
import React from 'react';
import { act } from 'react-test-renderer';

const mockReady = jest.fn<Promise<boolean>, []>();
jest.mock('@/lib/ads/rewardedAd', () => {
  const actual = jest.requireActual('@/lib/ads/rewardedAd');
  return {
    ...actual,
    adsAvailable: () => true,
    areAdsRemoved: () => false,
    rewardedAdReady: () => mockReady(),
  };
});
jest.mock('@/lib/ads/noFillCourtesy', () => {
  const actual = jest.requireActual('@/lib/ads/noFillCourtesy');
  return { ...actual, noFillOnCooldown: () => true };
});

import { renderWithProviders } from '../render/helpers/renderWithProviders';
import AdRewardOrb from '@/components/AdRewardOrb';

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

async function advance(ms: number): Promise<void> {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
}

beforeEach(() => {
  jest.useFakeTimers();
  mockReady.mockReset();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('reward orb with the courtesy grant on cooldown', () => {
  it('waits for a loaded ad instead of going silent, then offers', async () => {
    mockReady.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValue(true);
    const { renderer, unmount } = renderWithProviders(<AdRewardOrb />);

    // First spawn (45-75 s): no ad loaded yet, so no orb - but a recheck is queued.
    await advance(75_000);
    expect(mockReady).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Watch ad');

    await advance(30_000);
    expect(mockReady).toHaveBeenCalledTimes(2);
    await advance(30_000);
    expect(mockReady).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(renderer.toJSON())).toContain('Watch ad');
    unmount();
  });

  it('stops looking once unmounted', async () => {
    mockReady.mockResolvedValue(false);
    const { unmount } = renderWithProviders(<AdRewardOrb />);
    await advance(75_000);
    expect(mockReady).toHaveBeenCalledTimes(1);
    unmount();
    await advance(10 * 60_000);
    expect(mockReady).toHaveBeenCalledTimes(1);
  });
});
