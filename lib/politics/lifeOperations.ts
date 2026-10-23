/**
 * Pure resolvers for the Political Life actions.
 *
 * Every one has the shape the C-9 / ARCH-1 ratchet
 * (`__tests__/refactor/updaterResultRatchet.test.ts`) calls the SOUND fix, and
 * that CLAUDE.md §4.1 has always prescribed:
 *
 *     const preview = resolveX(state, args);        // the outcome, for the UI
 *     setGameState(prev => resolveX(prev, args).next);  // the state
 *     return { success: preview.ok, message: preview.message };
 *
 * The alternative — reject with `return prev` inside the updater and report
 * `{ success: true }` outside it — tells the player they did something they did
 * not. The other alternative, capturing a `let applied` flag across the
 * updater, is measurably worse: React runs the FIRST functional update of a
 * batch eagerly and DEFERS the rest, so the capture reads for one dispatch and
 * not the next (`updaterTimingContract.test.tsx`; it once made a successful
 * refuel report failure).
 *
 * Because the outcome and the state come from ONE function of ONE input, they
 * cannot disagree, and a same-batch double tap simply resolves twice against
 * two different `prev` values — which is exactly right: the second one sees the
 * first one's marker and refuses.
 *
 * `next` is the SAME REFERENCE as the input when the action is refused, so a
 * refusal cannot accidentally churn state or defeat a memo.
 */

import type { GameState, PoliticsState } from '@/contexts/game/types';
import { applyMoneyDelta } from '@/lib/economy/moneyDelta';
import { formatMoney } from '@/utils/moneyFormatting';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { findParty, switchParty, type PartyId } from './parties';
import { appointmentBlocker, findAppointment, reputationStepOnTake } from './appointments';
import { planSkim, readEmbezzlement } from './embezzlement';
import { buildRetirement, mergeRetirement, retirementBlocker } from './retirement';
import { applyOfficeExit } from './operations';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

/** What every resolver returns. */
export interface PoliticalOutcome {
  ok: boolean;
  message: string;
  /** The resulting state — the SAME reference as the input when refused. */
  next: GameState;
}

/** A finite number, or `fallback` - a stored field can hold anything. */
const safe = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const refuse = (state: GameState, message: string): PoliticalOutcome =>
  ({ ok: false, message, next: state });

/**
 * The politics slice a player who has never touched politics has.
 *
 * One definition, so a field added to `PoliticsState` has one place to be
 * defaulted rather than a dozen inline literals to be forgotten.
 */
export const emptyPolitics = (): PoliticsState => ({
  careerLevel: 0,
  approvalRating: 50,
  policyInfluence: 0,
  electionsWon: 0,
  policiesEnacted: [],
  lobbyists: [],
  alliances: [],
  campaignFunds: 0,
});

/**
 * Highest office rank (1-based) the player has ever reached this life.
 *
 * `politics.peakOfficeLevel` (v58) is the stored record. The derivation below
 * is kept beside it because a save written before v58 has no record, and
 * because `peakOfficeLevel` is only stamped when an office is TAKEN: it is the
 * max of the two, so absence reads exactly as it always did.
 */
export function highestOfficeHeld(state: GameState): number {
  const peak = Math.max(0, Math.floor(safe(state?.politics?.peakOfficeLevel, 0)));
  const sitting = Math.max(0, Math.floor(state?.politics?.careerLevel ?? 0));
  const retired = Math.max(0, Math.floor(state?.politics?.retirement?.officeLevel ?? 0));
  // A career entry survives being voted out, which `politics.careerLevel` does
  // not — so a former Governor still qualifies for an ambassadorship.
  const career = state?.careers?.find((c) => c && c.id === 'political');
  const everElected = career?.accepted || (state?.politics?.electionsWon ?? 0) > 0
    ? Math.max(0, Math.floor(career?.level ?? 0)) + 1
    : 0;
  return Math.max(peak, sitting, retired, everElected);
}

/**
 * The `peakOfficeLevel` to stamp when the player takes office at `rank`
 * (1-based), read from the state BEFORE the office is written (S2).
 *
 * Folding in `highestOfficeHeld(prev)` is what makes this safe on an earlier
 * save: the derivation still sees the old `careers.political.level` at this
 * point, so a former Governor winning a Council seat records 4, not 1, on the
 * very win that overwrites the career level.
 */
export function nextPeakOfficeLevel(prev: GameState, rank: number): number {
  return Math.max(highestOfficeHeld(prev), Math.max(0, Math.floor(safe(rank, 0))));
}

/** Weeks served in the CURRENT political office. */
export function weeksInCurrentOffice(state: GameState): number {
  const career = state?.careers?.find((c) => c && c.id === 'political');
  if (typeof career?.startedWeeksLived === 'number') {
    return Math.max(0, (state?.weeksLived ?? 0) - career.startedWeeksLived);
  }
  return career?.progress ?? 0;
}

// ---------------------------------------------------------------------------
// Party
// ---------------------------------------------------------------------------

export function resolveJoinParty(state: GameState, target: PartyId): PoliticalOutcome {
  const politics = state.politics ?? emptyPolitics();
  const name = findParty(target)?.name ?? target;

  if (politics.party === target) {
    return refuse(state, `You are already registered with the ${name} Party.`);
  }

  const applied = switchParty({
    currentParty: politics.party,
    currentSupport: politics.partySupport,
    switches: politics.partySwitches,
    target,
  });

  const next: GameState = {
    ...state,
    politics: {
      ...politics,
      party: applied.party,
      partySupport: applied.support,
      partySwitches: applied.switches,
      approvalRating: Math.max(0, Math.min(100, (politics.approvalRating ?? 50) + applied.approvalDelta)),
    },
  };

  const message = politics.party
    ? `You crossed the floor to the ${name} Party. Approval ${applied.approvalDelta}, `
      + `and you start at ${applied.support} standing with your new colleagues.`
    : `You joined the ${name} Party. Approval +${applied.approvalDelta}.`;

  return { ok: true, message, next };
}

// ---------------------------------------------------------------------------
// Alliances
// ---------------------------------------------------------------------------

/**
 * Form a political alliance with a character. One alliance per character -
 * resolving against an already-allied state refuses, which is what makes the
 * commit safe on a same-batch double tap. The id is deterministic
 * (characterId + week) rather than `Date.now()`: uniqueness is guaranteed by
 * the one-per-character rule, and a wall-clock id minted OUTSIDE an updater
 * once stamped the same id onto both entries of a double tap.
 */
export function resolveFormAlliance(
  state: GameState,
  characterId: string,
  characterName: string,
): PoliticalOutcome {
  const politics = state.politics ?? emptyPolitics();
  if ((politics.alliances || []).some((a) => a && a.characterId === characterId)) {
    return refuse(state, 'You already have an alliance with this character');
  }

  const next: GameState = {
    ...state,
    politics: {
      ...politics,
      alliances: [
        ...(politics.alliances || []),
        {
          id: `alliance_${characterId}_${state.weeksLived ?? 0}`,
          characterId,
          name: characterName,
          influence: 10,
          formedWeek: state.weeksLived || 0,
        },
      ],
      approvalRating: Math.min(100, (politics.approvalRating ?? 50) + 3),
    },
  };

  return { ok: true, message: `Formed political alliance with ${characterName}!`, next };
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

export function resolveTakeAppointment(state: GameState, appointmentId: string): PoliticalOutcome {
  const def = findAppointment(appointmentId);
  if (!def) return refuse(state, 'Unknown appointment.');

  const politics = state.politics ?? emptyPolitics();
  if (politics.appointment?.id === appointmentId) {
    return refuse(state, `You already serve as ${def.title}.`);
  }

  const blocker = appointmentBlocker(def, {
    highestOfficeHeld: highestOfficeHeld(state),
    inOffice: (politics.careerLevel ?? 0) > 0,
    reputation: state.stats?.reputation,
    party: politics.party,
    partySupport: politics.partySupport,
    hasEducation: (id: string) => (state.educations || []).some((e) => e && e.id === id && e.completed),
    // The blocker refuses a reputation step the player cannot cover, and that
    // step depends on the post being handed back (see `reputationStepOnTake`).
    heldAppointmentId: politics.appointment?.id,
    retired: !!state.isRetired,
  });
  if (blocker) return refuse(state, blocker);

  const previous = findAppointment(politics.appointment?.id);
  // Reputation from a post lasts only while you hold it: swapping posts gives
  // the old one's bump back before granting the new one's, and resigning
  // (below) gives it back too. Without the give-back, alternating two posts
  // was a free +5/+8 reputation per tap with no cooldown - six taps took a
  // Governor from 70 to the 100 clamp, and reputation feeds the election roll
  // and its up-to-$5M rewards. The blocker above refuses a negative step that
  // would hit the 0 floor, so what is charged here is what resigning returns.
  const repDelta = reputationStepOnTake(def, politics.appointment?.id);
  const next: GameState = {
    ...state,
    stats: {
      ...state.stats,
      reputation: Math.max(0, Math.min(100, (state.stats?.reputation ?? 0) + repDelta)),
    },
    politics: {
      ...politics,
      appointment: { id: appointmentId, startedWeek: state.weeksLived ?? 0 },
    },
  };

  const repNote = repDelta >= 0
    ? `Reputation +${repDelta}.`
    : `Reputation ${repDelta} - people notice.`;
  const replaced = previous ? ` You stepped down as ${previous.title} to take it.` : '';

  return {
    ok: true,
    message: `You were appointed ${def.title}. ${formatMoney(def.weeklySalary)}/wk. ${repNote}${replaced}`,
    next,
  };
}

export function resolveResignAppointment(state: GameState): PoliticalOutcome {
  const politics = state.politics;
  const def = findAppointment(politics?.appointment?.id);
  if (!politics || !def) return refuse(state, 'You do not hold an appointed position.');

  // The post's reputation goes with the post (see resolveTakeAppointment) -
  // otherwise resign-and-retake mints the take bonus forever.
  const repDelta = -def.reputationOnTake;
  const repNote = repDelta === 0 ? '' : repDelta > 0
    ? ` Reputation +${repDelta}.`
    : ` Reputation ${repDelta}.`;
  return {
    ok: true,
    message: `You stepped down as ${def.title}.${repNote}`,
    next: {
      ...state,
      stats: {
        ...state.stats,
        reputation: Math.max(0, Math.min(100, (state.stats?.reputation ?? 0) + repDelta)),
      },
      politics: { ...politics, appointment: undefined },
    },
  };
}

// ---------------------------------------------------------------------------
// Embezzlement
// ---------------------------------------------------------------------------

export function resolveEmbezzle(state: GameState, amount: number): PoliticalOutcome {
  const politics = state.politics;
  if (!politics) return refuse(state, 'You have no campaign to take money from.');

  const plan = planSkim({
    state: readEmbezzlement(politics.embezzlement),
    campaignFunds: politics.campaignFunds,
    pacCleanUSD: politics.pac?.cleanUSD,
    requested: amount,
    weeksLived: state.weeksLived ?? 0,
    careerLevel: politics.careerLevel,
  });
  if (!plan.ok) return refuse(state, plan.reason);

  // The credit is folded into the SAME object as the debit, so the two cannot
  // be separated by a re-render (§4.4).
  const credit = applyMoneyDelta(state, plan.amount, 'Diverted campaign funds');
  if (!credit) return refuse(state, 'That transfer could not be completed.');

  const next: GameState = {
    ...state,
    ...credit,
    politics: {
      ...politics,
      campaignFunds: Math.max(0, Math.round((politics.campaignFunds ?? 0) - plan.fromCampaign)),
      pac: politics.pac
        ? { ...politics.pac, cleanUSD: Math.max(0, Math.round(politics.pac.cleanUSD - plan.fromPAC)) }
        : politics.pac,
      embezzlement: plan.next,
    },
  };

  return {
    ok: true,
    message:
      `${formatMoney(plan.amount)} moved into your accounts. `
      + `Exposure is now ${plan.next.heat}% - auditors are not stupid.`,
    next,
  };
}

// ---------------------------------------------------------------------------
// Retirement
// ---------------------------------------------------------------------------

export function resolveRetirement(state: GameState): PoliticalOutcome {
  const politics = state.politics;
  const weeks = weeksInCurrentOffice(state);

  const blocker = retirementBlocker({
    careerLevel: politics?.careerLevel,
    termsServed: politics?.electionsWon,
    weeksInOffice: weeks,
  });
  if (blocker || !politics) return refuse(state, blocker ?? 'You are not currently holding office.');

  // Built BEFORE careerLevel is zeroed, so the title is captured while it is
  // still true - the v42 `CareerHistoryEntry.title` reasoning. Retiring resets
  // the career the same way the voted-out path does, so a title derived
  // afterwards would name whatever rank 0 is called.
  //
  // A second retirement (retire as President, win a Council seat, retire again)
  // MERGES into the first record rather than replacing it: the pension was only
  // suspended while back in office (`getPoliticalPensionWeekly`), and a Council
  // record built from the current rank would quietly cut it to Council's rate
  // and rename the President a Council Member.
  const thisOffice = buildRetirement({
    careerLevel: politics.careerLevel,
    termsServed: politics.electionsWon,
    approvalRating: politics.approvalRating,
    weeksLived: state.weeksLived ?? 0,
  });
  const record = mergeRetirement(politics.retirement, thisOffice);

  const next: GameState = {
    ...state,
    // `level` is KEPT at its peak, exactly as the voted-out exit keeps it: it is
    // the record `runForOffice` reads to waive the tenure gate for a rung already
    // served (`servedPreviousLevel`). Zeroing it made the voluntary, rewarded
    // exit strictly worse than being voted out - a retired Senator could only
    // run for Council again. `accepted: false` + `politics.careerLevel: 0` +
    // the cleared `currentJob` are what stop the salary and the in-office UI.
    careers: (state.careers ?? []).map((c) =>
      c && c.id === 'political' ? { ...c, accepted: false, applied: false } : c
    ),
    currentJob: state.currentJob === 'political' ? undefined : state.currentJob,
    // Retirement is the THIRD office-exit path. The other two (voted-out in
    // weeklyTick, scandal forced-resignation in GameActionsContext) run
    // `applyOfficeExit` to settle what belonged to the office; this one did
    // not, so a player who retired while a scandal was live left it frozen
    // `active: true` forever (the tick early-returns to `tickOutOfOffice` once
    // careerLevel is 0 and never processes it again) and kept every hired
    // lobbyist active - the exact BBQ report class `applyOfficeExit` was
    // written to fix. It is idempotent (voted-out already ran it), so wiring it
    // here is safe.
    politics: applyOfficeExit({
      ...politics,
      careerLevel: 0,
      nextElectionWeek: undefined,
      retirement: record,
    }),
  };

  const years = Math.round(weeks / WEEKS_PER_YEAR);
  return {
    ok: true,
    message:
      `You stood down as ${thisOffice.title} after ${years} year${years === 1 ? '' : 's'} `
      + `and ${record.termsServed} election win${record.termsServed === 1 ? '' : 's'}. `
      + `Pension: ${formatMoney(record.weeklyPension)}/wk for life.`,
    next,
  };
}

/** Offices on the ladder, for a UI that wants to name the rung a rank maps to. */
export const POLITICAL_LADDER_TITLES = POLITICAL_CAREER.levels.map((l) => l.name);
