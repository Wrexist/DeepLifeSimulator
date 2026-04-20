/**
 * Lobbyist System
 * 
 * Lobbyists that can be hired to increase policy influence
 */

export type PolicyType = 'economic' | 'social' | 'environmental' | 'criminal' | 'all';

export interface Lobbyist {
  id: string;
  name: string;
  cost: number; // One-time cost to hire
  influence: number; // Policy influence bonus (0-100)
  specialty: PolicyType; // Policy type they specialize in, or 'all' for all policies
  description: string;
}

export const AVAILABLE_LOBBYISTS: Lobbyist[] = [
  {
    id: 'local_lobbyist',
    name: 'Local Lobbyist',
    cost: 5000,
    influence: 5,
    specialty: 'all',
    description: 'A basic lobbyist who can help with any policy type. Provides a small influence boost.',
  },
  {
    id: 'economic_expert',
    name: 'Economic Expert',
    cost: 10000,
    influence: 10,
    specialty: 'economic',
    description: 'Specializes in economic policies. Provides significant influence boost for economic policies only.',
  },
  {
    id: 'social_policy_specialist',
    name: 'Social Policy Specialist',
    cost: 10000,
    influence: 10,
    specialty: 'social',
    description: 'Expert in social policies. Provides significant influence boost for social policies only.',
  },
  {
    id: 'environmental_advocate',
    name: 'Environmental Advocate',
    cost: 10000,
    influence: 10,
    specialty: 'environmental',
    description: 'Passionate about environmental causes. Provides significant influence boost for environmental policies only.',
  },
  {
    id: 'criminal_justice_expert',
    name: 'Criminal Justice Expert',
    cost: 10000,
    influence: 10,
    specialty: 'criminal',
    description: 'Specializes in criminal justice policies. Provides significant influence boost for criminal policies only.',
  },
  {
    id: 'corporate_lobbyist',
    name: 'Corporate Lobbyist',
    cost: 25000,
    influence: 15,
    specialty: 'economic',
    description: 'Well-connected corporate lobbyist with deep industry ties. Excellent for economic policies.',
  },
  {
    id: 'union_representative',
    name: 'Union Representative',
    cost: 20000,
    influence: 12,
    specialty: 'social',
    description: 'Represents labor unions and workers. Great for social and economic policies.',
  },
  {
    id: 'environmental_lawyer',
    name: 'Environmental Lawyer',
    cost: 30000,
    influence: 18,
    specialty: 'environmental',
    description: 'Expert environmental lawyer with connections to green organizations.',
  },
  {
    id: 'police_union_rep',
    name: 'Police Union Representative',
    cost: 25000,
    influence: 15,
    specialty: 'criminal',
    description: 'Represents law enforcement interests. Powerful for criminal justice policies.',
  },
  {
    id: 'healthcare_lobbyist',
    name: 'Healthcare Lobbyist',
    cost: 35000,
    influence: 20,
    specialty: 'social',
    description: 'Specializes in healthcare policy. Excellent for social and health-related policies.',
  },
  {
    id: 'education_lobbyist',
    name: 'Education Lobbyist',
    cost: 30000,
    influence: 18,
    specialty: 'social',
    description: 'Expert in education policy with connections to teachers unions and school boards.',
  },
  {
    id: 'tech_lobbyist',
    name: 'Tech Industry Lobbyist',
    cost: 40000,
    influence: 22,
    specialty: 'economic',
    description: 'Represents major tech companies. Great for economic and innovation policies.',
  },
  {
    id: 'top_tier_lobbyist',
    name: 'Top-Tier Lobbyist',
    cost: 50000,
    influence: 25,
    specialty: 'all',
    description: 'A highly experienced lobbyist who can help with any policy type. Provides a massive influence boost.',
  },
  {
    id: 'elite_lobbyist',
    name: 'Elite Lobbyist',
    cost: 75000,
    influence: 35,
    specialty: 'all',
    description: 'The most powerful lobbyist available. Has connections at the highest levels of government.',
  },
  {
    id: 'retired_politician',
    name: 'Retired Politician',
    cost: 100000,
    influence: 50,
    specialty: 'all',
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

export function calculateTotalLobbyistInfluence(
  hiredLobbyistIds: string[],
  policyType?: PolicyType
): number {
  const hiredLobbyists = getHiredLobbyists(hiredLobbyistIds);
  return hiredLobbyists.reduce((total, lobbyist) => {
    if (lobbyist.specialty === 'all' || lobbyist.specialty === policyType) {
      return total + lobbyist.influence;
    }
    return total;
  }, 0);
}

