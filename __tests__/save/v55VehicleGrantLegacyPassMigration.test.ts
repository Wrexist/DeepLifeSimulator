/**
 * v55: one bump, two changes (CLAUDE.md §7).
 *
 * (1) `Vehicle.reputationGranted` is a carve-out: the migration writes nothing,
 *     and a car bought before v55 keeps the take-back-the-whole-bonus rule.
 * (2) Legacy Pass make-good: the PAID track's tier-25 capstone granted an inert
 *     trait; it pays 3 Youth Pills now. A save that shows the capstone claimed
 *     on a premium pass AND the inert trait that claim delivered gets the 3
 *     pills, once. The claim alone is not proof (Codex review, PR #241): a v54
 *     save written after the reward changed has the claim with pills paid.
 */
import { runMigrations } from '@/utils/saveMigrations';
import { repairGameState } from '@/utils/saveValidation';
import { STATE_VERSION } from '@/contexts/game/initialState';
import { MAX_TIER, getLegacyPassReward } from '@/lib/legacyPass/legacyPass';
import { createVehicleFromTemplate, getVehicleTemplate } from '@/lib/vehicles/vehicles';
import { createTestGameState } from '../helpers/createTestGameState';

type AnyState = Record<string, any>;

function v54Save(over: AnyState = {}): AnyState {
  const s = JSON.parse(JSON.stringify(createTestGameState({ weeksLived: 300 }))) as AnyState;
  s.version = 54;
  return { ...s, ...over };
}

const pass = (claimedPremiumTiers: number[], premiumOwned = true) => ({
  seasonId: 'season-test',
  xp: 99_999,
  premiumOwned,
  claimedFreeTiers: [],
  claimedPremiumTiers,
  ownedCosmetics: [],
});

const migrate = (s: AnyState): AnyState => runMigrations(JSON.parse(JSON.stringify(s))).state as AnyState;

describe('v55 Legacy Pass make-good', () => {
  it('the capstone the migration names is the one the pass pays pills for now (otherwise this proves nothing)', () => {
    expect(MAX_TIER).toBe(25);
    const reward = getLegacyPassReward('premium', 25);
    expect(reward).toEqual(expect.objectContaining({ kind: 'youthPills', amount: 3 }));
  });

  const OLD = { activeTraits: ['strong_constitution'] };

  it('a premium save that claimed the old inert capstone gets 3 Youth Pills', () => {
    const out = migrate(v54Save({ ...OLD, youthPills: 2, legacyPass: pass([1, 2, 3, 24, 25]) }));
    expect(out.version).toBe(STATE_VERSION);
    expect(out.youthPills).toBe(5);
  });

  it('runs once: a save already at v55 is not paid again', () => {
    const once = migrate(v54Save({ ...OLD, youthPills: 0, legacyPass: pass([25]) }));
    expect(once.youthPills).toBe(3);
    expect(migrate(once).youthPills).toBe(3);
  });

  it.each([
    ['capstone not claimed', pass([1, 2, 24])],
    ['no premium pass', pass([25], false)],
    ['no pass at all', undefined],
    ['malformed claims', { ...pass([]), claimedPremiumTiers: 'oops' }],
  ])('pays nothing when %s', (_label, legacyPass) => {
    const out = migrate(v54Save({ ...OLD, youthPills: 4, legacyPass }));
    expect(out.youthPills).toBe(4);
  });

  it('the earlier inert capstone id (legacy_trait_s) is proof too', () => {
    const out = migrate(v54Save({ activeTraits: ['fit', 'legacy_trait_s'], youthPills: 0, legacyPass: pass([25]) }));
    expect(out.youthPills).toBe(3);
  });

  it('a claim already paid in pills (no inert trait) is not paid again', () => {
    // A v54 save from a build with the new reward: tier 25 claimed, the 3
    // pills already in the count, no trait - Codex's case.
    const out = migrate(v54Save({ activeTraits: [], youthPills: 3, legacyPass: pass([25]) }));
    expect(out.youthPills).toBe(3);
  });

  it('scenario traits are not proof', () => {
    const out = migrate(v54Save({ activeTraits: ['fit', 'smart', 'criminal'], youthPills: 0, legacyPass: pass([25]) }));
    expect(out.youthPills).toBe(0);
  });

  it('a corrupt pill count is treated as 0, never NaN', () => {
    const out = migrate(v54Save({ ...OLD, youthPills: Number.NaN, legacyPass: pass([25]) }));
    expect(out.youthPills).toBe(3);
  });
});

describe('v55 Vehicle.reputationGranted is a carve-out', () => {
  it('writes nothing onto vehicles bought before v55', () => {
    const car = createVehicleFromTemplate(getVehicleTemplate('sport_motorcycle')!, 0);
    const out = migrate(v54Save({ vehicles: [car] }));
    expect(out.vehicles).toHaveLength(1);
    expect('reputationGranted' in out.vehicles[0]).toBe(false);
  });

  it('keeps a recorded grant through the migration', () => {
    const car = { ...createVehicleFromTemplate(getVehicleTemplate('sport_motorcycle')!, 0), reputationGranted: 4 };
    const out = migrate(v54Save({ vehicles: [car] }));
    expect(out.vehicles[0].reputationGranted).toBe(4);
  });
});

describe('v55 repair mirror for youthPills', () => {
  it.each([undefined, Number.NaN, -2, 'three'])('a partial save with youthPills=%s is repaired to 0', (bad) => {
    const s = JSON.parse(JSON.stringify(createTestGameState())) as AnyState;
    s.youthPills = bad;
    repairGameState(s as never);
    expect(s.youthPills).toBe(0);
  });

  it('a real count is left alone', () => {
    const s = JSON.parse(JSON.stringify(createTestGameState({ youthPills: 7 }))) as AnyState;
    repairGameState(s as never);
    expect(s.youthPills).toBe(7);
  });
});
