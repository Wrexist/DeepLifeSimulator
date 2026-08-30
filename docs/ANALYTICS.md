# Analytics, Experimentation & Telemetry

The reference for what DeepLife Simulator measures, why each thing is measured,
and what the data cannot tell you. Read the "Limitations" section before quoting
a number to anyone.

Code lives in `lib/analytics/`. The one rule that governs all of it: **analytics
must never be able to take down the app.** Every public entry point swallows its
own errors, every native module is lazily required inside a `try`/`catch`, and
every gate degrades toward "collect nothing" rather than toward a throw.

---

## 1. Architecture

```
game action
  └─> track(name, props)                         lib/analytics/AnalyticsService.ts
        ├─ name validated against the catalogue  lib/analytics/events.ts
        ├─ props scrubbed / coerced / capped     lib/analytics/validation.ts
        ├─ idempotent repeats collapsed          lib/analytics/validation.ts
        ├─ common envelope attached              lib/analytics/context.ts
        ├─ experiment arms attached              lib/analytics/ExperimentService.ts
        ├─ recorded to the dev inspector         lib/analytics/debugBuffer.ts   (__DEV__ only)
        ├─> SINK A: Firebase Analytics           services/FirebaseAnalyticsService.ts
        └─> SINK B: batched HTTP queue ─> flush every 60s / on background
```

### The two sinks are independent, on purpose

Sink A (Firebase) needs no server; sink B (the self-hosted queue) needs
`EXPO_PUBLIC_ANALYTICS_URL`. The Firebase forward happens **before** the queue's
`active` check so that "no endpoint configured" cannot silently disable
Firebase too. That independence has to hold at the boot call site as well —
`app/_layout.tsx` initialises telemetry when **either** flag is on. It once did
not, and the entire product funnel reached nothing in production while the
Firebase dashboard still looked alive from its own automatic events.

### Gating

| Gate | Where | Effect when off |
|---|---|---|
| `FEATURE_FLAGS.telemetry` | `lib/config/featureFlags.ts` | HTTP queue disabled |
| `FEATURE_FLAGS.firebaseAnalytics` | same | Firebase forward disabled |
| Consent (ATT / UMP) | `analytics.setConsent()` | **both** sinks disabled |
| `EXPO_PUBLIC_ANALYTICS_URL` | env | HTTP queue records but never sends |

`BORING_BUILD_MODE` (default on in `__DEV__`) forces both flags off.

---

## 2. Event taxonomy

**Convention: `category_action`, lower `snake_case`, no abbreviations.**
Enforced by `__tests__/analytics/eventTaxonomy.test.ts`, which fails CI on a
name that does not match, on a duplicate, and on a funnel step that names an
event that does not exist.

`lib/analytics/events.ts` is the single source of truth: the TypeScript union
and the runtime validation set are both **derived** from one array. They used to
be written out separately, which made "add the name to the type, forget the
Set" a silent failure — the call site type-checks, the event is dropped at
runtime, and the only symptom is a funnel step that is permanently empty.

### The catalogue, by group

| Group | Events |
|---|---|
| Session | `session_start` `session_end` |
| Onboarding | `onboarding_step` `tutorial_step` `first_week_completed` |
| Core loop | `week_advanced` `prestige` `death` |
| Engagement | `daily_reward_claimed` `challenge_completed` `streak_changed` `achievement_unlocked` |
| Retention | `retention_day` |
| Direction | `goal_tapped` `goal_reached` `week_ahead_shown` `return_summary_viewed` |
| Progression | `progression_stage` |
| Economy | `economy_week` |
| Adoption | `feature_first_used` `feature_used` |
| Experiments | `experiment_exposed` |
| Offers | `offer_center_opened` `offer_shown` `offer_cta_tapped` |
| IAP shop | `iap_shop_viewed` `iap_shop_dismissed` |
| Paywall | `paywall_open_tapped` `paywall_viewed` `paywall_plan_selected` `paywall_intro_offer_shown` `paywall_cta_tapped` `paywall_dismissed` |
| Purchase | `purchase_started` `purchase_succeeded` `purchase_cancelled` `purchase_failed` |
| Restore | `restore_started` `restore_succeeded` `restore_failed` |
| Entitlement | `premium_activated` `first_premium_value` |
| Subscription | `subscription_state` `subscription_cancel_detected` `subscription_renewed` `subscription_recovered` `subscription_lapsed` |
| Trial / dunning | `trial_started` `trial_converted` `subscription_billing_issue` |
| Ads | `ad_shown` `ad_rewarded` |
| Technical health | `save_failed` `save_repaired` `app_startup` |
| Navigation | `screen_view` |

### The common envelope

Every event carries `ctx`:

| Field | Why |
|---|---|
| `schemaVersion` | So a query written against an older envelope can exclude a newer one instead of averaging two definitions together |
| `appVersion` | Release cohorting — a 2.9.0 regression vs a 2.8.1 one |
| `buildNumber` | Two builds of one marketing version are different binaries |
| `platform` | An iOS-only funnel drop must not read as a global one |
| `osMajor` | Major only. Answers "is this an OS regression" without narrowing a user |
| `experiments` | `id:variant` pairs, so **any** metric splits by arm with a filter rather than a join |

Bump `ANALYTICS_SCHEMA_VERSION` when a field is added, removed, or changes
meaning.

### Validation

- Unknown event names are dropped (dev warning).
- Sensitive keys are **redacted**, not removed, so a leaking call site is
  visible in the data and can be fixed.
- `NaN` / `Infinity` are **dropped**, not sent — they serialise to `null`,
  which reads downstream as a measured empty value.
- Objects, arrays and functions are dropped rather than stringified; a
  `"[object Object]"` column is worse than no column.
- Caps: 24 properties, 256 characters per string.
- **De-duplication is opt-in**, restricted to impressions and snapshots
  (`IDEMPOTENT_EVENTS`). It never applies to anything that moves money, grants a
  reward, or advances progression — there, a repeat *is* the finding, and
  suppressing it would delete the evidence of the double-grant bug class this
  repo keeps shipping (CLAUDE.md §4.4).

---

## 3. Funnels

**Onboarding**
`session_start` → `onboarding_step` (per step) → `tutorial_step` → `first_week_completed`

`first_week_completed` measures weeks into **this life**, not raw `weeksLived` —
the absolute counter is seeded from the starting age, so `>= 1` is already true
at mount for every scenario that does not start at 18 (CLAUDE.md §4.2).

**Subscription**
`paywall_open_tapped` → `paywall_viewed` → `paywall_plan_selected` /
`paywall_intro_offer_shown` → `paywall_cta_tapped` → `purchase_started` →
`purchase_succeeded` → `premium_activated` → `first_premium_value`

A gap between `purchase_succeeded` and `premium_activated` is a **fulfilment
bug**. `first_premium_value` is the renewal predictor: a subscriber who never
touches a perk churns, and without it that is only knowable after they have gone.

**Consumable IAP** `iap_shop_viewed` → `purchase_started` → `purchase_succeeded`

**Offers** `offer_center_opened` → `offer_shown` → `offer_cta_tapped` → (`purchase_*` joins on `productId`)

**Progression** `week_advanced` → `progression_stage` → `prestige` / `death`

**Adoption** `feature_first_used` (discovery) → `feature_used` (return)

---

## 4. Retention

`lib/analytics/retentionCohort.ts` anchors every install and emits `dayIndex`
on `session_start` plus one `retention_day` per new day.

**The device reports facts; the sink defines the metric.** Classic day-N
("returned on day N exactly") and rolling N-day ("returned on day N or later")
disagree, both are one query away from `dayIndex`, and neither can be recovered
if the device picks one. Benchmarks in
`tasks/retention-and-content-strategy-2026-06-19.md` are classic day-N.

**`anchorEstimated: true` records MUST be excluded from any retention curve.**
There is no install timestamp in this app's history and none can be recovered,
so every install that predates this code has a fabricated anchor. The curve
starts accumulating from the release that shipped the cohort, and there is no
honest way around that.

### Churn signals

No single signal means churn. Investigate a combination:
falling `session_start` frequency · shortening `session_end.durationSec` ·
`progression_stage` stalled in one stage well past its cohort median ·
`subscription_cancel_detected` · long `retention_day` gaps ·
`economy_week.netFlow` persistently negative with rising `overdueBalance`.

---

## 5. Progression

`progression_stage` fires on the **edge** between `new → early → mid → late →
endgame` (`lib/analytics/progression.ts`), never per week, and carries
`weeksInPreviousStage`.

- A stage everyone reaches and nobody leaves is a **content wall**.
- A stage taking several times as long as the one before it is a **difficulty spike**.
- Stage regressions are emitted, not filtered: prestige resets the life clock,
  so a forward-only guard would drop the transition that matters most for the
  endgame loop. `direction` records which it was.

A prestiged player is `endgame` even at week 1 of the new life. Classifying them
as `new` would push experienced players into the new-player funnel and make
onboarding drop-off look better than it is. The consequence is that **`endgame`
is terminal**: once an install has prestiged, no further stage edges are
emitted, because `totalPrestiges` never decreases. The endgame loop is measured
by `prestige`, `week_advanced` and `economy_week` instead. If the endgame ever
needs its own ladder, it is a new stage axis, not a change to this one — moving
players back down it would make time-in-stage incomparable across the whole
history.

---

## 6. Economy

`economy_week` is a **sampled aggregate rollup**, one in-game month at a time
(`lib/analytics/economySnapshot.ts`).

Not per-transaction, for two independent reasons: the money path runs inside
`setGameState` updaters (CLAUDE.md §4.4), the hottest code in the app; and the
queue caps at 200 events, so a player advancing thirty weeks in a sitting would
evict their own paywall and session events to make room for grocery purchases.

Carries per-**game-week** rates, never wall-clock rates, so a rollup covering a
long absence is comparable with one covering four active weeks.

Reading it:
- `netFlow` persistently positive across the population → **inflation**.
- `netFlow` persistently negative with rising arrears → **starvation**.
- The upper tail of `earnedPerWeek` / `netWorthPerWeek` → progression that
  outruns what the design allows (§20).

**Exploit telemetry is for fixing systems, never for punishing players.** No
player is penalised from this data, and no device-side accusation is ever made.

---

## 7. Monetisation

Track the whole funnel, and never judge a monetisation change on revenue alone.
A change that lifts immediate revenue and destroys retention is a loss. Read
conversion **with** `retention_day`, `session_end`, `subscription_renewed` and
`first_premium_value`.

Client-observed subscription edges (cancel / renew / recover / lapse / billing
issue) are detected at **next app open**, not in real time — cancelling happens
in the store, outside the app. A RevenueCat webhook would be the authoritative
upgrade.

---

## 8. Segments

| Axis | Values | Source |
|---|---|---|
| Progression | `new` `early` `mid` `late` `endgame` | `resolveProgressionStage` |
| Engagement | `one_session` `casual` `engaged` | `resolveEngagementSegment` (per-day session rate) |
| Monetisation | `free` `trial` `subscriber` `lapsed` | `resolveMonetisationSegment` |
| Release | `ctx.appVersion` / `ctx.buildNumber` | envelope |
| Platform | `ctx.platform` / `ctx.osMajor` | envelope |
| Experiment | `ctx.experiments` | envelope |

`lapsed` is deliberately not merged into `free`: one has never been asked, the
other answered and left. Merging them targets win-back at non-converters.

---

## 9. Experiments

`lib/analytics/experiments.ts` (registry + pure assignment) and
`lib/analytics/ExperimentService.ts` (pinning + exposure).

**The registry is empty by design.** Shipping the infrastructure and shipping a
running experiment are separate decisions; inventing one to demonstrate the
plumbing would put a real behaviour change in front of real players to serve a
demo. The first entry is a product call.

### Adding one

`ExperimentDefinition` requires `hypothesis`, `primaryMetric`,
`secondaryMetrics`, `guardrailMetrics`, `minimumSamplePerVariant`,
`decisionRule`, and a `control` variant. **An experiment with no hypothesis does
not fail review — it fails `tsc`.** `validateExperiment` is additionally run
over the whole registry in CI.

### Assignment

`FNV-1a(installId:experimentId) % 10000` → weighted variant. Deterministic, so
the same player gets the same arm on every launch with no storage at all. The
experiment id is in the hash so concurrent experiments are independent — hashing
the install alone would put every treatment arm on the same players.

Persistence **pins** the first resolution so that changing weights mid-flight
cannot re-bucket a slice of the population (which contaminates both arms
irreversibly). A cleared cache falls back to the hash: the same answer, except
in the one case pinning exists for.

Every degenerate case — disabled, unknown id, no variants, zero weights, missing
control, a pin naming a removed arm — resolves to `control`. A misconfigured
experiment shows today's product; it never crashes and never invents an arm.

### Exposure ≠ assignment

Call `trackExposure(id)` **where the player meets the varied surface**. Every
install is assigned the moment the registry loads; counting that as exposure
measures a paywall test over everyone who opened the app and buries the effect
under a majority who saw neither arm. Exposure is once per experiment per
session — one indecisive player is not twenty.

### Guardrails

A conversion win does not automatically ship. Check `retention_day`,
`session_end`, `save_failed`, `app_startup`, `economy_week` and
`subscription_renewed` before calling it.

---

## 10. Feature flags & remote configuration

Feature flags are `lib/config/featureFlags.ts`, driven by `EXPO_PUBLIC_*` env
vars and set per profile in `eas.json`. Every native-SDK flag is opt-in
(`=== 'true'`); the truth table is pinned by
`__tests__/tooling/nativeSdkFlagDefaults.test.ts`.

**There is no remote-config service, and adding one is not free.** The
experiment registry covers controlled rollout of *behaviour* without one.
Anything remotely tunable would need a default, a validated range and a
fallback, because a bad remote value must never break the game — and this app
carries a specific hazard that makes it a larger decision than it looks: the
economy is gated on game state precisely because device-clock and
externally-supplied values have been exploitable here five times over
(`STATE_VERSION` v28/v31/v35/v40/v44). A remotely tunable economy value is a new
instance of that same class. Scope it as its own change, with the validation
layer designed first.

---

## 11. Technical health

| Event | Carries | Notes |
|---|---|---|
| `save_failed` | `category`, `slot`, `attempts` | **Permanent** failures only — a recovered retry is noise that would bury the one outcome that costs a player their progress. Category, never the message: an error can quote the save |
| `save_repaired` | `repairs`, `saveVersion` | Emitted once per load, from `hydrateLoadedState`. A rise after a release means a migration is not doing its job |
| `app_startup` | `durationMs` | Boot breadcrumb `first_screen_visible` — time to first frame **from JS entry**. Does not include native launch, which JS cannot observe without a native module |

Thresholds and alerting belong downstream. A device cannot know whether its own
failure is one of ten or one of ten thousand, and a client-side alarm would fire
on every isolated incident (§38, alert fatigue).

---

## 12. Dashboards

Eight boards. Each answers a decision; none is a metric dump.

**Executive** — DAU, new installs, returning, D1/D7/D30, median session length,
payer conversion, revenue, `save_failed` rate, top anomaly.

**Retention** — D1/D7/D30 by install cohort *(filter `anchorEstimated = false`)*,
session frequency, session duration distribution, `retention_day` histogram,
reactivation.

**Onboarding** — `onboarding_step` completion by step, drop-off per step, time
per step, `tutorial_step` completion, `first_week_completed` rate.

**Progression** — player distribution across `progression_stage`, median
`weeksInPreviousStage` per stage, stage-to-stage drop-off, `prestige` and
`death` rates, `goal_reached` levels.

**Economy** — `economy_week` `earned` / `spent` / `netFlow` by stage, balance
and net-worth distributions, `earnedPerWeek` percentiles (watch p99 for §20),
inflation trend by app version.

**Monetisation** — the paywall funnel step by step, the IAP-shop funnel,
`purchase_failed` vs `purchase_cancelled` split, trial→paid, renewal, cancel
and recovery counts, ARPU / ARPPU, `first_premium_value` rate among new
subscribers.

**Experiments** — exposed installs per arm vs `minimumSamplePerVariant`, primary
metric by arm, every guardrail by arm, assignment balance (a skew means a
bucketing bug).

**Technical health** — `save_failed` by category and platform, `save_repaired`
by `saveVersion`, `app_startup` p50/p95 by `appVersion`, crash-adjacent funnel
gaps, per-release regression view.

---

## 13. Privacy review

**Collected:** an app-generated random install id; a per-launch session id;
coarse device facts (`platform`, `osMajor`); app and build version; game
progression facts (weeks, stage, prestige count, aggregate money flows); funnel
and purchase-state events; experiment arm; feature ids from a closed catalogue.

**Never collected:** advertising id, IDFA/IDFV, device id, precise device model,
location, contacts, IP-derived geography, player-authored text (character and
company names, messages, notes), receipts, purchase tokens, credentials or
tokens of any kind, error messages, file paths, save payloads.

**Mechanisms.** `SENSITIVE_KEYS` in `validation.ts` redacts by key name before
either sink — a call site that starts passing a receipt cannot leak it. Feature
and failure taxonomies are closed enums, so no free text escapes through them.
Both sinks are hard-gated on consent derived from the user's ATT/UMP choice, and
the install id is app-generated and never joined to a platform identifier.

**Manifest.** `expo.ios.privacyManifests` in `app.config.js` — tracking is
declared by the AdMob/Firebase SDK manifests, not by our own
`NSPrivacyTrackingDomains`. Listing ad domains there would zero out ad revenue
whenever ATT is denied. `scripts/preflight-check.js` §5b enforces this.

Data-safety copy for the stores: `docs/DATA_SAFETY.md`.

---

## 14. Debugging

In a `__DEV__` build:

```ts
import { getDebugEvents, getDebugEventCounts, clearDebugEvents } from '@/lib/analytics';
getDebugEventCounts();  // { session_start: 1, week_advanced: 12, ... }
getDebugEvents();       // the last 100 accepted events, with their final props
```

It records events **as accepted** — after validation, scrubbing and
de-duplication — because that is the shape that actually leaves the device.
Recording the call-site arguments would show what you meant rather than what you
sent, which is the thing already visible in the source. Bounded ring, 100
entries, retains nothing outside `__DEV__`.

---

## 15. Limitations

Read these before quoting a number.

1. **Retention curves start at the release that shipped cohorts.** Everyone
   before that is `anchorEstimated: true` and must be excluded.
2. **No per-source/per-sink economy attribution.** The save keeps two cumulative
   totals, so `economy_week` measures aggregate health only. A breakdown needs a
   transaction ledger, which is a save-format change.
3. **Economy rollups are cut at session boundaries.** The previous sample lives
   in a ref, not on disk. Spans still tile a life; `spanWeeks` makes the cut
   visible.
4. **Subscription edges are client-observed** at next app open, so a
   cancellation is seen late and a player who never reopens is never seen to
   cancel. A RevenueCat webhook is the authoritative fix.
5. **`app_startup` excludes native launch.** JS cannot observe it without a
   native module, and this app does not add one for telemetry.
6. **Feature adoption covers routes and launcher apps**, not every surface. A
   feature reached only through a modal is not yet measured; add it to
   `featureRoutes.ts` or call `trackFeatureUse` at its entry point.
7. **`retention_day` is wall-clock derived.** Nothing is paid out for it, so
   there is no incentive to move the clock, and the index is monotonic so a
   rewind cannot walk a cohort backwards. It is still not proof of a real day.
8. **No LTV model ships here.** ARPU/ARPPU and payer conversion are computable
   from the events; a predicted LTV on this volume would be a number with
   false precision attached.
9. **`progression_stage` stops after the first prestige** — see §5. Endgame
   pacing is read from `prestige` and `economy_week`, not from stage edges.
10. **Property caps are Firebase's, applied to both sinks** — 18 call-site
   properties, 40-character names, 100-character values. Firebase enforces its
   budget by silently dropping the excess, which is the worst failure mode
   available, so the stricter limit is applied before either sink rather than
   letting the two payloads diverge.
11. **Firebase and the self-hosted queue can disagree in volume** — the queue
   caps at 200 events and drops oldest-first under sustained offline use.
   Firebase has its own retention rules. Use one sink per question.
