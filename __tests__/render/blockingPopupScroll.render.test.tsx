import React, { useEffect } from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import { useGame } from '@/contexts/GameContext';
import WeddingPopup from '@/components/WeddingPopup';
import WelcomeBackPopup from '@/components/WelcomeBackPopup';

/**
 * The mount half of the escapable-popup fix.
 *
 * `blockingPopupScroll.test.ts` asserts the source contract — a bounded card, a
 * `flexShrink: 1` scroller, a pinned dismiss control. It cannot see whether the
 * tree still mounts: wrapping a card body in a ScrollView is exactly the kind
 * of edit that can leave a mismatched tag or an unimported component, and both
 * of those are a crash inside a modal that is already covering the screen.
 *
 * So these two assert the pair the source test cannot: the component commits,
 * and the control that dismisses it is present in the rendered output rather
 * than lost somewhere in the restructure.
 *
 * `WeddingPopup` — the one the bug report was actually about — gates on
 * `gameState.showWeddingPopup`, which the harness has no way to seed. It gets a
 * one-off `SeedWedding` child below that flips the flag through the real
 * provider, because a smoke test of the reported component is worth the extra
 * scaffolding. `LifeMomentModal` gates on `pendingMoment`, a richer shape whose
 * seed would be a hand-built fixture; it stays on the source contract.
 */

/**
 * Flips the wedding flags through the real provider so the popup has something
 * to render. Renders nothing itself.
 */
function SeedWedding({ partner }: { partner: string }) {
  const { setGameState } = useGame();
  useEffect(() => {
    setGameState(prev => ({
      ...prev,
      showWeddingPopup: true,
      weddingPartnerName: partner,
    }));
  }, [setGameState, partner]);
  return null;
}

describe('render - WeddingPopup keeps its only exit on screen', () => {
  it('mounts with the flag set and renders the Continue button', () => {
    const { renderer, unmount } = renderWithProviders(
      <>
        <SeedWedding partner="David Martinez" />
        <WeddingPopup />
      </>,
    );
    // The seed lands in an effect, so the popup's real tree only exists after
    // the state update commits.
    act(() => {});
    const json = JSON.stringify(renderer.toJSON());

    // The popup is actually open (not the `return null` path) …
    expect(json).toContain("YOU'RE MARRIED!");
    expect(json).toContain('David Martinez');
    // … and the button that clears `showWeddingPopup` is in the tree. This is
    // the control the bug report's screenshot was missing.
    expect(json).toContain('Continue Your Love Story');
    unmount();
  });

  it('renders nothing while the flag is unset (the control)', () => {
    const { renderer, unmount } = renderWithProviders(<WeddingPopup />);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("YOU'RE MARRIED!");
    unmount();
  });
});
describe('render - WelcomeBackPopup keeps its only exit on screen', () => {
  it('mounts and renders the Continue Playing button', () => {
    const { renderer, json, unmount } = renderWithProviders(
      <WelcomeBackPopup visible onClose={() => {}} />,
    );
    expect(renderer.toJSON()).not.toBeNull();
    // The sole dismiss control: no close X, no backdrop tap, and
    // `onRequestClose` is Android's hardware back button alone.
    expect(json).toContain('Continue Playing');
    unmount();
  });

  it('mounts when hidden without throwing', () => {
    const { unmount } = renderWithProviders(
      <WelcomeBackPopup visible={false} onClose={() => {}} />,
    );
    unmount();
  });
});

