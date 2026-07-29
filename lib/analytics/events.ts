/**
 * Analytics event schema (Wave 0.1).
 *
 * A small, typed catalogue of the gameplay + funnel events we need to measure
 * retention (D1/D7/D30), monetisation funnels, and churn points. Keep this list
 * intentional: every event here should answer a question we actually have.
 *
 * NOTE: This is a *pure-data* schema. The transport (`AnalyticsService`) is
 * deliberately a plain-JS HTTP batcher with NO native SDK — the previous
 * analytics path (Sentry, a TurboModule) crashed on iOS 26, so we never
 * reintroduce a native analytics dependency here.
 */

/** All known event names. Adding one here is the only way to make it trackable. */
export type AnalyticsEventName =
  // ── Session lifecycle ──
  | 'session_start'
  | 'session_end'
  // ── Onboarding funnel ──
  | 'onboarding_step'
  | 'tutorial_step'
  | 'first_week_completed'
  // ── Core loop ──
  | 'week_advanced'
  | 'prestige'
  | 'death'
  // ── Engagement / retention ──
  | 'daily_reward_claimed'
  | 'challenge_completed'
  | 'streak_changed'
  | 'achievement_unlocked'
  // ── Monetisation funnel ──
  | 'paywall_open_tapped'
  | 'paywall_viewed'
  | 'paywall_cta_tapped'
  | 'purchase_started'
  | 'purchase_succeeded'
  | 'purchase_failed'
  | 'ad_shown'
  | 'ad_rewarded'
  // ── Photo-to-avatar (DeepLife+) ──
  // The funnel this measures: how many players who see the two-card entry
  // screen tap the selfie card, how many of those already own DeepLife+, and
  // of the runs that start, how many produce a face the player keeps. Without
  // `avatar_photo_kept` the feature can look successful while everybody
  // discards the result.
  | 'avatar_entry_viewed'
  | 'avatar_photo_started'
  | 'avatar_photo_generated'
  // Whether the background cut-out produced a usable portrait. Separate from
  // `avatar_photo_generated` because they fail independently: the analysis can
  // succeed on a photo the matte cannot separate, and vice versa.
  | 'avatar_photo_portrait'
  | 'avatar_photo_provider_failed'
  | 'avatar_photo_failed'
  | 'avatar_photo_kept'
  | 'avatar_photo_discarded'
  // ── Navigation ──
  | 'screen_view';

/** Property bags are intentionally loose (string/number/boolean) for transport safety. */
export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

/** A queued, not-yet-sent event. */
export interface AnalyticsEvent {
  /** Locally-unique id (used for de-dupe on the receiving end). */
  id: string;
  /** Event name from the catalogue above. */
  name: AnalyticsEventName;
  /** ISO timestamp the event was recorded on-device. */
  ts: string;
  /** Anonymous, app-generated install id (NOT a device/advertising id). */
  installId: string;
  /** Per-launch session id, ties events in one session together. */
  sessionId: string;
  /** Arbitrary, sanitised properties. */
  props?: AnalyticsProps;
}

/** The set of valid names, for runtime validation (track() rejects unknown names). */
export const ANALYTICS_EVENT_NAMES: ReadonlySet<AnalyticsEventName> = new Set<AnalyticsEventName>([
  'session_start',
  'session_end',
  'onboarding_step',
  'tutorial_step',
  'first_week_completed',
  'week_advanced',
  'prestige',
  'death',
  'daily_reward_claimed',
  'challenge_completed',
  'streak_changed',
  'achievement_unlocked',
  'paywall_open_tapped',
  'avatar_entry_viewed',
  'avatar_photo_started',
  'avatar_photo_generated',
  'avatar_photo_portrait',
  'avatar_photo_provider_failed',
  'avatar_photo_failed',
  'avatar_photo_kept',
  'avatar_photo_discarded',
  'paywall_viewed',
  'paywall_cta_tapped',
  'purchase_started',
  'purchase_succeeded',
  'purchase_failed',
  'ad_shown',
  'ad_rewarded',
  'screen_view',
]);

export function isKnownAnalyticsEvent(name: string): name is AnalyticsEventName {
  return ANALYTICS_EVENT_NAMES.has(name as AnalyticsEventName);
}
