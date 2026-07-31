/**
 * R&D Actions
 * 
 * Research and development actions for companies
 */
import { GameState, RDLab, Company } from '../types';
import { logger } from '@/utils/logger';
import { updateMoney, applyMoneyDelta } from './MoneyActions';
import { PATENT_COSTS } from '@/lib/config/gameConstants';
import { LAB_TYPES, getLabUpgradeCost, LabType } from '@/lib/rd/labs';
import { formatMoney } from '@/utils/moneyFormatting';
import { getTechnologyById } from '@/lib/rd/technologyTree';
import { createPatent, updatePatents } from '@/lib/rd/patents';
import { triggerBreakthrough, applyBreakthroughEffects, type Breakthrough } from '@/lib/rd/breakthroughs';
import { 
  COMPETITIONS,
  getActiveCompetitions, 
  canEnterCompetition,
  calculateCompetitionScore,
} from '@/lib/rd/competitions';
import type { Dispatch, SetStateAction } from 'react';

/** Cap per-company competition history to prevent unbounded save/heap growth. */
const COMPETITION_HISTORY_CAP = 50;

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
    return {
      success: false,
      message: `Lab upgrade costs ${formatMoney(cost)} — you have ${formatMoney(gameState.stats.money)} (${formatMoney(cost - gameState.stats.money)} short).`,
    };
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
    return {
      success: false,
      message: `Research costs ${formatMoney(technology.researchCost)} — you have ${formatMoney(gameState.stats.money)} (${formatMoney(technology.researchCost - gameState.stats.money)} short).`,
    };
  }

  // Apply technology policy effects (R&D bonus)
  const techPolicyEffects = gameState.politics?.activePolicyEffects?.technology;
  const rdBonus = techPolicyEffects?.rdBonus || 0;
  const rdBonusMultiplier = 1 + (rdBonus / 100);
  
  // Create research project
  const projectId = `research_${technologyId}_${Date.now()}`;
  const researchTime = Math.ceil(technology.researchTime / (labInfo.researchSpeedMultiplier * rdBonusMultiplier));

  // Update state: deduct money AND update company in a single state update.
  //
  // ECON-2: every gate above reads the STALE outer `gameState` and the updater
  // re-checked none of them, while `Math.max(0, money - cost)` floored the debit
  // instead of rejecting it. Two taps in one React batch — two technology rows,
  // or the same row twice — both passed, so a Basic lab with
  // `maxConcurrentProjects: 1` ran N projects (defeating the whole lab-tier
  // progression gate) and the second charge silently clamped to 0. With two
  // projects for the SAME technology, `completeResearch` appends the id twice
  // with no dedupe and rolls `triggerBreakthrough` once per completion — two
  // chances at a PERMANENT 2x/3x company income multiplier for one purchase.
  //
  // Same fix `filePatent` and `enterCompetition` in this file already carry from
  // the 2026-07-02 audit; `startResearch` was left behind. 2026-07-30 audit.
  setGameState(prev => {
    const prevCompany = (prev.companies || []).find(c => c.id === companyId);
    if (!prevCompany?.rdLab) return prev;

    // Re-check the concurrency cap against `prev`.
    const prevActive = (prevCompany.rdLab.researchProjects || []).filter(p => !p.completed);
    const prevLabInfo = LAB_TYPES[prevCompany.rdLab.type];
    if (prevActive.length >= prevLabInfo.maxConcurrentProjects) return prev;

    // ...and that this technology is not already being researched or done.
    if (prevActive.some(p => p.technologyId === technologyId)) return prev;
    if ((prevCompany.unlockedTechnologies || []).includes(technologyId)) return prev;

    // Charge inside the updater, rejecting rather than flooring.
    const spend = applyMoneyDelta(prev, -technology.researchCost, `Research: ${technology.name}`);
    if (!spend) return prev;

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
    return {
      ...prev,
      ...spend,
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
): { success: boolean; message: string; patentOpportunity?: boolean; breakthrough?: Breakthrough } => {
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

  // Roll a rare scientific breakthrough on completion. When it fires, the
  // company's income is permanently multiplied (the 2×/3× events in
  // BREAKTHROUGH_EFFECTS) via applyBreakthroughEffects — this wires the
  // previously-orphaned breakthroughs module into the live economy. The chance
  // is low and scales with lab type × technology tier (see triggerBreakthrough).
  const breakthrough = triggerBreakthrough(
    project.technologyId,
    companyId,
    gameState.weeksLived || 0,
    company.rdLab.type,
  );

  // Apply the research completion (and any breakthrough income boost) to a
  // company. baseWeeklyIncome is boosted too, so the multiplier survives the
  // staff/upgrade income recompute (weeklyIncome = baseWeeklyIncome × mult).
  const applyResearchCompletion = (c: Company): Company => {
    const withResearch: Company = {
      ...c,
      rdLab: {
        ...c.rdLab!,
        researchProjects: updatedProjects,
        completedResearch: updatedCompletedResearch,
      },
      unlockedTechnologies: updatedUnlockedTechs,
    };
    if (!breakthrough) return withResearch;
    const boosted = applyBreakthroughEffects(
      { weeklyIncome: withResearch.weeklyIncome, baseWeeklyIncome: withResearch.baseWeeklyIncome },
      breakthrough,
    );
    return { ...withResearch, weeklyIncome: boosted.weeklyIncome, baseWeeklyIncome: boosted.baseWeeklyIncome };
  };

  setGameState(prev => ({
    ...prev,
    companies: (prev.companies || []).map(c => (c.id === companyId ? applyResearchCompletion(c) : c)),
    company: prev.company && prev.company.id === companyId ? applyResearchCompletion(prev.company) : prev.company,
  }));

  log.info(`Completed research: ${technology.name} for ${companyId}`);
  if (breakthrough) {
    log.info(`Breakthrough for ${companyId}: ${breakthrough.name} (income ×${breakthrough.effects.incomeMultiplier})`);
  }

  // Check for patent opportunity (random chance based on lab type + policy bonus)
  const labInfo = LAB_TYPES[company.rdLab.type];
  const techPolicyEffects = gameState.politics?.activePolicyEffects?.technology;
  const patentBonus = techPolicyEffects?.patentBonus || 0;
  const adjustedBreakthroughChance = Math.min(1, labInfo.breakthroughChance * (1 + patentBonus / 100));
  const hasPatentOpportunity = Math.random() < adjustedBreakthroughChance;

  const breakthroughNote = breakthrough
    ? ` Breakthrough: ${breakthrough.name} — company income ×${breakthrough.effects.incomeMultiplier}!`
    : '';

  return {
    success: true,
    message: `Research completed: ${technology.name}!${breakthroughNote}${hasPatentOpportunity ? ' Patent opportunity available!' : ''}`,
    patentOpportunity: hasPatentOpportunity,
    breakthrough: breakthrough || undefined,
  };
};

/**
 * Weekly R&D research tick — the previously-missing driver that makes labs
 * actually finish research (before this, `completeResearch` had ZERO callers,
 * so research never completed and the whole R&D payoff chain was dead).
 *
 * Wired into the company weekly tick (CompanyActionsContext effect on
 * `weeksLived`). Each call:
 *   1. Advances every owned company's in-progress project by `100 / duration`
 *      (duration already bakes in the lab's research-speed multiplier via
 *      startResearch), clamped to 100.
 *   2. Finalises any project that reached 100% through `completeResearch`
 *      (records the tech, unlocks it, rolls the patent opportunity + breakthrough).
 *
 * At most ONE completion per company is finalised per tick: `completeResearch`
 * rebuilds a company's project/tech arrays from a snapshot, so finalising two of
 * the SAME company's projects in one batch would clobber the first. A second
 * project that also hit 100% this week is clamped to 100 and completes next week.
 * The caller guards against double-invoke per week (React StrictMode / remount).
 */
export const advanceResearch = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
): void => {
  const companies = gameState.companies || [];

  // Detect the first project per company that reaches 100% this tick.
  const toComplete = new Map<string, string>(); // companyId -> projectId
  for (const company of companies) {
    const projects = company.rdLab?.researchProjects || [];
    for (const project of projects) {
      if (project.completed) continue;
      if (toComplete.has(company.id)) continue; // one completion per company per tick
      const increment = 100 / Math.max(1, project.duration || 1);
      if (project.progress + increment >= 100 - 1e-6) {
        toComplete.set(company.id, project.id);
      }
    }
  }

  // Finalise completions first (reuses completeResearch → completedResearch,
  // unlockedTechnologies, patent-opportunity + breakthrough income roll).
  toComplete.forEach((projectId, companyId) => {
    completeResearch(gameState, setGameState, companyId, projectId);
  });

  // Then advance every still-in-progress project by one week AND age patents.
  // Derived from `prev` so it layers cleanly on top of the completion pass above.
  setGameState(prev => {
    let changed = false;
    const advance = (c: Company): Company => {
      let next = c;

      // PATENT EXPIRY FIX: age patents once per weekly R&D tick. `updatePatents`
      // decrements each patent's `duration` and drops any that reach 0, so patents
      // finally expire after their `duration` weeks instead of paying `weeklyIncome`
      // forever. calcWeeklyPassiveIncome (passiveIncome.ts) already gates patent
      // income on `duration > 0`, so an expired/dropped patent stops paying the
      // week it ages out. This weekly R&D step is the SOLE per-week driver for
      // `updatePatents` (previously it had zero callers — patents never aged). It
      // runs off `prev` inside the updater, so a StrictMode double-invoke re-derives
      // the same one-week decrement rather than aging twice.
      if (Array.isArray(c.patents) && c.patents.length > 0) {
        next = { ...next, patents: updatePatents(c.patents) };
        changed = true;
      }

      // Advance in-progress research by one week.
      const lab = next.rdLab;
      if (lab && lab.researchProjects && lab.researchProjects.length > 0) {
        let touched = false;
        const projects = lab.researchProjects.map(p => {
          if (p.completed) return p;
          const increment = 100 / Math.max(1, p.duration || 1);
          const nextProgress = Math.min(100, p.progress + increment);
          if (nextProgress !== p.progress) touched = true;
          return { ...p, progress: nextProgress };
        });
        if (touched) {
          changed = true;
          next = { ...next, rdLab: { ...lab, researchProjects: projects } };
        }
      }

      return next;
    };
    const companiesNext = (prev.companies || []).map(advance);
    const companyNext = prev.company ? advance(prev.company) : prev.company;
    if (!changed) return prev;
    return { ...prev, companies: companiesNext, company: companyNext };
  });
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

  // Update state: deduct money AND update company in a single state update to avoid race conditions.
  // R-audit 2026-07-02: the dedup ("patent already filed") and money gates above read the stale
  // outer `gameState`, so two same-batch taps both passed them and filed TWO patents for one
  // technology (each a perpetual weekly-income source), the 2nd partial-free via the old floored
  // `Math.max(0, money - cost)`. Re-check both against `prev` and debit via applyMoneyDelta.
  setGameState(prev => {
    const prevCompany = (prev.companies || []).find(c => c.id === companyId);
    if (!prevCompany) return prev;
    if (prevCompany.patents?.some(p => p.technologyId === technologyId && p.duration > 0)) return prev;
    const spend = applyMoneyDelta(prev, -patentCost, 'File patent');
    if (!spend) return prev;
    return {
      ...prev,
      ...spend,
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

  // Optimistic score for the log line below; the authoritative score is
  // recomputed from `prev` inside the atomic updater.
  const score = calculateCompetitionScore(company);

  // H-8/H-9: fold the affordability + already-entered re-check, the entry-fee
  // charge, and the history append into ONE `setGameState(prev => …)` keyed off
  // `prev`. Previously the fee (deps.updateMoney) and the history append were two
  // separate dispatches, and the append never re-checked `alreadyEntered` — so two
  // same-batch taps both passed the stale outer gate and both appended a duplicate
  // entry. `processCompetitionResults` sums a prize PER entry, so the duplicate
  // paid out twice: a repeatable, untaxed money printer. Re-reading the gate from
  // `prev` (and routing the fee through applyMoneyDelta for the overdraft guard)
  // makes the second tap a no-op.
  setGameState(prev => {
    const target = (prev.companies || []).find(c => c.id === companyId);
    if (!target) return prev;

    const enteredInPrev = (target.competitionHistory || []).some(
      entry => entry.competitionId === competitionId &&
               entry.entryWeek === absoluteWeek &&
               !entry.completed
    );
    if (enteredInPrev) return prev; // second same-batch tap — reject atomically

    const spend = applyMoneyDelta(prev, -competition.entryCost, `Enter ${competition.name}`);
    if (!spend) return prev; // unaffordable (race guard) — reject atomically

    const competitionEntry = {
      competitionId: competition.id,
      competitionName: competition.name,
      entryWeek: absoluteWeek,
      endWeek: absoluteWeek + Math.max(1, competition.endWeek - competition.startWeek),
      score: calculateCompetitionScore(target),
      completed: false,
      prize: undefined,
      rank: undefined,
    };

    const appendEntry = (c: GameState['companies'][number]) => ({
      ...c,
      competitionHistory: [...(c.competitionHistory || []), competitionEntry].slice(-COMPETITION_HISTORY_CAP),
    });

    return {
      ...prev,
      ...spend,
      companies: (prev.companies || []).map(c => (c.id === companyId ? appendEntry(c) : c)),
      company: prev.company?.id === companyId ? appendEntry(prev.company) : prev.company,
    };
  });

  log.info(`Entered competition: ${competition.name} for ${companyId} with score ${score}`);
  const resultDelayWeeks = Math.max(1, competition.endWeek - competition.startWeek);
  return { 
    success: true, 
    message: `Successfully entered ${competition.name}! Results will be announced in ${resultDelayWeeks} weeks.` 
  };
};

/**
 * Resolve any company R&D competitions whose result week has arrived.
 *
 * R10-1: this used to be orphaned — `enterCompetition` charged the entry fee but
 * nothing ever called this to award prizes, so every entry was a permanent money
 * sink. It is now wired into the weekly tick (CompanyActionsContext effect on
 * `weeksLived`). Resolution runs in a SINGLE `setGameState` updater and grants
 * the prize via `applyMoneyDelta` folded into that same updater, so it is atomic
 * and idempotent: a double-invoke (React StrictMode) recomputes from the same
 * `prev` and only ever marks each entry `completed` once — no double-award.
 */
export const processCompetitionResults = (
  setGameState: Dispatch<SetStateAction<GameState>>,
  currentWeek?: number
): void => {
  setGameState(prev => {
    const week = currentWeek ?? (prev.weeksLived || 0);
    const companies = prev.companies || [];

    // Collect resolutions across all companies first so we can grant the total
    // prize in one money delta and rewrite each company's history once.
    let totalPrize = 0;
    const resolvedByCompany = new Map<string, Map<string, { rank: number; prize: number }>>();
    let anyResolved = false;

    for (const company of companies) {
      const pending = (company.competitionHistory || []).filter(
        entry => !entry.completed && entry.endWeek <= week
      );
      if (pending.length === 0) continue;

      const resolutions = new Map<string, { rank: number; prize: number }>();
      for (const entry of pending) {
        const competition = COMPETITIONS.find(c => c.id === entry.competitionId);
        if (!competition) continue;

        // Generate 3–10 AI competitors scoring around the player's score (±25%).
        const numCompetitors = Math.floor(Math.random() * 8) + 3;
        const competitorScores: number[] = [];
        const baseScore = entry.score;
        for (let i = 0; i < numCompetitors; i++) {
          const variation = (Math.random() - 0.5) * baseScore * 0.5;
          competitorScores.push(Math.max(0, Math.floor(baseScore + variation)));
        }
        const allScores = [...competitorScores, entry.score].sort((a, b) => b - a);
        const playerRank = allScores.indexOf(entry.score) + 1;

        let prize = 0;
        if (playerRank === 1) prize = competition.prizes.first;
        else if (playerRank === 2) prize = competition.prizes.second;
        else if (playerRank === 3) prize = competition.prizes.third;

        totalPrize += prize;
        anyResolved = true;
        resolutions.set(`${entry.competitionId}|${entry.entryWeek}`, { rank: playerRank, prize });
        log.info(`Competition ${competition.name} resolved for ${company.id}: rank ${playerRank}, prize $${prize}`);
      }
      if (resolutions.size > 0) resolvedByCompany.set(company.id, resolutions);
    }

    if (!anyResolved) return prev;

    const applyHistory = (c: GameState['companies'][number]) => {
      const resolutions = resolvedByCompany.get(c.id);
      if (!resolutions) return c;
      return {
        ...c,
        competitionHistory: (c.competitionHistory || []).map(e => {
          const r = resolutions.get(`${e.competitionId}|${e.entryWeek}`);
          return r && !e.completed ? { ...e, completed: true, rank: r.rank, prize: r.prize } : e;
        }),
      };
    };

    // Grant the summed prize atomically. applyMoneyDelta returns null only for an
    // invalid amount; totalPrize is a non-negative finite sum, so on the rare null
    // we still mark entries completed (prize forfeited rather than re-resolved forever).
    const moneySlice = totalPrize > 0 ? applyMoneyDelta(prev, totalPrize, 'R&D competition winnings') : null;

    return {
      ...prev,
      ...(moneySlice ?? {}),
      companies: companies.map(applyHistory),
      company: prev.company ? applyHistory(prev.company) : prev.company,
    };
  });
};

