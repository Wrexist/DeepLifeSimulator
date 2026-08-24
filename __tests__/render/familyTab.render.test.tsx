import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import FamilyTab from '@/components/FamilyTab';
import { initialGameState } from '@/contexts/game/initialState';
import { getLifeStage } from '@/lib/config/gameConstants';

/**
 * PLAYER REPORT (2026-08-05, with screenshot): the Family screen opened with
 * its title under the clock and the close X behind the battery indicator —
 * "it's too far up, can't press close".
 *
 * `app/(tabs)/life.tsx` hosts this component in a `presentationStyle="fullScreen"`
 * Modal, which is NOT inside the tab navigator's safe-area padding. The header
 * started at `paddingTop: scale(16)` from y=0, so on every notch / Dynamic
 * Island phone it was drawn underneath the system status bar.
 *
 * Note what this was NOT: the 2026-08-01 accessibility pass had already given
 * this exact button `minTouchTargetStyle` + `hitSlopToMinTarget` +
 * `CLOSE_BUTTON_A11Y`, and the player still could not press it. A 44pt target
 * behind the status bar is still unhittable — size and POSITION are separate
 * failures, and only one of them had a test.
 */
const read = (rel: string): string =>
  fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

/** Source with comments removed — a rule stated in prose must not satisfy it. */
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const FAMILY_TAB = strip(read('components/FamilyTab.tsx'));
const LIFE_SCREEN = read('app/(tabs)/life.tsx');

describe('the Family header clears the status bar', () => {
  it('pads the header by the top safe-area inset', () => {
    expect(FAMILY_TAB).toContain('useSafeAreaInsets');
    // The header's padding must be derived from the inset, not a constant.
    expect(FAMILY_TAB).toMatch(/styles\.header,\s*\{\s*paddingTop:\s*insets\.top/);
  });

  it('pads the scroll content by the bottom inset, so the last row clears the home bar', () => {
    expect(FAMILY_TAB).toMatch(/paddingBottom:\s*insets\.bottom/);
  });

  it('the host modal claims the full window on Android too', () => {
    // Without `statusBarTranslucent` Android insets the modal itself and the
    // inset above would apply a second time.
    expect(LIFE_SCREEN).toMatch(/presentationStyle="fullScreen"[\s\S]{0,80}statusBarTranslucent/);
  });
});

describe('render - FamilyTab', () => {
  it('mounts in the real provider tree without throwing', () => {
    const { renderer, unmount } = renderWithProviders(<FamilyTab onClose={() => {}} />);
    expect(renderer).toBeTruthy();
    unmount();
  });

  it('a partnerless player is told the path, not just that they have no partner', () => {
    const { json, unmount } = renderWithProviders(<FamilyTab onClose={() => {}} />);

    expect(json).toContain('No partner yet');
    // The requirement ladder — the old empty state named none of these, so the
    // only way to learn them was to fail an action.
    expect(json).toContain('60% to move in together');
    expect(json).toContain('70% and living together to start a family');
    unmount();
  });

  it('derives the life stage from age instead of the frozen stored field', () => {
    // `GameState.lifeStage` is assigned exactly once — `initialState.ts` seeds
    // it from `getLifeStage(18)` — and no birthday handler, weekly subsystem or
    // scenario ever updates it. This header was its only product reader, which
    // is why a 21-year-old Trust Fund Baby was labelled "Teen · Age 21", and a
    // 70-year-old would have been too.
    expect(initialGameState.lifeStage).toBe('teen');
    expect(getLifeStage(21)).toBe('adult');

    // The header must read the derived value, not the stored one.
    expect(FAMILY_TAB).not.toContain('gameState.lifeStage');
    expect(FAMILY_TAB).toContain('getLifeStage(age)');

    const { json, unmount } = renderWithProviders(<FamilyTab onClose={() => {}} />);
    const age = Math.floor(initialGameState.date.age);
    const stage = getLifeStage(age);

    // RN splits the interpolated subtitle into separate text children.
    expect(json).toContain(`"${stage.charAt(0).toUpperCase()}${stage.slice(1)}"," · Age ","${age}"`);
    unmount();
  });

  it('does not headline a family-happiness BONUS the week loop never grants', () => {
    // The old headline read "+0 Family Happiness" — a small integer with a plus
    // sign, which reads as a weekly bonus. There is no such bonus: nothing in
    // `contexts/game/actions/weekly/` reads it and `child.familyHappiness` has
    // no writer anywhere in the repo. It is a mood readout, and it says so now.
    const { json, unmount } = renderWithProviders(<FamilyTab onClose={() => {}} />);

    expect(json).toContain('Household Mood');
    expect(json).not.toContain('Family Happiness');
    unmount();
  });
});
