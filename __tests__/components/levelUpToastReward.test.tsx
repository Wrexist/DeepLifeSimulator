import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AchievementToast from '@/components/anim/AchievementToast';
import { showLevelUpToast, showAchievementToast } from '@/utils/achievementToast';
import { announceTransient } from '@/utils/accessibility';

/**
 * UI2-5: a level-up carries no gem reward (`reward: 0`), but the banner drew
 * its gem chip unconditionally - "+0" on every skill level-up - and VoiceOver
 * said "Plus 0 gems".
 */
jest.mock('@/contexts/game/useGameSelector', () => ({
  useGameSelector: (sel: (s: unknown) => unknown) => sel({ settings: {} }),
}));
jest.mock('@/utils/haptics', () => ({ haptic: { success: jest.fn() } }));
jest.mock('@/utils/accessibility', () => ({ announceTransient: jest.fn() }));

const text = (r: TestRenderer.ReactTestRenderer) => JSON.stringify(r.toJSON());

describe('AchievementToast reward chip', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows no gem chip and announces no gems for a level-up', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<AchievementToast />);
    });
    act(() => {
      showLevelUpToast('Pickpocketing', 'Pickpocketing reached level 4');
    });
    expect(text(r)).toContain('LEVEL UP!');
    expect(text(r)).not.toContain('"+","0"');
    expect(text(r)).not.toMatch(/\+0/);
    const spoken = (announceTransient as jest.Mock).mock.calls.map((c) => c[0]).join(' ');
    expect(spoken).not.toContain('gems');
    act(() => r.unmount());
  });

  it('still shows the gem chip for a real achievement', () => {
    (announceTransient as jest.Mock).mockClear();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<AchievementToast />);
    });
    act(() => {
      showAchievementToast('First Job', 'work', 5);
    });
    expect(text(r)).toContain('ACHIEVEMENT UNLOCKED!');
    expect(text(r)).toMatch(/"\+",\s*"5"|\+5/);
    const spoken = (announceTransient as jest.Mock).mock.calls.map((c) => c[0]).join(' ');
    expect(spoken).toContain('Plus 5 gems');
    act(() => r.unmount());
  });
});
