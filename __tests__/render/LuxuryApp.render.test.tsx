import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import LuxuryApp from '@/components/computer/LuxuryApp';

// useReducedMotion reads AccessibilityInfo, which the jest react-native mock
// omits — stub it (as the ConfirmDialog render test does) so the render exercises
// the real screen instead of a provider crash.
jest.mock('@/hooks/useReducedMotion', () => ({
  __esModule: true,
  useReducedMotion: () => false,
  default: () => false,
}));

// The global lucide mock (jest.setup) only defines a handful of glyphs; this
// screen uses many more (Crown, Gem, Trophy, Wallet, …). Resolve EVERY icon to an
// inert host-tag string via a Proxy so no icon component is undefined at render.
jest.mock('lucide-react-native', () => {
  const overrides: Record<string, unknown> = { __esModule: true };
  return new Proxy(overrides, {
    get: (target, prop) => (typeof prop === 'string' && prop in target ? target[prop] : prop),
  });
});

/**
 * Render smoke test for the redesigned Luxury & Collectibles app. Mounts inside
 * the real provider tree (it reads theme + cash + owned items via useGame) and
 * proves the Browse tab commits without throwing and surfaces a known catalog
 * item name (a card rendered from LUXURY_CATALOG).
 */
describe('render — LuxuryApp', () => {
  it('mounts the Browse tab and shows a known catalog item', () => {
    const { renderer, json, unmount } = renderWithProviders(<LuxuryApp onBack={() => {}} />);
    expect(renderer.toJSON()).not.toBeNull();
    expect(json).toContain('Luxury & Collectibles');
    expect(json).toContain('Rare Watch Collection');
    unmount();
  });
});
