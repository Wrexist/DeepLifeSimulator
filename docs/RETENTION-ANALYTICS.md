# Retention analytics — how D1/D7/D30 are computed

The app emits a product funnel through `track()` in `lib/analytics`. This
document covers the part that makes retention *derivable* from it: the install
cohort, what the device reports, and what the sink has to do with it.

---

## 1. Where the events go

Two independent sinks, and they have different requirements:

| Sink | Needs | Live in `production`? |
|---|---|---|
| **Firebase Analytics** | `EXPO_PUBLIC_ENABLE_FIREBASE=true` + consent | **Yes** |
| Self-hosted HTTP queue | `EXPO_PUBLIC_ENABLE_ANALYTICS=true` **and** `EXPO_PUBLIC_ANALYTICS_URL` | No |

`AnalyticsService.track()` forwards to Firebase *before* the queue's `active`
check, so a missing endpoint cannot silence Firebase.

> **This independence has to hold at the call site too.** `analytics.init()` and
> `setConsent()` have one production call site, in `app/_layout.tsx`. It was
> gated on `enableTelemetry` alone — and since `production` enables Firebase but
> not the self-hosted queue, consent stayed `false` forever and **every custom
> event was dropped at the first branch of `track()`**. Firebase kept collecting
> its own automatic events, so the dashboard looked alive while the product
> funnel reached nothing. It is now gated on `enableTelemetry || enableFirebase`,
> pinned by `__tests__/services/analyticsFunnelReachesProduction.test.ts`.

To add the self-hosted sink later, set both env vars on the profile in
`eas.json`. Nothing in the app needs to change.

---

## 2. The cohort record

`lib/analytics/retentionCohort.ts`. Stored in **AsyncStorage**, not `GameState`:
it is install-scoped and must survive prestige, death, a new life and a
save-slot switch, none of which are new installs. Keeping it out of the save
also keeps it out of the migration surface.

```
firstSeenMs      epoch ms of the install anchor
anchorEstimated  true when the anchor is a guess, not a real install date
lastDayIndex     highest day index reached — MONOTONIC
daysSeen         distinct days with at least one session
sessions         total sessions
```

### The device clock

`dayIndex` is wall-clock derived. The repo's usual rule — *gate on game state,
never the device clock* (`STATE_VERSION` v28/v31/v35/v40/v44) — is about
**payouts**, and nothing here pays out. Moving the clock buys the player
nothing, so the only risk is data quality:

- **Rewind** is handled: `dayIndex` is monotonic, so a rewound clock re-reports
  the day already reached rather than manufacturing a second "day 3".
- **Forward jumps** are not preventable and are not filtered. They are rare,
  self-limiting (the index only ever moves forward anyway), and indistinguishable
  from a genuine long absence.

---

## 3. What the device reports

Attached to **`session_start`**, and repeated on **`retention_day`** (fired once
per *new* day index):

| Prop | Meaning |
|---|---|
| `dayIndex` | Whole days since install. `0` = install day. |
| `daysSeen` | Distinct days this install has been active. |
| `sessions` | Lifetime session count for this install. |
| `anchorEstimated` | `true` → the install date is a guess. **Exclude.** |
| `isNewDay` | `session_start` only: first session on this day index. |

`retention_day` exists so "how many installs came back on day N" is a count over
one event, rather than a de-dupe across every session.

---

## 4. Computing the metric

The device deliberately does **not** decide what "D7 retention" means, because
the two standard definitions disagree and only one of them can be recovered if
the device picks:

- **Classic day-N** — returned on day N *exactly*.
  `count(distinct installId where dayIndex = N) / cohort size`
- **Rolling N-day** — returned on day N *or later*.
  `count(distinct installId where max(dayIndex) >= N) / cohort size`

Cohort size = installs whose **first** `retention_day` had `dayIndex = 0`.

Filter `anchorEstimated = true` out of **both** numerator and denominator.

The benchmarks in `tasks/retention-and-content-strategy-2026-06-19.md`
(D1 ≈ 26%, D7 ≈ 10%, D30 < 4%; top casual D1 35%+, D7 12%+) are **classic
day-N**. Compare like with like.

### The honest caveat

There is no install timestamp anywhere in this app's history and none can be
recovered. Every install that predates this code gets its anchor set the first
time the code runs, which would read as a brand-new install. Those are flagged
`anchorEstimated: true` and must be excluded.

**So the retention curve starts accumulating from the release that ships this,
not before.** There is no way around that, and any number computed over the
existing install base before then is fiction.

---

## 5. Related

- `lib/analytics/events.ts` — the event catalogue. Adding a name there is the
  only way to make an event trackable; `track()` drops unknown names.
- `lib/analytics/retentionCohort.ts` — the cohort math, pure and unit-tested.
- `__tests__/services/analyticsFanout.test.ts` — sink independence.
- `__tests__/services/analyticsFunnelReachesProduction.test.ts` — the wiring
  above the sink.
