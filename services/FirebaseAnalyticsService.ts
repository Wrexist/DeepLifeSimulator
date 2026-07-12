/**
 * Firebase Analytics — error-isolated wrapper.
 *
 * Its ONLY job is to enable Firebase / Google Analytics data collection
 * (consent-gated) so AdMob can attribute revenue to users and populate ARPU.
 * No custom events are needed for that.
 *
 * The native module is lazy-required inside try/catch so a broken SDK can never
 * crash boot — the same defensive pattern as `AdMobService`. Firebase itself
 * auto-initializes from the bundled GoogleService config; we only toggle
 * collection to honor the user's tracking choice.
 */
import { Platform } from 'react-native';
import { logger } from '@/utils/logger';
import { isTrackingAllowed } from '@/utils/trackingTransparency';

const log = logger.scope('FirebaseAnalytics');

let analyticsModule: any = null;
let loadAttempted = false;

function loadModule(): any {
  if (analyticsModule) return analyticsModule;
  if (loadAttempted) return null;
  loadAttempted = true;
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/analytics');
    analyticsModule = mod.default ?? mod;
    return analyticsModule;
  } catch (err: any) {
    log.warn('@react-native-firebase/analytics not available:', err?.message);
    return null;
  }
}

class FirebaseAnalyticsServiceImpl {
  private initialized = false;

  /**
   * Enable collection when tracking is allowed (iOS ATT granted / consent),
   * disable otherwise. Safe to call once at boot after ATT has resolved.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    const analytics = loadModule();
    if (!analytics) return;
    try {
      const allowed = await isTrackingAllowed().catch(() => false);
      await analytics().setAnalyticsCollectionEnabled(allowed);
      this.initialized = true;
      log.info(`Initialized (collection ${allowed ? 'enabled' : 'disabled'})`);
    } catch (err: any) {
      log.warn('init failed:', err?.message);
    }
  }

  /** Update collection consent at runtime (e.g. after an ATT prompt result). */
  async setConsent(allowed: boolean): Promise<void> {
    const analytics = loadModule();
    if (!analytics) return;
    try {
      await analytics().setAnalyticsCollectionEnabled(allowed);
    } catch (err: any) {
      log.warn('setConsent failed:', err?.message);
    }
  }
}

export const firebaseAnalyticsService = new FirebaseAnalyticsServiceImpl();
