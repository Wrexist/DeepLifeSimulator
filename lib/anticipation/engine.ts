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
import { weeksUntilBoardRefresh } from '@/lib/careers/jobMarket';
import { mailEvents } from '@/lib/events/routing';
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
            ? 'You graduate next week - new careers open up.'
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
          ? `At ${plan.venueName} next week - ${money(plan.budget ?? 0)} is due.`
          : `Booked at ${plan.venueName} in ${weeksAway} weeks.`,
      weeksAway: Math.max(0, weeksAway),
      dueWeeksLived: plan.scheduledWeek,
    },
  ];
}

/**
 * Loans, reported as PAYOFF rather than as the next instalment.
 *
 * A weekly payment is not anticipation - it happens every week and would
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
 * Reported at `weeksAway: 0` because arrears are always "now" - they grow
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
            ? 'Get treatment now - this is close to fatal.'
            : `Fatal in about ${weeksAway} weeks without treatment.`,
        weeksAway,
        dueWeeksLived: now + weeksAway,
      };
    });
}

/**
 * Savings goals that carry a target week the player set themselves.
 *
 * These live on `banking`, not at the top level - the top-level lookup
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
 * The next election, for a player whose seat (or campaign) is on the ballot.
 *
 * `politics.nextElectionWeek` is a real date the politics tick enforces, with
 * up to $5M of office rewards riding on it - and it landed as a surprise. The
 * campaign verbs exist precisely to be used in the weeks BEFORE this.
 */
function electionEvents(state: GameState, now: number): UpcomingEvent[] {
  const politics = state.politics;
  const next = politics?.nextElectionWeek;
  if (!politics || (politics.careerLevel ?? 0) <= 0) return [];
  if (typeof next !== 'number' || !Number.isFinite(next)) return [];
  const weeksAway = next - now;
  if (weeksAway < 0) return [];
  const approval =
    typeof politics.approvalRating === 'number' && Number.isFinite(politics.approvalRating)
      ? Math.round(politics.approvalRating)
      : null;
  return [
    {
      id: 'election:next',
      kind: 'election',
      // Below ~45% approval the incumbent is genuinely in trouble - that is
      // worth a caution; otherwise it is a date to plan around, not a threat.
      tone: approval !== null && approval < 45 ? 'caution' : 'neutral',
      title: 'Election day',
      detail:
        approval !== null
          ? weeksAway <= 1
            ? `Voters decide next week - approval sits at ${approval}%.`
            : `Approval sits at ${approval}%. Campaigning still moves it.`
          : 'Your seat is on the ballot.',
      weeksAway: Math.max(0, weeksAway),
      dueWeeksLived: next,
    },
  ];
}

/**
 * Unanswered letters, reported as the deadlines they actually are.
 *
 * A mail-routed event lapses to its default choice when its `expiresAtWeek`
 * passes (`applyMailLapse`) - a real tick-enforced deadline that could take
 * money without the player ever knowing a clock was running.
 */
function letterEvents(state: GameState, now: number): UpcomingEvent[] {
  return mailEvents(state)
    .filter((e) => typeof e.expiresAtWeek === 'number' && (e.expiresAtWeek as number) >= now)
    .map((e) => {
      const dueWeek = e.expiresAtWeek as number;
      const weeksAway = Math.max(0, dueWeek - now);
      return {
        id: `letter:${e.id}`,
        kind: 'letter' as const,
        tone: 'caution' as const,
        title: 'A letter needs an answer',
        detail:
          weeksAway <= 1
            ? 'Last week to reply - it answers itself if you do not.'
            : `Unanswered mail lapses to its default in ${weeksAway} weeks.`,
        weeksAway,
        dueWeeksLived: dueWeek,
      };
    });
}

/**
 * Everything the player can see coming, soonest first.
 *
 * Sorted by `weeksAway`, then by tone so a caution outranks a nicety landing
 * the same week, then by id so the order is fully deterministic - the list is
 * rendered every frame and must not reshuffle between renders.
 */
/**
 * The job board turns over every `BOARD_ROTATION_WEEKS` weeks with a fresh
 * set of openings - the one recurring mid-game decision (stay, or take a
 * different ladder) that nothing on Home announced. Measured on the persona
 * simulator (Program 9): after week 15 the only regular signals a working
 * life saw were a promotion every 13-25 weeks and an event every 9. The
 * turnover is already scheduled by `jobMarket`; this only shows it the week
 * before, the way every other row here works.
 */
function jobBoardEvents(state: GameState, now: number): UpcomingEvent[] {
  const weeks = weeksUntilBoardRefresh(state);
  if (weeks !== 1) return [];
  return [
    {
      id: 'jobs:board',
      kind: 'jobs',
      tone: 'neutral',
      title: 'New openings next week',
      detail: 'The job board turns over - worth a look at what else is hiring.',
      weeksAway: 1,
      dueWeeksLived: now + 1,
    },
  ];
}

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
    electionEvents,
    letterEvents,
    jobBoardEvents,
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
