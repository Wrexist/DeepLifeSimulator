// `import type` — AchievementData is an interface. A value import forms a require
// cycle with the component (which imports this util), avoided by erasing it.
import type { AchievementData } from '@/components/anim/AchievementToast';

// Global reference to the achievement toast component
let achievementToastRef: any = null;

export const setAchievementToastRef = (ref: any) => {
  achievementToastRef = ref;
};

export const showAchievementToast = (title: string, category: string, reward: number) => {
  // The AchievementToast is a hard-branded "ACHIEVEMENT UNLOCKED!" popup with a gem
  // reward chip. Only GENUINE achievements may use it, and every real catalog
  // achievement carries a positive gem reward. Tips, warnings, celebrations,
  // milestones, reminders, suggestions, generic feedback messages, and legacy
  // 0-reward pseudo-"achievement" entries all pass reward <= 0 — they must NOT
  // hijack this popup (they belong in the notification/toast channel). This is the
  // robust, copy-agnostic gate: reward > 0 distinguishes a real achievement.
  if (achievementToastRef && reward > 0) {
    const achievementData: AchievementData = {
      title,
      category,
      reward,
    };
    achievementToastRef.show(achievementData);
  }
};

export const showSecretAchievementToast = (title: string, reward: number) => {
  if (achievementToastRef) {
    const achievementData: AchievementData = {
      title: `🎉 Secret: ${title}`,
      category: 'secret',
      reward,
    };
    achievementToastRef.show(achievementData);
  }
};