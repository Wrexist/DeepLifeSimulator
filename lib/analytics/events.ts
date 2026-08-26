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
  // ── Retention cohorts ──
  //
  // Fired once per NEW day index for an install, carrying how many days after
  // install that is. This is the fact D1/D7/D30 are computed FROM: without it
  // the funnel records that sessions happen but not when, relative to install,
  // and no cohort can be recovered downstream. Emitted alongside `session_start`
  // (which carries the same numbers) so "how many installs returned on day N"
  // is a count over one event rather than a de-dupe across every session.
  //
  // `anchorEstimated` marks installs whose real install date is unknowable —
  // everyone who predates this code. A retention curve MUST filter those out;
  // see `lib/analytics/retentionCohort.ts`.
  | 'retention_day'
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
  // Fired when a recommended goal's achievement LEVEL rises — a savings rung
  // crossed, a job taken, a property bought. Carries the level so "how far up
  // each ladder do players actually get" is answerable, which is the question
  // that says whether the mid-game flattens.
  | 'goal_reached'
  | 'week_ahead_shown'
  // Fired when the welcome-back return summary is actually SEEN (it holds the
  // interruption slot), carrying how long the player was away in days. This is
  // the top of the return funnel: without it, "do returning players who see the
  // summary retain better" is unanswerable, because nothing records that the
  // summary rendered at all — the popup can lose the slot race and silently
  // never show.
  | 'return_summary_viewed'
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
  //
  // The subscription funnel, end to end:
  //
  //   paywall_open_tapped  (which surface sent them)
  //     → paywall_viewed   (the sheet rendered)
  //     → paywall_plan_selected / paywall_intro_offer_shown
  //     → paywall_cta_tapped
  //     → purchase_started → purchase_succeeded | purchase_cancelled | purchase_failed
  //     → premium_activated (entitlement actually applied to the save)
  //     → first_premium_value (they USED a perk they are paying for)
  //
  // Every step above used to stop at `paywall_cta_tapped`, so the largest drop-
  // off on any subscription funnel — CTA to completed purchase — was invisible,
  // and so was the question that decides renewal: do new subscribers ever touch
  // what they bought? A subscriber who never uses a perk churns, and without
  // `first_premium_value` that is only knowable after they have already gone.
  //
  // `paywall_dismissed` carries how long the sheet was open and whether a plan
  // was ever selected, which separates "not interested" from "interested, lost
  // at the price".
  // ── The consumable-IAP funnel's missing top ──
  //
  // The gem shop fired NOTHING, so the consumable funnel began at
  // `purchase_started` and the largest drop - shop view → buy tap - was
  // unmeasurable. `iap_shop_viewed` carries the opening tab (Featured / gems /
  // perks / store), `iap_shop_dismissed` carries dwell + the tab the player
  // left from, mirroring what `paywall_dismissed` does for the subscription.
  | 'iap_shop_viewed'
  | 'iap_shop_dismissed'
  | 'paywall_open_tapped'
  | 'paywall_viewed'
  | 'paywall_plan_selected'
  | 'paywall_intro_offer_shown'
  | 'paywall_cta_tapped'
  | 'paywall_dismissed'
  | 'purchase_started'
  | 'purchase_succeeded'
  // A player backing out of the store sheet, kept apart from a real failure:
  // one is a pricing/offer signal, the other is a defect to fix.
  | 'purchase_cancelled'
  | 'purchase_failed'
  | 'restore_started'
  | 'restore_succeeded'
  | 'restore_failed'
  // Entitlement applied to the save — the step between "the store took the
  // money" and "the player has the thing". A gap between purchase_succeeded and
  // premium_activated is a fulfilment bug that would otherwise surface only as
  // a support ticket.
  | 'premium_activated'
  // The first time a subscriber uses a perk they are paying for.
  | 'first_premium_value'
  // ── Subscription lifecycle (client-observed via RevenueCat customerInfo) ──
  //
  // The gap these close: the app could not SEE a cancellation. Cancelling
  // happens in the store, outside the app, and nothing read `willRenew` off
  // the customerInfo the service already fetched - so a subscriber who
  // cancelled yesterday and a delighted one were indistinguishable until the
  // entitlement silently lapsed, and no retention change could be judged
  // against the metric it exists to move (renewals).
  //
  // `subscription_state` is the once-per-session snapshot (phase +
  // daysUntilExpiry) that gives the time series; the four edges are the
  // actionable moments. `subscription_cancel_detected` fires when auto-renew
  // turns OFF while still entitled - the win-back window opens.
  // `subscription_recovered` fires when it turns back ON - the win-back
  // WORKED, which is the number the whole effort is judged by.
  // Client-observed, so edges are detected at next app open, not in real
  // time; a RevenueCat webhook would be the authoritative upgrade.
  | 'subscription_state'
  | 'subscription_cancel_detected'
  | 'subscription_renewed'
  | 'subscription_recovered'
  | 'subscription_lapsed'
  // ── Trial + dunning edges ──
  //
  // The 7-day trial's whole rationale (see DEEP_LIFE_PLUS_FREE_TRIAL_DAYS in
  // lib/subscription/deepLifePlus.ts) is argued from trial→paid conversion -
  // a metric nothing recorded: `paywall_intro_offer_shown` logs that a trial
  // was PRESENTED, and `trial` existed only as a phase property inside
  // `subscription_state`. These two edges make the number computable.
  // `subscription_billing_issue` opens the dunning window as its own event so
  // recovery-rate can be judged (its close is `subscription_recovered`).
  // Client-observed like the other edges: detected at next app open.
  | 'trial_started'
  | 'trial_converted'
  | 'subscription_billing_issue'
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
  'retention_day',
  'goal_tapped',
  'goal_reached',
  'week_ahead_shown',
  'return_summary_viewed',
  'offer_center_opened',
  'offer_shown',
  'offer_cta_tapped',
  'iap_shop_viewed',
  'iap_shop_dismissed',
  'paywall_open_tapped',
  'paywall_viewed',
  'paywall_plan_selected',
  'paywall_intro_offer_shown',
  'paywall_cta_tapped',
  'paywall_dismissed',
  'purchase_started',
  'purchase_succeeded',
  'purchase_cancelled',
  'purchase_failed',
  'restore_started',
  'restore_succeeded',
  'restore_failed',
  'premium_activated',
  'first_premium_value',
  'subscription_state',
  'subscription_cancel_detected',
  'subscription_renewed',
  'subscription_recovered',
  'subscription_lapsed',
  'trial_started',
  'trial_converted',
  'subscription_billing_issue',
  'ad_shown',
  'ad_rewarded',
  'screen_view',
]);

export function isKnownAnalyticsEvent(name: string): name is AnalyticsEventName {
  return ANALYTICS_EVENT_NAMES.has(name as AnalyticsEventName);
}
