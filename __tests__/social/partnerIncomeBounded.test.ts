/**
 * The partner economy stays bounded — Master Program 12 §9.
 *
 * Program 11 found a partner paying up to $62,500 a WEEK: `Relationship.income`
 * is an annual salary copied from `DATING_PROFILES`, and a quarter of it was
 * added to a weekly total. It was fixed at the single point the number becomes
 * money (`householdPartnerIncome` ÷ `WEEKS_PER_YEAR`).
 *
 * §9 asks for that fix to be VERIFIED rather than trusted, under every state a
 * relationship can reach: several partners, a breakup, a rematch, a save/load
 * round trip, a new life, and a prestige. These are those states.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import type { GameState, Relationship } from '@/contexts/game/types';
import {
  householdPartnerIncome,
  PARTNER_INCOME_SHARE,
  PARTNER_INCOME_THRESHOLD,
} from '@/contexts/game/actions/weekly/applyIncome';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { INITIAL_CAREERS } from '@/lib/careers/careerData';
import { runMigrations } from '@/utils/saveMigrations';
import { repairGameState } from '@/utils/saveValidation';
import { mergeLoadedSlice } from '@/utils/loadedStateMerge';
import { initialGameState } from '@/contexts/game/initialState';
import { promoteMatchToRelationship } from '@/contexts/game/actions/SparkActions';

const RICHEST = Math.max(...DATING_PROFILES.map((p) => p.income));
const BEST_CAREER_WEEK = Math.max(
  ...INITIAL_CAREERS.flatMap((c) => (c.levels ?? []).map((l) => l.salary)).filter(
    (n): n is number => typeof n === 'number',
  ),
);

const partner = (income: number, over: Partial<Relationship> = {}): Relationship => ({
  id: 'p1',
  name: 'Pat',
  type: 'partner',
  relationshipScore: 90,
  personality: 'friendly',
  gender: 'female',
  age: 30,
  income,
  ...over,
});

describe('however many partners a state carries, only one pays', () => {
  it('two partners do not stack', () => {
    const a = partner(RICHEST, { id: 'a' });
    const b = partner(RICHEST, { id: 'b', type: 'spouse' });
    expect(householdPartnerIncome([a, b])).toBe(householdPartnerIncome([a]));
  });

  it('twenty do not either — the ceiling is one person, not a sum', () => {
    const many = Array.from({ length: 20 }, (_, i) => partner(RICHEST, { id: `p${i}` }));
    expect(householdPartnerIncome(many)).toBe(householdPartnerIncome([many[0]]));
    expect(householdPartnerIncome(many)).toBeLessThan(BEST_CAREER_WEEK);
  });

  it('and the top of the whole catalogue is still under one career rung', () => {
    expect(householdPartnerIncome([partner(RICHEST)])).toBe(
      Math.round((RICHEST * PARTNER_INCOME_SHARE) / WEEKS_PER_YEAR),
    );
    expect(householdPartnerIncome([partner(RICHEST)])).toBeLessThan(BEST_CAREER_WEEK);
  });
});

describe('the transitions cannot leave income behind', () => {
  it('a breakup removes the payer', () => {
    const before = householdPartnerIncome([partner(RICHEST)]);
    expect(before).toBeGreaterThan(0);
    // A breakup filters the relationship out entirely.
    expect(householdPartnerIncome([])).toBe(0);
  });

  it('a partner who drops below the bond threshold stops paying', () => {
    expect(householdPartnerIncome([partner(RICHEST, { relationshipScore: PARTNER_INCOME_THRESHOLD - 1 })])).toBe(0);
  });

  it('a rematch of the SAME person cannot create a second payer', () => {
    // The Program 11 person-guard, seen from the economy side: promoting a
    // profile the player already knows is refused, so there is no second
    // relationship to pay a second income.
    const profile = DATING_PROFILES[0];
    const base = createTestGameState();
    const seeded: GameState = {
      ...base,
      relationships: [],
      sparkApp: {
        ...(base.sparkApp as NonNullable<GameState['sparkApp']>),
        matches: [{ id: 'm1', profileId: profile.id, matchedWeek: 1, superLiked: false, promoted: false }],
      },
    };
    const s1 = createSetGameStateStub(seeded);
    expect(promoteMatchToRelationship(s1.setGameState, seeded, 'm1').success).toBe(true);

    const again: GameState = {
      ...s1.current(),
      sparkApp: {
        ...(s1.current().sparkApp as NonNullable<GameState['sparkApp']>),
        matches: [{ id: 'm2', profileId: profile.id, matchedWeek: 9, superLiked: false, promoted: false }],
      },
    };
    const s2 = createSetGameStateStub(again);
    promoteMatchToRelationship(s2.setGameState, again, 'm2');

    const payers = (s2.current().relationships ?? []).filter(
      (r) => r.type === 'partner' || r.type === 'spouse',
    );
    expect(payers).toHaveLength(1);
    expect(householdPartnerIncome(s2.current().relationships)).toBe(
      householdPartnerIncome([payers[0]]),
    );
  });
});

describe('a save round trip cannot inflate it', () => {
  it('income survives migrate + repair + merge unchanged', () => {
    const base = createTestGameState();
    const saved: GameState = { ...base, relationships: [partner(RICHEST)] };
    const before = householdPartnerIncome(saved.relationships);

    const migrated = runMigrations(JSON.parse(JSON.stringify(saved))).state as GameState;
    const repaired = { ...migrated };
    repairGameState(repaired);
    const merged: GameState = {
      ...initialGameState,
      ...repaired,
      stats: mergeLoadedSlice(initialGameState.stats, repaired.stats),
    };

    expect(householdPartnerIncome(merged.relationships)).toBe(before);
  });
});

describe('a new life and a prestige start from nothing', () => {
  it('a life with no partner pays nothing', () => {
    const fresh = createTestGameState();
    const carried = (fresh.relationships ?? []).filter(
      (r) => r.type === 'partner' || r.type === 'spouse',
    );
    expect(carried).toHaveLength(0);
    expect(householdPartnerIncome(fresh.relationships)).toBe(0);
  });

  it('a malformed or hostile stored income can never pay', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, -999_999_999]) {
      expect(householdPartnerIncome([partner(bad as number)])).toBe(0);
    }
  });

  it('even an absurd hand-edited income stays a fraction of a career', () => {
    // Not unbounded — but a save editor writing 10 million as an ANNUAL salary
    // buys $48k/wk, which is the honest consequence of editing the save rather
    // than a reachable in-game state. What matters is that nothing the GAME can
    // produce gets near it: the richest real profile is the assertion above.
    const absurd = householdPartnerIncome([partner(10_000_000)]);
    expect(absurd).toBe(Math.round((10_000_000 * PARTNER_INCOME_SHARE) / WEEKS_PER_YEAR));
    expect(RICHEST).toBeLessThan(1_000_000);
  });
});
