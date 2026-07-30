# 05 — Measurement & the ROI model

Apple Ads will happily report installs and CPA forever without ever telling you
whether an install made money. Joining ad spend to revenue is what turns this
from "buying downloads" into "buying customers", and it is the difference
between the account compounding and the account quietly losing money at a
slightly improving cost-per-install.

**Do this before spending anything.**

---

## Part 1 — Attribution wiring

### What Apple gives you for free

Apple Ads uses **AdServices**, a deterministic first-party attribution API — not
SKAdNetwork/AdAttributionKit probabilistic modelling. Your app requests an
attribution token at launch; the token is exchanged with Apple for the campaign,
ad group, and keyword that produced the install. It is exact, and **it does not
require ATT consent**.

This is better than it sounds. The *standard* payload — the one returned when a
user declines tracking — already carries `orgId`, `campaignId`, `adGroupId`,
`keywordId`, `adId`, `conversionType` and `countryOrRegion`. The **only** field
the *detailed* (ATT-consented) payload adds is `clickDate` / `impressionDate`.

So **keyword-level ROAS works regardless of ATT opt-in rate.** What you lose
without consent is the click timestamp, which affects time-to-install analysis
and nothing in this program depends on it.

**One real limit: Search Match traffic.** A Search Match install was not driven
by a keyword you chose, so its `keywordId` can come back null or absent. That
covers the whole Discovery campaign and Maximize Conversions later. Read it this
way:

| Traffic | Finest reliable ROAS slice |
|---|---|
| Brand / Category / Competitor (your exact keywords) | **Keyword** |
| Discovery broad-match seeds | Keyword, where one resolves |
| Discovery Search Match, Maximize Conversions | **Campaign / ad group only** |

That is not a defect — it is why Discovery is judged on its search-term report
and its campaign-level CPA (`06`), never on per-keyword ROAS.

That matters here: `expo-tracking-transparency` ships and ATT is prompted, but
even for users who decline, standard ASA attribution still works.

### The gap this repo had

No MMP (no AppsFlyer/Adjust) and no AdServices token collection. Apple Ads showed
installs, RevenueCat showed revenue, and nothing joined them.

### The fix (shipped with this change)

`services/RevenueCatService.ts` now calls
`Purchases.enableAdServicesAttributionTokenCollection()` immediately after
`configure()`, on iOS only, guarded and non-fatal. The SDK collects the token in
the background, sends it to RevenueCat, and RevenueCat requests the attribution
data from Apple within 24 hours. From then on every RevenueCat customer carries
their Apple Ads campaign, and revenue shows up sliced by campaign in RC Charts
and every RC integration.

**Console step — done ✅.** RevenueCat dashboard → project → **Integrations →
Apple Search Ads** is enabled (confirmed 2026-07-30). The integration supports
both Apple Ads Basic and Advanced.

**What is still outstanding:** the code only produces usable data on real
devices from a **released App Store build**. Until a build containing this
change ships, no trustworthy attribution data exists to collect — the
integration is armed but has nothing to receive.

### Verifying it works

1. Ship the change in a **released App Store build**. AdServices returns no
   token at all in the simulator, and TestFlight/sandbox builds can return
   placeholder or empty attribution — a clean TestFlight result is *not* proof
   the integration works in production.
2. Install via a real Apple Ads tap. An organic install returns a token that
   resolves to `attribution: false`, which proves token *collection* works but
   says nothing about the ad path — only an ad-attributed customer with
   populated campaign fields proves the whole pipe.
3. RevenueCat → **Customer** → check the *Attribution* section for populated
   `Apple Search Ads` campaign / ad group / keyword fields. Apple resolves
   within ~24 hours, but RevenueCat advises allowing **up to 7 days** for full
   coverage, so do not open an incident early.
4. If nothing appears after 7 days: confirm the RC integration is enabled,
   confirm the build is a store build, and confirm RevenueCat is actually
   enabled in the build — `lib/config/featureFlags.ts` gates it behind
   `EXPO_PUBLIC_*` and `BORING_BUILD_MODE` disables it in `__DEV__`.

### What still isn't measured, and how to close it

Ad revenue (AdMob) is not in RevenueCat, so RC's ROAS covers IAP and
subscriptions only. Two options:

- **Good enough, free:** log ad revenue to Firebase Analytics (already installed,
  `services/FirebaseAnalyticsService.ts`) and compute blended LTV manually per
  the model below. AdMob's own reporting gives eCPM and impressions/DAU.
- **Complete, paid:** add an MMP (AppsFlyer/Adjust) with the AdMob ad-revenue SDK
  connector, which attributes ad revenue per user per source. Only worth it above
  roughly $5–10k/month of ad spend; below that the fee exceeds the insight.

---

## Part 2 — The LTV → max-CPA model

**The rule that governs every bid in this account:**

```text
max CPA (per install)  =  D180 net LTV  ÷  target payback multiple
max CPT (per tap)      =  max CPA  ×  tap-to-install conversion rate
```

### Inputs — fill these in from your own data

| # | Input | Where to get it | Your value |
|---|---|---|---|
| A | Installs in cohort | App Store Connect | |
| B | Ad revenue per install, D180 | AdMob revenue ÷ installs (already net) | |
| C | IAP payer rate | RevenueCat | |
| D | IAP ARPPU, D180 | RevenueCat | |
| E | Subscriber rate | RevenueCat | |
| F | Avg subscription months × price | RevenueCat retention curves | |
| G | Apple's commission | **15%** under the Small Business Program (<$1M/yr), else 30% | |
| H | Tap-to-install CR | Apple Ads (benchmark ≈ 64%) | |

```text
D180 net LTV = B + (C × D + E × F) × (1 − G)
```

Note **G = 15%** almost certainly applies — the App Store Small Business Program
covers developers under $1M/year, and it applies to consumables, non-consumables
and subscriptions alike. Enrolment is not automatic; confirm it in App Store
Connect → Business. Using 30% when you qualify for 15% understates your LTV by
~18% and will cause you to underbid across the whole account.

### Worked example — conservative

| Input | Value |
|---|---|
| B — ad revenue / install (D180) | $0.20 |
| C × D — IAP | 1.5% × $12.00 = $0.18 |
| E × F — subscriptions | 0.8% × $16.00 = $0.13 |
| G — commission | 15% |
| H — tap-to-install CR | 60% |

```text
D180 net LTV = 0.20 + (0.18 + 0.13) × 0.85 = $0.46
max CPA @ 1.0× payback = $0.46
max CPT = 0.46 × 0.60         = $0.28
```

**Read this number honestly.** A $0.28 max CPT is below the ~$0.92 global median
CPT. In that world you cannot buy "life simulator" or "bitlife" profitably at
any bid, and the only affordable inventory is Brand plus the cheapest long tail.
That is not an argument against running ads — it is the argument for the
structure in `01-SETUP.md`, which spends 10% on brand and holds Competitor to a
hard $6/day cap precisely because the model says so.

### Worked example — strong (what you are aiming at)

| Input | Value |
|---|---|
| B — ad revenue / install | $0.45 |
| C × D — IAP | 3.0% × $18.00 = $0.54 |
| E × F — subscriptions | 2.0% × $28.00 = $0.56 |
| G | 15% |
| H | 65% |

```text
D180 net LTV = 0.45 + (0.54 + 0.56) × 0.85 = $1.39
max CPA @ 1.0× = $1.39   →   max CPT = $0.90
```

At $0.90 the median category auction opens up and the account can actually scale.
**The gap between these two scenarios is worth more than every bid optimization
in this folder combined.** Doubling LTV doubles the keywords you can afford;
shaving 10% off CPT does not.

### Payback targets

| Horizon | Target | Meaning |
|---|---|---|
| D7 ROAS | ≥ 10% | Early read. Below this, the cohort is unlikely to recover. |
| D30 ROAS | ≥ 35% | The number to steer weekly decisions on. |
| D90 ROAS | ≥ 70% | Trajectory check. |
| D180 ROAS | ≥ 100% | Break-even. Anything above is profit. |

At the $30/day start, D30 is your working metric — D180 arrives too late to steer
anything. Set the CPA target used in `06` to **D30 ROAS ≥ 35%**, i.e.
`target CPA = D30 revenue per install ÷ 0.35`.

---

## Part 3 — The weekly reporting pull

Every Monday, export from Apple Ads (**Reports → Ad Group / Keyword level, last
7 days**) and pull the matching revenue from RevenueCat. Keep the joined result
in one sheet, one row per keyword per week:

```text
week | campaign | ad_group | keyword | impressions | taps | TTR |
installs | CR | spend | CPT | CPA | D7 rev | D30 rev | ROAS_D30
```

Four columns do the work:

- **CPA vs target CPA** → the bid decision (`06`).
- **CR** (installs ÷ taps) → a page problem, not a keyword problem. Low CR on a
  relevant keyword means the CPP or the rating is losing the user *after* the tap.
- **TTR** (taps ÷ impressions) → a relevance problem. Low TTR means the ad should
  not be showing for that term — check `03` before touching bids.
- **ROAS_D30** → the only column that decides whether a keyword scales.

Retain the weekly export in git alongside this folder if you want the history;
Apple Ads' own reporting window is not permanent and rebuilding a year of
keyword history from memory is impossible.

---

## Part 4 — The three things to check before blaming the ads

When CPA is bad, the cause is usually not the bid:

1. **Rating.** A 2.3★ page converts a fraction of a 4.5★ page from identical
   traffic. This is the largest multiplier on the whole account and it is not an
   ads problem.
2. **The product page.** Low CR at healthy TTR = the ad promised something the
   page did not deliver. Fix the CPP (`04`), not the bid.
3. **D1 retention.** If paid installs retain worse than organic, you are buying
   the wrong users and every downstream number will look like an LTV problem.
   Segment by campaign in Firebase Analytics before concluding LTV is too low.

---

## Sources

- [RevenueCat — Apple Search Ads attribution](https://www.revenuecat.com/docs/integrations/attribution/apple-search-ads)
- [RevenueCat — AdServices attribution framework support](https://community.revenuecat.com/revenuecat-announcements-2/apple-s-adservices-attribution-framework-for-apple-search-ads-asa-is-now-supported-1919)
- [Apple — App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/)
- [AppTweak — Apple Ads benchmarks 2026](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks)
- [SplitMetrics — Apple Ads Search Results benchmarks 2026](https://splitmetrics.com/apple-ads-search-results-benchmarks-2026/)
