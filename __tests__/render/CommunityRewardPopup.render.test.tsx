import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import CommunityRewardPopup from '@/components/CommunityRewardPopup';
import { DISCORD_JOIN_REWARD_MONEY } from '@/lib/config/gameConstants';

/**
 * Render smoke test for the in-game "join the community" cash-reward popup.
 * Mounts inside the real provider tree (it reads darkMode via useGameState) and
 * asserts the visible variant shows the formatted reward + the join/dismiss CTAs.
 */
describe('render — CommunityRewardPopup', () => {
  it('mounts (visible) and shows the cash reward + join/dismiss CTAs', () => {
    const { renderer, json, unmount } = renderWithProviders(
      <CommunityRewardPopup
        visible
        rewardAmount={DISCORD_JOIN_REWARD_MONEY}
        onJoin={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(renderer.toJSON()).not.toBeNull();
    // Formatted reward amount (e.g. "5,000") + the join CTA + the quiet dismiss.
    expect(json).toContain(DISCORD_JOIN_REWARD_MONEY.toLocaleString());
    expect(json).toContain('Join');
    expect(json).toContain('Maybe later');
    unmount();
  });

  it('mounts when hidden without throwing', () => {
    const { unmount } = renderWithProviders(
      <CommunityRewardPopup
        visible={false}
        rewardAmount={DISCORD_JOIN_REWARD_MONEY}
        onJoin={() => {}}
        onDismiss={() => {}}
      />,
    );
    unmount();
  });
});
