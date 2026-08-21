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
import { appointmentBlocker, findAppointment } from './appointments';
import { planSkim, readEmbezzlement } from './embezzlement';
import { buildRetirement, retirementBlocker } from './retirement';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

/** What every resolver returns. */
export interface PoliticalOutcome {
  ok: boolean;
  message: string;
  /** The resulting state — the SAME reference as the input when refused. */
  next: GameState;
}

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

/** Highest office rank (1-based) the player has ever reached. */
export function highestOfficeHeld(state: GameState): number {
  const sitting = Math.max(0, Math.floor(state?.politics?.careerLevel ?? 0));
  const retired = Math.max(0, Math.floor(state?.politics?.retirement?.officeLevel ?? 0));
  // A career entry survives being voted out, which `politics.careerLevel` does
  // not — so a former Governor still qualifies for an ambassadorship.
  const career = state?.careers?.find((c) => c && c.id === 'political');
  const everElected = career?.accepted || (state?.politics?.electionsWon ?? 0) > 0
    ? Math.max(0, Math.floor(career?.level ?? 0)) + 1
    : 0;
  return Math.max(sitting, retired, everElected);
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
  });
  if (blocker) return refuse(state, blocker);

  const previous = findAppointment(politics.appointment?.id);
  const next: GameState = {
    ...state,
    stats: {
      ...state.stats,
      reputation: Math.max(0, Math.min(100, (state.stats?.reputation ?? 0) + def.reputationOnTake)),
    },
    politics: {
      ...politics,
      appointment: { id: appointmentId, startedWeek: state.weeksLived ?? 0 },
    },
  };

  const repNote = def.reputationOnTake >= 0
    ? `Reputation +${def.reputationOnTake}.`
    : `Reputation ${def.reputationOnTake} — people notice.`;
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

  return {
    ok: true,
    message: `You stepped down as ${def.title}.`,
    next: { ...state, politics: { ...politics, appointment: undefined } },
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
      + `Exposure is now ${plan.next.heat}% — auditors are not stupid.`,
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
  // still true — the v42 `CareerHistoryEntry.title` reasoning. Retiring resets
  // the career the same way the voted-out path does, so a title derived
  // afterwards would name whatever rank 0 is called.
  const record = buildRetirement({
    careerLevel: politics.careerLevel,
    termsServed: politics.electionsWon,
    approvalRating: politics.approvalRating,
    weeksLived: state.weeksLived ?? 0,
  });

  const next: GameState = {
    ...state,
    careers: (state.careers ?? []).map((c) =>
      c && c.id === 'political' ? { ...c, accepted: false, applied: false, level: 0 } : c
    ),
    currentJob: state.currentJob === 'political' ? undefined : state.currentJob,
    politics: {
      ...politics,
      careerLevel: 0,
      nextElectionWeek: undefined,
      retirement: record,
    },
  };

  const years = Math.round(weeks / WEEKS_PER_YEAR);
  return {
    ok: true,
    message:
      `You stood down as ${record.title} after ${years} year${years === 1 ? '' : 's'} `
      + `and ${record.termsServed} election win${record.termsServed === 1 ? '' : 's'}. `
      + `Pension: ${formatMoney(record.weeklyPension)}/wk for life.`,
    next,
  };
}

/** Offices on the ladder, for a UI that wants to name the rung a rank maps to. */
export const POLITICAL_LADDER_TITLES = POLITICAL_CAREER.levels.map((l) => l.name);
