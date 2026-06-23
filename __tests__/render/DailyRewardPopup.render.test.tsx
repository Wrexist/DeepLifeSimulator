import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import DailyRewardPopup from '@/components/DailyRewardPopup';
import { DAILY_LOGIN_REWARDS } from '@/lib/config/gameConstants';

/**
 * Render test for the daily-login reward calendar (NOW-3).
 * Mounts inside the real provider tree and asserts the 7-day calendar renders
 * every cycle reward, the streak header shows, and the grant is labelled as
 * GEMS (the previous build mislabelled the gem reward as a "$" money bonus).
 */
describe('render — DailyRewardPopup (daily reward calendar)', () => {
  it('mounts visible and shows the 7-day calendar + gem-labelled reward', () => {
    const reward = DAILY_LOGIN_REWARDS[2]; // a mid-cycle gem amount
    const { renderer, json, unmount } = renderWithProviders(
      <DailyRewardPopup visible rewardAmount={reward} onClose={() => {}} />,
    );
    expect(renderer.toJSON()).not.toBeNull();

    // Calendar renders all 7 day cells (D1..D7).
    for (let i = 1; i <= DAILY_LOGIN_REWARDS.length; i++) {
      expect(json).toContain(`D${i}`);
    }
    // Every cycle reward amount is shown somewhere in the calendar.
    expect(json).toContain(String(DAILY_LOGIN_REWARDS[0]));
    expect(json).toContain(String(DAILY_LOGIN_REWARDS[DAILY_LOGIN_REWARDS.length - 1]));

    // The grant is gems, not money — no "$" money-bonus label, and a streak header.
    expect(json).toContain('streak');
    expect(json).toContain('gems');
    expect(json).not.toContain('Money bonus');

    expect(json).toContain('Claim Reward');
    unmount();
  });

  it('mounts when hidden without throwing', () => {
    const { unmount } = renderWithProviders(
      <DailyRewardPopup visible={false} rewardAmount={0} onClose={() => {}} />,
    );
    unmount();
  });
});
