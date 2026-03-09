import { getWeeksSinceStoredWeek } from '@/utils/weekCounters';

interface TenantSatisfactionInput {
  tenantSatisfaction: number | undefined;
  lastMaintenance: number | undefined;
  currentAbsoluteWeek: number;
  currentWeekOfMonth: number;
}

/**
 * Matches RealEstateApp weekly tenant satisfaction rules while supporting
 * legacy cyclical maintenance markers.
 */
export function updateTenantSatisfactionForWeek({
  tenantSatisfaction,
  lastMaintenance,
  currentAbsoluteWeek,
  currentWeekOfMonth,
}: TenantSatisfactionInput): number {
  const currentSatisfaction = typeof tenantSatisfaction === 'number' ? tenantSatisfaction : 75;
  const weeksSinceMaintenance = getWeeksSinceStoredWeek(
    lastMaintenance,
    currentAbsoluteWeek,
    currentWeekOfMonth
  );

  if (weeksSinceMaintenance > 4) {
    return Math.max(0, currentSatisfaction - 5);
  }
  if (weeksSinceMaintenance <= 2) {
    return Math.min(100, currentSatisfaction + 2);
  }
  return currentSatisfaction;
}
