/**
 * App Tracking Transparency (ATT) implementation
 * Complies with Apple's Guideline 5.1.2
 */

import { Platform } from 'react-native';

// Only import on native platforms (iOS/Android), not on web
// Lazy-load to avoid bundler issues on web
let TrackingTransparency: any = null;
let trackingTransparencyLoaded = false;

function loadTrackingTransparency(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  
  if (trackingTransparencyLoaded && TrackingTransparency) {
    return true;
  }
  
  try {
    const moduleName = 'expo-tracking-transparency';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    TrackingTransparency = require(moduleName);
    trackingTransparencyLoaded = true;
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn('expo-tracking-transparency not available');
    }
    return false;
  }
}

/**
 * Request tracking permission from the user
 * This MUST be called before any tracking occurs
 */
export async function requestTrackingPermission(): Promise<boolean> {
  // Only relevant for iOS 14+
  if (Platform.OS !== 'ios') {
    if (__DEV__) {
      console.log('ATT not applicable on', Platform.OS);
    }
    return true; // Android and Web don't require ATT
  }

  // Lazy-load the module
  if (!loadTrackingTransparency() || !TrackingTransparency) {
    if (__DEV__) {
      console.log('TrackingTransparency module not available');
    }
    return true;
  }

  try {
    if (__DEV__) {
      console.log('Checking current ATT status...');
    }
    
    // Check current status
    const { status: currentStatus } = await TrackingTransparency.getTrackingPermissionsAsync();
    if (__DEV__) {
      console.log('Current ATT status:', currentStatus);
    }
    
    // If already granted, return true
    if (currentStatus === 'granted') {
      if (__DEV__) {
        console.log('Tracking permission already granted');
      }
      return true;
    }

    // If not determined yet, request permission
    if (currentStatus === 'undetermined') {
      if (__DEV__) {
        console.log('Requesting ATT permission from user...');
      }
      const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
      if (__DEV__) {
        console.log('User response to ATT request:', status);
      }
      
      if (status === 'granted') {
        if (__DEV__) {
          console.log('✅ Tracking permission granted by user');
        }
        return true;
      } else {
        if (__DEV__) {
          console.log('❌ Tracking permission denied by user');
        }
        return false;
      }
    }

    // If denied or restricted
    if (__DEV__) {
      console.log('Tracking permission not available:', currentStatus);
    }
    return false;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Error requesting tracking permission:', error);
    }
    return false;
  }
}

/**
 * Check if tracking is allowed without requesting
 */
export async function isTrackingAllowed(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return true;
  }
  
  if (!loadTrackingTransparency() || !TrackingTransparency) {
    return true;
  }

  try {
    const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    if (__DEV__) {
      console.error('Error checking tracking permission:', error);
    }
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
    if (__DEV__) {
      console.error('Error getting tracking status:', error);
    }
    return 'error';
  }
}

