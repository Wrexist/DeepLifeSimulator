/**
 * Every Mindset effect, proved on the function the game actually pays or
 * charges through - with the Mindset and without it, everything else equal.
 *
 * The table and the copy live in lib/mindset/effects.ts and are pinned by
 * __tests__/actions/mindsetEffects.test.ts. This file is the other half: a
 * number in the table that no system applies is exactly the bug the Mindset
 * system had for most of its life (eleven cards, one street-job reader), so
 * each row is checked at its seam, and the tick-level ones on the real
 * `nextWeek` (CLAUDE.md §4.3: measured on the tick, not read off the code).
 */

/* eslint-disable import/first -- jest.mock goes above the imports, matching the stress suites. */

jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));

import React, { type Dispatch, type SetStateAction } from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
import { createTestGameState } from '../helpers/createTestGameState';
import { zeroPreRolls } from '../helpers/zeroPreRolls';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState, RealEstate, Relationship } from '@/contexts/game/types';
import type { MindsetId } from '@/lib/mindset/config';
import { mindsetEffects, weeksWithoutTrip, NEUTRAL_MINDSET_EFFECTS } from '@/lib/mindset/effects';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';
import { careerPayMultiplier } from '@/lib/careers/weeklySalary';
import { applyCareerProgress } from '@/contexts/game/actions/weekly/applyCareerProgress';
import { projectWeeklyVitalDrift, projectedDecayRate } from '@/lib/economy/vitalDrift';
import { scaledHappinessGain } from '@/lib/economy/happinessGain';
import { recordInteraction } from '@/contexts/game/actions/ContactsActions';
import { DATE_CONFIGS, goOnDate } from '@/contexts/game/actions/DatingActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { processWeeklyNPCDepth, WANT_ROTATION_WEEKS } from '@/lib/social/npcDepth';
import { applyNPCDepthTick } from '@/contexts/game/actions/weekly/applyNPCDepthTick';
import { quoteTrip, tripHappiness } from '@/lib/travel/operations';
import { DESTINATIONS } from '@/lib/travel/destinations';
import { buyItem } from '@/contexts/game/actions/ItemActions';
import { resolveFoodPurchase } from '@/lib/economy/foodPurchase';
import { LUXURY_CATALOG } from '@/lib/luxury/catalog';
import { applyLuxuryItemsForWeek } from '@/contexts/game/actions/weekly/applyLuxuryItems';
import { dividendYieldModifiers, playerDividendYield } from '@/lib/stocks/dividends';
import { applyRentAndHousing } from '@/contexts/game/actions/weekly/applyRentAndHousing';
import { quotePropertyPurchase } from '@/contexts/game/actions/RealEstateActions';

const WEEK = 400;

function life(id: MindsetId | null, over: Parameters<typeof createTestGameState>[0] = {}): GameState {
  return createTestGameState({
    weeksLived: WEEK,
    lifeStartWeek: WEEK - 10,
    stats: { money: 100_000, energy: 100, health: 70, happiness: 70 },
    ...(id ? { mindset: { activeTraitId: id, traits: [id] } } : {}),
    ...over,
  } as never);
}

/** Run an action's updaters synchronously against `state`. */
function runAction(state: GameState, act: (set: Dispatch<SetStateAction<GameState>>) => void): GameState {
  let next = state;
  act((update) => {
    next = typeof update === 'function' ? update(next) : update;
  });
  return next;
}

function weekCtx(mindset = NEUTRAL_MINDSET_EFFECTS): WeekContext {
  return {
    newStats: { health: 50, happiness: 50, energy: 50, fitness: 50, money: 100_000, reputation: 0, gems: 0 },
    notifications: [],
    preRolls: zeroPreRolls(),
    nextWeeksLived: WEEK + 1,
    mindset: { ...mindset },
  };
}

// ── Work ────────────────────────────────────────────────────────────────────

describe('Workaholic: career pay +10%', () => {
  it('raises the multiplier every paycheck and job listing reads', () => {
    expect(careerPayMultiplier(life('workaholic')) / careerPayMultiplier(life(null))).toBeCloseTo(1.1, 10);
  });
});

describe('Perfectionist: promotions come 15% faster', () => {
  const s = life(null);
  const careers = s.careers.map((c, i) => (i === 0 ? { ...c, accepted: true, applied: true, level: 0, progress: 0, performance: 60, startedWeeksLived: WEEK - 100 } : c));
  const job = careers[0].id;
  const progress = (mindsetProgressMult: number, lifeSkillCareerProgressMult = 1) => applyCareerProgress({
    prevCareers: careers,
    currentJob: job,
    nextWeeksLived: WEEK + 1,
    newStats: { ...s.stats, health: 70, happiness: 70, energy: 70 },
    legacyBuffs: undefined,
    goldMindset: false,
    perkMindset: false,
    mindsetProgressMult,
    lifeSkillCareerProgressMult,
  }).updatedCareers.find((c) => c.id === job)!.progress;

  it('the Leadership life skill is no longer rounded away either (+10% on a 6.5-point week)', () => {
    expect(progress(1, 1.1)).toBeGreaterThan(progress(1));
  });

  it('scales the weekly progress applyCareerProgress grants', () => {
    const run = (mult: number) => progress(mult);
    const plain = run(1);
    const perfect = run(mindsetEffects(life('perfectionist')).careerProgress);
    expect(plain).toBeGreaterThan(0);
    // Its own rounded step of at least one point - folded into one rounding, a
    // typical 6.5-point week rounded to 7 with or without the 15%.
    expect(perfect).toBeGreaterThanOrEqual(plain + 1);
    expect(Math.abs(perfect - plain * 1.15)).toBeLessThanOrEqual(1);
  });
});

// ── Body and mind ───────────────────────────────────────────────────────────

describe("Home's vitals projection applies the same decay factors as the tick", () => {
  const decay = (s: GameState) => projectWeeklyVitalDrift(s).causes.find((c) => c.id === 'decay')!;

  it('Workaholic: health wears down 20% faster; Perfectionist: happiness does', () => {
    const plain = decay(life(null));
    const rate = projectedDecayRate(life(null));
    expect(decay(life('workaholic')).health).toBe(-Math.round(rate * 0.6 * 1.2));
    expect(decay(life('workaholic')).happiness).toBe(plain.happiness);
    expect(decay(life('perfectionist')).happiness).toBe(-Math.round(rate * 0.8 * 1.2));
    expect(decay(life('perfectionist')).health).toBe(plain.health);
  });

  it('a restless Adventurer is labelled, and only once 26 weeks pass without a trip', () => {
    const fresh = life('adventurous', { lifeStartWeek: WEEK - 25 });
    const restless = life('adventurous', { lifeStartWeek: WEEK - 26 });
    expect(decay(fresh).label).toBe('Natural decay');
    expect(decay(restless).label).toBe('Natural decay (restless)');
  });
});

describe('Optimist: happiness gains are 15% bigger, before the diminishing curve', () => {
  it('scales a gain and leaves a loss alone', () => {
    expect(scaledHappinessGain(40, 10, 1.15)).toBeCloseTo(scaledHappinessGain(40, 10) * 1.15, 10);
    expect(scaledHappinessGain(40, -10, 1.15)).toBe(-10);
  });
});

describe('Adventurous: restless after 26 weeks without a trip', () => {
  it('counts from the last trip, or from the start of this life', () => {
    expect(weeksWithoutTrip(life(null, { lifeStartWeek: WEEK - 40 }))).toBe(40);
    const traveled = life(null, {
      lifeStartWeek: WEEK - 40,
      travel: { visitedDestinations: [], passportOwned: false, businessOpportunities: {}, travelHistory: [{ destinationId: 'paris', week: WEEK - 5, year: 2030 }] },
    });
    expect(weeksWithoutTrip(traveled)).toBe(5);
  });

  it('never counts a trip from before this life began (an heir carrying history)', () => {
    const heir = life(null, {
      lifeStartWeek: WEEK - 3,
      travel: { visitedDestinations: [], passportOwned: false, businessOpportunities: {}, travelHistory: [{ destinationId: 'paris', week: WEEK - 200, year: 2020 }] },
    });
    expect(weeksWithoutTrip(heir)).toBe(3);
  });

  it('only an Adventurer gets restless, and the factor is 1.25 on happiness decay', () => {
    const long = { lifeStartWeek: WEEK - 30 };
    expect(mindsetEffects(life('adventurous', long))).toMatchObject({ restless: true, happinessDecay: 1.25 });
    expect(mindsetEffects(life('perfectionist', long))).toMatchObject({ restless: false, happinessDecay: 1.2 });
    expect(mindsetEffects(life('adventurous', { lifeStartWeek: WEEK - 10 }))).toMatchObject({ restless: false, happinessDecay: 1 });
  });
});

// ── Relationships ───────────────────────────────────────────────────────────

const friend = (over: Partial<Relationship> = {}): Relationship => ({
  id: 'sam', name: 'Sam', type: 'friend', relationshipScore: 30,
  personality: 'balanced', gender: 'female', age: 30, ...over,
} as Relationship);

describe('Socialite: 25% more bond from calls, hangouts and dates; 25% more to pay', () => {
  it('a call builds more bond', () => {
    const run = (id: MindsetId | null) => {
      const s = life(id, { relationships: [friend()] });
      const next = runAction(s, (set) => recordInteraction(s, set, 'sam', 'call', 0, 3));
      return next.relationships!.find((r) => r.id === 'sam')!.relationshipScore - 30;
    };
    const plain = run(null);
    const social = run('socialite');
    expect(plain).toBeGreaterThan(0);
    expect(social).toBeGreaterThan(plain);
  });

  it('a hangout charges $38 instead of $30, and the base the screen passes is $30', () => {
    const run = (id: MindsetId | null) => {
      const s = life(id, { relationships: [friend()] });
      return s.stats.money - runAction(s, (set) => recordInteraction(s, set, 'sam', 'hangout', 30, 5)).stats.money;
    };
    expect(run(null)).toBe(30);
    expect(run('socialite')).toBe(38);
  });

  it('a date costs 25% more', () => {
    const partner = friend({ id: 'pat', name: 'Pat', type: 'partner', relationshipScore: 60 });
    const run = (id: MindsetId | null) => {
      const s = life(id, { relationships: [partner] });
      return s.stats.money - runAction(s, (set) => goOnDate(s, set, 'pat', 'coffee', { updateMoney, updateStats })).stats.money;
    };
    const base = DATE_CONFIGS.coffee.cost;
    expect(run(null)).toBe(base);
    expect(run('socialite')).toBe(Math.round(base * 1.25));
  });
});

describe('Hustler: an ignored want costs 3 bond instead of 2', () => {
  const neglected = (): Relationship => friend({
    relationshipScore: 50,
    npcWant: { id: 'quality_time', label: 'Wants to spend time together', since: WEEK - WANT_ROTATION_WEEKS, satisfiedCount: 0 },
    lastInteractionWeek: undefined,
  } as Partial<Relationship>);

  it('processWeeklyNPCDepth charges the loss it is given', () => {
    const plain = processWeeklyNPCDepth([neglected()], WEEK).relationships[0].relationshipScore;
    const hustled = processWeeklyNPCDepth([neglected()], WEEK, '', 3).relationships[0].relationshipScore;
    expect(plain).toBe(48);
    expect(hustled).toBe(47);
  });

  it('the tick hands it the Hustler loss from the week context', () => {
    const ctx = weekCtx(mindsetEffects(life('hustler')));
    const out = applyNPCDepthTick({ relationships: [neglected()], weeksLived: WEEK, lifeSalt: '' }, ctx);
    expect(out.relationships[0].relationshipScore).toBe(47);
  });
});

// ── Travel ──────────────────────────────────────────────────────────────────

describe('Adventurous: trips cost 15% less and give 25% more happiness', () => {
  const dest = DESTINATIONS.find((d) => !d.requirements?.items?.includes('passport') && (d.benefits?.happiness ?? 0) > 0)!;

  it('quoteTrip prices it for the Adventurer', () => {
    const a = quoteTrip(dest.id, life(null), WEEK);
    const b = quoteTrip(dest.id, life('adventurous'), WEEK);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(b.adjustedCost).toBe(Math.floor(a.baseCost * a.mods.costMultiplier * 0.85));
  });

  it("the trip's own happiness is 25% bigger (random events are not scaled)", () => {
    expect(tripHappiness(dest.benefits, 1.25)).toBe(Math.round(tripHappiness(dest.benefits) * 1.25));
  });
});

// ── Money ───────────────────────────────────────────────────────────────────

describe('Frugal pays 10% less at the market; a Big Spender 10% more', () => {
  it('buyItem charges it', () => {
    const run = (id: MindsetId | null) => {
      const s = life(id);
      const item = s.items.find((i) => i.price >= 100 && !i.owned)!;
      return s.stats.money - runAction(s, (set) => buyItem(s, set, item.id, { updateMoney })).stats.money;
    };
    const plain = run(null);
    expect(run('frugal')).toBeCloseTo(plain * 0.9, 6);
    expect(run('spender')).toBeCloseTo(plain * 1.1, 6);
  });

  it('food is charged the same way', () => {
    const run = (id: MindsetId | null) => {
      const s = life(id);
      const food = s.foods[0];
      const r = resolveFoodPurchase(s, food.id);
      expect(r.ok).toBe(true);
      return r.price;
    };
    expect(run('frugal')).toBeCloseTo(run(null) * 0.9, 6);
    expect(run('spender')).toBeCloseTo(run(null) * 1.1, 6);
  });
});

describe('Luxury happiness: Frugal 25% less, Big Spender 25% more', () => {
  it('the weekly luxury pass adds the scaled figure', () => {
    const item = LUXURY_CATALOG.find((i) => i.happiness >= 4)!;
    const gain = (id: MindsetId | null) => {
      const ctx = weekCtx(mindsetEffects(life(id)));
      applyLuxuryItemsForWeek([item.id], ctx, {});
      return ctx.newStats.happiness - 50;
    };
    expect(gain(null)).toBe(item.happiness);
    expect(gain('frugal')).toBe(Math.round(item.happiness * 0.75));
    expect(gain('spender')).toBe(Math.round(item.happiness * 1.25));
  });
});

describe('Investor: dividends and rent +15%, property 5% dearer to buy', () => {
  it('dividends: the yield the tick pays and the Stocks screen estimates', () => {
    expect(playerDividendYield(0.04, dividendYieldModifiers(life('investor'))))
      .toBeCloseTo(playerDividendYield(0.04, dividendYieldModifiers(life(null))) * 1.15, 10);
  });

  it('rent: the realized rent from a tenant is 15% higher', () => {
    const tenant = { id: 't1', name: 'Sam', satisfaction: 95, movedInWeek: 0, weeklyRent: 1500 };
    const unit = (): RealEstate => ({
      id: 'p1', name: 'Apt', price: 200_000, weeklyHappiness: 5, weeklyEnergy: 2, owned: true, interior: [],
      upgradeLevel: 0, purchasePrice: 200_000, purchasedWeek: 0, currentValue: 200_000, condition: 95,
      marketCycle: 'stable', cycleWeeksRemaining: 26, rentMode: 'longTerm', status: 'rented', rent: 1500, tenant,
    } as RealEstate);
    const plain = applyRentAndHousing([unit()], 5, () => 0.99, weekCtx(), []).housingRentalIncome;
    const invested = applyRentAndHousing([unit()], 5, () => 0.99, weekCtx(mindsetEffects(life('investor'))), []).housingRentalIncome;
    // The multiplier scales the REALIZED rent (after vacancy and carrying cost).
    expect(plain).toBeGreaterThan(0);
    expect(invested).toBeCloseTo(plain * 1.15, 0);
  });

  it('property: the quote every buy reads is 5% higher', () => {
    const s = life(null);
    const property = { id: 'q1', name: 'House', price: 400_000, weeklyHappiness: 5, weeklyEnergy: 2, owned: false } as RealEstate;
    const plain = quotePropertyPurchase(s, property, 'standard', '30y', 5_000).effectivePrice!;
    const invested = quotePropertyPurchase(life('investor'), property, 'standard', '30y', 5_000).effectivePrice!;
    expect(invested).toBe(Math.round(plain * 1.05));
  });
});

// ── On the real tick ────────────────────────────────────────────────────────

const { act } = TestRenderer;
const h = React.createElement;
let captured: {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  game: ReturnType<typeof useGameActions>;
} | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const game = useGameActions();
  captured = { state: gameState, setGameState, game };
  return null;
}

/** One real `nextWeek` for a life that differs ONLY in its Mindset (and `over`). */
function oneWeek(id: MindsetId | null, over: Partial<GameState> = {}): GameState {
  captured = null;
  let root: { unmount: () => void } | undefined;
  act(() => {
    root = TestRenderer.create(h(UIUXProvider as never, null, h(GameProvider as never, null, h(ProbeComponent))));
  });
  try {
    act(() => captured!.setGameState((prev) => ({
      ...prev,
      lineageId: 'mindset-seam-test',
      weeksLived: WEEK,
      lifeStartWeek: WEEK - 10,
      date: { ...prev.date, age: 30, year: 2033 },
      stats: { ...prev.stats, money: 50_000, health: 60, happiness: 60, energy: 50, fitness: 50 },
      currentJob: undefined,
      careers: prev.careers.map((c) => ({ ...c, accepted: false, applied: false })),
      educations: [],
      dietPlans: [],
      loans: [],
      realEstate: [],
      relationships: [],
      overdueBalance: 0,
      rental: undefined,
      mindset: id ? { activeTraitId: id, traits: [id] } : { activeTraitId: undefined, traits: [] },
      ...over,
    })));
    act(() => { captured!.game.nextWeek(); });
    const state = captured!.state;
    expect(state.weeksLived).toBe(WEEK + 1);
    return state;
  } finally {
    act(() => root?.unmount());
  }
}

describe('on the real weekly tick', () => {
  jest.setTimeout(90000);

  it('a Workaholic loses more health, and the same happiness', () => {
    const plain = oneWeek(null);
    const work = oneWeek('workaholic');
    expect(work.stats.health).toBeLessThan(plain.stats.health);
    expect(work.stats.happiness).toBeCloseTo(plain.stats.happiness, 6);
  });

  it('a Perfectionist loses more happiness, and the same health', () => {
    const plain = oneWeek(null);
    const perfect = oneWeek('perfectionist');
    expect(perfect.stats.happiness).toBeLessThan(plain.stats.happiness);
    expect(perfect.stats.health).toBeCloseTo(plain.stats.health, 6);
  });

  it('a restless Adventurer loses more happiness; one back from a trip does not', () => {
    const long = { lifeStartWeek: WEEK - 40 };
    const plain = oneWeek(null, long);
    const restless = oneWeek('adventurous', long);
    const traveled = oneWeek('adventurous', {
      ...long,
      travel: { visitedDestinations: [], passportOwned: false, businessOpportunities: {}, travelHistory: [{ destinationId: 'paris', week: WEEK - 2, year: 2033 }] },
    });
    expect(restless.stats.happiness).toBeLessThan(plain.stats.happiness);
    expect(traveled.stats.happiness).toBeCloseTo(plain.stats.happiness, 6);
  });

  it("an Optimist's good week counts for more", () => {
    // A low start and the five happiest luxury items, so the week nets a GAIN.
    const joyful = LUXURY_CATALOG.slice().sort((a, b) => b.happiness - a.happiness).slice(0, 5).map((i) => i.id);
    const setup: Partial<GameState> = {
      stats: { ...createTestGameState().stats, money: 50_000_000, health: 60, happiness: 20, energy: 50, fitness: 50 },
      luxuryItems: joyful,
    };
    const plain = oneWeek(null, setup);
    const optimist = oneWeek('optimist', setup);
    expect(plain.stats.happiness).toBeGreaterThan(20);
    expect(optimist.stats.happiness).toBeGreaterThan(plain.stats.happiness);
  });
});
