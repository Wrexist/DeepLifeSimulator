/**
 * Party affiliation that costs something and pays something.
 *
 * `politics.party` existed before this: joining set the field, granted a flat
 * +5 approval once, and was read by nothing else. Three parties, one number, no
 * consequence — which is why a player who asked for "join political parties"
 * was asking for a feature the game technically already had.
 *
 * What makes a party worth joining is the MACHINE: it endorses you (which moves
 * election odds), it funds you (money you did not earn), and it expects things
 * back. What makes it a decision is that the machine can be lost — support is
 * spent by governing against the party and by switching sides.
 *
 * Pure functions. No game state, no React.
 */

import type { PolicyType } from './policies';

const safe = (n: number | undefined | null, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export type PartyId = 'democratic' | 'republican' | 'independent';

export interface PartyDefinition {
  id: PartyId;
  name: string;
  /** One line the UI shows under the party name. */
  pitch: string;
  /**
   * Standing a fresh member starts at. Independents have no machine to stand
   * in, so they start (and stay) at 0 — see `MACHINE_PARTIES`.
   */
  startingSupport: number;
  /**
   * Policy categories the party rewards you for enacting. Typed as
   * `PolicyType[]` so an entry that no policy can ever carry is a compile
   * error — the first cut of this file wrote 'environment', 'business',
   * 'realEstate' and 'defense', none of which exist in the policy catalogue,
   * so the platform machinery could never have matched anything.
   */
  favors: PolicyType[];
  /** Policy categories the party punishes you for enacting. */
  opposes: PolicyType[];
}

/** The parties with an actual organisation behind them. */
export const MACHINE_PARTIES: readonly PartyId[] = ['democratic', 'republican'];

export const POLITICAL_PARTIES: readonly PartyDefinition[] = [
  {
    id: 'democratic',
    name: 'Democratic',
    pitch: 'Machine backing and a war chest, in exchange for voting the platform.',
    startingSupport: 50,
    favors: ['healthcare', 'education', 'environmental', 'social'],
    opposes: ['crypto', 'stock'],
  },
  {
    id: 'republican',
    name: 'Republican',
    pitch: 'Machine backing and a war chest, in exchange for voting the platform.',
    startingSupport: 50,
    favors: ['economic', 'crypto', 'realestate', 'stock'],
    opposes: ['healthcare', 'environmental'],
  },
  {
    id: 'independent',
    name: 'Independent',
    pitch: 'No platform to answer to, and nobody to call when you need money.',
    startingSupport: 0,
    favors: [],
    opposes: [],
  },
];

export function findParty(id: string | undefined | null): PartyDefinition | undefined {
  return POLITICAL_PARTIES.find((p) => p.id === id);
}

/** True when this party has a machine that can endorse and fund. */
export function hasPartyMachine(id: string | undefined | null): boolean {
  return MACHINE_PARTIES.includes(id as PartyId);
}

/** Standing at or above this and the party puts its name behind you. */
export const ENDORSEMENT_THRESHOLD = 60;

/** Standing below this and the party starts looking for another candidate. */
export const PRIMARY_CHALLENGE_THRESHOLD = 25;

/** Support a member is left with after crossing the floor. */
export const SWITCH_SUPPORT_PENALTY = 25;

/** Approval the public docks a party-switcher. */
export const SWITCH_APPROVAL_PENALTY = 10;

/**
 * Standing within the party, normalized.
 *
 * An independent is always 0 — not "unknown". Reading a stored number for a
 * party with no machine would let a player bank support, go independent, and
 * still draw on an organisation that does not exist.
 */
export function readPartySupport(
  party: string | undefined | null,
  stored: number | undefined | null,
): number {
  if (!hasPartyMachine(party)) return 0;
  // Absent is NOT zero. `politics.party` predates v47, so a pre-v47 save can
  // carry a party with no `partySupport` key — that member is in good
  // standing, and reading 0 would load them under a primary challenge at the
  // maximum election penalty (the exact harm the v47 carve-out's "no
  // backfill" reasoning promises this reader prevents). A STORED 0 is an
  // earned 0 and stays 0; only a missing key gets the fresh-member baseline.
  if (stored == null) return findParty(party)?.startingSupport ?? 0;
  return clamp(Math.round(safe(stored, 0)), 0, 100);
}

/** Is the party's name on the ballot next to yours? */
export function isEndorsed(party: string | undefined | null, support: number | undefined | null): boolean {
  return hasPartyMachine(party) && readPartySupport(party, support) >= ENDORSEMENT_THRESHOLD;
}

/** Is the party shopping for someone else? */
export function facesPrimaryChallenge(
  party: string | undefined | null,
  support: number | undefined | null,
): boolean {
  return hasPartyMachine(party) && readPartySupport(party, support) < PRIMARY_CHALLENGE_THRESHOLD;
}

/**
 * Percentage points added to (or taken off) an election's success chance.
 *
 * Deliberately bounded and modest: an endorsement should tilt a close race, not
 * decide every race. A party that has turned on you actively costs you votes,
 * which is what gives `partySupport` a downside worth avoiding.
 */
export function electionSupportModifier(
  party: string | undefined | null,
  support: number | undefined | null,
): number {
  if (!hasPartyMachine(party)) return 0;
  const s = readPartySupport(party, support);
  if (s >= ENDORSEMENT_THRESHOLD) return Math.round(((s - ENDORSEMENT_THRESHOLD) / 40) * 8) + 4; // +4 … +12
  if (s < PRIMARY_CHALLENGE_THRESHOLD) return -Math.round(((PRIMARY_CHALLENGE_THRESHOLD - s) / 25) * 10); // -10 … 0
  return 0;
}

/**
 * What the party will put into your campaign this week, free of charge.
 *
 * Scales with standing and with the office — a party spends on a governor's
 * race, not a council seat. Zero without an endorsement, so this is the reward
 * for keeping the machine happy rather than a passive drip.
 */
export function weeklyPartyFunding(input: {
  party?: string | null;
  support?: number | null;
  careerLevel?: number | null;
}): number {
  if (!isEndorsed(input.party, input.support)) return 0;
  const office = clamp(Math.floor(safe(input.careerLevel, 0)), 0, 6);
  if (office <= 0) return 0;
  const support = readPartySupport(input.party, input.support);
  const base = office * 250;
  return Math.round(base * (support / 100));
}

/**
 * Support gained or lost by enacting a policy of a given category.
 *
 * A machine party rewards its platform and punishes the other side's. An
 * independent has no opinion, which is the trade: no penalties, no machine.
 */
export function policySupportDelta(party: string | undefined | null, category: string | undefined): number {
  const def = findParty(party);
  if (!def || !hasPartyMachine(party) || !category) return 0;
  if ((def.favors as readonly string[]).includes(category)) return 6;
  if ((def.opposes as readonly string[]).includes(category)) return -8;
  return 0;
}

/**
 * Weekly drift of party standing.
 *
 * Loyalty decays toward the neutral 50 the same way approval does — a member
 * who does nothing for the party slowly stops being owed anything, and one who
 * has fallen out of favour is slowly forgiven. Scandals pull it down hard,
 * because that is what the machine actually reacts to.
 */
export function driftPartySupport(input: {
  party?: string | null;
  support?: number | null;
  activeScandals?: number | null;
}): number {
  if (!hasPartyMachine(input.party)) return 0;
  const current = readPartySupport(input.party, input.support);
  const scandals = Math.max(0, Math.floor(safe(input.activeScandals, 0)));
  const towardNeutral = current > 50 ? -1 : current < 50 ? 1 : 0;
  return clamp(current + towardNeutral - scandals * 3, 0, 100);
}

export interface PartySwitchResult {
  party: PartyId;
  support: number;
  approvalDelta: number;
  switches: number;
}

/**
 * Cross the floor.
 *
 * Joining for the FIRST time is free — you start at the party's baseline.
 * Every switch afterwards costs public approval and lands you at the bottom of
 * the new party's pecking order, so party choice is a commitment rather than a
 * button to press before each election.
 */
export function switchParty(input: {
  currentParty?: string | null;
  currentSupport?: number | null;
  switches?: number | null;
  target: PartyId;
}): PartySwitchResult {
  const def = findParty(input.target);
  const startingSupport = def?.startingSupport ?? 0;
  const isFirstJoin = !input.currentParty;
  const switches = Math.max(0, Math.floor(safe(input.switches, 0)));

  if (isFirstJoin) {
    return {
      party: input.target,
      support: hasPartyMachine(input.target) ? startingSupport : 0,
      approvalDelta: 5,
      switches,
    };
  }

  return {
    party: input.target,
    support: hasPartyMachine(input.target) ? Math.min(startingSupport, SWITCH_SUPPORT_PENALTY) : 0,
    // Each defection is read as less principled than the last.
    approvalDelta: -(SWITCH_APPROVAL_PENALTY + switches * 5),
    switches: switches + 1,
  };
}
