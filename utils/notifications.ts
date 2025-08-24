import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function initializeNotifications(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}

export async function scheduleDailyReminder(hour = 9) {
  if (Platform.OS === 'web') return;
  const hasPermission = await initializeNotifications();
  if (!hasPermission) return;
  await Notifications.cancelScheduledNotificationAsync('daily-reminder').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-reminder',
    content: {
      title: 'Daily Bonus Ready',
      body: 'Return to claim your gold and cash boost!'
    },
    trigger: { hour, minute: 0, repeats: true }
  });
}

export async function cancelDailyReminder() {
  if (Platform.OS === 'web') return;
  try {
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
