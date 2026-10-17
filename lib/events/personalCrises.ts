import type { GameState } from '@/contexts/game/types';
import type { EventTemplate } from './engine';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';
import { generateEventDisease } from '@/lib/diseases/diseaseGenerator';
import { payloadRoll } from './seededPayload';

/**
 * Personal crisis events are high-impact events that affect individual players
 * based on their current state and risk factors
 */

/**
 * Calculate risk factor for medical emergencies
 * Higher risk if health is low, age is high, or lifestyle is poor
 */
function getMedicalRisk(state: GameState): number {
  // BUGFIX: `||` treats health=0 as falsy and inflates it to 100, so a dying
  // player gets ZERO medical risk in personal-crisis rolling — the opposite
  // of the desired behaviour.
  const health = state.stats?.health ?? 100;
  const age = state.date?.age ?? ADULTHOOD_AGE;
  const fitness = state.stats?.fitness ?? 0;
  
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
    // BUGFIX: `||` masks health=0 as 100, breaking the severity check below.
    const health = state.stats?.health ?? 100;
    // TODO(flawless-audit): there is no health-insurance system in state yet —
    // the only insurance the game models is per-vehicle (`Vehicle.insurance`).
    // The old `const hasInsurance = false` hardcode made the "covered cost"
    // branches dead code (every emergency was full price) while the treatment
    // copy still dangled a "with insurance" discount that could never apply.
    // Both are removed so the event is honest; wire a real health-insurance flag
    // in here when that feature ships.

    // Determine severity based on health
    const isSevere = health < 40;
    const cost = isSevere ? 5000 : 2000; // Full price — no health-insurance coverage exists yet

    // Generate potential disease from event
    const eventDisease = generateEventDisease('medical_emergency', state);
    // SEEDED (H7b): the coin flip below decides whether home remedies leave the
    // player with a DISEASE. Drawn inside the weekly `setGameState` updater, so
    // React 19's double invocation could hand the player either outcome and a
    // reload re-rolled it. Now a pure function of the week.
    const roll = payloadRoll(state, 'medical_emergency');
    const diseaseName = eventDisease ? eventDisease.name : null;
    
    return {
      id: 'medical_emergency',
      description: isSevere
        ? `A serious medical emergency has occurred! ${diseaseName ? `You've been diagnosed with ${diseaseName}.` : ''} You need immediate medical attention.`
        : `You've had a medical emergency requiring treatment.${diseaseName ? ` You've been diagnosed with ${diseaseName}.` : ''}`,
      choices: [
        {
          id: 'treat',
          text: `Seek treatment ($${cost.toLocaleString('en-US')})`,
          effects: {
            money: -cost,
            stats: {
              health: isSevere ? 30 : 15,
              happiness: -10,
            },
          },
          // No `add_disease`: paying for treatment is what stops the illness
          // taking hold. It used to add the disease 100% of the time - the same
          // as delaying, and worse than home remedies' coin flip - so the
          // $2,000-$5,000 option was the worst medical choice on the screen.
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
          // Whether the illness takes hold is rolled; the preview's disease
          // badge would otherwise tell the player which remedy is safe.
          outcomeHidden: true,
          effects: {
            money: -50,
            stats: {
              health: isSevere ? -5 : 5,
              happiness: -5,
            },
          },
          // Lower chance but still possible
          special: eventDisease && roll('home-remedy-disease') < 0.5 ? 'add_disease' : undefined,
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
    // Whole dollars: the copy used to print "$1,234.5" off a raw 30%.
    const investmentAmount = Math.floor(Math.min(money * 0.3, 2000)); // 30% or max $2000
    const smallAmount = Math.floor(investmentAmount * 0.5);

    // SEEDED per life (`payloadRoll`). This was a private `Math.sin` hash of
    // the week and year, so every life drew the same outcome in the same week -
    // the week-only roll CLAUDE.md §4.3 forbids for a life-affecting draw.
    const outcomeRoll = payloadRoll(state, 'investment_opportunity')('outcome');

    // 60% chance of success, 30% break even, 10% loss
    const isSuccess = outcomeRoll < 0.6;
    const isLoss = outcomeRoll >= 0.9;

    return {
      id: 'investment_opportunity',
      description: "A friend offers you an investment opportunity. It could be profitable, but there's risk involved.",
      choices: [
        {
          id: 'invest',
          text: `Invest $${investmentAmount.toLocaleString('en-US')}`,
          // Rolled at generation, so the preview must not show which way it
          // went; gated on the stake the text names.
          outcomeHidden: true,
          stake: investmentAmount,
          effects: {
            // Net-outcome model (the principal is never separately withdrawn):
            // success = +50% net, loss = -50% net, break-even = 0. The old
            // success value (+150%) handed back the principal you never paid.
            money: isSuccess
              ? Math.round(investmentAmount * 0.5) // net +50%
              : isLoss
                ? -Math.round(investmentAmount * 0.5) // 50% loss
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
          text: `Invest $${smallAmount.toLocaleString('en-US')} (smaller amount)`,
          outcomeHidden: true,
          stake: smallAmount,
          effects: {
            // The same +/-50% on the SMALL stake. This read 0.75x / 0.25x of the
            // BIG stake, so a success on the small bet paid 1.5x the big one.
            money: isSuccess
              ? Math.round(smallAmount * 0.5)
              : isLoss
                ? -Math.round(smallAmount * 0.5)
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
 * A one-off paid side contract (or, for the unemployed, a one-off project).
 * Kept under the `job_offer` id, which saves and the resolver's category list
 * already carry.
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
    
    // The fee is 120-150% of a week's pay, scaled by reputation
    const salaryMultiplier = 1.2 + (reputation / 100) * 0.3;
    const newSalary = Math.floor(currentSalary * salaryMultiplier) || 500;
    
    const employed = Boolean(jobCareer);

    return {
      id: 'job_offer',
      // The effect is a ONE-OFF payment and the job does not change - there is
      // no generic "switch to this job" hook - so the copy now says exactly
      // that. It used to promise "a real step up from your current pay" that
      // never arrived, and offered an unemployed player "Decline and stay at
      // current job".
      description: employed
        ? `A rival firm wants your expertise for a short side contract: $${newSalary.toLocaleString('en-US')} up front, and you keep your current job.`
        : `A local business needs an extra pair of hands for a one-off project and offers $${newSalary.toLocaleString('en-US')} for it.`,
      choices: [
        {
          id: 'accept',
          text: employed ? 'Take the contract' : 'Take the project',
          effects: {
            money: newSalary,
            stats: {
              happiness: 10,
              reputation: 5,
            },
          },
        },
        {
          id: 'decline',
          text: employed ? 'Decline and stay focused on your job' : 'Turn it down',
          effects: {
            stats: {
              happiness: -3,
            },
          },
        },
        {
          id: 'negotiate',
          // Pays nothing, so it is not "negotiate for better terms" - it is the
          // networking play the reputation reward actually describes.
          text: 'Pass for now, but keep in touch',
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
          text: `Hire a lawyer ($${legalCost.toLocaleString('en-US')})`,
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

