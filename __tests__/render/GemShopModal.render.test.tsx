import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import GemShopModal from '@/components/GemShopModal';

// useReducedMotion reads AccessibilityInfo, which the jest react-native mock
// omits — stub it (as ConfirmDialog's render test does) so the render exercises
// the real store's entrance path instead of a provider/a11y crash.
jest.mock('@/hooks/useReducedMotion', () => ({
  __esModule: true,
  useReducedMotion: () => false,
  default: () => false,
}));

// The shared jest.setup lucide mock is an explicit allow-list that omits a few
// icons this store uses (Gem / Sparkles / Star are real lucide exports, present
// in the app). Provide the full set the store renders so the smoke test mounts.
jest.mock('lucide-react-native', () => ({
  __esModule: true,
  X: 'X',
  Gem: 'Gem',
  Sparkles: 'Sparkles',
  Star: 'Star',
  TrendingUp: 'TrendingUp',
  RefreshCw: 'RefreshCw',
  AlertCircle: 'AlertCircle',
  Check: 'Check',
}));

/**
 * Render smoke test for the redesigned IAP store (GemShopModal). It reads game
 * state/actions, so it must mount inside the real provider tree.
 *
 * Proves: (1) the store opens on the DEFAULT 'gems' tab (no initialTab) and a
 * known gem pack renders with a real dollar price string + its computed
 * gems-per-$ value line; (2) a hidden store mounts without throwing.
 *
 * The store SDK isn't connected in the node/ts-jest env, so prices fall back to
 * the config USD price (the localized-or-config contract) — which is exactly the
 * real-$ string we assert on. No iapService mock is needed for a render smoke.
 */
describe('render — GemShopModal (IAP store)', () => {
  it('mounts (visible) on the default Gems tab with a known pack at a real-$ price', () => {
    const { renderer, json, unmount } = renderWithProviders(
      <GemShopModal visible onClose={() => {}} />,
    );
    expect(renderer.toJSON()).not.toBeNull();
    // Default tab is 'gems': the ladder renders the $0.99 pack…
    expect(json).toContain('100 Gems');
    expect(json).toContain('$0.99');
    // …with a truthful, computed per-gem value line (no fabricated slash price).
    expect(json).toContain('gems / $1');
    unmount();
  });

  it('mounts when hidden without throwing', () => {
    const { unmount } = renderWithProviders(
      <GemShopModal visible={false} onClose={() => {}} />,
    );
    unmount();
  });
});
