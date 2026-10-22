/**
 * MON-4 (v57): the vitality orb is one refill per GAME week.
 *
 * It was ungated - "it caps at 100, it cannot be banked". It did not need to
 * be banked: orbs respawn every 6-10 real minutes, so sitting on one game week
 * and watching ads refilled Health, Happiness and Energy indefinitely, which
 * switched off decay, burnout and the happiness economy for anyone willing to
 * watch. The gate is `settings.lastAdVitalityGrantWeek`, stamped in the SAME
 * updater as the refill (§4.4), and the refill goes through `applyStatsDelta`
 * so the happiness half is scaled like every other gain.
 */
import React from 'react';
import { applyAdVitalityGrant, vitalityGrantClaimed, applyAdCashGrant } from '@/components/AdRewardOrb';
import { scaledHappinessGain } from '@/lib/economy/happinessGain';
import { initialGameState } from '@/contexts/game/initialState';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function batched(initial: GameState) {
  let state = initial;
  const setState = ((update: React.SetStateAction<GameState>) => {
    if (typeof update !== 'function') throw new Error('non-functional updater');
    state = update(state);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

const WEEK = 364;

function tired(claimedWeek?: number): GameState {
  const base = createTestGameState();
  return createTestGameState({
    weeksLived: WEEK,
    stats: { ...base.stats, health: 30, happiness: 30, energy: 10 },
    settings: { ...base.settings, lastAdVitalityGrantWeek: claimedWeek },
  });
}

describe('vitalityGrantClaimed', () => {
  it('is true only for the current game week', () => {
    expect(vitalityGrantClaimed(tired())).toBe(false);
    expect(vitalityGrantClaimed(tired(WEEK))).toBe(true);
    expect(vitalityGrantClaimed(tired(WEEK - 1))).toBe(false);
  });

  it('survives a missing state', () => {
    expect(vitalityGrantClaimed(undefined)).toBe(false);
    expect(vitalityGrantClaimed(null)).toBe(false);
  });
});

describe('applyAdVitalityGrant', () => {
  it('refills and stamps the week in one step', () => {
    const next = applyAdVitalityGrant(tired());
    expect(next.stats.health).toBe(100);
    expect(next.stats.energy).toBe(100);
    expect(next.settings.lastAdVitalityGrantWeek).toBe(WEEK);
  });

  it('the happiness half is scaled like any other gain, not a flat +100', () => {
    const before = tired();
    const next = applyAdVitalityGrant(before);
    const expected = Math.min(100, before.stats.happiness + scaledHappinessGain(before.stats.happiness, 100));
    expect(next.stats.happiness).toBeCloseTo(expected, 6);
  });

  it('a double tap in one batch refills once', () => {
    const { setState, get } = batched(tired());
    setState((prev) => applyAdVitalityGrant(prev));
    const afterFirst = get();
    // Drain the stats so a second refill would be visible.
    setState((prev) => ({ ...prev, stats: { ...prev.stats, energy: 5 } }));
    setState((prev) => applyAdVitalityGrant(prev));
    expect(get().stats.energy).toBe(5);
    expect(afterFirst.settings.lastAdVitalityGrantWeek).toBe(WEEK);
  });

  it('a later game week re-arms it', () => {
    const claimed = applyAdVitalityGrant(tired());
    const nextWeek = { ...claimed, weeksLived: WEEK + 1, stats: { ...claimed.stats, energy: 5 } };
    expect(applyAdVitalityGrant(nextWeek).stats.energy).toBe(100);
  });

  it('the two orbs keep separate markers', () => {
    const vit = applyAdVitalityGrant(tired());
    expect(vit.settings.lastAdCashGrantWeek).toBeUndefined();
    const cash = applyAdCashGrant(vit, 1_000);
    expect(cash.settings.lastAdCashGrantWeek).toBe(WEEK);
    expect(cash.settings.lastAdVitalityGrantWeek).toBe(WEEK);
  });
});

describe('the save format (v57) - a carve-out', () => {
  it('ships no default: absent means "never claimed", so an existing save keeps its next refill', () => {
    expect(initialGameState.settings?.lastAdVitalityGrantWeek).toBeUndefined();
  });
});
