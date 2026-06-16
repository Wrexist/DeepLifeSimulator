import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import TopStatsBar from '@/components/TopStatsBar';
import IdentityCard from '@/components/IdentityCard';
import DeathPopup from '@/components/DeathPopup';
import ShopModal from '@/components/ShopModal';

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

  // ShopModal is the in-app store — its purchase handler now routes through the
  // shared applyProductBenefitsToState helper. Smoke-mount it (open) so a render
  // crash in the previously-untested component is caught.
  it('ShopModal (open) mounts without throwing', () => {
    const { renderer, unmount } = renderWithProviders(
      <ShopModal visible={true} onClose={() => {}} />,
    );
    // An open Shop renders real content — assert it's not a null render.
    // (json.length > 0 would pass even on JSON.stringify(null) === "null".)
    expect(renderer.toJSON()).not.toBeNull();
    unmount();
  });
});
