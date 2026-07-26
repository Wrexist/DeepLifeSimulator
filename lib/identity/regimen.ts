/**
 * The weekly regimen — diet and training as player choices with real costs.
 *
 * `body.ts` knows how a body responds to inputs. This file decides what those
 * inputs ARE, given what the player chose and what they can afford. Splitting
 * them keeps the physiology honest: the simulation cannot be quietly tuned to
 * make a choice feel better, because it never sees the choice.
 *
 * ## Every option costs something
 *
 * The design rule is that no regimen is free, so there is no dominant pick:
 *   - `cut`     — costs happiness (hunger) and a little energy.
 *   - `bulk`    — costs money (food is not free) and adds fat alongside muscle.
 *   - `intense` — costs the most energy, and energy is the same currency work
 *                 and social life run on. Training hard has an opportunity cost.
 *
 * That last one is what makes the chapter interact with the rest of the game
 * instead of sitting beside it: a player who trains for a physique has less
 * energy for the career ladder that week, and has to decide which they want.
 */

import type { NutritionMode, Regimen, TrainingMode } from './types';

function clampRange(n: number, lo: number, hi: number): number {
  if (!isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

export interface NutritionOption {
  id: NutritionMode;
  name: string;
  description: string;
  /** Fed straight into `BodyWeekInputs.energyBalance`. */
  energyBalance: number;
  /** Weekly grocery cost on top of normal living expenses. */
  weeklyCost: number;
  /** Weekly happiness delta. Cutting is miserable; that is the point. */
  happiness: number;
  /** Weekly energy delta. */
  energy: number;
}

export const NUTRITION_OPTIONS: readonly NutritionOption[] = [
  {
    id: 'cut',
    name: 'Cutting',
    description: 'Eating at a deficit. You will lose fat, and you will be hungry doing it.',
    energyBalance: -0.65,
    weeklyCost: 90,
    happiness: -1.6,
    energy: -1.2,
  },
  {
    id: 'maintain',
    name: 'Maintaining',
    description: 'Eating roughly what you burn. Nothing changes fast in either direction.',
    energyBalance: 0,
    weeklyCost: 110,
    happiness: 0,
    energy: 0,
  },
  {
    id: 'bulk',
    name: 'Bulking',
    description: 'Eating at a surplus to build. Some of it will be muscle. Some of it will not.',
    energyBalance: 0.6,
    weeklyCost: 185,
    happiness: 0.4,
    energy: 0.5,
  },
];

export interface TrainingOption {
  id: TrainingMode;
  name: string;
  description: string;
  /** Fed straight into `BodyWeekInputs.exercise`. */
  intensity: number;
  /** Weekly energy cost — the opportunity cost that makes this a real choice. */
  energy: number;
  /** Weekly happiness delta. Moving your body feels good, to a point. */
  happiness: number;
  /** True if this requires a gym membership. */
  requiresGym: boolean;
}

export const TRAINING_OPTIONS: readonly TrainingOption[] = [
  {
    id: 'none',
    name: 'Not training',
    description: 'No deliberate exercise. Your body will slowly reflect that.',
    intensity: 0,
    energy: 0,
    happiness: 0,
    requiresGym: false,
  },
  {
    id: 'light',
    name: 'Walking & light activity',
    description: 'Free, low effort, and far better than nothing.',
    intensity: 0.28,
    energy: -1.5,
    happiness: 0.6,
    requiresGym: false,
  },
  {
    id: 'regular',
    name: 'Training 3x a week',
    description: 'A real routine. Progress you can see over months.',
    intensity: 0.62,
    energy: -4,
    happiness: 1.1,
    requiresGym: true,
  },
  {
    id: 'intense',
    name: 'Training 6x a week',
    description: 'Serious commitment. It will cost you energy you need elsewhere.',
    intensity: 0.95,
    energy: -8,
    happiness: 0.7,
    requiresGym: true,
  },
];

export function getNutritionOption(id: string): NutritionOption {
  return NUTRITION_OPTIONS.find((o) => o.id === id) ?? NUTRITION_OPTIONS[1];
}

export function getTrainingOption(id: string): TrainingOption {
  return TRAINING_OPTIONS.find((o) => o.id === id) ?? TRAINING_OPTIONS[0];
}

/** Force a loaded/partial regimen into a valid one. */
export function normalizeRegimen(input: Partial<Regimen> | null | undefined): Regimen {
  const src = input && typeof input === 'object' ? input : {};
  const nutrition = NUTRITION_OPTIONS.some((o) => o.id === src.nutrition)
    ? (src.nutrition as NutritionMode)
    : 'maintain';
  const training = TRAINING_OPTIONS.some((o) => o.id === src.training)
    ? (src.training as TrainingMode)
    : 'none';
  return { nutrition, training };
}

/** The default regimen for a new character: eating normally, not training. */
export function createRegimen(): Regimen {
  return { nutrition: 'maintain', training: 'none' };
}

export interface RegimenContext {
  hasGym: boolean;
  money: number;
  energy: number;
}

/**
 * Resolve what the character ACTUALLY did this week.
 *
 * The chosen regimen is an intent; this returns the reality. Three things can
 * downgrade it, and all three are deliberate:
 *
 *   1. **No gym** — `regular`/`intense` fall back to `light`. The membership is
 *      a real gate, so buying it is a real unlock rather than a stat trinket.
 *   2. **No money** — a bulk you cannot fund is not a bulk. Without this, the
 *      broke player gets a free surplus, which is the same class of exploit the
 *      diet-plan tick already guards against (see `applyDietPlan`).
 *   3. **No energy** — you cannot train six days a week on an empty tank. This
 *      stops `intense` from being a free permanent selection the player sets
 *      once and forgets.
 *
 * Returning the downgrade reason (rather than silently substituting) lets the
 * weekly tick tell the player why their plan did not happen, which is the
 * difference between a system that feels broken and one that feels strict.
 */
export interface ResolvedRegimen {
  nutrition: NutritionOption;
  training: TrainingOption;
  /** Player-facing lines explaining any downgrade. Empty when the plan held. */
  downgrades: string[];
}

export function resolveRegimen(regimen: Regimen, ctx: RegimenContext): ResolvedRegimen {
  const r = normalizeRegimen(regimen);
  const downgrades: string[] = [];

  let nutrition = getNutritionOption(r.nutrition);
  let training = getTrainingOption(r.training);

  if (training.requiresGym && !ctx.hasGym) {
    downgrades.push('Without a gym membership you could only manage light activity.');
    training = getTrainingOption('light');
  }

  // Sequential, NOT else-if: the downgrade has to cascade. An `else if` chain
  // stepped `intense` down to `regular` at 10 energy and then never re-checked
  // the `regular` threshold, so a completely exhausted player still trained
  // three times a week. Each rung is now evaluated in turn.
  const energy = clampRange(ctx.energy, 0, 100);
  if (training.id === 'intense' && energy < 35) {
    downgrades.push('You were too drained to keep up six sessions — you trained three times instead.');
    training = getTrainingOption('regular');
  }
  if (training.id === 'regular' && energy < 15) {
    downgrades.push('You were too drained to train properly this week.');
    training = getTrainingOption('light');
  }

  const money = typeof ctx.money === 'number' && isFinite(ctx.money) ? ctx.money : 0;
  if (money < nutrition.weeklyCost) {
    if (nutrition.id === 'bulk') {
      downgrades.push("You couldn't afford to eat in a surplus this week.");
      nutrition = getNutritionOption('maintain');
    }
    // Still unaffordable even at maintenance — that is an involuntary deficit,
    // which is exactly what being broke does to a body. Not a downgrade message,
    // because the player already knows they are broke.
    if (money < nutrition.weeklyCost) {
      nutrition = {
        ...getNutritionOption('cut'),
        id: 'cut',
        name: 'Going without',
        description: 'You could not afford to eat properly.',
        weeklyCost: Math.max(0, money),
        happiness: -3,
      };
    }
  }

  return { nutrition, training, downgrades };
}

/**
 * Nutrition quality for the body simulation, [0, 1].
 *
 * Distinct from energy balance: quality is about protein and micronutrients,
 * balance is about total calories. A funded bulk is high quality; an
 * involuntary deficit is not, regardless of how few calories it involves.
 */
export function nutritionQuality(nutrition: NutritionOption, money: number): number {
  if (nutrition.name === 'Going without') return 0.12;
  // Money buys better food, with sharply diminishing returns past comfortable.
  const affluence = clampRange(Math.log10(Math.max(1, money)) / 5, 0, 1);
  const base = nutrition.id === 'bulk' ? 0.62 : nutrition.id === 'cut' ? 0.58 : 0.5;
  return clampRange(base + affluence * 0.3, 0, 1);
}
