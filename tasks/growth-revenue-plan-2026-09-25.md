# Growth and revenue plan — 25 September 2026

Operator pass following `tasks/release/MASTER-PROMPT-growth-revenue-local.md`,
run on the owner's machine against `main` at `c7ff0d8a` (PR #217 merged, binary
**2.15.0**, store record next **1.6.0**). Every number names its console,
report and date range. Where a number could not be read, this file says so
instead of estimating.

Periods: **current** = 2026-08-28 → 2026-09-24 (28 days), **previous** =
2026-07-31 → 2026-08-27. Currency is whatever the console reports.

**The headline correction:** the repo's records about Android were weeks out of
date. Google Play has had **2.13.0 in production since 20 September**, with all
27 one-time products and both subscriptions created, developer verification
done, every App content form complete and six store translations live. The
master prompt's Phase 2 (closed test, 14-day clock, production application) is
behind us. What is left on Android is listed under Phase 2.

## Phase 0: scorecard

### RevenueCat (project `467799e3`, Charts v3, read 2026-09-25)

| Metric | Current | Previous | Change |
|---|---|---|---|
| Revenue (Revenue chart, IAP + ads) | SEK 1,541 | SEK 1,233 | +25% |
| of which in-app purchases (all App Store) | SEK 1,486, 24 tx | SEK 1,233, 9 tx | +21% |
| of which ads (RevenueCat ad tracking) | SEK 55, 133 impressions | none tracked | new |
| Play Store revenue | SEK 0 | SEK 0 | none |
| New customers (first seen by the SDK) | 820 | 935 | −12% |
| Paying within 7 days of first seen | 7 (0.85%) | 3 (0.32%) | ×2.7 |
| New trials (iOS only, see Phase 2) | 24 | 45 | **−47%** |
| Trial conversion rate | 12.5% (3 of 24, 3 pending) | 8.9% (4 of 45) | +3.6 pt |
| New paid subscriptions (all from trials) | 5 | 3 | +2 |
| Refunds | 0 | 0 | none |
| MRR, period average | SEK 233 | SEK 71 | ×3.3 |

Overview tiles on 2026-09-25: 3 active trials, 7 active subscriptions, MRR SEK
341. The account is at $20 of the $2,500 monthly-tracked-revenue free tier.

Revenue by product (SEK, transactions in brackets):

| Product | Current | Previous |
|---|---|---|
| DeepLife+ Yearly | 481 (1) | 473 (1) |
| Unlock All Perks ($6.99) | 408 (6) | 136 (2) |
| DeepLife+ Monthly | 262 (5) | 95 (2) |
| Revival Pack | 143 (5) | 0 |
| Remove Ads | 115 (4) | 107 (2) |
| Business Banking | 39 (1) | 0 |
| Financial Planning | 29 (1) | 0 |
| 100 Gems | 10 (1) | 0 |
| Lifetime Premium ($79.99) | **0** | 422 (2) |

New customers by country (Customers chart segmented by country, current
period, n = 820): United States 300, India 88, United Kingdom 50, France 34,
Nigeria 32, South Africa 31, Canada 20, Germany 20, Indonesia 16, Ghana 14,
Australia 11, Poland 11, Sweden 10, Brazil 9, other 37+.

Ads as RevenueCat sees them (Ad Fill Rate chart, current period): 3,457
requested, 1,544 loaded, 1,913 failed to load (fill 44.7%), 0 clicks. 133
impressions against 1,544 loads fits banner "display" events not arriving yet;
the fix ships in 2.15.0.

Configuration (dashboard API, 2026-09-25):

- **Offering `default`** (current), 12 packages. iOS has `$rc_annual` →
  `deeplife_premium_yearly` and `$rc_monthly` → `deeplife_premium_monthly`.
  Play has all 12 attached (subscriptions as `:yearly` / `:monthly` base plans
  plus 10 one-time products), attached 2026-09-20.
- **Products**: 29 registered for Play (all of `utils/iapConfig.ts`), 28 for the
  App Store.
- **Entitlements**: `premium` ← monthly, yearly and lifetime on both stores;
  `ads_removed` ← `deeplife_remove_ads` on both stores. Lifetime is not attached
  to `ads_removed`, but `services/RevenueCatService.ts:122-124` already treats
  any `premium` as ad-free, so nothing is lost. No change needed.

### Google Play Console (Delta Inc., `com.deeplife.simulator`, read 2026-09-25)

- **Production: 2.13.0 (versionCode 114), full rollout, released 2026-09-20,
  176 of 177 countries.** Managed publishing off; nothing unpublished.
- Other tracks: Internal 2.13.0 (114). Closed "Alpha" 2.8.1 (109). Closed "NEW
  TESTERPOOL" release "1.5.0" (AAB 111 = 2.11.3). Closed "Pods" 2.9.0 (110),
  draft. **The next AAB needs versionCode > 114.**
- App dashboard, last 28 days vs previous 28: 13 device acquisitions, 10 first
  opens, 6 monthly active devices (+200%). Crash rate, ANR rate and rating: "–"
  (too few users). Revenue: none.
- Store listing (Butiksuppgifter, 2026-08-23 → 09-19): 14 visitors, 13 unique
  install clicks, **93% conversion**. Play's problem is traffic, not the page.
- Home: 80 users with the app installed (+2,567% on the previous 30 days).
- **Products**: 27 one-time products, each with 1 active purchase option (created
  2026-08-10; Revive Now 2026-08-28). Subscriptions DeepLife+ Monthly (`monthly`
  base plan) and Yearly, both active in 174 countries, **with no offers: the
  7-day free trial does not exist on Android.** Per-region prices were not
  verified (the price table would not render).
- **Android developer verification: `com.deeplife.simulator` is Registered**
  (2 signing keys, 2026-07-30). The banner says unregistered apps are removed
  from Play on 2026-09-30; this app is safe.
- **App content: 10 of 10 declarations complete.** Data safety, Target audience
  and Content ratings were edited 2026-09-20.
- **Data safety as published** (public Play page): collected and shared:
  Diagnostics, Approximate location, Device or other IDs, App interactions
  (analytics, advertising, fraud prevention); collected only: Purchase history
  (app functionality, analytics). Encrypted in transit; deletion on request.
  This is a superset of `docs/DATA_SAFETY.md` (it also declares AdMob's
  approximate location). No change needed.
- **Content ratings (IARC, 2026-09-20)**, read from the badges: ESRB Teen,
  **PEGI 18**, USK 16, ClassInd 14, **Australia R18+**, IARC 18+, plus three more
  18 / 18+ badges the icons do not name. **South Korea (GRAC) refused a rating**
  (the 177th country). The game has no casino mechanic; its gambling-adjacent
  content is lottery-ticket events and stock/crypto trading. Whether "simulated
  gambling" was answered Yes is the likely driver of the 18s. See the Tier B
  list.
- **Store listing text**: the live en-US copy is not the repo's `PLAY` copy.
  Live short description: "Build a career, find love and grow a business. Your
  choices shape your legacy." Live translations with localized titles:
  pt-BR, es-419, es-ES, sv, de, fr. The pt-BR page already says "O jogo está em
  inglês".

### App Store

Chrome's App Store Connect session had expired (it redirected to the Apple
sign-in page), so **App Store Connect analytics, crashes, retention and IAP
review states were not read.** From public sources instead (read 2026-09-25):

- iTunes lookup, US: store version **1.5.5**, released 2026-09-07, **3.0★ from 3
  ratings**, 12+, English only, 82 MB.
- Public reviews (RSS, most recent first): 17 US, 2 CA, 1 IN, 1 PH. **Only one
  since 1.5.5**: 1★ "Please put it in Portuguese." (2026-09-19). The older 1–2★
  reviews are about bugs, illness frequency, the dark web shop, and the $80
  Lifetime price. Which of those are fixed is in Phase 3.
- EAS: the "stuck" TestFlight submission from the 2026-09-24 run (00717ecc,
  binary 2.14.1) **succeeded** at 01:56 on 2026-09-25.
- `App Store Connect — release` workflow plan, 2026-09-24: 18 version records,
  1.5.5 newest `READY_FOR_DISTRIBUTION`, no 1.6.0 record.

### AdMob (Home, last 7 days vs previous 7, read 2026-09-25)

| Metric | Last 7 days | Change |
|---|---|---|
| Estimated earnings | SEK 28.41 (USD 2.89) | +168% (USD 1.09 before) |
| Requests | 1.41k | +18.6% |
| Impressions | 255 | +41.7% |
| Match rate | 96.6% | was 91.9% |
| eCPM | SEK 111 | +89% |

By app: iOS "Deep Life Simulator: Tycoon" SEK 25.04, 197 impressions. Android
"DeepLife Simulator" SEK 3.37, 58 impressions, so **the Android ad units are
live.** AdMob → Apps → "Apps to confirm" lists **1 app serving ads that is not
added to AdMob**; the table would not render, so which app is unknown. A 28-day,
per-ad-unit report was not read (the report table would not render).

### Firebase / GA4 (project `deep-life-simulator-2779c`, 2026-08-28 → 09-24)

- Active users: 246 (30-day line), 65 (7-day), 7 (1-day). Average engagement
  **1h 02m per active user**, 3.6 engaged sessions per user.
- 244,862 events from 237 users, 54 event names. Top: `screen_view` 132K,
  `user_engagement` 94K, `economy_week` 5K, `session_end` 2.1K,
  `onboarding_step` 1.6K, `live_event_completed` 1.2K, `feature_used` 998. **The
  custom funnel arrives from signed builds.**
- Purchases: `purchase_started` 9 (7 users), `purchase_succeeded` 5 (4 users),
  `purchase_cancelled` 4 (4 users), `in_app_purchase` 1. **GA4 purchase revenue
  $0.00**, ad revenue $0.72. RevenueCat saw 24 paid transactions in the same
  window: GA4 only counts consented users, and the custom events carry the price
  as parameters, which GA4 never counts as revenue. RevenueCat stays the revenue
  truth.
- Weekly cohort retention (device data): week 1 24.5%, week 2 20.4%, week 3
  41.2%, week 4 23.5%, week 5 50% (cohorts too small to trust week 3+).

### The three biggest numbers

1. **Revenue +25%** (RevenueCat, SEK 1,541 vs 1,233) on 24 transactions instead
   of 9, with Lifetime at 0 sales.
2. **New trials −47%** (RevenueCat, 24 vs 45) while 7-day paying conversion rose
   from 0.32% to 0.85%.
3. **Android: live for 5 days, 13 acquisitions in 28 days, SEK 0 revenue**, with
   a 93% listing conversion (Play Console). Traffic is the constraint.

## Phase 1: ship 2.15.0

- [x] PR #217 merged (2026-09-25 12:31 UTC). CI on its head: Preflight ✓
      (36135357096), Coverage ratchet, which runs the full Jest suite ✓
      (36135357090), Quality ratchets ✓, EAS Update ✓.
- [x] Bundling check, local `npx expo export` from `887c10e2`: iOS ✓ (13.6 MB
      Hermes bundle, exit 0), Android ✓ (13.6 MB, exit 0).
- [ ] **Production builds: waiting on the owner.** The local permission guard
      refused to dispatch the build workflows as a production deploy. The exact
      commands are in "Waiting on the owner".
- [ ] TestFlight smoke test on a device (owner): close Welcome Back and the daily
      reward follows about half a second later with Home still responsive; a
      sandbox purchase; a rewarded ad.
- [ ] App Store Connect 1.6.0 record, build attached, then submit (Tier B).
- [ ] Android: 2.15.0 AAB on Internal testing, then a purchase and a large save
      on a real device (owner), then production (Tier B).

## Phase 2: Android

- [x] Public track: **Production, 2.13.0 (114)** since 2026-09-20.
- [x] App content forms: complete. Data safety as published needs no change.
- [x] Developer verification: Registered (2026-07-30).
- [x] Products: 27 one-time + 2 subscriptions, active; attached in RevenueCat.
- [ ] **7-day free trial offer on both subscriptions** (Tier B: a new offer on an
      existing product).
- [x] Closed test and 14-day clock: no longer needed, production access exists.
- [x] Store listing and translations (pt-BR, es-419, es-ES, sv, de, fr) live.
- [ ] Content rating review (Tier B, see below).
- [ ] Promote 2.15.0 to production with a staged rollout 20% → 50% → 100%
      (Tier B).

## Phase 3: grow downloads

**Ratings.** The in-app review prompt ships in 2.15.0. After release, check that
it fires (Firebase event list) and watch the rating count on the lookup API.
Drafted replies to the 1–2★ reviews that name something now fixed are below;
posting them is Tier B. Evidence per complaint was checked against the code and
changelog (dark web shop fixed in 2.9.0; heart disease and stroke now need age
45 and illness is rarer; Spark chat has no keyboard since 2.9.0; faces rebuilt
in 2.9.0; food prices unchanged; no fast-forward).

> **1★ "Please put it in Portuguese." (1.5.5, 2026-09-19)**
> Obrigado por pedir. The game itself is still English only, and we won't
> promise a date for a translation. What we can do now: the Portuguese store
> page says so plainly, so nobody installs expecting a translated game. Your
> request is logged.

> **2★ "Great concept far too many bugs" (1.2.8): dark web purchases**
> Thanks for sticking with it. The dark web shop was repaired: items now arrive
> when you buy them. They're priced in Bitcoin, so you need Bitcoin in your
> crypto wallet first.

> **1★ "Good Potential" (1.2.7): dark web menus, constant illness**
> You were right on both. The dark web shop now works, illness is much rarer for
> young characters, strokes and heart disease can't strike before middle age,
> and you can no longer carry two fatal illnesses at once.

> **1★ "Buggy" (1.2.7): crashes, freezes, incurable diseases, balance**
> Several of these are fixed: illness is far rarer early in life, walks build
> fitness for free, and energy refills faster each week. Food prices are
> unchanged. Version 1.6.0 fixes a Home screen freeze that could leave the
> screen unresponsive after a reward popup. If you still hit a crash, the
> in-game bug report reaches us directly.

Post the replies only after 1.6.0 is live: the "Buggy" reply names a fix that
ships in it.

> **1★ "Unfortunately awful" (1.2.8): slow fixes, "AI slop" art**
> Fair criticism. Character faces were rebuilt from hand-drawn parts, and you now
> design your own face, which ages with you and passes to your children. Other
> artwork hasn't been redone yet.

> **1★ "$80 for 'premium'?!?" (1.3.1)**
> Understood. Lifetime Premium is still $79.99, but since that review there's a
> DeepLife+ membership at $4.99 a month or $49.99 a year (US prices), with a
> 7-day free trial on the App Store.

**Localization.** Country ranking from RevenueCat new customers (App Store
Connect impressions not readable this pass): US, India, UK, France, Nigeria,
South Africa, Canada, Germany, Indonesia, Poland, Sweden, Brazil. Most volume is
English-speaking. Play already has fr, de, es and pt-BR listings. For the App
Store:

- [x] **pt-BR copy drafted** in `marketing/aso/metadata.mjs` (name
      "Deep Life: Simulador de Vida", subtitle, 100/100 keywords, description
      that says the game is in English, promotional text, 1.6.0 notes).
      `check:aso` validates it. Marked `shipped: false` because
      `asc-release.mjs` writes only What's New and cannot add a language: add
      pt-BR by hand in App Store Connect, then flip it.
- [ ] **fr-FR next** (France is the largest non-English market in the data), then
      de-DE.

**Product page conversion.** Apple Product Page Optimization can test icons,
screenshots and previews, not text. Proposal (Tier B to start): control = the
current set, one treatment = the `screenshots/player-stories-2026-09` storyboard
set, 50/50, 14 days minimum, success metric = conversion rate in App Analytics.
**No Play experiment**: 14 visitors in 28 days cannot reach significance.

**Paid spend: keep it off.** RevenueCat revenue per new customer this period is
SEK 1,541 / 820 = SEK 1.88 (about $0.20), against the paused Apple Ads CPA of
$2.54 from the cloud pass.

## Phase 4: grow revenue

**Price and packaging (proposal, Tier B, nothing changed):**

1. *Lifetime at $79.99.* 2 sales in the previous period, 0 in this one, and one
   1★ review about it. Proposal: stop leading with it. Make DeepLife+ Yearly the
   hero on the paywall and keep Lifetime as the anchor below it. If a price test
   is wanted, it needs a new product id (App Store prices per product, and a
   RevenueCat Experiment compares offerings), e.g. a $39.99 lifetime in a
   treatment offering. Measure revenue per new customer at 14 and 28 days.
   Honest caveat: at 1–2 lifetime sales a month, a test needs months to read.
2. *Gem-pack ladder.* One gem purchase (100 Gems) in 28 days. Unlock All Perks
   ($6.99) is the best one-time seller (6 sales, SEK 408). Proposal: no new gem
   packs; surface Unlock All Perks earlier in the shop.
3. *DeepLife+ trial.* iOS trials −47% but conversion up to 12.5%. Android has no
   trial at all. Proposal: add the 7-day free trial on Play (Tier B), then
   compare Android trial starts and conversion with iOS after 28 days.

**Ads.**

- Android ad units are live (AdMob: 58 impressions in 7 days).
- AdMob match rate 96.6%, but RevenueCat logs 1,913 failed loads out of 3,457
  requests. They count different things; re-check both after 2.15.0, when banner
  display events should start arriving in RevenueCat.
- AdMob has one unconfirmed app serving ads (see Waiting on the owner).

**Measurement.**

- `EXPO_PUBLIC_ENABLE_ANALYTICS`: leave unset. Decided 2026-09-09 (preflight
  §9b fails it without an endpoint, and none exists), and this pass confirmed
  Firebase receives the funnel from signed builds.
- RevenueCat webhook: needs a receiving endpoint, and none exists. The smaller
  step is RevenueCat's Firebase integration, which needs
  `Purchases.setFirebaseAppInstanceID(...)` in `services/RevenueCatService.ts`
  and a privacy review (it links purchase and analytics records). Proposal only.

## Done this pass (repo)

- `tasks/growth-revenue-plan-2026-09-25.md`: this file.
- `marketing/aso/metadata.mjs`: pt-BR App Store localization (reference until
  created in App Store Connect).
- `scripts/check-aso.mjs`: validates a localized `name` and checks limits on
  every field present, shipped or not.
- `docs/REVENUECAT-TODO.md`: status block with the console state above.
- Verified: `npm run check:aso` (no blocking problems),
  `__tests__/tooling/ascRelease.test.ts` 34/34.

## Waiting on the owner

See the chat reply of 2026-09-25 for the one-message checklist. Unverified
lead worth its own task: YouVideo purchases may be lost on a slot switch
(`components/computer/GamingApp.tsx:373-374` saves from a ref that updates a
render late; `components/SettingsModal.tsx:727-735` switches slot without
saving first).
