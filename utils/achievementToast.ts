import { AchievementData } from '@/components/anim/AchievementToast';

// Global reference to the achievement toast component
let achievementToastRef: any = null;

export const setAchievementToastRef = (ref: any) => {
  achievementToastRef = ref;
};

export const showAchievementToast = (title: string, category: string, reward: number) => {
  if (achievementToastRef) {
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