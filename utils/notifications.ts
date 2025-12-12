import { Platform } from 'react-native';
import { logger } from '@/utils/logger';

// Create a mock for web platform
const createMockNotifications = () => ({
  getPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
  requestPermissionsAsync: async () => ({ granted: false }),
  scheduleNotificationAsync: async () => {},
  cancelScheduledNotificationAsync: async () => {},
  AndroidNotificationPriority: { HIGH: 'high' }
});

// Use mock for web, null for native (will be loaded dynamically)
let Notifications: any = Platform.OS === 'web' ? createMockNotifications() : null;

// Load notifications for native platforms
if (Platform.OS !== 'web') {
  // Check if we're in Expo Go to suppress warnings
  let isExpoGo = false;
  try {
    // @ts-ignore - Expo constants
    const Constants = require('expo-constants');
    isExpoGo = Constants?.executionEnvironment === 'storeClient';
  } catch {
    // Not Expo, continue
  }
  
  if (!isExpoGo) {
    import('expo-notifications').then(module => {
      Notifications = module.default || module;
    }).catch(error => {
      if (__DEV__) {
        logger.debug('expo-notifications not available:', error);
      }
    });
  } else {
    // In Expo Go, skip loading to avoid warnings
    if (__DEV__) {
      logger.debug('expo-notifications skipped - running in Expo Go');
    }
  }
}

export async function initializeNotifications(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;
    
    // Wait for Notifications to be loaded
    if (!Notifications) {
      try {
        const module = await import('expo-notifications');
        Notifications = module.default || module;
      } catch (error) {
        // Suppress warning in development with Expo Go
        if (__DEV__) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('expo-notifications')) {
            logger.debug('expo-notifications not available in Expo Go (expected)');
          } else {
            logger.warn('expo-notifications not available:', error);
          }
        }
        return false;
      }
    }
    
    if (!Notifications) {
      if (__DEV__) {
        logger.warn('Notifications module not available');
      }
      return false;
    }
    
    const settings = await Notifications.getPermissionsAsync();
    
    if (settings.granted) {
      return true;
    }
    
    if (settings.canAskAgain) {
      const request = await Notifications.requestPermissionsAsync();
      return request.granted;
    } else {
      // User denied and can't ask again
      if (__DEV__) {
        logger.warn('Notification permissions permanently denied');
      }
      return false;
    }
  } catch (error) {
    if (__DEV__) {
      logger.error('Notification permission error:', error);
    }
    return false;
  }
}

export async function scheduleDailyReminder(hour = 9, retryCount = 0) {
  try {
    if (Platform.OS === 'web') return false;
    
    const hasPermission = await initializeNotifications();
    if (!hasPermission) {
      if (__DEV__) {
        logger.warn('Notification permission denied');
      }
      return false;
    }
    
    // Cancel existing notification first
    await Notifications.cancelScheduledNotificationAsync('daily-reminder');
    
    await Notifications.scheduleNotificationAsync({
      identifier: 'daily-reminder',
      content: {
        title: 'Daily Bonus Ready',
        body: 'Return to claim your gold and cash boost!',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: { 
        hour, 
        minute: 0, 
        repeats: true 
      } as any
    });
    
    if (__DEV__) {
      logger.info('Daily reminder scheduled successfully');
    }
    return true;
  } catch (error) {
    if (__DEV__) {
      logger.error('Failed to schedule notification:', error);
    }
    
    if (retryCount < 3) {
      if (__DEV__) {
        logger.info(`Retrying notification setup... (${retryCount + 1}/3)`);
      }
      setTimeout(() => scheduleDailyReminder(hour, retryCount + 1), 2000);
    }
    
    return false;
  }
}

export async function cancelDailyReminder() {
  if (Platform.OS === 'web') return;
  try {
    // Wait for Notifications to be loaded
    if (!Notifications) {
      try {
        const module = await import('expo-notifications');
        Notifications = module.default || module;
      } catch (error) {
        if (__DEV__) {
          logger.warn('expo-notifications not available:', error);
        }
        return;
      }
    }
    
    await Notifications.cancelScheduledNotificationAsync('daily-reminder');
  } catch (error) {
    if (__DEV__) {
      logger.error('Failed to cancel notification', error);
    }
  }
}

export async function notifyAchievementUnlock(title: string, gold: number) {
  if (Platform.OS === 'web') return;
  const hasPermission = await initializeNotifications();
  if (!hasPermission) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Achievement Unlocked',
        body: `${title} (+${gold} gold)`,
      },
      trigger: null,
    });
  } catch (error) {
    if (__DEV__) {
      logger.warn('Failed to send achievement notification', error);
    }
  }
}

export async function notifySecretAchievementUnlock(title: string, gems: number) {
  if (Platform.OS === 'web') return;
  const hasPermission = await initializeNotifications();
  if (!hasPermission) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 Secret Achievement Unlocked!',
        body: `${title} (+${gems} gems)`,
        sound: 'default',
        priority: Notifications?.AndroidNotificationPriority?.HIGH,
      },
      trigger: null,
    });
  } catch (error) {
    if (__DEV__) {
      logger.warn('Failed to send secret achievement notification', error);
    }
  }
}



