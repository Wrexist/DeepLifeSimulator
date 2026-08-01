/**
 * PetActions — pure-lib-backed pet interactions: buy, feed, play, sleep, vet,
 * compete. Previously these lived inline in components/mobile/PetApp.tsx.
 */

import type { Dispatch, SetStateAction } from 'react';
import { GameState, Pet } from '../types';
import {
  PET_BREEDS,
  PET_FOODS,
  PET_TOYS,
  VET_SERVICES,
  findBreed,
  findFood,
  findToy,
  findVetService,
  findSickness,
  vetServicePrice,
} from '@/lib/pets/catalog';
import { resolveCompetition } from '@/lib/pets/competition';
import { logger } from '@/utils/logger';
import { updateMoney, applyMoneyDelta } from './MoneyActions';

const log = logger.scope('PetActions');
const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;
const clamp01 = (n: number): number => Math.max(0, Math.min(100, n));

type SetGS = Dispatch<SetStateAction<GameState>>;

function updatePet(setGameState: SetGS, petId: string, transform: (p: Pet) => Pet): void {
  setGameState((prev) => ({
    ...prev,
    pets: (prev.pets ?? []).map((p) => (p.id === petId ? transform(p) : p)),
  }));
}

export function buyPet(
  gameState: GameState,
  setGameState: SetGS,
  breedId: string,
  name: string,
  _deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string; petId?: string } {
  const breed = findBreed(breedId);
  if (!breed) return { success: false, message: 'Unknown breed' };
  if (safe(gameState.stats?.money, 0) < breed.price) {
    return { success: false, message: `Need $${breed.price.toLocaleString()}.` };
  }
  const id = `pet_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const pet: Pet = {
    id,
    name: name || breed.name,
    type: breed.id,
    age: 0,
    hunger: 80,
    happiness: 80,
    health: 100,
    energy: 100,
  };
  // M-batch-A (R8): debit + grant atomically so a same-batch double-tap can't
  // add two pets for one payment (the prior grant-then-charge added the pet
  // unconditionally, then charged in a separate updater that could reject).
  setGameState((prev) => {
    /**
     * The id is built OUTSIDE this updater, so a same-batch double tap appends
     * the SAME object twice — two roster rows sharing one id. Every later
     * `pets.map(p => p.id === petId ? … : p)` then matches both: one feed feeds
     * both, one vet visit heals both, and the weekly food cost is charged for
     * two pets the player paid for once.
     *
     * `applyMoneyDelta` alone does not catch it — a player with cash for two
     * pets passes it twice, which is the same half of the gate-then-grant class
     * the R8 pass left open elsewhere. Rejecting on a duplicate id closes it
     * without needing the id to be regenerated per invocation.
     */
    if ((prev.pets ?? []).some((p) => p?.id === id)) return prev;

    const spend = applyMoneyDelta(prev, -breed.price, `Bought ${breed.name}`);
    if (!spend) return prev; // race guard: an earlier same-batch buy drained the cash
    return { ...prev, ...spend, pets: [...(prev.pets ?? []), pet] };
  });
  log.info(`Bought pet ${id} (${breed.id})`);
  return { success: true, message: `Welcome ${pet.name}!`, petId: id };
}

export function feedPet(
  gameState: GameState,
  setGameState: SetGS,
  petId: string,
  foodId: string
): { success: boolean; message: string } {
  const pet = gameState.pets?.find((p) => p.id === petId);
  if (!pet) return { success: false, message: 'Pet not found' };
  if (pet.isDead) return { success: false, message: `${pet.name} has passed on.` };
  const food = findFood(foodId);
  if (!food) return { success: false, message: 'Unknown food' };
  const inventory = gameState.petFood ?? {};
  if ((inventory[foodId] ?? 0) <= 0) {
    return { success: false, message: 'Out of that food — buy more from the shop.' };
  }
  // R4-C: combine inventory decrement + pet stat update in a single
  // atomic setGameState. Previously the two separate updates raced — two
  // rapid feeds could both pass the outer `inventory[foodId] > 0` check
  // and the second update's decrement would land at -1.
  setGameState((prev) => {
    const prevRemaining = prev.petFood?.[foodId] ?? 0;
    if (prevRemaining <= 0) return prev; // re-check inside updater
    const prevPets = prev.pets ?? [];
    const targetPet = prevPets.find((p) => p.id === petId);
    if (!targetPet || targetPet.isDead) return prev;
    return {
      ...prev,
      petFood: { ...(prev.petFood ?? {}), [foodId]: prevRemaining - 1 },
      pets: prevPets.map((p) =>
        p.id === petId
          ? {
              ...p,
              hunger: clamp01(safe(p.hunger, 0) + food.nutrition),
              happiness: clamp01(safe(p.happiness, 0) + 3),
              health: clamp01(safe(p.health, 0) + (food.healthBonus ?? 0)),
            }
          : p
      ),
    };
  });
  return { success: true, message: `Fed ${pet.name} ${food.name.toLowerCase()}.` };
}

export function buyFood(
  gameState: GameState,
  setGameState: SetGS,
  foodId: string,
  qty: number,
  _deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } {
  const food = findFood(foodId);
  if (!food) return { success: false, message: 'Unknown food' };
  const total = food.price * qty;
  if (safe(gameState.stats?.money, 0) < total) {
    return { success: false, message: `Need $${total.toLocaleString()}.` };
  }
  // M-batch-A (R8): atomic debit + grant (see buyPet).
  setGameState((prev) => {
    const spend = applyMoneyDelta(prev, -total, `Bought ${qty}× ${food.name}`);
    if (!spend) return prev; // race guard
    return {
      ...prev,
      ...spend,
      petFood: { ...(prev.petFood ?? {}), [foodId]: (prev.petFood?.[foodId] ?? 0) + qty },
    };
  });
  return { success: true, message: `Bought ${qty}× ${food.name}.` };
}

export function buyToy(
  gameState: GameState,
  setGameState: SetGS,
  petId: string,
  toyId: string,
  _deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } {
  const pet = gameState.pets?.find((p) => p.id === petId);
  if (!pet) return { success: false, message: 'Pet not found' };
  const toy = findToy(toyId);
  if (!toy) return { success: false, message: 'Unknown toy' };
  if ((pet.toys ?? []).includes(toyId)) return { success: false, message: 'Already owns this toy.' };
  if (safe(gameState.stats?.money, 0) < toy.price) {
    return { success: false, message: `Need $${toy.price.toLocaleString()}.` };
  }
  // M-batch-A (R8): atomic debit + grant; also re-check ownership inside the
  // updater so a double-tap can't buy the same toy twice.
  setGameState((prev) => {
    const target = (prev.pets ?? []).find((p) => p.id === petId);
    if (!target || (target.toys ?? []).includes(toyId)) return prev; // race: already owned
    const spend = applyMoneyDelta(prev, -toy.price, `Bought ${toy.name} for ${pet.name}`);
    if (!spend) return prev; // race: cash drained
    return {
      ...prev,
      ...spend,
      pets: (prev.pets ?? []).map((p) =>
        p.id === petId ? { ...p, toys: [...(p.toys ?? []), toyId] } : p
      ),
    };
  });
  return { success: true, message: `${pet.name} loves the new ${toy.name}.` };
}

/**
 * What playing with a pet costs the PLAYER. The gate in `playWithPet` has
 * always tested this figure; until C-14 nothing ever deducted it.
 */
const PLAY_PLAYER_ENERGY_COST = 10;

export function playWithPet(
  gameState: GameState,
  setGameState: SetGS,
  petId: string
): { success: boolean; message: string } {
  const pet = gameState.pets?.find((p) => p.id === petId);
  if (!pet) return { success: false, message: 'Pet not found' };
  if (pet.isDead) return { success: false, message: `${pet.name} has passed on.` };
  if (safe(pet.energy, 0) < 20) {
    return { success: false, message: `${pet.name} is too tired — let them sleep.` };
  }
  if (safe(gameState.stats?.energy, 0) < PLAY_PLAYER_ENERGY_COST) {
    return { success: false, message: 'You are too tired to play.' };
  }
  const ownedToys = pet.toys ?? [];
  const bestToy = ownedToys
    .map(findToy)
    .filter((t): t is NonNullable<ReturnType<typeof findToy>> => !!t)
    .reduce<number>((max, t) => Math.max(max, t.fun), 25);

  /**
   * C-14. This used to call `updatePet`, which only touches the pets array —
   * so the "You are too tired to play" gate above tested an energy cost that
   * was never charged. The pet paid 20 energy; the player paid nothing. A
   * player sitting on exactly 10 energy could play forever without ever
   * falling below the threshold that was supposed to stop them, so the pet's
   * happiness was free and the gate was decoration.
   *
   * Written as one updater rather than `updatePet` so the pet's energy and the
   * player's are spent in the SAME transition, and both gates are re-checked
   * against `prev` (CLAUDE.md §4.4). The pet gate was already re-checked; the
   * player gate had nothing to re-check.
   */
  setGameState((prev) => {
    const target = (prev.pets ?? []).find((p) => p.id === petId);
    if (!target || target.isDead) return prev;
    if (safe(target.energy, 0) < 20) return prev;
    const playerEnergy = safe(prev.stats?.energy, 0);
    if (playerEnergy < PLAY_PLAYER_ENERGY_COST) return prev;

    return {
      ...prev,
      stats: { ...prev.stats, energy: clamp01(playerEnergy - PLAY_PLAYER_ENERGY_COST) },
      pets: (prev.pets ?? []).map((p) =>
        p.id === petId
          ? {
              ...p,
              happiness: clamp01(safe(p.happiness, 0) + Math.round(bestToy / 2)),
              energy: clamp01(safe(p.energy, 0) - 20),
            }
          : p,
      ),
    };
  });
  return { success: true, message: `Had a great time with ${pet.name}.` };
}

export function petSleep(
  gameState: GameState,
  setGameState: SetGS,
  petId: string
): { success: boolean; message: string } {
  const pet = gameState.pets?.find((p) => p.id === petId);
  if (!pet) return { success: false, message: 'Pet not found' };
  if (pet.isDead) return { success: false, message: `${pet.name} has passed on.` };
  // R5-C: rate-limit sleep to once per week per pet. Previously the player
  // could spam Sleep before any competition and keep the pet at 100/100
  // health/energy for free — trivialized show prizes and competition value.
  const currentWeek = gameState.weeksLived ?? 0;
  if (pet.lastSleepWeek === currentWeek) {
    return {
      success: false,
      message: `${pet.name} has already slept this week — let them play with their toys instead.`,
    };
  }
  updatePet(setGameState, petId, (p) => {
    // Re-check the once-per-week gate on fresh `p`: the precondition above reads
    // the stale snapshot, so a rapid double-tap would otherwise apply the +50
    // energy / +5 health buff twice before `lastSleepWeek` was committed.
    if (p.lastSleepWeek === currentWeek) return p;
    return {
      ...p,
      energy: clamp01(safe(p.energy, 0) + 50),
      health: clamp01(safe(p.health, 0) + 5),
      lastSleepWeek: currentWeek,
    };
  });
  return { success: true, message: `${pet.name} is resting peacefully.` };
}

export function payForVet(
  gameState: GameState,
  setGameState: SetGS,
  petId: string,
  serviceId: string,
  _deps: { updateMoney: typeof updateMoney },
  currentWeek: number
): { success: boolean; message: string } {
  const pet = gameState.pets?.find((p) => p.id === petId);
  if (!pet) return { success: false, message: 'Pet not found' };
  if (pet.isDead) return { success: false, message: `${pet.name} has passed on.` };
  const service = findVetService(serviceId);
  if (!service) return { success: false, message: 'Unknown service' };
  // Effective price: a sickness-treating service costs the pet's active
  // sickness's own `treatmentCost` (mild cold << severe infection) instead of a
  // flat fee; everything else keeps the VET_SERVICES price.
  const activeSickness = pet.isSick && pet.sickness ? findSickness(pet.sickness) : null;
  const price = vetServicePrice(service, activeSickness);
  if (safe(gameState.stats?.money, 0) < price) {
    return { success: false, message: `Need $${price.toLocaleString()}.` };
  }
  // M-batch-A (R8): atomic debit + grant.
  setGameState((prev) => {
    /**
     * Re-check the PRECONDITION, not just affordability.
     *
     * R8 made the debit atomic; it did not stop a second tap being charged for
     * a visit that does nothing. `health` is already clamped at 100 and
     * `isSick` is already false after the first, so the second tap buys
     * nothing — up to $1,500 for Surgery, or an infection's full treatment
     * cost. Anti-player, same shape as the vehicle actions in R4-X5.
     *
     * "Nothing left to do" means: the pet is at full health AND this service
     * has no sickness to treat and no vaccination to give. A visit that would
     * still change something is allowed through.
     */
    const prevPet = (prev.pets ?? []).find((p) => p?.id === petId);
    if (!prevPet || prevPet.isDead) return prev;

    const wouldHeal = safe(prevPet.health, 0) < 100 && service.healthBonus > 0;
    const wouldTreat = !!service.treatsSickness && !!prevPet.isSick;
    const wouldVaccinate = !!service.vaccinates && !prevPet.vaccinated;
    const wouldCheer = (service.happinessBonus ?? 0) > 0 && safe(prevPet.happiness, 0) < 100;
    if (!wouldHeal && !wouldTreat && !wouldVaccinate && !wouldCheer) return prev;

    const spend = applyMoneyDelta(prev, -price, `${service.name} for ${pet.name}`);
    if (!spend) return prev; // race guard
    return {
      ...prev,
      ...spend,
      pets: (prev.pets ?? []).map((p) =>
        p.id === petId
          ? {
              ...p,
              health: clamp01(safe(p.health, 0) + service.healthBonus),
              happiness: clamp01(safe(p.happiness, 0) + (service.happinessBonus ?? 0)),
              vaccinated: service.vaccinates ? true : p.vaccinated,
              isSick: service.treatsSickness ? false : p.isSick,
              sickness: service.treatsSickness ? undefined : p.sickness,
              lastVetVisit: currentWeek,
            }
          : p
      ),
    };
  });
  return { success: true, message: `${service.name}: ${pet.name} is doing better.` };
}

export function enterCompetition(
  gameState: GameState,
  setGameState: SetGS,
  petId: string,
  competitionId: string,
  _deps: { updateMoney: typeof updateMoney },
  roll: number
): { success: boolean; message: string; won?: boolean; payout?: number } {
  const pet = gameState.pets?.find((p) => p.id === petId);
  if (!pet) return { success: false, message: 'Pet not found' };
  if (pet.isDead) return { success: false, message: `${pet.name} has passed on.` };
  // ANTI-EXPLOIT: gate competitions to once-per-week per pet (mirrors petSleep's
  // R5-C lastSleepWeek). Each competition pays 10× the entry fee at up to 90% win
  // odds, and the UI re-rolls `Math.random()` on every tap — without this cap a
  // player could spam-enter for unbounded money (EV +$400–$4,000 per entry).
  const currentWeek = gameState.weeksLived ?? 0;
  if (pet.lastCompetitionWeek === currentWeek) {
    return {
      success: false,
      message: `${pet.name} has already competed this week — come back next week.`,
    };
  }
  const result = resolveCompetition(pet, competitionId, roll);
  if (!result || !result.competition) return { success: false, message: 'Unknown competition' };
  const comp = result.competition;
  if (safe(gameState.stats?.money, 0) < comp.entryFee) {
    return { success: false, message: `Entry fee $${comp.entryFee.toLocaleString()}.` };
  }
  // M-batch-A (R8): apply the net delta (entry fee always; prize only if won)
  // AND the pet update in one atomic updater, so the entry fee can't be charged
  // without the pet result landing, and a double-tap can't re-enter for free.
  setGameState((prev) => {
    const target = (prev.pets ?? []).find((p) => p.id === petId);
    // Authoritative once-per-week re-check on fresh state: the precondition above
    // reads the stale snapshot, so a rapid double-tap would otherwise enter twice
    // before `lastCompetitionWeek` was committed.
    if (!target || target.isDead || target.lastCompetitionWeek === currentWeek) return prev;
    const net = result.won ? comp.prize - comp.entryFee : -comp.entryFee;
    const spend = applyMoneyDelta(prev, net, result.won ? `Won ${comp.name}!` : `${comp.name} entry`);
    if (!spend) return prev; // race guard
    return {
      ...prev,
      ...spend,
      pets: (prev.pets ?? []).map((p) =>
        p.id === petId ? { ...result.pet, lastCompetitionWeek: currentWeek } : p
      ),
    };
  });
  return {
    success: true,
    message: result.won
      ? `${pet.name} won ${comp.name}! +$${comp.prize.toLocaleString()}`
      : `${pet.name} didn't place at ${comp.name}.`,
    won: result.won,
    payout: result.payoutDelta,
  };
}

// Re-export catalogs for UI ergonomics.
export { PET_BREEDS, PET_FOODS, PET_TOYS, VET_SERVICES };
