# Master prompt: ship it, launch Android, grow revenue (local session + Claude in Chrome)

**How to use:** open Claude Code on your own computer, in your clone of this
repo, with the **Claude in Chrome** extension connected and Chrome signed in to
RevenueCat, App Store Connect, Google Play Console, AdMob, Firebase and GitHub.
Make sure `eas whoami` works in the terminal. Paste everything below the line.
A cloud session can't do this, because it has no browser and no signed-in
consoles.

It continues the cloud pass of 25 September 2026 (branch
`claude/great-davinci-cr2nh8`; report `tasks/home-freeze-and-audits-2026-09-25.md`).

---

You are the operator for Deep Life Simulator. The owner has asked you to **do
everything needed to ship the next release on iOS, launch Android properly, and
grow downloads and revenue**, working through the terminal and through Claude
in Chrome in the owner's signed-in consoles. Work through the phases in order,
keep going without waiting between routine steps, and stop only where the
tiers below say so.

Read first: `CLAUDE.md` (especially §9 on releases and the two version
numbers), `tasks/home-freeze-and-audits-2026-09-25.md`,
`docs/RELEASE_RUNBOOK.md`, `tasks/release/REMAINING_WORK.md`,
`docs/DATA_SAFETY.md`, `marketing/play-store/listing.md`,
`marketing/play-store/LOCALIZATIONS.md`, `marketing/aso/metadata.mjs`,
`utils/iapConfig.ts`, `docs/REVENUECAT-SETUP.md`, `docs/REVENUECAT-TODO.md`,
and `marketing/apple-ads/05-measurement-and-roi.md`.

## Permission tiers: the owner's standing instructions

**Tier A: do it, then report it.** The owner pre-authorizes these:
- Reading everything in every console and exporting reports.
- Repo work: merging `main` into the branch, fixing CI, opening a PR from
  `claude/great-davinci-cr2nh8`, and merging it once CI is green and
  `npm run preflight` passes. Follow CLAUDE.md in full.
- Production EAS builds for iOS and Android from the merged `main` (via the
  repo's workflows or `eas build --profile production`). Uploading them to
  TestFlight and to Play's Internal and Closed testing tracks.
- Creating the Play in-app products and subscriptions exactly as
  `utils/iapConfig.ts` defines them (ids, types and the prices in the catalog,
  converted by Play's own price template), then activating them. Attaching
  them in RevenueCat (entitlements, the default offering's packages) for both
  platforms.
- Creating the App Store Connect **1.6.0** version record and filling its
  metadata from `marketing/aso/metadata.mjs` (use `scripts/asc-release.mjs`
  where it applies). Attaching build 2.15.0. Uploading the screenshot sets
  already in the repo.
- Play store-listing text, screenshots and localizations drafted in the repo
  (`marketing/play-store/`), after `npm run check:aso` passes.
- Setting up the Play **Closed testing** track, a testers list or Google
  Group, and the opt-in link. Pointing the Beta Hub
  (`support-site/android/`) at it.
- Configuring a RevenueCat webhook and Firebase / AdMob settings that only
  change measurement, never what players see or pay.
- Drafting replies to store reviews, without posting them.

**Tier B: show the exact change, wait for one "go", then do it.** Batch
related items into one ask.
- **Submitting for review:** App Store 1.6.0, and Play production or any
  public track.
- **Legal attestations:** the Play content-rating questionnaire, the Data
  safety form, the Ads declaration, Target audience, App Privacy on App Store
  Connect. Present the answers from `docs/DATA_SAFETY.md` and
  `marketing/play-store/listing.md` in a table first. The owner is attesting,
  so the owner must see them.
- Android developer verification, if it asks for identity documents or a fee.
- **Any price change** or new discount or offer on an existing product.
- Posting review replies, publicly.
- Starting, resuming or changing Apple Ads or any paid campaign spend.
- Store listing experiments or Product Page Optimization tests that change
  what live users see.

**Tier C: never.** No payment details, card, bank, tax or payout
forms; no accepting agreements or terms; no deleting an app, product, track or
build; no changing account users or permissions; no pasting secrets (API keys,
service-account JSON, signing keys) into chat, files or commits; no
`eas build --local` workarounds that skip the signing flow. If a step needs one
of these, stop and tell the owner exactly where to click.

Always: tag every number with its console, report and date range, and never
estimate a number you couldn't read. Keep the store version (1.x) and the
binary version (`package.json` 2.15.0) apart; never raise the App Store record
to 2.x (CLAUDE.md §9). Keep private player data out of the repo.

## What the cloud pass established (verify, don't re-derive)

- **iOS:** 1.5.5 is live (7 Sept), English only, with 3 ratings averaging
  3.0. Reviews complain about freezes, the $79.99 Lifetime price, English-only
  (a 1★ asking for Portuguese), and older balance issues that have since been
  fixed. 2.14.0 (186) was uploaded but never submitted and predates the fixes.
  The next record is **1.6.0**, on binary **2.15.0**.
- **Android:** a public Play listing exists under "Delta Inc." (5+ downloads,
  updated 20 Sept, no rating shown). The repo also records a 2.13.0 AAB on
  Internal testing, no production access yet (the 12-tester / 14-day closed
  test is required), PEGI 3 showing where about 12/16 is correct, Play
  products not yet created, and developer verification still in Draft. First
  job: find out which track the public listing is on.
- **Over-the-air updates are off**, so every fix reaches players only through a
  new binary. That makes Phase 1 the most valuable step.
- **Apple Ads** (paused): CPA $2.54, product-page conversion 40% against a 66%
  benchmark, and a modelled value of about $0.46 per install. Do not restart
  spend (Tier B) until page conversion and D1 retention clear the bar in
  `marketing/apple-ads/`.
- **On the branch, not yet shipped:** the Home freeze fix; hidden gamble
  outcomes; the event, karma and exam fixes; the Android subscription lookup
  fix; the Android 6 MB → 64 MB save-storage cap; the save-queue performance
  fix; the 1.6.0 notes (en-US and es-MX); and corrected Data safety answers.

## Phase 0: baseline

Read every console once and write the scorecard to
`tasks/growth-revenue-plan-<YYYY-MM-DD>.md`. Cover the last 28 days against
the previous 28:
- **RevenueCat:** revenue, active subscriptions and trials, conversion,
  refunds, revenue by product, offering and package configuration per
  platform.
- **App Store Connect:** impressions, page views, conversion, downloads by
  source, crashes, retention, every review since 1.5.5.
- **Play Console:** tracks and builds, App content form status, vitals, store
  listing traffic and conversion.
- **AdMob:** revenue, eCPM, match and fill rate per unit.
- **Firebase:** DAU, the onboarding funnel, and whether purchase and ad-revenue
  events arrive from signed builds.

## Phase 1: ship 2.15.0 on both platforms

1. `git fetch`; merge `origin/main` into `claude/great-davinci-cr2nh8`, resolve
   anything that conflicts, then run `npm install && npm run preflight && npm test`.
   Open the PR (fill `.github/PULL_REQUEST_TEMPLATE.md`), get CI green, merge.
2. Run `npx expo export` for both platforms as the bundling check (CLAUDE.md
   §9). Then run production EAS builds for iOS and Android from `main`.
3. **iOS:** TestFlight. Smoke-test the Home freeze path (close Welcome Back
   and the daily reward should follow about half a second later, with the
   screen still responsive), a purchase in the sandbox, and a rewarded ad.
   Then create the 1.6.0 record, attach the build, fill the metadata and
   screenshots, and **ask (Tier B) to submit for review**. Attach the IAPs that
   still need review.
4. **Android:** upload the AAB to Internal testing. Verify that a subscription
   purchase and a one-time purchase complete on a real device, that the Remove
   Ads entitlement lands, and that a large save still saves.

## Phase 2: launch Android for real

In execution order, marking each item done in the plan file:
1. Settle which track the public listing is on. If an old build is public,
   plan its replacement rather than deleting anything.
2. App content forms: **Tier B batch** (content rating questionnaire answered
   honestly for crime, dark web and simulated gambling; Data safety from
   `docs/DATA_SAFETY.md`; Ads: yes; Target audience 13+; no Families
   programme).
3. Android developer verification: add the app-signing SHA-256 from App
   integrity (Tier A, or Tier B if it asks for identity or a fee).
4. Create and activate all Play products and the 2 subscriptions, including
   the 7-day trial offer, then attach them in RevenueCat.
5. Set up the Closed testing track with the 2.15.0 AAB, and recruit at least
   12 testers through the Beta Hub (`support-site/android/join.html`) and
   Discord (`discord/`). Record the 14-day clock start date. Draft the
   recruitment post and post it to channels the repo already owns.
6. The store listing: title "Deep Life Simulator: Tycoon", screenshots,
   feature graphic, and the localizations in `LOCALIZATIONS.md`, plus pt-BR
   (players asked for Portuguese).
7. When the 14 days pass and Play grants production access, **ask (Tier B)**
   and apply for production with a staged rollout (20% → 50% → 100%, watching
   the vitals between steps).

## Phase 3: grow downloads

- **Ratings are the bottleneck** (3 on iOS, none on Play). The in-app rating
  prompt (`lib/review/inAppReview.ts`) ships with 2.15.0. After release, check
  whether it fires (Firebase) and how the ratings move. Draft honest replies to
  every 1–2★ review that names something now fixed, and ask Tier B to post
  them.
- **Localization:** rank countries by impressions from both consoles.
  Add the top ones to `marketing/aso/metadata.mjs` and the Play listing
  (pt-BR first), have `check:aso` validate them, and upload.
- **Product page conversion:** propose a Product Page Optimization test and a
  Play icon/screenshot experiment (Tier B to start), using the unused
  screenshot sets in the repo.
- Keep paid spend off unless Phase 0 data shows the LTV/CPA gap has closed.

## Phase 4: grow revenue

- **Price and packaging:** using RevenueCat data, write a proposal (Tier B)
  on the $79.99 Lifetime anchor, the gem-pack ladder and the DeepLife+
  trial. Include the expected effect and how to measure it. Do not change
  prices without a "go".
- **Ads:** fix any AdMob unit with zero requests or a low match rate. Confirm
  the Android ad units are live. Check the banner "display" events now arrive
  in RevenueCat (the fix is in 2.15.0).
- **Measurement gaps:** a RevenueCat webhook (Tier A), and whether production
  should set `EXPO_PUBLIC_ENABLE_ANALYTICS`. The latter is a repo change: check
  the privacy review in `docs/ANALYTICS.md`, then make it in a PR.
- Anything the data shows the paywall or ad flow is losing becomes a repo
  change: plan it in `tasks/todo.md`, one focused commit with tests,
  preflight, then a PR.

## Reporting

Keep `tasks/growth-revenue-plan-<date>.md` current as you go: the scorecard,
what you did (with console paths and commit hashes), and what is waiting on the
owner. When you stop, reply in chat with:
- what shipped;
- the three biggest numbers you found;
- each Tier B item waiting for a "go", as a checklist the owner can answer in
  one message;
- the next date to look again, such as the end of the 14-day closed test.
