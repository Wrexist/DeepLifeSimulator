import { useEffect, useRef } from 'react';
import { useGame } from '@/contexts/GameContext';
import { smartNotificationSystem, NotificationContext } from '@/utils/smartNotifications';

/**
 * Auto-surfaces the single most urgent SmartNotification after each week
 * advance. The smart-notification system (milestones, warnings, tips with
 * conditions + cooldowns) was previously reachable ONLY via the Bell on the
 * Progression tab, so its authored moments were almost never seen.
 *
 * Noise discipline: only `critical` and `high` priority fire automatically
 * (health collapsing, broke, death warnings) - at most ONE per week, delayed
 * past the week-advance animations. Tips/milestones stay in the manual center.
 * Renders nothing; display goes through the system's own non-blocking toast.
 */
function getTimeOfDay(): NotificationContext['timeOfDay'] {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}
function getSeason(): NotificationContext['season'] {
  const m = new Date().getMonth();
  if (m <= 1 || m === 11) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

const PRIORITY_RANK: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };

export default function SmartNotificationTicker() {
  const { gameState } = useGame();
  const weeksLived = gameState?.weeksLived ?? 0;
  const prevWeekRef = useRef<number | null>(null);
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  useEffect(() => {
    // First mount: just record the baseline, don't fire on load/restore.
    if (prevWeekRef.current === null) {
      prevWeekRef.current = weeksLived;
      return;
    }
    if (weeksLived <= prevWeekRef.current) {
      prevWeekRef.current = weeksLived;
      return;
    }
    prevWeekRef.current = weeksLived;

    // Let the week-result sheet / recap animations land first.
    const timer = setTimeout(() => {
      const gs = stateRef.current;
      if (!gs || gs.showDeathPopup) return;
      try {
        const context: NotificationContext = {
          gameState: gs,
          timeOfDay: getTimeOfDay(),
          dayOfWeek: new Date().getDay(),
          season: getSeason(),
          recentActions: [],
          userPreferences: {
            showTips: true,
            showMilestones: true,
            showWarnings: true,
            showSuggestions: true,
            notificationFrequency: 'medium',
          },
        };
        const eligible = smartNotificationSystem
          .evaluateNotifications(context)
          .filter((n) => n.priority === 'critical' || n.priority === 'high')
          .sort((a, b) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0));
        if (eligible.length > 0) {
          // showNotification records the cooldown so the same warning doesn't
          // re-fire every single week.
          smartNotificationSystem.showNotification(eligible[0], context);
        }
      } catch {
        // Never let notification evaluation break the week loop.
      }
    }, 1600);
    return () => clearTimeout(timer);
  }, [weeksLived]);

  return null;
}
