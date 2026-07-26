/**
 * Body simulation — the weekly physical drift.
 *
 * The chapter's realism claim lives or dies here. A life sim that tracks money
 * to the dollar but represents your body as a single "fitness" bar is lying
 * about which one it thinks matters. So this models the four quantities that
 * actually move: mass, fat percentage, trained muscle, and cardiovascular
 * conditioning — each on its own timescale, because in reality they have wildly
 * different ones.
 *
 * ## Timescales (why the constants look small)
 *
 * A week is a SHORT time for a body. Real, sustainable rates:
 *   - weight:  ~0.2-0.5 kg/week under a meaningful deficit or surplus
 *   - fat:     follows weight, lagging
 *   - muscle:  ~0.1-0.25 kg/month trained, i.e. barely visible weekly
 *   - fitness: builds over ~6-8 weeks, and detrains roughly twice as fast
 *
 * Every constant below is scaled to those rates. The temptation is to inflate
 * them so the player "sees progress", but that produces the Sims Mobile failure
 * the avatar research doc calls out: a system that cannot represent time. Six
 * months of consistent training producing a visible change is the correct feel,
 * and it is what makes the change worth something.
 *
 * ## Purity
 *
 * `simulateBodyWeek` takes a snapshot of inputs and returns a NEW body plus
 * player-facing notes. It reads no game state and mutates nothing, so the weekly
 * reducer stays a thin adapter and every rate here is directly testable.
 */

import type { BodyProfile } from './types';

function clampRange(n: number, lo: number, hi: number): number {
  if (!isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

/** Physiological bounds. Escaping these is a bug, not an extreme character. */
export const BODY_LIMITS = {
  heightCm: { min: 140, max: 215 },
  weightKg: { min: 35, max: 250 },
  bodyFatPct: { min: 3, max: 60 },
  muscle: { min: 0, max: 100 },
  fitness: { min: 0, max: 100 },
  posture: { min: 0, max: 100 },
} as const;

/** Force a loaded/partial body into a valid one. */
export function normalizeBody(input: Partial<BodyProfile> | null | undefined): BodyProfile {
  const src = input && typeof input === 'object' ? input : {};
  return {
    heightCm: clampRange(src.heightCm ?? 172, BODY_LIMITS.heightCm.min, BODY_LIMITS.heightCm.max),
    weightKg: clampRange(src.weightKg ?? 70, BODY_LIMITS.weightKg.min, BODY_LIMITS.weightKg.max),
    bodyFatPct: clampRange(src.bodyFatPct ?? 20, BODY_LIMITS.bodyFatPct.min, BODY_LIMITS.bodyFatPct.max),
    muscle: clampRange(src.muscle ?? 30, BODY_LIMITS.muscle.min, BODY_LIMITS.muscle.max),
    fitness: clampRange(src.fitness ?? 40, BODY_LIMITS.fitness.min, BODY_LIMITS.fitness.max),
    posture: clampRange(src.posture ?? 55, BODY_LIMITS.posture.min, BODY_LIMITS.posture.max),
  };
}

/**
 * A starting body for a newly created character.
 *
 * Seeded so the same character always starts the same, and centred on plausible
 * population averages rather than on an idealised physique — the player earns
 * the physique.
 */
export function createBody(seed: string, sex: string, age: number): BodyProfile {
  // Local RNG rather than importing the genome one, so body generation cannot
  // consume draws from the face sequence and shift every face by one call.
  let h = 0x811c9dc5 >>> 0;
  const key = `body:${seed}`;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0;
  }
  let a = h >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const bell = () => (rng() + rng() + rng()) / 3;

  const isMale = String(sex || '').toLowerCase() === 'male';
  const adultHeight = (isMale ? 177 : 164) + (bell() - 0.5) * 26;

  // Children are scaled off their adult height rather than given an independent
  // one, so a character does not shrink when they grow up.
  const growth = age >= 18 ? 1 : clampRange(0.28 + (age / 18) * 0.72, 0.28, 1);
  const heightCm = clampRange(adultHeight * growth, BODY_LIMITS.heightCm.min, BODY_LIMITS.heightCm.max);

  const bodyFatPct = clampRange((isMale ? 18 : 25) + (bell() - 0.5) * 12, 8, 38);
  // Derive mass from height and fat so the three are never mutually absurd.
  const heightM = heightCm / 100;
  const baseBmi = 21 + (bodyFatPct - (isMale ? 18 : 25)) * 0.45;
  const weightKg = clampRange(baseBmi * heightM * heightM, BODY_LIMITS.weightKg.min, BODY_LIMITS.weightKg.max);

  return {
    heightCm: Math.round(heightCm * 10) / 10,
    weightKg: Math.round(weightKg * 10) / 10,
    bodyFatPct: Math.round(bodyFatPct * 10) / 10,
    muscle: clampRange(22 + bell() * 26, 0, 100),
    fitness: clampRange(35 + bell() * 30, 0, 100),
    posture: clampRange(50 + bell() * 25, 0, 100),
  };
}

/** What the world did to the body this week. All values are snapshots. */
export interface BodyWeekInputs {
  age: number;
  /** Nutrition quality, [0, 1]. 0.5 = adequate. Drives muscle gain and skin. */
  dietQuality: number;
  /**
   * Energy balance, [-1, 1]. Negative = deficit (losing), positive = surplus.
   * Separate from `dietQuality` on purpose: you can eat clean in a surplus and
   * eat garbage in a deficit, and those produce genuinely different bodies.
   */
  energyBalance: number;
  /** Training stimulus this week, [0, 1]. 0 = sedentary, 1 = serious athlete. */
  exercise: number;
  /** Stress, [0, 100]. Elevates cortisol → fat retention, muscle loss. */
  stress: number;
  /** General health, [0, 100]. A sick body neither builds nor holds muscle. */
  health: number;
}

export interface BodyWeekResult {
  body: BodyProfile;
  /** Player-facing lines. Empty on an unremarkable week — silence is fine. */
  notes: string[];
}

/**
 * Advance the body by one week.
 *
 * Ordering matters: muscle and fitness are resolved BEFORE mass, because the
 * mass change is partitioned between fat and lean tissue according to how much
 * training stimulus there was. Resolving mass first would make a surplus put on
 * pure fat regardless of whether the player was lifting, which is the single
 * most common way these systems feel wrong.
 */
export function simulateBodyWeek(input: BodyProfile, w: BodyWeekInputs): BodyWeekResult {
  const body = normalizeBody(input);
  const notes: string[] = [];

  const age = clampRange(w.age, 0, 120);
  const diet = clampRange(w.dietQuality, 0, 1);
  const balance = clampRange(w.energyBalance, -1, 1);
  const exercise = clampRange(w.exercise, 0, 1);
  const stress = clampRange(w.stress, 0, 100);
  const health = clampRange(w.health, 0, 100);

  // --- Conditioning -------------------------------------------------------
  // Fitness builds with training and detrains ~2x as fast when it stops. The
  // asymmetry is real and it is what gives consistency a point: a player who
  // trains hard for four weeks and stops loses it in two.
  const fitnessGain = exercise * 4.2 * (0.5 + health / 200);
  const fitnessDecay = 1.6 + (1 - exercise) * 2.4 + Math.max(0, age - 35) * 0.02;
  let fitness = body.fitness + fitnessGain - fitnessDecay;

  // --- Muscle -------------------------------------------------------------
  // Needs three things at once: stimulus, protein, and not being in a deficit.
  // Missing any one of them and the ceiling collapses — which is why "just do
  // cardio and eat nothing" does not produce an athlete here.
  const anabolic = Math.max(0, balance) * 0.5 + Math.max(0, diet - 0.4) * 1.2;
  const stimulus = exercise * anabolic;
  // Diminishing returns: closing the last 20% of the muscle scale is roughly as
  // hard as the first 60%, which is how training actually works.
  const headroom = 1 - body.muscle / 100;
  let muscleDelta = stimulus * 1.35 * Math.max(0.12, headroom);

  // Sarcopenia: ~1%/year of lean mass from ~35, accelerating. Trainable, but
  // untrained aging is a slow bleed the player has to actively resist.
  const sarcopenia = Math.max(0, age - 35) * 0.0045;
  // Disuse atrophy, and a deficit with no stimulus eats muscle first.
  const atrophy = (1 - exercise) * 0.22 + Math.max(0, -balance) * (1 - exercise) * 0.55;
  // Chronic stress is catabolic. Modest, but it compounds over hundreds of weeks.
  const cortisol = Math.max(0, stress - 55) * 0.006;
  muscleDelta -= sarcopenia + atrophy + cortisol;

  let muscle = body.muscle + muscleDelta;

  // --- Mass and composition ----------------------------------------------
  // ~0.35 kg per week at a full surplus/deficit — the sustainable rate. Age
  // slows the metabolism slightly, so holding weight gets harder over a life.
  const metabolicDrag = 1 + Math.max(0, age - 30) * 0.004;
  let weightKg = body.weightKg + balance * 0.35 * (balance > 0 ? metabolicDrag : 1 / metabolicDrag);
  // Training burns beyond the diet's accounting.
  weightKg -= exercise * 0.12;

  const weightDelta = weightKg - body.weightKg;

  // Partition the mass change. With training, a surplus is up to ~45% lean; with
  // none, it is essentially all fat. On the way down, training PROTECTS lean
  // mass — the classic reason to lift while cutting.
  const leanShare = weightDelta > 0 ? 0.1 + exercise * 0.35 : 0.05 + (1 - exercise) * 0.4;
  const fatMassDelta = weightDelta * (1 - leanShare);

  const oldFatMass = (body.bodyFatPct / 100) * body.weightKg;
  const newFatMass = Math.max(0.5, oldFatMass + fatMassDelta);
  let bodyFatPct = weightKg > 0 ? (newFatMass / weightKg) * 100 : body.bodyFatPct;

  // Cortisol nudges fat up independently of calories. Small, deliberately.
  bodyFatPct += Math.max(0, stress - 60) * 0.008;
  // Poor nutrition costs composition even at maintenance.
  if (diet < 0.35) bodyFatPct += (0.35 - diet) * 0.25;

  // --- Posture ------------------------------------------------------------
  // A slow follower of muscle + fitness, minus age. It exists so that training
  // reads on the avatar even before the silhouette moves.
  const postureTarget = clampRange(
    35 + muscle * 0.3 + fitness * 0.25 - Math.max(0, age - 50) * 0.35 - Math.max(0, stress - 60) * 0.15,
    0,
    100,
  );
  const posture = body.posture + (postureTarget - body.posture) * 0.08;

  fitness = clampRange(fitness, BODY_LIMITS.fitness.min, BODY_LIMITS.fitness.max);
  muscle = clampRange(muscle, BODY_LIMITS.muscle.min, BODY_LIMITS.muscle.max);
  weightKg = clampRange(weightKg, BODY_LIMITS.weightKg.min, BODY_LIMITS.weightKg.max);
  bodyFatPct = clampRange(bodyFatPct, BODY_LIMITS.bodyFatPct.min, BODY_LIMITS.bodyFatPct.max);

  // --- Notes --------------------------------------------------------------
  // Only threshold CROSSINGS are reported. A weekly "you gained 0.2 kg" line is
  // noise the player learns to dismiss; crossing into obesity is news.
  const oldBmi = bmi({ ...body });
  const newBmi = bmi({ ...body, weightKg, heightCm: body.heightCm });
  if (oldBmi < 30 && newBmi >= 30) notes.push('Your weight has crossed into the obese range.');
  else if (oldBmi >= 25 && newBmi < 25) notes.push('You are back to a healthy weight.');
  else if (oldBmi >= 18.5 && newBmi < 18.5) notes.push('You are now underweight.');

  if (body.muscle < 70 && muscle >= 70) notes.push('People have started asking if you compete.');
  if (body.fitness >= 30 && fitness < 30) notes.push('You get winded on the stairs now.');

  return {
    body: {
      heightCm: body.heightCm,
      weightKg: Math.round(weightKg * 10) / 10,
      bodyFatPct: Math.round(bodyFatPct * 10) / 10,
      muscle: Math.round(muscle * 100) / 100,
      fitness: Math.round(fitness * 100) / 100,
      posture: Math.round(posture * 100) / 100,
    },
    notes,
  };
}

/** Body mass index. Derived — never stored. */
export function bmi(body: BodyProfile): number {
  const m = body.heightCm / 100;
  if (m <= 0) return 0;
  return body.weightKg / (m * m);
}

/**
 * A one-word silhouette for the UI and for the 3D renderer's body morphs.
 *
 * Reads BOTH fat and muscle, because BMI alone calls a lean 95 kg athlete obese
 * — the single most well-known failure of BMI, and one the player will notice
 * immediately if we reproduce it.
 */
export function silhouette(body: BodyProfile): string {
  const b = normalizeBody(body);
  if (b.bodyFatPct >= 32) return b.muscle >= 55 ? 'Powerful' : 'Heavy';
  if (b.bodyFatPct >= 25) return b.muscle >= 55 ? 'Solid' : 'Soft';
  if (b.bodyFatPct >= 15) {
    if (b.muscle >= 72) return 'Athletic';
    if (b.muscle >= 45) return 'Toned';
    return 'Average';
  }
  if (b.muscle >= 65) return 'Shredded';
  if (b.muscle >= 40) return 'Lean';
  return 'Skinny';
}

/**
 * Physical condition, [0, 100] — the single number other systems ask for.
 *
 * Peaks at a healthy body-fat range rather than rewarding "as lean as possible",
 * so the optimal play is a real physique and not a starvation exploit.
 */
export function physicalCondition(body: BodyProfile): number {
  const b = normalizeBody(body);
  // Ideal band is ~12-20% fat; fall off in both directions.
  const fatPenalty = b.bodyFatPct < 12
    ? (12 - b.bodyFatPct) * 2.4
    : b.bodyFatPct > 20
      ? (b.bodyFatPct - 20) * 1.5
      : 0;
  const raw = 40 + b.muscle * 0.3 + b.fitness * 0.3 + b.posture * 0.1 - fatPenalty;
  return clampRange(raw, 0, 100);
}
