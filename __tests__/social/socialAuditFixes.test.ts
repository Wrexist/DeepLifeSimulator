/**
 * Regression tests for the 2026-10 social audit (SOC-*). Each block names the
 * finding it pins; every one of them failed on the tree before the fix.
 */
import type { GameState, Loan, RealEstate, Relationship } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { calculateDivorceCosts, fileDivorce, projectDivorcePayment } from '@/contexts/game/actions/DatingActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import {
  borrowBlockedReason,
  lendBlockedReason,
  removeContact,
} from '@/contexts/game/actions/ContactsActions';
import { exposeCatfish, reportProfile, resolveJealousy } from '@/contexts/game/actions/SparkActions';
import { processSparkWeeklyTick } from '@/lib/dating/sparkTick';
import { JEALOUSY_CONFESS_SEVERITY } from '@/lib/dating/jealousyFlavor';
import { isAchievementEarned } from '@/src/features/onboarding/achievementsData';
import { continueAsChild } from '@/lib/prestige/prestigeExecution';
import { syncChildContactAfterParenting } from '@/lib/parenting';
import { rotateWantIfDue, WANT_ROTATION_WEEKS } from '@/lib/social/npcDepth';

/** Synchronous stand-in for React's setter: applies each updater in order. */
function makeSetter(state: { current: GameState }) {
  return (update: GameState | ((prev: GameState) => GameState)) => {
    state.current = typeof update === 'function' ? update(state.current) : update;
  };
}

const person = (over: Partial<Relationship> & Pick<Relationship, 'id' | 'type'>): Relationship => ({
  name: 'Alex',
  relationshipScore: 70,
  personality: 'kind',
  gender: 'female',
  age: 30,
  ...over,
});

const deps = { updateMoney, updateStats };

describe('SOC-18 - "Social Life" is not earned by the seeded parents', () => {
  it('a fresh life has not made a friend yet', () => {
    expect(isAchievementEarned(createTestGameState(), 'beginner_social_life')).toBe(false);
  });

  it('a friend earns it', () => {
    const state = createTestGameState({
      relationships: [...createTestGameState().relationships, person({ id: 'f1', type: 'friend' })],
    });
    expect(isAchievementEarned(state, 'beginner_social_life')).toBe(true);
  });
});

describe('SOC-7 - Remove contact is not a free break up', () => {
  it('refuses a partner and leaves the relationship in place', () => {
    const partner = person({ id: 'p1', type: 'partner', engagementWeek: 10 });
    const state = { current: createTestGameState({ relationships: [partner] }) };
    const r = removeContact(state.current, makeSetter(state), 'p1');
    expect(r.success).toBe(false);
    expect(state.current.relationships.some((x) => x.id === 'p1')).toBe(true);
  });

  it('still removes a friend', () => {
    const state = { current: createTestGameState({ relationships: [person({ id: 'f1', type: 'friend' })] }) };
    expect(removeContact(state.current, makeSetter(state), 'f1').success).toBe(true);
    expect(state.current.relationships.some((x) => x.id === 'f1')).toBe(false);
  });
});

describe('SOC-17 - no borrowing from or lending to a minor child', () => {
  it('blocks both money rows for a toddler', () => {
    const state = createTestGameState({ relationships: [person({ id: 'c1', type: 'child', age: 1, name: 'Mia' })] });
    expect(borrowBlockedReason(state, 'c1')).toMatch(/too young/);
    expect(lendBlockedReason(state, 'c1')).toMatch(/too young/);
  });

  it('allows an adult child', () => {
    const state = createTestGameState({ relationships: [person({ id: 'c1', type: 'child', age: 25 })] });
    expect(borrowBlockedReason(state, 'c1')).toBeNull();
    expect(lendBlockedReason(state, 'c1')).toBeNull();
  });
});

describe('SOC-8 - a divorce cannot erase a pregnancy', () => {
  it('refuses while the spouse is expecting, and keeps the spouse', () => {
    const spouse = person({ id: 's1', type: 'spouse', isPregnant: true, pregnancyStartWeek: 495 });
    const state = { current: createTestGameState({ weeksLived: 500, relationships: [spouse] }) };
    const r = fileDivorce(state.current, makeSetter(state), 's1', deps);
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/expecting/);
    expect(state.current.relationships.find((x) => x.id === 's1')?.isPregnant).toBe(true);
  });
});

describe('SOC-6 - a divorce works on equity and discharges the mortgage it sells against', () => {
  const home = (over: Partial<RealEstate> = {}): RealEstate => ({
    id: 'h1',
    name: 'Family Home',
    price: 500_000,
    currentValue: 500_000,
    weeklyHappiness: 0,
    weeklyEnergy: 0,
    owned: true,
    interior: [],
    upgradeLevel: 0,
    currentResidence: true,
    mortgageId: 'm1',
    ...over,
  });
  const mortgage = (remaining: number): Loan => ({
    id: 'm1',
    name: 'Mortgage',
    principal: 400_000,
    remaining,
    rateAPR: 0.05,
    termWeeks: 1560,
    weeklyPayment: 400,
    startWeek: 0,
    autoPay: true,
    type: 'mortgage',
    weeksRemaining: 1000,
    interestRate: 0.05,
  });
  const married = (property: RealEstate, loan: Loan) =>
    createTestGameState({
      weeksLived: 500,
      lastDivorceWeek: 0,
      stats: { ...createTestGameState().stats, money: 10_000 },
      bankSavings: 0,
      stocks: { watchlist: [], holdings: [] },
      companies: [],
      realEstate: [property],
      loans: [loan],
      relationships: [person({ id: 's1', type: 'spouse' })],
    });

  it('settles on equity, sells the home net of the mortgage and pays the mortgage off', () => {
    const state = { current: married(home(), mortgage(300_000)) };
    const r = fileDivorce(state.current, makeSetter(state), 's1', deps);
    expect(r.success).toBe(true);
    // Equity is $500k - $300k = $200k, plus $10k cash. At the 35% ceiling plus
    // the $5k fee that is at most $78,500. On gross value it could reach $183,500.
    expect(r.settlement).toBeLessThanOrEqual(Math.ceil(210_000 * 0.35) + 5_000);
    expect(state.current.realEstate.find((p) => p.id === 'h1')?.owned).toBe(false);
    expect((state.current.loans ?? []).some((l) => l.id === 'm1')).toBe(false);
    expect(r.message).toMatch(/somewhere new to live/);
  });

  it('does not sell an underwater home, which would raise nothing', () => {
    const state = { current: married(home({ price: 300_000, currentValue: 300_000 }), mortgage(290_000)) };
    const r = fileDivorce(state.current, makeSetter(state), 's1', deps);
    expect(r.success).toBe(true);
    expect(state.current.realEstate.find((p) => p.id === 'h1')?.owned).toBe(true);
    expect((state.current.loans ?? []).some((l) => l.id === 'm1')).toBe(true);
  });
});

describe('SOC-5 - the divorce preview projects the same waterfall the divorce runs', () => {
  it('counts savings: $4,999 cash and $1M saved pays in full, no assets sold, no loan', () => {
    const p = projectDivorcePayment({ cash: 4_999, savings: 1_000_000, stockLiquidity: 0, propertyLiquidity: 0 }, 205_000);
    expect(p.projectedDebt).toBe(0);
    expect(p.usesAssets).toBe(false);
    expect(p.moneyAfter).toBe(4_999 + 1_000_000 - 205_000);
  });

  it('flags a forced sale and the settlement loan when cash and savings fall short', () => {
    const p = projectDivorcePayment({ cash: 0, savings: 0, stockLiquidity: 50_000, propertyLiquidity: 0 }, 80_000);
    expect(p.usesAssets).toBe(true);
    expect(p.projectedDebt).toBe(80_000 - (50_000 - 1_000));
  });

  it('calculateDivorceCosts hands the screen the same liquidity the action drains', () => {
    const state = createTestGameState({
      stats: { ...createTestGameState().stats, money: 4_999 },
      bankSavings: 1_000_000,
      relationships: [person({ id: 's1', type: 'spouse' })],
    });
    const costs = calculateDivorceCosts(state, 's1');
    expect(costs?.liquidity.cash).toBe(4_999);
    expect(costs?.liquidity.savings).toBe(1_000_000);
    expect(costs?.projectedDebt).toBe(0);
  });
});

describe('SOC-14 - a jealousy confrontation does not outlive the relationship', () => {
  const withOrphanedJealousy = () => {
    const base = createTestGameState({ weeksLived: 300, relationships: [] });
    return createTestGameState({
      weeksLived: 300,
      relationships: [],
      sparkApp: {
        ...base.sparkApp!,
        activeJealousy: {
          id: 'sj-1',
          partnerId: 'gone',
          triggerType: 'spotted_swiping',
          severity: 60,
          startedWeek: 299,
          resolved: false,
        },
      },
    });
  };

  it('the Spark tick drops an event whose accuser is no longer a partner', () => {
    const { sparkApp } = processSparkWeeklyTick(withOrphanedJealousy(), 301);
    expect(sparkApp.activeJealousy).toBeNull();
  });

  it('answering it costs no reputation', () => {
    const state = { current: withOrphanedJealousy() };
    const before = state.current.stats.reputation;
    const r = resolveJealousy(makeSetter(state), state.current, 'caught_cheating');
    expect(r.reputationDelta).toBe(0);
    expect(state.current.stats.reputation).toBe(before);
    expect(state.current.sparkApp?.activeJealousy).toBeNull();
  });
});

describe('SOC-15 - the "Confess the affair" severity band is reachable', () => {
  it('spawns severities at or above the confess threshold across weeks', () => {
    const base = createTestGameState();
    const state = createTestGameState({
      lineageId: 'soc15',
      relationships: [person({ id: 's1', type: 'spouse', relationshipScore: 90 })],
      sparkApp: { ...base.sparkApp!, swipesUsedThisWeek: 20, activeJealousy: null },
    });
    const severities: number[] = [];
    for (let week = 1000; week < 1400; week++) {
      const ev = processSparkWeeklyTick(state, week).sparkApp.activeJealousy;
      if (ev) severities.push(ev.severity);
    }
    expect(severities.length).toBeGreaterThan(50);
    expect(Math.min(...severities)).toBeGreaterThanOrEqual(40);
    expect(Math.max(...severities)).toBeLessThan(90);
    expect(severities.some((s) => s >= JEALOUSY_CONFESS_SEVERITY)).toBe(true);
  });
});

describe('SOC-19 - exposing a catfish you are dating ends the relationship', () => {
  const dating = () => {
    const base = createTestGameState();
    return createTestGameState({
      relationships: [person({ id: 'm1', type: 'partner', name: 'Fake' })],
      sparkApp: {
        ...base.sparkApp!,
        matches: [{ id: 'm1', profileId: 'prof-1', matchedWeek: 1, superLiked: false, promoted: true }],
      },
    });
  };

  it('expose removes the partner it created', () => {
    const state = { current: dating() };
    const r = exposeCatfish(makeSetter(state), state.current, 'prof-1');
    expect(r.success).toBe(true);
    expect(state.current.relationships.some((x) => x.id === 'm1')).toBe(false);
  });

  it('report refuses instead of quietly unmatching a live partner', () => {
    const state = { current: dating() };
    const r = reportProfile(state.current, makeSetter(state), 'prof-1');
    expect(r.success).toBe(false);
    expect(state.current.relationships.some((x) => x.id === 'm1')).toBe(true);
  });
});

describe('SOC-2 - parenting counts as contact on the child\'s Contacts record', () => {
  it('mirrors the Family Bond and stamps recency on the matching child only', () => {
    const rels: Relationship[] = [
      person({ id: 'c1', type: 'child', age: 3, relationshipScore: 40, lastInteractionWeek: 10 }),
      person({ id: 'f1', type: 'friend', relationshipScore: 40, lastInteractionWeek: 10 }),
    ];
    const next = syncChildContactAfterParenting(rels, { id: 'c1', relationshipScore: 92 }, 500);
    expect(next[0]).toMatchObject({ relationshipScore: 92, lastInteractionWeek: 500, weeklyInteractions: 1 });
    expect(next[1]).toBe(rels[1]);
  });

  it('a stamped child is not docked by the ignored-want cycle', () => {
    // A needy want assigned at week 100, unmet - due to rotate this week.
    const child = person({
      id: 'c1', type: 'child', age: 3, relationshipScore: 80, lastInteractionWeek: 90,
      npcWant: { id: 'hear_from_you', label: 'Wants to hear from you', since: 100, satisfiedCount: 0 },
    });
    const dueWeek = 100 + WANT_ROTATION_WEEKS;
    // Control: never parented, the cycle docks the Contacts bond.
    expect(rotateWantIfDue(child, dueWeek, () => 'm1').rel.relationshipScore).toBeLessThan(80);
    // Parented mid-cycle: no dock.
    const [parented] = syncChildContactAfterParenting([child], { id: 'c1', relationshipScore: 80 }, 102);
    expect(rotateWantIfDue(parented, dueWeek, () => 'm1').rel.relationshipScore).toBe(80);
  });
});

describe('SOC-10 - a minor heir is born in the right year and time passes', () => {
  it('a 4-year-old heir takes over 14 years later, born when they were born', () => {
    const base = createTestGameState();
    const parentLife = createTestGameState({
      date: { ...base.date, year: 2050, age: 22 },
      family: {
        ...base.family,
        children: [{ ...person({ id: 'kid-1', type: 'child', age: 4, name: 'Heir Kid' }) }],
      },
    });
    const next = continueAsChild(parentLife, 'kid-1');
    expect(next.date.year).toBe(2064);
    expect(next.familyTreeData?.members['kid-1']?.birthYear).toBe(2046);
  });
});
