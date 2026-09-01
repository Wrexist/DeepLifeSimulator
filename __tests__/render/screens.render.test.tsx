import React from 'react';
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
describe('render - in-game tab screens', () => {
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
 * The Market is ONE scrolling list under section headers (UI overhaul,
 * Phase 5): Items → Food → Housing, no sub-tab bar and no filter bar. The
 * filter chips are gone with their week-1 dead end (the "Owned" chip that
 * reliably matched nothing), so everything a new character can buy is
 * reachable by scrolling one list.
 *
 * `MarketScreenContent` (not the default export) on purpose: the default wraps
 * the screen in its own `ErrorBoundary`, whose fallback is a perfectly valid
 * tree — so a screen that threw would still satisfy every assertion below.
 */
describe('render - the Market is one list under section headers', () => {
  it('renders items, food and housing in a single tree, no tab press needed', () => {
    const { json, unmount } = renderWithProviders(<MarketScreenContent />);

    expect(json).toContain('Business Suit'); // an item
    expect(json).toContain('Housing'); // the housing section header
    unmount();
  });

  it('the filter bar and its dead ends are gone', () => {
    const { renderer, unmount } = renderWithProviders(<MarketScreenContent />);
    const json = JSON.stringify(renderer.toJSON());

    expect(json).not.toContain('Owned');
    expect(json).not.toContain("You don't own anything yet");
    unmount();
  });
});

/**
 * Prices on this screen go through `formatMoney`, like every other money
 * figure in the file (the rental rows and the purchase dialog already did).
 * Raw interpolation printed "$5000" next to a confirm dialog saying "$5,000".
 */
describe('render - Market prices use the app-wide money format', () => {
  it('formats the item price instead of interpolating the number', () => {
    const { json, unmount } = renderWithProviders(<MarketScreenContent />);

    expect(json).toContain('$5,000'); // the computer
    expect(json).not.toContain('$5000');
    unmount();
  });
});
