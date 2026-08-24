/**
 * Weekly-event PAYLOAD determinism (2026-08-16 audit, H7b).
 *
 * ## What broke
 *
 * `EventTemplate.generate()` runs inside the weekly tick — i.e. inside a
 * `setGameState(prev => …)` updater. ~23 `generate()` bodies in
 * `lib/events/engine.ts` decided the payload with raw `Math.random()`: whether
 * an investment paid out or wiped the stake, how big a fine or a tax refund
 * was, which friend / pet / child / vehicle / policy the event was about.
 *
 * That is the exact shape `pulseTick` and the Pulse notification ids were
 * already fixed for, and it fails in two directions:
 *
 *   1. **StrictMode / concurrent React.** React 19 invokes the updater twice
 *      and may run it speculatively. Each invocation drew fresh numbers, so the
 *      outcome the player kept was whichever render React happened to commit —
 *      the description could even disagree with the effect that landed.
 *   2. **Save-scum.** Nothing tied the payload to the save, so reloading and
 *      re-ticking the same week re-rolled a losing bet into a winning one.
 *
 * ## What is asserted here
 *
 * The payload is now a pure function of (`weeksLived`, event id, salt) via
 * `payloadRoll` → `makeWeeklyRoll` (`utils/seededRoll.ts`). So:
 *
 *   - same state → byte-identical event (the property that closes both holes);
 *   - different week → the payload actually moves (the property that stops the
 *     fix from degenerating into a constant, which would be deterministic and
 *     also boring);
 *   - the salts are independent, so two decisions inside one payload are not
 *     welded together (an investment that always wins is not a fix).
 *
 * ## Scope note
 *
 * This suite covers `engine.ts`'s OWN templates (see CONVERTED_EVENT_IDS). The
 * event PACKS — `careerEvents.ts`, `personalCrises.ts`, `travelEvents.ts` and
 * `lifeEvents.ts` — were converted in the second H7b pass and are covered by
 * `packPayloadDeterminism.test.ts`, so the filtering below is now a scoping
 * choice rather than a quarantine.
 */
import type { GameState, Relationship, ChildInfo, Pet, Vehicle } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { eventTemplates, rollWeeklyEvents, type EventTemplate } from '@/lib/events/engine';

/**
 * The engine-owned templates whose `generate()` used to call `Math.random()`.
 * Every one of them is now seeded; this list is what the suite sweeps.
 */
const CONVERTED_EVENT_IDS = [
  'friend_help',
  'school_fees',
  'gym_invite',
  'pet_illness',
  'pet_contest',
  'policy_voting',
  'policy_backlash',
  'stock_market_regulation',
  'old_friend_returns',
  'investment_tip',
  'business_partnership',
  'distant_relative_inheritance',
  'tax_refund',
  'antique_finding',
  'speeding_ticket',
  'vehicle_theft',
  'parking_ticket',
] as const;

const templateById = (id: string): EventTemplate => {
  const t = eventTemplates.find(e => e.id === id);
  if (!t) throw new Error(`template ${id} is not registered in eventTemplates`);
  return t;
};

// ── Fixture ────────────────────────────────────────────────────────────────

const relationship = (id: string, name: string): Relationship => ({
  id,
  name,
  type: 'friend',
  relationshipScore: 60,
  age: 30,
  personality: 'friendly',
  gender: 'female',
});

const child = (id: string, name: string): ChildInfo => ({
  id,
  name,
  type: 'child',
  relationshipScore: 80,
  age: 8,
  gender: 'female',
  personality: 'curious',
  happiness: 70,
  health: 80,
});

const pet = (id: string, name: string): Pet => ({
  id,
  name,
  type: 'dog',
  hunger: 50,
  happiness: 80,
  health: 80,
  age: 3,
});

const vehicle = (id: string, name: string): Vehicle => ({
  id,
  type: 'car',
  name,
  brand: 'Generic',
  model: name,
  year: 2020,
  fuelEfficiency: 30,
  maxSpeed: 120,
  reputationBonus: 0,
  condition: 80,
  mileage: 20_000,
  fuelLevel: 80,
  fuelCapacity: 60,
  owned: true,
  weeklyMaintenanceCost: 10,
  weeklyFuelCost: 10,
  speedBonus: 0,
  price: 20_000,
});

/**
 * A state rich enough that every converted template has something to pick FROM
 * - several friends, children, pets, vehicles and enacted policies. A one-item
 * list would make a "picks the same one twice" assertion vacuous.
 */
function richState(weeksLived: number): GameState {
  const base = createTestGameState();
  return {
    ...base,
    weeksLived,
    lifeStartWeek: 0,
    stats: { ...base.stats, money: 250_000 },
    relationships: [
      relationship('r1', 'Ada'),
      relationship('r2', 'Bo'),
      relationship('r3', 'Cyd'),
      relationship('r4', 'Dee'),
      relationship('r5', 'Eli'),
    ],
    family: {
      ...base.family,
      children: [child('c1', 'Fay'), child('c2', 'Gus'), child('c3', 'Hal'), child('c4', 'Ivy')],
    },
    pets: [pet('p1', 'Rex'), pet('p2', 'Momo'), pet('p3', 'Nib'), pet('p4', 'Otto')],
    vehicles: [vehicle('v1', 'Sedan'), vehicle('v2', 'Coupe'), vehicle('v3', 'Van'), vehicle('v4', 'Truck')],
    activeVehicleId: 'v1',
    politics: {
      // The factory always materialises `politics` (initialState declares it
      // concretely), so the non-null assertion is truthful and keeps this a
      // plain typed literal rather than a cast the factory audit would flag.
      ...base.politics!,
      careerLevel: 3,
      party: 'democratic',
      approvalRating: 50,
      policyInfluence: 10,
      policiesEnacted: ['minimum_wage_increase', 'corporate_tax_cut', 'green_energy_subsidy'],
    },
  };
}

// ── 1. Same state → identical payload ──────────────────────────────────────

describe('event payloads - deterministic in (week, event, salt)', () => {
  it('generates a byte-identical event twice from the same state', () => {
    const state = richState(400);
    for (const id of CONVERTED_EVENT_IDS) {
      const t = templateById(id);
      const a = JSON.stringify(t.generate(state));
      const b = JSON.stringify(t.generate(state));
      expect(`${id}:${a}`).toBe(`${id}:${b}`);
    }
  });

  it('stays identical across a sweep of weeks (no hidden per-call state)', () => {
    for (let week = 200; week < 260; week++) {
      const state = richState(week);
      for (const id of CONVERTED_EVENT_IDS) {
        const t = templateById(id);
        expect(JSON.stringify(t.generate(state))).toBe(JSON.stringify(t.generate(state)));
      }
    }
  });

  it('does not mutate the state it is handed', () => {
    const state = richState(311);
    const before = JSON.stringify(state);
    for (const id of CONVERTED_EVENT_IDS) templateById(id).generate(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});

// ── 2. Different week → different payload ──────────────────────────────────

describe('event payloads - the week is what varies them', () => {
  /**
   * Each entry pulls the varying part out of the generated event. Asserting on
   * the whole JSON would let a template pass by varying only its description
   * while the money stayed pinned.
   */
  const VARYING: Record<string, (state: GameState) => string> = {
    friend_help: s => templateById('friend_help').generate(s).relationId ?? '',
    school_fees: s => templateById('school_fees').generate(s).relationId ?? '',
    gym_invite: s => templateById('gym_invite').generate(s).relationId ?? '',
    pet_illness: s => templateById('pet_illness').generate(s).relationId ?? '',
    pet_contest: s => templateById('pet_contest').generate(s).relationId ?? '',
    old_friend_returns: s => templateById('old_friend_returns').generate(s).description,
    tax_refund: s => templateById('tax_refund').generate(s).description,
    antique_finding: s =>
      String(templateById('antique_finding').generate(s).choices[0].effects.money),
    speeding_ticket: s => templateById('speeding_ticket').generate(s).description
      + String(templateById('speeding_ticket').generate(s).choices[0].effects.money),
    parking_ticket: s => String(templateById('parking_ticket').generate(s).choices[0].effects.money),
    vehicle_theft: s => templateById('vehicle_theft').generate(s).description,
    investment_tip: s => templateById('investment_tip').generate(s).choices
      .map(c => String(c.effects.money)).join('|'),
    policy_voting: s => templateById('policy_voting').generate(s).description,
    policy_backlash: s => templateById('policy_backlash').generate(s).description,
  };

  for (const [id, extract] of Object.entries(VARYING)) {
    it(`${id}: the payload moves across weeks`, () => {
      const seen = new Set<string>();
      for (let week = 100; week < 160; week++) seen.add(extract(richState(week)));
      // Two distinct outcomes is the real bar - a coin-flip payload only has
      // two - and it is what proves the roll is not pinned to a constant.
      expect(seen.size).toBeGreaterThanOrEqual(2);
    });
  }

  it('investment_tip: the big and small bets are INDEPENDENT decisions', () => {
    // Both signs came from separate `Math.random()` calls before; both now come
    // from separate salts. Sharing one salt would make the two bets always agree
    // - deterministic, but a different (and worse) game.
    let disagreements = 0;
    for (let week = 100; week < 200; week++) {
      const ev = templateById('investment_tip').generate(richState(week));
      const big = (ev.choices.find(c => c.id === 'invest_big')?.effects.money ?? 0) > 0;
      const small = (ev.choices.find(c => c.id === 'invest_small')?.effects.money ?? 0) > 0;
      if (big !== small) disagreements++;
    }
    expect(disagreements).toBeGreaterThan(0);
  });

  it('investment_tip: neither bet is a one-way street', () => {
    const bigOutcomes = new Set<boolean>();
    for (let week = 100; week < 200; week++) {
      const ev = templateById('investment_tip').generate(richState(week));
      bigOutcomes.add((ev.choices.find(c => c.id === 'invest_big')?.effects.money ?? 0) > 0);
    }
    expect(bigOutcomes.size).toBe(2);
  });
});

// ── 3. End-to-end through rollWeeklyEvents ─────────────────────────────────

describe('rollWeeklyEvents - repeated calls agree on the payload', () => {
  /**
   * The tick's own selection roll was already seeded (H7a / the Math.sin fix),
   * so re-running a week must now reproduce the payloads too.
   *
   * Filtered to the engine-owned ids on purpose: this suite pins THIS file's
   * conversion. The packs are seeded too now (second H7b pass) and are pinned
   * by `packPayloadDeterminism.test.ts`.
   */
  const converted = new Set<string>(CONVERTED_EVENT_IDS);

  it('produces identical converted-event payloads on a re-tick of the same week', () => {
    let compared = 0;
    for (let week = 300; week < 420; week++) {
      const state = { ...richState(week), lastEventWeeksLived: 0 };
      const a = rollWeeklyEvents(state).filter(e => converted.has(e.id));
      const b = rollWeeklyEvents(state).filter(e => converted.has(e.id));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      compared += a.length;
    }
    // Guard against the assertion above passing because nothing ever fired.
    expect(compared).toBeGreaterThan(0);
  });

  it('does not produce the same payload for every week', () => {
    const payloads = new Set<string>();
    for (let week = 300; week < 500; week++) {
      const state = { ...richState(week), lastEventWeeksLived: 0 };
      for (const e of rollWeeklyEvents(state)) {
        if (converted.has(e.id)) payloads.add(JSON.stringify(e));
      }
    }
    expect(payloads.size).toBeGreaterThan(1);
  });
});
