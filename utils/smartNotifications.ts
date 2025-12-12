import { GameState } from '@/contexts/GameContext';
import { showAchievementToast } from './achievementToast';
import { FeedbackSystem } from './feedbackSystem';

export interface SmartNotification {
  id: string;
  type: 'achievement' | 'milestone' | 'warning' | 'tip' | 'reminder' | 'celebration' | 'suggestion';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'wealth' | 'health' | 'social' | 'career' | 'family' | 'education' | 'general';
  icon?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  autoDismiss?: boolean;
  dismissAfter?: number; // milliseconds
  showOnce?: boolean;
  conditions?: {
    minAge?: number;
    maxAge?: number;
    minMoney?: number;
    maxMoney?: number;
    minHealth?: number;
    maxHealth?: number;
    minHappiness?: number;
    maxHappiness?: number;
    minEnergy?: number;
    maxEnergy?: number;
    hasJob?: boolean;
    hasSpouse?: boolean;
    hasChildren?: boolean;
    hasCompany?: boolean;
    hasProperty?: boolean;
    hasCrypto?: boolean;
    hasDebt?: boolean;
    isInJail?: boolean;
    hasDiseases?: boolean;
    weeksLived?: number;
  };
  cooldown?: number; // hours between notifications
  lastShown?: number;
}

export interface NotificationContext {
  gameState: GameState;
  previousGameState?: GameState;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: number;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  recentActions: string[];
  userPreferences: {
    showTips: boolean;
    showMilestones: boolean;
    showWarnings: boolean;
    showSuggestions: boolean;
    notificationFrequency: 'low' | 'medium' | 'high';
  };
}

class SmartNotificationSystem {
  private static instance: SmartNotificationSystem;
  private notifications: SmartNotification[] = [];
  private feedbackSystem: FeedbackSystem;
  private notificationHistory: Map<string, number> = new Map();

  private constructor() {
    this.feedbackSystem = FeedbackSystem.getInstance();
    this.initializeNotifications();
  }

  static getInstance(): SmartNotificationSystem {
    if (!SmartNotificationSystem.instance) {
      SmartNotificationSystem.instance = new SmartNotificationSystem();
    }
    return SmartNotificationSystem.instance;
  }

  private initializeNotifications() {
    this.notifications = [
      // Achievement Notifications
      {
        id: 'first_money',
        type: 'achievement',
        title: '💰 First Earnings!',
        message: 'Congratulations! You earned your first money. Keep working to build your wealth!',
        priority: 'medium',
        category: 'wealth',
        icon: '💰',
        conditions: { minMoney: 100 },
        showOnce: true,
      },
      {
        id: 'first_million',
        type: 'achievement',
        title: '🎉 Millionaire!',
        message: 'Incredible! You\'ve reached your first million. You\'re on your way to financial freedom!',
        priority: 'high',
        category: 'wealth',
        icon: '🎉',
        conditions: { minMoney: 1000000 },
        showOnce: true,
      },
      {
        id: 'first_job',
        type: 'achievement',
        title: '💼 First Job!',
        message: 'Great! You got your first job. This is the start of your career journey!',
        priority: 'medium',
        category: 'career',
        icon: '💼',
        conditions: { hasJob: true },
        showOnce: true,
      },
      {
        id: 'first_friend',
        type: 'achievement',
        title: '👥 First Friend!',
        message: 'Wonderful! You made your first friend. Building relationships is key to happiness!',
        priority: 'medium',
        category: 'social',
        icon: '👥',
        conditions: { minAge: 18 },
        showOnce: true,
      },
      {
        id: 'married',
        type: 'achievement',
        title: '💍 Married!',
        message: 'Congratulations on getting married! May your life together be filled with joy!',
        priority: 'high',
        category: 'family',
        icon: '💍',
        conditions: { hasSpouse: true },
        showOnce: true,
      },
      {
        id: 'first_child',
        type: 'achievement',
        title: '👶 First Child!',
        message: 'Amazing! You\'re now a parent. This is one of life\'s greatest adventures!',
        priority: 'high',
        category: 'family',
        icon: '👶',
        conditions: { hasChildren: true },
        showOnce: true,
      },

      // Milestone Notifications
      {
        id: 'age_milestone_25',
        type: 'milestone',
        title: '🎂 Quarter Century!',
        message: 'You\'ve reached 25! This is a great time to focus on your career and relationships.',
        priority: 'medium',
        category: 'general',
        icon: '🎂',
        conditions: { minAge: 25, maxAge: 25 },
        showOnce: true,
      },
      {
        id: 'age_milestone_30',
        type: 'milestone',
        title: '🎂 Dirty Thirty!',
        message: 'Welcome to your 30s! Time to focus on stability and long-term goals.',
        priority: 'medium',
        category: 'general',
        icon: '🎂',
        conditions: { minAge: 30, maxAge: 30 },
        showOnce: true,
      },
      {
        id: 'age_milestone_50',
        type: 'milestone',
        title: '🎂 Half Century!',
        message: 'You\'ve reached 50! This is a time for reflection and enjoying the fruits of your labor.',
        priority: 'medium',
        category: 'general',
        icon: '🎂',
        conditions: { minAge: 50, maxAge: 50 },
        showOnce: true,
      },
      {
        id: 'centenarian',
        type: 'milestone',
        title: '🎂 Centenarian!',
        message: 'Incredible! You\'ve lived to 100! You\'ve truly mastered the art of living.',
        priority: 'high',
        category: 'general',
        icon: '🎂',
        conditions: { minAge: 100, maxAge: 100 },
        showOnce: true,
      },

      // Warning Notifications
      {
        id: 'low_health_warning',
        type: 'warning',
        title: '⚠️ Health Warning',
        message: 'Your health is getting low. Consider visiting a doctor or taking better care of yourself.',
        priority: 'high',
        category: 'health',
        icon: '⚠️',
        conditions: { minHealth: 0, maxHealth: 30 },
        cooldown: 24,
      },
      {
        id: 'low_happiness_warning',
        type: 'warning',
        title: '😢 Happiness Warning',
        message: 'Your happiness is declining. Try spending time with friends or doing activities you enjoy.',
        priority: 'high',
        category: 'health',
        icon: '😢',
        conditions: { minHappiness: 0, maxHappiness: 30 },
        cooldown: 24,
      },
      {
        id: 'low_energy_warning',
        type: 'warning',
        title: '😴 Energy Warning',
        message: 'You\'re running low on energy. Make sure to get enough rest and eat well.',
        priority: 'medium',
        category: 'health',
        icon: '😴',
        conditions: { minEnergy: 0, maxEnergy: 20 },
        cooldown: 12,
      },
      {
        id: 'debt_warning',
        type: 'warning',
        title: '💸 Debt Warning',
        message: 'You\'re in debt! Consider finding ways to increase your income or reduce expenses.',
        priority: 'high',
        category: 'wealth',
        icon: '💸',
        conditions: { hasDebt: true },
        cooldown: 48,
      },
      {
        id: 'jail_warning',
        type: 'warning',
        title: '🔒 Jail Time',
        message: 'You\'re in jail! Use this time to reflect on your choices and plan for the future.',
        priority: 'critical',
        category: 'general',
        icon: '🔒',
        conditions: { isInJail: true },
        cooldown: 72,
      },

      // Tip Notifications
      {
        id: 'investment_tip',
        type: 'tip',
        title: '💡 Investment Tip',
        message: 'Consider investing in stocks or crypto to grow your wealth over time. Start small and diversify!',
        priority: 'low',
        category: 'wealth',
        icon: '💡',
        conditions: { minMoney: 10000, hasCrypto: false },
        cooldown: 168, // 1 week
      },
      {
        id: 'real_estate_tip',
        type: 'tip',
        title: '🏠 Real Estate Tip',
        message: 'Real estate can be a great investment! Consider buying property to build long-term wealth.',
        priority: 'low',
        category: 'wealth',
        icon: '🏠',
        conditions: { minMoney: 50000, hasProperty: false },
        cooldown: 168,
      },
      {
        id: 'education_tip',
        type: 'tip',
        title: '🎓 Education Tip',
        message: 'Education can open doors to better career opportunities. Consider investing in your skills!',
        priority: 'low',
        category: 'education',
        icon: '🎓',
        conditions: { minAge: 18, maxAge: 40 },
        cooldown: 168,
      },
      {
        id: 'health_tip',
        type: 'tip',
        title: '💪 Health Tip',
        message: 'Regular exercise and a healthy diet can improve your stats and help you live longer!',
        priority: 'low',
        category: 'health',
        icon: '💪',
        conditions: { minAge: 20 },
        cooldown: 168,
      },
      {
        id: 'social_tip',
        type: 'tip',
        title: '👥 Social Tip',
        message: 'Strong relationships are key to happiness. Make time for friends and family!',
        priority: 'low',
        category: 'social',
        icon: '👥',
        conditions: { minAge: 18 },
        cooldown: 168,
      },

      // Reminder Notifications
      {
        id: 'weekly_reminder',
        type: 'reminder',
        title: '📅 Weekly Reminder',
        message: 'Time to advance to the next week! Make sure to check your stats and plan your activities.',
        priority: 'medium',
        category: 'general',
        icon: '📅',
        cooldown: 168, // 1 week
      },
      {
        id: 'save_reminder',
        type: 'reminder',
        title: '💾 Save Reminder',
        message: 'Don\'t forget to save your progress! Your game is automatically saved, but you can also save manually.',
        priority: 'low',
        category: 'general',
        icon: '💾',
        cooldown: 336, // 2 weeks
      },

      // Celebration Notifications
      {
        id: 'perfect_week',
        type: 'celebration',
        title: '🌟 Perfect Week!',
        message: 'Amazing! You had a perfect week with all stats above 90. Keep up the great work!',
        priority: 'high',
        category: 'general',
        icon: '🌟',
        conditions: { minHealth: 90, minHappiness: 90, minEnergy: 90 },
        cooldown: 168,
      },
      {
        id: 'wealth_growth',
        type: 'celebration',
        title: '📈 Wealth Growth!',
        message: 'Excellent! Your wealth has grown significantly this week. You\'re on the right track!',
        priority: 'medium',
        category: 'wealth',
        icon: '📈',
        cooldown: 168,
      },

      // Suggestion Notifications
      {
        id: 'career_suggestion',
        type: 'suggestion',
        title: '💼 Career Suggestion',
        message: 'Consider advancing your career or starting a business to increase your income potential.',
        priority: 'low',
        category: 'career',
        icon: '💼',
        conditions: { hasJob: true, minAge: 25 },
        cooldown: 336,
      },
      {
        id: 'family_suggestion',
        type: 'suggestion',
        title: '👨‍👩‍👧‍👦 Family Suggestion',
        message: 'Ready to settle down? Consider getting married and starting a family for a fulfilling life.',
        priority: 'low',
        category: 'family',
        icon: '👨‍👩‍👧‍👦',
        conditions: { minAge: 25, hasSpouse: false },
        cooldown: 336,
      },
      {
        id: 'retirement_suggestion',
        type: 'suggestion',
        title: '🏖️ Retirement Suggestion',
        message: 'You\'ve worked hard! Consider retiring and enjoying the fruits of your labor.',
        priority: 'low',
        category: 'career',
        icon: '🏖️',
        conditions: { minAge: 60, minMoney: 1000000 },
        cooldown: 720, // 1 month
      },
    ];
  }

  public evaluateNotifications(context: NotificationContext): SmartNotification[] {
    const activeNotifications: SmartNotification[] = [];
    const now = Date.now();

    for (const notification of this.notifications) {
      // Check if notification should be shown
      if (!this.shouldShowNotification(notification, context, now)) {
        continue;
      }

      // Check conditions
      if (notification.conditions && !this.checkConditions(notification.conditions, context.gameState)) {
        continue;
      }

      // Check cooldown
      if (notification.cooldown && this.isOnCooldown(notification.id, notification.cooldown, now)) {
        continue;
      }

      // Check if already shown (for showOnce notifications)
      if (notification.showOnce && this.hasBeenShown(notification.id)) {
        continue;
      }

      // Check user preferences
      if (!this.matchesUserPreferences(notification, context.userPreferences)) {
        continue;
      }

      activeNotifications.push(notification);
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    activeNotifications.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return activeNotifications;
  }

  public showNotification(notification: SmartNotification, _context: NotificationContext): void {
    const now = Date.now();
    // Mark as shown
    this.notificationHistory.set(notification.id, now);
    
    // Show the notification
    this.displayNotification(notification);
    
    // Trigger appropriate feedback
    this.triggerFeedback(notification);
  }

  private shouldShowNotification(
    notification: SmartNotification,
    context: NotificationContext,
    _now: number
  ): boolean {
    // Check time-based conditions
    if (notification.conditions) {
      // Check age range
      if (notification.conditions.minAge && context.gameState.date.age < notification.conditions.minAge) {
        return false;
      }
      if (notification.conditions.maxAge && context.gameState.date.age > notification.conditions.maxAge) {
        return false;
      }

      // Check money range
      if (notification.conditions.minMoney && context.gameState.stats.money < notification.conditions.minMoney) {
        return false;
      }
      if (notification.conditions.maxMoney && context.gameState.stats.money > notification.conditions.maxMoney) {
        return false;
      }
    }

    return true;
  }

  private checkConditions(conditions: any, gameState: GameState): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      switch (key) {
        case 'minHealth':
          if (gameState.stats.health < (value as number)) return false;
          break;
        case 'maxHealth':
          if (gameState.stats.health > (value as number)) return false;
          break;
        case 'minHappiness':
          if (gameState.stats.happiness < (value as number)) return false;
          break;
        case 'maxHappiness':
          if (gameState.stats.happiness > (value as number)) return false;
          break;
        case 'minEnergy':
          if (gameState.stats.energy < (value as number)) return false;
          break;
        case 'maxEnergy':
          if (gameState.stats.energy > (value as number)) return false;
          break;
        case 'hasJob':
          if (!!gameState.currentJob !== (value as boolean)) return false;
          break;
        case 'hasSpouse':
          if (!!gameState.family?.spouse !== (value as boolean)) return false;
          break;
        case 'hasChildren':
          if ((gameState.family?.children?.length || 0) > 0 !== (value as boolean)) return false;
          break;
        case 'hasCompany':
          if ((gameState.companies?.length || 0) > 0 !== (value as boolean)) return false;
          break;
        case 'hasProperty':
          if ((gameState.realEstate?.filter(r => r.owned).length || 0) > 0 !== (value as boolean)) return false;
          break;
        case 'hasCrypto':
          if ((gameState.cryptos?.some(c => c.owned > 0) || false) !== (value as boolean)) return false;
          break;
        case 'hasDebt':
          if ((gameState.stats.money < 0) !== (value as boolean)) return false;
          break;
        case 'isInJail':
          if ((gameState.jailWeeks > 0) !== (value as boolean)) return false;
          break;
        case 'hasDiseases':
          if ((gameState.diseases?.length || 0) > 0 !== (value as boolean)) return false;
          break;
        case 'weeksLived':
          if (gameState.weeksLived < (value as number)) return false;
          break;
      }
    }
    return true;
  }

  private isOnCooldown(notificationId: string, cooldownHours: number, now: number): boolean {
    const lastShown = this.notificationHistory.get(notificationId);
    if (!lastShown) return false;
    
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    return (now - lastShown) < cooldownMs;
  }

  private hasBeenShown(notificationId: string): boolean {
    return this.notificationHistory.has(notificationId);
  }

  private matchesUserPreferences(notification: SmartNotification, preferences: any): boolean {
    switch (notification.type) {
      case 'tip':
        return preferences.showTips;
      case 'milestone':
        return preferences.showMilestones;
      case 'warning':
        return preferences.showWarnings;
      case 'suggestion':
        return preferences.showSuggestions;
      default:
        return true;
    }
  }

  private displayNotification(notification: SmartNotification): void {
    // Use the existing achievement toast system for now
    // In a real implementation, you might want a more sophisticated notification system
    const iconValue = typeof notification.icon === 'string' ? 0 : (notification.icon || 0);
    showAchievementToast(notification.title, notification.message, iconValue);
  }

  private triggerFeedback(notification: SmartNotification): void {
    switch (notification.priority) {
      case 'critical':
        this.feedbackSystem.error(notification.message);
        break;
      case 'high':
        this.feedbackSystem.warning(notification.message);
        break;
      case 'medium':
        this.feedbackSystem.info(notification.message);
        break;
      case 'low':
        this.feedbackSystem.info(notification.message);
        break;
    }
  }

  public clearHistory(): void {
    this.notificationHistory.clear();
  }

  public getNotificationHistory(): Map<string, number> {
    return new Map(this.notificationHistory);
  }

  public addCustomNotification(notification: SmartNotification): void {
    this.notifications.push(notification);
  }

  public removeNotification(notificationId: string): void {
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
  }
}

export const smartNotificationSystem = SmartNotificationSystem.getInstance();

// Hook for easy access
export const useSmartNotifications = (context: NotificationContext) => {
  const notifications = smartNotificationSystem.evaluateNotifications(context);
  
  const showNotification = (notification: SmartNotification) => {
    smartNotificationSystem.showNotification(notification, context);
  };

  const showAllNotifications = () => {
    notifications.forEach(notification => {
      smartNotificationSystem.showNotification(notification, context);
    });
  };

  return {
    notifications,
    showNotification,
    showAllNotifications,
    clearHistory: () => smartNotificationSystem.clearHistory(),
  };
};
