/**
 * Reward safety - the caps, the ledger, and the budget.
 *
 * THREE INDEPENDENT PROTECTIONS, because each one fails differently.
 *
 * 1. PER-REWARD CAPS bound what a single definition may promise. They are
 *    checked at VALIDATION time, so an over-generous event - authored by
 *    mistake, or arriving from a compromised remote payload - never reaches a
 *    player at all. Caps alone are not enough: twenty capped events in a week
 *    is still twenty times the cap.
 *
 * 2. THE CLAIM LEDGER makes a claim idempotent. Keyed on the event INSTANCE
 *    (`eventId@startsAt`), so the same window can never pay twice however the
 *    player gets back to it - a double tap in one React batch, an app restart
 *    mid-claim, or a device clock scrubbed back into a window already claimed.
 *    This repo's single most repeated bug is gate-then-grant (CLAUDE.md 4.4),
 *    so the check and the grant happen in ONE `setGameState` updater and the
 *    check reads `prev`.
 *
 * 3. THE ROLLING BUDGET bounds the TOTAL across every event, per real week.
 *    This is the protection that actually keeps the economy safe, because it is
 *    the only one that holds no matter how many events are scheduled or how
 *    they overlap. A live-ops calendar is authored under time pressure; the
 *    budget is what makes a scheduling mistake cost a skipped reward rather
 *    than an inflation event.
 *
 * CALIBRATION. The gem caps sit deliberately just above the existing weekly
 * challenge band (125-300 gems per four game weeks) so a live event feels
 * like a good week rather than a new faucet. The CASH cap is a flat number and
 * does NOT scale with net worth, on purpose: a net-worth-relative reward
 * compounds, which is exactly how the ad orb became a doubling machine before
 * v35 capped it. Flat means meaningful early and negligible late, which is also
 * the right shape - a live event should help a struggling player, not enrich
 * one who has already won.
 */
import type { LiveReward, LiveRewardKind } from './types';

/** The most any SINGLE event may promise, per currency. */
export const REWARD_CAPS: Readonly<Record<LiveRewardKind, number>> = {
  // ~2x the richest weekly challenge (300). A great week, not a new faucet.
  gems: 500,
  // Flat, and deliberately not net-worth-relative - see the header.
  cash: 25_000,
  // Legacy Points are earned over whole LIVES; even 5 is generous here.
  legacyPoints: 5,
};

/**
 * The most any single event may promise across ALL currencies at once,
 * expressed in gem-equivalents. Without it, an event could pay the full cap of
 * every currency simultaneously and be worth three times what any one cap
 * allows.
 */
export const MAX_EVENT_VALUE_GEMS = 600;

/** The most that may be CLAIMED from live events in any rolling 7 real days. */
export const WEEKLY_BUDGET_GEMS = 900;

/** Gem-equivalent exchange rates, for the value cap and the budget only. */
const GEM_EQUIVALENT: Readonly<Record<LiveRewardKind, number>> = {
  gems: 1,
  // $500 ~= 1 gem. Anchored on the gem shop's rough cash-to-gem ratio; it does
  // not need to be exact, only stable, because it is used for BUDGETING, never
  // to convert anything a player holds.
  cash: 1 / 500,
  // A Legacy Point takes a meaningful slice of a life to earn.
  legacyPoints: 100,
};

/** One reward's worth in gem-equivalents. Non-finite input scores 0. */
export function rewardValueInGems(reward: LiveReward): number {
  const rate = GEM_EQUIVALENT[reward.kind];
  if (rate === undefined) return 0;
  const amount = Number.isFinite(reward.amount) ? Math.max(0, reward.amount) : 0;
  return amount * rate;
}

/** A reward bundle's total worth in gem-equivalents. */
export function bundleValueInGems(rewards: readonly LiveReward[]): number {
  return rewards.reduce((sum, r) => sum + rewardValueInGems(r), 0);
}

/**
 * Problems with a reward bundle. Empty means it is within every cap.
 *
 * Returns a LIST rather than a boolean so validation can report which cap an
 * event breached - an author who gets a rejection with no reason will simply
 * halve the number until it passes, which is how a deliberate reward becomes
 * an arbitrary one.
 */
export function validateRewards(rewards: readonly LiveReward[]): string[] {
  const problems: string[] = [];

  if (rewards.length === 0) {
    problems.push('no rewards - an event that pays nothing has no reason to exist');
    return problems;
  }

  const seen = new Set<LiveRewardKind>();
  for (const reward of rewards) {
    const cap = REWARD_CAPS[reward.kind];
    if (cap === undefined) {
      problems.push(`unknown reward kind '${reward.kind}'`);
      continue;
    }
    // Two entries of the same currency would each pass their own cap and sum to
    // twice it. Requiring one entry per currency makes the cap mean what it says.
    if (seen.has(reward.kind)) {
      problems.push(`duplicate reward kind '${reward.kind}'`);
    }
    seen.add(reward.kind);

    if (!Number.isFinite(reward.amount) || reward.amount <= 0) {
      problems.push(`reward '${reward.kind}' must be a positive finite amount`);
      continue;
    }
    if (!Number.isInteger(reward.amount)) {
      problems.push(`reward '${reward.kind}' must be a whole number`);
    }
    if (reward.amount > cap) {
      problems.push(`reward '${reward.kind}' (${reward.amount}) exceeds the cap of ${cap}`);
    }
  }

  const value = bundleValueInGems(rewards);
  if (value > MAX_EVENT_VALUE_GEMS) {
    problems.push(
      `total value ${Math.round(value)} gem-equivalents exceeds the per-event cap of ${MAX_EVENT_VALUE_GEMS}`,
    );
  }

  return problems;
}

// ── The rolling budget ──────────────────────────────────────────────────────

/** One recorded payout, for the rolling window. */
export interface BudgetEntry {
  /** Real epoch ms the claim was made. */
  at: number;
  /** Gem-equivalents paid. */
  value: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Entries still inside the rolling window at `nowMs`.
 *
 * An entry stamped in the FUTURE is kept, not dropped. A device clock moved
 * forward and then back leaves such entries behind, and dropping them would
 * refund the budget - turning a clock scrub into extra live-ops payouts, which
 * is the exact exploit shape the five clock-related `STATE_VERSION` bumps exist
 * to close. Keeping them is the conservative direction: at worst the player
 * waits, and waiting is not a loss of anything they earned.
 */
export function entriesInWindow(entries: readonly BudgetEntry[], nowMs: number): BudgetEntry[] {
  if (!Number.isFinite(nowMs)) return [...entries];
  return entries.filter((e) => Number.isFinite(e.at) && (e.at > nowMs || nowMs - e.at < WEEK_MS));
}

/** Gem-equivalents already paid inside the rolling window. */
export function spentInWindow(entries: readonly BudgetEntry[], nowMs: number): number {
  return entriesInWindow(entries, nowMs).reduce(
    (sum, e) => sum + (Number.isFinite(e.value) ? Math.max(0, e.value) : 0),
    0,
  );
}

/**
 * Whether a bundle fits the remaining budget.
 *
 * All-or-nothing: a bundle that does not fit is REFUSED, not scaled down.
 * Paying a fraction of an advertised reward is worse than paying none - the
 * player was told a number, and quietly delivering less is the kind of thing
 * that costs more trust than the gems are worth. A refusal is visible, and the
 * event stays claimable until the window clears.
 */
export function fitsBudget(
  rewards: readonly LiveReward[],
  entries: readonly BudgetEntry[],
  nowMs: number,
): boolean {
  return spentInWindow(entries, nowMs) + bundleValueInGems(rewards) <= WEEKLY_BUDGET_GEMS;
}
