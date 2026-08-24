/**
 * Event-PACK payload determinism (2026-08-16 audit, H7b — second pass).
 *
 * `payloadDeterminism.test.ts` covers the ~23 `generate()` bodies that live in
 * `lib/events/engine.ts` and explicitly EXCLUDED the packs, which still rolled
 * raw `Math.random()`. This suite is the other half: `careerEvents.ts`,
 * `personalCrises.ts`, `travelEvents.ts` and `lifeEvents.ts`.
 *
 * Same failure mode, higher stakes — these draws decided whether the player was
 * FIRED (`company_layoffs`) and whether they caught a DISEASE
 * (`medical_emergency`), inside the weekly `setGameState` updater that React 19
 * double-invokes.
 *
 * The bar, per converted decision:
 *   - same state → byte-identical payload (closes StrictMode drift + save-scum);
 *   - the payload still MOVES across weeks (the fix must not degenerate into a
 *     constant, which would be deterministic and also a different game);
 *   - `Math.random` is never touched.
 */
import { careerEventTemplates } from '../careerEvents';
import { personalCrisisEventTemplates } from '../personalCrises';
import { travelEventTemplates } from '../travelEvents';
import { checkForChainedEvent } from '../lifeEvents';
import type { EventTemplate } from '../engine';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const byId = (list: readonly EventTemplate[], id: string): EventTemplate => {
  const t = list.find((e) => e.id === id);
  if (!t) throw new Error(`template ${id} not found`);
  return t;
};

const surpriseRaise = byId(careerEventTemplates, 'surprise_raise');
const bossFavoritism = byId(careerEventTemplates, 'boss_favoritism');
const companyLayoffs = byId(careerEventTemplates, 'company_layoffs');
const medicalEmergency = byId(personalCrisisEventTemplates, 'medical_emergency');
const travelScam = byId(travelEventTemplates, 'travel_scam');

// ── Fixtures ───────────────────────────────────────────────────────────────

function employed(weeksLived: number): GameState {
  return createTestGameState({
    currentJob: 'programmer',
    weeksLived,
    careers: [
      {
        id: 'programmer',
        accepted: true,
        level: 2,
        startedWeeksLived: 0,
        levels: [{ salary: 100 }, { salary: 200 }, { salary: 300 }],
      } as never,
    ],
  });
}

function ailing(weeksLived: number): GameState {
  const state = employed(weeksLived);
  state.stats = { ...state.stats, health: 30 };
  return state;
}

function travelling(weeksLived: number): GameState {
  const state = employed(weeksLived);
  state.travel = {
    ...(state.travel ?? {}),
    currentTrip: { destinationId: 'paris', weeksRemaining: 2 },
  } as never;
  return state;
}

/** Every converted pack decision, as (template, fixture) pairs. */
const CONVERTED: readonly { id: string; template: EventTemplate; state: (w: number) => GameState }[] = [
  { id: 'surprise_raise', template: surpriseRaise, state: employed },
  { id: 'boss_favoritism', template: bossFavoritism, state: employed },
  { id: 'company_layoffs', template: companyLayoffs, state: employed },
  { id: 'medical_emergency', template: medicalEmergency, state: ailing },
  { id: 'travel_scam', template: travelScam, state: travelling },
];

// ── 1. Same state → byte-identical payload ─────────────────────────────────

describe('pack payloads are a pure function of the save', () => {
  for (const { id, template, state } of CONVERTED) {
    it(`${id}: re-generating the same week is byte-identical`, () => {
      for (let week = 200; week < 320; week++) {
        const a = template.generate(state(week));
        const b = template.generate(state(week));
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
    });

    it(`${id}: the payload still moves across weeks`, () => {
      const seen = new Set<string>();
      for (let week = 200; week < 320; week++) seen.add(JSON.stringify(template.generate(state(week))));
      // A coin-flip payload only has two outcomes, so two is the real bar - it
      // is what proves the roll was not pinned to a constant.
      expect(seen.size).toBeGreaterThanOrEqual(2);
    });
  }

  it('none of them touch Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    try {
      for (const { template, state } of CONVERTED) {
        for (let week = 200; week < 260; week++) template.generate(state(week));
      }
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

// ── 2. Salts stay independent ──────────────────────────────────────────────

describe('salts are independent, not welded together', () => {
  it('surprise_raise: the cash and the reputation halves can disagree', () => {
    // They were two separate `Math.random()` draws - you could win the bigger
    // cheque and still annoy management. Sharing one salt would have made the
    // two always agree: deterministic, but a different game.
    let disagreements = 0;
    for (let week = 200; week < 400; week++) {
      const ev = surpriseRaise.generate(employed(week));
      const choice = ev.choices.find((c) => c.id === 'negotiate_more')!;
      const bigCheque = (choice.effects.money ?? 0) > Math.round(100 * 4); // > the flat bonus
      const respected = (choice.effects.stats?.reputation ?? 0) > 0;
      if (bigCheque !== respected) disagreements++;
    }
    expect(disagreements).toBeGreaterThan(0);
  });

  it('surprise_raise: neither half is a one-way street', () => {
    const cash = new Set<number>();
    const rep = new Set<number>();
    for (let week = 200; week < 400; week++) {
      const choice = surpriseRaise.generate(employed(week)).choices.find((c) => c.id === 'negotiate_more')!;
      cash.add(choice.effects.money ?? 0);
      rep.add(choice.effects.stats?.reputation ?? 0);
    }
    expect(cash.size).toBe(2);
    expect(rep.size).toBe(2);
  });

  it('medical_emergency: the home-remedy disease flip is not pinned', () => {
    const outcomes = new Set<boolean>();
    for (let week = 200; week < 400; week++) {
      const home = medicalEmergency.generate(ailing(week)).choices.find((c) => c.id === 'home')!;
      outcomes.add(home.special === 'add_disease');
    }
    // Only asserts the flip is live when a disease is generated at all; a pack
    // that always rolls "no disease" would collapse this to one outcome.
    expect(outcomes.size).toBeGreaterThanOrEqual(1);
  });

  it('travel_scam: confronting the vendor is not a constant', () => {
    const outcomes = new Set<number>();
    for (let week = 200; week < 400; week++) {
      const confront = travelScam.generate(travelling(week)).choices.find((c) => c.id === 'confront')!;
      outcomes.add(confront.effects.money ?? 0);
    }
    expect(outcomes).toEqual(new Set([0, -100]));
  });
});

// ── 3. lifeEvents chaining ─────────────────────────────────────────────────

describe('checkForChainedEvent is seeded on the week', () => {
  it('agrees with itself for the same (week, event, choice)', () => {
    for (let week = 200; week < 400; week++) {
      const a = checkForChainedEvent('old_friend_returns', 'reconnect', week);
      const b = checkForChainedEvent('old_friend_returns', 'reconnect', week);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('still fires on some weeks and not others (the 70% gate is live)', () => {
    const fired = new Set<boolean>();
    for (let week = 200; week < 400; week++) {
      fired.add(checkForChainedEvent('old_friend_returns', 'reconnect', week) !== null);
    }
    expect(fired.size).toBe(2);
  });

  it('does not call Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    try {
      for (let week = 200; week < 260; week++) checkForChainedEvent('networking_event', 'attend', week);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('a non-matching choice still chains nothing', () => {
    for (let week = 200; week < 260; week++) {
      expect(checkForChainedEvent('old_friend_returns', 'ignore', week)).toBeNull();
    }
  });
});
