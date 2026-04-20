import { Alert, Linking, Platform } from 'react-native';
// CRITICAL: Lazy-load expo-constants to prevent TurboModule crash at module load
// import Constants from 'expo-constants'; // REMOVED - lazy load
// import * as Updates from 'expo-updates'; // REMOVED - not used, commented out below
import { logger } from './logger';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/config/appConfig';

// Lazy-loaded Constants module
let Constants: any = null;
let constantsLoadAttempted = false;

function loadConstantsModule(): boolean {
  if (constantsLoadAttempted) {
    return Constants !== null;
  }
  
  constantsLoadAttempted = true;
  
  try {
    Constants = require('expo-constants').default;
    return true;
  } catch (error) {
    // Module not available
    return false;
  }
}

// Minimum required version - update this when you need to force an update
const MIN_REQUIRED_VERSION = '2.2.4'; // Set to your current version
const MIN_REQUIRED_BUILD_NUMBER = 31; // iOS build number

/**
 * Compare two version strings (e.g., "2.2.4" vs "2.2.3")
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }
  return 0;
}

/**
 * Check if app needs to be updated and show blocking alert if required
 * @returns true if update is required (blocking), false otherwise
 */
export async function checkForForceUpdate(): Promise<boolean> {
  try {
    // Try to load Constants module
    if (!loadConstantsModule()) {
      logger.warn('expo-constants not available - skipping version check');
      return false;
    }

    const currentVersion = Constants.expoConfig?.version || '0.0.0';
    const currentBuild = Platform.OS === 'ios' 
      ? parseInt(Constants.expoConfig?.ios?.buildNumber || '0', 10)
      : parseInt(Constants.expoConfig?.android?.versionCode?.toString() || '0', 10);

    logger.info(`Version check - Current: ${currentVersion} (${currentBuild}), Required: ${MIN_REQUIRED_VERSION} (${MIN_REQUIRED_BUILD_NUMBER})`);

    // Compare versions
    const versionComparison = compareVersions(currentVersion, MIN_REQUIRED_VERSION);
    const needsUpdate = versionComparison < 0 ||
      (Platform.OS === 'ios' && currentBuild < MIN_REQUIRED_BUILD_NUMBER) ||
      (Platform.OS === 'android' && currentBuild < MIN_REQUIRED_BUILD_NUMBER);

    if (needsUpdate) {
      logger.warn(`Force update required. Current: ${currentVersion} (${currentBuild}), Required: ${MIN_REQUIRED_VERSION} (${MIN_REQUIRED_BUILD_NUMBER})`);
      
      const storeUrl = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
      
      Alert.alert(
        'Update Required',
        'A new version of the app is required to continue playing. Please update from the App Store.',
        [
          {
            text: 'Update Now',
            onPress: () => {
              Linking.openURL(storeUrl).catch((error) => {
                logger.error('Failed to open store URL:', error);
                Alert.alert('Error', 'Unable to open the App Store. Please update manually.');
              });
            },
          },
        ],
        { cancelable: false }
      );
      return true;
    }

    // Check for OTA updates (Expo Updates)
    // TEMPORARILY DISABLED: Updates disabled in app.config.js to prevent startup crashes
    // Re-enable after crash issues are resolved
    /*
    if (Updates.isEnabled) {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          logger.info('OTA update available, fetching...');
          await Updates.fetchUpdateAsync();
          
          Alert.alert(
            'Update Available',
            'A new version is available. Restart the app to apply the update.',
            [
              {
                text: 'Restart Now',
                onPress: async () => {
                  try {
                    await Updates.reloadAsync();
                  } catch (error) {
                    logger.error('Failed to reload app with update:', error);
                    Alert.alert('Error', 'Failed to apply update. Please restart the app manually.');
                  }
                },
              },
              {
                text: 'Later',
                style: 'cancel',
              },
            ]
          );
        } else {
          logger.info('No OTA updates available');
        }
      } catch (error) {
        logger.warn('Failed to check for OTA updates:', error);
        // Don't block app if OTA check fails
      }
    }
    */

    return false;
  } catch (error) {
    logger.error('Error checking for updates:', error);
    // Don't block app if version check fails
    return false;
  }
}

/**
 * Get current app version info
 */
export function getCurrentVersionInfo(): { version: string; buildNumber: number; platform: string } {
  // Try to load Constants module
  if (!loadConstantsModule()) {
    return {
      version: '0.0.0',
      buildNumber: 0,
      platform: Platform.OS,
    };
  }

  const version = Constants.expoConfig?.version || '0.0.0';
  const buildNumber = Platform.OS === 'ios'
    ? parseInt(Constants.expoConfig?.ios?.buildNumber || '0', 10)
    : parseInt(Constants.expoConfig?.android?.versionCode?.toString() || '0', 10);
  
  return {
    version,
    buildNumber,
    platform: Platform.OS,
  };
}

