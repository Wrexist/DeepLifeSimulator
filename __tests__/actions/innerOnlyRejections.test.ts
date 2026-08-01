/**
 * C-9 batch 2 — the two rejections that were reachable on a SINGLE tap.
 *
 * The ratchet counts 62 functions that reject inside a `setGameState` updater
 * and then return an unconditional success. That number reads alarming. A
 * function-by-function survey says it mostly is not:
 *
 *   For all but two, the inner `return prev` MIRRORS an outer guard that
 *   already returns a real failure. `publishVideo`'s weekly cap,
 *   `buyAccessory`'s already-owned check, `buyMinerUpgrade`'s max level,
 *   `claimStakingRewards`' empty-positions check, `purchasePassport`'s
 *   ownership check, `launchIPO`'s already-public check — every one is tested
 *   OUTSIDE first. The inner copy is the same-batch race guard, and it can only
 *   be reached by a second tap in one React batch, where reporting failure is
 *   the right answer anyway. So the unconditional success return is correct on
 *   the single tap that is 99% of real play.
 *
 * Two were not mirrored, and those are fixed here:
 *
 *   - `upgradeEnergySystem` refuses to re-buy the energy type the warehouse
 *     already runs, with no outer equivalent. A player tapping "Solar" while
 *     already on Solar was told "Upgraded to Solar Panels", charged nothing,
 *     and nothing changed.
 *   - `buildRDLab` had the same hole, and it was MINE: the C-3 fix earlier this
 *     round added the inner already-this-tier check so a double tap could not
 *     be charged twice, and left the success return alone without adding an
 *     outer guard.
 *
 * Both are fixed with an OUTER guard, not an outcome capture. A capture is only
 * readable for the first update in a React batch — measured in
 * `__tests__/refactor/updaterTimingContract.test.tsx`, and the reason the
 * `VehicleActions` batch had to be reverted. An outer guard has no timing
 * dependency at all and is correct on exactly the tap that produces the bug.
 *
 * This does NOT lower the ratchet: both still return an unconditional success
 * for their remaining race paths. The ratchet counts a SHAPE; this fixes the
 * HARM. The survey above is why those two numbers are not the same thing.
 *
 * 2026-08-01 audit round 4.
 */
import { upgradeEnergySystem } from '@/contexts/game/actions/MiningActions';
import { buildRDLab } from '@/contexts/game/actions/RDActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { LAB_TYPES } from '@/lib/rd/labs';
import { createTestGameState } from '../helpers/createTestGameState';
import type { Company, GameState } from '@/contexts/game/types';

function batched(initial: GameState) {
  let state = initial;
  const setState = ((update: React.SetStateAction<GameState>) => {
    if (typeof update !== 'function') throw new Error('non-functional updater');
    state = update(state);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

describe('C-9 — upgrading to the energy type you already have', () => {
  function withWarehouse(energyType: string, money = 10_000_000): GameState {
    const base = createTestGameState();
    return createTestGameState({
      stats: { ...base.stats, money },
      warehouse: { energyType, energyEfficiency: 1, automationLevel: 0, upgrades: [] },
    } as never);
  }

  it('is refused, and says so', () => {
    const snapshot = withWarehouse('solar');
    const { setState, get } = batched(snapshot);

    const r = upgradeEnergySystem(snapshot, setState, 'solar');

    expect(r.success).toBe(false);
    expect(r.message).toMatch(/already running/i);
    expect(get().stats.money).toBe(10_000_000);
  });

  it('a genuine switch to a DIFFERENT type still works (the control)', () => {
    // The guard is "not this one again", not "never upgrade".
    const snapshot = withWarehouse('solar');
    const { setState, get } = batched(snapshot);

    const r = upgradeEnergySystem(snapshot, setState, 'wind');

    expect(r.success).toBe(true);
    expect(get().warehouse?.energyType).toBe('wind');
    expect(get().stats.money).toBeLessThan(10_000_000);
  });

  it('and a broke player is still refused for the right reason (the control)', () => {
    const snapshot = withWarehouse('solar', 1);
    const { setState } = batched(snapshot);

    const r = upgradeEnergySystem(snapshot, setState, 'wind');

    expect(r.success).toBe(false);
    expect(r.message).toMatch(/insufficient funds/i);
  });
});

describe('C-9 — building the R&D lab tier you already have', () => {
  const TIERS = Object.keys(LAB_TYPES) as (keyof typeof LAB_TYPES)[];
  const COMPANY_ID = 'co-1';

  function withLab(labType: string | undefined, money = 10_000_000): GameState {
    const base = createTestGameState();
    return createTestGameState({
      stats: { ...base.stats, money },
      companies: [{
        id: COMPANY_ID,
        name: 'Acme',
        rdLab: labType ? { type: labType } : undefined,
      } as unknown as Company],
    });
  }

  it('the catalogue has at least two tiers (the premise)', () => {
    expect(TIERS.length).toBeGreaterThanOrEqual(2);
  });

  it('is refused, and says so', () => {
    const snapshot = withLab(TIERS[0]);
    const { setState, get } = batched(snapshot);

    const r = buildRDLab(snapshot, setState, COMPANY_ID, TIERS[0], { updateMoney });

    expect(r.success).toBe(false);
    expect(r.message).toMatch(/already has/i);
    expect(get().stats.money).toBe(10_000_000);
  });

  it('a first build still works (the control)', () => {
    const snapshot = withLab(undefined);
    const { setState, get } = batched(snapshot);

    const r = buildRDLab(snapshot, setState, COMPANY_ID, TIERS[0], { updateMoney });

    expect(r.success).toBe(true);
    expect(get().companies?.[0].rdLab?.type).toBe(TIERS[0]);
  });

  it('and a genuine UPGRADE to a higher tier still works (the control)', () => {
    const snapshot = withLab(TIERS[0]);
    const { setState, get } = batched(snapshot);

    const r = buildRDLab(snapshot, setState, COMPANY_ID, TIERS[1], { updateMoney });

    expect(r.success).toBe(true);
    expect(get().companies?.[0].rdLab?.type).toBe(TIERS[1]);
  });
});

describe('C-9 — the survey behind "62 is not 62 bugs"', () => {
  /**
   * Pins the claim in this file's header, so a future reader does not have to
   * take it on trust — and so that if one of these outer guards is ever
   * removed, the inner check silently becoming the only one is caught here.
   */
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, '..', '..', 'contexts/game/actions', rel), 'utf8');

  const MIRRORED: [string, string, RegExp][] = [
    ['ContentActions.ts', 'publishVideo', /videosThisWeek >= MAX_VIDEOS_PER_WEEK/],
    ['ContentActions.ts', 'buyAccessory', /if \(channel\.equipment\[id\]\) return \{ success: false/],
    ['MiningActions.ts', 'buyMinerUpgrade', /currentLevel >= definition\.maxLevel/],
    ['MiningActions.ts', 'claimStakingRewards', /stakingPositions\.length === 0/],
    ['TravelActions.ts', 'purchasePassport', /gameState\.travel\?\.passportOwned \|\| passportItem\?\.owned/],
    ['HustleActions.ts', 'launchIPO', /overlay\.ipo\.status === 'public'/],
  ];

  for (const [file, fn, outerGuard] of MIRRORED) {
    it(`${fn} tests its condition OUTSIDE the updater too`, () => {
      expect(`${fn}: ${outerGuard.test(read(file))}`).toBe(`${fn}: true`);
    });
  }

  it('the two fixed here now do as well', () => {
    expect(read('MiningActions.ts')).toMatch(/if \(gameState\.warehouse\.energyType === energyType\)/);
    expect(read('RDActions.ts')).toMatch(/if \(currentLabType === labType\)/);
  });

  it('and both keep their inner race guard (the control)', () => {
    // The outer guard handles the single tap; the inner one handles the second
    // tap in the same batch. Removing either reopens a different bug.
    expect(read('MiningActions.ts')).toMatch(/if \(prev\.warehouse\.energyType === energyType\) return prev;/);
    expect(read('RDActions.ts')).toMatch(/prevLabType === labType/);
  });
});
