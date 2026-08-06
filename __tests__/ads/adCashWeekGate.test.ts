/**
 * The ad orb's cash reward is gated on the GAME week (v35).
 *
 * The orb pays 1.5% of net worth and its only limiter was a wall-clock respawn
 * timer — decoupled from `weeksLived` entirely. Taking every orb multiplied net
 * worth by 1.015 each time, doubling it roughly every 2.2 hours of REAL time,
 * from ~$67k all the way to the $500k cap — invisible to the progressive tax
 * brackets and to the net-worth soft cap. It was the single largest reason
 * money stopped mattering.
 *
 * This suite pins the SHAPE of the fix, at the level a unit test can reach: the
 * marker is a carve-out field with no backfill, and the component gates on the
 * game week using the stamp-and-reserve pattern rather than a wall-clock check.
 */

import fs from 'fs';
import path from 'path';
import { STATE_VERSION, initialGameState } from '@/contexts/game/initialState';
import { CURRENT_STATE_VERSION, runMigrations } from '@/utils/saveMigrations';
import { repairGameState } from '@/utils/saveValidation';

const ORB_SOURCE = fs.readFileSync(
  path.join(__dirname, '../../components/AdRewardOrb.tsx'),
  'utf8'
);

describe('the gate exists and is on the game week', () => {
  it('the cash path consults lastAdCashGrantWeek', () => {
    expect(ORB_SOURCE).toMatch(/lastAdCashGrantWeek/);
  });

  it('compares against weeksLived, not a wall clock', () => {
    // The whole point: Date.now() is what the player can scrub.
    expect(ORB_SOURCE).toMatch(/prev\.weeksLived/);
    expect(ORB_SOURCE).toMatch(/prev\.settings\?\.lastAdCashGrantWeek === week/);
  });

  it('stamps the week INSIDE the updater, not outside it', () => {
    // §4.4: the updater that records the week must BE the gate, returning
    // `prev` unchanged to reject — otherwise two taps in one batch both pass.
    const grantBlock = ORB_SOURCE.slice(
      ORB_SOURCE.indexOf('const grant = useCallback'),
      ORB_SOURCE.indexOf('const handleSheetDismissed')
    );
    expect(grantBlock).toMatch(/setGameState\(prev => \{/);
    expect(grantBlock).toMatch(/return prev;/);
    // And the decision is captured inside, then read after — the established
    // pattern for pairing a guard with the module-form updateMoney.
    expect(grantBlock).toMatch(/allowed = true/);
    expect(grantBlock).toMatch(/if \(!allowed\)/);
  });

  it('leaves the VITALITY reward ungated', () => {
    // Vitality cannot be banked or compounded — it caps at 100 — so rate
    // limiting it would only make the orb feel stingy for no balance gain.
    const grantBlock = ORB_SOURCE.slice(
      ORB_SOURCE.indexOf('const grant = useCallback'),
      ORB_SOURCE.indexOf('const handleSheetDismissed')
    );
    const vitalityHalf = grantBlock.slice(grantBlock.indexOf('} else {'));
    expect(vitalityHalf).not.toMatch(/lastAdCashGrantWeek/);
  });
});

describe('the save format (v35) — a carve-out', () => {
  it('the version bumped', () => {
    expect(STATE_VERSION).toBe(CURRENT_STATE_VERSION);
    expect(STATE_VERSION).toBeGreaterThanOrEqual(35);
  });

  it('does NOT ship a default — an absent key means "never claimed"', () => {
    expect(initialGameState.settings?.lastAdCashGrantWeek).toBeUndefined();
  });

  it('a v34 save is NOT backfilled', () => {
    // Stamping a week would deny an existing player their next legitimate
    // claim — the same reasoning as v28's lastNoFillGrantWeek and v31's
    // lastLoginRewardWeek. "Writes nothing" and "was never written" are
    // indistinguishable unless the absence is asserted.
    const save = { version: 34, weeksLived: 500, settings: {} } as Record<string, unknown>;

    const result = runMigrations(save as never);

    expect(result.state.version).toBe(CURRENT_STATE_VERSION);
    const settings = (result.state as { settings?: Record<string, unknown> }).settings ?? {};
    expect('lastAdCashGrantWeek' in settings).toBe(false);
  });

  it('does not disturb a marker that is already there', () => {
    const save = {
      version: 34,
      weeksLived: 500,
      settings: { lastAdCashGrantWeek: 480 },
    } as Record<string, unknown>;

    const result = runMigrations(save as never);

    const settings = (result.state as { settings?: Record<string, unknown> }).settings ?? {};
    expect(settings.lastAdCashGrantWeek).toBe(480);
  });

  it('repairGameState does not invent one either', () => {
    // Carve-outs have no repair mirror by design; a repair that stamped a week
    // would be the same lockout as a migration that did.
    const partial = { ...initialGameState } as unknown as Record<string, unknown>;

    repairGameState(partial as never);

    const settings = (partial as { settings?: Record<string, unknown> }).settings ?? {};
    expect(settings.lastAdCashGrantWeek).toBeUndefined();
  });
});
