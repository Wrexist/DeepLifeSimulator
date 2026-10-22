/**
 * Owner decisions on the 2026-10-21 audit, events and politics half
 * (EVT-1, EVT-15, EVT-16, EVT-18, EVT-20, LATE-8, LATE-15). Each block pins the
 * rule the decision set, against the shipped templates and helpers.
 */
import {
  eventTemplates,
  LEGAL_TEAM_WIN_CHANCE,
  LOBBYIST_BRIBE_USD,
  PARTNER_NEGOTIATION_SUCCESS_CHANCE,
  CAR_ACCIDENT_REPAIR_USD,
  type EventChoice,
  type EventTemplate,
  type WeeklyEvent,
} from '../engine';
import { CHAINED_EVENTS, FOLLOW_UP_EVENTS, checkForChainedEvent } from '../lifeEvents';
import { lifeMilestoneEventTemplates, LAWSUIT_DEFAULT_JUDGMENT_USD } from '../lifeMilestoneEvents';
import { economyEventTemplates } from '../economyEvents';
import { secretEventTemplates, isUnluckyThirteenLife, UNLUCKY_13_LIFE_CHANCE } from '../secretEvents';
import { investPartnerCapital } from '@/contexts/game/actions/CompanyActions';
import { addLifetimeDirtyMoney, clearScandalByLegalTeam } from '@/lib/politics/operations';
import { scandalProbability } from '@/lib/politics/scandals';
import { getPoliticalWeeklySalary } from '@/lib/economy/passiveIncome';
import { paidWeeklyCareerSalary } from '@/lib/careers/weeklySalary';
import { getKarmaModifiers, karmaEffectLines, INITIAL_KARMA, type KarmaState } from '@/lib/karma/karmaSystem';
import { createTestGameState, type TestGameStateOverrides } from '@/__tests__/helpers/createTestGameState';
import type { Company, GameState, PoliticalScandalEntry, PoliticsState, Relationship, Vehicle } from '@/contexts/game/types';

const ALL: EventTemplate[] = [...eventTemplates, ...lifeMilestoneEventTemplates, ...economyEventTemplates, ...secretEventTemplates];
const byId = (id: string): EventTemplate => {
  const t = ALL.find((x) => x.id === id);
  if (!t) throw new Error(`no template ${id}`);
  return t;
};
const state = (o: TestGameStateOverrides = {}) =>
  createTestGameState({ weeksLived: 400, lifeStartWeek: 0, ...o });
/** A complete PoliticsState, so no fixture needs a cast. */
const politicsAt = (careerLevel: number, extra: Partial<PoliticsState> = {}): PoliticsState => ({
  careerLevel, approvalRating: 50, policyInfluence: 0, electionsWon: 0, policiesEnacted: [],
  lobbyists: [], alliances: [], campaignFunds: 0, ...extra,
});
const choice = (e: WeeklyEvent, id: string): EventChoice => {
  const c = e.choices.find((x) => x.id === id);
  if (!c) throw new Error(`no choice ${id} on ${e.id}`);
  return c;
};

function company(over: Partial<Company> = {}): Company {
  return {
    id: 'factory', name: 'Acme Works', type: 'factory', weeklyIncome: 1500, baseWeeklyIncome: 1500,
    upgrades: [], employees: 0, workerSalary: 600, workerMultiplier: 1.1, marketingLevel: 0,
    miners: {}, warehouseLevel: 0, ...over,
  };
}
function friend(id: string, name: string): Relationship {
  return { id, name, type: 'friend', relationshipScore: 60, personality: 'kind', gender: 'female', age: 30 };
}
function car(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'sedan', name: 'Sedan', type: 'car', brand: 'Generic', model: 'Sedan', year: 2020, price: 20_000, condition: 80,
    fuelLevel: 100, fuelCapacity: 50, fuelEfficiency: 30, mileage: 0, weeklyMaintenanceCost: 10,
    weeklyFuelCost: 20, maxSpeed: 120, owned: true, reputationBonus: 0, speedBonus: 0, ...over,
  };
}
/** The same template generated for many different lives. */
function acrossLives(id: string, base: TestGameStateOverrides, lives = 200): WeeklyEvent[] {
  const t = byId(id);
  return Array.from({ length: lives }, (_, i) => t.generate(state({ ...base, lineageId: `life-${id}-${i}` })));
}

// ── EVT-1 / EVT-16: the business partnership ─────────────────────────────
describe('EVT-1: a partner\'s capital goes into a real company, once per life', () => {
  const withCompany = { companies: [company()], company: company() };

  it('is once per life and needs a company', () => {
    const t = byId('business_partnership');
    expect(t.oncePerLife).toBe(true);
    expect(t.condition!(state({ companies: [] }))).toBe(false);
    expect(t.condition!(state(withCompany))).toBe(true);
  });

  it('no choice pays the player cash; accept invests into an owned company', () => {
    const e = byId('business_partnership').generate(state(withCompany));
    for (const c of e.choices) expect(c.effects.money ?? 0).toBeLessThanOrEqual(0);
    const accept = choice(e, 'accept');
    expect(accept.special).toBe('invest_in_company');
    expect(accept.companyId).toBe('factory');
    expect(accept.investmentUSD).toBeGreaterThanOrEqual(10_000);
    expect(accept.investmentUSD).toBeLessThanOrEqual(100_000);
  });

  it('negotiate is a hidden seeded roll in which the partner can walk away', () => {
    const events = acrossLives('business_partnership', withCompany);
    const negotiated = events.map((e) => choice(e, 'negotiate'));
    for (const n of negotiated) expect(n.outcomeHidden).toBe(true);
    const agreed = negotiated.filter((n) => n.special === 'invest_in_company');
    const walked = negotiated.filter((n) => n.special === undefined);
    expect(agreed.length).toBeGreaterThan(0);
    expect(walked.length).toBeGreaterThan(0);
    expect(agreed.length / events.length).toBeGreaterThan(PARTNER_NEGOTIATION_SUCCESS_CHANCE - 0.12);
    expect(agreed.length / events.length).toBeLessThan(PARTNER_NEGOTIATION_SUCCESS_CHANCE + 0.12);
    // A deal that happened is 1.5x the opening offer; a walk-away has no sequel.
    for (const e of events) {
      const n = choice(e, 'negotiate');
      if (n.special) expect(n.investmentUSD).toBe(Math.floor(choice(e, 'accept').investmentUSD! * 1.5));
      else expect(n.followUpEventId).toBeUndefined();
    }
  });

  it('the expansion sequel follows a closed deal only, never a choice id alone', () => {
    expect(CHAINED_EVENTS.some((c) => c.triggerEventId === 'business_partnership')).toBe(false);
    for (let w = 0; w < 50; w++) {
      expect(checkForChainedEvent('business_partnership', 'negotiate', w)).toBeNull();
    }
    const e = byId('business_partnership').generate(state(withCompany));
    expect(choice(e, 'accept').followUpEventId).toBe('partnership_expansion');
  });

  it('investPartnerCapital buys upgrades with the capital and never touches cash', () => {
    const s = state({ ...withCompany, stats: { ...createTestGameState().stats, money: 1234 } });
    const r = investPartnerCapital(s, 'factory', 50_000);
    expect(r.next).not.toBeNull();
    expect(r.levelsBought).toBeGreaterThan(0);
    expect(r.spentUSD).toBeGreaterThan(0);
    expect(r.spentUSD).toBeLessThanOrEqual(50_000);
    expect(r.next!.stats.money).toBe(1234);
    const after = r.next!.companies!.find((c) => c.id === 'factory')!;
    expect(after.weeklyIncome).toBeGreaterThan(1500);
    expect(r.next!.company?.weeklyIncome).toBe(after.weeklyIncome);
  });

  it('a company sold before the choice receives nothing', () => {
    expect(investPartnerCapital(state(withCompany), 'gone', 50_000).next).toBeNull();
    expect(investPartnerCapital(state(withCompany), 'factory', 0).next).toBeNull();
  });

  it('EVT-16: the expansion follow-up costs nothing', () => {
    for (const c of FOLLOW_UP_EVENTS.partnership_expansion.choices) {
      expect(('money' in c.effects ? c.effects.money : 0) ?? 0).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── EVT-15: the lobbyist and the legal team ──────────────────────────────
describe('EVT-15: a bribe carries scandal heat; the legal team is a real gamble', () => {
  const politician = { politics: politicsAt(2) };

  it('the lobbyist\'s money lands on the dirty-money ledger', () => {
    const accept = choice(byId('lobbyist_offer').generate(state(politician)), 'accept');
    expect(accept.effects.money).toBe(LOBBYIST_BRIBE_USD);
    expect(accept.effects.politicalDirtyUSD).toBe(LOBBYIST_BRIBE_USD);
  });

  it('dirty money on the ledger raises the weekly scandal odds', () => {
    const before = politicsAt(2, { pac: { cleanUSD: 0, dirtyUSD: 0, lifetimeDirtyUSD: 0 } });
    const after = addLifetimeDirtyMoney(before, LOBBYIST_BRIBE_USD);
    expect(after.pac?.lifetimeDirtyUSD).toBe(LOBBYIST_BRIBE_USD);
    expect(after.pac?.cleanUSD).toBe(0);
    expect(scandalProbability({ pacDirtyUSD: after.pac!.lifetimeDirtyUSD, careerLevel: 2 }))
      .toBeGreaterThan(scandalProbability({ pacDirtyUSD: 0, careerLevel: 2 }));
  });

  it('hiring the legal team is hidden, staked, and can clear the scandal', () => {
    const events = acrossLives('political_scandal', politician);
    const lawyers = events.map((e) => choice(e, 'hire_lawyer'));
    for (const l of lawyers) {
      expect(l.outcomeHidden).toBe(true);
      expect(l.stake).toBe(10_000);
    }
    const won = lawyers.filter((l) => l.special === 'clear_political_scandal');
    expect(won.length / lawyers.length).toBeGreaterThan(LEGAL_TEAM_WIN_CHANCE - 0.12);
    expect(won.length / lawyers.length).toBeLessThan(LEGAL_TEAM_WIN_CHANCE + 0.12);
    // A win beats addressing it publicly on reputation; a loss is worse than denying nothing.
    for (const l of won) expect(l.effects.stats?.reputation).toBeGreaterThan(5);
  });

  it('a won legal fight clears the newest survivable scandal, never a career-ending one', () => {
    const scandal = (id: string, startedWeek: number, severity: PoliticalScandalEntry['severity']): PoliticalScandalEntry => ({
      id, category: 'corruption', severity, headline: id, startedWeek, weeksRemaining: 8, approvalLost: 0, suppressedUSD: 0, active: true,
    });
    const politics = politicsAt(2, {
      scandals: [scandal('old', 10, 'minor'), scandal('new', 20, 'moderate'), scandal('fatal', 30, 'career-ending')],
    });
    const cleared = clearScandalByLegalTeam(politics);
    const byScandal = (id: string) => cleared.scandals!.find((s) => s.id === id)!;
    expect(byScandal('new').active).toBe(false);
    expect(byScandal('new').resolution).toBe('image-restored');
    expect(byScandal('old').active).toBe(true);
    expect(byScandal('fatal').active).toBe(true);
    const none = politicsAt(2, { scandals: [scandal('fatal', 30, 'career-ending')] });
    expect(clearScandalByLegalTeam(none)).toBe(none);
  });
});

// ── EVT-18: no strictly dominated choice ─────────────────────────────────
/**
 * A visible choice is dominated when another visible choice is at least as
 * good on money, every stat and the bond, and better on one. Hidden gambles
 * are compared by nobody: their effects are a draw, not a preview.
 */
function dominated(choices: EventChoice[]): string[] {
  const visible = choices.filter((c) => !c.outcomeHidden && !c.special);
  const keys = new Set<string>();
  for (const c of visible) Object.keys(c.effects.stats ?? {}).forEach((k) => keys.add(k));
  const vec = (c: EventChoice) => [
    c.effects.money ?? 0,
    c.effects.relationship ?? 0,
    ...[...keys].map((k) => (c.effects.stats as Record<string, number> | undefined)?.[k] ?? 0),
  ];
  const out: string[] = [];
  for (const a of visible) {
    for (const b of visible) {
      if (a === b) continue;
      const va = vec(a);
      const vb = vec(b);
      if (vb.every((x, i) => x >= va[i]) && vb.some((x, i) => x > va[i])) out.push(`${a.id} < ${b.id}`);
    }
  }
  return out;
}

describe('EVT-18: the six audited events each offer a real decision', () => {
  const social = { relationships: [friend('f1', 'Ana'), friend('f2', 'Ben')] };
  const cases: [string, TestGameStateOverrides][] = [
    ['surprise_party', social],
    ['birthday_forgotten', social],
    ['car_accident', { vehicles: [car()], activeVehicleId: 'sedan' }],
    ['car_accident', { vehicles: [car({ insurance: { type: 'comprehensive', active: true, coveragePercent: 80, expiresWeek: 999, monthlyCost: 50 } })], activeVehicleId: 'sedan' }],
    ['burnout', { currentJob: 'fast_food', stats: { ...createTestGameState().stats, energy: 10 } }],
    ['lawsuit_threat', { stats: { ...createTestGameState().stats, money: 80_000 } }],
  ];
  it.each(cases)('%s has no strictly dominated visible choice', (id, o) => {
    for (const e of acrossLives(id, o, 20)) expect(dominated(e.choices)).toEqual([]);
  });

  it('economic_recession: belt-tightening is no longer a pure loss', () => {
    const prepare = economyEventTemplates.find((t) => t.id === 'economic_recession')!
      .generate(state()).choices.find((c) => c.id === 'prepare')!;
    expect(prepare.effects.money).toBeGreaterThan(0);
    expect(prepare.effects.stats?.happiness).toBeLessThan(0);
  });

  it('birthday choices move the forgotten friend\'s bond', () => {
    const e = byId('birthday_forgotten').generate(state(social));
    expect(['f1', 'f2']).toContain(e.relationId);
    for (const c of e.choices) expect(c.effects.relationship).toBeDefined();
  });

  it('car_accident: the claim uses the real policy, and is only offered when insured', () => {
    const uninsured = byId('car_accident').generate(state({ vehicles: [car()], activeVehicleId: 'sedan' }));
    expect(uninsured.choices.some((c) => c.id === 'insurance')).toBe(false);
    const insured = byId('car_accident').generate(state({
      vehicles: [car({ insurance: { type: 'basic', active: true, coveragePercent: 75, expiresWeek: 999, monthlyCost: 30 } })],
      activeVehicleId: 'sedan',
    }));
    expect(choice(insured, 'insurance').effects.money).toBe(-Math.round(CAR_ACCIDENT_REPAIR_USD * 0.25));
    expect(choice(insured, 'police').outcomeHidden).toBe(true);
  });

  it('burnout: the week off costs the week\'s pay', () => {
    const s = state({ currentJob: 'fast_food', stats: { ...createTestGameState().stats, energy: 10 } });
    const job = s.careers.find((c) => c.id === 'fast_food');
    const withJob = state({
      currentJob: 'fast_food',
      careers: s.careers.map((c) => (c.id === 'fast_food' ? { ...c, accepted: true } : c)),
      stats: { ...createTestGameState().stats, energy: 10 },
    });
    expect(job).toBeDefined();
    const pay = paidWeeklyCareerSalary(withJob).total;
    expect(pay).toBeGreaterThan(0);
    expect(choice(byId('burnout').generate(withJob), 'vacation').effects.money).toBe(-pay);
  });

  it('lawsuit_threat: ignoring it is a hidden gamble that can end in a default judgment', () => {
    const ignores = acrossLives('lawsuit_threat', {}).map((e) => choice(e, 'ignore'));
    for (const i of ignores) {
      expect(i.outcomeHidden).toBe(true);
      expect(i.stake).toBe(LAWSUIT_DEFAULT_JUDGMENT_USD);
    }
    expect(ignores.some((i) => i.effects.money === -LAWSUIT_DEFAULT_JUDGMENT_USD)).toBe(true);
    expect(ignores.some((i) => (i.effects.money ?? 0) === 0)).toBe(true);
  });
});

// ── EVT-20: the unlucky-13 secret is rare ────────────────────────────────
describe('EVT-20: secret_unlucky_13 belongs to about one life in ten', () => {
  it('one seeded draw per life, near the declared chance', () => {
    const lives = 4000;
    let hits = 0;
    for (let i = 0; i < lives; i++) if (isUnluckyThirteenLife({ lineageId: `lin-${i}`, generationNumber: 1 })) hits++;
    expect(hits / lives).toBeGreaterThan(UNLUCKY_13_LIFE_CHANCE - 0.02);
    expect(hits / lives).toBeLessThan(UNLUCKY_13_LIFE_CHANCE + 0.02);
  });

  it('the draw does not change week to week inside one life', () => {
    const t = byId('secret_unlucky_13');
    for (let i = 0; i < 200; i++) {
      const lineageId = `lin-${i}`;
      const verdicts = new Set<boolean>();
      // All inside the 16-18 age band the omen is gated to (age derives from weeksLived).
      for (const weeksLived of [0, 4, 8, 20, 48]) {
        verdicts.add(t.condition!(state({ lineageId, generationNumber: 1, weeksLived, week: 1, date: { ...createTestGameState().date, age: 18 } })));
      }
      expect(verdicts.size).toBe(1);
      expect([...verdicts][0]).toBe(isUnluckyThirteenLife({ lineageId, generationNumber: 1 }));
    }
  });
});

// ── LATE-8: no office pay from a cell ────────────────────────────────────
describe('LATE-8: a jailed official draws no office or appointment pay', () => {
  const official = (jailWeeks: number) => {
    return createTestGameState({
      jailWeeks,
      currentJob: 'political',
      politics: politicsAt(3, { appointment: { id: 'ambassador', startedWeek: 0 } }),
    });
  };

  it('pays while free and withholds while jailed', () => {
    expect(getPoliticalWeeklySalary(official(0))).toBeGreaterThan(0);
    expect(getPoliticalWeeklySalary(official(10))).toBe(0);
  });

  it('the cash-flow projection agrees with the tick', () => {
    expect(paidWeeklyCareerSalary(official(10)).total).toBe(0);
    expect(paidWeeklyCareerSalary(official(0)).fromOffice).toBe(getPoliticalWeeklySalary(official(0)));
  });
});

// ── LATE-15: karma shows what it does ────────────────────────────────────
describe('LATE-15: karma has no dead modifiers and describes its live effects', () => {
  const k = (score: number, violence = 0): KarmaState => ({ ...INITIAL_KARMA, score, dimensions: { ...INITIAL_KARMA.dimensions, violence } });

  it('the three unread modifiers are gone', () => {
    const m = getKarmaModifiers(INITIAL_KARMA) as Record<string, unknown>;
    expect(m.canAccessHonestCareers).toBeUndefined();
    expect(m.canAccessCorruptCareers).toBeUndefined();
    expect(m.reputationMultiplier).toBeUndefined();
  });

  it('neutral karma lists nothing; a saint and a villain each list their real effects', () => {
    expect(karmaEffectLines(k(0))).toEqual([]);
    const saint = karmaEffectLines(k(90));
    expect(saint.some((l) => /Bonds grow 30% faster/.test(l.text) && l.upside)).toBe(true);
    expect(saint.some((l) => /\+5 points on your election odds/.test(l.text))).toBe(true);
    const villain = karmaEffectLines(k(-80, -70));
    expect(villain.some((l) => /slower/.test(l.text) && !l.upside)).toBe(true);
    expect(villain.some((l) => /street jobs/.test(l.text))).toBe(true);
    expect(villain.some((l) => /8% weekly scandal risk/.test(l.text) && !l.upside)).toBe(true);
  });

  it('a missing or partial karma record reads as neutral, not a crash', () => {
    expect(karmaEffectLines(undefined)).toEqual([]);
    expect(karmaEffectLines({ score: 0 } as KarmaState)).toEqual([]);
  });
});
