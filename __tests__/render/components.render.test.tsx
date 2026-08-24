import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import TopStatsBar from '@/components/TopStatsBar';
import IdentityCard from '@/components/IdentityCard';
import DeathPopup from '@/components/DeathPopup';
import LastWeekRecap from '@/components/LastWeekRecap';

/**
 * High-traffic component render smoke tests — always-mounted / frequently-shown
 * components that the audit flagged as render-crash risks. Mounted inside the
 * real provider tree with the default GameState.
 */
describe('render - high-traffic components', () => {
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

  // LastWeekRecap is the dashboard's non-blocking weekly recap. With the default
  // GameState (no weekResult yet) the component itself renders null; assert it
  // mounts cleanly inside the provider tree without throwing.
  it('LastWeekRecap mounts without throwing', () => {
    const { renderer, unmount } = renderWithProviders(<LastWeekRecap />);
    expect(renderer.toJSON()).toBeDefined();
    unmount();
  });

});
