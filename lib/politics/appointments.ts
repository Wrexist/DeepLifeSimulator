/**
 * Paid positions that are not the elected ladder.
 *
 * The political career was one line of six rungs: you climbed it, or you were
 * voted off it and had nothing. Everything a real political life is actually
 * made of — the appointment you take between offices, the job the party gives
 * you for staying loyal, the lobbying firm that hires you the week you stand
 * down — did not exist, so leaving office was a dead end rather than a move.
 *
 * Each appointment PAYS WEEKLY and has a price: reputation, party standing, or
 * an eligibility bar you can only clear by having held real office. One at a
 * time — these are jobs, not collectibles.
 *
 * Pure functions. No game state, no React.
 */

import { POLITICAL_CAREER } from '@/lib/careers/political';

const safe = (n: number | undefined | null, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface AppointmentRequirements {
  /** Minimum office rank ever held (1 = Council … 6 = President). */
  minOfficeHeld?: number;
  minReputation?: number;
  /** Must currently be a member of a party with a machine. */
  requiresParty?: boolean;
  /** Minimum standing inside that party. */
  minPartySupport?: number;
  /** Education ids that must all be completed. */
  education?: string[];
  /** True when the post cannot be combined with sitting in elected office. */
  barsElectedOffice?: boolean;
}

export interface AppointmentDefinition {
  id: string;
  title: string;
  blurb: string;
  /** Dollars per week. Paid through the ONE political income path. */
  weeklySalary: number;
  requirements: AppointmentRequirements;
  /** Reputation change on taking the post. */
  reputationOnTake: number;
  /** Party standing change per week while serving. */
  partySupportPerWeek: number;
}

/**
 * The catalog.
 *
 * Every post out-earns the office that unlocks it - the elected ladder is
 * ANNUAL, Council ~$15/wk up to President ~$1.9k/wk (see `weeklyCareerSalary`)
 * - which is what makes leaving office a move rather than a dead end. Three
 * rules keep an appointment from becoming the best job in the game;
 * `__tests__/politics/lobbyistBalance.test.ts` pins the first two against the
 * live catalogues:
 *
 *   1. No post out-earns the top rung of the best civilian career (CEO,
 *      $6,000/wk after an MBA and five promotions).
 *   2. Among the posts paid for in reputation (`reputationOnTake < 0`), a
 *      higher office gate never pays less - the board seat (rank 3) outranks
 *      the lobbyist (rank 2), not the other way round.
 *   3. A private post earns its premium over the reputation-positive post at
 *      the same rank (~1.7x: board seat over cabinet secretary, lobbyist over
 *      ambassador) because it costs reputation the public one would have paid.
 *
 * Pay is taxed (it lands in the weekly income the progressive tax reads) and
 * bounded by `PER_SOURCE_CAPS.political` ($50K/wk) at payout.
 */
export const POLITICAL_APPOINTMENTS: readonly AppointmentDefinition[] = [
  {
    id: 'party_chair',
    title: 'Party Chair',
    blurb: 'Run the machine you have been feeding. Pays modestly; keeps the party close.',
    weeklySalary: 1_200,
    requirements: { requiresParty: true, minPartySupport: 70, minOfficeHeld: 1 },
    reputationOnTake: 2,
    partySupportPerWeek: 1,
  },
  {
    id: 'ambassador',
    title: 'Ambassador',
    blurb: 'A posting abroad. Respectable, well paid, and a long way from the voters.',
    weeklySalary: 2_400,
    requirements: { minOfficeHeld: 2, minReputation: 60 },
    reputationOnTake: 5,
    partySupportPerWeek: 0,
  },
  {
    id: 'cabinet_secretary',
    title: 'Cabinet Secretary',
    blurb: 'A department of your own, and the standing that comes with it.',
    weeklySalary: 3_200,
    requirements: { minOfficeHeld: 3, minReputation: 70, requiresParty: true, minPartySupport: 55 },
    reputationOnTake: 8,
    partySupportPerWeek: 1,
  },
  {
    id: 'federal_judge',
    title: 'Federal Judge',
    blurb: 'A lifetime appointment. You cannot hold it and run for office at the same time.',
    weeklySalary: 2_800,
    // `law_school` is the law programme's id in lib/education/programs.ts.
    // This shipped as `law_degree` — an id in NO catalogue — so the one
    // appointment paying $2,800/wk was permanently unobtainable: a player who
    // completed Law School still saw "You need: Law Degree". The same
    // law_degree-vs-law_school confusion as the jail Legal Appeal bug (R3-C4).
    requirements: { minReputation: 65, education: ['law_school'], barsElectedOffice: true },
    reputationOnTake: 10,
    partySupportPerWeek: -1,
  },
  {
    id: 'lobbyist',
    title: 'Lobbyist',
    blurb: 'Sell the address book. It pays better than any office you ever held.',
    // Was $9,000/wk (2026-10-17 owner call): 4.7x the President's salary, 1.5x
    // the CEO rung, 3.75x the Ambassador at the SAME rank-2 gate, and 1.6x the
    // board seat that needs a higher office - permanent, stackable with any
    // civilian job, and reachable about two years into a political life (one
    // Council term, one Mayoral term). Its price - 15 reputation, handed back
    // on resigning, and party standing nobody outside a party has - never
    // grows with time served. $4,000 keeps it the best-paid post a former
    // Mayor can take (1.67x the Ambassador - the board seat's 1.72x premium
    // over the cabinet secretary) while leaving the board seat and every top
    // career rung above it.
    weeklySalary: 4_000,
    requirements: { minOfficeHeld: 2, barsElectedOffice: true },
    reputationOnTake: -15,
    partySupportPerWeek: -2,
  },
  {
    id: 'board_seat',
    title: 'Corporate Board Seat',
    blurb: 'A seat at a table you once regulated. Nobody calls it a bribe.',
    weeklySalary: 5_500,
    requirements: { minOfficeHeld: 3, minReputation: 40, barsElectedOffice: true },
    reputationOnTake: -8,
    partySupportPerWeek: 0,
  },
];

export function findAppointment(id: string | undefined | null): AppointmentDefinition | undefined {
  return POLITICAL_APPOINTMENTS.find((a) => a.id === id);
}

export interface AppointmentEligibilityInput {
  /** Highest office rank ever held, 1-based (0 = never elected). */
  highestOfficeHeld?: number | null;
  /** Currently sitting in elected office? */
  inOffice?: boolean;
  reputation?: number | null;
  party?: string | null;
  partySupport?: number | null;
  hasEducation?: (id: string) => boolean;
  /**
   * The post currently held, if any. Taking a new one hands the old one's
   * reputation back first, so the step the player actually takes is
   * `reputationStepOnTake(next, held)` - read here so the floor below is
   * measured against that step, not the new post's nominal figure.
   */
  heldAppointmentId?: string | null;
  /**
   * The life has retired from work (`GameState.isRetired`). Retirement is a
   * one-way latch - an appointment is a salaried post, so it is refused like
   * every other job.
   */
  retired?: boolean;
}

/** The refusal shown when a retired life tries to take paid work again. */
export const RETIRED_FROM_WORK_MESSAGE =
  "You've retired - enjoy your pension. There's no going back to work.";

/**
 * The reputation change taking `appointment` applies right now.
 *
 * Reputation from a post lasts only while it is held: a swap returns the old
 * post's figure before applying the new one's, and resigning returns it too.
 * One formula, read by the eligibility check and by the resolver that applies
 * it, so the two cannot disagree about what a take costs.
 */
export function reputationStepOnTake(
  appointment: AppointmentDefinition | undefined,
  heldAppointmentId?: string | null,
): number {
  if (!appointment) return 0;
  const held = findAppointment(heldAppointmentId);
  return safe(appointment.reputationOnTake, 0) - safe(held?.reputationOnTake, 0);
}

/**
 * Why this appointment is refused, or `null` when it can be taken.
 *
 * Returns the REASON rather than a boolean, so the UI can tell a player what to
 * go and do instead of greying a row out with no explanation — the same shape
 * as `politicalPromotionBlocker`.
 */
export function appointmentBlocker(
  appointment: AppointmentDefinition | undefined,
  input: AppointmentEligibilityInput,
): string | null {
  if (!appointment) return 'Unknown appointment.';
  if (input.retired) return RETIRED_FROM_WORK_MESSAGE;
  const req = appointment.requirements;
  const held = Math.max(0, Math.floor(safe(input.highestOfficeHeld, 0)));
  const reputation = safe(input.reputation, 0);

  if (req.barsElectedOffice && input.inOffice) {
    return 'You must leave elected office before taking this position.';
  }
  if (typeof req.minOfficeHeld === 'number' && held < req.minOfficeHeld) {
    const name = POLITICAL_CAREER.levels[req.minOfficeHeld - 1]?.name ?? 'higher office';
    return `You need to have served as ${name} or above.`;
  }
  if (typeof req.minReputation === 'number' && reputation < req.minReputation) {
    return `This position needs ${req.minReputation} reputation. You have ${Math.floor(reputation)}.`;
  }
  // A post paid for in reputation needs the reputation to pay with. The step is
  // handed back in full on resigning, so a take that hit the 0 floor charged
  // LESS than it later refunded: at 0 reputation, Lobbyist-then-resign minted
  // +15 in two taps. Refusing a step the player cannot cover keeps
  // take-then-resign at exactly zero.
  const step = reputationStepOnTake(appointment, input.heldAppointmentId);
  if (step < 0 && reputation + step < 0) {
    return `Taking this position costs ${-step} reputation. You have ${Math.floor(reputation)}.`;
  }
  if (req.requiresParty && !input.party) {
    return 'You must belong to a party to be offered this position.';
  }
  if (typeof req.minPartySupport === 'number' && safe(input.partySupport, 0) < req.minPartySupport) {
    return `The party wants ${req.minPartySupport} standing before offering this. You have ${Math.floor(safe(input.partySupport, 0))}.`;
  }
  if (req.education && req.education.length > 0) {
    const has = input.hasEducation ?? (() => false);
    const missing = req.education.filter((id) => !has(id));
    if (missing.length > 0) {
      const NAMES: Record<string, string> = {
        law_school: 'Law School',
        business_degree: 'Business Degree',
        mba: 'MBA',
      };
      return `You need: ${missing.map((id) => NAMES[id] ?? id).join(', ')}.`;
    }
  }
  return null;
}

/**
 * What a post costs or gives besides its salary, in one line for its card -
 * `null` when it has no such effect.
 *
 * The private posts' whole premise is "pays well because it costs reputation",
 * and the offer card showed the pay and never the price. Built from the same
 * fields `resolveTakeAppointment` and the weekly tick apply, so the line cannot
 * quote a number the game does not charge. The party term is only stated for a
 * member of a party with a machine - the tick moves nobody else's standing.
 */
export function appointmentPriceSummary(
  appointment: AppointmentDefinition | undefined,
  opts: { partyMachine?: boolean } = {},
): string | null {
  if (!appointment) return null;
  const parts: string[] = [];
  const rep = Math.round(safe(appointment.reputationOnTake, 0));
  if (rep !== 0) parts.push(`Reputation ${rep > 0 ? '+' : ''}${rep} while you hold it`);
  const party = Math.round(safe(appointment.partySupportPerWeek, 0));
  if (opts.partyMachine && party !== 0) parts.push(`party standing ${party > 0 ? '+' : ''}${party}/wk`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Weekly pay from the appointment currently held.
 *
 * Zero for an unknown id, so a save carrying an appointment removed from a
 * later build simply stops paying rather than crashing the week loop.
 */
export function appointmentWeeklySalary(appointmentId: string | undefined | null): number {
  const def = findAppointment(appointmentId);
  if (!def) return 0;
  const salary = def.weeklySalary;
  return typeof salary === 'number' && isFinite(salary) && salary > 0 ? Math.round(salary) : 0;
}

/**
 * Does holding this appointment forbid sitting in elected office?
 *
 * Read at the point a player runs for office, so a lobbyist cannot also be a
 * senator - the conflict of interest IS the mechanic.
 */
export function appointmentBarsOffice(appointmentId: string | undefined | null): boolean {
  return findAppointment(appointmentId)?.requirements.barsElectedOffice === true;
}
