import { getEducationProgram } from '@/lib/education/programs';
import type { AdvancedCareerUnlockRequirements } from '@/lib/types/requirements';
import { achievements } from '@/src/features/onboarding/achievementsData';

const readableKey = (id: string) => id.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/** Advanced-career gates require EVERY listed course and claimed achievement. */
export function advancedRequirementLabels(req: AdvancedCareerUnlockRequirements): string[] {
  const labels: string[] = [];
  if (req.education?.length) {
    labels.push(`Education: ${req.education.map(id => getEducationProgram(id)?.name ?? readableKey(id)).join(' and ')}`);
  }
  if (req.experience) labels.push(`Experience: ${req.experience} weeks`);
  if (req.reputation) labels.push(`Reputation: ${req.reputation}+`);
  if (req.netWorth) labels.push(`Net Worth: $${req.netWorth.toLocaleString()}+`);
  if (req.achievements?.length) {
    labels.push(`Claimed achievement${req.achievements.length > 1 ? 's' : ''}: ${req.achievements.map(id => achievements.find(a => a.id === id)?.title ?? readableKey(id)).join(' and ')}`);
  }
  return labels;
}
