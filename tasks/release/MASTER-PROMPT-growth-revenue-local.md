# Master prompt: store, revenue and growth audit (local session + Claude in Chrome)

Paste everything below the line into a **local** Claude Code session, started in
your clone of this repo with the Claude in Chrome extension connected and signed
in to RevenueCat, App Store Connect, Google Play Console, AdMob and Firebase.
A cloud session cannot do this, because it has no browser and no signed-in dashboards.

It builds on the cloud pass of 25 September 2026 (branch
`claude/great-davinci-cr2nh8`). Report: `tasks/home-freeze-and-audits-2026-09-25.md`.

---

You are auditing Deep Life Simulator's live store, revenue and growth position
and turning it into a ranked, evidence-backed plan. You have Claude in Chrome
and the owner is signed in to every console. Read `CLAUDE.md` first (especially
§9 on releases and the two version numbers), then
`tasks/home-freeze-and-audits-2026-09-25.md`, `tasks/release/REMAINING_WORK.md`,
`docs/MEASUREMENT_CONTRACT.md`, `docs/ANALYTICS.md` (read its Limitations
section before quoting any number), `marketing/apple-ads/05-measurement-and-roi.md`
and `marketing/play-store/`.

## Hard rules

1. **Read-only in every console unless the owner says "go" for that specific
   change in this chat.** Before any write, state the exact change: console,
   page, field, old value and new value. Writes include saving a form,
   changing a price, creating a product, starting a test track, submitting a
   build for review, pausing or starting ads spend, answering a content-rating
   questionnaire, and replying to a review. Never approve a purchase, accept
   an agreement or enter payment or tax details.
2. **Never paste secrets** (API keys, service-account JSON, signing keys,
   tokens) into chat, files or commits. If a value is needed, name where it
   lives.
3. **Every number carries its source and date range**: console, report, filter
   and the date you read it. If a screen shows nothing, write "no data", never
   an estimate dressed as a reading. Keep recorded facts separate from your
   inferences.
4. The store version (1.x, what users see) and the binary version
   (`package.json`, now **2.15.0**) are different on purpose. Never change the
   App Store Connect version record to match the binary (CLAUDE.md §9).
5. No private player data in the repo. Aggregate numbers are fine, but reviewer
   names and emails are not.

## What the cloud pass already established (verify, don't re-derive)

- **iOS:** "Deep Life Simulator: Tycoon", store version 1.5.5, live since
  7 Sept, English only, 3 ratings averaging 3.0. Build **2.14.0 (186)** is
  uploaded and "Ready to Submit" but was built before later fixes. The next
  binary is 2.15.0.
- **Android:** a public Play listing exists under developer **"Delta Inc."**,
  updated 20 Sept, showing **5+ downloads**, "Contains ads" and "In-app
  purchases", with no rating shown. The repo also records a 2.13.0 AAB
  (versionCode 114) on the Internal testing track, a personal developer account
  with no production access ("12 testers for 14 days" closed test required),
  a content rating showing PEGI 3 that should be about 12/16, Play products
  not yet created, and Android developer verification still in Draft.
  **Reconcile these**: which track is the public listing on, and which build
  does it serve?
- **iOS reviews** (App Store RSS): the recurring complaints are freezes and
  crashes, the $79.99 "Lifetime" price, English-only ("Please put it in
  Portuguese", 1★ on 1.5.5), and older balance issues (constant illness, money
  exploits) that have since been fixed.
- **Apple Ads** (paused 9 Aug): $55.77 for 22 installs (CPA $2.54). Product page
  conversion was 40% against a 66% benchmark. The repo's LTV model gives about
  $0.46 per install over 180 days, so paid installs currently lose money.
- **OTA updates are off** (`app.config.js` `updates.enabled: false`, and the
  production profile has no channel). Nothing merged since the last binaries
  reaches players until new builds ship, including the Home freeze fix, the
  rating prompt, the Remove Ads orb and the banner-measurement fix.
- **Fixed on the branch but not yet shipped:** the Android subscription
  purchase lookup in `services/RevenueCatService.ts` (it matched a field the
  SDK doesn't have, and ignored Play's `:basePlan` suffix).

## Phase 1: read the dashboards (read-only)

Produce one table per console. Use the last 28 days unless stated otherwise,
and include the previous 28 days for comparison.

**RevenueCat** (Overview, Charts, Customers, Offerings, Products, Integrations):
- Revenue, MRR, active subscriptions, active trials, trial→paid conversion,
  refunds and churn, split by platform.
- Revenue by product. Which of the 27 one-time products and 2 subscriptions
  have ever sold?
- Offering configuration: is the default offering current, and are packages
  attached for BOTH iOS and Android? Record any product in the app catalog
  (`utils/iapConfig.ts`) that is missing from RevenueCat or from either store.
- Integrations: is a webhook configured? Is Apple AdServices attribution
  arriving?

**App Store Connect** (App Analytics, Sales and Trends, Ratings and Reviews,
App Store tab, TestFlight, Business):
- Impressions, product page views, conversion rate and downloads, split by
  source (Search, Browse, Referral, App Referrer, Web). Also crashes per
  session and sessions per active device.
- Retention (D1, D7, D28) where App Analytics shows it.
- Every rating and review since 1.5.5, grouped by theme.
- Current metadata: title, subtitle, keywords, promotional text, screenshots,
  app preview, localizations. Diff it against `marketing/aso/metadata.mjs` and
  report every mismatch.
- The IAP and subscription list with its review status. Whether the Small
  Business Program (15% commission) is active. Whether 2.14.0 (186) is still
  unsubmitted, and whether any version is in review or rejected.

**Google Play Console** (Dashboard, Statistics, Store listing, Store listing
experiments, Test and release, Policy → App content, Monetize with Play,
Android vitals, Ratings and reviews, Android developer verification):
- Which tracks exist and what each serves (versionCode, version, rollout %).
  Settle the "public listing with 5+ downloads vs internal-only" contradiction.
- Status of every App content form, and the content rating as currently
  answered.
- Whether the 27 products and 2 subscriptions exist and are active (Android
  ids are in `utils/iapConfig.ts`; note `deeplife_mindset` versus iOS
  `deeplife_mindset_perk`, and that `revival_pack` has no prefix).
- Android vitals: ANR rate, crash rate, and the top clusters.
- Developer verification status and the September deadline.
- Store listing: title, short and full description, screenshots, feature
  graphic, localizations. Diff against `marketing/play-store/listing.md` and
  `LOCALIZATIONS.md`.
- Store listing visitors, acquisition sources, conversion rate, installs and
  uninstalls.

**AdMob:** revenue, eCPM, match rate, fill rate and impressions by ad unit and
platform. Flag any unit with zero requests (a dead integration) or a match
rate under 50%.

**Firebase / Google Analytics:** DAU, the first_open→tutorial funnel from
`docs/ANALYTICS.md`, and whether purchase and ad-revenue events arrive from
signed builds.

## Phase 2: diagnose

Answer each question with evidence from Phase 1:
1. Where do downloads leak: impressions, page conversion, or ratings? Compare
   against the benchmarks in `marketing/apple-ads/`.
2. Where does revenue leak: paywall reach, price, trial conversion, missing
   store products, ad fill? Is the $79.99 Lifetime anchor hurting conversion,
   as the 1★ review suggests?
3. What stops a production Android launch today? List the steps in the order
   they must happen, with the console path for each.
4. Which of the unshipped fixes on `main`/this branch matter most for ratings
   (freeze, crash, save loss)? That determines how urgently new builds are
   needed.

## Phase 3: the plan

Write `tasks/growth-revenue-plan-<YYYY-MM-DD>.md` containing:
- A **scorecard** of every metric read, with its source and date.
- The **top 10 actions** ranked by expected impact on downloads and revenue.
  For each, give the owner (you in the repo, or the owner in a console), the
  exact console path or file, the effort, the expected effect and how you will
  measure it. Keep code-side and console-side actions apart.
- An **Android launch checklist** in execution order.
- A **pricing proposal**, if the data supports one: say which products change
  and why, and keep it as a proposal; price changes are the owner's call.
- **Localization priorities**, ranked by store traffic by country, from both
  consoles.
- A **measurement-gap list**: what could not be answered, and the smallest
  change that would make it answerable.

## Phase 4: code-side follow-through (only after the owner confirms the plan)

Work on the current `main` after merging or rebasing
`claude/great-davinci-cr2nh8`. Follow CLAUDE.md: plan in `tasks/todo.md`, one
focused commit per change with tests, and `npm run preflight` before anything
release-bound. Likely candidates (confirm each against Phase 1 data first):
- The Android AsyncStorage size limit (`AsyncStorage_db_size_in_MB` through a
  config plugin), before the Android launch.
- A RevenueCat webhook, and turning on production telemetry
  (`EXPO_PUBLIC_ENABLE_ANALYTICS`), only if the privacy review in
  `docs/ANALYTICS.md` allows it.
- Store metadata: `marketing/aso/metadata.mjs` `storeVersion`, the
  data-safety answers (purchase history collected; remove Sentry from
  `docs/DATA_SAFETY.md`), and localized listing copy.
- Whatever Phase 2 shows the paywall or ad flow is losing.

Do not trigger EAS builds, submit for review, change prices or start ad spend.
Those are the owner's actions: prepare them, state them, and let the owner do
them.

## Output back to the owner

Finish with a short chat summary covering:
- the three biggest findings, each with a number;
- the top five actions and who does each;
- what you changed, if anything, with commit hashes;
- what still needs a decision from the owner.
