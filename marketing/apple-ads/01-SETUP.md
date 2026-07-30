# 01 — Account & campaign setup, click by click

Everything in this file happens at [ads.apple.com](https://ads.apple.com) in an
**Apple Ads Advanced** account. Do not use Apple Ads Basic: it has no keywords,
no negative keywords, no match types, and no search-term report — i.e. none of
the levers this program is built on.

---

## Part 0 — Account prerequisites (one time)

1. Sign in to [ads.apple.com](https://ads.apple.com) with the Apple ID that holds
   the **Account Holder** or **Admin** role for `com.deeplife.simulator`.
2. Choose **Advanced**. Add billing (card or invoicing).
3. **Time zone and currency are permanent per account.** Set them to the ones you
   report in — they cannot be changed later without a new account.
4. Users → invite anyone else who needs access as **Limited** (read-only) rather
   than Admin.
5. Confirm the app is approved and live on the App Store in every storefront you
   intend to target. Ads cannot run in a storefront where the app is not
   available — see the 40 localized listings in
   `marketing/app-store-localizations/` for which markets already have copy.

### Naming convention — use it from day one

```
DLS-<COUNTRY>-<Type>-<MatchType>          ← campaign
<Theme>                                   ← ad group
```

Examples: `DLS-US-Category-Exact` → ad group `LifeSim-Core`;
`DLS-GB-Competitor-Exact` → ad group `BitLife`.

Consistent names are what make the reporting exports in `06` pivotable. Renaming
later does not rewrite historical rows cleanly.

---

## Part 1 — The five campaigns

Create all campaigns with **Search Results** placement only. Today tab, Search
tab and Product Pages placements come later (Part 4) — they are awareness
inventory with different economics and must never share a budget with search.

Every campaign: **Countries = United States** to start (see `07` for expansion),
**no audience refinements** at launch (age/gender/customer-type filters shrink
your learning set before you have any learning), **budget = daily budget, no
lifetime cap**.

### 1.1 `DLS-US-Brand-Exact` — defend the brand

| Setting | Value |
|---|---|
| Daily budget | **$3** |
| Keywords | `keywords/brand-exact.csv` (all Exact match) |
| Search Match | **Off** |
| Ad group default max CPT | $0.80 |
| Negative keywords | none |
| CPP / ad variation | Default product page |

**Why it exists:** someone typing "deeplife simulator" has already decided. These
are the cheapest installs in the account and they anchor your blended CPA. Bid
high enough to hold position 1 — a competitor buying your brand name gets your
install otherwise. Expect CPT near the $0.20–0.40 floor and CR well above the
~64% all-category median.

**Do not skip it because "we'd get those installs organically."** You partly
would; you also cede the top of your own branded SERP. Budget it at 10% of
account spend and stop worrying about the incrementality debate at $3/day.

### 1.2 `DLS-US-Category-Exact` — genre demand (the core)

| Setting | Value |
|---|---|
| Daily budget | **$12** |
| Ad groups | 8 — one per theme, below |
| Match type | Exact only |
| Search Match | **Off** |
| Negative keywords | Campaign-level: `negatives/global-negatives.csv` |

One keyword theme per ad group, because the ad group is the unit that carries a
bid and a creative. Eight themes, matched to what the game actually simulates:

| Ad group | Theme | Start max CPT | CPP |
|---|---|---|---|
| `LifeSim-Core` | life simulator / life sim / virtual life | $1.10 | `CPP-LifeSim` |
| `Money-Wealth` | get rich, billionaire, money simulator | $0.95 | `CPP-Wealth` |
| `Career-Job` | career simulator, job sim, work life | $0.85 | `CPP-Career` |
| `Investing-Stocks` | stock market game, trading sim, crypto | $0.90 | `CPP-Investing` |
| `Business-Tycoon` | tycoon, business simulator, empire | $0.95 | `CPP-Wealth` |
| `RealEstate` | property tycoon, real estate game | $0.85 | `CPP-Investing` |
| `Crime-Underground` | crime simulator, mafia, dark web | $0.80 | `CPP-Crime` |
| `Choices-Story` | choices game, story game, decisions | $0.75 | `CPP-Choices` |

Keywords per ad group: `keywords/category-exact.csv` (the `ad_group` column maps
them). Bids are starting points — at add time Apple shows a suggested bid range
per keyword; if the suggestion's low end is above the number here, use the low
end, and if the whole range is above $2.00 park the keyword in Discovery instead
of paying to learn.

### 1.3 `DLS-US-Competitor-Exact` — conquest, on a short leash

| Setting | Value |
|---|---|
| Daily budget | **$6** (hard cap — do not raise before it proves out) |
| Ad groups | 3 — `BitLife`, `LifeSim-Rivals`, `Tycoon-Rivals` |
| Match type | Exact only |
| Search Match | **Off** |
| Start max CPT | $1.20 · BitLife group $1.50 |
| CPP | `CPP-Switcher` (the "if you liked BitLife" page) |

**Read this before funding it.** Competitor terms are the most expensive and
worst-converting inventory in Apple Ads: the searcher named a specific app and
you are the interruption. Games already carry the lowest tap-through rate of any
category (~7.7% benchmark), and competitor ad groups run below their own
category average. They are worth running because a switcher is a high-intent,
high-LTV user — but only with a CPP that speaks to the switch, and only with a
CPA cap you enforce weekly. If the BitLife group has not cleared its CPA target
after $150 of spend, pause it and put the money in Category.

### 1.4 `DLS-US-Discovery-Broad` — the mining rig

| Setting | Value |
|---|---|
| Daily budget | **$9** |
| Ad groups | 2 — `Discovery-Broad`, `Discovery-SearchMatch` |
| Match type | Broad (`Discovery-Broad`) / no keywords (`Discovery-SearchMatch`) |
| Search Match | **On** (both) |
| Start max CPT | $0.55 — deliberately below the exact campaigns |
| Negatives | `negatives/global-negatives.csv` **+** every keyword from 1.1–1.3 as Exact negatives (`negatives/discovery-graduated.csv`) |
| CPP | Default product page |

Splitting broad-match keywords and pure Search Match into two ad groups lets you
kill one without the other; Search Match usually finds the long tail, broad match
usually finds the near-misses.

**This campaign's output is a report, not installs.** Its job is the search-term
report. Never let it outbid your exact campaigns — that is what the negative list
prevents, and why its max CPT sits below theirs.

### 1.5 `DLS-US-MaxConv` — phase 3 only

Do **not** create this at launch. Maximize Conversions is a target-CPA automated
bidder; it needs conversion volume to learn from, and Apple's own guidance is a
daily budget of **target CPA × 5 minimum, × 10 recommended**, with a **two-week**
learning period before you judge it. A campaign getting 50 installs/day learns in
two weeks what a 5 installs/day campaign takes ten weeks to learn.

Create it when *both* are true: the account has run ≥30 days, and Category+
Discovery together deliver ≥5 installs/day. Then:

| Setting | Value |
|---|---|
| Bid strategy | Maximize Conversions |
| Target CPA | Your trailing-30-day blended CPA, **or slightly above it** — never below |
| Daily budget | Target CPA × 10 |
| Keywords | Seed with the graduated winners; Search Match **on** |
| Negatives | `negatives/global-negatives.csv` |

Setting the target CPA aggressively below your real blended CPA is the standard
failure: the bidder cannot find inventory, delivery collapses, and you conclude
automation "doesn't work". Start at or above blended, let it stabilize for two
weeks, then tighten by ≤10% per week.

---

## Part 2 — Negative keywords (do this at creation, not after)

Apply from `03-negative-keywords.md`:

1. **Campaign-level** `negatives/global-negatives.csv` on **all** campaigns
   except Brand. These are the cross-genre and wrong-vertical blocks
   ("life insurance", "truck simulator", "life360") that broad match and Search
   Match will otherwise find within days.
2. **Campaign-level** `negatives/discovery-graduated.csv` on
   `DLS-US-Discovery-Broad` — every keyword you bid on elsewhere, as Exact
   negatives. Regenerate this file every time a keyword graduates (`06`).
3. **Ad-group-level** `negatives/adgroup-crosslocks.csv` — stops the eight
   Category ad groups cannibalising each other.

All negative keywords are **Exact match**. Broad negatives block more than you
intend; on a keyword set this thematically tight, one careless broad negative
("money") can silently mute an entire ad group.

---

## Part 3 — Creative: ad variations from Custom Product Pages

Apple builds the default search-results ad automatically from your product page
metadata — you cannot upload standalone ad creative. What you *can* control is
which product page the ad is built from and taps into, via **ad variations**
backed by **Custom Product Pages**.

This is the highest-leverage creative lever available: ad variations built on
CPPs deliver **+9% TTR on average and +27% in search results campaigns**, and
referring taps to a CPP instead of the default page raises conversion
substantially. You may publish up to **70 CPPs** (raised from 35 in Oct 2025) and
attach up to **10 per ad group**.

Build the six pages briefed in [`04-custom-product-pages.md`](04-custom-product-pages.md)
in App Store Connect → your app → **Custom Product Pages**, then in Apple Ads →
ad group → **Ad variations** → attach the matching CPP per the table in 1.2/1.3.

Do not attach a CPP to Discovery. Discovery's traffic is undefined by
construction; the default page is the right neutral destination.

---

## Part 4 — The other placements (week 4+, separate campaigns, separate budgets)

Only after Search Results is profitable:

| Campaign | Placement | Budget | Creative | Notes |
|---|---|---|---|---|
| `DLS-US-SearchTab` | Search tab | $3/day | Name + icon + subtitle, CPP-backed | Pre-intent; appears before the user types. Judge on CPA, expect it to be worse than search results. |
| `DLS-US-TodayTab` | Today tab | $5/day | Requires a CPP as the tap destination | Awareness inventory, highest CPM-like cost. Only run it during a launch/update moment. |
| `DLS-US-ProductPages` | Product Pages | $4/day | CPP-Switcher | Appears in "You Might Also Like" on other apps' pages — the closest thing to conquest without bidding on the brand term. |

Keep each in its own campaign. Mixing placements in one budget makes the search
results numbers unreadable, and search results is the only placement where the
keyword lists in this program apply.

---

## Part 5 — Launch checklist

- [ ] Apple Ads **Advanced** account, time zone + currency set deliberately
- [ ] Go/no-go gate in [`README.md`](README.md) cleared (rating, app name, attribution, screenshots)
- [ ] `Purchases.enableAdServicesAttributionTokenCollection()` live in a **released** build
- [ ] RevenueCat → Apple Search Ads integration enabled in the RC dashboard
- [ ] 4 campaigns created, Search Results placement, US only
- [ ] 8 Category ad groups + 3 Competitor ad groups created with the bids above
- [ ] Keywords imported from `keywords/*.csv`, all Exact, Search Match **off**
- [ ] Discovery created with broad + Search Match **on**, max CPT below exact
- [ ] All three negative lists applied at the right level, all Exact
- [ ] 6 CPPs published in App Store Connect and attached as ad variations
- [ ] Budgets: $3 / $12 / $6 / $9 = **$30/day**
- [ ] Calendar reminder: no structural changes for **14 days** (Part 6)

---

## Part 6 — The two-week freeze

After launch, change nothing structural for 14 days except:

- pausing a keyword that has spent 3× target CPA with zero installs, and
- adding negatives from the search-term report.

Everything else — bid changes, budget shifts, new keywords, pausing ad groups —
waits for the first weekly review in [`06-optimization-playbook.md`](06-optimization-playbook.md).
Apple's auction needs the impressions to calibrate, and daily bid-fiddling on a
$30/day account produces noise you will misread as signal. This is the single
most commonly broken rule in small Apple Ads accounts.

---

## Sources

- [Apple Ads — Campaign Structure best practices](https://ads.apple.com/app-store/best-practices/campaign-structure)
- [Apple Ads — Maximize Conversions best practices](https://ads.apple.com/app-store/best-practices/maximize-conversions)
- [MobileAction — Ad variations with custom product pages](https://www.mobileaction.co/blog/ad-variations-with-custom-product-pages/)
- [RespectASO — Custom product pages in 2026](https://respectaso.com/blog/custom-product-pages-app-store-guide-2026/)
- [FoxData — Today tab, Search tab, Search results & product pages](https://foxdata.com/en/blogs/promote-your-app-with-apple-search-ads-2026-today-tab-search-tab-search-results-product-pages/)
- [AppTweak — Apple Ads benchmarks 2026](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks)
