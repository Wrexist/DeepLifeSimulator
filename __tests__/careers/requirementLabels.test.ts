import { advancedRequirementLabels } from '@/src/features/work/requirementLabels';
import { ADVANCED_CAREERS, isCareerUnlocked } from '@/lib/careers/advancedCareers';
import { getEducationProgram } from '@/lib/education/programs';
import { achievements } from '@/src/features/onboarding/achievementsData';

it('uses catalogue names for every advanced career gate', () => {
  for (const career of ADVANCED_CAREERS) {
    const req = career.unlockRequirements;
    const labels = advancedRequirementLabels(req).join(' | ');
    for (const id of req.education ?? []) {
      expect(getEducationProgram(id)).toBeDefined();
      expect(labels).toContain(getEducationProgram(id)!.name);
    }
    for (const id of req.achievements ?? []) {
      expect(achievements.find(a => a.id === id)).toBeDefined();
      expect(labels).toContain(achievements.find(a => a.id === id)!.title);
      expect(labels).toContain('Claimed achievement');
    }
    expect(labels).not.toContain('_');
  }
});

it('describes the real executive gate as cumulative courses', () => {
  const career = ADVANCED_CAREERS.find(c => c.id === 'ceo')!;
  expect(advancedRequirementLabels(career.unlockRequirements)).toContain("Education: Master's Degree and MBA");
  const gate = { education: [{ id: 'masters_degree', completed: true }], claimedAchievements: [], stats: { reputation: 100 }, weeksLived: 1000, netWorth: 1e9 };
  expect(isCareerUnlocked(career, gate)).toBe(false);
  expect(isCareerUnlocked(career, { ...gate, education: [...gate.education, { id: 'mba', completed: true }] })).toBe(true);
});

it('keeps unfamiliar catalogue extensions readable', () => {
  expect(advancedRequirementLabels({ education: ['future_course'] })).toEqual(['Education: Future Course']);
});
