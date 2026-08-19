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
  // ── Direction & anticipation ──
  //
  // The retention question these answer is "does telling players what to do
  // next change what they do?". `goal_tapped` carries the goal id, its horizon
  // and its progress, so a goal nobody ever taps is visible as dead weight
  // rather than as a card that merely looks fine. `week_ahead_shown` records
  // that the anticipation surface had something to say at all — a player who
  // never sees it cannot be retained by it, and the row count separates
  // "shown and ignored" from "never shown".
  | 'goal_tapped'
  | 'week_ahead_shown'
  // ── Rotating offers ──
  //
  // The full funnel for the weekly rotation: opened → the featured offer was
  // rendered → the buy button was tapped. Purchase itself continues to be
  // reported by the existing `purchase_*` events, which carry the productId,
  // so offer revenue joins on that rather than being double-counted here.
  // `offer_shown` carries `discounted` so a week WITH a scheduled App Store
  // Connect price change can be compared against a week without one — the only
  // way to tell whether the discount or the rotation is doing the work.
  | 'offer_center_opened'
  | 'offer_shown'
  | 'offer_cta_tapped'
  // ── Monetisation funnel ──
  | 'paywall_open_tapped'
  | 'paywall_viewed'
  | 'paywall_cta_tapped'
  | 'purchase_started'
  | 'purchase_succeeded'
  | 'purchase_failed'
  | 'ad_shown'
  | 'ad_rewarded'
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
  'goal_tapped',
  'week_ahead_shown',
  'offer_center_opened',
  'offer_shown',
  'offer_cta_tapped',
  'paywall_open_tapped',
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
