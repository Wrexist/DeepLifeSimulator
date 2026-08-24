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
    // WP-A moved that updater body into the pure `applyAdCashGrant`, which the
    // `grant` callback passes straight to setGameState.
    const reducer = ORB_SOURCE.slice(
      ORB_SOURCE.indexOf('export function applyAdCashGrant'),
      ORB_SOURCE.indexOf('function AdRewardOrb()')
    );
    expect(reducer).toMatch(/return prev;/);
    const grantBlock = ORB_SOURCE.slice(
      ORB_SOURCE.indexOf('const grant = useCallback'),
      ORB_SOURCE.indexOf('const handleSheetDismissed')
    );
    expect(grantBlock).toMatch(/setGameState\(prev => applyAdCashGrant\(prev, reward\)\)/);
  });

  it('reads NOTHING back out of the updater', () => {
    // WP-A: the decision used to be a `let allowed` assigned inside the updater
    // and read after it. React defers any update that is not first in its
    // batch, so that read saw its `false` default for a grant that HAD
    // committed the week marker — the reward silently dropped. The gate is now
    // an OUTER guard (`cashGrantClaimed`) mirroring the inner `return prev`.
    const grantBlock = ORB_SOURCE.slice(
      ORB_SOURCE.indexOf('const grant = useCallback'),
      ORB_SOURCE.indexOf('const handleSheetDismissed')
    );
    expect(grantBlock).not.toMatch(/let allowed/);
    expect(grantBlock).toMatch(/if \(cashGrantClaimed\(getGameState\(\)\)\)/);
  });

  it('never shows the success sheet for a refused grant', () => {
    const grantBlock = ORB_SOURCE.slice(
      ORB_SOURCE.indexOf('const grant = useCallback'),
      ORB_SOURCE.indexOf('const handleSheetDismissed')
    );
    // The refusal branch sets the honest flag and errors out; only the path
    // that reached the updater sets `granted` / plays the success haptic.
    const refusal = grantBlock.slice(
      grantBlock.indexOf('if (cashGrantClaimed('),
      grantBlock.indexOf('setGameState(prev => applyAdCashGrant')
    );
    expect(refusal).toMatch(/setGranted\(false\)/);
    expect(refusal).toMatch(/setClaimBlocked\(true\)/);
    expect(refusal).toMatch(/haptic\.error\(\)/);
    expect(refusal).not.toMatch(/haptic\.success\(\)/);
    // And the sheet copy for that state does not announce money.
    expect(ORB_SOURCE).toMatch(/claimBlocked[\s\S]{0,80}Already collected this week/);
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

describe('the save format (v35) - a carve-out', () => {
  it('the version bumped', () => {
    expect(STATE_VERSION).toBe(CURRENT_STATE_VERSION);
    expect(STATE_VERSION).toBeGreaterThanOrEqual(35);
  });

  it('does NOT ship a default - an absent key means "never claimed"', () => {
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
