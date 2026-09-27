import React from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import GemShopModal from '@/components/GemShopModal';
import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS } from '@/utils/iapConfig';

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
// Any lucide icon → a host stub named after the icon. A Proxy (instead of a
// hand-maintained list) means icons pulled in by nested components — the
// DeepLife+ banner and the SubscriptionModal it mounts — never break this smoke.
jest.mock('lucide-react-native', () => new Proxy(
  { __esModule: true } as Record<string, unknown>,
  { get: (target, prop) => (prop in target ? target[prop as string] : prop) },
));

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
describe('render - GemShopModal (IAP store)', () => {
  it('uses the loaded localized price and keeps missing products unavailable', () => {
    const state = jest.spyOn(iapService, 'getState').mockReturnValue({
      ...iapService.getState(), isConnected: true,
      products: [{ productId: IAP_PRODUCTS.GEMS_100, displayPrice: '12,00 kr', priceAmount: 12, currency: 'SEK' }],
    });
    const { renderer, unmount } = renderWithProviders(<GemShopModal visible wallet onClose={() => {}} />);
    try {
      const text = JSON.stringify(renderer.toJSON());
      expect(text).toContain('12,00 kr');
      expect(text).toContain('gems per 1 SEK');
      expect(text).not.toContain('gems / $1');
      expect(text).toContain('Price unavailable');
      expect(text).not.toContain('$4.99');
    } finally { unmount(); state.mockRestore(); }
  });
  it('opens a focused wallet and lets the player browse gem upgrades without a store connection', () => {
    const { renderer, unmount } = renderWithProviders(<GemShopModal visible wallet onClose={() => {}} />);
    const text = () => JSON.stringify(renderer.toJSON());
    expect(text()).toContain('Gem wallet');
    expect(text()).toContain('100 Gems');
    expect(text()).toContain('Store unavailable');
    expect(text()).toContain('Price unavailable');
    expect(text()).not.toContain('$0.99');
    expect(text()).not.toContain('Featured tab');
    act(() => renderer.root.findAllByProps({ accessibilityLabel: 'Spend gems tab' }).find(n => typeof n.props.onPress === 'function')!.props.onPress());
    expect(text()).toContain('Permanent upgrades');
    expect(text()).not.toContain('Store unavailable');
    expect(text()).not.toContain('Gem packs');
    act(() => renderer.root.findAllByProps({ accessibilityLabel: 'Top up tab' }).find(n => typeof n.props.onPress === 'function')!.props.onPress());
    expect(text()).toContain('100 Gems');
    unmount();
  });
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
