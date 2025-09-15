import { Platform } from 'react-native';

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
  import('expo-notifications').then(module => {
    Notifications = module.default || module;
  }).catch(error => {
    console.warn('expo-notifications not available:', error);
  });
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
        console.warn('expo-notifications not available:', error);
        return false;
      }
    }
    
    if (!Notifications) {
      console.warn('Notifications module not available');
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
      console.warn('Notification permissions permanently denied');
      return false;
    }
  } catch (error) {
    console.error('Notification permission error:', error);
    return false;
  }
}

export async function scheduleDailyReminder(hour = 9, retryCount = 0) {
  try {
    if (Platform.OS === 'web') return false;
    
    const hasPermission = await initializeNotifications();
    if (!hasPermission) {
      console.warn('Notification permission denied');
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
    
    console.log('Daily reminder scheduled successfully');
    return true;
  } catch (error) {
    console.error('Failed to schedule notification:', error);
    
    if (retryCount < 3) {
      console.log(`Retrying notification setup... (${retryCount + 1}/3)`);
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
        console.warn('expo-notifications not available:', error);
        return;
      }
    }
    
    await Notifications.cancelScheduledNotificationAsync('daily-reminder');
  } catch (error) {
    console.error('Failed to cancel notification', error);
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
    console.warn('Failed to send achievement notification', error);
  }
}



