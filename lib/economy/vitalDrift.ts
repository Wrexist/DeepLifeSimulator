/**
 * Where the vitals go each week, and why - as a projection the player can read.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Measured on a fresh Quick Start (Program 6 walkthrough): a player who takes
 * the first job and taps Next Week loses ~9 happiness and ~6 health a week
 * from three causes at once - the poverty-scaled natural decay, the homeless
 * penalty (every scenario starts without a home) and the job's weekly toll -
 * and nothing on screen names any of them. The recap reports money and
 * career; the breakdown modals behind the HUD rings do list the causes, but
 * nothing invites that tap. Happiness reached 0 on week 9 and the character
 * died on week 13 with $4,240 in the bank, having been shown one vague tip.
 *
 * This is the one shared source for "what the vitals will do next week". The
 * recap renders it as a line with a destination (Life → Health, where the free
 * offsets live). It is a PROJECTION, computed from the current state with the
 * same formulas the tick uses, so it can be shown before the slide becomes a
 * crisis rather than after.
 *
 * ── What it deliberately mirrors ────────────────────────────────────────────
 *
 * - Natural decay: `computeDecayInputs` in `preTick.ts` - base 4 × wealth
 *   multiplier (100k / net worth, clamped 0.5–1.0 - `lib/economy/statDecay.ts`)
 *   × prestige multiplier × the 8-week grace ramp; health takes ×0.6,
 *   happiness ×0.8 (halved by the Happiness Boost gold upgrade). `lib/` may
 *   not import that function (CLAUDE.md §5), so the composition is restated
 *   here over the SAME shared pieces, and a parity test pins the two together
 *   (`lib/economy/__tests__/vitalDrift.test.ts`).
 * - Housing: `computeHousingWellbeing` - the same function the tick calls.
 * - Job toll: the entry-job profile scaled by level, as
 *   `applyCareerSalaryAndPenalty` does; non-profiled careers take the −3/−2
 *   default it uses.
 * - Items: the weekly `dailyBonus` loop in the tick (bed, gym membership).
 * - Energy regen: the tick's base +40 × prestige multiplier, before the job
 *   and housing take theirs.
 *
 * Net worth is read from the canonical `netWorth` in `lib/progress/achievements`
 * rather than the tick's private `calculateNetWorth`; the two count slightly
 * different slices, but the multiplier is clamped to 1.0 for anything under
 * $100k and to 0.5 above $200k, so they agree across the whole early game.
 */
import type { GameState } from '@/contexts/game/types';
import { computeHousingWellbeing } from '@/lib/realEstate/rentals';
import { getEntryJobProfile } from '@/lib/careers/jobMarket';
import { getEnergyRegenMultiplier, getStatDecayMultiplier } from '@/lib/prestige/applyBonuses';
import { netWorth } from '@/lib/progress/achievements';
import { STAT_DECAY_BASE_RATE, graceRampFactor, wealthDecayMultiplier } from '@/lib/economy/statDecay';
import { weeksSinceLifeStart } from '@/utils/weekCounters';

export type DriftCauseId = 'decay' | 'home' | 'job' | 'items' | 'rest';

export interface DriftCause {
  id: DriftCauseId;
  /** Short, player-facing: "No home", "Fast food shifts", "Natural decay". */
  label: string;
  health: number;
  happiness: number;
  energy: number;
}

export interface VitalDrift {
  /** Net weekly change per vital, all causes summed. Negative = falling. */
  health: number;
  happiness: number;
  energy: number;
  /** Every non-zero cause, worst first by combined happiness + health cost. */
  causes: DriftCause[];
}

const BASE_ENERGY_REGEN = 40;

const finite = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * The tick's `effectiveDecayRate` for this state - the number health (×0.6)
 * and happiness (×0.8) lose to "natural decay" on the next Next Week.
 */
export function projectedDecayRate(state: GameState): number {
  const wealthMultiplier = wealthDecayMultiplier(finite(netWorth(state), 0));
  const prestigeMultiplier = getStatDecayMultiplier(state.prestige?.unlockedBonuses || []);
  const safePrestige = Number.isFinite(prestigeMultiplier) && prestigeMultiplier > 0 ? prestigeMultiplier : 1;
  const weeks = weeksSinceLifeStart(state.weeksLived, state.lifeStartWeek);
  const rate = STAT_DECAY_BASE_RATE * wealthMultiplier * safePrestige * graceRampFactor(weeks);
  return Number.isFinite(rate) && rate >= 0 ? rate : STAT_DECAY_BASE_RATE;
}

function jobToll(state: GameState): DriftCause | null {
  if (!state.currentJob) return null;
  const career = (state.careers ?? []).find((c) => c?.id === state.currentJob && c?.accepted);
  if (!career || !Array.isArray(career.levels) || career.levels.length === 0) return null;
  const levelCount = career.levels.length;
  const level = Math.min(Math.max(0, finite(career.level, 0)), levelCount - 1);
  const levelProgress = levelCount > 1 ? Math.min(1, Math.max(0, level / (levelCount - 1))) : 0;
  const penaltyFactor = 1 - 0.7 * levelProgress;
  const scaled = (authored: number): number =>
    authored >= 0 ? Math.round(authored) : -Math.max(1, Math.round(-authored * penaltyFactor));
  const profile = getEntryJobProfile(career.id);
  const happiness = profile ? scaled(profile.weeklyToll.happiness ?? -3) : -Math.max(1, Math.round(3 * penaltyFactor));
  const health = profile ? scaled(profile.weeklyToll.health ?? -2) : -Math.max(1, Math.round(2 * penaltyFactor));
  const energy = profile ? scaled(profile.weeklyToll.energy) : 0;
  const title = career.levels[level]?.name || career.id;
  return { id: 'job', label: `${title} shifts`, health, happiness, energy };
}

function itemBonuses(state: GameState): DriftCause | null {
  let health = 0;
  let happiness = 0;
  let energy = 0;
  for (const item of state.items ?? []) {
    if (!item?.owned || !item.dailyBonus) continue;
    health += finite(item.dailyBonus.health, 0);
    happiness += finite(item.dailyBonus.happiness, 0);
    energy += finite(item.dailyBonus.energy, 0);
  }
  if (health === 0 && happiness === 0 && energy === 0) return null;
  return { id: 'items', label: 'What you own', health, happiness, energy };
}

/**
 * Project next week's vital changes from the current state.
 *
 * Pure and total: a malformed state yields the natural-decay line and nothing
 * else, never a throw - this is read on Home after every tick.
 */
export function projectWeeklyVitalDrift(state: GameState | null | undefined): VitalDrift {
  const empty: VitalDrift = { health: 0, happiness: 0, energy: 0, causes: [] };
  if (!state) return empty;
  const causes: DriftCause[] = [];

  const rate = projectedDecayRate(state);
  const happinessMul = state.goldUpgrades?.happiness_boost ? 0.5 : 1;
  causes.push({
    id: 'decay',
    label: 'Natural decay',
    health: -Math.round(rate * 0.6),
    happiness: -Math.round(rate * 0.8 * happinessMul),
    energy: 0,
  });

  const housing = computeHousingWellbeing({ realEstate: state.realEstate, rental: state.rental });
  if (housing.health !== 0 || housing.happiness !== 0 || housing.energy !== 0) {
    causes.push({
      id: 'home',
      label: housing.homeless ? 'No home' : 'Your home',
      health: housing.health,
      happiness: housing.happiness,
      energy: housing.energy,
    });
  }

  const job = jobToll(state);
  if (job) causes.push(job);

  const items = itemBonuses(state);
  if (items) causes.push(items);

  const regenMultiplier = getEnergyRegenMultiplier(state.prestige?.unlockedBonuses || []);
  const safeRegen = Number.isFinite(regenMultiplier) && regenMultiplier > 0 ? regenMultiplier : 1;
  causes.push({
    id: 'rest',
    label: 'A week of rest',
    health: 0,
    happiness: 0,
    energy: Math.round(BASE_ENERGY_REGEN * safeRegen),
  });

  const sum = (key: 'health' | 'happiness' | 'energy') =>
    causes.reduce((acc, c) => acc + c[key], 0);

  const ordered = causes
    .filter((c) => c.health !== 0 || c.happiness !== 0 || c.energy !== 0)
    .sort((a, b) => a.happiness + a.health - (b.happiness + b.health));

  return { health: sum('health'), happiness: sum('happiness'), energy: sum('energy'), causes: ordered };
}

/** The causes that cost happiness or health, worst first - for a short label. */
export function driftDrainLabels(drift: VitalDrift, max = 3): string[] {
  return drift.causes
    .filter((c) => c.happiness < 0 || c.health < 0)
    .slice(0, max)
    .map((c) => c.label);
}
