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
 * Salaries are deliberately below the top of the elected ladder (President is
 * $100k ANNUAL → ~$1.9k/wk; see `weeklyCareerSalary`) except for the private
 * posts, which pay well precisely because they cost reputation. Everything here
 * is bounded by `PER_SOURCE_CAPS.political` ($50K/wk) at payout, so no
 * combination of this and office income can outrun the economy.
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
    requirements: { minReputation: 65, education: ['law_degree'], barsElectedOffice: true },
    reputationOnTake: 10,
    partySupportPerWeek: -1,
  },
  {
    id: 'lobbyist',
    title: 'Lobbyist',
    blurb: 'Sell the address book. It pays better than any office you ever held.',
    weeklySalary: 9_000,
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
        law_degree: 'Law Degree',
        business_degree: 'Business Degree',
        political_science: 'Political Science Degree',
      };
      return `You need: ${missing.map((id) => NAMES[id] ?? id).join(', ')}.`;
    }
  }
  return null;
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
 * senator — the conflict of interest IS the mechanic.
 */
export function appointmentBarsOffice(appointmentId: string | undefined | null): boolean {
  return findAppointment(appointmentId)?.requirements.barsElectedOffice === true;
}
