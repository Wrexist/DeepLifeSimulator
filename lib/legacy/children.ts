import { ChildInfo } from '@/contexts/game/types';

export function updateChildWeekly(child: ChildInfo): ChildInfo {
  // Update child weekly - age is already incremented before this function is called
  // This function ensures expenses/familyHappiness are defined and preserves all child data including age
  return {
    ...child,
    age: child.age, // Explicitly preserve age (should already be updated by addWeekToAge)
    expenses: child.expenses ?? 0,
    familyHappiness: child.familyHappiness ?? 0,
    isHeirEligible: child.isHeirEligible ?? true,
  };
}


