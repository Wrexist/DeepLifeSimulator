import { achievements } from '@/src/features/onboarding/achievementsData';

describe('useAchievements grouping', () => {
  const compute = (gameState: any) => {
    const claimed = new Set(gameState.claimedProgressAchievements || []);
    const enriched = achievements.map(a => {
      let progress = 0;
      if (a.progressSpec.kind === 'boolean') {
        progress = a.progressSpec.met(gameState) ? 1 : 0;
      } else {
        const current = a.progressSpec.current(gameState);
        progress = current / a.progressSpec.goal;
      }
      const group = a.group ?? a.id.split('_')[0];
      return { ...a, progress, claimed: claimed.has(a.id), group };
    });
    const grouped: Record<string, typeof enriched> = {} as any;
    enriched.forEach(a => {
      if (!grouped[a.group]) grouped[a.group] = [];
      grouped[a.group].push(a);
    });
    const result: any[] = [];
    Object.values(grouped).forEach((groupList: any[]) => {
      const firstIdx = groupList.findIndex(a => !a.claimed);
      if (firstIdx === -1) return;
      const current = groupList[firstIdx];
      const next = groupList.slice(firstIdx + 1).find(a => !a.claimed);
      result.push({
        ...current,
        stackIndex: firstIdx,
        stackSize: groupList.length,
        nextTitle: next?.title,
      });
    });
    return result;
  };

  it('updates stackIndex and stackSize after claiming', () => {
    const initial = compute({ stats: {} });
    const wealthFirst = initial.find(a => a.id === 'wealth_1m');
    expect(wealthFirst.stackIndex).toBe(0);
    expect(wealthFirst.stackSize).toBe(6);

    const afterClaim = compute({ stats: {}, claimedProgressAchievements: ['wealth_1m'] });
    const wealthNext = afterClaim.find(a => a.id === 'wealth_10m');
    expect(wealthNext.stackIndex).toBe(1);
    expect(wealthNext.stackSize).toBe(6);
  });

  it('groups social achievements correctly', () => {
    const expectedSocialStackSize = achievements.filter(a => (a.group ?? a.id.split('_')[0]) === 'social').length;

    const initial = compute({ relationships: [] });
    const social = initial.find(a => a.id === 'social_butterfly');
    expect(social.stackIndex).toBe(0);
    expect(social.stackSize).toBe(expectedSocialStackSize);

    const afterClaim = compute({ relationships: [], claimedProgressAchievements: ['social_butterfly'] });
    const socialNext = afterClaim.find(a => a.id === 'social_celebrity');
    expect(socialNext.stackIndex).toBe(1);
    expect(socialNext.stackSize).toBe(expectedSocialStackSize);
  });
});
