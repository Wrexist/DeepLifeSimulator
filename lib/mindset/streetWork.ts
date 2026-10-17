/**
 * What a Mindset actually does - one table, read by the street-job payout and
 * by the Work-tab card, so the number on the card is the number paid.
 *
 * ── Why street work, and only street work ────────────────────────────────
 *
 * Eleven Mindsets were offered at onboarding (and inherited at heir
 * selection), each with a sentence promising an effect somewhere in the game:
 * savings, travel, stocks, relationships, shopping. Nothing read any of them
 * except one toast in the street-job handler, and that handler only ever
 * passed a positive payout - so five Mindsets (socialite, optimist,
 * adventurous, investor, spender) returned exactly zero change, and the other
 * six changed street-job pay alone while their copy described something else.
 *
 * The street-job payout is the one place a Mindset is consulted, so it is
 * where every Mindset now does something real, and every description in
 * `config.ts` says exactly what is in this table. Wiring the original broader
 * promises (career salary, the happiness curve, travel prices, stock returns)
 * would mean editing those systems' own modules; until that is done the copy
 * names street jobs, because that is the truth.
 *
 * The effects are applied inside `performStreetJob`'s single updater through
 * `getStreetJobTerms` (contexts/game/actions/JobActions.ts), never as a second
 * write. The old path credited a separate adjustment from the screen after the
 * action returned, so a tap the updater refused (energy, weekly cap) still
 * collected its Mindset bonus, and Gambler's swing was a raw `Math.random()`
 * that a reload re-rolled.
 *
 * Nothing here is random and nothing here writes state: it is a pure function
 * of the active Mindset(s) and whether the job is illegal.
 */
import type { GameState } from '@/contexts/game/types';
import { MINDSET_TRAITS, type MindsetId } from './config';

/** One Mindset's effect on a street job. Absent keys are neutral. */
export interface MindsetStreetEffect {
  /** Pay multiplier on every street job. */
  pay?: number;
  /** Pay multiplier on LEGAL street jobs only. */
  legalPay?: number;
  /** Pay multiplier on ILLEGAL street jobs only. */
  illegalPay?: number;
  /** Success chance, in percentage points (before the 95% cap). */
  success?: number;
  /** Arrest chance on illegal jobs, in percentage points (before the 80% cap). */
  arrestPoints?: number;
  /** Arrest chance multiplier on illegal jobs (applied after the cap). */
  arrestMultiplier?: number;
  /** Halve every street job's happiness cost, rounded in the player's favour. */
  halveHappinessCost?: boolean;
  /**
   * Added to every street job's happiness COST (a cost is negative): -1 makes
   * a job cost 1 more happiness, +2 makes it cost 2 less. A cost can never
   * turn into a gain.
   */
  happiness?: number;
  /** Same as `happiness`, LEGAL street jobs only. */
  legalHappiness?: number;
  /** Added to every street job's health cost: -1 = costs 1 more health. */
  health?: number;
  /** Successful runs needed to rank a street job up (the default is 3). */
  runsPerRank?: number;
}

/** The default number of successful runs per street-job rank. */
export const DEFAULT_RUNS_PER_RANK = 3;

/**
 * THE table. Each row is quoted, number for number, by the Mindset's
 * `description` in `config.ts` - `__tests__/actions/mindsetEffects.test.ts`
 * checks every number appears in the copy.
 *
 * Kept modest: no single Mindset moves pay by more than 25%, success by more
 * than 10 points, or arrest risk by more than a quarter. Street work stays an
 * early-game income (see `__tests__/economy/streetJobPay.test.ts`).
 */
export const MINDSET_STREET_EFFECTS: Readonly<Record<MindsetId, MindsetStreetEffect>> = {
  frugal: { pay: 1.10 },
  workaholic: { pay: 1.20, health: -1, happiness: -1 },
  socialite: { legalPay: 1.10, arrestPoints: 5 },
  optimist: { halveHappinessCost: true, success: -5 },
  perfectionist: { success: 10, health: -1 },
  adventurous: { illegalPay: 1.15, legalHappiness: -1 },
  gambler: { illegalPay: 1.25, arrestPoints: 5 },
  riskAverse: { arrestMultiplier: 0.75, pay: 0.95 },
  investor: { runsPerRank: 2, pay: 0.95 },
  spender: { happiness: 2, pay: 0.90 },
  hustler: { pay: 1.15, happiness: -1 },
};

const KNOWN_MINDSETS = new Set<string>(Object.keys(MINDSET_STREET_EFFECTS));

function isMindsetId(id: unknown): id is MindsetId {
  return typeof id === 'string' && KNOWN_MINDSETS.has(id);
}

/**
 * The Mindset ids active on this save.
 *
 * `mindset.traits` is the list both writers set (onboarding and heir
 * selection write `{ activeTraitId, traits: [activeTraitId] }`). A save whose
 * list is missing or empty falls back to `activeTraitId`, which is the id the
 * Home card DISPLAYS - so a Mindset the player can see is a Mindset that
 * applies. Unknown ids are dropped.
 */
export function activeMindsetIds(state: Pick<GameState, 'mindset'> | null | undefined): MindsetId[] {
  const mindset = state?.mindset;
  const listed: unknown[] = Array.isArray(mindset?.traits) ? (mindset?.traits as unknown[]) : [];
  const source = listed.length > 0 ? listed : [mindset?.activeTraitId];
  return [...new Set(source.filter(isMindsetId))];
}

/** The folded effect of every active Mindset on ONE street job. */
export interface MindsetStreetTerms {
  /** Multiplies the job's pay. 1 when no Mindset touches it. */
  payMultiplier: number;
  /** Percentage points added to the success chance. */
  successBonus: number;
  /** Percentage points added to the arrest chance (illegal jobs only). */
  arrestBonus: number;
  /** Multiplies the (capped) arrest chance (illegal jobs only). */
  arrestMultiplier: number;
  /** Halve the happiness cost before the deltas below are added. */
  halveHappinessCost: boolean;
  /** Added to the happiness cost (negative = costs more). */
  happinessDelta: number;
  /** Added to the health cost (negative = costs more). */
  healthDelta: number;
  /** Successful runs per rank-up. */
  runsPerRank: number;
  /**
   * A short note naming the Mindset(s) that changed the pay, e.g.
   * "Frugal +10%" - null when the pay is unchanged. Quoted in the toast so
   * the player can see the Mindset at work.
   */
  payNote: string | null;
}

export const NEUTRAL_MINDSET_STREET_TERMS: Readonly<MindsetStreetTerms> = {
  payMultiplier: 1,
  successBonus: 0,
  arrestBonus: 0,
  arrestMultiplier: 1,
  halveHappinessCost: false,
  happinessDelta: 0,
  healthDelta: 0,
  runsPerRank: DEFAULT_RUNS_PER_RANK,
  payNote: null,
};

const clamp = (n: number, lo: number, hi: number): number =>
  Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;

const finite = (n: unknown, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? n : fallback;

function mindsetName(id: MindsetId): string {
  return MINDSET_TRAITS.find((t) => t.id === id)?.name ?? id;
}

/**
 * Fold the active Mindsets into one set of street-job terms.
 *
 * One Mindset is the norm; the fold exists because `mindset.traits` is a list
 * and a corrupt or hand-edited save could hold several. Every output is
 * clamped so no stack can mint pay, push a chance outside 0-100, or turn a
 * cost into a gain.
 */
export function mindsetStreetTerms(
  ids: readonly MindsetId[],
  illegal: boolean,
): MindsetStreetTerms {
  if (ids.length === 0) return { ...NEUTRAL_MINDSET_STREET_TERMS };

  let payMultiplier = 1;
  let successBonus = 0;
  let arrestBonus = 0;
  let arrestMultiplier = 1;
  let halveHappinessCost = false;
  let happinessDelta = 0;
  let healthDelta = 0;
  let runsPerRank = DEFAULT_RUNS_PER_RANK;
  const notes: string[] = [];

  for (const id of ids) {
    const effect = MINDSET_STREET_EFFECTS[id];
    if (!effect) continue;
    const pay =
      finite(effect.pay, 1) * finite(illegal ? effect.illegalPay : effect.legalPay, 1);
    if (pay !== 1) {
      payMultiplier *= pay;
      const pct = Math.round((pay - 1) * 100);
      notes.push(`${mindsetName(id)} ${pct > 0 ? '+' : ''}${pct}%`);
    }
    successBonus += finite(effect.success, 0);
    if (illegal) {
      arrestBonus += finite(effect.arrestPoints, 0);
      arrestMultiplier *= finite(effect.arrestMultiplier, 1);
    }
    if (effect.halveHappinessCost) halveHappinessCost = true;
    happinessDelta += finite(effect.happiness, 0) + (illegal ? 0 : finite(effect.legalHappiness, 0));
    healthDelta += finite(effect.health, 0);
    if (typeof effect.runsPerRank === 'number') {
      runsPerRank = Math.min(runsPerRank, effect.runsPerRank);
    }
  }

  return {
    payMultiplier: clamp(payMultiplier, 0.5, 1.5),
    successBonus: clamp(successBonus, -25, 25),
    arrestBonus: clamp(arrestBonus, -25, 25),
    arrestMultiplier: clamp(arrestMultiplier, 0.5, 1),
    halveHappinessCost,
    happinessDelta: clamp(happinessDelta, -5, 5),
    healthDelta: clamp(healthDelta, -5, 5),
    runsPerRank: Math.round(clamp(runsPerRank, 2, DEFAULT_RUNS_PER_RANK)),
    payNote: notes.length > 0 ? notes.join(', ') : null,
  };
}
