/**
 * Cosmetic procedures — buying your way to a different face.
 *
 * The one system in this chapter that edits the stored genome rather than
 * layering on top of it. That is intentional: surgery is the only permanent
 * change to who you look like, and it should be the only thing that overwrites
 * the face the player authored.
 *
 * ## Why procedures can fail
 *
 * A procedure that only ever improves the face is a money → beauty converter,
 * and once the player has money the chapter is over. Real risk is what keeps it
 * interesting: a bad outcome moves the morph the WRONG way, costs the money
 * anyway, and can only be addressed by paying again for a revision that is
 * itself risky. Surgeon tier is the lever — the player chooses how much they are
 * willing to gamble, which is a decision rather than a purchase.
 */

import { clampMorphs } from './faceGenome';
import type { CosmeticProcedureRecord, FaceGenome, FaceMorphKey } from './types';

function clampRange(n: number, lo: number, hi: number): number {
  if (!isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

export interface CosmeticProcedure {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  minAge: number;
  /** Weeks of reduced happiness/health while healing. */
  recoveryWeeks: number;
  /** Which morphs it moves, and by how much at a perfect outcome. */
  effects: Partial<Record<FaceMorphKey, number>>;
  /**
   * Base risk of a poor result at the mid surgeon tier, [0, 1]. Invasive
   * procedures near the airway or the smile carry more, matching where real
   * revision rates are highest.
   */
  baseRisk: number;
}

export const COSMETIC_PROCEDURES: readonly CosmeticProcedure[] = [
  {
    id: 'rhinoplasty',
    name: 'Rhinoplasty',
    description: 'Reshapes the nose. The most requested procedure and the most revised.',
    baseCost: 9500,
    minAge: 18,
    recoveryWeeks: 6,
    effects: { noseWidth: -0.18, noseBridge: -0.14, noseTip: 0.16, noseLength: -0.1 },
    baseRisk: 0.16,
  },
  {
    id: 'jaw_contour',
    name: 'Jaw contouring',
    description: 'Sharpens the jawline and angle. Dramatic when it works.',
    baseCost: 16000,
    minAge: 21,
    recoveryWeeks: 8,
    effects: { jawAngle: 0.22, jawWidth: 0.12, chinProtrusion: 0.1 },
    baseRisk: 0.19,
  },
  {
    id: 'cheek_filler',
    name: 'Cheek filler',
    description: 'Restores midface volume. Temporary, but low risk and quick.',
    baseCost: 1800,
    minAge: 18,
    recoveryWeeks: 1,
    effects: { cheekFullness: 0.15, cheekboneHeight: 0.12 },
    baseRisk: 0.07,
  },
  {
    id: 'lip_filler',
    name: 'Lip filler',
    description: 'Fuller lips. Easy to get, easy to overdo.',
    baseCost: 1200,
    minAge: 18,
    recoveryWeeks: 1,
    effects: { lipFullness: 0.2 },
    baseRisk: 0.09,
  },
  {
    id: 'brow_lift',
    name: 'Brow lift',
    description: 'Raises a heavy or descended brow. Opens up the eyes.',
    baseCost: 7200,
    minAge: 30,
    recoveryWeeks: 4,
    effects: { browHeight: 0.18, eyeSize: 0.08 },
    baseRisk: 0.12,
  },
  {
    id: 'blepharoplasty',
    name: 'Eyelid surgery',
    description: 'Removes the hooding and hollows that make eyes look tired.',
    baseCost: 8400,
    minAge: 35,
    recoveryWeeks: 3,
    effects: { eyeSize: 0.16, eyeDepth: -0.18 },
    baseRisk: 0.11,
  },
  {
    id: 'facelift',
    name: 'Facelift',
    description: 'Lifts descended tissue across the whole face. Turns the clock back years.',
    baseCost: 38000,
    minAge: 40,
    recoveryWeeks: 10,
    effects: { cheekFullness: 0.2, cheekboneHeight: 0.16, jawAngle: 0.14, faceLength: -0.08 },
    baseRisk: 0.17,
  },
  {
    id: 'chin_implant',
    name: 'Chin implant',
    description: 'Adds projection to a weak chin. Quietly changes an entire profile.',
    baseCost: 6800,
    minAge: 21,
    recoveryWeeks: 4,
    effects: { chinProtrusion: 0.2, chinLength: 0.1, jawAngle: 0.08 },
    baseRisk: 0.1,
  },
  {
    id: 'otoplasty',
    name: 'Ear pinning',
    description: 'Sets prominent ears closer to the head.',
    baseCost: 5200,
    minAge: 12,
    recoveryWeeks: 3,
    effects: { earSize: -0.2 },
    baseRisk: 0.06,
  },
  {
    id: 'hair_transplant',
    name: 'Hair transplant',
    description: 'Restores a receded hairline. Grows in over the better part of a year.',
    baseCost: 14500,
    minAge: 25,
    recoveryWeeks: 12,
    effects: { foreheadSlope: -0.24 },
    baseRisk: 0.13,
  },
];

/** Surgeon tiers — the risk/price lever. */
export const SURGEON_TIERS = [
  { id: 'budget', name: 'Budget clinic', costMultiplier: 0.45, riskMultiplier: 2.4 },
  { id: 'standard', name: 'Board-certified surgeon', costMultiplier: 1, riskMultiplier: 1 },
  { id: 'elite', name: 'Renowned specialist', costMultiplier: 3.2, riskMultiplier: 0.35 },
] as const;

export type SurgeonTierId = (typeof SURGEON_TIERS)[number]['id'];

export function getProcedure(id: string): CosmeticProcedure | undefined {
  return COSMETIC_PROCEDURES.find((p) => p.id === id);
}

export function getSurgeonTier(id: string) {
  return SURGEON_TIERS.find((t) => t.id === id) ?? SURGEON_TIERS[1];
}

/** Final price for a procedure at a tier. */
export function procedureCost(procedureId: string, tierId: SurgeonTierId): number {
  const proc = getProcedure(procedureId);
  if (!proc) return 0;
  return Math.round(proc.baseCost * getSurgeonTier(tierId).costMultiplier);
}

export interface ProcedureEligibility {
  ok: boolean;
  reason?: string;
}

/**
 * Can this procedure be performed right now?
 *
 * The repeat-procedure cap is the important one. Without it the optimal play is
 * to buy the same rhinoplasty twenty times and drive one morph to its rail,
 * which produces a face that is both maximally "harmonious" by the scoring
 * function and visibly broken. Three per procedure per lifetime is enough for a
 * revision and a re-revision, and no more.
 */
export function checkProcedureEligibility(
  procedureId: string,
  tierId: SurgeonTierId,
  ctx: { age: number; money: number; health: number; history: CosmeticProcedureRecord[] },
): ProcedureEligibility {
  const proc = getProcedure(procedureId);
  if (!proc) return { ok: false, reason: 'Unknown procedure.' };
  if (ctx.age < proc.minAge) {
    return { ok: false, reason: `No reputable surgeon will operate before ${proc.minAge}.` };
  }
  if (ctx.money < procedureCost(procedureId, tierId)) {
    return { ok: false, reason: "You can't afford this." };
  }
  if (ctx.health < 35) {
    return { ok: false, reason: 'You are not healthy enough for elective surgery.' };
  }
  const priorCount = (ctx.history || []).filter((r) => r.id === procedureId).length;
  if (priorCount >= 3) {
    return { ok: false, reason: 'Too much scar tissue. No one will revise this again.' };
  }
  return { ok: true };
}

export interface ProcedureResult {
  face: FaceGenome;
  record: CosmeticProcedureRecord;
  /** Player-facing outcome line. */
  message: string;
  /** True when the result made the face worse. */
  botched: boolean;
  /** Weeks of recovery to apply. */
  recoveryWeeks: number;
}

/**
 * Perform a procedure. Pure — charges nothing and mutates nothing.
 *
 * `roll` is injected rather than drawn internally so the caller can pass a
 * seeded roll from `makeWeeklyRoll`. Same reason as everywhere else in this
 * codebase: React 19 runs the state updater twice, and an internal
 * `Math.random()` would give the two runs different surgical outcomes.
 */
export function performProcedure(
  face: FaceGenome,
  procedureId: string,
  tierId: SurgeonTierId,
  weeksLived: number,
  roll: number,
  ctx: { age: number; health: number; history: CosmeticProcedureRecord[] },
): ProcedureResult | null {
  const proc = getProcedure(procedureId);
  if (!proc) return null;

  const tier = getSurgeonTier(tierId);
  // Risk climbs with age, poor health, and — sharply — with each revision of the
  // same feature. Operating on scar tissue is genuinely harder, and it gives the
  // repeat cap teeth well before it is reached.
  const priorCount = (ctx.history || []).filter((r) => r.id === procedureId).length;
  const risk = clampRange(
    proc.baseRisk * tier.riskMultiplier +
      Math.max(0, ctx.age - 55) * 0.004 +
      Math.max(0, 60 - ctx.health) * 0.003 +
      priorCount * 0.09,
    0.01,
    0.85,
  );

  const r = clampRange(roll, 0, 0.999999);
  let outcome: number;
  let message: string;
  let botched = false;

  if (r < risk * 0.28) {
    // Severe complication.
    outcome = -1 + r * 0.4;
    botched = true;
    message = `The ${proc.name.toLowerCase()} went badly wrong. It will take more surgery to undo — if it can be undone.`;
  } else if (r < risk) {
    // Poor but survivable result.
    outcome = -0.55 + r * 0.5;
    botched = true;
    message = `The ${proc.name.toLowerCase()} did not turn out how you pictured it.`;
  } else if (r > 1 - (1 - risk) * 0.18) {
    // Exceptional result.
    outcome = 1;
    message = `The ${proc.name.toLowerCase()} came out better than you dared hope.`;
  } else {
    // The normal case: good, not transformative. Scaled so an average result is
    // ~0.6-0.9 of the listed effect rather than the full advertised number.
    outcome = 0.55 + (r - risk) / Math.max(0.01, 1 - risk) * 0.4;
    message = `The ${proc.name.toLowerCase()} healed well.`;
  }

  const morphs = { ...face.morphs };
  for (const [key, delta] of Object.entries(proc.effects) as [FaceMorphKey, number][]) {
    // A botched outcome inverts the intended direction — the nose gets wider,
    // not narrower. Halved, because a failure should be a setback, not a
    // mirror-image of the best possible result.
    const applied = outcome >= 0 ? delta * outcome : delta * outcome * 0.5;
    morphs[key] = clampRange(morphs[key] + applied, 0, 1);
  }

  return {
    face: { ...face, morphs: clampMorphs(morphs) },
    record: { id: procedureId, week: weeksLived, outcome: Math.round(outcome * 100) / 100 },
    message,
    botched,
    recoveryWeeks: botched ? Math.ceil(proc.recoveryWeeks * 1.6) : proc.recoveryWeeks,
  };
}
