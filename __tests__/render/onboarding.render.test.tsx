import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import MainMenu from '@/app/(onboarding)/MainMenu';
import SaveSlots from '@/app/(onboarding)/SaveSlots';
import Scenarios from '@/app/(onboarding)/Scenarios';
import Customize from '@/app/(onboarding)/Customize';
import Ambitions from '@/app/(onboarding)/Ambitions';
import Perks from '@/app/(onboarding)/Perks';

/**
 * Onboarding screen render smoke tests — mount each pre-game screen inside the
 * real provider tree and assert it commits without throwing. Catches the
 * undefined-component / bad-import / provider-cycle class of crash that the
 * import-smoke test (screenImports.test.ts) cannot.
 */
describe('render — onboarding screens', () => {
  it('MainMenu mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<MainMenu />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('SaveSlots mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<SaveSlots />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('Scenarios mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<Scenarios />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('Customize mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<Customize />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('Ambitions mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<Ambitions />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('Perks mounts without throwing', () => {
    const { json, unmount } = renderWithProviders(<Perks />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });
});
