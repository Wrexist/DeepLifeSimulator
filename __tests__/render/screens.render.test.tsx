import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import Home from '@/app/(tabs)/home';
import Work from '@/app/(tabs)/work';
import Market from '@/app/(tabs)/market';

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

  it('market mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<Market />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });
});
