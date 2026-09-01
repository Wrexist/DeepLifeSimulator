/**
 * The gym session must charge before it pays out.
 *
 * ── The exploit this closes ───────────────────────────────────────────────
 * `handleGym` gated on the RENDERED snapshot:
 *
 *     if (gameState.stats.money < cost) return;
 *     if (gameState.stats.energy < energyCost) return;
 *     updateStats({ money: -cost, energy: -energyCost, fitness: 5, ... });
 *
 * Two taps inside one React batch both read the same pre-tap `gameState`, so
 * both passed. `disabled={!canUseGym}` could not help — it is derived from that
 * same render.
 *
 * What made it an exploit rather than a harmless overdraw is the CLAMPING.
 * `updateStats` routes money through `sanitizeAmount`, which returns 0 for any
 * value <= 0, and energy through `clampStat`, which floors at 0. So the second
 * workout charged NOTHING and still paid +5 fitness / +3 health / +2 happiness.
 * Spam-tapping bought unlimited stats for one session's price.
 *
 * These tests assert the ARITHMETIC of that clamp and the shape of the fixed
 * handler, because the component itself needs a full provider tree to render.
 * The invariant they protect: a rejected session must change NOTHING, and a
 * charge must never be forgiven into a free grant.
 */

import { clampStatByKey, sanitizeAmount } from '@/utils/statUtils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

// The gym card moved from the Market screen to Health (UI overhaul, Phase 5) -
// a workout is an activity, not shopping. The handler moved verbatim.
const gymSrc = fs.readFileSync(
  path.join(process.cwd(), 'components', 'health', 'GymCard.tsx'),
  'utf8'
);

/** The handler body, bounded by its own declaration and dependency array. */
const gym = (() => {
  const start = gymSrc.indexOf('const handleGym');
  expect(start).toBeGreaterThan(-1);
  return gymSrc.slice(start, gymSrc.indexOf('}, [hasMembership', start));
})();

describe('the clamp that turned an overdraw into a free workout', () => {
  it('forgives a negative balance instead of recording debt', () => {
    // Not a bug in itself — money is not allowed to go negative here. It is the
    // reason the stale gate could not be left as the only check.
    expect(sanitizeAmount(-50)).toBe(0);
    expect(clampStatByKey('money', -50)).toBe(0);
    expect(clampStatByKey('energy', -20)).toBe(0);
  });

  it('means an unaffordable charge costs the player nothing', () => {
    // Broke player, second tap of a batch: 0 - 50 should be a refusal, but
    // clamped it reads as "paid, balance 0" while the stats still landed.
    const brokeAfterFirstTap = 0;
    expect(clampStatByKey('money', brokeAfterFirstTap - 50)).toBe(0);
    expect(clampStatByKey('money', brokeAfterFirstTap - 50)).not.toBeLessThan(0);
  });
});

describe('handleGym charges against prev, not against the render', () => {
  it('re-checks BOTH costs inside the updater', () => {
    // The two resources are separate gates: a player can afford the money and
    // not the energy, so checking one is not checking the other.
    expect(gym).toMatch(/setGameState\(prev =>/);
    expect(gym).toMatch(/st\?\.money \?\? 0\) < cost/);
    expect(gym).toMatch(/st\?\.energy \?\? 0\) < energyCost/);
  });

  it('rejects by returning prev UNCHANGED', () => {
    // Not `return { ...prev }` and not a partial write — a rejected session
    // must leave the timer alone too, or it still consumed the week's decay
    // protection for free.
    expect(gym).toMatch(/return prev;/);
  });

  it('applies the charge and the payout in ONE updater', () => {
    // Two updaters would let the grant commit while the charge was rejected.
    expect((gym.match(/setGameState\(/g) ?? []).length).toBe(1);
    for (const field of ['money', 'energy', 'fitness', 'health', 'happiness', 'lastGymVisitWeek']) {
      expect(gym).toMatch(new RegExp(field));
    }
  });

  it('no longer routes the spend through updateStats', () => {
    // `updateStats` cannot reject — it clamps and commits whatever it is given,
    // which is exactly how the free workout got paid out.
    expect(gym).not.toMatch(/updateStats\(/);
  });

  it('keeps the timer stamp inside the same guarded updater', () => {
    // It used to be a second `setGameState` after the charge, so a refused
    // charge still refreshed the anti-decay timer.
    const stamp = gym.indexOf('lastGymVisitWeek');
    const guard = gym.indexOf('return prev;');
    expect(stamp).toBeGreaterThan(guard);
  });
});
