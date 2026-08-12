/**
 * Lobbyist System
 *
 * Lobbyists that can be hired to increase policy influence.
 *
 * `PolicyType` is IMPORTED, not redeclared. This file used to own a second
 * five-member `PolicyType` (`economic | social | environmental | criminal |
 * all`) while `policies.ts` shipped eleven — and that divergence is the whole
 * reason lobbyist targeting was never wired up. Seven of the eleven policy
 * types (`stock`, `realestate`, `education`, `crypto`, `technology`,
 * `healthcare`, `transportation`) could not even be NAMED as a specialty here,
 * so `calculateTotalLobbyistInfluence` could never have discounted them and sat
 * with zero call sites while the UI advertised the distinction in three places.
 * Two declarations of one concept is the bug; one declaration is the fix.
 */
import type { PolicyType } from './policies';

export type { PolicyType };

/** A policy type, or the `'all'` wildcard a generalist lobbyist carries. */
export type LobbyistSpecialty = PolicyType | 'all';

export interface Lobbyist {
  id: string;
  name: string;
  cost: number; // One-time cost to hire
  influence: number; // Policy influence bonus (0-100)
  /**
   * Policy types this lobbyist moves the needle on, or `['all']` for a
   * generalist.
   *
   * A LIST rather than the single `specialty` it replaced, because the
   * catalogue's own descriptions already promised multi-type coverage the
   * singular field could not express — the Union Representative is "Great for
   * social and economic policies", the Healthcare Lobbyist "Excellent for
   * social and health-related policies", the Tech Lobbyist "Great for economic
   * and innovation policies". Those strings shipped years before this field
   * could represent them.
   */
  specialties: readonly LobbyistSpecialty[];
  description: string;
}

/**
 * The catalogue. Every `specialties` list below is taken from that lobbyist's
 * OWN existing name and description — none of the coverage is invented. The
 * three multi-type entries were already promising it in prose (see the field
 * doc on `Lobbyist.specialties`); they were pinned to a single type only
 * because the old five-member `PolicyType` had nowhere else to put them.
 *
 * `realestate` and `transportation` had no plausible owner in the original
 * fifteen, so they get two new entries rather than being quietly folded into a
 * neighbour — a policy type whose only discount comes from a $50k generalist is
 * the same dead end this change exists to remove.
 *
 * INVARIANT: every member of `PolicyType` is covered by at least one entry.
 * `lobbyistSpecialty.test.ts` enforces it, which is what stops the catalogue and
 * the policy list drifting apart again.
 */
export const AVAILABLE_LOBBYISTS: Lobbyist[] = [
  {
    id: 'local_lobbyist',
    name: 'Local Lobbyist',
    cost: 5000,
    influence: 5,
    specialties: ['all'],
    description: 'A basic lobbyist who can help with any policy type. Provides a small influence boost.',
  },
  {
    id: 'economic_expert',
    name: 'Economic Expert',
    cost: 10000,
    influence: 10,
    specialties: ['economic'],
    description: 'Specializes in economic policies. Provides significant influence boost for economic policies only.',
  },
  {
    id: 'social_policy_specialist',
    name: 'Social Policy Specialist',
    cost: 10000,
    influence: 10,
    specialties: ['social'],
    description: 'Expert in social policies. Provides significant influence boost for social policies only.',
  },
  {
    id: 'environmental_advocate',
    name: 'Environmental Advocate',
    cost: 10000,
    influence: 10,
    specialties: ['environmental'],
    description: 'Passionate about environmental causes. Provides significant influence boost for environmental policies only.',
  },
  {
    id: 'criminal_justice_expert',
    name: 'Criminal Justice Expert',
    cost: 10000,
    influence: 10,
    specialties: ['criminal'],
    description: 'Specializes in criminal justice policies. Provides significant influence boost for criminal policies only.',
  },
  {
    id: 'corporate_lobbyist',
    name: 'Corporate Lobbyist',
    cost: 25000,
    influence: 15,
    specialties: ['economic', 'stock'],
    description: 'Well-connected corporate lobbyist with deep industry ties. Excellent for economic and market policies.',
  },
  {
    id: 'union_representative',
    name: 'Union Representative',
    cost: 20000,
    influence: 12,
    specialties: ['social', 'economic'],
    description: 'Represents labor unions and workers. Great for social and economic policies.',
  },
  {
    id: 'environmental_lawyer',
    name: 'Environmental Lawyer',
    cost: 30000,
    influence: 18,
    specialties: ['environmental'],
    description: 'Expert environmental lawyer with connections to green organizations.',
  },
  {
    id: 'police_union_rep',
    name: 'Police Union Representative',
    cost: 25000,
    influence: 15,
    specialties: ['criminal'],
    description: 'Represents law enforcement interests. Powerful for criminal justice policies.',
  },
  {
    id: 'healthcare_lobbyist',
    name: 'Healthcare Lobbyist',
    cost: 35000,
    influence: 20,
    specialties: ['healthcare', 'social'],
    description: 'Specializes in healthcare policy. Excellent for social and health-related policies.',
  },
  {
    id: 'education_lobbyist',
    name: 'Education Lobbyist',
    cost: 30000,
    influence: 18,
    specialties: ['education', 'social'],
    description: 'Expert in education policy with connections to teachers unions and school boards.',
  },
  {
    id: 'tech_lobbyist',
    name: 'Tech Industry Lobbyist',
    cost: 40000,
    influence: 22,
    specialties: ['technology', 'crypto', 'economic'],
    description: 'Represents major tech companies. Great for technology, crypto and economic policies.',
  },
  {
    id: 'realtor_association_lobbyist',
    name: 'Realtor Association Lobbyist',
    cost: 28000,
    influence: 16,
    specialties: ['realestate', 'economic'],
    description: 'Speaks for developers, landlords and the realtor boards. Moves housing and zoning bills.',
  },
  {
    id: 'transit_authority_lobbyist',
    name: 'Transit Authority Lobbyist',
    cost: 26000,
    influence: 15,
    specialties: ['transportation', 'environmental'],
    description: 'Represents transit agencies and road builders. Strong on transport and clean-mobility bills.',
  },
  {
    id: 'top_tier_lobbyist',
    name: 'Top-Tier Lobbyist',
    cost: 50000,
    influence: 25,
    specialties: ['all'],
    description: 'A highly experienced lobbyist who can help with any policy type. Provides a massive influence boost.',
  },
  {
    id: 'elite_lobbyist',
    name: 'Elite Lobbyist',
    cost: 75000,
    influence: 35,
    specialties: ['all'],
    description: 'The most powerful lobbyist available. Has connections at the highest levels of government.',
  },
  {
    id: 'retired_politician',
    name: 'Retired Politician',
    cost: 100000,
    influence: 50,
    specialties: ['all'],
    description: 'A former high-ranking politician who knows all the ins and outs. Maximum influence boost.',
  },
];

export function getLobbyistById(id: string): Lobbyist | undefined {
  return AVAILABLE_LOBBYISTS.find(l => l.id === id);
}

export function getAvailableLobbyists(hiredLobbyistIds: string[]): Lobbyist[] {
  return AVAILABLE_LOBBYISTS.filter(l => !hiredLobbyistIds.includes(l.id));
}

export function getHiredLobbyists(hiredLobbyistIds: string[]): Lobbyist[] {
  return AVAILABLE_LOBBYISTS.filter(l => hiredLobbyistIds.includes(l.id));
}

/**
 * Display labels for the policy types. `realestate` is one word in the data and
 * two in English, and the roster used to render the raw key.
 */
const SPECIALTY_LABELS: Record<LobbyistSpecialty, string> = {
  all: 'all policies',
  economic: 'economic',
  social: 'social',
  environmental: 'environmental',
  criminal: 'criminal justice',
  stock: 'markets',
  realestate: 'real estate',
  education: 'education',
  crypto: 'crypto',
  technology: 'technology',
  healthcare: 'healthcare',
  transportation: 'transport',
};

/** Shown for a hired id with no catalogue entry — claims nothing. */
const MISSING_SPECIALTY_LABEL = 'specialty unknown';

/**
 * The specialty line the roster, the picker and the detail screen all print.
 *
 * One helper for all three so they cannot describe the same lobbyist
 * differently — the three sites previously read the field three different ways
 * (`cat?.specialty`, `lob.specialty`, `cat?.specialty ?? 'all'`), and the last
 * of them defaulted a missing catalogue entry to the strongest possible claim.
 */
export function describeSpecialties(specialties: readonly LobbyistSpecialty[] | undefined): string {
  // `!specialties` rather than `Array.isArray` — the latter narrows a
  // `readonly T[]` to `any[]`, which would silently make the index below `any`.
  //
  // Absent is NOT the same as `['all']`, and this used to return the same label
  // for both — reproducing, inside the shared helper, the exact defect it was
  // written to remove. `LobbyistRow` passes `cat?.specialties`, so a hired id
  // with no catalogue entry (a retired lobbyist still on an old save) reaches
  // here as `undefined`. Answering "all policies" tells the player that unknown
  // retainer covers everything, which is the strongest possible claim and the
  // one least likely to be true.
  if (!specialties || specialties.length === 0) return MISSING_SPECIALTY_LABEL;
  if (specialties.includes('all')) return SPECIALTY_LABELS.all;
  return specialties.map((s) => SPECIALTY_LABELS[s] ?? s).join(' · ');
}

/** Does this lobbyist move the needle on `policyType`? */
export function lobbyistCovers(lobbyist: Lobbyist, policyType?: PolicyType): boolean {
  const specialties = lobbyist?.specialties;
  if (!Array.isArray(specialties)) return false;
  if (specialties.includes('all')) return true;
  return policyType !== undefined && specialties.includes(policyType);
}

/**
 * Influence from hired lobbyists that applies to `policyType`.
 *
 * Reads the CATALOGUE, keyed by the ids on the save — specialties are static
 * data, not save data, which is why making targeting real needs no
 * `STATE_VERSION` bump and no migration. Existing saves gain the behaviour on
 * load.
 *
 * With no `policyType`, only generalists count: there is no policy to match
 * against, so a specialist has nothing to be on-target for.
 */
export function calculateTotalLobbyistInfluence(
  hiredLobbyistIds: string[],
  policyType?: PolicyType
): number {
  return getHiredLobbyists(hiredLobbyistIds).reduce(
    (total, lobbyist) => (lobbyistCovers(lobbyist, policyType) ? total + (lobbyist.influence || 0) : total),
    0,
  );
}

/**
 * Ceiling on the base discount `politics.policyInfluence` buys, and on the
 * targeted top-up a matching roster adds. Exported so the UI quotes the same
 * numbers the pricing uses.
 */
export const BASE_INFLUENCE_DISCOUNT_CAP = 0.25;
export const TARGETED_LOBBYIST_DISCOUNT_CAP = 0.15;
export const TOTAL_POLICY_DISCOUNT_CAP = 0.35;

/**
 * The fraction off a policy's implementation cost.
 *
 * TWO terms, stacked, and the split is the point:
 *
 *  - `base` is the old formula, unchanged, reading `politics.policyInfluence`.
 *    That accumulator has three other consumers — the Influence StatCard, the
 *    `>= 50` achievement, and the `policyInfluence` event effect — and its
 *    discount was itself a recent fix for a stat that did nothing. Moving the
 *    discount OFF it would have re-opened that hole, and would have silently
 *    cut the discount of every save whose influence came from enacting policies
 *    and lobbying rather than from retainers.
 *
 *  - `targeted` is new, and is the entire point of a specialty: only lobbyists
 *    who cover this policy's type contribute. Generalists (`'all'`) cover
 *    everything, which is what their price and their copy already promised.
 *
 * So nobody loses a point of discount, and hiring the RIGHT lobbyist is now
 * worth more than hiring any lobbyist — the distinction the roster, the picker
 * and the detail screen have been advertising all along.
 */
export function policyDiscountFraction(
  policyInfluence: number | undefined,
  hiredLobbyistIds: string[],
  policyType?: PolicyType,
): number {
  const influence = Number.isFinite(policyInfluence) ? Math.max(0, policyInfluence as number) : 0;
  const base = Math.min(BASE_INFLUENCE_DISCOUNT_CAP, influence / 100);

  const matched = calculateTotalLobbyistInfluence(hiredLobbyistIds, policyType);
  const targeted = Math.min(TARGETED_LOBBYIST_DISCOUNT_CAP, Math.max(0, matched) / 100);

  return Math.min(TOTAL_POLICY_DISCOUNT_CAP, base + targeted);
}

