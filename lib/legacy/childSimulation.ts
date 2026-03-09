import { ChildInfo, GameState } from '@/contexts/game/types';
import { getDeterministicRoll } from '@/lib/randomness/deterministicRng';
import { WEEKS_PER_YEAR, ADULTHOOD_AGE } from '@/lib/config/gameConstants';

/**
 * Simulate a child's growth until they reach age 18
 * This simulates education, career development, and savings accumulation
 *
 * ANTI-EXPLOIT: Uses deterministic RNG seeded on childId + weeksLived
 * so the same child at the same week always produces identical outcomes
 * regardless of save/reload. Prevents prestige savescumming for optimal heirs.
 *
 * @param child The child to simulate
 * @param parentState The parent's game state (for inheritance context + RNG seed)
 * @param targetAge Target age (default ADULTHOOD_AGE)
 * @returns Simulated child with updated age, education, career, and savings
 */
export function simulateChildToAge(
  child: ChildInfo,
  parentState: GameState,
  targetAge: number = ADULTHOOD_AGE
): ChildInfo {
  const currentAge = Math.floor(child.age || 0);
  const yearsToSimulate = Math.max(0, targetAge - currentAge);

  if (yearsToSimulate <= 0) {
    // Child is already adult, return as-is
    return {
      ...child,
      age: Math.max(ADULTHOOD_AGE, currentAge),
    };
  }

  const simulatedChild: ChildInfo = {
    ...child,
    age: targetAge,
  };

  // ANTI-EXPLOIT: Derive deterministic rolls from child ID and parent state
  // Same child + same game state = same outcomes every time (no reload abuse)
  const childId = child.id || 'unknown-child';
  const weeksLived = parentState.weeksLived || 0;
  const rngPrefix = `child_sim:${childId}:${weeksLived}`;

  const educationRoll = getDeterministicRoll(parentState, `${rngPrefix}:education`);
  const careerRoll = getDeterministicRoll(parentState, `${rngPrefix}:career`);
  const savingsRateRoll = getDeterministicRoll(parentState, `${rngPrefix}:savings_rate`);

  // Simulate education progression
  // Ages 0-5: No formal education
  // Ages 6-17: High school (if parent has money for education)
  // Age 18+: Can go to university or specialized education

  if (targetAge >= ADULTHOOD_AGE) {
    // Determine education level based on parent's wealth and deterministic roll
    const parentNetWorth = (parentState.stats.money || 0) + (parentState.bankSavings || 0);
    const canAffordUniversity = parentNetWorth > 50_000;
    const canAffordSpecialized = parentNetWorth > 100_000;

    // Education probability based on parent wealth
    if (canAffordSpecialized && educationRoll > 0.3) {
      simulatedChild.educationLevel = 'specialized';
    } else if (canAffordUniversity && educationRoll > 0.5) {
      simulatedChild.educationLevel = 'university';
    } else if (targetAge >= 6) {
      simulatedChild.educationLevel = 'highSchool';
    } else {
      simulatedChild.educationLevel = 'none';
    }
  } else if (targetAge >= 6) {
    simulatedChild.educationLevel = 'highSchool';
  } else {
    simulatedChild.educationLevel = 'none';
  }

  // Simulate career path based on education
  if (targetAge >= ADULTHOOD_AGE && simulatedChild.educationLevel) {
    if (simulatedChild.educationLevel === 'specialized') {
      // Specialized education -> professional or entrepreneur
      simulatedChild.careerPath = careerRoll > 0.5 ? 'professional' : 'entrepreneur';
      simulatedChild.jobTier = careerRoll > 0.7 ? 4 : 3;
    } else if (simulatedChild.educationLevel === 'university') {
      // University -> professional or white collar
      simulatedChild.careerPath = careerRoll > 0.6 ? 'professional' : 'whiteCollar';
      simulatedChild.jobTier = careerRoll > 0.5 ? 3 : 2;
    } else if (simulatedChild.educationLevel === 'highSchool') {
      // High school -> white collar or blue collar
      simulatedChild.careerPath = careerRoll > 0.5 ? 'whiteCollar' : 'blueCollar';
      simulatedChild.jobTier = careerRoll > 0.4 ? 2 : 1;
    } else {
      // No education -> blue collar
      simulatedChild.careerPath = 'blueCollar';
      simulatedChild.jobTier = 1;
    }
  }

  // Simulate savings accumulation
  // Children save a portion of their simulated income
  const baseSavings = child.savings || 0;
  let accumulatedSavings = baseSavings;

  if (targetAge >= ADULTHOOD_AGE) {
    // Simulate working years (from adulthood to target age, or from current age if already working)
    const workingYears = Math.max(0, targetAge - ADULTHOOD_AGE);

    // Estimate income based on career path and job tier
    let estimatedWeeklyIncome = 0;
    if (simulatedChild.careerPath === 'entrepreneur') {
      estimatedWeeklyIncome = 500 + (simulatedChild.jobTier || 1) * 200; // $500-$1300/week
    } else if (simulatedChild.careerPath === 'professional') {
      estimatedWeeklyIncome = 400 + (simulatedChild.jobTier || 1) * 150; // $400-$1000/week
    } else if (simulatedChild.careerPath === 'whiteCollar') {
      estimatedWeeklyIncome = 300 + (simulatedChild.jobTier || 1) * 100; // $300-$600/week
    } else {
      estimatedWeeklyIncome = 200 + (simulatedChild.jobTier || 1) * 50; // $200-$350/week
    }

    // Simulate savings (save 15-25% of income, deterministic variation)
    const savingsRate = 0.15 + (savingsRateRoll * 0.1); // 15-25% savings rate (deterministic)
    const annualSavings = estimatedWeeklyIncome * WEEKS_PER_YEAR * savingsRate;
    accumulatedSavings += annualSavings * workingYears;
  }

  simulatedChild.savings = Math.floor(accumulatedSavings);

  // Ensure child is eligible as heir if adult
  if (targetAge >= ADULTHOOD_AGE) {
    simulatedChild.isHeirEligible = true;
  }

  return simulatedChild;
}

/**
 * Simulate all children to age 18 if they're younger
 * @param children Array of children to simulate
 * @param parentState Parent's game state
 * @returns Array of simulated children (all 18+)
 */
export function simulateChildrenToAdulthood(
  children: ChildInfo[],
  parentState: GameState
): ChildInfo[] {
  return children.map(child => {
    const currentAge = Math.floor(child.age || 0);
    if (currentAge < ADULTHOOD_AGE) {
      return simulateChildToAge(child, parentState, ADULTHOOD_AGE);
    }
    return child;
  });
}
