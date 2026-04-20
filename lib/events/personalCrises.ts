import type { GameState } from '@/contexts/game/types';
import type { EventTemplate } from './engine';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';

/**
 * Personal crisis events are high-impact events that affect individual players
 * based on their current state and risk factors
 */

/**
 * Calculate risk factor for medical emergencies
 * Higher risk if health is low, age is high, or lifestyle is poor
 */
function getMedicalRisk(state: GameState): number {
  const health = state.stats.health || 100;
  const age = state.date?.age || ADULTHOOD_AGE;
  const fitness = state.stats.fitness || 0;
  
  // Base risk increases with low health
  let risk = (100 - health) / 100;
  
  // Age increases risk (especially after 50)
  if (age > 50) {
    risk += (age - 50) / 100;
  }
  
  // Low fitness increases risk
  if (fitness < 30) {
    risk += 0.2;
  }
  
  return Math.min(risk, 0.8); // Cap at 80% max risk
}

/**
 * Calculate risk factor for financial crises
 * Higher risk if money is low, debt is high, or credit is poor
 */
function getFinancialRisk(state: GameState): number {
  const money = state.stats.money || 0;
  const loans = state.loans || [];
  const totalDebt = loans.reduce((sum, loan) => sum + loan.remaining, 0);
  const bankSavings = state.bankSavings || 0;
  const netWorth = money + bankSavings - totalDebt;
  
  // Base risk increases with negative net worth
  let risk = netWorth < 0 ? 0.3 : 0;
  
  // High debt relative to income increases risk
  if (totalDebt > 0) {
    const currentCareer = (state.careers || []).find(c => c.id === state.currentJob && c.accepted);
    const weeklyIncome = currentCareer?.levels?.[currentCareer.level]?.salary || 0;
    if (weeklyIncome > 0 && totalDebt > weeklyIncome * 20) {
      risk += 0.3;
    }
  }
  
  // Very low cash increases risk
  if (money < 100) {
    risk += 0.2;
  }
  
  return Math.min(risk, 0.7); // Cap at 70% max risk
}

/**
 * Medical Emergency Event
 * Serious illness or accident requiring medical attention
 * Can trigger disease generation
 */
export const medicalEmergency: EventTemplate = {
  id: 'medical_emergency',
  category: 'health',
  weight: (state: GameState) => {
    const risk = getMedicalRisk(state);
    return risk * 0.15; // 15% of risk becomes event weight (reduced from 30%)
  },
  generate: (state: GameState) => {
    const health = state.stats.health || 100;
    const money = state.stats.money || 0;
    const hasInsurance = false; // Health insurance not yet implemented
    
    // Determine severity based on health
    const isSevere = health < 40;
    const cost = hasInsurance 
      ? (isSevere ? 500 : 200) // Insurance covers most
      : (isSevere ? 5000 : 2000); // No insurance = expensive
    
    // Generate potential disease from event
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateEventDisease } = require('@/lib/diseases/diseaseGenerator');
    const eventDisease = generateEventDisease('medical_emergency', state);
    const diseaseName = eventDisease ? eventDisease.name : null;
    
    return {
      id: 'medical_emergency',
      description: isSevere
        ? `A serious medical emergency has occurred! ${diseaseName ? `You've been diagnosed with ${diseaseName}.` : ''} You need immediate medical attention.`
        : `You've had a medical emergency requiring treatment.${diseaseName ? ` You've been diagnosed with ${diseaseName}.` : ''}`,
      choices: [
        {
          id: 'treat',
          text: hasInsurance 
            ? `Seek treatment ($${cost.toLocaleString()} with insurance)`
            : `Seek treatment ($${cost.toLocaleString()})`,
          effects: {
            money: -cost,
            stats: {
              health: isSevere ? 30 : 15,
              happiness: -10,
            },
          },
          // Disease will be added to state in event resolution handler
          special: eventDisease ? 'add_disease' : undefined,
          diseaseId: eventDisease ? eventDisease.id : undefined,
        },
        {
          id: 'delay',
          text: 'Delay treatment (risky)',
          effects: {
            stats: {
              health: isSevere ? -20 : -10,
              happiness: -15,
            },
          },
          // Higher chance of disease if treatment delayed
          special: eventDisease ? 'add_disease' : undefined,
          diseaseId: eventDisease ? eventDisease.id : undefined,
        },
        {
          id: 'home',
          text: 'Try home remedies',
          effects: {
            money: -50,
            stats: {
              health: isSevere ? -5 : 5,
              happiness: -5,
            },
          },
          // Lower chance but still possible
          special: eventDisease && Math.random() < 0.5 ? 'add_disease' : undefined,
          diseaseId: eventDisease ? eventDisease.id : undefined,
        },
      ],
    };
  },
};

/**
 * Identity Theft Event
 * Financial fraud affecting the player
 */
export const identityTheft: EventTemplate = {
  id: 'identity_theft',
  category: 'economy',
  weight: (state: GameState) => {
    const risk = getFinancialRisk(state);
    return risk * 0.1; // 10% of financial risk becomes event weight (reduced from 20%)
  },
  generate: (state: GameState) => {
    const money = state.stats.money || 0;
    const bankSavings = state.bankSavings || 0;
    const totalAssets = money + bankSavings;
    
    // Theft amount is a percentage of assets
    const theftAmount = Math.min(totalAssets * 0.1, 5000); // 10% or max $5000
    
    return {
      id: 'identity_theft',
      description: 'You discover that your identity has been stolen! Someone has been using your financial information.',
      choices: [
        {
          id: 'report',
          text: 'Report to authorities and banks',
          effects: {
            money: -theftAmount,
            stats: {
              happiness: -15,
              reputation: 5, // Good for reporting
            },
          },
        },
        {
          id: 'freeze',
          text: 'Freeze accounts immediately',
          effects: {
            money: -theftAmount * 0.5, // Less loss but more hassle
            stats: {
              happiness: -10,
            },
          },
        },
        {
          id: 'ignore',
          text: 'Hope it resolves itself',
          effects: {
            money: -theftAmount * 1.5, // More loss
            stats: {
              happiness: -20,
              reputation: -5,
            },
          },
        },
      ],
    };
  },
};

/**
 * Investment Opportunity Event
 * A chance to invest in something promising
 */
export const investmentOpportunity: EventTemplate = {
  id: 'investment_opportunity',
  category: 'economy',
  weight: (state: GameState) => {
    const money = state.stats.money || 0;
    // More likely if player has money to invest (reduced frequency)
    return money > 1000 ? 0.08 : 0.03;
  },
  generate: (state: GameState) => {
    const money = state.stats.money || 0;
    const investmentAmount = Math.min(money * 0.3, 2000); // 30% or max $2000
    
    // Use deterministic random for outcome
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    const weekSeed = (state.weeksLived || 0) * 1000 + (state.date?.year || 2025) * 100;
    const outcomeRoll = seededRandom(weekSeed + 10000);
    
    // 60% chance of success, 30% break even, 10% loss
    const isSuccess = outcomeRoll < 0.6;
    const isLoss = outcomeRoll >= 0.9;
    
    return {
      id: 'investment_opportunity',
      description: 'A friend offers you an investment opportunity. It could be profitable, but there\'s risk involved.',
      choices: [
        {
          id: 'invest',
          text: `Invest $${investmentAmount.toLocaleString()}`,
          effects: {
            money: isSuccess 
              ? investmentAmount * 1.5 // 50% return
              : isLoss 
                ? -investmentAmount * 0.5 // 50% loss
                : 0, // Break even
            stats: {
              happiness: isSuccess ? 15 : isLoss ? -10 : 0,
              reputation: isSuccess ? 5 : 0,
            },
          },
        },
        {
          id: 'decline',
          text: 'Decline the opportunity',
          effects: {
            stats: {
              happiness: -2, // FOMO
            },
          },
        },
        {
          id: 'small',
          text: `Invest $${Math.floor(investmentAmount * 0.5).toLocaleString()} (smaller amount)`,
          effects: {
            money: isSuccess 
              ? investmentAmount * 0.75 // 50% return on smaller amount
              : isLoss 
                ? -investmentAmount * 0.25 // 50% loss on smaller amount
                : 0,
            stats: {
              happiness: isSuccess ? 8 : isLoss ? -5 : 0,
            },
          },
        },
      ],
    };
  },
};

/**
 * Job Offer Event
 * An opportunity for a better job
 */
export const jobOffer: EventTemplate = {
  id: 'job_offer',
  category: 'economy',
  weight: (state: GameState) => {
    const hasJob = !!state.currentJob;
    const reputation = state.stats.reputation || 0;
    // More likely if player has a job (shows they're employable) or high reputation (reduced frequency)
    return hasJob ? 0.1 : (reputation > 50 ? 0.08 : 0.05);
  },
  generate: (state: GameState) => {
    const jobCareer = (state.careers || []).find(c => c.id === state.currentJob && c.accepted);
    const currentSalary = jobCareer?.levels?.[jobCareer.level]?.salary || 0;
    const reputation = state.stats.reputation || 0;
    
    // New job offers 20-50% more salary based on reputation
    const salaryMultiplier = 1.2 + (reputation / 100) * 0.3;
    const newSalary = Math.floor(currentSalary * salaryMultiplier) || 500;
    
    return {
      id: 'job_offer',
      description: `You receive a job offer with a weekly salary of $${newSalary.toLocaleString()}. This is ${currentSalary > 0 ? `${Math.floor(((newSalary / currentSalary) - 1) * 100)}%` : 'significantly'} more than your current job.`,
      choices: [
        {
          id: 'accept',
          text: 'Accept the new job',
          effects: {
            stats: {
              happiness: 10,
              reputation: 5,
            },
          },
          // Note: Actual job change would be handled in the choice handler
        },
        {
          id: 'decline',
          text: 'Decline and stay at current job',
          effects: {
            stats: {
              happiness: -3,
            },
          },
        },
        {
          id: 'negotiate',
          text: 'Negotiate for even better terms',
          effects: {
            stats: {
              happiness: 5,
              reputation: 10, // Good negotiation skills
            },
          },
        },
      ],
    };
  },
};

/**
 * Relationship Crisis Event
 * A serious problem in a relationship
 */
export const relationshipCrisis: EventTemplate = {
  id: 'relationship_crisis',
  category: 'relationship',
  weight: (state: GameState) => {
    const relationships = state.relationships || [];
    if (relationships.length === 0) return 0;
    
    // Higher risk if relationship scores are low (reduced frequency)
    const avgScore = relationships.reduce((sum, r) => sum + r.relationshipScore, 0) / relationships.length;
    const risk = (50 - avgScore) / 50; // Higher risk with lower scores
    
    return Math.max(0, risk * 0.15); // Reduced from 0.3 to 0.15
  },
  generate: (state: GameState) => {
    const relationships = state.relationships || [];
    const hasPartner = relationships.some(r => r.type === 'partner');
    const money = state.stats.money || 0;
    
    return {
      id: 'relationship_crisis',
      description: hasPartner
        ? 'A serious crisis has occurred in your relationship. This needs immediate attention.'
        : 'A close relationship is in crisis. Your friend or family member needs your help.',
      choices: [
        {
          id: 'support',
          text: hasPartner ? 'Spend time and money to fix it ($200)' : 'Offer support ($100)',
          effects: {
            money: hasPartner ? -200 : -100,
            stats: {
              happiness: hasPartner ? 10 : 5,
            },
            relationship: hasPartner ? 20 : 15,
          },
        },
        {
          id: 'talk',
          text: 'Have a serious conversation',
          effects: {
            stats: {
              happiness: -5,
            },
            relationship: 10,
          },
        },
        {
          id: 'ignore',
          text: 'Give them space',
          effects: {
            stats: {
              happiness: -10,
            },
            relationship: -15,
          },
        },
      ],
    };
  },
};

/**
 * Legal Issue Event
 * A legal problem requiring attention
 */
export const legalIssue: EventTemplate = {
  id: 'legal_issue',
  category: 'general',
  weight: (state: GameState) => {
    const wantedLevel = state.wantedLevel || 0;
    const jailWeeks = state.jailWeeks || 0;
    // Higher risk if player has criminal activity (reduced frequency)
    return (wantedLevel > 0 || jailWeeks > 0) ? 0.2 : 0.05;
  },
  generate: (state: GameState) => {
    const money = state.stats.money || 0;
    const wantedLevel = state.wantedLevel || 0;
    const isCriminal = wantedLevel > 0;
    
    const legalCost = isCriminal ? 2000 : 500;
    
    return {
      id: 'legal_issue',
      description: isCriminal
        ? 'You\'re facing serious legal charges. You need a lawyer immediately.'
        : 'You\'ve been served with a legal notice. This requires attention.',
      choices: [
        {
          id: 'lawyer',
          text: `Hire a lawyer ($${legalCost.toLocaleString()})`,
          effects: {
            money: -legalCost,
            stats: {
              happiness: -10,
              reputation: isCriminal ? -5 : 0,
            },
          },
        },
        {
          id: 'defend',
          text: 'Defend yourself',
          effects: {
            stats: {
              happiness: -15,
              reputation: isCriminal ? -10 : -5,
            },
          },
        },
        {
          id: 'settle',
          text: isCriminal ? 'Plead guilty' : 'Settle out of court',
          effects: {
            money: -legalCost * 0.6,
            stats: {
              happiness: -5,
              reputation: -10,
            },
          },
        },
      ],
    };
  },
};

export const personalCrisisEventTemplates: EventTemplate[] = [
  medicalEmergency,
  identityTheft,
  investmentOpportunity,
  jobOffer,
  relationshipCrisis,
  legalIssue,
];

