import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import Home from '@/app/(tabs)/home';
import Work from '@/app/(tabs)/work';
import Market from '@/app/(tabs)/market';
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
