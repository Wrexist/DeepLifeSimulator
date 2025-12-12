import { useMemo, useState, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Achievement, achievements } from '@/src/features/onboarding/achievementsData';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
      let progress = 0;
      if (a.progressSpec.kind === 'boolean') {
        progress = a.progressSpec.met(gameState) ? 1 : 0;
      } else if (a.progressSpec.kind === 'counter') {
        const current = a.progressSpec.current(gameState);
        progress = current / a.progressSpec.goal;
      }
      const group = a.group ?? a.id.split('_')[0];
      return { ...a, progress, claimed: claimed.has(a.id), group };
    });

    const grouped: Record<string, EnrichedAchievement[]> = {};
    enriched.forEach(a => {
      if (!grouped[a.group]) grouped[a.group] = [];
      grouped[a.group].push(a);
    });

    const result: GroupedAchievement[] = [];
    Object.values(grouped).forEach(groupList => {
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
  }, [gameState, globalClaimedAchievements]);
  return { achievements: list };
};
