/**
 * Innovation Competitions
 * 
 * Competitive events for R&D achievements
 */
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export type CompetitionType = 'quarterly' | 'annual' | 'industry';

export interface Competition {
  id: string;
  name: string;
  description: string;
  type: CompetitionType;
  startWeek: number;
  endWeek: number;
  entryCost: number;
  prizes: {
    first: number;
    second: number;
    third: number;
  };
  requirements: {
    minTechnologies?: number;
    minPatents?: number;
    companyType?: string;
  };
}

export const COMPETITIONS: Competition[] = [
  {
    id: 'quarterly_innovation',
    name: 'Quarterly Innovation Challenge',
    description: 'Compete with other companies for innovation awards',
    type: 'quarterly',
    startWeek: 1,
    endWeek: 12,
    entryCost: 5000,
    prizes: {
      first: 50000,
      second: 25000,
      third: 10000,
    },
    requirements: {
      minTechnologies: 1,
    },
  },
  {
    id: 'annual_tech_awards',
    name: 'Annual Tech Awards',
    description: 'The most prestigious technology competition',
    type: 'annual',
    startWeek: 1,
    endWeek: WEEKS_PER_YEAR,
    entryCost: 20000,
    prizes: {
      first: 200000,
      second: 100000,
      third: 50000,
    },
    requirements: {
      minTechnologies: 3,
      minPatents: 1,
    },
  },
  {
    id: 'manufacturing_innovation',
    name: 'Manufacturing Innovation Award',
    description: 'Industry-specific competition for manufacturing companies',
    type: 'industry',
    startWeek: 1,
    endWeek: 26,
    entryCost: 10000,
    prizes: {
      first: 75000,
      second: 40000,
      third: 20000,
    },
    requirements: {
      minTechnologies: 2,
      companyType: 'factory',
    },
  },
  {
    id: 'ai_breakthrough',
    name: 'AI Breakthrough Award',
    description: 'Competition for AI/ML innovations',
    type: 'industry',
    startWeek: 1,
    endWeek: 26,
    entryCost: 15000,
    prizes: {
      first: 100000,
      second: 50000,
      third: 25000,
    },
    requirements: {
      minTechnologies: 2,
      companyType: 'ai',
    },
  },
  {
    id: 'culinary_innovation',
    name: 'Culinary Innovation Award',
    description: 'Competition for food service innovations',
    type: 'industry',
    startWeek: 1,
    endWeek: 26,
    entryCost: 8000,
    prizes: {
      first: 60000,
      second: 30000,
      third: 15000,
    },
    requirements: {
      minTechnologies: 2,
      companyType: 'restaurant',
    },
  },
];

export function getActiveCompetitions(week: number): Competition[] {
  return COMPETITIONS.filter(comp => {
    // Quarterly competitions repeat every 12 weeks
    if (comp.type === 'quarterly') {
      const cycleWeek = ((week - 1) % WEEKS_PER_YEAR) + 1;
      return cycleWeek >= comp.startWeek && cycleWeek <= comp.endWeek;
    }
    // Annual competitions repeat every WEEKS_PER_YEAR weeks
    if (comp.type === 'annual') {
      const cycleWeek = ((week - 1) % WEEKS_PER_YEAR) + 1;
      return cycleWeek >= comp.startWeek && cycleWeek <= comp.endWeek;
    }
    // Industry competitions repeat every 26 weeks
    if (comp.type === 'industry') {
      const cycleWeek = ((week - 1) % 26) + 1;
      return cycleWeek >= comp.startWeek && cycleWeek <= comp.endWeek;
    }
    return false;
  });
}

export function canEnterCompetition(
  competition: Competition,
  company: { type: string; unlockedTechnologies?: string[]; patents?: { duration: number }[] }
): boolean {
  if (competition.requirements.companyType && company.type !== competition.requirements.companyType) {
    return false;
  }

  const techCount = company.unlockedTechnologies?.length || 0;
  if (competition.requirements.minTechnologies && techCount < competition.requirements.minTechnologies) {
    return false;
  }

  const activePatents = company.patents?.filter(p => p.duration > 0).length || 0;
  if (competition.requirements.minPatents && activePatents < competition.requirements.minPatents) {
    return false;
  }

  return true;
}

export function calculateCompetitionScore(
  company: { unlockedTechnologies?: string[]; patents?: { weeklyIncome: number; duration: number }[] }
): number {
  let score = 0;

  // Score from technologies (10 points each)
  score += (company.unlockedTechnologies?.length || 0) * 10;

  // Score from patents (based on income)
  if (company.patents) {
    score += company.patents
      .filter(p => p.duration > 0)
      .reduce((sum, p) => sum + Math.floor(p.weeklyIncome / 10), 0);
  }

  return score;
}

