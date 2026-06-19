/**
 * Analytics module (Wave 0.1).
 *
 * Usage:
 *   import { track } from '@/lib/analytics';
 *   track('week_advanced', { weeksLived });
 *
 * Boot (once, in app/_layout.tsx after consent is known):
 *   import { analytics } from '@/lib/analytics';
 *   await analytics.init();
 *   analytics.setConsent(userGrantedConsent);
 */
export { analytics, track } from './AnalyticsService';
export type {
  AnalyticsEvent,
  AnalyticsEventName,
  AnalyticsProps,
} from './events';
export { ANALYTICS_EVENT_NAMES, isKnownAnalyticsEvent } from './events';
