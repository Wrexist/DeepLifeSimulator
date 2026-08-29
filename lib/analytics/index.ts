/**
 * Analytics module — the public surface.
 *
 * Usage:
 *   import { track } from '@/lib/analytics';
 *   track('week_advanced', { weeksLived });
 *
 * Feature adoption (§16):
 *   import { trackFeatureUse } from '@/lib/analytics';
 *   trackFeatureUse('darkweb', weeksLived);
 *
 * Experiments (§27-31) — assignment is free, EXPOSURE is what you must call:
 *   import { getVariant, trackExposure } from '@/lib/analytics';
 *   trackExposure('paywall_headline_2026_09');      // at the varied surface
 *   const variant = getVariant('paywall_headline_2026_09');
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
export { ANALYTICS_EVENT_NAMES, ANALYTICS_EVENT_NAME_LIST, isKnownAnalyticsEvent } from './events';

export type { AnalyticsContext, AnalyticsEventContext } from './context';
export { ANALYTICS_SCHEMA_VERSION, getAnalyticsContext } from './context';

export { experiments, getVariant, trackExposure } from './ExperimentService';
export type { ExperimentDefinition, ExperimentVariant } from './experiments';
export { CONTROL_VARIANT, EXPERIMENTS, validateExperiment } from './experiments';

export { featureAdoption, trackFeatureUse, TRACKED_FEATURES } from './featureAdoption';
export type { TrackedFeature } from './featureAdoption';
export { featureForAppId, featureForRoute } from './featureRoutes';

export { classifySaveFailure, trackSaveFailure, trackSaveRepaired, trackStartupDuration } from './reliability';
export type { SaveFailureCategory } from './reliability';

export { PROGRESSION_STAGES, resolveProgressionStage, stageRank } from './progression';
export type { ProgressionStage } from './progression';

export { diffEconomySamples, ECONOMY_SAMPLE_WEEKS, isEconomySampleWeek } from './economySnapshot';
export type { EconomyRollup, EconomySample } from './economySnapshot';

export { clearDebugEvents, getDebugEventCounts, getDebugEvents } from './debugBuffer';
