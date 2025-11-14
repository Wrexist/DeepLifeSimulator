/**
 * App Tracking Transparency (ATT) implementation
 * Complies with Apple's Guideline 5.1.2
 */

import { Platform } from 'react-native';

// Only import on native platforms (iOS/Android), not on web
let TrackingTransparency: any = null;
if (Platform.OS !== 'web') {
  TrackingTransparency = require('expo-tracking-transparency');
}

/**
 * Request tracking permission from the user
 * This MUST be called before any tracking occurs
 */
export async function requestTrackingPermission(): Promise<boolean> {
  // Only relevant for iOS 14+
  if (Platform.OS !== 'ios') {
    console.log('ATT not applicable on', Platform.OS);
    return true; // Android and Web don't require ATT
  }

  // Safety check for web or if module not available
  if (!TrackingTransparency) {
    console.log('TrackingTransparency module not available');
    return true;
  }

  try {
    console.log('Checking current ATT status...');
    
    // Check current status
    const { status: currentStatus } = await TrackingTransparency.getTrackingPermissionsAsync();
    console.log('Current ATT status:', currentStatus);
    
    // If already granted, return true
    if (currentStatus === 'granted') {
      console.log('Tracking permission already granted');
      return true;
    }

    // If not determined yet, request permission
    if (currentStatus === 'undetermined') {
      console.log('Requesting ATT permission from user...');
      const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
      console.log('User response to ATT request:', status);
      
      if (status === 'granted') {
        console.log('✅ Tracking permission granted by user');
        return true;
      } else {
        console.log('❌ Tracking permission denied by user');
        return false;
      }
    }

    // If denied or restricted
    console.log('Tracking permission not available:', currentStatus);
    return false;
  } catch (error) {
    console.error('❌ Error requesting tracking permission:', error);
    return false;
  }
}

/**
 * Check if tracking is allowed without requesting
 */
export async function isTrackingAllowed(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !TrackingTransparency) {
    return true;
  }

  try {
    const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking tracking permission:', error);
    return false;
  }
}

/**
 * Get the current tracking authorization status
 */
export async function getTrackingStatus(): Promise<string> {
  if (Platform.OS !== 'ios' || !TrackingTransparency) {
    return 'not-applicable';
  }

  try {
    const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
    return status;
  } catch (error) {
    console.error('Error getting tracking status:', error);
    return 'error';
  }
}

