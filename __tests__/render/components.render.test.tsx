import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import TopStatsBar from '@/components/TopStatsBar';
import IdentityCard from '@/components/IdentityCard';
import DeathPopup from '@/components/DeathPopup';

/**
 * High-traffic component render smoke tests — always-mounted / frequently-shown
 * components that the audit flagged as render-crash risks. Mounted inside the
 * real provider tree with the default GameState.
 */
describe('render — high-traffic components', () => {
  it('TopStatsBar mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<TopStatsBar />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('IdentityCard mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<IdentityCard />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('DeathPopup mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<DeathPopup />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });
});
