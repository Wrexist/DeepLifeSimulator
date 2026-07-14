/**
 * Pet bonding + emotional support — pure helpers that compute how much
 * happiness/stress buff the player gets from owning pets.
 *
 * Reads: gameState.pets[].happiness and lifecycle.
 * Writes: the BondingSummary lets the weekly tick credit/debit the player.
 */

import { Pet } from '@/contexts/game/types';
import { findBreed } from './catalog';
import { lifeStage } from './lifecycle';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface BondingSummary {
  /** +/- happiness delta applied to player this week. */
  playerHappinessDelta: number;
  /** +/- health (small) delta from healthy pet companionship. */
  playerHealthDelta: number;
  /** Whether any pet is at-risk of dying — for UI urgency. */
  hasCriticalPet: boolean;
  /** Number of healthy, alive pets. */
  healthyPetCount: number;
  /** Per-pet breakdown for UI. */
  perPet: { petId: string; happinessContribution: number; healthContribution: number }[];
}

/**
 * Sum the emotional contributions of every alive pet toward the player.
 *
 *   - A pet with happiness ≥ 70 contributes +0.5 player happiness / week.
 *   - A pet with happiness ≥ 85 contributes +1.0.
 *   - A pet with happiness < 30 OR health < 30 actively saps player happiness (-0.5).
 *   - A healthy pet (health ≥ 70) contributes +0.6 player health (rounded later).
 *   - Elderly pets give a small bonus (the "loyal companion" effect).
 */
export function bondingSummary(pets: Pet[] | undefined): BondingSummary {
  const alive = (pets ?? []).filter((p) => !p.isDead);
  let happinessDelta = 0;
  let healthDelta = 0;
  let hasCritical = false;
  const perPet: BondingSummary['perPet'] = [];

  for (const p of alive) {
    const h = safe(p.happiness, 0);
    const health = safe(p.health, 0);
    let contribH = 0;
    let contribHealth = 0;
    if (h >= 85) contribH += 1.0;
    else if (h >= 70) contribH += 0.5;
    else if (h < 30 || health < 30) contribH -= 0.5;

    if (health >= 70) contribHealth += 0.6;

    if (lifeStage(p, findBreed(p.type)) === 'elderly' && health >= 50) contribH += 0.3;

    if (health <= 20 || safe(p.hunger, 100) <= 10) hasCritical = true;

    happinessDelta += contribH;
    healthDelta += contribHealth;
    perPet.push({ petId: p.id, happinessContribution: contribH, healthContribution: contribHealth });
  }

  return {
    playerHappinessDelta: Math.round(happinessDelta),
    playerHealthDelta: Math.round(healthDelta),
    hasCriticalPet: hasCritical,
    healthyPetCount: alive.filter((p) => safe(p.health, 0) >= 50).length,
    perPet,
  };
}
