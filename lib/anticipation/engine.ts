/**
 * The week-ahead engine — "what is coming?"
 *
 * WHY THIS EXISTS. The weekly tick already knows a degree finishes in six
 * weeks, a loan instalment lands next week, a baby is due in three and a
 * wedding is booked. None of it was visible until the week it fired, so every
 * one of those arrived as a surprise — including the ones that take money. A
 * player who can see a bill coming can plan for it; a player who cannot just
 * gets hit. Anticipation is the difference between a game that rewards
 * planning and one that only rewards tapping.
 *
 * WHAT IT DELIBERATELY IS NOT. It is not a notification system, it does not
 * schedule anything, and it introduces no new dates. Every entry is read back
 * out of a counter some existing subsystem already maintains, so this can never
 * disagree with what the tick will actually do — there is no second schedule to
 * drift.
 *
 * TIME. Every horizon is measured in `weeksLived` (absolute), never the cyclic
 * 1–4 `week` and never the device clock (CLAUDE.md §4.2). A wall-clock horizon
 * here would be both wrong across a restore and farmable.
 */
import { PREGNANCY_DURATION_WEEKS } from '@/lib/config/gameConstants';
import type { GameState, Relationship } from '@/contexts/game/types';

import type { UpcomingEvent } from './types';

/** How far ahead we look. Beyond this it stops being anticipation and starts
 *  being a spreadsheet. */
export const ANTICIPATION_HORIZON_WEEKS = 12;

const money = (n: number): string => `$${Math.round(Math.max(0, n)).toLocaleString()}`;

/** Collects education completions still in progress. */
function educationEvents(state: GameState, now: number): UpcomingEvent[] {
  return (state.educations ?? [])
    .filter((e) => e && !e.completed && !e.paused && (e.weeksRemaining ?? 0) > 0)
    .map((e) => {
      const weeksAway = Math.max(0, Math.round(e.weeksRemaining ?? 0));
      return {
        id: `education:${e.id}`,
        kind: 'education' as const,
        tone: 'good' as const,
        title: `${e.name} completes`,
        detail:
          weeksAway <= 1
            ? 'You graduate next week — new careers open up.'
            : `${weeksAway} weeks of study left.`,
        weeksAway,
        dueWeeksLived: now + weeksAway,
      };
    });
}

/** A birth, from the pregnancy counter the tick reads. */
function birthEvents(state: GameState, now: number): UpcomingEvent[] {
  const candidates: Relationship[] = [
    ...(state.family?.spouse ? [state.family.spouse] : []),
    ...(state.relationships ?? []),
  ];
  const seen = new Set<string>();
  const out: UpcomingEvent[] = [];
  for (const rel of candidates) {
    if (!rel || !rel.isPregnant || rel.pregnancyStartWeek == null) continue;
    if (seen.has(rel.id)) continue;
    seen.add(rel.id);
    const elapsed = now - rel.pregnancyStartWeek;
    const weeksAway = Math.max(0, PREGNANCY_DURATION_WEEKS - elapsed);
    out.push({
      id: `birth:${rel.id}`,
      kind: 'birth',
      tone: 'good',
      title: `${rel.name} is due`,
      detail:
        weeksAway <= 1
          ? 'The baby arrives next week. Hospital costs land with it.'
          : `About ${weeksAway} weeks to go.`,
      weeksAway,
      dueWeeksLived: now + weeksAway,
    });
  }
  return out;
}

/** The booked wedding, if there is one still ahead. */
function weddingEvents(state: GameState, now: number): UpcomingEvent[] {
  const plan = state.family?.spouse?.weddingPlanned
    ?? (state.relationships ?? []).find((r) => r?.weddingPlanned)?.weddingPlanned;
  if (!plan || typeof plan.scheduledWeek !== 'number') return [];
  const weeksAway = plan.scheduledWeek - now;
  if (weeksAway < 0) return [];
  return [
    {
      id: `wedding:${plan.partnerId || plan.venueId}`,
      kind: 'wedding',
      tone: 'good',
      title: 'Your wedding',
      detail:
        weeksAway <= 1
          ? `At ${plan.venueName} next week — ${money(plan.budget ?? 0)} is due.`
          : `Booked at ${plan.venueName} in ${weeksAway} weeks.`,
      weeksAway: Math.max(0, weeksAway),
      dueWeeksLived: plan.scheduledWeek,
    },
  ];
}

/**
 * Loans, reported as PAYOFF rather than as the next instalment.
 *
 * A weekly payment is not anticipation — it happens every week and would
 * crowd out everything else in the list within one tick. The date worth
 * seeing is the one the debt ENDS, because that is the one the player can act
 * to bring forward.
 */
function loanEvents(state: GameState, now: number): UpcomingEvent[] {
  return (state.loans ?? [])
    .filter((l) => l && (l.remaining ?? 0) > 0 && (l.weeksRemaining ?? 0) > 0)
    .map((l) => {
      const weeksAway = Math.max(0, Math.round(l.weeksRemaining));
      return {
        id: `loan:${l.id}`,
        kind: 'loan' as const,
        tone: 'neutral' as const,
        title: `${l.name} paid off`,
        detail: `${money(l.remaining)} left at ${money(l.weeklyPayment)}/week.`,
        weeksAway,
        dueWeeksLived: now + weeksAway,
      };
    });
}

/**
 * Arrears, which are the one entry here with no natural date.
 *
 * Reported at `weeksAway: 0` because arrears are always "now" — they grow
 * every week they are unpaid (v31) and there is no scheduled moment at which
 * they resolve themselves.
 */
function arrearsEvents(state: GameState, now: number): UpcomingEvent[] {
  const overdue = state.overdueBalance ?? 0;
  if (overdue <= 0) return [];
  return [
    {
      id: 'debt:arrears',
      kind: 'debt',
      tone: 'caution',
      title: 'Overdue bills',
      detail: `${money(overdue)} in arrears. This grows until it is paid.`,
      weeksAway: 0,
      dueWeeksLived: now,
    },
  ];
}

/**
 * An untreated fatal disease, reported as the deadline it actually is.
 *
 * This is the one genuinely alarming entry in the list, and it earns its place:
 * `weeksUntilDeath` is a real countdown the tick enforces, and a player who
 * only discovers it on the week it expires had no chance to treat it.
 */
function healthEvents(state: GameState, now: number): UpcomingEvent[] {
  return (state.diseases ?? [])
    .filter((d) => d && typeof d.weeksUntilDeath === 'number' && d.weeksUntilDeath > 0)
    .map((d) => {
      const weeksAway = Math.max(0, Math.round(d.weeksUntilDeath as number));
      return {
        id: `health:${d.id}`,
        kind: 'health' as const,
        tone: 'caution' as const,
        title: `${d.name} is untreated`,
        detail:
          weeksAway <= 2
            ? 'Get treatment now — this is close to fatal.'
            : `Fatal in about ${weeksAway} weeks without treatment.`,
        weeksAway,
        dueWeeksLived: now + weeksAway,
      };
    });
}

/**
 * Savings goals that carry a target week the player set themselves.
 *
 * These live on `banking`, not at the top level — the top-level lookup
 * type-errors, which is the useful kind of mistake to make.
 */
function savingsEvents(state: GameState, now: number): UpcomingEvent[] {
  return (state.banking?.savingsGoals ?? [])
    .filter(
      (g) =>
        g &&
        typeof g.targetWeek === 'number' &&
        g.targetWeek > now &&
        (g.currentAmount ?? 0) < (g.targetAmount ?? 0),
    )
    .map((g) => {
      const weeksAway = Math.max(0, (g.targetWeek as number) - now);
      const short = Math.max(0, (g.targetAmount ?? 0) - (g.currentAmount ?? 0));
      return {
        id: `savings:${g.id}`,
        kind: 'savings' as const,
        tone: 'neutral' as const,
        title: `${g.name} target`,
        detail: `${money(short)} to go in ${weeksAway} weeks.`,
        weeksAway,
        dueWeeksLived: g.targetWeek as number,
      };
    });
}

/**
 * A promotion the player is close to.
 *
 * Deliberately only reported from 60% progress. Below that the estimate is
 * long enough to be noise, and a "promotion in 14 weeks" line every single week
 * is exactly the repetitive spam the brief warns against.
 */
function careerEvents(state: GameState, now: number): UpcomingEvent[] {
  const career = (state.careers ?? []).find((c) => c?.id === state.currentJob);
  if (!career) return [];
  const progress = career.progress ?? 0;
  if (progress < 60 || progress >= 100) return [];
  const maxLevel = (career.levels?.length ?? 1) - 1;
  if (career.level >= maxLevel) return [];
  const nextTitle = career.levels?.[career.level + 1]?.name ?? 'the next level';
  return [
    {
      id: `career:${career.id}`,
      kind: 'career',
      tone: 'good',
      title: 'Promotion in reach',
      // No week estimate: promotion pace depends on performance, perks and
      // events, so a number here would be a guess presented as a schedule.
      detail: `${Math.round(progress)}% of the way to ${nextTitle}.`,
      weeksAway: 0,
      dueWeeksLived: now,
    },
  ];
}

/**
 * Everything the player can see coming, soonest first.
 *
 * Sorted by `weeksAway`, then by tone so a caution outranks a nicety landing
 * the same week, then by id so the order is fully deterministic — the list is
 * rendered every frame and must not reshuffle between renders.
 */
export function upcomingEvents(
  state: GameState | undefined | null,
  options?: { horizonWeeks?: number; limit?: number },
): UpcomingEvent[] {
  if (!state) return [];
  const now = state.weeksLived ?? 0;
  const horizon = options?.horizonWeeks ?? ANTICIPATION_HORIZON_WEEKS;

  let all: UpcomingEvent[] = [];
  // Each collector is guarded independently: one malformed record must not
  // empty the whole list. Same reasoning as the try/catch rule the weekly tick
  // enforces on its subsystems (CLAUDE.md §4.3).
  const collectors = [
    educationEvents,
    birthEvents,
    weddingEvents,
    loanEvents,
    arrearsEvents,
    healthEvents,
    savingsEvents,
    careerEvents,
  ];
  for (const collect of collectors) {
    try {
      all = all.concat(collect(state, now));
    } catch {
      // skip this source only
    }
  }

  const tonePriority = { caution: 0, good: 1, neutral: 2 } as const;
  const visible = all
    .filter((e) => e.weeksAway >= 0 && e.weeksAway <= horizon)
    .sort(
      (a, b) =>
        a.weeksAway - b.weeksAway ||
        tonePriority[a.tone] - tonePriority[b.tone] ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );

  return typeof options?.limit === 'number' ? visible.slice(0, options.limit) : visible;
}
