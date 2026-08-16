import React from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import Home from '@/app/(tabs)/home';
import Work from '@/app/(tabs)/work';
import Apps from '@/app/(tabs)/apps';
import Life from '@/app/(tabs)/life';
import Market, { MarketScreenContent } from '@/app/(tabs)/market';
import Computer from '@/app/(tabs)/computer';
import Health from '@/app/(tabs)/health';
import Mobile from '@/app/(tabs)/mobile';
import Progression from '@/app/(tabs)/progression';

/**
 * In-game tab screen render smoke tests — the highest-traffic screens, mounted
 * inside the real provider tree with the default (valid) GameState.
 */
describe('render — in-game tab screens', () => {
  it('home mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<Home />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('work mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<Work />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('apps (merged device tab) mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<Apps />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('life (merged personal tab) mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<Life />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('market mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<Market />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('computer mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<Computer />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('health mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<Health />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('mobile mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<Mobile />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('progression mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<Progression />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });
});

/**
 * A filter chip that matches nothing must say so.
 *
 * "Owned" matches nothing on week 1 for EVERY new character, and the list was a
 * bare `sortedItems.map(...)` — so the chip rendered its own active state, its
 * count badge reading 0, and then nothing at all beneath it. Dead space under a
 * control you just pressed reads as a broken screen, not an empty shelf.
 *
 * These press the real chip rather than reaching into state, because the bug was
 * only reachable through the filter bar.
 *
 * `MarketScreenContent` (not the default export) on purpose: the default wraps
 * the screen in its own `ErrorBoundary`, whose fallback is a perfectly valid
 * tree — so a screen that threw would still satisfy every assertion below.
 */
describe('render — the Market filter bar names its dead ends', () => {
  const mountMarket = () => {
    const r = renderWithProviders(<MarketScreenContent />);
    const chip = r.renderer.root
      .findAll((n) => typeof n.props?.onPress === 'function', { deep: true })
      .filter(
        (n) => n.findAll((x) => x.props?.children === 'Owned', { deep: true }).length > 0,
      );
    expect(chip).toHaveLength(1);
    return { ...r, ownedChip: chip[0] };
  };

  it('an empty "Owned" filter explains itself instead of rendering nothing', () => {
    const { renderer, ownedChip, unmount } = mountMarket();

    act(() => ownedChip.props.onPress());
    const json = JSON.stringify(renderer.toJSON());

    expect(json).toContain("You don't own anything yet");
    unmount();
  });

  it('and offers the way back out of the filter', () => {
    // A named dead end with no exit is still a dead end.
    const { renderer, ownedChip, unmount } = mountMarket();

    act(() => ownedChip.props.onPress());
    const json = JSON.stringify(renderer.toJSON());

    expect(json).toContain('Show all items');
    unmount();
  });

  it('shows the items rather than the empty state under "All" (the control)', () => {
    // If this ever renders the empty copy the assertions above prove nothing.
    const { json, unmount } = mountMarket();

    expect(json).not.toContain("You don't own anything yet");
    expect(json).toContain('Business Suit');
    unmount();
  });
});

/**
 * Prices on this screen go through `formatMoney`, like every other money
 * figure in the file (the rental rows and the purchase dialog already did).
 * Raw interpolation printed "$5000" next to a confirm dialog saying "$5,000".
 */
describe('render — Market prices use the app-wide money format', () => {
  it('formats the item price instead of interpolating the number', () => {
    const { json, unmount } = renderWithProviders(<MarketScreenContent />);

    expect(json).toContain('$5,000'); // the computer
    expect(json).not.toContain('$5000');
    unmount();
  });
});
