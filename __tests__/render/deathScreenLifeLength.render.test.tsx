import React, { useEffect } from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import { useGame } from '@/contexts/GameContext';
import DeathPopup from '@/components/DeathPopup';

/**
 * The death screen's "N yrs lived" must count THIS life, not the absolute
 * counter (CLAUDE.md §4.2).
 *
 * `weeksLived` is seeded from the starting age (`(age - 18) * 52`), so an
 * age-25 character starts at 364. The identity card divided that raw value by
 * 52 and told a player who died in week one that they had lived "7 yrs" -
 * found by photographing the death flow in the 2026-09-04 release audit, where
 * a fresh age-20 life read "2 yrs lived". `weeksInThisLife` reads the
 * `lifeStartWeek` baseline (v43); a save without one falls back to the raw
 * counter, which is exactly what those saves showed before.
 */
function SeedDeath({ weeksLived, lifeStartWeek }: { weeksLived: number; lifeStartWeek: number }) {
  const { setGameState } = useGame();
  useEffect(() => {
    setGameState((prev) => ({
      ...prev,
      weeksLived,
      lifeStartWeek,
      showDeathPopup: true,
      deathReason: 'health',
      stats: { ...prev.stats, health: 0 },
      date: { ...prev.date, age: 25 },
    }));
  }, [setGameState, weeksLived, lifeStartWeek]);
  return null;
}

describe('render - DeathPopup counts the life it is eulogising', () => {
  it('an age-25 character who died in week one has lived 1 wk, not 7 yrs', () => {
    const { renderer, unmount } = renderWithProviders(
      <>
        <SeedDeath weeksLived={365} lifeStartWeek={364} />
        <DeathPopup />
      </>,
    );
    act(() => {});
    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain('You Died');
    expect(json).toContain('1 wks');
    expect(json).not.toContain('7 yrs');
    unmount();
  });

  it('three years into the same life reads 3 yrs', () => {
    const { renderer, unmount } = renderWithProviders(
      <>
        <SeedDeath weeksLived={364 + 3 * 52} lifeStartWeek={364} />
        <DeathPopup />
      </>,
    );
    act(() => {});
    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain('3 yrs');
    unmount();
  });
});
