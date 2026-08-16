import { useMemo, useState, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Achievement, achievements, achievementProgress } from '@/src/features/onboarding/achievementsData';
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { logger } from '@/utils/logger';

/**
 * M5: id -> catalogue index, built ONCE at module scope.
 *
 * Both sorts below used to call `achievements.findIndex(...)` inside their
 * comparator — an O(n) scan per comparison over a 159-element catalogue, twice
 * per comparison, on a memo that invalidated on every state mutation while the
 * home screen was mounted (~290k array scans per invalidation). The Map makes
 * each comparison O(1) and the ordering identical: it stores the same index
 * `findIndex` would have returned.
 */
const ACHIEVEMENT_ORDER = new Map<string, number>(achievements.map((a, i) => [a.id, i]));

/** Catalogue position, matching the old `findIndex` (-1 for an unknown id). */
const orderOf = (id: string): number => ACHIEVEMENT_ORDER.get(id) ?? -1;

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
  // M5: the whole-state subscription STAYS, deliberately. The 159 progressSpecs
  // in `achievementsData` read 38 distinct top-level slices between them
  // (stats, careers, family, realEstate, prestige, politics, travel, loans,
  // cryptos, lifetimeStatistics, …), so there is no narrow selector that is
  // both correct and cheaper than the state identity itself — a selector
  // returning those 38 slices would invalidate on exactly the same commits
  // while costing a shallow compare per commit on top. What the audit finding
  // actually cost was inside the memo, and that is what was fixed: the two
  // O(n²) `findIndex` sorts are now O(1) Map lookups.
  //
  // The AsyncStorage effect below is already keyed on the narrowest thing that
  // can change its answer (`claimedProgressAchievements`), whose array identity
  // only changes when a claim is recorded — every other updater spreads it
  // through unchanged — so it does NOT re-read storage on every tick.
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
      // Wrapped exactly as `isAchievementEarned` wraps the identical call
      // (src/features/onboarding/achievementsData.ts): a progressSpec closure
      // reaching into a partial or legacy state must not take down the whole
      // achievements screen — one bad spec would blank the list.
      let progress = 0;
      try {
        progress = achievementProgress(gameState, a);
      } catch (error) {
        if (__DEV__) {
          logger.error(`achievementProgress threw for "${a.id}":`, error);
        }
      }
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
      const sortedGroup = [...groupList].sort((a, b) => orderOf(a.id) - orderOf(b.id));
      
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
    const sortedResult = result.sort((a, b) => orderOf(a.id) - orderOf(b.id));

    return sortedResult;
  }, [gameState, globalClaimedAchievements]);
  return { achievements: list };
};
