import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import AdRewardOrb from '@/components/AdRewardOrb';

/**
 * Render smoke test for the floating "watch ad → cash" reward orb. It starts
 * hidden (returns null) and only reveals itself on a randomised timer, so the
 * meaningful assertion is that it mounts inside the real provider tree without
 * throwing (bad import / hook / net-worth call) and commits as null.
 */
describe('render - AdRewardOrb', () => {
  it('mounts without throwing and starts hidden', () => {
    const { renderer, json, unmount } = renderWithProviders(<AdRewardOrb />);
    expect(renderer).toBeTruthy();
    // Hidden on mount — the orb / ad sheet copy is not rendered yet.
    expect(json).not.toContain('Watch ad');
    unmount();
  });
});
