import React, { useEffect } from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import { useGame } from '@/contexts/GameContext';
import WeddingPopup from '@/components/WeddingPopup';

/**
 * A raised popup flag must always have something that can lower it.
 *
 * `showWeddingPopup` is written by the weekly tick and cleared by exactly one
 * thing: the player tapping Continue on `WeddingPopup`. But the component
 * returns `null` whenever `weddingPartnerName` is missing, so the pair
 * (flag set, name absent) is a flag nobody can ever turn off - nothing draws,
 * and nothing offers the tap that would clear it.
 *
 * It is not an idle flag while it is stuck. `showWeddingPopup` suppresses the
 * life-moment and weekly-event modals (`app/(tabs)/_layout.tsx`), the home
 * feed's popups (`home.tsx` `blockingModalUp`), the ad orb, the premium promo
 * and the interstitial gate in `TopStatsBar` - so a stuck flag silently
 * retires every interrupting surface in the game for the rest of the life,
 * with no visible cause and no way back.
 *
 * The rule this pins is the general one, not the wedding: the renderer that
 * declines to draw is the only thing that can release what the flag is
 * holding, so it must.
 */
function Seed({ partnerName }: { partnerName?: string }) {
  const { setGameState } = useGame();
  useEffect(() => {
    setGameState((prev) => ({
      ...prev,
      showWeddingPopup: true,
      weddingPartnerName: partnerName,
    }));
  }, [setGameState, partnerName]);
  return null;
}

function Probe({ onRead }: { onRead: (flag: boolean) => void }) {
  const { gameState } = useGame();
  onRead(gameState.showWeddingPopup === true);
  return null;
}

function mount(partnerName?: string) {
  let latest = false;
  const { renderer, unmount } = renderWithProviders(
    <>
      <Seed partnerName={partnerName} />
      <WeddingPopup />
      <Probe onRead={(f) => { latest = f; }} />
    </>,
  );
  act(() => {});
  return { flag: () => latest, json: () => JSON.stringify(renderer.toJSON()), unmount };
}

describe('render - a wedding flag the popup cannot draw does not stay raised', () => {
  it('clears itself when there is no partner name to render', () => {
    const { flag, json, unmount } = mount(undefined);
    // Nothing was drawn...
    expect(json()).not.toContain('are now officially married');
    // ...so the flag must not still be blocking every other popup.
    expect(flag()).toBe(false);
    unmount();
  });

  it('an empty-string name is the same unrenderable state, not a valid one', () => {
    const { flag, unmount } = mount('');
    expect(flag()).toBe(false);
    unmount();
  });

  it('a real wedding still renders and KEEPS its flag until the player taps', () => {
    // The guard must not become a popup that dismisses itself before it is read.
    const { flag, json, unmount } = mount('Alex Rivera');
    expect(json()).toContain('Alex Rivera');
    expect(flag()).toBe(true);
    unmount();
  });
});
