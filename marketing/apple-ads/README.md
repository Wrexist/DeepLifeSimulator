# Apple Ads (App Store Ads) — complete program for DeepLife Simulator

Everything needed to run App Store ads for `com.deeplife.simulator` at the best
achievable ROI: account structure, keyword sets, negative keywords, bids,
budgets, creative, measurement, and the weekly optimization loop.

**Apple renamed "Apple Search Ads" to "Apple Ads" in 2025.** The console is
[ads.apple.com](https://ads.apple.com); the product is the same, plus new
placements (Today tab, Search tab, Product Pages) beyond Search Results.

---

## Read in this order

| # | File | What it gives you |
|---|---|---|
| 0 | **this file** | The 60-second summary and the go/no-go gate |
| 1 | [`01-SETUP.md`](01-SETUP.md) | Account → campaigns → ad groups, every setting, click by click |
| 2 | [`02-keywords.md`](02-keywords.md) | Every keyword, grouped by campaign/theme, with bids and rationale |
| 3 | [`03-negative-keywords.md`](03-negative-keywords.md) | The block lists — the single biggest ROI lever in this account |
| 4 | [`04-custom-product-pages.md`](04-custom-product-pages.md) | 6 CPP briefs mapped to ad groups (avg **+27% TTR** in search results) |
| 5 | [`05-measurement-and-roi.md`](05-measurement-and-roi.md) | Attribution wiring, the LTV→max-CPA model, ROAS targets |
| 6 | [`06-optimization-playbook.md`](06-optimization-playbook.md) | Daily/weekly/monthly rules — exact thresholds, no judgement calls |
| 7 | [`07-geo-and-budget-plan.md`](07-geo-and-budget-plan.md) | Country tiers, 90-day budget phasing, scale triggers |

Bulk-upload lists live in [`keywords/`](keywords/) and [`negatives/`](negatives/)
as CSV.

---

## The 60-second summary

**Structure** — five campaigns, one keyword theme per ad group, Search Results
placement first:

| Campaign | Match | Search Match | Role |
|---|---|---|---|
| `DLS-US-Brand-Exact` | Exact | **Off** | Defend the brand. Cheapest installs in the account. |
| `DLS-US-Category-Exact` | Exact | **Off** | Genre demand: life sim, tycoon, money, career, crime. 8 ad groups. |
| `DLS-US-Competitor-Exact` | Exact | **Off** | BitLife & co. Highest CPT, lowest CR — capped hard. |
| `DLS-US-Discovery-Broad` | Broad | **On** | Mining only. Every keyword above is an exact negative here. |
| `DLS-US-MaxConv` (phase 3) | — | On | Automated scale, once ≥5 installs/day exist to learn from. |

**The loop** — Discovery finds search terms → winners graduate to the matching
exact campaign → the graduated term is immediately added back to Discovery as an
exact negative so the two never bid against each other.

**Budget** — start at **$30/day US only** ($900/mo) split 10/40/20/30 across
Brand/Category/Competitor/Discovery. Scale only on the triggers in
[`07-geo-and-budget-plan.md`](07-geo-and-budget-plan.md).

**The number that decides everything** — your max CPA is your D180 LTV. Until
[`05-measurement-and-roi.md`](05-measurement-and-roi.md) is wired up you are
flying blind, so do that first. Worked example in that doc: at a $1.20 D180 LTV
and a 60% tap-to-install rate, the break-even max CPT is **$0.72** — below the
~$0.92 global median CPT. That is not a reason to skip ads; it is the reason the
structure above leads with brand and long-tail exact keywords instead of buying
"bitlife" at any price.

---

## ⚠️ Go / no-go gate — check this before spending a dollar

Apple Ads sends traffic to your **product page**. The page converts, not the ad.

1. **Rating ≥ 4.0 with 30+ reviews.** The last figure recorded in this repo is
   **2.3★ / 8 reviews** (`Deep_Life_Simulator_Marketing_Plan.md`, Mar 2026).
   Verify the live number in App Store Connect. Paid traffic into a 2.3★ page
   converts at a fraction of benchmark, so you pay full CPT for a third of the
   installs. **If the rating is still under 4.0, spend nothing beyond the Brand
   campaign** (branded searchers already decided) and fix ratings first — that
   is Phase 1 of the organic marketing plan and it gates this entire program.
2. **App name mismatch — resolve before building campaigns.** `app.config.js:19`
   ships `DeepLife Simulator`; `marketing/app_store_listing.md` documents
   `Deep Life Simulator`. Brand keywords must cover whichever is live, and both
   spellings are in the brand list for exactly this reason. Confirm the live
   name on the App Store and note it here.
3. **Attribution live.** `Purchases.enableAdServicesAttributionTokenCollection()`
   shipping in a released build (see `05`), otherwise no keyword-level ROAS.
4. **Screenshots/CPPs ready.** At minimum the default page's first 3 screenshots
   carry benefit headlines (`SCREENSHOT_GUIDE.md`).

---

## What this program does not do

- It does not create campaigns. Apple Ads is an external console; every step in
  `01-SETUP.md` is performed by the account owner.
- It does not set final bids. Every bid here is a **starting** bid to be replaced
  with Apple's suggested bid range shown at keyword-add time, then tuned by the
  rules in `06`.
- Numbers labelled *benchmark* are third-party 2026 medians, not this app's data.
  They exist to sanity-check your first two weeks, then your own data replaces
  them.

---

## Sources

- [Apple Ads — Campaign Structure best practices](https://ads.apple.com/app-store/best-practices/campaign-structure)
- [Apple Ads — Use negative keywords](https://ads.apple.com/app-store/help/keywords/0060-use-negative-keywords)
- [Apple Ads — Understand match types](https://ads.apple.com/app-store/help/keywords/0059-understand-keyword-match-types)
- [Apple Ads — Maximize Conversions best practices](https://ads.apple.com/app-store/best-practices/maximize-conversions)
- [AppTweak — Apple Ads benchmarks 2026](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks)
- [AppTweak — Apple Search Ads campaign structure 2026](https://www.apptweak.com/en/aso-blog/apple-search-ads-campaign-structure)
- [SplitMetrics — Apple Ads Search Results benchmarks 2026](https://splitmetrics.com/apple-ads-search-results-benchmarks-2026/)
- [MobileAction — 2026 Apple Ads benchmark report](https://www.mobileaction.co/report/apple-ads-2026-benchmark-report/)
- [MobileAction — Ad variations with custom product pages](https://www.mobileaction.co/blog/ad-variations-with-custom-product-pages/)
- [RespectASO — Custom product pages in 2026: 70 pages, limits](https://respectaso.com/blog/custom-product-pages-app-store-guide-2026/)
- [RevenueCat — Apple Search Ads attribution](https://www.revenuecat.com/docs/integrations/attribution/apple-search-ads)
