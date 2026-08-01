/**
 * Progressive disclosure — what a player can see, and when.
 *
 * A brand-new player used to land on NINE tabs and twenty-six apps, none of
 * them gated. That is the whole game presented at once to someone who has not
 * yet earned $500 or taken a job, and it is the single biggest thing making a
 * first session feel unreadable.
 *
 * Features now unlock along the five life chapters that already existed in
 * `lifeChapters.ts` — Fresh Start, Settling In, On The Rise, Building Empire,
 * Legacy. Those chapters had goals, ordering and rewards but only ever fed a
 * progress card; making them the unlock spine gives that system a job and
 * means the pacing is already play-tested content rather than invented gates.
 * Chapter 2's goal is literally "buy a phone", which is exactly when the phone
 * should appear.
 *
 * ── Two rules that matter more than the table ─────────────────────────────
 *
 * 1. UNLOCK STATE IS DERIVED, NEVER STORED. There is no `unlockedFeatures`
 *    field and there must not be one. It is computed from progress the player
 *    already has, so an existing save — mid-career, with money and completed
 *    chapters — opens with everything it had yesterday. Storing it would mean
 *    a migration that has to guess, and guessing wrong takes features away
 *    from someone who already had them. That is the failure mode this design
 *    exists to avoid.
 *
 * 2. NOTHING IS EVER TAKEN AWAY. `unlockTier` is monotonic in progress:
 *    completed chapters only accumulate, and the fallbacks below only ever
 *    raise the tier. A player cannot lose a tab by losing money.
 *
 * Locked features are shown with a padlock and their requirement rather than
 * hidden, so the shape of the game is legible from week 1 and the tab bar does
 * not reshuffle underneath the player as things unlock.
 */
import type { GameState } from '@/contexts/game/types';
import { LIFE_CHAPTERS } from './lifeChapters';

/**
 * Tier 0 is "before you have finished anything" — the state a brand-new
 * character is in. Tier N means chapter N has been completed.
 */
export type UnlockTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface FeatureUnlock {
  /** `tab:<route>` or `app:<appKey>`, matching the router / app-grid keys. */
  id: string;
  /** Chapter completions required. 0 = available from the first screen. */
  tier: UnlockTier;
  /** Shown on the padlock. Written for a player, not a developer. */
  requirement: string;
}

/**
 * The tabs a brand-new player sees: enough to look at yourself, do something,
 * take a job, and stay alive.
 *
 * `market` is tier 0 too, deliberately. Food and the gym live there and health
 * decays from week 1, so gating it behind a chapter could strand a player with
 * no way to eat — the one genuinely unsafe gate in this whole table.
 */
export const FEATURE_UNLOCKS: FeatureUnlock[] = [
  // ── Tier 0 — the first session ──────────────────────────────────────────
  { id: 'tab:home', tier: 0, requirement: '' },
  { id: 'tab:life', tier: 0, requirement: '' },
  { id: 'tab:work', tier: 0, requirement: '' },
  { id: 'tab:health', tier: 0, requirement: '' },
  { id: 'tab:market', tier: 0, requirement: '' },

  // ── Tier 1 — Fresh Start done: earned $500, got hired, survived 4 weeks ──
  { id: 'tab:progression', tier: 1, requirement: 'Finish Chapter 1: Fresh Start' },
  { id: 'tab:apps', tier: 1, requirement: 'Finish Chapter 1: Fresh Start' },
  { id: 'tab:mobile', tier: 1, requirement: 'Finish Chapter 1: Fresh Start' },
  { id: 'app:contacts', tier: 1, requirement: 'Finish Chapter 1: Fresh Start' },
  { id: 'app:bank', tier: 1, requirement: 'Finish Chapter 1: Fresh Start' },

  // ── Tier 2 — Settling In done: promotion, $2k saved, a phone, a friend ───
  { id: 'tab:computer', tier: 2, requirement: 'Finish Chapter 2: Settling In' },
  { id: 'app:social', tier: 2, requirement: 'Finish Chapter 2: Settling In' },
  { id: 'app:tinder', tier: 2, requirement: 'Finish Chapter 2: Settling In' },
  { id: 'app:education', tier: 2, requirement: 'Finish Chapter 2: Settling In' },
  { id: 'app:paw', tier: 2, requirement: 'Finish Chapter 2: Settling In' },
  { id: 'app:pet', tier: 2, requirement: 'Finish Chapter 2: Settling In' },

  // ── Tier 3 — On The Rise done: $10k, a partner, an investment ───────────
  { id: 'app:stocks', tier: 3, requirement: 'Finish Chapter 3: On the Rise' },
  { id: 'app:realestate', tier: 3, requirement: 'Finish Chapter 3: On the Rise' },
  { id: 'app:bitcoin', tier: 3, requirement: 'Finish Chapter 3: On the Rise' },
  { id: 'app:vehicle', tier: 3, requirement: 'Finish Chapter 3: On the Rise' },
  { id: 'app:travel', tier: 3, requirement: 'Finish Chapter 3: On the Rise' },

  // ── Tier 4 — Building Empire done: $50k net, a business, a degree ───────
  { id: 'app:company', tier: 4, requirement: 'Finish Chapter 4: Building an Empire' },
  { id: 'app:gaming', tier: 4, requirement: 'Finish Chapter 4: Building an Empire' },
  { id: 'app:streaming', tier: 4, requirement: 'Finish Chapter 4: Building an Empire' },
  { id: 'app:statistics', tier: 4, requirement: 'Finish Chapter 4: Building an Empire' },

  // ── Tier 5 — Legacy: the deep end ───────────────────────────────────────
  { id: 'app:onion', tier: 5, requirement: 'Finish Chapter 5: Legacy' },
  { id: 'app:political', tier: 5, requirement: 'Finish Chapter 5: Legacy' },
  { id: 'app:luxury', tier: 5, requirement: 'Finish Chapter 5: Legacy' },
];

const BY_ID = new Map(FEATURE_UNLOCKS.map((f) => [f.id, f]));

/**
 * How far along a save is, as a tier.
 *
 * DERIVED, never stored — see the header. Three sources, and the highest wins
 * so the result can only ever go up:
 *
 *   - completed chapters, the intended signal
 *   - a save that has prestiged, or lived long enough to be well past the
 *     chapter arc, is unconditionally at the top. This is the safety net for
 *     every save that existed before this feature: they never had chapter
 *     completions written, so counting only chapters would strip tabs from a
 *     300-week veteran.
 *   - concrete milestones, for a save mid-arc whose chapter flags never landed
 *     (`completedChapters` is only written when the player opens the card).
 */
export function unlockTier(state: GameState | undefined | null): UnlockTier {
  if (!state) return 0;

  const completed = Array.isArray(state.completedChapters) ? state.completedChapters : [];
  const chapterIds = LIFE_CHAPTERS.map((c) => c.id);
  // Count completions in ORDER, so an out-of-order flag cannot skip a tier.
  let byChapters = 0;
  for (const id of chapterIds) {
    if (!completed.includes(id)) break;
    byChapters += 1;
  }

  const weeksLived = num(state.weeksLived);
  const prestiged = num(state.prestige?.totalPrestiges) > 0
    || num(state.generationNumber) > 1;

  // The veteran escape hatch. Anything past the chapter arc gets everything.
  if (prestiged || weeksLived >= 120) return 5;

  // Milestone fallbacks, for saves whose chapter flags never got written.
  const netish = num(state.stats?.money) + num(state.bankSavings);
  let byMilestone = 0;
  if (state.currentJob || netish >= 500 || weeksLived >= 4) byMilestone = 1;
  if (netish >= 2_000) byMilestone = 2;
  if (netish >= 10_000) byMilestone = 3;
  if (netish >= 50_000) byMilestone = 4;
  if (netish >= 200_000) byMilestone = 5;

  return Math.min(5, Math.max(byChapters, byMilestone)) as UnlockTier;
}

const num = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;

/**
 * Is this feature available yet?
 *
 * An id with no entry in the table is UNLOCKED. That default is deliberate:
 * forgetting to register a new app should make it visible, not invisible. A
 * missing feature is a bug nobody reports.
 */
export function isFeatureUnlocked(state: GameState | undefined | null, id: string): boolean {
  const feature = BY_ID.get(id);
  if (!feature) return true;
  return unlockTier(state) >= feature.tier;
}

/** What the padlock should say. Empty string when it is already unlocked. */
export function unlockRequirement(state: GameState | undefined | null, id: string): string {
  const feature = BY_ID.get(id);
  if (!feature || isFeatureUnlocked(state, id)) return '';
  return feature.requirement;
}

/** Everything at a given tier — used to tell the player what they just earned. */
export function featuresUnlockedAtTier(tier: UnlockTier): FeatureUnlock[] {
  return FEATURE_UNLOCKS.filter((f) => f.tier === tier);
}
