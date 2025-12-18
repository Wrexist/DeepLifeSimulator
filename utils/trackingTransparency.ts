/**
 * App Tracking Transparency (ATT) implementation
 * Complies with Apple's Guideline 5.1.2
 */

import { Platform } from 'react-native';

// Only import on native platforms (iOS/Android), not on web
// Lazy-load to avoid bundler issues on web
let TrackingTransparency: any = null;
let trackingTransparencyLoaded = false;
let trackingTransparencyLoadAttempted = false;

// Track if module loading failed to avoid repeated attempts
let trackingTransparencyLoadFailed = false;

function loadTrackingTransparency(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  
  // If we've already tried and failed, don't try again
  if (trackingTransparencyLoadFailed) {
    return false;
  }
  
  if (trackingTransparencyLoaded && TrackingTransparency) {
    return true;
  }
  
  // Prevent multiple simultaneous load attempts
  if (trackingTransparencyLoadAttempted) {
    return false;
  }
  
  trackingTransparencyLoadAttempted = true;
  
  try {
    // Add a small delay to ensure native modules are fully initialized
    // This helps prevent crashes during app startup
    const moduleName = 'expo-tracking-transparency';
    
    // Use a more defensive require that can handle native module initialization failures
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require(moduleName);
    
    // Verify the module has the expected methods before using it
    if (module && typeof module.getTrackingPermissionsAsync === 'function') {
      TrackingTransparency = module;
      trackingTransparencyLoaded = true;
      return true;
    } else {
      if (__DEV__) {
        console.warn('expo-tracking-transparency module loaded but missing expected methods');
      }
      trackingTransparencyLoadFailed = true;
      return false;
    }
  } catch (error: any) {
    trackingTransparencyLoadFailed = true;
    if (__DEV__) {
      console.warn('expo-tracking-transparency not available:', error?.message || error);
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

  // Add a small delay to ensure the app is fully initialized before accessing native modules
  // This helps prevent crashes during app startup
  await new Promise(resolve => setTimeout(resolve, 100));

  // Lazy-load the module with additional safety checks
  if (!loadTrackingTransparency() || !TrackingTransparency) {
    if (__DEV__) {
      console.log('TrackingTransparency module not available');
    }
    // Return true to allow app to continue - ads will work without personalization
    return true;
  }

  try {
    // Verify the module methods exist before calling them
    if (typeof TrackingTransparency.getTrackingPermissionsAsync !== 'function') {
      if (__DEV__) {
        console.warn('TrackingTransparency.getTrackingPermissionsAsync is not a function');
      }
      return true;
    }

    if (__DEV__) {
      console.log('Checking current ATT status...');
    }
    
    // Check current status with additional error handling
    let currentStatus: string;
    try {
      const result = await TrackingTransparency.getTrackingPermissionsAsync();
      currentStatus = result?.status;
      
      if (!currentStatus) {
        if (__DEV__) {
          console.warn('getTrackingPermissionsAsync returned invalid result');
        }
        return true; // Default to allowing app to continue
      }
    } catch (statusError: any) {
      if (__DEV__) {
        console.error('Error getting tracking status:', statusError?.message || statusError);
      }
      // If we can't get the status, default to allowing the app to continue
      return true;
    }
    
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
      // Verify request method exists
      if (typeof TrackingTransparency.requestTrackingPermissionsAsync !== 'function') {
        if (__DEV__) {
          console.warn('TrackingTransparency.requestTrackingPermissionsAsync is not a function');
        }
        return true;
      }

      if (__DEV__) {
        console.log('Requesting ATT permission from user...');
      }
      
      try {
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
      } catch (requestError: any) {
        if (__DEV__) {
          console.error('Error requesting tracking permission:', requestError?.message || requestError);
        }
        // If request fails, default to allowing app to continue
        return true;
      }
    }

    // If denied or restricted
    if (__DEV__) {
      console.log('Tracking permission not available:', currentStatus);
    }
    return false;
  } catch (error: any) {
    if (__DEV__) {
      console.error('❌ Error requesting tracking permission:', error?.message || error);
    }
    // Default to allowing app to continue - better than crashing
    return true;
  }
}

/**
 * Check if tracking is allowed without requesting
 */
export async function isTrackingAllowed(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return true;
  }
  
  // Add a small delay to ensure the app is fully initialized
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (!loadTrackingTransparency() || !TrackingTransparency) {
    return true;
  }

  try {
    if (typeof TrackingTransparency.getTrackingPermissionsAsync !== 'function') {
      return true;
    }
    
    const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
    return status === 'granted';
  } catch (error: any) {
    if (__DEV__) {
      console.error('Error checking tracking permission:', error?.message || error);
    }
    // Default to false for checking (more conservative)
    return false;
  }
}

/**
 * Get the current tracking authorization status
 */
export async function getTrackingStatus(): Promise<string> {
  if (Platform.OS !== 'ios') {
    return 'not-applicable';
  }

  // Add a small delay to ensure the app is fully initialized
  await new Promise(resolve => setTimeout(resolve, 100));

  if (!loadTrackingTransparency() || !TrackingTransparency) {
    return 'not-available';
  }

  try {
    if (typeof TrackingTransparency.getTrackingPermissionsAsync !== 'function') {
      return 'error';
    }
    
    const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
    return status || 'error';
  } catch (error: any) {
    if (__DEV__) {
      console.error('Error getting tracking status:', error?.message || error);
    }
    return 'error';
  }
}

