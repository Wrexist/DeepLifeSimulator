/**
 * Event content that said one thing and did another, round two (2026-10-21
 * events audit). Each block pins one finding: the gate that was missing, the
 * copy that over-promised, or the roll that was keyed on the week alone.
 */
import {
  eventTemplates,
  rollWeeklyEvents,
  JAIL_SAFE_EVENT_IDS,
  VEHICLE_BREAKDOWN_DELAY_DAMAGE,
} from '../engine';
import { CLIFFHANGERS, rollCliffhanger } from '../cliffhangerEvents';
import { economyEventTemplates } from '../economyEvents';
import { careerEventTemplates } from '../careerEvents';
import { FOLLOW_UP_EVENTS } from '../lifeEvents';
import { generateEventDisease } from '@/lib/diseases/diseaseGenerator';
import { scamWindowOpen } from '@/lib/mail/scam';
import { lifeSalt } from '@/utils/seededRoll';
import { GOAL_CATALOGUE } from '@/lib/goals/catalogue';
import { upcomingEvents } from '@/lib/anticipation/engine';
import { smartNotificationSystem, type NotificationContext } from '@/utils/smartNotifications';
import { createTestGameState, type TestGameStateOverrides } from '@/__tests__/helpers/createTestGameState';
import type { ChildInfo, GameState, Relationship, Vehicle } from '@/contexts/game/types';

const byId = (id: string) => {
  const t = eventTemplates.find((x) => x.id === id) ?? careerEventTemplates.find((x) => x.id === id);
  if (!t) throw new Error(`no template ${id}`);
  return t;
};
const eligible = (id: string, state: GameState) => {
  const t = byId(id);
  return !t.condition || t.condition(state);
};

function person(overrides: Partial<Relationship> & Pick<Relationship, 'id' | 'name' | 'type'>): Relationship {
  return { relationshipScore: 60, personality: 'kind', gender: 'female', age: 30, ...overrides };
}
function child(id: string, name: string, age: number, extra: Partial<ChildInfo> = {}): ChildInfo {
  return { ...person({ id, name, type: 'child', age }), ...extra };
}
function car(id: string, name: string, condition = 80): Vehicle {
  return {
    id, name, type: 'car', brand: 'Generic', model: name, year: 2020, price: 20_000, condition,
    fuelLevel: 100, fuelCapacity: 50, fuelEfficiency: 30, mileage: 0, weeklyMaintenanceCost: 10,
    weeklyFuelCost: 20, maxSpeed: 120, owned: true, reputationBonus: 0, speedBonus: 0,
  };
}
const state = (o: TestGameStateOverrides = {}) =>
  createTestGameState({ weeksLived: 400, lifeStartWeek: 0, lastEventWeeksLived: 0, ...o });

// ── EVT-2: jail ──────────────────────────────────────────────────────────
describe('a player serving a sentence lives no festival, overtime or road trip', () => {
  const economyIds = new Set(economyEventTemplates.map((t) => t.id));
  const collect = (jailWeeks: number) => {
    const ids = new Set<string>();
    for (let life = 0; life < 25; life++) {
      for (let week = 400; week < 420; week++) {
        const s = state({
          lineageId: `jail-life-${life}`,
          weeksLived: week,
          jailWeeks,
          wantedLevel: 2,
          currentJob: 'fast_food',
          vehicles: [car('sedan', 'Sedan')],
          activeVehicleId: 'sedan',
        });
        for (const e of rollWeeklyEvents(s)) ids.add(e.id);
      }
    }
    return ids;
  };

  it('only allowlisted pool templates reach a jailed life (pity included)', () => {
    const outside = [...collect(10)].filter((id) => !JAIL_SAFE_EVENT_IDS.has(id) && !economyIds.has(id));
    expect(outside).toEqual([]);
  });

  it('the same lives out of jail do get the ordinary pool (the probe discriminates)', () => {
    const outside = [...collect(0)].filter((id) => !JAIL_SAFE_EVENT_IDS.has(id) && !economyIds.has(id));
    expect(outside.length).toBeGreaterThan(0);
  });

  it('no cliffhanger teaser is set while jailed', () => {
    for (let week = 400; week < 600; week++) {
      expect(rollCliffhanger(state({ lineageId: 'cliff', weeksLived: week, jailWeeks: 5, currentJob: 'fast_food' }), week)).toBeNull();
    }
  });
});

// ── EVT-3: employment and vehicle gates ──────────────────────────────────
describe('job and car events need a job and a car', () => {
  it.each(['job_bonus', 'sick_day', 'random_job_interview'])('%s needs a job', (id) => {
    expect(eligible(id, state({ currentJob: undefined }))).toBe(false);
    expect(eligible(id, state({ currentJob: 'fast_food' }))).toBe(true);
  });

  it.each(['car_breakdown', 'car_accident', 'car_wash'])('%s needs a car, and names it', (id) => {
    expect(eligible(id, state({ vehicles: [] }))).toBe(false);
    const s = state({ vehicles: [car('v1', 'Civic')], activeVehicleId: 'v1' });
    expect(eligible(id, s)).toBe(true);
    expect(byId(id).generate(s).description).toContain('Civic');
  });

  it('random_job_interview no longer promises an interview it never holds', () => {
    const e = byId('random_job_interview').generate(state({ currentJob: 'fast_food' }));
    expect(e.choices.map((c) => c.text).join(' ')).not.toMatch(/interview/i);
  });
});

// ── EVT-4: bonus copy ────────────────────────────────────────────────────
describe('a one-off bonus is not called a promotion or a raise', () => {
  it('unexpected_promotion', () => {
    const e = byId('unexpected_promotion').generate(state({ currentJob: 'fast_food' }));
    expect(`${e.description} ${e.choices.map((c) => c.text).join(' ')}`).not.toMatch(/promot/i);
  });

  it('raise_negotiation and performance_review', () => {
    const raise = byId('raise_negotiation').generate(state({ currentJob: 'fast_food' }));
    expect(raise.choices.map((c) => c.text).join(' ')).not.toMatch(/\braise\b/i);
  });

  it('ch_boss_meeting promises no leadership role, raise or pay cut', () => {
    const cliff = CLIFFHANGERS.find((c) => c.id === 'ch_boss_meeting')!;
    for (const reputation of [80, 20]) {
      const e = cliff.resolveEvent(state({ stats: { reputation } }));
      expect(e.description).not.toMatch(/leadership position|raise|pay reduction/i);
    }
  });

  it('friend_job_offer does not schedule an interview that never happens', () => {
    expect(FOLLOW_UP_EVENTS.friend_job_offer.choices.map((c) => c.text).join(' ')).not.toMatch(/interview/i);
  });
});

// ── EVT-5 (partial): court_trial ─────────────────────────────────────────
describe('court_trial is for somebody wanted, not somebody already serving', () => {
  it('is not eligible while jailed', () => {
    expect(eligible('court_trial', state({ wantedLevel: 2, jailWeeks: 4 }))).toBe(false);
    expect(eligible('court_trial', state({ wantedLevel: 2, jailWeeks: 0 }))).toBe(true);
    expect(eligible('court_trial', state({ wantedLevel: 0, jailWeeks: 0 }))).toBe(false);
  });
});

// ── EVT-6: vehicle_breakdown ─────────────────────────────────────────────
describe('vehicle_breakdown: "condition will worsen" does', () => {
  it('the delay choice damages the active car by the amount its copy names', () => {
    const e = byId('vehicle_breakdown').generate(state({ vehicles: [car('v1', 'Civic', 50)], activeVehicleId: 'v1' }));
    const delay = e.choices.find((c) => c.id === 'delay')!;
    expect(delay.special).toBe('damage_vehicle');
    expect(delay.vehicleId).toBe('v1');
    expect(delay.vehicleConditionLoss).toBe(VEHICLE_BREAKDOWN_DELAY_DAMAGE);
    expect(delay.text).toContain(String(VEHICLE_BREAKDOWN_DELAY_DAMAGE));
  });
});

// ── EVT-7: pregnancy_scare ───────────────────────────────────────────────
describe('pregnancy_scare: somebody who could be pregnant', () => {
  const couple = (playerSex: 'male' | 'female', partner: Partial<Relationship>, age = 30) =>
    state({
      date: { age },
      userProfile: { ...createTestGameState().userProfile, sex: playerSex, gender: playerSex },
      relationships: [person({ id: 'p', name: 'Sam', type: 'partner', ...partner })],
    });

  it('a male partner of a male player cannot be', () => {
    expect(eligible('pregnancy_scare', couple('male', { gender: 'male' }))).toBe(false);
  });
  it('a 60-year-old partner cannot be', () => {
    expect(eligible('pregnancy_scare', couple('male', { gender: 'female', age: 60 }, 44))).toBe(false);
  });
  it('a female partner of a male player can, and the copy says she', () => {
    const s = couple('male', { gender: 'female', age: 30 });
    expect(eligible('pregnancy_scare', s)).toBe(true);
    expect(byId('pregnancy_scare').generate(s).description).toMatch(/Sam tells you she might be pregnant/);
  });
  it('a female player with a male partner is the one who might be', () => {
    const s = couple('female', { gender: 'male', age: 50 }, 30);
    expect(byId('pregnancy_scare').generate(s).description).toMatch(/^You think you might be pregnant/);
  });
});

// ── EVT-8: grandchildren ─────────────────────────────────────────────────
describe('grandchild_visit needs real grandchildren', () => {
  it('a 66-year-old whose only child is 3 has none', () => {
    expect(eligible('grandchild_visit', state({ date: { age: 66 }, family: { children: [child('c1', 'Mia', 3)] } }))).toBe(false);
  });
  it('a recorded grandchild qualifies and is named', () => {
    const s = state({
      date: { age: 66 },
      family: { children: [child('c1', 'Mia', 40, { grandchildren: [{ id: 'g1', name: 'Theo', birthWeeksLived: 100 }] })] },
    });
    expect(eligible('grandchild_visit', s)).toBe(true);
    expect(byId('grandchild_visit').generate(s).description).toContain('Theo');
  });
});

// ── EVT-9: firsts happen once per child ──────────────────────────────────
describe('"first" milestones happen once per child', () => {
  const lived = (id: string, description: string) => ({ id, description, choice: 'x', week: 1, year: 2030, weeksLived: 300 });

  it.each([
    ['child_first_words', 2],
    ['child_graduation', 18],
    ['parent_first_steps', 1],
    ['parent_tooth_fairy', 6],
  ])('%s', (id, age) => {
    const one = state({ family: { children: [child('c1', 'Ann', age)] } });
    expect(eligible(id, one)).toBe(true);
    const first = byId(id).generate(one);
    expect(first.description.startsWith('Ann')).toBe(true);
    const after = state({ family: { children: [child('c1', 'Ann', age)] }, eventLog: [lived(id, first.description)] });
    expect(eligible(id, after)).toBe(false);
    // A sibling still gets theirs - and "Ann" does not shadow "Anna".
    const sibling = state({
      family: { children: [child('c1', 'Ann', age), child('c2', 'Anna', age)] },
      eventLog: [lived(id, first.description)],
    });
    expect(eligible(id, sibling)).toBe(true);
    expect(byId(id).generate(sibling).description.startsWith('Anna')).toBe(true);
  });

  it('empty_nest needs every child grown, once', () => {
    expect(byId('empty_nest').oncePerLife).toBe(true);
    expect(eligible('empty_nest', state({ date: { age: 50 }, family: { children: [child('a', 'A', 20), child('b', 'B', 12)] } }))).toBe(false);
    expect(eligible('empty_nest', state({ date: { age: 50 }, family: { children: [child('a', 'A', 20), child('b', 'B', 19)] } }))).toBe(true);
  });

  it('anniversary only around the real anniversary', () => {
    const married = (weeksMarried: number) =>
      state({ weeksLived: 1000, relationships: [person({ id: 's', name: 'Kim', type: 'spouse', marriageWeek: 1000 - weeksMarried, anniversaryWeek: 1000 - weeksMarried })] });
    expect(eligible('anniversary', married(30))).toBe(false);
    expect(eligible('anniversary', married(52))).toBe(true);
    expect(eligible('anniversary', married(54))).toBe(true);
    expect(eligible('anniversary', married(60))).toBe(false);
    expect(eligible('anniversary', married(104))).toBe(true);
  });
});

// ── EVT-10: Get hired ────────────────────────────────────────────────────
describe('now_get_hired is never the top card for someone who cannot apply', () => {
  const goal = GOAL_CATALOGUE.find((g) => g.id === 'now_get_hired')!;
  it('retired or jailed: not eligible', () => {
    expect(goal.isEligible(state({ currentJob: undefined, isRetired: true }))).toBe(false);
    expect(goal.isEligible(state({ currentJob: undefined, jailWeeks: 3 }))).toBe(false);
    expect(goal.isEligible(state({ currentJob: undefined }))).toBe(true);
  });
});

// ── EVT-11 / EVT-23: smart notifications ─────────────────────────────────
describe('smart notifications congratulate only what happened', () => {
  const ctx = (gameState: GameState): NotificationContext => ({
    gameState,
    timeOfDay: 'morning',
    dayOfWeek: 1,
    season: 'spring',
    recentActions: [],
    userPreferences: { showTips: true, showMilestones: true, showWarnings: true, showSuggestions: true, notificationFrequency: 'medium' },
  });

  it('a legacy save is not seeded with milestones it never reached', () => {
    const legacy = state({ date: { age: 30 }, currentJob: undefined, relationships: [], family: { children: [] }, shownNotificationIds: undefined });
    const seeded = smartNotificationSystem.earnedShowOnceIds(ctx(legacy));
    for (const id of ['married', 'first_child', 'first_job', 'first_friend']) expect(seeded).not.toContain(id);
  });

  it('a married legacy save IS seeded with married (the v50 behaviour is kept)', () => {
    const spouse = person({ id: 's', name: 'Kim', type: 'spouse' });
    const married = state({ relationships: [spouse], family: { spouse, children: [] }, shownNotificationIds: undefined });
    expect(smartNotificationSystem.earnedShowOnceIds(ctx(married))).toContain('married');
  });

  it('first_friend needs a friend; wealth_growth needs growth; debt_warning reads arrears', () => {
    smartNotificationSystem.clearHistory();
    const fresh = smartNotificationSystem.evaluateNotifications(ctx(state({ relationships: [], shownNotificationIds: [] }))).map((n) => n.id);
    expect(fresh).not.toContain('first_friend');
    expect(fresh).not.toContain('wealth_growth');
    expect(fresh).not.toContain('debt_warning');
    const owing = smartNotificationSystem.evaluateNotifications(ctx(state({ overdueBalance: 500, shownNotificationIds: [] }))).map((n) => n.id);
    expect(owing).toContain('debt_warning');
  });
});

// ── EVT-12 / EVT-13: rolls keyed on the life, not the week ───────────────
describe('rolls that differed by week but not by life', () => {
  it('scam windows differ between lives', () => {
    const a = lifeSalt(state({ lineageId: 'life-a' }));
    const b = lifeSalt(state({ lineageId: 'life-b' }));
    let differ = 0;
    for (let w = 0; w < 400; w++) if (scamWindowOpen(w, a) !== scamWindowOpen(w, b)) differ++;
    expect(differ).toBeGreaterThan(0);
  });

  it('a medical emergency in the same week does not give every life the same disease', () => {
    const ids = new Set<string>();
    for (let life = 0; life < 30; life++) {
      const d = generateEventDisease('medical_emergency', state({ lineageId: `med-${life}`, weeksLived: 2000, date: { age: 60 }, diseases: [] }));
      if (d) ids.add(d.id);
    }
    expect(ids.size).toBeGreaterThan(1);
  });
});

// ── EVT-17: the legal gambles are gambles ────────────────────────────────
describe('legal letters that name two outcomes can land on either', () => {
  it.each([
    ['legal_parking_fine', 'appeal', 120],
    ['legal_speeding_notice', 'court', 400],
    ['legal_settlement_offer', 'counter', 6000],
  ])('%s/%s', (id, cid, stake) => {
    const outcomes = new Set<number>();
    for (let life = 0; life < 40; life++) {
      const s = state({ lineageId: `legal-${life}`, vehicles: [car('v1', 'Civic')], activeVehicleId: 'v1', wantedLevel: 1, stats: { money: 50_000 } });
      const c = byId(id).generate(s).choices.find((x) => x.id === cid)!;
      expect(c.outcomeHidden).toBe(true);
      expect(c.stake).toBe(stake);
      const money = c.effects.money ?? 0;
      expect(-money).toBeLessThanOrEqual(stake);
      outcomes.add(money);
    }
    expect(outcomes.size).toBe(2);
  });
});

// ── EVT-20 / EVT-21 / EVT-24 / EVT-25: copy that misstated the state ─────
describe('copy that misstated the state', () => {
  it('secret_palindrome counts weeks since birth, with no stray leading space', () => {
    // weeksLived counts from the 18th birthday: 65 + 18*52 = 1001.
    const s = state({ weeksLived: 65 });
    expect(eligible('secret_palindrome', s)).toBe(true);
    const d = byId('secret_palindrome').generate(s).description;
    expect(d).toContain('exactly 1001 weeks');
    expect(d.startsWith(' ')).toBe(false);
    expect(eligible('secret_palindrome', state({ weeksLived: 101 }))).toBe(false);
  });

  it('travel events name the destination, not its id', () => {
    const s = state({ travel: { ...(createTestGameState().travel ?? { visitedDestinations: [] }), currentTrip: { destinationId: 'local_resort', returnWeek: 410, startWeek: 400 } } as GameState['travel'] });
    const e = byId('travel_local_cuisine').generate(s);
    expect(e.description).toContain('Local Resort');
    expect(e.description).not.toContain('local_resort');
  });

  it('the week-ahead wedding line names the balance the tick charges', () => {
    const plan = { partnerId: 'p', venueId: 'v', venueName: 'The Barn', budget: 20_000, scheduledWeek: 401 };
    const s = state({ weeksLived: 400, relationships: [person({ id: 'p', name: 'Kim', type: 'partner', weddingPlanned: plan as Relationship['weddingPlanned'] })] });
    const row = upcomingEvents(s).find((e) => e.kind === 'wedding')!;
    expect(row.detail).toContain('$15,000');
  });

  it('identity_theft charges whole dollars and names the amount', () => {
    const e = byId('identity_theft').generate(state({ stats: { money: 25 }, bankSavings: 0 }));
    for (const c of e.choices) expect(Number.isInteger(c.effects.money ?? 0)).toBe(true);
    expect(e.description).toMatch(/\$2\b/);
  });

  it('formal_warning never prints (4/3)', () => {
    const s = state({
      currentJob: 'fast_food',
      careers: createTestGameState().careers.map((c) => (c.id === 'fast_food' ? { ...c, accepted: true, warningsReceived: 3, startedWeeksLived: 0 } : c)),
    });
    expect(eligible('formal_warning', s)).toBe(false);
  });

  it('nothing in the attic for a player who sold the house', () => {
    const cliff = CLIFFHANGERS.find((c) => c.id === 'ch_strange_noise')!;
    const sold = state({ realEstate: [{ ...(createTestGameState().realEstate[0]), owned: false }] });
    expect(cliff.condition!(sold)).toBe(false);
  });
});
