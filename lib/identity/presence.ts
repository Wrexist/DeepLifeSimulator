/**
 * Presence — the one number the rest of the game asks Identity for.
 *
 * Every other system (dating, interviews, social, fame) needs "how does this
 * person land on someone who just met them". Without a single derived score,
 * each of those systems would grow its own ad-hoc formula over `bodyFatPct` and
 * `grooming`, and they would drift apart within two releases. So there is
 * exactly one function, and everyone calls it.
 *
 * ## Never stored
 *
 * Presence is computed on demand and deliberately absent from `Identity`. A
 * stored score is a desync waiting to happen: the moment something changes the
 * body without remembering to recompute, the player's face and their number
 * disagree, and there is no way to tell which one is lying.
 *
 * ## Design constraints this formula is built to satisfy
 *
 * 1. **No component can dominate.** If looks alone could reach 90, the chapter
 *    becomes "roll a good face, ignore the rest", and every player who did not
 *    reroll feels locked out of content. Face is capped at ~30% of the total.
 * 2. **Everything is reachable.** Grooming, wardrobe, fitness and confidence are
 *    all purchasable or trainable, so a plain-looking character who maintains
 *    themselves out-scores a beautiful one who does not. That is both true and
 *    the more interesting game.
 * 3. **Age shifts the weights, it does not just subtract.** A flat age penalty
 *    would make the back half of every life a slow, unplayable decline. Instead
 *    the *composition* changes: youth leans on looks, middle age on grooming and
 *    bearing, and status starts carrying real weight. An old character is not
 *    worse — they compete on different axes.
 */

import { facialHarmony } from './faceGenome';
import { physicalCondition } from './body';
import { presentationScore } from './style';
import type { FaceGenome, BodyProfile, StyleProfile } from './types';

function clampRange(n: number, lo: number, hi: number): number {
  if (!isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

export interface PresenceInputs {
  face: FaceGenome;
  body: BodyProfile;
  style: StyleProfile;
  age: number;
  /** [0, 100]. Bearing — the thing that makes people believe you. */
  confidence?: number;
  /** [0, 100]. Social standing. Matters more the older you get. */
  reputation?: number;
  /** [0, 100]. Illness reads on a face before it reads anywhere else. */
  health?: number;
}

export interface PresenceBreakdown {
  /** The headline score, [0, 100]. */
  total: number;
  /** Component contributions, already weighted. They sum to `total`. */
  looks: number;
  physique: number;
  presentation: number;
  bearing: number;
  status: number;
  /** Human-readable band for the UI. */
  label: string;
}

/**
 * Age weighting curve.
 *
 * Returns multipliers for each component. The weights always sum to 1 so the
 * score stays on a stable 0-100 scale regardless of age — only the *mix*
 * changes, which is the whole point.
 */
function ageWeights(age: number): {
  looks: number;
  physique: number;
  presentation: number;
  bearing: number;
  status: number;
} {
  const a = clampRange(age, 0, 120);
  // Youth (< 25): the face does most of the work, status almost none.
  // Midlife (~45): grooming and bearing take over.
  // Late (65+): status and bearing dominate; the face is a minor term.
  const t = clampRange((a - 18) / 52, 0, 1); // 0 at 18, 1 at 70+
  const looks = 0.34 - 0.19 * t;
  const physique = 0.22 - 0.07 * t;
  const presentation = 0.2 + 0.03 * t;
  const bearing = 0.16 + 0.09 * t;
  const status = 0.08 + 0.14 * t;
  // Normalize defensively so future tuning cannot silently break the 0-100 scale.
  const sum = looks + physique + presentation + bearing + status;
  return {
    looks: looks / sum,
    physique: physique / sum,
    presentation: presentation / sum,
    bearing: bearing / sum,
    status: status / sum,
  };
}

/** Band label for the UI. */
export function presenceLabel(total: number): string {
  if (total >= 88) return 'Magnetic';
  if (total >= 76) return 'Striking';
  if (total >= 64) return 'Attractive';
  if (total >= 52) return 'Presentable';
  if (total >= 38) return 'Forgettable';
  if (total >= 24) return 'Unkempt';
  return 'Off-putting';
}

/**
 * The full presence calculation, with its breakdown.
 *
 * The breakdown is returned rather than just the total because the UI has to be
 * able to tell the player *why* — a bare number they cannot act on is exactly
 * the kind of opaque stat this codebase already builds breakdown modals for
 * (see `HappinessBreakdownModal`, `NetWorthBreakdownModal`).
 */
export function computePresence(inputs: PresenceInputs): PresenceBreakdown {
  const age = clampRange(inputs.age, 0, 120);
  const w = ageWeights(age);

  // Looks: genome harmony, gently penalised by visible ill health. Mapped onto
  // 25-100 rather than 0-100 — nobody in this game is a 3/100 by birth, and a
  // floor keeps an unlucky reroll from being unplayable.
  const harmony = facialHarmony(inputs.face);
  const healthPenalty = Math.max(0, 70 - clampRange(inputs.health ?? 80, 0, 100)) * 0.35;
  const looksRaw = clampRange(25 + harmony * 75 - healthPenalty, 0, 100);

  const physiqueRaw = physicalCondition(inputs.body);
  const presentationRaw = presentationScore(inputs.style);
  const bearingRaw = clampRange(inputs.confidence ?? 50, 0, 100);
  const statusRaw = clampRange(inputs.reputation ?? 0, 0, 100);

  const looks = looksRaw * w.looks;
  const physique = physiqueRaw * w.physique;
  const presentation = presentationRaw * w.presentation;
  const bearing = bearingRaw * w.bearing;
  const status = statusRaw * w.status;

  const total = clampRange(looks + physique + presentation + bearing + status, 0, 100);

  return {
    total: Math.round(total * 10) / 10,
    looks: Math.round(looks * 10) / 10,
    physique: Math.round(physique * 10) / 10,
    presentation: Math.round(presentation * 10) / 10,
    bearing: Math.round(bearing * 10) / 10,
    status: Math.round(status * 10) / 10,
    label: presenceLabel(total),
  };
}

/**
 * Presence as a multiplier for another system's success roll.
 *
 * Returns ~0.75 at the bottom and ~1.30 at the top. The band is deliberately
 * narrow: appearance should be a real edge, not a replacement for competence.
 * A charming idiot must still fail the interview they are unqualified for, or
 * the game's entire career ladder becomes decorative.
 */
export function presenceMultiplier(total: number, strength = 1): number {
  const t = clampRange(total, 0, 100);
  const raw = 0.75 + (t / 100) * 0.55;
  // `strength` lets each caller decide how much appearance matters to it —
  // dating cares a lot (1.0), an engineering interview much less (~0.35).
  return 1 + (raw - 1) * clampRange(strength, 0, 1);
}
