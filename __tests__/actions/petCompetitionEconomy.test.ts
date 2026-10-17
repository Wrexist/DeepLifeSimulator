/**
 * Pet shows were a money printer (owner call, 2026-10-17).
 *
 * Measured on the code before this fix, with the real decay engine, food and vet
 * bills: one $2,000 mouse netted +$67,390 over 20 weeks, and twenty mice netted
 * ~$77,000 a week - against a $110/week entry wage. Three causes, one test block
 * each:
 *
 *   1. The weekly gate was per PET and nothing capped the pet count, so every
 *      extra pet was another weekly ticket.
 *   2. The roll was the UI's `Math.random()`, passed into the action: different
 *      on every reload, and not reproducible from the save.
 *   3. Every show paid 10x its fee at up to 90% odds (+$4,000 expected per Grand
 *      Championship entry).
 *
 * The pricing block pins the expected value of EVERY show against the entry
 * wage, so a later "small" prize bump has to argue with a number.
 */
import fs from 'fs';
import path from 'path';
import { buyPet, enterCompetition, livingPetCount } from '@/contexts/game/actions/PetActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { MAX_PETS_OWNED, PET_COMPETITIONS } from '@/lib/pets/catalog';
import {
  evaluatePetForCompetition,
  petShowRoll,
  planCompetitionEntry,
  PET_SHOW_ROLL_KEY,
} from '@/lib/pets/competition';
import { MIN_ENTRY_WEEKLY_SALARY } from '@/lib/careers/careerData';
import { makeLifeRoll } from '@/utils/seededRoll';
import { createTestGameState } from '../helpers/createTestGameState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import type { GameState, Pet } from '@/contexts/game/types';

const deps = { updateMoney };

function mouse(id: string, over: Partial<Pet> = {}): Pet {
  return {
    id,
    name: id.toUpperCase(),
    type: 'hamster_mouse',
    age: 30,
    hunger: 100,
    happiness: 100,
    health: 100,
    energy: 100,
    ...over,
  };
}

function stateWith(pets: Pet[], over: Partial<GameState> = {}): GameState {
  return createTestGameState({
    weeksLived: 200,
    lineageId: 'pet-show-test',
    stats: { money: 100_000 },
    pets,
    ...over,
  });
}

/** Capture the functional updater an action dispatches, without applying it. */
function captureUpdater(run: (set: React.Dispatch<React.SetStateAction<GameState>>) => unknown) {
  const updaters: ((p: GameState) => GameState)[] = [];
  run(((u: React.SetStateAction<GameState>) => {
    if (typeof u !== 'function') throw new Error('non-functional updater');
    updaters.push(u as (p: GameState) => GameState);
  }) as React.Dispatch<React.SetStateAction<GameState>>);
  return updaters;
}

describe('1a. one show entry per game week across ALL pets', () => {
  it('a second pet cannot enter once any pet has competed this week', () => {
    const stub = createSetGameStateStub(stateWith([mouse('a'), mouse('b'), mouse('c')]));

    const first = enterCompetition(stub.current(), stub.setGameState, 'a', 'beauty');
    expect(first.success).toBe(true);
    const moneyAfterFirst = stub.current().stats.money;

    const second = enterCompetition(stub.current(), stub.setGameState, 'b', 'championship');
    const third = enterCompetition(stub.current(), stub.setGameState, 'c', 'costume');

    expect(second.success).toBe(false);
    expect(second.message).toContain('A already competed this week');
    expect(third.success).toBe(false);
    expect(stub.current().stats.money).toBe(moneyAfterFirst);
    expect(stub.current().pets.filter((p) => p.lastCompetitionWeek === 200)).toHaveLength(1);
  });

  it('a same-batch double tap on TWO different pets lands once (inner re-check on prev)', () => {
    const snapshot = stateWith([mouse('a'), mouse('b')]);
    const stub = createSetGameStateStub(snapshot);

    // Both calls see the same stale snapshot, as two taps in one React batch do.
    enterCompetition(snapshot, stub.setGameState, 'a', 'beauty');
    const moneyAfterFirst = stub.current().stats.money;
    enterCompetition(snapshot, stub.setGameState, 'b', 'beauty');

    expect(stub.current().stats.money).toBe(moneyAfterFirst);
    expect(stub.current().pets.filter((p) => p.lastCompetitionWeek === 200)).toHaveLength(1);
  });

  it('the limit is per week: next week any pet may enter again', () => {
    const stub = createSetGameStateStub(stateWith([mouse('a'), mouse('b')]));
    expect(enterCompetition(stub.current(), stub.setGameState, 'a', 'beauty').success).toBe(true);
    stub.setGameState((prev) => ({ ...prev, weeksLived: prev.weeksLived + 1 }));
    expect(enterCompetition(stub.current(), stub.setGameState, 'b', 'beauty').success).toBe(true);
  });

  it('a pet that does not meet the requirement is refused with the reason, and pays nothing', () => {
    const stub = createSetGameStateStub(stateWith([mouse('a', { happiness: 40, health: 40, energy: 40 })]));
    const r = enterCompetition(stub.current(), stub.setGameState, 'a', 'championship');
    expect(r.success).toBe(false);
    expect(r.message).toBe('Grand Championship needs average of happiness, health and energy of 75+. A has 40.');
    expect(stub.current().stats.money).toBe(100_000);
  });

  it('five pets earn the same number of entries as one pet', () => {
    const weeks = 20;
    const count = (n: number) => {
      const pets = Array.from({ length: n }, (_, i) => mouse(`m${i}`));
      const stub = createSetGameStateStub(stateWith(pets));
      let entries = 0;
      for (let w = 0; w < weeks; w++) {
        for (const p of pets) {
          if (enterCompetition(stub.current(), stub.setGameState, p.id, 'costume').success) entries++;
        }
        stub.setGameState((prev) => ({ ...prev, weeksLived: prev.weeksLived + 1 }));
      }
      return entries;
    };
    expect(count(1)).toBe(weeks);
    expect(count(MAX_PETS_OWNED)).toBe(weeks);
  });
});

describe('1b. the roster is capped at MAX_PETS_OWNED living pets', () => {
  const full = () => Array.from({ length: MAX_PETS_OWNED }, (_, i) => mouse(`m${i}`));

  it('adopting past the cap is refused with the reason and costs nothing', () => {
    const stub = createSetGameStateStub(stateWith(full()));
    const r = buyPet(stub.current(), stub.setGameState, 'hamster_mouse', 'Extra', deps);
    expect(r.success).toBe(false);
    expect(r.message).toBe(`You can keep up to ${MAX_PETS_OWNED} pets at a time.`);
    expect(livingPetCount(stub.current().pets)).toBe(MAX_PETS_OWNED);
    expect(stub.current().stats.money).toBe(100_000);
  });

  it('two same-batch adoptions at cap-1 land only one pet and charge once', () => {
    const snapshot = stateWith(full().slice(1));
    const stub = createSetGameStateStub(snapshot);
    buyPet(snapshot, stub.setGameState, 'hamster_mouse', 'One', deps);
    buyPet(snapshot, stub.setGameState, 'hamster', 'Two', deps);
    expect(livingPetCount(stub.current().pets)).toBe(MAX_PETS_OWNED);
    expect(stub.current().stats.money).toBe(100_000 - 2_000);
  });

  it('pets that have died do not count against the cap', () => {
    const roster = full().map((p) => ({ ...p, isDead: true }));
    const stub = createSetGameStateStub(stateWith(roster));
    expect(buyPet(stub.current(), stub.setGameState, 'hamster_mouse', 'New', deps).success).toBe(true);
  });
});

describe('2. the show is decided by a seeded roll, drawn inside the updater', () => {
  it('the action takes no roll argument, and the Pet app draws none', () => {
    // (gameState, setGameState, petId, competitionId) - nothing for a caller to re-roll.
    expect(enterCompetition.length).toBe(4);
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'components', 'mobile', 'PetApp.tsx'), 'utf8');
    expect(src).not.toMatch(/Math\s*\.\s*random\s*\(/);
  });

  it('the draw is the life + week stream under the documented key', () => {
    const s = stateWith([mouse('a')]);
    expect(petShowRoll(s)).toBe(makeLifeRoll(s, 200)(PET_SHOW_ROLL_KEY));
  });

  it('the same life in the same week gets the same result, whichever show and pet', () => {
    const s = stateWith([mouse('a'), mouse('b')]);
    const roll = petShowRoll(s);
    for (const c of PET_COMPETITIONS) {
      for (const id of ['a', 'b']) {
        const plan = planCompetitionEntry(s, id, c.id);
        if (!plan.ok) throw new Error(plan.message);
        expect(plan.won).toBe(roll < plan.winProbability);
        // Asking again changes nothing - there is no fresh draw to farm.
        const again = planCompetitionEntry(s, id, c.id);
        expect(again.ok && again.won).toBe(plan.won);
      }
    }
  });

  it('re-invoking the updater (StrictMode) produces identical state', () => {
    const prev = stateWith([mouse('a')]);
    const [updater] = captureUpdater((set) => enterCompetition(prev, set, 'a', 'championship'));
    expect(JSON.stringify(updater(prev))).toBe(JSON.stringify(updater(prev)));
  });

  it('the updater draws from prev, not from a result computed before it', () => {
    // Two lives whose draws disagree about the same championship entry.
    const odds = evaluatePetForCompetition(mouse('a'), 'championship')!.winProbability;
    const lives = Array.from({ length: 200 }, (_, i) => stateWith([mouse('a')], { lineageId: `life-${i}` }));
    const winner = lives.find((s) => petShowRoll(s) < odds)!;
    const loser = lives.find((s) => petShowRoll(s) >= odds)!;
    expect(winner).toBeDefined();
    expect(loser).toBeDefined();

    const [updater] = captureUpdater((set) => enterCompetition(loser, set, 'a', 'championship'));
    const landed = updater(winner);
    expect(landed.pets[0].competitionWins).toBe(1);
    expect(landed.stats.money).toBe(winner.stats.money + 300 - 60);
  });

  it('different lives get different draws in the same week', () => {
    const rolls = new Set(
      Array.from({ length: 20 }, (_, i) => petShowRoll(stateWith([], { lineageId: `cohort-${i}` }))),
    );
    expect(rolls.size).toBe(20);
  });
});

describe('3. every show is a weekly bonus, not a career', () => {
  const best = mouse('best', { competitionWins: 5 });
  const fresh = mouse('fresh');
  /** Best case: half the entry wage. The old Grand Championship was 36x the wage. */
  const EV_CEILING = MIN_ENTRY_WEEKLY_SALARY * 0.55;

  it.each(PET_COMPETITIONS.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const top = evaluatePetForCompetition(best, c.id)!;
    const newcomer = evaluatePetForCompetition(fresh, c.id)!;
    expect(top.expectedValue).toBeCloseTo(top.winProbability * c.prize - c.entryFee, 10);
    // Worth entering for a cared-for pet...
    expect(newcomer.expectedValue).toBeGreaterThan(0);
    // ...and never more than about half a bottom-rung wage, even for a veteran.
    expect(top.expectedValue).toBeLessThanOrEqual(EV_CEILING);
    // No show is a near-certain win.
    expect(top.winProbability).toBeLessThanOrEqual(0.75);
  });

  it('bigger prizes come with longer odds', () => {
    const byPrize = [...PET_COMPETITIONS].sort((a, b) => a.prize - b.prize);
    const odds = byPrize.map((c) => evaluatePetForCompetition(best, c.id)!.winProbability);
    for (let i = 1; i < odds.length; i++) expect(odds[i]).toBeLessThanOrEqual(odds[i - 1]);
  });

  it('a full season, measured on the real action: mean show income per week stays under the ceiling', () => {
    // 40 lives x 20 weeks, a 5-mouse roster kept at 100, every pet sent to the
    // Grand Championship every week. Only one entry a week can land.
    let total = 0;
    let entries = 0;
    for (let life = 0; life < 40; life++) {
      const pets = Array.from({ length: MAX_PETS_OWNED }, (_, i) => mouse(`m${i}`));
      const stub = createSetGameStateStub(stateWith(pets, { lineageId: `season-${life}` }));
      const start = stub.current().stats.money;
      for (let w = 0; w < 20; w++) {
        for (const p of pets) {
          if (enterCompetition(stub.current(), stub.setGameState, p.id, 'championship').success) entries++;
        }
        stub.setGameState((prev) => ({
          ...prev,
          weeksLived: prev.weeksLived + 1,
          pets: prev.pets.map((p) => ({ ...p, happiness: 100, health: 100, energy: 100 })),
        }));
      }
      total += stub.current().stats.money - start;
    }
    expect(entries).toBe(40 * 20);
    const perWeek = total / (40 * 20);
    expect(perWeek).toBeGreaterThan(0);
    expect(perWeek).toBeLessThanOrEqual(EV_CEILING + 20);
  });
});
