/**
 * Political Actions
 * 
 * Core political gameplay mechanics
 */
import { GameState, PoliticsState } from '../types';
import { initialGameState } from '../initialState';
import { logger } from '@/utils/logger';
import { updateMoney, applyMoneyDelta } from './MoneyActions';
import { updateStats } from './StatsActions';
import { POLITICAL_CAREER, POLITICAL_CAREER_REQUIREMENTS, canRunForOffice } from '@/lib/careers/political';
import { getPolicyById } from '@/lib/politics/policies';
import { getLobbyistById, policyDiscountFraction } from '@/lib/politics/lobbyists';
import { formatMoney } from '@/utils/moneyFormatting';
import { getNextElectionWeek } from '@/lib/politics/elections';
import type { Dispatch, SetStateAction } from 'react';
import { CAMPAIGN_MINIMUM_AMOUNT } from '@/lib/config/gameConstants';

// ---------------------------------------------------------------------------
// PoliticalApp Remake 5: PAC fundraising + scandal management
// ---------------------------------------------------------------------------
import {
  applySuppression,
  ensurePoliticsHasNewFields,
  pacRaiseClean,
  pacRaiseDirty,
  pacSpend,
} from '@/lib/politics/operations';
import { SEVERITY_PARAMS } from '@/lib/politics/scandals';

const log = logger.scope('PoliticalActions');

/**
 * Calculate aggregated active policy effects from all enacted policies
 */
function calculateActivePolicyEffects(policiesEnacted: string[]): PoliticsState['activePolicyEffects'] {
  const effects: PoliticsState['activePolicyEffects'] = {
    economy: { inflationRate: 0 },
    stocks: { volatilityModifier: 1, dividendBonus: 0 },
    realEstate: { priceModifier: 1, rentModifier: 1 },
    education: { weeksReduction: 0, costReduction: 0 },
    crypto: { miningBonus: 0, priceStability: 0 },
    technology: { rdBonus: 0, patentBonus: 0 },
    healthcare: { healthBonus: 0, medicalCostReduction: 0 },
    transportation: { travelCostReduction: 0 },
  };

  policiesEnacted.forEach(policyId => {
    const policy = getPolicyById(policyId);
    if (!policy) return;

    // Aggregate economy effects.
    //
    // R4-X7: this block did not exist. `economy.inflationRate` was declared on
    // the policy schema, carried by three policies (+2%, +3%, +2%) and rendered
    // on the policy card as "Inflation +2.0%" before the player paid six
    // figures to enact it — and the aggregator had no `economy` slice, so
    // nothing downstream could read it even in principle.
    //
    // Summed and clamped to ±5 POINTS of annual rate. These are deltas on the
    // base rate, not multipliers, and `applyWeeklyInflation` re-clamps the
    // total to MAX_ANNUAL_INFLATION so a stack cannot run the price index away.
    if (policy.effects.economy?.inflationRate !== undefined && effects.economy) {
      const delta = Number(policy.effects.economy.inflationRate);
      if (Number.isFinite(delta)) {
        effects.economy.inflationRate = Math.max(
          -0.05,
          Math.min(0.05, effects.economy.inflationRate + delta),
        );
      }
    }

    // Aggregate stock effects
    if (policy.effects.stocks && effects.stocks) {
      if (policy.effects.stocks.volatilityModifier !== undefined) {
        effects.stocks.volatilityModifier *= policy.effects.stocks.volatilityModifier;
      }
      if (policy.effects.stocks.dividendBonus !== undefined) {
        effects.stocks.dividendBonus += policy.effects.stocks.dividendBonus;
      }
      if (policy.effects.stocks.companyBoost) {
        effects.stocks.companyBoost = [
          ...(effects.stocks.companyBoost || []),
          ...policy.effects.stocks.companyBoost,
        ];
      }
    }

    // Aggregate real estate effects
    if (policy.effects.realEstate && effects.realEstate) {
      if (policy.effects.realEstate.priceModifier !== undefined) {
        effects.realEstate.priceModifier *= policy.effects.realEstate.priceModifier;
      }
      if (policy.effects.realEstate.rentModifier !== undefined) {
        effects.realEstate.rentModifier *= policy.effects.realEstate.rentModifier;
      }
      if (policy.effects.realEstate.propertyTaxRate !== undefined) {
        effects.realEstate.propertyTaxRate = (effects.realEstate.propertyTaxRate || 0) + policy.effects.realEstate.propertyTaxRate;
      }
    }

    // Aggregate education effects (take maximum for weeks reduction, sum for cost reduction)
    if (policy.effects.education && effects.education) {
      if (policy.effects.education.weeksReduction !== undefined) {
        effects.education.weeksReduction = Math.max(
          effects.education.weeksReduction || 0,
          policy.effects.education.weeksReduction
        );
      }
      if (policy.effects.education.costReduction !== undefined) {
        effects.education.costReduction = Math.min(
          50,
          (effects.education.costReduction || 0) + policy.effects.education.costReduction
        );
      }
      if (policy.effects.education.scholarshipAmount !== undefined) {
        effects.education.scholarshipAmount = (effects.education.scholarshipAmount || 0) + policy.effects.education.scholarshipAmount;
      }
    }

    // Aggregate crypto effects
    if (policy.effects.crypto && effects.crypto) {
      if (policy.effects.crypto.miningBonus !== undefined) {
        effects.crypto.miningBonus += policy.effects.crypto.miningBonus;
      }
      if (policy.effects.crypto.priceStability !== undefined) {
        effects.crypto.priceStability = Math.min(1, (effects.crypto.priceStability || 0) + policy.effects.crypto.priceStability);
      }
      if (policy.effects.crypto.regulationLevel !== undefined) {
        effects.crypto.regulationLevel = (effects.crypto.regulationLevel || 0) + policy.effects.crypto.regulationLevel;
      }
    }

    // Aggregate technology effects
    if (policy.effects.technology && effects.technology) {
      if (policy.effects.technology.rdBonus !== undefined) {
        effects.technology.rdBonus += policy.effects.technology.rdBonus;
      }
      if (policy.effects.technology.patentBonus !== undefined) {
        effects.technology.patentBonus += policy.effects.technology.patentBonus;
      }
      if (policy.effects.technology.innovationGrants !== undefined) {
        effects.technology.innovationGrants = (effects.technology.innovationGrants || 0) + policy.effects.technology.innovationGrants;
      }
    }

    // Aggregate healthcare effects
    if (policy.effects.healthcare && effects.healthcare) {
      if (policy.effects.healthcare.healthBonus !== undefined) {
        effects.healthcare.healthBonus += policy.effects.healthcare.healthBonus;
      }
      if (policy.effects.healthcare.medicalCostReduction !== undefined) {
        effects.healthcare.medicalCostReduction = Math.min(
          50,
          (effects.healthcare.medicalCostReduction || 0) + policy.effects.healthcare.medicalCostReduction
        );
      }
    }

    // Aggregate transportation effects
    if (policy.effects.transportation && effects.transportation) {
      if (policy.effects.transportation.travelCostReduction !== undefined) {
        effects.transportation.travelCostReduction = Math.min(
          50,
          (effects.transportation.travelCostReduction || 0) + policy.effects.transportation.travelCostReduction
        );
      }
      if (policy.effects.transportation.commuteTimeReduction !== undefined) {
        effects.transportation.commuteTimeReduction = Math.min(
          50,
          (effects.transportation.commuteTimeReduction || 0) + policy.effects.transportation.commuteTimeReduction
        );
      }
    }
  });

  return effects;
}

export const runForOffice = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  office: 'council_member' | 'mayor' | 'state_representative' | 'governor' | 'senator' | 'president',
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  const politics = gameState.politics || {
    careerLevel: 0,
    approvalRating: 50,
    policyInfluence: 0,
    electionsWon: 0,
    policiesEnacted: [],
    lobbyists: [],
    alliances: [],
    campaignFunds: 0,
  };

  const requirements = POLITICAL_CAREER_REQUIREMENTS[office];
  if (!requirements) {
    log.error(`Unknown office: ${office}`);
    return { success: false, message: `Unknown office: ${office}` };
  }
  let career = gameState.careers.find(c => c.id === 'political');
  
  // Create political career if it doesn't exist
  if (!career) {
    const newCareer = {
      ...POLITICAL_CAREER,
      level: 0,
      progress: 0,
      applied: false,
      accepted: false,
    };
    setGameState(prev => ({
      ...prev,
      careers: [...(prev.careers || []), newCareer],
    }));
    career = newCareer;
  }

  // Check if can run for office
  const hasEducation = (id: string) => 
    (gameState.educations || []).some(e => e.id === id && e.completed);
  
  // Weeks served in the CURRENT office. Prefer the real tenure counter
  // (`startedWeeksLived`, stamped on each election win below) so the upper rungs —
  // whose `minWeeksInPrevious` (104/208/260) exceed the 0–100 `progress` ceiling —
  // are actually reachable. A sitting official is level 0 for Council, so gate on
  // `accepted` (NOT `level > 0`) or their served weeks are wrongly zeroed and the
  // ladder dead-ends at Council. Fall back to `progress` for pre-fix saves with no
  // `startedWeeksLived` yet (enough to clear the 52-week Mayor gate).
  const weeksInCurrentLevel = career.accepted
    ? (typeof career.startedWeeksLived === 'number'
        ? Math.max(0, (gameState.weeksLived || 0) - career.startedWeeksLived)
        : (career.progress || 0))
    : 0;
  
  // Check requirements individually to provide specific error messages
  if (gameState.date.age < requirements.minAge) {
    return { success: false, message: `You must be at least ${requirements.minAge} years old to run for this office. You are ${Math.floor(gameState.date.age)} years old.` };
  }
  
  if (gameState.stats.reputation < requirements.minReputation) {
    return { success: false, message: `You need at least ${requirements.minReputation} reputation to run for this office. You have ${gameState.stats.reputation} reputation.` };
  }
  
  if ('education' in requirements && requirements.education) {
    const missingEducation = requirements.education.filter(edu => !hasEducation(edu));
    if (missingEducation.length > 0) {
      const educationNames: Record<string, string> = {
        business_degree: 'Business Degree',
        law_degree: 'Law Degree',
        political_science: 'Political Science Degree',
      };
      const missingNames = missingEducation.map(edu => educationNames[edu] || edu).join(', ');
      return { success: false, message: `You need the following education: ${missingNames}` };
    }
  }
  
  // Reject running for an office you already hold (or a higher one). Without
  // this, a sitting Council Member (which has no previousLevel prerequisite)
  // could re-run for council_member every week and net the reward minus the
  // campaign cost each time (a cash + approval + electionsWon farm). Gate on
  // `accepted` so a never-elected player (level 0, not accepted) can still run
  // for their first seat.
  const OFFICE_LEVEL: Record<string, number> = {
    council_member: 0, mayor: 1, state_representative: 2, governor: 3, senator: 4, president: 5,
  };
  const heldPoliticalCareer = gameState.careers?.find(c => c.id === 'political');
  const targetOfficeLevel = OFFICE_LEVEL[office];
  if (
    heldPoliticalCareer?.accepted &&
    typeof targetOfficeLevel === 'number' &&
    (heldPoliticalCareer.level ?? 0) >= targetOfficeLevel
  ) {
    return { success: false, message: 'You already hold this office (or a higher one).' };
  }

  if ('previousLevel' in requirements && requirements.previousLevel) {
    // Safe to use non-null assertion here because we checked requirements.previousLevel exists above
    const previousLevelStr = requirements.previousLevel;
    // Safe string split - ensure string is not empty
    const levelPrefix = previousLevelStr && previousLevelStr.length > 0
      ? previousLevelStr.split('_')[0]
      : '';
    
    const previousLevelIndex = levelPrefix
      ? POLITICAL_CAREER.levels.findIndex(
          l => l.name.toLowerCase().includes(levelPrefix)
        )
      : -1;
    
    // CRITICAL: Check if findIndex found a valid index (not -1) before accessing array.
    // Must have REACHED the prerequisite level, not exceeded it — `<=` rejected a
    // sitting Council Member (level 0) from running for Mayor (prereq index 0),
    // making the ladder above Council unwinnable.
    if (previousLevelIndex >= 0 && career.level < previousLevelIndex) {
      const previousOfficeName = POLITICAL_CAREER.levels[previousLevelIndex]?.name || requirements.previousLevel;
      return { success: false, message: `You must first serve as ${previousOfficeName} before running for this office.` };
    }
    if ('minWeeksInPrevious' in requirements && requirements.minWeeksInPrevious && weeksInCurrentLevel < requirements.minWeeksInPrevious) {
      const weeksNeeded = requirements.minWeeksInPrevious - weeksInCurrentLevel;
      return { success: false, message: `You need ${weeksNeeded} more weeks in your current position before running for this office.` };
    }
  }
  
  // Final check using canRunForOffice for safety
  if (!canRunForOffice(
    office,
    gameState.date.age,
    gameState.stats.reputation,
    career.level,
    weeksInCurrentLevel,
    hasEducation
  )) {
    return { success: false, message: 'You do not meet the requirements for this office' };
  }

  // Calculate campaign cost (based on office level)
  const campaignCosts = {
    council_member: 5000,
    mayor: 20000,
    state_representative: 50000,
    governor: 200000,
    senator: 500000,
    president: 2000000,
  };

  const campaignCost = campaignCosts[office];
  
  if (gameState.stats.money < campaignCost) {
    return {
      success: false,
      message: `Need ${formatMoney(campaignCost)} to run for ${office} — you have ${formatMoney(gameState.stats.money)} (${formatMoney(campaignCost - gameState.stats.money)} short).`,
    };
  }

  // One campaign per week: catches a sequential duplicate tap with an honest
  // message instead of rolling a second election. A SAME-BATCH duplicate (both
  // taps sharing a stale snapshot) is caught by the in-updater
  // lastElectionAttemptWeek re-check below; its return message stays
  // optimistic, consistent with the other atomic action fixes.
  if (gameState.politics?.lastElectionAttemptWeek === gameState.weeksLived) {
    return { success: false, message: 'You already ran a campaign this week. Try again next week.' };
  }

  // Pre-roll impure values before updater
  const electionRoll = Math.random() * 100;

  // Calculate election success chance (based on approval rating, reputation, karma, and campaign funds)
  const baseChance = 50;
  const approvalBonus = politics.approvalRating * 0.3;
  const reputationBonus = gameState.stats.reputation * 0.2;
  let karmaApprovalBonus = 0;
  if (gameState.karma) {
    const { getKarmaModifiers } = require('@/lib/karma/karmaSystem');
    karmaApprovalBonus = getKarmaModifiers(gameState.karma).politicalApprovalModifier;
  }
  const successChance = Math.min(95, baseChance + approvalBonus + reputationBonus + karmaApprovalBonus);

  const won = electionRoll < successChance;
  // Hoisted above the win/loss split: both branches stamp `lastElectionAttemptWeek`
  // with this value to dedupe same-batch duplicate invocations.
  const currentWeek = gameState.weeksLived;

  if (won) {
    // Determine new level based on office
    const levelMap: Record<string, number> = {
      council_member: 0,
      mayor: 1,
      state_representative: 2,
      governor: 3,
      senator: 4,
      president: 5,
    };

    const newLevel = levelMap[office];
    const nextElection = getNextElectionWeek(currentWeek, newLevel as 0 | 1 | 2 | 3 | 4 | 5, currentWeek);

    // Calculate election win reward based on office level
    const electionRewards: Record<string, number> = {
      council_member: 10000,
      mayor: 50000,
      state_representative: 150000,
      governor: 500000,
      senator: 1000000,
      president: 5000000,
    };

    const reward = electionRewards[office] || 0;

    // Atomic: merge campaign cost + election reward + politics update into single update.
    // R-audit 2026-07-02: the outer age/reputation/money gates read the stale render-time
    // `gameState`, so two same-batch taps both passed them and both applied the (up to $5M)
    // election reward. Re-check affordability AND idempotency against `prev` — the first tap
    // stamps `lastElectionAttemptWeek`, so ANY second tap this week (win, loss, or mixed roll)
    // no-ops instead of double-paying / double-charging. (minWeeksInPrevious already prevents
    // a legitimate second office run in the same week.)
    setGameState(prev => {
      if ((prev.stats?.money ?? 0) < campaignCost) return prev;
      if (prev.politics?.lastElectionAttemptWeek === currentWeek) return prev;
      return {
      ...prev,
      stats: {
        ...prev.stats,
        money: Math.max(0, prev.stats.money - campaignCost + reward),
      },
      careers: prev.careers.map(c => {
        if (c.id !== 'political') return c;
        return {
          ...c,
          // career.level is the 0-based index into POLITICAL_CAREER.levels
          // (Council=0 … President=5), used for salary. accepted:true marks the
          // office as held so the Politics app + salary treat it as a real job.
          level: newLevel,
          progress: 0,
          applied: true,
          accepted: true,
          // Stamp when this term began so `weeksInCurrentLevel` measures real
          // tenure — this is what makes the minWeeksInPrevious gates on the upper
          // rungs (Mayor→…→President) satisfiable.
          startedWeeksLived: currentWeek,
        };
      }),
      politics: {
        ...prev.politics || {
          careerLevel: 0,
          approvalRating: 50,
          policyInfluence: 0,
          electionsWon: 0,
          policiesEnacted: [],
          activePolicies: [],
          lobbyists: [],
          alliances: [],
          campaignFunds: 0,
        },
        // politics.careerLevel is the 1-based office RANK (0=Citizen, 1=Council
        // … 6=President) — matches OFFICE_NAME and unlocks the scandal tick +
        // political events (all gated on careerLevel > 0). It is deliberately
        // career.level + 1.
        careerLevel: newLevel + 1,
        electionsWon: (prev.politics?.electionsWon || 0) + 1,
        approvalRating: Math.min(100, (prev.politics?.approvalRating ?? 50) + 10),
        lastElectionWeek: currentWeek,
        lastElectionAttemptWeek: currentWeek,
        nextElectionWeek: nextElection,
      },
      currentJob: 'political',
      // Open a careerHistory entry for the office, mirroring what
      // JobActions does on accepting an ordinary job. `updateCareerHistory`
      // only ever accumulates into an EXISTING open entry — it never creates
      // one — so without this a politician's weeks and earnings had nowhere to
      // land, and the retirement path had no entry to close. Idempotent: a
      // re-election while already in office must not open a second entry.
      // 2026-07-28 audit GL-3.
      lifetimeStatistics: prev.lifetimeStatistics
        ? {
            ...prev.lifetimeStatistics,
            careerHistory: (prev.lifetimeStatistics.careerHistory || []).some(
              (e) => e.job === 'political' && e.endWeek === undefined,
            )
              ? prev.lifetimeStatistics.careerHistory || []
              : [
                  ...(prev.lifetimeStatistics.careerHistory || []),
                  {
                    job: 'political',
                    weeks: 0,
                    earnings: 0,
                    startWeek: prev.weeksLived || 0,
                  },
                ],
          }
        : prev.lifetimeStatistics,
      };
    });

    log.info(`Won election for ${office}, now at level ${newLevel}, reward: $${reward}`);
    const rewardMessage = reward > 0 ? ` You received $${reward.toLocaleString()} as an election bonus!` : '';
    // Validate newLevel is within bounds before accessing levels array
    const safeLevel = Math.max(0, Math.min(newLevel, POLITICAL_CAREER.levels.length - 1));
    const levelName = POLITICAL_CAREER.levels[safeLevel]?.name || 'Unknown Office';
    return { success: true, message: `Congratulations! You won the election and are now ${levelName}!${rewardMessage}` };
  } else {
    // Lost election - deduct campaign cost + small approval hit.
    // Re-check funds AND the per-week attempt marker against `prev` so a same-batch
    // double-tap (lose+lose, or a win followed by an independently-rolled loss) can't
    // over-charge — any second attempt this week no-ops.
    setGameState(prev => {
      if ((prev.stats?.money ?? 0) < campaignCost) return prev;
      if (prev.politics?.lastElectionAttemptWeek === currentWeek) return prev;
      return {
      ...prev,
      stats: {
        ...prev.stats,
        money: Math.max(0, prev.stats.money - campaignCost),
      },
      politics: {
        ...prev.politics || {
          careerLevel: 0,
          approvalRating: 50,
          policyInfluence: 0,
          electionsWon: 0,
          policiesEnacted: [],
          lobbyists: [],
          alliances: [],
          campaignFunds: 0,
        },
        approvalRating: Math.max(0, (prev.politics?.approvalRating ?? 50) - 5),
        lastElectionAttemptWeek: currentWeek,
      },
      };
    });

    log.info(`Lost election for ${office}`);
    return { success: false, message: 'You lost the election. Better luck next time!' };
  }
};

export const enactPolicy = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  policyId: string,
  deps: { updateMoney: typeof updateMoney; updateStats: typeof updateStats }
): { success: boolean; message: string } => {
  const politics = gameState.politics || {
    careerLevel: 0,
    approvalRating: 50,
    policyInfluence: 0,
    electionsWon: 0,
    policiesEnacted: [],
    lobbyists: [],
    alliances: [],
    campaignFunds: 0,
  };

  const policy = getPolicyById(policyId);
  if (!policy) {
    return { success: false, message: 'Policy not found' };
  }

  // Check if player has required level
  if (politics.careerLevel < policy.requiredLevel) {
    return { success: false, message: `You need to be at level ${policy.requiredLevel} to enact this policy` };
  }

  // Check if already enacted
  if (politics.policiesEnacted.includes(policyId)) {
    return { success: false, message: 'This policy is already enacted' };
  }

  // Policy Influence finally does something: it discounts the implementation
  // cost (up to 25% off, reached at influence >= 25). Before this it was a pure
  // vanity stat — accumulated by enact/lobby/hireLobbyist but never spent or
  // checked by any politics mechanic.
  //
  // Stacked on top of that, up to a further 15%: the influence of hired
  // lobbyists who actually SPECIALISE in this policy's type. `specialty` was
  // rendered in three places in `PoliticalApp` and read by nothing — the one
  // function that consumed it had zero call sites — so choosing the
  // Environmental Advocate over the Criminal Justice Expert for a green bill
  // changed the copy and no number. It changes the price now.
  //
  // Both terms take the WHOLE politics slice so the pre-check and the in-updater
  // re-check cannot drift: a discount computed from the stale snapshot and
  // charged from `prev` is the gate-then-grant shape (CLAUDE.md §4.4).
  const influenceCost = (p: GameState['politics'] | undefined): number => {
    const discount = policyDiscountFraction(
      p?.policyInfluence,
      (p?.lobbyists || []).map((l) => l?.id).filter((id): id is string => typeof id === 'string'),
      policy.type,
    );
    return Math.max(0, Math.round((policy.implementationCost || 0) * (1 - discount)));
  };

  // Check implementation cost (after the influence discount).
  const discountedCost = influenceCost(politics);
  if (gameState.stats.money < discountedCost) {
    return {
      success: false,
      message: `Need ${formatMoney(discountedCost)} to implement this policy — you have ${formatMoney(gameState.stats.money)} (${formatMoney(discountedCost - gameState.stats.money)} short).`,
    };
  }

  // Atomic: merge cost + stats effects + politics update into single update.
  // All derived values are recomputed from `prev` INSIDE the updater so a rapid
  // double-tap can't double-enact: the precondition checks above read the stale
  // snapshot arg, so two taps both pass before either commits. The guards here
  // re-check against fresh `prev` and no-op, preventing a duplicate policy entry
  // and double-applied money/stat effects.
  setGameState(prev => {
    const prevPolitics = prev.politics;
    if (prevPolitics?.policiesEnacted?.includes(policyId)) return prev;
    if ((prev.stats?.money || 0) < influenceCost(prev.politics)) return prev;

    const updatedPoliciesEnacted = [...(prevPolitics?.policiesEnacted || []), policyId];
    const activePolicyEffects = calculateActivePolicyEffects(updatedPoliciesEnacted);
    const newApproval = Math.max(0, Math.min(100, (prevPolitics?.approvalRating ?? 50) + policy.approvalImpact));

    return {
      ...prev,
      stats: {
        ...prev.stats,
        // TODO(flawless-audit): weekly policy effects need a tick reducer.
        // policy.effects.money is applied exactly ONCE here at enactment, never
        // as a recurring weekly stream — the catalog copy is worded as one-time
        // to match. A true recurring payout would hook a per-week politics tick.
        money: Math.max(0, prev.stats.money - influenceCost(prev.politics) + (policy.effects.money || 0)),
        happiness: Math.max(0, Math.min(100, (prev.stats.happiness || 0) + (policy.effects.happiness || 0))),
        health: Math.max(0, Math.min(100, (prev.stats.health || 0) + (policy.effects.health || 0))),
        reputation: Math.max(0, Math.min(100, (prev.stats.reputation || 0) + (policy.effects.reputation || 0))),
      },
      politics: {
        ...prevPolitics || {
          careerLevel: 0,
          approvalRating: 50,
          policyInfluence: 0,
          electionsWon: 0,
          policiesEnacted: [],
          activePolicies: [],
          lobbyists: [],
          alliances: [],
          campaignFunds: 0,
        },
        approvalRating: newApproval,
        policiesEnacted: updatedPoliciesEnacted,
        activePolicies: [
          ...(prevPolitics?.activePolicies || []),
          {
            policyId,
            enactedWeek: prev.weeksLived || 0,
            expiresWeek: policy.duration ? (prev.weeksLived || 0) + policy.duration : undefined,
          },
        ],
        policyInfluence: Math.min(100, (prevPolitics?.policyInfluence || 0) + 5),
        activePolicyEffects,
      },
    };
  });

  log.info(`Enacted policy: ${policy.name}`);
  return { success: true, message: `Policy "${policy.name}" has been enacted!` };
};

export const lobby = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  policyId: string,
  amount: number,
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  const policy = getPolicyById(policyId);
  if (!policy) {
    return { success: false, message: 'Policy not found' };
  }

  if (gameState.stats.money < amount) {
    return {
      success: false,
      message: `Need ${formatMoney(amount)} to lobby — you have ${formatMoney(gameState.stats.money)} (${formatMoney(amount - gameState.stats.money)} short).`,
    };
  }

  if (amount < 1000) {
    return { success: false, message: 'Minimum lobbying amount is $1,000' };
  }

  // Increase policy influence (lobbying makes policies easier to pass)
  // Any real spend must buy at least +1 influence (capped at 10). The old
  // floor(amount/10000) granted 0 for a $1,000–$9,999 spend — money gone, no effect.
  const influenceGain = amount > 0 ? Math.min(10, Math.max(1, Math.round(amount / 10000))) : 0;

  // ECON-3: REJECT an unaffordable spend, don't floor it. `Math.max(0, money -
  // amount)` let two same-batch taps both pass the stale outer affordability
  // gate and both apply their effect while the second debit silently clamped to
  // 0 — 2x policy influence for 1x cash. `MoneyActions` records this exact
  // class: "the goods were granted and the money just zeroed out". The sibling
  // actions `runForElection` and `enactPolicy` were fixed in the 2026-07-02
  // audit; these three were left behind. 2026-07-30 audit.
  // The outer guards above are the reported outcome; the `return prev` below is
  // the same-batch RACE guard for STATE. A `let applied` flag used to be read
  // back after the dispatch, which is only reliable for the FIRST functional
  // update of a React batch — so a legitimate spend that was not first reported
  // "you cannot afford ..." for money it had just spent (2026-08-15).
  setGameState(prev => {
    const spend = applyMoneyDelta(prev, -amount, 'Lobbying');
    if (!spend) return prev;
    return {
    ...prev,
    ...spend,
    politics: {
      ...prev.politics || {
        careerLevel: 0,
        approvalRating: 50,
        policyInfluence: 0,
        electionsWon: 0,
        policiesEnacted: [],
        lobbyists: [],
        alliances: [],
        campaignFunds: 0,
      },
      policyInfluence: Math.min(100, (prev.politics?.policyInfluence || 0) + influenceGain),
    },
    };
  });

  log.info(`Lobbied for ${policy.name} with $${amount}`);
  return { success: true, message: `Lobbied for ${policy.name}. Policy influence increased!` };
};

export const joinParty = (
  _gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  party: 'democratic' | 'republican' | 'independent'
): { success: boolean; message: string } => {
  setGameState(prev => ({
    ...prev,
    politics: {
      ...prev.politics || {
        careerLevel: 0,
        approvalRating: 50,
        policyInfluence: 0,
        electionsWon: 0,
        policiesEnacted: [],
        lobbyists: [],
        alliances: [],
        campaignFunds: 0,
      },
      party,
      approvalRating: Math.min(100, (prev.politics?.approvalRating ?? 50) + 5),
    },
  }));

  log.info(`Joined ${party} party`);
  return { success: true, message: `You joined the ${party} party!` };
};

export const formAlliance = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  characterId: string,
  characterName: string
): { success: boolean; message: string } => {
  const politics = gameState.politics || {
    careerLevel: 0,
    approvalRating: 50,
    policyInfluence: 0,
    electionsWon: 0,
    policiesEnacted: [],
    lobbyists: [],
    alliances: [],
    campaignFunds: 0,
  };

  // Check if already allied
  if (politics.alliances.some(a => a.characterId === characterId)) {
    return { success: false, message: 'You already have an alliance with this character' };
  }

  const allianceTimestamp = Date.now();
  setGameState(prev => ({
    ...prev,
    politics: {
      ...prev.politics || {
        careerLevel: 0,
        approvalRating: 50,
        policyInfluence: 0,
        electionsWon: 0,
        policiesEnacted: [],
        lobbyists: [],
        alliances: [],
        campaignFunds: 0,
      },
      alliances: [
        ...(prev.politics?.alliances || []),
        {
          id: `alliance_${characterId}_${allianceTimestamp}`,
          characterId,
          name: characterName,
          influence: 10,
          formedWeek: prev.weeksLived || 0,
        },
      ],
      approvalRating: Math.min(100, (prev.politics?.approvalRating ?? 50) + 3),
    },
  }));

  log.info(`Formed alliance with ${characterName}`);
  return { success: true, message: `Formed political alliance with ${characterName}!` };
};

export const campaign = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  amount: number,
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  if (gameState.stats.money < amount) {
    return {
      success: false,
      message: `Need ${formatMoney(amount)} to fund this campaign — you have ${formatMoney(gameState.stats.money)} (${formatMoney(amount - gameState.stats.money)} short).`,
    };
  }

  if (amount < CAMPAIGN_MINIMUM_AMOUNT) {
    return { success: false, message: `Minimum campaign amount is $${CAMPAIGN_MINIMUM_AMOUNT}` };
  }

  // Increase approval rating (diminishing returns)
  // Any real spend must buy at least +1 approval (capped at 10). The old
  // floor(amount/5000) granted 0 for a $500–$4,999 spend — money gone, no effect.
  const approvalGain = amount > 0 ? Math.min(10, Math.max(1, Math.round(amount / 5000))) : 0;

  // ECON-3: reject rather than floor — see `lobby` above.
  // The outer guards above are the reported outcome; the `return prev` below is
  // the same-batch RACE guard for STATE. A `let applied` flag used to be read
  // back after the dispatch, which is only reliable for the FIRST functional
  // update of a React batch — so a legitimate spend that was not first reported
  // "you cannot afford ..." for money it had just spent (2026-08-15).
  setGameState(prev => {
    const spend = applyMoneyDelta(prev, -amount, 'Campaign spending');
    if (!spend) return prev;
    return {
    ...prev,
    ...spend,
    politics: {
      ...prev.politics || {
        careerLevel: 0,
        approvalRating: 50,
        policyInfluence: 0,
        electionsWon: 0,
        policiesEnacted: [],
        lobbyists: [],
        alliances: [],
        campaignFunds: 0,
      },
      approvalRating: Math.min(100, (prev.politics?.approvalRating ?? 50) + approvalGain),
      campaignFunds: (prev.politics?.campaignFunds || 0) + amount,
    },
    };
  });

  log.info(`Campaign spending: $${amount}, approval gain: ${approvalGain}`);
  return { success: true, message: `Campaign spending increased your approval rating by ${approvalGain}!` };
};

export const hireLobbyist = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  lobbyistId: string,
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string } => {
  const politics = gameState.politics || {
    careerLevel: 0,
    approvalRating: 50,
    policyInfluence: 0,
    electionsWon: 0,
    policiesEnacted: [],
    lobbyists: [],
    alliances: [],
    campaignFunds: 0,
  };

  const lobbyist = getLobbyistById(lobbyistId);
  if (!lobbyist) {
    return { success: false, message: 'Lobbyist not found' };
  }

  // Check if already hired
  if (politics.lobbyists.some(l => l.id === lobbyistId)) {
    return { success: false, message: 'This lobbyist is already hired' };
  }

  // Check if player has enough money
  if (gameState.stats.money < lobbyist.cost) {
    return {
      success: false,
      message: `Hiring ${lobbyist.name} costs ${formatMoney(lobbyist.cost)} — you have ${formatMoney(gameState.stats.money)} (${formatMoney(lobbyist.cost - gameState.stats.money)} short).`,
    };
  }

  // Add lobbyist to list
  const newLobbyist = {
    id: lobbyist.id,
    name: lobbyist.name,
    cost: lobbyist.cost,
    influence: lobbyist.influence,
    active: true,
  };

  // ECON-3: reject rather than floor, AND re-check the already-hired gate.
  // The picker renders every catalogue lobbyist as its own row with
  // `affordable` computed from the render snapshot, so with cash for exactly
  // one retainer two taps hired two lobbyists — the second free, its influence
  // permanent. Tapping the SAME row twice appended a duplicate entry while
  // `fireLobbyist` only ever subtracts one lobbyist's influence.
  // The outer guards above are the reported outcome; the `return prev` below is
  // the same-batch RACE guard for STATE. A `let applied` flag used to be read
  // back after the dispatch, which is only reliable for the FIRST functional
  // update of a React batch — so a legitimate spend that was not first reported
  // "you cannot afford ..." for money it had just spent (2026-08-15).
  setGameState(prev => {
    if ((prev.politics?.lobbyists || []).some((l) => l?.id === newLobbyist.id)) return prev;
    const spend = applyMoneyDelta(prev, -lobbyist.cost, `Hire lobbyist: ${lobbyist.name}`);
    if (!spend) return prev;
    return {
    ...prev,
    ...spend,
    politics: {
      ...prev.politics || {
        careerLevel: 0,
        approvalRating: 50,
        policyInfluence: 0,
        electionsWon: 0,
        policiesEnacted: [],
        lobbyists: [],
        alliances: [],
        campaignFunds: 0,
      },
      lobbyists: [...(prev.politics?.lobbyists || []), newLobbyist],
      policyInfluence: Math.min(100, (prev.politics?.policyInfluence || 0) + lobbyist.influence),
    },
    };
  });

  log.info(`Hired lobbyist: ${lobbyist.name}`);
  return { success: true, message: `Successfully hired ${lobbyist.name}! Policy influence increased by ${lobbyist.influence}.` };
};

export const fireLobbyist = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  lobbyistId: string
): { success: boolean; message: string } => {
  const politics = gameState.politics || {
    careerLevel: 0,
    approvalRating: 50,
    policyInfluence: 0,
    electionsWon: 0,
    policiesEnacted: [],
    lobbyists: [],
    alliances: [],
    campaignFunds: 0,
  };

  const lobbyist = politics.lobbyists.find(l => l.id === lobbyistId);
  if (!lobbyist) {
    return { success: false, message: 'Lobbyist not found' };
  }

  // Remove lobbyist and recalculate influence
  const remainingLobbyists = politics.lobbyists.filter(l => l.id !== lobbyistId);
  setGameState(prev => ({
    ...prev,
    politics: {
      ...prev.politics || {
        careerLevel: 0,
        approvalRating: 50,
        policyInfluence: 0,
        electionsWon: 0,
        policiesEnacted: [],
        lobbyists: [],
        alliances: [],
        campaignFunds: 0,
      },
      lobbyists: remainingLobbyists,
      // Only remove the fired lobbyist's contribution. Recomputing influence from
      // just the remaining lobbyists discarded the +5/policy and campaign
      // influence, which could un-earn the "≥50 influence" achievement.
      policyInfluence: Math.max(0, Math.min(100, (prev.politics?.policyInfluence ?? 0) - lobbyist.influence)),
    },
  }));

  log.info(`Fired lobbyist: ${lobbyist.name}`);
  return { success: true, message: `Fired ${lobbyist.name}. Policy influence decreased by ${lobbyist.influence}.` };
};

// Export calculateActivePolicyEffects for use in GameActionsContext
export { calculateActivePolicyEffects };

/**
 * Raise PAC funds from the player's cash. 100% conversion.
 */
export const raisePACClean = (
  setGameState: Dispatch<SetStateAction<GameState>>,
  amountUSD: number
) => {
  setGameState((prev) => {
    const cash = prev.stats?.money ?? 0;
    if (amountUSD <= 0 || amountUSD > cash) {
      log.warn(`PAC raise rejected: amount=${amountUSD}, cash=${cash}`);
      return prev;
    }
    const politics = ensurePoliticsHasNewFields(prev.politics ?? initialGameState.politics!);
    const next = pacRaiseClean(politics, amountUSD, prev.weeksLived);
    return {
      ...prev,
      stats: { ...prev.stats, money: cash - amountUSD },
      politics: next,
    };
  });
};

/**
 * Raise PAC funds from clean dark-web BTC. Moves BTC out of the player's
 * regular wallet at the current price; raises lifetimeDirtyUSD which feeds
 * scandal probability forever.
 */
export const raisePACDirty = (
  setGameState: Dispatch<SetStateAction<GameState>>,
  btcAmount: number
) => {
  setGameState((prev) => {
    const btc = prev.cryptos.find((c) => c.id === 'btc');
    const owned = btc?.owned ?? 0;
    if (btcAmount <= 0 || btcAmount > owned) {
      log.warn(`Dirty PAC raise rejected: amount=${btcAmount}, owned=${owned}`);
      return prev;
    }
    const price = btc?.price ?? 0;
    const politics = ensurePoliticsHasNewFields(prev.politics ?? initialGameState.politics!);
    const r = pacRaiseDirty(politics, btcAmount, price, prev.weeksLived);
    log.info(`Funneled ${btcAmount} BTC ($${Math.round(r.usdConverted).toLocaleString()}) through the PAC`);
    return {
      ...prev,
      cryptos: prev.cryptos.map((c) =>
        c.id === 'btc' ? { ...c, owned: Math.max(0, owned - btcAmount) } : c
      ),
      politics: r.politics,
    };
  });
};

/**
 * Spend from the PAC on a campaign push. Pulls clean first, then dirty.
 * More efficient than the legacy `campaign` action (1.5× approval per $).
 */
export const spendPACOnCampaign = (
  setGameState: Dispatch<SetStateAction<GameState>>,
  amountUSD: number
) => {
  setGameState((prev) => {
    if (amountUSD <= 0) return prev;
    const politics = ensurePoliticsHasNewFields(prev.politics ?? initialGameState.politics!);
    const r = pacSpend(politics, amountUSD);
    if (r.spentUSD === 0) {
      log.warn(`PAC spend rejected: empty PAC`);
      return prev;
    }
    log.info(
      `PAC spend $${Math.round(r.spentUSD).toLocaleString()} (dirty $${Math.round(r.spentFromDirty).toLocaleString()}) → +${r.approvalGain.toFixed(1)} approval`
    );
    return { ...prev, politics: r.politics };
  });
};

/**
 * Spend on suppression for a specific scandal — PR team, legal, opp research.
 * Reduces weekly approval drain and accelerates the fade.
 */
export const suppressPoliticalScandal = (
  setGameState: Dispatch<SetStateAction<GameState>>,
  scandalId: string,
  amountUSD: number
) => {
  setGameState((prev) => {
    const cash = prev.stats?.money ?? 0;
    if (amountUSD <= 0 || amountUSD > cash) {
      log.warn(`Suppress rejected: amount=${amountUSD}, cash=${cash}`);
      return prev;
    }
    const politics = ensurePoliticsHasNewFields(prev.politics ?? initialGameState.politics!);
    const next = applySuppression(politics, scandalId, amountUSD);
    if (!next) {
      log.warn(`Suppress rejected: scandal ${scandalId} not active`);
      return prev;
    }
    return {
      ...prev,
      stats: { ...prev.stats, money: cash - amountUSD },
      politics: next,
    };
  });
};

// Expose severity params for the UI's suppression-cost display.
export { SEVERITY_PARAMS };

