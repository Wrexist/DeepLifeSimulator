# Active plan — first-session instrumentation (D1 retention)

## Why

App Store Connect benchmarks (Simulation peer set, week of Jul 13–19 2026):

| Metric | Us | Percentile |
|---|---|---|
| Conversion rate | 6.28% | **above 75th** ✅ |
| Proceeds per paying user | $5.94 | 25th–50th 🟡 |
| Day 1 retention | 24.78% | **below 25th** 🔴 |
| Day 7 retention | 2.86% | **below 25th** (median 7.14%) 🔴 |

Acquisition is the healthy part of this business. Retention is the ceiling:
of every 100 installs about 3 open the app a week later.

## What is NOT the problem (checked, do not redo)

- **Onboarding length.** Already fixed on 2026-08-10 (`7bbf717`): "Play" is the
  primary card for a first-time player at 2 taps / 12.3s, against New Game's
  6 taps / 21.4s. The measured retention week PREDATES that commit by four
  weeks, so those numbers describe a build that no longer exists here.
- **The tutorial never firing.** It fires: `showWelcomePopup` defaults true in
  `initialState`, survives `buildNewGameState`, and `home.tsx` starts the
  tutorial on `weeksLived <= 1`.
- **Crashes.** Apple reports insufficient data to benchmark the crash rate,
  i.e. the volume is low.
- **Analytics being off.** `EXPO_PUBLIC_ENABLE_FIREBASE=true` in the production
  EAS profile, and `track()` is genuinely wired into IAP, ads, paywalls,
  week ticks, death and prestige.

## What IS the problem

Quick Start has shipped, and **there is no instrument that can tell you whether
it worked.** Three events are declared in `lib/analytics/events.ts` — the file
whose own docstring says it exists to measure "retention (D1/D7/D30) … and
churn points" — and never emitted by anything:

- `onboarding_step` — the six-screen funnel. `src/features/onboarding/
  onboardingAnalytics.ts` records every step view, completion and validation
  error, and sends them to `logger` only, so they never leave the device.
  (`screen_view` gives a partial view-only picture by route; it cannot show
  completions, and it cannot show WHY someone stopped.)
- `tutorial_step` — the tutorial is the first thing a new player meets and its
  progress is entirely unmeasured.
- `session_end` — declared, never emitted, so **session length is not
  measurable**. For a 24.78% D1 that is the single most diagnostic number
  there is. The transport is a plain-JS batcher, not the Firebase SDK, so
  nothing supplies this automatically.

This is the same defect class as the scholarship event that never fired and
`weeksInPoverty` that nothing wrote — a system built, then not connected.

## Tasks

- [x] Trace the cold-start path and count taps to first playable week
- [x] Confirm the tutorial actually triggers for a new game
- [x] Confirm production analytics flags and real `track()` call sites
- [x] Establish that the retention data predates the Quick Start fix
- [x] Emit `onboarding_step` from `onboardingAnalytics` (one choke point, all
      six screens, no call-site churn)
- [x] Emit `tutorial_step` on view / complete / skip
- [x] Emit `session_end` with duration on background
- [x] Tests for all three
- [x] Full suite, type-check, lint ratchet, routes

## Deliberately not done

- Redesigning the first session on a hunch. The instrument comes first; with
  three weeks of `onboarding_step` and `session_end` data the change to make is
  a fact rather than a guess.
- Any change to the ad grace or paywall timing. Both are already gated well
  clear of a first session, and moving them without data is how the two false
  store claims happened.
