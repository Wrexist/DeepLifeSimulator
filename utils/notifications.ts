// STUB: expo-notifications removed to fix TurboModule crash
// All notification functions are now no-ops
import { logger } from './logger';

const log = logger.scope('Notifications');

// Stub notification functions - all return safe defaults
export async function scheduleNotification(
  title: string,
  body: string,
  _trigger: any
): Promise<string> {
  if (__DEV__) {
    log.info('Notification scheduled (stubbed):', { title, body });
  }
  return 'stub-notification-id';
}

export async function cancelNotification(notificationId: string): Promise<void> {
  if (__DEV__) {
    log.info('Notification cancelled (stubbed):', { notificationId });
  }
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  if (__DEV__) {
    log.info('All notifications cancelled (stubbed)');
  }
}

export async function requestPermissionsAsync(): Promise<{ status: string }> {
  if (__DEV__) {
    log.info('Notification permissions requested (stubbed)');
  }
  return { status: 'denied' };
}

export async function getPermissionsAsync(): Promise<{ status: string }> {
  return { status: 'denied' };
}

export function addNotificationReceivedListener(_listener: (notification: any) => void): { remove: () => void } {
  return {
    remove: () => {
      if (__DEV__) {
        log.info('Notification listener removed (stubbed)');
      }
    }
  };
}

export function addNotificationResponseReceivedListener(_listener: (response: any) => void): { remove: () => void } {
  return {
    remove: () => {
      if (__DEV__) {
        log.info('Notification response listener removed (stubbed)');
      }
    }
  };
}

// Export stub notification object for compatibility
export const Notifications = {
  scheduleNotificationAsync: scheduleNotification,
  cancelScheduledNotificationAsync: cancelNotification,
  cancelAllScheduledNotificationsAsync: cancelAllScheduledNotifications,
  requestPermissionsAsync,
  getPermissionsAsync,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
};

export function notifyAchievementUnlock(name: string, reward: number): void {
  if (__DEV__) {
    log.info('Achievement unlocked (stubbed):', { name, reward });
  }
}

export function notifySecretAchievementUnlock(name: string, reward: number): void {
  if (__DEV__) {
    log.info('Secret achievement unlocked (stubbed):', { name, reward });
  }
}

export default Notifications;
