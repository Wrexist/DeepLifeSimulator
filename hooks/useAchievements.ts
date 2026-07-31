import { useMemo, useState, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Achievement, achievements, achievementProgress } from '@/src/features/onboarding/achievementsData';
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { logger } from '@/utils/logger';

interface EnrichedAchievement extends Achievement {
  progress: number;
  claimed: boolean;
  group: string;
}

export interface GroupedAchievement extends EnrichedAchievement {
  stackIndex: number;
  stackSize: number;
  nextTitle?: string;
}

export const useAchievements = () => {
  const { gameState } = useGame();
  const [globalClaimedAchievements, setGlobalClaimedAchievements] = useState<string[]>([]);

  // Load globally claimed achievements
  useEffect(() => {
    const loadGlobalClaimed = async () => {
      try {
        const globalClaimed = await AsyncStorage.getItem('globalClaimedAchievements');
        const globalClaimedList: string[] = globalClaimed ? JSON.parse(globalClaimed) : [];
        setGlobalClaimedAchievements(globalClaimedList);
      } catch (error) {
        if (__DEV__) {
          logger.error('Error loading global claimed achievements:', error);
        }
      }
    };
    loadGlobalClaimed();
  }, [gameState.claimedProgressAchievements]); // Reload when local claims change

  const list = useMemo<GroupedAchievement[]>(() => {
    const claimed = new Set(gameState.claimedProgressAchievements || []);
    const globalClaimed = new Set(globalClaimedAchievements);
    
    // Filter out gem achievements (group: 'gold') that have been claimed globally
    const filteredAchievements = achievements.filter(a => {
      const group = a.group ?? a.id.split('_')[0];
      // If it's a gem achievement (gold group) and claimed globally, hide it completely
      if (group === 'gold' && globalClaimed.has(a.id)) {
        return false;
      }
      return true;
    });

    const enriched: EnrichedAchievement[] = filteredAchievements.map(a => {
      // Shared with `isAchievementEarned`, which scenario scoring uses. This
      // logic was inlined here and copied verbatim into the hook's own test, so
      // the test could only agree with itself and no non-React caller could ask
      // the question — which is how scenario win conditions ended up reading a
      // different, dead catalogue. Values > 1 are kept for claim detection.
      const progress = achievementProgress(gameState, a);
      const group = a.group ?? a.id.split('_')[0];
      const isClaimed = claimed.has(a.id);
      return { ...a, progress, claimed: isClaimed, group };
    });

    const grouped: Record<string, EnrichedAchievement[]> = {};
    enriched.forEach(a => {
      if (!grouped[a.group]) grouped[a.group] = [];
      grouped[a.group].push(a);
    });

    // Return ALL achievements, not just the first unclaimed one per group
    // This allows users to see all their progress, including completed achievements
    const result: GroupedAchievement[] = [];
    Object.values(grouped).forEach(groupList => {
      // Sort by order in original achievements array to maintain proper sequence
      const sortedGroup = [...groupList].sort((a, b) => {
        const aIdx = achievements.findIndex(ach => ach.id === a.id);
        const bIdx = achievements.findIndex(ach => ach.id === b.id);
        return aIdx - bIdx;
      });
      
      // Add ALL achievements in the group, not just the first unclaimed one
      sortedGroup.forEach((achievement, index) => {
        const next = sortedGroup.slice(index + 1).find(a => !a.claimed);
        result.push({
          ...achievement,
          stackIndex: index,
          stackSize: sortedGroup.length,
          nextTitle: next?.title,
        });
      });
    });

    // Sort all achievements by their original order in the achievements array
    const sortedResult = result.sort((a, b) => {
      const aIdx = achievements.findIndex(ach => ach.id === a.id);
      const bIdx = achievements.findIndex(ach => ach.id === b.id);
      return aIdx - bIdx;
    });

    return sortedResult;
  }, [gameState, globalClaimedAchievements]);
  return { achievements: list };
};
