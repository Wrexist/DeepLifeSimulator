import type { Achievement } from '@/contexts/game/types';

/**
 * What an achievement card shows.
 *
 * A secret achievement's PUBLIC fields are the placeholder (`name: '???'`,
 * `description: 'Hidden achievement'`) and its real text lives in
 * `secretName` / `secretDescription`, revealed once it is earned. The
 * achievements browser had this inverted - it showed the real name and unlock
 * condition of every LOCKED secret and the placeholder once it was earned -
 * which spoiled all ten on day one (VIS-2).
 */
export function achievementDisplay(
  achievement: Pick<Achievement, 'category' | 'completed' | 'name' | 'description'> & {
    secretName?: string;
    secretDescription?: string;
  }
): { name: string; description: string } {
  if (achievement.category !== 'secret') {
    return { name: achievement.name, description: achievement.description };
  }
  if (!achievement.completed) {
    return {
      name: achievement.name || '???',
      description: achievement.description || 'Hidden achievement',
    };
  }
  return {
    name: achievement.secretName || achievement.name,
    description: achievement.secretDescription || achievement.description,
  };
}
