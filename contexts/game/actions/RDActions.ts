/**
 * R&D Actions
 * 
 * Research and development actions for companies
 */
import { GameState, Company, RDLab, Patent } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney } from './MoneyActions';
import { PATENT_COSTS } from '@/lib/config/gameConstants';
import { LAB_TYPES, getLabUpgradeCost, LabType } from '@/lib/rd/labs';
import { getTechnologyById, getAvailableTechnologies, Technology } from '@/lib/rd/technologyTree';
import { createPatent, updatePatents, calculatePatentIncome } from '@/lib/rd/patents';
import { 
  COMPETITIONS,
  getActiveCompetitions, 
  canEnterCompetition, 
  calculateCompetitionScore,
  type Competition 
} from '@/lib/rd/competitions';
import type { Dispatch, SetStateAction } from 'react';

const log = logger.scope('RDActions');

export const buildRDLab = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  companyId: string,
  labType: LabType,
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  const company = (gameState.companies || []).find(c => c.id === companyId);
  if (!company) {
    return { success: false, message: 'Company not found' };
  }

  const currentLabType = company.rdLab?.type || null;
  const cost = getLabUpgradeCost(currentLabType, labType);

  if (gameState.stats.money < cost) {
    return { success: false, message: `You need $${cost.toLocaleString()} to build/upgrade the lab` };
  }

  // Update state: deduct money AND update company in a single state update to avoid race conditions
  setGameState(prev => {
    const newMoney = Math.max(0, prev.stats.money - cost);
    // Create lab object inside updater to use fresh weeksLived
    const newLab: RDLab = {
      type: labType,
      builtWeek: prev.weeksLived || 0,
      researchProjects: company.rdLab?.researchProjects || [],
      completedResearch: company.rdLab?.completedResearch || [],
    };
    return {
      ...prev,
      stats: {
        ...prev.stats,
        money: newMoney,
      },
      companies: (prev.companies || []).map(c => {
        if (c.id !== companyId) return c;
        return {
          ...c,
          rdLab: newLab,
        };
      }),
      company: prev.company?.id === companyId ? { ...prev.company, rdLab: newLab } : prev.company,
    };
  });

  // Log the money update
  log.info(`Money deducted: $${cost.toLocaleString()} for building ${LAB_TYPES[labType].name}`);

  log.info(`Built ${LAB_TYPES[labType].name} for ${companyId}`);
  return { success: true, message: `${LAB_TYPES[labType].name} built successfully!` };
};

export const startResearch = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  companyId: string,
  technologyId: string,
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  const company = (gameState.companies || []).find(c => c.id === companyId);
  if (!company) {
    return { success: false, message: 'Company not found' };
  }

  if (!company.rdLab) {
    return { success: false, message: 'You need to build an R&D lab first' };
  }

  const technology = getTechnologyById(technologyId);
  if (!technology) {
    return { success: false, message: 'Technology not found' };
  }

  // Check if already completed
  if (company.unlockedTechnologies?.includes(technologyId)) {
    return { success: false, message: 'This technology is already unlocked' };
  }

  // Check prerequisites
  const completedTechs = company.unlockedTechnologies || [];
  if (!technology.prerequisites.every(prereq => completedTechs.includes(prereq))) {
    return { success: false, message: 'Prerequisites not met' };
  }

  // Check if already researching
  const activeProjects = company.rdLab.researchProjects.filter(p => !p.completed);
  const labInfo = LAB_TYPES[company.rdLab.type];
  if (activeProjects.length >= labInfo.maxConcurrentProjects) {
    return { success: false, message: `Lab can only handle ${labInfo.maxConcurrentProjects} concurrent project(s)` };
  }

  // Check cost
  if (gameState.stats.money < technology.researchCost) {
    return { success: false, message: `You need $${technology.researchCost.toLocaleString()} to start this research` };
  }

  // Apply technology policy effects (R&D bonus)
  const techPolicyEffects = gameState.politics?.activePolicyEffects?.technology;
  const rdBonus = techPolicyEffects?.rdBonus || 0;
  const rdBonusMultiplier = 1 + (rdBonus / 100);
  
  // Create research project
  const projectId = `research_${technologyId}_${Date.now()}`;
  const researchTime = Math.ceil(technology.researchTime / (labInfo.researchSpeedMultiplier * rdBonusMultiplier));

  // Update state: deduct money AND update company in a single state update to avoid race conditions
  setGameState(prev => {
    // Create project inside updater to use fresh weeksLived
    const newProject = {
      id: projectId,
      technologyId,
      startWeek: prev.weeksLived || 0,
      duration: researchTime,
      cost: technology.researchCost,
      progress: 0,
      completed: false,
    };
    const newMoney = Math.max(0, prev.stats.money - technology.researchCost);
    return {
      ...prev,
      stats: {
        ...prev.stats,
        money: newMoney,
      },
      companies: (prev.companies || []).map(c => {
        if (c.id !== companyId) return c;
        return {
          ...c,
          rdLab: {
            ...c.rdLab!,
            researchProjects: [...(c.rdLab?.researchProjects || []), newProject],
          },
        };
      }),
      company: prev.company?.id === companyId
        ? {
            ...prev.company,
            rdLab: {
              ...prev.company.rdLab!,
              researchProjects: [...(prev.company.rdLab?.researchProjects || []), newProject],
            },
          }
        : prev.company,
    };
  });

  // Log the money update
  log.info(`Money deducted: $${technology.researchCost.toLocaleString()} for researching ${technology.name}`);

  log.info(`Started research: ${technology.name} for ${companyId}`);
  return { success: true, message: `Research started: ${technology.name} (${researchTime} weeks)` };
};

export const completeResearch = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  companyId: string,
  projectId: string
): { success: boolean; message: string; patentOpportunity?: boolean } => {
  const company = (gameState.companies || []).find(c => c.id === companyId);
  if (!company || !company.rdLab) {
    return { success: false, message: 'Company or lab not found' };
  }

  const project = company.rdLab.researchProjects.find(p => p.id === projectId);
  if (!project) {
    return { success: false, message: 'Research project not found' };
  }

  if (project.completed) {
    return { success: false, message: 'Research already completed' };
  }

  const technology = getTechnologyById(project.technologyId);
  if (!technology) {
    return { success: false, message: 'Technology not found' };
  }

  // Mark project as completed
  const updatedProjects = company.rdLab.researchProjects.map(p => {
    if (p.id !== projectId) return p;
    return { ...p, completed: true, progress: 100 };
  });

  // Add to completed research
  const updatedCompletedResearch = [
    ...(company.rdLab.completedResearch || []),
    project.technologyId,
  ];

  // Add to unlocked technologies
  const updatedUnlockedTechs = [
    ...(company.unlockedTechnologies || []),
    project.technologyId,
  ];

  setGameState(prev => ({
    ...prev,
    companies: (prev.companies || []).map(c => {
      if (c.id !== companyId) return c;
      return {
        ...c,
        rdLab: {
          ...c.rdLab!,
          researchProjects: updatedProjects,
          completedResearch: updatedCompletedResearch,
        },
        unlockedTechnologies: updatedUnlockedTechs,
      };
    }),
    company: prev.company?.id === companyId
      ? {
          ...prev.company,
          rdLab: {
            ...prev.company.rdLab!,
            researchProjects: updatedProjects,
            completedResearch: updatedCompletedResearch,
          },
          unlockedTechnologies: updatedUnlockedTechs,
        }
      : prev.company,
  }));

  log.info(`Completed research: ${technology.name} for ${companyId}`);
  
  // Check for patent opportunity (random chance based on lab type + policy bonus)
  const labInfo = LAB_TYPES[company.rdLab.type];
  const techPolicyEffects = gameState.politics?.activePolicyEffects?.technology;
  const patentBonus = techPolicyEffects?.patentBonus || 0;
  const adjustedBreakthroughChance = Math.min(1, labInfo.breakthroughChance * (1 + patentBonus / 100));
  const hasPatentOpportunity = Math.random() < adjustedBreakthroughChance;

  return {
    success: true,
    message: `Research completed: ${technology.name}!${hasPatentOpportunity ? ' Patent opportunity available!' : ''}`,
    patentOpportunity: hasPatentOpportunity,
  };
};

export const filePatent = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  companyId: string,
  technologyId: string,
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  const company = (gameState.companies || []).find(c => c.id === companyId);
  if (!company || !company.rdLab) {
    return { success: false, message: 'Company or lab not found' };
  }

  // Check if technology is unlocked
  if (!company.unlockedTechnologies?.includes(technologyId)) {
    return { success: false, message: 'Technology must be researched first' };
  }

  // Check if patent already exists
  if (company.patents?.some(p => p.technologyId === technologyId && p.duration > 0)) {
    return { success: false, message: 'Patent already filed for this technology' };
  }

  const technology = getTechnologyById(technologyId);
  if (!technology) {
    return { success: false, message: 'Technology not found' };
  }

  // Patent filing cost based on technology tier
  const patentCost = PATENT_COSTS[technology.tier] || 100000;

  if (gameState.stats.money < patentCost) {
    return { success: false, message: `You need $${patentCost.toLocaleString()} to file this patent` };
  }

  // Create patent
  const patent = createPatent(
    technologyId,
    technology.name,
    gameState.weeksLived,
    company.rdLab?.type
  );

  // Update state: deduct money AND update company in a single state update to avoid race conditions
  setGameState(prev => {
    const newMoney = Math.max(0, prev.stats.money - patentCost);
    return {
      ...prev,
      stats: {
        ...prev.stats,
        money: newMoney,
      },
      companies: (prev.companies || []).map(c => {
        if (c.id !== companyId) return c;
        return {
          ...c,
          patents: [...(c.patents || []), patent],
        };
      }),
      company: prev.company?.id === companyId
        ? {
            ...prev.company,
            patents: [...(prev.company.patents || []), patent],
          }
        : prev.company,
    };
  });

  // Log the money update
  log.info(`Money deducted: $${patentCost.toLocaleString()} for filing patent: ${technology.name}`);

  log.info(`Filed patent: ${technology.name} for ${companyId}`);
  return { success: true, message: `Patent filed: ${technology.name}! Weekly income: $${patent.weeklyIncome.toLocaleString()}` };
};

export const enterCompetition = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  companyId: string,
  competitionId: string,
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  const company = (gameState.companies || []).find(c => c.id === companyId);
  if (!company) {
    return { success: false, message: 'Company not found' };
  }

  // Get active competitions
  const absoluteWeek = gameState.weeksLived || 0;
  const activeCompetitions = getActiveCompetitions(absoluteWeek);
  const competition = activeCompetitions.find(c => c.id === competitionId);
  
  if (!competition) {
    return { success: false, message: 'Competition not found or not currently active' };
  }

  // Check if already entered
  const competitionHistory = company.competitionHistory || [];
  const alreadyEntered = competitionHistory.some(
    entry => entry.competitionId === competitionId && 
             entry.entryWeek === absoluteWeek &&
             !entry.completed
  );

  if (alreadyEntered) {
    return { success: false, message: 'You have already entered this competition' };
  }

  // Check requirements
  if (!canEnterCompetition(competition, company)) {
    if (competition.requirements.companyType && company.type !== competition.requirements.companyType) {
      return { success: false, message: `This competition is only for ${competition.requirements.companyType} companies` };
    }
    if (competition.requirements.minTechnologies) {
      const techCount = company.unlockedTechnologies?.length || 0;
      if (techCount < competition.requirements.minTechnologies) {
        return { success: false, message: `You need at least ${competition.requirements.minTechnologies} technologies to enter` };
      }
    }
    if (competition.requirements.minPatents) {
      const activePatents = company.patents?.filter(p => p.duration > 0).length || 0;
      if (activePatents < competition.requirements.minPatents) {
        return { success: false, message: `You need at least ${competition.requirements.minPatents} active patents to enter` };
      }
    }
    return { success: false, message: 'You do not meet the requirements for this competition' };
  }

  // Check entry cost
  if (gameState.stats.money < competition.entryCost) {
    return { success: false, message: `You need $${competition.entryCost.toLocaleString()} to enter this competition` };
  }

  // Deduct entry cost
  deps.updateMoney(setGameState, -competition.entryCost, `Enter ${competition.name}`);

  // Calculate company score
  const score = calculateCompetitionScore(company);

  // Add competition entry to history
  const competitionEntry = {
    competitionId: competition.id,
    competitionName: competition.name,
    entryWeek: absoluteWeek,
    endWeek: absoluteWeek + Math.max(1, competition.endWeek - competition.startWeek),
    score: score,
    completed: false,
    prize: undefined,
    rank: undefined,
  };

  setGameState(prev => ({
    ...prev,
    companies: (prev.companies || []).map(c => {
      if (c.id !== companyId) return c;
      return {
        ...c,
        competitionHistory: [...(c.competitionHistory || []), competitionEntry],
      };
    }),
    company: prev.company?.id === companyId
      ? {
          ...prev.company,
          competitionHistory: [...(prev.company.competitionHistory || []), competitionEntry],
        }
      : prev.company,
  }));

  log.info(`Entered competition: ${competition.name} for ${companyId} with score ${score}`);
  const resultDelayWeeks = Math.max(1, competition.endWeek - competition.startWeek);
  return { 
    success: true, 
    message: `Successfully entered ${competition.name}! Results will be announced in ${resultDelayWeeks} weeks.` 
  };
};

export const processCompetitionResults = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  deps: { updateMoney: typeof updateMoney },
  currentWeek?: number
): void => {
  const week = currentWeek ?? (gameState.weeksLived || 0);
  
  (gameState.companies || []).forEach(company => {
    const competitionHistory = company.competitionHistory || [];
    const pendingCompetitions = competitionHistory.filter(
      entry => !entry.completed && entry.endWeek <= week
    );

    if (pendingCompetitions.length === 0) return;

    pendingCompetitions.forEach(entry => {
      // Resolve by id from canonical list so resolution does not depend on current active window.
      const competition = COMPETITIONS.find(c => c.id === entry.competitionId);
      if (!competition) return;

      // Generate AI competitors (3-10 competitors with random scores)
      const numCompetitors = Math.floor(Math.random() * 8) + 3;
      const competitorScores: number[] = [];
      
      // Base competitor scores around player's score with variation
      const baseScore = entry.score;
      for (let i = 0; i < numCompetitors; i++) {
        const variation = (Math.random() - 0.5) * baseScore * 0.5; // ±25% variation
        competitorScores.push(Math.max(0, Math.floor(baseScore + variation)));
      }

      // Add player score and sort
      const allScores = [...competitorScores, entry.score].sort((a, b) => b - a);
      const playerRank = allScores.indexOf(entry.score) + 1;

      // Determine prize
      let prize = 0;
      if (playerRank === 1) {
        prize = competition.prizes.first;
      } else if (playerRank === 2) {
        prize = competition.prizes.second;
      } else if (playerRank === 3) {
        prize = competition.prizes.third;
      }

      // Update competition entry
      const updatedEntry = {
        ...entry,
        completed: true,
        rank: playerRank,
        prize: prize,
      };

      // Award prize if won
      if (prize > 0) {
        deps.updateMoney(setGameState, prize, `Won ${competition.name} (${playerRank === 1 ? '1st' : playerRank === 2 ? '2nd' : '3rd'} place)`);
      }

      // Update company state
      setGameState(prev => ({
        ...prev,
        companies: (prev.companies || []).map(c => {
          if (c.id !== company.id) return c;
          return {
            ...c,
            competitionHistory: (c.competitionHistory || []).map(e => 
              e.competitionId === entry.competitionId && e.entryWeek === entry.entryWeek
                ? updatedEntry
                : e
            ),
          };
        }),
        company: prev.company?.id === company.id
          ? {
              ...prev.company,
              competitionHistory: (prev.company.competitionHistory || []).map(e => 
                e.competitionId === entry.competitionId && e.entryWeek === entry.entryWeek
                  ? updatedEntry
                  : e
              ),
            }
          : prev.company,
      }));

      log.info(`Competition ${competition.name} completed for ${company.id}: Rank ${playerRank}, Prize: $${prize}`);
    });
  });
};

