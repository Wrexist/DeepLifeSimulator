/**
 * MON-7 and MON-5 (owner decisions 2026-10-22) on the mounted reward orb.
 *
 * MON-7: the orb used to appear 45-75 s after mount in a brand-new player's
 * first session. It now waits until REWARD_ORB_MIN_PLAYED_WEEKS of THIS life.
 *
 * MON-5: a player who paid to remove ads used to lose the orb entirely. They
 * keep it now - same cadence and caps - labelled as an ad-free perk, and no
 * copy on it mentions an ad.
 */
import React from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from '../render/helpers/renderWithProviders';
import AdRewardOrb from '@/components/AdRewardOrb';
import { AD_FREE_PERK_LABEL } from '@/lib/ads/orbGates';

const mockUnlocked = jest.fn<boolean, []>();
const mockAdsRemoved = jest.fn<boolean, []>();
jest.mock('@/lib/ads/orbGates', () => {
  const actual = jest.requireActual('@/lib/ads/orbGates');
  return { ...actual, rewardOrbUnlocked: () => mockUnlocked() };
});
jest.mock('@/lib/ads/rewardedAd', () => {
  const actual = jest.requireActual('@/lib/ads/rewardedAd');
  return {
    ...actual,
    areAdsRemoved: () => mockAdsRemoved(),
    // An ads-removed player is never shown an ad, so this build has none.
    adsAvailable: () => false,
  };
});

async function advance(ms: number): Promise<void> {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockUnlocked.mockReset();
  mockAdsRemoved.mockReset();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('MON-7 - the reward orb waits for the week gate', () => {
  it('shows nothing while the life is below the gate, however long the session', async () => {
    mockUnlocked.mockReturnValue(false);
    mockAdsRemoved.mockReturnValue(false);
    const { renderer, unmount } = renderWithProviders(<AdRewardOrb />);
    await advance(20 * 60_000);
    const json = JSON.stringify(renderer.toJSON());
    expect(json).not.toContain('Watch ad');
    expect(json).not.toContain(AD_FREE_PERK_LABEL);
    unmount();
  });

  it('appears on a later look once the gate opens (it does not go quiet)', async () => {
    mockUnlocked.mockReturnValueOnce(false).mockReturnValue(true);
    mockAdsRemoved.mockReturnValue(false);
    const { renderer, unmount } = renderWithProviders(<AdRewardOrb />);
    await advance(75_000);
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Watch ad');
    await advance(60_000);
    expect(JSON.stringify(renderer.toJSON())).toContain('Watch ad');
    unmount();
  });
});

describe('MON-5 - ad-free players keep the orb as a perk', () => {
  it('appears for an ad-free player, labelled as a perk and never as an ad', async () => {
    mockUnlocked.mockReturnValue(true);
    mockAdsRemoved.mockReturnValue(true);
    const { renderer, unmount } = renderWithProviders(<AdRewardOrb />);
    await advance(75_000);
    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain(AD_FREE_PERK_LABEL);
    expect(json).not.toContain('Watch ad');
    unmount();
  });
});
